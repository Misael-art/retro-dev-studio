import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  inspectionSetLayoutsSelection,
  inspectionSonicLayoutCell,
  inspectionSonicLayoutGrid,
  inspectionSonicLayoutsCancel,
  inspectionSonicLayouts,
  type InspectionSession,
  type SonicLayoutCell,
  type SonicLayoutsInfo,
  type SonicLayoutsSelection,
} from "../../core/ipc/toolsService";
import { SonicSsWallPanel } from "./SonicSsWallPanel";
import { cellPixels, clampZoom, idAt, idLabel, idTint, moveCursor, showsIdText, ZOOM_MAX, ZOOM_MIN } from "./sonicLayoutsNav";

interface Props {
  sessionId: string;
  /** Muda quando a cópia da sessão muda (edição); a identidade é relida. */
  romRevision: string;
  savedSelection?: SonicLayoutsSelection | null;
  /** Incrementado pelo pai quando a sessão é reaberta: reaplica a seleção salva. */
  restoreNonce: number;
  onSessionUpdated?: (session: InspectionSession) => void;
}

function describeError(error: unknown): { code: string; message: string } {
  if (typeof error === "object" && error !== null) {
    const e = error as { code?: unknown; message?: unknown };
    return {
      code: typeof e.code === "string" ? e.code : "",
      message: typeof e.message === "string" ? e.message : String(error),
    };
  }
  return { code: "", message: String(error) };
}

let requestCounter = 0;
function newRequestId(kind: string): string {
  requestCounter += 1;
  return `lay-${kind}-${Date.now().toString(36)}-${requestCounter}`;
}

interface GridBodyProps {
  idsHex: string;
  rows: number;
  cols: number;
  pixels: number;
  withText: boolean;
  selRow: number;
  selCol: number;
}

// 4096 células: memoizado para que só uma mudança de seleção/zoom redesenhe.
const GridBody = memo(function GridBody({ idsHex, rows, cols, pixels, withText, selRow, selCol }: GridBodyProps) {
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const id = idAt(idsHex, r, c, cols) ?? 0;
      const selected = r === selRow && c === selCol;
      cells.push(
        <div
          key={r * cols + c}
          role="gridcell"
          aria-selected={selected}
          data-row={r}
          data-col={c}
          data-id={id}
          data-selected={selected ? "true" : undefined}
          style={{
            width: pixels,
            height: pixels,
            background: idTint(id),
            fontSize: Math.max(7, Math.floor(pixels / 2.4)),
            lineHeight: `${pixels}px`,
            outline: selected ? "2px solid #f9e2af" : undefined,
            outlineOffset: selected ? -2 : undefined,
            zIndex: selected ? 1 : undefined,
          }}
          className="cursor-pointer select-none text-center font-mono text-[#cdd6f4]/80"
        >
          {withText ? id.toString(16).toUpperCase().padStart(2, "0") : ""}
        </div>
      );
    }
  }
  return <>{cells}</>;
});

