#!/usr/bin/env python3
"""Pre-journey literal vectors and pinned-source/config audit. No core execution."""
import hashlib,json,runpy,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
DATA=ROOT/'data/rex_profiles/integration_20261016/visual-copy-v2'
convert=runpy.run_path(str(Path(__file__).with_name('color_v2.py')))['convert_cram']

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(source_dir):
    model=json.loads((DATA/'color-model.json').read_text())
    paths={'core/vdp_render.c':'pinned-core-vdp_render.c','libretro/libretro.c':'pinned-libretro-libretro.c','Makefile.libretro':'pinned-Makefile.libretro'}
    identities={}
    for key,name in paths.items():
        f=source_dir/name; assert sha(f)==model['sources'][key]['sha256'],key
        identities[key]={'path':str(f),'sha256':sha(f)}
    old=ROOT/'data/rex_profiles/integration_20261016/evidence/visual-copy'
    for name,hash in json.loads((old/'TOOL-AND-APP-SHA256.json').read_text()).items():
        if name.endswith(('genesis_plus_gx_libretro.so','retro-dev-studio')): assert sha(Path(name))==hash
    # Confirm compiled binary requests RGB565, independently of framebuffer colors.
    core=next(Path(n) for n in json.loads((old/'TOOL-AND-APP-SHA256.json').read_text()) if n.endswith('genesis_plus_gx_libretro.so'))
    audit=subprocess.run(['rtk','proxy','objdump','-d','--disassemble=retro_load_game',str(core)],check=True,capture_output=True,text=True).stdout
    assert '5133b9:' in audit and 'movl   $0x2,0x30(%rsp)' in audit
    assert '5133c1:' in audit and 'mov    $0xa,%edi' in audit and '5133ce:' in audit
    vectors=json.loads((DATA/'literal-vectors.json').read_text())['vectors']; results=[]
    for v in vectors:
        packed,rgba=convert(int(v['cram_word'],16))
        assert packed==int(v['rgb565_word'],16) and list(rgba)==v['rgba'],v['name']
        results.append({**v,'pass':True})
    negatives={
        'old_linear_max_255_rejected':convert(0xeee)[1]!=(255,255,255,255),
        'red_blue_swap_rejected':convert(0x00e)[1]!=(0,0,239,255),
        'red_green_swap_rejected':convert(0x00e)[1]!=(0,239,0,255),
        'rgb555_green_curve_rejected':convert(0x020)[1]!=(0,33,0,255),
        'constant_239_for_intermediate_rejected':convert(0xa62)[1]!=(239,239,239,255),
        'wrong_alpha_rejected':convert(0x000)[1]!=(0,0,0,0),
    }
    for word in (1,0x1000,-1):
        try: convert(word)
        except ValueError: negatives[f'invalid_cram_{word}_rejected']=True
        else: negatives[f'invalid_cram_{word}_rejected']=False
    assert all(negatives.values())
    # Literal CRAM words match existing ROM; palette/ROM/product are unchanged.
    build=json.loads((old/'fixture-build.json').read_text());rom=Path(build['rom']).read_bytes()
    assert hashlib.sha256(rom).hexdigest()==build['rom_sha256']
    palette_intervals=[]
    for i,words in enumerate(model['encoded_palettes']):
        offset=build['symbols'][f'visual_palette{i}'];expected=b''.join(w.to_bytes(2,'big') for w in words)
        assert rom[offset:offset+32]==expected
        palette_intervals.append({'palette':i,'file_interval':[offset,offset+32],'encoded_words':words,'sha256':hashlib.sha256(expected).hexdigest()})
    return {'schema':'rex-color-vectors-result/v2','methodology':'after v1 failure, authorized source-grounded correction; no framebuffer input','vectors':results,'negatives':negatives,'source_identities':identities,'palette_intervals':palette_intervals,'rom_sha256':build['rom_sha256'],'binary_rgb565_request':{'core_sha256':sha(core),'argument_value':2,'environment_command':10,'instruction_addresses':['0x5133B9','0x5133C1','0x5133CE']},'allPass':True}
if __name__=='__main__':
    result=verify(Path(sys.argv[1]));target=Path(sys.argv[2]);target.open('x').write(json.dumps(result,indent=2)+'\n');print(json.dumps({'vectors':len(result['vectors']),'negatives':len(result['negatives']),'allPass':result['allPass']}))
