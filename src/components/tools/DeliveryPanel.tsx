import { usePalettePlanStore } from "../../core/palettePlanStore";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";

import { describeBuildFreshness } from "../../core/buildFreshness";
import { inspectRomMastering } from "../../core/ipc/projectCapabilityService";
import type { RomMasteringReport } from "../../core/projectCapability";
import { reviewProject, type AuditedReference, type ReviewItem } from "../../core/projectReview";
import { auditProjectPaths } from "../../core/projectFileOps";
import { useEditorStore } from "../../core/store/editorStore";

type ExportResult = { path: string; sha256: string; report: RomMasteringReport };

/**
 * Entrega (Experimental): revisa o projeto com problemas navegáveis, confere a ROM do último build
 * no destino (mastering) e exporta só quando não há erro real e a ROM é a da revisão atual.
 */
export default function DeliveryPanel({ onClose }: { onClose: () => void }) {
  const activeScene = useEditorStore((state) => state.activeScene);
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const sceneRevision = useEditorStore((state) => state.sceneRevision);
  const lastBuildSceneRevision = useEditorStore((state) => state.lastBuildSceneRevision);
  const sourceMap = useEditorStore((state) => state.lastBuildSourceMap);
  const runningRom = useEditorStore((state) => state.emulatorRomIdentity?.sha256 ?? null);
  const openStudioEditor = useEditorStore((state) => state.openStudioEditor);
  const logMessage = useEditorStore((state) => state.logMessage);
  const [reviewSeq, setReviewSeq] = useState(0);
  const [references, setReferences] = useState<AuditedReference[]>([]);
  useEffect(() => {
    if (!activeProjectDir) return;
    let cancelled = false;
    // Auditoria de arquivos no disco (o que o build vai ler); cancelada se a revisão for refeita.
    void Promise.resolve(auditProjectPaths(activeProjectDir))
      .then((refs) => {
        if (!cancelled) setReferences(Array.isArray(refs) ? refs : []);
      })
      .catch(() => {
        if (!cancelled) setReferences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectDir, reviewSeq]);
  const palettePlan = usePalettePlanStore((s) => s.plan);
  const refreshPalettePlan = usePalettePlanStore((s) => s.refresh);
  useEffect(() => {
    void refreshPalettePlan();
  }, [activeScene, refreshPalettePlan]);
  const review = useMemo(() => reviewProject(activeScene, references, palettePlan), [activeScene, references, palettePlan]);
  const [mastering, setMastering] = useState<RomMasteringReport | null>(null);
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const romPath = sourceMap?.artifact.path ?? null;
  const romSha = sourceMap?.artifact.sha256 ?? null;
  const freshness = describeBuildFreshness({
    sceneRevision,
    lastBuildSceneRevision,
    builtRomSha256: romSha,
    runningRomSha256: runningRom,
  });
  // A ROM só representa o projeto se foi gerada a partir da revisão atual da cena.
  const stale = lastBuildSceneRevision === null || sceneRevision !== lastBuildSceneRevision;
  const exportBlockedReason =
    review.errors > 0
      ? `Resolva ${review.errors} erro(s) para exportar`
      : stale || !romPath || !romSha
        ? "Compile o projeto atual antes de exportar"
        : !mastering
          ? "Verifique a ROM no destino antes de exportar"
          : mastering.blockers.length > 0
            ? "A ROM tem bloqueios de destino"
            : null;

  function open(item: ReviewItem) {
    const { property, ...focus } = item.target;
    openStudioEditor({ focus });
    onClose();
    if (property === "hud") {
      // O Inspector monta depois da navegação: tenta focar a propriedade por até ~1 s.
      let tries = 0;
      const focusProperty = () => {
        const field = document.querySelector('[data-testid="inspector-hud-column"]') as HTMLElement | null;
        if (field) field.focus();
        else if (++tries < 20) window.setTimeout(focusProperty, 50);
      };
      window.setTimeout(focusProperty, 0);
    }
  }

  async function verifyRom() {
    if (!romPath) return;
    setError(null);
    try {
      setMastering(await inspectRomMastering(romPath));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function exportRom() {
    if (!romPath || !romSha || !activeProjectDir) return;
    setError(null);
    try {
      const result = await invoke<ExportResult>("export_game_rom", {
        projectDir: activeProjectDir,
        romPath,
        expectedSha256: romSha,
      });
      setExported(result);
      logMessage("success", `[Entrega] ROM exportada: ${result.path} (${result.sha256.slice(0, 12)}…)`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div role="dialog" aria-label="Revisar projeto" data-testid="delivery-panel" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#313244] bg-[#0b1120] text-[11px] text-[#cdd6f4]">
        <header className="flex items-center gap-2 border-b border-[#313244] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Revisar projeto</h2>
          <span className="rounded bg-[#1e293b] px-1 text-[9px] uppercase text-[#94a3b8]">Experimental</span>
          <span data-testid="delivery-freshness" data-kind={freshness.kind} className="ml-auto text-[10px] text-[#fbbf24]">
            {freshness.label}
          </span>
          <button type="button" data-testid="delivery-close" onClick={onClose} aria-label="Fechar" className="rounded border border-[#334155] px-2">
            ✕
          </button>
        </header>
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          <div data-testid="delivery-errors" data-count={review.errors} className="rounded border border-[#f38ba8]/50 p-2">
            <p className="text-base font-semibold text-[#f38ba8]">✖ {review.errors} erro(s)</p>
            <p className="text-[#a6adc8]">Impedem a exportação</p>
          </div>
          <div data-testid="delivery-warnings" data-count={review.warnings} className="rounded border border-[#fbbf24]/50 p-2">
            <p className="text-base font-semibold text-[#fbbf24]">⚠ {review.warnings} aviso(s)</p>
            <p className="text-[#a6adc8]">Recomendado corrigir</p>
          </div>
          <div data-testid="delivery-passed" data-count={review.passed} className="rounded border border-[#a6e3a1]/50 p-2">
            <p className="text-base font-semibold text-[#a6e3a1]">✓ {review.passed} verificação(ões) OK</p>
          </div>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4" data-testid="delivery-items">
          {review.items.map((item, index) => (
            <li
              key={item.id}
              data-testid={`delivery-item-${index}`}
              data-severity={item.severity}
              className={`rounded border p-2 ${item.severity === "error" ? "border-[#f38ba8]/60" : "border-[#fbbf24]/60"}`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden="true">{item.severity === "error" ? "✖" : "⚠"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="sr-only">{item.severity === "error" ? "Erro: " : "Aviso: "}</span>
                    {item.title}
                  </p>
                  <p>{item.detail}</p>
                  <p className="text-[#a6adc8]">{item.consequence}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {item.chips.map((chip) => (
                      <span key={chip} className="rounded-full border border-[#334155] px-1.5 text-[9px]">
                        {chip}
                      </span>
                    ))}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`delivery-open-${index}`}
                  onClick={() => open(item)}
                  className="rounded border border-[#89b4fa]/60 px-2 py-0.5 text-[#89b4fa]"
                >
                  {item.action}
                </button>
              </div>
            </li>
          ))}
          {review.items.length === 0 ? <li className="text-[#a6e3a1]">Nenhum problema encontrado nas verificações desta versão.</li> : null}
        </ul>
        <footer className="space-y-1 border-t border-[#313244] px-4 py-2">
          <p className="text-[#a6adc8]">
            Destino: Mega Drive (ROM SGDK) · ROM do último build:{" "}
            <span className="font-mono" data-testid="delivery-rom-sha">{romSha ? `${romSha.slice(0, 12)}…` : "nenhuma"}</span>
            {mastering ? (
              <span data-testid="delivery-mastering" data-blockers={mastering.blockers.length}>
                {" "}· checksum {mastering.checksum.status} · {mastering.blockers.length} bloqueio(s)
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" data-testid="delivery-recheck" onClick={() => setReviewSeq((v) => v + 1)} className="rounded border border-[#334155] px-2 py-0.5">
              Verificar novamente
            </button>
            <button type="button" data-testid="delivery-verify-rom" disabled={!romPath} onClick={() => void verifyRom()} className="rounded border border-[#334155] px-2 py-0.5 disabled:opacity-40">
              Verificar ROM no destino
            </button>
            <button
              type="button"
              data-testid="delivery-export"
              disabled={Boolean(exportBlockedReason)}
              title={exportBlockedReason ?? "Copiar a ROM revisada para a pasta export/ do projeto"}
              onClick={() => void exportRom()}
              className="ml-auto rounded border border-[#a6e3a1]/60 px-3 py-0.5 text-[#a6e3a1] disabled:opacity-40"
            >
              {exportBlockedReason ?? "Exportar"}
            </button>
          </div>
          {exported ? (
            <p data-testid="delivery-exported" className="text-[#a6e3a1]">
              Exportado: <span className="font-mono">{exported.path}</span> ({exported.sha256.slice(0, 12)}…)
            </p>
          ) : null}
          {error ? (
            <p role="alert" data-testid="delivery-error" className="text-[#f38ba8]">
              {error}
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
