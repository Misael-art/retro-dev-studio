import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Scene } from "../../core/ipc/sceneService";
import { CONFIGURE_CAMERA_EVENT } from "../../core/cameraWorkflow";
import { useEditorStore } from "../../core/store/editorStore";
import { StudioContextBar } from "./StudioContextBar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
const scene = {
  scene_id: "main", background_layers: [], palettes: [],
  entities: [
    { entity_id: "player", display_name: "Player", prefab: null, transform: { x: 48, y: 120 }, components: { sprite: { asset: "a.png", frame_width: 32, frame_height: 32 } } },
    { entity_id: "main_camera", display_name: "Main Camera", prefab: null, transform: { x: 0, y: 0 }, components: { camera: { follow_entity: "player" } } },
  ],
} as unknown as Scene;

beforeEach(() => {
  useEditorStore.getState().setActiveProject("/one", "One");
  useEditorStore.getState().setActiveScene(structuredClone(scene));
  useEditorStore.setState({ activeWorkspace: "scene", activeViewportTab: "scene" });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it("offers Configurar câmera for a camera and asks the mounted configurator to open it", async () => {
  useEditorStore.getState().setSelectedEntityId("main_camera");
  act(() => root.render(<StudioContextBar />));
  const requests: (string | undefined)[] = [];
  const claim = (event: Event) => { event.preventDefault(); requests.push((event as CustomEvent<{ entityId?: string }>).detail.entityId); };
  window.addEventListener(CONFIGURE_CAMERA_EVENT, claim);
  await act(async () => {
    (container.querySelector('[data-testid="studio-open-camera"]') as HTMLButtonElement).click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
  window.removeEventListener(CONFIGURE_CAMERA_EVENT, claim);
  expect(requests).toEqual(["main_camera"]);
  expect(container.querySelector('[data-testid="studio-open-character"]')).toBeNull();
});

it("does not offer camera configuration for a sprite", () => {
  useEditorStore.getState().setSelectedEntityId("player");
  act(() => root.render(<StudioContextBar />));
  expect(container.querySelector('[data-testid="studio-open-camera"]')).toBeNull();
  expect(container.querySelector('[data-testid="studio-open-character"]')).toBeTruthy();
});
