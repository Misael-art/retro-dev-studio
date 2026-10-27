import { create } from "zustand";

import {
  diagnosticConsoleMessage,
  type ActionableDiagnostic,
} from "../diagnostics";
import type {
  BackgroundLayer,
  CollisionMap,
  Entity,
  LegacySgdkIndex,
  PaletteEntry,
  Scene,
  SceneLayer,
} from "../ipc/sceneService";
import type { BuildSourceMap } from "../nodegraph/buildProvenance";
import type { RuntimeLink } from "../runtimeLink";
import type { TestAdjustment } from "../testAdjustments";
import type { RexBridgeRequest } from "../rexBridge";
import type {
  CrossCoreReport,
  CycleReport,
  ParityReport,
} from "../projectCapability";
import {
  STUDIO_TASK_WORKSPACE,
  initialStudioContext,
  loadStudioContext,
  navigateStudio,
  refineStudioFocus as refineStudioFocusState,
  rememberWorkspaceCamera as rememberWorkspaceCameraState,
  returnStudioOrigin,
  saveStudioContext,
  type StudioContextState,
  type StudioFocus,
  type StudioNavigation,
  type StudioReturnResult,
  type WorkspaceCamera,
  workspaceToStudioTask,
} from "../studioContext";

export const UNDO_STACK_LIMIT = 50;

/** Semantic source equality for disk baselines and draft recovery; array order is significant. */
export function sceneSourcesEqual(left: string, right: string): boolean {
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])
    );
    return value;
  };
  try { return JSON.stringify(ordered(JSON.parse(left))) === JSON.stringify(ordered(JSON.parse(right))); }
  catch { return false; }
}

export type SceneSaveState = {
  status: "idle" | "saving" | "saved" | "failed";
  message: string | null;
  at: number | null;
  /** sceneRevision that the last successful save persisted. */
  revision: number | null;
};

export type SceneDraftState = {
  status: "idle" | "pending" | "confirmed" | "failed" | "invalid" | "recovery" | "conflict";
  revision: number | null;
  savedAt: string | null;
  message: string | null;
  /** Raw storage is retained for inspection when decoding fails. */
  raw?: string;
  diskSourceJson?: string;
};

const EMPTY_SCENE_DRAFT_STATE: SceneDraftState = {
  status: "idle", revision: null, savedAt: null, message: null,
};

export type SceneDiskBaseline = {
  projectDir: string;
  scenePath: string;
  sourceSceneJson: string;
};

export interface HwStatus {
  vram_used: number;
  vram_limit: number;
  analysis_mode?: "native_static" | "sgdk_managed" | string;
  project_asset_bytes?: number;
  resident_vram_bytes?: number;
  streamable_vram_bytes?: number;
  dma_frame_bytes?: number;
  /** Mega Drive residency audit (bytes); SNES envia zeros. */
  sprite_resident_bytes?: number;
  tilemap_resident_bytes?: number;
  hud_resident_bytes?: number;
  streamable_sprite_bytes?: number;
  animated_swap_bytes?: number;
  managed_concurrent_sprite_banks?: number;
  managed_sprite_cells_used?: number;
  managed_sprite_banks_limit?: number;
  managed_sprite_cells_budget?: number;
  sprite_count: number;
  sprite_limit: number;
  scanline_sprite_peak: number;
  scanline_sprite_limit: number;
  dma_used: number;
  dma_limit: number;
  palette_banks_used: number;
  palette_banks_limit: number;
  bg_layers: number;
  bg_layers_limit: number;
  errors: string[];
  warnings: string[];
}

export type HwValidationState = "idle" | "pending" | "fresh" | "stale" | "error";

export interface ConsoleEntry {
  id: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
  timestamp: string;
  diagnostic?: ActionableDiagnostic;
}

export interface Tab {
  id: string;
  label: string;
  panel: "hierarchy" | "inspector" | "viewport" | "console";
}

export interface UndoEntry {
  activeScene: Scene | null;
  activeSceneSource: Scene | null;
  selectedEntityId: string | null;
  editorMode: EditorMode;
  /** Foco rico do Studio no momento da entrada (animação/ocorrência/caixa/evento). */
  studioFocus?: StudioFocus;
}

export type EditorMode = "select" | "paint" | "erase" | "collision";
export type TilePaintTool = "pencil" | "eraser" | "picker" | "rect" | "fill" | "stamp";

export interface TileStampPattern {
  width: number;
  height: number;
  cells: number[];
}
export type EditorWorkspace =
  | "explorer"
  | "scene"
  | "game"
  | "logic"
  | "retrofx"
  | "artstudio"
  | "debug";

export interface ActiveBrush {
  kind: "prefab" | "tile";
  id: string; // prefab filename or tile id
  assetPath?: string;
  /** Índice do tile no tileset quando `kind === "tile"`. 0 = vazio. */
  tileIndex?: number;
}

/** Observação de joypad correlacionada por sessão de emulação + sequência
 * monotônica, para que uma confirmação atrasada — da mesma carga ou de uma
 * carga anterior — não seja confundida com a da transição corrente.
 *
 * A sessão é gerada no frontend, não pelo backend, e isso é suficiente: o par
 * (sessão, seq) é capturado no fechamento do envio e reconferido na resolução,
 * de modo que um ack que atravesse um stop/recarga carrega a sessão antiga e é
 * descartado. Um eco do backend não acrescentaria garantia — quem define a
 * época da carga é o próprio frontend. */
export interface JoypadObservation {
  sessionId: string;
  seq: number;
  joypad: Record<string, boolean>;
}

/**
 * Uma transição de joypad solicitada pelo caminho de teclado do produto, com o desfecho no backend.
 * `accepted` = o backend a aplicou (com geração e quadro); NÃO diz que o core a leu.
 */
export interface JoypadTransition extends JoypadObservation {
  outcome: "requested" | "accepted" | "refused";
  /** Época do core que aceitou. */
  epoch: number | null;
  /** Geração no backend (ordem de aplicação na carga). */
  generation: number | null;
  /** Quadros emulados concluídos quando foi aplicada. */
  appliedAtFrame: number | null;
  message: string | null;
}

/** Quantas transições o registro guarda. */
export const JOYPAD_LOG_CAPACITY = 64;

export interface EmulatorRomIdentity {
  path: string;
  size: number;
  sha256: string;
  coreLabel: string;
  corePath: string;
  sourceLabel: string;
}

export interface EmulatorLaunchRequest {
  requestId: number;
  romPath: string;
  sourceLabel: string;
}

/** Um quadro real da ROM do build foi apresentado. Stop preserva o recibo;
 * trocar de projeto o descarta. Não equivale a aceite de gameplay ou usabilidade. */
export interface BuildTestReceipt {
  projectDir: string;
  sceneRevision: number;
  romSha256: string;
  coreEpoch: number;
  sessionId: string;
  testedAt: number;
}

let joypadSessionCounter = 0;
let emulatorLaunchRequestCounter = 0;

