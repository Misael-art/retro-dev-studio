#!/usr/bin/env python3
"""Independent authored static-copy reader controls; no game or CPU execution."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('linear_reader',HERE/'survey-linear-copies.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists()
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-linear-author-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest
    result={'status':'FAIL','scope':'Author static initializer/flow reader only','cases':[],'negatives':{}}
    try:
        vectors=[('41f9 00001000 43f8 8000 7007 22d8 51c8 fffc',12,4,'moveq','absolute_long',0x1000,['source','destination','count']),
            ('41fa 0ffe 43f8 8000 303c 0007 32d8 51c8 fffc',12,2,'move_word_immediate','pc_relative_word',0x1000,['source','destination','count']),
            ('43f9 00ff8000 41f9 00ff9000 7007 12d8 51c8 fffc',14,1,'moveq','absolute_long',0xff9000,['destination','source','count']),
            ('7007 41f9 00001000 43f8 8000 22d8 51c8 fffc',12,4,'moveq','absolute_long',0x1000,['count','source','destination'])]
        for code,at,width,kind,mode,source,order in vectors:
            rom=bytearray(8192);raw=bytes.fromhex(code);rom[:len(raw)]=raw
            cases=reader.read_copy(rom,at);assert len(cases)==1,'unique complete initializer'
            p=cases[0];assert (p['entry'],p['exit'],p['width'],p['count'])==(0,len(raw),width,8)
            assert p['counter_initialization']==kind and p['source_addressing']==mode and p['source_bus24']==source
            assert p['initialization_order']==order and p['base_in_domain'] and p['allowed_widths_in_memory_domain']==[1,2,4]
            result['cases'].append({'width':width,'kind':kind,'mode':mode,'order':order,'passed':True})
        raw=bytes.fromhex(vectors[0][0]);base=bytearray(8192);base[:len(raw)]=raw
        for name,at,value in [('operator',12,0x42),('inner_flow',17,0xf8),('pointer_alias',13,0xd9),('negative_moveq',11,0x80),('unknown_initializer',0,0x4e)]:
            bad=bytearray(base);bad[at]=value
            try:cases=reader.read_copy(bad,12)
            except AssertionError:cases=[]
            assert not cases,'negative accepted:'+name;result['negatives'][name]=True
        result['status']='PASS_AUTHOR_STATIC_LINEAR_READER'
    except Exception as error:result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
