#!/usr/bin/env node
/**
 * Oráculo de ISA 68000 da frente D — gabarito independente por instrumento.
 *
 * Non é un decodificador propio: cada fila executa o montador e o desmontador
 * dunha ferramenta terceira (GNU Binutils `m68k-elf-as`/`m68k-elf-objdump`,
 * `-m68000`) e garda a saída bruta. O gabarito de D deriva do que o instrumento
 * devolve, non do que A, B, C ou D afirman.
 *
 * Limitación declarada (ver RELATORIO-D §11): a fronte A cita o mesmo binario
 * (`fixtures/INSTRUMENTO.sha256`, sha `618740559477…`). Iso non converte o
 * instrumento en proba independente *de A*; convirte o seu ditame en oráculo
 * do ISA, que é o que se necesita para a retificación da rolda 2.
 *
 * Uso:  node …/medida/oraculo_isa.mjs [--saida <dir>]
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const D = "scripts/rex_profiles/parallel_recovery_20261004/d";
const ARBORE = path.join(
  process.env.HOME,
  ".cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin",
);
const AS = path.join(ARBORE, "m68k-elf-as");
const OBJDUMP = path.join(ARBORE, "m68k-elf-objdump");

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** Sondas en sintaxe GNU as para m68k (rexistros prefixedos con `%`, como pide GAS). */
const SONDAS = [
  // --- JSR / JMP: as formas que a cadea Kosinski atopaba en cbb6895
  { id: "jsr-abs-w-baixo", texto: "jsr (0x1234).w", classe: "valida" },
  { id: "jsr-abs-w-alto", texto: "jsr (0x8400).w", classe: "valida" },
  { id: "jsr-abs-l", texto: "jsr (0x13000).l", classe: "valida" },
  { id: "jsr-pc-d16", texto: "jsr (0x100,%pc)", classe: "valida" },
  { id: "jmp-abs-w-baixo", texto: "jmp (0x1234).w", classe: "valida" },
  { id: "jmp-abs-w-alto", texto: "jmp (0x8400).w", classe: "valida" },
  { id: "jmp-abs-l", texto: "jmp (0x13000).l", classe: "valida" },
  { id: "jmp-pc-d16", texto: "jmp (0x100,%pc)", classe: "valida" },
  { id: "jmp-reg-indirecto", texto: "jmp (%a0)", classe: "valida-fora-da-táboa-A" },
  { id: "jsr-reg-indirecto", texto: "jsr (%a2)", classe: "valida-fora-da-táboa-A" },

  // --- LEA absoluto curto: a fila que a rolda 2 marcou como regresión
  { id: "lea-abs-w-baixo", texto: "lea (0x1234).w,%a1", classe: "valida" },
  { id: "lea-abs-w-alto", texto: "lea (0x8400).w,%a1", classe: "valida" },
  { id: "lea-abs-w-fff0", texto: "lea (0xfff0).w,%a1", classe: "valida" },
  { id: "abs-w-limite-7fff", texto: "lea (0x7fff).w,%a1", classe: "valida" },
  { id: "abs-w-limite-8000", texto: "lea (0x8000).w,%a1", classe: "valida" },
  { id: "lea-abs-l", texto: "lea (0x13000).l,%a1", classe: "valida" },
  { id: "lea-pc-d16-pos", texto: "lea (0x100,%pc),%a1", classe: "valida" },
  { id: "lea-pc-d16-neg", texto: "lea (-0x100,%pc),%a1", classe: "valida" },
  { id: "lea-ind-idx-w", texto: "lea (0x10,%a1,%d2.w),%a0", classe: "valida" },

  // --- BSR: perfil declarado `md68000-chain16` (byte e palabra; .l non 68000)
  { id: "bsr-s", texto: "bsr.s alvo\n\tnop\nalvo:", classe: "valida" },
  { id: "bsr-w", texto: "bsr.w alvo\n\tnop\nalvo:", classe: "valida" },
  { id: "bsr-plain", texto: "bsr alvo\n\tnop\nalvo:", classe: "valida" },
  { id: "bsr-l", texto: "bsr.l alvo\n\tnop\nalvo:", classe: "recusada-68020" },

  // --- MOVEA: a rolda 2 tiña `movea.w` por inválida; compróbase co instrumento
  { id: "movea-w-inm", texto: "movea.w #0x1234,%a1", classe: "valida" },
  { id: "movea-l-inm", texto: "movea.l #0x1234,%a1", classe: "valida" },
  { id: "movea-w-dn", texto: "movea.w %d0,%a1", classe: "valida" },
  { id: "movea-l-dn", texto: "movea.l %d0,%a1", classe: "valida" },
  { id: "movea-w-mem-w", texto: "movea.w (0x8400).w,%a1", classe: "valida" },
  { id: "movea-l-mem-w", texto: "movea.l (0x8400).w,%a1", classe: "valida" },
  { id: "movea-w-an", texto: "movea.w %a0,%a1", classe: "recusada-68000" },
  { id: "movea-l-an", texto: "movea.l %a0,%a1", classe: "valida" },

  // --- Ramas/loops que A recusa como `fora-de-subconxunto` (ISA válidos)
  { id: "bra-w", texto: "bra.w alvo\nalvo:", classe: "valida-fora-da-táboa-A" },
  { id: "beq-w", texto: "beq.w alvo\nalvo:", classe: "valida-fora-da-táboa-A" },
  { id: "dbra-d0", texto: "dbra %d0,alvo\nalvo:", classe: "valida-fora-da-táboa-A" },

  // --- Instruccións que non son MC68000 (a recusa de A sería xusta)
  { id: "movec-cacr", texto: "movec %cacr,%d0", classe: "recusada-68020" },
  { id: "bchg-im-mem", texto: "bchg #3,(0x100).w", classe: "valida" },

  // --- Os mnemónicos que o conxelado v1 de D usou para as sondas `4E FC`/`4E FD`
  //     e `61 FF`: o instrumento ditaminan se son MC68000 ou de familia superior.
  { id: "jmp2abs-l-texto", texto: "jmp2abs.l (0x1f00)", classe: "recusada-68010-ou-maior" },
  { id: "jmp2abs-texto", texto: "jmp2abs (0x1f00).l", classe: "recusada-68020" },

  // --- Relectura, co instrumento, dos bytes que D codificou á man en `dA-img-v1`
  //     para as cinco filas que a rolda 2 contou como regresión de A.
  { id: "bruto-lea-8400-w", bytes: "43f88400", classe: "bruto" },
  { id: "bruto-61ff-bsrl", bytes: "61ff00001dd4", classe: "bruto" },
  { id: "bruto-4efa-d16pc", bytes: "4efa1f00", classe: "bruto" },
  { id: "bruto-4efd", bytes: "4efd00001f00", classe: "bruto" },
  { id: "bruto-4efc", bytes: "4efc1f00", classe: "bruto" },
  { id: "bruto-227c-moveal", bytes: "227c00001111", classe: "bruto" },
  { id: "bruto-327c-moveaw", bytes: "327c1111", classe: "bruto" },
  { id: "bruto-1031-move-w-idx", bytes: "10312000", classe: "bruto" },

  // --- Codificacións canónicas que `EXTENSOES-D v2` usará nas sondas substitutas
  //     (as cinco filas anteriores din o que D escribiu; estas din o que se
  //     tiña que escribir). Todas apuntan á mesma rutina 0x1f00 do fixture.
  { id: "can-jsr-w", bytes: "4eb81f00", classe: "bruto" },
  { id: "can-jsr-l", bytes: "4eb900001f00", classe: "bruto" },
  { id: "can-jmp-w", bytes: "4ef81f00", classe: "bruto" },
  { id: "can-jmp-l", bytes: "4ef900001f00", classe: "bruto" },
  { id: "can-lea-l-8400", bytes: "43f900008400", classe: "bruto" },
  { id: "can-bsr-w-zero", bytes: "61000000", classe: "bruto" },
];

