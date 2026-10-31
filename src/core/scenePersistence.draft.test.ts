import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { clearSceneDraft, loadSceneDraft, persistActiveScene, saveActiveSceneDraft, sceneDraftDiffersFromActiveSource, sceneDraftStorageKey, restoreSceneDraft, } from "./scenePersistence";
import { useEditorStore } from "./store/editorStore";
import type { Entity, Scene } from "./ipc/sceneService";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const SCENE: Scene = {
  scene_id: "scene_draft",
  background_layers: [],
  entities: [],
  palettes: [],
};
function makeEntity(id: string): Entity {
  return { entity_id: id, prefab: id, transform: { x: 1, y: 2 }, components: {} };
}
beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  useEditorStore.setState({
    activeProjectDir: "/proj/a",
    activeScene: structuredClone(SCENE),
    activeSceneSource: structuredClone(SCENE),
    activeScenePath: "scenes/main.json",
    sceneRevision: 1,
    projectSessionId: 1,
    sceneSaveState: { status: "saved", revision: 1, at: null, message: null },
    sceneDraftState: { status: "idle", revision: null, savedAt: null, message: null },
    sceneDiskBaseline: { projectDir: "/proj/a", scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify(SCENE) },
    undoStack: [], redoStack: [],
  });
});
describe("contratos de recuperação após interrupção", () => {
  it("serializa confirmações sobrepostas sem a resposta antiga substituir a edição recente", async () => {
    let durable: string | null = null;
    let release!: () => void;
    let writes = 0;
    const key = sceneDraftStorageKey("/proj/a");
    const storage = {
      getItem: (requested: string) => requested === key ? durable : null,
      async setItem(_requested: string, value: string) {
        writes += 1;
        if (writes === 1) await new Promise<void>((resolve) => { release = resolve; });
        durable = value;
      },
      removeItem: () => { durable = null; },
    };
    const first = saveActiveSceneDraft("/proj/a", storage);
    await vi.waitFor(() => expect(writes).toBe(1));
    const changed = { ...SCENE, scene_id: "latest" };
    useEditorStore.getState().replaceScenesWithHistory(changed, changed);
    const second = saveActiveSceneDraft("/proj/a", storage);
    release();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(JSON.parse(durable!).sourceSceneJson).toContain('"scene_id":"latest"');
    expect(useEditorStore.getState().sceneDraftState.revision).toBe(useEditorStore.getState().sceneRevision);
  });

  it("desktop só confirma após o recibo nativo e migra o v2 legado sem depender do flush WebKit", async () => {
    await saveActiveSceneDraft("/proj/a");
    const key = sceneDraftStorageKey("/proj/a"), legacy = localStorage.getItem(key);
    const hostWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
    hostWindow.__TAURI_INTERNALS__ = {};
    let durable: string | null = null;
    let finish!: () => void;
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const request = args as { operation: string; value: string; expected: string | null };
      if (command !== "scene_draft_storage") throw new Error("unexpected command");
      if (request.operation === "read") return durable;
      expect(request.expected).toBe(durable);
      await new Promise<void>((resolve) => { finish = resolve; });
      durable = request.value;
      return durable;
    });
    try {
      const saving = saveActiveSceneDraft("/proj/a");
      await vi.waitFor(() => expect(useEditorStore.getState().sceneDraftState.status).toBe("pending"));
      expect(durable).toBeNull();
      expect(localStorage.getItem(key)).toBe(legacy);
      finish();
      expect(await saving).toBe(true);
      expect(durable).not.toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
      expect(useEditorStore.getState().sceneDraftState.status).toBe("confirmed");
    } finally { delete hostWindow.__TAURI_INTERNALS__; }
  });

  it("um recibo nativo atrasado não confirma a revisão do novo contexto", async () => {
    const hostWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
    hostWindow.__TAURI_INTERNALS__ = {};
    let finish!: (value: string) => void;
    let raw = "";
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const request = args as { operation: string; value: string };
      if (request.operation === "read") return raw || null;
      raw = request.value;
      return new Promise<string>((resolve) => { finish = resolve; });
    });
    try {
      const saving = saveActiveSceneDraft("/proj/a");
      await vi.waitFor(() => expect(useEditorStore.getState().sceneDraftState.status).toBe("pending"));
      useEditorStore.getState().setActiveProject("/proj/b", "B");
      finish(raw);
      expect(await saving).toBe(false);
      expect(useEditorStore.getState().sceneDraftState.status).toBe("idle");
    } finally { delete hostWindow.__TAURI_INTERNALS__; }
  });

  it("relê a confirmação da mesma revisão sem reescrever seus bytes ou horário", async () => {
    const firstTime = new Date("2026-10-27T12:00:00Z");
    expect((await saveActiveSceneDraft("/proj/a", undefined, firstTime))).toBe(true);
    const key = sceneDraftStorageKey("/proj/a"), original = localStorage.getItem(key);
    expect((await saveActiveSceneDraft("/proj/a", undefined, new Date("2026-10-27T12:01:00Z")))).toBe(true);
    expect(localStorage.getItem(key)).toBe(original);
    expect(useEditorStore.getState().sceneDraftState.savedAt).toBe(firstTime.toISOString());
    useEditorStore.setState({ sceneDiskBaseline: { projectDir: "/proj/a", scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify({ ...SCENE, scene_id: "changed_disk" }) } });
    expect((await saveActiveSceneDraft("/proj/a"))).toBe(true);
    expect(localStorage.getItem(key)).not.toBe(original);
  });
  it("mantém dois rascunhos de cenas diferentes no mesmo projeto", async () => {
    (await saveActiveSceneDraft("/proj/a"));
    useEditorStore.setState({
      activeScenePath: "scenes/boss.json",
      activeSceneSource: { ...structuredClone(SCENE), scene_id: "boss_draft" },
    });
    (await saveActiveSceneDraft("/proj/a"));
    expect((await loadSceneDraft("/proj/a", undefined, "scenes/main.json"))?.sourceSceneJson)
      .toContain('"scene_id":"scene_draft"');
    expect((await loadSceneDraft("/proj/a", undefined, "scenes/boss.json"))?.sourceSceneJson)
      .toContain('"scene_id":"boss_draft"');
  });
  it("recusa resposta de prefab de uma sessão anterior sem alterar o projeto novo", async () => {
    let complete!: (value: unknown) => void;
    vi.mocked(invoke).mockImplementation((command) => command === "get_scene_data"
      ? Promise.resolve({ ok: true, scene_json: JSON.stringify(SCENE) }) as never
      : new Promise((resolve) => { complete = resolve; }));
    const draft = { savedAt: new Date().toISOString(), scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify(SCENE), baseSourceSceneJson: JSON.stringify(SCENE) };
    const restoring = restoreSceneDraft("/proj/a", draft);
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    useEditorStore.getState().setActiveProject("/proj/b", "B");
    useEditorStore.getState().setActiveScene({ ...structuredClone(SCENE), scene_id: "new_project_edit" });
    complete({ ok: true, scene_json: draft.sourceSceneJson });
    expect(await restoring).toBe(false);
    expect(useEditorStore.getState().activeSceneSource?.scene_id).toBe("new_project_edit");
  });
  it("expõe falha de proteção quando o storage recusa a gravação", async () => {
    const storage = { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn(() => { throw new Error("quota"); }) };
    expect((await saveActiveSceneDraft("/proj/a", storage))).toBe(false);
    expect(useEditorStore.getState().sceneDraftState).toMatchObject({ status: "failed" });
  });
  it("recupera como edição pendente e uma transação de undo/redo, preservando baseline salvo", async () => {
    useEditorStore.getState().setActiveScene(structuredClone(SCENE));
    const savedRevision = useEditorStore.getState().sceneRevision;
    const source = { ...structuredClone(SCENE), scene_id: "recovered_edit" };
    const draft = { savedAt: new Date().toISOString(), scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify(source) };
    vi.mocked(invoke).mockImplementation((command) => Promise.resolve({ ok: true,
      scene_json: command === "get_scene_data" ? JSON.stringify(SCENE) : draft.sourceSceneJson }) as never);
    expect(await restoreSceneDraft("/proj/a", draft, { acceptDiskChange: true })).toBe(true);
    expect(useEditorStore.getState().sceneSaveState.revision).toBe(savedRevision);
    expect(useEditorStore.getState().sceneRevision).toBeGreaterThan(savedRevision);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().activeSceneSource?.scene_id).toBe(SCENE.scene_id);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().activeSceneSource?.scene_id).toBe("recovered_edit");
  });
});
describe("autosave de rascunho local (Experimental)", () => {
  it("salva, carrega e limpa rascunho por projeto", async () => {
    expect((await saveActiveSceneDraft("/proj/a"))).toBe(true);
    const draft = (await loadSceneDraft("/proj/a"));
    expect(draft).not.toBeNull();
    expect(draft?.scenePath).toBe("scenes/main.json");
    expect(draft && sceneDraftDiffersFromActiveSource(draft)).toBe(false);
    expect((await loadSceneDraft("/proj/b"))).toBeNull();
    (await clearSceneDraft("/proj/a"));
    expect((await loadSceneDraft("/proj/a"))).toBeNull();
  });
  it("detecta divergencia apos mutacao da cena ativa", async () => {
    (await saveActiveSceneDraft("/proj/a"));
    useEditorStore.setState({
      activeSceneSource: { ...structuredClone(SCENE), entities: [makeEntity("novo")] },
    });
    const draft = (await loadSceneDraft("/proj/a"));
    expect(draft && sceneDraftDiffersFromActiveSource(draft)).toBe(true);
  });
  it("nao salva sem projeto ou sem cena ativa", async () => {
    expect((await saveActiveSceneDraft(""))).toBe(false);
    useEditorStore.setState({ activeSceneSource: null });
    expect((await saveActiveSceneDraft("/proj/a"))).toBe(false);
  });
  it("rascunho corrompido volta como null em vez de quebrar", async () => {
    localStorage.setItem(sceneDraftStorageKey("/proj/a"), "{corrompido");
    expect((await loadSceneDraft("/proj/a"))).toBeNull();
  });
  it("persistActiveScene com sucesso limpa o rascunho (o disco e a verdade)", async () => {
    vi.mocked(invoke).mockResolvedValue({ ok: true, message: "" });
    (await saveActiveSceneDraft("/proj/a"));
    expect((await loadSceneDraft("/proj/a"))).not.toBeNull();
    await expect(persistActiveScene("/proj/a", "Teste")).resolves.toBe(true);
    expect((await loadSceneDraft("/proj/a"))).toBeNull();
  });
});
describe("isolamento, formato legado e recusas sem perda", () => {
  const legacyKey = "retrodev-scene-draft::/proj/a";
  const legacy = () => ({ savedAt: "2026-10-27T12:00:00.000Z", scenePath: "scenes/main.json", sourceSceneJson: JSON.stringify({ ...SCENE, scene_id: "legacy" }) });
  it("migra legado ligado à cena somente após confirmar a nova cópia", async () => {
    localStorage.setItem(legacyKey, JSON.stringify(legacy()));
    const loaded = (await loadSceneDraft("/proj/a"));
    expect(loaded).toMatchObject({ schemaVersion: 2, scenePath: "scenes/main.json", diskConflict: true });
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(localStorage.getItem(sceneDraftStorageKey("/proj/a"))).toContain('legacy');
  });
  it("não migra nem apresenta na cena errada um legado de outra cena", async () => {
    const raw = JSON.stringify({ ...legacy(), scenePath: "scenes/other.json" });
    localStorage.setItem(legacyKey, raw);
    expect((await loadSceneDraft("/proj/a"))).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBe(raw);
  });
  it("mantém o legado recuperável quando a migração encontra quota", async () => {
    const raw = JSON.stringify(legacy());
    const storage = { getItem: vi.fn((key: string) => key === legacyKey ? raw : null),
      setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn() };
    expect((await loadSceneDraft("/proj/a", storage))?.sourceSceneJson).toBe(legacy().sourceSceneJson);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.getItem(legacyKey)).toBe(raw);
  });
  it("preserva legado sem cena identificada até a decisão explícita", async () => {
    const raw = JSON.stringify({ ...legacy(), scenePath: null });
    localStorage.setItem(legacyKey, raw);
    expect((await loadSceneDraft("/proj/a"))).toMatchObject({ unboundLegacyScene: true, diskConflict: true });
    expect(localStorage.getItem(legacyKey)).toBe(raw);
  });
  it("não substitui rascunho anterior durante hidratação ou nova edição da sessão reaberta", async () => {
    (await saveActiveSceneDraft("/proj/a"));
    const raw = localStorage.getItem(sceneDraftStorageKey("/proj/a"));
    useEditorStore.getState().setActiveProject("/proj/a", "reopened");
    useEditorStore.getState().setActiveScene({ ...SCENE, scene_id: "new_edit" });
    expect((await saveActiveSceneDraft("/proj/a"))).toBe(false);
    expect(localStorage.getItem(sceneDraftStorageKey("/proj/a"))).toBe(raw);
    expect(useEditorStore.getState().sceneDraftState.status).toBe("recovery");
  });
  it("não confirma escrita quando a releitura retorna conteúdo diferente", async () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    expect((await saveActiveSceneDraft("/proj/a", storage))).toBe(false);
    expect(useEditorStore.getState().sceneDraftState.status).toBe("failed");
  });
  it("storage indisponível é falha visível, sem descartar a edição", async () => {
    expect((await saveActiveSceneDraft("/proj/a", null))).toBe(false);
    expect(useEditorStore.getState().sceneDraftState.message).toContain("indisponível");
    expect(useEditorStore.getState().activeSceneSource).toEqual(SCENE);
  });
  it("um descarte atrasado não remove a confirmação mais recente", async () => {
    (await saveActiveSceneDraft("/proj/a"));
    const key = sceneDraftStorageKey("/proj/a");
    const first = localStorage.getItem(key)!;
    useEditorStore.getState().replaceScenesWithHistory({ ...SCENE, scene_id: "latest" }, { ...SCENE, scene_id: "latest" });
    (await saveActiveSceneDraft("/proj/a"));
    const latest = localStorage.getItem(key);
    expect((await clearSceneDraft("/proj/a", undefined, "scenes/main.json", { key, raw: first }))).toBe(false);
    expect(localStorage.getItem(key)).toBe(latest);
  });
  it.each(["{broken", ""])("mantém conteúdo inválido inspecionável e não o troca silenciosamente: %j", async (raw) => {
    const key = sceneDraftStorageKey("/proj/a");
    localStorage.setItem(key, raw);
    expect((await loadSceneDraft("/proj/a"))).toBeNull();
    expect(useEditorStore.getState().sceneDraftState).toMatchObject({ status: "invalid", raw });
    expect((await saveActiveSceneDraft("/proj/a"))).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it("recusa formato futuro e identidade adulterada sem remover os bytes", async () => {
    (await saveActiveSceneDraft("/proj/a"));
    const key = sceneDraftStorageKey("/proj/a");
    const record = JSON.parse(localStorage.getItem(key)!);
    for (const changed of [{ ...record, schemaVersion: 99 }, { ...record, scenePath: "scenes/other.json" }, { ...record, revision: -1 }]) {
      const raw = JSON.stringify(changed);
      localStorage.setItem(key, raw);
      expect((await loadSceneDraft("/proj/a"))).toBeNull();
      expect(localStorage.getItem(key)).toBe(raw);
    }
  });
  it("uma gravação válida em disco não se torna falha por rascunho corrompido na limpeza", async () => {
    const key = sceneDraftStorageKey("/proj/a");
    localStorage.setItem(key, "{broken");
    vi.mocked(invoke).mockResolvedValue({ ok: true, message: "saved" });
    expect(await persistActiveScene("/proj/a", "save")).toBe(true);
    expect(useEditorStore.getState().sceneSaveState.status).toBe("saved");
    expect(localStorage.getItem(key)).toBe("{broken");
  });
});
