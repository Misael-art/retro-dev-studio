import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireDevelopmentLease, checkSpace, createPlan, inside, notifyDesktopFailure, parseArgs, performStages, recordLockfiles, sessionEnvironment, stagesFor } from "./new-host.mjs";
import { repoRoot, sourceBuildJobs } from "./host-manager.mjs";

const temp = [];
const directory = () => { const value = mkdtempSync(path.join(os.tmpdir(), "rds-new-host-")); temp.push(value); return value; };
afterEach(() => { while (temp.length) rmSync(temp.pop(), { recursive: true, force: true }); });
const posix = process.platform === "win32" ? it.skip : it;
const makePlan = (env = {}) => createPlan({ env: { RDS_WORK_ROOT: path.join(directory(), "work"), RDS_HOST_CACHE: path.join(directory(), "cache"), ...env } });

describe("new host: storage and pinned environment", () => {
  it("builds a read-only plan without creating workspace/cache directories", () => {
    const plan = makePlan();
    expect(existsSync(plan.work)).toBe(false);
    expect(existsSync(plan.cache)).toBe(false);
    expect(plan.pins).toEqual({ node: "24.18.0", npm: "11.16.0", rust: "1.97.0" });
    expect(plan.gui_acceptance).toBe("not_run");
  });
  it("marks an unsupported host without pretending Linux CI means provisioning support", () => {
    const plan = createPlan({ host: { platform: "linux", arch: "x64", os_id: "ubuntu" }, env: { RDS_WORK_ROOT: path.join(directory(), "work") } });
    expect(plan.supported).toBe(false);
  });
  it("rejects generated data inside the checkout", () => {
    expect(() => makePlan({ RDS_WORK_ROOT: "relative-work" })).toThrow("must_be_absolute");
    expect(() => makePlan({ RDS_WORK_ROOT: path.join(repoRoot, "scratch") })).toThrow("outside_checkout");
    expect(() => makePlan({ RDS_HOST_CACHE: path.join(repoRoot, "cache") })).toThrow("outside_checkout");
  });
  posix("rejects a symlink disguising a work directory inside the checkout", () => {
    const link = path.join(directory(), "alias");
    symlinkSync(repoRoot, link);
    expect(() => makePlan({ RDS_WORK_ROOT: path.join(link, "not-created") })).toThrow("outside_checkout");
    expect(existsSync(path.join(repoRoot, "not-created"))).toBe(false);
  });
  it("rejects a hidden Ghidra temp path and a bare home directory", () => {
    expect(() => makePlan({ RDS_WORK_ROOT: path.join(directory(), ".hidden", "work") })).toThrow("non_hidden");
    expect(() => makePlan({ RDS_WORK_ROOT: os.homedir() })).toThrow("non_hidden");
  });
  it("distinguishes a sibling with a common prefix from a child", () => {
    expect(inside("/repo", "/repository")).toBe(false);
    expect(inside("/repo", "/repo/target")).toBe(true);
  });
  it("fails before executing heavy commands when any storage volume is low", () => {
    const plan = makePlan();
    expect(() => checkSpace(plan, () => ({ bavail: 0, bsize: 4096 }))).toThrow("insufficient_space");
    expect(checkSpace(plan, () => ({ bavail: 100 * 1024 ** 3, bsize: 1 }))).toHaveLength(3);
  });
  posix("rejects non-POSIX build storage without rejecting a removable source checkout", () => {
    expect(() => checkSpace(makePlan(), () => ({ bavail: 100 * 1024 ** 3, bsize: 1, type: 0x2011bab0 }))).toThrow("native_storage_required");
  });
  it("caps explicit jobs and rejects malformed limits rather than silently ignoring them", () => {
    for (const value of ["0", "9", "2x", "NaN"]) expect(() => makePlan({ RDS_BUILD_JOBS: value })).toThrow("build_jobs");
    for (const value of ["0", "15", "x"]) expect(() => makePlan({ RDS_MIN_FREE_GIB: value })).toThrow("minimum_free");
    expect(makePlan({ RDS_BUILD_JOBS: "1" }).jobs).toBe(1);
  });
  it("activates one Cargo target and keeps the caller's HOME/XDG policy intact", () => {
    const plan = makePlan({ RDS_BUILD_JOBS: "1" });
    const base = { HOME: "/original-home", XDG_CONFIG_HOME: "/original-config", PATH: "/usr/bin" };
    const env = sessionEnvironment(plan, base, "/managed/bin:/usr/bin");
    expect(env.HOME).toBe(base.HOME);
    expect(env.XDG_CONFIG_HOME).toBe(base.XDG_CONFIG_HOME);
    expect(env.CARGO_BUILD_JOBS).toBe("1");
    expect(env.CARGO_INCREMENTAL).toBe("0");
    expect(env.CARGO_TARGET_DIR).toBe(plan.target);
    expect(env.TMPDIR).toBe(plan.tmp);
    expect(base.PATH).toBe("/usr/bin");
  });
  it("applies the resource cap to real source builds, including an inherited environment", () => {
    expect(sourceBuildJobs({ RDS_BUILD_JOBS: "2" })).toBe("2");
    expect(sourceBuildJobs({ RDS_BUILD_JOBS: "1" })).toBe("1");
    expect(() => sourceBuildJobs({ RDS_BUILD_JOBS: "8;false" })).toThrow("RDS_BUILD_JOBS");
  });
});

