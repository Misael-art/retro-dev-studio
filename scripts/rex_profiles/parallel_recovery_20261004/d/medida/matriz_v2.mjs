/**
 * Matriz v2 por capacidade × SHA × versión de gabarito (barra D, rolda 3, requisito 10).
 *
 * Sae só das evidencias executadas (`medidas/*.jsonl`), auditadas contra o seu manifesto.
 * Regras: cada capacidade ten o seu denominador (as filas `pontua !== false`); VOID,
 * falhas, desconhecidos e controis non puntuados publícanse á vista; **non hai ningunha
 * cifra agregada** entre capacidades, frontes nin SHA. As filas do gabarito v1 non se
 * reescriben: aparecen coa súa versión e unha nota de interpretación.
 *
 * Uso: node scripts/…/d/medida/matriz_v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { MEDIDAS, RAIZ, sha256 } from "./ferramentas.mjs";

const V1 = "v1 (táboa ISA antiga / bytes a man; control histórico)";
const V2 = "isa-oraculo-v2 / EXTENSOES-D v2";
const V2B = "isa-oraculo-v2 / EXTENSOES-D v2-B";

/** Cada entrada: evidencia, conxunto e versión de gabarito. A orde é a da publicación. */
export const ENTRADAS = [
  { ev: "A-bd40e92-v2", conxunto: "medición", gab: V2 },
  { ev: "A-holdout-v2", conxunto: "holdout compatible (novo)", gab: V2 },
  { ev: "C-8ea5821-v2", conxunto: "medición", gab: V2 },
  { ev: "C-holdout-v2", conxunto: "holdout compatible (novo)", gab: V2 },
  { ev: "B-da5472c-v2", conxunto: "medición (gabarito novo por capacidade)", gab: V2B },
  { ev: "B-da5472c", conxunto: "medición (gabarito v1 reexecutado)", gab: V1 },
  { ev: "A-cbb6895", conxunto: "medición histórica", gab: V1, historico: true },
  { ev: "A-bd40e92", conxunto: "medición histórica (gabarito v1 sobre o SHA novo)", gab: V1, historico: true },
  { ev: "B-396e0b8", conxunto: "medición histórica", gab: V1, historico: true },
  { ev: "B-cffe17f", conxunto: "medición histórica", gab: V1, historico: true },
  { ev: "C-275f2af", conxunto: "medición histórica", gab: V1, historico: true },
];

const ler = (ev) => {
  const p = path.join(MEDIDAS, `${ev}.jsonl`);
  const mp = path.join(MEDIDAS, `${ev}-manifest.json`);
  if (!fs.existsSync(p) || !fs.existsSync(mp)) throw new Error(`evidencia ausente: ${ev}`);
  const corpo = fs.readFileSync(p, "utf8");
  const m = JSON.parse(fs.readFileSync(mp, "utf8"));
  const linhas = corpo.split("\n").filter((x) => x.trim()).map((x) => JSON.parse(x));
  const reconstruido = linhas.map((x) => JSON.stringify(x)).join("\n") + "\n";
  const ok = sha256(Buffer.from(reconstruido)) === m.sha256 && linhas.length === m.linhas;
  if (!ok) throw new Error(`evidencia ${ev}: corpo non bate co manifesto`);
  return { linhas, manifesto: m, sha256: m.sha256 };
};

const pontua = (l) => l.pontua !== false && (l.extras?.fora_do_denominador ?? l.fora_do_denominador) !== true;
const nivelDe = (l) => l.extras?.nivel ?? l.nivel ?? null;
const resumo = (s, n = 140) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);

