/**
 * Adaptador v3 da frente A (`rex-chain` en `6ae4f02`) — barra D, §12.17.
 *
 * Desde `6ae4f02` A só promove un par carga→chamada por xanela recta, limpa e con
 * candidato único; o resto esixe `--chamada-sitio`. A medición ten tres partes:
 *  1. as fixtures v2 de D (pública ou holdout v3) co sitio da chamada **declarado**
 *     (o que GAS puxo, non o que A ache) — mesmo escore `adaptarA2`;
 *  2. os casos de segmento (`dA-seg-v3`/`dA-seg-ho-v3`): auto, declarado e un negativo;
 *  3. un control: a mesma imaxe v2 SEN declarar, que mostra o cambio de contrato
 *     (publícase, non puntúa: é o contrato anterior).
 * `detectar` non ten expectativa independente: queda `descoñecido`.
 *
 * Uso: node …/medida/adapt_a_v3.mjs [--conjunto medicao|holdout]
 */
import fs from "node:fs";
import path from "node:path";
import {
  FERRAMENTAS, RAIZ, SCRATCH_V2, addr, executar, garantir, gravarEvidencia, linha, sha256Arquivo, presente, verificarProcedencia, jsonDoStdout,
} from "./ferramentas.mjs";
import { adaptarA2 } from "./adapt_a_v2.mjs";

const DATA = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes");
const DIR_A = path.join(DATA, "a");
const DIR_HO = path.join(DATA, "a-holdout");
const RESP = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
const GABARITO = "isa-oraculo-v2";
export const CONTRATO_V3 = "EXTENSOES-D v3-A";
const div = (campo, esperado, medido) => ({ campo, esperado, medido: medido === undefined ? null : medido });

export function avaliarSegmentos({ chave, conjunto, truthPath, imgPath }) {
  const f = FERRAMENTAS[chave];
  const t = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const img = fs.readFileSync(imgPath);
  if (sha256Arquivo(imgPath) !== t.imaxe.sha256) throw new Error(`R1: ${path.basename(imgPath)} difire do pin do gabarito`);
  void img;
  const rel = path.relative(RAIZ, imgPath);
  const linhas = [];
  const comum = (o) => ({ frente: "A", sha_frente: f.sha, gabarito: GABARITO, contrato: CONTRATO_V3, ...o });
  const corre = (caso, declarar) => {
    const args = ["construir-cadea", "--imaxe", rel, "--rom-size", `0x${t.imaxe.rom_size.toString(16).toUpperCase()}`, "--carga-sitio", addr(caso.carga_sitio),
      ...(declarar ? ["--chamada-sitio", addr(declarar)] : []), "--ventanxa", String(caso.janela), "--rutina-lonxitude", String(t.rutina_lonxitude),
      "--limite-max-saida", "65536", "--limite-orzamento", "4000000"];
    const r = executar(f.bin, args.map((a) => a), { cwd: RAIZ, timeout: 60_000 });
    return { r, args, j: jsonDoStdout(r) };
  };
  const julgar = (caso, esp, declarar, { r, args, j }, sufixo) => {
    const divs = [];
    if (r.rc !== esp.rc) divs.push(div("rc", esp.rc, r.rc));
    if (!j) divs.push(div("cadea", "JSON", "ausente"));
    else {
      if (j.confianza !== esp.confianza) divs.push(div("confianza", esp.confianza, j.confianza));
      const lim = (j.limitacions ?? []).join(" | ");
      for (const c of esp.contem ?? []) if (!lim.includes(c)) divs.push(div("limitacions contem", c, lim.slice(0, 160)));
      for (const c of esp.nao_contem ?? []) if (lim.includes(c)) divs.push(div("limitacions nao contem", c, lim.slice(0, 160)));
      const prom = esp.chamada ?? (declarar !== undefined);
      const chamadaOk = prom ? j.chamada_sitio !== null && Number.parseInt(j.chamada_sitio, 16) === caso.chamada_sitio : j.chamada_sitio === null;
      if (!chamadaOk) divs.push(div("chamada_sitio", prom ? addr(caso.chamada_sitio) : null, j.chamada_sitio));
      if (j.saida_sha256 !== undefined && j.saida_sha256 !== null && j.saida_sha256 !== t.fluxo.plain_sha256) divs.push(div("saida_sha256", t.fluxo.plain_sha256, j.saida_sha256));
    }
    linhas.push(linha(comum({
      fila: `${caso.id}${sufixo}`, capacidade: sufixo === "" ? "SEGv-auto" : "SEGv-declarado", eixo: "segmento", nivel: "vinculo-estrutural", comando: `rex-chain ${args.join(" ")}`, rc: r.rc,
      rc_esperado: esp.rc, esperados: esp, medidos: j ? { confianza: j.confianza, chamada_sitio: j.chamada_sitio, limitacions: j.limitacions } : {},
      divergencias: divs, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      motivo: `bytes e sitios do instrumento (${caso.instrumento.carga} / ${caso.instrumento.chamada}); rótulos de limitación dos publicados por A`,
    })));
  };
  for (const caso of t.casos) {
    julgar(caso, caso.esperado.auto, undefined, corre(caso, null), "");
    if (caso.esperado.declarado) julgar(caso, caso.esperado.declarado, caso.chamada_sitio, corre(caso, caso.chamada_sitio), "-declarado");
  }
  const n = t.negativo;
  const caso0 = t.casos.find((c) => c.carga_sitio === n.carga_sitio);
  const rn = corre(caso0, n.chamada_declarada);
  const divs = [];
  if (rn.r.rc === 0) divs.push(div("rc", "≠ 0", 0));
  if (rn.j?.confianza === "vinculo-estrutural") divs.push(div("confianza", "non vinculo-estrutural", rn.j.confianza));
  linhas.push(linha(comum({
    fila: n.id, capacidade: "SEGv-neg", eixo: "declaracion", nivel: "vinculo-estrutural", comando: `rex-chain ${rn.args.join(" ")}`, rc: rn.r.rc, esperados: n.esperado,
    medidos: { rc: rn.r.rc, confianza: rn.j?.confianza ?? null, stderr: (rn.r.stderr || "").trim().slice(0, 160) }, divergencias: divs,
    categoria: divs.length ? "falha" : "nao-suportado", veredito: divs.length ? "FAIL" : "PASS", motivo: n.esperado.motivo,
  })));
  return { linhas, truth: t };
}

