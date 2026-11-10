#!/usr/bin/env python3
"""Join original decoded layout IDs, table selection, SAT writes and final DMA."""
import hashlib
import json
from pathlib import Path
import sys


def byte_access(e):
    assert e['mask'] in (255, 65280), 'byte bus mask'
    return (e['address'], e['data'] >> 8 & 255) if e['mask'] == 65280 else (e['address'] + 1, e['data'] & 255)


def signed_word(value):
    return value if value < 32768 else value - 65536


def verify(path, rom, final_dma, mutation=None):
    shadow = None
    original = None
    cell = None
    piece = None
    origins = {}
    sampled = 0
    tile_writes = 0
    final_origins = {}
    mutated = False
    for line in path.open():
        e = json.loads(line)
        kind = e['kind']
        if kind == 'copy_snapshot':
            shadow = bytearray.fromhex(e['hex'])
            assert len(shadow) == 8128 and hashlib.sha256(shadow).hexdigest() == 'b691f2626e5eb4fd4ff5a03f18f14b32d5f888b61de796b596bfc1dc8801ba46', 'copy boundary pin'
            original = [i % 128 < 64 for i in range(8128)]
        if kind == 'sprite_arguments' and 0x2c564 <= (e['a1'] & 0xffffff) < 0x2c5e4:
            assert cell and cell.get('count') and cell['source_original'], 'sample without resource provenance'
            assert (e['a0'] & 0xffffff) == cell['address'] + 1, 'layout postincrement argument'
            assert (e['a5'] & 0xffffff) == cell['lookup'] + 8, 'table postincrement argument'
            assert (e['a3'] & 65535) == cell['base'], 'sampled tile base'
            assert (e['d5'] & 255) < 80, 'actual decimal80 sprite guard domain'
            sampled += 1
        if kind not in ('read', 'write'):
            continue
        e = dict(e)
        pc = e['instruction_pc']
        if not mutated and mutation == 'wrong-layout-id' and kind == 'read' and pc == 0x1b212 and shadow is not None:
            a, value = byte_access(e)
            if 0xff1020 <= a < 0xff1020 + 8128 and original[a - 0xff1020] and 1 <= value <= 78:
                e['data'] ^= 0x0101
                mutated = True
        if kind == 'write' and shadow is not None:
            for address, value in ([(e['address'], e['data'] >> 8 & 255)] if e['mask'] == 65280 else [(e['address'] + 1, e['data'] & 255)] if e['mask'] == 255 else [(e['address'], e['data'] >> 8 & 255), (e['address'] + 1, e['data'] & 255)]):
                if 0xff1020 <= address < 0xff1020 + 8128:
                    shadow[address - 0xff1020] = value
                    original[address - 0xff1020] = False
                if 0xfff800 <= address < 0xfffa80 and address % 8 in (4, 5):
                    origins.pop(address & ~1, None)
        if kind == 'read' and pc == 0x1b212:
            address, value = byte_access(e)
            known = shadow is not None and 0xff1020 <= address < 0xff1020 + 8128
            if known:
                assert value == shadow[address - 0xff1020], 'layout read differs from current copy buffer'
            cell = {'address': address, 'id': value, 'read_seq': e['seq'], 'lookup': 0xff4000 + value * 8, 'source_original': bool(known and original[address - 0xff1020] and 1 <= value <= 78), 'pointer_words': []}
            piece = None
        if cell and cell['source_original'] and kind == 'read':
            if pc == 0x1b24e:
                if mutation == 'wrong-lookup' and not mutated:
                    e['address'] += 8
                    mutated = True
                assert e['mask'] == 65535 and e['address'] == cell['lookup'] + 2 * len(cell['pointer_words']), 'ID selects mapping table record'
                cell['pointer_words'].append(e['data'])
                if len(cell['pointer_words']) == 2:
                    cell['mapping'] = (cell['pointer_words'][0] << 16 | cell['pointer_words'][1]) & 0xffffff
            elif pc == 0x1b250:
                assert e['address'] == cell['lookup'] + 4, 'table frame field'
                cell['frame_index'] = e['data']
            elif pc == 0x1b254 and 0x2c564 <= cell.get('mapping', 0) < 0x2c5e4:
                assert e['address'] == cell['mapping'] + signed_word(cell['frame_index'] * 2 & 65535), 'mapping frame offset address'
                if mutation == 'wrong-mapping-offset' and not mutated:
                    e['data'] ^= 2
                    mutated = True
                assert e['mask'] == 65535 and e['data'] == int.from_bytes(rom[e['address']:e['address'] + 2], 'big'), 'ROM mapping frame offset'
                cell['header'] = cell['mapping'] + signed_word(e['data'])
            elif pc == 0x1b258:
                assert e['address'] == cell['lookup'] + 6, 'ID selects base attribute field'
                cell['base'] = e['data']
            elif pc == 0x1b25c and 'header' in cell:
                address, value = byte_access(e)
                assert address == cell['header'] and value == rom[address], 'ROM descriptor count'
                cell.update(count=value, piece_index=0)
            elif pc == 0xd768 and cell.get('piece_index', 0) < cell.get('count', 0):
                address, value = byte_access(e)
                assert address == cell['header'] + 1 + cell['piece_index'] * 5 and value == rom[address], 'descriptor selected by layout ID'
                piece = {'address': address, 'high': None, 'low': None}
            elif pc in (0xd776, 0xd77a) and piece:
                address, value = byte_access(e)
                offset = 2 if pc == 0xd776 else 3
                assert address == piece['address'] + offset and value == rom[address], 'ROM tile attribute bytes'
                piece['high' if offset == 2 else 'low'] = value
        if kind == 'write' and pc == 0xd77e and piece and cell and cell['source_original']:
            if mutation == 'wrong-SAT-attribute' and not mutated:
                e['data'] ^= 1
                mutated = True
            assert piece['high'] is not None and piece['low'] is not None, 'missing descriptor tile read'
            expected = (piece['high'] * 256 + piece['low'] + cell['base']) & 65535
            assert e['mask'] == 65535 and e['data'] == expected and e['address'] % 8 == 4, 'ID/table/descriptor produces SAT tile word'
            origins[e['address']] = {'layout_address': cell['address'], 'layout_read_seq': cell['read_seq'], 'table_address': cell['lookup'], 'descriptor_address': piece['address'], 'sat_write_seq': e['seq'], 'frame': e['frame'], 'value': expected}
            tile_writes += 1
        if kind == 'write' and pc == 0xd78e:
            if cell and piece:
                cell['piece_index'] += 1
            piece = None
        if kind == 'read' and final_dma['command_seq'] < e['seq'] <= final_dma['last_read_seq'] and e['address'] in origins:
            if mutation == 'wrong-DMA-attribute' and not mutated:
                e['data'] ^= 1
                mutated = True
            origin = origins[e['address']]
            assert e['mask'] == 65535 and e['data'] == origin['value'], 'final DMA consumes linked SAT word'
            index = (e['address'] - 0xfff800) // 8
            final_origins[index] = {k: v for k, v in origin.items() if k != 'value'}
            final_origins[index]['dma_read_seq'] = e['seq']
    assert sampled == 17 and tile_writes > 17 and final_origins, 'missing required causal links'
    if mutation:
        assert mutated, 'negative not exercised'
    return {'sampled_argument_links': sampled, 'linked_SAT_tile_writes': tile_writes, 'presentation_dma_frame': final_dma['frame'], 'final_sprite_origins': final_origins}


