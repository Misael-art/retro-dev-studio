import { usePalettePlanStore } from "../../core/palettePlanStore";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "../common/Dialog";

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
  const project = useEditorStore((s) => s.activeProjectDir);
  const session = useEditorStore((s) => s.projectSessionId);
  const revision = useEditorStore((s) => s.sceneRevision);
  const target = useEditorStore((s) => s.activeTarget);
  const artifact = useEditorStore((s) => s.lastBuildSourceMap?.artifact);
  const builtArtifact = useEditorStore((s) => s.lastBuildArtifact);
  const codeRevision = useEditorStore((s) => s.nativeCodeRevision);
  // Remount synchronously: a new build/revision can never reuse an old verification.
  const identity = JSON.stringify([project, session, revision, target, artifact?.path, artifact?.sha256, builtArtifact, codeRevision]);
  return <DeliveryReview key={identity} onClose={onClose} />;
}

function DeliveryReview({ onClose }: { onClose: () => void }) {
  const activeScene = useEditorStore((state) => state.activeScene);
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const sceneRevision = useEditorStore((state) => state.sceneRevision);
  const lastBuildSceneRevision = useEditorStore((state) => state.lastBuildSceneRevision);
  const sourceMap = useEditorStore((state) => state.lastBuildSourceMap);
  const builtArtifact = useEditorStore((state) => state.lastBuildArtifact);
  const codeRevision = useEditorStore((state) => state.nativeCodeRevision);
  const nativeBuild = builtArtifact?.nativeCodeRevision != null;
  const runningRom = useEditorStore((state) => state.emulatorRomIdentity?.sha256 ?? null);
  const testedBuild = useEditorStore((state) => state.lastBuildTest);
  const activeTarget = useEditorStore((state) => state.activeTarget);
  const openStudioEditor = useEditorStore((state) => state.openStudioEditor);
  const logMessage = useEditorStore((state) => state.logMessage);
  const [reviewSeq, setReviewSeq] = useState(0);
  const [references, setReferences] = useState<AuditedReference[]>([]);
  const [auditStatus, setAuditStatus] = useState<"pending" | "ready" | "failed">("pending");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!activeProjectDir) return;
    let cancelled = false;
    setAuditStatus("pending");
    // Auditoria de arquivos no disco (o que o build vai ler); cancelada se a revisão for refeita.
    void Promise.resolve(auditProjectPaths(activeProjectDir))
      .then((refs) => {
        if (!Array.isArray(refs)) throw new Error("A auditoria de arquivos não retornou um resultado válido.");
        if (!cancelled) {
          setReferences(refs);
          setAuditStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setAuditStatus("failed");
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
  const review = useMemo(() => nativeBuild
    ? { errors: 0, warnings: 0, passed: 0, items: [] }
    : reviewProject(activeScene, references, palettePlan), [activeScene, references, palettePlan, nativeBuild]);
  const [mastering, setMastering] = useState<RomMasteringReport | null>(null);
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"verify" | "export" | null>(null);
  const operationRef = useRef(false);
  const romPath = builtArtifact?.path ?? sourceMap?.artifact.path ?? null;
  const romSha = builtArtifact?.sha256 ?? sourceMap?.artifact.sha256 ?? null;
  const freshness = describeBuildFreshness({
    sceneRevision,
    lastBuildSceneRevision,
    builtRomSha256: romSha,
    runningRomSha256: runningRom,
    testedBuild,
    nativeCode: nativeBuild ? { revision: codeRevision, builtRevision: builtArtifact.nativeCodeRevision! } : null,
  });
  // A ROM só representa o projeto se foi gerada a partir da revisão atual da cena.
  const stale = nativeBuild ? codeRevision !== builtArtifact.nativeCodeRevision
    : lastBuildSceneRevision === null || sceneRevision !== lastBuildSceneRevision;
  const exportBlockedReason =
    !activeProjectDir ? "Abra um projeto para exportar"
    : busy ? "Aguarde a operação atual"
    : auditStatus !== "ready" ? "Verifique os arquivos do projeto antes de exportar"
    : review.errors > 0
      ? `Resolva ${review.errors} erro(s) para exportar`
      : stale || !romPath || !romSha
        ? "Compile o projeto atual antes de exportar"
        : !mastering || mastering.sha256 !== romSha
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
    if (!romPath || !romSha || operationRef.current) return;
    operationRef.current = true;
    setBusy("verify");
    setError(null);
    setMastering(null);
    setExported(null);
    try {
      const report = await inspectRomMastering(romPath);
      if (!alive.current) return;
      if (report.sha256 !== romSha) throw new Error("A ROM no disco mudou desde o build. Compile e teste novamente antes de exportar.");
      setMastering(report);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      operationRef.current = false;
      if (alive.current) setBusy(null);
    }
  }

  async function exportRom() {
    if (!romPath || !romSha || !activeProjectDir || exportBlockedReason || operationRef.current) return;
    operationRef.current = true;
    setBusy("export");
    setError(null);
    try {
      const result = await invoke<ExportResult>("export_game_rom", {
        projectDir: activeProjectDir,
        romPath,
        expectedSha256: romSha,
      });
      if (!alive.current) return;
      if (result.sha256 !== romSha) throw new Error("A exportação retornou uma ROM diferente da ROM verificada.");
      setExported(result);
      logMessage("success", `[Entrega] ROM exportada: ${result.path} (${result.sha256.slice(0, 12)}…)`);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      operationRef.current = false;
      if (alive.current) setBusy(null);
    }
  }

  return (
    <Dialog open title="Revisar projeto" description="Experimental · confira o projeto, a revisão e a ROM antes de exportar."
      onClose={onClose} portal={false} testId="delivery-panel" closeTestId="delivery-close"
      className="!w-[min(768px,calc(100vw-24px))] text-[11px] text-[#cdd6f4]">
      <div className="flex flex-col">
        <header className="flex items-center gap-2 border-b border-[#313244] px-4 py-2">
          <span data-testid="delivery-freshness" data-kind={freshness.kind} data-tested-rom-sha={testedBuild?.romSha256 ?? ""}
            data-tested-revision={testedBuild?.sceneRevision ?? ""} className="ml-auto text-[10px] text-[#fbbf24]">
            {freshness.label}
          </span>
        </header>
        <p role="status" data-testid="delivery-audit-status" className="px-4 py-2 text-[#a6adc8]">
          {auditStatus === "pending" ? "Verificando arquivos do projeto…" : auditStatus === "failed" ? "Falha ao verificar arquivos. Use Verificar novamente para tentar de novo." : "Arquivos do projeto verificados."}
        </p>
        {nativeBuild ? <p data-testid="delivery-native-scope" className="px-4 py-2 text-[#fbbf24]">
          Build C original: a cena é referência e não representa o jogo. A verificação abaixo cobre identidade e formato da ROM,
          não a lógica C nem alterações externas desde o build. Recompile após editar arquivos fora do Studio.
        </p> : null}
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
          {review.items.length === 0 ? <li className="text-[#a6e3a1]">{nativeBuild ? "Validação de cenas/nodes do Studio não se aplica à ROM compilada do C original." : "Nenhum problema encontrado nas verificações desta versão."}</li> : null}
        </ul>
        <footer className="space-y-1 border-t border-[#313244] px-4 py-2">
          <p className="text-[#a6adc8]">
            Destino: {activeTarget === "snes" ? "SNES (ROM PVSnesLib)" : "Mega Drive (ROM SGDK)"} · Revisão {lastBuildSceneRevision ?? "—"} · ROM do último build:{" "}
            <span className="font-mono" data-testid="delivery-rom-sha" title={romSha ?? undefined}>{romSha ? `${romSha.slice(0, 12)}…` : "nenhuma"}</span>
            {mastering ? (
              <span data-testid="delivery-mastering" data-blockers={mastering.blockers.length}>
                {" "}· checksum {mastering.checksum.status} · {mastering.blockers.length} bloqueio(s)
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid="delivery-recheck" disabled={Boolean(busy)} onClick={() => setReviewSeq((v) => v + 1)} className="rounded border border-[#334155] px-2 py-0.5">
              Verificar novamente
            </button>
            <button type="button" data-testid="delivery-verify-rom" disabled={!romPath || stale || Boolean(busy)} onClick={() => void verifyRom()} className="rounded border border-[#334155] px-2 py-0.5 disabled:opacity-40">
              {busy === "verify" ? "Verificando ROM…" : "Verificar ROM no destino"}
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
            <p data-testid="delivery-exported" data-path={exported.path} data-sha256={exported.sha256} className="break-all text-[#a6e3a1]">
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
    </Dialog>
  );
}
