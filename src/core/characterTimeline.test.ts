import { describe, expect, it } from "vitest";

import type { AnimationDef } from "./ipc/sceneService";
import {
  addSoundEvent,
  describeOccurrences,
  moveOccurrence,
  occurrenceIds,
  removeEvent,
  retimeEventsToFit,
  setOccurrenceDuration,
  totalTicks,
  withOccurrenceIds,
} from "./characterTimeline";

/** Forma do Ken action 200: 200,1 (2) / 200,2 com Clsn1 (2) / 200,1 (2). */
function kenLike(): AnimationDef {
  const frame = (image: number, attack: boolean) => ({
    group: 200,
    image,
    axis: { x: 2, y: 2 },
    duration: 2,
    flags: [],
    clsn1: attack ? [{ x1: 18, y1: -68, x2: 68, y2: -83 }] : [],
    clsn2: [{ x1: -24, y1: 1, x2: 24, y2: -89 }],
  });
  return {
    frames: [1, 2, 1],
    fps: 30,
    loop: true,
    frame_durations: [2, 2, 2],
    mugen_frames: [frame(1, false), frame(2, true), frame(1, false)],
    occurrence_ids: ["o1", "o2", "o3"],
  };
}

describe("characterTimeline", () => {
  it("describes occurrences with source, boxes and start ticks", () => {
    const occ = describeOccurrences(kenLike());
    expect(occ.map((o) => [o.id, o.image, o.startTick, o.attackBoxes])).toEqual([
      ["o1", 1, 0, 0],
      ["o2", 2, 2, 1],
      ["o3", 1, 4, 0],
    ]);
    expect(totalTicks(kenLike())).toBe(6);
  });

  it("legacy animation derives ids without writing until migrated", () => {
    const legacy = { ...kenLike() };
    delete legacy.occurrence_ids;
    expect(occurrenceIds(legacy)).toEqual(["o1", "o2", "o3"]);
    expect(legacy.occurrence_ids).toBeUndefined();
    expect(withOccurrenceIds(legacy).occurrence_ids).toEqual(["o1", "o2", "o3"]);
  });

  it("edits only one occurrence even when another reuses the same image", () => {
    const result = setOccurrenceDuration(kenLike(), "o3", "9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.def.frame_durations).toEqual([2, 2, 9]);
    expect(result.def.mugen_frames?.map((f) => f.duration)).toEqual([2, 2, 9]);
  });

  it("refuses invalid durations without touching the animation", () => {
    for (const raw of ["0", "-2", "x", "", "256"]) {
      expect(setOccurrenceDuration(kenLike(), "o1", raw).ok).toBe(false);
    }
    expect(setOccurrenceDuration(kenLike(), "nope", "3").ok).toBe(false);
  });

  it("reorder keeps duration, boxes and events with the occurrence identity", () => {
    let def = kenLike();
    const durationEdit = setOccurrenceDuration(def, "o3", "7");
    if (!durationEdit.ok) throw new Error(durationEdit.message);
    const withEvent = addSoundEvent(durationEdit.def, "o3", 5, "hit");
    if (!withEvent.ok) throw new Error(withEvent.message);
    def = withEvent.def;
    const moved = moveOccurrence(def, "o3", 0);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.def.occurrence_ids).toEqual(["o3", "o1", "o2"]);
    expect(moved.def.frames).toEqual([1, 1, 2]);
    expect(moved.def.frame_durations).toEqual([7, 2, 2]);
    expect(moved.def.mugen_frames?.map((f) => f.clsn1?.length)).toEqual([0, 0, 1]);
    // O evento continua na mesma ocorrência (agora na posição 0), não na imagem 1 da posição 1.
    expect(describeOccurrences(moved.def)[0].events.map((e) => e.tick)).toEqual([5]);
    expect(describeOccurrences(moved.def)[1].events).toEqual([]);
  });

  it("shortening an occurrence with an event is diagnosed, never shifted; retiming is explicit", () => {
    const withEvent = addSoundEvent(kenLike(), "o2", 1, "hit");
    if (!withEvent.ok) throw new Error(withEvent.message);
    const shortened = setOccurrenceDuration(withEvent.def, "o2", "1");
    expect(shortened.ok).toBe(false);
    if (shortened.ok) return;
    expect(shortened.conflicts).toHaveLength(1);
    const retimed = retimeEventsToFit(withEvent.def, "o2", 1);
    expect(retimed.frame_events?.[0].tick).toBe(0);
    expect(setOccurrenceDuration(retimed, "o2", "1").ok).toBe(true);
  });

  it("validates event placement and removes events", () => {
    expect(addSoundEvent(kenLike(), "o1", 2, "hit").ok).toBe(false);
    expect(addSoundEvent(kenLike(), "o1", 0, " ").ok).toBe(false);
    const hold = setOccurrenceDuration(kenLike(), "o3", "-1");
    if (!hold.ok) throw new Error(hold.message);
    expect(addSoundEvent(hold.def, "o3", 1, "hit").ok).toBe(false);
    const ok = addSoundEvent(hold.def, "o3", 0, "hit");
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const event = ok.def.frame_events![0];
    expect(event).toMatchObject({ occurrence: "o3", tick: 0, kind: "sound", origin: "authored" });
    expect(removeEvent(ok.def, event.id).frame_events).toEqual([]);
  });
});

describe("occurrence boxes", () => {
  it("edits one occurrence's attack box without touching the other occurrence of the same image", async () => {
    const { setOccurrenceBox, addOccurrenceBox, removeOccurrenceBox } = await import("./characterTimeline");
    const def = kenLike();
    const moved = setOccurrenceBox(def, "o2", "clsn1", 0, { x1: 220, y1: -83, x2: 270, y2: -68 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.def.mugen_frames?.[1].clsn1).toEqual([{ x1: 220, y1: -83, x2: 270, y2: -68 }]);
    expect(moved.def.mugen_frames?.[1].clsn_edited).toBe(true);
    expect(moved.def.mugen_frames?.[0].clsn_edited).toBeUndefined();
    const added = addOccurrenceBox(def, "o3", "clsn1", { x1: 10, y1: -20, x2: 0, y2: -40 });
    expect(added.ok && added.def.mugen_frames?.[2].clsn1).toEqual([{ x1: 0, y1: -40, x2: 10, y2: -20 }]);
    expect(added.ok && added.def.mugen_frames?.[0].clsn1).toEqual([]);
    const removed = removeOccurrenceBox(def, "o2", "clsn1", 0);
    expect(removed.ok && removed.def.mugen_frames?.[1].clsn1).toEqual([]);
  });

  it("refuses degenerate, fractional, out-of-range or missing boxes", async () => {
    const { setOccurrenceBox } = await import("./characterTimeline");
    expect(setOccurrenceBox(kenLike(), "o2", "clsn1", 0, { x1: 5, y1: 5, x2: 5, y2: 9 }).ok).toBe(false);
    expect(setOccurrenceBox(kenLike(), "o2", "clsn1", 0, { x1: 0.5, y1: 0, x2: 9, y2: 9 }).ok).toBe(false);
    expect(setOccurrenceBox(kenLike(), "o2", "clsn1", 0, { x1: 0, y1: 0, x2: 900, y2: 9 }).ok).toBe(false);
    expect(setOccurrenceBox(kenLike(), "o2", "clsn1", 3, { x1: 0, y1: 0, x2: 9, y2: 9 }).ok).toBe(false);
    expect(setOccurrenceBox(kenLike(), "zz", "clsn1", 0, { x1: 0, y1: 0, x2: 9, y2: 9 }).ok).toBe(false);
  });
});
