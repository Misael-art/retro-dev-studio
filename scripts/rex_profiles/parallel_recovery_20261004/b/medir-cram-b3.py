#!/usr/bin/env python3
"""Frente b (ADENDA-B3 + B3.1, E18R–E22): referência faltante do CRAM.

Mede a ROM BYOR (SOMENTE leitura) contra as predicoes congeladas em
docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS-ADENDA-B3.md
e EXPECTATIONS-ADENDA-B3-1.md (refreeze E18R). Metodo (E16 herdado):
blocos montados com o toolchain m68k-elf PINADO, org=0; endereços
absolutos desconhecidos ANTES da medida (lea .l de tabelas e os campos
.w da fase geral, segundo E18R) sao WILDCARDS detectados por montagem
com dois placeholders; busca na ROM exige ocorrencia UNICA por bloco;
os valores lidos no sítio decidem a hipótese H_A/H_B de E18R.

Nada aqui roda a ROM: nivel maximo = vinculo estrutural + identidade
byte-a-byte contra referencia pinada (E22).

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/medir-cram-b3.py \
      --rom <BYOR.bin> --out data/.../evidencia/cram-b3.json
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import importlib.util
import json
import pathlib
import re
import struct
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent


def _carregar(nome, caminho):
    spec = importlib.util.spec_from_file_location(nome, caminho)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


MI = _carregar("montar_isa", HERE / "montar-isa.py")

ROM_SHA_ESPERADO = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"

# E18R — hipóteses (16-bit .w dos símbolos da fase geral)
H_A = {
    "ani0_time": 0xF900, "ani0_frame": 0xF901,
    "palss_num": 0xF1DA, "palss_time": 0xF1DC, "palss_index": 0xF1DE,
    "palette_line1": 0xF540, "palette_line2": 0xF560, "palette_line3": 0xF580,
    "palette_line4": 0xF5A0, "palette_fading": 0xF5C0, "palette_water": 0xF4C0,
    "scrposy_vdp": 0xF056, "f_pause": 0xF07A, "ssbganim": 0xF1E0, "vdp_buffer2": 0xF080,
}
H_B = {k: v + 0x5C0 for k, v in H_A.items()}

# SHAs exatos congelados em B3 (linhas do addendum):
BINS = {
    "Special Stage.bin": (128, "2f9072d8714ac735dba537f2cbb00aeac349b411fc86d1ef76fb9c81b7c3432d"),
    "Cycle - Special Stage 1.bin": (72, "ec2391eb813ae8cbd1e6e81e9e52c8b58f419cfc368154e5de6f3ebf561068a9"),
    "Cycle - Special Stage 2.bin": (210, "65e5c9430f84c7a4680bbda060f29e7f50f2e22d87fa9c8368b04cb5826bd74c"),
}


class Recusa(Exception):
    pass


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


# ---------------------------------------------------------------- montagem

def montar(tmp, nome, linhas, wildspec):
    """wildspec: lista de (idx_linha, 'l'|'w', nome) em ordem de aparição.
    Linhas devem conter os tokens PLACEH (para 'l') ou PLACEW (para 'w').
    Retorna (pattern, runs=[(off,len,nome,kind)], bytes_totais)."""
    PA_L, PB_L = 0x11111111, 0x22222222
    PA_W, PB_W = 0x1111, 0x2222

    def build(l, a_l, a_w):
        if "PLACEH" in l:
            return l.replace("PLACEH", f"0x{a_l:08x}")
        if "PLACEW" in l:
            return l.replace("PLACEW", f"0x{a_w:04x}")
        return l

    versoes = []
    for a_l, a_w in ((PA_L, PA_W), (PB_L, PB_W)):
        ls = []
        wild_lines = {i for (i, _k, _n) in wildspec}
        for i, l in enumerate(linhas):
            ls.append(build(l, a_l, a_w) if i in wild_lines else l)
        versoes.append(MI.assemble(tmp, f"{nome}-{a_l:08x}", 0, ls))
    a, b = versoes
    if len(a) != len(b):
        raise Recusa(f"montagens divergiram em tamanho: {nome}")
    diff = [i for i in range(len(a)) if a[i] != b[i]]
    runs = []
    for i in diff:
        if runs and runs[-1][0] + runs[-1][1] == i:
            runs[-1] = (runs[-1][0], runs[-1][1] + 1)
        else:
            runs.append((i, 1))
    if len(runs) != len(wildspec):
        raise Recusa(f"{nome}: {len(runs)} runs selvagens vs {len(wildspec)} esperados; "
                     f"padrao A={a.hex()}")
    saida = []
    for (off, ln), (_idx, kind, wname) in zip(runs, wildspec):
        if ln != (4 if kind == "l" else 2):
            raise Recusa(f"{nome}: run {wname} com {ln} B, esperado {4 if kind=='l' else 2} B")
        # lea (xxx).l,%aN => word 0x41F9 | (N<<8): primeiro byte 0x41|N<<1, segundo 0xF9
        if kind == "l" and not ((a[off - 2] & 0xF1) == 0x41 and a[off - 1] == 0xF9):
            raise Recusa(f"{nome}: run .l {wname} nao precedido por lea abs.l "
                         f"(esperado 41F9..4FF9 impar, achado {a[off - 2]:02x}{a[off - 1]:02x})")
        saida.append((off, ln, wname, kind))
    return a, saida


def _mascarado(pattern: bytes, runs) -> set:
    m = set()
    for off, ln, _n, _k in runs:
        m.update(range(off, off + ln))
    return m


def buscar(rom: bytes, pattern: bytes, mask: set) -> list[int]:
    n = len(pattern)
    if n == 0:
        return []
    anchor = 0
    while anchor in mask:
        anchor += 1
    hits, start = [], -1
    while True:
        i = rom.find(pattern[anchor], start + 1 if start >= 0 else 0)
        if i < 0:
            break
        base = i - anchor
        if 0 <= base and base + n <= len(rom) and all(
                j in mask or rom[base + j] == pattern[j] for j in range(n)):
            hits.append(base)
        start = i
    return hits


def ler_alvos(rom: bytes, base: int, runs):
    out = {}
    for off, ln, nome, kind in runs:
        raw = rom[base + off: base + off + ln]
        out[nome] = int.from_bytes(raw, "big")
    return out


def desmontar(tmp, nome, hexbytes, org):
    s = tmp / f"dis-{nome}.s"
    o = tmp / f"dis-{nome}.o"
    s.write_text(".text\n.byte " +
                 ",".join(f"0x{x:02x}" for x in hexbytes) + "\n")
    MI.run([str(MI.AS), "-m68000", "-o", str(o), str(s)])
    # bytes a partir do offset 0; --adjust-vma aplica o endereco real uma unica vez
    r = MI.run([str(MI.OBJDUMP), "-d", "--adjust-vma", f"0x{org:x}", str(o)])
    out = []
    for linha in r.stdout.splitlines():
        m = re.match(r"^\s*([0-9a-f]+):\s+(?:[0-9a-f]{2,4} )+\s*(.*)$", linha)
        if m:
            out.append({"endereco": "0x" + m.group(1),
                        "mnemonico": m.group(2).strip()})
    return out


# ---------------------------------------------------------------- predicoes

def predizer_tabela_paredes() -> bytes:
    out = b""
    for line in range(4):
        normal = (line << 13) | 0x142
        blink = (((line - 1) & 3) << 13) | 0x142
        pattern = [normal, blink, normal, normal, normal, normal, normal, blink]
        out += b"".join(struct.pack(">H", wd) for wd in pattern) * 2
    assert len(out) == 128
    return out


LINHAS_E19 = [
    "	subq.b #1,(PLACEW).w",
    "	bpl.s LBL",
    "	move.b #7,(PLACEW).w",
    "	subq.b #1,(PLACEW).w",
    "	andi.b #7,(PLACEW).w",
    "LBL:	lea (0xff4016).l,%a1",
    "	lea (PLACEH).l,%a0",
    "	moveq #0,%d0",
    "	move.b (PLACEW).w,%d0",
    "	add.w %d0,%d0",
    "	lea (0,%a0,%d0.w),%a0",
    "	.rept 4",
    "	move.w (0,%a0),0(%a1)",
    "	move.w (2,%a0),8(%a1)",
    "	move.w (4,%a0),16(%a1)",
    "	move.w (6,%a0),24(%a1)",
    "	move.w (8,%a0),32(%a1)",
    "	move.w (10,%a0),40(%a1)",
    "	move.w (12,%a0),48(%a1)",
    "	move.w (14,%a0),56(%a1)",
    "	adda.w #0x20,%a0",
    "	adda.w #0x48,%a1",
    "	.endr",
]
WILD_E19 = [(0, "w", "ani0_time"), (2, "w", "ani0_time"), (3, "w", "ani0_frame"),
            (4, "w", "ani0_frame"), (6, "l", "SS_Wall_Palettes_VRAM"),
            (8, "w", "ani0_frame")]

LINHAS_E20 = [
    "	tst.w (PLACEW).w",
    "	bne.s SAIDA",
    "	subq.w #1,(PLACEW).w",
    "	bpl.s SAIDA",
    "	lea (0xc00004).l,%a6",
    "	move.w (PLACEW).w,%d0",
    "	addq.w #1,(PLACEW).w",
    "	andi.w #0x1f,%d0",
    "	lsl.w #2,%d0",
    "	lea (PLACEH).l,%a0",
    "	adda.w %d0,%a0",
    "	move.b (%a0)+,%d0",
    "	bpl.s USA_T",
    "	move.w #0x1ff,%d0",
    "USA_T:	move.w %d0,(PLACEW).w",
    "	moveq #0,%d0",
    "	move.b (%a0)+,%d0",
    "	move.w %d0,(PLACEW).w",
    "	lea (PLACEH).l,%a1",
    "	lea (0,%a1,%d0.w),%a1",
    "	move.w #0x8200,%d0",
    "	move.b (%a1)+,%d0",
    "	move.w %d0,(%a6)",
    "	move.b (%a1),(PLACEW).w",
    "	move.w #0x8400,%d0",
    "	move.b (%a0)+,%d0",
    "	move.w %d0,(%a6)",
    "	move.l #0x40000010,(0xc00004).l",
    "	move.l (PLACEW).w,(0xc00000).l",
    "	moveq #0,%d0",
    "	move.b (%a0)+,%d0",
    "	bmi.s PC2",
    "	lea (PLACEH).l,%a1",
    "	adda.w %d0,%a1",
    "	lea (PLACEW).w,%a2",
    "	move.l (%a1)+,(%a2)+",
    "	move.l (%a1)+,(%a2)+",
    "	move.l (%a1)+,(%a2)+",
    "SAIDA:	rts",
    "PC2:	move.w (PLACEW).w,%d1",
    "	cmpi.w #0x8a,%d0",
    "	blo.s O80",
    "	addq.w #1,%d1",
    "O80:	mulu.w #0x2a,%d1",
    "	lea (PLACEH).l,%a1",
    "	adda.w %d1,%a1",
    "	andi.w #0x7f,%d0",
    "	bclr #0,%d0",
    "	beq.s EVEN",
    "	lea (PLACEW).w,%a2",
    "	move.l (%a1),(%a2)+",
    "	move.l (4,%a1),(%a2)+",
    "	move.l (8,%a1),(%a2)+",
    "EVEN:	adda.w #0xc,%a1",
    "	lea (PLACEW).w,%a2",
    "	cmpi.w #0xa,%d0",
    "	blo.s O08",
    "	subi.w #0xa,%d0",
    "	lea (PLACEW).w,%a2",
    "O08:	move.w %d0,%d1",
    "	add.w %d0,%d0",
    "	add.w %d1,%d0",
    "	adda.w %d0,%a1",
    "	move.l (%a1)+,(%a2)+",
    "	move.w (%a1)+,(%a2)+",
    "	rts",
]
WILD_E20 = [(0, "w", "f_pause"), (2, "w", "palss_time"), (5, "w", "palss_num"),
            (6, "w", "palss_num"), (9, "l", "SS_Timing_Values"),
            (14, "w", "palss_time"), (17, "w", "ssbganim"), (18, "l", "SS_BG_Modes"),
            (23, "w", "scrposy_vdp"), (28, "w", "scrposy_vdp"), (32, "l", "Pal_SSCyc1"),
            (34, "w", "espelho_line3_E"), (39, "w", "palss_index"),
            (44, "l", "Pal_SSCyc2"), (49, "w", "espelho_line4_E"),
            (54, "w", "espelho_line3_1A"), (58, "w", "espelho_line4_1A")]

LINHAS_PL = [
    "	lea (PLACEH).l,%a1",
    "	lsl.w #3,%d0",
    "	adda.w %d0,%a1",
    "	movea.l (%a1)+,%a2",
    "	movea.w (%a1)+,%a3",
    "	move.w (%a1)+,%d7",
    "LP:	move.l (%a2)+,(%a3)+",
    "	dbra %d7,LP",
    "	rts",
]
LINHAS_PF = LINHAS_PL[:5] + ["	adda.w #0x80,%a3"] + LINHAS_PL[5:]
WILD_PL = [(0, "l", "Pal_Index")]


def linhas_writecram(fonte16_fade: int, buffer2: int) -> list[str]:
    tam = 0x80
    dmalen = 0x94009300 | ((((tam >> 1) & 0xFF00) << 8) | ((tam >> 1) & 0xFF))
    # o macro expande com o ramaddr COMPLETO (24 bits, ex.: $FFFFFB00), nao o .w
    src = 0xFFFF0000 | fonte16_fade
    dmasrc = 0x96009500 | ((((src >> 1) & 0xFF00) << 8) | ((src >> 1) & 0xFF))
    dmamode = 0x9700 | ((((src >> 1) & 0xFF0000) >> 16) & 0x7F)
    return [
        "	lea (0xc00004).l,%a5",
        f"	move.l #0x{dmalen:x},(%a5)",
        f"	move.l #0x{dmasrc:x},(%a5)",
        f"	move.w #0x{dmamode:x},(%a5)",
        "	move.w #0xc000,(%a5)",
        f"	move.w #0x80,(0x{buffer2:04x}).w",
        f"	move.w (0x{buffer2:04x}).w,(%a5)",
    ]


# ---------------------------------------------------------------- hipótese

def checar_hipoteses(valores: dict):
    """valores: nome->16-bit observado (só campos w; nomes de espelho
    checados via offsets). Retorna (nome_h, mismatches)."""
    def projetar(H):
        exp = {
            "ani0_time": H["ani0_time"], "ani0_frame": H["ani0_frame"],
            "palss_time": H["palss_time"], "palss_num": H["palss_num"],
            "palss_index": H["palss_index"], "f_pause": H["f_pause"],
            "ssbganim": H["ssbganim"], "scrposy_vdp": H["scrposy_vdp"],
            "espelho_line3_E": H["palette_line3"] + 0xE,
            "espelho_line4_E": H["palette_line4"] + 0xE,
            "espelho_line3_1A": H["palette_line3"] + 0x1A,
            "espelho_line4_1A": H["palette_line4"] + 0x1A,
        }
        return exp
    saida = {}
    for nome, H in (("H_A", H_A), ("H_B", H_B)):
        exp = projetar(H)
        mism = {k: (f"0x{valores[k]:04X}", f"0x{v:04X}")
                for k, v in exp.items() if valores.get(k) is not None and valores[k] != v}
        saida[nome] = mism
    return saida


def invariantes(valores: dict) -> dict:
    v = valores
    return {
        "frame_eq_time_menos_1": v.get("ani0_frame") == v.get("ani0_time", 0xFFFF) + 1,
        "palss_time_num_2_index_4": (v.get("palss_time", 0) - v.get("palss_num", 0) == 2
                                     and v.get("palss_index", 0) - v.get("palss_num", 0) == 4),
        "espelhos_delta_E_1A": (v.get("espelho_line3_1A", 0) - v.get("espelho_line3_E", 0) == 0x0C
                                and v.get("espelho_line4_1A", 0) - v.get("espelho_line4_E", 0) == 0x0C),
    }


# ---------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--rom", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)

    rom_path = pathlib.Path(a.rom)
    if not rom_path.is_file():
        raise SystemExit("recusa: rom-ausente")
    rom = rom_path.read_bytes()
    if sha(rom) != ROM_SHA_ESPERADO:
        raise SystemExit("recusa: rom-divergente-do-pin-c7da53a1")

    doc = {
        "schema": "rex-parallel-b/cram/1",
        "gerado_em": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "rom_sha256": sha(rom), "rom_bytes": len(rom),
        "pins": {}, "veredito": None,
        "limites": "estatico somente; consumo observado (CRAM escrito em execucao) NAO PROVADO (E22)",
    }

    with tempfile.TemporaryDirectory(dir=pathlib.Path.home() / "rds-scratch" / "par-b") as tdp:
        tmp = pathlib.Path(tdp)

        # --- E19: bloco blink de SS_AnimateBlocks
        pin, runs = montar(tmp, "e19", LINHAS_E19, WILD_E19)
        hits = buscar(rom, pin, _mascarado(pin, runs))
        if len(hits) != 1:
            doc["veredito"] = f"E19-FAIL: {len(hits)} ocorrencias do bloco blink (esperado 1)"
            _gravar(doc, a); return 1
        e19_base = hits[0]
        e19v = ler_alvos(rom, e19_base, runs)
        wall = e19v["SS_Wall_Palettes_VRAM"]
        tabela = rom[wall: wall + 128]
        pred = predizer_tabela_paredes()
        doc["pins"]["e19_blink"] = {
            "endereco": f"0x{e19_base:x}", "tamanho_padrao": len(pin),
            "ss_wall_palettes_vram": f"0x{wall:x}",
            "tabela_128b_igual_predicao_sswallpal": tabela == pred,
            "tabela_sha256": sha(tabela), "predicao_sha256": sha(pred),
            "campos_w": {k: f"0x{v:04X}" for k, v in e19v.items() if k != "SS_Wall_Palettes_VRAM"},
            "desmontado": desmontar(tmp, "e19", rom[e19_base: e19_base + len(pin)], e19_base),
        }

        # --- E20: PalCycle_SS
        pin20, runs20 = montar(tmp, "e20", LINHAS_E20, WILD_E20)
        hits20 = buscar(rom, pin20, _mascarado(pin20, runs20))
        if len(hits20) != 1:
            doc["veredito"] = f"E20-FAIL: {len(hits20)} ocorrencias de PalCycle_SS (esperado 1)"
            _gravar(doc, a); return 1
        e20_base = hits20[0]
        e20v = ler_alvos(rom, e20_base, runs20)
        c1a = e20v["Pal_SSCyc1"]; c2a = e20v["Pal_SSCyc2"]
        c1 = rom[c1a: c1a + BINS["Cycle - Special Stage 1.bin"][0]]
        c2 = rom[c2a: c2a + BINS["Cycle - Special Stage 2.bin"][0]]
        doc["pins"]["e20_palcycle_ss"] = {
            "endereco": f"0x{e20_base:x}", "tamanho_padrao": len(pin20),
            "alvos_l": {k: f"0x{v:x}" for k, v in e20v.items() if isinstance(v, int) and k in
                       ("SS_Timing_Values", "SS_BG_Modes", "Pal_SSCyc1", "Pal_SSCyc2")},
            "campos_w": {k: f"0x{v:04X}" for k, v in e20v.items() if k not in
                        ("SS_Timing_Values", "SS_BG_Modes", "Pal_SSCyc1", "Pal_SSCyc2")},
            "cyc1_sha256": sha(c1),
            "cyc1_bate_bin_pinado": sha(c1) == BINS["Cycle - Special Stage 1.bin"][1],
            "cyc2_sha256": sha(c2),
            "cyc2_bate_bin_pinado": sha(c2) == BINS["Cycle - Special Stage 2.bin"][1],
            "desmontado": desmontar(tmp, "e20", rom[e20_base: e20_base + len(pin20)], e20_base),
        }

        # --- E21: PalLoad / PalLoad_Fade / Pal_Index / call site / writeCRAM
        pin_pl, runs_pl = montar(tmp, "palload", LINHAS_PL, WILD_PL)
        pin_pf, runs_pf = montar(tmp, "palloadfade", LINHAS_PF, WILD_PL)
        h_pl = buscar(rom, pin_pl, _mascarado(pin_pl, runs_pl))
        h_pf = buscar(rom, pin_pf, _mascarado(pin_pf, runs_pf))
        if len(h_pl) != 1 or len(h_pf) != 1:
            doc["veredito"] = (f"E21-FAIL: PalLoad {len(h_pl)}x, PalLoad_Fade {len(h_pf)}x "
                               "(esperado 1/1)")
            _gravar(doc, a); return 1
        addr_pl, addr_pf = h_pl[0], h_pf[0]
        idx_pl = ler_alvos(rom, addr_pl, runs_pl)["Pal_Index"]
        idx_pf = ler_alvos(rom, addr_pf, runs_pf)["Pal_Index"]
        if idx_pl != idx_pf:
            doc["veredito"] = "E21-FAIL: Pal_Index diverge entre PalLoad e PalLoad_Fade"
            _gravar(doc, a); return 1

        entradas = []
        for i in range(20):
            ptr, ramw, cnt = struct.unpack(">IHH", rom[idx_pl + 8 * i: idx_pl + 8 * i + 8])
            entradas.append({"id": i, "ponteiro": f"0x{ptr:x}", "ramaddr": f"0x{ramw:04x}",
                             "contagem": f"0x{cnt:04x}"})
        e10 = entradas[10]
        dados = rom[int(e10["ponteiro"], 16): int(e10["ponteiro"], 16) + 128]
        l1 = int(entradas[0]["ramaddr"], 16)
        l2 = int(entradas[4]["ramaddr"], 16)
        checks = {
            "entradas_0a3_mesma_line1": all(e["ramaddr"] == entradas[0]["ramaddr"] for e in entradas[0:4]),
            "entradas_4a9_mesma_line2": all(e["ramaddr"] == entradas[4]["ramaddr"] for e in entradas[4:10]),
            "line2_menos_line1_eq_20": (l2 - l1) & 0xFFFF == 0x20,
            "entrada10_contagem_1f": e10["contagem"] == "0x001f",
            "pal_special_128b_sha": sha(dados),
            "pal_special_iguala_bin_pinado": sha(dados) == BINS["Special Stage.bin"][1],
        }

        callers = []
        pos = 0
        # bsr.w X = 6100 + disp16 relativo (assinado); alvo = PC pós-instrução + disp
        while True:
            i = rom.find(bytes.fromhex("700a6100"), pos)
            if i < 0:
                break
            disp = struct.unpack(">h", rom[i + 4: i + 6])[0]
            # deslocação relativa ao endereço da instrução de ramificação + 2
            alvo = (i + 4 + disp) & 0xFFFFFF
            callers.append({"endereco": f"0x{i:x}", "alvo_bsr": f"0x{alvo:x}",
                            "eh_palload_fade_pinado": alvo == addr_pf})
            pos = i + 1

        # hipótese E18R: ramaddr lido nas entradas tambem decide line_1/line_2
        valores = dict(e19v)
        valores.update(e20v)
        valores = {k: v for k, v in valores.items() if isinstance(v, int)}
        mism = checar_hipoteses(valores)
        # reforcar com ramaddys do Pal_Index
        for hname, H in (("H_A", H_A), ("H_B", H_B)):
            if l1 != H["palette_line1"]:
                mism[hname]["_palindex_line1"] = (f"0x{l1:04X}", f"0x{H['palette_line1']:04X}")
            if l2 != H["palette_line2"]:
                mism[hname]["_palindex_line2"] = (f"0x{l2:04X}", f"0x{H['palette_line2']:04X}")
        escolhidas = [h for h, mm in mism.items() if not mm]
        hip = escolhidas[0] if len(escolhidas) == 1 else None

        # writeCRAM: variantes por hipótese; registramos as duas
        wc = {}
        Hsel = H_A if hip == "H_A" else (H_B if hip == "H_B" else None)
        for label, Hx in (("H_A", H_A), ("H_B", H_B)):
            ent = {}
            for nome, fonte, buf in (("v_palette", Hx["palette_line1"], Hx["vdp_buffer2"]),
                                     ("v_palette_water", Hx["palette_water"], Hx["vdp_buffer2"])):
                b2 = MI.assemble(tmp, f"wc-{label}-{nome}", 0, linhas_writecram(fonte, buf))
                hs = buscar(rom, b2, set())
                ent[nome] = {"bytes_sha256": sha(b2), "ocorrencias": [f"0x{x:x}" for x in hs]}
            wc[label] = ent

        doc["pins"]["e21"] = {
            "palload_endereco": f"0x{addr_pl:x}", "palload_fade_endereco": f"0x{addr_pf:x}",
            "pal_index_endereco": f"0x{idx_pl:x}", "entradas_20": entradas, "checks": checks,
            "callsites_moveq10_bsrw": callers, "writecram_por_hipotese": wc,
        }
        doc["e18r"] = {
            "H_A_mismatches": mism["H_A"], "H_B_mismatches": mism["H_B"],
            "hipotese_escolhida": hip,
            "invariantes": invariantes(valores),
        }

        ok_e19 = doc["pins"]["e19_blink"]["tabela_128b_igual_predicao_sswallpal"]
        ok_e20 = (doc["pins"]["e20_palcycle_ss"]["cyc1_bate_bin_pinado"]
                  and doc["pins"]["e20_palcycle_ss"]["cyc2_bate_bin_pinado"])
        ok_e21 = all(checks.values()) and any(c["eh_palload_fade_pinado"] for c in callers)
        inv = all(invariantes(valores).values())
        if hip and ok_e19 and ok_e20 and ok_e21 and inv:
            doc["veredito"] = ("E18R/E19/E20/E21-OK: referencia do CRAM PINADA por sitio "
                               f"(hipotese {hip}; estatico — consumo observado NAO PROVADO)")
            if wc[hip]["v_palette"]["ocorrencias"]:
                pass
        else:
            doc["veredito"] = ("FALHA PARCIAL: ver campos especificos; manter cram_paleta como "
                               "DESCONHECIDA e publicar referencia faltante refinada (E22)")

        _gravar(doc, a)
        print(json.dumps({"veredito": doc["veredito"], "hipotese": hip}, ensure_ascii=False))
    return 0


def _confinar_na_arvore(out: str) -> pathlib.Path:
    p = pathlib.Path(out).resolve()
    raiz = pathlib.Path(__file__).resolve().parents[4]
    if not str(p).startswith(str(raiz / "data")):
        raise SystemExit("recusa: --out precisa ficar sob data/ da arvore")
    return p


def _gravar(doc, a):
    p = _confinar_na_arvore(a.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
    print("evidencia:", p)


if __name__ == "__main__":
    sys.exit(main())
