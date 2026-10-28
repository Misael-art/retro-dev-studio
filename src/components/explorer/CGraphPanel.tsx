import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSgdkCGraphFile,
  updateSgdkCGraphNode,
  type CGraphFile,
  type CGraphNode,
} from "../../core/ipc/projectService";

interface CGraphPanelProps {
  projectDir: string;
  sourceFile: string;
}

const KIND_LABEL: Record<string, string> = {
  function_definition: "função",
  if_statement: "se",
  else_clause: "senão",
  switch_statement: "máquina de estados",
  case_statement: "estado",
  while_statement: "laço",
  for_statement: "laço",
  do_statement: "laço",
  compound_statement: "bloco",
  declaration: "declaração",
  expression_statement: "ação",
  return_statement: "retorno",
  preproc_include: "include",
  preproc_def: "define",
};

function nodeText(node: CGraphNode): string {
  return (node.text ?? "") + (node.children ?? []).map(nodeText).join("");
}

/** Itens visíveis: `syntax` é pontuação/espaço e fica oculto (continua no C gerado). */
function visibleChildren(node: CGraphNode): CGraphNode[] {
  return (node.children ?? []).filter((child) => child.role !== "syntax");
}

function NodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: CGraphNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: CGraphNode) => void;
}) {
  const children = visibleChildren(node);
  const [open, setOpen] = useState(depth < 1);
  const selected = selectedId === node.id;
  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded px-1 py-0.5 ${selected ? "bg-[#1e3a5f]" : "hover:bg-[#111827]"}`}
        style={{ paddingLeft: depth * 12 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={open ? "Recolher" : "Expandir"}
            className="w-4 text-[#64748b]"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          data-testid={`cgraph-node-${node.id}`}
          className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-[#cbd5e1]"
          onClick={() => onSelect(node)}
        >
          <span className="mr-2 text-[10px] uppercase tracking-wide text-[#7dd3fc]">
            {KIND_LABEL[node.kind] ?? node.kind}
          </span>
          {node.function ?? node.label}
          <span className="ml-2 text-[10px] text-[#475569]">L{node.start_line}</span>
        </button>
      </div>
      {open && children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CGraphPanel({ projectDir, sourceFile }: CGraphPanelProps) {
  const [graph, setGraph] = useState<CGraphFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CGraphNode | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGraph(null);
    setSelected(null);
    setError(null);
    getSgdkCGraphFile(projectDir, sourceFile)
      .then((result) => {
        if (!cancelled) setGraph(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [projectDir, sourceFile]);

  const roots = useMemo(() => (graph ? visibleChildren(graph.root) : []), [graph]);

  const select = useCallback((node: CGraphNode) => {
    setSelected(node);
    setDraft(nodeText(node));
  }, []);

  const apply = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateSgdkCGraphNode(projectDir, sourceFile, selected.id, draft);
      setGraph(updated);
      setSelected(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }, [draft, projectDir, selected, sourceFile]);

  return (
    <div data-testid="cgraph-panel" className="rounded-3xl border border-[#1f2937] bg-[#0b1120]/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">Lógica C em nodes</div>
        <span className="rounded-full border border-[#f9e2af]/30 bg-[#f9e2af]/10 px-2 py-0.5 text-[10px] text-[#f9e2af]">
          Experimental
        </span>
      </div>
      <p className="mt-2 text-[12px] text-[#94a3b8]">
        Cada node é um trecho do C original. Editar e aplicar muda o C que o próximo Build &amp; Run compila (em
        cópia; a raiz original não é alterada).
      </p>
      {graph && graph.parse_error_nodes > 0 ? (
        <p className="mt-2 text-[11px] text-[#f9e2af]">
          {graph.parse_error_nodes} trecho(s) que o parser não estruturou ficam como C bruto (sem perda de código).
        </p>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-2xl border border-[#f38ba8]/35 bg-[#f38ba8]/10 px-4 py-3 text-[12px] text-[#fecdd3]">
          {error}
        </div>
      ) : null}
      {graph ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ul className="max-h-[420px] overflow-auto rounded-2xl border border-[#1f2937] bg-[#020617] p-2">
            {roots.map((node) => (
              <NodeRow key={node.id} node={node} depth={0} selectedId={selected?.id ?? null} onSelect={select} />
            ))}
          </ul>
          {selected ? (
            <div className="flex flex-col gap-2">
              <div className="font-mono text-[11px] text-[#64748b]">
                {selected.kind} · L{selected.start_line}–{selected.end_line}
                {selected.calls && selected.calls.length > 0 ? ` · chama ${selected.calls.join(", ")}` : ""}
              </div>
              <textarea
                aria-label="Código C do node"
                className="min-h-[300px] rounded-2xl border border-[#1f2937] bg-[#020617] p-3 font-mono text-[11px] text-[#e4e4e7]"
                value={draft}
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                disabled={busy || draft === nodeText(selected)}
                className="self-end rounded-xl border border-[#89b4fa]/40 bg-[#89b4fa]/10 px-3 py-1.5 text-[12px] text-[#89b4fa] disabled:opacity-40"
                onClick={() => void apply()}
              >
                Aplicar ao C
              </button>
            </div>
          ) : (
            <div className="text-[12px] text-[#64748b]">Selecione um node para ver e editar o C.</div>
          )}
        </div>
      ) : !error ? (
        <div className="mt-3 text-[12px] text-[#89b4fa]">Carregando grafo C...</div>
      ) : null}
    </div>
  );
}
