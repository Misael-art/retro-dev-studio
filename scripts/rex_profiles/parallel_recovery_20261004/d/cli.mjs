#!/usr/bin/env node
/**
 * CLI reproduzivel da barra D (frente de avaliacao da recuperacao paralela
 * 2026-10-04). Subcomandos:
 *   author dev-1                       gera o fixture publico historico (v1)
 *   author dev-2                       gera o mesmo plan co xerador corrixido (R16)
 *   author ho-1 --seed-from <arquivo>  gera o conjunto reservado FORA da arvore
 *   score --truth <json> --export <json> [--out-dir <dir>]
 *   selftest                           matriz de mutacao + denominadores + kosinski
 *   verify-kosinski                    cruza streams kosinski com kos_mirror.py
 *   check-seal                         confere SHA-256 dos artefatos selados
 *   byor-inventory --root <dir>        inventario somente-leitura de metadados
 * Sem dependencias novas: node puro + python3 ja presente no host.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { authorSet } from "./bench_author.mjs";
import { REGION_HEADER_LEN, STREAM_DECODERS, CODEC, makeRng, sha256 } from "./lib_bench.mjs";
import { MUTATIONS, degenerateCases, mutationCase } from "./mutations.mjs";
import { deriveIdealExport, renderMarkdown, scoreExport } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const DATA_DIR = path.join(REPO, "data/rex_profiles/parallel_recovery_20261004/d");
const DEV_DIR = path.join(DATA_DIR, "dev");
const DEV_V2_DIR = path.join(DATA_DIR, "dev-v2");
const HO_PIN_DIR = path.join(DATA_DIR, "ho-1");
const HELDOUT_DEFAULT = path.join(process.env.HOME ?? "/tmp", "rds-scratch/rex-parallel-d-heldout");
const KOS_MIRROR = path.join(REPO, "scripts/rex_profiles/codecs/kosinski/kos_mirror.py");
const ORACULO_RNG = path.join(HERE, "oraculo_rng.py");

const DEV_SEED = "rex-parallel-d-20261004/dev-1/v1";
const DEV_SEED_V2 = "rex-parallel-d-20261004/dev-1/v2";

const frozen = {
  "dev-1": { D1: 9, D2: 6, D3: 6, D4: 2, D5: 2, D6: 9, D7: 10, N1: 3, N2: 6 },
  "ho-1": { D1: 12, D2: 8, D3: 8, D4: 3, D5: 3, D6: 13, D7: 14, N1: 4, N2: 9 },
};

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};

function writeIfChanged(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = typeof data === "string" ? data : Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + "\n";
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), Buffer.from(buf)) === 0) return false;
  fs.writeFileSync(file, buf);
  return true;
}

// ---------- author ----------

// Conxuntos que D autoriza e sela dentro da árbore. `dev-1` é o corpus medido
// nas roldas 1–2: o seu xerador era dexenerado (regra R16) e queda conxelado
// como está, porque as súas 225 filas de evidencia pinan eses bytes. `dev-2` é
// o mesmo plan co xerador corrixido — entropía real, pins propios.
const CONJUNTOS = {
  "dev-1": { dir: DEV_DIR, set: "dev-1", seed: DEV_SEED, xerador: "v1" },
  "dev-2": { dir: DEV_V2_DIR, set: "dev-1", seed: DEV_SEED_V2, xerador: "v2" },
};

function cmdAuthor() {
  const set = args[1];
  const c = CONJUNTOS[set];
  if (c) {
    const { image, truth } = authorSet(c.set, c.seed, { xerador: c.xerador });
    writeIfChanged(path.join(c.dir, "fixture.bin"), image);
    writeIfChanged(path.join(c.dir, "ground-truth.json"), JSON.stringify(truth, null, 2) + "\n");
    const seal = {
      set: c.set,
      seed: c.seed,
      seed_sha256: truth.seed_sha256,
      fixture_sha256: truth.fixture_sha256,
      fixture_len: truth.fixture_len,
      denominators: frozen[c.set],
    };
    // O selo de `dev-1` xa está publicado e a rolda 2 cítao: non se reescribe.
    // Os conxuntos novos declaram o xerador que usa (R16).
    if (c.xerador !== "v1") {
      seal.conxunto = set;
      seal.xerador = c.xerador;
    }
    writeIfChanged(path.join(c.dir, "seal.json"), seal);
    process.stdout.write(
      `${set}: fixture ${truth.fixture_sha256} (${truth.fixture_len} bytes, xerador ${c.xerador}) em ${c.dir}\n`,
    );
    return 0;
  }
  if (set === "ho-1") {
    const seedFile = flag("seed-from");
    if (!seedFile || !fs.existsSync(seedFile)) {
      process.stderr.write("ho-1 exige --seed-from <arquivo> fora da arvore versionada\n");
      return 2;
    }
    const seed = fs.readFileSync(seedFile, "utf8").trim();
    const outDir = flag("out", path.join(HELDOUT_DEFAULT, "ho-1"));
    const { image, truth } = authorSet("ho-1", seed);
    writeIfChanged(path.join(outDir, "fixture.bin"), image);
    writeIfChanged(path.join(outDir, "ground-truth.json"), JSON.stringify(truth, null, 2) + "\n");
    // dentro do repo entra SOMENTE o pin de SHA (nada de respostas)
    writeIfChanged(
      path.join(HO_PIN_DIR, "pin.json"),
      JSON.stringify(
        {
          set: "ho-1",
          fixture_sha256: truth.fixture_sha256,
          fixture_len: truth.fixture_len,
          denominators: frozen["ho-1"],
          answers: "fora da arvore; unseal somente apos a medicao",
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(
      `ho-1: respostas em ${outDir} (NAO commitar); pin publico em ${HO_PIN_DIR}/pin.json\n`,
    );
    return 0;
  }
  process.stderr.write(`conjunto desconhecido: ${set}\n`);
  return 2;
}

// ---------- score ----------

function cmdScore() {
  const truthPath = flag("truth");
  const expPath = flag("export");
  if (!truthPath || !expPath) {
    process.stderr.write("score exige --truth <json> e --export <json>\n");
    return 2;
  }
  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const raw = fs.readFileSync(expPath);
  const exp = JSON.parse(raw.toString("utf8"));
  const pinned = flag("pinned-fixture", truth.fixture_sha256);
  const result = scoreExport(truth, exp, { pinned });
  result.export_artifact_sha256 = sha256(raw);
  const md = renderMarkdown(result);
  const outDir = flag("out-dir", path.join(DATA_DIR, "medicoes"));
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${result.set}-${result.producer?.front ?? "x"}-${result.producer?.tool ?? "x"}`.replace(/[^A-Za-z0-9._-]/g, "_");
  fs.writeFileSync(path.join(outDir, `${base}.md`), md);
  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(md + `\nevidencia: ${path.join(outDir, base + ".md")}\n`);
  return result.status === "PASS" ? 0 : 1;
}

// ---------- selftest ----------

function check(out, ok, label, extra) {
  out.push(`${ok ? "OK  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) out.hardFail = true;
  return ok;
}

function cmdSelftest() {
  const out = [];
  out.hardFail = false;

  // 1. determinismo
  const a = authorSet("dev-1", DEV_SEED);
  const b = authorSet("dev-1", DEV_SEED);
  check(out, a.truth.fixture_sha256 === b.truth.fixture_sha256, "determinismo dev-1", a.truth.fixture_sha256);
  const h1 = authorSet("ho-1", "seed-de-teste-nao-reservado");
  const h2 = authorSet("ho-1", "seed-de-teste-nao-reservado");
  check(out, h1.truth.fixture_sha256 === h2.truth.fixture_sha256, "determinismo ho-1 (seed de teste)");

  // 2. denominadores congelados × runner
  for (const [set, truth] of [["dev-1", a.truth], ["ho-1", h1.truth]]) {
    const ideal = deriveIdealExport(truth);
    const res = scoreExport(truth, ideal);
    for (const [d, want] of Object.entries(frozen[set])) {
      const got = res.dimensions[d].denominator;
      check(out, got === want, `${set} ${d} denominador`, `esperado ${want}, obtido ${got}`);
    }
    check(out, res.status === "PASS", `${set} export ideal PASS`, res.reason);
  }

  // 3. round-trip interno (sanidade; NAO e prova — mesma linha de evidencia)
  let rt = 0;
  for (const r of a.truth.regions.filter((x) => x.class === "stream")) {
    const regionBytes = a.image.subarray(r.byte_addr + REGION_HEADER_LEN, r.byte_addr + REGION_HEADER_LEN + r.payload_len);
    const decoded = STREAM_DECODERS[CODEC[r.codec]](regionBytes, r.raw_len);
    const ok = Buffer.from(decoded).length === r.output.byte_len && sha256(Buffer.from(decoded)) === r.output.sha256;
    rt += check(out, ok, `round-trip interno ${r.id} (${r.codec})`) ? 1 : 0;
  }

  // 4. matriz de mutacao
  const truth = a.truth;
  const baseIdeal = scoreExport(truth, deriveIdealExport(truth));
  const expectations = {
    M1: (r) => ["D1", "D2", "D3", "D7"].every((d) => r.dimensions[d].verdict === "FAIL"),
    M2: (r) => r.dimensions.D6.verdict === "FAIL" && r.dimensions.N2.false_links > 0,
    M3: (r) => r.dimensions.D2.verdict === "FAIL" && r.dimensions.D2.not_found >= 1 && r.dimensions.D7.verdict === "FAIL",
    M4: (r) => r.dimensions.D4.verdict === "FAIL" && r.dimensions.D5.verdict === "FAIL",
    M5: (r) => r.dimensions.N1.false_links > 0 && r.dimensions.D7.correct <= baseIdeal.dimensions.D7.correct,
    M6: (r) => r.dimensions.D7.unknowns >= 1 && r.dimensions.D7.verdict === "FAIL",
  };
  for (const m of MUTATIONS) {
    const mc = mutationCase(m, truth, { front: "d", tool: "mutacao" });
    const r = scoreExport(truth, mc.export);
    check(out, r.status === "FAIL", `${m.id} ${m.name} reprovado`, `status ${r.status}`);
    check(out, expectations[m.id](r), `${m.id} atinge dimensoes esperadas`, JSON.stringify(m.esperado));
  }

  // 5. casos degenerados
  const deg = degenerateCases(truth, { front: "d", tool: "mutacao" });
  const degExpect = {
    X1: (r) =>
      r.status === "FAIL" &&
      Object.values(r.dimensions).every((d) => d.verdict === "FAIL" && d.coverage === 0 && d.not_found === d.denominator),
    X2: (r) => r.dimensions.D4.verdict === "INCONCLUSIVE" && r.dimensions.D4.not_found === r.dimensions.D4.denominator,
    X3: (r) => r.dimensions.D3.verdict === "INCONCLUSIVE" && r.dimensions.D5.verdict === "INCONCLUSIVE",
    X4: (r) => r.status === "INCONCLUSIVE" && /SHA/.test(r.reason),
    X5: (r) =>
      ["D2", "D3", "D4", "D5", "D6"].every((d) => r.dimensions[d].verdict === "INCONCLUSIVE") &&
      r.dimensions.D1.verdict === "PASS" &&
      r.dimensions.D7.verdict === "FAIL",
  };
  for (const c of deg) {
    const r = scoreExport(truth, c.export);
    check(out, degExpect[c.id](r), `${c.id} ${c.name} tratamento correto`, `status ${r.status}`);
  }

  // 6. kosinski contra instrumento externo (kos_mirror.py, familia B)
  const kos = verifyKosinski(out);

  // 7. entropia contra oraculo externo (R16): mesma semente, outro backend
  //    aritmetico (Python, inteiros arbitrarios)
  const ent = verifyEntropia(out);

  out.push("");
  out.push(`resumo: round-trips internos ${rt}; kosinski×espelho ${kos}; entropia×oraculo ${ent}`);
  out.push("Nota metodologica: round-trip interno usa a MESMA linha de evidencia (autoria) e nao conta como prova.");
  out.push(kos === "ok" ? "Kosinski foi cruzado com instrumento de outra linha (espelho mdcomp)." : "Kosinski NAO confirmado por instrumento externo: dimensao permanece nao medida.");
  out.push(ent === "ok" ? "O xerador v2 foi cruzado co oraculo externo (R16)." : "O xerador v2 NON confirmado polo oraculo externo: a entropia das fixtures queda sen medir.");
  const text = out.join("\n") + "\n";
  process.stdout.write(text);
  fs.mkdirSync(path.join(DATA_DIR, "selftest"), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "selftest", "latest.txt"), text);
  return out.hardFail || kos === "fail" || ent === "fail" ? 1 : 0;
}

function verifyEntropia(out) {
  if (!fs.existsSync(ORACULO_RNG)) {
    check(out, false, "entropia × oraculo", `instrumento ausente: ${ORACULO_RNG}`);
    return "fail";
  }
  const sementes = [`${DEV_SEED_V2}::dev-1`, "seed-de-teste-nao-reservado::ho-1"];
  const r = spawnSync("python3", [ORACULO_RNG, JSON.stringify(sementes), "24"], { encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0) {
    check(out, false, "entropia × oraculo", `oraculo fallou: ${String(r.stderr).slice(0, 160)}`);
    return "fail";
  }
  let j;
  try {
    j = JSON.parse(r.stdout);
  } catch {
    check(out, false, "entropia × oraculo", "saida do oraculo non se interpretou");
    return "fail";
  }
  let allOk = true;
  for (const s of sementes) {
    const esperado = j[s];
    const gen = makeRng(s);
    const medido = Array.from({ length: 24 }, () => gen());
    const ok = Array.isArray(esperado) && esperado.length === 24 && esperado.join(",") === medido.join(",");
    check(
      out,
      ok,
      `entropia ${s} × oraculo (R16)`,
      ok ? `24 valores confirmados, ${new Set(medido).size} distintos` : `esperado ${esperado}, obtido ${medido}`,
    );
    if (!ok) allOk = false;
  }
  return allOk ? "ok" : "fail";
}

function verifyKosinski(out) {
  if (!fs.existsSync(KOS_MIRROR)) {
    if (out) check(out, false, "kosinski×espelho", `instrumento ausente: ${KOS_MIRROR}`);
    return "fail";
  }
  const { image, truth } = authorSet("dev-1", DEV_SEED);
  const kos = truth.regions.filter((r) => r.class === "stream" && r.codec === "kosinski");
  let allOk = true;
  for (const r of kos) {
    const payload = image.subarray(r.byte_addr + REGION_HEADER_LEN, r.byte_addr + REGION_HEADER_LEN + r.payload_len);
    const py = `
import sys, hashlib, json
sys.path.insert(0, ${JSON.stringify(path.dirname(KOS_MIRROR))})
from kos_mirror import mirror_decode
st = bytes.fromhex(${JSON.stringify(Buffer.from(payload).toString("hex"))})
out, used = mirror_decode(st, strict=True)
print(json.dumps({"ok": out is not None and not isinstance(out, str),
                  "sha": hashlib.sha256(bytes(out)).hexdigest() if not isinstance(out, str) else out,
                  "len": len(out) if not isinstance(out, str) else -1,
                  "consumed": used, "stream_len": ${payload.length}}))
`;
    const p = spawnSync("python3", ["-c", py], { encoding: "utf8", timeout: 60_000 });
    if (p.status !== 0) {
      check(out ?? { push() {} }, false, `kosinski ${r.id} × espelho`, `python falhou: ${p.stderr.trim().slice(0, 200)}`);
      allOk = false;
      continue;
    }
    const j = JSON.parse(p.stdout.trim().split("\n").at(-1));
    const ok = j.ok && j.sha === r.output.sha256 && j.len === r.output.byte_len;
    check(
      out ?? { push() {} },
      ok,
      `kosinski ${r.id} × espelho (linha B)`,
      ok ? `sha ${j.sha.slice(0, 16)}… confirmado` : `esperado ${r.output.sha256.slice(0, 16)}…, obtido ${j.sha}`,
    );
    if (!ok) allOk = false;
  }
  return allOk ? "ok" : "fail";
}

// ---------- check-seal ----------

function cmdCheckSeal() {
  const problems = [];
  const conferidos = [];
  for (const [nome, c] of Object.entries(CONJUNTOS)) {
    const seloPath = path.join(c.dir, "seal.json");
    if (!fs.existsSync(seloPath)) {
      problems.push(`${nome}: falta ${seloPath}`);
      continue;
    }
    const selo = JSON.parse(fs.readFileSync(seloPath, "utf8"));
    const bin = fs.readFileSync(path.join(c.dir, "fixture.bin"));
    const sha = createHash("sha256").update(bin).digest("hex");
    if (sha !== selo.fixture_sha256) problems.push(`${nome} fixture: ${sha} != selado ${selo.fixture_sha256}`);
    if (bin.length !== selo.fixture_len) problems.push(`${nome} fixture: comprimento ${bin.length} != selado ${selo.fixture_len}`);
    // re-autoría: o selo non é un hash solto, ten de ser reproducíbel co xerador
    // que declara (R16)
    const { image, truth } = authorSet(c.set, selo.seed, { xerador: selo.xerador ?? "v1" });
    if (!image.equals(bin)) problems.push(`${nome}: re-autoría co xerador ${selo.xerador ?? "v1"} non dá os bytes selados`);
    const truthDisk = fs.readFileSync(path.join(c.dir, "ground-truth.json"));
    if (sha256(Buffer.from(JSON.stringify(truth, null, 2) + "\n")) !== sha256(truthDisk)) {
      problems.push(`${nome}: gabarito en disco ≠ gabarito re-autorado`);
    }
    for (const [d, want] of Object.entries(selo.denominators)) {
      const got = scoreExport(truth, deriveIdealExport(truth)).dimensions[d].denominator;
      if (got !== want) problems.push(`${nome} ${d}: runner ${got} != selado ${want}`);
      const congelado = frozen[c.set][d];
      if (congelado !== want) problems.push(`${nome} ${d}: selo ${want} != plan congelado ${congelado}`);
    }
    conferidos.push(`${nome} ${selo.fixture_sha256} (xerador ${selo.xerador ?? "v1"})`);
  }
  const pinPath = path.join(HO_PIN_DIR, "pin.json");
  if (fs.existsSync(pinPath)) {
    const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));
    for (const [d, want] of Object.entries(pin.denominators)) {
      if (frozen["ho-1"][d] !== want) problems.push(`ho-1 ${d}: pin ${want} != congelado ${frozen["ho-1"][d]}`);
    }
    if (fs.existsSync(path.join(DATA_DIR, "ho-1", "ground-truth.json"))) {
      problems.push("ho-1: gabarito presente na arvore versionada ANTES do unseal — violacao de reserva");
    }
  }
  if (problems.length) {
    process.stderr.write(problems.join("\n") + "\n");
    return 1;
  }
  process.stdout.write(`selos conferem: ${conferidos.join(" · ")}\n`);
  return 0;
}

// ---------- byor inventory ----------

function cmdByor() {
  const roots = (flag("root") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!roots.length || roots.some((r0) => !fs.existsSync(r0))) {
    process.stderr.write("byor-inventory exige --root <dir[,dir…]> existentes; a arvore NUNCA e modificada\n");
    return 2;
  }
  const exts = new Set([".bin", ".gen", ".smd", ".md", ".zip", ".7z", ".gz", ".nes", ".sfc", ".smc", ".fig"]);
  const files = [];
  const walk = (dir, depth) => {
    if (depth > 4 || files.length >= 2000) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && exts.has(path.extname(p).toLowerCase())) files.push(p);
    }
  };
  for (const r0 of roots) walk(r0, 0);
  const forRoot = (p) => roots.find((r0) => p.startsWith(r0 + "/")) ?? "";
  const zipMembers = (p) => {
    const py = `
import zipfile, json
try:
    with zipfile.ZipFile(${JSON.stringify(p)}) as z:
        print(json.dumps([{"name": i.filename, "size": i.file_size, "crc32": format(i.CRC, "08x")}
                          for i in z.infolist()][:50]))
except Exception as e:
    print(json.dumps({"error": str(e)[:200]}))
`;
    const r = spawnSync("python3", ["-c", py], { encoding: "utf8", timeout: 30_000 });
    if (r.status !== 0) return { error: "zip nao lido (python falhou; container permanece pinado por head_sha256)" };
    try {
      return JSON.parse(r.stdout.trim().split("\n").at(-1));
    } catch {
      return { error: "saida do leitor zip nao interpretada" };
    }
  };
  const rows = files.map((p) => {
    const st = fs.statSync(p);
    const head = Buffer.alloc(64 * 1024);
    const fd = fs.openSync(p, "r");
    const rd = fs.readSync(fd, head, 0, Math.min(head.length, st.size), 0);
    fs.closeSync(fd);
    const slice = head.subarray(0, rd);
    const r0 = forRoot(p);
    const ext = path.extname(p).toLowerCase();
    const row = {
      path_rel: `${path.basename(r0)}/${path.relative(r0, p)}`,
      size_bytes: st.size,
      mtime_iso: st.mtime.toISOString(),
      head_sha256: createHash("sha256").update(slice).digest("hex"),
      head_len: rd,
      hash_scope: st.size > rd ? "primeiros 64 KiB (arquivo grande; inteiro nao medido)" : "arquivo inteiro",
      ext,
    };
    if (ext === ".zip") row.zip_members = zipMembers(p);
    return row;
  });
  rows.sort((a, b) => (a.path_rel < b.path_rel ? -1 : a.path_rel > b.path_rel ? 1 : 0));
  const inv = {
    roots,
    modo: "somente-leitura; nenhum byte do corpus foi modificado ou copiado para a arvore",
    politica: "metadados pinados apenas; conteudo NUNCA promovido a verdade de ground truth; nomes nao viram hipoteses de verdade",
    arquivos: rows,
  };
  const dest = path.join(DATA_DIR, "byor");
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "inventory.json"), JSON.stringify(inv, null, 2) + "\n");
  process.stdout.write(`byor: ${rows.length} arquivos inventariados em ${dest}/inventory.json (somente metadados)\n`);
  return 0;
}

// ---------- dispatch ----------

let code = 2;
switch (cmd) {
  case "author":
    code = cmdAuthor();
    break;
  case "score":
    code = cmdScore();
    break;
  case "selftest":
    code = cmdSelftest();
    break;
  case "verify-kosinski": {
    const out = [];
    const r = verifyKosinski(out);
    process.stdout.write(out.join("\n") + `\nresultado: ${r}\n`);
    code = r === "ok" ? 0 : 1;
    break;
  }
  case "check-seal":
    code = cmdCheckSeal();
    break;
  case "byor-inventory":
    code = cmdByor();
    break;
  default:
    process.stderr.write(
      "uso: node cli.mjs <author|score|selftest|verify-kosinski|check-seal|byor-inventory> [flags]\n",
    );
}
process.exit(code);
