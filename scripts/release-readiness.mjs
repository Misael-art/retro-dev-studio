#!/usr/bin/env node
/**
 * release-readiness.mjs
 *
 * Agrega o estado operacional necessario para promover o RC a beta/producao
 * sem depender de memoria humana. Gera relatorios JSON + Markdown em
 * src-tauri/target-test/validation/.
 *
 * Uso:
 *   node scripts/release-readiness.mjs
 *   node scripts/release-readiness.mjs --run-baseline
 *   node scripts/release-readiness.mjs --run-build portable --run-upstream
 *   node scripts/release-readiness.mjs --automated-qa-json auto.json --human-qa-json human.json --candidate-app path
 *   node scripts/release-readiness.mjs --strict
 */

import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const CANONICAL_TARGET_DIR = path.join(repoRoot, "src-tauri", "target-test");
const VALIDATION_DIR = path.join(CANONICAL_TARGET_DIR, "validation");
const BUILD_REPORT_PATH = path.join(VALIDATION_DIR, "build-report.json");
const UPSTREAM_REPORT_PATH = path.join(VALIDATION_DIR, "upstream-validation.json");
const READINESS_JSON_PATH = path.join(VALIDATION_DIR, "release-readiness.json");
const READINESS_MD_PATH = path.join(VALIDATION_DIR, "release-readiness.md");
const APP_NAME = process.platform === "win32" ? "retro-dev-studio.exe" : "retro-dev-studio";
const DEBUG_EXE_PATH = path.join(CANONICAL_TARGET_DIR, "debug", APP_NAME);
const RELEASE_EXE_PATH = path.join(CANONICAL_TARGET_DIR, "release", APP_NAME);
const MSI_DIR = path.join(CANONICAL_TARGET_DIR, "release", "bundle", "msi");
const WEBDRIVER_PATH = path.join(
  repoRoot,
  "toolchains",
  "webdriver",
  "msedgedriver.exe"
);
const QA_DOC_PATH = path.join(repoRoot, "docs", "10_QA_ROTEIRO_RC.md");

function cargoBaselineGate(id, label, unixArgs, windowsArgs) {
  if (process.platform === "win32") {
    return {
      id,
      label,
      command: path.join("scripts", "run-cargo-msvc.cmd"),
      args: windowsArgs,
      cwd: repoRoot,
      useCargoTargetDir: false,
    };
  }

  return {
    id,
    label,
    command: "cargo",
    args: unixArgs,
    cwd: path.join(repoRoot, "src-tauri"),
    useCargoTargetDir: true,
  };
}

const BASELINE_GATES = [
  { id: "check_tree", label: "check:tree", command: npmCommand(), args: ["run", "check:tree"] },
  { id: "lint", label: "lint", command: npmCommand(), args: ["run", "lint"] },
  { id: "tsc", label: "tsc --noEmit", command: npxCommand(), args: ["tsc", "--noEmit"] },
  { id: "frontend_tests", label: "npm test", command: npmCommand(), args: ["test"] },
  cargoBaselineGate(
    "cargo_clippy",
    "cargo clippy",
    ["clippy", "--", "-D", "warnings"],
    ["clippy", "--manifest-path", ".\\src-tauri\\Cargo.toml", "--", "-D", "warnings"]
  ),
  cargoBaselineGate(
    "cargo_test",
    "cargo test --lib",
    ["test", "--lib", "--", "--nocapture", "--test-threads=1"],
    [
      "test",
      "--manifest-path",
      ".\\src-tauri\\Cargo.toml",
      "--lib",
      "--",
      "--nocapture",
      "--test-threads=1",
    ]
  ),
];

const QA_BLOCKS = [
  { id: "A", name: "Primeiro uso e onboarding" },
  { id: "B", name: "Edicao de cena e camadas" },
  { id: "C", name: "Colisao e pintura" },
  { id: "D", name: "Build e emulacao Mega Drive" },
  { id: "E", name: "Ferramentas e paineis" },
  { id: "F", name: "Persistencia e fechamento" },
  { id: "G", name: "Importacao SGDK e logica" },
  { id: "H", name: "Layout e navegacao" },
];

