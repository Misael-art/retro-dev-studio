import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deserializeNodeGraph } from "../../core/nodegraph/nodeDefinitions";
import { withRomPath } from "../../core/nodegraph/profileGraphBridge";
import { useEditorStore } from "../../core/store/editorStore";
import { isCardEditableParam } from "./NodeGraphEditor";
import ProfileGraphBridgePanel from "./ProfileGraphBridgePanel";

const mocks = vi.hoisted(() => ({ rexProfileEdit: vi.fn() }));
vi.mock("../../core/ipc/toolsService", () => mocks);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DIR = "data/rex_profiles/integration_20261007/grafos-gerados";
const S1 = readFileSync(`${DIR}/grafo-s1-1340c.nodegraph.json`, "utf8");
const D1 = readFileSync(`${DIR}/grafo-delta-16914.nodegraph.json`, "utf8");
const graphOf = (raw: string, rom = "/roms/x.bin") => deserializeNodeGraph(rom ? withRomPath(raw, rom) : raw);
const setValue = (g: ReturnType<typeof graphOf>, campo: string, value: number | string) => {
  g.nodes.find((n) => n.params.campo === campo)!.params.value = value;
};

function resposta(over: Record<string, unknown> = {}) {
  return {
    get request_id() { return mocks.rexProfileEdit.mock.calls[mocks.rexProfileEdit.mock.calls.length - 1]?.[0]?.request_id ?? ""; },
    rom_sha256_before: "a".repeat(64), rom_sha256_after: "b".repeat(64), identity_rom_sha256: "", profile_id: "m68k.platformer_jump.v1", profile_sha256: "", instance_offset: 0,
    values_applied: [["imp", 2304]], patched_path: "/saida/x.bin", ips_path: "/saida/x.ips", ips_sha256: "c".repeat(64),
    patches: [], size_unchanged: true, original_untouched: true, ips_reproduces_copy: true, values_after: [["imp", 2304]], avisos: [], ...over,
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.rexProfileEdit.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const q = (id: string) => container.querySelector(`[data-testid='${id}']`) as HTMLElement | null;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
function type(id: string, value: string) {
  const el = q(id) as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}
const render = (g: ReturnType<typeof graphOf>) => act(() => root.render(<ProfileGraphBridgePanel graph={{ ...g, nodes: [...g.nodes], edges: [...g.edges] }} />));
const gen = () => q("jump-bridge-generate") as HTMLButtonElement;
const idOf = (raw: string) => (JSON.parse(raw) as { nodes: { params: Record<string, unknown> }[] }).nodes.find((n) => n.params.ponte_edicao === 1)!.params;

describe("ProfileGraphBridgePanel (canvas → cópia da ROM)", () => {
  it("grafo comum não mostra nada; o alvo (ROM, SHA, instância) e o escopo aparecem no grafo da ponte", () => {
    act(() => root.render(<ProfileGraphBridgePanel graph={deserializeNodeGraph(null)} />));
    expect(q("jump-bridge")).toBeNull();
    render(graphOf(S1));
    expect(q("jump-bridge-alvo")?.textContent).toContain("x.bin");
    expect(q("jump-bridge-alvo")?.textContent).toContain("instância 0x1340C");
    expect(container.textContent).toContain("não compila um projeto");
    expect(container.textContent).toContain("Não suportado: remover nós, mudar conexões");
    expect(container.textContent).toContain("domínio aceito pelo perfil não é o mesmo que");
  });

  it("sem mudança não gera; editar nós lista as diferenças", () => {
    const g = graphOf(S1);
    render(g);
    expect(q("jump-bridge-none")).not.toBeNull();
    expect(gen().disabled).toBe(true);
    setValue(g, "imp", 2304);
    render(g);
    expect(q("jump-bridge-edits")?.textContent).toContain("1664 → 2304");
  });

  it("campos duplicados bloqueiam e dizem quais nós; nada é enviado", () => {
    const g = graphOf(S1);
    const imp = g.nodes.find((n) => n.params.campo === "imp")!;
    const copia = structuredClone(imp);
    copia.id = "imp_2";
    copia.params.value = 2500;
    imp.params.value = 2304;
    g.nodes.push(copia);
    render(g);
    type("jump-bridge-outdir", "/saida");
    expect(q("jump-bridge-problems")?.textContent).toContain("duplicado");
    expect(q("jump-bridge-problems")?.textContent).toContain("imp_2");
    expect(gen().disabled).toBe(true);
    expect(mocks.rexProfileEdit).not.toHaveBeenCalled();
  });

  it("grafo com topologia alterada não é apresentado como lógica aplicada; posições livres continuam permitidas", () => {
    const g = graphOf(S1);
    setValue(g, "imp", 2304);
    for (const n of g.nodes) { n.x += 30; n.y += 30; n.label = `${n.label}!`; }
    render(g);
    type("jump-bridge-outdir", "/saida");
    expect(q("jump-bridge-estrutura")).toBeNull();
    expect(gen().disabled).toBe(false);
    const quebrado = graphOf(S1);
    setValue(quebrado, "imp", 2304);
    quebrado.nodes = quebrado.nodes.filter((n) => n.id !== "vel");
    render(quebrado);
    type("jump-bridge-outdir", "/saida");
    expect(q("jump-bridge-estrutura")?.textContent).toContain("deixou de representar a lógica da ROM");
    expect(q("jump-bridge-estrutura")?.textContent).toContain("NÃO serão aplicados");
    expect(gen().disabled).toBe(true);
  });

  it("gera enviando o GRAFO (não params), a identidade da ROM e a instância; mostra 'cópia atual' e as garantias", async () => {
    const id = idOf(S1);
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, instance_offset: id.jump_offset }));
    const g = graphOf(S1);
    setValue(g, "imp", 2304);
    render(g);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    const req = mocks.rexProfileEdit.mock.calls[0][0];
    expect(req.params).toBeUndefined();
    expect(typeof req.graph_json).toBe("string");
    expect(JSON.parse(req.graph_json).nodes.length).toBeGreaterThan(5);
    expect(req).toMatchObject({ rom_path: "/roms/x.bin", profile_id: "m68k.platformer_jump.v1", profile_sha256: null, instance_offset: 0x1340c, output_dir: "/saida", expected_rom_sha256: id.rom_sha256 });
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("atual");
    expect(q("jump-bridge-result")?.textContent).toContain("corresponde aos valores atuais");
    expect(q("jump-bridge-result-flags")?.textContent).toContain("IPS reproduz a cópia: sim");
  });

  it("'Jogar esta cópia' pede ao emulador existente a CÓPIA, nunca a ROM original", async () => {
    const id = idOf(S1);
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, instance_offset: id.jump_offset }));
    const g = graphOf(S1);
    setValue(g, "imp", 2304);
    render(g);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    useEditorStore.setState({ emulatorLaunchRequest: null });
    await act(async () => { q("jump-play-copy")!.click(); });
    expect(useEditorStore.getState().emulatorLaunchRequest?.romPath).toBe("/saida/x.bin");
    expect(useEditorStore.getState().emulatorLaunchRequest?.romPath).not.toBe("/roms/x.bin");
  });

  it("resposta de A pendente depois da troca para B NÃO aparece (promise controlada, sem sleep)", async () => {
    let resolverA: (v: unknown) => void = () => undefined;
    mocks.rexProfileEdit.mockImplementationOnce(() => new Promise((r) => { resolverA = r; }));
    const a = graphOf(S1);
    setValue(a, "imp", 2304);
    render(a);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    // troca para outra ROM/instância (B) enquanto A está pendente
    const b = graphOf(D1, "/roms/delta.bin");
    setValue(b, "imp", 2304);
    render(b);
    expect(q("jump-bridge")?.getAttribute("data-instance")).toBe(String(0x16914));
    const ida = idOf(S1);
    await act(async () => { resolverA(resposta({ identity_rom_sha256: ida.rom_sha256, instance_offset: ida.jump_offset })); await Promise.resolve(); });
    await flush();
    expect(q("jump-bridge-result")).toBeNull();
    expect(q("jump-bridge-error")).toBeNull();
  });

  it("erro de A pendente depois da troca para B também não aparece", async () => {
    let rejeitarA: (e: unknown) => void = () => undefined;
    mocks.rexProfileEdit.mockImplementationOnce(() => new Promise((_, rej) => { rejeitarA = rej; }));
    const a = graphOf(S1);
    setValue(a, "imp", 2304);
    render(a);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    const b = graphOf(D1, "/roms/delta.bin");
    render(b);
    await act(async () => { rejeitarA({ code: "io_error", message: "falha de A" }); await Promise.resolve(); });
    await flush();
    expect(q("jump-bridge-error")).toBeNull();
  });

  it("após editar de novo a cópia anterior é identificada como dos valores anteriores; voltar ao valor a torna atual", async () => {
    const id = idOf(S1);
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, instance_offset: id.jump_offset }));
    const g = graphOf(S1);
    setValue(g, "imp", 2304);
    render(g);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("atual");
    setValue(g, "imp", 2500);
    render(g);
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("valores-anteriores");
    expect(q("jump-bridge-result-obsoleto")?.textContent).toContain("imp=2304");
    expect(q("jump-bridge-result")?.textContent).not.toContain("corresponde aos valores atuais");
    setValue(g, "imp", 2304);
    render(g);
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("atual");
  });

  it("erro do núcleo (identidade/divergência) aparece sem derrubar e sem resultado", async () => {
    mocks.rexProfileEdit.mockRejectedValue({ code: "identity_mismatch", message: "a ROM em disco não é a do grafo" });
    const g = graphOf(S1);
    setValue(g, "impw", 1000);
    render(g);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    expect(q("jump-bridge-error")?.textContent).toContain("identity_mismatch");
    expect(q("jump-bridge-result")).toBeNull();
  });

  it("sem caminho de ROM guardado pede o caminho (campo com seletor)", () => {
    const g = graphOf(S1, "");
    setValue(g, "impw", 1000);
    render(g);
    type("jump-bridge-outdir", "/saida");
    expect(gen().disabled).toBe(true);
    expect(q("jump-bridge-rom")).not.toBeNull();
    expect(q("jump-bridge-rom-browse")).not.toBeNull();
    type("jump-bridge-rom", "/roms/outra.bin");
    expect(gen().disabled).toBe(false);
  });

  it("grafo de OUTRO perfil (formato atual): identidade, hash e pasta de perfis vão no pedido, sem nada fixo", async () => {
    const MINI = readFileSync("data/rex_profiles/integration_20261009/conformidade/grafo-mini.nodegraph.json", "utf8");
    const g = deserializeNodeGraph(withRomPath(MINI, "/roms/mini.bin", "/perfis"));
    const id = idOf(MINI);
    setValue(g, "top", 7);
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, profile_id: "m68k.mini_gate.v1", profile_sha256: id.perfil_sha256, instance_offset: 0x40, values_applied: [["top", 7]] }));
    render(g);
    expect(q("jump-bridge")?.getAttribute("data-profile")).toBe("m68k.mini_gate.v1");
    expect(q("jump-bridge")?.getAttribute("data-instance")).toBe(String(0x40));
    expect(q("jump-bridge-perfil")?.textContent).toContain("m68k.mini_gate.v1");
    expect(q("jump-bridge-perfil")?.textContent).toContain("revisão 1");
    expect(q("jump-bridge-perfil")?.textContent).toContain("não prova que o jogo executa");
    expect(q("jump-bridge-edits")?.textContent).toContain("100000 → 7");
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    expect(mocks.rexProfileEdit.mock.calls[0][0]).toMatchObject({
      rom_path: "/roms/mini.bin", profile_id: "m68k.mini_gate.v1", profile_sha256: id.perfil_sha256, instance_offset: 0x40,
      expected_rom_sha256: id.rom_sha256, profiles_dir: "/perfis",
    });
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("atual");
  });

  it("grafo salvo antes do vínculo por hash diz isso; resposta de outro perfil é descartada", async () => {
    const g = graphOf(S1);
    const id = idOf(S1);
    setValue(g, "imp", 2304);
    render(g);
    expect(q("jump-bridge-perfil")?.textContent).toContain("antes do vínculo por SHA-256 do perfil");
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, profile_id: "m68k.outro.v1", instance_offset: id.jump_offset }));
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    expect(q("jump-bridge-result")).toBeNull();
  });

  it("perfil incompatível na reabertura (profile-mismatch) aparece como erro e nada é mostrado como gerado", async () => {
    const g = graphOf(S1);
    setValue(g, "imp", 2304);
    mocks.rexProfileEdit.mockRejectedValue({ code: "profile-mismatch", message: "o perfil carregado não é o que gerou este grafo" });
    render(g);
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    expect(q("jump-bridge-error")?.textContent).toContain("profile-mismatch");
    expect(q("jump-bridge-result")).toBeNull();
  });

  it("classe semântica no canvas: operações derivadas, parte opaca, só o limiar vira plano e o pedido leva o grafo", async () => {
    const GATE = readFileSync("data/rex_profiles/integration_20261009/conformidade/grafo-gate.nodegraph.json", "utf8");
    const g = deserializeNodeGraph(withRomPath(GATE, "/roms/gate.bin"));
    const id = idOf(GATE);
    render(g);
    expect(q("jump-bridge")?.getAttribute("data-profile")).toBe("m68k.counter_threshold_state_gate.v1");
    expect(q("jump-bridge")?.getAttribute("data-instance")).toBe(String(0x400));
    expect(q("jump-bridge-semantica")?.getAttribute("data-selecao")).toBe("declared_region");
    expect(q("jump-bridge-semantica")?.textContent).toContain("operações derivadas dos bytes da ROM");
    expect(q("jump-bridge-semantica")?.textContent).toContain("declarada pelo usuário");
    expect(q("jump-bridge-semantica")?.textContent).toContain("Parte(s) opaca(s)");
    expect(q("jump-bridge-semantica")?.textContent).toContain("não é compilado");
    expect(q("jump-bridge-none")).not.toBeNull();
    g.nodes.find((n) => n.type === "rom_counter_compare")!.params.threshold = 100;
    mocks.rexProfileEdit.mockResolvedValue(resposta({ identity_rom_sha256: id.rom_sha256, profile_id: id.perfil, profile_sha256: id.perfil_sha256, instance_offset: 0x400, values_applied: [["threshold", 100]], values_after: [["threshold", 100]] }));
    render(g);
    expect(q("jump-bridge-edits")?.textContent).toContain("40 → 100");
    expect(q("jump-bridge-estrutura")).toBeNull();
    type("jump-bridge-outdir", "/saida");
    await act(async () => { gen().click(); });
    await flush();
    const req = mocks.rexProfileEdit.mock.calls[0][0];
    expect(req).toMatchObject({ profile_id: "m68k.counter_threshold_state_gate.v1", profile_sha256: id.perfil_sha256, instance_offset: 0x400, expected_rom_sha256: id.rom_sha256 });
    expect(JSON.parse(req.graph_json).nodes.find((n: { type: string }) => n.type === "rom_counter_compare").params.threshold).toBe(100);
    expect(q("jump-bridge-result")?.getAttribute("data-relacao")).toBe("atual");
    // operador trocado no canvas: deixa de ser a lógica da ROM e o botão trava
    g.nodes.find((n) => n.type === "rom_counter_compare")!.params.operator = ">=";
    render(g);
    expect(q("jump-bridge-estrutura")?.textContent).toContain("deixou de representar a lógica da ROM");
    expect(gen().disabled).toBe(true);
  });

  it("no cartão do canvas só o valor declarado pelo nó editável é editável, em qualquer perfil", () => {
    const gate = deserializeNodeGraph(readFileSync("data/rex_profiles/integration_20261009/conformidade/grafo-gate.nodegraph.json", "utf8"));
    const cmp = gate.nodes.find((n) => n.type === "rom_counter_compare")!;
    expect(isCardEditableParam(cmp, "threshold")).toBe(true);
    for (const k of ["operator", "address", "faixa", "valor_original", "campo", "source_mappings"]) expect(isCardEditableParam(cmp, k)).toBe(false);
    const add = gate.nodes.find((n) => n.type === "rom_counter_add")!;
    expect(Object.keys(add.params).some((k) => isCardEditableParam(add, k))).toBe(false);
    const call = gate.nodes.find((n) => n.type === "rom_external_call")!;
    expect(Object.keys(call.params).some((k) => isCardEditableParam(call, k))).toBe(false);
    // o pulo continua igual: o nó editável edita `value`; os outros var_set não
    const s1 = graphOf(S1);
    expect(isCardEditableParam(s1.nodes.find((n) => n.params.campo === "imp")!, "value")).toBe(true);
    expect(isCardEditableParam(s1.nodes.find((n) => n.id === "vel")!, "value")).toBe(false);
  });
});

