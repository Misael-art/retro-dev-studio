import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Scene } from "../../core/ipc/sceneService";

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), capture:vi.fn(),load:vi.fn(), publish: vi.fn(), propose: vi.fn(), persist: vi.fn() }));
vi.mock("@tauri-apps/api/core",()=>({invoke:vi.fn(),convertFileSrc:(path:string)=>`asset://${path}`}));
vi.mock("@tauri-apps/api/webviewWindow",()=>({getCurrentWebviewWindow:()=>({onDragDropEvent:async()=>()=>{}})}));
vi.mock("../../core/ipc/artStudioService",async original=>({...await original<typeof import("../../core/ipc/artStudioService")>(),loadPixelArtDoc:mocks.load}));
vi.mock("../../core/imageIngress", async original => ({ ...(await original<typeof import("../../core/imageIngress")>()), captureClipboardImage:mocks.capture, prepareImage: mocks.prepare, publishImage: mocks.publish, proposeImage: mocks.propose }));
vi.mock("../../core/scenePersistence", () => ({ persistActiveScene: mocks.persist }));
import ImageIngress from "./ImageIngress";
import { useEditorStore } from "../../core/store/editorStore";
import { createSpriteEntityFromAsset } from "../../core/editorEntityFactory";
import { createPixelDoc,serializePixelDoc } from "../../core/pixelEditor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
const scene = { scene_id:"main", entities:[], background_layers:[], palettes:[] } as unknown as Scene;
const prepared = {name:"gif", source_relative:".rds/art-sources/hash.gif",source_width:16,source_height:16,frame_count:2,preview_base64:"",suggested_role:"sprite",warnings:[]};
const click = async (id: string) => act(async () => { (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).click(); });
const paste = async (target: Element = document.body) => act(async () => {
  const event = new Event("paste", {bubbles:true,cancelable:true});
  Object.defineProperty(event,"clipboardData",{value:{files:[],getData:(key:string)=>key==="text/plain"?"https://example.org/ball.gif":""}});
  target.dispatchEvent(event);
});

beforeEach(() => {
  vi.clearAllMocks();
  useEditorStore.getState().setActiveProject("/one","One");
  useEditorStore.getState().setActiveScene(structuredClone(scene));
  useEditorStore.setState({activeTarget:"megadrive",activeScenePath:"scenes/main.json"});
  mocks.prepare.mockResolvedValue(prepared);
  mocks.capture.mockResolvedValue(null);
  const entity = createSpriteEntityFromAsset({assetPath:"assets/sprites/pixel/gif.png",target:"megadrive",existingEntityIds:[],suggestedName:"gif"});
  mocks.publish.mockResolvedValue({entity,doc:createPixelDoc(16,16,{frames:2}),prepared,assetPath:entity.components.sprite!.asset});
  mocks.propose.mockImplementation(async (_project,s,item) => ({scene:{...s,entities:[...s.entities,item.entity]},before:{},plan:{},errors:[]}));
  mocks.persist.mockResolvedValue(true);
  container=document.createElement("div");document.body.appendChild(container);root=createRoot(container);
  act(()=>root.render(<ImageIngress onWorkspaceSelect={workspace => {useEditorStore.getState().setActiveWorkspace(workspace);useEditorStore.getState().setActiveViewportTab(workspace);}}/>));
});
afterEach(()=>{act(()=>root.unmount());container.remove();Reflect.deleteProperty(window,"__TAURI_INTERNALS__");});

it("captures native image bytes when WebKit supplies an empty paste payload",async()=>{
  Object.defineProperty(window,"__TAURI_INTERNALS__",{value:{},configurable:true});mocks.capture.mockResolvedValue(prepared);
  await act(async()=>{
    const event=new Event("paste",{bubbles:true,cancelable:true});Object.defineProperty(event,"clipboardData",{value:{files:[],items:[],types:[],getData:()=>""}});document.body.dispatchEvent(event);
  });
  expect(mocks.capture).toHaveBeenCalledWith("/one");
  expect(document.querySelector('[data-testid="image-ingress-sprite"]')).toBeTruthy();
  await click("image-ingress-sprite");expect(useEditorStore.getState().activeScene?.entities).toHaveLength(1);
});

it("reuses a native library document without guessing a grid or asking its role again",async()=>{
  mocks.load.mockResolvedValue(serializePixelDoc(createPixelDoc(16,16,{frames:2})));
  await act(async()=>window.dispatchEvent(new CustomEvent("rds:use-pixel-asset",{detail:{document:"assets/sprites/pixel/gif.rdspixel.json",asset:"assets/sprites/pixel/gif.png"}})));
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.publish).toHaveBeenCalledTimes(1);
  expect(useEditorStore.getState().activeScene?.entities).toHaveLength(1);
  expect(useEditorStore.getState().activeViewportTab).toBe("scene");
});

it("captures image paste outside text fields, inserts one object and saves through the canonical writer",async()=>{
  const input=document.createElement("input");document.body.appendChild(input);
  await paste(input);expect(mocks.prepare).not.toHaveBeenCalled();input.remove();
  await paste();expect(document.querySelector('[data-testid="image-ingress-sprite"]')).toBeTruthy();
  await click("image-ingress-sprite");
  expect(useEditorStore.getState().activeScene?.entities).toHaveLength(1);
  expect(mocks.persist).toHaveBeenCalledWith("/one","Imagem");
  expect(document.querySelector('[data-testid="image-ingress-notice"]')?.textContent).toContain("Salvo no projeto");
  await click("image-ingress-edit");
  expect(useEditorStore.getState().activeViewportTab).toBe("artstudio");
  act(()=>useEditorStore.getState().undo());
  expect(useEditorStore.getState().activeScene?.entities).toHaveLength(0);
});

it("discards a late conversion when the user changes project",async()=>{
  let resolve!: (value: unknown)=>void;
  mocks.prepare.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  await paste();
  act(()=>{useEditorStore.getState().setActiveProject("/two","Two");useEditorStore.getState().setActiveScene(structuredClone(scene));});
  await act(async()=>resolve(prepared));
  expect(document.querySelector('[data-testid="image-ingress-dialog"]')).toBeNull();
  expect(useEditorStore.getState().activeProjectDir).toBe("/two");
  expect(mocks.publish).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
});

it("keeps scene shortcuts out of the modal and preserves a draft if the scene save fails",async()=>{
  await paste();const listener=vi.fn();window.addEventListener("keydown",listener);
  act(()=>document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true})));
  expect(listener).not.toHaveBeenCalled();window.removeEventListener("keydown",listener);
  mocks.persist.mockResolvedValue(false);await click("image-ingress-sprite");
  expect(useEditorStore.getState().activeScene?.entities).toHaveLength(1);
  expect(document.querySelector('[data-testid="image-ingress-notice"]')?.textContent).toContain("salvamento pendente");
});
