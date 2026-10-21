import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { deserializeNodeGraph } from "./nodeDefinitions";
import {
  isRecoveredRegionGraph,
  canonicalSignature,
  contextIdentity,
  bridgeInfo,
  editsFromGraph,
  graphStructure,
  relateResult,
  valuesKey,
  withRomPath,
} from "./profileGraphBridge";

const DIR = "data/rex_profiles/integration_20261007/grafos-gerados";
const load = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");

describe("ponte canvas ↔ ROM do perfil do pulo", () => {
  it("lê a identidade da ROM do nó de entrada e não vê ponte em grafos comuns", () => {
    const info = bridgeInfo(deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json")));
    expect(info?.instanceOffset).toBe(0x1340c);
    expect(info?.romSha256).toHaveLength(64);
    expect(info?.romPath).toBe("");
    expect(bridgeInfo(deserializeNodeGraph(readFileSync("data/rex_profiles/integration_20261007/grafos/sonic1-logica-pulo.nodegraph.json", "utf8")))).toBeNull();
    expect(bridgeInfo(deserializeNodeGraph(null))).toBeNull();
  });

  it("sem edição não há mudanças; editar nós vira um plano com os campos certos", () => {
    const g = deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    expect(editsFromGraph(g)).toEqual({ changes: {}, edits: [], problems: [] });
    const imp = g.nodes.find((n) => n.params.campo === "imp")!;
    const cut = g.nodes.find((n) => n.params.campo === "cut")!;
    imp.params.value = 2304;
    cut.params.value = -1536;
    const r = editsFromGraph(g);
    expect(r.changes).toEqual({ imp: 2304, cut: -1536 });
    expect(r.edits.map((e) => [e.campo, e.de, e.para])).toEqual([["imp", 1664, 2304], ["cut", -1024, -1536]]);
    expect(r.problems).toEqual([]);
    // voltar ao original desfaz a mudança
    imp.params.value = 1664;
    expect(editsFromGraph(g).changes).toEqual({ cut: -1536 });
  });

  it("valor fora da faixa, não inteiro ou nó sem original viram problema, nunca mudança", () => {
    const g = deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    const byCampo = (c: string) => g.nodes.find((n) => n.params.campo === c)!;
    byCampo("imp").params.value = 0; // faixa 1..32767
    byCampo("cut").params.value = 5; // faixa -32767..-1
    byCampo("impw").params.value = "abc";
    byCampo("cutw").params.value = 12.5;
    delete byCampo("cap").params.valor_original;
    const r = editsFromGraph(g);
    expect(r.changes).toEqual({});
    expect(r.problems.map((p) => p.campo).sort()).toEqual(["cap", "cut", "cutw", "imp", "impw"]);
  });

  it("valor digitado como texto numérico é aceito; withRomPath só mexe no nó de entrada", () => {
    const g = deserializeNodeGraph(load("grafo-delta-16914.nodegraph.json"));
    g.nodes.find((n) => n.params.campo === "imps")!.params.value = "2304";
    expect(editsFromGraph(g).changes).toEqual({ imps: 2304 });
    const comPath = withRomPath(load("grafo-delta-16914.nodegraph.json"), "/roms/delta.bin");
    const info = bridgeInfo(deserializeNodeGraph(comPath));
    expect(info?.romPath).toBe("/roms/delta.bin");
    const antes = JSON.parse(load("grafo-delta-16914.nodegraph.json")) as { nodes: unknown[] };
    expect((JSON.parse(comPath) as { nodes: unknown[] }).nodes.length).toBe(antes.nodes.length);
  });

  it("campos duplicados: nenhum dos dois é aplicado e a ponte diz quais nós (nada de 'o último vence')", () => {
    const g = deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    const imp = g.nodes.find((n) => n.params.campo === "imp")!;
    const copia = structuredClone(imp);
    copia.id = "imp_2";
    copia.params.value = 2500;
    imp.params.value = 2304;
    g.nodes.push(copia);
    const r = editsFromGraph(g);
    expect(r.changes).toEqual({});
    expect(r.edits).toEqual([]);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0].campo).toBe("imp");
    expect(r.problems[0].motivo).toContain("duplicado");
    expect(r.problems[0].motivo).toContain("imp_2");
    // mesmo valor nos dois também é ambiguidade
    copia.params.value = 2304;
    expect(editsFromGraph(g).changes).toEqual({});
  });
});

