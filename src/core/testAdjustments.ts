// Ajustes de teste (Experimental, REQ-20): valores mudados durante o teste vivem só na sessão do
// emulador (RAM) e numa lista separada. Nada vai para o projeto sem "Aplicar ao projeto", que mostra
// um diff selecionável de campos autorais permitidos e aplica tudo numa transação desfeita junta.
import type { Scene } from "./ipc/sceneService";

/** Campos autorais que um ajuste de teste pode propor ao projeto. */
export type AdjustableField = "transform.x" | "transform.y";

export interface TestAdjustment {
  entityId: string;
  field: AdjustableField;
  /** Valor no projeto quando o ajuste foi feito. */
  projectValue: number;
  /** Valor aplicado na execução (RAM). */
  testValue: number;
  /** Época do core em que foi feito; outra carga invalida o ajuste. */
  epoch: number;
}

export function upsertAdjustment(list: TestAdjustment[], next: TestAdjustment): TestAdjustment[] {
  const rest = list.filter((a) => !(a.entityId === next.entityId && a.field === next.field));
  return next.testValue === next.projectValue ? rest : [...rest, next];
}

/** Ajustes ainda válidos para a época atual. */
export function liveAdjustments(list: TestAdjustment[], epoch: number | null): TestAdjustment[] {
  return epoch === null ? [] : list.filter((a) => a.epoch === epoch);
}

export interface AdjustmentDiffRow {
  key: string;
  adjustment: TestAdjustment;
  /** Valor atual no projeto (pode ter mudado depois do ajuste). */
  currentProjectValue: number | null;
  conflict: boolean;
}

export function adjustmentDiff(list: TestAdjustment[], scene: Pick<Scene, "entities"> | null): AdjustmentDiffRow[] {
  return list.map((adjustment) => {
    const entity = scene?.entities.find((e) => e.entity_id === adjustment.entityId);
    const current = entity ? (adjustment.field === "transform.x" ? entity.transform.x : entity.transform.y) : null;
    return {
      key: `${adjustment.entityId}:${adjustment.field}`,
      adjustment,
      currentProjectValue: current,
      conflict: current === null || current !== adjustment.projectValue,
    };
  });
}

/** Patches por entidade para os ajustes escolhidos (sem conflito). */
export function patchesFor(rows: AdjustmentDiffRow[], chosen: Set<string>, scene: Pick<Scene, "entities"> | null) {
  const byEntity = new Map<string, { x: number; y: number }>();
  for (const row of rows) {
    if (!chosen.has(row.key) || row.conflict) continue;
    const entity = scene?.entities.find((e) => e.entity_id === row.adjustment.entityId);
    if (!entity) continue;
    const current = byEntity.get(entity.entity_id) ?? { ...entity.transform };
    if (row.adjustment.field === "transform.x") current.x = row.adjustment.testValue;
    else current.y = row.adjustment.testValue;
    byEntity.set(entity.entity_id, current);
  }
  return [...byEntity.entries()].map(([entityId, transform]) => ({ entityId, transform }));
}
