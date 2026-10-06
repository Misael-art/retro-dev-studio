/**
 * Adaptador v3 da frente C (`rex-cfg` en `5f97368`) — barra D, §12.17.
 *
 * Reutiliza o escore v2 (`adaptarC2`) con tres cambios explícitos e versionados:
 *  - verdades de `frentes/c-v3/` (as v2 con `KC1v-movea-l-imm-a1` retificada);
 *  - mapa de citacións do novo ponteiro datado do contrato (`+22` por baixo do umbral, `+101` por riba);
 *  - esquemas `rex-cfg-sitio/v2` e `rex-cfg-med/v2`.
 * E engade a avaliación das fixtures `cx5` (pública) e `ho5` (holdout): `TRAP #n`,
 * `MOVEA` .W/.L e `(xxx).W` con extensión de sinal, por `analyze` e `consultar`.
 *
 * Nada aquí calcula un valor esperado: sae das verdades conxeladas.
 *
 * Uso: node …/medida/adapt_c_v3.mjs [--conjunto medicao|holdout|regresion-holdout-v2]
 */
import fs from "node:fs";
import path from "node:path";
import {
  FERRAMENTAS, RAIZ, SCRATCH_V2, addr, executar, garantir, gravarEvidencia, linha, sha256Arquivo, presente, verificarProcedencia, lerEnd,
} from "./ferramentas.mjs";
import { adaptarC2 } from "./adapt_c_v2.mjs";

const DATA = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes");
export const DIR_V3 = path.join(DATA, "c-v3");
export const DIR_HO = path.join(DATA, "c-holdout");
export const RESP = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
const GABARITO = "isa-oraculo-v2";
export const CONTRATO_V3 = "EXTENSOES-D v3-C";
const PARAMS_V3 = { desprazo: 101, desprazoBase: 22, esquemaSitio: "rex-cfg-sitio/v2", esquemaMedir: "rex-cfg-med/v2" };
const num = (v) => (typeof v === "string" ? lerEnd(v) : v);
const div = (campo, esperado, medido) => ({ campo, esperado, medido: medido === undefined ? null : medido });

function indice(exp) {
  const ins = new Map();
  for (const b of exp?.blocos ?? []) for (const i of b.instrucoes ?? []) if (!ins.has(i.endereco)) ins.set(i.endereco, i);
  const fronteiras = new Map((exp?.fronteiras ?? []).map((f) => [f.endereco, f]));
  return { ins, fronteiras, arestas: exp?.arestas ?? [] };
}

