import { useEffect, useMemo, useState } from "react";
import type { Scene } from "../../core/ipc/sceneService";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { sceneArtworkEntities } from "../../core/sceneWorldModel";
import { getTilemapArtwork, loadSceneArtworkAsset, type ViewportAssetCacheEntry } from "./sceneArtworkRenderer";

/** Read-only artwork: the same decoder/cells as ViewportPanel, without editor gizmos. */
export default function SceneArtwork({ scene, project, target, probe, camera }: {
  scene: Scene; project: string; target: "megadrive" | "snes"; probe?: { id: string; x: number; y: number };
  camera?: { x: number; y: number; ratios: { entity_id: string; ratio_x: number; ratio_y: number }[] };
}) {
  const [assets, setAssets] = useState<Record<string, ViewportAssetCacheEntry>>({});
  useEffect(() => {
    let current = true;
    setAssets({});
    const paths = [...new Set(scene.entities.flatMap(e => e.components.tilemap?.tileset ?? e.components.sprite?.asset ?? []))];
    if (project) void Promise.all(paths.map(async path => {
      try { return [path, await loadSceneArtworkAsset(project, path)] as const; }
      catch { return [path, { status: "error" as const }] as const; }
    })).then(entries => { if (current) setAssets(Object.fromEntries(entries)); });
    return () => { current = false; };
  }, [project, scene]);
  const images = useMemo(() => sceneArtworkEntities(scene, target).flatMap(entity => {
    const tilemap = entity.components.tilemap, sprite = entity.components.sprite;
    if (!tilemap && !sprite) return [];
    const asset = assets[tilemap?.tileset ?? sprite!.asset];
    const width = tilemap ? tilemap.map_width * 8 : sprite!.frame_width;
    const height = tilemap ? tilemap.map_height * 8 : sprite!.frame_height;
    if (!asset?.source || width < 1 || height < 1 || width * height > 16777216) return [{ entity, width, height, href: "" }];
    if (tilemap) return [{ entity, width, height, href: getTilemapArtwork(asset, tilemap)?.toDataURL() ?? "" }];
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [{ entity, width, height, href: "" }];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(asset.source, 0, 0, Math.min(width, asset.width ?? width), Math.min(height, asset.height ?? height), 0, 0, width, height);
    return [{ entity, width, height, href: canvas.toDataURL() }];
  }), [scene, assets, target]);
  return <g aria-label="Arte da cena · primeiro quadro dos personagens">
    {images.map(({ entity, width, height, href }) => {
      const hidden = scene.layers?.some(l => !l.visible && l.entity_ids.includes(entity.entity_id));
      if (hidden) return null;
      const position = probe?.id === entity.entity_id ? probe : entity.transform;
      const ratio = camera?.ratios.find(r => r.entity_id === entity.entity_id);
      const x = position.x + (camera && ratio ? camera.x * (100 - ratio.ratio_x) / 100 : 0);
      const y = position.y + (camera && ratio ? camera.y * (100 - ratio.ratio_y) / 100 : 0);
      return href ? <image key={entity.entity_id} href={href} x={x} y={y} width={width} height={height} style={{ imageRendering: "pixelated" }}><title>{getEntityDisplayName(entity)}</title></image>
        : <g key={entity.entity_id}><rect x={x} y={y} width={width} height={height} fill="none" stroke="currentColor" strokeDasharray="2 2"/><text x={x + 2} y={y + 12} fontSize="10" fill="currentColor">{getEntityDisplayName(entity)} · {assets[entity.components.tilemap?.tileset ?? entity.components.sprite!.asset]?.status === "error" ? "imagem indisponível" : "carregando arte"}</text></g>;
    })}
  </g>;
}