export interface StoreState {
  activeProjectDir: string;
  /** Invalida respostas assíncronas inclusive ao reabrir o mesmo caminho. */
  projectSessionId: number;
  activeProjectName: string;
  activeTarget: "megadrive" | "snes";
  activeScenePath: string;
  emulatorLoaded: boolean;
  /** Identidade observada da ROM realmente carregada no core canônico. */
  emulatorRomIdentity: EmulatorRomIdentity | null;
  /** Solicitação de carga originada por outra superfície do produto. O App
   * consome-a usando o mesmo loadRomIntoEmulator do fluxo existente. */
  emulatorLaunchRequest: EmulatorLaunchRequest | null;
  /** Última INTENÇÃO de joypad formada pelo caminho de teclado do produto,
   * registrada antes do IPC. Prova que o handler rodou — NÃO prova entrega.
   * null = nada solicitado desde a abertura. */
  lastJoypadRequest: JoypadObservation | null;
  /** true durante carga/stop do emulador: a época está invalidada e envios de
   * input são bloqueados (contados) até a nova sessão existir. */
  joypadSessionHold: boolean;
  joypadBlockedCount: number;
  /** Época do core no backend: inputs são enviados com este valor e o
   * backend recusa época obsoleta (recarga aconteceu no meio do voo). */
  coreEpoch: number | null;
  /** Truthful save status of the active scene: set by persistActiveScene only. */
  sceneSaveState: SceneSaveState;
  sceneDraftState: SceneDraftState;
  sceneDiskBaseline: SceneDiskBaseline | null;
  /** Última intenção CONFIRMADA pelo backend (`ok: true`). Este é o único
   * campo que demonstra entrega aceita pelo emulador. Acks cuja sequência não
   * corresponde à solicitação corrente são descartados (ack atrasado). */
  lastJoypadAck: JoypadObservation | null;
  /** Registro LIMITADO das transições da sessão corrente, por sequência. Ao contrário de
   * `lastJoypadAck` (que só guarda a confirmação da solicitação corrente), cada transição mantém o seu
   * próprio desfecho mesmo quando a seguinte já foi solicitada. Zera a cada troca de sessão. */
  joypadLog: JoypadTransition[];
  /** Falha da última solicitação: `ok: false` (resolve normal da IPC) ou
   * exceção. Correlacionado por sequência. */
  lastJoypadSendError: { sessionId: string; seq: number; message: string } | null;
  /** Época da carga corrente do emulador. Muda a cada carga e vira null ao
   * parar; solicitações e confirmações de sessões anteriores são descartadas. */
  joypadSessionId: string | null;
  selectedEntityId: string | null;
  /** Contexto de navegação compartilhado entre tarefas do Studio (Experimental). */
  studio: StudioContextState;
  /** ID da camada ativa no LayerPanel. null = sem camada selecionada. */
  activeLayerId: string | null;
  activeWorkspace: EditorWorkspace;
  activeViewportTab: string;
  artStudioAssetPath: string | null;
  consoleEntries: ConsoleEntry[];
  consoleVisible: boolean;
  lastParityReport: ParityReport | null;
  lastBuildSourceMap: BuildSourceMap | null;
  /** Vínculo execução → projeto do último build bem-sucedido (Experimental). */
  lastRuntimeLink: RuntimeLink | null;
  /** `sceneRevision` no início do último build bem-sucedido; null = nenhum build nesta sessão. */
  lastBuildSceneRevision: number | null;
  lastBuildTest: BuildTestReceipt | null;
  /** Ajustes temporários da sessão de teste (não são do projeto até "Aplicar ao projeto"). */
  testAdjustments: TestAdjustment[];
  /** Pedido para abrir o editor de perfil REX numa instância comprovada (Experimental). */
  rexBridgeRequest: RexBridgeRequest | null;
  /** Última operação de arquivo com cópia de segurança (renomear asset, aplicar ao modelo). */
  lastFileBackup: { id: string; reason: string } | null;
  /** Cópia editada de uma ROM comercial em execução e a ROM original intocada (reverter pelo mesmo carregador). */
  rexCopyRun: { copyPath: string; originalPath: string } | null;
  lastCrossCoreReport: CrossCoreReport | null;
  lastCycleReport: CycleReport | null;
  hwStatus: HwStatus | null;
  sceneRevision: number;
  hwValidationState: HwValidationState;
  hwValidatedRevision: number;
  hwValidationError: string | null;
  hwValidationRefreshTick: number;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pendingHistorySnapshot: UndoEntry | null;
  activeScene: Scene | null;
  activeSceneSource: Scene | null;
  emulPaused: boolean;
  viewportZoom: number;
  projectSourceKind: string;
  projectLegacyIndex: LegacySgdkIndex | null;
  editorMode: EditorMode;
  activeBrush: ActiveBrush | null;
  /** Ferramenta ativa do editor de tilemap (pencil/eraser/picker/rect/fill/stamp). */
  tilePaintTool: TilePaintTool;
  /** Entidade-tilemap explicitamente selecionada para pintura.
   *  `null` quando Paint está desligado ou nenhum tilemap está em foco. */
  activeTilemapId: string | null;
  /** Tamanho do tile em pixels do tileset ativo (padrão MD/SNES: 8). */
  tilePaintSize: number;
  /** Retângulo em pré-visualização (rect tool em drag). */
  tilePaintRectPreview: { c0: number; r0: number; c1: number; r1: number } | null;
  /** Padrão ativo para a ferramenta `stamp` (subgrade pintada). */
  tileStampPattern: TileStampPattern | null;
}

