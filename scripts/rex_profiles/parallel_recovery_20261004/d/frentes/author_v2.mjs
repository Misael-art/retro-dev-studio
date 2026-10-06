#!/usr/bin/env node
/**
 * Autor das fixtures v2 da fronte A (barra D, rolda 3).
 *
 * Diferenza decisiva fronte a `author_frentes.mjs` (v1): aquí ningunha
 * codificación 68000 se escribe a man. Cada sonda descríbea `m68k-elf-as` e o
 * enderezo efectivo que fica na imaxe dízoo `m68k-elf-objdump` (R14 de
 * `EXTENSOES-D.md` §12.2). As cinco filas de KA1 e a premisa de KA4-2 que a
 * rolda 2 contou como regresión de A eran bytes mal escritos por D (§12.6);
 * con este xerador ese modo de erro xa non existe.
 *
 * Xeometría (R14, unha sonda por sitio): cada fila ten a súa propia parella
 * `carga` + `chamada`. Entre a carga e a súa chamada van 2 `nop` (4 B), para que
 * a parella caia dentro da ventá de emparellamento (`--ventanxa 16`). Despois de
 * cada chamada van 8 `nop` (16 B), así que ningunha fila veciña entra na ventá e
 * polo tanto ningunha veciña pode ser a parella que a ferramenta atopa primeiro.
 *
 * As fixtures v1 **non se tocan**: teñen pins propios e a matriz histórica
 * mídese con elas (R0). Este ficheiro escribe `dA-img-v2.bin`,
 * `dA-truth-v2.json` e `pin-v2.json`.
 *
 * Uso: node scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { kosinskiEncode, kosinskiDecode, sha256, xerador } from "../lib_bench.mjs";
import { instrumento, montarSondas, controlarSolapamento } from "./montador.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "../../../../..");
export const DIR_A = path.join(
  RAIZ,
  "data/rex_profiles/parallel_recovery_20261004/d/frentes/a",
);
export const NOME_IMG = "dA-img-v2.bin";
export const NOME_TRUTH = "dA-truth-v2.json";
export const NOME_PIN = "pin-v2.json";
export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v2";

/** Ventá de emparellamento que se lle pasa á fronte en toda fila v2: fixada por
 *  D, non deixada ao defecto implícito da ferramenta (`--ventanxa 16`). */
export const VENTANXA = 16;

/** Enderezos conxelados por D antes de montar (son datos da fixture, non
 *  codificacións): o tamaño de imaxe, o sitio do bloque de sondas e as rexións
 *  de rotina e fluxo. */
export const LAYOUT = Object.freeze({
  rom_size: 0x20000,
  base: 0x100,
  rutina1: 0x2100,
  rutina2: 0x1f00,
  fluxo1: 0x8000,
  fluxo2: 0x6800,
});

const HEX = (n, w = 6) => `0x${n.toString(16).toUpperCase().padStart(w, "0")}`;

/** Lonxitude da rotina descompresora autoral: 15×`nop` + `rts` = 32 B (como v1). */
const textoRotina = Array(15).fill("nop").concat("rts").join("\n");

/**
 * Inventario de sondas. `rexistro` marca que papel xoga cada probe nunha fila:
 * `"carga"` abre a parella, `"chamada"` péchaa. As filas que só miden unha carga
 * levan chamada propia para que a recusa non se poida confundir cun `sen parella`.
 */
