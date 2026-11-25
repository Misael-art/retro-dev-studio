import { useState } from "react";
import type { GraphNode, NodeGraph, NodeType } from "../../core/nodegraph/nodeTypes";

const field = "min-w-0 rounded border border-[#45475a] bg-[#11111b] px-1 py-1";
const slotTypes: Array<{ type: NodeType; label: string }> = [
  { type: "action_sound", label: "Som" },
  { type: "palette_swap", label: "Brilho por paleta" },
  { type: "sprite_anim", label: "Animação" },
  { type: "var_set", label: "Contador" },
  { type: "set_animation_state", label: "Estado da animação" },
];

type Props = {
  graph: NodeGraph;
  palettes: readonly { id?: string; name?: string }[];
  targets: readonly { id: string; name: string }[];
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
        data-testid={"event-sequence-grip-" + slot} min={0} max={axis} value={Math.max(0, draft ?? value)}
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

export default function EventSequencePanel({ graph, palettes, targets, selected, onCreate, onSelectNode, onParam, onAddAction }: Props) {
  const [sequenceId, setSequenceId] = useState("");
  const [portId, setPortId] = useState("");
  const sequences = graph.nodes.filter((node) => node.type === "timeline_sequence");
  const sequence = selected?.type === "timeline_sequence" ? selected
    : sequences.find((node) => node.id === sequenceId) ?? sequences[0];
  const freePorts = selected?.outputs.filter((port) => port.kind === "exec"
    && !graph.edges.some((edge) => edge.fromNode === selected.id && edge.fromPort === port.id)) ?? [];
  const port = freePorts.find((candidate) => candidate.id === portId) ?? freePorts[0];
  const delays = [0, 1, 2, 3].map((slot) => Number(sequence?.params["slot_" + slot + "_delay"] ?? -1));
  const axis = Math.max(120, ...delays);
  const incoming = graph.edges.find((edge) => edge.toNode === sequence?.id && edge.toPort === "exec");
  const source = graph.nodes.find((node) => node.id === incoming?.fromNode);
  return (
    <details data-testid="event-sequence-composer" className="rounded border border-[#313244] bg-[#11111b] p-2 text-[11px]">
      <summary className="cursor-pointer font-semibold text-[#89b4fa]">Compositor de eventos</summary>
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
            <label>Sequência
              <select data-testid="event-sequence-picker" className={field + " ml-1"} value={sequence.id}
                onChange={(event) => { setSequenceId(event.target.value); onSelectNode(event.target.value); }}>
                {sequences.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}
              </select>
            </label>
            <label>Execução
              <select data-testid="event-sequence-mode" className={field + " ml-1"} value={sequence.params.run_mode === "event" ? "event" : "continuous"}
                onChange={(event) => onParam(sequence.id, "run_mode", event.target.value)}>
                <option value="event">Ao receber um novo disparo</option>
                <option value="continuous">Contador da sequência existente</option>
              </select>
            </label>
            <p>{source ? "Disparo por " + source.label : "Conecte uma saída de execução ao disparo."} Use −1 para desativar uma etapa.</p>
            {delays.map((delay, slot) => {
              const edge = graph.edges.find((item) => item.fromNode === sequence.id && item.fromPort === "slot_" + slot);
              const action = graph.nodes.find((node) => node.id === edge?.toNode);
              return (
                <div key={slot} className="grid gap-1 rounded border border-[#313244] p-1">
                  {action ? (
                    <button type="button" className="text-left text-[#94e2d5]" onClick={() => onSelectNode(action.id)}>
                      {slot + 1}. {action.label}
                      {action.params.sfx ? " · " + action.params.sfx : ""}
                    </button>
                  ) : (
                    <select data-testid={"event-sequence-action-" + slot} className={field}
                      aria-label={"Escolher ação da etapa " + (slot + 1)} value=""
                      onChange={(event) => { if (event.target.value) onAddAction(sequence, slot, event.target.value as NodeType); }}>
                      <option value="">{slot + 1}. Adicionar ação</option>
                      {slotTypes.map(({ type, label }) => <option key={type} value={type}>{label}</option>)}
                    </select>
                  )}
                  {action?.type === "palette_swap" && action.params.trigger_mode === "flow" && (
                    <div className="grid gap-1">
                      <label className="grid gap-1">Alvo do brilho
                        <select data-testid={"event-sequence-light-target-" + slot} className={field} value={action.params.target}
                          onChange={(event) => onParam(action.id, "target", event.target.value)}>
                          <option value="self">Este ator</option>
                          {targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1">Paleta temporária
                        <select data-testid={"event-sequence-palette-" + slot} className={field} value={action.params.palette}
                          onChange={(event) => onParam(action.id, "palette", event.target.value)}>
                          <option value="">Escolha uma paleta do projeto</option>
                          {palettes.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.name ?? item.id}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  <Delay key={sequence.id + "/" + slot} value={delay} axis={axis} slot={slot}
                    onEdit={(next) => { if (next !== delay) onParam(sequence.id, "slot_" + slot + "_delay", next); }} />
                </div>
              );
            })}
          </>
        ) : <p>Selecione um nó com saída livre para criar a primeira resposta.</p>}
      </div>
    </details>
  );
}
