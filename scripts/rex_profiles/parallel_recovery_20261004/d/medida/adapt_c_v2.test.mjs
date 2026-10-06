/**
 * Controis negativos do adaptador v2 de C.
 *
 * Unha medición 40/42 non vale nada se nada podería fallar. Estes tests **non miden a
 * fronte C**: miden o **escore de D**. Cada un altera UNHA expectativa do gabarito
 * conxelado (nunca o arquivo da árbore: a copia mutada vive en `SCRATCH_V2` e só se usa
 * a través de `dirVerdade`, polo que `pin-c-v2.json` e a procedencia `8ea5821` seguen
 * comprobando os arquivos reais) ou ben exerce unha porta do contrato cun caso que a
 * medición real non produce. Se o adaptador fose vacuo — comparar campos que non existen,
 * aceptar calquera rc, ignorar o elo, ou unha porta R11 que se activa onde non debe —
 * o control correspondente queda co veredito antigo e o test falla.
 *
 * Un control negativo tamén é vacuo se a mutación non muda nada: `verdadeMutada`
 * comproba o dixesto do arquivo antes de devolvelo.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES, MEDIDAS, SCRATCH_V2, garantir, presente, sha256, sha256Arquivo } from "./ferramentas.mjs";
import {
  DESPRAZO,
  GABARITO_ISA,
  PORTA_R11,
  TABELA_VOCABULARIO,
  UMBRAL_RENUMERACION,
  adaptarC2,
  cargarOraculo,
  derivarCitacao,
  ditame,
  mapearLiña,
  portaR11,
  verificarCitacao,
  verificarPrecedencia,
  vocab,
} from "./adapt_c_v2.mjs";

const DIR_C = path.join(FIXTURES, "c");
const CAMIÑO_VERDADE = path.join(DIR_C, "dC-cx1-truth-v2.json");
const HAI_FERRAMENTA = presente("C_novo") && fs.existsSync(CAMIÑO_VERDADE) && fs.existsSync(GABARITO_ISA);

const CONTROIS = path.join(SCRATCH_V2, "controis");

/** Filas que entran no denominador (`pontua !== false`). */
const reais = (r) => r.linhas.filter((l) => l.pontua !== false);
const fila = (r, id) => {
  const f = r.linhas.find((l) => l.fila === id || l.fila === `${id}-VOID`);
  expect(f, `fila ${id} non producida polo adaptador`).toBeTruthy();
  return f;
};
const puntuables = (r) => reais(r).length;

/** Copia mutada dun gabarito conxelado, fóra da árbore. Se a mutación non cambia un
 *  byte, o control é vacuo e isto lanza. */
function verdadeMutada(nome, fix, mutar) {
  const orix = path.join(DIR_C, `${fix}-truth-v2.json`);
  const t = JSON.parse(fs.readFileSync(orix, "utf8"));
  mutar(t);
  garantir(CONTROIS);
  const dir = path.join(CONTROIS, nome);
  garantir(dir);
  const p = path.join(dir, `${fix}-truth-v2.json`);
  fs.writeFileSync(p, JSON.stringify(t) + "\n");
  expect(sha256Arquivo(p), `mutación ${nome} non cambiou nada: control vacuo`)
    .not.toBe(sha256Arquivo(orix));
  return dir;
}

function medirMutando(nome, fix, mutar, extra = {}) {
  const r = adaptarC2({ chave: "C_novo", dirVerdade: verdadeMutada(nome, fix, mutar), ...extra });
  expect(r.ausente, "ferramenta de C ausente: o control non se puido executar").toBe(false);
  return r;
}

const medido = () => {
  const r = adaptarC2({ chave: "C_novo" });
  expect(r.ausente, "ferramenta de C ausente").toBe(false);
  return r;
};

