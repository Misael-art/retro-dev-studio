#!/usr/bin/env python3
"""Independent bounded MOVE/DBRA/LEA memory and boundary-state comparison."""
import hashlib
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]

def sha(p):
    with p.open('rb') as source:return hashlib.file_digest(source,'sha256').hexdigest()

def accesses(e):
    a,v,m=e['address'],e['data'],e['mask']
    if m==0xff00:return [(a,v>>8&255)]
    if m==0x00ff:return [(a+1,v&255)]
    assert m==0xffff,'native bus mask outside qualified domain'
    return [(a,v>>8&255),(a+1,v&255)]

def predict_boundary(entry,source,width,roles):
    last=int.from_bytes(source[4096*width-width:4096*width],'big')
    flags=(entry['sr']&0xfff0)|(8 if last&(1<<(width*8-1)) else 0)|(4 if last==0 else 0)
    expected={'pc':0x1b706,'a0':0xff4000+4096*width,
        'a1':0xff1020+64*(64*width+64),'a7':entry['a7'],
        'stack_top_long':entry['stack_top_long'],'sr':flags}
    for reg in ('d0','d1','d2'):
        expected[reg]=65535 if reg in (roles['row_counter'],roles['column_counter']) else entry[reg]
    return expected

def literal_role_controls(roles):
    entry={'d0':0x12345678,'d1':0x22222222,'d2':0x33333333,
        'a7':0xfffff8,'stack_top_long':0x2468,'sr':0}
    results=[]
    for width,last,sr,wanted in [(1,0,0x2700,0x2704),(1,1,0x271f,0x2710),(1,0x80,0x2000,0x2008),(2,0x8000,0x231f,0x2318)]:
        source=bytearray(8192);source[4096*width-width:4096*width]=last.to_bytes(width,'big')
        entry['sr']=sr
        state=predict_boundary(entry,source,width,roles)
        assert state['d0']==0x12345678 and state['d1']==state['d2']==65535,'distinct sentinel register roles'
        assert state['sr']==wanted,'literal CCR vector'
        assert state['a0']==(0xff5000 if width==1 else 0xff6000) and state['a1']==(0xff3020 if width==1 else 0xff4020)
        wrong=dict(roles,row_counter='d0',column_counter='d1')
        assert predict_boundary(entry,source,width,wrong)!=state,'wrong-role model accepted'
        results.append({'width':width,'initial_sr':sr,'expected_sr':wanted,'d0_sentinel_preserved':True,'wrong_roles_refused':True})
    return results

