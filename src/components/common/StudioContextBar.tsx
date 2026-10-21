import { UNDO_STACK_LIMIT, useEditorStore } from "../../core/store/editorStore";
import { revertLastFileOperation } from "../../core/projectFileOps";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { describeBuildFreshness } from "../../core/buildFreshness";
import { STUDIO_TASK_LABEL, workspaceToStudioTask } from "../../core/studioContext";

/**
 * Faixa de contexto compartilhado (Experimental): mostra o que está em foco na tarefa atual e
 * oferece retorno à origem com seleção e câmera preservadas. Some quando não há nada a mostrar.
 */
export function StudioContextBar() {
  const studio = useEditorStore((state) => state.studio);
  const activeWorkspace = useEditorStore((state) => state.activeWorkspace);
  const activeScene = useEditorStore((state) => state.activeScene);
  const returnToStudioOrigin = useEditorStore((state) => state.returnToStudioOrigin);
  const logMessage = useEditorStore((state) => state.logMessage);
  const lastFileBackup = useEditorStore((state) => state.lastFileBackup);
  const undoDepth = useEditorStore((state) => state.undoStack.length);
  const freshness = describeBuildFreshness({
    sceneRevision: useEditorStore((state) => state.sceneRevision),
    lastBuildSceneRevision: useEditorStore((state) => state.lastBuildSceneRevision),
    builtRomSha256: useEditorStore((state) => state.lastBuildSourceMap?.artifact.sha256 ?? null),
    runningRomSha256: useEditorStore((state) => state.emulatorRomIdentity?.sha256 ?? null),
  });

  const origin = studio.returnStack[studio.returnStack.length - 1] ?? null;
  const task = workspaceToStudioTask(activeWorkspace);
  const focus = studio.focus;
  const entity = focus.entityId
    ? activeScene?.entities.find((candidate) => candidate.entity_id === focus.entityId) ?? null
    : null;

  if (!origin && !entity && !lastFileBackup && undoDepth < UNDO_STACK_LIMIT) {
    return null;
  }

  const crumbs = [
    STUDIO_TASK_LABEL[task],
    entity ? getEntityDisplayName(entity) : null,
    focus.animation,
    focus.occurrenceId ? `Ocorrência ${focus.occurrenceId}` : null,
    focus.eventId ? `Evento ${focus.eventId}` : null,
  ].filter((value): value is string => Boolean(value));

  function handleReturn() {
    const result = returnToStudioOrigin();
    if (!result.ok) {
      logMessage("warn", `[Studio] ${result.reason}`);
      return;
    }
    if (result.droppedEntity) {
      logMessage("warn", "[Studio] A entidade de origem não existe mais; seleção de origem descartada.");
    }
  }

  return (
    <nav
      aria-label="Contexto do Studio"
      data-testid="studio-context-bar"
      data-task={task}
      data-entity-id={focus.entityId ?? ""}
      data-animation={focus.animation ?? ""}
      data-occurrence-id={focus.occurrenceId ?? ""}
      data-return-depth={studio.returnStack.length}
      className="flex min-h-[30px] items-center gap-2 border-b border-[#27272a] bg-[#0b1120] px-3 text-[11px] text-[#cbd5e1]"
    >
      <span className="rounded bg-[#1e293b] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#94a3b8]">
        Experimental
      </span>
      <ol className="flex min-w-0 flex-1 items-center gap-1 truncate" data-testid="studio-context-crumbs">
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb}`} className="flex items-center gap-1 truncate">
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            <span className={index === crumbs.length - 1 ? "font-semibold text-white" : undefined}>{crumb}</span>
          </li>
        ))}
      </ol>
      {undoDepth >= UNDO_STACK_LIMIT ? (
        <span data-testid="studio-history-limit" className="whitespace-nowrap text-[10px] text-[#fbbf24]" title="O desfazer guarda os últimos passos; os mais antigos foram descartados">
          Desfazer: últimos {UNDO_STACK_LIMIT} passos
        </span>
      ) : null}
      {lastFileBackup ? (
        <button
          type="button"
          data-testid="studio-revert-file-op"
          title={`Restaura os arquivos de antes de: ${lastFileBackup.reason}`}
          onClick={() => void revertLastFileOperation()}
          className="rounded border border-[#fbbf24]/60 px-2 py-0.5 text-[10px] text-[#fbbf24]"
        >
          Reverter: {lastFileBackup.reason}
        </button>
      ) : null}
      <span
        data-testid="studio-build-freshness"
        data-kind={freshness.kind}
        title="Estado da última mudança em relação à ROM"
        className={`whitespace-nowrap text-[10px] ${freshness.kind === "confirmed" ? "text-[#a6e3a1]" : "text-[#fbbf24]"}`}
      >
        {freshness.kind === "confirmed" ? "✓ " : "◷ "}
        {freshness.label}
      </span>
      {origin ? (
        <button
          type="button"
          data-testid="studio-return-origin"
          title={`${origin.label}: restaura a seleção e a câmera de onde você saiu`}
          onClick={handleReturn}
          className="rounded border border-[#334155] px-2 py-0.5 text-[11px] text-[#93c5fd] hover:bg-[#1e293b] focus:outline focus:outline-2 focus:outline-[#60a5fa]"
        >
          ← {origin.label}
        </button>
      ) : null}
    </nav>
  );
}
