/**
 * Probas do autor de fixtures v2 da fronte A (barra D, rolda 3, requisitos 3 e 6).
 *
 * Cada aserción existe para impedir un modo concreto de virar verde sen
 * merecelo, todos observados nas roldas 1–2:
 *   1. que os bytes dunha sonda volvan escribirse a man (aquí veñen do montador);
 *   2. que o xerador non sexa determinista, ou sexa determinista nunha forma
 *      que ninguén poida reproducir noutro host;
 *   3. que dúas sondas pisen os mesmos bytes e a parella medida sexa un artefacto
 *      da superposición;
 *   4. que unha chamada caia fora da ventá que D declara e o emparellamento se
 *      confunda cunha sonda veciña;
 *   5. que as expectativas volvan escribirse como cadenas `0x…` cando o
 *      comparador normaliza a números (defecto propio de v2, detectado antes de
 *      medir);
 *   6. que o PRNG dexenerado de v1 (1024 ceros) volva pasar por entropía;
 *   7. que se perda un pin de v1 mentras se re-xera v2 (R0);
 *   8. que unha forma que o instrumento recuse fiquede como sonda positiva.
 *
 * Non son probas que repitan o decodificador de A: o ditame vén de
 * `m68k-elf-as`/`m68k-elf-objdump` e da imaxe escrita en disco.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildAImageV2,
  validarEntradaA2,
  inventarioSondas,
  DIR_A,
  NOME_IMG,
  NOME_TRUTH,
  NOME_PIN,
  VENTANXA,
  LAYOUT,
  GABARITO,
  CONTRATO,
} from "./author_v2.mjs";
import { montarSondas, instrumento, controlarSolapamento } from "./montador.mjs";
import { kosinskiDecode, xerador } from "../lib_bench.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const ler = (nome) => fs.readFileSync(path.join(DIR_A, nome));

const img = ler(NOME_IMG);
const truth = JSON.parse(ler(NOME_TRUTH).toString("utf8"));
const pin = JSON.parse(ler(NOME_PIN).toString("utf8"));

let FERRAMENTA = null;
try {
  FERRAMENTA = instrumento();
} catch {
  FERRAMENTA = null;
}

const filasParella = [
  ...truth.ka1v,
  ...truth.ka1v_neg,
  ...truth.ka1v_fora,
  ...truth.ka4v,
  truth.ka3v,
];
const todas = [
  ...truth.ka1v,
  ...truth.ka1v_neg,
  ...truth.ka1v_fora,
  ...truth.ka2v,
  truth.ka3v,
  ...truth.ka4v,
];
/** Xeometría do bloque: a que ditou `m68k-elf-as`, non a que D deduce das filas.
 *  En v1 a lista derivada ocultou sondas e o control de ocos ficou cego. */
const probes = truth.sondas_postas
  .filter((r) => r.rexistro !== "rutina")
  .sort((a, b) => a.sitio - b.sitio);
const porRotulo = new Map(truth.sondas_postas.map((r) => [r.rotulo, r]));

