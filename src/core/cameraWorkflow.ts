import type { CameraAdvancedConfig, CameraArea, CameraComponent, CameraPattern, Entity, Scene, VisualCameraConfig } from "./ipc/sceneService";

export const CAMERA_PATTERNS: { id: CameraPattern; name: string; description: string; motion: string }[] = [
  { id: "fixed", name: "Tela fixa", description: "Um enquadramento que permanece no lugar.", motion: "▣" },
  { id: "platformer", name: "Plataforma lateral", description: "Acompanha o personagem com espaço à frente.", motion: "● → ▣" },
  { id: "exploration", name: "Exploração superior", description: "Acompanha nos dois eixos com uma região livre.", motion: "↕ ● ↔" },
  { id: "auto_horizontal", name: "Rolagem horizontal", description: "Avança na horizontal na velocidade escolhida.", motion: "▣ →" },
  { id: "auto_vertical", name: "Rolagem vertical", description: "Avança na vertical na velocidade escolhida.", motion: "▣ ↓" },
  { id: "rooms", name: "Salas e telas", description: "Troca de enquadramento ao entrar em uma sala.", motion: "▣ → ▣" },
  { id: "beat_em_up", name: "Combate lateral", description: "Avança com o personagem e permite travas por evento.", motion: "● → ▣ ▥" },
  { id: "arena", name: "Arena compartilhada", description: "Mantém o centro entre as âncoras dos personagens.", motion: "● ▣ ●" },
  { id: "sequence", name: "Sequência dirigida", description: "Percorre pontos, espera e pode voltar ao personagem.", motion: "① → ②" },
];

const emptyAdvanced=():CameraAdvancedConfig=>({rooms:[],targets:[],path:[],return_to_target:false,allow_backtracking:false,
  activation:null,priority:0,smooth_transition:false,parallax:[]});
export function cameraAdvanced(v: VisualCameraConfig): CameraAdvancedConfig { return v.advanced ?? emptyAdvanced(); }
/** Scene-local reuse never carries references to removed characters or planes. */
export function reusableCameraConfig(config: VisualCameraConfig, scene: Scene): VisualCameraConfig {
  const copy = structuredClone(config), a = cameraAdvanced(copy);
  copy.advanced = { ...a, targets: a.targets.filter(id => scene.entities.some(e => e.entity_id === id && e.components.sprite)),
    parallax: a.parallax.filter(p => scene.entities.some(e => e.entity_id === p.entity_id && e.components.tilemap)) };
  return copy;
}
export const cameraFollows = (v: VisualCameraConfig) => ["platformer","exploration","rooms","beat_em_up"].includes(v.pattern) || (v.pattern==="sequence" && cameraAdvanced(v).return_to_target);
export function compareCameraIds(a:string,b:string){const aa=Array.from(a),bb=Array.from(b);for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)!-bb[i].codePointAt(0)!;if(d)return d;}return aa.length-bb.length;}

export function cameraFrame(target: "megadrive" | "snes") {
  return { width: target === "snes" ? 256 : 320, height: 224 };
}

