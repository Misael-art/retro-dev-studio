import {
  getSceneData,
  parseScene,
  parseSceneJson,
  resolveScenePrefabs,
  saveSceneData,
  sceneDraftStorage,
  type Scene,
  type SceneDataResult,
} from "./ipc/sceneService";
import { sceneSourcesEqual, useEditorStore } from "./store/editorStore";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface HydratedScenePair {
  sourceScene: Scene;
  resolvedScene: Scene;
}

export async function hydrateSceneResult(
  projectDir: string,
  sceneData: SceneDataResult
): Promise<HydratedScenePair | null> {
  const sourceScene = parseScene(sceneData);
  if (!sourceScene) {
    return null;
  }

  const resolvedResult = await resolveScenePrefabs(projectDir, sourceScene);
  if (!resolvedResult.ok) {
    throw new Error(resolvedResult.error || "Falha ao resolver prefabs da cena.");
  }

  const resolvedScene = parseSceneJson(resolvedResult.scene_json);
  if (!resolvedScene) {
    throw new Error("Falha ao reconstruir a cena resolvida.");
  }

  return {
    sourceScene,
    resolvedScene,
  };
}

export async function reloadSceneFromDisk(projectDir: string, scope: string): Promise<boolean> {
  const started = useEditorStore.getState();
  const stillCurrent = () => {
    const state = useEditorStore.getState();
    return state.activeProjectDir === projectDir && state.projectSessionId === started.projectSessionId
      && state.activeScenePath === started.activeScenePath && state.sceneRevision === started.sceneRevision;
  };
  if (started.activeProjectDir !== projectDir) return false;
  const {
    activeScenePath,
    logMessage,
    selectedEntityId,
    setActiveScene,
    setActiveScenePath,
    setSelectedEntityId,
  } = useEditorStore.getState();

  try {
    const sceneData = await getSceneData(projectDir, activeScenePath || undefined);
    if (!stillCurrent()) return false;
    if (!sceneData.ok) {
      logMessage("error", `[${scope}] Falha ao recarregar cena: ${sceneData.error}`);
      return false;
    }

    const hydrated = await hydrateSceneResult(projectDir, sceneData);
    if (!stillCurrent()) return false;
    if (!hydrated) {
      logMessage("error", `[${scope}] Falha ao reidratar a cena salva.`);
      return false;
    }

    setActiveScenePath(sceneData.scene_path);
    setActiveScene(hydrated.resolvedScene, hydrated.sourceScene);
    if (selectedEntityId) {
      const isLayerSelection = selectedEntityId.startsWith("layer::");
      const selectionStillExists = isLayerSelection
        ? hydrated.resolvedScene.background_layers.some(
            (layer) => `layer::${layer.layer_id}` === selectedEntityId
          )
        : hydrated.resolvedScene.entities.some(
            (entity) => entity.entity_id === selectedEntityId
          );

      if (!selectionStillExists) {
        setSelectedEntityId(null);
      }
    }
    return true;
  } catch (error) {
    if (!stillCurrent()) return false;
    logMessage("error", `[${scope}] ${describeError(error)}`);
    return false;
  }
}

/**
 * Debounced editors (e.g. the NodeGraph) register how to commit their pending edit to the
 * store. Saving flushes them first so a save never misses the edit made just before it.
 */
const pendingEditFlushers = new Set<() => void>();

export function registerPendingEditFlusher(flush: () => void): () => void {
  pendingEditFlushers.add(flush);
  return () => {
    pendingEditFlushers.delete(flush);
  };
}

export function flushPendingEdits(): void {
  for (const flush of [...pendingEditFlushers]) flush();
}

// Preserve write order when Save and Build are requested in quick succession.
let sceneSaveQueue: Promise<unknown> = Promise.resolve();
let sceneSaveRequest = 0;
const SCENE_DRAFT_STORAGE_PREFIX = "retrodev-scene-draft";
const DRAFT_EDITOR_SESSION = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const SCENE_DRAFT_DELAY_MS = 2000;

