import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExplorerWorkspace from "./ExplorerWorkspace";
import { useEditorStore } from "../../core/store/editorStore";
import type { LegacySgdkIndex, Scene } from "../../core/ipc/sceneService";

const mocks = vi.hoisted(() => ({
  listScenes: vi.fn(),
  switchScene: vi.fn(),
  listProjectAssets: vi.fn(),
  readLegacyProjectFile: vi.fn(),
  listenToProjectAssetChanges: vi.fn(),
  hydrateSceneResult: vi.fn(),
  persistActiveScene: vi.fn(),
}));

vi.mock("../common/AssetPreview", () => ({
  default: ({ alt }: { alt: string }) => <div data-testid="asset-preview">{alt}</div>,
}));

vi.mock("../../core/ipc/sceneService", () => ({
  listScenes: mocks.listScenes,
  switchScene: mocks.switchScene,
}));

vi.mock("../../core/ipc/toolsService", () => ({
  listProjectAssets: mocks.listProjectAssets,
  readLegacyProjectFile: mocks.readLegacyProjectFile,
}));

vi.mock("../../core/ipc/projectWatcherService", () => ({
  listenToProjectAssetChanges: mocks.listenToProjectAssetChanges,
}));

vi.mock("../../core/scenePersistence", () => ({
  hydrateSceneResult: mocks.hydrateSceneResult,
  persistActiveScene: mocks.persistActiveScene,
}));

function flush() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.includes(label)
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

