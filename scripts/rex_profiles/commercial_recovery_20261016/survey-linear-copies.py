#!/usr/bin/env python3
"""Static contiguous-copy survey with complete typed constant initializers.
No caller argument guessing, no production changes, no raw code exported.
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

def prefix(rom,start,transfer,sr,dr,cr):
    cursor=start;addresses={};count=None;count_kind=None;order=[];modes={}
    def word():
        nonlocal cursor
        assert cursor+2<=transfer,'truncated initializer'
        value=int.from_bytes(rom[cursor:cursor+2],'big');cursor+=2;return value
    for _ in range(3):
        at=cursor;op=word()
        if op&0xf1fe==0x41f8 or op&0xf1ff==0x41fa:
            reg=op>>9&7;assert reg in (sr,dr) and reg not in addresses,'pointer setup'
            if op&0x3f==0x39:address=word()<<16|word();mode='absolute_long'
            elif op&0x3f==0x38:address=signed(word())&0xffffffff;mode='absolute_word'
            else:address=(at+2+signed(word()))&0xffffffff;mode='pc_relative_word'
            addresses[reg]=address;modes[reg]=mode;order.append('source' if reg==sr else 'destination')
        elif op&0xf100==0x7000:
            assert op>>9&7==cr and op&255<128 and count is None,'MOVEQ count'
            count=(op&255)+1;count_kind='moveq';order.append('count')
        elif op==0x303c|cr<<9:
            assert count is None,'duplicate count'
            value=word();assert value<32768,'bounded word count'
            count=value+1;count_kind='move_word_immediate';order.append('count')
        else:raise AssertionError('unknown initializer not replaced by no-op')
    assert cursor==transfer and count is not None and set(addresses)=={sr,dr},'complete initialization'
    return addresses,modes,count,count_kind,order

def read_copy(rom,at):
    assert at+6<=len(rom)
    w=lambda p:int.from_bytes(rom[p:p+2],'big')
    op=w(at);key=op&0xf1f8;assert key in (0x10d8,0x30d8,0x20d8),'copy operator'
    width={0x10d8:1,0x30d8:2,0x20d8:4}[key]
    sr,dr=op&7,op>>9&7;assert sr!=dr and sr<7 and dr<7,'pointer alias/A7'
    branch=w(at+2);assert branch&0xfff8==0x51c8 and signed(w(at+4))==-4,'single DBRA flow'
    cr=branch&7;candidates=[]
    for start in range(max(0,at-16),at-9,2):
        try:addresses,modes,count,count_kind,order=prefix(rom,start,at,sr,dr,cr)
        except AssertionError:continue
        source,destination=addresses[sr],addresses[dr];sb,db=source&0xffffff,destination&0xffffff
        allowed=[]
        for size in (1,2,4):
            length=count*size;source_rom=sb+length<=len(rom);source_ram=0xff0000<=sb and sb+length<=0x1000000
            valid=(0xff0000<=db and db+length<=0x1000000 and (source_rom or source_ram) and (source_rom or sb+length<=db or db+length<=sb) and (size==1 or (sb|db)&1==0))
            if valid:allowed.append(size)
        candidates.append({'entry':start,'transfer':at,'exit':at+6,'length':at+6-start,
            'source_register':sr,'destination_register':dr,'counter_register':cr,'count':count,'counter_initialization':count_kind,'width':width,
            'source_bus24':sb,'destination_bus24':db,'source_initial_register32':source,'destination_initial_register32':destination,
            'source_addressing':modes[sr],'destination_addressing':modes[dr],'initialization_order':order,
            'source_space':'linear_rom' if sb<len(rom) else 'canonical_wram' if sb>=0xff0000 else 'unsupported',
            'allowed_widths_in_memory_domain':allowed,'base_in_domain':width in allowed,
            'distinct_implementation':'single DBRA, no outer loop/row gap, statically initialized pointers/count; not primary nested byte-copy implementation',
            'region_sha256':sha(rom[start:at+6]),'production_recognition':'NOT_MEASURED','real_invocation':'NOT_OBSERVED'})
    return candidates

def main():
    assert len(sys.argv)==2
    out=Path(sys.argv[1]);assert not out.exists()
    f=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m5-linear-search-freeze.json').read_text())
    for p,digest in f['inputs'].items():assert sha(Path(p).read_bytes())==digest,f'identity:{p}'
    started=time.monotonic();results=[]
    for target in f['targets']:
        assert time.monotonic()-started<60,'budget'
        with zipfile.ZipFile(target['archive']) as z:rom=z.read(target['member'])
        assert sha(rom)==target['rom_sha256'] and rom[0x100:0x104]==b'SEGA','identity/format'
        copies=[]
        for m in re.finditer(rb'[\x10\x12\x14\x16\x18\x1a\x1c\x20\x22\x24\x26\x28\x2a\x2c\x30\x32\x34\x36\x38\x3a\x3c][\xd8-\xde]',rom):
            if m.start()%2:continue
            try:copies.extend(read_copy(rom,m.start()))
            except AssertionError:continue
        results.append({'archive':target['archive'],'member':target['member'],'rom_sha256':target['rom_sha256'],'copies':copies})
    result={'schema':'rex-m5-linear-copy-survey/v1','status':'STATIC_LINEAR_SURVEY_ONLY','elapsed_seconds':time.monotonic()-started,'targets':results,'limits':'Inspected exploratory14ROMs only. Four reserved payloads remain uninterpreted. Candidate metadata is not production recognition, actual execution, semantic equivalence or transfer.'}
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'elapsed_seconds':result['elapsed_seconds'],'counts':{Path(t['archive']).name:{'candidates':len(t['copies']),'in_domain':sum(c['base_in_domain'] and len(c['allowed_widths_in_memory_domain'])>1 for c in t['copies'])} for t in results}},indent=2))

if __name__=='__main__':main()
