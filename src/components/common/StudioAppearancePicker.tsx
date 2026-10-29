import { useLayoutEffect, useState } from "react";
import { applyStudioTheme, loadStudioTheme, saveStudioTheme, STUDIO_THEMES, type StudioThemeId } from "../../core/studioAppearance";
import Dialog from "./Dialog";
import Icon from "./Icon";

export default function StudioAppearancePicker() {
  const [theme, setTheme] = useState<StudioThemeId>(loadStudioTheme);
  const [open, setOpen] = useState(false);
  const [sessionOnly, setSessionOnly] = useState(false);
  useLayoutEffect(() => { applyStudioTheme(theme); }, [theme]);

  function choose(id: StudioThemeId) {
    setTheme(id);
    setSessionOnly(!saveStudioTheme(id));
  }

  return <>
    <button type="button" data-testid="studio-theme-open" aria-label="Alterar tema de cores"
      title="Cores do estúdio" onClick={() => setOpen(true)} className="rds-theme-trigger">
      <Icon name="palette" size={17} /> Tema
    </button>
    <Dialog open={open} title="Cores do estúdio" description="Personalize os painéis e as ferramentas com cores da era dos consoles retrô."
      onClose={() => setOpen(false)} className="!w-[min(640px,calc(100vw-24px))]">
      <fieldset className="rds-theme-options" data-testid="studio-theme-options">
        <legend className="sr-only">Temas disponíveis</legend>
        {STUDIO_THEMES.map((option) => <label key={option.id} className="rds-theme-card" style={{ borderColor: option.id === theme ? option.accent : undefined }}>
          <input type="radio" name="studio-theme" value={option.id} checked={theme === option.id}
            data-testid={`studio-theme-${option.id}`} onChange={() => choose(option.id)} />
          <span className="rds-theme-preview" aria-hidden="true" style={{ background: option.base }}>
            <span style={{ background: option.elevated }} />
            {option.colors.slice(0, 4).map((color) => <i key={color} style={{ background: color }} />)}
          </span>
          <span className="rds-theme-name">{option.label}</span>
          <span className="rds-theme-description">{option.description}</span>
        </label>)}
      </fieldset>
      <p role="status" className="mt-3 text-xs text-[var(--rds-text-muted)]">
        {sessionOnly ? "Tema aplicado nesta sessão. Não foi possível guardar a preferência neste dispositivo." : "A escolha aparece na hora e será lembrada na próxima abertura."}
      </p>
    </Dialog>
  </>;
}