def main():
    assert len(sys.argv) == 4, 'usage: verify-layout-sprite-link.py <private-trace> <original-ROM> <fresh-output.json>'
    path, rom_path, out = map(Path, sys.argv[1:])
    assert not out.exists()
    root = Path(__file__).resolve().parents[3]
    metadata = json.loads((root / 'data/rex_profiles/commercial_recovery_20261016/m2-dma-chain-verification.json').read_text())
    dma = next(t for t in metadata['transfers'] if t['space'] == 'md.vdp.vram' and t['destination'] == 0xf800 and t['frame'] == 1288)
    with path.open('rb') as source:
        assert hashlib.file_digest(source, 'sha256').hexdigest() == '7a6ee7353e06804dee2b6199e93f466d3a5b58a5dadd0d4f6e03be0d46d62bc2'
    rom = rom_path.read_bytes()
    assert hashlib.sha256(rom).hexdigest() == 'c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb'
    result = {'schema': 'rex-layout-to-presented-SAT-provenance/v1', 'status': 'FAIL', 'limits': ['normal D762 body and wall mapping domain only', 'post-copy runtime-written cells excluded from original resource origin', 'not semantic reconstruction or edited-ROM execution']}
    try:
        result.update(verify(path, rom, dma))
        negative = {}
        for name in ['wrong-layout-id', 'wrong-lookup', 'wrong-mapping-offset', 'wrong-SAT-attribute', 'wrong-DMA-attribute']:
            try:
                verify(path, rom, dma, name)
            except AssertionError as error:
                negative[name] = {'rejected': True, 'reason': str(error)}
            else:
                raise AssertionError('negative accepted: ' + name)
        result.update(status='PASS_BOUNDED_LAYOUT_TABLE_SAT_DMA_LINK', negative_controls=negative)
    except (AssertionError, KeyError, IndexError, ValueError) as error:
        result['error'] = str(error)
    out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return 0 if result['status'].startswith('PASS') else 1


if __name__ == '__main__':
    raise SystemExit(main())
