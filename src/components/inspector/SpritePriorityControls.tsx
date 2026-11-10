/** Composition values consumed by AST/emitters; a closed choice, never arbitrary text. */
export function SpritePriorityControls({ value, target, disabled = false, onChange }: {
  value: string; target: string; disabled?: boolean; onChange: (value: "foreground" | "background") => void;
}) {
  const supported = target === "megadrive" || target === "snes";
  const valid = value === "foreground" || value === "background";
  return <div className="space-y-1 p-2 text-[11px] text-[#cdd6f4]" data-testid="sprite-priority-controls">
    <label className="flex flex-wrap items-center gap-2">
      Prioridade do sprite
      <select data-testid="inspector-prop-priority-input" aria-label="Prioridade do sprite" value={value}
        disabled={disabled || !supported}
        onChange={(event) => {
          if (event.target.value === "foreground" || event.target.value === "background") onChange(event.target.value);
        }} className="min-w-0 max-w-full rounded border border-[#45475a] bg-[#1e1e2e] px-2 py-1">
        {!valid ? <option value={value}>Valor legado inválido: {value || "vazio"}</option> : null}
        <option value="foreground">Alta · à frente dos planos</option>
        <option value="background">Baixa · atrás de tiles altos</option>
      </select>
    </label>
    {!valid ? <p role="alert" className="text-[#f38ba8]">Escolha uma prioridade válida antes de construir.</p> : null}
    <p className="text-[#a6adc8]">{!supported ? "Sem adaptador de prioridade nesta plataforma."
      : target === "megadrive" ? "Fundo → B baixo → A baixo → sprite baixo → B alto → A alto → sprite alto. Só pixels opacos encobrem."
        : "SNES: baixa usa OBJ0; alta usa OBJ3. A relação com os BGs depende do modo da cena."}</p>
    <p className="text-[#a6adc8]">Aplica ao sprite inteiro; não recorta pixels nem altera colisão.</p>
  </div>;
}
