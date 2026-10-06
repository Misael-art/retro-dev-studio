#!/usr/bin/env node
/**
 * Autor do gabarito **v3 da fronte C** (barra D, §12.17): `rex-cfg` en `5f97368`.
 *
 * Tres pezas, todas conxeladas antes de executar C neste SHA:
 *  1. **Retificación dun gabarito de D**: `KC1v-movea-l-imm-a1` esperaba fronteira
 *     porque a prosa de §3 dicía «`#imm` só em MOVE». O contrato de C retificou
 *     (R-3, `CONTRACT.md` ponteiro datado: MOVEA `.W`/`.L` válidos) e o instrumento
 *     decodifica `227C00001111` como `moveal #4369,%a1`. A expectativa vella queda
 *     como control histórico; unha implementación correcta non ten que reproducila.
 *  2. **Fixtures novas `cx5`/`ho5`** coas capacidades que `8ea5821` non tiña: `TRAP #n`
 *     (fronteira `trap-opaco`), `MOVEA` `.W`/`.L` e `(xxx).W` con extensión de sinal
 *     (PRM §2.2.16), con `analyze` e `consultar` (`rex-cfg-sitio/v2`).
 *  3. A medición pública reutiliza as fixtures v2 (sen tocalas) e a v3 engade `cx5`.
 *
 * Ningún byte 68000 se escribe a man (R14): GAS codifica, objdump le e dá o enderezo
 * efectivo. Respostas do holdout fóra da árbore (R17).
 */
import fs from "node:fs";
import path from "node:path";
import { montarSondas, instrumento, sha256, RAIZ } from "./montador.mjs";

export const DIR_C = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/c");
export const DIR_V3 = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/c-v3");
export const DIR_HO = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/c-holdout");
export const RESP_DIR = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v3-C";

const INSTANCIAS = {
  medicao: {
    nome: "dC-cx5-v3.bin", origin: 0x1000, tam: 0x80, sentinela: 0x1040,
    traps: [0, 4, 8], moveas: ["movea.w #0x1234,%a2", "movea.l #0x00001000,%a4", "movea.w %d3,%a5", "movea.l (%a1),%a3"],
    abs: [["jsr", 0x8000], ["jmp", 0x7ffe], ["jmp", "sentinela"]],
  },
  holdout: {
    nome: "dC-ho5-v3.bin", origin: 0x2000, tam: 0x80, sentinela: 0x2040,
    traps: [1, 9, 15], moveas: ["movea.w #0x00ff,%a0", "movea.l #0x7fff0000,%a6", "movea.w (%a2),%a1", "movea.l %a5,%a3"],
    abs: [["jsr", 0xc000], ["jmp", 0x7ff0], ["jsr", "sentinela"]],
  },
};

const hex = (n, w = 6) => `0x${(n >>> 0).toString(16).toUpperCase().padStart(w, "0")}`;

