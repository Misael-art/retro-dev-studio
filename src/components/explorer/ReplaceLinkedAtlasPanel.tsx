import { useEffect, useRef, useState } from "react";

import AssetPreview from "../common/AssetPreview";
import { atlasUses, replaceLinkedAtlas } from "../../core/imageIngress";
import { loadPixelArtDoc } from "../../core/ipc/artStudioService";
import type { Entity, Scene } from "../../core/ipc/sceneService";
import type { ProjectAssetEntry } from "../../core/ipc/toolsService";
import { fetchPalettePlan, newErrors, type PalettePlan } from "../../core/palettePlan";
import { palettePlanContextKey } from "../../core/palettePlanStore";
import { deserializePixelDoc, type PixelDoc } from "../../core/pixelEditor";
import { persistActiveScene } from "../../core/scenePersistence";
import { useEditorStore } from "../../core/store/editorStore";

const atlasPattern = /^assets\/sprites\/pixel\/[^/]+\.png$/i;
const documentFor = (asset: string) => asset.replace(/\.png$/i, ".rdspixel.json");
const control = "rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-base)] px-2 py-1 disabled:opacity-40";
const selectControl = `${control} block w-full min-w-0 truncate`;

type Atlases = {
  old: PixelDoc;
  next: PixelDoc;
  source: readonly [string, string];
};
type Comparison = {
  scene: Scene;
  before: PalettePlan;
  after: PalettePlan;
  notes: string[];
};

