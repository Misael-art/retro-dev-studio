import { useEffect, useRef, useState } from "react";
import { emulatorInputObservation, emulatorObserve } from "../../core/ipc/emulatorService";
import { inputAtObservedFrame, MAX_MOTION_SAMPLES, motionTraceSummary, type MotionTrace } from "../../core/motionTrace";
import { readRuntimeWord } from "../../core/runtimeSample";
import { useEditorStore } from "../../core/store/editorStore";

const button = "rounded border border-[var(--rds-border-default)] px-2 py-1 disabled:opacity-40";

export default function MotionTracePanel({ renderedFrames, paused }: { renderedFrames: number; paused: boolean }) {
  const project = useEditorStore((state) => state.activeProjectDir);
  const scene = useEditorStore((state) => state.activeScenePath);
  const selected = useEditorStore((state) => state.selectedEntityId);
  const link = useEditorStore((state) => state.lastRuntimeLink);
  const revision = useEditorStore((state) => state.lastBuildSceneRevision);
  const rom = useEditorStore((state) => state.emulatorRomIdentity);
  const epoch = useEditorStore((state) => state.coreEpoch);
  const storage = useEditorStore((state) => state.motionTraceSession);
  const update = useEditorStore((state) => state.updateMotionTrace);
  const key = JSON.stringify([project, scene]);
  const session = storage?.key === key ? storage : null;
  const slot = session?.recording ?? null;
  const track = slot ? session?.[slot] : null;
  const linkedActor = link?.entities.find(({ entity_id }) => entity_id === selected);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const eligible = paused && project !== null && scene !== null && linkedActor !== undefined
    && revision !== null && epoch !== null && rom !== null && link?.rom_sha256 === rom.sha256;

  useEffect(() => {
    if (!slot || !track) return;
    let cancelled = false;
    const end = (hint: string) => {
      if (cancelled) return;
      update((current) => current?.key === key && current.recording === slot && current[slot] === track
        ? { ...current, recording: null } : current);
      setMessage(hint);
    };
    if (!paused || epoch !== track.coreEpoch || rom?.sha256 !== track.romSha256 || link?.rom_sha256 !== track.romSha256) {
      end("A gravação terminou quando o quadro pausado ou o vínculo mudou.");
      return;
    }
    const actor = link.entities.find(({ entity_id }) => entity_id === track.entityId);
    if (!actor) {
      end("O ator ficou sem vínculo com a ROM.");
      return;
    }
    void (async () => {
      const before = await emulatorInputObservation();
      if (before.epoch !== track.coreEpoch || cancelled) return;
      const last = track.samples.at(-1)?.frame;
      if (last === before.frames_run) return;
      const [x, y] = await Promise.all([readRuntimeWord(actor.symbols.x, true), readRuntimeWord(actor.symbols.y, true)]);
      const after = await emulatorInputObservation();
      if (cancelled || after.epoch !== before.epoch || after.frames_run !== before.frames_run) return;
      if (last !== undefined && last > after.frames_run) {
        end("O core voltou a um quadro anterior. Escolha A ou B para iniciar outra gravação.");
        return;
      }
      const samples = [...track.samples, { frame: after.frames_run, x, y, input: inputAtObservedFrame(after) }];
      const filled = samples.length >= MAX_MOTION_SAMPLES;
      update((current) => current?.key === key && current.recording === slot && current[slot] === track
        ? { ...current, [slot]: { ...track, samples }, recording: filled ? null : slot } : current);
      if (filled) setMessage(`Gravação concluída com ${MAX_MOTION_SAMPLES} amostras.`);
    })().catch((error: unknown) => end(error instanceof Error ? error.message : String(error)));
    return () => { cancelled = true; };
  }, [epoch, key, link, paused, renderedFrames, rom?.sha256, slot, track, update]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !session) return;
    const traces = [[session.a, "#99f6e4"], [session.b, "#fcd34d"]] as const;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    if (session.a && session.b && session.a.entityId !== session.b.entityId) return;
    const samples = traces.flatMap(([value]) => value?.samples ?? []);
    if (!samples.length) return;
    const xs = samples.map(({ x }) => x), ys = samples.map(({ y }) => y);
    const left = Math.min(...xs), top = Math.min(...ys);
    const width = Math.max(8, Math.max(...xs) - left), height = Math.max(8, Math.max(...ys) - top);
    const scale = Math.min((context.canvas.width - 16) / width, (context.canvas.height - 16) / height);
    for (const [value, color] of traces) {
      if (!value?.samples.length) continue;
      context.strokeStyle = color;
      context.fillStyle = color;
      context.beginPath();
      let previous = -2;
      for (const point of value.samples) {
        const x = 8 + (point.x - left) * scale, y = 8 + (point.y - top) * scale;
        if (point.frame === previous + 1) context.lineTo(x, y);
        else context.moveTo(x, y);
        context.fillRect(x - 1, y - 1, 2, 2);
        previous = point.frame;
      }
      context.stroke();
    }
  }, [session]);

  const start = async (target: "a" | "b") => {
    if (!eligible || slot || starting) return;
    setStarting(true);
    setMessage("");
    try {
      const origin = await emulatorObserve();
      const current = useEditorStore.getState();
      if (!origin.ok || origin.rom_sha256 !== rom.sha256 || current.coreEpoch !== epoch || !current.emulPaused
          || current.activeProjectDir !== project || current.activeScenePath !== scene || current.selectedEntityId !== linkedActor.entity_id) {
        setMessage("O contexto da ROM mudou. Pause a sessão atual e tente novamente.");
        return;
      }
      const value: MotionTrace = { entityId: linkedActor.entity_id, sceneRevision: revision, romSha256: rom.sha256,
        coreEpoch: epoch, coreLabel: origin.core_label, initialFrame: origin.frames_run, initialFramebufferSha256: origin.framebuffer_sha256, samples: [] };
      update((old) => ({ a: old?.key === key ? old.a : null, b: old?.key === key ? old.b : null, key, recording: target, [target]: value }));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  return <details data-testid="viewport-motion-trace" className="rounded border border-[var(--rds-border-subtle)] p-2 text-xs">
    <summary className="cursor-pointer font-semibold">Traço de movimento <span className="text-[var(--rds-text-secondary)]">Experimental</span></summary>
    <div className="max-h-[190px] overflow-auto">
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={button} data-testid="motion-trace-start-a" disabled={!eligible || !!slot || starting} onClick={() => void start("a")}>Gravar A</button>
      <button type="button" className={button} data-testid="motion-trace-start-b" disabled={!eligible || !!slot || starting} onClick={() => void start("b")}>Gravar B</button>
      <button type="button" className={button} data-testid="motion-trace-stop" disabled={!slot} onClick={() => update((current) => current ? { ...current, recording: null } : current)}>Parar traço</button>
    </div>
    {!eligible && <p>Pause uma ROM vinculada a um build e selecione um ator da cena.</p>}
    {slot && <p>Avance um quadro por vez para registrar posição e entrada consumida pelo core.</p>}
    {message && <p role="status">{message}</p>}
    {session && <>
      <canvas ref={canvas} role="img" aria-label="Traços de posição em pixels do mundo, A em verde e B em amarelo"
        width={400} height={128} className="mt-2 w-full max-w-[400px] rounded bg-[#111827]" />
      {session.a && session.b && <p>{session.a.entityId !== session.b.entityId ? "Escolha o mesmo ator nos dois ensaios para sobrepor."
        : session.a.initialFramebufferSha256 !== session.b.initialFramebufferSha256 ? "Os quadros iniciais têm pixels diferentes." : "Os quadros iniciais têm os mesmos pixels."}</p>}
      {(["a", "b"] as const).map((name) => {
        const value = session[name];
        if (!value) return null;
        const { missing, takeoff, apex, landing } = motionTraceSummary(value.samples, value.initialFrame);
        const last = value.samples.at(-1);
        const buttons = last?.input ? Object.entries(last.input).filter(([, pressed]) => pressed).map(([key]) => key) : null;
        return <div key={name} className="mt-2 rounded border border-[var(--rds-border-subtle)] p-1" data-testid={`motion-trace-${name}`}
          data-samples={value.samples.length} data-last-frame={last?.frame} data-last-x={last?.x} data-last-y={last?.y}
          data-start-frame={value.initialFrame} data-start-sha={value.initialFramebufferSha256}
          data-missing={missing} data-takeoff={takeoff?.frame} data-apex={apex?.frame} data-landing={landing?.frame}>
          <p>{name.toUpperCase()} · {value.entityId} · revisão {value.sceneRevision} · {value.samples.length} amostras · {missing} quadros sem leitura</p>
          <p className="break-all" title={value.romSha256}>ROM {value.romSha256.slice(0, 12)} · {value.coreLabel} · início no quadro {value.initialFrame}</p>
          {last && <p>Quadro {last.frame} em ({last.x}, {last.y}) px do mundo · entrada {buttons ? buttons.join(", ") || "neutra" : "sem leitura"}</p>}
          <p>Decolagem {takeoff?.frame ?? "—"} · ápice {apex?.frame ?? "—"} · aterrissagem {landing?.frame ?? "—"}</p>
        </div>;
      })}
    </>}
    </div>
  </details>;
}
