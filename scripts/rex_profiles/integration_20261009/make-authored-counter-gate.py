#!/usr/bin/env python3
"""Variante AUTORAL EXECUTAVEL da classe contador->comparacao->estado: uma ROM Mega Drive minima, escrita
para este teste (nenhum conteudo de jogo), que se autoexercita.

Em relacao ao caso existente (`goal_original_t6` do crate): OUTROS registradores (D3 guarda, D4 contador,
D6 limiar, D7 estado; la D0/D0/D2/D1), OUTROS enderecos, bit de guarda 5 (la 3), passo 3 (la 1), operandos
do CMP na ordem inversa (aqui `contador - K`; la `K - contador`), ramo tomado = bloco que escreve o valor nao
nulo e operador resultante diferente (la `>=`). Nao e relocacao dos mesmos bytes.

A ROM percorre uma TABELA de estados de entrada (contador, registrador de guarda), chama a rotina e grava
(contador, estado) resultantes na RAM; ao fim grava um marcador. Quem recupera a regra recebe so os bytes:
este gerador NAO emite respostas esperadas (a previsao sai da regra recuperada; a referencia e o core).
Amostra NAO cega: quem escreveu a ROM conhece a regra.

Determinista. Uso: python3 -I scripts/rex_profiles/integration_20261009/make-authored-counter-gate.py"""
import hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/rex_profiles/authoring/counter_gate"
SIZE = 0x4000
C, G, P, MARK, DONE, RESULTS = 0x00FF9010, 0x00FF9024, 0x00FF9030, 0x00FF9040, 0x00FF9050, 0x00FFA000
SENTINEL, DONE_MAGIC = 0x5E471E15, 0x600DF00D
ENTRY = 0x0400          # rotina (regiao)
STUB = 0x0600           # alvo da chamada externa (opaca para o analisador)
START = 0x0200          # codigo de partida / laco de autoexercicio
TABLE = 0x0800
K, STEP, GUARD_BIT, V_TAKEN, V_FALL = 40, 3, 5, 9, 0
EDITED = 100            # limiar que a jornada vai pedir; a tabela cobre as duas fronteiras

w = lambda v: struct.pack(">H", v & 0xFFFF)
l = lambda v: struct.pack(">I", v & 0xFFFFFFFF)


def routine():
    """A regiao: guarda -> soma -> leitura -> limiar -> dois resultados (um com chamada externa)."""
    code = bytearray()
    code += w(0x0800 | 3) + w(GUARD_BIT)            # btst #5,d3
    beq_at = len(code); code += b"\x67\x00"          # beq.s exit (preenchido)
    code += w(0x2039 | 4 << 9) + l(C)               # move.l C,d4
    code += w(0x5080 | STEP << 9 | 4)               # addq.l #3,d4
    code += w(0x23C0 | 4) + l(C)                    # move.l d4,C
    code += w(0x2039 | 4 << 9) + l(C)               # move.l C,d4        (leitura)
    k_at = len(code); code += w(0x7000 | 6 << 9 | K)  # moveq #K,d6
    code += w(0xB080 | 4 << 9 | 6)                  # cmp.l d6,d4        (d4 - d6 = contador - K)
    blt_at = len(code); code += b"\x6D\x00"          # blt.s taken
    # bloco do ramo NAO tomado
    code += w(0x7000 | 7 << 9 | V_FALL)             # moveq #0,d7
    code += w(0x23C0 | 7) + l(G)                    # move.l d7,G
    bra_at = len(code); code += b"\x60\x00"          # bra.s exit
    taken = len(code)
    code += w(0x7000 | 7 << 9 | V_TAKEN)            # moveq #9,d7
    code += w(0x23C0 | 7) + l(G)                    # move.l d7,G
    code += w(0x4878) + w(2)                        # pea $0002.w
    code += w(0x2F39) + l(P)                        # move.l P,-(sp)
    code += w(0x4EB9) + l(STUB)                     # jsr STUB
    code += w(0x508F)                               # addq.l #8,sp
    exit_ = len(code)
    code += w(0x4E75)                               # rts (FORA da regiao: e a saida)
    code[beq_at + 1] = exit_ - (beq_at + 2)
    code[blt_at + 1] = taken - (blt_at + 2)
    code[bra_at + 1] = exit_ - (bra_at + 2)
    return bytes(code), ENTRY + exit_, ENTRY + k_at + 1


def cases():
    out = []
    counters = [0, 1, 0x7FFFFFFF, 0x7FFFFFFD, 0x7FFFFFFC, 0x80000000, 0xFFFFFFFF, 0xFFFFFFFD, 0xFFFFFFFC, 0xFFFFFFF0]
    for t in (K, EDITED):                           # fronteiras do limiar original e do editado
        counters += [t - STEP + d for d in (-2, -1, 0, 1, 2)]
    for c in counters:
        for guard in (1 << GUARD_BIT, 0, 0xFFFFFFDF):   # ligada, desligada, todos os bits menos o da guarda
            out.append((c & 0xFFFFFFFF, guard))
    return out


