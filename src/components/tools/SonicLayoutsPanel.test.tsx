import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SonicLayoutsPanel } from "./SonicLayoutsPanel";

const mocks = vi.hoisted(() => ({
  inspectionSonicLayouts: vi.fn(),
  inspectionSonicLayoutGrid: vi.fn(),
  inspectionSonicLayoutCell: vi.fn(),
  inspectionSonicLayoutsCancel: vi.fn(),
  inspectionSetLayoutsSelection: vi.fn(),
}));

vi.mock("../../core/ipc/toolsService", () => mocks);

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function makeInfo(sessionId: string, sha: string) {
  return {
    formato: "layouts-info/v1",
    perfil_id: "sonic1_fase_especial_layouts_v1",
    idioma: "pt-BR",
    sessao_id: sessionId,
    rom_sha256: sha,
    rom_tamanho: 531577,
    rom_confere_pin: true,
    representacao: "Mapa de IDs",
    geometria: { linhas: 64, colunas: 64, celula_bytes: 1, stride_ram: 128, base_ram_hex: "ff1020", nivel: "vinculo-estrutural-estatico" },
    layouts: Array.from({ length: 6 }, (_, i) => ({
      indice: i,
      rotulo: `Layout ${i + 1} de 6`,
      stream_offset_hex: "0x65432",
      tabela_slot_hex: "0x1b64c",
      bytes: { bytes_lidos: 634, padding_alinhamento: 0, tamanho_armazenado: 634, saida_bytes: 4096 },
      tokens: 100,
      saida_sha256: "c".repeat(64),
      span_sha256: "d".repeat(64),
      span_confere_pin: true,
      consumo_confere_pin: true,
      referencia: { natureza: "medida externa histórica", plain_sha256: "c".repeat(64), confere: true },
      integridade: i === 5 ? "diverge-da-referencia" : "confere",
      ids_distintos: 12,
      maior_id: 78,
      celulas_zero: 100,
    })),
    camadas: [
      { ordem: 1, titulo: "Enigma entrega bytes", texto: "t1" },
      { ordem: 2, titulo: "O perfil lê IDs", texto: "t2" },
      { ordem: 3, titulo: "O jogo copia para a RAM", texto: "t3" },
    ],
    desconhecidos: ["arte desconhecida"],
    limites: { max_saida_bytes: 4096, max_tokens: 4096, janela_stream_bytes: 8192 },
  };
}

// grade: ID = (linha*64+coluna) % 80
function makeGrid(sessionId: string, sha: string, indice: number) {
  let hex = "";
  for (let i = 0; i < 4096; i += 1) hex += (i % 80).toString(16).padStart(2, "0");
  return { formato: "layout-grid/v1", sessao_id: sessionId, rom_sha256: sha, indice, representacao: "Mapa de IDs", linhas: 64, colunas: 64, ids_hex: hex, saida_sha256: "e".repeat(64) };
}

function makeCell(sessionId: string, sha: string, indice: number, row: number, col: number) {
  const id = (row * 64 + col) % 80;
  return {
    formato: "layout-cell/v1",
    sessao_id: sessionId,
    rom_sha256: sha,
    indice,
    linha: row,
    coluna: col,
    id,
    id_hex: `0x${id.toString(16).padStart(2, "0")}`,
    origem: {
      layout_indice: indice,
      stream_offset_hex: "0x65432",
      tabela_slot_hex: "0x1b64c",
      saida_offset: row * 64 + col,
      saida_offset_hex: `0x${(row * 64 + col).toString(16)}`,
      palavra_indice: Math.floor((row * 64 + col) / 2),
      byte_na_palavra: (row * 64 + col) % 2 === 0 ? "alto" : "baixo",
      endereco_ram_hex: (0xff1020 + row * 128 + col).toString(16),
      explicacao: `Este ID é o byte ${row * 64 + col} da saída do layout ${indice + 1}.`,
    },
    definicao_status: id === 0 ? "id-zero" : id > 78 ? "fora-da-tabela" : "comprovada",
    definicao: id >= 1 && id <= 78
      ? { id_hex: `0x${id.toString(16).padStart(2, "0")}`, registro_endereco_hex: "0x1b738", registro_hex: "0002c5640142", ponteiro_mapeamentos_hex: "0x2c564", byte_inicial_hex: "0x00", campo_hex: "0x0142", slot_ram_hex: "ff4008", nivel: "vinculo-estrutural-estatico", nao_decodificado: ["campo não decodificado"] }
      : null,
    definicao_explicacao: id === 0 ? "O ID 0 não tem registro." : id > 78 ? "nenhuma definição estrutural" : "Registro comprovado.",
  };
}

