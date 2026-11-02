import { useState, type ReactNode } from "react";
import { cameraAdvanced, cameraFrame, reusableCameraConfig } from "../../core/cameraWorkflow";
import { getEntityDisplayName } from "../../core/entityDisplay";
import type { CameraComponent, Entity, SavedCameraPattern, Scene, VisualCameraConfig } from "../../core/ipc/sceneService";

const button="min-h-8 rounded border border-[var(--rds-border-default)] px-2 py-1 text-xs disabled:opacity-40";
const input="w-full rounded border border-[var(--rds-border-default)] bg-[var(--rds-surface-input)] p-1.5 text-sm";
type NumberField=(label:string,value:number,onChange:(n:number)=>void,min?:number,max?:number)=>ReactNode;

export function CameraPatternLibrary({entity,camera,scene,onCamera,valid}:{entity:Entity;camera:CameraComponent;scene:Scene;
  onCamera:(patch:Partial<CameraComponent>,origin?:{x:number;y:number})=>void;valid:boolean}){
  const [name,setName]=useState("Meu padrão"),[selection,setSelection]=useState(""),[notice,setNotice]=useState("");
  const own=camera.patterns??[];
  const all=scene.entities.filter(e=>e.entity_id!==entity.entity_id).flatMap(e=>(e.components.camera?.patterns??[]).map(p=>({p,owner:e})))
    .concat(own.map(p=>({p,owner:entity})));
  const selected=all.find(({p,owner})=>JSON.stringify([owner.entity_id,p.id])===selection);
  const uniqueName=(base:string)=>{let n=base.slice(0,80),i=2;while(own.some(p=>p.name===n)){const suffix=` ${i++}`;n=base.slice(0,80-suffix.length)+suffix;}return n;};
  function save(copy?:SavedCameraPattern){
    if(!camera.visual||!valid||!name.trim()||own.length>=32)return;
    const p:SavedCameraPattern=copy?{...structuredClone(copy),config:reusableCameraConfig(copy.config,scene),id:crypto.randomUUID(),name:uniqueName(copy.name+" cópia")}:
      {id:crypto.randomUUID(),name:uniqueName(name.trim().slice(0,80)),config:structuredClone(camera.visual),offset_x:camera.offset_x??0,offset_y:camera.offset_y??0,x:entity.transform.x,y:entity.transform.y};
    onCamera({patterns:[...own,p]});setSelection(JSON.stringify([entity.entity_id,p.id]));setName(p.name);setNotice(`“${p.name}” está no rascunho da biblioteca. Aplicar e salvar o projeto confirma a gravação.`);
  }
  return <details><summary className="cursor-pointer py-2 text-sm">Meus padrões nesta cena</summary><div className="space-y-2 rounded border p-2">
    <p className="text-xs">Biblioteca desta cena. Novos padrões ficam em {getEntityDisplayName(entity)}. Ao remover uma câmera, os padrões passam para outra câmera com espaço; sem destino, a remoção é protegida. Aplicar confirma o rascunho; salvar o projeto grava no disco. Cancelar descarta. Não há transporte entre projetos. Usar um padrão conserva o alvo e a seleção ativa desta câmera.</p>
    <label className="block text-xs">Padrão salvo<select aria-label="Padrão de câmera salvo" className={input} value={selection} onChange={e=>{setSelection(e.target.value);const found=all.find(n=>JSON.stringify([n.owner.entity_id,n.p.id])===e.target.value);if(found)setName(found.p.name);}}>
      <option value="">Escolha um padrão salvo</option>{all.map(({p,owner})=><option key={JSON.stringify([owner.entity_id,p.id])} value={JSON.stringify([owner.entity_id,p.id])}>{getEntityDisplayName(owner)} · {p.name}</option>)}
    </select></label>
    {selected&&<p className="text-xs">Proprietária do padrão selecionado: {getEntityDisplayName(selected.owner)}. {selected.owner.entity_id!==entity.entity_id?"Duplique para editar uma cópia nesta câmera.":"Atualizar substitui seus valores; renomear conserva sua identidade."}</p>}
    <label className="block text-xs">Nome do meu padrão<input aria-label="Nome do meu padrão" className={input} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="flex flex-wrap gap-2">
      <button className={button} type="button" data-testid="camera-save-pattern" disabled={!valid||!name.trim()||own.length>=32} onClick={()=>save()}>Salvar como meu padrão</button>
      <button className={button} type="button" disabled={!selected} onClick={()=>{if(!selected||!camera.visual)return;const p=selected.p,config=reusableCameraConfig(p.config,scene);
        onCamera({visual:{...config,active:camera.visual.active},offset_x:p.offset_x,offset_y:p.offset_y},{x:p.x,y:p.y});
        setNotice(`Valores de “${p.name}” copiados. Referências ausentes são removidas; confira os personagens e camadas antes de aplicar.`);}}>Usar padrão</button>
      <button className={button} type="button" disabled={!selected||selected.owner.entity_id!==entity.entity_id||!valid} onClick={()=>{
        if(!selected||!camera.visual)return;
        onCamera({patterns:own.map(p=>p.id===selected.p.id?{...p,config:structuredClone(camera.visual!),offset_x:camera.offset_x??0,offset_y:camera.offset_y??0,x:entity.transform.x,y:entity.transform.y}:p)});
        setNotice(`“${selected.p.name}” substituído pelos valores atuais no rascunho. Aplicar e salvar confirma.`);
      }}>Atualizar padrão selecionado</button>
      <button className={button} type="button" disabled={!selected||!valid||own.length>=32} onClick={()=>{if(selected)save(selected.p);}}>Duplicar padrão</button>
      <button className={button} type="button" disabled={!selected||selected.owner.entity_id!==entity.entity_id||!name.trim()||own.some(p=>p.id!==selected.p.id&&p.name===name.trim())}
        onClick={()=>{if(selected)onCamera({patterns:own.map(p=>p.id===selected.p.id?{...p,name:name.trim()}:p)});}}>Renomear padrão</button>
      <button className={button} type="button" disabled={!selected||selected.owner.entity_id!==entity.entity_id} onClick={()=>{if(selected){onCamera({patterns:own.filter(p=>p.id!==selected.p.id)});setSelection("");}}}>Remover da biblioteca</button>
    </div>
    {notice&&<p role="status" className="text-xs">{notice}</p>}
  </div></details>;
}

