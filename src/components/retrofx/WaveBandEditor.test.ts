import { describe, expect, it } from "vitest";
import { waveLineOffset, wavePreviewTick } from "./WaveBandEditor";

const band = { entity_id: "water", first_line: 128, last_line: 151, phase: 0, speed: 4, amplitude: 12, wavelength: 32 };

describe("Ondular no relógio do projeto", () => {
  it.each([50, 60])("avança um tick por VBlank a %i Hz, inclusive após perder pinturas", fps => {
    expect(wavePreviewTick(0, fps)).toBe(0);
    expect(wavePreviewTick(1000, fps)).toBe(fps);
    const tick = wavePreviewTick(16000 / fps, fps);
    expect(tick).toBe(16);
    expect(waveLineOffset(band, 0, tick)).toBe(12);
    expect(waveLineOffset({ ...band, speed: -4 }, 0, tick)).toBe(-12);
    expect(waveLineOffset({ ...band, speed: 0 }, 0, tick)).toBe(0);
    expect(waveLineOffset(band, 8, 0)).toBe(12);
    expect(waveLineOffset(band, 0, 64)).toBe(0);
  });
});
