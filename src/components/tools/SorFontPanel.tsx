import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type InspectionEdit,
  type InspectionSession,
  type SorFontInfo,
  type SorPixelEdit,
  inspectionEditSorFont,
  inspectionSorFontInfo,
  patchApplyBps,
  patchCreateBps,
} from "../../core/ipc/toolsService";
import {
  emulatorLoadRom,
  emulatorObserve,
  emulatorRunFrames,
  type EmulatorObservationResult,
} from "../../core/ipc/emulatorService";
import ToolPathField from "./ToolPathField";

interface Props {
  session: InspectionSession;
  /** Chamado com a edição devolvida pelo backend (a sessão passa a apontar para a cópia). */
  onEdited: (edit: InspectionEdit) => void;
  logMessage: (level: "info" | "success" | "warn" | "error", message: string) => void;
  disabled?: boolean;
}

const PREVIEW_TEXT = "ESTA CIDADE ERA UM";
const OBSERVE_FRAMES = 720;
const TILE_PX = 8;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Índice 4bpp chunky: nibble alto = coluna par. */
function pixelOf(plain: Uint8Array, tile: number, row: number, col: number): number {
  const byte = plain[tile * 32 + row * 4 + (col >> 1)] ?? 0;
  return col % 2 === 0 ? byte >> 4 : byte & 15;
}

const gray = (index: number) => `rgb(${index * 17},${index * 17},${index * 17})`;

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(error);
}

function drawText(canvas: HTMLCanvasElement | null, plain: Uint8Array | null, scale: number) {
  if (!canvas || !plain) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  [...PREVIEW_TEXT].forEach((ch, i) => {
    if (ch < "A" || ch > "Z") return;
    const tile = ch.charCodeAt(0) - 64;
    for (let y = 0; y < TILE_PX; y += 1) {
      for (let x = 0; x < TILE_PX; x += 1) {
        const v = pixelOf(plain, tile, y, x);
        if (v === 0) continue;
        ctx.fillStyle = gray(v);
        ctx.fillRect((i * TILE_PX + x) * scale, y * scale, scale, scale);
      }
    }
  });
}

function drawFramebuffer(canvas: HTMLCanvasElement | null, obs: EmulatorObservationResult | null) {
  if (!canvas || !obs) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(obs.framebuffer_width, obs.framebuffer_height);
  image.data.set(obs.framebuffer_rgba.slice(0, image.data.length));
  ctx.putImageData(image, 0, 0);
}

