import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((e: { payload: { type: string; paths: string[] } }) => void),
  decompileRomToSgdk: vi.fn(),
  revealExtractionDir: vi.fn(),
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    onDragDropEvent: async (h: typeof mocks.handler) => { mocks.handler = h; return () => {}; },
  }),
}));
vi.mock("../../core/ipc/toolsService", () => ({
  decompileRomToSgdk: mocks.decompileRomToSgdk,
  revealExtractionDir: mocks.revealExtractionDir,
}));

import RomDropDecompile, { ROM_DROP_PATTERN } from "./RomDropDecompile";

let host: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe("RomDropDecompile", () => {
  it("aceita só extensões de ROM Mega Drive", () => {
    expect(["a.md", "b.BIN", "c.gen", "d.smd"].every((p) => ROM_DROP_PATTERN.test(p))).toBe(true);
    expect(["a.png", "b.zip", "md"].some((p) => ROM_DROP_PATTERN.test(p))).toBe(false);
  });

  it("soltar ROM gera o projeto e o ícone abre o diretório da extração", async () => {
    mocks.decompileRomToSgdk.mockResolvedValue({
      out_dir: "/work/extract/abc/sgdk_project", header_title: "JOGO", normalized_sha256: "abc",
      images: 2, sprites: 3, sprite_frames: 9, music: 1, nemesis_streams: 0, code_functions: 40, coverage_ratio: 0.5, byte_exact: true,
    });
    mocks.revealExtractionDir.mockResolvedValue(undefined);
    act(() => root.render(<RomDropDecompile />));
    await flush();
    expect(host.textContent).toBe("");
    act(() => mocks.handler?.({ payload: { type: "drop", paths: ["/x/imagem.png", "/x/jogo.md"] } }));
    await flush();
    expect(mocks.decompileRomToSgdk).toHaveBeenCalledWith("/x/jogo.md");
    expect(host.textContent).toContain("Remontagem idêntica");
    act(() => (host.querySelector("[data-testid=rom-drop-open-dir]") as HTMLButtonElement).click());
    expect(mocks.revealExtractionDir).toHaveBeenCalledWith("/work/extract/abc/sgdk_project");
  });

  it("soltar só imagem não dispara decompilação", async () => {
    act(() => root.render(<RomDropDecompile />));
    await flush();
    act(() => mocks.handler?.({ payload: { type: "drop", paths: ["/x/imagem.png"] } }));
    await flush();
    expect(mocks.decompileRomToSgdk).not.toHaveBeenCalled();
  });
});
