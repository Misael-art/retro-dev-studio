import type { TilemapComponent } from "../../core/ipc/sceneService";

/**
 * R5: explicit hardware plane and priority of a tilemap (Experimental · Mega Drive). Same data
 * the build reads; "Automático" keeps the previous implicit order (1st BG_B, 2nd BG_A).
 */
export function TilemapPlaneControls({
  tilemap,
  implicitPlane,
  onChange,
}: {
  tilemap: TilemapComponent;
  /** Plane the build assigns today when no explicit choice exists. */
  implicitPlane: string;
  onChange: (patch: Partial<TilemapComponent>) => void;
}) {
  const value = tilemap.plane ?? "";
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
          onChange={(event) => onChange({ plane: event.target.value === "" ? null : (event.target.value as "BG_A" | "BG_B") })}
          className="rounded border border-[#313244] bg-[#1e1e2e] px-1 py-0.5 text-[10px] text-[#cdd6f4]"
        >
          <option value="">Automático (hoje: {implicitPlane})</option>
          <option value="BG_A">BG_A — plano da frente</option>
          <option value="BG_B">BG_B — plano do fundo</option>
        </select>
      </label>
      <label className="mt-1 flex items-center gap-1 text-[#a6adc8]">
        <input
          type="checkbox"
          data-testid="inspector-tilemap-priority"
          checked={Boolean(tilemap.priority)}
          onChange={(event) => onChange({ priority: event.target.checked })}
        />
        Na frente dos sprites
        <span className="text-[9px] text-[#7f849c]">(prioridade alta: cobre sprites de prioridade baixa, ex.: pilastra sobre o personagem)</span>
      </label>
      <p className="mt-0.5 text-[9px] text-[#7f849c]">Cobre o plano inteiro; recorte de regiões fica para a ferramenta de oclusão.</p>
    </div>
  );
}
