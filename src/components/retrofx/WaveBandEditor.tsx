import { useEffect, useMemo, useRef, useState } from "react";
import type { RetroFXWaveBand, TilemapComponent } from "../../core/ipc/sceneService";
import { entityEditLock, entityLockScopeKey, resolvedTilemapPlanes } from "../../core/sceneComposition";
import { persistActiveScene } from "../../core/scenePersistence";
import { useEditorStore } from "../../core/store/editorStore";
import { getTilemapArtwork, loadSceneArtworkAsset } from "../viewport/sceneArtworkRenderer";

const screen = { width: 320, height: 224 };
const fields = [
  { key: "first_line", label: "Primeira linha", min: 0, max: 223 },
  { key: "last_line", label: "Última linha", min: 0, max: 223 },
  { key: "amplitude", label: "Amplitude (px)", min: 1, max: 24 },
  { key: "wavelength", label: "Comprimento (linhas)", min: 8, max: 224 },
  { key: "speed", label: "Passos de fase por tick", min: -32, max: 32 },
  { key: "phase", label: "Fase inicial", min: 0, max: 255 },
] as const;
const buttonClass = "rounded border border-[var(--rds-border-default)] px-2 py-1 disabled:opacity-40";
const selectClass = "min-w-16 rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-inset)] p-1";

