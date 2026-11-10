#!/usr/bin/env python3
"""Ronda B4 — evidencia de PRODUTO: executa o CLI rex-enigma e confronta cada
linha co congelamento EXPECTATIONS-ENIGMA-B4.md (commit 3268ac7).

Os numeros esperados estanao COPIADOS DO DOCUMENTO (nao do produto nem da
sonda); a diverxencia aborta con serie bruta. Requisito 8: o CLI reproduce o
decode e exporta resultado estruturado; este script e a reproducion colectiva.
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parents[3]
EVID = RAIZ / "data/rex_profiles/parallel_recovery_20261004/b/evidencia"
CLI = AQUI / "enigma-rs/target/debug/rex-enigma"
ROM = pathlib.Path.home() / "emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin"
ROM_SHA = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
FIXDIR = pathlib.Path("/home/misael/RDS-REX-CORPUS-B/data/rex_corpus_b/vendor/data/rex_profiles/codec/enigma")

# E23: (offset, bytes_lidos, padding, armazenados, output_sha256)
E23 = [
    ("0x65432", 634, 0, 634, "322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0"),
    ("0x656ac", 1042, 0, 1042, "4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d"),
    ("0x65abe", 860, 0, 860, "3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954"),
    ("0x65e1a", 1242, 0, 1242, "04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7"),
    ("0x662f4", 1233, 1, 1234, "5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8"),
    ("0x667c6", 784, 0, 784, "78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94"),
]
# E24: (nome, bytes_lidos, saida_size)
E24 = [
    ("alternating_runs", 84, 1200), ("big_deltas", 91, 96), ("const_500", 18, 400),
    ("empty", 7, 0), ("noise_1k", 1058, 1024), ("planes_4k", 4222, 4096),
    ("ramp_signed", 17, 400), ("single_word", 8, 2), ("threshold_edge", 10, 64),
    ("zeros_64", 11, 128),
]
# E25: (arquivo, modo, max_out|None, veredito esperado)
E25 = [
    ("e01_odd_bytes_tail.bin", "file", None, "truncated"),
    ("e02_truncated_last_byte.eni", "file", None, "truncated"),
    ("e03_len_inflated.eni", "file", None, "OK-planes4k"),
    ("e04_mode_02.eni", "file", None, "OK-const500"),
    ("e05_empty_stream.eni", "file", None, "truncated"),
    ("e06_garbage_ff_255b.eni", "file", None, "malformed-header"),
    ("e07_planes_4k.eni", "file", 1024, "excessive-output"),
]
# E26: craft sobre planes_4k.eni (esperados do documento)
E26 = {
    "packet_length_fora": {0: "malformed-header", 12: "malformed-header",
                           128: "malformed-header", 255: "malformed-header"},
    "mascara_fora": {0x20: "malformed-header", 0xFF: "malformed-header"},
    "work_limit_8": "work-limit",
    "cancel_sempre": "cancelled",
    "header_5_bytes": "truncated",
}


def cli(args, tmp):
    r = subprocess.run([str(CLI), *args], capture_output=True, text=True)
    doc = json.loads(r.stdout) if r.stdout.strip() else {}
    return r.returncode, doc


def main() -> int:
    import hashlib
    if not CLI.exists():
        sys.exit(f"RECUSA: CLI non construido ({CLI}); cargo build no crate primeiro")
    if hashlib.sha256(ROM.read_bytes()).hexdigest() != ROM_SHA:
        sys.exit("RECUSA: ROM non confire co pinnado")

    tmp = RAIZ / ".tmp-medicion-b4"
    tmp.mkdir(exist_ok=True)
    doc = {"schema": "rex-parallel-b/produto-enigma-b4/1",
           "proposito": "evidencia de produto: CLI rex-enigma vs congelamento E23-E26",
           "cli": str(CLI.relative_to(RAIZ)), "rom_sha256": ROM_SHA,
           "gerado_por": pathlib.Path(__file__).name,
           "e23": [], "e24": [], "e25": [], "e26": [], "falhas": []}

    # ---- E23
    for off, lidos, pad, arm, sha in E23:
        rc, d = cli(["decode-rom", str(ROM), off, "--max-out", "65536"], tmp)
        linha = {"offset": off, "esperado": {"bytes_lidos": lidos, "padding_console": pad,
                                             "bytes_armazenados": arm, "output_sha256": sha,
                                             "output_size": 4096},
                 "obtido": {k: d.get(k) for k in ("bytes_lidos", "padding_console",
                                                  "bytes_armazenados", "output_sha256",
                                                  "output_size", "terminador",
                                                  "determinismo_decode_duplo")},
                 "rc": rc}
        linha["ok"] = (rc == 0 and d.get("veredito") == "OK" and
                       d.get("bytes_lidos") == lidos and d.get("padding_console") == pad and
                       d.get("bytes_armazenados") == arm and d.get("output_sha256") == sha and
                       d.get("output_size") == 4096 and d.get("terminador") is True and
                       d.get("determinismo_decode_duplo") is True)
        doc["e23"].append(linha)
        if not linha["ok"]:
            doc["falhas"].append(f"E23@{off}")

    # ---- E24
    for nome, lidos, size in E24:
        rc, d = cli(["decode-file", str(FIXDIR / "plain" / f"{nome}.eni")], tmp)
        binsha = hashlib.sha256((FIXDIR / "plain" / f"{nome}.bin").read_bytes()).hexdigest()
        ok = (rc == 0 and d.get("bytes_lidos") == lidos and d.get("output_size") == size and
              d.get("output_sha256") == binsha and d.get("terminador") is True)
        doc["e24"].append({"par": nome, "bytes_lidos": d.get("bytes_lidos"),
                           "output_size": d.get("output_size"),
                           "output_sha256": d.get("output_sha256"), "ok": ok})
        if not ok:
            doc["falhas"].append(f"E24@{nome}")

    # ---- E25
    for arquivo, _modo, max_out, esperado in E25:
        args = ["decode-file", str(FIXDIR / "negative" / arquivo)]
        if max_out:
            args += ["--max-out", str(max_out)]
        rc, d = cli(args, tmp)
        if esperado.startswith("OK-"):
            par = {"OK-planes4k": "planes_4k", "OK-const500": "const_500"}[esperado]
            binsha = hashlib.sha256((FIXDIR / "plain" / f"{par}.bin").read_bytes()).hexdigest()
            ok = d.get("veredito") == "OK" and d.get("output_sha256") == binsha
        else:
            ok = d.get("veredito") == "ERRO" and d.get("erro") == esperado
        doc["e25"].append({"arquivo": arquivo, "max_out": max_out,
                           "esperado": esperado, "obtido": d.get("erro") or d.get("veredito"),
                           "ok": ok})
        if not ok:
            doc["falhas"].append(f"E25@{arquivo}")

    # ---- E26
    pleno = (FIXDIR / "plain" / "planes_4k.eni").read_bytes()
    for label, campo, valor, esperado in (
        [("pl=%d" % v, "packet_length", v, e) for v, e in E26["packet_length_fora"].items()] +
        [("mask=0x%02x" % v, "mascara", v, e) for v, e in E26["mascara_fora"].items()]
    ):
        s = bytearray(pleno)
        s[0 if campo == "packet_length" else 1] = valor
        p = tmp / f"e26-{label}.eni"
        p.write_bytes(bytes(s))
        rc, d = cli(["decode-file", str(p)], tmp)
        ok = d.get("erro") == esperado
        doc["e26"].append({"caso": label, "esperado": esperado, "obtido": d.get("erro"), "ok": ok})
        if not ok:
            doc["falhas"].append(f"E26@{label}")

    # work-limit e header curto via CLI; cancel so existe na API (coberto por
    # cargo test e26_hardening — a CLI non expón cancel)
    rc, d = cli(["decode-file", str(FIXDIR / "plain" / "planes_4k.eni"), "--work-limit", "8"], tmp)
    ok = d.get("erro") == E26["work_limit_8"]
    doc["e26"].append({"caso": "work_limit=8", "esperado": E26["work_limit_8"],
                       "obtido": d.get("erro"), "ok": ok})
    if not ok:
        doc["falhas"].append("E26@work_limit")
    p5 = tmp / "e26-header5.eni"
    p5.write_bytes(pleno[:5])
    rc, d = cli(["decode-file", str(p5)], tmp)
    ok = d.get("erro") == E26["header_5_bytes"]
    doc["e26"].append({"caso": "header=5B", "esperado": E26["header_5_bytes"],
                       "obtido": d.get("erro"), "ok": ok})
    if not ok:
        doc["falhas"].append("E26@header5")
    doc["e26"].append({"caso": "cancel=sempre", "esperado": E26["cancel_sempre"],
                       "obtido": "so-API (cargo test e26_hardening_entradas_reservadas)",
                       "ok": True})

    saida = EVID / "enigma-produto-b4.json"
    doc["veredito"] = ("PRODUTO-ENIGMA-B4-OK: paridade 6 streams reais + 10 pares plain + "
                       "negativos e01-e07 + hardening E26 (estatico; consumo observado NAO "
                       "PROVADO)" if not doc["falhas"] else "FALHAS: " + ",".join(doc["falhas"]))
    saida.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    shutil.rmtree(tmp)
    print("veredito:", doc["veredito"])
    print(f"e23 {sum(l['ok'] for l in doc['e23'])}/6 | e24 {sum(l['ok'] for l in doc['e24'])}/10 | "
          f"e25 {sum(l['ok'] for l in doc['e25'])}/7 | e26 {sum(l['ok'] for l in doc['e26'])}/{len(doc['e26'])}")
    print("evidencia:", saida)
    return 1 if doc["falhas"] else 0


if __name__ == "__main__":
    sys.exit(main())
