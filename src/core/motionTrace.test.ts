import { describe, expect, it } from "vitest";
import { JOYPAD_DEFAULT } from "./ipc/emulatorService";
import { inputAtObservedFrame, motionTraceSummary, type MotionSample } from "./motionTrace";

const frames = (heights: number[]): MotionSample[] => heights.map((y, frame) => ({ frame, x: frame * 2, y, input: null }));

describe("motionTraceSummary", () => {
  it("marks a launch, highest point and stable landing in consecutive core samples", () => {
    const result = motionTraceSummary(frames([50, 50, 46, 41, 37, 37, 44, 50, 50]));
    expect(result.missing).toBe(0);
    expect(result.takeoff?.frame).toBe(1);
    expect(result.apex?.frame).toBe(4);
    expect(result.landing?.frame).toBe(7);
  });

  it("leaves a gap visible and does not infer a landing across it", () => {
    const points = frames([50, 50, 46, 41, 37, 37, 44, 50, 50]);
    const result = motionTraceSummary(points.filter(({ frame }) => frame !== 5 && frame !== 6));
    expect(result.missing).toBe(2);
    expect(result.landing).toBeUndefined();
  });

  it("counts frames skipped between the starting state and the first sample", () => {
    const points = frames([50, 50, 46, 41]);
    expect(motionTraceSummary(points.slice(3), 1).missing).toBe(2);
  });
});

describe("inputAtObservedFrame", () => {
  it("uses only input actually read during the sampled frame", () => {
    const left = { ...JOYPAD_DEFAULT, left: true };
    const observation = {
      epoch: 4, generation: 2, frames_run: 8,
      transitions: [
        { generation: 1, applied_at_frame: 5, joypad: left, first_polled_frame: 6, last_polled_frame: 8, superseded_unpolled: false },
        { generation: 2, applied_at_frame: 8, joypad: JOYPAD_DEFAULT, first_polled_frame: null, last_polled_frame: null, superseded_unpolled: false },
      ],
    };
    expect(inputAtObservedFrame(observation)).toEqual(left);
    expect(inputAtObservedFrame({ ...observation, frames_run: 9 })).toBeNull();
  });
});
