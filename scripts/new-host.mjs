#!/usr/bin/env node
// Session coordinator only. host-manager.mjs remains the installer/readiness authority.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { acquireOperationLock, detectHost, diagnose, isSupportedHost, nativeCacheBase, readManifest, repoRoot } from "./host-manager.mjs";

const GiB = 1024 ** 3;
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

export function canonicalPath(value) {
  const absolute = path.resolve(value);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = path.dirname(absolute);
  return path.join(canonicalPath(parent), path.basename(absolute));
}

export function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function parseArgs(args) {
  const mode = args[0] ?? "--plan";
  if (!["--plan", "--install", "--check", "--certify", "--build", "--run"].includes(mode)) throw new Error("unknown_mode");
  if (mode === "--run") {
    if (args.length < 2) throw new Error("run_requires_command");
    return { mode, command: args.slice(1), certify: false, build: false, offline: false };
  }
  const options = new Set(args.slice(1));
  if ([...options].some((flag) => !["--offline", "--certify", "--build"].includes(flag))) throw new Error("unknown_option");
  if (mode !== "--install" && options.has("--offline")) throw new Error("offline_requires_install");
  if (!["--install", "--certify"].includes(mode) && options.size) throw new Error("options_require_install_or_certify");
  return { mode, command: [], certify: mode === "--certify" || options.has("--certify"), build: mode === "--build" || options.has("--build"), offline: options.has("--offline") };
}

export function createPlan({ env = process.env, root = repoRoot, host = detectHost(env), home = os.homedir() } = {}) {
  const { manifest, lockDigest } = readManifest(path.join(root, "toolchains", "host-requirements.lock.json"));
  const node = readFileSync(path.join(root, ".node-version"), "utf8").trim();
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const rust = /channel\s*=\s*"([^"]+)"/.exec(readFileSync(path.join(root, "rust-toolchain.toml"), "utf8"))?.[1];
  if (manifest.pins.node !== node || manifest.pins.rust !== rust || pkg.packageManager !== `npm@${manifest.pins.npm}`) throw new Error("conflicting_version_pins");
  const jobs = Number(env.RDS_BUILD_JOBS ?? Math.min(2, os.availableParallelism(), os.totalmem() < 8 * GiB ? 1 : 2));
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error("build_jobs_must_be_1_to_8");
  const minimum = Number(env.RDS_MIN_FREE_GIB ?? 35);
  if (!Number.isInteger(minimum) || minimum < 16 || minimum > 1024) throw new Error("minimum_free_gib_must_be_16_to_1024");
  if (env.RDS_WORK_ROOT && !path.isAbsolute(env.RDS_WORK_ROOT)) throw new Error("work_root_must_be_absolute");
  const work = canonicalPath(env.RDS_WORK_ROOT ?? path.join(home, "RetroDevStudio-work"));
  const cache = canonicalPath(nativeCacheBase(host, env));
  const checkout = canonicalPath(root);
  if (inside(checkout, work) || inside(checkout, cache)) throw new Error("generated_storage_must_be_outside_checkout");
  if (work === canonicalPath(home) || work === path.parse(work).root || work.split(path.sep).some((part) => part.startsWith("."))) throw new Error("work_root_must_be_a_non_hidden_subdirectory");
  return {
    schema: "rds-development-session/v1", supported: isSupportedHost(manifest, host), host,
    pins: { node, npm: manifest.pins.npm, rust }, lock_digest: lockDigest,
    repo: checkout, cache, work, target: path.join(cache, lockDigest, "cargo-target"),
    tmp: path.join(work, "tmp"), sessions: path.join(work, "sessions"),
    jobs, minimum_free_bytes: minimum * GiB,
    installed_by: "scripts/bootstrap.{sh,ps1} -> scripts/host-manager.mjs",
    corpus: "operator_managed_not_downloaded", gui_acceptance: "not_run",
  };
}

