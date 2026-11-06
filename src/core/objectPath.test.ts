import { describe, expect, it } from "vitest";
import { addPoint, defaultPath, pathCycleFrames, pathIssue, removePoint, withPoint } from "./objectPath";

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
    expect(pathCycleFrames(path)).toBe((60 + 30) * 2);
    expect(pathCycleFrames({ ...path, mode: "once" })).toBe(90);
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
