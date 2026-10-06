/**
 * Pontuador da avaliación (requisitos 4, 8 e 10): lee as evidencias executadas
 * (`medidas/*.jsonl`), audita-as contra o seu manifesto, e publica unha matriz
 * capacidade × SHA co denominador conxelado do contrato.
 *
 * Regras que este ficheiro impone (EXTENSOES-D §1, §2 R0/R2, §8):
 *  - `falha` dentro dunha capacidade alegada nunca se exclúe;
 *  - `desconhecido` vale `not_found`, xamais favorable;
 *  - `non aplicável` sae do denominador con motivo rexistrado;
 *  - as filas `pontua:false` (controles, auditorías, holdouts) non entran na
 *    matriz de capacidades;
 *  - non se calcula ningún percentual único transversal: cada capacidade ten o
 *    seu denominador e a matriz devolve fraccións separadas.
 *
 * Uso: node scripts/.../d/medida/pontuar.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  DATA,
  MEDIDAS,
  PIN,
  RAIZ,
  sha256,
} from "./ferramentas.mjs";

const FIX = path.join(DATA, "frentes");
const l = (nome) => {
  const p = path.join(MEDIDAS, nome);
  if (!fs.existsSync(p)) return null;
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((x) => x.trim())
    .map((x) => JSON.parse(x));
};

/** Audita a evidencia: o corpo do .jsonl ten de bater o sha do manifesto. */
function auditar(nome, linhas) {
  const mp = path.join(MEDIDAS, nome.replace(/\.jsonl$/, "-manifest.json"));
  if (!linhas) return { ok: false, motivo: `evidencia ausente: ${nome}` };
  if (!fs.existsSync(mp)) return { ok: false, motivo: `manifesto ausente: ${path.relative(RAIZ, mp)}` };
  const m = JSON.parse(fs.readFileSync(mp, "utf8"));
  const corpo = linhas.map((x) => JSON.stringify(x)).join("\n") + "\n";
  const sha = sha256(Buffer.from(corpo));
  return {
    ok: sha === m.sha256 && linhas.length === m.linhas,
    sha256: sha,
    manifesto: m,
    motivo: sha === m.sha256 ? "" : `corpo ${sha.slice(0, 12)}… ≠ manifesto ${(m.sha256 || "").slice(0, 12)}…`,
  };
}

/** Denominadores conxelados: os que levan ficha propia léen dela; C só ten a
 *  táboa §5 de EXTENSOES-D (non se reescriben as fixtures medidas para non mover
 *  os hashes pinados), así que van como literal citada e crúzanse coas filas
 *  realmente graduadas. */
const DENOM = {
  A: { fonte: `${path.relative(RAIZ, path.join(FIX, "a", "dA-truth-v1.json"))}`, arquivo: ["a", "dA-truth-v1.json"] },
  B: { fonte: `${path.relative(RAIZ, path.join(FIX, "b", "dB-truth-v1.json"))}`, arquivo: ["b", "dB-truth-v1.json"] },
  C: {
    fonte: "EXTENSOES-D.md §5 (táboa conxelada; as fichas de C non pinan denominador)",
    valor: { total: 42, partes: { KC1: 20, KC2: 6, KC3: 3, KC4: 4, KC5: 5, TC: 4 } },
  },
};

function denominador(frente) {
  const d = DENOM[frente];
  if (d.valor) return { ...d.valor, fonte: d.fonte };
  const t = JSON.parse(fs.readFileSync(path.join(FIX, ...d.arquivo), "utf8"));
  if (!t.denominador) throw new Error(`denominador ausente en ${d.fonte}`);
  return { ...t.denominador, fonte: d.fonte };
}

// `linha()` aniña os campos propios en `extras`, así que a marca máis recente
// de ambos os dous sitios conta.
const CAPACIDADES_PONTUADAS = (linhas) =>
  linhas.filter((x) => x.pontua !== false && (x.extras?.fora_do_denominador ?? x.fora_do_denominador) !== true);