def verify(path,width,freeze,mutation=None):
    entered=exited=False;entry=None;source=None;before=None;reads=writes=0
    predicted=None;observed_snapshot=False;mutated=False;run_id=None;seq=0;terminal=False
    copied=4096*width;stride=64*width+64
    for line in path.open():
        e=json.loads(line)
        assert e['seq']==seq+1,'sequence gap';seq=e['seq']
        run_id=run_id or e['run_id'];assert e['run_id']==run_id,'run identity'
        assert e['instrument_sha256']==freeze['observer_sha256'],'instrument identity'
        assert e['rom_sha256']==freeze['original_rom_sha256' if width==1 else 'copy_sha256'],'ROM identity'
        if mutation=='identity' and e['kind']=='copy_entry' and not mutated:
            e=dict(e,rom_sha256='0'*64);mutated=True
            assert e['rom_sha256']==freeze['original_rom_sha256' if width==1 else 'copy_sha256'],'ROM identity'
        if e['kind']=='copy_entry':
            assert not entered,'multiple copy entries outside frozen case'
            entered=True;entry=e
            assert e['pc']==0x1b6e8,'entry boundary'
        if e['kind']=='pre_copy_expanded_source' and entered:
            source=bytes.fromhex(e['hex'])
            assert len(source)==8192 and hashlib.sha256(source).hexdigest()==freeze['source8192_sha256'],'source pin'
        if e['kind']=='pre_copy_expanded_destination' and entered:
            before=bytes.fromhex(e['hex']);assert len(before)==12224 and not any(before),'pre-copy destination known zero'
            assert source is not None
            predicted=bytearray(before)
            for row in range(64):
                predicted[row*stride:row*stride+64*width]=source[row*64*width:(row+1)*64*width]
        if e['kind'] in ('read','write') and entered and not exited and e['instruction_pc']==0x1b6f8:
            assert predicted is not None and e['address_space']=='md.cpu.bus24'
            if mutation=='flow' and e['kind']=='write' and not mutated:
                mutated=True;continue
            data=accesses(e)
            assert len(data)==width,'transfer operator width'
            if mutation=='operator' and not mutated:
                mutated=True;assert len(data)==3-width,'wrong operator'
            if e['kind']=='read':
                assert writes==reads,'read/write order'
                offset=reads*width
                assert data==[(0xff4000+offset+i,source[offset+i]) for i in range(width)],'source index/value'
                reads+=1
            else:
                assert reads==writes+1,'write without exactly one read'
                row,col=divmod(writes,64);offset=row*stride+col*width
                expected=[(0xff1020+offset+i,source[writes*width+i]) for i in range(width)]
                if mutation=='destination' and not mutated:
                    data=[(a+2,v) for a,v in data];mutated=True
                assert data==expected,'destination index/value'
                writes+=1
        elif entered and not exited and e['kind']=='write' and predicted is not None:
            # Do not silently discard interleaved modifications in the region.
            for address,_ in accesses(e):
                assert not (0xff1020<=address<0xff1020+12224 or 0xff4000<=address<0xff4000+8192),'interleaved buffer write outside model'
        if e['kind']=='copy_return':
            assert entered and not exited and reads==writes==4096,'nested-loop count/flow'
            exited=True
            if mutation=='state' and not mutated:e=dict(e,d1=e['d1']^1);mutated=True
            expected=predict_boundary(entry,source,width,freeze['typed_ir_registers'])
            if mutation=='flags' and not mutated:e=dict(e,sr=e['sr']^1);mutated=True
            assert all(e[k]==v for k,v in expected.items()),'boundary registers/CCR differ'
            boundary={'expected':expected,'observed':{k:e[k] for k in expected}}
        if e['kind']=='copy_snapshot':
            assert exited and bytes.fromhex(e['hex'])==predicted[:8128],'native memory snapshot'
            observed_snapshot=True
        if e['kind']=='collection_end':
            assert e['complete'] and e['dropped']==0,'incomplete observation'
            terminal=True
    assert entered and exited and observed_snapshot and terminal,'missing required boundaries'
    if mutation:assert mutated,'negative not exercised'
    return {'width':width,'reads':reads,'writes':writes,'copied_bytes':copied,
        'stride':stride,'span':63*stride+64*width,'final_pointer_after_last_gap':boundary['observed']['a1'],
        'predicted_destination12224_sha256':hashlib.sha256(predicted).hexdigest(),
        'boundary_state':boundary,'native_snapshot_bytes':8128,
        'limits':'Only A0/A1,D0/D1,D2,A7,stack-top,SR observed at declared boundaries. Other registers, stack contents, IRQ internals, cycles and external side effects not compared; full destination native GX proof is separate M3. copy_return is region exit, not RET.'}

def main():
    assert len(sys.argv)==3,'edited-private-trace fresh-output-json'
    edited,out=map(Path,sys.argv[1:]);assert not out.exists()
    freeze=json.loads((ROOT/'data/rex_profiles/commercial_recovery_20261016/m4-freeze-v2.json').read_text())
    original=Path(freeze['original_trace']);assert sha(original)==freeze['original_trace_sha256']
    adapter=json.loads((edited.parent/'adapter-result.json').read_text())
    assert adapter['status']=='PASS_EDITED_ROM_OBSERVED' and sha(edited)==adapter['trace_sha256']
    result={'schema':'rex-copy-grid-semantic-state-verification/v1','status':'FAIL','original_trace_sha256':sha(original),'edited_trace_sha256':sha(edited),'cases':[]}
    try:
        result['literal_role_controls']=literal_role_controls(freeze['typed_ir_registers'])
        for path,width in [(original,1),(edited,2)]:
            result['cases'].append(verify(path,width,freeze))
        negatives={}
        for name in ['identity','operator','flow','destination','state','flags']:
            try:verify(edited,2,freeze,name)
            except AssertionError as error:negatives[name]={'refused':True,'reason':str(error)}
            else:raise AssertionError('negative accepted:'+name)
        result.update(status='PASS_BOUNDED_COPY_MEMORY_AND_OBSERVED_STATE',negative_controls=negatives)
    except Exception as error:result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return 0 if result['status'].startswith('PASS') else 1

if __name__=='__main__':raise SystemExit(main())
