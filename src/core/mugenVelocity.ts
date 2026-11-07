// Velocidade horizontal dos estados de um personagem importado de MUGEN (perfil mugen.character.v1,
// Experimental). Contrato (crates/rex-mugen/CONTRACT.md, «Locomoção horizontal»):
// * unidade: pixels por tick de 1/60 s; x positivo = direita (facing fixo à direita);
// * representação na ROM: Q8.8 (múltiplos de 1/256 px/tick), |v| <= 127,99609375;
// * literal decimal apenas; o que não for múltiplo de 1/256 é arredondado ao mais próximo
//   (metade para longe do zero) e o aviso é explícito;
// * a fonte é o nó `set_velocity` (perfil mugen) do grafo da entidade (`components.logic.graph`).
// Esta camada espelha `parse_velocity_q8` do backend; o gerador revalida no build.
import type { Entity } from "./ipc/sceneService";

export const MUGEN_PROFILE_ID = "mugen.character.v1";
export const VELOCITY_MAX_Q8 = 32767;

export type VelocityParse =
  | { ok: true; q8: number; exact: boolean; effective: string }
  | { ok: false; message: string };

/** Q8.8 -> texto decimal exato (n/256 tem no máximo 8 casas). */
export function q8ToDecimal(q8: number): string {
  const sign = q8 < 0 ? "-" : "";
  const abs = Math.abs(q8);
  const whole = Math.floor(abs / 256);
  const frac = abs % 256;
  if (frac === 0) return `${sign}${whole}`;
  const digits = ((frac * 10 ** 8) / 256).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${whole}.${digits}`;
}

export function parseVelocity(raw: string): VelocityParse {
  const text = raw.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    return {
      ok: false,
      message: `"${text}" nao e um numero decimal. Use, por exemplo, 2 ou -1.75 (sem expressoes, virgula ou expoente).`,
    };
  }
  const [, sign, intPart, fracPart = ""] = match;
  if (intPart.length > 6 || fracPart.length > 9) {
    return { ok: false, message: `"${text}" tem digitos demais (ate 6 inteiros e 9 decimais).` };
  }
  const den = 10n ** BigInt(fracPart.length);
  const scaled = BigInt(intPart + fracPart) * 256n;
  let q = scaled / den;
  const rem = scaled % den;
  if (rem !== 0n && rem * 2n >= den) q += 1n;
  if (q > BigInt(VELOCITY_MAX_Q8)) {
    return { ok: false, message: `"${text}" passa do limite: a velocidade vai de -127,99609375 a 127,99609375 px/tick.` };
  }
  const q8 = sign === "-" ? -Number(q) : Number(q);
  return { ok: true, q8, exact: rem === 0n, effective: q8ToDecimal(q8) };
}

export interface MugenVelocityState {
  stateNo: number;
  /** Literal autorado (fonte). */
  vx: string;
  controller: string;
  unknownVy: boolean;
}

interface GraphNode {
  id?: string;
  type?: string;
  params?: Record<string, unknown>;
}

function parseGraph(serialized: string | undefined): { nodes: GraphNode[]; raw: Record<string, unknown> } | null {
  if (!serialized) return null;
  try {
    const raw = JSON.parse(serialized) as Record<string, unknown>;
    return Array.isArray(raw.nodes) ? { nodes: raw.nodes as GraphNode[], raw } : null;
  } catch {
    return null;
  }
}

function isMugenVelocityNode(node: GraphNode): boolean {
  return node.type === "set_velocity" && node.params?.profile === MUGEN_PROFILE_ID;
}

/** Um item por estado (o corpo do estado; as cópias de «entrada» são mantidas em sincronia). */
export function readMugenVelocities(entity: Entity): MugenVelocityState[] {
  const graph = parseGraph(entity.components.logic?.graph);
  if (!graph) return [];
  const byState = new Map<number, MugenVelocityState>();
  for (const node of graph.nodes) {
    if (!isMugenVelocityNode(node)) continue;
    const stateNo = Number(node.params?.state_no);
    if (!Number.isInteger(stateNo) || node.params?.instance !== "body" || byState.has(stateNo)) continue;
    byState.set(stateNo, {
      stateNo,
      vx: String(node.params?.vx ?? "0"),
      controller: String(node.params?.controller ?? ""),
      unknownVy: Number(node.params?.vy ?? 0) !== 0,
    });
  }
  return [...byState.values()].sort((a, b) => a.stateNo - b.stateNo);
}

/** Novo `components.logic.graph` com o `vx` do estado trocado em todos os nós do estado (corpo e entrada). */
export function withMugenVelocity(entity: Entity, stateNo: number, vx: string): string | null {
  const logic = entity.components.logic;
  const graph = parseGraph(logic?.graph);
  if (!logic || !graph) return null;
  let touched = 0;
  const nodes = graph.nodes.map((node) => {
    if (!isMugenVelocityNode(node) || Number(node.params?.state_no) !== stateNo) return node;
    touched += 1;
    const prefix = node.params?.instance === "enter" ? "Enter " : "";
    return { ...node, label: `${prefix}VelSet x = ${vx}`, params: { ...node.params, vx } };
  });
  return touched > 0 ? JSON.stringify({ ...graph.raw, nodes }) : null;
}

/** HitDef convertido do CNS (perfil `mugen.original_chain.v2`) num `mugen_state_program`. */
export interface MugenHitDefSummary {
  controller: string;
  state: number;
  damage: number;
  hitflag: string;
  hitsStanding: boolean;
  pause: [number, number];
  source: string;
  triggers: string[];
}

export interface MugenHitTarget {
  profile: string;
  target: string;
  hitdefs: MugenHitDefSummary[];
  life: number | null;
  lifeOrigin: string | null;
}

/** Le o no `mugen_state_program` e os HitDefs do programa; `null` sem programa v2 com HitDef. */
export function readMugenHitTarget(entity: Entity): MugenHitTarget | null {
  const graph = parseGraph(entity.components.logic?.graph);
  const node = graph?.nodes.find((n) => n.type === "mugen_state_program");
  if (!node) return null;
  let program: { profile?: string; states?: Array<{ no: number; controllers?: Array<Record<string, unknown> & { id?: string; src?: { file?: string; line?: number }; all?: unknown[]; groups?: unknown[][] }> }>; target_life?: { value: number; origin: string } | null };
  try {
    program = JSON.parse(String(node.params?.program_json ?? "")) as typeof program;
  } catch {
    return null;
  }
  const hitdefs: MugenHitDefSummary[] = [];
  for (const st of program.states ?? []) {
    for (const c of st.controllers ?? []) {
      const h = c.hitdef as Record<string, unknown> | undefined;
      if (!h) continue;
      const triggers = [...(c.all ?? []), ...((c.groups ?? []) as unknown[][]).flat()] as Array<{ src?: { text?: string } }>;
      hitdefs.push({
        controller: String(c.id),
        state: st.no,
        damage: Number(h.damage),
        hitflag: String(h.hitflag),
        hitsStanding: Boolean(h.hits_standing),
        pause: [Number(h.pause_p1), Number(h.pause_p2)],
        source: `${c.src?.file ?? "?"}:${c.src?.line ?? 0}`,
        triggers: triggers.map((t) => String(t.src?.text ?? "")),
      });
    }
  }
  if (!hitdefs.length) return null;
  return {
    profile: String(program.profile ?? ""),
    target: String(node.params?.hit_target ?? ""),
    hitdefs,
    life: program.target_life?.value ?? null,
    lifeOrigin: program.target_life?.origin ?? null,
  };
}

/** Novo `components.logic.graph` com o alvo de treino do HitDef trocado (o programa nao muda). */
export function withMugenHitTarget(entity: Entity, target: string): string | null {
  const graph = parseGraph(entity.components.logic?.graph);
  if (!graph) return null;
  let touched = 0;
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "mugen_state_program") return node;
    touched += 1;
    return { ...node, params: { ...node.params, hit_target: target } };
  });
  return touched === 1 ? JSON.stringify({ ...graph.raw, nodes }) : null;
}
