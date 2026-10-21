// External QA only. Existing paused frame/input/WRAM/framebuffer observers; no PC hook.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const sha=b=>createHash("sha256").update(b).digest("hex");
export async function attemptByor({config,core,jsa,readRam,addCheck,report}) {
  const out=config.output; await mkdir(out,{recursive:false});
  const invoke=(command,args={})=>jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;inv(arguments[0],arguments[1]).then(done).catch(e=>done({error:String(e)}));`,[command,args]);
  const neutral=Object.fromEntries("b y select start up down left right a x l r".split(" ").map(k=>[k,false]));
  const plain=await readFile(config.decoded_resource);
  const episodes=[];
  for(const variant of ["original","original-repeat","copy"]) {
    const file=variant==="copy"?config.copy:config.original;
    const expected=variant==="copy"?config.copy_sha256:config.original_sha256;
    if(sha(await readFile(file))!==expected) throw new Error("BYOR input identity mismatch");
    const loaded=await jsa(`const done=arguments[arguments.length-1];window.__RDS_E2E__.loadRomForEmulation(arguments[0],{startPaused:true}).then(done).catch(e=>done({error:String(e)}));`,[file]);
    if(loaded!==true) throw new Error("BYOR load failed");
    const episode={variant,rom_sha256:expected,samples:[],input_protocol:"backend emulator_send_input with ACK + emulator_input_observation; paused UI loop; exact manual frame batches",trace:await invoke("emulator_get_execution_trace")};
    const steps=config.steps??[{name:"neutral180",frames:180},{name:"start1",frames:1,key:"start"},{name:"neutral180afterStart",frames:180},{name:"right120",frames:120,key:"right"},{name:"neutral60",frames:60}];
    for(const step of steps) {
      const ack=await invoke("emulator_send_input",{joypad:{...neutral,...(step.key?{[step.key]:true}:{})},sessionEpoch:null});
      const run=await invoke("emulator_run_frames",{frames:step.frames});
      const observation=await invoke("emulator_observe");
      const input=await invoke("emulator_input_observation");
      const consumed=input.transitions?.find(t=>t.generation===ack.generation);
      if(input.epoch!==ack.epoch || consumed?.first_polled_frame!==ack.applied_at_frame+1 || consumed?.last_polled_frame!==observation.frames_run || !Object.keys(neutral).every(k=>consumed.joypad[k]===Boolean(step.key===k))) throw new Error("BYOR input generation was not consumed as declared");
      const observedCoreHash=sha(await readFile(observation.core_path));
      if(observation.core_path!==core.path || observedCoreHash!==core.sha256) throw new Error("BYOR core identity mismatch");
      const source=await readRam(0xff4000,8192),dest=await readRam(0xff1020,12224);
      const rgba=Buffer.from(observation.framebuffer_rgba??[]);
      if(!ack.ok||!run.ok||!source.ok||!dest.ok||!observation.ok||observation.rom_sha256!==expected||!observation.disk_matches_loaded) throw new Error(`BYOR observer identity/input/run failed: ${JSON.stringify({ack,run,sourceOK:source.ok,destOK:dest.ok,identity:observation.rom_sha256})}`);
      const stem=path.join(out,`${variant}-${step.name}`);
      await writeFile(stem+".rgba",rgba);await writeFile(stem+"-source.bin",Buffer.from(source.bytes));await writeFile(stem+"-destination.bin",Buffer.from(dest.bytes));
      episode.samples.push({step,ack,input,frames_run:observation.frames_run,rom_sha256:observation.rom_sha256,core_path:observation.core_path,core_sha256:observedCoreHash,framebuffer_width:observation.framebuffer_width,framebuffer_height:observation.framebuffer_height,framebuffer_sha256:sha(rgba),source_sha256:sha(Buffer.from(source.bytes)),destination_sha256:sha(Buffer.from(dest.bytes)),source_equals_static_resource:plain.equals(Buffer.from(source.bytes).subarray(0,4096)),captures:stem});
    }
    await invoke("emulator_send_input",{joypad:neutral,sessionEpoch:null});
    episodes.push(episode);
    await writeFile(path.join(out,"episodes.json"),JSON.stringify(episodes,null,2));
  }
  const same=episodes[0].samples.every((a,i)=>a.framebuffer_sha256===episodes[1].samples[i].framebuffer_sha256&&a.source_sha256===episodes[1].samples[i].source_sha256&&a.destination_sha256===episodes[1].samples[i].destination_sha256);
  const changed=episodes[0].samples.filter((a,i)=>a.framebuffer_sha256!==episodes[2].samples[i].framebuffer_sha256).map(a=>a.step.name);
  const sourceMatched=episodes.some(e=>e.samples.some(s=>s.source_equals_static_resource));
  const result={schema:"rex-byor-visual-episode/v1",status:"BLOCKED_RESOURCE_TO_PRESENTATION_PROOF",original_original_reproducible:same,changed_framebuffer_phases:changed,static_resource_matched_at_sample:sourceMatched,exact_pc_observed:episodes.some(e=>e.trace.available),episodes,limit:"Frame-end samples cannot establish exact routine/caller arguments. Static resource, live selection and downstream VDP consumer are not causally linked by this episode. Commercial part is not complete."};
  addCheck("byor.declared_episode_attempted_with_loaded_identity",episodes.length===3&&episodes.every(e=>e.samples.length===5));
  report.byor=result;
  await writeFile(path.join(out,"result.json"),JSON.stringify(result,null,2));
}
