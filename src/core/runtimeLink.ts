// Vínculo execução → projeto (Experimental, `retrodev.runtime_link/v1`).
// O build grava, ligado ao SHA-256 da ROM, onde cada entidade autoral/MUGEN guarda posição e animação
// na RAM e quais animações/ocorrências o build compilou. A seleção num quadro pausado usa a geometria
// do quadro apresentado e só navega se ROM, época e recurso ainda forem os mesmos.
import type { Scene } from "./ipc/sceneService";

export const RUNTIME_LINK_SCHEMA = "retrodev.runtime_link/v1";

export interface RuntimeLinkEntity {
  entity_id: string;
  origin: "authored" | "mugen";
  var_name: string;
  frame_width: number;
  frame_height: number;
  pivot: { x: number; y: number } | null;
  /** Endereços (System RAM, 0xFF....) lidos do ELF do build. */
  symbols: { x: number; y: number; anim: number | null; frame: number | null };
  /** Animações na ordem de índice do build. */
  animations: string[];
  /** Por animação: ids de ocorrência e deslocamento (dx, dy) do quadro na tela, como compilados. */
  occurrences: Record<string, string[]>;
  frame_offsets: Record<string, Array<[number, number]>>;
  /** Identidade do conteúdo compilado (ausente em vínculos antigos → navegação recusada por segurança). */
  asset?: string;
  asset_sha256?: string;
  /** Por animação, por ocorrência: [índice da imagem, grupo SFF, imagem SFF] (−1 se não MUGEN). */
  occurrence_images?: Record<string, Array<[number, number, number]>>;
  /** Caixas compiladas por ocorrência: [x1,y1,x2,y2] relativas ao eixo. */
  occurrence_boxes?: Record<string, Array<{ attack: Array<[number, number, number, number]>; body: Array<[number, number, number, number]> }>>;
  /** Eventos na ordem da tabela da ROM (o índice `evlast` aponta para esta lista). */
  events?: Record<string, Array<{ id: string; occurrence: string; tick: number; sound: string }>>;
  event_symbols?: { fired: number; last: number; last_anim: number } | null;
}

export interface RuntimeLinkTilemap {
  entity_id: string;
  x: number;
  y: number;
  width_px: number;
  height_px: number;
}

export interface RuntimeLinkHud {
  entity_id: string;
  x: number;
  y: number;
  width_px: number;
  height_px: number;
  shown_symbol: number | null;
}

export interface RuntimeLink {
  schema: string;
  target: string;
  rom_sha256: string;
  generated_source_sha256: string;
  entities: RuntimeLinkEntity[];
  tilemaps: RuntimeLinkTilemap[];
  /** Ausente em vínculos gravados antes do texto de interface. */
  hud?: RuntimeLinkHud[];
  /** Endereços da câmera (mundo − câmera = tela); ausente sem câmera. */
  camera?: { x: number; y: number } | null;
  /** Bancos planejados no build (não é leitura da memória de cor). */
  palette?: {
    schema: string;
    entities: Record<string, [number, string, string]>;
    text_bank?: number;
    swaps: Array<{ id: string; target_entity: string; palette: string; bank: number; affected_uses: string[]; frames: number }>;
    evidence: string;
  } | null;
  collision?: { tile_width: number; tile_height: number; width: number; height: number; solid: number[] } | null;
  limitations: string[];
}

export interface RuntimeEntitySample {
  entity_id: string;
  x: number;
  y: number;
  anim: number | null;
  frame: number | null;
}

/** Quadro pausado: identidade do que está na tela no momento da amostra. */
export interface PausedFrameIdentity {
  romSha256: string;
  coreEpoch: number;
  renderedFrames: number;
}

export type InspectLayer = "scene" | "characters" | "interface" | "collisions" | "audio";

export interface RuntimeCandidate {
  kind: "character" | "tilemap" | "hud";
  entity_id: string;
  rect: { x: number; y: number; w: number; h: number };
  animation: string | null;
  occurrenceId: string | null;
  origin: "authored" | "mugen";
  /** Prioridade de desenho: personagens sobre cenário. */
  depth: number;
}

/** Converte clique em pixels CSS do canvas para coordenadas nativas do quadro (inclui borda/escala). */
export function clientToNative(
  click: { clientX: number; clientY: number },
  canvas: { left: number; top: number; clientLeft: number; clientTop: number; clientWidth: number; clientHeight: number; width: number; height: number }
): { x: number; y: number } | null {
  const localX = click.clientX - canvas.left - canvas.clientLeft;
  const localY = click.clientY - canvas.top - canvas.clientTop;
  if (localX < 0 || localY < 0 || localX >= canvas.clientWidth || localY >= canvas.clientHeight) return null;
  return {
    x: Math.floor((localX * canvas.width) / canvas.clientWidth),
    y: Math.floor((localY * canvas.height) / canvas.clientHeight),
  };
}

