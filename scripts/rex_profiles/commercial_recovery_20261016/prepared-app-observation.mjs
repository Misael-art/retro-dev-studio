// External QA on the canonical desktop runner and existing replay/observation IPC.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function observePreparedApp({specPath,appPath,js,jsa,captureScreenshot,projectDir}) {
 const spec=JSON.parse(await readFile(specPath,'utf8'));
 if(spec.schema!=='rex-prepared-runtime-observation/v1') throw new Error('unknown prepared observation schema');
 const report={schema:'rex-prepared-app-result/v1',id:spec.id,projectDir,checks:[],runs:[],status:'BLOCKED',
  scope:'GX app session correspondence to separately prepared original GX replay; MAME trace remains external; no commercial edit/semantic equivalence claim'};
 await mkdir(spec.output,{recursive:false});
 const check=(name,pass,detail={})=>{report.checks.push({name,pass:Boolean(pass),...detail});if(!pass)throw new Error(name);};
 const invoke=(command,args={})=>jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;inv(arguments[0],arguments[1]).then(done).catch(e=>done({error:String(e)}));`,[command,args]);
 const observe=()=>invoke('emulator_observe');
 const load=()=>jsa(`const done=arguments[arguments.length-1];window.__RDS_E2E__.loadRomForEmulation(arguments[0],{startPaused:true}).then(done).catch(e=>done({error:String(e)}));`,[spec.rom]);
 const memory=(address,length)=>jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;const address=arguments[0]&65535,length=arguments[1],base=address&~1;inv('emulator_read_memory',{region:2,offset:base,length:(length+(address&1)+1)&~1}).then(r=>done({ok:r.ok,bytes:Array.from({length},(_,i)=>r.data[((address+i)-base)^1]),total_size:r.total_size})).catch(e=>done({error:String(e)}));`,[address,length]);
 let failure=null;
 try {
  check('app_identity',sha(await readFile(appPath))===spec.app_sha256);
  check('rom_identity',sha(await readFile(spec.rom))===spec.rom_sha256);
  check('core_identity',sha(await readFile(spec.core))===spec.core_sha256);
  check('replay_identity',sha(await readFile(spec.replay))===spec.replay_sha256);
  const reference=await readFile(spec.reference_rgba);check('reference_identity',sha(reference)===spec.reference_rgba_sha256);
  check('prepared_reference_matches_mame_layout',spec.memory.find(x=>x.address===0xff1020)?.sha256===spec.expected_mame_layout_sha256);
  check('first_load_paused',await load()===true);
  for(const name of ['wrong-rom','wrong-state','wrong-frame']) {
   const item=spec.negative_replays[name];check(name+'.input_identity',sha(await readFile(item.path))===item.sha256);
   const before=await observe();const answer=await invoke('emulator_play_replay',{replayPath:item.path});const after=await observe();
   if(name==='wrong-frame') check(name+'.reported_mismatch',answer.ok===true&&answer.framebuffer_match===false);
   else check(name+'.refused_without_frames',answer.ok===false&&after.frames_run===before.frames_run);
   report.checks.at(-1).answer=answer;
  }
  let lastEpoch=null,lastFrame=null,lastRam=null;
  for(const label of ['original','original-repeat']) {
   check(label+'.load_paused',await load()===true);
   const input=await invoke('emulator_input_observation');
   const answer=await invoke('emulator_play_replay',{replayPath:spec.replay});
   check(label+'.native_replay_framebuffer_matches',answer.ok===true&&answer.frames_recorded===spec.frames&&answer.framebuffer_match===true,{answer});
   const observation=await observe();
   check(label+'.loaded_identity',observation.ok&&observation.rom_sha256===spec.rom_sha256&&observation.disk_matches_loaded&&observation.core_path===spec.core&&observation.frames_run===spec.frames);
   const raw=Buffer.from(observation.framebuffer_rgba??[]);
   check(label+'.exact_original_reference',observation.framebuffer_width===spec.width&&observation.framebuffer_height===spec.height&&raw.equals(reference),{observed_sha256:sha(raw),reference_sha256:sha(reference)});
   const ram=[];
   for(const item of spec.memory) {
    const read=await memory(item.address,item.length);const bytes=Buffer.from(read.bytes??[]);
    check(label+`.memory_${item.address.toString(16)}`,read.ok&&read.total_size>=65536&&bytes.length===item.length&&sha(bytes)===item.sha256,{sha256:sha(bytes),expected:item.sha256});
    ram.push({address:item.address,length:item.length,sha256:sha(bytes)});
    await writeFile(path.join(spec.output,`${label}-${item.address.toString(16)}.bin`),bytes);
   }
   let canvas=null;
   for(let attempts=0;attempts<40;attempts++) {
    canvas=await js(`const c=document.querySelector('[data-testid="viewport-game-canvas"]');if(!c)return null;return {width:c.width,height:c.height,rgba:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),png:c.toDataURL('image/png')};`);
    if(canvas?.width===spec.width&&canvas?.height===spec.height&&Buffer.from(canvas.rgba).equals(raw))break;
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   check(label+'.current_canvas_equals_core',canvas?.width===spec.width&&canvas?.height===spec.height&&Buffer.from(canvas.rgba??[]).equals(raw));
   if(lastEpoch!==null)check(label+'.fresh_epoch',input.epoch!==lastEpoch);
   if(lastFrame)check(label+'.original_original_pixels',raw.equals(lastFrame));
   if(lastRam)check(label+'.original_original_memory',JSON.stringify(ram)===JSON.stringify(lastRam));
   await writeFile(path.join(spec.output,`${label}.rgba`),raw);
   await writeFile(path.join(spec.output,`${label}-canvas.png`),Buffer.from(canvas.png.split(',')[1],'base64'));
   report.runs.push({label,epoch:input.epoch,frames_run:observation.frames_run,rom_sha256:observation.rom_sha256,core_path:observation.core_path,core_label:observation.core_label,framebuffer_sha256:sha(raw),memory:ram});
   lastEpoch=input.epoch;lastFrame=raw;lastRam=ram;
  }
  report.screenshot=await captureScreenshot();
  report.status='PASS_GX_APP_PREPARED_REPLAY_CORRESPONDENCE';
 } catch(error){failure=error;report.error=String(error?.message??error);}
 await writeFile(path.join(spec.output,'result.json'),JSON.stringify(report,null,2)+'\n');
 if(failure)throw failure;
 return report;
}
