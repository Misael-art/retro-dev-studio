#!/usr/bin/env node
/**
 * Montador de sondas v2 (barra D, rolda 3, R14).
 *
 * Ningunha codificación 68000 das fixtures v2 se escribe a man: cada sonda
 * descríbese en sintaxe GNU `as`, `m68k-elf-as -m68000` codifícaa e
 * `m68k-elf-objdump` devolve o mnemónico, os bytes crúa e o enderezo efectivo
 * que o propio instrumento calcula. O gabarito de D é a saída do instrumento.
 *
 * A ferramenta é a mesma que fixou `isa-oraculo-v2` (`gabarito/isa-oraculo-v2.json`):
 * este módulo non localiza binarios ao arbitrio do host — le as rutas do gabarito
 * e exige que o SHA-256 do binario bata co pin publicado. Se o ferramenta non
 * está ou diverxe, lanza con motivo; non se degrada a unha táboa escrita a man
 * (ese foi o defecto que invalidou cinco filas de KA1 en v1, §12.6 de EXTENSOES-D).
 *
 * Tres camiños de xeración, todos derivados do instrumento:
 *   `texto`   — sonda codificada por GAS a partir do mnemónico (sondas positivas).
 *   `palabras`— palabras crúas que non teñen mnemónico 68000: o instrumento
 *               ditamina se son `.short` (indefinidas) ou dun familiar superior.
 *   `pc_rel`  — sondas de desprazamento: dous pases (descubrir o sitio, despois
 *               codificar o desprazamento) e a verificación é que o enderezo
 *               efectivo que imprime `objdump` sexa o alvo pretendido.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "../../../../..");
export const GABARITO_ISA = path.join(
  RAIZ,
  "data/rex_profiles/parallel_recovery_20261004/d/gabarito/isa-oraculo-v2.json",
);

export const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

export function lerGabaritoIsa() {
  if (!fs.existsSync(GABARITO_ISA)) {
    throw new Error(`gabarito de ISA ausente: ${path.relative(RAIZ, GABARITO_ISA)}`);
  }
  return JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8"));
}

/** Ferramenta pinada: rutas do gabarito + identidade verificada polo digesto. */
export function instrumento({ gabarito = lerGabaritoIsa() } = {}) {
  const inst = gabarito.instrumento;
  const ausentes = [inst.montador, inst.desmontador].filter((p) => !fs.existsSync(p));
  if (ausentes.length) {
    throw new Error(
      `ferramenta 68000 do gabarito ausente no host: ${ausentes.join(", ") || "?"}`,
    );
  }
  const shaAs = sha256(fs.readFileSync(inst.montador));
  const shaOd = sha256(fs.readFileSync(inst.desmontador));
  if (shaAs !== inst.sha256["m68k-elf-as"]) {
    throw new Error(`identidade do montador diverxe do gabarito: ${shaAs}`);
  }
  if (shaOd !== inst.sha256["m68k-elf-objdump"]) {
    throw new Error(`identidade do desmontador diverxe do gabarito: ${shaOd}`);
  }
  return {
    montador: inst.montador,
    desmontador: inst.desmontador,
    version: inst.version,
    bandeira: inst.bandeira,
    sha256_as: shaAs,
    sha256_objdump: shaOd,
    gabarito_sha256: sha256(fs.readFileSync(GABARITO_ISA)),
    filas_sha256: gabarito.filas_sha256,
  };
}

