import { beforeEach, describe, expect, it, vi } from "vitest";
const invokeMock=vi.hoisted(()=>vi.fn());
vi.mock("@tauri-apps/api/core",()=>({invoke:invokeMock}));
import { applyImageEdits, captureClipboardImage, editableImageTarget, imageFileInput, imageTransferSources, insertImageEntity, MAX_IMAGE_BYTES, pixelDocAnimation, replaceImageBank, type ImageCandidate } from "./imageIngress";
import { createSpriteEntityFromAsset, createTilemapEntityFromAsset } from "./editorEntityFactory";
import { createPixelDoc } from "./pixelEditor";
import type { Scene } from "./ipc/sceneService";
import type { PalettePlan } from "./palettePlan";

const transfer = (files: File[], data: Record<string, string> = {}) => ({ files, getData: (key: string) => data[key] ?? "" }) as unknown as DataTransfer;
const sprite = (name: string) => createSpriteEntityFromAsset({ assetPath: `${name}.png`, existingEntityIds: [], target: "megadrive", suggestedName: name });

describe("image ingress", () => {
  beforeEach(()=>invokeMock.mockReset());
  it("recovers the original animation from native HTML rather than silently flattening its raster snapshot", async () => {
    const original={frame_count:6}, flattened={frame_count:1};
    invokeMock.mockResolvedValueOnce({image:flattened,html:'<img src="https://example.org/ball.gif">'}).mockResolvedValueOnce(original);
    expect(await captureClipboardImage("/project")).toEqual(original);
    expect(invokeMock).toHaveBeenLastCalledWith("art_ingest_input",{projectRoot:"/project",input:{url:"https://example.org/ball.gif",name:"ball.gif"},role:null,background:"auto"});
    invokeMock.mockResolvedValueOnce({image:flattened,html:'<img src="data:image/png;base64,AQID">'}).mockResolvedValueOnce(flattened);
    expect(await captureClipboardImage("/project")).toEqual(flattened);
    expect(invokeMock.mock.lastCall?.[1].input.bytes).toEqual([1,2,3]);
    invokeMock.mockResolvedValueOnce({image:flattened,html:null});
    expect(await captureClipboardImage("/project")).toEqual(flattened);
  });
  it("reports original-image fetch failures without substituting a single flattened frame", async () => {
    invokeMock.mockResolvedValueOnce({image:{frame_count:1},html:'<img src="https://example.org/ball.gif">'}).mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(captureClipboardImage("/project")).rejects.toThrow("Network unavailable");
  });
  it("updates saved frame geometry, animation and a chosen palette together, preserving other scene objects", () => {
    const a=sprite("a"),other=sprite("other");
    const scene={entities:[a,other],palettes:[{id:`imagem:${a.entity_id}`,slot:2,bank:2,uses:[a.entity_id],colors:[]}]} as unknown as Scene;
    const before=structuredClone(scene),doc=createPixelDoc(48,32,{frames:3});doc.palettes[0][1]=[7,0,0];doc.frames[1].durationMs=150;
    const next=applyImageEdits(scene,a.entity_id,"assets/sprites/pixel/new.png",doc);
    expect(scene).toEqual(before);expect(next.entities[1]).toEqual(other);
    expect(next.entities[0].components.sprite).toMatchObject({asset:"assets/sprites/pixel/new.png",frame_width:48,frame_height:32,meta_sprite:true,animations:{idle:{frames:[0,1,2],frame_durations:[6,9,6]}}});
    expect(next.palettes![0]).toMatchObject({bank:2,uses:[a.entity_id]});
    expect(next.palettes![0].colors[1]).toBe("#ff0000");
  });
  it("preserves unequal animation delays and splits long holds without duplicating source frames", () => {
    const doc = createPixelDoc(16,16,{ frames: 3 });
    [40,150,5000].forEach((ms,i) => { doc.frames[i].durationMs = ms; });
    expect(pixelDocAnimation(doc)).toMatchObject({ frames: [0,1,2,2], frame_durations: [2,9,255,45] });
    expect(doc.frames).toHaveLength(3);
  });
  it("keeps the original GIF URL when a browser also supplies a flattened PNG", () => {
    const png = new File(["png"], "clipboard.png", { type: "image/png" });
    expect(imageTransferSources(transfer([png], { "text/html": '<img src="https://example.org/ball.gif?x=1">' }))).toEqual([{ url: "https://example.org/ball.gif?x=1", name: "ball.gif" }]);
    expect(imageTransferSources(transfer([png], { "text/html": '<img src="https://example.org/a.png">' }))).toEqual([{url:"https://example.org/a.png",name:"a.png"}]);
    expect(imageTransferSources(transfer([png], { "text/html": '<img src="https://example.org/cdn/image?id=42">' }))).toEqual([{url:"https://example.org/cdn/image?id=42",name:"image"}]);
    const gif=new File(["gif"],"original.gif",{type:"image/gif"});
    expect(imageTransferSources(transfer([gif], {"text/html":'<img src="https://example.org/private">'}))).toEqual([gif]);
    expect(imageTransferSources({files:[],items:[{kind:"file",getAsFile:()=>png}],getData:()=>""} as unknown as DataTransfer)).toEqual([png]);
  });

  it("tolerates malformed URLs and percent escapes and never executes clipboard markup", () => {
    expect(imageTransferSources(transfer([], { "text/plain": "https://%XX/a.png" }))).toEqual([]);
    expect(imageTransferSources(transfer([], { "text/html": '<script>throw 1</script><img src="https://example.org/%XX.gif">' }))[0]).toMatchObject({ name: "%XX.gif" });
    expect(imageTransferSources(transfer([], { "text/html": '<img src="file:///private/a.gif">' }))).toEqual([]);
    expect(imageTransferSources(transfer([], { "text/uri-list": 'file:///tmp/My%20Image.gif\nfile:///tmp/bg.png' }))).toEqual([{path:"/tmp/My Image.gif",name:"My Image.gif"},{path:"/tmp/bg.png",name:"bg.png"}]);
    expect(imageTransferSources(transfer([], { "text/plain": 'file://untrusted-host/private.gif' }))).toEqual([]);
  });

  it("leaves text editing alone and bounds source bytes before IPC", async () => {
    const input = document.createElement("input");
    expect(editableImageTarget(input)).toBe(true);
    expect(editableImageTarget(document.body)).toBe(false);
    const oversized = new File([], "big.png");
    Object.defineProperty(oversized, "size", { value: MAX_IMAGE_BYTES + 1 });
    await expect(imageFileInput(oversized)).rejects.toThrow("20 MB");
    expect(await imageFileInput(new File([new Uint8Array([1, 2, 3])], "small.png"))).toEqual({ name: "small.png", bytes: [1, 2, 3] });
  });

  it("inserts backgrounds before characters while preserving existing object order", () => {
    const a = sprite("a"), b = sprite("b");
    const background = createTilemapEntityFromAsset({ assetPath: "bg.png", existingEntityIds: [], suggestedName: "bg", mapWidth: 2, mapHeight: 2 });
    expect(insertImageEntity([a, b], background)).toEqual([background, a, b]);
    expect(insertImageEntity([background, a], b)).toEqual([background, a, b]);
  });

  it("reassigns only uses of the chosen bank without mutating the scene or deleting old palette resources", () => {
    const a = sprite("a"), b = sprite("b"), fresh = sprite("fresh");
    const scene = { entities: [a, b], palettes: [{ id: "old", name: "Old", slot: 1, bank: 1, colors: ["#ffffff"], uses: [a.entity_id] }, { id: "other", slot: 2, bank: 2, colors: ["#ff0000"], uses: [b.entity_id] }] } as Scene;
    const before = structuredClone(scene);
    const candidate = { entity: fresh, doc: createPixelDoc(16, 16), prepared: { name: "New" } } as ImageCandidate;
    const plan = { resources: [{ bank: 1, uses: [{ entity_id: a.entity_id }] }, { bank: 2, uses: [{ entity_id: b.entity_id }] }] } as PalettePlan;
    const changed = replaceImageBank(scene, candidate, plan, 1);
    expect(scene).toEqual(before);
    expect(changed[0]).toMatchObject({ id: "old", uses: [] });
    expect(changed[0].bank).toBeUndefined();
    expect(changed[1]).toEqual(scene.palettes![1]);
    expect(changed[2]).toMatchObject({ bank: 1, uses: [a.entity_id, fresh.entity_id] });
  });
});
