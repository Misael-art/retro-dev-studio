// Editor de pixel art indexado para Mega Drive (Experimental).
// Cada pixel guarda `linha * 16 + indice`; indice 0 e sempre transparente (valor 0).
// Cores sao 9-bit (3 bits por canal, 0..7) como na CRAM do VDP.

export const TILE = 8;
export const PALETTE_LINES = 4;
export const LINE_SIZE = 16;
export const MAX_SPRITES_PER_LINE = 20;
export const MAX_SPRITES = 80;

export type MdColor = [number, number, number];
export type PixelTarget = "sprite" | "plane";
export type PixelConversion = "balanced" | "dominant" | "floyd";

export interface PixelLayerMeta {
  id: string;
  name: string;
  visible: boolean;
  originalSource?: string;
}

export interface PixelFrame {
  id: string;
  durationMs: number;
  /** Um cel por layer, na mesma ordem de `layers` (0 = fundo). */
  cels: Uint8Array[];
}

export interface PixelDoc {
  name: string;
  originalSource?: string;
  conversionMethod?: PixelConversion;
  width: number;
  height: number;
  target: PixelTarget;
  palettes: MdColor[][];
  layers: PixelLayerMeta[];
  frames: PixelFrame[];
}

let idCounter = 0;
export function newPixelId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

// ── Cor ─────────────────────────────────────────────────────────────────────

export function mdLevelTo8(level: number): number {
  return Math.round((Math.max(0, Math.min(7, level)) * 255) / 7);
}

export function channelToMd(value: number): number {
  return Math.max(0, Math.min(7, Math.round((value * 7) / 255)));
}

