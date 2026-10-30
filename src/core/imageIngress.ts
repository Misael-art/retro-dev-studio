// Clipboard/drop transport and scene proposal over the existing art/palette writers.
import { invoke } from "@tauri-apps/api/core";
import type { AnimationDef, Entity, PaletteEntry, Scene } from "./ipc/sceneService";
import { createSpriteEntityFromAsset, createTilemapEntityFromAsset } from "./editorEntityFactory";
import { fetchPalettePlan, newErrors, type PalettePlan } from "./palettePlan";
import { buildSheetIndices, deserializePixelDoc, exportSheetPng, mdColorToCss, serializePixelDoc, type PixelDoc, type PixelConversion } from "./pixelEditor";
import { savePixelArtAsset } from "./ipc/artStudioService";

export type ImageRole = "sprite" | "background";
export interface ImageInput { name?: string; bytes?: number[]; path?: string; url?: string }
export interface PreparedImage {
  source_relative: string; name: string; source_width: number; source_height: number; frame_count: number;
  preview_base64: string; suggested_role: ImageRole; background_mode: string; warnings: string[]; doc_json: string | null;
  preview_url?: string;
}
export interface ImageCandidate { entity: Entity; doc: PixelDoc; assetPath: string; prepared: PreparedImage }
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMAGE_CONVERSIONS: { id: PixelConversion; name: string; description: string }[] = [
  { id: "balanced", name: "Agrupamento de cores", description: "Inspirado no agrupamento k-means do SGDKForge, adaptado com frequência e inicialização determinística. Equilibra áreas grandes e detalhes no RGB333 do Mega Drive." },
  { id: "dominant", name: "Contornos limpos", description: "Fluxo sem dithering do SMSForge adaptado ao Mega Drive. Prioriza cores frequentes; indicado para sprites e pixel art." },
  { id: "floyd", name: "Gradientes suaves", description: "Difusão Floyd–Steinberg do SMSForge adaptada ao Mega Drive. Aproxima transições com pequenos pontos; pode aumentar os tiles únicos." },
];

export async function imageFileInput(file: File): Promise<ImageInput> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem excede 20 MB. Nenhum objeto foi alterado.");
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.readAsArrayBuffer(file);
  });
  return { name: file.name || "imagem_colada", bytes: Array.from(new Uint8Array(bytes)) };
}