type MaybeAsync<T> = T | Promise<T>;
interface DraftStorage {
  getItem(key: string): MaybeAsync<string | null>;
  setItem(key: string, value: string): MaybeAsync<void>;
  removeItem(key: string): MaybeAsync<void>;
  confirmed?(): boolean;
}

function defaultDraftStorage(projectDir: string, scenePath: string): DraftStorage | null {
  let browser: Storage | null = null;
  try { browser = typeof localStorage === "undefined" ? null : localStorage; } catch { /* Native drafts do not depend on WebKit flushes. */ }
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return browser;
  const key = sceneDraftStorageKey(projectDir, scenePath);
  let nativeRead: string | null = null;
  let legacyRead: string | null = null;
  return {
    confirmed: () => nativeRead !== null,
    async getItem(requested) {
      if (requested !== key) return browser?.getItem(requested) ?? null;
      nativeRead = await sceneDraftStorage(projectDir, scenePath, "read");
      if (nativeRead !== null) return nativeRead;
      legacyRead = browser?.getItem(key) ?? null;
      return legacyRead;
    },
    async setItem(requested, raw) {
      if (requested !== key) { browser?.setItem(requested, raw); return; }
      await sceneDraftStorage(projectDir, scenePath, "write", raw, nativeRead);
      nativeRead = raw;
      // A legacy v2 browser copy is removed only after its durable successor.
      try { if (legacyRead !== null && browser?.getItem(key) === legacyRead) browser.removeItem(key); } catch { /* Preserve legacy on cleanup failure. */ }
    },
    async removeItem(requested) {
      if (requested !== key) { browser?.removeItem(requested); return; }
      await sceneDraftStorage(projectDir, scenePath, "remove", null, nativeRead);
      nativeRead = null;
      if (legacyRead !== null && browser?.getItem(key) === legacyRead) browser.removeItem(key);
    },
  };
}

function draftScene(json: string): Scene | null {
  const scene = parseSceneJson(json);
  return scene && typeof scene.scene_id === "string" && Array.isArray(scene.entities)
    && Array.isArray(scene.background_layers) && Array.isArray(scene.palettes) ? scene : null;
}

function activeDraftContext(projectDir: string, scenePath: string): boolean {
  const state = useEditorStore.getState();
  return state.activeProjectDir === projectDir && state.activeScenePath === scenePath;
}

export interface SceneDraftRecord {
  savedAt: string;
  scenePath: string | null;
  sourceSceneJson: string;
  schemaVersion?: 2;
  projectDir?: string;
  revision?: number;
  baseSourceSceneJson?: string | null;
  editorSessionId?: string;
  /** Read receipt, not serialized into the next draft. Used for conditional removal. */
  storageKey?: string;
  storageValue?: string;
  detectedSessionId?: number;
  diskConflict?: boolean;
  unboundLegacyScene?: boolean;
}

export function sceneDraftStorageKey(projectDir: string, scenePath = useEditorStore.getState().activeScenePath): string {
  return `${SCENE_DRAFT_STORAGE_PREFIX}::v2::${encodeURIComponent(projectDir)}::${encodeURIComponent(scenePath)}`;
}

function legacyDraftStorageKey(projectDir: string): string {
  return `${SCENE_DRAFT_STORAGE_PREFIX}::${projectDir}`;
}

function decodeDraft(raw: string, projectDir: string, scenePath: string): SceneDraftRecord {
  let draft: SceneDraftRecord;
  try { draft = JSON.parse(raw) as SceneDraftRecord; }
  catch { throw new Error("Conteúdo do rascunho inválido. A cópia original foi preservada."); }
  if (!draft || typeof draft.sourceSceneJson !== "string" || typeof draft.savedAt !== "string"
      || !Number.isFinite(Date.parse(draft.savedAt)) || !draftScene(draft.sourceSceneJson)) {
    throw new Error("Conteúdo do rascunho inválido. A cópia original foi preservada.");
  }
  if (draft.schemaVersion !== undefined && draft.schemaVersion !== 2) {
    throw new Error("Versão de rascunho não suportada. A cópia original foi preservada.");
  }
  if (draft.schemaVersion === 2 && (draft.projectDir !== projectDir || draft.scenePath !== scenePath
      || !Number.isSafeInteger(draft.revision) || (draft.revision ?? -1) < 0)) {
    throw new Error("Identidade ou revisão do rascunho inválida. A cópia original foi preservada.");
  }
  return draft;
}

