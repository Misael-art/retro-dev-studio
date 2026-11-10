// Pontos de atenção da cena: transforma o estado técnico (scanline, paletas, recursos) em
// poucos itens em linguagem simples, cada um ligado aos objetos envolvidos e a uma próxima ação.
// Puro e testável; a UI (painel "Próximos passos", Inspector, viewport) só consome o resultado.
import type { Entity, Scene } from "./ipc/sceneService";
import type { PalettePlan } from "./palettePlan";
import { resolveImportedEntityContext } from "./importedEntityContext";
import { getSceneEntityBounds } from "./sceneWorldModel";
import type { HwStatus } from "./store/editorStore";

export type AttentionSeverity = "blocker" | "warning" | "tip";

export type AttentionActionId =
  | "show_only"
  | "select_first"
  | "redistribute"
  | "open_palettes"
  | "open_assets"
  | "test_scene";

export interface AttentionItem {
  id: string;
  kind: "scanline" | "palette" | "assets" | "staging" | "ready";
  severity: AttentionSeverity;
  /** Frase curta e sem jargão. */
  title: string;
  /** Por que importa, em linguagem simples. */
  why: string;
  /** Detalhe técnico (para quem conhece o hardware) — mostrado só sob demanda. */
  technical: string;
  entityIds: string[];
  actions: AttentionActionId[];
}

export const ATTENTION_ACTION_LABEL: Record<AttentionActionId, string> = {
  show_only: "Mostrar só esses",
  select_first: "Selecionar",
  redistribute: "Sugerir redistribuição",
  open_palettes: "Resolver paletas",
  open_assets: "Ver no Asset Browser",
  test_scene: "Testar a cena",
};

/** Hardware sprites por linha que um objeto ocupa (MD: peças de até 32 px; SNES: 64 px). */
function hardwareSpritesPerLine(width: number, target: "megadrive" | "snes"): number {
  const piece = target === "snes" ? 64 : 32;
  return Math.max(1, Math.ceil(width / piece));
}

interface SpriteSpan {
  entityId: string;
  top: number;
  bottom: number;
  weight: number;
}

function spriteSpans(scene: Scene, target: "megadrive" | "snes"): SpriteSpan[] {
  return scene.entities
    .filter((entity) => entity.components?.sprite && !entity.components?.tilemap)
    .map((entity) => {
      const b = getSceneEntityBounds(entity, target, scene.entities);
      return {
        entityId: entity.entity_id,
        top: Math.floor(b.y),
        bottom: Math.floor(b.y + Math.max(1, b.height)),
        weight: hardwareSpritesPerLine(b.width, target),
      };
    });
}

function lineLoad(spans: SpriteSpan[]): Map<number, number> {
  const load = new Map<number, number>();
  for (const s of spans) {
    for (let y = s.top; y < s.bottom; y++) load.set(y, (load.get(y) ?? 0) + s.weight);
  }
  return load;
}

export interface ScanlineHotspot {
  top: number;
  bottom: number;
  peak: number;
  limit: number;
  entityIds: string[];
}

/** Faixas contíguas de linhas acima do limite, ordenadas da pior para a menor. */
export function findScanlineHotspots(
  scene: Scene,
  target: "megadrive" | "snes",
  limit: number
): ScanlineHotspot[] {
  const spans = spriteSpans(scene, target);
  const load = lineLoad(spans);
  const lines = [...load.entries()].filter(([, n]) => n > limit).map(([y]) => y).sort((a, b) => a - b);
  const bands: { top: number; bottom: number }[] = [];
  for (const y of lines) {
    const last = bands[bands.length - 1];
    if (last && y === last.bottom) last.bottom = y + 1;
    else bands.push({ top: y, bottom: y + 1 });
  }
  return bands
    .map((band) => {
      let peak = 0;
      for (let y = band.top; y < band.bottom; y++) peak = Math.max(peak, load.get(y) ?? 0);
      const entityIds = spans.filter((s) => s.top < band.bottom && s.bottom > band.top).map((s) => s.entityId);
      return { ...band, peak, limit, entityIds };
    })
    .sort((a, b) => b.peak - a.peak || a.top - b.top);
}

export interface RedistributionMove {
  entityId: string;
  fromY: number;
  toY: number;
}

/**
 * Sugestão gulosa: desloca verticalmente o menor número de objetos, pelo menor passo (8 px),
 * até nenhuma linha passar do limite. Não aplica nada; devolve `[]` se não achar solução.
 */
export function suggestScanlineRedistribution(
  scene: Scene,
  target: "megadrive" | "snes",
  limit: number,
  maxShift = 128
): RedistributionMove[] {
  const spans = spriteSpans(scene, target);
  const byId = new Map(scene.entities.map((e) => [e.entity_id, e] as const));
  const moves: RedistributionMove[] = [];
  const overLimit = () => [...lineLoad(spans).values()].some((n) => n > limit);
  let guard = spans.length;
  while (overLimit() && guard-- > 0) {
    const load = lineLoad(spans);
    const moved = new Set(moves.map((m) => m.entityId));
    const candidates = spans
      .filter((s) => !moved.has(s.entityId))
      .filter((s) => {
        for (let y = s.top; y < s.bottom; y++) if ((load.get(y) ?? 0) > limit) return true;
        return false;
      })
      .sort((a, b) => b.weight - a.weight || a.bottom - a.top - (b.bottom - b.top));
    let best: { span: SpriteSpan; dy: number } | null = null;
    for (const span of candidates) {
      const others = spans.filter((s) => s !== span);
      const baseLoad = lineLoad(others);
      for (let step = 8; step <= maxShift && !best; step += 8) {
        for (const dy of [step, -step]) {
          let ok = span.top + dy >= 0;
          for (let y = span.top + dy; ok && y < span.bottom + dy; y++) {
            if ((baseLoad.get(y) ?? 0) + span.weight > limit) ok = false;
          }
          if (ok) {
            best = { span, dy };
            break;
          }
        }
      }
      if (best) break;
    }
    if (!best) return [];
    const entity = byId.get(best.span.entityId) as Entity;
    moves.push({ entityId: entity.entity_id, fromY: entity.transform.y, toY: entity.transform.y + best.dy });
    best.span.top += best.dy;
    best.span.bottom += best.dy;
  }
  return overLimit() ? [] : moves;
}

