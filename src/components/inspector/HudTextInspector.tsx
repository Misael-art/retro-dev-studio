import { useRef, useState } from "react";

import { hudMaxValue, hudProblems, hudSampleText, strikeIds, MD_TEXT_COLUMNS, MD_TEXT_ROWS } from "../../core/hudText";
import type { Entity, HudTextComponent } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";

/**
 * Texto de interface (Experimental, REQ-15): rótulo, posição na grade de texto do destino e valor
 * ligado (vida de um golpe autoral ou variável). Cada alteração é uma entrada de desfazer.
 */
export default function HudTextInspector({ entity }: { entity: Entity }) {
  const activeScene = useEditorStore((state) => state.activeScene);
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const hud = entity.components.hud!;
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const problems = hudProblems(hud, activeScene);
  const strikes = strikeIds(activeScene);


  const apply = (patch: Partial<HudTextComponent>) => {
    updateEntity(entity.entity_id, { components: { hud: { ...hud, ...patch } } });
  };
  const numberField = (key: "column" | "row" | "digits", label: string, max: number) => (
    <label className="flex flex-col">
      <span>{label}</span>
      <input
        data-testid={`inspector-hud-${key}`}
        type="number"
        min={0}
        max={max}
        value={key === "digits" ? hud.digits ?? 3 : hud[key]}
        onChange={(event) => {
          const value = Number.parseInt(event.target.value, 10);
          if (Number.isInteger(value)) apply({ [key]: value });
        }}
        className="w-14 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
      />
    </label>
  );

  return (
    <section
      data-testid="inspector-hud"
      aria-label="Texto de interface"
      className="space-y-1.5 border-b border-[#313244] px-3 py-2 text-[10px] text-[#cdd6f4]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-[#f5c2e7]">Texto (interface)</span>
        <span className="rounded bg-[#1e293b] px-1 text-[9px] text-[#94a3b8]">Experimental</span>
      </div>
      <label className="flex flex-col">
        <span>Texto</span>
        <input
          data-testid="inspector-hud-label"
          ref={labelInputRef}
          type="text"
          value={labelDraft ?? hud.label}
          onChange={(event) => setLabelDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          onBlur={() => {
            if (labelDraft !== null && labelDraft !== hud.label) apply({ label: labelDraft });
            setLabelDraft(null);
          }}
          className="rounded border border-[#45475a] bg-[#11111b] px-1"
        />
      </label>
      <div className="flex gap-2">
        {numberField("column", `Coluna (0–${MD_TEXT_COLUMNS - 1})`, MD_TEXT_COLUMNS - 1)}
        {numberField("row", `Linha (0–${MD_TEXT_ROWS - 1})`, MD_TEXT_ROWS - 1)}
        {hud.value && !hud.bar_tiles ? numberField("digits", "Dígitos mínimos", 5) : null}
      </div>
      <label className="flex flex-col">
        <span>Mostrar valor</span>
        <select
          data-testid="inspector-hud-binding"
          value={hud.value ? `${hud.value.kind}:${hud.value.source}` : ""}
          onChange={(event) => {
            const [kind, source] = event.target.value.split(":");
            if (kind === "logic_var") return;
            apply({ value: kind === "strike_hp" ? { kind, source } : null, ...(kind ? {} : { bar_tiles: undefined }) });
          }}
          className="rounded border border-[#45475a] bg-[#11111b]"
        >
          <option value="">Só texto</option>
          {hud.value?.kind === "logic_var" ? (
            <option value={`logic_var:${hud.value.source}`}>Variável do grafo {hud.value.source}</option>
          ) : null}
          {strikes.map((id) => (
            <option key={id} value={`strike_hp:${id}`}>
              Vida do alvo do golpe {id}
            </option>
          ))}
        </select>
      </label>
      {hud.value?.kind === "strike_hp" ? <label className="flex flex-col">
        Blocos da barra (0 para número)
        <input type="number" min={0} max={16} data-testid="inspector-hud-bar-tiles" value={hud.bar_tiles ?? 0}
          onChange={(event) => {
            const tiles = event.target.valueAsNumber;
            if (Number.isInteger(tiles) && tiles >= 0 && tiles <= 16) apply({ bar_tiles: tiles || undefined });
          }} className="w-14 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono" />
      </label> : null}
      <p className="text-[9px] text-[#94a3b8]">
        Posição em blocos de 8 px na tela do Mega Drive (320×224). Fonte padrão do SGDK.
      </p>
      <HudExtremes entity={entity} labelDraft={labelDraft} onReview={() => labelInputRef.current?.focus()} />
      {problems.length > 0 ? (
        <ul role="alert" data-testid="inspector-hud-problems" className="space-y-0.5 text-[#f38ba8]">
          {problems.map((problem) => (
            <li key={problem}>⚠ {problem}</li>
          ))}
        </ul>
      ) : (
        <p data-testid="inspector-hud-ok" className="text-[#a6e3a1]">✓ Cabe na tela e usa a fonte do destino.</p>
      )}
    </section>
  );
}


export function HudExtremes({ entity, labelDraft, onReview, testId = "inspector-hud-extremes", idPrefix = "hud-preview" }: {
  entity: Entity; labelDraft?: string | null; onReview?: () => void; testId?: string; idPrefix?: string;
}) {
  const activeScene = useEditorStore(state => state.activeScene);
  const hud = entity.components.hud!;
  const [preview, setPreview] = useState<{ value: number; text: "original" | "short" | "long"; light: boolean; cameraX: number } | null>(null);
  const maximum = hudMaxValue(hud, activeScene) ?? 99;
  const previewText = preview ? hudSampleText({
    ...hud, label: preview.text === "short" ? "HP " : preview.text === "long" ? "VIDA DO PERSONAGEM - " : labelDraft ?? hud.label,
  }, preview.value, maximum) : "";
  const previewClips = hud.column < 0 || hud.row < 0 || hud.column + previewText.length > MD_TEXT_COLUMNS || hud.row >= MD_TEXT_ROWS;
  return (
      <details data-testid={testId} className="rounded border border-[#45475a] px-2 py-1"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !event.currentTarget.open) return;
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}
        onToggle={(event) => setPreview(event.currentTarget.open ? { value: maximum, text: "original", light: false, cameraX: 0 } : null)}>
        <summary className="cursor-pointer font-semibold">Prévia de situações extremas</summary>
        {preview ? <div className="mt-2 space-y-2">
          <p>Valor simulado · {hud.value ? (hud.value.kind === "logic_var" ? "Variável " : "Vida de ") + hud.value.source : "Texto da cena"}</p>
          {hud.value && <div className="flex flex-wrap gap-1" role="group" aria-label="Valores para ensaio do HUD">
            {[0, 1, 9, 99, maximum].filter((value, index, values) => values.indexOf(value) === index).map((value) =>
              <button type="button" key={value} data-testid={`${idPrefix}-value-${value}`} aria-pressed={preview.value === value}
                onClick={() => setPreview({ ...preview, value })} className="rounded border border-[#45475a] px-2 py-1 aria-pressed:border-[#89b4fa]">
                {value === 0 ? "Vazio (0)" : value === maximum ? `Cheio (${value})` : value}
              </button>)}
          </div>}
          <div className="flex flex-wrap gap-2">
            <label>Texto <select data-testid={idPrefix + "-text"} value={preview.text} className="rounded border border-[#45475a] bg-[#11111b]"
              onChange={(event) => setPreview({ ...preview, text: event.target.value as typeof preview.text })}>
              <option value="original">Da cena</option><option value="short">Curto</option><option value="long">Longo</option>
            </select></label>
            <label><input type="checkbox" data-testid={idPrefix + "-light"} checked={preview.light} onChange={(event) => setPreview({ ...preview, light: event.target.checked })} /> Fundo claro</label>
          </div>
          <label>Deslocamento de câmera na prévia
            <input data-testid={idPrefix + "-camera-x"} type="range" min={0} max={64} value={preview.cameraX}
              onChange={(event) => setPreview({ ...preview, cameraX: event.target.valueAsNumber })} />
          </label>
          <div role="img" aria-label={`Prévia do HUD na coluna ${hud.column}, linha ${hud.row}: ${previewText}`}
            data-testid={idPrefix + "-frame"}
            className={`relative aspect-[10/7] overflow-hidden rounded border font-mono [container-type:inline-size] ${preview.light ? "bg-[#e7debb] text-[#211b25]" : "bg-[#11111b] text-white"}`}
            style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 15px, currentColor 15px 16px)",
              backgroundPositionX: `-${preview.cameraX}px`, backgroundBlendMode: "soft-light" }}>
            <span className="absolute whitespace-pre" style={{ left: `${100 * hud.column / MD_TEXT_COLUMNS}%`,
              top: `${100 * hud.row / MD_TEXT_ROWS}%`, fontSize: "2.3cqw", lineHeight: 1 }}>{previewText}</span>
          </div>
          {previewClips && onReview ? <button type="button" data-testid={idPrefix + "-fit-warning"} className="rounded border border-[#fab387] px-2 py-1 text-[#fab387]"
            onClick={onReview}>O texto excede a área. Revisar texto.</button> : null}
        </div> : null}
      </details>
  );
}
