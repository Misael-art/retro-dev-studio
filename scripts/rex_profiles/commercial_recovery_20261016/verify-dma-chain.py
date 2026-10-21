#!/usr/bin/env python3
"""Bounded, post-observation verification of qualified MAME DMA and VDP state."""
import hashlib
import json
from pathlib import Path
import sys

TRACE = '7a6ee7353e06804dee2b6199e93f466d3a5b58a5dadd0d4f6e03be0d46d62bc2'
ROM = 'c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb'
INST = '3bd84c378b13dc0dec67f9cf9426a003b31548d406728bda7d05cb801ab81e40'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(path, mutation=None):
    regs = None
    first = None
    active = None
    ram = {}
    transfers = []
    final = {}
    expanded = {}
    matched = 0
    unmatched_reads = 0
    seq = 0
    terminal = None
    mutated = False
    for line in path.open():
        e = json.loads(line)
        seq += 1
        assert e['seq'] == seq and e['run_id'] == 'commercial-v3-001' and e['rom_sha256'] == ROM and e['instrument_sha256'] == INST, 'identity/order'
        kind = e['kind']
        if kind.startswith('pre_copy_expanded_'):
            expanded[kind] = bytes.fromhex(e['hex'])
        if kind == 'vdp_memory_snapshot':
            raw = bytes.fromhex(e['hex'])
            if mutation == 'wrong-vram' and e['frame'] == 1290 and e['address_space'] == 'md.vdp.vram':
                raw = raw[:0xf800] + bytes([raw[0xf800] ^ 1]) + raw[0xf801:]
                mutated = True
            if e['frame'] == 1170 and e['address_space'] == 'md.vdp.registers':
                regs = [int.from_bytes(raw[i:i + 2], 'big') for i in range(0, 64, 2)]
            if e['frame'] == 1290:
                final[e['address_space']] = raw
        if kind not in ('read', 'write'):
            if kind == 'collection_end':
                terminal = e
            continue
        address, value, mask = e['address'], e['data'], e['mask']
        if kind == 'write' and 0xfff800 <= address <= 0xfffb7f:
            if mask & 0xff00:
                ram[address] = value >> 8 & 255
            if mask & 255:
                ram[address + 1] = value & 255
        if kind == 'read' and (0xfff800 <= address <= 0xfffa7f or 0xfffb00 <= address <= 0xfffb7f) and regs is not None:
            if active is None:
                unmatched_reads += 1
                continue
            index = len(active['words'])
            if not mutated:
                if mutation == 'wrong-source':
                    address += 2
                    mutated = True
                elif mutation == 'wrong-value':
                    value ^= 1
                    mutated = True
                elif mutation == 'missing-read':
                    mutated = True
                    continue
            assert address == active['source'] + 2 * index and mask == 65535, 'DMA source address/width/order'
            assert e['instruction_pc'] == active['trigger_pc'], 'DMA trigger context'
            for offset, byte in enumerate(value.to_bytes(2, 'big')):
                if address + offset in ram:
                    assert ram[address + offset] == byte, 'DMA value differs from observed RAM write'
                    matched += 1
            active['words'].append(value)
            if len(active['words']) == active['count']:
                active['last_read_seq'] = e['seq']
                active['sha256'] = sha(b''.join(word.to_bytes(2, 'big') for word in active['words']))
                transfers.append(active)
                active = None
        if kind != 'write' or address not in (0xc00004, 0xc00006):
            continue
        assert active is None, 'incomplete DMA before next control write'
        assert mask == 65535, 'control port width'
        if first is None:
            if value & 0xc000 == 0x8000:
                if regs is not None:
                    regs[value >> 8 & 31] = value & 255
            else:
                first = value
            continue
        code = (first >> 14 & 3) | (value & 0xf0) >> 2
        destination = (first & 0x3fff) | (value & 3) << 14
        first = None
        if regs is None or not code & 0x20 or not regs[1] & 0x10 or regs[0x17] >> 6 not in (0, 1):
            continue
        source = (regs[0x15] | regs[0x16] << 8 | (regs[0x17] & 127) << 16) << 1
        count = regs[0x13] | regs[0x14] << 8
        covered = count > 0 and ((0xfff800 <= source and source + count * 2 <= 0xfffa80) or (0xfffb00 <= source and source + count * 2 <= 0xfffb80))
        if covered:
            assert code & 15 in (1, 3), 'covered DMA destination type'
            assert regs[15] == 2, 'declared DMA increment'
            active = {'source': source, 'destination': destination, 'count': count, 'space': 'md.vdp.vram' if code & 15 == 1 else 'md.vdp.cram', 'trigger_pc': e['instruction_pc'], 'command_seq': e['seq'], 'frame': e['frame'], 'words': []}
        # Model register updates of the qualified 68K DMA path, including
        # transfers whose source ranges are intentionally not installed taps.
        if count:
            end = source + 2 * count
            regs[0x13] = regs[0x14] = 0
            regs[0x15], regs[0x16], regs[0x17] = end >> 1 & 255, end >> 9 & 255, end >> 17 & 255
    assert terminal and terminal['complete'] and terminal['dropped'] == 0 and active is None, 'incomplete trace or DMA'
    sat = [t for t in transfers if t['space'] == 'md.vdp.vram' and t['destination'] == 0xf800 and t['count'] == 320]
    palette = [t for t in transfers if t['space'] == 'md.vdp.cram' and t['destination'] == 0 and t['count'] == 64]
    assert sat and palette and matched > 136, 'missing required transfers/RAM links'
    for t in (sat[-1], palette[-1]):
        payload = b''.join(word.to_bytes(2, 'big') for word in t['words'])
        assert final[t['space']][t['destination']:t['destination'] + len(payload)] == payload, 'native VDP differs from last observed DMA payload'
    wall = final['md.vdp.vram'][0x142 * 32:0x142 * 32 + 249 * 32]
    assert sha(wall) == '5c36a38a784b3d40f506cffdd248aa20bda8464b7923093b4be5d0f8e7202860', 'wall art pin in native VRAM'
    if mutation:
        assert mutated, 'mutation not exercised'
    source = expanded['pre_copy_expanded_source']
    before = expanded['pre_copy_expanded_destination']
    assert len(source) == 8192 and len(before) == 12224, 'expanded domain'
    predicted = bytearray(before)
    for row in range(64):
        predicted[row * 192:row * 192 + 128] = source[row * 128:row * 128 + 128]
    return {'status': 'PASS_BOUNDED_RAM_DMA_VDP_STATE', 'sat_transfers': len(sat), 'palette_transfers': len(palette), 'ram_written_bytes_reobserved_by_dma': matched, 'unpaired_tapped_reads_excluded': unmatched_reads, 'last_sat_sha256': sat[-1]['sha256'], 'last_palette_sha256': palette[-1]['sha256'], 'wall_art_native_vram_sha256': sha(wall), 'expanded_source_sha256': sha(source), 'expanded_source_second_half_sha256': sha(source[4096:]), 'expanded_source_second_half_all_zero': not any(source[4096:]), 'predicted_width2_destination_sha256': sha(predicted), 'expanded_destination_before_sha256': sha(before), 'transfers': [{k: v for k, v in t.items() if k != 'words'} for t in transfers]}, bytes(predicted)


