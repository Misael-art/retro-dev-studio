import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CharacterTimelinePanel from "./CharacterTimelinePanel";
import type { AnimationDef, Entity, Scene } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";
import { initialStudioContext } from "../../core/studioContext";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function attack(): AnimationDef {
  const frame = (image: number, hit: boolean) => ({
    group: 200,
    image,
    axis: { x: 0, y: 0 },
    duration: 2,
    flags: [],
    clsn1: hit ? [{ x1: 18, y1: -68, x2: 68, y2: -83 }] : [],
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

function ken(id: string, withAudio: boolean): Entity {
  return {
    entity_id: id,
    transform: { x: 0, y: 0 },
    components: {
      sprite: {
        asset: "assets/sprites/ken.png",
        frame_width: 96,
        frame_height: 112,
        pivot: { x: 48, y: 104 },
        animations: { action_200: attack() },
      },
      ...(withAudio ? { audio: { sfx: { hit: "assets/audio/hit.wav" } } } : {}),
    },
  } as Entity;
}

let root: Root | null = null;
let container: HTMLDivElement;

function scene(): Scene {
  return { scene_id: "main", background_layers: [], entities: [ken("ken", true), ken("dummy", false)] } as unknown as Scene;
}

async function render() {
  const entity = useEditorStore.getState().activeScene!.entities[0];
  await act(async () => {
    root!.render(<CharacterTimelinePanel entity={entity} />);
  });
}

function q(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="${id}"]`);
  if (!el) throw new Error(`missing ${id}`);
  return el as HTMLElement;
}

async function typeDuration(value: string) {
  const input = q("character-duration") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.focus();
    input.blur();
  });
  await render();
}

function anim(entityId: string): AnimationDef {
  return useEditorStore.getState().activeScene!.entities.find((e) => e.entity_id === entityId)!.components.sprite!
    .animations!.action_200;
}

describe("CharacterTimelinePanel", () => {
  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useEditorStore.setState({ studio: initialStudioContext(), undoStack: [], redoStack: [], activeProjectDir: "/p" });
    useEditorStore.getState().setActiveScene(scene());
    useEditorStore.setState({ undoStack: [], redoStack: [] });
    await render();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    root = null;
  });

  it("shows occurrences with identity, boxes and model scope", () => {
    expect(container.querySelectorAll('[data-testid="character-occurrences"] [data-testid^="character-occurrence-o"]').length).toBe(3);
    expect(q("character-scope").textContent).toContain("Editar modelo — 2 usos");
    expect(q("character-occurrence-o2").getAttribute("aria-label")).toContain("imagem 2");
  });

  it("edits one occurrence across all model users in a single undo step", async () => {
    await act(async () => q("character-occurrence-o3").click());
    await render();
    expect(useEditorStore.getState().studio.focus.occurrenceId).toBe("o3");
    await typeDuration("9");
    expect(anim("ken").frame_durations).toEqual([2, 2, 9]);
    expect(anim("dummy").frame_durations).toEqual([2, 2, 9]);
    expect(anim("ken").mugen_frames?.map((f) => f.duration)).toEqual([2, 2, 9]);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    await act(async () => useEditorStore.getState().undo());
    expect(anim("ken").frame_durations).toEqual([2, 2, 2]);
    expect(anim("dummy").frame_durations).toEqual([2, 2, 2]);
    expect(useEditorStore.getState().studio.focus.occurrenceId).toBe("o3");
  });

  it("refuses invalid duration and keeps the project", async () => {
    await typeDuration("0");
    expect(q("character-message-error").textContent).toMatch(/0 nao e aceito/);
    expect(anim("ken").frame_durations).toEqual([2, 2, 2]);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("clears an invalid duration message when selecting a different occurrence", async () => {
    await typeDuration("0");
    expect(q("character-message-error").textContent).toMatch(/0 nao e aceito/);
    await act(async () => q("character-occurrence-o2").click());
    await render();
    expect(container.querySelector('[data-testid="character-message-error"]')).toBeNull();
    expect((q("character-duration") as HTMLInputElement).value).toBe("2");
    expect(anim("ken").frame_durations).toEqual([2, 2, 2]);
  });

  it("adds a sound event on an occurrence, refuses shortening, and retimes only on explicit action", async () => {
    await act(async () => q("character-occurrence-o2").click());
    await render();
    const select = q("character-event-sound") as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "hit");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const tick = q("character-event-tick") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(tick, "1");
      tick.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => q("character-event-add").click());
    await render();
    expect(anim("ken").frame_events).toMatchObject([{ occurrence: "o2", tick: 1, kind: "sound", sound: "hit" }]);
    expect(anim("dummy").frame_events).toHaveLength(1);

    await typeDuration("1");
    expect(q("character-message-error").textContent).toMatch(/fora da ocorrência/);
    expect(anim("ken").frame_durations).toEqual([2, 2, 2]);
    await act(async () => q("character-retime-events").click());
    await render();
    expect(anim("ken").frame_durations).toEqual([2, 1, 2]);
    expect(anim("ken").frame_events?.[0].tick).toBe(0);
  });

  it("reorders occurrences carrying identity and boxes", async () => {
    await act(async () => q("character-occurrence-o2").click());
    await render();
    await act(async () => q("character-move-right").click());
    await render();
    expect(anim("ken").occurrence_ids).toEqual(["o1", "o3", "o2"]);
    expect(anim("ken").mugen_frames?.map((f) => f.clsn1?.length)).toEqual([0, 0, 1]);
  });

  it("a model user without its own audio can use project sounds; with none in the project it explains", async () => {
    const dummy = useEditorStore.getState().activeScene!.entities[1];
    await act(async () => root!.render(<CharacterTimelinePanel entity={dummy} />));
    expect(container.querySelector('[data-testid="character-event-no-audio"]')).toBeNull();
    expect(container.querySelector('[data-testid="character-event-sound"] option[value="hit"]')).not.toBeNull();
    act(() => useEditorStore.getState().updateEntity("ken", { components: { audio: { sfx: {} } } }));
    useEditorStore.setState((s) => ({
      activeScene: { ...s.activeScene!, entities: s.activeScene!.entities.map((e) => ({ ...e, components: { ...e.components, audio: undefined } })) },
    }));
    await act(async () => root!.render(<CharacterTimelinePanel entity={useEditorStore.getState().activeScene!.entities[1]} />));
    expect(q("character-event-no-audio").textContent).toContain("Adicione um som");
    expect(q("character-add-sound")).not.toBeNull();
  });
});

describe("CharacterTimelinePanel box editing", () => {
  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useEditorStore.setState({ studio: initialStudioContext(), undoStack: [], redoStack: [], activeProjectDir: "/p" });
    useEditorStore.getState().setActiveScene(scene());
    useEditorStore.setState({ undoStack: [], redoStack: [] });
    await render();
    await act(async () => q("character-occurrence-o2").click());
    await render();
  });
  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    root = null;
  });
  const attackBox = () => container.querySelector('[data-box="clsn1:0"]') as HTMLElement;
  const pointer = (target: EventTarget, type: string, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));

  it("dragging the attack box moves it in pixels (scale 3) as one undo step for all model users", async () => {
    await act(async () => pointer(attackBox(), "pointerdown", 100, 100));
    await act(async () => pointer(window, "pointermove", 100 + 3 * 50, 100 + 3 * 10));
    await act(async () => pointer(window, "pointerup", 100 + 3 * 50, 100 + 3 * 10));
    await render();
    for (const id of ["ken", "dummy"]) {
      expect(anim(id).mugen_frames?.[1].clsn1).toEqual([{ x1: 68, y1: -73, x2: 118, y2: -58 }]);
      expect(anim(id).mugen_frames?.[1].clsn_edited).toBe(true);
    }
    expect(anim("ken").mugen_frames?.[0].clsn1).toEqual([]);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().studio.focus.boxKey).toBe("clsn1:0");
    await act(async () => useEditorStore.getState().undo());
    expect(anim("dummy").mugen_frames?.[1].clsn1).toEqual([{ x1: 18, y1: -68, x2: 68, y2: -83 }]);
  });

  it("resizes from the corner handle and nudges with arrow keys", async () => {
    const handle = container.querySelector('[data-testid="character-box-handle-clsn1-0"]') as HTMLElement;
    await act(async () => pointer(handle, "pointerdown", 0, 0));
    await act(async () => pointer(window, "pointermove", 3 * 5, 3 * 2));
    await act(async () => pointer(window, "pointerup", 3 * 5, 3 * 2));
    await render();
    expect(anim("ken").mugen_frames?.[1].clsn1).toEqual([{ x1: 18, y1: -83, x2: 73, y2: -66 }]);
    await act(async () => attackBox().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    await render();
    expect(anim("ken").mugen_frames?.[1].clsn1?.[0].x1).toBe(17);
    expect(useEditorStore.getState().undoStack).toHaveLength(2);
  });

  it("numeric field edits, refuses a degenerate box, adds and removes boxes", async () => {
    await act(async () => pointer(attackBox(), "pointerdown", 1, 1));
    await act(async () => pointer(window, "pointerup", 1, 1));
    await render();
    const x2 = q("character-box-field-x2") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(x2, "18");
      x2.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      x2.focus();
      x2.blur();
    });
    await render();
    expect(q("character-message-error").textContent).toMatch(/largura/);
    expect(anim("ken").mugen_frames?.[1].clsn1?.[0].x2).toBe(68);
    await act(async () => q("character-box-add-clsn2").click());
    await render();
    expect(anim("ken").mugen_frames?.[1].clsn2).toHaveLength(2);
    await act(async () => q("character-box-remove").click());
    await render();
    expect(anim("ken").mugen_frames?.[1].clsn2).toHaveLength(1);
  });
});
