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
