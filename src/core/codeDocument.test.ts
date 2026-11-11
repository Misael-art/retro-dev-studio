import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import {
  CODE_EDIT_SCHEMA,
  bindingAtLine,
  buildCodeEditTransaction,
  findBinding,
  isReceiptCurrent,
  planCodeEdit,
  regionText,
  type CodeBinding,
  type CodeDocument,
  type CodeEditReceipt,
} from "./codeDocument";
import { loadCodeDocument, submitCodeEdit } from "./codeEditApply";
import type { Scene } from "./ipc/sceneService";
import { deserializeNodeGraph } from "./nodegraph/nodeDefinitions";
import { serializeNodeGraph } from "./nodegraph/nodeTypes";
import { useEditorStore } from "./store/editorStore";

const GRAPH = JSON.stringify({ version: 1, nodes: [{ id: "move", type: "sprite_move" }], edges: [] });
const NEXT_GRAPH = JSON.stringify({ version: 1, nodes: [{ id: "move", type: "code_block" }], edges: [] });

function binding(instance: string, node: string, start: number, end: number): CodeBinding {
  return {
    project: "/proj", scene_id: "main", instance_id: instance, graph_sha256: "g".repeat(64), node_id: node,
    semantic_stage: "sprite_move", revision: "r1", status: "mapped", unsupported_reason: null,
    generated_locations: [{ file: "src/main.c", start_line: start, start_column: 1, end_line: end, end_column: 1 }],
  };
}

const DOCUMENT: CodeDocument = {
  schema: "rds-code-document/v1",
  context: { project: "/proj", scene_id: "main", revision: "r1" },
  kind: "authored_projection", governs_build: "scene_model", target: "megadrive", file: "src/main.c",
  text: ["void a(void) {", "  if (x) {", "    x += 37;", "  }", "}", "void b(void) {", "    x += 37;", "}"].join("\n"),
  bindings: [binding("hero_a", "if", 2, 4), binding("hero_a", "move", 3, 3), binding("hero_b", "move", 7, 7)],
};

function scene(refA?: string, refB?: string): Scene {
  const entity = (id: string, ref?: string) => ({
    entity_id: id, transform: { x: 0, y: 0 },
    components: { logic: { graph: GRAPH, ...(ref ? { graph_ref: ref } : {}) } },
  });
  return { scene_id: "main", entities: [entity("hero_a", refA), entity("hero_b", refB)], background_layers: [] } as Scene;
}

function receipt(overrides: Partial<CodeEditReceipt> = {}): CodeEditReceipt {
  return {
    schema: CODE_EDIT_SCHEMA, context: { ...DOCUMENT.context }, status: "code_node", instance_id: "hero_a",
    node_id: "move", scope: "instance", graph: NEXT_GRAPH, changed_params: [], absorbed_node_ids: [],
    shared_uses: [], message: "", ...overrides,
  };
}

describe("code document bindings", () => {
  it("links code and node in both directions, per instance", () => {
    // node -> código
    const a = findBinding(DOCUMENT, "hero_a", "move")!;
    const b = findBinding(DOCUMENT, "hero_b", "move")!;
    expect(regionText(DOCUMENT, a)).toBe("    x += 37;");
    expect(a.generated_locations[0].start_line).not.toBe(b.generated_locations[0].start_line);
    // código -> node: o vínculo mais interno vence e a instância é respeitada
    expect(bindingAtLine(DOCUMENT, 3)?.node_id).toBe("move");
    expect(bindingAtLine(DOCUMENT, 2)?.node_id).toBe("if");
    expect(bindingAtLine(DOCUMENT, 7)?.instance_id).toBe("hero_b");
    expect(bindingAtLine(DOCUMENT, 7, "hero_a")).toBeNull();
    expect(bindingAtLine(DOCUMENT, 1)).toBeNull();
  });

  it("builds instance-scoped transactions carrying the document identity", () => {
    const tx = buildCodeEditTransaction(DOCUMENT, findBinding(DOCUMENT, "hero_a", "move")!, "    x += 41;");
    expect(tx).toMatchObject({
      schema: CODE_EDIT_SCHEMA, context: DOCUMENT.context, instance_id: "hero_a", node_id: "move", scope: "instance",
    });
  });

  it("discards receipts from another project, scene or revision", () => {
    const live = { project: "/proj", sceneId: "main", documentRevision: "r1" };
    expect(isReceiptCurrent(receipt(), live)).toBe(true);
    expect(isReceiptCurrent(receipt(), { ...live, project: "/other" })).toBe(false);
    expect(isReceiptCurrent(receipt(), { ...live, sceneId: "level2" })).toBe(false);
    expect(isReceiptCurrent(receipt(), { ...live, documentRevision: "r2" })).toBe(false);
  });
});

describe("planCodeEdit scope", () => {
  it("instance scope changes one of two identical instances only", () => {
    const plan = planCodeEdit(receipt(), scene())!;
    expect(plan.patches.map((patch) => patch.entityId)).toEqual(["hero_a"]);
    expect(plan.detached).toBe(false);
    expect(plan.patches[0].logic.graph).toBe(NEXT_GRAPH);
  });

  it("instance scope detaches from a shared definition instead of rewriting it", () => {
    const plan = planCodeEdit(receipt({ shared_uses: ["hero_b"] }), scene("graphs/hero.json", "graphs/hero.json"))!;
    expect(plan.patches).toHaveLength(1);
    expect(plan.detached).toBe(true);
    expect(plan.patches[0].logic).toMatchObject({ graph: NEXT_GRAPH, graph_ref: "" });
    expect(plan.affectedUses).toEqual([]);
  });

  it("shared scope updates every use and reports them", () => {
    const plan = planCodeEdit(
      receipt({ scope: "shared", shared_uses: ["hero_b"] }),
      scene("graphs/hero.json", "graphs/hero.json"),
    )!;
    expect(plan.patches.map((patch) => patch.entityId)).toEqual(["hero_a", "hero_b"]);
    expect(plan.affectedUses).toEqual(["hero_b"]);
    expect(plan.patches.every((patch) => patch.logic.graph_ref === "graphs/hero.json")).toBe(true);
  });

  it("stale, rejected and unchanged receipts never produce a plan", () => {
    for (const status of ["stale", "rejected", "no_change"] as const) {
      expect(planCodeEdit(receipt({ status, graph: null }), scene())).toBeNull();
    }
  });
});