export function mdColorToCss([r, g, b]: MdColor): string {
  const hex = (v: number) => mdLevelTo8(v).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Palavra CRAM 0x0BGR (cada canal ocupa os bits 1..3 do nibble). */
export function mdColorToCram([r, g, b]: MdColor): number {
  return ((b & 7) << 9) | ((g & 7) << 5) | ((r & 7) << 1);
}

export function sameMdColor(a: MdColor, b: MdColor): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function mdLuminance([r, g, b]: MdColor): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/** As 512 cores do Mega Drive, ordenadas por canal. */
export function masterPalette(): MdColor[] {
  const colors: MdColor[] = [];
  for (let r = 0; r < 8; r += 1) for (let g = 0; g < 8; g += 1) for (let b = 0; b < 8; b += 1) colors.push([r, g, b]);
  return colors;
}

export function defaultPalettes(): MdColor[][] {
  const ramp = (tint: MdColor): MdColor[] =>
    Array.from({ length: LINE_SIZE }, (_, i) => {
      if (i === 0) return [7, 0, 7] as MdColor;
      const t = (i - 1) / 14;
      return tint.map((c) => Math.round(c * t)) as MdColor;
    });
  const base: MdColor[] = [
    [7, 0, 7],
    [0, 0, 0],
    [7, 7, 7],
    [4, 4, 4],
    [2, 2, 2],
    [7, 1, 1],
    [7, 4, 0],
    [7, 7, 1],
    [1, 6, 1],
    [0, 4, 1],
    [1, 3, 7],
    [0, 1, 4],
    [5, 2, 7],
    [7, 5, 4],
    [5, 3, 1],
    [3, 1, 0],
  ];
  return [base, ramp([7, 6, 5]), ramp([3, 5, 7]), ramp([6, 7, 3])];
}

export function pixelLine(value: number): number {
  return value >> 4;
}

export function pixelIndex(value: number): number {
  return value & 15;
}

export function packPixel(line: number, index: number): number {
  return index === 0 ? 0 : ((line & 3) << 4) | (index & 15);
}

export function pixelCss(doc: PixelDoc, value: number): string | null {
  if (pixelIndex(value) === 0) return null;
  return mdColorToCss(doc.palettes[pixelLine(value)][pixelIndex(value)]);
}

// ── Documento ───────────────────────────────────────────────────────────────

export function createPixelDoc(width: number, height: number, options: { name?: string; frames?: number; target?: PixelTarget } = {}): PixelDoc {
  const w = alignToTile(width);
  const h = alignToTile(height);
  const layers: PixelLayerMeta[] = [{ id: newPixelId("layer"), name: "Sprite", visible: true }];
  return {
    name: options.name ?? "novo_sprite",
    width: w,
    height: h,
    target: options.target ?? "sprite",
    palettes: defaultPalettes(),
    layers,
    frames: Array.from({ length: Math.max(1, options.frames ?? 1) }, () => ({
      id: newPixelId("frame"),
      durationMs: 100,
      cels: layers.map(() => new Uint8Array(w * h)),
    })),
  };
}

export function alignToTile(value: number): number {
  return Math.max(TILE, Math.ceil(Math.max(1, Math.round(value)) / TILE) * TILE);
}

export function compositeFrame(doc: PixelDoc, frameIndex: number): Uint8Array {
  const frame = doc.frames[frameIndex];
  const out = new Uint8Array(doc.width * doc.height);
  if (!frame) return out;
  doc.layers.forEach((layer, li) => {
    if (!layer.visible) return;
    const cel = frame.cels[li];
    for (let i = 0; i < out.length; i += 1) if (pixelIndex(cel[i]) !== 0) out[i] = cel[i];
  });
  return out;
}

export function replaceCel(doc: PixelDoc, frameIndex: number, layerIndex: number, cel: Uint8Array): PixelDoc {
  return {
    ...doc,
    frames: doc.frames.map((frame, fi) =>
      fi === frameIndex ? { ...frame, cels: frame.cels.map((c, li) => (li === layerIndex ? cel : c)) } : frame
    ),
  };
}

export function addFrame(doc: PixelDoc, afterIndex: number, duplicate: boolean): PixelDoc {
  const source = doc.frames[afterIndex];
  const frame: PixelFrame = {
    id: newPixelId("frame"),
    durationMs: source?.durationMs ?? 100,
    cels: doc.layers.map((_, li) =>
      duplicate && source ? new Uint8Array(source.cels[li]) : new Uint8Array(doc.width * doc.height)
    ),
  };
  const frames = [...doc.frames];
  frames.splice(afterIndex + 1, 0, frame);
  return { ...doc, frames };
}

export function removeFrame(doc: PixelDoc, index: number): PixelDoc {
  if (doc.frames.length <= 1) return doc;
  return { ...doc, frames: doc.frames.filter((_, i) => i !== index) };
}

export function moveFrame(doc: PixelDoc, from: number, to: number): PixelDoc {
  if (to < 0 || to >= doc.frames.length || from === to) return doc;
  const frames = [...doc.frames];
  const [frame] = frames.splice(from, 1);
  frames.splice(to, 0, frame);
  return { ...doc, frames };
}

export function addLayer(doc: PixelDoc, name: string): PixelDoc {
  if (doc.width * doc.height * doc.frames.length * (doc.layers.length + 1) > 64 * 1024 * 1024) throw new Error("A nova camada ultrapassaria 64 milhões de pixels no documento. As camadas atuais foram preservadas.");
  return {
    ...doc,
    layers: [...doc.layers, { id: newPixelId("layer"), name, visible: true }],
    frames: doc.frames.map((frame) => ({ ...frame, cels: [...frame.cels, new Uint8Array(doc.width * doc.height)] })),
  };
}

export function removeLayer(doc: PixelDoc, index: number): PixelDoc {
  if (doc.layers.length <= 1) return doc;
  return {
    ...doc,
    layers: doc.layers.filter((_, i) => i !== index),
    frames: doc.frames.map((frame) => ({ ...frame, cels: frame.cels.filter((_, i) => i !== index) })),
  };
}

export function moveLayer(doc: PixelDoc, from: number, to: number): PixelDoc {
  if (to < 0 || to >= doc.layers.length || from === to) return doc;
  const reorder = <T,>(list: T[]) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  return { ...doc, layers: reorder(doc.layers), frames: doc.frames.map((f) => ({ ...f, cels: reorder(f.cels) })) };
}

/** Redimensiona o canvas ancorado no canto superior esquerdo (sempre multiplo de 8). */
export function resizeDoc(doc: PixelDoc, width: number, height: number): PixelDoc {
  const w = alignToTile(width);
  const h = alignToTile(height);
  const resize = (cel: Uint8Array) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < Math.min(h, doc.height); y += 1)
      for (let x = 0; x < Math.min(w, doc.width); x += 1) out[y * w + x] = cel[y * doc.width + x];
    return out;
  };
  return { ...doc, width: w, height: h, frames: doc.frames.map((f) => ({ ...f, cels: f.cels.map(resize) })) };
}

// ── Ferramentas (operam num cel, devolvem um novo cel) ──────────────────────

export interface BrushOptions {
  size: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
}

function plot(cel: Uint8Array, width: number, height: number, x: number, y: number, value: number, brush: BrushOptions) {
  const size = Math.max(1, Math.min(8, Math.round(brush.size)));
  const start = -Math.floor((size - 1) / 2);
  const put = (px: number, py: number) => {
    for (let dy = 0; dy < size; dy += 1)
      for (let dx = 0; dx < size; dx += 1) {
        const tx = px + start + dx;
        const ty = py + start + dy;
        if (tx >= 0 && ty >= 0 && tx < width && ty < height) cel[ty * width + tx] = value;
      }
  };
  put(x, y);
  if (brush.mirrorX) put(width - 1 - x, y);
  if (brush.mirrorY) put(x, height - 1 - y);
  if (brush.mirrorX && brush.mirrorY) put(width - 1 - x, height - 1 - y);
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
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
  return points;
}

