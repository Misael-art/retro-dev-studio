#!/usr/bin/env python3
"""Compose the frozen commercial runner with qualified observer inputs; no second execution pipeline."""
import hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 assert len(sys.argv)==2 and sys.argv[1].startswith('commercial-v3-'),'usage: run-commercial-v3.py commercial-v3-<fresh-id>'
 ident=sys.argv[1];scratch=Path('/home/misael/rds-scratch/commercial_recovery_20261016')
 original=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-instrument-freeze.json').read_text())
 for name in ['run-commercial.py','run-observer.py']:
  p=HERE/name;assert sha(p)==original['files'][str(p.relative_to(ROOT))],'frozen runner changed'
 protocol=ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-dma-save-item-storage-addendum.json'
 frozen=json.loads(protocol.read_text());assert sha(HERE/'observe-v3.lua')==frozen['new_source_sha256'],'candidate observer changed'
 qualpath=scratch/'qualify-v3-001/summary.json';screenpath=scratch/'qualify-v3-001/screen-qualification.json'
 qual=json.loads(qualpath.read_text());screen=json.loads(screenpath.read_text())
 dmapath=scratch/'qualify-v3-001/dma-summary.json';dma=json.loads(dmapath.read_text())
 assert dma['passed'] and dma['instrument_sha256']==sha(HERE/'observe-v3.lua'),'DMA not qualified'
 assert qual['passed'] and screen['passed'] and qual['instrument_sha256']==sha(HERE/'observe-v3.lua'),'not fully qualified'
 inputs=scratch/('input-'+ident);inputs.mkdir(exist_ok=False)
 (inputs/'observe.lua').symlink_to(HERE/'observe-v3.lua')
 (inputs/'run-observer.py').write_bytes((HERE/'run-observer.py').read_bytes())
 data=inputs/'data/rex_profiles/commercial_recovery_20261016';data.mkdir(parents=True)
 (data/'m1-freeze.json').write_bytes((ROOT/'data/rex_profiles/commercial_recovery_20261016/m1-freeze.json').read_bytes())
 staged={'schema':'rex-instrument-freeze/v1','qualification_summary':str(qualpath),'qualification_summary_sha256':sha(qualpath),'screen_qualification_sha256':sha(screenpath),'dma_qualification_sha256':sha(dmapath),'public_protocol':str(protocol),'public_protocol_sha256':sha(protocol),'mame_elf_sha256':sha(Path('/usr/lib/mame/mame')),'files':{str(p):sha(p) for p in [HERE/'observe-v3.lua',HERE/'run-commercial.py',HERE/'run-observer.py',HERE/'run-commercial-v3.py',protocol]},'limits':['same frozen runner implementation; alternate explicit observer/config inputs','MAME separate from app/GX','sprite loop heads sampled first20; not20 calls','active bitmap and presented snapshot separate','CPU register values raw32, bus tap addresses24; registers are not all pointers','VDP native save snapshots and source read taps qualified on author DMA; commercial dataflow still requires verification']}
 (data/'m2-instrument-freeze.json').write_text(json.dumps(staged,indent=2)+'\n')
 spec=importlib.util.spec_from_file_location('frozen_commercial_runner',HERE/'run-commercial.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
 runner.HERE=inputs;runner.ROOT=inputs
 return runner.main()
if __name__=='__main__':raise SystemExit(main())
