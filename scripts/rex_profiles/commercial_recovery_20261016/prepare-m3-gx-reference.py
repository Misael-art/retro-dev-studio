#!/usr/bin/env python3
"""Original-only GX frame-boundary survey; no edited ROM or visual oracle creation."""
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
sys.path.insert(0, str(ROOT / 'scripts/rex_profiles/integration_20261007'))
from lr import Core

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    assert len(sys.argv) == 2 and sys.argv[1].startswith('m3-gx-reference-')
    freeze = json.loads((ROOT / 'data/rex_profiles/commercial_recovery_20261016/m3-gx-reference-freeze.json').read_text())
    for path, expected in freeze['inputs'].items():
        assert sha(Path(path).read_bytes()) == expected, f'identity: {path}'
    work = Path(freeze['private_root']) / sys.argv[1]
    work.mkdir(exist_ok=False)
    started = time.monotonic()
    try:
        replay = json.loads(Path(freeze['replay']).read_text())
        state = bytes(replay['initial_state'])
        assert sha(state) == freeze['state_sha256']
        records = []
        first = None
        with (work / 'runtime.log').open('w') as log, contextlib.redirect_stderr(log):
            core = Core(freeze['core'], replay['rom_path'])
            lib = core.lib
            lib.retro_unserialize.argtypes = [C.c_void_p, C.c_size_t]
            lib.retro_unserialize.restype = C.c_bool
            buf = C.create_string_buffer(state, len(state))
            assert lib.retro_unserialize(buf, len(state)), 'unserialize'
            initial_tail = core.peek(0xff5000, 4096)
            (work / 'before-tail.bin').write_bytes(initial_tail)
            (work / 'before-destination.bin').write_bytes(core.peek(0xff1020, 12224))
            for n in range(1, 181):
                assert time.monotonic() - started < 90, 'execution budget'
                core.run()
                destination = core.peek(0xff1020, 12224)
                tail = core.peek(0xff5000, 4096)
                raw, width, height, source_pitch = core.frame
                assert core.fmt == 2 and (width, height) == (320, 224)
                packed = b''.join(raw[y*source_pitch:y*source_pitch+width*2] for y in range(height))
                match = sha(destination[:8128]) == freeze['initial_copy_sha256']
                records.append({'frame': n, 'layout_initial_copy_match': match,
                    'destination_sha256': sha(destination), 'tail_sha256': sha(tail),
                    'tail_equal_prestate': tail == initial_tail,
                    'framebuffer_sha256': sha(packed), 'source_pitch': source_pitch})
                if match and first is None:
                    first = n
                    (work / 'first-copy-destination.bin').write_bytes(destination)
                    (work / 'first-copy-tail.bin').write_bytes(tail)
                    (work / 'first-copy-frame.rgb565').write_bytes(packed)
                    prefix = dict(replay)
                    prefix.update(frames=replay['frames'][:n], final_framebuffer=list(packed),
                        final_frame_size={'width':width,'height':height,'pitch':width*2})
                    (work / 'original-prefix.rds-replay').write_text(json.dumps(prefix,separators=(',',':'))+'\n')
            assert first is not None, 'no observable initial-copy frame boundary'
            assert packed == bytes(replay['final_framebuffer']), 'original180 reference mismatch'
            lib.retro_unload_game()
            lib.retro_deinit()
        result = {'schema':'rex-m3-gx-original-reference/v1', 'id':sys.argv[1],
            'status':'PASS_ORIGINAL_BOUNDARY_SURVEY', 'first_copy_frame':first,
            'frames':records, 'elapsed_seconds':time.monotonic()-started,
            'limits':'Frame-end observation does not prove calls or pre-copy tail stability within a frame; no modified execution, independent visual or counterfactual oracle yet.',
            'inputs':freeze['inputs'], 'outputs':{p.name:sha(p.read_bytes()) for p in work.iterdir() if p.is_file()}}
        (work / 'result.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({k:v for k,v in result.items() if k not in ['frames','inputs','outputs']},indent=2))
    except Exception as error:
        (work / 'failure.json').write_text(json.dumps({'status':'FAIL','error':str(error),'elapsed_seconds':time.monotonic()-started},indent=2)+'\n')
        raise

if __name__ == '__main__':
    main()
