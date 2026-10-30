import { describe, expect, it } from "vitest";
import {
  addFrame,
  addLayer,
  analyzeHardware,
  buildSheetIndices,
  compositeFrame,
  constrainLine,
  createPixelDoc,
  deserializePixelDoc,
  drawEllipse,
  drawRect,
  drawStroke,
  encodeIndexedPng,
  flipCel,
  floodFill,
  mdColorToCram,
  packIndexedScanlines,
  packPixel,
  paletteToC,
  quantizeRgba,
  removePixelBackground,
  replaceCel,
  resLine,
  resizeDoc,
  rotateCel,
  serializePixelDoc,
  shadeValue,
  shiftCel,
} from "./pixelEditor";

describe("pixelEditor", () => {
  it("retains original provenance and refuses incomplete or unbounded native documents before allocating pixels",()=>{
    const doc=createPixelDoc(8,8);doc.originalSource=".rds/art-sources/source.png";
    expect(deserializePixelDoc(serializePixelDoc(doc)).originalSource).toBe(doc.originalSource);
    const raw=JSON.parse(serializePixelDoc(doc));raw.width=65536;raw.height=65536;
    expect(()=>deserializePixelDoc(JSON.stringify(raw))).toThrow("64 MP");
    raw.width=8;raw.height=8;raw.frames[0].cels[0]=btoa("short");
    expect(()=>deserializePixelDoc(JSON.stringify(raw))).toThrow("incompleto");
  });
  it("removing an opaque background reveals lower artwork and preserves hidden layers", () => {
    let doc=createPixelDoc(8,8);
    doc.palettes[0][1]=[7,0,0];doc.palettes[0][2]=[7,7,7];
    doc.frames[0].cels[0][3*8+3]=1;
    doc=addLayer(doc,"Background");doc.frames[0].cels[1].fill(2);doc.frames[0].cels[1][2*8+2]=1;
    doc=addLayer(doc,"Hidden");doc.layers[2].visible=false;doc.frames[0].cels[2].fill(2);
    const removed=removePixelBackground(doc);
    expect(compositeFrame(removed,0)[3*8+3]).toBe(1);
    expect(removed.frames[0].cels[2]).toEqual(doc.frames[0].cels[2]);
  });
  it("removes connected uniform background in every frame, preserves enclosed details and the source document", () => {
    const doc = createPixelDoc(8, 8, { frames: 2 });
    doc.palettes[0][1] = [7, 7, 7]; doc.palettes[0][2] = [7, 0, 0];
    for (const frame of doc.frames) {
      frame.cels[0].fill(1);
      for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) frame.cels[0][y * 8 + x] = 2;
      frame.cels[0][3 * 8 + 3] = 1;
    }
    const before = serializePixelDoc(doc);
    const removed = removePixelBackground(doc);
    for (const frame of removed.frames) {
      expect(frame.cels[0][0]).toBe(0);
      expect(frame.cels[0][2 * 8 + 2]).toBe(2);
      expect(frame.cels[0][3 * 8 + 3]).toBe(1);
    }
    expect(serializePixelDoc(doc)).toBe(before);
    doc.frames.forEach(f => f.cels[0].fill(1));
    expect(removePixelBackground(doc)).toBe(doc); // Never erase a solid object.
  });
  it("aligns canvas to 8x8 tiles and starts transparent", () => {
    const doc = createPixelDoc(20, 9);
    expect([doc.width, doc.height]).toEqual([24, 16]);
    expect(compositeFrame(doc, 0).every((v) => v === 0)).toBe(true);
    expect(resizeDoc(doc, 33, 8).width).toBe(40);
  });

  it("draws strokes with brush size and vertical mirror", () => {
    const doc = createPixelDoc(8, 8);
    const red = packPixel(0, 5);
    const cel = drawStroke(doc.frames[0].cels[0], 8, 8, [[1, 1]], red, { size: 1, mirrorX: true });
    expect(cel[1 * 8 + 1]).toBe(red);
    expect(cel[1 * 8 + 6]).toBe(red);
    const big = drawStroke(doc.frames[0].cels[0], 8, 8, [[4, 4]], red, { size: 3 });
    expect(big.filter((v) => v === red).length).toBe(9);
  });

  it("constrains lines to 0/45/90 degrees", () => {
    expect(constrainLine(0, 0, 7, 1)).toEqual([7, 0]);
    expect(constrainLine(0, 0, 4, 5)).toEqual([5, 5]);
  });

  it("fills contiguous area only, and draws rect/ellipse outlines", () => {
    const value = packPixel(1, 3);
    const wall = drawRect(new Uint8Array(64), 8, 8, [0, 0], [7, 7], value, false);
    const filled = floodFill(wall, 8, 8, 3, 3, packPixel(1, 4));
    expect(filled[3 * 8 + 3]).toBe(packPixel(1, 4));
    expect(filled[0]).toBe(value);
    const ring = drawEllipse(new Uint8Array(64), 8, 8, [0, 0], [7, 7], value, false);
    expect(ring[3 * 8 + 3]).toBe(0);
    expect(ring.some((v) => v === value)).toBe(true);
  });

  it("flips, rotates and shifts with wrap", () => {
    const cel = new Uint8Array(16);
    cel[0] = 1;
    expect(flipCel(cel, 4, 4, true)[3]).toBe(1);
    expect(flipCel(cel, 4, 4, false)[12]).toBe(1);
    expect(rotateCel(cel, 4, 4)[3]).toBe(1);
    expect(shiftCel(cel, 4, 4, -1, 0, true)[3]).toBe(1);
    expect(shiftCel(cel, 4, 4, -1, 0, false).every((v) => v === 0)).toBe(true);
  });

  it("lightens inside the same palette line by luminance", () => {
    const doc = createPixelDoc(8, 8);
    const darker = packPixel(1, 2);
    const lighter = shadeValue(doc, darker, true);
    expect(lighter >> 4).toBe(1);
    expect(lighter).not.toBe(darker);
    expect(shadeValue(doc, lighter, false)).toBe(darker);
  });

  it("reports tiles mixing palette lines and dedupes flipped tiles", () => {
    let doc = createPixelDoc(16, 8);
    const cel = new Uint8Array(16 * 8);
    cel[0] = packPixel(0, 1);
    cel[7] = packPixel(0, 2);
    // Tile 2 = flip horizontal do tile 1.
    cel[15] = packPixel(0, 1);
    cel[8] = packPixel(0, 2);
    doc = replaceCel(doc, 0, 0, cel);
    let report = analyzeHardware(doc, 0);
    expect(report.totalTiles).toBe(2);
    expect(report.uniqueTiles).toBe(1);
    expect(report.conflictTiles).toHaveLength(0);
    expect(report.lineUsage).toEqual([{ line: 0, colors: 2 }]);

    cel[1] = packPixel(2, 1);
    doc = replaceCel(doc, 0, 0, new Uint8Array(cel));
    report = analyzeHardware(doc, 0);
    expect(report.conflictTiles).toHaveLength(1);
    expect(report.warnings.join(" ")).toContain("misturam linhas de paleta");
  });

  it("counts hardware sprite pieces and scanline load", () => {
    let doc = createPixelDoc(64, 32);
    const cel = new Uint8Array(64 * 32);
    cel[0] = packPixel(0, 1);
    cel[40] = packPixel(0, 1);
    doc = replaceCel(doc, 0, 0, cel);
    const report = analyzeHardware(doc, 0);
    expect(report.hwSpritesPerFrame).toBe(2);
    expect(report.spritesPerScanline).toBe(2);
  });

  it("quantizes RGBA to 9-bit and to at most 15 colors of one line", () => {
    const width = 64;
    const rgba = new Uint8Array(width * 4);
    for (let i = 0; i < width; i += 1) {
      rgba[i * 4] = (i % 8) * 36;
      rgba[i * 4 + 1] = Math.floor(i / 8) * 36;
      rgba[i * 4 + 2] = (i % 3) * 120;
      rgba[i * 4 + 3] = i === 0 ? 0 : 255;
    }
    const result = quantizeRgba(rgba, width, 1, 2);
    expect(result.pixels[0]).toBe(0);
    expect([...result.pixels].slice(1).every((v) => v >> 4 === 2 && (v & 15) > 0)).toBe(true);
    expect(new Set([...result.pixels].slice(1)).size).toBeLessThanOrEqual(15);
    expect(result.sourceColors).toBeGreaterThan(15);
    expect(result.warnings).toHaveLength(1);
  });

  it("exports a horizontal sheet, CRAM palette, .res line and 4-bit PNG", () => {
    let doc = createPixelDoc(8, 8, { name: "Ken Soco" });
    doc = addFrame(doc, 0, false);
    const cel = new Uint8Array(64);
    cel[0] = packPixel(1, 9);
    doc = replaceCel(doc, 1, 0, cel);
    const sheet = buildSheetIndices(doc);
    expect([sheet.width, sheet.height, sheet.line]).toEqual([16, 8, 1]);
    expect(sheet.indices[8]).toBe(9);
    expect(mdColorToCram([7, 0, 0])).toBe(0x000e);
    expect(mdColorToCram([0, 0, 7])).toBe(0x0e00);
    expect(paletteToC("pal_x", doc.palettes[0])).toContain("const u16 pal_x[16]");
    expect(resLine(doc, "pixel/ken_soco.png")).toBe('SPRITE spr_ken_soco "pixel/ken_soco.png" 1 1 FAST 6');
    const raw = packIndexedScanlines(sheet.indices, sheet.width, sheet.height);
    expect(raw.length).toBe((8 + 1) * 8);
    expect(raw[1 + 4]).toBe(0x90);
    const png = encodeIndexedPng(16, 8, doc.palettes[1], new Uint8Array([1, 2, 3]));
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png[24]).toBe(4);
    expect(png[25]).toBe(3);
  });

  it("round-trips the native document format", () => {
    let doc = createPixelDoc(8, 8, { name: "x" });
    const cel = new Uint8Array(64);
    cel[10] = packPixel(3, 15);
    doc = replaceCel(doc, 0, 0, cel);
    const back = deserializePixelDoc(serializePixelDoc(doc));
    expect(back.frames[0].cels[0][10]).toBe(packPixel(3, 15));
    expect(back.palettes).toEqual(doc.palettes);
    expect(() => deserializePixelDoc('{"schema":"other"}')).toThrow();
  });
});
