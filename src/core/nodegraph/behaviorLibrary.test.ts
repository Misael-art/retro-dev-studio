import { describe, expect, it } from "vitest";

import {
  applyMovementNodeTuning,
  describeMovementTuning,
  buildBehaviorSceneContext,
  defaultBehaviorParams,
  duplicateBehaviorLogic,
  getBehaviorDefinition,
  manuallyEditedNodes,
  nodeSignature,
  passageOpenVariable,
  planApplyBehavior,
  planEditBehavior,
  planRemoveBehavior,
  validateBehaviorInstances,
  type BehaviorSceneContext,
} from "./behaviorLibrary";
import { deserializeNodeGraph } from "./nodeDefinitions";
import { findNodeOverlaps, graphSemanticSignature } from "./nodeLayout";
import { serializeNodeGraph, type NodeGraph } from "./nodeTypes";

const sprite = (animations: string[] = ["idle", "jump", "run"]) => ({ animations: Object.fromEntries(animations.map((name) => [name, {}])) });
const context: BehaviorSceneContext = buildBehaviorSceneContext(
  [
    { entity_id: "fox", display_name: "Raposa", components: { sprite: sprite(), physics: {}, collision: {}, audio: { sfx: { jump: "a.wav" } } } },
    { entity_id: "fox_2", display_name: "Raposa 2", components: { sprite: sprite(), physics: {}, collision: {} } },
    { entity_id: "ghost", components: { sprite: sprite([]) } },
    { entity_id: "gate", components: { sprite: sprite([]), collision: {} } },
    { entity_id: "camera", components: {} },
  ],
  [{ nodes: [{ id: "s", type: "var_set", label: "s", x: 0, y: 0, inputs: [], outputs: [], params: { var_name: "score", value: 0 } }], edges: [] }]
);
const EMPTY: NodeGraph = { nodes: [], edges: [] };
const moveParams = (target: string, extra: Record<string, string | number> = {}) => ({
  ...defaultBehaviorParams(getBehaviorDefinition("platform_movement")!, context, EMPTY, target),
  ...extra,
});

function apply(graph: NodeGraph, behaviorId: string, params: Record<string, string | number>) {
  const plan = planApplyBehavior(graph, behaviorId, params, context);
  expect(plan.errors).toEqual([]);
  return { graph: plan.graph!, id: plan.instanceId!, plan };
}