def main():
    assert len(sys.argv) == 3, 'usage: verify-dma-chain.py <private-events.jsonl> <fresh-output.json>'
    path, out = map(Path, sys.argv[1:])
    assert not out.exists(), 'refuse overwrite'
    with path.open('rb') as source:
        assert hashlib.file_digest(source, 'sha256').hexdigest() == TRACE, 'trace pin'
    report = {'schema': 'rex-dma-chain-verification/v1', 'trace_sha256': TRACE, 'id': out.stem, 'status': 'FAIL', 'limits': ['post-observation model, not blind holdout', 'MAME only; not GX session or hardware DMA timing', 'only explicitly tapped DMA source ranges', 'native memory proof does not supply an independent visual game oracle']}
    try:
        result, predicted = verify(path)
        report.update(result)
        negative = {}
        for name in ['wrong-source', 'wrong-value', 'missing-read', 'wrong-vram']:
            try:
                verify(path, name)
            except AssertionError as error:
                negative[name] = {'rejected': True, 'reason': str(error)}
            else:
                raise AssertionError('negative accepted: ' + name)
        report['negative_controls'] = negative
        out.with_suffix('.predicted-width2.bin').write_bytes(predicted)
    except (AssertionError, KeyError, IndexError, ValueError) as error:
        report['status'] = 'FAIL'
        report['error'] = str(error)
    out.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'transfers'}, indent=2))
    return 0 if report['status'].startswith('PASS') else 1


if __name__ == '__main__':
    raise SystemExit(main())
