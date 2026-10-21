#!/usr/bin/env node
// Manifesto verificável da missão Studio Gráfico Integrado (QA, fora do runtime do app).
//
//   node scripts/qa/studio-grafico-manifest.mjs build --runs-prefix cert2- --app <binário> --out <manifest.json>
//   node scripts/qa/studio-grafico-manifest.mjs verify <manifest.json>
//
// `build` registra SHA-256 COMPLETOS e caminhos absolutos de: binário testado, commit-fonte, bundle do frontend, Xvfb,
// entradas BYOR (Ken, Sonic 1), cada corrida (run.json, run.log, relatório, artefatos citados no relatório) e relatórios
// de certificação. `verify` relê tudo e falha se algum arquivo sumiu ou mudou. Não copia ROMs nem capturas para o Git.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const scratch = "/home/misael/rds-scratch/studio-grafico-integrado-20261019";
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const entry = (p) => (existsSync(p) && statSync(p).isFile() ? { path: p, sha256: sha(p), bytes: statSync(p).size } : { path: p, missing: true });

function collectRun(dir) {
  const files = [];
  for (const name of ["run.json", "run.log", "stdout.txt"]) files.push(entry(path.join(dir, name)));
  const evidence = path.join(dir, "evidence");
  const reports = existsSync(evidence) ? readdirSync(evidence).filter((f) => f.endsWith("report.json")).map((f) => path.join(evidence, f)) : [];
  let report = null;
  for (const r of reports) {
    files.push(entry(r));
    report = JSON.parse(readFileSync(r, "utf8"));
    for (const a of report.artifacts ?? []) if (typeof a.path === "string") files.push(entry(a.path));
  }
  // Regressões que gravam relatório em target-test/validation: o caminho citado no run.log da própria corrida.
  const log = path.join(dir, "run.log");
  const cited = existsSync(log) ? [...new Set(readFileSync(log, "utf8").match(/\/[^\s"']*target-test\/validation\/[^\s"']*report\.json/g) ?? [])] : [];
  for (const r of cited) {
    files.push(entry(r));
    if (!report && existsSync(r)) report = JSON.parse(readFileSync(r, "utf8"));
  }
  const ui = path.join(dir, "ui", "ui-report.json");
  if (existsSync(ui)) files.push(entry(ui));
  const oracle = path.join(dir, "oracle");
  if (existsSync(oracle)) for (const f of readdirSync(oracle).filter((f) => f.endsWith(".json")).sort()) files.push(entry(path.join(oracle, f)));
  const meta = existsSync(path.join(dir, "run.json")) ? JSON.parse(readFileSync(path.join(dir, "run.json"), "utf8")) : {};
  return {
    dir,
    exit_code: meta.exit_code ?? null,
    app_sha256: meta.app_sha256 ?? null,
    window: meta.window ?? null,
    all_pass: report?.allPass ?? null,
    steps: report?.steps?.map((s) => s.step) ?? null,
    files,
  };
}

function build(args) {
  const prefix = args[args.indexOf("--runs-prefix") + 1];
  const app = args[args.indexOf("--app") + 1];
  const out = args[args.indexOf("--out") + 1];
  const runsDir = path.join(scratch, "runs");
  const runs = {};
  // Vários prefixos separados por vírgula (rodada 4: corridas cert4- herdadas + r4i- novas); só diretórios.
  const prefixes = prefix.split(",");
  for (const name of readdirSync(runsDir).filter((n) => prefixes.some((p) => n.startsWith(p)) && statSync(path.join(runsDir, n)).isDirectory()).sort()) runs[name] = collectRun(path.join(runsDir, name));
  const ken = "/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8";
  const validation = path.join(repo, "src-tauri/target-test/validation");
  const certFiles = [
    ...["host-readiness.json", "upstream-validation-linux.json"].map((f) => entry(path.join(validation, f))),
    // Tentativas anteriores do host:certify ficam registradas: uma aprovação posterior não apaga a falha.
    ...readdirSync(runsDir).filter((n) => n.startsWith("host-certify-") || /^r[34]-.*\.log$/.test(n) || n === "build-014.log" || n === "build-016.log").sort().map((n) => entry(path.join(runsDir, n))),
  ];
  const manifest = {
    schema: "retrodev.studio_grafico_manifest/v2",
    maturity: "Experimental",
    generated_at: new Date().toISOString(),
    source: {
      repo,
      head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
      branch: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
      dirty: execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).trim().length > 0,
    },
    binary: entry(app),
    frontend_bundle: entry(path.join(repo, "dist/index.html")),
    qa_display: entry("/home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb"),
    inputs_byor: {
      ken8: ["ken8.def", "ken.sff", "ken.air", "ken1.act", "ken.cmd", "ken.cns", "ken.snd"].map((f) => entry(path.join(ken, f))),
      sonic1: entry("/home/misael/.retrodev/rex_corpus_c/members/Sonic the Hedgehog (USA, Europe).bin"),
    },
    runs,
    certification: certFiles,
    reproduction: [
      "Xvfb pinado: python3 -I scripts/qa/run-sonic-desktop-isolated.py --xvfb <Xvfb> --xvfb-sha256 <qa_display.sha256> --app <binary.path> --work <runs/cert2-ID> --log <runs/cert2-ID>/run.log --window <run.window> --scenario <studio-e1|studio-e2e5|studio-e4|studio-scene|studio-model|studio-e6|mugen-real|mugen-import|nodegraph-authoring> [--rom <sonic1>]",
      "env: RDS_MUGEN_REAL_SOURCE=<ken8> RDS_MUGEN_REAL_UI_OUTPUT=<run>/ui RDS_STUDIO_E1_OUTPUT=<run>/evidence; oráculo: RDS_E2E_KEEP_PROJECT=1",
      "backend Ken: (src-tauri) RDS_MUGEN_REAL_SOURCE=<ken8> RDS_MUGEN_REAL_OUTPUT=<run>/backend cargo test --lib mugen_real_pilot_build_and_capture -- --ignored",
      "oráculo: python3 -I scripts/verify-mugen-real.py --source <ken8> --backend <run>/backend --ui <run>/ui --output <run>/oracle",
      "host: TMPDIR=<fora de ~/.cache> npm run host:certify",
      "conferência: node scripts/qa/studio-grafico-manifest.mjs verify " + process.argv.slice(2).find((a) => a.endsWith(".json")) + "",
    ],
    note: "ROMs, cópias, capturas e projetos de teste ficam fora do Git (scratch/~/Documents); só metadados aqui.",
  };
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifesto: ${out} (${Object.keys(runs).length} corridas)`);
}

function verify(file) {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const problems = [];
  const check = (e) => {
    if (!e || e.missing) return;
    if (!existsSync(e.path)) problems.push(`ausente: ${e.path}`);
    else if (sha(e.path) !== e.sha256) problems.push(`mudou: ${e.path}`);
  };
  check(manifest.binary);
  check(manifest.frontend_bundle);
  check(manifest.qa_display);
  manifest.inputs_byor.ken8.forEach(check);
  check(manifest.inputs_byor.sonic1);
  for (const run of Object.values(manifest.runs)) run.files.forEach(check);
  manifest.certification.forEach(check);
  const missing = JSON.stringify(manifest).match(/"missing":true/g)?.length ?? 0;
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`OK: todos os arquivos conferem (${missing} entrada(s) já registradas como ausentes na geração).`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "build") build(rest);
else if (mode === "verify") verify(rest[0]);
else {
  console.error("uso: build --runs-prefix <p> --app <bin> --out <json> | verify <json>");
  process.exit(2);
}