/** Shift: restringe a reta a 0/45/90 graus. */
export function constrainLine(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.abs(dx) > Math.abs(dy) * 2) return [x1, y0];
  if (Math.abs(dy) > Math.abs(dx) * 2) return [x0, y1];
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return [x0 + Math.sign(dx) * d, y0 + Math.sign(dy) * d];
}

export function drawStroke(cel: Uint8Array, width: number, height: number, points: [number, number][], value: number, brush: BrushOptions): Uint8Array {
  const out = new Uint8Array(cel);
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    for (const [x, y] of linePoints(x0, y0, x1, y1)) plot(out, width, height, x, y, value, brush);
  }
  return out;
}

/** Dithering: alterna primaria/secundaria em xadrez sob o pincel. */
export function drawDither(cel: Uint8Array, width: number, height: number, points: [number, number][], primary: number, secondary: number, brush: BrushOptions): Uint8Array {
  const out = new Uint8Array(cel);
  const mask = drawStroke(new Uint8Array(width * height), width, height, points, 1, brush);
  for (let i = 0; i < mask.length; i += 1)
    if (mask[i]) out[i] = ((i % width) + Math.floor(i / width)) % 2 === 0 ? primary : secondary;
  return out;
}

export function drawRect(cel: Uint8Array, width: number, height: number, a: [number, number], b: [number, number], value: number, filled: boolean): Uint8Array {
  const out = new Uint8Array(cel);
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (filled || x === x0 || x === x1 || y === y0 || y === y1) out[y * width + x] = value;
    }
  return out;
}

export function drawEllipse(cel: Uint8Array, width: number, height: number, a: [number, number], b: [number, number], value: number, filled: boolean): Uint8Array {
  const out = new Uint8Array(cel);
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2 + 0.5;
  const ry = (y1 - y0) / 2 + 0.5;
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      if (!inside(x, y) || x < 0 || y < 0 || x >= width || y >= height) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (filled || edge) out[y * width + x] = value;
    }
  return out;
}

/** Remove a dominant, uniform border color from every frame, preserving holes
 * enclosed by the drawing and retaining at least one visible pixel per frame. */
export function removePixelBackground(doc: PixelDoc, tolerance = 0, scope?: PixelEditScope): PixelDoc {
  let changed = false;
  const frames = doc.frames.map((frame, frameIndex) => {
    if (scope && !scope.allFrames && scope.frame !== frameIndex) return frame;
    const pixels = scope ? frame.cels[scope.layer] : compositeFrame(doc, frameIndex);
    if (!pixels) return frame;
    const r = scope?.rect ?? { x: 0, y: 0, w: doc.width, h: doc.height };
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(doc.width, r.x + r.w), y1 = Math.min(doc.height, r.y + r.h);
    const eligible = (i: number) => i % doc.width >= x0 && i % doc.width < x1 && Math.floor(i / doc.width) >= y0 && Math.floor(i / doc.width) < y1 && (scope?.color == null || pixels[i] === scope.color);
    const border = new Set<number>();
    for (let x = x0; x < x1; x++) { border.add(y0 * doc.width + x); border.add((y1 - 1) * doc.width + x); }
    for (let y = y0; y < y1; y++) { border.add(y * doc.width + x0); border.add(y * doc.width + x1 - 1); }
    const counts = new Map<string, number>();
    for (const i of border) { const c = pixelCss(doc, pixels[i]); if (c && eligible(i)) counts.set(c, (counts.get(c) ?? 0) + 1); }
    const dominant = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (!dominant || dominant[1] < border.size * 0.35) return frame;
    const seed = pixels.find(p => pixelCss(doc, p) === dominant[0])!;
    const reference = doc.palettes[pixelLine(seed)][pixelIndex(seed)].map(mdLevelTo8);
    const matches = (p: number) => pixelIndex(p) !== 0 && doc.palettes[pixelLine(p)][pixelIndex(p)].every((c, ch) => Math.abs(mdLevelTo8(c) - reference[ch]) <= tolerance);
    const seen = new Uint8Array(pixels.length);
    const queue = [...border];
    let cleared = 0;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]; if (seen[i]) continue; seen[i] = 1;
      if (!eligible(i)) continue;
      const color = pixelCss(doc, pixels[i]);
      if (color && !matches(pixels[i])) continue;
      seen[i] = 2; if (color) cleared++;
      const x = i % doc.width, y = Math.floor(i / doc.width);
      if (x) queue.push(i - 1); if (x < doc.width - 1) queue.push(i + 1);
      if (y) queue.push(i - doc.width); if (y < doc.height - 1) queue.push(i + doc.width);
    }
    const visible = pixels.reduce((n, p, i) => n + (eligible(i) && pixelIndex(p) ? 1 : 0), 0);
    if (!cleared || cleared >= visible) return frame;
    changed = true;
    return { ...frame, cels: frame.cels.map((cel, layer) => (scope ? layer === scope.layer : doc.layers[layer].visible)
      ? Uint8Array.from(cel, (p, i) => seen[i] === 2 && matches(p) ? 0 : p)
      : cel) };
  });
  return changed ? { ...doc, frames } : doc;
}

