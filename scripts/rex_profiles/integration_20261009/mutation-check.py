#!/usr/bin/env python3
"""Checagem por MUTACAO dos negativos do motor de perfis: cada mutante desliga UMA protecao do produto e a
suite `cargo test --lib rex_` tem de REPROVAR. Mutante que sobrevive = negativo que nao discrimina.
Restaura cada arquivo do Git ao fim (exige arvore limpa nos arquivos mutados). Um mutante por vez.
Uso: python3 -I scripts/rex_profiles/integration_20261009/mutation-check.py --out <relatorio.json>"""
import argparse, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
D = "src-tauri/src/tools/reverse/decomp/"
MUTANTS = [
    ("hash do perfil nao conferido no IPC", D + "rex_profile_ipc.rs", "        Some(h) if h != loaded => Err(from_profile(ProfileError::ProfileMismatch {", "        Some(h) if false && h != loaded => Err(from_profile(ProfileError::ProfileMismatch {"),
    ("hash do perfil nao conferido na reabertura do grafo", D + "rex_profile_graph.rs", "        Some(h) if h != engine.profile_sha256() => {", "        Some(h) if false && h != engine.profile_sha256() => {"),
    ("identidade da ROM nao conferida", D + "rex_profile_ipc.rs", "    if req.expected_rom_sha256.len() != 64 || req.expected_rom_sha256 != before {", "    if false && req.expected_rom_sha256 != before {"),
    ("empate nunca recusado", D + "rex_profile_engine.rs", "    if ties > 1 && tie == TieRule::Refuse {", "    if false && ties > 1 && tie == TieRule::Refuse {"),
    ("restricoes entre capturas ignoradas", D + "rex_profile_engine.rs", "        v.retain(|m| self.passes(rom, m));", "        v.retain(|m| self.passes(rom, m) || true);"),
    ("overflow truncado na codificacao", D + "rex_edit.rs", "        if value < lo || value > hi {\n            return None;\n        }\n        let mut out", "        if false && (value < lo || value > hi) {\n            return None;\n        }\n        let mut out"),
    ("dominio do campo maior que a largura aceito", D + "rex_profile_spec.rs", "            if f.min < lo || f.max > hi {", "            if false && (f.min < lo || f.max > hi) {"),
    ("diferencas estruturais do grafo ignoradas", D + "rex_profile_graph.rs", "    r.structural_ok = r.differences.is_empty();", "    r.structural_ok = true;"),
    ("campo duplicado no grafo aceito", D + "rex_profile_graph.rs", "        if seen.contains(&campo) {", "        if false && seen.contains(&campo) {"),
    ("escopo declarado de outra instancia apresentado como desta", D + "rex_profile_ipc.rs", "                    r.sha256 == rom_sha256 && r.instance_offsets.contains(&instance_offset)", "                    r.sha256 == rom_sha256 || r.instance_offsets.contains(&instance_offset)"),
    ("perfil de pasta herda evidencia curada", D + "rex_evidence_origin.rs", "    // curadoria é do repositório: um perfil lido de pasta nunca a herda, mesmo com o mesmo id\n    if profile_origin != Origin::Builtin {", "    // curadoria é do repositório: um perfil lido de pasta nunca a herda, mesmo com o mesmo id\n    if false && profile_origin != Origin::Builtin {"),
    ("registro curado de outra instancia vale para esta", D + "rex_evidence_origin.rs", "            .filter(|r| r.rom_sha256 == rom_sha256 && r.instance_offsets.contains(&instance_offset))", "            .filter(|r| r.rom_sha256 == rom_sha256 || r.instance_offsets.contains(&instance_offset))"),
    ("registro curado de outra revisao do perfil vale para esta", D + "rex_evidence_origin.rs", "        (Applicability::OtherRevision, of_claim)", "        (Applicability::ThisInstance, of_claim)"),
    ("observacao de sessao anterior tratada como atual", D + "rex_evidence_origin.rs", "    obs.session == app_session()", "    obs.session == app_session() || true"),
    ("classe semantica: limiar fora da faixa aceito", D + "rex_profile_semantic.rs", "        if threshold < inst.min || threshold > inst.max {", "        if false && (threshold < inst.min || threshold > inst.max) {"),
    ("classe semantica: vinculo do perfil com a ROM ignorado", D + "rex_profile_semantic.rs", "            RomBinding::Sha256 { sha256 } => sha256.iter().any(|s| s == rom_sha256),", "            RomBinding::Sha256 { sha256 } => sha256.iter().any(|s| s == rom_sha256) || true,"),
    ("classe semantica: regiao declarada rotulada como candidato", D + "rex_profile_semantic.rs", "        self.analyze(rom, entry, exits, SelectionMode::DeclaredRegion)", "        self.analyze(rom, entry, exits, SelectionMode::StructuralScan)"),
    ("classe semantica: chamada opaca apresentada como compreendida", D + "rex_profile_semantic.rs", '                opaque: p["understood"] == false,', "                opaque: false,"),
    ("limite de instancias nao aplicado", D + "rex_profile_engine.rs", "        if anchors.len() > self.spec.work_limits.max_instances {", "        if false && anchors.len() > self.spec.work_limits.max_instances {"),
    ("duplicidade de campo no perfil aceita", D + "rex_profile_spec.rs", '        unique("campo", self.fields.iter().map(|f| f.name.as_str()))?;', '        let _ = unique("campo", self.fields.iter().map(|f| f.name.as_str()));'),
    ("id de perfil repetido aceito (sombra do embutido)", D + "rex_profile_registry.rs", "        self.find(id)\n            .map(|p| p.file.clone())", "        self.find(id)\n            .filter(|_| false)\n            .map(|p| p.file.clone())"),
    ("versao de esquema desconhecida aceita", D + "rex_profile_spec.rs", "        if head.schema != SPEC_SCHEMA {\n            return Err(SpecError::WrongSchema(head.schema));\n        }", "        if false && head.schema != SPEC_SCHEMA {\n            return Err(SpecError::WrongSchema(head.schema));\n        }"),
    ("vinculo do perfil com a ROM por SHA ignorado", D + "rex_profile_engine.rs", "            if !sha256.iter().any(|s| s == rom_sha256) {", "            if false && !sha256.iter().any(|s| s == rom_sha256) {"),
]