function matriz(frente, sha, nome) {
  const linhas = l(nome);
  const audit = auditar(nome, linhas);
  const den = denominador(frente);
  if (!linhas) {
    return {
      frente,
      sha_frente: sha,
      evidencia: nome,
      auditoria: audit,
      capacidades: Object.entries(den.partes).map(([c, n]) => ({
        capacidade: c,
        denominador: n,
        graduadas: 0,
        pass: 0,
        estado: "desconhecido",
        motivo: `evidencia non executada: ${audit.motivo}`,
      })),
      total_graduadas: 0,
      denominador_total: den.total,
    };
  }
  const pont = CAPACIDADES_PONTUADAS(linhas);
  const porCap = new Map();
  for (const r of pont) {
    if (!porCap.has(r.capacidade)) porCap.set(r.capacidade, []);
    porCap.get(r.capacidade).push(r);
  }
  const capacidades = [];
  for (const [capacidade, n] of Object.entries(den.partes)) {
    const filas = porCap.get(capacidade) ?? [];
    const pass = filas.filter((x) => x.veredito === "PASS").length;
    const fail = filas.filter((x) => x.veredito === "FAIL");
    const naoSuportado = filas.filter((x) => x.categoria === "nao-suportado" && x.veredito === "PASS");
    const desconhecido = filas.filter((x) => x.categoria === "desconhecido" || x.veredito === "INCONCLUSIVE");
    const cobertura = filas.length === n ? "coherente" : "DIVERXENTE";
    capacidades.push({
      capacidade,
      denominador: n,
      graduadas: filas.length,
      cobertura,
      pass,
      falhas: fail.map((x) => ({ fila: x.fila, motivo: x.motivo || "", desvio: x.divergencias?.[0] ?? null, rc: x.rc, rc_esperado: x.rc_esperado })),
      nao_suportado: naoSuportado.map((x) => x.fila),
      desconhecido: desconhecido.map((x) => x.fila),
      fraccion: `${pass}/${n}`,
      // R0: unha fila con categoría `desconhecido` dentro da capacidade non se
      // conta como aprobada; a fracción é só do que a ferramenta cumpriu.
      nota: cobertura === "DIVERXENTE" ? "filas graduadas ≠ denominador conxelado" : "",
    });
  }
  const extras = [...porCap.keys()].filter((c) => !(c in den.partes));
  return {
    frente,
    sha_frente: sha,
    evidencia: nome,
    auditoria: { ok: audit.ok, sha256: audit.sha256, motivo: audit.motivo, xerado_em: audit.manifesto?.gerado_em ?? null },
    procedencia: audit.manifesto?.procedencia ?? null,
    capacidade_fora_do_denominador: extras,
    capacidades,
    denominador_total: den.total,
    fonte_denominador: den.fonte,
    excluidas: linhas
      .filter((x) => x.pontua === false)
      .map((x) => ({ fila: x.fila, capacidade: x.capacidade, veredito: x.veredito, motivo: x.motivo || "control non pontuado" })),
  };
}

function matrizHoldout(nome) {
  const linhas = l(nome);
  const audit = auditar(nome, linhas);
  if (!linhas) return { evidencia: nome, auditoria: audit, grupos: [], motivo: audit.motivo };
  const grupos = [];
  for (const frente of ["A", "B", "C", "D"]) {
    const filas = linhas.filter((x) => x.frente === frente);
    if (!filas.length) continue;
    grupos.push({
      frente,
      filas: filas.length,
      pass: filas.filter((x) => x.veredito === "PASS").length,
      falhas: filas.filter((x) => x.veredito === "FAIL").map((x) => ({ fila: x.fila, desvio: x.divergencias?.[0] ?? null })),
      void: filas.filter((x) => x.veredito === "VOID").map((x) => ({ fila: x.fila, motivo: x.motivo })),
      inconclusivas: filas.filter((x) => x.veredito === "INCONCLUSIVE").map((x) => x.fila),
      controlados: filas.filter((x) => x.veredito === "CONTROLADO").map((x) => x.fila),
    });
  }
  return { evidencia: nome, auditoria: { ok: audit.ok, sha256: audit.sha256 }, grupos };
}

const saide = {
  esquema: "rex-parallel-d/matriz/1",
  regra: "capacidade × SHA, denominador conxelado; sen percentual único transversal (§8)",
  bases: {
    worktree_base_frozen: PIN.base,
    inventario: { A: PIN.A, A_corrixido: PIN.A_corrixido, B_velho: PIN.B_velho, B_novo: PIN.B_novo, C: PIN.C },
  },
  frentes: [
    matriz("A", PIN.A, `A-${PIN.A.slice(0, 7)}.jsonl`),
    matriz("A", PIN.A_corrixido, `A-${PIN.A_corrixido.slice(0, 7)}.jsonl`),
    matriz("B", PIN.B_velho, `B-${PIN.B_velho.slice(0, 7)}.jsonl`),
    matriz("B", PIN.B_novo, `B-${PIN.B_novo.slice(0, 7)}.jsonl`),
    matriz("C", PIN.C, `C-${PIN.C.slice(0, 7)}.jsonl`),
  ],
  holdouts: [matrizHoldout("holdouts-v3.jsonl")],
};

