#!/usr/bin/env python3
"""Oráculo INDEPENDENTE do efeito da edição da fonte do Streets of Rage.

Independente do produto: decoder Kosinski e leitor de BPS próprios (nada do crate
rex-kosinski nem do encoder/renderer do produto); o core libretro é dirigido por
ctypes (lr.py), não pela ponte IPC do app. Sondas diretas ao core: NÃO são
interação do usuário. Entrada: neutra (nenhum botão), nenhuma escrita em RAM.

Congelado em docs/rex_profiles/integration_20261007/EXPECTATIONS-SOR-FONT-2026-10-07.md.

  sor_font_effect.py --base ROM --copy ROM --bps PATCH --core SO --work DIR --out REPORT.json

Ordem: bytes/índices → execução (RAM/VRAM) → tela. Sai com 1 se algo falhar.
"""
import argparse
import hashlib
import json
import struct
import subprocess
import sys
import zlib
from pathlib import Path

SLOT, SLOT_LEN, PLAIN_LEN = 0x389A0, 514, 1568
BASE_SHA = "304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d"
TILE, ROW, COLS, NEW_INDEX = 1, 7, range(8), 1
FRAMES_TEXT_FROM = 588
CAP_FROM, CAP_TO, CAP_STEP = 440, 900, 4
# origem medida na BASE (quadro 896): a linha 0 do tile 'A' cai em y=146 (adendo ao EXPECTATIONS)
TEXT_ORIGIN_X, TEXT_ORIGIN_Y, LINE_H = 72, 146, 16
# Transcrição humana do texto de introdução (detector independente do da máscara).
LINES = ["ESTA CIDADE ERA UM", "LUGAR PACIFICO E", "FELIZ... ATE QUE UM", "DIA. UMA PODEROSA", "ORGANIZACAO CRIMINOSA"]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def kos(d, o):
    """Kosinski base, escrito do zero a partir da especificação do formato."""
    p, out = o, bytearray()

    def rd16():
        nonlocal p
        v = d[p] | (d[p + 1] << 8)
        p += 2
        return v

    desc, n = rd16(), 16

    def bit():
        nonlocal desc, n
        b = desc & 1
        desc >>= 1
        n -= 1
        if n == 0:
            desc, n = rd16(), 16
        return b

    while True:
        if bit():
            out.append(d[p]); p += 1; continue
        if bit():
            lo, hi = d[p], d[p + 1]; p += 2
            dist = (0xE000 | ((hi & 0xF8) << 5) | lo) - 0x10000
            c = hi & 7
            if c:
                c += 2
            else:
                c = d[p]; p += 1
                if c == 0:
                    break
                if c == 1:
                    continue
                c += 1
        else:
            c = ((bit() << 1) | bit()) + 2
            dist = d[p] - 256; p += 1
        for _ in range(c):
            out.append(out[len(out) + dist])
    return bytes(out), p - o


def bps_apply(src, patch):
    """Leitor BPS mínimo (spec byuu): verifica CRCs de origem, alvo e do patch."""
    assert patch[:4] == b"BPS1", "magic"
    pos = 4

    def vn():
        nonlocal pos
        data, shift = 0, 1
        while True:
            x = patch[pos]; pos += 1
            data += (x & 0x7F) * shift
            if x & 0x80:
                return data
            shift <<= 7
            data += shift

    ssz, tsz, msz = vn(), vn(), vn()
    pos += msz
    assert ssz == len(src), "tamanho da origem"
    foot = len(patch) - 12
    src_crc, tgt_crc, pat_crc = struct.unpack("<III", patch[foot:])
    assert zlib.crc32(patch[:-4]) == pat_crc, "CRC do patch"
    assert zlib.crc32(src) == src_crc, "CRC da origem"
    tgt = bytearray()
    sr = tr = 0
    while pos < foot:
        v = vn(); act, ln = v & 3, (v >> 2) + 1
        if act == 0:
            tgt += src[len(tgt):len(tgt) + ln]
        elif act == 1:
            tgt += patch[pos:pos + ln]; pos += ln
        else:
            o = vn(); off = (-1 if o & 1 else 1) * (o >> 1)
            if act == 2:
                sr += off
                for _ in range(ln): tgt.append(src[sr]); sr += 1
            else:
                tr += off
                for _ in range(ln): tgt.append(tgt[tr]); tr += 1
    assert zlib.crc32(bytes(tgt)) == tgt_crc, "CRC do alvo"
    return bytes(tgt)


