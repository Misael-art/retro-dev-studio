#!/usr/bin/env python3
"""Gera fixtures do motor de perfis (F1): spec + ROM sintética em hex + resultado esperado POR CONSTRUCAO.
As expectativas vem das posicoes em que este script coloca os blocos, nao do motor Rust (oraculo independente).
Determinista (sem aleatoriedade). Uso: python3 -I make-engine-fixtures.py --set jump|synthetic --out <dir>"""
import argparse, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPECS = ROOT / "data/rex_profiles/specs"

def inst(src, vals):
    """Materializa um padrao; devolve (bytes, {captura: [offsets dentro do bloco]})."""
    out, pos = bytearray(), {}
    for tok in src.split():
        if tok.startswith("{"):
            name, n = tok[1:-1].split(":"); n = int(n)
            v = 0 if name == "_" else vals[name]
            if name != "_": pos.setdefault(name, []).append(len(out))
            out += v.to_bytes(4, "big")[4 - n:]
        else:
            out.append(int(tok, 16))
    return bytes(out), pos

def s16(x): return x - 0x10000 if x & 0x8000 else x

class Rom:
    def __init__(self, size=0x3000): self.b = bytearray(size)
    def put(self, at, blob):
        assert at % 2 == 0 and self.b[at:at+len(blob)] == bytes(len(blob)), hex(at)
        self.b[at:at+len(blob)] = blob
    def hex(self): return self.b.hex()

def field(name, value, offs): return {"name": name, "value": s16(value), "rom_offsets": offs}

def save(out, name, doc):
    (out / f"{name}.json").write_text(json.dumps(doc, indent=1, sort_keys=True) + "\n")

def jump_set(out):
    spec = json.loads((SPECS / "m68k.platformer_jump.v1.json").read_text())
    P = {p["id"]: p["sources"] for p in spec["patterns"]}
    V = dict(imp=0x0680, imps=0x0800, impw=0x0380, st=0x22, vx=0x10, vy=0x12, sup=0x0F00, ang=0x26,
             sin=0x29DA, flag=0x3C, held=0xF603, cut=0xFC00, cutw=0xFE00, cap=0xFA00)
    # 1) forma super pareada com altura e teto
    r = Rom()
    j, jp = inst(P["jump_super"][0], V); h, hp = inst(P["height"][0], V); c, cp = inst(P["cap"][0], V)
    A, H, C = 0x100, 0x200, 0x260
    r.put(A, j); r.put(H, h); r.put(C, c)
    save(out, "jump_super_pareada", {"name": "jump_super_pareada", "spec_file": "../m68k.platformer_jump.v1.json", "rom_hex": r.hex(),
      "expect": {"instances": [{"anchor_offset": A + 10, "anchor_is_outer": True,
        "links": {"pair_height": H, "follow_cap": C},
        "fields": [field("imp", V["imp"], [A + jp["imp"][0]]), field("imps", V["imps"], [A + jp["imps"][0]]),
                   field("impw", V["impw"], [A + jp["impw"][0]]), field("cut", V["cut"], [H + hp["cut"][0]]),
                   field("cutw", V["cutw"], [H + hp["cutw"][0]]), field("cap", V["cap"], [C + cp["cap"][0], C + 10])]}]},
      "edits": [
        {"instance": 0, "set": {"imp": 0x0900}, "expect": {"patch_offsets": [A + jp["imp"][0]]}},
        {"instance": 0, "set": {"cut": -1536, "cap": -2048}, "expect": {"patch_offsets": [H + hp["cut"][0], C + cp["cap"][0], C + 10]}},
        {"instance": 0, "set": {"imp": 0x0680}, "expect": {"error": "NoChange"}},
        {"instance": 0, "set": {"imp": 0}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"cut": 5}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"nao_existe": 5}, "expect": {"error": "FieldUnavailable"}}]})
    # 2) forma simples, altura de desvio de palavra, sem teto
    r = Rom()
    j, jp = inst(P["jump"][0], V); h, hp = inst(P["height"][1], V)
    A, H = 0x180, 0x240
    r.put(A, j); r.put(H, h)
    save(out, "jump_simples_sem_teto", {"name": "jump_simples_sem_teto", "spec_file": "../m68k.platformer_jump.v1.json", "rom_hex": r.hex(),
      "expect": {"instances": [{"anchor_offset": A, "anchor_is_outer": False, "links": {"pair_height": H},
        "fields": [field("imp", V["imp"], [A + jp["imp"][0]]), field("impw", V["impw"], [A + jp["impw"][0]]),
                   field("cut", V["cut"], [H + hp["cut"][0]]), field("cutw", V["cutw"], [H + hp["cutw"][0]])]}]},
      "edits": []})
    # 3) altura de outro objeto (st diferente): nao pareia
    r = Rom()
    j, jp = inst(P["jump"][0], V); V2 = dict(V, st=0x44); h, hp = inst(P["height"][0], V2)
    A, H = 0x100, 0x200
    r.put(A, j); r.put(H, h)
    save(out, "jump_altura_inconsistente", {"name": "jump_altura_inconsistente", "spec_file": "../m68k.platformer_jump.v1.json", "rom_hex": r.hex(),
      "expect": {"instances": [{"anchor_offset": A, "anchor_is_outer": False, "links": {},
        "fields": [field("imp", V["imp"], [A + jp["imp"][0]]), field("impw", V["impw"], [A + jp["impw"][0]])]}]}, "edits": []})
    # 4) sem instancia
    save(out, "rom_sem_instancia", {"name": "rom_sem_instancia", "spec_file": "../m68k.platformer_jump.v1.json", "rom_hex": Rom(0x400).hex(),
      "expect": {"instances": []}, "edits": []})
    # 5) specs recusadas
    bad = json.loads(json.dumps(spec)); bad["fields"][0]["min"], bad["fields"][0]["max"] = 10, 5
    save(out, "spec_dominio_invertido", {"name": "spec_dominio_invertido", "spec": bad, "rom_hex": "00" * 64, "expect": {"error": "spec"}, "edits": []})
    two = json.loads(json.dumps(spec)); two["relations"].append(dict(two["relations"][1], id="pair_outro"))
    save(out, "spec_forma_nao_suportada", {"name": "spec_forma_nao_suportada", "spec": two, "rom_hex": "00" * 64, "expect": {"error": "unsupported"}, "edits": []})

