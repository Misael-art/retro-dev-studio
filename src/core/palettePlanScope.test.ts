import { describe, expect, it } from "vitest";
import { describePaletteScope, type PlanResource } from "./palettePlan";

const res = (over: Partial<PlanResource> = {}): PlanResource => ({
  id: "hero", name: "Herói", origin: "assets/hero.png", colors: [], used_indices: [1, 2, 3, 5],
  uses: [
    { entity_id: "a", role: "sprite", indices: [3, 1, 2] },
    { entity_id: "b", role: "sprite", indices: [1, 5] },
    { entity_id: "b", role: "sprite", indices: [5] },
  ],
  references: 3, simultaneous_uses: 2, state: "residente", quantized_pixels: 0, source_colors: 4, evidence: "", ...over,
});

describe("R3-01 palette scope", () => {
  it("lists other consumers once, own indices, and the bank as a scene allocation", () => {
    expect(describePaletteScope(res({ bank: 1 }), "a")).toEqual({ sharedWith: ["b"], ownIndices: [1, 2, 3], allocation: "PAL1 nesta cena (planejado)", origin: "assets/hero.png" });
    expect(describePaletteScope(res({ bank: 2, pinned_bank: 2 }), "b").allocation).toBe("PAL2 nesta cena (fixado)");
    expect(describePaletteScope(res(), "c")).toMatchObject({ sharedWith: ["a", "b"], ownIndices: [], allocation: "sem banco nesta cena" });
  });
});
