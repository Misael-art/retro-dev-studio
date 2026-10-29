import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioAppearancePicker from "./StudioAppearancePicker";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("studio appearance picker", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalStyle = document.documentElement.getAttribute("style");
  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<StudioAppearancePicker />));
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); localStorage.clear();
    delete document.documentElement.dataset.studioTheme;
    if (originalStyle === null) document.documentElement.removeAttribute("style");
    else document.documentElement.setAttribute("style", originalStyle);
  });

  function open() { act(() => container.querySelector<HTMLButtonElement>("button")!.click()); }

  it("applies the chosen theme immediately, persists it and restores focus on closing", () => {
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    trigger.focus(); open();
    act(() => document.querySelector<HTMLInputElement>('[data-testid="studio-theme-arcade"]')!.click());
    expect(document.documentElement.dataset.studioTheme).toBe("arcade");
    expect(localStorage.getItem("retrodev-studio-theme")).toBe("arcade");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("announces a session-only choice after a storage error and keeps the radio selected", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("unavailable"); });
    open();
    const option = document.querySelector<HTMLInputElement>('[data-testid="studio-theme-portable"]')!;
    act(() => option.click());
    expect(option.checked).toBe(true);
    expect(document.documentElement.dataset.studioTheme).toBe("portable");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("nesta sessão");
    expect(document.querySelector('[role="status"]')?.textContent).not.toContain("será lembrada");
  });
});