describe("ditame — R11 ten tres orixes e cada unha di de onde vén", () => {
  const porBytes = cargarOraculo();

  it("usa o gabarito cando ten fila para eses bytes concretos", () => {
    const d = ditame(porBytes, "227C00001111");
    expect(d).toMatchObject({ estado: "valida-polo-instrumento", orixe: "gabarito", id: "bruto-227c-moveal", tam: 6 });
  });

  it("recorre ao sondeo pinned cando o gabarito non cubriu a palabra, e o publica", () => {
    const sondeo = { desmontaxe: "110:\t1149\t.short 0x1149" };
    const d = ditame(porBytes, "1149", sondeo);
    expect(d).toMatchObject({ estado: "recusa-do-desmontador", orixe: "sondeo-pinado" });
    expect(d.desmontaxe).toContain(".short");
  });

  it("unha palabra sen ditame publícase como límite visible, non como silencio", () => {
    expect(ditame(porBytes, "FFFF", null)).toMatchObject({ estado: "sen-fila-no-oraculo", orixe: "ningunha" });
  });

  it("a recusa do montador non é a recusa do desmontador", () => {
    // En `isa-oraculo-v2` as catro filas recusadas por GAS non teñen `bytes_hex`, así
    // que `cargarOraculo` nin as indexa: a rama exércese cun índice sintético construído
    // a partir dunha fila real do gabarito, e compróbase por separado que o índice
    // publicado non contén ningunha. Sen isto a rama sería decorativa.
    expect([...porBytes.values()].some((f) => f.rc_montador !== 0)).toBe(false);
    const g = JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8"));
    const rec = { ...g.filas.find((f) => f.rc_montador !== 0), bytes_hex: "aabbcc" };
    expect(rec.id).toBeTruthy();
    const mapa = new Map([["aabbcc", rec]]);
    expect(ditame(mapa, "AABBCC")).toMatchObject({ estado: "recusado-polo-montador", orixe: "gabarito", id: rec.id });
  });
});

describe("portaR11 — xulga o dominio onde D afirma invibilidade, e só ese", () => {
  const valida = { estado: "valida-polo-instrumento" };
  const recusa = { estado: "recusa-do-desmontador" };
  const esperaFronteira = { espera_decodificacion: false, esperado: { fronteira: true } };

  it("na porta, o instrumento é vara: expectativa de fronteira + ISA válido ⇒ contradice", () => {
    expect(portaR11({ dominio: PORTA_R11, ...esperaFronteira }, valida)).toEqual({ naPorta: true, contradice: true });
  });

  it("fóra da porta, un ISA válido non toca a fila: o subconxunto fechado é auditable", () => {
    for (const dominio of ["fora-do-subconjunto-de-C", "coherencia-contrato-codigo", "alegado-por-C"]) {
      expect(portaR11({ dominio, ...esperaFronteira }, valida), dominio).toEqual({ naPorta: false, contradice: false });
    }
  });

  it("dentro da porta, a recusa do instrumento corrobora en vez de retirar", () => {
    expect(portaR11({ dominio: PORTA_R11, ...esperaFronteira }, recusa)).toEqual({ naPorta: true, contradice: false });
  });

  it("unha fila que non espera fronteira non pode ser invalidada por un ISA válido", () => {
    expect(portaR11({ dominio: PORTA_R11, espera_decodificacion: true, esperado: {} }, valida).contradice).toBe(false);
  });
});

describe("cargarOraculo — que detecta realmente o pin do gabarito", () => {
  it("lanza ante calquera byte alterado nas filas", () => {
    garantir(CONTROIS);
    const g = JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8"));
    const p = path.join(CONTROIS, "oraculo-adulterado.json");
    g.filas[3].desmontaxe += " ";
    fs.writeFileSync(p, JSON.stringify(g) + "\n");
    expect(() => cargarOraculo(p)).toThrow(/alterado/);
  });

  it("lanza ante unha versión allea", () => {
    garantir(CONTROIS);
    const g = JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8"));
    g.version = "isa-oraculo-v3";
    const p = path.join(CONTROIS, "oraculo-version.json");
    fs.writeFileSync(p, JSON.stringify(g) + "\n");
    expect(() => cargarOraculo(p)).toThrow(/versión allea/);
  });

  it("LÍMITE publicado: recalcular `filas_sha256` burla a garda, soia", () => {
    garantir(CONTROIS);
    const g = JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8"));
    g.filas[3].desmontaxe += " ";
    g.filas_sha256 = sha256(Buffer.from(JSON.stringify(g.filas), "utf8"));
    const p = path.join(CONTROIS, "oraculo-rehash.json");
    fs.writeFileSync(p, JSON.stringify(g) + "\n");
    expect(() => cargarOraculo(p)).not.toThrow();
    // Por iso a evidencia publica o dixesto do *arquivo*: `filas_sha256` detesta
    // corrupción accidental; o que impide a falsificación é que o dixesto do
    // arquivo estea commiteado no manifesto (comprobado máis abaixo).
    expect(sha256Arquivo(p)).not.toBe(sha256Arquivo(GABARITO_ISA));
  });
});

