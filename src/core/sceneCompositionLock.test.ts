import { describe, expect, it } from "vitest";
import type { SceneLayer } from "./ipc/sceneService";
import { describeEntityEditLock, entityEditLock } from "./sceneComposition";
import { useEditorStore } from "./store/editorStore";

const layer = (id: string, locked: boolean, entity_ids: string[]): SceneLayer => ({ id, name: id === "bg" ? "Céu" : id, kind: "sprite", visible: true, locked, depth: 0, entity_ids });

describe("R3-08 entity edit lock", () => {
  it("distinguishes object lock, inherited layer lock and free objects", () => {
    const layers = [layer("bg", true, ["sky"]), layer("fg", false, ["nalu", "coin"])];
    expect(entityEditLock("nalu", layers, ["nalu"])).toEqual({ locked: true, reason: "object" });
    expect(entityEditLock("sky", layers, [])).toEqual({ locked: true, reason: "layer", layerName: "Céu" });
    expect(entityEditLock("coin", layers, ["nalu"])).toEqual({ locked: false });
    expect(entityEditLock("orphan", null, [])).toEqual({ locked: false });
    expect(describeEntityEditLock(entityEditLock("sky", layers, []))).toBe("Bloqueado pela camada «Céu»");
  });

  it("locking an object does not lock siblings, create layers or touch the authored scene", () => {
    const scene = { layers: [layer("fg", false, ["nalu", "coin"])] };
    const before = JSON.stringify(scene);
    const { toggleEntityLock } = useEditorStore.getState();
    toggleEntityLock("scenes/a.json", "nalu");
    const ids = useEditorStore.getState().lockedEntityIdsByScene["scenes/a.json"];
    expect(entityEditLock("nalu", scene.layers, ids)).toMatchObject({ locked: true });
    expect(entityEditLock("coin", scene.layers, ids)).toEqual({ locked: false });
    expect(JSON.stringify(scene)).toBe(before);
    expect(useEditorStore.getState().lockedEntityIdsByScene["scenes/b.json"]).toBeUndefined();
    toggleEntityLock("scenes/a.json", "nalu");
    expect(useEditorStore.getState().lockedEntityIdsByScene["scenes/a.json"]).toEqual([]);
  });
});
