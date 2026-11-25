import type { EmulatorInputObservation, JoypadState } from "./ipc/emulatorService";

export interface MotionSample {
  frame: number;
  x: number;
  y: number;
  input: JoypadState | null;
}

export interface MotionTrace {
  entityId: string;
  sceneRevision: number;
  romSha256: string;
  coreEpoch: number;
  coreLabel: string;
  initialFrame: number;
  initialFramebufferSha256: string;
  samples: MotionSample[];
}

export interface MotionTraceSession {
  key: string;
  recording: "a" | "b" | null;
  a: MotionTrace | null;
  b: MotionTrace | null;
}

export const MAX_MOTION_SAMPLES = 240;

export function inputAtObservedFrame(observation: EmulatorInputObservation): JoypadState | null {
  const { frames_run: frame, transitions } = observation;
  return [...transitions].reverse().find(({ first_polled_frame, last_polled_frame }) => first_polled_frame !== null
    && last_polled_frame !== null && first_polled_frame <= frame && frame <= last_polled_frame)?.joypad ?? null;
}

/** Marks jump candidates in world coordinates, using only consecutive core samples. */
export function motionTraceSummary(samples: MotionSample[], initialFrame = samples[0]?.frame ?? 0) {
  let missing = Math.max(0, (samples[0]?.frame ?? initialFrame) - initialFrame);
  let takeoff: MotionSample | undefined;
  let apex: MotionSample | undefined;
  let landing: MotionSample | undefined;
  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index], previous = samples[index - 1], earlier = samples[index - 2];
    if (current.frame !== previous.frame + 1) {
      missing += Math.max(0, current.frame - previous.frame - 1);
      if (!landing) { takeoff = undefined; apex = undefined; }
      continue;
    }
    if (landing) continue;
    if (!takeoff && earlier && earlier.frame + 1 === previous.frame && earlier.y === previous.y && current.y < previous.y) {
      takeoff = previous;
    }
    if (!takeoff) continue;
    if (!apex || current.y < apex.y) apex = current;
    if (earlier && earlier.frame + 1 === previous.frame && apex && previous.frame > apex.frame
        && current.y === previous.y && current.y >= takeoff.y - 1 && previous.y > earlier.y) {
      landing = previous;
    }
  }
  return { missing, takeoff, apex, landing };
}
