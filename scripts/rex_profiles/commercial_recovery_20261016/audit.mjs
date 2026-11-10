import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {encoding:'utf8'}).trim();
const integration = '/home/misael/Projects/REX-INTEGRATION-2026-10-05';
const research = '/home/misael/Projects/REX-REA-LAB-2026-10-15';
const result = {schema:'rex-commercial-checkpoint-audit/v1', generated_at:new Date().toISOString(),
  root, head:git(root,'rev-parse','HEAD'), checkouts:[integration,research].map(cwd=>({cwd,
    head:git(cwd,'rev-parse','HEAD'),branch:git(cwd,'branch','--show-current'),
    status:git(cwd,'status','--porcelain=v1')})), checks:[],
  scope:'Integrity and availability only; no functional gate or inherited test rerun.'};
function check(source, p, expected) {
  const full = path.isAbsolute(p) ? p : path.resolve(root,p);
  const item = {source,path:p,expected_sha256:expected};
  if (!existsSync(full)) item.status='ABSENT';
  else if (!statSync(full).isFile()) item.status='NOT_FILE';
  else {item.actual_sha256=sha(full);item.bytes=statSync(full).size;
    item.status=item.actual_sha256===expected?'MATCH':'MISMATCH';
    if(item.status==='MISMATCH' && ['docs/06_AI_MEMORY_BANK.md','docs/06_CURRENT_WAVE_AI_BANK.md'].includes(p)) {
      const original=execFileSync('git',['-C',root,'show','03ddc59de38cc3d9c448b893da72a3efd575030a:'+p]);
      item.checkpoint_sha256=createHash('sha256').update(original).digest('hex');
      if(item.checkpoint_sha256===expected) item.status='DOCUMENT_ADVANCED';
    }}
  result.checks.push(item);
}
for (const rel of [
  'data/rex_profiles/integration_20261016/evidence/visual-copy-v2/FROZEN-INPUTS-SHA256.json',
  'data/rex_profiles/integration_20261016/evidence/visual-copy/TOOL-AND-APP-SHA256.json',
  'data/rex_profiles/integration_20261016/evidence/visual-copy-v2/FINAL-SHA256.json']) {
  const manifest=JSON.parse(readFileSync(path.join(root,rel),'utf8'));
  for (const [p,digest] of Object.entries(manifest)) {
    if (typeof digest==='string' && /^[a-f0-9]{64}$/.test(digest)) check(rel,p,digest);
  }
}
const manifestRel='data/rex_profiles/integrator/aplib/evidence/2026-09-27-entrega2-indice-0-na-barra/manifest.json';
const legacy=JSON.parse(readFileSync(path.join(root,manifestRel),'utf8'));
for (const [name,entry] of Object.entries(legacy.arquivos)) check(manifestRel,path.join(path.dirname(manifestRel),name),entry.sha256);
const rom='/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin';
check('sonic_consumers.rs ROM pin',rom,'c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb');
for (const rel of ['src-tauri/target-test/validation/host-readiness.json',
  'docs/rex_profiles/rea_lab_20261015/STATUS.md', 'docs/rex_profiles/rea_lab_20261015/HANDOFF.md',
  'docs/rex_profiles/rea_lab_20261015/INTEGRATOR-PACKAGE.md']) {
  const p=rel.includes('rea_lab')?path.join(research,rel):path.join(root,rel);
  result.checks.push({source:'availability',path:p,status:existsSync(p)?'PRESENT':'ABSENT',
    ...(existsSync(p)?{actual_sha256:sha(p)}:{})});
}
result.counts = Object.fromEntries(['MATCH','MISMATCH','ABSENT','NOT_FILE','PRESENT','DOCUMENT_ADVANCED'].map(s=>[s,result.checks.filter(c=>c.status===s).length]));
const out=process.argv[2];
if(out){ if(existsSync(out)) throw new Error('Refusing existing output');writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'}); }
else process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(out) console.log(JSON.stringify({out,sha256:sha(out),counts:result.counts}));
if(result.counts.MISMATCH||result.counts.NOT_FILE) process.exitCode=1;
