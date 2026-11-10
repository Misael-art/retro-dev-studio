/**
 * Contratos do editor de código C/SGDK (Experimental): `CodeDocument`, `CodeBinding` e
 * `CodeEditTransaction`, espelhando `src-tauri/src/compiler/code_binding.rs`.
 *
 * Em projetos autorais o documento é uma projeção editável do modelo canônico
 * (cena + grafos). Este módulo é puro: localiza vínculos, monta transações, decide se
 * um recibo ainda pertence ao contexto vivo e planeja a aplicação no modelo. Quem
 * aplica é o owner existente (`editorStore`), em `codeEditApply.ts`.
 */
import type { CodeBinding, GeneratedSourceLocation } from "./nodegraph/buildProvenance";
import type { Entity, LogicComponent, Scene } from "./ipc/sceneService";

export type { CodeBinding };

export const CODE_DOCUMENT_SCHEMA = "rds-code-document/v1" as const;
export const CODE_EDIT_SCHEMA = "rds-code-edit/v1" as const;

/** Identidade de um documento: respostas de outro projeto/cena/revisão são descartadas. */
export interface CodeContext {
  project: string;
  scene_id: string;
  /** SHA-256 do texto projetado. */
  revision: string;
}

export interface CodeDocument {
  schema: string;
  context: CodeContext;
  kind: "authored_projection" | string;
  /** Fonte que governa o build deste documento. */
  governs_build: "scene_model" | string;
  target: string;
  file: string;
  text: string;
  bindings: CodeBinding[];
}

/** `instance` (padrão): só a instância selecionada. `shared`: todos os usos da definição. */
export type CodeEditScope = "instance" | "shared";

export interface CodeEditTransaction {
  schema: typeof CODE_EDIT_SCHEMA;
  context: CodeContext;
  instance_id: string;
  node_id: string;
  graph_sha256: string;
  new_text: string;
  scope: CodeEditScope;
}

export type CodeEditStatus = "no_change" | "node_params" | "code_node" | "draft" | "stale" | "rejected";

export interface CodeEditReceipt {
  schema: string;
  context: CodeContext;
  status: CodeEditStatus;
  instance_id: string;
  node_id: string;
  scope: CodeEditScope;
  graph: string | null;
  changed_params: Array<{ node_id: string; key: string; value: unknown }>;
  absorbed_node_ids: string[];
  shared_uses: string[];
  message: string;
}

export function sameCodeContext(left: CodeContext, right: CodeContext): boolean {
  return left.project === right.project && left.scene_id === right.scene_id && left.revision === right.revision;
}

/** Região única de um vínculo; nodes emitidos mais de uma vez não são editáveis por região. */
export function bindingRegion(binding: CodeBinding): GeneratedSourceLocation | null {
  return binding.status === "mapped" && binding.generated_locations.length === 1
    ? binding.generated_locations[0]
    : null;
}

export function findBinding(document: CodeDocument, instanceId: string, nodeId: string): CodeBinding | null {
  return document.bindings.find((binding) => binding.instance_id === instanceId && binding.node_id === nodeId) ?? null;
}

/** Vínculo mais interno que contém a linha (base 1); `instanceId` restringe à instância. */
export function bindingAtLine(document: CodeDocument, line: number, instanceId?: string | null): CodeBinding | null {
  let best: { span: number; binding: CodeBinding } | null = null;
  for (const binding of document.bindings) {
    if (instanceId && binding.instance_id !== instanceId) continue;
    const region = bindingRegion(binding);
    if (!region || line < region.start_line || line > region.end_line) continue;
    const span = region.end_line - region.start_line;
    if (!best || span < best.span) best = { span, binding };
  }
  return best?.binding ?? null;
}

export function regionText(document: CodeDocument, binding: CodeBinding): string | null {
  const region = bindingRegion(binding);
  if (!region) return null;
  return document.text.split("\n").slice(region.start_line - 1, region.end_line).join("\n");
}

export function buildCodeEditTransaction(
  document: CodeDocument,
  binding: CodeBinding,
  newText: string,
  scope: CodeEditScope = "instance",
): CodeEditTransaction {
  return {
    schema: CODE_EDIT_SCHEMA,
    context: { ...document.context },
    instance_id: binding.instance_id,
    node_id: binding.node_id,
    graph_sha256: binding.graph_sha256,
    new_text: newText,
    scope,
  };
}

/** Contexto vivo do editor no momento em que uma resposta chega. */
export interface LiveCodeContext {
  project: string | null;
  sceneId: string | null;
  /** Revisão do documento hoje exibido. */
  documentRevision: string | null;
}

/**
 * Um recibo só vale para o documento de que partiu: outro projeto, outra cena ou outra
 * revisão (resposta atrasada) é descartado sem tocar o modelo.
 */
export function isReceiptCurrent(receipt: CodeEditReceipt, live: LiveCodeContext): boolean {
  return receipt.schema === CODE_EDIT_SCHEMA
    && receipt.context.project === live.project
    && receipt.context.scene_id === live.sceneId
    && receipt.context.revision === live.documentRevision;
}

export interface CodeEditPlan {
  /** Novo componente de lógica por entidade, na ordem de aplicação. */
  patches: Array<{ entityId: string; logic: LogicComponent }>;
  /** Instâncias afetadas além da editada (definição compartilhada). */
  affectedUses: string[];
  /** A instância foi desligada da definição compartilhada para não tocar os outros usos. */
  detached: boolean;
}

function logicWithGraph(entity: Entity, graph: string, detach: boolean): LogicComponent {
  const logic = entity.components.logic ?? {};
  if (detach) return { ...logic, graph, graph_ref: "", graph_origin: "user_edited_ref" };
  return { ...logic, graph, graph_origin: logic.graph_ref ? "user_edited_ref" : logic.graph_origin };
}

/**
 * Planeja a aplicação de um recibo no modelo, sem mutar nada.
 * - alcance `instance`: só a instância muda; se ela usa uma definição compartilhada com
 *   outros usos, passa a ter grafo próprio (inline) e os outros usos ficam intactos;
 * - alcance `shared`: a definição muda e todos os usos listados recebem o mesmo grafo.
 * Devolve `null` quando o recibo não carrega mudança de modelo ou a instância sumiu.
 */
export function planCodeEdit(receipt: CodeEditReceipt, scene: Scene): CodeEditPlan | null {
  if (!receipt.graph || !["node_params", "code_node", "draft"].includes(receipt.status)) return null;
  const graph = receipt.graph;
  const byId = new Map(scene.entities.map((entity) => [entity.entity_id, entity]));
  const target = byId.get(receipt.instance_id);
  if (!target) return null;
  const others = receipt.shared_uses.filter((id) => id !== receipt.instance_id && byId.has(id));

  if (receipt.scope === "shared" && others.length > 0) {
    return {
      patches: [receipt.instance_id, ...others].map((entityId) => ({
        entityId,
        logic: logicWithGraph(byId.get(entityId)!, graph, false),
      })),
      affectedUses: others,
      detached: false,
    };
  }
  const detached = others.length > 0;
  return {
    patches: [{ entityId: receipt.instance_id, logic: logicWithGraph(target, graph, detached) }],
    affectedUses: [],
    detached,
  };
}
