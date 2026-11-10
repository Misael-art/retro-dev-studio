import { describe, expect, it } from "vitest";

import { describeEditScope, revertOverridePatch } from "./editScope";
import type { Entity, Scene } from "./ipc/sceneService";
import { useEditorStore } from "./store/editorStore";

const sprite = { asset: "enemy.png", frame_width: 16, frame_height: 16 };
function entity(id: string, prefab: string | null, components: Record<string, unknown>): Entity {
  return { entity_id: id, prefab, transform: { x: 0, y: 0 }, components } as unknown as Entity;
}

const source = {
  entities: [
    entity("a", "enemy.json", { sprite: null, collision: null }),
    entity("b", "enemy.json", { sprite: { ...sprite, asset: "enemy_red.png" }, collision: null }),
    entity("c", null, { sprite }),
  ],
} as unknown as Scene;
const resolved = {
  entities: [
    entity("a", "enemy.json", { sprite, collision: { width: 16, height: 16 } }),
    entity("b", "enemy.json", { sprite: { ...sprite, asset: "enemy_red.png" }, collision: { width: 16, height: 16 } }),
    entity("c", null, { sprite }),
  ],
} as unknown as Scene;

describe("editScope", () => {
  it("labels scene-only entities and model instances with use count", () => {
    expect(describeEditScope(source, resolved, "c")).toEqual({ kind: "scene", label: "Nesta cena" });
    expect(describeEditScope(source, resolved, "a")).toMatchObject({
      kind: "instance",
      model: "enemy.json",
      uses: 2,
      overridden: [],
      inherited: ["sprite", "collision"],
    });
    expect(describeEditScope(source, resolved, "b")).toMatchObject({ overridden: ["sprite"], inherited: ["collision"] });
  });

  it("revert patch only exists for local overrides", () => {
    expect(revertOverridePatch(source.entities[1], "sprite")).toEqual({ components: { sprite: null } });
    expect(revertOverridePatch(source.entities[0], "sprite")).toBeNull();
    expect(revertOverridePatch(source.entities[2], "sprite")).toBeNull();
  });

  it("replaceScenesWithHistory is one undoable transaction that restores both scenes", () => {
    useEditorStore.setState({ undoStack: [], redoStack: [] });
    useEditorStore.getState().setActiveScene(resolved, source);
    useEditorStore.setState({ undoStack: [], redoStack: [] });
    const nextSource = structuredClone(source);
    (nextSource.entities[1].components as Record<string, unknown>).sprite = null;
    const nextResolved = structuredClone(resolved);
    nextResolved.entities[1].components.sprite = { ...sprite } as never;
    useEditorStore.getState().replaceScenesWithHistory(nextResolved, nextSource);
    let s = useEditorStore.getState();
    expect(s.undoStack).toHaveLength(1);
    expect(s.activeSceneSource?.entities[1].components.sprite).toBeNull();
    expect(s.activeScene?.entities[1].components.sprite?.asset).toBe("enemy.png");
    // A outra instância e o modelo não mudaram.
    expect(s.activeScene?.entities[0].components.sprite?.asset).toBe("enemy.png");
    s.undo();
    s = useEditorStore.getState();
    expect(s.activeSceneSource?.entities[1].components.sprite?.asset).toBe("enemy_red.png");
    expect(s.activeScene?.entities[1].components.sprite?.asset).toBe("enemy_red.png");
  });
});
