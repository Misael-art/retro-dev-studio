import { describe, expect, it } from "vitest";
import type { Entity } from "./ipc/sceneService";
import { MUGEN_PROFILE_ID, parseVelocity, q8ToDecimal, readMugenVelocities, withMugenVelocity } from "./mugenVelocity";
import { readMugenHitTarget, withMugenHitTarget } from "./mugenVelocity";

function walkerEntity(): Entity {
  const node = (id: string, stateNo: number, vx: string, instance: string) => ({
    id,
    type: "set_velocity",
    params: { target: "w", vx, vy: 0, mode: "set", profile: MUGEN_PROFILE_ID, state_no: stateNo, instance, controller: `c${stateNo}` },
  });
  const graph = {
    version: 1,
    nodes: [
      node("state_20_velset_0", 20, "2.5", "body"),
      node("t_0_0_enter_velset_0", 20, "2.5", "enter"),
      node("state_0_velset_0", 0, "0", "body"),
      { id: "other", type: "set_velocity", params: { target: "w", vx: 3, vy: 0 } },
    ],
    edges: [],
  };
  return {
    entity_id: "w",
    prefab: null,
    transform: { x: 0, y: 0 },
    components: { logic: { graph: JSON.stringify(graph) } },
  } as unknown as Entity;
}

describe("mugenVelocity", () => {
  it("converts literals to Q8.8 with the same rounding as the backend", () => {
    expect(parseVelocity("2.5")).toEqual({ ok: true, q8: 640, exact: true, effective: "2.5" });
    expect(parseVelocity("-1.75")).toMatchObject({ ok: true, q8: -448, exact: true });
    expect(parseVelocity("0")).toMatchObject({ ok: true, q8: 0 });
    // 2.4 * 256 = 614.4 -> 614 (aproximado, com o valor efetivo explicito)
    expect(parseVelocity("2.4")).toEqual({ ok: true, q8: 614, exact: false, effective: "2.3984375" });
    // metade para longe do zero: 1/512 = 0.001953125 -> 0.5/256
    expect(parseVelocity("0.001953125")).toMatchObject({ q8: 1, exact: false });
    expect(parseVelocity("-0.001953125")).toMatchObject({ q8: -1, exact: false });
    expect(parseVelocity("127.99609375")).toMatchObject({ ok: true, q8: 32767, exact: true });
  });

  it("refuses expressions, out-of-range values and empty input with a reason", () => {
    for (const bad of ["", "abc", "1e2", "2,5", "const(velocity.walk.fwd.x)", "128", "-128", "1.", ".5", "1+1"]) {
      const parsed = parseVelocity(bad);
      expect(parsed.ok, bad).toBe(false);
      if (!parsed.ok) expect(parsed.message.length).toBeGreaterThan(10);
    }
  });

  it("prints exact decimals", () => {
    expect(q8ToDecimal(640)).toBe("2.5");
    expect(q8ToDecimal(-448)).toBe("-1.75");
    expect(q8ToDecimal(1)).toBe("0.00390625");
  });

  it("lists one velocity per state and rewrites body and enter nodes together", () => {
    const entity = walkerEntity();
    expect(readMugenVelocities(entity).map((s) => [s.stateNo, s.vx])).toEqual([
      [0, "0"],
      [20, "2.5"],
    ]);
    const next = withMugenVelocity(entity, 20, "3.75");
    expect(next).not.toBeNull();
    const nodes = JSON.parse(next as string).nodes as Array<{ id: string; params: Record<string, unknown> }>;
    expect(nodes.filter((n) => n.params.state_no === 20).map((n) => n.params.vx)).toEqual(["3.75", "3.75"]);
    expect(nodes.find((n) => n.params.state_no === 0)?.params.vx).toBe("0");
    expect(nodes.find((n) => n.id === "other")?.params.vx).toBe(3);
    expect(withMugenVelocity(entity, 99, "1")).toBeNull();
  });
});

describe("HitDef do CNS (mugen.original_chain.v2)", () => {
  const program = {
    profile: "mugen.original_chain.v2",
    target_life: { value: 120, origin: "source" },
    states: [{ no: 200, controllers: [
      { id: "200#0", src: { file: "striker.cns", line: 13 }, all: [], groups: [[{ src: { text: "trigger1 = AnimElem = 2" } }]],
        hitdef: { damage: 25, hitflag: "MAF", hits_standing: true, pause_p1: 4, pause_p2: 6 } },
      { id: "200#1", src: { file: "striker.cns", line: 25 }, all: [], groups: [], target: 0 },
    ] }],
  };
  const entity = (hitTarget: string) => ({
    entity_id: "striker",
    transform: { x: 0, y: 0 },
    components: { logic: { graph: JSON.stringify({ version: 1, nodes: [
      { id: "mugen_state_program", type: "mugen_state_program", params: { target: "striker", program_json: JSON.stringify(program), hit_target: hitTarget } },
    ], edges: [] }) } },
  }) as unknown as Parameters<typeof readMugenHitTarget>[0];

  it("le o golpe, a origem e o alvo sem tocar no programa", () => {
    const hit = readMugenHitTarget(entity(""))!;
    expect(hit.hitdefs).toHaveLength(1);
    expect(hit.hitdefs[0]).toMatchObject({ damage: 25, source: "striker.cns:13", pause: [4, 6], triggers: ["trigger1 = AnimElem = 2"] });
    expect(hit.life).toBe(120);
    const graph = withMugenHitTarget(entity(""), "striker_target")!;
    const node = JSON.parse(graph).nodes[0];
    expect(node.params.hit_target).toBe("striker_target");
    expect(node.params.program_json).toBe(JSON.stringify(program));
  });

  it("programa sem HitDef nao mostra o controle", () => {
    const e = entity("");
    const g = JSON.parse(e.components.logic!.graph!);
    g.nodes[0].params.program_json = JSON.stringify({ ...program, states: [] });
    e.components.logic!.graph = JSON.stringify(g);
    expect(readMugenHitTarget(e)).toBeNull();
  });
});
