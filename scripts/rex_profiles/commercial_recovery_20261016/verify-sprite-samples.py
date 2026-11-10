#!/usr/bin/env python3
"""Post-observation, bounded descriptor -> SAT verification; no new runtime run.

This checks a static instruction interpretation against existing sampled events.
It is not a reserved visual expectation or a complete sprite/DMA observer.
"""
import hashlib
import json
import sys
from pathlib import Path

ROM_SHA = 'c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb'
EVENT_SHA = '75ad10d30bdbbbad81c65147938d5f41b19b707079c047529ccb4f2cf5638b13'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def signed(byte):
    return byte if byte < 128 else byte - 256


def record(descriptor, args):
    """D762 normal loop body, excluding flip variants and sprite-limit branch."""
    assert len(descriptor) == 5
    assert (args['d5'] & 255) < 128, 'sprite limit branch outside sampled body'
    y = (signed(descriptor[0]) + args['d2']) & 65535
    tile = (int.from_bytes(descriptor[2:4], 'big') + args['a3']) & 65535
    x = (signed(descriptor[4]) + args['d3']) & 511
    if x == 0:
        x = 1
    return y.to_bytes(2, 'big') + bytes([descriptor[1], (args['d5'] + 1) & 255]) + tile.to_bytes(2, 'big') + x.to_bytes(2, 'big')


def lanes(event):
    address, value, mask = (event[key] for key in ['address', 'data', 'mask'])
    assert address % 2 == 0 and mask in (255, 65280, 65535), 'bus16 encoding'
    result = []
    if mask & 65280:
        result.append((address, value >> 8 & 255))
    if mask & 255:
        result.append((address + 1, value & 255))
    return result


def check_sample(sample, rom):
    args, events = sample
    src = args['a1'] & 0xffffff
    dest = args['a2'] & 0xffffff
    assert 0x2c564 <= src and src + 5 <= 0x2c5e4, 'declared wall descriptor'
    assert 0xfff800 <= dest and dest + 8 <= 0xfffa80, 'SAT domain'
    expected = record(rom[src:src + 5], args)
    reads, writes = [], []
    for event in events:
        if event['kind'] == 'read' and 0xd768 <= event['instruction_pc'] <= 0xd780:
            reads.extend(lanes(event))
        if event['kind'] == 'write' and 0xd76e <= event['instruction_pc'] <= 0xd78e:
            writes.extend(lanes(event))
    assert reads == [(src + i, rom[src + i]) for i in range(5)], 'descriptor reads'
    assert writes == [(dest + i, value) for i, value in enumerate(expected)], 'SAT address/value/order'
    return {'seq': args['seq'], 'frame': args['frame'], 'descriptor_address': src, 'sat_address': dest, 'record_sha256': sha(expected)}


def author_controls():
    # Literal expected bytes exercise signed coordinates, carry/wrap, X=0 -> 1.
    args = {'d2': 1, 'd3': 128, 'a3': 65535, 'd5': 5}
    descriptor = bytes([254, 10, 0, 2, 128])
    expected = bytes.fromhex('ffff0a0600010001')
    assert record(descriptor, args) == expected, 'literal author reference'
    mutants = [bytes.fromhex(s) for s in [
        '00ff0a0600010001',  # unsigned Y
        'ffff0a0500010001',  # missing link increment
        'ffff0a06fffd0001',  # tile subtraction
        'ffff0a0600010000',  # missing zero-X rule
    ]]
    assert all(value != record(descriptor, args) for value in mutants)
    return {'literal_case': True, 'incorrect_operator_or_branch_mutants_rejected': len(mutants)}


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: verify-sprite-samples.py <private-events.jsonl> <original-ROM> <fresh-output.json>')
    events_path, rom_path, output = map(Path, sys.argv[1:])
    assert not output.exists(), 'refuse overwrite'
    rom = rom_path.read_bytes()
    assert sha(rom) == ROM_SHA, 'ROM identity'
    assert sha(events_path.read_bytes()) == EVENT_SHA, 'trace identity'
    author = author_controls()
    samples, current = [], None
    seq = 0
    terminal = None
    for line in events_path.open():
        event = json.loads(line)
        seq += 1
        assert event['seq'] == seq and event['rom_sha256'] == ROM_SHA and event['run_id'] == 'commercial-v2-001', 'event identity/order'
        assert event['instrument_sha256'] == '56c966f3c93a4466136e1ec693c455d1a2ad0e5c14efe57729eb67a5b46f1a94', 'instrument'
        if event['kind'] == 'sprite_arguments':
            if current:
                samples.append(current)
            current = (event, [])
        elif current and event['kind'] in ('read', 'write'):
            # Keep only the first body after this sampled stop. Once all eight
            # bytes are written, later unsampled bodies belong to other records.
            if sum(len(lanes(e)) for e in current[1] if e['kind'] == 'write') < 8:
                if (event['kind'] == 'read' and 0xd768 <= event['instruction_pc'] <= 0xd780) or (event['kind'] == 'write' and 0xd76e <= event['instruction_pc'] <= 0xd78e):
                    current[1].append(event)
        if event['kind'] == 'collection_end':
            terminal = event
    if current:
        samples.append(current)
    assert terminal and terminal['complete'] and terminal['dropped'] == 0, 'incomplete trace'
    assert len(samples) == 20, 'sampling contract'
    results = [check_sample(sample, rom) for sample in samples]
    negative = {}
    for name in ['wrong-destination', 'wrong-value', 'missing-write', 'wrong-descriptor']:
        args, events = samples[0]
        args = dict(args)
        events = [dict(e) for e in events]
        write = next(e for e in events if e['kind'] == 'write')
        if name == 'wrong-destination':
            write['address'] += 2
        elif name == 'wrong-value':
            write['data'] ^= 1
        elif name == 'missing-write':
            events.remove(write)
        else:
            args['a1'] += 5
        try:
            check_sample((args, events), rom)
        except AssertionError as error:
            negative[name] = {'rejected': True, 'reason': str(error)}
        else:
            raise AssertionError('mutant accepted: ' + name)
    result = {'schema': 'rex-sampled-sprite-verification/v1', 'id': 'sprite-analysis-001', 'status': 'PASS_BOUNDED_DESCRIPTOR_TO_SAT', 'events_sha256': EVENT_SHA, 'rom_sha256': ROM_SHA, 'author_controls': author, 'negative_controls': negative, 'samples': results, 'sampled_record_bytes': 160, 'limits': ['post-observation static model, not blind expectations', 'twenty loop heads, not twenty complete calls', 'no internal DMA/VRAM or independent visual oracle', 'normal body only; flips, limit branch and full scene not qualified']}
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'samples'}, indent=2))


if __name__ == '__main__':
    main()
