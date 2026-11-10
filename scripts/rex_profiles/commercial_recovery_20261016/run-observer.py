#!/usr/bin/env python3
"""Qualify the existing external MAME debugger; all raw outputs stay private."""
import hashlib,json,os,subprocess,sys,time,zipfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')
MAME=Path('/usr/lib/mame/mame')
MAME_SHA='fcb54790e1837ed653020dc25a4e51d9ba7288d789cf556299d5d4d2cf2f3bc1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fixture(variant):
 b=bytearray(0x1000)
 def put(a,h):b[a:a+len(bytes.fromhex(h))]=bytes.fromhex(h)
 put(0,'00fffe0000000200')
 b[0x100:0x110]=b'SEGA MEGA DRIVE '
 b[0x1f0:0x1f3]=b'USA'
 put(0x1a0,'0000000000000fff00ff000000ffffff')
 # Disable interrupts, wait for observer start latch, set distinct arguments.
 code='46fc27004a3900ff000067f8'
 source=0x510 if variant=='other-args' else 0x500
 dest=0xff0300 if variant=='other-args' else 0xff0200
 code+=f'207c{source:08x}227c{dest:08x}'
 code+='4e714e714e71' if variant=='no-call' else '4eb900000300'
 ret=0x200+len(bytes.fromhex(code))
 code+='33fc8f0200c0000423fc4000000000c0000433fc123400c0000023fcc000000000c0000433fc000e00c00000'
 code+='23fcdeadbeef00ff010060fe'
 put(0x200,code);put(0x300,'12d812d812d812d84e75');put(0x500,'12345678');put(0x510,'a1b2c3d4')
 checksum=sum(int.from_bytes(b[i:i+2],'big') for i in range(0x200,len(b),2))&0xffff
 b[0x18e:0x190]=checksum.to_bytes(2,'big')
 return bytes(b),ret,source,dest

def validate(events,run_id,rom_sha):
 if not events or any(e['run_id']!=run_id or e['rom_sha256']!=rom_sha for e in events):raise ValueError('identity mismatch')
 if any(e['instrument_sha256']!=sha(HERE/'observe.lua') for e in events):raise ValueError('instrument identity mismatch')
 if [e['seq'] for e in events]!=list(range(1,len(events)+1)):raise ValueError('sequence gap')
 if events[0]['kind']!='collection_start' or events[-1]['kind']!='collection_end':raise ValueError('incomplete collection')
 if events[-1]['dropped'] or not events[-1]['complete']:raise ValueError('event loss')
 return True

