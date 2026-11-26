import { describe, expect, it } from "vitest";

import { hudMaxValue, hudProblems, hudSampleText, hudWidth, strikeIds } from "./hudText";
import type { Scene } from "./ipc/sceneService";

const scene = {
  entities: [
    {
      entity_id: "dummy",
      transform: { x: 0, y: 0 },
      components: {
        logic: { graph: JSON.stringify({ nodes: [{ id: "strike1", type: "authored_strike", params: { health: 99 } }, { id: "t", type: "event_update" }] }) },
      },
    },
  ],
} as unknown as Scene;

describe("hudText rules (Mega Drive)", () => {
  it("accepts a bound text that fits the 40x28 grid with the default font", () => {
    const hud = { column: 2, row: 25, label: "VIDA ", value: { kind: "strike_hp" as const, source: "strike1" }, digits: 3 };
    expect(hudWidth(hud)).toBe(8);
    expect(hudProblems(hud, scene)).toEqual([]);
    expect(strikeIds(scene)).toEqual(["strike1"]);
  });

  it("explains off-screen, unsupported glyphs and unknown bindings", () => {
    expect(hudProblems({ column: 36, row: 25, label: "VIDA ", value: { kind: "strike_hp", source: "strike1" } }, scene)[0]).toMatch(/sai da tela/);
    expect(hudProblems({ column: 0, row: 28, label: "X" }, scene)[0]).toMatch(/sai da tela/);
    expect(hudProblems({ column: 0, row: 0, label: "VIDÁ" }, scene)[0]).toMatch(/fonte padrão/);
    expect(hudProblems({ column: 0, row: 0, label: "V", value: { kind: "strike_hp", source: "x" } }, scene)[0]).toMatch(/não existe/);
    expect(hudProblems({ column: 0, row: 0, label: "V", value: { kind: "strike_hp", source: "strike1" }, digits: 9 }, scene)[0]).toMatch(/dígitos/);
  });

  it("samples the full value, empty and intermediate HUD without modifying the source", () => {
    const hud = { column: 35, row: 25, label: "HP ", value: { kind: "strike_hp" as const, source: "strike1" }, digits: 1 };
    const before = JSON.stringify(hud);
    const maximum = hudMaxValue(hud, scene)!;
    expect(maximum).toBe(99);
    expect(hudWidth(hud, scene)).toBe(5);
    expect([1, 9, 99].map((value) => hudSampleText(hud, value, maximum))).toEqual(["HP 1", "HP 9", "HP 99"]);
    const bar = { ...hud, bar_tiles: 8 };
    expect(hudSampleText(bar, 0, maximum)).toBe("HP --------");
    expect(hudSampleText(bar, 50, maximum)).toBe("HP ####----");
    expect(hudSampleText(bar, maximum, maximum)).toBe("HP ########");
    expect(hudProblems(bar, scene)).toEqual([expect.stringContaining("sai da tela")]);
    expect(JSON.stringify(hud)).toBe(before);
  });
});