export default function WaveBandEditor() {
  const project = useEditorStore((state) => state.activeProjectDir);
  const scenePath = useEditorStore((state) => state.activeScenePath);
  const scene = useEditorStore((state) => state.activeScene);
  const selected = useEditorStore((state) => state.selectedEntityId);
  const wave = scene?.retrofx?.wave ?? null;
  const planes = useMemo(() => resolvedTilemapPlanes(scene?.entities ?? []).filter(({ plane }) => plane !== "WINDOW"), [scene]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [artwork, setArtwork] = useState<{ id: string; x: number; y: number; image: HTMLCanvasElement }[]>([]);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const entities = scene?.entities;
  const legacyFx = scene?.retrofx?.parallax_layers.some(({ enabled }) => enabled) || scene?.retrofx?.raster_lines.some(({ enabled }) => enabled);

  useEffect(() => {
    let cancelled = false;
    setArtwork([]);
    if (project && entities) {
      const maps = resolvedTilemapPlanes(entities).filter(({ plane }) => plane !== "WINDOW")
        .sort((a, b) => Number(b.plane === "BG_B") - Number(a.plane === "BG_B"));
      void Promise.all(maps.map(async ({ entityId }) => {
        const entity = entities.find(item => item.entity_id === entityId)!;
        const map: TilemapComponent = entity.components.tilemap!;
        const asset = await loadSceneArtworkAsset(project, map.tileset);
        const image = getTilemapArtwork(asset, map);
        return image ? [{ id: entityId, x: entity.transform.x, y: entity.transform.y, image }] : [];
      })).then(layers => { if (!cancelled) setArtwork(layers.flat()); })
        .catch(() => { if (!cancelled) setMessage("Abra um cenário com arte disponível para ver a faixa."); });
    }
    return () => { cancelled = true; };
  }, [entities, project]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !wave) return;
    const top = drag ? Math.min(...drag) : wave.first_line;
    const bottom = drag ? Math.max(...drag) : wave.last_line;
    let frame = 0;
    let start: number | null = null;
    let previousTick = -1;
    const draw = (now: number) => {
      start ??= now;
      const tick = Math.max(0, Math.floor((now - start) / 32));
      if (tick !== previousTick) {
        context.clearRect(0, 0, screen.width, screen.height);
        context.imageSmoothingEnabled = false;
        for (const { id, image, x, y } of artwork) {
          if (original || id !== wave.entity_id) {
            context.drawImage(image, x, y);
            continue;
          }
          for (let line = Math.max(0, y); line < Math.min(y + image.height, screen.height); line += 1) {
            const offset = line < top || line > bottom ? 0 : Math.round(wave.amplitude * Math.sin(
              (((wave.phase + tick * wave.speed + Math.floor((line - top) * 256 / wave.wavelength)) & 255) >> 3) * Math.PI / 16));
            context.drawImage(image, 0, line - y, image.width, 1, x + offset, line, image.width, 1);
          }
        }
        context.fillStyle = "#45eed728";
        context.fillRect(0, top, screen.width, bottom - top + 1);
        context.fillStyle = "#99f6e4";
        context.fillRect(0, top, screen.width, 1);
        context.fillRect(0, bottom, screen.width, 1);
        previousTick = tick;
      }
      if (playing) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [artwork, drag, original, playing, wave]);

  function apply(value: RetroFXWaveBand | null) {
    const state = useEditorStore.getState();
    if (state.activeProjectDir !== project || state.activeScenePath !== scenePath || !state.activeScene
        || state.activeScene.retrofx?.wave !== scene?.retrofx?.wave || state.pendingHistorySnapshot) return;
    const entity = value?.entity_id ?? wave?.entity_id;
    if ((entity && entityEditLock(entity, scene?.layers, state.lockedEntityIdsByScene[entityLockScopeKey(project, scenePath)] ?? []).locked)
        || (value && (!planes.some(({ entityId }) => entityId === entity) || value.first_line > value.last_line))) {
      setMessage("Escolha um plano desbloqueado e uma faixa com início menor ou igual ao fim.");
      return;
    }
    if (JSON.stringify(wave) === JSON.stringify(value)) return;
    const src = state.activeSceneSource ?? state.activeScene;
    const next = { parallax_layers: [], raster_lines: [], ...src.retrofx, wave: value };
    state.beginHistoryCapture();
    useEditorStore.setState({ activeScene: { ...state.activeScene, retrofx: next }, activeSceneSource: { ...src, retrofx: next }, sceneRevision: state.sceneRevision + 1 });
    state.commitHistoryCapture();
    setMessage("");
  }

  const add = () => {
    const plane = planes.find(({ entityId }) => entityId === selected) ?? planes[0];
    if (plane) apply({ entity_id: plane.entityId, first_line: 128, last_line: 151, amplitude: 4, wavelength: 24, speed: 4, phase: 0 });
  };
  const lineAt = (element: HTMLCanvasElement, y: number) => {
    const bounds = element.getBoundingClientRect();
    return Math.min(screen.height - 1, Math.max(0, Math.floor((y - bounds.top) * screen.height / bounds.height)));
  };
  async function save() {
    if (!project || loading) return;
    setLoading(true);
    try {
      setMessage(await persistActiveScene(project, "Ondular") ? "Faixa salva." : "A faixa continua aberta na cena.");
    } catch {
      setMessage("A faixa continua aberta na cena. Use Salvar para gravar.");
    } finally {
      setLoading(false);
    }
  }

  return <section data-testid="retrofx-wave-editor" className="min-h-0 flex-1 space-y-3 overflow-auto bg-[var(--rds-surface-panel)] p-4 text-[var(--rds-text-primary)]">
    <p className="text-sm font-semibold">Ondular <span className="text-[var(--rds-text-secondary)]">Experimental</span></p>
    <p className="text-xs">Cada linha move o plano inteiro na horizontal. O outro plano, os sprites e o HUD mantêm seus deslocamentos. Até 896 B por quadro para as duas tabelas.</p>
    {wave && <p className="text-xs">Velocidade zero mantém a fase. Use um valor negativo para inverter o sentido de avanço.</p>}
    {legacyFx && <p role="status">Desligue Raster e Parallax legados antes de exportar. A paralaxe da câmera visual pode continuar ativa.</p>}
    {!wave && <button type="button" className="rds-button rds-button--primary" disabled={!planes.length} onClick={() => { setOriginal(false); add(); }}>Criar faixa</button>}
    {wave && <div className="grid gap-2 text-xs lg:grid-cols-[minmax(250px,420px)_1fr]">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <button type="button" className={buttonClass} aria-pressed={original} onClick={() => setOriginal(true)}>Antes</button>
          <button type="button" className={buttonClass} aria-pressed={!original} onClick={() => setOriginal(false)}>Com onda</button>
          <strong>{wave.entity_id} · linhas {wave.first_line}–{wave.last_line}</strong>
        </div>
        <canvas ref={canvas} width={screen.width} height={screen.height} role="img" tabIndex={0} data-testid="retrofx-wave-canvas"
          aria-label="Vista da faixa de scroll horizontal nas linhas da tela" className="w-full touch-none bg-[var(--rds-surface-inset)] [image-rendering:pixelated]"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const line = lineAt(event.currentTarget, event.clientY);
            setDrag([line, line]);
          }} onPointerMove={(event) => {
            if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            setDrag([drag[0], lineAt(event.currentTarget, event.clientY)]);
          }} onPointerUp={(event) => {
            if (!drag) return;
            const end = lineAt(event.currentTarget, event.clientY);
            apply({ ...wave, first_line: Math.min(drag[0], end), last_line: Math.max(drag[0], end) });
            setDrag(null);
          }} onPointerCancel={() => setDrag(null)} onKeyDown={(event) => { if (event.key === "Escape") setDrag(null); }} />
        <p>Arraste para marcar as linhas. Os campos também aceitam a faixa exata.</p>
        <button type="button" className={buttonClass} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? "Voltar à fase inicial" : "Animar prévia"}</button>
      </div>
      <div className="space-y-2">
        <form key={JSON.stringify(wave)} className="grid max-w-[360px] gap-2" onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          const value = { ...wave, entity_id: String(input.get("plane")) };
          for (const { key } of fields) value[key] = Number(input.get(key));
          apply(value);
        }}>
          <label>Plano <select name="plane" defaultValue={wave.entity_id} className={selectClass}>
            {planes.map(({ entityId, plane }) => <option key={entityId} value={entityId}>{plane} · {entityId}</option>)}
          </select></label>
          {fields.map(({ key, label, min, max }) => <label className="flex justify-between gap-2" key={key}>{label}
            <input type="number" required name={key} defaultValue={wave[key]} min={min} max={max} className={`${selectClass} w-24`} />
          </label>)}
          <button type="submit" className={buttonClass}>Aplicar valores</button>
        </form>
        <button type="button" className={buttonClass} onClick={() => apply(null)}>Remover faixa</button>
      </div>
    </div>}
    <button type="button" className={buttonClass} disabled={!project || loading} onClick={() => void save()}>Salvar RetroFX</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