describe("§12.11 — o mapa de renumeración é comprobábel, non narrado", () => {
  it(`mapearLiña: umbral ${UMBRAL_RENUMERACION}, desprazo ${DESPRAZO}`, () => {
    expect(mapearLiña(72)).toBe(72);
    expect(mapearLiña(73)).toBe(152);
    expect(mapearLiña(79)).toBe(158);
    expect(mapearLiña(79, 0)).toBe(79);
  });

  it("derivarCitacao reescribe pares e liñas soltas, e non inventa números", () => {
    expect(derivarCitacao("§3 liñas 77-79: «x»")).toBe("§3 liñas 156-158: «x»");
    expect(derivarCitacao("§3 liña 12: «x»")).toBe("§3 liña 12: «x»");
    expect(derivarCitacao(null)).toBe(null);
  });

  it("verificarCitacao lanza cando o texto ancorea no vello e non no novo", () => {
    const vello = Array.from({ length: 100 }, (_, i) => `l${i + 1}`);
    vello[79] = "«texto citado»";
    const novo = Array.from({ length: 200 }, (_, i) => `n${i + 1}`);
    novo[158] = "«texto citado»"; // liña 159 = 80 + 79
    const cita = "liñas 80: «texto citado»";
    expect(verificarCitacao(cita, vello, novo, 79)).toMatchObject({ estado: "verificada", comprobados: 1 });
    expect(() => verificarCitacao(cita, vello, novo, 77)).toThrow(/§12.11 falso/);
    expect(() => verificarCitacao(cita, vello, novo, 83)).toThrow(/§12.11 falso/);
  });

  it("LÍMITE da ancoraxe: a xanela ten ±1 liña de folga, un desprazo errado de 1 non se ve", () => {
    const vello = Array.from({ length: 100 }, (_, i) => `l${i + 1}`);
    vello[79] = "«texto citado»";
    const novo = Array.from({ length: 200 }, (_, i) => `n${i + 1}`);
    novo[158] = "«texto citado»";
    const cita = "liñas 80: «texto citado»";
    expect(verificarCitacao(cita, vello, novo, 78).estado).toBe("verificada");
    expect(verificarCitacao(cita, vello, novo, 80).estado).toBe("verificada");
  });

  it("sen entrecomillado ancoreable non hai veredito de ancoraxe: `sen-texto-citabel`", () => {
    expect(verificarCitacao("§3 liñas 97-98 (regra de peche)", [], [])).toMatchObject({ estado: "sen-texto-citabel", pares: 0 });
  });
});

describe("R13 — a normalización de vocabulario é unha táboa pechada", () => {
  it("asaliases declaradas tradúcense", () => {
    expect(vocab("indirect-opaco")).toBe("indirect-opaque");
    expect(vocab("fora-da-rexión")).toBe("fora-da-regiao");
    expect(vocab("fora-da-rexion")).toBe("fora-da-regiao");
  });

  it("un termo alleo pasa sen tocar: a táboa non é unha reescritura xeral", () => {
    for (const v of ["opcode-fora-do-subconjunto", "dentro-regiao-nao-alcancado", "miolo-de-instrucao"]) {
      expect(vocab(v), v).toBe(v);
    }
    expect(vocab(null)).toBe(null);
    expect(Object.keys(TABELA_VOCABULARIO)).toHaveLength(3);
  });
});

describe("§12.11 c) — precedencia comprobada", () => {
  it("o HEAD de D contén §12.11 (sen iso non se publica evidencia)", () => {
    expect(verificarPrecedencia()).toMatchObject({ secao: "§12.11", contido_no_commit: true });
  });

  it("no commit previo de D a porta nega: a medición sería inválida por construción", () => {
    expect(() => verificarPrecedencia("e68a4c6")).toThrow(/incumprida/);
  });
});

