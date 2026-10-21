#!/usr/bin/env python3
"""Verifica o pulo duplo no core genesis_plus_gx: ROM original x ROM com patch, mesmas entradas.
Entrada: toque no botao (1 quadro) e, 12 quadros depois, 2o toque (ou segurando). Saida: JSON no stdout.
Uso: testar_pulo_duplo.py CORE.so ROM_ORIGINAL ROM_PATCH   (lr.py/game.py no mesmo diretorio)"""
import sys, os, json, hashlib, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from game import start_level, st
core, roms = sys.argv[1], sys.argv[2:4]
def trial(rom, modo, btn=0):
    c = start_level(core, rom)
    c.buttons = 1 << btn; c.run(1); c.buttons = 0
    tr = []
    for f in range(40):
        if f == 12: c.buttons = 1 << btn
        if f == 13 and modo == 'toque': c.buttons = 0
        if f == 30 and modo == 'segura': c.buttons = 0
        c.run(1); s = st(c); tr.append((s['y'], s['yv'], s['fl']))
    c.buttons = 0
    ys = [t[0] for t in tr]
    c.buttons = 1 << btn; c.run(1); c.buttons = 0; c.run(1)
    terceiro = st(c)
    return dict(flag_por_quadro=[t[2] for t in tr], yv_quadros_10_17=[t[1] for t in tr][10:18], y_minimo=min(ys), y_final=ys[-1], flag_apos_3o_toque=terceiro['fl'])
out = dict(core_sha256=hashlib.sha256(open(core, 'rb').read()).hexdigest(), local='GHZ1 posicao inicial (x=0x50,y=0x3B0), entrada por Start no demo -> gm=0x0C')
tmp = tempfile.mkdtemp()
for nome, rom in zip(('original', 'patch'), roms):
    cp = os.path.join(tmp, nome + '.bin'); shutil.copy(rom, cp)
    out[nome] = dict(rom_sha256=hashlib.sha256(open(rom, 'rb').read()).hexdigest(),
                     botoes={b: {m: trial(cp, m, bid) for m in ('toque', 'segura')} for b, bid in (('C', 8), ('B', 0), ('A', 1))})
print(json.dumps(out, indent=1))