def run_case(parent,variant):
 work=parent/variant;work.mkdir()
 b,ret,source,dest=fixture(variant)
 rom=work/'fixture.bin';rom.write_bytes(b)
 with zipfile.ZipFile(work/'cart.zip','w',zipfile.ZIP_STORED) as z:z.writestr('fixture.bin',b)
 ident=parent.name+'-'+variant;events=work/'events.jsonl'
 env=dict(os.environ,SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy',REX_RUN_ID=ident,REX_ROM_SHA=sha(rom),REX_INSTRUMENT_SHA=sha(HERE/'observe.lua'),REX_EVENTS=str(events),REX_RETURN=str(ret),REX_MAX_FRAMES='5',REX_MODE='author',REX_MAX_EVENTS='2' if variant=='incomplete' else '1000')
 cmd=[str(MAME),'genesis','-cart',str(work/'cart.zip'),'-noreadconfig','-noplugins','-skip_gameinfo','-hashpath',str(work),'-homepath',str(work),'-cfg_directory',str(work/'cfg'),'-nvram_directory',str(work/'nvram'),'-snapshot_directory',str(work/'snap'),'-debug','-debugger','none','-video','none','-sound','none','-nothrottle','-autoboot_delay','0','-autoboot_script',str(HERE/'observe.lua'),'-seconds_to_run','8']
 if parent.name.startswith('qualify-debug'): cmd=['/usr/sbin/gdb','-batch','-ex','run','-ex','bt','--args',*cmd]
 manifest={'id':ident,'variant':variant,'hypothesis':'known JSR, args, buffer accesses and VDP writes must discriminate controls','command':cmd,'env':{k:v for k,v in env.items() if k.startswith('REX_')},'budget_seconds':90,'rom_sha256':sha(rom),'mame_sha256':sha(MAME),'instrument_sha256':sha(HERE/'observe.lua'),'expected':{'entry_count':0 if variant=='no-call' else 1,'a0':source,'a1':dest,'return':ret,'destination_hex':'a1b2c3d4' if variant=='other-args' else '12345678'}}
 (work/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 start=time.monotonic()
 with (work/'runtime.log').open('w') as log:
  try:result=subprocess.run(cmd,cwd=work,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=90);rc=result.returncode
  except subprocess.TimeoutExpired:rc=124
 result={'id':ident,'exit_code':rc,'elapsed_seconds':time.monotonic()-start,'log_sha256':sha(work/'runtime.log'),'events_exist':events.exists()}
 if rc==0 and events.exists():
  try:
   ev=[json.loads(s) for s in events.read_text().splitlines()]
   if variant=='incomplete':
    try:validate(ev,ident,sha(rom))
    except ValueError:result['qualified']=True;result['interpretation']='incomplete capture correctly refused'
    else:raise ValueError('incomplete capture accepted')
   else:
    validate(ev,ident,sha(rom))
    entries=[e for e in ev if e['kind']=='entry']
    assert len(entries)==manifest['expected']['entry_count'],f'entry count {len(entries)}'
    if entries:
     e=entries[0];assert (e['a0'],e['a1'],e['stack_top_long'])==(source,dest,ret),'entry arguments or stack'
     snap=[e for e in ev if e['kind']=='destination_snapshot'];assert snap[-1]['hex']==manifest['expected']['destination_hex'],'output bytes'
     reads=[e for e in ev if e['kind']=='read'];writes=[e for e in ev if e['kind']=='write' and dest<=e['address']<dest+4]
     assert len(reads)==4 and len(writes)==4,f'access count {len(reads)}/{len(writes)}'
     assert [e['instruction_pc'] for e in reads]==[0x300,0x302,0x304,0x306],'read instruction identity'
     assert [e['instruction_pc'] for e in writes]==[0x300,0x302,0x304,0x306],'write instruction identity'
     def selected(e):return (e['data']>>8)&255 if e['mask']==0xff00 else e['data']&255
     assert bytes(map(selected,reads)).hex()==manifest['expected']['destination_hex'],'read data/mask'
     assert bytes(map(selected,writes)).hex()==manifest['expected']['destination_hex'],'write data/mask'
     assert not any(e['kind']=='write' and (0xff0200 if variant=='other-args' else 0xff0300)<=e['address']<(0xff0204 if variant=='other-args' else 0xff0304) for e in ev),'wrong destination touched'
    vdp=[(e['address'],e['data'],e['mask']) for e in ev if e['kind']=='write' and 0xc00000<=e['address']<=0xc00007]
    assert vdp==[(0xc00004,0x8f02,65535),(0xc00004,0x4000,65535),(0xc00006,0,65535),(0xc00000,0x1234,65535),(0xc00004,0xc000,65535),(0xc00006,0,65535),(0xc00000,0x000e,65535)],'VDP bus write values/order'
    try:validate(ev,'wrong-run',sha(rom))
    except ValueError:pass
    else:raise ValueError('wrong identity accepted')
    result['qualified']=True;result['interpretation']='author trace and discriminating controls passed'
   result['counts']={kind:sum(e['kind']==kind for e in ev) for kind in set(e['kind'] for e in ev)}
  except (ValueError,AssertionError,KeyError,IndexError) as e:result['qualified']=False;result['error']=str(e)
 else:result['qualified']=False;result['error']='runtime/instrument did not complete'
 (work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result),flush=True)
 return result

def main():
 if len(sys.argv)!=2 or not sys.argv[1].startswith('qualify-'):raise SystemExit('usage: run-observer.py qualify-<fresh-id>')
 if sha(MAME)!=MAME_SHA:raise SystemExit('MAME identity differs')
 parent=SCRATCH/sys.argv[1];parent.mkdir(exist_ok=False)
 results=[]
 for variant in ['positive','no-call','other-args','incomplete']:
  item=run_case(parent,variant);results.append(item)
  if not item['qualified']:break
 summary={'schema':'rex-observer-qualification/v1','id':parent.name,'mame_sha256':sha(MAME),'instrument_sha256':sha(HERE/'observe.lua'),'passed':len(results)==4 and all(x['qualified'] for x in results),'cases':results,'limits':['external MAME runtime only','selected breakpoints and ranges only','PC context at memory taps needs qualification, not caller inference','no commercial observation attempted']}
 (parent/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 return 0 if summary['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
