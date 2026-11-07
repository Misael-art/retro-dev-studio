import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Synthetic reports exercise the admission policy, never product readiness.
function probe(name, ...args) {
  const module = pathToFileURL(path.resolve("scripts/release-readiness.mjs")).href;
  const script = `const owner=await import(${JSON.stringify(module)});
    console.log(JSON.stringify(await owner[${JSON.stringify(name)}](...${JSON.stringify(args)})));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding:"utf8" }));
}
const app = "a".repeat(64), harness = "b".repeat(64), commit = "c".repeat(40);
const blocks = () => Object.fromEntries([..."ABCDEFGH"].map(id => [id, {status:"passed",note:"Controlled policy fixture; no real acceptance."}]));
const payload = kind => ({schema:kind === "human" ? "rds-qa-human/v1" : "rds-qa-automation/v1",kind,scenario:"qa-rc",
  generatedAt:new Date().toISOString(),candidate:{app_sha256:app},repository:{commit,dirty:false},harness_sha256:harness,
  observer:{id:"fixture-observer",independent:true,method:"interactive-session"},blocks:blocks()});
const validate = (kind, value, extra={}) => probe("validateQaPayload", value, {kind,appSha256:app,harnessSha256:harness,sourceVerified:true,...extra});
function context() {
  return {gitState:{branch:"main",commit,trackingRef:"origin/main",trackingDivergence:{ahead:0,behind:0},originMainDivergence:{ahead:0,behind:0},dirtyEntries:[],dirtyTrackedEntries:[]},
    gateResults:[{status:"passed",label:"controlled policy fixture"}],auxiliary:{desktopE2E:{status:"passed"}},
    artifacts:{releaseExe:{exists:true},msi:{exists:true},webdriver:{exists:true}},buildReport:{},upstreamReport:{success:true},
    automatedQa:validate("automated",payload("automated")),manualQa:validate("human",payload("human"))};
}

describe("release evidence admission", () => {
  it("does not accept automated or legacy reports as human observation", () => {
    for (const report of [payload("automated"), {scenario:"qa-rc",blocks:blocks()}]) {
      const result=validate("human",report);
      expect(result.error).toContain("Schema/origem");
      expect(result.blocks.every(block=>block.status==="pending")).toBe(true);
    }
    const input=context();
    input.manualQa=validate("human",null);
    expect(probe("classifyReadiness",input).blockers.some(v=>v.includes("QA humano ainda pendente"))).toBe(true);
  });

  it("requires all A-H blocks and does not turn unknown states into success", () => {
    const report=payload("automated"); delete report.blocks.G; report.blocks.H.status="unknown";
    const input=context(); input.automatedQa=validate("automated",report);
    expect(probe("classifyReadiness",input).blockers).toContain("QA automatizado ainda pendente: G, H");
  });

  it("rejects a different candidate, harness, schema, date or unverified source", () => {
    for (const [change,extra] of [
      [{candidate:{app_sha256:"d".repeat(64)}},{}],
      [{harness_sha256:"e".repeat(64)},{}],
      [{schema:"rds-qa-automation/2"},{}],
      [{generatedAt:"not a date"},{}],
      [{},{sourceVerified:false}],
    ]) {
      const result=validate("automated",{...payload("automated"),...change},extra);
      expect(result.error).toBeTruthy();
      expect(result.blocks.every(block=>block.status==="pending")).toBe(true);
    }
  });

  it("requires an independent interactive observer and observations for human blocks", () => {
    for (const observer of [{id:"fixture",independent:false,method:"interactive-session"}, {id:"fixture",independent:true,method:"automated"},null]) {
      expect(validate("human",{...payload("human"),observer}).error).toContain("observador independente");
    }
    const report=payload("human"); report.blocks.B.note="";
    expect(validate("human",report).blocks.find(b=>b.id==="B").status).toBe("pending");
  });

  it("fails closed when the public base or tracking comparison cannot be read", () => {
    const input=context();
    expect(probe("classifyReadiness",input).readyForPromotion).toBe(true); // policy-only positive control
    input.gitState.originMainDivergence=null;
    expect(probe("classifyReadiness",input).blockers.some(v=>v.includes("Base pública origin/main indisponível"))).toBe(true);
    input.gitState.trackingDivergence=null;
    expect(probe("classifyReadiness",input).blockers.some(v=>v.includes("Upstream de acompanhamento"))).toBe(true);
    const stale=context();stale.gitState.originMainDivergence.behind=1;
    expect(probe("classifyReadiness",stale).readyForPromotion).toBe(false);
    const changing=context();changing.gitState.changedDuringRun=true;
    expect(probe("classifyReadiness",changing).blockers.some(v=>v.includes("Fonte mudou durante"))).toBe(true);
    expect(probe("formatDivergence",null)).toContain("desconhecida");
    for (const raw of ["", "failure", "1", "-1 0", "NaN 3"]) expect(probe("parseAheadBehindCounts",raw)).toBeNull();
    expect(probe("parseAheadBehindCounts","2\t3")).toEqual({ahead:2,behind:3});
  });

  it("preserves malformed input and refuses missing evidence", () => {
    const dir=mkdtempSync(path.join(os.tmpdir(),"rds-readiness-policy-"));
    try {
      const file=path.join(dir,"qa.json");writeFileSync(file,"{partial");
      for (const candidate of [file,path.join(dir,"missing.json")]) {
        const report=probe("loadQaStatus",candidate,{kind:"human",appSha256:app,commit,harnessSha256:harness});
        expect(report.error).toBeTruthy();
        expect(report.blocks.every(b=>b.status==="pending")).toBe(true);
      }
      expect(readFileSync(file,"utf8")).toBe("{partial");
    } finally {rmSync(dir,{recursive:true,force:true});}
  });

  it("keeps the legacy CLI spelling exclusively on the automated side", () => {
    const options=probe("parseArgs",["--manual-qa-json","legacy.json"]);
    expect(options.automatedQaJson).toBe("legacy.json");
    expect(options.humanQaJson).toBeNull();
  });
});
