import type { Entity, Scene } from "./ipc/sceneService";
import type { ProjectAssetEntry } from "./ipc/toolsService";
import { createSpriteEntityFromAsset, createTilemapEntityFromAsset } from "./editorEntityFactory";

/** Normaliza caminho relativo de asset para comparação estável (Windows/Linux). */
export function normalizeAssetRelativePath(relativePath: string): string {
  return String(relativePath).replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function pathSuggestsTilemapOrTilesetByLayout(normalizedLower: string): boolean {
  return (
    normalizedLower.includes("/tilesets/") ||
    normalizedLower.includes("/tilemaps/") ||
    normalizedLower.includes("/maps/") ||
    normalizedLower.includes("res/maps/") ||
    normalizedLower.includes("_tilemap") ||
    normalizedLower.includes("_tileset")
  );
}

function isSgdkLikeProjectSource(projectSourceKind: string): boolean {
  const k = projectSourceKind.trim().toLowerCase();
  return k === "imported_sgdk" || k === "external_sgdk" || k === "sgdk_overlay";
}

export type ImageAssetInstantiationKind = "tilemap" | "sprite";

export type ImageAssetInstantiationClassification = {
  kind: ImageAssetInstantiationKind;
  /** Origem da decisão (para logs e auditoria; não é heurística “mágica” silenciosa). */
  reason: string;
  /** Resumo curto para UI/Inspector/Asset Browser. */
  title: string;
  /** Explicação em linguagem de produto; o `reason` continua sendo a trilha auditável. */
  detail: string;
  /** Tipo de entidade que será criada. */
  entityLabel: "Sprite" | "Tilemap";
  /** Próximo passo sugerido logo após a instanciação. */
  nextStep: string;
};

function describeInstantiationDecision(
  kind: ImageAssetInstantiationKind,
  reason: string
): Omit<ImageAssetInstantiationClassification, "kind" | "reason"> {
  if (kind === "tilemap") {
    switch (reason) {
      case "cena-referencia-tileset":
        return {
          title: "Adicionar imagem à cena",
          detail: "Este asset ja aparece na cena como tileset, entao manter tilemap evita leituras diferentes entre browser, viewport e inspector.",
          entityLabel: "Tilemap",
          nextStep: "Depois de instanciar, use o viewport para pintar/importar cells[] quando quiser sair do fallback legado.",
        };
      case "sgdk-layout-canónico-pastas":
        return {
          title: "Adicionar imagem à cena",
          detail: "O layout canonico do importado SGDK indica tileset/tilemap; por isso a instancia coerente aqui continua sendo um tilemap.",
          entityLabel: "Tilemap",
          nextStep: "Revise o tileset no Inspector e materialize cells[] no viewport se precisar edicao fina por celula.",
        };
      default:
        return {
          title: "Adicionar imagem à cena",
          detail: "O caminho deste asset sugere mapa ou tileset, entao a instancia mais previsivel no editor e um tilemap.",
          entityLabel: "Tilemap",
          nextStep: "Depois de instanciar, confirme o tileset no Inspector e ajuste cells[] no viewport quando necessario.",
        };
    }
  }

  switch (reason) {
    case "manifesto-sgdk-sprite":
      return {
        title: "Adicionar personagem ou objeto",
        detail: "O manifesto de origem identifica este recurso como personagem ou objeto animado.",
        entityLabel: "Sprite",
        nextStep: "Adicione à cena para posicionar. Abra Arte para trabalhar nos quadros e animações.",
      };
    case "cena-referencia-sprite":
      return {
        title: "Adicionar personagem ou objeto",
        detail: "Este asset ja e usado como sprite na cena ativa, entao a nova instancia segue o mesmo tipo para manter a autoria coerente.",
        entityLabel: "Sprite",
        nextStep: "Depois de instanciar, ajuste frame, palette e logica no Inspector conforme o target ativo.",
      };
    case "nao-imagem: apenas sprites aceitam kind!=image no fluxo atual":
      return {
        title: "Adicionar personagem ou objeto",
        detail: "O fluxo atual so suporta assets nao-imagem como sprite, por isso nao ha ambiguidade nesta escolha.",
        entityLabel: "Sprite",
        nextStep: "Revise a entidade no Inspector antes de continuar a montagem da cena.",
      };
    default:
      return {
        title: "Adicionar personagem ou objeto",
        detail: "Sem sinais de tilemap no caminho nem referencias existentes na cena, este asset entra como sprite por padrao explicito.",
        entityLabel: "Sprite",
        nextStep: "Depois de instanciar, use o Inspector para ajustar quadro, palette e comportamento inicial.",
      };
  }
}

/**
 * Classifica se um asset de imagem do browser deve instanciar `components.tilemap` ou `components.sprite`.
 *
 * Ordem:
 * 1. Cena já referencia o path como `tilemap.tileset` → tilemap.
 * 2. Cena já referencia como `sprite.asset` → sprite.
 * 3. Projeto SGDK-like + layout canónico (tilesets, tilemaps, maps) → tilemap.
 * 4. Layout canónico (qualquer projeto) → tilemap.
 * 5. Caso contrário → sprite.
 */
export function classifyImageAssetInstantiation(options: {
  asset: Pick<ProjectAssetEntry, "kind" | "relative_path" | "sgdk_resource">;
  projectSourceKind: string;
  sceneEntities: Pick<Entity, "entity_id" | "components">[];
}): ImageAssetInstantiationClassification {
  const { asset, projectSourceKind, sceneEntities } = options;
  if (asset.kind !== "image") {
    const reason = "nao-imagem: apenas sprites aceitam kind!=image no fluxo atual";
    return {
      kind: "sprite",
      reason,
      ...describeInstantiationDecision("sprite", reason),
    };
  }

  const normalized = normalizeAssetRelativePath(asset.relative_path);
  if (asset.sgdk_resource?.pixel_document) {
    const kind = asset.sgdk_resource.resource_kind === "IMAGE" ? "tilemap" : "sprite";
    return {kind,reason:"documento-pixels",title:"Imagem pronta para a cena",detail:"Medidas e animação vêm do documento de pixels salvo.",entityLabel:kind==="sprite"?"Sprite":"Tilemap",nextStep:"Edite os pixels e quadros em Arte; Salvar atualiza a imagem na cena."};
  }

  const usedAsTileset = sceneEntities.some((e) => {
    const ts = e.components?.tilemap?.tileset?.trim();
    return ts && normalizeAssetRelativePath(ts) === normalized;
  });
  if (usedAsTileset) {
    const reason = "cena-referencia-tileset";
    return { kind: "tilemap", reason, ...describeInstantiationDecision("tilemap", reason) };
  }

  const usedAsSprite = sceneEntities.some((e) => {
    const sp = e.components?.sprite?.asset?.trim();
    return sp && normalizeAssetRelativePath(sp) === normalized;
  });
  if (usedAsSprite) {
    const reason = "cena-referencia-sprite";
    return { kind: "sprite", reason, ...describeInstantiationDecision("sprite", reason) };
  }

  if (asset.sgdk_resource?.resource_kind === "SPRITE") {
    const reason = "manifesto-sgdk-sprite";
    return { kind: "sprite", reason, ...describeInstantiationDecision("sprite", reason) };
  }
  if (["IMAGE", "TILESET", "TILEMAP", "MAP"].includes(asset.sgdk_resource?.resource_kind ?? "")) {
    const reason = "manifesto-sgdk-mapa";
    return {
      kind: "tilemap", reason,
      title: asset.sgdk_resource?.resource_kind === "TILESET" ? "Banco de peças para montar" : "Imagem montada para a cena",
      detail: asset.sgdk_resource?.resource_kind === "TILESET"
        ? "Este banco guarda peças gráficas. A composição feita pelo código original não está incluída neste arquivo."
        : "A organização da imagem original será preservada ao adicionar à cena.",
      entityLabel: "Tilemap",
      nextStep: "Na Cena, use Selecionar para posicionar ou Pintar para trabalhar com as peças.",
    };
  }

  const lower = normalized.toLowerCase();
  if (isSgdkLikeProjectSource(projectSourceKind) && pathSuggestsTilemapOrTilesetByLayout(lower)) {
    const reason = "sgdk-layout-canónico-pastas";
    return { kind: "tilemap", reason, ...describeInstantiationDecision("tilemap", reason) };
  }

  if (pathSuggestsTilemapOrTilesetByLayout(lower)) {
    const reason = "layout-pastas-maps-tilesets";
    return { kind: "tilemap", reason, ...describeInstantiationDecision("tilemap", reason) };
  }

  const reason = "padrao-sprite-sem-sinais-de-tilemap";
  return { kind: "sprite", reason, ...describeInstantiationDecision("sprite", reason) };
}

export function shouldInstantiateImageAsTilemapEntity(options: {
  asset: Pick<ProjectAssetEntry, "kind" | "relative_path">;
  projectSourceKind: string;
  sceneEntities: Pick<Entity, "entity_id" | "components">[];
}): boolean {
  return classifyImageAssetInstantiation(options).kind === "tilemap";
}

export function createEntityFromProjectAsset(options: {
  asset: ProjectAssetEntry;
  target: "megadrive" | "snes";
  projectSourceKind: string;
  scene: Pick<Scene, "entities" | "background_layers">;
}): Entity {
  const { asset, target, scene, projectSourceKind } = options;
  const issue = getAssetInstantiationIssue(asset, scene.entities);
  if (issue) throw new Error(issue);
  const spriteLayout = asset.sgdk_resource?.sprite ?? scene.entities.find(e => e.components.sprite?.asset === asset.relative_path)?.components.sprite;
  const common = {
    assetPath: asset.relative_path,
    existingEntityIds: scene.entities.map(e => e.entity_id),
    suggestedName: asset.sgdk_resource?.resource_name,
  };
  const withDocument = (entity: Entity) => {
    if (asset.sgdk_resource?.pixel_document) entity.components.logic = { ...entity.components.logic, logic_hints: [...(entity.components.logic?.logic_hints ?? []), `pixel_art:document=${asset.sgdk_resource.pixel_document}`] };
    return entity;
  };
  if (classifyImageAssetInstantiation({ asset, projectSourceKind, sceneEntities: scene.entities }).kind === "tilemap") {
    const entity = createTilemapEntityFromAsset({
      ...common,
      mapWidth: asset.image_width ? Math.max(1, Math.floor(asset.image_width / 8)) : undefined,
      mapHeight: asset.image_height ? Math.max(1, Math.floor(asset.image_height / 8)) : undefined,
    });
    if (asset.sgdk_resource?.resource_kind === "TILESET") entity.components.logic = { logic_hints: ["sgdk_import:tileset_bank"] };
    if (asset.sgdk_resource?.pixel_document && entity.components.tilemap) entity.components.tilemap.cells = Array.from({length:entity.components.tilemap.map_width*entity.components.tilemap.map_height},(_,i)=>i+1);
    return withDocument(entity);
  }
  const entity = createSpriteEntityFromAsset({
    ...common, target, includeStarterLogic: scene.entities.length === 0 && scene.background_layers.length === 0,
  });
  if (spriteLayout) {
    // The importer already derives the canonical SGDK layout, including meta
    // sprites. Do not clip it with the simple-sprite factory's 32px default.
    entity.components.sprite = { ...structuredClone(spriteLayout), asset: asset.relative_path };
  }
  return withDocument(entity);
}

export function getAssetInstantiationIssue(asset: ProjectAssetEntry, entities: Pick<Entity, "components">[]): string | null {
  if (asset.kind !== "image") return "Este arquivo está na biblioteca. Apenas imagens podem ser adicionadas como objetos na cena.";
  if (asset.sgdk_resource?.resource_kind === "PALETTE") return "Esta é uma paleta de cores. Abra sua imagem em Arte para editar; ela não é um objeto da cena.";
  if (asset.sgdk_resource?.resource_kind === "SPRITE" && !asset.sgdk_resource.sprite && !entities.some(e => e.components.sprite?.asset === asset.relative_path)) {
    if (asset.sgdk_resource.pixel_document) return "O documento de pixels não confere com a imagem. Reabra o original ou repare o documento em Arte antes de adicionar à cena.";
    return "Este recurso não tem um layout de quadros válido na importação. Confira a imagem e suas medidas na origem e importe novamente em um novo projeto, preservando seu trabalho atual.";
  }
  return null;
}
