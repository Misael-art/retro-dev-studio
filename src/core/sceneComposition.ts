import type { CollisionMap, Entity, Scene, SceneLayer } from "./ipc/sceneService";

export interface TemplatePositionChange {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Restore only transforms of surviving template entities; all authored content stays intact. */
export function restoreTemplateEntityPositions(current: Scene, baseline: Scene): {
  scene: Scene;
  changes: TemplatePositionChange[];
  missing: string[];
} | null {
  if (current.scene_id !== baseline.scene_id) return null;
  const byId = new Map(current.entities.map((entity) => [entity.entity_id, entity]));
  const original = new Map(baseline.entities.map((entity) => [entity.entity_id, entity.transform]));
  const missing = baseline.entities.filter((entity) => !byId.has(entity.entity_id)).map((entity) => entity.entity_id);
  const changes: TemplatePositionChange[] = [];
  const entities = current.entities.map((entity) => {
    const target = original.get(entity.entity_id);
    if (!target || (entity.transform.x === target.x && entity.transform.y === target.y)) return entity;
    changes.push({
      id: entity.entity_id,
      from: { ...entity.transform },
      to: { ...target },
    });
    return { ...entity, transform: { ...target } };
  });
  return { scene: { ...current, entities }, changes, missing };
}

/** A layer is the only explicit entity group in the scene schema. */
export function layerCompositionEntities(layer: SceneLayer, entities: Entity[]): Entity[] | null {
  if (layer.locked || !layer.visible || layer.entity_ids.length === 0 ||
    new Set(layer.entity_ids).size !== layer.entity_ids.length) return null;
  const byId = new Map(entities.map((entity) => [entity.entity_id, entity]));
  const members = layer.entity_ids.map((id) => byId.get(id));
  return members.some((entity) => !entity) ? null : members as Entity[];
}

/** Shift the whole collision grid without silently discarding solid cells. */
export function translateCollisionMap(map: CollisionMap, dx: number, dy: number): CollisionMap | null {
  const { width, height, tile_width: tileWidth, tile_height: tileHeight } = map;
  if (
    !Number.isInteger(dx) || !Number.isInteger(dy) ||
    !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
    !Number.isInteger(tileWidth) || !Number.isInteger(tileHeight) || tileWidth <= 0 || tileHeight <= 0 ||
    !Array.isArray(map.data) || map.data.length !== width * height ||
    dx % tileWidth !== 0 || dy % tileHeight !== 0
  ) return null;

  const columns = dx / tileWidth;
  const rows = dy / tileHeight;
  const data = Array<number>(width * height).fill(0);
  for (let index = 0; index < map.data.length; index += 1) {
    const value = map.data[index];
    if (!value) continue;
    const x = index % width + columns;
    const y = Math.floor(index / width) + rows;
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    data[y * width + x] = value;
  }
  return { ...map, data };
}

export type EntityEditLock = { locked: false } | { locked: true; reason: "object" } | { locked: true; reason: "layer"; layerName: string };

/**
 * R3-08: effective edit lock for the Canvas. Object locks are editor-only view state
 * (never written to the scene); layer locks come from the authored `SceneLayer.locked`.
 */
export function entityEditLock(entityId: string, layers: SceneLayer[] | null | undefined, lockedEntityIds: readonly string[]): EntityEditLock {
  if (lockedEntityIds.includes(entityId)) return { locked: true, reason: "object" };
  const layer = (layers ?? []).find((candidate) => candidate.locked && candidate.entity_ids.includes(entityId));
  return layer ? { locked: true, reason: "layer", layerName: layer.name } : { locked: false };
}

export function describeEntityEditLock(lock: EntityEditLock): string {
  if (!lock.locked) return "";
  return lock.reason === "object" ? "Objeto bloqueado" : `Bloqueado pela camada «${lock.layerName}»`;
}

/**
 * R3-02: Esc exits the derived isolation only when no field, popup or menu owns the key.
 * Fields keep their own Esc (clear/cancel) and open dialogs/menus close first.
 */
export function escapeExitsIsolation(event: { key: string; defaultPrevented: boolean; target: EventTarget | null }, doc: Document | null = typeof document === "undefined" ? null : document): boolean {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  const el = event.target as HTMLElement | null;
  if (el && typeof el.closest === "function") {
    if (el.isContentEditable || el.closest("input, textarea, select, [contenteditable='true']")) return false;
    if (el.closest("[role='dialog'], [role='menu'], [role='listbox'], dialog[open]")) return false;
  }
  if (doc?.querySelector("[role='dialog'][aria-modal='true'], [role='menu'], dialog[open]")) return false;
  return true;
}

export type GraphScope =
  | { kind: "none" }
  | { kind: "instance" }
  | { kind: "shared_file"; ref: string; usersInScene: string[] }
  | { kind: "inherited"; ref: string; prefab: string | null; usersInScene: string[] }
  | { kind: "unavailable"; ref: string };

/**
 * R3-04: where the selected object's logic graph lives, from the real source/resolved
 * scenes. Users are counted only in this scene; other scenes are not inspected here.
 */
export function resolveGraphScope(source: Scene | null | undefined, resolved: Scene | null | undefined, entityId: string, hydrated: boolean): GraphScope {
  const own = source?.entities.find((entity) => entity.entity_id === entityId);
  const eff = resolved?.entities.find((entity) => entity.entity_id === entityId) ?? own;
  const ref = eff?.components.logic?.graph_ref?.trim() || "";
  if (!ref) return eff?.components.logic?.graph ? { kind: "instance" } : { kind: "none" };
  if (!hydrated) return { kind: "unavailable", ref };
  const usersInScene = (resolved?.entities ?? source?.entities ?? [])
    .filter((entity) => entity.components.logic?.graph_ref?.trim() === ref)
    .map((entity) => entity.entity_id);
  const ownRef = own?.components.logic?.graph_ref?.trim();
  return ownRef ? { kind: "shared_file", ref, usersInScene } : { kind: "inherited", ref, prefab: own?.prefab ?? null, usersInScene };
}

export function describeGraphScope(scope: GraphScope): string {
  switch (scope.kind) {
    case "none": return "Sem lógica";
    case "instance": return "Lógica desta instância";
    case "unavailable": return `Arquivo ${scope.ref} indisponível — não editável`;
    case "shared_file": return scope.usersInScene.length > 1 ? `Arquivo ${scope.ref} · ${scope.usersInScene.length} usos nesta cena` : `Arquivo ${scope.ref}`;
    case "inherited": return `Herdada do modelo${scope.prefab ? ` ${scope.prefab}` : ""} (${scope.ref})${scope.usersInScene.length > 1 ? ` · ${scope.usersInScene.length} usos nesta cena` : ""}`;
  }
}
