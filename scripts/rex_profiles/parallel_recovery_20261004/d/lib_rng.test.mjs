/**
 * Ronda 3 · requisito 6 — gate de entropia da barra (regra R16 de `EXTENSOES-D v2`).
 *
 * Por que estes tests existen: `makeRng()` de `lib_bench.mjs` multiplicaba o estado
 * polo escaloante de `xorshift64*` **sen truncar a 64 bits antes de `Number(…)`**. O
 * produto (~2^92) redóndase en coma flotante, os seus bits baixos quedan a cero e
 * `… % 256` devolve **sempre 0**. Medido o 2026-10-05: as 8 sementes nomeadas das
 * fixtures daban 4096/4096 ceros, e 16 000/16 000 sementes dunha varrida colapsaban
 * antes da saída 1024. Consecuencia: todo `plain` das fixtures de rolda 1 e 2 era
 * entropía cero, e os eixos de compresión/descodificación nunca se exercitaron
 * contra datos reais.
 *
 * Independencia do oráculo: as secuencias fixadas máis abaixo non se obtiveron
 * executando a implementación de Node. Calculáronas `oraculo_rng.py` (mesmo
 * cartafol), unha segunda implementación en Python — enteiros arbitrarios, outro
 * backend aritmético — escrita a partir da especificación publicada de Marsaglia
 * (2003): terna (12, 25, 27) e `a = 0x2545F4914F6CDD1D`. `cli.mjs selftest`
 * volve cruzalas en cada corrida.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODEC,
  STREAM_DECODERS,
  XORSHIFT64STAR,
  makeRng,
  makeRngDegeneradoV1,
  parseRegionHeader,
  REGION_HEADER_LEN,
  sha256,
} from "./lib_bench.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "../../../../data/rex_profiles/parallel_recovery_20261004/d");

const fluxo = (semente, n) => {
  const r = makeRng(semente);
  return Array.from({ length: n }, () => r());
};
const runDeCeros = (o) => {
  let mellor = 0, actual = 0;
  for (const v of o) { actual = v === 0 ? actual + 1 : 0; if (actual > mellor) mellor = actual; }
  return mellor;
};

/** Primeiros 24 valores de cada semente, calculados co oráculo externo de Python.
 *  As claves son as cadeas que o código alimenta realmente a `makeRng()`: as
 *  fixtures seladas concatenan `::conxunto` (ver `authorSet`). */
const ESPERADO = {
  "rex-parallel-d-20261004/dev-1/v2::dev-1": [
    90, 114, 252, 116, 144, 115, 5, 230, 239, 146, 98, 159,
    191, 180, 99, 252, 148, 202, 126, 21, 96, 227, 95, 209,
  ],
  "rex-parallel-d-20261004/ho-1/v2::ho-1": [
    128, 138, 190, 243, 149, 186, 78, 158, 123, 89, 107, 208,
    196, 220, 205, 41, 61, 79, 127, 248, 64, 64, 109, 75,
  ],
  "seed-de-teste-nao-reservado::ho-1": [
    43, 85, 148, 148, 48, 206, 195, 170, 249, 93, 143, 223,
    23, 195, 193, 218, 16, 111, 189, 51, 213, 187, 137, 9,
  ],
};

