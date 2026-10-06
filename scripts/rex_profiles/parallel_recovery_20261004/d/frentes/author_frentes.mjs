/**
 * Autor de fixtures das frentes A/B/C (barra D, parallel_recovery_20261004).
 *
 * Estes artefactos son a VERDADE das sondas: imagens sintéticas escritas byte a
 * byte a partir da tabela ISA ancorada (`m68k_author.mjs`) e streams Kosinski
 * produzidas pelo codificador autoral de D (`lib_bench.mjs`), validado contra o
 * espelho da família B. Os gabaritos (`*-truth-v1.json`) são calculados POR
 * ARITMÉTICA AQUÍ, antes de qualquer execução das ferramentas das frentes;
 * nenhum valor é lido de saída delas (R9).
 *
 * Uso:  node scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_frentes.mjs
 * Saída: data/rex_profiles/parallel_recovery_20261004/d/frentes/{a,b,c}/ +
 *        holdout público em data/.../d/frentes/holdout/ e respostas reservadas
 *        fora da árvore (~/rds-scratch/rex-heldout-d2/).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  kosinskiEncode,
  kosinskiDecode,
  sha256,
  xerador as xeradorEscolhido,
} from "../lib_bench.mjs";
import {
  AGRAMA,
  CALIB,
  CALL,
  LEA,
  MOVEB_A0P_A1P,
  LEA_64_A1_A1,
  MOVEW_0_D0,
  moveq,
  w16,
  w32,
} from "./m68k_author.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../../../../.."); // raiz da worktree
export const DATA = path.join(
  RAIZ,
  "data/rex_profiles/parallel_recovery_20261004/d/frentes",
);
export const RESERVADO_DIR = path.join(
  process.env.HOME,
  "rds-scratch/rex-heldout-d2",
);

const h = (hex) => Buffer.from(hex, "hex");

/** Instruções escritas como {hex, tam, classe esperada por D, stems aceitos}. */
function insn(bytes, id, stem, notas) {
  const buf = Buffer.isBuffer(bytes) ? bytes : h(bytes);
  return { id, bytes: buf.toString("hex"), tam: buf.length, stems: stem, notas: notas ?? "" };
}

// ---------------------------------------------------------------------------
// Frente A — imagem sintética + streams + gabarito das 29 linhas
// ---------------------------------------------------------------------------

export const A_ROM_SIZE = 0x20000;

/** Padrão autoral explícito de D (rampa determinística, auditável à mão).
 *  Existe porque o xerador de roldas 1–2 (`makeRngDegeneradoV1`) devolvía sempre
 *  0 — ver errata §4 de `EXTENSOES-D.md` e regra R16. As fixtures ainda pendentes
 *  de medição (grade B, H-A, H-B) usam este padrão; as já medidas não são regravadas. */
export function padraoD(n, sementeTexto) {
  let s = 8191;
  for (const ch of Buffer.from(`${sementeTexto}|padrao-d`, "utf8")) s = (s * 33 + ch) >>> 0;
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i += 1) {
    const r = (i >> 6) & 0xff;
    const c = i & 0xff;
    out[i] = ((i * 37 + s) ^ (r * 131) ^ (c * 7)) & 0xff;
  }
  const distintos = new Set(out).size;
  if (distintos < Math.min(64, n)) throw new Error(`padrão D degenerado: ${distintos} valores em ${n}`);
  return out;
}

/** Constrói a imagem A e seu gabarito. `cfg` muda sementes/endereços para o
 *  holdout sem mudar a estrutura (mesmo código, mesmas aritméticas). */