const EXPERIMENTAL_SURFACES = [
  "ArtStudio",
  "RetroFX",
  "Asset Extractor",
  "Reverse Explorer",
  "Memory Viewer",
  "Importacao MUGEN",
  "Importacao Godot 2D",
  "Importacao Ikemen GO",
];

const LOCAL_ONLY_STATUS_PATHS = new Set([
  ".claude/settings.local.json",
  "AGENTS.md",
  "docs/ESTUDO_FRONTEND_GUI_NAO_CANONICO.md",
]);

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function powershellCommand() {
  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

export function parseArgs(argv) {
  const options = {
    runBaseline: false,
    runUpstream: false,
    runDesktopE2E: false,
    runBuildMode: null,
    strict: false,
    automatedQaJson: null,
    humanQaJson: null,
    candidateApp: DEBUG_EXE_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-baseline") {
      options.runBaseline = true;
    } else if (arg === "--run-upstream") {
      options.runUpstream = true;
    } else if (arg === "--run-desktop-e2e") {
      options.runDesktopE2E = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--run-build") {
      options.runBuildMode = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--run-build=")) {
      options.runBuildMode = arg.slice("--run-build=".length);
    } else if (["--automated-qa-json", "--manual-qa-json"].includes(arg)) {
      // Legacy spelling was used for the automated qa-rc output. It must
      // never become human approval merely because its filename says manual.
      options.automatedQaJson = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--manual-qa-json=") || arg.startsWith("--automated-qa-json=")) {
      options.automatedQaJson = arg.slice(arg.indexOf("=") + 1);
    } else if (arg === "--human-qa-json") {
      options.humanQaJson = argv[++index] ?? null;
    } else if (arg.startsWith("--human-qa-json=")) {
      options.humanQaJson = arg.slice("--human-qa-json=".length);
    } else if (arg === "--candidate-app") {
      options.candidateApp = argv[++index] ?? null;
    } else if (arg.startsWith("--candidate-app=")) {
      options.candidateApp = arg.slice("--candidate-app=".length);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

function shouldAutoRunDesktopE2E(options) {
  return process.platform === "win32" && options.runBaseline && !options.runDesktopE2E;
}

function shouldAutoRunBuildDebug(options) {
  return process.platform === "win32" && options.runBaseline && !options.runBuildMode;
}

function shouldAutoRunUpstream(options) {
  return process.platform === "win32" && options.runBaseline && !options.runUpstream;
}

function createEmptyGateResult(gate) {
  return {
    id: gate.id,
    label: gate.label,
    command: `${gate.command} ${gate.args.join(" ")}`,
    status: "not_run",
    durationMs: 0,
    startedAt: null,
    finishedAt: null,
    cwd: gate.cwd ?? repoRoot,
  };
}

async function pathExists(candidatePath) {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "").trim();
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

async function findLatestMsi() {
  if (!(await pathExists(MSI_DIR))) {
    return null;
  }

  const entries = await readdir(MSI_DIR);
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.toLowerCase().endsWith(".msi"))
      .map(async (entry) => {
        const fullPath = path.join(MSI_DIR, entry);
        const metadata = await stat(fullPath);
        return { fullPath, metadata };
      })
  );

  candidates.sort((left, right) => right.metadata.mtimeMs - left.metadata.mtimeMs);
  return candidates[0]?.fullPath ?? null;
}

async function inspectFile(filePath) {
  if (!filePath || !(await pathExists(filePath))) {
    return {
      path: filePath,
      exists: false,
      sizeBytes: null,
      lastModifiedIso: null,
    };
  }

  const metadata = await stat(filePath);
  return {
    path: filePath,
    exists: true,
    sizeBytes: metadata.size,
    lastModifiedIso: metadata.mtime.toISOString(),
  };
}

function parseIsoDate(candidate) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFreshSince(candidateIso, referenceIso) {
  const candidate = parseIsoDate(candidateIso);
  const reference = parseIsoDate(referenceIso);
  if (candidate === null || reference === null) {
    return false;
  }

  return candidate >= reference;
}

function createSyntheticAuxiliaryFailure(label, command, error) {
  return {
    label,
    command,
    status: "failed",
    durationMs: 0,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error,
  };
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function spawnAndWait(command, args, options = {}) {
  return new Promise((resolve) => {
    const useCmdShim = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
    const child = spawn(useCmdShim ? "cmd.exe" : command, useCmdShim ? ["/d", "/s", "/c", command, ...args] : args, {
      cwd: repoRoot,
      shell: false,
      stdio: "inherit",
      env: process.env,
      ...options,
    });

    child.on("error", (error) => {
      resolve({ ok: false, exitCode: null, error: error.message });
    });

    child.on("exit", (code) => {
      resolve({ ok: code === 0, exitCode: code, error: null });
    });
  });
}

async function runGate(gate) {
  const startedAt = new Date();
  const env = { ...process.env };
  // Keep the target selected by the host launcher. No private shadow cache
  // and no implicit deletion of a shared target during a readiness check.

  const result = await spawnAndWait(gate.command, gate.args, {
    cwd: gate.cwd ?? repoRoot,
    env,
  });
  const finishedAt = new Date();

  return {
    id: gate.id,
    label: gate.label,
    command: formatCommand(gate.command, gate.args),
    status: result.ok ? "passed" : "failed",
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    exitCode: result.exitCode,
    error: result.error,
    cwd: gate.cwd ?? repoRoot,
  };
}

async function runAuxiliaryCommand(label, command, args, options = {}) {
  const startedAt = new Date();
  const result = await spawnAndWait(command, args, options);
  const finishedAt = new Date();

  return {
    label,
    command: formatCommand(command, args),
    status: result.ok ? "passed" : "failed",
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    exitCode: result.exitCode,
    error: result.error,
  };
}

async function gitOutput(args, options = {}) {
  const { trim = true } = options;
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: repoRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(trim ? stdout.trim() : stdout);
      } else {
        reject(new Error(stderr.trim() || `git ${args.join(" ")} failed`));
      }
    });
  });
}

