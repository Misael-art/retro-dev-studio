import { describe, expect, it } from "vitest";

import { hudProblems, hudWidth, strikeIds } from "./hudText";
import type { Scene } from "./ipc/sceneService";

const scene = {
  entities: [
    {
      entity_id: "dummy",
      transform: { x: 0, y: 0 },
      components: {
        logic: { graph: JSON.stringify({ nodes: [{ id: "strike1", type: "authored_strike" }, { id: "t", type: "event_update" }] }) },
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
});