export function inventarioSondas({ fluxo1, fluxo2, fluxo3, rutina1, rutina2 }) {
  const s = [];
  const carga = (rotulo, texto, alvo) => s.push({ rotulo, texto, alvo, rexistro: "carga", sep: 2 });
  const chamada = (rotulo, texto, alvo) => s.push({ rotulo, texto, alvo, rexistro: "chamada", sep: 8 });

  // --- KA1v: as dez formas que A declara, codificadas polo instrumento -------
  const leaL = (r, rex) => carga(r, `lea (0x${fluxo1.toString(16)}).l,%${rex}`, fluxo1);
  const jsr1 = (r) => chamada(r, `jsr (0x${rutina1.toString(16)}).l`, rutina1);
  leaL("KA1v-lea-l-carga", "a0");
  jsr1("KA1v-lea-l-call");
  carga("KA1v-lea-w-baixo-carga", `lea (0x${fluxo2.toString(16)}).w,%a1`, fluxo2);
  jsr1("KA1v-lea-w-baixo-call");
  // `lea (0x8400).w`: o instrumento esténdeo por signo (EA 0xFF8400). É a probe
  // que en v1 se escribiu a man e invalidou a premisa de KA4-2.
  carga("KA1v-lea-w-alto-carga", "lea (0x8400).w,%a1", 0x8400);
  jsr1("KA1v-lea-w-alto-call");
  carga("KA1v-lea-pcd16-carga", (sitio) => `lea (0x${((fluxo1 - (sitio + 2)) & 0xffff).toString(16)},%pc),%a2`, fluxo1);
  jsr1("KA1v-lea-pcd16-call");
  leaL("KA1v-bsr-w-carga", "a3");
  chamada("KA1v-bsr-w-call", () => "bsr.w p_rotina", rutina2);
  leaL("KA1v-jsr-w-carga", "a3");
  chamada("KA1v-jsr-w-call", `jsr (0x${rutina2.toString(16)}).w`, rutina2);
  leaL("KA1v-jsr-l-carga", "a3");
  chamada("KA1v-jsr-l-call", `jsr (0x${rutina2.toString(16)}).l`, rutina2);
  leaL("KA1v-jmp-w-carga", "a3");
  chamada("KA1v-jmp-w-call", `jmp (0x${rutina2.toString(16)}).w`, rutina2);
  leaL("KA1v-jmp-l-carga", "a3");
  chamada("KA1v-jmp-l-call", `jmp (0x${rutina2.toString(16)}).l`, rutina2);
  leaL("KA1v-jmp-pcd16-carga", "a3");
  chamada("KA1v-jmp-pcd16-call", (sitio) => `jmp (0x${((rutina2 - (sitio + 2)) & 0xffff).toString(16)},%pc)`, rutina2);

  // --- KA1v-neg: palabras sen mnemónico 68000 (o instrumento di `.short`) ----
  const negativa = (rotulo, palabras) => {
    s.push({ rotulo, palabras, rexistro: "carga", sep: 2 });
    jsr1(`${rotulo}-call`);
  };
  negativa("KA1v-neg-4efd", [0x4efd, 0x0000, rutina2]);
  negativa("KA1v-neg-4efc", [0x4efc, rutina2]);

  // --- KA1v-fora: MC68000 válidos fóra da gramática declarada por A -----------
  carga("KA1v-fora-movea-l-imm-carga", "movea.l #0x1111,%a1");
  jsr1("KA1v-fora-movea-l-imm-call");
  carga("KA1v-fora-movea-w-an-carga", "movea.w %a0,%a1");
  jsr1("KA1v-fora-movea-w-an-call");
  // `61 FF` non é «sen mnemónico»: no bloque montado o desmontador le `bsrs`
  // (bsr.s con desprazamento −1, instrución MC68000 válida). En obxecto dun só
  // símbolo as mesmas seis palabras léense `bsrl` (forma de 68020): a lectura
  // depende do contexto de símbolos, non do byte. Por iso a fila non vai en
  // KA1v-neg, vai en KA1v-fora (§12.10).
  negativa("KA1v-fora-61ff", [0x61ff, 0x0000, 0x1dd4]);

  // --- KA2v: rexión do destino (táboa de xanelas publicada por A en §4) --------
  const destino = (rotulo, texto, alvo) => s.push({ rotulo, texto, alvo, rexistro: "destino", sep: 8 });
  destino("KA2v-rom", "lea (0x12340).l,%a2", 0x12340);
  destino("KA2v-io-vram", "lea (0xa00400).l,%a3", 0xa00400);
  destino("KA2v-mirror", "lea (0xff8400).l,%a4", 0xff8400);
  destino("KA2v-fora-bus", "lea (0x1000000).l,%a5", 0x1000000);

  // --- KA3v: cadea completa (carga propia + chamada propia) -------------------
  carga("KA3v-carga", `lea (0x${fluxo1.toString(16)}).l,%a0`, fluxo1);
  chamada("KA3v-chamada", `jsr (0x${rutina1.toString(16)}).l`, rutina1);

  // --- KA4v: tres fluxos referenciados con `lea .L` ou `(d16,PC)` --------------
  carga("KA4v-s1", `lea (0x${fluxo1.toString(16)}).l,%a1`, fluxo1);
  jsr1("KA4v-s1-call");
  carga("KA4v-s2-pc", (sitio) => `lea (0x${((fluxo2 - (sitio + 2)) & 0xffff).toString(16)},%pc),%a2`, fluxo2);
  jsr1("KA4v-s2-pc-call");
  carga("KA4v-s3", `lea (0x${fluxo3.toString(16)}).l,%a3`, fluxo3);
  jsr1("KA4v-s3-call");

  // --- TAv: xeometrías que as receitas de adulteración necesitan ---------------
  // TA-3a: DÚAS chamadas lexítimas dentro da mesma ventá, a distintos alvos.
  // Así o desprazamento do sitio queda illeso pola xeometría (a segunda chamada
  // está a 14 B do fin da carga ≤ 16) e o único eixo que diverxe é o vínculo
  // chamada→rutina. En v1 era inalcanzable: só había unha chamada na ventá.
  carga("TAv-3a-carga", `lea (0x${fluxo1.toString(16)}).l,%a0`, fluxo1);
  s[s.length - 1].sep = 2;
  chamada("TAv-3a-chamada1", `jsr (0x${rutina1.toString(16)}).l`, rutina1);
  s[s.length - 1].sep = 2;
  chamada("TAv-3a-chamada2", `jsr (0x${rutina2.toString(16)}).l`, rutina2);
  // TA-3b: chamada coherente (mesmo alvo que a cadea base) colocada fóra da
  // ventá tras a carga de KA3v ⇒ só o eixo XEOMETRIA pode diverxer.
  chamada("TAv-3b-chamada", `jsr (0x${rutina1.toString(16)}).l`, rutina1);

  // rotinas: `p_rotina`/`p_rotina1` son os símbolos que `bsr.w` referencia.
  return s;
}

function rotinasFixas(rutina1, rutina2) {
  return [
    { rotulo: "rotina", texto: textoRotina, sep: 0, sitioFixo: rutina2, rexistro: "rutina" },
    { rotulo: "rotina1", texto: textoRotina, sep: 0, sitioFixo: rutina1, rexistro: "rutina" },
  ];
}

