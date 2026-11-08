import { useState } from "react";
import type { PathComponent } from "../../core/ipc/sceneService";
import { addPoint, defaultPath, ellipsePath, pathCycleFrames, pathIssue, planPathModeChange, PATH_MAX_FRAMES, PATH_MAX_OFFSET, PATH_MAX_POINTS, removePoint, toggleCurve, withPoint } from "../../core/objectPath";

/** Numeric drafts are local until blur/Enter; Esc never mutates the scene or its history. */
function PathNumberField({ value, label, ariaLabel = label, testId, min, max, disabled = false, onCommit }: {
  value: number; label: string; ariaLabel?: string; testId: string; min: number; max: number; disabled?: boolean; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const number = Number(draft);
  const invalid = draft !== null && (draft.trim() === "" || !Number.isInteger(number) || number < min || number > max);
  return <label className="flex flex-col gap-0.5">
    <span className="text-[10px] text-[#a6adc8]">{label}</span>
    <input type="text" inputMode="numeric" data-testid={testId} aria-label={ariaLabel} aria-invalid={invalid}
      disabled={disabled} value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === null || invalid) return;
        if (number !== value) onCommit(number);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(null); }
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      }}
      className={`w-[4.5rem] rounded border bg-[#1e1e2e] px-1 py-0.5 text-right font-mono text-[11px] text-[#cdd6f4] disabled:opacity-40 ${invalid ? "border-[#f38ba8]" : "border-[#45475a]"}`} />
    {invalid ? <span role="alert" className="max-w-32 text-[10px] text-[#f38ba8]">Inteiro de {min} a {max}. Esc cancela.</span> : null}
  </label>;
}

type ObjectPathProps = {
  path: PathComponent | null | undefined;
  blockedReason: string | null;
  fps: number;
  /** Project + scene + entity: switching context discards any uncommitted draft. */
  contextKey: string;
  onChange: (next: PathComponent | null) => void;
};

export function ObjectPathSection(props: ObjectPathProps) {
  return <ObjectPathEditor key={props.contextKey} {...props} />;
}

