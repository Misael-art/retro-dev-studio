import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveSceneData: vi.fn(),
  getSceneData: vi.fn(),
  resolveScenePrefabs: vi.fn(),
}));

vi.mock("./ipc/sceneService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ipc/sceneService")>()),
  saveSceneData: mocks.saveSceneData,
  getSceneData: mocks.getSceneData,
  resolveScenePrefabs: mocks.resolveScenePrefabs,
}));

import { persistActiveScene, registerPendingEditFlusher, sceneDraftStorageKey } from "./scenePersistence";
import { useEditorStore } from "./store/editorStore";
import type { Scene } from "./ipc/sceneService";

const scene = (x: number): Scene =>
  ({
    scene_id: "main",
    entities: [{ entity_id: "player", prefab: null, transform: { x, y: 0 }, components: {} }],
    background_layers: [],
    palettes: [],
  }) as unknown as Scene;

describe("persistActiveScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useEditorStore.setState({
      activeProjectDir: "/tmp/project",
      activeScene: scene(77),
      activeSceneSource: scene(77),
      activeScenePath: "scenes/main.json",
      sceneRevision: 5,
      sceneDiskBaseline: { projectDir: "/tmp/project", scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify(scene(32)) },
      sceneDraftState: { status: "idle", revision: null, savedAt: null, message: null },
      sceneSaveState: { status: "idle", message: null, at: null, revision: null },
    });
  });

  it("reports a failed save, keeps the edited scene in memory and never reloads from disk", async () => {
    mocks.saveSceneData.mockResolvedValue({ ok: false, message: "disco cheio" });
    const ok = await persistActiveScene("/tmp/project", "Teste");
    const state = useEditorStore.getState();
    expect(ok).toBe(false);
    expect(state.sceneSaveState.status).toBe("failed");
    expect(state.sceneSaveState.message).toBe("disco cheio");
    expect(state.activeScene?.entities[0].transform.x).toBe(77);
    expect(state.activeSceneSource?.entities[0].transform.x).toBe(77);
    expect(mocks.getSceneData).not.toHaveBeenCalled();
    expect(localStorage.getItem(sceneDraftStorageKey("/tmp/project"))).toMatch(/\\"x\\":77/);
  });

  it("keeps the work when the IPC throws, too", async () => {
    mocks.saveSceneData.mockRejectedValue(new Error("IPC caiu"));
    expect(await persistActiveScene("/tmp/project", "Teste")).toBe(false);
    expect(useEditorStore.getState().sceneSaveState).toMatchObject({ status: "failed", message: "IPC caiu" });
    expect(useEditorStore.getState().activeScene?.entities[0].transform.x).toBe(77);
    expect(mocks.getSceneData).not.toHaveBeenCalled();
  });

  it("marks the saved revision on success", async () => {
    mocks.saveSceneData.mockResolvedValue({ ok: true, message: "" });
    expect(await persistActiveScene("/tmp/project", "Teste")).toBe(true);
    expect(useEditorStore.getState().sceneSaveState).toMatchObject({ status: "saved", revision: 5 });
  });

  it("saving the loaded disk scene preserves a different draft from the interrupted session", async () => {
    const key = sceneDraftStorageKey("/tmp/project");
    const raw = JSON.stringify({ schemaVersion: 2, projectDir: "/tmp/project", scenePath: "scenes/main.json",
      revision: 12, savedAt: "2026-10-27T12:00:00Z", sourceSceneJson: JSON.stringify(scene(99)),
      baseSourceSceneJson: JSON.stringify(scene(32)), editorSessionId: "interrupted/session" });
    localStorage.setItem(key, raw);
    mocks.saveSceneData.mockResolvedValue({ ok: true, message: "" });
    expect(await persistActiveScene("/tmp/project", "Trocar cena")).toBe(true);
    expect(localStorage.getItem(key)).toBe(raw);
    expect(useEditorStore.getState().activeSceneSource?.entities[0].transform.x).toBe(77);
  });

  it("flushes debounced editor edits before writing, so Save never misses the last edit", async () => {
    mocks.saveSceneData.mockResolvedValue({ ok: true, message: "" });
    const unregister = registerPendingEditFlusher(() => {
      useEditorStore.setState({ activeSceneSource: scene(99), activeScene: scene(99), sceneRevision: 6 });
    });
    await persistActiveScene("/tmp/project", "Teste");
    unregister();
    expect(mocks.saveSceneData.mock.calls[0][1]).toContain('"x": 99');
    expect(useEditorStore.getState().sceneSaveState).toMatchObject({ status: "saved", revision: 6 });
  });

  it("does not mark another project saved when an old response arrives, even at the same path", async () => {
    let complete!: (result: { ok: boolean; message: string }) => void;
    mocks.saveSceneData.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const saving = persistActiveScene("/tmp/project", "Teste");
    await vi.waitFor(() => expect(mocks.saveSceneData).toHaveBeenCalledTimes(1));
    useEditorStore.getState().setActiveProject("/tmp/project", "Reaberto");
    useEditorStore.getState().setSceneSaveState({ status: "idle", revision: null, at: null, message: null });
    complete({ ok: true, message: "" });
    expect(await saving).toBe(false);
    expect(useEditorStore.getState().sceneSaveState.status).toBe("idle");
  });

  it("keeps a newer draft dirty when editing during a successful save", async () => {
    mocks.saveSceneData.mockImplementationOnce(async () => {
      useEditorStore.setState({ activeSceneSource: scene(99), activeScene: scene(99), sceneRevision: 6 });
      return { ok: true, message: "" };
    });
    expect(await persistActiveScene("/tmp/project", "Teste")).toBe(true);
    expect(useEditorStore.getState().sceneSaveState.revision).toBe(5);
    expect(localStorage.getItem(sceneDraftStorageKey("/tmp/project"))).toContain('99');
  });

  it("serializes saves and preserves the newest snapshot on disk", async () => {
    let complete!: (result: { ok: boolean; message: string }) => void;
    mocks.saveSceneData.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    mocks.saveSceneData.mockResolvedValueOnce({ ok: true, message: "" });
    const first = persistActiveScene("/tmp/project", "Teste");
    await vi.waitFor(() => expect(mocks.saveSceneData).toHaveBeenCalledTimes(1));
    useEditorStore.setState({ activeSceneSource: scene(99), activeScene: scene(99), sceneRevision: 6 });
    const second = persistActiveScene("/tmp/project", "Teste");
    expect(mocks.saveSceneData).toHaveBeenCalledTimes(1);
    complete({ ok: true, message: "" });
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(mocks.saveSceneData.mock.calls[1][1]).toContain('"x": 99');
    expect(JSON.parse(mocks.saveSceneData.mock.calls[1][4]).entities[0].transform.x).toBe(77);
    expect(useEditorStore.getState().sceneSaveState.revision).toBe(6);
  });
});
