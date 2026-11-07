import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSgdkCGraphIndex = vi.fn();
const getSgdkCGraphFile = vi.fn((...args: unknown[]) => new Promise(() => void args));

vi.mock("../../core/ipc/projectService", () => ({
  getSgdkCGraphIndex: (...args: unknown[]) => getSgdkCGraphIndex(...args),
  getSgdkCGraphFile: (...args: unknown[]) => getSgdkCGraphFile(...args),
  updateSgdkCGraphNode: vi.fn(),
  updateSgdkCGraphBlock: vi.fn(),
}));

import { GameCodeLogic } from "./GameCodeLogic";

const file = (source_file: string) => ({ source_file, graph_file: `code/${source_file}.cgraph.json`, source_sha256: "x", roundtrip_exact: true, parse_error_nodes: 0, stale: false });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  getSgdkCGraphIndex.mockResolvedValue({
    schema: "v1",
    files: [file("src/main.c"), file("src/player/player.c"), file("inc/player.h")],
    functions: [{ file: "src/main.c", name: "main", line: 1, node_id: "n", calls: [] }, { file: "src/player/player.c", name: "player_update", line: 3, node_id: "n", calls: [] }],
    state_machines: [{ file: "src/player/player.c", function: "player_update", subject: "p->state", states: ["IDLE", "JUMP"], transitions: [], line: 5, node_id: "n" }],
    entry_points: ["main"],
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("GameCodeLogic", () => {
  it("groups C files by folder, opens the file with state machines first and filters by function name", async () => {
    await act(async () => root.render(<GameCodeLogic projectDir="/p" />));
    await act(async () => {});
    const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    expect(q("game-code-logic")!.textContent).toContain("3 arquivos · 1 máquinas de estado · 2 funções");
    expect(q("game-code-file-src/player/player.c")!.getAttribute("aria-current")).toBe("true");
    expect(getSgdkCGraphFile).toHaveBeenCalledWith("/p", "src/player/player.c");
    const input = q("game-code-filter") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "main");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(q("game-code-file-src/main.c")).not.toBeNull();
    expect(q("game-code-file-inc/player.h")).toBeNull();
  });
});