export interface AttentionInput {
  scene: Scene | null;
  target: "megadrive" | "snes";
  hwStatus: HwStatus | null;
  palettePlan: PalettePlan | null;
  assets?: { missing: number; failed: number };
}

/** Lista priorizada (bloqueios primeiro). Sem problemas, devolve um único passo "Testar a cena". */
export function buildAttentionItems({ scene, target, hwStatus, palettePlan, assets }: AttentionInput): AttentionItem[] {
  if (!scene) return [];
  const items: AttentionItem[] = [];
  const known = new Set(scene.entities.map((e) => e.entity_id));
  const limit = hwStatus?.scanline_sprite_limit ?? (target === "snes" ? 32 : 20);

  const hotspots = findScanlineHotspots(scene, target, limit);
  if (hotspots.length > 0) {
    const ids = [...new Set(hotspots.flatMap((h) => h.entityIds))];
    const worst = hotspots[0];
    items.push({
      id: "scanline",
      kind: "scanline",
      severity: "warning",
      title: `${ids.length} sprite(s) podem piscar no jogo`,
      why: "Há sprites demais na mesma altura da tela. O console não desenha todos e alguns somem ou piscam.",
      technical: `${hotspots.length} faixa(s) acima do limite de ${limit} sprites/scanline; pior: linhas ${worst.top}–${worst.bottom - 1} com ${worst.peak}. Estimativa estática pelas posições na cena.`,
      entityIds: ids,
      actions: ["show_only", "redistribute", "select_first"],
    });
  } else if (hwStatus && hwStatus.scanline_sprite_peak > hwStatus.scanline_sprite_limit) {
    items.push({
      id: "scanline",
      kind: "scanline",
      severity: "warning",
      title: "Alguns sprites podem piscar no jogo",
      why: "A análise de hardware viu sprites demais na mesma altura da tela.",
      technical: `Pico ${hwStatus.scanline_sprite_peak}/${hwStatus.scanline_sprite_limit} sprites/scanline (validação de hardware).`,
      entityIds: [],
      actions: [],
    });
  }

  const paletteErrors = (palettePlan?.diagnostics ?? []).filter((d) => d.severity === "error");
  if (paletteErrors.length > 0) {
    const ids = [...new Set(paletteErrors.flatMap((d) => d.uses).filter((id) => known.has(id)))];
    items.push({
      id: "palette",
      kind: "palette",
      severity: "blocker",
      title: ids.length > 0 ? `${ids.length} objeto(s) com cores sem paleta disponível` : `${paletteErrors.length} problema(s) de paleta`,
      why: "Alguns objetos pedem mais cores do que as paletas do console comportam ao mesmo tempo. A cor pode sair errada.",
      technical: paletteErrors.map((d) => `${d.code}: ${d.message}`).join(" · "),
      entityIds: ids,
      actions: ids.length > 0 ? ["open_palettes", "show_only"] : ["open_palettes"],
    });
  }

  const brokenAssets = (assets?.missing ?? 0) + (assets?.failed ?? 0);
  if (brokenAssets > 0) {
    items.push({
      id: "assets",
      kind: "assets",
      severity: "warning",
      title: `${brokenAssets} imagem(ns) não carregaram`,
      why: "A pré-visualização mostra um substituto. O build pode funcionar, mas confira o arquivo.",
      technical: `missing ${assets?.missing ?? 0} · failed ${assets?.failed ?? 0}`,
      entityIds: [],
      actions: ["open_assets"],
    });
  }

  const staged = scene.entities
    .filter((e) => e.components?.sprite && resolveImportedEntityContext(e).positionMode === "staging")
    .map((e) => e.entity_id);
  if (staged.length > 0) {
    items.push({
      id: "staging",
      kind: "staging",
      severity: "tip",
      title: `${staged.length} sprite(s) numa prateleira provisória`,
      why: "O projeto original não diz onde cada sprite fica na cena, então eles foram enfileirados lado a lado. Arraste para a posição real quando for montar a cena.",
      technical: "position:staging_layout — posições de autoria, não do jogo original.",
      entityIds: staged,
      actions: ["show_only", "select_first"],
    });
  }

  const rank: Record<AttentionSeverity, number> = { blocker: 0, warning: 1, tip: 2 };
  items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  items.push({
    id: "ready",
    kind: "ready",
    severity: "tip",
    title: items.length === 0 ? "Cena pronta para testar" : "Depois, teste a cena",
    why: "Compile e rode no emulador para ver o resultado real.",
    technical: "Build & Run (ROM → emulação).",
    entityIds: [],
    actions: ["test_scene"],
  });
  return items;
}

/** Itens que envolvem um objeto específico (Inspector). */
export function attentionForEntity(items: AttentionItem[], entityId: string | null): AttentionItem[] {
  if (!entityId) return [];
  return items.filter((item) => item.entityIds.includes(entityId));
}
