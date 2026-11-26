import { describe, expect, it } from "vitest";
import { layerCompositionEntities, priorityRegionBetween, restoreTemplateEntityPositions, tilePriorityBands, translateCollisionMap } from "./sceneComposition";
import type { CollisionMap, Entity, Scene, SceneLayer } from "./ipc/sceneService";

const map: CollisionMap = {
  width: 4, height: 3, tile_width: 8, tile_height: 8,
  data: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
};

describe("priority regions on Mega Drive planes", () => {
  const tilemap = { tileset: "pilastra.png", map_width: 3, map_height: 4 };
  const pillar: Entity = { entity_id: "pilastra", transform: { x: 64, y: 136 }, components: { tilemap } };

  it("marks the same cells in either drag direction and clips the end at the plane edge", () => {
    expect(priorityRegionBetween(pillar, { x: 86, y: 149 }, { x: 80, y: 159 }, true))
      .toEqual({ x: 2, y: 1, width: 1, height: 2, high: true });
    expect(priorityRegionBetween(pillar, { x: 80, y: 159 }, { x: 100, y: 146 }, true))
      .toEqual({ x: 2, y: 1, width: 1, height: 2, high: true });
    expect(priorityRegionBetween(pillar, { x: 63, y: 149 }, { x: 80, y: 155 }, true)).toBeNull();
  });

  it("lets a low band cut a hole in a high region without adding a second pass for that cell", () => {
    expect(tilePriorityBands(tilemap)).toBeNull();
    const bands = tilePriorityBands({ ...tilemap, priority_regions: [
      { x: 0, y: 0, width: 3, height: 1, high: true },
      { x: 1, y: 0, width: 1, height: 1, high: false },
    ] });
    expect(bands?.high).toEqual([
      { x: 0, y: 0, width: 1, height: 1, high: true },
      { x: 2, y: 0, width: 1, height: 1, high: true },
    ]);
    expect(bands?.low.find(({ y }) => y === 0)).toEqual({ x: 1, y: 0, width: 1, height: 1, high: false });
  });
});

describe("scene composition movement", () => {
  it("moves the whole collision grid by tile units without losing source data", () => {
    const moved = translateCollisionMap(map, 8, 8);
    expect(moved?.data).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(map.data[1]).toBe(1);
    expect(translateCollisionMap(moved!, -8, -8)?.data).toEqual(map.data);
  });

  it("refuses clipping, fractional cells and malformed maps", () => {
    expect(translateCollisionMap(map, -16, 0)).toBeNull();
    expect(translateCollisionMap(map, 1, 0)).toBeNull();
    expect(translateCollisionMap({ ...map, data: [] }, 8, 0)).toBeNull();
    expect(translateCollisionMap(map, Number.NaN, 0)).toBeNull();
  });

  it("moves only a complete, editable layer membership", () => {
    const entities = ["player", "goal"].map((id): Entity => ({
      entity_id: id, transform: { x: 0, y: 0 }, components: {},
    }));
    const layer: SceneLayer = {
      id: "gameplay", name: "Gameplay", kind: "sprite", visible: true,
      locked: false, depth: 0, entity_ids: ["player", "goal"],
    };
    expect(layerCompositionEntities(layer, entities)).toEqual(entities);
    expect(layerCompositionEntities({ ...layer, entity_ids: ["player", "missing"] }, entities)).toBeNull();
    expect(layerCompositionEntities({ ...layer, locked: true }, entities)).toBeNull();
    expect(layerCompositionEntities({ ...layer, entity_ids: ["player", "player"] }, entities)).toBeNull();
  });

  it("previews template positions while preserving authored entities, components, layers and collision edits", () => {
    const templateEntity: Entity = { entity_id: "player", transform: { x: 32, y: 176 }, components: {} };
    const editedEntity: Entity = {
      ...templateEntity, transform: { x: 48, y: 176 },
      components: { sprite: { asset: "authored.png", frame_width: 32, frame_height: 32 } },
    };
    const addedEntity: Entity = { entity_id: "new", transform: { x: 120, y: 80 }, components: {} };
    const baseline: Scene = {
      scene_id: "main", entities: [templateEntity, { ...templateEntity, entity_id: "deleted" }],
      background_layers: [], collision_map: map,
    };
    const current: Scene = {
      ...baseline, entities: [editedEntity, addedEntity],
      collision_map: { ...map, data: map.data.map(() => 1) },
      layers: [{ id: "authored", name: "Authored", kind: "sprite", visible: true, locked: false, depth: 0, entity_ids: ["new"] }],
    };
    const result = restoreTemplateEntityPositions(current, baseline);
    expect(result?.changes).toEqual([{ id: "player", from: { x: 48, y: 176 }, to: { x: 32, y: 176 } }]);
    expect(result?.missing).toEqual(["deleted"]);
    expect(result?.scene.entities[0]?.components).toEqual(editedEntity.components);
    expect(result?.scene.entities[1]).toEqual(addedEntity);
    expect(result?.scene.collision_map).toEqual(current.collision_map);
    expect(result?.scene.layers).toEqual(current.layers);
    expect(current.entities[0]?.transform.x).toBe(48);
    expect(restoreTemplateEntityPositions({ ...current, scene_id: "other" }, baseline)).toBeNull();
  });
});
