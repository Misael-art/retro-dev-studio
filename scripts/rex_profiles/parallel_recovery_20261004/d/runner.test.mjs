/**
 * Testes discriminantes da barra D. Cada asercao existe para impedir um erro
 * compartilhado detector/decoder/compositor/relatorio virar verde. As
 * expectativas numericas vem de docs/rex_profiles/parallel_recovery_20261004/d/
 * EXPECTATIONS-D.md (congelado em a90b5c2) e NAO sao recalculadas do export.
 */
import { describe, expect, it } from "vitest";

import { authorSet } from "./bench_author.mjs";
import { CODEC, REGION_HEADER_LEN, STREAM_DECODERS, sha256 } from "./lib_bench.mjs";
import { MUTATIONS, degenerateCases, mutationCase } from "./mutations.mjs";
import { deriveIdealExport, scoreExport } from "./runner.mjs";

const DEV_SEED = "rex-parallel-d-20261004/dev-1/v1";
const FROZEN = {
  "dev-1": { D1: 9, D2: 6, D3: 6, D4: 2, D5: 2, D6: 9, D7: 10, N1: 3, N2: 6 },
  "ho-1": { D1: 12, D2: 8, D3: 8, D4: 3, D5: 3, D6: 13, D7: 14, N1: 4, N2: 9 },
};

const dev = authorSet("dev-1", DEV_SEED);

describe("barra D — autoria", () => {
  it("e deterministica: mesma semente produz os mesmos bytes", () => {
    const again = authorSet("dev-1", DEV_SEED);
    expect(again.truth.fixture_sha256).toBe(dev.truth.fixture_sha256);
    expect(Buffer.compare(again.image, dev.image)).toBe(0);
  });

  it("produz os denominadores congelados em EXPECTATIONS-D (dev-1 e ho-1)", () => {
    for (const [set, want] of Object.entries(FROZEN)) {
      const seed = set === "dev-1" ? DEV_SEED : "seed-de-teste-nao-reservado";
      const truth = authorSet(set, seed).truth;
      const res = scoreExport(truth, deriveIdealExport(truth));
      for (const [d, den] of Object.entries(want)) {
        expect(res.dimensions[d].denominator, `${set}/${d} denominador`).toBe(den);
      }
    }
  });

  it("os dois blocos de tile tem igual comprimento em bytes e composicoes diferentes", () => {
    const [g1, g2] = dev.truth.regions.filter((r) => r.class === "geom");
    expect(g1.payload_len).toBe(g2.payload_len);
    expect(g1.geometry).not.toEqual(g2.geometry);
    expect(g1.output.sha256).not.toBe(g2.output.sha256);
  });

  it("round-trip interno de cada stream (sanidade; nao conta como prova)", () => {
    for (const r of dev.truth.regions.filter((x) => x.class === "stream")) {
      const payload = dev.image.subarray(
        r.byte_addr + REGION_HEADER_LEN,
        r.byte_addr + REGION_HEADER_LEN + r.payload_len,
      );
      const decoded = Buffer.from(STREAM_DECODERS[CODEC[r.codec]](payload, r.raw_len));
      expect(decoded.length, `${r.id} saida`).toBe(r.output.byte_len);
      expect(sha256(decoded), `${r.id} sha`).toBe(r.output.sha256);
    }
  });

  it("decoys existem sem consumidor e falsos alvos existem dentro do bloco de pixels", () => {
    expect(dev.truth.negatives.unreferenced_streams).toHaveLength(3);
    expect(dev.truth.negatives.false_flow_targets).toHaveLength(6);
    const px = dev.truth.regions.find((r) => r.class === "pixels");
    for (const f of dev.truth.negatives.false_flow_targets) {
      expect(f.from_byte_addr).toBeGreaterThanOrEqual(px.byte_addr);
      expect(f.from_byte_addr).toBeLessThan(px.byte_addr + REGION_HEADER_LEN + px.payload_len);
    }
  });
});

describe("barra D — export ideal", () => {
  it("PASS em todas as dimensoes com denominadores da verdade", () => {
    const res = scoreExport(dev.truth, deriveIdealExport(dev.truth));
    expect(res.status).toBe("PASS");
    for (const d of Object.keys(FROZEN["dev-1"])) {
      expect(res.dimensions[d].verdict).toBe("PASS");
    }
  });
});

