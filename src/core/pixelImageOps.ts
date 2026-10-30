/** Image operations over the canonical indexed document. No second editor state. */
import { addLayer, alignToTile, channelToMd, mdLevelTo8, newPixelId, pixelIndex, pixelLine, quantizeRgba, type MdColor, type PixelDoc, type PixelRect, type PixelEditScope } from "./pixelEditor";
export type { PixelEditScope } from "./pixelEditor";

/** Publish through the existing writer under a new name; the prior resource
 * remains usable by other occurrences and scenes. Name and pixels share Undo. */
export function copyPixelDoc(doc: PixelDoc): PixelDoc {
  return { ...doc, name: `${doc.name.split("_copy_")[0].slice(0, 48)}_${newPixelId("copy")}` };
}

/** Explicit whole-resource conversion, including hidden layers and all frames.
 * The preview makes the 15-color reduction reversible before publishing a PNG. */
export function unifyPixelPalettes(doc: PixelDoc): PixelDoc {
  const counts = new Uint32Array(64);
  doc.frames.forEach(frame => frame.cels.forEach(cel => { for (const value of cel) if (pixelIndex(value)) counts[value]++; }));
  const colors = new Map<string, { rgb: number[]; count: number }>();
  counts.forEach((count, value) => {
    if (!count) return;
    const rgb = rgbOf(doc, value), key = rgb.join(","), old = colors.get(key);
    colors.set(key, { rgb, count: count + (old?.count ?? 0) });
  });
  // There are at most 60 visible source entries. Pass distinct colors in
  // frequency order to the canonical quantizer instead of expanding 64 MP to RGBA.
  const ranked = [...colors.values()].sort((a, b) => b.count - a.count);
  const quantized = quantizeRgba(Uint8Array.from(ranked.flatMap(c => [...c.rgb, 255])), ranked.length, 1, 0);
  const mapped = new Map(ranked.map((color, i) => [color.rgb.join(","), quantized.pixels[i]]));
  const lookup = Array.from(counts, (count, value) => count ? mapped.get(rgbOf(doc, value).join(",")) ?? 0 : 0);
  return { ...doc, palettes: doc.palettes.map((p, i) => i === 0 ? quantized.palette : p),
    frames: doc.frames.map(frame => ({ ...frame, cels: frame.cels.map(cel => cel.map(value => lookup[value])) })) };
}

export type PixelEffect = "grayscale" | "sepia" | "invert" | "fire" | "cold" | "lightning" | "xray" | "glow" | "radioactive" | "cel" | "saturate" | "blur" | "pixelate" | "adjust";
export const PIXEL_EFFECTS: { id: PixelEffect; name: string; hint: string }[] = [
  { id: "grayscale", name: "Preto e branco", hint: "Tons de cinza" },
  { id: "sepia", name: "Sépia", hint: "Tons quentes de fotografia antiga" },
  { id: "invert", name: "Invertido", hint: "Inverte os canais de cor" },
  { id: "fire", name: "Fogo", hint: "Rampa de preto, vermelho e amarelo" },
  { id: "cold", name: "Frio", hint: "Rampa azul e ciano" },
  { id: "lightning", name: "Raio", hint: "Realça arestas em azul elétrico" },
  { id: "xray", name: "Raio X", hint: "Negativo monocromático azulado" },
  { id: "glow", name: "Luz", hint: "Halo nas áreas claras" },
  { id: "radioactive", name: "Radioativo", hint: "Rampa verde luminosa" },
  { id: "cel", name: "Anime / cel shading", hint: "Posterização e contornos escuros; não redesenha personagens" },
  { id: "saturate", name: "Saturação", hint: "Reforça as diferenças de cor" },
  { id: "blur", name: "Desfoque gaussiano", hint: "Suaviza com um núcleo gaussiano de 3×3" },
  { id: "pixelate", name: "Pixels maiores", hint: "Agrupa pixels em blocos, sem aumentar o canvas" },
];

