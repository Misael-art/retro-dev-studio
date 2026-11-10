#!/usr/bin/env python3
"""Original-only frame survey and independently predicted conditional copy references."""
import contextlib
import ctypes as C
import hashlib
import json
import sys
import time
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'scripts/rex_profiles/integration_20261007'))
from lr import Core

def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    assert len(sys.argv)==3,'protocol fresh-output-directory'
    protocol=Path(sys.argv[1]);f=json.loads(protocol.read_text());work=Path(sys.argv[2]);work.mkdir(exist_ok=False)
    for p,h in f['inputs'].items():assert sha(Path(p).read_bytes())==h,f'identity:{p}'
    target=f['target'];shape=target['shape'];rom=Path(target['rom_path']).read_bytes();span=shape['count']*max(shape['allowed_widths_in_memory_domain']);n=shape['count']*shape['width']
    assert shape['source_space']=='linear_rom';source=rom[shape['source_bus24']:shape['source_bus24']+span]
    assert sha(source)==target['maximum_source_sha256']
    first=None;records=[];started=time.monotonic()
    with (work/'runtime.log').open('w') as log,contextlib.redirect_stderr(log):
        c=Core(f['core'],target['rom_path']);lib=c.lib
        lib.retro_serialize_size.restype=C.c_size_t;lib.retro_serialize.argtypes=[C.c_void_p,C.c_size_t];lib.retro_serialize.restype=C.c_bool
        for frame in range(1,61):
            assert time.monotonic()-started<90,'budget'
            before=c.peek(shape['destination_bus24'],span)
            size=lib.retro_serialize_size();state=C.create_string_buffer(size);assert lib.retro_serialize(state,size),'serialize'
            c.run();actual=c.peek(shape['destination_bus24'],span)
            expected=source[:n]+before[n:];match=actual==expected and actual!=before
            records.append(dict(frame=frame,before_sha256=sha(before),after_sha256=sha(actual),conditional_match=match))
            if match:
                first=frame
                raw,w,h,pitch=c.frame;assert c.fmt==2
                packed=b''.join(raw[y*pitch:y*pitch+w*2] for y in range(h))
                neutral={k:False for k in 'b y select start up down left right a x l r'.split()}
                replay=dict(rom_path=target['rom_path'],initial_state=list(state.raw),frames=[neutral],final_framebuffer=list(packed),final_frame_size=dict(width=w,height=h,pitch=w*2),final_pixel_format='Rgb565')
                (work/'original.rds-replay').write_text(json.dumps(replay,separators=(',',':'))+'\n')
                (work/'before-destination.bin').write_bytes(before)
                (work/'source.bin').write_bytes(source)
                for width in shape['allowed_widths_in_memory_domain']:
                    count=shape['count']*width;prediction=source[:count]+before[count:]
                    (work/f'expected-width{width}.bin').write_bytes(prediction)
                (work/'original-frame.rgb565').write_bytes(packed)
                break
        lib.retro_unload_game();lib.retro_deinit()
    result=dict(schema='rex-m5-original-gx-reference/v1',status='PASS_ORIGINAL_CONDITIONAL_MEMORY_BOUNDARY' if first else 'NO_FRAME_BOUNDARY_MATCH',first_frame=first,records=records,protocol_sha256=sha(protocol.read_bytes()),outputs={p.name:sha(p.read_bytes()) for p in work.iterdir() if p.is_file()},limits='Original GX frame-end conditional memory only; does not prove call in GX. Prepared original state permits same episode in app. Expected edited bytes are original ROM source plus original before-destination, never edited output/capture. Video baseline is same-core correspondence only, not independent visual/game oracle.')
    (work/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));return 0 if first else 1

if __name__=='__main__':raise SystemExit(main())
