#!/usr/bin/env python3
"""Verificacao independente dos grafos: cada no com rom_addr tem rom_bytes IGUAIS aos bytes da ROM indicada
(original ou com patch) e toda aresta liga portas existentes. Uso: verificar_grafos_pulo.py ROM ROM_PATCH GRAFOS_DIR"""
import json, sys, glob, os
rom = open(sys.argv[1], 'rb').read(); romp = open(sys.argv[2], 'rb').read()
ok = True; nn = ne = 0
for f in sorted(glob.glob(os.path.join(sys.argv[3], '*.nodegraph.json'))):
    g = json.load(open(f)); ids = {n['id']: n for n in g['nodes']}
    for n in g['nodes']:
        p = n['params']; nn += 1
        if 'rom_addr' in p:
            buf = rom if p['rom_buffer'] == 'ROM original' else romp
            a = int(p['rom_addr'], 16); b = bytes.fromhex(p['rom_bytes'])
            if buf[a:a+len(b)] != b: ok = False; print('DIVERGE', f, n['id'])
    for e in g['edges']:
        ne += 1
        a, b = ids.get(e['fromNode']), ids.get(e['toNode'])
        if not a or not b or e['fromPort'] not in [o['id'] for o in a['outputs']] or e['toPort'] not in [i['id'] for i in b['inputs']]:
            ok = False; print('ARESTA INVALIDA', f, e['id'])
print('nos', nn, 'arestas', ne, 'RESULTADO', 'PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
