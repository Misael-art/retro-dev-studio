import { describe, expect, it } from "vitest";

import type { Entity, Scene } from "./ipc/sceneService";
import type { PalettePlan } from "./palettePlan";
import {
  attentionForEntity,
  buildAttentionItems,
  findScanlineHotspots,
  suggestScanlineRedistribution,
} from "./sceneAttention";

function sprite(id: string, x: number, y: number, w = 32, h = 16): Entity {
  return {
    entity_id: id,
    transform: { x, y },
    components: { sprite: { asset: `assets/${id}.png`, frame_width: w, frame_height: h } },
  } as Entity;
}

function scene(entities: Entity[]): Scene {
  return { scene_id: "s", entities, background_layers: [] } as unknown as Scene;
}

describe("sceneAttention", () => {
  it("finds the crowded band and the sprites inside it", () => {
    const s = scene([sprite("a", 0, 0), sprite("b", 40, 0), sprite("c", 80, 0), sprite("far", 0, 100)]);
    const hotspots = findScanlineHotspots(s, "megadrive", 2);
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0]).toMatchObject({ top: 0, bottom: 16, peak: 3 });
    expect(hotspots[0].entityIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("counts wide sprites as several hardware pieces per line", () => {
    const s = scene([sprite("wide", 0, 0, 64), sprite("b", 80, 0)]);
    expect(findScanlineHotspots(s, "megadrive", 2)[0]?.peak).toBe(3);
  });

  it("suggests the smallest vertical move that clears every line", () => {
    const s = scene([sprite("a", 0, 0), sprite("b", 40, 0), sprite("c", 80, 0)]);
    const moves = suggestScanlineRedistribution(s, "megadrive", 2);
    expect(moves).toHaveLength(1);
    const moved = scene(
      s.entities.map((e) => (e.entity_id === moves[0].entityId ? { ...e, transform: { ...e.transform, y: moves[0].toY } } : e))
    );
    expect(findScanlineHotspots(moved, "megadrive", 2)).toHaveLength(0);
  });

  it("turns palette errors into one guided item linked to the entities", () => {
    const plan = {
      diagnostics: [{ severity: "error", code: "sem_banco", message: "x", uses: ["a", "ghost"], resources: [], actions: [] }],
    } as unknown as PalettePlan;
    const items = buildAttentionItems({ scene: scene([sprite("a", 0, 0)]), target: "megadrive", hwStatus: null, palettePlan: plan });
    expect(items[0]).toMatchObject({ id: "palette", severity: "blocker", entityIds: ["a"] });
    expect(items[0].actions).toContain("open_palettes");
    expect(attentionForEntity(items, "a").map((i) => i.id)).toEqual(["palette"]);
    expect(items[items.length - 1].id).toBe("ready");
  });

  it("offers only the test step when the scene is healthy", () => {
    const items = buildAttentionItems({ scene: scene([sprite("a", 0, 0)]), target: "megadrive", hwStatus: null, palettePlan: null });
    expect(items.map((i) => i.id)).toEqual(["ready"]);
    expect(items[0].title).toBe("Cena pronta para testar");
  });
});
