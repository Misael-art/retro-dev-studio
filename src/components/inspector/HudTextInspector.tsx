import { useState } from "react";

import { hudProblems, strikeIds, MD_TEXT_COLUMNS, MD_TEXT_ROWS } from "../../core/hudText";
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
        {hud.value ? numberField("digits", "Dígitos", 5) : null}
      </div>
      <label className="flex flex-col">
        <span>Mostrar valor</span>
        <select
          data-testid="inspector-hud-binding"
          value={hud.value ? `${hud.value.kind}:${hud.value.source}` : ""}
          onChange={(event) => {
            const [kind, source] = event.target.value.split(":");
            apply({ value: kind ? { kind: kind as "strike_hp", source } : null });
          }}
          className="rounded border border-[#45475a] bg-[#11111b]"
        >
          <option value="">Só texto</option>
          {strikes.map((id) => (
            <option key={id} value={`strike_hp:${id}`}>
              Vida do alvo do golpe {id}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[9px] text-[#94a3b8]">
        Posição em blocos de 8 px na tela do Mega Drive (320×224). Fonte padrão do SGDK.
      </p>
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