export function buildAImage(cfg) {
  const {
    seed,
    romSize = A_ROM_SIZE,
    base = 0x100,
    rotina1 = 0x9000,
    rotina2 = 0x1f00,
    fluxo1 = 0x8000,
    fluxo2 = 0x8400,
    destinos,
    dadosFn = null,
    xerador: nomeXerador = "v1",
  } = cfg;
  const novo = xeradorEscolhido(nomeXerador);
  const img = Buffer.alloc(romSize, 0);
  // Rexistro de zonas ocupadas: a autoría non pode escribir dous contidos no
  // mesmo rango. Sen isto, un stream codificado máis longo que o oco previsto
  // pisa o stream seguinte e a imaxe deixa de ser un entrada válida (defecto que
  // invalidou H-A v1; errata §7 de EXTENSOES-D).
  const zonas = [];
  const marcar = (onde, len, nome) => {
    for (const z of zonas) {
      if (onde < z.onde + z.len && z.onde < onde + len) {
        throw new Error(
          `sobreposición de zonas na autoría: ${nome}@${onde.toString(16)}+${len} pisa ` +
            `${z.nome}@${z.onde.toString(16)}+${z.len}`,
        );
      }
    }
    zonas.push({ onde, len, nome });
  };
  const put = (addr, buf) => {
    if (addr % 2 !== 0) throw new Error(`sitio ímpar em autoria: ${addr.toString(16)}`);
    if (addr + buf.length > romSize) throw new Error(`escrita fora da imagem: ${addr.toString(16)}`);
    marcar(addr, buf.length, `codigo-${addr.toString(16)}`);
    buf.copy(img, addr);
    return addr + buf.length;
  };

  // rotinas descompressoras falsas: 15×nop + rts (32 B) — conteúdo autoral.
  const rotina = Buffer.concat(Array(15).fill(h("4e71")).concat(h("4e75")));
  if (rotina.length !== 32) throw new Error("rotina autoral deve ter 32 B");
  put(rotina2, rotina);
  put(rotina1, rotina);

  // streams Kosinski autorais
  const mk = (n, tag) => {
    let plain;
    if (dadosFn) {
      plain = dadosFn(n, `${seed}|${tag}`);
    } else {
      const rng = novo(`${seed}|${tag}`);
      plain = Buffer.from(Array.from({ length: n }, () => rng()));
    }
    const { stream } = kosinskiEncode(plain);
    return { plain, stream };
  };
  const s1 = mk(1024, "s1");
  const s2 = mk(128, "s2");
  const s3full = mk(512, "s3");
  // truncada: sem o token EOD (3 bytes de dados do descritor final); o fluxo
  // termina exatamente no fim da imagem, então o decodificador bate no EOF.
  const s3 = { plain: s3full.plain, stream: s3full.stream.subarray(0, s3full.stream.length - 3) };
  // Colocación de s2: cando o chamador non fixa `fluxo2`, deriva del tamaño real
  // do stream codificado (o oco fixo da fixture medida non sobreviviría a datos
  // non dexenerados).
  const f2 =
    fluxo2 ?? Math.ceil((fluxo1 + s1.stream.length + 0x100) / 0x100) * 0x100;
  const fluxo3 = romSize - s3.stream.length;
  if (fluxo3 < 0x2000) throw new Error("stream 3 não cabe no fim da imagem");
  marcar(fluxo1, s1.stream.length, "fluxo-s1");
  marcar(f2, s2.stream.length, "fluxo-s2");
  marcar(fluxo3, s3.stream.length, "fluxo-s3");
  s1.stream.copy(img, fluxo1);
  s2.stream.copy(img, f2);
  s3.stream.copy(img, fluxo3);

  // sítios de código
  const p = {};
  p.carga_s1 = base;
  put(base, LEA.absL(0, fluxo1));
  p.chamada_ka3 = base + 6;
  put(base + 6, AGRAMA.jsrL(rotina1));
  p.carga_s2 = base + 0x10;
  put(base + 0x10, LEA.absW(1, f2));
  p.carga_pc = base + 0x14;
  {
    const sitio = base + 0x14;
    const cru = fluxo1 - (sitio + 2);
    // O desprazamento de LEA d16(PC) é ASINADO: fóra de [-0x8000, 0x7FFF] a
    // instrución apunta fóra da imaxe e a fila deixa de medir a forma de carga
    // (defecto que invalidou a fila KA1-3 de H-A v2).
    if (cru < -0x8000 || cru > 0x7fff) {
      throw new Error(
        `desprazamento d16(PC) fóra da xanela asinada: ${cru} (sitio ${sitio.toString(16)} → fluxo ${fluxo1.toString(16)})`,
      );
    }
    put(sitio, LEA.d16pc(2, cru & 0xffff));
  }
  // pares carga→chamada: cada um usa a carga de fluxo válido + chamada à rotina2
  const pares = [
    ["bsr.w", (sitio) => AGRAMA.bsrW(rotina2 - (sitio + 2)), "bsr.w"],
    ["bsr.l", (sitio) => AGRAMA.bsrL((rotina2 - (sitio + 4)) >>> 0), "bsr.l"],
    ["jsr.l", () => AGRAMA.jsrL(rotina2), "jsr.l"],
    ["jsr.w", () => AGRAMA.jsrW(rotina2), "jsr.w"],
    ["jmp.l", () => AGRAMA.jmpL(rotina2), "jmp.l"],
    ["jmp.w", () => AGRAMA.jmpW(rotina2), "jmp.w"],
  ];
  let cursor = base + 0x18;
  for (const [nome, mkcall, forma] of pares) {
    p[`carga_${nome}`] = cursor;
    put(cursor, LEA.absL(3, fluxo1));
    cursor += 6;
    p[`chamada_${nome}`] = cursor;
    put(cursor, mkcall(cursor));
    cursor += forma === "bsr.l" ? 6 : forma === "jsr.l" || forma === "jmp.l" ? 6 : 4;
  }
  p.carga_s3 = cursor;
  put(cursor, LEA.absL(4, fluxo3));
  cursor += 6;

  // sondas de limite de ISA (KA1-b): fora da gramática alegada por A
  p.movea_imm = base + 0x80;
  put(base + 0x80, h(CALIB.moveal_imm_a1));
  p.indexado = base + 0x88;
  put(base + 0x88, h(CALIB.moveb_idx_a1_d2w));

  // destinos para KA2 (classificação de região)
  p.destinos = {};
  destinos.forEach(([addr, _rotulo, _esperado], i) => {
    const sitio = base + 0x100 + i * 8;
    p.destinos[addr.toString(16)] = sitio;
    put(sitio, LEA.absL(i % 8, addr));
  });

  const truth = {
    esquema: "rex-parallel-d/frente-a/1",
    gerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_frentes.mjs",
    imagem: { rom_size: romSize, tam: img.length, sha256: sha256(img) },
    config: { seed, base, rotina1, rotina2, fluxo1, fluxo2: f2, fluxo3 },
    sítios: p,
    streams: {
      s1: {
        offset: fluxo1,
        plain_len: s1.plain.length,
        plain_sha256: sha256(s1.plain),
        stream_len: s1.stream.length,
        stream_sha256: sha256(s1.stream),
        terminator: true,
      },
      s2: {
        offset: f2,
        plain_len: s2.plain.length,
        plain_sha256: sha256(s2.plain),
        stream_len: s2.stream.length,
        stream_sha256: sha256(s2.stream),
        terminator: true,
      },
      s3: {
        offset: fluxo3,
        plain_len: s3.plain.length,
        plain_sha256: sha256(s3.plain),
        stream_len: s3.stream.length,
        stream_sha256: sha256(s3.stream),
        terminator: false,
        motivo: "EOD removido e fluxo no fim da imagem: EOF sem terminator",
      },
    },
    rotinas: {
      [rotina1.toString(16)]: { sitio: rotina1, lonxitude: 32, sha256: sha256(rotina) },
      [rotina2.toString(16)]: { sitio: rotina2, lonxitude: 32, sha256: sha256(rotina) },
    },
    ka1: ka1Esperado(p, { fluxo1, fluxo2: f2, rotina2 }, pares),
    ka1b: [
      {
        id: "KA1-b-9",
        sonda: "movea.l #imm32,An",
        sitio: p.movea_imm,
        bytes: CALIB.moveal_imm_a1,
        esperado: "recusa_sem_cadeia",
        nota_isa:
          "A §3 alega `0A?? FC` para esta forma; a âncora externa (isol-objdump/r*-objdump) " +
          "dá `227C …`. D mede a recusa e registra a divergência de ISA como defeito documental.",
      },
      {
        id: "KA1-b-10",
        sonda: "palavra de extensão indexada d8(An,Dn.W)",
        sitio: p.indexado,
        bytes: CALIB.moveb_idx_a1_d2w,
        esperado: "recusa_sem_cadeia",
        nota_isa: "fora da gramática §3; âncora `1031 2000` medida no adendo de C.",
      },
    ],
    ka2: destinos.map(([addr, rotulo, esperado]) => ({
      id: `KA2-${rotulo}`,
      destino_sitio: p.destinos[addr.toString(16)],
      destino_operando: addr,
      esperado_rexion: esperado,
      fonte_expectativa: "EXPECTATIONS-A §4 (tabela congelada da própria frente)",
    })),
    ka3: {
      id: "KA3",
      carga_sitio: p.carga_s1,
      chamada_sitio: p.chamada_ka3,
      esperado: {
        rc: 0,
        carga_forma: "lea.l/A0",
        carga_operando: fluxo1,
        carga_bytes: LEA.absL(0, fluxo1).toString("hex").toUpperCase(),
        chamada_forma: "jsr.l",
        chamada_alvo: rotina1,
        rutina_sitio: rotina1,
        rutina_lonxitude: 32,
        rutina_sha256: sha256(rotina),
        fluxo_cpu: fluxo1,
        fluxo_offset: fluxo1,
        tramo_entrada: romSize - fluxo1,
        bytes_consumidos: s1.stream.length,
        saida_bytes: s1.plain.length,
        saida_sha256: sha256(s1.plain),
        confianza: "vinculo-estrutural",
        mapper: "md-linear",
        estado_mapper: `rom_size=0x${romSize.toString(16).padStart(6, "0").toUpperCase()}`,
      },
      revalidar_esperado_rc: 0,
    },
    ka4: [
      {
        id: "KA4-1",
        carga_sitio: p.carga_s1,
        fluxo: "s1",
        esperado: { rc: 0, saida_sha256: sha256(s1.plain), saida_bytes: s1.plain.length, bytes_consumidos: s1.stream.length },
      },
      {
        id: "KA4-2",
        carga_sitio: p.carga_s2,
        fluxo: "s2",
        esperado: { rc: 0, saida_sha256: sha256(s2.plain), saida_bytes: s2.plain.length, bytes_consumidos: s2.stream.length },
      },
      {
        id: "KA4-3",
        carga_sitio: p.carga_s3,
        fluxo: "s3",
        esperado: { rc: 10, motivo: "INCONCLUSIVE-TRUNCADA; rc 0 é proibido sem terminator" },
      },
    ],
    ta: receitas(p, { fluxo1, rotina2 }),
    ka3g: [
      { id: "KA3-g-a", mutacion: "campo_desconhecido", esperado_rc: 2 },
      { id: "KA3-g-b", mutacion: "confianza=observado-en-runtime", esperado_rc: 2 },
    ],
    denominador: { total: 29, partes: { KA1: 9, "KA1-b": 2, KA2: 4, KA3: 1, "KA3-g": 2, KA4: 3, TA: 8 } },
    limites_de_autoria: [
      "sem assembler m68k neste host: as formas de A são escritas pela tabela AGRAMA congelada (EXPECTATIONS-A §3), não pelo ISA real; as linhas que divergem do ISA real ficam anotadas como defeito de ISA preservado",
      "as imagens sintéticas não são ROM comercial; nenhuma delas é BYOR",
    ],
  };
  return { img, truth };
}

