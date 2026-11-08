import { useState } from "react";
import type { PathComponent } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";
import { describeEntityEditLock, entityEditLock, entityLockScopeKey, resolvedTilemapPlanes } from "../../core/sceneComposition";
import { pathBlockedReason } from "../../core/objectPath";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { persistActiveScene } from "../../core/scenePersistence";
import { ObjectPathSection } from "../inspector/ObjectPathSection";
import { TilemapPlaneControls } from "../inspector/TilemapPlaneControls";
import { SpritePriorityControls } from "../inspector/SpritePriorityControls";
import { EntityPaletteSection, PaletteSummary, PaletteQuickBanks } from "../inspector/PalettePanel";
import Icon from "../common/Icon";

export type CanvasPathTool = "edit" | "line" | "curve" | "ellipse" | "append";

/** Access to existing authoring commands, never another source of scene data. */
export function CanvasAuthoringBar({ pathTool, onPathToolChange }: {
  pathTool: CanvasPathTool; onPathToolChange: (tool: CanvasPathTool) => void;
}) {
  const state = useEditorStore();
  const { activeScene: scene, activeProjectDir: project, activeScenePath: scenePath, selectedEntityId, activeTarget: target, editorMode } = state;
  const [panel, setPanel] = useState<"composition" | "palette" | null>(null);
  const entity = scene?.entities.find((item) => item.entity_id === selectedEntityId);
  const lock = entityEditLock(entity?.entity_id ?? "", scene?.layers, state.lockedEntityIdsByScene[entityLockScopeKey(project, scenePath)] ?? []);
  const blocked = lock.locked ? describeEntityEditLock(lock) : pathBlockedReason(target, entity);
  const context = JSON.stringify([project, scenePath, selectedEntityId]);
  const changePath = (path: PathComponent | null) => {
    if (!entity || lock.locked || (path && blocked)) return;
    state.updateEntity(entity.entity_id, { components: { path } });
    void persistActiveScene(project, "Canvas", "Trajeto atualizado.").catch((error) => state.logMessage("error", `[Canvas] ${String(error)}`));
  };
  const save = () => void persistActiveScene(project, "Canvas").catch((error) => state.logMessage("error", `[Canvas] ${String(error)}`));
  const choosePanel = (next: typeof panel) => {
    if (editorMode === "path") state.setEditorMode("select");
    setPanel((current) => current === next ? null : next);
  };
  const button = "inline-flex shrink-0 items-center gap-1 rounded border border-[#45475a] px-2 py-1 text-[11px] font-semibold text-[#cdd6f4] hover:bg-[#313244] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#89b4fa] aria-pressed:border-[#89b4fa] aria-pressed:bg-[#89b4fa]/15";
  return <div className="shrink-0 border-b border-[#313244] bg-[#181825]" data-testid="canvas-authoring-tools">
    <div className="flex flex-wrap items-center gap-1 px-2 py-1" role="group" aria-label="Autoria no Canvas">
      <button type="button" className={button} aria-pressed={editorMode === "path"} data-testid="viewport-tool-path"
        onClick={() => { setPanel(null); onPathToolChange(entity?.components.path ? "edit" : "line"); state.setEditorMode(editorMode === "path" ? "select" : "path"); }}>
        <Icon name="fork" size={16} /> Trajeto (P)
      </button>
      <button type="button" className={button} aria-pressed={panel === "composition" && editorMode !== "path"} onClick={() => choosePanel("composition")} data-testid="viewport-tool-composition">
        <Icon name="layers" size={16} /> Composição
      </button>
      <button type="button" className={button} aria-pressed={panel === "palette" && editorMode !== "path"} onClick={() => choosePanel("palette")} data-testid="viewport-tool-palette">
        <Icon name="palette" size={16} /> Paletas
      </button>
      {entity ? <span className="min-w-0 truncate px-1 text-[11px] text-[#a6adc8]" title={getEntityDisplayName(entity)}>{getEntityDisplayName(entity)}{lock.locked ? ` · ${describeEntityEditLock(lock)}` : ""}</span> : <span className="text-[11px] text-[#a6adc8]">Selecione um objeto na cena ou na árvore.</span>}
      {(editorMode === "path" || panel) ? <button type="button" className={button} aria-label="Fechar ferramenta do Canvas" onClick={() => { setPanel(null); state.setEditorMode("select"); }}>Fechar</button> : null}
    </div>
    {editorMode === "path" ? <div className="max-h-[min(32vh,220px)] overflow-auto" data-testid="canvas-path-context">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1" role="group" aria-label="Geometria do trajeto">
        {([ ["edit", "Editar alças"], ["line", "Reta"], ["curve", "Curva"], ["ellipse", "Elipse"], ["append", "+ Ponto"] ] as const).map(([tool, label]) => <button key={tool} type="button" className={button} disabled={Boolean(blocked)} aria-pressed={pathTool === tool} onClick={() => onPathToolChange(tool)} data-testid={`canvas-path-${tool}`}>{label}</button>)}
      </div>
      <p className="px-3 py-1 text-[11px] text-[#a6adc8]">{blocked ?? (pathTool === "edit" ? "Arraste pontos e losangos. Selecione uma alça para ajustar com setas (Shift: 8 px). Esc cancela o gesto." : pathTool === "append" ? "Clique no Canvas para inserir um ponto relativo ao objeto. Cada clique pode ser desfeito." : "Arraste no Canvas a partir do objeto para substituir a forma. Uma operação de Desfazer restaura os pontos. Esc cancela.")}</p>
      {entity ? <details className="px-2 pb-1" key={context}>
        <summary className="cursor-pointer py-1 text-[11px] text-[#cdd6f4]">Precisão · pontos, duração, esperas e reprodução</summary>
        <ObjectPathSection contextKey={context} path={entity.components.path} fps={60} blockedReason={blocked} onChange={changePath} />
      </details> : null}
    </div> : panel === "composition" ? <div className="max-h-[min(32vh,220px)] overflow-auto" data-testid="canvas-composition-context">
      {entity?.components.tilemap ? <TilemapPlaneControls key={context} tilemap={entity.components.tilemap} entities={scene?.entities ?? []} entityId={entity.entity_id}
        implicitPlane={resolvedTilemapPlanes((scene?.entities ?? []).map((item) => item.entity_id === entity.entity_id ? { ...item, components: { ...item.components, tilemap: { ...entity.components.tilemap!, plane: null } } } : item)).find((item) => item.entityId === entity.entity_id)?.plane ?? "desconhecido"}
        blockedReason={lock.locked ? describeEntityEditLock(lock) : target !== "megadrive" ? "Planos/prioridade de tilemap disponíveis somente no Mega Drive (Experimental)." : null}
        onChange={(patch) => { state.updateEntity(entity.entity_id, { components: { tilemap: { ...entity.components.tilemap!, ...patch } } }); save(); }} /> : null}
      {entity?.components.sprite ? <SpritePriorityControls value={entity.components.sprite.priority ?? "foreground"} target={target} disabled={lock.locked}
        onChange={(priority) => { state.updateEntity(entity.entity_id, { components: { sprite: { ...entity.components.sprite!, priority } } }); save(); }} /> : null}
      {!entity?.components.tilemap && !entity?.components.sprite ? <p className="px-3 py-2 text-[11px] text-[#a6adc8]">Selecione um mapa ou sprite. Isolamento e sonda de câmera continuam na barra acima.</p> : null}
    </div> : panel === "palette" ? <div className="max-h-[min(32vh,220px)] overflow-auto" data-testid="canvas-palette-context">
      <PaletteQuickBanks key={`banks:${context}`} entityId={entity?.entity_id ?? null} />
      {entity ? <EntityPaletteSection key={context} entityId={entity.entity_id} /> : null}<PaletteSummary />
    </div> : null}
  </div>;
}