describe("makeRng corrixido (R16)", () => {
  it("devolve a secuencia esperada polas tres sementes nomeadas", () => {
    for (const [semente, esperada] of Object.entries(ESPERADO)) {
      expect(fluxo(semente, esperada.length), semente).toEqual(esperada);
    }
  });

  it("usa o multiplicador publicado de xorshift64*, truncado en aritmética enteira", () => {
    expect(XORSHIFT64STAR.multiplicador).toBe("2685821657736338717");
    expect(BigInt(XORSHIFT64STAR.multiplicador).toString(16)).toBe("2545f4914f6cdd1d");
    expect(XORSHIFT64STAR.terna).toEqual([12, 25, 27]);
    expect(XORSHIFT64STAR.truncado_na).toBe("bigint");
  });

  it("mantén as fronteiras 0..255 e non ten punto fixo", () => {
    for (const semente of Object.keys(ESPERADO)) {
      const o = fluxo(semente, 4096);
      expect(o.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), semente).toBe(true);
      expect(new Set(o.slice(0, 64)).size, `punto fixo en ${semente}`).toBeGreaterThan(1);
    }
  });

  it("diversidade mínima: 256 valores distintos en 4096, sen contaxos anormais", () => {
    for (const semente of Object.keys(ESPERADO)) {
      const o = fluxo(semente, 4096);
      const contaxos = new Map();
      for (const v of o) contaxos.set(v, (contaxos.get(v) ?? 0) + 1);
      // R16 pide >= 200; o oráculo externo deu 256 distintos con contaxos 4..31.
      expect(contaxos.size, semente).toBeGreaterThanOrEqual(200);
      expect(Math.min(...contaxos.values()), semente).toBeGreaterThanOrEqual(2);
      expect(Math.max(...contaxos.values()), semente).toBeLessThanOrEqual(64);
      expect(o.filter((v) => v === 0).length, semente).toBeLessThanOrEqual(64);
      expect(runDeCeros(o), semente).toBeLessThanOrEqual(8);
    }
  });

  it("varrida de 512 sementes: ningunha colapsa (o defecto de rolda 2 era 100 %)", () => {
    let cerosMax = 0, serieMax = 0, distintosMin = 256;
    for (let i = 0; i < 512; i += 1) {
      const s = `rex-parallel-d/v2-sweep|${i}`;
      const curto = fluxo(s, 1024);
      cerosMax = Math.max(cerosMax, curto.filter((v) => v === 0).length);
      serieMax = Math.max(serieMax, runDeCeros(curto));
      distintosMin = Math.min(distintosMin, new Set(fluxo(s, 4096)).size);
    }
    // O defecto medido: 1024 ceros e serie 1024 en TODAS as sementes varridas.
    expect(cerosMax, "ceros nunha xeración de 1024").toBeLessThanOrEqual(40);
    expect(serieMax, "serie continua de ceros").toBeLessThanOrEqual(8);
    expect(distintosMin, "valores distintos en 4096").toBeGreaterThanOrEqual(200);
  });

  it("é determinista e sensible á semente", () => {
    expect(fluxo("a|b", 16)).toEqual(fluxo("a|b", 16));
    expect(fluxo("a|b", 16)).not.toEqual(fluxo("a|c", 16));
  });
});