export async function loadSceneDraft(
  projectDir: string,
  storage: DraftStorage | null | undefined = undefined,
  scenePath = useEditorStore.getState().activeScenePath
): Promise<SceneDraftRecord | null> {
  storage = storage === undefined ? defaultDraftStorage(projectDir, scenePath) : storage;
  const state = useEditorStore.getState();
  const current = () => activeDraftContext(projectDir, scenePath) && useEditorStore.getState().projectSessionId === state.projectSessionId && useEditorStore.getState().sceneRevision === state.sceneRevision;
  let raw: string | null = null;
  try {
    if (!storage) throw new Error("Armazenamento local indisponível. Use Salvar para proteger o trabalho no arquivo.");
    let key = sceneDraftStorageKey(projectDir, scenePath);
    raw = await storage.getItem(key);
    if (raw === null) {
      key = legacyDraftStorageKey(projectDir);
      raw = await storage.getItem(key);
      if (raw === null) return null;
    }
    let draft = decodeDraft(raw, projectDir, scenePath);
    if (draft.schemaVersion !== 2 && draft.scenePath && draft.scenePath !== scenePath) return null;
    const unboundLegacyScene = !draft.scenePath;
    // Migrate a bound legacy record only after readback; never delete its only copy.
    if (draft.schemaVersion !== 2 && !unboundLegacyScene) {
      const migrated = JSON.stringify({ schemaVersion: 2, projectDir, scenePath, revision: 0,
        savedAt: draft.savedAt, sourceSceneJson: draft.sourceSceneJson, baseSourceSceneJson: null });
      const nextKey = sceneDraftStorageKey(projectDir, scenePath);
      try {
        await storage.setItem(nextKey, migrated);
        if (await storage.getItem(nextKey) !== migrated) throw new Error("A migração do rascunho não foi confirmada.");
        if (await storage.getItem(key) === raw) await storage.removeItem(key);
        key = nextKey; raw = migrated; draft = decodeDraft(raw, projectDir, scenePath);
      } catch {
        // The original remains recoverable. The next explicit recovery/save can retry.
      }
    }
    const diskJson = state.sceneDraftState.diskSourceJson ?? state.sceneDiskBaseline?.sourceSceneJson;
    const diskConflict = !draft.baseSourceSceneJson || !diskJson || !sceneSourcesEqual(draft.baseSourceSceneJson, diskJson);
    const result = { ...draft, projectDir, scenePath, storageKey: key, storageValue: raw,
      detectedSessionId: current() ? state.projectSessionId : undefined, diskConflict, unboundLegacyScene };
    if (current() && state.sceneDraftState.status !== "conflict" && sceneDraftDiffersFromActiveSource(result)) {
      state.setSceneDraftState({ status: "recovery", revision: draft.revision ?? null, savedAt: draft.savedAt,
        message: "Rascunho anterior preservado. Recupere-o ou salve a edição atual; novas mudanças ainda ficam só no editor." });
    } else if (current() && ["failed", "invalid"].includes(state.sceneDraftState.status)
        && !sceneDraftDiffersFromActiveSource(result)) {
      state.setSceneDraftState({ status: "idle", revision: null, savedAt: null, message: null });
    }
    return result;
  } catch (error) {
    if (current()) state.setSceneDraftState({ status: raw !== null ? "invalid" : "failed", revision: null, savedAt: null,
      message: describeError(error), raw: raw ?? undefined });
    return null;
  }
}

let draftWriteQueue: Promise<unknown> = Promise.resolve();

