import { useEffect, useMemo, useRef, useState } from "react";

import {
  addOccurrenceBox,
  addSoundEvent,
  moveBoxBy,
  removeOccurrenceBox,
  setOccurrenceBox,
  type BoxKind,
  describeOccurrences,
  moveOccurrence,
  removeEvent,
  retimeEventsToFit,
  setOccurrenceDuration,
  totalTicks,
  type TimelineOccurrence,
  type TimelineResult,
} from "../../core/characterTimeline";
import { getEntityDisplayName } from "../../core/entityDisplay";
import type { AnimationDef, Entity, MugenAnimationFrame, MugenCollisionBox, SpriteComponent } from "../../core/ipc/sceneService";
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
  const columns = Math.max(1, Math.floor(sheet.width / sprite.frame_width));
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
 * Editor de personagem (Experimental): linha do tempo por OCORRÊNCIA para animações MUGEN
 * importadas. Edita o modelo compartilhado por todas as instâncias do mesmo personagem numa
 * única transação de desfazer.
 */
export default function CharacterTimelinePanel({ entity }: { entity: Entity }) {
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const activeScene = useEditorStore((state) => state.activeScene);
  const studio = useEditorStore((state) => state.studio);
  const refineStudioFocus = useEditorStore((state) => state.refineStudioFocus);
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const beginHistoryCapture = useEditorStore((state) => state.beginHistoryCapture);
  const commitHistoryCapture = useEditorStore((state) => state.commitHistoryCapture);
  const logMessage = useEditorStore((state) => state.logMessage);

  const sprite = entity.components.sprite!;
  const animations = useMemo(
    () =>
      Object.entries(sprite.animations ?? {})
        .filter(([, def]) => isMugenAnimation(def))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
    [sprite.animations]
  );
  const focusAnimation =
    studio.focus.entityId === entity.entity_id && studio.focus.animation
      ? studio.focus.animation
      : null;
  const animationName =
    focusAnimation && animations.some(([name]) => name === focusAnimation) ? focusAnimation : animations[0]?.[0] ?? null;
  const def: AnimationDef | null = animationName ? sprite.animations?.[animationName] ?? null : null;
  const occurrences = useMemo(() => (def ? describeOccurrences(def) : []), [def]);
  const selected =
    occurrences.find((occ) => occ.id === studio.focus.occurrenceId) ?? occurrences[0] ?? null;

  const users = modelUsers(activeScene?.entities ?? [], sprite);
  // Registro de sons é único por ROM: qualquer som do projeto pode ser usado num evento.
  const sfxSources = new Map<string, string>();
  for (const candidate of activeScene?.entities ?? []) {
    for (const [action, path] of Object.entries(candidate.components.audio?.sfx ?? {})) sfxSources.set(action, path);
  }
  const sfxNames = [...sfxSources.keys()].sort();

  const { src } = useProjectAssetVisualState({ projectDir: activeProjectDir, relativePath: sprite.asset });
  const sheet = useSheetGeometry(src);

  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string; conflicts?: string[] } | null>(null);
  const [eventTick, setEventTick] = useState("0");
  const [eventSound, setEventSound] = useState("");
  const [playing, setPlaying] = useState(false);
  const [selectedBox, setSelectedBox] = useState<{ kind: BoxKind; index: number } | null>(null);
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

  // Prévia no editor (aproximada): avança em ticks de 1/60 s; a ROM é a referência.
  useEffect(() => {
    if (!playing || !def) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (now: number) => {
      acc += now - last;
      last = now;
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        playTick.current += 1;
      }
      forceRender((v) => v + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, def]);

  async function addSound() {
    try {
      const imported = await chooseAndImportAudio(activeProjectDir);
      if (!imported) return;
      const action = sfxActionFromPath(imported.relative_path);
      const audio = entity.components.audio ?? { sfx: {} };
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
    setDurationDraft(null);
    setMessage(null);
    refineStudioFocus({ entityId: entity.entity_id, animation: name, occurrenceId: null, eventId: null });
  }

  function selectOccurrence(occ: TimelineOccurrence) {
    setPlaying(false);
    setDurationDraft(null);
    refineStudioFocus({ entityId: entity.entity_id, animation: animationName, occurrenceId: occ.id });
  }

  /** Aplica a nova animação em todas as instâncias do modelo, numa só entrada de desfazer. */
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
    logMessage("info", `[Personagem] ${description} (${users.length} uso(s) do modelo).`);
    return true;
  }

  if (!def || !animationName) {
    return (
      <div data-testid="character-timeline-empty" className="p-4 text-sm text-[#a6adc8]">
        Esta entidade não tem animações MUGEN importadas.
      </div>
    );
  }

  const total = totalTicks(def);
  const playIndex = (() => {
    if (!playing) return selected?.index ?? 0;
    let t = playTick.current;
    for (const occ of occurrences) {
      if (occ.ticks === -1) return occ.index;
      if (t < occ.ticks) return occ.index;
      t -= occ.ticks;
    }
    playTick.current = total ? playTick.current % total : 0;
    return 0;
  })();
  const shown = occurrences[playIndex] ?? selected;
  const shownFrame: MugenAnimationFrame | undefined = def.mugen_frames?.[shown?.index ?? 0];
  const pivot = sprite.pivot ?? { x: 0, y: 0 };
  const scale = 3;
  const stage = { w: sprite.frame_width * scale + 160, h: sprite.frame_height * scale + 60 };
  const axis = { x: stage.w / 2, y: stage.h - 30 };
  const imageAt = (frame: MugenAnimationFrame | undefined) => ({
    left: axis.x + ((frame?.axis?.x ?? 0) - pivot.x) * scale,
    top: axis.y + ((frame?.axis?.y ?? 0) - pivot.y) * scale,
  });
  const previous = shown && shown.index > 0 ? occurrences[shown.index - 1] : null;

  return (
    <div
      data-testid="character-timeline"
      data-entity-id={entity.entity_id}
      data-animation={animationName}
      data-occurrence-id={selected?.id ?? ""}
      className="grid h-full min-h-0 grid-cols-[minmax(150px,200px)_minmax(0,1fr)_minmax(200px,260px)] grid-rows-[minmax(0,1fr)_auto] gap-2 bg-[#0b1120] p-2 text-[11px] text-[#cbd5e1]"
    >
      <aside aria-label="Animações do personagem" className="row-span-2 min-h-0 overflow-y-auto rounded border border-[#27272a] p-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-white">Animações</h2>
          <span className="rounded bg-[#1e293b] px-1 text-[9px] uppercase text-[#94a3b8]">Experimental</span>
        </div>
        <p className="mb-2 text-[10px] text-[#94a3b8]">{getEntityDisplayName(entity)} · MUGEN importado</p>
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
                <span className="ml-1 text-[9px] text-[#94a3b8]">{anim.frames.length} oc.</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section aria-label="Prévia do quadro" className="flex min-h-0 flex-col rounded border border-[#27272a]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#27272a] px-2 py-1">
          <button
            type="button"
            data-testid="character-play"
            onClick={() => {
              playTick.current = selected?.startTick ?? 0;
              setPlaying((value) => !value);
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
          <span data-testid="character-total-ticks" className="ml-auto text-[#94a3b8]">
            {occurrences.length} ocorrências ·{" "}
            {total === null ? "termina parada (-1)" : `${total} ticks = ${(total / 60).toFixed(3).replace(".", ",")} s`} ·
            prévia aproximada; ROM é a referência
          </span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          <div
            data-testid="character-preview"
            data-shown-occurrence={shown?.id ?? ""}
            className="relative bg-[repeating-conic-gradient(#1e293b_0_25%,#0f172a_0_50%)] [background-size:16px_16px]"
            style={{ width: stage.w, height: stage.h }}
          >
            {onion && previous ? (
              <div
                aria-hidden="true"
                className="absolute opacity-30"
                style={{ ...imageAt(def.mugen_frames?.[previous.index]), ...cellStyle(src, sheet, sprite, previous.image, scale) }}
              />
            ) : null}
            {shown ? (
              <div
                data-testid="character-preview-image"
                data-image={shown.image}
                className="absolute"
                style={{ ...imageAt(shownFrame), ...cellStyle(src, sheet, sprite, shown.image, scale) }}
              />
            ) : null}
            {(["clsn2", "clsn1"] as BoxKind[]).flatMap((kind) =>
              ((shownFrame?.[kind] ?? []) as MugenCollisionBox[]).map((raw, i) => {
                const box = drag && drag.kind === kind && drag.index === i && !playing ? drag.preview : raw;
                const r = boxRect(box);
                if (!r) return null;
                const attack = kind === "clsn1";
                const isSelected = selectedBox?.kind === kind && selectedBox.index === i;
                const editable = !playing && shown?.id === selected?.id;
                const origin = shownFrame?.clsn_edited ? "editada" : "importada";
                return (
                  <div
                    key={`${kind}-${i}`}
                    data-testid={attack ? "character-box-attack" : "character-box-body"}
                    data-box={`${kind}:${i}`}
                    data-rect={`${box.x1},${box.y1},${box.x2},${box.y2}`}
                    role="button"
                    tabIndex={editable ? 0 : -1}
                    aria-label={`${attack ? "Ataque" : "Corpo"} ${i + 1} (${origin})`}
                    title={`${attack ? "Ataque (Clsn1)" : "Corpo (Clsn2)"}, ${origin}. Arraste para mover; canto para redimensionar; setas movem 1 px.`}
                    className={`absolute border-2 ${attack ? "border-dashed border-[#f97316] bg-[#f97316]/15" : "border-[#3b82f6] bg-[#3b82f6]/10"} ${isSelected ? "outline outline-2 outline-white" : ""} ${editable ? "cursor-move" : ""}`}
                    style={{ left: axis.x + r.x * scale, top: axis.y + r.y * scale, width: r.w * scale, height: r.h * scale }}
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
            )}
            <div aria-hidden="true" className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full bg-white" style={{ left: axis.x, top: axis.y }} title="Eixo" />
            <ul className="absolute right-1 top-1 space-y-0.5 rounded bg-black/60 p-1 text-[9px]">
              <li><span className="mr-1 inline-block h-2 w-2 border border-[#3b82f6]" />Corpo (Clsn2)</li>
              <li><span className="mr-1 inline-block h-2 w-2 border border-dashed border-[#f97316]" />Ataque (Clsn1)</li>
            </ul>
          </div>
        </div>
      </section>

      <aside aria-label="Propriedades da ocorrência" className="row-span-2 min-h-0 space-y-3 overflow-y-auto rounded border border-[#27272a] p-2">
        <div
          data-testid="character-scope"
          className="rounded border border-[#a78bfa]/50 bg-[#a78bfa]/10 px-2 py-1 text-[10px] text-[#ddd6fe]"
          title="Animações MUGEN pertencem ao personagem: a edição vale para todas as instâncias que o usam."
        >
          Editar modelo — {users.length} uso{users.length === 1 ? "" : "s"}
        </div>
        {selected ? (
          <>
            <div>
              <h3 className="text-xs font-semibold text-white">Ocorrência {selected.index + 1}</h3>
              <p className="text-[10px] text-[#94a3b8]" data-testid="character-occurrence-origin">
                id {selected.id} · imagem {selected.image}
                {selected.source ? ` · SFF ${selected.source.group},${selected.source.image} (importado)` : " (origem desconhecida)"}
              </p>
            </div>
            <label className="block">
              <span className="mb-0.5 block">Duração (ticks de 1/60 s)</span>
              <input
                data-testid="character-duration"
                type="text"
                inputMode="numeric"
                value={durationDraft ?? String(selected.ticks)}
                onChange={(event) => setDurationDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                }}
                onBlur={() => {
                  if (durationDraft === null || durationDraft === String(selected.ticks)) {
                    setDurationDraft(null);
                    return;
                  }
                  const ok = commit(
                    setOccurrenceDuration(def, selected.id, durationDraft),
                    `${animationName} ocorrência ${selected.index + 1}: ${selected.ticks} → ${durationDraft} ticks`
                  );
                  if (ok) setDurationDraft(null);
                }}
                className="w-20 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
              />
              <span className="ml-1 text-[10px] text-[#94a3b8]">{describeTicks(selected.ticks)}</span>
            </label>
            <div data-testid="character-occurrence-boxes" className="space-y-1">
              <p className="text-[10px] text-[#94a3b8]">
                Caixas: {selected.bodyBoxes} corpo · {selected.attackBoxes} ataque ({def.mugen_frames?.[selected.index]?.clsn_edited ? "editadas no Studio" : "importadas"})
              </p>
              <div className="flex gap-1">
                {(["clsn1", "clsn2"] as BoxKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    data-testid={`character-box-add-${kind}`}
                    onClick={() => {
                      const result = addOccurrenceBox(def, selected.id, kind, kind === "clsn1" ? { x1: 10, y1: -60, x2: 40, y2: -40 } : { x1: -20, y1: -80, x2: 20, y2: 0 });
                      if (commit(result, `caixa ${kind === "clsn1" ? "de ataque" : "de corpo"} adicionada`) && result.ok) {
                        setSelectedBox({ kind, index: ((result.def.mugen_frames?.[selected.index]?.[kind] ?? []) as unknown[]).length - 1 });
                      }
                    }}
                    className="rounded border border-[#334155] px-1.5"
                  >
                    + {kind === "clsn1" ? "Ataque" : "Corpo"}
                  </button>
                ))}
              </div>
              {selectedBox && def.mugen_frames?.[selected.index]?.[selectedBox.kind]?.[selectedBox.index] ? (
                (() => {
                  const box = def.mugen_frames![selected.index][selectedBox.kind]![selectedBox.index];
                  return (
                    <div data-testid="character-box-fields" className="rounded border border-[#334155] p-1">
                      <p className="mb-0.5 text-[10px]">
                        {selectedBox.kind === "clsn1" ? "Ataque" : "Corpo"} {selectedBox.index + 1} (px a partir do eixo; y negativo = acima do pé)
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
                          if (commit(removeOccurrenceBox(def, selected.id, selectedBox.kind, selectedBox.index), "caixa removida")) setSelectedBox(null);
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
            <div className="flex gap-1">
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
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold text-white">Eventos (autorais)</h3>
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
                        addSoundEvent(def, selected.id, Number(eventTick), eventSound),
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
                  if (commit(setOccurrenceDuration(retimed, selected.id, durationDraft), `eventos ajustados e duração ${durationDraft}`)) {
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
            <li key={occ.id}>
              <button
                type="button"
                data-testid={`character-occurrence-${occ.id}`}
                data-index={occ.index}
                data-ticks={occ.ticks}
                aria-pressed={occ.id === selected?.id}
                aria-label={`Ocorrência ${occ.index + 1}, imagem ${occ.image}, ${occ.ticks} ticks`}
                onClick={() => selectOccurrence(occ)}
                className={`flex flex-col items-center rounded border p-1 ${occ.id === selected?.id ? "border-[#a78bfa] bg-[#312e81]/40" : "border-[#27272a]"}`}
              >
                <span className="text-[9px] text-[#94a3b8]">{occ.index + 1}</span>
                <span style={cellStyle(src, sheet, sprite, occ.image, 1)} className="block min-h-6 min-w-6" />
                <span className="font-mono text-[10px]">{occ.ticks === -1 ? "parado" : `${occ.ticks}t`}</span>
                <span className="flex gap-0.5 text-[9px]">
                  {occ.attackBoxes > 0 ? <span title="Tem caixa de ataque" className="text-[#f97316]">⚔</span> : null}
                  {occ.events.map((event) => (
                    <span key={event.id} title={`Som ${event.sound} no tick ${event.tick}`}>🔊</span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