export default function CameraAdvancedControls({config,entities,target,fps,probe,onChange,number,onDrawRoom,onPlacePoint,onDrawActivation}:{
  config:VisualCameraConfig;entities:Entity[];target:"megadrive"|"snes";fps:number;probe:{x:number;y:number};onChange:(patch:Partial<VisualCameraConfig>)=>void;
  number:NumberField;onDrawRoom:(id:string)=>void;onPlacePoint:(index:number)=>void;onDrawActivation:()=>void;
}){
  const a=cameraAdvanced(config),frame=cameraFrame(target);
  const change=(patch:Partial<typeof a>)=>onChange({advanced:{...a,...patch}});
  const characters=entities.filter(e=>e.components.sprite&&!e.components.camera);
  return <div className="space-y-3">
    {config.pattern==="rooms"&&<section className="space-y-2" aria-label="Salas da câmera">
      {!a.rooms.length&&<p role="status" className="text-sm">Primeiro, adicione uma sala e desenhe sua área no mapa ao lado. Também pode preencher X, Y, largura e altura pelos campos.</p>}
      <p className="text-xs">A sala de maior prioridade contém a âncora do alvo. Nas bordas, o início pertence à sala e o fim à próxima. Fora das regiões, a última sala permanece.</p>
      {a.rooms.map((r,i)=><fieldset key={r.id} className="space-y-2 rounded border p-2"><legend className="px-1 text-xs">Sala {i+1}</legend>
        <input className={input} aria-label={`Nome da sala ${i+1}`} value={r.name} onChange={e=>change({rooms:a.rooms.map(n=>n.id===r.id?{...n,name:e.target.value.slice(0,80)}:n)})}/>
        <label className="text-xs"><input type="checkbox" checked={r.smooth} onChange={e=>change({rooms:a.rooms.map(v=>v.id===r.id?{...v,smooth:e.target.checked}:v)})}/> Transição suave</label>
        <details><summary className="cursor-pointer py-1 text-xs">Área precisa e prioridade</summary><div className="grid grid-cols-2 gap-2">{number(`Prioridade da sala ${i+1}`,r.priority,n=>change({rooms:a.rooms.map(v=>v.id===r.id?{...v,priority:n}:v)}))}
          {(["x","y","width","height"] as const).map(k=><div key={k}>{number(`Sala ${i+1}: ${{x:"X",y:"Y",width:"largura",height:"altura"}[k]}`,r.area[k],n=>change({rooms:a.rooms.map(v=>v.id===r.id?{...v,area:{...v.area,[k]:n}}:v)}),k==="width"||k==="height"?1:-16000)}</div>)}</div></details>
        <div className="flex gap-2"><button className={button} type="button" onClick={()=>onDrawRoom(r.id)}>Desenhar esta sala</button><button className={button} type="button" onClick={()=>change({rooms:a.rooms.filter(v=>v.id!==r.id)})}>Remover sala</button></div>
      </fieldset>)}
      <button type="button" className={button} disabled={a.rooms.length>=16} onClick={()=>{const id=crypto.randomUUID();change({rooms:[...a.rooms,{id,name:`Sala ${a.rooms.length+1}`,area:{x:config.bounds.x,y:config.bounds.y,...frame},priority:a.rooms.length,smooth:false}]});onDrawRoom(id);}}>Adicionar sala e desenhar</button>
    </section>}
    {config.pattern==="beat_em_up"&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={a.allow_backtracking} onChange={e=>change({allow_backtracking:e.target.checked})}/>Permitir recuar com a câmera</label>}
    {config.pattern==="arena"&&<fieldset className="space-y-2"><legend className="text-sm">Personagens da arena (2 a 4)</legend>
      {characters.map(e=><label key={e.entity_id} className="flex gap-2 text-xs"><input type="checkbox" checked={a.targets.includes(e.entity_id)} disabled={!a.targets.includes(e.entity_id)&&a.targets.length>=4}
        onChange={event=>change({targets:event.target.checked?[...a.targets,e.entity_id]:a.targets.filter(id=>id!==e.entity_id)})}/>{getEntityDisplayName(e)}</label>)}
      {a.targets.length<2&&<p role="status" className="text-sm">{characters.length<2?"Adicione pelo menos dois personagens à cena para montar a arena.":"Marque pelo menos dois personagens acima para experimentar a arena."}</p>}
      <p className="text-xs">Compõe o centro entre as âncoras. Quando a separação excede a tela, mantém esse centro; personagens podem sair da janela. Não aplica zoom nem altera o movimento deles.</p>
    </fieldset>}
    {config.pattern==="sequence"&&<section className="space-y-2" aria-label="Percurso da câmera">
      {!a.path.length&&<><p role="status" className="text-sm">Comece com dois enquadramentos. Depois ajuste os pontos e a espera olhando o mapa.</p><button className={button} type="button" onClick={()=>change({path:[{x:config.bounds.x,y:config.bounds.y,frames:0,wait:fps},{x:config.bounds.x+Math.max(0,config.bounds.width-frame.width),y:config.bounds.y+Math.max(0,config.bounds.height-frame.height),frames:fps*2,wait:fps}]})}>Criar percurso de exemplo</button></>}
      <p className="text-xs">Os pontos representam o canto da janela. Duração 0 faz um corte; espera mantém o ponto. A ordem da lista define o percurso.</p>
      {a.path.map((p,i)=><fieldset className="rounded border p-2" key={i}><legend className="px-1 text-xs">Ponto {i+1}</legend><div className="grid grid-cols-2 gap-2">
        {(["frames","wait"] as const).map(k=><label className="text-xs" key={`seconds-${k}`}>Ponto {i+1}: {k==="frames"?"duração":"espera"} em segundos<input className={input} type="number" aria-label={`Ponto ${i+1}: ${k==="frames"?"duração":"espera"} em segundos`} min={0} max={36000/fps} step={1/fps} value={Number((p[k]/fps).toFixed(3))} onChange={e=>{if(e.target.value!=="")change({path:a.path.map((v,j)=>j===i?{...v,[k]:Math.round(Number(e.target.value)*fps)}:v)});}}/><span>{p[k]} quadros · {fps} quadros/s</span></label>)}
      </div><details><summary className="cursor-pointer py-1 text-xs">Posição e quadros exatos</summary><div className="grid grid-cols-2 gap-2">
        {(["x","y","frames","wait"] as const).map(k=><div key={k}>{number(`Ponto ${i+1}: ${{x:"X",y:"Y",frames:"duração em quadros",wait:"espera em quadros"}[k]}`,p[k],n=>change({path:a.path.map((v,j)=>i===j?{...v,[k]:n}:v)}),k==="frames"||k==="wait"?0:-16000,k==="frames"||k==="wait"?36000:16000)}</div>)}
      </div></details><div className="mt-2 flex flex-wrap gap-2"><button className={button} type="button" onClick={()=>onPlacePoint(i)}>Posicionar no cenário</button>
        <button className={button} type="button" disabled={i===0} onClick={()=>{const path=[...a.path];[path[i-1],path[i]]=[path[i],path[i-1]];change({path});}}>Mover antes</button>
        <button className={button} type="button" onClick={()=>change({path:a.path.filter((_,j)=>j!==i)})}>Remover ponto</button></div></fieldset>)}
      <button className={button} type="button" disabled={a.path.length>=32} onClick={()=>{change({path:[...a.path,{x:probe.x,y:probe.y,frames:fps,wait:0}]});onPlacePoint(a.path.length);}}>Adicionar ponto no cenário</button>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={a.return_to_target} onChange={e=>change({return_to_target:e.target.checked})}/>Voltar a acompanhar o personagem ao terminar</label>
    </section>}
    <details><summary className="cursor-pointer py-2 text-sm">Trocas por região e paralaxe</summary><div className="space-y-3 pt-2">
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={Boolean(a.activation)} onChange={e=>change({activation:e.target.checked?{...config.bounds}:null})}/>Ativar esta câmera ao entrar em uma região</label>
      {a.activation&&<><div className="grid grid-cols-2 gap-2">{(["x","y","width","height"] as const).map(k=><div key={k}>{number(`Região de ativação: ${{x:"X",y:"Y",width:"largura",height:"altura"}[k]}`,a.activation![k],n=>change({activation:{...a.activation!,[k]:n}}),k==="width"||k==="height"?1:-16000)}</div>)}</div><button className={button} type="button" onClick={onDrawActivation}>Desenhar região de ativação</button></>}
      {number("Prioridade desta câmera",a.priority,n=>change({priority:n}))}
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={a.smooth_transition} onChange={e=>change({smooth_transition:e.target.checked})}/>Transição suave ao trocar para esta câmera</label>
      {a.smooth_transition&&config.pattern==="fixed"&&<div className="grid grid-cols-2 gap-2">
        {number("Resposta horizontal da transição",config.response_x,n=>onChange({response_x:n}),1,60)}
        {number("Resposta vertical da transição",config.response_y,n=>onChange({response_y:n}),1,60)}
        {number("Velocidade máxima da transição (pixels/quadro)",config.max_speed,n=>onChange({max_speed:n}),1,256)}
      </div>}
      <p className="text-xs">Regiões usam a âncora do personagem acompanhado ou o centro do grupo na arena. Troca por evento tem precedência até o nó devolver o controle às regiões.</p>
      {entities.filter(e=>e.components.tilemap).map(e=>{const p=a.parallax.find(l=>l.entity_id===e.entity_id);return <div key={e.entity_id} className="space-y-2 rounded border p-2">
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={Boolean(p)} onChange={event=>change({parallax:event.target.checked?[...a.parallax,{entity_id:e.entity_id,ratio_x:100,ratio_y:100}]:a.parallax.filter(l=>l.entity_id!==e.entity_id)})}/>Paralaxe: {getEntityDisplayName(e)}</label>
        {p&&<div className="grid grid-cols-2 gap-2">{number(`${getEntityDisplayName(e)}: horizontal (%)`,p.ratio_x,n=>change({parallax:a.parallax.map(l=>l.entity_id===e.entity_id?{...l,ratio_x:n}:l)}),0,200)}{number(`${getEntityDisplayName(e)}: vertical (%)`,p.ratio_y,n=>change({parallax:a.parallax.map(l=>l.entity_id===e.entity_id?{...l,ratio_y:n}:l)}),0,200)}</div>}
      </div>;})}
      <p className="text-xs">100% acompanha a câmera, 50% desloca metade, 0% mantém a camada fixa. Use somente mapas residentes compatíveis; o HUD continua separado.</p>
    </div></details>
  </div>;
}
