#!/usr/bin/env node
/**
 * Autor do **holdout v2 da fronte C** (barra D, rolda 3, requisito 8).
 *
 * Que o distingue da medición (`author_v2_c.mjs`):
 *  - as formas sondadas son **disxuntas** das 42 filas conxeladas da medición:
 *    ningunha palabra, ningún sitio e ningún sítio de consulta coincide (isto
 *    compróbase mecamicamente contra `dC-cx*-truth-v2.json` e lanza);
 *  - as respostas **non se versionan na árbore**: gardan-se en
 *    `~/rds-scratch/rex-heldout-d3/` e só se publica o seu SHA-256 en
 *    `pin-holdout-c-v2.json` (precedente: `frentes/holdout/pin.json`);
 *  - o `cbb6895` da rolda 2 **non se reutiliza** (R17: un holdout vale para o
 *    seu SHA e a súa versión de contrato).
 *
 * Como en v2, ningún byte 68000 se escribe a man (`R14`): codifícao
 * `m68k-elf-as -m68000` e o talo de lonxitude/mnemónico/enderezo efectivo é o que
 * devolve `m68k-elf-objdump`. As citas léense **do CONTRACT.md do SHA medido
 * (`8ea5821`)**, non de coordenadas antigas: `citaLiñas()` constrúe cada citaación
 * recortando as liñas reais desese commit, así que `verificarCitacao` non pode
 * atopar unha ancoraxe falsa.
 *
 * Uso: node scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { montarSondas, controlarSolapamento, instrumento, sha256, RAIZ } from "./montador.mjs";
import { DATA_C, GABARITO, CONTRATO, imaxeDesdeGrupos } from "./author_v2_c.mjs";
import { PIN, bytesDoCommit } from "../medida/ferramentas.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DATA_HO = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/c-holdout");
export const RESPOSTAS_DIR = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
const CAMINO_CONTRATO = "docs/rex_profiles/parallel_recovery_20261004/c/CONTRACT.md";
const BASE = 0x100;
const HEX = (n, w = 4) => `0x${n.toString(16).padStart(w, "0")}`;
const talo = (m) => String(m).split(/[\s(]/)[0].toLowerCase();
const meta = () => ({ gabarito: GABARITO, contrato: CONTRATO, conxunto: "holdout" });

/** O desmontador di que unha palabra non é instrución cando imprime `.short` ou
 *  perde o enderezo (`out of bounds`); é a mesma varas que usa o adaptador. */
const RECUSA_INSTRUMENTO = /\.short\b|out of bounds/i;

/** Liñas reais de `CONTRACT.md` en `8ea5821`, 1-indexadas. */
const LINHAS_CONTRATO = bytesDoCommit(PIN.C_novo, CAMINO_CONTRATO).toString("utf8").split("\n");

/**
 * Constrúe unha citaación a partir do texto **do commit medido**: recorta as
 * liñas `a..b`, quita o marcador de lista e capa a 118 caracteres nun límite de
 * palabra. Devolve `§N liñas a-b: «…»`; o adaptador comproba despois que o
 * texto ancora nesas liñas (con `desprazo: 0`, porque as coordenadas xa son as
 * de `8ea5821`).
 */
export function citaLiñas(a, b, sec = "§3") {
  if (b === undefined) b = a;
  const cru = LINHAS_CONTRATO.slice(a - 1, b).join(" ").replace(/^[-*\s]+/, "").trim();
  if (!cru) throw new Error(`CONTRACT.md@${PIN.C_novo.slice(0, 7)} non ten texto nas liñas ${a}-${b}`);
  let texto = cru.length > 118 ? cru.slice(0, 118).replace(/\s\S*$/, "") : cru;
  if (texto.includes("«") || texto.includes("»")) texto = texto.replace(/[«»]/g, "");
  return `${sec} liñas ${a}${b > a ? `-${b}` : ""}: «${texto}»`;
}

/** CITA en coordenadas de `8ea5821` (as liñas lido-se, non se escriben a man). */
const CITA = Object.freeze({
  lista_move: citaLiñas(156, 158),
  lea_pea: citaLiñas(159),
  aritmetica: citaLiñas(160),
  unarios: citaLiñas(161),
  inmed: citaLiñas(162),
  desprazamentos: citaLiñas(163),
  bits: citaLiñas(164),
  mult: citaLiñas(165),
  scc: citaLiñas(166),
  fluxo: citaLiñas(167, 169),
  fluxo_rt: citaLiñas(170, 171),
  movem: citaLiñas(172, 173),
  peche: citaLiñas(176, 177),
  autoridade: citaLiñas(178, 179),
  arestas: citaLiñas(192, 193),
  chamadas: citaLiñas(194),
  fronteiras: citaLiñas(196),
  cobertura: citaLiñas(197, 198),
  sitios: citaLiñas(199, 201),
  regra_cobertura: citaLiñas(207, 208, "§4"),
  regra_miolo: citaLiñas(209, 211, "§4"),
  regra_fluxo: citaLiñas(212, 214, "§4"),
  regra_raiz: citaLiñas(215, 217, "§4"),
  despraz_base: citaLiñas(67, 71, "§2"),
  vocab_proviencia: citaLiñas(61, 62, "§2"),
  consultar_un_sitio: citaLiñas(88, 90, "§2.1"),
  medir_unha_raiz: citaLiñas(121, 124, "§2.2"),
});

// ---------------------------------------------------------------------------
// dC-ho1-v2 — KC1v-ho: 18 filas de instrución (14 da lista, 3 fóra da lista
// fechada, 1 de coherencia contrato↔código)
// ---------------------------------------------------------------------------

/** `sonda` = texto para GAS; `palabras` = palabra crúa; `dominio` e `esperado`
 *  seguen a semántica de `author_v2_c.mjs` (§12.12 a). */
