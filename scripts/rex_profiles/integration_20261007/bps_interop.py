#!/usr/bin/env python3
"""Interoperabilidade BPS bidirecional: produto <-> Flips (ferramenta externa PINADA).

  produto cria  -> Flips aplica     (resultado == alvo)
  Flips cria    -> produto aplica   (resultado == alvo)   [delta e linear]
  malformados   -> Flips E produto recusam

Independente do produto: fixtures e comparações em Python; o produto é chamado só pelo
caminho canônico (ferramenta `bps_interop_tool` do cargo test, que usa create_bps/apply_bps_checked).
Pin do Flips: pacote Arch extra/flips-198-3 (SHA-256 do .pkg.tar.zst e do binário abaixo; binário reporta "Floating IPS v201").

  bps_interop.py --flips /caminho/flips --work DIR --out relatorio.json
"""
import argparse, hashlib, json, os, random, struct, subprocess, sys, zlib
from pathlib import Path

FLIPS_PKG_SHA256 = "3d488a159570f77c01d0083d6866d3c17038c699d7ff0b6a053d64a3c727758b"
FLIPS_BIN_SHA256 = "3f3033ef4293931011a2e7043b83200b0818c8ff7fb15d7fa480719219509253"


def sha(b): return hashlib.sha256(b).hexdigest()


def prng(seed, n):
    r = random.Random(seed); return bytes(r.getrandbits(8) for _ in range(n))


