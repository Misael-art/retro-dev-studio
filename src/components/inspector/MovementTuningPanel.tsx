import { useEffect, useMemo, useState } from "react";
import type { Entity } from "../../core/ipc/sceneService";
import { getProjectSettings } from "../../core/ipc/projectService";
import { applyMovementNodeTuning, describeMovementTuning, type MovementTuningRow } from "../../core/nodegraph/behaviorLibrary";
import { deserializeNodeGraph } from "../../core/nodegraph/nodeDefinitions";
import { serializeNodeGraph } from "../../core/nodegraph/nodeTypes";
import { useEditorStore } from "../../core/store/editorStore";

/**
 * Movimento e salto (PLAT09, Experimental): uma leitura dos valores que a ROM usa,
 * editando os mesmos nós e campos de física. Não tem fórmula nem store próprios.
 */
export default function MovementTuningPanel({ entity }: { entity: Entity }) {
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const openStudioEditor = useEditorStore((state) => state.openStudioEditor);
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let alive = true;
    if (activeProjectDir && "__TAURI_INTERNALS__" in window) void getProjectSettings(activeProjectDir).then((s) => { if (alive) setFps(s.fps ?? (s.video_standard === "pal" ? 50 : 60)); }, () => undefined);
    return () => { alive = false; };
  }, [activeProjectDir]);
  const logic = entity.components.logic;
  const embedded = typeof logic?.graph === "string" && logic.graph.length > 0;
  const graph = useMemo(() => (embedded ? deserializeNodeGraph(logic?.graph as string) : null), [embedded, logic?.graph]);
  const rows = describeMovementTuning(graph, entity.components.physics, entity.entity_id, fps);
  if (!rows.length) return null;

  const commit = (row: MovementTuningRow, magnitude: number) => {
    if (!Number.isFinite(magnitude)) return;
    if (row.source.kind === "node") {
      if (!graph || !logic) return;
      const next = applyMovementNodeTuning(graph, row.source.nodeId, row.source.param, magnitude);
      updateEntity(entity.entity_id, { components: { ...entity.components, logic: { ...logic, graph: serializeNodeGraph(next) } } });
      return;
    }
    const physics = { ...entity.components.physics };
    const value = Math.max(0, Math.trunc(magnitude));
    if (row.source.field === "gravity_strength") physics.gravity_strength = value;
    else if (row.source.field === "friction") physics.friction = value;
    else {
      const max = { x: physics.max_velocity?.x ?? 0, y: physics.max_velocity?.y ?? 0 };
      if (row.source.field === "max_velocity.x") max.x = value; else max.y = value;
      physics.max_velocity = max;
    }
    updateEntity(entity.entity_id, { components: { ...entity.components, physics } });
  };

  return (
    <section data-testid="movement-tuning" aria-labelledby="movement-tuning-title" className="mt-2 rounded border border-[var(--rds-border-default)] p-2 text-xs">
      <h4 id="movement-tuning-title" className="font-semibold">Movimento e salto <span className="font-normal text-[var(--rds-text-muted)]">· Experimental</span></h4>
      <p className="mt-1 text-[11px] text-[var(--rds-text-muted)]">
        Velocidade mantida e impulso definem a velocidade (1/16 px por quadro); gravidade e frenagem mudam essa velocidade a cada quadro. Deslocamento imediato move o objeto na hora, sem velocidade. Medido a {fps} quadros/s.
      </p>
      {!embedded && logic?.graph_ref ? (
        <p data-testid="movement-tuning-external" className="mt-1 text-[11px]">
          Lógica externa ({logic.graph_ref}): os nós de movimento são editados em Lógica.{" "}
          <button type="button" className="underline" onClick={() => openStudioEditor({ focus: { task: "actions", entityId: entity.entity_id } })}>Abrir lógica</button>
        </p>
      ) : null}
      <table className="mt-1 w-full">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={`movement-row-${row.id}`}>
              <th scope="row" className="py-0.5 pr-2 text-left font-normal">
                {row.label}
                {row.nodeLabel ? <span className="block text-[10px] text-[var(--rds-text-muted)]">nó “{row.nodeLabel}”</span> : null}
              </th>
              <td className="py-0.5">
                {row.raw === null || (row.source.kind === "node" && !embedded) ? (
                  <span className="font-mono">{row.expression ?? row.raw}</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    aria-label={`${row.label} (unidade do backend)`}
                    data-testid={`movement-input-${row.id}`}
                    defaultValue={Math.abs(row.raw)}
                    key={`${row.id}:${row.raw}`}
                    onBlur={(event) => { const v = Number(event.currentTarget.value); if (v !== Math.abs(row.raw ?? 0)) commit(row, v); }}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                    className="w-16 rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] px-1"
                  />
                )}
                <span data-testid={`movement-reading-${row.id}`} className="block text-[10px] text-[var(--rds-text-muted)]">{row.reading}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-[var(--rds-text-muted)]">Aceleração gradual não existe como parâmetro separado no backend atual: a velocidade é definida pelo nó e limitada pela velocidade máxima.</p>
    </section>
  );
}
