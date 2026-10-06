import { describe, expect, it } from "vitest";

import { cellPixels, clampZoom, idAt, idLabel, idTint, moveCursor, showsIdText, ZOOM_MAX, ZOOM_MIN } from "./sonicLayoutsNav";

describe("sonicLayoutsNav", () => {
  it("move o cursor com setas e para na borda, sem wrap", () => {
    expect(moveCursor({ row: 5, col: 5 }, "ArrowRight", false, 64, 64)).toEqual({ row: 5, col: 6 });
    expect(moveCursor({ row: 5, col: 5 }, "ArrowLeft", false, 64, 64)).toEqual({ row: 5, col: 4 });
    expect(moveCursor({ row: 5, col: 5 }, "ArrowUp", false, 64, 64)).toEqual({ row: 4, col: 5 });
    expect(moveCursor({ row: 5, col: 5 }, "ArrowDown", false, 64, 64)).toEqual({ row: 6, col: 5 });
    expect(moveCursor({ row: 0, col: 0 }, "ArrowLeft", false, 64, 64)).toEqual({ row: 0, col: 0 });
    expect(moveCursor({ row: 0, col: 0 }, "ArrowUp", false, 64, 64)).toEqual({ row: 0, col: 0 });
    expect(moveCursor({ row: 63, col: 63 }, "ArrowRight", false, 64, 64)).toEqual({ row: 63, col: 63 });
    expect(moveCursor({ row: 63, col: 63 }, "ArrowDown", false, 64, 64)).toEqual({ row: 63, col: 63 });
  });

  it("Home/End e Ctrl+Home/End vão às fronteiras de linha e da grade", () => {
    expect(moveCursor({ row: 7, col: 30 }, "Home", false, 64, 64)).toEqual({ row: 7, col: 0 });
    expect(moveCursor({ row: 7, col: 30 }, "End", false, 64, 64)).toEqual({ row: 7, col: 63 });
    expect(moveCursor({ row: 7, col: 30 }, "Home", true, 64, 64)).toEqual({ row: 0, col: 0 });
    expect(moveCursor({ row: 7, col: 30 }, "End", true, 64, 64)).toEqual({ row: 63, col: 63 });
  });

  it("PageUp/PageDown andam 8 linhas com clamp", () => {
    expect(moveCursor({ row: 20, col: 3 }, "PageDown", false, 64, 64)).toEqual({ row: 28, col: 3 });
    expect(moveCursor({ row: 20, col: 3 }, "PageUp", false, 64, 64)).toEqual({ row: 12, col: 3 });
    expect(moveCursor({ row: 60, col: 3 }, "PageDown", false, 64, 64)).toEqual({ row: 63, col: 3 });
    expect(moveCursor({ row: 2, col: 3 }, "PageUp", false, 64, 64)).toEqual({ row: 0, col: 3 });
  });

  it("não navega com outras teclas nem sem geometria", () => {
    expect(moveCursor({ row: 1, col: 1 }, "a", false, 64, 64)).toBeNull();
    expect(moveCursor({ row: 1, col: 1 }, "ArrowRight", false, 0, 0)).toBeNull();
  });

  it("zoom é limitado e a célula só mostra texto quando cabe", () => {
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_MIN);
    expect(cellPixels(1)).toBe(6);
    expect(cellPixels(16)).toBe(36);
    expect(showsIdText(5)).toBe(false);
    expect(showsIdText(6)).toBe(true);
  });

  it("idAt lê o byte linear da grade e recusa fora dos limites", () => {
    const hex = "00112233";
    expect(idAt(hex, 0, 0, 2)).toBe(0x00);
    expect(idAt(hex, 0, 1, 2)).toBe(0x11);
    expect(idAt(hex, 1, 0, 2)).toBe(0x22);
    expect(idAt(hex, 1, 1, 2)).toBe(0x33);
    expect(idAt(hex, 2, 0, 2)).toBeNull();
    expect(idAt(hex, 0, 2, 2)).toBeNull();
    expect(idAt(hex, -1, 0, 2)).toBeNull();
    expect(idAt("zz", 0, 0, 1)).toBeNull();
  });

  it("rotula IDs em hexadecimal e distingue o ID zero", () => {
    expect(idLabel(0x2a)).toBe("0x2A");
    expect(idLabel(0)).toBe("0x00");
    expect(idTint(0)).not.toBe(idTint(1));
  });
});
