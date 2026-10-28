import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CGraphFile } from "../../core/ipc/projectService";

const getSgdkCGraphFile = vi.fn();
const getSgdkCGraphIndex = vi.fn();
const updateSgdkCGraphNode = vi.fn();
const updateSgdkCGraphBlock = vi.fn();

vi.mock("../../core/ipc/projectService", () => ({
  getSgdkCGraphFile: (...args: unknown[]) => getSgdkCGraphFile(...args),
  getSgdkCGraphIndex: (...args: unknown[]) => getSgdkCGraphIndex(...args),
  updateSgdkCGraphNode: (...args: unknown[]) => updateSgdkCGraphNode(...args),
  updateSgdkCGraphBlock: (...args: unknown[]) => updateSgdkCGraphBlock(...args),
}));

import { CGraphPanel } from "./CGraphPanel";

const GRAPH: CGraphFile = {
  schema: "sgdk-c-graph/v1",
  source_file: "src/main.c",
  source_sha256: "abc",
  parse_error_nodes: 1,
  root: {
    id: "n",
    kind: "translation_unit",
    role: "item",
    label: "",
    start_line: 1,
    end_line: 3,
    children: [
      {
        id: "n.0",
        kind: "function_definition",
        role: "item",
        label: "int main(void)",
        start_line: 1,
        end_line: 3,
        function: "main",
        children: [
          { id: "n.0.s0", kind: "syntax", role: "syntax", label: "int main(void)", start_line: 1, end_line: 1, text: "int main(void) " },
          {
            id: "n.0.1",
            kind: "compound_statement",
            role: "item",
            label: "{",
            start_line: 1,
            end_line: 3,
            children: [
              { id: "n.0.1.s0", kind: "syntax", role: "syntax", label: "{", start_line: 1, end_line: 1, text: "{ " },
              {
                id: "n.0.1.0",
                kind: "expression_statement",
                role: "item",
                label: "SPR_setAnim(p, 1);",
                start_line: 2,
                end_line: 2,
                text: "SPR_setAnim(p, 1);",
                block: { node_type: "sprite_anim", form: "call", target: "SPR_setAnim", operator: "", args: ["p", "1"] },
              },
              { id: "n.0.1.s1", kind: "syntax", role: "syntax", label: "}", start_line: 3, end_line: 3, text: " return 0; }" },
            ],
          },
        ],
      },
      { id: "n.s1", kind: "syntax", role: "syntax", label: "", start_line: 3, end_line: 3, text: "\n" },
    ],
  },
};

describe("CGraphPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getSgdkCGraphFile.mockResolvedValue(GRAPH);
    getSgdkCGraphIndex.mockResolvedValue({
      schema: "sgdk-c-graph-index/v1",
      files: [],
      functions: [],
      entry_points: [],
      state_machines: [
        {
          file: "src/main.c",
          function: "main",
          subject: "state",
          states: ["IDLE", "WALK"],
          transitions: [{ from: "IDLE", to: "WALK", line: 2, node_id: "n.0.1.0" }],
          line: 1,
          node_id: "n.0",
        },
      ],
    });
    updateSgdkCGraphBlock.mockResolvedValue(GRAPH);
    updateSgdkCGraphNode.mockResolvedValue(GRAPH);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("shows C nodes without syntax leaves and applies an edit to the selected node", async () => {
    await act(async () => {
      root.render(<CGraphPanel projectDir="/p/rds" sourceFile="src/main.c" />);
    });
    expect(getSgdkCGraphFile).toHaveBeenCalledWith("/p/rds", "src/main.c");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("1 trecho(s)");
    expect(container.querySelector("[data-testid='cgraph-node-n.s1']")).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='cgraph-node-n.0']")?.click();
    });
    const textarea = container.querySelector("textarea")!;
    expect(textarea.value).toBe("int main(void) { SPR_setAnim(p, 1); return 0; }");

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(textarea, "int main(void) { return 7; }");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((b) => b.textContent === "Aplicar ao C")!.click();
    });
    expect(updateSgdkCGraphNode).toHaveBeenCalledWith("/p/rds", "src/main.c", "n.0", "int main(void) { return 7; }");
  });
});

describe("CGraphPanel blocks and state machines", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lists FSM transitions, jumps to the transition node and edits a block by fields", async () => {
    await act(async () => {
      root.render(<CGraphPanel projectDir="/p/rds" sourceFile="src/main.c" />);
    });
    const fsm = container.querySelector("[data-testid='cgraph-state-machines']")!;
    expect(fsm.textContent).toContain("FSM state");
    expect(fsm.textContent).toContain("IDLE → WALK");

    await act(async () => {
      [...fsm.querySelectorAll("button")].find((b) => b.textContent === "IDLE → WALK")!.click();
    });
    const editor = container.querySelector("[data-testid='cgraph-block-editor']")!;
    expect(editor.textContent).toContain("sprite_anim");
    const arg = editor.querySelector<HTMLInputElement>("input[aria-label='Argumento 2']")!;
    expect(arg.value).toBe("1");

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(arg, "ANIM_WALK");
      arg.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...editor.querySelectorAll("button")].find((b) => b.textContent === "Aplicar bloco")!.click();
    });
    expect(updateSgdkCGraphBlock).toHaveBeenCalledWith("/p/rds", "src/main.c", "n.0.1.0", {
      node_type: "sprite_anim",
      form: "call",
      target: "SPR_setAnim",
      operator: "",
      args: ["p", "ANIM_WALK"],
    });
    expect(getSgdkCGraphIndex).toHaveBeenCalledTimes(2);
  });
});