export function floodFill(cel: Uint8Array, width: number, height: number, x: number, y: number, value: number, rect?: PixelRect | null): Uint8Array {
  const out = new Uint8Array(cel);
  if (x < 0 || y < 0 || x >= width || y >= height) return out;
  const inside = (i: number) => !rect || i % width >= rect.x && i % width < rect.x + rect.w && Math.floor(i / width) >= rect.y && Math.floor(i / width) < rect.y + rect.h;
  const target = out[y * width + x];
  if (target === value) return out;
  const stack = [y * width + x];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (out[i] !== target || !inside(i)) continue;
    out[i] = value;
    const px = i % width;
    if (px > 0) stack.push(i - 1);
    if (px < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i + width < out.length) stack.push(i + width);
  }
  return out;
}

export function replaceAllColor(cel: Uint8Array, from: number, to: number): Uint8Array {
  return cel.map((v) => (v === from ? to : v));
}

/** Clarear/escurecer: troca pelo vizinho de luminancia dentro da mesma linha de paleta. */
export function shadeValue(doc: PixelDoc, value: number, lighten: boolean): number {
  if (pixelIndex(value) === 0) return value;
  const line = pixelLine(value);
  const order = doc.palettes[line]
    .map((color, index) => ({ index, lum: mdLuminance(color) }))
    .filter((entry) => entry.index !== 0)
    .sort((a, b) => a.lum - b.lum || a.index - b.index);
  const at = order.findIndex((entry) => entry.index === pixelIndex(value));
  const next = order[Math.max(0, Math.min(order.length - 1, at + (lighten ? 1 : -1)))];
  return packPixel(line, next.index);
}

export function drawShade(doc: PixelDoc, cel: Uint8Array, points: [number, number][], lighten: boolean, brush: BrushOptions): Uint8Array {
  const out = new Uint8Array(cel);
  const mask = drawStroke(new Uint8Array(doc.width * doc.height), doc.width, doc.height, points, 1, brush);
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) out[i] = shadeValue(doc, cel[i], lighten);
  return out;
}

// ── Transformacoes ─────────────────────────────────────────────────────────

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PixelEditScope {
  frame: number;
  layer: number;
  allFrames?: boolean;
  rect?: PixelRect | null;
  color?: number | null;
}

export function normalizeRect(a: [number, number], b: [number, number], width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(a[0], b[0]));
  const y = Math.max(0, Math.min(a[1], b[1]));
  const x1 = Math.min(width - 1, Math.max(a[0], b[0]));
  const y1 = Math.min(height - 1, Math.max(a[1], b[1]));
  return { x, y, w: Math.max(0, x1 - x + 1), h: Math.max(0, y1 - y + 1) };
}

function fullRect(width: number, height: number): PixelRect {
  return { x: 0, y: 0, w: width, h: height };
}

export function flipCel(cel: Uint8Array, width: number, height: number, horizontal: boolean, rect: PixelRect = fullRect(width, height)): Uint8Array {
  const out = new Uint8Array(cel);
  for (let y = 0; y < rect.h; y += 1)
    for (let x = 0; x < rect.w; x += 1) {
      const sx = horizontal ? rect.w - 1 - x : x;
      const sy = horizontal ? y : rect.h - 1 - y;
      out[(rect.y + y) * width + rect.x + x] = cel[(rect.y + sy) * width + rect.x + sx];
    }
  return out;
}

/** Gira 90 graus no sentido horario dentro do maior quadrado centrado no recorte. */
export function rotateCel(cel: Uint8Array, width: number, height: number, rect: PixelRect = fullRect(width, height)): Uint8Array {
  const out = new Uint8Array(cel);
  const size = Math.min(rect.w, rect.h);
  const ox = rect.x + Math.floor((rect.w - size) / 2);
  const oy = rect.y + Math.floor((rect.h - size) / 2);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) out[(oy + x) * width + ox + (size - 1 - y)] = cel[(oy + y) * width + ox + x];
  return out;
}

/** Desloca o conteudo do recorte; com `wrap` o que sai volta do lado oposto. */
export function shiftCel(cel: Uint8Array, width: number, height: number, dx: number, dy: number, wrap: boolean, rect: PixelRect = fullRect(width, height)): Uint8Array {
  const out = new Uint8Array(cel);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) out[y * width + x] = 0;
  for (let y = 0; y < rect.h; y += 1)
    for (let x = 0; x < rect.w; x += 1) {
      let tx = x + dx;
      let ty = y + dy;
      if (wrap) {
        tx = ((tx % rect.w) + rect.w) % rect.w;
        ty = ((ty % rect.h) + rect.h) % rect.h;
      } else if (tx < 0 || ty < 0 || tx >= rect.w || ty >= rect.h) {
        continue;
      }
      out[(rect.y + ty) * width + rect.x + tx] = cel[(rect.y + y) * width + rect.x + x];
    }
  return out;
}

