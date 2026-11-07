import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RuntimeInspectOverlay from "./RuntimeInspectOverlay";
import type { Scene } from "../../core/ipc/sceneService";
import { RUNTIME_LINK_SCHEMA, type RuntimeLink } from "../../core/runtimeLink";
import { useEditorStore } from "../../core/store/editorStore";
import { initialStudioContext } from "../../core/studioContext";

const ram = vi.hoisted(() => new Map<number, number>());
vi.mock("../../core/ipc/emulatorService", () => ({
  emulatorReadMemory: vi.fn(async (_region: number, offset: number) => {
    const value = ram.get(offset) ?? 0;
    return { ok: true, data: [value & 0xff, (value >> 8) & 0xff], total_size: 65536 };
  }),
}));

const locate = vi.hoisted(() => vi.fn());
const assetBytes = vi.hoisted(() => vi.fn());
vi.mock("../../core/ipc/toolsService", () => ({ rexProfileLocate: locate, readProjectAssetBytes: assetBytes }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const link: RuntimeLink = {
  schema: RUNTIME_LINK_SCHEMA,
  target: "megadrive",
  rom_sha256: "rom-a",
  generated_source_sha256: "src",
  limitations: [],
  tilemaps: [{ entity_id: "ground", x: 0, y: 160, width_px: 320, height_px: 64 }],
  entities: [
    {
      entity_id: "ken",
      origin: "mugen",
      var_name: "spr_ken",
      frame_width: 96,
      frame_height: 112,
      pivot: { x: 48, y: 104 },
      symbols: { x: 0xff0010, y: 0xff0012, anim: 0xff0014, frame: 0xff0016 },
      animations: ["action_0", "action_200"],
      occurrences: { action_0: ["o1"], action_200: ["o1", "o2", "o3"] },
      frame_offsets: { action_0: [[0, 0]], action_200: [[0, 0], [0, 0], [0, 0]] },
      asset: "a.png",
      // sha256 do conteúdo vazio: o mock de leitura devolve [] = conteúdo do build.
      asset_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      occurrence_images: { action_0: [[0, -1, -1]], action_200: [[1, -1, -1], [2, -1, -1], [1, -1, -1]] },
    },
  ],
};

const scene = {
  scene_id: "main",
  background_layers: [],
  entities: [
    {
      entity_id: "ken",
      transform: { x: 0, y: 0 },
      components: {
        sprite: {
          asset: "a.png",
          frame_width: 96,
          frame_height: 112,
          animations: {
            action_0: { frames: [0], fps: 1, loop: true, occurrence_ids: ["o1"] },
            action_200: { frames: [1, 2, 1], fps: 1, loop: true, occurrence_ids: ["o1", "o2", "o3"] },
          },
        },
      },
    },
    { entity_id: "ground", transform: { x: 0, y: 160 }, components: {} },
  ],
} as unknown as Scene;

let root: Root;
let host: HTMLDivElement;
let canvas: HTMLCanvasElement;

function fakeCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 224;
  Object.defineProperty(c, "clientWidth", { value: 640 });
  Object.defineProperty(c, "clientHeight", { value: 448 });
  Object.defineProperty(c, "clientLeft", { value: 0 });
  Object.defineProperty(c, "clientTop", { value: 0 });
  c.getBoundingClientRect = () => ({ left: 0, top: 0, right: 640, bottom: 448, width: 640, height: 448, x: 0, y: 0, toJSON: () => ({}) });
  return c;
}

async function render(frames = 900) {
  await act(async () => {
    root.render(<RuntimeInspectOverlay canvas={canvas} renderedFrames={frames} paused />);
  });
}

function q(id: string) {
  return host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
}

async function clickAt(x: number, y: number) {
  await act(async () => {
    q("inspect-overlay")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
  });
}

describe("RuntimeInspectOverlay", () => {
  beforeEach(async () => {
    ram.clear();
    ram.set(0x0010, 40); // x
    ram.set(0x0012, 60); // y
    ram.set(0x0014, 1); // action_200
    ram.set(0x0016, 2); // o3
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    canvas = fakeCanvas();
    useEditorStore.setState({
      studio: initialStudioContext(),
      activeWorkspace: "game",
      lastRuntimeLink: link,
      emulatorRomIdentity: { path: "r", size: 1, sha256: "rom-a", coreLabel: "gpgx", corePath: "c", sourceLabel: "s" },
      coreEpoch: 7,
      emulPaused: true,
    });
    useEditorStore.getState().setActiveScene(scene);
    await render();
    await act(async () => q("inspect-toggle")!.click());
    await vi.waitFor(() => expect(q("inspect-overlay")?.dataset.candidates).toBe("2"));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("draws linked character and scene boxes with labels", () => {
    const ken = q("inspect-box-ken")!;
    expect(ken.dataset.kind).toBe("character");
    expect(ken.style.left).toBe("80px");
    expect(ken.textContent).toContain("SPRITE");
    expect(q("inspect-box-ground")!.textContent).toContain("BG");
  });

  it("click on the character opens Personagem at the sampled animation and occurrence, with return", async () => {
    await clickAt(2 * 60, 2 * 80);
    await vi.waitFor(() => expect(useEditorStore.getState().activeWorkspace).toBe("artstudio"));
    const s = useEditorStore.getState();
    expect(s.activeWorkspace).toBe("artstudio");
    expect(s.studio.focus).toMatchObject({ task: "character", entityId: "ken", animation: "action_200", occurrenceId: "o3" });
    expect(s.studio.returnStack[s.studio.returnStack.length - 1]?.workspace).toBe("game");
  });

  it("asset moved with identical content still navigates; different content is refused", async () => {
    // sha256("") = e3b0…; o vínculo de teste usa o hash do conteúdo vazio para o arquivo movido.
    const empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    useEditorStore.setState({ lastRuntimeLink: { ...link, entities: link.entities.map((e) => ({ ...e, asset_sha256: empty })) } });
    act(() => useEditorStore.getState().updateEntity("ken", { components: { sprite: { ...scene.entities[0].components.sprite!, asset: "moved/a.png" } } }));
    await render();
    assetBytes.mockResolvedValue([]);
    await clickAt(2 * 60, 2 * 80);
    await vi.waitFor(() => expect(useEditorStore.getState().activeWorkspace).toBe("artstudio"));
    expect(assetBytes).toHaveBeenCalledWith(expect.anything(), "moved/a.png");
  });

  it("same path and ids with edited content is refused; restored content is accepted; read only on click", async () => {
    await render();
    assetBytes.mockClear();
    await render(900);
    expect(assetBytes).not.toHaveBeenCalled();
    assetBytes.mockResolvedValue([1, 2, 3]);
    await clickAt(2 * 60, 2 * 80);
    await vi.waitFor(() => expect(q("inspect-message")?.textContent).toContain("mudou desde o build"));
    expect(assetBytes).toHaveBeenCalledWith(expect.anything(), "a.png");
    expect(useEditorStore.getState().activeWorkspace).toBe("game");
    assetBytes.mockResolvedValue([]);
    // The non-interactive alert belongs to the inspection surface. A native
    // click on its text bubbles with the same canvas coordinates after Undo.
    await act(async () => q("inspect-message")!.dispatchEvent(new MouseEvent("click", {
      bubbles: true, clientX: 2 * 60, clientY: 2 * 80,
    })));
    await vi.waitFor(() => expect(useEditorStore.getState().activeWorkspace).toBe("artstudio"));
    expect(useEditorStore.getState().studio.focus).toMatchObject({ entityId: "ken", animation: "action_200", occurrenceId: "o3" });
  });

  it("same ids but other sprite content is refused with a recompile message", async () => {
    act(() => useEditorStore.getState().updateEntity("ken", { components: { sprite: { ...scene.entities[0].components.sprite!, asset: "ryu.png" } } }));
    await render();
    assetBytes.mockResolvedValue([1, 2, 3]);
    await clickAt(2 * 60, 2 * 80);
    await vi.waitFor(() => expect(q("inspect-message")?.textContent).toContain("mudou desde o build"));
    expect(useEditorStore.getState().activeWorkspace).toBe("game");
  });

  it("overlapping elements ask which one to open", async () => {
    await clickAt(2 * 60, 2 * 165);
    expect(q("inspect-choices")).not.toBeNull();
    await act(async () => q("inspect-choice-ground")!.click());
    expect(useEditorStore.getState().studio.focus).toMatchObject({ task: "scene", entityId: "ground" });
  });

  it("refuses navigation when the frame advanced or the ROM is another build", async () => {
    await render(901);
    // A amostra é refeita para o novo quadro; simular corrida: ROM trocou antes do clique.
    useEditorStore.setState({ emulatorRomIdentity: { path: "r", size: 1, sha256: "rom-b", coreLabel: "g", corePath: "c", sourceLabel: "s" } });
    await render(901);
    expect(q("inspect-overlay")!.dataset.candidates).toBe("0");
    expect(q("inspect-status")!.textContent).toContain("Executando build anterior");
    await clickAt(2 * 60, 2 * 80);
    expect(useEditorStore.getState().activeWorkspace).toBe("game");
  });
});

describe("RuntimeInspectOverlay on a ROM without project link (commercial/unknown)", () => {
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    canvas = fakeCanvas();
    locate.mockReset();
    useEditorStore.setState({
      studio: initialStudioContext(),
      activeWorkspace: "game",
      lastRuntimeLink: null,
      rexBridgeRequest: null,
      emulatorRomIdentity: { path: "/byor/sonic.bin", size: 1, sha256: "sonic", coreLabel: "gpgx", corePath: "c", sourceLabel: "s" },
      coreEpoch: 9,
      emulPaused: true,
    });
    await render();
    await act(async () => q("inspect-toggle")!.click());
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("clicking the frame is explicitly unknown and opens no editor", async () => {
    await clickAt(100, 100);
    expect(q("inspect-message")!.textContent).toContain("Desconhecido");
    expect(useEditorStore.getState().activeWorkspace).toBe("game");
  });

  it("opens the REX profile editor only for an instance located in this ROM", async () => {
    locate.mockResolvedValue({
      rom_sha256: "sonic",
      matches: [{ profile: { id: "copy_grid", sha256: "p", title: "Cópia em grade", status: "demonstrado" }, instances: [{ instance_offset: 16, selection: { label: "assinatura" } }], bound: true }],
    });
    await act(async () => q("inspect-rex-locate")!.click());
    await vi.waitFor(() => expect(q("inspect-rex-items")).not.toBeNull());
    await act(async () => q("inspect-rex-open-0")!.click());
    expect(useEditorStore.getState().rexBridgeRequest).toMatchObject({ romPath: "/byor/sonic.bin", romSha256: "sonic", key: "copy_grid@0x10" });
  });

  it("a ROM no profile recognizes stays fully unknown", async () => {
    locate.mockResolvedValue({ rom_sha256: "sonic", matches: [] });
    await act(async () => q("inspect-rex-locate")!.click());
    await vi.waitFor(() => expect(q("inspect-rex-none")!.textContent).toContain("desconhecido"));
  });
});
