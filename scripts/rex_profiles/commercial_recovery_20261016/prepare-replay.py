#!/usr/bin/env python3
"""Prepare a private GX replay through the existing qualified QA adapter."""
import ctypes as C,hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'scripts/rex_profiles/integration_20261007'))
from lr import Core
ROM=Path('/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin')
CORE=Path('/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/toolchains/libretro/cores/genesis_plus_gx_libretro.so')
APP=Path('/home/misael/Projects/REX-INTEGRATION-2026-10-05/src-tauri/target-test/debug/retro-dev-studio')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 assert len(sys.argv)==2 and sys.argv[1].startswith('prepared-replay-'),'usage: prepare-replay.py prepared-replay-<fresh-id>'
 freeze=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-app-replay-freeze.json').read_text())
 assert sha(ROM)==freeze['rom_sha256'] and sha(CORE)==freeze['core_sha256'] and sha(APP)==freeze['app_sha256'],'input identity'
 assert sha(HERE/'prepare-replay.py')==freeze['generator_sha256'],'generator changed after freeze'
 work=Path('/home/misael/rds-scratch/commercial_recovery_20261016')/sys.argv[1];work.mkdir(exist_ok=False)
 c=Core(str(CORE),str(ROM));c.run(500);c.buttons=1<<3;c.run(10);c.buttons=0;c.run(600)
 c.poke(0xfff600,b'\x10')
 lib=c.lib;lib.retro_serialize_size.restype=C.c_size_t;size=lib.retro_serialize_size();assert size>0,'serialize unavailable'
 state=C.create_string_buffer(size);lib.retro_serialize.argtypes=[C.c_void_p,C.c_size_t];lib.retro_serialize.restype=C.c_bool
 assert lib.retro_serialize(state,size),'serialize failed'
 c.run(180);raw,width,height,pitch=c.frame;assert c.fmt==2 and (width,height,pitch)==(320,224,640),'unexpected video mode'
 neutral={k:False for k in 'b y select start up down left right a x l r'.split()}
 replay={'rom_path':str(ROM),'initial_state':list(state.raw),'frames':[neutral for _ in range(180)],'final_framebuffer':list(raw),'final_frame_size':{'width':width,'height':height,'pitch':pitch},'final_pixel_format':'Rgb565'}
 path=work/'original.rds-replay';path.write_text(json.dumps(replay,separators=(',',':'))+'\n')
 rgba=bytearray()
 for i in range(0,len(raw),2):
  p=raw[i]|raw[i+1]<<8;r5=(p>>11)&31;g6=(p>>5)&63;b5=p&31
  rgba.extend([(r5<<3)|(r5>>2),(g6<<2)|(g6>>4),(b5<<3)|(b5>>2),255])
 (work/'reference.rgba').write_bytes(rgba)
 ranges=[(0xff1020,8128),(0xfff800,640),(0xfffb00,128),(0xfff600,1)]
 memory=[]
 for address,length in ranges:
  data=c.peek(address,length);name=f'reference-{address:06x}.bin';(work/name).write_bytes(data)
  memory.append({'address':address,'length':length,'file':str(work/name),'sha256':hashlib.sha256(data).hexdigest()})
 wrong=dict(replay);wrong['rom_path']=str(work/'wrong-rom.bin');(work/'wrong-rom.rds-replay').write_text(json.dumps(wrong,separators=(',',':'))+'\n')
 wrong=dict(replay);wrong['initial_state']=replay['initial_state'][:-1];(work/'wrong-state.rds-replay').write_text(json.dumps(wrong,separators=(',',':'))+'\n')
 wrong=dict(replay);wrong['final_framebuffer']=list(raw);wrong['final_framebuffer'][0]^=1;(work/'wrong-frame.rds-replay').write_text(json.dumps(wrong,separators=(',',':'))+'\n')
 spec={'schema':'rex-prepared-runtime-observation/v1','id':sys.argv[1],'rom':str(ROM),'rom_sha256':sha(ROM),'app':str(APP),'app_sha256':sha(APP),'core':str(CORE),'core_sha256':sha(CORE),'replay':str(path),'replay_sha256':sha(path),'reference_rgba':str(work/'reference.rgba'),'reference_rgba_sha256':hashlib.sha256(rgba).hexdigest(),'memory':memory,'expected_mame_layout_sha256':freeze['mame_final_layout_sha256'],'frames':180,'width':width,'height':height,'output':str(work/'app-observation'),'negative_replays':{k:{'path':str(work/f'{k}.rds-replay'),'sha256':sha(work/f'{k}.rds-replay')} for k in ['wrong-rom','wrong-state','wrong-frame']},'prepared_origin':'standalone GX 1110 frames then explicit CPU WRAM byte FFF600=10; replay begins from serialized prepared state','independence':'same pinned GX core reference for session correspondence, not independent visual/game oracle; no modified image involved','mame_run':'commercial-001, separate ID/runtime/clock; frame-end equality does not prove a call in GX'}
 (work/'app-spec.json').write_text(json.dumps(spec,indent=2)+'\n')
 manifest={'schema':'rex-prepared-replay-generation/v1','id':sys.argv[1],'command':sys.argv,'rom_sha256':sha(ROM),'core_sha256':sha(CORE),'generator_sha256':sha(HERE/'prepare-replay.py'),'state_bytes':size,'state_sha256':hashlib.sha256(state.raw).hexdigest(),'spec_sha256':sha(work/'app-spec.json'),'limits':spec['independence'],'outputs':{p.name:sha(p) for p in work.iterdir() if p.is_file()}}
 (work/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 lib.retro_unload_game();lib.retro_deinit();assert sha(ROM)==freeze['rom_sha256'],'original changed'
 print(json.dumps({'id':spec['id'],'spec':str(work/'app-spec.json'),'reference_sha256':spec['reference_rgba_sha256'],'state_sha256':manifest['state_sha256'],'state_bytes':size},indent=2))
if __name__=='__main__':main()