/** Aplica uma transformacao de cel a todos os frames e layers (ou so ao atual). */
export function transformDoc(doc: PixelDoc, scope: { frame: number; layer: number } | "all", fn: (cel: Uint8Array) => Uint8Array): PixelDoc {
  return {
    ...doc,
    frames: doc.frames.map((frame, fi) => ({
      ...frame,
      cels: frame.cels.map((cel, li) => (scope === "all" || (scope.frame === fi && scope.layer === li) ? fn(cel) : cel)),
    })),
  };
}

// ── Restricoes de hardware ─────────────────────────────────────────────────

export interface PixelTileInfo {
  tx: number;
  ty: number;
  lines: number[];
  colors: number;
  empty: boolean;
}

export interface PixelHardwareReport {
  tilesX: number;
  tilesY: number;
  tiles: PixelTileInfo[];
  conflictTiles: PixelTileInfo[];
  /** Linhas de paleta usadas no documento inteiro e quantas cores (1..15) de cada. */
  lineUsage: { line: number; colors: number }[];
  uniqueColors: number;
  /** Tiles nao vazios unicos no documento (dedup com flip H/V, como rescomp). */
  uniqueTiles: number;
  totalTiles: number;
  vramBytes: number;
  /** Sprite: pecas de hardware (ate 4x4 tiles) por frame e pior caso por scanline. */
  hwSpritesPerFrame: number;
  spritesPerScanline: number;
  framesWithMixedLines: number;
  warnings: string[];
}

function tileKey(tile: Uint8Array): string {
  return Array.from(tile).join(",");
}

function tilePixels(pixels: Uint8Array, width: number, tx: number, ty: number): Uint8Array {
  const out = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) out[y * TILE + x] = pixels[(ty * TILE + y) * width + tx * TILE + x];
  return out;
}

function tileVariants(tile: Uint8Array): string[] {
  const h = flipCel(tile, TILE, TILE, true);
  const v = flipCel(tile, TILE, TILE, false);
  const hv = flipCel(h, TILE, TILE, false);
  return [tile, h, v, hv].map(tileKey);
}

export function analyzeTiles(doc: PixelDoc, pixels: Uint8Array): PixelTileInfo[] {
  const tilesX = doc.width / TILE;
  const tilesY = doc.height / TILE;
  const tiles: PixelTileInfo[] = [];
  for (let ty = 0; ty < tilesY; ty += 1)
    for (let tx = 0; tx < tilesX; tx += 1) {
      const lines = new Set<number>();
      const colors = new Set<number>();
      for (const value of tilePixels(pixels, doc.width, tx, ty))
        if (pixelIndex(value) !== 0) {
          lines.add(pixelLine(value));
          colors.add(value);
        }
      tiles.push({ tx, ty, lines: [...lines].sort(), colors: colors.size, empty: colors.size === 0 });
    }
  return tiles;
}

