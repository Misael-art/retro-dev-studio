#!/usr/bin/env node
/**
 * Autor do **holdout v2 da fronte A** (barra D, rolda 3, requisito 8).
 *
 * Reutiliza o xerador independente de `author_v2.mjs` (R14: ningún byte 68000 a
 * man; todo o codifica `m68k-elf-as -m68000` e o le `m68k-elf-objdump`) cunha
 * **xeometría, sementes e streams disxuntos** da medición:
 *  - enderezos de rutinas e fluxos distintos (`LAYOUT_HO`);
 *  - semente e datos distintos, con tamaños de stream distintos;
 *  - as respostas **non se versionan**: viven en `~/rds-scratch/rex-heldout-d3/`
 *    e só o seu SHA-256 queda en `pin-holdout-a-v2.json` (R17).
 * O holdout `cbb6895` da rolda 2 non se reutiliza.
 *
 * Límite declarado: a gramática de A é unha lista pechada de formas; o holdout
 * non inventa formas novas, proba que o resultado non depende da xeometría, dos
 * datos nin dos enderezos da medición. Non proba cobertura de ISA.
 *
 * Uso: node …/frentes/author_holdout_a_v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { buildAImageV2, validarEntradaA2, LAYOUT, RAIZ, GABARITO, CONTRATO } from "./author_v2.mjs";
import { sha256 } from "../lib_bench.mjs";

export const DATA_HO_A = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/a-holdout");
export const RESPOSTAS_DIR = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
export const NOME_IMG_HO = "dA-img-ho-v2.bin";
export const NOME_RESP_HO = "dA-ho-respostas.json";
export const NOME_PIN_HO = "pin-holdout-a-v2.json";
export const SEED_HO = "d-frentes-a-holdout-v2-r3";
export const LAYOUT_HO = Object.freeze({
  rom_size: 0x20000,
  base: 0x100,
  rutina1: 0x2300,
  rutina2: 0x1d00,
  fluxo1: 0x7400,
  fluxo2: 0x5800,
});
export const TAMANHOS_HO = [896, 160, 448];

export function disxuncion() {
  for (const k of ["rutina1", "rutina2", "fluxo1", "fluxo2"]) {
    if (LAYOUT_HO[k] === LAYOUT[k]) throw new Error(`holdout non disxunto: ${k} coincide coa medición`);
  }
  if (SEED_HO === "d-frentes-a-v2") throw new Error("holdout reutiliza a semente da medición");
}

export function gravarHoldoutA({ dirPublico = DATA_HO_A, dirResp = RESPOSTAS_DIR } = {}) {
  disxuncion();
  const trab = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-author-ho-a-"));
  const a = buildAImageV2({ seed: SEED_HO, dir: trab, layout: LAYOUT_HO, tamanhos: TAMANHOS_HO });
  validarEntradaA2(a, NOME_IMG_HO);
  const truth = { ...a.truth, conxunto: "holdout", xerado_por: "scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_holdout_a_v2.mjs" };
  fs.mkdirSync(dirPublico, { recursive: true });
  fs.mkdirSync(dirResp, { recursive: true });
  fs.writeFileSync(path.join(dirPublico, NOME_IMG_HO), a.img);
  const respPath = path.join(dirResp, NOME_RESP_HO);
  fs.writeFileSync(respPath, `${JSON.stringify(truth, null, 2)}\n`);
  const pin = {
    esquema: "rex-parallel-d/holdout-pin/3",
    xerado_por: truth.xerado_por,
    gabarito: GABARITO,
    contrato: CONTRATO,
    conxunto: "holdout",
    fronte: "A",
    sha_medido: "bd40e92",
    politica:
      "imaxe pública versionada; respostas reservadas fóra da árbore e pinadas por SHA. O holdout `cbb6895` da rolda 2 non se reutiliza (R17) e ningunha resposta se edita despois de executar a ferramenta (R0).",
    respostas_fora_da_arvore: dirResp,
    denominador: truth.denominador,
    layout: LAYOUT_HO,
    seed: SEED_HO,
    tamanhos_streams: TAMANHOS_HO,
    disxuncion: { layout_medicion: LAYOUT, criterio: "rutinas e fluxos en enderezos distintos; semente e tamaños de stream distintos; as sondas son as mesmas formas declaradas por A" },
    instrumento: truth.instrumento,
    arquivos: { [NOME_IMG_HO]: { sha256: sha256(a.img), bytes: a.img.length } },
    respostas: { [NOME_RESP_HO]: { sha256: sha256(fs.readFileSync(respPath)), bytes: fs.statSync(respPath).size } },
  };
  fs.writeFileSync(path.join(dirPublico, NOME_PIN_HO), `${JSON.stringify(pin, null, 2)}\n`);
  fs.rmSync(a.traballo, { recursive: true, force: true });
  return { a, pin, respPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = gravarHoldoutA();
  console.log(`[holdout A v2] ${NOME_IMG_HO} sha ${r.pin.arquivos[NOME_IMG_HO].sha256.slice(0, 16)}… respostas ${r.pin.respostas[NOME_RESP_HO].sha256.slice(0, 16)}…`);
  console.log(`[holdout A v2] ${Object.entries(r.pin.denominador.partes).map(([k, v]) => `${k} ${v}`).join(" · ")} = ${r.pin.denominador.total}`);
}
