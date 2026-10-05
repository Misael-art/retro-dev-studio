#!/usr/bin/env python3
"""Referencia independente de `xorshift64*` (Marsaglia, 2003) para a barra D.

Fai de oraculo externo do xerador de entropia de `lib_bench.mjs` (regra R16 de
`EXTENSOES-D.md`): esta implementacion usa enteiros arbitrarios de Python, outro
backend aritmetico, e escribiuse a partir da especificacion publicada (terna
12/25/27 e `a = 0x2545F4914F6CDD1D`), non a partir do codigo de Node. O estadio
de semeadura FNV-1a replica o da barra porque e eso o que se quere controlar.

Uso:  python3 oraculo_rng.py '["<semente>", ...]' [n]
Sae JSON: {"<semente>": [v0, v1, ...], ...}
"""
import json
import sys

M64 = (1 << 64) - 1
A = 0x2545F4914F6CDD1D  # 2685821657736338717, o multiplicador publicado


def semente(texto):
    s = 1469598103934665603
    for b in texto.encode("utf-8"):
        s = ((s ^ b) * 1099511628211) & M64
    return 1 if s == 0 else s


def fluxo(texto, n):
    st = semente(f"{texto}|dsb1|1")
    out = []
    for _ in range(n):
        st ^= (st >> 12) & M64
        st = (st ^ ((st << 25) & M64)) & M64
        st ^= (st >> 27) & M64
        st &= M64
        out.append((((st * A) & M64) >> 33) % 256)
    return out


if __name__ == "__main__":
    seeds = json.loads(sys.argv[1])
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 16
    print(json.dumps({s: fluxo(s, n) for s in seeds}, indent=2))
