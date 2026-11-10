import { describe, expect, it } from "vitest";

import {
  resolveBuildProvenanceForGraph,
  sha256Text,
  sourceMapBindings,
  type BuildSourceMap,
} from "./buildProvenance";

const GRAPH = JSON.stringify({ version: 1, nodes: [], edges: [] });

async function sourceMapFor(graph = GRAPH): Promise<BuildSourceMap> {
  return {
    schema_version: 1,
    kind: "node_build_source_map",
    evidence_label: "Proveniência de build observada",
    target: "megadrive",
    generated_file: "src/main.c",
    generated_source_sha256: "a".repeat(64),
    artifact: { path: "/project/build/megadrive/out/game.bin", sha256: "b".repeat(64) },
    limitations: ["Não é evidência de runtime."],
    graphs: [
      {
        graph_version: 1,
        graph_sha256: await sha256Text(graph),
        entries: [],
      },
    ],
  };
}

describe("build provenance contract", () => {
  it("accepts only the exact NodeGraph revision used by the build", async () => {
    const result = await resolveBuildProvenanceForGraph(await sourceMapFor(), GRAPH);
    expect(result.status).toBe("observed");
  });

  it("rejects an incompatible graph hash instead of reusing stale mappings", async () => {
    const changedGraph = JSON.stringify({ version: 1, nodes: [{ id: "new" }], edges: [] });
    const result = await resolveBuildProvenanceForGraph(
      await sourceMapFor(),
      changedGraph,
    );
    expect(result).toEqual({
      status: "incompatible",
      reason: "A revisão/hash do NodeGraph mudou desde o último build.",
    });
  });

  it("rejects an incompatible source-map schema", async () => {
    const sourceMap = await sourceMapFor();
    sourceMap.schema_version = 3;
    const result = await resolveBuildProvenanceForGraph(sourceMap, GRAPH);
    expect(result.status).toBe("incompatible");
  });

  it("reads legacy v1 maps as bindings of unknown instance", async () => {
    const sourceMap = await sourceMapFor();
    sourceMap.graphs[0].entries.push({
      node_id: "move", semantic_stage: "sprite_move", status: "mapped", unsupported_reason: null,
      generated_locations: [{ file: "src/main.c", start_line: 3, start_column: 1, end_line: 3, end_column: 9 }],
    });
    const bindings = sourceMapBindings(sourceMap);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ instance_id: "", node_id: "move", revision: "a".repeat(64) });
  });

  it("v2: two instances with identical graphs resolve to their own code ranges", async () => {
    const sourceMap = await sourceMapFor();
    const graphSha = sourceMap.graphs[0].graph_sha256;
    const location = (line: number) => ({ file: "src/main.c", start_line: line, start_column: 1, end_line: line, end_column: 9 });
    sourceMap.schema_version = 2;
    sourceMap.graphs[0].entries.push({
      node_id: "move", semantic_stage: "sprite_move", status: "mapped", unsupported_reason: null,
      generated_locations: [location(10), location(20)],
    });
    const binding = (instance: string, line: number) => ({
      project: "p", scene_id: "main", instance_id: instance, graph_sha256: graphSha, node_id: "move",
      semantic_stage: "sprite_move", revision: "a".repeat(64), status: "mapped" as const,
      generated_locations: [location(line)], unsupported_reason: null,
    });
    sourceMap.bindings = [binding("hero_a", 10), binding("hero_b", 20)];

    const forB = await resolveBuildProvenanceForGraph(sourceMap, GRAPH, "hero_b");
    expect(forB.status === "observed" && forB.graph.entries[0].generated_locations).toEqual([location(20)]);
    const aggregated = await resolveBuildProvenanceForGraph(sourceMap, GRAPH);
    expect(aggregated.status === "observed" && aggregated.graph.entries[0].generated_locations).toHaveLength(2);
  });
});
