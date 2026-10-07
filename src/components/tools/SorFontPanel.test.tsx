import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InspectionEdit, InspectionSession, SorFontInfo } from "../../core/ipc/toolsService";

const infoMock = vi.fn();
const editMock = vi.fn();
vi.mock("../../core/ipc/toolsService", () => ({
  inspectionSorFontInfo: (...a: unknown[]) => infoMock(...a),
  inspectionEditSorFont: (...a: unknown[]) => editMock(...a),
  patchCreateBps: vi.fn(),
  patchApplyBps: vi.fn(),
}));
vi.mock("../../core/ipc/emulatorService", () => ({
  emulatorLoadRom: vi.fn(), emulatorRunFrames: vi.fn(), emulatorObserve: vi.fn(),
}));
vi.mock("./ToolPathField", () => ({ default: () => null }));

import SorFontPanel from "./SorFontPanel";

const plain = new Uint8Array(1568);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const supported: SorFontInfo = {
  profile_id: "streets_of_rage_world_ptbr/font_kosinski/v1", resource_id: "sor1_font", supported: true, diagnostic: "",
  rom_sha256: "304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d", stream_offset: 0x389a0, slot_len: 514, plain_len: 1568, tiles: 49,
  consumers: [{ offset: 0x87fc, note: "lea" }, { offset: 0x119b4, note: "lea" }, { offset: 0xb768, note: "tabela" }],
  glyphs: [{ tile: 1, label: "A", basis: "observed" }, { tile: 2, label: "B", basis: "inferred" }],
  original_plain_b64: b64(plain), current_plain_b64: b64(plain), current_stream_len: 463, tiles_changed: [], copy_active: false,
  scope_note: "escopo", proof: ["prova 1"], limits: ["paleta não lida"],
};
const session = { session_id: "s1", rom_path: "/r.gen", edit: null } as unknown as InspectionSession;
const edit = (over: Partial<InspectionEdit> = {}) => ({ modified_rom_sha256: "abc", modified_rom_path: "/c.bin", stream_len: 467, slot_len: 514, guards_verified: 4, noop: false, ...over }) as InspectionEdit;

let root: Root; let el: HTMLDivElement;
const onEdited = vi.fn(); const log = vi.fn();
async function mount() { await act(async () => root.render(<SorFontPanel session={session} onEdited={onEdited} logMessage={log} />)); }
const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
async function click(id: string) { await act(async () => q(id)!.click()); }

beforeEach(() => {
  infoMock.mockReset().mockResolvedValue(supported); editMock.mockReset(); onEdited.mockReset(); log.mockReset();
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ fillRect: vi.fn(), createImageData: vi.fn(), putImageData: vi.fn(), set fillStyle(_: string) {} })) as never;
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); });

it("ROM sem perfil mostra diagnóstico preciso e nenhum editor", async () => {
  infoMock.mockResolvedValue({ ...supported, supported: false, diagnostic: "SHA-256 deadbeef não é a imagem do perfil" });
  await mount();
  expect(q("sor-font-diagnostic")?.textContent).toContain("deadbeef");
  expect(q("sor-apply")).toBeNull();
});

it("pinta na fila, aplica pelo IPC, mostra stream/slot e notifica a sessão", async () => {
  await mount();
  expect(q("sor-font-panel")?.textContent).toContain("Experimental");
  expect(q("sor-font-preview-original")).not.toBeNull();
  await click("sor-index-7"); await click("sor-pixel-3-4");
  expect(q("sor-queue")?.textContent).toContain("1 pixel(s)");
  editMock.mockResolvedValue(edit());
  await click("sor-apply");
  expect(editMock).toHaveBeenCalledWith("s1", [{ tile: 1, row: 3, col: 4, index: 7 }]);
  expect(onEdited).toHaveBeenCalledTimes(1);
  expect(q("sor-status")?.textContent).toContain("467/514");
  expect(q("sor-queue")?.textContent).toContain("0 pixel(s)");
});

it("no-op explícito não notifica nem finge alteração", async () => {
  await mount();
  await click("sor-pixel-0-0");
  editMock.mockResolvedValue(edit({ noop: true }));
  await click("sor-apply");
  expect(onEdited).not.toHaveBeenCalled();
  expect(q("sor-status")?.textContent).toContain("No-op");
});

it("recusa por falta de espaço preserva a fila e explica", async () => {
  await mount();
  await click("sor-pixel-1-1");
  editMock.mockRejectedValue({ message: "needs_space: 530 bytes, slot 514" });
  await click("sor-apply");
  expect(q("sor-status")?.textContent).toContain("needs_space");
  expect(q("sor-status")?.textContent).toContain("fila foi preservada");
  expect(q("sor-queue")?.textContent).toContain("1 pixel(s)");
  expect(onEdited).not.toHaveBeenCalled();
});

it("mostra compartilhamento conhecido e letras inferidas como tracejadas", async () => {
  await mount();
  expect(q("sor-shared")?.textContent).toContain("3 pontos do código");
  expect(q("sor-glyph-B")?.className).toContain("border-dashed");
  expect(q("sor-glyph-A")?.className).not.toContain("border-dashed");
});