/** Monta o bloque de sondas + as rotinas e coloca todo na imaxe. */
export function buildAImageV2({ seed = "d-frentes-a-v2", xerador: nomeXerador = "v2", dir = null, layout = LAYOUT, tamanhos = [1024, 128, 512] } = {}) {
  const novo = xerador(nomeXerador);
  const inst = instrumento();
  const traballo = dir ?? fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-v2-"));

  // 1) streams: datos non dexenerados (R16) codificados polo encoador de D.
  const mk = (n, tag) => {
    const rng = novo(`${seed}|${tag}`);
    const plain = Buffer.from(Array.from({ length: n }, () => rng()));
    return { plain, ...kosinskiEncode(plain) };
  };
  const s1 = mk(tamanhos[0], "s1");
  const s2 = mk(tamanhos[1], "s2");
  const s3full = mk(tamanhos[2], "s3");
  const s3 = { plain: s3full.plain, stream: s3full.stream.subarray(0, s3full.stream.length - 3) };
  const fluxo3 = layout.rom_size - s3.stream.length;
  if (fluxo3 < 0x4000) throw new Error("stream 3 non cabe no fim da imaxe");

  // 2) sondas montadas co instrumento. As rotinas van no mesmo bloque (con
  //    `.org` propio) para que `bsr.w` teña un símbolo interno e GAS calcule o
  //    desprazamento: un alvo externo deixaría `61 00 00 00` (relocación pendente).
  const sondas = inventarioSondas({ ...layout, fluxo3 });
  const montado = montarSondas({
    base: layout.base,
    dir: traballo,
    nome: "dA-sondas-v2",
    sondas: sondas.concat(rotinasFixas(layout.rutina1, layout.rutina2)),
    inst,
  });
  const filas = montado.sondas.filter((r) => r.sonda.rexistro !== "rutina");
  const porNome = new Map(filas.map((r) => [r.rotulo, r]));
  controlarSolapamento(montado.sondas);

  const img = Buffer.alloc(layout.rom_size, 0);
  const marcadas = [];
  const colocar = (sitio, hex, nome) => {
    const buf = Buffer.from(hex, "hex");
    if (sitio % 2 !== 0) throw new Error(`sitio ímpar: ${nome} @${sitio.toString(16)}`);
    for (const m of marcadas) {
      if (sitio < m.onde + m.buf.length && m.onde < sitio + buf.length) {
        throw new Error(`colocación solapada: ${nome} pisa ${m.nome}`);
      }
    }
    marcadas.push({ onde: sitio, buf, nome });
    buf.copy(img, sitio);
  };
  // O que se copia para a imaxe é o bloque tal e como o montou GAS: cada grupo
  // do `.text` (sonda, separador `nop` ou rutina) coa súa dirección e os seus
  // bytes. Así os ocos entre sondas son os `4e71` que o instrumento emitiu e non
  // recheo propio do autor (R14: o gabarito de D é a saída do instrumento).
  for (const g of montado.grupos) {
    const bytesGrupo = g.liñas.map((l) => l.bytes).join("");
    if (!bytesGrupo) continue;
    colocar(g.direccion, bytesGrupo, g.rotulo);
  }
  s1.stream.copy(img, layout.fluxo1);
  s2.stream.copy(img, layout.fluxo2);
  s3.stream.copy(img, fluxo3);
  for (const st of [
    { nome: "s1", onde: layout.fluxo1, buf: s1.stream },
    { nome: "s2", onde: layout.fluxo2, buf: s2.stream },
    { nome: "s3", onde: fluxo3, buf: s3.stream },
  ]) {
    for (const m of marcadas) {
      if (st.onde < m.onde + m.buf.length && m.onde < st.onde + st.buf.length) {
        throw new Error(`stream ${st.nome} solapa a sonda ${m.nome}`);
      }
    }
  }

  const bytesRotina = (nome) => {
    const r = montado.sondas.find((x) => x.rotulo === nome);
    if (!r) throw new Error(`rotina sen símbolo: ${nome}`);
    return Buffer.from(r.bytes, "hex");
  };
  const rutinaBuf = bytesRotina("rotina");
  const rotina1Buf = bytesRotina("rotina1");
  for (const [nome, b] of [["rotina", rutinaBuf], ["rotina1", rotina1Buf]]) {
    if (b.length !== 32) throw new Error(`rotina ${nome} con lonxitude inesperada: ${b.length}`);
  }
  const sonda = (nome) => {
    const r = porNome.get(nome);
    if (!r) throw new Error(`sonda ausente: ${nome}`);
    return r;
  };

  // 3) gabarito: cada fila declara o seu `gabarito` (R15) e cita o ditame do
  //    instrumento (mnemónico, bytes e enderezo efectivo que devolve objdump).
  const dito = (nome) => {
    const r = sonda(nome);
    return {
      sitio: r.sitio,
      bytes: r.bytes.toUpperCase(),
      lonxitude: r.lonxitude,
      instrumento: { mnemonico: r.mnemonico, ea: r.ea, desmontaxe: r.desmontaxe },
    };
  };
  const parella = (cargaNome, chamadaNome) => ({
    carga_sonda: cargaNome,
    chamada_sonda: chamadaNome,
    carga_sitio: sonda(cargaNome).sitio,
    chamada_sitio: sonda(chamadaNome).sitio,
  });

  /** `carga`/`chamada` son os dous nomes de sonda da fila; `esperadoCarga` e
   *  `esperadoChamada` dan forma e operando/alvo que A debe ler. Os sitios
   *  decláranse sempre: son o control de que a parella que A devolve é A NOSA
   *  parella e non a sonda veciña (R14). */
  const filaKa1v = (id, forma, c, k, ec, ek, extra = {}) => ({
    id,
    forma,
    capacidade: "KA1v",
    gabarito: GABARITO,
    contrato: CONTRATO,
    ...parella(c, k),
    sondeo: dito(c),
    chamada: dito(k),
    esperado: {
      carga_sitio: sonda(c).sitio,
      carga_forma: ec[0],
      carga_operando: ec[1],
      chamada_sitio: sonda(k).sitio,
      chamada_forma: ek[0],
      chamada_alvo: ek[1],
    },
    ...extra,
  });
  const L1 = ["lea.l/A0", layout.fluxo1];
  const L3 = ["lea.l/A3", layout.fluxo1];
  const J1 = ["jsr.l", layout.rutina1];
  const ka1v = [
    filaKa1v("KA1v-lea-l", "lea (xxx).L,An", "KA1v-lea-l-carga", "KA1v-lea-l-call", L1, J1),
    filaKa1v("KA1v-lea-w-baixo", "lea (xxx).W,An co bit 15 = 0", "KA1v-lea-w-baixo-carga", "KA1v-lea-w-baixo-call",
      ["lea.w/A1", layout.fluxo2], J1),
    {
      id: "KA1v-lea-w-alto",
      forma: "lea (xxx).W,An co bit 15 = 1",
      capacidade: "KA1v",
      gabarito: GABARITO,
      contrato: CONTRATO,
      ...parella("KA1v-lea-w-alto-carga", "KA1v-lea-w-alto-call"),
      sondeo: dito("KA1v-lea-w-alto-carga"),
      chamada: dito("KA1v-lea-w-alto-call"),
      esperado: {
        recusa: true,
        rc_aceitado: [4],
        cadea_promovida: false,
        motivos_aceitados: ["sen backing ROM"],
        categoria: "nao-suportado",
      },
      nota_instrumento: `extensión de sinal ditada por objdump: EA = ${HEX(sonda("KA1v-lea-w-alto-carga").ea >>> 0)} ` +
        "(fila `lea-abs-w-alto`/`bruto-lea-8400-w` de isa-oraculo-v2: `43f8 8400` → 0xffff8400). " +
        "`decodificar` acepta a forma (rc ≠ 5/6); o que falla é o mapper: `main.rs:391-393` chama " +
        "`offset_rom(0xFF8400)` e o seu erro → MAPPER_DIVERXENCIA (4). O nome da rexión nese texto " +
        "ven de `rex_addressing::Translate::Device`, non de `verify.rs::clasificar_rexion` — as dúas " +
        "vocabularios de A discrepan para 0xFF8400 (§12.10 e)",
    },
    filaKa1v("KA1v-lea-pcd16", "lea (d16,PC),An", "KA1v-lea-pcd16-carga", "KA1v-lea-pcd16-call",
      ["lea.pcd16/A2", layout.fluxo1], J1,
      { nota: "base do desprazamento = sitio + 2; verificado lendo a imaxe en validarEntradaA2" }),
    filaKa1v("KA1v-bsr-w", "bsr.w", "KA1v-bsr-w-carga", "KA1v-bsr-w-call", L3, ["bsr.w", layout.rutina2]),
    filaKa1v("KA1v-jsr-w", "jsr (xxx).W", "KA1v-jsr-w-carga", "KA1v-jsr-w-call", L3, ["jsr.w", layout.rutina2]),
    filaKa1v("KA1v-jsr-l", "jsr (xxx).L", "KA1v-jsr-l-carga", "KA1v-jsr-l-call", L3, ["jsr.l", layout.rutina2]),
    filaKa1v("KA1v-jmp-w", "jmp (xxx).W", "KA1v-jmp-w-carga", "KA1v-jmp-w-call", L3, ["jmp.w", layout.rutina2]),
    filaKa1v("KA1v-jmp-l", "jmp (xxx).L", "KA1v-jmp-l-carga", "KA1v-jmp-l-call", L3, ["jmp.l", layout.rutina2]),
    filaKa1v("KA1v-jmp-pcd16", "jmp (d16,PC)", "KA1v-jmp-pcd16-carga", "KA1v-jmp-pcd16-call", L3,
      ["jmp.pcd16", layout.rutina2],
      {
        nota_instrumento: "`4efa` é `jmp (d16,%pc)` (filas `jmp-pc-d16`/`bruto-4efa-d16pc` do oráculo); " +
          "`jsr.w` é `4eb8` — en v1 D escribiu `4efa` e chamou `jsr.w` á sonda",
      }),
  ];

  // Os rc aceitados e os motivos xélanse da lectura estática de `bd40e92`
  // (requirements 7 e R12), non da observación:
  //   * `main.rs:327-332` — calquera fallo de `decodificar` no sitio de carga →
  //     SITIO_DIVERXENCIA (5) co texto «non é forma de carga: {erro:?}».
  //   * `main.rs:333-339` — forma decodificada que non é carga lea →
  //     ARGUMENTO_DIVERXENTE (6). Ningunha das cinco palabras_probe decodifica
  //     (`instr.rs::decodificar` non ten entrada para `22 7C`, `32 48`,
  //     `4E FC/FD` nin `61 FF`), así que 5 é o camiño previsto e 6 queda
  //     admitido porque tamén é unha recusa no eixo da carga.
  //   * RECTIFICACION-A §3 publica os motivos estábles; `cadea` non se emite.
  const NEG = { rc: [5, 6], categoria: "nao-suportado" };
  const ka1vNeg = [
    {
      id: "KA1v-neg-4efd", palabras: "4EFD 0000 1F00", v1_dito: "`jmp.l`",
      motivos: ["indefinido-68000"],
    },
    {
      id: "KA1v-neg-4efc", palabras: "4EFC 1F00", v1_dito: "`jmp.w`",
      motivos: ["indefinido-68000"],
    },
  ].map((d) => ({
    id: d.id,
    capacidade: "KA1v-neg",
    gabarito: GABARITO,
    contrato: CONTRATO,
    ...parella(d.id, `${d.id}-call`),
    sondeo: dito(d.id),
    chamada: dito(`${d.id}-call`),
    palabras: d.palabras,
    esperado: {
      recusa: true,
      rc_aceitado: NEG.rc,
      cadea_promovida: false,
      motivos_aceitados: d.motivos,
      categoria: NEG.categoria,
    },
    nota_instrumento:
      `${d.id}: a primeira liña do desmontador é \`${dito(d.id).instrumento.mnemonico}\` — sen mnemónico ` +
      `MC68000 (filas \`bruto-${d.id.slice(-4)}\` de isa-oraculo-v2). En v1 D chamoulle ${d.v1_dito} e ` +
      "contou a recusa de A como regresión de A (§12.6).",
  }));

  const ka1vFora = [
    {
      id: "KA1v-fora-movea-l-imm",
      forma: "movea.l #imm32,An",
      sonda: "KA1v-fora-movea-l-imm-carga",
      chamada: "KA1v-fora-movea-l-imm-call",
      motivos: ["NonForma"],
      nota_instrumento: () => "o montador codifica esta forma MC68000 válido: bytes " +
        `\`${dito("KA1v-fora-movea-l-imm-carga").bytes}\`, lectura \`` +
        `${dito("KA1v-fora-movea-l-imm-carga").instrumento.mnemonico}\` (fila \`movea-l-inm\` de ` +
        "isa-oraculo-v2, rc_montador 0). MOVEA non está no subconxunto de carga `md68000-chain16`: " +
        "`decodificar` cae en `InstrErro::NonForma` e o rc previsto é 5.",
    },
    {
      id: "KA1v-fora-movea-w-an",
      forma: "movea.w %a0,%a1",
      sonda: "KA1v-fora-movea-w-an-carga",
      chamada: "KA1v-fora-movea-w-an-call",
      motivos: ["NonForma"],
      nota_instrumento: () => "o montador codifica " +
        `\`${dito("KA1v-fora-movea-w-an-carga").bytes}\` = \`3248\`: MC68000 válido. A etiqueta ` +
        "`classe_instrumento` desa fila en isa-oraculo-v2.json di `recusada-68000` e está equivocada " +
        "(rectificación datada §12.10; o pin do gabarito non se reescribe, R0). Requisito 4: en v1 D " +
        "chamou «inválida» a unha instrución que o instrumento codifica.",
    },
    {
      id: "KA1v-fora-61ff",
      forma: "bsr.s con desprazamento negativo (`61 FF`)",
      sonda: "KA1v-fora-61ff",
      chamada: "KA1v-fora-61ff-call",
      palabras: "61FF 0000 1DD4",
      motivos: ["68020-non-declarado"],
      nota_instrumento: () => "no bloque montado o desmontador le a primeira palabra como `" +
        `${dito("KA1v-fora-61ff").instrumento.mnemonico}\`: BSR.S lexítimo de MC68000 (desprazamento −1), ` +
        "non «palabra sen mnemónico». Nun obxecto dun só símbolo as mesmas seis palabras léense `bsrl` " +
        "(fila `bruto-61ff-bsrl` de isa-oraculo-v2, forma de 68020): a lectura depende do contexto de " +
        "símbolos do desmontador, non do byte. Por iso a fila sae de KA1v-neg e vai a KA1v-fora (§12.10). " +
        "A recusa de A é a súa propia elección publicada (`instr.rs:147-154`: `61 FF` → " +
        "`Recusa {motivo: \"68020-non-declarado\"}`), non un erro de ISA.",
    },
  ].map((d) => ({
    id: d.id,
    capacidade: "KA1v-fora",
    forma: d.forma,
    gabarito: GABARITO,
    contrato: CONTRATO,
    ...parella(d.sonda, d.chamada),
    sondeo: dito(d.sonda),
    chamada: dito(d.chamada),
    ...(d.palabras ? { palabras: d.palabras } : {}),
    esperado: {
      recusa: true,
      rc_aceitado: NEG.rc,
      cadea_promovida: false,
      motivos_aceitados: d.motivos,
      categoria: NEG.categoria,
    },
    nota_instrumento: d.nota_instrumento(),
  }));

  const ka2v = [
    { id: "KA2v-rom", sonda: "KA2v-rom", rexion: "rom", forma: "lea.l/A2" },
    { id: "KA2v-io-vram", sonda: "KA2v-io-vram", rexion: "io/vram-window", forma: "lea.l/A3" },
    { id: "KA2v-mirror", sonda: "KA2v-mirror", rexion: "ram-68k-mirror", forma: "lea.l/A4" },
    {
      id: "KA2v-fora-bus", sonda: "KA2v-fora-bus", rexion: "rom", forma: "lea.l/A5",
      limitacion_esixida: "efectivo≠bus(destino)",
      nota: "efectivo 0x1000000 → bus 24 bits 0x000000 → rexión rom. O invariante non é «rc ≠ 0»: é que " +
        "a cadea REXISTRE a diferenza efectivo↔bus (RECTIFICACION-A §2, modelo de tres niveis). Un clamp " +
        "silencioso — rexión sen a limitación — é FAIL (R12).",
    },
  ].map((d) => {
    const r = sonda(d.sonda);
    return {
      id: d.id,
      capacidade: "KA2v",
      gabarito: GABARITO,
      contrato: CONTRATO,
      destino_sitio: r.sitio,
      destino_operando: r.ea ?? Number(`0x${r.bytes.slice(4)}`),
      destino_bytes: r.bytes.toUpperCase(),
      destino_forma: d.forma,
      instrumento: { mnemonico: r.mnemonico, ea: r.ea },
      esperado_rexion: d.rexion,
      clamp_silencioso_prohibido: true,
      ...(d.limitacion_esixida ? { limitacion_esixida: d.limitacion_esixida } : {}),
      ...(d.nota ? { nota: d.nota } : {}),
      fonte_expectativa: "CONTRATO-A §4 (táboa de xanelas publicada pola propia fronte A, lida en bd40e92)",
      ...parella("KA3v-carga", "KA3v-chamada"),
    };
  });

  const ka3v = {
    id: "KA3v",
    capacidade: "KA3v",
    gabarito: GABARITO,
    contrato: CONTRATO,
    ...parella("KA3v-carga", "KA3v-chamada"),
    sondeo: dito("KA3v-carga"),
    chamada: dito("KA3v-chamada"),
    esperado: {
      rc: 0,
      carga_forma: "lea.l/A0",
      carga_operando: layout.fluxo1,
      carga_bytes: sonda("KA3v-carga").bytes.toUpperCase(),
      chamada_forma: "jsr.l",
      chamada_sitio: sonda("KA3v-chamada").sitio,
      chamada_alvo: layout.rutina1,
      rutina_sitio: layout.rutina1,
      rutina_lonxitude: 32,
      rutina_sha256: sha256(rotina1Buf),
      fluxo_cpu: layout.fluxo1,
      fluxo_offset: layout.fluxo1,
      tramo_entrada: layout.rom_size - layout.fluxo1,
      bytes_consumidos: s1.stream.length,
      saida_bytes: s1.plain.length,
      saida_sha256: sha256(s1.plain),
      confianza: "vinculo-estrutural",
      mapper: "md-linear",
      estado_mapper: `rom_size=${HEX(layout.rom_size, 6)}`,
    },
    revalidar_esperado_rc: 0,
  };

  const ka3vG = [
    {
      id: "KA3v-g-a", capacidade: "KA3v-g", mutacion: "campo_desconhecido",
      esperado_rc_conxunto: [2], motivos_aceitados: ["campo descoñecido"],
      gabarito: GABARITO, contrato: CONTRATO,
      motivo: "ESQUEMA exacto: o lector de JSON da fronte rexeita campos descoñecidos " +
        "(`crate::json` → «campo descoñecido: <nome>»); nada se ignora en silencio",
    },
    {
      id: "KA3v-g-b", capacidade: "KA3v-g", mutacion: "confianza=observado-en-runtime",
      esperado_rc_conxunto: [2], motivos_aceitados: ["observado-en-runtime"],
      gabarito: GABARITO, contrato: CONTRATO,
      motivo: "ESQUEMA exacto: `chain.rs:317-319` — «observado-en-runtime: esta fronte non executa a ROM»",
    },
  ];

  const ka4v = [
    {
      id: "KA4v-s1", sonda: "KA4v-s1", chamada: "KA4v-s1-call", fluxo: "s1",
      esperado: { rc: 0, saida_sha256: sha256(s1.plain), saida_bytes: s1.plain.length, bytes_consumidos: s1.stream.length, carga_forma: "lea.l/A1", carga_operando: layout.fluxo1 },
    },
    {
      id: "KA4v-s2-pc", sonda: "KA4v-s2-pc", chamada: "KA4v-s2-pc-call", fluxo: "s2",
      esperado: { rc: 0, saida_sha256: sha256(s2.plain), saida_bytes: s2.plain.length, bytes_consumidos: s2.stream.length, carga_forma: "lea.pcd16/A2", carga_operando: layout.fluxo2 },
      nota: "v1 chamou a esta fila KA4-2 cunha premisa escrita a man (EA 0xFF8400); aquí o fluxo está en 0x6800 coa forma .W de bit 15 = 0 e unha sonda PC-relativa á marxe (§12.6)",
    },
    {
      id: "KA4v-s3", sonda: "KA4v-s3", chamada: "KA4v-s3-call", fluxo: "s3",
      esperado: { rc: 10, carga_forma: "lea.l/A3", carga_operando: fluxo3, cadea: "ningunha", motivo: "INCONCLUSIVE-TRUNCADA; rc 0 é prohibido sen terminator" },
    },
  ].map((d) => ({
    id: d.id,
    capacidade: "KA4v",
    gabarito: GABARITO,
    contrato: CONTRATO,
    fluxo: d.fluxo,
    ...parella(d.sonda, d.chamada),
    sondeo: dito(d.sonda),
    chamada: dito(d.chamada),
    esperado: d.esperado,
    ...(d.nota ? { nota: d.nota } : {}),
  }));

  const tav = receitasV2({ sonda, fluxo1: layout.fluxo1, rutina1: layout.rutina1, rutina2: layout.rutina2 });

  const truth = {
    esquema: "rex-parallel-d/frente-a/2",
    gerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2.mjs",
    gabarito: GABARITO,
    contrato: CONTRATO,
    xerador: nomeXerador,
    ventanxa: VENTANXA,
    instrumento: {
      version: inst.version,
      bandeira: inst.bandeira,
      sha256_as: inst.sha256_as,
      sha256_objdump: inst.sha256_objdump,
      filas_sha256: inst.filas_sha256,
    },
    imaxe: { rom_size: layout.rom_size, tam: img.length, sha256: sha256(img) },
    config: { seed, ...layout, fluxo3 },
    sitios: Object.fromEntries(filas.map((r) => [r.rotulo, r.sitio])),
    // Xeometría ditada polo montador: cada probe que GAS sitúo, co seu sitio e
    // lonxitude reais. É a fonte da que os tests caminan os ocos (R14); derivar
    // a lista das formas das filas foi o que ocultou sondas en v1.
    sondas_postas: montado.sondas.map((r) => ({
      rotulo: r.rotulo,
      rexistro: r.sonda.rexistro,
      sitio: r.sitio,
      lonxitude: r.lonxitude,
      bytes: r.bytes.toUpperCase(),
    })),
    streams: {
      s1: { offset: layout.fluxo1, plain_len: s1.plain.length, plain_sha256: sha256(s1.plain), stream_len: s1.stream.length, stream_sha256: sha256(s1.stream), terminator: true },
      s2: { offset: layout.fluxo2, plain_len: s2.plain.length, plain_sha256: sha256(s2.plain), stream_len: s2.stream.length, stream_sha256: sha256(s2.stream), terminator: true },
      s3: { offset: fluxo3, plain_len: s3.plain.length, plain_sha256: sha256(s3.plain), stream_len: s3.stream.length, stream_sha256: sha256(s3.stream), terminator: false, motivo: "EOD retirado e fluxo no fim da imaxe: EOF sen terminator" },
    },
    rotinas: {
      [layout.rutina2.toString(16)]: { sitio: layout.rutina2, lonxitude: 32, sha256: sha256(rutinaBuf) },
      [layout.rutina1.toString(16)]: { sitio: layout.rutina1, lonxitude: 32, sha256: sha256(rotina1Buf) },
    },
    ka1v,
    ka1v_neg: ka1vNeg,
    ka1v_fora: ka1vFora,
    ka2v,
    ka3v,
    ka3v_g: ka3vG,
    ka4v,
    tav,
    denominador: {
      partes: {
        KA1v: ka1v.length,
        "KA1v-neg": ka1vNeg.length,
        "KA1v-fora": ka1vFora.length,
        KA2v: ka2v.length,
        KA3v: 1 + ka3vG.length,
        KA4v: ka4v.length,
        TAv: tav.length,
      },
      total:
        ka1v.length + ka1vNeg.length + ka1vFora.length + ka2v.length +
        1 + ka3vG.length + ka4v.length + tav.length,
      nota: "§12.3 conxelaba «KA1v-neg 3 · KA1v-fora 2 · TAv 8 · total 32» para a fronte A. v2 (rectificación " +
        "datada §12.10, escrita antes de calquera medición v2): `61 FF` lése como BSR.S válido polo " +
        "desmontador e pasa de neg a fora; TA-3 desdóbase en TA-3a/TA-3b para illar vínculo e xanela; " +
        "re-avaliación de códigos (requisito 7) mantén TA-5v en rc 2 e engade TA-5b, que exerce o elo " +
        "`forma-carga` que v1 nunca tocou. KA3v conta a fila base máis as dúas gardas.",
    },
    limites_de_autoria: [
      "as codificacións veñen de `m68k-elf-as -m68000` (Binutils 2.41) e os enderezos efectivos de `m68k-elf-objdump`: D non escribe bytes a man (R14)",
      "a fronte A cita o mesmo binario do oráculo (`fixtures/INSTRUMENTO.sha256`): ningunha fila de ISA de A sobe de `referencia estática` por esta vía (R10)",
      "`4EFD`/`4EFC` non teñen mnemónico 68000 (o instrumento imprime `.short`), así que a sonda son as palabras crúas e o ditame é do desmontador; `61 FF` si que o ten (`bsrs`, BSR.S de desprazamento −1) e por iso vive en KA1v-fora, non en KA1v-neg (§12.10 d)",
      "imaxe sintética: non é ROM comercial nin BYOR",
      "a ventá de emparellamento pásaa D por bandeira (`--ventanxa 16`), non se deixa ao defecto implícito da ferramenta medida",
      "os rc aceitados das recusas derivan da lectura estática de `bd40e92` (`main.rs:312-341`, `instr.rs:147-247`, `chain.rs:313-390`) e dos motivos estables que RECTIFICACION-A §3 publica; non se copian de ningunha execución",
    ],
  };

  if (!dir) fs.rmSync(traballo, { recursive: true, force: true });
  return { img, truth, montado, streams: { s1, s2, s3 }, rotinas: { rutinaBuf, rotina1Buf }, traballo };
}

