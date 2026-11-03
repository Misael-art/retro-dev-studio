import type { CollisionMap, Entity, SceneLayer } from "./ipc/sceneService";

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