describe("fixtures v2 — pins e non reescrita de v1", () => {
  it("o pin bate co que hai en disco e coa imaxe que declara a verdade", () => {
    expect(sha(img)).toBe(pin.arquivos[NOME_IMG].sha256);
    expect(sha(ler(NOME_TRUTH))).toBe(pin.arquivos[NOME_TRUTH].sha256);
    expect(truth.imaxe.sha256).toBe(sha(img));
    expect(pin.arquivos[NOME_IMG].bytes).toBe(img.length);
    expect(pin.gabarito).toBe(GABARITO);
    expect(pin.contrato).toBe(CONTRATO);
  });

  it("as fixtures v1 conservan os pins co que publicou a súa propia evidencia (R0)", () => {
    // Os dixestos non se escriben a man: léense do manifest commiteado da rolda 2
    // e da verdade v1, que os gravou cando se mediu. Se v2 tocara un byte de v1,
    // esta comparación rompería.
    const evid = JSON.parse(
      fs.readFileSync(
        path.join(DIR_A, "../../medidas/A-bd40e92-manifest.json"),
        "utf8",
      ),
    );
    const v1img = ler("dA-img-v1.bin");
    const v1truth = JSON.parse(ler("dA-truth-v1.json").toString("utf8"));
    expect(sha(v1img)).toBe(evid.imagem.sha256);
    expect(v1img.length).toBe(evid.imagem.bytes);
    expect(sha(ler("dA-truth-v1.json"))).toBe(evid.truth_sha256);
    expect(v1truth.imagem.sha256).toBe(evid.imagem.sha256);
    expect(pin.gabarito).toBe(GABARITO);
    expect(evid.imagem.sha256).not.toBe(pin.arquivos[NOME_IMG].sha256);
  });

  it("o instrumento do pin é o que declara isa-oraculo-v2", () => {
    const gab = JSON.parse(
      fs.readFileSync(
        path.join(DIR_A, "../../gabarito/isa-oraculo-v2.json"),
        "utf8",
      ),
    );
    expect(gab.version).toBe(GABARITO);
    expect(pin.instrumento.sha256_as).toBe(gab.instrumento.sha256["m68k-elf-as"]);
    expect(pin.instrumento.sha256_objdump).toBe(gab.instrumento.sha256["m68k-elf-objdump"]);
    expect(pin.instrumento.filas_sha256).toBe(gab.filas_sha256);
    expect(pin.instrumento.bandeira).toEqual(gab.instrumento.bandeira);
    expect(pin.instrumento.version).toMatch(/GNU Binutils\) 2\.41/);
  });
});

describe("fixtures v2 — denominador e versións (R15)", () => {
  it("o denominador calcúlase das listas: TAv 10, total 35", () => {
    expect(truth.denominador.partes).toEqual({
      KA1v: truth.ka1v.length,
      "KA1v-neg": truth.ka1v_neg.length,
      "KA1v-fora": truth.ka1v_fora.length,
      KA2v: truth.ka2v.length,
      KA3v: 1 + truth.ka3v_g.length,
      KA4v: truth.ka4v.length,
      TAv: truth.tav.length,
    });
    expect(truth.denominador.partes.TAv).toBe(10);
    expect(truth.denominador.total).toBe(35);
  });

  it("tódalas filas declaran gabarito e contrato", () => {
    const filas = [...todas, ...truth.ka3v_g, ...truth.tav];
    expect(filas.length).toBe(truth.denominador.total);
    for (const f of filas) {
      expect(f.gabarito, f.id).toBe(GABARITO);
      expect(f.contrato, f.id).toBe(CONTRATO);
    }
  });

  it("ningunha fila de recusa leva rc 0 no conxunto aceitado, e ningunha aceita 0 sen cadene", () => {
    for (const r of [...truth.ka1v_neg, ...truth.ka1v_fora]) {
      expect(r.esperado.recusa, r.id).toBe(true);
      expect(r.esperado.rc_aceitado.includes(0), r.id).toBe(false);
      expect(r.esperado.cadea_promovida, r.id).toBe(false);
      expect(r.esperado.categoria, r.id).toBe("nao-suportado");
    }
  });

  it("as expectativa numéricas son números: o comparador da barra normaliza a enteiro", () => {
    const campos = ["carga_sitio", "carga_operando", "chamada_sitio", "chamada_alvo"];
    for (const r of filasParella) {
      if (!r.esperado || r.esperado.recusa) continue;
      for (const c of campos) {
        if (r.esperado[c] === undefined) continue;
        expect(typeof r.esperado[c], `${r.id}.${c}`).toBe("number");
      }
    }
    for (const r of truth.ka2v) {
      expect(typeof r.destino_operando, r.id).toBe("number");
    }
  });
});

