// Vista «Código» da Lógica autoral (Experimental, incremento 1 do editor de C/SGDK).
// Mostra a projeção de código da instância selecionada, região por node, e envia cada
// edição como transação: o modelo (cena/grafo) continua sendo a única fonte de verdade.
// O editor profissional (Monaco, clangd, vista Dividido) pertence ao incremento 2.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bindingRegion,
  buildCodeEditTransaction,
  regionText,
  type CodeBinding,
  type CodeDocument,
  type CodeEditScope,
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
  binding: CodeBinding;
  draft: string | null;
  scope: CodeEditScope;
  onResult: (message: string) => void;
}) {
  const projected = regionText(document, binding) ?? "";
  const [text, setText] = useState(draft ?? projected);
  const [busy, setBusy] = useState(false);
  // Nova projeção (ou rascunho) substitui o texto local: o modelo é a fonte.
  useEffect(() => setText(draft ?? projected), [draft, projected]);

  const apply = useCallback(async () => {
    if (busy || text === projected) return;
    setBusy(true);
    try {
      const outcome = await submitCodeEdit(document, buildCodeEditTransaction(document, binding, text, scope));
      onResult(outcome.kind === "discarded" ? outcome.reason : outcome.receipt.message);
    } catch (error) {
      onResult(`Análise indisponível: ${String(error)}. O texto continua aqui; nada foi alterado no modelo.`);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, document, onResult, projected, scope, text]);

  const region = bindingRegion(binding);
  const id = `code-region-${binding.node_id}`;
  return (
    <section data-testid={id} className="rounded border border-[#313244] bg-[#181825]">
      <header className="flex items-center justify-between gap-2 border-b border-[#313244] px-2 py-1 text-[11px]">
        <label htmlFor={`${id}-text`} className="min-w-0 truncate font-semibold text-[#cdd6f4]">
          {stageLabel(binding.semantic_stage)} <span className="font-mono font-normal text-[#7f849c]">{binding.node_id}</span>
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
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void apply(); }
          if (event.key === "Escape") setText(draft ?? projected);
        }}
        className="block w-full resize-y bg-[#11111b] px-2 py-1 font-mono text-xs text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa]"
      />
      <footer className="flex items-center justify-end gap-2 px-2 py-1 text-[11px]">
        <span className="mr-auto text-[#7f849c]">Ctrl+Enter aplica · Esc descarta</span>
        <button type="button" data-testid={`${id}-apply`} disabled={busy || text === projected} onClick={() => void apply()}
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
        {entity && document && regions.length === 0 ? (
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
