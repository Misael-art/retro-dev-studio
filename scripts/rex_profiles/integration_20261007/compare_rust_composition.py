#!/usr/bin/env python3
"""C4: compara a composicao indexada do produto (despejo REX_SS_DUMP) com a referencia
independente (nem.py + composicao escrita separadamente aqui). Uso: compare_rust_composition.py ROM DUMP"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nem import nem_decode
rom = open(sys.argv[1], 'rb').read()
art = nem_decode(rom, 0x2C5E4)[0]
def px(t, x, y):
    b = art[t*32 + y*4 + x//2]
    return (b >> 4) if x % 2 == 0 else (b & 15)
dump = {int(l.split()[0]): l.split() for l in open(sys.argv[2]).read().splitlines()}
ok = True
for f in range(16):
    o = 0x2C564 + int.from_bytes(rom[0x2C564+2*f:0x2C564+2*f+2], 'big')
    n = rom[o]; assert n == 1
    y, size, nm, x = rom[o+1], rom[o+2], int.from_bytes(rom[o+3:o+5], 'big'), rom[o+5]
    w, h = ((size >> 2) & 3) + 1, (size & 3) + 1
    base = nm & 0x7FF
    exp = bytearray(w*8*h*8)
    for v in range(h*8):
        for u in range(w*8):
            t = base + (u//8)*h + (v//8)
            exp[v*w*8+u] = px(t, u % 8, v % 8)
    _, W, H, X0, Y0, hexs = dump[f]
    got = bytes.fromhex(hexs)
    # produto grava (linha<<4)|indice com linha 0 para ID 1
    same = (int(W), int(H)) == (w*8, h*8) and bytes(got) == bytes(exp)
    ok &= same
    print(f, "OK" if same else "DIVERGE", W, H, X0, Y0)
print("RESULTADO", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
