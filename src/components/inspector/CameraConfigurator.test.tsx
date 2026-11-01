import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import CameraConfigurator from "./CameraConfigurator";
import { useEditorStore } from "../../core/store/editorStore";
import { cameraPreset } from "../../core/cameraWorkflow";
import type { Scene } from "../../core/ipc/sceneService";

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
const click=async(text:string)=>{const e=Array.from(document.querySelectorAll("button")).find(b=>b.textContent===text);if(!e)throw new Error(text);await act(async()=>e.click());};
const sceneFixture=():Scene=>({scene_id:"main",background_layers:[],entities:[
  {entity_id:"hero",display_name:"Herói",prefab:null,transform:{x:200,y:100},components:{sprite:{asset:"hero.png",frame_width:16,frame_height:32,palette_slot:0,animations:{}}}},
  {entity_id:"camera",prefab:null,transform:{x:0,y:0},components:{camera:{follow_entity:"hero",offset_x:-160,offset_y:-112}}},
]});
beforeEach(()=>{container=document.createElement("div");document.body.append(container);root=createRoot(container);useEditorStore.setState({activeScene:sceneFixture(),activeSceneSource:sceneFixture(),activeTarget:"megadrive",sceneRevision:1,undoStack:[],redoStack:[],pendingHistorySnapshot:null});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
describe("camera configuration transaction",()=>{
  it("cancels without converting, then converts in one undo entry and supports redo",async()=>{
    await act(async()=>root.render(<CameraConfigurator entityId="camera"/>));
    const before=JSON.stringify(useEditorStore.getState().activeScene);
    await click("Configurar câmera");await click("Cancelar");
    expect(JSON.stringify(useEditorStore.getState().activeScene)).toBe(before);
    await click("Configurar câmera");await click("Aplicar");
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera?.visual?.pattern).toBe("platformer");
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    await act(async()=>useEditorStore.getState().undo());
    expect(JSON.stringify(useEditorStore.getState().activeScene)).toBe(before);
    await act(async()=>useEditorStore.getState().redo());
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera?.visual?.active).toBe(true);
  });
  it("activates another camera atomically and undo restores both components",async()=>{
    const scene=sceneFixture();
    scene.entities.push({entity_id:"other",prefab:null,transform:{x:0,y:0},components:{camera:{visual:cameraPreset("fixed",{x:0,y:0,width:640,height:224},"megadrive")}}});
    useEditorStore.setState({activeScene:scene,activeSceneSource:structuredClone(scene)});
    await act(async()=>root.render(<CameraConfigurator entityId="camera"/>));
    await click("Configurar câmera");await click("Aplicar");
    expect(useEditorStore.getState().activeScene!.entities.filter(e=>e.components.camera?.visual?.active)).toHaveLength(1);
    await act(async()=>useEditorStore.getState().undo());
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera?.visual).toBeUndefined();
    expect(useEditorStore.getState().activeScene!.entities[2].components.camera?.visual?.active).toBe(true);
  });
  it("blocks stale application and discards the draft on project changes",async()=>{
    await act(async()=>root.render(<CameraConfigurator/>));await click("Configurar câmera");
    await act(async()=>useEditorStore.getState().updateEntity("hero",{transform:{x:300,y:100}}));
    expect(Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Aplicar")?.disabled).toBe(true);
    await act(async()=>useEditorStore.setState({projectSessionId:useEditorStore.getState().projectSessionId+1}));
    expect(document.querySelector('[data-testid="camera-configurator"]')).toBeNull();
  });
});
