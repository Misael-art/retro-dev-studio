import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MugenSourceAnalysis, MugenReviewOptions } from "../../core/mugenReview";
import MugenSourceReviewPanel from "./MugenSourceReviewPanel";

const mocks = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock("../../core/mugenReview", async (original) => ({
  ...(await original<typeof import("../../core/mugenReview")>()), analyzeMugenSource: mocks.analyze,
}));
vi.mock("./MugenVisualComparison", () => ({ default: () => null }));
vi.mock("./MugenChainReview", () => ({ default: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const choices: MugenReviewOptions = { def_file: "hero.def", actions: [], palette_file: null, authored_demo: false, original_chain: false, chain_state: null, source_sha256: "source" };
const metadata = { source_sha256: "source", selected_def: "hero.def", defs: [{ file: "hero.def", name: "Hero" }], actions: [{ number: 0, frames: 2, line: 1 }], references: [], palettes: [], diagnostics: [], options: choices, report: null } as unknown as MugenSourceAnalysis;
let root: Root;
let host: HTMLDivElement;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  mocks.analyze.mockReset();
  mocks.analyze.mockImplementation(async (_path, options, metadataOnly) => ({ ...metadata, options: options ?? choices, report: metadataOnly ? null : { metrics: [] } }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

it("opens with metadata and requires explicit pixel analysis before importing", async () => {
  const importSource = vi.fn().mockResolvedValue(undefined);
  await act(async () => root.render(<MugenSourceReviewPanel sourcePath="/source" onCancel={vi.fn()} onImport={importSource} />));
  expect(mocks.analyze).toHaveBeenCalledWith("/source", undefined, true);
  expect(q("mugen-source-import").disabled).toBe(true);
  await act(async () => q("mugen-source-import").click());
  expect(importSource).not.toHaveBeenCalled();
  await act(async () => q("mugen-source-analyze").click());
  expect(mocks.analyze).toHaveBeenLastCalledWith("/source", choices, false);
  expect(q("mugen-source-import").disabled).toBe(false);
  await act(async () => q("mugen-source-import").click());
  expect(importSource).toHaveBeenCalledWith(choices);
});

it("protects the selected options while their full analysis is in flight", async () => {
  await act(async () => root.render(<MugenSourceReviewPanel sourcePath="/source" onCancel={vi.fn()} onImport={vi.fn()} />));
  let complete!: (result: MugenSourceAnalysis) => void;
  mocks.analyze.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  await act(async () => q("mugen-source-analyze").click());
  expect(q("mugen-source-action-0")).toBeNull();
  expect(q("mugen-source-authored-demo").matches(":disabled")).toBe(true);
  expect(q("mugen-source-import").disabled).toBe(true);
  await act(async () => complete({ ...metadata, report: { metrics: [] } } as unknown as MugenSourceAnalysis));
  expect(q("mugen-source-authored-demo").matches(":disabled")).toBe(false);
});
