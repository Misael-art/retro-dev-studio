#!/usr/bin/env python3
"""Converte os fixtures do motor (escritos no contrato v1) para `rex-profile-spec/v2`, de forma mecanica:
padroes, relacoes, campos, ROM e resultados esperados ficam IDENTICOS; so entram as partes que o v2 exige
(capturas tipadas, regra de empate, projecao minima, procedencia, limites). Idempotente.
Uso: python3 -I scripts/rex_profiles/integration_20261009/upgrade-fixtures-v2.py"""
import copy, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPECS = ROOT / "data/rex_profiles/specs"
CAP = re.compile(r"\{([a-z0-9_]+):(\d)\}")

def upgrade(v1):
    fields = {f["capture"] for f in v1["fields"]}
    sizes = {}
    for p in v1["patterns"]:
        for s in p["sources"]:
            for name, n in CAP.findall(s):
                if name != "_":
                    sizes.setdefault(name, int(n))
    anchors = next(r["from"] for r in v1["relations"] if r["kind"] == "pair")
    always = lambda f: f["requires"] is None and all(a in f["patterns"] for a in anchors)
    nodes = [{"id": "ev", "type": "event_update", "label": "Entrada", "col": 0, "row": 0, "params": [{"key": "rate", "value": "frame"}]}]
    for i, f in enumerate(v1["fields"]):
        n = {"id": f["name"], "type": "var_set", "label": f["label"], "col": 1, "row": i,
             "field": {"name": f["name"], "var_name": f["name"], "description": f["label"]}}
        if not always(f):
            n["when"] = [{"if": "field", "name": f["name"]}]
        nodes.append(n)
    return {
        "schema": "rex-profile-spec/v2", "id": v1["id"], "revision": 1, "status": v1["status"],
        "title": "Perfil sintetico", "summary": v1["summary"], "artifact_tag": "edit",
        "arch": {"cpu": "m68k", "endianness": "big", "instruction_alignment": 2, "bus_address_bits": 24},
        "rom_mapping": {"kind": "linear", "file_header_bytes": 0, "bus_base": 0},
        "provenance": {"author": "fixture autoral (F1)", "created": "2026-10-09",
                       "derived_from": ["scripts/rex_profiles/integration_20261009/make-engine-fixtures.py"],
                       "notes": "convertido do contrato v1 por upgrade-fixtures-v2.py"},
        "rom_binding": {"mode": "signature"},
        "work_limits": {"max_rom_bytes": 1048576, "max_matches_per_pattern": 64, "max_instances": 16},
        "captures": [{"name": n, "width": w, "signed": n in fields, "endianness": "big",
                      "role": "immediate" if n in fields else "opaque"} for n, w in sizes.items()],
        "patterns": v1["patterns"], "constraints": [],
        "relations": [dict(r, tie="first") if r["kind"] != "subsumes" else r for r in v1["relations"]],
        "fields": [{k: f[k] for k in ("name", "label", "patterns", "capture", "extra_offsets", "min", "max", "requires")} for f in v1["fields"]],
        "projection": {"entry_node": "ev", "instance_param": "instance_offset", "nodes": nodes, "edges": []},
        "notes": [], "details": [],
        "evidence": {"claims": [], "unknown": ["perfil sintetico: nenhum efeito medido, nenhum consumo observado"]},
        "limits": v1["limits"],
    }

def main():
    jump = json.loads((SPECS / "m68k.platformer_jump.v1.json").read_text(encoding="utf-8"))
    for path in sorted((SPECS / "fixtures").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        spec = doc.get("spec")
        if spec is None or spec.get("schema") == "rex-profile-spec/v2":
            continue
        if spec["id"] == jump["id"]:
            # variantes negativas do primeiro perfil: a MESMA mutacao aplicada ao dado v2
            new = copy.deepcopy(jump)
            for f, g in zip(new["fields"], spec["fields"]):
                f["min"], f["max"] = g["min"], g["max"]
            ids = [r["id"] for r in new["relations"]]
            for r in spec["relations"]:
                if r["id"] not in ids:
                    new["relations"].append(dict(r, tie="first") if r["kind"] != "subsumes" else r)
            doc["spec"] = new
            doc["expect"]["rule"] = "unsupported-shape" if doc["expect"].get("error") == "unsupported" else "domain-inverted"
        else:
            doc["spec"] = upgrade(spec)
        path.write_text(json.dumps(doc, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        print("convertido:", path.name)

main()
