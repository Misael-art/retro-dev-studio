#!/usr/bin/env python3
"""Original GX only: retain model control inputs before any commercial edit."""
import contextlib
import ctypes as C
import hashlib
import json
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0,str(ROOT/'scripts/rex_profiles/integration_20261007'))
from lr import Core

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    assert len(sys.argv)==2 and sys.argv[1].startswith('m3-original-model-inputs-')
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m3-original-model-inputs-freeze.json').read_text())
    for path,digest in f['inputs'].items():
        assert sha(Path(path).read_bytes())==digest,f'identity:{path}'
    work=Path(f['private_root'])/sys.argv[1];work.mkdir(exist_ok=False)
    started=time.monotonic();result={'id':sys.argv[1],'status':'FAIL','observations':[]}
    try:
        replay=json.loads(Path(f['replay']).read_text());state=bytes(replay['initial_state'])
        with (work/'runtime.log').open('w') as log,contextlib.redirect_stderr(log):
            core=Core(f['core'],replay['rom_path']);lib=core.lib
            lib.retro_unserialize.argtypes=[C.c_void_p,C.c_size_t];lib.retro_unserialize.restype=C.c_bool
            buf=C.create_string_buffer(state,len(state));assert lib.retro_unserialize(buf,len(state))
            for n in range(181):
                assert time.monotonic()-started<90,'budget'
                if n:core.run()
                if n not in f['sample_frames']:continue
                pointer,length=core.ram();assert length==65536
                native=C.string_at(pointer,length);ram=bytearray(length)
                ram[0::2]=native[1::2];ram[1::2]=native[0::2]
                (work/f'frame-{n:03d}.ram').write_bytes(ram)
                item={'frame':n,'ram_sha256':sha(ram)}
                if n:
                    raw,w,h,p=core.frame;assert core.fmt==2 and (w,h)==(320,224)
                    packed=b''.join(raw[y*p:y*p+w*2] for y in range(h))
                    (work/f'frame-{n:03d}.rgb565').write_bytes(packed)
                    item['framebuffer_sha256']=sha(packed)
                result['observations'].append(item)
            assert packed==bytes(replay['final_framebuffer']),'original final framebuffer'
            lib.retro_unload_game();lib.retro_deinit()
        result.update(status='PASS_ORIGINAL_MODEL_INPUT_COLLECTION',elapsed_seconds=time.monotonic()-started,
            limits='Observed control inputs and original regression reference, not a prediction of trajectory. No modified ROM executed.',
            outputs={p.name:sha(p.read_bytes()) for p in work.iterdir() if p.is_file()})
    except Exception as error:
        result['error']=str(error);raise
    finally:
        (work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({k:v for k,v in result.items() if k!='outputs'},indent=2))

if __name__=='__main__':
    main()