function ka1Esperado(p, { fluxo1, fluxo2, rotina2 }, pares) {
  const linhas = [
    {
      id: "KA1-1",
      forma: "lea (xxx).L,An",
      carga_sitio: p.carga_s1,
      esperado: { carga_forma: "lea.l/A0", carga_operando: fluxo1 },
    },
    {
      id: "KA1-2",
      forma: "lea (xxx).W,An",
      carga_sitio: p.carga_s2,
      esperado: { carga_forma: "lea.w/A1", carga_operando: fluxo2 },
      nota: "extensão curta sem signo (EXPECTATIONS-A §3)",
    },
    {
      id: "KA1-3",
      forma: "lea (d16,PC),An",
      carga_sitio: p.carga_pc,
      esperado: { carga_forma: "lea.pcd16/A2", carga_operando: fluxo1 },
      nota: "base = sitio + 2",
    },
  ];
  pares.forEach(([nome, _mk, forma]) => {
    linhas.push({
      id: `KA1-${nome}`,
      forma: `chamada ${nome}`,
      carga_sitio: p[`carga_${nome}`],
      chamada_sitio: p[`chamada_${nome}`],
      esperado: { carga_forma: "lea.l/A3", chamada_forma: forma, chamada_alvo: rotina2 },
    });
  });
  return linhas;
}

/** Receitas de adulteração (TA=8) — mutações aplicadas pelo adaptador sobre a
 *  cadeia produzida pela FERRAMENTA real ou sobre cópia da imagem. */
function receitas(p, { fluxo1, rotina2 }) {
  return [
    {
      id: "TA-1",
      eixo: "identidade",
      alvo: "imagem",
      acao: { tipo: "xor-byte", offset: 0x2fff, valor: 0xff },
      esperado_rc: 3,
      motivo: "ROM divergente do pin antes de qualquer medição",
    },
    {
      id: "TA-2",
      eixo: "saída",
      alvo: "imagem",
      acao: { tipo: "xor-byte", offset: fluxo1 + 8, valor: 0x5a, reapin_imaxe: true },
      esperado_rc: 9,
      motivo:
        "byte no meio do stream muda a saída pinada. Erata pré-medição de D: sem " +
        "re-pinar imaxe_sha256 na cadeia, a mutação é pega pelo elo identidade (rc 3) " +
        "e a receita mede o eixo errado. O adaptador grava as dúas variantes: a " +
        "isolada (esta, con re-pin) é a fila TA-2; a confundida (pin orixinal) queda " +
        "como control observado rc 3 e non pontúa.",
    },
    {
      id: "TA-3",
      eixo: "geometria",
      alvo: "cadeia",
      acao: {
        tipo: "chamada-fora-da-ventana",
        sitio: p["chamada_jsr.l"],
        bytes: AGRAMA.jsrL(rotina2).toString("hex").toUpperCase(),
        alvo: rotina2,
      },
      esperado_rc: 11,
      motivo:
        "chamada real declarada nun sitio lexítimo fóra da ventá tras a carga: só a " +
        "xeometría pode rexeitala. Erata pré-medição de D: a receita original (+1, " +
        "sitio ímpar) cae no elo sitio-chamada (bytes diverxentes, rc 5) porque A " +
        "compara bytes antes de mirar o aliñamento — leído en verify.rs, non medido. " +
        "A inalcanzabilidade da guarda de aliñamento queda rexistrada como " +
        "observación de auditoría, non como fila do denominador.",
    },
    {
      id: "TA-4",
      eixo: "sítio",
      alvo: "cadeia",
      acao: { tipo: "campo-hex-inverter", campo: "carga_bytes" },
      esperado_rc: 5,
      motivo: "bytes do sitio de carga divergentes da imagem",
    },
    {
      id: "TA-5",
      eixo: "sítio",
      alvo: "cadeia",
      acao: { tipo: "campo", campo: "carga_operando", delta: 4 },
      esperado_rc: 6,
      motivo: "operando .L alterado no registro, imagem inalterada",
    },
    {
      id: "TA-6",
      eixo: "sítio",
      alvo: "cadeia",
      acao: { tipo: "campo", campo: "chamada_alvo", delta: 2 },
      esperado_rc: 7,
      motivo:
        "alvo da chamada divergente. Erata pré-medição de D: a redação original " +
        "dizia 'bytes da chamada alterados', que em A cai no elo sitio-chamada (rc 5); " +
        "esta receita mede o eixo alvo de forma não ambígua.",
    },
    {
      id: "TA-7",
      eixo: "sítio",
      alvo: "cadeia",
      acao: { tipo: "campo-hex-inverter", campo: "rutina_sha256" },
      esperado_rc: 8,
      motivo:
        "hash da rotina adulterado no rexistro (conteúdo, conservando a forma de 64 " +
        "hex minúsculas). Mesmo illamento que TA-2: trocar os bytes da rutina na " +
        "imaxe mudaría imaxe_sha256 e a cadea caería primeiro no elo identidade " +
        "(rc 3); a receita atinxe o pin da cadea, non a imaxe. Primeira execución " +
        "(2026-10-04): a inversión en maiúsculas deu rc 2 'rutina_sha256 fora de " +
        "forma' — rexistrado como observación, non reescrito.",
    },
    {
      id: "TA-8",
      eixo: "confiança",
      alvo: "cadeia",
      acao: { tipo: "campo", campo: "fluxo_offset", delta: 2 },
      esperado_rc: 4,
      motivo: "tradução do mapper divergente do offset registrado",
    },
  ];
}

// ---------------------------------------------------------------------------
// Frente C — 4 imagens autorais + gabarito (42 linhas)
// ---------------------------------------------------------------------------

