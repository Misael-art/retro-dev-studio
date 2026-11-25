import { useEffect, useMemo, useRef, useState } from "react";

import {
  addOccurrenceBox,
  addSoundEvent,
  alignPoseSupport,
  moveBoxBy,
  removeOccurrenceBox,
  setOccurrenceBox,
  type BoxKind,
  describeOccurrences,
  moveOccurrence,
  occurrenceBoxes,
  removeEvent,
  retimeEventsToFit,
  setOccurrenceDuration,
  totalTicks,
  type TimelineOccurrence,
  type TimelineResult,
} from "../../core/characterTimeline";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { resolveLinkedPixelAsset } from "../../core/entityAuthoring";
import { useCodeFocusStore } from "../../core/codeFocusStore";
import type { AnimationDef, Entity, MugenAnimationFrame, MugenCollisionBox, SpriteComponent, Transform } from "../../core/ipc/sceneService";
import { describeTicks, isMugenAnimation } from "../../core/mugenAnimationTiming";
import { useEditorStore } from "../../core/store/editorStore";
import { useProjectAssetVisualState } from "../../core/useProjectAssetVisualState";
import { chooseAndImportAudio, sfxActionFromPath } from "../../core/audioImport";
import { readProjectAssetBytes } from "../../core/ipc/toolsService";

/** Entidades que usam o mesmo personagem (mesmo asset): a animação MUGEN é do modelo. */
export function modelUsers(entities: Entity[], sprite: SpriteComponent): Entity[] {
  return entities.filter((entity) => entity.components.sprite?.asset === sprite.asset);
}

type SheetGeometry = { width: number; height: number } | null;

const TICK_PIXELS = 12;

function useSheetGeometry(src: string | null): SheetGeometry {
  const [size, setSize] = useState<SheetGeometry>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return src ? size : null;
}

