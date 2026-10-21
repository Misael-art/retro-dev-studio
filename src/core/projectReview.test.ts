import { describe, expect, it } from "vitest";

import type { Scene } from "./ipc/sceneService";
import { reviewProject } from "./projectReview";

function scene(opts: { audio?: boolean; hud?: { column: number; row: number; label: string }; diverge?: boolean }): Scene {
  const anim = (d: number) => ({
    frames: [0, 1],
    fps: 30,
    loop: true,
    frame_durations: [2, d],
    mugen_frames: [
      { group: 0, image: 0, duration: 2 },
      { group: 0, image: 1, duration: d },
    ],
    occurrence_ids: ["o1", "o2"],
    frame_events: [{ id: "ev1", occurrence: "o2", tick: 1, kind: "sound", sound: "hit", origin: "authored" }],
  });
  const ken = (id: string, d: number) => ({
    entity_id: id,
    display_name: id,
    transform: { x: 0, y: 0 },
    components: {
      sprite: { asset: "ken.png", frame_width: 8, frame_height: 8, animations: { action_200: anim(d) } },
      ...(opts.audio ? { audio: { sfx: { hit: "hit.wav" } } } : {}),
    },
  });
  const entities: unknown[] = [ken("ken", 2), ken("ken_2", opts.diverge ? 3 : 2)];
  if (opts.hud) entities.push({ entity_id: "vida", transform: { x: 0, y: 0 }, components: { hud: { ...opts.hud, digits: 3 } } });
  return { entities } as unknown as Scene;
}

describe("reviewProject", () => {
  it("passes a valid project and counts checks", () => {
    const result = reviewProject(scene({ audio: true, hud: { column: 2, row: 25, label: "VIDA" } }));
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });

  it("reports missing sound with navigation to the exact occurrence/event", () => {
    const result = reviewProject(scene({ audio: false }));
    const item = result.items.find((i) => i.title === "Som não encontrado")!;
    expect(item.severity).toBe("error");
    expect(item.target).toMatchObject({ task: "character", entityId: "ken", animation: "action_200", occurrenceId: "o2", eventId: "ev1" });
  });

  it("separates blocking HUD errors from safe-area warnings", () => {
    const off = reviewProject(scene({ audio: true, hud: { column: 39, row: 25, label: "VIDA" } }));
    expect(off.items.some((i) => i.severity === "error" && i.target.property === "hud")).toBe(true);
    const edge = reviewProject(scene({ audio: true, hud: { column: 0, row: 25, label: "VIDA" } }));
    expect(edge.errors).toBe(0);
    expect(edge.items.find((i) => i.severity === "warning")?.title).toBe("Texto fora da área segura");
  });

  it("flags diverging instances of the same MUGEN model", () => {
    const result = reviewProject(scene({ audio: true, diverge: true }));
    expect(result.items.some((i) => i.title === "Instâncias do personagem divergentes")).toBe(true);
  });
});

describe("reviewProject missing files", () => {
  it("reports a missing referenced file once, pointing to the owning entity", () => {
    const s = scene({ audio: true });
    const result = reviewProject(s, [
      { file: "scenes/main.json", value: "ken.png", exists: false },
      { file: "prefabs/x.json", value: "ken.png", exists: false },
      { file: "scenes/main.json", value: "assets/ok.png", exists: true },
    ]);
    const missing = result.items.filter((i) => i.title === "Arquivo não encontrado");
    expect(missing).toHaveLength(1);
    expect(missing[0].detail).toContain("scenes/main.json, prefabs/x.json");
    expect(missing[0].target).toMatchObject({ task: "scene", entityId: "ken" });
  });
});
