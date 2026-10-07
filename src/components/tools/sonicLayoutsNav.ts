// Navegação e apresentação do "mapa de IDs" (somente leitura). A geometria da
// grade (64×64) vem do núcleo; aqui só há movimento de cursor e pixels.

export interface GridCursor {
  row: number;
  col: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 16;
export const PAGE_ROWS = 8;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom)));
}

/** Lado da célula em pixels para um zoom; texto só cabe a partir de 16 px. */
export function cellPixels(zoom: number): number {
  return 4 + clampZoom(zoom) * 2;
}

export function showsIdText(zoom: number): boolean {
  return cellPixels(zoom) >= 16;
}

function clamp(value: number, max: number): number {
  return Math.min(max - 1, Math.max(0, value));
}

/**
 * Próximo cursor para uma tecla de navegação, ou `null` quando a tecla não
 * navega (ou a grade ainda não tem geometria). Sem wrap: a borda é a borda.
 */
export function moveCursor(
  from: GridCursor,
  key: string,
  ctrl: boolean,
  rows: number,
  cols: number
): GridCursor | null {
  if (rows <= 0 || cols <= 0) return null;
  const at = (row: number, col: number): GridCursor => ({ row: clamp(row, rows), col: clamp(col, cols) });
  switch (key) {
    case "ArrowLeft":
      return at(from.row, from.col - 1);
    case "ArrowRight":
      return at(from.row, from.col + 1);
    case "ArrowUp":
      return at(from.row - 1, from.col);
    case "ArrowDown":
      return at(from.row + 1, from.col);
    case "Home":
      return ctrl ? at(0, 0) : at(from.row, 0);
    case "End":
      return ctrl ? at(rows - 1, cols - 1) : at(from.row, cols - 1);
    case "PageUp":
      return at(from.row - PAGE_ROWS, from.col);
    case "PageDown":
      return at(from.row + PAGE_ROWS, from.col);
    default:
      return null;
  }
}

/** ID de uma célula a partir do hex linear (2 caracteres por célula). */
export function idAt(idsHex: string, row: number, col: number, cols: number): number | null {
  const offset = (row * cols + col) * 2;
  if (row < 0 || col < 0 || col >= cols || offset + 2 > idsHex.length) return null;
  const value = Number.parseInt(idsHex.slice(offset, offset + 2), 16);
  return Number.isNaN(value) ? null : value;
}

export function idLabel(id: number): string {
  return `0x${id.toString(16).toUpperCase().padStart(2, "0")}`;
}

/** Tom por valor de ID: distingue valores diferentes; NÃO é a arte do jogo. */
export function idTint(id: number): string {
  if (id === 0) return "hsl(240 10% 12%)";
  return `hsl(${(id * 47) % 360} 38% 28%)`;
}
