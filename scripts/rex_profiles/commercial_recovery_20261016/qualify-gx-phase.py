#!/usr/bin/env python3
"""Qualify GX RAM-producer to presented-frame phase on two author IRQ cadences."""
import contextlib
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts/rex_profiles/integration_20261007'))
from lr import Core

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def expected(x, y):
    tile = x // 8 * 4 + y // 8 + 1
    index = ([1,2,3,4,5,6,7,1][x] if y == 0 else y) if tile == 1 else (tile-1)%7+1
    return [0,0xf800,0x07e0,0x001f,0xffff,0xffe0,0xf81f,0x07ff][index]

def marker(raw, w, h, pitch):
    assert (w,h) == (320,224), 'author viewport'
    words = [int.from_bytes(raw[y*pitch+x*2:y*pitch+x*2+2],'little') for y in range(h) for x in range(w)]
    points = [(i%w,i//w) for i,v in enumerate(words) if v]
    assert len(points) == 1024, 'opaque authored sprite count'
    left, top = min(x for x,y in points), min(y for x,y in points)
    assert top == 64 and max(x for x,y in points) == left+31 and max(y for x,y in points) == 95
    assert all(words[(top+y)*w+left+x] == expected(x,y) for y in range(32) for x in range(32)), 'literal authored1024pixel model'
    return left

def main():
    assert len(sys.argv) == 2 and sys.argv[1].startswith('gx-phase-qualify-')
    protocol = ROOT/'data/rex_profiles/commercial_recovery_20261016/m3-gx-phase-freeze.json'
    freeze = json.loads(protocol.read_text())
    for path, digest in freeze['inputs'].items():
        assert sha(Path(path)) == digest, f'identity:{path}'
    work = Path(freeze['private_root'])/sys.argv[1]
    work.mkdir(exist_ok=False)
    result = {'schema':'rex-gx-author-phase/v1','status':'FAIL','id':sys.argv[1], 'freeze_sha256':sha(protocol),'cases':{}}
    started = time.monotonic()
    try:
        for case, source in freeze['sources'].items():
            obj, rom = work/(case+'.o'), work/(case+'.bin')
            subprocess.run(['rtk','proxy',freeze['assembler'],'-m68000','-o',str(obj),source],check=True)
            subprocess.run(['rtk','proxy',freeze['linker'],'-Ttext=0','--oformat=binary','-o',str(rom),str(obj)],check=True)
            records = []
            trained = None
            with (work/(case+'.log')).open('w') as log, contextlib.redirect_stderr(log):
                core = Core(freeze['core'],str(rom))
                core.poke(0xff0000,b'\x01')
                for n in range(1,21):
                    assert time.monotonic()-started < 90, 'author budget'
                    core.run()
                    if n < 4:
                        continue
                    assert core.fmt == 2
                    counter = int.from_bytes(core.peek(0xff0400,2),'big')
                    source_x = (int.from_bytes(core.peek(0xfff806,2),'big') & 511)-128
                    assert source_x == (counter&31)*8, 'author RAM update'
                    left = marker(*core.frame)
                    lag = ((source_x-left)//8)%32
                    assert (source_x-left)%8 == 0 and lag in (0,1,2), 'bounded phase'
                    records.append({'frame':n,'counter':counter,'source_x':source_x,'presented_x':left,'lag':lag})
                    if n == 7:
                        assert len({r['lag'] for r in records}) == 1, 'training phase varies'
                        trained = lag
                        (work/(case+'-trained-phase.json')).write_text(json.dumps({'lag':lag,'training':[4,5,6,7],'reserved':[8,20]},indent=2)+'\n')
                    if n >= 8:
                        assert lag == trained, 'reserved frame phase mismatch'
                        assert left != (source_x-((trained+1)%3)*8)%256, 'wrong phase accepted'
                core.lib.retro_unload_game()
                core.lib.retro_deinit()
            result['cases'][case] = {'rom_sha256':sha(rom),'ram_to_presented_updates':trained,'literal_pixels_per_frame':1024,'records':records,'wrong_phase_refused':True}
        result.update(status='PASS_AUTHOR_GX_TWO_CADENCES',elapsed_seconds=time.monotonic()-started,limits='Pinned GX author fixtures only; does not prove Sonic cadence or commercial visual equivalence. Source coordinates are independently qualified inputs, not a predicted game trajectory.')
    except Exception as error:
        result['error'] = str(error)
        raise
    finally:
        (work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))

if __name__ == '__main__':
    main()
