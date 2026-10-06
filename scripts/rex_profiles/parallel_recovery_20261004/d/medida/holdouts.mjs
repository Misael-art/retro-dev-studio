/**
 * Execución dos holdouts H-A / H-B / H-C (requisito 8): inputs públicos na
 * árbore (`data/.../d/frentes/holdout/`, pin en `pin.json`), respostas reservadas
 * fóra da árbore (`~/rds-scratch/rex-heldout-d2/`).
 *
 * Os inputs nunca entraron no conxunto de medição; as respostas nunca serviron
 * para construír as ferramentas avaliadas (estaban publicadas antes). Aquí o
 * adaptador executa a ferramenta real sobre o input cego e compara co reservado
 * (R9: só se transfire o que a ferramenta emitiu).
 *
 * Uso: node scripts/.../d/medida/holdouts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BYOR,
  FERRAMENTAS,
  FIXTURES,
  PIN,
  RAIZ,
  SCRATCH,
  addr,
  executar,
  garantir,
  gravarEvidencia,
  jsonDoStdout,
  linha,
  lerEnd,
  sha256,
  sha256Arquivo,
  shaFerramenta,
  presente,
} from "./ferramentas.mjs";
import { adaptarA } from "./adapt_a.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DRIVER_B = path.join(AQUI, "drivers_b.py");
const DIR_HO = path.join(FIXTURES, "holdout");
const RESERVADO = path.join(process.env.HOME, "rds-scratch/rex-heldout-d2");
const lerp = (v) => (typeof v === "string" ? lerEnd(v) : v);
const linhas = [];
const brutos = [];
const pin = JSON.parse(fs.readFileSync(path.join(DIR_HO, "pin.json"), "utf8"));

/** Entrada pública: o ficheiro do disco ten de ser o pinado en `pin.json`. */
function entrada(id) {
  const e = pin.entradas.find((x) => x.id === id);
  const p = path.join(DIR_HO, e.arquivo.split("/").pop());
  const sha = sha256Arquivo(p);
  if (sha !== e.sha256) throw new Error(`holdout ${id}: input ${p} ≠ pin (${sha} vs ${e.sha256})`);
  return { path: p, sha, bytes: e.bytes };
}

const registrar = (o) => linhas.push(linha({ pontua: false, fora_do_denominador: true, ...o }));
const bruto = (nome, r) =>
  brutos.push({ nome, rc: r.rc, resumo: ((r.stdout || "") + (r.stderr || "")).trim().slice(0, 300), comando: [r.bin, ...(r.args ?? [])].join(" ") });

// ------------------------------------------------------------------ H-A (A real)
{
  if (!presente("A")) {
    registrar({ frente: "A", sha_frente: PIN.A, fila: "H-A", capacidade: "HOLDOUT", categoria: "desconhecido", veredito: "INCONCLUSIVE", motivo: `rex-chain ausente en ${FERRAMENTAS.A.bin}` });
  } else {
    const e = pin.entradas.find((x) => x.id === "H-A");
    const ent = entrada("H-A");
    const r = adaptarA({
      conjunto: "holdout",
      bin: FERRAMENTAS.A.bin,
      sha: PIN.A,
      nomeImg: path.basename(e.arquivo),
      respostas: e.respostas ?? "H-A-respostas.json",
    });
    for (const l of r.linhas) {
      registrar({ ...l, fila: `H-A/${l.fila}`, pontua: false, fora_do_denominador: true });
    }
    const passa = r.linhas.filter((l) => l.veredito === "PASS").length;
    console.log(`[H-A] ${e.arquivo.split("/").pop()} sha ${ent.sha.slice(0, 12)}… → ${r.linhas.length} filas da ferramenta real, ${passa} PASS (non pontúa no denominador)`);

    // Entradas declaradas void antes desta execución: o defecto é de autoría de D,
    // polo que se rexistran contra D, nunca contra a frente avaliada.
    for (const v of pin.entradas.filter((x) => x.estado === "void")) {
      registrar({
        frente: "D",
        sha_frente: PIN.A,
        fila: `${v.id}-VOID`,
        capacidade: "HOLDOUT",
        eixo: "procedencia-da-entrada",
        comando: `sha256 ${v.arquivo.split("/").pop()}`,
        rc: null,
        categoria: "nao-aplicavel",
        veredito: "VOID",
        esperados: { entrada_valida_no_dominio_de_A: true },
        medidos: { sha256: v.sha256, bytes: v.bytes, admitida_por_D: false },
        divergencias: [],
        motivo: v.motivo,
      });
    }
  }
}

