import type { Entity, PathComponent, PathPoint } from "./ipc/sceneService";

/** R5 limits — must match `path_issue` in src-tauri/src/ugdm/components.rs. */
export const PATH_MAX_POINTS = 16;
export const PATH_MAX_FRAMES = 600;
export const PATH_MAX_OFFSET = 2048;

/** Availability mirrors platform_support::path_support_issues, before any authored mutation. */
export function pathBlockedReason(target: string, entity: Entity | null | undefined): string | null {
  if (target !== "megadrive") return "Trajetos ainda não têm execução nesta plataforma. Disponíveis no Mega Drive (Experimental).";
  if (!entity?.components.sprite) return "Selecione um objeto com sprite para desenhar seu trajeto.";
  if (entity.components.physics || entity.components.input) return "Este objeto tem física/entrada, que também movem a posição; remova esse conflito antes de editar o trajeto.";
  return null;
}

/** Preserve the closing leg when opening a loop; never drop its curve or insert a teleport. */
export function planPathModeChange(path: PathComponent, mode: PathComponent["mode"]): { path: PathComponent; notice: string | null } | { issue: string } {
  const issue = pathIssue(path);
  if (issue) return { issue };
  if (path.mode === mode) return { path, notice: null };
  let points = path.points.map((p) => ({ ...p, curve: p.curve ? { ...p.curve } : p.curve }));
  let notice: string | null = null;
  if (path.mode === "loop" && mode !== "loop") {
    if (points.length >= PATH_MAX_POINTS) return { issue: "Para conservar o retorno curvo, é preciso um ponto livre (máximo 16). Remova um ponto antes de abrir este trajeto." };
    const first = points[0]!;
    points = [{ ...first, curve: null }, ...points.slice(1), { ...first }];
    notice = "O retorno foi conservado como último ponto, incluindo curva, duração e espera.";
  } else if (mode === "loop") {
    const last = points[points.length - 1]!;
    if (points.length > 2 && last.x === 0 && last.y === 0) {
      points = [{ ...last }, ...points.slice(1, -1)];
      notice = "O último trecho passa a ser o retorno ao ponto 0, com a mesma curva, duração e espera.";
    } else {
      points[0] = { ...points[0]!, frames: points[0]!.frames > 0 ? points[0]!.frames : last.frames };
      notice = "Retorno explícito ao ponto 0: confira a duração e a curva do retorno.";
    }
  }
  const next = { ...path, mode, points };
  const nextIssue = pathIssue(next);
  return nextIssue ? { issue: nextIssue } : { path: next, notice };
}

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
    if (p.curve) {
      if (![p.curve.x, p.curve.y].every(Number.isInteger)) return `curva do ponto ${i}: use números inteiros`;
      if (Math.abs(p.curve.x) > PATH_MAX_OFFSET || Math.abs(p.curve.y) > PATH_MAX_OFFSET) return `curva do ponto ${i} fora de ±${PATH_MAX_OFFSET} px`;
      if (i === 0 && path.mode !== "loop") return "o ponto 0 só tem curva no modo loop (retorno)";
    }
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

/** Steady-state cycle, including each arrival's wait. Initial wait is separate for once. */
export function pathCycleFrames(path: PathComponent): number {
  const first = path.points[0]!;
  const legs = path.points.slice(1).reduce((sum, p) => sum + p.frames, 0);
  const waits = path.points.slice(1).reduce((sum, p) => sum + p.wait, 0);
  if (path.mode === "loop") return legs + first.frames + waits + first.wait;
  if (path.mode === "pingpong") return 2 * legs + 2 * waits - path.points[path.points.length - 1]!.wait + first.wait;
  return first.wait + legs + waits;
}

/** World positions of the path points (spawn + relative offsets). */
export function pathWorldPoints(spawn: { x: number; y: number }, path: PathComponent): Array<{ x: number; y: number }> {
  return path.points.map((p) => ({ x: spawn.x + p.x, y: spawn.y + p.y }));
}

/**
 * Index of the draggable handle under (mx, my) in world units, or null. Point 0 is the object's
 * own position and is never a path handle; the nearest handle wins on overlap.
 */
