import { useEffect, useRef, useState } from "react";
import type { TilemapComponent } from "../../core/ipc/sceneService";
import { entityEditLock, entityLockScopeKey } from "../../core/sceneComposition";
import { persistActiveScene } from "../../core/scenePersistence";
import { useEditorStore } from "../../core/store/editorStore";
import { isExplicitEmptyCell } from "../../core/tilemapCells";
import { drawRepeatedAsset, getTilemapArtwork, loadSceneArtworkAsset, type ViewportAssetCacheEntry } from "../viewport/sceneArtworkRenderer";

const maxTiles = 64;
const axes = ["x", "y", "width", "height"] as const;
const labels = ["Coluna inicial", "Linha inicial", "Largura em tiles", "Altura em tiles"];
const inputClass = "w-14 rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-default)] px-1";
const buttonClass = "rounded border border-[var(--rds-border-default)] px-2 py-1 disabled:opacity-40";

function wrappedPixel(value: number, size: number) {
  return Math.floor(((value % size) + size) % size);
}

export default function TileSeamPreview({ project, entityId, map, tileCount, onLocate }: {
  project: string; entityId: string; map: TilemapComponent; tileCount: number; onLocate: (index: number) => void;
}) {
  const [area, setArea] = useState({ x: 0, y: 0, width: Math.min(maxTiles, map.map_width), height: Math.min(maxTiles, map.map_height) });
  const [selected, setSelected] = useState<{ col: number; row: number; edge: string } | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [asset, setAsset] = useState<ViewportAssetCacheEntry | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const scenePath = useEditorStore((state) => state.activeScenePath);
  const locked = useEditorStore((state) => entityEditLock(entityId, state.activeScene?.layers,
    state.lockedEntityIdsByScene[entityLockScopeKey(project, state.activeScenePath)] ?? []).locked);
  const width = area.width * 8, height = area.height * 8;
  const shrink = Math.min(1, 320 / (width * 3), 220 / (height * 3));
  const cell = selected ? map.cells?.[selected.row * map.map_width + selected.col] ?? 0 : 0;

  useEffect(() => {
    let cancelled = false;
    void loadSceneArtworkAsset(project, map.tileset).then((image) => {
      if (!cancelled) setAsset(image);
    }).catch(() => { if (!cancelled) setMessage("A arte do plano não pôde ser aberta."); });
    return () => { cancelled = true; };
  }, [map.tileset, project]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    const source = asset ? getTilemapArtwork(asset, map) : null;
    if (!context || !source) return;
    const patch = document.createElement("canvas");
    patch.width = width;
    patch.height = height;
    patch.getContext("2d")?.drawImage(source, -area.x * 8, -area.y * 8);
    const patchAsset: ViewportAssetCacheEntry = { status: "loaded", source: patch, width, height };
    let frame = 0;
    const draw = (time: number) => {
      const x = scrolling ? wrappedPixel(time / 42, width) : 0;
      const y = scrolling ? wrappedPixel(time / 65, height) : 0;
      offset.current = { x, y };
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.save();
      context.scale(context.canvas.width / (width * 3), context.canvas.height / (height * 3));
      context.imageSmoothingEnabled = false;
      drawRepeatedAsset(context, patchAsset, 0, 0, width * 3, height * 3, x, y);
      if (!scrolling) {
        context.strokeStyle = "#99f6e4";
        context.lineWidth = 1 / shrink;
        context.strokeRect(width, height, width, height);
      }
      context.restore();
      if (scrolling) frame = requestAnimationFrame(draw);
    };
    draw(0);
    return () => cancelAnimationFrame(frame);
  }, [area.x, area.y, asset, height, map, scrolling, shrink, width]);

  async function applyCell(value: number) {
    const state = useEditorStore.getState();
    if (!selected || !Number.isInteger(value) || value < 0 || value > tileCount || saving
        || state.activeProjectDir !== project || state.activeScenePath !== scenePath || state.pendingHistorySnapshot
        || entityEditLock(entityId, state.activeScene?.layers, state.lockedEntityIdsByScene[entityLockScopeKey(project, scenePath)] ?? []).locked) return;
    state.beginHistoryCapture();
    state.paintTilemapCell(entityId, selected.col, selected.row, value);
    if (useEditorStore.getState().sceneRevision === state.sceneRevision) {
      state.cancelHistoryCapture();
      setMessage("A célula já tem esse valor.");
      return;
    }
    state.commitHistoryCapture();
    setSaving(true);
    try {
      setMessage(await persistActiveScene(project, "Emenda") ? "Célula salva." : "Célula alterada na cena. Use Salvar para gravá-la.");
    } catch {
      setMessage("Célula alterada na cena. Use Salvar para gravá-la.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mt-2 grid gap-2">
    <form key={`${area.x},${area.y},${area.width},${area.height}`} data-testid="tile-seam-area" className="flex flex-wrap items-end gap-1" onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const x = Number(values.get("x")), y = Number(values.get("y"));
      const width = Number(values.get("width")), height = Number(values.get("height"));
      if (x + width > map.map_width || y + height > map.map_height) {
        setMessage("O trecho precisa caber no mapa.");
        return;
      }
      setArea({ x, y, width, height });
      setSelected(null);
      setMessage("");
    }}>
      {axes.map((axis, index) => <label key={axis} className="flex flex-col">{labels[index]}
        <input className={inputClass} type="number" name={axis} required defaultValue={area[axis]}
          min={index < 2 ? 0 : 1} max={[map.map_width - 1, map.map_height - 1, maxTiles, maxTiles][index]} />
      </label>)}
      <button type="submit" data-testid="tile-seam-repeat" className={buttonClass}>Repetir trecho</button>
    </form>
    <button type="button" data-testid="tile-seam-scroll" className={buttonClass} aria-pressed={scrolling} onClick={() => setScrolling((before) => !before)}>
      {scrolling ? "Voltar à grade 3 × 3" : "Rolar emenda"}
    </button>
    <canvas ref={canvas} data-testid="tile-seam-canvas" role="img" aria-label="O trecho do mapa repetido por três linhas e três colunas"
      width={Math.max(1, Math.round(width * 3 * shrink))} height={Math.max(1, Math.round(height * 3 * shrink))}
      className="max-w-full cursor-crosshair bg-[var(--rds-surface-inset)] [image-rendering:pixelated]" onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = wrappedPixel((event.clientX - bounds.left) * width * 3 / bounds.width + offset.current.x, width);
        const y = wrappedPixel((event.clientY - bounds.top) * height * 3 / bounds.height + offset.current.y, height);
        const edge = [x === 0 ? "esquerda" : x === width - 1 ? "direita" : "", y === 0 ? "superior" : y === height - 1 ? "inferior" : ""].filter(Boolean).join(" e ");
        setSelected({ col: area.x + Math.floor(x / 8), row: area.y + Math.floor(y / 8), edge });
        setMessage("");
      }} />
    <form className="flex flex-wrap items-end gap-1" onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setSelected({ col: Number(values.get("col")), row: Number(values.get("row")), edge: "" });
      setMessage("");
    }}>
      <label className="flex flex-col">Coluna do mapa<input className={inputClass} name="col" type="number" min={0} max={map.map_width - 1} required defaultValue={0} /></label>
      <label className="flex flex-col">Linha do mapa<input className={inputClass} name="row" type="number" min={0} max={map.map_height - 1} required defaultValue={0} /></label>
      <button type="submit" className={buttonClass}>Abrir célula</button>
    </form>
    {selected && <div data-testid="tile-seam-source" data-col={selected.col} data-row={selected.row} data-tile={cell}>
      <p>Célula ({selected.col}, {selected.row}){selected.edge && ` · borda ${selected.edge}`} · {isExplicitEmptyCell(cell) ? "vazia" : cell ? `tile #${cell}` : "imagem-base"} · {map.tileset}</p>
      {cell > 0 && cell <= tileCount && <button className={buttonClass} type="button" onClick={() => onLocate(cell)}>Localizar tile na paleta</button>}
      <form key={`${selected.col},${selected.row},${cell}`} className="mt-1 flex flex-wrap items-end gap-1" onSubmit={(event) => {
        event.preventDefault();
        void applyCell(Number(new FormData(event.currentTarget).get("tile")));
      }}>
        <label className="flex flex-col">Tile (0 para base)<input className={inputClass} type="number" name="tile" min={0} max={tileCount} required defaultValue={cell <= tileCount ? cell : 0} /></label>
        <button type="submit" data-testid="tile-seam-apply" className={buttonClass} disabled={locked || saving || tileCount === 0}>Alterar célula</button>
      </form>
      {locked && <p>Desbloqueie o plano para alterar o tile.</p>}
    </div>}
    {message && <p role="status">{message}</p>}
  </div>;
}
