#!/usr/bin/env node
/**
 * Autor do gabarito **v2 da fronte B** (barra D, rolda 3, requisito 9).
 *
 * B publicou, despois da medición v1 (`396e0b8`), dúas capacidades que os testes
 * anteriores non cobren: a investigación CRAM (E18R–E22) e o decoder Enigma nativo
 * (E23–E30). Este autor conxela as expectativas de D **antes** de executar B en
 * `da5472c`, por capacidade:
 *
 *  - KB1v/KB2v: os bytes dos sitios do consumidor e do parámetro codifícaos
 *    `m68k-elf-as -m68000` (R14). A v1 levaba bytes escritos a man; aquí cada un
 *    compárase co que o instrumento codifica (e a coincidencia ou diverxencia con
 *    v1 queda rexistrada, non asumida).
 *  - KBC: o que a ROM di nos sitios que B alega para o CRAM, lido por D, e os
 *    opcodes codificados polo instrumento. Gradúase a **exportación de B** contra
 *    esta lectura de D, non contra a de B.
 *  - KBE: invariantes do decoder nativo que non dependen de ter un decoder:
 *    tamaño do slot polos ponteiros da táboa da ROM (lidos por D), recusa de
 *    streams cortados, sensibilidade a mutación e ausencia de panic. A equivalencia
 *    de saída contra un decoder independente **non existe**: queda `descoñecido`.
 *
 * Nivel por fila (vocabulario de §1): `referencia-estatica`, `vinculo-estrutural`,
 * `consumo-observado`, `equivalencia`. Ningunha fila de B chega a `consumo-observado`
 * nin a `equivalencia` nesta rolda.
 *
 * Uso: node …/frentes/author_b_v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { montarSondas, instrumento, sha256, RAIZ } from "./montador.mjs";
import { BYOR } from "../medida/ferramentas.mjs";
import { xerador } from "../lib_bench.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DIR_B = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/b");
export const NOME_TRUTH = "dB-truth-v2.json";
export const NOME_PIN = "pin-b-v2.json";
export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v2-B";
const HEX = (n, w = 0) => `0x${n.toString(16).padStart(w, "0")}`;

/** Sitios que B alega (contrato B / export de B). Os enderezos son alegacións; o
 *  que D conxela é o que o instrumento codifica e o que a ROM di neles. */
const SITIOS = [
  { id: "cram-callsite-moveq", end: 0x469a, texto: "moveq #10,%d0", cap: "KBC" },
  { id: "cram-callsite-bsr", end: 0x469c, texto: (s) => `bsr.w .+${0x20fc - s}`, alvo: 0x20fc, cap: "KBC" },
  { id: "cram-palcycle-tst", end: 0x4962, texto: "tst.w (0xf63a).w", cap: "KBC" },
  { id: "cram-blink-subq", end: 0x1b33a, texto: "subq.b #1,(0xfec0).w", cap: "KBC" },
  { id: "kb2-value-offset", end: 112334, texto: "move.w #0,%d0", cap: "KB2v" },
  { id: "kb1-chamada", end: 112338, texto: "jsr (0x171e).l", cap: "KB1v" },
  { id: "kb1-contador-d1", end: 112372, texto: "moveq #63,%d1", cap: "KB1v" },
  { id: "kb1-contador-d2", end: 112374, texto: "moveq #63,%d2", cap: "KB1v" },
  { id: "kb1-copia-byte", end: 112376, texto: "move.b (%a0)+,(%a1)+", cap: "KB1v" },
  { id: "kb1-salto-padding", end: 112382, texto: "lea 64(%a1),%a1", cap: "KB1v" },
].sort((a, b) => a.end - b.end);

const NIVEL = {
  KB1v: "vinculo-estrutural",
  KB2v: "vinculo-estrutural",
  KBC: "vinculo-estrutural",
  KBE: "referencia-estatica",
};

