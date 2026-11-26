import { useEffect, useState, type Ref } from "react";
import type { GraphNode, NodeGraph, NodeType } from "../../core/nodegraph/nodeTypes";
import { GRAPH_ROLES, graphRole } from "../../core/nodegraph/nodeCatalog";
import type { SequenceStep } from "../../core/nodegraph/eventSchedule";

const field = "min-w-0 max-w-full rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] px-1 py-1 text-[var(--rds-text-primary)]";
const slotTypes: Array<{ type: NodeType; label: string }> = [
  { type: "action_sound", label: "Som" },
  { type: "palette_swap", label: "Brilho por paleta" },
  { type: "set_animation_state", label: "Trocar animação" },
  { type: "var_set", label: "Contador" },
];

type Props = {
  selectedSteps: readonly SequenceStep[];
  onOpen: (sequence: GraphNode) => void;
  panelRef: Ref<HTMLDetailsElement>;
  graph: NodeGraph;
  palettes: readonly { id?: string; name?: string }[];
  targets: readonly { id: string; name: string; animations: string[] }[];
  selected: GraphNode | null;
  onCreate: (trigger: GraphNode, port: string) => void;
  onSelectNode: (node: string) => void;
  onParam: (id: string, key: string, value: number | string) => void;
  onAddAction: (sequence: GraphNode, slot: number, kind: NodeType) => void;
};

function Delay({ value, axis, slot, onEdit }: { value: number; axis: number; slot: number; onEdit: (next: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const [numeric, setNumeric] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-[1fr_58px] items-center gap-2">
      <input type="range" aria-label={"Posição da etapa " + (slot + 1)}
        data-testid={"event-sequence-grip-" + slot} min={0} max={Math.min(axis, 3600)} value={Math.max(0, draft ?? value)}
        onChange={(event) => setDraft(event.currentTarget.valueAsNumber)}
        onPointerUp={(event) => { onEdit(event.currentTarget.valueAsNumber); setDraft(null); }}
        onPointerCancel={() => setDraft(null)}
        onKeyUp={(event) => {
          if (draft !== null && event.key !== "Tab") { onEdit(draft); setDraft(null); }
        }}
        onBlur={() => { if (draft !== null) { onEdit(draft); setDraft(null); } }} />
      <input className={field + " font-mono"} aria-label={"Ticks da etapa " + (slot + 1)}
        data-testid={"event-sequence-ticks-" + slot} type="number" min={-1} max={3600} value={numeric ?? draft ?? value}
        onChange={(event) => setNumeric(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setNumeric(null);
        }}
        onBlur={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (numeric !== null && Number.isInteger(next) && next >= -1 && next <= 3600) onEdit(next);
          setNumeric(null);
        }} />
    </div>
  );
}