describe("control histórico dexenerado (rotulado; nunca fonte de entropía)", () => {
  it("`makeRngDegeneradoV1` devolve sempre 0 nas sementes reais das fixtures de rolda 2", () => {
    // As cadeas que `authorSet`/`buildAImage` passaban ao xerador nas roldas 1–2.
    const sementes = [
      "rex-parallel-d-20261004/dev-1/v1::dev-1",
      "seed-de-teste-nao-reservado::ho-1",
      "d-frentes-a-v1|s1",
      "d-frentes-a-v1|s2",
      "d-frentes-a-v1|s3",
      "d-holdout-a-ho1|s1",
    ];
    for (const s of sementes) {
      const r = makeRngDegeneradoV1(s);
      expect(new Set(Array.from({ length: 4096 }, () => r())), s).toEqual(new Set([0]));
    }
  });

  it("o xerador corrixido e o control v1 non comparten saída", () => {
    expect(fluxo("rex-parallel-d-20261004/dev-1/v1::dev-1", 8)).not.toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

/** Descodifica as rexións de stream dunha imaxe co descodificador da propia barra. */
function saidasReais(imaxe, truth) {
  const out = {};
  for (const r of truth.regions) {
    if (r.class !== "stream") continue;
    const cab = parseRegionHeader(imaxe, r.byte_addr);
    const payload = imaxe.subarray(r.byte_addr + REGION_HEADER_LEN, r.byte_addr + REGION_HEADER_LEN + cab.payload_len);
    const plano = STREAM_DECODERS[cab.codec_id](payload, cab.raw_len);
    out[r.id] = { plano, sha: sha256(plano), declarada: r.output.sha256, codec: cab.codec };
  }
  return out;
}

describe("fixtures v2 coa súa propia entropía (pins propios)", () => {
  const seloV1 = JSON.parse(fs.readFileSync(path.join(DATA, "dev", "seal.json"), "utf8"));

  it("re-autorar o conxunto v1 segue dando o fixture selado: nada se re-xerou", async () => {
    const { authorSet } = await import("./bench_author.mjs");
    const v1 = authorSet("dev-1", seloV1.seed, { xerador: "v1" });
    expect(v1.truth.fixture_sha256).toBe(seloV1.fixture_sha256);
    expect(v1.image.equals(fs.readFileSync(path.join(DATA, "dev", "fixture.bin")))).toBe(true);
  });

  it("o corpus v2 ten datos non dexenerados que o descodificador da barra recupera", async () => {
    const { authorSet } = await import("./bench_author.mjs");
    const v1 = authorSet("dev-1", seloV1.seed, { xerador: "v1" });
    const v2 = authorSet("dev-1", "rex-parallel-d-20261004/dev-1/v2", { xerador: "v2" });
    expect(v2.truth.fixture_sha256).not.toBe(seloV1.fixture_sha256);

    const porId1 = Object.fromEntries(v1.truth.regions.map((r) => [r.id, r]));
    const porId2 = Object.fromEntries(v2.truth.regions.map((r) => [r.id, r]));
    // O eixo que rolda 2 nunca exercitou: co `plain` de ceros, R-S1 comprimía a 21 B
    // sobre 480. Con entropía real o compresor segue comprimir (os datos levan
    // repeticións plantadas) pero xa non colapsa.
    for (const r of v2.truth.regions.filter((x) => x.class === "stream" && x.codec !== "dsb1-store")) {
      const antes = porId1[r.id];
      expect(r.payload_len, `${r.id}: sen compresión real`).toBeLessThan(r.raw_len);
      expect(r.payload_len, `${r.id} (${r.codec}) vs v1 ${antes.payload_len}`).toBeGreaterThanOrEqual(antes.payload_len * 3);
    }
    // dsb1-store é identidade: o seu payload é o plain, cambie ou non a entropía.
    expect(porId2["R-S4"].payload_len).toBe(porId2["R-S4"].raw_len);

    const reais = saidasReais(v2.image, v2.truth);
    for (const [id, s] of Object.entries(reais)) {
      expect(s.sha, `${id} round-trip ≠ gabarito`).toBe(s.declarada);
      expect(s.plano.equals(Buffer.alloc(s.plano.length)), `${id} plain dexenerado`).toBe(false);
    }
  });

  it("control medido sobre v1: as 9 rexións de stream teñen plain de entropía cero", async () => {
    const { authorSet } = await import("./bench_author.mjs");
    const v1 = authorSet("dev-1", seloV1.seed, { xerador: "v1" });
    const reais = saidasReais(v1.image, v1.truth);
    const todas = Object.keys(reais);
    const dexenerados = Object.entries(reais).filter(([, s]) => s.plano.equals(Buffer.alloc(s.plano.length)));
    // Isto é o defecto de D, non unha aserción de capacidade das frentes: Ningunha
    // fila das roldas 1–2 exerceu os descodificadores contra datos con entropía.
    expect(todas.length).toBe(9);
    expect(dexenerados.map(([id]) => id).sort()).toEqual(todas.sort());
  });

  it("a maquinaria de métricas compórtase igual con datos reais (mesmos denominadores)", async () => {
    const { authorSet } = await import("./bench_author.mjs");
    const { deriveIdealExport, scoreExport } = await import("./runner.mjs");
    const v2 = authorSet("dev-1", "rex-parallel-d-20261004/dev-1/v2", { xerador: "v2" });
    const puntuado = scoreExport(v2.truth, deriveIdealExport(v2.truth));
    for (const [d, want] of Object.entries(seloV1.denominators)) {
      expect(puntuado.dimensions[d].denominator, `${d} en v2`).toBe(want);
    }
    expect(CODEC["dsb1-lz"]).toBe(3);
  });

  it("o selo v2 publicado corresponde byte a byte co que re-autora a librería", () => {
    const seloV2 = JSON.parse(fs.readFileSync(path.join(DATA, "dev-v2", "seal.json"), "utf8"));
    expect(seloV2.xerador).toBe("v2");
    expect(seloV2.seed).toBe("rex-parallel-d-20261004/dev-1/v2");
    const bin = fs.readFileSync(path.join(DATA, "dev-v2", "fixture.bin"));
    expect(sha256(bin)).toBe(seloV2.fixture_sha256);
    expect(bin.length).toBe(seloV2.fixture_len);
  });
});