describe("estrutura canônica (assinatura gerada pelo núcleo)", () => {
  const FILES = ["grafo-s1-1340c.nodegraph.json", "grafo-delta-16914.nodegraph.json", "grafo-delta-1732a.nodegraph.json", "grafo-delta-1a170.nodegraph.json"];

  it("a assinatura calculada no TS é IGUAL à gravada pelo núcleo Rust (mesma regra nos dois lados)", () => {
    for (const f of FILES) {
      const g = deserializeNodeGraph(load(f));
      const info = bridgeInfo(g)!;
      expect(info.assinatura, f).toMatch(/^[0-9a-f]{16}$/);
      expect(canonicalSignature(g), f).toBe(info.assinatura);
      expect(graphStructure(g).canonical, f).toBe(true);
    }
  });

  it("posição, rótulo, pinned, valor editado e caminho da ROM NÃO quebram a estrutura", () => {
    const g = deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    for (const n of g.nodes) {
      n.x += 40;
      n.y -= 25;
      n.label = `${n.label} (renomeado)`;
      n.pinned = true;
    }
    g.nodes.find((n) => n.params.campo === "imp")!.params.value = 2304;
    g.nodes.find((n) => n.params.ponte_edicao === 1)!.params.rom_path = "/x";
    expect(graphStructure(g).canonical).toBe(true);
  });

  it("remover nó, mexer em conexão, origem, campo, tipo ou identidade tira a ponte do estado canônico", () => {
    const base = () => deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    const casos: [string, (g: ReturnType<typeof base>) => void][] = [
      ["nó removido", (g) => { g.nodes = g.nodes.filter((n) => n.id !== "vel"); }],
      ["conexão removida", (g) => { g.edges.shift(); }],
      ["conexão redirecionada", (g) => { g.edges[1].toNode = "vel"; }],
      ["origem alterada", (g) => { g.nodes.find((n) => n.id === "imp")!.params.rom_offsets = "0x000000"; }],
      ["bytes de origem", (g) => { g.nodes.find((n) => n.id === "imp")!.params.rom_bytes = "0000"; }],
      ["valor original adulterado", (g) => { g.nodes.find((n) => n.id === "imp")!.params.valor_original = 2304; }],
      ["campo trocado", (g) => { g.nodes.find((n) => n.id === "imp")!.params.campo = "cut"; }],
      ["faixa alterada", (g) => { g.nodes.find((n) => n.id === "imp")!.params.faixa = "0..65535"; }],
      ["tipo alterado", (g) => { g.nodes.find((n) => n.id === "sub")!.type = "var_set"; }],
      ["instância trocada", (g) => { g.nodes.find((n) => n.params.ponte_edicao === 1)!.params.jump_offset = 0; }],
    ];
    for (const [nome, mexe] of casos) {
      const g = base();
      mexe(g);
      const s = graphStructure(g);
      expect(s.canonical, nome).toBe(false);
      expect(s.motivo.length, nome).toBeGreaterThan(0);
    }
  });

  it("grafo sem assinatura ou sem identidade nunca é tratado como canônico", () => {
    const g = deserializeNodeGraph(load("grafo-s1-1340c.nodegraph.json"));
    delete g.nodes.find((n) => n.params.ponte_edicao === 1)!.params.assinatura_estrutural;
    expect(graphStructure(g).canonical).toBe(false);
    expect(graphStructure(deserializeNodeGraph(null)).canonical).toBe(false);
  });
});

describe("resultado assíncrono x contexto atual", () => {
  const k = (identity: string, instance: number, values: Record<string, number>) => ({ identity, instance, values: valuesKey(values) });

  it("valuesKey é estável (ordem não importa) e ignora vazios", () => {
    expect(valuesKey({ imp: 1, cut: -2 })).toBe(valuesKey({ cut: -2, imp: 1 }));
    expect(valuesKey({ imp: undefined, cut: null })).toBe("[]");
  });

  it("mesmo contexto = atual; valores diferentes = anteriores; outra ROM ou instância = outro contexto", () => {
    const atual = k("a".repeat(64), 0x1340c, { imp: 2304 });
    expect(relateResult(k("a".repeat(64), 0x1340c, { imp: 2304 }), atual)).toBe("atual");
    expect(relateResult(k("a".repeat(64), 0x1340c, { imp: 2000 }), atual)).toBe("valores-anteriores");
    expect(relateResult(k("b".repeat(64), 0x1340c, { imp: 2304 }), atual)).toBe("outro-contexto");
    expect(relateResult(k("a".repeat(64), 0x16914, { imp: 2304 }), atual)).toBe("outro-contexto");
  });
});