const clamp = (n: number, max = 255) => Math.max(0, Math.min(max, n));
const luma = (rgb: number[]) => rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114;
const rgbOf = (doc: PixelDoc, value: number) => doc.palettes[pixelLine(value)][pixelIndex(value)].map(mdLevelTo8);
export function inPixelScope(doc: PixelDoc, scope: PixelEditScope, frame: number, layer: number, index: number): boolean {
  if (layer !== scope.layer || (!scope.allFrames && frame !== scope.frame)) return false;
  const rect = scope.rect, x = index % doc.width, y = Math.floor(index / doc.width);
  if (rect && (x < rect.x || y < rect.y || x >= rect.x + rect.w || y >= rect.y + rect.h)) return false;
  return scope.color == null || doc.frames[frame].cels[layer][index] === scope.color;
}

/** Transform in RGB, then allocate only slots unused by pixels OUTSIDE the edit.
 * Hidden layers/other frames count as consumers, so a local filter cannot recolor them. */
export function applyPixelEffect(doc: PixelDoc, scope: PixelEditScope, effect: PixelEffect, options: { brightness?: number; contrast?: number; block?: number } = {}): { doc: PixelDoc; approximated: number } {
  if (doc.width * doc.height * (scope.allFrames ? doc.frames.length : 1) > 4 * 1024 * 1024)
    throw new Error("O filtro excede 4 milhões de pixels de trabalho. Edite um quadro por vez ou reduza a imagem; o documento foi preservado.");
  const selected: { fi: number; rgba: Uint8ClampedArray; mask: Uint8Array }[] = [];
  const reserved = Array.from({ length: 4 }, () => new Set<number>());
  doc.frames.forEach((frame, fi) => frame.cels.forEach((cel, li) => {
    for (let i = 0; i < cel.length; i++) if (pixelIndex(cel[i]) && !inPixelScope(doc, scope, fi, li, i)) reserved[pixelLine(cel[i])].add(pixelIndex(cel[i]));
  }));
  doc.frames.forEach((frame, fi) => {
    if (!scope.allFrames && fi !== scope.frame) return;
    const cel = frame.cels[scope.layer];
    if (!cel) return;
    const rgba = new Uint8ClampedArray(cel.length * 4), mask = new Uint8Array(cel.length);
    const at = (x: number, y: number, fallback: number) => {
      const index = clamp(Math.round(y), doc.height - 1) * doc.width + clamp(Math.round(x), doc.width - 1);
      // Spatial filters never sample outside the chosen region/color.
      return inPixelScope(doc, scope, fi, scope.layer, index) && pixelIndex(cel[index]) ? rgbOf(doc, cel[index]) : rgbOf(doc, fallback);
    };
    for (let i = 0; i < cel.length; i++) {
      if (!pixelIndex(cel[i]) || !inPixelScope(doc, scope, fi, scope.layer, i)) continue;
      const x = i % doc.width, y = Math.floor(i / doc.width), rgb = rgbOf(doc, cel[i]);
      const average = [0, 0, 0];
      if (["blur", "glow"].includes(effect)) {
        const weights = [1, 2, 1];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const sample = at(x + dx, y + dy, cel[i]), weight = weights[dx + 1] * weights[dy + 1] / 16;
          for (let c = 0; c < 3; c++) average[c] += sample[c] * weight;
        }
      }
      const edge = Math.abs(luma(at(x + 1, y, cel[i])) - luma(at(x - 1, y, cel[i]))) + Math.abs(luma(at(x, y + 1, cel[i])) - luma(at(x, y - 1, cel[i])));
      const color = effectRgb(rgb, effect, options, average, edge);
      if (effect === "pixelate") {
        const block = Math.max(2, Math.min(16, Math.round(options.block ?? 4)));
        const originX = scope.rect?.x ?? 0, originY = scope.rect?.y ?? 0;
        color.splice(0, 3, ...at(originX + Math.floor((x - originX) / block) * block, originY + Math.floor((y - originY) / block) * block, cel[i]));
      }
      rgba.set([...color.map(c => Math.round(clamp(c))), 255], i * 4); mask[i] = 1;
    }
    selected.push({ fi, rgba, mask });
  });
  const palettes = doc.palettes.map(p => p.map(c => [...c] as MdColor));
  const replacements = new Map<number, Uint8Array>();
  let approximated = 0;
  for (let line = 0; line < 4; line++) {
    const strip = new Uint8ClampedArray(doc.width * doc.height * selected.length * 4);
    selected.forEach((s, n) => {
      const cel = doc.frames[s.fi].cels[scope.layer];
      for (let i = 0; i < cel.length; i++) if (s.mask[i] && pixelLine(cel[i]) === line) strip.set(s.rgba.subarray(i * 4, i * 4 + 4), (n * cel.length + i) * 4);
    });
    if (!strip.some((v, i) => i % 4 === 3 && v)) continue;
    const result = quantizeRgba(strip, doc.width, doc.height * selected.length, line, palettes[line], { lockedSlots: [...reserved[line]] });
    palettes[line] = result.palette;
    selected.forEach((s, n) => {
      const cel = replacements.get(s.fi) ?? new Uint8Array(doc.frames[s.fi].cels[scope.layer]);
      for (let i = 0; i < cel.length; i++) if (s.mask[i] && pixelLine(doc.frames[s.fi].cels[scope.layer][i]) === line) {
        cel[i] = result.pixels[n * cel.length + i];
        const actual = palettes[line][pixelIndex(cel[i])];
        if (actual.some((c, ch) => c !== channelToMd(s.rgba[i * 4 + ch]))) approximated++;
      }
      replacements.set(s.fi, cel);
    });
  }
  if (!replacements.size) return { doc, approximated: 0 };
  return { doc: { ...doc, palettes, frames: doc.frames.map((f, fi) => replacements.has(fi) ? { ...f, cels: f.cels.map((c, li) => li === scope.layer ? replacements.get(fi)! : c) } : f) }, approximated };
}

