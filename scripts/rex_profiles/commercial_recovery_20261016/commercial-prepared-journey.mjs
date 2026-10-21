// QA adapter for the existing semantic UI journey; same native replay/read-only IPC.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=(file,args)=>new Promise((resolve,reject)=>execFile(file,args,{timeout:90000,maxBuffer:1024*1024},(error,stdout,stderr)=>error?reject(new Error(`${error.message}\n${stderr}`)):resolve(stdout)));

export async function verifyCommercialRefusals({config,spec,original,jsa,addCheck}) {
 const directory=path.join(config.output,'negative-publication');await mkdir(directory,{recursive:false});
 const base={rom_path:spec.rom,profile_id:spec.profile_id,instance_offset:spec.declared_region.entry,
  values:{bytes_per_cell:spec.edit.bytes_per_cell},output_dir:directory,request_id:'m3-negative',
  expected_rom_sha256:spec.rom_sha256,region_exits:spec.declared_region.exits,region_selection:'declared_region'};
 const mutated=Buffer.from(original);mutated[spec.declared_region.entry+(config.transfer_offset??16)]^=0x80;
 const mutatedPath=path.join(config.output,'tampered-region.bin');await writeFile(mutatedPath,mutated);
 const resource=Buffer.from(original);resource[config.resource_offset]^=1;
 const resourcePath=path.join(config.output,'tampered-resource.bin');await writeFile(resourcePath,resource);
 for(const [name,change] of Object.entries({wrong_rom:{expected_rom_sha256:'0'.repeat(64)},tampered_resource:{rom_path:resourcePath},tampered_region:{rom_path:mutatedPath,expected_rom_sha256:sha(mutated)},out_of_domain:{values:{bytes_per_cell:3}},no_op:{values:{bytes_per_cell:spec.probe.reference.width}}})){
  const answer=await jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;inv('rex_profile_edit',{request:arguments[0]}).then(v=>done({accepted:true,value:v})).catch(e=>done({accepted:false,refusal:e}));`,[{...base,...change,request_id:`m3-negative-${name}`}]);
  addCheck(`control.${name}.native_publisher_refused`,answer.accepted===false,{answer});
  if(answer.accepted!==false)throw new Error(`negative publication accepted:${name}`);
 }
 addCheck('control.refusals_leave_no_publication', (await readdir(directory)).length===0);
}

export async function runCommercialPrepared({config,rom,etapa,width,js,jsa,readRam,addCheck,report}) {
 if(config.kind==='linear')return runLinearPrepared({config,rom,etapa,width,js,jsa,readRam,addCheck,report});
 const directory=path.join(config.output,etapa);await mkdir(directory,{recursive:false});
 const expectationSpec=JSON.parse(await readFile(config.expectation_spec,'utf8'));
 for(const [file,expected] of Object.entries(expectationSpec.inputs))if(sha(await readFile(file))!==expected)throw new Error(`frozen input changed:${file}`);
 const invoke=(command,args={})=>jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;inv(arguments[0],arguments[1]).then(done).catch(e=>done({error:String(e)}));`,[command,args]);
 const loaded=await jsa(`const done=arguments[arguments.length-1];window.__RDS_E2E__.loadRomForEmulation(arguments[0],{startPaused:true}).then(done).catch(e=>done({error:String(e)}));`,[rom]);
 const check=(name,pass,detail={})=>{addCheck(`${etapa}.${name}`,pass,detail);if(!pass)throw new Error(`${etapa}.${name}`);};
 check('loaded_paused',loaded===true);
 const identity=await invoke('emulator_observe');const input=await invoke('emulator_input_observation');
 check('loaded_identity',identity.ok&&identity.rom_sha256===sha(await readFile(rom))&&identity.disk_matches_loaded&&identity.core_path===config.core);
 report.runtime_identities??=[];report.runtime_identities.push({etapa,ok:identity.ok,rom_sha256:identity.rom_sha256,rom_size:identity.rom_size,disk_matches_loaded:identity.disk_matches_loaded,core_path:identity.core_path,frames_run:identity.frames_run,epoch:input.epoch});
 const template=JSON.parse(await readFile(config.replay,'utf8'));
 const makeReplay=async(n)=>{
  const replay={...template,rom_path:rom,frames:template.frames.slice(0,n)};
  if(n===179)replay.final_framebuffer=Array.from(await readFile(config.original179_rgb565));
  const file=path.join(directory,`prepared-${n}.rds-replay`);await writeFile(file,JSON.stringify(replay)+'\n');return file;
 };
 const prefix=await invoke('emulator_play_replay',{replayPath:await makeReplay(179)});
 check('prefix_179_completed',prefix.ok===true&&prefix.frames_recorded===179,{prefix});
 if(width===1)check('prefix_original_reference_exact',prefix.framebuffer_match===true);
 const controls=await readRam(0xff0000,65536);check('producer_ram_read',controls.ok&&controls.bytes.length===65536);
 const ramPath=path.join(directory,'producer179.ram');await writeFile(ramPath,Buffer.from(controls.bytes));
 const expectedPath=path.join(directory,'expected-before-final-capture.json');
 await run('rtk',['proxy','python3',config.constructor,config.expectation_spec,ramPath,String(width),expectedPath]);
 const expected=JSON.parse(await readFile(expectedPath,'utf8'));
 check('predicted_layout_and_producer_sat',expected.capture_input===null&&expected.pixels.length>0);
 const expectationHash=sha(await readFile(expectedPath));
 // Expected pixels now exist on disk; only then execute/read final180 image.
 const answer=await invoke('emulator_play_replay',{replayPath:await makeReplay(180)});
 check('final180_completed',answer.ok===true&&answer.frames_recorded===180,{answer});
 check('frozen_original_baseline_comparison',answer.framebuffer_match===(width===1));
 const observation=await invoke('emulator_observe');const raw=Buffer.from(observation.framebuffer_rgba??[]);
 check('final_identity_and_frames',observation.ok&&observation.rom_sha256===identity.rom_sha256&&observation.disk_matches_loaded&&observation.frames_run===359&&observation.framebuffer_width===320&&observation.framebuffer_height===224);
 check('expectation_unchanged_after_capture',sha(await readFile(expectedPath))===expectationHash);
 const matches=([x,y,r,g,b])=>{const at=(y*320+x)*4;return raw[at]===r&&raw[at+1]===g&&raw[at+2]===b&&raw[at+3]===255;};
 const wrong=expected.pixels.filter(p=>!matches(p));check('independent_conditional_resource_pixels',wrong.length===0,{pixels:expected.pixels.length,mismatches:wrong.slice(0,8),tolerance:0});
 const altered=[...expected.pixels[0]];altered[2]^=1;check('wrong_visual_expectation_refused',!matches(altered));
 if(width===2)check('old_width_conditional_visual_refused',expected.old_width_wrong_pixels.length>0&&expected.old_width_wrong_pixels.every(p=>!matches(p)),{discriminating_pixels:expected.old_width_wrong_pixels.length});
 const actualRam=await readRam(0xff0000,65536);check('final_ram_read',actualRam.ok&&actualRam.bytes.length===65536);
 const world=await readFile(expectationSpec.world_layouts[String(width)]);check('final_world_layout_exact',Buffer.from(actualRam.bytes.slice(0,16384)).equals(world));
 let canvas=null;
 for(let i=0;i<40;i++){
  canvas=await js(`const c=document.querySelector('[data-testid="viewport-game-canvas"]');return c?{width:c.width,height:c.height,rgba:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),png:c.toDataURL('image/png')}:null;`);
  if(canvas?.width===320&&canvas?.height===224&&Buffer.from(canvas.rgba).equals(raw))break;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 check('current_canvas_equals_core',canvas?.width===320&&canvas?.height===224&&Buffer.from(canvas.rgba??[]).equals(raw));
 await writeFile(path.join(directory,'actual180.rgba'),raw);await writeFile(path.join(directory,'actual180.ram'),Buffer.from(actualRam.bytes));
 await writeFile(path.join(directory,'canvas180.png'),Buffer.from(canvas.png.split(',')[1],'base64'));
 report.commercial_runs??=[];report.commercial_runs.push({etapa,width,directory,expectation_sha256:expectationHash,framebuffer_sha256:sha(raw),resource_pixels:expected.pixels.length,conditional_causal_pixels:expected.old_width_wrong_pixels.length,epoch:input.epoch,limits:expected.limits});
 return {memory:Buffer.from(actualRam.bytes.slice(0x1020,0x1020+12224)),frame:raw};
}

async function runLinearPrepared({config,rom,etapa,width,js,jsa,readRam,addCheck,report}) {
 const directory=path.join(config.output,etapa);await mkdir(directory,{recursive:false});
 const check=(name,pass,detail={})=>{addCheck(`${etapa}.${name}`,pass,detail);if(!pass)throw new Error(`${etapa}.${name}`);};
 for(const [file,expected] of Object.entries(config.reference_inputs))check('frozen_reference_identity',sha(await readFile(file))===expected,{file});
 const invoke=(command,args={})=>jsa(`const done=arguments[arguments.length-1];const inv=window.__TAURI__?.core?.invoke??window.__TAURI_INTERNALS__?.invoke;inv(arguments[0],arguments[1]).then(done).catch(e=>done({error:String(e)}));`,[command,args]);
 const loaded=await jsa(`const done=arguments[arguments.length-1];window.__RDS_E2E__.loadRomForEmulation(arguments[0],{startPaused:true}).then(done).catch(e=>done({error:String(e)}));`,[rom]);
 check('loaded_paused',loaded===true);
 const identity=await invoke('emulator_observe');const input=await invoke('emulator_input_observation');
 check('loaded_identity',identity.ok&&identity.rom_sha256===sha(await readFile(rom))&&identity.disk_matches_loaded&&identity.core_path===config.core);
 report.runtime_identities??=[];report.runtime_identities.push({etapa,ok:identity.ok,rom_sha256:identity.rom_sha256,rom_size:identity.rom_size,disk_matches_loaded:identity.disk_matches_loaded,core_path:identity.core_path,frames_run:identity.frames_run,epoch:input.epoch});
 const expected=await readFile(config.destination_references[String(width)]);
 // The independent destination reference exists before executing the modified ROM.
 const referenceHash=sha(expected);await writeFile(path.join(directory,'expected-before-execution.bin'),expected);
 const template=JSON.parse(await readFile(config.replay,'utf8'));const replay={...template,rom_path:rom};
 const replayPath=path.join(directory,'prepared.rds-replay');await writeFile(replayPath,JSON.stringify(replay)+'\n');
 const answer=await invoke('emulator_play_replay',{replayPath});
 check('prepared_one_frame_completed',answer.ok===true&&answer.frames_recorded===1,{answer});
 if(width===config.original_width)check('original_same_core_video_reference_exact',answer.framebuffer_match===true);
 const observed=await invoke('emulator_observe');
 check('final_identity_and_frames',observed.ok&&observed.rom_sha256===identity.rom_sha256&&observed.disk_matches_loaded&&observed.frames_run===1);
 const ram=await readRam(config.destination,config.span);check('destination_span_read',ram.ok&&ram.bytes.length===config.span);
 const actual=Buffer.from(ram.bytes);check('independent_conditional_memory_exact',actual.equals(expected),{expected_sha256:referenceHash,actual_sha256:sha(actual),span:config.span});
 check('original_reference_unchanged',sha(await readFile(config.destination_references[String(width)]))===referenceHash);
 const raw=Buffer.from(observed.framebuffer_rgba??[]);let canvas=null;
 for(let i=0;i<40;i++){
  canvas=await js(`const c=document.querySelector('[data-testid="viewport-game-canvas"]');return c?{width:c.width,height:c.height,rgba:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),png:c.toDataURL('image/png')}:null;`);
  if(canvas?.width===observed.framebuffer_width&&canvas?.height===observed.framebuffer_height&&Buffer.from(canvas.rgba).equals(raw))break;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 check('current_canvas_equals_core',raw.length>0&&canvas?.width===observed.framebuffer_width&&canvas?.height===observed.framebuffer_height&&Buffer.from(canvas.rgba??[]).equals(raw));
 await writeFile(path.join(directory,'destination.bin'),actual);await writeFile(path.join(directory,'actual.rgba'),raw);
 await writeFile(path.join(directory,'canvas.png'),Buffer.from(canvas.png.split(',')[1],'base64'));
 report.commercial_runs??=[];report.commercial_runs.push({etapa,width,directory,expectation_sha256:referenceHash,framebuffer_sha256:sha(raw),epoch:input.epoch,limits:'Declared contiguous-copy memory effect only. Original same-core video baseline and core/canvas correspondence; no independent edited visual or gameplay-usability claim. External CPU trace is a different session/runtime.'});
 return {memory:actual,frame:raw};
}
