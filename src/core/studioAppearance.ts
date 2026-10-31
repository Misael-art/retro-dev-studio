/** Editor appearance only; project palettes and runtime pixels are separate. */
export const STUDIO_THEMES = [
  { id: "super-nintendo", label: "Super Nintendo", description: "Claro · branco gelo, cinza e os botões roxo e lilás.", scheme: "light",
    base: "#e8e7ee", panel: "#f6f5f9", elevated: "#dcd9e6", border: "#827890", text: "#292335", muted: "#5d536c", accent: "#654492", primary: "#654492", onPrimary: "#ffffff",
    hardware: ["#efedf3", "#c7c3d0", "#6e509c", "#b3a2d0"],
    colors: ["#60438a", "#624292", "#74617f", "#69488d", "#80589d", "#615277", "#745074"] },
  { id: "super-famicom", label: "Super Famicom", description: "Claro · cinza suave com vermelho, azul, amarelo e verde.", scheme: "light",
    base: "#e5e7e7", panel: "#f6f7f6", elevated: "#d7dcdb", border: "#78817f", text: "#232b2a", muted: "#505e5a", accent: "#205e9b", primary: "#205e9b", onPrimary: "#ffffff",
    hardware: ["#d43738", "#2868bc", "#e5bd31", "#2d9661"],
    colors: ["#245f9c", "#247447", "#806217", "#9b3437", "#785290", "#24706c", "#9b4141"] },
  { id: "mega-drive-night", label: "Mega Drive Night", description: "Escuro · preto, branco e cinza, como a carcaça do Mega Drive.", scheme: "dark",
    base: "#101113", panel: "#1b1d20", elevated: "#303338", border: "#777b82", text: "#f4f4f3", muted: "#c3c5c8", accent: "#ebebe9", primary: "#e4e4e1", onPrimary: "#17181a",
    hardware: ["#0f1012", "#373a3f", "#aaaeb3", "#f1f1ef"],
    colors: ["#e0e1e2", "#f4f4f2", "#c4c6ca", "#dadbde", "#ebe9e6", "#bfc4c9", "#e4e3e2"] },
  { id: "mega-drive-16bit", label: "Mega Drive 16-bit", description: "Escuro · preto e prata com o detalhe dourado dos 16 bits.", scheme: "dark",
    base: "#151411", panel: "#24221e", elevated: "#36332b", border: "#81775f", text: "#f5f1e7", muted: "#cdc3af", accent: "#dfc386", primary: "#d7b976", onPrimary: "#201a10",
    hardware: ["#151412", "#5b554a", "#b7b5af", "#d4b36b"],
    colors: ["#dfc386", "#eee2bf", "#d4ba7e", "#c9bd9e", "#e5d9b7", "#c8c4b6", "#e6c59e"] },
] as const;

export type StudioThemeId = typeof STUDIO_THEMES[number]["id"];
export const DEFAULT_STUDIO_THEME: StudioThemeId = "super-nintendo";
const THEME_KEY = "retrodev-studio-theme";

export function normalizeStudioTheme(value: string | null): StudioThemeId {
  const legacy: Record<string, StudioThemeId> = { "super-16": "super-nintendo", "mega-drive": "mega-drive-night", portable: "super-famicom", arcade: "mega-drive-16bit" };
  return STUDIO_THEMES.find((theme) => theme.id === value)?.id ?? legacy[value ?? ""] ?? DEFAULT_STUDIO_THEME;
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
    "--rds-action-primary-active": mix(12, t.primary), "--rds-action-primary-text": t.onPrimary,
    "--rds-action-secondary": t.elevated, "--rds-action-secondary-hover": mix(15),
    "--rds-action-secondary-active": mix(24), "--rds-action-secondary-text": t.text,
    "--rds-action-ghost-hover": mix(12), "--rds-action-ghost-active": mix(20),
    "--rds-action-ghost-text": t.text, "--rds-focus-ring": t.accent,
    "--rds-studio-accent": t.accent, "--rds-text-on-selection": "#24232a",
    "--rds-selection-fill": t.scheme === "light" ? t.elevated : t.accent,
    "--rds-status-error": t.scheme === "light" ? "#b21d3d" : "#fb7185",
    "--rds-status-warning": t.scheme === "light" ? "#835e0c" : "#fbbf24",
    "--rds-status-success": t.scheme === "light" ? "#247245" : "#4ade80",
    "--rds-status-success-hover": t.scheme === "light" ? "#185b33" : "#22c55e",
    "--rds-status-success-text": t.scheme === "light" ? "#ffffff" : "#10251a",
    "--rds-status-info": t.scheme === "light" ? "#225c92" : "#7dd3fc",
    ...Object.fromEntries(["scene", "game", "explorer", "logic", "artstudio", "retrofx", "debug"]
      .map((workspace, index) => [`--rds-workspace-${workspace}`, t.colors[index]])),
  };
}

export function applyStudioTheme(id: StudioThemeId): void {
  const theme = STUDIO_THEMES.find(t => t.id === id) ?? STUDIO_THEMES[0];
  document.documentElement.dataset.studioTheme = id;
  document.documentElement.dataset.theme = theme.scheme;
  for (const [key, value] of Object.entries(getStudioThemeVariables(id))) {
    document.documentElement.style.setProperty(key, value);
  }
}
