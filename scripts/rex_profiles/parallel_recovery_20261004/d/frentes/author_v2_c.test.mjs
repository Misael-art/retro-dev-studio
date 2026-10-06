/**
 * Probas do autor de fixtures v2 da fronte C (barra D, rolda 3, requisitos 3, 4, 7 e 10).
 *
 * O que se prova non é o decodificador de C: é que a barra lle presenten bytes
 * cuxa autoría sexa do instrumento pinado, que as expectativas estean ancoradas
 * no seu propio contrato (liña de `CONTRACT.md` citada) e que ningunha fila poida
 * virar verde por vacúa. Cada aserción corresponde a un modo de virar verde sen
 * merecelo, observado nas roldas 1–2 ou detectado ao re-autorar:
 *   1. bytes escritos a man que o montador non confirmou (R14);
 *   2. fila sen versión de gabarito/contrato mesturada noutra (R15);
 *   3. v1 tocado durante a re-xeración de v2 (R0);
 *   4. un sitio de veredito que non cae dentro da instrución que di pisar;
 *   5. un discriminante de base de desprazamento que se satisfaría con calquera
 *      valor (`sitio+2` e `sitio+4` dan o mesmo alvo);
 *   6. unha fila de fronteira cuxo control non está na imaxe, isto é, que non
 *      podería fallar;
 *   7. vocabulario alleo nas verdades (R13: a tradución só ocorre no adaptador);
 *   8. unha mutación de TC-4 que non cambia o que di cambiar.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  DATA_C,
  GABARITO,
  CONTRATO,
  DENOMINADOR,
  contarFilas,
  gravarV2C,
  imaxeDesdeGrupos,
} from "./author_v2_c.mjs";
import { instrumento, montarSondas, controlarSolapamento } from "./montador.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const ler = (nome) => fs.readFileSync(path.join(DATA_C, nome));

const ARQUIVOS = {
  "dC-cx1-v2": { img: "dC-cx1-v2.bin", truth: "dC-cx1-truth-v2.json" },
  "dC-cx2-v2": { img: "dC-cx2-v2.bin", truth: "dC-cx2-truth-v2.json" },
  "dC-cx3-v2": { img: "dC-cx3-v2.bin", truth: "dC-cx3-truth-v2.json" },
  "dC-cx4-v2": { img: "dC-cx4-v2.bin", truth: "dC-cx4-truth-v2.json" },
};
const IMAXES = Object.fromEntries(Object.entries(ARQUIVOS).map(([k, v]) => [k, v.img]));
const verdades = {};
for (const id of Object.keys(IMAXES)) {
  verdades[id] = JSON.parse(ler(ARQUIVOS[id].truth).toString("utf8"));
}
const pin = JSON.parse(ler("pin-c-v2.json").toString("utf8"));

let FERRAMENTA = null;
try {
  FERRAMENTA = instrumento();
} catch {
  FERRAMENTA = null;
}

/** Só as filas con `gabarito`/`contrato` entran no denominador (R15). */
function filasContadas() {
  return [
    ...verdades["dC-cx1-v2"].kc1,
    ...verdades["dC-cx2-v2"].kc2,
    ...verdades["dC-cx2-v2"].kc5,
    ...verdades["dC-cx3-v2"].kc3,
    ...verdades["dC-cx4-v2"].kc4,
    verdades["dC-cx4-v2"].kc2_indexado,
    ...verdades["dC-cx4-v2"].tc,
  ];
}

// ---------------------------------------------------------------------------

