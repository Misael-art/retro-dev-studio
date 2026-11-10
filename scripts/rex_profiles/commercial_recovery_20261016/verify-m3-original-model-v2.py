#!/usr/bin/env python3
"""Measure the previously frozen original-only conditional reference."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('conditional_model',HERE/'m3-conditional-sprite-model-v2.py')
model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists(),'refuse overwrite'
    freeze_path=ROOT/'data/rex_profiles/commercial_recovery_20261016/m3-conditional-reference-freeze-v2.json'
    f=json.loads(freeze_path.read_text())
    for path,digest in f['inputs'].items():assert sha(Path(path))==digest,f'identity:{path}'
    work=Path(f['original_inputs']);private=Path(f['private_inputs'])
    rom=Path(json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m3-gx-reference-freeze.json').read_text())['replay'])
    rom=Path(json.loads(rom.read_text())['rom_path']).read_bytes()
    lookup=json.loads((private/'immutable-lookup.json').read_text())
    art=(private/'wall-art.bin').read_bytes()
    result={'schema':'rex-m3-original-conditional-model/v1','status':'FAIL','freeze_sha256':sha(freeze_path),'measurements':[],'limits':f['independence']}
    try:
        for image_frame in f['measurement_frames']:
            frame=image_frame-1
            ram=(work/f'frame-{frame:03d}.ram').read_bytes()
            predicted=model.reconstruct(rom,ram[:16384],ram,lookup)
            for p in predicted:
                actual=ram[0xf800+p['index']*8:0xf808+p['index']*8]
                expected=b''.join(w.to_bytes(2,'big') for w in p['words'])
                assert actual==expected,f"producer SAT mismatch frame{frame} index{p['index']}: {actual.hex()} vs {expected.hex()}"
            sat=model.sat_bytes(predicted,ram[0xf800:0xf808])
            pixels,indices,masked=model.project(sat,art,ram[0xfb00:0xfb80])
            assert pixels,'empty resource domain'
            raw=(work/f'frame-{image_frame:03d}.rgb565').read_bytes()
            def observed(pos):
                at=(pos[1]*320+pos[0])*2;v=int.from_bytes(raw[at:at+2],'little')
                return ((v>>11&31)*8+(v>>13&7),(v>>5&63)*4+(v>>9&3),(v&31)*8+(v>>2&7))
            mismatch=[pos for pos,expected in pixels.items() if observed(pos)!=expected]
            result['measurements'].append({'producer_frame':frame,'image_frame':image_frame,'sprites':len(predicted),'resource_indices':sorted(indices),'resource_pixels':len(pixels),'masked_pixels':masked,'mismatch_pixels':len(mismatch),'first_mismatches':mismatch[:8]})
            assert not mismatch,f'conditional original visual mismatch frame{image_frame}'
            pos,expected=next(iter(pixels.items()))
            assert observed(pos)!=(expected[0]^1,expected[1],expected[2]),'wrong expected pixel accepted'
            wrong=bytearray(sat);wrong[1*8+5]^=1
            bad,_,_=model.project(wrong,art,ram[0xfb00:0xfb80])
            assert any(observed(pos)!=value for pos,value in bad.items()),'wrong tile expected accepted'
        result.update(status='PASS_ORIGINAL_CONDITIONAL_MODEL',wrong_color_refused=True,wrong_tile_refused=True)
    except Exception as error:
        result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
