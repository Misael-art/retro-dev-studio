#!/usr/bin/env python3
"""Auditoria reproduzivel (F0 do REX universal): mede, por arquivo, linhas, termos de jogo e simbolos publicos.
Sem rede. Determinista: mesma arvore => mesmo relatorio (sem timestamps). Uso:
  python3 -I scripts/rex_profiles/integration_20261009/audit-decomp-modules.py --classes <classificacao.json> --out-dir <dir>
Cobertura 100% obrigatoria: todo arquivo medido precisa ter classe em classificacao.json (e vice-versa), senao sai com erro."""
import argparse, hashlib, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TERMS = ["sonic", "jump", "pulo", "ghz", "tails", "hamoopig", "taiketsu", "streets", "delta"]
SCOPES = [
    ("src-tauri/src/tools/reverse/decomp", "*.rs"),
    ("crates", "*/src/**/*.rs"),
    ("src/core/nodegraph", "*GraphBridge.ts"),
    ("src/core/nodegraph", "sonicLogicGraphs*.ts"),
    ("src/core/nodegraph", "rexGameplay*.ts"),
]
PUB = re.compile(r"^\s*pub(?:\([a-z]+\))?\s+(?:async\s+)?(fn|struct|enum|trait|const|type|static|mod)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
EXPORT = re.compile(r"^\s*export\s+(?:async\s+)?(function|const|class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
USE = re.compile(r"\buse\s+(?:crate|super)::([a-z_0-9:]+)")

def files():
    out = set()
    for base, pat in SCOPES:
        for p in (ROOT / base).glob(pat):
            if p.is_file() and not p.name.endswith(".test.ts"):
                out.add(p.relative_to(ROOT).as_posix())
    return sorted(out)


def strip_cfg_test(text):
    """Remove itens `#[cfg(test)]` (mod, fn, const, use...) respeitando strings e comentarios de linha.
    Devolve o texto de producao. Um item termina no `;` ou no `}` que fecha o seu primeiro bloco, em profundidade 0."""
    out, i, n = [], 0, len(text)
    marker = "#[cfg(test)]"
    while i < n:
        j = text.find(marker, i)
        if j < 0:
            out.append(text[i:]); break
        out.append(text[i:j])
        k = j + len(marker)
        depth, seen_block = 0, False
        while k < n:
            c = text[k]
            if text.startswith("//", k):
                nl = text.find("\n", k); k = n if nl < 0 else nl; continue
            if c == '"':
                k += 1
                while k < n and text[k] != '"':
                    k += 2 if text[k] == "\\" else 1
                k += 1; continue
            if c in "([{":
                depth += 1; seen_block = seen_block or c == "{"
            elif c in ")]}":
                depth -= 1
                if depth == 0 and c == "}" and seen_block:
                    k += 1; break
            elif c == ";" and depth == 0:
                k += 1; break
            k += 1
        i = k
    return "".join(out)

def measure(rel):
    text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
    low = text.lower()
    # separa codigo de #[cfg(test)] (mod tests) para nao contar casos de teste como forma do codigo
    prod = strip_cfg_test(text) if rel.endswith(".rs") else text
    prod_low = prod.lower()
    terms = {t: prod_low.count(t) for t in TERMS if prod_low.count(t)}
    syms = [f"{k} {n}" for k, n in (PUB.findall(text) if rel.endswith(".rs") else EXPORT.findall(text))]
    uses = sorted(set(USE.findall(text))) if rel.endswith(".rs") else []
    return {
        "arquivo": rel,
        "linhas": text.count("\n") + 1,
        "linhas_producao": prod.count("\n") + 1,
        "termos_producao": terms,
        "simbolos_publicos": syms,
        "usa_modulos": uses,
        "sha256": hashlib.sha256(text.encode()).hexdigest(),
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--classes", required=False)
    ap.add_argument("--measure-only", action="store_true")
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()
    if a.measure_only:
        print(json.dumps([measure(f) for f in files()], ensure_ascii=False)); return
    if not a.classes: ap.error("--classes obrigatorio")
    classes = json.loads(Path(a.classes).read_text(encoding="utf-8"))
    cdict = classes["arquivos"]
    meds = [measure(f) for f in files()]
    names = {m["arquivo"] for m in meds}
    faltam = sorted(names - cdict.keys()); sobram = sorted(cdict.keys() - names)
    if faltam or sobram:
        print(json.dumps({"erro": "cobertura", "sem_classe": faltam, "classe_sem_arquivo": sobram}, indent=1), file=sys.stderr); sys.exit(2)
    validas = {"motor", "perfil", "caso", "misto"}
    for f, c in cdict.items():
        if c["classe"] not in validas or not c.get("justificativa"):
            print(f"classe/justificativa invalida: {f}", file=sys.stderr); sys.exit(3)
        if c["classe"] == "misto" and not (c.get("lado_motor") and (c.get("lado_perfil") or c.get("lado_caso"))):
            print(f"misto sem lados: {f}", file=sys.stderr); sys.exit(4)
    for m in meds:
        m["classe"] = cdict[m["arquivo"]]
    resumo = {}
    for m in meds:
        r = resumo.setdefault(m["classe"]["classe"], {"arquivos": 0, "linhas_producao": 0})
        r["arquivos"] += 1; r["linhas_producao"] += m["linhas_producao"]
    rel = {"schema": "rex-audit-decomp/v1", "termos": TERMS, "cobertura": {"medidos": len(meds), "classificados": len(cdict)}, "resumo": resumo, "arquivos": meds}
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    (out / "auditoria.json").write_text(json.dumps(rel, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    linhas = ["# Auditoria F0 — motor × perfil × caso (gerada; não editar)\n", f"Arquivos medidos: {len(meds)} · classificados: {len(cdict)}\n",
              "| Classe | Arquivos | Linhas (produção) |\n|---|---|---|"]
    for k in sorted(resumo): linhas.append(f"| {k} | {resumo[k]['arquivos']} | {resumo[k]['linhas_producao']} |")
    linhas += ["\n| Arquivo | Classe | Linhas prod. | Termos de jogo (produção) | Justificativa |\n|---|---|---|---|---|"]
    for m in meds:
        c = m["classe"]
        linhas.append(f"| `{m['arquivo']}` | {c['classe']} | {m['linhas_producao']} | {', '.join(f'{k}:{v}' for k,v in m['termos_producao'].items()) or '—'} | {c['justificativa']} |")
    mistos = [m for m in meds if m["classe"]["classe"] == "misto"]
    if mistos:
        linhas.append("\n## Arquivos mistos: símbolos por lado\n")
        for m in mistos:
            c = m["classe"]; linhas.append(f"- `{m['arquivo']}`\n  - motor: {', '.join(c['lado_motor'])}" + (f"\n  - perfil: {', '.join(c['lado_perfil'])}" if c.get('lado_perfil') else "") + (f"\n  - caso: {', '.join(c['lado_caso'])}" if c.get('lado_caso') else "") + (f"\n  - indeterminado: {', '.join(c['lado_indeterminado'])}" if c.get('lado_indeterminado') else ""))
    (out / "auditoria.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(json.dumps({"medidos": len(meds), "resumo": resumo}))

main()
