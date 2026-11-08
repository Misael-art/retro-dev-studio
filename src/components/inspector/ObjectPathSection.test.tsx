import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectPathSection } from "./ObjectPathSection";
import { defaultPath, pathIssue } from "../../core/objectPath";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const q = <T extends HTMLElement = HTMLInputElement>(id: string) => host.querySelector(`[data-testid="${id}"]`) as T;
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function blur(input: HTMLInputElement) { await act(async () => { input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); }); }
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("RC03/08 numeric path authoring", () => {
  it("commits typing once on blur and cancels Escape without a change", async () => {
    const onChange = vi.fn();
    await render(<ObjectPathSection contextKey="one/main/goal" path={defaultPath()} fps={60} blockedReason={null} onChange={onChange} />);
    const field = q("inspector-path-x-1");
    await type(field, "-");
    expect(onChange).not.toHaveBeenCalled();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    await type(field, "-1");
    await type(field, "-120");
    expect(onChange).not.toHaveBeenCalled();
    await blur(field);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].points[1].x).toBe(-120);
    await type(field, "999");
    await act(async () => { field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await blur(field);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("discards incomplete drafts when project/scene/object changes", async () => {
    const onChange = vi.fn();
    const props = { path: defaultPath(), fps: 60, blockedReason: null, onChange };
    await render(<ObjectPathSection {...props} contextKey="one/main/goal" />);
    await type(q("inspector-path-x-1"), "-");
    await render(<ObjectPathSection {...props} contextKey="two/main/goal" />);
    expect(q("inspector-path-x-1").value).toBe("64");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("generates a valid loop and ellipse without enabling autostart", async () => {
    const onChange = vi.fn();
    await render(<ObjectPathSection contextKey="one/main/goal" path={{ ...defaultPath(), autostart: false }} fps={60} blockedReason={null} onChange={onChange} />);
    await act(async () => {
      const select = q<HTMLSelectElement>("inspector-path-mode");
      select.value = "loop"; select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(pathIssue(onChange.mock.calls[0]![0])).toBeNull();
    await act(async () => q("inspector-path-ellipse-apply").click());
    expect(onChange.mock.lastCall![0]).toMatchObject({ mode: "loop", autostart: false });
    await type(q("inspector-path-ellipse-rx"), "0");
    await act(async () => q("inspector-path-ellipse-apply").click());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("raios inteiros");
  });

  it("does not allow incompatible targets to mutate a path", async () => {
    const onChange = vi.fn();
    await render(<ObjectPathSection contextKey="snes/main/goal" path={defaultPath()} fps={60} blockedReason="Sem execução SNES" onChange={onChange} />);
    expect(q<HTMLSelectElement>("inspector-path-mode").disabled).toBe(true);
    expect(q("inspector-path-x-1").disabled).toBe(true);
    expect(q<HTMLButtonElement>("inspector-path-ellipse-apply").disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
