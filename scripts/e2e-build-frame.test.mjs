import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
import { locatePoseFoot, matchPoseCadence } from "./qa/pose-cadence.mjs";

describe("cadence from cropped core frames", () => {
  const poses = ["a", "b", "c", "b"];
  const durations = [5, 3, 7, 2];
  function capture(times, phase = 0) {
    const cycle = poses.flatMap((id, i) => Array(times[i]).fill(id));
    return Array.from({ length: 48 }, (_, tick) => cycle[(phase + tick) % cycle.length]);
  }

  it("recovers the phase even when capture begins inside the repeated image", () => {
    for (let phase = 0; phase < 17; phase += 1) {
      expect(matchPoseCadence(capture(durations, phase), poses, durations)).toMatchObject({ phase, period: 17 });
    }
  });

  it("distinguishes retiming the second occurrence from retiming the fourth", () => {
    expect(() => matchPoseCadence(capture([5, 2, 7, 3]), poses, durations)).toThrow(/Cadência/);
    expect(() => matchPoseCadence(Array(48).fill("still"), poses, durations)).toThrow(/Cadência/);
    expect(() => matchPoseCadence(capture(durations).slice(0, 17), poses, durations)).toThrow(/dois ciclos/);
  });

  it("locates the marked foot on the original artwork across backgrounds and offsets", () => {
    const source = `
      import { decodeWindowPng } from "./scripts/e2e-tauri-build-run.mjs";
      import { readFileSync } from "node:fs";
      const atlas = decodeWindowPng(readFileSync("data/reference_platformer_art/fox-five-frame-32-runtime.png"));
      process.stdout.write(JSON.stringify({ ...atlas, pixels: atlas.pixels.toString("base64") }));`;
    const atlas = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" }));
    atlas.pixels = Buffer.from(atlas.pixels, "base64");
    function render(image, dx, dy, background) {
      const out = Buffer.alloc(32 * 32 * 4, background);
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          const offset = (y * atlas.width + image * 32 + x) * 4;
          if (atlas.pixels[offset + 3] === 255) {
            const dest = ((y + dy) * 32 + x + dx) * 4;
            atlas.pixels.copy(out, dest, offset, offset + 4);
          }
        }
      }
      return out;
    }
    expect(locatePoseFoot(atlas, 0, render(0, 0, 0, 80))).toEqual([14, 27]);
    expect(locatePoseFoot(atlas, 1, render(1, 0, 0, 19))).toEqual([13, 26]);
    expect(locatePoseFoot(atlas, 1, render(1, 1, 1, 81))).toEqual([14, 27]);
    expect(locatePoseFoot(atlas, 1, render(1, -1, 1, 81))).toEqual([12, 27]);
    expect(() => locatePoseFoot(atlas, 0, render(1, 0, 0, 19))).toThrow(/0 correspondências/);
    expect(() => locatePoseFoot(atlas, 1, Buffer.alloc(32 * 32 * 4))).toThrow(/0 correspondências/);
  });
});

// Execute the real Node harness. Vite's browser transform cannot load its
// shebang or Node-only modules; no copy of the gate is used by this probe.
function isCurrentBuildFrame(frame, sha, previous) {
  const source = `const { isCurrentBuildFrame } = await import(${JSON.stringify(pathToFileURL(path.resolve("scripts/e2e-tauri-build-run.mjs")).href)});
    console.log(JSON.stringify(isCurrentBuildFrame(${JSON.stringify(frame)}, ${JSON.stringify(sha)}, ${JSON.stringify(previous)})));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" }));
}

function collectReadiness(observations, sha, previous) {
  const source = `const { createCurrentBuildFrameGate } = await import(${JSON.stringify(pathToFileURL(path.resolve("scripts/e2e-tauri-build-run.mjs")).href)});
    const ready = createCurrentBuildFrameGate(${JSON.stringify(sha)}, ${JSON.stringify(previous)});
    console.log(JSON.stringify(${JSON.stringify(observations)}.map(ready)));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" }));
}

const expectedSha = "a".repeat(64);
const previousSession = "joypad-session-1";
const ready = {
  non_black_pixels: 71680,
  rom_sha256: expectedSha,
  rendered_frames: 10,
  input_session_id: "joypad-session-2",
  input_hold: false,
};

