// Estado verificável da última mudança (Experimental, REQ-21). Mudar o conteúdo não implica que a ROM
// em execução já mudou: o rótulo só diz "Confirmado na ROM atual" quando o build da revisão atual
// é exatamente a ROM carregada no core.
export type BuildFreshness =
  | { kind: "no-build"; label: string }
  | { kind: "rebuild-needed"; label: string }
  | { kind: "running-previous"; label: string }
  | { kind: "built-not-running"; label: string }
  | { kind: "tested"; label: string }
  | { kind: "confirmed"; label: string };

export function describeBuildFreshness(input: {
  sceneRevision: number;
  lastBuildSceneRevision: number | null;
  builtRomSha256: string | null;
  runningRomSha256: string | null;
  testedBuild?: { romSha256: string; sceneRevision: number } | null;
}): BuildFreshness {
  const { sceneRevision, lastBuildSceneRevision, builtRomSha256, runningRomSha256 } = input;
  if (lastBuildSceneRevision === null || !builtRomSha256) {
    return { kind: "no-build", label: "Prévia atualizada · ainda sem build nesta sessão" };
  }
  if (sceneRevision !== lastBuildSceneRevision) {
    return runningRomSha256
      ? { kind: "running-previous", label: "Recompilação necessária · executando build anterior" }
      : { kind: "rebuild-needed", label: "Prévia atualizada · recompilação necessária" };
  }
  if (!runningRomSha256) {
    if (input.testedBuild?.romSha256 === builtRomSha256 && input.testedBuild.sceneRevision === lastBuildSceneRevision) {
      return { kind: "tested", label: "Build atual testado · execução encerrada" };
    }
    return { kind: "built-not-running", label: "Build atual pronto · ainda não executado" };
  }
  if (runningRomSha256 !== builtRomSha256) {
    return { kind: "running-previous", label: "Executando build anterior" };
  }
  return { kind: "confirmed", label: "Confirmado na ROM atual" };
}
