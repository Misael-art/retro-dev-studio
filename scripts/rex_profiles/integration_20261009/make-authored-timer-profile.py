#!/usr/bin/env python3
"""Segundo perfil AUTORAL da mesma classe (so dado) + ROM sintetica + roteiro de jornada + fixture do motor.

Nada aqui descreve um jogo: a "rotina" foi escrita para este teste. A amostra NAO e cega: quem escreveu o
perfil escreveu a ROM e conhece as respostas. O que ela demonstra e que o motor nao precisa de codigo novo
para um perfil que varia padroes, capturas, larguras/sinal dos campos, posicoes, restricoes, regra de empate,
vinculo com a ROM e mapeamento arquivo<->barramento.

Diferencas em relacao ao primeiro perfil (m68k.platformer_jump.v1):
  campos de 1, 2 e 4 bytes, com e sem sinal (la: so imm16 com sinal);
  restricoes range / distinct / multiple_of (la: nenhuma);
  empate `refuse` (la: `first`); vinculo por SHA-256 (la: assinatura);
  cabecalho de 512 bytes no arquivo, logo offset de arquivo != endereco de barramento (la: iguais);
  campo repetido de 4 bytes; forma `outer` com campo exclusivo e captura de endereco absoluto longo.

Determinista. Uso: python3 -I scripts/rex_profiles/integration_20261009/make-authored-timer-profile.py"""
import hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/rex_profiles/authoring/timer_gate"
PID = "m68k.authored_timer_gate.v1"
TITLE = "Temporizador autoral (sintético)"
HEADER = 512

ARM = "11 7C 00 {dur:1} {tmr:2} 21 7C {score:4} {acc:2}"
ARM_EXT = "4A 39 {gate:4} 67 0E " + ARM + " 31 7C {bonus:2} {aux:2}"
TICK_S = "53 28 {tmr:2} 66 {_:1} 0C 68 {lim:2} {cnt:2} 6D {_:1}"
TICK_W = "53 28 {tmr:2} 66 00 {_:2} 0C 68 {lim:2} {cnt:2} 6D {_:1}"
RESET = "42 68 {cnt:2} 20 3C {step:4} 0C 80 {step:4}"


def build(source, vals, wild=b"\x06"):
    """Materializa um padrao: capturas com os valores dados (big-endian); curingas com `wild` repetido."""
    out = bytearray()
    for tok in source.split():
        if tok.startswith("{"):
            name, n = tok[1:-1].split(":")
            n = int(n)
            out += (wild * n)[:n] if name == "_" else (vals[name] & ((1 << (8 * n)) - 1)).to_bytes(n, "big")
        else:
            out.append(int(tok, 16))
    return bytes(out)


def offset_of(source, name, nth=0):
    """Offset, dentro do padrao, da n-esima ocorrencia da captura `name`."""
    pos, seen = 0, 0
    for tok in source.split():
        if tok.startswith("{"):
            cap, n = tok[1:-1].split(":")
            if cap == name:
                if seen == nth:
                    return pos
                seen += 1
            pos += int(n)
        else:
            pos += 1
    raise KeyError(name)


