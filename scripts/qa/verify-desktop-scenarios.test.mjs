import { describe, expect, it } from "vitest";
import { verifyDesktopScenarios } from "./verify-desktop-scenarios.mjs";

describe("native desktop regression gates", () => {
  const paired = ["smoke", "live_ok", "live_stale", "live_error", "live_overflow",
    "live_sprite_warning", "live_vram_warning", "live_vram_overflow"];
  const snes = paired.map(name => name + "_snes");
  const md = [...paired.map(name => name + "_md"), "reference_goal", "code_draft", "code_scope", "pose_baseline", "pose_journey", "pose_tools", "workspace_layout", "point_occlusion", "linked_atlas"];
  const outcomes = names => Object.fromEntries(names.map(name => [name, { outcome: "success" }]));

  it("requires every scenario when both consoles are selected", () => {
    const all = [...md, ...snes];
    expect(verifyDesktopScenarios("all", outcomes(all))).toBe(25);
    for (const name of all) {
      expect(() => verifyDesktopScenarios("all", { ...outcomes(all), [name]: { outcome: "skipped" } })).toThrow(name);
    }
  });

  it("checks each console independently and reports failed, absent or cancelled steps", () => {
    expect(verifyDesktopScenarios("snes", outcomes(snes))).toBe(8);
    expect(verifyDesktopScenarios("megadrive", outcomes(md))).toBe(17);
    const missing = outcomes(snes.filter(name => name !== "smoke_snes"));
    expect(() => verifyDesktopScenarios("snes", missing)).toThrow("smoke_snes=ausente");
    for (const outcome of ["failure", "cancelled"]) {
      expect(() => verifyDesktopScenarios("megadrive", { ...outcomes(md), reference_goal: { outcome } })).toThrow(outcome);
    }
    expect(() => verifyDesktopScenarios("wrong", {})).toThrow("Alvo");
  });

  it("requires all extended authoring groups in the dedicated run", () => {
    const authoring = ["indexed_effects", "palette_and_atlas", "terrain_and_seam", "motion_trace", "wave_band", "hud_extremes"];
    expect(verifyDesktopScenarios("authoring", outcomes(authoring))).toBe(6);
    expect(() => verifyDesktopScenarios("authoring", outcomes(authoring.slice(1)))).toThrow("indexed_effects=ausente");
    expect(() => verifyDesktopScenarios("authoring", { ...outcomes(authoring), terrain_and_seam: { outcome: "failure" } })).toThrow("terrain_and_seam=failure");
  });
});
