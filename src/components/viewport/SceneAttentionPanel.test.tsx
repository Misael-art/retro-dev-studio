import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { AttentionList } from "./SceneAttentionPanel";
import { useEditorStore } from "../../core/store/editorStore";
import { useSceneAttentionStore } from "../../core/sceneAttentionStore";
import type { Scene } from "../../core/ipc/sceneService";

it("refuses a position proposal after switching projects, even when object IDs match", async () => {
  const scene: Scene = { scene_id: "main", background_layers: [], entities: Array.from({ length: 21 }, (_, i) => ({ entity_id: `sprite_${i}`, prefab: null, transform: { x: i * 32, y: 0 }, components: { sprite: { asset: "sprite.png", frame_width: 32, frame_height: 16 } } })) };
  useEditorStore.setState({ activeScene: scene, activeSceneSource: structuredClone(scene), hwStatus: null, activeTarget: "megadrive", projectSessionId: 100, activeScenePath: "scenes/main.json", sceneRevision: 1, consoleEntries: [] });
  useSceneAttentionStore.setState({ focus: null });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const q = (id: string) => host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  try {
    await act(async () => root.render(<AttentionList items={[{ id: "scanline", kind: "scanline", severity: "warning", title: "Sprites", why: "", technical: "", entityIds: scene.entities.map((entity) => entity.entity_id), actions: ["redistribute"] }]} />));
    await act(async () => q("attention-action-scanline-redistribute").click());
    expect(q("attention-apply-scanline")).not.toBeNull();
    const nextScene = structuredClone(scene);
    await act(async () => useEditorStore.setState({ projectSessionId: 101, activeScene: nextScene, activeSceneSource: structuredClone(nextScene) }));
    await act(async () => q("attention-apply-scanline").click());
    expect(useEditorStore.getState().activeScene).toEqual(nextScene);
    expect(useEditorStore.getState().consoleEntries.some((entry) => entry.message.includes("Gere uma nova sugestão"))).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
