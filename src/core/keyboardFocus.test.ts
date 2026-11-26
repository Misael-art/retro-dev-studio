import { describe, expect, it } from "vitest";

import { gameMayTakeKeyDown, isEditableTarget } from "./keyboardFocus";

describe("keyboard focus", () => {
  it("keys typed into fields never go to the game", () => {
    for (const tag of ["input", "textarea", "select"]) {
      const el = document.createElement(tag);
      expect(isEditableTarget(el)).toBe(true);
      expect(gameMayTakeKeyDown({ target: el })).toBe(false);
    }
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(gameMayTakeKeyDown({ target: editable })).toBe(false);
  });
  it("keys on the canvas or body go to the game", () => {
    expect(gameMayTakeKeyDown({ target: document.createElement("canvas") })).toBe(true);
    expect(gameMayTakeKeyDown({ target: document.body })).toBe(true);
    expect(gameMayTakeKeyDown({ target: null })).toBe(true);
  });
  it("keeps activation keys on focused game toolbar controls", () => {
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    button.append(icon);
    expect(gameMayTakeKeyDown({ target: button })).toBe(false);
    expect(gameMayTakeKeyDown({ target: icon })).toBe(false);
    expect(gameMayTakeKeyDown({ target: document.createElement("summary") })).toBe(false);
  });
});
