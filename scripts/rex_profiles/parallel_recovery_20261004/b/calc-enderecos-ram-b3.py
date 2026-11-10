#!/usr/bin/env python3
"""Deriva endereços absolutos de RAM a partir do _Variables.asm pinado.

Não lê a ROM — é derivação de EXPECTATIVA (E18). Regras de fase
implementadas (asm68k):
  * cada `phase X` reinicia o offset de alocação em 0 com base X;
  * `org Y` dentro de uma fase reposiciona (usado só na região SS, que
    este script não precisa);
  * `include "s1.sounddriver.ram.asm"` ANTES do primeiro phase define
    apenas templates `struct` (não aloca); a instância real é
    `v_snddriver_ram: SMPS_RAM` dentro da fase geral;
  * `even` alinha para par; campos dentro de `struct` somam no template.

Aceitação (congelada antes de qualquer medição na ROM):
  a1) v_ss_spritesettings == $00FF4000   (cadeia E14/E16 já provada)
  a2) v_sslayout_actual  == $00FF1020    (destino Enigma já provado)
  a3) v_palette_fading - v_palette == $80 (constant `adda.w #$80` do
      PalLoad_Fade na referência)
As três devem passar; caso contrário o script termina INCONCLUSIVO e
nenhum número é usado como predição.
"""
from __future__ import annotations

import pathlib
import re
import sys

DISASM = pathlib.Path("/home/misael/.cache/rex-corpus-d/s1disasm")

SYMBOLS_WANTED = [
    "v_ani0_time", "v_ani0_frame",
    "v_palss_num", "v_palss_time", "v_palss_index",
    "v_palette", "v_palette_line_1", "v_palette_line_2",
    "v_palette_line_3", "v_palette_line_4", "v_palette_fading",
    "v_palette_water", "v_scrposy_vdp", "f_pause", "v_ssbganim",
    "v_vdp_buffer2", "v_ss_spritesettings", "v_sslayout_actual",
    "v_snddriver_ram",
]

LABEL_CH = r"[A-Za-z0-9_.\-]+"
DS_RE = re.compile(rf"^({LABEL_CH})?\s*:?\s*ds\.([bwl])\s+(\S+)")
EQU_RE = re.compile(rf"^({LABEL_CH}):\s*equ\s+(\S+)")
LABEL_ONLY_RE = re.compile(rf"^({LABEL_CH}):\s*$")
STRUCT_RE = re.compile(rf"^({LABEL_CH})\s+struct\b", re.IGNORECASE)
INST_RE = re.compile(rf"^({LABEL_CH}):\s*({LABEL_CH})$")
PHASE_RE = re.compile(r"^\s*phase\s+(\S+)")
ORG_RE = re.compile(r"^\s*org\s+(\S+)")


def _asmnum(expr: str) -> str:
    e = re.sub(r"\$([0-9A-Fa-f]+)", r"0x\1", expr)
    e = re.sub(r"%([01]+)", r"0b\1", e)
    return e


class Ctx:
    def __init__(self, constants: dict, extra: dict | None = None):
        self.const = dict(constants)
        if extra:
            for k, v in extra.items():
                if isinstance(v, int):
                    self.const.setdefault(k, v)

    def ev(self, expr: str) -> int:
        e = _asmnum(expr.strip())
        e = re.sub(r"\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\b",
                   lambda m: str(self.const[m.group(0)]) if m.group(0) in self.const
                   else m.group(0), e)
        e = re.sub(r"\b[A-Za-z_][A-Za-z0-9_]*\b",
                   lambda m: str(self.const[m.group(0)]) if m.group(0) in self.const
                   else m.group(0), e)
        try:
            return int(eval(e, {"__builtins__": {}}))
        except Exception as exc:  # noqa: BLE001
            raise KeyError(f"expressao nao avaliavel: {expr!r} ({exc})") from exc


def load_constants() -> dict:
    """constantes equ numéricas de _Constants.asm (+ _inc e sonic.asm como fallback)."""
    const: dict = {}
    ctx_done: set = set()
    sources = [DISASM / "_Constants.asm", DISASM / "sonic.asm"]
    sources += sorted((DISASM / "_inc").glob("*.asm"))
    for path in sources:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            m = EQU_RE.match(line.split(";", 1)[0].strip())
            if not m or m.group(1) in ctx_done:
                continue
            ctx_done.add(m.group(1))
            try:
                const[m.group(1)] = Ctx(const).ev(m.group(2))
            except Exception:  # noqa: BLE001
                pass
    return const