/** Avalía `cx5`/`ho5`. `truthPath`/`imgPath` seleccionan o conxunto; `pin` verifica a imaxe. */
export function avaliarCx5({ chave, conjunto, truthPath, imgPath, esquemaSitio }) {
  const f = FERRAMENTAS[chave];
  const t = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  if (sha256Arquivo(imgPath) !== t.imaxe.sha256) throw new Error(`R1: ${path.basename(imgPath)} difire do pin do gabarito`);
  const OUT = garantir(path.join(SCRATCH_V2, "c-v3"));
  const reg = t.regioes[0];
  const base = ["--bin", path.relative(RAIZ, imgPath), "--origin", addr(t.origin), "--region", `${addr(reg.inicio)}:${addr(reg.fim)}`];
  const raizesA = t.raizes.flatMap((r) => ["--root", addr(r.endereco), "--root-prov", r.proveniencia, "--root-evidence", String(r.evidencia).replace(/\s+/g, "-")]);
  const out = path.join(OUT, `${conjunto}-cx5.json`);
  if (fs.existsSync(out)) fs.rmSync(out);
  const argsA = ["analyze", ...base, "--region-prov", "regiao-autoral-D", ...raizesA, "--max-insn", "4096", "--out", out];
  const ra = executar(f.bin, argsA, { cwd: RAIZ, timeout: 120_000 });
  const exp = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  const ix = indice(exp);
  const linhas = [];
  const comum = (o) => ({ frente: "C", sha_frente: f.sha, gabarito: GABARITO, contrato: CONTRATO_V3, ...o });
  for (const row of t.filas) {
    const end = row.endereco;
    const esp = row.esperado;
    const divs = [];
    let cmd = `rex-cfg ${argsA.join(" ")}`;
    let medidos = {};
    let rc = ra.rc;
    if (row.cap === "CVv") {
      const outq = path.join(OUT, `${conjunto}-consultar-${end.toString(16)}.json`);
      if (fs.existsSync(outq)) fs.rmSync(outq);
      const argsQ = ["consultar", ...base, ...t.raizes.flatMap((r) => ["--root", addr(r.endereco), "--root-prov", r.proveniencia]), "--site", addr(end), "--out", outq];
      const rq = executar(f.bin, argsQ, { cwd: RAIZ, timeout: 60_000 });
      rc = rq.rc;
      cmd = `rex-cfg ${argsQ.join(" ")}`;
      const j = fs.existsSync(outq) ? JSON.parse(fs.readFileSync(outq, "utf8")) : null;
      medidos = j ? { schema: j.schema, alvo: j.alvo, efetivo: j["endereco-efetivo"], barramento: j["endereco-de-barramento"], offset: j["offset-de-objeto"], promovivel: j["promovivel-vinculo-estrutural"], consumidor: j["consumidor-validado"] } : {};
      if (!j) divs.push(div("export", "gravado", `rc ${rq.rc}`));
      else {
        if (j.schema !== esquemaSitio) divs.push(div("schema", esquemaSitio, j.schema));
        const cmp = (campo, esperado, medido) => { if (num(medido) !== esperado) divs.push(div(campo, esperado, medido)); };
        cmp("alvo", esp.alvo, j.alvo);
        cmp("endereco-efetivo", esp.endereco_efetivo, j["endereco-efetivo"]);
        cmp("endereco-de-barramento", esp.endereco_de_barramento, j["endereco-de-barramento"]);
        if (esp.offset_de_objeto === null ? j["offset-de-objeto"] !== null : num(j["offset-de-objeto"]) !== esp.offset_de_objeto)
          divs.push(div("offset-de-objeto", esp.offset_de_objeto, j["offset-de-objeto"]));
        if (j["promovivel-vinculo-estrutural"] !== esp.promovivel_vinculo_estrutural) divs.push(div("promovivel", esp.promovivel_vinculo_estrutural, j["promovivel-vinculo-estrutural"]));
        if (j["consumidor-validado"] !== esp.consumidor_validado) divs.push(div("consumidor-validado", esp.consumidor_validado, j["consumidor-validado"]));
      }
    } else if (row.cap === "KC4v" && esp.fronteira) {
      const ins = ix.ins.get(end);
      const fr = ix.fronteiras.get(end);
      medidos = { ins: ins ? { tam: ins.tam, mnem: ins.mnem } : null, fronteira: fr?.tipo ?? null };
      if (!ins) divs.push(div("instrucao", `trap ${esp.tam} B`, "ausente"));
      else {
        if (ins.tam !== esp.tam) divs.push(div("tam", esp.tam, ins.tam));
        if (!esp.stems.some((s) => String(ins.mnem).toLowerCase().includes(s))) divs.push(div("mnem", esp.stems.join("|"), ins.mnem));
      }
      if (fr?.tipo !== esp.fronteira) divs.push(div("fronteira", esp.fronteira, fr?.tipo ?? "ausente"));
    } else if (row.cap === "KC4v") {
      const a = ix.arestas.filter((x) => x.origem === end && x.tipo === esp.aresta_tipo);
      const m = a[0];
      medidos = { arestas: a.map((x) => ({ alvo: x.alvo, status: x.status })) };
      if (!m) divs.push(div("aresta", `${esp.aresta_tipo} de ${addr(end)}`, "ausente"));
      else {
        if (m.alvo !== esp.alvo) divs.push(div("alvo", esp.alvo, m.alvo));
        if (m.status !== esp.status) divs.push(div("status", esp.status, m.status));
      }
    } else {
      const ins = ix.ins.get(end);
      medidos = { ins: ins ? { tam: ins.tam, mnem: ins.mnem } : null };
      if (!ins) divs.push(div("instrucao", `${esp.tam} B`, "ausente"));
      else {
        if (ins.tam !== esp.tam) divs.push(div("tam", esp.tam, ins.tam));
        if (!esp.stems.some((s) => String(ins.mnem).toLowerCase().includes(s))) divs.push(div("mnem", esp.stems.join("|"), ins.mnem));
      }
    }
    linhas.push(linha(comum({
      fila: row.id, capacidade: row.cap, eixo: row.cap === "CVv" ? "consultar" : "analyze", nivel: "referencia-estatica", comando: cmd, rc, rc_esperado: 0,
      esperados: esp, medidos, divergencias: divs, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      bytes: row.bytes, sondeo: row.desmontaxe, motivo: `forma ${row.forma}: esperado ditado polo instrumento/contrato de C`,
    })));
  }
  return { linhas, truth: t };
}

