#!/usr/bin/env python3
"""Sonda de campos (calibracao frente C): le `objdump -d` e imprime, por
instrucao, os campos das hipoteses de mascara usadas em src/decode.rs.
Nao e codigo de produto."""
import re, sys

def f(op, lo, w):
    return (op >> lo) & ((1 << w) - 1)

rows, cur = [], None
for line in sys.stdin:
    m = re.match(r'^\s+([0-9a-f]+):\t((?:[0-9a-f]{4} )+)(.*)$', line)
    if m:
        cur = [m.group(1), [int(w, 16) for w in m.group(2).split()], m.group(3).strip()]
        rows.append(cur)

for addr, words, text in rows:
    op = words[0]
    hi = op >> 12
    q = f"Qop={f(op,10,2)} cnt={f(op,7,3)} Qsz={f(op,5,2)} ea={f(op,0,6):06b}"
    sh = f"cnt={f(op,9,3)} dir={f(op,8,1)} sz={f(op,6,2)} typ={f(op,3,3)} reg={f(op,0,3)}"
    al = f"reg={f(op,9,3)} dir={f(op,8,1)} sz={f(op,6,2)} ea={f(op,0,6):06b}"
    mv = f"sz13={f(op,12,2)} dreg={f(op,9,3)} dmode={f(op,6,3)} smode={f(op,3,3)} sreg={f(op,0,3)}"
    br = f"cc={f(op,8,4)} disp={f(op,0,8):02x}"
    sp = f"b11={f(op,11,1)} b10={f(op,10,1)} b9={f(op,9,1)} b8={f(op,8,1)} b7={f(op,7,1)} b6={f(op,6,1)} ea={f(op,0,6):06b}"
    col = {"0": mv, "1": mv, "2": mv, "3": mv, "4": sp, "5": q, "6": br, "7": br,
           "14": sh}.get(f"{hi:x}", "")
    print(f"{addr} {op:04x} | {text[:36]:36} | {col}")
