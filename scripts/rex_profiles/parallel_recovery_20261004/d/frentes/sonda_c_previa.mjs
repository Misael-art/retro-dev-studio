#!/usr/bin/env node
/**
 * Sonda previa á autoría das fixtures v2 da fronte C (barra D, rolda 3).
 *
 * Non é unha fila da matriz: existe para que §12.10 h do contrato cite unha
 * observación reproducible, e non só a lectura estática de `decode.rs`. Monta
 * catro formas co instrumento pinado (`montador.mjs`, R14), executa o
 * `rex-cfg` que o adaptador da rolda 2 xa usou, e deixa en disco a imaxe, a saída
 * do anális e un resumo de observacións cun SHA-256 propio.
 *
 * As catro formas escóllense porque separan os dous eixos que §12.6 confundiu:
 *   `movea.l #imm32,%a1` — MC68000 válida (dito polo instrumento) e **fóra** da
 *     lista fechada de C (`CONTRACT.md` §3: «`#imm` só em MOVE»).
 *   `movea.w %a0,%a1`    — válida e **dentro** da lista (rexistro → An).
 *   `move.l d16(PC),Dn` — MC68000 válida e fóra da lista (non hai fonte `(d16,PC)`).
 *   `move.l #imm32,Dn`   — dentro da lista: é a fila que proba que a cláusula
 *     «só em MOVE» é unha restrición de C, non do ISA.
 *
 * Uso: node scripts/rex_profiles/parallel_recovery_20261004/d/frentes/sonda_c_previa.mjs \
 *        --rex <ruta/rex-cfg> [--sha <sha-do-build>] [--out <dir>]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { montarSondas, sha256 } from "./montador.mjs";

const SONHAS = [
  { rotulo: "movea-l-imm", texto: "movea.l #0x1111,%a1", eixo: "fora-da-lista-de-C" },
  { rotulo: "movea-w-an", texto: "movea.w %a0,%a1", eixo: "dentro-da-lista-de-C" },
  { rotulo: "move-l-pcd16", texto: "move.l (0x20,%pc),%d0", eixo: "fora-da-lista-de-C" },
  { rotulo: "move-l-imm", texto: "move.l #0x3333,%d0", eixo: "dentro-da-lista-de-C" },
];

function argumentos(argv) {
  const out = { out: path.join(process.env.HOME, "rds-scratch/d-c-probe-20261005") };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--rex") out.rex = argv[(i += 1)];
    else if (a === "--sha") out.sha = argv[(i += 1)];
    else if (a === "--out") out.out = argv[(i += 1)];
    else throw new Error(`bandeira non coñecida: ${a}`);
  }
  if (!out.rex) throw new Error("falta --rex <ruta de rex-cfg>: a sonda non se executa contra un binario adiviñado");
  if (!fs.existsSync(out.rex)) throw new Error(`rex-cfg ausente: ${out.rex}`);
  return out;
}

const opts = argumentos(process.argv.slice(2));
fs.mkdirSync(opts.out, { recursive: true });

const mont = montarSondas({ base: 0x100, dir: opts.out, nome: "sondas-c", sondas: SONHAS, nops: 2 });
const fim = Math.max(...mont.sondas.map((s) => s.sitio + s.lonxitude));
const img = Buffer.alloc((fim + 1) & ~1, 0xff);
for (const g of mont.grupos) {
  const b = Buffer.from(g.liñas.map((l) => l.bytes).join(""), "hex");
  if (b.length) b.copy(img, g.direccion);
}
const binPath = path.join(opts.out, "sondas-c.bin");
const jsonPath = path.join(opts.out, "sondas-c.json");
fs.writeFileSync(binPath, img);

const args = ["analyze", "--bin", binPath, "--origin", "0x0",
  "--region", `0x100:0x${img.length.toString(16)}`, "--region-prov", "candidato"];
for (const s of mont.sondas) {
  args.push("--root", `0x${s.sitio.toString(16)}`, "--root-prov", "candidato");
  args.push("--site", `0x${s.sitio.toString(16)}`);
}
args.push("--max-insn", "64", "--out", jsonPath);
try {
  execFileSync(opts.rex, args, { encoding: "utf8" });
} catch (e) {
  throw new Error(`rex-cfg rc ${e.status ?? "?"}: ${String(e.stderr ?? "").trim()}`);
}

const saida = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const instr = new Map();
for (const b of saida.blocos) for (const i of b.instrucoes) instr.set(i.endereco, i);
const front = new Map((saida.fronteiras ?? []).map((f) => [f.endereco, f]));
const veredito = new Map((saida.sitios ?? []).map((s) => [s.endereco, s.veredito]));

const observacions = {
  sonda_de: "EXTENSOES-D §12.10 h",
  data: "2026-10-05",
  estado: "previa á autoría das fixtures v2 de C; non é fila da matriz",
  ferramenta: {
    rex_cfg: opts.rex,
    rex_cfg_sha256: sha256(fs.readFileSync(opts.rex)),
    sha_declarado_por_d: opts.sha ?? null,
    reportado_pola_ferramenta: saida.tool,
    schema: saida.schema,
  },
  imaxe: { camiño: binPath, sha256: sha256(img), bytes: img.length },
  instrumento: mont.instrumento,
  filas: mont.sondas.map((s) => ({
    rotulo: s.rotulo,
    eixo: s.sonda.eixo,
    sitio: s.sitio,
    bytes: s.bytes.toUpperCase(),
    instrumento: { mnemonico: s.mnemonico, lonxitude: s.lonxitude },
    rex_cfg: (() => {
      const i = instr.get(s.sitio);
      const f = front.get(s.sitio);
      return {
        veredito_do_sitio: veredito.get(s.sitio) ?? null,
        decodificada: i ? { tam: i.tam, classe: i.classe, mnem: i.mnem } : null,
        fronteira: f ? { tipo: f.tipo, motivo: f.motivo } : null,
      };
    })(),
  })),
};
const outPath = path.join(opts.out, "observacions.json");
fs.writeFileSync(outPath, `${JSON.stringify(observacions, null, 2)}\n`);

for (const f of observacions.filas) {
  const r = f.rex_cfg;
  const feito = r.decodificada
    ? `decodifica tam=${r.decodificada.tam} ${JSON.stringify(r.decodificada.mnem)}`
    : r.fronteira
      ? `fronteira ${r.fronteira.tipo} (${r.fronteira.motivo})`
      : `sen lectura (veredito ${r.veredito_do_sitio})`;
  console.log(`${f.rotulo.padEnd(14)} ${f.eixo.padEnd(20)} 0x${f.sitio.toString(16)}  ${feito}`);
}
console.log(`\nobservacións: ${outPath}`);
console.log(`imaxe: ${binPath} (${observacions.imaxe.sha256})`);