describe("behavior library", () => {
  it("generates canonical nodes with per-instance ids, a summary and a visual group", () => {
    const { graph, id, plan } = apply(EMPTY, "platform_movement", moveParams("fox", { speed: 3, jump_sound: "jump", jump_animation: "jump" }));
    expect(id).toBe("bh_move_fox_1");
    expect(plan.summary).toContain("Raposa anda 3 px por quadro");
    expect(plan.summary).toContain('tocando "jump"');
    const move = graph.nodes.find((node) => node.id === `${id}__right_move`)!;
    expect(move).toMatchObject({ type: "sprite_move", params: expect.objectContaining({ target: "fox", dx: 3, behavior_instance: id }) });
    expect(graph.nodes.find((node) => node.id === `${id}__jump_velocity`)!.params.vy).toBe(-64);
    // Salto so do chao: apertar -> esta no chao? (Sim) -> impulso; nenhum caminho direto.
    expect(graph.nodes.find((node) => node.id === `${id}__jump_ground`)).toMatchObject({ type: "condition_on_ground", params: expect.objectContaining({ target: "fox" }) });
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromNode: `${id}__jump_input`, toNode: `${id}__jump_ground` }),
      expect.objectContaining({ fromNode: `${id}__jump_ground`, fromPort: "true", toNode: `${id}__jump_velocity` }),
    ]));
    expect(graph.edges.some((edge) => edge.fromNode === `${id}__jump_input` && edge.toNode === `${id}__jump_velocity`)).toBe(false);
    expect(graph.groups).toEqual([expect.objectContaining({ id, nodeIds: graph.behaviors![0].nodeIds })]);
    expect(findNodeOverlaps(graph)).toEqual([]);
    // Persistencia: a instancia sobrevive a serializar/reabrir.
    const reopened = deserializeNodeGraph(serializeNodeGraph(graph));
    expect(reopened.behaviors).toEqual(graph.behaviors);
    expect(validateBehaviorInstances(reopened, context)).toEqual([]);
  });

  it("chooses idle/run on the ground and jump in the air in the same behavior, and faces the walk direction (JV09/JV10)", () => {
    const { graph, id, plan } = apply(EMPTY, "platform_movement", moveParams("fox", { idle_animation: "idle", run_animation: "run", jump_animation: "jump" }));
    expect(plan.summary).toContain('"run" andando');
    const node = (role: string) => graph.nodes.find((n) => n.id === `${id}__${role}`)!;
    expect(node("right_move").params.face_direction).toBe(1);
    expect(node("left_move").params.face_direction).toBe(1);
    const moving = `${id}_moving`;
    expect(node("mark_right").params).toMatchObject({ var_name: moving, value: 1 });
    expect(node("anim_read").params.var_name).toBe(moving);
    expect(node("anim_idle").params.state).toBe("idle");
    expect(node("anim_run").params.state).toBe("run");
    expect(node("anim_air").params.state).toBe("jump");
    const edge = (from: string, port: string, to: string) =>
      expect(graph.edges).toEqual(expect.arrayContaining([expect.objectContaining({ fromNode: `${id}__${from}`, fromPort: port, toNode: `${id}__${to}` })]));
    edge("right_move", "exec", "mark_right");
    edge("anim_ground", "true", "anim_still");
    edge("anim_read", "value", "anim_still");
    edge("anim_still", "true", "anim_idle");
    edge("anim_still", "false", "anim_run");
    edge("anim_ground", "false", "anim_air");
    for (const role of ["anim_idle", "anim_run", "anim_air"]) edge(role, "exec", "anim_clear");
    // a passagem do quadro de animacao vem depois dos de movimento (ordem dos nos)
    const order = graph.nodes.map((n) => n.id);
    expect(order.indexOf(`${id}__anim_tick`)).toBeGreaterThan(order.indexOf(`${id}__left_tick`));
    expect(findNodeOverlaps(graph)).toEqual([]);
    // so uma das duas poses de chao e recusada (pose ficaria presa)
    expect(planApplyBehavior(EMPTY, "platform_movement", moveParams("fox", { idle_animation: "idle" }), context).errors.join(" ")).toContain("parado E");
    // sem animacoes por estado: nenhum no extra (projetos existentes inalterados)
    const plain = apply(EMPTY, "platform_movement", moveParams("fox", {}));
    expect(plain.graph.nodes.some((n) => n.id.includes("anim_"))).toBe(false);
  });

  it("does not flag behaviors created before JV10 as manually edited after reopening", () => {
    // Projetos antigos: nos de movimento sem face_direction. Reabrir nao pode inventar edicao manual.
    const { graph, id } = apply(EMPTY, "platform_movement", moveParams("fox", {}));
    const legacy: NodeGraph = { ...graph, nodes: graph.nodes.map((n) => {
      if (n.type !== "sprite_move") return n;
      const params = { ...(n.params as Record<string, unknown>) };
      delete params.face_direction;
      return { ...n, params } as typeof n;
    }) };
    const instance = { ...legacy.behaviors![0] };
    instance.generated = Object.fromEntries(legacy.nodes.filter((n) => instance.nodeIds.includes(n.id)).map((n) => [n.id, nodeSignature(n)]));
    const reopened = deserializeNodeGraph(serializeNodeGraph({ ...legacy, behaviors: [instance] }));
    expect(manuallyEditedNodes(reopened, reopened.behaviors![0]).map((n) => n.id)).toEqual([]);
    expect(id).toBeTruthy();
  });

  it("keeps two instances on two entities independent (negative control for shared state / wrong target)", () => {
    const a = apply(EMPTY, "platform_movement", moveParams("fox", { speed: 1 }));
    const b = apply(a.graph, "platform_movement", moveParams("fox_2", { speed: 3, right_button: "BUTTON_C", left_button: "", jump_button: "BUTTON_START" }));
    const node = (graph: NodeGraph, id: string) => graph.nodes.find((candidate) => candidate.id === id)!;
    expect(node(b.graph, `${a.id}__right_move`).params).toMatchObject({ target: "fox", dx: 1 });
    expect(node(b.graph, `${b.id}__right_move`).params).toMatchObject({ target: "fox_2", dx: 3 });
    expect(node(b.graph, `${b.id}__right_input`).params.button).toBe("BUTTON_C");

    const edited = planEditBehavior(b.graph, b.id, { ...b.graph.behaviors![1].params, speed: 5 }, context);
    expect(edited.errors).toEqual([]);
    expect(node(edited.graph!, `${b.id}__right_move`).params.dx).toBe(5);
    // Editar a segunda nao muda a primeira: nos, arestas e parametros identicos.
    const firstOf = (graph: NodeGraph) => ({
      nodes: graph.nodes.filter((candidate) => candidate.params.behavior_instance === a.id),
      edges: graph.edges.filter((edge) => edge.id.startsWith(a.id)),
      instance: graph.behaviors!.find((instance) => instance.id === a.id),
    });
    expect(firstOf(edited.graph!)).toEqual(firstOf(b.graph));
  });

  it("refuses invalid references with a useful message", () => {
    const bad = (params: Record<string, string | number>) => planApplyBehavior(EMPTY, "platform_movement", params, context).errors.join(" | ");
    expect(bad(moveParams("fox", { target: "nope" }))).toContain('"nope" nao existe');
    expect(bad(moveParams("fox", { target: "camera" }))).toContain("nao tem sprite");
    expect(bad(moveParams("ghost"))).toContain("nao tem fisica");
    expect(bad(moveParams("fox", { speed: 0 }))).toContain("entre 1 e 8");
    expect(bad(moveParams("fox", { jump_button: "BUTTON_RIGHT" }))).toContain("mesmo botao");
    expect(bad(moveParams("fox", { jump_sound: "boom" }))).toContain('"boom" nao existe');
    expect(bad(moveParams("fox", { jump_animation: "fly" }))).toContain('nao tem a animacao "fly"');
    const passage = (params: Record<string, string | number>) => planApplyBehavior(EMPTY, "gated_passage", params, context).errors.join(" | ");
    expect(passage({ movement: "x", blocker: "gate", state_variable: "score", threshold: 5 })).toContain("Movimento bloqueado");
    const moved = apply(EMPTY, "platform_movement", moveParams("fox"));
    expect(planApplyBehavior(moved.graph, "gated_passage", { movement: moved.id, blocker: "fox", state_variable: "score", threshold: 5 }, context).errors.join()).toContain("bloquear a si mesma");
    expect(planApplyBehavior(moved.graph, "gated_passage", { movement: moved.id, blocker: "gate", state_variable: "nobody_writes", threshold: 5 }, context).errors.join()).toContain("nunca seria alcancado");
    expect(planApplyBehavior(moved.graph, "gated_passage", { movement: moved.id, blocker: "gate", state_variable: "score", threshold: -1 }, context).errors.join()).toContain("entre 0 e 32767");
  });

  it("refuses the grounded jump on SNES but keeps movement without jump", () => {
    const snes = { ...context, platform: "snes" };
    expect(planApplyBehavior(EMPTY, "platform_movement", moveParams("fox"), snes).errors.join()).toContain("SNES");
    expect(planApplyBehavior(EMPTY, "platform_movement", moveParams("fox", { jump_button: "" }), snes).errors).toEqual([]);
  });

  it("warns before duplicating logic on the same entity", () => {
    const first = apply(EMPTY, "platform_movement", moveParams("fox"));
    const again = planApplyBehavior(first.graph, "platform_movement", moveParams("fox"), context);
    expect(again.conflicts).toEqual([expect.objectContaining({ kind: "duplicate" })]);
    const manual: NodeGraph = deserializeNodeGraph(
      JSON.stringify({ version: 1, nodes: [{ id: "m", type: "sprite_move", label: "m", x: 0, y: 0, params: { target: "fox", dx: 2 } }], edges: [] })
    );
    expect(planApplyBehavior(manual, "platform_movement", moveParams("fox"), context).conflicts).toEqual([expect.objectContaining({ kind: "manual_logic" })]);
  });

  it("gates the movement with an instance-private state and restores it on removal", () => {
    const moved = apply(EMPTY, "platform_movement", moveParams("fox"));
    const gated = apply(moved.graph, "gated_passage", { movement: moved.id, blocker: "gate", state_variable: "score", threshold: 12 });
    const open = passageOpenVariable(gated.id);
    expect(gated.graph.nodes.find((node) => node.id === `${gated.id}__open`)!.params.var_name).toBe(open);
    // O caminho direto input->mover foi substituido pela porta.
    expect(gated.graph.edges.some((edge) => edge.fromNode === `${moved.id}__right_input` && edge.toNode === `${moved.id}__right_move`)).toBe(false);
    expect(gated.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromNode: `${moved.id}__right_input`, toNode: `${gated.id}__right_gate` }),
      expect.objectContaining({ fromNode: `${gated.id}__right_gate`, fromPort: "false", toNode: `${moved.id}__right_move` }),
      expect.objectContaining({ fromNode: `${gated.id}__right_open_check`, fromPort: "true", toNode: `${moved.id}__right_move` }),
    ]));
    // Dependencia: nao remove o movimento enquanto a passagem existir.
    expect(planRemoveBehavior(gated.graph, moved.id).errors.join()).toContain("depende");
    // Editar o movimento reaplica a passagem (sem perder a porta).
    const faster = planEditBehavior(gated.graph, moved.id, { ...gated.graph.behaviors![0].params, speed: 4 }, context).graph!;
    expect(faster.nodes.find((node) => node.id === `${gated.id}__right_gate`)!.params.probe_dx).toBe(4);
    // Remover a passagem restaura exatamente o movimento original.
    const removed = planRemoveBehavior(faster, gated.id).graph!;
    const reference = planEditBehavior(moved.graph, moved.id, { ...moved.graph.behaviors![0].params, speed: 4 }, context).graph!;
    expect(graphSemanticSignature(removed)).toBe(graphSemanticSignature(reference));
    expect(removed.nodes.some((node) => String(node.params.var_name ?? "") === open)).toBe(false);
  });

  it("chains several passages on the same movement and removes them in any order without orphans", () => {
    const ctx = buildBehaviorSceneContext(
      [...context.entities.map((entity) => ({ entity_id: entity.id, components: { sprite: entity.hasSprite ? sprite(entity.animations) : undefined, physics: entity.hasPhysics ? {} : undefined, collision: entity.hasCollision ? {} : undefined } })),
        { entity_id: "gate_2", components: { collision: {} } }],
      [{ nodes: [{ id: "s", type: "var_set", label: "s", x: 0, y: 0, inputs: [], outputs: [], params: { var_name: "score", value: 0 } }], edges: [] }]
    );
    const moved = apply(EMPTY, "platform_movement", moveParams("fox"));
    const inner = planApplyBehavior(moved.graph, "gated_passage", { movement: moved.id, blocker: "gate", state_variable: "score", threshold: 20 }, ctx);
    const outer = planApplyBehavior(inner.graph!, "gated_passage", { movement: moved.id, blocker: "gate_2", state_variable: "score", threshold: 20 }, ctx);
    const g = outer.graph!;
    const to = (from: string, port = "exec") => g.edges.filter((edge) => edge.fromNode === from && edge.fromPort === port).map((edge) => edge.toNode);
    for (const side of ["right", "left"]) {
      // entrada -> porta externa -> (livre) porta interna -> (livre) mover; cada porta gate so abre pelo seu estado.
      expect(to(`${moved.id}__${side}_input`)).toEqual([`${outer.instanceId}__${side}_gate`]);
      expect(to(`${outer.instanceId}__${side}_gate`, "false")).toEqual([`${inner.instanceId}__${side}_gate`]);
      expect(to(`${outer.instanceId}__${side}_open_check`, "true")).toEqual([`${inner.instanceId}__${side}_gate`]);
      expect(to(`${inner.instanceId}__${side}_gate`, "false")).toEqual([`${moved.id}__${side}_move`]);
    }
    // Estados privados distintos.
    expect(new Set(g.nodes.filter((node) => node.type === "var_set").map((node) => node.params.var_name)).size).toBe(2);
    const noOrphans = (graph: NodeGraph) => {
      const ids = new Set(graph.nodes.map((node) => node.id));
      return graph.edges.every((edge) => ids.has(edge.fromNode) && ids.has(edge.toNode));
    };
    // Remover a interna primeiro: a externa passa a envolver o mover.
    const withoutInner = planRemoveBehavior(g, inner.instanceId!).graph!;
    expect(noOrphans(withoutInner)).toBe(true);
    const to2 = (graph: NodeGraph, from: string, port = "exec") => graph.edges.filter((edge) => edge.fromNode === from && edge.fromPort === port).map((edge) => edge.toNode);
    expect(to2(withoutInner, `${outer.instanceId}__right_gate`, "false")).toEqual([`${moved.id}__right_move`]);
    expect(to2(withoutInner, `${outer.instanceId}__right_open_check`, "true")).toEqual([`${moved.id}__right_move`]);
    const bothGone = planRemoveBehavior(withoutInner, outer.instanceId!).graph!;
    expect(graphSemanticSignature(bothGone)).toBe(graphSemanticSignature(moved.graph));
    // Ordem inversa tambem restaura exatamente o original.
    const outerFirst = planRemoveBehavior(planRemoveBehavior(g, outer.instanceId!).graph!, inner.instanceId!).graph!;
    expect(graphSemanticSignature(outerFirst)).toBe(graphSemanticSignature(moved.graph));
    // Editar o movimento reaplica as duas passagens, mantendo a cadeia.
    const edited = planEditBehavior(g, moved.id, { ...g.behaviors![0].params, speed: 8 }, ctx).graph!;
    expect(to2(edited, `${moved.id}__right_input`)).toEqual([`${outer.instanceId}__right_gate`]);
    expect(edited.nodes.find((node) => node.id === `${inner.instanceId}__right_gate`)!.params.probe_dx).toBe(8);
    expect(noOrphans(edited)).toBe(true);
  });

  it("detects manual edits before regenerating and keeps manual connections that still fit", () => {
    const moved = apply(EMPTY, "platform_movement", moveParams("fox"));
    const touched: NodeGraph = {
      ...moved.graph,
      nodes: moved.graph.nodes.map((node) => (node.id === `${moved.id}__jump_velocity` ? { ...node, params: { ...node.params, vy: -10 } } : node)),
    };
    expect(manuallyEditedNodes(touched, touched.behaviors![0]).map((node) => node.id)).toEqual([`${moved.id}__jump_velocity`]);
    const plan = planEditBehavior(touched, moved.id, { ...touched.behaviors![0].params, speed: 2 }, context);
    expect(plan.conflicts).toEqual([expect.objectContaining({ kind: "manual_edit" })]);
    expect(plan.graph!.nodes.find((node) => node.id === `${moved.id}__jump_velocity`)!.params.vy).toBe(-64);
  });

  it("removing one instance preserves the other untouched", () => {
    const a = apply(EMPTY, "platform_movement", moveParams("fox"));
    const b = apply(a.graph, "platform_movement", moveParams("fox_2", { speed: 3 }));
    const removed = planRemoveBehavior(b.graph, a.id).graph!;
    expect(removed.behaviors!.map((instance) => instance.id)).toEqual([b.id]);
    expect(removed.nodes.every((node) => node.params.behavior_instance === b.id)).toBe(true);
    const only = apply(EMPTY, "platform_movement", moveParams("fox_2", { speed: 3 }));
    // Mesmo conteudo que aplicar so a segunda (ids diferem so pelo contador; comparar papeis).
    const roles = (graph: NodeGraph) => graph.nodes.map((node) => [node.params.behavior_role, node.params.target ?? null, node.params.dx ?? null]).sort();
    expect(roles(removed)).toEqual(roles(only.graph));
  });

  it("duplicates an entity's behaviors with remapped ids/targets/state and explicit external refs", () => {
    const moved = apply(EMPTY, "platform_movement", moveParams("fox"));
    const gated = apply(moved.graph, "gated_passage", { movement: moved.id, blocker: "gate", state_variable: "score", threshold: 12 });
    const manual: NodeGraph = {
      ...gated.graph,
      nodes: [...gated.graph.nodes, { ...gated.graph.nodes[0], id: "manual_only", params: { rate: "frame" } }],
    };
    const copy = duplicateBehaviorLogic(manual, "fox", "fox_2", [moved.id, gated.id]);
    expect(copy.droppedManualNodes).toBe(1);
    const ids = copy.graph.behaviors!.map((instance) => instance.id);
    expect(ids.some((id) => id === moved.id || id === gated.id)).toBe(false);
    // Nenhum id do original sobrevive na copia; o alvo virou fox_2; a porta usa a copia do movimento.
    const originalIds = new Set(manual.nodes.map((node) => node.id));
    expect(copy.graph.nodes.some((node) => originalIds.has(node.id))).toBe(false);
    expect(copy.graph.nodes.filter((node) => node.type === "sprite_move").every((node) => node.params.target === "fox_2")).toBe(true);
    const copiedPassage = copy.graph.behaviors!.find((instance) => instance.behaviorId === "gated_passage")!;
    const copiedMove = copy.graph.behaviors!.find((instance) => instance.behaviorId === "platform_movement")!;
    expect(copiedPassage.params.movement).toBe(copiedMove.id);
    // Estado privado renomeado (sem estado compartilhado); externos mantidos e listados.
    const openVars = copy.graph.nodes.filter((node) => node.type === "var_set").map((node) => node.params.var_name);
    expect(openVars).toEqual([passageOpenVariable(copiedPassage.id)]);
    expect(openVars).not.toContain(passageOpenVariable(gated.id));
    expect(copy.graph.nodes.find((node) => node.type === "destroy_entity")!.params.target).toBe("gate");
    expect(copy.preservedExternal).toEqual(expect.arrayContaining(["entidade gate", "variavel score"]));
    // Arestas apontam so para nos existentes (sem orfaos) e a copia e valida ao reabrir.
    const present = new Set(copy.graph.nodes.map((node) => node.id));
    expect(copy.graph.edges.every((edge) => present.has(edge.fromNode) && present.has(edge.toNode))).toBe(true);
    const ctx2 = buildBehaviorSceneContext(
      [...context.entities.map((entity) => ({ entity_id: entity.id, components: { sprite: entity.hasSprite ? sprite(entity.animations) : undefined, physics: entity.hasPhysics ? {} : undefined, collision: entity.hasCollision ? {} : undefined } }))],
      [manual]
    );
    expect(validateBehaviorInstances(deserializeNodeGraph(serializeNodeGraph(copy.graph)), ctx2)).toEqual([]);
    expect(manuallyEditedNodes(copy.graph, copiedMove)).toEqual([]);
  });

  it("reports orphan references after reopening", () => {
    const moved = apply(EMPTY, "platform_movement", moveParams("fox_2"));
    const without = buildBehaviorSceneContext([{ entity_id: "fox", components: { sprite: sprite() } }], []);
    expect(validateBehaviorInstances(moved.graph, without)).toEqual([expect.objectContaining({ message: expect.stringContaining('"fox_2" nao existe mais') })]);
  });
});