export function adaptarA3({ chave = "A_6ae4f02", conjunto = "medicao", respostasDir = RESP, truthSeg = null } = {}) {
  if (!presente(chave)) return { ausente: true, linhas: [] };
  const f = FERRAMENTAS[chave];
  const relabel = (l) => linha({ ...l, ...l.extras, contrato: CONTRATO_V3 });
  let linhas;
  let manifesto;
  if (conjunto === "medicao") {
    const pin = JSON.parse(fs.readFileSync(path.join(DIR_A, "pin-seg-v3.json"), "utf8"));
    if (!truthSeg) for (const [n, e] of Object.entries({ ...pin.arquivos, ...pin.verdade })) if (sha256Arquivo(path.join(DIR_A, n)) !== e.sha256) throw new Error(`pin pin-seg-v3.json: ${n} diverxe do hash versionado`);
    const base = adaptarA2({ chave, conjunto: "medicao", declararChamada: true });
    const sem = adaptarA2Sen({ chave });
    const seg = avaliarSegmentos({ chave, conjunto, truthPath: truthSeg ?? path.join(DIR_A, "dA-seg-v3-truth.json"), imgPath: path.join(DIR_A, "dA-seg-v3.bin") });
    linhas = [...base.linhas.map(relabel), ...seg.linhas, sem];
    manifesto = { ...base.manifesto, conjunto, pin_seg: { arquivo: "pin-seg-v3.json", sha256: sha256Arquivo(path.join(DIR_A, "pin-seg-v3.json")) } };
  } else if (conjunto === "holdout") {
    const pinS = JSON.parse(fs.readFileSync(path.join(DIR_HO, "pin-seg-holdout-v3.json"), "utf8"));
    const rs = path.join(respostasDir, "dA-seg-ho-v3-respostas.json");
    if (!fs.existsSync(rs)) throw new Error("pin pin-seg-holdout-v3.json: resposta reservada dA-seg-ho-v3-respostas.json ausente");
    if (sha256Arquivo(rs) !== pinS.respostas["dA-seg-ho-v3-respostas.json"].sha256) throw new Error("pin pin-seg-holdout-v3.json: dA-seg-ho-v3-respostas.json diverxe do SHA pinado (resposta alterada)");
    const base = adaptarA2({ chave, conjunto: "holdout", declararChamada: true, nomeImg: "dA-img-ho3-v2.bin", respostas: "dA-ho3-respostas.json", nomePinHoldout: "pin-holdout-a-v3.json" });
    const seg = avaliarSegmentos({ chave, conjunto, truthPath: rs, imgPath: path.join(DIR_HO, "dA-seg-ho-v3.bin") });
    linhas = [...base.linhas.map(relabel), ...seg.linhas];
    manifesto = { ...base.manifesto, conjunto, pin_seg: { arquivo: "pin-seg-holdout-v3.json", sha256: sha256Arquivo(path.join(DIR_HO, "pin-seg-holdout-v3.json")) } };
  } else throw new Error(`conxunto descoñecido: ${conjunto}`);
  manifesto = { ...manifesto, frente: "A", sha_frente: f.sha, gabarito: GABARITO, contrato: CONTRATO_V3, procedencia: verificarProcedencia(chave) };
  return { ausente: false, linhas, manifesto };
}