export function parseRuntimeLink(raw: unknown): RuntimeLink | null {
  if (!raw || typeof raw !== "object") return null;
  const link = raw as RuntimeLink;
  if (link.schema !== RUNTIME_LINK_SCHEMA || typeof link.rom_sha256 !== "string" || !Array.isArray(link.entities)) {
    return null;
  }
  return link;
}

/** Retângulos de tudo que o build vinculou, a partir das amostras de RAM do quadro pausado. */
export function runtimeCandidates(
  link: RuntimeLink,
  samples: RuntimeEntitySample[],
  camera: { x: number; y: number } = { x: 0, y: 0 }
): RuntimeCandidate[] {
  const out: RuntimeCandidate[] = [];
  for (const tilemap of link.tilemaps) {
    out.push({
      kind: "tilemap",
      entity_id: tilemap.entity_id,
      rect: { x: tilemap.x - camera.x, y: tilemap.y - camera.y, w: tilemap.width_px, h: tilemap.height_px },
      animation: null,
      occurrenceId: null,
      origin: "authored",
      depth: 0,
    });
  }
  for (const hud of link.hud ?? []) {
    out.push({
      kind: "hud",
      entity_id: hud.entity_id,
      rect: { x: hud.x, y: hud.y, w: hud.width_px, h: hud.height_px },
      animation: null,
      occurrenceId: null,
      origin: "authored",
      depth: 2,
    });
  }
  for (const entity of link.entities) {
    const sample = samples.find((s) => s.entity_id === entity.entity_id);
    if (!sample) continue;
    const animation = sample.anim !== null ? entity.animations[sample.anim] ?? null : null;
    const occurrences = animation ? entity.occurrences[animation] ?? [] : [];
    const offsets = animation ? entity.frame_offsets[animation] ?? [] : [];
    const frame = sample.frame ?? 0;
    const [dx, dy] = offsets[frame] ?? [0, 0];
    out.push({
      kind: "character",
      entity_id: entity.entity_id,
      rect: { x: sample.x + dx - camera.x, y: sample.y + dy - camera.y, w: entity.frame_width, h: entity.frame_height },
      animation,
      occurrenceId: occurrences[frame] ?? null,
      origin: entity.origin,
      depth: 1,
    });
  }
  return out;
}

/** Candidatos sob o ponto, do mais à frente ao mais atrás (para escolher entre sobrepostos). */
export function hitTest(candidates: RuntimeCandidate[], point: { x: number; y: number }): RuntimeCandidate[] {
  return candidates
    .filter((c) => point.x >= c.rect.x && point.x < c.rect.x + c.rect.w && point.y >= c.rect.y && point.y < c.rect.y + c.rect.h)
    .sort((a, b) => b.depth - a.depth);
}

export type RuntimeNavigationCheck =
  | { ok: true }
  | { ok: false; reason: string; needsAssetHash?: string };

/**
 * Recusa navegação com dados de outro build/sessão/quadro ou para recurso que mudou desde o build.
 */