export function analyzeHardware(doc: PixelDoc, frameIndex: number): PixelHardwareReport {
  const tilesX = doc.width / TILE;
  const tilesY = doc.height / TILE;
  const current = compositeFrame(doc, frameIndex);
  const tiles = analyzeTiles(doc, current);
  const lineColors = Array.from({ length: PALETTE_LINES }, () => new Set<number>());
  const seen = new Set<string>();
  let uniqueTiles = 0;
  let totalTiles = 0;
  let framesWithMixedLines = 0;
  doc.frames.forEach((_, fi) => {
    const pixels = fi === frameIndex ? current : compositeFrame(doc, fi);
    const frameLines = new Set<number>();
    for (const value of pixels)
      if (pixelIndex(value) !== 0) {
        lineColors[pixelLine(value)].add(pixelIndex(value));
        frameLines.add(pixelLine(value));
      }
    if (frameLines.size > 1) framesWithMixedLines += 1;
    for (let ty = 0; ty < tilesY; ty += 1)
      for (let tx = 0; tx < tilesX; tx += 1) {
        const tile = tilePixels(pixels, doc.width, tx, ty);
        if (tile.every((v) => pixelIndex(v) === 0)) continue;
        totalTiles += 1;
        const variants = tileVariants(Uint8Array.from(tile, pixelIndex));
        if (variants.some((key) => seen.has(key))) continue;
        seen.add(variants[0]);
        uniqueTiles += 1;
      }
  });
  const lineUsage = lineColors.map((set, line) => ({ line, colors: set.size })).filter((entry) => entry.colors > 0);
  const uniqueColors = lineUsage.reduce((sum, entry) => sum + entry.colors, 0);
  const conflictTiles = tiles.filter((tile) => tile.lines.length > 1);
  // Pecas de hardware: blocos de ate 4x4 tiles que contem algum pixel.
  let hwSpritesPerFrame = 0;
  const piecesPerRow = new Array<number>(tilesY).fill(0);
  for (let by = 0; by < tilesY; by += 4)
    for (let bx = 0; bx < tilesX; bx += 4) {
      const block = tiles.filter((t) => t.tx >= bx && t.tx < bx + 4 && t.ty >= by && t.ty < by + 4 && !t.empty);
      if (block.length === 0) continue;
      hwSpritesPerFrame += 1;
      const rows = new Set(block.map((t) => t.ty));
      const top = Math.min(...rows);
      const bottom = Math.max(...rows);
      for (let r = top; r <= bottom; r += 1) piecesPerRow[r] += 1;
    }
  const spritesPerScanline = piecesPerRow.reduce((m, v) => Math.max(m, v), 0);
  const warnings: string[] = [];
  if (conflictTiles.length > 0)
    warnings.push(`${conflictTiles.length} tile(s) misturam linhas de paleta — o VDP usa uma paleta por tile.`);
  if (doc.target === "sprite" && lineUsage.length > 1)
    warnings.push("O sprite usa mais de uma linha de paleta; no hardware cada peca usa uma so.");
  if (framesWithMixedLines > 0 && doc.target === "sprite")
    warnings.push(`${framesWithMixedLines} frame(s) misturam linhas de paleta.`);
  if (doc.target === "sprite" && hwSpritesPerFrame > MAX_SPRITES)
    warnings.push(`${hwSpritesPerFrame} pecas de hardware por frame (limite ${MAX_SPRITES}).`);
  if (doc.target === "sprite" && spritesPerScanline > MAX_SPRITES_PER_LINE)
    warnings.push(`${spritesPerScanline} pecas na mesma linha (limite ${MAX_SPRITES_PER_LINE} por scanline).`);
  const vramBytes = uniqueTiles * 32;
  if (vramBytes > 64 * 1024) warnings.push("Os tiles unicos passam de 64 KB de VRAM.");
  return {
    tilesX,
    tilesY,
    tiles,
    conflictTiles,
    lineUsage,
    uniqueColors,
    uniqueTiles,
    totalTiles,
    vramBytes,
    hwSpritesPerFrame,
    spritesPerScanline,
    framesWithMixedLines,
    warnings,
  };
}

// ── Importacao (RGBA -> indexado) ──────────────────────────────────────────

export interface QuantizeResult {
  pixels: Uint8Array;
  palette: MdColor[];
  sourceColors: number;
  warnings: string[];
}

export interface PixelQuantizeOptions {
  /** Slots used outside the operation stay byte-for-byte unchanged. */
  lockedSlots?: number[];
}

/**
 * Converte RGBA para indices de uma linha de paleta: quantiza para 9-bit e,
 * se houver mais de 15 cores, mantem as 15 mais frequentes e aproxima o resto.
 * Reaproveita as cores ja presentes na linha quando coincidem.
 */
export function quantizeRgba(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, line: number, existing?: MdColor[], options: PixelQuantizeOptions = {}): QuantizeResult {
  const counts = new Map<string, { color: MdColor; count: number }>();
  const keys: (string | null)[] = new Array(width * height).fill(null);
  for (let i = 0; i < width * height; i += 1) {
    if (rgba[i * 4 + 3] < 128) continue;
    const color: MdColor = [channelToMd(rgba[i * 4]), channelToMd(rgba[i * 4 + 1]), channelToMd(rgba[i * 4 + 2])];
    const key = color.join(",");
    keys[i] = key;
    const entry = counts.get(key) ?? { color, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
  const warnings: string[] = [];
  if (ranked.length > 15)
    warnings.push(`${ranked.length} cores apos quantizar para 9-bit; mantidas as 15 mais usadas e o restante aproximado.`);
  const palette: MdColor[] = existing ? existing.map((c) => [...c] as MdColor) : defaultPalettes()[line].map((c) => [...c] as MdColor);
  const chosen = ranked.map((entry) => entry.color);
  const slotOf = new Map<string, number>();
  const occupied = new Set(options.lockedSlots?.filter(slot => slot > 0 && slot < 16) ?? []);
  for (const slot of [...occupied].sort((a, b) => a - b)) {
    const key = palette[slot].join(","); if (!slotOf.has(key)) slotOf.set(key, slot);
  }
  let nextSlot = 1;
  for (const color of chosen) {
    if (slotOf.has(color.join(","))) continue;
    const reuse = palette.findIndex((p, i) => i > 0 && sameMdColor(p, color));
    if (reuse > 0 && !occupied.has(reuse)) {
      slotOf.set(color.join(","), reuse);
      occupied.add(reuse);
      continue;
    }
    while (nextSlot < LINE_SIZE && occupied.has(nextSlot)) nextSlot += 1;
    if (nextSlot >= LINE_SIZE) break;
    palette[nextSlot] = color;
    slotOf.set(color.join(","), nextSlot);
    occupied.add(nextSlot);
    nextSlot += 1;
  }
  const nearest = (color: MdColor) => {
    let best = 1;
    let bestDist = Infinity;
    for (const [key, slot] of slotOf) {
      const [r, g, b] = key.split(",").map(Number);
      const d = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = slot;
      }
    }
    return best;
  };
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    const key = keys[i];
    if (!key) continue;
    const slot = slotOf.get(key) ?? nearest(key.split(",").map(Number) as MdColor);
    pixels[i] = packPixel(line, slot);
  }
  return { pixels, palette, sourceColors: ranked.length, warnings };
}

