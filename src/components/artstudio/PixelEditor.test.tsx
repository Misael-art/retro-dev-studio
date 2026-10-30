import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const loadMock = vi.fn();
const prepareMock = vi.fn();
const chooseMock = vi.fn();
vi.mock("../../core/imageIngress", async importOriginal => ({ ...await importOriginal<typeof import("../../core/imageIngress")>(), prepareImage: (...args: unknown[]) => prepareMock(...args) }));
vi.mock("../../core/sceneryImport", async importOriginal => ({ ...await importOriginal<typeof import("../../core/sceneryImport")>(), chooseImagePath: (...args: unknown[]) => chooseMock(...args) }));
vi.mock("../../core/ipc/artStudioService", () => ({
  savePixelArtAsset: (...args: unknown[]) => saveMock(...args),
  loadPixelArtDoc: (...args: unknown[]) => loadMock(...args),
}));
vi.mock("../../core/pixelEditor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/pixelEditor")>();
  return { ...actual, zlibCompress: async () => new Uint8Array([1]), exportSheetPng: async () => ({ png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), line: 0, width: 32, height: 32 }) };
});

import PixelEditor from "./PixelEditor";
import { useEditorStore } from "../../core/store/editorStore";
import { createPixelDoc, serializePixelDoc } from "../../core/pixelEditor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  saveMock.mockReset();
  loadMock.mockReset();
  prepareMock.mockReset();
  chooseMock.mockReset();
  useEditorStore.setState({ pixelEditorSessions: {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON: () => ({}) });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

function pointer(type: string, x: number, y: number, button = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button });
  Object.assign(event, { pointerId: 1 });
  q("pixel-canvas").dispatchEvent(event);
}

function render(projectDir: string | null = "/proj") {
  const onSaved = vi.fn();
  act(() => root.render(<PixelEditor projectDir={projectDir} source={null} log={vi.fn()} onSaved={onSaved} />));
  return { onSaved };
}

