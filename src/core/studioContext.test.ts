import { beforeEach, describe, expect, it } from "vitest";

import type { Scene } from "./ipc/sceneService";
import { useEditorStore } from "./store/editorStore";
import {
  STUDIO_RETURN_STACK_LIMIT,
  initialStudioContext,
  loadStudioContext,
  navigateStudio,
  refineStudioFocus,
  returnStudioOrigin,
  saveStudioContext,
} from "./studioContext";

function scene(ids: string[]): Scene {
  return {
    scene_id: "s",
    background_layers: [],
    entities: ids.map((id) => ({
      entity_id: id,
      prefab: null,
      transform: { x: 0, y: 0 },
      components: {},
    })),
  } as unknown as Scene;
}

describe("studioContext (pure)", () => {
  it("stacks origin with its camera and restores it on return", () => {
    let state = refineStudioFocus(initialStudioContext(), { entityId: "ken" });
    state = navigateStudio(
      state,
      { workspace: "scene", camera: { zoom: 2, panX: 40, panY: -12 } },
      { focus: { task: "character", animation: "action_200", occurrenceId: "occ-2" } }
    );
    expect(state.focus).toMatchObject({ task: "character", entityId: "ken", animation: "action_200", occurrenceId: "occ-2" });
    expect(state.returnStack).toHaveLength(1);

    const result = returnStudioOrigin(state, scene(["ken"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.workspace).toBe("scene");
    expect(result.entry.camera).toEqual({ zoom: 2, panX: 40, panY: -12 });
    expect(result.state.focus).toMatchObject({ task: "scene", entityId: "ken", animation: null });
    expect(result.state.returnStack).toHaveLength(0);
    expect(result.state.cameras.scene).toEqual({ zoom: 2, panX: 40, panY: -12 });
    expect(result.state.restoreSeq).toBe(state.restoreSeq + 1);
  });

  it("does not leak animation focus across a different entity", () => {
    let state = refineStudioFocus(initialStudioContext(), { entityId: "a", animation: "walk", occurrenceId: "occ-1" });
    state = navigateStudio(state, { workspace: "scene", camera: null }, { focus: { task: "character", entityId: "b" } });
    expect(state.focus).toMatchObject({ entityId: "b", animation: null, occurrenceId: null });
  });

  it("drops origin selection explicitly when the entity was deleted", () => {
    let state = refineStudioFocus(initialStudioContext(), { entityId: "gone" });
    state = navigateStudio(state, { workspace: "scene", camera: null }, { focus: { task: "actions" } });
    const result = returnStudioOrigin(state, scene(["other"]));
    expect(result.ok && result.droppedEntity).toBe(true);
    expect(result.ok && result.state.focus.entityId).toBe(null);
  });

  it("refuses return without origin", () => {
    expect(returnStudioOrigin(initialStudioContext(), scene([])).ok).toBe(false);
  });

  it("bounds the return stack", () => {
    let state = initialStudioContext();
    for (let i = 0; i < STUDIO_RETURN_STACK_LIMIT + 5; i++) {
      state = navigateStudio(state, { workspace: "scene", camera: null }, { focus: { task: "character" } });
    }
    expect(state.returnStack).toHaveLength(STUDIO_RETURN_STACK_LIMIT);
  });

  it("persists focus and cameras per project and tolerates garbage", () => {
    const state = refineStudioFocus(initialStudioContext(), { entityId: "ken", animation: "a" });
    saveStudioContext("/p1", { ...state, cameras: { scene: { zoom: 3, panX: 1, panY: 2 } } });
    const loaded = loadStudioContext("/p1");
    expect(loaded.focus.entityId).toBe("ken");
    expect(loaded.cameras.scene?.zoom).toBe(3);
    expect(loaded.returnStack).toEqual([]);
    expect(loadStudioContext("/never").focus.entityId).toBe(null);
    localStorage.setItem("rds.studioContext.v1:/bad", "{not json");
    expect(loadStudioContext("/bad").focus.entityId).toBe(null);
  });
});

describe("studio context in editorStore", () => {
  beforeEach(() => {
    useEditorStore.setState({
      studio: initialStudioContext(),
      activeWorkspace: "scene",
      activeViewportTab: "scene",
      selectedEntityId: "ken",
      viewportZoom: 2,
      undoStack: [],
      redoStack: [],
      activeProjectDir: "",
    });
    useEditorStore.getState().setActiveScene(scene(["ken", "dummy"]));
    useEditorStore.setState({ selectedEntityId: "ken" });
  });

  it("opens the character editor and returns to scene with selection and zoom", () => {
    const store = useEditorStore.getState();
    store.refineStudioFocus({ entityId: "ken" });
    store.rememberWorkspaceCamera("scene", { zoom: 2, panX: 15, panY: 30 });
    const revision = useEditorStore.getState().sceneRevision;
    store.openStudioEditor({ focus: { task: "character", animation: "action_200" } });
    let s = useEditorStore.getState();
    expect(s.activeWorkspace).toBe("artstudio");
    expect(s.activeViewportTab).toBe("artstudio");
    expect(s.selectedEntityId).toBe("ken");
    expect(s.studio.focus.animation).toBe("action_200");

    // Mudar seleção/zoom dentro do editor de destino não altera a origem guardada.
    useEditorStore.setState({ viewportZoom: 5, selectedEntityId: "dummy" });
    const result = useEditorStore.getState().returnToStudioOrigin();
    expect(result.ok).toBe(true);
    s = useEditorStore.getState();
    expect(s.activeWorkspace).toBe("scene");
    expect(s.selectedEntityId).toBe("ken");
    expect(s.viewportZoom).toBe(2);
    expect(s.studio.cameras.scene).toEqual({ zoom: 2, panX: 15, panY: 30 });
    // Navegar não é edição: nenhum dado da cena ou histórico foi tocado.
    expect(s.sceneRevision).toBe(revision);
    expect(s.undoStack).toHaveLength(0);
  });

  it("returns to a selection made outside the Studio (hierarchy click)", () => {
    // Seleção feita pela hierarquia: só selectedEntityId muda; o foco do Studio está vazio.
    useEditorStore.setState({ selectedEntityId: "dummy" });
    expect(useEditorStore.getState().studio.focus.entityId).toBe(null);
    useEditorStore.getState().openStudioEditor({ focus: { task: "character", entityId: "dummy" } });
    useEditorStore.setState({ selectedEntityId: "ken" });
    useEditorStore.getState().returnToStudioOrigin();
    const s = useEditorStore.getState();
    expect(s.activeWorkspace).toBe("scene");
    expect(s.selectedEntityId).toBe("dummy");
  });

  it("undo restores the rich focus captured with the edit", () => {
    const store = useEditorStore.getState();
    store.refineStudioFocus({ entityId: "ken", animation: "action_200", occurrenceId: "occ-1" });
    store.updateEntity("ken", { transform: { x: 9, y: 0 } });
    store.refineStudioFocus({ occurrenceId: "occ-2" });
    useEditorStore.getState().undo();
    const s = useEditorStore.getState();
    expect(s.studio.focus.occurrenceId).toBe("occ-1");
    expect(s.activeScene?.entities.find((e) => e.entity_id === "ken")?.transform.x).toBe(0);
  });
});