export interface PixelTileReuse extends PixelTileInfo {
  id: number;
  pattern: number;
  flip: "original" | "horizontal" | "vertical" | "ambos";
  copies: number;
  exclusiveColors: number;
}

/** VDP patterns contain four-bit indices; palette-bank bits live in the map. */
export function analyzeTileReuse(doc: PixelDoc, pixels: Uint8Array): PixelTileReuse[] {
  const seen = new Map<string, number>();
  const uses = new Map<number, Set<number>>();
  const tiles = analyzeTiles(doc, pixels);
  const result = tiles.map((tile, id): PixelTileReuse => {
    const values = tilePixels(pixels, doc.width, tile.tx, tile.ty);
    for (const value of new Set(values)) if (pixelIndex(value)) {
      const set = uses.get(value) ?? new Set<number>(); set.add(id); uses.set(value, set);
    }
    const variants = tileVariants(Uint8Array.from(values, pixelIndex));
    const match = variants.findIndex(key => seen.has(key));
    const pattern = match < 0 ? id : seen.get(variants[match])!;
    if (match < 0) seen.set(variants[0], id);
    return { ...tile, id, pattern, flip: (["original", "horizontal", "vertical", "ambos"] as const)[Math.max(0, match)], copies: 0, exclusiveColors: 0 };
  });
  const counts = new Map<number, number>();
  for (const tile of result) counts.set(tile.pattern, (counts.get(tile.pattern) ?? 0) + 1);
  for (const tile of result) {
    tile.copies = counts.get(tile.pattern)!;
    tile.exclusiveColors = [...uses.values()].filter(ids => ids.size === 1 && ids.has(tile.id)).length;
  }
  return result;
}

// ── Exportacao ─────────────────────────────────────────────────────────────

/** Folha horizontal com todos os frames compostos, como indices 0..15 da linha usada. */
export function buildSheetIndices(doc: PixelDoc): { width: number; height: number; indices: Uint8Array; line: number } {
  const width = doc.width * doc.frames.length;
  const indices = new Uint8Array(width * doc.height);
  const lineCount = new Array<number>(PALETTE_LINES).fill(0);
  doc.frames.forEach((_, fi) => {
    const pixels = compositeFrame(doc, fi);
    for (let y = 0; y < doc.height; y += 1)
      for (let x = 0; x < doc.width; x += 1) {
        const value = pixels[y * doc.width + x];
        indices[y * width + fi * doc.width + x] = pixelIndex(value);
        if (pixelIndex(value) !== 0) lineCount[pixelLine(value)] += 1;
      }
  });
  const line = lineCount.indexOf(Math.max(...lineCount));
  return { width, height: doc.height, indices, line: Math.max(0, line) };
}

export function paletteToC(name: string, palette: MdColor[]): string {
  const words = palette.map((c) => `0x${mdColorToCram(c).toString(16).toUpperCase().padStart(4, "0")}`);
  return `const u16 ${name}[16] = {\n    ${words.slice(0, 8).join(", ")},\n    ${words.slice(8).join(", ")}\n};\n`;
}

export function resLine(doc: PixelDoc, relativePng: string): string {
  const symbol = sanitizeSymbol(doc.name);
  const ms = doc.frames[0]?.durationMs ?? 100;
  const ticks = Math.max(1, Math.round((ms * 60) / 1000));
  return `SPRITE spr_${symbol} "${relativePng}" ${doc.width / TILE} ${doc.height / TILE} FAST ${ticks}`;
}

export function sanitizeSymbol(value: string): string {
  const clean = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return clean.length === 0 ? "sprite" : /^[0-9]/.test(clean) ? `s_${clean}` : clean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Linhas de scanline PNG 4-bit (filtro 0) prontas para zlib. */
export function packIndexedScanlines(indices: Uint8Array, width: number, height: number): Uint8Array {
  const rowBytes = Math.ceil(width / 2);
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (rowBytes + 1);
    for (let x = 0; x < width; x += 1) {
      const v = indices[y * width + x] & 15;
      raw[row + 1 + (x >> 1)] |= x % 2 === 0 ? v << 4 : v;
    }
  }
  return raw;
}