/** Camera/HUD/guide positions cannot enlarge navigable geometry. */
export function cameraWorldArea(scene: Scene, target: "megadrive" | "snes"): CameraArea {
  const frame = cameraFrame(target);
  const boxes: CameraArea[] = [];
  if (scene.collision_map) {
    const c = scene.collision_map;
    return { x: 0, y: 0, width: c.width * c.tile_width, height: c.height * c.tile_height };
  }
  for (const e of scene.entities) {
    const t = e.components?.tilemap;
    const decorative = scene.layers?.some(l => l.kind === "background" && l.entity_ids.includes(e.entity_id))
      || scene.entities.some(c => c.components.camera?.visual?.advanced?.parallax.some(p => p.entity_id === e.entity_id && (p.ratio_x !== 100 || p.ratio_y !== 100)));
    if (t && !decorative) boxes.push({ x: e.transform.x, y: e.transform.y, width: t.map_width * 8, height: t.map_height * 8 });
  }
  if (!boxes.length) return { x: 0, y: 0, ...frame };
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

export function cameraPreset(pattern: CameraPattern, bounds: CameraArea, target: "megadrive" | "snes"): VisualCameraConfig {
  const frame = cameraFrame(target);
  const side=pattern==="platformer"||pattern==="beat_em_up";
  return { version: 1, active: true, pattern, anchor_x: 0, anchor_y: 0,
    screen_x: Math.round(frame.width * (side ? 0.4 : 0.5)), screen_y: 112,
    horizontal: true, vertical: pattern!=="beat_em_up", response_x: pattern === "fixed" ? 1 : 8,
    response_y: side ? 12 : 8,
    dead_zone_x: pattern === "exploration" ? 24 : 0,
    dead_zone_y: pattern === "platformer" ? 32 : pattern === "exploration" ? 24 : 0,
    look_ahead: side ? 32 : 0,
    max_speed: 16, speed: 60, paused: false, bounds: { ...bounds }, advanced:emptyAdvanced() };
}

export function cameraConflict(scene: Scene): boolean {
  if (scene.retrofx?.parallax_layers.some(l => l.enabled) || scene.retrofx?.raster_lines.some(l => l.enabled)) return true;
  return scene.entities.some(e => {
    const graph = e.components?.logic?.graph;
    if (!graph) return Boolean(e.components?.logic?.graph_ref);
    try {
      const nodes = (JSON.parse(graph) as { nodes?: { type?: string }[] }).nodes ?? [];
      return nodes.some(n => ["camera_follow", "camera_bounds", "move_camera", "scroll_tilemap", "effect_parallax", "effect_raster"].includes(n.type ?? ""));
    } catch { return true; }
  });
}

export function cameraConflictSources(scene: Scene): { entityId?: string; nodeId?: string; message: string }[] {
  const conflicts: { entityId?: string; nodeId?: string; message: string }[] = [];
  if (scene.retrofx?.parallax_layers.some(l => l.enabled) || scene.retrofx?.raster_lines.some(l => l.enabled))
    conflicts.push({ message: "RetroFX: paralaxe ou raster ligado disputa os planos da câmera visual." });
  for (const e of scene.entities) {
    const name = e.display_name || e.entity_id, logic = e.components.logic;
    if ((e.components.tilemap?.scroll_x ?? 0) !== 0 || (e.components.tilemap?.scroll_y ?? 0) !== 0)
      conflicts.push({ entityId: e.entity_id, message: `${name}: zere o deslocamento legado do tilemap; use a posição da entidade.` });
    if (!logic?.graph && logic?.graph_ref) conflicts.push({ entityId: e.entity_id, message: `${name}: lógica externa ${logic.graph_ref} precisa ser reconciliada.` });
    if (!logic?.graph) continue;
    try {
      const graph = JSON.parse(logic.graph) as { nodes?: { id?: string; type?: string; label?: string }[] };
      for (const node of graph.nodes ?? []) if (["camera_follow", "camera_bounds", "move_camera", "scroll_tilemap", "effect_parallax", "effect_raster"].includes(node.type ?? ""))
        conflicts.push({ entityId: e.entity_id, nodeId: node.id, message: `${name}: ${node.label || node.type} (${node.id ?? "sem identidade"}) é um comando antigo que disputa câmera/rolagem.` });
    } catch { conflicts.push({ entityId: e.entity_id, message: `${name}: grafo ilegível; corrija a lógica antes de converter.` }); }
  }
  return conflicts;
}

/** SVG meet/letterbox mapping, shared by composition, map clicks and drags. */
export function cameraPointerPoint(client: { x: number; y: number }, rect: { left: number; top: number; width: number; height: number }, area: CameraArea) {
  const scale = Math.min(rect.width / area.width, rect.height / area.height);
  if (!Number.isFinite(scale) || scale <= 0) return { x: area.x, y: area.y };
  const left = rect.left + (rect.width - area.width * scale) / 2;
  const top = rect.top + (rect.height - area.height * scale) / 2;
  return { x: Math.round(area.x + Math.max(0, Math.min(area.width, (client.x - left) / scale))),
    y: Math.round(area.y + Math.max(0, Math.min(area.height, (client.y - top) / scale))) };
}

export function cameraValidation(camera: CameraComponent, scene: Scene, target: "megadrive" | "snes", origin?:{x:number;y:number}, ownerId?:string): string[] {
  const v = camera.visual;
  if (!v) return [];
  const errors: string[] = [];
  if (v.version !== 1 || !CAMERA_PATTERNS.some(p => p.id === v.pattern)) errors.push("Versão ou padrão de câmera não reconhecido.");
  if (cameraFollows(v) &&
      !scene.entities.some(e => e.entity_id === camera.follow_entity && e.components?.sprite)) errors.push("Escolha um personagem com imagem da cena.");
  if (cameraConflict(scene)) errors.push("A cena usa comandos antigos de câmera/rolagem ou lógica externa. Remova esses comandos antes da conversão visual.");
  if (scene.entities.some(e => (e.components?.tilemap?.scroll_x ?? 0) !== 0 || (e.components?.tilemap?.scroll_y ?? 0) !== 0)) errors.push("Zere os deslocamentos antigos do cenário antes de usar a câmera visual. Posicione o cenário pela sua posição na cena.");
  const frame = cameraFrame(target);
  const ints = [v.anchor_x,v.anchor_y,v.screen_x,v.screen_y,v.response_x,v.response_y,v.dead_zone_x,v.dead_zone_y,v.look_ahead,v.max_speed,v.speed,
    v.bounds.x,v.bounds.y,v.bounds.width,v.bounds.height,camera.offset_x ?? 0,camera.offset_y ?? 0,origin?.x??0,origin?.y??0];
  if (ints.some(n => !Number.isInteger(n) || Math.abs(n) > 16000)) errors.push("Use valores inteiros entre −16000 e 16000.");
  if (v.bounds.width < 1 || v.bounds.height < 1 || Math.abs(v.bounds.x + v.bounds.width) > 16000 || Math.abs(v.bounds.y + v.bounds.height) > 16000) errors.push("A área permitida deve ter tamanho positivo e caber nas coordenadas do destino.");
  if (v.response_x < 1 || v.response_x > 60 || v.response_y < 1 || v.response_y > 60 || v.max_speed < 1 || v.max_speed > 256) errors.push("Resposta deve ficar entre 1 e 60; velocidade máxima entre 1 e 256.");
  if (v.screen_x < 0 || v.screen_x > frame.width || v.screen_y < 0 || v.screen_y > frame.height || v.dead_zone_x < 0 || v.dead_zone_y < 0 || v.look_ahead < 0) errors.push("Enquadramento e região livre devem caber na janela do jogador.");
  const a = cameraAdvanced(v);
  const owner = ownerId ?? scene.entities.find(e=>e.components.camera===camera)?.entity_id;
  const others = scene.entities.filter(e=>e.entity_id!==owner && e.components.camera?.visual);
  if(others.length+1>8)errors.push("Use até oito câmeras visuais por cena.");
  const initial = v.active ? 1 : others.filter(e=>e.components.camera!.visual!.active).length;
  if(initial>1)errors.push("Há várias câmeras iniciais. Marque esta câmera como inicial para resolver a seleção.");
  if(!initial)for(const e of scene.entities){try{
    const nodes = JSON.parse(e.components.logic?.graph??"{}").nodes??[];
    if(nodes.some((n:{type?:string})=>n.type==="camera_control"))errors.push(`${e.display_name||e.entity_id}: eventos de câmera precisam de uma câmera visual inicial. Marque uma antes de aplicar.`);
  }catch{/* Malformed graphs are already reported by cameraConflict. */}}
  if(scene.entities.filter(e=>e.components.tilemap).length>2)errors.push("A câmera visual usa até dois planos residentes compatíveis; o HUD tem sua própria superfície.");
  if(target==="snes")for(const e of scene.entities)if(e.components.hud)errors.push(`${e.display_name||e.entity_id}: HUD fixo ainda não está disponível no SNES. Remova o HUD desta cena para testar este destino.`);
  const validArea=(b:CameraArea)=>[b.x,b.y,b.width,b.height].every(n=>Number.isInteger(n)&&Math.abs(n)<=16000)&&b.width>0&&b.height>0&&Math.abs(b.x+b.width)<=16000&&Math.abs(b.y+b.height)<=16000;
  if(a.rooms.length>16||a.path.length>32||a.targets.length>4) errors.push("Use até 16 salas, 32 pontos e 4 personagens por câmera.");
  if(v.pattern==="rooms"&&!a.rooms.length) errors.push("Adicione pelo menos uma sala.");
  if(a.rooms.some(r=>!r.id||!r.name.trim()||r.name.length>80||!validArea(r.area)||!Number.isInteger(r.priority)||Math.abs(r.priority)>16000)||new Set(a.rooms.map(r=>r.id)).size!==a.rooms.length)errors.push("Salas precisam de nome, identidade única, prioridade inteira e área válida.");
  if(v.pattern==="arena"&&(a.targets.length<2||new Set(a.targets).size!==a.targets.length||a.targets.some(id=>!scene.entities.some(e=>e.entity_id===id&&e.components.sprite))))errors.push("Escolha de 2 a 4 personagens diferentes para a arena.");
  if(v.pattern==="sequence"&&!a.path.length)errors.push("Adicione pelo menos um ponto ao percurso.");
  if(a.path.some(p=>![p.x,p.y,p.frames,p.wait].every(Number.isInteger)||Math.abs(p.x)>16000||Math.abs(p.y)>16000||p.frames<0||p.frames>36000||p.wait<0||p.wait>36000))errors.push("Pontos precisam de posição válida e duração/espera entre 0 e 36000 quadros.");
  if(a.activation&&!validArea(a.activation))errors.push("A região de ativação precisa de área válida.");
  if(a.activation&&v.pattern!=="arena"&&!scene.entities.some(e=>e.entity_id===camera.follow_entity&&e.components.sprite))errors.push("Escolha um personagem de referência para ativar a câmera por região.");
  if(!Number.isInteger(a.priority)||Math.abs(a.priority)>16000)errors.push("A prioridade precisa ser um inteiro entre −16000 e 16000.");
  if(new Set(a.parallax.map(l=>l.entity_id)).size!==a.parallax.length||a.parallax.some(l=>!scene.entities.some(e=>e.entity_id===l.entity_id&&e.components.tilemap)||![l.ratio_x,l.ratio_y].every(n=>Number.isInteger(n)&&n>=0&&n<=200)))errors.push("Paralaxe exige camadas diferentes e razões inteiras entre 0% e 200%.");
  return errors;
}

export interface CameraSample { x: number; y: number; previousTargetX: number; direction: number; remainder: number; initialized: boolean;
  room_id:string|null;path_index:number;path_tick:number;path_fresh:boolean;path_from_x:number;path_from_y:number;furthest_x:number;separated:boolean }
export function initialCameraSample(): CameraSample { return { x:0,y:0,previousTargetX:0,direction:0,remainder:0,initialized:false,
  room_id:null,path_index:0,path_tick:0,path_fresh:true,path_from_x:0,path_from_y:0,furthest_x:-16000,separated:false }; }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function approach(current: number, desired: number, dead: number, response: number, speed: number) {
  const difference = desired - current;
  const distance = Math.max(0, Math.abs(difference) - dead);
  const step = distance ? Math.max(1, Math.trunc(distance / response)) : 0;
  return current + Math.sign(difference) * Math.min(speed, step);
}

/** Integer formula also emitted by compiler/camera_runtime.rs. No entity mutations. */
export function sampleCamera(camera: CameraComponent, origin: { x: number; y: number },
  targetPoint: { x: number; y: number } | null, target: "megadrive" | "snes", previous = initialCameraSample(), fps = 60,
  targets:Record<string,{x:number;y:number}>={}): CameraSample {
  const v = camera.visual;
  if (!v) return previous;
  const frame = cameraFrame(target);
  const a = cameraAdvanced(v);
  const baseX = Math.trunc(origin.x + (camera.offset_x ?? 0));
  const baseY = Math.trunc(origin.y + (camera.offset_y ?? 0));
  let { x, y, direction, remainder } = previous;
  let room_id=previous.room_id,path_index=previous.path_index,path_tick=previous.path_tick,path_fresh=previous.path_fresh,
    path_from_x=previous.path_from_x,path_from_y=previous.path_from_y,separated=false;
  if (!previous.initialized || v.pattern === "fixed") { x = baseX; y = baseY; }
  if(!previous.initialized){path_from_x=baseX;path_from_y=baseY;path_index=0;path_tick=0;path_fresh=true;}
  if(v.pattern==="arena"){
    const points=a.targets.flatMap(id=>targets[id]?[targets[id]]:[]);
    if(points.length){const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      targetPoint={x:Math.trunc((minX+maxX)/2),y:Math.trunc((minY+maxY)/2)};separated=maxX-minX>frame.width||maxY-minY>frame.height;}
  }
  let pathActive=false;
  if(v.pattern==="sequence"&&path_index<a.path.length){
    pathActive=true;const p=a.path[path_index];if(previous.initialized&&!v.paused&&!path_fresh)path_tick++;
    const px=p.x+(camera.offset_x??0),py=p.y+(camera.offset_y??0);
    if(!v.paused){path_fresh=false;if(v.horizontal)x=p.frames?path_from_x+Math.trunc((px-path_from_x)*Math.min(path_tick,p.frames)/p.frames):px;
      if(v.vertical)y=p.frames?path_from_y+Math.trunc((py-path_from_y)*Math.min(path_tick,p.frames)/p.frames):py;
      if(path_tick>=p.frames+p.wait){path_index++;path_tick=0;path_fresh=a.path[path_index]?.frames===0;path_from_x=px;path_from_y=py;}}
  }
  if (!pathActive && (cameraFollows(v) || v.pattern==="arena") && targetPoint && !v.paused) {
    if (previous.initialized && targetPoint.x !== previous.previousTargetX) direction = Math.sign(targetPoint.x - previous.previousTargetX);
    let dx = Math.trunc(targetPoint.x) + v.anchor_x - v.screen_x + (camera.offset_x ?? 0) + v.look_ahead * direction;
    let dy = Math.trunc(targetPoint.y) + v.anchor_y - v.screen_y + (camera.offset_y ?? 0);
    let cut=!previous.initialized;
    if(v.pattern==="rooms"){
      const p={x:targetPoint.x+v.anchor_x,y:targetPoint.y+v.anchor_y};
      const matching=a.rooms.filter(r=>p.x>=r.area.x&&p.x<r.area.x+r.area.width&&p.y>=r.area.y&&p.y<r.area.y+r.area.height)
        .sort((l,r)=>r.priority-l.priority||compareCameraIds(l.id,r.id));
      const room=matching[0]??a.rooms.find(r=>r.id===room_id);
      if(room){cut=cut||(room.id!==room_id&&!room.smooth);room_id=room.id;
        dx=clamp(dx,room.area.x,room.area.x+Math.max(0,room.area.width-frame.width));dy=clamp(dy,room.area.y,room.area.y+Math.max(0,room.area.height-frame.height));}
    }
    if (v.horizontal) x = cut ? dx : approach(x, dx, v.dead_zone_x, v.response_x, v.max_speed);
    if (v.vertical) y = cut ? dy : approach(y, dy, v.dead_zone_y, v.response_y, v.max_speed);
    if(v.pattern==="beat_em_up"&&!a.allow_backtracking)x=Math.max(x,previous.furthest_x);
  } else if (v.pattern.startsWith("auto_") && previous.initialized && !v.paused) {
    remainder += v.speed;
    const step = Math.trunc(remainder / fps);
    remainder -= step * fps;
    if (v.pattern === "auto_horizontal" && v.horizontal) x += step;
    if (v.pattern === "auto_vertical" && v.vertical) y += step;
  }
  return { x: clamp(x, v.bounds.x, v.bounds.x + Math.max(0, v.bounds.width - frame.width)),
    y: clamp(y, v.bounds.y, v.bounds.y + Math.max(0, v.bounds.height - frame.height)),
    previousTargetX: Math.trunc(targetPoint?.x ?? 0), direction, remainder, initialized: true,
    room_id,path_index,path_tick,path_fresh,path_from_x,path_from_y,furthest_x:Math.max(previous.furthest_x,clamp(x,v.bounds.x,v.bounds.x+Math.max(0,v.bounds.width-frame.width))),separated };
}

export function activeVisualCamera(scene: Scene): Entity | undefined {
  return scene.entities.find(e => e.components?.camera?.visual?.active);
}

export function initialVisualCamera(scene:Scene):Entity|undefined {
  const initial=activeVisualCamera(scene);if(!initial)return undefined;
  return scene.entities.filter(e=>{
    const c=e.components.camera,v=c?.visual,b=v&&cameraAdvanced(v).activation;
    const target=c?cameraReferencePoint(c,scene):null;
    return Boolean(v&&b&&target&&target.x+v.anchor_x>=b.x&&target.x+v.anchor_x<b.x+b.width&&target.y+v.anchor_y>=b.y&&target.y+v.anchor_y<b.y+b.height);
  }).sort((a,b)=>cameraAdvanced(b.components.camera!.visual!).priority-cameraAdvanced(a.components.camera!.visual!).priority||compareCameraIds(a.entity_id,b.entity_id))[0]??initial;
}

export function cameraReferencePoint(camera:CameraComponent,scene:Scene):{x:number;y:number}|null {
  if(camera.visual?.pattern==="arena"){
    const points=cameraAdvanced(camera.visual).targets.flatMap(id=>{const e=scene.entities.find(e=>e.entity_id===id&&e.components.sprite);return e?[e.transform]:[];});
    if(!points.length)return null;
    return {x:Math.trunc((Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2),y:Math.trunc((Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2)};
  }
  return scene.entities.find(e=>e.entity_id===camera.follow_entity&&e.components.sprite)?.transform??null;
}

/** Window event asking the mounted CameraConfigurator to open (detail: { entityId }). */
export const CONFIGURE_CAMERA_EVENT = "rds:configure-camera";
export function requestCameraConfiguration(entityId?: string): boolean {
  const event = new CustomEvent(CONFIGURE_CAMERA_EVENT, { detail: { entityId }, cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