def run_tests():
    p = subprocess.run(["cargo", "test", "--lib", "rex_"], cwd=ROOT / "src-tauri", capture_output=True, text=True)
    out = p.stdout + p.stderr
    m = re.search(r"test result: (\w+)\. (\d+) passed; (\d+) failed", out)
    failed = re.findall(r"^test (\S+) \.\.\. FAILED", out, re.M)
    built = m is not None
    return {"compilou": built, "resultado": m.group(1) if m else "nao compilou", "falhas": int(m.group(3)) if m else None, "testes_que_reprovaram": failed[:12]}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); a = ap.parse_args()
    files = sorted({m[1] for m in MUTANTS})
    if subprocess.run(["git", "diff", "--quiet", "--"] + files, cwd=ROOT).returncode != 0:
        sys.exit("arquivos a mutar tem mudancas nao commitadas")
    rows = []
    try:
        base = run_tests()
        if base["resultado"] != "ok":
            sys.exit(f"a suite nao esta verde antes de mutar: {base}")
        for name, rel, old, new in MUTANTS:
            path = ROOT / rel; text = path.read_text(encoding="utf-8")
            if text.count(old) != 1:
                rows.append({"mutante": name, "arquivo": rel, "aplicado": False, "morto": False, "motivo": f"trecho encontrado {text.count(old)}x"}); continue
            path.write_text(text.replace(old, new), encoding="utf-8")
            try:
                r = run_tests()
            finally:
                path.write_text(text, encoding="utf-8")
            # mutante que nem compila nao conta como morto por teste
            rows.append({"mutante": name, "arquivo": rel, "aplicado": True, "morto": r["compilou"] and r["resultado"] != "ok", **r})
            print(json.dumps(rows[-1], ensure_ascii=False), flush=True)
    finally:
        subprocess.run(["git", "checkout", "--"] + files, cwd=ROOT)
    rel = {"schema": "rex-mutation-check/v1", "comando": "cargo test --lib rex_", "base": base, "mutantes": rows,
           "mortos": sum(1 for r in rows if r["morto"]), "total": len(rows), "sobreviventes": [r["mutante"] for r in rows if not r["morto"]]}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(rel, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"mortos": rel["mortos"], "total": rel["total"], "sobreviventes": rel["sobreviventes"]}, ensure_ascii=False))

main()
