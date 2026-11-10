// Linha do tempo do personagem (Experimental): edição por OCORRÊNCIA de quadro, não por imagem.
// Uma animação MUGEN guarda dados paralelos a `frames` (`frame_durations`, `mugen_frames`,
// `occurrence_ids`) e eventos ancorados em ocorrência + tick local. Toda operação aqui devolve
// uma nova AnimationDef coerente — ou um diagnóstico, sem alterar nada.
import type { AnimationDef, FrameEvent, MugenCollisionBox, SpriteAnimationHitbox } from "./ipc/sceneService";
import { effectiveDurations, parseTicks } from "./mugenAnimationTiming";

export interface TimelineOccurrence {
  id: string;
  index: number;
  image: number;
  /** Grupo/imagem de origem no SFF quando a animação veio de MUGEN. */
  source: { group: number; image: number } | null;
  ticks: number;
  /** Tick de início dentro da primeira passagem; null depois de um quadro parado. */
  startTick: number | null;
  attackBoxes: number;
  bodyBoxes: number;
  events: FrameEvent[];
}

export type TimelineResult =
  | { ok: true; def: AnimationDef }
  | { ok: false; message: string; conflicts?: string[] };

/** Identidades efetivas; projeto antigo sem `occurrence_ids` recebe `o<n>` (mesma regra do gerador). */
export function occurrenceIds(def: AnimationDef): string[] {
  return def.occurrence_ids ?? def.frames.map((_, index) => `o${index + 1}`);
}

/** Migração explícita: grava as identidades derivadas (idempotente). */
export function withOccurrenceIds(def: AnimationDef): AnimationDef {
  return def.occurrence_ids ? def : { ...def, occurrence_ids: occurrenceIds(def) };
}

export function describeOccurrences(def: AnimationDef): TimelineOccurrence[] {
  const ids = occurrenceIds(def);
  const durations = effectiveDurations(def);
  const events = def.frame_events ?? [];
  let cursor: number | null = 0;
  return def.frames.map((image, index) => {
    const mugen = def.mugen_frames?.[index];
    const ticks = durations[index] ?? 0;
    const startTick = cursor;
    cursor = cursor === null || ticks === -1 ? null : cursor + ticks;
    return {
      id: ids[index],
      index,
      image,
      source: mugen ? { group: mugen.group, image: mugen.image } : null,
      ticks,
      startTick,
      attackBoxes: mugen?.clsn1?.length ?? 0,
      bodyBoxes: mugen?.clsn2?.length ?? 0,
      events: events.filter((event) => event.occurrence === ids[index]).sort((a, b) => a.tick - b.tick),
    };
  });
}

/** Eventos que deixariam de caber se a ocorrência passasse a durar `ticks`. */
export function eventsOutsideDuration(def: AnimationDef, occurrence: string, ticks: number): FrameEvent[] {
  return (def.frame_events ?? []).filter(
    (event) => event.occurrence === occurrence && (ticks === -1 ? event.tick !== 0 : event.tick >= ticks)
  );
}

/**
 * Troca a duração de UMA ocorrência (fonte canônica e espelho). Se algum evento dessa ocorrência
 * ficaria fora do novo tempo, recusa com a lista — nunca desloca evento em silêncio.
 */
export function setOccurrenceDuration(def: AnimationDef, occurrence: string, raw: string): TimelineResult {
  const parsed = parseTicks(raw);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const ids = occurrenceIds(def);
  const index = ids.indexOf(occurrence);
  if (index < 0) return { ok: false, message: `Ocorrência '${occurrence}' não existe nesta animação.` };
  const outside = eventsOutsideDuration(def, occurrence, parsed.value);
  if (outside.length > 0) {
    return {
      ok: false,
      message: `${outside.length} evento(s) ficariam fora da ocorrência com ${parsed.value} ticks. Reposicione os eventos ou use "Ajustar eventos" de forma explícita.`,
      conflicts: outside.map((event) => event.id),
    };
  }
  const durations = effectiveDurations(def).map((d, i) => (i === index ? parsed.value : d));
  return {
    ok: true,
    def: {
      ...withOccurrenceIds(def),
      frame_durations: durations,
      ...(def.mugen_frames
        ? { mugen_frames: def.mugen_frames.map((f, i) => (i === index ? { ...f, duration: parsed.value } : f)) }
        : {}),
    },
  };
}

