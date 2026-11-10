import { describe, expect, it } from "vitest";

import type { Entity } from "../ipc/sceneService";
import { describeNodeAction, getNodeCatalogEntry } from "./nodeCatalog";
import { deserializeNodeGraph } from "./nodeDefinitions";
import { validateNodeGraph } from "./nodeEngine";
import { planApplyBehavior, type BehaviorSceneContext } from "./behaviorLibrary";

function graph(params: Record<string, unknown>) {
  return deserializeNodeGraph(
    JSON.stringify({
      version: 1,
      nodes: [
        { id: "tick", type: "event_update", label: "t", x: 0, y: 0, params: {} },
        { id: "strike1", type: "authored_strike", label: "g", x: 0, y: 0, params },
      ],
      edges: [{ id: "e1", fromNode: "tick", fromPort: "exec", toNode: "strike1", toPort: "exec" }],
    })
  );
}

const entities = ["ken", "dummy"].map((id) => ({ entity_id: id, transform: { x: 0, y: 0 }, components: {} }) as Entity);

describe("authored_strike node", () => {
  it("is cataloged as authored combat and described in plain language", () => {
    expect(getNodeCatalogEntry("authored_strike").description).toMatch(/Autoral/);
    const node = graph({ attacker: "ken", target: "dummy", damage: 12, health: 100 }).nodes[1];
    expect(describeNodeAction(node)).toBe("Se o ataque de ken acertar dummy: tirar 12 de vida (uma vez por golpe)");
  });

  it("validates entity references, integer params and platform", () => {
    const ok = validateNodeGraph(graph({ attacker: "ken", target: "dummy", damage: 12, health: 100 }), {
      sceneEntities: entities,
      target: "megadrive",
    });
    expect(ok.errors).toEqual([]);
    const missing = validateNodeGraph(graph({ attacker: "ken", target: "ghost", damage: 12, health: 100 }), {
      sceneEntities: entities,
    });
    expect(missing.errors.some((i) => i.nodeId === "strike1")).toBe(true);
    const snes = validateNodeGraph(graph({ attacker: "ken", target: "dummy", damage: 12, health: 100 }), {
      sceneEntities: entities,
      target: "snes",
    });
    expect(snes.errors.some((i) => i.code === "unsupported_on_platform")).toBe(true);
    const notInt = validateNodeGraph(graph({ attacker: "ken", target: "dummy", damage: "muito", health: 100 }), {
      sceneEntities: entities,
    });
    expect(notInt.errors.some((i) => i.nodeId === "strike1")).toBe(true);
  });
});

describe("strike behavior", () => {
  const context: BehaviorSceneContext = {
    entities: ["ken", "dummy"].map((id) => ({ id, label: id, hasSprite: true, hasPhysics: false, hasCollision: false, animations: [] })),
    sounds: [],
    variables: [],
    instanceIds: [],
  };
  const empty = deserializeNodeGraph(null);

  it("builds Quando(a cada quadro) -> golpe autoral with the chosen params", () => {
    const plan = planApplyBehavior(empty, "strike", { attacker: "ken", target: "dummy", damage: 12, health: 100 }, context);
    expect(plan.ok).toBe(true);
    const strike = plan.graph!.nodes.find((n) => n.type === "authored_strike")!;
    expect(strike.params).toMatchObject({ attacker: "ken", target: "dummy", damage: 12, health: 100 });
    expect(plan.graph!.edges.some((e) => e.toNode === strike.id && e.fromPort === "exec")).toBe(true);
    expect(plan.summary).toContain("uma vez por golpe");
  });

  it("refuses self-hit and out-of-range damage", () => {
    expect(planApplyBehavior(empty, "strike", { attacker: "ken", target: "ken", damage: 12, health: 100 }, context).ok).toBe(false);
    expect(planApplyBehavior(empty, "strike", { attacker: "ken", target: "dummy", damage: 0, health: 100 }, context).ok).toBe(false);
  });
});