describe("movement tuning (PLAT09)", () => {
  const graph = {
    nodes: [
      { id: "run_right", type: "set_velocity", label: "Correr", x: 0, y: 0, params: { target: "player", vx: 32, vy: 0 }, inputs: [], outputs: [] },
      { id: "jump", type: "set_velocity", label: "Pulo", x: 0, y: 0, params: { target: "player", vx: 0, vy: -64 }, inputs: [], outputs: [] },
      { id: "nudge", type: "sprite_move", label: "Empurrar", x: 0, y: 0, params: { target: "player", dx: 2, dy: 0 }, inputs: [], outputs: [] },
      { id: "enemy", type: "set_velocity", label: "Inimigo", x: 0, y: 0, params: { target: "enemy", vx: 8, vy: 0 }, inputs: [], outputs: [] },
    ],
    edges: [],
  } as unknown as NodeGraph;

  it("reads the same nodes and physics the ROM uses, in backend units", () => {
    const rows = describeMovementTuning(graph, { gravity: true, gravity_strength: 6, friction: 2, max_velocity: { x: 48, y: 96 } }, "player", 60);
    expect(rows.map((r) => r.kind)).toEqual(["run_speed", "jump_impulse", "displace", "gravity", "braking", "max_speed_x", "max_speed_y"]);
    expect(rows[0]).toMatchObject({ raw: 32, reading: "2.00 px/quadro · 120 px/s", source: { kind: "node", nodeId: "run_right", param: "vx" } });
    expect(rows[1].reading).toBe("4.00 px/quadro · 240 px/s");
    expect(rows[2].reading).toContain("px por execução");
    expect(rows.some((r) => r.id.startsWith("enemy"))).toBe(false);
  });

  it("edits only the chosen node parameter and keeps its direction", () => {
    const next = applyMovementNodeTuning(graph, "jump", "vy", 80);
    expect(next.nodes.find((n) => n.id === "jump")?.params.vy).toBe(-80);
    expect(next.nodes.find((n) => n.id === "run_right")).toBe(graph.nodes[0]);
    expect(next.edges).toBe(graph.edges);
  });
});