// ------------------------------------------------------------------ H-B (B real)
{
  const resp = JSON.parse(fs.readFileSync(path.join(RESERVADO, "H-B-respostas.json"), "utf8"));
  const ent = entrada("H-B");
  const OUT = garantir(path.join(SCRATCH, "holdout-b"));
  const payload = path.join(OUT, "payload.json");
  fs.writeFileSync(
    payload,
    JSON.stringify({
      arvore: FERRAMENTAS.B.arvore,
      rom: BYOR.rom,
      acoes: [
        { id: "roundtrip", tipo: "roundtrip", plain: ent.path },
        { id: "recusa-stride", tipo: "projetar", plain: ent.path, stride: 64 },
        { id: "recusa-grade", tipo: "layout", plain: ent.path, linhas: 32 },
        { id: "padding-sujo", tipo: "padding_sujo", plain: ent.path, linha: 3, valor: 0x5a },
      ],
    }),
  );
  const d = executar("python3", [DRIVER_B, payload], { cwd: RAIZ, timeout: 300_000 });
  bruto("H-B-driver", d);
  const j = d.rc === 0 ? JSON.parse(d.stdout) : null;
  const rt = j?.acoes?.roundtrip ?? null;
  const divs = [];
  if (!rt) divs.push({ campo: "driver", esperado: "rc 0", medido: d.rc });
  else {
    if (rt.projecao_sha256 !== resp.projecao.sha256)
      divs.push({ campo: "projecao_sha256", esperado: resp.projecao.sha256, medido: rt.projecao_sha256 });
    if (!rt.identico_ao_plain) divs.push({ campo: "round_trip", esperado: true, medido: false });
    for (const cel of resp.celulas_discriminantes) {
      const k = `r${cel.r}c${cel.c}`;
      if (rt.celulas_discriminantes?.[k] !== cel.valor)
        divs.push({ campo: `celula_${k}`, esperado: cel.valor, medido: rt.celulas_discriminantes?.[k] });
    }
  }
  registrar({
    frente: "B", sha_frente: PIN.B_novo, fila: "H-B/roundtrip", capacidade: "HOLDOUT", eixo: "projeção",
    comando: `python3 drivers_b.py ${path.relative(RAIZ, payload)}`, rc: d.rc,
    esperados: { projecao_sha256: resp.projecao.sha256, round_trip: true, celulas: resp.celulas_discriminantes.map((c) => c.valor) },
    medidos: rt ? { projecao_sha256: rt.projecao_sha256, round_trip: rt.identico_ao_plain, celulas: rt.celulas_discriminantes } : null,
    divergencias: divs, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
    motivo: "grade nova (67e92f26…) nunca usada na medição; aritmética $FF1020 + r*128 + c recomposta por B",
  });
  for (const [id, chave] of [["H-B/recusa-stride", "recusa-stride"], ["H-B/recusa-grade", "recusa-grade"], ["H-B/padding-sujo", "padding-sujo"]]) {
    const r = j?.acoes?.[chave] ?? null;
    const esper = "geometria-errada" === r?.codigo || "padding-sujo" === r?.codigo;
    registrar({
      frente: "B", sha_frente: PIN.B_novo, fila: id, capacidade: "HOLDOUT", eixo: "recusa",
      comando: `python3 drivers_b.py ${path.relative(RAIZ, payload)}`, rc: d.rc,
      esperados: { recusa: "codigo de RecusaErro propio de B" },
      medidos: r ? { recusado: r.recusado, codigo: r.codigo ?? null } : null,
      divergencias: r && r.recusado && r.codigo ? [] : [{ campo: "recusa", esperado: "RecusaErro", medido: r ? "aceitou" : "sen datos" }],
      categoria: r && r.recusado && r.codigo ? "aplicavel" : "falha", veredito: r && r.recusado && r.codigo ? "PASS" : "FAIL",
      motivo: `sonda cega sobre a grade do holdout (${esper ? "recusa lexítima" : "sen recusa"})`,
    });
  }
}

