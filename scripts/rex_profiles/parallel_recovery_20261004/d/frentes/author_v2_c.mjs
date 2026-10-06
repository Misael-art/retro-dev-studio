#!/usr/bin/env node
/**
 * Autor das fixtures v2 da fronte C (barra D, rolda 3).
 *
 * Diferenza contra `author_frentes.mjs` (v1): ningún byte 68000 está escrito a
 * man. Cada sonda codifícaa `m68k-elf-as -m68000` e o talo de lonxitude,
 * mnemónico e enderezo efectivo é o que devolve `m68k-elf-objdump`, cos binarios
 * que fixa `gabarito/isa-oraculo-v2.json` (R14). As imaxes colócanse grupo a
 * grupo desde a saída do montador, así que os ocos son os separadores `4e71` que
 * GAS emitiu e non recheo do autor (defecto propio (g)(1) de v2).
 *
 * Os vereditos e o vocabulario de fronteira escríbense coas palabras **de C**
 * (`grafo.rs`, `decode.rs`), non cunha tradución propia: a normalización de
 * vocabulario só ocorre no adaptador (R13). Cada fila declara `gabarito` e
 * `contrato` (R15) e cita a liña de `CONTRACT.md` §3 que a ancora.
 *
 * As fixtures v1 non se re-xeran nin se tocan (§12.7).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { montarSondas, controlarSolapamento, instrumento, sha256, RAIZ } from "./montador.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DATA_C = path.join(
  RAIZ,
  "data/rex_profiles/parallel_recovery_20261004/d/frentes/c",
);

export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v2";

/** Base do bloque montado. Con `base: 0` GAS colapsa `inicio:` coa primeira
 *  sonda e o desmontador non devolve o seu símbolo: o bloque monta-se desprazado
 *  e a imaxe guarda enderezos = `sitio montado − BASE`. */
const BASE = 0x100;

const HEX = (n, w = 4) => `0x${n.toString(16).padStart(w, "0")}`;

/** Citas de `CONTRACT.md` §3 da propia fronte C (liñas lidas no build `275f2af`;
 *  o SHA medido `8ea5821` ha de relerse antes de medir — §12.10 j). */
const CITA = Object.freeze({
  lista_move:
    "§3 liñas 77-79: «`MOVE`/`MOVEA` .B/.W/.L entre modos 68000 válidos (registros, " +
    "`(An)`, `(An)+`, `-(An)`, `d16(An)`, `d8(An,Xn)`, `abs.W`, `abs.L`, `#imm` só em MOVE)»",
  fonte_pc:
    "§3 liñas 77-79: os modos listados para MOVE **non** inclúen `d16(PC)`; " +
    "liñas 97-98: «Qualquer outro opcode, forma estendida 68010+ ou combinación inválida " +
    "detectábel ⇒ `frontier(kind=\"opcode-fora-do-subconjunto\", opcode, endereco)`»",
  inm_inmediato:
    "§3 liñas 78-79: «`#imm` só em MOVE» ⇒MOVEA con inmediato está fóra da lista; " +
    "frase de peche liñas 99-100: «A tabela exata de (máscara, valor, consumo de extensão) " +
    "vive em `src/decode.rs` e é a única fonte; este documento lista as famílias» (§12.10 h e j)",
  combinacion:
    "§3 liña 79: «combinações inválidas (p. ex. MOVE.W → An) = fronteira» — exercida no " +
    "tamaño `.B`, que é a única forma que a ISA distingue (§12.10 i); código: " +
    "`decode.rs:605-609` `out(op, \"MOVEA.B invalido\")`",
  liña_f:
    "§3 liñas 97-98 (regra de peche): na lista de §3 non hai ningunha familia de " +
    "liña-F, polo que calquera palabra que non case coas familias enumeradas ⇒ " +
    "`opcode-fora-do-subconjunto`; código: catch-all `decode.rs:474`",
  fluxo:
    "§3 liñas 88-90: «Fluxo: `BRA`/`BSR`/`Bcc` (todas as 16 condicións) `.S/.W`; " +
    "`JMP`/`JSR` `abs.W`, `abs.L` (alvo comprovado) — demais modos … indiretos = " +
    "fronteira `indirect-opaque`»",
  desprazamento:
    "§2 liñas 67-71: «Deslocamento relativo de Bcc/BSR/DBcc é sempre relativo ao primeiro " +
    "word de extensão (`endereço_da_instrução + 2`), semante 68000»",
  indexado: "§3 liña 78: modo `d8(An,Xn)` dentro da lista",
  movem: "§3 liña 93: «`MOVEM` .W/.L com lista de registradores de 1 word (4 bytes)»",
  bits: "§3 liña 85: «`BTST/BCHG/BCLR` #imm,ea»",
  scc: "§3 liña 87: «`Scc` ea.Dn; `DBcc` Dn com disp8»",
  unarios: "§3 liña 82: «`MOVEQ`, `CLR`, `NEG`, `NOT`, `TST`, `SWAP`, `CHK`»",
  aritmetica: "§3 liña 81: «`ADDQ`/`SUBQ` #q,ea; `ADD`/`SUB`/`CMP` formas registradas e gerais»",
  sr_dn: "§3 liña 95: «`MOVE SR→Dn` (`0x40C0+reg` e variantes .W comprovadas em fixture)»",
  chamada_abs: "§3 liñas 88-90: `JMP`/`JSR` `abs.L` con alvo comprovado",
  trap: "§3 liña 92: «`TRAP #n` (fronteira `trap-opaco`)»",
  lea_pea: "§3 liña 80: «`LEA`, `PEA` (modos de memória, sem imediato)»",
  rts: "§3 liña 91: «`RTS` (terminador de retorno); `NOP`»",
  aresta_queda:
    "§4 liña 113: «`arestas: [{origem, alvo, tipo: queda|desvio|chamada|retorno-fronteira, …}]`» " +
    "— o desvío non elimina a caída",
  aresta_status:
    "§4 liñas 113-114: «`tipo: queda|desvio|chamada|retorno-fronteira`» e " +
    "«`status: resolvido|fora-da-regiao|indireto-opaco|armadilha`»",
  raiz_derivada:
    "§4 regra 4, liñas 136-138: «Chamada com alvo dentro da região cria raiz derivada " +
    "`dentro-de-fluxo` e o alvo é analisado como bloco; chamada com alvo fora da região termina " +
    "como aresta `fora-da-regiao` sem decodificar nada fora»",
  vereditos:
    "§4 liñas 120-122: «`sitios: [{endereco, veredito: instrucao-de-bloco|miolo-de-instrucao|" +
    "dentro-regiao-nao-alcancado|fora-da-regiao|ponto-de-fronteira, bloco|nulo}]`» e regra 2, " +
    "liñas 130-132",
  cobertura:
    "§4 liñas 118-119 (`cobertura: {bytes-decodificados, bytes-regiao, fracao, vaoes}`) e regra 1, " +
    "liñas 128-129: «`cobertura` é soma dos comprimentos, não extensão de bounding box»",
  miolo:
    "§4 regra 2, liñas 130-132: `miolo-de-instrucao` para sítio que cai dentro dos bytes de uma " +
    "instrución decodificada; §6 liñas 165-167: o veredito proba que ali o casamento linear " +
    "**non** é inicio de instrución deste fluxo",
});