export function construirB2({ romPath = BYOR.rom } = {}) {
  const rom = fs.readFileSync(romPath);
  if (sha256(rom) !== BYOR.rom_sha256 || rom.length !== BYOR.rom_size) throw new Error("ROM BYOR non coincide co pin");
  const inst = instrumento();
  const trab = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-b-v2-"));
  const montado = montarSondas({
    base: SITIOS[0].end,
    dir: trab,
    nome: "dB-sondas-v2",
    nops: 0,
    inst,
    sondas: SITIOS.map((s, i) => ({
      rotulo: s.id,
      texto: s.texto,
      alvo: s.alvo,
      sep: 0,
      sitioFixo: i === 0 ? undefined : s.end,
    })),
  });
  fs.rmSync(trab, { recursive: true, force: true });
  const por = new Map(montado.sondas.map((r) => [r.rotulo, r]));

  const sitios = SITIOS.map((s) => {
    const r = por.get(s.id);
    if (r.sitio !== s.end) throw new Error(`${s.id}: GAS situou en ${HEX(r.sitio)}, conxelado ${HEX(s.end)}`);
    // Cada sonda é UNHA instrución: o grupo de GAS pode arrastrar o recheo do `.org`
    // seguinte, así que a lonxitude é a da primeira liña da desmontaxe.
    const primeira = r.desmontaxe.split("\n")[0].split("\t");
    const bytesIns = primeira[1].replace(/\s+/g, "");
    const na_rom = rom.subarray(s.end, s.end + bytesIns.length / 2).toString("hex");
    return {
      id: s.id,
      capacidade: s.cap,
      nivel: NIVEL[s.cap],
      sitio: s.end,
      esperado_bytes: bytesIns.toLowerCase(),
      lonxitude: bytesIns.length / 2,
      instrumento: { mnemonico: r.mnemonico, ea: r.ea, desmontaxe: r.desmontaxe.split("\n")[0] },
      rom_ten_agora: na_rom,
      gabarito: GABARITO,
      contrato: CONTRATO,
    };
  });

  // KB2v-tabela e KBE-slot: seis ponteiros BE na ROM, lidos por D.
  const TABELA = 112204;
  const ponteiros = Array.from({ length: 6 }, (_, i) => rom.readUInt32BE(TABELA + 4 * i));
  const slots = ponteiros.slice(0, 5).map((p, i) => ({ id: `KBE-slot-${i}`, offset: p, esperado_bytes_armazenados: ponteiros[i + 1] - p }));

  // CRAM: Pal_Index (20 entradas de 8 B: ptr.l, ramaddr.w, contagem.w), lidas por D.
  const PAL_INDEX = 0x2168;
  const entradas = Array.from({ length: 20 }, (_, i) => {
    const o = PAL_INDEX + 8 * i;
    return { id: i, ponteiro: rom.readUInt32BE(o), ramaddr: rom.readUInt16BE(o + 4), contagem: rom.readUInt16BE(o + 6) };
  });
  const palSpecial = entradas[10];
  const kbc = {
    pal_index: { endereco: PAL_INDEX, entradas, nivel: "referencia-estatica", nota: "estrutura de 8 B por entrada lida por D directamente da ROM" },
    pal_special: { ponteiro: palSpecial.ponteiro, bytes: 128, sha256: sha256(rom.subarray(palSpecial.ponteiro, palSpecial.ponteiro + 128)) },
    ss_wall_tabela: { endereco: 0x1b43a, bytes: 128, sha256: sha256(rom.subarray(0x1b43a, 0x1b43a + 128)) },
    hipotese: { escolhida_por_B: "H_B", campos_lidos_por_D: { f_pause: HEX(rom.readUInt16BE(0x4964), 4), ani0_time: HEX(rom.readUInt16BE(0x1b33c), 4) } },
  };

  // KBE mutacións: deterministas, semente propia (xerador v2 corrixido, R16).
  const novo = xerador("v2")("d-b-v2-mutacoes");
  const mutacoes = Array.from({ length: 48 }, () => ({
    stream: Math.floor(novo() % 5),
    byte_rel: novo() / 255,
    bit: novo() % 8,
  }));

  const truth = {
    esquema: "rex-parallel-d/truth-b/2",
    id: "dB-truth-v2",
    gabarito: GABARITO,
    contrato: CONTRATO,
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_b_v2.mjs",
    rom: { sha256: BYOR.rom_sha256, bytes: BYOR.rom_size },
    instrumento: { version: inst.version, bandeira: inst.bandeira, sha256_as: inst.sha256_as, sha256_objdump: inst.sha256_objdump },
    sitios,
    tabela_ponteiros: { endereco: TABELA, ponteiros, nota: "seis palabras longas BE lidas por D" },
    kbe: {
      slots,
      sexto_slot: { id: "KBE-slot-5", offset: ponteiros[5], estado: "descoñecido", motivo: "non hai un oitavo ponteiro independente que delimite o fin do sexto slot: o tamaño non se adiviña" },
      truncamentos: [
        { id: "KBE-trunc-cabeceira", corte_bytes: 5, codigos_aceitados: [2, 3] },
        { id: "KBE-trunc-so-cabeceira", corte_bytes: 6, codigos_aceitados: [2, 3] },
        { id: "KBE-trunc-menos-un", corte: "armazenado-1", codigos_aceitados: [2] },
        { id: "KBE-trunc-metade", corte: "armazenado/2", codigos_aceitados: [2, 3] },
      ],
      mutacoes_sen_panic: { entradas: mutacoes, codigos_aceitados: [0, 2, 3, 4, 5], motivo: "calquera outro rc (101, 134, 139) ou sinal é un crash, non unha recusa estruturada" },
      sensibilidade: { stream: 0, byte_rel: 20, bit: 0, motivo: "virar un bit no corpo ten que mudar a saída ou ser recusado; saída idéntica = decoder cego á entrada" },
      equivalencia: { estado: "descoñecido", motivo: "non hai decoder independente: `enigma_research.py` é da familia B (espello, R10) e o decoder externo foi excluído por política" },
    },
    kbc,
    limites_de_autoria: [
      "os opcodes veñen de `m68k-elf-as -m68000` (Binutils 2.41); os enderezos dos sitios son alegacións de B e conxélanse co que a ROM di neles",
      "o nivel máximo de KBC é `vinculo-estrutural`: ningunha fila le CRAM escrito en execución (`consumo-observado` non probado, E22 de B)",
      "KBE non mide equivalencia de saída; as filas de slot dependen só dos ponteiros da táboa da ROM",
      "a ROM é BYOR e non se versiona; só se publican hashes e valores de sitios de ≤ 128 B",
    ],
    denominador: {
      partes: { KB1v: 5, KB2v: 2, KBC: 7, KBE: 5 + 4 + 1 + 1 },
      nota: "KB1v 5 (chamada, copia, salto, contador d1 e d2); KB2v 2 (value-offset + táboa de 6 ponteiros); KBC 7 (call site, Pal_Index, Pal_Special, tabela de paredes, blink, palcycle, hipótese); KBE 11 (5 slots, 4 truncamentos, sensibilidade, ausencia de panic). `KBE-slot-5` e a equivalencia de saída son `descoñecido` e non entran no denominador. KB3/KB4/NB seguen no gabarito v1 (sen dependencia de ISA).",
    },
  };
  truth.denominador.total = Object.values(truth.denominador.partes).reduce((a, b) => a + b, 0);
  return truth;
}