export function effectRgb(rgb: number[], effect: PixelEffect, options: { brightness?: number; contrast?: number } = {}, blurred = rgb, edge = 0): number[] {
  const [r, g, b] = rgb, y = luma(rgb), t = y / 255;
  switch (effect) {
    case "grayscale": return [y, y, y];
    case "sepia": return [.393 * r + .769 * g + .189 * b, .349 * r + .686 * g + .168 * b, .272 * r + .534 * g + .131 * b];
    case "invert": return [255 - r, 255 - g, 255 - b];
    case "fire": return [clamp(t * 3, 1) * 255, clamp(t * 3 - 1, 1) * 255, clamp(t * 3 - 2, 1) * 255];
    case "cold": return [y * .3, y * .85, Math.min(255, y * 1.3)];
    case "xray": return [(255 - y) * .65, (255 - y) * .9, 255 - y];
    case "radioactive": return [y * .4, Math.min(255, y * 1.4), y * .15];
    case "lightning": return [Math.min(255, y * .3 + edge * .7), Math.min(255, y * .6 + edge), Math.min(255, y + edge)];
    case "glow": return rgb.map((c, i) => c + Math.max(0, blurred[i] - 100) * .6);
    case "blur": return blurred;
    case "cel": return edge > 100 ? [0, 0, 0] : rgb.map(c => Math.round(c / 85) * 85);
    case "saturate": return rgb.map(c => y + (c - y) * 1.7);
    case "adjust": return rgb.map(c => (c - 127.5) * (1 + (options.contrast ?? 0) / 100) + 127.5 + (options.brightness ?? 0) * 2.55);
    default: return [...rgb];
  }
}

function dimensions(doc: PixelDoc, width: number, height: number): [number, number] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 512 || height > 512) throw new Error("Use medidas de 1 a 512 pixels. O resultado se alinha a tiles de 8 pixels.");
  const w = alignToTile(width), h = alignToTile(height);
  if (w * h * doc.frames.length * doc.layers.length > 64 * 1024 * 1024) throw new Error("Esta edição ultrapassa 64 milhões de pixels somando quadros e camadas.");
  return [w, h];
}

