import { useEffect, useRef, useState, type PointerEvent, type SetStateAction } from "react";
import SceneArtwork from "../viewport/SceneArtwork";
import { resolveSceneWorldMetrics } from "../../core/sceneWorldModel";
import Dialog from "../common/Dialog";
import CameraAdvancedControls, { CameraPatternLibrary } from "./CameraAdvancedControls";
import { useEditorStore } from "../../core/store/editorStore";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { requestAppCommand } from "../../core/sceneAttentionStore";
import { getProjectSettings } from "../../core/ipc/projectService";
import { CAMERA_PATTERNS, activeVisualCamera, cameraAdvanced, cameraFollows, cameraFrame, cameraPreset, cameraValidation,
  cameraWorldArea, cameraPointerPoint, cameraConflictSources, initialCameraSample, sampleCamera, type CameraSample } from "../../core/cameraWorkflow";
import type { CameraComponent, Entity, VisualCameraConfig } from "../../core/ipc/sceneService";

const button = "min-h-8 rounded border border-[var(--rds-border-default)] px-3 py-1 text-xs hover:bg-[var(--rds-surface-hover)] disabled:opacity-40";
const input = "w-full rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] p-1.5 text-sm";
type Draft = { entity: Entity; camera: CameraComponent; revision: number; isNew: boolean };

function CameraNumberField({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number;
}) {
  // Keep incomplete native input (empty or a lone minus) out of the camera model.
  // A controlled numeric value would restore the old number after the minus key.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const incomplete = text === "";
  const invalid = incomplete || !Number.isInteger(Number(text)) || Number(text) < min || Number(text) > max;
  return <label className="flex flex-col gap-1 text-xs">{label}<input className={input} type="number" min={min} max={max} step={1}
    aria-label={label} aria-invalid={invalid} value={text} onChange={e => {
      const next = e.currentTarget.value; setText(next);
      if (next !== "") onChange(Math.round(Number(next)));
    }} onBlur={() => setText(String(value))}/>{invalid && <span role="alert">{incomplete
      ? "Conclua o número. Ao sair, o último valor será restaurado."
      : `Use um inteiro entre ${min} e ${max}.`}</span>}</label>;
}

