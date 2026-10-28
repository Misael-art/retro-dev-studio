/**
 * Contexto de navegação compartilhado do Studio (Experimental).
 *
 * Um único modelo, mantido no `editorStore`, descreve o que o usuário está editando
 * em qualquer tarefa (Cena, Personagem, Ações, Interface, Teste, Entrega) e como voltar
 * à origem. As tarefas são vistas dos workspaces existentes — não há store/rota paralela.
 */
import type { Scene } from "./ipc/sceneService";
import type { EditorWorkspace } from "./store/editorStore";

export type StudioTask = "scene" | "character" | "actions" | "interface" | "test" | "delivery";

/** Tarefa → workspace canônico existente. */
export const STUDIO_TASK_WORKSPACE: Record<StudioTask, EditorWorkspace> = {
  scene: "scene",
  character: "artstudio",
  actions: "logic",
  interface: "scene",
  test: "game",
  delivery: "debug",
};

export const STUDIO_TASK_LABEL: Record<StudioTask, string> = {
  scene: "Cena",
  character: "Arte",
  actions: "Lógica",
  interface: "Interface",
  test: "Teste",
  delivery: "Entrega",
};

/** Seleção rica: o que exatamente está em foco dentro da tarefa. */
export interface StudioFocus {
  task: StudioTask;
  entityId: string | null;
  animation: string | null;
  /** Identidade estável da ocorrência do quadro na animação (não o índice da imagem). */
  occurrenceId: string | null;
  /** Caixa de colisão selecionada (`<kind>:<index>`), quando houver. */
  boxKey: string | null;
  /** Evento de quadro selecionado (id estável), quando houver. */
  eventId: string | null;
}

export interface WorkspaceCamera {
  zoom: number;
  /** Deslocamento da câmera do editor (pan), em pixels de tela. */
  panX: number;
  panY: number;
}

export interface StudioReturnEntry {
  focus: StudioFocus;
  workspace: EditorWorkspace;
  camera: WorkspaceCamera | null;
  /** Rótulo legível do destino de retorno ("Voltar à cena"). */
  label: string;
}

export interface StudioContextState {
  focus: StudioFocus;
  returnStack: StudioReturnEntry[];
  cameras: Partial<Record<EditorWorkspace, WorkspaceCamera>>;
  /** Incrementa a cada retorno; editores reaplicam a câmera lembrada quando muda. */
  restoreSeq: number;
}

export const STUDIO_RETURN_STACK_LIMIT = 16;

export function emptyStudioFocus(task: StudioTask = "scene"): StudioFocus {
  return { task, entityId: null, animation: null, occurrenceId: null, boxKey: null, eventId: null };
}

export function initialStudioContext(): StudioContextState {
  return { focus: emptyStudioFocus(), returnStack: [], cameras: {}, restoreSeq: 0 };
}

export function workspaceToStudioTask(workspace: EditorWorkspace): StudioTask {
  switch (workspace) {
    case "artstudio":
      return "character";
    case "logic":
      return "actions";
    case "game":
      return "test";
    case "debug":
      return "delivery";
    default:
      return "scene";
  }
}

export function returnLabelFor(task: StudioTask): string {
  return `Voltar a ${STUDIO_TASK_LABEL[task]}`;
}

export interface StudioNavigation {
  /** Destino; campos omitidos herdam da origem só quando são da mesma entidade. */
  focus: Partial<StudioFocus> & { task: StudioTask };
}

/**
 * Abre um editor a partir do foco atual: empilha a origem (com a câmera do workspace de origem)
 * e devolve o novo estado. Não perde nada da origem; cancelar/voltar a restaura.
 */
