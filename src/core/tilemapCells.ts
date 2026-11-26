/**
 * Tilemap cell values (shared editor/compiler contract):
 * - 0: no change over the base map (the tileset image drawn as the stage picture);
 * - TILEMAP_CELL_EMPTY: the cell is explicitly empty (blank tile in the ROM);
 * - N > 0: tile N-1 of the tileset image in row-major 8x8 order.
 * Projects saved before the empty value existed only use 0 and N, so they are unchanged.
 */
export const TILEMAP_CELL_BASE = 0;
export const TILEMAP_CELL_EMPTY = 0xffffffff;

export function isExplicitEmptyCell(value: number): boolean {
  return value === TILEMAP_CELL_EMPTY;
}

export function tilesetAtlasIndex(value: number): number | null {
  return value > 0 && value !== TILEMAP_CELL_EMPTY ? value - 1 : null;
}

export interface TerrainBrush {
  firstTile: number;
  tileset: string;
  remove: boolean;
}

export function terrainFromBrush(brush: { kind: string; tileIndex?: number; assetPath?: string; tilesetTileCount?: number } | null,
    remove: boolean): TerrainBrush | null {
  const firstTile = brush?.tileIndex;
  if (brush?.kind !== "tile" || !firstTile || !brush.assetPath || firstTile < 1 || firstTile + 15 > (brush.tilesetTileCount ?? 0)) return null;
  return { firstTile, tileset: brush.assetPath, remove };
}

const terrainNeighbours = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]] as const;

/** A terrain family is sixteen authored tiles ordered by its N/E/S/W adjacency mask. */
export function retileTerrain(base: number[], width: number, height: number, col: number, row: number,
    firstTile: number, remove: boolean): number[] {
  const index = (x: number, y: number) => y * width + x;
  const inside = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
  const inFamily = (value: number) => value >= firstTile && value < firstTile + 16;
  if (![firstTile, col, row].every(Number.isSafeInteger) || firstTile <= 0 || firstTile + 15 >= TILEMAP_CELL_EMPTY
      || !inside(col, row) || (remove && !inFamily(base[index(col, row)]))) return base;
  const result = base.slice();
  result[index(col, row)] = remove ? TILEMAP_CELL_BASE : firstTile;
  const affected = [[col, row], ...terrainNeighbours.map(([dx, dy]) => [col + dx, row + dy])];
  for (const [x, y] of affected) {
    if (!inside(x, y) || !inFamily(result[index(x, y)])) continue;
    let mask = 0;
    for (const [dx, dy, bit] of terrainNeighbours) {
      if (inside(x + dx, y + dy) && inFamily(result[index(x + dx, y + dy)])) mask |= bit;
    }
    result[index(x, y)] = firstTile + mask;
  }
  return affected.some(([x, y]) => inside(x, y) && base[index(x, y)] !== result[index(x, y)]) ? result : base;
}

/**
 * Células cruzadas por um traço entre duas amostras do ponteiro (Bresenham, inclui as pontas).
 * Um arrasto rápido não pode pular células entre dois eventos de movimento.
 */
export function cellsOnLine(c0: number, r0: number, c1: number, r1: number): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  let x = c0;
  let y = r0;
  const dx = Math.abs(c1 - c0);
  const dy = -Math.abs(r1 - r0);
  const sx = c0 < c1 ? 1 : -1;
  const sy = r0 < r1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ col: x, row: y });
    if (x === c1 && y === r1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