// ------------------------------------------------------------------ H-C (C real)
{
  const resp = JSON.parse(fs.readFileSync(path.join(RESERVADO, "H-C-respostas.json"), "utf8"));
  const ent = entrada("H-C");
  if (!presente("C")) {
    registrar({ frente: "C", sha_frente: PIN.C, fila: "H-C", capacidade: "HOLDOUT", categoria: "desconhecido", veredito: "INCONCLUSIVE", motivo: `rex-cfg ausente en ${FERRAMENTAS.C.bin}` });
  } else {
    const OUT = garantir(path.join(SCRATCH, "holdout-c"));
    const out = path.join(OUT, "dC-cx9-ho1.json");
    if (fs.existsSync(out)) fs.rmSync(out);
    const reg = resp.regioes[0];
    const args = ["analyze", "--bin", ent.path, "--origin", addr(0), "--region", `${addr(reg.inicio)}:${addr(reg.fim)}`, "--region-prov", "holdout-D"];
    for (const r of resp.raizes) args.push("--root", addr(r.endereco), "--root-prov", r.proveniencia, "--root-evidence", String(r.evidencia ?? "holdout").replace(/\s+/g, "-"));
    args.push("--max-insn", "4096", "--out", out);
    const run = executar(FERRAMENTAS.C.bin, args, { cwd: OUT, timeout: 120_000 });
    bruto("H-C-analyze", run);
    const exp = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
    const ins = new Map();
    for (const b of exp?.blocos ?? []) for (const i of b.instrucoes ?? []) if (!ins.has(i.endereco)) ins.set(i.endereco, i);
    const arestas = new Map();
    for (const a of exp?.arestas ?? []) {
      if (!arestas.has(a.origem)) arestas.set(a.origem, []);
      arestas.get(a.origem).push(a);
    }
    for (const row of resp.sequencia) {
      const med = ins.get(lerp(row.endereco));
      const divs = [];
      if (!med) divs.push({ campo: "instrucao", esperado: `tam ${row.tam}`, medido: "ausente" });
      else {
        if (med.tam !== row.tam) divs.push({ campo: "tam", esperado: row.tam, medido: med.tam });
        const esperadoBytes = resp.bytes_por_endereco[`0x${row.endereco.toString(16)}`];
        const lidoNoArquivo = fs.readFileSync(ent.path).subarray(row.endereco, row.endereco + row.tam).toString("hex");
        if (esperadoBytes && lidoNoArquivo !== esperadoBytes) divs.push({ campo: "bytes", esperado: esperadoBytes, medido: lidoNoArquivo });
      }
      if (row.alvo !== undefined) {
        const cand = (arestas.get(lerp(row.endereco)) ?? []).find((a) => a.alvo === lerp(row.alvo) && a.tipo !== "queda");
        const queda = (arestas.get(lerp(row.endereco)) ?? []).find((a) => a.tipo === "queda");
        if (!cand && queda?.alvo !== lerp(row.alvo))
          divs.push({ campo: "alvo", esperado: addr(row.alvo), medido: (arestas.get(lerp(row.endereco)) ?? []).map((a) => `${a.tipo}->${addr(a.alvo)}`).join(",") || "sen aresta" });
      }
      registrar({
        frente: "C", sha_frente: PIN.C, fila: `H-C/${addr(row.endereco)}`, capacidade: "HOLDOUT", eixo: "instrução+fluxo",
        comando: ["rex-cfg", ...args].join(" "), rc: run.rc,
        esperados: { tam: row.tam, alvo: row.alvo === undefined ? null : addr(row.alvo), bytes: resp.bytes_por_endereco[`0x${row.endereco.toString(16)}`] ?? null },
        medidos: { tam: med?.tam ?? null, mnem: med?.mnem ?? null, arestas: (arestas.get(lerp(row.endereco)) ?? []).map((a) => `${a.tipo}->${a.alvo === null ? "null" : addr(a.alvo)}`) },
        divergencias: divs, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
        motivo: "sonda cega: instrucións e fluxo fóra dos catro fixtures de medição",
      });
    }
    const cob = exp?.cobertura?.["bytes-decodificados"] ?? null;
    const divs = cob === resp.cobertura_esperada_bytes ? [] : [{ campo: "cobertura", esperado: resp.cobertura_esperada_bytes, medido: cob }];
    registrar({
      frente: "C", sha_frente: PIN.C, fila: "H-C/cobertura", capacidade: "HOLDOUT", eixo: "cobertura",
      comando: ["rex-cfg", ...args].join(" "), rc: run.rc,
      esperados: { bytes: resp.cobertura_esperada_bytes, rexion: `${addr(reg.inicio)}:${addr(reg.fim)}` },
      medidos: { bytes_decodificados: cob, bytes_regiao: exp?.cobertura?.["bytes-regiao"] ?? null, fracao: exp?.cobertura?.fracao ?? null, fronteiras: (exp?.fronteiras ?? []).map((x) => `${addr(x.endereco)}/${x.tipo}`) },
      divergencias: divs, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      motivo: "Σ de comprimentos do reservado vs cobertura do export real",
    });
  }
}