describe("submitCodeEdit against the editor store", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    useEditorStore.getState().setActiveProject("/proj", "Proj");
    const base = scene();
    useEditorStore.getState().setActiveScene(base, structuredClone(base));
  });

  const tx = () => buildCodeEditTransaction(DOCUMENT, findBinding(DOCUMENT, "hero_a", "move")!, "x();");
  const graphOf = (id: string) =>
    useEditorStore.getState().activeScene!.entities.find((entity) => entity.entity_id === id)!.components.logic!.graph;

  it("applies to the selected instance as one undo step and leaves the twin untouched", async () => {
    mocks.invoke.mockResolvedValue(receipt());
    const undoBefore = useEditorStore.getState().undoStack.length;
    const outcome = await submitCodeEdit(DOCUMENT, tx());

    expect(outcome.kind).toBe("applied");
    expect(mocks.invoke).toHaveBeenCalledWith("code_edit_analyze", expect.objectContaining({ projectDir: "/proj" }));
    expect(graphOf("hero_a")).toBe(NEXT_GRAPH);
    expect(graphOf("hero_b")).toBe(GRAPH);
    expect(useEditorStore.getState().undoStack.length).toBe(undoBefore + 1);
    useEditorStore.getState().undo();
    expect(graphOf("hero_a")).toBe(GRAPH);
  });

  it("shared scope is still a single undo step", async () => {
    const shared = scene("graphs/hero.json", "graphs/hero.json");
    useEditorStore.getState().setActiveScene(shared, structuredClone(shared));
    mocks.invoke.mockResolvedValue(receipt({ scope: "shared", shared_uses: ["hero_b"] }));
    const undoBefore = useEditorStore.getState().undoStack.length;
    const outcome = await submitCodeEdit(DOCUMENT, tx());

    expect(outcome.kind === "applied" && outcome.plan.affectedUses).toEqual(["hero_b"]);
    expect(graphOf("hero_b")).toBe(NEXT_GRAPH);
    expect(useEditorStore.getState().undoStack.length).toBe(undoBefore + 1);
    useEditorStore.getState().undo();
    expect(graphOf("hero_a")).toBe(GRAPH);
    expect(graphOf("hero_b")).toBe(GRAPH);
  });

  it("discards a late answer when the scene changed meanwhile", async () => {
    mocks.invoke.mockImplementation(async () => {
      useEditorStore.getState().updateEntity("hero_b", { transform: { x: 9, y: 0 } });
      return receipt();
    });
    const outcome = await submitCodeEdit(DOCUMENT, tx());
    expect(outcome.kind).toBe("discarded");
    expect(graphOf("hero_a")).toBe(GRAPH);
  });

  it("discards a late answer after switching project", async () => {
    mocks.invoke.mockImplementation(async () => {
      useEditorStore.getState().setActiveProject("/other", "Other");
      return receipt();
    });
    expect((await submitCodeEdit(DOCUMENT, tx())).kind).toBe("discarded");
  });

  it("discards a receipt of another revision and keeps stale receipts inert", async () => {
    mocks.invoke.mockResolvedValue(receipt({ context: { ...DOCUMENT.context, revision: "old" } }));
    expect((await submitCodeEdit(DOCUMENT, tx())).kind).toBe("discarded");
    mocks.invoke.mockResolvedValue(receipt({ status: "stale", graph: null }));
    expect((await submitCodeEdit(DOCUMENT, tx())).kind).toBe("unchanged");
    expect(graphOf("hero_a")).toBe(GRAPH);
  });

  it("drops a projected document that arrives for a scene that already changed", async () => {
    mocks.invoke.mockResolvedValue(DOCUMENT);
    expect(await loadCodeDocument()).toEqual(DOCUMENT);
    mocks.invoke.mockImplementation(async () => {
      useEditorStore.getState().updateEntity("hero_a", { transform: { x: 3, y: 0 } });
      return DOCUMENT;
    });
    expect(await loadCodeDocument()).toBeNull();
  });
});

describe("code drafts live in the graph model", () => {
  it("round-trips recoverable drafts through graph serialization and drops orphans", () => {
    const serialized = JSON.stringify({
      version: 1,
      nodes: [{ id: "move", type: "code_block", label: "Código C", x: 0, y: 0, inputs: [], outputs: [], params: { code: "x();" } }],
      edges: [],
      codeDrafts: [{ nodeId: "move", text: "if (" }, { nodeId: "gone", text: "y" }],
    });
    const graph = deserializeNodeGraph(serialized);
    expect(graph.nodes[0].type).toBe("code_block");
    expect(graph.codeDrafts).toEqual([{ nodeId: "move", text: "if (" }]);
    expect(JSON.parse(serializeNodeGraph(graph)).codeDrafts).toEqual([{ nodeId: "move", text: "if (" }]);
  });
});
