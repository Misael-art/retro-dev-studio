import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PalettePlan } from "./palettePlan";
import type { Scene } from "./ipc/sceneService";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./palettePlan", async (original) => ({
  ...(await original<typeof import("./palettePlan")>()), fetchPalettePlan: mocks.fetch,
}));
import { applyPalettes, usePalettePlanStore } from "./palettePlanStore";
import { useEditorStore } from "./store/editorStore";

const plan = (id: string) => ({ scene_id: id, diagnostics: [] }) as unknown as PalettePlan;
const scene = { scene_id: "main", entities: [], background_layers: [], palettes: [] } as Scene;

beforeEach(() => {
  mocks.fetch.mockReset();
  useEditorStore.getState().setActiveProject("/one", "One");
  useEditorStore.getState().setActiveScene(scene);
  usePalettePlanStore.setState({ plan: null, contextKey: null, revision: null, error: null, loading: false });
});

describe("palette plan context", () => {
  it("does not reuse a plan for another project with the same revision", async () => {
    mocks.fetch.mockResolvedValueOnce(plan("one")).mockResolvedValueOnce(plan("two"));
    await usePalettePlanStore.getState().refresh();
    useEditorStore.getState().setActiveProject("/two", "Two");
    await usePalettePlanStore.getState().refresh();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(usePalettePlanStore.getState().plan?.scene_id).toBe("two");
  });

  it("does not let an old failure erase a newer successful plan", async () => {
    let fail!: (reason: Error) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    const old = usePalettePlanStore.getState().refresh();
    useEditorStore.getState().setActiveProject("/two", "Two");
    mocks.fetch.mockResolvedValueOnce(plan("two"));
    await usePalettePlanStore.getState().refresh();
    fail(new Error("old error"));
    await old;
    expect(usePalettePlanStore.getState().plan?.scene_id).toBe("two");
    expect(usePalettePlanStore.getState().error).toBeNull();
  });

  it("does not apply a palette proposal after the scene changes", async () => {
    let complete!: (value: PalettePlan) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const applying = applyPalettes([{ id: "old", slot: 0, colors: ["#ffffff"] }]);
    useEditorStore.getState().setActiveProject("/two", "Two");
    complete(plan("one"));
    expect(await applying).toEqual({ applied: false, added: [] });
    expect(useEditorStore.getState().activeScene?.palettes).toEqual([]);
  });
});