describe("PixelEditor", () => {
  it("does not publish a completed save into a different image context", async () => {
    let finish!: (value: unknown) => void;
    saveMock.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const {onSaved}=render();
    await act(async()=>q("pixel-save").click());
    expect(saveMock).toHaveBeenCalledOnce();
    act(()=>root.render(<PixelEditor projectDir="/proj" source={{url:"",name:"another",sourcePath:"assets/sprites/another.png",frameWidth:32,frameHeight:32,frames:[0]}} log={vi.fn()} onSaved={onSaved}/>));
    await act(async()=>finish({png_relative:"assets/sprites/pixel/old.png",png_absolute:"/proj/assets/sprites/pixel/old.png"}));
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("reopens the preserved source with its background and allows returning to previous edits", async () => {
    render();act(()=>q("pixel-frame-duplicate").click());
    const before = useEditorStore.getState().pixelEditorSessions["/proj"].doc;
    const original = createPixelDoc(24,24,{frames:3});
    prepareMock.mockResolvedValue({doc_json:serializePixelDoc(original)});
    act(()=>root.render(<PixelEditor projectDir="/proj" source={{url:"",sourcePath:"assets/sprites/pixel/gif.png",originalPath:"/proj/.rds/art-sources/source.gif",name:"gif",frameWidth:24,frameHeight:24,frames:[0,1,2]}} log={vi.fn()} onSaved={vi.fn()}/>));
    await act(async()=>q("pixel-reopen-original").click());
    expect(prepareMock).toHaveBeenCalledWith("/proj",expect.objectContaining({path:"/proj/.rds/art-sources/source.gif"}),"sprite","keep",undefined);
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.frames).toHaveLength(3);
    key("z");expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc).toEqual(before);
  });
  it("opens all native animation frames automatically and preserves the previous unsaved document in Undo", async () => {
    render();
    act(() => q("pixel-frame-duplicate").click());
    const previous = useEditorStore.getState().pixelEditorSessions["/proj"].doc;
    const gif = createPixelDoc(24, 24, { name: "gif", frames: 6 });
    gif.frames[1].durationMs = 150;
    loadMock.mockResolvedValue(serializePixelDoc(gif));
    await act(async () => root.render(<PixelEditor projectDir="/proj" source={{ url: "", sourcePath: "assets/sprites/pixel/gif.png", name: "gif", frameWidth: 24, frameHeight: 24, frames: [0,1,2,3,4,5], autoOpen: true }} log={vi.fn()} onSaved={vi.fn()}/>));
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]')).toHaveLength(6);
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.frames[1].durationMs).toBe(150);
    key("z");
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc).toEqual(previous);
  });
  const savedResult = { png_relative: "assets/sprites/pixel/novo_sprite.png", doc_relative: "x", png_absolute: "/proj/assets/sprites/pixel/novo_sprite.png" };
  const key = (key: string) => act(() => q("pixel-editor").dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true })));

  it("keeps the document, selection and undo history across unmounts without crossing projects", () => {
    render();
    act(() => q("pixel-frame-duplicate").click());
    act(() => root.render(null));
    render("/other");
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(1);
    act(() => root.render(null));
    render();
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(2);
    key("z");
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(1);
    key("y");
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(2);
    expect(q("pixel-save-state").textContent).toContain("Salve antes de fechar");
  });

  it("marks Undo pending and Redo saved only when the document matches the written revision", async () => {
    saveMock.mockResolvedValue(savedResult);
    render();
    act(() => q("pixel-frame-duplicate").click());
    await act(async () => q("pixel-save").click());
    expect(q("pixel-editor").dataset.dirty).toBe("false");
    key("z");
    expect(q("pixel-editor").dataset.dirty).toBe("true");
    expect(q("pixel-save").textContent).not.toContain("Salvo");
    expect(q("pixel-status").textContent).not.toContain("PNG e documento salvos");
    key("y");
    expect(q("pixel-editor").dataset.dirty).toBe("false");
  });

  it("a delayed save cannot mark newer edits saved or send the old sheet to Art", async () => {
    let resolve!: (value: typeof savedResult) => void;
    saveMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { onSaved } = render();
    await act(async () => q("pixel-save").click());
    expect((q("pixel-save") as HTMLButtonElement).disabled).toBe(true);
    act(() => q("pixel-frame-duplicate").click());
    await act(async () => resolve(savedResult));
    expect(q("pixel-editor").dataset.dirty).toBe("true");
    expect(q("pixel-save").textContent).not.toContain("Salvo");
    expect(onSaved).not.toHaveBeenCalled();
    expect(q("pixel-status").textContent).toContain("versão anterior");
  });

  it("keeps edits and retry available after a failed save", async () => {
    saveMock.mockRejectedValue(new Error("disco somente leitura"));
    render();
    act(() => q("pixel-frame-duplicate").click());
    await act(async () => q("pixel-save").click());
    expect(q("pixel-status").textContent).toContain("Falha ao salvar");
    expect(q("pixel-editor").dataset.dirty).toBe("true");
    expect((q("pixel-save") as HTMLButtonElement).disabled).toBe(false);
    saveMock.mockResolvedValue(savedResult);
    await act(async () => q("pixel-save").click());
    expect(q("pixel-editor").dataset.dirty).toBe("false");
  });
  it("shows tools with shortcuts and switches tool by keyboard", () => {
    render();
    expect(q("pixel-tool-pencil").dataset.active).toBe("true");
    expect(q("pixel-tool-bucket").title).toContain("(B)");
    act(() => q("pixel-editor").dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true })));
    expect(q("pixel-tool-bucket").dataset.active).toBe("true");
    expect(q("pixel-tool-bucket").textContent).toContain("Balde");
    expect(q("pixel-tool-help").textContent).toContain("Preenche");
  });

  it("brings the chosen task controls back into view even when selecting the same task", () => {
    render();
    const options = container.querySelector('[aria-label="Opções da tarefa de edição"]') as HTMLDivElement;
    options.scrollTop = 600; act(() => q("pixel-task-colors").click()); expect(options.scrollTop).toBe(0);
    options.scrollTop = 300; act(() => q("pixel-task-colors").click()); expect(options.scrollTop).toBe(0);
  });

  it("previews, cancels and applies an image filter as one undoable edit", () => {
    render();
    act(() => { pointer("pointerdown", 5, 5); pointer("pointerup", 5, 5); });
    const before = serializePixelDoc(useEditorStore.getState().pixelEditorSessions["/proj"].doc);
    act(() => q("pixel-task-colors").click());
    act(() => q("pixel-filter-invert").click());
    expect(q("pixel-image-proposal")).not.toBeNull();
    expect((q("pixel-save") as HTMLButtonElement).disabled).toBe(true);
    expect(serializePixelDoc(useEditorStore.getState().pixelEditorSessions["/proj"].doc)).toBe(before);
    act(() => q("pixel-cancel-image").click());
    expect(serializePixelDoc(useEditorStore.getState().pixelEditorSessions["/proj"].doc)).toBe(before);
    act(() => q("pixel-filter-invert").click());
    act(() => q("pixel-apply-image").click());
    expect(serializePixelDoc(useEditorStore.getState().pixelEditorSessions["/proj"].doc)).not.toBe(before);
    key("z");
    expect(serializePixelDoc(useEditorStore.getState().pixelEditorSessions["/proj"].doc)).toBe(before);
  });

  it("color isolation protects other colors and transparent pixels while drawing", () => {
    render();
    act(() => { pointer("pointerdown", 5, 5); pointer("pointerup", 5, 5); });
    act(() => q("pixel-task-colors").click()); act(() => q("pixel-isolate-color").click());
    act(() => q("pixel-slot-0-2").click());
    act(() => { pointer("pointerdown", 5, 5); pointer("pointerup", 5, 5); });
    act(() => { pointer("pointerdown", 25, 5); pointer("pointerup", 25, 5); });
    const pixels = useEditorStore.getState().pixelEditorSessions["/proj"].doc.frames[0].cels[0];
    expect(pixels[0]).toBe(2); expect(pixels[2]).toBe(0);
  });

  it("duplicates and merges a layer with undo instead of flattening the document implicitly", () => {
    render(); act(() => q("pixel-task-layers").click());
    act(() => q("pixel-layer-duplicate").click());
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.layers).toHaveLength(2);
    expect(q("pixel-layer-select-1").getAttribute("aria-pressed")).toBe("true");
    act(() => q("pixel-layer-merge").click());
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.layers).toHaveLength(1);
    key("z"); expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.layers).toHaveLength(2);
  });

  it("rejects a delayed collage when the user has continued editing", async () => {
    let resolve!: (value: unknown) => void;
    chooseMock.mockResolvedValue("/inputs/picture.png");
    prepareMock.mockImplementation(() => new Promise(done => { resolve = done; }));
    render(); act(() => q("pixel-task-compose").click());
    await act(async () => q("pixel-collage").click());
    act(() => q("pixel-frame-duplicate").click());
    await act(async () => resolve({ source_relative: ".rds/art-sources/source.png", frame_count: 1, name: "picture" }));
    const doc = useEditorStore.getState().pixelEditorSessions["/proj"].doc;
    expect(doc.frames).toHaveLength(2); expect(doc.layers).toHaveLength(1);
    expect(prepareMock).toHaveBeenCalledOnce();
  });

  it("passes the chosen conversion method when reopening the preserved original", async () => {
    render();
    const original = createPixelDoc(16, 16); original.conversionMethod = "dominant";
    prepareMock.mockResolvedValue({ doc_json: serializePixelDoc(original) });
    act(() => root.render(<PixelEditor projectDir="/proj" source={{url:"",sourcePath:"assets/sprites/pixel/source.png",originalPath:"/proj/.rds/art-sources/original.png",name:"source",frameWidth:16,frameHeight:16,frames:[0]}} log={vi.fn()} onSaved={vi.fn()} />));
    act(() => q("pixel-task-image").click());
    const select = container.querySelector('select[aria-label="Método de conversão"]') as HTMLSelectElement;
    act(() => { select.value = "dominant"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => q("pixel-reconvert").click());
    expect(prepareMock).toHaveBeenLastCalledWith("/proj", expect.objectContaining({path:"/proj/.rds/art-sources/original.png"}), "sprite", "keep", "dominant");
    expect(useEditorStore.getState().pixelEditorSessions["/proj"].doc.conversionMethod).toBe("dominant");
  });

  it("forks scene geometry edits and keeps one-step Undo after the saved copy reopens", async () => {
    const shared = createPixelDoc(24, 16, { name: "shared", target: "plane" }), onSaved = vi.fn();
    loadMock.mockResolvedValue(serializePixelDoc(shared));
    saveMock.mockImplementation((_project: string, name: string) => Promise.resolve({ png_relative: `assets/tilesets/pixel/${name}.png`, png_absolute: `/proj/assets/tilesets/pixel/${name}.png` }));
    const source = { url: "", sourcePath: "/proj/assets/tilesets/pixel/shared.png", name: "shared", frameWidth: 24, frameHeight: 16, frames: [0], autoOpen: true };
    await act(async () => root.render(<PixelEditor projectDir="/proj" source={source} log={vi.fn()} onSaved={onSaved} />));
    act(() => q("pixel-task-image").click()); act(() => q("pixel-rotate-image").click()); act(() => q("pixel-apply-image").click());
    await act(async () => q("pixel-save").click());
    expect(saveMock).toHaveBeenLastCalledWith("/proj", expect.stringContaining("shared_copy_"), expect.any(Uint8Array), expect.any(String));
    const copy = useEditorStore.getState().pixelEditorSessions["/proj"].doc;
    expect([copy.width, copy.height]).toEqual([16, 24]); expect(shared.width).toBe(24);
    loadMock.mockResolvedValue(serializePixelDoc(copy));
    await act(async () => root.render(<PixelEditor projectDir="/proj" source={{...source,sourcePath:`/proj/assets/tilesets/pixel/${copy.name}.png`,frameWidth:16,frameHeight:24}} log={vi.fn()} onSaved={onSaved} />));
    key("z"); const undone = useEditorStore.getState().pixelEditorSessions["/proj"].doc;
    expect([undone.name, undone.width, undone.height]).toEqual(["shared", 24, 16]);
  });

  it("paints with the active palette and updates the per-line color count", () => {
    render();
    expect(q("pixel-palette-count-0").textContent).toContain("0/15");
    act(() => q("pixel-show-all-palettes").click());
    act(() => q("pixel-slot-2-5").click());
    expect(q("pixel-palette-line-2").dataset.active).toBe("true");
    act(() => {
      pointer("pointerdown", 5, 5);
      pointer("pointerup", 5, 5);
    });
    expect(q("pixel-palette-count-2").textContent).toContain("1/15 usadas · restam 14");
    expect(q("pixel-hardware-ok")).not.toBeNull();
  });

  it("blocks mixing palette lines inside one 8x8 tile while the lock is on", () => {
    render();
    act(() => q("pixel-show-all-palettes").click());
    act(() => q("pixel-slot-0-1").click());
    act(() => {
      pointer("pointerdown", 5, 5);
      pointer("pointerup", 5, 5);
    });
    act(() => q("pixel-slot-1-1").click());
    act(() => {
      pointer("pointerdown", 15, 5);
      pointer("pointerup", 15, 5);
    });
    expect(q("pixel-status").textContent).toContain("recusado");
    expect(q("pixel-palette-count-1").textContent).toContain("0/15");
    expect(container.querySelector('[data-testid="pixel-warnings"]')).toBeNull();
  });

  it("adds and duplicates frames, and undo restores", () => {
    render();
    act(() => q("pixel-frame-duplicate").click());
    act(() => q("pixel-frame-add").click());
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(3);
    act(() => q("pixel-editor").dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(container.querySelectorAll('[data-testid^="pixel-frame-"][data-active]').length).toBe(2);
  });

  it("saves PNG and native document to the project", async () => {
    saveMock.mockResolvedValue({ png_relative: "assets/sprites/pixel/novo_sprite.png", doc_relative: "x", png_absolute: "/proj/assets/sprites/pixel/novo_sprite.png" });
    const { onSaved } = render();
    await act(async () => {
      q("pixel-save").click();
    });
    expect(saveMock).toHaveBeenCalledWith("/proj", "novo_sprite", expect.any(Uint8Array), expect.stringContaining("retrodev.pixel/v1"));
    expect(onSaved).toHaveBeenCalledWith("/proj/assets/sprites/pixel/novo_sprite.png", expect.objectContaining({ frames: expect.any(Array) }));
    expect(q("pixel-save").textContent).toContain("Salvo");
  });
});
