/**
 * Testes discriminantes da rolda de avaliación (frente D). Non precisan as
 * ferramentas externas: auditan os artefactos versionados (evidencia `.jsonl`,
 * manifestos, matriz, pins de holdout) contra recomposicións independentes.
 *
 * Cada aserción existe para impedir un modo concreto de virar verde
 * dishonestamente: evidencia editada despois do run, denominador afiado a
 * resultado, falha excluída de capacidade alegada (R0), control que se auto-
 * valida, resposta reservada filtrada na árbore, ou matriz que resume todo nun
 * percentual único.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  BYOR,
  CATEGORIAS,
  FIXTURES,
  MEDIDAS,
  PIN,
  RAIZ,
  linha,
  presente,
} from "./ferramentas.mjs";

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const ler = (nome) => {
  const p = path.join(MEDIDAS, nome);
  if (!fs.existsSync(p)) return null;
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((x) => x.trim())
    .map((x) => JSON.parse(x));
};
const DOC = fs.readFileSync(
  path.join(RAIZ, "docs/rex_profiles/parallel_recovery_20261004/d/EXTENSOES-D.md"),
  "utf8",
);

const EVIDENCIAS = [
  { nome: `A-${PIN.A.slice(0, 7)}.jsonl`, frente: "A", sha_frente: PIN.A },
  { nome: `A-${PIN.A_corrixido.slice(0, 7)}.jsonl`, frente: "A", sha_frente: PIN.A_corrixido },
  { nome: `B-${PIN.B_velho.slice(0, 7)}.jsonl`, frente: "B", sha_frente: PIN.B_velho },
  { nome: `B-${PIN.B_novo.slice(0, 7)}.jsonl`, frente: "B", sha_frente: PIN.B_novo },
  { nome: `C-${PIN.C.slice(0, 7)}.jsonl`, frente: "C", sha_frente: PIN.C },
];

describe("evidencia — audítase, non se acepta por existir", () => {
  it.each(EVIDencias())(
    "$nome: o corpo bate o SHA e a conta de filas do manifesto",
    ({ nome }) => {
      const linhas = ler(nome);
      expect(linhas, `evidencia ausente: medidas/${nome}`).not.toBeNull();
      const mp = path.join(MEDIDAS, nome.replace(/\.jsonl$/, "-manifest.json"));
      expect(fs.existsSync(mp), `manifesto ausente: ${nome}`).toBe(true);
      const m = JSON.parse(fs.readFileSync(mp, "utf8"));
      const corpo = Buffer.from(linhas.map((x) => JSON.stringify(x)).join("\n") + "\n");
      expect(sha(corpo)).toBe(m.sha256);
      expect(linhas.length).toBe(m.linhas);
    },
  );

  it("ningunha fila ten categoria fora do vocabulario pechado de §1", () => {
    for (const { nome } of EVIDENCIAS) {
      for (const l of ler(nome)) {
        expect(CATEGORIAS, `${nome}/${l.fila} categoria`).toContain(l.categoria);
      }
    }
  });

  it("o gate de `linha()` rexeita una categoria inventada (non só as de §1)", () => {
    expect(() => linha({ frente: "X", sha_frente: "x", fila: "f", capacidade: "c", categoria: "case-aplicavel", veredito: "PASS" })).toThrow(
      /fora do vocabulário/,
    );
  });
});

function EVIDencias() {
  return EVIDENCIAS;
}

describe("denominadores conxelados — nada se afia a resultado", () => {
  const doDen = (frente) => {
    const re = new RegExp(`\\*\\*Denominador ${frente} congelado: (\\d+) linhas\\*\\* \\(([^)]*)\\)`);
    const m = re.exec(DOC);
    if (!m) throw new Error(`denominador de ${frente} non encontrado en EXTENSOES-D`);
    const partes = Object.fromEntries(
      m[2].split(",").map((x) => {
        const [k, v] = x.trim().split("=");
        return [k, v.split("+").map(Number).reduce((a, b) => a + b, 0)];
      }),
    );
    return { total: Number(m[1]), partes };
  };

  it("EXTENSOES-D §3/§4/§5: a suma das partes dá o total declarado", () => {
    for (const f of ["A", "B", "C"]) {
      const d = doDen(f);
      expect(Object.values(d.partes).reduce((a, b) => a + b, 0), `suma das partes de ${f}`).toBe(d.total);
    }
    expect(doDen("A").total).toBe(29);
    expect(doDen("B").total).toBe(14);
    expect(doDen("C").total).toBe(42);
  });

  // §3 escribe «KA3=1+2»: o documento agrupar KA3 e KA3-g nunha entrada, mentres
  // que a ficha conxelada — e a evidencia — asinan dous grupos de filas.
  const GRUPOS = { A: { KA3: ["KA3", "KA3-g"] }, B: {}, C: {} };
  const FICHA = {
    A: path.join(FIXTURES, "a", "dA-truth-v1.json"),
    B: path.join(FIXTURES, "b", "dB-truth-v1.json"),
  };

  // Grupos reais de filas: os da ficha conxelada cando existe, senón os do
  // documento. Toda comparación documento↔ficha pasa por aquí, así que un
  // renomeamento de grupo na evidencia segue sendo detectable.
  const gruposDe = (frente) => {
    const d = doDen(frente).partes;
    if (!FICHA[frente]) return d;
    const t = JSON.parse(fs.readFileSync(FICHA[frente], "utf8")).denominador.partes;
    for (const [k, v] of Object.entries(d)) {
      const membros = GRUPOS[frente][k] ?? [k];
      expect(membros.reduce((a, m) => a + (t[m] ?? NaN), 0), `${frente}: § di ${k}=${v}`).toBe(v);
    }
    expect(Object.keys(t).sort(), `${frente}: grupos da ficha ≠ grupos do documento`).toEqual(
      Object.keys(d).flatMap((k) => GRUPOS[frente][k] ?? [k]).sort(),
    );
    return t;
  };

  it("as fichas conxeladas de A e B pinan o mesmo denominador que o documento", () => {
    for (const f of ["A", "B"]) {
      const t = JSON.parse(fs.readFileSync(FICHA[f], "utf8")).denominador;
      expect(t.total, `${f} total`).toBe(doDen(f).total);
      expect(Object.values(gruposDe(f)).reduce((a, b) => a + b, 0), `${f} suma de grupos`).toBe(doDen(f).total);
    }
  });

  it("cada capacidade ten executamente as filas que o denominador conxelado declara", () => {
    const esper = { A: gruposDe("A"), B: gruposDe("B"), C: gruposDe("C") };
    for (const { nome, frente } of EVIDENCIAS) {
      const pontuadas = ler(nome).filter((x) => x.pontua !== false);
      for (const [cap, n] of Object.entries(esper[frente])) {
        const feitas = pontuadas.filter((x) => x.capacidade === cap).length;
        expect(feitas, `${nome} · ${cap} filas graduadas`).toBe(n);
      }
      const total = pontuadas.length;
      expect(total, `${nome} total graduado`).toBe(Object.values(esper[frente]).reduce((a, b) => a + b, 0));
    }
  });

  it("a matriz publica fraccións por capacidade e non calcula percentual único", () => {
    const mat = JSON.parse(fs.readFileSync(path.join(MEDIDAS, "matriz.json"), "utf8"));
    expect(mat.regra).toMatch(/sen percentual único/);
    for (const m of mat.frentes) {
      const linhas = ler(m.evidencia);
      for (const c of m.capacidades) {
        const filas = linhas.filter((x) => x.pontua !== false && x.capacidade === c.capacidade);
        expect(c.graduadas, `${m.frente}/${m.sha_frente.slice(0, 7)} ${c.capacidade} graduadas`).toBe(filas.length);
        expect(c.pass, `${c.capacidade} pass`).toBe(filas.filter((x) => x.veredito === "PASS").length);
        expect(c.fraccion).toBe(`${c.pass}/${c.denominador}`);
        expect(c.cobertura).toBe("coherente");
      }
      expect(m.capacidades.reduce((a, c) => a + c.denominador, 0), "suma de denominadores ≠ percentual único").toBeGreaterThan(0);
    }
  });
});

describe("R0 — as falhas coñecidas seguen dentro da capacidade alegada", () => {
  const FALHAS_PINADAS = {
    [`A-${PIN.A.slice(0, 7)}.jsonl`]: ["TA-5"],
    [`C-${PIN.C.slice(0, 7)}.jsonl`]: ["KC1-movea.l #imm32,A1", "KC3-move-w-imm-an", "KC4-jmp-ind-an"],
  };
  it.each(Object.entries(FALHAS_PINADAS))("%s conserva as filas FAIL coñecidas", (nome, filas) => {
    const linhas = ler(nome);
    for (const f of filas) {
      const l = linhas.find((x) => x.fila === f);
      expect(l, `${nome}/${f} desapareceu da evidencia`).toBeTruthy();
      expect(l.veredito, `${nome}/${f} deixou de ser FAIL`).toBe("FAIL");
      expect(l.pontua, `${nome}/${f} deixou de pontuar`).not.toBe(false);
      // §1: «falha» é categoría lexítima para un fallo dentro da capacidade
      // alegada; o que R0 proíbe é escorregala para non-aplicável/descoñecido.
      expect(["aplicavel", "falha"], `${nome}/${f} foi reclassificada`).toContain(l.categoria);
      expect(["nao-aplicavel", "desconhecido", "nao-suportado"], `${nome}/${f}`).not.toContain(l.categoria);
      expect(l.divergencias.length).toBeGreaterThan(0);
    }
  });

  // Pin *post-observación* (non expectativa conxelada): o SHA que A publicou
  // despois da medición (corrección v1.1) falla estas 7 filas coas mesmas
  // expectativas de §3. Se alguén limpar a evidencia, isto canta.
  const REGRESION_A_NOVA = [
    "KA1-2", "KA1-bsr.l", "KA1-jsr.w", "KA1-jmp.l", "KA1-jmp.w", "KA4-2", "TA-3",
  ];
  it("o SHA corrixido de A conserva as 7 filas en fallo e a falla herdada de TA-5", () => {
    const nome = `A-${PIN.A_corrixido.slice(0, 7)}.jsonl`;
    const vellas = new Set(ler(`A-${PIN.A.slice(0, 7)}.jsonl`).filter((x) => x.veredito === "FAIL").map((x) => x.fila));
    for (const f of REGRESION_A_NOVA) {
      const l = ler(nome).find((x) => x.fila === f);
      expect(l, `${nome}/${f} ausente`).toBeTruthy();
      expect(l.veredito, `${nome}/${f}`).toBe("FAIL");
      expect(l.divergencias.length, `${nome}/${f} sen desvío`).toBeGreaterThan(0);
      expect(vellas.has(f), `${nome}/${f} estaba en PASS no SHA anterior — é regresión, non falla coñecida`).toBe(false);
    }
    const ta5 = ler(nome).find((x) => x.fila === "TA-5");
    expect(ta5.veredito, "TA-5 deixou de fallar no SHA corrixido").toBe("FAIL");
    expect(ler(nome).filter((x) => x.pontua !== false && x.veredito === "FAIL").length).toBe(REGRESION_A_NOVA.length + 1);
  });

  it("ningunha fila pontuada pode estar en categoria non aplicável ou desconhecida con PASS", () => {
    for (const { nome } of EVIDENCIAS) {
      for (const l of ler(nome)) {
        if (l.pontua === false) continue;
        if (["nao-aplicavel", "desconhecido"].includes(l.categoria)) {
          expect(l.veredito, `${nome}/${l.fila}: ${l.categoria} non pode dar ${l.veredito}`).not.toBe("PASS");
        }
      }
    }
  });
});

describe("R8 — adulteración probada por reexecución", () => {
  let vistas = 0;
  let graduadas = 0;
  it("toda fila TA/TC/NB que pontúa executouse de verdade: rc numérico e expectativa conxelada", () => {
    for (const { nome } of EVIDENCIAS) {
      for (const l of ler(nome)) {
        if (!["TA", "TC", "NB"].includes(l.capacidade) || l.pontua === false) continue;
        vistas += 1;
        expect(typeof l.rc, `${nome}/${l.fila} rc — fila sin execución real`).toBe("number");
        const e = l.rc_esperado;
        if (typeof e === "number") {
          expect(l.veredito, `${nome}/${l.fila} rc exacto`).toBe(l.rc === e ? "PASS" : "FAIL");
        } else {
          // Negativo estrutural: o que se conxelou foi un predicado (recusa,
          // rótulo, invariante), non un rc. A expectativa ten de estar na fila
          // e o veredicto ten de vir das diverxencias recomputadas por D.
          expect(e === null || typeof e === "string", `${nome}/${l.fila} rc_esperado`).toBeTruthy();
          expect(Object.keys(l.esperados ?? {}).length, `${nome}/${l.fila} sen expectativa conxelada`).toBeGreaterThan(0);
          if (typeof e === "string") {
            expect(l.rc, `${nome}/${l.fila} «${e}»`).not.toBe(0);
          }
        }
      }
    }
  });

  it("ningunha fila graduada pasa en FAIL sen diverxencia rexistrada, nin en PASS con ela", () => {
    for (const { nome } of EVIDENCIAS) {
      for (const l of ler(nome)) {
        if (l.pontua === false) continue;
        graduadas += 1;
        const d = (l.divergencias ?? []).length;
        if (l.veredito === "PASS") expect(d, `${nome}/${l.fila} PASS con diverxencias`).toBe(0);
        if (l.veredito === "FAIL") expect(d, `${nome}/${l.fila} FAIL sen diverxencias`).toBeGreaterThan(0);
        expect(Object.keys(l.esperados ?? {}).length, `${nome}/${l.fila} sen expectativa conxelada`).toBeGreaterThan(0);
      }
    }
  });

  // Guardas de alcance: sen filas examinadas os bucles de arriba serían
  // satisfactos por vacuidade (29+29+14+14+42 = 128 graduadas; TA 8×2, NB 2×2, TC 4).
  it("os dous bucles anteriores examinaron realmente as filas graduadas", () => {
    expect(vistas).toBe(24);
    expect(graduadas).toBe(128);
  });
});

describe("proba anexada audítase recompoñendo, non por existir", () => {
  it("C: o `objeto.sha256` esperado é o digest real do binario que se lleu", () => {
    const linhas = ler(`C-${PIN.C.slice(0, 7)}.jsonl`).filter((x) => x.capacidade === "audit" && /^CONTROLE-IDENTIDADE-/.test(x.fila));
    expect(linhas.length).toBe(4);
    for (const l of linhas) {
      const bin = /--bin (\S+)/.exec(l.comando);
      expect(bin, `${l.fila} comando sen --bin`).toBeTruthy();
      const p = path.resolve(RAIZ, bin[1]);
      expect(sha(fs.readFileSync(p))).toBe(l.esperados.objeto_sha256);
      expect(l.medidos.objeto_sha256, `${l.fila} o export de C declara outro digest`).toBe(l.esperados.objeto_sha256);
      expect(l.veredito).toBe("CONTROLADO");
    }
  });

  it("B: o control de identidade usa o pin conxelado de BYOR, non un hash por existir", () => {
    const l = ler(`B-${PIN.B_novo.slice(0, 7)}.jsonl`).find((x) => x.fila === "CONTROLE-IDENTIDADE-B");
    expect(l, "control de identidade de B ausente").toBeTruthy();
    expect(l.esperados.rom_sha256).toBe(BYOR.rom_sha256);
    expect(l.esperados.decoder_sha256).toBe(BYOR.decoder_sha256);
    expect(l.medidos.rom_no_export).toBe(l.esperados.rom_sha256);
    expect(l.veredito).toBe("CONTROLADO");
    expect(l.pontua).toBe(false);
  });

  // Non aprobado en CI: a ROM BYOR non se versiona, así que esta perna só se
  // executa no host do operador. Rexístrase en RELATORIO-D como non executada.
  const romPresente = fs.existsSync(BYOR.rom);
  it.skipIf(!romPresente)("B: o digest da ROM recomponse desde o ficheiro lido", () => {
    const l = ler(`B-${PIN.B_novo.slice(0, 7)}.jsonl`).find((x) => x.fila === "CONTROLE-IDENTIDADE-B");
    expect(sha(fs.readFileSync(BYOR.rom))).toBe(l.esperados.rom_sha256);
    expect(sha(fs.readFileSync(BYOR.decoder))).toBe(l.esperados.decoder_sha256);
  });
});

describe("holdout — inputs públicos na árbore, respostas reservadas fóra", () => {
  const pin = JSON.parse(fs.readFileSync(path.join(FIXTURES, "holdout", "pin.json"), "utf8"));

  it("cada entrada pública bate o seu pin", () => {
    for (const e of pin.entradas) {
      const p = path.join(FIXTURES, "holdout", path.basename(e.arquivo));
      expect(fs.existsSync(p), `ausente: ${e.arquivo}`).toBe(true);
      expect(sha(fs.readFileSync(p)), e.arquivo).toBe(e.sha256);
    }
  });

  it("as entradas void levan motivo e non pontúan; a súa fila rexístrase contra D", () => {
    const voids = pin.entradas.filter((e) => e.estado === "void");
    expect(voids.length).toBeGreaterThanOrEqual(2);
    for (const v of voids) {
      expect(v.pontua).toBe(false);
      expect(v.motivo.length).toBeGreaterThan(20);
      const l = ler("holdouts-v3.jsonl").find((x) => x.fila === `${v.id}-VOID`);
      expect(l, `fila ${v.id}-VOID ausente da evidencia`).toBeTruthy();
      expect(l.frente).toBe("D");
      expect(l.veredito).toBe("VOID");
    }
  });

  it("ningunha resposta reservada está dentro da árbore", () => {
    const nome = JSON.parse(fs.readFileSync(path.join(FIXTURES, "holdout", "pin.json"), "utf8")).entradas
      .find((e) => e.id === "H-A").respostas;
    expect(nome).toMatch(/respostas/);
    const dentro = fs.readdirSync(path.join(FIXTURES, "holdout"));
    expect(dentro.filter((f) => f.includes("respostas"))).toEqual([]);
  });

  it("o run válido do holdout conserva a falla coñecida de A e nada reclasifica", () => {
    const linhas = ler("holdouts-v3.jsonl");
    expect(linhas, "holdouts-v3.jsonl ausente").not.toBeNull();
    const ta5 = linhas.find((x) => x.fila === "H-A/TA-5");
    expect(ta5.veredito).toBe("FAIL");
    expect(ta5.categoria).toBe("aplicavel");
    for (const f of ["H-B/roundtrip", "H-C/0x000000"]) expect(linhas.find((x) => x.fila === f).veredito).toBe("PASS");
    // `linha()` aniña os campos propios nun `extras`; a marca vive alí.
    for (const l of linhas) expect(l.extras?.fora_do_denominador ?? l.fora_do_denominador, `${l.fila} marca de denominador`).toBe(true);
  });
});

describe("autoría de D — as entradas medibles son válidas antes de medir", () => {
  it("o rexistro de zonas aborta cando dous fluxos se solapan (defecto H-A v1)", async () => {
    const { buildAImage, padraoD } = await import("../frentes/author_frentes.mjs");
    expect(() =>
      buildAImage({
        seed: "probe-superposicion",
        base: 0x1200,
        rotina1: 0xa000,
        rotina2: 0x2400,
        fluxo1: 0x9000,
        fluxo2: 0x9400,
        destinos: [[0x11234, "rom", "rom"]],
        dadosFn: padraoD,
      }),
    ).toThrow(/sobreposición de zonas/);
  });

  it("a xanela asinada de d16(PC) validase na autoría (defecto H-A v2)", async () => {
    const { buildAImage, padraoD } = await import("../frentes/author_frentes.mjs");
    expect(() =>
      buildAImage({
        seed: "probe-xanela",
        base: 0x400,
        rotina1: 0xa000,
        rotina2: 0x2400,
        fluxo1: 0x9000,
        fluxo2: null,
        destinos: [[0x11234, "rom", "rom"]],
        dadosFn: padraoD,
      }),
    ).toThrow(/d16\(PC\)/);
  });

  it("o padrón autoral non é dexenerado (makeRng devolve sempre 0)", async () => {
    const { padraoD } = await import("../frentes/author_frentes.mjs");
    const b = padraoD(4096, "probe|padrao");
    expect(new Set(b).size).toBe(256);
    expect(Buffer.from(b).filter((x) => x !== 0).length).toBeGreaterThan(3000);
  });

  it("re-xerar A en memoria dá os bytes que a evidencia de `cbb6895` pinou", async () => {
    const { buildAImage, DESTINOS } = await import("../frentes/author_frentes.mjs");
    const m = JSON.parse(
      fs.readFileSync(path.join(MEDIDAS, `A-${PIN.A.slice(0, 7)}-manifest.json`), "utf8"),
    );
    const a = buildAImage({ seed: "d-frentes-a-v1", destinos: DESTINOS });
    expect(sha(a.img), "a autoría de A deixou de ser determinista").toBe(m.imagem.sha256);
    // e a imaxe que está na árbore é esa mesma
    expect(sha(fs.readFileSync(path.resolve(RAIZ, m.imagem.arquivo)))).toBe(m.imagem.sha256);
    expect(sha(Buffer.from(fs.readFileSync(path.resolve(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/a/dA-truth-v1.json"))))).toBe(m.truth_sha256);
  });
});

const BINARIOS = Object.fromEntries(["A", "B", "C"].map((id) => [id, presente(id)]));
describe.skipIf(!Object.values(BINARIOS).every(Boolean))("reprodución coa ferramenta real", () => {
  it("reexecutar o adaptador de A devolve os mesmos veredictos", async () => {
    const { adaptarA } = await import("./adapt_a.mjs");
    const r = adaptarA({ conjunto: "medicao" });
    const committed = ler(`A-${PIN.A.slice(0, 7)}.jsonl`);
    expect(r.linhas.map((x) => `${x.fila}:${x.veredito}`).sort()).toEqual(
      committed.map((x) => `${x.fila}:${x.veredito}`).sort(),
    );
  });
});

describe("ferramenta ausente — nunca se pontúa con cero favorável", () => {
  it("se a ferramenta de A faltara, as filas serian desconhecido con motivo", async () => {
    const { adaptarA } = await import("./adapt_a.mjs");
    if (presente("A")) return; // non aprobado: reprodución coa ferramenta real cobre o outro caso
    const r = adaptarA({ conjunto: "medicao" });
    expect(r.ausente).toBe(true);
    for (const l of r.linhas) {
      expect(l.categoria).toBe("desconhecido");
      expect(l.motivo.length).toBeGreaterThan(0);
    }
  });
});
