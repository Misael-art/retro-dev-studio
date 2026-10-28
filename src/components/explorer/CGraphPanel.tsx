import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSgdkCGraphFile,
  getSgdkCGraphIndex,
  updateSgdkCGraphBlock,
  updateSgdkCGraphNode,
  type CBlock,
  type CGraphFile,
  type CGraphIndex,
  type CGraphNode,
  type CStateTransition,
} from "../../core/ipc/projectService";

interface CGraphPanelProps {
  projectDir: string;
  sourceFile: string;
  /** Node a selecionar ao abrir (ex.: ponto do C que usa o sprite selecionado). */
  focusNodeId?: string | null;
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

const ORIGIN_LABEL: Record<string, string> = {
  local: "guarda local",
  caller: "guarda no chamador",
  unguarded: "sem guarda de estado",
  unknown: "sem chamador conhecido",
};

const LINK_LABEL: Record<string, string> = {
  input: "comando",
  timer: "timer",
  collision: "colisão",
  state: "estado",
  event: "evento",
  action_sound: "som",
  scene_change: "cena",
  sprite_anim: "sprite",
  sprite_move: "sprite",
  sprite_op: "sprite",
  spawn_entity: "sprite",
  destroy_entity: "sprite",
  scroll_tilemap: "scroll",
  palette_op: "paleta",
  vdp_op: "vdp",
  dma_budget: "dma",
  input_held: "comando",
  system_op: "sistema",
};

function TransitionDetail({
  transition,
  onSelect,
}: {
  transition: CStateTransition;
  onSelect: (id: string) => void;
}) {
  const links = [...(transition.conditions ?? []), ...(transition.effects ?? [])];
  return (
    <li data-testid="cgraph-transition" className="rounded-lg border border-[#313244] px-2 py-1">
      <button
        type="button"
        className="font-mono text-[10px] text-[#cbd5e1] hover:text-[#89b4fa]"
        title={`L${transition.line}`}
        onClick={() => onSelect(transition.node_id)}
      >
        {transition.from === "*" ? "qualquer" : transition.from} → {transition.to}
      </button>
      {transition.origin ? (
        <span className="ml-2 text-[9px] uppercase tracking-wide text-[#7f849c]">
          {ORIGIN_LABEL[transition.origin] ?? transition.origin}
        </span>
      ) : null}
      {transition.via && transition.via.length > 0 ? (
        <div className="mt-0.5 font-mono text-[9px] text-[#64748b]">via {transition.via.join(" ← ")}</div>
      ) : null}
      {links.length > 0 ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {links.map((link, index) => (
            <li key={`${link.category}-${index}`}>
              <button
                type="button"
                disabled={!link.node_id}
                className="rounded border border-[#1f2937] px-1.5 py-0.5 text-left font-mono text-[9px] text-[#a6adc8] enabled:hover:border-[#89b4fa]"
                onClick={() => link.node_id && onSelect(link.node_id)}
              >
                <span className="mr-1 uppercase text-[#f9e2af]">{LINK_LABEL[link.category] ?? link.category}</span>
                {link.text.length > 60 ? `${link.text.slice(0, 60)}…` : link.text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function nodeText(node: CGraphNode): string {
  return (node.text ?? "") + (node.children ?? []).map(nodeText).join("");
}

/** Itens visíveis: `syntax` é pontuação/espaço e fica oculto (continua no C gerado). */
function visibleChildren(node: CGraphNode): CGraphNode[] {
  return (node.children ?? []).filter((child) => child.role !== "syntax");
}

function findNode(node: CGraphNode, id: string): CGraphNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function containsId(node: CGraphNode, id: string): boolean {
  return id === node.id || id.startsWith(`${node.id}.`);
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
  const expanded = open || (selectedId !== null && !selected && containsId(node, selectedId));
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView?.({ block: "center" });
  }, [selected]);
  return (
    <li>
      <div
        ref={rowRef}
        data-selected={selected ? "true" : undefined}
        className={`flex items-center gap-1 rounded px-1 py-0.5 ${selected ? "bg-[#1e3a5f]" : "hover:bg-[#111827]"}`}
        style={{ paddingLeft: depth * 12 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={expanded ? "Recolher" : "Expandir"}
            className="w-4 text-[#64748b]"
            onClick={() => setOpen(!expanded)}
          >
            {expanded ? "▾" : "▸"}
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
          <span
            className={`mr-2 text-[10px] uppercase tracking-wide ${node.block ? "text-[#a6e3a1]" : "text-[#7dd3fc]"}`}
          >
            {node.block?.node_type ?? KIND_LABEL[node.kind] ?? node.kind}
          </span>
          {node.function ?? node.label}
          <span className="ml-2 text-[10px] text-[#475569]">L{node.start_line}</span>
        </button>
      </div>
      {expanded && children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function BlockEditor({
  block,
  busy,
  onApply,
}: {
  block: CBlock;
  busy: boolean;
  onApply: (block: CBlock) => void;
}) {
  const [draft, setDraft] = useState<CBlock>(block);
  useEffect(() => setDraft(block), [block]);
  const changed = JSON.stringify(draft) !== JSON.stringify(block);
  const isCall = block.form === "call";
  return (
    <div data-testid="cgraph-block-editor" className="rounded-2xl border border-[#a6e3a1]/30 bg-[#a6e3a1]/5 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6e3a1]">
        Bloco {block.node_type}
      </div>
      <label className="mt-2 block text-[11px] text-[#94a3b8]">
        {isCall ? "Função" : "Variável"}
        <input
          aria-label={isCall ? "Função do bloco" : "Variável do bloco"}
          className="mt-1 w-full rounded-lg border border-[#1f2937] bg-[#020617] px-2 py-1 font-mono text-[11px] text-[#e4e4e7]"
          value={draft.target}
          onChange={(event) => setDraft({ ...draft, target: event.target.value })}
        />
      </label>
      {draft.args.map((arg, index) => (
        <label key={index} className="mt-2 block text-[11px] text-[#94a3b8]">
          {isCall ? `Argumento ${index + 1}` : `Valor (${block.operator})`}
          <input
            aria-label={isCall ? `Argumento ${index + 1}` : "Valor do bloco"}
            className="mt-1 w-full rounded-lg border border-[#1f2937] bg-[#020617] px-2 py-1 font-mono text-[11px] text-[#e4e4e7]"
            value={arg}
            onChange={(event) => {
              const args = [...draft.args];
              args[index] = event.target.value;
              setDraft({ ...draft, args });
            }}
          />
        </label>
      ))}
      <button
        type="button"
        disabled={busy || !changed || draft.target.trim() === ""}
        className="mt-3 rounded-xl border border-[#a6e3a1]/40 bg-[#a6e3a1]/10 px-3 py-1.5 text-[12px] text-[#a6e3a1] disabled:opacity-40"
        onClick={() => onApply(draft)}
      >
        Aplicar bloco
      </button>
    </div>
  );
}

export function CGraphPanel({ projectDir, sourceFile, focusNodeId = null }: CGraphPanelProps) {
  const [graph, setGraph] = useState<CGraphFile | null>(null);
  const [index, setIndex] = useState<CGraphIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGraph(null);
    setSelectedId(null);
    setError(null);
    getSgdkCGraphFile(projectDir, sourceFile)
      .then((result) => {
        if (!cancelled) setGraph(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    getSgdkCGraphIndex(projectDir)
      .then((result) => {
        if (!cancelled) setIndex(result);
      })
      .catch(() => {
        if (!cancelled) setIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectDir, sourceFile]);

  const roots = useMemo(() => (graph ? visibleChildren(graph.root) : []), [graph]);
  const selected = useMemo(
    () => (graph && selectedId ? findNode(graph.root, selectedId) : null),
    [graph, selectedId]
  );
  const machines = useMemo(
    () => (index?.state_machines ?? []).filter((machine) => machine.file === sourceFile),
    [index, sourceFile]
  );

  const select = useCallback((node: CGraphNode) => {
    setSelectedId(node.id);
    setDraft(nodeText(node));
  }, []);

  const selectById = useCallback(
    (id: string) => {
      const node = graph ? findNode(graph.root, id) : null;
      if (node) select(node);
    },
    [graph, select]
  );

  useEffect(() => {
    if (focusNodeId) selectById(focusNodeId);
  }, [focusNodeId, selectById]);

  const run = useCallback(
    async (action: () => Promise<CGraphFile>) => {
      setBusy(true);
      setError(null);
      try {
        setGraph(await action());
        setSelectedId(null);
        // O backend recalcula funções/FSMs após cada edição.
        setIndex(await getSgdkCGraphIndex(projectDir));
      } catch (reason) {
        setError(String(reason));
      } finally {
        setBusy(false);
      }
    },
    [projectDir]
  );

  return (
    <div data-testid="cgraph-panel" className="rounded-3xl border border-[#1f2937] bg-[#0b1120]/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">Lógica C em nodes</div>
        <span className="rounded-full border border-[#f9e2af]/30 bg-[#f9e2af]/10 px-2 py-0.5 text-[10px] text-[#f9e2af]">
          Experimental
        </span>
      </div>
      <p className="mt-2 text-[12px] text-[#94a3b8]">
        Cada node é um trecho do C original. Blocos (verde) editam chamadas e atribuições por campos; os demais
        nodes editam o C direto. O próximo Build &amp; Run compila o resultado em cópia; a raiz original não é
        alterada.
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
      {machines.length > 0 ? (
        <div data-testid="cgraph-state-machines" className="mt-3 space-y-2">
          {machines.map((machine) => (
            <div key={machine.node_id} className="rounded-2xl border border-[#1f2937] bg-[#020617] p-3">
              <button
                type="button"
                className="font-mono text-[11px] text-[#f9e2af]"
                onClick={() => selectById(machine.node_id)}
              >
                FSM {machine.subject}
                {machine.function ? ` · ${machine.function}()` : ""} · L{machine.line}
              </button>
              <div className="mt-1 text-[11px] text-[#94a3b8]">Estados: {machine.states.join(", ")}</div>
              {machine.transitions.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {machine.transitions.map((transition) => (
                    <TransitionDetail
                      key={`${transition.node_id}-${transition.to}`}
                      transition={transition}
                      onSelect={selectById}
                    />
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-[10px] text-[#64748b]">Sem transição por atribuição detectada.</div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {graph ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ul className="max-h-[420px] overflow-auto rounded-2xl border border-[#1f2937] bg-[#020617] p-2">
            {roots.map((node) => (
              <NodeRow key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={select} />
            ))}
          </ul>
          {selected ? (
            <div className="flex flex-col gap-2">
              <div className="font-mono text-[11px] text-[#64748b]">
                {selected.kind} · L{selected.start_line}–{selected.end_line}
                {selected.calls && selected.calls.length > 0 ? ` · chama ${selected.calls.join(", ")}` : ""}
              </div>
              {selected.block ? (
                <BlockEditor
                  block={selected.block}
                  busy={busy}
                  onApply={(block) =>
                    void run(() => updateSgdkCGraphBlock(projectDir, sourceFile, selected.id, block))
                  }
                />
              ) : null}
              <textarea
                aria-label="Código C do node"
                className="min-h-[200px] rounded-2xl border border-[#1f2937] bg-[#020617] p-3 font-mono text-[11px] text-[#e4e4e7]"
                value={draft}
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                disabled={busy || draft === nodeText(selected)}
                className="self-end rounded-xl border border-[#89b4fa]/40 bg-[#89b4fa]/10 px-3 py-1.5 text-[12px] text-[#89b4fa] disabled:opacity-40"
                onClick={() => void run(() => updateSgdkCGraphNode(projectDir, sourceFile, selected.id, draft))}
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
