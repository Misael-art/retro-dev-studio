#!/usr/bin/env python3
"""Qualify read-only VDP save items and RAM->VRAM DMA in external MAME."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import zipfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SCRATCH = Path('/home/misael/rds-scratch/commercial_recovery_20261016')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshots(events):
    result = {}
    for event in events:
        if event['kind'] == 'vdp_memory_snapshot':
            space = event['address_space']
            assert space not in result, 'duplicate VDP snapshot'
            assert event['clock_context'] == 'read-only-native-save-item'
            result[space] = bytes.fromhex(event['hex'])
    assert {k: len(v) for k, v in result.items()} == {'md.vdp.vram': 65536, 'md.vdp.cram': 128, 'md.vdp.registers': 64}, 'VDP snapshot dimensions'
    return result


def dma_fixture(q, variant):
    original, ret, _, _ = q.fixture('positive')
    data = bytearray(original)
    sentinel = bytes.fromhex('23fcdeadbeef00ff010060fe')
    position = data.index(sentinel)
    data[position:position + 6] = bytes.fromhex('4ef900000700')
    source = 0xfffa00 if variant == 'other-args' else 0xfff800
    destination = 0xf900 if variant == 'other-args' else 0xf800
    expected = bytes.fromhex('1234a55a00ff8001')
    if variant == 'other-args':
        expected = bytes.fromhex('43215aa5ff000180')
    code = ''
    def word(value):
        return f'33fc{value:04x}00c00004'
    def command(address, dma=False, write=True):
        first = (address & 0x3fff) | (0x4000 if write else 0)
        second = (address >> 14) | (0x80 if dma else 0)
        return f'23fc{first:04x}{second:04x}00c00004'
    code += word(0x8104 if variant == 'disabled' else 0x8114) + word(0x8f02)
    code += command(destination)
    for _ in range(4):
        code += '33fc000000c00000'
    for index in range(2):
        value = expected[index * 4:index * 4 + 4].hex()
        code += f'23fc{value}{source + index * 4:08x}'
    for register, value in [(0x13, 4), (0x14, 0), (0x15, source >> 1 & 255), (0x16, source >> 9 & 255), (0x17, source >> 17 & 127)]:
        code += word(0x8000 | register << 8 | value)
    trigger_pc = 0x700 + len(bytes.fromhex(code))
    code += command(destination, dma=True)
    code += command(destination, write=False)
    for index in range(4):
        code += f'33f900c00000{0xff0300 + index * 2:08x}'
    code += sentinel.hex()
    raw = bytes.fromhex(code)
    assert 0x700 + len(raw) < 0x1000, 'fixture budget'
    data[0x700:0x700 + len(raw)] = raw
    checksum = sum(int.from_bytes(data[i:i + 2], 'big') for i in range(0x200, len(data), 2)) & 65535
    data[0x18e:0x190] = checksum.to_bytes(2, 'big')
    return bytes(data), ret, source, destination, expected, trigger_pc


def main():
    assert len(sys.argv) == 2 and sys.argv[1].startswith('qualify-v3-'), 'usage: qualify-v3.py qualify-v3-<fresh-id>'
    freeze = json.loads((ROOT / 'data/rex_profiles/commercial_recovery_20261016/m2-instrument-freeze.json').read_text())
    source = HERE / 'run-observer.py'
    assert sha(source) == freeze['files'][str(source.relative_to(ROOT))], 'frozen qualifier changed'
    protocol = json.loads((ROOT / 'data/rex_profiles/commercial_recovery_20261016/m2-dma-save-item-storage-addendum.json').read_text())
    assert sha(HERE / 'observe-v3.lua') == protocol['new_source_sha256'], 'observer protocol drift'
    assert sha(Path(__file__)) == protocol['qualification_source_sha256'], 'qualifier protocol drift'
    spec = importlib.util.spec_from_file_location('frozen_qualifier', source)
    q = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(q)
    assert q.sha(q.MAME) == q.MAME_SHA
    alias = SCRATCH / ('observer-v3-input-' + sys.argv[1])
    alias.mkdir(exist_ok=False)
    (alias / 'observe.lua').symlink_to(HERE / 'observe-v3.lua')
    q.HERE = alias
    original_case = q.run_case
    def with_capture(parent, variant):
        target = parent / ('screens-' + variant)
        target.mkdir()
        os.environ['REX_SNAP_DIR'] = str(target)
        return original_case(parent, variant)
    q.run_case = with_capture
    rc = q.main()
    parent = SCRATCH / sys.argv[1]
    if rc:
        return rc
    from PIL import Image
    captures = []
    for variant in ['positive', 'no-call', 'other-args']:
        events = [json.loads(line) for line in (parent / variant / 'events.jsonl').read_text().splitlines()]
        state = snapshots(events)
        assert state['md.vdp.vram'][:2] == bytes.fromhex('1234'), 'literal VRAM direct write'
        assert state['md.vdp.cram'][:2] == bytes.fromhex('000e'), 'literal CRAM direct write'
        for png in sorted((parent / ('screens-' + variant)).glob('*.png')):
            raw = png.with_suffix('.snapshot.pixels').read_bytes()
            image = Image.open(png).convert('RGB')
            assert len(raw) == image.width * image.height * 4
            rgb = bytearray()
            for i in range(0, len(raw), 4):
                color = int.from_bytes(raw[i:i + 4], sys.byteorder)
                rgb.extend([color >> 16 & 255, color >> 8 & 255, color & 255])
            assert bytes(rgb) == image.tobytes(), 'PNG/native presented target'
            rgb[0] ^= 1
            assert bytes(rgb) != image.tobytes(), 'pixel mutant accepted'
            captures.append({'variant': variant, 'png_sha256': sha(png), 'passed': True})
    assert len(captures) == 3, 'missing author capture'
    (parent / 'screen-qualification.json').write_text(json.dumps({'passed': True, 'captures': captures, 'limits': 'same presented target only; no independent game visual oracle'}, indent=2) + '\n')
    results = []
    for variant in ['positive', 'disabled', 'other-args', 'incomplete']:
        work = parent / ('dma-' + variant)
        work.mkdir()
        (work / 'screens').mkdir()
        rom, ret, source_addr, dest, expected, trigger_pc = dma_fixture(q, variant)
        (work / 'fixture.bin').write_bytes(rom)
        with zipfile.ZipFile(work / 'cart.zip', 'w', zipfile.ZIP_STORED) as cart:
            cart.writestr('fixture.bin', rom)
        ident = parent.name + '-dma-' + variant
        env = dict(os.environ, SDL_VIDEODRIVER='dummy', SDL_AUDIODRIVER='dummy', REX_RUN_ID=ident, REX_ROM_SHA=sha(work / 'fixture.bin'), REX_INSTRUMENT_SHA=sha(HERE / 'observe-v3.lua'), REX_EVENTS=str(work / 'events.jsonl'), REX_RETURN=str(ret), REX_MAX_FRAMES='5', REX_MODE='author', REX_MAX_EVENTS='2' if variant == 'incomplete' else '1000', REX_SNAP_DIR=str(work / 'screens'))
        command = [str(q.MAME), 'genesis', '-cart', str(work / 'cart.zip'), '-noreadconfig', '-noplugins', '-skip_gameinfo', '-hashpath', str(work), '-homepath', str(work), '-cfg_directory', str(work / 'cfg'), '-nvram_directory', str(work / 'nvram'), '-snapshot_directory', str(work / 'snap'), '-debug', '-debugger', 'none', '-video', 'none', '-sound', 'none', '-nothrottle', '-autoboot_delay', '0', '-autoboot_script', str(HERE / 'observe-v3.lua'), '-seconds_to_run', '8']
        manifest = {'id': ident, 'command': command, 'env': {k: v for k, v in env.items() if k.startswith('REX_')}, 'rom_sha256': sha(work / 'fixture.bin'), 'mame_sha256': q.MAME_SHA, 'instrument_sha256': sha(HERE / 'observe-v3.lua'), 'expected': {'source': source_addr, 'vram_destination': dest, 'words': 4, 'hex': expected.hex(), 'dma_trigger_pc': trigger_pc, 'disabled': variant == 'disabled'}, 'budget_seconds': 90}
        (work / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        started = time.monotonic()
        with (work / 'runtime.log').open('w') as log:
            try:
                child = subprocess.run(command, cwd=work, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=90)
                exit_code = child.returncode
            except subprocess.TimeoutExpired:
                exit_code = 124
        result = {'id': ident, 'exit_code': exit_code, 'elapsed_seconds': time.monotonic() - started, 'qualified': False}
        try:
            assert exit_code == 0, 'runtime failed'
            events = [json.loads(line) for line in (work / 'events.jsonl').read_text().splitlines()]
            if variant == 'incomplete':
                try:
                    q.validate(events, ident, manifest['rom_sha256'])
                except ValueError:
                    result['qualified'] = True
                    result['scope'] = 'incomplete trace refused'
                else:
                    raise AssertionError('incomplete accepted')
            else:
                q.validate(events, ident, manifest['rom_sha256'])
                state = snapshots(events)
                want = bytes(8) if variant == 'disabled' else expected
                assert state['md.vdp.vram'][dest:dest + 8] == want, 'DMA VRAM result'
                reads = [e for e in events if e['kind'] == 'read' and 0xfff800 <= e['address'] <= 0xfffa7f]
                if variant == 'disabled':
                    assert not reads, 'disabled DMA read RAM'
                else:
                    assert [(e['address'], e['data'], e['mask']) for e in reads] == [(source_addr + i, int.from_bytes(expected[i:i + 2], 'big'), 65535) for i in range(0, 8, 2)], 'DMA source address/data/order'
                    assert all(e['instruction_pc'] == trigger_pc for e in reads), 'DMA CPU trigger context'
                readback = [e for e in events if e['kind'] == 'read' and e['address'] == 0xc00000]
                assert [(e['data'], e['mask']) for e in readback] == [(int.from_bytes(want[i:i + 2], 'big'), 65535) for i in range(0, 8, 2)], 'VDP readback'
                try:
                    q.validate(events, 'wrong-run', manifest['rom_sha256'])
                except ValueError:
                    pass
                else:
                    raise AssertionError('wrong identity accepted')
                result.update(qualified=True, scope='RAM DMA source + internal VRAM + CPU port readback', source_reads=len(reads), readback_words=len(readback), vram_sha256=hashlib.sha256(state['md.vdp.vram']).hexdigest())
        except (AssertionError, ValueError, KeyError, IndexError, FileNotFoundError) as error:
            result['error'] = str(error)
        (work / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
        results.append(result)
        print(json.dumps(result), flush=True)
        if not result['qualified']:
            break
    summary = {'schema': 'rex-dma-observer-qualification/v1', 'id': parent.name, 'instrument_sha256': sha(HERE / 'observe-v3.lua'), 'original_author_cases_passed': True, 'literal_direct_vram_cram_passed': True, 'dma_cases': results, 'passed': len(results) == 4 and all(r['qualified'] for r in results), 'limits': ['MAME implementation only; no hardware timing fidelity', 'save item snapshots are state observations, not transfer events', 'CPU PC on source read is trigger context, not CPU load instruction', 'no commercial execution yet']}
    (parent / 'dma-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    return 0 if summary['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