export function gravarB2({ dir = DIR_B } = {}) {
  const truth = construirB2();
  // o instrumento tamén decide o contrario: se v1 diverxe, queda dito e non se asume
  const v1 = JSON.parse(fs.readFileSync(path.join(dir, "dB-truth-v1.json"), "utf8"));
  const v1Bytes = Object.fromEntries([...v1.kb1, ...v1.kb2].filter((r) => r.esperado_bytes).flatMap((r) => (Array.isArray(r.endereco) ? r.endereco.map((e, i) => [e, r.esperado_bytes[i]]) : [[r.endereco, r.esperado_bytes]])));
  truth.comparacion_v1 = truth.sitios
    .filter((s) => s.capacidade.startsWith("KB1") || s.capacidade === "KB2v")
    .map((s) => ({ id: s.id, sitio: s.sitio, v1: v1Bytes[s.sitio] ?? null, v2_instrumento: s.esperado_bytes, coincide: (v1Bytes[s.sitio] ?? null) === s.esperado_bytes }));
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, NOME_TRUTH);
  fs.writeFileSync(p, `${JSON.stringify(truth, null, 2)}\n`);
  const pin = {
    esquema: "rex-parallel-d/pin-frentes/2",
    xerado_por: truth.xerado_por,
    gabarito: GABARITO,
    contrato: CONTRATO,
    denominador: truth.denominador,
    instrumento: truth.instrumento,
    arquivos: { [NOME_TRUTH]: { sha256: sha256(fs.readFileSync(p)), bytes: fs.statSync(p).size } },
  };
  fs.writeFileSync(path.join(dir, NOME_PIN), `${JSON.stringify(pin, null, 2)}\n`);
  return { truth, pin };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarB2();
  console.log(`[author B v2] ${Object.entries(r.truth.denominador.partes).map(([k, v]) => `${k} ${v}`).join(" · ")} = ${r.truth.denominador.total}`);
  for (const c of r.truth.comparacion_v1) console.log(`  ${c.id.padEnd(20)} v1=${c.v1} v2=${c.v2_instrumento} ${c.coincide ? "=" : "DIVERXE"}`);
  for (const s of r.truth.sitios) console.log(`  ${s.id.padEnd(20)} ${HEX(s.sitio)} ${s.esperado_bytes} rom=${s.rom_ten_agora} ${s.esperado_bytes === s.rom_ten_agora ? "" : "≠ROM"}`);
}
