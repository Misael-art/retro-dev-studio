import { describe, expect, it } from "vitest";
import { layerCompositionEntities, translateCollisionMap } from "./sceneComposition";
import type { CollisionMap, Entity, SceneLayer } from "./ipc/sceneService";

const map: CollisionMap = {
  width: 4, height: 3, tile_width: 8, tile_height: 8,
  data: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
};

describe("scene composition movement", () => {
  it("moves the whole collision grid by tile units without losing source data", () => {
    const moved = translateCollisionMap(map, 8, 8);
    expect(moved?.data).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(map.data[1]).toBe(1);
    expect(translateCollisionMap(moved!, -8, -8)?.data).toEqual(map.data);
  });

  it("refuses clipping, fractional cells and malformed maps", () => {
    expect(translateCollisionMap(map, -16, 0)).toBeNull();
    expect(translateCollisionMap(map, 1, 0)).toBeNull();
    expect(translateCollisionMap({ ...map, data: [] }, 8, 0)).toBeNull();
    expect(translateCollisionMap(map, Number.NaN, 0)).toBeNull();
  });

  it("moves only a complete, editable layer membership", () => {
    const entities = ["player", "goal"].map((id): Entity => ({
      entity_id: id, transform: { x: 0, y: 0 }, components: {},
    }));
    const layer: SceneLayer = {
      id: "gameplay", name: "Gameplay", kind: "sprite", visible: true,
      locked: false, depth: 0, entity_ids: ["player", "goal"],
    };
    expect(layerCompositionEntities(layer, entities)).toEqual(entities);
    expect(layerCompositionEntities({ ...layer, entity_ids: ["player", "missing"] }, entities)).toBeNull();
    expect(layerCompositionEntities({ ...layer, locked: true }, entities)).toBeNull();
    expect(layerCompositionEntities({ ...layer, entity_ids: ["player", "player"] }, entities)).toBeNull();
  });
});