def synthetic_set(out):
    spec = {"schema": "rex-profile-spec/v1", "id": "m68k.synthetic_gate.v1", "status": "draft", "arch": "m68k",
      "summary": "Perfil SINTETICO (autoral) da mesma classe do pulo, com outros padroes, nomes e dominios: prova que o motor nao conhece o pulo.",
      "evidence_ceiling": "L2",
      "patterns": [
        {"id": "gate_a", "sources": ["30 3C {lim:2} 0C 6E {mode:2} {obj:2} 66 04 30 3C {lim2:2}"]},
        {"id": "gate_b", "sources": ["4A 2E {flag:2} 67 {_:1} 32 3C {low:2} B2 6E {obj:2} 6F {_:1}"]},
        {"id": "gate_c", "sources": ["0C 6E {top:2} {obj:2} 6C 06 3D 7C {top:2} {obj:2}"]}],
      "relations": [
        {"kind": "pair", "id": "pair_b", "from": ["gate_a"], "to": "gate_b", "consistent_on": ["obj"], "max_distance": 8192, "mutual": True},
        {"kind": "follow", "id": "follow_c", "from": "gate_b", "to": "gate_c", "consistent_on": ["obj"], "max_distance": 128}],
      "fields": [
        {"name": "lim", "label": "Limite principal", "patterns": ["gate_a"], "capture": "lim", "extra_offsets": [], "kind": "imm16_signed", "min": 1, "max": 1000, "requires": None, "evidence": "L2", "measured_values": []},
        {"name": "lim2", "label": "Limite alternativo", "patterns": ["gate_a"], "capture": "lim2", "extra_offsets": [], "kind": "imm16_signed", "min": 1, "max": 1000, "requires": None, "evidence": "L2", "measured_values": []},
        {"name": "low", "label": "Piso", "patterns": ["gate_b"], "capture": "low", "extra_offsets": [], "kind": "imm16_signed", "min": -500, "max": -1, "requires": "pair_b", "evidence": "L2", "measured_values": []},
        {"name": "top", "label": "Teto", "patterns": ["gate_c"], "capture": "top", "extra_offsets": [10], "kind": "imm16_signed", "min": -500, "max": -1, "requires": "follow_c", "evidence": "L2", "measured_values": []}],
      "limits": ["perfil sintetico autoral: nao descreve nenhum jogo; so forma e consistencia (L2)"]}
    def build(blocks, _unused=None):
        r = Rom(); res = []
        for kind, at, V in blocks:
            b, p = inst(spec["patterns"][{"a": 0, "b": 1, "c": 2}[kind]]["sources"][0], V)
            r.put(at, b); res.append((kind, at, p, V))
        return r, res
    Va = lambda o, lim=300, lim2=200: dict(lim=lim, mode=0x10, obj=o, lim2=lim2)
    Vb = lambda o, low=0xFF38: dict(flag=0x3C, low=low, obj=o)
    Vc = lambda o, top=0xFF9C: dict(top=top, obj=o)
    # 1) duas instancias; a 1a com seguimento, a 2a so com par
    r, x = build([("a", 0x100, Va(0x24)), ("b", 0x140, Vb(0x24)), ("c", 0x170, Vc(0x24)),
                  ("a", 0x400, Va(0x30, 100, 50)), ("b", 0x440, Vb(0x30, 0xFF06))], None)
    (_, a1, pa1, _), (_, b1, pb1, _), (_, c1, pc1, _), (_, a2, pa2, _), (_, b2, pb2, _) = x
    save(out, "sintetico_duas_instancias", {"name": "sintetico_duas_instancias", "spec": spec, "rom_hex": r.hex(),
      "expect": {"instances": [
        {"anchor_offset": a1, "anchor_is_outer": False, "links": {"pair_b": b1, "follow_c": c1},
         "fields": [field("lim", 300, [a1 + pa1["lim"][0]]), field("lim2", 200, [a1 + pa1["lim2"][0]]),
                    field("low", 0xFF38, [b1 + pb1["low"][0]]), field("top", 0xFF9C, [c1 + pc1["top"][0], c1 + 10])]},
        {"anchor_offset": a2, "anchor_is_outer": False, "links": {"pair_b": b2},
         "fields": [field("lim", 100, [a2 + pa2["lim"][0]]), field("lim2", 50, [a2 + pa2["lim2"][0]]),
                    field("low", 0xFF06, [b2 + pb2["low"][0]])]}]},
      "edits": [
        {"instance": 0, "set": {"lim": 999}, "expect": {"patch_offsets": [a1 + pa1["lim"][0]]}},
        {"instance": 0, "set": {"top": -10, "low": -20}, "expect": {"patch_offsets": [b1 + pb1["low"][0], c1 + pc1["top"][0], c1 + 10]}},
        {"instance": 1, "set": {"top": -10}, "expect": {"error": "FieldUnavailable"}},
        {"instance": 1, "set": {"lim": 1001}, "expect": {"error": "OutOfRange"}},
        {"instance": 1, "set": {"lim": 100}, "expect": {"error": "NoChange"}}]})
    # 2) objeto diferente: nao pareia
    r, x = build([("a", 0x100, Va(0x24)), ("b", 0x140, Vb(0x25))], None)
    (_, a1, pa1, _), _ = x
    save(out, "sintetico_objeto_diferente", {"name": "sintetico_objeto_diferente", "spec": spec, "rom_hex": r.hex(),
      "expect": {"instances": [{"anchor_offset": a1, "anchor_is_outer": False, "links": {},
        "fields": [field("lim", 300, [a1 + pa1["lim"][0]]), field("lim2", 200, [a1 + pa1["lim2"][0]])]}]}, "edits": []})
    # 3) disputa: duas ancoras, uma alvo; so a mais proxima pareia (mutuo)
    r, x = build([("a", 0x100, Va(0x24, 111, 11)), ("a", 0x120, Va(0x24, 222, 22)), ("b", 0x150, Vb(0x24))], None)
    (_, a1, pa1, _), (_, a2, pa2, _), (_, b1, pb1, _) = x
    save(out, "sintetico_disputa", {"name": "sintetico_disputa", "spec": spec, "rom_hex": r.hex(),
      "expect": {"instances": [
        {"anchor_offset": a1, "anchor_is_outer": False, "links": {},
         "fields": [field("lim", 111, [a1 + pa1["lim"][0]]), field("lim2", 11, [a1 + pa1["lim2"][0]])]},
        {"anchor_offset": a2, "anchor_is_outer": False, "links": {"pair_b": b1},
         "fields": [field("lim", 222, [a2 + pa2["lim"][0]]), field("lim2", 22, [a2 + pa2["lim2"][0]]), field("low", 0xFF38, [b1 + pb1["low"][0]])]}]},
      "edits": []})
    # 4) alvo longe demais da ancora
    r, x = build([("a", 0x100, Va(0x24)), ("b", 0x100 + 8192 + 0x40, Vb(0x24))], None)
    (_, a1, pa1, _), _ = x
    save(out, "sintetico_alvo_longe", {"name": "sintetico_alvo_longe", "spec": spec, "rom_hex": r.hex(),
      "expect": {"instances": [{"anchor_offset": a1, "anchor_is_outer": False, "links": {},
        "fields": [field("lim", 300, [a1 + pa1["lim"][0]]), field("lim2", 200, [a1 + pa1["lim2"][0]])]}]}, "edits": []})

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--set", required=True, choices=["jump", "synthetic"]); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    {"jump": jump_set, "synthetic": synthetic_set}[a.set](out)
