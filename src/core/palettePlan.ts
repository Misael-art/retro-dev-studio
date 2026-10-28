// Plano de paletas da cena (Experimental). O plano vem do MESMO planejador do build
// (`compiler/palette_plan.rs`, IPC `scene_palette_plan`); aqui ficam só os tipos e as ações
// que reescrevem `scene.palettes` (recursos com `id`). Toda ação é uma transação de desfazer.
// "Em uso" não é "indisponível": a decisão de compatibilidade é do planejador, mostrada antes.
import { invoke } from "@tauri-apps/api/core";

import type { PaletteEntry, Scene } from "./ipc/sceneService";

export interface PlanUse {
  entity_id: string;
  role: "sprite" | "tilemap" | "font";
  asset?: string;
  indices: number[];
}

export interface PlanResource {
  id: string;
  name: string;
  origin: string;
  colors: string[];
  used_indices: number[];
  uses: PlanUse[];
  references: number;
  simultaneous_uses: number;
  pinned_bank?: number;
  bank?: number;
  state: "residente" | "programada" | "conflito" | "sem_banco" | "sem_uso";
  quantized_pixels: number;
  source_colors: number;
  evidence: string;
}

export interface PlanBank {
  bank: number;
  resources: string[];
  colors: string[];
  target_values: number[];
  state: "livre" | "em_uso" | "compartilhada" | "reservada" | "conflito";
}

export interface PlanSwap {
  id: string;
  trigger: string;
  target_entity: string;
  palette: string;
  frames: number;
  scope: "instancia" | "grupo";
  bank?: number;
  written_indices: number[];
  affected_uses: string[];
  ok: boolean;
}

export interface PlanDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  uses: string[];
  resources: string[];
  actions: string[];
}

export interface PalettePlan {
  schema: string;
  scene_id: string;
  target: string;
  capacity: { banks: number; colors_per_bank: number };
  resources: PlanResource[];
  banks: PlanBank[];
  swaps: PlanSwap[];
  diagnostics: PlanDiagnostic[];
  entity_banks: Record<string, number>;
  text_bank?: number;
  evidence: Record<string, string>;
}

export function fetchPalettePlan(projectDir: string, scene: Scene): Promise<PalettePlan> {
  return invoke<PalettePlan>("scene_palette_plan", { projectDir, scene });
}

export const BANK_STATE_LABEL: Record<PlanBank["state"], string> = {
  livre: "Livre",
  em_uso: "Em uso",
  compartilhada: "Compartilhada",
  reservada: "Reservada",
  conflito: "Em conflito",
};

export const RESOURCE_STATE_LABEL: Record<PlanResource["state"], string> = {
  residente: "Residente",
  programada: "Programada (troca por evento)",
  conflito: "Em conflito",
  sem_banco: "Sem banco",
  sem_uso: "Sem uso nesta cena",
};

export function resourceOf(plan: PalettePlan, entityId: string): PlanResource | undefined {
  return plan.resources.find((r) => r.uses.some((u) => u.entity_id === entityId));
}

export function errorCount(plan: PalettePlan | null): number {
  return plan ? plan.diagnostics.filter((d) => d.severity === "error").length : 0;
}

function clone(palettes: PaletteEntry[] | undefined): PaletteEntry[] {
  return structuredClone(palettes ?? []);
}

/** Entrada explícita do recurso; cria a partir do plano (cores atuais) quando ainda é implícito. */
function materialize(list: PaletteEntry[], resource: PlanResource): PaletteEntry {
  let entry = list.find((p) => p.id === resource.id);
  if (!entry) {
    entry = { slot: 0, id: resource.id, name: resource.name, colors: [...resource.colors] };
    list.push(entry);
  }
  return entry;
}

/** Editar a paleta compartilhada: muda a cor de um índice para TODOS os usos do recurso. */
export function editSharedColor(palettes: PaletteEntry[] | undefined, resource: PlanResource, index: number, color: string): PaletteEntry[] {
  const list = clone(palettes);
  const entry = materialize(list, resource);
  const colors = [...entry.colors];
  while (colors.length < 16) colors.push("");
  colors[index] = color.toUpperCase();
  entry.colors = colors;
  if (!entry.origin && resource.origin === "asset") entry.origin = "asset_editado";
  return list;
}

/** Variante local: cópia das cores atuais, só para esta entidade; o original fica intacto. */
export function createLocalVariant(palettes: PaletteEntry[] | undefined, resource: PlanResource, entityId: string, name?: string): PaletteEntry[] {
  const list = releaseUse(palettes, entityId);
  let id = `variante:${entityId}`;
  for (let n = 2; list.some((p) => p.id === id); n += 1) id = `variante:${entityId}_${n}`;
  list.push({ slot: 0, id, name: name ?? `${resource.name} (variante de ${entityId})`, origin: "variante", colors: [...resource.colors], uses: [entityId] });
  return list;
}