function exec(cmd, args) {
  try {
    return { rc: 0, stdout: execFileSync(cmd, args, { encoding: "utf8" }), stderr: "" };
  } catch (e) {
    return { rc: e.status ?? 1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

/** Extrae os bytes crúa da columna de `objdump -d` (mesma liña que o mnemónico,
 *  polo que o gabarito non depende de que `.text` teña un nome concreto). */
function bytesDaDesmontaxe(liña) {
  const idx = liña.indexOf(":");
  const resto = liña.slice(idx + 1);
  const campo = resto.split("\t")[1] ?? resto.split(/\s{2,}/)[1] ?? "";
  if (!/^(?:[0-9a-f]{2,4}[ \t]+)*[0-9a-f]{2,4}$/.test(campo.trim())) return "";
  return campo.replace(/[^0-9a-f]/g, "");
}

/** Desmonta o `.o` e devolve os bytes de `.text` xunto coa liña de desmontaxe. */
function lerTexto(oPath) {
  const d = exec(OBJDUMP, ["-d", oPath]);
  const bloco = d.stdout.split("\n").filter((l) => /^\s+[0-9a-f]+:\s/.test(l));
  const hex = bloco.map(bytesDaDesmontaxe).join("");
  return { bytes: hex, desmontaxe: bloco.map((l) => l.trim()).join("\n") };
}

export function executarOraculo({ saida }) {
  fs.mkdirSync(saida, { recursive: true });
  const instrumento = {
    montador: AS,
    desmontador: OBJDUMP,
    sha256: { "m68k-elf-as": sha(fs.readFileSync(AS)), "m68k-elf-objdump": sha(fs.readFileSync(OBJDUMP)) },
    version: exec(AS, ["--version"]).stdout.split("\n")[0].trim(),
    bandeira: ["-m68000"],
  };
  const filas = [];
  for (const s of SONDAS) {
    const nome = `${s.id}.s`;
    const sPath = path.join(saida, nome);
    const oPath = path.join(saida, `${s.id}.o`);
    // `bytes`: sonda bruta — cópanse os words tal cal os escribiu a autoría de D
    // e decodifica o instrumento, para ditar se iso é MC68000 ou non.
    const corpo = s.bytes
      ? (s.bytes.match(/.{1,4}/g) ?? []).map((w) => `\t.word 0x${w}`).join("\n")
      : s.texto.split("\n").join("\n");
    fs.writeFileSync(sPath, `.text\n.globl inicio\ninicio:\n${corpo}\n`, "utf8");
    const mont = exec(AS, ["-m68000", "-o", oPath, sPath]);
    const fila = {
      id: s.id,
      montaxe: s.bytes ? `.word ${s.bytes}` : s.texto.replace(/\n/g, " | "),
      classe_instrumento: s.classe,
      rc_montador: mont.rc,
      // O camiño do directorio de traballo non é evidencia: normalízase para que
      // o gabarito sexa re-xerábel noutro host sen cambiar de digesto.
      erro_montador: mont.stderr.trim().replaceAll(`${saida}/`, "<saida>/") || null,
    };
    if (mont.rc === 0) {
      const { bytes, desmontaxe } = lerTexto(oPath);
      fila.bytes_hex = bytes;
      fila.tam = bytes.length / 2;
      fila.desmontaxe = desmontaxe;
      // O desmontador imprime o efectivo que el mesmo calcula para o absoluto
      // curto: evidencia do instrumento sobre a extensión de sinal.
      const primeira = desmontaxe.split("\n")[0] ?? "";
      const alvo = /(?:\(|\b)(0x[0-9a-f]{4,8}|[0-9a-f]{6,8})\b/.exec(primeira.split(/\t|\s{2,}/).slice(1).join(" "));
      fila.efectivo_dito_polo_desmontador = alvo ? alvo[1] : null;
    }
    filas.push(fila);
  }
  const gabarito = {
    esquema: "rex-parallel-d/oraculo-isa/1",
    version: "isa-oraculo-v2",
    xerado_por: "medida/oraculo_isa.mjs",
    instrumento,
    filas,
    filas_sha256: sha(Buffer.from(JSON.stringify(filas), "utf8")),
  };
  const destino = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/gabarito", "isa-oraculo-v2.json");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, `${JSON.stringify(gabarito, null, 2)}\n`, "utf8");
  return { gabarito, destino };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const saida = process.argv.includes("--saida")
    ? process.argv[process.argv.indexOf("--saida") + 1]
    : path.join(process.env.HOME, "rds-scratch/d-oraculo-20261005/sondas");
  const { gabarito, destino } = executarOraculo({ saida });
  const validas = gabarito.filas.filter((f) => f.rc_montador === 0);
  const recusadas = gabarito.filas.filter((f) => f.rc_montador !== 0);
  console.log(`[oráculo] ${gabarito.instrumento.version}`);
  console.log(`[oráculo] ${gabarito.filas.length} sondas: ${validas.length} montan, ${recusadas.length} recusadas`);
  for (const f of validas) {
    console.log(`  ${f.id.padEnd(18)} ${String(f.bytes_hex).padEnd(20)} ${String(f.desmontaxe).split("\n")[0]?.trim().slice(-46) ?? ""}`);
  }
  for (const f of recusadas) console.log(`  RECUSA ${f.id.padEnd(16)} ${f.erro_montador.split(/\r?\n/)[1] ?? f.erro_montador.split("\n")[0]}`);
  console.log(`[oráculo] gabarito → ${path.relative(RAIZ, destino)} (sha ${sha(fs.readFileSync(destino)).slice(0, 12)}…)`);
}
