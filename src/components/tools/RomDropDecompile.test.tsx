import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((e: { payload: { type: string; paths: string[] } }) => void),
  probeRomInput: vi.fn(), resolveRomInput: vi.fn(), cancelRomInput: vi.fn(), open: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ getCurrentWebviewWindow: () => ({ onDragDropEvent: async (h: typeof mocks.handler) => { mocks.handler = h; return () => {}; } }) }));
vi.mock("./CompressedResourcePanel", () => ({ CompressedResourcePanel: () => <div /> }));
vi.mock("./InspectionPanel", () => ({ default: ({ initialRom }: { initialRom: { path: string } }) => <div data-testid="opened-catalog">{initialRom.path}</div> }));
vi.mock("../../core/ipc/toolsService", () => ({ ...mocks, decompileRomToSgdk: vi.fn(), revealExtractionDir: vi.fn() }));
import RomDropDecompile, { ROM_DROP_PATTERN } from "./RomDropDecompile";
let host: HTMLDivElement; let root: Root;
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const click = (id: string) => act(() => (document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click());
const probe = { input_id: "input", source_path: "/x/games.zip", source_sha256: "container-hash", kind: "zip", members: [{ name: "a.md", size: 512 }, { name: "b.bin", size: 512 }] };
beforeEach(() => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.resolveRomInput.mockResolvedValue({ input: probe, member: "b.bin", member_sha256: "member-hash", normalized_sha256: "normalized", rom_path: "/work/rom.bin" });
  mocks.cancelRomInput.mockResolvedValue(undefined);
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; vi.resetAllMocks(); });
describe("ROM input", () => {
  it("keeps selector and drop formats consistent", () => {
    expect(["a.md", "b.BIN", "c.gen", "d.smd", "a.ZIP", "b.7z"].every(p => ROM_DROP_PATTERN.test(p))).toBe(true);
    expect(["a.png", "b.rar", "md"].some(p => ROM_DROP_PATTERN.test(p))).toBe(false);
  });
  it("requires an explicit archive member and opens the existing catalog", async () => {
    mocks.probeRomInput.mockResolvedValue(probe);
    act(() => root.render(<RomDropDecompile />)); await flush();
    act(() => mocks.handler?.({ payload: { type: "drop", paths: ["/x/games.zip"] } })); await flush();
    expect(mocks.resolveRomInput).not.toHaveBeenCalled();
    expect((document.querySelector('[data-testid="rom-input-extract"]') as HTMLButtonElement).disabled).toBe(true);
    act(() => (document.querySelector('input[value="b.bin"]') as HTMLInputElement).click());
    click("rom-input-extract"); await flush();
    expect(mocks.resolveRomInput).toHaveBeenCalledWith(expect.any(String), "input", "b.bin");
    expect(document.querySelector('[data-testid="opened-catalog"]')?.textContent).toBe("/work/rom.bin");
    expect(document.body.textContent).toContain("member-hash"); expect(document.body.textContent).toContain("container-hash");
  });
  it("does not choose an arbitrary file from a multi-file drop", async () => {
    act(() => root.render(<RomDropDecompile />)); await flush();
    act(() => mocks.handler?.({ payload: { type: "drop", paths: ["/x/a.md", "/x/b.md"] } })); await flush();
    expect(mocks.probeRomInput).not.toHaveBeenCalled(); expect(document.body.textContent).toContain("/x/a.md"); expect(document.body.textContent).toContain("/x/b.md");
  });
  it("waits for cancellation acknowledgement and offers recovery", async () => {
    let reject: (e: Error) => void = () => {};
    mocks.probeRomInput.mockImplementation(() => new Promise((_, no) => { reject = no; }));
    act(() => root.render(<RomDropDecompile />)); await flush();
    act(() => mocks.handler?.({ payload: { type: "drop", paths: ["/x/a.zip"] } })); await flush();
    click("rom-input-cancel"); await flush(); expect(mocks.cancelRomInput).toHaveBeenCalled();
    await act(async () => reject(new Error("Preparação cancelada"))); await flush();
    expect(document.body.textContent).toContain("Preparação cancelada"); expect(document.querySelector('[data-testid="rom-input-choose"]')).not.toBeNull();
  });
  it("wizard event opens the same file selector", async () => {
    mocks.open.mockResolvedValue(null);
    act(() => root.render(<RomDropDecompile />)); await flush();
    act(() => window.dispatchEvent(new Event("rds:choose-rom"))); await flush();
    expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ filters: [{ name: "ROM Mega Drive ou compactado", extensions: ["md", "bin", "gen", "smd", "zip", "7z"] }] }));
    expect(mocks.probeRomInput).not.toHaveBeenCalled();
  });
});