export interface StoreActions {
  setActiveProject: (dir: string, name: string) => void;
  setActiveTarget: (target: "megadrive" | "snes") => void;
  setActiveScenePath: (path: string) => void;
  setEmulatorLoaded: (loaded: boolean) => void;
  setEmulatorRomIdentity: (identity: EmulatorRomIdentity | null) => void;
  requestEmulatorLaunch: (romPath: string, sourceLabel: string) => void;
  clearEmulatorLaunchRequest: () => void;
  setSelectedEntityId: (id: string | null) => void;
  /** Abre o editor da tarefa de destino empilhando a origem (seleção + câmera) para retorno. */
  openStudioEditor: (nav: StudioNavigation) => void;
  /** Volta à origem empilhada, restaurando workspace, seleção e câmera. */
  returnToStudioOrigin: () => StudioReturnResult;
  /** Refina o foco dentro da tarefa atual (ex.: outra ocorrência) sem empilhar retorno. */
  refineStudioFocus: (patch: Partial<StudioFocus>) => void;
  rememberWorkspaceCamera: (workspace: EditorWorkspace, camera: WorkspaceCamera) => void;
  setActiveLayerId: (id: string | null) => void;
  setActiveWorkspace: (workspace: EditorWorkspace) => void;
  /** Cria uma nova camada na cena ativa. */
  createLayer: (name: string, kind: string) => void;
  /** Remove uma camada pelo id. Entidades da camada ficam sem camada atribuída. */
  deleteLayer: (layerId: string) => void;
  /** Atualiza campos de uma camada (name, visible, locked, depth). */
  updateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
  /** Move a camada para cima na profundidade (renderiza sobre as outras). */
  moveLayerUp: (layerId: string) => void;
  /** Move a camada para baixo na profundidade (renderiza atrás das outras). */
  moveLayerDown: (layerId: string) => void;
  /** Atribui uma entidade a uma camada (remove-a de outras camadas primeiro). */
  assignEntityToLayer: (entityId: string, layerId: string | null) => void;
  setActiveViewportTab: (id: string) => void;
  setArtStudioAssetPath: (path: string | null) => void;
  logMessage: (level: ConsoleEntry["level"], message: string) => void;
  logDiagnostic: (diagnostic: ActionableDiagnostic) => void;
  clearConsole: () => void;
  toggleConsole: () => void;
  setLastParityReport: (report: ParityReport | null) => void;
  setLastBuildSourceMap: (sourceMap: BuildSourceMap | null) => void;
  setLastRuntimeLink: (link: RuntimeLink | null) => void;
  setLastBuildSceneRevision: (revision: number | null) => void;
  recordBuildTestFrame: (coreEpoch: number, romSha256: string, frameIndex: number) => void;
  setTestAdjustments: (adjustments: TestAdjustment[]) => void;
  setRexBridgeRequest: (request: RexBridgeRequest | null) => void;
  setLastFileBackup: (backup: { id: string; reason: string } | null) => void;
  setRexCopyRun: (run: { copyPath: string; originalPath: string } | null) => void;
  setLastCrossCoreReport: (report: CrossCoreReport | null) => void;
  setLastCycleReport: (report: CycleReport | null) => void;
  setHwStatus: (status: HwStatus | null) => void;
  setHwValidationPending: (revision: number) => void;
  setHwValidationResult: (revision: number, status: HwStatus) => void;
  setHwValidationError: (revision: number, error: string) => void;
  requestHwValidationRefresh: () => void;
  resetHwValidation: () => void;
  setActiveScene: (scene: Scene | null, sourceScene?: Scene | null) => void;
  /**
   * Substitui cena resolvida e cena-fonte numa ÚNICA entrada de desfazer (ex.: remover exceção local
   * de uma instância e re-resolver o modelo). Preserva seleção e histórico.
   */
  replaceScenesWithHistory: (resolved: Scene, source: Scene) => void;
  beginHistoryCapture: () => void;
  commitHistoryCapture: () => void;
  cancelHistoryCapture: () => void;
  updateEntity: (
    entityId: string,
    patch: Partial<Entity>,
    options?: { recordHistory?: boolean }
  ) => void;
  /** Recursos de paleta da cena (plano de paletas): uma transação de desfazer. */
  setScenePalettes: (palettes: PaletteEntry[]) => void;
  addEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
  updateBackgroundLayer: (layerId: string, patch: Partial<BackgroundLayer>) => void;
  /**
   * Pinta ou apaga um tile do collision_map pelo índice linear.
   * Se collision_map ainda não existe na cena, auto-inicializa com dimensões
   * padrão do activeTarget (MD=40x28, SNES=32x28, tile=8x8).
   * Não empurra o undo stack — use beginHistoryCapture / commitHistoryCapture
   * ao redor do drag para criar uma entrada única de undo.
   */
  updateCollisionMap: (tileIndex: number, value: 0 | 1) => void;
  undo: () => void;
  redo: () => void;
  setEmulPaused: (paused: boolean) => void;
  recordJoypadRequest: (sessionId: string, seq: number, joypad: Record<string, boolean>) => void;
  recordJoypadAck: (
    sessionId: string,
    seq: number,
    joypad: Record<string, boolean>,
    accepted?: { epoch?: number | null; generation?: number | null; appliedAtFrame?: number | null },
  ) => void;
  recordJoypadSendError: (sessionId: string, seq: number, message: string) => void;
  /** Invalida a época ANTES de qualquer await da carga/stop: durante o hold,
   * envios são bloqueados e contados — nada antigo é aceito na janela. */
  beginJoypadSessionHold: () => void;
  releaseJoypadSessionHold: () => void;
  recordJoypadBlocked: () => void;
  setCoreEpoch: (epoch: number | null) => void;
  setSceneSaveState: (state: SceneSaveState) => void;
  setSceneDraftState: (state: SceneDraftState) => void;
  setViewportZoom: (zoom: number) => void;
  resetViewportZoom: () => void;
  setProjectSourceKind: (kind: string) => void;
  setProjectLegacyIndex: (index: LegacySgdkIndex | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveBrush: (brush: ActiveBrush | null) => void;
  setTilePaintTool: (tool: TilePaintTool) => void;
  setActiveTilemapId: (id: string | null) => void;
  setTilePaintSize: (size: number) => void;
  setTilePaintRectPreview: (
    preview: { c0: number; r0: number; c1: number; r1: number } | null
  ) => void;
  setTileStampPattern: (pattern: TileStampPattern | null) => void;
  /** Pinta a célula (col,row) da entidade-tilemap com `tileIndex`.
   *  Materializa `cells[]` sob demanda quando o projeto é importado sem malha.
   *  Usa `beginHistoryCapture/commitHistoryCapture` externamente para agrupar drags. */
  paintTilemapCell: (
    entityId: string,
    col: number,
    row: number,
    tileIndex: number
  ) => void;
  /** Preenche o retângulo [c0..c1] × [r0..r1] inclusivo com `tileIndex`.
   *  Coordenadas fora do mapa são recortadas. Cria uma única entrada de undo. */
  fillTilemapRect: (
    entityId: string,
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    tileIndex: number
  ) => void;
  /** Flood 4-vizinhança a partir de (col,row). No-op se target já é `tileIndex`. */
  fillTilemapFlood: (
    entityId: string,
    col: number,
    row: number,
    tileIndex: number
  ) => void;
  /** Limpa toda a malha pintada; reverte para o fallback do tileset esticado. */
  clearTilemapCells: (entityId: string) => void;
}

export type EditorState = StoreState & StoreActions;

const INITIAL_VALIDATION_STATE = {
  hwValidationState: "idle" as HwValidationState,
  hwValidatedRevision: 0,
  hwValidationError: null as string | null,
};

let _entryCounter = 0;

function cloneSceneSnapshot(scene: Scene | null): Scene | null {
  return scene ? structuredClone(scene) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergePatchedValue<T>(current: T, patch: unknown): T {
  if (!isRecord(patch)) {
    return structuredClone(patch) as T;
  }

  const currentRecord: Record<string, unknown> = isRecord(current) ? current : {};
  const merged: Record<string, unknown> = { ...currentRecord };

  for (const [key, value] of Object.entries(patch)) {
    merged[key] = mergePatchedValue(currentRecord[key], value);
  }

  return merged as T;
}

function prunePatchAgainstBase(patch: unknown, base: unknown): unknown | undefined {
  if (!isRecord(patch)) {
    return Object.is(patch, base) ? undefined : structuredClone(patch);
  }

  const baseRecord = isRecord(base) ? base : {};
  const pruned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    const child = prunePatchAgainstBase(value, baseRecord[key]);
    if (child !== undefined) {
      pruned[key] = child;
    }
  }

  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

/**
 * On a prefab instance, a component present in the source replaces the prefab's whole
 * component (the backend requires complete components, e.g. SpriteComponent.asset).
 * A pruned partial patch of an inherited component would therefore be invalid, so the
 * touched component becomes a complete local override (resolved value + patch). Only
 * touched components are materialized; every other component stays inherited.
 */
function completeInheritedComponentOverrides(
  sourcePatch: unknown,
  sourceEntity: Entity,
  resolvedEntity: Entity
): unknown | undefined {
  if (!isRecord(sourcePatch) || !isRecord(sourcePatch.components) || !sourceEntity.prefab) {
    return sourcePatch;
  }
  const sourceComponents = (sourceEntity.components ?? {}) as Record<string, unknown>;
  const resolvedComponents = (resolvedEntity.components ?? {}) as Record<string, unknown>;
  const components: Record<string, unknown> = { ...sourcePatch.components };
  for (const [key, value] of Object.entries(components)) {
    const inherited = sourceComponents[key] === undefined || sourceComponents[key] === null;
    const resolved = resolvedComponents[key];
    if (inherited && isRecord(resolved) && isRecord(value) && key !== "logic") {
      components[key] = mergePatchedValue(structuredClone(resolved), value);
    }
  }
  return { ...sourcePatch, components };
}

function preserveInheritedGraphRef(
  sourcePatch: unknown,
  patch: unknown,
  sourceEntity: Entity,
  resolvedEntity: Entity
): unknown | undefined {
  if (!isRecord(sourcePatch) || !isRecord(patch)) {
    return sourcePatch;
  }

  const patchComponents = isRecord(patch.components) ? patch.components : null;
  const patchLogic = patchComponents && isRecord(patchComponents.logic) ? patchComponents.logic : null;
  if (!patchLogic || !Object.prototype.hasOwnProperty.call(patchLogic, "graph")) {
    return sourcePatch;
  }

  const resolvedGraphRef = resolvedEntity.components.logic?.graph_ref;
  const sourceGraphRef = sourceEntity.components.logic?.graph_ref;
  if (!resolvedGraphRef || sourceGraphRef) {
    return sourcePatch;
  }

  const nextPatch = structuredClone(sourcePatch) as Record<string, unknown>;
  const nextComponents = isRecord(nextPatch.components)
    ? { ...(nextPatch.components as Record<string, unknown>) }
    : {};
  const nextLogic = isRecord(nextComponents.logic)
    ? { ...(nextComponents.logic as Record<string, unknown>) }
    : {};
  nextLogic.graph_ref = resolvedGraphRef;
  if (!Object.prototype.hasOwnProperty.call(nextLogic, "graph_origin")) {
    nextLogic.graph_origin = "user_edited_ref";
  }
  nextComponents.logic = nextLogic;
  nextPatch.components = nextComponents;
  return nextPatch;
}

function cloneUndoEntry(entry: UndoEntry): UndoEntry {
  return {
    activeScene: cloneSceneSnapshot(entry.activeScene),
    activeSceneSource: cloneSceneSnapshot(entry.activeSceneSource),
    selectedEntityId: entry.selectedEntityId,
    editorMode: entry.editorMode,
    ...(entry.studioFocus ? { studioFocus: { ...entry.studioFocus } } : {}),
  };
}

function createUndoEntry(
  state: Pick<StoreState, "activeScene" | "activeSceneSource" | "selectedEntityId" | "editorMode"> &
    Partial<Pick<StoreState, "studio">>
): UndoEntry {
  return {
    activeScene: cloneSceneSnapshot(state.activeScene),
    activeSceneSource: cloneSceneSnapshot(state.activeSceneSource),
    selectedEntityId: state.selectedEntityId,
    editorMode: state.editorMode,
    ...(state.studio ? { studioFocus: { ...state.studio.focus } } : {}),
  };
}

function pushHistoryEntry(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, cloneUndoEntry(entry)].slice(-UNDO_STACK_LIMIT);
}

function resolveSceneSelection(scene: Scene | null, previousSelection: string | null): string | null {
  if (!scene) {
    return null;
  }

  if (previousSelection) {
    const selectionStillExists = previousSelection.startsWith("layer::")
      ? scene.background_layers.some((layer) => `layer::${layer.layer_id}` === previousSelection)
      : scene.entities.some((entity) => entity.entity_id === previousSelection);

    if (selectionStillExists) {
      return previousSelection;
    }
  }

  if (scene.entities.length > 0) {
    const preferredEntity = [...scene.entities].sort((left, right) => {
      const score = (entity: Entity) => {
        let total = 0;
        if (entity.entity_id === "player") total += 100;
        if (entity.components?.logic) total += 60;
        if (entity.components?.sprite) total += 40;
        if (entity.components?.camera) total += 20;
        if (entity.components?.tilemap) total += 10;
        return total;
      };

      return score(right) - score(left);
    })[0];

    return preferredEntity?.entity_id ?? scene.entities[0].entity_id;
  }

  if (scene.background_layers.length > 0) {
    return `layer::${scene.background_layers[0].layer_id}`;
  }

  return null;
}

function viewportTabForWorkspace(workspace: EditorWorkspace, current: string): string {
  return workspace === "scene" || workspace === "logic" || workspace === "artstudio" || workspace === "game"
    ? workspace
    : current;
}

function restoreFocusFromUndo(state: StoreState, entry: UndoEntry): StudioContextState {
  return entry.studioFocus ? { ...state.studio, focus: { ...entry.studioFocus } } : state.studio;
}

function saveStateAfterHistory(state: EditorState, source: Scene | null, revision: number): SceneSaveState {
  if (state.sceneSaveState.status === "saving") return state.sceneSaveState;
  const baseline = state.sceneDiskBaseline;
  if (source && baseline?.projectDir === state.activeProjectDir && baseline.scenePath === state.activeScenePath
      && state.sceneDraftState.status !== "conflict" && sceneSourcesEqual(JSON.stringify(source), baseline.sourceSceneJson)) {
    return { status: "saved", revision, at: state.sceneSaveState.at, message: null };
  }
  return state.sceneSaveState;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeProjectDir: "",
  projectSessionId: 0,
  activeProjectName: "",
  activeTarget: "megadrive",
  setActiveProject: (dir, name) =>
    set((state) => ({
      activeProjectDir: dir,
      projectSessionId: state.projectSessionId + 1,
      activeProjectName: name,
      sceneDiskBaseline: null,
      sceneDraftState: { ...EMPTY_SCENE_DRAFT_STATE },
      lastBuildSourceMap: null,
      lastRuntimeLink: null,
      lastBuildSceneRevision: null,
      lastBuildTest: null,
      studio: loadStudioContext(dir),
    })),
  setActiveTarget: (target) => set((state) => state.activeTarget === target ? state : ({
    activeTarget: target,
    projectSessionId: state.projectSessionId + 1,
    lastBuildSourceMap: null,
    lastRuntimeLink: null,
    lastBuildSceneRevision: null,
    lastBuildTest: null,
  })),
  activeScenePath: "",
  setActiveScenePath: (path) => set((state) => state.activeScenePath === path ? state : ({
    activeScenePath: path,
    sceneDiskBaseline: null,
    sceneDraftState: { ...EMPTY_SCENE_DRAFT_STATE },
    projectSessionId: state.projectSessionId + 1,
    lastBuildSourceMap: null,
    lastRuntimeLink: null,
    lastBuildSceneRevision: null,
  })),
  emulatorLoaded: false,
  emulatorRomIdentity: null,
  emulatorLaunchRequest: null,
  setEmulatorLoaded: (loaded) =>
    set(() => ({
      emulatorLoaded: loaded,
      emulatorRomIdentity: null,
      // Toda transição de carga abre uma época nova (ou nenhuma, ao parar):
      // solicitações e confirmações da carga anterior deixam de ser aceitáveis.
      // Ancorar aqui — e não em cada call site — torna a invalidação por
      // stop/recarga impossível de esquecer.
      joypadSessionId: loaded ? `joypad-session-${(joypadSessionCounter += 1)}` : null,
      lastJoypadRequest: null,
      lastJoypadAck: null,
      joypadLog: [],
      lastJoypadSendError: null,
      // Toda carga/parada encerra a sessão de teste: ajustes temporários não sobrevivem.
      testAdjustments: [],
    })),
  setEmulatorRomIdentity: (identity) => set({ emulatorRomIdentity: identity }),
  requestEmulatorLaunch: (romPath, sourceLabel) =>
    set({
      emulatorLaunchRequest: {
        requestId: (emulatorLaunchRequestCounter += 1),
        romPath,
        sourceLabel,
      },
    }),
  clearEmulatorLaunchRequest: () => set({ emulatorLaunchRequest: null }),

  selectedEntityId: null,
  setSelectedEntityId: (id) => set((state) => ({
    selectedEntityId: id,
    studio: refineStudioFocusState(state.studio, { entityId: id }),
  })),
  studio: initialStudioContext(),
  openStudioEditor: (nav) => {
    set((state) => {
      const currentCamera: WorkspaceCamera = {
        ...(state.studio.cameras[state.activeWorkspace] ?? { panX: 0, panY: 0 }),
        zoom: state.viewportZoom,
      };
      // A origem guarda a seleção real do editor, mesmo que ela tenha sido feita fora do Studio
      // (hierarquia, viewport): o retorno precisa reencontrá-la.
      const origin =
        state.studio.focus.entityId === state.selectedEntityId
          ? state.studio
          : refineStudioFocusState(state.studio, {
              entityId: state.selectedEntityId,
              task: workspaceToStudioTask(state.activeWorkspace),
            });
      const studio = navigateStudio(
        origin,
        { workspace: state.activeWorkspace, camera: currentCamera },
        nav
      );
      const workspace = STUDIO_TASK_WORKSPACE[nav.focus.task];
      const targetCamera = studio.cameras[workspace];
      return {
        studio,
        activeWorkspace: workspace,
        activeViewportTab: viewportTabForWorkspace(workspace, state.activeViewportTab),
        selectedEntityId: studio.focus.entityId ?? state.selectedEntityId,
        ...(targetCamera ? { viewportZoom: targetCamera.zoom } : {}),
      };
    });
    const { activeProjectDir, studio } = get();
    saveStudioContext(activeProjectDir, studio);
  },
  returnToStudioOrigin: () => {
    const state = get();
    const result = returnStudioOrigin(state.studio, state.activeScene);
    if (!result.ok) {
      return result;
    }
    const camera = result.entry.camera;
    set({
      studio: result.state,
      activeWorkspace: result.entry.workspace,
      activeViewportTab: viewportTabForWorkspace(result.entry.workspace, state.activeViewportTab),
      selectedEntityId: result.state.focus.entityId,
      ...(camera ? { viewportZoom: camera.zoom } : {}),
    });
    saveStudioContext(state.activeProjectDir, result.state);
    return result;
  },
  refineStudioFocus: (patch) => {
    set((state) => {
      const studio = refineStudioFocusState(state.studio, patch);
      return {
        studio,
        ...(patch.entityId !== undefined ? { selectedEntityId: patch.entityId } : {}),
      };
    });
    const { activeProjectDir, studio } = get();
    saveStudioContext(activeProjectDir, studio);
  },
  rememberWorkspaceCamera: (workspace, camera) =>
    set((state) => ({ studio: rememberWorkspaceCameraState(state.studio, workspace, camera) })),

  activeWorkspace: "scene",
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  activeViewportTab: "scene",
  setActiveViewportTab: (id) => set({ activeViewportTab: id }),
  artStudioAssetPath: null,
  setArtStudioAssetPath: (path) => set({ artStudioAssetPath: path }),

  consoleEntries: [
    {
      id: 0,
      level: "info",
      message:
        "RetroDev Studio iniciado. Status: release candidate / beta testing do desktop Tauri. Use Arquivo -> Abrir/Novo Projeto.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ],
  logMessage: (level, message) =>
    set((state) => ({
      consoleEntries: [
        ...state.consoleEntries,
        {
          id: ++_entryCounter,
          level,
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
      consoleVisible: level === "error" ? true : state.consoleVisible,
    })),
  logDiagnostic: (diagnostic) =>
    set((state) => {
      const level: ConsoleEntry["level"] =
        diagnostic.severity === "error"
          ? "error"
          : diagnostic.severity === "warn"
            ? "warn"
            : "info";
      return {
        consoleEntries: [
          ...state.consoleEntries,
          {
            id: ++_entryCounter,
            level,
            message: diagnosticConsoleMessage(diagnostic),
            timestamp: new Date().toLocaleTimeString(),
            diagnostic,
          },
        ],
        consoleVisible: level === "error" ? true : state.consoleVisible,
      };
    }),
  clearConsole: () => set({ consoleEntries: [] }),

  consoleVisible: false,
  toggleConsole: () => set((state) => ({ consoleVisible: !state.consoleVisible })),
  lastParityReport: null,
  setLastParityReport: (report) => set({ lastParityReport: report }),
  lastBuildSourceMap: null,
  setLastBuildSourceMap: (sourceMap) => set({ lastBuildSourceMap: sourceMap }),
  lastRuntimeLink: null,
  setLastRuntimeLink: (link) => set({ lastRuntimeLink: link }),
  lastBuildSceneRevision: null,
  setLastBuildSceneRevision: (revision) => set({ lastBuildSceneRevision: revision }),
  lastBuildTest: null,
  recordBuildTestFrame: (coreEpoch, romSha256, frameIndex) => {
    const state = get();
    if (!Number.isSafeInteger(frameIndex) || frameIndex <= 0 || !state.emulatorLoaded || state.joypadSessionHold
      || state.coreEpoch !== coreEpoch || !state.joypadSessionId
      || state.emulatorRomIdentity?.sha256 !== romSha256
      || state.lastBuildSourceMap?.artifact.sha256 !== romSha256
      || state.lastBuildSceneRevision === null
      || state.lastBuildTest?.sessionId === state.joypadSessionId) return;
    set({ lastBuildTest: {
      projectDir: state.activeProjectDir,
      sceneRevision: state.lastBuildSceneRevision,
      romSha256,
      coreEpoch,
      sessionId: state.joypadSessionId,
      testedAt: Date.now(),
    } });
  },
  testAdjustments: [],
  setTestAdjustments: (adjustments) => set({ testAdjustments: adjustments }),
  rexBridgeRequest: null,
  setRexBridgeRequest: (request) => set({ rexBridgeRequest: request }),
  lastFileBackup: null,
  setLastFileBackup: (backup) => set({ lastFileBackup: backup }),
  rexCopyRun: null,
  setRexCopyRun: (run) => set({ rexCopyRun: run }),
  lastCrossCoreReport: null,
  setLastCrossCoreReport: (report) => set({ lastCrossCoreReport: report }),
  lastCycleReport: null,
  setLastCycleReport: (report) => set({ lastCycleReport: report }),

  hwStatus: null,
  setHwStatus: (status) => set({ hwStatus: status }),
  sceneRevision: 0,
  ...INITIAL_VALIDATION_STATE,
  hwValidationRefreshTick: 0,
  undoStack: [],
  redoStack: [],
  pendingHistorySnapshot: null,
  setHwValidationPending: (revision) =>
    set((state) => ({
      hwValidationState:
        state.hwValidatedRevision > 0 && state.hwValidatedRevision < revision && state.hwStatus
          ? "stale"
          : "pending",
      hwValidationError: null,
    })),
  setHwValidationResult: (revision, status) =>
    set({
      hwStatus: status,
      hwValidationState: "fresh",
      hwValidatedRevision: revision,
      hwValidationError: null,
    }),
  setHwValidationError: (revision, error) =>
    set({
      hwValidationState: "error",
      hwValidatedRevision: revision,
      hwValidationError: error,
    }),
  requestHwValidationRefresh: () =>
    set((state) => ({
      hwValidationRefreshTick: state.hwValidationRefreshTick + 1,
    })),
  resetHwValidation: () => set({ ...INITIAL_VALIDATION_STATE }),

  activeLayerId: null,
  setActiveLayerId: (id) => set({ activeLayerId: id }),

  activeScene: null,
  activeSceneSource: null,
  replaceScenesWithHistory: (resolved, source) =>
    set((state) => ({
      undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
      redoStack: [],
      pendingHistorySnapshot: null,
      activeScene: cloneSceneSnapshot(resolved),
      activeSceneSource: cloneSceneSnapshot(source),
      selectedEntityId: resolveSceneSelection(resolved, state.selectedEntityId),
      sceneRevision: state.sceneRevision + 1,
    })),
  setActiveScene: (scene, sourceScene = scene) =>
    set((state) => {
      const nextRevision = scene ? state.sceneRevision + 1 : 0;
      const nextValidationState =
        scene &&
        state.hwValidatedRevision > 0 &&
        state.hwValidatedRevision < nextRevision &&
        state.hwStatus
          ? {
              hwValidationState: "stale" as HwValidationState,
              hwValidationError: null,
            }
          : scene
            ? {}
            : INITIAL_VALIDATION_STATE;

      return {
        activeScene: scene,
        activeSceneSource: sourceScene,
        sceneDiskBaseline: sourceScene ? {
          projectDir: state.activeProjectDir,
          scenePath: state.activeScenePath,
          sourceSceneJson: JSON.stringify(sourceScene),
        } : null,
        sceneDraftState: { ...EMPTY_SCENE_DRAFT_STATE },
        selectedEntityId: resolveSceneSelection(scene, state.selectedEntityId),
        sceneRevision: nextRevision,
        // A scene set from outside (disk load/hydration) is the saved baseline.
        sceneSaveState: scene
          ? { status: "saved" as const, message: null, at: Date.now(), revision: nextRevision }
          : { status: "idle" as const, message: null, at: null, revision: null },
        undoStack: [],
        redoStack: [],
        pendingHistorySnapshot: null,
        ...nextValidationState,
      };
    }),
  beginHistoryCapture: () =>
    set((state) => {
      if (!state.activeScene || state.pendingHistorySnapshot) {
        return {};
      }

      return {
        pendingHistorySnapshot: createUndoEntry(state),
      };
    }),
  commitHistoryCapture: () =>
    set((state) => {
      if (!state.pendingHistorySnapshot) {
        return {};
      }

      return {
        undoStack: pushHistoryEntry(state.undoStack, state.pendingHistorySnapshot),
        redoStack: [],
        pendingHistorySnapshot: null,
      };
    }),
  cancelHistoryCapture: () => set({ pendingHistorySnapshot: null }),
  updateEntity: (entityId, patch, options) =>
    set((state) => {
      if (!state.activeScene) return {};
      const recordHistory = options?.recordHistory ?? true;
      const resolvedEntity = state.activeScene.entities.find((entity) => entity.entity_id === entityId);
      if (!resolvedEntity) {
        return {};
      }
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((entity) => entity.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      const sourceEntity =
        sourceScene.entities.find((entity) => entity.entity_id === entityId) ?? resolvedEntity;

      const sourcePatch = completeInheritedComponentOverrides(
        preserveInheritedGraphRef(
          prunePatchAgainstBase(patch, resolvedEntity),
          patch,
          sourceEntity,
          resolvedEntity
        ),
        sourceEntity,
        resolvedEntity
      );
      return {
        ...(recordHistory
          ? {
              undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
              redoStack: [],
              pendingHistorySnapshot: null,
            }
          : {}),
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.map((entity) =>
            entity.entity_id === entityId ? mergePatchedValue(entity, patch) : entity
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.map((entity) =>
            entity.entity_id === entityId && sourcePatch !== undefined
              ? mergePatchedValue(entity, sourcePatch)
              : entity
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  setScenePalettes: (palettes) =>
    set((state) => {
      if (!state.activeScene) return {};
      const sourceScene =
        state.activeSceneSource?.scene_id === state.activeScene.scene_id ? state.activeSceneSource : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: { ...state.activeScene, palettes: structuredClone(palettes) },
        activeSceneSource: { ...sourceScene, palettes: structuredClone(palettes) },
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  addEntity: (entity) =>
    set((state) => {
      if (!state.activeScene) return {};
      const sourceScene =
        state.activeSceneSource?.scene_id === state.activeScene.scene_id
          ? state.activeSceneSource
          : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          entities: [...state.activeScene.entities, entity],
        },
        activeSceneSource: {
          ...sourceScene,
          entities: [...sourceScene.entities, structuredClone(entity)],
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  removeEntity: (entityId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((entity) => entity.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.filter((entity) => entity.entity_id !== entityId),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.filter((entity) => entity.entity_id !== entityId),
        },
        selectedEntityId: state.selectedEntityId === entityId ? null : state.selectedEntityId,
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  updateCollisionMap: (tileIndex, value) =>
    set((state) => {
      if (!state.activeScene) return {};

      // Auto-inicializa o mapa se ainda é null.
      const defaultDims: Record<"megadrive" | "snes", Pick<CollisionMap, "width" | "height" | "tile_width" | "tile_height">> = {
        megadrive: { width: 40, height: 28, tile_width: 8, tile_height: 8 },
        snes:      { width: 32, height: 28, tile_width: 8, tile_height: 8 },
      };

      const existingMap = state.activeScene.collision_map;
      const collisionMap: CollisionMap = existingMap ?? {
        ...defaultDims[state.activeTarget],
        data: Array<number>(
          defaultDims[state.activeTarget].width * defaultDims[state.activeTarget].height
        ).fill(0),
      };

      // Guarda limites: ignora índice fora do array.
      const capacity = collisionMap.width * collisionMap.height;
      if (tileIndex < 0 || tileIndex >= capacity) return {};

      const newData = collisionMap.data.slice();
      newData[tileIndex] = value;
      const updatedCollisionMap = { ...collisionMap, data: newData };

      return {
        activeScene: {
          ...state.activeScene,
          collision_map: updatedCollisionMap,
        },
        activeSceneSource: state.activeSceneSource
          ? { ...state.activeSceneSource, collision_map: updatedCollisionMap }
          : state.activeSceneSource,
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  updateBackgroundLayer: (layerId, patch) =>
    set((state) => {
      if (!state.activeScene) return {};
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.background_layers.some(
        (layer) => layer.layer_id === layerId
      )
        ? preferredSourceScene
        : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          background_layers: state.activeScene.background_layers.map((layer) =>
            layer.layer_id === layerId ? mergePatchedValue(layer, patch) : layer
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          background_layers: sourceScene.background_layers.map((layer) =>
            layer.layer_id === layerId ? mergePatchedValue(layer, patch) : layer
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) {
        return {
          pendingHistorySnapshot: null,
        };
      }

      return {
        activeScene: cloneSceneSnapshot(previous.activeScene),
        activeSceneSource: cloneSceneSnapshot(previous.activeSceneSource),
        selectedEntityId: previous.selectedEntityId,
        editorMode: previous.editorMode,
        studio: restoreFocusFromUndo(state, previous),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: pushHistoryEntry(state.redoStack, createUndoEntry(state)),
        pendingHistorySnapshot: null,
        sceneRevision: state.sceneRevision + 1,
        sceneSaveState: saveStateAfterHistory(state, previous.activeSceneSource, state.sceneRevision + 1),
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) {
        return {
          pendingHistorySnapshot: null,
        };
      }

      return {
        activeScene: cloneSceneSnapshot(next.activeScene),
        activeSceneSource: cloneSceneSnapshot(next.activeSceneSource),
        selectedEntityId: next.selectedEntityId,
        editorMode: next.editorMode,
        studio: restoreFocusFromUndo(state, next),
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: state.redoStack.slice(0, -1),
        pendingHistorySnapshot: null,
        sceneRevision: state.sceneRevision + 1,
        sceneSaveState: saveStateAfterHistory(state, next.activeSceneSource, state.sceneRevision + 1),
      };
    }),

  emulPaused: false,
  lastJoypadRequest: null,
  lastJoypadAck: null,
  joypadLog: [],
  lastJoypadSendError: null,
  joypadSessionId: null,
  joypadSessionHold: false,
  joypadBlockedCount: 0,
  coreEpoch: null,
  sceneSaveState: { status: "idle", message: null, at: null, revision: null },
  sceneDraftState: { ...EMPTY_SCENE_DRAFT_STATE },
  sceneDiskBaseline: null,
  setEmulPaused: (paused) => set({ emulPaused: paused }),
  beginJoypadSessionHold: () =>
    set({
      joypadSessionHold: true,
      // Invalidação ANTES de qualquer await da operação: a época corrente
      // deixa de existir aqui, não quando a resposta chegar.
      joypadSessionId: null,
      lastJoypadRequest: null,
      lastJoypadAck: null,
      lastJoypadSendError: null,
      joypadLog: [],
    }),
  releaseJoypadSessionHold: () => set({ joypadSessionHold: false }),
  recordJoypadBlocked: () =>
    set((state) => ({ joypadBlockedCount: state.joypadBlockedCount + 1 })),
  setCoreEpoch: (epoch) => set({ coreEpoch: epoch }),
  setSceneSaveState: (sceneSaveState) => set({ sceneSaveState }),
  setSceneDraftState: (sceneDraftState) => set({ sceneDraftState }),
  recordJoypadRequest: (sessionId, seq, joypad) =>
    set((state) =>
      !state.joypadSessionHold && state.joypadSessionId === sessionId
        ? {
            lastJoypadRequest: { sessionId, seq, joypad },
            lastJoypadSendError: null,
            joypadLog: [
              ...state.joypadLog,
              { sessionId, seq, joypad, outcome: "requested" as const, epoch: null, generation: null, appliedAtFrame: null, message: null },
            ].slice(-JOYPAD_LOG_CAPACITY),
          }
        : {},
    ),
  recordJoypadAck: (sessionId, seq, joypad, accepted) =>
    set((state) => {
      // Sessão errada (ack que atravessou stop/recarga): descartado por inteiro.
      if (state.joypadSessionId !== sessionId) return {};
      // O desfecho DESTA sequência é registrado mesmo que outra já tenha sido solicitada: o backend
      // aceitou aquela transição, e isso continua verdadeiro.
      const joypadLog = state.joypadLog.map((t) =>
        t.sessionId === sessionId && t.seq === seq
          ? {
              ...t,
              outcome: "accepted" as const,
              epoch: accepted?.epoch ?? null,
              generation: accepted?.generation ?? null,
              appliedAtFrame: accepted?.appliedAtFrame ?? null,
            }
          : t,
      );
      // O estado ATUAL só muda com o ack da solicitação corrente: uma confirmação antiga nunca o substitui.
      return state.lastJoypadRequest?.sessionId === sessionId && state.lastJoypadRequest?.seq === seq
        ? { joypadLog, lastJoypadAck: { sessionId, seq, joypad } }
        : { joypadLog };
    }),
  recordJoypadSendError: (sessionId, seq, message) =>
    set((state) => {
      if (state.joypadSessionId !== sessionId) return {};
      const joypadLog = state.joypadLog.map((t) =>
        t.sessionId === sessionId && t.seq === seq ? { ...t, outcome: "refused" as const, message } : t,
      );
      return state.lastJoypadRequest?.sessionId === sessionId && state.lastJoypadRequest?.seq === seq
        ? { joypadLog, lastJoypadSendError: { sessionId, seq, message } }
        : { joypadLog };
    }),

  viewportZoom: 1.75,
  setViewportZoom: (zoom) =>
    set({ viewportZoom: Math.min(4.0, Math.max(0.25, zoom)) }),
  resetViewportZoom: () => set({ viewportZoom: 1.75 }),

  projectSourceKind: "",
  setProjectSourceKind: (kind) => set({ projectSourceKind: kind }),
  projectLegacyIndex: null,
  setProjectLegacyIndex: (index) => set({ projectLegacyIndex: index }),

  editorMode: "select",
  setEditorMode: (mode) => set({ editorMode: mode }),

  activeBrush: null,
  setActiveBrush: (brush) => set({ activeBrush: brush }),

  tilePaintTool: "pencil",
  setTilePaintTool: (tool) => set({ tilePaintTool: tool }),

  activeTilemapId: null,
  setActiveTilemapId: (id) => set({ activeTilemapId: id }),

  tilePaintSize: 8,
  setTilePaintSize: (size) =>
    set({ tilePaintSize: Math.max(1, Math.min(64, Math.round(size))) }),

  tilePaintRectPreview: null,
  setTilePaintRectPreview: (preview) => set({ tilePaintRectPreview: preview }),

  tileStampPattern: null,
  setTileStampPattern: (pattern) => set({ tileStampPattern: pattern }),

  paintTilemapCell: (entityId, col, row, tileIndex) =>
    set((state) => {
      if (!state.activeScene) return {};
      const entity = state.activeScene.entities.find((e) => e.entity_id === entityId);
      const tilemap = entity?.components?.tilemap;
      if (!entity || !tilemap) return {};
      if (col < 0 || row < 0 || col >= tilemap.map_width || row >= tilemap.map_height) return {};
      const total = tilemap.map_width * tilemap.map_height;
      const base =
        tilemap.cells && tilemap.cells.length === total
          ? tilemap.cells
          : new Array<number>(total).fill(0);
      const idx = row * tilemap.map_width + col;
      const clamped = Math.max(0, Math.floor(tileIndex));
      if (base[idx] === clamped) return {};
      const cells = base.slice();
      cells[idx] = clamped;
      const patchedEntity: Entity = {
        ...entity,
        components: {
          ...entity.components,
          tilemap: { ...tilemap, cells },
        },
      };
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((e) => e.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      return {
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.map((e) =>
            e.entity_id === entityId ? patchedEntity : e
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.map((e) =>
            e.entity_id === entityId
              ? {
                  ...e,
                  components: {
                    ...e.components,
                    tilemap: { ...(e.components.tilemap ?? tilemap), cells: cells.slice() },
                  },
                }
              : e
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  fillTilemapRect: (entityId, c0, r0, c1, r1, tileIndex) =>
    set((state) => {
      if (!state.activeScene) return {};
      const entity = state.activeScene.entities.find((e) => e.entity_id === entityId);
      const tilemap = entity?.components?.tilemap;
      if (!entity || !tilemap) return {};
      const total = tilemap.map_width * tilemap.map_height;
      const minC = Math.max(0, Math.min(c0, c1));
      const maxC = Math.min(tilemap.map_width - 1, Math.max(c0, c1));
      const minR = Math.max(0, Math.min(r0, r1));
      const maxR = Math.min(tilemap.map_height - 1, Math.max(r0, r1));
      if (minC > maxC || minR > maxR) return {};
      const base =
        tilemap.cells && tilemap.cells.length === total
          ? tilemap.cells.slice()
          : new Array<number>(total).fill(0);
      const clamped = Math.max(0, Math.floor(tileIndex));
      let changed = false;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const idx = r * tilemap.map_width + c;
          if (base[idx] !== clamped) {
            base[idx] = clamped;
            changed = true;
          }
        }
      }
      if (!changed) return {};
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((e) => e.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.map((e) =>
            e.entity_id === entityId
              ? {
                  ...e,
                  components: { ...e.components, tilemap: { ...tilemap, cells: base } },
                }
              : e
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.map((e) =>
            e.entity_id === entityId
              ? {
                  ...e,
                  components: {
                    ...e.components,
                    tilemap: { ...(e.components.tilemap ?? tilemap), cells: base.slice() },
                  },
                }
              : e
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  fillTilemapFlood: (entityId, col, row, tileIndex) =>
    set((state) => {
      if (!state.activeScene) return {};
      const entity = state.activeScene.entities.find((e) => e.entity_id === entityId);
      const tilemap = entity?.components?.tilemap;
      if (!entity || !tilemap) return {};
      if (col < 0 || row < 0 || col >= tilemap.map_width || row >= tilemap.map_height) return {};
      const w = tilemap.map_width;
      const h = tilemap.map_height;
      const total = w * h;
      const base =
        tilemap.cells && tilemap.cells.length === total
          ? tilemap.cells.slice()
          : new Array<number>(total).fill(0);
      const clamped = Math.max(0, Math.floor(tileIndex));
      const seed = row * w + col;
      const target = base[seed];
      if (target === clamped) return {};
      // BFS iterativa (4-vizinhança) — evita stack overflow em mapas grandes
      const queue: number[] = [seed];
      while (queue.length > 0) {
        const idx = queue.pop() as number;
        if (base[idx] !== target) continue;
        base[idx] = clamped;
        const c = idx % w;
        const r = (idx - c) / w;
        if (c > 0) queue.push(idx - 1);
        if (c < w - 1) queue.push(idx + 1);
        if (r > 0) queue.push(idx - w);
        if (r < h - 1) queue.push(idx + w);
      }
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((e) => e.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.map((e) =>
            e.entity_id === entityId
              ? {
                  ...e,
                  components: { ...e.components, tilemap: { ...tilemap, cells: base } },
                }
              : e
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.map((e) =>
            e.entity_id === entityId
              ? {
                  ...e,
                  components: {
                    ...e.components,
                    tilemap: { ...(e.components.tilemap ?? tilemap), cells: base.slice() },
                  },
                }
              : e
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  clearTilemapCells: (entityId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const entity = state.activeScene.entities.find((e) => e.entity_id === entityId);
      const tilemap = entity?.components?.tilemap;
      if (!entity || !tilemap || !tilemap.cells || tilemap.cells.length === 0) return {};
      const preferredSourceScene = state.activeSceneSource ?? state.activeScene;
      const sourceScene = preferredSourceScene.entities.some((e) => e.entity_id === entityId)
        ? preferredSourceScene
        : state.activeScene;
      const strip = (e: Entity): Entity => {
        const tm = e.components.tilemap;
        if (!tm) return e;
        const { cells: _drop, ...rest } = tm;
        void _drop;
        return { ...e, components: { ...e.components, tilemap: rest } };
      };
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: {
          ...state.activeScene,
          entities: state.activeScene.entities.map((e) =>
            e.entity_id === entityId ? strip(e) : e
          ),
        },
        activeSceneSource: {
          ...sourceScene,
          entities: sourceScene.entities.map((e) =>
            e.entity_id === entityId ? strip(e) : e
          ),
        },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  createLayer: (name, kind) =>
    set((state) => {
      if (!state.activeScene) return {};
      const id = `layer_${Date.now()}`;
      const newLayer: SceneLayer = {
        id,
        name,
        kind,
        visible: true,
        locked: false,
        depth: (state.activeScene.layers?.length ?? 0),
        entity_ids: [],
      };
      const currentLayers = state.activeScene.layers ?? [];
      const sourceLayers = state.activeSceneSource?.layers ?? currentLayers;
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: { ...state.activeScene, layers: [...currentLayers, newLayer] },
        activeSceneSource: state.activeSceneSource
          ? { ...state.activeSceneSource, layers: [...sourceLayers, structuredClone(newLayer)] }
          : state.activeSceneSource,
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  deleteLayer: (layerId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const filterLayer = (layers: SceneLayer[] | null | undefined) =>
        (layers ?? []).filter((l) => l.id !== layerId);
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: { ...state.activeScene, layers: filterLayer(state.activeScene.layers) },
        activeSceneSource: state.activeSceneSource
          ? { ...state.activeSceneSource, layers: filterLayer(state.activeSceneSource.layers) }
          : state.activeSceneSource,
        activeLayerId: state.activeLayerId === layerId ? null : state.activeLayerId,
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  updateLayer: (layerId, patch) =>
    set((state) => {
      if (!state.activeScene) return {};
      const applyPatch = (layers: SceneLayer[] | null | undefined): SceneLayer[] =>
        (layers ?? []).map((l) => (l.id === layerId ? { ...l, ...patch } : l));
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: { ...state.activeScene, layers: applyPatch(state.activeScene.layers) },
        activeSceneSource: state.activeSceneSource
          ? { ...state.activeSceneSource, layers: applyPatch(state.activeSceneSource.layers) }
          : state.activeSceneSource,
        sceneRevision: state.sceneRevision + 1,
      };
    }),
  
  moveLayerUp: (layerId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const layers = [...(state.activeScene.layers ?? [])].sort((a, b) => a.depth - b.depth);
      const idx = layers.findIndex(l => l.id === layerId);
      if (idx === -1 || idx === layers.length - 1) return {};

      // Swap depth with the layer above it
      const tempDepth = layers[idx].depth;
      layers[idx].depth = layers[idx + 1].depth;
      layers[idx + 1].depth = tempDepth;

      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        activeScene: { ...state.activeScene, layers },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  moveLayerDown: (layerId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const layers = [...(state.activeScene.layers ?? [])].sort((a, b) => a.depth - b.depth);
      const idx = layers.findIndex(l => l.id === layerId);
      if (idx <= 0) return {};

      // Swap depth with the layer below it
      const tempDepth = layers[idx].depth;
      layers[idx].depth = layers[idx - 1].depth;
      layers[idx - 1].depth = tempDepth;

      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        activeScene: { ...state.activeScene, layers },
        sceneRevision: state.sceneRevision + 1,
      };
    }),

  assignEntityToLayer: (entityId, layerId) =>
    set((state) => {
      if (!state.activeScene) return {};
      const reassign = (layers: SceneLayer[] | null | undefined): SceneLayer[] =>
        (layers ?? []).map((l) => ({
          ...l,
          entity_ids: l.id === layerId
            ? [...new Set([...l.entity_ids, entityId])]
            : l.entity_ids.filter((id) => id !== entityId),
        }));
      return {
        undoStack: pushHistoryEntry(state.undoStack, createUndoEntry(state)),
        redoStack: [],
        pendingHistorySnapshot: null,
        activeScene: { ...state.activeScene, layers: reassign(state.activeScene.layers) },
        activeSceneSource: state.activeSceneSource
          ? { ...state.activeSceneSource, layers: reassign(state.activeSceneSource.layers) }
          : state.activeSceneSource,
        sceneRevision: state.sceneRevision + 1,
      };
    }),
}));
