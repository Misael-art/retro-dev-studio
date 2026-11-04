import type { StoreState } from "./store/editorStore";

/** Um diagnóstico só pode usar recibos da sessão, revisão e ROM ainda ativas. */
export function currentProjectDiagnostics(state: StoreState) {
  const failure = state.lastBuildFailure;
  const buildFailure = failure && state.activeProjectDir
    && failure.projectDir === state.activeProjectDir
    && failure.projectSessionId === state.projectSessionId
    && failure.scenePath === state.activeScenePath
    && failure.sceneRevision === state.sceneRevision
    && failure.target === state.activeTarget ? failure : null;

  const scene = state.sceneDiskBaseline?.projectDir === state.activeProjectDir
    && state.sceneDiskBaseline.scenePath === state.activeScenePath ? state.activeScene : null;

  const hardware = scene && state.hwValidationState === "fresh"
    && state.hwValidatedRevision === state.sceneRevision ? state.hwStatus : null;

  const artifact = state.lastBuildArtifact;
  const link = state.lastRuntimeLink;
  const currentBuild = Boolean(state.activeProjectDir && artifact
    && artifact.projectDir === state.activeProjectDir
    && artifact.projectSessionId === state.projectSessionId
    && artifact.target === state.activeTarget
    && state.lastBuildSceneRevision === state.sceneRevision
    && (artifact.nativeCodeRevision !== null
      ? artifact.nativeCodeRevision === state.nativeCodeRevision
      : true));
  const currentLink = currentBuild && link && link.rom_sha256 === artifact?.sha256
    && link.target === state.activeTarget && state.lastBuildSceneRevision === state.sceneRevision;
  const runningBuild = currentBuild && artifact?.sha256 === state.emulatorRomIdentity?.sha256
    && state.emulatorLoaded && state.coreEpoch !== null && !state.joypadSessionHold;

  const observation = runningBuild && state.presentationObservation
    && state.presentationObservation.romSha256 === artifact?.sha256
    && state.presentationObservation.coreEpoch === state.coreEpoch
    ? state.presentationObservation : null;

  return {
    buildFailure,
    scene,
    hardware,
    artifact: currentBuild ? artifact : null,
    link: runningBuild && currentLink ? link : null,
    observation,
  };
}
