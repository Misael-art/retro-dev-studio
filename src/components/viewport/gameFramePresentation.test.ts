import { describe, expect, it } from "vitest";
import { paintGameFrame } from "./gameFramePresentation";

describe("native frame resolution", () => {
  it("preserves every pixel across smaller and larger video modes without stale margins", () => {
    let width = 320, height = 224;
    let bitmap = new Uint8ClampedArray(width * height * 4);
    let clears = 0;
    const context = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        expect(image.data.length).toBe(width * height * 4);
        bitmap.set(image.data);
      },
    };
    const canvas = {
      get width() { return width; },
      set width(value: number) { width = value; bitmap = new Uint8ClampedArray(width * height * 4); clears++; },
      get height() { return height; },
      set height(value: number) { height = value; bitmap = new Uint8ClampedArray(width * height * 4); clears++; },
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    for (const [w, h] of [[256, 192], [256, 192], [320, 224], [256, 224]]) {
      const rgba = Array.from({ length: w * h * 4 }, (_, i) => (i * 13 + 91) % 256);
      const before = clears;
      const unchanged = width === w && height === h;
      expect(paintGameFrame(canvas, { width: w, height: h, rgba })).toBe(true);
      expect([width, height]).toEqual([w, h]);
      expect(bitmap).toEqual(new Uint8ClampedArray(rgba));
      if (unchanged) expect(clears).toBe(before);
    }
    const before = bitmap.slice();
    expect(paintGameFrame(canvas, { width, height, rgba: [1, 2, 3] })).toBe(false);
    expect(bitmap).toEqual(before);
    expect(paintGameFrame(canvas, { width: 0, height, rgba: [] })).toBe(false);
  });
});
