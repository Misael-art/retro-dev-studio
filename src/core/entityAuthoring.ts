import type { Entity } from "./ipc/sceneService";
import type { ActiveBrush } from "./store/editorStore";

function normalizeSourceRefs(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0)
    )
  );
}

export function resolveEntitySourceRefs(entity: Entity | null | undefined): string[] {
  return normalizeSourceRefs([
    ...(entity?.components.logic?.imported_semantics?.source_paths ?? []),
    ...(entity?.components.logic?.external_source_refs ?? []),
  ]);
}

export function entityHasLogicWorkspace(entity: Entity | null | undefined): boolean {
  const logic = entity?.components.logic;
  return Boolean(logic?.graph || logic?.graph_ref || resolveEntitySourceRefs(entity).length > 0);
}

export function buildTilemapAuthoringBrush(entity: Entity | null | undefined): ActiveBrush | null {
  const tilemap = entity?.components.tilemap;
  if (!tilemap) {
    return null;
  }

  return {
    kind: "tile",
    id: `${entity?.entity_id ?? "tilemap"}:tile`,
    assetPath: tilemap.tileset,
    tileIndex: 1,
  };
}

/**
 * Secondary "open authoring" action of an asset reference card. The card already has its own
 * "Abrir no ArtStudio" button, so this action complements it: tilemap, then logic, then art.
 * The primary gesture (double-click) keeps art-first via `resolvePrimaryAuthoringSurface`.
 */
export function resolveReferenceAuthoringSurface(
  entity: Entity | null | undefined
): "tilemap" | "logic" | "artstudio" | null {
  if (entity?.components.tilemap) {
    return "tilemap";
  }
  if (entityHasLogicWorkspace(entity)) {
    return "logic";
  }
  if (entity?.components.sprite) {
    return "artstudio";
  }
  return null;
}

export function resolvePrimaryAuthoringSurface(
  entity: Entity | null | undefined
): "tilemap" | "logic" | "artstudio" | null {
  if (entity?.components.tilemap) {
    return "tilemap";
  }
  if (entity?.components.sprite) {
    return "artstudio";
  }
  if (entityHasLogicWorkspace(entity)) {
    return "logic";
  }
  return null;
}
