import Dialog from "../common/Dialog";
import type { SceneArtworkOrigin, SceneArtworkSample } from "./sceneArtworkRenderer";

export type SceneProbePoint = { x: number; y: number };
export type ScenePointProbe = { point: SceneProbePoint; samples: SceneArtworkSample[]; error?: string };

export default function ScenePointInspector({ probe, onClose, onRead, onPick, onOpen } : {
  probe: ScenePointProbe | null;
  onClose: () => void;
  onRead: (point: SceneProbePoint) => void;
  onPick: () => void;
  onOpen: (origin: SceneArtworkOrigin, target: "asset" | "logic" | "layer" | "palette") => void;
}) {
  return (
    <Dialog title="Inspecionar este ponto" open={probe !== null} onClose={onClose} testId="scene-point-inspector"
      description="Contribuições do Canvas, da frente para trás. Consulte o quadro pausado para ver o pixel apresentado pelo core.">
      {probe ? (
        <div className="space-y-3">
          <form key={`${probe.point.x},${probe.point.y}`} className="flex flex-wrap items-end gap-2 text-xs" onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            onRead({ x: Number(fields.get("x")), y: Number(fields.get("y")) });
          }}>
            {(["x", "y"] as const).map((axis) => (
              <label key={axis} className="grid gap-1">
                {axis.toUpperCase()} no mundo
                <input name={axis} type="number" required defaultValue={probe.point[axis]} step="1" data-testid={`scene-probe-${axis}`}
                  className="w-24 rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] p-1" />
              </label>
            ))}
            <button type="submit" data-testid="scene-probe-read" className="rounded border border-[var(--rds-border-default)] px-2 py-1">Ler ponto</button>
            <button type="button" onClick={onPick} data-testid="scene-probe-pick" className="rounded border border-[var(--rds-border-default)] px-2 py-1">Escolher no Canvas</button>
          </form>
          {probe.error ? <p role="status" className="text-sm text-[var(--rds-status-warning)]">{probe.error}</p> : null}
          {probe.samples.length ? (
            <ol className="grid gap-2" data-testid="scene-probe-sources">
              {probe.samples.map((sample) => (
                <li key={sample.id} data-testid={`scene-probe-source-${sample.id}`} className="rounded border border-[var(--rds-border-subtle)] p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true" className="h-4 w-4 rounded border border-current" style={{ background: `rgba(${sample.rgba.slice(0, 3).join(",")},${sample.rgba[3] / 255})` }} />
                    <strong>{sample.name}</strong>
                    <span>{sample.kind === "sprite" ? "Sprite" : sample.plane ?? "Plano de cenário"}</span>
                    <output className="font-mono">{sample.rgba.join(" / ")}</output>
                  </div>
                  <p className="mt-1 break-all text-[var(--rds-text-secondary)]">{sample.path}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" className="underline" data-testid={`scene-probe-open-${sample.id}`} onClick={() => onOpen(sample, "asset")}>Abrir recurso</button>
                    {sample.entityId ? <button type="button" className="underline" onClick={() => onOpen(sample, "palette")}>Paleta</button> : null}
                    {sample.entityId ? <button type="button" className="underline" onClick={() => onOpen(sample, "logic")}>Abrir lógica</button> : null}
                    {sample.layerId ? <button type="button" className="underline" onClick={() => onOpen(sample, "layer")}>Selecionar camada</button> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : !probe.error ? <p role="status" className="text-sm">Nenhum recurso visível nesse ponto.</p> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