export default function ReplaceLinkedAtlasPanel({ projectDir, asset, assets, scene, chosen }: {
  projectDir: string;
  asset: string;
  assets: ProjectAssetEntry[];
  scene: Scene;
  chosen?: string;
}) {
  const [scope, setScope] = useState<"instance" | "scene">("instance");
  const [nextAsset, setNextAsset] = useState("");
  const [atlases, setAtlases] = useState<Atlases | null>(null);
  const [mapping, setMapping] = useState<Record<number, number>>({});
  const [compared, setCompared] = useState<Comparison | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const context = useEditorStore(palettePlanContextKey);
  const candidates = assets.filter((item) => item.relative_path !== asset && item.kind === "image" && atlasPattern.test(item.relative_path));
  const allOwners = scene.entities.filter((entity) => entity.components.sprite?.asset === asset);
  const owners = scope === "scene" ? allOwners : allOwners.filter((entity) => entity.entity_id === chosen);
  const required = atlasUses(owners);
  const distinct = new Set(required.map((frame) => mapping[frame])).size === required.length;
  const complete = distinct && required.every((frame) => mapping[frame] != null && mapping[frame] >= 0);
  const actorName = (entity: Entity) => entity.display_name ? `${entity.display_name} (${entity.entity_id})` : entity.entity_id;
  if (!atlasPattern.test(asset) || !allOwners.length) return null;

  const reset = () => {
    request.current++;
    setAtlases(null);
    setMapping({});
    setCompared(null);
    setMessage("");
    setBusy(false);
  };
  const showError = (error: unknown) => setMessage(error instanceof Error ? error.message : String(error));
  const current = (id: number) => request.current === id && palettePlanContextKey(useEditorStore.getState()) === context;
  const load = async () => {
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      if (!required.length) throw new Error("Escolha um objeto com animações vinculadas ao atlas.");
      const source = await Promise.all([asset, nextAsset].map((path) => loadPixelArtDoc(projectDir, documentFor(path))));
      if (!current(id)) return;
      const [old, next] = source.map(deserializePixelDoc);
      if (old.target !== "sprite" || next.target !== "sprite" || old.width !== next.width || old.height !== next.height
          || owners.some(({ components: { sprite } }) => !sprite || sprite.frame_width !== old.width || sprite.frame_height !== old.height)) {
        throw new Error("Use atlas de sprite com o mesmo tamanho por quadro para manter pivôs e caixas.");
      }
      const entries = required.flatMap((index) => {
        const id = old.frames[index]?.id;
        const matches = next.frames.flatMap((frame, at) => frame.id === id ? [at] : []);
        return matches.length === 1 && old.frames.filter((frame) => frame.id === id).length === 1 ? [[index, matches[0]]] : [];
      });
      setMapping(Object.fromEntries(entries));
      setAtlases({ old, next, source: [source[0], source[1]] });
    } catch (error) {
      if (current(id)) showError(error);
    } finally {
      if (request.current === id) setBusy(false);
    }
  };
  const compare = async () => {
    if (!atlases || !complete) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      const proposed = replaceLinkedAtlas(scene, owners.map(({ entity_id }) => entity_id), nextAsset,
        new Map(required.map((frame) => [frame, mapping[frame]])), documentFor(nextAsset), atlases.next.originalSource);
      const [before, after] = await Promise.all([scene, proposed].map((value) => fetchPalettePlan(projectDir, value)));
      if (current(id)) setCompared({ scene: proposed, before, after, notes: newErrors(before, after).map(({ message }) => message) });
    } catch (error) {
      if (current(id)) showError(error);
    } finally {
      if (request.current === id) setBusy(false);
    }
  };
  const apply = async () => {
    if (!compared || !atlases || compared.notes.length) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      const authors = await Promise.all([asset, nextAsset].map((path) => loadPixelArtDoc(projectDir, documentFor(path))));
      if (!current(id)) return;
      const store = useEditorStore.getState();
      if (store.pendingHistorySnapshot) throw new Error("Conclua a edição em andamento antes de trocar o atlas.");
      if (authors.some((document, index) => document !== atlases.source[index])) throw new Error("Um atlas mudou. Confira a correspondência novamente.");
      store.beginHistoryCapture();
      for (const owner of owners) {
        const entity = compared.scene.entities.find(({ entity_id }) => entity_id === owner.entity_id)!;
        store.updateEntity(owner.entity_id, {
          components: { sprite: entity.components.sprite, logic: entity.components.logic },
        }, { recordHistory: false });
      }
      store.commitHistoryCapture();
      setCompared(null);
      setAtlases(null);
      setMapping({});
      const persisted = await persistActiveScene(projectDir, "Atlas");
      if (request.current === id) setMessage(persisted ? "Atlas vinculado. Desfazer recupera o anterior." : "Atlas vinculado na sessão. Use Salvar para gravar a fase.");
    } catch (error) {
      if (request.current === id) showError(error);
    } finally {
      if (request.current === id) setBusy(false);
    }
  };

  return (
    <details data-testid="explorer-replace-atlas" className="mt-3 min-w-0 rounded border border-[var(--rds-border-subtle)] p-3 text-xs"
      onToggle={(event) => { if (!event.currentTarget.open) reset(); }}>
      <summary className="cursor-pointer font-semibold">Substituir atlas mantendo vínculos</summary>
      <div className="mt-2 grid gap-2">
        <label>Alcance <select className={selectControl} value={scope} disabled={busy} onChange={(event) => {
          reset();
          setScope(event.target.value === "scene" ? "scene" : "instance");
        }}>
          <option value="instance">Instância selecionada</option>
          <option value="scene">Usos de sprite desta fase</option>
        </select></label>
        <p>{owners.length ? `Objetos afetados: ${owners.map(actorName).join(", ")}.` : "Escolha uma instância no cartão do atlas."}</p>
        <label>Atlas de destino <select data-testid="explorer-atlas-destination" className={selectControl} value={nextAsset} disabled={busy}
          onChange={(event) => { reset(); setNextAsset(event.target.value); }}>
          <option value="">Escolher atlas de pixels do projeto</option>
          {candidates.map((item) => <option key={item.relative_path} value={item.relative_path}>{item.relative_path}</option>)}
        </select></label>
        {!atlases && <button type="button" data-testid="explorer-atlas-load" className={control} disabled={busy || !owners.length || !nextAsset}
          onClick={() => void load()}>Conferir quadros</button>}
        {atlases && <>
          <p>Escolha um quadro de destino distinto para cada imagem usada.</p>
          {required.map((frame) => <label key={frame}>Imagem {frame + 1} → <select data-testid={`explorer-atlas-map-${frame}`} className={selectControl} value={mapping[frame] ?? -1} disabled={busy}
            onChange={(event) => { setMapping({ ...mapping, [frame]: Number(event.target.value) }); setCompared(null); }}>
            <option value={-1}>Escolher correspondência</option>
            {atlases.next.frames.map((image, index) => <option value={index} key={index}>Imagem {index + 1} · {image.id}</option>)}
          </select></label>)}
          {!compared && <button type="button" data-testid="explorer-atlas-compare" className={control} disabled={busy || !complete}
            onClick={() => void compare()}>Comparar paletas e vínculos</button>}
        </>}
        {atlases && <div className="grid grid-cols-2 gap-2">
          {[[asset, "Atlas atual", atlases.old.frames.length], [nextAsset, "Substituição", atlases.next.frames.length]].map(([file, label, count]) =>
            <figure key={file} className="min-w-0 rounded border p-1">
              <figcaption>{label} · {count} quadros</figcaption>
              <AssetPreview projectDir={projectDir} relativePath={String(file)} alt={String(label)}
                imageClassName="mx-auto h-16 max-w-full object-contain" fallbackClassName="h-16" pixelated />
            </figure>)}
        </div>}
        {compared && <div className="grid gap-2">
          <p>Cena afetada · {scene.display_name ?? scene.scene_id}</p>
          <ul>{owners.map((owner) => {
            const sprite = owner.components.sprite;
            const boxes = Object.values(sprite?.animations ?? {}).reduce((total, animation) => total + (animation.hitboxes?.length ?? 0), 0);
            return <li key={owner.entity_id}>
              {actorName(owner)} · banco {compared.before.entity_banks[owner.entity_id] ?? "—"} → {compared.after.entity_banks[owner.entity_id] ?? "—"}
              {sprite?.pivot ? ` · pivô (${sprite.pivot.x}, ${sprite.pivot.y}) preservado` : " · pivô padrão"}
              {` · ${boxes} caixas com coordenadas preservadas`}
            </li>;
          })}</ul>
          {compared.notes.length > 0 && <p role="alert">{compared.notes.join(" ")}</p>}
          <button type="button" data-testid="explorer-atlas-apply" className={control} disabled={busy || compared.notes.length > 0}
            onClick={() => void apply()}>Confirmar substituição</button>
          <button type="button" data-testid="explorer-atlas-cancel" className={control} disabled={busy} onClick={reset}>Cancelar</button>
        </div>}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