def md_checksum(rom):
    return sum(struct.unpack(">%dH" % ((len(rom) - 0x200) // 2), rom[0x200:])) & 0xFFFF


def nib(plain, tile, row, col):
    b = plain[tile * 32 + row * 4 + col // 2]
    return b >> 4 if col % 2 == 0 else b & 15


# ---------------------------------------------------------------- filho: core
def child(rom, out):
    import ctypes as C
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from lr import Core
    c = Core(args_core, rom)
    L = c.lib
    L.retro_serialize_size.restype = C.c_size_t
    N = L.retro_serialize_size()
    buf = C.create_string_buffer(N)

    def ram():
        p, n = c.ram(); raw = C.string_at(p, n); b = bytearray(n)
        for i in range(0, n - 1, 2): b[i], b[i + 1] = raw[i + 1], raw[i]
        return bytes(b)

    def grab():
        d, w, h, pitch = c.frame
        a = np.zeros((h, w, 3), np.uint8)
        for y in range(h):
            row = d[y * pitch:(y + 1) * pitch]
            v = np.frombuffer(row[:2 * w], dtype="<u2").astype(np.uint32)
            a[y, :, 0] = ((v >> 11) & 31) * 255 // 31
            a[y, :, 1] = ((v >> 5) & 63) * 255 // 63
            a[y, :, 2] = (v & 31) * 255 // 31
        return a

    frames, ram_hashes, state_at, f720 = {}, {}, {}, None
    for f in range(CAP_TO):
        c.buttons = 0
        c.run(1)
        p, _n = c.ram()
        raw = C.string_at(p, PLAIN_LEN)
        sw = bytearray(PLAIN_LEN)
        sw[0::2], sw[1::2] = raw[1::2], raw[0::2]
        ram_hashes[f] = sha(bytes(sw))
        if f in (260, 300, 340, 380, 420, 460, 500):
            L.retro_serialize(buf, N)
            state_at[f] = bytes(buf.raw)
        if f == 719:
            f720 = grab()
        if f >= CAP_FROM and f % CAP_STEP == 0:
            frames[f] = grab()
    np.savez_compressed(out, frames=np.stack([frames[k] for k in sorted(frames)]),
                        keys=np.array(sorted(frames)), f720=f720)
    Path(str(out) + ".json").write_text(json.dumps({"ram_hashes": ram_hashes}))
    for k, v in state_at.items():
        Path(str(out) + f".state{k}").write_bytes(v)


args_core = None


def run_child(rom, out, core):
    r = subprocess.run([sys.executable, "-I", __file__, "--child", rom, "--out", str(out), "--core", core],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("filho falhou: " + r.stderr[-800:])


def main():
    global args_core
    ap = argparse.ArgumentParser()
    ap.add_argument("--base"); ap.add_argument("--copy"); ap.add_argument("--bps")
    ap.add_argument("--core", required=True); ap.add_argument("--work"); ap.add_argument("--out")
    ap.add_argument("--child"); ap.add_argument("--noop"); ap.add_argument("--tampered")
    ap.add_argument("--reuse", action="store_true", help="reaproveita capturas já feitas (mesmas ROMs)")
    ap.add_argument("--journey", help="report.json da jornada nativa (confere framebuffers e cópia)")
    a = ap.parse_args()
    args_core = a.core
    if a.child:
        return child(a.child, a.out)
    import numpy as np
    work = Path(a.work); work.mkdir(parents=True, exist_ok=True)
    base, copy = Path(a.base).read_bytes(), Path(a.copy).read_bytes()
    checks = []

    def chk(name, ok, detail=""):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})
        print(("PASS " if ok else "FAIL ") + name + (" :: " + str(detail) if detail else ""))

    # ---- nível 1: bytes/índices
    chk("base: SHA-256 do perfil", sha(base) == BASE_SHA, sha(base))
    bp, bc = kos(base, SLOT)
    cp, cc = kos(copy, SLOT)
    chk("base: stream consome 514 e decodifica 1568", bc == SLOT_LEN and len(bp) == PLAIN_LEN)
    exp = bytearray(bp)
    for col in COLS:
        i = TILE * 32 + ROW * 4 + col // 2
        exp[i] = (exp[i] & 0x0F) | (NEW_INDEX << 4) if col % 2 == 0 else (exp[i] & 0xF0) | NEW_INDEX
    pre = [nib(bp, TILE, ROW, c) for c in COLS]
    chk("pré-condição: os 8 pixels valiam 0", pre == [0] * 8, pre)
    chk("cópia: plain = base com EXATAMENTE os 8 nibbles previstos", cp == bytes(exp))
    ndiff = sum(1 for i in range(PLAIN_LEN * 2) if nib(bytes(bp), i // 64, (i % 64) // 8, i % 8) != nib(cp, i // 64, (i % 64) // 8, i % 8))
    chk("cópia: nenhum outro nibble difere", ndiff == 8, ndiff)
    chk("cópia: stream ≤ 514 (espaço do slot)", cc <= SLOT_LEN, cc)
    diffs = [i for i in range(len(base)) if base[i] != copy[i]]
    scope = set(range(SLOT, SLOT + SLOT_LEN)) | {0x18E, 0x18F}
    chk("cópia: bytes alterados ⊂ slot ∪ checksum", all(i in scope for i in diffs), f"{len(diffs)} bytes")
    chk("cópia: checksum do cabeçalho consistente", struct.unpack(">H", copy[0x18E:0x190])[0] == md_checksum(copy))
    chk("base: checksum do cabeçalho consistente (premissa)", struct.unpack(">H", base[0x18E:0x190])[0] == md_checksum(base))
    bps = Path(a.bps).read_bytes()
    try:
        ok = bps_apply(base, bps) == copy
    except AssertionError as e:
        ok = False; print("bps:", e)
    chk("BPS (leitor independente) base→cópia reproduz a cópia byte a byte", ok, sha(bps))
    other = Path(a.base).with_name("__nope__")  # patch divergente: aplicar a uma base diferente
    wrong = bytearray(base); wrong[0x3000] ^= 1
    try:
        bps_apply(bytes(wrong), bps); bad = False
    except AssertionError:
        bad = True
    chk("controle: BPS aplicado a base divergente é recusado (CRC)", bad)
    if a.noop:
        chk("controle: ROM do no-op = bytes da base", Path(a.noop).read_bytes() == base)
    if a.tampered:
        tp = Path(a.tampered).read_bytes()
        try:
            tpl, _ = kos(tp, SLOT)
            chk("controle: stream adulterado NÃO decodifica para o plain esperado", tpl != bytes(exp))
        except Exception:
            chk("controle: stream adulterado NÃO decodifica para o plain esperado", True, "decoder falhou")

    # ---- nível 2/3: execução no core (um processo por ROM)
    runs = {}
    for name, rom in (("base", a.base), ("base2", a.base), ("copy", a.copy)):
        out = work / f"{name}.npz"
        if not (a.reuse and out.exists()):
            run_child(rom, out, a.core)
        z = np.load(out)
        runs[name] = {"frames": z["frames"], "keys": [int(k) for k in z["keys"]], "f720": z["f720"],
                      "ram": json.loads(Path(str(out) + ".json").read_text())["ram_hashes"],
                      "states": {k: Path(str(out) + f".state{k}").read_bytes() for k in (260, 300, 340, 380, 420, 460, 500)}}
    ph_base, ph_exp = sha(bytes(bp)), sha(bytes(exp))
    base_ram = [int(f) for f, h in runs["base"]["ram"].items() if h == ph_base]
    copy_ram = [int(f) for f, h in runs["copy"]["ram"].items() if h == ph_exp]
    chk("execução: base — decoder do jogo deixa o plain ORIGINAL em $FF0000", len(base_ram) >= 1, base_ram)
    chk("execução: cópia — decoder do jogo deixa o plain EDITADO em $FF0000 (mesmos quadros)", copy_ram == base_ram, copy_ram)
    sw = lambda b: bytes(b[i ^ 1] for i in range(len(b)))
    t = lambda p, k: sw(p[k * 32:(k + 1) * 32])
    ib, fsel = -1, None
    for fk in sorted(runs["base"]["states"]):
        ib = runs["base"]["states"][fk].find(t(bp, 2))
        if ib >= 0:
            fsel = fk
            break
    sb, sc = (runs["base"]["states"][fsel], runs["copy"]["states"][fsel]) if fsel else (b"", b"")
    chk("execução: VRAM da base contém a fonte (tile 2 localizado)", ib >= 0, f"quadro {fsel}")
    if ib >= 0:
        v1b, v1c = sb[ib - 32:ib], sc[ib - 32:ib]
        chk("VRAM: tile 1 da base = original", v1b == t(bp, 1))
        chk("VRAM: tile 1 da cópia = editado", v1c == t(bytes(exp), 1))
        same = all(sb[ib + 32 * (k - 2):ib + 32 * (k - 1)] == sc[ib + 32 * (k - 2):ib + 32 * (k - 1)] for k in range(2, 49))
        chk("VRAM: tiles 2..48 idênticos entre base e cópia", same)

    B, B2, C = runs["base"], runs["base2"], runs["copy"]
    tmask = np.array([[nib(bytes(bp), TILE, r, c) == 1 for c in range(8)] for r in range(8)])
    nzmask = np.array([[nib(bytes(bp), TILE, r, c) != 0 for c in range(8)] for r in range(8)])

    def predict(fb):
        """Varre janelas 8x8 (grade x=72+8k, qualquer y: o texto ROLA) casando a máscara do tile 'A' na BASE.
        Devolve pixels previstos (linha 7 de cada célula-A), células (y0, k) e a cor de preenchimento."""
        lum = fb.sum(axis=2) / 3
        bright_full = lum > 220  # preenchimento = 238; contorno/sombra (<=183) não conta
        pred = np.zeros(fb.shape[:2], bool)
        cells, fills = [], {}
        ntm = int(tmask.sum())
        for y0 in range(0, fb.shape[0] - 7):
            for kcell in range(0, (fb.shape[1] - 72) // 8):
                x0 = 72 + 8 * kcell
                bright = bright_full[y0:y0 + 8, x0:x0 + 8]
                if bright[tmask].sum() < ntm or int((bright & ~tmask).sum()) > 0:
                    continue
                cells.append((y0, kcell))
                fill = tuple(fb[y0, x0 + 4])
                for col in range(8):
                    y, x = y0 + ROW, x0 + col
                    if tuple(fb[y, x]) != fill:
                        pred[y, x] = True
                        fills[(y, x)] = fill
        return pred, cells, fills

    f720b, f720c = B["f720"].astype(int), C["f720"].astype(int)
    p720, cells720, fills720 = predict(f720b)
    act720 = (f720b != f720c).any(axis=2)
    chk("tela: após exatamente 720 quadros a diferença é EXATAMENTE a prevista (linha 7 das células-A)",
        bool((act720 == p720).all()) and int(act720.sum()) > 0 and all(tuple(f720c[y, x]) == f for (y, x), f in fills720.items()),
        {"pixels": int(act720.sum()), "células-A": len(cells720)})
    expected720 = sorted([int(x), int(y)] for y, x in zip(*np.where(p720)))
    keys = B["keys"]
    chk("controle: original×original — todos os quadros idênticos", bool((B["frames"] == B2["frames"]).all()))
    pre_ok = all(bool((B["frames"][i] == C["frames"][i]).all()) for i, k in enumerate(keys) if k < FRAMES_TEXT_FROM)
    chk("tela: quadros < 588 idênticos (texto ainda não apareceu)", pre_ok)
    fail_frames, a_cells_total, checked = [], 0, 0
    lines_expected = {}
    for r_i, txt in enumerate(LINES):
        for k, ch in enumerate(txt):
            if ch == "A":
                lines_expected.setdefault(r_i, []).append(k)
    for i, k in enumerate(keys):
        if k < FRAMES_TEXT_FROM:
            continue
        fb, fc = B["frames"][i].astype(int), C["frames"][i].astype(int)
        pred, cells, fills = predict(fb)
        fill_ok = all(tuple(fc[y, x]) == f for (y, x), f in fills.items())
        # detector (b): a transcrição humana tem que concordar com a máscara (quadros finais)
        if k == 896:
            for r_i, ks in lines_expected.items():
                for kk in ks:
                    if (TEXT_ORIGIN_Y + LINE_H * r_i, kk) not in cells:
                        fail_frames.append((k, "transcricao_vs_mascara", r_i, kk))
        a_cells_total += len(cells); checked += 1
        actual = (fb != fc).any(axis=2)
        if not (actual == pred).all() or not fill_ok:
            fail_frames.append((k, int((actual != pred).sum()), fill_ok))
    chk("tela: em cada quadro ≥ 588 a diferença é EXATAMENTE a linha 7 das células-A, na cor de preenchimento",
        not fail_frames and checked > 0, {"quadros": checked, "células-A somadas": a_cells_total, "falhas": fail_frames[:5]})
    final_i = keys.index(max(k for k in keys if k <= 896))
    nch = int((B["frames"][final_i] != C["frames"][final_i]).any(axis=2).sum())
    chk("tela: quadro 896 — pixels alterados > 0 (efeito visível)", nch > 0, nch)
    if a.journey:
        j = json.loads(Path(a.journey).read_text())
        chk("jornada: relatório da jornada nativa com todos os checks verdadeiros", j.get("all_pass") is True, f"{len(j.get('checks', []))} checks")
        chk("jornada: cópia da UI = cópia verificada aqui", j.get("copy_sha256") == sha(copy))
        chk("jornada: BPS exportado pela UI = BPS verificado aqui", j.get("bps_sha256") == sha(bps))
        got = sorted([list(p) for p in j["observed"]["diff_pixels"]])
        chk("jornada: pixels diferentes no framebuffer do APP (base×cópia, 720 quadros) = previstos pelo oráculo independente",
            got == expected720, {"app": len(got), "oráculo": len(expected720)})
    Path(a.out).write_text(json.dumps({"schema": "rex-sor-font-effect/v1", "base_sha256": sha(base), "copy_sha256": sha(copy),
                                       "bps_sha256": sha(bps), "core": str(a.core), "core_sha256": sha(Path(a.core).read_bytes()),
                                       "checks": checks, "all_pass": all(c["ok"] for c in checks)}, indent=1))
    return 0 if all(c["ok"] for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
