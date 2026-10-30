import { describe, expect, it } from "vitest";
import { addFrame, addLayer, analyzeHardware, analyzeTileReuse, compositeFrame, createPixelDoc, flipCel, floodFill, pixelCss, removePixelBackground, serializePixelDoc } from "./pixelEditor";
import { addPixelBorder, applyPixelEffect, collagePixelDoc, cropPixelDoc, duplicatePixelLayer, erasePixelRegion, mergePixelLayerDown, PIXEL_EFFECTS, rotatePixelDoc, scalePixelDoc, unifyPixelPalettes } from "./pixelImageOps";

function artwork() {
  let doc = createPixelDoc(16, 8);
  doc.palettes[0][1] = [7, 0, 0]; doc.palettes[0][2] = [0, 0, 7];
  doc.frames[0].cels[0][0] = 1; doc.frames[0].cels[0][1] = 1; doc.frames[0].cels[0][2] = 2;
  doc = addFrame(doc, 0, true); doc.frames[0].durationMs = 123; doc.frames[1].durationMs = 267;
  doc = addLayer(doc, "Oculta"); doc.layers[1].visible = false; doc.frames[0].cels[1][0] = 1;
  return doc;
}

describe("indexed image operations preserve the editing contract", () => {
  it("unifies different banks without losing alpha, hidden cels, frame timing or provenance", () => {
    const doc = artwork(); doc.originalSource = ".rds/art-sources/source.png";
    doc.palettes[2][1] = [0, 7, 0]; doc.frames[1].cels[1][2] = 33;
    const before = serializePixelDoc(doc), next = unifyPixelPalettes(doc);
    expect(serializePixelDoc(doc)).toBe(before);
    expect(next.originalSource).toBe(doc.originalSource);
    expect(next.layers[1].visible).toBe(false);
    expect(next.frames.map(f => f.durationMs)).toEqual([123, 267]);
    next.frames.forEach((frame, fi) => frame.cels.forEach((cel, li) => cel.forEach((value, i) => {
      expect(value).toBeLessThan(16);
      expect(Boolean(value)).toBe(Boolean(doc.frames[fi].cels[li][i]));
      if (value) expect(pixelCss(next, value)).toBe(pixelCss(doc, doc.frames[fi].cels[li][i]));
    })));
  });
  it("filters only the region/color and protects other frames and hidden layers", () => {
    const doc = artwork(), before = serializePixelDoc(doc);
    const result = applyPixelEffect(doc, { frame: 0, layer: 0, rect: { x: 0, y: 0, w: 1, h: 1 }, color: 1 }, "invert").doc;
    expect(pixelCss(result, result.frames[0].cels[0][0])).toBe("#00ffff");
    expect(pixelCss(result, result.frames[0].cels[0][1])).toBe("#ff0000");
    expect(pixelCss(result, result.frames[0].cels[0][2])).toBe("#0000ff");
    expect(pixelCss(result, result.frames[1].cels[0][0])).toBe("#ff0000");
    expect(pixelCss(result, result.frames[0].cels[1][0])).toBe("#ff0000");
    expect(result.frames.map(f => f.durationMs)).toEqual([123, 267]);
    expect(serializePixelDoc(doc)).toBe(before);
  });

  it("approximates when protected colors occupy every slot instead of recoloring consumers", () => {
    const doc = createPixelDoc(8, 8);
    for (let i = 1; i < 16; i++) doc.palettes[0][i] = [i % 8, 0, 0];
    doc.frames[0].cels[0].set(Array.from({ length: 64 }, (_, i) => i % 15 + 1));
    const result = applyPixelEffect(doc, { frame: 0, layer: 0, rect: { x: 0, y: 0, w: 1, h: 1 } }, "invert");
    expect(result.doc.palettes).toEqual(doc.palettes);
    expect(result.approximated).toBe(1);
    expect(result.doc.frames[0].cels[0].slice(1)).toEqual(doc.frames[0].cels[0].slice(1));
  });

  it("all presets preserve transparency, geometry and unedited frame timings", () => {
    const doc = artwork();
    for (const effect of PIXEL_EFFECTS) {
      const next = applyPixelEffect(doc, { frame: 0, layer: 0 }, effect.id).doc;
      expect([next.width, next.height]).toEqual([16, 8]);
      expect(next.frames.map(f => f.durationMs)).toEqual([123, 267]);
      expect(next.frames[0].cels[0][30]).toBe(0);
      expect(next.palettes.flat(2).every(c => Number.isInteger(c) && c >= 0 && c <= 7)).toBe(true);
    }
    const large = createPixelDoc(512, 512);
    large.frames = Array.from({length:17}, () => large.frames[0]);
    expect(() => applyPixelEffect(large, { frame: 0, layer: 0, allFrames: true }, "blur")).toThrow("4 milhões");
  });

  it("crop pads only the selected rectangle and scales/rotates every animation cel", () => {
    const doc = artwork(); doc.originalSource = ".rds/art-sources/preserved.png";
    const cropped = cropPixelDoc(doc, { x: 1, y: 0, w: 2, h: 3 });
    expect([cropped.width, cropped.height]).toEqual([8, 8]);
    expect([...cropped.frames[0].cels[0].slice(0, 3)]).toEqual([1, 2, 0]);
    const scaled = scalePixelDoc(doc, 32, 16);
    expect([...scaled.frames[0].cels[0].slice(0, 6)]).toEqual([1, 1, 1, 1, 2, 2]);
    const rotated = rotatePixelDoc(doc);
    expect([rotated.width, rotated.height]).toEqual([8, 16]);
    expect(rotated.frames[0].cels[0][7]).toBe(1);
    expect(rotated.originalSource).toBe(doc.originalSource);
    expect(rotated.frames[1].durationMs).toBe(267);
    expect(() => scalePixelDoc(doc, Infinity, 16)).toThrow();
    expect(() => scalePixelDoc(doc, 8192, 8192)).toThrow();
  });

  it("duplicates independent cels and merging visible layers preserves the composite", () => {
    const doc = artwork(); doc.layers[1].visible = true; doc.frames[0].cels[1][2] = 1;
    const copy = duplicatePixelLayer(doc, 0);
    copy.frames[0].cels[1][0] = 2;
    expect(doc.frames[0].cels[0][0]).toBe(1);
    const merged = mergePixelLayerDown(doc, 1);
    expect(compositeFrame(merged, 0)).toEqual(compositeFrame(doc, 0));
    doc.layers[1].visible = false;
    expect(() => mergePixelLayerDown(doc, 1)).toThrow(/ocultas/);
  });

  it("color erasure keeps enclosed holes and respects frame/region scope", () => {
    const doc = createPixelDoc(8, 8); doc.frames[0].cels[0].fill(1);
    for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) if (y === 2 || y === 5 || x === 2 || x === 5) doc.frames[0].cels[0][y * 8 + x] = 2;
    const next = erasePixelRegion(doc, { frame: 0, layer: 0 }, 0, 0, 0);
    expect(next.frames[0].cels[0][0]).toBe(0);
    expect(next.frames[0].cels[0][3 * 8 + 3]).toBe(1);
    expect(doc.frames[0].cels[0][0]).toBe(1);
    expect(erasePixelRegion(doc, { frame: 0, layer: 0, color: 2 }, 0, 0, 0)).toBe(doc);
  });

  it("automatic background removal honors the current frame/layer while protecting other consumers", () => {
    let doc = createPixelDoc(8, 8, { frames: 2 });
    doc.frames.forEach(f => { f.cels[0].fill(1); f.cels[0][27] = 2; });
    doc = addLayer(doc, "Protect"); doc.frames.forEach(f => f.cels[1].fill(1));
    const next = removePixelBackground(doc, 0, { frame: 0, layer: 0 });
    expect(next.frames[0].cels[0][0]).toBe(0); expect(next.frames[0].cels[0][27]).toBe(2);
    expect(next.frames[1].cels[0]).toEqual(doc.frames[1].cels[0]);
    expect(next.frames[0].cels[1]).toEqual(doc.frames[0].cels[1]);
  });

  it("bucket cannot escape a selection and enter it again around an external wall", () => {
    const pixels = new Uint8Array(64).fill(1);
    for (let y = 0; y < 5; y++) pixels[y * 8 + 3] = 2;
    const filled = floodFill(pixels, 8, 8, 0, 0, 3, { x: 0, y: 0, w: 8, h: 4 });
    expect(filled[0]).toBe(3); expect(filled[4]).toBe(1); expect(filled[7 * 8]).toBe(1);
  });

  it("collage and border are independent layers without replacing existing colors", () => {
    const doc = artwork(), source = createPixelDoc(8, 8); source.originalSource = "preserved-input"; source.frames[0].cels[0][0] = 1;
    const next = collagePixelDoc(doc, source, 0, 0);
    expect(next.layers.length).toBe(doc.layers.length + 1);
    expect(next.layers[next.layers.length - 1].originalSource).toBe("preserved-input");
    expect(next.palettes).toEqual(doc.palettes);
    expect(next.frames[1].cels[next.layers.length - 1].some(v => v > 0)).toBe(false);
    const bordered = addPixelBorder(doc, { frame: 0, layer: 0 }, 2, 1, false);
    expect(bordered.frames[0].cels[0]).toEqual(doc.frames[0].cels[0]);
    expect(bordered.frames[0].cels[2][0]).toBe(2);
    expect(bordered.frames[0].cels[2][3 * 16 + 3]).toBe(0);
    expect(() => collagePixelDoc(doc, addFrame(addFrame(source, 0, true), 0, true), 0, 0)).toThrow(/quantidade de quadros/);
    expect(() => collagePixelDoc(doc, addFrame(source, 0, true), 0, 0)).toThrow(/durações diferentes/);
  });

  it("maps exact, mirrored and bank-independent tile reuse without mutating the image", () => {
    const doc = createPixelDoc(24, 8), pixels = doc.frames[0].cels[0];
    const pattern = new Uint8Array(64); pattern[0] = 1; pattern[1] = 2; pattern[9] = 3;
    const mirror = flipCel(pattern, 8, 8, true);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { pixels[y * 24 + x] = pattern[y * 8 + x]; pixels[y * 24 + 8 + x] = mirror[y * 8 + x]; pixels[y * 24 + 16 + x] = pattern[y * 8 + x] ? pattern[y * 8 + x] + 16 : 0; }
    const before = new Uint8Array(pixels), tiles = analyzeTileReuse(doc, pixels);
    expect(tiles.map(t => t.pattern)).toEqual([0, 0, 0]);
    expect(tiles[1].flip).toBe("horizontal");
    expect(tiles[0].copies).toBe(3);
    expect(analyzeHardware(doc, 0).uniqueTiles).toBe(1);
    expect(pixels).toEqual(before);
  });
});