function exec(bin, args) {
  try {
    return { rc: 0, stdout: execFileSync(bin, args, { encoding: "utf8" }), stderr: "" };
  } catch (e) {
    return { rc: e.status ?? 1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

const ROTULO = (r) => `p_${String(r).replace(/[^A-Za-z0-9]+/g, "_")}`;

/** Corpo dunha sonda: mnemónico(s) ou palabras crúas. `sitio` só se usa en `pc_rel`. */
function corpo(s, sitio) {
  if (Array.isArray(s.palabras)) {
    return s.palabras.map((w) => `\t.word 0x${w.toString(16).padStart(4, "0")}`).join("\n");
  }
  const texto = typeof s.texto === "function" ? s.texto(sitio ?? 0) : s.texto;
  return texto
    .split("\n")
    .map((l) => `\t${l.trim()}`)
    .join("\n");
}

function emitir({ base, grupos }) {
  const liñas = [
    "\t.text",
    "\t.globl\tinicio",
    "inicio:",
    `\t.org\t0x${base.toString(16)}`,
  ];
  for (const [rotulo, corpoTexto] of grupos) {
    // `rotulo === null` é unha directiva sola (`.org` de fixaxe de sitio).
    if (rotulo === null) liñas.push(corpoTexto.trim());
    else liñas.push(`${rotulo}:`, corpoTexto);
  }
  return `${liñas.join("\n")}\n`;
}

const RE_CABETEIRA = /^([0-9a-f]+) <([^<>]+)>:$/;
const RE_INSTRUCCION = /^\s*([0-9a-f]+):\t(.+)$/;

/** Liñas de instrución dunha desmontaxe, agrupadas pola última cabeteira vista. */
function agrupar(saidaObjdump) {
  const grupos = [];
  let actual = null;
  for (const crua of saidaObjdump.split("\n")) {
    const liña = crua.trim();
    const cab = RE_CABETEIRA.exec(liña);
    if (cab) {
      actual = { rotulo: cab[2], direccion: parseInt(cab[1], 16), liñas: [] };
      grupos.push(actual);
      continue;
    }
    const ins = RE_INSTRUCCION.exec(crua);
    if (ins && actual) {
      const [, enderezo, resto] = ins;
      const [campoBytes, ...restoPartes] = resto.split("\t");
      if (!/^[0-9a-f]{2,4}(?:[ \t]+[0-9a-f]{2,4})*$/.test(campoBytes.trim())) continue;
      actual.liñas.push({
        direccion: parseInt(enderezo, 16),
        bytes: campoBytes.replace(/[^0-9a-f]/g, ""),
        operando: restoPartes.join(" ").trim(),
      });
    }
  }
  return grupos;
}

/** Enderezo efectivo tal e como o calcula o desmontador (non D). */
export function eaDito(operando) {
  const m = /([0-9a-f]{1,8})\s*</.exec(operando);
  return m ? Number(`0x${m[1]}`) : null;
}

/**
 * Monta un bloque de sondas nun directorio de traballo.
 *
 * @param {object} p
 * @param {number} p.base            desprazamento dentro da imaxe onde empeza o bloque
 * @param {Array}  p.sondas          [{rotulo, texto|palabras|pc_rel, sep? }]
 * @param {string} p.dir             directorio de traballo (debe existir)
 * @param {string} [p.nome]          nome do ficheiro `.s`/`.o`
 * @param {number} [p.nops]          nops de separación entre sondas (R14)
 * @returns {{sondas: Array, grupos: Array, fonte: string, instrumento: object}}
 */
export function montarSondas({ base, sondas, dir, nome = "bloco", nops = 2, inst = null }) {
  const ferramenta = inst ?? instrumento();
  fs.mkdirSync(dir, { recursive: true });
  const sPath = path.join(dir, `${nome}.s`);
  const oPath = path.join(dir, `${nome}.o`);

  const gruposDe = (sitios) => {
    const out = [];
    let último = -1;
    for (const s of sondas) {
      if (s.sitioFixo !== undefined) {
        if (s.sitioFixo <= último) {
          throw new Error(`sitioFixo non monotónico en ${s.rotulo}: 0x${s.sitioFixo.toString(16)} ≤ 0x${último.toString(16)}`);
        }
        out.push([null, `\t.org\t0x${s.sitioFixo.toString(16)}`]);
      }
      const rotulo = ROTULO(s.rotulo);
      out.push([rotulo, corpo(s, sitios[rotulo])]);
      const n = s.sep === undefined ? nops : s.sep;
      for (let i = 0; i < n; i += 1) out.push([`${rotulo}_sep${i}`, "\tnop"]);
      if (s.sitioFixo !== undefined) último = s.sitioFixo;
    }
    return out;
  };

  const montar = (sitios) => {
    const fonte = emitir({ base, grupos: gruposDe(sitios) });
    fs.writeFileSync(sPath, fonte, "utf8");
    const mont = exec(ferramenta.montador, [...ferramenta.bandeira, "-o", oPath, sPath]);
    if (mont.rc !== 0) {
      throw new Error(
        `o montador recusou o bloque ${nome} (rc ${mont.rc}); unha sonda recusada non pode ser sonda positiva:\n` +
          `${mont.stderr.trim().replaceAll(`${dir}/`, "<dir>/")}\n--- fonte ---\n${fonte}`,
      );
    }
    const des = exec(ferramenta.desmontador, ["-d", oPath]);
    if (des.rc !== 0) {
      throw new Error(`o desmontador fallou en ${nome}: rc ${des.rc} ${des.stderr.trim()}`);
    }
    return { fonte, grupos: agrupar(des.stdout) };
  };

  const ler = (grupos) => {
    const porRotulo = new Map();
    for (const g of grupos) if (!porRotulo.has(g.rotulo)) porRotulo.set(g.rotulo, g);
    return sondas.map((s) => {
      const rotulo = ROTULO(s.rotulo);
      const g = porRotulo.get(rotulo);
      if (!g) throw new Error(`sonda sen símbolo na desmontaxe: ${rotulo}`);
      const bytes = g.liñas.map((l) => l.bytes).join("");
      if (!bytes) throw new Error(`sonda sen bytes desmontados: ${rotulo}`);
      return {
        rotulo: s.rotulo,
        sitio: g.direccion,
        bytes,
        lonxitude: bytes.length / 2,
        desmontaxe: g.liñas.map((l) => `${l.direccion.toString(16)}:\t${l.bytes}\t${l.operando}`).join("\n"),
        mnemonico: g.liñas[0].operando,
        ea: eaDito(g.liñas[0].operando),
        sonda: s,
      };
    });
  };

  // Pase 1: descubri-los sitios (necesarios para os desprazamentos).
  const primeiro = montar({});
  const sitios1 = Object.fromEntries(ler(primeiro.grupos).map((r) => [ROTULO(r.rotulo), r.sitio]));
  const pcRel = sondas.filter((s) => typeof s.texto === "function");
  let resultado = { grupos: primeiro.grupos, fonte: primeiro.fonte, filas: ler(primeiro.grupos) };
  if (pcRel.length) {
    // Pase 2: codificar con o desprazamento real; os sitios non poden moverse.
    const segundo = montar(sitios1);
    const filas2 = ler(segundo.grupos);
    for (const r of filas2) {
      if (r.sitio !== sitios1[ROTULO(r.rotulo)]) {
        throw new Error(
          `o sitio de ${r.rotulo} mudou entre pases (${sitios1[ROTULO(r.rotulo)].toString(16)} → ${r.sitio.toString(16)}): o desprazamento queda obsoleto`,
        );
      }
    }
    resultado = { grupos: segundo.grupos, fonte: segundo.fonte, filas: filas2 };
  }

  // Control interno: as sondas relativas teñen que apuntar ao alvo declarado e
  // as fixadas (`sitioFixo`) teñen que caer no sitio que D conxelou.
  for (const r of resultado.filas) {
    const alvo = r.sonda.alvo;
    if (r.sonda.sitioFixo !== undefined && r.sitio !== r.sonda.sitioFixo) {
      throw new Error(
        `sitioFixo incumpre en ${r.rotulo}: GAS sitúao en 0x${r.sitio.toString(16)}, conxelado en 0x${r.sonda.sitioFixo.toString(16)}`,
      );
    }
    if (alvo === undefined || typeof r.sonda.texto !== "function") continue;
    if (r.ea !== alvo) {
      throw new Error(
        `desprazamento incorrecto en ${r.rotulo}: o desmontador di 0x${(r.ea ?? -1).toString(16)}, alvo pretendido 0x${alvo.toString(16)}`,
      );
    }
  }

  return {
    sondas: resultado.filas,
    grupos: resultado.grupos,
    fonte: resultado.fonte,
    ficheiro_s: sPath,
    ficheiro_o: oPath,
    instrumento: ferramenta,
  };
}

/** Comproba de que ningunha sonda ocupa o mesmo byte que outra (R14). */
export function controlarSolapamento(filas) {
  const ordenadas = [...filas].sort((a, b) => a.sitio - b.sitio);
  for (let i = 1; i < ordenadas.length; i += 1) {
    const anterior = ordenadas[i - 1];
    if (anterior.sitio + anterior.lonxitude > ordenadas[i].sitio) {
      throw new Error(
        `sondas solapadas: ${anterior.rotulo}@${anterior.sitio.toString(16)}+${anterior.lonxitude} pisa ${ordenadas[i].rotulo}@${ordenadas[i].sitio.toString(16)}`,
      );
    }
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inst = instrumento();
  console.log(`[montador] ${inst.version} · as ${inst.sha256_as.slice(0, 12)}… · od ${inst.sha256_objdump.slice(0, 12)}…`);
  const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-montador-"));
  const r = montarSondas({
    base: 0x100,
    dir,
    nome: "demo",
    sondas: [
      { rotulo: "lea-l", texto: "lea (0x8000).l,%a0" },
      { rotulo: "lea-pc", texto: (s) => `lea (0x${(0x8000 - (s + 2)).toString(16)},%pc),%a2`, alvo: 0x8000 },
      { rotulo: "neg-4efd", palabras: [0x4efd, 0x0000, 0x1f00] },
    ],
  });
  for (const s of r.sondas) {
    console.log(`  ${s.rotulo.padEnd(10)} 0x${s.sitio.toString(16).padStart(4, "0")}  ${s.bytes.padEnd(14)} ${s.mnemonico}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