// ------------------------------------------------------------------ markdown
function tabela(m) {
  const O = [];
  O.push(`### Frente ${m.frente} @ \`${m.sha_frente.slice(0, 7)}\``);
  O.push("");
  O.push(`- evidencia: \`medidas/${m.evidencia}\` (sha \`${(m.auditoria.sha256 || "—").slice(0, 12)}…\`, auditada: ${m.auditoria.ok ? "SI" : "NON — " + m.auditoria.motivo})`);
  O.push(`- denominador conxelado: ${m.denominador_total} filas — fonte: ${m.fonte_denominador}`);
  if (m.procedencia) {
    const p = m.procedencia;
    O.push(
      `- procedencia da ferramenta: \`${p.frente}@${(p.sha || "").slice(0, 7)}\` — ${p.ok ? "byte a byte co commit" : "DIVERXENTE"} (${p.arquivos} ficheiros comparados, ${p.divergentes?.length ?? 0} diverxentes, ${p.faltantes?.length ?? 0} faltantes)`,
    );
  } else {
    O.push(`- procedencia da ferramenta: non rexistrada nesta evidencia`);
  }
  O.push("");
  O.push("| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |");
  O.push("|---|---|---|---|---|---|---|");
  for (const c of m.capacidades) {
    O.push(
      `| ${c.capacidade} | ${c.denominador} | ${c.graduadas}${c.cobertura === "coherente" ? "" : " ⚠"} | ${c.pass} | ${c.falhas.length} | ${c.nao_suportado.length} | ${c.desconhecido.length} |`,
    );
  }
  const falhas = m.capacidades.flatMap((c) => c.falhas.map((f) => ({ ...f, capacidade: c.capacidade })));
  if (falhas.length) {
    O.push("");
    O.push("Falhas conservadas (R0 — non se exclúen de capacidade alegada):");
    for (const f of falhas) {
      O.push(`- \`${f.capacidade}/${f.fila}\` rc=${f.rc} esperado ${f.rc_esperado}${f.desvio ? ` — ${JSON.stringify(f.desvio)}` : ""}${f.motivo ? ` — ${f.motivo}` : ""}`);
    }
  }
  if (m.excluidas?.length) {
    O.push("");
    O.push(`Excluídas do denominador (${m.excluidas.length}) con motivo:`);
    for (const e of m.excluidas) O.push(`- \`${e.capacidade}/${e.fila}\` → ${e.veredito}: ${e.motivo}`);
  }
  return O.join("\n");
}

const md = [
  "# Matriz de avaliación — frente D (paralela 2026-10-04)",
  "",
  `Xerado por \`pontuar.mjs\`; cada capacidade co seu denominador conxelado.`,
  `**Non existe percentual único** (§8): as fraccións por capacidade non se suman`,
  `porque miden dominios distintos (cadea/ISA/enderezamento/decode/adulteración).`,
  "",
  ...saide.frentes.map(tabela),
  "",
  "## Holdouts (fora dos denominadores)",
  "",
];
for (const h of saide.holdouts) {
  md.push(`- \`medidas/${h.evidencia}\` (sha \`${(h.auditoria?.sha256 || "—").slice(0, 12)}…\`, auditada: ${h.auditoria?.ok ? "SI" : "NON" + (h.motivo ? ` — ${h.motivo}` : "")})`);
  for (const g of h.grupos || []) {
    md.push(
      `  - ${g.frente}: ${g.pass}/${g.filas} PASS, falhas ${g.falhas.map((f) => f.fila).join(", ") || "nenhuma"}, void ${g.void.map((v) => v.fila).join(", ") || "nenhum"}, inconclusivas ${g.inconclusivas.join(", ") || "nenhuma"}`,
    );
  }
}
for (const h of saide.holdouts) {
  for (const g of h.grupos || []) {
    for (const v of g.void) md.push(`  - VOID rexistrado contra ${g.frente}: \`${v.fila}\` — ${v.motivo}`);
  }
}

fs.writeFileSync(path.join(MEDIDAS, "matriz.json"), JSON.stringify(saide, null, 2) + "\n");
fs.writeFileSync(path.join(MEDIDAS, "matriz.md"), md.join("\n") + "\n");
console.log(md.join("\n"));
