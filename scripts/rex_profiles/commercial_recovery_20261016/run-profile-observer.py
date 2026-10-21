#!/usr/bin/env python3
"""One generic MAME launcher for authored qualification and frozen copy profiles."""
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')
MAME=Path('/usr/lib/mame/mame')

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def run_case(work,ident,rom,config,author=False,maxevents=250000):
    work.mkdir(exist_ok=False)
    for name in ['cfg','nvram','snap','state','comments','diff']:(work/name).mkdir()
    with zipfile.ZipFile(work/'cart.zip','w',zipfile.ZIP_STORED) as z:z.writestr('game.bin',rom)
    observer=HERE/'observe-v4.lua';events=work/'events.jsonl'
    env=dict(os.environ,SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy',
        REX_RUN_ID=ident,REX_ROM_SHA=hashlib.sha256(rom).hexdigest(),
        REX_INSTRUMENT_SHA=sha(observer),REX_EVENTS=str(events),REX_MODE='profile',
        REX_MAX_FRAMES=str(config['frames']),REX_MAX_EVENTS=str(maxevents),
        REX_PROFILE_AUTHOR='1' if author else '0',
        REX_PROFILE_ENTRY=str(config['entry']),REX_PROFILE_EXIT=str(config['exit']),
        REX_PROFILE_REGION_LENGTH=str(config['region_length']),
        REX_PROFILE_SOURCE=str(config['source']),REX_PROFILE_SOURCE_SPAN=str(config['source_span']),
        REX_PROFILE_DESTINATION=str(config['destination']),REX_PROFILE_DESTINATION_SPAN=str(config['destination_span']),
        REX_PROFILE_MAX_CALLS=str(config.get('max_calls',16)))
    cmd=[str(MAME),'genesis','-cart',str(work/'cart.zip'),'-noreadconfig','-noplugins','-skip_gameinfo',
        '-hashpath',str(work),'-homepath',str(work),'-cfg_directory',str(work/'cfg'),
        '-nvram_directory',str(work/'nvram'),'-state_directory',str(work/'state'),
        '-comment_directory',str(work/'comments'),'-diff_directory',str(work/'diff'),
        '-snapshot_directory',str(work/'snap'),'-debug','-debugger','none','-video','none',
        '-sound','none','-nothrottle','-autoboot_delay','0','-autoboot_script',str(observer),'-seconds_to_run','30']
    manifest={'id':ident,'rom_sha256':env['REX_ROM_SHA'],'instrument_sha256':sha(observer),
        'mame_sha256':sha(MAME),'command':cmd,'env':{k:v for k,v in env.items() if k.startswith('REX_')},
        'budget_seconds':90,'source':'author fixture' if author else 'authorized commercial derivative, frozen profile',
        'episode':'author install latch' if author else 'cold boot; Start10frames at120/360/600/900, no RAM preparation',
        'limits':'External MAME only; selected region/ranges; first16completed invocations sampled; stack top is raw context, not automatically a caller return.'}
    (work/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');started=time.monotonic()
    with (work/'runtime.log').open('w') as log:
        child=subprocess.Popen(cmd,cwd=work,env=env,stdout=log,stderr=subprocess.STDOUT)
        try:code=child.wait(timeout=90)
        except subprocess.TimeoutExpired:child.kill();child.wait();code=124
    result={'id':ident,'exit_code':code,'pid':child.pid,'owned_process_alive':child.poll() is None,
        'elapsed_seconds':time.monotonic()-started,'manifest_sha256':sha(work/'manifest.json'),
        'log_sha256':sha(work/'runtime.log'),'events_sha256':sha(events) if events.exists() else None,
        'events_bytes':events.stat().st_size if events.exists() else 0}
    (work/'launch-result.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

def main():
    assert len(sys.argv)==3,'target-id fresh-run-id'
    target_id,ident=sys.argv[1:];assert ident.startswith('m5-profile-')
    freeze_path=ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-pilot-freeze.json'
    f=json.loads(freeze_path.read_text())
    for p,digest in f['inputs'].items():assert sha(Path(p))==digest,f'identity:{p}'
    q=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-profile-observer-qualified.json').read_text())
    assert q['passed'] and q['observer_sha256']==sha(HERE/'observe-v4.lua'),'profile observer not qualified'
    target=next(t for t in f['targets'] if t['id']==target_id)
    rom=Path(target['rom_path']).read_bytes();assert hashlib.sha256(rom).hexdigest()==target['rom_sha256']
    shape=target['shape'];span=shape['count']*max(shape['allowed_widths_in_memory_domain'])
    config={'entry':shape['entry'],'exit':shape['exit'],'region_length':shape['length'],
        'source':shape['source_bus24'],'source_span':span,'destination':shape['destination_bus24'],
        'destination_span':span,'frames':1200,'max_calls':16}
    work=SCRATCH/ident;result=run_case(work,ident,rom,config)
    result.update(status='FAIL',target=target_id,protocol_sha256=sha(freeze_path))
    if result['exit_code']==0:
        module=importlib.util.spec_from_file_location('identity_validator',HERE/'run-observer.py')
        validator=importlib.util.module_from_spec(module);module.loader.exec_module(validator)
        validator.HERE=Path(f['qualification_observer_alias'])
        events=[json.loads(line) for line in (work/'events.jsonl').open()]
        validator.validate(events,ident,target['rom_sha256'])
        entries=[e for e in events if e['kind']=='profile_entry'];exits=[e for e in events if e['kind']=='profile_exit']
        assert len(entries)==len(exits),'unpaired observed regions'
        result.update(status='OBSERVED_DECLARED_REGION' if entries else 'NO_REGION_EXECUTION_OBSERVED',
            entries=len(entries),completed_regions=len(exits),entry_frames=[e['frame'] for e in entries],
            sampled_later_invocations=any(e['kind']=='sampling_limit' for e in events))
    (work/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return 0 if result['status']=='OBSERVED_DECLARED_REGION' else 1

if __name__=='__main__':raise SystemExit(main())
