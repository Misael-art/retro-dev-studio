import type { NodeGraph } from "./nodeTypes";

/**
 * Ponte entre o canvas e a ROM para QUALQUER perfil REX em dado.
 * O grafo gerado pelo núcleo traz, no nó de entrada, a IDENTIDADE (ROM, perfil, instância) e, em cada nó
 * editável, o valor original, o domínio aceito e os offsets de ROM. Editar o valor no canvas NÃO altera a
 * ROM: esta ponte só lê as diferenças e as devolve como um plano que o núcleo revalida contra a ROM.
 * Nada aqui conhece um perfil: nomes de campo, id e chave da instância vêm do próprio grafo.
 */

/**
 * Compatibilidade: grafos gravados antes de o nó de entrada dizer qual é a chave da instância
 * (`instancia_param`) usavam esta. Só é lida quando `instancia_param` falta.
 */
const LEGACY_INSTANCE_PARAM = "jump_offset";

/**
 * Parâmetros do nó de entrada que são vínculo de sessão, não estrutura (mesma lista do núcleo:
 * `rex_profile_graph::BINDING_PARAMS`). A identidade que carregam é conferida pelo núcleo ao gerar.
 */
const BINDING_PARAMS = ["rom_path", "assinatura_estrutural", "perfil_sha256", "perfil_revisao", "perfil_dir", "instancia_param"];

export interface BridgeInfo {
  perfil: string;
  /** SHA-256 do arquivo do perfil que gerou o grafo ("" em grafos anteriores ao vínculo por hash). */
  perfilSha256: string;
  perfilRevisao: number | null;
  romSha256: string;
  instanceOffset: number;
  /** Assinatura estrutural canônica gravada pelo núcleo ao gerar o grafo. */
  assinatura: string;
  /** Caminho da ROM guardado ao abrir como nodes (pode faltar). */
  romPath: string;
  /** Pasta de perfis autorais guardada ao abrir como nodes (pode faltar). */
  perfilDir: string;
}

export interface GraphEdit {
  campo: string;
  label: string;
  de: number;
  para: number;
}

export interface GraphProblem {
  campo: string;
  label: string;
  motivo: string;
}

export interface GraphEdits {
  changes: Record<string, number>;
  edits: GraphEdit[];
  problems: GraphProblem[];
}

/** Nome do parâmetro que guarda o valor editável de um nó (`campo_param`; por omissão `value`). Mesma regra do núcleo. */
export function valueParam(node: { params: Record<string, unknown> }): string {
  return typeof node.params.campo_param === "string" && node.params.campo_param !== "" ? node.params.campo_param : "value";
}

function asInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function bridgeInfo(graph: NodeGraph): BridgeInfo | null {
  const ev = graph.nodes.find((n) => n.params.ponte_edicao === 1 && typeof n.params.perfil === "string" && n.params.perfil !== "");
  if (!ev) return null;
  const sha = String(ev.params.rom_sha256 ?? "");
  const param = typeof ev.params.instancia_param === "string" ? ev.params.instancia_param : LEGACY_INSTANCE_PARAM;
  const off = asInt(ev.params[param]);
  if (!/^[0-9a-f]{64}$/.test(sha) || off === null || off < 0) return null;
  return {
    perfil: String(ev.params.perfil),
    perfilSha256: typeof ev.params.perfil_sha256 === "string" ? ev.params.perfil_sha256 : "",
    perfilRevisao: asInt(ev.params.perfil_revisao),
    romSha256: sha,
    instanceOffset: off,
    assinatura: String(ev.params.assinatura_estrutural ?? ""),
    romPath: String(ev.params.rom_path ?? ""),
    perfilDir: String(ev.params.perfil_dir ?? ""),
  };
}

/**
 * Diferenças entre os valores atuais dos nós e os originais da ROM, com o domínio validado.
 * Dois nós editáveis para o MESMO campo são ambiguidade: nenhum dos dois entra no plano (nada de "o último vence").
 */
export function editsFromGraph(graph: NodeGraph): GraphEdits {
  const out: GraphEdits = { changes: {}, edits: [], problems: [] };
  const porCampo = new Map<string, typeof graph.nodes>();
  for (const node of graph.nodes) {
    if (node.params.editavel !== 1) continue;
    if (typeof node.params.campo !== "string" || node.params.campo === "") continue;
    porCampo.set(node.params.campo, [...(porCampo.get(node.params.campo) ?? []), node]);
  }
  for (const [campo, nodes] of porCampo) {
    if (nodes.length > 1) {
      out.problems.push({
        campo,
        label: nodes.map((n) => n.label).join(" / "),
        motivo: `campo duplicado em ${nodes.length} nós (${nodes.map((n) => n.id).join(", ")}): remova o excedente; nenhum valor é aplicado`,
      });
      continue;
    }
    const node = nodes[0];
    const label = node.label;
    const atual = asInt(node.params[valueParam(node)]);
    const original = asInt(node.params.valor_original);
    const faixa = /^(-?\d+)\.\.(-?\d+)$/.exec(String(node.params.faixa ?? ""));
    if (original === null || !faixa) {
      out.problems.push({ campo, label, motivo: "nó sem valor original ou faixa: reabra o grafo a partir da ROM" });
      continue;
    }
    if (atual === null) {
      out.problems.push({ campo, label, motivo: "o valor precisa ser um inteiro" });
      continue;
    }
    const [min, max] = [Number(faixa[1]), Number(faixa[2])];
    if (node.params.allowed_widths !== undefined && !String(node.params.allowed_widths).split(",").map(Number).includes(atual)) {
      out.problems.push({ campo, label, motivo: `largura fora do domínio declarado: ${String(node.params.allowed_widths)}` });
      continue;
    }
    if (atual < min || atual > max) {
      out.problems.push({ campo, label, motivo: `fora do domínio aceito pelo perfil ${min}..${max}` });
      continue;
    }
    if (atual !== original) {
      out.changes[campo] = atual;
      out.edits.push({ campo, label, de: original, para: atual });
    }
  }
  return out;
}

