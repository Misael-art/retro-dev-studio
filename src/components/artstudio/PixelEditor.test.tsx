import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("../../core/ipc/artStudioService", () => ({
  savePixelArtAsset: (...args: unknown[]) => saveMock(...args),
  loadPixelArtDoc: vi.fn(),
}));
vi.mock("../../core/pixelEditor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/pixelEditor")>();
  return { ...actual, zlibCompress: async () => new Uint8Array([1]), exportSheetPng: async () => ({ png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), line: 0, width: 32, height: 32 }) };
});

import PixelEditor from "./PixelEditor";
import { useEditorStore } from "../../core/store/editorStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  saveMock.mockReset();
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
  });

  it("paints with the active palette and updates the per-line color count", () => {
    render();
    expect(q("pixel-palette-count-0").textContent).toContain("0/15");
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
    expect(onSaved).toHaveBeenCalledWith("/proj/assets/sprites/pixel/novo_sprite.png");
    expect(q("pixel-save").textContent).toContain("Salvo");
  });
});
