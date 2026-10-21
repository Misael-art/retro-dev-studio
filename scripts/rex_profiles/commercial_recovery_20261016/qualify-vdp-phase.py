#!/usr/bin/env python3
"""Author-only phase and asymmetric-pixel qualification on pinned external MAME."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import zipfile
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SCRATCH = Path('/home/misael/rds-scratch/commercial_recovery_20261016')
BIN = Path('/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/toolchains/m68k-elf/bin')
COLORS = [(0, 0, 0), (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255)]


def sha(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def expected_pixel(x, y):
    tile = x // 8 * 4 + y // 8 + 1
    if tile == 1:
        index = [1, 2, 3, 4, 5, 6, 7, 1][x] if y == 0 else y
    else:
        index = (tile - 1) % 7 + 1
    return COLORS[index]


def decode_marker(event):
    image = Image.open(event['png']).convert('RGB')
    assert image.size == (320, 224), 'author viewport size'
    raw = Path(event['png']).with_suffix('.snapshot.pixels').read_bytes()
    assert len(raw) == 320 * 224 * 4, 'native presented size'
    rgb = bytearray()
    for offset in range(0, len(raw), 4):
        value = int.from_bytes(raw[offset:offset + 4], sys.byteorder)
        rgb.extend([value >> 16 & 255, value >> 8 & 255, value & 255])
    assert bytes(rgb) == image.tobytes(), 'PNG/native presented identity'
    positions = [(x, y) for y in range(224) for x in range(320) if image.getpixel((x, y)) != (0, 0, 0)]
    assert len(positions) == 1024, 'one opaque32x32 author sprite'
    left, top = min(x for x, _ in positions), min(y for _, y in positions)
    assert top == 64 and max(x for x, _ in positions) == left + 31 and max(y for _, y in positions) == 95, 'author sprite bounds'
    assert all(image.getpixel((left + x, top + y)) == expected_pixel(x, y) for y in range(32) for x in range(32)), 'asymmetric tile/nibble/column/palette projection'
    sat = bytes.fromhex(event['native_sat_hex'])
    assert sat[:6] == bytes.fromhex('00c00f008001') and event['cram1'] == 14, 'author native SAT/palette'
    native_x = (int.from_bytes(sat[6:8], 'big') & 511) - 128
    source_x = (event['source_x_word'] & 511) - 128
    assert native_x == source_x == (event['counter'] & 31) * 8, 'IRQ counter/source/native VRAM correspondence'
    assert (native_x - left) % 8 == 0, 'signal granularity'
    lag = ((native_x - left) // 8) % 32
    assert lag in (0, 1, 2), 'phase outside frozen bounded hypotheses'
    return lag, left, native_x


def main():
    assert len(sys.argv) in (2, 3) and sys.argv[1].startswith('phase-qualify-'), 'usage: qualify-vdp-phase.py phase-qualify-<fresh-id> [--prepare-only]'
    prepare_only = len(sys.argv) == 3
    assert not prepare_only or sys.argv[2] == '--prepare-only'
    ident = sys.argv[1]
    assert all(c.isalnum() or c == '-' for c in ident)
    protocol = json.loads((ROOT / 'data/rex_profiles/commercial_recovery_20261016/m2-author-phase-freeze.json').read_text())
    for name, digest in protocol['sources'].items():
        assert sha(ROOT / name) == digest, 'author source drift'
    work = SCRATCH / ident
    work.mkdir(exist_ok=False)
    (work / 'snap').mkdir()
    assembler, linker = BIN / 'm68k-elf-as', BIN / 'm68k-elf-ld'
    commands = [[str(assembler), '-m68000', '-o', str(work / 'fixture.o'), str(HERE / 'vdp-phase-author.s')], [str(linker), '-Ttext=0', '--oformat=binary', '-o', str(work / 'fixture.bin'), str(work / 'fixture.o')]]
    tools = {str(p): sha(p) for p in [assembler, linker]}
    (work / 'assembly-manifest.json').write_text(json.dumps({'commands': commands, 'tools': tools, 'sources': protocol['sources'], 'origin': 'author-owned only, official managed toolchain; no new dependency'}, indent=2) + '\n')
    with (work / 'assembly.log').open('w') as log:
        for command in commands:
            subprocess.run(command, cwd=work, stdout=log, stderr=subprocess.STDOUT, timeout=30, check=True)
    assert (work / 'fixture.bin').stat().st_size == 8192, 'author ROM size'
    with zipfile.ZipFile(work / 'cart.zip', 'w', zipfile.ZIP_STORED) as cart:
        cart.write(work / 'fixture.bin', 'fixture.bin')
    if prepare_only:
        report = {'status': 'PREPARED_ONLY_NO_RUNTIME_EXECUTION', 'rom_sha256': sha(work / 'fixture.bin'), 'bytes': 8192, 'commands': commands, 'tools': tools}
        (work / 'prepare-result.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
        return 0
    mame = Path('/usr/lib/mame/mame')
    assert sha(mame) == 'fcb54790e1837ed653020dc25a4e51d9ba7288d789cf556299d5d4d2cf2f3bc1'
    observer = HERE / 'observe-vdp-phase.lua'
    env = dict(os.environ, SDL_VIDEODRIVER='dummy', SDL_AUDIODRIVER='dummy', REX_RUN_ID=ident, REX_ROM_SHA=sha(work / 'fixture.bin'), REX_INSTRUMENT_SHA=sha(observer), REX_EVENTS=str(work / 'events.jsonl'), REX_SNAP_DIR=str(work / 'snap'))
    command = [str(mame), 'genesis', '-cart', str(work / 'cart.zip'), '-noreadconfig', '-noplugins', '-skip_gameinfo', '-hashpath', str(work), '-homepath', str(work), '-cfg_directory', str(work / 'cfg'), '-nvram_directory', str(work / 'nvram'), '-snapshot_directory', str(work / 'snap'), '-debug', '-debugger', 'none', '-video', 'none', '-sound', 'none', '-nothrottle', '-autoboot_delay', '0', '-autoboot_script', str(observer), '-seconds_to_run', '2']
    manifest = {'id': ident, 'command': command, 'env': {k: v for k, v in env.items() if k.startswith('REX_')}, 'mame_sha256': sha(mame), 'rom_sha256': env['REX_ROM_SHA'], 'instrument_sha256': sha(observer), 'protocol_sha256': sha(ROOT / 'data/rex_profiles/commercial_recovery_20261016/m2-author-phase-freeze.json'), 'budget_seconds': 90}
    (work / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    started = time.monotonic()
    with (work / 'runtime.log').open('w') as log:
        try:
            child = subprocess.run(command, cwd=work, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=90)
            rc = child.returncode
        except subprocess.TimeoutExpired:
            rc = 124
    result = {'schema': 'rex-author-vdp-phase-qualification/v1', 'id': ident, 'exit_code': rc, 'elapsed_seconds': time.monotonic() - started, 'status': 'FAIL', 'limits': ['author IRQ6 fixture only; phase must be frozen before applying to commercial trace', 'not commercial asset proof or hardware timing validation', 'training frames4..7, validation frames8..20; validation PNGs not opened before phase freeze']}
    try:
        assert rc == 0, 'MAME failed'
        events = [json.loads(line) for line in (work / 'events.jsonl').read_text().splitlines()]
        sys.dont_write_bytecode = True
        alias = work / 'identity-validator-input'
        alias.mkdir()
        (alias / 'observe.lua').symlink_to(observer)
        spec = importlib.util.spec_from_file_location('frozen_identity_qualifier', HERE / 'run-observer.py')
        q = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(q)
        q.HERE = alias
        q.validate(events, ident, manifest['rom_sha256'])
        try:
            q.validate(events, 'wrong-run', manifest['rom_sha256'])
        except ValueError:
            pass
        else:
            raise AssertionError('wrong identity accepted')
        captures = {e['frame']: e for e in events if e['kind'] == 'frame_capture'}
        assert sorted(captures) == list(range(1, 21)), 'frame capture budget'
        training = [decode_marker(captures[n])[0] for n in range(4, 8)]
        assert len(set(training)) == 1, 'phase not constant in training'
        lag = training[0]
        phase = {'native_to_presented_irq_updates': lag, 'training_frames': [4, 5, 6, 7], 'frozen_before_validation_png_reads': True}
        (work / 'trained-phase.json').write_text(json.dumps(phase, indent=2) + '\n')
        validation = []
        for n in range(8, 21):
            observed, x, native_x = decode_marker(captures[n])
            assert observed == lag, 'reserved author phase mismatch'
            assert x != (native_x - ((lag + 1) % 3) * 8) % 256, 'wrong phase negative accepted'
            validation.append({'frame': n, 'counter': captures[n]['counter'], 'native_x': native_x, 'presented_x': x, 'passed': True})
        result.update(status='PASS_AUTHOR_IRQ6_DMA_PHASE_AND_PIXEL_LAYOUT', phase=phase, validation=validation, wrong_identity_negative_rejected=True, wrong_phase_negative_rejected=True, events_sha256=sha(work / 'events.jsonl'))
    except (AssertionError, ValueError, KeyError, IndexError, FileNotFoundError) as error:
        result['error'] = str(error)
    (work / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return 0 if result['status'].startswith('PASS') else 1


if __name__ == '__main__':
    raise SystemExit(main())