function probeReport(method, value) {
  const source = `const harness = await import(${JSON.stringify(pathToFileURL(path.resolve("scripts/e2e-tauri-build-run.mjs")).href)});
    try { console.log(JSON.stringify({value:await harness[${JSON.stringify(method)}](${JSON.stringify(value)})})); }
    catch(error) { console.log(JSON.stringify({error:String(error)})); }`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" }));
}

describe("native evidence identities", () => {
  it("hashes the observed library independently of the loaded ROM", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rds-core-identity-"));
    try {
      const file = path.join(dir, "controlled-core.so");
      const bytes = Buffer.from("controlled library bytes; not an emulator");
      writeFileSync(file, bytes);
      const observed = {core_label: "controlled", core_path:file, rom_sha256:"a".repeat(64), frames_run:20};
      const report = probeReport("collectCoreIdentity", observed).value;
      expect(report.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      expect(report.rom_sha256).toBe(observed.rom_sha256);
      expect(report.sha256).not.toBe(report.rom_sha256);
      expect(report.path).toBe(file);
      expect(report.frames_run).toBe(20);
      expect(probeReport("collectCoreIdentity", {...observed,core_path:path.join(dir,"missing.so")}).error).toContain("ENOENT");
    } finally { rmSync(dir, {recursive:true, force:true}); }
  });

  it("refuses unobserved library identity and counts unknown steps as pending", () => {
    expect(probeReport("collectCoreIdentity", {core_label:"Snes9x",rom_sha256:"a".repeat(64)}).error).toContain("unconfirmed");
    expect(probeReport("summarizeReportSteps", [{status:"passed"},{status:"failed"},{status:"unobserved"},{}]).value)
      .toEqual({total:4,passed:1,failed:1,pending:2});
  });
});

describe("Build & Run framebuffer identity", () => {
  it("rejects the previous non-black ROM even after the build completion log", () => {
    const stale = { ...ready, rom_sha256: "b".repeat(64), input_session_id: previousSession, rendered_frames: 400 };
    // This is the old collector's complete acceptance condition.
    expect(stale.non_black_pixels > 0).toBe(true);
    expect(isCurrentBuildFrame(stale, expectedSha, previousSession)).toBe(false);
  });

  it("requires a new load even when the rebuilt ROM has the same hash", () => {
    expect(isCurrentBuildFrame({ ...ready, input_session_id: previousSession }, expectedSha, previousSession)).toBe(false);
    expect(isCurrentBuildFrame(ready, expectedSha, previousSession)).toBe(true);
  });

  it("accepts only after load and boot have finished, without depending on elapsed time", () => {
    const observations = [
      { ...ready, input_session_id: previousSession, rendered_frames: 400 },
      { ...ready, input_hold: true, rendered_frames: 400 },
      { ...ready, non_black_pixels: 689, rendered_frames: 0 },
      { ...ready, rendered_frames: 9 },
      ready,
    ];
    expect(observations.map((frame) => isCurrentBuildFrame(frame, expectedSha, previousSession)))
      .toEqual([false, false, false, false, true]);
  });

  it("refuses missing identity and a black frame", () => {
    for (const frame of [null, { ...ready, rom_sha256: "" }, { ...ready, input_session_id: null },
      { ...ready, rendered_frames: Number.NaN }, { ...ready, non_black_pixels: 0 }]) {
      expect(isCurrentBuildFrame(frame, expectedSha, previousSession)).toBe(false);
    }
  });

  it("waits for rendering after the new session, even with the same SHA and retained counter", () => {
    const observations = [400, 400, 409, 410].map((rendered_frames) => ({ ...ready, rendered_frames }));
    expect(collectReadiness(observations, expectedSha, previousSession)).toEqual([false, false, false, true]);
  });

  it("reanchors if the renderer resets its counter after the load", () => {
    const observations = [400, 10, 19, 20].map((rendered_frames) => ({ ...ready, rendered_frames }));
    expect(collectReadiness(observations, expectedSha, previousSession)).toEqual([false, false, false, true]);
  });
});