/** Read markup without attaching it to the document or executing anything. */
export function imageTransferSources(transfer: DataTransfer): (File | ImageInput)[] {
  const providedFiles = Array.from(transfer.files ?? []);
  if (!providedFiles.length) for (const item of Array.from(transfer.items ?? [])) {const file=item.kind==="file"?item.getAsFile():null;if(file)providedFiles.push(file);}
  const files = providedFiles.filter(f => f.type.startsWith("image/") || /\.(png|gif|jpe?g|webp|bmp|ppm)$/i.test(f.name));
  const html = transfer.getData("text/html").slice(0, 256 * 1024);
  // Template content stays inert, including image/iframe resource loading.
  // Parse only for metadata; copied markup never enters the live document.
  const markup = document.createElement("template");
  markup.innerHTML = html;
  const src = markup.content.querySelector("img")?.getAttribute("src");
  const uri = transfer.getData("text/uri-list").split(/\r?\n/).find(line => line && !line.startsWith("#"));
  const plain = transfer.getData("text/plain").trim();
  const url = [src, uri, /\.(png|gif|jpe?g|webp|bmp)(?:[?#]|$)/i.test(plain) ? plain : null].find(s => s?.startsWith("https://") && s.length <= 8192);
  // Prefer the original browser image, including extensionless CDN URLs.
  // A flattened PNG cannot tell us whether the original was animated. Retain
  // an explicitly supplied animation file; otherwise never silently flatten.
  const animationFile = files.some(f => f.type === "image/gif" || /\.(gif|webp|apng)$/i.test(f.name));
  if (url && !animationFile) {
    try {
      const path = new URL(url).pathname.split("/").pop() || "imagem_web";
      let name = path;
      try { name = decodeURIComponent(path); } catch { /* Retain malformed percent escapes as a safe display name. */ }
      return [{ url, name }];
    } catch { return files; }
  }
  if (src?.startsWith("data:image/")) {
    const match=src.match(/^data:image\/(png|gif|webp|bmp|jpe?g);base64,([a-z0-9+/=\s]+)$/i);
    if(match)try{const raw=atob(match[2]);return [new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],`imagem_colada.${match[1]}`,{type:`image/${match[1]}`})];}catch{/* Keep an available raster file if embedded data is malformed. */}
  }
  if (!files.length) {
    const local = transfer.getData("text/uri-list") || plain;
    const paths: ImageInput[] = [];
    for (const line of local.split(/\r?\n/).slice(0,16)) {
      if (!/^file:\/\//i.test(line)) continue;
      try {
        const parsed = new URL(line);
        if (parsed.hostname && parsed.hostname !== "localhost") continue;
        let path = decodeURIComponent(parsed.pathname);
        if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
        if (/\.(png|gif|jpe?g|webp|bmp|ppm)$/i.test(path)) paths.push({ path, name: path.split(/[\\/]/).pop() });
      } catch { /* A malformed file URI must not break ordinary paste. */ }
    }
    if (paths.length) return paths;
  }
  return files;
}

export function editableImageTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input,textarea,[contenteditable='true'],[role='textbox']"));
}

export function prepareImage(projectRoot: string, input: ImageInput, role?: ImageRole, background = "auto", conversion?: PixelConversion): Promise<PreparedImage> {
  return invoke<PreparedImage>("art_ingest_input", { projectRoot, input, role: role ?? null, background, ...(conversion ? { conversion } : {}) });
}

export async function captureClipboardImage(projectRoot:string):Promise<PreparedImage|null> {
  const capture=await invoke<{image:PreparedImage|null;html:string|null}>("art_ingest_clipboard",{projectRoot});
  if (!capture) return null;
  if(capture.html){
    const sources=imageTransferSources({files:[],items:[],getData:(type:string)=>type==="text/html"?capture.html??"":""} as unknown as DataTransfer);
    const source=sources[0];
    if(source)return prepareImage(projectRoot,source instanceof File?await imageFileInput(source):source);
  }
  return capture.image;
}

/** SGDK timers are bytes. Split long holds into occurrences of the same source
 * frame instead of wrapping their delay or duplicating the source PNG pixels. */
export function pixelDocAnimation(doc: PixelDoc): AnimationDef {
  const frames: number[] = [], frame_durations: number[] = [];
  doc.frames.forEach((frame, index) => {
    let ticks = Math.max(1, Math.round(frame.durationMs * 60 / 1000));
    while (ticks > 0) {
      frames.push(index); frame_durations.push(Math.min(ticks, 255)); ticks -= 255;
      if (frames.length > 255) throw new Error("A animação excede 255 ocorrências no Mega Drive. O original foi preservado; use uma versão com menos quadros ou menor duração.");
    }
  });
  return { frames, frame_durations, fps: Math.max(1, Math.min(60, Math.round(1000 / doc.frames[0].durationMs))), loop: true };
}

export async function publishImage(projectDir: string, prepared: PreparedImage, role: ImageRole, scene: Scene, position?: { x: number; y: number }): Promise<ImageCandidate> {
  if (!prepared.doc_json) throw new Error("A conversão da imagem não foi concluída.");
  const doc = deserializePixelDoc(prepared.doc_json);
  const animation = role === "sprite" ? pixelDocAnimation(doc) : undefined;
  doc.name = `${prepared.name}_${crypto.randomUUID().replace(/-/g, "")}`;
  const exported = await exportSheetPng(doc);
  const saved = await savePixelArtAsset(projectDir, doc.name, exported.png, serializePixelDoc(doc));
  const common = { assetPath: saved.png_relative, existingEntityIds: scene.entities.map(e => e.entity_id), suggestedName: prepared.name, ...position };
  const entity = role === "background" ? createTilemapEntityFromAsset({ ...common, mapWidth: doc.width / 8, mapHeight: doc.height / 8 })
    : createSpriteEntityFromAsset({ ...common, target: "megadrive", includeStarterLogic: scene.entities.length === 0 && scene.background_layers.length === 0 });
  if (entity.components.tilemap) entity.components.tilemap.cells = Array.from({length: doc.width * doc.height / 64}, (_, i) => i + 1);
  if (entity.components.sprite) entity.components.sprite = {
    ...entity.components.sprite, frame_width: doc.width, frame_height: doc.height, meta_sprite: doc.width > 32 || doc.height > 32,
    animations: { idle: animation! },
  };
  entity.components.logic = { ...entity.components.logic, logic_hints: [...(entity.components.logic?.logic_hints ?? []), `pixel_art:document=${saved.doc_relative}`, ...(prepared.source_relative ? [`art_ingress:original=${prepared.source_relative}`] : [])] };
  return { entity, doc, assetPath: saved.png_relative, prepared };
}

export function applyImageEdits(scene: Scene, id: string, asset: string, doc: PixelDoc): Scene {
  const animation = doc.target === "sprite" ? pixelDocAnimation(doc) : undefined;
  const oldEntity = scene.entities.find(e => e.entity_id === id);
  if (!oldEntity) return scene;
  const assetOf = (e: Entity) => e.components.sprite?.asset ?? e.components.tilemap?.tileset;
  const previousAsset = assetOf(oldEntity);
  const affected = new Set(scene.entities.filter(e => e.entity_id === id || (asset === previousAsset && assetOf(e) === previousAsset)).map(e => e.entity_id));
  const colors = doc.palettes[buildSheetIndices(doc).line].map((c, i) => i ? mdColorToCss(c) : "");
  return { ...scene,
    palettes: scene.palettes?.map(p => {
      if (!p.id || !p.uses?.some(use => affected.has(use))) return p;
      const retained = p.uses.filter(use => !affected.has(use));
      // A copied/edited image must not recolor unrelated users of a shared
      // explicit palette. Its own PNG becomes the planner's palette source.
      return retained.length ? { ...p, uses: retained } : { ...p, colors };
    }),
    entities: scene.entities.map(entity => {
      if (entity.entity_id !== id) return entity;
      const sprite = entity.components.sprite, tilemap = entity.components.tilemap;
      const mounted = tilemap && tilemap.cells?.every((cell,i) => cell === i + 1);
      return { ...entity, components: { ...entity.components,
        ...(sprite ? { sprite: { ...sprite, asset, frame_width: doc.width, frame_height: doc.height, meta_sprite: doc.width > 32 || doc.height > 32,
          animations: { ...sprite.animations, idle: { ...animation!, loop: sprite.animations?.idle?.loop ?? true } } } } : {}),
        ...(tilemap ? { tilemap: { ...tilemap, tileset: asset, ...(mounted ? { map_width: doc.width / 8, map_height: doc.height / 8, cells: Array.from({length: doc.width * doc.height / 64}, (_,i) => i+1) } : {}) } } : {}),
      } };
    }),
  };
}

export function replaceImageBank(scene: Scene, candidate: ImageCandidate, plan: PalettePlan, bank: number): PaletteEntry[] {
  const affected = new Set(plan.resources.filter(r => r.bank === bank).flatMap(r => r.uses.map(u => u.entity_id)));
  affected.add(candidate.entity.entity_id);
  const palettes = structuredClone(scene.palettes ?? []).map(p => ({ ...p, uses: p.uses?.filter(id => !affected.has(id)) }));
  // Free old reservations in the chosen bank; preserve the palette itself in
  // the project so Undo and other scenes keep their original resource.
  for (const p of palettes) if (p.bank === bank) delete p.bank;
  palettes.push({ id: `imagem:${candidate.entity.entity_id}`, name: `${candidate.prepared.name} · cores`, slot: bank, bank,
    origin: "autoral", colors: candidate.doc.palettes[buildSheetIndices(candidate.doc).line].map((c, i) => i ? mdColorToCss(c) : ""), uses: [...affected] });
  return palettes;
}

export function insertImageEntity(entities: Entity[], entity: Entity): Entity[] {
  const index = entity.components.tilemap ? entities.findIndex(e => e.components.sprite) : -1;
  return index < 0 ? [...entities, entity] : [...entities.slice(0,index), entity, ...entities.slice(index)];
}

export async function proposeImage(projectDir: string, scene: Scene, candidate: ImageCandidate, bank?: number): Promise<{ scene: Scene; before: PalettePlan; plan: PalettePlan; errors: string[] }> {
  const before = await fetchPalettePlan(projectDir, scene);
  const palettes = bank === undefined ? scene.palettes : replaceImageBank(scene, candidate, before, bank);
  const proposal = { ...scene, palettes, entities: insertImageEntity(scene.entities,candidate.entity) };
  const plan = await fetchPalettePlan(projectDir, proposal);
  return { scene: proposal, before, plan, errors: newErrors(before, plan).map(d => d.message) };
}
