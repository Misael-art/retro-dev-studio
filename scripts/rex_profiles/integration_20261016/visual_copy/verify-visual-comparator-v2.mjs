// Pre-journey tests of the exact comparator used by the canonical journey.
// Inputs are independently generated expectations and deliberate mutants, never captures.
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {pixelDifferences,verifyFrozenOracle} from "./visual-proof.mjs";
const root=new URL("../../../../",import.meta.url), data=new URL("data/rex_profiles/integration_20261016/visual-copy-v2/",root);
const spec=JSON.parse(await readFile(new URL("forward-journey.json",data),"utf8"));
const manifest=await verifyFrozenOracle(spec.visual);
const expected=await readFile(new URL("width1.rgba",data)),other=await readFile(new URL("width2.rgba",data));
const old=await readFile(new URL("data/rex_profiles/integration_20261016/visual-copy/width1.rgba",root));
const checks=[];
const check=(name,value)=>{assert.equal(value,true,name);checks.push({name,pass:true});};
check("same_precomputed_image_passes_exactly",pixelDifferences(expected,expected,0).ok);
check("old_conversion_is_rejected",!pixelDifferences(old,expected,0).ok);
check("other_width_is_rejected",!pixelDifferences(other,expected,0).ok);
for(const [channel,offset] of [["red",0],["green",1],["blue",2],["alpha",3]]) {
  const bad=Buffer.from(expected);bad[offset]^=1;
  check(`${channel}_one_level_mutation_rejected`,!pixelDifferences(bad,expected,0).ok);
}
check("wrong_dimensions_rejected",!pixelDifferences(expected.subarray(4),expected,0).ok);
await assert.rejects(verifyFrozenOracle({...spec.visual,pixel_rgb_tolerance:7}),/exact RGBA/);check("v2_cannot_widen_tolerance",true);
await assert.rejects(verifyFrozenOracle({...spec.visual,oracle_manifest_sha256:"0".repeat(64)}),/identity/);check("wrong_oracle_identity_rejected",true);
const v1={oracle_dir:new URL("data/rex_profiles/integration_20261016/visual-copy/",root).pathname,oracle_manifest_sha256:createHash("sha256").update(await readFile(new URL("data/rex_profiles/integration_20261016/visual-copy/oracle.json",root))).digest("hex")};
check("v1_original_contract_still_loads",(await verifyFrozenOracle(v1)).schema==="rex-visual-oracle/v1");
const seven=Buffer.from(expected);seven[0]=7;
check("v1_default_accepts_delta_seven",pixelDifferences(seven,expected).ok);
const eight=Buffer.from(expected);eight[0]=8;
check("v1_default_rejects_delta_eight",!pixelDifferences(eight,expected).ok);
const result={schema:"rex-visual-comparator-tests/v2",inputs:"frozen independent expectations, no framebuffer captures",oracle_schema:manifest.schema,checks,allPass:true};
await writeFile(process.argv[2],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({checks:checks.length,allPass:true}));