/** Same components.path, undo command and persistence as the Canvas handles. */
function ObjectPathEditor({ path, blockedReason, fps, onChange }: ObjectPathProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ellipse, setEllipse] = useState({ rx: "48", ry: "24", segments: "8", frames: "15" });
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
  const commit = (next: PathComponent) => {
    const reason = pathIssue(next);
    if (reason) { setError(reason); return; }
    if (blockedReason) { setError(blockedReason); return; }
    setError(null);
    onChange(next);
  };
  const field = (index: number, key: "x" | "y" | "frames" | "wait", label: string, min: number, max: number, disabled = false) => (
    <PathNumberField key={`${index}:${key}:${path.points[index]![key]}`} value={path.points[index]![key]}
      label={label} ariaLabel={`Ponto ${index}: ${label}`} testId={`inspector-path-${key}-${index}`} min={min} max={max} disabled={disabled || Boolean(blockedReason)}
      onCommit={(value) => commit(withPoint(path, index, { [key]: value }))} />
  );
  const curveField = (index: number, axis: "x" | "y") => (
    <PathNumberField key={`${index}:c${axis}:${path.points[index]!.curve![axis]}`} value={path.points[index]!.curve![axis]}
      label={`Controle ${axis.toUpperCase()}`} ariaLabel={`Ponto ${index}: controle ${axis.toUpperCase()}`} testId={`inspector-path-c${axis}-${index}`} min={-PATH_MAX_OFFSET} max={PATH_MAX_OFFSET} disabled={Boolean(blockedReason)}
      onCommit={(value) => commit(withPoint(path, index, { curve: { ...path.points[index]!.curve!, [axis]: value } }))} />
  );
  const cycle = pathCycleFrames(path);
  return (
    <section data-testid="inspector-path" className="border-b border-[#313244] px-3 py-2 text-[10px] text-[#cdd6f4]">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89b4fa]">Trajeto <span className="font-normal normal-case text-[#7f849c]">(Experimental · Mega Drive)</span></p>
        <button type="button" data-testid="inspector-path-remove" onClick={() => onChange(null)} className="ml-auto rounded px-1 text-[#f38ba8] hover:bg-[#313244]">Remover trajeto</button>
      </div>
      <label className="mt-1 flex items-center gap-1">
        <span className="text-[#a6adc8]">Repetição</span>
        <select data-testid="inspector-path-mode" value={path.mode} disabled={Boolean(blockedReason)} onChange={(event) => {
          const proposal = planPathModeChange(path, event.target.value as PathComponent["mode"]);
          if ("issue" in proposal) { setError(proposal.issue); return; }
          setNotice(proposal.notice);
          commit(proposal.path);
        }} className="rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-[10px] text-[#cdd6f4]">
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
          disabled={Boolean(blockedReason)} onChange={(event) => commit({ ...path, autostart: event.target.checked })}
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
                disabled={Boolean(blockedReason)} onClick={() => commit(toggleCurve(path, index))}
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
              <button type="button" data-testid={`inspector-path-delete-${index}`} aria-label={`Remover ponto ${index}`} disabled={Boolean(blockedReason)} onClick={() => commit(removePoint(path, index))} className="mb-0.5 rounded px-1 text-[#f38ba8] hover:bg-[#313244]">×</button>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" data-testid="inspector-path-add-point" disabled={Boolean(blockedReason) || path.points.length >= PATH_MAX_POINTS} onClick={() => commit(addPoint(path))} className="shrink-0 whitespace-nowrap rounded border border-[#313244] px-2 py-0.5 text-[#cdd6f4] hover:border-[#89b4fa] disabled:opacity-40">+ Ponto</button>
        <span className="text-[9px] text-[#7f849c]">{path.points.length}/{PATH_MAX_POINTS} · {path.mode === "once" ? "percurso (inclui espera inicial)" : "ciclo (de chegada a chegada na origem)"} {cycle} q (~{(cycle / fps).toFixed(1)} s a {fps} Hz NTSC; espera inicial {path.points[0]!.wait} q)</span>
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-[#a6adc8]">Gerar elipse (substitui os pontos)</summary>
        <div className="mt-1 flex flex-wrap items-end gap-1">
          {(["rx", "ry", "segments", "frames"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#7f849c]">{{ rx: "Raio X (px)", ry: "Raio Y (px)", segments: "Curvas", frames: "Quadros/curva" }[key]}</span>
              <input
                type="text" inputMode="numeric"
                aria-label={{ rx: "Raio X da elipse", ry: "Raio Y da elipse", segments: "Segmentos da elipse", frames: "Quadros por curva da elipse" }[key]}
                data-testid={`inspector-path-ellipse-${key}`}
                value={ellipse[key]}
                min={key === "segments" ? 4 : 1}
                max={key === "segments" ? PATH_MAX_POINTS : key === "frames" ? PATH_MAX_FRAMES : PATH_MAX_OFFSET / 2}
                onChange={(event) => setEllipse((current) => ({ ...current, [key]: event.target.value }))}
                className="w-16 rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-right font-mono text-[10px] text-[#cdd6f4]"
              />
            </label>
          ))}
          <button
            type="button"
            data-testid="inspector-path-ellipse-apply"
            disabled={Boolean(blockedReason)}
            onClick={() => {
              const values = Object.fromEntries(Object.entries(ellipse).map(([key, raw]) => [key, Number(raw)]));
              if (Object.values(ellipse).some((raw) => raw.trim() === "") || !Object.values(values).every(Number.isInteger) ||
                values.rx! < 1 || values.rx! > PATH_MAX_OFFSET / 2 || values.ry! < 1 || values.ry! > PATH_MAX_OFFSET / 2 ||
                values.segments! < 4 || values.segments! > PATH_MAX_POINTS || values.frames! < 1 || values.frames! > PATH_MAX_FRAMES) {
                setError("Elipse: raios inteiros de 1 a 1024 px, 4 a 16 curvas e 1 a 600 quadros/curva.");
                return;
              }
              commit({ ...path, ...ellipsePath(values.rx!, values.ry!, values.segments!, values.frames!) });
              setNotice("Os pontos foram substituídos pela elipse. Acionamento preservado; Desfazer restaura a geometria anterior.");
            }}
            className="rounded border border-[#313244] px-2 py-0.5 text-[#cdd6f4] hover:border-[#89b4fa]"
          >
            Aplicar elipse
          </button>
        </div>
        <p className="mt-0.5 text-[9px] text-[#7f849c]">Aproximação por curvas quadráticas; começa na posição do objeto (ponto mais à esquerda) e repete.</p>
      </details>
      {notice ? <p role="status" className="mt-1 text-[11px] text-[#a6adc8]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-1 text-[#f38ba8]">{error}</p> : null}
      {issue ? <p data-testid="inspector-path-issue" role="alert" className="mt-1 text-[#f38ba8]">A build recusará: {issue}.</p> : null}
      {blockedReason ? <p className="mt-1 text-[#fab387]">{blockedReason}</p> : null}
    </section>
  );
}
