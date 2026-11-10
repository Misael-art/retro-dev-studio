#!/usr/bin/env python3
"""Segunda configuracao AUTORAL da mesma classe contador->comparacao->estado.

Em relacao as duas ROMs ja usadas:
- `goal_original_t6` do crate: guarda no bit 3, passo 1, operador `>=`, registradores D0/D0/D2/D1.
- `counter_gate` autoral: guarda no bit 5 em D3, contador D4, limiar D6, estado D7, passo 3,
  CMP na ordem contador-K, operador `<`.

Aqui nao ha guarda, o passo e 2, o contador e D1, o limiar e D2, o estado e D5, o CMP calcula
K-contador e o operador recuperado e `==`. Enderecos e a entrada tambem sao outros. Nao e
relocacao dos mesmos bytes. O laço de autoexercicio usa D0, para nao ocupar D5.

A ROM percorre uma TABELA de entradas, chama a rotina e grava (contador, estado) na RAM.
Este gerador NAO emite respostas esperadas. Amostra NAO cega: quem escreveu a ROM conhece a regra.
O perfil nao traz afirmacao curada.

Determinista. Uso: python3 -I scripts/rex_profiles/integration_20261009/make-authored-equality-gate.py
"""
import hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/rex_profiles/authoring/equality_gate"
PROFILE_ID = "m68k.counter_equality_state_gate.v1"
SIZE = 0x4000
C, G, P, MARK, DONE, RESULTS = 0x00FF8800, 0x00FF8810, 0x00FF8820, 0x00FF8830, 0x00FF8840, 0x00FF8900
SENTINEL, DONE_MAGIC = 0x5E471E15, 0x600DF00D
ENTRY = 0x0500
STUB = 0x0700
START = 0x0200
TABLE = 0x0900
K, STEP, V_SET, V_OTHER = 7, 2, 4, 0
EDITED = 12
D_COUNTER, D_K, D_STATE = 1, 2, 5

w = lambda v: struct.pack(">H", v & 0xFFFF)
l = lambda v: struct.pack(">I", v & 0xFFFFFFFF)


def put_disp(code, at, target):
    disp = target - (at + 2)
    if disp <= 0 or disp > 127:
        raise SystemExit(f"desvio curto {disp} em {at} nao alcanca {target}")
    code[at + 1] = disp


def routine():
    """Sem guarda: soma, leitura, igualdade, dois resultados (o tomado chama fora)."""
    code = bytearray()
    code += w(0x2039 | D_COUNTER << 9) + l(C)                 # move.l C,d1
    code += w(0x5080 | STEP << 9 | D_COUNTER)                 # addq.l #2,d1
    code += w(0x23C0 | D_COUNTER) + l(C)                      # move.l d1,C
    code += w(0x2039 | D_COUNTER << 9) + l(C)                 # move.l C,d1
    k_at = len(code)
    code += w(0x7000 | D_K << 9 | K)                          # moveq #K,d2
    code += w(0xB080 | D_K << 9 | D_COUNTER)                  # cmp.l d1,d2 (K - contador)
    beq_at = len(code)
    code += b"\x67\x00"                                       # beq.s taken
    code += w(0x7000 | D_STATE << 9 | V_OTHER)                # moveq #0,d5
    code += w(0x23C0 | D_STATE) + l(G)                        # move.l d5,G
    bra_at = len(code)
    code += b"\x60\x00"                                       # bra.s exit
    taken = len(code)
    code += w(0x7000 | D_STATE << 9 | V_SET)                  # moveq #4,d5
    code += w(0x23C0 | D_STATE) + l(G)                        # move.l d5,G
    code += w(0x4878) + w(2)                                  # pea $0002.w
    code += w(0x2F39) + l(P)                                  # move.l P,-(sp)
    code += w(0x4EB9) + l(STUB)                               # jsr STUB
    code += w(0x508F)                                         # addq.l #8,sp
    exit_ = len(code)
    code += w(0x4E75)                                         # rts (fora da regiao)
    put_disp(code, beq_at, taken)
    put_disp(code, bra_at, exit_)
    return bytes(code), ENTRY + exit_, ENTRY + k_at + 1