// --------------------------------------------------------------------------- estrutura canônica

type Node = NodeGraph["nodes"][number];

function fnv1a64Hex(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function portsCanon(ports: { id: string; kind: string; dataType?: string }[]): string {
  return ports.map((p) => `${p.id}:${p.kind}:${p.dataType ?? ""}`).join(",");
}

function nodeCanon(n: Node): string {
  const editavel = n.params.editavel === 1;
  const isEv = n.params.ponte_edicao === 1;
  const kv = Object.entries(n.params)
    .filter(([k]) => !(editavel && k === valueParam(n)) && !(isEv && BINDING_PARAMS.includes(k)))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .sort();
  return `N|${n.id}|${n.type}|in:${portsCanon(n.inputs)}|out:${portsCanon(n.outputs)}|${kv.join(";")}`;
}

/** Mesma regra do núcleo: exclui valores editáveis, posições, rótulos, `pinned`, ids de aresta e o vínculo de sessão. */
export function canonicalString(graph: NodeGraph): string {
  const nodes = graph.nodes.map(nodeCanon).sort();
  const edges = graph.edges.map((e) => `E|${e.fromNode}.${e.fromPort}>${e.toNode}.${e.toPort}`).sort();
  return [...nodes, ...edges].join("\n");
}

export function canonicalSignature(graph: NodeGraph): string {
  return fnv1a64Hex(canonicalString(graph));
}

export interface GraphStructure {
  /** A estrutura (topologia, tipos, portas, origem) é a canônica gerada pelo núcleo. */
  canonical: boolean;
  motivo: string;
}

/**
 * Detecção LOCAL (para a interface) de mudança de lógica: remover/trocar nós, mexer em conexões, origem
 * ou campo. Não é a autoridade: ao gerar, o núcleo revisa o grafo contra o canônico reconstruído da ROM.
 * Enquanto a topologia não for compilável para a ROM, um grafo não canônico NÃO é lógica aplicada à ROM.
 */
export function graphStructure(graph: NodeGraph): GraphStructure {
  const info = bridgeInfo(graph);
  if (!info) return { canonical: false, motivo: "grafo sem a identidade da ponte" };
  if (!info.assinatura) return { canonical: false, motivo: "grafo sem assinatura estrutural: reabra a partir da ROM" };
  if (canonicalSignature(graph) !== info.assinatura) {
    return { canonical: false, motivo: "a estrutura do grafo (nós, conexões, origem ou campos) difere da gerada a partir da ROM" };
  }
  return { canonical: true, motivo: "" };
}

// --------------------------------------------------------------------------- resultado x contexto atual

export interface ResultKey {
  /** Identidade do contexto: SHA-256 da ROM (e, quando houver, perfil e seu hash) da localização/grafo. */
  identity: string;
  /** Offset da instância. */
  instance: number;
  /** Valores pedidos (campo→valor) em forma estável. */
  values: string;
}

/** Identidade de contexto: a ROM e o perfil (id + hash) que reconheceu. Perfil trocado = outro contexto. */
export function contextIdentity(romSha256: string, profileId: string, profileSha256: string): string {
  return `${romSha256}|${profileId}|${profileSha256}`;
}

export function valuesKey(changes: object): string {
  return JSON.stringify(
    Object.entries(changes as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

export type ResultRelation = "atual" | "valores-anteriores" | "outro-contexto";

/**
 * Relação de um resultado (resposta assíncrona) com o contexto ATUAL: de outra ROM/perfil/instância não
 * pode aparecer; com o mesmo contexto mas valores diferentes é a cópia dos valores ANTERIORES.
 */
export function relateResult(result: ResultKey, current: ResultKey): ResultRelation {
  if (result.identity !== current.identity || result.instance !== current.instance) return "outro-contexto";
  return result.values === current.values ? "atual" : "valores-anteriores";
}

/** Grava o caminho da ROM (e a pasta de perfis, se houver) no nó de entrada do grafo ao abri-lo como nodes. */
export function withRomPath(graphJson: string, romPath: string, profilesDir = ""): string {
  const g = JSON.parse(graphJson) as { nodes: { params: Record<string, unknown> }[] };
  const ev = g.nodes.find((n) => n.params.ponte_edicao === 1);
  if (ev) {
    ev.params.rom_path = romPath;
    if (profilesDir) ev.params.perfil_dir = profilesDir;
  }
  return JSON.stringify(g);
}

/** A bound, entirely recovered region is a ROM description, not an author event graph.
 * Structural changes still fail graphStructure/backend validation. Mixed/author graphs
 * never receive this diagnostic exemption, even if they copy binding parameters.
 */
export function isRecoveredRegionGraph(graph: NodeGraph): boolean {
  const info = bridgeInfo(graph);
  return info !== null && /^[0-9a-f]{64}$/.test(info.perfilSha256)
    && graph.nodes.filter(n => n.type === "rom_region_entry").length === 1
    && graph.nodes.some(n => n.type === "rom_region_exit")
    && graph.nodes.every(n => n.type.startsWith("rom_") && n.params.semantic_origin === "recovered_from_rom");
}
