import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CGraphFile } from "../../core/ipc/projectService";

const getSgdkCGraphFile = vi.fn();
const updateSgdkCGraphNode = vi.fn();

vi.mock("../../core/ipc/projectService", () => ({
  getSgdkCGraphFile: (...args: unknown[]) => getSgdkCGraphFile(...args),
  updateSgdkCGraphNode: (...args: unknown[]) => updateSgdkCGraphNode(...args),
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
          { id: "n.0.1", kind: "compound_statement", role: "item", label: "{", start_line: 1, end_line: 3, text: "{ return 0; }" },
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
    expect(textarea.value).toBe("int main(void) { return 0; }");

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