export function navigateStudio(
  state: StudioContextState,
  from: { workspace: EditorWorkspace; camera: WorkspaceCamera | null },
  nav: StudioNavigation
): StudioContextState {
  const origin: StudioReturnEntry = {
    focus: { ...state.focus },
    workspace: from.workspace,
    camera: from.camera ? { ...from.camera } : null,
    label: returnLabelFor(state.focus.task),
  };
  const sameEntity = nav.focus.entityId === undefined || nav.focus.entityId === state.focus.entityId;
  const base = sameEntity ? { ...state.focus } : emptyStudioFocus(nav.focus.task);
  const nextFocus: StudioFocus = { ...base, ...nav.focus };
  const cameras = from.camera ? { ...state.cameras, [from.workspace]: { ...from.camera } } : state.cameras;
  const returnStack = [...state.returnStack, origin].slice(-STUDIO_RETURN_STACK_LIMIT);
  return { focus: nextFocus, returnStack, cameras, restoreSeq: state.restoreSeq };
}

export type StudioReturnResult =
  | { ok: true; state: StudioContextState; entry: StudioReturnEntry; droppedEntity: boolean }
  | { ok: false; reason: string };

/**
 * Volta ao contexto de origem. Se a entidade de origem não existe mais na cena (excluída), a seleção
 * dela é descartada de forma explícita em vez de apontar para algo inexistente.
 */
export function returnStudioOrigin(
  state: StudioContextState,
  scene: Pick<Scene, "entities"> | null
): StudioReturnResult {
  const entry = state.returnStack[state.returnStack.length - 1];
  if (!entry) {
    return { ok: false, reason: "Não há contexto de origem para voltar." };
  }
  let focus = { ...entry.focus };
  let droppedEntity = false;
  if (focus.entityId && !(scene?.entities ?? []).some((entity) => entity.entity_id === focus.entityId)) {
    focus = emptyStudioFocus(focus.task);
    droppedEntity = true;
  }
  return {
    ok: true,
    entry,
    droppedEntity,
    state: {
      focus,
      returnStack: state.returnStack.slice(0, -1),
      cameras: entry.camera ? { ...state.cameras, [entry.workspace]: { ...entry.camera } } : state.cameras,
      restoreSeq: state.restoreSeq + 1,
    },
  };
}

/** Atualiza o foco dentro da tarefa corrente sem empilhar retorno (ex.: escolher outra ocorrência). */
export function refineStudioFocus(state: StudioContextState, patch: Partial<StudioFocus>): StudioContextState {
  const entityChanged = patch.entityId !== undefined && patch.entityId !== state.focus.entityId;
  const base = entityChanged
    ? { ...emptyStudioFocus(state.focus.task), entityId: patch.entityId ?? null }
    : state.focus;
  return { ...state, focus: { ...base, ...patch } };
}

export function rememberWorkspaceCamera(
  state: StudioContextState,
  workspace: EditorWorkspace,
  camera: WorkspaceCamera
): StudioContextState {
  return { ...state, cameras: { ...state.cameras, [workspace]: { ...camera } } };
}

const STORAGE_PREFIX = "rds.studioContext.v1:";

/** Serialização por projeto (conveniência do usuário; falha silenciosa sem armazenamento). */
export function saveStudioContext(projectDir: string, state: StudioContextState): void {
  if (!projectDir) return;
  try {
    globalThis.localStorage?.setItem(
      STORAGE_PREFIX + projectDir,
      JSON.stringify({ schema: 1, focus: state.focus, cameras: state.cameras })
    );
  } catch {
    // armazenamento indisponível: contexto continua só em memória
  }
}

export function loadStudioContext(projectDir: string): StudioContextState {
  const fallback = initialStudioContext();
  if (!projectDir) return fallback;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + projectDir);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { schema?: number; focus?: Partial<StudioFocus>; cameras?: StudioContextState["cameras"] };
    if (parsed.schema !== 1 || !parsed.focus) return fallback;
    const task = parsed.focus.task && parsed.focus.task in STUDIO_TASK_LABEL ? parsed.focus.task : "scene";
    return {
      focus: { ...emptyStudioFocus(task), ...parsed.focus, task },
      returnStack: [],
      cameras: parsed.cameras ?? {},
      restoreSeq: 0,
    };
  } catch {
    return fallback;
  }
}
