// Vista «Código» da Lógica autoral (Experimental, incremento 1 do editor de C/SGDK).
// Mostra a projeção de código da instância selecionada, região por node, e envia cada
// edição como transação: o modelo (cena/grafo) continua sendo a única fonte de verdade.
// O editor profissional (Monaco, clangd, vista Dividido) pertence ao incremento 2.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bindingRegion,
  buildCodeEditTransaction,
  buildPoseCodeEditTransaction,
  regionText,
  type CodeBinding,
  type CodeDocument,
  type CodeEditScope,
  type PoseCodeBinding,
} from "../../core/codeDocument";
import { loadCodeDocument, submitCodeEdit } from "../../core/codeEditApply";
import { useCodeFocusStore } from "../../core/codeFocusStore";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { deserializeNodeGraph } from "../../core/nodegraph/nodeDefinitions";
import { NODE_CATALOG } from "../../core/nodegraph/nodeCatalog";
import { isNodeType } from "../../core/nodegraph/nodeTypes";
import { useEditorStore } from "../../core/store/editorStore";

const VIEWS = [
  ["nodes", "Nós", "Lógica visual da instância"],
  ["code", "Código (Experimental)", "Projeção em C da mesma lógica; o modelo da cena governa o build"],
] as const;

export function LogicViewTabs() {
  const logicView = useCodeFocusStore((s) => s.logicView);
  const setLogicView = useCodeFocusStore((s) => s.setLogicView);
  return (
    <div role="tablist" aria-label="Vista da lógica" className="flex shrink-0 items-center gap-1 border-b border-[#313244] bg-[#11111b] px-2 py-1 text-[11px]">
      {VIEWS.map(([view, label, hint]) => (
        <button
          key={view}
          type="button"
          role="tab"
          data-testid={`logic-view-${view}`}
          aria-selected={logicView === view}
          title={hint}
          onClick={() => setLogicView(view)}
          className={`rounded px-2 py-0.5 ${logicView === view ? "bg-[#1e3a5f] font-semibold text-white" : "text-[#93c5fd] hover:bg-[#1e293b]"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function stageLabel(stage: string): string {
  return isNodeType(stage) ? NODE_CATALOG[stage].title : stage;
}

function RegionEditor({
  document, binding, draft, scope, onResult,
}: {
  document: CodeDocument;
  binding: CodeBinding | PoseCodeBinding;
  draft: string | null;
  scope: CodeEditScope;
  onResult: (message: string) => void;
}) {
  const poseBinding = "pose" in binding ? binding : null;
  const region = poseBinding ? poseBinding.location : bindingRegion(binding as CodeBinding);
  const projected = poseBinding
    ? document.text.split("\n")[poseBinding.location.start_line - 1] ?? ""
    : regionText(document, binding as CodeBinding) ?? "";
  const identity = poseBinding ? [poseBinding.pose.animation, poseBinding.pose.occurrence_id] : [(binding as CodeBinding).node_id];
  const key = JSON.stringify([document.context.project, document.context.scene_id, binding.instance_id, ...identity]);
  const pending = useCodeFocusStore((state) => state.pendingRegions[key]);
  const setPending = useCodeFocusStore((state) => state.setPendingRegion);
  const text = pending?.text ?? draft ?? projected;
  const conflict = pending !== undefined && pending.base !== projected;
  const [busy, setBusy] = useState(false);

  const apply = useCallback(async () => {
    if (busy || conflict || (text === projected && draft === null)) return;
    setBusy(true);
    try {
      const transaction = "pose" in binding
        ? buildPoseCodeEditTransaction(document, binding, text)
        : buildCodeEditTransaction(document, binding, text, scope);
      const outcome = await submitCodeEdit(document, transaction);
      if (useCodeFocusStore.getState().pendingRegions[key] === pending
        && (outcome.kind === "applied" || outcome.kind === "pose_applied"
          || (outcome.kind === "unchanged" && outcome.receipt.status === "no_change"))) setPending(key, null);
      onResult(outcome.kind === "discarded" ? outcome.reason : outcome.receipt.message);
    } catch (error) {
      onResult(`Análise indisponível: ${String(error)}. O texto continua aqui; nada foi alterado no modelo.`);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, conflict, document, draft, key, onResult, pending, projected, scope, setPending, text]);

  const id = "pose" in binding ? "code-pose-duration" : `code-region-${binding.node_id}`;
  return (
    <section data-testid={id} className="rounded border border-[#313244] bg-[#181825]">
      <header className="flex items-center justify-between gap-2 border-b border-[#313244] px-2 py-1 text-[11px]">
        <label htmlFor={`${id}-text`} className="min-w-0 truncate font-semibold text-[#cdd6f4]">
          {"pose" in binding ? <>Duração · {binding.pose.animation} · {binding.pose.occurrence_id}</>
            : <>{stageLabel(binding.semantic_stage)} <span className="font-mono font-normal text-[#7f849c]">{binding.node_id}</span></>}
        </label>
        <span className="shrink-0 text-[#7f849c]">
          {draft !== null ? <strong className="mr-2 text-[#f9e2af]">Rascunho</strong> : null}
          {region ? `linhas ${region.start_line}–${region.end_line}` : null}
        </span>
      </header>
      <textarea
        id={`${id}-text`}
        data-testid={`${id}-text`}
        value={text}
        spellCheck={false}
        rows={Math.min(16, Math.max(2, text.split("\n").length))}
        onChange={(event) => setPending(key, { text: event.target.value, base: pending?.base ?? projected })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void apply(); }
          if (event.key === "Escape") setPending(key, null);
        }}
        className="block w-full resize-y bg-[#11111b] px-2 py-1 font-mono text-xs text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa]"
      />
      <footer className="flex items-center justify-end gap-2 px-2 py-1 text-[11px]">
        <span className="mr-auto text-[#7f849c]">Ctrl+Enter aplica · Esc descarta</span>
        {conflict ? (
          <button type="button" disabled={busy} onClick={() => setPending(key, null)}
            className="rounded border border-[#f9e2af] px-2 py-0.5">
            A origem mudou · Carregar valor atual
          </button>
        ) : draft !== null ? (
          <button type="button" disabled={busy} onClick={() => setPending(key, { text: projected, base: projected })}
            className="rounded border border-[#313244] px-2 py-0.5 text-[#cdd6f4] disabled:opacity-40">
            Restaurar código do modelo
          </button>
        ) : null}
        <button type="button" data-testid={`${id}-apply`} disabled={busy || conflict || (text === projected && draft === null)} onClick={() => void apply()}
          className="rounded border border-[#89b4fa] px-2 py-0.5 text-[#89b4fa] disabled:opacity-40">
          {busy ? "Analisando…" : "Aplicar ao modelo"}
        </button>
      </footer>
    </section>
  );
}

export function InstanceCodeView() {
  const activeScene = useEditorStore((s) => s.activeScene);
  const sceneRevision = useEditorStore((s) => s.sceneRevision);
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const studioFocus = useEditorStore((s) => s.studio.focus);
  const [document, setDocument] = useState<CodeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<CodeEditScope>("instance");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      loadCodeDocument().then(
        (next) => { if (active && next) { setDocument(next); setError(null); } },
        (reason) => { if (active) setError(String(reason)); },
      );
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [sceneRevision, activeScene?.scene_id]);

  const entity = activeScene?.entities.find((item) => item.entity_id === selectedEntityId) ?? null;
  useEffect(() => { setScope("instance"); setMessage(""); }, [selectedEntityId]);

  const sharedUses = useMemo(() => {
    const reference = entity?.components.logic?.graph_ref?.trim();
    if (!reference || !activeScene) return [];
    return activeScene.entities.filter(
      (other) => other.entity_id !== entity?.entity_id && other.components.logic?.graph_ref?.trim() === reference,
    );
  }, [activeScene, entity]);
  const drafts = useMemo(
    () => new Map((deserializeNodeGraph(entity?.components.logic?.graph).codeDrafts ?? []).map((draft) => [draft.nodeId, draft.text])),
    [entity?.components.logic?.graph],
  );
  const regions = useMemo(
    () => (document && entity
      ? document.bindings
          .filter((binding) => binding.instance_id === entity.entity_id && bindingRegion(binding))
          .sort((a, b) => bindingRegion(a)!.start_line - bindingRegion(b)!.start_line)
      : []),
    [document, entity],
  );
  const poseBinding = document?.pose_bindings?.find(({ instance_id, pose }) =>
    instance_id === selectedEntityId && instance_id === studioFocus.entityId
    && pose.animation === studioFocus.animation && pose.occurrence_id === studioFocus.occurrenceId);

  return (
    <div data-testid="instance-code-view" className="flex h-full w-full flex-col overflow-hidden bg-[#11111b] text-xs text-[#cdd6f4]">
      <header className="shrink-0 border-b border-[#313244] px-3 py-2">
        <p className="font-semibold">
          Código da instância <span className="rounded bg-[#f9e2af]/15 px-1 text-[10px] text-[#f9e2af]">Experimental</span>
        </p>
        <p className="mt-0.5 text-[11px] text-[#a6adc8]">
          Cena <strong>{activeScene?.display_name ?? activeScene?.scene_id ?? "—"}</strong> · Instância{" "}
          <strong data-testid="instance-code-entity">{entity ? getEntityDisplayName(entity) : "nenhuma"}</strong> · O modelo da cena governa o build; este código é a projeção editável dele.
        </p>
        {sharedUses.length > 0 ? (
          <label className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            Alcance da edição
            <select data-testid="instance-code-scope" value={scope} onChange={(event) => setScope(event.target.value as CodeEditScope)}
              className="rounded border border-[#313244] bg-[#181825] px-1 py-0.5">
              <option value="instance">Só esta instância (passa a ter lógica própria)</option>
              <option value="shared">Definição compartilhada ({sharedUses.length + 1} usos)</option>
            </select>
            <span className="text-[#a6adc8]">Outros usos: {sharedUses.map((other) => getEntityDisplayName(other)).join(", ")}</span>
          </label>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {error ? <p role="alert" data-testid="instance-code-error" className="text-[#f38ba8]">Projeção indisponível: {error}</p> : null}
        {!entity ? <p className="text-[#a6adc8]">Selecione um objeto na cena para ver o código da lógica dele.</p> : null}
        {poseBinding && document && entity ? (
          <RegionEditor key={JSON.stringify([poseBinding.instance_id, poseBinding.pose])}
            document={document} binding={poseBinding} scope="instance"
            draft={entity.components.sprite?.animations?.[poseBinding.pose.animation]?.pose_code_drafts?.[poseBinding.pose.occurrence_id] ?? null}
            onResult={setMessage} />
        ) : document && studioFocus.animation && studioFocus.occurrenceId && entity?.components.sprite ? (
          <p>Esta ocorrência ainda usa a duração padrão do recurso. Edite os ticks na linha do tempo para abrir o campo C.</p>
        ) : null}
        {entity && document && regions.length === 0 && !poseBinding && !studioFocus.occurrenceId ? (
          <p className="text-[#a6adc8]">Esta instância não tem trechos de código próprios nesta revisão. Monte a lógica na vista Nós.</p>
        ) : null}
        {document ? regions.map((binding) => (
          <RegionEditor key={`${binding.instance_id}:${binding.node_id}`} document={document} binding={binding}
            draft={drafts.get(binding.node_id) ?? null} scope={scope} onResult={setMessage} />
        )) : null}
      </div>
      <p role="status" aria-live="polite" data-testid="instance-code-status" className="shrink-0 border-t border-[#313244] px-3 py-1 text-[11px] text-[#a6adc8]">
        {message || "Alterações representáveis atualizam os nós; lógica livre vira um nó de código; texto incompleto fica como rascunho."}
      </p>
    </div>
  );
}