/** Formas de KC1v: 21 (§12.3 + §12.10 h). `dominio` separa os dous eixos de (h). */
const KC1_FORMAS = [
  { rotulo: "k1-01", texto: "move.b (%a0)+,%d1", id: "KC1v-move-b-a0p-d1", forma: "move.b (A0)+,D1", citacao: CITA.lista_move },
  { rotulo: "k1-02", texto: "move.b -(%a2),%d3", id: "KC1v-move-b-a2m-d3", forma: "move.b -(A2),D3", citacao: CITA.lista_move },
  { rotulo: "k1-03", texto: "move.b 16(%a1),%d2", id: "KC1v-move-b-d16a1-d2", forma: "move.b d16(A1),D2", citacao: CITA.lista_move },
  { rotulo: "k1-04", texto: "move.w (%a3),%d6", id: "KC1v-move-w-a3-d6", forma: "move.w (A3),D6", citacao: CITA.lista_move },
  {
    rotulo: "k1-05",
    texto: "move.l 32(%pc),%d0",
    id: "KC1v-move-l-d16pc-d0",
    forma: "move.l d16(PC),D0",
    dominio: "fora-do-subconjunto-de-C",
    citacao: CITA.fonte_pc,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
  },
  { rotulo: "k1-06", texto: "move.l #0x3333,%d4", id: "KC1v-move-l-imm-d4", forma: "move.l #imm32,D4", citacao: CITA.lista_move },
  {
    rotulo: "k1-07",
    texto: "movea.l #0x1111,%a1",
    id: "KC1v-movea-l-imm-a1",
    forma: "movea.l #imm32,A1",
    dominio: "coherencia-contrato-codigo",
    citacao: CITA.inm_inmediato,
    esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto" },
    nota:
      "§12.10 h conxelou a expectativa de fronteira (a lista de §3 non admite inmediato en " +
      "MOVEA). §12.10 j re-etiqueta o eixe: se a ferramenta decodifica, a fila publícase " +
      "`falha` en `coherencia-contrato-código`, non como falla da maquinaria de fronteiras.",
  },
  {
    rotulo: "k1-08",
    texto: "movea.l (%a0)+,%a3",
    id: "KC1v-movea-l-a0p-a3",
    forma: "movea.l (A0)+,A3",
    citacao: CITA.lista_move,
    nota:
      "corrección de **nombre**, non de bytes: v1 escribía `move.l (%a0)+,%a3` e GAS acepta ambas " +
      "grafías para a mesma palabra `2658` (comprobado co instrumento pinado: `movea.l (%a0)+,%a3` " +
      "→ `2658`, `move.l (%a0)+,%a3` → `2658`). No layout de bits, MOVEA é o grupo MOVE con modo " +
      "de destino `%001` (An) e tamaño `%10` (.L) / `%11` (.W); polo tanto `2658` é MOVEA.L lexítima " +
      "e está DENTRO da lista de §3. A combinación inválida é o tamaño `.B` (`01` + An), que é a " +
      "fila `KC3v-move-b-para-an` de `dC-cx3-v2` (§12.10 i).",
  },
  { rotulo: "k1-09", texto: "movea.w %a0,%a1", id: "KC1v-movea-w-a0-a1", forma: "movea.w A0,A1", citacao: CITA.lista_move, nota: "fila engadida en §12.10 h: rexistro→An está DENTRO da lista; a expectativa é decodificación de 2 bytes, non recusa" },
  { rotulo: "k1-10", texto: "moveq #15,%d4", id: "KC1v-moveq-15-d4", forma: "moveq #15,D4", citacao: CITA.unarios },
  { rotulo: "k1-11", texto: "move.w %sr,%d6", id: "KC1v-move-w-sr-d6", forma: "move.w SR,D6", citacao: CITA.sr_dn },
  { rotulo: "k1-12", texto: "addq.b #4,(%a3)", id: "KC1v-addq-b-4-a3", forma: "addq.b #4,(A3)", citacao: CITA.aritmetica },
  { rotulo: "k1-13", texto: "addq.w #1,%d3", id: "KC1v-addq-w-1-d3", forma: "addq.w #1,D3", citacao: CITA.aritmetica },
  { rotulo: "k1-14", texto: "add.l %d2,(%a1)", id: "KC1v-add-l-d2-a1", forma: "add.l D2,(A1)", citacao: CITA.aritmetica },
  { rotulo: "k1-15", texto: "cmp.w (%a2),%d0", id: "KC1v-cmp-w-a2-d0", forma: "cmp.w (A2),D0", citacao: CITA.aritmetica },
  { rotulo: "k1-16", texto: "tst.w (0xa1000c).l", id: "KC1v-tst-w-abs-l", forma: "tst.w abs.L", citacao: CITA.unarios },
  {
    rotulo: "k1-17",
    texto: "bclr #2,(%a1)",
    id: "KC1v-bclr-2-a1",
    forma: "bclr #2,(A1)",
    citacao: CITA.bits,
    stems_extra: ["bic", "bittest"],
    nota: "v1 xa declaraba tolerancia de mnemónico para a familia BIT (#imm,ea)",
  },
  {
    rotulo: "k1-18",
    texto: "seq %d1",
    id: "KC1v-seq-d1",
    forma: "seq D1",
    citacao: CITA.scc,
    stems_extra: ["scc", "shs", "stt", "sf"],
    nota:
      "familia Scc: D gradúa o comprimento (2 B); non existe nesta host gravación obxectiva " +
      "que ancore o talo Scc (r1/r2-objdump só ancóran DBcc 51c8..51ce), así que o mnemónico " +
      "tolerado é declaración de limitación, non afirme de C",
  },
  {
    rotulo: "k1-19",
    texto: "movem.w (%a5)+,%d5-%d7",
    id: "KC1v-movem-w-a5p-d5-d7",
    forma: "movem.w (A5)+,D5-D7",
    citacao: CITA.movem,
    stems_extra: ["movem"],
    nota: "C soporta MOVEM só para comprimento; o talo instrumental é `movemw`",
  },
  { rotulo: "k1-20", texto: "lea (0x2020).l,%a0", id: "KC1v-lea-abs-l-a0", forma: "lea abs.L,A0", citacao: CITA.lea_pea },
  { rotulo: "k1-21", texto: "lea 64(%pc),%a5", id: "KC1v-lea-d16pc-a5", forma: "lea d16(PC),A5", citacao: CITA.lea_pea + " — `d16(PC)` é modo de memoria e a lista non o exclúe; código: `decode.rs:727-729` só recusa o modo 7 con campo ≥ 4 (inmediato/reservado)" },
];