export function saveActiveSceneDraft(
  projectDir: string,
  storage: DraftStorage | null | undefined = undefined,
  now: Date = new Date()
): Promise<boolean> {
  const snapshot = useEditorStore.getState();
  const operation = draftWriteQueue.then(() => {
    const current = useEditorStore.getState();
    if (current.projectSessionId !== snapshot.projectSessionId || current.activeProjectDir !== projectDir
        || current.activeScenePath !== snapshot.activeScenePath || current.sceneRevision !== snapshot.sceneRevision) return false;
    return saveActiveSceneDraftNow(projectDir, storage, now);
  });
  draftWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function saveActiveSceneDraftNow(
  projectDir: string,
  storage: DraftStorage | null | undefined = undefined,
  now: Date = new Date()
): Promise<boolean> {
  const state = useEditorStore.getState();
  const { activeSceneSource, activeScenePath } = state;
  if (!projectDir || projectDir !== state.activeProjectDir || !activeSceneSource || !activeScenePath) return false;
  const current = () => activeDraftContext(projectDir, activeScenePath)
    && useEditorStore.getState().projectSessionId === state.projectSessionId
    && useEditorStore.getState().sceneRevision === state.sceneRevision;
  storage = storage === undefined ? defaultDraftStorage(projectDir, activeScenePath) : storage;
  try {
    if (!storage) throw new Error("Armazenamento local indisponível. Use Salvar para proteger o trabalho no arquivo.");
    const key = sceneDraftStorageKey(projectDir, activeScenePath);
    const sourceJson = JSON.stringify(activeSceneSource);
    const existingRaw = await storage.getItem(key);
    if (!current()) return false;
    if (existingRaw !== null) {
      const existing = decodeDraft(existingRaw, projectDir, activeScenePath);
      const owned = existing.editorSessionId === `${DRAFT_EDITOR_SESSION}/${state.projectSessionId}`;
      if (!owned && !sceneSourcesEqual(existing.sourceSceneJson, sourceJson)) {
        state.setSceneDraftState({ status: "recovery", revision: existing.revision ?? null, savedAt: existing.savedAt,
          message: "Rascunho anterior preservado; novas mudanças estão só no editor. Recupere o rascunho ou use Salvar." });
        return false;
      }
      const baseline = state.sceneDiskBaseline;
      if (owned && storage.confirmed?.() !== false && existing.revision === state.sceneRevision
          && sceneSourcesEqual(existing.sourceSceneJson, sourceJson)
          && baseline?.projectDir === projectDir && baseline.scenePath === activeScenePath
          && existing.baseSourceSceneJson && sceneSourcesEqual(existing.baseSourceSceneJson, baseline.sourceSceneJson)) {
        state.setSceneDraftState({ status: "confirmed", revision: state.sceneRevision, savedAt: existing.savedAt, message: null });
        return true;
      }
    } else {
      const legacy = await storage.getItem(legacyDraftStorageKey(projectDir));
      if (!current()) return false;
      if (legacy !== null) {
        const record = decodeDraft(legacy, projectDir, activeScenePath);
        if ((!record.scenePath || record.scenePath === activeScenePath) && !sceneSourcesEqual(record.sourceSceneJson, sourceJson)) {
          state.setSceneDraftState({ status: "recovery", revision: null, savedAt: record.savedAt, message: "Rascunho antigo preservado. Decida sobre sua recuperação antes de substituí-lo." });
          return false;
        }
      }
    }
    const raw = JSON.stringify({ schemaVersion: 2, projectDir, scenePath: activeScenePath,
      revision: state.sceneRevision, savedAt: now.toISOString(), sourceSceneJson: sourceJson,
      baseSourceSceneJson: state.sceneDiskBaseline?.projectDir === projectDir && state.sceneDiskBaseline.scenePath === activeScenePath
        ? state.sceneDiskBaseline.sourceSceneJson : null,
      editorSessionId: `${DRAFT_EDITOR_SESSION}/${state.projectSessionId}` });
    if (!current()) return false;
    state.setSceneDraftState({ status: "pending", revision: state.sceneRevision, savedAt: null, message: null });
    await storage.setItem(key, raw);
    if (await storage.getItem(key) !== raw) throw new Error("A leitura de confirmação do rascunho falhou.");
    if (!current()) return false;
    const legacyKey = legacyDraftStorageKey(projectDir);
    const legacyRaw = await storage.getItem(legacyKey);
    if (legacyRaw !== null) {
      try {
        const legacy = decodeDraft(legacyRaw, projectDir, activeScenePath);
        if ((!legacy.scenePath || legacy.scenePath === activeScenePath)
            && sceneSourcesEqual(legacy.sourceSceneJson, sourceJson) && await storage.getItem(legacyKey) === legacyRaw) {
          await storage.removeItem(legacyKey);
        }
      } catch { /* New copy is confirmed; an unreadable legacy copy stays preserved. */ }
    }
    if (!current()) return false;
    state.setSceneDraftState({ status: "confirmed", revision: state.sceneRevision, savedAt: now.toISOString(), message: null });
    return true;
  } catch (error) {
    if (current()) state.setSceneDraftState({ status: "failed", revision: null, savedAt: null,
      message: `Rascunho não confirmado: ${describeError(error)}. As alterações continuam no editor; tente novamente ou use Salvar.`,
      raw: undefined });
    return false;
  }
}

export async function clearSceneDraft(
  projectDir: string,
  storage: DraftStorage | null | undefined = undefined,
  scenePath = useEditorStore.getState().activeScenePath,
  expected?: { key?: string; raw?: string }
): Promise<boolean> {
  storage = storage === undefined ? defaultDraftStorage(projectDir, scenePath) : storage;
  try {
    if (!storage) throw new Error("Armazenamento local indisponível.");
    const key = expected?.key ?? sceneDraftStorageKey(projectDir, scenePath);
    if (key !== sceneDraftStorageKey(projectDir, scenePath) && key !== legacyDraftStorageKey(projectDir)) return false;
    const raw = await storage.getItem(key);
    if (expected?.raw !== undefined && raw !== expected.raw) return false;
    if (key === legacyDraftStorageKey(projectDir) && raw !== null) {
      const record = decodeDraft(raw, projectDir, scenePath);
      if (record.scenePath && record.scenePath !== scenePath) return false;
    }
    await storage.removeItem(key);
    if (await storage.getItem(key) !== null) throw new Error("A remoção do rascunho não foi confirmada.");
    return true;
  } catch (error) {
    if (activeDraftContext(projectDir, scenePath)) useEditorStore.getState().setSceneDraftState({
      status: "failed", revision: null, savedAt: null, message: `Rascunho preservado: ${describeError(error)}. Tente novamente.` });
    return false;
  }
}

export function sceneDraftDiffersFromActiveSource(draft: SceneDraftRecord): boolean {
  const source = useEditorStore.getState().activeSceneSource;
  return !source || !sceneSourcesEqual(draft.sourceSceneJson, JSON.stringify(source));
}

export async function persistActiveScene(projectDir: string, scope: string, successMessage?: string, options: { onlyIfChanged?: boolean } = {}): Promise<boolean> {
  flushPendingEdits();
  const state = useEditorStore.getState();
  const { activeScene, activeSceneSource, activeScenePath, sceneRevision, projectSessionId, logMessage } = state;
  if (projectDir !== state.activeProjectDir) return false;
  if (!activeSceneSource || !activeScene) return true;
  // Navigation must not serialize load-time compatibility/migration into the
  // file. Pending input is flushed above; real edits still take the same writer.
  const baseline = state.sceneDiskBaseline;
  if (options.onlyIfChanged && state.sceneSaveState.status === "saved"
      && state.sceneSaveState.revision === sceneRevision && state.sceneDraftState.status !== "conflict"
      && baseline?.projectDir === projectDir && baseline.scenePath === activeScenePath
      && sceneSourcesEqual(JSON.stringify(activeSceneSource), baseline.sourceSceneJson)) return true;
  const request = ++sceneSaveRequest;
  const sameContext = () => {
    const current = useEditorStore.getState();
    return current.projectSessionId === projectSessionId && current.activeProjectDir === projectDir
      && current.activeScenePath === activeScenePath;
  };
  const stillCurrent = () => sameContext() && request === sceneSaveRequest;
  const storage = defaultDraftStorage(projectDir, activeScenePath);
  const key = sceneDraftStorageKey(projectDir, activeScenePath);
  state.setSceneSaveState({ status: "saving", message: null, at: Date.now(), revision: null });
  let draftBeforeSave: string | null = null;
  try { draftBeforeSave = (await storage?.getItem(key)) ?? null; } catch { /* save can still protect the file */ }
  if (!stillCurrent()) return false;
  const sourceJson = JSON.stringify(activeSceneSource, null, 2);
  const resolvedJson = JSON.stringify(activeScene, null, 2);
  let failure: string;
  let conflictDiskJson: string | undefined;
  try {
    const operation = sceneSaveQueue.then<Awaited<ReturnType<typeof saveSceneData>>>(async () => {
      if (!stillCurrent()) return { ok: false, message: "Sessão de salvamento substituída." };
      // Resolve the comparison base when this queued write starts. A preceding
      // in-flight write may have saved successfully while a newer edit arrived.
      const baseline = useEditorStore.getState().sceneDiskBaseline;
      const expectedJson = baseline?.projectDir === projectDir && baseline.scenePath === activeScenePath ? baseline.sourceSceneJson : undefined;
      const result = await saveSceneData(projectDir, sourceJson, activeScenePath || undefined, resolvedJson, expectedJson);
      if (result.ok && sameContext()) {
        const savedJson = result.scene_json && draftScene(result.scene_json) ? result.scene_json : sourceJson;
        useEditorStore.setState({ sceneDiskBaseline: { projectDir, scenePath: activeScenePath, sourceSceneJson: savedJson } });
      }
      return result;
    });
    sceneSaveQueue = operation.catch(() => undefined);
    const result = await operation;
    if (!stillCurrent()) return false;
    if (result.ok) {
      const current = useEditorStore.getState();
      if (current.sceneRevision !== sceneRevision) await saveActiveSceneDraft(projectDir);
      else if (draftBeforeSave !== null && storage) {
        try {
          const draft = decodeDraft(draftBeforeSave, projectDir, activeScenePath);
          if (sceneSourcesEqual(draft.sourceSceneJson, sourceJson)
              || (draft.editorSessionId === `${DRAFT_EDITOR_SESSION}/${projectSessionId}` && (draft.revision ?? Infinity) <= sceneRevision)) {
            if (await clearSceneDraft(projectDir, storage, activeScenePath, { key, raw: draftBeforeSave })) {
              current.setSceneDraftState({ status: "idle", revision: null, savedAt: null, message: null });
            }
          }
        } catch (error) {
          current.setSceneDraftState({ status: "invalid", revision: null, savedAt: null,
            message: `Arquivo salvo; rascunho inválido preservado: ${describeError(error)}`, raw: draftBeforeSave });
        }
      }
      if (!stillCurrent()) return false;
      current.setSceneSaveState({ status: "saved", message: null, at: Date.now(), revision: sceneRevision });
      if (successMessage) logMessage("success", `[${scope}] ${successMessage}`);
      return true;
    }
    failure = result.message;
    if (result.conflict) conflictDiskJson = result.scene_json ?? undefined;
  } catch (error) { failure = describeError(error); }
  if (!stillCurrent()) return false;
  const confirmed = await saveActiveSceneDraft(projectDir);
  if (!stillCurrent()) return false;
  const current = useEditorStore.getState();
  if (conflictDiskJson) current.setSceneDraftState({ status: "conflict", revision: current.sceneRevision,
    savedAt: current.sceneDraftState.savedAt, message: "O arquivo salvo mudou. O rascunho foi mantido; revise a divergência antes de salvar.", diskSourceJson: conflictDiskJson });
  current.setSceneSaveState({ status: "failed", message: failure, at: Date.now(), revision: null });
  logMessage("error", `[${scope}] Falha ao salvar: ${failure}. Alterações no editor; ${confirmed ? "rascunho local confirmado" : "rascunho não confirmado — mantenha esta janela aberta e tente novamente"}.`);
  return false;
}

/** Apply only in memory, as one undoable edit. The caller explicitly acknowledges any disk divergence. */
export async function restoreSceneDraft(
  projectDir: string, draft: SceneDraftRecord, options: { acceptDiskChange?: boolean } = {}
): Promise<boolean> {
  const state = useEditorStore.getState();
  const { projectSessionId, activeScenePath, sceneRevision } = state;
  const stillCurrent = () => {
    const current = useEditorStore.getState();
    return current.activeProjectDir === projectDir && current.projectSessionId === projectSessionId
      && current.activeScenePath === activeScenePath && current.sceneRevision === sceneRevision;
  };
  if (state.activeProjectDir !== projectDir || draft.scenePath !== activeScenePath
      || (draft.projectDir !== undefined && draft.projectDir !== projectDir)
      || (draft.detectedSessionId !== undefined && draft.detectedSessionId !== projectSessionId)) return false;
  const source = draftScene(draft.sourceSceneJson);
  if (!source) {
    state.setSceneDraftState({ status: "invalid", revision: null, savedAt: draft.savedAt, message: "Rascunho inválido preservado; nada foi restaurado.", raw: draft.storageValue });
    return false;
  }
  try {
    const disk = await getSceneData(projectDir, activeScenePath);
    if (!stillCurrent()) return false;
    const diskScene = disk.ok ? parseScene(disk) : null;
    if (!diskScene) throw new Error(disk.error || "Não foi possível conferir o arquivo salvo; rascunho preservado.");
    const diskJson = JSON.stringify(diskScene);
    const lastObservedDisk = state.sceneDraftState.diskSourceJson ?? state.sceneDiskBaseline?.sourceSceneJson;
    const diskChangedSincePrompt = lastObservedDisk && !sceneSourcesEqual(lastObservedDisk, diskJson);
    const divergent = !draft.baseSourceSceneJson || !sceneSourcesEqual(draft.baseSourceSceneJson, diskJson);
    if (diskChangedSincePrompt || (divergent && !options.acceptDiskChange)) {
      state.setSceneDraftState({ status: "conflict", revision: draft.revision ?? null, savedAt: draft.savedAt,
        message: "O arquivo salvo difere da base do rascunho (ou a base antiga é desconhecida). Escolha explicitamente qual conteúdo abrir; nada foi gravado.", diskSourceJson: diskJson });
      return false;
    }
    const resolvedResult = await resolveScenePrefabs(projectDir, source);
    if (!stillCurrent()) return false;
    if (!resolvedResult.ok) throw new Error(resolvedResult.error || "Falha ao resolver prefabs do rascunho.");
    const resolved = draftScene(resolvedResult.scene_json);
    if (!resolved) throw new Error("Falha ao reconstruir rascunho; cópia preservada.");
    const storage = defaultDraftStorage(projectDir, activeScenePath);
    if (draft.storageKey && draft.storageValue && (await storage?.getItem(draft.storageKey)) !== draft.storageValue) {
      throw new Error("O rascunho mudou durante a recuperação. Leia novamente; nenhuma edição foi substituída.");
    }
    if (!stillCurrent()) return false;
    useEditorStore.setState({ sceneDiskBaseline: { projectDir, scenePath: activeScenePath, sourceSceneJson: diskJson } });
    if (diskChangedSincePrompt || !state.sceneDiskBaseline || !sceneSourcesEqual(state.sceneDiskBaseline.sourceSceneJson, diskJson)) {
      state.setSceneSaveState({ status: "idle", revision: null, at: null, message: null });
    }
    state.replaceScenesWithHistory(resolved, source);
    const revision = useEditorStore.getState().sceneRevision;
    state.setSceneDraftState({ status: "pending", revision, savedAt: draft.savedAt, message: null });
    await saveActiveSceneDraft(projectDir);
    state.logMessage("success", "[Recuperação] Rascunho aberto como edição pendente. O arquivo salvo só muda ao usar Salvar.");
    return true;
  } catch (error) {
    if (stillCurrent()) state.setSceneDraftState({ status: "failed", revision: null, savedAt: draft.savedAt,
      message: `Rascunho preservado: ${describeError(error)}. Tente novamente.`, raw: draft.storageValue });
    return false;
  }
}
