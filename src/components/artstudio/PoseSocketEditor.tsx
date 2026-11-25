import { useState } from "react";
import { getEntityDisplayName } from "../../core/entityDisplay";
import type { AnimationDef, Entity, Pivot, PoseAttachment } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";

const inputClass = "min-w-0 rounded border border-[#475569] bg-[#111827] px-1 py-1";
const buttonClass = "rounded border border-[#64748b] px-2 py-1 disabled:opacity-50";

type Props = {
  actor: Entity;
  animation: AnimationDef;
  occurrence: string;
  entities: readonly Entity[];
  onPoints: (points: NonNullable<AnimationDef["pose_sockets"]>[string]) => void;
  marker: Pivot | null;
  onMarker: (point: Pivot | null) => void;
};

export default function PoseSocketEditor({ actor, animation, occurrence, entities, onPoints, marker, onMarker }: Props) {
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const points = animation.pose_sockets?.[occurrence] ?? [];
  const sprite = actor.components.sprite!;
  const eligible = entities.filter((entity) => {
    const c = entity.components;
    return entity.entity_id !== actor.entity_id && !entity.prefab && c.sprite && !c.input && !c.physics && !c.collision
      && !c.path && !c.logic && !c.camera && !c.tilemap && !c.hud
      && (!c.pose_attachment || c.pose_attachment.actor === actor.entity_id)
      && !entities.some((other) => other.components.pose_attachment?.actor === entity.entity_id);
  });
  const [name, setName] = useState("");
  const [childId, setChildId] = useState("");
  const [offset, setOffset] = useState<Pivot>({ x: 0, y: 0 });
  const child = eligible.find((entity) => entity.entity_id === childId);
  const saved = points.find((point) => point.name === name);
  const existingName = Object.values(sprite.animations ?? {}).some((clip) => Object.values(clip.pose_sockets ?? {})
    .some((list) => list.some((point) => point.name === name)));
  const attached = child?.components.pose_attachment;
  const nameValid = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(name);
  const pointValid = marker && Number.isInteger(marker.x) && Number.isInteger(marker.y)
    && marker.x >= 0 && marker.y >= 0 && marker.x < sprite.frame_width && marker.y < sprite.frame_height;
  const offsetValid = [offset.x, offset.y].every((value) => Number.isInteger(value) && Math.abs(value) <= 511);

  function choosePoint(next: string) {
    setName(next);
    onMarker(points.find((point) => point.name === next)?.point ?? null);
  }

  function chooseChild(next: string) {
    setChildId(next);
    const link = eligible.find((entity) => entity.entity_id === next)?.components.pose_attachment;
    setOffset(link?.offset ?? { x: 0, y: 0 });
    if (link) choosePoint(link.socket);
  }

  function applyLink(link: PoseAttachment | null) {
    if (child) updateEntity(child.entity_id, { components: { pose_attachment: link } });
  }

  return (
    <details data-testid="pose-socket-editor" className="rounded border border-[#475569] px-2 py-1"
      onToggle={(event) => {
        if (event.currentTarget.open) onMarker(saved?.point ?? { x: 0, y: 0 });
        else onMarker(null);
      }}>
      <summary className="cursor-pointer font-medium">Encaixes animados</summary>
      <div className="mt-2 grid gap-2">
        {points.length > 0 && (
          <label className="grid gap-0.5">Pontos desta pose
            <select className={inputClass} value={saved ? name : ""} onChange={(event) => choosePoint(event.target.value)}>
              <option value="">Novo ponto</option>
              {points.map((point) => <option key={point.name}>{point.name}</option>)}
            </select>
          </label>
        )}
        <label className="grid gap-0.5">Nome do ponto
          <input data-testid="pose-socket-name" className={inputClass} value={name}
            onChange={(event) => setName(event.target.value)} placeholder="mao" maxLength={32} />
        </label>
        <div className="grid grid-cols-2 gap-1">
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} className="grid gap-0.5">{axis.toUpperCase()} (px)
              <input id={axis === "x" ? "pose-socket-x" : undefined} data-testid={"pose-socket-" + axis}
                className={inputClass} type="number" value={marker && Number.isFinite(marker[axis]) ? marker[axis] : ""}
                onChange={(event) => onMarker({ ...(marker ?? { x: 0, y: 0 }), [axis]: event.target.valueAsNumber })} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" data-testid="pose-socket-save" className={buttonClass}
            disabled={!nameValid || !pointValid || (!saved && points.length >= 16)}
            onClick={() => { if (marker) onPoints([...points.filter((point) => point.name !== name), { name, point: marker }]); }}>
            Gravar ponto
          </button>
          {saved && <button type="button" className={buttonClass}
            disabled={eligible.some((item) => item.components.pose_attachment?.socket === name)
              && Object.entries(animation.pose_sockets ?? {}).every(([id, list]) => id === occurrence || !list.some((p) => p.name === name))}
            onClick={() => onPoints(points.filter((point) => point.name !== name))}>Remover ponto</button>}
        </div>
        <label className="grid gap-0.5">Acessório
          <select data-testid="pose-socket-child" className={inputClass} value={childId} onChange={(event) => chooseChild(event.target.value)}>
            <option value="">Escolha um sprite visual</option>
            {eligible.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>
              {getEntityDisplayName(entity)}{entity.components.pose_attachment ? " · vinculado" : ""}
            </option>)}
          </select>
        </label>
        {child && (
          <>
            <div className="grid grid-cols-2 gap-1">
              {(["x", "y"] as const).map((axis) => (
                <label key={axis} className="grid gap-0.5">Ajuste {axis.toUpperCase()}
                  <input data-testid={"pose-socket-offset-" + axis} className={inputClass} type="number"
                    min={-511} max={511} value={Number.isFinite(offset[axis]) ? offset[axis] : ""}
                    onChange={(event) => setOffset({ ...offset, [axis]: event.target.valueAsNumber })} />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" data-testid="pose-socket-attach" className={buttonClass}
                disabled={!nameValid || !offsetValid || !existingName}
                onClick={() => applyLink({ actor: actor.entity_id, socket: name, offset })}>Vincular acessório</button>
              {attached && <button type="button" data-testid="pose-socket-detach" className={buttonClass}
                onClick={() => applyLink(null)}>Desvincular</button>}
            </div>
            <p className="text-[#94a3b8]">O acessório fica oculto nas poses sem esse ponto.</p>
          </>
        )}
      </div>
    </details>
  );
}