const HO1_FORMAS = [
  { rot: "h1-01", s: "pea (0x2020).l", id: "HO-KC1v-pea-abs-l", forma: "pea abs.L", cit: CITA.lea_pea },
  { rot: "h1-02", s: "subq.w #3,(%a2)", id: "HO-KC1v-subq-w-3-a2", forma: "subq.w #3,(A2)", cit: CITA.aritmetica },
  { rot: "h1-03", s: "andi.l #0xff00,(%a3)", id: "HO-KC1v-andi-l-imm-a3", forma: "andi.l #imm32,(A3)", cit: CITA.inmed },
  { rot: "h1-04", s: "eori.w #0x0101,(%a5)", id: "HO-KC1v-eori-w-imm-a5", forma: "eori.w #imm16,(A5)", cit: CITA.inmed },
  { rot: "h1-05", s: "cmpi.w #4,(%a0)", id: "HO-KC1v-cmpi-w-4-a0", forma: "cmpi.w #imm16,(A0)", cit: CITA.inmed },
  { rot: "h1-06", s: "asl.l #3,%d5", id: "HO-KC1v-asl-l-3-d5", forma: "asl.l #3,D5", cit: CITA.desprazamentos },
  { rot: "h1-07", s: "mulu.w (%a1),%d4", id: "HO-KC1v-mulu-w-a1-d4", forma: "mulu.w (A1),D4", cit: CITA.mult },
  { rot: "h1-08", s: "divu.w (0x1000).w,%d6", id: "HO-KC1v-divu-w-abs-l", forma: "divu.w abs.W,D6", cit: CITA.mult },
  { rot: "h1-09", s: "bset #5,(%a1)", id: "HO-KC1v-bset-5-a1", forma: "bset #5,(A1)", cit: CITA.bits, stems_extra: ["bic", "bittest"] },
  { rot: "h1-10", s: "st %d3", id: "HO-KC1v-st-d3", forma: "st D3", cit: CITA.scc, stems_extra: ["scc", "shs", "sf", "seq"] },
  { rot: "h1-11", s: "link.w %a6,#16", id: "HO-KC1v-link-w-a6", forma: "link.w A6,#16", cit: CITA.fluxo_rt, stems_extra: ["link"] },
  { rot: "h1-12", s: "unlk %a6", id: "HO-KC1v-unlk-a6", forma: "unlk A6", cit: CITA.fluxo_rt },
  { rot: "h1-13", s: "movem.w %a2-%a4,-(%sp)", id: "HO-KC1v-movem-w-a2-a4-sp", forma: "movem.w A2-A4,-(SP)", cit: CITA.movem, stems_extra: ["movem"] },
  { rot: "h1-14", s: "move.b #4,(%a0)", id: "HO-KC1v-move-b-imm-a0mem", forma: "move.b #imm,(A0)", cit: CITA.lista_move },
  {
    rot: "h1-15",
    s: "ext.l %d3",
    id: "HO-KC1v-ext-l-d3",
    forma: "ext.l D3",
    dominio: "fora-do-subconjunto-de-C",
    cit: CITA.peche,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
    nota:
      "EXT.L é instrución 68000 lexítima (o instrumento decódifaa: `48C3 extl %d3`) e **non** " +
      "está na lista fechada de §3, así que a recusa é o comportamento que C promete. Domínio " +
      "`fora-do-subconjunto-de-C`: o ditame do instrumento corrobora a fronteira, non a refuta " +
      "(§12.12 a). Xeneraliza a fila `KC1v-move-l-d16pc-d0` da medición.",
  },
  {
    rot: "h1-16",
    s: "exg %d3,%a5",
    id: "HO-KC1v-exg-d3-a5",
    forma: "exg D3,A5",
    dominio: "fora-do-subconjunto-de-C",
    cit: CITA.peche,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
    nota: "EXG decodificada polo instrumento (`C78D exg %d3,%a5`) e ausente da lista de §3.",
  },
  {
    rot: "h1-17",
    s: "trapv",
    id: "HO-KC1v-trapv",
    forma: "trapv",
    dominio: "fora-do-subconjunto-de-C",
    cit: CITA.peche,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
    nota:
      "§3 lista `TRAP #n` (fronteira `trap-opaco`) pero non TRAPV; a palabra `4E76` é a mesma " +
      "familia 0100 111 0zzz, así que discrimina se a lista de §3 se aplica por patrón de bits " +
      "ou por mnemonic. O instrumento decódifaa como `trapv`.",
  },
  {
    rot: "h1-18",
    s: "movea.w #0x1234,%a3",
    id: "HO-KC1v-movea-w-imm-a3",
    forma: "movea.w #imm16,A3",
    dominio: "coherencia-contrato-codigo",
    cit: CITA.lista_move,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
    nota:
      "§3 di «`#imm` só em MOVE», así que a prosa restringe o inmediato tamén a MOVEA.L; o " +
      "instrumento codifica e decodifica `367C1234` como `moveaw #4660,%a3`. É a xeneralización " +
      "da fila `KC1v-movea-l-imm-a1` (medición, FAIL en `coherencia-contrato-código`): se C " +
      "decodifica tamén a forma .W, a diverxencia prosa↔código non era un caso illado. " +
      "A cláusula de autoridade de §3 («a tabela exata vive en `src/decode.rs`») é a lectura " +
      "alternativa (§12.10 j); o que se gradúa é o eixe de coherencia, non a lonxitude.",
  },
];

