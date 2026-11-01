import { useEffect, useRef, useState, type PointerEvent } from "react";
import Dialog from "../common/Dialog";
import { useEditorStore } from "../../core/store/editorStore";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { requestAppCommand } from "../../core/sceneAttentionStore";
import { CAMERA_PATTERNS, activeVisualCamera, cameraFrame, cameraPreset, cameraValidation,
  cameraWorldArea, initialCameraSample, sampleCamera, type CameraSample } from "../../core/cameraWorkflow";
import type { CameraComponent, Entity, VisualCameraConfig } from "../../core/ipc/sceneService";

const button = "min-h-8 rounded border border-[var(--rds-border-default)] px-3 py-1 text-xs hover:bg-[var(--rds-surface-hover)] disabled:opacity-40";
const input = "w-full rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] p-1.5 text-sm";
type Draft = { entity: Entity; camera: CameraComponent; revision: number; isNew: boolean };

export default function CameraConfigurator({ entityId }: { entityId?: string }) {
  const { activeScene: scene, activeTarget: target, projectSessionId, sceneRevision } = useEditorStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<CameraSample>(initialCameraSample);
  const [probe, setProbe] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const frame = cameraFrame(target);
  const config = draft?.camera.visual;
  const cameraEntity = scene?.entities.find(e => e.entity_id === entityId && e.components.camera)
    ?? (scene ? activeVisualCamera(scene) : undefined) ?? scene?.entities.find(e => e.components.camera);
  useEffect(() => { setDraft(null); setPlaying(false); }, [projectSessionId, scene?.scene_id]);
  useEffect(() => {
    if (draft) setPreview(old => sampleCamera(draft.camera, draft.entity.transform, probe, target, old));
  }, [draft, target, probe]);
  useEffect(() => {
    if (!playing || !draft) return;
    const timer = window.setInterval(() => setPreview(old => sampleCamera(draft.camera, draft.entity.transform, probe, target, old)), 1000 / 60);
    return () => window.clearInterval(timer);
  }, [playing, draft, target, probe]);

  function open() {
    if (!scene) return;
    const entity: Entity = cameraEntity ?? { entity_id: `camera_${crypto.randomUUID()}`, display_name: "Câmera do jogador",
      prefab: null, transform: { x: 0, y: 0 }, components: { camera: {} } };
    const camera = structuredClone(entity.components.camera ?? {});
    const followed = scene.entities.find(e => e.entity_id === camera.follow_entity && e.components.sprite)
      ?? scene.entities.find(e => e.components.sprite);
    if (!camera.visual) {
      camera.visual = cameraPreset(camera.follow_entity ? "platformer" : "fixed", cameraWorldArea(scene, target), target);
      camera.offset_x = 0; camera.offset_y = 0;
      camera.follow_entity = followed?.entity_id;
    }
    setProbe(followed?.transform ?? entity.transform);
    setPreview(initialCameraSample());
    setPlaying(false); setDrawing(false);
    setDraft({ entity: structuredClone(entity), camera, revision: sceneRevision, isNew: !cameraEntity });
  }
  function change(patch: Partial<VisualCameraConfig>) {
    setDraft(old => old ? { ...old, camera: { ...old.camera, visual: { ...old.camera.visual!, ...patch } } } : old);
  }
  function apply(test = false) {
    if (!draft || !scene || !config || draft.revision !== sceneRevision || cameraValidation(draft.camera, scene, target).length) return;
    const store = useEditorStore.getState();
    if (draft.isNew) store.addEntity({ ...draft.entity, components: { ...draft.entity.components, camera: draft.camera } });
    else {
      store.beginHistoryCapture();
      for (const other of scene.entities) {
        const c = other.components.camera;
        if (config.active && other.entity_id !== draft.entity.entity_id && c?.visual?.active)
          store.updateEntity(other.entity_id, { components: { ...other.components, camera: { ...c, visual: { ...c.visual, active: false } } } }, { recordHistory: false });
      }
      store.updateEntity(draft.entity.entity_id, { transform: draft.entity.transform,
        components: { ...draft.entity.components, camera: draft.camera } }, { recordHistory: false });
      store.commitHistoryCapture();
    }
    store.setSelectedEntityId(draft.entity.entity_id);
    setDraft(null); setPlaying(false);
    if (test) requestAppCommand("build.run");
  }
  const area = scene ? cameraWorldArea(scene, target) : { x: 0, y: 0, ...frame };
  function point(event: PointerEvent<SVGSVGElement>) {
    const r = event.currentTarget.getBoundingClientRect();
    return { x: Math.round(area.x + (event.clientX-r.left)/r.width*area.width), y: Math.round(area.y + (event.clientY-r.top)/r.height*area.height) };
  }
  function screenPoint(event: PointerEvent<SVGSVGElement>) {
    const r = event.currentTarget.getBoundingClientRect();
    change({ screen_x: Math.max(0,Math.min(frame.width,Math.round((event.clientX-r.left)/r.width*frame.width))),
      screen_y: Math.max(0,Math.min(frame.height,Math.round((event.clientY-r.top)/r.height*frame.height))) });
  }
  const errors = draft && scene ? cameraValidation(draft.camera, scene, target) : [];
  const stale = draft && draft.revision !== sceneRevision;
  const follows = config?.pattern === "platformer" || config?.pattern === "exploration";
  function number(label: string, value: number, onChange: (n: number) => void, min = -16000, max = 16000) {
    return <label className="flex flex-col gap-1 text-xs">{label}<input className={input} type="number" min={min} max={max} step={1}
      aria-label={label} value={value} onChange={e => { if(e.currentTarget.value!=="") onChange(Math.round(Number(e.currentTarget.value))); }} /></label>;
  }
  return <>
    <button type="button" className={button} disabled={!scene} onClick={open} data-testid="configure-camera">Configurar câmera</button>
    <Dialog open={Boolean(draft)} title="Configurar câmera · Experimental" onClose={()=>{setDraft(null);setPlaying(false);}}
      className="w-[min(1000px,96vw)] max-h-[92vh] overflow-y-auto" testId="camera-configurator">
      {draft && config && scene && <div className="space-y-4 p-3 text-[var(--rds-text-primary)]">
        <p className="text-xs">{getEntityDisplayName(draft.entity)} · {target === "snes" ? "SNES" : "Mega Drive"}. Escolha, ajuste e teste no projeto.</p>
        {!draft.entity.components.camera?.visual && <p role="status" className="rounded border p-2 text-xs">Aplicar converte esta câmera para o fluxo visual. Cancelar preserva o legado; Desfazer restaura a configuração anterior.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Padrões de câmera">
          {CAMERA_PATTERNS.map(p=><button key={p.id} type="button" aria-pressed={config.pattern===p.id} data-testid={`camera-pattern-${p.id}`}
            className={`${button} text-left ${config.pattern===p.id?"outline outline-2 outline-[var(--rds-action-primary)]":""}`}
            onClick={()=>change({...cameraPreset(p.id,config.bounds,target),active:config.active})}>
            <span aria-hidden="true" className="block text-lg">{p.motion}</span><strong className="block">{p.name}</strong><span>{p.description}</span>
          </button>)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.active} onChange={e=>change({active:e.target.checked})}/>Câmera ativa ao iniciar a cena</label>
            {follows && <label className="block text-sm">Acompanhar<select aria-label="Personagem acompanhado" className={input} value={draft.camera.follow_entity??""}
              onChange={e=>{const id=e.target.value;setDraft({...draft,camera:{...draft.camera,follow_entity:id}});const found=scene.entities.find(n=>n.entity_id===id);if(found)setProbe(found.transform);}}>
              <option value="">Escolha um personagem</option>{scene.entities.filter(e=>e.components.sprite&&!e.components.camera).map(e=><option key={e.entity_id} value={e.entity_id}>{getEntityDisplayName(e)}</option>)}
            </select></label>}
            {follows && <>
              <p className="text-xs">Arraste o ponto para escolher onde o personagem aparece na tela. Use também as setas do teclado.</p>
              <svg viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" className="h-44 w-full touch-none rounded border bg-[var(--rds-surface-canvas)]" aria-label="Enquadramento do personagem"
                onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);screenPoint(e);}} onPointerMove={e=>{if(e.buttons)screenPoint(e);}}>
                <rect x={config.screen_x-config.dead_zone_x} y={config.screen_y-config.dead_zone_y} width={config.dead_zone_x*2} height={config.dead_zone_y*2} fill="#89b4fa22" stroke="#89b4fa"/>
                <circle cx={config.screen_x} cy={config.screen_y} r="9" fill="#f9e2af" stroke="#11111b" tabIndex={0} role="slider" aria-label="Ponto de enquadramento" aria-valuetext={`${config.screen_x}, ${config.screen_y} pixels`}
                  onKeyDown={e=>{const moves:Record<string,number[]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const m=moves[e.key];if(m){e.preventDefault();change({screen_x:Math.max(0,Math.min(frame.width,config.screen_x+m[0]*(e.shiftKey?8:1))),screen_y:Math.max(0,Math.min(frame.height,config.screen_y+m[1]*(e.shiftKey?8:1)))});}}}/>
              </svg>
              <div className="grid grid-cols-2 gap-2">{number("Ponto na tela X",config.screen_x,n=>change({screen_x:n}),0,frame.width)}{number("Ponto na tela Y",config.screen_y,n=>change({screen_y:n}),0,frame.height)}</div>
              <div className="grid grid-cols-2 gap-2">{number("Resposta horizontal (1 = imediata)",config.response_x,n=>change({response_x:n}),1,60)}{number("Resposta vertical (1 = imediata)",config.response_y,n=>change({response_y:n}),1,60)}</div>
            </>}
            {config.pattern.startsWith("auto_") && <>{number("Velocidade (pixels por segundo; negativo inverte)",config.speed,n=>change({speed:n}))}<label className="flex gap-2 text-sm"><input type="checkbox" checked={config.paused} onChange={e=>change({paused:e.target.checked})}/>Iniciar pausada</label></>}
            {config.pattern==="fixed" && <div className="grid grid-cols-2 gap-2">{number("Posição X",draft.entity.transform.x,n=>setDraft({...draft,entity:{...draft.entity,transform:{...draft.entity.transform,x:n}}}))}{number("Posição Y",draft.entity.transform.y,n=>setDraft({...draft,entity:{...draft.entity,transform:{...draft.entity.transform,y:n}}}))}</div>}
            <details><summary className="cursor-pointer py-2 text-sm">Personalizar</summary><div className="grid grid-cols-2 gap-2 pt-2">
              {follows && <>
              <label className="text-xs"><input type="checkbox" checked={config.horizontal} onChange={e=>change({horizontal:e.target.checked})}/> Liberar horizontal</label>
              <label className="text-xs"><input type="checkbox" checked={config.vertical} onChange={e=>change({vertical:e.target.checked})}/> Liberar vertical</label>
              {number("Âncora estável X",config.anchor_x,n=>change({anchor_x:n}))}{number("Âncora estável Y",config.anchor_y,n=>change({anchor_y:n}))}
              {number("Região livre X (meia largura)",config.dead_zone_x,n=>change({dead_zone_x:n}),0)}{number("Região livre Y (meia altura)",config.dead_zone_y,n=>change({dead_zone_y:n}),0)}
              {number("Antecipação horizontal",config.look_ahead,n=>change({look_ahead:n}),0)}{number("Velocidade máxima (pixels/quadro)",config.max_speed,n=>change({max_speed:n}),1,256)}
              </>}
              {number("Deslocamento X",draft.camera.offset_x??0,n=>setDraft({...draft,camera:{...draft.camera,offset_x:n}}))}{number("Deslocamento Y",draft.camera.offset_y??0,n=>setDraft({...draft,camera:{...draft.camera,offset_y:n}}))}
            </div></details>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Prévia da cena</strong><button type="button" className={button} onClick={()=>setPlaying(!playing)}>{playing?"Pausar prévia":"Reproduzir prévia"}</button><button type="button" className={button} aria-pressed={drawing} onClick={()=>setDrawing(!drawing)}>Desenhar limites</button></div>
            <svg viewBox={`${area.x} ${area.y} ${area.width} ${area.height}`} preserveAspectRatio="none" className="h-64 w-full touch-none rounded border bg-[var(--rds-surface-canvas)]" aria-label="Cena e limites da câmera" data-testid="camera-scene-preview"
              onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);if(drawing)start.current=p;else if(follows){setProbe(p);setPlaying(true);}}}
              onPointerMove={e=>{if(!e.buttons)return;const p=point(e);if(drawing&&start.current){const a=start.current;change({bounds:{x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.max(1,Math.abs(p.x-a.x)),height:Math.max(1,Math.abs(p.y-a.y))}});}else if(follows){setProbe(p);setPlaying(true);}}}
              onPointerUp={()=>{start.current=null;setDrawing(false);}} onPointerCancel={()=>{start.current=null;setDrawing(false);}}>
              {scene.entities.filter(e=>e.components.sprite&&!e.components.camera).map(e=><rect key={e.entity_id} x={e.transform.x} y={e.transform.y} width="12" height="16" fill="#89b4fa66"><title>{getEntityDisplayName(e)}</title></rect>)}
              <rect {...config.bounds} fill="none" stroke="#a6e3a1" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
              <rect x={preview.x} y={preview.y} {...frame} fill="#f9e2af11" stroke="#f9e2af" vectorEffect="non-scaling-stroke"/>
              {follows&&<circle cx={probe.x+config.anchor_x} cy={probe.y+config.anchor_y} r="6" fill="#f38ba8"/>}
            </svg>
            <p className="text-xs">{follows?"Arraste o alvo de teste na cena. ":""}Amarelo: visão do jogador. Verde: área permitida. A prévia não move entidades nem grava posições de teste. Rolagem usa o mapa residente; não carrega mapas ilimitados.</p>
            <div className="grid grid-cols-2 gap-2">{number("Área X",config.bounds.x,n=>change({bounds:{...config.bounds,x:n}}))}{number("Área Y",config.bounds.y,n=>change({bounds:{...config.bounds,y:n}}))}{number("Largura da área",config.bounds.width,n=>change({bounds:{...config.bounds,width:n}}),1)}{number("Altura da área",config.bounds.height,n=>change({bounds:{...config.bounds,height:n}}),1)}</div>
            <button type="button" className={button} onClick={()=>change({bounds:cameraWorldArea(scene,target)})}>Usar limites do cenário</button>
            <p className="text-xs">Câmera na prévia: {preview.x}, {preview.y}. Guias aparecem apenas durante a configuração.</p>
          </div>
        </div>
        {stale&&<p role="alert">A cena mudou durante a configuração. Cancele e abra novamente.</p>}
        {errors.map(error=><p role="alert" key={error} className="text-sm text-[#f38ba8]">{error}</p>)}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-[var(--rds-surface-panel)] py-3">
          <button className={button} data-testid="camera-cancel" type="button" onClick={()=>{setDraft(null);setPlaying(false);}}>Cancelar</button>
          <button className={button} data-testid="camera-apply" type="button" disabled={Boolean(stale)||errors.length>0} onClick={()=>apply()}>Aplicar</button>
          <button className={button} data-testid="camera-test" type="button" disabled={Boolean(stale)||errors.length>0} onClick={()=>apply(true)}>Aplicar e testar projeto</button>
        </div>
      </div>}
    </Dialog>
  </>;
}