def cases():
    counters = [
        0, 1, 4, 5, 6, 8, 9, 10, 11, 12,
        0x7FFFFFFF, 0x7FFFFFFE, 0x7FFFFFFD, 0x80000000,
        0xFFFFFFFF, 0xFFFFFFFE, 0xFFFFFFFD, 0xFFFFFFF0,
    ]
    out, seen = [], set()
    for c in counters:
        c &= 0xFFFFFFFF
        if c not in seen:
            seen.add(c)
            out.append((c, 0))
    return out


def driver(n):
    code = bytearray()
    code += w(0x46FC) + w(0x2700)                             # move.w #$2700,sr
    code += w(0x42B9) + l(MARK)                               # clr.l MARK
    code += w(0x23FC) + l(0x11223344) + l(P)                  # move.l #..,P
    code += w(0x41F9) + l(TABLE)                              # lea TABLE,a0
    code += w(0x43F9) + l(RESULTS)                            # lea RESULTS,a1
    code += w(0x303C) + w(n - 1)                              # move.w #n-1,d0
    loop = len(code)
    code += w(0x23D8) + l(C)                                  # move.l (a0)+,C
    code += w(0x2618)                                         # move.l (a0)+,d3 (nao lido pela rotina)
    code += w(0x23FC) + l(SENTINEL) + l(G)                    # move.l #SENTINEL,G
    code += w(0x4EB9) + l(ENTRY)                              # jsr ENTRY
    code += w(0x22F9) + l(C)                                  # move.l C,(a1)+
    code += w(0x22F9) + l(G)                                  # move.l G,(a1)+
    code += w(0x51C8) + w((loop - (len(code) + 2)) & 0xFFFF)  # dbra d0,loop
    code += w(0x23FC) + l(DONE_MAGIC) + l(DONE)               # move.l #DONE_MAGIC,DONE
    code += b"\x60\xFE"                                       # bra.s *
    return bytes(code)


def profile():
    return {
        "schema": "rex-semantic-profile/v1",
        "id": PROFILE_ID,
        "revision": 1,
        "status": "experimental",
        "title": "Contador com igualdade",
        "summary": "Segunda configuracao da mesma classe: sem guarda, soma de 2 no contador, comparacao de igualdade com um limiar e dois resultados de estado, um deles com chamada externa opaca. A regra sai dos bytes; o perfil so configura. Sem afirmacao curada. Experimental.",
        "artifact_tag": "gate-eq",
        "arch": {"cpu": "m68k", "endianness": "big", "instruction_alignment": 2, "bus_address_bits": 24},
        "provenance": {
            "author": "RetroDev Studio - integrador REX",
            "created": "2026-10-10",
            "derived_from": ["crates/rex-gameplay/CONTRACT.md"],
            "notes": "Mesmo analyzer.kind counter_compare_gate. Nao herda curadoria de outro arquivo. Registradores, enderecos, guarda e orientacao da comparacao diferem das duas ROMs ja medidas.",
        },
        "rom_binding": {"mode": "signature"},
        "work_limits": {"max_rom_bytes": 33554432, "max_candidates": 32},
        "analyzer": {"kind": "counter_compare_gate"},
        "selection": {"structural_scan": True, "declared_region": True},
        "edit": {"field": "threshold", "label": "Limiar do contador"},
        "evidence": {
            "claims": [],
            "unknown": [
                "se algum jogo executa este trecho e quem o chama",
                "o que a chamada externa faz: alvo e argumentos ficam registrados, o corpo nao e recuperado",
                "registradores e flags depois da saida",
                "outros escritores do contador ou do estado fora da regiao",
            ],
        },
        "limits": [
            "A regiao e declarada. A varredura so encontra a forma com guarda; esta rotina nao tem guarda.",
            "Subconjunto fechado de formas M68000; qualquer outro opcode recusa a recuperacao.",
            "Unica edicao: o limiar, na faixa que cabe na instrucao original. Operador, passo, enderecos e topologia nao sao editaveis.",
            "A comparacao mede contador e estado nesta amostra autoral. Nao e descoberta de rotina nem descompilacao universal.",
        ],
    }


