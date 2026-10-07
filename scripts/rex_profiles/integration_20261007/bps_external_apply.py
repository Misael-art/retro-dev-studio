#!/usr/bin/env python3
"""Aplica um BPS gerado PELO PRODUTO com o Flips externo PINADO e compara byte a byte com a cópia do produto.

  bps_external_apply.py --flips FLIPS --base ROM --bps PATCH --copy COPIA [--out rel.json] [--label X]

Independente do aplicador do produto: o resultado do Flips é comparado com a cópia que a UI gravou/aplicou.
"""
import argparse, hashlib, json, subprocess, sys, tempfile
from pathlib import Path

FLIPS_BIN_SHA256 = "3f3033ef4293931011a2e7043b83200b0818c8ff7fb15d7fa480719219509253"
sha = lambda b: hashlib.sha256(b).hexdigest()

ap = argparse.ArgumentParser()
for k in ("flips", "base", "bps", "copy"): ap.add_argument("--" + k, required=True)
ap.add_argument("--out"); ap.add_argument("--label", default="")
a = ap.parse_args()
fl = Path(a.flips).read_bytes()
base, patch, copy = (Path(a.__dict__[k]).read_bytes() for k in ("base", "bps", "copy"))
with tempfile.TemporaryDirectory() as d:
    out = Path(d) / "out.bin"
    r = subprocess.run([a.flips, "--apply", "--exact", a.bps, a.base, str(out)], capture_output=True, text=True)
    got = out.read_bytes() if out.exists() else b""
checks = [
    {"check": "Flips: binário pinado", "ok": sha(fl) == FLIPS_BIN_SHA256},
    {"check": "Flips aplica o BPS do produto (rc=0)", "ok": r.returncode == 0, "detail": (r.stdout + r.stderr).strip()[:120]},
    {"check": "saída do Flips == cópia do produto, byte a byte", "ok": got == copy, "detail": f"{sha(got)[:16]} vs {sha(copy)[:16]}"},
    {"check": "cópia != base (a edição existe)", "ok": copy != base},
]
for c in checks: print(("PASS " if c["ok"] else "FAIL ") + c["check"] + (" :: " + c.get("detail", "") if c.get("detail") else ""))
rep = {"schema": "rex-bps-external-apply/v1", "label": a.label, "base_sha256": sha(base), "bps_sha256": sha(patch), "copy_sha256": sha(copy),
       "flips_bin_sha256": sha(fl), "checks": checks, "all_pass": all(c["ok"] for c in checks)}
if a.out: Path(a.out).write_text(json.dumps(rep, indent=1))
sys.exit(0 if rep["all_pass"] else 1)