export function construir() {
  const filas = [];
  const perdas = [];
  const voids = [];
  const controis = [];
  for (const e of ENTRADAS) {
    const { linhas, manifesto, sha256: shaEv } = ler(e.ev);
    const porCap = new Map();
    for (const l of linhas) {
      const k = l.capacidade;
      if (!porCap.has(k)) porCap.set(k, []);
      porCap.get(k).push(l);
    }
    for (const [cap, ls] of porCap) {
      const p = ls.filter(pontua);
      const nao = ls.filter((l) => !pontua(l));
      const c = (v) => p.filter((l) => l.veredito === v).length;
      const desc = p.filter((l) => !["PASS", "FAIL"].includes(l.veredito)).length;
      const gabs = [...new Set(ls.map((l) => l.gabarito).filter(Boolean))];
      const niveis = [...new Set((p.length ? p : ls).map(nivelDe).filter(Boolean))];
      if (p.length === 0 && nao.length === 0) continue;
      filas.push({
        frente: ls[0].frente, sha: (ls[0].sha_frente ?? "").slice(0, 7), capacidade: cap,
        conxunto: e.conxunto, gabarito: e.gab, gabarito_nas_filas: gabs, historico: !!e.historico,
        nivel: niveis.length ? niveis.join("+") : null,
        pontuaveis: p.length, pass: c("PASS"), fail: c("FAIL"), desconhecido: desc,
        void: nao.filter((l) => l.veredito === "VOID").length,
        nao_puntuadas: nao.length,
        evidencia: `${e.ev}.jsonl`, evidencia_sha256: shaEv,
      });
      for (const l of p.filter((x) => x.veredito === "FAIL")) {
        perdas.push({ frente: l.frente, sha: (l.sha_frente ?? "").slice(0, 7), conxunto: e.conxunto, gabarito: e.gab, capacidade: cap, fila: l.fila, historico: !!e.historico,
          razon: resumo(l.desvio ?? l.motivo ?? JSON.stringify(l.divergencias?.[0] ?? "")) });
      }
      for (const l of nao.filter((x) => x.veredito === "VOID")) {
        voids.push({ frente: l.frente, sha: (l.sha_frente ?? "").slice(0, 7), conxunto: e.conxunto, gabarito: e.gab, capacidade: cap, fila: l.fila, historico: !!e.historico, razon: resumo(l.desvio ?? l.motivo) });
      }
      for (const l of nao.filter((x) => ["INCOHERENTE", "INCONCLUSIVE"].includes(x.veredito))) {
        controis.push({ frente: l.frente, sha: (l.sha_frente ?? "").slice(0, 7), conxunto: e.conxunto, capacidade: cap, fila: l.fila, veredito: l.veredito, historico: !!e.historico, razon: resumo(l.motivo) });
      }
      void manifesto;
    }
  }
  return { filas, perdas, voids, controis };
}

const TXT_LIMITES = [
  "A matriz mide **capacidades declaradas** coas expectativas do gabarito indicado; non mide «universalidade» e non hai ningunha cifra agregada. `VOID` = defecto de autoría de D retirado do denominador; `descoñecido` = sen medición posíbel.",
  "Ningunha liña chega a `consumo-observado` (non se executa ROM) nin a `equivalencia`: o nivel máximo publicado é `vinculo-estrutural`.",
  "A (A bd40e92): o holdout cobre xeometría, datos e enderezos novos; a gramática de A é pechada, así que **non xeneraliza a formas non declaradas**.",
  "C (8ea5821): a disxunción do holdout é de palabras e sitios, non de clases de instrución; un FAIL de `coherencia-contrato-código` é unha diverxencia prosa↔código, non un fallo de seguranza.",
  "B (da5472c): sen decoder Enigma independente, `KBE` non mide equivalencia de saída; `KBE-slot-5` e `KBE-equivalencia` quedan `descoñecido` (INCONCLUSIVE, non VOID: VOID reservase a defectos de autoría de D). O CRAM está só ao nivel `vinculo-estrutural` (E22 de B).",
  "As filas do gabarito v1 conservan os seus vereditos históricos; a súa interpretación («A regrediu») está retificada en §12.16 e non se usa como gabarito do perfil corrixido.",
];