function ActionSettings({ action, suffix, targets, palettes, onParam }: Pick<Props, "targets" | "palettes" | "onParam"> & {
  action: GraphNode; suffix: string | number;
}) {
  const animationTarget = action.type === "set_animation_state" ? targets.find(target => target.id === action.params.target) : undefined;
  return <>
    {action.type === "palette_swap" && action.params.trigger_mode === "flow" && (
      <div className="col-span-2 flex flex-wrap gap-2">
        <label className="grid gap-1">Alvo do brilho
          <select data-testid={"event-sequence-light-target-" + suffix} className={field} value={action.params.target}
            onChange={(event) => onParam(action.id, "target", event.target.value)}>
            <option value="self">Este ator</option>
            {targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Paleta temporária
          <select data-testid={"event-sequence-palette-" + suffix} className={field} value={action.params.palette}
            onChange={(event) => onParam(action.id, "palette", event.target.value)}>
            <option value="">Escolha uma paleta do projeto</option>
            {palettes.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.name ?? item.id}</option>)}
          </select>
        </label>
      </div>
    )}
    {action.type === "set_animation_state" && (
      <div className="col-span-2 flex flex-wrap gap-2">
        <label className="grid gap-1">Ator da animação
          <select data-testid={"event-sequence-animation-target-" + suffix} className={field} value={animationTarget?.id ?? ""}
            onChange={(event) => onParam(action.id, "target", event.target.value)}>
            <option value="" disabled>Escolha um ator</option>
            {targets.filter((item) => item.animations.length > 0).map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {animationTarget && <label className="grid gap-1">Animação da resposta
          <select data-testid={"event-sequence-animation-" + suffix} className={field} value={String(action.params.state ?? "")}
            onChange={(event) => onParam(action.id, "state", event.target.value)}>
            {animationTarget.animations.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>}
      </div>
    )}
  </>;
}

export default function EventSequencePanel({ panelRef, graph, palettes, targets, selected, selectedSteps, onOpen, onCreate, onSelectNode, onParam, onAddAction }: Props) {
  const [sequenceId, setSequenceId] = useState("");
  const [portId, setPortId] = useState("");
  const sequences = graph.nodes.filter((node) => node.type === "timeline_sequence");
  const remembered = sequences.find(node => node.id === sequenceId);
  const linked = selectedSteps.find(step => step.sequence.id === sequenceId) ?? selectedSteps[0];
  const sequence = selected?.type === "timeline_sequence" ? selected
    : linked?.sequence ?? remembered ?? sequences[0];
  const activeId = sequence?.id;
  useEffect(() => { if (activeId) setSequenceId(activeId); }, [activeId]);
  const freePorts = selected?.outputs.filter((port) => port.kind === "exec"
    && !graph.edges.some((edge) => edge.fromNode === selected.id && edge.fromPort === port.id)) ?? [];
  const port = freePorts.find((candidate) => candidate.id === portId) ?? freePorts[0];
  const delays = [0, 1, 2, 3].map((slot) => Number(sequence?.params["slot_" + slot + "_delay"] ?? -1));
  const axis = Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, ...delays))));
  const ticks = [0, 1, 2, 3, 4].map(n => n * Math.min(axis, 3600) / 4);
  const triggers = new Set(graph.edges.filter(edge => edge.toNode === sequence?.id && edge.toPort === "exec").map(edge => edge.fromNode));
  const sourceNames = graph.nodes.filter(node => triggers.has(node.id)).map(node => node.label);
  return (
    <details ref={panelRef} onToggle={event => { if (event.currentTarget.open && sequence) onOpen(sequence); }} data-testid="event-sequence-composer" className="max-h-[40%] shrink-0 overflow-auto border-t border-[var(--rds-border-default)] bg-[var(--rds-surface-panel)] px-3 py-1 text-[11px] text-[var(--rds-text-primary)]">
      <summary className="cursor-pointer font-semibold text-[#89b4fa]">Compositor de eventos · régua de ticks</summary>
      <div className="mt-2 grid gap-2">
        {selected && selected.type !== "timeline_sequence" && port && (
          <div className="flex flex-wrap gap-1">
            <select aria-label="Saída que dispara a resposta" className={field} value={port.id} onChange={(event) => setPortId(event.target.value)}>
              {freePorts.map((item) => <option key={item.id} value={item.id}>{selected.label} · {item.label}</option>)}
            </select>
            <button type="button" data-testid="event-sequence-create" className={field}
              onClick={() => onCreate(selected, port.id)}>Adicionar resposta</button>
          </div>
        )}
        {sequence ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><label>Sequência
              <select data-testid="event-sequence-picker" className={field + " ml-1"} value={sequence.id}
                onChange={(event) => { setSequenceId(event.target.value); onSelectNode(event.target.value); }}>
                {sequences.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>Execução
              <select data-testid="event-sequence-mode" className={field + " ml-1"} value={sequence.params.run_mode === "event" ? "event" : "continuous"}
                onChange={(event) => onParam(sequence.id, "run_mode", event.target.value)}>
                <option value="event">Ao receber um novo disparo</option>
                <option value="continuous">Contador da sequência existente</option>
              </select>
            </label>
            </div><p>{sourceNames.length ? "Disparo por " + sourceNames.join(", ") : "Conecte uma saída de execução ao disparo."} Use −1 para desativar. O tick é programado no grafo. O quadro apresentado depende do VBlank.</p>
            <div className="grid grid-cols-[minmax(7rem,28%)_1fr_58px] items-end gap-2 px-1 text-[var(--rds-text-secondary)]">
              <span>Etapa</span><div className="flex justify-between font-mono">{ticks.map(tick => <span key={tick}>{tick}</span>)}</div><span>Ticks</span>
            </div>
            {delays.map((delay, slot) => {
              const actions = graph.edges
                .filter(edge => edge.fromNode === sequence.id && edge.fromPort === "slot_" + slot)
                .map(edge => graph.nodes.find(node => node.id === edge.toNode))
                .filter((node): node is GraphNode => !!node);
              const simultaneous = delay >= 0 && (actions.length > 1 || delays.some((time, index) =>
                index !== slot && time === delay && graph.edges.some(edge => edge.fromNode === sequence.id && edge.fromPort === "slot_" + index)));
              return (
                <div key={sequence.id + "/" + slot} data-selected={actions.some(action => action.id === selected?.id) ? "true" : undefined}
                  className="grid grid-cols-[minmax(7rem,28%)_1fr] items-center gap-x-2 rounded border border-[var(--rds-border-default)] p-1 data-[selected=true]:border-blue-400">
                  <div className="flex flex-wrap items-center gap-1">
                  {actions.length ? actions.map((action, index) => {
                    const role = GRAPH_ROLES[graphRole(action)];
                    return <button key={action.id} type="button" aria-pressed={selected?.id === action.id}
                      data-testid={"event-sequence-select-" + slot + (index ? "-" + action.id : "")}
                      style={{ backgroundColor: role.color, color: "white" }}
                      className="rounded px-2 py-1 text-left font-semibold aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-1"
                      onClick={() => onSelectNode(action.id)}>
                      {slot + 1}. {action.label}{action.params.sfx ? " · " + action.params.sfx : ""}
                    </button>;
                  }) : (
                    <select data-testid={"event-sequence-action-" + slot} className={field}
                      aria-label={"Escolher ação da etapa " + (slot + 1)} value=""
                      onChange={(event) => { if (event.target.value) onAddAction(sequence, slot, event.target.value as NodeType); }}>
                      <option value="">{slot + 1}. Adicionar ação</option>
                      {slotTypes.map(({ type, label }) => <option key={type} value={type}>{label}</option>)}
                    </select>
                  )}
                  {simultaneous && <small>Simultâneo</small>}
                  </div>
                  <Delay key={sequence.id + "/" + slot} value={delay} axis={axis} slot={slot}
                    onEdit={(next) => { if (next !== delay) onParam(sequence.id, "slot_" + slot + "_delay", next); }} />
                  {actions.map((action, index) => <ActionSettings key={action.id} action={action}
                    suffix={index ? slot + "-" + action.id : slot} targets={targets} palettes={palettes} onParam={onParam} />)}
                </div>
              );
            })}
          </>
        ) : <p>Selecione um nó com saída livre para criar a primeira resposta.</p>}
      </div>
    </details>
  );
}
