import { useEffect, useRef, useState } from "react";
import { inspectionSonicLayoutsCancel, inspectionSonicSsWallCompose, type SsWallsComposition } from "../../core/ipc/toolsService";

interface Props {
  sessionId: string;
  romSha256: string;
  /** ID (byte) da célula selecionada no Mapa de IDs. */
  blockId: number;
}

let counter = 0;

function bytesFromHex(hex: string): Uint8ClampedArray {
  const out = new Uint8ClampedArray(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Composição SOMENTE LEITURA do recurso apontado pelo ID de bloco: ID → registro →
 * mapping → arte → paleta. A paleta é candidata estática e o frame é escolha do usuário.
 */
export function SonicSsWallPanel({ sessionId, romSha256, blockId }: Props) {
  const [frame, setFrame] = useState(0);
  const [data, setData] = useState<SsWallsComposition | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const inflight = useRef<string | undefined>(undefined);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const mine = ++seq.current;
    if (inflight.current) void inspectionSonicLayoutsCancel(inflight.current).catch(() => undefined);
    counter += 1;
    const requestId = `ssw-${Date.now().toString(36)}-${counter}`;
    inflight.current = requestId;
    setLoading(true);
    setError("");
    inspectionSonicSsWallCompose(sessionId, romSha256, blockId, frame, requestId)
      .then((next) => {
        if (mine !== seq.current || next.sessao_id !== sessionId || next.rom_sha256 !== romSha256 || next.id !== blockId) return;
        setData(next);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        const err = e as { code?: string; message?: string };
        if (err?.code === "cancelled") return;
        setData(null);
        setError(`${err?.code ? `${err.code}: ` : ""}${err?.message ?? String(e)}`);
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
        if (inflight.current === requestId) inflight.current = undefined;
      });
    return () => {
      seq.current += 1;
    };
  }, [sessionId, romSha256, blockId, frame]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !view || view.status !== "composta") return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const rgba = bytesFromHex(view.rgba_hex);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.putImageData(new ImageData(rgba, view.largura, view.altura), 0, 0);
  }, [data, blockId, romSha256, sessionId]);

  // Nunca mostra uma composição que não pertence ao ID/ROM/sessão atuais.
  const view = data && data.id === blockId && data.rom_sha256 === romSha256 && data.sessao_id === sessionId ? data : null;
  const composed = view?.status === "composta";
  return (
    <div data-testid="ss-wall-panel" data-block-id={blockId} className="mt-2 rounded border border-[#89dceb]/30 p-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#89dceb]">
        Composição do recurso do ID {`0x${blockId.toString(16).toUpperCase().padStart(2, "0")}`} · somente leitura · Experimental
      </div>
      {loading && !data && <div className="text-[#7f849c]">Compondo…</div>}
      {error && <div data-testid="ss-wall-error" className="break-words text-[#f38ba8]">{error}</div>}
      {view && (
        <>
          <div data-testid="ss-wall-status" data-status={view.status} className="mt-1 text-[#bac2de]">{view.explicacao}</div>
          {view.arte_explicacao && (
            <div data-testid="ss-wall-arte" data-vinculada={view.arte_vinculada ? "sim" : "nao"} className="mt-1 text-[9px] text-[#bac2de]">
              <span className="text-[#89dceb]">Arte:</span> {view.arte_explicacao}
              {view.arte_vinculada && <span className="text-[#7f849c]"> · {view.arte_vinculada.nivel}</span>}
            </div>
          )}
          {(view.frames_total ?? 0) > 0 || composed ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#bac2de]">
              <label htmlFor="ss-wall-frame">Frame do mapping</label>
              <input
                id="ss-wall-frame"
                data-testid="ss-wall-frame"
                type="number"
                min={0}
                max={Math.max(0, (view.frames_total ?? 16) - 1)}
                value={frame}
                onChange={(e) => setFrame(Math.min(Math.max(0, (view.frames_total ?? 16) - 1), Math.max(0, Math.trunc(Number(e.target.value) || 0))))}
                className="w-14 rounded border border-[#313244] bg-transparent px-1"
              />
              <span data-testid="ss-wall-frames-info" className="text-[#7f849c]">
                {view.frames_total ?? 16} frame(s) na tabela · confirmados por pixel: {(view.frames_confirmados ?? []).join(", ") || "nenhum"}
              </span>
            </div>
          ) : null}
          {view.aviso_frame && composed && <div className="text-[9px] text-[#7f849c]">{view.aviso_frame}</div>}
          {view.nivel_confirmacao && composed && (
            <div data-testid="ss-wall-nivel" className="text-[9px] text-[#a6e3a1]">Confirmação: {view.nivel_confirmacao}</div>
          )}
          {composed && (
            <>
              <canvas
                ref={canvas}
                data-testid="ss-wall-canvas"
                data-sha-pixels-len={view.pixels_hex.length}
                role="img"
                aria-label={`Frame ${view.frame} do mapping, ${view.largura} por ${view.altura} pixels, linha de paleta ${view.linha_paleta}; cores da ${view.paleta_rotulo}`}
                width={view.largura}
                height={view.altura}
                style={{ width: view.largura * 6, height: view.altura * 6, imageRendering: "pixelated", background: "#0b0f14" }}
                className="mt-1 rounded border border-[#313244]"
              />
              <div data-testid="ss-wall-paleta" className="mt-1 text-[9px] text-[#f9e2af]">Cores: {view.paleta_rotulo}. Não é a paleta do jogo em execução.</div>
              <div data-testid="ss-wall-integridade" className="text-[9px] text-[#7f849c]">Integridade: {view.integridade}</div>
              {view.tiles_vazios.length > 0 && (
                <div data-testid="ss-wall-vazios" className="text-[9px] text-[#7f849c]">
                  Tiles totalmente vazios (transparentes, não recuperados): {view.tiles_vazios.join(", ")}
                </div>
              )}
              <ol data-testid="ss-wall-cadeia" className="mt-1 list-decimal space-y-0.5 pl-4 text-[9px] text-[#bac2de]">
                {view.cadeia.map((e) => (
                  <li key={e.ordem}>
                    {e.de} → {e.para} · <span className="text-[#7f849c]">{e.origem}</span> · <span className="text-[#89dceb]">{e.nivel}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}
