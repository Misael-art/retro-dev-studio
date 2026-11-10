import { useState } from "react";

import { renameProjectAsset } from "../../core/projectFileOps";

/**
 * Mover/renomear o arquivo de arte (Experimental, REQ-03): atualiza todas as referências exatas em
 * cenas, modelos e grafos numa transação com cópia de segurança. Diferente de “duplicar” (cópia nova)
 * e de reimportar (novo conteúdo): a identidade do recurso continua a mesma, só o caminho muda.
 */
export default function AssetRenameControl({ asset }: { asset: string }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(asset);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="inspector-asset-rename"
        onClick={() => {
          setTarget(asset);
          setResult(null);
          setOpen(true);
        }}
        className="rounded border border-[#45475a] px-2 py-0.5 text-[9px] text-[#cdd6f4] hover:bg-[#45475a]/30"
        title="Mover ou renomear o arquivo de arte atualizando todas as referências"
      >
        Mover/renomear arte…
      </button>
    );
  }
  return (
    <div data-testid="inspector-asset-rename-form" className="mt-1 w-full space-y-1 rounded border border-[#45475a] p-1 text-[9px]">
      <label className="flex flex-col">
        Novo caminho (dentro de assets/)
        <input
          data-testid="inspector-asset-rename-input"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
        />
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          data-testid="inspector-asset-rename-confirm"
          disabled={busy || target.trim() === asset}
          onClick={async () => {
            setBusy(true);
            const outcome = await renameProjectAsset(asset, target.trim());
            setBusy(false);
            if (outcome.ok) {
              const refs = outcome.report.updated.reduce((n, [, c]) => n + c, 0);
              setResult({ ok: true, text: `Movido. ${refs} referência(s) em ${outcome.report.updated.length} arquivo(s) atualizada(s). Cópia ${outcome.report.backup.id}.` });
              setOpen(false);
            } else {
              setResult({ ok: false, text: outcome.message });
            }
          }}
          className="rounded border border-[#a6e3a1]/60 px-2 text-[#a6e3a1] disabled:opacity-40"
        >
          {busy ? "Movendo…" : "Mover"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-[#45475a] px-2">
          Cancelar
        </button>
      </div>
      {result ? (
        <p role={result.ok ? "status" : "alert"} data-testid="inspector-asset-rename-result" className={result.ok ? "text-[#a6e3a1]" : "text-[#f38ba8]"}>
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