describe("fixtures v2 — xeometría R14 (unha sonda por sitio)", () => {
  it("ningunha sonda solapa a outra e tódalas caen aliñadas a palabra", () => {
    expect(probes.length).toBe(truth.sondas_postas.length - 2);
    for (const p of probes) expect(p.sitio % 2, p.rotulo).toBe(0);
    for (let i = 1; i < probes.length; i += 1) {
      const anterior = probes[i - 1];
      expect(
        anterior.sitio + anterior.lonxitude <= probes[i].sitio,
        `solapamento: ${anterior.rotulo}@${anterior.sitio.toString(16)}+${anterior.lonxitude} pisa ${probes[i].rotulo}@${probes[i].sitio.toString(16)}`,
      ).toBe(true);
    }
    // As rotinas fixadas por `.org` non se solapan co bloque de sondas.
    for (const rot of truth.sondas_postas.filter((r) => r.rexistro === "rutina")) {
      for (const p of probes) {
        expect(
          rot.sitio + rot.lonxitude <= p.sitio || p.sitio + p.lonxitude <= rot.sitio,
          `rutina ${rot.rotulo}@${rot.sitio.toString(16)} pisa ${p.rotulo}@${p.sitio.toString(16)}`,
        ).toBe(true);
      }
    }
  });

  it("os ocos entre sondas do bloque están cheos de `4e71` (nop), non de ceros", () => {
    for (let i = 1; i < probes.length; i += 1) {
      const ini = probes[i - 1].sitio + probes[i - 1].lonxitude;
      const fin = probes[i].sitio;
      expect((fin - ini) % 2, `oco impar tras ${probes[i - 1].rotulo}`).toBe(0);
      for (let o = ini; o < fin; o += 2) {
        expect(
          img.readUInt16BE(o).toString(16),
          `oco en ${o.toString(16)} (entre ${probes[i - 1].rotulo} e ${probes[i].rotulo})`,
        ).toBe("4e71");
      }
    }
    // Cada oco é exactamente a verba de separación que o autor pediu: se GAS
    // inseriu recheo propio, a fixture deixa de ser a que D describe.
    const separacion = new Map(
      inventarioSondas({ ...LAYOUT, fluxo3: truth.config.fluxo3 }).map((s) => [s.rotulo, s.sep]),
    );
    for (let i = 1; i < probes.length; i += 1) {
      const anterior = probes[i - 1];
      const sep = separacion.get(anterior.rotulo);
      expect(
        probes[i].sitio - (anterior.sitio + anterior.lonxitude),
        `separación de ${anterior.rotulo}`,
      ).toBe(sep * 2);
    }
  });

  it("cada parella declarada cae dentro da ventá e ningunha outra sonda entra nela antes", () => {
    for (const r of filasParella) {
      if (!r.sondeo || !r.chamada || !r.esperado || r.esperado.recusa) continue;
      const fin = r.sondeo.sitio + r.sondeo.lonxitude;
      const d = r.chamada.sitio - fin;
      expect(d, `${r.id}: chamada antes do fin de carga`).toBeGreaterThanOrEqual(0);
      expect(d, `${r.id}: chamada fóra da ventá`).toBeLessThanOrEqual(VENTANXA);
      const intrusas = probes.filter(
        (s) =>
          s.sitio > fin &&
          s.sitio < r.chamada.sitio &&
          s.rotulo !== r.carga_sonda &&
          s.rotulo !== r.chamada_sonda,
      );
      expect(intrusas.map((s) => s.rotulo), `${r.id}: sonda veciña dentro da ventá`).toEqual([]);
    }
  });

  it("TA-3a ten dúas chamadas reais na mesma ventá con alvos distintos", () => {
    const [carga, c1, c2] = [
      truth.sitios["TAv-3a-carga"],
      truth.sitios["TAv-3a-chamada1"],
      truth.sitios["TAv-3a-chamada2"],
    ];
    const fin = carga + 6;
    expect(c1 - fin).toBeGreaterThanOrEqual(0);
    expect(c2 - fin).toBeLessThanOrEqual(VENTANXA);
    expect(img.readUInt32BE(c2 + 2)).not.toBe(img.readUInt32BE(c1 + 2));
    const receita = truth.tav.find((r) => r.id === "TA-3a");
    expect(receita.acao.sitio).toBe(c2);
    expect(receita.esperado_rc_conxunto).toEqual([7]);
    expect(receita.elo_aceitado).toBe("vinculo-chamada-rutina");
  });

  it("TA-3b move a chamada fóra da ventá conservando bytes e alvo coherentes", () => {
    const receita = truth.tav.find((r) => r.id === "TA-3b");
    const sitio = truth.sitios["TAv-3b-chamada"];
    expect(sitio).toBe(receita.acao.sitio);
    const carga = truth.sitios["KA3v-carga"];
    expect(sitio - (carga + 6)).toBeGreaterThan(VENTANXA);
    expect(img.subarray(sitio, sitio + 6).toString("hex").toUpperCase()).toBe(receita.acao.bytes);
    expect(img.readUInt32BE(sitio + 2)).toBe(receita.acao.alvo);
    expect(receita.acao.alvo).toBe(truth.ka3v.esperado.chamada_alvo);
    expect(receita.elo_aceitado).toBe("xeometria");
  });

  it("cada receita illa un eixo: o campo mutado é o único inconsistente da súa base", () => {
    const elos = new Set();
    for (const r of truth.tav) {
      expect(r.esperado_rc_conxunto.length, r.id).toBe(1);
      expect(r.elo_aceitado, r.id).toBeTruthy();
      elos.add(r.elo_aceitado);
    }
    expect([...elos].sort()).toEqual(
      [
        "alvo-chamada",
        "esquema",
        "forma-carga",
        "identidade",
        "mapper",
        "rutina",
        "saída",
        "sitio-carga",
        "vinculo-chamada-rutina",
        "xeometria",
      ].sort(),
    );
  });
});

