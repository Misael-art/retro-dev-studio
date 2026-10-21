#!/usr/bin/env python3
"""First frozen commercial observation in external MAME; no product/core edits."""
import hashlib,importlib.util,json,os,subprocess,sys,time,zipfile
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 if len(sys.argv)!=2 or not sys.argv[1].startswith('commercial-'):raise SystemExit('usage: run-commercial.py commercial-<fresh-id>')
 ident=sys.argv[1]
 freeze=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-instrument-freeze.json').read_text())
 for name,digest in freeze['files'].items():
  if sha(ROOT/name)!=digest:raise SystemExit('frozen instrument changed: '+name)
 qual=json.loads(Path(freeze['qualification_summary']).read_text())
 if not qual['passed'] or qual['instrument_sha256']!=sha(HERE/'observe.lua'):raise SystemExit('instrument not qualified')
 target=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m1-freeze.json').read_text())
 rom=Path('/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin')
 if sha(rom)!=target['rom_sha256']:raise SystemExit('ROM identity differs')
 work=SCRATCH/ident;work.mkdir(exist_ok=False)
 for directory in ['cfg','nvram','snap','state','comments','diff']: (work/directory).mkdir()
 with zipfile.ZipFile(work/'cart.zip','w',zipfile.ZIP_STORED) as z:z.writestr('game.bin',rom.read_bytes())
 events=work/'events.jsonl';mame=Path('/usr/lib/mame/mame')
 if sha(mame)!=freeze['mame_elf_sha256']:raise SystemExit('MAME identity changed')
 env=dict(os.environ,SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy',REX_RUN_ID=ident,REX_ROM_SHA=sha(rom),REX_INSTRUMENT_SHA=sha(HERE/'observe.lua'),REX_EVENTS=str(events),REX_MAX_FRAMES='1290',REX_MAX_EVENTS='250000',REX_MODE='commercial',REX_SNAP_DIR=str(work/'snap'))
 cmd=[str(mame),'genesis','-cart',str(work/'cart.zip'),'-noreadconfig','-noplugins','-skip_gameinfo','-hashpath',str(work),'-homepath',str(work),'-cfg_directory',str(work/'cfg'),'-nvram_directory',str(work/'nvram'),'-state_directory',str(work/'state'),'-comment_directory',str(work/'comments'),'-diff_directory',str(work/'diff'),'-snapshot_directory',str(work/'snap'),'-debug','-debugger','none','-video','none','-sound','none','-nothrottle','-autoboot_delay','0','-autoboot_script',str(HERE/'observe.lua'),'-seconds_to_run','30']
 manifest={'schema':'rex-commercial-run/v1','id':ident,'hypothesis':'Prepared special-stage entry reaches known Enigma and copy loop with pinned stream; later read/VDP writes collected without inferring framebuffer cause','command':cmd,'env':{k:v for k,v in env.items() if k.startswith('REX_')},'budget_seconds':240,'rom_sha256':sha(rom),'mame_sha256':sha(mame),'target_freeze_sha256':sha(ROOT/'data/rex_profiles/commercial_recovery_20261016/m1-freeze.json'),'instrument_freeze_sha256':sha(ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-instrument-freeze.json')}
 (work/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 start=time.monotonic()
 with (work/'runtime.log').open('w') as log:
  try:proc=subprocess.run(cmd,cwd=work,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=240);rc=proc.returncode
  except subprocess.TimeoutExpired:rc=124
 report={'schema':'rex-commercial-observation/v1','id':ident,'exit_code':rc,'elapsed_seconds':time.monotonic()-start,'runtime':'MAME 0.289 external; separate from app GX','rom_sha256':sha(rom),'manifest_sha256':sha(work/'manifest.json'),'log_sha256':sha(work/'runtime.log'),'status':'BLOCKED','limits':['No app/GX session correspondence measured yet','Bus taps do not model VDP internal DMA transfers','Prepared state is caller-declared, not natural gameplay','No edited commercial ROM executed']}
 if events.exists():
  report['events_sha256']=sha(events);report['events_bytes']=events.stat().st_size
  try:
   spec=importlib.util.spec_from_file_location('qualifier',HERE/'run-observer.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
   ev=[json.loads(line) for line in events.read_text().splitlines()]
   q.validate(ev,ident,sha(rom))
   assert rc==0,'nonzero runtime exit'
   assert [(e['frame'],e['active']) for e in ev if e['kind']=='input_transition']==[(500,True),(510,False)],'input transition boundary'
   assert ev[-1]['frame']==1290,'episode frame budget'
   report['counts']={kind:sum(e['kind']==kind for e in ev) for kind in sorted(set(e['kind'] for e in ev))}
   report['entries']=[e for e in ev if e['kind'] in ['enigma_entry','enigma_return','copy_entry','copy_return','prepared_state','state_sample']]
   for kind in ['decompressed_snapshot','copy_snapshot']:
    samples=[e for e in ev if e['kind']==kind]
    report[kind]=[{'seq':e['seq'],'frame':e['frame'],'address':e['address'],'bytes':len(e['hex'])//2,'sha256':hashlib.sha256(bytes.fromhex(e['hex'])).hexdigest()} for e in samples]
   entry=[e for e in ev if e['kind']=='enigma_entry' and e['a0']==0x65432 and e['a1']==0xff4000 and (e['d0']&65535)==0 and e['stack_top_long']==0x1b6d8]
   decoded=report['decompressed_snapshot']
   assert entry,'frozen resource/caller arguments not observed'
   assert any(e['sha256']==target['resources']['layout_plain_sha256'] for e in decoded),'decoded buffer differs from pin'
   assert report['counts'].get('copy_entry') and report['counts'].get('copy_return'),'copy loop not reached'
   report['status']='OBSERVED_ENIGMA_AND_COPY_IN_EXTERNAL_MAME'
  except (ValueError,AssertionError,KeyError,IndexError) as error:report['error']=str(error)
 (work/'result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in ['entries']},indent=2))
 return 0 if report['status']!='BLOCKED' else 1
if __name__=='__main__':raise SystemExit(main())