describe("ponte canvas ↔ ROM para um perfil qualquer (grafo gerado pelo núcleo no formato atual)", () => {
  // arquivo de conformidade: gerado e conferido por `rex_profile_graph::tests::grafo_de_conformidade_com_a_ponte_ts`
  const MINI = readFileSync("data/rex_profiles/integration_20261009/conformidade/grafo-mini.nodegraph.json", "utf8");

  it("perfil, hash, revisão e a chave da instância vêm do grafo, sem lista fixa", () => {
    const info = bridgeInfo(deserializeNodeGraph(MINI))!;
    expect(info.perfil).toBe("m68k.mini_gate.v1");
    expect(info.perfilSha256).toHaveLength(64);
    expect(info.perfilRevisao).toBe(1);
    expect(info.instanceOffset).toBe(0x40); // lido de `gate_offset`, a chave declarada em `instancia_param`
    expect(info.romSha256).toHaveLength(64);
  });

  it("a assinatura estrutural calculada aqui é a que o núcleo gravou (mesma regra canônica)", () => {
    const g = deserializeNodeGraph(MINI);
    expect(canonicalSignature(g)).toBe(bridgeInfo(g)!.assinatura);
    expect(graphStructure(g)).toEqual({ canonical: true, motivo: "" });
    // vínculo de sessão não é estrutura
    const opened = deserializeNodeGraph(withRomPath(MINI, "/roms/x.bin", "/perfis"));
    expect(bridgeInfo(opened)).toMatchObject({ romPath: "/roms/x.bin", perfilDir: "/perfis" });
    expect(graphStructure(opened).canonical).toBe(true);
    // ...mas o campo de um nó editável é
    opened.nodes.find((n) => n.params.campo === "low")!.params.campo = "top";
    expect(graphStructure(opened).canonical).toBe(false);
  });

  it("campos com nomes, larguras e domínios quaisquer viram plano; duplicado e fora do domínio não", () => {
    const g = deserializeNodeGraph(MINI);
    const by = (c: string) => g.nodes.find((n) => n.params.campo === c)!;
    expect(editsFromGraph(g)).toEqual({ changes: {}, edits: [], problems: [] });
    by("top").params.value = 7;
    by("low").params.value = "200";
    expect(editsFromGraph(g).changes).toEqual({ top: 7, low: 200 });
    by("low").params.value = 201; // domínio 0..200
    by("top").params.value = 100001; // domínio 0..100000
    const r = editsFromGraph(g);
    expect(r.changes).toEqual({});
    expect(r.problems.map((p) => p.campo).sort()).toEqual(["low", "top"]);
    g.nodes.push({ ...by("lim"), id: "copia" });
    expect(editsFromGraph(g).problems.find((p) => p.campo === "lim")?.motivo).toContain("campo duplicado em 2 nós");
  });

  it("perfil diferente (ou hash diferente) para a mesma ROM e instância é outro contexto", () => {
    const a = { identity: contextIdentity("r".repeat(64), "m68k.a.v1", "1".repeat(64)), instance: 64, values: "[]" };
    expect(relateResult(a, { ...a })).toBe("atual");
    expect(relateResult(a, { ...a, identity: contextIdentity("r".repeat(64), "m68k.b.v1", "1".repeat(64)) })).toBe("outro-contexto");
    expect(relateResult(a, { ...a, identity: contextIdentity("r".repeat(64), "m68k.a.v1", "2".repeat(64)) })).toBe("outro-contexto");
    expect(relateResult(a, { ...a, values: "[1]" })).toBe("valores-anteriores");
  });
});

describe("ponte canvas ↔ ROM para a classe semântica (grafo derivado pelo analisador)", () => {
  // arquivo de conformidade: gerado e conferido por `rex_profile_semantic::tests::grafo_semantico_de_conformidade_com_o_editor`
  const GATE = readFileSync("data/rex_profiles/integration_20261009/conformidade/grafo-gate.nodegraph.json", "utf8");

  it("o grafo é um ponto fixo da hidratação do editor: a assinatura do núcleo é a calculada aqui", () => {
    const g = deserializeNodeGraph(GATE);
    const info = bridgeInfo(g)!;
    expect(info.perfil).toBe("m68k.counter_threshold_state_gate.v1");
    expect(info.instanceOffset).toBe(0x400); // lido de `entry`
    expect(g.nodes.map((n) => n.type)).toContain("rom_external_call");
    expect(canonicalSignature(g)).toBe(info.assinatura);
    expect(graphStructure(g)).toEqual({ canonical: true, motivo: "" });
    // ida e volta pelo serializador do editor não muda a estrutura
    const again = deserializeNodeGraph(JSON.stringify({ version: 1, nodes: g.nodes, edges: g.edges }));
    expect(graphStructure(again).canonical).toBe(true);
  });

  it("só o limiar vira plano; o valor editável está no parâmetro que o nó declara (`campo_param`)", () => {
    const g = deserializeNodeGraph(GATE);
    const cmp = g.nodes.find((n) => n.type === "rom_counter_compare")!;
    expect(cmp.params.campo_param).toBe("threshold");
    expect(editsFromGraph(g)).toEqual({ changes: {}, edits: [], problems: [] });
    cmp.params.threshold = 100;
    expect(editsFromGraph(g).changes).toEqual({ threshold: 100 });
    expect(graphStructure(g).canonical).toBe(true); // mudar o limiar não é mudar a lógica
    cmp.params.threshold = 128; // faixa -128..127
    expect(editsFromGraph(g).problems.map((p) => p.campo)).toEqual(["threshold"]);
  });

  it("mexer em operador, endereço, valor de estado ou na chamada opaca deixa de ser a lógica da ROM", () => {
    for (const mexe of [
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.nodes.find((n) => n.type === "rom_counter_compare")!.params.operator = ">="; },
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.nodes.find((n) => n.type === "rom_counter_add")!.params.address = "0xFF0000"; },
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.nodes.find((n) => n.id === "set_write")!.params.value = 1; },
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.nodes.find((n) => n.type === "rom_external_call")!.params.understood = "true"; },
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.nodes = g.nodes.filter((n) => n.type !== "rom_external_call"); },
      (g: ReturnType<typeof deserializeNodeGraph>) => { g.edges = g.edges.slice(1); },
    ]) {
      const g = deserializeNodeGraph(GATE);
      mexe(g);
      expect(graphStructure(g).canonical).toBe(false);
    }
  });
});


