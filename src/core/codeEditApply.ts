/**
 * Ponte entre os recibos do editor de código (Experimental) e o owner do modelo
 * (`editorStore`). Não há store nem histórico próprios: a mudança entra pela mesma
 * `updateEntity` da Lógica, em UMA entrada de desfazer, e segue o rascunho de cena e o
 * save canônico existentes.
 */
import {
  isReceiptCurrent,
  planCodeEdit,
  type CodeDocument,
  type CodeEditPlan,
  type CodeEditReceipt,
  type CodeEditTransaction,
} from "./codeDocument";
import { analyzeCodeEdit, projectCodeDocument } from "./ipc/codeDocumentService";
import { useEditorStore } from "./store/editorStore";
import { serializeSceneDraft } from "./validation/liveValidationController";

/** Identidade da sessão de edição: muda ao trocar de projeto, cena ou revisão da cena. */
interface EditorSnapshot {
  projectDir: string;
  projectSessionId: number | undefined;
  scenePath: string | null;
  sceneId: string;
  sceneRevision: number;
  sceneJson: string;
}

function snapshot(): EditorSnapshot | null {
  const state = useEditorStore.getState();
  if (!state.activeProjectDir || !state.activeScene) return null;
  return {
    projectDir: state.activeProjectDir,
    projectSessionId: state.projectSessionId,
    scenePath: state.activeScenePath,
    sceneId: state.activeScene.scene_id,
    sceneRevision: state.sceneRevision,
    sceneJson: serializeSceneDraft(state.activeScene),
  };
}

function stillCurrent(before: EditorSnapshot): boolean {
  const state = useEditorStore.getState();
  return state.activeProjectDir === before.projectDir
    && state.projectSessionId === before.projectSessionId
    && state.activeScenePath === before.scenePath
    && state.activeScene?.scene_id === before.sceneId
    && state.sceneRevision === before.sceneRevision;
}

/**
 * Projeta o documento da cena em memória. Devolve `null` se o projeto, a cena ou a
 * revisão mudaram enquanto o backend respondia (resposta atrasada descartada).
 */
export async function loadCodeDocument(): Promise<CodeDocument | null> {
  const before = snapshot();
  if (!before) return null;
  const document = await projectCodeDocument(before.projectDir, before.sceneJson);
  return stillCurrent(before) && document.context.project === before.projectDir ? document : null;
}

export type CodeEditOutcome =
  | { kind: "applied"; receipt: CodeEditReceipt; plan: CodeEditPlan }
  | { kind: "unchanged"; receipt: CodeEditReceipt }
  | { kind: "discarded"; reason: string };

/** Aplica o plano no modelo como uma única transação de desfazer. */
export function applyCodeEditPlan(plan: CodeEditPlan): void {
  const store = useEditorStore.getState();
  store.beginHistoryCapture();
  for (const patch of plan.patches) {
    const entity = useEditorStore.getState().activeScene?.entities.find((item) => item.entity_id === patch.entityId);
    if (!entity) continue;
    useEditorStore.getState().updateEntity(
      patch.entityId,
      { components: { ...entity.components, logic: patch.logic } },
      { recordHistory: false },
    );
  }
  useEditorStore.getState().commitHistoryCapture();
}

/**
 * Envia a transação e aplica o recibo se — e só se — ele ainda pertence ao documento e
 * à cena vivos. Recibos `stale`/`rejected`/`no_change` nunca mutam o modelo.
 */
export async function submitCodeEdit(
  document: CodeDocument,
  transaction: CodeEditTransaction,
): Promise<CodeEditOutcome> {
  const before = snapshot();
  if (!before || before.projectDir !== document.context.project || before.sceneId !== document.context.scene_id) {
    return { kind: "discarded", reason: "O documento pertence a outro projeto ou cena." };
  }
  const receipt = await analyzeCodeEdit(before.projectDir, before.sceneJson, transaction);
  if (!stillCurrent(before)) {
    return { kind: "discarded", reason: "A cena mudou enquanto a análise rodava; nada foi aplicado." };
  }
  if (!isReceiptCurrent(receipt, {
    project: before.projectDir,
    sceneId: before.sceneId,
    documentRevision: document.context.revision,
  })) {
    return { kind: "discarded", reason: "Resposta de outra revisão descartada." };
  }
  const scene = useEditorStore.getState().activeScene;
  const plan = scene ? planCodeEdit(receipt, scene) : null;
  if (!plan) return { kind: "unchanged", receipt };
  applyCodeEditPlan(plan);
  return { kind: "applied", receipt, plan };
}
