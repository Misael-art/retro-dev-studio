#!/usr/bin/env python3
"""Reuse the frozen MAME execution pipeline with an explicit UI-produced ROM input.

Only the legacy runner's hardcoded ROM Path is redirected, once, to a pinned
published copy. Observer, qualification, execution, budgets and validator stay
unchanged. The legacy raw report is retained, with its inherited scope text
explicitly superseded by an adapter report identifying this edited execution.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    assert len(sys.argv)==2 and sys.argv[1].startswith('commercial-m4-width2-')
    ident=sys.argv[1]
    protocol=ROOT/'data/rex_profiles/commercial_recovery_20261016/m4-freeze-v2.json'
    frozen=json.loads(protocol.read_text())
    for file,digest in frozen['inputs'].items():assert sha(Path(file))==digest,f'identity:{file}'
    qualifications={name:json.loads(Path(file).read_text()) for name,file in frozen['qualifications'].items()}
    assert all(q['passed'] for q in qualifications.values()),'qualification'
    assert all(q['instrument_sha256']==sha(HERE/'observe-v3.lua') for q in qualifications.values() if 'instrument_sha256' in q),'observer qualification pin'
    inputs=SCRATCH/('input-'+ident);inputs.mkdir(exist_ok=False)
    (inputs/'observe.lua').symlink_to(HERE/'observe-v3.lua')
    (inputs/'run-observer.py').write_bytes((HERE/'run-observer.py').read_bytes())
    data=inputs/'data/rex_profiles/commercial_recovery_20261016';data.mkdir(parents=True)
    target=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m1-freeze.json').read_text())
    target.update(rom_sha256=frozen['copy_sha256'],measurement_width=2,
        derived_from_original_freeze_sha256=sha(ROOT/'data/rex_profiles/commercial_recovery_20261016/m1-freeze.json'),
        original_rom_sha256=frozen['original_rom_sha256'],published_copy=frozen['copy_path'])
    (data/'m1-freeze.json').write_text(json.dumps(target,indent=2)+'\n')
    staged={'qualification_summary':frozen['qualifications']['basic'],
        'mame_elf_sha256':sha(Path('/usr/lib/mame/mame')),
        'files':{str(p):sha(p) for p in [HERE/'observe-v3.lua',HERE/'run-commercial.py',HERE/'run-observer.py',HERE/'run-edited-commercial-v2.py',protocol]}}
    (data/'m2-instrument-freeze.json').write_text(json.dumps(staged,indent=2)+'\n')
    module=importlib.util.spec_from_file_location('frozen_commercial_runner',HERE/'run-commercial.py')
    runner=importlib.util.module_from_spec(module);module.loader.exec_module(runner)
    runner.HERE=inputs;runner.ROOT=inputs
    redirects=[]
    def explicit_input_path(value,*parts):
        if str(value)==frozen['original_rom_path']:
            assert not parts,'unexpected ROM Path suffix'
            redirects.append(str(value))
            return Path(frozen['copy_path'])
        return Path(value,*parts)
    runner.Path=explicit_input_path
    code=runner.main()
    assert len(redirects)==1,'exactly one declared legacy ROM input redirection'
    work=SCRATCH/ident
    raw=json.loads((work/'result.json').read_text())
    result={'schema':'rex-edited-commercial-run-adapter/v1','id':ident,
        'status':'PASS_EDITED_ROM_OBSERVED' if code==0 else 'FAIL_EDITED_ROM_OBSERVATION',
        'raw_report_sha256':sha(work/'result.json'),'trace_sha256':raw.get('events_sha256'),
        'rom_sha256':frozen['copy_sha256'],'original_rom_sha256':frozen['original_rom_sha256'],
        'observer_sha256':sha(HERE/'observe-v3.lua'),'protocol_sha256':sha(protocol),
        'scope':'Edited UI copy, separate external MAME episode; same qualified observer/execution pipeline. Semantic state and memory comparison are a separate verifier.',
        'legacy_metadata_limit':'Raw frozen runner inherited original-run hypothesis/limits including No edited ROM executed. Those texts do not describe this run; raw report retained unchanged for audit. This explicit adapter report identifies the actual edited ROM input.',
        'qualification_sha256':{name:sha(Path(file)) for name,file in frozen['qualifications'].items()},
        'redirect_count':len(redirects)}
    (work/'adapter-result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2));return code

if __name__=='__main__':raise SystemExit(main())