export default function CameraConfigurator({ entityId }: { entityId?: string }) {
  const { activeScene: scene, activeTarget: target, projectSessionId, sceneRevision, activeProjectDir } = useEditorStore();
  const [fps,setFps]=useState(60),[clockError,setClockError]=useState("");
  const [clockReady,setClockReady]=useState(!activeProjectDir);
  const [draft, setDraftSnapshot] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const history = useRef<{ past: Draft[]; future: Draft[] }>({ past: [], future: [] });
  const gesture = useRef<Draft | null>(null);
  const gestureKind = useRef<"pointer" | "field" | null>(null);
  const focusedField = useRef<HTMLInputElement | null>(null);
  const [, refreshHistory] = useState(0);
  const [mapZoom, setMapZoom] = useState(1);
  const [patternsOpen, setPatternsOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState("player");
  const [mapCenter, setMapCenter] = useState<{ x: number; y: number } | null>(null);
  function setDraft(update: SetStateAction<Draft | null>) {
    const previous = draftRef.current;
    const next = typeof update === "function" ? update(previous) : update;
    if (previous && next && JSON.stringify(previous) !== JSON.stringify(next) && !gesture.current) {
      history.current.past = [...history.current.past.slice(-99), previous]; history.current.future = [];
    } else if (!previous || !next) {
      history.current = { past: [], future: [] }; gesture.current = null; gestureKind.current = null; focusedField.current = null;
    }
    draftRef.current = next; setDraftSnapshot(next); refreshHistory(n => n + 1);
  }
  function travel(redo = false) {
    finishEdit();
    const before = draftRef.current;
    const resumeField = () => {
      if (focusedField.current === document.activeElement && draftRef.current) {
        gesture.current = draftRef.current; gestureKind.current = "field";
      }
    };
    const from = redo ? history.current.future : history.current.past, next = from.pop();
    if (!next || !draftRef.current) { resumeField(); return; }
    (redo ? history.current.past : history.current.future).push(draftRef.current);
    draftRef.current = next; setDraftSnapshot(next); refreshHistory(n => n + 1);
    if (before?.camera.visual?.pattern !== next.camera.visual?.pattern)
      setPreviewMode(["rooms", "sequence"].includes(next.camera.visual!.pattern) ? "map" : "player");
    resumeField();
    setPlaying(false); setPreview(initialCameraSample()); setDrawing(null); setPlacingPoint(null);
  }
  function beginGesture() { finishEdit(); focusedField.current = null; gesture.current = draftRef.current; gestureKind.current = "pointer"; }
  function finishEdit() {
    const before = gesture.current; gesture.current = null;
    gestureKind.current = null;
    if (before && draftRef.current && JSON.stringify(before) !== JSON.stringify(draftRef.current)) {
      history.current.past = [...history.current.past.slice(-99), before]; history.current.future = []; refreshHistory(n => n + 1);
    }
  }
  function endGesture() {
    finishEdit(); start.current = null; setDrawing(null); setPlacingPoint(null);
  }
  const [preview, setPreview] = useState<CameraSample>(initialCameraSample);
  const [probe, setProbe] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [drawing, setDrawing] = useState<string|null>(null);
  const [placingPoint,setPlacingPoint]=useState<number|null>(null);
  const [probeId,setProbeId]=useState("");
  const start = useRef<{ x: number; y: number } | null>(null);
  const previewPanel = useRef<HTMLDivElement | null>(null);
  function revealMap() { setPreviewMode("map"); requestAnimationFrame(() => previewPanel.current?.scrollIntoView({ block: "center" })); }
  const frame = cameraFrame(target);
  const config = draft?.camera.visual;
  const isOpen=Boolean(draft);
  useEffect(() => {
    if (!isOpen) return;
    const localHistory = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault(); event.stopPropagation();
        travel(event.key.toLowerCase() === "y" || event.shiftKey);
      }
    };
    window.addEventListener("keydown", localHistory, true);
    return () => window.removeEventListener("keydown", localHistory, true);
  }, [isOpen]);
  const advanced=config?cameraAdvanced(config):null;
  const previewId=config?.pattern==="arena"?(advanced?.targets.includes(probeId)?probeId:advanced?.targets[0]):draft?.camera.follow_entity;
  const previewPoint=previewId===probeId?probe:scene?.entities.find(e=>e.entity_id===previewId)?.transform??probe;
  const cameraEntity = scene?.entities.find(e => e.entity_id === entityId && e.components.camera)
    ?? (scene ? activeVisualCamera(scene) : undefined) ?? scene?.entities.find(e => e.components.camera);
  useEffect(() => { setDraft(null); setPlaying(false); }, [projectSessionId, scene?.scene_id]);
  useEffect(()=>{
    let current=true;setClockError("");setClockReady(!activeProjectDir);
    if(!activeProjectDir){setFps(60);return;}
    if(!isOpen)return;
    void getProjectSettings(activeProjectDir).then(s=>{if(current){setFps(s.fps??(s.video_standard==="pal"?50:60));setClockReady(true);}}).catch(()=>{if(current)setClockError("A taxa do projeto não pôde ser lida. Reabra o projeto para usar a prévia.");});
    return ()=>{current=false;};
  },[activeProjectDir,projectSessionId,isOpen]);
  useEffect(() => {
    if (draft&&clockReady) setPreview(old => sampleCamera(draft.camera, draft.entity.transform, previewPoint, target, old,fps,
      Object.fromEntries((scene?.entities??[]).filter(e=>e.components.sprite).map(e=>[e.entity_id,e.entity_id===previewId?previewPoint:e.transform]))));
  }, [draft, target, previewPoint, scene, previewId, fps, clockReady]);
  useEffect(() => {
    if (!playing || !draft || !clockReady) return;
    const timer = window.setInterval(() => setPreview(old => sampleCamera(draft.camera, draft.entity.transform, previewPoint, target, old,fps,
      Object.fromEntries((scene?.entities??[]).filter(e=>e.components.sprite).map(e=>[e.entity_id,e.entity_id===previewId?previewPoint:e.transform])))), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, draft, target, previewPoint, scene, previewId, fps, clockReady]);

  function open(id?: string) {
    const { activeScene: scene, sceneRevision } = useEditorStore.getState();
    const selectedCamera = id ? scene?.entities.find(e=>e.entity_id===id&&e.components.camera) : cameraEntity;
    if (!scene) return;
    const entity: Entity = selectedCamera ?? { entity_id: `camera_${crypto.randomUUID()}`, display_name: "Câmera do jogador",
      prefab: null, transform: { x: 0, y: 0 }, components: { camera: {} } };
    const camera = structuredClone(entity.components.camera ?? {});
    const followed = scene.entities.find(e => e.entity_id === camera.follow_entity && e.components.sprite)
      ?? scene.entities.find(e => e.components.sprite);
    if (!camera.visual) {
      camera.visual = cameraPreset(camera.follow_entity ? "platformer" : "fixed", cameraWorldArea(scene, target), target);
      camera.offset_x = 0; camera.offset_y = 0;
      camera.follow_entity = followed?.entity_id;
    }
    setPatternsOpen(!entity.components.camera?.visual);
    setPreviewMode(["rooms", "sequence"].includes(camera.visual!.pattern) ? "map" : "player");
    setProbe(followed?.transform ?? entity.transform);
    setProbeId(followed?.entity_id??"");
    setPreview(initialCameraSample());
    setPlaying(false); setDrawing(null);setPlacingPoint(null);setMapZoom(1);setMapCenter(null);gesture.current=null;
    setDraft({ entity: structuredClone(entity), camera, revision: sceneRevision, isNew: !selectedCamera });
  }
  function change(patch: Partial<VisualCameraConfig>) {
    setDraft(old => old ? { ...old, camera: { ...old.camera, visual: { ...old.camera.visual!, ...patch } } } : old);
  }
  function apply(test = false) {
    if (!draft || !scene || !config || !clockReady || draft.revision !== sceneRevision || cameraValidation(draft.camera, scene, target,draft.entity.transform,draft.entity.entity_id).length) return;
    const store = useEditorStore.getState();
    store.beginHistoryCapture();
    for (const other of scene.entities) {
      const c = other.components.camera;
      if (config.active && other.entity_id !== draft.entity.entity_id && c?.visual?.active)
        store.updateEntity(other.entity_id, { components: { ...other.components, camera: { ...c, visual: { ...c.visual, active: false } } } }, { recordHistory: false });
    }
    if (draft.isNew) store.addEntity({ ...draft.entity, components: { ...draft.entity.components, camera: draft.camera } }, { recordHistory: false });
    else store.updateEntity(draft.entity.entity_id, { transform: draft.entity.transform,
      components: { ...draft.entity.components, camera: draft.camera } }, { recordHistory: false });
    store.commitHistoryCapture();
    store.setSelectedEntityId(draft.entity.entity_id);
    setDraft(null); setPlaying(false);
    if (test) requestAppCommand("build.run");
  }
  const geometryScene = scene && draft ? { ...scene, entities: [...scene.entities.filter(e=>e.entity_id!==draft.entity.entity_id), { ...draft.entity, components:{...draft.entity.components,camera:draft.camera} }] } : scene;
  const world = resolveSceneWorldMetrics(geometryScene, target).bounds;
  const playable = geometryScene ? cameraWorldArea(geometryScene, target) : { x: 0, y: 0, ...frame };
  const fullArea = { x: Math.min(world.minX, config?.bounds.x ?? 0), y: Math.min(world.minY, config?.bounds.y ?? 0),
    width: 0, height: 0 };
  fullArea.width = Math.max(world.maxX, (config?.bounds.x ?? 0) + (config?.bounds.width ?? frame.width)) - fullArea.x;
  fullArea.height = Math.max(world.maxY, (config?.bounds.y ?? 0) + (config?.bounds.height ?? frame.height)) - fullArea.y;
  const area = { x: (mapCenter?.x ?? fullArea.x + fullArea.width / 2) - fullArea.width / mapZoom / 2,
    y: (mapCenter?.y ?? fullArea.y + fullArea.height / 2) - fullArea.height / mapZoom / 2,
    width: fullArea.width / mapZoom, height: fullArea.height / mapZoom };
  function svgPoint(event: PointerEvent<SVGSVGElement>, box: typeof area) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return cameraPointerPoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), box);
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(Math.max(box.x, Math.min(box.x + box.width, p.x))), y: Math.round(Math.max(box.y, Math.min(box.y + box.height, p.y))) };
  }
  function point(event: PointerEvent<SVGSVGElement>) {
    return svgPoint(event, area);
  }
  function screenPoint(event: PointerEvent<SVGSVGElement>) {
    const p = svgPoint(event, { x: 0, y: 0, ...frame });
    change({ screen_x: p.x, screen_y: p.y });
  }
  function choosePattern(id: VisualCameraConfig["pattern"], restore = false) {
    if (!config) return;
    setPatternsOpen(false);
    if (!restore && config.pattern === id) return;
    setPreviewMode(["rooms", "sequence"].includes(id) ? "map" : "player");
    setPreview(initialCameraSample()); setPlaying(false); setDrawing(null); setPlacingPoint(null);
    change({ ...cameraPreset(id, config.bounds, target), active: config.active });
  }
  const errors = draft && scene ? cameraValidation(draft.camera, scene, target,draft.entity.transform,draft.entity.entity_id) : [];
  const stale = draft && draft.revision !== sceneRevision;
  const follows = config&&(cameraFollows(config)||config.pattern==="arena");
  function place(p:{x:number;y:number}){
    if(!config||!advanced)return;
    if(placingPoint!==null)change({advanced:{...advanced,path:advanced.path.map((v,i)=>i===placingPoint?{...v,...p}:v)}});
    else if(drawing&&start.current){const a=start.current,b={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.max(1,Math.abs(p.x-a.x)),height:Math.max(1,Math.abs(p.y-a.y))};
      if(drawing==="bounds")change({bounds:b});else if(drawing==="activation")change({advanced:{...advanced,activation:b}});else change({advanced:{...advanced,rooms:advanced.rooms.map(r=>r.id===drawing?{...r,area:b}:r)}});
    }else if(follows){setProbeId(previewId??"");setProbe(p);setPlaying(true);}
  }
  function number(label: string, value: number, onChange: (n: number) => void, min = -16000, max = 16000) {
    return <CameraNumberField label={label} value={value} onChange={onChange} min={min} max={max}/>;
  }
  const actions = draft && config && scene ? (
        <div className="flex flex-wrap justify-end gap-2 py-3">
          <button className={button} data-testid="camera-cancel" type="button" onClick={()=>{setDraft(null);setPlaying(false);}}>Cancelar</button>
          <button className="rds-button rds-button--primary min-h-8 px-3 text-xs font-semibold" data-testid="camera-apply" type="button" disabled={Boolean(stale)||errors.length>0||!clockReady} onClick={()=>apply()}>Aplicar</button>
          <button className={button} data-testid="camera-test" type="button" disabled={Boolean(stale)||errors.length>0||!clockReady} onClick={()=>apply(true)}>Aplicar e testar projeto</button>
        </div>
  ) : null;
  return <>
    <button type="button" className={button} disabled={!scene} onClick={()=>open()} data-testid="configure-camera">Configurar câmera</button>
    <Dialog open={Boolean(draft)} title="Configurar câmera · Experimental" onClose={()=>{setDraft(null);setPlaying(false);}}
      className="!w-[min(1120px,96vw)] max-h-[92vh]" testId="camera-configurator" footer={actions}>
      {draft && config && scene && <div className="space-y-4 text-[var(--rds-text-primary)]" onFocusCapture={e => {
        const field=e.target;
        if (field instanceof HTMLInputElement && ["text","number"].includes(field.type)) {
          finishEdit(); focusedField.current=field; gesture.current=draftRef.current; gestureKind.current="field";
        }
      }} onBlurCapture={e => {
        if(e.target===focusedField.current){if(gestureKind.current==="field")finishEdit();focusedField.current=null;}
      }}>
        <p className="text-xs">{getEntityDisplayName(draft.entity)} · {target === "snes" ? "SNES" : "Mega Drive"}. Escolha, ajuste e teste no projeto.</p>
        {!draft.entity.components.camera?.visual && <p role="status" className="text-xs">Aplicar converte esta câmera para o fluxo visual. Cancelar preserva o legado; Desfazer restaura a configuração anterior.</p>}
        <div className="flex flex-wrap items-center gap-2 py-2">
          <button type="button" className={button} disabled={!history.current.past.length && !(gesture.current && JSON.stringify(gesture.current)!==JSON.stringify(draft))} onClick={() => travel()}>Desfazer ajuste</button>
          <button type="button" className={button} disabled={!history.current.future.length} onClick={() => travel(true)}>Refazer ajuste</button>
          <button type="button" className={button} onClick={() => choosePattern(config.pattern, true)}>Restaurar valores do padrão</button>
        </div>
        <details data-camera-patterns="" open={patternsOpen} onToggle={e=>setPatternsOpen(e.currentTarget.open)}><summary data-testid="camera-pattern-picker" className="cursor-pointer py-2 text-sm font-semibold">Escolher padrão · {CAMERA_PATTERNS.find(p=>p.id===config.pattern)?.name}</summary>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Padrões de câmera">
          {CAMERA_PATTERNS.map(p=><button key={p.id} type="button" aria-pressed={config.pattern===p.id} data-testid={`camera-pattern-${p.id}`}
            className={`${button} text-left ${config.pattern===p.id?"outline outline-2 outline-[var(--rds-action-primary)]":""}`}
            onClick={()=>choosePattern(p.id)}>
            <span aria-hidden="true" className="block text-lg">{p.motion}</span><strong className="block">{p.name}</strong><span>{p.description}</span>
          </button>)}
        </div>
        </details>
        <CameraPatternLibrary entity={draft.entity} camera={draft.camera} scene={scene} valid={errors.length===0}
          onCamera={(patch,origin)=>setDraft(old=>old?{...old,camera:{...old.camera,...patch},entity:origin?{...old.entity,transform:origin}:old.entity}:old)}/>
        <div className="grid items-start gap-5 min-[650px]:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.active} onChange={e=>change({active:e.target.checked})}/>Câmera ativa ao iniciar a cena</label>
            <p role="status" className="text-xs">{config.active ? `Ao iniciar: ${getEntityDisplayName(draft.entity)}.` : scene.entities.some(e=>e.entity_id!==draft.entity.entity_id && e.components.camera?.visual?.active) ? `Ao iniciar: ${getEntityDisplayName(scene.entities.find(e=>e.entity_id!==draft.entity.entity_id && e.components.camera?.visual?.active)!)}.` : "Nenhuma câmera visual será usada ao iniciar. Regiões e eventos visuais também ficam desligados até escolher uma câmera inicial."}</p>
            {(follows||advanced?.activation)&&config.pattern!=="arena" && <label className="block text-sm">Acompanhar<select aria-label="Personagem acompanhado" className={input} value={draft.camera.follow_entity??""}
              onChange={e=>{const id=e.target.value;setDraft({...draft,camera:{...draft.camera,follow_entity:id}});setProbeId(id);const found=scene.entities.find(n=>n.entity_id===id);if(found)setProbe(found.transform);}}>
              <option value="">Escolha um personagem</option>{scene.entities.filter(e=>e.components.sprite&&!e.components.camera).map(e=><option key={e.entity_id} value={e.entity_id}>{getEntityDisplayName(e)}</option>)}
            </select></label>}
            {config.pattern==="arena"&&<label className="block text-sm">Alvo de teste da arena<select className={input} value={previewId??""} onChange={e=>{setProbeId(e.target.value);const found=scene.entities.find(n=>n.entity_id===e.target.value);if(found)setProbe(found.transform);}}>
              {(advanced?.targets??[]).map(id=><option value={id} key={id}>{scene.entities.find(e=>e.entity_id===id)?getEntityDisplayName(scene.entities.find(e=>e.entity_id===id)!):`${id} (removido)`}</option>)}</select></label>}
            {follows && <>
              <div className="flex flex-wrap gap-2"><button className={button} type="button" onClick={()=>change({screen_x:Math.round(frame.width*.5),screen_y:112})}>Centralizar</button><button className={button} type="button" onClick={()=>change({screen_x:Math.round(frame.width*.4),screen_y:112})}>Espaço à frente · 40%</button></div>
              <div className="grid grid-cols-2 gap-2">{number("Composição horizontal (%)",Math.round(config.screen_x/frame.width*100),n=>change({screen_x:Math.round(n/100*frame.width)}),0,100)}{number("Composição vertical (%)",Math.round(config.screen_y/frame.height*100),n=>change({screen_y:Math.round(n/100*frame.height)}),0,100)}</div>
              <label className="block text-sm">Movimento<select className={input} aria-label="Resposta do movimento" value={config.response_x===1&&config.response_y===1?"immediate":"smooth"} onChange={e=>change({response_x:e.target.value==="immediate"?1:8,response_y:e.target.value==="immediate"?1:12})}><option value="immediate">Direta, com teto de velocidade</option><option value="smooth">Resposta suave</option></select></label>
              {number("Teto de velocidade (pixels/quadro)",config.max_speed,n=>change({max_speed:n}),1,256)}
              <p className="text-xs">A câmera avança até {config.max_speed} pixels por quadro ({config.max_speed*fps} pixels/s). O teto também vale na resposta direta. Região livre e limites continuam valendo; teleportes maiores convergem por vários quadros.</p>
            </>}
            {config.pattern.startsWith("auto_")&&<>
              <label className="block text-sm">Direção<select className={input} aria-label="Direção da rolagem" value={config.speed<0?"negative":"positive"} onChange={e=>change({speed:(e.target.value==="negative"?-1:1)*Math.max(1,Math.abs(config.speed))})}><option value="positive">{config.pattern==="auto_horizontal"?"Direita":"Baixo"}</option><option value="negative">{config.pattern==="auto_horizontal"?"Esquerda":"Cima"}</option></select></label>
              <div className="flex flex-wrap gap-2">{[["Lenta",30],["Normal",60],["Rápida",120]].map(([name,speed])=><button key={name} className={button} type="button" onClick={()=>change({speed:Number(speed)*(config.speed<0?-1:1)})}>{name}</button>)}</div>
              {number("Velocidade (pixels por segundo; negativo inverte)",config.speed,n=>change({speed:n}))}
              <button className={button} type="button" onClick={()=>setDraft(old=>old?{...old,entity:{...old.entity,transform:{x:config.pattern==="auto_horizontal"&&config.speed<0?config.bounds.x+Math.max(0,config.bounds.width-frame.width):config.bounds.x,y:config.pattern==="auto_vertical"&&config.speed<0?config.bounds.y+Math.max(0,config.bounds.height-frame.height):config.bounds.y}}}:old)}>Começar na borda de origem</button>
              <p className="text-xs">Se começar na borda de chegada, a câmera fica parada no limite. Use a borda de origem para percorrer a área.</p>
            </>}
            {(config.pattern.startsWith("auto_")||["beat_em_up","sequence"].includes(config.pattern))&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={config.paused} onChange={e=>change({paused:e.target.checked})}/>Iniciar pausada / travada</label>}
            {(!follows||config.pattern==="sequence") && <div className="grid grid-cols-2 gap-2">{number("Posição X",draft.entity.transform.x,n=>setDraft({...draft,entity:{...draft.entity,transform:{...draft.entity.transform,x:n}}}))}{number("Posição Y",draft.entity.transform.y,n=>setDraft({...draft,entity:{...draft.entity,transform:{...draft.entity.transform,y:n}}}))}</div>}
            <details><summary className="cursor-pointer py-2 text-sm">Área percorrida pela visão</summary><div className="space-y-2">
              <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>change({bounds:playable})}>Usar limites do cenário</button><button type="button" className={button} aria-pressed={drawing==="bounds"} onClick={()=>{revealMap();setDrawing(drawing?null:"bounds");setPlacingPoint(null);}}>Desenhar limites</button></div>
            <details><summary className="cursor-pointer py-2 text-xs">Área e camada exatas</summary><div className="grid grid-cols-2 gap-2">{number("Área X",config.bounds.x,n=>change({bounds:{...config.bounds,x:n}}))}{number("Área Y",config.bounds.y,n=>change({bounds:{...config.bounds,y:n}}))}{number("Largura da área",config.bounds.width,n=>change({bounds:{...config.bounds,width:n}}),1)}{number("Altura da área",config.bounds.height,n=>change({bounds:{...config.bounds,height:n}}),1)}</div>
            <p className="text-xs">Esta área limita a visão da câmera; não contém o movimento dos personagens. Movimento e colisão são configurados na cena.</p>
            <p className="text-xs">Limite automático: {scene.collision_map?"mapa de colisão (área jogável)":"mapas sem papel de fundo/paralaxe; sem mapas jogáveis usa uma tela"}. Fundos decorativos não ampliam a área. Áreas menores que a tela ancoram no canto de origem.</p>
            <label className="block text-xs">Usar área de uma camada<select className={input} aria-label="Camada para limites" value="" onChange={e=>{const layer=scene.entities.find(v=>v.entity_id===e.target.value);if(layer?.components.tilemap)change({bounds:{...layer.transform,width:layer.components.tilemap.map_width*8,height:layer.components.tilemap.map_height*8}});}}><option value="">Escolher camada explicitamente</option>{scene.entities.filter(e=>e.components.tilemap).map(e=><option key={e.entity_id} value={e.entity_id}>{getEntityDisplayName(e)}</option>)}</select></label></details>
            </div></details>
            <fieldset disabled={!clockReady} aria-label="Salas, sequências e regiões"><CameraAdvancedControls config={config} entities={scene.entities} target={target} fps={fps} probe={previewPoint} onChange={change} number={number}
              onDrawRoom={id=>{revealMap();setDrawing(id);setPlacingPoint(null);setPlaying(false);}} onPlacePoint={i=>{revealMap();setPlacingPoint(i);setDrawing(null);setPlaying(false);}}
              onDrawActivation={()=>{revealMap();setDrawing("activation");setPlacingPoint(null);setPlaying(false);}}/></fieldset>
            <details><summary className="cursor-pointer py-2 text-sm">Personalizar</summary><div className="grid grid-cols-2 gap-2 pt-2">
              {(follows||config.pattern==="sequence") && <>
              <label className="text-xs"><input type="checkbox" checked={config.horizontal} onChange={e=>change({horizontal:e.target.checked})}/> Liberar horizontal</label>
              <label className="text-xs"><input type="checkbox" checked={config.vertical} onChange={e=>change({vertical:e.target.checked})}/> Liberar vertical</label>
              </>}
              {follows && <>
              {number("Ponto na tela X",config.screen_x,n=>change({screen_x:n}),0,frame.width)}{number("Ponto na tela Y",config.screen_y,n=>change({screen_y:n}),0,frame.height)}
              {number("Resposta horizontal (1 = direta)",config.response_x,n=>change({response_x:n}),1,60)}{number("Resposta vertical (1 = direta)",config.response_y,n=>change({response_y:n}),1,60)}
              {number("Âncora estável X",config.anchor_x,n=>change({anchor_x:n}))}{number("Âncora estável Y",config.anchor_y,n=>change({anchor_y:n}))}
              {number("Região livre X (meia largura)",config.dead_zone_x,n=>change({dead_zone_x:n}),0)}{number("Região livre Y (meia altura)",config.dead_zone_y,n=>change({dead_zone_y:n}),0)}
              {number("Antecipação horizontal",config.look_ahead,n=>change({look_ahead:n}),0)}
              </>}
              {number("Deslocamento X",draft.camera.offset_x??0,n=>setDraft({...draft,camera:{...draft.camera,offset_x:n}}))}{number("Deslocamento Y",draft.camera.offset_y??0,n=>setDraft({...draft,camera:{...draft.camera,offset_y:n}}))}
            </div></details>
          </div>
          <div ref={previewPanel} className="order-first space-y-3 bg-[var(--rds-surface-panel)] min-[650px]:order-none min-[650px]:[@media(min-height:700px)]:sticky min-[650px]:top-12">
            <div role="group" aria-label="Visualização da câmera" className="flex flex-wrap gap-2">{[["player","Visão do jogador"],["map","Mapa geral"]].map(([mode,label])=><button key={mode} type="button" className={`${button} ${previewMode===mode?"outline outline-2 outline-[var(--rds-action-primary)]":""}`} aria-pressed={previewMode===mode} onClick={()=>setPreviewMode(mode)}>{label}</button>)}</div>
            <div hidden={previewMode!=="player"} className="space-y-2">
            {follows ? <>
              <svg viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="xMidYMid meet" style={{width:`min(100%, ${frame.width}px, ${frame.width/frame.height*28}vh)`,aspectRatio:`${frame.width}/${frame.height}`,height:"auto",marginInline:"auto",display:"block"}} className=" touch-none rounded border bg-[var(--rds-surface-canvas)]" aria-label="Enquadramento do personagem"
                onPointerDown={e=>{beginGesture();e.currentTarget.setPointerCapture(e.pointerId);screenPoint(e);}} onPointerMove={e=>{if(e.buttons&&gestureKind.current==="pointer")screenPoint(e);}} onPointerUp={endGesture} onPointerCancel={endGesture}>
                <svg x="0" y="0" width={frame.width} height={frame.height} viewBox={`${preview.x} ${preview.y} ${frame.width} ${frame.height}`}>
                  <SceneArtwork scene={scene} target={target} project={activeProjectDir} probe={{id:previewId??"",...previewPoint}} camera={{x:preview.x,y:preview.y,ratios:advanced?.parallax??[]}}/>
                </svg>
                <path d={`M ${frame.width/3} 0 V ${frame.height} M ${frame.width*2/3} 0 V ${frame.height} M 0 ${frame.height/3} H ${frame.width} M 0 ${frame.height*2/3} H ${frame.width}`} stroke="white" strokeOpacity=".7" strokeDasharray="2 4" fill="none"/>
                <rect x={config.screen_x-config.dead_zone_x} y={config.screen_y-config.dead_zone_y} width={config.dead_zone_x*2} height={config.dead_zone_y*2} fill="none" stroke="white" style={{filter:"drop-shadow(0 0 1px black)"}} strokeDasharray="4 2"/>
                <circle cx={config.screen_x} cy={config.screen_y} r="7" fill="none" stroke="white" strokeWidth="2" style={{filter:"drop-shadow(0 0 1px black)"}} tabIndex={0} role="group" aria-roledescription="controle de posição em dois eixos" aria-label={`Ponto de enquadramento: X ${config.screen_x}, Y ${config.screen_y} pixels. Setas movem; Shift acelera.`}
                  onKeyDown={e=>{const moves:Record<string,number[]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const m=moves[e.key];if(m){e.preventDefault();change({screen_x:Math.max(0,Math.min(frame.width,config.screen_x+m[0]*(e.shiftKey?8:1))),screen_y:Math.max(0,Math.min(frame.height,config.screen_y+m[1]*(e.shiftKey?8:1)))});}}}/>
              </svg>
            </> : <svg viewBox={`${preview.x} ${preview.y} ${frame.width} ${frame.height}`} preserveAspectRatio="xMidYMid meet" style={{width:`min(100%, ${frame.width}px, ${frame.width/frame.height*28}vh)`,aspectRatio:`${frame.width}/${frame.height}`,height:"auto",marginInline:"auto",display:"block"}} className=" rounded border bg-[var(--rds-surface-canvas)]" aria-label="Visão do jogador"><SceneArtwork scene={scene} target={target} project={activeProjectDir} camera={{x:preview.x,y:preview.y,ratios:advanced?.parallax??[]}}/></svg>}
            <p className="text-xs">{frame.width} × {frame.height} · {follows?"Círculo: posição desejada. Limites e movimento podem afastar o personagem. Arraste ou use as setas; campos exatos em Personalizar.":"Enquadramento final da câmera."}</p>
            </div>
            <div hidden={previewMode!=="map"} className="space-y-2"><strong className="block text-sm">Mapa geral · composição da cena</strong>
            {(drawing||placingPoint!==null)&&<p role="status" className="text-xs">{placingPoint!==null?"Clique ou arraste para posicionar o ponto.":"Arraste no cenário para desenhar a área selecionada."}</p>}
            <svg viewBox={`${area.x} ${area.y} ${area.width} ${area.height}`} preserveAspectRatio="xMidYMid meet" style={{height:"min(30vh,280px)"}} className="w-full touch-none rounded border bg-[var(--rds-surface-canvas)]" aria-label="Cena e limites da câmera" data-testid="camera-scene-preview"
              onPointerDown={e=>{beginGesture();e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);if(drawing)start.current=p;else place(p);}}
              onPointerMove={e=>{if(e.buttons&&gestureKind.current==="pointer")place(point(e));}}
              onPointerUp={endGesture} onPointerCancel={endGesture}>
              <SceneArtwork scene={scene} target={target} project={activeProjectDir} probe={{id:previewId??"",...previewPoint}}/>
              <rect {...config.bounds} fill="none" stroke="white" style={{filter:"drop-shadow(0 0 1px black)"}} strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
              {advanced?.rooms.map(r=><rect key={r.id} {...r.area} fill="none" stroke="#89b4fa" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"><title>{r.name} · prioridade {r.priority}</title></rect>)}
              {advanced?.activation&&<rect {...advanced.activation} fill="none" stroke="#cba6f7" vectorEffect="non-scaling-stroke"/>}
              {advanced?.path.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="8" fill="#cba6f7"/><text x={p.x} y={p.y+3} textAnchor="middle" fontSize="9" fill="#11111b">{i+1}</text></g>)}
              <rect x={preview.x} y={preview.y} {...frame} fill="none" stroke="white" style={{filter:"drop-shadow(0 0 1px black)"}} strokeWidth="3" vectorEffect="non-scaling-stroke"/>
              {follows&&<circle cx={previewPoint.x+config.anchor_x} cy={previewPoint.y+config.anchor_y} r="6" fill="#f38ba8"/>}
            </svg>
            <div className="flex flex-wrap gap-2"><button className={button} type="button" onClick={()=>{setMapZoom(1);setMapCenter(null);}}>Mapa inteiro</button><button className={button} type="button" onClick={()=>{setMapCenter({x:preview.x+frame.width/2,y:preview.y+frame.height/2});setMapZoom(Math.min(8,mapZoom*2));}}>Ampliar visão</button><button className={button} type="button" onClick={()=>setMapZoom(Math.max(1,mapZoom/2))}>Reduzir mapa</button></div>
            <details><summary className="cursor-pointer py-1 text-xs">Posições de navegação e teste</summary><div className="grid grid-cols-2 gap-2">{number("Centro do mapa X",Math.round(area.x+area.width/2),n=>setMapCenter({x:n,y:area.y+area.height/2}))}{number("Centro do mapa Y",Math.round(area.y+area.height/2),n=>setMapCenter({x:area.x+area.width/2,y:n}))}</div>
            {follows&&<div className="grid grid-cols-2 gap-2">{number("Alvo de teste X",previewPoint.x,n=>{setProbeId(previewId??"");setProbe({...previewPoint,x:n});})}{number("Alvo de teste Y",previewPoint.y,n=>{setProbeId(previewId??"");setProbe({...previewPoint,y:n});})}</div>}
            </details>
            <p className="text-xs">{follows?"Arraste o alvo de teste no mapa geral. ":""}Linha contínua: visão do jogador. Tracejado: limites. A prévia não move entidades nem grava posições de teste. Rolagem usa o mapa residente; não carrega mapas ilimitados.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><button type="button" className={button} disabled={!clockReady} onClick={()=>setPlaying(!playing)}>{playing?"Pausar prévia":"Reproduzir prévia"}</button><button type="button" className={button} onClick={()=>{setPlaying(false);setProbeId(previewId??"");setProbe({...scene.entities.find(e=>e.entity_id===previewId)?.transform??probe});setPreview(initialCameraSample());}}>Reiniciar prévia</button></div>
            <details><summary className="cursor-pointer py-1 text-xs">Alcance da prévia</summary>
            <p className="text-xs">Prévia local: arte do primeiro quadro, sem HUD; seguimento, salas, percurso e paralaxe configurada. Regiões entre câmeras, nós de evento, tremor e física precisam de Testar projeto na ROM.</p>
            <p className="text-xs">Câmera na prévia: {preview.x}, {preview.y} · {fps} quadros/s. Guias aparecem apenas durante a configuração.</p></details>
            {clockError&&<p role="alert" className="text-xs">{clockError}</p>}
            {preview.separated&&<p role="status" className="text-xs">As âncoras da arena estão mais separadas que a janela. O centro do grupo é preservado.</p>}
          </div>
        </div>
        <details><summary className="cursor-pointer py-2 text-sm">Câmeras desta cena e eventos</summary><div className="space-y-3">
          <table className="w-full text-left text-xs"><caption className="text-left py-2">Seleção inicial, regiões e eventos usam estas mesmas câmeras.</caption><thead><tr><th>Nome / padrão</th><th>Quando ativa</th><th>Prioridade / troca</th><th>Abrir</th></tr></thead><tbody>
            {scene.entities.filter(e=>e.components.camera).map(e=>{
              const c=e.entity_id===draft.entity.entity_id?draft.camera:e.components.camera!,v=c.visual,a=v?cameraAdvanced(v):null;
              return <tr key={e.entity_id} className="border-t border-[var(--rds-border-default)]"><td className="py-2">{getEntityDisplayName(e)}<br/>{CAMERA_PATTERNS.find(p=>p.id===v?.pattern)?.name??"Legado"}</td><td>{(e.entity_id===draft.entity.entity_id?config.active:!config.active&&v?.active)?"Inicial · ":""}{a?.activation?"Entrada na região; fora dela conserva a última câmera":"Seleção por evento"}</td><td>{a?.priority??0} · {a?.smooth_transition?"suave":"corte"}</td><td><button className={button} type="button" disabled={e.entity_id===draft.entity.entity_id||Boolean(stale)||errors.length>0} onClick={()=>{apply();open(e.entity_id);}}>Aplicar e abrir</button></td></tr>;
            })}
          </tbody></table>
          <button className={button} type="button" disabled={Boolean(stale)||errors.length>0||!clockReady||scene.entities.filter(e=>e.components.camera?.visual).length>=8} onClick={()=>{
            apply();const store=useEditorStore.getState(),saved=store.activeScene?.entities.find(e=>e.entity_id===draft.entity.entity_id);if(!saved)return;
            const copy=structuredClone(saved);copy.entity_id=`camera_${crypto.randomUUID()}`;copy.display_name=`${getEntityDisplayName(saved)} · variação`;copy.prefab=null;
            copy.components={camera:copy.components.camera};copy.components.camera!.visual!.active=false;copy.components.camera!.patterns=[];
            store.addEntity(copy);open(copy.entity_id);
          }}>Aplicar e criar outra câmera</button>
          {advanced?.activation&&scene.entities.filter(e=>e.entity_id!==draft.entity.entity_id&&e.components.camera?.visual?.advanced?.activation).map(e=>{
            const a=advanced.activation!,other=cameraAdvanced(e.components.camera!.visual!),b=other.activation!;
            if(a.x>=b.x+b.width||b.x>=a.x+a.width||a.y>=b.y+b.height||b.y>=a.y+a.height)return null;
            return <p role="status" key={e.entity_id} className="text-xs">A região sobrepõe {getEntityDisplayName(e)} (prioridade {other.priority}). Maior prioridade vence; em empate vale a identidade da câmera em ordem Unicode. Fora das regiões permanece a última câmera.</p>;
          })}
          <p className="text-xs">Exploração → combate: crie uma variação, escolha Combate, marque a região e sua prioridade. Para retornar por região, a câmera de exploração também precisa de uma região que cubra o retorno. Fora de todas as regiões, a última seleção permanece.</p>
          <p className="text-xs">Eventos: A trava, B retoma, {target==="snes"?"X":"C"} treme; Start libera a seleção manual para as regiões. Na Lógica, use o atalho “Câmera: travar, retomar e tremer”. Os cartões permitem selecionar outra câmera por nome, deslocamento temporário e reiniciar percurso.</p>
          <button className={button} type="button" disabled={Boolean(stale)||errors.length>0||!clockReady} onClick={()=>{apply();useEditorStore.getState().openStudioEditor({focus:{task:"actions",entityId:draft.entity.entity_id}});}}>Aplicar e abrir eventos na Lógica</button>
        </div></details>
        <details><summary className="cursor-pointer py-2 text-sm">Capacidades de {target==="snes"?"SNES":"Mega Drive"}</summary><p className="text-xs">{frame.width} × {frame.height} pixels. Até oito câmeras visuais, dois planos residentes compatíveis, 16 salas, 32 pontos e quatro alvos por arena. {target==="snes"?"HUD fixo indisponível; mapas pintados até 64 × 64 tiles e 16 cores por plano.":"HUD fixo usa a superfície WINDOW existente; mapas e gráficos continuam sujeitos aos orçamentos do build."} Sem streaming ilimitado ou zoom automático. O teste na ROM confirma as combinações do projeto.</p></details>
        {stale&&<p role="alert">A cena mudou durante a configuração. Cancele e abra novamente.</p>}
        {cameraConflictSources(scene).map((issue,i)=><div key={i} className="text-sm"><p>{issue.message}</p><button className={button} type="button" onClick={()=>{setDraft(null);setPlaying(false);const store=useEditorStore.getState();if(issue.entityId)store.openStudioEditor({focus:{task:issue.nodeId?"actions":"scene",entityId:issue.entityId}});else store.setActiveViewportTab("retrofx");}}>Cancelar ajustes e abrir responsável</button></div>)}
        {errors.map(error=><p role="alert" key={error} className="text-sm font-medium text-[var(--rds-text-primary)]">{error}</p>)}

      </div>}
    </Dialog>
  </>;
}
