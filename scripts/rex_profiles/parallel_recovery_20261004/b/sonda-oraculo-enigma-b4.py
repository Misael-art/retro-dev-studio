#!/usr/bin/env python3
"""Ronda B4 — sonda de DERIVACAO de expectativas (antes de qualquer codigo Rust).

Mede apenas referencias externas pinadas:
  - decoder de pesquisa a9ed92f9... (RESEARCH ONLY; nunca entra no produto;
    aqui e usado como fonte de numeros congelados p/ as expectativas E23+);
  - ROM pin c7da53a1... (somente leitura);
  - fixtures enicmp corpus-B (SHA regravados nesta sonda).

Nao implementa o decoder do produto. Nao toca crates/, IPC, UI nem registry.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import pathlib
import sys

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parents[3]  # ate a raiz da worktree
EVID = RAIZ / "data/rex_profiles/parallel_recovery_20261004/b/evidencia"

DECODER_CAMINHO = pathlib.Path("/home/misael/RDS-REX-CORPUS-B/scripts/rex_corpus_b/enigma_research.py")
DECODER_SHA = "a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2"
ROM_CAMINHO = pathlib.Path.home() / "emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin"
ROM_SHA = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
FIXDIR = pathlib.Path("/home/misael/RDS-REX-CORPUS-B/data/rex_corpus_b/vendor/data/rex_profiles/codec/enigma")


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def run(cmd):
    import subprocess
    return subprocess.run(cmd, capture_output=True, text=True)


def carregar_decoder():
    actual = sha(DECODER_CAMINHO.read_bytes())
    if actual != DECODER_SHA:
        sys.exit(f"RECUSA: decoder pinnado mudou de SHA ({actual[:12]} != {DECODER_SHA[:12]})")
    espec = importlib.util.spec_from_file_location("enigma_research_pin", DECODER_CAMINHO)
    mod = importlib.util.module_from_spec(espec)
    espec.loader.exec_module(mod)
    return mod


def carregar_rom():
    rom = ROM_CAMINHO.read_bytes()
    if sha(rom) != ROM_SHA:
        sys.exit("RECUSA: ROM nao confere com o pinnado")
    return rom


def main() -> int:
    mod = carregar_decoder()
    rom = carregar_rom()
    cadeia = json.loads((EVID / "cadeia-sonic-verificada.json").read_text())
    streams = cadeia["streams"]

    resultado = {
        "schema": "rex-parallel-b/sonda-oraculo-enigma-b4/1",
        "proposito": "derivacao de expectativas E23+ ANTES da implementacao Rust; "
                     "mede referencias externas pinadas apenas",
        "pins": {"decoder_sha256": DECODER_SHA, "rom_sha256": ROM_SHA,
                 "fixtures_dir": str(FIXDIR)},
        "streams_ss": [], "fixtures_plain": [], "negativos": [],
    }

    # ------------------------------------------------------ seis streams reais
    for s in streams:
        off = int(s["offset"], 16)
        stats = {}
        dados, consumido = mod.decode(rom[off:], stats=stats)
        bits = stats["bits_used"]
        exato = 6 + (bits + 7) // 8
        arred = stats["bytes_consumed_word_rounded"]
        resultado["streams_ss"].append({
            "indice": s["indice"], "offset": s["offset"],
            "saida_len": len(dados), "saida_sha256": sha(dados),
            "sha_coincide_pinnado": sha(dados) == s["output_sha256"],
            "bytes_consumidos_pinnado": s["bytes_consumidos"],
            "span_exato_sonda": exato,
            "span_exato_coincide_pinnado": exato == s["bytes_consumidos"],
            "span_arredondado_palavra": arred,
            "padding": arred - exato,
            "stats": {k: stats[k] for k in sorted(stats)},
        })

    # ------------------------------------------------------ pares plain (eni->bin)
    par = lambda nome: (FIXDIR / f"plain/{nome}.eni", FIXDIR / f"plain/{nome}.bin")
    for nome in ["alternating_runs", "big_deltas", "const_500", "empty", "noise_1k",
                 "planes_4k", "ramp_signed", "single_word", "threshold_edge", "zeros_64"]:
        eni, binf = par(nome)
        stream, esperado = eni.read_bytes(), binf.read_bytes()
        entrada = {"nome": nome, "eni_bytes": len(stream),
                   "eni_sha256": sha(stream), "bin_sha256": sha(esperado),
                   "header": [f"0x{b:02x}" for b in stream[:6]] if len(stream) >= 6 else None}
        try:
            stats = {}
            dados, consumido = mod.decode(stream, stats=stats)
            bits = stats["bits_used"]
            entrada.update({
                "veredito": "OK", "saida_len": len(dados),
                "saida_coincide_bin": dados == esperado,
                "span_exato": 6 + (bits + 7) // 8,
                "span_arredondado": stats["bytes_consumed_word_rounded"],
                "padding": stats["bytes_consumed_word_rounded"] - (6 + (bits + 7) // 8),
                "eni_maior_que_span": len(stream) > 6 + (bits + 7) // 8,
                "stats": {k: stats[k] for k in sorted(stats)},
            })
        except mod.CodecError as e:
            entrada.update({"veredito": f"ERRO:{e.code}", "mensagem": str(e)[:160]})
        resultado["fixtures_plain"].append(entrada)

    # ------------------------------------------------------ negativos e01..e07
    for nome in ["e01_odd_bytes_tail.bin", "e02_truncated_last_byte.eni",
                 "e03_len_inflated.eni", "e04_mode_02.eni", "e05_empty_stream.eni",
                 "e06_garbage_ff_255b.eni", "e07_planes_4k.eni"]:
        p = FIXDIR / "negative" / nome
        stream = p.read_bytes()
        entrada = {"arquivo": nome, "bytes": len(stream), "sha256": sha(stream)}
        kwargs = {}
        if nome.startswith("e07"):
            kwargs["max_out"] = 1024
        try:
            stats = {}
            dados, consumido = mod.decode(stream, stats=stats, **kwargs)
            entrada.update({"veredito_oraculo": "ACEITA", "saida_len": len(dados),
                            "saida_sha256": sha(dados),
                            "span_exato": 6 + (stats["bits_used"] + 7) // 8,
                            "stats": {k: stats[k] for k in sorted(stats)}})
        except mod.CodecError as e:
            entrada.update({"veredito_oraculo": f"ERRO:{e.code}", "mensagem": str(e)[:160]})
        resultado["negativos"].append(entrada)

    # julgamento e04: sem tokens inline/delta, a máscara nunca lê bits de flags
    const = next(f for f in resultado["fixtures_plain"] if f["nome"] == "const_500")
    e04 = next(n for n in resultado["negativos"] if n["arquivo"].startswith("e04"))
    tem_inline = any(k in const.get("stats", {}) for k in ("inline", "delta-run-mode0",
                                                           "delta-run-mode1", "delta-run-mode2"))
    resultado["julgamento_e04"] = {
        "const_500_possui_tokens_inline_ou_delta": tem_inline,
        "e04_saida_sha_igual_ao_plain": (e04.get("saida_sha256") == const.get("saida_sha256"))
                                        if "saida_sha256" in e04 else None,
        "leitura": "se nao ha tokens que consumam bits de flags, mudar o byte de mascara "
                   "e comportamento CORRETO do console (ambos ignoram a mascara); "
                   "a classificacao como defeito do oracle exige cautela",
    }

    saida = EVID / "enigma-oraculo-b4.json"
    saida.write_text(json.dumps(resultado, ensure_ascii=False, indent=1) + "\n")
    n_ok = sum(1 for x in resultado["streams_ss"] if x["sha_coincide_pinnado"])
    print(f"streams SS: {n_ok}/6 sha-ok; spans exatos conferem: "
          f"{sum(1 for x in resultado['streams_ss'] if x['span_exato_coincide_pinnado'])}/6")
    print(f"fixtures plain: " + " ".join(
        f"{f['nome']}={f['veredito']}" for f in resultado["fixtures_plain"]))
    print(f"evidencia: {saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