it("comparação curada: resposta de outro pedido não vira resultado da sessão atual", async () => {
  const raw = readFileSync("data/rex_profiles/rea_lab_20261015/integration-package/graph.nodegraph.json", "utf8");
  const g = graphOf(raw), id = idOf(raw);
  g.nodes.find(n => n.id === "compare")!.params.threshold = 6;
  mocks.rexProfileEdit.mockResolvedValue(resposta({ request_id: "outra-sessao", identity_rom_sha256: id.rom_sha256,
    profile_id: id.perfil, profile_sha256: id.perfil_sha256, instance_offset: id.entry }));
  render(g); type("jump-bridge-outdir", "/saida");
  expect(q("jump-bridge-compare")?.textContent).toContain("Comparação assinada de 32 bits (>=)");
  const compare = g.nodes.find(n => n.id === "compare")!;
  expect(isCardEditableParam(compare, "threshold")).toBe(true);
  for (const field of ["operator", "address", "signed", "source_mappings"]) expect(isCardEditableParam(compare, field)).toBe(false);
  await act(async () => { gen().click(); }); await flush();
  expect(q("jump-bridge-result")).toBeNull();
});


it("copy-grid: shows memory contract, edits only width and discards stale request response", async () => {
  const raw = readFileSync("data/rex_profiles/integration_20261016/copy-grid-conformance.nodegraph.json", "utf8");
  const g=graphOf(raw), id=idOf(raw), copy=g.nodes.find(n=>n.type==="rom_copy_grid")!;
  copy.params.bytes_per_cell=2;
  mocks.rexProfileEdit.mockResolvedValue(resposta({request_id:"older-copy-request",identity_rom_sha256:id.rom_sha256,profile_id:id.perfil,profile_sha256:id.perfil_sha256,instance_offset:0x400}));
  render(g);type("jump-bridge-outdir","/saida");
  expect(q("jump-bridge-copy")?.textContent).toContain("0xFF5000 → 0xFF7000");
  expect(q("jump-bridge-copy")?.textContent).toContain("Só a largura 1↔2 é editável");
  expect(q("jump-bridge-copy")?.textContent).toContain("largura/incremento 2 bytes, stride 32, span 112 bytes");
  expect(isCardEditableParam(copy,"bytes_per_cell")).toBe(true);
  for(const field of ["source_address","destination_address","rows","columns","row_stride_bytes","source_mappings"]) expect(isCardEditableParam(copy,field)).toBe(false);
  await act(async()=>{gen().click();});await flush();
  expect(mocks.rexProfileEdit.mock.calls[0][0].profile_id).toBe("m68k.copy_grid.v1");
  expect(q("jump-bridge-result")).toBeNull();
});