async function collectGitState() {
  const [branchByRevParse, branchByShowCurrent, commit, status, trackingRef] = await Promise.all([
    gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]),
    gitOutput(["branch", "--show-current"]).catch(() => ""),
    gitOutput(["rev-parse", "HEAD"]),
    gitOutput(["status", "--porcelain"], { trim: false }),
    gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).catch(() => ""),
  ]);
  const branch = branchByShowCurrent || branchByRevParse || "HEAD";

  const dirtyEntries = status
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.slice(3).replaceAll("\\", "/");
      return {
        raw: line,
        path: normalized,
        localOnly: LOCAL_ONLY_STATUS_PATHS.has(normalized),
      };
    });

  const [trackingDivergence, originMainDivergence] = await Promise.all([
    trackingRef
      ? gitOutput(["rev-list", "--left-right", "--count", `${branch}...${trackingRef}`])
          .then(parseAheadBehindCounts)
          .catch(() => null)
      : Promise.resolve(null),
    gitOutput(["rev-list", "--left-right", "--count", `${branch}...origin/main`])
      .then(parseAheadBehindCounts)
      .catch(() => null),
  ]);

  return {
    branch,
    commit,
    trackingRef: trackingRef || null,
    trackingDivergence,
    originMainRef: "origin/main",
    originMainDivergence,
    dirtyEntries,
    dirtyTrackedEntries: dirtyEntries.filter((entry) => !entry.localOnly),
  };
}

export function parseAheadBehindCounts(raw) {
  const match = /^(\d+)\s+(\d+)$/.exec(String(raw ?? "").trim());
  if (!match) return null;
  const [ahead, behind] = match.slice(1).map(Number);
  return Number.isSafeInteger(ahead) && Number.isSafeInteger(behind) ? { ahead, behind } : null;
}

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