const LEGACY_INDEX: LegacySgdkIndex = {
  host_root: "F:/Projects/RetroDevStudio/tests/fixtures/projects/megadrive_dummy/legacy",
  source_files: ["src/main.c", "src/player.c"],
  header_files: ["inc/main.h"],
  manifest_files: ["res/game.res"],
  resource_files: ["assets/hero.png"],
  output_files: [],
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("ExplorerWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.clearAllMocks();

    mocks.listScenes.mockResolvedValue([
      {
        path: "scenes/main.json",
        scene_id: "main",
        display_name: "Main Scene",
      },
    ]);
    mocks.listProjectAssets.mockResolvedValue([
      {
        relative_path: "assets/sprites/hero.png",
        absolute_path:
          "F:/Projects/RetroDevStudio/tests/fixtures/projects/megadrive_dummy/assets/sprites/hero.png",
        kind: "image",
      },
    ]);
    mocks.listenToProjectAssetChanges.mockResolvedValue(() => {});
    mocks.readLegacyProjectFile.mockResolvedValue({
      relative_path: "src/main.c",
      absolute_path:
        "F:/Projects/RetroDevStudio/tests/fixtures/projects/megadrive_dummy/legacy/src/main.c",
      content: "int main(void) { return 0; }",
      previewable: true,
      readonly: true,
      note: "Arquivo legado somente leitura.",
    });
    mocks.hydrateSceneResult.mockResolvedValue({
      sourceScene: null,
      resolvedScene: null,
    });
    mocks.persistActiveScene.mockResolvedValue(true);

    useEditorStore.setState({
      activeProjectDir: "F:/Projects/RetroDevStudio/tests/fixtures/projects/megadrive_dummy",
      activeProjectName: "Legacy Host",
      activeTarget: "megadrive",
      activeScenePath: "scenes/main.json",
      activeScene: null,
      activeSceneSource: null,
      projectSourceKind: "external_sgdk",
      projectLegacyIndex: structuredClone(LEGACY_INDEX),
      selectedEntityId: null,
      consoleEntries: [],
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<ExplorerWorkspace />);
      await flush();
      await flush();
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    container.remove();
  });

  it("explains the legacy overlay contract before anything is selected", () => {
    expect(container.querySelector("[data-testid='legacy-host-summary']")?.textContent).toContain(
      "Overlay SGDK"
    );
    expect(container.querySelector("[data-testid='legacy-host-summary']")?.textContent).toContain(
      "Overlay rds/"
    );
    expect(container.querySelector("[data-testid='legacy-host-summary']")?.textContent).toContain(
      "Build & Run delega ao build C do host (Makefile ou wrapper SGDKForge)"
    );
    expect(container.querySelector("[data-testid='legacy-host-summary']")?.textContent).toContain(
      "5 arquivo(s) indexado(s)"
    );
    const editScope = container.querySelector("[data-testid='legacy-host-edit-scope']")?.textContent;
    expect(editScope).toContain("Consumido pelo build C:");
    expect(editScope).toContain("Só organização no Studio:");
    expect(editScope).toContain("Requer integração adicional:");
    expect(editScope).toContain("rds/code/");
    expect(container.querySelector("[data-testid='legacy-host-summary']")?.textContent).toContain(
      LEGACY_INDEX.host_root
    );
    expect(container.querySelector("[data-testid='explorer-empty-state-copy']")?.textContent).toContain(
      "overlay"
    );
    expect(container.querySelector("[data-testid='explorer-empty-state-copy']")?.textContent).toContain(
      "somente leitura"
    );
  });

  it("labels scene and asset selections as overlay content in legacy SGDK projects", async () => {
    await act(async () => {
      findButton(container, "Main Scene").click();
      await flush();
    });

    expect(container.querySelector("[data-testid='explorer-selection-source']")?.textContent).toContain(
      "Origem: overlay rds/scenes"
    );

    await act(async () => {
      findButton(container, "hero.png").click();
      await flush();
    });

    expect(container.querySelector("[data-testid='explorer-selection-source']")?.textContent).toContain(
      "Origem: assets canônicos do overlay"
    );
  });

  it("requires a choice for shared art and restores the file selection after returning", async () => {
    const scene: Scene = {
      scene_id: "main", background_layers: [], collision_map: null,
      entities: ["player", "enemy"].map((id) => ({
        entity_id: id, transform: { x: 0, y: 0 },
        components: { sprite: { asset: "assets/sprites/hero.png", frame_width: 16, frame_height: 16 }, logic: { graph_ref: `${id}.json` } },
      })),
    };
    await act(async () => {
      useEditorStore.setState({ activeScene: scene, activeSceneSource: scene, activeWorkspace: "explorer" });
      findButton(container, "hero.png").click();
      await flush();
    });
    expect(container.querySelector("[data-testid='explorer-edit-asset']")?.hasAttribute("disabled")).toBe(true);
    await act(async () => { findButton(container, "Ver usos (2)").click(); await flush(); });
    expect(container.querySelector("[data-testid='explorer-asset-uses']")?.textContent).toContain("player");
    expect(container.querySelector("[data-testid='explorer-asset-uses']")?.textContent).toContain("enemy");
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>("[data-testid='explorer-asset-use']")!;
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
      container.querySelector<HTMLButtonElement>("[data-testid='explorer-edit-asset']")!.click();
      await flush();
    });
    expect(useEditorStore.getState().activeWorkspace).toBe("artstudio");
    expect(useEditorStore.getState().selectedEntityId).toBe("enemy");
    expect(useEditorStore.getState().artStudioAssetPath).toBe("assets/sprites/hero.png");
    await act(async () => {
      useEditorStore.getState().returnToStudioOrigin();
      root.unmount();
      root = createRoot(container);
      root.render(<ExplorerWorkspace />);
      await flush();
      await flush();
    });
    expect(useEditorStore.getState().activeWorkspace).toBe("explorer");
    expect(container.querySelector("[data-testid='explorer-selection-source']")?.textContent).toContain("assets canônicos");
  });

  it("opens an unused image as a file while keeping the previous scene selection for return", async () => {
    const scene: Scene = {
      scene_id: "main", background_layers: [], collision_map: null,
      entities: [{ entity_id: "player", transform: { x: 0, y: 0 }, components: {} }],
    };
    await act(async () => {
      useEditorStore.setState({ activeScene: scene, activeSceneSource: scene, selectedEntityId: "player", activeWorkspace: "explorer" });
      findButton(container, "hero.png").click();
      await flush();
      container.querySelector<HTMLButtonElement>("[data-testid='explorer-edit-asset']")!.click();
      await flush();
    });
    expect(useEditorStore.getState().activeWorkspace).toBe("artstudio");
    expect(useEditorStore.getState().selectedEntityId).toBeNull();
    expect(useEditorStore.getState().artStudioAssetPath).toBe("assets/sprites/hero.png");
    await act(async () => { useEditorStore.getState().returnToStudioOrigin(); await flush(); });
    expect(useEditorStore.getState().selectedEntityId).toBe("player");
  });
});
