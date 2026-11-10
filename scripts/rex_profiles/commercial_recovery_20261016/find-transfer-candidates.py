#!/usr/bin/env python3
"""Static, read-only candidate survey; no production adaptation or runtime claim.

An independent ISA shape reader includes absolute-word/long LEA forms so the
survey can expose unsupported generic forms, rather than hide engine limits.
Only structural metadata/hashes leave the private ROM input, never code bytes.
"""
import hashlib
import json
import re
import sys
import time
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]

def signed16(x):return x-65536 if x&32768 else x
def sha(data):return hashlib.sha256(data).hexdigest()

def read_shape(rom,entry):
    cursor=entry;ops=[]
    def word():
        nonlocal cursor
        assert cursor+2<=len(rom),'truncated'
        value=int.from_bytes(rom[cursor:cursor+2],'big');cursor+=2;return value
    def lea():
        op=word();assert op&0xf1fe==0x41f8,'not absolute LEA'
        reg=op>>9&7;ops.append(op)
        if op&1:
            address=word()<<16|word();kind='absolute_long'
        else:
            address=signed16(word())&0xffffffff;kind='absolute_word'
        return reg,address,kind
    dr,destination,dmode=lea();sr,source,smode=lea()
    row_init=word();col_init=word()
    assert row_init&0xf100==col_init&0xf100==0x7000,'not MOVEQ'
    rows,columns=row_init&255,col_init&255
    assert rows<128 and columns<128,'signed counter domain'
    rr,cr=row_init>>9&7,col_init>>9&7;rows+=1;columns+=1
    ops.extend([row_init&0xff00,col_init&0xff00])
    transfer_at=cursor;transfer=word();ops.append(transfer)
    assert transfer&0xf1f8 in (0x10d8,0x30d8),'not byte/word postincrement copy'
    assert transfer>>9&7==dr and transfer&7==sr,'pointer roles disconnected'
    width=1 if transfer>>12==1 else 2
    inner_at=cursor;inner=word();displacement=signed16(word());ops.append(inner)
    assert inner==0x51c8|cr and inner_at+2+displacement==transfer_at,'inner flow'
    gap_op=word();gap=signed16(word());ops.append(gap_op)
    assert gap_op==0x41e8|dr<<9|dr and gap>=0,'row advance'
    outer_at=cursor;outer=word();displacement=signed16(word());ops.append(outer)
    column_init_at=transfer_at-2
    assert outer==0x51c8|rr and outer_at+2+displacement==column_init_at,'outer flow'
    assert sr<7 and dr<7 and sr!=dr and rr!=cr,'alias/A7'
    source_bus,destination_bus=source&0xffffff,destination&0xffffff
    valid=True;reasons=[]
    for w in (1,2):
        copied=rows*columns*w;stride=columns*w+gap;span=rows*stride-gap
        ok=(source_bus>=0xff0000 and source_bus+copied<=0x1000000 and destination_bus>=0xff0000 and destination_bus+rows*stride<=0x1000000 and (source_bus+copied<=destination_bus or destination_bus+span<=source_bus) and (w==1 or (source_bus|destination_bus|stride)&1==0))
        if not ok:valid=False;reasons.append(f'width{w}: map/alignment/overlap')
    primary_ops=[0x43f9,0x41f9,0x7200,0x7400,0x12d8,0x51ca,0x43e9,0x51c9]
    # Different register allocation alone is insufficient for this survey's
    # second-implementation gate; require addressing form or transfer operator.
    distinct_implementation=(smode!='absolute_long' or dmode!='absolute_long' or width!=1)
    currently_supported=(smode==dmode=='absolute_long' and source==source_bus and destination==destination_bus)
    return {'entry':entry,'exit':cursor,'length':cursor-entry,'transfer_offset':transfer_at-entry,
        'source_bus24':source_bus,'destination_bus24':destination_bus,
        'source_initial_register32':source,'destination_initial_register32':destination,
        'source_register':sr,'destination_register':dr,'row_register':rr,'column_register':cr,
        'source_addressing':smode,'destination_addressing':dmode,
        'rows':rows,'columns':columns,'width':width,'gap':gap,
        'region_sha256':sha(rom[entry:cursor]),'opcode_shape_sha256':sha(b''.join(op.to_bytes(2,'big') for op in ops)),
        'opcode_shape_differs_primary':ops!=primary_ops,
        'distinct_implementation_gate':distinct_implementation,
        'current_class_encoding_supported':currently_supported,
        'both_widths_in_existing_memory_domain':valid,'domain_refusals':reasons}

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists(),'refuse overwrite'
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-search-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert sha(Path(p).read_bytes())==digest,f'identity:{p}'
    started=time.monotonic();results=[]
    for target in f['targets']:
        assert time.monotonic()-started<f['budget_seconds'],'survey budget'
        with zipfile.ZipFile(target['archive']) as z:rom=z.read(target['member'])
        assert len(rom)==target['rom_bytes'] and sha(rom)==target['rom_sha256'],'payload identity'
        result={'archive':target['archive'],'member':target['member'],'rom_sha256':target['rom_sha256'],'candidates':[]}
        if rom[0x100:0x104]!=b'SEGA':
            result['status']='UNSUPPORTED_RAW_FORMAT_NO_NORMALIZATION';results.append(result);continue
        for match in re.finditer(rb'[\x41\x43\x45\x47\x49\x4b\x4d][\xf8\xf9]',rom):
            if match.start()%2:continue
            try:candidate=read_shape(rom,match.start())
            except (AssertionError,IndexError):continue
            result['candidates'].append(candidate)
        result['status']='STATIC_SURVEY_ONLY';results.append(result)
    report={'schema':'rex-distinct-implementation-candidate-survey/v1','status':'STATIC_SURVEY_COMPLETE','elapsed_seconds':time.monotonic()-started,'targets':results,'limits':'Candidate shape reader only, not production recognition, real routine call, second-engine transfer or code-equivalence proof. Translated local ROMs, not asserted pristine retail. Inputs hashed before code interpretation; after this scan candidate regions are inspected, no longer truly unseen.'}
    out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'elapsed_seconds':report['elapsed_seconds'],'results':[{'archive':Path(t['archive']).name,'status':t['status'],'candidates':len(t['candidates']),'in_domain':sum(c['both_widths_in_existing_memory_domain'] for c in t['candidates']),'distinct_in_domain':sum(c['both_widths_in_existing_memory_domain'] and c['distinct_implementation_gate'] for c in t['candidates'])} for t in results]},indent=2))

if __name__=='__main__':main()