async function sameProductSource(repository, commit) {
  if (!repository || repository.dirty !== false || !COMMIT.test(repository.commit ?? "") || !COMMIT.test(commit ?? "")) return false;
  if (repository.commit === commit) return true;
  try {
    // Documentation-only follow-ups can identify the same product and harness.
    const changed = await gitOutput(["diff", "--name-only", repository.commit, commit, "--"]);
    return changed.split(/\r?\n/).filter(Boolean).every((file) =>
      file.startsWith("docs/") || ["README.md", "AGENTS.md", "CLAUDE.md"].includes(file));
  } catch { return false; }
}

export function validateQaPayload(payload, { kind, appSha256, sourceVerified = false, harnessSha256 } = {}) {
  const blocks = QA_BLOCKS.map((block) => ({ ...block, status: "pending", note: null }));
  const errors = [];
  const schema = kind === "human" ? "rds-qa-human/v1" : "rds-qa-automation/v1";
  if (!payload || payload.schema !== schema || payload.kind !== kind) errors.push("Schema/origem de QA ausente, desconhecido ou incompatível.");
  if (!SHA256.test(appSha256 ?? "") || payload?.candidate?.app_sha256 !== appSha256) errors.push("QA não identifica o candidato solicitado.");
  if (!sourceVerified) errors.push("Fonte da rodada ausente, modificada ou diferente do candidato atual.");
  if (parseIsoDate(payload?.generatedAt) === null || Date.parse(payload.generatedAt) > Date.now() + 60000) errors.push("Data da evidência inválida.");
  if (kind === "automated" && (payload?.scenario !== "qa-rc" || !SHA256.test(harnessSha256 ?? "") || payload.harness_sha256 !== harnessSha256)) {
    errors.push("Roteiro automatizado ausente ou diferente do roteiro atual.");
  }
  if (kind === "human" && (payload?.observer?.independent !== true || typeof payload?.observer?.id !== "string" || !payload.observer.id.trim()
      || payload?.observer?.method !== "interactive-session")) {
    errors.push("Aceite exige observador independente identificado e sessão interativa; automação não o substitui.");
  }
  if (errors.length === 0) {
    for (const block of blocks) {
      const observed = payload.blocks?.[block.id];
      if (observed && ["passed", "failed", "pending"].includes(observed.status)) {
        block.note = typeof observed.note === "string" ? observed.note : null;
        // Human acceptance needs an observation, not just a copied green flag.
        block.status = kind === "human" && !block.note?.trim() ? "pending" : observed.status;
      }
    }
  }
  return { kind, blocks, error: errors.length ? errors.join(" ") : null,
    candidate: payload?.candidate ?? null, repository: payload?.repository ?? null,
    observer: kind === "human" ? payload?.observer ?? null : undefined };
}

export async function loadQaStatus(file, context) {
  const source = file ? path.resolve(repoRoot, file) : null;
  const payload = source ? await readJsonIfExists(source) : null;
  const sourceVerified = await sameProductSource(payload?.repository, context.commit);
  return { source, ...validateQaPayload(payload, { ...context, sourceVerified }) };
}