def parse_lines(lines, ctx: Ctx, constants: dict, templates_ext=None):
    """Retorna (labels{nome: offset-ou-base-relative}, base_atual, offset_final, templates)."""
    labels: dict = {}
    templates: dict = dict(templates_ext) if templates_ext else {}
    struct_fields: dict = {}
    cur_struct = None
    sf = 0
    offset = 0
    base = 0
    in_phase = False

    for raw in lines:
        line = raw.split(";", 1)[0].strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith("include"):
            continue
        m = PHASE_RE.match(line)
        if m:
            rest = line.strip()[len("phase"):].strip()
            rm = re.match(r"ramaddr\s*\(\s*(\S+)\s*\)", rest)
            expr = rm.group(1) if rm else rest.split()[0]
            try:
                base = ctx.ev(expr)
            except KeyError:
                # phase sobre label da própria região (ex.: phase v_objstate)
                base = expr.strip()
            offset = 0
            in_phase = True
            continue
        if low.startswith("dephase"):
            continue
        m = ORG_RE.match(line)
        if m:
            try:
                offset = ctx.ev(m.group(1)) - (base if isinstance(base, int) else 0)
            except KeyError:
                offset = 0
            continue
        m = EQU_RE.match(line)
        if m:
            labels[m.group(1)] = ("equ", m.group(2))
            try:
                constants[m.group(1)] = Ctx(constants, labels).ev(m.group(2))
            except Exception:  # noqa: BLE001
                pass
            continue
        sm = STRUCT_RE.match(line)
        if sm:
            cur_struct = sm.group(1)
            sf = 0
            templates.setdefault(cur_struct, 0)
            struct_fields.setdefault(cur_struct, {})
            continue
        if low.startswith("endstruct"):
            if cur_struct:
                templates[cur_struct] = sf
            cur_struct = None
            continue
        if low == "even":
            if cur_struct:
                if sf % 2:
                    sf += 1
            elif offset % 2:
                offset += 1
            continue

        d = DS_RE.match(line)
        if d:
            n = {"b": 1, "w": 2, "l": 4}[d.group(2)]
            expr = d.group(3)
            if cur_struct:
                f = struct_fields.get(cur_struct, {})
                extra = {**f, **{f"{cur_struct}.{k}": v for k, v in f.items()}}
            else:
                extra = labels_numeric(labels)
            try:
                size = n * Ctx(constants, extra).ev(expr)
            except KeyError as exc:
                raise SystemExit(f"ds nao avaliavel ({exc}): {line!r}")
            if cur_struct:
                if d.group(1):
                    struct_fields[cur_struct][d.group(1)] = sf
                sf += size
            else:
                if d.group(1):
                    labels[d.group(1)] = offset
                offset += size
            continue

        im = INST_RE.match(line)
        if im:
            name, tmpl = im.group(1), im.group(2)
            if cur_struct and tmpl in templates:
                struct_fields[cur_struct][name] = sf
                sf += templates[tmpl]
                continue
            if not cur_struct and tmpl in templates:
                labels[name] = offset
                offset += templates[tmpl]
                continue

        lm = LABEL_ONLY_RE.match(line)
        if lm:
            if cur_struct:
                struct_fields.setdefault(cur_struct, {})[lm.group(1)] = sf
            else:
                labels.setdefault(lm.group(1), offset)
            continue

        # "label: StructName  ; comentario ja removido" coberto por INST_RE;
        # demais linhas (directives não suportadas) são ignoradas.
    return labels, base, offset, templates, struct_fields


def labels_numeric(labels: dict) -> dict:
    return {k: v for k, v in labels.items() if isinstance(v, int)}


