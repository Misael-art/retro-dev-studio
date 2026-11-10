#!/usr/bin/env python3
"""Author literal controls for nested body survey; not runtime qualification."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('body_reader',HERE/'survey-copy-loop-bodies.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists()
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-loop-search-author-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest
    result={'status':'FAIL','scope':'Static ISA body reader only, no commercial/runtime claim','cases':[],'negative_controls':{}}
    try:
        cases=[('moveq','7807 32d8 51cc fffc 43e9 0010 51cb fff2',2,8,'destination'),
               ('move_word_register','3805 32d8 51cc fffc 43e9 0010 51cb fff2',2,None,'destination'),
               ('move_word_immediate','383c 0007 32d8 51cc fffc 43e9 0010 51cb fff0',4,8,'destination'),
               ('moveq','7807 32d8 51cc fffc 41e8 0010 51cb fff2',2,8,'source')]
        for kind,hex_,at,cols,role in cases:
            actual=reader.body(bytes.fromhex(hex_),at)
            assert actual['column_reset']==kind and actual['columns_constant']==cols and actual['gap_role']==role
            assert (actual['entry'],actual['exit'],actual['width'],actual['source_register'],actual['destination_register'],actual['row_register'],actual['column_register'])==(0,at+14,2,0,1,3,4)
            result['cases'].append({'kind':kind,'role':role,'length':actual['length'],'passed':True})
        base=bytes.fromhex(cases[0][1])
        for name,at,value in [('operator',2,0x22),('inner_flow',7,0xfe),('outer_flow',15,0xf0),('pointer_alias',3,0xd9),('unknown_column_op',0,0x4e)]:
            bad=bytearray(base);bad[at]=value
            try:reader.body(bad,2)
            except AssertionError:result['negative_controls'][name]=True
            else:raise AssertionError('negative accepted:'+name)
        result['status']='PASS_AUTHOR_STATIC_BODY_READER'
    except Exception as error:result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
