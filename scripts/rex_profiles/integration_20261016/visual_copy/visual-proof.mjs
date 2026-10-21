// External QA only: compares frozen pre-emulation assets to direct core and current canvas.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const sha = b => createHash("sha256").update(b).digest("hex");
export function identityMatches(identity,expectedHash,size) {
  return Boolean(identity?.ok && identity.rom_sha256===expectedHash && identity.rom_size===size && identity.disk_matches_loaded && identity.frames_run>0);
}
export async function verifyFrozenOracle(visual) {
  const raw=await readFile(path.join(visual.oracle_dir,"oracle.json"));
  if(sha(raw)!==visual.oracle_manifest_sha256) throw new Error("Frozen oracle identity mismatch");
  const manifest=JSON.parse(raw);
  for(const [name,hash] of Object.entries(manifest.files)) if(sha(await readFile(path.join(visual.oracle_dir,name)))!==hash) throw new Error(`Frozen oracle file mismatch: ${name}`);
  if(manifest.schema==="rex-visual-oracle/v2") {
    if(visual.pixel_rgb_tolerance!==0 || manifest.comparison?.rgb_tolerance!==0 || manifest.comparison?.alpha_tolerance!==0) throw new Error("v2 requires exact RGBA comparison");
    if(sha(await readFile(path.join(visual.oracle_dir,"color-model.json")))!==manifest.color_model_sha256) throw new Error("v2 color model identity mismatch");
  } else if(manifest.schema!=="rex-visual-oracle/v1" || (visual.pixel_rgb_tolerance??7)!==7) throw new Error("unsupported oracle comparison contract");
  return manifest;
}
export function pixelDifferences(a,b,tolerance=7) {
  if(a.length!==b.length || a.length!==320*224*4) return {ok:false, reason:"dimensions", count:null};
  const indices=[];
  for(let i=0;i<a.length;i+=4) if([0,1,2,3].some(c=>Math.abs(a[i+c]-b[i+c])>(c===3?0:tolerance))) indices.push(i/4);
  return {ok:indices.length===0,count:indices.length,first:indices.slice(0,12),indices};
}
export async function captureVisual({visual,width,etapa,prefix,validationDir,js,observe,addCheck,report}) {
  const core=await observe();
  const canvas=await js(`const c=document.querySelector('[data-testid="viewport-game-canvas"]'); if(!c) return null; const d=c.getContext('2d').getImageData(0,0,c.width,c.height); return {width:c.width,height:c.height,rgba:Array.from(d.data),png:c.toDataURL('image/png')};`);
  const expected=await readFile(path.join(visual.oracle_dir,`width${width}.rgba`));
  const raw=Buffer.from(core.framebuffer_rgba??[]),ui=Buffer.from(canvas?.rgba??[]);
  const tolerance=visual.pixel_rgb_tolerance??7;
  const d=pixelDifferences(raw,expected,tolerance);
  addCheck(`${etapa}.core_dimensions`,core.framebuffer_width===320 && core.framebuffer_height===224,{width:core.framebuffer_width,height:core.framebuffer_height});
  addCheck(`${etapa}.core_equals_independent_image`,d.ok,{mismatched_pixels:d.count,first:d.first,expected_sha256:sha(expected),observed_sha256:sha(raw)});
  addCheck(`${etapa}.canvas_equals_current_core`,canvas?.width===320&&canvas?.height===224&&raw.equals(ui),{core_sha256:sha(raw),canvas_sha256:sha(ui)});
  const other=await readFile(path.join(visual.oracle_dir,`width${3-width}.rgba`));
  addCheck(`${etapa}.rejects_stale_other_width_image`,!pixelDifferences(raw,other,tolerance).ok);
  const filename=path.join(validationDir,`${prefix}-${etapa}`);
  await writeFile(`${filename}-core.rgba`,raw);
  if(canvas?.png) await writeFile(`${filename}-canvas.png`,Buffer.from(canvas.png.split(',')[1],'base64'));
  report.visual_captures??=[];report.visual_captures.push({etapa,width,core_sha256:sha(raw),canvas_sha256:sha(ui),expected_sha256:sha(expected),core_rom_sha256:core.rom_sha256,frames_run:core.frames_run,core_capture:`${filename}-core.rgba`,canvas_capture:`${filename}-canvas.png`,mismatched_pixels:d.count,rgb_tolerance:tolerance,oracle_manifest_sha256:visual.oracle_manifest_sha256});
  return raw;
}
export function compareCausalPixels(a,b,expectedA,expectedB) {
  const observed=pixelDifferences(a,b,7), expected=pixelDifferences(expectedA,expectedB,7);
  return {pass:observed.count>0&&JSON.stringify(observed.indices)===JSON.stringify(expected.indices),observed_pixels:observed.count,expected_pixels:expected.count,first:observed.first};
}
