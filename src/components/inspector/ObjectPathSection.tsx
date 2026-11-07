import { useState } from "react";
import type { PathComponent, PathPoint } from "../../core/ipc/sceneService";
import { addPoint, defaultPath, ellipsePath, pathCycleFrames, pathIssue, PATH_MAX_FRAMES, PATH_MAX_OFFSET, PATH_MAX_POINTS, removePoint, toggleCurve, withPoint } from "../../core/objectPath";

/**
 * R5: numeric editor of an object's path (Experimental). Same data the Canvas handles draw and
 * the build compiles; every committed change is one undoable entity edit.
 */
export function ObjectPathSection({
  path,
  blockedReason,
  fps,
  onChange,
}: {
  path: PathComponent | null | undefined;
  /** Why this object cannot have a path (physics/input), or null. */
  blockedReason: string | null;
  fps: number;
  onChange: (next: PathComponent | null) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [ellipse, setEllipse] = useState({ rx: 48, ry: 24, segments: 8, frames: 15 });
  if (!path) {
    return (
      <section data-testid="inspector-path" className="border-b border-[#313244] px-3 py-2 text-[10px] text-[#cdd6f4]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89b4fa]">Trajeto <span className="font-normal normal-case text-[#7f849c]">(Experimental · Mega Drive)</span></p>
        {blockedReason ? (
          <p data-testid="inspector-path-blocked" className="mt-1 text-[#a6adc8]">{blockedReason}</p>
        ) : (
          <button type="button" data-testid="inspector-path-add" onClick={() => onChange(defaultPath())} className="mt-1 rounded border border-[#313244] px-2 py-0.5 font-semibold text-[#cdd6f4] hover:border-[#89b4fa]">
            + Adicionar trajeto
          </button>
        )}
      </section>
    );
  }
  const issue = pathIssue(path);
  const commitField = (index: number, key: keyof PathPoint, raw: string, min: number, max: number) => {
    const id = `${index}:${key}`;
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(value) || value < min || value > max) {
      setDraft((current) => ({ ...current, [id]: raw }));
      return;
    }
    setDraft((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (path.points[index]?.[key] !== value) onChange(withPoint(path, index, { [key]: value }));
  };
  const field = (index: number, key: keyof PathPoint, label: string, min: number, max: number, disabled = false) => {
    const id = `${index}:${key}`;
    const invalid = draft[id] !== undefined;
    return (
      <label className="flex flex-col gap-0.5">
        <span className="text-[9px] text-[#7f849c]">{label}</span>
        <input
          type="number"
          data-testid={`inspector-path-${key}-${index}`}
          aria-label={`Ponto ${index}: ${label}`}
          aria-invalid={invalid}
          disabled={disabled}
          min={min}
          max={max}
          value={draft[id] ?? String(path.points[index]![key])}
          onChange={(event) => commitField(index, key, event.target.value, min, max)}
          className={`w-16 rounded border bg-[#1e1e2e] px-1 py-0.5 text-right font-mono text-[10px] text-[#cdd6f4] disabled:opacity-40 ${invalid ? "border-[#f38ba8]" : "border-[#313244]"}`}
        />
      </label>
    );
  };
  const curveField = (index: number, axis: "x" | "y") => {
    const id = `${index}:c${axis}`;
    const invalid = draft[id] !== undefined;
    return (
      <label className="flex flex-col gap-0.5">
        <span className="text-[9px] text-[#7f849c]">Controle {axis.toUpperCase()}</span>
        <input
          type="number"
          data-testid={`inspector-path-c${axis}-${index}`}
          aria-label={`Ponto ${index}: controle da curva ${axis.toUpperCase()}`}
          aria-invalid={invalid}
          value={draft[id] ?? String(path.points[index]!.curve![axis])}
          onChange={(event) => {
            const raw = event.target.value;
            const value = Number(raw);
            if (raw.trim() === "" || !Number.isInteger(value) || Math.abs(value) > PATH_MAX_OFFSET) {
              setDraft((current) => ({ ...current, [id]: raw }));
              return;
            }
            setDraft((current) => {
              const next = { ...current };
              delete next[id];
              return next;
            });
            const curve = path.points[index]!.curve!;
            if (curve[axis] !== value) onChange(withPoint(path, index, { curve: { ...curve, [axis]: value } }));
          }}
          className={`w-16 rounded border bg-[#1e1e2e] px-1 py-0.5 text-right font-mono text-[10px] text-[#f9e2af] ${invalid ? "border-[#f38ba8]" : "border-[#313244]"}`}
        />
      </label>
    );
  };
  const cycle = pathCycleFrames(path);
  return (
    <section data-testid="inspector-path" className="border-b border-[#313244] px-3 py-2 text-[10px] text-[#cdd6f4]">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89b4fa]">Trajeto <span className="font-normal normal-case text-[#7f849c]">(Experimental · Mega Drive)</span></p>
        <button type="button" data-testid="inspector-path-remove" onClick={() => onChange(null)} className="ml-auto rounded px-1 text-[#f38ba8] hover:bg-[#313244]">Remover trajeto</button>
      </div>
      <label className="mt-1 flex items-center gap-1">
        <span className="text-[#a6adc8]">Repetição</span>
        <select data-testid="inspector-path-mode" value={path.mode} onChange={(event) => onChange({ ...path, mode: event.target.value as PathComponent["mode"] })} className="rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-[10px] text-[#cdd6f4]">
          <option value="once">Uma vez (para no fim)</option>
          <option value="loop">Repetir (volta ao início)</option>
          <option value="pingpong">Ida e volta</option>
        </select>
      </label>
      <label className="mt-1 flex items-center gap-1 text-[#a6adc8]">
        <input
          type="checkbox"
          data-testid="inspector-path-autostart"
          checked={path.autostart !== false}
          onChange={(event) => onChange({ ...path, autostart: event.target.checked })}
        />
        Começa sozinho <span className="text-[9px] text-[#7f849c]">(desmarcado: espera o nó «Iniciar trajeto»)</span>
      </label>
      <p className="mt-1 text-[9px] text-[#7f849c]">Pontos em px relativos à posição inicial; duração em quadros para chegar ao ponto; espera ao chegar.</p>
      <ol className="mt-1 space-y-1">
        {path.points.map((_, index) => (
          <li key={index} data-testid={`inspector-path-point-${index}`} className="flex flex-wrap items-end gap-1">
            <span className="w-5 pb-1 font-mono text-[#7f849c]">{index}</span>
            {field(index, "x", "X (px)", -PATH_MAX_OFFSET, PATH_MAX_OFFSET, index === 0)}
            {field(index, "y", "Y (px)", -PATH_MAX_OFFSET, PATH_MAX_OFFSET, index === 0)}
            {field(index, "frames", index === 0 ? "Retorno (q)" : "Duração (q)", index === 0 && path.mode !== "loop" ? 0 : 1, PATH_MAX_FRAMES, index === 0 && path.mode !== "loop")}
            {field(index, "wait", "Espera (q)", 0, PATH_MAX_FRAMES)}
            {index > 0 || path.mode === "loop" ? (
              <button
                type="button"
                data-testid={`inspector-path-curve-${index}`}
                aria-pressed={Boolean(path.points[index]!.curve)}
                title={index === 0 ? "Curva do retorno ao início (loop)" : "Curva do segmento que chega a este ponto"}
                onClick={() => onChange(toggleCurve(path, index))}
                className={`mb-0.5 rounded border px-1 ${path.points[index]!.curve ? "border-[#f9e2af] text-[#f9e2af]" : "border-[#313244] text-[#a6adc8] hover:border-[#89b4fa]"}`}
              >
                Curva
              </button>
            ) : null}
            {path.points[index]!.curve ? (
              <>
                {curveField(index, "x")}
                {curveField(index, "y")}
              </>
            ) : null}
            {index > 0 && path.points.length > 2 ? (
              <button type="button" data-testid={`inspector-path-delete-${index}`} aria-label={`Remover ponto ${index}`} onClick={() => onChange(removePoint(path, index))} className="mb-0.5 rounded px-1 text-[#f38ba8] hover:bg-[#313244]">×</button>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" data-testid="inspector-path-add-point" disabled={path.points.length >= PATH_MAX_POINTS} onClick={() => onChange(addPoint(path))} className="rounded border border-[#313244] px-2 py-0.5 text-[#cdd6f4] hover:border-[#89b4fa] disabled:opacity-40">+ Ponto</button>
        <span className="text-[9px] text-[#7f849c]">{path.points.length}/{PATH_MAX_POINTS} · ciclo estimado {cycle} q (~{(cycle / fps).toFixed(1)} s a {fps} Hz NTSC; a ROM é a referência)</span>
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-[#a6adc8]">Gerar elipse (substitui os pontos)</summary>
        <div className="mt-1 flex flex-wrap items-end gap-1">
          {(["rx", "ry", "segments", "frames"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#7f849c]">{{ rx: "Raio X (px)", ry: "Raio Y (px)", segments: "Curvas", frames: "Quadros/curva" }[key]}</span>
              <input
                type="number"
                data-testid={`inspector-path-ellipse-${key}`}
                value={ellipse[key]}
                min={key === "segments" ? 4 : 1}
                max={key === "segments" ? PATH_MAX_POINTS : key === "frames" ? PATH_MAX_FRAMES : PATH_MAX_OFFSET / 2}
                onChange={(event) => setEllipse((current) => ({ ...current, [key]: Number(event.target.value) }))}
                className="w-16 rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-right font-mono text-[10px] text-[#cdd6f4]"
              />
            </label>
          ))}
          <button
            type="button"
            data-testid="inspector-path-ellipse-apply"
            onClick={() => {
              const next = ellipsePath(ellipse.rx, ellipse.ry, ellipse.segments, ellipse.frames);
              if (!pathIssue(next)) onChange(next);
            }}
            className="rounded border border-[#313244] px-2 py-0.5 text-[#cdd6f4] hover:border-[#89b4fa]"
          >
            Aplicar elipse
          </button>
        </div>
        <p className="mt-0.5 text-[9px] text-[#7f849c]">Aproximação por curvas quadráticas; começa na posição do objeto (ponto mais à esquerda) e repete.</p>
      </details>
      {issue ? <p data-testid="inspector-path-issue" role="alert" className="mt-1 text-[#f38ba8]">A build recusará: {issue}.</p> : null}
      {blockedReason ? <p className="mt-1 text-[#fab387]">{blockedReason}</p> : null}
    </section>
  );
}
