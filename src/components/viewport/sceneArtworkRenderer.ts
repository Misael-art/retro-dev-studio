import { isPpmPath, loadProjectPpmImageData } from "../../core/ppmImage";
import { applyKeyColorTransparency } from "../../core/keyColorTransparency";
import { readProjectAssetBytes } from "../../core/ipc/toolsService";
import { isExplicitEmptyCell, tilesetAtlasIndex } from "../../core/tilemapCells";
import type { TilemapComponent } from "../../core/ipc/sceneService";

export type ViewportAssetCacheEntry = {
  status: "loading" | "loaded" | "missing" | "error";
  source?: CanvasImageSource;
  width?: number;
  height?: number;
  errorMessage?: string;
};

export const SCENE_ARTWORK_MAX_PIXELS = 16777216;
const tilemapArtwork = new WeakMap<TilemapComponent, { source: CanvasImageSource; canvas: HTMLCanvasElement }>();

/** Compose each plane separately: empty cells reveal lower planes, never erase them. */
export function getTilemapArtwork(asset: ViewportAssetCacheEntry, map: TilemapComponent): HTMLCanvasElement | null {
  if (!asset.source) return null;
  const cached = tilemapArtwork.get(map);
  if (cached?.source === asset.source) return cached.canvas;
  const width = map.map_width * 8, height = map.map_height * 8;
  if (width < 1 || height < 1 || width * height > SCENE_ARTWORK_MAX_PIXELS) return null;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  if (map.cells?.length === map.map_width * map.map_height) {
    ctx.drawImage(asset.source, 0, 0);
    drawTilemapCells(ctx, asset, 0, 0, map.map_width, map.map_height, map.cells, 8, map.scroll_x ?? 0, map.scroll_y ?? 0);
  } else drawRepeatedAsset(ctx, asset, 0, 0, width, height, map.scroll_x ?? 0, map.scroll_y ?? 0);
  tilemapArtwork.set(map, { source: asset.source, canvas });
  return canvas;
}

/** Retain the viewport's direct drawing path when a whole-plane canvas is too large. */
export function drawTilemapArtwork(context: CanvasRenderingContext2D, asset: ViewportAssetCacheEntry,
  map: TilemapComponent, x: number, y: number): void {
  const artwork = getTilemapArtwork(asset, map);
  if (artwork) { context.drawImage(artwork, x, y); return; }
  if (!asset.source) return;
  const width = map.map_width * 8, height = map.map_height * 8;
  context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
  if (map.cells?.length === map.map_width * map.map_height) {
    context.drawImage(asset.source, x, y);
    drawTilemapCells(context, asset, x, y, map.map_width, map.map_height, map.cells, 8, map.scroll_x ?? 0, map.scroll_y ?? 0);
  } else drawRepeatedAsset(context, asset, x, y, width, height, map.scroll_x ?? 0, map.scroll_y ?? 0);
  context.restore();
}

/** Shared IPC decoder for the scene viewport and the isolated camera composer. */
export async function loadSceneArtworkAsset(project: string, path: string, showKeyColor = false): Promise<ViewportAssetCacheEntry> {
  let source: CanvasImageSource;
  if (isPpmPath(path)) {
    const data = await loadProjectPpmImageData(project, path);
    const canvas = document.createElement("canvas");
    canvas.width = data.width; canvas.height = data.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas indisponível");
    ctx.putImageData(applyKeyColorTransparency(data, { showKeyColor }).imageData, 0, 0);
    return { status: "loaded", source: canvas, width: canvas.width, height: canvas.height };
  }
  const blob = new Blob([Uint8Array.from(await readProjectAssetBytes(project, path))]);
  const loadImage = () => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(Error("Imagem não pôde ser decodificada")); };
    image.src = url;
  });
  if (typeof createImageBitmap === "function") source = await createImageBitmap(blob).catch(loadImage);
  else source = await loadImage();
  const width = (source as ImageBitmap).width, height = (source as ImageBitmap).height;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { status: "loaded", source, width, height };
  ctx.drawImage(source, 0, 0);
  ctx.putImageData(applyKeyColorTransparency(ctx.getImageData(0, 0, width, height), { showKeyColor }).imageData, 0, 0);
  if ("close" in source) (source as ImageBitmap).close();
  return { status: "loaded", source: canvas, width, height };
}

export function drawTilemapCells(
  context: CanvasRenderingContext2D,
  asset: ViewportAssetCacheEntry,
  originX: number,
  originY: number,
  mapWidth: number,
  mapHeight: number,
  cells: number[],
  tileSize: number,
  scrollX: number,
  scrollY: number
): void {
  if (!asset.source || tileSize <= 0) return;
  const cols = Math.max(0, Math.floor((asset.width ?? 0) / tileSize));
  if (cols <= 0) return;
  const totalCells = mapWidth * mapHeight;
  context.save();
  for (let i = 0; i < Math.min(cells.length, totalCells); i++) {
    const value = cells[i];
    const col = i % mapWidth;
    const row = (i - col) / mapWidth;
    const dx = originX + col * tileSize - scrollX;
    const dy = originY + row * tileSize - scrollY;
    if (isExplicitEmptyCell(value)) {
      // Explicit empty cell: punch the base map out, like the ROM's blank tile.
      context.clearRect(dx, dy, tileSize, tileSize);
      continue;
    }
    const atlasIdx = tilesetAtlasIndex(value);
    if (atlasIdx === null) continue;
    const ax = (atlasIdx % cols) * tileSize;
    const ay = Math.floor(atlasIdx / cols) * tileSize;
    if (asset.width && ax + tileSize > asset.width) continue;
    if (asset.height && ay + tileSize > asset.height) continue;
    context.clearRect(dx, dy, tileSize, tileSize);
    context.drawImage(
      asset.source,
      ax,
      ay,
      tileSize,
      tileSize,
      dx,
      dy,
      tileSize,
      tileSize
    );
  }
  context.restore();
}

export function drawRepeatedAsset(
  context: CanvasRenderingContext2D,
  asset: ViewportAssetCacheEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0
) {
  if (!asset.source || !asset.width || !asset.height) {
    return;
  }

  const tileWidth = Math.max(1, asset.width);
  const tileHeight = Math.max(1, asset.height);
  const normalizedOffsetX = ((offsetX % tileWidth) + tileWidth) % tileWidth;
  const normalizedOffsetY = ((offsetY % tileHeight) + tileHeight) % tileHeight;
  const startX = x - normalizedOffsetX;
  const startY = y - normalizedOffsetY;

  for (let drawY = startY; drawY < y + height; drawY += tileHeight) {
    for (let drawX = startX; drawX < x + width; drawX += tileWidth) {
      context.drawImage(asset.source, drawX, drawY, tileWidth, tileHeight);
    }
  }
}