export function construirCx5(instancia) {
  const I = INSTANCIAS[instancia];
  const inst = instrumento();
  const sondas = [];
  const sitioDe = new Map();
  I.traps.forEach((n) => sondas.push({ rotulo: `TR-${n}`, texto: `trap #${n}`, sep: 0 }));
  I.moveas.forEach((t, i) => sondas.push({ rotulo: `MV-${i}`, texto: t, sep: 0 }));
  I.abs.forEach(([op, alvo], i) => {
    const a = alvo === "sentinela" ? I.sentinela : alvo;
    sondas.push({ rotulo: `AW-${i}`, texto: `${op} (0x${a.toString(16)}).w`, sep: 0 });
  });
  sondas.push({ rotulo: "SENTINELA", texto: "rts", sep: 0, sitioFixo: I.sentinela });
  const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-c-v3-"));
  const m = montarSondas({ base: I.origin, dir, nome: `dC-cx5-${instancia}`, nops: 0, inst, sondas });
  fs.rmSync(dir, { recursive: true, force: true });
  const img = Buffer.alloc(I.tam, 0xff);
  for (const g of m.grupos) {
    if (g.direccion < I.origin) continue;
    Buffer.from(g.liñas.map((l) => l.bytes).join(""), "hex").copy(img, g.direccion - I.origin);
  }
  const una = (r) => {
    const l = r.desmontaxe.split("\n")[0].split("\t");
    return { bytes: l[1].replace(/\s+/g, "").toUpperCase(), tam: l[1].replace(/\s+/g, "").length / 2, mnem: r.mnemonico, desmontaxe: r.desmontaxe.split("\n")[0] };
  };
  const por = new Map(m.sondas.map((r) => [r.rotulo, r]));
  for (const r of m.sondas) sitioDe.set(r.rotulo, r.sitio);
  const raizes = m.sondas.filter((r) => r.rotulo !== "SENTINELA").map((r) => ({ endereco: r.sitio, proveniencia: "candidato", evidencia: `sonda-${r.rotulo}` }));
  raizes.push({ endereco: I.sentinela, proveniencia: "referencia-estatica", evidencia: "sentinela" });
  const filas = [];
  I.traps.forEach((n) => {
    const r = por.get(`TR-${n}`);
    filas.push({ id: `${instancia === "holdout" ? "HO" : "V3"}-TR-${n}`, cap: "KC4v", forma: `trap #${n}`, endereco: r.sitio, ...una(r), esperado: { tam: 2, stems: ["trap"], fronteira: "trap-opaco" } });
  });
  I.moveas.forEach((_, i) => {
    const r = por.get(`MV-${i}`);
    const u = una(r);
    filas.push({ id: `${instancia === "holdout" ? "HO" : "V3"}-MV-${i}`, cap: "KC1v", forma: _, endereco: r.sitio, ...u, esperado: { tam: u.tam, stems: ["movea"] } });
  });
  I.abs.forEach((_, i) => {
    const r = por.get(`AW-${i}`);
    const u = una(r);
    const ea = r.ea >>> 0;
    const dentro = ea >= I.origin && ea < I.origin + I.tam;
    const pre = instancia === "holdout" ? "HO" : "V3";
    filas.push({
      id: `${pre}-AW-${i}`, cap: "KC4v", forma: _.join(" "), endereco: r.sitio, ...u,
      esperado: { alvo: ea, aresta_tipo: _[0] === "jsr" ? "chamada" : "desvio", status: dentro ? "resolvido" : "fora-da-regiao" },
    });
    filas.push({
      id: `${pre}-CV-${i}`, cap: "CVv", forma: `consultar ${_.join(" ")}`, endereco: r.sitio, ...u,
      esperado: {
        alvo: ea, endereco_efetivo: ea, endereco_de_barramento: ea & 0xffffff,
        offset_de_objeto: dentro ? ea - I.origin : null,
        promovivel_vinculo_estrutural: "nao", consumidor_validado: "sim",
      },
    });
  });
  const truth = {
    esquema: "rex-parallel-d/truth-c-cx5/3", id: I.nome, instancia, gabarito: GABARITO, contrato: CONTRATO,
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_c_v3.mjs",
    origin: I.origin, regioes: [{ inicio: I.origin, fim: I.origin + I.tam }], raizes, sitios_consulta: filas.filter((f) => f.cap === "CVv").map((f) => f.endereco),
    imaxe: { bytes: img.length, sha256: sha256(img) }, filas,
    instrumento: { version: inst.version, sha256_as: inst.sha256_as, sha256_objdump: inst.sha256_objdump },
    fontes: ["PRM §2.2.16: o endereço absoluto curto é estendido por sinal; o instrumento imprime o efectivo (EA) e D toma o seu valor", "contrato de C `5f97368` §3: TRAP #n → fronteira `trap-opaco`; MOVEA .W/.L válidos (R-3)"],
    limites_de_autoria: ["a clave `trap-opaco` é o rótulo do contrato de C, non do instrumento", "os nomes de campos de `consultar` (rex-cfg-sitio/v2) son os publicados por C", "imaxe sintética; recheo 0xFF"],
    denominador: { partes: { KC4v: filas.filter((f) => f.cap === "KC4v").length, KC1v: filas.filter((f) => f.cap === "KC1v").length, CVv: filas.filter((f) => f.cap === "CVv").length } },
  };
  truth.denominador.total = Object.values(truth.denominador.partes).reduce((a, b) => a + b, 0);
  return { img, truth, I };
}

