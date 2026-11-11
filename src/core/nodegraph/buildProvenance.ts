/**
 * Contrato canônico do source map de build do NodeGraph (Experimental).
 * v2 acrescenta vínculos por instância (`bindings`); mapas v1 continuam legíveis.
 *
 * Este módulo valida proveniência de geração C/ROM. Ele não representa
 * execução, PC, registradores, estado do emulador ou RuntimeEvidence.
 */

export const BUILD_SOURCE_MAP_SCHEMA_VERSION = 2 as const;
export const BUILD_SOURCE_MAP_LEGACY_SCHEMA_VERSION = 1 as const;

export interface GeneratedSourceLocation {
  file: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
}

export interface NodeBuildProvenance {
  node_id: string;
  semantic_stage: string;
  status: "mapped" | "unsupported";
  generated_locations: GeneratedSourceLocation[];
  unsupported_reason: string | null;
}

export interface GraphBuildProvenance {
  graph_version: number;
  graph_sha256: string;
  entries: NodeBuildProvenance[];
}

/** Vínculo código ↔ modelo: projeto, cena, instância, grafo, node e revisão (v2). */
export interface CodeBinding {
  project: string;
  scene_id: string;
  /** Entidade dona do grafo; vazio = instância desconhecida (mapa v1 convertido). */
  instance_id: string;
  graph_sha256: string;
  node_id: string;
  semantic_stage: string;
  revision: string;
  status: "mapped" | "unsupported";
  generated_locations: GeneratedSourceLocation[];
  unsupported_reason: string | null;
}

export interface BuildSourceMap {
  schema_version: number;
  kind: "node_build_source_map";
  evidence_label: string;
  project?: string;
  scene_id?: string;
  revision?: string;
  bindings?: CodeBinding[];
  target: string;
  generated_file: string;
  generated_source_sha256: string;
  artifact: {
    path: string | null;
    sha256: string | null;
  };
  limitations: string[];
  graphs: GraphBuildProvenance[];
}

export type BuildProvenanceResolution =
  | {
      status: "observed";
      graph: GraphBuildProvenance;
    }
  | {
      status: "incompatible";
      reason: string;
    }
  | {
      status: "missing";
      reason: string;
    };

export async function sha256Text(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 indisponível neste host; proveniência não pode ser validada.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Vínculos de um mapa em qualquer versão; v1 vira vínculos de instância desconhecida. */
export function sourceMapBindings(sourceMap: BuildSourceMap): CodeBinding[] {
  if (sourceMap.bindings && sourceMap.bindings.length > 0) return sourceMap.bindings;
  if (sourceMap.schema_version >= BUILD_SOURCE_MAP_SCHEMA_VERSION) return [];
  return sourceMap.graphs.flatMap((graph) =>
    graph.entries.map((entry) => ({
      project: sourceMap.project ?? "",
      scene_id: sourceMap.scene_id ?? "",
      instance_id: "",
      graph_sha256: graph.graph_sha256,
      node_id: entry.node_id,
      semantic_stage: entry.semantic_stage,
      revision: sourceMap.generated_source_sha256,
      status: entry.status,
      generated_locations: entry.generated_locations,
      unsupported_reason: entry.unsupported_reason,
    })),
  );
}

/**
 * `instanceId` (v2): devolve só os trechos emitidos para essa instância, mesmo quando
 * outra instância tem um grafo idêntico. Sem instância, ou em mapas v1, vale a visão
 * agregada por hash do grafo.
 */
export async function resolveBuildProvenanceForGraph(
  sourceMap: BuildSourceMap | null | undefined,
  serializedGraph: string | null | undefined,
  instanceId?: string | null,
): Promise<BuildProvenanceResolution> {
  if (!sourceMap) {
    return {
      status: "missing",
      reason: "Nenhum source map de build foi produzido nesta sessão.",
    };
  }
  if (
    sourceMap.schema_version !== BUILD_SOURCE_MAP_SCHEMA_VERSION
    && sourceMap.schema_version !== BUILD_SOURCE_MAP_LEGACY_SCHEMA_VERSION
  ) {
    return {
      status: "incompatible",
      reason: `Versão de source map incompatível: ${sourceMap.schema_version}.`,
    };
  }
  if (!serializedGraph) {
    return {
      status: "missing",
      reason: "A entidade selecionada não possui NodeGraph serializado.",
    };
  }

  let graphVersion: number;
  try {
    const parsed = JSON.parse(serializedGraph) as { version?: unknown };
    graphVersion = typeof parsed.version === "number" ? parsed.version : 1;
  } catch {
    return {
      status: "incompatible",
      reason: "O NodeGraph atual não é JSON válido.",
    };
  }

  const graphSha256 = await sha256Text(serializedGraph);
  const graph = sourceMap.graphs.find(
    (candidate) => candidate.graph_sha256 === graphSha256,
  );
  if (!graph) {
    return {
      status: "incompatible",
      reason: "A revisão/hash do NodeGraph mudou desde o último build.",
    };
  }
  if (graph.graph_version !== graphVersion) {
    return {
      status: "incompatible",
      reason: `Versão do NodeGraph incompatível: build=${graph.graph_version}, atual=${graphVersion}.`,
    };
  }

  const instanceBindings = instanceId
    ? (sourceMap.bindings ?? []).filter(
        (binding) => binding.instance_id === instanceId && binding.graph_sha256 === graphSha256,
      )
    : [];
  if (instanceBindings.length > 0) {
    return {
      status: "observed",
      graph: {
        graph_version: graph.graph_version,
        graph_sha256: graphSha256,
        entries: instanceBindings.map((binding) => ({
          node_id: binding.node_id,
          semantic_stage: binding.semantic_stage,
          status: binding.status,
          generated_locations: binding.generated_locations,
          unsupported_reason: binding.unsupported_reason,
        })),
      },
    };
  }

  return { status: "observed", graph };
}
