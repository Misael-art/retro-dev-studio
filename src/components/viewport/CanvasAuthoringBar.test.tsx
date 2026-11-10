import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasAuthoringBar, type CanvasPathTool } from "./CanvasAuthoringBar";
import type { Entity, Scene } from "../../core/ipc/sceneService";
import { entityLockScopeKey } from "../../core/sceneComposition";
import { useEditorStore } from "../../core/store/editorStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const persistActiveScene = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../core/scenePersistence", () => ({ persistActiveScene }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => { throw new Error(`comando inesperado ${command}`); }),
}));

const PROJECT = "/p";
const SCENE_PATH = "scenes/main.json";
const sprite = { asset: "assets/sprites/grade.png", frame_width: 24, frame_height: 32, priority: "foreground" };
const entity = (id: string, components: Record<string, unknown>): Entity =>
  ({ entity_id: id, prefab: null, transform: { x: 0, y: 0 }, components }) as unknown as Entity;
const scene = (entities: Entity[]): Scene =>
  ({ scene_id: "main", entities, palettes: [], layers: [], background_layers: [] }) as unknown as Scene;

let host: HTMLDivElement;
let root: Root;
let toolChanges: CanvasPathTool[];

function open(entities: Entity[], selected: string, target = "megadrive", locked: string[] = []) {
  useEditorStore.setState({
    activeProjectDir: PROJECT, activeScenePath: SCENE_PATH, activeScene: scene(entities), selectedEntityId: selected,
    activeTarget: target, editorMode: "select", lockedEntityIdsByScene: { [entityLockScopeKey(PROJECT, SCENE_PATH)]: locked },
  } as never);
  act(() => root.render(<CanvasAuthoringBar pathTool="edit" onPathToolChange={(tool) => toolChanges.push(tool)} />));
}
const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid=${id}]`);
const click = (id: string) => act(() => { byId(id)!.click(); });
const storedPath = (id: string) => useEditorStore.getState().activeScene!.entities.find((item) => item.entity_id === id)!.components.path;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  toolChanges = [];
  persistActiveScene.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useEditorStore.setState({ activeScene: null, selectedEntityId: null, editorMode: "select", lockedEntityIdsByScene: {} } as never);
});

describe("CanvasAuthoringBar", () => {
  it("opens the path tool next to the Canvas and starts a new path with the line tool", () => {
    open([entity("grade", { sprite })], "grade");
    expect(byId("canvas-path-context")).toBeNull();

    click("viewport-tool-path");

    expect(useEditorStore.getState().editorMode).toBe("path");
    expect(byId("viewport-tool-path")!.getAttribute("aria-pressed")).toBe("true");
    expect(toolChanges).toEqual(["line"]);
    expect(byId("canvas-path-context")).not.toBeNull();

    click("viewport-tool-path");
    expect(useEditorStore.getState().editorMode).toBe("select");
    expect(byId("canvas-path-context")).toBeNull();
  });

  it("selects handle editing when the object already has a path", () => {
    const path = { mode: "once", points: [{ x: 0, y: 0, frames: 0, wait: 0 }, { x: 16, y: 0, frames: 30, wait: 0 }] };
    open([entity("grade", { sprite, path })], "grade");
    click("viewport-tool-path");
    expect(toolChanges).toEqual(["edit"]);
  });

  it("writes the same components.path as the Inspector and persists the scene", () => {
    open([entity("grade", { sprite })], "grade");
    click("viewport-tool-path");
    click("inspector-path-add");

    const path = storedPath("grade");
    expect(path?.mode).toBe("pingpong");
    expect(path?.points).toHaveLength(2);
    expect(persistActiveScene).toHaveBeenCalledWith(PROJECT, "Canvas", "Trajeto atualizado.");
  });

  it("explains why a path is unavailable and never mutates a blocked object", () => {
    open([entity("heroi", { sprite, physics: { gravity: true } })], "heroi");
    click("viewport-tool-path");
    expect(byId("canvas-path-context")!.textContent).toContain("física/entrada");
    expect(byId("inspector-path-add")).toBeNull();
    expect(byId("inspector-path-blocked")).not.toBeNull();
    expect(storedPath("heroi")).toBeUndefined();
    expect(persistActiveScene).not.toHaveBeenCalled();
  });

  it("refuses paths on targets without execution", () => {
    open([entity("grade", { sprite })], "grade", "snes");
    click("viewport-tool-path");
    expect(byId("canvas-path-context")!.textContent).toContain("Disponíveis no Mega Drive");
    expect(byId("inspector-path-add")).toBeNull();
  });

  it("keeps a locked object untouched and shows the lock", () => {
    open([entity("grade", { sprite })], "grade", "megadrive", ["grade"]);
    expect(byId("canvas-authoring-tools")!.textContent).toContain("Objeto bloqueado");
    click("viewport-tool-path");
    expect(byId("inspector-path-add")).toBeNull();
    expect(storedPath("grade")).toBeUndefined();
  });

  it("leaves path mode when composition opens and edits sprite priority in the shared store", () => {
    open([entity("grade", { sprite })], "grade");
    click("viewport-tool-path");
    click("viewport-tool-composition");

    expect(useEditorStore.getState().editorMode).toBe("select");
    expect(byId("canvas-path-context")).toBeNull();
    const select = byId("inspector-prop-priority-input") as HTMLSelectElement;
    expect(select.value).toBe("foreground");

    act(() => {
      select.value = "background";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const stored = useEditorStore.getState().activeScene!.entities[0].components.sprite;
    expect(stored?.priority).toBe("background");
    expect(persistActiveScene).toHaveBeenCalledWith(PROJECT, "Canvas");
  });

  it("asks for a selection instead of offering composition controls for nothing", () => {
    open([entity("grade", { sprite })], "ausente");
    click("viewport-tool-composition");
    expect(byId("canvas-composition-context")!.textContent).toContain("Selecione um mapa ou sprite");
    expect(byId("sprite-priority-controls")).toBeNull();
  });
});