export function SonicLayoutsPanel({ sessionId, romRevision, savedSelection, restoreNonce, onSessionUpdated }: Props) {
  const [info, setInfo] = useState<SonicLayoutsInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState(0);
  const [idsHex, setIdsHex] = useState<string | null>(null);
  const [gridError, setGridError] = useState("");
  const [zoom, setZoom] = useState(4);
  const [selection, setSelection] = useState<{ row: number; col: number } | null>(null);
  const [cell, setCell] = useState<SonicLayoutCell | null>(null);
  const [cellError, setCellError] = useState("");
  const [notice, setNotice] = useState("");
  const [discarded, setDiscarded] = useState(0);

  const sessionRef = useRef(sessionId);
  const identityRef = useRef<string>("");
  const layoutRef = useRef(0);
  const selectionRef = useRef<{ row: number; col: number } | null>(null);
  const zoomRef = useRef(4);
  const infoSeq = useRef(0);
  const gridSeq = useRef(0);
  const cellSeq = useRef(0);
  const inflight = useRef<{ info?: string; grid?: string; cell?: string }>({});
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(savedSelection);
  const gridBox = useRef<HTMLDivElement | null>(null);

  savedRef.current = savedSelection;
  sessionRef.current = sessionId;

  const discard = useCallback(() => setDiscarded((n) => n + 1), []);

  const cancelInflight = useCallback((slot: "info" | "grid" | "cell") => {
    const id = inflight.current[slot];
    if (id) void inspectionSonicLayoutsCancel(id).catch(() => undefined);
    inflight.current[slot] = undefined;
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const sel = selectionRef.current;
      const sha = identityRef.current;
      const sid = sessionRef.current;
      if (!sel || !sha) return;
      void inspectionSetLayoutsSelection(sid, {
        layout_index: layoutRef.current,
        row: sel.row,
        col: sel.col,
        zoom: zoomRef.current,
        rom_sha256: sha,
      })
        .then((next) => {
          if (sessionRef.current === sid) onSessionUpdated?.(next);
        })
        .catch(() => undefined);
    }, 250);
  }, [onSessionUpdated]);

  const loadCell = useCallback(
    async (layoutIndex: number, row: number, col: number) => {
      const sid = sessionRef.current;
      const sha = identityRef.current;
      if (!sha) return;
      const seq = ++cellSeq.current;
      cancelInflight("cell");
      const requestId = newRequestId("cel");
      inflight.current.cell = requestId;
      setCellError("");
      try {
        const next = await inspectionSonicLayoutCell(sid, sha, layoutIndex, row, col, requestId);
        const sel = selectionRef.current;
        if (
          seq !== cellSeq.current ||
          next.sessao_id !== sessionRef.current ||
          next.rom_sha256 !== identityRef.current ||
          next.indice !== layoutRef.current ||
          !sel ||
          next.linha !== sel.row ||
          next.coluna !== sel.col
        ) {
          discard();
          return;
        }
        setCell(next);
      } catch (error) {
        if (seq !== cellSeq.current) return;
        const e = describeError(error);
        if (e.code === "cancelled") return;
        if (e.code === "layouts_rom_mudou") {
          setCellError("A ROM da sessão mudou; relendo a identidade…");
          void loadInfo();
          return;
        }
        setCell(null);
        setCellError(`${e.code ? `${e.code}: ` : ""}${e.message}`);
      } finally {
        if (inflight.current.cell === requestId) inflight.current.cell = undefined;
      }
    },
    [cancelInflight, discard]
  );

  const loadGrid = useCallback(
    async (layoutIndex: number, afterGrid?: () => void) => {
      const sid = sessionRef.current;
      const sha = identityRef.current;
      if (!sha) return;
      const seq = ++gridSeq.current;
      cancelInflight("grid");
      const requestId = newRequestId("gra");
      inflight.current.grid = requestId;
      setGridError("");
      setIdsHex(null);
      try {
        const next = await inspectionSonicLayoutGrid(sid, sha, layoutIndex, requestId);
        if (
          seq !== gridSeq.current ||
          next.sessao_id !== sessionRef.current ||
          next.rom_sha256 !== identityRef.current ||
          next.indice !== layoutRef.current
        ) {
          discard();
          return;
        }
        setIdsHex(next.ids_hex);
        afterGrid?.();
      } catch (error) {
        if (seq !== gridSeq.current) return;
        const e = describeError(error);
        if (e.code === "cancelled") return;
        if (e.code === "layouts_rom_mudou") {
          void loadInfo();
          return;
        }
        setGridError(`${e.code ? `${e.code}: ` : ""}${e.message}`);
      } finally {
        if (inflight.current.grid === requestId) inflight.current.grid = undefined;
      }
    },
    [cancelInflight, discard]
  );

  // Releitura da identidade (mudança de sessão, de cópia ou "ROM mudou").
  async function loadInfo(restore = false) {
    const sid = sessionRef.current;
    const seq = ++infoSeq.current;
    cancelInflight("info");
    const requestId = newRequestId("inf");
    inflight.current.info = requestId;
    setBusy(true);
    setInfoError("");
    try {
      const next = await inspectionSonicLayouts(sid, undefined, requestId);
      if (seq !== infoSeq.current || next.sessao_id !== sessionRef.current) {
        discard();
        return;
      }
      identityRef.current = next.rom_sha256;
      setInfo(next);
      const saved = savedRef.current;
      let targetLayout = layoutRef.current;
      let targetSel = selectionRef.current;
      if (restore && saved) {
        targetLayout = Math.min(next.layouts.length - 1, Math.max(0, saved.layout_index));
        targetSel = { row: saved.row, col: saved.col };
        const z = clampZoom(saved.zoom);
        zoomRef.current = z;
        setZoom(z);
        setNotice(
          saved.rom_sha256 === next.rom_sha256
            ? `Seleção restaurada da sessão salva: a ROM é idêntica (${next.rom_sha256.slice(0, 12)}…).`
            : `Seleção restaurada, mas a ROM mudou desde que foi salva (era ${saved.rom_sha256.slice(0, 12)}…, agora ${next.rom_sha256.slice(0, 12)}…).`
        );
      }
      if (!targetSel) targetSel = { row: 0, col: 0 };
      layoutRef.current = targetLayout;
      selectionRef.current = targetSel;
      setLayout(targetLayout);
      setSelection(targetSel);
      void loadGrid(targetLayout);
      void loadCell(targetLayout, targetSel.row, targetSel.col);
    } catch (error) {
      if (seq !== infoSeq.current) return;
      const e = describeError(error);
      if (e.code === "cancelled") return;
      setInfo(null);
      setInfoError(`${e.code ? `${e.code}: ` : ""}${e.message}`);
    } finally {
      if (seq === infoSeq.current) setBusy(false);
      if (inflight.current.info === requestId) inflight.current.info = undefined;
    }
  }

  // Troca de sessão: nada da sessão anterior sobrevive (respostas atrasadas
  // são descartadas pelas sequências e pela comparação de sessão/ROM).
  useEffect(() => {
    identityRef.current = "";
    layoutRef.current = 0;
    selectionRef.current = null;
    infoSeq.current += 1;
    gridSeq.current += 1;
    cellSeq.current += 1;
    setInfo(null);
    setIdsHex(null);
    setCell(null);
    setSelection(null);
    setLayout(0);
    setNotice("");
    void loadInfo(true);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      infoSeq.current += 1;
      gridSeq.current += 1;
      cellSeq.current += 1;
    };
  }, [sessionId]);

  // Cópia mudou (edição em outro painel) ou sessão reaberta.
  const firstRevision = useRef(true);
  useEffect(() => {
    if (firstRevision.current) {
      firstRevision.current = false;
      return;
    }
    void loadInfo(false);
  }, [romRevision]);

  const firstRestore = useRef(true);
  useEffect(() => {
    if (firstRestore.current) {
      firstRestore.current = false;
      return;
    }
    void loadInfo(true);
  }, [restoreNonce]);

  const rows = info?.geometria.linhas ?? 0;
  const cols = info?.geometria.colunas ?? 0;
  const pixels = cellPixels(zoom);

  function pick(row: number, col: number) {
    const next = { row, col };
    selectionRef.current = next;
    setSelection(next);
    setCell(null);
    void loadCell(layoutRef.current, row, col);
    schedulePersist();
  }

  function changeLayout(index: number) {
    if (!info || index === layoutRef.current) return;
    layoutRef.current = index;
    setLayout(index);
    setCell(null);
    const sel = selectionRef.current ?? { row: 0, col: 0 };
    selectionRef.current = sel;
    setSelection(sel);
    void loadGrid(index);
    void loadCell(index, sel.row, sel.col);
    schedulePersist();
  }

  function changeZoom(next: number) {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
    schedulePersist();
  }

  function onGridClick(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest("[data-row]") as HTMLElement | null;
    if (!target) return;
    pick(Number(target.dataset.row), Number(target.dataset.col));
    gridBox.current?.focus({ preventScroll: true });
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(zoomRef.current + 1);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      changeZoom(zoomRef.current - 1);
      return;
    }
    const from = selectionRef.current ?? { row: 0, col: 0 };
    const next = moveCursor(from, event.key, event.ctrlKey || event.metaKey, rows, cols);
    if (!next) return;
    event.preventDefault();
    if (next.row !== from.row || next.col !== from.col) pick(next.row, next.col);
  }

  // Mantém a célula selecionada visível ao navegar com o teclado.
  useEffect(() => {
    const box = gridBox.current;
    if (!box || !selection) return;
    const top = selection.row * pixels;
    const left = selection.col * pixels;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + pixels > box.scrollTop + box.clientHeight) box.scrollTop = top + pixels - box.clientHeight;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (left + pixels > box.scrollLeft + box.clientWidth) box.scrollLeft = left + pixels - box.clientWidth;
  }, [selection, pixels]);

  const current = info?.layouts[layout] ?? null;
  const gridId = useMemo(
    () => (idsHex && selection ? idAt(idsHex, selection.row, selection.col, cols || 64) : null),
    [idsHex, selection, cols]
  );
  const idMismatch = cell !== null && gridId !== null && cell.id !== gridId;

  return (
    <div data-testid="layouts-panel" className="rounded border border-[#74c7ec]/30 bg-[#101a1f] p-2">
      <div className="font-semibold uppercase tracking-[0.14em] text-[#74c7ec]">
        Mapa de IDs · layouts das fases especiais · Sonic 1 · somente leitura · Experimental
      </div>
      <p className="mt-1 text-[#cdd6f4]">
        O app descompacta (Enigma) os seis blocos de layout direto da ROM da sessão e mostra cada um como uma grade de IDs.
        Nada aqui escreve no arquivo.
      </p>
      {busy && !info && <div data-testid="layouts-loading" className="mt-1 text-[#7f849c]">Descompactando os layouts no núcleo…</div>}
      {info && (
        <>
          <ol data-testid="layouts-camadas" className="mt-2 list-decimal space-y-0.5 pl-4 text-[#bac2de]">
            {info.camadas.map((c) => (
              <li key={c.ordem}>
                <span className="text-[#89dceb]">{c.titulo}.</span> {c.texto}
              </li>
            ))}
          </ol>
          <div data-testid="layouts-identity" data-rom-sha256={info.rom_sha256} data-session-id={info.sessao_id} className="mt-2 break-all text-[9px] text-[#7f849c]">
            ROM analisada agora: {info.rom_sha256.slice(0, 16)}… · {info.rom_tamanho} bytes ·{" "}
            {info.rom_confere_pin ? "é o mesmo arquivo usado na medição" : "não é o arquivo da medição"} · sessão {info.sessao_id}
          </div>
          <div role="tablist" aria-label="Layouts" className="mt-2 flex flex-wrap gap-1">
            {info.layouts.map((l) => (
              <button
                key={l.indice}
                type="button"
                role="tab"
                aria-selected={layout === l.indice}
                data-testid={`layouts-tab-${l.indice}`}
                data-integridade={l.integridade}
                onClick={() => changeLayout(l.indice)}
                className={`rounded border px-2 py-1 text-[10px] ${layout === l.indice ? "border-[#74c7ec] bg-[#1b3a47] text-[#cdd6f4]" : "border-[#313244] text-[#bac2de]"}`}
              >
                {l.rotulo}
              </button>
            ))}
          </div>
          {current && (
            <div data-testid="layouts-resumo" className="mt-1 text-[#bac2de]">
              {current.rotulo}: {current.bytes.saida_bytes} IDs ({info.geometria.linhas} × {info.geometria.colunas}), {current.ids_distintos} valores diferentes,
              maior ID {idLabel(current.maior_id)}. Integridade:{" "}
              <span data-testid="layouts-integridade" className={current.integridade === "confere" ? "text-[#a6e3a1]" : "text-[#f9e2af]"}>
                {current.integridade === "confere"
                  ? "o resultado decodificado agora coincide com a referência histórica"
                  : "o resultado decodificado agora DIVERGE da referência histórica"}
              </span>
              .
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#bac2de]">
            <span>Zoom</span>
            <button type="button" data-testid="layouts-zoom-out" aria-label="Diminuir zoom" disabled={zoom <= ZOOM_MIN} onClick={() => changeZoom(zoom - 1)} className="rounded border border-[#313244] px-2 py-0.5">−</button>
            <span data-testid="layouts-zoom" data-zoom={zoom}>{zoom}×</span>
            <button type="button" data-testid="layouts-zoom-in" aria-label="Aumentar zoom" disabled={zoom >= ZOOM_MAX} onClick={() => changeZoom(zoom + 1)} className="rounded border border-[#313244] px-2 py-0.5">+</button>
            <span className="text-[#7f849c]">Setas movem · Home/End início/fim da linha · Ctrl+Home/End primeira/última célula · PgUp/PgDn 8 linhas · +/− zoom</span>
          </div>
          <div
            ref={gridBox}
            role="grid"
            tabIndex={0}
            aria-label="Mapa de IDs"
            aria-rowcount={rows}
            aria-colcount={cols}
            data-testid="layouts-grid"
            data-layout={layout}
            data-state={idsHex ? "pronto" : "carregando"}
            data-selected-row={selection?.row ?? ""}
            data-selected-col={selection?.col ?? ""}
            onClick={onGridClick}
            onKeyDown={onGridKey}
            style={{ maxHeight: 340, width: "min(100%, 760px)", overflow: "auto" }}
            className="mt-2 rounded border border-[#313244] bg-[#0b0f14] focus:outline focus:outline-1 focus:outline-[#74c7ec]"
          >
            {idsHex ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${pixels}px)`, width: cols * pixels, boxSizing: "content-box", paddingRight: 24, paddingBottom: 24 }}>
                <GridBody idsHex={idsHex} rows={rows} cols={cols} pixels={pixels} withText={showsIdText(zoom)} selRow={selection?.row ?? -1} selCol={selection?.col ?? -1} />
              </div>
            ) : (
              <div className="p-3 text-[#7f849c]">{gridError ? "" : "Montando a grade…"}</div>
            )}
          </div>
          <div className="mt-1 text-[9px] text-[#7f849c]">
            Cada célula é um ID de 1 byte. As cores só distinguem valores diferentes: não são a arte do jogo, e este mapa não é uma remontagem gráfica.
          </div>
          <div aria-live="polite" data-testid="layouts-grid-error" className="mt-1 break-words text-[#f38ba8]">{gridError}</div>
          <div data-testid="layouts-celula" data-row={selection?.row ?? ""} data-col={selection?.col ?? ""} data-id={cell?.id ?? ""} className="mt-2 rounded border border-[#313244] p-2">
            {!selection && <div className="text-[#7f849c]">Selecione uma célula (clique ou setas).</div>}
            {selection && (
              <div data-testid="layouts-celula-coord" className="text-[#cdd6f4]">
                Célula: linha {selection.row}, coluna {selection.col}
                {gridId !== null && <> · ID <span data-testid="layouts-celula-id" className="font-mono text-[#f9e2af]">{idLabel(gridId)}</span></>}
              </div>
            )}
            {cell && (
              <>
                <div data-testid="layouts-celula-origem" className="mt-1 text-[#bac2de]">{cell.origem.explicacao}</div>
                <div data-testid="layouts-celula-definicao" data-status={cell.definicao_status} className="mt-1 text-[#bac2de]">
                  <span className="text-[#89dceb]">Definição estrutural:</span> {cell.definicao_explicacao}
                </div>
                {cell.definicao && (
                  <div className="mt-1 text-[9px] text-[#7f849c]">
                    Prova: vínculo estrutural estático. O que o campo significa e o desenho apontado ainda são desconhecidos.
                  </div>
                )}
                {cell.id >= 1 && cell.id_hex && (
                  <SonicSsWallPanel sessionId={sessionId} romSha256={cell.rom_sha256} blockId={cell.id} />
                )}
                {idMismatch && <div className="mt-1 text-[#f38ba8]">Divergência interna: a grade mostra {idLabel(gridId as number)} mas o núcleo resolveu {cell.id_hex}.</div>}
              </>
            )}
            <div aria-live="polite" data-testid="layouts-celula-erro" className="mt-1 break-words text-[#f38ba8]">{cellError}</div>
          </div>
          <div data-testid="layouts-desconhecidos" className="mt-2 space-y-0.5">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#74c7ec]">O que ainda não se sabe</div>
            {info.desconhecidos.map((d) => <div key={d} className="text-[9px] text-[#bac2de]">{d}</div>)}
          </div>
          <div aria-live="polite" data-testid="layouts-notice" className="mt-1 break-words text-[#a6e3a1]">{notice}</div>
          <details data-testid="layouts-tecnico" className="mt-2 border-t border-[#313244] pt-2">
            <summary className="cursor-pointer text-[9px] uppercase tracking-[0.14em] text-[#bac2de]">Detalhes técnicos (endereços, hashes, contas de bytes)</summary>
            <div className="mt-1 space-y-1 break-all font-mono text-[9px] text-[#7f849c]">
              <div>ROM (SHA-256): {info.rom_sha256}</div>
              <div>Respostas antigas descartadas: <span data-testid="layouts-descartadas">{discarded}</span></div>
              {current && (
                <>
                  <div>Bloco comprimido em {current.stream_offset_hex} · slot da tabela {current.tabela_slot_hex}</div>
                  <div>Bytes lidos do bloco: {current.bytes.bytes_lidos} · padding de alinhamento: {current.bytes.padding_alinhamento} · tamanho armazenado: {current.bytes.tamanho_armazenado} · saída descomprimida: {current.bytes.saida_bytes}</div>
                  <div>Tokens: {current.tokens} · SHA-256 do bloco: {current.span_sha256} ({current.span_confere_pin ? "confere" : "diverge"} do pin; consumo {current.consumo_confere_pin ? "confere" : "diverge"})</div>
                  <div>SHA-256 da saída (calculada agora): {current.saida_sha256}</div>
                  <div>Referência histórica ({current.referencia.natureza}): {current.referencia.plain_sha256} — {current.referencia.confere ? "coincide" : "diverge"}</div>
                </>
              )}
              {cell && (
                <>
                  <div>Célula → byte {cell.origem.saida_offset} ({cell.origem.saida_offset_hex}) da saída · palavra {cell.origem.palavra_indice} ({cell.origem.byte_na_palavra}) · RAM ${cell.origem.endereco_ram_hex}</div>
                  {cell.definicao && (
                    <>
                      <div>Registro {cell.definicao.registro_endereco_hex}: {cell.definicao.registro_hex} · ponteiro {cell.definicao.ponteiro_mapeamentos_hex} · byte inicial {cell.definicao.byte_inicial_hex} · campo {cell.definicao.campo_hex} · slot ${cell.definicao.slot_ram_hex}</div>
                      {cell.definicao.nao_decodificado.map((t) => <div key={t}>Não decodificado: {t}</div>)}
                    </>
                  )}
                </>
              )}
              <div>Limites do decode: saída ≤ {info.limites.max_saida_bytes} B · tokens ≤ {info.limites.max_tokens} · janela do bloco ≤ {info.limites.janela_stream_bytes} B · perfil {info.perfil_id}</div>
            </div>
          </details>
        </>
      )}
      <div aria-live="polite" data-testid="layouts-error" className="mt-2 break-words text-[#f38ba8]">{infoError}</div>
    </div>
  );
}
