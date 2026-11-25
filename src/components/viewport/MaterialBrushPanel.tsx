import { useState } from "react";
import type { CollisionMap, Entity, SurfaceMaterial } from "../../core/ipc/sceneService";

type Props = {
  map: CollisionMap;
  entities: readonly Entity[];
  brush?: string | null;
  onBrush: (material: string | null | undefined) => void;
  onSave: (material: SurfaceMaterial) => void;
  onCell: (index: number) => void;
};

const control = "rounded border border-[#45475a] bg-[#11111b] px-1 py-0.5";

export default function MaterialBrushPanel({ map, entities, brush, onBrush, onSave, onCell }: Props) {
  const materials = map.materials ?? [];
  const sounds = [...new Set(entities.flatMap((entity) => Object.keys(entity.components.audio?.sfx ?? {})))].sort();
  const [selected, select] = useState("");
  const [name, setName] = useState("");
  const [friction, setFriction] = useState("0");
  const [sound, setSound] = useState("");
  const [column, setColumn] = useState("0");
  const [row, setRow] = useState("0");
  const current = materials.find((material) => material.name === selected);
  const label = name.trim();
  const frictionValue = Number(friction);
  const valid = label.length > 0 && new TextEncoder().encode(label).length <= 32 && friction !== ""
    && Number.isInteger(frictionValue) && frictionValue >= 0 && frictionValue <= 16
    && (Boolean(current) || (materials.length < 15 && !materials.some((material) => material.name === label)));
  const col = Number(column);
  const line = Number(row);
  const index = line * map.width + col;
  const canPaint = brush !== undefined && column !== "" && row !== "" && Number.isInteger(col) && Number.isInteger(line)
    && col >= 0 && col < map.width && line >= 0 && line < map.height && map.data[index] === 1;

  function load(next: string) {
    const item = materials.find((material) => material.name === next);
    select(next);
    setName(item?.name ?? "");
    setFriction(String(item?.friction ?? 0));
    setSound(item?.step_sound ?? "");
  }

  return (
    <section data-testid="material-brush-panel" aria-label="Materiais de superfície" className="flex shrink-0 flex-wrap items-end gap-2 border-b border-[#313244] px-3 py-2 text-[11px] text-[#cdd6f4]">
      <label className="grid">Regra da superfície
        <select data-testid="material-rule" className={control} value={selected} onChange={(event) => load(event.target.value)}>
          <option value="">Novo material</option>
          {materials.map((material) => <option key={material.name}>{material.name}</option>)}
        </select>
      </label>
      <label className="grid">Nome
        <input data-testid="material-name" className={control + " w-28"} maxLength={32} value={name}
          readOnly={Boolean(current)} onChange={(event) => setName(event.target.value)} placeholder="Gelo" />
      </label>
      <label className="grid">Atrito (0–16)
        <input data-testid="material-friction" className={control + " w-16"} type="number" min={0} max={16}
          value={friction} onChange={(event) => setFriction(event.target.value)} />
      </label>
      <label className="grid">Som de passo
        <select data-testid="material-step-sound" className={control} value={sound} onChange={(event) => setSound(event.target.value)}>
          <option value="">Sem som</option>
          {sounds.map((action) => <option key={action}>{action}</option>)}
        </select>
      </label>
      <button type="button" data-testid="material-save-rule" className={control + " disabled:opacity-45"} disabled={!valid}
        onClick={() => {
          onSave({ name: label, friction: frictionValue, step_sound: sound || undefined, cells: current?.cells ?? [] });
          select(label);
          onBrush(label);
        }}>Gravar regra</button>
      <button type="button" data-testid="material-paint" className={control + " disabled:opacity-45"}
        aria-pressed={Boolean(current && brush === current.name)} disabled={!current} onClick={() => current && onBrush(current.name)}>
        Pintar material
      </button>
      <button type="button" data-testid="material-erase" className={control} aria-pressed={brush === null}
        onClick={() => onBrush(null)}>Limpar material</button>
      <label className="grid">Coluna
        <input data-testid="material-column" className={control + " w-14"} type="number" min={0} max={map.width - 1}
          value={column} onChange={(event) => setColumn(event.target.value)} />
      </label>
      <label className="grid">Linha
        <input data-testid="material-row" className={control + " w-14"} type="number" min={0} max={map.height - 1}
          value={row} onChange={(event) => setRow(event.target.value)} />
      </label>
      <button type="button" data-testid="material-paint-cell" className={control + " disabled:opacity-45"} disabled={!canPaint}
        onClick={() => onCell(index)}>Aplicar na célula</button>
      <span data-testid="material-brush-scope" role="status" className="basis-full text-[#a6adc8]">
        {current ? current.cells.length + " células usam esta regra. " : ""}Pinte sobre células sólidas do mapa.
      </span>
    </section>
  );
}