export function buildHO1({ inst, dir }) {
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-ho1-v2",
    nops: 0,
    inst,
    sondas: HO1_FORMAS.map((f) => ({ rotulo: f.rot, texto: f.s, sep: 0 })),
  });
  controlarSolapamento(montado.sondas);
  const lon = 0x80;
  let acumulado = 0;
  for (const r of montado.sondas) {
    if (r.sitio - BASE !== acumulado) {
      throw new Error(`dC-ho1-v2: ${r.rotulo} colocada en ${HEX(r.sitio - BASE)}, contigüidade dábala a ${HEX(acumulado)}`);
    }
    acumulado += r.lonxitude;
  }
  const fim = acumulado;
  if (fim >= lon) throw new Error(`dC-ho1-v2: as sondas desbordan a rexión (${HEX(fim)})`);
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon, recheo: 0xff });

  const porRot = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const kc1 = HO1_FORMAS.map((f) => {
    const r = porRot.get(f.rot);
    const stems = [talo(r.mnemonico), ...(f.stems_extra ?? [])];
    const esperado = f.esperado
      ? { ...f.esperado, tam_instrumento: r.lonxitude }
      : { tam: r.lonxitude, stems };
    return {
      ...meta(),
      id: f.id,
      forma: f.forma,
      endereco: r.sitio - BASE,
      bytes: r.bytes.toUpperCase(),
      dominio: f.dominio ?? "alegado-por-C",
      citacao_C: f.cit,
      espera_decodificacion: f.esperado?.fronteira !== true,
      sondeo: {
        rotulo: r.rotulo,
        bytes: r.bytes.toUpperCase(),
        lonxitude: r.lonxitude,
        instrumento: { mnemonico: r.mnemonico, desmontaxe: r.desmontaxe },
      },
      esperado,
      esperado_instrumento: { tam: r.lonxitude, mnemonico: r.mnemonico },
      ...(f.nota ? { nota: f.nota } : {}),
    };
  });

  const fila4 = kc1.find((x) => x.id === "HO-KC1v-andi-l-imm-a3");
  const tam = (id) => kc1.find((x) => x.id === id).esperado_instrumento.tam;
  const primaria = kc1.filter((x) => x.espera_decodificacion).reduce((s, x) => s + x.esperado_instrumento.tam, 0);
  const truth = {
    id: "dC-ho1-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs",
    regioes: [{ inicio: 0, fim: lon }],
    raizes: kc1.map((x) => ({ endereco: x.endereco, proveniencia: "candidato", evidencia: `sonda holdout ${x.id} (bytes de GAS)` })),
    sitios: [
      { endereco: kc1[0].endereco, esperado_veredito: "instrucao-de-bloco", motivo: "entrada da secuencia", citacao: CITA.sitios },
      { endereco: fila4.endereco + 2, esperado_veredito: "miolo-de-instrucao", motivo: `dentro de andi.l #imm,(A3) (${tam("HO-KC1v-andi-l-imm-a3")} B en ${HEX(fila4.endereco)})`, citacao: CITA.regra_miolo },
      { endereco: fim + 0x0c, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: `dentro do recheo 0xFF que comeza en ${HEX(fim)} (aritmética de D)`, citacao: CITA.sitios },
    ],
    sequencia: kc1.map((x) => ({ id: x.id, endereco: x.endereco, tam: x.esperado_instrumento.tam, bytes: x.bytes })),
    fim_instrucoes: fim,
    cobertura_esperada_bytes: {
      primaria,
      variante_movea_w_imm_decodifica: primaria + tam("HO-KC1v-movea-w-imm-a3"),
      nota:
        "`primaria` = Σ dos comprimentos ditados polo instrumento para as filas que esperan " +
        "decodificación (as tres frontiras de lista fechada non suman). A variante só afecta á " +
        "fila de coherencia, non ás lonxitudes (§12.10 j).",
    },
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc1,
    limites_de_autoria: [
      "ningún byte deste fixture ven do decodificador de C: cada palabra codifícaa " +
        "`m68k-elf-as -m68000` e o comprimento/mnemónico graduados son o ditame de " +
        "`m68k-elf-objdump` (R14)",
      "as citaacións recórtanse do CONTRACT.md do propio commit medido (`8ea5821`), non de " +
        "coordenadas históricas: `verificarCitacao` comproba a ancoraxe con `desprazo: 0`",
      "o recheo é 0xFF, non 0x00 (`0000` decodifica como `ori.b #imm,Dn`, que está na lista de §3)",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-ho2-v2 — KC2v-ho 4 + KC5v-ho 5 (fluxo con rama desprazamentos curtos)
// ---------------------------------------------------------------------------

const HO2 = Object.freeze({
  clr: 0x00,
  bne: 0x02,
  bra: 0x04,
  swap: 0x06,
  bsr: 0x08,
  dbne: 0x0a,
  rts1: 0x0e,
  rts2: 0x10,
  lon: 0x18,
});

export function buildHO2({ inst, dir }) {
  const s = (n) => BASE + HO2[n];
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-ho2-v2",
    nops: 0,
    inst,
    sondas: [
      { rotulo: "clr", texto: "clr.l (%a3)", sep: 0, sitioFixo: s("clr") },
      { rotulo: "bne", texto: () => "bne.b p_rts1", sep: 0, sitioFixo: s("bne"), alvo: s("rts1") },
      { rotulo: "bra", texto: () => "bra.b p_rts1", sep: 0, sitioFixo: s("bra"), alvo: s("rts1") },
      { rotulo: "swap", texto: "swap %d4", sep: 0, sitioFixo: s("swap") },
      { rotulo: "bsr", texto: () => "bsr.b p_rts2", sep: 0, sitioFixo: s("bsr"), alvo: s("rts2") },
      { rotulo: "dbne", texto: () => "dbne %d5,p_dbne", sep: 0, sitioFixo: s("dbne"), alvo: s("dbne") },
      { rotulo: "rts1", texto: "rts", sep: 0, sitioFixo: s("rts1"), rol: "controle" },
      { rotulo: "rts2", texto: "rts", sep: 0, sitioFixo: s("rts2"), rol: "controle" },
    ],
  });
  controlarSolapamento(montado.sondas);
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon: HO2.lon, recheo: 0xff });
  const dito = (n) => {
    const r = porNome.get(n);
    if (!r) throw new Error(`dC-ho2-v2: sonda ausente ${n}`);
    return {
      endereco: r.sitio - BASE,
      bytes: r.bytes.toUpperCase(),
      tam: r.lonxitude,
      instrumento: { mnemonico: r.mnemonico, ea: r.ea === null ? null : r.ea - BASE, desmontaxe: r.desmontaxe },
    };
  };
  const bne = dito("bne"), bra = dito("bra"), bsr = dito("bsr"), dbne = dito("dbne"), sw = dito("swap");
  // O montador emite as formas curtas como word de extensión (`60 06` = BRA.S con
  // desprazamento 6), non como byte: compróbase aquí porque a fila KC2v depende.
  for (const [nome, r] of [["bne.b", bne], ["bra.b", bra], ["bsr.b", bsr]]) {
    if (r.tam !== 2) {
      throw new Error(`dC-ho2-v2: ${nome} montou en ${r.tam} B (${r.bytes}); o holdout gradúa a forma curta de 2 B`);
    }
  }
  if (dbne.tam !== 4) throw new Error(`dC-ho2-v2: dbne montou en ${dbne.tam} B (${dbne.bytes}), esperado 4 (extensión word)`);

  const decodificados = dito("clr").tam + bne.tam + bra.tam + bsr.tam + dbne.tam + dito("rts1").tam + dito("rts2").tam;
  const kc2 = [
    {
      ...meta(),
      id: "HO-KC2v-base-bne-b",
      endereco: bne.endereco,
      bytes: bne.bytes,
      esperado: { tam: bne.tam, alvo: bne.instrumento.ea, base: "sitio+2" },
      discriminante: `con base=sitio+4 o alvo calculado sería ${HEX(bne.instrumento.ea + 2)}, non ${HEX(bne.instrumento.ea)}; é a forma curta (.B), que a medición non exercitou (só .W en dC-cx2-v2)`,
      citacao_C: CITA.despraz_base,
      sondeo: bne.instrumento,
    },
    {
      ...meta(),
      id: "HO-KC2v-aresta-desvio-bne",
      endereco: bne.endereco,
      esperado: { tipo: "desvio", status: "resolvido", origem: bne.endereco, alvo: bne.instrumento.ea },
      citacao_C: CITA.arestas,
      sondeo: bne.instrumento,
    },
    {
      ...meta(),
      id: "HO-KC2v-bsr-b",
      endereco: bsr.endereco,
      bytes: bsr.bytes,
      esperado: { tam: bsr.tam, alvo: bsr.instrumento.ea, base: "sitio+2" },
      discriminante: `con base=sitio+4 o alvo sería ${HEX(bsr.instrumento.ea + 2)} (${HEX(bsr.instrumento.ea)} é o ditame do instrumento)`,
      citacao_C: CITA.fluxo,
      sondeo: bsr.instrumento,
    },
    {
      ...meta(),
      id: "HO-KC2v-dbne-ext",
      endereco: dbne.endereco,
      bytes: dbne.bytes,
      esperado: { tam: dbne.tam, alvo: dbne.instrumento.ea, nota: `laço propio en ${HEX(dbne.endereco)}; GAS calcula disp = −2 e o desmontador dita o alvo` },
      citacao_C: CITA.scc,
      sondeo: dbne.instrumento,
    },
  ];

  const kc5 = [
    {
      ...meta(),
      id: "HO-KC5v-diamante-bne",
      probe: "diamante",
      endereco: bne.endereco,
      esperado: { ramos: 2, tipos: ["queda", "desvio"] },
      citacao_C: CITA.arestas + " — o desvío non elimina a caída",
    },
    {
      ...meta(),
      id: "HO-KC5v-bra-sen-caida",
      probe: "diamante",
      endereco: bra.endereco,
      esperado: { ramos: 1, tipos: ["desvio"] },
      discriminante: `BRA é incondicional: se C tratase a caída como aresta, existiría ${HEX(bra.endereco)}→${HEX(bra.endereco + bra.tam)} e o sitio ${HEX(sw.endereco)} sería instrución decodificada, non «non alcanzado»`,
      motivo: "xeneralización: a medición só exercitou a caída despois dunha condicional",
      citacao_C: CITA.regra_fluxo,
    },
    {
      ...meta(),
      id: "HO-KC5v-rts-nao-continua",
      probe: "rts-nao-continua",
      endereco: dito("rts1").endereco,
      esperado: { sucessores: 0, tipo: "retorno-fronteira" },
      discriminante: `se RTS continuase, existiría aresta ${HEX(dito("rts1").endereco)}→${HEX(dito("rts1").endereco + 2)}`,
      citacao_C: CITA.fluxo_rt,
    },
    {
      ...meta(),
      id: "HO-KC5v-cobertura",
      probe: "cobertura",
      esperado: { bytes_decodificados: decodificados, bytes_regiao: HO2.lon },
      nota: "D recompon Σ dos comprimentos ditados polo instrumento; a `swap` de 0x06 non conta porque só se alcanza se BRA tivera caída",
      citacao_C: CITA.cobertura + "; " + CITA.regra_cobertura,
    },
    {
      ...meta(),
      id: "HO-KC5v-vereditos",
      probe: "vereditos",
      esperado: { miolo: dbne.endereco + 1, nao_alcancado: sw.endereco },
      motivo: `miolo dentro de dbne (${dbne.tam} B en ${HEX(dbne.endereco)}); ${HEX(sw.endereco)} é unha instrución montada que só se alcanza se o BRA non corte a caída`,
      citacao_C: CITA.sitios + "; " + CITA.regra_miolo,
    },
  ];

  const truth = {
    id: "dC-ho2-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs",
    regioes: [{ inicio: 0, fim: HO2.lon }],
    raizes: [
      { endereco: dito("clr").endereco, proveniencia: "candidato", evidencia: "entrada autoral do fluxo" },
      { endereco: bsr.endereco, proveniencia: "candidato", evidencia: "raíz directa sobre a chamada: illa bsr.b do camiño que bra.b corta" },
    ],
    sitios: [
      { endereco: dbne.endereco + 1, esperado_veredito: "miolo-de-instrucao", motivo: `dentro de dbne.w (${dbne.tam} B en ${HEX(dbne.endereco)})`, citacao: CITA.regra_miolo },
      { endereco: sw.endereco, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "sonda montada e decodificábel, pero o camiño lineal córtano o bra.b de 0x04", citacao: CITA.sitios },
    ],
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: r.sitio - BASE, tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico, rol: r.sonda.rol ?? "sonda" })),
    cobertura_esperada_bytes: {
      primaria: decodificados,
      variante_bra_non_corta_a_caida: decodificados + sw.tam,
      nota:
        "`primaria` = Σ das sete instrucións alcanzadas (a `swap` de 0x06 non se alcanza porque " +
        "BRA é incondicional). Se `bytes-decodificados` vale a variante, C continuou despois dun " +
        "BRA: iso é unha falla de fluxo, non desta fila de cobertura.",
    },
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc2,
    kc5,
    limites_de_autoria: [
      "os deslocamentos non os calcula D: cada desvío refire un símbolo do bloque e GAS codifica " +
        "o desprazamento; `objdump` dita o enderezo efectivo que a fila espera (R14)",
      "a segunda raíz (bsr) é elección de D para illar eixos, non unha afirmación de C",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-ho3-v2 — KC3v-ho 2 (fronteiras acordadas con outras palabras)
// ---------------------------------------------------------------------------

const HO3 = Object.freeze({ linhaF: 0x04, rtsAposF: 0x06, moveBAn: 0x14, rtsAposInv: 0x16, control: 0x34, lon: 0x44 });

export function buildHO3({ inst, dir }) {
  const s = (n) => BASE + HO3[n];
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-ho3-v2",
    nops: 0,
    inst,
    sondas: [
      { rotulo: "linha-f", palabras: [0xf200], sep: 0, sitioFixo: s("linhaF") },
      { rotulo: "rts-apos-f", texto: "rts", sep: 0, sitioFixo: s("rtsAposF"), rol: "controle" },
      { rotulo: "move-b-para-an", palabras: [0x1249], sep: 0, sitioFixo: s("moveBAn") },
      { rotulo: "rts-apos-inv", texto: "rts", sep: 0, sitioFixo: s("rtsAposInv"), rol: "controle" },
      { rotulo: "control", texto: "rts", sep: 0, sitioFixo: s("control"), rol: "controle" },
    ],
  });
  controlarSolapamento(montado.sondas);
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon: HO3.lon, recheo: 0xff });
  const dito = (n) => {
    const r = porNome.get(n);
    return { endereco: r.sitio - BASE, bytes: r.bytes.toUpperCase(), tam: r.lonxitude, instrumento: { mnemonico: r.mnemonico, desmontaxe: r.desmontaxe } };
  };
  const lf = dito("linha-f"), inv = dito("move-b-para-an"), ctrl = dito("control");
  // R11: a porta só xulga afirmacións de invibilidade de D, e aquí o que se promete
  // é que o **instrumento** recusa esas palabras. Se GAS/objdump lles deron
  // mnemónico, a expectativa sería defecto de D e a fila non pode medirse.
  for (const [nome, r] of [["f200", lf], ["1249", inv]]) {
    if (!RECUSA_INSTRUMENTO.test(r.instrumento.desmontaxe)) {
      throw new Error(`dC-ho3-v2: o instrumento decodificou ${nome} (${r.instrumento.desmontaxe}); non é unha fronteira acordada`);
    }
  }
  const front = (r, nome, cit, nota, statico) => ({
    ...meta(),
    id: `HO-KC3v-${nome}`,
    endereco: r.endereco,
    opcode: r.bytes,
    dominio: "fronteira-acordada",
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto", endereco: r.endereco, nada_decodificado_ades: r.endereco + 2 },
    citacao_C: cit,
    statico,
    nota,
    sondeo: r.instrumento,
    control_de_discriminacion: {
      endereco: r.endereco + 2,
      bytes: dito(r === lf ? "rts-apos-f" : "rts-apos-inv").bytes,
      esperado_veredito: "dentro-regiao-nao-alcancado",
      motivo: "hai un `rts` montado xusto despois: se C continuase a ruta, o sitio sería `instrucao-de-bloco` e a fila sería FAIL",
    },
  });
  const kc3 = [
    front(lf, "linha-f-2", CITA.peche,
      "Segunda palabra de liña-F (`f200`); a medición graduou `f000` e `f400` non se exercitou. O instrumento non lle dá mnemónico (`Address 0x… is out of bounds.`), así que a fila mide sitio, tipo e que a ruta para — non lonxitude (§12.10 i).",
      "classify sen ramo para %1111 → catch-all de `decode.rs`; `out` constrúe `Frontier::fora(Some(op))`"),
    front(inv, "move-b-para-an-2", CITA.lista_move + " — «combinações inválidas (p. ex. MOVE.W → An) = fronteira»",
      "Outra codificación da combinación inválida MOVE.B→An (`1249`; a medición usou `1149`). O instrumento recúsaa (`.short 0x1249`), así que a expectativa de fronteira está derivada do ditame e non dunha táboa escrita a man (R11).",
      "decode_move → ramo MOVEA → recusa de tamaño .B"),
  ];
  const truth = {
    id: "dC-ho3-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs",
    regioes: [{ inicio: 0, fim: HO3.lon }],
    raizes: [
      { endereco: lf.endereco, proveniencia: "candidato", evidencia: "sonda linha-F (palabra de GAS)" },
      { endereco: inv.endereco, proveniencia: "candidato", evidencia: "sonda MOVE.B→An (palabra de GAS)" },
      { endereco: ctrl.endereco, proveniencia: "candidato", evidencia: "controle positivo: un camiño limpo ten de decodificar" },
    ],
    sitios: [
      { endereco: dito("rts-apos-f").endereco, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "a ruta debe parar na fronteira de 0x04", citacao: CITA.sitios },
      { endereco: dito("rts-apos-inv").endereco, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "a ruta debe parar na fronteira de 0x14", citacao: CITA.sitios },
      { endereco: ctrl.endereco, esperado_veredito: "instrucao-de-bloco", motivo: "controle positivo", citacao: CITA.sitios },
    ],
    controle_positivo: { endereco: ctrl.endereco, esperado: { tam: ctrl.tam, stems: [talo(ctrl.instrumento.mnemonico)] }, sondeo: ctrl.instrumento },
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: r.sitio - BASE, tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico, rol: r.sonda.rol ?? "sonda" })),
    cobertura_esperada_bytes: {
      primaria: ctrl.tam,
      variante_fronteiras_contan_como_decodificadas: ctrl.tam + lf.tam + inv.tam,
      nota:
        "`primaria` = os 2 bytes do `rts` de controle. `lf.tam`/`inv.tam` son o ancho da palabra " +
        "que GAS emitiu (`.word`), non lonxitudes de instrución ditadas polo instrumento: a " +
        "variante só gradúa «a fronteira foi absorbida».",
    },
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc3,
    limites_de_autoria: [
      "`f200` e `1249` son palabras que emite `m68k-elf-as` (`.word`), non táboas escritas a man; " +
        "o instrumento non lles dá mnemónico, e iso é evidencia da recusa, non un oco da barra",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-ho4-v2 — KC4v-ho 4 + TCv-ho 4 (chamadas, área, erros e adulteración)
// ---------------------------------------------------------------------------

const HO4 = Object.freeze({
  origin: 0x3000,
  moveq: 0x3000,
  jsrw: 0x3002,
  jmpin: 0x3006,
  indexado: 0x300c,
  alvo: 0x3010,
  jsrind: 0x3014,
  trap: 0x3016,
  fim: 0x3018,
});

export function buildHO4({ inst, dir }) {
  const s = (n) => HO4.origin + BASE - HO4.origin + (HO4[n] - HO4.origin) + BASE - BASE;
  const sitio = (n) => BASE + (HO4[n] - HO4.origin);
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-ho4-v2",
    nops: 0,
    inst,
    sondas: [
      { rotulo: "moveq", texto: "moveq #-1,%d7", sep: 0, sitioFixo: sitio("moveq") },
      { rotulo: "jsrw", texto: "jsr (0x3010).w", sep: 0, sitioFixo: sitio("jsrw") },
      { rotulo: "jmpin", texto: "jmp (0x300c).l", sep: 0, sitioFixo: sitio("jmpin") },
      { rotulo: "indexado", texto: "move.l 0(%a0,%a1.l),%d2", sep: 0, sitioFixo: sitio("indexado") },
      { rotulo: "alvo", texto: "move.b (0x1234).w,%d5", sep: 0, sitioFixo: sitio("alvo") },
      { rotulo: "jsrind", texto: "jsr (%a1)", sep: 0, sitioFixo: sitio("jsrind") },
      { rotulo: "trap", texto: "trap #15", sep: 0, sitioFixo: sitio("trap") },
    ],
  });
  controlarSolapamento(montado.sondas);
  void s;
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const lon = HO4.fim - HO4.origin;
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon, recheo: 0xff });
  const dito = (n) => {
    const r = porNome.get(n);
    return { endereco: HO4.origin + (r.sitio - BASE), bytes: r.bytes.toUpperCase(), tam: r.lonxitude, instrumento: { mnemonico: r.mnemonico, ea: r.ea, desmontaxe: r.desmontaxe } };
  };
  const alvoNasBytes = (hex, off = 2) => Number(`0x${hex.slice(off * 2, off * 2 + 8)}`);
  const moveq = dito("moveq"), jsrw = dito("jsrw"), jmpin = dito("jmpin"), indexado = dito("indexado"), alvo = dito("alvo"), jsrind = dito("jsrind"), trap = dito("trap");
  // `jsr (0x3010).w` codifica 16 bits: o alvo lése do word, non da longword.
  const alvoJsr = Number(`0x${jsrw.bytes.slice(4, 8)}`);
  const alvoJmp = alvoNasBytes(jmpin.bytes);
  if (alvoJsr !== HO4.alvo) throw new Error(`dC-ho4-v2: GAS codificou ${HEX(alvoJsr)} en vez de ${HEX(HO4.alvo)}`);
  if (alvoJmp !== HO4.indexado) throw new Error(`dC-ho4-v2: jmp codificou ${HEX(alvoJmp)}, esperado ${HEX(HO4.indexado)}`);
  if (jsrw.instrumento.ea !== null && jsrw.instrumento.ea !== HO4.alvo) {
    throw new Error(`dC-ho4-v2: objdump di ${HEX(jsrw.instrumento.ea)} para o jsr, bytes ${HEX(alvoJsr)}`);
  }

  const kc4 = [
    {
      ...meta(),
      id: "HO-KC4-jsr-abs-w-intra",
      endereco: jsrw.endereco,
      bytes: jsrw.bytes,
      esperado: { origem: jsrw.endereco, alvo: HO4.alvo, status: "resolvido", derivado: "dentro-de-fluxo" },
      citacao_C: CITA.fluxo + "; " + CITA.regra_raiz,
      statico: "aresta_de_chamada: alvo dentro da rexión ⇒ raíz derivada e bloco analizado",
      sondeo: { ...jsrw.instrumento, alvo_nos_bytes: HEX(alvoJsr) },
      nota: "modo `abs.W` de JSR: a medición só exercitou `abs.L` (`KC4-jsr-abs-l-intra`)",
    },
    {
      ...meta(),
      id: "HO-KC4-jmp-abs-l-intra",
      endereco: jmpin.endereco,
      bytes: jmpin.bytes,
      esperado: { origem: jmpin.endereco, alvo: HO4.indexado, status: "resolvido", derivado: "dentro-de-fluxo" },
      citacao_C: CITA.fluxo + "; " + CITA.regra_raiz,
      statico: "aresta_de_jmp: dentro da rexión ⇒ o alvo analízase como bloque",
      sondeo: { ...jmpin.instrumento, alvo_nos_bytes: HEX(alvoJmp) },
      nota: "a medición graduou `JMP abs.L` **fóra** da rexión (`KC4-jmp-abs-l-extra`); aquí o alvo é intra-rexión",
    },
    {
      ...meta(),
      id: "HO-KC4-jsr-ind-an",
      endereco: jsrind.endereco,
      bytes: jsrind.bytes,
      esperado: { fronteira: "indirect-opaco", alvo: null, endereco: jsrind.endereco },
      citacao_C: CITA.fluxo,
      statico: "JSR con modo ≠ abs ⇒ fronteira indirecta, `target: null`",
      sondeo: jsrind.instrumento,
      nota: "`JSR (An)` indirecto; a medición usou `JMP (A2)`",
    },
    {
      ...meta(),
      id: "HO-KC4-trap-15",
      endereco: trap.endereco,
      bytes: trap.bytes,
      esperado: { fronteira: "trap-opaco", endereco: trap.endereco },
      citacao_C: CITA.fluxo_rt,
      sondeo: trap.instrumento,
      nota: "`TRAP #15` (`4E4F`); a medición usou `TRAP #4` (`4E44`)",
    },
  ];

  const tc = [
    {
      ...meta(),
      id: "HO-TC-1",
      capacidade: "TCv",
      probe: "cli",
      acao: { tipo: "cli", flag: "proveniencia", valor: "procedencia-descoñecida" },
      esperado_rc: 2,
      motivo: "§2: «proveniência fora do vocabulário = erro» — outro token fóra do vocabulario pechado (a medición usou `oraculo-externo`)",
    },
    {
      ...meta(),
      id: "HO-TC-2",
      capacidade: "TCv",
      probe: "consultar-flag",
      acao: { tipo: "consultar-flag", flag: "--region-prov", valor: "regiao-autoral-D" },
      esperado_rc: 2,
      esperado: { rc: 2, export_gravado: false },
      motivo: "§2.1: en `consultar`, `--region-prov` **é erro de uso (código 2), non unha flag ignorada** — requisito 7: os códigos de saída re-gradúanse contra o contrato vixente en `8ea5821`",
    },
    {
      ...meta(),
      id: "HO-TC-3",
      capacidade: "TCv",
      probe: "site",
      acao: { tipo: "site", endereco: HO4.indexado + 1 },
      esperado: { veredito: "miolo-de-instrucao" },
      motivo: `${HEX(HO4.indexado)} é move.l d8(A0,A1.L),D2 (${indexado.tam} B); ${HEX(HO4.indexado + 1)} é miolo`,
    },
    {
      ...meta(),
      id: "HO-TC-4",
      capacidade: "TCv",
      probe: "xor-byte-imagem",
      acao: { tipo: "xor-byte-imagem", offset_na_arquivo: moveq.endereco - HO4.origin, valor: 0x7e ^ 0xf0 },
      esperado: {
        endereco_mutado: moveq.endereco,
        bytes_antes: moveq.bytes,
        bytes_depois: "F0FF",
        delta_cobertura_bytes: 2,
        downstream: { endereco: HO4.indexado, tam: indexado.tam },
        variante_illada: { raiz_extra: { endereco: HO4.jsrw, proveniencia: "candidato", evidencia: "variante illada (§12.9: sen ela a receita mide alcançabilidade, non lonxitude)" } },
        invariantes: [
          `o export reporta fronteira en ${HEX(moveq.endereco)} co opcode f0ff`,
          "a instrución en 0x3000 deixa de constar como decodificada",
          `o resto do bloque (0x3002..) mantén os comprimentos ditados polo instrumento (jsr.w ${jsrw.tam}, jmp ${jmpin.tam}, indexado ${indexado.tam}, alvo ${alvo.tam}, jsrind ${jsrind.tam}, trap ${trap.tam})`,
        ],
      },
      motivo: "sonda de mutación noutro sitio e con outra palabra (liña-F `f0ff` en vez de `f000`)",
    },
  ];

  const truth = {
    id: "dC-ho4-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs",
    origin: HO4.origin,
    regioes: [{ inicio: HO4.moveq, fim: HO4.fim }],
    raizes: [
      { endereco: moveq.endereco, proveniencia: "candidato", evidencia: "entrada autoral" },
      { endereco: trap.endereco, proveniencia: "referencia-estatica", evidencia: "sonda de trap illada" },
    ],
    sitios: [
      { endereco: HO4.indexado, esperado_veredito: "instrucao-de-bloco", motivo: "alvo do jmp intra-rexión: raíz derivada", citacao: CITA.regra_raiz },
      { endereco: 0x12345678, esperado_veredito: "fora-da-regiao", motivo: "alvo do jsr (0x1234).w montado en 0x3010", citacao: CITA.sitios },
    ],
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: HO4.origin + (r.sitio - BASE), tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico })),
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    cobertura_esperada_bytes: {
      primaria: moveq.tam + jsrw.tam + jmpin.tam + indexado.tam + alvo.tam,
      variante_fronteiras_contan_como_decodificadas: moveq.tam + jsrw.tam + jmpin.tam + indexado.tam + alvo.tam + jsrind.tam + trap.tam,
      nota:
        "`primaria` = Σ dos cinco bloques que §3 espera decodificados; `jsr (%a1)` e `trap #15` " +
        "reportan veredito pero non bytes.",
    },
    kc4,
    kc2_indexado: {
      ...meta(),
      id: "HO-KC2v-indexado",
      endereco: indexado.endereco,
      bytes: indexado.bytes,
      esperado: { tam: indexado.tam, origem: "d8(A0,A1.L)", destino: "D2" },
      comprobacion: { origem: "a0@\\(", destino: "%d2\\s*$" },
      citacao_C: CITA.lista_move,
      nota: "fila de invariantes do TC-4; executa-se sobre esta imaxe",
    },
    tc,
    limites_de_autoria: [
      "os bytes das chamadas e dos saltos codifícaos GAS cos sufixos `.w`/`.l` explícitos; o alvo " +
        "léese da palabra que o propio GAS emitiu e crúzase co que imprime o desmontador",
      "o recheo da imaxe é 0xFF (`0000` decodifica como `ori.b #imm,Dn`, que está na lista de §3)",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// Disxunción coa medición: ningunha palabra nin (sitio,bytes) repetida
// ---------------------------------------------------------------------------

export function bytesDaMedicion() {
  const palabras = new Set();
  const rotas = new Set();
  for (const fix of ["dC-cx1", "dC-cx2", "dC-cx3", "dC-cx4"]) {
    const t = JSON.parse(fs.readFileSync(path.join(DATA_C, `${fix}-truth-v2.json`), "utf8"));
    for (const q of t.sequencia ?? []) {
      // Non se filtra nada do lado da medición: todas as palabras que alí se
      // montaron (controles incluídos) entran no conxunto comparado. A exclusión
      // só existe no lado do holdout e está publicada como `controles_compartidos`.
      const b = String(q.bytes).toUpperCase();
      palabras.add(b);
      rotas.add(`${fix}:${q.endereco}:${b}`);
    }
  }
  return { palabras, rotas };
}

/**
 * Porta de xeneralización: ningunha palabra que no holdout sustenta unha fila
 * graduada (KC*v / TCv) pode ser unha palabra xa medida en `dC-cx*-v2`, e dentro
 * do propio holdout dous sítios graduados non poden compartir bytes nin sitio.
 * Unha falla lanza: o adaptador non chega a executar C.
 */
export function comprobarDisxuncion(truths) {
  const { palabras } = bytesDaMedicion();
  const repetidas = [];
  const controlos = [];
  const vistas = new Map();
  let graduadas = 0;
  for (const [id, t] of Object.entries(truths)) {
    const sitios = new Set();
    for (const q of t.sequencia ?? []) {
      const rotulo = q.rotulo ?? q.id;
      if (q.rol === "controle") {
        controlos.push(`${id}/${rotulo}:${HEX(q.endereco)}`);
        continue;
      }
      graduadas += 1;
      const b = String(q.bytes).toUpperCase();
      if (palabras.has(b)) repetidas.push(`${id}/${rotulo}: bytes ${b} xa medidos na medición`);
      const clave = `${id}:${q.endereco}`;
      if (sitios.has(clave)) repetidas.push(`${id}/${rotulo}: sítio ${HEX(q.endereco)} duplicado dentro do holdout`);
      sitios.add(clave);
      const antes = vistas.get(b);
      if (antes) repetidas.push(`${id}/${rotulo}: bytes ${b} repetidos en ${antes}`);
      else vistas.set(b, `${id}/${rotulo}`);
    }
  }
  if (repetidas.length) throw new Error(`holdout non disxunto da medición:\n  ${repetidas.join("\n  ")}`);
  return {
    criterio:
      "palabra a palabra: ningunha codificación que no holdout sustenta unha fila graduada " +
      "aparece nas sequencias graduadas de dC-cx1..cx4-v2; dentro do holdout tampouco se repite " +
      "ningunha palabra nin dous sítios graduados comparten bytes. As sondas con `rol: controle` " +
      "exclúense porque non afirman lonxitude nin mnemónico: son sentinelas de alcançabilidade.",
    filas_graduadas: graduadas,
    palabras_unicas: vistas.size,
    controles_compartidos: controlos,
  };
}

// ---------------------------------------------------------------------------
// Xerado, pins e respostas reservadas
// ---------------------------------------------------------------------------

const Nomes = {
  "dC-ho1": { img: "dC-ho1-v2.bin", truth: "dC-ho1-respostas.json", build: buildHO1 },
  "dC-ho2": { img: "dC-ho2-v2.bin", truth: "dC-ho2-respostas.json", build: buildHO2 },
  "dC-ho3": { img: "dC-ho3-v2.bin", truth: "dC-ho3-respostas.json", build: buildHO3 },
  "dC-ho4": { img: "dC-ho4-v2.bin", truth: "dC-ho4-respostas.json", build: buildHO4 },
};

export const DENOMINADOR_HO = Object.freeze({
  partes: { KC1v: 18, KC2v: 4, KC3v: 2, KC4v: 4, KC5v: 5, TCv: 4 },
  total: 37,
  nota:
    "§12.13 conxela este denominador **antes** de executar C sobre o holdout. As partes son as " +
    "mesmas capacidades da medición cunhas formas disxuntas: `KC1v` 18 (14 da lista fechada en " +
    "familias que a medición non tocaba + 3 fóra da lista + 1 de coherencia), `KC2v` 4 (desprazamentos " +
    ".B e laço DBcc .W), `KC3v` 2 (fronteiras `f200`/`1249`), `KC4v` 4 (JSR abs.W, JMP abs.L " +
    "intra-rexión, JSR indirecto, TRAP #15), `KC5v` 5 (diamante, BRA sen caída, RTS, cobertura, " +
    "vereditos) e `TCv` 4 (rc de vocabulario, rc de flag inexistente en `consultar`, sítio, " +
    "mutación de byte). Ningunha destas filas entrou no denominador conxelado de §3/§5 da medición.",
});

export function contarFilasHO(truths) {
  return {
    KC1v: truths["dC-ho1"].kc1.length,
    KC2v: truths["dC-ho2"].kc2.length,
    KC3v: truths["dC-ho3"].kc3.length,
    KC4v: truths["dC-ho4"].kc4.length,
    KC5v: truths["dC-ho2"].kc5.length,
    TCv: truths["dC-ho4"].tc.length,
  };
}

export function gravarHoldoutC({ dir = DATA_HO, respostas = RESPOSTAS_DIR, seedDir = null } = {}) {
  const inst = instrumento();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(respostas, { recursive: true });
  const traballo = fs.mkdtempSync(seedDir ?? path.join(process.env.HOME, "rds-scratch/d-author-ho-c-"));
  const truths = {};
  const arquivos = {};
  const respostas_pin = {};
  for (const [id, { img: nomeImg, truth: nomeResp, build }] of Object.entries(Nomes)) {
    const { img, truth } = build({ inst, dir: path.join(traballo, id) });
    truths[id] = truth;
    const pImg = path.join(dir, nomeImg);
    fs.writeFileSync(pImg, img);
    arquivos[nomeImg] = { sha256: sha256(img), bytes: img.length };
    const texto = `${JSON.stringify(truth, null, 2)}\n`;
    fs.writeFileSync(path.join(respostas, nomeResp), texto);
    respostas_pin[nomeResp] = { sha256: sha256(Buffer.from(texto)), bytes: Buffer.byteLength(texto) };
  }

  const disxuncion = comprobarDisxuncion(truths);
  const partes = contarFilasHO(truths);
  for (const [k, v] of Object.entries(partes)) {
    if (v !== DENOMINADOR_HO.partes[k]) throw new Error(`denominador holdout ${k}: conxelado en ${DENOMINADOR_HO.partes[k]}, contado ${v}`);
  }
  const total = Object.values(partes).reduce((a, b) => a + b, 0);
  if (total !== DENOMINADOR_HO.total) throw new Error(`denominador holdout total: ${total} ≠ ${DENOMINADOR_HO.total}`);

  const pin = {
    esquema: "rex-parallel-d/holdout-pin/3",
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_c_v2.mjs",
    gabarito: GABARITO,
    contrato: CONTRATO,
    conxunto: "holdout",
    fronte: "C",
    sha_medido: PIN.C_novo,
    politica:
      "inputs públicos versionados; respostas reservadas fóra da árbore e pinadas por SHA. O " +
      "holdout `cbb6895` da rolda 2 non se reutiliza (R17) e ningunha resposta se edita despois " +
      "de executar a ferramenta (R0).",
    respostas_fora_da_arvore: respostas,
    denominador: { partes, total, nota: DENOMINADOR_HO.nota },
    disxuncion: {
      criterio: disxuncion.criterio,
      filas_graduadas: disxuncion.filas_graduadas,
      palabras_unicas: disxuncion.palabras_unicas,
      controles_compartidos: disxuncion.controles_compartidos,
      fixtures_medicion: ["dC-cx1-v2", "dC-cx2-v2", "dC-cx3-v2", "dC-cx4-v2"],
    },
    instrumento: {
      version: inst.version,
      bandeira: inst.bandeira,
      sha256_as: inst.sha256_as,
      sha256_objdump: inst.sha256_objdump,
      filas_sha256: inst.filas_sha256,
      gabarito_sha256: inst.gabarito_sha256,
    },
    arquivos,
    respostas: respostas_pin,
  };
  const pPin = path.join(dir, "pin-holdout-c-v2.json");
  fs.writeFileSync(pPin, `${JSON.stringify(pin, null, 2)}\n`);
  fs.rmSync(traballo, { recursive: true, force: true });
  return { truths, pin, dir, respostas, pPin };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarHoldoutC();
  for (const [nome, info] of Object.entries(r.pin.arquivos)) {
    console.log(`${nome.padEnd(18)} ${String(info.bytes).padStart(5)} B  ${info.sha256.slice(0, 16)}…`);
  }
  console.log(`[holdout C] respostas reservadas en ${r.respostas}`);
  for (const [nome, info] of Object.entries(r.pin.respostas)) {
    console.log(`  ${nome.padEnd(26)} ${String(info.bytes).padStart(6)} B  ${info.sha256.slice(0, 16)}…`);
  }
  console.log(`[holdout C] denominador: ${Object.entries(r.pin.denominador.partes).map(([k, v]) => `${k} ${v}`).join(" · ")} = ${r.pin.denominador.total}`);
}