/** Retiming EXPLÍCITO: eventos fora da nova duração vão para o último tick válido. */
export function retimeEventsToFit(def: AnimationDef, occurrence: string, ticks: number): AnimationDef {
  const last = ticks === -1 ? 0 : Math.max(0, ticks - 1);
  return {
    ...def,
    frame_events: (def.frame_events ?? []).map((event) =>
      event.occurrence === occurrence && event.tick > last ? { ...event, tick: last } : event
    ),
  };
}

/**
 * Move uma ocorrência para `toIndex`, levando junto imagem, duração, quadro MUGEN (caixas, eixo,
 * flags) e identidade; eventos seguem a identidade; hitboxes autorais por índice são remapeadas.
 */
export function moveOccurrence(def: AnimationDef, occurrence: string, toIndex: number): TimelineResult {
  const ids = occurrenceIds(def);
  const from = ids.indexOf(occurrence);
  if (from < 0) return { ok: false, message: `Ocorrência '${occurrence}' não existe nesta animação.` };
  const to = Math.max(0, Math.min(def.frames.length - 1, Math.trunc(toIndex)));
  if (from === to) return { ok: true, def: withOccurrenceIds(def) };
  const order = def.frames.map((_, index) => index);
  order.splice(to, 0, ...order.splice(from, 1));
  const permute = <T,>(values: T[] | undefined) => (values ? order.map((index) => values[index]) : undefined);
  const newIndexOf = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const hitboxes: SpriteAnimationHitbox[] | undefined = def.hitboxes?.map((box) => ({
    ...box,
    frame: newIndexOf.get(box.frame) ?? box.frame,
  }));
  const next: AnimationDef = {
    ...def,
    frames: order.map((index) => def.frames[index]),
    occurrence_ids: order.map((index) => ids[index]),
    ...(def.frame_durations || def.mugen_frames ? { frame_durations: permute(effectiveDurations(def)) } : {}),
    ...(def.mugen_frames ? { mugen_frames: permute(def.mugen_frames) } : {}),
    ...(hitboxes ? { hitboxes } : {}),
  };
  return { ok: true, def: next };
}

let eventCounter = 0;

export function newEventId(existing: FrameEvent[]): string {
  const used = new Set(existing.map((event) => event.id));
  let id: string;
  do {
    eventCounter += 1;
    id = `ev${Date.now().toString(36)}${eventCounter}`;
  } while (used.has(id));
  return id;
}

export function addSoundEvent(
  def: AnimationDef,
  occurrence: string,
  tick: number,
  sound: string
): TimelineResult {
  const index = occurrenceIds(def).indexOf(occurrence);
  if (index < 0) return { ok: false, message: `Ocorrência '${occurrence}' não existe nesta animação.` };
  if (!sound.trim()) return { ok: false, message: "Escolha um som do Audio da entidade." };
  const ticks = effectiveDurations(def)[index];
  if (!Number.isInteger(tick) || tick < 0 || (ticks === -1 ? tick !== 0 : tick >= ticks)) {
    return {
      ok: false,
      message:
        ticks === -1
          ? "Ocorrência parada (-1): o evento só pode ficar no tick 0."
          : `Tick ${tick} fora da ocorrência: use 0 a ${ticks - 1}.`,
    };
  }
  const events = def.frame_events ?? [];
  const event: FrameEvent = {
    id: newEventId(events),
    occurrence,
    tick,
    kind: "sound",
    sound: sound.trim(),
    origin: "authored",
  };
  return { ok: true, def: { ...withOccurrenceIds(def), frame_events: [...events, event] } };
}

/** Remove um evento. Grava lista vazia (não apaga a chave): o store mescla patches em profundidade. */
export function removeEvent(def: AnimationDef, eventId: string): AnimationDef {
  return { ...def, frame_events: (def.frame_events ?? []).filter((event) => event.id !== eventId) };
}