function setupHappyMocks(sessionId = "s-1", sha = SHA_A) {
  mocks.inspectionSonicLayouts.mockImplementation(async () => makeInfo(sessionId, sha));
  mocks.inspectionSonicLayoutGrid.mockImplementation(async (_s: string, _sha: string, i: number) => makeGrid(sessionId, sha, i));
  mocks.inspectionSonicLayoutCell.mockImplementation(async (_s: string, _sha: string, i: number, r: number, c: number) => makeCell(sessionId, sha, i, r, c));
  mocks.inspectionSonicLayoutsCancel.mockResolvedValue(true);
  mocks.inspectionSetLayoutsSelection.mockImplementation(async () => ({ session_id: sessionId }));
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let container: HTMLDivElement;
let root: Root;

function q(testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid='${testId}']`);
}
function cellEl(row: number, col: number): HTMLElement {
  const el = container.querySelector(`[data-row='${row}'][data-col='${col}'][role='gridcell']`);
  if (!el) throw new Error(`célula ${row},${col} ausente`);
  return el as HTMLElement;
}

async function render(props: Partial<React.ComponentProps<typeof SonicLayoutsPanel>> = {}) {
  await act(async () => {
    root.render(<SonicLayoutsPanel sessionId="s-1" romRevision="base" restoreNonce={0} {...props} />);
  });
  await flush();
}

beforeEach(() => {
  vi.useRealTimers();
  Object.values(mocks).forEach((m) => m.mockReset());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SonicLayoutsPanel", () => {
  it("rotula como Mapa de IDs, mostra as três camadas e os seis layouts", async () => {
    setupHappyMocks();
    await render();
    expect(container.textContent).toContain("Mapa de IDs");
    expect(container.textContent).not.toMatch(/nametable/i);
    expect(q("layouts-camadas")?.children.length).toBe(3);
    for (let i = 0; i < 6; i += 1) expect(q(`layouts-tab-${i}`)).not.toBeNull();
    expect(q("layouts-grid")?.getAttribute("data-state")).toBe("pronto");
    expect(container.querySelectorAll("[role='gridcell']").length).toBe(4096);
    expect(q("layouts-identity")?.getAttribute("data-rom-sha256")).toBe(SHA_A);
    expect(container.textContent).toContain("não são a arte do jogo");
  });

  it("mantém hexadecimais e hashes só nos detalhes técnicos", async () => {
    setupHappyMocks();
    await render();
    const tecnico = q("layouts-tecnico") as HTMLDetailsElement;
    expect(tecnico.tagName).toBe("DETAILS");
    expect(tecnico.open).toBe(false);
    expect(tecnico.textContent).toContain("padding de alinhamento");
    expect(tecnico.textContent).toContain("saída descomprimida");
    const resumo = q("layouts-resumo")?.textContent ?? "";
    expect(resumo).not.toMatch(/[0-9a-f]{40,}/);
  });

  it("seleciona uma célula por clique e mostra coordenada, ID, origem e definição", async () => {
    setupHappyMocks();
    await render();
    await act(async () => cellEl(3, 5).click());
    await flush();
    expect(q("layouts-celula-coord")?.textContent).toContain("linha 3, coluna 5");
    expect(q("layouts-celula-id")?.textContent).toBe("0x25");
    expect(q("layouts-celula-origem")?.textContent).toContain("byte 197");
    expect(q("layouts-celula-definicao")?.getAttribute("data-status")).toBe("comprovada");
    expect(mocks.inspectionSonicLayoutCell).toHaveBeenLastCalledWith("s-1", SHA_A, 0, 3, 5, expect.stringMatching(/^lay-cel-/));
  });

  it("navega por teclado até as bordas e pelo layout e zoom", async () => {
    setupHappyMocks();
    await render();
    const grid = q("layouts-grid") as HTMLElement;
    const key = async (k: string, opts: KeyboardEventInit = {}) => {
      await act(async () => {
        grid.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts }));
      });
      await flush();
    };
    await key("ArrowRight");
    await key("ArrowDown");
    expect(grid.getAttribute("data-selected-row")).toBe("1");
    expect(grid.getAttribute("data-selected-col")).toBe("1");
    await key("End", { ctrlKey: true });
    expect(grid.getAttribute("data-selected-row")).toBe("63");
    expect(grid.getAttribute("data-selected-col")).toBe("63");
    await key("ArrowRight");
    expect(grid.getAttribute("data-selected-col")).toBe("63");
    await key("Home", { ctrlKey: true });
    expect(grid.getAttribute("data-selected-row")).toBe("0");
    await key("PageDown");
    expect(grid.getAttribute("data-selected-row")).toBe("8");
    await key("+");
    expect(q("layouts-zoom")?.getAttribute("data-zoom")).toBe("5");
    await act(async () => (q("layouts-tab-2") as HTMLElement).click());
    await flush();
    expect(grid.getAttribute("data-layout")).toBe("2");
    expect(grid.getAttribute("data-selected-row")).toBe("8");
  });

  it("descarta resposta de célula antiga que chega fora de ordem", async () => {
    setupHappyMocks();
    await render();
    let resolveSlow!: (v: unknown) => void;
    mocks.inspectionSonicLayoutCell.mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }));
    await act(async () => cellEl(1, 1).click());
    await act(async () => cellEl(2, 2).click());
    await flush();
    await act(async () => resolveSlow(makeCell("s-1", SHA_A, 0, 1, 1)));
    await flush();
    expect(q("layouts-celula-coord")?.textContent).toContain("linha 2, coluna 2");
    expect(q("layouts-celula")?.getAttribute("data-row")).toBe("2");
    expect(Number(q("layouts-descartadas")?.textContent)).toBeGreaterThanOrEqual(1);
    expect(mocks.inspectionSonicLayoutsCancel).toHaveBeenCalled();
  });

  it("recusa resposta de outra ROM (identidade diferente) mesmo para a célula certa", async () => {
    setupHappyMocks();
    await render();
    mocks.inspectionSonicLayoutCell.mockImplementationOnce(async () => makeCell("s-1", SHA_B, 0, 4, 4));
    await act(async () => cellEl(4, 4).click());
    await flush();
    expect(q("layouts-celula-definicao")).toBeNull();
    expect(Number(q("layouts-descartadas")?.textContent)).toBeGreaterThanOrEqual(1);
  });

  it("descarta respostas de uma sessão antiga depois da troca de sessão", async () => {
    setupHappyMocks();
    let resolveOld!: (v: unknown) => void;
    mocks.inspectionSonicLayouts.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    await render({ sessionId: "s-old" });
    setupHappyMocks("s-new", SHA_B);
    await render({ sessionId: "s-new" });
    expect(q("layouts-identity")?.getAttribute("data-session-id")).toBe("s-new");
    await act(async () => resolveOld(makeInfo("s-old", SHA_A)));
    await flush();
    expect(q("layouts-identity")?.getAttribute("data-session-id")).toBe("s-new");
    expect(q("layouts-identity")?.getAttribute("data-rom-sha256")).toBe(SHA_B);
  });

  it("relê a identidade quando o núcleo recusa por 'ROM mudou'", async () => {
    setupHappyMocks();
    await render();
    mocks.inspectionSonicLayoutCell.mockRejectedValueOnce({ code: "layouts_rom_mudou", message: "a ROM da sessão mudou" });
    mocks.inspectionSonicLayouts.mockImplementation(async () => makeInfo("s-1", SHA_B));
    mocks.inspectionSonicLayoutGrid.mockImplementation(async (_s: string, _sha: string, i: number) => makeGrid("s-1", SHA_B, i));
    mocks.inspectionSonicLayoutCell.mockImplementation(async (_s: string, _sha: string, i: number, r: number, c: number) => makeCell("s-1", SHA_B, i, r, c));
    await act(async () => cellEl(6, 6).click());
    await flush();
    await flush();
    expect(q("layouts-identity")?.getAttribute("data-rom-sha256")).toBe(SHA_B);
  });

  it("mostra erro estruturado do núcleo sem derrubar o painel", async () => {
    setupHappyMocks();
    await render();
    mocks.inspectionSonicLayoutCell.mockRejectedValueOnce({ code: "layouts_celula_fora_da_grade", message: "fora da grade" });
    await act(async () => cellEl(9, 9).click());
    await flush();
    expect(q("layouts-celula-erro")?.textContent).toContain("layouts_celula_fora_da_grade");
    expect(q("layouts-grid")).not.toBeNull();
  });

  it("ROM incompatível: mostra o erro do núcleo e nenhuma grade", async () => {
    mocks.inspectionSonicLayouts.mockRejectedValue({ code: "consumers_sitios_divergentes", message: "37 sítios divergem" });
    await render();
    expect(q("layouts-error")?.textContent).toContain("consumers_sitios_divergentes");
    expect(q("layouts-grid")).toBeNull();
  });

  it("restaura a seleção salva e avisa quando a ROM é idêntica", async () => {
    setupHappyMocks();
    await render({ savedSelection: { layout_index: 3, row: 10, col: 20, zoom: 7, rom_sha256: SHA_A } });
    expect(q("layouts-grid")?.getAttribute("data-layout")).toBe("3");
    expect(q("layouts-grid")?.getAttribute("data-selected-row")).toBe("10");
    expect(q("layouts-grid")?.getAttribute("data-selected-col")).toBe("20");
    expect(q("layouts-zoom")?.getAttribute("data-zoom")).toBe("7");
    expect(q("layouts-notice")?.textContent).toContain("ROM é idêntica");
  });

  it("restaura mas avisa quando a ROM mudou desde que foi salva", async () => {
    setupHappyMocks();
    await render({ savedSelection: { layout_index: 1, row: 1, col: 2, zoom: 4, rom_sha256: SHA_B } });
    expect(q("layouts-notice")?.textContent).toContain("a ROM mudou desde que foi salva");
  });

  it("só persiste a seleção por ação do usuário, com identidade da ROM", async () => {
    setupHappyMocks();
    await render();
    expect(mocks.inspectionSetLayoutsSelection).not.toHaveBeenCalled();
    await act(async () => cellEl(5, 6).click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });
    expect(mocks.inspectionSetLayoutsSelection).toHaveBeenCalledWith("s-1", { layout_index: 0, row: 5, col: 6, zoom: 4, rom_sha256: SHA_A });
  });
});