def main() -> int:
    constants = load_constants()
    ctx = Ctx(constants)

    # 1) templates do sound driver ram (sem alocar na região)
    snd_lines = (DISASM / "s1.sounddriver.ram.asm").read_text(
        encoding="utf-8", errors="replace").splitlines()
    # processa apenas os structs para obter tamanhos; descarta labels/base
    _, _, _, templates, _ = parse_lines(snd_lines, ctx, dict(constants))

    # 2) corpo de _Variables a partir do primeiro phase
    var_lines = (DISASM / "_Variables.asm").read_text(
        encoding="utf-8", errors="replace").splitlines()
    start = next(i for i, l in enumerate(var_lines) if PHASE_RE.match(l.split(";", 1)[0].strip()))
    # reprocessa: regiões sucessivas; aqui recalcula com templates já conhecidos
    labels_all: dict = {}
    region_of: dict = {}
    state = {"base": None}

    def walk(lines):
        labels, base, offset, t2, fields = parse_lines(
            lines, Ctx(constants, labels_numeric(labels_all)), constants)
        # labels relativos: converte resolvendo equ dentro da região
        return labels, base, offset, fields

    # o arquivo tem 3 fases; processa o arquivo inteiro de uma vez (parse_lines
    # trata phase/org internamente usando UM par (base,offset) por phase)
    labels, base, offset, templates_v, fields = parse_lines(var_lines[start:], ctx, constants)

    def resolve(name: str, seen=None) -> tuple:
        v = labels.get(name)
        if isinstance(v, tuple):  # equ
            try:
                return Ctx(constants, labels_numeric(labels)).ev(v[1]) & 0xFFFFFF, None
            except SystemExit:
                raise SystemExit(f"equ nao resolvivel: {name}")
        return v, None

    # NOTE: parse_lines interno usa UM base; fases posteriores sobrescrevem.
    # Para as regiões deste script (geral + SS) verificamos as âncoras por
    # região: rodamos parse separadamente por bloco de phase.
    blocks = []
    cur = None
    for raw in var_lines[start:]:
        line = raw.split(";", 1)[0].strip()
        if PHASE_RE.match(line):
            cur = [line]
            blocks.append(cur)
            continue
        if line.lower().startswith("dephase"):
            cur = None
            continue
        if cur is not None:
            cur.append(raw)
    results = {}
    for b in blocks:
        labels_b, base_b, off_b, t_b, f_b = parse_lines(b, Ctx(constants, labels_numeric(labels_all)), dict(constants))
        results[id(b)] = (labels_b, base_b, off_b)
        labels_all.update({k: v for k, v in labels_b.items() if k not in labels_all})

    def addr_of(name):
        for labels_b, base_b, _ in results.values():
            if name in labels_b:
                v = labels_b[name]
                if isinstance(v, tuple):
                    try:
                        return Ctx(constants, labels_numeric(labels_b)).ev(v[1])
                    except Exception:  # noqa: BLE001
                        continue
                if isinstance(base_b, str):
                    return None
                return (base_b + v) & 0xFFFFFF
        return None

    ss = addr_of("v_ss_spritesettings")
    lay = addr_of("v_sslayout_actual")
    pal = addr_of("v_palette")
    fade = addr_of("v_palette_fading")
    ok = []
    print(f"v_ss_spritesettings = ${ss:06X}  (esperado $FF4000 por E14/E16)") if ss is not None else print("v_ss_spritesettings: NAO DERIVADO")
    print(f"v_sslayout_actual   = ${lay:06X}  (esperado $FF1020 por E14/E16)") if lay is not None else print("v_sslayout_actual: NAO DERIVADO")
    print(f"v_palette_fading-v_palette = ${(fade - pal) if (pal and fade) else '??':X}  (esperado $80)")
    a1 = ss == 0xFF4000
    a2 = lay == 0xFF1020
    a3 = pal is not None and fade is not None and (fade - pal) == 0x80
    if not (a1 and a2 and a3):
        print("INCONCLUSIVO: ancora(s) falharam — nenhum numero vira predicao.")
        return 2
    print("\n# ANCORAS OK — endereços preditos (24-bit; .w = sinal-extension dos 16 baixos):")
    for name in SYMBOLS_WANTED:
        a = addr_of(name)
        if a is None:
            print(f"{name:24s} = NAO DERIVADO")
        else:
            low16 = a & 0xFFFF
            enc = f".w=$FFFF{low16:04X}" if low16 >= 0x8000 else ".l=$00%06X (>=.w invalido)" % a
            print(f"{name:24s} = ${a:06X}   {enc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