function cellStyle(
  src: string | null,
  sheet: SheetGeometry,
  sprite: SpriteComponent,
  image: number,
  scale: number
): React.CSSProperties {
  if (!src || !sheet) return {};
  const columns = Math.max(1, Math.ceil(sheet.width / sprite.frame_width));
  const col = image % columns;
  const row = Math.floor(image / columns);
  return {
    width: sprite.frame_width * scale,
    height: sprite.frame_height * scale,
    backgroundImage: `url("${src}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
    backgroundPosition: `${-col * sprite.frame_width * scale}px ${-row * sprite.frame_height * scale}px`,
    imageRendering: "pixelated",
  };
}

function boxRect(box: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!box || typeof box !== "object") return null;
  const b = box as Record<string, number>;
  if (![b.x1, b.y1, b.x2, b.y2].every((v) => Number.isFinite(v))) return null;
  return {
    x: Math.min(b.x1, b.x2),
    y: Math.min(b.y1, b.y2),
    w: Math.abs(b.x2 - b.x1),
    h: Math.abs(b.y2 - b.y1),
  };
}

/**
 * Linha do tempo por ocorrência. A autoria Mega Drive edita a instância
 * selecionada. Animações importadas pelo perfil MUGEN editam o modelo.
 */
export default function CharacterTimelinePanel({ entity, authored = false }: { entity: Entity; authored?: boolean }) {
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const activeScene = useEditorStore((state) => state.activeScene);
  const projectFps = useEditorStore((state) => state.projectFps);
  const studio = useEditorStore((state) => state.studio);
  const refineStudioFocus = useEditorStore((state) => state.refineStudioFocus);
  const openStudioEditor = useEditorStore((state) => state.openStudioEditor);
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const beginHistoryCapture = useEditorStore((state) => state.beginHistoryCapture);
  const commitHistoryCapture = useEditorStore((state) => state.commitHistoryCapture);
  const logMessage = useEditorStore((state) => state.logMessage);

  const sprite = entity.components.sprite!;
  const tickRate = authored ? projectFps : 60;
  const animations = useMemo(
    () =>
      Object.entries(sprite.animations ?? {})
        .filter(([, def]) => def.frames.length > 0 && authored !== isMugenAnimation(def))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
    [authored, sprite.animations]
  );
  const focusAnimation =
    studio.focus.entityId === entity.entity_id && studio.focus.animation
      ? studio.focus.animation
      : null;
  const animationName =
    focusAnimation && animations.some(([name]) => name === focusAnimation) ? focusAnimation : animations[0]?.[0] ?? null;
  const def: AnimationDef | null = animationName ? sprite.animations?.[animationName] ?? null : null;
  const occurrences = useMemo(() => (def ? describeOccurrences(def, tickRate) : []), [def, tickRate]);
  const selected =
    occurrences.find((occ) => occ.id === studio.focus.occurrenceId) ?? occurrences[0] ?? null;

  const users = authored ? [entity] : modelUsers(activeScene?.entities ?? [], sprite);
  // Registro de sons é único por ROM: qualquer som do projeto pode ser usado num evento.
  const sfxSources = new Map<string, string>();
  for (const candidate of activeScene?.entities ?? []) {
    for (const [action, path] of Object.entries(candidate.components.audio?.sfx ?? {})) {
      if (path.trim() && !sfxSources.has(action)) sfxSources.set(action, path);
    }
  }
  const sfxNames = [...sfxSources.keys()].sort();

  const { src } = useProjectAssetVisualState({ projectDir: activeProjectDir, relativePath: sprite.asset });
  const sheet = useSheetGeometry(src);

  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [durationPreview, setDurationPreview] = useState<{ id: string; ticks: number } | null>(null);
  const durationDrag = useRef<{ x: number; ticks: number; id: string; revision: number } | null>(null);
  const [aligning, setAligning] = useState(false);
  const [reference, setReference] = useState<{ id: string; anchor: Transform } | null>(null);
  const [anchorDraft, setAnchorDraft] = useState<{ x: string; y: string }>({ x: "", y: "" });
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string; conflicts?: string[] } | null>(null);
  const [eventTick, setEventTick] = useState("0");
  const [eventSound, setEventSound] = useState("");
  const [playing, setPlaying] = useState(false);
  const [pausedPreviewTick, setPausedPreviewTick] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState(() => authored
    ? Math.min(5, Math.max(1, Math.floor(160 / Math.max(sprite.frame_width, sprite.frame_height)))) : 3);
  const [selectedBox, setSelectedBox] = useState<{ kind: BoxKind; index: number } | null>(() => {
    const [kind, index] = studio.focus.boxKey?.split(":") ?? [];
    return (kind === "clsn1" || kind === "clsn2") && /^\d+$/.test(index ?? "") ? { kind, index: Number(index) } : null;
  });
  const [drag, setDrag] = useState<{
    kind: BoxKind;
    index: number;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    original: MugenCollisionBox;
    preview: MugenCollisionBox;
  } | null>(null);
  const [boxDraft, setBoxDraft] = useState<Record<string, string>>({});
  const [onion, setOnion] = useState(false);
  const playTick = useRef(0);
  const [, forceRender] = useState(0);

  // Prévia aproximada nos ticks do projeto, incluindo o último quadro sem repetição.
  useEffect(() => {
    if (!playing || !def) return;
    const end = totalTicks(def, tickRate);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (now: number) => {
      acc += now - last;
      last = now;
      const elapsed = Math.floor(acc / (1000 / tickRate));
      if (elapsed) {
        acc -= elapsed * (1000 / tickRate);
        playTick.current += elapsed;
        if (end !== null && !def.loop && playTick.current >= end) {
          setPausedPreviewTick(end);
          setPlaying(false);
          return;
        }
        forceRender((v) => v + 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, def, tickRate]);

  async function addSound() {
    try {
      const started = useEditorStore.getState();
      const imported = await chooseAndImportAudio(activeProjectDir);
      if (!imported) return;
      const editor = useEditorStore.getState();
      if (editor.projectSessionId !== started.projectSessionId || editor.activeScenePath !== started.activeScenePath
        || editor.selectedEntityId !== entity.entity_id) return;
      const current = editor.activeScene?.entities.find((candidate) => candidate.entity_id === entity.entity_id);
      if (!current) return;
      const action = sfxActionFromPath(imported.relative_path);
      const audio = current.components.audio ?? { sfx: {} };
      updateEntity(entity.entity_id, { components: { audio: { ...audio, sfx: { ...audio.sfx, [action]: imported.relative_path } } } });
      setEventSound(action);
      setMessage({
        tone: "info",
        text: `Som “${action}” adicionado (${imported.relative_path})${imported.report.warnings.length ? ` — ${imported.report.warnings.join("; ")}` : ""}.`,
      });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  async function previewSound(action: string) {
    const path = sfxSources.get(action);
    if (!path) return;
    try {
      const bytes = await readProjectAssetBytes(activeProjectDir, path);
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(new Uint8Array(bytes).buffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => void context.close();
      source.start();
    } catch (cause) {
      setMessage({ tone: "error", text: `Prévia do som falhou: ${cause instanceof Error ? cause.message : String(cause)}` });
    }
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const dx = Math.round((event.clientX - drag.startX) / scale);
      const dy = Math.round((event.clientY - drag.startY) / scale);
      const o = drag.original;
      setDrag((current) =>
        current && {
          ...current,
          preview: current.mode === "move" ? moveBoxBy(o, dx, dy) : { x1: Math.min(o.x1, o.x2), y1: Math.min(o.y1, o.y2), x2: Math.max(o.x1, o.x2) + dx, y2: Math.max(o.y1, o.y2) + dy },
        }
      );
    };
    const onUp = () => {
      const finished = drag;
      setDrag(null);
      if (!finished || !selected) return;
      const p = finished.preview;
      const o = finished.original;
      if (p.x1 === o.x1 && p.y1 === o.y1 && p.x2 === o.x2 && p.y2 === o.y2) return;
      commit(setOccurrenceBox(def!, selected.id, finished.kind, finished.index, p), `caixa ${finished.kind === "clsn1" ? "de ataque" : "de corpo"} ${finished.index + 1} ${finished.mode === "move" ? "movida" : "redimensionada"}`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  function selectAnimation(name: string) {
    setPlaying(false);
    setPausedPreviewTick(null);
    setDurationDraft(null);
    setDurationPreview(null);
    durationDrag.current = null;
    setReference(null);
    setAnchorDraft({ x: "", y: "" });
    setMessage(null);
    refineStudioFocus({ entityId: entity.entity_id, animation: name, occurrenceId: null, eventId: null });
  }

  function selectOccurrence(occ: TimelineOccurrence) {
    setPlaying(false);
    setPausedPreviewTick(null);
    setDurationDraft(null);
    setMessage(null);
    setSelectedBox(null);
    setBoxDraft({});
    setDrag(null);
    setEventTick("0");
    const mark = def?.pose_alignment?.[occ.id]?.anchor;
    setAnchorDraft(mark ? { x: String(mark.x), y: String(mark.y) } : { x: "", y: "" });
    refineStudioFocus({ entityId: entity.entity_id, animation: animationName, occurrenceId: occ.id, boxKey: null, eventId: null });
  }

  /** Aplica a nova animação no alcance mostrado, numa só entrada de desfazer. */
  function commit(result: TimelineResult, description: string): boolean {
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message, conflicts: result.conflicts });
      return false;
    }
    if (!animationName) return false;
    beginHistoryCapture();
    for (const user of users) {
      const userSprite = user.components.sprite!;
      updateEntity(
        user.entity_id,
        { components: { sprite: { ...userSprite, animations: { ...userSprite.animations, [animationName]: result.def } } } },
        { recordHistory: false }
      );
    }
    commitHistoryCapture();
    setMessage({ tone: "info", text: description });
    logMessage("info", `[Personagem] ${description}${authored ? "" : ` (${users.length} uso(s) do modelo)`}`);
    return true;
  }

  if (!def || !animationName) {
    return (
      <div data-testid="character-timeline-empty" className="p-4 text-sm text-[#a6adc8]">
        Esta entidade não tem animações com quadros editáveis.
      </div>
    );
  }

  const total = totalTicks(def, tickRate);
  const playIndex = (() => {
    if (!playing && pausedPreviewTick === null) return selected?.index ?? 0;
    const time = playing ? playTick.current : pausedPreviewTick ?? 0;
    const loopIndex = def.loop_start ?? 0;
    const loopAt = occurrences[loopIndex]?.startTick ?? 0;
    if (total && time >= total && !def.loop) return occurrences.length - 1;
    let t = total && time >= total ? loopAt + ((time - loopAt) % (total - loopAt)) : time;
    for (const occ of occurrences) {
      if (occ.ticks <= 0) return occ.index;
      if (t < occ.ticks) return occ.index;
      t -= occ.ticks;
    }
    return 0;
  })();
  const shown = occurrences[playIndex] ?? selected;
  const shownFrame: MugenAnimationFrame | undefined = def.mugen_frames?.[shown?.index ?? 0];
  const pivot = sprite.pivot ?? { x: 0, y: 0 };
  const scale = previewZoom;
  const stage = { w: sprite.frame_width * scale + 160, h: sprite.frame_height * scale + 60 };
  const axis = authored ? { x: 80 + pivot.x * scale, y: 30 + pivot.y * scale } : { x: stage.w / 2, y: stage.h - 30 };
  const currentAnchor = anchorDraft.x.trim() && anchorDraft.y.trim()
    ? { x: Number(anchorDraft.x), y: Number(anchorDraft.y) } : null;
  const alignment = authored && aligning && reference && selected && currentAnchor && reference.id !== selected.id
    ? alignPoseSupport(def, reference, { id: selected.id, anchor: currentAnchor }, { width: sprite.frame_width, height: sprite.frame_height })
    : null;
  const previewDef = alignment?.ok ? alignment.def : def;
  const imageAt = (frame: MugenAnimationFrame | undefined, occurrence: TimelineOccurrence) => {
    const offset = previewDef.pose_alignment?.[occurrence.id]?.offset ?? { x: 0, y: 0 };
    return {
      left: axis.x + ((frame?.axis?.x ?? 0) - pivot.x + offset.x) * scale,
      top: axis.y + ((frame?.axis?.y ?? 0) - pivot.y + offset.y) * scale,
    };
  };
  const previous = shown && shown.index > 0 ? occurrences[shown.index - 1] : null;
  const savedAnchor = authored && shown ? def.pose_alignment?.[shown.id]?.anchor : null;
  const boxOrigin = authored && shown ? imageAt(shownFrame, shown) : { left: axis.x, top: axis.y };
  const selectedBoxData = selected && selectedBox ? occurrenceBoxes(def, selected.id, selectedBox.kind)[selectedBox.index] : null;
  function commitTicks(occ: TimelineOccurrence, ticks: number) {
    if (ticks !== occ.ticks) {
      commit(setOccurrenceDuration(def!, occ.id, String(ticks), tickRate),
        `${animationName} ocorrência ${occ.index + 1}: ${occ.ticks} → ${ticks} ticks`);
    }
  }

  return (
    <div
      data-testid="character-timeline"
      data-entity-id={entity.entity_id}
      data-animation={animationName}
      data-occurrence-id={selected?.id ?? ""}
      className="grid h-full min-h-0 grid-cols-[clamp(108px,14vw,200px)_minmax(0,1fr)_clamp(184px,21vw,260px)] grid-rows-[minmax(0,1fr)_auto] gap-2 bg-[#0b1120] p-2 text-[11px] text-[#cbd5e1]"
    >
      <aside aria-label="Animações do personagem" className="row-span-2 min-h-0 overflow-y-auto rounded border border-[#27272a] p-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[color:var(--rds-text-primary)]">Animações</h2>
          <span className="rounded bg-[#1e293b] px-1 text-[9px] uppercase text-[#94a3b8]">Experimental</span>
        </div>
        <p className="mb-2 text-[10px] text-[#94a3b8]">{getEntityDisplayName(entity)}{authored ? "" : " · MUGEN importado"}</p>
        <ul className="space-y-1">
          {animations.map(([name, anim]) => (
            <li key={name}>
              <button
                type="button"
                data-testid={`character-anim-${name}`}
                aria-pressed={name === animationName}
                onClick={() => selectAnimation(name)}
                className={`w-full rounded px-2 py-1 text-left ${name === animationName ? "bg-[#312e81] text-white" : "hover:bg-[#1e293b]"}`}
              >
                {name}
                <span className="ml-1 text-[10px]">{anim.frames.length} oc.</span>
              </button>
            </li>
          ))}
        </ul>
        {authored && selected && resolveLinkedPixelAsset(entity) ? <button
          type="button" data-testid="character-open-pixels"
          className="mt-2 rounded border border-[#45475a] px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#89b4fa]"
          onClick={() => openStudioEditor({ focus: { task: "pixels", entityId: entity.entity_id, animation: animationName, occurrenceId: selected.id } })}
        >Editar pixels do atlas</button> : null}
      </aside>

      <section aria-label="Prévia do quadro" className="flex min-h-0 flex-col rounded border border-[#27272a]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#27272a] px-2 py-1">
          <button
            type="button"
            data-testid="character-play"
            onClick={() => {
              if (playing) {
                setPausedPreviewTick(playTick.current);
              } else {
                playTick.current = pausedPreviewTick !== null && (def.loop || total === null || pausedPreviewTick < total)
                  ? pausedPreviewTick : selected?.startTick ?? 0;
              }
              setPlaying(!playing);
            }}
            className="rounded border border-[#334155] px-2 py-0.5"
          >
            {playing ? "Pausar" : "Reproduzir"}
          </button>
          <button
            type="button"
            data-testid="character-step"
            title="Avançar para a próxima ocorrência"
            onClick={() => {
              setPlaying(false);
              const next = occurrences[((selected?.index ?? 0) + 1) % occurrences.length];
              if (next) selectOccurrence(next);
            }}
            className="rounded border border-[#334155] px-2 py-0.5"
          >
            Próximo quadro ▸
          </button>
          <label className="flex items-center gap-1">
            <input type="checkbox" data-testid="character-onion" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
            Onion skin
          </label>
          {authored ? (
            <label className="flex items-center gap-1">
              <input type="checkbox" data-testid="character-loop" checked={def.loop}
                onChange={(event) => commit({ ok: true, def: { ...def, loop: event.target.checked } }, "Repetição da animação atualizada.")} />
              Repetir
            </label>
          ) : null}
          <div className="flex items-center gap-1" role="group" aria-label="Zoom da prévia">
            <button type="button" aria-label="Reduzir zoom da prévia" disabled={previewZoom <= 1}
              onClick={() => setPreviewZoom((zoom) => zoom - 1)} className="min-h-6 min-w-6 rounded border border-[#45475a] disabled:opacity-45">−</button>
            <span className="font-mono">{previewZoom}×</span>
            <button type="button" aria-label="Ampliar zoom da prévia" disabled={previewZoom >= 12}
              onClick={() => setPreviewZoom((zoom) => zoom + 1)} className="min-h-6 min-w-6 rounded border border-[#45475a] disabled:opacity-45">+</button>
          </div>
          <span data-testid="character-total-ticks" className="ml-auto text-[#94a3b8]">
            {occurrences.length} ocorrências ·{" "}
            {total === null ? (authored ? "termina parada" : "termina parada (-1)") : `${total} ticks = ${(total / tickRate).toFixed(3).replace(".", ",")} s`} ·
            prévia aproximada; ROM é a referência
          </span>
        </div>
        <div className="flex min-h-0 flex-1 overflow-auto">
          <div
            data-testid="character-preview"
            data-shown-occurrence={shown?.id ?? ""}
            className="relative m-auto shrink-0 bg-[repeating-conic-gradient(#1e293b_0_25%,#0f172a_0_50%)] [background-size:16px_16px]"
            style={{ width: stage.w, height: stage.h }}
          >
            {onion && previous ? (
              <div
                aria-hidden="true"
                className="absolute opacity-30"
                style={{ ...imageAt(def.mugen_frames?.[previous.index], previous), ...cellStyle(src, sheet, sprite, previous.image, scale) }}
              />
            ) : null}
            {shown ? (
              <div
                data-testid="character-preview-image"
                data-image={shown.image}
                className="absolute"
                style={{ ...imageAt(shownFrame, shown), ...cellStyle(src, sheet, sprite, shown.image, scale) }}
              />
            ) : null}
            {authored && aligning && shown && shown.id === selected?.id && !playing ? (
              <button type="button" className="absolute z-10 cursor-crosshair rounded-sm focus-visible:ring-2 focus-visible:ring-[#89b4fa]"
                aria-label="Marcar o ponto de apoio na imagem"
                style={{ ...imageAt(shownFrame, shown), width: sprite.frame_width * scale, height: sprite.frame_height * scale }}
                onClick={(event) => {
                  if (event.detail === 0) {
                    document.getElementById("character-anchor-x")?.focus();
                    return;
                  }
                  const box = event.currentTarget.getBoundingClientRect();
                  setAnchorDraft({ x: String(Math.floor((event.clientX - box.left) / scale)), y: String(Math.floor((event.clientY - box.top) / scale)) });
                }}>
                {currentAnchor && Number.isInteger(currentAnchor.x) && Number.isInteger(currentAnchor.y) ? (
                  <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#f59e0b]"
                    style={{ left: (currentAnchor.x + 0.5) * scale, top: (currentAnchor.y + 0.5) * scale }} />
                ) : null}
              </button>
            ) : null}
            {shown && savedAnchor && !aligning && !playing ? (
              <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#f59e0b]"
                title="Ponto de apoio"
                style={{ left: imageAt(shownFrame, shown).left + (savedAnchor.x + 0.5) * scale,
                  top: imageAt(shownFrame, shown).top + (savedAnchor.y + 0.5) * scale }} />
            ) : null}
            {shown ? (["clsn2", "clsn1"] as BoxKind[]).flatMap((kind) =>
              occurrenceBoxes(def, shown.id, kind).map((raw, i) => {
                const box = drag && drag.kind === kind && drag.index === i && !playing ? drag.preview : raw;
                const r = boxRect(box);
                if (!r) return null;
                const attack = kind === "clsn1";
                const isSelected = selectedBox?.kind === kind && selectedBox.index === i;
                const editable = !playing && shown?.id === selected?.id;
                const origin = authored ? "desta ocorrência" : shownFrame?.clsn_edited ? "editada" : "importada";
                return (
                  <div
                    key={`${kind}-${i}`}
                    data-testid={attack ? "character-box-attack" : "character-box-body"}
                    data-box={`${kind}:${i}`}
                    data-rect={`${box.x1},${box.y1},${box.x2},${box.y2}`}
                    role="button"
                    tabIndex={editable ? 0 : -1}
                    aria-label={`${attack ? "Ataque" : "Corpo"} ${i + 1} (${origin})`}
                    title={`${attack ? "Ataque" : "Corpo"}, ${origin}. Arraste para mover. Use o canto para redimensionar ou as setas para mover 1 px.`}
                    className={`absolute border-2 ${attack ? "border-dashed border-[#f97316] bg-[#f97316]/15" : "border-[#3b82f6] bg-[#3b82f6]/10"} ${isSelected ? "outline outline-2 outline-white" : ""} ${editable ? "cursor-move" : ""}`}
                    style={{ left: boxOrigin.left + r.x * scale, top: boxOrigin.top + r.y * scale, width: r.w * scale, height: r.h * scale }}
                    onPointerDown={(event) => {
                      if (!editable || !selected) return;
                      event.preventDefault();
                      setSelectedBox({ kind, index: i });
                      refineStudioFocus({ entityId: entity.entity_id, animation: animationName, occurrenceId: selected.id, boxKey: `${kind}:${i}` });
                      const target = event.target as HTMLElement;
                      setDrag({ kind, index: i, mode: target.dataset.handle ? "resize" : "move", startX: event.clientX, startY: event.clientY, original: raw, preview: raw });
                    }}
                    onKeyDown={(event) => {
                      if (!editable || !selected) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedBox({ kind, index: i });
                        refineStudioFocus({ boxKey: `${kind}:${i}` });
                        requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="character-box-fields"] input')?.focus());
                        return;
                      }
                      const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                      const d = step[event.key];
                      if (!d) return;
                      event.preventDefault();
                      commit(setOccurrenceBox(def, selected.id, kind, i, moveBoxBy(raw, d[0], d[1])), `caixa ${attack ? "de ataque" : "de corpo"} ${i + 1} movida`);
                    }}
                  >
                    {editable ? (
                      <span
                        data-handle="resize"
                        data-testid={`character-box-handle-${kind}-${i}`}
                        className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-se-resize bg-white"
                      />
                    ) : null}
                  </div>
                );
              })
            ) : null}
            <div aria-hidden="true" className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full bg-white" style={{ left: axis.x, top: axis.y }} title="Eixo" />
            {!authored ? <ul className="absolute right-1 top-1 space-y-0.5 rounded bg-black/60 p-1 text-[9px] text-white">
              <li><span className="mr-1 inline-block h-2 w-2 border border-[#3b82f6]" />Corpo (Clsn2)</li>
              <li><span className="mr-1 inline-block h-2 w-2 border border-dashed border-[#f97316]" />Ataque (Clsn1)</li>
            </ul> : null}
          </div>
        </div>
      </section>

      <aside aria-label="Propriedades da ocorrência" className="row-span-2 min-h-0 space-y-3 overflow-y-auto rounded border border-[#27272a] p-2">
        <div
          data-testid="character-scope"
          className="rounded border border-[color:var(--rds-border-default)] bg-[color:var(--rds-surface-active)] px-2 py-1 text-[10px] font-medium text-[color:var(--rds-text-primary)]"
          title={authored ? "A arte continua compartilhada. Cada instância tem o próprio tempo e alinhamento."
            : "Animações MUGEN pertencem ao personagem: a edição vale para todas as instâncias que o usam."}
        >
          {authored ? "Editar esta instância" : `Editar modelo — ${users.length} uso${users.length === 1 ? "" : "s"}`}
        </div>
        {selected ? (
          <>
            <div>
              <h3 className="text-xs font-semibold text-[color:var(--rds-text-primary)]">Ocorrência {selected.index + 1}</h3>
              <p className="text-[10px] text-[#94a3b8]" data-testid="character-occurrence-origin">
                id {selected.id} · imagem {selected.image}
                {selected.source ? ` · SFF ${selected.source.group},${selected.source.image} (importado)` : authored ? " · Atlas do projeto" : " (origem desconhecida)"}
              </p>
            </div>
            <label className="block">
              <span className="mb-0.5 block">Duração (ticks de 1/{tickRate} s)</span>
              <input
                data-testid="character-duration"
                type="text"
                inputMode="numeric"
                value={durationDraft ?? String(selected.ticks)}
                onChange={(event) => setDurationDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setDurationDraft(null);
                    setMessage(null);
                  }
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                }}
                onBlur={() => {
                  if (durationDraft === null || durationDraft === String(selected.ticks)) {
                    setDurationDraft(null);
                    return;
                  }
                  const ok = commit(
                    setOccurrenceDuration(def, selected.id, durationDraft, tickRate),
                    `${animationName} ocorrência ${selected.index + 1}: ${selected.ticks} → ${durationDraft} ticks`
                  );
                  if (ok) setDurationDraft(null);
                }}
                className="w-20 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
              />
              <span className="ml-1 text-[10px] text-[#94a3b8]">{describeTicks(selected.ticks, tickRate)}</span>
            </label>
            {authored ? (
              <div className="space-y-1">
                <button type="button" data-testid="character-open-duration-code"
                  className="mr-1 rounded border border-[#45475a] px-2 py-1"
                  onClick={() => {
                    refineStudioFocus({ entityId: entity.entity_id, animation: animationName, occurrenceId: selected.id });
                    useCodeFocusStore.getState().setLogicView("code");
                    openStudioEditor({ focus: { task: "actions", entityId: entity.entity_id, animation: animationName, occurrenceId: selected.id } });
                  }}>
                  Ver duração no C
                </button>
                <button type="button" data-testid="character-align-poses" aria-expanded={aligning}
                  className="rounded border border-[#45475a] px-2 py-1"
                  onClick={() => { setAligning(!aligning); setPlaying(false); setPausedPreviewTick(null); }}>
                  Alinhar poses
                </button>
                {aligning ? (
                  <section aria-label="Pontos de apoio" className="space-y-2 rounded border border-[#45475a] p-2">
                    <p>{reference ? `Referência: ocorrência ${occurrences.findIndex((item) => item.id === reference.id) + 1}` : "Marque o pé e defina a referência."}</p>
                    <div className="flex gap-2">
                      {(["x", "y"] as const).map((axisName) => (
                        <label key={axisName}>{axisName.toUpperCase()} (px)
                          <input id={`character-anchor-${axisName}`} data-testid={`character-anchor-${axisName}`}
                            type="text" inputMode="numeric" value={anchorDraft[axisName]}
                            onChange={(event) => setAnchorDraft({ ...anchorDraft, [axisName]: event.target.value })}
                            className="ml-1 w-10 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono" />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" data-testid="character-anchor-reference" disabled={!currentAnchor}
                        className="rounded border border-[#45475a] px-1 py-0.5 disabled:opacity-50"
                        onClick={() => { if (currentAnchor) setReference({ id: selected.id, anchor: currentAnchor }); }}>
                        Usar como referência
                      </button>
                      <button type="button" data-testid="character-align-apply" disabled={!alignment?.ok}
                        className="rounded border border-[#89b4fa] px-1 py-0.5 disabled:opacity-50"
                        onClick={() => {
                          if (alignment && commit(alignment, "Pontos de apoio alinhados nesta instância.")) {
                            setAligning(false);
                            setReference(null);
                          }
                        }}>Aplicar alinhamento</button>
                      <button type="button" className="rounded border border-[#45475a] px-1"
                        onClick={() => { setAligning(false); setReference(null); }}>Cancelar</button>
                    </div>
                    {alignment && !alignment.ok ? <p role="status">{alignment.message}</p> : null}
                  </section>
                ) : null}
              </div>
            ) : null}
            <div data-testid="character-occurrence-boxes" className="space-y-1">
              <p className="text-[10px] text-[#94a3b8]">
                Caixas: {selected.bodyBoxes} corpo · {selected.attackBoxes} ataque ({authored ? "desta ocorrência" : def.mugen_frames?.[selected.index]?.clsn_edited ? "editadas no Studio" : "importadas"})
              </p>
              <div className="flex gap-1">
                {(["clsn1", "clsn2"] as BoxKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    data-testid={`character-box-add-${kind}`}
                    onClick={() => {
                      const initial = authored ? {
                        x1: kind === "clsn1" ? Math.floor(sprite.frame_width / 2) : 0, y1: 0,
                        x2: sprite.frame_width, y2: sprite.frame_height,
                      } : kind === "clsn1" ? { x1: 10, y1: -60, x2: 40, y2: -40 } : { x1: -20, y1: -80, x2: 20, y2: 0 };
                      const result = addOccurrenceBox(def, selected.id, kind, initial);
                      if (commit(result, `caixa ${kind === "clsn1" ? "de ataque" : "de corpo"} adicionada`) && result.ok) {
                        const index = occurrenceBoxes(result.def, selected.id, kind).length - 1;
                        setSelectedBox({ kind, index });
                        refineStudioFocus({ boxKey: `${kind}:${index}` });
                      }
                    }}
                    className="rounded border border-[#334155] px-1.5"
                  >
                    + {kind === "clsn1" ? "Ataque" : "Corpo"}
                  </button>
                ))}
              </div>
              {selectedBox && selectedBoxData ? (
                (() => {
                  const box = selectedBoxData;
                  return (
                    <div data-testid="character-box-fields" className="rounded border border-[#334155] p-1">
                      <p className="mb-0.5 text-[10px]">
                        {selectedBox.kind === "clsn1" ? "Ataque" : "Corpo"} {selectedBox.index + 1} ({authored ? "px a partir do canto da pose" : "px a partir do eixo"})
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {(["x1", "y1", "x2", "y2"] as const).map((key) => (
                          <label key={key} className="flex flex-col text-[9px]">
                            {key}
                            <input
                              data-testid={`character-box-field-${key}`}
                              type="text"
                              inputMode="numeric"
                              value={boxDraft[key] ?? String(box[key])}
                              onChange={(e) => setBoxDraft((d) => ({ ...d, [key]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              onBlur={() => {
                                const raw = boxDraft[key];
                                setBoxDraft((d) => {
                                  const n = { ...d };
                                  delete n[key];
                                  return n;
                                });
                                if (raw === undefined || raw === String(box[key])) return;
                                commit(setOccurrenceBox(def, selected.id, selectedBox.kind, selectedBox.index, { ...box, [key]: Number(raw) }), `caixa ${key} = ${raw}`);
                              }}
                              className="w-full rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        data-testid="character-box-remove"
                        onClick={() => {
                          if (commit(removeOccurrenceBox(def, selected.id, selectedBox.kind, selectedBox.index), "caixa removida")) {
                            setSelectedBox(null);
                            refineStudioFocus({ boxKey: null });
                          }
                        }}
                        className="mt-1 rounded border border-[#f38ba8]/60 px-1.5 text-[#f38ba8]"
                      >
                        Remover caixa
                      </button>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[9px] text-[#94a3b8]">Clique numa caixa na prévia para editar.</p>
              )}
            </div>
            {!authored ? <div className="flex gap-1">
              <button
                type="button"
                data-testid="character-move-left"
                disabled={selected.index === 0}
                onClick={() =>
                  commit(moveOccurrence(def, selected.id, selected.index - 1), `${animationName}: ocorrência ${selected.id} movida para ${selected.index}`)
                }
                className="rounded border border-[#334155] px-2 py-0.5 disabled:opacity-40"
              >
                ◂ Mover
              </button>
              <button
                type="button"
                data-testid="character-move-right"
                disabled={selected.index === occurrences.length - 1}
                onClick={() =>
                  commit(moveOccurrence(def, selected.id, selected.index + 1), `${animationName}: ocorrência ${selected.id} movida para ${selected.index + 2}`)
                }
                className="rounded border border-[#334155] px-2 py-0.5 disabled:opacity-40"
              >
                Mover ▸
              </button>
            </div> : null}
            <div>
              <h3 className="mb-1 text-xs font-semibold text-[color:var(--rds-text-primary)]">Eventos (autorais)</h3>
              <ul className="space-y-1" data-testid="character-events">
                {selected.events.map((event) => (
                  <li key={event.id} data-testid={`character-event-${event.id}`} className="flex items-center gap-1">
                    <span aria-hidden="true">🔊</span>
                    <span>
                      Som “{event.sound}” no tick {event.tick}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover evento ${event.id}`}
                      data-testid={`character-event-remove-${event.id}`}
                      onClick={() => commit({ ok: true, def: removeEvent(def, event.id) }, `evento ${event.id} removido`)}
                      className="ml-auto rounded border border-[#334155] px-1"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="character-add-sound"
                onClick={() => void addSound()}
                className="mt-1 rounded border border-[#334155] px-2 py-0.5"
              >
                + Adicionar som…
              </button>
              {sfxNames.length === 0 ? (
                <p className="mt-1 text-[10px] text-[#fbbf24]" data-testid="character-event-no-audio">
                  Adicione um som ao projeto para vinculá-lo a um quadro.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap items-end gap-1">
                  <label className="flex flex-col">
                    <span>Som</span>
                    <select
                      data-testid="character-event-sound"
                      value={eventSound}
                      onChange={(event) => setEventSound(event.target.value)}
                      className="rounded border border-[#45475a] bg-[#11111b]"
                    >
                      <option value="">—</option>
                      {sfxNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col">
                    <span>Tick local</span>
                    <input
                      data-testid="character-event-tick"
                      type="text"
                      inputMode="numeric"
                      value={eventTick}
                      onChange={(event) => setEventTick(event.target.value)}
                      className="w-12 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="character-sound-preview"
                    disabled={!eventSound}
                    title={eventSound ? `Ouvir ${sfxSources.get(eventSound)} (prévia no editor; não prova o som na ROM)` : "Escolha um som"}
                    onClick={() => void previewSound(eventSound)}
                    className="rounded border border-[#334155] px-2 py-0.5 disabled:opacity-40"
                    aria-label="Ouvir som"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    data-testid="character-event-add"
                    onClick={() =>
                      commit(
                        addSoundEvent(def, selected.id, eventTick.trim() ? Number(eventTick) : Number.NaN, eventSound, tickRate),
                        `som “${eventSound}” na ocorrência ${selected.index + 1}, tick ${eventTick}`
                      )
                    }
                    className="rounded border border-[#334155] px-2 py-0.5"
                  >
                    + Som no quadro
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
        {message ? (
          <div
            role={message.tone === "error" ? "alert" : "status"}
            data-testid={`character-message-${message.tone}`}
            className={`rounded border px-2 py-1 text-[10px] ${message.tone === "error" ? "border-[#f38ba8] text-[#f38ba8]" : "border-[#334155] text-[#a6e3a1]"}`}
          >
            {message.text}
            {message.conflicts && selected && durationDraft ? (
              <button
                type="button"
                data-testid="character-retime-events"
                onClick={() => {
                  const ticks = Number(durationDraft);
                  const retimed = retimeEventsToFit(def, selected.id, ticks);
                  if (commit(setOccurrenceDuration(retimed, selected.id, durationDraft, tickRate), `eventos ajustados e duração ${durationDraft}`)) {
                    setDurationDraft(null);
                  }
                }}
                className="ml-1 rounded border border-[#f38ba8] px-1"
              >
                Ajustar eventos
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>

      <section aria-label="Linha do tempo" className="col-start-2 overflow-x-auto rounded border border-[#27272a] p-2">
        <ol className="flex gap-1" data-testid="character-occurrences">
          {occurrences.map((occ) => (
            <li key={occ.id} className="relative flex shrink-0">
              <button
                type="button"
                data-testid={`character-occurrence-${occ.id}`}
                data-index={occ.index}
                data-ticks={occ.ticks}
                aria-pressed={occ.id === selected?.id}
                aria-label={`Ocorrência ${occ.index + 1}, imagem ${occ.image}, ${occ.ticks} ticks`}
                onClick={() => selectOccurrence(occ)}
                style={authored ? { minWidth: Math.min(240, Math.max(48, (durationPreview?.id === occ.id ? durationPreview.ticks : occ.ticks) * TICK_PIXELS)) } : undefined}
                className={`flex flex-col items-center rounded border p-1 ${occ.id === selected?.id ? "border-[#a78bfa] bg-[#312e81]/40" : "border-[#27272a]"}`}
              >
                <span className="text-[9px] text-[#94a3b8]">{occ.index + 1}</span>
                <span style={cellStyle(src, sheet, sprite, occ.image, 1)} className="block min-h-6 min-w-6" />
                <span className="font-mono text-[10px]">
                  {durationPreview?.id === occ.id ? `${durationPreview.ticks}t` : occ.ticks <= 0 ? "parado" : `${occ.ticks}t`}
                </span>
                <span className="flex gap-0.5 text-[9px]">
                  {occ.attackBoxes > 0 ? <span title="Tem caixa de ataque" className="text-[#f97316]">⚔</span> : null}
                  {occ.events.map((event) => (
                    <span key={event.id} title={`Som ${event.sound} no tick ${event.tick}`}>🔊</span>
                  ))}
                </span>
              </button>
              {authored && occ.ticks > 0 ? (
                <button type="button" data-testid={`character-duration-grip-${occ.id}`} data-tick-px={TICK_PIXELS}
                  title="Arraste ou use as setas para alterar a duração"
                  aria-label={`Alterar duração da ocorrência ${occ.index + 1}, ${occ.ticks} ticks`}
                  className="inline-flex min-h-6 w-6 shrink-0 cursor-ew-resize touch-none items-center justify-center rounded-r border border-l-0 border-[#45475a] focus-visible:ring-2 focus-visible:ring-[#89b4fa]"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    selectOccurrence(occ);
                    durationDrag.current = { x: event.clientX, ticks: occ.ticks, id: occ.id, revision: useEditorStore.getState().sceneRevision };
                    setDurationPreview({ id: occ.id, ticks: occ.ticks });
                  }}
                  onPointerMove={(event) => {
                    const gesture = durationDrag.current;
                    if (!gesture || gesture.id !== occ.id) return;
                    const ticks = Math.max(1, Math.min(255, gesture.ticks + Math.round((event.clientX - gesture.x) / TICK_PIXELS)));
                    setDurationPreview({ id: occ.id, ticks });
                  }}
                  onPointerUp={(event) => {
                    const gesture = durationDrag.current;
                    durationDrag.current = null;
                    setDurationPreview(null);
                    if (gesture?.id !== occ.id || gesture.revision !== useEditorStore.getState().sceneRevision) return;
                    const ticks = Math.max(1, Math.min(255, gesture.ticks + Math.round((event.clientX - gesture.x) / TICK_PIXELS)));
                    commitTicks(occ, ticks);
                  }}
                  onLostPointerCapture={() => { durationDrag.current = null; setDurationPreview(null); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      durationDrag.current = null;
                      setDurationPreview(null);
                    }
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      selectOccurrence(occ);
                      commitTicks(occ, Math.max(1, Math.min(255, occ.ticks + (event.key === "ArrowLeft" ? -1 : 1))));
                    }
                  }}>
                  <span aria-hidden="true" className="pointer-events-none h-4 border-x border-[#94a3b8]/70 px-0.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