export function checkSpace(plan, stat = statfsSync) {
  return [...new Set([plan.repo, plan.cache, plan.work])].map((location) => {
    let parent = location;
    while (!existsSync(parent)) parent = path.dirname(parent);
    const fs = stat(parent);
    const free = Number(fs.bavail) * Number(fs.bsize);
    if (!Number.isFinite(free) || free < plan.minimum_free_bytes) throw new Error(`insufficient_space:${location}:${free}`);
    // Cargo/SDK execution on removable non-POSIX filesystems is not supported here.
    if (process.platform === "linux" && location !== plan.repo && [0x4d44, 0x2011bab0, 0x5346544e].includes(Number(fs.type))) throw new Error(`native_storage_required:${location}`);
    return { location, measured_at: parent, available_bytes: free };
  });
}

export function sessionEnvironment(plan, base = process.env, managedPath = base.PATH) {
  return {
    ...base, PATH: managedPath,
    RDS_HOST_CACHE: plan.cache, RDS_WORK_ROOT: plan.work,
    RDS_BUILD_JOBS: String(plan.jobs), CARGO_BUILD_JOBS: String(plan.jobs),
    CMAKE_BUILD_PARALLEL_LEVEL: String(plan.jobs),
    CARGO_TARGET_DIR: plan.target, CARGO_INCREMENTAL: "0",
    RUST_MIN_STACK: base.RUST_MIN_STACK ?? "16777216",
    npm_config_cache: path.join(plan.cache, "npm"),
    TMPDIR: plan.tmp, TEMP: plan.tmp, TMP: plan.tmp,
  };
}

export function stagesFor(options, platform = process.platform) {
  const npm = platform === "win32" ? "npm.cmd" : "npm";
  const stages = [];
  if (options.mode === "--install") stages.push(["npm-ci", npm, ["ci", ...(options.offline ? ["--offline"] : [])]], ["tree", npm, ["run", "check:tree"]]);
  if (options.certify) stages.push(
    ["host-certify", process.execPath, ["scripts/host-manager.mjs", "certify", "--profile", "full"]],
    ["rust-format", "cargo", ["fmt", "--manifest-path", "src-tauri/Cargo.toml", "--", "--check"]],
    ["crate-gates", npm, ["run", "crates:gates"]],
    ["npm-audit", npm, ["run", "security:audit"]],
    ["rust-audit-tool", "cargo", ["install", "cargo-audit", "--version", "0.22.2", "--locked"]],
    ["rust-audit", "cargo", ["audit", "--file", "src-tauri/Cargo.lock"]],
  );
  if (options.build) stages.push(["portable-build", npm, ["run", "build:portable"]]);
  if (options.mode === "--run") stages.push(["command", options.command[0], options.command.slice(1)]);
  return stages;
}

