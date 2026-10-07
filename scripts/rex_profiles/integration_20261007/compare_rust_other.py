#!/usr/bin/env python3
"""M6: compara a composicao indexada do produto (REX_SS_DUMP2) com referencia independente (nem.py + composicao propria).
Uso: compare_rust_other.py ROM DUMP2"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nem import nem_decode
rom = open(sys.argv[1], 'rb').read()
cues = []
p = 0x1D992; n = int.from_bytes(rom[p:p+2], 'big') + 1
for i in range(n):
    off = int.from_bytes(rom[p+2+i*6:p+6+i*6], 'big'); vram = int.from_bytes(rom[p+6+i*6:p+8+i*6], 'big')
    d, t, _, _ = nem_decode(rom, off); cues.append((vram // 32, t, d))
def art(tile):
    for s, t, d in cues:
        if s <= tile < s + t: return s, t, d
def frame_off(ptr, k):
    mn = 999; out = []
    for i in range(32):
        if 2*i >= mn: break
        v = int.from_bytes(rom[ptr+2*i:ptr+2*i+2], 'big')
        if v < 2*(i+1) or v >= 0x100: break
        mn = min(mn, v); out.append(v)
    return out[k]
ok = True; cnt = 0
for line in open(sys.argv[2]).read().splitlines():
    ptr, campo, f, W, H, hx = line.split()
    ptr = int(ptr); campo = int(campo); f = int(f)
    a = ptr + frame_off(ptr, f); n = rom[a]
    ps = []
    for i in range(n):
        r = rom[a+1+i*5:a+6+i*5]
        ps.append(((r[0]-256) if r[0] > 127 else r[0], ((r[1] >> 2) & 3) + 1, (r[1] & 3) + 1, int.from_bytes(r[2:4], 'big'), (r[4]-256) if r[4] > 127 else r[4]))
    x0 = min(p[4] for p in ps); y0 = min(p[0] for p in ps)
    x1 = max(p[4]+8*p[1] for p in ps); y1 = max(p[0]+8*p[2] for p in ps)
    w, h = x1-x0, y1-y0
    exp = bytearray(w*h)
    s, t, d = art(campo & 0x7FF)
    for (y, pw, ph, name, x) in ps:
        nm = (campo + name) & 0xFFFF; ti = nm & 0x7FF; ln = (nm >> 13) & 3; xf = nm & 0x800; yf = nm & 0x1000
        for v in range(ph*8):
            for u in range(pw*8):
                su = pw*8-1-u if xf else u; sv = ph*8-1-v if yf else v
                tt = ti + (su//8)*ph + (sv//8) - s
                b = d[tt*32 + (sv % 8)*4 + (su % 8)//2]
                c = (b >> 4) if (su % 8) % 2 == 0 else (b & 15)
                if c: exp[(y-y0+v)*w + (x-x0+u)] = (ln << 4) | c
    same = (int(W), int(H)) == (w, h) and bytes.fromhex(hx) == bytes(exp)
    ok &= same; cnt += 1
    print(hex(ptr), hex(campo), f, "OK" if same else "DIVERGE", W, H)
print("PARES", cnt, "RESULTADO", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