export function md({ filas, perdas, voids, controis }) {
  const out = [];
  out.push("# Matriz D v2 — capacidade × SHA × versión de gabarito", "");
  out.push("Xerada por `scripts/…/d/medida/matriz_v2.mjs` a partir de `data/…/d/medidas/*.jsonl` (cada evidencia auditada contra o seu manifesto). **Non editar a man.**", "");
  out.push("## Límites que a matriz non esconde", "", ...TXT_LIMITES.map((x) => `- ${x}`), "");
  const tabela = (rows) => {
    out.push("| fronte | SHA | capacidade | conxunto | gabarito | nivel | pontuábeis | PASS | FAIL | desconh. | VOID | non puntuadas | evidencia |");
    out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rows)
      out.push(`| ${r.frente} | \`${r.sha}\` | ${r.capacidade} | ${r.conxunto} | ${r.gabarito} | ${r.nivel ?? "—"} | ${r.pontuaveis} | ${r.pass} | ${r.fail} | ${r.desconhecido} | ${r.void} | ${r.nao_puntuadas} | \`${r.evidencia}\` (\`${r.evidencia_sha256.slice(0, 10)}…\`) |`);
    out.push("");
  };
  out.push("## Medicións vixentes (gabarito v2)", "");
  tabela(filas.filter((r) => !r.historico && r.gabarito !== V1));
  out.push("## B en `da5472c` co gabarito v1 (reexecutado, **non cobre CRAM nin decoder nativo**)", "");
  tabela(filas.filter((r) => !r.historico && r.gabarito === V1));
  out.push("## Control histórico (gabarito v1, non é gabarito do perfil corrixido)", "");
  tabela(filas.filter((r) => r.historico));
  const lista = (titulo, rows, cols) => {
    out.push(`## ${titulo}`, "");
    if (!rows.length) { out.push("_ningún_", ""); return; }
    out.push(`| ${cols.map((c) => c[0]).join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
    for (const r of rows) out.push(`| ${cols.map((c) => String(c[1](r)).replace(/\|/g, "\\|")).join(" | ")} |`);
    out.push("");
  };
  const cols = [["fronte", (r) => r.frente], ["SHA", (r) => `\`${r.sha}\``], ["conxunto", (r) => r.conxunto], ["gabarito", (r) => r.gabarito], ["capacidade", (r) => r.capacidade], ["fila", (r) => `\`${r.fila}\``], ["razón", (r) => r.razon]];
  lista("Perdas (FAIL) vixentes", perdas.filter((r) => !r.historico && r.gabarito !== V1), cols);
  lista("VOID vixentes (defecto de autoría de D, retirados do denominador)", voids.filter((r) => !r.historico && r.gabarito !== V1), cols);
  lista("Controis non puntuados con resultado incoherente/inconclusivo (vixentes)", controis.filter((r) => !r.historico && !/v1/.test(r.conxunto)), [["fronte", (r) => r.frente], ["SHA", (r) => `\`${r.sha}\``], ["conxunto", (r) => r.conxunto], ["fila", (r) => `\`${r.fila}\``], ["veredito", (r) => r.veredito], ["razón", (r) => r.razon]]);
  lista("Perdas e VOID históricos (gabarito v1; ver §12.16 para a interpretación)", [...perdas.filter((r) => r.historico || r.gabarito === V1), ...voids.filter((r) => r.historico)], cols);
  return `${out.join("\n")}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = construir();
  const pj = path.join(MEDIDAS, "matriz-v2.json");
  fs.writeFileSync(pj, `${JSON.stringify({ esquema: "rex-parallel-d/matriz/2", limites: TXT_LIMITES, ...m }, null, 2)}\n`);
  const pm = path.join(RAIZ, "docs/rex_profiles/parallel_recovery_20261004/d/MATRIZ-D-v2.md");
  fs.writeFileSync(pm, md(m));
  console.log(`[matriz v2] ${m.filas.length} linhas, ${m.perdas.length} perdas, ${m.voids.length} VOID, ${m.controis.length} controis → ${path.relative(RAIZ, pm)}`);
}