/** Gabarito público v3: copias das verdades v2 coa fila retificada. */
export function retificarV2() {
  const orixe = path.join(DIR_C, "dC-cx1-truth-v2.json");
  const t = JSON.parse(fs.readFileSync(orixe, "utf8"));
  const f = t.kc1.find((x) => x.id === "KC1v-movea-l-imm-a1");
  const antes = JSON.parse(JSON.stringify({ ...f, citacao_C: undefined, sondeo: undefined }));
  f.espera_decodificacion = true;
  f.esperado = { tam: f.esperado_instrumento.tam, stems: ["movea"] };
  f.nota = "RETIFICADA en v3 (§12.17): o contrato de C (R-3) declara MOVEA .W/.L válidos e o instrumento decodifica estes bytes como `moveal #4369,%a1` (6 B). A expectativa v2 (fronteira) queda como control histórico en `retificacion` e non se exixe a unha implementación correcta.";
  f.retificacion = { expectativa_v2: antes.esperado, dominio_v2: antes.dominio, motivo: "R-3 de C (CONTRACT.md ponteiro datado) + instrumento" };
  return t;
}

export function gravarC3() {
  fs.mkdirSync(DIR_V3, { recursive: true });
  fs.mkdirSync(DIR_HO, { recursive: true });
  fs.mkdirSync(RESP_DIR, { recursive: true });
  const t1 = retificarV2();
  fs.writeFileSync(path.join(DIR_V3, "dC-cx1-truth-v2.json"), `${JSON.stringify(t1, null, 2)}\n`);
  for (const k of [2, 3, 4]) fs.copyFileSync(path.join(DIR_C, `dC-cx${k}-truth-v2.json`), path.join(DIR_V3, `dC-cx${k}-truth-v2.json`));
  const pub = construirCx5("medicao");
  fs.writeFileSync(path.join(DIR_V3, pub.I.nome), pub.img);
  fs.writeFileSync(path.join(DIR_V3, "dC-cx5-truth-v3.json"), `${JSON.stringify(pub.truth, null, 2)}\n`);
  const ho = construirCx5("holdout");
  fs.writeFileSync(path.join(DIR_HO, ho.I.nome), ho.img);
  const resp = path.join(RESP_DIR, "dC-ho5-respostas.json");
  fs.writeFileSync(resp, `${JSON.stringify(ho.truth, null, 2)}\n`);
  const sh = (p) => sha256(fs.readFileSync(p));
  const pinV3 = {
    esquema: "rex-parallel-d/pin-frentes/3", gabarito: GABARITO, contrato: CONTRATO, conxunto: "medicao",
    nota: "As imaxes cx1..cx4 son as de `c/` (pin-c-v2.json). Aquí só van as verdades (cx1 retificada) e a fixture nova cx5.",
    denominador: { retificadas: ["KC1v-movea-l-imm-a1"], cx5: pub.truth.denominador },
    arquivos: Object.fromEntries(["dC-cx1-truth-v2.json", "dC-cx2-truth-v2.json", "dC-cx3-truth-v2.json", "dC-cx4-truth-v2.json", pub.I.nome, "dC-cx5-truth-v3.json"].map((n) => [n, { sha256: sh(path.join(DIR_V3, n)) }])),
  };
  fs.writeFileSync(path.join(DIR_V3, "pin-c-v3.json"), `${JSON.stringify(pinV3, null, 2)}\n`);
  const pinHo = {
    esquema: "rex-parallel-d/holdout-pin/3", gabarito: GABARITO, contrato: CONTRATO, conxunto: "holdout", fronte: "C", sha_medido: "5f97368",
    politica: "imaxe pública versionada; respostas reservadas fóra da árbore e pinadas por SHA (R17). O holdout v2 (`8ea5821`) non se reutiliza.",
    respostas_fora_da_arvore: RESP_DIR, denominador: ho.truth.denominador,
    arquivos: { [ho.I.nome]: { sha256: sha256(ho.img), bytes: ho.img.length } },
    respostas: { "dC-ho5-respostas.json": { sha256: sh(resp) } },
  };
  fs.writeFileSync(path.join(DIR_HO, "pin-holdout-c-v3.json"), `${JSON.stringify(pinHo, null, 2)}\n`);
  return { pub, ho, pinV3, pinHo };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarC3();
  console.log(`[author C v3] cx5 ${r.pub.truth.imaxe.sha256.slice(0, 12)}… ${JSON.stringify(r.pub.truth.denominador)} · ho5 ${r.ho.truth.imaxe.sha256.slice(0, 12)}… ${JSON.stringify(r.ho.truth.denominador)}`);
  for (const f of r.pub.truth.filas) console.log(`  ${f.id.padEnd(10)} ${hex(f.endereco)} ${f.bytes.padEnd(12)} ${f.mnem}`);
}