export function hitPathHandle(points: Array<{ x: number; y: number }>, mx: number, my: number, radius: number): number | null {
  let best: number | null = null;
  let bestDist = radius * radius;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i]!.x - mx;
    const dy = points[i]!.y - my;
    const d = dx * dx + dy * dy;
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/** Relative offset for a handle dropped at world (wx, wy), clamped and rounded to integers. */
export function dropOffset(spawn: { x: number; y: number }, wx: number, wy: number): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-PATH_MAX_OFFSET, Math.min(PATH_MAX_OFFSET, Math.round(v)));
  return { x: clamp(wx - spawn.x), y: clamp(wy - spawn.y) };
}

/** Segment (from -> to) sampled exactly like the ROM formula (integer division), for previews. */
export function sampleSegment(from: { x: number; y: number }, to: PathPoint, frames: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const f = Math.max(1, frames);
  const div = (n: number, d: number) => Math.trunc(n / d);
  for (let t = 1; t <= f; t += 1) {
    const u = f - t;
    if (to.curve) {
      out.push({
        x: div(from.x * u * u + 2 * to.curve.x * u * t + to.x * t * t, f * f),
        y: div(from.y * u * u + 2 * to.curve.y * u * t + to.y * t * t, f * f),
      });
    } else {
      out.push({ x: from.x + div((to.x - from.x) * t, f), y: from.y + div((to.y - from.y) * t, f) });
    }
  }
  return out;
}

/** Toggle a point's curve; a new control starts at the segment midpoint (no visual jump). */
export function toggleCurve(path: PathComponent, index: number): PathComponent {
  const point = path.points[index];
  if (!point || (index === 0 && path.mode !== "loop")) return path;
  if (point.curve) return withPoint(path, index, { curve: null });
  const prev = index === 0 ? path.points[path.points.length - 1]! : path.points[index - 1]!;
  return withPoint(path, index, { curve: { x: Math.round((prev.x + point.x) / 2), y: Math.round((prev.y + point.y) / 2) } });
}

/**
 * Ellipse as `segments` quadratic curves (loop), centred so it starts at the object (point 0 =
 * leftmost point). Controls sit on tangent intersections; an approximation, labelled as such.
 */
export function ellipsePath(rx: number, ry: number, segments = 8, framesPerSegment = 15): PathComponent {
  const n = Math.max(4, Math.min(PATH_MAX_POINTS, Math.round(segments)));
  const cx = rx;
  const step = (Math.PI * 2) / n;
  const angle = (k: number) => Math.PI + k * step;
  // `+ 0` normalises -0 from rounding (e.g. sin(2π)) so the model never stores -0.
  const r = (v: number) => Math.round(v) + 0;
  const pt = (k: number) => ({ x: r(cx + rx * Math.cos(angle(k))), y: r(ry * Math.sin(angle(k))) });
  const control = (k: number) => {
    const mid = angle(k) - step / 2;
    const scale = 1 / Math.cos(step / 2);
    return { x: r(cx + rx * scale * Math.cos(mid)), y: r(ry * scale * Math.sin(mid)) };
  };
  const points: PathPoint[] = [];
  for (let k = 0; k < n; k += 1) {
    const p = pt(k);
    points.push({ x: k === 0 ? 0 : p.x, y: k === 0 ? 0 : p.y, frames: framesPerSegment, wait: 0, curve: control(k === 0 ? n : k) });
  }
  return { mode: "loop", points };
}

/** Hit-test of draggable handles: path points (index > 0) and curve controls (any index with a curve). */
export function hitPathHandleOrControl(
  spawn: { x: number; y: number },
  path: PathComponent,
  mx: number,
  my: number,
  radius: number,
): { index: number; kind: "point" | "control" } | null {
  let best: { index: number; kind: "point" | "control" } | null = null;
  let bestDist = radius * radius;
  path.points.forEach((p, index) => {
    const candidates: Array<{ x: number; y: number; kind: "point" | "control" }> = [];
    if (index > 0) candidates.push({ x: spawn.x + p.x, y: spawn.y + p.y, kind: "point" });
    if (p.curve) candidates.push({ x: spawn.x + p.curve.x, y: spawn.y + p.curve.y, kind: "control" });
    for (const c of candidates) {
      const d = (c.x - mx) ** 2 + (c.y - my) ** 2;
      if (d <= bestDist) {
        best = { index, kind: c.kind };
        bestDist = d;
      }
    }
  });
  return best;
}
