import { occurrenceIds } from "./characterTimeline";
import { getEntityDisplayName } from "./entityDisplay";
import type { Entity, Scene } from "./ipc/sceneService";

const listLimit = 4;
const serializedEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function describeEntityChange(before: Entity, after: Entity): string[] {
  const name = getEntityDisplayName(after);
  const changes: string[] = [];
  for (const axis of ["x", "y"] as const) {
    if (before.transform[axis] !== after.transform[axis]) {
      changes.push(`${name} · ${axis.toUpperCase()} ${before.transform[axis]} → ${after.transform[axis]} px`);
    }
  }
  const oldSprite = before.components.sprite;
  const sprite = after.components.sprite;
  if (oldSprite?.asset !== sprite?.asset) changes.push(`${name} · arte vinculada`);
  for (const [animation, current] of Object.entries(sprite?.animations ?? {})) {
    const previous = oldSprite?.animations?.[animation];
    if (!previous) continue;
    const oldIds = occurrenceIds(previous);
    for (const [index, id] of occurrenceIds(current).entries()) {
      const oldIndex = oldIds.indexOf(id);
      const from = previous.frame_durations?.[oldIndex];
      const to = current.frame_durations?.[index];
      if (oldIndex >= 0 && from !== to && from !== undefined && to !== undefined) {
        changes.push(`${name} · ${animation} · ${id} · ${from} → ${to} ticks`);
      }
    }
  }
  if (!serializedEqual(before.components.logic, after.components.logic)) changes.push(`${name} · lógica`);
  if (!serializedEqual(before.components.tilemap, after.components.tilemap)) changes.push(`${name} · tilemap`);
  if (!serializedEqual(before.components.hud, after.components.hud)) changes.push(`${name} · HUD`);
  if (!changes.length && !serializedEqual(before, after)) changes.push(`${name} · propriedades`);
  return changes;
}

/** Summaries are derived from the exact snapshots the existing undo stack restores. */
export function describeSceneHistory(before: Scene | null, after: Scene | null): string[] {
  if (!before || !after) return ["Composição da cena"];
  const changes: string[] = [];
  const previousEntities = new Map(before.entities.map((entity) => [entity.entity_id, entity]));
  for (const entity of after.entities) {
    const previous = previousEntities.get(entity.entity_id);
    if (previous) changes.push(...describeEntityChange(previous, entity));
    else changes.push(`${getEntityDisplayName(entity)} · incluído`);
    previousEntities.delete(entity.entity_id);
  }
  for (const entity of previousEntities.values()) changes.push(`${getEntityDisplayName(entity)} · removido`);
  for (const [property, label] of [["collision_map", "Mapa de colisão"], ["layers", "Camadas"], ["background_layers", "Fundos"],
    ["palettes", "Paletas"], ["retrofx", "Efeitos"]] as const) {
    if (!serializedEqual(before[property], after[property])) changes.push(label);
  }
  if (changes.length > listLimit) return [...changes.slice(0, listLimit), `Mais ${changes.length - listLimit} alterações`];
  return changes.length ? changes : ["Estado da cena"];
}
