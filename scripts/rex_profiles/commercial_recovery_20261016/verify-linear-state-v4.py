#!/usr/bin/env python3
"""Independent conditional copy model; no app decoder or modified framebuffer input."""
import hashlib
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/rex_profiles/commercial_recovery_20261016'

def digest(b):
    return hashlib.sha256(b).hexdigest()

def predict(shape, entry, source, before, width):
    assert width in shape['allowed_widths_in_memory_domain'], 'operator domain'
    n = shape['count'] * width
    assert len(source) >= n and len(before) >= n, 'memory domain'
    state = {k: entry[k] for k in [*[f'a{i}' for i in range(8)], *[f'd{i}' for i in range(8)], 'sr', 'stack_top_long']}
    for role in ['source', 'destination']:
        state[f"a{shape[role+'_register']}"] = (shape[role+'_initial_register32'] + n) & 0xffffffff
    counter = f"d{shape['counter_register']}"
    state[counter] = (entry[counter] & 0xffff0000 if shape['counter_initialization'] == 'move_word_immediate' else 0) | 65535
    last = int.from_bytes(source[n-width:n], 'big')
    state['sr'] = (entry['sr'] & 0xfff0) | (8 if last & (1 << (8*width-1)) else 0) | (4 if last == 0 else 0)
    state['pc'] = shape['exit']
    return state, source[:n] + before[n:]

def accesses(event):
    a, v, mask = event['address'], event['data'], event['mask']
    assert mask in [255, 65280, 65535], 'unqualified native bus mask'
    return ([(a, v >> 8 & 255)] if mask == 65280 else
            [(a+1, v & 255)] if mask == 255 else [(a, v >> 8 & 255), (a+1, v & 255)])

def verify(events, target, ident, observer, rom, mutation=None):
    shape = target['shape']; width = shape['width']; n = shape['count'] * width
    current = None; calls = []; ended = False; mutated = False
    for seq, original in enumerate(events, 1):
        e = dict(original); kind = e['kind']
        if mutation == 'identity' and not mutated:
            e['rom_sha256'] = '0'*64; mutated = True
        assert e['seq'] == seq and e['run_id'] == ident, 'sequence/run identity'
        assert e['rom_sha256'] == digest(rom) and e['instrument_sha256'] == observer, 'ROM/instrument identity'
        if kind == 'profile_entry':
            assert current is None and e['pc'] == shape['entry'], 'entry/flow'
            current = dict(entry=e, reads=[], writes=[], nontransfer_reads=[])
        elif kind == 'profile_region_bytes' and current is not None:
            region = bytes.fromhex(e['hex'])
            if mutation == 'operator' and not mutated:
                region = bytes([region[0] ^ 1]) + region[1:]; mutated = True
            assert digest(region) == shape['region_sha256'], 'operator/control bytes'
            current['region'] = True
        elif kind == 'profile_source_before' and current is not None:
            source = bytes.fromhex(e['hex']); start = shape['source_bus24']
            expected_length = shape['count']*max(shape['allowed_widths_in_memory_domain'])
            assert len(source) == expected_length, 'source snapshot span'
            if shape['source_space'] == 'linear_rom':
                assert source == rom[start:start+len(source)] and digest(source) == target['maximum_source_sha256'], 'immutable ROM source'
            else:
                assert shape['source_space'] == 'canonical_wram' and 0xff0000 <= start and start+len(source) <= 0x1000000, 'conditional WRAM source domain'
                # Source is a measured pre-entry input, never asserted independently predicted.
                # Disjoint envelopes and exact access/value/state comparisons remain mandatory.
            current['source'] = source
        elif kind == 'profile_destination_before' and current is not None:
            current['before'] = bytes.fromhex(e['hex'])
        elif kind in ['read', 'write'] and current is not None:
            assert e['address_space'] == 'md.cpu.bus24', 'bus domain'
            pc = shape['entry']; instruction_starts = []
            for role in shape['initialization_order']:
                instruction_starts.append(pc)
                pc += (4 if shape['counter_initialization'] == 'move_word_immediate' else 2) if role == 'count' else (6 if shape[role+'_addressing'] == 'absolute_long' else 4)
            instruction_starts += [shape['transfer'], shape['transfer']+2]
            code_read = kind == 'read' and e['mask'] == 65535 and shape['entry'] <= e['address'] <= shape['exit']+2
            if code_read:
                # Native taps expose code reads as well. Byte data uses a partial mask;
                # word/long overlapping code is deliberately refused as ambiguous.
                assert width == 1 or not (shape['source_bus24'] <= e['address'] < shape['source_bus24']+n) or e['instruction_pc'] != shape['transfer'], 'ambiguous code/data read'
                assert e['instruction_pc'] in instruction_starts, 'code read outside declared instructions'
                assert e['data'] == int.from_bytes(rom[e['address']:e['address']+2], 'big'), 'code read pinned value'
                assert len(current['nontransfer_reads']) < 3*shape['count']+16, 'unbounded excluded code reads'
                current['nontransfer_reads'].append({k:e[k] for k in ['instruction_pc','address','data','mask']})
                continue
            assert e['instruction_pc'] == shape['transfer'], 'interleaved write/instruction outside model'
            data = accesses(e)
            if mutation == 'destination' and kind == 'write' and not mutated:
                data = [(a+2, v) for a, v in data]; mutated = True
            if mutation == 'flow' and kind == 'write' and not mutated:
                mutated = True; continue
            current['reads' if kind == 'read' else 'writes'].extend(data)
        elif kind == 'profile_exit':
            assert current is not None and current.get('region'), 'unpaired exit or unobserved code'
            source = current['source']
            expected_reads = [(shape['source_bus24']+i, source[i]) for i in range(n)]
            expected_writes = [(shape['destination_bus24']+i, source[i]) for i in range(n)]
            assert current['reads'] == expected_reads and current['writes'] == expected_writes, 'transfer count/address/value'
            expected, memory = predict(shape, current['entry'], source, current['before'], width)
            if mutation == 'state' and not mutated:
                key = f"d{shape['counter_register']}"; e[key] ^= 1; mutated = True
            if mutation == 'flags' and not mutated:
                e['sr'] ^= 1; mutated = True
            assert all(e[k] == v for k, v in expected.items()), 'register/CCR/stack boundary'
            current.update(expected=expected, memory=memory, exit=e)
        elif kind == 'profile_destination_after':
            assert current is not None and 'exit' in current, 'snapshot before exit'
            assert bytes.fromhex(e['hex']) == current['memory'], 'conditional memory and guards'
            calls.append(dict(frame=current['entry']['frame'], invocation=current['entry']['invocation'], copied_bytes=n,
                memory_sha256=digest(current['memory']), boundary=current['expected'], nontransfer_reads_count=len(current['nontransfer_reads']), nontransfer_reads_sha256=digest(json.dumps(current['nontransfer_reads'],sort_keys=True).encode())))
            current = None
        elif kind == 'collection_end':
            assert e['complete'] and e['dropped'] == 0 and not e['profile_call_open'], 'incomplete observation'
            assert e['profile_completed_calls'] == len(calls), 'terminal call count'
            ended = True
    assert ended and current is None and calls, 'missing complete observed invocation'
    if mutation:
        assert mutated, 'negative not exercised'
    return calls