export function checkRuntimeNavigation(options: {
  link: RuntimeLink;
  sampledAt: PausedFrameIdentity;
  current: { romSha256: string | null; coreEpoch: number | null; renderedFrames: number | null; paused: boolean };
  candidate: RuntimeCandidate;
  scene: Pick<Scene, "entities"> | null;
  /** SHA-256 do conteúdo atual dos assets (caminho → sha), lido no clique; sem ele a resposta é `needsAssetHash`. */
  assetHashes?: Record<string, string>;
}): RuntimeNavigationCheck {
  const { link, sampledAt, current, candidate, scene, assetHashes = {} } = options;
  if (!current.paused) return { ok: false, reason: "Pause o teste para selecionar: o quadro mudou desde a amostra." };
  if (current.romSha256 !== link.rom_sha256) {
    return { ok: false, reason: "A ROM em execução não é a do último build (vínculo de outro build). Recompile e execute." };
  }
  if (sampledAt.romSha256 !== current.romSha256 || sampledAt.coreEpoch !== current.coreEpoch) {
    return { ok: false, reason: "A amostra é de outra sessão do emulador. Selecione de novo." };
  }
  if (sampledAt.renderedFrames !== current.renderedFrames) {
    return { ok: false, reason: "O jogo avançou desde a amostra. Selecione de novo no quadro atual." };
  }
  const entity = scene?.entities.find((e) => e.entity_id === candidate.entity_id);
  if (!entity) return { ok: false, reason: `A entidade '${candidate.entity_id}' não existe mais no projeto.` };
  if (candidate.kind === "character") {
    const linked = link.entities.find((e) => e.entity_id === candidate.entity_id);
    const sprite = entity.components.sprite;
    if (!linked || !sprite) return { ok: false, reason: `'${candidate.entity_id}' não tem mais o personagem compilado.` };
    if (!linked.asset || !linked.asset_sha256 || !linked.occurrence_images) {
      return { ok: false, reason: "Vínculo de build antigo sem identidade de conteúdo. Recompile para inspecionar." };
    }
    // O conteúdo ATUAL do arquivo precisa ser o do build, com o caminho igual ou não: o mesmo caminho pode ter
    // conteúdo novo; um caminho novo com o mesmo conteúdo é mover/renomear legítimo.
    const hash = assetHashes[sprite.asset];
    if (hash === undefined) {
      return { ok: false, reason: "Conferindo o arquivo do personagem…", needsAssetHash: sprite.asset };
    }
    if (hash !== linked.asset_sha256) {
      return { ok: false, reason: `A arte de '${candidate.entity_id}' mudou desde o build (${sprite.asset}). Recompile.` };
    }
  }
  if (candidate.animation) {
    const def = entity.components.sprite?.animations?.[candidate.animation];
    if (!def) return { ok: false, reason: `A animação '${candidate.animation}' mudou desde o build. Recompile.` };
    const ids = def.occurrence_ids ?? def.frames.map((_, i) => `o${i + 1}`);
    if (candidate.occurrenceId && !ids.includes(candidate.occurrenceId)) {
      return { ok: false, reason: `A ocorrência '${candidate.occurrenceId}' mudou desde o build. Recompile.` };
    }
    const linked = link.entities.find((e) => e.entity_id === candidate.entity_id);
    const compiled = linked?.occurrence_images?.[candidate.animation];
    const compiledIds = linked?.occurrences[candidate.animation] ?? [];
    if (candidate.occurrenceId && compiled) {
      const builtIndex = compiledIds.indexOf(candidate.occurrenceId);
      const nowIndex = ids.indexOf(candidate.occurrenceId);
      const built = compiled[builtIndex];
      const mugen = def.mugen_frames?.[nowIndex];
      const now: [number, number, number] = [def.frames[nowIndex], mugen ? mugen.group : -1, mugen ? mugen.image : -1];
      if (!built || built[0] !== now[0] || built[1] !== now[1] || built[2] !== now[2]) {
        return { ok: false, reason: `A ocorrência '${candidate.occurrenceId}' mostra outra imagem desde o build. Recompile.` };
      }
    }
  }
  return { ok: true };
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ScreenBox {
  entity_id: string;
  kind: "attack" | "body" | "solid";
  rect: { x: number; y: number; w: number; h: number };
}

/** Caixas a desenhar no quadro pausado: ocorrência atual de cada personagem + células sólidas (tela = mundo − câmera). */
export function collisionBoxes(
  link: RuntimeLink,
  samples: RuntimeEntitySample[],
  camera: { x: number; y: number } = { x: 0, y: 0 }
): ScreenBox[] {
  const out: ScreenBox[] = [];
  for (const entity of link.entities) {
    const sample = samples.find((s) => s.entity_id === entity.entity_id);
    if (!sample || sample.anim === null || sample.frame === null || !entity.pivot) continue;
    const animation = entity.animations[sample.anim];
    const boxes = animation ? entity.occurrence_boxes?.[animation]?.[sample.frame] : undefined;
    if (!boxes) continue;
    const ax = sample.x + entity.pivot.x - camera.x;
    const ay = sample.y + entity.pivot.y - camera.y;
    for (const [kind, list] of [["attack", boxes.attack], ["body", boxes.body]] as const) {
      for (const [x1, y1, x2, y2] of list) {
        out.push({ entity_id: entity.entity_id, kind, rect: { x: ax + x1, y: ay + y1, w: x2 - x1, h: y2 - y1 } });
      }
    }
  }
  const map = link.collision;
  if (map) {
    for (const index of map.solid) {
      out.push({
        entity_id: "collision_map",
        kind: "solid",
        rect: {
          x: (index % map.width) * map.tile_width - camera.x,
          y: Math.floor(index / map.width) * map.tile_height - camera.y,
          w: map.tile_width,
          h: map.tile_height,
        },
      });
    }
  }
  return out;
}

export interface AudioEventRow {
  entity_id: string;
  fired: number;
  last: { id: string; occurrence: string; tick: number; sound: string } | null;
}

/** Linha de eventos sonoros de um personagem a partir dos contadores lidos no quadro pausado. */
export function audioEventRow(
  entity: RuntimeLinkEntity,
  lastAnimIndex: number,
  fired: number,
  lastIndex: number
): AudioEventRow {
  const animation = lastAnimIndex !== 0xffff ? entity.animations[lastAnimIndex] ?? null : null;
  const list = animation ? entity.events?.[animation] ?? [] : [];
  return { entity_id: entity.entity_id, fired, last: lastIndex !== 0xffff ? list[lastIndex] ?? null : null };
}
