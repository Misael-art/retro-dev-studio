import { describe, expect, it } from "vitest";
import { describeSceneHistory } from "./sceneHistory";
import type { Scene } from "./ipc/sceneService";

const scene: Scene = {
  scene_id: "sala", background_layers: [], entities: [{
    entity_id: "raposa", display_name: "Raposa", transform: { x: 64, y: 136 }, components: { sprite: {
      asset: "assets/sprites/raposa.png", frame_width: 32, frame_height: 32,
      animations: { passo: { frames: [0, 1, 1], occurrence_ids: ["o1", "o2", "o3"], frame_durations: [5, 3, 2], fps: 12, loop: true } },
    } },
  }],
};

describe("describeSceneHistory", () => {
  it("reports the duration of one occurrence even when the same picture is used twice", () => {
    const after = structuredClone(scene);
    after.entities[0].components.sprite!.animations!.passo.frame_durations = [5, 6, 2];
    const changes = describeSceneHistory(scene, after);
    expect(changes).toEqual(["Raposa · passo · o2 · 3 → 6 ticks"]);
  });

  it("names position, added entities and scene-level edits together", () => {
    const after = structuredClone(scene);
    after.entities[0].transform.x = 72;
    after.entities.push({ entity_id: "lanterna", display_name: "Lanterna", transform: { x: 0, y: 0 }, components: {} });
    after.palettes = [{ slot: 0, colors: ["#000000"] }];
    expect(describeSceneHistory(scene, after)).toEqual(["Raposa · X 64 → 72 px", "Lanterna · incluído", "Paletas"]);
  });
});