describe("fixtures v2 de C — pins, denominador e non reescrita de v1", () => {
  it("cada arquivo v2 bate co seu pin e o pin co gabarito isa-oraculo-v2", () => {
    expect(pin.esquema).toBe("rex-parallel-d/pin-frentes-c/2");
    expect(pin.gabarito).toBe(GABARITO);
    expect(pin.contrato).toBe(CONTRATO);
    for (const [nome, info] of Object.entries(pin.arquivos)) {
      const buf = ler(nome);
      expect(sha(buf), nome).toBe(info.sha256);
      expect(buf.length, nome).toBe(info.bytes);
    }
    const gab = JSON.parse(
      fs.readFileSync(
        path.join(DATA_C, "../../gabarito/isa-oraculo-v2.json"),
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

  it("o denominador está conxelado en 42 e recálase das listas publicadas", () => {
    const partes = contarFilas(verdades);
    expect(partes).toEqual(DENOMINADOR.partes);
    expect(partes).toEqual({ KC1v: 21, KC2v: 6, KC3v: 2, KC4v: 4, KC5v: 5, TCv: 4 });
    expect(Object.values(partes).reduce((a, b) => a + b, 0)).toBe(DENOMINADOR.total);
    expect(DENOMINADOR.total).toBe(42);
    expect(pin.denominador.partes).toEqual(partes);
    // §12.10 i: a composición de KC3v é a conxelada, coa fila `61 ff` retirada e
    // `1149` no seu lugar — probado polas ids, non por unha descrición.
    expect(verdades["dC-cx3-v2"].kc3.map((f) => f.id)).toEqual([
      "KC3v-linha-f",
      "KC3v-move-b-para-an",
    ]);
    expect(verdades["dC-cx3-v2"].filas_retiradas.map((f) => f.opcode)).toEqual(["61ff"]);
    // §12.10 h: MOVEA son tres filas de dous eixes distintos — `movea.w A0,A1` e
    // `movea.l (A0)+,A3` dentro da lista de §3, `movea.l #imm` fóra del.
    const movea = verdades["dC-cx1-v2"].kc1.filter((f) => f.forma.startsWith("movea"));
    expect(movea.map((f) => f.id).sort()).toEqual([
      "KC1v-movea-l-a0p-a3",
      "KC1v-movea-l-imm-a1",
      "KC1v-movea-w-a0-a1",
    ]);
    expect(movea.map((f) => f.dominio).sort()).toEqual([
      "alegado-por-C",
      "alegado-por-C",
      "coherencia-contrato-codigo",
    ]);
  });

  it("tódalas filas contadas declaran gabarito e contrato (R15)", () => {
    const filas = filasContadas();
    expect(filas.length).toBe(DENOMINADOR.total + 1); // +1: kc2_indexado executa a fila de KC2v
    for (const f of filas) {
      expect(f.gabarito, f.id).toBe(GABARITO);
      expect(f.contrato, f.id).toBe(CONTRATO);
      expect(f.id, "fila sen id").toBeTruthy();
    }
  });

  it("as fixtures v1 de C conservan os dixestos que publicou a súa propia medición (R0)", () => {
    const evid = JSON.parse(
      fs.readFileSync(path.join(DATA_C, "../../medidas/C-275f2af-manifest.json"), "utf8"),
    );
    expect(evid.fixtures.length).toBe(4);
    for (const f of evid.fixtures) {
      const nome = path.basename(f.arquivo);
      expect(sha(ler(nome)), nome).toBe(f.sha256);
      expect(sha(ler(nome.replace(".bin", "-truth.json"))), `${nome} truth`).toBe(f.truth_sha256);
    }
    // Ningunha imaxe v2 se confunde coa súa homóloga v1 agás en dC-cx2, onde a
    // coincidencia é unha constatación (abaixo), non un requisito.
    for (const id of Object.keys(IMAXES)) {
      if (id === "dC-cx2-v2") continue;
      const v1 = ler(`${id.replace("-v2", "")}.bin`);
      expect(sha(v1), `${id} non debe ser idéntico á imaxe v1`).not.toBe(sha(ler(IMAXES[id])));
    }
  });

  it("dC-cx2-v2 reproduce byte a byte a imaxe v1: o defecto de v1 era a autoría, non os bytes", () => {
    const v1 = ler("dC-cx2.bin");
    const v2 = ler("dC-cx2-v2.bin");
    expect(v2.toString("hex")).toBe(v1.toString("hex"));
    expect(sha(v2)).toBe("1c4c9e081716fcda1e7f302c0ec63eb15584354f36d4236446fcdd3096111c3a");
    // …pero as súas verdades non son a mesma cousa: v2 non afirma lonxitudes
    // escritas a man e declara gabarito por fila.
    expect(JSON.stringify(verdades["dC-cx2-v2"].kc2)).not.toBe(
      JSON.stringify(JSON.parse(ler("dC-cx2-truth.json")).kc2),
    );
  });
});

describe("fixtures v2 de C — xeometría e arithmetic de sitios", () => {
  it("cx1: as 21 sondas son contiguas, aliñadas a palabra e os bytes do instrumento están na imaxe", () => {
    const t = verdades["dC-cx1-v2"];
    const img = ler(IMAXES["dC-cx1-v2"]);
    let acumulado = 0;
    for (const f of t.kc1) {
      expect(f.endereco, f.id).toBe(acumulado);
      expect(f.endereco % 2, f.id).toBe(0);
      const lido = img.subarray(f.endereco, f.endereco + f.esperado_instrumento.tam).toString("hex").toUpperCase();
      expect(lido, `${f.id} bytes na imaxe`).toBe(f.bytes);
      expect(f.bytes.length / 2).toBe(f.esperado_instrumento.tam);
      acumulado += f.esperado_instrumento.tam;
    }
    expect(acumulado).toBe(t.fim_instrucoes);
    expect(t.regioes[0].fim).toBe(img.length);
    // Recheo 0xFF, non 0x00: `0000` decodifica como `ori.b #imm,Dn`, que está na
    // lista de §3, e a varredura tragaría o recheo byte a byte (§12.9).
    expect(img.subarray(acumulado).every((b) => b === 0xff)).toBe(true);
  });

  it("os sitios de veredito caen dentro da instrución que din pisar", () => {
    const t1 = verdades["dC-cx1-v2"];
    const img1 = ler(IMAXES["dC-cx1-v2"]);
    const miolo = t1.sitios.find((s) => s.esperado_veredito === "miolo-de-instrucao");
    const dono = t1.kc1.find((f) => miolo.endereco >= f.endereco && miolo.endereco < f.endereco + f.esperado_instrumento.tam);
    expect(dono, "o sitio de miolo non cae dentro de ningunha sonda").toBeTruthy();
    expect(miolo.endereco).toBe(dono.endereco + 2);
    const naalc = t1.sitios.find((s) => s.esperado_veredito === "dentro-regiao-nao-alcancado");
    expect(naalc.endereco).toBeGreaterThanOrEqual(t1.fim_instrucoes);
    expect(naalc.endereco).toBeLessThan(t1.regioes[0].fim);
    expect(img1[naalc.endereco]).toBe(0xff);

    for (const id of ["dC-cx2-v2", "dC-cx3-v2", "dC-cx4-v2"]) {
      const t = verdades[id];
      const img = ler(IMAXES[id]);
      const orixen = id === "dC-cx4-v2" ? t.origin : 0;
      for (const s of t.sitios) {
        if (s.esperado_veredito === "fora-da-regiao") {
          const rex = t.regioes[0];
          expect(s.endereco > rex.fim || s.endereco < rex.inicio, `${id} ${s.endereco}`).toBe(true);
          continue;
        }
        expect(s.endereco, `${id} ${s.endereco} fóra da rexión`).toBeGreaterThanOrEqual(orixen);
        expect(s.endereco - orixen).toBeLessThan(img.length);
      }
    }
  });

  it("cada sonda posta coincide cos bytes da imaxe e non pisa á seguinte", () => {
    for (const id of Object.keys(IMAXES)) {
      const t = verdades[id];
      const img = ler(IMAXES[id]);
      const orixen = id === "dC-cx4-v2" ? t.origin : 0;
      const postas = [...t.sondas_postas].sort((a, b) => a.sitio - b.sitio);
      for (let i = 0; i < postas.length; i += 1) {
        const p = postas[i];
        expect(p.sitio % 2, `${id} ${p.rotulo}`).toBe(0);
        expect(p.sitio + p.lonxitude <= img.length, `${id} ${p.rotulo} fora da imaxe`).toBe(true);
        if (i) expect(postas[i - 1].sitio + postas[i - 1].lonxitude <= p.sitio, `${id} solapamento en ${p.rotulo}`).toBe(true);
        const fila = (t.sequencia ?? []).find((s) => s.rotulo === p.rotulo);
        if (fila) {
          expect(img.subarray(p.sitio, p.sitio + p.lonxitude).toString("hex").toUpperCase()).toBe(fila.bytes);
          expect(fila.endereco - orixen).toBe(p.sitio);
        }
      }
    }
  });

  it("imaxeDesdeGrupos rexeita unha colocación que desborde a rexión declarada", () => {
    expect(() =>
      imaxeDesdeGrupos({
        grupos: [{ rotulo: "a", direccion: 0x100, liñas: [{ bytes: "4e71" }] }],
        base: 0x100,
        lon: 1,
      }),
    ).toThrow(/fóra da imaxe/);
    expect(() =>
      controlarSolapamento([
        { rotulo: "a", sitio: 0x100, bytes: "41f900008000", lonxitude: 6 },
        { rotulo: "b", sitio: 0x104, bytes: "4eb900002100", lonxitude: 6 },
      ]),
    ).toThrow(/solapadas/);
  });
});

describe("fixtures v2 de C — discriminantes non vacúos", () => {
  it("a base do desprazamento discrimina: `sitio+2` e `sitio+4` dan alvos distintos", () => {
    const t = verdades["dC-cx2-v2"];
    const img = ler(IMAXES["dC-cx2-v2"]);
    for (const id of ["KC2v-base-bcc-w", "KC2v-bsr-w", "KC2v-dbra-ext"]) {
      const fila = t.kc2.find((f) => f.id === id);
      const bytes = img.subarray(fila.endereco, fila.endereco + fila.esperado.tam);
      const disp = bytes.readInt16BE(2);
      const base2 = fila.endereco + 2 + disp;
      const base4 = fila.endereco + 4 + disp;
      expect(fila.esperado.alvo, id).toBe(base2);
      expect(base4, `${id}: o discriminante non discrimina (ambas as bases dan ${base2})`).not.toBe(base2);
    }
    // O laço propio de `dbra` é exactamente o sitio conxelado: se o deslocamento
    // fose 0, o alvo sería a instrución seguinte e a fila non mediría nada.
    const dbra = t.kc2.find((f) => f.id === "KC2v-dbra-ext");
    expect(dbra.esperado.alvo).toBe(dbra.endereco);
    // `KC2v-base-bcc-w` cita o erro histórico de v1: a fila existe para que a
    // ferramenta que o cometa puntuque aquí e non noutro sitio.
    expect(dbra.esperado.tam).toBe(4);
    expect(t.kc2.find((f) => f.id === "KC2v-base-bcc-w").discriminante).toContain("sitio+4");
  });

  it("as fronteiras de KC3v teñen control posto na imaxe: a proba pode fallar", () => {
    const t = verdades["dC-cx3-v2"];
    const img = ler(IMAXES["dC-cx3-v2"]);
    expect(t.kc3.length).toBe(2);
    for (const f of t.kc3) {
      const control = f.control_de_discriminacion;
      expect(control, `${f.id} sen control de discriminación`).toBeTruthy();
      expect(control.endereco).toBeGreaterThan(f.endereco);
      expect(img.subarray(control.endereco, control.endereco + 2).toString("hex").toUpperCase()).toBe("4E75");
      expect(control.esperado_veredito).toBe("dentro-regiao-nao-alcancado");
      expect(f.esperado.nada_decodificado_ades).toBe(control.endereco);
      // Ningunha fila de fronteira afirma lonxitude de instrución (§12.10 i).
      expect(f.esperado.tam, `${f.id} afirma lonxitude nunha fronteira`).toBeUndefined();
      expect(f.esperado.bytes_para, `${f.id} conserva bytes_para de v1`).toBeUndefined();
      expect(f.sondeo.desmontaxe, f.id).toBeTruthy();
    }
    // O control positivo está fóra do alcance das fronteiras e é decodificábel.
    expect(t.controle_positivo.endereco).toBe(0x30);
    expect(t.raizes.map((r) => r.endereco)).toContain(0x30);
  });

  it("a mutación de TC-4 cambia exactamente os bytes que declara e nese sitio", () => {
    const t = verdades["dC-cx4-v2"];
    const img = ler(IMAXES["dC-cx4-v2"]);
    const tc4 = t.tc.find((f) => f.id === "TC-4");
    const { offset_na_arquivo: off, valor } = tc4.acao;
    const antes = Buffer.from(img);
    antes[off] ^= valor;
    expect(antes.subarray(off, off + 2).toString("hex")).toBe("f000");
    expect(tc4.esperado.bytes_antes).toBe(img.subarray(off, off + 2).toString("hex").toUpperCase());
    expect(tc4.esperado.bytes_depois).toBe("F000");
    expect(tc4.esperado.endereco_mutado).toBe(t.origin + off);
    expect(tc4.esperado.delta_cobertura_bytes).toBe(2);
    expect(tc4.esperado.variante_illada.raiz_extra.endereco).toBe(t.origin + 2);
    // Sen a raíz extra, a receita mediría alcançabilidade e non lonxitude (§12.9).
    const tc1 = t.tc.find((f) => f.id === "TC-1");
    expect(tc1.esperado_rc).toBe(2);
  });

  it("as coberturas publican a variante que discrimina a lectura do contrato", () => {
    for (const id of ["dC-cx1-v2", "dC-cx3-v2", "dC-cx4-v2"]) {
      const cov = verdades[id].cobertura_esperada_bytes;
      expect(typeof cov.primaria, id).toBe("number");
      const variante =
        cov.variante_movea_l_imm_decodifica ?? cov.variante_fronteiras_contan_como_decodificadas;
      expect(variante, `${id} sen variante publicada`).toBeGreaterThan(cov.primaria);
      expect(cov.nota, `${id} cobertura sen nota`).toBeTruthy();
    }
    const cx2 = verdades["dC-cx2-v2"];
    expect(cx2.cobertura_esperada_bytes).toBe(20);
    expect(cx2.kc5.find((f) => f.id === "KC5v-cobertura").esperado).toEqual({
      bytes_decodificados: 20,
      bytes_regiao: 24,
    });
  });
});

describe("fixtures v2 de C — vocabulario da propia fronte (R13)", () => {
  const VEREDITOS = new Set([
    "instrucao-de-bloco",
    "miolo-de-instrucao",
    "dentro-regiao-nao-alcancado",
    "fora-da-regiao",
    "ponto-de-fronteira",
  ]); // CONTRACT.md:120-121
  const PROVENIENCIAS = new Set([
    "candidato",
    "referencia-estatica",
    "vinculo-estrutural",
    "vetor-plataforma",
    "dentro-de-fluxo",
  ]); // CONTRACT.md:42-46
  const FRONTES = new Set([
    "indirect-opaque",
    "trap-opaco",
    "opcode-fora-do-subconjunto",
    "limite-de-regiao",
    "limite-de-trabalho",
    "truncada",
  ]); // CONTRACT.md:25, 90, 97-98 e §5
  const ARRESTA_TIPOS = new Set([
    "queda",
    "desvio",
    "chamada",
    "retorno-fronteira",
  ]); // CONTRACT.md:113
  const ARRESTA_STATUS = new Set([
    "resolvido",
    "fora-da-regiao",
    "indireto-opaco",
    "armadilha",
  ]); // CONTRACT.md:114

  it("verditos, proveniencias e tipos de fronteira son os de C, non traducións de D", () => {
    // `tipo` vale dúas cousas distintas en C: clase de fronteira (`opcode-fora-do-subconjunto`,
    // `indirect-opaque`, …) nas filas que esperan recusa, e clase de aresta
    // (`queda|desvio|chamada|retorno-fronteira`, §4 liña 113) nas filas de fluxo.
    // O discriminante é a propia fila — `fronteira: true` ou `fronteira: "<clase>"`
    // — porque as dúas linguas conviven dentro da mesma imaxe (KC1v ten unha
    // recusa e KC4v tres). Se D as mesturase, o medidor lería «queda» onde C di
    // «opcode-fora-do-subconjunto» e a fila puntuaría igual.
    const frontesExercitadas = [];
    const aristasExercitadas = [];
    for (const [id, t] of Object.entries(verdades)) {
      for (const s of t.sitios) {
        expect(VEREDITOS.has(s.esperado_veredito), `${id} ${s.esperado_veredito}`).toBe(true);
      }
      for (const r of t.raizes) expect(PROVENIENCIAS.has(r.proveniencia), r.proveniencia).toBe(true);
      for (const lista of [t.kc1, t.kc2, t.kc3, t.kc4, t.kc5]) {
        for (const f of lista ?? []) {
          const e = f.esperado;
          if (!e) continue;
          const recusa = e.fronteira === true || typeof e.fronteira === "string";
          if (typeof e.fronteira === "string") {
            expect(FRONTES.has(e.fronteira), `${f.id} fronteira ${e.fronteira}`).toBe(true);
            frontesExercitadas.push(e.fronteira);
          }
          if (typeof e.tipo === "string") {
            if (recusa) {
              expect(FRONTES.has(e.tipo), `${f.id} tipo ${e.tipo} nunha recusa`).toBe(true);
              frontesExercitadas.push(e.tipo);
            } else {
              expect(ARRESTA_TIPOS.has(e.tipo), `${f.id} tipo ${e.tipo} nunha aresta`).toBe(true);
              aristasExercitadas.push(e.tipo);
            }
          }
          for (const x of e.tipos ?? []) {
            expect(ARRESTA_TIPOS.has(x), `${f.id} tipos ${x}`).toBe(true);
            aristasExercitadas.push(x);
          }
          if (e.status) expect(ARRESTA_STATUS.has(e.status), `${f.id} status ${e.status}`).toBe(true);
        }
      }
    }
    // As dúas linguas teñen que estar realmente presentes: se un dos conxuntos
    // non se exercita, a separación de enriba é non discriminante.
    expect(new Set(frontesExercitadas).size).toBeGreaterThanOrEqual(3);
    expect(new Set(aristasExercitadas).size).toBeGreaterThanOrEqual(3);
    // Unha fila de recusa non pode prestar o vocabulario de aresta, e á inversa:
    // as listas están separadas e ningún valor pertence ás dúas.
    for (const x of new Set(frontesExercitadas)) expect(ARRESTA_TIPOS.has(x), x).toBe(false);
    for (const x of new Set(aristasExercitadas)) expect(FRONTES.has(x), x).toBe(false);
  });

  it("cada fila citada ten a súa cita de CONTRACT.md co número de liña", () => {
    const filas = filasContadas().filter((f) => f.id !== "TC-1" && f.id !== "TC-2" && f.id !== "TC-3" && f.id !== "TC-4");
    expect(filas.length).toBeGreaterThan(30);
    for (const f of filas) {
      const cita = f.citacao_C ?? f.citacao;
      expect(cita, `${f.id} sen cita`).toBeTruthy();
      // Dous requisitos: a sección (`§4`) e o número de liña concreto. O texto
      // pode ir entre eles («§4 regra 2, liñas 130-132»), pero unha cita sen
      // liña non é comprobable por un terceiro.
      expect(/§\d+/.test(cita) && /liñ[ao]s? \d+(-\d+)?/.test(cita), `${f.id} cita sen sección ou sen número de liña: ${cita}`).toBe(true);
    }
  });

  it("ningunha fila herda capacidade doutra fronte (R18): os dominios están declarados", () => {
    const dominios = new Set(filasContadas().map((f) => f.dominio).filter(Boolean));
    for (const d of dominios) {
      expect(["alegado-por-C", "fronteira-acordada", "fora-do-subconjunto-de-C", "coherencia-contrato-codigo"]).toContain(d);
    }
    // O eixe de (j) só o usa a fila de `movea.l #imm`.
    const coherencia = filasContadas().filter((f) => f.dominio === "coherencia-contrato-codigo");
    expect(coherencia.map((f) => f.id)).toEqual(["KC1v-movea-l-imm-a1"]);
  });
});

describe("fixtures v2 de C — reprodución co instrumento pinado", () => {
  it.skipIf(!FERRAMENTA)(
    "unha xeración nova reproduce byte a byte as imaxes, as verdades e o pin",
    () => {
      const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-c-v2-repro-"));
      const r = gravarV2C({ dir });
      expect(Object.keys(r.pin.arquivos).sort()).toEqual(Object.keys(pin.arquivos).sort());
      for (const [nome, info] of Object.entries(pin.arquivos)) {
        expect(r.pin.arquivos[nome].sha256, nome).toBe(info.sha256);
      }
      expect(JSON.stringify(r.truths)).toBe(JSON.stringify(verdades));
      expect(r.pin.instrumento.sha256_as).toBe(pin.instrumento.sha256_as);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  );

  it.skipIf(!FERRAMENTA)(
    "unha forma que o instrumento recusa non pode converterse en sonda positiva",
    () => {
      const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-c-v2-refuso-"));
      // `movec` é 68020: `as -m68000` recúsao e o montador non degrada a unha
      // táboa escrita a man (defecto que invalidou cinco filas de KA1 en v1).
      expect(() =>
        montarSondas({
          base: 0x100,
          dir,
          nome: "refuso",
          inst: FERRAMENTA,
          sondas: [{ rotulo: "movec", texto: "movec %cir,%a0" }],
        }),
      ).toThrow(/recusou o bloque/);
      // Unha palabra que GAS monta pero objdump non nomea si pode ser sonda de
      // fronteira: é o camiño `palabras` que usan as dúas filas de KC3v.
      const m = montarSondas({
        base: 0x100,
        dir: path.join(dir, "palabras"),
        nome: "fronteira",
        nops: 0,
        inst: FERRAMENTA,
        sondas: [{ rotulo: "linef", palabras: [0xf000], sep: 0 }],
      });
      expect(m.sondas[0].bytes.toUpperCase()).toBe("F000");
      expect(m.sondas[0].mnemonico.startsWith("Address")).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  );
});