/** Receitas de adulteración v2: cada unha illa un só eixo (§12.4). `base` di
 *  desde que carga se constrúe a cadea á que se lle aplica a mutación e
 *  `elo_aceitado` é o nome do elo que `revalidar` debe sinalar como FAIL
 *  (`verify.rs`/`chain.rs` lidos en `bd40e92` antes de medir): o rc di *que*
 *  rexeitou, o elo di *onde*, e un rc correcto co elo equivocado non illa o
 *  eixo que a receita afirma. */
function receitasV2({ sonda, fluxo1, rutina1, rutina2 }) {
  const p = (nome) => sonda(nome).sitio;
  const b = (nome) => sonda(nome).bytes.toUpperCase();
  return [
    {
      id: "TA-1", capacidade: "TAv", eixo: "identidade", alvo: "imagem", base: "KA3v",
      acao: { tipo: "xor-byte", offset: 0x2fff, valor: 0xff },
      esperado_rc_conxunto: [3], elo_aceitado: "identidade",
      motivo: "ROM-DIVERXENCIA antes de medir",
    },
    {
      id: "TA-2", capacidade: "TAv", eixo: "saída", alvo: "imagem", base: "KA3v",
      acao: { tipo: "xor-byte", offset: fluxo1 + 8, valor: 0x5a, reapin_imaxe: true },
      esperado_rc_conxunto: [9], elo_aceitado: "saída",
      motivo: "SAIDA-DIVERXENTE; a variante sen re-pin queda como control non puntuado",
    },
    {
      id: "TA-3a", capacidade: "TAv", eixo: "vínculo", alvo: "cadea", base: "TAv-3a",
      acao: {
        tipo: "chamada-fora-da-ventana",
        sitio: p("TAv-3a-chamada2"), bytes: b("TAv-3a-chamada2"), alvo: rutina2,
        base_carga_sitio: p("TAv-3a-carga"),
      },
      esperado_rc_conxunto: [7], elo_aceitado: "vinculo-chamada-rutina",
      motivo: "sitio movido DENTRO da ventá (14 B ≤ 16) a unha chamada real coherente: " +
        "xeometría illesa e o único eixo que diverxe é o vínculo chamada→rutina (rc 7)",
    },
    {
      id: "TA-3b", capacidade: "TAv", eixo: "xanela", alvo: "cadea", base: "KA3v",
      acao: {
        tipo: "chamada-fora-da-ventana",
        sitio: p("TAv-3b-chamada"), bytes: b("TAv-3b-chamada"), alvo: rutina1,
      },
      esperado_rc_conxunto: [11], elo_aceitado: "xeometria",
      motivo: "alvo coherente co bytes do sitio (rc 7 imposible), sitio fóra da ventá ⇒ só XEOMETRIA-DIVERXENTE",
    },
    {
      id: "TA-4", capacidade: "TAv", eixo: "sítio", alvo: "cadea", base: "KA3v",
      acao: { tipo: "campo-hex-inverter", campo: "carga_bytes" },
      esperado_rc_conxunto: [5], elo_aceitado: "sitio-carga",
      motivo: "SITIO-DIVERXENCIA: os bytes declarados non son os do sitio",
    },
    {
      id: "TA-5v", capacidade: "TAv", eixo: "operando", alvo: "cadea", base: "KA3v",
      acao: {
        tipo: "campo", campo: "carga_operando", valor: HEX(fluxo1 + 4), rexistro_valido_por_esquema: true,
      },
      esperado_rc_conxunto: [2], elo_aceitado: "esquema",
      motivo:
        "Re-avaliación polo contrato vixente (requisito 7): `chain.rs:363` — con confianza " +
        "`vinculo-estrutural`, `validar()` exixe `bus(carga_operando) == fluxo_cpu` ANTES de medir, " +
        "así que o operando adulterado cae no elo `esquema` (rc 2) co texto «o bus do operando da " +
        "carga non e o fluxo da cadea». En v1 D conxelou 6 (ARGUMENTO-DIVERXENTE), que é o elo de " +
        "medición `argumento-fonte` (`verify.rs:342-347`) e só se alcanza cando a estrutura é coherente: " +
        "rectificación datada §12.10 f. rc 0 = FAIL; calquera outro rc = `descoñecido` co elo medido.",
    },
    {
      id: "TA-5b", capacidade: "TAv", eixo: "forma-carga", alvo: "cadea", base: "KA3v",
      acao: { tipo: "campo", campo: "carga_forma", valor: "lea.l/A1" },
      esperado_rc_conxunto: [6], elo_aceitado: "forma-carga",
      motivo:
        "forma declarada trocada mantendo bytes, operando e fluxo coherentes: o único elo que pode " +
        "diverxer é `forma-carga` (verify.rs:312-336 → ARGUMENTO_DIVERXENTE). v1 nunca exerceu este elo: " +
        "a súa TA-5 curcuitaba no esquema (§12.10 f)",
    },
    {
      id: "TA-6", capacidade: "TAv", eixo: "alvo", alvo: "cadea", base: "KA3v",
      acao: { tipo: "campo", campo: "chamada_alvo", delta: 2 },
      esperado_rc_conxunto: [7], elo_aceitado: "alvo-chamada",
      motivo: "ALVO-DIVERXENTE: o alvo declarado diverxe do calculado desde os bytes",
    },
    {
      id: "TA-7", capacidade: "TAv", eixo: "rutina", alvo: "cadea", base: "KA3v",
      acao: { tipo: "campo-hex-inverter", campo: "rutina_sha256", conservar_caixa: true },
      esperado_rc_conxunto: [8], elo_aceitado: "rutina",
      motivo: "ROTINA-DIVERXENCIA: hash da rutina adulterado conservando a forma (64 hex minúsculas)",
    },
    {
      id: "TA-8", capacidade: "TAv", eixo: "mapper", alvo: "cadea", base: "KA3v",
      acao: { tipo: "campo", campo: "fluxo_offset", delta: 2 },
      esperado_rc_conxunto: [4], elo_aceitado: "mapper",
      motivo: "MAPPER-DIVERXENCIA: `offset_rom(fluxo_cpu)` ≠ `fluxo_offset` declarado",
    },
  ].map((r) => ({ gabarito: GABARITO, contrato: CONTRATO, ...r }));
}

