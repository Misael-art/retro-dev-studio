#!/usr/bin/env python3
"""Reprodução mínima do SIGABRT "longjmp causes uninitialized stack frame".

Duas threads, cada uma criando um Core (lr.py) do MESMO .so Genesis Plus GX e rodando quadros:
  serial   -> termina (exit 0)
  parallel -> aborta (exit 134, "*** longjmp causes uninitialized stack frame ***: terminated")
               ou SIGSEGV (139). Medido em 6 execuções: 5 SIGABRT + 1 SIGSEGV; serial 0/1 falhas.

Causa (evidência: este script): o core C compartilha globais e usa longjmp do 68k; instâncias concorrentes
no mesmo processo corrompem o contexto. Não envolve o encoder aPLib (Rust puro).
Uso: core_concurrency_repro.py {serial|parallel} ROM FRAMES   (CORE=/caminho/genesis_plus_gx_libretro.so)
"""
import os, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lr import Core

SO = os.environ["CORE"]
mode, rom, n = sys.argv[1], sys.argv[2], int(sys.argv[3])


def work(tag):
    c = Core(SO, rom)
    for f in range(n):
        c.buttons = (1 << 3) if (f % 150) in range(120, 130) else 0
        c.run(1)
    print(tag, "done", flush=True)


if mode == "serial":
    work("a"); work("b")
else:
    ts = [threading.Thread(target=work, args=(t,)) for t in ("a", "b")]
    [t.start() for t in ts]; [t.join() for t in ts]