def driver(n):
    code = bytearray()
    code += w(0x46FC) + w(0x2700)                   # move.w #$2700,sr
    code += w(0x42B9) + l(MARK)                     # clr.l MARK
    code += w(0x23FC) + l(0x11223344) + l(P)        # move.l #..,P   (argumento lido pela chamada)
    code += w(0x41F9) + l(TABLE)                    # lea TABLE,a0
    code += w(0x43F9) + l(RESULTS)                  # lea RESULTS,a1
    code += w(0x3A3C) + w(n - 1)                    # move.w #n-1,d5
    loop = len(code)
    code += w(0x23D8) + l(C)                        # move.l (a0)+,C
    code += w(0x2618)                               # move.l (a0)+,d3
    code += w(0x23FC) + l(SENTINEL) + l(G)          # move.l #SENTINEL,G
    code += w(0x4EB9) + l(ENTRY)                    # jsr ENTRY
    code += w(0x22F9) + l(C)                        # move.l C,(a1)+
    code += w(0x22F9) + l(G)                        # move.l G,(a1)+
    code += w(0x51CD) + w((loop - (len(code) + 2)) & 0xFFFF)  # dbra d5,loop
    code += w(0x23FC) + l(DONE_MAGIC) + l(DONE)     # move.l #DONE_MAGIC,DONE
    code += b"\x60\xFE"                             # bra.s *
    return bytes(code)


def main():
    rom = bytearray(SIZE)
    table = cases()
    reg, exit_at, imm_at = routine()
    halt = START - 2
    rom[halt:halt + 2] = b"\x60\xFE"                # tratador de excecao: para
    rom[0:4] = l(0x00FFFE00); rom[4:8] = l(START)
    for v in range(2, 64):
        rom[v * 4:v * 4 + 4] = l(halt)
    header = (b"SEGA MEGA DRIVE " + b"(C)REX 2026.OCT " + b"REX AUTHORED COUNTER GATE".ljust(48) + b"REX AUTHORED COUNTER GATE".ljust(48)
              + b"GM 00000000-00" + b"\x00\x00" + b"J".ljust(16) + l(0) + l(SIZE - 1) + l(0x00FF0000) + l(0x00FFFFFF))
    rom[0x100:0x100 + len(header)] = header
    rom[0x1F0:0x1F3] = b"JUE"
    drv = driver(len(table))
    rom[START:START + len(drv)] = drv
    rom[ENTRY:ENTRY + len(reg)] = reg
    stub = w(0x52B9) + l(MARK) + w(0x4E75)          # addq.l #1,MARK ; rts
    rom[STUB:STUB + len(stub)] = stub
    for i, (c, g) in enumerate(table):
        rom[TABLE + 8 * i:TABLE + 8 * i + 8] = l(c) + l(g)
    assert TABLE + 8 * len(table) <= SIZE and START + len(drv) <= ENTRY and ENTRY + len(reg) <= STUB
    csum = sum(struct.unpack(f">{(SIZE - 0x200) // 2}H", bytes(rom[0x200:]))) & 0xFFFF
    rom[0x18E:0x190] = w(csum)                      # checksum padrao VALIDO: a edicao tera de atualiza-lo
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "rom-autoral-counter-gate.bin").write_bytes(rom)
    sha = hashlib.sha256(rom).hexdigest()
    # roteiro: SO o que e declarado (regiao, enderecos de leitura, tabela de ENTRADAS). Nenhuma resposta.
    journey = {
        "schema": "rex-semantic-journey/v1",
        "rom": (OUT / "rom-autoral-counter-gate.bin").relative_to(ROOT).as_posix(), "rom_sha256": sha,
        "profile_id": "m68k.counter_threshold_state_gate.v1",
        "declared_region": {"entry": ENTRY, "exits": [exit_at]},
        "edit": {"threshold": EDITED},
        "probe": {"results_addr": RESULTS, "done_addr": DONE, "done_magic": DONE_MAGIC, "state_sentinel": SENTINEL,
                  "cases": [{"counter_in": c, "guard_register_in": g} for c, g in table]},
        "nota": "previsao = regra recuperada pela interface; referencia = core executando a ROM. Este arquivo nao contem resultados esperados.",
    }
    (OUT / "journey.json").write_text(json.dumps(journey, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({"rom_sha256": sha, "entry": hex(ENTRY), "exit": hex(exit_at), "immediate_at": hex(imm_at), "cases": len(table), "checksum": hex(csum)}))


main()
