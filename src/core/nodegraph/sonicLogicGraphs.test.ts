import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { deserializeNodeGraph } from "./nodeDefinitions";
import { validateNodeGraph } from "./nodeEngine";

const DIR = "data/rex_profiles/integration_20261007/grafos";
const FILES = [
  "sonic1-logica-modos.nodegraph.json",
  "sonic1-logica-pulo.nodegraph.json",
  "sonic1-logica-pulo-duplo-proposto.nodegraph.json",
];

function load(file: string) {
  const text = readFileSync(`${DIR}/${file}`, "utf8");
  return { raw: JSON.parse(text) as { nodes: unknown[]; edges: unknown[]; rex_logic_recovery: { descritivo: boolean } }, graph: deserializeNodeGraph(text) };
}

describe("grafos da lógica localizada do Sonic 1 (NodeGraph v1)", () => {
  for (const file of FILES) {
    it(`${file}: o editor aceita todos os nós e arestas (nada descartado em silêncio)`, () => {
      const { raw, graph } = load(file);
      expect(graph.nodes.length).toBe(raw.nodes.length);
      expect(graph.edges.length).toBe(raw.edges.length);
      expect(raw.rex_logic_recovery.descritivo).toBe(true);
    });

    it(`${file}: todo nó diz a origem e, quando tem endereço, traz os bytes lidos da ROM`, () => {
      const { graph } = load(file);
      for (const node of graph.nodes) {
        const origem = String(node.params.origem ?? "");
        expect(origem, node.id).toMatch(/^(recuperado do ROM|rotulo|PROPOSTO)/);
        if (node.params.rom_addr !== undefined) {
          expect(String(node.params.rom_addr), node.id).toMatch(/^0x[0-9A-F]{6}$/);
          expect(String(node.params.rom_bytes), node.id).toMatch(/^([0-9a-f]{2})+$/);
          expect(String(node.params.rom_asm).length, node.id).toBeGreaterThan(0);
        }
      }
    });
  }

  for (const file of FILES) {
    it(`${file}: o validador do próprio editor não aponta nenhum erro`, () => {
      const { graph } = load(file);
      expect(validateNodeGraph(graph).errors.map((e) => e.message)).toEqual([]);
    });
  }

  it("o pulo duplo é inteiramente PROPOSTO e aponta para a ROM com patch; os outros nunca se declaram propostos", () => {
    const duplo = load(FILES[2]).graph;
    for (const node of duplo.nodes) {
      expect(String(node.params.origem), node.id).toMatch(/^PROPOSTO/);
      expect(String(node.params.rom_buffer), node.id).toContain("com patch");
    }
    for (const file of FILES.slice(0, 2)) {
      for (const node of load(file).graph.nodes) expect(String(node.params.origem), node.id).not.toMatch(/^PROPOSTO/);
    }
  });

  it("o grafo do pulo contém os pontos localizados (Sonic_Jump, JumpHeight, flag $3C, som, reset ao pousar)", () => {
    const addrs = new Set(load(FILES[1]).graph.nodes.map((n) => String(n.params.rom_addr)));
    for (const a of ["0x0133EA", "0x013498", "0x013448", "0x013454", "0x0137E4"]) {
      expect(addrs.has(a), a).toBe(true);
    }
  });
});

describe("grafos GERADOS pelo perfil m68k.platformer_jump.v1 (Sonic 1 e Sonic Delta)", () => {
  const dir = "data/rex_profiles/integration_20261007/grafos-gerados";
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".nodegraph.json"))
    .map((d) => d.name);

  it("há um grafo por instância localizada (1 no Sonic 1, 3 no Delta)", () => {
    expect(files.filter((f) => f.startsWith("grafo-s1-")).length).toBe(1);
    expect(files.filter((f) => f.startsWith("grafo-delta-")).length).toBe(3);
  });

  for (const file of files) {
    it(`${file}: o editor aceita tudo e o validador não aponta erros`, () => {
      const text = readFileSync(`${dir}/${file}`, "utf8");
      const raw = JSON.parse(text) as { nodes: unknown[]; edges: unknown[] };
      const graph = deserializeNodeGraph(text);
      expect(graph.nodes.length).toBe(raw.nodes.length);
      expect(graph.edges.length).toBe(raw.edges.length);
      expect(validateNodeGraph(graph).errors.map((e) => e.message)).toEqual([]);
      const editaveis = graph.nodes.filter((n) => n.params.editavel === 1);
      expect(editaveis.length).toBeGreaterThanOrEqual(2);
      for (const n of editaveis) {
        expect(String(n.params.rom_offsets)).toMatch(/^0x[0-9A-F]{6}(,0x[0-9A-F]{6})*$/);
        expect(String(n.params.faixa)).toMatch(/^-?\d+\.\.-?\d+$/);
      }
    });
  }
});
