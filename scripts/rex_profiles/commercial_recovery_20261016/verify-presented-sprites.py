#!/usr/bin/env python3
"""Observational sprite pixel witness, not an independent game-state oracle."""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

LEVEL = [0, 52, 87, 116, 144, 172, 206, 255]


def rgb(word):
    return tuple(LEVEL[word >> shift & 7] for shift in (1, 5, 9))


def nibble(vram, base, width, height, x, y, flip_x=False, flip_y=False):
    if flip_x:
        x = width * 8 - 1 - x
    if flip_y:
        y = height * 8 - 1 - y
    tile = (base + x // 8 * height + y // 8) & 0x7ff
    byte = vram[(tile * 32 + y % 8 * 4 + x % 8 // 2) & 0xffff]
    return byte >> (0 if x % 2 else 4) & 15


def author_controls():
    vram = bytearray(65536)
    for i in range(4):
        vram[(i + 1) * 32:(i + 2) * 32] = bytes([(i + 1) * 17]) * 32
    for fx, fy, expected in [(False, False, [1, 3, 2, 4]), (True, False, [3, 1, 4, 2]), (False, True, [2, 4, 1, 3]), (True, True, [4, 2, 3, 1])]:
        assert [nibble(vram, 1, 2, 2, x, y, fx, fy) for x, y in [(0, 0), (15, 0), (0, 15), (15, 15)]] == expected, 'literal column order/flip reference'
    assert [rgb(word) for word in [0xe, 0xe0, 0xe00, 0xeee, 0x6]] == [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 255), (116, 0, 0)], 'literal palette reference'
    vram[32] = 0x10
    assert nibble(vram, 1, 1, 1, 0, 0) == 1 and nibble(vram, 1, 1, 1, 1, 0) == 0, 'nibble order/transparency'


def project(vram, cram, regs, width, height):
    assert not regs[12] & 8, 'shadow/highlight outside this model'
    assert not regs[12] & 6, 'interlace outside this model'
    sat = (regs[5] & (0x7e if regs[12] & 0x80 else 0x7f)) << 9
    assert sat == 0xf800, 'frozen SAT address'
    owned = {}
    selected = set()
    index = 0
    visited = set()
    for _ in range(80):
        assert index not in visited, 'cyclic SAT chain'
        visited.add(index)
        words = [int.from_bytes(vram[sat + index * 8 + i:sat + index * 8 + i + 2], 'big') for i in range(0, 8, 2)]
        y, descriptor, attr, x = words
        y, x = (y & 511) - 128, (x & 511) - 128
        w, h = (descriptor >> 10 & 3) + 1, (descriptor >> 8 & 3) + 1
        base = attr & 0x7ff
        in_resource = 0x142 <= base and base + w * h <= 0x142 + 249
        for dy in range(h * 8):
            for dx in range(w * 8):
                px, py = x + dx, y + dy
                if not (0 <= px < width and 0 <= py < height):
                    continue
                value = nibble(vram, base, w, h, dx, dy, bool(attr & 0x800), bool(attr & 0x1000))
                if value == 0 or (px, py) in owned:
                    continue
                color_index = (attr >> 13 & 3) * 16 + value
                word = int.from_bytes(cram[color_index * 2:color_index * 2 + 2], 'big')
                owned[(px, py)] = (rgb(word), in_resource, index)
                if in_resource:
                    selected.add(index)
        index = descriptor & 127
        if index == 0:
            break
    else:
        raise AssertionError('SAT chain budget exceeded')
    return {pos: value[0] for pos, value in owned.items() if value[1]}, selected


def main():
    assert len(sys.argv) == 4, 'usage: verify-presented-sprites.py <private-events> <frame1290-PNG> <fresh-output.json>'
    events, png, out = map(Path, sys.argv[1:])
    assert not out.exists(), 'refuse overwrite'
    result = {'schema': 'rex-observational-sprite-pixel-witness/v1', 'status': 'FAIL', 'reference_origin': 'native same-runtime VDP state plus separate bit/geometry/color implementation from pinned MAME0289 source; post-observation, not blind or reserved game-state expectations', 'limits': ['normal sprites only; no background high-priority occlusion/shadow/interlace model', 'not a modified-ROM visual expectation', 'native frame1290 state and presented frame1290 target assumed aligned in this first hypothesis; failure is preserved']}
    try:
        author_controls()
        state = {}
        with events.open('rb') as source:
            assert hashlib.file_digest(source, 'sha256').hexdigest() == '7a6ee7353e06804dee2b6199e93f466d3a5b58a5dadd0d4f6e03be0d46d62bc2', 'trace identity'
        for line in events.open():
            event = json.loads(line)
            if event['kind'] == 'vdp_memory_snapshot' and event['frame'] == 1290:
                state[event['address_space']] = bytes.fromhex(event['hex'])
        image = Image.open(png).convert('RGB')
        assert image.size == (320, 224), 'presented image dimensions'
        regs = [int.from_bytes(state['md.vdp.registers'][i:i + 2], 'big') for i in range(0, 64, 2)]
        pixels, sprites = project(state['md.vdp.vram'], state['md.vdp.cram'], regs, 320, 224)
        assert pixels and sprites, 'no resource pixels projected'
        mismatch = [(x, y) for (x, y), expected in pixels.items() if image.getpixel((x, y)) != expected]
        result.update(projected_resource_pixels=len(pixels), selected_sprite_indices=sorted(sprites), mismatched_pixels=len(mismatch), first_mismatches=mismatch[:12], tolerance=0, png_sha256=hashlib.sha256(png.read_bytes()).hexdigest())
        assert not mismatch, 'native-state sprite projection differs from presented image'
        (x, y), expected = next(iter(pixels.items()))
        wrong = (expected[0] ^ 1, expected[1], expected[2])
        assert wrong != image.getpixel((x, y)), 'single-pixel negative accepted'
        result.update(status='PASS_BOUNDED_OBSERVATIONAL_SPRITE_PIXELS', literal_model_controls=True, single_pixel_negative_rejected=True)
    except (AssertionError, KeyError, ValueError, IndexError) as error:
        result['error'] = str(error)
    out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return 0 if result['status'].startswith('PASS') else 1


if __name__ == '__main__':
    raise SystemExit(main())
