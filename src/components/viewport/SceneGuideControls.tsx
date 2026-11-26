import { useState, type FormEvent } from "react";
import Button from "../common/Button";
import Dialog from "../common/Dialog";

export type SceneGuideOrientation = "vertical" | "horizontal";

export type SceneGuide = {
  id: string;
  orientation: SceneGuideOrientation;
  position: number;
};

type GuideBounds = Record<SceneGuideOrientation, { min: number; max: number }>;

type Props = {
  guides: SceneGuide[];
  bounds: GuideBounds;
  onApply: (id: string | null, orientation: SceneGuideOrientation, position: number) => void;
  onRemove: (id: string) => void;
};

function orientationLabel(orientation: SceneGuideOrientation) {
  return orientation === "vertical" ? "Vertical (X)" : "Horizontal (Y)";
}

export default function SceneGuideControls({ guides, bounds, onApply, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<SceneGuideOrientation>("vertical");
  const [position, setPosition] = useState("");
  const { min, max } = bounds[orientation];

  function edit(guide?: SceneGuide) {
    setId(guide?.id ?? null);
    setOrientation(guide?.orientation ?? "vertical");
    setPosition(guide ? String(guide.position) : "");
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(position);
    if (position === "" || !Number.isInteger(value) || value < min || value > max) return;
    onApply(id, orientation, value);
    setOpen(false);
  }

  return (
    <>
      <Button size="sm" data-testid="viewport-edit-guides" onClick={() => { edit(); setOpen(true); }}>
        Editar guias
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Guias da cena"
        description="Use coordenadas da cena em pixels. As guias ficam na sua área de trabalho."
        className="max-w-sm" testId="viewport-guide-dialog">
        <form onSubmit={apply} className="grid gap-3 text-xs">
          <label className="grid gap-1">
            Guia
            <select value={id ?? ""} onChange={(event) => edit(guides.find((guide) => guide.id === event.target.value))}
              data-testid="viewport-guide-choice" className="rds-surface-panel-strong rds-border-subtle rounded border p-1.5">
              <option value="">Nova guia</option>
              {guides.map((guide) => (
                <option key={guide.id} value={guide.id}>
                  {orientationLabel(guide.orientation)} · {guide.position} px
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Direção
            <select value={orientation} onChange={(event) => setOrientation(event.target.value === "vertical" ? "vertical" : "horizontal")}
              data-testid="viewport-guide-orientation" className="rds-surface-panel-strong rds-border-subtle rounded border p-1.5">
              <option value="vertical">{orientationLabel("vertical")}</option>
              <option value="horizontal">{orientationLabel("horizontal")}</option>
            </select>
          </label>
          <label className="grid gap-1">
            Posição em pixels ({min} a {max})
            <input type="number" value={position} min={min} max={max} step={1} required
              onChange={(event) => setPosition(event.target.value)} data-testid="viewport-guide-position"
              className="rds-surface-panel-strong rds-border-subtle rounded border p-1.5 font-mono" />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            {id && (
              <Button size="sm" variant="danger" onClick={() => { onRemove(id); setOpen(false); }}>
                Remover guia
              </Button>
            )}
            <Button size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" variant="primary" type="submit" data-testid="viewport-guide-apply">Aplicar</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
