import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STUDIO_THEME, getStudioThemeVariables, loadStudioTheme, normalizeStudioTheme, saveStudioTheme, STUDIO_THEMES } from "./studioAppearance";

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("studio appearance preferences", () => {
  it("remembers a choice and rejects unknown or missing preferences", () => {
    expect(saveStudioTheme("mega-drive-night")).toBe(true);
    expect(loadStudioTheme()).toBe("mega-drive-night");
    expect(normalizeStudioTheme("unrecognized")).toBe(DEFAULT_STUDIO_THEME);
    expect(normalizeStudioTheme(null)).toBe(DEFAULT_STUDIO_THEME);
  });

  it("keeps the editor usable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("unavailable"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(loadStudioTheme()).toBe(DEFAULT_STUDIO_THEME);
    expect(saveStudioTheme("mega-drive-16bit")).toBe(false);
  });

  it("migrates the previous four theme choices without leaving an unknown palette", () => {
    expect(normalizeStudioTheme("super-16")).toBe("super-nintendo");
    expect(normalizeStudioTheme("mega-drive")).toBe("mega-drive-night");
    expect(normalizeStudioTheme("portable")).toBe("super-famicom");
    expect(normalizeStudioTheme("arcade")).toBe("mega-drive-16bit");
    expect(STUDIO_THEMES.filter(t => t.scheme === "light").map(t => t.id)).toEqual(["super-nintendo", "super-famicom"]);
  });

  it("keeps normal text readable and workspace colors distinct from their panels in every theme", () => {
    for (const theme of STUDIO_THEMES) {
      for (const background of [theme.base, theme.panel, theme.elevated]) {
        for (const foreground of [theme.text, theme.muted]) {
          expect(contrast(foreground, background), `${theme.id}: ${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(theme.onPrimary, theme.primary), theme.id).toBeGreaterThanOrEqual(4.5);
      for (const color of theme.colors) expect(contrast(color, theme.panel), theme.id).toBeGreaterThanOrEqual(3);
      const tokens = getStudioThemeVariables(theme.id);
      expect(tokens["--rds-status-error"]).not.toEqual(tokens["--rds-status-success"]);
    }
  });
});