def rom():
    # enchimento deterministico com o bit alto ligado: nenhum padrao (todos comecam por opcode < 0x80) casa nele
    data = bytearray(((i * 13 + 7) & 0x7F) | 0x80 for i in range(4096))
    data[0:16] = b"AUTORAL-HEADER\x00\x00"  # "cabecalho de copiador" autoral: 512 bytes antes do que a CPU ve

    def put(at, blob):
        assert at % 2 == 0 and at >= HEADER
        data[at:at + len(blob)] = blob

    # instancia 1: forma simples, pareada com o tique curto e seguida do reinicio
    put(0x400, build(ARM, dict(dur=30, tmr=0x2A, score=5000, acc=0x30)))
    put(0x440, build(TICK_S, dict(tmr=0x2A, lim=600, cnt=0x34)))
    put(0x460, build(RESET, dict(cnt=0x34, step=-250)))
    # instancia 2: forma com portao (outer), pareada com o tique de desvio longo, sem reinicio
    put(0x800, build(ARM_EXT, dict(gate=0x00FF8010, dur=12, tmr=0x1C, score=123456, acc=0x20, bonus=40000, aux=0x24)))
    put(0x840, build(TICK_W, dict(tmr=0x1C, lim=59999, cnt=0x26), wild=b"\x00\x08"))
    # instancia 3: dois tiques consistentes a MESMA distancia (um antes, um depois): ambiguidade
    put(0xBC0, build(TICK_S, dict(tmr=0x10, lim=111, cnt=0x14)))
    put(0xC00, build(ARM, dict(dur=200, tmr=0x10, score=1, acc=0x12)))
    put(0xC40, build(TICK_S, dict(tmr=0x10, lim=222, cnt=0x16)))
    # tres ocorrencias com a forma certa que as restricoes descartam
    put(0xE00, build(ARM, dict(dur=9, tmr=0x90, score=9, acc=0x30)))   # tmr fora de 0..127
    put(0xE40, build(ARM, dict(dur=9, tmr=0x22, score=9, acc=0x31)))   # acc impar
    put(0xE80, build(ARM, dict(dur=9, tmr=0x20, score=9, acc=0x20)))   # tmr == acc
    return bytes(data)