const KC1_INSN = [
  insn(CALIB.moveb_a0p_d1, "move.b (A0)+,D1", ["mov"]),
  insn(CALIB.moveb_a2m_d3, "move.b -(A2),D3", ["mov"]),
  insn(CALIB.moveb_d16a1_d2, "move.b d16(A1),D2", ["mov"]),
  insn(CALIB.movew_a3_d6, "move.w (A3),D6", ["mov"]),
  insn(CALIB.movel_d16pc_d0, "move.l d16(PC),D0", ["mov"]),
  insn(CALIB.movel_imm_d4, "move.l #imm32,D4", ["mov"]),
  insn(CALIB.moveal_imm_a1, "movea.l #imm32,A1", ["mov"]),
  insn(CALIB.movel_a0p_a3, "move.l (A0)+,A3", ["mov"]),
  insn(CALIB.moveq_15_d4, "moveq #15,D4", ["mov"]),
  insn(CALIB.movew_sr_d6, "move.w SR,D6", ["mov"]),
  insn(CALIB.addqb_4_a3, "addq.b #4,(A3)", ["add"]),
  insn(CALIB.addqw_1_d3, "addq.w #1,D3", ["add"]),
  insn(CALIB.addl_d2_a1, "add.l D2,(A1)", ["add"]),
  insn(CALIB.cmpw_a2_d0, "cmp.w (A2),D0", ["cmp"]),
  insn(CALIB.tstw_abs_l, "tst.w abs.L", ["tst"]),
  insn(CALIB.bclr_2_a1, "bclr #2,(A1)", ["bclr", "bic", "bittest"]),
  // Familia Scc: D afirma o comprimento (2 B) da aritmética da ISA; non existe
  // nesta host unha gravación obxectiva externa que ancore o mnemónico Scc
  // (r1/r2/r2-objdump só ancóran DBcc 51c8..51ce), polo que a fila gradúa o
  // comprimento e acepta calquer mnemónico da familia (tolerancia declarada,
  // rexistrada como limitación no RELATORIO, non como afirme de C).
  insn(CALIB.seq_d1, "seq D1", ["seq", "scc", "shs", "stt", "sf"], "familia Scc; comprimento ancorado, mnemónico tolerado"),
  insn("4c9d00e0", "movem.w (A5)+,D5-D7", ["movem"]),
  insn(LEA.absL(0, 0x2020), "lea abs.L,A0", ["lea"]),
  insn(CALIB.lea_d16pc_a5, "lea d16(PC),A5", ["lea"]),
];

/** Formas das sondas KC1 que **non** están na lista fechada §3 do
 *  `CONTRACT.md` da propia frente C (citado do documento delas, non de ningunha
 *  execución). Para estas filas o comportamento correcto é *recusar con
 *  rexistro* (EXTENSOES-D §1 «não suportado»: a recusa limpa é o item medido);
 *  decodificalas cun comprimento afirmado sería `falha`. */
export const FORA_DO_SUBCONXUNTO_C = Object.freeze({
  "move.l d16(PC),D0":
    "§3 lista os modos de MOVE (registros, (An), (An)+, -(An), d16(An), " +
    "d8(An,Xn), abs.W, abs.L, #imm só em MOVE); fonte d16(PC) non está na lista",
  "movea.l #imm32,A1":
    "§3: «#imm só em MOVE» — MOVEA con inmediato está fóra da lista fechada",
});

export function buildCX1() {
  const bytes = Buffer.concat(KC1_INSN.map((i) => h(i.bytes)));
  const raizes = [];
  let addr = 0;
  const mapa = [];
  for (const i of KC1_INSN) {
    mapa.push({ ...i, endereco: addr });
    raizes.push({ endereco: addr, proveniencia: "candidato", evidencia: `sonda KC1 ${i.id}` });
    addr += i.tam;
  }
  if (addr % 2 !== 0) throw new Error("KC1: fim de sequência ímpar");
  // Relleno 0xFF (non 0x00): `0000` decodifica como `ori.b #imm,Dn`, que está
  // NA lista de C, e a varredura tragaría o relleno byte a byte; con 0xFF o
  // rabo da rexión quedaestruturalmente inalcanzable, que é o que a fila de
  // vereditos `dentro-regiao-nao-alcancado` precisa para existir.
  const img = Buffer.alloc(0x80, 0xff);
  bytes.copy(img, 0);
  const fimInstrucoes = addr;
  const sitios = [
    { endereco: mapa[0].endereco, esperado_veredito: "instrucao-de-bloco" },
    { endereco: mapa[2].endereco + 2, esperado_veredito: "miolo-de-instrucao", motivo: "dentro de move.b d16(A1),D2 (4 B)" },
    { endereco: fimInstrucoes + 0x0e, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: `dentro do relleno 0xFF que comeza en 0x${fimInstrucoes.toString(16)} (aritmética de D, non saída de C)` },
  ];
  const truth = {
    id: "dC-cx1",
    regioes: [{ inicio: 0, fim: 0x80 }],
    raizes,
    sitios,
    sequencia: mapa,
    cobertura_esperada_bytes: mapa.reduce((a, i) => a + i.tam, 0),
    fim_instrucoes: fimInstrucoes,
    kc1: mapa.map((i) => {
      const fora = FORA_DO_SUBCONXUNTO_C[i.id];
      return {
        id: `KC1-${i.id}`,
        endereco: i.endereco,
        esperado_tam: i.tam,
        esperado_stems: i.stems,
        bytes: i.bytes,
        dominio: fora ? "fora-do-subconjunto-de-C" : "alegado-por-C",
        citacao_C: fora ?? "§3: forma dentro da lista fechada declarada por C",
      };
    }),
  };
  return { img, truth };
}