describe("fixtures v2 — entropía R16 (o PRNG dexenerado de v1 non volta)", () => {
  it("os plain das streams teñen ≥ 200 valores distintos en 4096 e non son ceros", () => {
    for (const [nome, st] of Object.entries(truth.streams)) {
      const n = st.plain_len;
      expect(n, nome).toBeGreaterThan(0);
      const rng = xerador(truth.xerador)(`${truth.config.seed}|${nome}`);
      const plain = Array.from({ length: n }, () => rng());
      const distintos = new Set(plain.slice(0, Math.min(4096, n))).size;
      if (n >= 200) {
        expect(distintos, `${nome}: valores distintos en ${Math.min(4096, n)}`).toBeGreaterThanOrEqual(200);
      }
      expect(plain.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), nome).toBe(true);
      expect(plain.some((v) => v !== 0), `${nome}: plain de entropía cero`).toBe(true);
      const fatia = img.subarray(st.offset, st.offset + st.stream_len);
      expect(sha(fatia), `${nome}: stream na imaxe`).toBe(st.stream_sha256);
      if (st.terminator) {
        expect(sha(kosinskiDecode(fatia)), `${nome}: round-trip`).toBe(st.plain_sha256);
      }
    }
  });

  it("a stream truncada non decodifica", () => {
    expect(() => kosinskiDecode(img.subarray(truth.streams.s3.offset))).toThrow();
    expect(truth.streams.s3.terminator).toBe(false);
  });
});

