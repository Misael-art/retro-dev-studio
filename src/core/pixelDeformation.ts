import { occurrenceIds } from "./characterTimeline";
import { imageAnimations } from "./imageIngress";
import type { AnimationDef } from "./ipc/sceneService";
import { newPixelId, type PixelDoc, type PixelEditScope } from "./pixelEditor";

export interface SpriteSequenceBinding {
  animations: Record<string, AnimationDef>;
  animation?: string;
  occurrence?: string;
}
export interface DeformationSize {
  width: number; height: number; shear: number; bend?: number;
  mirror?: "horizontal" | "vertical"; quarterTurn?: boolean;
}
/** A smooth bow is zero at both ends and reaches its signed amplitude halfway down. */
export function deformationOffset(t: number, shear: number, bend = 0) {
  return Math.round(t * shear + 4 * t * (1 - t) * bend);
}

/** Sample at pixel centers without inventing palette entries. The upper left corner
 * stays anchored. Shear moves the bottom edge horizontally; the sheet clips overflow. */
export function deformSpriteArea(doc: PixelDoc, scope: PixelEditScope, size: DeformationSize,
  sequence: boolean, binding?: SpriteSequenceBinding, previous?: PixelDoc) {
  const rect = scope.rect;
  if (!rect || rect.w < 1 || rect.h < 1 || rect.x < 0 || rect.y < 0 || rect.x + rect.w > doc.width || rect.y + rect.h > doc.height) throw new Error("Marque uma área no sprite.");
  const { width, height, shear, bend = 0 } = size;
  if (![width, height, shear, bend].every(Number.isSafeInteger) || width < 1 || height < 1 || width > (size.quarterTurn ? doc.height : doc.width) || height > (size.quarterTurn ? doc.width : doc.height) || Math.abs(shear) > doc.width || Math.abs(bend) > doc.width) throw new Error("Confira as medidas em pixels e os limites do quadro.");
  const targets = new Map<number, string[]>();
  const protectedFrames = new Set<number>();
  if (binding) {
    if (!previous) throw new Error("Aguarde a abertura da arte vinculada.");
    const animations = imageAnimations(binding.animations, doc, previous);
    const name = binding.animation;
    const selected = name && animations[name];
    if (!selected || selected.mugen_frames) throw new Error("Abra uma ocorrência de animação autoral na timeline para deformar o sprite.");
    const ids = occurrenceIds(selected);
    if (selected.frames[ids.indexOf(binding.occurrence ?? "")] !== scope.frame) throw new Error("Volte ao quadro da ocorrência selecionada na timeline.");
    for (const [animation, def] of Object.entries(animations)) {
      const occurrences = occurrenceIds(def);
      def.frames.forEach((frame, i) => {
        if (animation === name && (sequence || occurrences[i] === binding.occurrence)) {
          const entries = targets.get(frame) ?? [];
          entries.push(occurrences[i]);
          targets.set(frame, entries);
        } else protectedFrames.add(frame);
      });
    }
  } else {
    doc.frames.forEach((_, i) => { if (sequence || i === scope.frame) targets.set(i, []); });
  }
  const previewFrames = [...doc.frames], savedFrames = [...doc.frames];
  let currentFrame = scope.frame, changed = false;
  for (const [index, occurrences] of targets) {
    const frame = doc.frames[index];
    const src = frame.cels[scope.layer], out = src.slice();
    const selected = (v: number) => v !== 0 && (scope.color == null || v === scope.color);
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const pos = y * doc.width + x;
      if (selected(src[pos])) out[pos] = 0;
    }
    for (let dy = 0; dy < Math.min(height, doc.height - rect.y); dy++) {
      const left = rect.x + deformationOffset(dy / Math.max(1, height - 1), shear, bend);
      const row = Math.floor((dy + 0.5) * (size.quarterTurn ? rect.w : rect.h) / height);
      for (let x = Math.max(left, 0); x < Math.min(left + width, doc.width); x++) {
        const column = Math.floor((x - left + 0.5) * (size.quarterTurn ? rect.h : rect.w) / width);
        const sx = rect.x + (size.quarterTurn ? row : size.mirror === "horizontal" ? rect.w - 1 - column : column);
        const sy = rect.y + (size.quarterTurn ? rect.h - 1 - column : size.mirror === "vertical" ? rect.h - 1 - row : row);
        const value = src[sy * doc.width + sx];
        const dest = (rect.y + dy) * doc.width + x;
        if (selected(value) && (scope.color == null || !src[dest] || src[dest] === scope.color)) out[dest] = value;
      }
    }
    if (out.every((v, i) => v === src[i])) continue;
    changed = true;
    const edited = { ...frame, cels: frame.cels.map((cel, layer) => layer === scope.layer ? out : cel) };
    previewFrames[index] = edited;
    if (binding?.animation && protectedFrames.has(index)) {
      if ((savedFrames.length + 1) * doc.layers.length * doc.width * doc.height > 64 * 1024 * 1024) throw new Error("A variante excede o limite de 64 MP do documento.");
      if (index === scope.frame) currentFrame = savedFrames.length;
      savedFrames.push({ ...edited, id: newPixelId("frame"), variant: { sourceId: frame.id, animation: binding.animation, occurrences } });
    } else savedFrames[index] = edited;
  }
  return { preview: changed ? { ...doc, frames: previewFrames } : doc, doc: changed ? { ...doc, frames: savedFrames } : doc, currentFrame };
}
