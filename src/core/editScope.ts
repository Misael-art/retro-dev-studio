// Escopo de edição (Experimental, REQ-04): uma entidade da cena pode ser instância de um modelo
// (prefab). Componentes nulos na cena-fonte são herdados do modelo; componentes presentes são
// exceções locais desta instância. Animações MUGEN são do modelo do personagem (asset) — ver
// `CharacterTimelinePanel`.
import type { Entity, Scene } from "./ipc/sceneService";

export type EditScope =
  | { kind: "scene"; label: string }
  | {
      kind: "instance";
      label: string;
      model: string;
      uses: number;
      /** Componentes com exceção local nesta instância. */
      overridden: string[];
      /** Componentes vindos do modelo. */
      inherited: string[];
    };

const COMPONENT_KEYS = ["sprite", "collision", "input", "physics", "audio", "logic", "camera", "tilemap"] as const;

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function describeEditScope(
  source: Pick<Scene, "entities"> | null,
  resolved: Pick<Scene, "entities"> | null,
  entityId: string
): EditScope | null {
  const sourceEntity = source?.entities.find((e) => e.entity_id === entityId);
  const resolvedEntity = resolved?.entities.find((e) => e.entity_id === entityId);
  if (!sourceEntity || !resolvedEntity) return null;
  if (!sourceEntity.prefab) {
    return { kind: "scene", label: "Nesta cena" };
  }
  const model = sourceEntity.prefab;
  const uses = (source?.entities ?? []).filter((e) => e.prefab === model).length;
  const src = (sourceEntity.components ?? {}) as Record<string, unknown>;
  const res = (resolvedEntity.components ?? {}) as Record<string, unknown>;
  const overridden = COMPONENT_KEYS.filter((key) => present(src[key]));
  const inherited = COMPONENT_KEYS.filter((key) => !present(src[key]) && present(res[key]));
  return {
    kind: "instance",
    label: overridden.length > 0 ? "Nesta instância (com exceções locais)" : "Nesta instância",
    model,
    uses,
    overridden: [...overridden],
    inherited: [...inherited],
  };
}

/**
 * Patch que remove a exceção local de UM componente: a instância volta a herdar do modelo.
 * Retorna null se o componente não for exceção local.
 */
export function revertOverridePatch(sourceEntity: Entity, component: string): Partial<Entity> | null {
  const components = (sourceEntity.components ?? {}) as Record<string, unknown>;
  if (!sourceEntity.prefab || !present(components[component])) return null;
  return { components: { [component]: null } as unknown as Entity["components"] };
}