def fixtures():
    out = {}
    a = prng(1, 20000)
    t = bytearray(a); t[100] ^= 0xFF; t[19999] ^= 1
    out["mesmo_tamanho_poucas_diferencas"] = (a, bytes(t))
    out["alvo_maior"] = (a[:5000], a[:5000] + prng(2, 3000))
    out["alvo_menor"] = (a, a[:7000])
    blk = prng(3, 600)
    src = prng(4, 3000) + blk + prng(5, 3000)
    tgt = blk + prng(6, 500) + src[:1500] + bytes([7]) * 900 + blk[:300] * 3   # bloco movido + repetição (TargetCopy)
    out["bloco_movido_e_repeticoes"] = (src, tgt)
    for n in (127, 128, 129, 16511, 16512, 16513):
        s = prng(10 + n, n); t2 = bytearray(s); t2[n // 2] ^= 0x5A
        out[f"fronteira_varint_{n}"] = (s, bytes(t2))
    out["vazio_para_pequeno"] = (b"", b"abc")
    return out


def bps_manual(source, target, meta, body):
    def vn(v):
        o = bytearray()
        while True:
            x = v & 0x7F; v >>= 7
            if v == 0: o.append(0x80 | x); break
            o.append(x); v -= 1
        return bytes(o)
    p = b"BPS1" + vn(len(source)) + vn(len(target)) + vn(len(meta)) + meta + body
    p += struct.pack("<III", zlib.crc32(source), zlib.crc32(target), 0)[:8]
    p += struct.pack("<I", zlib.crc32(p))
    return p


def vn(v):
    o = bytearray()
    while True:
        x = v & 0x7F; v >>= 7
        if v == 0: o.append(0x80 | x); break
        o.append(x); v -= 1
    return bytes(o)


def act(kind, n): return vn(((n - 1) << 2) | kind)
def rel(d): return vn((abs(d) << 1) | (1 if d < 0 else 0))


def run(cmd, **kw): return subprocess.run(cmd, capture_output=True, text=True, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flips", required=True); ap.add_argument("--work", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--src-tauri", default=str(Path(__file__).resolve().parents[3] / "src-tauri"))
    a = ap.parse_args()
    flips = Path(a.flips); work = Path(a.work); work.mkdir(parents=True, exist_ok=True)
    checks = []
    def chk(name, ok, detail=""):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(("PASS " if ok else "FAIL ") + name + (f" :: {detail}" if detail else ""))
    chk("Flips: SHA-256 do binário pinado", sha(flips.read_bytes()) == FLIPS_BIN_SHA256, sha(flips.read_bytes()))
    ver = run([str(flips), "--version"]).stdout.strip()
    chk("Flips: versão", "Floating IPS" in ver, ver)
    fx = fixtures(); jobs = []; meta = []; external_failures = []
    for name, (s, t) in fx.items():
        d = work / name; d.mkdir(exist_ok=True)
        (d / "src.bin").write_bytes(s); (d / "tgt.bin").write_bytes(t)
        jobs.append({"mode": "create", "a": str(d / "src.bin"), "b": str(d / "tgt.bin"), "out": str(d / "prod.bps")}); meta.append((name, "prod_create"))
        for style in ("--bps-delta", "--bps-linear"):
            r = run([str(flips), "--create", "--exact", style, str(d / "src.bin"), str(d / "tgt.bin"), str(d / f"flips{style}.bps")])
            if r.returncode != 0:
                # Defeito do binário externo (ex.: --bps-linear dá SIGSEGV em 'bloco_movido_e_repeticoes'); não é PASS do produto.
                external_failures.append({"fixture": name, "style": style, "returncode": r.returncode})
                print(f"EXTERNO {name}: Flips {style} falhou rc={r.returncode} (excluído; registrado)")
                continue
            chk(f"{name}: Flips cria ({style})", True)
            jobs.append({"mode": "apply", "a": str(d / "src.bin"), "b": str(d / f"flips{style}.bps"), "out": str(d / f"prod_from{style}.bin")}); meta.append((name, f"prod_apply{style}"))
    # malformados + válidos feitos à mão (as quatro ações, metadados)
    src = bytes(range(32)); d = work / "manual"; d.mkdir(exist_ok=True)
    tgt = src[:4] + b"\xaa\xbb\xcc" + src[20:25]; tgt += tgt[:8] + b"\x01\x02\x03"
    body = act(0, 4) + act(1, 3) + b"\xaa\xbb\xcc" + act(2, 5) + rel(20) + act(3, 8) + rel(0) + act(1, 3) + b"\x01\x02\x03"
    cases = {
        "valido_4_acoes_com_metadados": (src, tgt, b"<manifest/>", body, True),
        "valido_targetcopy_sobreposto": (b"", bytes([9]) * 6, b"", act(1, 1) + b"\x09" + act(3, 5) + rel(0), True),
        "mal_sem_acoes": (b"\x01", b"\x00", b"", b"", False),
        "mal_sourcecopy_negativo": (b"\x05\x06", b"\x00", b"", act(2, 1) + rel(-1), False),
        "mal_targetcopy_futuro": (b"\x01", b"\x00", b"", act(3, 1) + rel(0), False),
        "mal_targetread_longo": (b"\x01", b"\x07", b"", act(1, 2) + b"\x07\x09", False),
    }
    for name, (s, t, m, b, good) in cases.items():
        (d / f"{name}.src").write_bytes(s); (d / f"{name}.tgt").write_bytes(t)
        p = bps_manual(s, t, m, b); (d / f"{name}.bps").write_bytes(p)
        r = run([str(flips), "--apply", "--exact", str(d / f"{name}.bps"), str(d / f"{name}.src"), str(d / f"{name}.flipsout")])
        flips_ok = r.returncode == 0 and (d / f"{name}.flipsout").exists() and (d / f"{name}.flipsout").read_bytes() == t
        chk(f"{name}: Flips {'aceita' if good else 'recusa'}", flips_ok == good, (r.stdout + r.stderr).strip()[:100])
        jobs.append({"mode": "apply", "a": str(d / f"{name}.src"), "b": str(d / f"{name}.bps"), "out": str(d / f"{name}.prodout")}); meta.append((name, "manual", good, t))
    # produto roda tudo pelo caminho canônico
    (work / "jobs.json").write_text(json.dumps(jobs))
    env = dict(os.environ, RDS_BPS_JOBS=str(work / "jobs.json"), RDS_BPS_RESULTS=str(work / "results.json"))
    r = run(["cargo", "test", "--lib", "bps_interop_tool", "--", "--ignored"], cwd=a.src_tauri, env=env)
    chk("produto: ferramenta de interop executou", r.returncode == 0, r.stderr[-120:])
    res = json.loads((work / "results.json").read_text())
    for (m, job, r_) in zip(meta, jobs, res):
        name = m[0]; d2 = work / name
        if m[1] == "prod_create":
            ap_ = run([str(flips), "--apply", "--exact", r_ and str(d2 / "prod.bps"), str(d2 / "src.bin"), str(d2 / "flips_out.bin")])
            ok = r_["ok"] and ap_.returncode == 0 and (d2 / "flips_out.bin").read_bytes() == (d2 / "tgt.bin").read_bytes()
            chk(f"{name}: produto cria → Flips aplica = alvo", ok, (ap_.stderr + str(r_.get('error', ''))).strip()[:100])
        elif m[1].startswith("prod_apply"):
            ok = r_["ok"] and Path(job["out"]).read_bytes() == (d2 / "tgt.bin").read_bytes()
            chk(f"{name}: Flips cria ({m[1][11:]}) → produto aplica = alvo", ok, str(r_.get("error", "")))
        else:
            good, t = m[2], m[3]
            ok = (r_["ok"] and Path(job["out"]).read_bytes() == t) if good else (not r_["ok"])
            chk(f"{name}: produto {'aceita' if good else 'recusa'}", ok, str(r_.get("error", ""))[:100])
    Path(a.out).write_text(json.dumps({"schema": "rex-bps-interop/v1", "flips_pkg_sha256": FLIPS_PKG_SHA256, "flips_bin_sha256": FLIPS_BIN_SHA256,
                                        "flips_version": ver, "external_tool_failures": external_failures, "checks": checks, "all_pass": all(c["ok"] for c in checks)}, indent=1))
    return 0 if all(c["ok"] for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
