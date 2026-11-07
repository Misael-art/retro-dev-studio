import { describe, expect, it } from "vitest";

import { describeBuildFreshness } from "./buildFreshness";

describe("describeBuildFreshness", () => {
  const base = { sceneRevision: 5, lastBuildSceneRevision: 5, builtRomSha256: "a", runningRomSha256: "a" };
  it("confirms only when the running ROM is the build of the current revision", () => {
    expect(describeBuildFreshness(base).kind).toBe("confirmed");
    expect(describeBuildFreshness({ ...base, runningRomSha256: "old" }).kind).toBe("running-previous");
    expect(describeBuildFreshness({ ...base, sceneRevision: 6 }).kind).toBe("running-previous");
    expect(describeBuildFreshness({ ...base, sceneRevision: 6, runningRomSha256: null }).kind).toBe("rebuild-needed");
    expect(describeBuildFreshness({ ...base, runningRomSha256: null }).kind).toBe("built-not-running");
    expect(describeBuildFreshness({ ...base, lastBuildSceneRevision: null }).kind).toBe("no-build");
  });
  it("remembers execution after Stop without certifying a newer revision or another ROM", () => {
    const stopped = { ...base, runningRomSha256: null, testedBuild: { romSha256: "a", sceneRevision: 5 } };
    expect(describeBuildFreshness(stopped).kind).toBe("tested");
    expect(describeBuildFreshness({ ...stopped, sceneRevision: 6 }).kind).toBe("rebuild-needed");
    expect(describeBuildFreshness({ ...stopped, builtRomSha256: "b" }).kind).toBe("built-not-running");
    expect(describeBuildFreshness({ ...stopped, testedBuild: { romSha256: "a", sceneRevision: 4 } }).kind).toBe("built-not-running");
  });
  it("tracks C independently of captured scenes without certifying edited C or another ROM", () => {
    const native = { ...base, lastBuildSceneRevision: null, nativeCode: { revision: 3, builtRevision: 3 } };
    expect(describeBuildFreshness(native).kind).toBe("confirmed");
    expect(describeBuildFreshness({ ...native, sceneRevision: 100 }).kind).toBe("confirmed");
    expect(describeBuildFreshness({ ...native, nativeCode: { revision: 4, builtRevision: 3 } }).kind).toBe("rebuild-needed");
    expect(describeBuildFreshness({ ...native, runningRomSha256: "other" }).kind).toBe("running-previous");
    expect(describeBuildFreshness({ ...native, runningRomSha256: null, testedBuild: { romSha256: "a", sceneRevision: 1 } }).kind).toBe("tested");
  });
});
