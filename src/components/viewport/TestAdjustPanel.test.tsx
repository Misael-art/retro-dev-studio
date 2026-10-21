import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TestAdjustPanel from "./TestAdjustPanel";
import type { Scene } from "../../core/ipc/sceneService";
import { RUNTIME_LINK_SCHEMA } from "../../core/runtimeLink";
import { useEditorStore } from "../../core/store/editorStore";

const ram = vi.hoisted(() => new Map<number, number>());
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../core/ipc/emulatorService", () => ({
  emulatorReadMemory: vi.fn(async (_r: number, offset: number) => {
    const v = ram.get(offset) ?? 0;
    return { ok: true, data: [v & 0xff, (v >> 8) & 0xff], total_size: 65536 };
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const scene = {
  scene_id: "main",
  background_layers: [],
  entities: [{ entity_id: "ken", transform: { x: 96, y: 160 }, components: {} }],
} as unknown as Scene;

let root: Root;
let host: HTMLDivElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe("TestAdjustPanel", () => {
  beforeEach(async () => {
    ram.clear();
    ram.set(0x0010, 96);
    ram.set(0x0012, 160);
    invoke.mockReset();
    invoke.mockImplementation(async (_cmd: string, args: { offset: number; data: number[] }) => {
      ram.set(args.offset, args.data[0] | (args.data[1] << 8));
      return { ok: true, data: args.data, total_size: 65536 };
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    useEditorStore.setState({
      lastRuntimeLink: {
        schema: RUNTIME_LINK_SCHEMA, target: "megadrive", rom_sha256: "r", generated_source_sha256: "s", tilemaps: [], limitations: [],
        entities: [{ entity_id: "ken", origin: "mugen", var_name: "spr_ken", frame_width: 8, frame_height: 8, pivot: null,
          symbols: { x: 0xff0010, y: 0xff0012, anim: null, frame: null }, animations: [], occurrences: {}, frame_offsets: {} }],
      },
      emulatorRomIdentity: { path: "p", size: 1, sha256: "r", coreLabel: "c", corePath: "c", sourceLabel: "s" },
      coreEpoch: 4,
      testAdjustments: [],
      undoStack: [],
    });
    useEditorStore.getState().setActiveScene(scene);
    useEditorStore.setState({ undoStack: [] });
    await act(async () => root.render(<TestAdjustPanel paused renderedFrames={100} />));
    await vi.waitFor(() => expect((q("test-adjust-ken-x") as HTMLInputElement).value).toBe("96"));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  async function type(id: string, value: string) {
    const input = q(id) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.focus();
      input.blur();
    });
  }

  it("writes only the running session and keeps the project untouched until applied", async () => {
    await type("test-adjust-ken-x", "140");
    expect(invoke).toHaveBeenCalledWith("emulator_write_test_memory", { offset: 0x0010, data: [140, 0], sessionEpoch: 4 });
    expect(ram.get(0x0010)).toBe(140);
    expect(q("test-adjust-banner")!.textContent).toContain("temporárias");
    expect(useEditorStore.getState().activeScene!.entities[0].transform.x).toBe(96);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("applies the selected diff as one undoable transaction", async () => {
    await type("test-adjust-ken-x", "140");
    await type("test-adjust-ken-y", "150");
    await act(async () => q("test-adjust-review")!.click());
    expect(q("test-adjust-diff")!.textContent).toContain("96 → 140");
    await act(async () => q("test-adjust-apply")!.click());
    let s = useEditorStore.getState();
    expect(s.activeScene!.entities[0].transform).toEqual({ x: 140, y: 150 });
    expect(s.undoStack).toHaveLength(1);
    expect(s.testAdjustments).toHaveLength(0);
    s.undo();
    s = useEditorStore.getState();
    expect(s.activeScene!.entities[0].transform).toEqual({ x: 96, y: 160 });
  });

  it("refuses rows whose project value changed after the adjustment, and a new load clears the list", async () => {
    await type("test-adjust-ken-x", "140");
    act(() => useEditorStore.getState().updateEntity("ken", { transform: { x: 10, y: 160 } }));
    await act(async () => q("test-adjust-review")!.click());
    expect(q("test-adjust-diff")!.textContent).toContain("não aplicável");
    expect(q("test-adjust-apply")!.hasAttribute("disabled")).toBe(true);
    act(() => useEditorStore.getState().setEmulatorLoaded(true));
    expect(useEditorStore.getState().testAdjustments).toEqual([]);
  });
});