export function cropPixelDoc(doc: PixelDoc, rect: PixelRect): PixelDoc {
  const x = clamp(Math.floor(rect.x), doc.width - 1), y = clamp(Math.floor(rect.y), doc.height - 1);
  const cw = Math.max(1, Math.min(doc.width - x, Math.round(rect.w))), ch = Math.max(1, Math.min(doc.height - y, Math.round(rect.h)));
  const [w, h] = dimensions(doc, cw, ch);
  return { ...doc, width: w, height: h, frames: doc.frames.map(f => ({ ...f, cels: f.cels.map(c => {
    const out = new Uint8Array(w * h);
    for (let dy = 0; dy < ch; dy++) out.set(c.subarray((y + dy) * doc.width + x, (y + dy) * doc.width + x + cw), dy * w);
    return out;
  }) })) };
}

export function scalePixelDoc(doc: PixelDoc, width: number, height: number): PixelDoc {
  const [w, h] = dimensions(doc, width, height);
  return { ...doc, width: w, height: h, frames: doc.frames.map(f => ({ ...f, cels: f.cels.map(c => Uint8Array.from({ length: w * h }, (_, i) => c[Math.floor(Math.floor(i / w) * doc.height / h) * doc.width + Math.floor((i % w) * doc.width / w)])) })) };
}

export function rotatePixelDoc(doc: PixelDoc): PixelDoc {
  return { ...doc, width: doc.height, height: doc.width, frames: doc.frames.map(f => ({ ...f, cels: f.cels.map(c => {
    const out = new Uint8Array(c.length);
    for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) out[x * doc.height + doc.height - y - 1] = c[y * doc.width + x];
    return out;
  }) })) };
}

export function duplicatePixelLayer(doc: PixelDoc, layer: number): PixelDoc {
  if (doc.width * doc.height * doc.frames.length * (doc.layers.length + 1) > 64 * 1024 * 1024) throw new Error("A cópia ultrapassaria 64 milhões de pixels no documento. A camada original foi preservada.");
  const meta = doc.layers[layer];
  return { ...doc, layers: [...doc.layers.slice(0, layer + 1), { ...meta, id: newPixelId("layer"), name: `${meta.name} — cópia` }, ...doc.layers.slice(layer + 1)], frames: doc.frames.map(f => ({ ...f, cels: [...f.cels.slice(0, layer + 1), new Uint8Array(f.cels[layer]), ...f.cels.slice(layer + 1)] })) };
}

export function mergePixelLayerDown(doc: PixelDoc, layer: number): PixelDoc {
  if (layer < 1) return doc;
  if (!doc.layers[layer].visible || !doc.layers[layer - 1].visible) throw new Error("Mostre as duas camadas antes de unir. As camadas ocultas foram preservadas.");
  return { ...doc, layers: doc.layers.filter((_, i) => i !== layer), frames: doc.frames.map(f => ({ ...f, cels: f.cels.filter((_, i) => i !== layer).map((c, i) => i === layer - 1 ? Uint8Array.from(c, (p, index) => pixelIndex(f.cels[layer][index]) ? f.cels[layer][index] : p) : c) })) };
}

/** Add a border as a separate editable layer; no destructive flattening. */
export function addPixelBorder(doc: PixelDoc, scope: PixelEditScope, value: number, thickness: number, outline: boolean): PixelDoc {
  const next = addLayer(doc, outline ? "Contorno" : "Moldura"), n = Math.max(1, Math.min(8, Math.round(thickness)));
  const r = scope.rect ?? { x: 0, y: 0, w: doc.width, h: doc.height };
  for (let fi = 0; fi < doc.frames.length; fi++) {
    if (!scope.allFrames && fi !== scope.frame) continue;
    const source = doc.frames[fi].cels[scope.layer], dest = next.frames[fi].cels[next.layers.length - 1];
    for (let y = Math.max(0, r.y); y < Math.min(doc.height, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(doc.width, r.x + r.w); x++) {
      const i = y * doc.width + x;
      if (!outline) { if (x < r.x + n || y < r.y + n || x >= r.x + r.w - n || y >= r.y + r.h - n) dest[i] = value; continue; }
      if (pixelIndex(source[i])) continue;
      for (let dy = -n; dy <= n && !dest[i]; dy++) for (let dx = -n; dx <= n; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < doc.width && yy < doc.height && pixelIndex(source[yy * doc.width + xx]) && (scope.color == null || source[yy * doc.width + xx] === scope.color)) { dest[i] = value; break; }
      }
    }
  }
  return next;
}