describe("R3-05 parameter metadata", () => {
  it("keeps canonical speed/jump ranges and declares jump impulse unit in 1/16 px", async () => {
    const lib = await import("./behaviorLibrary");
    const all = (lib as unknown as { BEHAVIOR_LIBRARY?: Array<{ params: Array<Record<string, unknown>> }> }).BEHAVIOR_LIBRARY;
    expect(all).toBeDefined();
    const specs = all!.flatMap((d) => d.params);
    const speed = specs.find((s) => s.key === "speed");
    const jump = specs.find((s) => s.key === "jump_strength");
    expect(speed).toMatchObject({ min: 1, max: 8, default: 2, unit: "px por quadro" });
    expect(jump).toMatchObject({ min: 8, max: 128, default: 64, unit: "1/16 px por quadro" });
    expect(64 / lib.MOVEMENT_SUBPIXELS).toBe(4);
  });
});

describe("R3-03 provenance", () => {
  it("layout keeps 'generated'; a direct semantic edit flags only that node; save/reopen preserves it", async () => {
    const lib = await import("./behaviorLibrary");
    const { graph, id } = apply(EMPTY, "platform_movement", moveParams("fox"));
    const instance = graph.behaviors!.find((b) => b.id === id)!;
    expect(lib.behaviorProvenance(graph, instance)).toMatchObject({ state: "generated", editedNodeIds: [] });

    const moved: NodeGraph = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, x: n.x + 120, y: n.y - 40 })) };
    expect(lib.behaviorProvenance(moved, instance).state).toBe("generated");

    const target = graph.nodes.find((n) => instance.nodeIds.includes(n.id) && Object.keys(n.params).length > 0)!;
    const key = Object.keys(target.params)[0]!;
    const edited: NodeGraph = { ...graph, nodes: graph.nodes.map((n) => (n.id === target.id ? { ...n, params: { ...n.params, [key]: `${String(n.params[key])}_x` } } : n)) };
    const reopened = deserializeNodeGraph(serializeNodeGraph(edited));
    const after = lib.behaviorProvenance(reopened, reopened.behaviors!.find((b) => b.id === id)!);
    expect(after.state).toBe("customized");
    expect(after.editedNodeIds).toEqual([target.id]);
    expect(lib.behaviorOwnerOfNode(reopened, target.id)?.id).toBe(id);
    expect(lib.behaviorOwnerOfNode(reopened, "not-a-node")).toBeUndefined();
  });
});

describe("R3-03 manual conversion gate", () => {
  it("asks once per untouched generated behavior; free nodes, acknowledged and customized behaviors edit directly", async () => {
    const lib = await import("./behaviorLibrary");
    const { graph, id } = apply(EMPTY, "platform_movement", moveParams("fox"));
    const instance = graph.behaviors!.find((b) => b.id === id)!;
    const owned = instance.nodeIds[0]!;
    expect(lib.needsManualConversion(graph, owned, new Set())?.id).toBe(id);
    expect(lib.needsManualConversion(graph, owned, new Set([id]))).toBeNull();
    expect(lib.needsManualConversion(graph, "free-node", new Set())).toBeNull();
    const target = graph.nodes.find((n) => instance.nodeIds.includes(n.id) && Object.keys(n.params).length > 0)!;
    const key = Object.keys(target.params)[0]!;
    const customized: NodeGraph = { ...graph, nodes: graph.nodes.map((n) => (n.id === target.id ? { ...n, params: { ...n.params, [key]: "changed" } } : n)) };
    expect(lib.needsManualConversion(customized, owned, new Set())).toBeNull();
  });
});
