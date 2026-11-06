import type { PathComponent, PathPoint } from "./ipc/sceneService";

/** R5 limits — must match `path_issue` in src-tauri/src/ugdm/components.rs. */
export const PATH_MAX_POINTS = 16;
export const PATH_MAX_FRAMES = 600;
export const PATH_MAX_OFFSET = 2048;

/** Same refusal rules the build applies; null = valid. */
export function pathIssue(path: PathComponent): string | null {
  if (!["once", "loop", "pingpong"].includes(path.mode)) return `modo '${path.mode}' inválido`;
  if (path.points.length < 2 || path.points.length > PATH_MAX_POINTS) return `use de 2 a ${PATH_MAX_POINTS} pontos`;
  const first = path.points[0]!;
  if (first.x !== 0 || first.y !== 0) return "o primeiro ponto deve ser (0,0), a posição inicial do objeto";
  for (let i = 0; i < path.points.length; i += 1) {
    const p = path.points[i]!;
    if (![p.x, p.y, p.frames, p.wait].every(Number.isInteger)) return `ponto ${i}: use números inteiros`;
    if (Math.abs(p.x) > PATH_MAX_OFFSET || Math.abs(p.y) > PATH_MAX_OFFSET) return `ponto ${i} fora de ±${PATH_MAX_OFFSET} px`;
    const needsFrames = i > 0 || path.mode === "loop";
    if (needsFrames && (p.frames < 1 || p.frames > PATH_MAX_FRAMES)) return `ponto ${i}: duração de 1 a ${PATH_MAX_FRAMES} quadros`;
    if (p.wait < 0 || p.wait > PATH_MAX_FRAMES) return `ponto ${i}: espera de 0 a ${PATH_MAX_FRAMES} quadros`;
  }
  return null;
}

export function defaultPath(): PathComponent {
  return { mode: "pingpong", points: [{ x: 0, y: 0, frames: 0, wait: 0 }, { x: 64, y: 0, frames: 60, wait: 30 }] };
}

/** Immutable point edit shared by numeric fields and Canvas drag; point 0 stays at (0,0). */
export function withPoint(path: PathComponent, index: number, patch: Partial<PathPoint>): PathComponent {
  return {
    ...path,
    points: path.points.map((p, i) => {
      if (i !== index) return p;
      const next = { ...p, ...patch };
      return i === 0 ? { ...next, x: 0, y: 0 } : next;
    }),
  };
}

export function addPoint(path: PathComponent): PathComponent {
  if (path.points.length >= PATH_MAX_POINTS) return path;
  const last = path.points[path.points.length - 1]!;
  return { ...path, points: [...path.points, { x: last.x + 32, y: last.y, frames: 30, wait: 0 }] };
}

export function removePoint(path: PathComponent, index: number): PathComponent {
  if (index === 0 || path.points.length <= 2) return path;
  return { ...path, points: path.points.filter((_, i) => i !== index) };
}

/** Total frames of one pass (useful for the editor estimate; the ROM is the authority). */
export function pathCycleFrames(path: PathComponent): number {
  const legs = path.points.slice(1).reduce((sum, p) => sum + p.frames + p.wait, 0);
  if (path.mode === "loop") return legs + path.points[0]!.frames + path.points[0]!.wait;
  if (path.mode === "pingpong") return legs * 2;
  return legs;
}
