import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import Icon from "../common/Icon";
import { useEditorStore } from "../../core/store/editorStore";
import { decompileRomToSgdk, revealExtractionDir, type SgdkDecompileReport } from "../../core/ipc/toolsService";

/** Extensões de ROM Mega Drive aceitas ao soltar no app. */
export const ROM_DROP_PATTERN = /\.(md|bin|gen|smd)$/i;

type State =
  | { kind: "idle" }
  | { kind: "running"; name: string }
  | { kind: "done"; name: string; report: SgdkDecompileReport }
  | { kind: "error"; name: string; message: string };

const errorText = (e: unknown) => (typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

/** Soltar uma ROM inicia decompilação, extração e geração do projeto SGDK (Experimental). */
export default function RomDropDecompile() {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    let busy = false;
    const run = async (path: string) => {
      if (busy) return;
      busy = true;
      const name = path.split(/[\\/]/).pop() ?? path;
      setState({ kind: "running", name });
      try {
        const report = await decompileRomToSgdk(path);
        setState({ kind: "done", name, report });
        useEditorStore.getState().logMessage("info", `[REX] Projeto SGDK de ${name} gerado em ${report.out_dir}`);
      } catch (e) {
        setState({ kind: "error", name, message: errorText(e) });
        useEditorStore.getState().logMessage("error", `[REX] Falha ao decompilar ${name}: ${errorText(e)}`);
      } finally {
        busy = false;
      }
    };
    if ("__TAURI_INTERNALS__" in window)
      void Promise.resolve()
        .then(() => getCurrentWebviewWindow().onDragDropEvent((e) => {
          if (e.payload.type !== "drop") return;
          const rom = e.payload.paths.find((p) => ROM_DROP_PATTERN.test(p));
          if (rom) void run(rom);
        }))
        .then((fn) => { if (cancelled) fn(); else dispose = fn; })
        .catch(() => undefined);
    return () => { cancelled = true; dispose?.(); };
  }, []);

  if (state.kind === "idle") return null;
  const reveal = (dir: string) => void revealExtractionDir(dir).catch((e) =>
    useEditorStore.getState().logMessage("error", `[REX] Não foi possível abrir o diretório: ${errorText(e)}`));
  return (
    <div role="status" data-testid="rom-drop-decompile"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded border border-white/15 bg-neutral-900/95 p-3 text-xs text-neutral-100 shadow-lg">
      <div className="mb-1 flex items-center justify-between gap-2">
        <strong>REX · ROM → projeto SGDK <span className="text-amber-300">(Experimental)</span></strong>
        {state.kind !== "running" && (
          <button type="button" aria-label="Fechar" onClick={() => setState({ kind: "idle" })}>×</button>
        )}
      </div>
      {state.kind === "running" && <p>Decompilando e extraindo {state.name}…</p>}
      {state.kind === "error" && <p className="text-red-300">{state.name}: {state.message}</p>}
      {state.kind === "done" && (
        <>
          <p>{state.report.header_title || state.name}</p>
          <p>
            {state.report.images} imagens · {state.report.sprites} sprites ({state.report.sprite_frames} quadros) ·{" "}
            {state.report.music} músicas · {state.report.code_functions} funções ·{" "}
            {(state.report.coverage_ratio * 100).toFixed(1)}% atribuído
          </p>
          <p className={state.report.byte_exact ? "text-emerald-300" : "text-amber-300"}>
            {state.report.byte_exact ? "Remontagem idêntica à ROM" : "Remontagem diverge da ROM"}
          </p>
          <button type="button" data-testid="rom-drop-open-dir" title={state.report.out_dir}
            onClick={() => reveal(state.report.out_dir)}
            className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20">
            <Icon name="folder" size={14} /> Abrir diretório da extração
          </button>
        </>
      )}
    </div>
  );
}
