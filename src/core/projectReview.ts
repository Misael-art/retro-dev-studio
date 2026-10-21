// Revisão do projeto antes da entrega (Experimental, REQ-16). Cada problema diz o que aconteceu,
// qual objeto, a consequência e a ação — e aponta o editor/elemento/propriedade exatos. Erros
// refletem o que o build realmente recusaria; avisos não bloqueiam um destino válido.
import type { PalettePlan } from "./palettePlan";
import { eventsOutsideDuration, occurrenceIds } from "./characterTimeline";
import { hudBand, hudProblems } from "./hudText";
import type { AnimationDef, Entity, Scene } from "./ipc/sceneService";
import { effectiveDurations } from "./mugenAnimationTiming";
import type { StudioFocus } from "./studioContext";

export type ReviewSeverity = "error" | "warning";

export interface ReviewItem {
  id: string;
  severity: ReviewSeverity;
  title: string;
  /** O que aconteceu e com qual objeto. */
  detail: string;
  /** Consequência para o jogo/entrega. */
  consequence: string;
  /** Ação sugerida (rótulo do botão). */
  action: string;
  chips: string[];
  target: Partial<StudioFocus> & { task: StudioFocus["task"]; property?: string };
}

export interface ReviewResult {
  items: ReviewItem[];
  errors: number;
  warnings: number;
  /** Verificações executadas sem problema. */
  passed: number;
}

/** Margem de área segura (tiles de 8 px) usada como aviso, não bloqueio. */
const SAFE_MARGIN_TILES = 1;

function mugenAnimations(entity: Entity): Array<[string, AnimationDef]> {
  return Object.entries(entity.components.sprite?.animations ?? {}).filter(([, def]) => Array.isArray(def.mugen_frames));
}

/** Referências `assets/...` auditadas no disco (cenas, modelos e grafos). */
export interface AuditedReference {
  file: string;
  value: string;
  exists: boolean;
}

function entityReferencing(scene: Pick<Scene, "entities"> | null, path: string): Entity | null {
  return (
    scene?.entities.find((entity) => {
      const c = entity.components;
      return c.sprite?.asset === path || c.tilemap?.tileset === path || Object.values(c.audio?.sfx ?? {}).includes(path) || c.audio?.bgm === path;
    }) ?? null
  );
}