/** Auto-validación da entrada: os streams round-trip dende os bytes da imaxe e a
 *  truncada rexeita; as sondas relativas lense na imaxe e apuntan ao alvo
 *  declarado; ningunha probe solapa con outra nin cun stream. */
export function validarEntradaA2(a, nome = NOME_IMG) {
  const { img, truth } = a;
  for (const st of [truth.streams.s1, truth.streams.s2]) {
    const fatia = img.subarray(st.offset, st.offset + st.stream_len);
    if (sha256(fatia) !== st.stream_sha256) {
      throw new Error(`${nome}: bytes do stream en ${st.offset} difiren do codificado`);
    }
    if (sha256(kosinskiDecode(fatia)) !== st.plain_sha256) {
      throw new Error(`${nome}: round-trip en ${st.offset} diverxe`);
    }
  }
  let erro = null;
  try {
    kosinskiDecode(img.subarray(truth.streams.s3.offset));
  } catch (e) {
    erro = String(e.message || e);
  }
  if (!erro) throw new Error(`${nome}: a stream truncada decodifica sen erro`);

  // Sondas relativas: o desprazamento asinado lido na imaxe ten de dar o alvo
  // declarado (base = sitio + 2, como calquera descodificador 68000).
  const relativos = [
    { fila: truth.ka1v.find((f) => f.id === "KA1v-lea-pcd16"), sitio: "carga_sitio", alvo: "carga_operando" },
    { fila: truth.ka4v.find((f) => f.id === "KA4v-s2-pc"), sitio: "carga_sitio", alvo: "carga_operando" },
    { fila: truth.ka1v.find((f) => f.id === "KA1v-jmp-pcd16"), sitio: "chamada_sitio", alvo: "chamada_alvo" },
    { fila: truth.ka1v.find((f) => f.id === "KA1v-bsr-w"), sitio: "chamada_sitio", alvo: "chamada_alvo" },
  ];
  for (const { fila, sitio, alvo } of relativos) {
    if (!fila) throw new Error(`${nome}: fila ausente para o control relativo (${sitio})`);
    const disp = img.readInt16BE(fila[sitio] + 2);
    const calculado = fila[sitio] + 2 + disp;
    if (calculado !== fila.esperado[alvo]) {
      throw new Error(
        `${nome}: desprazamento en ${fila[sitio].toString(16)} apunta a ${HEX(calculado)}, esperado ${HEX(fila.esperado[alvo])}`,
      );
    }
  }

  // R14: cada probe segue tendo na imaxe exactamente os bytes que montou o
  // instrumento (ningún stream nin sonda veciña a puido pisar).
  for (const r of a.montado.sondas) {
    const real = img.subarray(r.sitio, r.sitio + r.bytes.length / 2).toString("hex").toUpperCase();
    if (real !== r.bytes.toUpperCase()) {
      throw new Error(`${nome}: bytes no sitio ${HEX(r.sitio)} diverxen dos montados (${real} ≠ ${r.bytes.toUpperCase()})`);
    }
  }
  return true;
}