export function buildCX2() {
  // fluxo com desvios: moveq / bcc.w(d16) / nop / bsr.w / dbra laço / rts / rts
  // Corrección pre-mediación (2026-10-04, sen resultado anexado): o deseño
  // anterior escribía a dbra en 0x0A *dentro* dos bytes de expansión do bsr.w
  // de 0x08 (que ocupa 0x08..0x0B) e usaba `51c0fffe`, que a grabación externa
  // de objdump non admite como DBcc. Ancoraxes reais usadas:
  //   r1-objdump.txt:8  `18ac: 51cc 000c  dbf %d4,0x18ba`  → DBcc = 0101 cccc
  //   r2-objdump.txt    51c9/51ca/51cb/51cc/51cd/51ce = dbf %d1..%d6, polo que
  //                     dbra D0 = 51c8 e a base do desvío é sitio+2.
  //   r1-objdump.txt:15 `18bc: 6404  bccs` → cc 0100 = BCC, logo 6400 = bcc.w.
  const layout = [
    [0x00, "7000", "moveq #0,D0"],
    [0x02, "6400000c", "bcc.w → alvo 0x10 (base = sitio+2)"],
    [0x06, "4e71", "nop"],
    [0x08, "61000008", "bsr.w → alvo 0x12 (base = sitio+2)"],
    [0x0c, "51c8fffe", "dbra D0 → alvo 0x0C (laço propio, base = sitio+2)"],
    [0x10, "4e75", "rts"],
    [0x12, "4e75", "rts"],
  ];
  const img = Buffer.alloc(0x18, 0xff);
  for (const [a, hexes, _n] of layout) h(hexes).copy(img, a);
  const tamPorAddr = new Map(layout.map(([a, hexes]) => [a, hexes.length / 2]));
  const decodificados = [0x00, 0x02, 0x06, 0x08, 0x0c, 0x10, 0x12].reduce(
    (s, a) => s + tamPorAddr.get(a),
    0,
  );
  const truth = {
    id: "dC-cx2",
    regioes: [{ inicio: 0, fim: 0x18 }],
    raizes: [{ endereco: 0, proveniencia: "candidato", evidencia: "entrada autoral do fluxo" }],
    sitios: [
      { endereco: 0x03, esperado_veredito: "miolo-de-instrucao", motivo: "dentro de bcc.w (4 B em 0x02)" },
      { endereco: 0x14, esperado_veredito: "dentro-regiao-nao-alcancado", motivo: "fill 0xFF após o último rts (0x12)" },
    ],
    kc2: [
      { id: "KC2-base-bcc-w", endereco: 0x02, esperado: { tam: 4, alvo: 0x10, base: "sitio+2", discriminante: "base sitio+4 daria 0x12" } },
      { id: "KC2-bcc-d16", endereco: 0x02, esperado: { tam: 4, alvo: 0x10, tipo_aresta: "desvio" } },
      { id: "KC2-bsr-w", endereco: 0x08, esperado: { tam: 4, alvo: 0x12, base: "sitio+2" } },
      { id: "KC2-dbra-ext", endereco: 0x0c, esperado: { tam: 4, alvo: 0x0c, nota: "laço próprio por disp −2; DBcc ancorado em 51c8 = dbra D0" } },
      { id: "KC2-queda", endereco: 0x02, esperado: { sucessor_queda: 0x06 } },
      { id: "KC2-indexado", endereco: null, esperado: { nota: "provado em dC-cx4 em 0x2020 (`1031 2000`)" } },
    ],
    kc5: [
      { id: "KC5-diamante", endereco: 0x02, esperado: { ramos: 2, tipos: ["queda", "desvio"] } },
      { id: "KC5-queda-pos-condicional", esperado: { origem: 0x02, alvo: 0x06, tipo: "queda" } },
      { id: "KC5-rts-nao-continua", endereco: 0x10, esperado: { sucessores: 0, tipo: "retorno-fronteira" } },
      {
        id: "KC5-cobertura",
        esperado: { bytes_decodificados: decodificados, bytes_regiao: 0x18 },
        nota: "D recompõe Σ dos comprimentos autorais; a string `fracao` de C não é graduada",
      },
      { id: "KC5-vereditos", esperado: { miolo: 0x03, nao_alcancado: 0x14 } },
    ],
    limites_de_autoria: ["nenhum byte deste fixture vem do decodificador de C"],
  };
  return { img, truth };
}

export function buildCX3() {
  // fronteiras: linha-F, BSR.L (forma 68020), combinação inválida MOVE.W #imm,An
  const s = { lf: 0x00, bsrl: 0x10, invalido: 0x20, rts: 0x30 };
  const img = Buffer.alloc(0x40, 0);
  h("f000").copy(img, s.lf);
  AGRAMA.bsrL(0x10).copy(img, s.bsrl); // 61 FF disp32 — forma 68020
  Buffer.concat([w16(0x3048), w16(0)]).copy(img, s.invalido); // move.w #imm,An (inválido)
  h("4e75").copy(img, s.rts);
  const truth = {
    id: "dC-cx3",
    regioes: [{ inicio: 0, fim: 0x40 }],
    raizes: [
      { endereco: s.lf, proveniencia: "candidato", evidencia: "sonda linha-F" },
      { endereco: s.bsrl, proveniencia: "candidato", evidencia: "sonda BSR.L 68020" },
      { endereco: s.invalido, proveniencia: "candidato", evidencia: "sonda MOVE.W #imm,An" },
      { endereco: s.rts, proveniencia: "candidato", evidencia: "controle: caminho limpo" },
    ],
    sitios: [{ endereco: s.rts, esperado_veredito: "instrucao-de-bloco" }],
    kc3: [
      {
        id: "KC3-linha-f",
        endereco: s.lf,
        opcode: "f000",
        esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto", endereco: s.lf, bytes_para: 2 },
      },
      {
        id: "KC3-bsr-l-68020",
        endereco: s.bsrl,
        opcode: "61ff",
        esperado: { fronteira: true, tipo: "opcode-fora-do-subconjunto", endereco: s.bsrl, nota: "forma de deslocamento longo é de 68020; o subconjunto declarado por C é 68000" },
      },
      {
        id: "KC3-move-w-imm-an",
        endereco: s.invalido,
        opcode: "3048",
        esperado: { fronteira: true, endereco: s.invalido, nota: "combinação destino An em MOVE.W é inválida no ISA" },
      },
    ],
    controle_positivo: { endereco: s.rts, esperado: { tam: 2, mnem_contem: "rts" } },
    notas_autoria: [
      "`f000` ancorado em CALIB.linef_f000 (registro externo).",
      "`61ff` é a forma longa que a própria frente A documenta como 68020 (FA-4).",
      "`3048` deriva do layout de bits MOVE documentado no cabeçalho de m68k_author.mjs " +
        "(mesma cabeça de `303c` = move.w #imm,Dn, âncora B `303c0000`), trocando o campo " +
        "de modo de destino para registrador de endereçamento.",
    ],
  };
  return { img, truth };
}