describe("copy-grid typed backend conformance", () => {
  const copyGraph = () => deserializeNodeGraph(readFileSync("data/rex_profiles/integration_20261016/copy-grid-conformance.nodegraph.json", "utf8"));
  it("respects the discrete width domain of a contiguous copy", () => {
    const copy = copyGraph().nodes.find(n => n.type === "rom_copy_grid")!;
    copy.params.allowed_widths = "1,2,4";
    copy.params.faixa = "1..4";
    const graph = copyGraph();
    graph.nodes = [copy];
    copy.params.bytes_per_cell = 4;
    expect(editsFromGraph(graph).changes).toEqual({bytes_per_cell:4});
    copy.params.bytes_per_cell = 3;
    expect(editsFromGraph(graph).problems).toHaveLength(1);
    copy.params.allowed_widths = "1,2";
    copy.params.bytes_per_cell = 4;
    expect(editsFromGraph(graph).problems).toHaveLength(1);
  });
  it("hydrates memory/control operation, preserves binary origin through save/reopen and limits executable edits", () => {
    const graph = copyGraph();
    expect(graphStructure(graph).canonical).toBe(true);
    expect(bridgeInfo(graph)?.perfil).toBe("m68k.copy_grid.v1");
    expect(graph.nodes.map(n => n.type)).toEqual(["rom_region_entry", "rom_copy_grid", "rom_region_exit"]);
    const copy = graph.nodes.find(n => n.type === "rom_copy_grid")!;
    expect(JSON.parse(String(copy.params.source_mappings))).toHaveLength(8);
    copy.params.bytes_per_cell = 2;
    const reopened = deserializeNodeGraph(JSON.stringify(graph));
    expect(graphStructure(reopened).canonical).toBe(true);
    expect(editsFromGraph(reopened).changes).toEqual({bytes_per_cell:2});
    copy.params.row_stride_bytes = 999;
    expect(graphStructure(graph).canonical).toBe(false);
    copy.params.bytes_per_cell = 4;
    expect(editsFromGraph(graph).problems).toHaveLength(1);
  });
});

describe("recovered region diagnostic context", () => {
  const graph = () => deserializeNodeGraph(readFileSync("data/rex_profiles/integration_20261016/copy-grid-conformance.nodegraph.json", "utf8"));
  it("distinguishes a bound recovered region from author or mixed graphs", async () => {
    const { validateNodeGraph, runNodeGraphLocally } = await import("./nodeEngine");
    const g = graph();
    expect(isRecoveredRegionGraph(g)).toBe(true);
    expect(validateNodeGraph(g).warnings.some(i => i.code === "missing_entry")).toBe(false);
    // Descriptive entry is never promoted to a simulated author event.
    const run=runNodeGraphLocally(g);
    expect(run.status).toBe("success");
    if(run.status==="success") expect(run.trace.steps).toHaveLength(0);
    g.nodes[1].type = "var_set"; // mixed graph cannot evade author missing_entry even with copied recovered metadata
    expect(isRecoveredRegionGraph(g)).toBe(false);
    expect(validateNodeGraph(g).warnings.some(i => i.code === "missing_entry")).toBe(true);
  });
  it("retains edge/structure validation and refuses missing identity", async () => {
    const { validateNodeGraph } = await import("./nodeEngine");
    const g=graph(); g.edges[0].toPort="nonexistent";
    expect(validateNodeGraph(g).errors.some(i => i.code === "broken_port_ref")).toBe(true);
    expect(graphStructure(g).canonical).toBe(false);
    g.nodes[0].params.rom_sha256="invalid";
    expect(isRecoveredRegionGraph(g)).toBe(false);
    expect(validateNodeGraph(g).warnings.some(i => i.code === "missing_entry")).toBe(true);
  });
});