export function gravarV2({ dir = DIR_A, seed = "d-frentes-a-v2" } = {}) {
  const a = buildAImageV2({ seed, dir: fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-v2-")) });
  validarEntradaA2(a);
  fs.mkdirSync(dir, { recursive: true });
  const imgPath = path.join(dir, NOME_IMG);
  const truthPath = path.join(dir, NOME_TRUTH);
  fs.writeFileSync(imgPath, a.img);
  fs.writeFileSync(truthPath, `${JSON.stringify(a.truth, null, 2)}\n`);
  const pin = {
    esquema: "rex-parallel-d/pin-frentes/2",
    xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_v2.mjs",
    gabarito: GABARITO,
    contrato: CONTRATO,
    denominador: a.truth.denominador,
    instrumento: a.truth.instrumento,
    arquivos: {
      [NOME_IMG]: { sha256: sha256(a.img), bytes: a.img.length },
      [NOME_TRUTH]: { sha256: sha256(fs.readFileSync(truthPath)), bytes: fs.statSync(truthPath).size },
    },
  };
  fs.writeFileSync(path.join(dir, NOME_PIN), `${JSON.stringify(pin, null, 2)}\n`);
  fs.rmSync(a.traballo, { recursive: true, force: true });
  return { ...a, pin, escritos: [imgPath, truthPath, path.join(dir, NOME_PIN)] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarV2();
  console.log(`[author v2] ${NOME_IMG} ${r.img.length} B sha ${sha256(r.img).slice(0, 16)}…`);
  console.log(`[author v2] ${Object.entries(r.truth.denominador.partes).map(([k, v]) => `${k} ${v}`).join(" · ")} = ${r.truth.denominador.total}`);
  for (const s of r.montado.sondas) {
    console.log(
      `  ${s.rotulo.padEnd(30)} 0x${s.sitio.toString(16).padStart(4, "0")}  ${s.bytes.toUpperCase().padEnd(14)} ${s.mnemonico}`,
    );
  }
}