/** Liberar um uso: a entidade volta à paleta do próprio arquivo. A variante fica na biblioteca. */
export function releaseUse(palettes: PaletteEntry[] | undefined, entityId: string): PaletteEntry[] {
  const list = clone(palettes);
  for (const entry of list) if (entry.uses?.includes(entityId)) entry.uses = entry.uses.filter((u) => u !== entityId);
  return list;
}

/** Trocar a paleta do objeto para outro recurso existente (explícito). */
export function assignResource(palettes: PaletteEntry[] | undefined, plan: PalettePlan, entityId: string, resourceId: string): PaletteEntry[] {
  const list = releaseUse(palettes, entityId);
  const target = plan.resources.find((r) => r.id === resourceId);
  if (!target) return list;
  if (resourceId.startsWith("asset:") || resourceId === "fonte:padrao") {
    // Voltar ao recurso do próprio arquivo = só liberar; apontar para o arquivo de OUTRO uso
    // exige uma cópia explícita (o recurso implícito é do arquivo dele).
    const own = resourceOf(plan, entityId);
    if (own?.id === resourceId || target.uses.some((u) => u.entity_id === entityId)) return list;
  }
  const entry = materialize(list, target);
  entry.uses = [...(entry.uses ?? []), entityId];
  return list;
}

/** Fixar (reservar) o recurso num banco, ou remover a fixação. Compartilhar = fixar no banco de outro. */
export function pinBank(palettes: PaletteEntry[] | undefined, resource: PlanResource, bank: number | null): PaletteEntry[] {
  const list = clone(palettes);
  const entry = materialize(list, resource);
  if (bank === null) delete entry.bank;
  else entry.bank = bank;
  return list;
}

/** Voltar às cores do arquivo (remove a edição explícita de um recurso implícito). */
export function restoreFromFile(palettes: PaletteEntry[] | undefined, resourceId: string): PaletteEntry[] {
  return clone(palettes).filter((p) => p.id !== resourceId);
}

/** Paleta autoral nova (ex.: "Dano"), com as mesmas posições usadas pelo recurso de referência. */
export function createAuthoredPalette(palettes: PaletteEntry[] | undefined, reference: PlanResource, name: string, color: string): { palettes: PaletteEntry[]; id: string } {
  const list = clone(palettes);
  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "paleta";
  let id = base;
  for (let n = 2; list.some((p) => p.id === id); n += 1) id = `${base}_${n}`;
  const colors = Array.from({ length: 16 }, (_, i) => (reference.used_indices.includes(i) ? color.toUpperCase() : ""));
  list.push({ slot: 0, id, name, origin: "autoral", colors });
  return { palettes: list, id };
}

/** Diagnósticos novos (erros que não existiam antes da ação proposta). */
export function newErrors(before: PalettePlan | null, after: PalettePlan): PlanDiagnostic[] {
  const seen = new Set((before?.diagnostics ?? []).filter((d) => d.severity === "error").map((d) => `${d.code}|${d.message}`));
  return after.diagnostics.filter((d) => d.severity === "error" && !seen.has(`${d.code}|${d.message}`));
}

/** Usos afetados por mudar cores do recurso (todos os que leem o recurso e os demais do mesmo banco nos mesmos índices). */
export function affectedBy(plan: PalettePlan, resource: PlanResource, index: number): string[] {
  const out = new Set(resource.uses.map((u) => u.entity_id));
  if (resource.bank !== undefined) {
    for (const r of plan.resources) {
      if (r.bank === resource.bank) for (const u of r.uses) if (u.indices.includes(index)) out.add(u.entity_id);
    }
  }
  return [...out];
}

/** Letra do banco no mapa de paletas (banco 0 = A … banco 3 = D). */
export function bankLetter(bank: number): string {
  return String.fromCharCode(65 + bank);
}

/** Slots ocupados de um banco (índice 0 é transparente e não conta). */
export function bankSlotsUsed(bank: PlanBank, colorsPerBank = 16): number {
  return bank.colors.slice(1, colorsPerBank).filter((c) => Boolean(c)).length;
}

export interface EntityPaletteMark {
  bank?: number;
  ok: boolean;
  reason: string;
}

/** Banco e validação de cada objeto da cena, do mesmo plano do build. */
export function entityPaletteMarks(plan: PalettePlan): Map<string, EntityPaletteMark> {
  const marks = new Map<string, EntityPaletteMark>();
  for (const resource of plan.resources) {
    for (const use of resource.uses) {
      const bank = plan.entity_banks[use.entity_id] ?? resource.bank;
      const problem = plan.diagnostics.find((d) => d.severity === "error" && (d.uses.includes(use.entity_id) || d.resources.includes(resource.id)));
      const ok = bank !== undefined && !problem && resource.state !== "conflito" && resource.state !== "sem_banco";
      marks.set(use.entity_id, {
        bank,
        ok,
        reason: problem?.message ?? (bank === undefined ? "sem banco de paleta" : `${resource.name} no banco ${bankLetter(bank)} sem conflito`),
      });
    }
  }
  return marks;
}