export function reviewProject(
  scene: Pick<Scene, "entities"> | null,
  references: AuditedReference[] = [],
  palettePlan: PalettePlan | null = null
): ReviewResult {
  const items: ReviewItem[] = [];
  let checks = 0;
  // Plano de paletas (mesmo do build): conflitos e esgotamento aparecem antes do build.
  for (const d of palettePlan?.diagnostics ?? []) {
    checks += 1;
    const owner = d.uses.find((u) => !u.startsWith("("));
    items.push({
      id: `palette:${d.code}:${d.message}`,
      severity: d.severity === "error" ? "error" : "warning",
      title: d.code === "bancos_esgotados" ? "Sem banco de paleta livre" : d.code === "conflito_de_cores" ? "Conflito de paletas" : "Paleta",
      detail: d.message,
      consequence: d.severity === "error" ? "O build é recusado; nenhuma paleta é sobrescrita." : "O jogo mostra cores aproximadas.",
      action: owner ? "Abrir o uso" : "Abrir a cena",
      chips: [...d.uses.map((u) => `Uso: ${u}`), ...(d.actions.length ? [`Ações: ${d.actions.join(" · ")}`] : [])],
      target: owner ? { task: "scene", entityId: owner } : { task: "scene" },
    });
  }
  const band = hudBand(scene);
  if (band) {
    checks += 1;
    const firstHud = (scene?.entities ?? []).find((e) => e.components.hud);
    if (band.split && firstHud) {
      items.push({
        id: "hud-band:split",
        severity: "error",
        title: "Texto da interface nas duas metades da tela",
        detail: "Com câmera, o texto usa o plano fixo WINDOW, que cobre só o topo ou só a base da tela.",
        consequence: "O build é recusado.",
        action: "Abrir na Interface",
        chips: ["Política: WINDOW"],
        target: { task: "interface", entityId: firstHud.entity_id, property: "hud" },
      });
    } else if (band.coveredPlaneA && band.rows) {
      items.push({
        id: `hud-band:covers:${band.coveredPlaneA}`,
        severity: "warning",
        title: "Faixa do HUD cobre o plano A",
        detail: `As linhas ${band.rows[0]}–${band.rows[1]} são da faixa fixa do texto; ali o tilemap '${band.coveredPlaneA}' (plano A) não aparece.`,
        consequence: "Essa parte do cenário fica escondida atrás da faixa do HUD.",
        action: "Abrir o tilemap",
        chips: ["Política: WINDOW", `Linhas ${band.rows[0]}–${band.rows[1]}`],
        target: { task: "scene", entityId: band.coveredPlaneA },
      });
    }
  }
  const seenMissing = new Set<string>();
  for (const ref of references) {
    checks += 1;
    if (ref.exists || seenMissing.has(ref.value)) continue;
    seenMissing.add(ref.value);
    const owner = entityReferencing(scene, ref.value);
    const users = references.filter((r) => r.value === ref.value).map((r) => r.file);
    items.push({
      id: `missing-file:${ref.value}`,
      severity: "error",
      title: "Arquivo não encontrado",
      detail: `${ref.value} é usado em ${[...new Set(users)].join(", ")}, mas não existe no projeto.`,
      consequence: "O build é recusado ou o recurso some do jogo.",
      action: owner ? "Abrir a entidade" : "Abrir a cena",
      chips: [`Arquivo: ${ref.value}`, `${users.length} referência(s)`],
      target: owner ? { task: "scene", entityId: owner.entity_id } : { task: "scene" },
    });
  }
  // O driver de som tem um registro único por ROM: um som vale para qualquer entidade que o use.
  const sfx = new Set((scene?.entities ?? []).flatMap((e) => Object.keys(e.components.audio?.sfx ?? {})));
  for (const entity of scene?.entities ?? []) {
    const name = entity.display_name || entity.entity_id;
    for (const [animation, def] of mugenAnimations(entity)) {
      const ids = occurrenceIds(def);
      const durations = effectiveDurations(def);
      for (const event of def.frame_events ?? []) {
        checks += 1;
        if (!ids.includes(event.occurrence)) {
          items.push({
            id: `event-occurrence:${entity.entity_id}:${animation}:${event.id}`,
            severity: "error",
            title: "Evento sem quadro",
            detail: `O evento ${event.id} de ${name} (${animation}) aponta para uma ocorrência que não existe mais.`,
            consequence: "O build é recusado; o evento não seria tocado.",
            action: "Abrir no Personagem",
            chips: [`Personagem: ${name}`, `Animação: ${animation}`],
            target: { task: "character", entityId: entity.entity_id, animation, eventId: event.id },
          });
          continue;
        }
        if (eventsOutsideDuration(def, event.occurrence, durations[ids.indexOf(event.occurrence)]).some((e) => e.id === event.id)) {
          items.push({
            id: `event-tick:${entity.entity_id}:${animation}:${event.id}`,
            severity: "error",
            title: "Evento fora do quadro",
            detail: `O evento ${event.id} de ${name} está no tick ${event.tick}, depois do fim da ocorrência ${event.occurrence}.`,
            consequence: "O build é recusado; o evento não é deslocado automaticamente.",
            action: "Abrir no Personagem",
            chips: [`Personagem: ${name}`, `Animação: ${animation}`, `Ocorrência: ${event.occurrence}`],
            target: { task: "character", entityId: entity.entity_id, animation, occurrenceId: event.occurrence, eventId: event.id },
          });
          continue;
        }
        checks += 1;
        if (event.kind === "sound" && (!event.sound || !sfx.has(event.sound))) {
          items.push({
            id: `event-sound:${entity.entity_id}:${animation}:${event.id}`,
            severity: "error",
            title: "Som não encontrado",
            detail: `${name} toca “${event.sound ?? "?"}” em ${animation} (${event.occurrence}), mas esse som não está no Áudio do projeto.`,
            consequence: "O build é recusado: o evento sonoro não tem som para tocar.",
            action: "Abrir no Personagem",
            chips: [`Personagem: ${name}`, `Som: ${event.sound ?? "—"}`, `Ocorrência: ${event.occurrence}`],
            target: { task: "character", entityId: entity.entity_id, animation, occurrenceId: event.occurrence, eventId: event.id },
          });
        }
      }
    }
    if (entity.components.hud) {
      checks += 1;
      const hud = entity.components.hud;
      for (const problem of hudProblems(hud, scene)) {
        items.push({
          id: `hud:${entity.entity_id}:${problem}`,
          severity: "error",
          title: "Texto inválido para o destino",
          detail: `${name}: ${problem}`,
          consequence: "O build é recusado.",
          action: "Abrir na Interface",
          chips: [`Interface: ${name}`, `Posição: (${hud.column}, ${hud.row})`],
          target: { task: "interface", entityId: entity.entity_id, property: "hud" },
        });
      }
      checks += 1;
      const width = [...hud.label].length + (hud.value ? hud.digits ?? 3 : 0);
      if (
        hudProblems(hud, scene).length === 0 &&
        (hud.column < SAFE_MARGIN_TILES || hud.row < SAFE_MARGIN_TILES || hud.column + width > 40 - SAFE_MARGIN_TILES || hud.row > 27 - SAFE_MARGIN_TILES)
      ) {
        items.push({
          id: `hud-safe:${entity.entity_id}`,
          severity: "warning",
          title: "Texto fora da área segura",
          detail: `${name} encosta na borda da tela (${width} caracteres em ${hud.column}, ${hud.row}).`,
          consequence: "Pode ficar cortado em algumas TVs; o build continua válido.",
          action: "Abrir na Interface",
          chips: [`Interface: ${name}`],
          target: { task: "interface", entityId: entity.entity_id, property: "hud" },
        });
      }
    }
  }
  // Modelo MUGEN compartilhado: instâncias divergentes são recusadas pelo build.
  const byAsset = new Map<string, Entity[]>();
  for (const entity of scene?.entities ?? []) {
    const asset = entity.components.sprite?.asset;
    if (asset && mugenAnimations(entity).length > 0) byAsset.set(asset, [...(byAsset.get(asset) ?? []), entity]);
  }
  for (const users of byAsset.values()) {
    if (users.length < 2) continue;
    checks += 1;
    const reference = JSON.stringify(users[0].components.sprite?.animations);
    const diverging = users.find((user) => JSON.stringify(user.components.sprite?.animations) !== reference);
    if (diverging) {
      items.push({
        id: `model-diverge:${diverging.entity_id}`,
        severity: "error",
        title: "Instâncias do personagem divergentes",
        detail: `${diverging.display_name || diverging.entity_id} usa o mesmo personagem com animações diferentes das outras ${users.length - 1} instância(s).`,
        consequence: "O build é recusado: a animação é do modelo e vale para todas as instâncias.",
        action: "Abrir no Personagem",
        chips: [`Modelo: ${users[0].components.sprite?.asset}`, `${users.length} usos`],
        target: { task: "character", entityId: diverging.entity_id },
      });
    }
  }
  const errors = items.filter((item) => item.severity === "error").length;
  const warnings = items.length - errors;
  return { items, errors, warnings, passed: Math.max(0, checks - items.length) };
}
