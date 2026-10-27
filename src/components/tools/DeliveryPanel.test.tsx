import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeliveryPanel from "./DeliveryPanel";
import type { Scene } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";
import { initialStudioContext } from "../../core/studioContext";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), mastering: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("../../core/ipc/projectCapabilityService", () => ({ inspectRomMastering: mocks.mastering }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function scene(hudColumn: number): Scene {
  return {
    scene_id: "main",
    background_layers: [],
    entities: [
      {
        entity_id: "dummy",
        transform: { x: 0, y: 0 },
        components: { logic: { graph: JSON.stringify({ nodes: [{ id: "strike1", type: "authored_strike" }] }) } },
      },
      {
        entity_id: "vida",
        display_name: "Vida",
        transform: { x: 0, y: 0 },
        components: { hud: { column: hudColumn, row: 25, label: "VIDA ", value: { kind: "strike_hp", source: "strike1" }, digits: 3 } },
      },
    ],
  } as unknown as Scene;
}

let root: Root;
let host: HTMLDivElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function render(onClose = vi.fn()) {
  await act(async () => root.render(<DeliveryPanel onClose={onClose} />));
  return onClose;
}

describe("DeliveryPanel", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue([]);
    mocks.mastering.mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    useEditorStore.setState({ studio: initialStudioContext(), activeWorkspace: "debug", activeProjectDir: "/p" });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    if (vi.isFakeTimers()) {
      vi.runAllTimers();
      vi.useRealTimers();
    }
  });

  function built(s: Scene) {
    useEditorStore.getState().setActiveScene(s);
    const revision = useEditorStore.getState().sceneRevision;
    useEditorStore.setState({
      lastBuildSceneRevision: revision,
      lastBuildSourceMap: { artifact: { path: "/p/out/rom.bin", sha256: "abc" } } as never,
      emulatorRomIdentity: null,
    });
  }

  it("a blocking HUD error opens the exact property and blocks export", async () => {
    vi.useFakeTimers();
    built(scene(36));
    const onClose = await render();
    expect(q("delivery-errors")!.dataset.count).toBe("1");
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(true);
    expect(q("delivery-export")!.textContent).toContain("Resolva 1 erro");
    await act(async () => q("delivery-open-0")!.click());
    expect(onClose).toHaveBeenCalled();
    expect(useEditorStore.getState().studio.focus).toMatchObject({ task: "interface", entityId: "vida" });
    expect(useEditorStore.getState().activeWorkspace).toBe("scene");
    // The inspector mounts after navigation. Exercise the retry and complete
    // the focus request before the test environment is torn down.
    await act(async () => vi.advanceTimersByTime(0));
    const field = document.createElement("input");
    field.dataset.testid = "inspector-hud-column";
    host.appendChild(field);
    await act(async () => vi.advanceTimersByTime(50));
    expect(document.activeElement).toBe(field);
    await act(async () => vi.runAllTimers());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a safe-area warning does not block a valid export; export requires ROM verification and current build", async () => {
    built(scene(0));
    mocks.mastering.mockResolvedValue({ sha256: "abc", checksum: { status: "ok" }, blockers: [] });
    mocks.invoke.mockImplementation(async (command) => command === "export_game_rom" ? { path: "/p/export/p-abc.bin", sha256: "abc", report: {} } : []);
    await render();
    expect(q("delivery-warnings")!.dataset.count).toBe("1");
    expect(q("delivery-export")!.textContent).toContain("Verifique a ROM");
    await act(async () => q("delivery-verify-rom")!.click());
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(false);
    await act(async () => q("delivery-export")!.click());
    expect(mocks.invoke).toHaveBeenCalledWith("export_game_rom", { projectDir: "/p", romPath: "/p/out/rom.bin", expectedSha256: "abc" });
    expect(q("delivery-exported")!.textContent).toContain("/p/export/p-abc.bin");
  });

  it("an edit after the build requires recompiling before export", async () => {
    built(scene(2));
    useEditorStore.getState().updateEntity("vida", { transform: { x: 1, y: 0 } });
    await render();
    expect(q("delivery-freshness")!.dataset.kind).toBe("rebuild-needed");
    expect(q("delivery-export")!.textContent).toContain("Compile o projeto atual");
  });

  it("invalidates verification when the build changes while the review stays open", async () => {
    built(scene(2));
    mocks.mastering.mockResolvedValue({ sha256: "abc", checksum: { status: "ok" }, blockers: [] });
    await render();
    await act(async () => q("delivery-verify-rom")!.click());
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(false);
    await act(async () => useEditorStore.setState({ lastBuildSourceMap: { artifact: { path: "/p/out/rom.bin", sha256: "def" } } as never }));
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(true);
    expect(q("delivery-mastering")).toBeNull();
    expect(q("delivery-rom-sha")!.textContent).toContain("def");
  });

  it("discards a verification response from a previous project", async () => {
    built(scene(2));
    let complete!: (result: unknown) => void;
    mocks.mastering.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    await render();
    await act(async () => q("delivery-verify-rom")!.click());
    await act(async () => useEditorStore.getState().setActiveProject("/other", "Other"));
    await act(async () => complete({ sha256: "abc", checksum: { status: "ok" }, blockers: [] }));
    expect(q("delivery-mastering")).toBeNull();
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(true);
  });

  it("refuses a ROM changed at the same path since the build", async () => {
    built(scene(2));
    mocks.mastering.mockResolvedValue({ sha256: "changed", checksum: { status: "ok" }, blockers: [] });
    await render();
    await act(async () => q("delivery-verify-rom")!.click());
    expect(q("delivery-error")!.textContent).toContain("mudou desde o build");
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(true);
  });

  it("reports an audit failure and allows retry without claiming missing files were checked", async () => {
    built(scene(2));
    mocks.invoke.mockRejectedValueOnce(new Error("disco indisponível"));
    await render();
    expect(q("delivery-audit-status")!.textContent).toContain("Falha");
    expect(q("delivery-export")!.hasAttribute("disabled")).toBe(true);
    await act(async () => q("delivery-recheck")!.click());
    expect(q("delivery-audit-status")!.textContent).toContain("verificados");
  });
});
