import type { GraphNode, NodeGraph } from "./nodeTypes";
import { describeNodeAction } from "./nodeCatalog";

export type SequenceStep = { sequence: GraphNode; slot: number; tick: number };

// A destination can be shared by two responses. Retain each incoming slot.
export function sequenceSteps(graph: NodeGraph) {
  const sequences = new Map(graph.nodes.filter(node => node.type === "timeline_sequence").map(node => [node.id, node]));
  const steps = new Map<string, SequenceStep[]>();
  for (const edge of graph.edges) {
    const sequence = sequences.get(edge.fromNode);
    const slot = /^slot_([0-3])$/.exec(edge.fromPort);
    if (!sequence || !slot || edge.toPort !== "exec") continue;
    const step = { sequence, slot: Number(slot[1]), tick: Number(sequence.params[edge.fromPort + "_delay"] ?? -1) };
    const entries = steps.get(edge.toNode) ?? [];
    entries.push(step);
    steps.set(edge.toNode, entries);
  }
  return steps;
}

export function actionTitle(graph: NodeGraph, node: GraphNode, names: ReadonlyMap<string, string>, steps: SequenceStep[]) {
  const p = node.params;
  const name = (key: string) => names.get(String(p[key])) ?? String(p[key] ?? "?");
  if (node.type === "condition_overlap" && !Number(p.probe_dx) && !Number(p.probe_dy)) return name("a") + " toca " + name("b") + "?";
  if (node.type === "palette_swap" && p.trigger_mode === "flow") return "Brilho por " + p.frames + " ticks";
  if (node.type === "action_sound" && steps.length === 1) {
    const { tick } = steps[0];
    return tick < 0 ? "Som desativado nesta etapa" : tick === 0 ? "Tocar som no disparo" : "Tocar som após " + tick + " ticks";
  }
  if (node.type === "var_set") {
    const input = (id: string, port: string) => {
      const edge = graph.edges.find(item => item.toNode === id && item.toPort === port);
      return graph.nodes.find(item => item.id === edge?.fromNode);
    };
    const sum = input(node.id, "value");
    if (sum?.type === "logic_math" && sum.params.operator === "+" && !input(sum.id, "b")) {
      const source = input(sum.id, "a");
      if (source?.type === "var_get" && source.params.var_name === p.var_name) {
        return "Somar " + sum.params.b + " · " + (p.counter_label ?? p.var_name);
      }
    }
  }
  return node.label || describeNodeAction(node);
}

/** An unused conditional alternative or a disabled slot deliberately ends here. */
export function idleExecutionOutput(node: GraphNode, port: string, connected: ReadonlySet<string>) {
  if (node.type === "timeline_sequence" && /^slot_[0-3]$/.test(port) && Number(node.params[port + "_delay"] ?? -1) < 0) return "disabled";
  if ((port === "false" && connected.has("true")) || (port === "true" && connected.has("false"))) return "terminal";
  return null;
}
