#!/usr/bin/env python3
"""Congelamento do motor: lista de arquivos + SHA-256 de TODO o codigo de produto (Rust e TypeScript), dos
perfis embutidos e do roteirista de jornadas, lidos do COMMIT (nao da arvore de trabalho).
Saida no formato do `sha256sum`: confere-se depois com `sha256sum -c <manifesto>` na raiz do repositorio.
Uso: python3 -I scripts/rex_profiles/integration_20261009/freeze-engine.py --rev <commit> --out <manifesto>"""
import argparse, hashlib, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PREFIXES = ("src-tauri/src/", "src-tauri/capabilities/", "src/", "crates/")
FILES = {"src-tauri/build.rs", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock", "src-tauri/tauri.conf.json",
         "package.json", "package-lock.json", "index.html", "vite.config.ts", "tsconfig.json", "tsconfig.node.json",
         "scripts/e2e-tauri-build-run.mjs", "scripts/qa/run-sonic-desktop-isolated.py"}
EMBEDDED = "data/rex_profiles/specs/"

def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, check=True).stdout

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--rev", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rev = git("rev-parse", a.rev).decode().strip()
    names = git("ls-tree", "-r", "--name-only", rev).decode().splitlines()
    keep = [n for n in names if n.startswith(PREFIXES) or n in FILES
            or (n.startswith(EMBEDDED) and n.endswith(".json") and "/" not in n[len(EMBEDDED):])]
    lines = [f"{hashlib.sha256(git('show', f'{rev}:{n}')).hexdigest()}  {n}" for n in sorted(keep)]
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    exts = {}
    for n in keep:
        e = n.rsplit(".", 1)[-1]; exts[e] = exts.get(e, 0) + 1
    print({"commit": rev, "arquivos": len(keep), "por_extensao": dict(sorted(exts.items())),
           "sha256_do_manifesto": hashlib.sha256(out.read_bytes()).hexdigest()})

main()