describe("fixtures v2 — reprodución co instrumento pinado", () => {
  it.skipIf(!FERRAMENTA)(
    "unha montagem nova reproduce byte a byte a imaxe e a verdade gravadas",
    () => {
      const a = buildAImageV2({ seed: truth.config.seed, xerador: truth.xerador });
      expect(sha(a.img)).toBe(truth.imaxe.sha256);
      expect(JSON.stringify(a.truth)).toBe(JSON.stringify(truth));
      expect(validarEntradaA2(a)).toBe(true);
      fs.rmSync(a.traballo, { recursive: true, force: true });
    },
  );

  it(
    "o desmontador confirma en cada sonda o mnemónico e o enderezo efectivo declarados",
    () => {
      for (const r of filasParella) {
        for (const parte of [r.sondeo, r.chamada]) {
          if (!parte) continue;
          const lido = img.subarray(parte.sitio, parte.sitio + parte.lonxitude).toString("hex").toUpperCase();
          expect(lido, `${r.id} bytes na imaxe`).toBe(parte.bytes.toUpperCase());
          expect(parte.instrumento.mnemonico, `${r.id} lectura do instrumento`).toBeTruthy();
          expect(porRotulo.get(r.carga_sonda).sitio, `${r.id} sitio montado`).toBe(r.carga_sitio);
        }
        if (r.esperado && !r.esperado.recusa && r.esperado.carga_operando !== undefined) {
          expect(r.sondeo, `${r.id} espera operando e non ten sondeo`).toBeTruthy();
          expect(r.sondeo.instrumento.ea, `${r.id} EA do desmontador`).toBe(
            r.esperado.carga_operando,
          );
        }
      }
    },
  );

  it("a lectura do instrumento é a que rectifica a rolda 2: `.short` nas negativas, `bsrs` en 61 FF", () => {
    for (const r of truth.ka1v_neg) {
      expect(r.sondeo.instrumento.mnemonico.startsWith(".short"), r.id).toBe(true);
      expect(r.sondeo.bytes.slice(0, 4)).toBe(r.palabras.split(" ")[0]);
    }
    const fora = truth.ka1v_fora.find((r) => r.id === "KA1v-fora-61ff");
    expect(fora.sondeo.instrumento.mnemonico.startsWith("bsrs")).toBe(true);
    // BSR.S de desprazamento −1: ea = sitio + 2 − 1, ditado por objdump.
    expect(fora.sondeo.instrumento.ea).toBe(fora.sondeo.sitio + 1);
    expect(fora.capacidade).toBe("KA1v-fora");
    for (const r of truth.ka1v_fora.filter((f) => f.forma.startsWith("movea"))) {
      expect(r.sondeo.bytes.length % 2, r.id).toBe(0);
      expect(r.sondeo.instrumento.mnemonico.startsWith("movea"), r.id).toBe(true);
    }
  });

  it.skipIf(!FERRAMENTA)(
    "unha forma que o instrumento recusa non pode converterse en sonda positiva",
    () => {
      const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-v2-refuso-"));
      expect(() =>
        montarSondas({
          base: 0x100,
          dir,
          nome: "refuso",
          sondas: [{ rotulo: "movec", texto: "movec %cir,%a0" }],
        }),
      ).toThrow(/recusou o bloque/);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  );

  it("unhas sondas que se pisan fan fallar o control de solapamento", () => {
    expect(() =>
      controlarSolapamento([
        { rotulo: "a", sitio: 0x100, bytes: "41F900008000", lonxitude: 6 },
        { rotulo: "b", sitio: 0x104, bytes: "4EB900002100", lonxitude: 6 },
      ]),
    ).toThrow(/solapadas/);
    expect(
      controlarSolapamento([
        { rotulo: "a", sitio: 0x100, bytes: "41F900008000", lonxitude: 6 },
        { rotulo: "b", sitio: 0x10a, bytes: "4EB900002100", lonxitude: 6 },
      ]),
    ).toBe(true);
  });
});

describe("fixtures v2 — inventario declarado", () => {
  it("o inventario ten rotulos únicos e contén cada probe das filas", () => {
    const nomes = inventarioSondas({ ...LAYOUT, fluxo3: truth.config.fluxo3 }).map((s) => s.rotulo);
    expect(nomes.length).toBe(new Set(nomes).size);
    for (const r of filasParella) {
      expect(nomes, `${r.id} carga`).toContain(r.carga_sonda);
      expect(truth.sitios[r.carga_sonda], `${r.id} sitio da carga`).toBe(r.carga_sitio);
      if (r.chamada_sonda) {
        expect(nomes, `${r.id} chamada`).toContain(r.chamada_sonda);
        expect(truth.sitios[r.chamada_sonda], `${r.id} sitio da chamada`).toBe(r.chamada_sitio);
      }
    }
  });

  it("a ventá que D pasa é a conxelada, non o defecto da ferramenta", () => {
    expect(VENTANXA).toBe(16);
    expect(truth.ventanxa).toBe(16);
  });
});