def profile(rom_sha):
    L = lambda t, when=None: {"p": "lit", "t": t, **({"when": when} if when else {})}
    C = lambda n, of, fmt="hex": {"p": "capture", "name": n, "of": of, "fmt": fmt}
    O = lambda of, fmt="hex": {"p": "offset", "of": of, "fmt": fmt}
    link = lambda i: {"if": "link", "id": i}
    nolink = lambda i: {"if": "no_link", "id": i}
    fld = lambda n: {"if": "field", "name": n}
    anchor = lambda i: {"if": "anchor_pattern", "id": i}
    cap = lambda n, w, s, role: {"name": n, "width": w, "signed": s, "endianness": "big", "role": role}

    def field(name, label, pats, lo, hi, req=None, extra=None):
        return {"name": name, "label": label, "patterns": pats, "capture": name, "extra_offsets": extra or [], "min": lo, "max": hi, "requires": req}

    def fnode(i, label, col, row, name, var, desc, when=None, span=None):
        n = {"id": i, "type": "var_set", "label": label, "col": col, "row": row,
             "field": {"name": name, "var_name": var, "description": desc}}
        if when:
            n["when"] = when
        if span:
            n["rom_span"] = span
        return n

    E = lambda a, ap, b, bp, when=None: {"from": [a, ap], "to": [b, bp], **({"when": when} if when else {})}
    P, F = "p_tick", "f_reset"
    return {
        "schema": "rex-profile-spec/v2", "id": PID, "revision": 1, "status": "draft",
        "title": TITLE,
        "summary": "Perfil AUTORAL de teste: arma um temporizador de 8 bits e um acumulador de 32 bits, com um tique que compara um contador a um limite e um reinício com passo de 32 bits. Não descreve nenhum jogo.",
        "artifact_tag": "timer",
        "arch": {"cpu": "m68k", "endianness": "big", "instruction_alignment": 2, "bus_address_bits": 24},
        "rom_mapping": {"kind": "linear", "file_header_bytes": HEADER, "bus_base": 0},
        "provenance": {"author": "RetroDev Studio - integrador REX (perfil autoral de teste)", "created": "2026-10-09",
                       "derived_from": ["scripts/rex_profiles/integration_20261009/make-authored-timer-profile.py"],
                       "notes": "Amostra NAO cega: perfil e ROM sintetica foram escritos pela mesma sessao."},
        "rom_binding": {"mode": "sha256", "sha256": [rom_sha]},
        "work_limits": {"max_rom_bytes": 65536, "max_matches_per_pattern": 16, "max_instances": 8},
        "captures": [cap("dur", 1, False, "immediate"), cap("score", 4, False, "immediate"), cap("bonus", 2, False, "immediate"),
                     cap("lim", 2, False, "immediate"), cap("step", 4, True, "immediate"),
                     cap("tmr", 2, True, "ea_displacement"), cap("acc", 2, True, "ea_displacement"), cap("aux", 2, True, "ea_displacement"),
                     cap("cnt", 2, True, "ea_displacement"), cap("gate", 4, False, "bus_address")],
        "patterns": [{"id": "arm", "sources": [ARM]}, {"id": "arm_ext", "sources": [ARM_EXT]},
                     {"id": "tick", "sources": [TICK_S, TICK_W]}, {"id": "reset", "sources": [RESET]}],
        "constraints": [
            {"kind": "range", "id": "tmr_curto", "pattern": "arm", "capture": "tmr", "min": 0, "max": 127},
            {"kind": "range", "id": "tmr_curto_ext", "pattern": "arm_ext", "capture": "tmr", "min": 0, "max": 127},
            {"kind": "multiple_of", "id": "acc_alinhado", "pattern": "arm", "capture": "acc", "modulo": 2},
            {"kind": "distinct", "id": "tmr_nao_e_acc", "pattern": "arm", "a": "tmr", "b": "acc"},
        ],
        "relations": [
            {"kind": "subsumes", "id": "ext_contem_simples", "outer": "arm_ext", "inner": "arm", "prefix_len": 8},
            {"kind": "pair", "id": P, "from": ["arm", "arm_ext"], "to": "tick", "consistent_on": ["tmr"], "max_distance": 512, "mutual": True, "tie": "refuse"},
            {"kind": "follow", "id": F, "from": "tick", "to": "reset", "consistent_on": ["cnt"], "max_distance": 64, "tie": "refuse"},
        ],
        "fields": [
            field("dur", "Duração do temporizador", ["arm_ext", "arm"], 1, 255),
            field("score", "Valor somado ao acumulador", ["arm_ext", "arm"], 0, 999999),
            field("bonus", "Bônus da forma com portão", ["arm_ext"], 0, 65535),
            field("lim", "Limite do contador no tique", ["tick"], 1, 60000, P),
            field("step", "Passo do reinício", ["reset"], -100000, 100000, F, [offset_of(RESET, "step", 1)]),
        ],
        "projection": {"entry_node": "inicio", "instance_param": "timer_offset", "nodes": [
            {"id": "inicio", "type": "event_update", "label": "Armar o temporizador", "col": 0, "row": 0,
             "params": [{"key": "rate", "value": "frame"}], "rom_span": {"base": "instance", "delta": 0, "len": 6}},
            {"id": "portao", "type": "condition_compare", "label": "Portão aberto?", "col": 0, "row": 1, "when": [anchor("arm_ext")],
             "params": [{"key": "operator", "value": "!="}, {"key": "a", "value": "portao"}, {"key": "b", "value": 0},
                        {"key": "descricao", "text": [L("tst.b no endereço de barramento "), C("gate", "anchor", "hex6")]}]},
            fnode("n_dur", "Duração do temporizador", 1, 2, "dur", "duracao", "move.b #dur,tmr(a0)"),
            fnode("n_score", "Valor somado ao acumulador", 1, 3, "score", "valor", "move.l #score,acc(a0)"),
            fnode("n_bonus", "Bônus da forma com portão", 2, 3, "bonus", "bonus", "move.w #bonus,aux(a0)", when=[fld("bonus")]),
            {"id": "tique", "type": "event_update", "label": "Tique do temporizador", "col": 4, "row": 0, "when": [link(P)],
             "params": [{"key": "rate", "value": "frame"},
                        {"key": "descricao", "text": [L("subq.b #1 no campo +"), C("tmr", P), L("; contador em +"), C("cnt", P)]}],
             "rom_span": {"base": "link", "link": P, "delta": 0, "len": 4}},
            fnode("n_lim", "Limite do contador no tique", 4, 1, "lim", "limite", "cmpi.w #lim,cnt(a0)", when=[link(P), fld("lim")]),
            fnode("n_step", "Passo do reinício", 5, 1, "step", "passo", "move.l #step,d0 (repetido no cmpi.l)", when=[link(P), link(F), fld("step")],
                  span={"base": "link", "link": F, "delta": 0, "len": 16}),
        ], "edges": [
            E("inicio", "exec", "portao", "exec", [anchor("arm_ext")]),
            E("portao", "false", "n_dur", "exec", [anchor("arm_ext")]),
            E("inicio", "exec", "n_dur", "exec", [anchor("arm")]),
            E("n_dur", "exec", "n_score", "exec"),
            E("n_score", "exec", "n_bonus", "exec", [fld("bonus")]),
            E("tique", "exec", "n_lim", "exec", [link(P), fld("lim")]),
            E("n_lim", "exec", "n_step", "exec", [link(P), link(F), fld("step")]),
        ]},
        "notes": [
            {"text": [L("temporizador armado em "), O("instance"), L(" (forma com teste de portão)", [anchor("arm_ext")])]},
            {"when": [link(P)], "text": [L("tique em "), O(P), L(" (pareamento mútuo, mesmo campo de temporizador)")]},
            {"when": [link(P), link(F)], "text": [L("reinício em "), O(F)]},
            {"when": [link(P), nolink(F)], "text": [L("reinício não localizado: o campo de passo não é oferecido")]},
            {"when": [nolink(P)], "text": [L("tique não pareado de forma inequívoca: limite e passo NÃO são oferecidos")]},
        ],
        "details": [
            {"label": "temporizador", "text": [L("+"), C("tmr", "anchor", "hex_bare")]},
            {"label": "acumulador", "text": [L("+"), C("acc", "anchor", "hex_bare")]},
            {"label": "portão (barramento)", "when": [anchor("arm_ext")], "text": [C("gate", "anchor", "hex6")]},
        ],
        "evidence": {"claims": [], "unknown": [
            "nenhum efeito foi medido em execução: é um perfil sintético",
            "nenhuma ROM de jogo foi usada: a forma só foi vista na ROM sintética deste teste",
        ]},
        "limits": [
            "Perfil autoral de teste: prova que o motor lê um segundo perfil sem código novo, não que esta forma exista em algum jogo.",
            "Vinculado por SHA-256 à ROM sintética: em qualquer outra ROM o perfil não é tentado.",
        ],
    }


