#!/usr/bin/env python3
"""Resumo bruto da pasada de xanela (sen `--chamada-sitio`): confianza e as
gardas §5/§7 vistas. Imprime, non axusta nada."""
import json
import sys

o = json.load(open(sys.argv[1], encoding="utf-8"))
gardas = [
    l
    for l in o["limitacions"]
    if l.startswith(("tramo-non-modelado", "ventana-ambigua", "segmento-roto"))
]
print(f"     xanela {o['carga_sitio']}: {o['confianza']} gardas={gardas or 'ningunha'}")