export default function SorFontPanel({ session, onEdited, logMessage, disabled }: Props) {
  const [info, setInfo] = useState<SorFontInfo | null>(null);
  const [error, setError] = useState("");
  const [glyph, setGlyph] = useState(1);
  const [index, setIndex] = useState(1);
  const [queue, setQueue] = useState<SorPixelEdit[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [patchPath, setPatchPath] = useState("");
  const [appliedPath, setAppliedPath] = useState("");
  const [observations, setObservations] = useState<{ base?: EmulatorObservationResult; copy?: EmulatorObservationResult }>({});
  const requestSeq = useRef(0);
  const origCanvas = useRef<HTMLCanvasElement | null>(null);
  const copyCanvas = useRef<HTMLCanvasElement | null>(null);
  const baseFb = useRef<HTMLCanvasElement | null>(null);
  const copyFb = useRef<HTMLCanvasElement | null>(null);
  const sessionId = session.session_id;
  const copySha = session.edit?.modified_rom_sha256 ?? "base";

  const refresh = useCallback(async () => {
    const request = ++requestSeq.current;
    try {
      const next = await inspectionSorFontInfo(sessionId);
      if (request !== requestSeq.current) return; // resposta antiga da sessão
      setInfo(next);
      setError("");
    } catch (e) {
      if (request === requestSeq.current) setError(message(e));
    }
  }, [sessionId]);

  useEffect(() => {
    setQueue([]);
    setObservations({});
    void refresh();
  }, [refresh, copySha]);

  const original = useMemo(() => (info?.supported ? b64ToBytes(info.original_plain_b64) : null), [info]);
  const current = useMemo(() => (info?.supported ? b64ToBytes(info.current_plain_b64) : null), [info]);

  useEffect(() => { drawText(origCanvas.current, original, 4); }, [original]);
  useEffect(() => { drawText(copyCanvas.current, current, 4); }, [current]);
  useEffect(() => { drawFramebuffer(baseFb.current, observations.base ?? null); }, [observations.base]);
  useEffect(() => { drawFramebuffer(copyFb.current, observations.copy ?? null); }, [observations.copy]);

  if (error && !info) {
    return <section data-testid="sor-font-panel" className="mt-3 rounded border border-[#f38ba8]/40 p-3 text-[10px] text-[#f38ba8]">Perfil Streets of Rage: {error}</section>;
  }
  if (!info) return null;
  if (!info.supported) {
    return <details data-testid="sor-font-unsupported" className="mt-3 rounded border border-[#313244] p-2 text-[10px] text-[#7f849c]">
      <summary className="cursor-pointer">Edição da fonte do Streets of Rage: não aplicável a esta ROM</summary>
      <div data-testid="sor-font-diagnostic" className="mt-1 break-words">{info.diagnostic}</div>
    </details>;
  }

  const glyphs = info.glyphs;
  const label = glyphs.find((g) => g.tile === glyph);
  const queued = (row: number, col: number) => queue.find((p) => p.tile === glyph && p.row === row && p.col === col);

  function paint(row: number, col: number) {
    if (disabled || busy) return;
    setQueue((q) => [...q.filter((p) => !(p.tile === glyph && p.row === row && p.col === col)), { tile: glyph, row, col, index }]);
    setStatus("");
  }

  async function apply() {
    if (!queue.length || busy) return;
    const request = ++requestSeq.current;
    setBusy(true);
    try {
      const edit = await inspectionEditSorFont(sessionId, queue);
      if (request !== requestSeq.current) throw new Error("A sessão mudou; resposta antiga descartada");
      setQueue([]);
      if (edit.noop) {
        setStatus("No-op explícito: esses pixels já valem na cópia; nada foi escrito.");
        logMessage("info", "[SoR] No-op explícito: nenhuma escrita.");
      } else {
        onEdited(edit);
        setStatus(`Aplicado à cópia ${edit.modified_rom_sha256}: stream ${edit.stream_len}/${edit.slot_len} bytes, vizinhos preservados: ${edit.guards_verified}. A base não foi tocada.`);
        logMessage("success", `[SoR] Fonte reinserida: stream ${edit.stream_len}/${edit.slot_len} bytes; cópia ${edit.modified_rom_sha256}`);
      }
      requestSeq.current += 1;
      await refresh();
    } catch (e) {
      setStatus(`Recusado: ${message(e)} Nada foi escrito; a fila foi preservada.`);
      logMessage("error", `[SoR] Edição recusada: ${message(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportPatch() {
    if (!session.edit || !patchPath.trim()) return;
    setBusy(true);
    try {
      const r = await patchCreateBps(session.rom_path, session.edit.modified_rom_path, patchPath.trim(), null);
      setStatus(`${r.ok ? "Patch BPS exportado" : "Exportação recusada"}: ${r.message}${r.patch_hash ? ` CRC32 ${r.patch_hash}` : ""}`);
    } catch (e) { setStatus(`Exportação recusada: ${message(e)}`); } finally { setBusy(false); }
  }

  async function applyPatch() {
    if (!patchPath.trim() || !appliedPath.trim()) return;
    setBusy(true);
    try {
      const r = await patchApplyBps(session.rom_path, patchPath.trim(), appliedPath.trim());
      setStatus(`${r.ok ? "Patch aplicado à base" : "Aplicação recusada"}: ${r.message}`);
    } catch (e) { setStatus(`Aplicação recusada: ${message(e)}`); } finally { setBusy(false); }
  }

  async function observe(which: "base" | "copy") {
    const path = which === "base" ? session.rom_path : session.edit?.modified_rom_path;
    if (!path || busy) return;
    setBusy(true);
    try {
      const loaded = await emulatorLoadRom(path);
      if (!loaded.ok) throw new Error(loaded.message);
      const ran = await emulatorRunFrames(OBSERVE_FRAMES);
      if (!ran.ok) throw new Error(ran.message);
      const obs = await emulatorObserve();
      if (!obs.ok) throw new Error(obs.message || "Observação recusada");
      setObservations((o) => ({ ...o, [which]: obs }));
      setStatus(`${which === "base" ? "Original" : "Cópia"} executada(o) ${OBSERVE_FRAMES} quadros sem input; framebuffer SHA-256 ${obs.framebuffer_sha256.slice(0, 16)}…`);
    } catch (e) { setStatus(`Execução recusada: ${message(e)}`); } finally { setBusy(false); }
  }

  const slotPct = Math.min(100, Math.round((info.current_stream_len / info.slot_len) * 100));
  return <section data-testid="sor-font-panel" data-profile={info.profile_id} data-copy-active={String(info.copy_active)} className="mt-3 rounded border border-[#f9e2af]/40 bg-[#11111b] p-3 text-[10px] text-[#cdd6f4]">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f9e2af]">Streets of Rage · fonte do jogo</h3>
      <span className="rounded border border-[#fab387]/60 px-1.5 py-0.5 text-[9px] uppercase text-[#fab387]">Experimental</span>
      <span className="text-[#7f849c]">ROM {info.rom_sha256.slice(0, 12)}… (tradução PtBr)</span>
    </div>
    <p className="mt-1 text-[#bac2de]">Este recurso é a fonte itálica usada no texto de introdução e em "PRESS START BUTTON". Você edita pixels de um tile; o produto recomprime no espaço original, gera uma cópia e um patch BPS. A ROM original nunca é alterada.</p>

    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <div data-testid="sor-font-preview-original" className="rounded border border-[#313244] p-2">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#7f849c]">Original</div>
        <canvas ref={origCanvas} width={PREVIEW_TEXT.length * TILE_PX * 4} height={TILE_PX * 4} aria-label="Prévia do original" className="block max-w-full [image-rendering:pixelated]" />
      </div>
      <div data-testid="sor-font-preview-copy" className="rounded border border-[#a6e3a1]/40 p-2">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#a6e3a1]">Cópia {info.copy_active ? "(com suas edições)" : "(ainda igual ao original)"}</div>
        <canvas ref={copyCanvas} width={PREVIEW_TEXT.length * TILE_PX * 4} height={TILE_PX * 4} aria-label="Prévia da cópia" className="block max-w-full [image-rendering:pixelated]" />
      </div>
    </div>
    <div className="mt-1 text-[#7f849c]">Prévia em escala de cinza por índice (a paleta real das telas não foi lida). Frase de exemplo: "{PREVIEW_TEXT}".</div>

    <div className="mt-3 rounded border border-[#313244] p-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#7f849c]">1. Escolha a letra (tile)</div>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Letras da fonte">
        {glyphs.map((g) => <button key={g.tile} type="button" data-testid={`sor-glyph-${g.label === "." ? `dot-${g.tile}` : g.label}`} aria-pressed={g.tile === glyph} disabled={disabled || busy}
          title={g.basis === "observed" ? `tile ${g.tile}: medido no core` : `tile ${g.tile}: inferido pela ordem do alfabeto`}
          onClick={() => { setGlyph(g.tile); setStatus(""); }}
          className={`h-7 w-7 rounded border text-[11px] ${g.tile === glyph ? "border-[#f9e2af] text-[#f9e2af]" : "border-[#45475a]"} ${g.basis === "inferred" ? "border-dashed" : ""}`}>{g.label}</button>)}
      </div>
      <div className="mt-1 text-[#7f849c]">Tile {glyph} ({label?.label ?? "?"}, {label?.basis === "observed" ? "medido no core" : "inferido pela ordem do alfabeto"}). Letras tracejadas são inferidas.</div>
    </div>

    <div className="mt-2 rounded border border-[#313244] p-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#7f849c]">2. Pinte pixels do tile {glyph}</div>
      <div className="mt-1 flex flex-wrap gap-1" aria-label="Índices de cor">
        {Array.from({ length: 16 }, (_, i) => <button key={i} type="button" data-testid={`sor-index-${i}`} aria-pressed={i === index} disabled={disabled || busy} onClick={() => setIndex(i)}
          className={`h-6 w-6 rounded border-2 text-[9px] ${i === index ? "border-[#f9e2af]" : "border-[#45475a]"}`}
          style={{ background: i === 0 ? "#222" : gray(i), color: i > 8 ? "#000" : "#fff" }}>{i === 0 ? "∅" : i}</button>)}
      </div>
      <div className="mt-2 inline-grid grid-cols-8 gap-px bg-[#313244] p-px" data-testid="sor-tile-grid" aria-label={`Pixels do tile ${glyph}`}>
        {Array.from({ length: 64 }, (_, n) => {
          const row = n >> 3; const col = n & 7;
          const q = queued(row, col);
          const value = q ? q.index : current ? pixelOf(current, glyph, row, col) : 0;
          const changedVsOriginal = original && current && pixelOf(original, glyph, row, col) !== pixelOf(current, glyph, row, col);
          return <button key={n} type="button" data-testid={`sor-pixel-${row}-${col}`} data-value={value} data-queued={String(Boolean(q))} aria-label={`linha ${row} coluna ${col}, índice ${value}`}
            disabled={disabled || busy} onClick={() => paint(row, col)} className="h-7 w-7"
            style={{ background: value === 0 ? "#222" : gray(value), outline: q ? "2px solid #f9e2af" : changedVsOriginal ? "2px solid #a6e3a1" : "none", outlineOffset: -2 }} />;
        })}
      </div>
      <div className="mt-1 text-[#7f849c]">Contorno amarelo = na fila (ainda não gravado) · verde = já difere do original na cópia.</div>
      <div data-testid="sor-queue" className="mt-1">{queue.length} pixel(s) na fila.</div>
      <div className="mt-1 text-[#f9e2af]">Efeito esperado: toda ocorrência desta letra no texto de introdução ("ESTA CIDADE ERA UM…") e em "PRESS START BUTTON" mostra os novos pixels, na cor da paleta do jogo para o índice escolhido. Outras letras não mudam.</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" data-testid="sor-clear-queue" disabled={disabled || busy || !queue.length} onClick={() => setQueue([])} className="rounded border border-[#45475a] px-2 py-1">Limpar fila</button>
        <button type="button" data-testid="sor-apply" disabled={disabled || busy || !queue.length} onClick={() => void apply()} className="rounded bg-[#f9e2af] px-3 py-1 font-semibold text-[#11111b]">{busy ? "Trabalhando…" : "Aplicar à cópia"}</button>
      </div>
    </div>

    <div className="mt-2 rounded border border-[#313244] p-2" data-testid="sor-shared">
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#fab387]">Compartilhamento conhecido</div>
      <div className="mt-1">Este stream é lido por {info.consumers.length} pontos do código; editar a fonte afeta todos os usos dela:</div>
      <ul className="ml-4 list-disc text-[#bac2de]">{info.consumers.map((c) => <li key={c.offset}>0x{c.offset.toString(16).toUpperCase()} — {c.note}</li>)}</ul>
      <div className="mt-1" data-testid="sor-slot">Espaço: o stream gravado usa {info.current_stream_len} de {info.slot_len} bytes do slot original ({slotPct}%). Sem relocação: se não couber, a edição é recusada e nada é escrito.</div>
    </div>

    <div className="mt-2 grid gap-2">
      <div data-testid="sor-patch-path"><ToolPathField label="Exportar patch BPS (base → cópia)" value={patchPath} set={setPatchPath} extensions={["bps"]} accentColor="f9e2af" /></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="sor-export-patch" disabled={busy || !session.edit || !patchPath.trim()} onClick={() => void exportPatch()} className="rounded border border-[#f9e2af]/50 px-3 py-1 text-[#f9e2af]">Exportar patch BPS</button>
      </div>
      <div data-testid="sor-applied-path"><ToolPathField label="Salvar ROM modificada (base + patch)" value={appliedPath} set={setAppliedPath} extensions={["bin", "md", "gen"]} accentColor="f9e2af" /></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="sor-apply-patch" disabled={busy || !patchPath.trim() || !appliedPath.trim()} onClick={() => void applyPatch()} className="rounded border border-[#f9e2af]/50 px-3 py-1 text-[#f9e2af]">Aplicar patch à base</button>
        <button type="button" data-testid="sor-run-base" disabled={busy} onClick={() => void observe("base")} className="rounded border border-[#89b4fa]/50 px-3 py-1 text-[#89b4fa]">Executar Original ({OBSERVE_FRAMES} quadros, sem input)</button>
        <button type="button" data-testid="sor-run-copy" disabled={busy || !session.edit} onClick={() => void observe("copy")} className="rounded border border-[#a6e3a1]/50 px-3 py-1 text-[#a6e3a1]">Executar Cópia ({OBSERVE_FRAMES} quadros, sem input)</button>
      </div>
    </div>
    {(observations.base || observations.copy) && <div data-testid="sor-observations" className="mt-2 grid gap-2 md:grid-cols-2">
      {(["base", "copy"] as const).map((k) => observations[k] && <div key={k} data-testid={`sor-observation-${k}`} data-rom-sha256={observations[k]?.rom_sha256} data-framebuffer-sha256={observations[k]?.framebuffer_sha256} data-frames-run={observations[k]?.frames_run} className="rounded border border-[#313244] p-2">
        <div className="text-[9px] uppercase tracking-[0.14em] text-[#89b4fa]">{k === "base" ? "Original" : "Cópia"} · ROM {observations[k]?.rom_sha256.slice(0, 12)}…</div>
        <canvas ref={k === "base" ? baseFb : copyFb} width={observations[k]?.framebuffer_width} height={observations[k]?.framebuffer_height} className="mt-1 block h-auto w-full border border-[#313244] bg-black [image-rendering:pixelated]" />
        <div className="mt-1 break-all font-mono text-[9px] text-[#7f849c]">framebuffer {observations[k]?.framebuffer_sha256}</div>
      </div>)}
    </div>}
    <div aria-live="polite" data-testid="sor-status" className="mt-2 break-words text-[#a6e3a1]">{status}</div>

    <details data-testid="sor-details" className="mt-2 border-t border-[#313244] pt-2">
      <summary className="cursor-pointer text-[9px] uppercase tracking-[0.14em] text-[#bac2de]">Prova, escopo e limites (detalhe técnico)</summary>
      <div className="mt-1 space-y-1 text-[#7f849c]">
        {info.proof.map((p) => <div key={p} className="break-all">{p}</div>)}
        <div className="pt-1 text-[#fab387]">O que NÃO está provado:</div>
        {info.limits.map((l) => <div key={l}>{l}</div>)}
      </div>
    </details>
  </section>;
}