/** PNG indexado de 4 bits (16 cores, indice 0 transparente) — o formato que o rescomp le. */
export function encodeIndexedPng(width: number, height: number, palette: MdColor[], zlibData: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 4;
  ihdr[9] = 3;
  const plte = new Uint8Array(LINE_SIZE * 3);
  palette.slice(0, LINE_SIZE).forEach((color, i) => {
    plte[i * 3] = mdLevelTo8(color[0]);
    plte[i * 3 + 1] = mdLevelTo8(color[1]);
    plte[i * 3 + 2] = mdLevelTo8(color[2]);
  });
  const trns = new Uint8Array([0]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("tRNS", trns),
    chunk("IDAT", zlibData),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function zlibCompress(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function exportSheetPng(doc: PixelDoc): Promise<{ png: Uint8Array; line: number; width: number; height: number }> {
  const sheet = buildSheetIndices(doc);
  // An indexed sheet has one palette. Do not silently discard bank bits when
  // the same index represents different RGB colors in visible artwork.
  for (let fi = 0; fi < doc.frames.length; fi++) {
    for (const value of compositeFrame(doc, fi)) {
      const index = pixelIndex(value);
      if (index && !sameMdColor(doc.palettes[pixelLine(value)][index], doc.palettes[sheet.line][index]))
        throw new Error("A imagem mistura paletas com cores diferentes. Em Cores e filtros, visualize Unificar paletas antes de salvar; o documento e o original foram preservados.");
    }
  }
  const zlib = await zlibCompress(packIndexedScanlines(sheet.indices, sheet.width, sheet.height));
  return { png: encodeIndexedPng(sheet.width, sheet.height, doc.palettes[sheet.line], zlib), line: sheet.line, width: sheet.width, height: sheet.height };
}

// ── Formato nativo (.rdspixel.json) ────────────────────────────────────────

interface SerializedDoc extends Omit<PixelDoc, "frames"> {
  schema: "retrodev.pixel/v1";
  frames: { id: string; durationMs: number; cels: string[] }[];
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string, size: number): Uint8Array {
  const raw = atob(text);
  if (raw.length !== size) throw new Error("O documento contém um quadro incompleto. Preserve os arquivos e reabra a imagem original.");
  const out = new Uint8Array(size);
  for (let i = 0; i < Math.min(size, raw.length); i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function serializePixelDoc(doc: PixelDoc): string {
  const data: SerializedDoc = {
    ...doc,
    schema: "retrodev.pixel/v1",
    frames: doc.frames.map((f) => ({ id: f.id, durationMs: f.durationMs, cels: f.cels.map(toBase64) })),
  };
  return JSON.stringify(data);
}

export function deserializePixelDoc(json: string): PixelDoc {
  const data = JSON.parse(json) as SerializedDoc;
  if (data.schema !== "retrodev.pixel/v1") throw new Error("Arquivo de pixel art em formato desconhecido.");
  const size = data.width * data.height;
  if (!Number.isSafeInteger(data.width) || !Number.isSafeInteger(data.height) || data.width < 8 || data.height < 8 || data.width % 8 || data.height % 8 || !Array.isArray(data.frames) || !data.frames.length || !Array.isArray(data.layers) || !data.layers.length || size * data.frames.length * data.layers.length > 64 * 1024 * 1024) throw new Error("O documento de pixels possui medidas inválidas ou excede 64 MP somados.");
  if (typeof data.name !== "string" || !["sprite","plane"].includes(data.target) || !Array.isArray(data.palettes) || data.palettes.length !== 4 || data.palettes.some(p => !Array.isArray(p) || p.length !== 16 || p.some(c => !Array.isArray(c) || c.length !== 3 || c.some(v => !Number.isInteger(v) || v < 0 || v > 7)))) throw new Error("O documento possui uma paleta ou um tipo de imagem inválido.");
  if (data.frames.some(f => !Number.isFinite(f.durationMs) || f.durationMs < 1 || f.durationMs > 600000 || !Array.isArray(f.cels) || f.cels.length !== data.layers.length || f.cels.some(c => typeof c !== "string"))) throw new Error("O documento possui quadros incompletos ou durações inválidas.");
  return {
    name: data.name,
    originalSource: data.originalSource,
    conversionMethod: ["balanced", "dominant", "floyd"].includes(data.conversionMethod ?? "") ? data.conversionMethod : undefined,
    width: data.width,
    height: data.height,
    target: data.target,
    palettes: data.palettes,
    layers: data.layers,
    frames: data.frames.map((f) => ({ id: f.id, durationMs: f.durationMs, cels: f.cels.map((c) => fromBase64(c, size)) })),
  };
}
