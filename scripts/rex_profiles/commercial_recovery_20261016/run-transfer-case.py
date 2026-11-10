#!/usr/bin/env python3
"""Observe a frozen declarative transfer case with the already qualified instrument."""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def main():
    assert len(sys.argv)==3,'case-freeze fresh-run-id'
    file,ident=sys.argv[1:];assert ident.startswith('m5-profile-')
    launcher=load('profile_launcher',HERE/'run-profile-observer.py');sha=launcher.sha
    freeze=json.loads(Path(file).read_text())
    for p,digest in freeze['inputs'].items():assert sha(Path(p))==digest,f'identity:{p}'
    target=freeze['target'];rom=Path(target['rom_path']).read_bytes();assert launcher.hashlib.sha256(rom).hexdigest()==target['rom_sha256']
    qualification=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-profile-observer-qualified.json').read_text())
    assert qualification['passed'] and qualification['observer_sha256']==sha(HERE/'observe-v4.lua')
    subprocess.run(['rtk','proxy','python3',str(HERE/'preflight.py')],check=True)
    shape=target['shape'];span=shape['count']*max(shape['allowed_widths_in_memory_domain'])
    config=dict(entry=shape['entry'],exit=shape['exit'],region_length=shape['length'],source=shape['source_bus24'],source_span=span,destination=shape['destination_bus24'],destination_span=span,frames=freeze['frames'],max_calls=16)
    work=SCRATCH/ident;result=launcher.run_case(work,ident,rom,config)
    result.update(status='FAIL',case_freeze_sha256=sha(Path(file)),target=target['id'],production_changes_since_generic_freeze=0)
    try:
        assert result['exit_code']==0,'runtime exit'
        validator=load('identity_validator',HERE/'run-observer.py');validator.HERE=Path(freeze['observer_alias'])
        events=[json.loads(line) for line in (work/'events.jsonl').open()]
        validator.validate(events,ident,target['rom_sha256'])
        entries=[e for e in events if e['kind']=='profile_entry'];result['entries']=len(entries)
        if not entries:result['status']='NO_REGION_EXECUTION_OBSERVED'
        else:
            verifier=load('conditional_state',Path(freeze['verifier']))
            result['calls']=verifier.verify(events,target,ident,sha(HERE/'observe-v4.lua'),rom)
            negatives={}
            for name in ['identity','operator','flow','destination','state','flags']:
                try:verifier.verify(events,target,ident,sha(HERE/'observe-v4.lua'),rom,name)
                except AssertionError as error:negatives[name]=dict(refused=True,reason=str(error))
                else:raise AssertionError('negative accepted:'+name)
            result.update(status='PASS_OBSERVED_LINEAR_STATE',negative_controls=negatives)
    except Exception as error:result['error']=str(error)
    (work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2));return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