export function buildCX4() {
  const origin = 0x2000;
  const a = {
    moveq: 0x2000,
    jsr: 0x2002,
    jmpfora: 0x2008,
    indexado: 0x2020,
    jmpind: 0x2024,
    trap: 0x2028,
    fim: 0x202c,
  };
  const img = Buffer.alloc(a.fim - origin, 0);
  const put = (addr, buf) => buf.copy(img, addr - origin);
  put(a.moveq, moveq(0, 0));
  put(a.jsr, CALL.jsrL(a.indexado));
  put(a.jmpfora, CALL.jmpL(0x01234567));
  put(a.indexado, h(CALIB.moveb_idx_a1_d2w));
  put(a.jmpind, h(CALIB.jmp_a2_ind));
  put(a.trap, h(CALIB.trap_4));
  const truth = {
    id: "dC-cx4",
    origin,
    regioes: [{ inicio: a.moveq, fim: a.fim }],
    raizes: [
      { endereco: a.moveq, proveniencia: "candidato", evidencia: "entrada autoral" },
      { endereco: a.trap, proveniencia: "referencia-estatica", evidencia: "sonda de trap isolada" },
    ],
    sitios: [
      { endereco: a.indexado, esperado_veredito: "instrucao-de-bloco" },
      { endereco: 0x12345678, esperado_veredito: "fora-da-regiao" },
    ],
    kc4: [
      {
        id: "KC4-jsr-abs-l-intra",
        endereco: a.jsr,
        esperado: { origem: a.jsr, alvo: a.indexado, status: "resolvido", derivado: "dentro-de-fluxo" },
      },
      {
        id: "KC4-jmp-abs-l-extra",
        endereco: a.jmpfora,
        esperado: { origem: a.jmpfora, alvo: 0x01234567, tipo: "fora-da-regiao", decodificado_fora: 0 },
      },
      {
        id: "KC4-jmp-ind-an",
        endereco: a.jmpind,
        opcode: CALIB.jmp_a2_ind,
        esperado: { fronteira: "indirect-opaco", alvo: null, endereco: a.jmpind },
      },
      {
        id: "KC4-trap-n",
        endereco: a.trap,
        opcode: CALIB.trap_4,
        esperado: { fronteira: "trap-opaco", endereco: a.trap },
      },
    ],
    kc2_indexado: {
      id: "KC2-indexado",
      endereco: a.indexado,
      bytes: CALIB.moveb_idx_a1_d2w,
      esperado: { tam: 4, origem: "d8(A1,D2.W)", destino: "D0" },
      nota: "`1031 2000` — âncora do adendo de C; palavra de extensão I=0, reg=D2, W, disp=0",
    },
    tc: [
      { id: "TC-1", acao: { tipo: "cli", flag: "--root-prov", valor: "oraculo-externo" }, esperado_rc: 2, motivo: "vocabulário de proveniência fechado" },
      { id: "TC-2", acao: { tipo: "site", endereco: 0x2003 }, esperado: { veredito: "miolo-de-instrucao" }, motivo: "0x2002 é jsr abs.L (6 B); 0x2003 é miolo" },
      { id: "TC-3", acao: { tipo: "site", endereco: 0x9000 }, esperado: { veredito: "fora-da-regiao" }, motivo: "sitio além de 0x202C" },
      {
        id: "TC-4",
        acao: { tipo: "xor-byte-imagem", offset_na_arquivo: a.jmpind - origin, valor: 0x04 },
        esperado: { delta_cobertura_bytes: -2, nota: "4ED2 (jmp (A2), 2 B) vira 4ED6 = jmp (A6): mesmo comprimento; por isso a mutação escolhida é a que TROCA o comprimento" },
        revisado: "ver `tc4_plano` — a mutação final é escrita ali depois de fixada a aritmética",
      },
    ],
  };
  // TC-4 precisa de mutação que MUDE o comprimento de forma comprovada:
  // 4E71 (nop, 2 B) → F000 (linha-F, fronteira) encurta o bloco em exatamente 2 B.
  truth.tc[3] = {
    id: "TC-4",
    acao: { tipo: "xor-byte-imagem", offset_na_arquivo: a.moveq - origin, valor: 0xf0 ^ 0x70 },
    esperado: {
      endereco_mutado: a.moveq,
      bytes_antes: "7000",
      bytes_depois: "f000",
      delta_cobertura_bytes: 0,
      invariantes: [
        "o export reporta fronteira no endereço 0x2000 com opcode f000",
        "a instrução em 0x2000 deixa de constar como decodificada",
        "o restante do bloco (0x2002..) mantém os comprimentos autorais",
      ],
    },
    motivo: "sonda de comprimento: a adulteração tem de aparecer na cobertura, não ser absorvida",
  };
  return { img, truth };
}

// ---------------------------------------------------------------------------
// Frente B — grade autoral 64×64 + projeção esperada (14 linhas)
// ---------------------------------------------------------------------------

export const B_LINHAS = 64;
export const B_COLUNAS = 64;
export const B_STRIDE = 128;
export const B_BASE_LAYOUT = 0xff1020;

export function buildBGrid(seed) {
  const plain = padraoD(B_LINHAS * B_COLUNAS, `${seed}|grid`);
  // projeção esperada por Aritmética de D: RAM[base + r*128 + c] = plain[r*64+c]
  const buf = Buffer.alloc(B_LINHAS * B_STRIDE, 0);
  for (let r = 0; r < B_LINHAS; r += 1) {
    plain.copy(buf, r * B_STRIDE, r * B_COLUNAS, (r + 1) * B_COLUNAS);
  }
  const inverso = Buffer.alloc(plain.length, 0);
  for (let r = 0; r < B_LINHAS; r += 1) {
    buf.copy(inverso, r * B_COLUNAS, r * B_STRIDE, r * B_STRIDE + B_COLUNAS);
  }
  const paddingLimpo = Buffer.alloc(B_LINHAS * (B_STRIDE - B_COLUNAS), 0);
  const truth = {
    esquema: "rex-parallel-d/frente-b/1",
    id: "dB-grid-v1",
    plain: { tam: plain.length, sha256: sha256(plain) },
    projecao: {
      base: B_BASE_LAYOUT,
      stride: B_STRIDE,
      linhas: B_LINHAS,
      colunas: B_COLUNAS,
      tam: buf.length,
      sha256: sha256(buf),
      aritmetica: "buffer[r*128 + c] = plain[r*64 + c]; padding r*128+64..r*128+127 = 0",
    },
    round_trip: { identico: inverso.equals(plain), sha_inverso: sha256(inverso) },
    padding_esperado_sha256: sha256(paddingLimpo),
    celulas_discriminantes: [
      { r: 0, c: 0, no_plain: 0, no_buffer: 0, valor: plain[0] },
      { r: 0, c: 63, no_plain: 63, no_buffer: 63, valor: plain[63] },
      { r: 1, c: 0, no_plain: 64, no_buffer: 128, valor: plain[64] },
      { r: 63, c: 63, no_plain: 63 * 64 + 63, no_buffer: 63 * 128 + 63, valor: plain[63 * 64 + 63] },
    ],
    kb1: [
      {
        id: "KB1-chamada",
        endereco: 0x1b6d2,
        esperado_bytes: "4eb90000171e",
        fonte: "CALIB.jsr_abs_l (registro externo) + alegação do contrato B",
        oraculo: "bytes da ROM BYOR pinada (lidos por D), não o doc de B",
      },
      {
        id: "KB1-copia-byte",
        endereco: 0x1b6f8,
        esperado_bytes: MOVEB_A0P_A1P.toString("hex"),
        fonte: "derivado do layout MOVE de D; âncoras `1218`/`10c1`",
      },
      {
        id: "KB1-salto-padding",
        endereco: 0x1b6fe,
        esperado_bytes: LEA_64_A1_A1.toString("hex"),
        fonte: "CALIB: `43e9 0040` = lea 64(a1),a1",
      },
      {
        id: "KB1-contadores",
        endereco: [0x1b6f4, 0x1b6f6],
        esperado_bytes: ["723f", "743f"],
        fonte: "moveq #63,D1 / moveq #63,D2 por `moveq(imm,dn)` de D (âncora `780f`)",
      },
    ],
    kb2: [
      {
        id: "KB2-value-offset",
        endereco: 0x1b6ce,
        esperado_bytes: MOVEW_0_D0.toString("hex"),
        fonte: "move.w #0,D0 de D (âncora `303c0000` de B conferida em ROM)",
      },
      {
        id: "KB2-tabela",
        endereco: 0x1b64c,
        entradas: 6,
        esperado_words: [0x65432, 0x656ac, 0x65abe, 0x65e1a, 0x662f4, 0x667c6],
        fonte: "ponteiros lidos por D como 6 palavras longas big-endian na ROM pinada",
      },
    ],
    kb3: [
      { id: "KB3-aceite", acao: "layout_de_plain(plain)", esperado: "aceito" },
      { id: "KB3-recusa-64x32", acao: "layout_de_plain(plain, linhas=32)", esperado_codigo: "geometria-errada" },
      { id: "KB3-recusa-grade", acao: "projetar(plain, colunas=32)", esperado_codigo: "geometria-errada" },
      { id: "KB3-recusa-stride", acao: "projetar(plain, stride=64)", esperado_codigo: "geometria-errada" },
    ],
    kb4: [
      { id: "KB4-roundtrip", acao: "inverso_projecao(projetar(plain))", esperado: "identico ao plain autoral" },
      { id: "KB4-padding-sujo", acao: "inverso_projecao(buffer com 1 byte de padding != 0)", esperado_codigo: "padding-sujo" },
    ],
    nb: [
      { id: "NB-1", acao: "verificar-cadeia.py cadeia --modo hipotetico", esperado: "rótulo HIPOTETICO e nenhuma promoção" },
      {
        id: "NB-2",
        acao: "cópia da ROM com 1 byte virado → modo verificado",
        esperado: "recusa rom-errada/nao-promovido; auditoria da prova anexa (D recalcula o SHA do --bin lido)",
      },
    ],
    denominador: { total: 14, partes: { KB1: 4, KB2: 2, KB3: 4, KB4: 2, NB: 2 } },
  };
  return { plain, buf, truth };
}

