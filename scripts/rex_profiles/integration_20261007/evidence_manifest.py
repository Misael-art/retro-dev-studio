#!/usr/bin/env python3
"""Gera MANIFEST.json do aceite da PR #110: SHA-256 de TUDO que sustenta a prova.

Politica (AGENTS.md: nao distribuir ROM comercial; Memory Bank: "sem pixels/ROM/corpus BYOR no Git"):
  storage=git        relatorios JSON (so hashes/coordenadas), scripts de prova, oraculos
  storage=local-only capturas de tela (mostram quadros do jogo), patches BPS e copias de ROM (derivados do conteudo
                     comercial), logs: ficam FORA do Git em --local-dir; o manifesto guarda hash, tamanho e origem
Nenhuma licenca e inventada; ROMs/corpus continuam BYOR.

  evidence_manifest.py --repo . --evidence-dir DIR_JSON --local-dir ~/rds-evidence/pr110-20261007 --binary APP \
      --code-commit SHA --out DIR_JSON/MANIFEST.json --pin nome=caminho ...
"""
import argparse, hashlib, json, os, subprocess, sys
from pathlib import Path

sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True); ap.add_argument("--evidence-dir", required=True); ap.add_argument("--local-dir", required=True)
ap.add_argument("--binary", required=True); ap.add_argument("--code-commit", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--pin", action="append", default=[], help="nome=caminho de um insumo externo pinado (ROM BYOR, core, Flips, Xvfb...)")
a = ap.parse_args()
repo = Path(a.repo)
SCRIPTS = ["sor_font_effect.py", "bps_interop.py", "bps_external_apply.py", "kosinski_encoder_audit.py", "core_concurrency_repro.py", "evidence_manifest.py", "lr.py"]
entries = []
def add(path, storage, role, rel=None, note=""):
    p = Path(path)
    entries.append({"path": rel or str(p), "sha256": sha(p), "bytes": p.stat().st_size, "storage": storage, "role": role, **({"note": note} if note else {})})
ev = Path(a.evidence_dir)
for f in sorted(ev.glob("*.json")):
    if f.name != "MANIFEST.json": add(f, "git", "relatorio", rel=str(f.relative_to(repo)))
for s in SCRIPTS:
    add(repo / "scripts/rex_profiles/integration_20261007" / s, "git", "oraculo/ferramenta", rel=f"scripts/rex_profiles/integration_20261007/{s}")
add(repo / "scripts/e2e-tauri-build-run.mjs", "git", "harness E2E (cenario sor-font-journey)", rel="scripts/e2e-tauri-build-run.mjs")
add(repo / "scripts/qa/run-sonic-desktop-isolated.py", "git", "harness Xvfb isolado", rel="scripts/qa/run-sonic-desktop-isolated.py")
loc = Path(a.local_dir)
for sub, role in (("capturas", "captura de tela (quadros do jogo)"), ("patches", "patch BPS exportado pela UI (derivado de ROM comercial)"),
                  ("copias", "copia de ROM modificada (derivado de ROM comercial)"), ("logs", "log da jornada")):
    for f in sorted((loc / sub).glob("*")):
        add(f, "local-only", role, rel=f"{loc}/{sub}/{f.name}", note="fora do Git por politica; hash pinado aqui")
pins = {}
for pin in a.pin:
    n, _, p = pin.partition("="); pins[n] = {"path": p, "sha256": sha(p), "bytes": Path(p).stat().st_size}
head = subprocess.check_output(["git", "-C", a.repo, "rev-parse", "HEAD"], text=True).strip()
manifest = {"schema": "rex-pr110-evidence-manifest/v1", "code_commit": a.code_commit, "manifest_generated_at_head": head,
            "binary": {"path": a.binary, "sha256": sha(a.binary), "bytes": Path(a.binary).stat().st_size},
            "pins_externos": pins, "politica": __doc__.split("Politica")[1].split("evidence_manifest.py")[0].strip(), "artefatos": entries,
            "contagem": {"git": sum(e["storage"] == "git" for e in entries), "local-only": sum(e["storage"] == "local-only" for e in entries)}}
Path(a.out).write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
print(f"{len(entries)} artefatos ({manifest['contagem']}), {len(pins)} pins")
