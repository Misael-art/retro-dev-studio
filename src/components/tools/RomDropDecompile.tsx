import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import Dialog from "../common/Dialog";
import InspectionPanel from "./InspectionPanel";
import { CompressedResourcePanel } from "./CompressedResourcePanel";
import { useEditorStore } from "../../core/store/editorStore";
import { cancelRomInput, probeRomInput, resolveRomInput, decompileRomToSgdk, revealExtractionDir, type RomInputProbe, type RomInputResolved, type SgdkDecompileReport } from "../../core/ipc/toolsService";

export const ROM_DROP_PATTERN = /\.(md|bin|gen|smd|zip|7z)$/i;
const errorText = (e: unknown) => typeof e === "object" && e && "message" in e ? String(e.message) : String(e);
type Stage = "choose" | "verifying" | "members" | "extracting" | "catalog" | "error";

/** One input journey; discovery/editing remains owned by InspectionPanel. */
export default function RomDropDecompile() {
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<Stage>("choose");
  const [paths, setPaths] = useState<string[]>([]);
  const [probe, setProbe] = useState<RomInputProbe | null>(null);
  const [selected, setSelected] = useState("");
  const [resolved, setResolved] = useState<RomInputResolved | null>(null);
  const [error, setError] = useState("");
  const [inspectionBusy, setInspectionBusy] = useState(false);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [report, setReport] = useState<SgdkDecompileReport | null>(null);
  const active = useRef<string | null>(null);
  const visibleRef = useRef(false);
  const mounted = useRef(true);
  const busy = stage === "verifying" || stage === "extracting";
  const logMessage = useEditorStore(state => state.logMessage);
  const newRequest = () => `rom-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function extract(input: RomInputProbe, member: string) {
    const id = newRequest(); active.current = id; setStage("extracting");
    try {
      const next = await resolveRomInput(id, input.input_id, member);
      if (!mounted.current || active.current !== id) return;
      setResolved(next); setStage("catalog");
    } catch (e) { if (mounted.current && active.current === id) { setError(errorText(e)); setStage("error"); } }
    finally { if (active.current === id) active.current = null; }
  }
  async function prepare(path: string) {
    if (active.current) return;
    const id = newRequest(); active.current = id;
    setResourcesLoaded(false); setProbe(null); setResolved(null); setReport(null); setError(""); setSelected(""); setStage("verifying");
    try {
      const next = await probeRomInput(id, path);
      if (!mounted.current || active.current !== id) return;
      setProbe(next); active.current = null;
      if (next.members.length === 1) { setSelected(next.members[0].name); await extract(next, next.members[0].name); }
      else setStage("members");
    } catch (e) { if (mounted.current && active.current === id) { setError(errorText(e)); setStage("error"); } }
    finally { if (active.current === id) active.current = null; }
  }
  function showFiles(files: string[]) {
    if (visibleRef.current || active.current) return;
    visibleRef.current = true; setVisible(true); setPaths(files); setStage("choose"); setError(""); setResolved(null); setProbe(null); setReport(null);
    if (files.length === 1) void prepare(files[0]);
  }
  const chooseFile = useCallback(async () => {
    try {
      const path = await open({ multiple: false, directory: false, title: "Inspecionar ROM Mega Drive", filters: [{ name: "ROM Mega Drive ou compactado", extensions: ["md", "bin", "gen", "smd", "zip", "7z"] }] });
      if (typeof path === "string" && mounted.current) { setPaths([path]); void prepare(path); }
    } catch (e) { if (mounted.current) { setError(errorText(e)); setStage("error"); } }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let dispose: (() => void) | undefined; let cancelled = false;
    const request = () => { if (visibleRef.current) return; visibleRef.current = true; setVisible(true); setStage("choose"); setPaths([]); setError(""); setProbe(null); setResolved(null); setReport(null); void chooseFile(); };
    window.addEventListener("rds:choose-rom", request);
    if ("__TAURI_INTERNALS__" in window) void getCurrentWebviewWindow().onDragDropEvent(e => {
      if (e.payload.type === "drop") {
        const files = e.payload.paths.filter(p => ROM_DROP_PATTERN.test(p));
        if (files.length) { window.dispatchEvent(new Event("rds:rom-input-open")); showFiles(files); }
      }
    }).then(fn => { if (cancelled) fn(); else dispose = fn; }).catch(e => logMessage("warn", `Arraste de ROM indisponível: ${errorText(e)}. Use a entrada no início.`));
    return () => { mounted.current = false; cancelled = true; dispose?.(); window.removeEventListener("rds:choose-rom", request); if (active.current) void cancelRomInput(active.current); };
  }, [chooseFile, logMessage]);
  async function cancel() {
    const id = active.current;
    if (!id) return;
    try { await cancelRomInput(id); } catch (e) { setError(`Não foi possível confirmar o cancelamento: ${errorText(e)}`); }
    // Wait for the bounded worker to acknowledge; do not start a competing job.
  }
  async function exportProject() {
    if (!resolved || exportBusy) return;
    setExportBusy(true); setError("");
    try { setReport(await decompileRomToSgdk(resolved.rom_path)); } catch (e) { setError(errorText(e)); }
    finally { setExportBusy(false); }
  }
  if (!visible) return null;
  return <Dialog open title="Inspecionar ROM · Experimental" description="Localize conteúdo recuperado e edite uma cópia. O arquivo original é preservado."
    closeDisabled={busy || inspectionBusy || resourceBusy || exportBusy} onClose={() => { visibleRef.current = false; setVisible(false); }} testId="rom-drop-decompile"
    className="!w-[min(1100px,calc(100vw-24px))]">
    <div className="space-y-3 text-xs text-[var(--rds-text-primary)]">
      <ol aria-label="Etapas" className="flex flex-wrap gap-3 text-[var(--rds-text-secondary)]"><li aria-current={["choose", "verifying", "error"].includes(stage) ? "step" : undefined}>1. Arquivo</li><li aria-current={["members", "extracting"].includes(stage) ? "step" : undefined}>2. ROM escolhida</li><li aria-current={stage === "catalog" ? "step" : undefined}>3. Catálogo e edição</li></ol>
      {error && <p role="alert" className="rounded border border-[#f38ba8] p-3">{error}</p>}
      {stage === "choose" && <><p>ROM Mega Drive (.md, .bin, .gen, .smd), ZIP ou 7z. Escolha um arquivo:</p>
        {paths.map(path => <button key={path} type="button" className="block max-w-full break-all rounded border p-2" onClick={() => void prepare(path)}>{path}</button>)}</>}
      {(stage === "choose" || stage === "error") && <button type="button" data-testid="rom-input-choose" className="rounded border px-3 py-2" onClick={() => void chooseFile()}>Selecionar arquivo</button>}
      {busy && <div role="status" aria-live="polite"><p>{stage === "verifying" ? "Verificando arquivo e listando ROMs…" : "Extraindo a ROM escolhida e conferindo identidade…"}</p><button type="button" data-testid="rom-input-cancel" onClick={() => void cancel()} className="mt-2 rounded border px-3 py-2">Cancelar preparação</button></div>}
      {stage === "members" && probe && <fieldset className="space-y-2"><legend>Há {probe.members.length} ROMs. Escolha qual deseja inspecionar.</legend>
        {probe.members.map(member => <label key={member.name} className="flex gap-2 rounded border p-2 [overflow-wrap:anywhere]"><input type="radio" name="rom-member" value={member.name} checked={selected === member.name} onChange={() => setSelected(member.name)} /><span>{member.name} · {member.size.toLocaleString("pt-BR")} bytes</span></label>)}
        <button type="button" data-testid="rom-input-extract" disabled={!selected} onClick={() => void extract(probe, selected)} className="rounded border px-3 py-2 disabled:opacity-50">Abrir ROM escolhida</button></fieldset>}
      {(stage === "catalog" || stage === "members") && <button type="button" disabled={inspectionBusy || resourceBusy || exportBusy} onClick={() => void chooseFile()} className="rounded border px-3 py-2">Escolher outra ROM</button>}
      {probe && <details><summary>Origem e identidade</summary><p className="break-all">{probe.source_path} · {probe.kind}<br />SHA-256 do arquivo: {probe.source_sha256}</p>
        {resolved && <p className="break-all">Membro: {resolved.member}<br />SHA-256 do membro: {resolved.member_sha256}<br />SHA-256 normalizado: {resolved.normalized_sha256}<br />Recibo: {resolved.receipt_path}</p>}</details>}
      {stage === "catalog" && resolved && <><InspectionPanel key={resolved.member_sha256} initialRom={{ path: resolved.rom_path, sha256: resolved.member_sha256 }} onActivityChange={setInspectionBusy} logMessage={logMessage} />
        <details data-testid="rom-input-resources" onToggle={event => { if (event.currentTarget.open) setResourcesLoaded(true); }}><summary>Recursos comprimidos · edição e patch · Experimental</summary>
          <p>Operações disponíveis somente para recursos estruturalmente verificados. O conjunto e os limites aparecem no painel.</p>
          {resourcesLoaded && <CompressedResourcePanel key={resolved.member_sha256} initialRomPath={resolved.rom_path} onActivityChange={setResourceBusy} logMessage={logMessage} />}
        </details>
        <details><summary>Exportação técnica SGDK</summary><p>Recursos, manifestos e esqueleto de código. Composição e gameplay integrais não são recuperados automaticamente.</p>
          <button type="button" disabled={exportBusy || inspectionBusy || resourceBusy} onClick={() => void exportProject()} className="my-2 rounded border px-3 py-2">{exportBusy ? "Gerando exportação técnica…" : "Gerar projeto SGDK técnico"}</button>
          {report && <div><p>{report.images} imagens · {report.sprites} sprites · {report.code_functions} funções identificadas · {(report.coverage_ratio * 100).toFixed(1)}% atribuído</p><p>{report.byte_exact ? "Conservação: remontagem idêntica à ROM normalizada." : "Conservação: remontagem da ROM normalizada divergente."} Editabilidade integral e equivalência de gameplay não comprovadas.</p><button type="button" onClick={() => void revealExtractionDir(report.out_dir).catch(e => setError(errorText(e)))} className="rounded border p-2">Abrir arquivos técnicos</button></div>}
        </details></>}
      <details><summary>Formatos e limites</summary><p>ROM até 32 MiB; compactado até 128 MiB, 2048 entradas e 256 MiB descomprimidos. ZIP/7z exigem o 7-Zip do sistema. Arquivos com senha ou caminhos inseguros são recusados. Só o membro escolhido é lido; a origem não é alterada.</p></details>
    </div>
  </Dialog>;
}