def literal_controls():
    entry = {**{f'a{i}': 0x81000000+i*0x1111 for i in range(8)}, **{f'd{i}': 0x12340000+i for i in range(8)}, 'sr': 0x271f, 'stack_top_long': 0x12345678}
    shape = dict(count=2, source_register=0, destination_register=1, counter_register=7,
        source_initial_register32=0x500, destination_initial_register32=0xffff8200,
        counter_initialization='moveq', exit=0x320, allowed_widths_in_memory_domain=[1,2,4])
    cases = []
    for width, source, wanted in [(1, bytes.fromhex('0100'), 0x2714), (2, bytes.fromhex('12348000'), 0x2718), (4, bytes.fromhex('1234567800000001'), 0x2710)]:
        for mode, counter in [('moveq', 65535), ('move_word_immediate', 0x1234ffff)]:
            shape['counter_initialization'] = mode
            state, memory = predict(shape, entry, source, bytes([0xa5]*16), width)
            assert state['d7'] == counter and state['sr'] == wanted
            assert state['a0'] == 0x500+2*width and state['a1'] == 0xffff8200+2*width
            assert state['a7'] == entry['a7'] and state['d0'] == entry['d0']
            assert memory == source + bytes([0xa5]*(16-len(source)))
            cases.append(dict(width=width, mode=mode, sr=wanted, counter=counter))
    assert accesses(dict(address=0x500,data=0x1234,mask=65535)) == [(0x500,0x12),(0x501,0x34)]
    assert accesses(dict(address=0x500,data=0x1200,mask=65280)) == [(0x500,0x12)]
    assert accesses(dict(address=0x500,data=0x0034,mask=255)) == [(0x501,0x34)]
    return cases

def main():
    if sys.argv[1:] == ['--qualify']:
        print(json.dumps(dict(passed=True, cases=literal_controls(), scope='Literal conditional-model vectors; not a commercial execution proof'),indent=2));return 0
    assert len(sys.argv) == 4, 'target-id private-trace fresh-output'
    target_id, path, output = sys.argv[1:]; out=Path(output);assert not out.exists()
    f=json.loads((DATA/'m5-pilot-freeze.json').read_text());target=next(t for t in f['targets'] if t['id']==target_id)
    rom=Path(target['rom_path']).read_bytes();assert digest(rom)==target['rom_sha256']
    events=[json.loads(line) for line in Path(path).open()];ident=events[0]['run_id']
    result=dict(schema='rex-m5-linear-state-result/v1',status='FAIL',target=target_id,trace_sha256=digest(Path(path).read_bytes()))
    try:
        result['literal_vectors']=literal_controls()
        result['calls']=verify(events,target,ident,f['inputs'][str(ROOT/'scripts/rex_profiles/commercial_recovery_20261016/observe-v4.lua')],rom)
        negatives={}
        for name in ['identity','operator','flow','destination','state','flags']:
            try:verify(events,target,ident,f['inputs'][str(ROOT/'scripts/rex_profiles/commercial_recovery_20261016/observe-v4.lua')],rom,name)
            except AssertionError as error:negatives[name]=dict(refused=True,reason=str(error))
            else:raise AssertionError('negative accepted:'+name)
        result.update(status='PASS_OBSERVED_LINEAR_STATE',negative_controls=negatives,
            limits='Conditional bounded region, full D/A/SR and stack top only; no stack interior, IRQ internals, timing, game meaning, visual/audio equivalence or application-runtime correspondence claim.')
    except Exception as error:result['error']=str(error)
    out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    return 0 if result['status'].startswith('PASS') else 1

if __name__ == '__main__':raise SystemExit(main())