// ---------------------------------------------------------------------------
// Escrita em disco + holdouts
// ---------------------------------------------------------------------------

export const DESTINOS = [
  [0x12340, "rom", "rom"],
  [0xa00400, "io-vram", "io/vram-window"],
  [0xe01000, "work-ram", "work-ram"],
  [0x500000, "descohecida", "descoecida"],
];

function garantir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function gravar(dir, nome, dados) {
  const p = path.join(garantir(dir), nome);
  fs.writeFileSync(p, dados);
  return { caminho: path.relative(RAIZ, p), bytes: dados.length, sha256: sha256(dados) };
}

function gravarJson(dir, nome, obj) {
  return gravar(dir, nome, `${JSON.stringify(obj, null, 2)}\n`);
}

/** Auto-validación da entrada de A: o codificador de D ten de round-tripar dende
 *  os bytes que efectivamente quedan na imaxe e a stream truncada ten de ser
 *  rexeitada polo DECODIFICADOR de D (non polo de A). Execútase sobre a imaxe,
 *  non sobre o buffer en memoria: así detecta calquera pisada entre zonas. */
export function validarEntradaA(a, nome) {
  for (const st of [a.truth.streams.s1, a.truth.streams.s2]) {
    const fatia = a.img.subarray(st.offset, st.offset + st.stream_len);
    if (sha256(fatia) !== st.stream_sha256) {
      throw new Error(`entrada ${nome} inválida: bytes do stream en ${st.offset} difiren do codificado`);
    }
    const saida = kosinskiDecode(fatia);
    if (sha256(saida) !== st.plain_sha256) {
      throw new Error(`entrada ${nome} inválida: round-trip ${st.offset} diverge`);
    }
  }
  let truncErr = null;
  try {
    kosinskiDecode(a.img.subarray(a.truth.config.fluxo3));
  } catch (e) {
    truncErr = String(e.message || e);
  }
  if (!truncErr) throw new Error(`entrada ${nome} inválida: stream truncada decodifica sem erro`);

  // A sonda d16(PC) ten de apuntar ao fluxo tamén lendo os bytes da imaxe co
  // desprazamento ASINADO (é o que calquera descodificador 68000 fai).
  const pcSitio = a.truth.sítios.carga_pc;
  const dispAsinado = a.img.readInt16BE(pcSitio + 2);
  const alvoPc = pcSitio + 2 + dispAsinado;
  if (alvoPc !== a.truth.config.fluxo1) {
    throw new Error(
      `entrada ${nome} inválida: d16(PC) en ${pcSitio.toString(16)} apunta a ${alvoPc.toString(16)}, non a ${a.truth.config.fluxo1.toString(16)}`,
    );
  }
  return true;
}

export function gravarTudo() {
  const a = buildAImage({ seed: "d-frentes-a-v1", destinos: DESTINOS });
  const b = buildBGrid("d-frentes-b-v1");
  const c1 = buildCX1();
  const c2 = buildCX2();
  const c3 = buildCX3();
  const c4 = buildCX4();

  validarEntradaA(a, "dA-img-v1.bin");

  const escritos = {
    a: [
      gravar(path.join(DATA, "a"), "dA-img-v1.bin", a.img),
      gravarJson(path.join(DATA, "a"), "dA-truth-v1.json", a.truth),
    ],
    b: [
      gravar(path.join(DATA, "b"), "dB-grid-v1.bin", b.plain),
      gravar(path.join(DATA, "b"), "dB-projecao-v1.bin", b.buf),
      gravarJson(path.join(DATA, "b"), "dB-truth-v1.json", b.truth),
    ],
    c: [
      gravar(path.join(DATA, "c"), "dC-cx1.bin", c1.img),
      gravarJson(path.join(DATA, "c"), "dC-cx1-truth.json", c1.truth),
      gravar(path.join(DATA, "c"), "dC-cx2.bin", c2.img),
      gravarJson(path.join(DATA, "c"), "dC-cx2-truth.json", c2.truth),
      gravar(path.join(DATA, "c"), "dC-cx3.bin", c3.img),
      gravarJson(path.join(DATA, "c"), "dC-cx3-truth.json", c3.truth),
      gravar(path.join(DATA, "c"), "dC-cx4.bin", c4.img),
      gravarJson(path.join(DATA, "c"), "dC-cx4-truth.json", c4.truth),
    ],
  };
  return { a, b, c1, c2, c3, c4, escritos };
}