export function classifyReadiness({
  gitState,
  gateResults,
  auxiliary,
  artifacts,
  buildReport,
  upstreamReport,
  manualQa,
  automatedQa,
}) {
  const blockers = [];
  const warnings = [];

  const failedBaseline = gateResults.filter((gate) => gate.status === "failed");
  const pendingBaseline = gateResults.filter((gate) => gate.status === "not_run");
  if (failedBaseline.length > 0) {
    blockers.push(
      `Baseline com falha: ${failedBaseline.map((gate) => gate.label).join(", ")}`
    );
  }
  if (pendingBaseline.length > 0) {
    blockers.push(
      `Baseline nao executada nesta rodada: ${pendingBaseline
        .map((gate) => gate.label)
        .join(", ")}`
    );
  }

  if (gitState.dirtyTrackedEntries.length > 0) {
    blockers.push(
      `Workspace com mudancas locais fora do report canonico: ${gitState.dirtyTrackedEntries
        .map((entry) => entry.path)
        .join(", ")}`
    );
  }
  if (gitState.changedDuringRun) blockers.push("Fonte mudou durante a rodada; reexecute a validação no candidato estável.");
  if (gitState.dirtyEntries.some((entry) => entry.localOnly)) {
    warnings.push(
      `Arquivos locais fora do Git canonico detectados: ${gitState.dirtyEntries
        .filter((entry) => entry.localOnly)
        .map((entry) => entry.path)
        .join(", ")}`
    );
  }

  if (!gitState.trackingRef || !gitState.trackingDivergence) {
    blockers.push("Upstream de acompanhamento ausente ou não verificável.");
  }
  if (gitState.trackingRef && gitState.trackingDivergence) {
    if (gitState.trackingDivergence.ahead > 0) {
      blockers.push(
        `Branch local ainda nao publicada integralmente: ${gitState.branch} esta ${gitState.trackingDivergence.ahead} commit(s) a frente de ${gitState.trackingRef}.`
      );
    }
    if (gitState.trackingDivergence.behind > 0) {
      blockers.push(
        `Branch local esta ${gitState.trackingDivergence.behind} commit(s) atras de ${gitState.trackingRef}.`
      );
    }
  }

  if (!gitState.originMainDivergence) {
    blockers.push("Base pública origin/main indisponível; divergência desconhecida. Confira a referência remota antes da promoção.");
  }
  if (gitState.originMainDivergence) {
    if (gitState.branch !== "main" && gitState.originMainDivergence.ahead > 0) {
      blockers.push(
        `Promocao para a trilha publica ainda pendente: ${gitState.branch} esta ${gitState.originMainDivergence.ahead} commit(s) a frente de origin/main.`
      );
    }
    if (gitState.originMainDivergence.behind > 0) {
      blockers.push(
        `${gitState.branch} esta ${gitState.originMainDivergence.behind} commit(s) atras de origin/main.`
      );
    }
  }

  if (!buildReport) {
    blockers.push("build-report.json ausente; o estado de artefatos nao esta consolidado.");
  }
  if (!artifacts.releaseExe.exists) {
    blockers.push("Executavel portable/release canonico ausente.");
  }
  if (!artifacts.msi.exists) {
    blockers.push("MSI canonico ausente.");
  }
  if (!artifacts.webdriver.exists) {
    warnings.push("msedgedriver.exe ausente; desktop E2E local nao pode ser reexecutado.");
  }

  if (!upstreamReport?.success) {
    blockers.push("Validacao upstream oficial nao comprovada no report atual.");
    const upstreamCodes = Array.isArray(upstreamReport?.blocking_status_codes)
      ? upstreamReport.blocking_status_codes
      : [];
    if (upstreamCodes.length > 0) {
      blockers.push(
        `Upstream report sinalizou status codes bloqueantes: ${upstreamCodes.join(", ")}`
      );
    }
  } else {
    const observationalCodes = Array.isArray(upstreamReport?.blocking_status_codes)
      ? upstreamReport.blocking_status_codes
      : [];
    if (observationalCodes.includes("host_wmi_unavailable")) {
      warnings.push(
        "Upstream verde com degradacao de host (WMI/CIM indisponivel); validar estabilidade do host antes de promover."
      );
    }
    const wrapperReports = Array.isArray(upstreamReport?.wrapper_reports)
      ? upstreamReport.wrapper_reports
      : [];
    if (wrapperReports.length > 0) {
      warnings.push(
        `Upstream wrapper reports: ${wrapperReports.join(" | ")}`
      );
    }
  }

  if (auxiliary.build?.status === "failed") {
    blockers.push("Build canonicamente solicitado nesta rodada falhou.");
  }
  if (auxiliary.build?.status === "passed") {
    const expectedMode = auxiliary.build.requestedMode;
    if (!expectedMode || !buildReport?.modes?.[expectedMode]) {
      blockers.push(
        `build-report.json nao registrou o modo '${expectedMode ?? "desconhecido"}' desta rodada.`
      );
    } else if (!isFreshSince(buildReport.generatedAt, auxiliary.build.startedAt)) {
      blockers.push("build-report.json nao foi atualizado nesta rodada de build.");
    }

    if (expectedMode === "debug") {
      if (!artifacts.debugExe.exists) {
        blockers.push("Executavel debug canonico ausente apos build:debug desta rodada.");
      } else if (!isFreshSince(artifacts.debugExe.lastModifiedIso, auxiliary.build.startedAt)) {
        blockers.push("Executavel debug canonico nao foi renovado na rodada atual de build.");
      }
    }
  }
  if (auxiliary.upstream?.status === "failed") {
    blockers.push("validate-upstream-windows falhou nesta rodada.");
  }
  if (auxiliary.upstream?.status === "passed") {
    if (!upstreamReport?.success) {
      blockers.push("validate-upstream-windows passou, mas upstream-validation.json nao ficou verde.");
    } else if (!isFreshSince(upstreamReport.generatedAt, auxiliary.upstream.startedAt)) {
      blockers.push("upstream-validation.json nao foi atualizado nesta rodada.");
    }
  }
  if (auxiliary.desktopE2E?.status === "failed") {
    blockers.push("Desktop E2E falhou nesta rodada.");
  }
  if (!auxiliary.desktopE2E) {
    warnings.push("Desktop E2E nao foi reexecutado nesta rodada pelo agregador.");
  }

  for (const [label, evidence] of [["automatizado", automatedQa], ["humano", manualQa]]) {
    if (evidence?.error) blockers.push(`QA ${label}: ${evidence.error}`);
    const pending = QA_BLOCKS.filter(({ id }) => !evidence?.blocks?.some((block) => block.id === id && block.status === "passed"));
    if (pending.length) blockers.push(`QA ${label} ainda pendente: ${pending.map((block) => block.id).join(", ")}`);
  }

  if (EXPERIMENTAL_SURFACES.length > 0) {
    warnings.push(
      `Superficies ainda marcadas como Experimental: ${EXPERIMENTAL_SURFACES.join(", ")}`
    );
  }

  return {
    readyForPromotion: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function toMarkdown(report) {
  const gateLines = report.gates.map(
    (gate) =>
      `- ${gate.label}: ${gate.status}${gate.durationMs ? ` (${gate.durationMs} ms)` : ""}`
  );
  const auxiliaryLines = Object.entries(report.auxiliary).map(([, value]) => {
    const trigger = value.autoTriggered ? " [auto]" : "";
    return `- ${value.label}: ${value.status}${trigger}${value.durationMs ? ` (${value.durationMs} ms)` : ""}`;
  });
  const artifactLines = [
    `- Debug EXE: ${report.artifacts.debugExe.exists ? "OK" : "ausente"}${report.artifacts.debugExe.path ? ` - ${report.artifacts.debugExe.path}` : ""}`,
    `- Release EXE: ${report.artifacts.releaseExe.exists ? "OK" : "ausente"}${report.artifacts.releaseExe.path ? ` - ${report.artifacts.releaseExe.path}` : ""}`,
    `- MSI: ${report.artifacts.msi.exists ? "OK" : "ausente"}${report.artifacts.msi.path ? ` - ${report.artifacts.msi.path}` : ""}`,
    `- Build report: ${report.artifacts.buildReport.exists ? "OK" : "ausente"}`,
    `- Upstream report: ${report.artifacts.upstreamReport.exists ? "OK" : "ausente"}`,
    `- WebDriver local: ${report.artifacts.webdriver.exists ? "OK" : "ausente"}`,
  ];
  const automatedQaLines = report.automatedQa.blocks.map((block) => `- ${block.id} - ${block.name}: ${block.status}`);
  const manualQaLines = report.manualQa.blocks.map(
    (block) =>
      `- ${block.id} - ${block.name}: ${block.status}${block.note ? ` (${block.note})` : ""}`
  );
  const blockerLines =
    report.summary.blockers.length > 0
      ? report.summary.blockers.map((item) => `- ${item}`)
      : ["- Nenhum bloqueador automatizado detectado."];
  const warningLines =
    report.summary.warnings.length > 0
      ? report.summary.warnings.map((item) => `- ${item}`)
      : ["- Nenhum aviso adicional detectado."];

  return [
    "# Release Readiness",
    "",
    `- Gerado em: ${report.generatedAt}`,
    `- Branch: ${report.git.branch}`,
    `- Commit: ${report.git.commit}`,
    `- Upstream track: ${report.git.trackingRef ?? "(sem upstream configurado)"}`,
    `- Divergencia vs upstream: ${formatDivergence(report.git.trackingDivergence)}`,
    `- Divergencia vs origin/main: ${formatDivergence(report.git.originMainDivergence)}`,
    `- Pronto para promocao: ${report.summary.readyForPromotion ? "SIM" : "NAO"}`,
    "",
    "## Gates baseline",
    ...gateLines,
    "",
    "## Gates auxiliares",
    ...(auxiliaryLines.length > 0 ? auxiliaryLines : ["- Nenhum gate auxiliar executado."]),
    "",
    "## Artefatos canonicos",
    ...artifactLines,
    "",
    "## QA automatizado",
    ...automatedQaLines,
    "",
    "## QA humano",
    `- Documento base: ${path.relative(repoRoot, QA_DOC_PATH).replaceAll("\\", "/")}`,
    ...manualQaLines,
    "",
    "## Bloqueadores",
    ...blockerLines,
    "",
    "## Avisos",
    ...warningLines,
    "",
  ].join("\n");
}

export function formatDivergence(value) {
  return value ? `+${value.ahead} / -${value.behind}` : "desconhecida (não verificada)";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(VALIDATION_DIR, { recursive: true });
  if (options.runBaseline && !process.env.CARGO_TARGET_DIR) throw new Error("Execute pelo launcher do host para reutilizar o Cargo target oficial.");

  let gitState = await collectGitState();
  const initialGitState = gitState;
  const gateResults = BASELINE_GATES.map((gate) => createEmptyGateResult(gate));
  const auxiliary = {};
  const effectiveBuildMode = options.runBuildMode ?? (shouldAutoRunBuildDebug(options) ? "debug" : null);
  const shouldRunUpstreamNow = options.runUpstream || shouldAutoRunUpstream(options);

  if (effectiveBuildMode) {
    auxiliary.build = await runAuxiliaryCommand(
      `build:${effectiveBuildMode}`,
      "node",
      [path.join("scripts", "build.mjs"), effectiveBuildMode]
    );
    auxiliary.build.requestedMode = effectiveBuildMode;
    auxiliary.build.autoTriggered = shouldAutoRunBuildDebug(options);
  }

  if (options.runBaseline) {
    for (let index = 0; index < BASELINE_GATES.length; index += 1) {
      gateResults[index] = await runGate(BASELINE_GATES[index]);
    }
  }

  if (shouldRunUpstreamNow) {
    auxiliary.upstream = await runAuxiliaryCommand(
      "validate-upstream-windows",
      powershellCommand(),
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join("scripts", "validate-upstream-windows.ps1"),
        "-SkipRustTests",
      ]
    );
    auxiliary.upstream.autoTriggered = shouldAutoRunUpstream(options);
  }

  const shouldRunDesktopE2E = options.runDesktopE2E || shouldAutoRunDesktopE2E(options);

  if (shouldRunDesktopE2E) {
    const desktopCommand = `node scripts/e2e-tauri-build-run.mjs --skip-build --native-driver ${WEBDRIVER_PATH}`;
    if (auxiliary.build?.requestedMode === "debug" && auxiliary.build.status !== "passed") {
      auxiliary.desktopE2E = createSyntheticAuxiliaryFailure(
        "desktop-e2e",
        desktopCommand,
        "Build debug da rodada falhou; desktop E2E foi bloqueado preventivamente."
      );
    } else if (!(await pathExists(DEBUG_EXE_PATH))) {
      auxiliary.desktopE2E = createSyntheticAuxiliaryFailure(
        "desktop-e2e",
        desktopCommand,
        "Executavel debug canonico ausente; desktop E2E com --skip-build nao pode iniciar."
      );
    } else if (!(await pathExists(WEBDRIVER_PATH))) {
      auxiliary.desktopE2E = createSyntheticAuxiliaryFailure(
        "desktop-e2e",
        desktopCommand,
        "msedgedriver.exe ausente no caminho canonico."
      );
    } else {
      auxiliary.desktopE2E = await runAuxiliaryCommand(
        "desktop-e2e",
        "node",
        [
          path.join("scripts", "e2e-tauri-build-run.mjs"),
          "--skip-build",
          "--native-driver",
          WEBDRIVER_PATH,
        ]
      );
    }
    auxiliary.desktopE2E.autoTriggered = shouldAutoRunDesktopE2E(options);
  }

  gitState = await collectGitState();
  gitState.changedDuringRun = initialGitState.commit !== gitState.commit
    || JSON.stringify(initialGitState.dirtyEntries) !== JSON.stringify(gitState.dirtyEntries);
  const candidatePath = options.candidateApp ? path.resolve(repoRoot, options.candidateApp) : null;
  const candidate = { path: candidatePath, app_sha256: candidatePath ? await readFile(candidatePath).then((bytes) => createHash("sha256").update(bytes).digest("hex")).catch(() => null) : null };
  const harnessSha256 = createHash("sha256").update(await readFile(path.join(repoRoot, "scripts/e2e-tauri-build-run.mjs"))).digest("hex");
  const qaContext = { appSha256: candidate.app_sha256, commit: gitState.commit, harnessSha256 };
  const [buildReport, upstreamReport, automatedQa, manualQa, debugExe, releaseExe, latestMsi, webdriver] =
    await Promise.all([
      readJsonIfExists(BUILD_REPORT_PATH),
      readJsonIfExists(UPSTREAM_REPORT_PATH),
      loadQaStatus(options.automatedQaJson, { ...qaContext, kind: "automated" }),
      loadQaStatus(options.humanQaJson, { ...qaContext, kind: "human" }),
      inspectFile(DEBUG_EXE_PATH),
      inspectFile(RELEASE_EXE_PATH),
      findLatestMsi(),
      inspectFile(WEBDRIVER_PATH),
    ]);

  const artifacts = {
    debugExe,
    releaseExe,
    msi: await inspectFile(latestMsi),
    buildReport: await inspectFile(BUILD_REPORT_PATH),
    upstreamReport: await inspectFile(UPSTREAM_REPORT_PATH),
    webdriver,
  };

  const summary = classifyReadiness({
    gitState,
    gateResults,
    auxiliary,
    artifacts,
    buildReport,
    upstreamReport,
    manualQa,
    automatedQa,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    candidate,
    git: {
      branch: gitState.branch,
      commit: gitState.commit,
      trackingRef: gitState.trackingRef,
      trackingDivergence: gitState.trackingDivergence,
      originMainRef: gitState.originMainRef,
      originMainDivergence: gitState.originMainDivergence,
      dirtyEntries: gitState.dirtyEntries,
      dirtyTrackedEntries: gitState.dirtyTrackedEntries,
      changedDuringRun: gitState.changedDuringRun,
    },
    gates: gateResults,
    auxiliary,
    artifacts,
    reports: {
      buildReportPath: BUILD_REPORT_PATH,
      buildReport,
      upstreamReportPath: UPSTREAM_REPORT_PATH,
      upstreamReport,
    },
    automatedQa,
    manualQa: {
      ...manualQa,
      source: manualQa.source,
      document: path.relative(repoRoot, QA_DOC_PATH).replaceAll("\\", "/"),
      blocks: manualQa.blocks,
      error: manualQa.error ?? null,
    },
    experimentalSurfaces: EXPERIMENTAL_SURFACES,
    summary,
  };

  await writeFile(READINESS_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(READINESS_MD_PATH, `${toMarkdown(report)}\n`, "utf8");

  console.log(`\n[Release Readiness] JSON: ${READINESS_JSON_PATH}`);
  console.log(`[Release Readiness] Markdown: ${READINESS_MD_PATH}`);
  console.log(
    `[Release Readiness] Pronto para promocao: ${summary.readyForPromotion ? "SIM" : "NAO"}`
  );

  if (summary.blockers.length > 0) {
    console.log("[Release Readiness] Bloqueadores:");
    for (const blocker of summary.blockers) {
      console.log(`- ${blocker}`);
    }
  }

  if (options.strict && summary.blockers.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main().catch((error) => {
  console.error("[release-readiness] erro fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
