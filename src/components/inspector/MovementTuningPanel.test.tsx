import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Entity, Scene } from "../../core/ipc/sceneService";
import { deserializeNodeGraph } from "../../core/nodegraph/nodeDefinitions";
import { serializeNodeGraph, type NodeGraph } from "../../core/nodegraph/nodeTypes";
import { useEditorStore } from "../../core/store/editorStore";
import MovementTuningPanel from "./MovementTuningPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
const graph = { nodes: [
  { id: "run", type: "set_velocity", label: "Correr", x: 0, y: 0, params: { target: "player", vx: 32, vy: 0 }, inputs: [], outputs: [] },
  { id: "jump", type: "set_velocity", label: "Pulo", x: 0, y: 0, params: { target: "player", vx: 0, vy: -64 }, inputs: [], outputs: [] },
], edges: [] } as unknown as NodeGraph;
const player = () => useEditorStore.getState().activeScene!.entities.find((e) => e.entity_id === "player")!;

beforeEach(() => {
  const entity = { entity_id: "player", display_name: "Player", prefab: null, transform: { x: 0, y: 0 },
    components: { physics: { gravity: true, gravity_strength: 6, friction: 0 }, logic: { graph: serializeNodeGraph(graph) } } } as unknown as Entity;
  useEditorStore.getState().setActiveProject("/one", "One");
  useEditorStore.getState().setActiveScene({ scene_id: "main", entities: [entity], background_layers: [], palettes: [] } as unknown as Scene);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const setValue = async (id: string, value: string) => act(async () => {
  const input = container.querySelector(`[data-testid="movement-input-${id}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
});

it("edits the jump node and gravity in backend units, with an undoable store update", async () => {
  await act(async () => root.render(<MovementTuningPanel entity={player()} />));
  expect(container.querySelector('[data-testid="movement-reading-jump:vy"]')?.textContent).toBe("4.00 px/quadro · 240 px/s");
  await setValue("jump:vy", "80");
  expect(deserializeNodeGraph(player().components.logic!.graph as string).nodes.find((n) => n.id === "jump")?.params.vy).toBe(-80);
  await act(async () => root.render(<MovementTuningPanel entity={player()} />));
  await setValue("physics:gravity", "9");
  expect(player().components.physics?.gravity_strength).toBe(9);
  act(() => useEditorStore.getState().undo());
  expect(player().components.physics?.gravity_strength).toBe(6);
});
