import { describe, expect, it } from "vitest";
import { currentProjectDiagnostics } from "./projectDiagnostics";
import { useEditorStore } from "./store/editorStore";
import type { RuntimeLink } from "./runtimeLink";

const link: RuntimeLink = {
  schema: "retrodev.runtime_link/v1", target: "megadrive", rom_sha256: "rom-a",
  generated_source_sha256: "source-a", entities: [], tilemaps: [], limitations: [],
};

function currentState() {
  return {
    ...useEditorStore.getState(),
    activeProjectDir: "/project-a", projectSessionId: 5, activeScenePath: "scene-a",
    sceneDiskBaseline: { projectDir: "/project-a", scenePath: "scene-a", sourceSceneJson: "{}" },
    activeScene: { scene_id: "scene-a", entities: [], background_layers: [], collision_map: {
      tile_width: 8, tile_height: 8, width: 1, height: 1, data: [1],
    } },
    activeTarget: "megadrive" as const, sceneRevision: 8,
    lastBuildFailure: {
      projectDir: "/project-a", projectSessionId: 5, scenePath: "scene-a",
      target: "megadrive" as const, sceneRevision: 8, recordedAt: 100,
      messages: ["erro atual"], diagnostics: [],
    },
    hwValidationState: "fresh" as const, hwValidatedRevision: 8,
    hwStatus: { ...useEditorStore.getState().hwStatus!, errors: [], warnings: [] },
    lastBuildArtifact: { path: "/project-a/rom.md", sha256: "rom-a", nativeCodeRevision: null,
      projectDir: "/project-a", projectSessionId: 5, target: "megadrive" as const },
    lastBuildSceneRevision: 8, lastRuntimeLink: link,
    emulatorLoaded: true, joypadSessionHold: false, coreEpoch: 9, emulPaused: true,
    emulatorRomIdentity: {
      path: "/project-a/rom.md", sha256: "rom-a", size: 100, coreLabel: "Genesis Plus GX",
      corePath: "/core.so", sourceLabel: "Build & Run",
    },
    presentationObservation: { romSha256: "rom-a", coreEpoch: 9, frames: 60, durationMs: 1000, measuredAt: 200 },
  };
}

describe("project diagnostics identity", () => {
  it("accepts only the active revision and core for project answers", () => {
    const current = currentProjectDiagnostics(currentState());
    expect(current.buildFailure?.messages).toEqual(["erro atual"]);
    expect(current.link).toBe(link);
    expect(current.observation?.frames).toBe(60);
    expect(current.hardware).not.toBeNull();
    expect(current.scene?.collision_map?.data).toEqual([1]);

    const changedProject = currentProjectDiagnostics({ ...currentState(), activeProjectDir: "/project-b" });
    expect(changedProject.buildFailure).toBeNull();
    expect(changedProject.link).toBeNull();
    expect(changedProject.observation).toBeNull();
    expect(changedProject.scene).toBeNull();
    expect(changedProject.hardware).toBeNull();

    expect(currentProjectDiagnostics({ ...currentState(), activeScenePath: "scene-b" }).hardware).toBeNull();

    const changedRevision = currentProjectDiagnostics({ ...currentState(), sceneRevision: 9 });
    expect(changedRevision.buildFailure).toBeNull();
    expect(changedRevision.hardware).toBeNull();
    expect(changedRevision.link).toBeNull();
    expect(changedRevision.artifact).toBeNull();
    expect(currentProjectDiagnostics({
      ...currentState(), sceneRevision: 9,
      lastBuildArtifact: { ...currentState().lastBuildArtifact, nativeCodeRevision: 0 },
    }).artifact).toBeNull();

    expect(currentProjectDiagnostics({ ...currentState(), coreEpoch: 10 }).observation).toBeNull();
    expect(currentProjectDiagnostics({ ...currentState(), emulatorRomIdentity: {
      ...currentState().emulatorRomIdentity, sha256: "other-rom",
    } }).link).toBeNull();
    expect(currentProjectDiagnostics({ ...currentState(), lastRuntimeLink: { ...link, target: "snes" } }).link).toBeNull();
  });

  it("rejects old failure after reopening the same project path", () => {
    expect(currentProjectDiagnostics({ ...currentState(), projectSessionId: 6 }).buildFailure).toBeNull();
  });
});
