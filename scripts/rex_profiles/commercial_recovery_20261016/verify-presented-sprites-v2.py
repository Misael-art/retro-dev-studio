#!/usr/bin/env python3
"""Apply the author-calibrated one-update phase to a fixed original trace."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('frozen_sprite_projection', HERE / 'verify-presented-sprites.py')
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def conservatively_mask_nonresource(vram, pixels):
    index = 0
    mask = set()
    for _ in range(80):
        assert 0 <= index < 80, 'SAT outside observed640byte upload'
        words = [int.from_bytes(vram[0xf800 + index * 8 + i:0xf802 + index * 8 + i], 'big') for i in range(0, 8, 2)]
        y, descriptor, attr, x = words
        y, x = (y & 511) - 128, (x & 511) - 128
        w, h = (descriptor >> 10 & 3) + 1, (descriptor >> 8 & 3) + 1
        base = attr & 0x7ff
        if not (0x142 <= base and base + w * h <= 0x142 + 249):
            # The final VRAM snapshot does not prove the preceding dynamic
            # pattern of other resources. Exclude their complete rectangles,
            # independent of actual alpha, priority or captured pixel colors.
            mask.update(pos for pos in pixels if x <= pos[0] < x + w * 8 and y <= pos[1] < y + h * 8)
        index = descriptor & 127
        if index == 0:
            break
    else:
        raise AssertionError('SAT budget')
    return {pos: color for pos, color in pixels.items() if pos not in mask}, len(mask)


def main():
    assert len(sys.argv) == 4, 'usage: verify-presented-sprites-v2.py <private-run> <DMA-verification-json> <fresh-output.json>'
    run, dma_path, out = map(Path, sys.argv[1:])
    assert not out.exists(), 'refuse overwrite'
    phase_path = ROOT / 'data/rex_profiles/commercial_recovery_20261016/m2-author-phase-qualified.json'
    phase = json.loads(phase_path.read_text())
    assert phase['status'] == 'PASS_AUTHOR_IRQ6_DMA_PHASE_AND_PIXEL_LAYOUT' and phase['phase']['native_to_presented_irq_updates'] == 1, 'unqualified phase'
    metadata = json.loads(dma_path.read_text())
    assert metadata['status'] == 'PASS_BOUNDED_RAM_DMA_VDP_STATE', 'DMA not qualified'
    previous = next(t for t in metadata['transfers'] if t['space'] == 'md.vdp.vram' and t['destination'] == 0xf800 and t['frame'] == 1288)
    palettes = [t for t in metadata['transfers'] if t['space'] == 'md.vdp.cram' and t['frame'] in (1288, 1289)]
    assert len(palettes) == 2 and palettes[0]['sha256'] == palettes[1]['sha256'], 'palette phase not invariant in this interval'
    state, payload = {}, bytearray()
    events = run / 'events.jsonl'
    with events.open('rb') as source:
        assert hashlib.file_digest(source, 'sha256').hexdigest() == metadata['trace_sha256'], 'trace identity'
    for line in events.open():
        e = json.loads(line)
        if e['kind'] == 'vdp_memory_snapshot' and e['frame'] == 1290:
            state[e['address_space']] = bytes.fromhex(e['hex'])
        if previous['command_seq'] < e['seq'] <= previous['last_read_seq'] and e['kind'] == 'read' and 0xfff800 <= e['address'] < 0xfffa80:
            assert e['address'] == 0xfff800 + len(payload) and e['mask'] == 65535, 'previous DMA order/width'
            payload.extend(e['data'].to_bytes(2, 'big'))
    assert len(payload) == 640 and sha(payload) == previous['sha256'], 'previous DMA payload pin'
    assert sha(state['md.vdp.cram']) == palettes[0]['sha256'], 'native palette pin'
    assert sha(state['md.vdp.vram'][0x142 * 32:(0x142 + 249) * 32]) == '5c36a38a784b3d40f506cffdd248aa20bda8464b7923093b4be5d0f8e7202860', 'static resource pin'
    result = {'schema': 'rex-observational-sprite-pixel-witness/v2', 'status': 'FAIL', 'phase_qualification_sha256': sha(phase_path.read_bytes()), 'sat_transfer_frame': 1288, 'native_snapshot_frame': 1290, 'presented_frame': 1290, 'reference_origin': 'author-qualified geometry/colors/phase, commercial observed prior DMA SAT and invariant palette, static pinned resource; not reserved game-state or edited-ROM expectations', 'limits': ['nonresource sprite bounding rectangles conservatively excluded, not selected by image matches', 'normal progressive sprites; no general background/scanline renderer', 'MAME original only; not GX session or commercial edit proof']}
    try:
        model.author_controls()
        regs = [int.from_bytes(state['md.vdp.registers'][i:i + 2], 'big') for i in range(0, 64, 2)]
        assert regs[1] == 0x74 and regs[12] == 0x81, 'author-qualified display/IRQ mode'
        vram = bytearray(state['md.vdp.vram'])
        vram[0xf800:0xfa80] = payload
        projected, selected = model.project(vram, state['md.vdp.cram'], regs, 320, 224)
        projected, masked = conservatively_mask_nonresource(vram, projected)
        assert projected, 'empty witness'
        png = run / 'snap/frame-1290-screen1.png'
        image = model.Image.open(png).convert('RGB')
        mismatch = [pos for pos, expected in projected.items() if image.getpixel(pos) != expected]
        result.update(projected_resource_pixels=len(projected), excluded_nonresource_covered_pixels=masked, selected_sprite_indices=sorted(selected), mismatched_pixels=len(mismatch), first_mismatches=mismatch[:12], tolerance=0, png_sha256=sha(png.read_bytes()))
        assert not mismatch, 'calibrated projection mismatch'
        wrong, _ = model.project(state['md.vdp.vram'], state['md.vdp.cram'], regs, 320, 224)
        wrong, _ = conservatively_mask_nonresource(state['md.vdp.vram'], wrong)
        wrong_count = sum(image.getpixel(pos) != expected for pos, expected in wrong.items())
        assert wrong_count > 0, 'wrong current-state phase accepted'
        pos, expected = next(iter(projected.items()))
        assert image.getpixel(pos) != (expected[0] ^ 1, expected[1], expected[2]), 'single pixel negative accepted'
        result.update(status='PASS_BOUNDED_OBSERVATIONAL_SPRITE_PIXELS', wrong_phase_mismatched_pixels=wrong_count, single_pixel_negative_rejected=True)
    except (AssertionError, ValueError, KeyError, IndexError) as error:
        result['error'] = str(error)
    out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return 0 if result['status'].startswith('PASS') else 1


if __name__ == '__main__':
    raise SystemExit(main())
