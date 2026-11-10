#!/usr/bin/env python3
"""Construct conditional expectations from frozen bytes and explicit control RAM.
Accepts no screenshot/framebuffer input. Output must precede final-frame capture.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('model',HERE/'m3-conditional-sprite-model-v2.py')
model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)

def main():
    assert len(sys.argv)==5,'spec control-ram width fresh-output'
    spec_path,ram_path=map(Path,sys.argv[1:3]);width=int(sys.argv[3]);out=Path(sys.argv[4])
    assert not out.exists() and width in (1,2)
    f=json.loads(spec_path.read_text())
    for path,digest in f['inputs'].items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest,f'identity:{path}'
    ram=ram_path.read_bytes();layout=Path(f['world_layouts'][str(width)]).read_bytes()
    assert ram[:16384]==layout,'predicted layout differs from observed producer world'
    rom=Path(f['original_rom']).read_bytes();lookup=json.loads(Path(f['lookup']).read_text())
    art=Path(f['art']).read_bytes();palette=ram[0xfb00:0xfb80]
    sprites=model.reconstruct(rom,layout,ram,lookup)
    for p in sprites:
        expected=b''.join(w.to_bytes(2,'big') for w in p['words'])
        assert ram[0xf800+p['index']*8:0xf808+p['index']*8]==expected,f"predicted SAT index{p['index']}"
    sat=model.sat_bytes(sprites,ram[0xf800:0xf808])
    pixels,indices,masked=model.project(sat,art,palette)
    assert pixels,'empty commercial resource pixel domain'
    old_layout=Path(f['world_layouts']['1']).read_bytes()
    old_sprites=model.reconstruct(rom,old_layout,ram,lookup)
    old_sat=model.sat_bytes(old_sprites,ram[0xf800:0xf808])
    old,_,_=model.project(old_sat,art,palette)
    changed=[pos for pos in pixels.keys() & old.keys() if pixels[pos]!=old[pos]]
    if width==2:assert changed,'no discriminating conditional asset pixels'
    result={'schema':'rex-m3-frozen-conditional-expectation/v1','width':width,
        'control_ram_sha256':hashlib.sha256(ram).hexdigest(),
        'layout_sha256':hashlib.sha256(layout).hexdigest(),
        'pixels':[[x,y,*rgb] for (x,y),rgb in sorted(pixels.items())],
        'old_width_wrong_pixels':[[x,y,*old[(x,y)]] for x,y in sorted(changed)],
        'resource_indices':sorted(indices),'masked_pixels':masked,'sprites':sprites,
        'limits':f['independence'],'capture_input':None}
    out.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(json.dumps({'pixels':len(pixels),'changed_common_pixels':len(changed),'masked':masked,'sprites':len(sprites)}))

if __name__=='__main__':main()
