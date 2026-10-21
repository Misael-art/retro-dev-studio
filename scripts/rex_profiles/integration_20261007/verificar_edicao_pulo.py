#!/usr/bin/env python3
"""Verifica no core genesis_plus_gx o EFEITO das edicoes do perfil m68k.platformer_jump.v1 em Sonic 1 e Sonic Delta.
Mede o mesmo pulo (toque de 1 quadro e botao segurado) na ROM original e nas ROMs editadas.
Uso: verificar_edicao_pulo.py CORE.so SONIC1.bin DELTA.bin DIR_EDICOES   (JSON no stdout)"""
import sys, os, json, hashlib, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lr

LAYOUTS = {
    'sonic1': dict(base=0xD000, x=0x08, y=0x0C, vy=0x12, st=0x22, flag=0x3C, tag='Sonic 1 (objetos estilo S1)'),
    'delta': dict(base=0xB000, x=0x10, y=0x14, vy=0x1A, st=0x2A, flag=0x40, tag='Sonic Delta (objetos estilo S3K)'),
}

def start(game, core, rom):
    c = lr.Core(core, rom)
    if game == 'sonic1':
        c.run(600); c.buttons = 1 << 3
        for _ in range(600):
            c.run(1)
            if c.peek(0xF600, 1)[0] == 0x0c: break
        c.buttons = 0; c.run(200)
    else:
        c.run(1900)
        for step in range(60):
            c.buttons = 1 << 3; c.run(6); c.buttons = 0; c.run(114)
            if c.peek(0xF600, 1)[0] == 0x0c and step >= 4: break
        c.run(400)
    return c

def obj(c, L):
    o = c.peek(L['base'], 0x4A)
    g = lambda a, n=2, s=False: int.from_bytes(o[a:a+n], 'big', signed=s)
    return dict(y=g(L['y']), vy=g(L['vy'], 2, True), fl=o[L['flag']])

def medir(game, core, rom, modo):
    L = LAYOUTS[game]; c = start(game, core, rom)
    y0 = obj(c, L)['y']
    c.buttons = 1 << 8                      # botao C
    tr = []
    for f in range(60):
        if f == 1 and modo == 'toque': c.buttons = 0
        if f == 40 and modo == 'segura': c.buttons = 0
        c.run(1); s = obj(c, L); tr.append(s)
    return dict(vy_quadro_2=tr[1]['vy'], apice_px=y0 - min(t['y'] for t in tr), flag=max(t['fl'] for t in tr))

core, s1, delta, edits = sys.argv[1:5]
tmp = tempfile.mkdtemp()
def cp(src, nome):
    d = os.path.join(tmp, nome + '.bin'); shutil.copy(src, d); return d
casos = [('sonic1', 'original', s1)] + [('sonic1', n[:-4], os.path.join(edits, n)) for n in sorted(os.listdir(edits)) if n.startswith('s1-') and n.endswith('.bin')] \
      + [('delta', 'original', delta)] + [('delta', n[:-4], os.path.join(edits, n)) for n in sorted(os.listdir(edits)) if n.startswith('delta-') and n.endswith('.bin')]
out = dict(core_sha256=hashlib.sha256(open(core, 'rb').read()).hexdigest(), jogos={k: v['tag'] for k, v in LAYOUTS.items()}, medidas=[])
for game, nome, rom in casos:
    path = cp(rom, f'{game}-{nome}')
    m = {modo: medir(game, core, path, modo) for modo in ('toque', 'segura')}
    out['medidas'].append(dict(jogo=game, rom=nome, rom_sha256=hashlib.sha256(open(rom, 'rb').read()).hexdigest(), **m))
print(json.dumps(out, indent=1))