def main():
    blob = rom()
    rom_sha = hashlib.sha256(blob).hexdigest()
    spec = profile(rom_sha)
    (OUT / "profiles").mkdir(parents=True, exist_ok=True)
    (OUT / "rom-sintetica.bin").write_bytes(blob)
    spec_text = json.dumps(spec, indent=1, ensure_ascii=False) + "\n"
    (OUT / "profiles" / f"{PID}.json").write_text(spec_text, encoding="utf-8")

    lim_s, lim_w = offset_of(TICK_S, "lim"), offset_of(TICK_W, "lim")
    dur, score = offset_of(ARM, "dur"), offset_of(ARM, "score")
    s0, s1 = offset_of(RESET, "step", 0), offset_of(RESET, "step", 1)
    bonus = offset_of(ARM_EXT, "bonus")
    f = lambda name, value, offs: {"name": name, "value": value, "rom_offsets": offs}
    instances = [
        {"anchor_offset": 0x400, "anchor_is_outer": False, "links": {"p_tick": 0x440, "f_reset": 0x460},
         "fields": [f("dur", 30, [0x400 + dur]), f("score", 5000, [0x400 + score]), f("lim", 600, [0x440 + lim_s]), f("step", -250, [0x460 + s0, 0x460 + s1])]},
        {"anchor_offset": 0x808, "anchor_is_outer": True, "links": {"p_tick": 0x840},
         "fields": [f("dur", 12, [0x808 + dur]), f("score", 123456, [0x808 + score]), f("bonus", 40000, [0x800 + bonus]), f("lim", 59999, [0x840 + lim_w])]},
        {"anchor_offset": 0xC00, "anchor_is_outer": False, "links": {},
         "fields": [f("dur", 200, [0xC00 + dur]), f("score", 1, [0xC00 + score])]},
    ]
    edits = [
        {"instance": 0, "set": {"dur": 45}, "expect": {"patch_offsets": [0x400 + dur]}},
        {"instance": 0, "set": {"score": 999999, "lim": 60000, "step": -100000}, "expect": {"patch_offsets": [0x400 + score, 0x440 + lim_s, 0x460 + s0, 0x460 + s1]}},
        {"instance": 1, "set": {"bonus": 65535, "lim": 1234}, "expect": {"patch_offsets": [0x800 + bonus, 0x840 + lim_w]}},
        {"instance": 1, "set": {"step": 5}, "expect": {"error": "FieldUnavailable"}},
        {"instance": 2, "set": {"lim": 5}, "expect": {"error": "FieldUnavailable"}},
        {"instance": 2, "set": {"bonus": 5}, "expect": {"error": "FieldUnavailable"}},
        {"instance": 0, "set": {"dur": 256}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"dur": 0}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"score": 1000000}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"step": 100001}, "expect": {"error": "OutOfRange"}},
        {"instance": 0, "set": {"dur": 30}, "expect": {"error": "NoChange"}},
    ]
    fixture = {"name": "autoral_timer_gate", "spec": spec, "rom_hex": blob.hex(), "expect": {"instances": instances}, "edits": edits}
    (ROOT / "data/rex_profiles/specs/fixtures/autoral_timer_gate.json").write_text(
        json.dumps(fixture, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")

    rel = lambda p: p.relative_to(ROOT).as_posix()
    be32 = lambda v: struct.pack(">i", v).hex()
    journey = {
        "schema": "rex-profile-journey/v1",
        "rom": rel(OUT / "rom-sintetica.bin"), "rom_sha256": rom_sha,
        "profiles_dir": rel(OUT / "profiles"), "profile_id": PID, "profile_title": TITLE,
        "profile_sha256": hashlib.sha256(spec_text.encode()).hexdigest(),
        "expect": {"rejected_by_constraint": 3, "instances": [
            {"offset": 0x400, "bus_address": 0x400 - HEADER, "fields": {"dur": 30, "score": 5000, "lim": 600, "step": -250}, "absent_fields": ["bonus"]},
            {"offset": 0x808, "bus_address": 0x808 - HEADER, "fields": {"dur": 12, "score": 123456, "bonus": 40000, "lim": 59999}, "absent_fields": ["step"]},
            {"offset": 0xC00, "bus_address": 0xC00 - HEADER, "fields": {"dur": 200, "score": 1}, "absent_fields": ["bonus", "lim", "step"], "static_only_form": True, "ambiguous": True},
        ]},
        "negative": {"out_of_range": {"field": "dur", "value": 256, "restore": 30}},
        "form_edit": {"instance": 0x400, "set": {"dur": 45, "step": -100000},
                      "changed_offsets": [0x400 + dur] + [0x460 + s0 + i for i in range(4)] + [0x460 + s1 + i for i in range(4)],
                      "expect_bytes": [{"offset": 0x400 + dur, "hex": "2d"}, {"offset": 0x460 + s0, "hex": be32(-100000)}, {"offset": 0x460 + s1, "hex": be32(-100000)}]},
        "canvas_edit": {"instance": 0x808,
                        "expect_nodes": ["inicio", "portao", "n_dur", "n_score", "n_bonus", "tique", "n_lim"], "absent_nodes": ["n_step"],
                        "set_nodes": [{"node": "n_bonus", "value": 65535, "original": 40000}, {"node": "n_lim", "value": 1234, "original": 59999}],
                        "changed_offsets": [0x800 + bonus, 0x800 + bonus + 1, 0x840 + lim_w, 0x840 + lim_w + 1],
                        "expect_bytes": [{"offset": 0x800 + bonus, "hex": "ffff"}, {"offset": 0x840 + lim_w, "hex": "04d2"}]},
    }
    (OUT / "journey.json").write_text(json.dumps(journey, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"rom_sha256": rom_sha, "profile_sha256": journey["profile_sha256"], "rom_bytes": len(blob)}))


main()
