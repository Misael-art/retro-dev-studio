// Regras de destino do texto de interface (Experimental). Espelham `compiler/hud_runtime.rs`
// para avisar durante a edição; o build continua sendo a validação final.
import type { HudTextComponent, Scene } from "./ipc/sceneService";

export const MD_TEXT_COLUMNS = 40;
export const MD_TEXT_ROWS = 28;

export function hudWidth(hud: HudTextComponent): number {
  return [...hud.label].length + (hud.value ? hud.digits ?? 3 : 0);
}

/** Problemas que impedem o build no Mega Drive (vazio = cabe e usa a fonte do destino). */
export function hudProblems(hud: HudTextComponent, scene: Pick<Scene, "entities"> | null): string[] {
  const out: string[] = [];
  const bad = [...hud.label].find((c) => c < " " || c > "~");
  if (bad) out.push(`"${bad}" não existe na fonte padrão do Mega Drive (use letras sem acento, números e símbolos ASCII).`);
  const digits = hud.digits ?? 3;
  if (hud.value && (digits < 1 || digits > 5)) out.push("Use de 1 a 5 dígitos para o valor.");
  if (!Number.isInteger(hud.column) || !Number.isInteger(hud.row) || hud.column < 0 || hud.row < 0) {
    out.push("Coluna e linha são inteiros a partir de 0.");
  } else if (hud.row >= MD_TEXT_ROWS || hud.column + hudWidth(hud) > MD_TEXT_COLUMNS) {
    out.push(`O texto sai da tela: ${hudWidth(hud)} caracteres a partir da coluna ${hud.column}, linha ${hud.row} (grade ${MD_TEXT_COLUMNS}×${MD_TEXT_ROWS}).`);
  }
  if (hud.value?.kind === "strike_hp" && !strikeIds(scene).includes(hud.value.source)) {
    out.push(`O golpe '${hud.value.source}' não existe nos comportamentos da cena.`);
  }
  return out;
}

/** Ids dos nós `authored_strike` presentes nos grafos inline da cena. */
export function strikeIds(scene: Pick<Scene, "entities"> | null): string[] {
  const out: string[] = [];
  for (const entity of scene?.entities ?? []) {
    const raw = entity.components.logic?.graph;
    if (!raw) continue;
    try {
      const graph = JSON.parse(raw) as { nodes?: Array<{ id: string; type: string }> };
      for (const node of graph.nodes ?? []) if (node.type === "authored_strike") out.push(node.id);
    } catch {
      // grafo ilegível: o validador do NodeGraph já reporta
    }
  }
  return out;
}

/**
 * Política de composição do texto de interface (espelha `compiler/hud_runtime.rs`):
 * com câmera de mundo, o texto vai para o plano fixo WINDOW nas linhas que ele ocupa — do topo
 * até a última linha usada, ou da primeira linha usada até a base. Nessa faixa o plano A fica
 * coberto; o plano B (primeiro tilemap) e os sprites continuam visíveis por trás das letras.
 * Sem câmera, o texto fica no plano A, sem faixa reservada. HUD nas duas metades bloqueia o build.
 */
export interface HudBand {
  cameraWorld: boolean;
  plane: "WINDOW" | "A";
  rows: [number, number] | null;
  split: boolean;
  /** Tilemap no plano A (segundo tilemap da cena) coberto pela faixa. */
  coveredPlaneA: string | null;
}

export function hudBand(scene: Pick<Scene, "entities"> | null): HudBand | null {
  const entities = scene?.entities ?? [];
  const rows = entities
    .map((e) => e.components.hud)
    .filter((h): h is HudTextComponent => !!h && hudProblems(h, null).filter((p) => !p.includes("golpe")).length === 0)
    .map((h) => h.row);
  if (rows.length === 0) return null;
  const cameraWorld = entities.some((e) => !!e.components.camera?.follow_entity);
  if (!cameraWorld) return { cameraWorld, plane: "A", rows: null, split: false, coveredPlaneA: null };
  const half = MD_TEXT_ROWS / 2;
  const min = Math.min(...rows);
  const max = Math.max(...rows);
  const split = min < half && max >= half;
  const band: [number, number] | null = split ? null : max < half ? [0, max] : [min, MD_TEXT_ROWS - 1];
  const tilemaps = entities.filter((e) => e.components.tilemap);
  return { cameraWorld, plane: "WINDOW", rows: band, split, coveredPlaneA: band && tilemaps[1] ? tilemaps[1].entity_id : null };
}
