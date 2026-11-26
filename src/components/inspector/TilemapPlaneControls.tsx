import { useState } from "react";
import { tilemapPlaneIssue } from "../../core/sceneComposition";
import type { Entity, TilemapComponent, TilePriorityRegion } from "../../core/ipc/sceneService";

const regionFields = [
  { key: "x", label: "X", min: 0, dimension: "map_width" },
  { key: "y", label: "Y", min: 0, dimension: "map_height" },
  { key: "width", label: "Largura", min: 1, dimension: "map_width" },
  { key: "height", label: "Altura", min: 1, dimension: "map_height" },
] as const;
const initialRegionDraft = { x: "0", y: "0", width: "1", height: "1", high: true };

/**
 * R5: explicit hardware plane and priority of a tilemap (Experimental · Mega Drive). Same data
 * the build reads; "Automático" keeps the previous implicit order (1st BG_B, 2nd BG_A).
 */
export function TilemapPlaneControls({
  tilemap,
  implicitPlane,
  onChange,
  entities, entityId, blockedReason, onDrawRegion,
}: {
  entities: Entity[];
  entityId: string;
  blockedReason: string | null;
  tilemap: TilemapComponent;
  /** Plane the build assigns today when no explicit choice exists. */
  implicitPlane: string;
  onChange: (patch: Partial<TilemapComponent>) => void;
  onDrawRegion?: (high: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [regionDraft, setRegionDraft] = useState(initialRegionDraft);
  const [editingRegion, setEditingRegion] = useState<{ index: number; region: TilePriorityRegion } | null>(null);
  const regions = tilemap.priority_regions ?? [];
  const value = tilemap.plane ?? "";
  const currentIssue = tilemapPlaneIssue(entities);
  const regionBlocked = Boolean(blockedReason || (tilemap.plane ?? implicitPlane) === "WINDOW");
  const applyRegion = () => {
    const { high } = regionDraft;
    const region: TilePriorityRegion = {
      x: Number(regionDraft.x), y: Number(regionDraft.y),
      width: Number(regionDraft.width), height: Number(regionDraft.height), high,
    };
    if (!regionFields.every(({ key, min }) => regionDraft[key] !== "" && Number.isSafeInteger(region[key]) && region[key] >= min)
        || region.x + region.width > tilemap.map_width || region.y + region.height > tilemap.map_height) {
      setError("Informe uma região inteira dentro do tilemap.");
      return;
    }
    if (editingRegion && regions[editingRegion.index] !== editingRegion.region) {
      setError("A região foi alterada. Abra-a novamente para editar.");
      setEditingRegion(null);
      return;
    }
    setError(null);
    onChange({ priority_regions: editingRegion
      ? regions.map((previous, index) => index === editingRegion.index ? region : previous)
      : [...regions, region] });
    setEditingRegion(null);
  };
  return (
    <div data-testid="inspector-tilemap-plane" className="mb-3 rounded border border-[#313244] bg-[#11111b] p-2 text-[10px] text-[#cdd6f4]">
      <p className="font-semibold text-[#89b4fa]">
        Plano e prioridade <span className="font-normal text-[#7f849c]">(Experimental · Mega Drive)</span>
      </p>
      <label className="mt-1 flex items-center gap-1">
        <span className="text-[#a6adc8]">Plano</span>
        <select
          data-testid="inspector-tilemap-plane-select"
          value={value}
          disabled={Boolean(blockedReason)}
          onChange={(event) => {
            const plane = event.target.value === "" ? null : event.target.value as "BG_A" | "BG_B";
            const proposed = entities.map((entity) => entity.entity_id === entityId
              ? { ...entity, components: { ...entity.components, tilemap: { ...tilemap, plane } } } : entity);
            const issue = tilemapPlaneIssue(proposed);
            setError(issue);
            if (!issue) onChange({ plane });
          }}
          className="rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-[10px] text-[#cdd6f4]"
        >
          <option value="">Automático (hoje: {implicitPlane})</option>
          <option value="BG_A">BG_A — sobre B à mesma prioridade</option>
          <option value="BG_B">BG_B — sob A à mesma prioridade</option>
        </select>
      </label>
      <label className="mt-1 flex items-center gap-1 text-[#a6adc8]">
        <input
          type="checkbox"
          data-testid="inspector-tilemap-priority"
          disabled={Boolean(blockedReason)}
          checked={Boolean(tilemap.priority)}
          onChange={(event) => onChange({ priority: event.target.checked })}
        />
        Prioridade alta por padrão
        <span className="text-[10px] text-[#a6adc8]">Cobre sprites de prioridade baixa; sprites de prioridade alta continuam à frente.</span>
      </label>
      {blockedReason ? <p role="status" className="mt-1 text-[#a6adc8]">{blockedReason}</p> : null}
      {error || currentIssue ? <p role="alert" className="mt-1 text-[#f38ba8]">{error ?? currentIssue}</p> : null}
      <details className="mt-2 rounded border border-[#313244] p-1.5" data-testid="tile-priority-regions">
        <summary className="cursor-pointer font-medium">Regiões de prioridade{regions.length ? ` (${regions.length})` : ""}</summary>
        <p className="mt-1 text-[#a6adc8]">Células locais de 8 × 8 px, contadas do canto superior esquerdo. A última região prevalece onde há sobreposição. O mapa reutiliza os tiles de arte na VRAM.</p>
        <fieldset disabled={regionBlocked} className="mt-1 space-y-2 disabled:opacity-60">
          <legend className="sr-only">{editingRegion ? "Editar região de prioridade" : "Nova região de prioridade"}</legend>
          <label className="flex items-center gap-2">Prioridade da região
            <select data-testid="tile-priority-region-value" value={regionDraft.high ? "high" : "low"}
              onChange={(event) => setRegionDraft((current) => ({ ...current, high: event.target.value === "high" }))}
              className="rounded border border-[#45475a] bg-[#1e1e2e] px-1 text-[#cdd6f4]">
              <option value="high">Alta</option><option value="low">Baixa</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1">
            {regionFields.map(({ key, label, min, dimension }) => <label key={key}>
              {label}
              <input type="number" min={min} max={tilemap[dimension] - (min === 0 ? 1 : 0)} step={1}
                data-testid={`tile-priority-region-${key}`} value={regionDraft[key]}
                className="block w-full rounded border border-[#45475a] bg-[#1e1e2e] px-1 py-0.5"
                onChange={(event) => setRegionDraft((current) => ({ ...current, [key]: event.target.value }))} />
            </label>)}
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" data-testid="tile-priority-region-add" onClick={applyRegion} className="rounded border border-[#89b4fa] px-2 py-1 text-[#89b4fa]">{editingRegion ? "Aplicar edição" : "Adicionar região"}</button>
            {editingRegion ? <button type="button" onClick={() => { setEditingRegion(null); setRegionDraft(initialRegionDraft); setError(null); }}
              className="rounded border border-[#45475a] px-2 py-1">Cancelar edição</button> : null}
            {onDrawRegion && !editingRegion ? <button type="button" data-testid="tile-priority-region-draw" onClick={() => onDrawRegion(regionDraft.high)}
              className="rounded border border-[#45475a] px-2 py-1">Marcar no Canvas</button> : null}
          </div>
          {regions.length ? <ol className="space-y-1">
            {regions.map((region, index) => <li key={index} className="flex items-center justify-between gap-1">
              <span>{region.high ? "Alta" : "Baixa"} · ({region.x}, {region.y}) · {region.width} × {region.height}</span>
              <span className="flex gap-1">
                <button type="button" aria-label={`Editar região ${index + 1}`} data-testid={`tile-priority-region-edit-${index}`}
                  onClick={() => {
                    setEditingRegion({ index, region }); setError(null);
                    setRegionDraft({ x: String(region.x), y: String(region.y), width: String(region.width), height: String(region.height), high: region.high });
                  }} className="rounded border border-[#45475a] px-1 py-0.5">Editar</button>
                <button type="button" aria-label={`Remover região ${index + 1}`} data-testid={`tile-priority-region-remove-${index}`}
                  onClick={() => onChange({ priority_regions: regions.filter((_, i) => i !== index) })} className="rounded border border-[#45475a] px-1 py-0.5">Remover</button>
              </span>
            </li>)}
          </ol> : null}
        </fieldset>
      </details>
    </div>
  );
}
