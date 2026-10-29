/** Editor appearance only; project palettes and runtime pixels are separate. */
export const STUDIO_THEMES = [
  { id: "super-16", label: "Super 16", description: "Roxo profundo e os quatro botões coloridos da era 16-bit.",
    base: "#131320", panel: "#202035", elevated: "#2c2b46", border: "#565272", text: "#f3efff", muted: "#bdb6d5", accent: "#c4a7ff", primary: "#6944ad",
    colors: ["#80c7ff", "#83dfa3", "#f5ce76", "#c4a7ff", "#f2a3cf", "#72dfd6", "#ffa990"] },
  { id: "mega-drive", label: "Mega Drive", description: "Carvão, azul elétrico e detalhes vermelhos de um console clássico.",
    base: "#0d1522", panel: "#17263a", elevated: "#23374e", border: "#456079", text: "#edf6ff", muted: "#adbed2", accent: "#74ccff", primary: "#1b5ba8",
    colors: ["#74ccff", "#91dfb1", "#f4cf80", "#b8b0ff", "#f5a6b6", "#70dcd9", "#ffad93"] },
  { id: "portable", label: "Portátil", description: "Verde fósforo, oliva e âmbar, como nos primeiros portáteis.",
    base: "#121a14", panel: "#202c22", elevated: "#2d3c2c", border: "#526a49", text: "#eff6dc", muted: "#bfcdab", accent: "#c3df88", primary: "#44652d",
    colors: ["#b5dcb0", "#c3df88", "#efd28a", "#cfbfef", "#edb6b2", "#9cdbca", "#f3bc89"] },
  { id: "arcade", label: "Arcade", description: "Azul noturno, ciano e magenta dos salões de fliperama.",
    base: "#151022", panel: "#261c39", elevated: "#36284d", border: "#6c4e83", text: "#faf0ff", muted: "#cfb8de", accent: "#f5a2e5", primary: "#8a357c",
    colors: ["#7cdbff", "#8de6be", "#ffce83", "#cfb0ff", "#f5a2e5", "#74e3d9", "#ffacb1"] },
] as const;

export type StudioThemeId = typeof STUDIO_THEMES[number]["id"];
export const DEFAULT_STUDIO_THEME: StudioThemeId = "super-16";
const THEME_KEY = "retrodev-studio-theme";

export function normalizeStudioTheme(value: string | null): StudioThemeId {
  return STUDIO_THEMES.find((theme) => theme.id === value)?.id ?? DEFAULT_STUDIO_THEME;
}

export function loadStudioTheme(): StudioThemeId {
  try { return normalizeStudioTheme(localStorage.getItem(THEME_KEY)); }
  catch { return DEFAULT_STUDIO_THEME; }
}

export function saveStudioTheme(id: StudioThemeId): boolean {
  try { localStorage.setItem(THEME_KEY, id); return true; }
  catch { return false; }
}

export function getStudioThemeVariables(id: StudioThemeId): Record<string, string> {
  const t = STUDIO_THEMES.find((theme) => theme.id === id) ?? STUDIO_THEMES[0];
  const mix = (amount: number, base: string = t.panel) => `color-mix(in srgb, ${t.accent} ${amount}%, ${base})`;
  return {
    "--rds-surface-canvas": t.base, "--rds-surface-base": t.base,
    "--rds-surface-panel": t.panel, "--rds-surface-panel-strong": t.base,
    "--rds-surface-elevated": t.elevated, "--rds-surface-overlay": t.panel,
    "--rds-surface-input": t.base, "--rds-surface-disabled": t.elevated,
    "--rds-surface-hover": mix(12), "--rds-surface-active": mix(22),
    "--rds-border-subtle": mix(25), "--rds-border-default": t.border,
    "--rds-border-strong": t.muted, "--rds-text-primary": t.text,
    "--rds-text-secondary": t.text, "--rds-text-muted": t.muted,
    "--rds-text-placeholder": t.muted, "--rds-text-disabled": t.muted,
    "--rds-action-primary": t.primary, "--rds-action-primary-hover": mix(8, t.primary),
    "--rds-action-primary-active": mix(12, t.primary), "--rds-action-primary-text": "#ffffff",
    "--rds-action-secondary": t.elevated, "--rds-action-secondary-hover": mix(15),
    "--rds-action-secondary-active": mix(24), "--rds-action-secondary-text": t.text,
    "--rds-action-ghost-hover": mix(12), "--rds-action-ghost-active": mix(20),
    "--rds-action-ghost-text": t.text, "--rds-focus-ring": t.accent,
    "--rds-studio-accent": t.accent,
    ...Object.fromEntries(["scene", "game", "explorer", "logic", "artstudio", "retrofx", "debug"]
      .map((workspace, index) => [`--rds-workspace-${workspace}`, t.colors[index]])),
  };
}

export function applyStudioTheme(id: StudioThemeId): void {
  document.documentElement.dataset.studioTheme = id;
  for (const [key, value] of Object.entries(getStudioThemeVariables(id))) {
    document.documentElement.style.setProperty(key, value);
  }
}