def main():
    rom = bytearray(SIZE)
    table = cases()
    reg, exit_at, imm_at = routine()
    halt = START - 2
    rom[halt:halt + 2] = b"\x60\xFE"
    rom[0:4] = l(0x00FFFE00)
    rom[4:8] = l(START)
    for v in range(2, 64):
        rom[v * 4:v * 4 + 4] = l(halt)
    title = b"REX AUTHORED EQUALITY GATE"
    header = (b"SEGA MEGA DRIVE " + b"(C)REX 2026.OCT " + title.ljust(48) + title.ljust(48)
              + b"GM 00000000-00" + b"\x00\x00" + b"J".ljust(16) + l(0) + l(SIZE - 1) + l(0x00FF0000) + l(0x00FFFFFF))
    rom[0x100:0x100 + len(header)] = header
    rom[0x1F0:0x1F3] = b"JUE"
    drv = driver(len(table))
    rom[START:START + len(drv)] = drv
    rom[ENTRY:ENTRY + len(reg)] = reg
    stub = w(0x52B9) + l(MARK) + w(0x4E75)                    # addq.l #1,MARK ; rts
    rom[STUB:STUB + len(stub)] = stub
    for i, (c, g) in enumerate(table):
        rom[TABLE + 8 * i:TABLE + 8 * i + 8] = l(c) + l(g)
    if not (TABLE + 8 * len(table) <= SIZE and START + len(drv) <= ENTRY and ENTRY + len(reg) <= STUB and STUB + len(stub) <= TABLE):
        raise SystemExit("layout da ROM sobrepoe regioes")
    csum = sum(struct.unpack(f">{(SIZE - 0x200) // 2}H", bytes(rom[0x200:]))) & 0xFFFF
    rom[0x18E:0x190] = w(csum)
    OUT.mkdir(parents=True, exist_ok=True)
    profiles = OUT / "profiles"
    profiles.mkdir(parents=True, exist_ok=True)
    rom_path = OUT / "rom-autoral-equality-gate.bin"
    rom_path.write_bytes(rom)
    sha = hashlib.sha256(rom).hexdigest()
    (profiles / f"{PROFILE_ID}.json").write_text(json.dumps(profile(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    journey = {
        "schema": "rex-semantic-journey/v1",
        "rom": rom_path.relative_to(ROOT).as_posix(),
        "rom_sha256": sha,
        "profiles_dir": profiles.relative_to(ROOT).as_posix(),
        "profile_id": PROFILE_ID,
        "expect_scan_candidate": False,
        "expect_opaque": 1,
        "expect_nodes": ["entry", "counter_add", "compare", "set_write", "other_write", "set_call"],
        "absent_nodes": ["guard"],
        "expect_curated_other_target": False,
        "declared_region": {"entry": ENTRY, "exits": [exit_at]},
        "edit": {"threshold": EDITED},
        "probe": {
            "results_addr": RESULTS,
            "done_addr": DONE,
            "done_magic": DONE_MAGIC,
            "state_sentinel": SENTINEL,
            "cases": [{"counter_in": c, "guard_register_in": g} for c, g in table],
        },
        "nota": "Previsao = regra recuperada pela interface. Referencia = core executando a ROM. Este arquivo nao contem resultados esperados. Sem guarda: o registrador extra da tabela nao e lido.",
    }
    (OUT / "journey.json").write_text(json.dumps(journey, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({
        "rom_sha256": sha, "entry": hex(ENTRY), "exit": hex(exit_at), "immediate_at": hex(imm_at),
        "cases": len(table), "checksum": hex(csum), "routine_bytes": len(reg), "driver_bytes": len(drv),
    }))


main()
