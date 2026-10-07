import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SonicSsWallPanel } from "./SonicSsWallPanel";

const mocks = vi.hoisted(() => ({
  inspectionSonicSsWallCompose: vi.fn(),
  inspectionSonicLayoutsCancel: vi.fn(),
}));

vi.mock("../../core/ipc/toolsService", () => mocks);

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHA = "a".repeat(64);
const PAL = "candidata estática (Pal_SpecialStage, carregada em 0x469A)";

function composed(id: number, frame: number, over: Record<string, unknown> = {}) {
  return {
    formato: "ss-walls-compose/v1",
    sessao_id: "s1",
    rom_sha256: SHA,
    id,
    id_hex: `0x${id.toString(16)}`,
    status: "composta",
    explicacao: `Frame ${frame} composto`,
    frame,
    linha_paleta: 0,
    largura: 2,
    altura: 2,
    x0: -1,
    y0: -1,
    pixels_hex: "01020304",
    rgba_hex: "ff000000" + "00ff0000" + "0000ff00" + "ffffff00",
    paleta_rotulo: PAL,
    tiles_usados: [0],
    tiles_vazios: [121],
    cadeia: [{ ordem: 1, de: "ID", para: "registro", origem: "0x1b738", nivel: "vínculo estrutural estático" }],
    integridade: "confere com as referências pinadas",
    aviso_frame: "O frame de rotação é estado de execução",
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.inspectionSonicLayoutsCancel.mockResolvedValue(true);
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SonicSsWallPanel", () => {
  it("mostra a composição com paleta rotulada como candidata estática, vazios e cadeia", async () => {
    mocks.inspectionSonicSsWallCompose.mockResolvedValue(composed(1, 0));
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={1} />));
    await flush();
    expect(container.querySelector("[data-testid='ss-wall-canvas']")).not.toBeNull();
    expect(container.textContent).toContain("candidata estática");
    expect(container.textContent).toContain("Não é a paleta do jogo em execução");
    expect(container.querySelector("[data-testid='ss-wall-vazios']")?.textContent).toContain("121");
    expect(container.querySelectorAll("[data-testid='ss-wall-cadeia'] li").length).toBe(1);
    expect(container.querySelector("[data-testid='ss-wall-canvas']")?.getAttribute("aria-label")).toContain("candidata estática");
  });

  it("não desenha imagem quando o mapping não é decodificado", async () => {
    mocks.inspectionSonicSsWallCompose.mockResolvedValue(
      composed(38, 0, { status: "mapping-nao-decodificado", explicacao: "nenhuma imagem foi inventada", frame: null, largura: 0, altura: 0, pixels_hex: "", rgba_hex: "" })
    );
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={38} />));
    await flush();
    expect(container.querySelector("[data-testid='ss-wall-canvas']")).toBeNull();
    expect(container.querySelector("[data-testid='ss-wall-status']")?.getAttribute("data-status")).toBe("mapping-nao-decodificado");
    expect(container.textContent).toContain("nenhuma imagem foi inventada");
  });

  it("descarta resposta antiga de outro ID e de outra ROM", async () => {
    let resolveOld: (v: unknown) => void = () => undefined;
    mocks.inspectionSonicSsWallCompose
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
      .mockResolvedValueOnce(composed(2, 0));
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={1} />));
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={2} />));
    await flush();
    await act(async () => { resolveOld(composed(1, 0)); await Promise.resolve(); });
    expect(container.querySelector("[data-testid='ss-wall-panel']")?.getAttribute("data-block-id")).toBe("2");
    expect(container.textContent).toContain("Frame 0 composto");
    // outra ROM: resposta recusada pelo painel
    mocks.inspectionSonicSsWallCompose.mockResolvedValueOnce(composed(3, 0, { rom_sha256: "b".repeat(64) }));
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={3} />));
    await flush();
    expect(container.querySelector("[data-testid='ss-wall-canvas']")).toBeNull();
  });

  it("mostra erro estruturado sem derrubar e limita o frame a 0..15", async () => {
    mocks.inspectionSonicSsWallCompose.mockRejectedValue({ code: "ss_decode", message: "arte 0x2c5e4: truncated" });
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={1} />));
    await flush();
    expect(container.querySelector("[data-testid='ss-wall-error']")?.textContent).toContain("ss_decode");
    mocks.inspectionSonicSsWallCompose.mockReset();
    mocks.inspectionSonicSsWallCompose.mockResolvedValue(composed(2, 0));
    act(() => root.render(<SonicSsWallPanel sessionId="s1" romSha256={SHA} blockId={2} />));
    await flush();
    const input = container.querySelector("[data-testid='ss-wall-frame']") as HTMLInputElement;
    expect(input.max).toBe("15");
    expect(input.min).toBe("0");
  });
});