/** Ticks totais da primeira passagem (null quando há quadro parado). */
export function totalTicks(def: AnimationDef): number | null {
  const durations = effectiveDurations(def);
  return durations.includes(-1) ? null : durations.reduce((sum, value) => sum + value, 0);
}

// ── Caixas por ocorrência (Experimental) ──────────────────────────────────────
// clsn1 = ataque (hit), clsn2 = corpo (hurt). Editar marca a ocorrência como autoral (`clsn_edited`);
// a ROM usa exatamente estas caixas no teste de acerto do golpe autoral.

export type BoxKind = "clsn1" | "clsn2";
export const BOX_LIMIT = 511;

function normalizeBox(box: MugenCollisionBox): MugenCollisionBox {
  return {
    x1: Math.min(box.x1, box.x2),
    y1: Math.min(box.y1, box.y2),
    x2: Math.max(box.x1, box.x2),
    y2: Math.max(box.y1, box.y2),
  };
}

function boxProblem(box: MugenCollisionBox): string | null {
  const values = [box.x1, box.y1, box.x2, box.y2];
  if (!values.every((v) => Number.isInteger(v))) return "Use pixels inteiros.";
  if (!values.every((v) => v >= -BOX_LIMIT && v <= BOX_LIMIT)) return `Cada canto fica entre -${BOX_LIMIT} e ${BOX_LIMIT} px do eixo.`;
  const n = normalizeBox(box);
  if (n.x2 - n.x1 < 1 || n.y2 - n.y1 < 1) return "A caixa precisa de largura e altura de pelo menos 1 px.";
  return null;
}

function withBoxes(def: AnimationDef, occurrence: string, kind: BoxKind, change: (boxes: MugenCollisionBox[]) => MugenCollisionBox[] | string): TimelineResult {
  const index = occurrenceIds(def).indexOf(occurrence);
  if (index < 0) return { ok: false, message: `Ocorrência '${occurrence}' não existe nesta animação.` };
  const frame = def.mugen_frames?.[index];
  if (!frame) return { ok: false, message: "Só animações MUGEN têm caixas por ocorrência." };
  const next = change([...((frame[kind] ?? []) as MugenCollisionBox[])]);
  if (typeof next === "string") return { ok: false, message: next };
  return {
    ok: true,
    def: {
      ...withOccurrenceIds(def),
      mugen_frames: def.mugen_frames!.map((f, i) => (i === index ? { ...f, [kind]: next, clsn_edited: true } : f)),
    },
  };
}

export function setOccurrenceBox(def: AnimationDef, occurrence: string, kind: BoxKind, boxIndex: number, box: MugenCollisionBox): TimelineResult {
  const problem = boxProblem(box);
  if (problem) return { ok: false, message: problem };
  return withBoxes(def, occurrence, kind, (boxes) => {
    if (boxIndex < 0 || boxIndex >= boxes.length) return "Caixa inexistente nesta ocorrência.";
    boxes[boxIndex] = normalizeBox(box);
    return boxes;
  });
}

export function addOccurrenceBox(def: AnimationDef, occurrence: string, kind: BoxKind, box: MugenCollisionBox): TimelineResult {
  const problem = boxProblem(box);
  if (problem) return { ok: false, message: problem };
  return withBoxes(def, occurrence, kind, (boxes) => (boxes.length >= 8 ? "No máximo 8 caixas de cada tipo por quadro." : [...boxes, normalizeBox(box)]));
}

export function removeOccurrenceBox(def: AnimationDef, occurrence: string, kind: BoxKind, boxIndex: number): TimelineResult {
  return withBoxes(def, occurrence, kind, (boxes) => {
    if (boxIndex < 0 || boxIndex >= boxes.length) return "Caixa inexistente nesta ocorrência.";
    boxes.splice(boxIndex, 1);
    return boxes;
  });
}

export function moveBoxBy(box: MugenCollisionBox, dx: number, dy: number): MugenCollisionBox {
  return { x1: box.x1 + dx, y1: box.y1 + dy, x2: box.x2 + dx, y2: box.y2 + dy };
}
