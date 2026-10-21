#!/usr/bin/env python3
"""Literal author controls for the static ISA candidate reader, not CPU tracing."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('candidate_reader',HERE/'find-transfer-candidates.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists()
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-search-author-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest
    # Independently authored 26-byte program: absolute-short pointers,
    # D3/D4 counts, word transfer; no commercial bytes.
    short=bytes.fromhex('43f8 8000 41f8 9000 7603 7807 32d8 51cc fffc 43e9 0010 51cb fff2')
    long=bytes.fromhex('43f9 00ff8000 41f9 00ff9000 7603 7807 12d8 51cc fffc 43e9 0010 51cb fff2')
    result={'schema':'rex-static-search-author-qualification/v1','status':'FAIL','scope':'Static reader only, not emulator/caller/consumer qualification','negative_controls':{}}
    try:
        actual=reader.read_shape(short,0)
        assert all(actual[k]==v for k,v in f['short_expected'].items()),'literal short-form fields'
        other=reader.read_shape(long,0)
        assert other['opcode_shape_differs_primary'] and not other['distinct_implementation_gate'],'register-only differences must not count'
        assert other['current_class_encoding_supported'] and other['both_widths_in_existing_memory_domain']
        for name,at,value in [('operator',12,0x22),('inner_flow',17,0xfe),('outer_flow',25,0xf0),('pointer_role',13,0xd9),('negative_count',9,0x80)]:
            bad=bytearray(short);bad[at]=value
            try:reader.read_shape(bad,0)
            except AssertionError:result['negative_controls'][name]=True
            else:raise AssertionError('negative accepted:'+name)
        bad=bytearray(short);bad[6]=0x10
        assert not reader.read_shape(bad,0)['both_widths_in_existing_memory_domain'],'wrong memory map accepted'
        result['negative_controls']['out_of_map']=True
        result.update(status='PASS_LITERAL_STATIC_READER',positive_short=actual,register_only_not_counted=True)
    except Exception as error:result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
