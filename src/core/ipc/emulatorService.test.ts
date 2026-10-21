import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

import {
  keyToJoypad,
  emulatorPlayReplay,
  emulatorReadMemory,
  emulatorStartRecording,
  emulatorStopRecording,
  listenToAudioStream,
  listenToFrames,
  acceptsFrame,
  runSingleFrame,
} from "./emulatorService";

describe("frame presentation", () => {
  const payload = { width: 1, height: 1, rgba: [10, 20, 30, 255], core_epoch: 2, rom_sha256: "loaded", frame_sequence: 7, frame_index: 1 };

  it("receives paused frames without commands and ignores queued events after disposal", async () => {
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
    const unlisten = vi.fn();
    mocks.listen.mockResolvedValue(unlisten);
    const received = vi.fn();
    const stop = await listenToFrames(received);
    const handler = mocks.listen.mock.calls[0][1] as (event: { payload: typeof payload }) => void;
    expect(mocks.listen).toHaveBeenCalledWith("emulator://frame", expect.any(Function));
    handler({ payload });
    expect(received).toHaveBeenCalledExactlyOnceWith(payload);
    expect(mocks.invoke).not.toHaveBeenCalled();
    stop();
    handler({ payload });
    stop();
    expect(received).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("refuses missing identity, stale ROMs, stale epochs and reordered presentation", () => {
    expect(acceptsFrame(payload, 2, "loaded", null)).toBe(true);
    expect(acceptsFrame(payload, null, "loaded", null)).toBe(false);
    expect(acceptsFrame(payload, 2, undefined, null)).toBe(false);
    expect(acceptsFrame({ ...payload, core_epoch: undefined }, 2, "loaded", null)).toBe(false);
    expect(acceptsFrame({ ...payload, rom_sha256: undefined }, 2, "loaded", null)).toBe(false);
    expect(acceptsFrame({ ...payload, frame_sequence: undefined }, 2, "loaded", null)).toBe(false);
    expect(acceptsFrame(payload, 3, "loaded", null)).toBe(false);
    expect(acceptsFrame(payload, 2, "other", null)).toBe(false);
    for (const sequence of [0, 1.5, NaN, Infinity, 6, 7]) {
      expect(acceptsFrame({ ...payload, frame_sequence: sequence }, 2, "loaded", { epoch: 2, sequence: 7 })).toBe(false);
    }
    // Frame index may decrease on rewind; only publication sequence determines freshness.
    expect(acceptsFrame({ ...payload, frame_sequence: 8, frame_index: 0 }, 2, "loaded", { epoch: 2, sequence: 7 })).toBe(true);
    expect(acceptsFrame(payload, 2, "loaded", { epoch: 1, sequence: 99 })).toBe(true);
  });
});

describe("emulatorReadMemory", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
  });

  it("invokes the Tauri memory reader with canonical arguments", async () => {
    const payload = { ok: true, data: [0x10, 0x11, 0x12], total_size: 64 };
    mocks.invoke.mockResolvedValue(payload);

    await expect(emulatorReadMemory(2, 0x10, 0x20)).resolves.toEqual(payload);

    expect(mocks.invoke).toHaveBeenCalledWith("emulator_read_memory", {
      region: 2,
      offset: 0x10,
      length: 0x20,
    });
  });
});

describe("listenToAudioStream", () => {
  beforeEach(() => {
    mocks.listen.mockReset();
  });

  it("subscribes to the canonical emulator audio event", async () => {
    const unlisten = vi.fn();
    const payload = { sample_rate: 44100, samples: [1, -1, 2, -2] };
    mocks.listen.mockResolvedValue(unlisten);

    const received = vi.fn();
    const stop = await listenToAudioStream(received);
    const handler = mocks.listen.mock.calls[0]?.[1] as ((event: { payload: typeof payload }) => void);

    expect(mocks.listen).toHaveBeenCalledWith("emulator://audio", expect.any(Function));
    handler({ payload });
    expect(received).toHaveBeenCalledWith(payload);
    stop();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("replay commands", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("invokes canonical replay recording commands", async () => {
    mocks.invoke.mockResolvedValue({
      ok: true,
      message: "ok",
      replay_path: "F:/replay.rds-replay",
      frames_recorded: 2,
      framebuffer_match: true,
    });

    await emulatorStartRecording();
    await emulatorStopRecording("F:/Projects/Test");
    await emulatorPlayReplay("F:/Projects/Test/replay.rds-replay");

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "emulator_start_recording");
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "emulator_stop_recording", {
      projectDir: "F:/Projects/Test",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "emulator_play_replay", {
      replayPath: "F:/Projects/Test/replay.rds-replay",
    });
  });
});

describe("keyToJoypad", () => {
  const idle = {
    b: false, y: false, select: false, start: false, up: false, down: false,
    left: false, right: false, a: false, x: false, l: false, r: false,
  };

  it("routes Z/X/C to the RetroPad ids Genesis Plus GX binds to Mega Drive A/B/C", () => {
    expect(keyToJoypad(idle, "KeyZ", true)).toEqual({ ...idle, y: true });
    expect(keyToJoypad(idle, "KeyX", true, "megadrive")).toEqual({ ...idle, b: true });
    expect(keyToJoypad(idle, "KeyC", true, "megadrive")).toEqual({ ...idle, a: true });
    expect(keyToJoypad({ ...idle, y: true }, "KeyZ", false)).toEqual(idle);
  });

  it("keeps the native RetroPad layout for SNES", () => {
    expect(keyToJoypad(idle, "KeyZ", true, "snes")).toEqual({ ...idle, a: true });
    expect(keyToJoypad(idle, "KeyC", true, "snes")).toEqual({ ...idle, y: true });
  });

  it("ignores unmapped keys", () => {
    expect(keyToJoypad(idle, "KeyQ", true)).toBeNull();
  });
});

describe("runSingleFrame", () => {
  const payload = { width: 1, height: 1, rgba: [0, 0, 0, 255], core_epoch: 1, rom_sha256: "r", frame_sequence: 3, frame_index: 3 };

  it("runs exactly one frame even when the frame event arrives late", async () => {
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
    const unlisten = vi.fn();
    mocks.listen.mockResolvedValue(unlisten);
    mocks.invoke.mockResolvedValue({ ok: true, message: "" });
    const seen = vi.fn();
    const pending = runSingleFrame(seen);
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    // Evento atrasado bem depois do intervalo de ~16 ms do loop normal.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const handler = mocks.listen.mock.calls[0][1] as (event: { payload: typeof payload }) => void;
    handler({ payload });
    handler({ payload: { ...payload, frame_sequence: 4 } });
    await expect(pending).resolves.toEqual(payload);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith("emulator_run_frame");
    expect(seen).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("fails without presenting when the core refuses the frame", async () => {
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
    const unlisten = vi.fn();
    mocks.listen.mockResolvedValue(unlisten);
    mocks.invoke.mockResolvedValue({ ok: false, message: "sem rom" });
    await expect(runSingleFrame(vi.fn())).rejects.toThrow("sem rom");
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
