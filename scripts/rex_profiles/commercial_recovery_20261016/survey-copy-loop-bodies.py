#!/usr/bin/env python3
"""Locate bounded nested-copy bodies without assuming in-region pointer setup.
Static metadata only; caller bindings and real invocation remain unknown.
"""
import hashlib
import json
import re
import sys
import time
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
def signed(x):return x-65536 if x&32768 else x
def sha(data):return hashlib.sha256(data).hexdigest()

def body(rom,at):
    assert at+14<=len(rom),'truncated'
    w=lambda p:int.from_bytes(rom[p:p+2],'big')
    op=w(at);assert op&0xf1f8 in (0x10d8,0x30d8),'transfer'
    sr,dr=op&7,op>>9&7;assert sr!=dr and sr<7 and dr<7,'pointer alias/A7'
    inner=w(at+2);assert inner&0xfff8==0x51c8 and at+4+signed(w(at+4))==at,'inner flow'
    cr=inner&7
    gapop=w(at+6);gr=gapop&7
    assert gapop==0x41e8|gr<<9|gr and gr in (sr,dr),'row LEA'
    gap=signed(w(at+8));assert gap>=0,'negative gap outside survey'
    outer=w(at+10);assert outer&0xfff8==0x51c8,'outer DBRA'
    rr=outer&7;assert rr!=cr,'counter alias'
    reset=at+12+signed(w(at+12));assert 0<=reset<at and at-reset in (2,4),'outer target'
    init=w(reset);columns=None;kind=None;input_register=None
    if at-reset==2 and init&0xf100==0x7000 and init>>9&7==cr and init&255<128:
        kind='moveq';columns=(init&255)+1
    elif at-reset==4 and init==0x303c|cr<<9 and w(reset+2)<128:
        kind='move_word_immediate';columns=w(reset+2)+1
    elif at-reset==2 and init&0xf1f8==0x3000 and init>>9&7==cr:
        kind='move_word_register';input_register=init&7
    assert kind,'unsupported column initialization (not converted to no-op)'
    if input_register is not None:assert input_register!=cr and input_register!=rr,'counter input overwritten/alias'
    return {'entry':reset,'transfer':at,'exit':at+14,'length':at+14-reset,
        'source_register':sr,'destination_register':dr,'row_register':rr,'column_register':cr,
        'column_reset':kind,'columns_constant':columns,'column_input_register':input_register,
        'width':1 if op>>12==1 else 2,'gap':gap,'gap_role':'destination' if gr==dr else 'source',
        'region_sha256':sha(rom[reset:at+14]),'source_address':'UNKNOWN_CALLER_INPUT','destination_address':'UNKNOWN_CALLER_INPUT','rows':'UNKNOWN_ENTRY_COUNTER',
        'current_production_region_supported':False,'real_game_invocation':'NOT_OBSERVED'}

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists()
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-loop-body-search-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert sha(Path(p).read_bytes())==digest,f'identity:{p}'
    started=time.monotonic();results=[]
    for target in f['targets']:
        assert time.monotonic()-started<60,'budget'
        with zipfile.ZipFile(target['archive']) as z:rom=z.read(target['member'])
        assert sha(rom)==target['rom_sha256'] and rom[0x100:0x104]==b'SEGA','raw identity/format'
        matches=[]
        for m in re.finditer(rb'[\x10\x12\x14\x16\x18\x1a\x1c\x30\x32\x34\x36\x38\x3a\x3c][\xd8-\xde]',rom):
            if m.start()%2:continue
            try:matches.append(body(rom,m.start()))
            except AssertionError:continue
        results.append({'archive':target['archive'],'member':target['member'],'rom_sha256':target['rom_sha256'],'bodies':matches})
    report={'schema':'rex-m5-loop-body-survey/v1','status':'STATIC_BODY_SURVEY_ONLY','elapsed_seconds':time.monotonic()-started,'targets':results,'limits':'Exploratory after complete-initializer search found none. No recovered caller bindings, runtime effect, production adaptation, or transfer claim. Other reserved payloads remain uninspected.'}
    out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'elapsed_seconds':report['elapsed_seconds'],'counts':{Path(t['archive']).name:len(t['bodies']) for t in results}},indent=2))

if __name__=='__main__':main()
