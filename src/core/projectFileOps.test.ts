import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), persist: vi.fn(), reload: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./scenePersistence", () => ({ persistActiveScene: mocks.persist, reloadSceneFromDisk: mocks.reload }));

import { applyOverrideToModel, renameProjectAsset, revertLastFileOperation } from "./projectFileOps";
import { useEditorStore } from "./store/editorStore";

describe("projectFileOps", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.persist.mockReset().mockResolvedValue(true);
    mocks.reload.mockReset().mockResolvedValue(true);
    useEditorStore.setState({ activeProjectDir: "/p", activeScenePath: "scenes/main.json", lastFileBackup: null });
  });

  it("saves first, renames, reloads from disk and records the backup for Reverter", async () => {
    mocks.invoke.mockResolvedValue({ from: "a", to: "b", updated: [["scenes/main.json", 2]], backup: { id: "b1", reason: "renomear" } });
    const out = await renameProjectAsset("assets/a.png", "assets/b.png");
    expect(out.ok).toBe(true);
    expect(mocks.persist).toHaveBeenCalledBefore(mocks.invoke);
    expect(mocks.invoke).toHaveBeenCalledWith("project_rename_asset", { projectDir: "/p", from: "assets/a.png", to: "assets/b.png" });
    expect(mocks.reload).toHaveBeenCalled();
    expect(useEditorStore.getState().lastFileBackup).toEqual({ id: "b1", reason: "renomear" });
  });

  it("does nothing if the scene cannot be saved, and reports backend refusals without reloading", async () => {
    mocks.persist.mockResolvedValue(false);
    expect((await applyOverrideToModel("b", "sprite")).ok).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.persist.mockResolvedValue(true);
    mocks.invoke.mockRejectedValue("Ja existe");
    const out = await renameProjectAsset("assets/a.png", "assets/b.png");
    expect(out).toEqual({ ok: false, message: "Ja existe" });
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(useEditorStore.getState().lastFileBackup).toBeNull();
  });

  it("reverts via the backup and clears it", async () => {
    useEditorStore.setState({ lastFileBackup: { id: "b9", reason: "aplicar" } });
    mocks.invoke.mockResolvedValue({});
    expect((await revertLastFileOperation()).ok).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("project_restore_backup", { projectDir: "/p", backupId: "b9" });
    expect(useEditorStore.getState().lastFileBackup).toBeNull();
  });
});
