#!/usr/bin/env python3
"""Reuse the frozen author qualifier with an explicitly pinned observer revision."""
import hashlib,importlib.util,json,sys,os
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
freeze=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m2-instrument-freeze.json').read_text())
source=HERE/'run-observer.py'
assert hashlib.sha256(source.read_bytes()).hexdigest()==freeze['files'][str(source.relative_to(ROOT))],'frozen qualifier changed'
assert len(sys.argv)==2 and sys.argv[1].startswith('qualify-v2-'),'usage: qualify-v2.py qualify-v2-<fresh-id>'
spec=importlib.util.spec_from_file_location('frozen_qualifier',source);q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
alias=q.SCRATCH/('observer-v2-input-'+sys.argv[1]);alias.mkdir(exist_ok=False)
(alias/'observe.lua').symlink_to(HERE/'observe-v2.lua')
q.HERE=alias
original_case=q.run_case
def with_capture(parent,variant):
 target=parent/('screens-'+variant);target.mkdir()
 os.environ['REX_SNAP_DIR']=str(target)
 return original_case(parent,variant)
q.run_case=with_capture
rc=q.main()
if rc==0:
 from PIL import Image
 results=[]
 parent=q.SCRATCH/sys.argv[1]
 for variant in ['positive','no-call','other-args']:
  work=parent/variant
  events=[json.loads(x) for x in (work/'events.jsonl').read_text().splitlines()]
  captures=[e for e in events if e['kind']=='screen_capture']
  assert captures and all(e['png_written'] for e in captures),'missing author screen capture'
  target=parent/('screens-'+variant)
  for png in sorted(target.glob('*.png')):
   raw=png.with_suffix('.snapshot.pixels').read_bytes()
   im=Image.open(png).convert('RGB');width,height=im.size
   assert len(raw)==width*height*4,'pixel dimensions'
   rgb=bytearray()
   for i in range(0,len(raw),4):
    color=int.from_bytes(raw[i:i+4],sys.byteorder)
    rgb.extend([(color>>16)&255,(color>>8)&255,color&255])
   assert bytes(rgb)==im.tobytes(),'PNG/native RGB mismatch'
   wrong=bytearray(rgb);wrong[0]^=1
   assert bytes(wrong)!=im.tobytes(),'pixel mutant accepted'
   results.append({'variant':variant,'width':width,'height':height,'raw_sha256':hashlib.sha256(raw).hexdigest(),'png_sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'pixel_format':'rendered_snapshot_rgb32_host_endian','png_equals_same_snapshot_target':True,'pixel_mutant_rejected':True,'limits':'capture plumbing only; does not prove independent palette or game visual oracle'})
 (parent/'screen-qualification.json').write_text(json.dumps({'passed':bool(results),'captures':results,'clock_contexts':'raw CPU/frame clocks separated; no invented monotonic global time'},indent=2)+'\n')
 print(json.dumps({'screen_captures_qualified':len(results)}),flush=True)
raise SystemExit(rc)
