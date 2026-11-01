import { describe, expect, it } from "vitest";
import type { CameraComponent, Entity, Scene } from "./ipc/sceneService";
import { cameraPreset, cameraValidation, cameraWorldArea, initialCameraSample, sampleCamera } from "./cameraWorkflow";
import { getSceneEntityBounds, resolveSceneWorldMetrics } from "./sceneWorldModel";

function fixture() {
  const hero: Entity = { entity_id:"hero",prefab:null,transform:{x:400,y:200},components:{sprite:{asset:"hero.png",frame_width:32,frame_height:48,palette_slot:0,animations:{}}} };
  const camera: CameraComponent = { follow_entity:"hero",offset_x:0,offset_y:0,visual:cameraPreset("platformer",{x:0,y:0,width:1024,height:512},"megadrive") };
  const entity: Entity = {entity_id:"camera",prefab:null,transform:{x:0,y:0},components:{camera}};
  const scene: Scene = {scene_id:"main",background_layers:[],entities:[hero,entity]};
  return {hero,camera,entity,scene};
}
describe("visual camera contract",()=>{
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
    expect(getSceneEntityBounds(entity,"megadrive",scene.entities)).toMatchObject({x:256,y:112});
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
});