describe("barra D — controles de mutacao (o runner TEM que reprovar)", () => {
  const truth = dev.truth;
  const base = scoreExport(truth, deriveIdealExport(truth));
  const cases = {
    M1: (r) =>
      ["D1", "D2", "D3", "D7"].every((d) => r.dimensions[d].verdict === "FAIL") &&
      r.dimensions.D2.not_found > 0,
    M2: (r) => r.dimensions.D6.verdict === "FAIL" && r.dimensions.N2.false_links > 0,
    M3: (r) => r.dimensions.D2.verdict === "FAIL" && r.dimensions.D2.not_found >= 1 && r.dimensions.D7.verdict === "FAIL",
    M4: (r) =>
      r.dimensions.D4.verdict === "FAIL" && r.dimensions.D5.verdict === "FAIL" && r.dimensions.D7.verdict === "FAIL",
    M5: (r) =>
      r.dimensions.N1.false_links > 0 &&
      r.dimensions.D7.correct <= base.dimensions.D7.correct &&
      r.status === "FAIL",
    M6: (r) =>
      r.dimensions.D7.unknowns >= 1 &&
      r.dimensions.D7.correct < base.dimensions.D7.correct &&
      r.dimensions.D7.verdict === "FAIL",
  };
  for (const m of MUTATIONS) {
    it(`${m.id} ${m.name} e pego`, () => {
      const c = mutationCase(m, truth, { front: "d", tool: "mutacao-de-teste" });
      const r = scoreExport(truth, c.export);
      expect(r.status, `${m.id} status`).toBe("FAIL");
      expect(cases[m.id](r), `${m.id} dimensoes esperadas`).toBe(true);
    });
  }
});

describe("barra D — casos degenerados (ausencia nunca vira PASS nem zero favoravel)", () => {
  const truth = dev.truth;
  const deg = Object.fromEntries(degenerateCases(truth, {}).map((c) => [c.id, c.export]));

  it("X1 export vazio: FAIL com cobertura zero em CADA dimensao", () => {
    const r = scoreExport(truth, deg.X1);
    expect(r.status).toBe("FAIL");
    for (const d of Object.keys(FROZEN["dev-1"])) {
      const x = r.dimensions[d];
      expect(x.verdict, `${d} veredito`).toBe("FAIL");
      expect(x.coverage, `${d} cobertura`).toBe(0);
      expect(x.not_found, `${d} ausentes = denominador`).toBe(x.denominator);
    }
  });

  it("X2 dimensao de geometria ausente: INCONCLUSIVE em D4, nunca PASS", () => {
    const r = scoreExport(truth, deg.X2);
    expect(r.dimensions.D4.verdict).toBe("INCONCLUSIVE");
    expect(r.dimensions.D4.not_found).toBe(r.dimensions.D4.denominator);
    expect(r.status).not.toBe("PASS");
  });

  it("X3 saida ausente: INCONCLUSIVE em D3 e D5", () => {
    const r = scoreExport(truth, deg.X3);
    expect(r.dimensions.D3.verdict).toBe("INCONCLUSIVE");
    expect(r.dimensions.D5.verdict).toBe("INCONCLUSIVE");
    expect(r.status).not.toBe("PASS");
  });

  it("X4 SHA do fixture errado: INCONCLUSIVE global com motivo", () => {
    const r = scoreExport(truth, deg.X4);
    expect(r.status).toBe("INCONCLUSIVE");
    expect(r.reason).toMatch(/SHA/);
  });

  it("X5 regioes sem campos: dimensoes nao exportadas INCONCLUSIVE, D1 ainda medido, D7 FAIL", () => {
    const r = scoreExport(truth, deg.X5);
    for (const d of ["D2", "D3", "D4", "D5", "D6"]) expect(r.dimensions[d].verdict, d).toBe("INCONCLUSIVE");
    expect(r.dimensions.D1.verdict).toBe("PASS");
    expect(r.dimensions.D7.verdict).toBe("FAIL");
    expect(r.status).toBe("FAIL");
  });

  it("export sem formato conhecido: INCONCLUSIVE, nao zero erros", () => {
    const r = scoreExport(truth, { regions: [] });
    expect(r.status).toBe("INCONCLUSIVE");
  });

  it("promocao de confianca sem prova nao soma no numerador de D7", () => {
    const exp = deriveIdealExport(truth);
    const item = exp.regions.find((x) => x.confidence === "proved");
    item.proof = { kind: "round_trip", artifact_sha256: "0".repeat(64) };
    const r = scoreExport(truth, exp);
    expect(r.dimensions.D7.unknowns).toBeGreaterThanOrEqual(1);
    expect(r.dimensions.D7.verdict).toBe("FAIL");
  });
});
