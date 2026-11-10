#!/usr/bin/env python3
"""Auditoria por PAPEL (missao F0+F1 de 2026-10-09, adendo a auditoria F0): classifica arquivos e, nos
arquivos do caminho do perfil, SIMBOLOS, em motor / perfil / caso / instrumento / adaptador.
Cada simbolo citado e resolvido para `arquivo:linha` no checkout; simbolo inexistente = erro (citacao nao pode apodrecer).
Sem rede, determinista. Uso:
  python3 -I scripts/rex_profiles/integration_20261009/audit-roles.py --roles <papeis.json> --out-dir <dir>"""
import argparse, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PAPEIS = {"motor", "perfil", "caso", "instrumento", "adaptador"}
SCOPES = [("src-tauri/src/tools/reverse/decomp", "*.rs"), ("crates", "*/src/**/*.rs"),
          ("src/core/nodegraph", "*[Bb]ridge.ts"), ("src/core/nodegraph", "sonicLogicGraphs*.ts"),
          ("src/core/nodegraph", "rexGameplay*.ts"), ("src/components/tools", "Rex*Panel.tsx"),
          ("src/components/nodegraph", "*BridgePanel.tsx")]

def files():
    out = set()
    for base, pat in SCOPES:
        for p in (ROOT / base).glob(pat):
            if p.is_file() and ".test." not in p.name:
                out.add(p.relative_to(ROOT).as_posix())
    return sorted(out)

def line_of(text, sym):
    name = sym.split()[-1]
    pat = re.compile(r"^\s*(?:pub(?:\([a-z]+\))?\s+)?(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:fn|struct|enum|trait|const|type|static|mod|function|interface|class|impl)\s+(?:[A-Za-z_<>]+\s+for\s+)?" + re.escape(name) + r"\b", re.M)
    m = pat.search(text)
    return None if not m else text.count("\n", 0, m.start()) + 1 + (1 if text[m.start()] == "\n" else 0)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--roles", required=True); ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()
    roles = json.loads(Path(a.roles).read_text(encoding="utf-8"))
    arqs = roles["arquivos"]; fs = files()
    faltam = sorted(set(fs) - arqs.keys()); sobram = sorted(arqs.keys() - set(fs))
    if faltam or sobram:
        print(json.dumps({"erro": "cobertura", "sem_papel": faltam, "papel_sem_arquivo": sobram}, indent=1), file=sys.stderr); sys.exit(2)
    rows, resumo, erros = [], {}, []
    for f in fs:
        c = arqs[f]; text = (ROOT / f).read_text(encoding="utf-8", errors="replace")
        if c["papel"] not in PAPEIS | {"misto"} or not c.get("porque"):
            erros.append(f"papel/porque invalido: {f}")
        cit = []
        for papel, syms in sorted(c.get("simbolos", {}).items()):
            if papel not in PAPEIS: erros.append(f"papel de simbolo invalido: {f} {papel}")
            for s in syms:
                ln = line_of(text, s)
                if ln is None: erros.append(f"simbolo nao encontrado: {f} :: {s}")
                cit.append({"papel": papel, "simbolo": s, "onde": f"{f}:{ln}"})
        if c["papel"] == "misto" and not cit: erros.append(f"misto sem simbolos: {f}")
        r = resumo.setdefault(c["papel"], {"arquivos": 0, "linhas": 0}); r["arquivos"] += 1; r["linhas"] += text.count("\n") + 1
        rows.append({"arquivo": f, "papel": c["papel"], "porque": c["porque"], "reuso": c.get("reuso", ""), "citacoes": cit,
                     "linhas": text.count("\n") + 1, "sha256": hashlib.sha256(text.encode()).hexdigest()})
    if erros:
        print("\n".join(erros), file=sys.stderr); sys.exit(3)
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    rel = {"schema": "rex-audit-roles/v1", "definicoes": roles["definicoes"], "resumo": resumo, "arquivos": rows}
    (out / "papeis-auditoria.json").write_text(json.dumps(rel, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    L = ["# Auditoria por papel — motor / perfil / caso / instrumento / adaptador (gerada; não editar)\n"]
    L += [f"- **{k}**: {v}" for k, v in roles["definicoes"].items()]
    L += ["\n| Papel | Arquivos | Linhas |\n|---|---|---|"] + [f"| {k} | {v['arquivos']} | {v['linhas']} |" for k, v in sorted(resumo.items())]
    L += ["\n| Arquivo | Papel | Por quê | Reuso registrado |\n|---|---|---|---|"]
    L += [f"| `{r['arquivo']}` | {r['papel']} | {r['porque']} | {r['reuso'] or '—'} |" for r in rows]
    L += ["\n## Símbolos citados (arquivo:linha)\n"]
    for r in rows:
        if r["citacoes"]:
            L.append(f"### `{r['arquivo']}`")
            for papel in sorted({c['papel'] for c in r['citacoes']}):
                L.append(f"- **{papel}**: " + "; ".join(f"`{c['simbolo']}` ({c['onde'].split(':')[-1]})" for c in r["citacoes"] if c["papel"] == papel))
    (out / "papeis-auditoria.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(json.dumps({"arquivos": len(rows), "resumo": resumo}))
main()
