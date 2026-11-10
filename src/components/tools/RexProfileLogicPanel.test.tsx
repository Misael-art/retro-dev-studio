import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "../../core/store/editorStore";
import { evidenciaPorOrigem, observacaoAtual, parseHexList, RexProfileLogicPanel } from "./RexProfileLogicPanel";

const mocks = vi.hoisted(() => ({ rexProfileLocate: vi.fn(), rexProfileEdit: vi.fn() }));
vi.mock("../../core/ipc/toolsService", () => mocks);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("./ToolNotices", () => ({ ExperimentalNotice: ({ summary }: { summary: string }) => <div data-testid="notice">{summary}</div> }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PERFIL = "m68k.platformer_jump.v1";
const PSHA = "e".repeat(64);

function resposta(over: Record<string, unknown> = {}) {
  return {
    request_id: "r", app_session: SESSAO, observations: [{ kind: "copy_reread", session: SESSAO, request_id: "r" }], rom_sha256_before: "a".repeat(64), rom_sha256_after: "b".repeat(64), identity_rom_sha256: "a".repeat(64),
    profile_id: PERFIL, profile_sha256: PSHA, instance_offset: 0x1340c,
    values_applied: [["imp", 2304]], patched_path: "/saida/x.bin", ips_path: "/saida/x.ips", ips_sha256: "c".repeat(64),
    patches: [{ offset: 0x1340e, old: [6, 128], new: [9, 0] }], bytes_changed: 2, size_unchanged: true, original_untouched: true, ips_reproduces_copy: true,
    values_after: [["imp", 2304], ["impw", 896]], avisos: [], checksum_updated: false, ...over,
  };
}

const SESSAO = "5e55a0a7ua1000000";

function registro(over: Record<string, unknown> = {}) {
  return {
    id: "efeito_impulso.sonic1.motor_de_perfis", profile_id: PERFIL, claim_id: "efeito_impulso",
    measured_under: { profile_form: "data", profile_sha256: PSHA, commit: "c".repeat(40), binary_sha256: "d".repeat(64) },
    applies_to_profile_sha256: [PSHA], carried_by: "", rom_sha256: "a".repeat(64), instance_offsets: [0x1340c],
    report: { path: "data/x/jump-gameplay-report.json", sha256: "f".repeat(64) }, ...over,
  };
}

function medicao(over: Record<string, unknown> = {}) {
  return { claim: "efeito_impulso", level: "L5", level_label: "edição com efeito previsto e medido", values: [1664, 2304], origin: "curated", applicability: "this_instance", records: [registro()], inherited: false, declared_scope_matches: true, conditions: "GHZ", refs: ["docs/fecho.md"], ...over };
}

function field(name: string, value: number, min: number, max: number, offs: number[], over: Record<string, unknown> = {}) {
  return { name, label: `Campo ${name}`, value, min, max, rom_offsets: offs, bus_addresses: offs, width: 2, signed: true, little_endian: false, static_level: "L2", static_label: "consistência interna verificada", claims: [], ...over };
}

function perfil(over: Record<string, unknown> = {}) {
  return {
    class: "signature", selection_modes: ["signature"], id: PERFIL, revision: 2, sha256: PSHA, title: "Pulo de plataforma", summary: "s", status: "experimental", origin: "builtin", file: "m68k.platformer_jump.v1.json",
    arch: "m68k · big-endian · barramento de 24 bits", rom_binding: "signature", instance_param: "jump_offset", author: "integrador", created: "2026-10-08", derived_from: ["docs/x.md"],
    editable: ["Impulso do pulo: 1..32767 (inteiro de 16 bits com sinal, big-endian)"], limits: ["Altura e teto só aparecem quando o pareamento com o pulo é inequívoco."],
    unknown: ["cap, imps, impw e cutw não foram verificados em execução"],
    claims: [{ id: "efeito_impulso", level: "L5", level_label: "edição com efeito previsto e medido", statement: "Trocar o impulso eleva o ápice.", fields: ["imp"], values: [["imp", [1664, 2304]]], roms: [["a".repeat(64), [0x1340c]]], conditions: "GHZ", refs: ["docs/fecho.md"], origin: "curated", records: [registro()] }],
    ...over,
  };
}

function instancia(withHeight = true, over: Record<string, unknown> = {}) {
  return {
    selection: { mode: "signature", label: "assinatura de bytes declarada pelo perfil; a forma casou nesta ROM" },
    operations: [] as Record<string, unknown>[],
    declared: ["padrões, relações, campos, domínios, notas e projeção vêm do perfil (dado)"],
    region_exits: [] as number[],
    instance_offset: 0x1340c,
    instance_bus_address: 0x1340c,
    anchor_pattern: "jump",
    links: withHeight ? [{ relation: "pair_height", pattern: "height", file_offset: 0x13498 }] : [],
    fields: [
      field("imp", 1664, 1, 32767, [0x1340e], withHeight ? { claims: [medicao()] } : { static_level: "L1", static_label: "forma estática reconhecida" }),
      field("impw", 896, 1, 32767, [0x13418], withHeight ? {} : { static_level: "L1", static_label: "forma estática reconhecida" }),
      ...(withHeight ? [field("cut", -1024, -32767, -1, [0x1349f]), field("cap", -4032, -32767, -1, [0x134c6, 0x134ce])] : []),
    ],
    notes: ["forma confirmada", withHeight ? "altura em 0x13498" : "altura não pareada: campos de corte e teto NÃO são oferecidos"],
    details: [["status", "+22"], ["velocidade vertical", "+12"]],
    captures: [
      { source: "anchor", name: "st", role: "ea_displacement", value: 0x22, file_offset: 0x13414, designates_bus_address: null, designates_file_offset: null },
      { source: "pair_height", name: "held", role: "bus_address", value: 0xf602, file_offset: 0x134b2, designates_bus_address: 0xfff602, designates_file_offset: null },
    ],
    ambiguities: [],
    graph_json: '{"version":1,"nodes":[],"edges":[]}',
    consumer_observed: false,
    observations: [{ kind: "static_form_matched", session: SESSAO, request_id: "l" }],
    ...over,
  };
}

function locate(sha = "a".repeat(64), withHeight = true) {
  return {
    request_id: "l",
    app_session: SESSAO,
    rom_sha256: sha,
    rom_size: 531577,
    matches: [{ profile: perfil(), instances: [instancia(withHeight)], rejected_by_constraint: 0, bound: true, error: null as null | { code: string; message: string } }],
    rejected: [] as { file: string; rule: string; message: string }[],
    limites: ["Localização por assinatura de bytes: prova a forma, não o uso em gameplay."],
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const q = (id: string) => container.querySelector(`[data-testid='${id}']`) as HTMLElement | null;

function type(id: string, value: string) {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}

async function open(rom = "/rom.bin") {
  act(() => root.render(<RexProfileLogicPanel romPath={rom} />));
  await act(async () => { q("jump-locate")!.click(); });
  await flush();
}

describe("RexProfileLogicPanel", () => {
  it("sem ROM não localiza; com ROM mostra instância, campos com faixa e limites", async () => {
    act(() => root.render(<RexProfileLogicPanel romPath="" />));
    expect((q("jump-locate") as HTMLButtonElement).disabled).toBe(true);
    mocks.rexProfileLocate.mockResolvedValue(locate());
    await open();
    expect(q("jump-instance")?.getAttribute("data-jump-offset")).toBe(String(0x1340c));
    expect(q("jump-field-imp")?.textContent).toContain("1..32767");
    expect(q("jump-field-cut")?.textContent).toContain("-32767..-1");
    expect(q("jump-limits")?.textContent).toContain("não o uso em gameplay");
  });

  it("valor inválido ou fora da faixa bloqueia o botão; valor válido habilita (com pasta de saída)", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    await open();
    const gen = () => (q("jump-generate") as HTMLButtonElement).disabled;
    type("jump-outdir", "/saida");
    expect(gen()).toBe(true); // nada alterado
    type("jump-input-imp", "0");
    expect(q("jump-invalid")).not.toBeNull();
    expect(gen()).toBe(true);
    type("jump-input-imp", "abc");
    expect(gen()).toBe(true);
    type("jump-input-cut", "5"); // cut é negativo
    expect(gen()).toBe(true);
    type("jump-input-cut", "-1536");
    type("jump-input-imp", "1664"); // igual ao atual = sem mudança do imp
    expect(q("jump-invalid")).toBeNull();
    expect(gen()).toBe(false);
  });

  it("gera só os campos alterados, com a identidade da LOCALIZAÇÃO, e mostra o resultado como cópia atual", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockResolvedValue(resposta());
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(mocks.rexProfileEdit).toHaveBeenCalledTimes(1);
    const req = mocks.rexProfileEdit.mock.calls[0][0];
    expect(req.values).toEqual({ imp: 2304 });
    expect(req.instance_offset).toBe(0x1340c);
    expect(req.profile_id).toBe(PERFIL);
    expect(req.profile_sha256).toBe(PSHA); // identidade do perfil da localização
    expect(req.output_dir).toBe("/saida");
    expect(req.expected_rom_sha256).toBe("a".repeat(64)); // identidade da localização, nunca omitida
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("atual");
    expect(q("jump-result-flags")?.textContent).toContain("ROM original intacta: sim");
    expect(q("jump-result-flags")?.textContent).toContain("IPS reproduz a cópia: sim");
    expect(q("jump-result")?.textContent).toContain("corresponde aos valores atuais");
  });

  it("'Jogar esta cópia' usa o carregador existente do emulador com o caminho da cópia", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockResolvedValue(resposta());
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    useEditorStore.setState({ emulatorLaunchRequest: null });
    await act(async () => { q("jump-play-copy")!.click(); });
    expect(useEditorStore.getState().emulatorLaunchRequest?.romPath).toBe("/saida/x.bin");
  });

  it("o formulário mostra ROM/alvo, o que é suportado e que gerar cópia não é compilar; pasta tem seletor", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    await open("/roms/sonic.bin");
    expect(q("jump-alvo")?.textContent).toContain("sonic.bin");
    expect(q("jump-alvo")?.textContent).toContain("instância 0x01340C");
    expect(container.textContent).toContain("NÃO compila um projeto");
    expect(q("jump-outdir-browse")).not.toBeNull();
  });

  it("A pendente → troca de instância → resposta de A NÃO aparece (promise controlada)", async () => {
    const duas = locate();
    duas.matches[0].instances.push(instancia(true, { instance_offset: 0x1a170 }));
    mocks.rexProfileLocate.mockResolvedValue(duas);
    let resolverA: (v: unknown) => void = () => undefined;
    mocks.rexProfileEdit.mockImplementationOnce(() => new Promise((r) => { resolverA = r; }));
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await act(async () => { q("jump-tab-1")!.click(); });
    await act(async () => { resolverA(resposta()); await Promise.resolve(); });
    await flush();
    expect(q("jump-instance")?.getAttribute("data-jump-offset")).toBe(String(0x1a170));
    expect(q("jump-result")).toBeNull();
    // voltando à instância A, o resultado de A também não foi guardado (resolveu fora de contexto)
    await act(async () => { q("jump-tab-0")!.click(); });
    expect(q("jump-result")).toBeNull();
  });

  it("A pendente → troca de ROM → resposta de A NÃO aparece", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    let resolverA: (v: unknown) => void = () => undefined;
    mocks.rexProfileEdit.mockImplementationOnce(() => new Promise((r) => { resolverA = r; }));
    await open("/a.bin");
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    act(() => root.render(<RexProfileLogicPanel romPath="/b.bin" />));
    await act(async () => { resolverA(resposta()); await Promise.resolve(); });
    await flush();
    expect(q("jump-result")).toBeNull();
    expect(q("jump-instance")).toBeNull();
  });

  it("depois de editar de novo, a cópia anterior é identificada como dos valores anteriores", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockResolvedValue(resposta());
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("atual");
    type("jump-input-imp", "2500");
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("valores-anteriores");
    expect(q("jump-result-obsoleto")?.textContent).toContain("imp=2304");
    type("jump-input-imp", "2304");
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("atual");
  });

  it("ROM trocada entre localizar e gerar: o núcleo recusa (identity_mismatch) e a interface mostra, sem resultado", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockRejectedValue({ code: "identity_mismatch", message: "a ROM em disco não é a da localização" });
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(q("jump-failure")?.textContent).toContain("identity_mismatch");
    expect(q("jump-result")).toBeNull();
  });

  it("instância sem altura pareada não oferece corte nem teto e diz por quê", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate("a".repeat(64), false));
    await open();
    expect(q("jump-field-cut")).toBeNull();
    expect(q("jump-field-cap")).toBeNull();
    expect(q("jump-instance")?.textContent).toContain("NÃO são oferecidos");
  });

  it("ROM sem lógica reconhecida diz isso sem erro; erro estruturado aparece sem derrubar", async () => {
    const vazio = locate();
    vazio.matches[0].instances = [];
    mocks.rexProfileLocate.mockResolvedValue(vazio);
    await open();
    expect(q("jump-none")?.textContent).toContain("Nenhuma lógica reconhecida");
    mocks.rexProfileLocate.mockRejectedValue({ code: "invalid_request", message: "ROM inacessível" });
    await act(async () => { q("jump-locate")!.click(); });
    await flush();
    expect(q("jump-error")?.textContent).toContain("invalid_request");
    expect(q("jump-none")).toBeNull();
  });

  it("Abrir como nodes entrega o grafo e a ROM e mostra o motivo se o editor recusar", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    const abrir = vi.fn().mockResolvedValueOnce({ ok: false, message: "Selecione uma entidade na cena" }).mockResolvedValueOnce({ ok: true, message: "Grafo do pulo aplicado" });
    act(() => root.render(<RexProfileLogicPanel romPath="/rom.bin" onOpenAsNodes={abrir} />));
    await act(async () => { q("jump-locate")!.click(); });
    await flush();
    await act(async () => { q("jump-open-nodes")!.click(); });
    await flush();
    expect(abrir).toHaveBeenCalledWith('{"version":1,"nodes":[],"edges":[]}', "/rom.bin", "");
    expect(q("jump-open-msg")?.getAttribute("data-ok")).toBe("nao");
    expect(q("jump-open-msg")?.textContent).toContain("Selecione uma entidade");
    await act(async () => { q("jump-open-nodes")!.click(); });
    await flush();
    expect(q("jump-open-msg")?.getAttribute("data-ok")).toBe("sim");
  });

  it("trocar de ROM descarta instâncias e resultados; resposta antiga é ignorada", async () => {
    let resolveOld: (v: unknown) => void = () => undefined;
    mocks.rexProfileLocate.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }));
    act(() => root.render(<RexProfileLogicPanel romPath="/a.bin" />));
    await act(async () => { q("jump-locate")!.click(); });
    act(() => root.render(<RexProfileLogicPanel romPath="/b.bin" />));
    await act(async () => { resolveOld(locate("c".repeat(64))); await Promise.resolve(); });
    expect(q("jump-instance")).toBeNull();
    expect(q("jump-none")).toBeNull();
  });

  it("diz qual perfil reconheceu e separa verificado, medido e desconhecido", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    await open();
    expect(q("profile-recognized")?.textContent).toContain("Pulo de plataforma");
    expect(q("profile-recognized")?.textContent).toContain(PERFIL);
    expect(q("profile-recognized")?.textContent).toContain("revisão 2");
    expect(q("profile-evidence-static")?.textContent).toContain("sem rodar o jogo");
    expect(q("profile-evidence-static")?.textContent).toContain("Campo imp");
    // só o campo com REGISTRO CURADO para esta instância aparece, e como histórico, não como observação
    expect(q("profile-evidence-curated")?.textContent).toContain("o aplicativo não mediu isto");
    expect(q("profile-evidence-curated")?.textContent).toContain("Campo imp: valores 1664 e 2304 (L5");
    expect(q("profile-evidence-curated")?.textContent).toContain("registro efeito_impulso.sonic1.motor_de_perfis");
    expect(q("profile-evidence-curated")?.textContent).toContain("jump-gameplay-report.json");
    expect(q("profile-evidence-curated")?.textContent).not.toContain("Campo cut");
    expect(q("profile-evidence-declared")?.textContent).toContain("nada além do que está acima");
    expect(q("profile-evidence-static")?.textContent).toContain("Observado pelo aplicativo nesta sessão");
    // assinatura encontrada não é consumidor executado: dito sempre
    expect(q("profile-evidence-unknown")?.textContent).toContain("se o jogo executa este trecho e quem o chama");
    expect(q("profile-evidence-unknown")?.textContent).toContain("não foram verificados em execução");
    expect(q("profile-supported")?.textContent).toContain("nem recompila o grafo");
    // detalhe técnico: as três noções de endereço, sem misturar
    expect(q("profile-technical")?.textContent).toContain("offset de arquivo 0x01340C");
    expect(q("profile-technical")?.textContent).toContain("endereço de barramento 0x01340C");
    expect(q("profile-captures")?.textContent).toContain("deslocamento de endereço efetivo");
    expect(q("profile-captures")?.textContent).toContain("0xFFF602 (fora da ROM)");
    expect(q("profile-claims")?.textContent).toContain("docs/fecho.md");
    expect(q("jump-limits")?.textContent).toContain("pareamento com o pulo é inequívoco");
  });

  it("medição feita em outra ROM ou instância não é apresentada como medição desta", async () => {
    const l = locate();
    l.matches[0].instances[0].fields[0].claims = [medicao({ applicability: "other_target", declared_scope_matches: false })] as never;
    mocks.rexProfileLocate.mockResolvedValue(l);
    await open();
    expect(q("profile-evidence-curated")?.textContent).toContain("nenhuma para esta ROM e instância");
    expect(q("profile-evidence-curated")?.textContent).toContain("outra ROM ou instância; ele não vale para esta");
    expect(q("profile-evidence-curated")?.textContent).not.toContain("valores 1664");
  });

  it("sem pareamento a verificação estática é só da forma, e a ambiguidade é dita", async () => {
    const l = locate("a".repeat(64), false);
    l.matches[0].instances[0].ambiguities = ["pair_height: 2 candidatos à mesma distância; nenhum foi ligado"] as never;
    mocks.rexProfileLocate.mockResolvedValue(l);
    await open();
    expect(q("profile-evidence-static")?.textContent).toContain("só a forma");
    expect(q("profile-evidence-static")?.textContent).toContain("2 candidatos à mesma distância");
    expect(q("profile-evidence-curated")?.textContent).toContain("nenhuma para esta ROM e instância");
  });

  it("um perfil DIFERENTE (outros campos, larguras e textos) aparece só com o que a resposta traz", async () => {
    const l = locate();
    l.matches.push({
      profile: perfil({ id: "m68k.outro.v1", sha256: "9".repeat(64), title: "Portão autoral", origin: "directory", file: "/perfis/outro.json", claims: [], unknown: ["nenhum efeito medido"], limits: ["perfil autoral: só forma e consistência"] }) as never,
      instances: [instancia(true, {
        instance_offset: 0x40,
        fields: [field("limite", 300, 1, 1000, [0x42]), field("teto", 100000, 0, 100000, [0x72], { width: 4, signed: false, little_endian: true })],
        notes: ["portão em 0x40"], details: [["objeto", "+10"]],
      }) as never],
      rejected_by_constraint: 3, bound: true, error: null,
    });
    l.rejected = [{ file: "/perfis/quebrado.json", rule: "parse", message: "JSON inválido" }];
    mocks.rexProfileLocate.mockResolvedValue(l);
    mocks.rexProfileEdit.mockResolvedValue(resposta({ profile_id: "m68k.outro.v1", profile_sha256: "9".repeat(64), instance_offset: 0x40, values_applied: [["teto", 7]] }));
    act(() => root.render(<RexProfileLogicPanel romPath="/rom.bin" />));
    type("profile-dir", "/perfis");
    await act(async () => { q("jump-locate")!.click(); });
    await flush();
    expect(mocks.rexProfileLocate.mock.calls[0][0].profiles_dir).toBe("/perfis");
    expect(q("jump-tab-1")?.textContent).toContain("Portão autoral em 0x000040");
    expect(q("profile-list")?.textContent).toContain("da pasta");
    expect(q("profile-list")?.textContent).toContain("3 ocorrência(s) descartada(s) por restrição");
    expect(q("profile-rejected")?.textContent).toContain("quebrado.json — parse");
    await act(async () => { q("jump-tab-1")!.click(); });
    expect(q("jump-instance")?.getAttribute("data-profile-id")).toBe("m68k.outro.v1");
    expect(q("jump-field-imp")).toBeNull();
    expect(q("jump-field-teto")?.textContent).toContain("0..100000");
    expect(q("jump-field-teto")?.textContent).toContain("0x186a0");
    expect(q("profile-evidence-curated")?.textContent).toContain("nenhuma para esta ROM e instância");
    expect(q("jump-limits")?.textContent).toContain("perfil autoral: só forma e consistência");
    type("jump-outdir", "/saida");
    type("jump-input-teto", "7");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    const req = mocks.rexProfileEdit.mock.calls[0][0];
    expect(req).toMatchObject({ profile_id: "m68k.outro.v1", profile_sha256: "9".repeat(64), instance_offset: 0x40, values: { teto: 7 }, profiles_dir: "/perfis" });
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("atual");
  });

  it("resposta de OUTRO perfil para a mesma ROM e offset não aparece (resposta assíncrona antiga)", async () => {
    const l = locate();
    l.matches.push({ profile: perfil({ id: "m68k.outro.v1", sha256: "9".repeat(64), title: "Outro" }) as never, instances: [instancia()] as never, rejected_by_constraint: 0, bound: true, error: null });
    mocks.rexProfileLocate.mockResolvedValue(l);
    let resolverA: (v: unknown) => void = () => undefined;
    mocks.rexProfileEdit.mockImplementationOnce(() => new Promise((r) => { resolverA = r; }));
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    // mesma ROM, MESMO offset, perfil diferente
    await act(async () => { q("jump-tab-1")!.click(); });
    await act(async () => { resolverA(resposta()); await Promise.resolve(); });
    await flush();
    expect(q("jump-instance")?.getAttribute("data-profile-id")).toBe("m68k.outro.v1");
    expect(q("jump-result")).toBeNull();
  });

  it("resposta cujo hash de perfil não é o da localização é descartada", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockResolvedValue(resposta({ profile_sha256: "0".repeat(64) }));
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(q("jump-result")).toBeNull();
  });

  it("perfil recusado pelo núcleo na geração (profile-mismatch) aparece como falha, sem resultado", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    mocks.rexProfileEdit.mockRejectedValue({ code: "profile-mismatch", message: "o perfil carregado não é o que gerou esta localização" });
    await open();
    type("jump-outdir", "/saida");
    type("jump-input-imp", "2304");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(q("jump-failure")?.textContent).toContain("profile-mismatch");
    expect(q("jump-result")).toBeNull();
  });

  it("trocar a pasta de perfis descarta a localização (outro conjunto de perfis é outro contexto)", async () => {
    mocks.rexProfileLocate.mockResolvedValue(locate());
    await open();
    expect(q("jump-instance")).not.toBeNull();
    type("profile-dir", "/outros-perfis");
    expect(q("jump-instance")).toBeNull();
  });

  it("N1: perfil de pasta que alega causalidade aparece como declaração do autor, nunca como evidência", async () => {
    const l = locate();
    l.matches[0].profile = perfil({ origin: "directory", claims: [{ ...perfil().claims[0], origin: "declared", records: [] }] }) as never;
    l.matches[0].instances[0].fields[0].claims = [medicao({ origin: "declared", applicability: "not_curated", records: [], declared_scope_matches: true })] as never;
    mocks.rexProfileLocate.mockResolvedValue(l);
    await open();
    expect(q("profile-evidence-curated")?.textContent).toContain("nenhuma para esta ROM e instância");
    expect(q("profile-evidence-curated")?.textContent).not.toContain("valores 1664");
    expect(q("profile-evidence-declared")?.textContent).toContain("Campo imp: o autor declara L5");
    expect(q("profile-evidence-declared")?.textContent).toContain("citando esta ROM e instância");
    expect(q("profile-evidence-declared")?.textContent).toContain("não comprova a medição");
    expect(q("profile-claims")?.textContent).toContain("só declarado pelo autor");
  });

  it("N4: registro curado de outra revisão do perfil é dito e não vale para este arquivo", async () => {
    const l = locate();
    l.matches[0].instances[0].fields[0].claims = [medicao({ applicability: "other_revision" })] as never;
    mocks.rexProfileLocate.mockResolvedValue(l);
    await open();
    expect(q("profile-evidence-curated")?.textContent).toContain("outra revisão deste perfil; ele não vale para este arquivo");
    expect(q("profile-evidence-curated")?.textContent).not.toContain("valores 1664");
  });

  it("registro herdado (medido antes de o perfil virar dado) é rotulado como herdado, com a procedência", () => {
    const e = evidenciaPorOrigem([field("imp", 1664, 1, 32767, [1], { claims: [medicao({ inherited: true, records: [registro({ id: "r.pre", measured_under: { profile_form: "code", profile_sha256: null, commit: "c", binary_sha256: "b".repeat(64) } })] })] }) as never]);
    expect(e.curadas[0]).toContain("herdada: medida antes deste arquivo de perfil");
    expect(e.curadas[0]).toContain("medido antes de o perfil virar dado");
    expect(e.declaradas).toEqual([]);
  });

  it("N5: observação de outra sessão do aplicativo não é apresentada como observação atual", async () => {
    expect(observacaoAtual({ kind: "static_form_matched", session: SESSAO, request_id: "l" }, SESSAO)).toBe(true);
    expect(observacaoAtual({ kind: "static_form_matched", session: "sessao-anterior", request_id: "l" }, SESSAO)).toBe(false);
    expect(observacaoAtual({ kind: "static_form_matched", session: "", request_id: "l" }, "")).toBe(false);
    const l = locate();
    l.matches[0].instances[0].observations = [{ kind: "static_form_matched", session: "sessao-anterior", request_id: "l" }];
    mocks.rexProfileLocate.mockResolvedValue(l);
    await open();
    expect(q("profile-evidence-static")?.textContent).toContain("nada: este resultado não é desta sessão");
    expect(q("profile-evidence-static")?.textContent).not.toContain("forma e consistência");
  });

  // ------------------------------------------------------------ classe semântica (F1b)
  const GATE = "m68k.counter_threshold_state_gate.v1";
  function operacao(id: string, kind: string, text: string, over: Record<string, unknown> = {}) {
    return { id, kind, text, origin: "recovered_from_rom", rom_ranges: [[0x414, 0x41a]], editable: false, opaque: false, ...over };
  }
  function semantico(mode = "structural_scan") {
    const l = locate();
    l.matches.push({
      profile: perfil({ class: "semantic_region", selection_modes: ["structural_scan", "declared_region"], id: GATE, sha256: "7".repeat(64), revision: 1, title: "Contador com limiar", instance_param: "entry", claims: [], unknown: ["o que a chamada externa faz"], limits: ["A região é selecionada, não descoberta."] }) as never,
      instances: [instancia(true, {
        selection: { mode, label: mode === "declared_region" ? "região declarada pelo usuário (entrada e saídas informadas); nada foi descoberto automaticamente" : "candidato por varredura estrutural (forma com guarda); não é descoberta de rotina nem prova de uso em jogo" },
        operations: [
          operacao("guard", "rom_input_bit_guard", "bit=5 · register=D3"),
          operacao("compare", "rom_counter_compare", "operator=< · threshold=40", { editable: true }),
          operacao("set_call", "rom_external_call", "target=0x000600 · understood=false", { opaque: true }),
        ],
        declared: ["rótulo do campo editável vem do perfil (dado)", "entrada 0x000400 e saída 0x000444 propostas pela varredura estrutural"],
        region_exits: [0x444], instance_offset: 0x400, instance_bus_address: 0x400, anchor_pattern: "CounterCompareGate", links: [],
        fields: [field("threshold", 40, -128, 127, [0x41b], { width: 1, label: "Limiar do contador" })],
        notes: ["parte opaca: set_call — registrada, não recuperada"], details: [], captures: [],
        observations: [{ kind: "static_form_matched", session: SESSAO, request_id: "l" }, { kind: "operations_derived_from_bytes", session: SESSAO, request_id: "l" }],
      }) as never],
      rejected_by_constraint: 0, bound: true, error: null,
    });
    return l;
  }

  it("classe semântica: seleção rotulada, operações recuperadas, parte opaca e o que é declarado aparecem separados", async () => {
    mocks.rexProfileLocate.mockResolvedValue(semantico());
    await open();
    await act(async () => { q("jump-tab-1")!.click(); });
    expect(q("jump-instance")?.getAttribute("data-profile-id")).toBe(GATE);
    expect(q("profile-selection")?.getAttribute("data-mode")).toBe("structural_scan");
    expect(q("profile-selection")?.textContent).toContain("não é descoberta de rotina");
    expect(q("profile-operations")?.textContent).toContain("recuperadas dos bytes da ROM (pelo analisador, não pelo perfil)");
    expect(q("profile-op-compare")?.getAttribute("data-editable")).toBe("sim");
    expect(q("profile-op-compare")?.textContent).toContain("operator=<");
    expect(q("profile-op-guard")?.getAttribute("data-editable")).toBe("nao");
    expect(q("profile-op-set_call")?.getAttribute("data-opaque")).toBe("sim");
    expect(q("profile-op-set_call")?.textContent).toContain("OPACA: registrada, não recuperada");
    expect(q("profile-declared")?.textContent).toContain("propostas pela varredura estrutural");
    expect(q("profile-evidence-static")?.textContent).toContain("derivadas dos bytes nesta sessão");
    expect(q("profile-supported")?.textContent).toContain("nem trocar operador, endereço ou conexão");
    expect(q("jump-field-threshold")?.textContent).toContain("-128..127");
    // a classe de assinatura não finge ter operações recuperadas
    await act(async () => { q("jump-tab-0")!.click(); });
    expect(q("profile-operations")).toBeNull();
    expect(q("profile-selection")?.getAttribute("data-mode")).toBe("signature");
  });

  it("classe semântica: editar o limiar envia a região da instância e o perfil; o resto do fluxo é o mesmo", async () => {
    mocks.rexProfileLocate.mockResolvedValue(semantico());
    mocks.rexProfileEdit.mockResolvedValue(resposta({ profile_id: GATE, profile_sha256: "7".repeat(64), instance_offset: 0x400, values_applied: [["threshold", 100]], values_after: [["threshold", 100]], checksum_updated: true, avisos: ["O checksum do cabeçalho (0x18E) também foi atualizado."] }));
    await open();
    await act(async () => { q("jump-tab-1")!.click(); });
    type("jump-outdir", "/saida");
    type("jump-input-threshold", "128");
    expect(q("jump-invalid")).not.toBeNull();
    type("jump-input-threshold", "100");
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(mocks.rexProfileEdit.mock.calls[0][0]).toMatchObject({ profile_id: GATE, profile_sha256: "7".repeat(64), instance_offset: 0x400, values: { threshold: 100 }, region_exits: [0x444], region_selection: "structural_scan" });
    expect(q("jump-result")?.getAttribute("data-relacao")).toBe("atual");
    expect(q("jump-result")?.textContent).toContain("checksum do cabeçalho");
    // a classe de assinatura NÃO envia região
    await act(async () => { q("jump-tab-0")!.click(); });
    type("jump-input-imp", "2304");
    mocks.rexProfileEdit.mockResolvedValue(resposta());
    await act(async () => { q("jump-generate")!.click(); });
    await flush();
    expect(mocks.rexProfileEdit.mock.calls[1][0].region_exits).toBeUndefined();
  });

  it("região declarada: só é enviada completa e válida; incompleta bloqueia a localização", async () => {
    expect(parseHexList("0x400, 0x444")).toEqual([0x400, 0x444]);
    expect(parseHexList("400")).toEqual([0x400]);
    expect(parseHexList("0x401")).toBeNull(); // ímpar
    expect(parseHexList("xyz")).toBeNull();
    expect(parseHexList("")).toEqual([]);
    mocks.rexProfileLocate.mockResolvedValue(semantico("declared_region"));
    act(() => root.render(<RexProfileLogicPanel romPath="/rom.bin" />));
    type("region-profile", GATE);
    type("region-entry", "0x400");
    expect(q("region-invalid")).not.toBeNull();
    expect((q("jump-locate") as HTMLButtonElement).disabled).toBe(true);
    type("region-exits", "0x444");
    expect(q("region-invalid")).toBeNull();
    await act(async () => { q("jump-locate")!.click(); });
    await flush();
    expect(mocks.rexProfileLocate.mock.calls[0][0].declared_regions).toEqual([{ profile_id: GATE, entry: 0x400, exits: [0x444] }]);
    await act(async () => { q("jump-tab-1")!.click(); });
    expect(q("profile-selection")?.getAttribute("data-mode")).toBe("declared_region");
    expect(q("profile-selection")?.textContent).toContain("nada foi descoberto automaticamente");
  });
});
