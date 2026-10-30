import { describe, expect, it } from "vitest";

import {
  classifyImageAssetInstantiation,
  normalizeAssetRelativePath,
  shouldInstantiateImageAsTilemapEntity,
  createEntityFromProjectAsset,
} from "./assetInstantiation";
import type { Entity } from "./ipc/sceneService";

function entityWithSprite(asset: string): Pick<Entity, "entity_id" | "components"> {
  return {
    entity_id: "s1",
    components: { sprite: { asset, frame_width: 8, frame_height: 8, palette_slot: 0, priority: "foreground", animations: {} } },
  };
}

function entityWithTilemap(tileset: string): Pick<Entity, "entity_id" | "components"> {
  return {
    entity_id: "t1",
    components: {
      tilemap: {
        tileset,
        map_width: 4,
        map_height: 4,
        scroll_x: 0,
        scroll_y: 0,
        cells: [],
      },
    },
  };
}

describe("assetInstantiation", () => {
  it("preserves declared SGDK meta-sprite frames and animations when adding a catalog resource", () => {
    const sprite = { asset: "assets/sprites/fighter.png", frame_width: 96, frame_height: 112, meta_sprite: true, animations: { idle: { frames: [0, 1], fps: 10, loop: true } } };
    const entity = createEntityFromProjectAsset({
      asset: { kind: "image", relative_path: sprite.asset, absolute_path: "/project/" + sprite.asset, image_width: 192, image_height: 112, sgdk_resource: { resource_name: "fighter_idle", resource_kind: "SPRITE", sprite } },
      projectSourceKind: "imported_sgdk", target: "megadrive", scene: { entities: [], background_layers: [] },
    });
    expect(entity.components.sprite).toEqual(sprite);
    expect(entity.display_name).toBe("fighter_idle");
    expect(entity.components.sprite).not.toBe(sprite);
  });

  it("adds assembled images at their original size and marks a tileset as a piece bank", () => {
    for (const resource_kind of ["IMAGE", "TILESET"]) {
      const entity = createEntityFromProjectAsset({
        asset: { kind: "image", relative_path: "assets/tilesets/hud.png", absolute_path: "/project/hud.png", image_width: 192, image_height: 88, sgdk_resource: { resource_name: "hud", resource_kind, sprite: null } },
        projectSourceKind: "imported_sgdk", target: "megadrive", scene: { entities: [], background_layers: [] },
      });
      expect(entity.components.tilemap).toMatchObject({ map_width: 24, map_height: 11, cells: [] });
      expect(entity.components.logic?.logic_hints?.includes("sgdk_import:tileset_bank") ?? false).toBe(resource_kind === "TILESET");
    }
  });

  it("refuses to invent a frame grid for an older SGDK catalog and to instantiate palette images", () => {
    for (const resource_kind of ["SPRITE", "PALETTE"]) expect(() => createEntityFromProjectAsset({
      asset: { kind: "image", relative_path: "assets/sprites/unknown.png", absolute_path: "/project/unknown.png", sgdk_resource: { resource_name: "unknown", resource_kind, sprite: null } },
      projectSourceKind: "imported_sgdk", target: "megadrive", scene: { entities: [], background_layers: [] },
    })).toThrow();
  });
  it("normalizes slashes for comparison", () => {
    expect(normalizeAssetRelativePath("a\\b\\c.png")).toBe("a/b/c.png");
  });

  it("prefers tilemap when the same path is already used as tileset in the scene", () => {
    const asset = { kind: "image" as const, relative_path: "assets/tilesets/bg.png" };
    const entities = [entityWithSprite("assets/sprites/hero.png"), entityWithTilemap("assets/tilesets/bg.png")];
    expect(
      shouldInstantiateImageAsTilemapEntity({
        asset,
        projectSourceKind: "blank",
        sceneEntities: entities,
      })
    ).toBe(true);
  });

  it("prefers sprite when the same path is already used as sprite in the scene", () => {
    const asset = { kind: "image" as const, relative_path: "assets/sprites/hero.png" };
    const entities = [entityWithSprite("assets/sprites/hero.png")];
    expect(
      shouldInstantiateImageAsTilemapEntity({
        asset,
        projectSourceKind: "imported_sgdk",
        sceneEntities: entities,
      })
    ).toBe(false);
  });

  it("for imported_sgdk, tilesets folder implies tilemap even without scene refs", () => {
    expect(
      shouldInstantiateImageAsTilemapEntity({
        asset: { kind: "image", relative_path: "assets/tilesets/window.png" },
        projectSourceKind: "imported_sgdk",
        sceneEntities: [],
      })
    ).toBe(true);
  });

  it("for imported_sgdk, plain sprites folder stays sprite when not referenced", () => {
    expect(
      shouldInstantiateImageAsTilemapEntity({
        asset: { kind: "image", relative_path: "assets/sprites/player.png" },
        projectSourceKind: "imported_sgdk",
        sceneEntities: [],
      })
    ).toBe(false);
  });

  it("non-sgdk still honors canonical tilesets path", () => {
    expect(
      shouldInstantiateImageAsTilemapEntity({
        asset: { kind: "image", relative_path: "content/tilesets/a.png" },
        projectSourceKind: "imported_godot",
        sceneEntities: [],
      })
    ).toBe(true);
  });

  it("classifies maps/ folder as tilemap layout", () => {
    const c = classifyImageAssetInstantiation({
      asset: { kind: "image", relative_path: "res/maps/stage.png" },
      projectSourceKind: "imported_sgdk",
      sceneEntities: [],
    });
    expect(c.kind).toBe("tilemap");
    expect(c.reason).toBe("sgdk-layout-canónico-pastas");
    expect(c.title).toBe("Adicionar imagem à cena");
    expect(c.entityLabel).toBe("Tilemap");
    expect(c.detail).toContain("SGDK");
    expect(c.nextStep).toContain("cells[]");
  });

  it("exposes a product-facing explanation for sprite defaults without hiding the audit trail", () => {
    const c = classifyImageAssetInstantiation({
      asset: { kind: "image", relative_path: "assets/sprites/player.png" },
      projectSourceKind: "builtin",
      sceneEntities: [],
    });

    expect(c.kind).toBe("sprite");
    expect(c.reason).toBe("padrao-sprite-sem-sinais-de-tilemap");
    expect(c.title).toBe("Adicionar personagem ou objeto");
    expect(c.entityLabel).toBe("Sprite");
    expect(c.detail).toContain("sprite");
  });
});
