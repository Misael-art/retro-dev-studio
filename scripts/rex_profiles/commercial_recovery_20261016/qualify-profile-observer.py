#!/usr/bin/env python3
"""Qualify profile-mode full registers, signed pointers, long bus transfers and negatives."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def fixture(variant,q):
    rom=bytearray(q.fixture('positive')[0])
    source=0x510 if variant=='other-args' else 0x500
    destination=0x8300 if variant=='other-args' else 0x8200
    # Author-owned guard initialization, followed by distinct register sentinels.
    code='46fc27004a3900ff000067f8'
    code+='45f88200704324fca5a5a5a551c8fff8'
    code+=f'207c{source:08x}43f8{destination:04x}'
    expected={}
    for reg in range(8):
        value=0x10000000+reg*0x111111
        code+=f'{0x203c|reg<<9:04x}{value:08x}';expected[f'd{reg}']=value
    for reg in range(2,7):
        value=0x81230000+reg*0x1111
        code+=f'{0x207c|reg<<9:04x}{value:08x}';expected[f'a{reg}']=value
    code+='4e714e714e71' if variant=='no-call' else '4eb900000300'
    ret=0x200+len(bytes.fromhex(code));assert ret+12<0x300,'author region separation'
    code+='23fcdeadbeef00ff010060fe'
    rom[0x200:0x300]=bytes(256);raw=bytes.fromhex(code);rom[0x200:0x200+len(raw)]=raw
    rom[0x300:0x30a]=bytes.fromhex('22d84e754e714e714e71')
    rom[0x500:0x504]=bytes.fromhex('12345678');rom[0x510:0x514]=bytes.fromhex('a1b2c3d4')
    rom[0x18e:0x190]=(sum(int.from_bytes(rom[i:i+2],'big') for i in range(0x200,len(rom),2))&65535).to_bytes(2,'big')
    expected.update(a0=source,a1=0xffff0000|destination,a7=0xfffdfc,sr=0x2700,stack_top_long=ret)
    return bytes(rom),ret,source,0xff0000|destination,expected

def main():
    assert len(sys.argv)==2 and sys.argv[1].startswith('qualify-m5-profile-')
    ident=sys.argv[1];protocol=ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-pilot-freeze.json'
    f=json.loads(protocol.read_text())
    for p,digest in f['inputs'].items():assert sha(Path(p))==digest,f'identity:{p}'
    q=load('frozen_identity_qualifier',HERE/'run-observer.py');launch=load('profile_launcher',HERE/'run-profile-observer.py')
    assert q.sha(q.MAME)==q.MAME_SHA,'MAME identity'
    alias=Path(f['qualification_observer_alias']);alias.mkdir(exist_ok=False)
    (alias/'observe.lua').symlink_to(HERE/'observe-v4.lua');q.HERE=alias
    oldcase=q.run_case
    def baseline_case(parent,variant):
        screen=parent/('screens-'+variant);screen.mkdir();os.environ['REX_SNAP_DIR']=str(screen)
        return oldcase(parent,variant)
    q.run_case=baseline_case
    original_argv=sys.argv[:];sys.argv=[str(HERE/'run-observer.py'),ident+'-base']
    try:base_code=q.main()
    finally:sys.argv=original_argv
    parent=SCRATCH/ident;parent.mkdir(exist_ok=False)
    result={'schema':'rex-profile-observer-qualification/v1','id':ident,'passed':False,
        'observer_sha256':sha(HERE/'observe-v4.lua'),'protocol_sha256':sha(protocol),
        'baseline_cases_result':str(SCRATCH/(ident+'-base')/'summary.json'),'profile_cases':[]}
    try:
        assert base_code==0,'original author controls failed'
        for variant in ['positive','no-call','other-args','incomplete']:
            rom,ret,source,dest,expected=fixture(variant,q)
            config={'entry':0x300,'exit':ret,'region_length':4,'source':0x500,'source_span':32,
                'destination':0xff8200,'destination_span':272,'frames':5,'max_calls':16}
            work=parent/variant;run=ident+'-'+variant
            actual=launch.run_case(work,run,rom,config,author=True,maxevents=2 if variant=='incomplete' else 1000)
            assert actual['exit_code']==0,'runtime exit'
            events=[json.loads(line) for line in (work/'events.jsonl').open()]
            item={'variant':variant,'launch':actual,'passed':False}
            if variant=='incomplete':
                try:q.validate(events,run,hashlib.sha256(rom).hexdigest())
                except ValueError:item.update(passed=True,incomplete_refused=True)
                else:raise AssertionError('incomplete capture accepted')
            else:
                q.validate(events,run,hashlib.sha256(rom).hexdigest())
                entries=[e for e in events if e['kind']=='profile_entry'];exits=[e for e in events if e['kind']=='profile_exit']
                if variant=='no-call':
                    assert not entries and not exits and any(e['kind']=='profile_exit_without_entry' for e in events),'continuation misclassified as call'
                    item.update(passed=True,no_call_and_unpaired_exit_distinguished=True)
                else:
                    assert len(entries)==len(exits)==1,'entry/exit pairing'
                    entry,exit=entries[0],exits[0]
                    assert all(entry[k]==v for k,v in expected.items()),'full author entry registers/stack'
                    for key in expected:
                        if key in ['a0','a1','a7','stack_top_long','sr']:continue
                        assert exit[key]==entry[key],'unmodified register capture'
                    assert exit['a0']==source+4 and exit['a1']==expected['a1']+4 and exit['a7']==entry['a7']+4,'pointer/SP after real RTS'
                    expected_bytes=bytes.fromhex('a1b2c3d4' if variant=='other-args' else '12345678')
                    assert exit['sr']==(0x2708 if variant=='other-args' else 0x2700),'MOVE.L author CCR'
                    reads=[e for e in events if e['kind']=='read'];writes=[e for e in events if e['kind']=='write']
                    assert len(reads)==len(writes)==2,'long transfer native16 decomposition'
                    assert [e['address'] for e in reads]==[source,source+2] and [e['address'] for e in writes]==[dest,dest+2],'bus address32vs24 domains'
                    assert all(e['mask']==65535 and e['instruction_pc']==0x300 for e in reads+writes),'native word masks/PC'
                    assert b''.join(e['data'].to_bytes(2,'big') for e in reads)==expected_bytes and b''.join(e['data'].to_bytes(2,'big') for e in writes)==expected_bytes,'long byte order'
                    before=bytes.fromhex(next(e['hex'] for e in events if e['kind']=='profile_destination_before'))
                    after=bytes.fromhex(next(e['hex'] for e in events if e['kind']=='profile_destination_after'))
                    wanted=bytearray([0xa5]*272);wanted[dest-0xff8200:dest-0xff8200+4]=expected_bytes
                    assert before==bytes([0xa5]*272) and after==wanted,'native guarded snapshot'
                    try:q.validate(events,'wrong-run',hashlib.sha256(rom).hexdigest())
                    except ValueError:pass
                    else:raise AssertionError('wrong run accepted')
                    item.update(passed=True,full_registers=True,raw_signed_pointer32_and_bus24=True,long_native16_order=True,guarded_snapshot=True,wrong_identity_refused=True)
            result['profile_cases'].append(item)
        result.update(passed=True,scope='Original four author observer controls plus four profile-mode controls; complete32bit registers, .L decomposed into two native16 accesses, short pointer sign extension, real JSR/RTS, absence/incomplete/identity. No commercial run yet; no new VDP/frame phase claim.')
    except Exception as error:result['error']=str(error)
    (parent/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));return 0 if result['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
