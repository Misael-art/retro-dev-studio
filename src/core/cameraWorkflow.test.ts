import { describe, expect, it } from "vitest";
import type { CameraComponent, Entity, Scene } from "./ipc/sceneService";
import { cameraAdvanced, reusableCameraConfig, cameraPointerPoint, cameraPreset, cameraValidation, cameraWorldArea, initialCameraSample, initialVisualCamera, sampleCamera } from "./cameraWorkflow";
import { getSceneEntityBounds, resolveSceneWorldMetrics, sceneArtworkEntities } from "./sceneWorldModel";

function fixture() {
  const hero: Entity = { entity_id:"hero",prefab:null,transform:{x:400,y:200},components:{sprite:{asset:"hero.png",frame_width:32,frame_height:48,palette_slot:0,animations:{}}} };
  const camera: CameraComponent = { follow_entity:"hero",offset_x:0,offset_y:0,visual:cameraPreset("platformer",{x:0,y:0,width:1024,height:512},"megadrive") };
  const entity: Entity = {entity_id:"camera",prefab:null,transform:{x:0,y:0},components:{camera}};
  const scene: Scene = {scene_id:"main",background_layers:[],entities:[hero,entity]};
  return {hero,camera,entity,scene};
}
describe("visual camera contract",()=>{
  it("reuses values without missing references or mutation and checks the effective initial selection",()=>{
    const {scene,camera}=fixture(),v=camera.visual!;
    v.advanced={...cameraAdvanced(v),targets:["hero","removed"],parallax:[{entity_id:"removed-plane",ratio_x:50,ratio_y:100}]};
    const reused=reusableCameraConfig(v,scene);
    expect(reused.advanced!.targets).toEqual(["hero"]);expect(reused.advanced!.parallax).toEqual([]);
    expect(v.advanced.targets).toEqual(["hero","removed"]);
    v.active=false;
    scene.entities[0].components.logic={graph:JSON.stringify({nodes:[{id:"pause",type:"camera_control"}]})};
    expect(cameraValidation(camera,scene,"megadrive",undefined,"camera").join()).toContain("eventos de câmera precisam");
    v.active=true;
    expect(cameraValidation(camera,scene,"megadrive",undefined,"camera").join()).not.toContain("eventos de câmera precisam");
  });
  it("maps letterboxed and zoomed previews back to world coordinates",()=>{
    const rect={left:10,top:20,width:400,height:200};
    expect(cameraPointerPoint({x:210,y:120},rect,{x:-200,y:-100,width:100,height:100})).toEqual({x:-150,y:-50});
    expect(cameraPointerPoint({x:10,y:20},rect,{x:-200,y:-100,width:100,height:100})).toEqual({x:-200,y:-100});
    expect(cameraPointerPoint({x:410,y:220},rect,{x:50,y:60,width:320,height:224})).toEqual({x:370,y:284});
  });
  it("uses collision as playable area and excludes distant decorative and parallax maps",()=>{
    const {scene,camera}=fixture();
    const map=(id:string,x:number):Entity=>({entity_id:id,prefab:null,transform:{x,y:-20},components:{tilemap:{tileset:"map.png",map_width:80,map_height:40}}});
    scene.entities.push(map("play",-80),map("decoration",8000),map("parallax",12000));
    scene.layers=[{id:"bg",name:"Fundo",kind:"background",visible:true,locked:false,depth:0,entity_ids:["decoration"]}];
    camera.visual!.advanced={...cameraAdvanced(camera.visual!),parallax:[{entity_id:"parallax",ratio_x:50,ratio_y:100}]};
    expect(cameraWorldArea(scene,"megadrive")).toEqual({x:-80,y:-20,width:640,height:320});
    scene.collision_map={width:40,height:28,tile_width:8,tile_height:8,data:[]};
    expect(cameraWorldArea(scene,"megadrive")).toEqual({x:0,y:0,width:320,height:224});
  });
  it("composes resident planes in hardware order with sprites above maps without reordering the scene",()=>{
    const {scene}=fixture();
    const map=(id:string):Entity=>({entity_id:id,prefab:null,transform:{x:0,y:0},components:{tilemap:{tileset:"map.png",map_width:32,map_height:32}}});
    scene.entities.push(map("first"),map("second"));
    const before=JSON.stringify(scene);
    expect(sceneArtworkEntities(scene,"megadrive").map(e=>e.entity_id)).toEqual(["first","second","hero","camera"]);
    expect(sceneArtworkEntities(scene,"snes").map(e=>e.entity_id)).toEqual(["second","first","hero","camera"]);
    expect(JSON.stringify(scene)).toBe(before);
  });
  it("preserves the direct response contract: large teleports still respect the visible speed ceiling",()=>{
    const {camera}=fixture(),v=camera.visual!;Object.assign(v,{response_x:1,response_y:1,look_ahead:0,dead_zone_x:0,dead_zone_y:0});
    for(const target of ["megadrive","snes"] as const){
      const first=sampleCamera(camera,{x:0,y:0},{x:400,y:200},target);
      expect(first.x).toBe(272);
      expect(sampleCamera(camera,{x:0,y:0},{x:700,y:200},target,first).x).toBe(288);
    }
  });
  it("uses a stable authored anchor and screen point, independent of animation dimensions",()=>{
    const {camera,hero,entity,scene}=fixture();
    camera.visual!.anchor_x=8;camera.visual!.anchor_y=16;
    expect(getSceneEntityBounds(entity,"megadrive",scene.entities)).toMatchObject({x:280,y:104,width:320,height:224});
    hero.components.sprite!.frame_width=128;hero.components.sprite!.frame_height=128;
    expect(getSceneEntityBounds(entity,"megadrive",scene.entities)).toMatchObject({x:280,y:104});
  });
  it("clamps negative coordinates and rooms smaller than the screen deterministically",()=>{
    const {camera}=fixture();camera.visual!.bounds={x:-80,y:-40,width:100,height:80};
    expect(sampleCamera(camera,{x:0,y:0},{x:1000,y:1000},"megadrive")).toMatchObject({x:-80,y:-40});
  });
  it("keeps legacy framing and excludes distant cameras/HUD from visual scene geometry",()=>{
    const {scene,entity,camera}=fixture();entity.transform={x:15000,y:15000};
    scene.entities.push({entity_id:"hud",prefab:null,transform:{x:14000,y:14000},components:{hud:{column:0,row:0,label:"Life"}}});
    expect(cameraWorldArea(scene,"megadrive")).toEqual({x:0,y:0,width:320,height:224});
    expect(resolveSceneWorldMetrics(scene,"megadrive").worldWidth).toBeLessThan(1000);
    delete camera.visual;
    expect(getSceneEntityBounds(entity,"megadrive",scene.entities)).toMatchObject({x:0,y:0}) // ROM contract: no tilemap clamps the legacy follow camera to 0;
  });
  it("selects only the explicitly active camera and retains no implicit fallback",()=>{
    const {scene,camera}=fixture();camera.visual!.active=false;
    expect(resolveSceneWorldMetrics(scene,"megadrive").camera).toBeNull();
  });
  it("retains signed subpixel remainder for slow automatic scrolling and pause",()=>{
    const {camera}=fixture();camera.visual!.pattern="auto_horizontal";camera.visual!.speed=-7;
    camera.visual!.bounds={x:-1000,y:0,width:2000,height:224};
    let s=sampleCamera(camera,{x:0,y:0},null,"megadrive");
    for(let i=0;i<60;i++)s=sampleCamera(camera,{x:0,y:0},null,"megadrive",s);
    expect(s.x).toBe(-7);expect(s.remainder).toBe(0);
    camera.visual!.paused=true;
    expect(sampleCamera(camera,{x:0,y:0},null,"megadrive",s).x).toBe(-7);
  });
  it("handles stop, reversal, jumping, falling, teleport and axis locks without mutating the scene",()=>{
    const {camera,scene}=fixture(); const original=JSON.stringify(scene);
    let s=sampleCamera(camera,{x:0,y:0},{x:400,y:200},"megadrive");
    const points=[{x:420,y:200},{x:420,y:200},{x:360,y:180},{x:360,y:120},{x:360,y:400},{x:10000,y:-10000}];
    for(const p of points){const old=s;s=sampleCamera(camera,{x:0,y:0},p,"megadrive",s);expect(Math.abs(s.x-old.x)).toBeLessThanOrEqual(16);expect(Math.abs(s.y-old.y)).toBeLessThanOrEqual(16);}
    expect(JSON.stringify(scene)).toBe(original);
    camera.visual!.horizontal=false; const x=s.x;
    expect(sampleCamera(camera,{x:0,y:0},{x:0,y:0},"megadrive",s).x).toBe(x);
    expect(sampleCamera(camera,{x:0,y:0},null,"megadrive",s).x).toBe(x);
  });
  it("rejects removed targets, unknown values and competing legacy commands",()=>{
    const {camera,scene}=fixture();
    expect(cameraValidation(camera,scene,"megadrive")).toEqual([]);
    camera.follow_entity="gone";expect(cameraValidation(camera,scene,"megadrive").join()).toContain("Escolha");
    camera.visual!.response_x=0;expect(cameraValidation(camera,scene,"megadrive").join()).toContain("Resposta");
    scene.entities[0].components.logic={graph:JSON.stringify({nodes:[{type:"camera_follow"}]})};
    expect(cameraValidation(camera,scene,"megadrive").join()).toContain("comandos antigos");
    expect(initialCameraSample().initialized).toBe(false);
  });
  it("assigns room borders to the next room, holds outside and cuts into a small room",()=>{
    const {camera}=fixture(),v=camera.visual!;v.pattern="rooms";v.anchor_x=8;
    v.advanced={...cameraAdvanced(v),rooms:[
      {id:"left",name:"Left",area:{x:0,y:0,width:320,height:224},priority:0,smooth:false},
      {id:"right",name:"Right",area:{x:320,y:0,width:320,height:224},priority:0,smooth:false},
      {id:"small",name:"Small",area:{x:640,y:0,width:100,height:100},priority:1,smooth:false},
    ]};
    let s=sampleCamera(camera,{x:0,y:0},{x:400,y:100},"megadrive");
    expect(s).toMatchObject({x:320,room_id:"right"});
    s=sampleCamera(camera,{x:0,y:0},{x:310,y:100},"megadrive",s);expect(s.x).toBe(0);
    s=sampleCamera(camera,{x:0,y:0},{x:312,y:100},"megadrive",s);expect(s.x).toBe(320);
    s=sampleCamera(camera,{x:0,y:0},{x:1100,y:500},"megadrive",s);expect(s).toMatchObject({x:320,room_id:"right"});
    s=sampleCamera(camera,{x:0,y:0},{x:650,y:50},"megadrive",s);expect(s).toMatchObject({x:640,y:0,room_id:"small"});
  });
  it("approaches smooth rooms and blocks backtracking until explicitly enabled",()=>{
    const {camera}=fixture(),v=camera.visual!;v.pattern="rooms";v.look_ahead=0;v.dead_zone_y=0;
    v.advanced={...cameraAdvanced(v),rooms:[{id:"left",name:"Left",area:{x:0,y:0,width:320,height:224},priority:0,smooth:true},{id:"right",name:"Right",area:{x:320,y:0,width:320,height:224},priority:0,smooth:true}]};
    let s=sampleCamera(camera,{x:0,y:0},{x:100,y:100},"megadrive");
    s=sampleCamera(camera,{x:0,y:0},{x:400,y:100},"megadrive",s);expect(s.x).toBe(16);
    v.pattern="beat_em_up";v.response_x=1;v.max_speed=256;
    s=sampleCamera(camera,{x:0,y:0},{x:600,y:100},"megadrive");const furthest=s.x;
    s=sampleCamera(camera,{x:0,y:0},{x:200,y:100},"megadrive",s);expect(s.x).toBe(furthest);
    v.paused=true;expect(sampleCamera(camera,{x:0,y:0},{x:700,y:100},"megadrive",s).x).toBe(furthest);
    v.paused=false;v.advanced.allow_backtracking=true;
    expect(sampleCamera(camera,{x:0,y:0},{x:200,y:100},"megadrive",s).x).toBeLessThan(furthest);
  });
  it("centres arena anchors, reports separation and refuses removed members",()=>{
    const {camera,scene,hero}=fixture(),v=camera.visual!;v.pattern="arena";v.anchor_x=8;v.screen_x=160;v.look_ahead=0;v.response_x=1;v.max_speed=256;
    v.advanced={...cameraAdvanced(v),targets:["hero","other"]};
    scene.entities.push({...structuredClone(hero),entity_id:"other",transform:{x:800,y:200}});
    let s=sampleCamera(camera,{x:0,y:0},null,"megadrive",undefined,60,{hero:{x:400,y:200},other:{x:800,y:200}});
    expect(s).toMatchObject({x:448,separated:true});
    s=sampleCamera(camera,{x:0,y:0},null,"megadrive",s,60,{hero:{x:400,y:200},other:{x:500,y:200}});
    expect(s).toMatchObject({x:298,separated:false});
    expect(cameraValidation(camera,scene,"megadrive")).toEqual([]);
    scene.entities.pop();expect(cameraValidation(camera,scene,"megadrive").join()).toContain("arena");
  });
  it("honours exact path duration, wait and cuts, then returns to the target",()=>{
    const {camera}=fixture(),v=camera.visual!;v.pattern="sequence";v.look_ahead=0;v.response_x=1;v.response_y=1;v.max_speed=256;v.dead_zone_y=0;
    v.advanced={...cameraAdvanced(v),path:[{x:120,y:60,frames:4,wait:2},{x:220,y:80,frames:0,wait:1}]};
    let s=initialCameraSample();const xs=[];
    for(let i=0;i<10;i++){s=sampleCamera(camera,{x:0,y:0},{x:400,y:200},"megadrive",s);xs.push(s.x);}
    expect(xs).toEqual([0,30,60,90,120,120,120,220,220,220]);
    v.advanced.return_to_target=true;
    expect(sampleCamera(camera,{x:0,y:0},{x:400,y:200},"megadrive",s)).toMatchObject({x:272,y:88});
  });
  it("uses the project PAL clock for signed scrolling and stable priority for initial regions",()=>{
    const {camera,scene,entity}=fixture(),v=camera.visual!;v.pattern="auto_horizontal";v.speed=-7;v.bounds={x:-1000,y:0,width:2000,height:512};
    let s=sampleCamera(camera,{x:400,y:0},null,"megadrive",undefined,50);
    for(let i=0;i<50;i++)s=sampleCamera(camera,{x:400,y:0},null,"megadrive",s,50);
    expect(s).toMatchObject({x:393,remainder:0});
    const other=structuredClone(entity);other.entity_id="camera_b";
    other.components.camera!.visual!.active=false;
    other.components.camera!.visual!.advanced={...cameraAdvanced(v),activation:{x:300,y:0,width:400,height:512},priority:10};
    scene.entities.push(other);expect(initialVisualCamera(scene)?.entity_id).toBe("camera_b");
    other.components.camera!.visual!.advanced.priority=0;
    v.advanced={...cameraAdvanced(v),activation:{x:300,y:0,width:400,height:512}};
    expect(initialVisualCamera(scene)?.entity_id).toBe("camera");
    camera.visual!.active=false;expect(initialVisualCamera(scene)).toBeUndefined();
  });
  it("rejects oversized room and activation extents before applying, matching target validation",()=>{
    const {camera,scene}=fixture(),v=camera.visual!;
    v.advanced={...cameraAdvanced(v),activation:{x:-16000,y:0,width:32000,height:224}};
    expect(cameraValidation(camera,scene,"megadrive").join()).toContain("região de ativação");
    v.advanced.activation=null;v.advanced.rooms=[{id:"room",name:"Room",area:{x:-16000,y:0,width:32000,height:224},priority:0,smooth:false}];
    expect(cameraValidation(camera,scene,"megadrive").join()).toContain("Salas");
  });
});