describe("new host: fail-closed orchestration", () => {
  it("archives a previous-boot lease byte-for-byte and releases only its own replacement", () => {
    const work = directory(), session = directory(), lock = path.join(work, "development-operation.lock");
    const old = JSON.stringify({pid:123,receipt:"old-receipt.json",boot_id:"11111111-1111-4111-8111-111111111111"});
    writeFileSync(lock, old);
    const lease = acquireDevelopmentLease({work}, path.join(session,"receipt.json"), {bootId:"22222222-2222-4222-8222-222222222222"});
    expect(readFileSync(lease.recovered[0].preserved,"utf8")).toBe(old);
    expect(lease.recovered[0]).toMatchObject({reason:"previous_boot",sha256:createHash("sha256").update(old).digest("hex")});
    expect(JSON.parse(readFileSync(lock,"utf8"))).toMatchObject({pid:process.pid,boot_id:lease.boot_id});
    lease.release();expect(existsSync(lock)).toBe(false);
  });
  it("preserves current-boot, legacy, corrupt and unknown-boot owners without removing their leases", () => {
    const boot = "11111111-1111-4111-8111-111111111111";
    for (const [raw,current] of [[JSON.stringify({pid:process.pid,boot_id:boot}),boot],[JSON.stringify({pid:99999999,boot_id:boot}),boot],[JSON.stringify({pid:99999999}),boot],["broken",boot],[JSON.stringify({pid:1,boot_id:boot}),null],[JSON.stringify({pid:1,boot_id:"invalid"}),boot]]) {
      const work=directory(),lock=path.join(work,"development-operation.lock");writeFileSync(lock,raw);
      expect(()=>acquireDevelopmentLease({work},path.join(directory(),"receipt.json"),{bootId:current})).toThrow();
      expect(readFileSync(lock,"utf8")).toBe(raw);
    }
  });
  it("serializes lease recovery and never releases another owner's file", () => {
    const work=directory(),guard=path.join(work,"development-lease-guard","operation.lock");mkdirSync(guard,{recursive:true});writeFileSync(path.join(guard,"owner.json"),JSON.stringify({pid:process.pid}));
    expect(()=>acquireDevelopmentLease({work},path.join(directory(),"receipt.json"))).toThrow("development_session_busy");
    rmSync(guard,{recursive:true});
    const lease=acquireDevelopmentLease({work},path.join(directory(),"receipt.json"));
    const lock=path.join(work,"development-operation.lock");writeFileSync(lock,"replacement-owner");lease.release();expect(readFileSync(lock,"utf8")).toBe("replacement-owner");
  });
  posix("reports desktop launch failures without opening a shell or changing ordinary CLI behavior", () => {
    if(process.platform!=="linux")return;
    const calls=[],runner=(...args)=>{calls.push(args);return {status:0};};
    expect(notifyDesktopFailure(new Error("busy"),"receipt.json",{},runner)).toBeNull();expect(calls).toHaveLength(0);
    expect(notifyDesktopFailure(new Error("busy"),"receipt.json",{RDS_DESKTOP_LAUNCH:"1"},runner)).toMatchObject({exit_code:0});
    expect(calls[0][0]).toBe("notify-send");expect(calls[0][1].at(-1)).toContain("Detalhes: receipt.json");expect(calls[0][2]).toMatchObject({timeout:3000,stdio:"ignore"});expect(calls[0][2].shell).not.toBe(true);
  });
  it("requires stable locks for certification but records an intentional maintenance delta", () => {
    const root = directory();
    writeFileSync(path.join(root, "lock.json"), "updated");
    const digest = createHash("sha256").update("original").digest("hex");
    const receipt = { lockfiles: { "lock.json": digest } };
    expect(() => recordLockfiles(receipt, "--certify", root)).toThrow("lockfile_changed:lock.json");
    expect(() => recordLockfiles(receipt, "--run", root)).not.toThrow();
    expect(receipt.lockfiles_changed).toEqual(["lock.json"]);
    expect(receipt.lockfiles_after["lock.json"]).toBe(createHash("sha256").update("updated").digest("hex"));
  });
  it("defaults to a read-only plan and validates argument combinations", () => {
    expect(parseArgs([]).mode).toBe("--plan");
    for (const args of [["--run"], ["--plan", "--build"], ["--check", "--offline"], ["--install", "--force"]]) expect(() => parseArgs(args)).toThrow();
    expect(parseArgs(["--run", "npm", "run", "dev"]).command).toEqual(["npm", "run", "dev"]);
  });
  it("uses npm ci, honors offline, and delegates certification/build to canonical commands", () => {
    const stages = stagesFor(parseArgs(["--install", "--offline", "--certify", "--build"]), "linux");
    expect(stages[0]).toEqual(["npm-ci", "npm", ["ci", "--offline"]]);
    expect(stages.find(([label]) => label === "host-certify")[2]).toEqual(["scripts/host-manager.mjs", "certify", "--profile", "full"]);
    expect(stages.at(-1)).toEqual(["portable-build", "npm", ["run", "build:portable"]]);
    expect(stages.some(([, , args]) => args.includes("fix"))).toBe(false);
    expect(stagesFor(parseArgs(["--check"]))).toEqual([]);
  });
  it("persists a failed stage and does not run later stages", () => {
    const calls = [], saved = [];
    const receipt = { directory: directory(), stages: [] };
    expect(() => performStages([["first", "tool", []], ["second", "tool", []]], {
      receipt, persist: () => saved.push(JSON.parse(JSON.stringify(receipt))), space: () => {},
      runner: (program) => { calls.push(program); return { exit_code: 7 }; },
    })).toThrow("stage_failed:first:7");
    expect(calls).toHaveLength(1);
    expect(saved[0].stages[0].status).toBe("RUNNING");
    expect(saved.at(-1).stages[0]).toMatchObject({ status: "FAIL", exit_code: 7 });
  });
  it("checks available disk space again between stages", () => {
    let checks = 0, executions = 0;
    const receipt = { directory: directory(), stages: [] };
    expect(() => performStages([["first", "tool", []], ["second", "tool", []]], {
      receipt, persist: () => {}, space: () => { if (++checks === 2) throw new Error("disk_full"); },
      runner: () => { executions++; return { exit_code: 0 }; },
    })).toThrow("disk_full");
    expect(executions).toBe(1);
    expect(receipt.stages).toHaveLength(1);
  });
  posix("the level-zero help works without Node", () => {
    const tools = directory();
    symlinkSync("/usr/bin/cat", path.join(tools, "cat"));
    const result = spawnSync("/bin/bash", [path.join(repoRoot, "scripts/new-host.sh"), "--help"], { env: { PATH: tools }, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("new host");
  });
  posix("the Node-free plan creates no files and does not invoke provisioning", () => {
    const tools = directory(), work = path.join(directory(), "work"), cache = path.join(directory(), "cache");
    for (const command of ["dirname"]) symlinkSync(`/usr/bin/${command}`, path.join(tools, command));
    const result = spawnSync("/bin/bash", [path.join(repoRoot, "scripts/new-host.sh"), "--plan"], { env: { HOME: os.homedir(), PATH: tools, RDS_WORK_ROOT: work, RDS_HOST_CACHE: cache }, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Node is not installed");
    expect(existsSync(work)).toBe(false);
    expect(existsSync(cache)).toBe(false);
    expect(readdirSync(tools)).toEqual(["dirname"]);
  });
  posix("a failed Node download is never promoted into the verified archive cache", () => {
    const root = directory(), cache = path.join(root, "cache");
    mkdirSync(cache);
    const source = readFileSync(path.join(repoRoot, "scripts/bootstrap.sh"), "utf8");
    const fn = source.slice(source.indexOf("ensure_pinned_node() {"), source.indexOf("ensure_pinned_rust() {"));
    const script = path.join(root, "probe.sh");
    writeFileSync(script, `#!/bin/bash\nENSURE_HOST=1\nOFFLINE=0\nBOOTSTRAP_CACHE="$1"\nPORTABLE_CACHE="$1"\nPINNED_NODE_VERSION=x\nPINNED_NODE_SHA256=not-promoted\nPINNED_NODE_URL=https://example.invalid/node\nstep() { :; }\ncurl() { return 23; }\n${fn}\nensure_pinned_node\n`);
    const result = spawnSync("/bin/bash", [script, cache]);
    expect(result.status).toBe(23);
    expect(existsSync(path.join(cache, "not-promoted"))).toBe(false);
  });
});
