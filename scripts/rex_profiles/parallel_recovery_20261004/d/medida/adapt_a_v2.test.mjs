/**
 * Controls negativos do adaptador v2 de A.
 *
 * Unha rolda que acaba 35/35 non vale nada se nada podería fallar. Estes tests
 * non miden a fronte: miden o **escore**. Cada un ou ben altera UNHA expectativa
 * do gabarito pinned (nunca o arquivo da árbore: a copia mutada vive en scratch
 * e só se usa a través de `arquivoVerdade`) ou ben exerce o escore con casos que
 * a medición real non produce. Se o adaptador fose vacuo — comparar campos que
 * non existen, aceptar calquera rc, ignorar o elo — o control correspondente
 * queda PASS e o test falla.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES, SCRATCH_V2, presente, garantir, sha256Arquivo } from "./ferramentas.mjs";
import { adaptarA2, lerInforme, pontuarR12, GABARITO, CONTRATO, NOME_TRUTH } from "./adapt_a_v2.mjs";

const DIR_A = path.join(FIXTURES, "a");
const CAMIÑO_VERDADE = path.resolve(DIR_A, NOME_TRUTH);
const HAI_FERRAMENTA = presente("A_corrixido") && fs.existsSync(CAMIÑO_VERDADE);

const real = (r) => r.linhas.filter((l) => l.pontua !== false);
const fila = (r, id) => {
  const f = real(r).find((l) => l.fila === id);
  expect(f, `fila ${id} non producida polo adaptador`).toBeTruthy();
  return f;
};
const nonPass = (r) => real(r).filter((l) => l.veredito !== "PASS").map((l) => l.fila);

function verdadeMutada(nome, mutar) {
  const t = JSON.parse(fs.readFileSync(CAMIÑO_VERDADE, "utf8"));
  mutar(t);
  garantir(SCRATCH_V2);
  const p = path.join(SCRATCH_V2, `control-negativo-${nome}.json`);
  fs.writeFileSync(p, JSON.stringify(t) + "\n");
  expect(sha256Arquivo(p), "a mutación non cambiou nada: control vacuo").not.toBe(sha256Arquivo(CAMIÑO_VERDADE));
  return p;
}

function medirMutando(nome, mutar) {
  const r = adaptarA2({ chave: "A_corrixido", arquivoVerdade: verdadeMutada(nome, mutar) });
  expect(r.ausente, "ferramenta de A ausente: o control non se puido executar").toBe(false);
  return r;
}

describe("lerInforme — o informe por elos léese tal como A o imprime", () => {
  // Captura real de `rex-chain revalidar` en bd40e92 (campo `bruto` da evidencia v2).
  const TODO_PASS =
    "rex-chain revalidar codigo=0\nesquema=PASS(ok) identidade=PASS(e02ab63908) mapper=PASS(md-linear rom_size=0x020000) " +
    "sitio-carga=PASS(41F900008000) argumento-fonte=PASS(lea.l/A0 0x008000) destino=SKIP(sen elo de destino declarado) " +
    "sitio-chamada=PASS(4EB900002100) alvo-chamada=PASS(0x002100) vinculo-chamada-rutina=PASS(0x002100) " +
    "xeometria=PASS(ventána 16 ok) rutina=PASS(32 B d24e2b69) saída=PASS(consumo=1157 saida=1024)";

  it("extrae o código e a orde dos 12 elos, con acento e SKIP", () => {
    const r = lerInforme(TODO_PASS);
    expect(r.codigo).toBe(0);
    expect(r.elos.map((e) => e.nome)).toEqual([
      "esquema", "identidade", "mapper", "sitio-carga", "argumento-fonte", "destino",
      "sitio-chamada", "alvo-chamada", "vinculo-chamada-rutina", "xeometria", "rutina", "saída",
    ]);
    expect(r.fallos).toEqual([]);
    expect(r.elos.find((e) => e.nome === "destino").estado).toBe("SKIP");
  });

  it("un informe sen `codigo=` non pode pontuar por código", () => {
    expect(lerInforme("rex-chain revalidar ok").codigo).toBe(null);
    expect(lerInforme(null).elos).toEqual([]);
  });

  it("o acento de `saída` non se perde: sen el un fallo de saída sería invisíbel", () => {
    const c = lerInforme("rex-chain revalidar codigo=9\nesquema=PASS(ok) saida=FAIL(hash diverxente)");
    expect(c.fallos).toEqual(["saida"]);
    const a = lerInforme("rex-chain revalidar codigo=9\nesquema=PASS(ok) saída=FAIL(hash diverxente)");
    expect(a.fallos).toEqual(["saída"]);
  });
});

describe("pontuarR12 — a categoría deriva do rc, o veredito dos tres invariantes", () => {
  const BASE = { rc_aceitado: [5, 6], rc_medido: 5, elo_aceitado: null, fallos: [] };

  it("rc dentro do conxunto, sen cadea promovida e co motivo ⇒ PASS", () => {
    expect(pontuarR12(BASE)).toMatchObject({ veredito: "PASS", categoria: "aplicavel" });
  });

  it("rc 0 ⇒ `falha`: aceptou unha forma que o gabarito declara non soportada", () => {
    expect(pontuarR12({ ...BASE, rc_medido: 0 })).toMatchObject({ veredito: "FAIL", categoria: "falha" });
  });

  it("rc fóra do conxunto ⇒ `descoñecido` con motivo, nunca `falha` silenciosa", () => {
    const r = pontuarR12({ ...BASE, rc_medido: 11, fallos: ["xeometria"] });
    expect(r).toMatchObject({ veredito: "FAIL", categoria: "desconhecido" });
    expect(r.desvio).toContain("fóra do conxunto");
    expect(r.desvio).toContain("xeometria");
  });

  it("rc correcto pero elo equivocado ⇒ FAIL en `aplicavel` (a recusa foi xusta noutro eixo)", () => {
    const r = pontuarR12({ ...BASE, rc_medido: 6, elo_aceitado: "esquema", fallos: ["forma-carga"] });
    expect(r.veredito).toBe("FAIL");
    expect(r.categoria).toBe("aplicavel");
    expect(r.desvio).toContain("elo illado");
  });

  it("rc correcto pero motivo alleo ⇒ FAIL", () => {
    expect(pontuarR12({ ...BASE, motivosOk: false })).toMatchObject({ veredito: "FAIL" });
  });

  it("rc correcto pero cadea promovida ⇒ FAIL (invariante 2 de R12)", () => {
    const r = pontuarR12({ ...BASE, cadea_promovida: true });
    expect(r.veredito).toBe("FAIL");
    expect(r.desvio).toContain("promoveu");
  });

  it("dous elos en falla non é un eixo illado", () => {
    const r = pontuarR12({ ...BASE, elo_aceitado: "identidade", fallos: ["identidade", "mapper"] });
    expect(r.veredito).toBe("FAIL");
  });

  it("o elo `saída` idenfícase co acento posto", () => {
    expect(pontuarR12({ ...BASE, rc_medido: 9, rc_aceitado: [9], elo_aceitado: "saída", fallos: ["saída"] }).veredito).toBe("PASS");
  });
});

describe.skipIf(!HAI_FERRAMENTA)("escore v2 sobre a ferramenta real — cada invariante ten que poder fallar", () => {
  it("baseline: as 35 filas pontúan PASS e o gabarito/contrato van en cada fila", () => {
    const r = adaptarA2({ chave: "A_corrixido" });
    expect(r.ausente).toBe(false);
    expect(real(r).length).toBe(35);
    expect(r.linhas.filter((l) => l.pontua === false).map((l) => l.fila)).toEqual(["TA-2-control"]);
    for (const l of real(r)) {
      expect(l.gabarito, l.fila).toBe(GABARITO);
      expect(l.contrato, l.fila).toBe(CONTRATO);
      expect(l.veredito, `${l.fila}: ${l.desvio ?? l.motivo ?? ""}`).toBe("PASS");
      expect(["aplicavel", "nao-suportado"], `${l.fila} en ${l.categoria}`).toContain(l.categoria);
    }
  });

  it("un hash de saída equivocado no gabarito faila KA3v — e só KA3v", () => {
    const r = medirMutando("ka3v-saida", (t) => {
      t.ka3v.esperado.saida_sha256 = "0".repeat(64);
    });
    expect(fila(r, "KA3v").veredito).toBe("FAIL");
    expect(fila(r, "KA3v").divergencias.map((d) => d.campo)).toEqual(["saida_sha256"]);
    expect(nonPass(r)).toEqual(["KA3v"]);
  });

  it("un operando de carga errado faila a fila KA1v correspondente", () => {
    const r = medirMutando("ka1v-operando", (t) => {
      t.ka1v.find((x) => x.id === "KA1v-jmp-pcd16").esperado.carga_operando = 32769;
    });
    expect(fila(r, "KA1v-jmp-pcd16").divergencias.map((d) => d.campo)).toEqual(["carga_operando"]);
    expect(nonPass(r)).toEqual(["KA1v-jmp-pcd16"]);
  });

  it("un rc fóra do conxunto publicado publícase como `descoñecido` (R12)", () => {
    const r = medirMutando("ta4-rc", (t) => {
      t.tav.find((x) => x.id === "TA-4").esperado_rc_conxunto = [99];
    });
    const f = fila(r, "TA-4");
    expect(f.veredito).toBe("FAIL");
    expect(f.categoria).toBe("desconhecido");
    expect(f.desvio).toContain("fóra do conxunto");
    expect(nonPass(r)).toEqual(["TA-4"]);
  });

  it("o elo illado é un invariante real: trocalo faila a receita mantendo o rc", () => {
    const r = medirMutando("ta5b-elo", (t) => {
      t.tav.find((x) => x.id === "TA-5b").elo_aceitado = "mapper";
    });
    const f = fila(r, "TA-5b");
    expect(f.rc).toBe(6);
    expect(f.veredito).toBe("FAIL");
    expect(f.categoria).toBe("aplicavel");
    expect(f.medidos.elos_en_falla).toEqual(["forma-carga"]);
    expect(nonPass(r)).toEqual(["TA-5b"]);
  });

  it("un motivo que non aparece no informe faila a recusa (invariante 3 de R12)", () => {
    const r = medirMutando("neg-motivo", (t) => {
      t.ka1v_neg[0].esperado.motivos_aceitados = ["motivo-inventado-por-d"];
    });
    const f = fila(r, r.linhas.find((l) => l.capacidade === "KA1v-neg").fila);
    expect(f.veredito).toBe("FAIL");
    expect(f.divergencias.map((d) => d.campo)).toContain("motivo");
  });

  it("o clamp silencioso detéctase: esixir unha limitación que A non publica faila a fila", () => {
    const r = medirMutando("ka2v-clamp", (t) => {
      t.ka2v.find((x) => x.id === "KA2v-rom").limitacion_esixida = "efectivo≠bus(destino)";
    });
    const f = fila(r, "KA2v-rom");
    expect(f.veredito).toBe("FAIL");
    expect(f.extras.clamp_silencioso_detectado).toBe(true);
    expect(f.divergencias.map((d) => d.campo)).toContain("limitacions");
    // e a fila que si a publica segue PASS: o control non é «calquera limitación falla»
    expect(fila(r, "KA2v-fora-bus").veredito).toBe("PASS");
    expect(nonPass(r)).toEqual(["KA2v-rom"]);
  });

  it("un fluxo truncado aceptado como cadea faila KA4v (rc 0 prohibido sen terminator)", () => {
    const r = medirMutando("ka4v-truncada", (t) => {
      t.ka4v.find((x) => x.id === "KA4v-s3").esperado.rc = 0;
    });
    const f = fila(r, "KA4v-s3");
    expect(f.rc).toBe(10);
    expect(f.veredito).toBe("FAIL");
    expect(nonPass(r)).toEqual(["KA4v-s3"]);
  });

  it("unha forma aceptada que o gabarito declarase recusa non se pontúa como PASS", () => {
    const id = "KA1v-lea-l";
    const r = medirMutando("ka1v-recusa-falsa", (t) => {
      const s = t.ka1v.find((x) => x.id === id);
      s.esperado = { recusa: true, rc_aceitado: [5], motivos_aceitados: ["non-forma"], cadea_promovida: false };
    });
    const f = fila(r, id);
    expect(f.rc).toBe(0); // A aceptou a forma; o gabarito mutado pide recusa
    expect(f.veredito).toBe("FAIL");
    expect(nonPass(r)).toContain(id);
  });
});
