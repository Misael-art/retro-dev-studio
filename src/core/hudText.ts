// Regras de destino do texto de interface (Experimental). Espelham `compiler/hud_runtime.rs`
// para avisar durante a edição; o build continua sendo a validação final.
import type { HudTextComponent, Scene } from "./ipc/sceneService";

export const MD_TEXT_COLUMNS = 40;
export const MD_TEXT_ROWS = 28;

export function hudMaxValue(hud: HudTextComponent, scene: Pick<Scene, "entities"> | null): number | null {
  if (!hud.value) return null;
  return hud.value.kind === "strike_hp" ? strikeHealth(scene).get(hud.value.source) ?? null : 65535;
}

export function hudWidth(hud: HudTextComponent, scene: Pick<Scene, "entities"> | null = null): number {
  if (!hud.value) return [...hud.label].length;
  const maximum = hudMaxValue(hud, scene);
  return [...hud.label].length + (hud.bar_tiles ?? Math.max(hud.digits ?? 3, maximum?.toString().length ?? 1));
}

export function hudSampleText(hud: HudTextComponent, value: number, maximum: number): string {
  if (!hud.value) return hud.label;
  const tiles = hud.bar_tiles;
  if (!tiles || !Number.isInteger(tiles) || tiles < 1 || tiles > 16) return hud.label + String(value).padStart(hud.digits ?? 3, "0");
  const filled = Math.min(tiles, Math.max(0, Math.floor(value * tiles / Math.max(1, maximum))));
  return hud.label + "#".repeat(filled) + "-".repeat(tiles - filled);
}

/** Problemas que impedem o build no Mega Drive (vazio = cabe e usa a fonte do destino). */
export function hudProblems(hud: HudTextComponent, scene: Pick<Scene, "entities"> | null): string[] {
  const out: string[] = [];
  const bad = [...hud.label].find((c) => c < " " || c > "~");
  if (bad) out.push(`"${bad}" não existe na fonte padrão do Mega Drive (use letras sem acento, números e símbolos ASCII).`);
  const digits = hud.digits ?? 3;
  if (hud.value && (!Number.isInteger(digits) || digits < 1 || digits > 5)) out.push("Use de 1 a 5 dígitos para o valor.");
  if (hud.bar_tiles != null && (hud.value?.kind !== "strike_hp" || !Number.isInteger(hud.bar_tiles) || hud.bar_tiles < 1 || hud.bar_tiles > 16)) {
    out.push("A barra usa de 1 a 16 blocos e precisa do vínculo à vida de um golpe.");
  }
  if (!Number.isInteger(hud.column) || !Number.isInteger(hud.row) || hud.column < 0 || hud.row < 0) {
    out.push("Coluna e linha são inteiros a partir de 0.");
  } else if (hud.row >= MD_TEXT_ROWS || hud.column + hudWidth(hud, scene) > MD_TEXT_COLUMNS) {
    out.push(`O texto sai da tela: ${hudWidth(hud, scene)} caracteres a partir da coluna ${hud.column}, linha ${hud.row} (grade ${MD_TEXT_COLUMNS}×${MD_TEXT_ROWS}).`);
  }
  if (hud.value?.kind === "strike_hp" && !strikeIds(scene).includes(hud.value.source)) {
    out.push(`O golpe '${hud.value.source}' não existe nos comportamentos da cena.`);
  }
  return out;
}

/** Ids dos nós `authored_strike` presentes nos grafos inline da cena. */
export function strikeIds(scene: Pick<Scene, "entities"> | null): string[] {
  return [...strikeHealth(scene).keys()];
}

function strikeHealth(scene: Pick<Scene, "entities"> | null): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const entity of scene?.entities ?? []) {
    const raw = entity.components.logic?.graph;
    if (!raw) continue;
    try {
      const graph = JSON.parse(raw) as { nodes?: Array<{ id: string; type: string; params?: { health?: number } }> };
      for (const node of graph.nodes ?? []) {
        if (node.type !== "authored_strike") continue;
        const health = node.params?.health ?? 0;
        out.set(node.id, Number.isInteger(health) && health >= 1 && health <= 9999 ? health : null);
      }
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
    .filter((h): h is HudTextComponent => !!h && hudProblems(h, scene).every((problem) => problem.startsWith("O golpe '")))
    .map((h) => h.row);
  if (rows.length === 0) return null;
  const cameraWorld = entities.some((e) => e.components.camera?.visual?.active || e.components.camera?.follow_entity);
  if (!cameraWorld) return { cameraWorld, plane: "A", rows: null, split: false, coveredPlaneA: null };
  const half = MD_TEXT_ROWS / 2;
  const min = Math.min(...rows);
  const max = Math.max(...rows);
  const split = min < half && max >= half;
  const band: [number, number] | null = split ? null : max < half ? [0, max] : [min, MD_TEXT_ROWS - 1];
  const tilemaps = entities.filter((e) => e.components.tilemap);
  return { cameraWorld, plane: "WINDOW", rows: band, split, coveredPlaneA: band && tilemaps[1] ? tilemaps[1].entity_id : null };
}