function execute(program, args, { env, root, log }) {
  const windowsShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(program);
  if (windowsShim && args.some((arg) => /[\r\n"&|<>^%!]/.test(arg))) throw new Error("unsafe_windows_shell_argument");
  const fd = openSync(log, "a");
  try {
    const result = spawnSync(program, args, { cwd: root, env, stdio: ["inherit", fd, fd], shell: windowsShim });
    return { exit_code: result.status, signal: result.signal, error: result.error?.message ?? null };
  } finally { closeSync(fd); }
}

export function performStages(stages, { receipt, persist, runner, space }) {
  for (const [label, program, args] of stages) {
    space();
    const stage = { label, started_at: new Date().toISOString(), status: "RUNNING", log: path.join(receipt.directory, `${label}.log`) };
    receipt.stages.push(stage);
    persist();
    console.log(`[NEW HOST] ${label}: ${stage.log}`);
    const result = runner(program, args, stage.log);
    Object.assign(stage, result, { finished_at: new Date().toISOString(), status: result.exit_code === 0 ? "PASS" : "FAIL" });
    persist();
    if (result.exit_code !== 0) throw new Error(`stage_failed:${label}:${result.exit_code ?? result.signal ?? result.error}`);
  }
}

export function recordLockfiles(receipt, mode, root) {
  receipt.lockfiles_after = Object.fromEntries(Object.keys(receipt.lockfiles).map((file) => [file, hash(path.join(root, file))]));
  receipt.lockfiles_changed = Object.keys(receipt.lockfiles).filter((file) => receipt.lockfiles[file] !== receipt.lockfiles_after[file]);
  // Setup/certification must be immutable. A trusted development command may
  // intentionally maintain dependencies; record its delta instead of masking rc=0.
  if (mode !== "--run" && receipt.lockfiles_changed.length) throw new Error(`lockfile_changed:${receipt.lockfiles_changed.join(",")}`);
}

function linuxBootId() {
  if (process.platform !== "linux") return null;
  try { return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim(); } catch { return null; }
}

/** Recover only a lease proven to belong to another boot. A dead coordinator
 * in this boot can still have a running child; preserve such leases for review.
 * Reuse the host-manager mutex so competing launchers cannot archive a new owner. */
export function acquireDevelopmentLease(plan, receiptPath, { bootId = linuxBootId() } = {}) {
  const guard = acquireOperationLock(path.join(plan.work, "development-lease-guard"));
  if (!guard) throw new Error("development_session_busy: outra abertura está em andamento; tente novamente em instantes");
  const lockPath = path.join(plan.work, "development-operation.lock");
  const validBoot = (id) => typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
  const owner = JSON.stringify({ pid: process.pid, receipt: receiptPath, boot_id: validBoot(bootId) ? bootId : null });
  const recovered = [];
  try {
    if (existsSync(lockPath)) {
      let previous;
      try { previous = JSON.parse(readFileSync(lockPath, "utf8")); }
      catch { throw new Error(`development_lock_unreadable: trava preservada para inspeção: ${lockPath}`); }
      if (!validBoot(bootId) || !validBoot(previous.boot_id) || previous.boot_id.toLowerCase() === bootId.toLowerCase())
        throw new Error(`development_session_busy: sessão anterior preservada (PID ${previous.pid ?? "desconhecido"}); feche o RetroDev normalmente ou confira o recibo ${previous.receipt ?? lockPath}`);
      const preserved = path.join(path.dirname(receiptPath), "previous-boot-development-operation.lock");
      if (existsSync(preserved)) throw new Error(`recovery_evidence_already_exists:${preserved}`);
      renameSync(lockPath, preserved);
      recovered.push({ reason: "previous_boot", owner: previous, preserved, sha256: hash(preserved) });
    }
    const fd = openSync(lockPath, "wx", 0o600);
    try { writeFileSync(fd, owner); } finally { closeSync(fd); }
    return { boot_id: validBoot(bootId) ? bootId : null, recovered, release: () => {
      // Never unlink a lease that has been replaced by another owner.
      if (existsSync(lockPath) && readFileSync(lockPath, "utf8") === owner) unlinkSync(lockPath);
    } };
  } finally { guard.release(); }
}

export function notifyDesktopFailure(error, receiptPath, env = process.env, runner = spawnSync) {
  if (env.RDS_DESKTOP_LAUNCH !== "1" || process.platform !== "linux") return null;
  const message = `${error.message}\n${receiptPath ? `Detalhes: ${receiptPath}` : "Confira o launcher do projeto."}`;
  const result = runner("notify-send", ["--app-name=RetroDev Studio", "--urgency=critical", "RetroDev Studio não abriu", message], { env, timeout: 3000, stdio: "ignore" });
  return { exit_code: result.status, error: result.error?.message ?? null };
}

export function main(args = process.argv.slice(2)) {
  let receipt, receiptPath, lease;
  const persist = () => {
    if (!receiptPath) return;
    writeFileSync(`${receiptPath}.tmp`, `${JSON.stringify(receipt, null, 2)}\n`);
    renameSync(`${receiptPath}.tmp`, receiptPath);
  };
  try {
    const options = parseArgs(args);
    const plan = createPlan();
    if (options.mode === "--plan") {
      console.log(JSON.stringify({ ...plan, notice: "read_only_plan_not_readiness_or_certification" }, null, 2));
      return plan.supported ? 0 : 11;
    }
    if (!plan.supported) throw new Error(`unsupported_host:${plan.host.platform}/${plan.host.arch}/${plan.host.os_id}`);
    const space = () => checkSpace(plan);
    space();
    mkdirSync(plan.tmp, { recursive: true });
    mkdirSync(plan.sessions, { recursive: true });
    const directory = path.join(plan.sessions, `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`);
    mkdirSync(directory);
    receiptPath = path.join(directory, "receipt.json");
    const snapshot = spawnSync("git", ["rev-parse", "HEAD"], { cwd: plan.repo, encoding: "utf8" });
    const sourceStatus = spawnSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: plan.repo, encoding: "utf8" });
    receipt = { ...plan, directory, mode: options.mode, status: "RUNNING", started_at: new Date().toISOString(), source_commit: snapshot.stdout?.trim() || null, source_dirty: sourceStatus.status === 0 ? Boolean(sourceStatus.stdout.trim()) : null, stages: [], certification: options.certify ? "pending" : "not_run", gui_acceptance: "not_run", lockfiles: Object.fromEntries(["package-lock.json", "src-tauri/Cargo.lock", "toolchains/host-requirements.lock.json"].map((file) => [file, hash(path.join(plan.repo, file))])) };
    persist();
    lease = acquireDevelopmentLease(plan, receiptPath);
    receipt.boot_id = lease.boot_id;
    receipt.recovered_locks = lease.recovered;
    persist();
    const initialEnv = sessionEnvironment(plan);
    const initial = diagnose({ env: initialEnv });
    copyFileSync(initial.report.paths.report, path.join(directory, "host-before.json"));
    if (initial.report.state !== "READY") throw new Error(`host_not_ready:${initial.report.state}:${initial.report.blockers.join(",")}`);
    const env = sessionEnvironment(plan, initialEnv, initial.context.pathEnv);
    const versions = [[process.execPath, ["--version"], `v${plan.pins.node}`], [plan.host.platform === "win32" ? "npm.cmd" : "npm", ["--version"], plan.pins.npm]];
    for (const [program, commandArgs, expected] of versions) {
      const actual = spawnSync(program, commandArgs, { cwd: plan.repo, env, encoding: "utf8", shell: plan.host.platform === "win32" && program.endsWith(".cmd") });
      if (actual.status !== 0 || actual.stdout.trim() !== expected) throw new Error(`version_mismatch:${program}:expected_${expected}`);
    }
    performStages(stagesFor(options), { receipt, persist, space, runner: (program, commandArgs, log) => execute(program, commandArgs, { env, root: plan.repo, log }) });
    if (options.certify) {
      const report = JSON.parse(readFileSync(initial.report.paths.report, "utf8"));
      copyFileSync(initial.report.paths.report, path.join(directory, "host-certified.json"));
      if (report.mode !== "certify" || report.state !== "READY" || report.gates.length === 0 || report.gates.some((gate) => !gate.ok)) throw new Error("certification_report_not_passed");
      receipt.certification = "PASS";
    }
    recordLockfiles(receipt, options.mode, plan.repo);
    receipt.status = "PASS";
    receipt.finished_at = new Date().toISOString();
    persist();
    console.log(`[NEW HOST] ${options.mode} passed. Receipt: ${receiptPath}`);
    console.log("GUI journeys and human usability are not certified by this launcher. Next: docs/handoffs/NOVO_HOST_INICIO.md");
    return 0;
  } catch (error) {
    if (receipt) {
      if (receipt.certification === "pending") receipt.certification = receipt.stages.some((stage) => stage.label === "host-certify" && stage.status === "PASS") ? "stage_passed_followup_failed" : "not_completed";
      receipt.status = "FAIL"; receipt.error = error.message; receipt.finished_at = new Date().toISOString(); persist();
    }
    console.error(`[NEW HOST] ${error.message}${receiptPath ? `; receipt: ${receiptPath}` : ""}`);
    const notification = notifyDesktopFailure(error, receiptPath);
    if (receipt && notification) { receipt.desktop_notification = notification; persist(); }
    return 10;
  } finally {
    lease?.release();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
