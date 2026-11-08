import { describe, expect, it } from "vitest";
import { addPoint, defaultPath, ellipsePath, pathCycleFrames, pathIssue, planPathModeChange, removePoint, sampleSegment, withPoint } from "./objectPath";

describe("R5 object path model", () => {
  it("default path is valid and point 0 cannot move (no hidden jump)", () => {
    const path = defaultPath();
    expect(pathIssue(path)).toBeNull();
    expect(withPoint(path, 0, { x: 40, y: 9, wait: 5 }).points[0]).toEqual({ x: 0, y: 0, frames: 0, wait: 5 });
  });

  it("mirrors the build refusals", () => {
    const path = defaultPath();
    expect(pathIssue(withPoint(path, 1, { frames: 0 }))).toContain("duração");
    expect(pathIssue(withPoint(path, 1, { x: 5000 }))).toContain("fora");
    expect(pathIssue(withPoint(path, 1, { x: 1.5 }))).toContain("inteiros");
    expect(pathIssue({ ...path, mode: "loop" })).toContain("ponto 0");
    expect(pathIssue({ ...path, points: path.points.slice(0, 1) })).toContain("2 a 16");
  });

  it("adds/removes points within limits and keeps the origin", () => {
    let path = defaultPath();
    path = addPoint(path);
    expect(path.points).toHaveLength(3);
    expect(removePoint(path, 0).points).toHaveLength(3);
    expect(removePoint(removePoint(path, 2), 1).points).toHaveLength(2);
    for (let i = 0; i < 30; i += 1) path = addPoint(path);
    expect(path.points).toHaveLength(16);
  });

  it("estimates cycle length per mode", () => {
    const path = defaultPath();
    expect(pathCycleFrames(path)).toBe(60 * 2 + 30);
    expect(pathCycleFrames({ ...path, mode: "once" })).toBe(90);
  });
});

describe("RC03/08 path transitions and asymmetric waits", () => {
  it("keeps every directed segment when opening/closing an ellipse, with manual start", () => {
    const original = { ...ellipsePath(48, 24), autostart: false };
    for (const mode of ["once", "pingpong"] as const) {
      const proposal = planPathModeChange(original, mode);
      expect("issue" in proposal).toBe(false);
      if (!("path" in proposal)) throw new Error("mode rejected");
      expect(pathIssue(proposal.path)).toBeNull();
      expect(proposal.path.autostart).toBe(false);
      expect(proposal.path.points).toHaveLength(9);
      expect(proposal.path.points[0]!.curve).toBeNull();
      const closure = proposal.path.points[proposal.path.points.length - 1]!;
      expect(closure).toEqual(original.points[0]);
      const last = original.points[original.points.length - 1]!;
      expect(sampleSegment(last, closure, closure.frames)).toEqual(sampleSegment(last, original.points[0]!, original.points[0]!.frames));
      expect(planPathModeChange(proposal.path, "loop")).toMatchObject({ path: original });
    }
  });

  it("all six mode transitions are valid and do not mutate the input", () => {
    for (const from of ["once", "loop", "pingpong"] as const) {
      const path = from === "loop" ? ellipsePath(20, 10) : { ...defaultPath(), mode: from };
      const before = JSON.stringify(path);
      for (const to of ["once", "loop", "pingpong"] as const) {
        const result = planPathModeChange(path, to);
        if (!("path" in result)) throw new Error(result.issue);
        expect(pathIssue(result.path)).toBeNull();
      }
      expect(JSON.stringify(path)).toBe(before);
    }
  });

  it("refuses opening a full closed path rather than discarding its closing curve", () => {
    const path = ellipsePath(48, 24, 16);
    expect(planPathModeChange(path, "pingpong")).toHaveProperty("issue");
    expect(path.points).toHaveLength(16);
  });

  it("counts internal waits twice and endpoint waits once per pingpong cycle", () => {
    const path = { mode: "pingpong" as const, points: [
      { x: 0, y: 0, frames: 0, wait: 7 }, { x: 30, y: 0, frames: 10, wait: 3 }, { x: 60, y: 0, frames: 20, wait: 11 },
    ] };
    expect(pathCycleFrames(path)).toBe(60 + 6 + 11 + 7);
    expect(pathCycleFrames({ ...path, mode: "once" })).toBe(7 + 30 + 3 + 11);
  });
});

describe("R5 canvas handles geometry", () => {
  it("maps points to world, hits the nearest draggable handle and never point 0", async () => {
    const { pathWorldPoints, hitPathHandle, dropOffset, defaultPath, withPoint } = await import("./objectPath");
    const path = withPoint(withPoint(defaultPath(), 1, { x: 64, y: 0 }), 0, {});
    const pts = pathWorldPoints({ x: 100, y: 50 }, { ...path, points: [...path.points, { x: 66, y: 2, frames: 10, wait: 0 }] });
    expect(pts).toEqual([{ x: 100, y: 50 }, { x: 164, y: 50 }, { x: 166, y: 52 }]);
    expect(hitPathHandle(pts, 100, 50, 6)).toBeNull();
    expect(hitPathHandle(pts, 163, 50, 6)).toBe(1);
    expect(hitPathHandle(pts, 166, 53, 6)).toBe(2);
    expect(hitPathHandle(pts, 200, 200, 6)).toBeNull();
    expect(dropOffset({ x: 100, y: 50 }, 130.6, 9000)).toEqual({ x: 31, y: 2048 });
  });
});

describe("R5 curves and ellipse", () => {
  it("validates curves, samples like the ROM integer formula and toggles at the midpoint", async () => {
    const m = await import("./objectPath");
    const path = m.defaultPath();
    const curved = m.toggleCurve(path, 1);
    expect(curved.points[1]!.curve).toEqual({ x: 32, y: 0 });
    expect(m.pathIssue(curved)).toBeNull();
    expect(m.toggleCurve(curved, 1).points[1]!.curve).toBeNull();
    expect(m.toggleCurve(path, 0)).toBe(path);
    expect(m.pathIssue(m.withPoint(curved, 1, { curve: { x: 9000, y: 0 } }))).toContain("curva");
    const samples = m.sampleSegment({ x: 0, y: 0 }, { x: 0, y: 0, frames: 30, wait: 0, curve: { x: 0, y: -48 } }, 30);
    expect(samples[14]).toEqual({ x: 0, y: -24 });
    expect(samples[29]).toEqual({ x: 0, y: 0 });
  });

  it("builds a valid looping ellipse that starts at the object and stays within its box", async () => {
    const m = await import("./objectPath");
    const e = m.ellipsePath(48, 24, 8, 12);
    expect(e.mode).toBe("loop");
    expect(e.points).toHaveLength(8);
    expect(e.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(m.pathIssue(e)).toBeNull();
    for (const p of e.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(96);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(24);
    }
    const rightmost = e.points[4]!;
    expect(rightmost).toMatchObject({ x: 96, y: 0 });
    const hit = m.hitPathHandleOrControl({ x: 0, y: 0 }, e, e.points[2]!.curve!.x, e.points[2]!.curve!.y, 3);
    expect(hit).toEqual({ index: 2, kind: "control" });
  });
});