/** Control (non puntúa): a imaxe v2 de D SEN declarar a chamada — contrato anterior. */
function adaptarA2Sen({ chave }) {
  const f = FERRAMENTAS[chave];
  const truth = JSON.parse(fs.readFileSync(path.join(DIR_A, "dA-truth-v2.json"), "utf8"));
  const img = path.relative(RAIZ, path.join(DIR_A, "dA-img-v2.bin"));
  const args = ["construir-cadea", "--imaxe", img, "--rom-size", "0x20000", "--carga-sitio", addr(truth.ka3v.carga_sitio), "--ventanxa", "16", "--rutina-lonxitude", "32", "--limite-max-saida", "65536", "--limite-orzamento", "4000000"];
  garantir(SCRATCH_V2);
  const r = executar(f.bin, args, { cwd: RAIZ, timeout: 60_000 });
  const j = jsonDoStdout(r);
  return linha({
    frente: "A", sha_frente: f.sha, fila: "CONTROLE-V2-SEM-DECLARAR", capacidade: "audit", eixo: "contrato-anterior", comando: `rex-chain ${args.join(" ")}`, rc: r.rc,
    categoria: "aplicavel", veredito: "CONTROLADO", pontua: false, gabarito: GABARITO, contrato: CONTRATO_V3,
    esperados: { nota: "no contrato v2 (bd40e92) a xanela de 16 B promovía o par; desde 6ae4f02 non (RESPOSTA-D-A §5/§7)" },
    medidos: { confianza: j?.confianza ?? null, chamada_sitio: j?.chamada_sitio ?? null, limitacions: j?.limitacions ?? null },
    motivo: "cambio de contrato de A, non regresión: a expectativa v2 de emparellamento automático entre `nop` está superada",
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--conjunto");
  const conjunto = i >= 0 ? process.argv[i + 1] : "medicao";
  const r = adaptarA3({ conjunto });
  if (r.ausente) { console.log("[A v3] ferramenta ausente"); process.exitCode = 3; }
  else {
    const d = gravarEvidencia(conjunto === "holdout" ? "A-6ae4f02-holdout-v3.jsonl" : "A-6ae4f02-v3.jsonl", r.linhas, r.manifesto);
    const por = {};
    for (const l of r.linhas) { const k = `${l.pontua === false ? "(np) " : ""}${l.veredito}`; por[k] = (por[k] ?? 0) + 1; }
    console.log(`[A v3 ${conjunto}] ${d.linhas} linhas → ${d.arquivo} (sha ${d.sha256.slice(0, 12)}…) ${JSON.stringify(por)}`);
    for (const l of r.linhas) if (l.veredito !== "PASS" && l.pontua !== false) console.log(`  ${String(l.fila).padEnd(30)} ${l.veredito.padEnd(8)} ${JSON.stringify(l.divergencias).slice(0, 220)}`);
  }
}
