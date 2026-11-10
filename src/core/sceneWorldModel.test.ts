import { describe, expect, it } from "vitest";

import { clampViewportPan, getSceneEntityBounds, resolveSceneWorldMetrics, sceneArtworkEntities } from "./sceneWorldModel";
import type { Entity, Scene } from "./ipc/sceneService";

function buildSpriteEntity(
  entityId: string,
  x: number,
  y: number,
  width: number,
  height: number
): Entity {
  return {
    entity_id: entityId,
    display_name: entityId,
    prefab: null,
    transform: { x, y },
    components: {
      sprite: {
        asset: `assets/sprites/${entityId}.png`,
        frame_width: width,
        frame_height: height,
        palette_slot: 0,
        animations: {},
      },
    },
  };
}

describe("sceneWorldModel", () => {
  it("previews effective A/B planes and sprite priority in VDP composition order", () => {
    const low = buildSpriteEntity("low", 0, 0, 16, 16);
    low.components.sprite!.priority = "background";
    const high = buildSpriteEntity("high", 0, 0, 16, 16);
    const a = { entity_id: "a", transform: { x: 0, y: 0 }, components: { tilemap: { tileset: "a.png", map_width: 1, map_height: 1, plane: "BG_A", priority: true } } } as Entity;
    const b = { entity_id: "b", transform: { x: 0, y: 0 }, components: { tilemap: { tileset: "b.png", map_width: 1, map_height: 1, plane: "BG_B" } } } as Entity;
    const scene = { entities: [a, high, b, low] } as Scene;
    expect(sceneArtworkEntities(scene, "megadrive").map((e) => e.entity_id)).toEqual(["b", "low", "a", "high"]);
    a.components.tilemap!.priority = false;
    expect(sceneArtworkEntities(scene, "megadrive").map((e) => e.entity_id)).toEqual(["b", "a", "low", "high"]);
  });
  it("expands the world to imported tilemaps, collision maps and camera frames", () => {
    const hero = buildSpriteEntity("hero", 48, 96, 32, 32);
    const scene: Scene = {
      scene_id: "stage",
      display_name: "Stage",
      entities: [
        {
          entity_id: "stage",
          display_name: "Stage",
          prefab: null,
          transform: { x: 0, y: 0 },
          components: {
            tilemap: {
              tileset: "assets/tilesets/stage.png",
              map_width: 80,
              map_height: 28,
            },
          },
        },
        hero,
        {
          entity_id: "main_camera",
          display_name: "Main Camera",
          prefab: null,
          transform: { x: 0, y: 0 },
          components: {
            camera: {
              follow_entity: "hero",
            },
          },
        },
      ],
      background_layers: [],
      palettes: [],
      collision_map: {
        tile_width: 8,
        tile_height: 8,
        width: 96,
        height: 28,
        data: new Array(96 * 28).fill(0),
      },
    };

    const metrics = resolveSceneWorldMetrics(scene, "megadrive");

    expect(metrics.frame).toEqual({ width: 320, height: 224 });
    expect(metrics.worldWidth).toBe(768);
    expect(metrics.worldHeight).toBe(224);
    expect(metrics.largeWorld).toBe(true);
    expect(metrics.dominantTilemapId).toBe("stage");
    expect(metrics.collisionWorldSize).toEqual({ width: 768, height: 224 });
    expect(metrics.camera?.followEntityId).toBe("hero");
  });

  it("derives camera bounds with the emitter contract: target origin + offset, clamped to the tilemap world", () => {
    const hero = buildSpriteEntity("hero", 64, 80, 32, 32);
    const camera = {
      entity_id: "main_camera",
      display_name: "Main Camera",
      prefab: null,
      transform: { x: 0, y: 0 },
      components: {
        camera: {
          follow_entity: "hero",
          offset_x: 16,
          offset_y: -8,
        },
      },
    } satisfies Entity;

    const bounds = getSceneEntityBounds(camera, "megadrive", [hero, camera]);

    expect(bounds.width).toBe(320);
    expect(bounds.height).toBe(224);
    // No tilemap: the ROM clamps to 0 (camera_world_limits). Never -264/-32.
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);

    const stage = { entity_id: "stage", display_name: null, prefab: null, transform: { x: 0, y: 0 },
      components: { tilemap: { tileset: "t.png", map_width: 80, map_height: 40 } } } as unknown as Entity;
    const templateCamera = { ...camera, components: { camera: { follow_entity: "hero", offset_x: -160, offset_y: -112 } } } satisfies Entity;
    const far = buildSpriteEntity("hero", 400, 200, 32, 32);
    expect(getSceneEntityBounds(templateCamera, "megadrive", [stage, far, templateCamera])).toMatchObject({ x: 240, y: 88 });
    const edge = buildSpriteEntity("hero", 620, 300, 32, 32);
    expect(getSceneEntityBounds(templateCamera, "megadrive", [stage, edge, templateCamera])).toMatchObject({ x: 320, y: 96 });
  });

  it("clamps pan to the visible world when requested", () => {
    expect(
      clampViewportPan({
        enabled: true,
        pan: { x: 400, y: -240 },
        stageWidth: 800,
        stageHeight: 600,
        contentWidth: 1200,
        contentHeight: 900,
      })
    ).toEqual({ x: 200, y: -150 });

    expect(
      clampViewportPan({
        enabled: false,
        pan: { x: 400, y: -240 },
        stageWidth: 800,
        stageHeight: 600,
        contentWidth: 1200,
        contentHeight: 900,
      })
    ).toEqual({ x: 400, y: -240 });
  });
});