/**
 * Coloca cada grupo do `.text` montado na imaxe, en coordenadas de arquivo
 * (`direccion − base`). Rexeita solapamentos e desbordamentos.
 */
export function imaxeDesdeGrupos({ grupos, base = BASE, lon, recheo = 0xff }) {
  const img = Buffer.alloc(lon, recheo);
  const postas = [];
  for (const g of grupos) {
    const hex = g.liñas.map((l) => l.bytes).join("");
    if (!hex) continue;
    const buf = Buffer.from(hex, "hex");
    const onde = g.direccion - base;
    if (onde < 0 || onde + buf.length > lon) {
      throw new Error(`grupo fóra da imaxe: ${g.rotulo} @${HEX(g.direccion)} (lon ${lon})`);
    }
    for (const p of postas) {
      if (onde < p.onde + p.buf.length && p.onde < onde + buf.length) {
        throw new Error(`colocación solapada: ${g.rotulo} pisa ${p.rotulo}`);
      }
    }
    buf.copy(img, onde);
    postas.push({ onde, buf, rotulo: g.rotulo, lonxitude: buf.length });
  }
  return { img, postas };
}

const meta = () => ({ gabarito: GABARITO, contrato: CONTRATO });

const talo = (mnemonico) => String(mnemonico).split(/[\s(]/)[0].toLowerCase();

/** Fila de KC1v a partir do ditame do instrumento. */
function filaKc1(r, forma) {
  const stems = [talo(r.mnemonico), ...(forma.stems_extra ?? [])];
  const esperado = forma.esperado
    ? { ...forma.esperado, tam_instrumento: r.lonxitude }
    : { tam: r.lonxitude, stems };
  return {
    ...meta(),
    id: forma.id,
    forma: forma.forma,
    endereco: r.sitio - BASE,
    bytes: r.bytes.toUpperCase(),
    dominio: forma.dominio ?? "alegado-por-C",
    citacao_C: forma.citacao,
    espera_decodificacion: esperado.fronteira !== true,
    sondeo: {
      rotulo: r.rotulo,
      bytes: r.bytes.toUpperCase(),
      lonxitude: r.lonxitude,
      instrumento: { mnemonico: r.mnemonico, desmontaxe: r.desmontaxe },
    },
    esperado,
    esperado_instrumento: { tam: r.lonxitude, mnemonico: r.mnemonico },
    ...(forma.nota ? { nota: forma.nota } : {}),
  };
}

export function buildCX1V2({ inst, dir }) {
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-cx1-v2",
    nops: 0,
    inst,
    sondas: KC1_FORMAS.map((f) => ({ rotulo: f.rotulo, texto: f.texto, sep: 0 })),
  });
  controlarSolapamento(montado.sondas);

  const filas = montado.sondas.map((r) => ({ r, f: KC1_FORMAS.find((x) => x.rotulo === r.rotulo) }));
  // Secuencia contigua: o sitio de cada fila ten de ser a suma dos tamaños
  // anteriores (aritmética de D sobre bytes do instrumento).
  let acumulado = 0;
  for (const { r, f } of filas) {
    if (r.sitio - BASE !== acumulado) {
      throw new Error(`dC-cx1-v2: ${f.id} colocada en ${HEX(r.sitio - BASE)}, contigüidade dábala a ${HEX(acumulado)}`);
    }
    acumulado += r.lonxitude;
  }
  const fimInstrucoes = acumulado;
  const lon = 0x80;
  if (fimInstrucoes >= lon) throw new Error(`dC-cx1-v2: as sondas desbordan a rexión (${HEX(fimInstrucoes)})`);
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon, recheo: 0xff });

  const kc1 = filas.map(({ r, f }) => filaKc1(r, f));
  const fila4 = kc1.find((x) => x.id === "KC1v-move-b-d16a1-d2");
  const tam = (id) => kc1.find((x) => x.id === id).esperado_instrumento.tam;
  const coberturaPrimaria = kc1
    .filter((x) => x.espera_decodificacion)
    .reduce((s, x) => s + x.esperado_instrumento.tam, 0);
  // §12.10 j: `movea.l #imm` ten dúas lecturas coherentes co texto de C (a lista
  // de §3 di «#imm só em MOVE»; a cláusula de autoridade de §3 delega a táboa en
  // `decode.rs`). A cobertura acepta ambos os valores; o que se gradúa é o eixe
  // de coherencia, non a suma de bytes.
  const coberturaVariante = coberturaPrimaria + tam("KC1v-movea-l-imm-a1");
  const truth = {
    id: "dC-cx1-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2_c.mjs",
    regioes: [{ inicio: 0, fim: lon }],
    raizes: kc1.map((x) => ({
      endereco: x.endereco,
      proveniencia: "candidato",
      evidencia: `sonda KC1v ${x.id} (bytes de GAS)`,
    })),
    sitios: [
      { endereco: kc1[0].endereco, esperado_veredito: "instrucao-de-bloco", motivo: "entrada da secuencia", citacao: CITA.vereditos },
      { endereco: fila4.endereco + 2, esperado_veredito: "miolo-de-instrucao", motivo: `dentro de move.b d16(A1),D2 (${fila4.esperado_instrumento.tam} B en ${HEX(fila4.endereco)})`, citacao: CITA.miolo },
      { endereco: fimInstrucoes + 0x0e, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: `dentro do recheo 0xFF que comeza en ${HEX(fimInstrucoes)} (aritmética de D, non saída de C)`, citacao: CITA.vereditos },
    ],
    sequencia: kc1.map((x) => ({ id: x.id, endereco: x.endereco, tam: x.esperado_instrumento.tam, bytes: x.bytes })),
    fim_instrucoes: fimInstrucoes,
    cobertura_esperada_bytes: {
      primaria: coberturaPrimaria,
      variante_movea_l_imm_decodifica: coberturaVariante,
      nota:
        "primaria = Σ dos comprimentos ditados polo instrumento para as filas que esperan " +
        "decodificación; as dúas fronteiras (`d16(PC)` en MOVE e `movea.l #imm`) non suman. " +
        "`variante` é aceptable en cobertura: §12.10 j traslada a diverxencia ao eixe " +
        "`coherencia-contrato-codigo`, non ao de lonxitudes.",
    },
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc1,
    limites_de_autoria: [
      "ningún byte deste fixture ven do decodificador de C: cada palabra codifícaa " +
        "`m68k-elf-as -m68000` co pin de `isa-oraculo-v2` e o comprimento/mnemónico graduados " +
        "son o ditame de `m68k-elf-objdump` (R14)",
      "o recheo é 0xFF, non 0x00: `0000` decodifica como `ori.b #imm,Dn`, que está na lista de §3, " +
        "e a varredura tragaría o recheo byte a byte (corrección rexistrada en §12.9)",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-cx2-v2 — fluxo con desvios (KC2v local 5 + KC5v 5)
// ---------------------------------------------------------------------------

/** Sitios conxelados (offsets de arquivo = enderezos, `origin` 0). */
const CX2 = Object.freeze({
  moveq: 0x00,
  bcc: 0x02,
  nop: 0x06,
  bsr: 0x08,
  dbra: 0x0c,
  rts1: 0x10,
  rts2: 0x12,
  lon: 0x18,
});

export function buildCX2V2({ inst, dir }) {
  const s = (nome) => BASE + CX2[nome];
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-cx2-v2",
    nops: 0,
    inst,
    sondas: [
      { rotulo: "moveq", texto: "moveq #0,%d0", sep: 0, sitioFixo: s("moveq") },
      { rotulo: "bcc", texto: () => "bcc.w p_moveq_rts1", sep: 0, sitioFixo: s("bcc"), alvo: s("rts1") },
      { rotulo: "nop", texto: "nop", sep: 0, sitioFixo: s("nop") },
      { rotulo: "bsr", texto: () => "bsr.w p_rts2", sep: 0, sitioFixo: s("bsr"), alvo: s("rts2") },
      { rotulo: "dbra", texto: () => "dbra %d0,p_dbra", sep: 0, sitioFixo: s("dbra"), alvo: s("dbra") },
      { rotulo: "moveq_rts1", texto: "rts", sep: 0, sitioFixo: s("rts1") },
      { rotulo: "rts2", texto: "rts", sep: 0, sitioFixo: s("rts2") },
    ],
  });
  controlarSolapamento(montado.sondas);
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon: CX2.lon, recheo: 0xff });

  const dito = (nome) => {
    const r = porNome.get(nome);
    if (!r) throw new Error(`dC-cx2-v2: sonda ausente ${nome}`);
    return {
      endereco: r.sitio - BASE,
      bytes: r.bytes.toUpperCase(),
      tam: r.lonxitude,
      instrumento: { mnemonico: r.mnemonico, ea: r.ea === null ? null : r.ea - BASE, desmontaxe: r.desmontaxe },
    };
  };
  const bcc = dito("bcc");
  const bsr = dito("bsr");
  const dbra = dito("dbra");

  const decodificados =
    bcc.tam + bsr.tam + dbra.tam + dito("moveq").tam + dito("nop").tam + dito("moveq_rts1").tam + dito("rts2").tam;

  const kc2 = [
    {
      ...meta(),
      id: "KC2v-base-bcc-w",
      endereco: bcc.endereco,
      bytes: bcc.bytes,
      esperado: { tam: bcc.tam, alvo: bcc.instrumento.ea, base: "sitio+2" },
      discriminante: `con base=sitio+4 o alvo calculado sería ${HEX(bcc.instrumento.ea + 2)}, non ${HEX(bcc.instrumento.ea)} (§12.3 KC2: «discriminador do erro histórico»)`,
      citacao_C: CITA.desprazamento,
      sondeo: bcc.instrumento,
    },
    {
      ...meta(),
      id: "KC2v-aresta-desvio",
      endereco: bcc.endereco,
      esperado: { tipo: "desvio", status: "resolvido", origem: bcc.endereco, alvo: bcc.instrumento.ea },
      citacao_C: CITA.aresta_status,
      sondeo: bcc.instrumento,
    },
    {
      ...meta(),
      id: "KC2v-bsr-w",
      endereco: bsr.endereco,
      bytes: bsr.bytes,
      esperado: { tam: bsr.tam, alvo: bsr.instrumento.ea, base: "sitio+2" },
      discriminante: `con base=sitio+4 o alvo sería ${HEX(bsr.instrumento.ea + 2)} (${HEX(bsr.instrumento.ea)} é o ditame do instrumento)`,
      citacao_C: CITA.fluxo,
      sondeo: bsr.instrumento,
    },
    {
      ...meta(),
      id: "KC2v-dbra-ext",
      endereco: dbra.endereco,
      bytes: dbra.bytes,
      esperado: { tam: dbra.tam, alvo: dbra.instrumento.ea, nota: `laço propio: GAS calcula disp = −2 e o desmontador dita o alvo ${HEX(dbra.endereco)}, que é o sitio conxelado da propia sonda` },
      citacao_C: CITA.scc,
      sondeo: dbra.instrumento,
    },
    {
      ...meta(),
      id: "KC2v-queda",
      endereco: bcc.endereco,
      esperado: { origem: bcc.endereco, sucessor_queda: dito("nop").endereco },
      citacao_C: CITA.aresta_queda + "; Bcc ten queda tras o desvío",
      sondeo: bcc.instrumento,
    },
    {
      ...meta(),
      id: "KC2v-indexado",
      endereco: null,
      esperado: { executa_em: "dC-cx4-v2", id_da_fila: "KC2v-indexado", nota: "a forma `d8(An,Xn)` mídese sobre a imaxe de dC-cx4-v2, que é onde a sonda precisa `JSR abs.L` intra-rexión a alcanza como raíz derivada" },
      citacao_C: CITA.indexado,
    },
  ];

  const kc5 = [
    {
      ...meta(),
      id: "KC5v-diamante",
      endereco: bcc.endereco,
      esperado: { ramos: 2, tipos: ["queda", "desvio"] },
      citacao_C: CITA.aresta_queda,
    },
    {
      ...meta(),
      id: "KC5v-queda-pos-condicional",
      endereco: bcc.endereco,
      esperado: { origem: bcc.endereco, alvo: dito("nop").endereco, tipo: "queda" },
      citacao_C: CITA.aresta_queda + "; o desvío non elimina a queda",
    },
    {
      ...meta(),
      id: "KC5v-rts-nao-continua",
      endereco: dito("moveq_rts1").endereco,
      esperado: { sucessores: 0, tipo: "retorno-fronteira" },
      discriminante: `se RTS continuase, existiría aresta ${HEX(dito("moveq_rts1").endereco)}→${HEX(dito("moveq_rts1").endereco + 2)}`,
      citacao_C: CITA.rts,
    },
    {
      ...meta(),
      id: "KC5v-cobertura",
      esperado: { bytes_decodificados: decodificados, bytes_regiao: CX2.lon },
      nota: "D recompón Σ dos comprimentos ditados polo instrumento; a string `fracao` de C non se gradúa",
      citacao_C: CITA.cobertura,
    },
    {
      ...meta(),
      id: "KC5v-vereditos",
      esperado: { miolo: bcc.endereco + 1, nao_alcancado: dito("rts2").endereco + 2 },
      motivo: `miolo dentro de bcc.w (${bcc.tam} B en ${HEX(bcc.endereco)}); ${HEX(dito("rts2").endereco + 2)} é o primeiro byte do recheo tras o último rts`,
      citacao_C: CITA.vereditos + "; " + CITA.miolo,
    },
  ];

  const truth = {
    id: "dC-cx2-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2_c.mjs",
    regioes: [{ inicio: 0, fim: CX2.lon }],
    raizes: [
      { endereco: dito("moveq").endereco, proveniencia: "candidato", evidencia: "entrada autoral do fluxo" },
      { endereco: dito("bsr").endereco, proveniencia: "candidato", evidencia: "raíz directa sobre a chamada: illa bsr.w do camiño lineal" },
    ],
    sitios: [
      { endereco: bcc.endereco + 1, esperado_veredito: "miolo-de-instrucao", motivo: `dentro de bcc.w (${bcc.tam} B en ${HEX(bcc.endereco)})`, citacao: CITA.miolo },
      { endereco: dito("rts2").endereco + 2, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: `recheo 0xFF tras o último rts (${HEX(dito("rts2").endereco)})`, citacao: CITA.vereditos },
    ],
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: r.sitio - BASE, tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico })),
    cobertura_esperada_bytes: decodificados,
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc2,
    kc5,
    limites_de_autoria: [
      "os deslocamentos non os calcula D: cada desvío refire un símbolo do propio bloque e GAS " +
        "codifica o desprazamento; `objdump` dita o enderezo efectivo que a fila espera (R14)",
      "a segunda raíz (bsr) é elección de D para illar eixos, non unha afirmación de C",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-cx3-v2 — fronteiras (KC3v 2, composición de §12.10 i)
// ---------------------------------------------------------------------------

const CX3 = Object.freeze({
  linhaF: 0x00,
  rts_apos_f: 0x02,
  moveBAn: 0x10,
  rts_apos_inv: 0x12,
  control: 0x30,
  lon: 0x40,
});

export function buildCX3V2({ inst, dir }) {
  const s = (n) => BASE + CX3[n];
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-cx3-v2",
    nops: 0,
    inst,
    sondas: [
      { rotulo: "linha-f", palabras: [0xf000], sep: 0, sitioFixo: s("linhaF") },
      { rotulo: "rts-apos-f", texto: "rts", sep: 0, sitioFixo: s("rts_apos_f") },
      { rotulo: "move-b-para-an", palabras: [0x1149], sep: 0, sitioFixo: s("moveBAn") },
      { rotulo: "rts-apos-inv", texto: "rts", sep: 0, sitioFixo: s("rts_apos_inv") },
      { rotulo: "control", texto: "rts", sep: 0, sitioFixo: s("control") },
    ],
  });
  controlarSolapamento(montado.sondas);
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon: CX3.lon, recheo: 0xff });
  const dito = (nome) => {
    const r = porNome.get(nome);
    return {
      endereco: r.sitio - BASE,
      bytes: r.bytes.toUpperCase(),
      tam: r.lonxitude,
      instrumento: { mnemonico: r.mnemonico, desmontaxe: r.desmontaxe },
    };
  };
  const lf = dito("linha-f");
  const inv = dito("move-b-para-an");

  const kc3 = [
    {
      ...meta(),
      id: "KC3v-linha-f",
      endereco: lf.endereco,
      opcode: lf.bytes,
      dominio: "fronteira-acordada",
      esperado: {
        fronteira: true,
        tipo: "opcode-fora-do-subconjunto",
        endereco: lf.endereco,
        nada_decodificado_ades: dito("rts-apos-f").endereco,
      },
      citacao_C: CITA.liña_f,
      statico: "classify sen ramo para %1111 → catch-all `decode.rs:474`; `out` constrúe `Frontier::fora(Some(op))` (`decode.rs:420-422`)",
      nota:
        "**sen afirmación de lonxitude**: o instrumento non lla dá (`Address 0x… is out of bounds.` " +
        "na súa propia desmontaxe), así que a fila mide sitio e tipo de fronteira e que a ruta para; " +
        "a afirmación `bytes_para: 2` de v1 retírase en §12.10 i",
      sondeo: lf.instrumento,
      control_de_discriminacion: {
        endereco: dito("rts-apos-f").endereco,
        bytes: dito("rts-apos-f").bytes,
        esperado_veredito: "dentro-regiao-nao-alcancado",
        motivo: "a sonda `rts` está na imaxe xusto despois da fronteira: se C continuase o camiño, " +
          "este sitio sería `instrucao-de-bloco` e a fila sería `falha`. A proba non é vacúa porque " +
          "os bytes están postos e son decodificábeis por si sós (raíz `control` en 0x30)",
      },
    },
    {
      ...meta(),
      id: "KC3v-move-b-para-an",
      endereco: inv.endereco,
      opcode: inv.bytes,
      dominio: "fronteira-acordada",
      esperado: {
        fronteira: true,
        tipo: "opcode-fora-do-subconjunto",
        endereco: inv.endereco,
        nada_decodificado_ades: dito("rts-apos-inv").endereco,
      },
      citacao_C: CITA.combinacion,
      statico: "decode_move → ramo MOVEA (`decode.rs:605-609`) → `out(op, \"MOVEA.B invalido\")`",
      nota:
        "restaura en v2 a clase «combinação inválida detectábel» que §12.6 tivo que retirar " +
        "(`327c` é MOVEA.W lexítima, non hai codificación propia). O `.B` si é unha combinación " +
        "que a ISA distingue: GAS monta a palabra e objdump recúsase a darlle mnemónico " +
        "(`.short 0x1149`). Denominador inalterado (§12.10 i).",
      sondeo: inv.instrumento,
      control_de_discriminacion: {
        endereco: dito("rts-apos-inv").endereco,
        bytes: dito("rts-apos-inv").bytes,
        esperado_veredito: "dentro-regiao-nao-alcancado",
      },
    },
  ];

  const truth = {
    id: "dC-cx3-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2_c.mjs",
    regioes: [{ inicio: 0, fim: CX3.lon }],
    raizes: [
      { endereco: lf.endereco, proveniencia: "candidato", evidencia: "sonda linha-F (palabra de GAS)" },
      { endereco: inv.endereco, proveniencia: "candidato", evidencia: "sonda MOVE.B→An (palabra de GAS)" },
      { endereco: dito("control").endereco, proveniencia: "candidato", evidencia: "controle positivo: un camiño limpo ten de decodificar" },
    ],
    sitios: [
      { endereco: dito("rts-apos-f").endereco, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "a ruta debe parar na fronteira de 0x00" },
      { endereco: dito("rts-apos-inv").endereco, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "a ruta debe parar na fronteira de 0x10" },
      { endereco: dito("control").endereco, esperado_veredito: "instrucao-de-bloco", motivo: "controle positivo" },
    ],
    controle_positivo: { endereco: dito("control").endereco, esperado: { tam: dito("control").tam, stems: [talo(dito("control").instrumento.mnemonico)] }, sondeo: dito("control").instrumento },
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: r.sitio - BASE, tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico })),
    cobertura_esperada_bytes: {
      primaria: dito("control").tam,
      variante_fronteiras_contan_como_decodificadas: dito("control").tam + lf.tam + inv.tam,
      nota:
        "`primaria` = os 2 bytes do `rts` de controle: as dúas sondas de fronteira non deben " +
        "decodificarse e a súa ruta debe parar ali. `lf.tam`/`inv.tam` son o tamaño da palabra " +
        "que GAS emitiu (`.word`), **non** unha lonxitude de instrución ditada polo instrumento: " +
        "a afirmación de lonxitude en `f000` está retirada (§12.10 i) e por iso a variante só " +
        "gradúa «a fronteira foi absorbida», nunca «a instrución mide N bytes».",
    },
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    kc3,
    filas_retiradas: [
      {
        id: "KC3-bsr-l-68020",
        opcode: "61ff",
        motivo: "§12.10 i: BSR.S está DENTRO da lista de §3 (liñas 88-90) e a lectura do byte depende da táboa de símbolos do desmontador (`bsrs` nun bloque, `bsrl` no obxecto dun só símbolo: §12.10 d). Non é afirmación ancorábel no byte.",
      },
    ],
    limites_de_autoria: [
      "`f000` e `1149` son palabras que emite `m68k-elf-as` (`.word`), non táboas escritas a man; " +
        "o instrumento non lles dá mnemónico, e iso é evidencia da recusa, non un oco da barra",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// dC-cx4-v2 — chamadas, área e controles de adulteración (KC4v 4 + TCv 4)
// ---------------------------------------------------------------------------

const CX4 = Object.freeze({
  origin: 0x2000,
  moveq: 0x2000,
  jsr: 0x2002,
  jmpfora: 0x2008,
  indexado: 0x2020,
  jmpind: 0x2024,
  trap: 0x2028,
  fim: 0x202c,
});

export function buildCX4V2({ inst, dir }) {
  const s = (n) => CX4[n] + BASE - CX4.origin;
  const montado = montarSondas({
    base: BASE,
    dir,
    nome: "dC-cx4-v2",
    nops: 0,
    inst,
    // As sondas `jsr`/`jmp` levan alvo ABSOLUTO: non hai desprazamento que
    // verificar contra o sitio montado, así que se entregan como texto plano (o
    // montador non entra no camiño `pc_rel`) e o alvo comprólase lendo a palabra
    // longa que o propio GAS emitiu (`alvoNasBytes`).
    sondas: [
      { rotulo: "moveq", texto: "moveq #0,%d0", sep: 0, sitioFixo: s("moveq") },
      { rotulo: "jsr", texto: "jsr (0x2020).l", sep: 0, sitioFixo: s("jsr") },
      { rotulo: "jmpfora", texto: "jmp (0x1234567).l", sep: 0, sitioFixo: s("jmpfora") },
      { rotulo: "indexado", texto: "move.b 0(%a1,%d2.w),%d0", sep: 0, sitioFixo: s("indexado") },
      { rotulo: "jmpind", texto: "jmp (%a2)", sep: 0, sitioFixo: s("jmpind") },
      { rotulo: "trap", texto: "trap #4", sep: 0, sitioFixo: s("trap") },
    ],
  });
  controlarSolapamento(montado.sondas);
  const porNome = new Map(montado.sondas.map((r) => [r.rotulo, r]));
  const lon = CX4.fim - CX4.origin;
  const { img, postas } = imaxeDesdeGrupos({ grupos: montado.grupos, lon, recheo: 0xff });
  const dito = (nome) => {
    const r = porNome.get(nome);
    return {
      endereco: CX4.origin + (r.sitio - BASE),
      bytes: r.bytes.toUpperCase(),
      tam: r.lonxitude,
      instrumento: {
        mnemonico: r.mnemonico,
        // `ea` é o que imprime o desmontador, en coordenadas do obxecto montado:
        // para alvos absolutos non se remapa (un `jsr 0x2020` apunta a 0x2020,
        // non a 0x2020−origin+BASE).
        ea: r.ea,
        desmontaxe: r.desmontaxe,
      },
    };
  };
  /** Alvo longo que GAS codificou dentro dos bytes da sondas (`off` en words). */
  const alvoNasBytes = (hex, off = 2) => Number(`0x${hex.slice(off * 2, off * 2 + 8)}`);
  const moveq = dito("moveq");
  const jsr = dito("jsr");
  const jmpfora = dito("jmpfora");
  const indexado = dito("indexado");
  const jmpind = dito("jmpind");
  const trap = dito("trap");
  const alvoJsr = alvoNasBytes(jsr.bytes);
  const alvoJmp = alvoNasBytes(jmpfora.bytes);
  if (alvoJsr !== CX4.indexado) {
    throw new Error(`dC-cx4-v2: GAS codificou ${HEX(alvoJsr)} en vez de ${HEX(CX4.indexado)}`);
  }
  if (alvoJmp !== 0x01234567) throw new Error(`dC-cx4-v2: alvo do jmp extra-rexión é ${HEX(alvoJmp)}`);
  // Se o desmontador resolve un símbolo para o alvo absoluto, ten de coincidir
  // coa palabra que GAS emitiu: dúas fontes, un só valor.
  if (jsr.instrumento.ea !== null && jsr.instrumento.ea !== CX4.indexado) {
    throw new Error(`dC-cx4-v2: objdump di ${HEX(jsr.instrumento.ea)} para o jsr, bytes ${HEX(alvoJsr)}`);
  }

  const kc4 = [
    {
      ...meta(),
      id: "KC4-jsr-abs-l-intra",
      endereco: jsr.endereco,
      bytes: jsr.bytes,
      esperado: { origem: jsr.endereco, alvo: indexado.endereco, status: "resolvido", derivado: "dentro-de-fluxo" },
      citacao_C: CITA.chamada_abs + "; " + CITA.raiz_derivada,
      statico: "aresta_de_chamada (`grafo.rs:507-531`): inserir o alvo na fila cando está dentro ⇒ raíz derivada",
      sondeo: { ...jsr.instrumento, alvo_nos_bytes: HEX(alvoJsr) },
    },
    {
      ...meta(),
      id: "KC4-jmp-abs-l-extra",
      endereco: jmpfora.endereco,
      bytes: jmpfora.bytes,
      esperado: { origem: jmpfora.endereco, alvo: 0x01234567, status: "fora-da-regiao", decodificado_fora: 0 },
      citacao_C: CITA.chamada_abs + "; " + CITA.raiz_derivada,
      statico: "aresta_de_jmp (`grafo.rs:533-552`): fóra da rexión ⇒ fronteira `limite-de-regiao` e nada se decodifica fóra",
      sondeo: { ...jmpfora.instrumento, alvo_nos_bytes: HEX(alvoJmp) },
    },
    {
      ...meta(),
      id: "KC4-jmp-ind-an",
      endereco: jmpind.endereco,
      bytes: jmpind.bytes,
      esperado: { fronteira: "indirect-opaque", alvo: null, endereco: jmpind.endereco },
      citacao_C: CITA.fluxo,
      statico: "JSR/JMP con modo ≠ abs (`decode.rs:691-720`) ⇒ `Frontier::indirect`, `target: null`",
      sondeo: jmpind.instrumento,
    },
    {
      ...meta(),
      id: "KC4-trap-n",
      endereco: trap.endereco,
      bytes: trap.bytes,
      esperado: { fronteira: "trap-opaco", endereco: trap.endereco },
      citacao_C: CITA.trap,
      sondeo: trap.instrumento,
    },
  ];

  const tc = [
    {
      ...meta(),
      id: "TC-1",
      capacidade: "TC",
      acao: { tipo: "cli", flag: "--root-prov", valor: "oraculo-externo" },
      esperado_rc: 2,
      motivo: "vocabulario de proveniencia pechado (`grafo.rs:21-27`); rc 2 = `Erro::Uso` — a recusa limpa é o ítem medido (EXTENSOES-D §1 «não suportado»)",
    },
    {
      ...meta(),
      id: "TC-2",
      capacidade: "TC",
      acao: { tipo: "site", endereco: CX4.jsr + 1 },
      esperado: { veredito: "miolo-de-instrucao" },
      motivo: `${HEX(CX4.jsr)} é jsr abs.L (${jsr.tam} B); ${HEX(CX4.jsr + 1)} é miolo`,
    },
    {
      ...meta(),
      id: "TC-3",
      capacidade: "TC",
      acao: { tipo: "site", endereco: 0x9000 },
      esperado: { veredito: "fora-da-regiao" },
      motivo: `sitio máis alá de ${HEX(CX4.fim)}`,
    },
    {
      ...meta(),
      id: "TC-4",
      capacidade: "TC",
      acao: { tipo: "xor-byte-imagem", offset_na_arquivo: moveq.endereco - CX4.origin, valor: 0x70 ^ 0xf0 },
      esperado: {
        endereco_mutado: moveq.endereco,
        bytes_antes: moveq.bytes,
        bytes_depois: "F000",
        delta_cobertura_bytes: 2,
        variante_illada: { raiz_extra: { endereco: CX4.jsr, proveniencia: "candidato", evidencia: "variante illada (§12.9: sen ela a receita mide alcançabilidade, non lonxitude)" } },
        invariantes: [
          `o export reporta fronteira en ${HEX(moveq.endereco)} co opcode f000`,
          "a instrución en 0x2000 deixa de constar como decodificada",
          `o resto do bloque (0x2002..) mantén os comprimentos ditados polo instrumento (jsr ${jsr.tam}, jmp ${jmpfora.tam}, indexado ${indexado.tam}, jmpind ${jmpind.tam}, trap ${trap.tam})`,
        ],
      },
      motivo: "sonda de comprimento: a adulteración ten de aparecer na cobertura, non ser absorbida",
    },
  ];

  const truth = {
    id: "dC-cx4-v2",
    ...meta(),
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2_c.mjs",
    origin: CX4.origin,
    regioes: [{ inicio: CX4.moveq, fim: CX4.fim }],
    raizes: [
      { endereco: moveq.endereco, proveniencia: "candidato", evidencia: "entrada autoral" },
      { endereco: trap.endereco, proveniencia: "referencia-estatica", evidencia: "sonda de trap illada" },
    ],
    sitios: [
      { endereco: indexado.endereco, esperado_veredito: "instrucao-de-bloco", motivo: "alvo da chamada intra-rexión: raíz derivada" },
      { endereco: 0x12345678, esperado_veredito: "fora-da-regiao", motivo: "alvo do jmp extra-rexión" },
    ],
    sequencia: montado.sondas.map((r) => ({ rotulo: r.rotulo, endereco: CX4.origin + (r.sitio - BASE), tam: r.lonxitude, bytes: r.bytes.toUpperCase(), mnemonico: r.mnemonico })),
    sondas_postas: postas.map((p) => ({ rotulo: p.rotulo, sitio: p.onde, lonxitude: p.lonxitude })),
    cobertura_esperada_bytes: {
      primaria: moveq.tam + jsr.tam + jmpfora.tam + indexado.tam,
      variante_fronteiras_contan_como_decodificadas:
        moveq.tam + jsr.tam + jmpfora.tam + indexado.tam + jmpind.tam + trap.tam,
      nota:
        "`primaria` = Σ dos catro bloques que §3 espera decodificados (as dúas fronteiras, " +
        "`jmp (A2)` e `trap #4`, reportan veredito pero non bytes). A variante está publicada " +
        "porque a súa aparición sería unha falla de `KC4v` (eixe de fronteira), non desta fila.",
    },
    kc4,
    kc2_indexado: {
      ...meta(),
      id: "KC2v-indexado",
      endereco: indexado.endereco,
      bytes: indexado.bytes,
      esperado: { tam: indexado.tam, origem: "d8(A1,D2.W)", destino: "D0" },
      citacao_C: CITA.indexado,
      sondeo: indexado.instrumento,
      nota: "fila contada no denominador `KC2v` como `dC-cx2-v2.kc2[5]` (`esperado.executa_em`); executa-se sobre esta imaxe",
    },
    tc,
    limites_de_autoria: [
      "os bytes das chamadas e dos saltos codifícaos GAS co sufixo `.l` explícito; o alvo extra-rexión " +
        "é o que imprime o desmontador, non un valor escrito a man",
      "o recheo da imaxe é 0xFF: `0000` decodifica como `ori.b #imm,Dn` (na lista de §3) e faría que " +
        "os ocos fosen alcanzábeis byte a byte",
    ],
  };
  return { img, truth, montado };
}

// ---------------------------------------------------------------------------
// Xerado e pin
// ---------------------------------------------------------------------------

const Nomes = {
  "dC-cx1-v2": { img: "dC-cx1-v2.bin", truth: "dC-cx1-truth-v2.json", build: buildCX1V2 },
  "dC-cx2-v2": { img: "dC-cx2-v2.bin", truth: "dC-cx2-truth-v2.json", build: buildCX2V2 },
  "dC-cx3-v2": { img: "dC-cx3-v2.bin", truth: "dC-cx3-truth-v2.json", build: buildCX3V2 },
  "dC-cx4-v2": { img: "dC-cx4-v2.bin", truth: "dC-cx4-truth-v2.json", build: buildCX4V2 },
};

export const DENOMINADOR = Object.freeze({
  partes: { KC1v: 21, KC2v: 6, KC3v: 2, KC4v: 4, KC5v: 5, TCv: 4 },
  total: 42,
  nota:
    "§12.3 conxelou a fronte C en 41 (`KC1v` 20 · `KC3v` 2). §12.10 h: MOVEA son dúas filas " +
    "distintas — `movea.w` dentro da lista de §3 e `movea.l #imm` fóra — así que `KC1v` pasa a 21 " +
    "e a fronte a 42 (intermedio 41 rexistrado). §12.10 i: das dúas filas de `KC3v` retírase a de " +
    "`61 ff` (BSR.S está na lista e a lectura depende da táboa de símbolos do desmontador) e " +
    "entra `1149` (MOVE.B→An), que si exerce a «combinação inválida» de §3; `KC3v` mantense en 2. " +
    "§12.10 j: `KC1v-movea-l-imm-a1` puntúa no eixe `coherencia-contrato-codigo`. Ningunha destas " +
    "filas foi executada antes de conxelar este adendo.",
});

export function contarFilas(truths) {
  return {
    KC1v: truths["dC-cx1-v2"].kc1.length,
    KC2v: truths["dC-cx2-v2"].kc2.length,
    KC3v: truths["dC-cx3-v2"].kc3.length,
    KC4v: truths["dC-cx4-v2"].kc4.length,
    KC5v: truths["dC-cx2-v2"].kc5.length,
    TCv: truths["dC-cx4-v2"].tc.length,
  };
}

export function gravarV2C({ dir = DATA_C, seedDir = null } = {}) {
  const inst = instrumento();
  const traballo = fs.mkdtempSync(seedDir ?? path.join(process.env.HOME, "rds-scratch/d-author-v2-c-"));
  const truths = {};
  const escritos = [];
  const arquivos = {};
  for (const [id, { img: nomeImg, truth: nomeTruth, build }] of Object.entries(Nomes)) {
    const { img, truth } = build({ inst, dir: path.join(traballo, id) });
    truths[id] = truth;
    const pImg = path.join(dir, nomeImg);
    const pTruth = path.join(dir, nomeTruth);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pImg, img);
    fs.writeFileSync(pTruth, `${JSON.stringify(truth, null, 2)}\n`);
    arquivos[nomeImg] = { sha256: sha256(img), bytes: img.length };
    arquivos[nomeTruth] = { sha256: sha256(fs.readFileSync(pTruth)), bytes: fs.statSync(pTruth).size };
    escritos.push(pImg, pTruth);
  }

  const partes = contarFilas(truths);
  for (const [k, v] of Object.entries(partes)) {
    if (v !== DENOMINADOR.partes[k]) {
      throw new Error(`denominador ${k}: conxelado en ${DENOMINADOR.partes[k]}, contado ${v}`);
    }
  }
  const total = Object.values(partes).reduce((a, b) => a + b, 0);
  if (total !== DENOMINADOR.total) throw new Error(`denominador total: ${total} ≠ ${DENOMINADOR.total}`);

  const pin = {
    esquema: "rex-parallel-d/pin-frentes-c/2",
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2_c.mjs",
    gabarito: GABARITO,
    contrato: CONTRATO,
    denominador: { partes, total, nota: DENOMINADOR.nota },
    instrumento: {
      version: inst.version,
      bandeira: inst.bandeira,
      sha256_as: inst.sha256_as,
      sha256_objdump: inst.sha256_objdump,
      filas_sha256: inst.filas_sha256,
    },
    arquivos,
  };
  const pPin = path.join(dir, "pin-c-v2.json");
  fs.writeFileSync(pPin, `${JSON.stringify(pin, null, 2)}\n`);
  escritos.push(pPin);
  fs.rmSync(traballo, { recursive: true, force: true });
  return { truths, pin, escritos, instrumento: inst };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarV2C();
  for (const [nome, info] of Object.entries(r.pin.arquivos)) {
    console.log(`${nome.padEnd(26)} ${String(info.bytes).padStart(6)} B  ${info.sha256.slice(0, 16)}…`);
  }
  console.log(`[author v2 C] denominador: ${Object.entries(r.pin.denominador.partes).map(([k, v]) => `${k} ${v}`).join(" · ")} = ${r.pin.denominador.total}`);
}