export function adaptarC3({ chave = "C_novo2", conjunto = "medicao", respostasDir = RESP, truthCx5 = null } = {}) {
  if (!presente(chave)) return { ausente: true, linhas: [] };
  const f = FERRAMENTAS[chave];
  const relabel = (l) => linha({ ...l, ...l.extras, contrato: CONTRATO_V3 });
  let linhas = [];
  let manifesto = {};
  if (conjunto === "medicao") {
    const pin = JSON.parse(fs.readFileSync(path.join(DIR_V3, "pin-c-v3.json"), "utf8"));
    if (!truthCx5) for (const [n, e] of Object.entries(pin.arquivos)) if (sha256Arquivo(path.join(DIR_V3, n)) !== e.sha256) throw new Error(`pin pin-c-v3.json: ${n} diverxe do hash versionado`);
    const base = adaptarC2({ chave, conjunto: "medicao", dirVerdade: truthCx5 ? null : DIR_V3, ...PARAMS_V3 });
    const cx5 = avaliarCx5({ chave, conjunto, truthPath: truthCx5 ?? path.join(DIR_V3, "dC-cx5-truth-v3.json"), imgPath: path.join(DIR_V3, "dC-cx5-v3.bin"), esquemaSitio: PARAMS_V3.esquemaSitio });
    linhas = [...base.linhas.map(relabel), ...cx5.linhas];
    manifesto = { ...base.manifesto, conjunto, pin_v3: { arquivo: "pin-c-v3.json", sha256: sha256Arquivo(path.join(DIR_V3, "pin-c-v3.json")) }, denominador_cx5: cx5.truth.denominador };
  } else if (conjunto === "holdout") {
    const pin = JSON.parse(fs.readFileSync(path.join(DIR_HO, "pin-holdout-c-v3.json"), "utf8"));
    const rp = path.join(respostasDir, "dC-ho5-respostas.json");
    if (!fs.existsSync(rp)) throw new Error("pin pin-holdout-c-v3.json: resposta reservada dC-ho5-respostas.json ausente");
    if (sha256Arquivo(rp) !== pin.respostas["dC-ho5-respostas.json"].sha256) throw new Error("pin pin-holdout-c-v3.json: dC-ho5-respostas.json diverxe do SHA pinado (resposta alterada)");
    for (const [n, e] of Object.entries(pin.arquivos)) if (sha256Arquivo(path.join(DIR_HO, n)) !== e.sha256) throw new Error(`pin pin-holdout-c-v3.json: ${n} diverxe do hash versionado`);
    const cx5 = avaliarCx5({ chave, conjunto, truthPath: rp, imgPath: path.join(DIR_HO, "dC-ho5-v3.bin"), esquemaSitio: PARAMS_V3.esquemaSitio });
    linhas = cx5.linhas;
    manifesto = { conjunto, pin: { arquivo: "pin-holdout-c-v3.json", sha256: sha256Arquivo(path.join(DIR_HO, "pin-holdout-c-v3.json")) }, denominador: cx5.truth.denominador };
  } else if (conjunto === "regresion-holdout-v2") {
    const r = adaptarC2({ chave, conjunto: "holdout", ...PARAMS_V3 });
    linhas = r.linhas.map((l) => linha({ ...l, ...l.extras, contrato: "EXTENSOES-D v2 (holdout GASTO de 8ea5821: reexecución, non é holdout deste SHA)" }));
    manifesto = { ...r.manifesto, conjunto };
  } else throw new Error(`conxunto descoñecido: ${conjunto}`);
  manifesto = { ...manifesto, frente: "C", sha_frente: f.sha, gabarito: GABARITO, contrato: CONTRATO_V3, procedencia: verificarProcedencia(chave) };
  return { ausente: false, linhas, manifesto };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--conjunto");
  const conjunto = i >= 0 ? process.argv[i + 1] : "medicao";
  const r = adaptarC3({ conjunto });
  if (r.ausente) { console.log("[C v3] ferramenta ausente"); process.exitCode = 3; }
  else {
    const nome = { medicao: "C-5f97368-v3", holdout: "C-5f97368-holdout-v3", "regresion-holdout-v2": "C-5f97368-regresion-holdout-v2" }[conjunto] + ".jsonl";
    const d = gravarEvidencia(nome, r.linhas, r.manifesto);
    const por = {};
    for (const l of r.linhas) { const k = `${l.pontua === false ? "(np) " : ""}${l.veredito}`; por[k] = (por[k] ?? 0) + 1; }
    console.log(`[C v3 ${conjunto}] ${d.linhas} linhas → ${d.arquivo} (sha ${d.sha256.slice(0, 12)}…) ${JSON.stringify(por)}`);
    for (const l of r.linhas) if (["FAIL", "INCOHERENTE", "INCONCLUSIVE", "VOID"].includes(l.veredito)) console.log(`  ${String(l.fila).padEnd(30)} ${l.veredito.padEnd(12)} ${JSON.stringify(l.divergencias).slice(0, 180)} ${(l.desvio ?? "").slice(0, 100)}`);
  }
}
