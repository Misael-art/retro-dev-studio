import { describe, expect, it } from "vitest";

import { layoutTags } from "./viewportTagLayout";

const box = (a: { x: number; y: number }, w: number, h: number) => ({ ...a, width: w, height: h });
const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("layoutTags", () => {
  it("stacks tags that share an anchor into a list instead of drawing them on top of each other", () => {
    const requests = ["b", "a", "c"].map((id) => ({ id, x: 2, y: 2, width: 60, height: 14 }));
    const placed = layoutTags(requests);
    expect(placed.map((p) => [p.id, p.x, p.y])).toEqual([
      ["a", 2, 2],
      ["b", 2, 18],
      ["c", 2, 34],
    ]);
  });

  it("never overlaps and gives the selected tag its own anchor", () => {
    const requests = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, x: (i % 5) * 20, y: Math.floor(i / 5) * 6, width: 50, height: 14 }));
    requests.push({ id: "sel", x: 40, y: 12, width: 50, height: 14, priority: 2 } as (typeof requests)[number]);
    const placed = layoutTags(requests);
    const boxes = placed.map((p) => box(p, 50, 14));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    expect(placed.find((p) => p.id === "sel")).toEqual({ id: "sel", x: 40, y: 12 });
  });
});
