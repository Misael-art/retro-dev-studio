import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CameraConfigurator from "./CameraConfigurator";
import { useEditorStore } from "../../core/store/editorStore";
import { cameraPreset } from "../../core/cameraWorkflow";
import type { Scene } from "../../core/ipc/sceneService";
import { getProjectSettings } from "../../core/ipc/projectService";

vi.mock("../../core/ipc/projectService",()=>({getProjectSettings:vi.fn()}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
const click=async(text:string)=>{const e=Array.from(document.querySelectorAll("button")).find(b=>b.textContent===text);if(!e)throw new Error(text);await act(async()=>e.click());};
const inputValue=async(label:string,value:string)=>{const e=document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;if(!e)throw Error(label);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(e,value);e.dispatchEvent(new Event("input",{bubbles:true}));});};
const sceneFixture=():Scene=>({scene_id:"main",background_layers:[],entities:[
  {entity_id:"hero",display_name:"Herói",prefab:null,transform:{x:200,y:100},components:{sprite:{asset:"hero.png",frame_width:16,frame_height:32,palette_slot:0,animations:{}}}},
  {entity_id:"camera",prefab:null,transform:{x:0,y:0},components:{camera:{follow_entity:"hero",offset_x:-160,offset_y:-112}}},
]});
beforeEach(()=>{vi.resetAllMocks();container=document.createElement("div");document.body.append(container);root=createRoot(container);useEditorStore.setState({activeProjectDir:"",activeScene:sceneFixture(),activeSceneSource:sceneFixture(),activeTarget:"megadrive",sceneRevision:1,undoStack:[],redoStack:[],pendingHistorySnapshot:null});});
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
  it("saves, duplicates, renames and reuses effective values in one reversible scene transaction",async()=>{
    await act(async()=>root.render(<CameraConfigurator entityId="camera"/>));await click("Configurar câmera");
    await inputValue("Ponto na tela X","80");await inputValue("Deslocamento X","7");
    await click("Salvar como meu padrão");await click("Duplicar padrão");
    await inputValue("Nome do meu padrão","Seguimento suave");await click("Renomear padrão");
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera!.patterns).toBeUndefined();
    await inputValue("Ponto na tela X","200");await inputValue("Deslocamento X","50");await click("Usar padrão");
    expect((document.querySelector('input[aria-label="Ponto na tela X"]') as HTMLInputElement).value).toBe("80");
    expect((document.querySelector('input[aria-label="Deslocamento X"]') as HTMLInputElement).value).toBe("7");
    await click("Aplicar");
    const c=useEditorStore.getState().activeScene!.entities[1].components.camera!;
    expect(c.patterns?.map(p=>p.name)).toEqual(["Meu padrão","Seguimento suave"]);
    expect(c.patterns?.[0].id).not.toBe(c.patterns?.[1].id);
    expect(c.visual?.screen_x).toBe(80);expect(c.offset_x).toBe(7);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    await act(async()=>useEditorStore.getState().undo());
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera?.visual).toBeUndefined();
    await act(async()=>useEditorStore.getState().redo());await click("Configurar câmera");
    expect(document.querySelector('select[aria-label="Padrão de câmera salvo"]')?.textContent).toContain("Seguimento suave");
    await inputValue("Nome do meu padrão","Descartar");await click("Salvar como meu padrão");await click("Cancelar");
    expect(useEditorStore.getState().activeScene!.entities[1].components.camera?.patterns).toHaveLength(2);
  });
  it("reads the effective project clock only for an open preview and reports clock failures",async()=>{
    vi.mocked(getProjectSettings).mockResolvedValue({fps:50,target:"megadrive",region:"europe",video_standard:"pal",internal_rom_name:"Camera",sram:{enabled:false,size_bytes:0},save_slots:0,debug_overlay:false,warnings:[]});
    useEditorStore.setState({activeProjectDir:"/test/camera"});
    await act(async()=>root.render(<CameraConfigurator entityId="camera"/>));
    expect(getProjectSettings).not.toHaveBeenCalled();await click("Configurar câmera");
    expect(getProjectSettings).toHaveBeenCalledWith("/test/camera");expect(document.body.textContent).toContain("50 quadros/s");await click("Cancelar");
    vi.mocked(getProjectSettings).mockRejectedValue(new Error("unavailable"));await click("Configurar câmera");
    expect(document.body.textContent).toContain("taxa do projeto não pôde ser lida");
    expect(Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Reproduzir prévia")?.disabled).toBe(true);
  });
  it("starts a selected preset from its own values while keeping the saved library",async()=>{
    await act(async()=>root.render(<CameraConfigurator entityId="camera"/>));await click("Configurar câmera");
    await click("Salvar como meu padrão");
    await act(async()=>(document.querySelector('[data-testid="camera-pattern-rooms"]') as HTMLButtonElement).click());
    await click("Adicionar sala e desenhar");
    await act(async()=>(document.querySelector('[data-testid="camera-pattern-platformer"]') as HTMLButtonElement).click());
    await click("Aplicar");const c=useEditorStore.getState().activeScene!.entities[1].components.camera!;
    expect(c.visual?.advanced?.rooms).toEqual([]);expect(c.patterns).toHaveLength(1);
  });
});