describe.skipIf(!HAI_FERRAMENTA)("escore v2 sobre a ferramenta real — cada invariante ten que poder fallar", () => {
  it("reproduce a evidencia commiteada, fila e dixesto", () => {
    const r = medido();
    const jsonl = path.join(MEDIDAS, "C-8ea5821-v2.jsonl");
    expect(r.linhas.length).toBe(64);
    expect(sha256(Buffer.from(fs.readFileSync(jsonl, "utf8"), "utf8")))
      .toBe(sha256(Buffer.from(r.linhas.map((l) => JSON.stringify(l)).join("\n") + "\n", "utf8")));
    expect(r.manifesto.procedencia).toMatchObject({ arquivos: 65, ok: true });
    expect(r.manifesto.precedencia.contido_no_commit).toBe(true);
  });

  it("denominador conxelado 42 e 42 puntuables, con 40 PASS / 2 FAIL / 1 VOID", () => {
    const r = medido();
    expect(r.manifesto.denominador_observado).toMatchObject({ conxelado: 42, puntuables: 42 });
    expect(puntuables(r)).toBe(42);
    const por = r.linhas.reduce((a, l) => ({ ...a, [l.veredito]: (a[l.veredito] ?? 0) + 1 }), {});
    expect(por).toMatchObject({ PASS: 40, FAIL: 2, VOID: 1, CONTROLADO: 19, INCOHERENTE: 1, INCONCLUSIVE: 1 });
    expect(r.manifesto.porta_R11).toMatchObject({ filas_na_porta: 2, contradicitas: 0, conformes: 2 });
  });

  it("o gabarito que se usou está contentado na evidencia commiteada", () => {
    const r = medido();
    const man = JSON.parse(fs.readFileSync(path.join(MEDIDAS, "C-8ea5821-v2-manifest.json"), "utf8"));
    expect(man.gabarito_isa.sha256_arquivo).toBe(sha256Arquivo(GABARITO_ISA));
    expect(r.manifesto.gabarito_isa.sha256_arquivo).toBe(man.gabarito_isa.sha256_arquivo);
    expect(man.gabarito_isa.filas_no_arquivo).toBe(55);
  });

  it("R11 á inversa: unha fila de `coherencia-contrato-código` movida a `fronteira-acordada` retírase contra D", () => {
    const antes = fila(medido(), "KC1v-movea-l-imm-a1");
    expect(antes).toMatchObject({ veredito: "FAIL", categoria: "falha", pontua: true });
    const r = medirMutando("r11-invertida", "dC-cx1", (t) => {
      t.kc1.find((k) => k.id === "KC1v-movea-l-imm-a1").dominio = PORTA_R11;
    });
    expect(fila(r, "KC1v-movea-l-imm-a1")).toMatchObject({ veredito: "VOID", frente: "D", pontua: false });
    expect(puntuables(r)).toBe(41);
    expect(r.manifesto.porta_R11).toMatchObject({ filas_na_porta: 3, contradicitas: 1 });
  });

  it("R11 non toca `fora-do-subconjunto-de-C`: movela á porta sería auditar §3 co ISA", () => {
    const antes = fila(medido(), "KC1v-move-l-d16pc-d0");
    expect(antes).toMatchObject({ veredito: "PASS", categoria: "nao-suportado", pontua: true });
    const r = medirMutando("r11-lista-fechada", "dC-cx1", (t) => {
      t.kc1.find((k) => k.id === "KC1v-move-l-d16pc-d0").dominio = PORTA_R11;
    });
    // O instrumento decodifica `203A0020`: co dominio trocado, a porta retira a fila.
    // Que iso só aconteza ao trocarlle o dominio proba que a porta é dominial, non xeral.
    expect(fila(r, "KC1v-move-l-d16pc-d0")).toMatchObject({ veredito: "VOID", pontua: false });
    expect(puntuables(r)).toBe(41);
  });

  it("un `tam` esperado a man cambia o veredito: a vara é o instrumento", () => {
    const r = medirMutando("tam", "dC-cx1", (t) => {
      t.kc1.find((k) => k.id === "KC1v-move-b-a0p-d1").esperado.tam = 4;
    });
    const f = fila(r, "KC1v-move-b-a0p-d1");
    expect(f.veredito).toBe("FAIL");
    expect(f.divergencias.map((d) => d.campo)).toContain("tam");
  });

  it("un stem inexistente cambia o veredito: `mnem` compróbase, non se decora", () => {
    const r = medirMutando("mnem", "dC-cx1", (t) => {
      t.kc1.find((k) => k.id === "KC1v-move-b-a0p-d1").esperado.stems = ["nop"];
    });
    const f = fila(r, "KC1v-move-b-a0p-d1");
    expect(f.veredito).toBe("FAIL");
    expect(f.divergencias.map((d) => d.campo)).toContain("mnem");
  });

  it("o tipo de fronteira esperado compróbase: trocalo nunha fila que pasa ten que fallar", () => {
    const antes = fila(medido(), "KC3v-linha-f");
    expect(antes.veredito).toBe("PASS");
    const r = medirMutando("tipo-fronteira", "dC-cx3", (t) => {
      t.kc3.find((k) => k.id === "KC3v-linha-f").esperado.tipo = "limite-de-regiao";
    });
    const f = fila(r, "KC3v-linha-f");
    expect(f.veredito).toBe("FAIL");
    expect(f.divergencias).toContainEqual(
      expect.objectContaining({ campo: "tipo", esperado: "limite-de-regiao", medido: "opcode-fora-do-subconjunto" }),
    );
  });

  it("a coherencia de cobertura compara contra o gabarito: `primaria` trocada infríncea", () => {
    const antes = fila(medido(), "CONTROLE-COHERENCIA-CX2");
    expect(antes.veredito).toBe("CONTROLADO");
    expect(antes.esperados.primaria).toBe(20);
    const r = medirMutando("cobertura", "dC-cx2", (t) => {
      t.cobertura_esperada_bytes = 19;
    });
    const f = fila(r, "CONTROLE-COHERENCIA-CX2");
    expect(f.veredito).toBe("INCOHERENTE");
    expect(f.divergencias[0]).toMatchObject({ campo: "bytes-decodificados", medido: 20 });
  });

  it("a descomposición de cobertura está na evidencia, non na narrativa", () => {
    const r = medido();
    const cx3 = fila(r, "CONTROLE-COHERENCIA-CX3");
    expect(cx3.medidos.instruions_decodificadas).toEqual([
      { endereco: 16, tam: 4, mnem: "moveb %a1, %a0@(0x4e75)" },
      { endereco: 48, tam: 2, mnem: "rts" },
    ]);
    expect(cx3.medidos.fronteiras_enderezos).toEqual([0, 20]);
    expect(cx3.medidos.bytes_alleos_as_instruccion).toBe(0);
    const cx4 = fila(r, "CONTROLE-COHERENCIA-CX4");
    expect(cx4.medidos.fronteiras_enderezos).toEqual([8200, 8228, 8232]);
    expect(cx4.medidos.instruions_decodificadas.filter((i) => [8228, 8232].includes(i.endereco)))
      .toEqual([{ endereco: 8228, tam: 2, mnem: "jmp <indireto>" }, { endereco: 8232, tam: 2, mnem: "trap #4" }]);
  });

  it("un desprazo falso de §12.11 ten que lanzar: sen iso o mapa non é comprobábel", () => {
    expect(() => adaptarC2({ chave: "C_novo", desprazo: 0 })).toThrow(/§12.11 falso/);
  });

  it("un conxunto sen gabarito conxelado nega en vez de adiviñar", () => {
    expect(() => adaptarC2({ chave: "C_novo", conjunto: "inventado" })).toThrow(/sen gabarito conxelado/);
  });

  it("holdout: unha resposta reservada alterada nega contra o SHA pinado (R17)", () => {
    const orixe = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
    if (!fs.existsSync(path.join(orixe, "dC-ho1-respostas.json"))) return; // scratch perdido: non hai control
    const tmp = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-ho-tamper-"));
    try {
      for (const f of fs.readdirSync(orixe).filter((x) => /^dC-ho\d-respostas\.json$/.test(x))) fs.copyFileSync(path.join(orixe, f), path.join(tmp, f));
      const alvo = path.join(tmp, "dC-ho1-respostas.json");
      fs.writeFileSync(alvo, fs.readFileSync(alvo, "utf8").replace('"tam": 2', '"tam": 4'));
      expect(() => adaptarC2({ chave: "C_novo", conjunto: "holdout", respostasDir: tmp })).toThrow(/SHA pinado/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("as etiquetas de cita publican o ditame, incluídos os límites", () => {
    const r = medido();
    expect(r.manifesto.renumeracion_citacoes).toMatchObject({
      umbral: 73, desprazo: 79, verificadas: 33, resumidas: 6, sen_texto_citabel: 4, pares: 40, comprobados: 34,
    });
    const estados = r.linhas.reduce((a, l) => {
      const e = (l.extras ?? {}).citacao_estado;
      if (e) a[e] = (a[e] ?? 0) + 1;
      return a;
    }, {});
    expect(estados).toMatchObject({ verificada: 33, resumida: 6, "sen-texto-citabel": 4 });
  });
});
