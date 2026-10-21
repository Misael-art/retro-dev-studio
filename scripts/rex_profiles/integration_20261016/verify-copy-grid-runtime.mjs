// External QA only: typed production reconstructions + independent indexed-memory reference.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
const [specFile,baseFile,rebuiltDir,outDir]=process.argv.slice(2);
if(!outDir || !resolve(outDir).startsWith("/home/misael/rds-scratch/")) throw Error("spec base rebuilt-dir new-scratch-output required");
const out=resolve(outDir);await mkdir(out);
const spec=JSON.parse(await readFile(specFile,"utf8"));
const sha=b=>createHash("sha256").update(b).digest("hex");
const require=(ok,m)=>{if(!ok)throw Error(m);};
const report={schema:"rex-copy-grid-runtime/v1",status:"running",started:new Date().toISOString(),spec,checks:[],runs:[],scope:"extracted region under explicitly supplied synthetic caller; no game reachability/render/audio claim"};
const record=(name,ok,detail={})=>{report.checks.push({name,pass:!!ok,...detail});require(ok,name);};
const run=(program,args)=>{const r=spawnSync(program,args,{encoding:"utf8",timeout:60000,maxBuffer:8*1024*1024,cwd:out});require(r.status===0,`${program}: ${r.stderr||r.error}`);return r.stdout;};
try {
  const input=await readFile(baseFile);record("input_identity",sha(input)===spec.input_sha256,{observed:sha(input)});
  const files={original:resolve(baseFile),reconstructed:resolve(rebuiltDir,"original-rebuilt.bin"),modified:resolve(rebuiltDir,"published-copy.bin"),modified_reconstructed:resolve(rebuiltDir,"modified-rebuilt.bin")};
  const images={};for(const [name,file]of Object.entries(files))images[name]=await readFile(file);
  record("typed_original_equal",images.original.equals(images.reconstructed));
  record("typed_modified_equal",images.modified.equals(images.modified_reconstructed));
  const diff=[];for(let i=0;i<input.length;i++)if(input[i]!==images.modified[i])diff.push(i);
  record("only_width_byte_changed",JSON.stringify(diff)===JSON.stringify([spec.entry+16]),{offsets:diff});
  const host="/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/toolchains";
  const bin=`${host}/m68k-elf/bin/m68k-elf-`;
  const core=`${host}/libretro/cores/blastem_libretro.so`;
  const lab=process.env.RDS_RESEARCH_ROOT??"/home/misael/Projects/REX-REA-LAB-2026-10-15";
  const probeSource=`${lab}/scripts/rex_profiles/rea_lab_20261015/libretro-memory-probe.c`;
  const header="/home/misael/.cache/retrodevstudio/research/rea_lab_20261015/libretro/libretro.h";
  record("independent_core_pin",sha(await readFile(core))==="fdaa3d392ab071c52e8b01c7df4c5642aa00c048a737f4bd3abce66bebd855ba");
  record("libretro_header_pin",sha(await readFile(header))==="bd3398d29c3763d18617087020ff56b5450a48a63123403a4b674f8e79947acb");
  report.probe_source_sha256=sha(await readFile(probeSource));
  run("cc",["-std=c11","-O2","-Wall","-Wextra","-Werror",`-I${dirname(header)}`,probeSource,"-ldl","-o",`${out}/probe`]);
  const source=await readFile(resolve(root,"data/rex_profiles/integration_20261016/copy_grid.S"),"utf8");
  const captures={};
  const expected=width=>{
    const ram=Buffer.alloc(65536);for(let i=0;i<8192;i++)ram[0x4000+i]=(i*37+11)&255;
    const seed=Buffer.from(ram);
    for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.columns;col++)for(let b=0;b<width;b++)
      ram[(spec.destination&65535)+row*(spec.columns*width+spec.gap)+col*width+b]=seed[(spec.source&65535)+(row*spec.columns+col)*width+b];
    ram.writeUInt32BE(0x434F5059,0x3FE0);return ram;
  };
  for(const [name,file]of Object.entries(files)) {
    // Harness embeds a region for execution, never implements/reconstructs it.
    const asm=source.split(".org 0x400,0")[0].replace(".long 0,0x5FF,",`.long 0,0x${(spec.entry+32-1).toString(16)},`)+`\n.org 0x${spec.entry.toString(16)},0\ncopy_entry:\n.incbin ${JSON.stringify(file)},${spec.entry},30\nrts\n`;
    await writeFile(`${out}/${name}.S`,asm);
    run(`${bin}as`,["-m68000","-o",`${out}/${name}.o`,`${out}/${name}.S`]);
    run(`${bin}ld`,["-T",resolve(root,"data/rex_profiles/rea_lab_20261015/semantic_gate_reversed_cmp_holdout.ld"),"-e","0x200","-o",`${out}/${name}.elf`,`${out}/${name}.o`]);
    run(`${bin}objcopy`,["-O","binary","--only-section=.image",`${out}/${name}.elf`,`${out}/${name}.bin`]);
    const dis=run(`${bin}objdump`,["-D",`--start-address=${spec.entry}`,`--stop-address=${spec.entry+30}`,`${out}/${name}.elf`]);
    await writeFile(`${out}/${name}.objdump.txt`,dis);
    const sites=[...dis.matchAll(/^\s*([0-9a-f]+):\s+.*\t([a-z].*)$/gm)].map(m=>parseInt(m[1],16));
    record(`${name}.binutils_boundaries`,JSON.stringify(sites)===JSON.stringify([0,6,12,14,16,18,22,26].map(i=>spec.entry+i)),{sites});
    const result=run(`${out}/probe`,[core,`${out}/${name}.bin`,"--dump-range","0","65536"]);
    await writeFile(`${out}/${name}.probe.log`,result);
    const capture=JSON.parse(result.split(/\r?\n/).find(line=>line.startsWith('{"offset":'))??"null");require(capture.frames===16 && capture.length===65536,"probe frame/length mismatch");
    const bytes=Buffer.from(capture.bytes_hex,"hex");captures[name]=bytes;
    await writeFile(`${out}/${name}.wram.bin`,bytes);
    record(`${name}.completion_sentinel`,bytes.readUInt32BE(0x3FE0)===0x434F5059);
    const reference=expected(name.startsWith("modified")?2:1),differences=[];
    for(let i=0;i<65536;i++)if(!(i>=0xEE00 && i<0xFF00) && bytes[i]!==reference[i])differences.push(i);
    record(`${name}.all_relevant_wram_matches_independent_reference`,differences.length===0,{differences:differences.slice(0,16)});
    report.runs.push({name,image_sha256:sha(images[name]),harness_sha256:sha(await readFile(`${out}/${name}.bin`)),wram_sha256:sha(bytes),window_sha256:sha(bytes.subarray(0x1020,0x3FE0)),frames:16});
    await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  }
  record("original_equals_reconstruction",captures.original.equals(captures.reconstructed));
  record("modified_equals_reconstruction",captures.modified.equals(captures.modified_reconstructed));
  const changed=[];for(let i=0;i<65536;i++)if(!(i>=0xEE00 && i<0xFF00) && captures.original[i]!==captures.modified[i])changed.push(i);
  record("causal_first_difference",changed[0]===(spec.destination&65535)+spec.columns,{first:changed[0],count:changed.length});
  report.status="passed_with_limits";
} catch(e) {report.status="failed";report.failure=String(e.stack??e);process.exitCode=1;}
report.finished=new Date().toISOString();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.status,checks:report.checks.length,report:`${out}/report.json`,failure:report.failure??null}));
