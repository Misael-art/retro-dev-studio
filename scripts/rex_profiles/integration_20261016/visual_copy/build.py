#!/usr/bin/env python3
"""Build authored presentation with the existing pinned SGDK toolchain.
Refuses existing output. No ROM patching here; the product publishes all edits.
"""
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[4]
assets=json.loads((root/'data/rex_profiles/integration_20261016/visual-copy/assets.json').read_text())
out=Path(sys.argv[1]).resolve(); out.mkdir(parents=True,exist_ok=False)
project=out/'project';shutil.copytree(Path(__file__).parent/'project',project)
cache=Path(json.loads((root/'src-tauri/target-test/validation/host-readiness.json').read_text())['paths']['native_cache'])
sdk=cache/'toolchains/sgdk';bin=cache/'toolchains/m68k-elf/bin'
# Literal author resources for the SGDK consumer, independent of the oracle.
rows=[]
for tile in assets['tiles']+[[[1]*8]*8,[[2]*8]*8]:
    rows.extend(int(''.join(str(v) for v in row),16) for row in tile)
text='#include <genesis.h>\nconst u8 visual_resource[64]={'+','.join(map(str,assets['source']))+'};\n'
text+='const u32 visual_tiles[80]={'+','.join(hex(v) for v in rows)+'};\n'
for n,values in enumerate([[0,0x00e,0x0e0,0xe00],[0,0x0ee,0xee0,0xe0e],[0,0,0xeee]]):
    text+=f'const u16 visual_palette{n}[16]={{'+','.join(hex(v) for v in values+[0]*(16-len(values)))+'};\n'
(project/'src/assets.c').write_text(text)
(project/'src/assets.h').write_text('extern const u8 visual_resource[64];\nextern const u32 visual_tiles[80];\nextern const u16 visual_palette0[16],visual_palette1[16],visual_palette2[16];\n')
env=os.environ.copy();env.update(SGDK=str(sdk),PATH=str(bin)+':'+str(sdk/'bin')+':'+env['PATH'])
subprocess.run(['rtk','proxy','make'],cwd=project,env=env,check=True)
rom=project/'out/rom.bin'; b=rom.read_bytes()
symbols={line.split()[2]:int(line.split()[0],16) for line in (project/'out/symbol.txt').read_text().splitlines() if len(line.split())==3}
entry,end,scope=(symbols[k] for k in ('visual_copy_entry','visual_copy_end','visual_scope'))
scope &= 0xffffff # official SGDK linker uses E0FFxxxx aliases; fixture kernel uses canonical CPU24
assert end-entry==30 and 0xff0000<=scope and scope+484<=0x1000000
resource=symbols['visual_resource'];assert b[resource:resource+64]==bytes(assets['source'])
manifest={'schema':'rex-visual-build/v1','rom':str(rom),'rom_sha256':hashlib.sha256(b).hexdigest(),'rom_size':len(b),'symbols':{k:symbols[k] for k in ('visual_copy_entry','visual_copy_end','visual_scope','visual_resource','visual_tiles','visual_palette0','visual_palette1','visual_palette2')},'recovered_bytes_hex':b[entry:end].hex(),'source_resource_sha256':hashlib.sha256(b[resource:resource+64]).hexdigest(),'toolchain':{'sdk':str(sdk),'gcc_sha256':hashlib.sha256((bin/'m68k-elf-gcc').read_bytes()).hexdigest()},'source_files':{str(f.relative_to(project)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((project/'src').glob('*')) if f.is_file()}}
(out/'build.json').write_text(json.dumps(manifest,indent=2)+'\n')
spec=json.loads((root/'data/rex_profiles/integration_20261016/copy-grid-journey.json').read_text())
spec.update(rom=str(rom),rom_sha256=manifest['rom_sha256'],declared_region={'entry':entry,'exits':[end]})
spec.pop('allowed_diff_offsets',None)
spec['probe'].update(done_addr=scope+480,done_magic=0x56495355,initial_state='SGDK boot plus explicitly initialized authored Scope; no recovered game caller',reference={'source':scope+16,'destination':scope+96,'rows':4,'columns':8,'gap':16,'width':1})
spec['visual']={'oracle_dir':str(out.parent/'oracle'),'oracle_manifest_sha256':hashlib.sha256((root/'data/rex_profiles/integration_20261016/visual-copy/oracle.json').read_bytes()).hexdigest(),'scope_address':scope,'scope_length':484,'minimum_fresh_frames':60,'rom_resource_offset':resource}
(out/'journey.json').write_text(json.dumps(spec,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