export function gravarHoldouts() {
  // inputs públicos na árvore; respostas fora da árvore (§7)
  const destinosH = [
    [0x11234, "rom", "rom"],
    [0xa1ff00, "io-vram", "io/vram-window"],
    [0xe0ffff, "work-ram", "work-ram"],
    [0x600000, "descohecida", "descoecida"],
  ];
  // Cadea de versións do holdout A (correccións pre-execución rexistradas, errata
  // §7 de EXTENSOES-D). Ningunha altera um denominador nin um limiar: as dúas
  // inválidas son defectos da ENTRADA autorada por D, demonstrados sen consultar
  // a ferramenta avaliada.
  //   v1: fluxo2 fixo em fluxo1+0x400, pero s1 codificado mide 1157 B → s2 pisa o
  //       final de s1 (o descodificador de D rexeita a imaxe).
  //   v2: fluxo2 derivado, imaxe válida; a sonda d16(PC) en base+0x14 queda a
  //       35 820 bytes do fluxo → o desprazamento asinado aponta fóra da imaxe.
  //   v3: base movida a 0x1200, con d16(PC) dentro da xanela asinada.
  const a = buildAImage({
    seed: "d-holdout-a-ho1",
    base: 0x1200,
    rotina1: 0xa000,
    rotina2: 0x2400,
    fluxo1: 0x9000,
    fluxo2: null,
    destinos: destinosH,
    dadosFn: padraoD,
  });
  validarEntradaA(a, "dA-img-ho3.bin");
  const b = buildBGrid("d-holdout-b-ho1");
  const cx9 = buildHoldoutC();
  const nomeA = "dA-img-ho3.bin";
  const voids = [
    {
      id: "H-A-v1",
      arquivo: "dA-img-ho1.bin",
      motivo:
        "entrada inválida autorada por D: fluxo s2 (149 B en 0x9400) pisou o final de s1 (1157 B en 0x9000); " +
        "o decodificador de D rexeita a imaxe (`referencia antes do historico`), polo que a recusa de A non informa sobre A",
    },
    {
      id: "H-A-v2",
      arquivo: "dA-img-ho2.bin",
      motivo:
        "streams válidos, pero a sonda lea.l d16(PC),A2 en 0x414 tiña desprazamento 0x8bec → asinado −28 924, " +
        "alvo fóra da imaxe; a fila KA1-3 medía a autoría de D, non a forma de carga de A",
    },
  ];
  const nomeB = "dB-grid-ho1.bin";
  const nomeC = "dC-cx9-ho1.bin";

  const pin = {
    esquema: "rex-parallel-d/holdout-pin/2",
    gerado_por: "author_frentes.mjs::gravarHoldouts",
    politica: "inputs versionados; respostas reservadas fora da árvore",
    respostas_fora_da_arvore: RESERVADO_DIR,
    entradas: [
      { id: "H-A", arquivo: `data/.../holdout/${nomeA}`, bytes: a.img.length, sha256: sha256(a.img), respostas: "H-A3-respostas.json", pontua: true },
      ...voids.map((v) => {
        const f = path.join(DATA, "holdout", v.arquivo);
        return {
          id: v.id,
          arquivo: `data/.../holdout/${v.arquivo}`,
          bytes: fs.existsSync(f) ? fs.statSync(f).size : null,
          sha256: fs.existsSync(f) ? sha256(fs.readFileSync(f)) : null,
          pontua: false,
          estado: "void",
          motivo: v.motivo,
        };
      }),
      { id: "H-B", arquivo: `data/.../holdout/${nomeB}`, bytes: b.plain.length, sha256: sha256(b.plain) },
      { id: "H-C", arquivo: `data/.../holdout/${nomeC}`, bytes: cx9.img.length, sha256: sha256(cx9.img) },
    ],
  };
  gravar(path.join(DATA, "holdout"), nomeA, a.img);
  gravar(path.join(DATA, "holdout"), nomeB, b.plain);
  gravar(path.join(DATA, "holdout"), nomeC, cx9.img);
  gravarJson(path.join(DATA, "holdout"), "dC-cx9-ho1-truth-publica.json", cx9.publica);
  gravarJson(path.join(DATA, "holdout"), "pin.json", pin);

  garantir(RESERVADO_DIR);
  fs.writeFileSync(path.join(RESERVADO_DIR, "H-A3-respostas.json"), JSON.stringify(a.truth, null, 2));
  fs.writeFileSync(path.join(RESERVADO_DIR, "H-B-respostas.json"), JSON.stringify(b.truth, null, 2));
  fs.writeFileSync(
    path.join(RESERVADO_DIR, "H-C-respostas.json"),
    JSON.stringify(cx9.reservado, null, 2),
  );
  fs.writeFileSync(
    path.join(RESERVADO_DIR, "README.txt"),
    "Respostas reservadas dos holdouts H-A/H-B/H-C (frente D, 2026-10-04).\n" +
      "Nunca usadas para preencher medições (R9). Somente para correção cega.\n" +
      "H-A-respostas.json (dA-img-ho1.bin) e H-A2-respostas.json (dA-img-ho2.bin) son\n" +
      "respostas de entradas declaradas void por defectos de autoría de D (errata §7).\n" +
      "A resposta que pontúa é H-A3-respostas.json (dA-img-ho3.bin).\n",
  );
  return { pin, dir: RESERVADO_DIR };
}

/** Holdout C: instrução e fluxo fora dos conjuntos de medição (bcc.b + dbra +
 *  movep + rts), com aritmética própria. */
export function buildHoldoutC() {
  const a = { bccb: 0x00, dbra: 0x02, movem: 0x06, rts: 0x0a, fim: 0x0c };
  const img = Buffer.alloc(a.fim, 0);
  w16(0x6408).copy(img, a.bccb); // bcc.b disp8=+8 → alvo = 0x00+2+8 = 0x0A
  // Corrección pre-mediación: `51c0…` non é DBcc (a grabación externa só ancóra
  // 51c8..51ce como dbf %d0..%d6) e disp −8 daría un alvo fóra da imaxe.
  h("51c8fffe").copy(img, a.dbra); // dbra D0 (ancora 51c8), disp −2 → alvo = 0x02
  h("4c9d00e0").copy(img, a.movem); // movem.w (A5)+,D5-D7 (âncora externa r2-objdump)
  h("4e75").copy(img, a.rts);
  const reservado = {
    id: "dC-cx9-ho1",
    regioes: [{ inicio: 0, fim: a.fim }],
    raizes: [{ endereco: 0, proveniencia: "candidato", evidencia: "holdout" }],
    sequencia: [
      { endereco: a.bccb, tam: 2, alvo: a.bccb + 2 + 8 },
      { endereco: a.dbra, tam: 4, alvo: a.dbra + 2 - 2 },
      { endereco: a.movem, tam: 4, sítio: "movem.w" },
      { endereco: a.rts, tam: 2 },
    ],
    cobertura_esperada_bytes: 12,
    bytes_por_endereco: Object.fromEntries(
      [
        [a.bccb, "6408"],
        [a.dbra, "51c8fffe"],
        [a.movem, "4c9d00e0"],
        [a.rts, "4e75"],
      ].map(([e, hexes]) => [`0x${e.toString(16)}`, hexes]),
    ),
  };
  const publica = {
    id: reservado.id,
    schema: "rex-parallel-d/holdout-input/1",
    arquivo: "dC-cx9-ho1.bin",
    sha256: sha256(img),
    tam: img.length,
    aviso: "respostas reservadas fora da árvore",
  };
  return { img, reservado, publica };
}

export function imprimirResumo(r) {
  const linhas = [];
  linhas.push(`imagem A: ${r.a.img.length} B sha ${r.a.truth.imagem.sha256}`);
  linhas.push(`grid B: ${r.b.plain.length} B sha ${r.b.truth.plain.sha256}`);
  for (const [k, arr] of Object.entries(r.escritos)) {
    for (const e of arr) linhas.push(`${k}: ${e.caminho} (${e.bytes} B, ${e.sha256.slice(0, 12)}…)`);
  }
  return linhas.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarTudo();
  console.log(imprimirResumo(r));
  const ho = gravarHoldouts();
  console.log(
    `holdout: ${ho.pin.entradas.length} entradas públicas na árbore; ` +
      `${ho.pin.entradas.length} respostas reservadas en ${ho.dir}`,
  );
}