const manifesto = {
  esquema: "rex-parallel-d/holdout-exec/1",
  gerado_em: new Date().toISOString().slice(0, 10),
  pin_entradas: pin,
  respostas_fora_da_arvore: RESERVADO,
  respostas_sha256: Object.fromEntries(
    fs.readdirSync(RESERVADO).filter((f) => f.endsWith(".json")).map((f) => [f, sha256Arquivo(path.join(RESERVADO, f))]),
  ),
  ferramentas: {
    A: { bin: FERRAMENTAS.A.bin, sha256: shaFerramenta("A") },
    B: { contrato: FERRAMENTAS.B.contrato, sha256: sha256Arquivo(FERRAMENTAS.B.contrato) },
    C: { bin: FERRAMENTAS.C.bin, sha256: shaFerramenta("C") },
  },
  nota: "filas do holdout non entran nos denominadores conxelados (§3/§4/§5); veredito separado",
};
// O nome da evidência leva a versión do input H-A: un re-execución non pisa a
// evidencia da versión anterior (perdêrase o run v1 por escribir sempre no mesmo
// ficheiro; errata §7).
const versAO = ((pin.entradas.find((x) => x.id === "H-A")?.arquivo || "").match(/ho(\d+)/) || [])[1] || "1";
const NOME_EVID = `holdouts-v${versAO}.jsonl`;
const desc = gravarEvidencia(NOME_EVID, linhas, manifesto);
garantir(path.join(SCRATCH, "holdouts"));
fs.writeFileSync(path.join(SCRATCH, "holdouts", `brutos-v${versAO}.json`), JSON.stringify(brutos, null, 2) + "\n");
console.log(`[holdout] ${desc.linhas} filas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…)`);
for (const l of linhas) {
  console.log(`  ${l.fila.padEnd(26)} ${String(l.veredito).padEnd(5)} ${l.categoria.padEnd(14)} ${l.divergencias?.length ? JSON.stringify(l.divergencias[0]).slice(0, 130) : ""}`);
}