/** Merge a prepared image into a new layer using current colors. Other layers,
 * frames and palette slots remain untouched; animation count is never truncated. */
export function collagePixelDoc(doc: PixelDoc, source: PixelDoc, frame: number, line: number): PixelDoc {
  if (source.frames.length !== 1 && source.frames.length !== doc.frames.length) throw new Error("A imagem tem outra quantidade de quadros. Abra-a como recurso separado ou use uma imagem estática na colagem.");
  if (source.frames.length > 1 && source.frames.some((f, i) => f.durationMs !== doc.frames[i].durationMs)) throw new Error("As animações têm durações diferentes. Abra a imagem como recurso separado ou alinhe os tempos antes de fazer a colagem; nenhum quadro foi alterado.");
  const next = addLayer(doc, source.name), scale = Math.min(1, doc.width / source.width, doc.height / source.height);
  next.layers[next.layers.length - 1].originalSource = source.originalSource;
  const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((doc.width - w) / 2), offsetY = Math.floor((doc.height - h) / 2);
  for (let fi = 0; fi < doc.frames.length; fi++) {
    if (source.frames.length === 1 && fi !== frame) continue;
    const src = source.frames[source.frames.length === 1 ? 0 : fi];
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const at = Math.floor(y * source.height / h) * source.width + Math.floor(x * source.width / w);
      let value = 0;
      source.layers.forEach((l, li) => { if (l.visible && pixelIndex(src.cels[li][at])) value = src.cels[li][at]; });
      if (pixelIndex(value)) rgba.set([...rgbOf(source, value), 255], (y * w + x) * 4);
    }
    const converted = quantizeRgba(rgba, w, h, line, doc.palettes[line], { lockedSlots: Array.from({ length: 15 }, (_, i) => i + 1) });
    const dest = next.frames[fi].cels[next.layers.length - 1];
    for (let y = 0; y < h; y++) dest.set(converted.pixels.subarray(y * w, (y + 1) * w), (offsetY + y) * doc.width + offsetX);
  }
  return next;
}

/** Connected color erasure: one click samples the background; enclosed regions
 * of the same color remain untouched. This is a color tool, not neural matting. */
export function erasePixelRegion(doc: PixelDoc, scope: PixelEditScope, x: number, y: number, tolerance: number): PixelDoc {
  let changed = false;
  const frames = doc.frames.map((frame, fi) => {
    if (!scope.allFrames && fi !== scope.frame) return frame;
    const cel = frame.cels[scope.layer], start = y * doc.width + x;
    if (!cel || !pixelIndex(cel[start])) return frame;
    const seed = rgbOf(doc, cel[start]), queue = [start], seen = new Uint8Array(cel.length), out = new Uint8Array(cel);
    for (let n = 0; n < queue.length; n++) {
      const i = queue[n]; if (seen[i]) continue; seen[i] = 1;
      if (!pixelIndex(cel[i]) || !inPixelScope(doc, scope, fi, scope.layer, i) || rgbOf(doc, cel[i]).some((c, ch) => Math.abs(c - seed[ch]) > tolerance)) continue;
      out[i] = 0; changed = true; const px = i % doc.width, py = Math.floor(i / doc.width);
      if (px) queue.push(i - 1); if (px < doc.width - 1) queue.push(i + 1);
      if (py) queue.push(i - doc.width); if (py < doc.height - 1) queue.push(i + doc.width);
    }
    return { ...frame, cels: frame.cels.map((c, li) => li === scope.layer ? out : c) };
  });
  return changed ? { ...doc, frames } : doc;
}
