import { describe, expect, it } from "vitest";

import { cellsOnLine } from "./tilemapCells";

describe("cellsOnLine", () => {
  it("covers every cell of a fast vertical stroke", () => {
    expect(cellsOnLine(25, 22, 25, 25)).toEqual([22, 23, 24, 25].map((row) => ({ col: 25, row })));
  });
  it("covers diagonal and reversed strokes without gaps, including endpoints", () => {
    const cells = cellsOnLine(5, 5, 1, 2);
    expect(cells[0]).toEqual({ col: 5, row: 5 });
    expect(cells[cells.length - 1]).toEqual({ col: 1, row: 2 });
    for (let i = 1; i < cells.length; i += 1) {
      expect(Math.abs(cells[i].col - cells[i - 1].col) <= 1 && Math.abs(cells[i].row - cells[i - 1].row) <= 1).toBe(true);
    }
    expect(cellsOnLine(3, 3, 3, 3)).toEqual([{ col: 3, row: 3 }]);
  });
});
