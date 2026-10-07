#!/usr/bin/env python3
"""Auditoria INDEPENDENTE do encoder Kosinski de parse otimo (kosinski_encode_optimal).

Decoder Kosinski escrito do zero aqui (nada do crate/produto). Corpus: bordas de comprimento
(255..258), de distancia (256/257/8192/8193), de descritor (1..80 literais), repeticoes, aleatorio
e (opcional) o plain real da fonte do SoR. Para cada caso: decode == plain, consumo == tamanho do
stream, determinismo, e comparacao de TAMANHO com o encoder guloso do crate (relatado, sem alegar
otimalidade em bytes: se alguma entrada sair maior que a gulosa, fica registrada).

  kosinski_encoder_audit.py --work DIR --out report.json [--sor-plain k_0389a0.bin]
"""
import argparse, json, os, random, subprocess, sys
from pathlib import Path


def kos(d, o=0):
    p, out = o, bytearray()
    def rd16():
        nonlocal p
        v = d[p] | (d[p + 1] << 8); p += 2; return v
    desc, n = rd16(), 16
    def bit():
        nonlocal desc, n
        b = desc & 1; desc >>= 1; n -= 1
        if n == 0: desc, n = rd16(), 16
        return b
    while True:
        if bit():
            out.append(d[p]); p += 1; continue
        if bit():
            lo, hi = d[p], d[p + 1]; p += 2
            dist = (0xE000 | ((hi & 0xF8) << 5) | lo) - 0x10000
            c = hi & 7
            if c: c += 2
            else:
                c = d[p]; p += 1
                if c == 0: break
                if c == 1: continue
                c += 1
        else:
            c = ((bit() << 1) | bit()) + 2; dist = d[p] - 256; p += 1
        for _ in range(c): out.append(out[len(out) + dist])
    return bytes(out), p - o


def corpus(sor_plain):
    r = random.Random(2026)
    rb = lambda n: bytes(r.getrandbits(8) for _ in range(n))
    c = {"vazio": b"", "um_byte": b"\x07"}
    for n in (2, 3, 4, 5, 6, 9, 10, 11, 255, 256, 257, 258, 300, 512, 1000):
        c[f"corrida_{n}"] = b"\x11" * (n + 1)
    for dist in (1, 255, 256, 257, 8191, 8192, 8193):
        base = bytes(((i * 31) ^ (i >> 3)) | 1 & 0xFF for i in range(dist)) if False else bytes((((i * 31) ^ (i >> 3)) | 1) & 0xFF for i in range(dist))
        c[f"dist_{dist}"] = base + base[:40] + base[:40]
    for n in range(1, 80):
        c[f"literais_{n}"] = bytes((i * 7 + 1) & 0xFF ^ ((i << 3) & 0xFF) for i in range(n))
    c["aleatorio_100"] = rb(100); c["aleatorio_3000"] = rb(3000)
    c["quase_repetido"] = (rb(40) * 30) + rb(15)
    c["tiles_4bpp_sinteticos"] = bytes(((i // 7) % 5) << 4 | ((i // 5) % 5) for i in range(1568))
    if sor_plain: c["sor_fonte_real"] = Path(sor_plain).read_bytes()
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True); ap.add_argument("--out", required=True); ap.add_argument("--sor-plain")
    ap.add_argument("--src-tauri", default=str(Path(__file__).resolve().parents[3] / "src-tauri"))
    a = ap.parse_args(); work = Path(a.work); work.mkdir(parents=True, exist_ok=True)
    cs = corpus(a.sor_plain)
    (work / "corpus.json").write_text(json.dumps([{"name": k, "plain_hex": v.hex()} for k, v in cs.items()]))
    env = dict(os.environ, RDS_KOS_CORPUS=str(work / "corpus.json"), RDS_KOS_OUT=str(work / "out.json"))
    r = subprocess.run(["cargo", "test", "--lib", "kosinski_audit_tool", "--", "--ignored"], cwd=a.src_tauri, env=env, capture_output=True, text=True)
    if r.returncode != 0: print(r.stderr[-400:]); return 2
    res = json.loads((work / "out.json").read_text())
    checks, bigger = [], []
    for item in res:
        plain = cs[item["name"]]; stream = bytes.fromhex(item["optimal_hex"])
        try:
            dec, used = kos(stream)
            ok = dec == plain and used == len(stream) and item["deterministic"]
            detail = f"{len(plain)}B -> {len(stream)}B (guloso {item['greedy_len']}B)"
        except Exception as e:
            ok, detail = False, f"decoder independente falhou: {e}"
        if ok and len(stream) > item["greedy_len"]: bigger.append({"name": item["name"], "optimal": len(stream), "greedy": item["greedy_len"]})
        checks.append({"check": item["name"], "ok": ok, "detail": detail})
        if not ok: print("FAIL", item["name"], detail)
    print(f"{sum(c['ok'] for c in checks)}/{len(checks)} casos ok; {len(bigger)} caso(s) com stream maior que o guloso: {bigger}")
    Path(a.out).write_text(json.dumps({"schema": "rex-kosinski-encoder-audit/v1", "cases": len(checks), "all_pass": all(c["ok"] for c in checks),
                                        "optimal_larger_than_greedy": bigger, "checks": checks,
                                        "claim": "custo em bits modelado minimizado; NAO alega minimo global em bytes"}, indent=1))
    return 0 if all(c["ok"] for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
