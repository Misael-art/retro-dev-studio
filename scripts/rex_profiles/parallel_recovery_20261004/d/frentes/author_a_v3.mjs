#!/usr/bin/env node
/**
 * Autor dos casos de **segmento v3** da fronte A (barra D, §12.17).
 *
 * Desde `6ae4f02` A só promove un par carga→chamada cando a xanela é recta, limpa
 * e con un único candidato (RESPOSTA-D-A §5/§7); calquera outro par esixe
 * `--chamada-sitio` (declarado). Isto cambia o contrato de v2 (emparellamento
 * automático pola xanela, `bd40e92`). Estes casos conxelan, ANTES de medir, o que
 * a documentación publicada de A promete para cada forma de tramo.
 *
 * Ningún byte 68000 se escribe a man (R14): GAS codifica, objdump le. Os sitios de
 * cada instrución son os que devolve o montador. Respostas do conxunto `holdout`
 * fóra da árbore (R17).
 *
 * Uso: node …/frentes/author_a_v3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { montarSondas, instrumento, sha256, RAIZ } from "./montador.mjs";
import { kosinskiEncode, xerador } from "../lib_bench.mjs";

export const DIR_A = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/a");
export const DIR_HO = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/a-holdout");
export const RESP_DIR = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v3-A";

export const INSTANCIAS = {
  medicao: { seed: "d-a-seg-v3-medicao", rom_size: 0x20000, rutina1: 0x2100, rutina2: 0x1f00, fluxo1: 0x8000, primeiro: 0x200, paso: 0x40, nome: "dA-seg-v3.bin", tam: 640 },
  holdout: { seed: "d-a-seg-v3-holdout-r3", rom_size: 0x20000, rutina1: 0x2500, rutina2: 0x1b00, fluxo1: 0x7800, primeiro: 0x300, paso: 0x48, nome: "dA-seg-ho-v3.bin", tam: 576 },
};

const HEX = (n) => `0x${n.toString(16).toUpperCase().padStart(6, "0")}`;

export function construirSegmentos(instancia) {
  const I = INSTANCIAS[instancia];
  const inst = instrumento();
  const novo = xerador("v2")(I.seed);
  const plain = Buffer.from(Array.from({ length: I.tam }, () => novo()));
  const enc = kosinskiEncode(plain);
  const L = (r) => `lea (0x${I.fluxo1.toString(16)}).l,%${r}`;
  const J1 = `jsr (0x${I.rutina1.toString(16)}).l`;
  const J2 = `jsr (0x${I.rutina2.toString(16)}).l`;
  // A xanela de cada caso cobre exactamente o seu tramo (carga→fin da última instrución),
  // para que as palabras de recheo non entren no tramo e confundan o rótulo medido.
  // Cada caso: lista de instrucións. O primeiro ten sitioFixo; os seguintes seguen sen separador.
  const casos = [
    { id: "SEG-limpo", janela: 6, ins: [["carga", L("a0")], ["chamada", J1]] },
    { id: "SEG-bra", janela: 8, ins: [["carga", L("a0")], ["bra", "bra.s .+8"], ["chamada", J1]] },
    { id: "SEG-rts", janela: 8, ins: [["carga", L("a0")], ["rts", "rts"], ["chamada", J1]] },
    { id: "SEG-sobrescrito", janela: 12, ins: [["carga", L("a0")], ["sobre", L("a0")], ["chamada", J1]] },
    { id: "SEG-dous", janela: 12, ins: [["carga", L("a0")], ["chamada", J1], ["chamada2", J2]] },
    { id: "SEG-nop", janela: 8, ins: [["carga", L("a0")], ["nop", "nop"], ["chamada", J1]] },
  ];
  const sondas = [];
  casos.forEach((c, k) => {
    c.ins.forEach(([rot, texto], j) => {
      sondas.push({ rotulo: `${c.id}-${rot}`, texto, sep: 0, sitioFixo: j === 0 ? I.primeiro + k * I.paso : undefined });
    });
  });
  const rotina = Array(15).fill("nop").concat("rts").join("\n");
  const rotinas = [
    { rotulo: "rotina1", texto: rotina, sep: 0, sitioFixo: I.rutina1 },
    { rotulo: "rotina2", texto: rotina, sep: 0, sitioFixo: I.rutina2 },
  ];
  // GAS exixe sitioFixo monótono: ordénanse por sitio.
  const todo = [...sondas, ...rotinas];
  const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-a-v3-"));
  // rotina2 (menor) pode caer antes dos casos: reordénase por sitio.
  const ordenadas = [];
  const grupos = [];
  for (const s of todo) {
    if (s.sitioFixo !== undefined) grupos.push([s]);
    else grupos[grupos.length - 1].push(s);
  }
  grupos.sort((a, b) => a[0].sitioFixo - b[0].sitioFixo);
  for (const g of grupos) ordenadas.push(...g);
  const montado = montarSondas({ base: ordenadas[0].sitioFixo ?? I.primeiro, dir, nome: `dA-seg-${instancia}`, nops: 0, inst, sondas: ordenadas.map((s, i) => (i === 0 ? { ...s, sitioFixo: undefined } : s)) });
  fs.rmSync(dir, { recursive: true, force: true });
  const por = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const bytesIns = (r) => r.desmontaxe.split("\n")[0].split("\t")[1].replace(/\s+/g, "").toUpperCase();

  const img = Buffer.alloc(I.rom_size, 0);
  for (const g of montado.grupos) {
    const b = Buffer.from(g.liñas.map((l) => l.bytes).join(""), "hex");
    b.copy(img, g.direccion);
  }
  enc.stream.copy(img, I.fluxo1);

  const filas = casos.map((c) => {
    const s = (rot) => por.get(`${c.id}-${rot}`);
    const carga = s("carga");
    const chamada = s("chamada");
    return {
      id: c.id,
      janela: c.janela,
      carga_sitio: carga.sitio,
      chamada_sitio: chamada.sitio,
      carga_bytes: bytesIns(carga),
      chamada_bytes: bytesIns(chamada),
      instrumento: { carga: carga.desmontaxe.split("\n")[0], chamada: chamada.desmontaxe.split("\n")[0] },
      rutina_alvo: I.rutina1,
    };
  });
  const E = {
    "SEG-limpo": { auto: { rc: 0, confianza: "vinculo-estrutural", chamada: true, nao_contem: ["par-declarado"] }, declarado: { rc: 0, confianza: "vinculo-estrutural", contem: ["par-declarado"] } },
    "SEG-bra": { auto: { rc: 0, confianza: "referencia-estatica", chamada: false, contem: ["segmento-roto:roto-bra"] } },
    "SEG-rts": { auto: { rc: 0, confianza: "referencia-estatica", chamada: false, contem: ["segmento-roto:roto-rts"] } },
    "SEG-sobrescrito": { auto: { rc: 0, confianza: "referencia-estatica", chamada: false, contem: ["sobrescrit"] } },
    "SEG-dous": { auto: { rc: 0, confianza: "referencia-estatica", chamada: false, contem: ["ventana-ambigua:2-candidatos"] }, declarado: { rc: 0, confianza: "vinculo-estrutural", contem: ["par-declarado"] } },
    "SEG-nop": { auto: { rc: 0, confianza: "referencia-estatica", chamada: false, contem: ["tramo-non-modelado"] }, declarado: { rc: 0, confianza: "vinculo-estrutural", contem: ["par-declarado"] } },
  };
  for (const f of filas) f.esperado = E[f.id];
  const nopSitio = por.get("SEG-nop-nop").sitio;
  const negativo = {
    id: "SEG-declarado-non-chamada",
    carga_sitio: por.get("SEG-nop-carga").sitio,
    chamada_declarada: nopSitio,
    esperado: { rc_distinto_de_0: true, cadea_promovida: false, motivo: "o sitio declarado é un `nop`, non unha chamada" },
  };
  const truth = {
    esquema: "rex-parallel-d/truth-a-seg/3", id: I.nome, instancia, gabarito: GABARITO, contrato: CONTRATO,
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_a_v3.mjs",
    imaxe: { rom_size: I.rom_size, bytes: img.length, sha256: sha256(img) },
    config: I, rutina_lonxitude: 32,
    fluxo: { offset: I.fluxo1, plain_sha256: sha256(plain), plain_len: plain.length, stream_len: enc.stream.length },
    instrumento: { version: inst.version, sha256_as: inst.sha256_as, sha256_objdump: inst.sha256_objdump },
    casos: filas, negativo,
    limites_de_autoria: [
      "os `contem` son os rótulos publicados por A en RESPOSTA-D-A §5/§6 (a súa propia documentación); a ISA ao nivel de bytes vén do instrumento",
      "`sobrescrit` é substring: A non publica o rótulo exacto da garda de sobrescrita",
      "imaxe sintética: non é ROM comercial nin BYOR",
    ],
    denominador: { partes: { "SEG-auto": 6, "SEG-declarado": 3, "SEG-neg": 1 }, total: 10 },
  };
  return { img, truth };
}

export function gravar(instancia) {
  const { img, truth } = construirSegmentos(instancia);
  const I = INSTANCIAS[instancia];
  const dir = instancia === "holdout" ? DIR_HO : DIR_A;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, I.nome), img);
  const resp = instancia === "holdout" ? path.join(RESP_DIR, "dA-seg-ho-v3-respostas.json") : path.join(dir, "dA-seg-v3-truth.json");
  fs.mkdirSync(path.dirname(resp), { recursive: true });
  fs.writeFileSync(resp, `${JSON.stringify(truth, null, 2)}\n`);
  const pin = {
    esquema: "rex-parallel-d/pin-frentes/3", gabarito: GABARITO, contrato: CONTRATO, conxunto: instancia, denominador: truth.denominador,
    arquivos: { [I.nome]: { sha256: sha256(img), bytes: img.length } },
    [instancia === "holdout" ? "respostas" : "verdade"]: { [path.basename(resp)]: { sha256: sha256(fs.readFileSync(resp)) } },
  };
  fs.writeFileSync(path.join(dir, instancia === "holdout" ? "pin-seg-holdout-v3.json" : "pin-seg-v3.json"), `${JSON.stringify(pin, null, 2)}\n`);
  return { truth, pin, resp };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const i of ["medicao", "holdout"]) {
    const r = gravar(i);
    console.log(`[author A v3 ${i}] ${r.truth.imaxe.sha256.slice(0, 16)}… ${r.truth.casos.map((c) => `${c.id}@${HEX(c.carga_sitio)}`).join(" ")}`);
  }
}
