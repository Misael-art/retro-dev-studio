#!/usr/bin/env python3
"""Frente b (ADENDA-B2, E13 + E17): export estruturado por camadas + avaliacao D.

E13: junta as evidencias ja produzidas em cinco camadas separadas, cada
afirmacao rotulada por nivel (candidato / referencia-estatica /
vinculo-estrutural / codigo-presente / equivalencia-estatica-com-pin).
Nenhuma camada promove automaticamente a camada seguinte.

E17: probe de ligacao de ARTE da cadeia ID $01: procura na ROM a tabela
PLC_SpecialStage montada por predicao a partir das macros pinadas do s1disasm
(plcheader/plcm) e dos ArtTile_SS_* dos _Constants pinados, e exige ocorrencia
UNICA. A paleta (CRAM) so e afirmada se houver sitio pinado; sem sitio, o
campo permanece DESCONHECIDO com a referencia faltante publicada — nenhum
sprite colorido por aproximacao.

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/exportar-camadas-b2.py \
      --out-dir data/rex_profiles/parallel_recovery_20261004/b/evidencia
"""
from __future__ import annotations

import argparse
import datetime
import importlib.util
import json
import pathlib
import struct
import sys

HERE = pathlib.Path(__file__).resolve().parent


def _carregar(nome, caminho):
    spec = importlib.util.spec_from_file_location(nome, caminho)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CS = _carregar("contrato_sonic", HERE / "contrato_sonic.py")
MC = _carregar("medir_cadeia_mapping", HERE / "medir-cadeia-mapping.py")

EVID = "data/rex_profiles/parallel_recovery_20261004/b/evidencia"

# ---- E17: predicao da PLC_SpecialStage (derivada de macros + _Constants pinados) ----
# plcm macro: dc.l gfx ; dc.w (vram)*tile_size, tile_size=$20 (Macros pinadas L19-23)
# ordem dos cues: Special Stage Mappings/Pattern Load Cues L313-333
ART_TILES_SS = [0x000, 0x051, 0x142, 0x23B, 0x251, 0x263, 0x2F0, 0x370, 0x3F0,
                0x470, 0x4F0, 0x570, 0x5F0, 0x770, 0x797, 0x7A0, 0x7A9]
NOMES_CUES = ["Nem_SSBgCloud", "Nem_SSBgFish", "Nem_SSWalls", "Nem_Bumper",
              "Nem_SSGOAL", "Nem_SSUpDown", "Nem_SSRBlock", "Nem_SS1UpBlock",
              "Nem_SSEmStars", "Nem_SSRedWhite", "Nem_SSGhost", "Nem_SSWBlock",
              "Nem_SSGlass", "Nem_SSEmerald", "Nem_SSZone1", "Nem_SSZone2",
              "Nem_SSZone3"]
WALLS_IDX = 2  # entrada da cadeia ID $01


def probe_plc(rom):
    words = [(t * 0x20) & 0xFFFF for t in ART_TILES_SS]
    n = len(words)
    ocorrencias = []
    for p in range(0, len(rom) - 2 - n * 6):
        if struct.unpack(">H", rom[p:p + 2])[0] != n - 1:
            continue
        ok = True
        for i in range(n):
            o = p + 2 + i * 6
            lon = struct.unpack(">I", rom[o:o + 4])[0]
            w = struct.unpack(">H", rom[o + 4:o + 6])[0]
            if not (0x200 <= lon < len(rom)) or w != words[i]:
                ok = False
                break
        if ok:
            ocorrencias.append(p)
    doc = {"predicao": "plcheader word=%d + %d entradas (dc.l ponteiro ROM; dc.w "
                       "ArtTile*$20) — derivada das macros pinadas, nao da ROM"
                       % (n - 1, n),
           "ocorrencias": [hex(o) for o in ocorrencias], "unica": len(ocorrencias) == 1}
    if len(ocorrencias) != 1:
        doc["veredito_parcial"] = "INCONCLUSIVE-probe-plc (0 ou >1 ocorrencias)"
        return doc
    base = ocorrencias[0]
    entradas = []
    for i in range(n):
        o = base + 2 + i * 6
        lon = struct.unpack(">I", rom[o:o + 4])[0]
        w = struct.unpack(">H", rom[o + 4:o + 6])[0]
        entradas.append({"cue": NOMES_CUES[i], "art_offset": hex(lon),
                         "vram_word": hex(w), "art_tile": hex(w // 0x20),
                         "raw6": rom[o:o + 6].hex()})
    walls = entradas[WALLS_IDX]
    stream = int(walls["art_offset"], 16)
    cab = rom[stream:stream + 2]
    doc["tabela_addr"] = hex(base)
    doc["entradas"] = entradas
    doc["walls"] = {
        **walls,
        "header_nemesis_word0": hex(struct.unpack(">H", cab)[0]),
        "xor_flag_bit15": bool(struct.unpack(">H", cab)[0] & 0x8000),
        "consistencia_cadeia": {
            "slot_id01_word": "0x0142", "art_tile_base": "0x142",
            "vram_byte_addr": hex(0x142 * 0x20),
            "nota": "word do slot (0x1B720 move.w) == ArtTile_SS_Wall; o PLC "
                    "ancora o MESMO base em VRAM ($2840) — elo arte-consumidor "
                    "por estrutura; mapa .straight usa tile 0 => VRAM $2840+0",
        },
    }
    doc["veredito_parcial"] = "PLC-ENCONTRADA-OCORRENCIA-UNICA"
    return doc


def _sha_file(p):
    import hashlib
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--rom", default=CS.ROM_PADRAO)
    ap.add_argument("--out-dir", default=EVID)
    a = ap.parse_args(argv)

    rom = CS.carregar_rom(a.rom)
    out_dir = pathlib.Path(a.out_dir)
    if not (out_dir.resolve() == CS.ROOT or out_dir.resolve().is_relative_to(CS.ROOT)):
        raise CS.RecusaErro("caminho", f"--out-dir fora da arvore: {a.out_dir}")

    fontes = {}
    for nome in ["cadeia-sonic-verificada.json", "isa-forms-b.json",
                 "controles-negativos-b2.json", "cadeia-mapping-b2.json",
                 "negativos.json", "fixture-assimetrica.json", "cram-b3.json"]:
        p = out_dir / nome
        if not p.exists():
            raise CS.RecusaErro("evidencia-ausente", f"falta {nome} para compor camadas")
        fontes[nome] = (json.loads(p.read_text()), _sha_file(p))

    cadeia = fontes["cadeia-sonic-verificada.json"][0]
    isa = fontes["isa-forms-b.json"][0]
    contro = fontes["controles-negativos-b2.json"][0]
    mapping = fontes["cadeia-mapping-b2.json"][0]
    cram = fontes["cram-b3.json"][0]
    e19c = cram["pins"].get("e19_blink", {})
    e20c = cram["pins"].get("e20_palcycle_ss", {})
    e21c = cram["pins"].get("e21", {})
    cram_ok = cram["veredito"].startswith("E18R/E19/E20/E21-OK")
    cram_resumo = {
        "veredito": cram["veredito"],
        "hipotese_ram_e18r": cram["e18r"].get("hipotese_escolhida"),
        "invariantes": cram["e18r"].get("invariantes"),
        "palload": e21c.get("palload_endereco"),
        "palload_fade": e21c.get("palload_fade_endereco"),
        "pal_index": e21c.get("pal_index_endereco"),
        "pal_index_ramaddys": {"line_1": e21c["entradas_20"][0]["ramaddr"],
                               "line_2": e21c["entradas_20"][4]["ramaddr"],
                               "entradas": len(e21c["entradas_20"])},
        "callsite_ss_setup": e21c.get("callsites_moveq10_bsrw"),
        "palcycle_ss": {"endereco": e20c.get("endereco"),
                        "campos_w": e20c.get("campos_w"),
                        "alvos_l": e20c.get("alvos_l"),
                        "cyc1_sha256": e20c.get("cyc1_sha256"),
                        "cyc2_sha256": e20c.get("cyc2_sha256")},
        "blink_ss": {"endereco": e19c.get("endereco"),
                     "campos_w": e19c.get("campos_w"),
                     "ss_wall_palettes_vram": e19c.get("ss_wall_palettes_vram"),
                     "tabela_sha256": e19c.get("tabela_sha256"),
                     "igual_predicao_sswallpal":
                         e19c.get("tabela_128b_igual_predicao_sswallpal")},
        "pal_special_sha256": e21c.get("checks", {}).get("pal_special_128b_sha"),
        "writecram_H_B": {k: v["ocorrencias"] for k, v in
                          e21c.get("writecram_por_hipotese", {}).get("H_B", {}).items()},
        "writecram_H_A_ocorrencias": {k: len(v["ocorrencias"]) for k, v in
                                      e21c.get("writecram_por_hipotese", {}).get("H_A", {}).items()},
        "limites": cram.get("limites"),
    }

    e17 = probe_plc(rom)

    camadas = {
        "schema_version": "rex-parallel-b/camadas/1",
        "gerado_por": "scripts/rex_profiles/parallel_recovery_20261004/b/exportar-camadas-b2.py",
        "expectativas": "E13/E17 (ADENDA-B2, 74fb2e2) + E18R-E22 (ADENDA-B3 a233e8d "
                        "e refreeze B3-1 ab72d90)",
        "tempo_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "promessa": "uma camada NAO promove automaticamente a seguinte; "
                    "rotulos de nivel sao por afirmacao",
        "fontes_sha256": {k: v[1] for k, v in fontes.items()},
        "camada_codec": {
            "nivel_por_afirmacao": {
                "six_streams": "equivalencia-estatica-contra-pin (PLAIN_SHA do review PR #97)",
                "value_offset_zero": "vinculo-estrutural (move.w #$0,D0 em 0x1B6CE)",
                "codec_enigma_variante_plain": "referencia-estatica + decoder pinado "
                                               "a9ed92f9.../SHA no doc",
            },
            "streams": cadeia["streams"],
            "decoder_sha256": cadeia["pins"]["decoder_sha256"],
        },
        "camada_interpretacao": {
            "nivel_por_afirmacao": {
                "modelo_antigo_2048_palavras_64x32_vdp": "SUPERSEDIDA-REFUTADA-pelos-bytes",
            },
            "refutacao": cadeia["refutacao_antiga"],
            "comportamento_modelo_antigo_nas_recusas": [
                {"negativo": c["negativo"], "modelo_antigo": c["modelo_antigo"]}
                for c in contro["casos"]],
        },
        "camada_projecao": {
            "nivel_por_afirmacao": {
                "grade_64x64_ids_1byte": "vinculo-estrutural (move.b 0x1B6F8 + padding 0x1B6FE)",
                "stride_128_base_ff1020": "vinculo-estrutural",
                "roundtrip": "equivalencia-estatica (fixture assimetrica + stream0)",
            },
            "amostra": cadeia["projecao_amostra"],
            "fixture_sha": fontes["fixture-assimetrica.json"][1],
        },
        "camada_consumidor": {
            "nivel_por_afirmacao": {
                "sitios_37": "codigo-presente-na-ROM (byte + ISA pinado, sem execucao)",
                "bloco_showlayout_0x1B242": "codigo-presente-na-ROM (ocorrencia unica)",
            },
            "sitios": {"total": isa["total"], "veredito": isa["veredito"],
                       "toolchain": isa["toolchain"]},
            "showlayout": mapping["consumidor"],
        },
        "camada_cadeia_id": {
            "nivel_por_afirmacao": {
                "slot_8k": "vinculo-estrutural (carregador pinado simulado)",
                "map_sswalls_128b": "equivalencia-estatica (predicao por macro vs ROM)",
                "leitura_ver1_pecas": "referencia-estatica (macros pinadas)",
                "art_plc_walls": ("vinculo-estrutural (PLC achada por predicao; VRAM "
                                  "word ancora o mesmo base $142)"
                                  if e17.get("unica") else "NAO-PROVADO"),
                "cram_paleta": ("vinculo-estrutural + equivalencia-estatica (E18R-E21: "
                                "PalLoad/PalLoad_Fade/Pal_Index/PalCycle_SS/blink/writeCRAM "
                                "pinados por sitio unico, hipotese RAM H_B; bins confirmados "
                                "por SHA; consumo observado NAO PROVADO — E22)"
                                if cram_ok else
                                "DESCONHECIDA (medida B3 nao concluiu; ver cram_e18r_b3.veredito)"),
            },
            "slot": mapping["slot"],
            "estrutura_mapping": mapping["estrutura"],
            "e17_plc": e17,
            "cram_e18r_b3": cram_resumo,
            "referencia_faltante": {
                "cram_paleta": ("RESOLVIDA-ESTATICO na rodada B3 (E18R-E21, hipotese RAM H_B, "
                                "sitos unicos pinados; ver cram_e18r_b3). Permanece faltante: "
                                "'consumo observado' (CRAM escrito em execucao) — NAO PROVADO (E22)"),
                "nemesis_loader": "NemDec (0x... nao pinado): arte declarada pela PLC mas "
                                  "sem sítio de descarga pinado — candidato, nao consumo",
            },
        },
        "meta_integrador_antireuso": {
            "nao_reusar": [
                {"artefato": "sonic1-mapa-*.json (frente B antiga, RDS-REX-CORPUS-B)",
                 "motivo": "SUPERSEDADOS: interpretavam 2048 palavras VDP; ver ADENDA-SUPERSEDENTE A1-A3"},
                {"artefato": "compositor antigo (porta VDP $C00004)",
                 "motivo": "REFUTADO pelos bytes do consumidor (lea $FF4000, WRAM)"},
            ],
            "reproduzir_com": [
                "verificar-cadeia.py cadeia|negativos|controles",
                "montar-isa.py (sem ROM)",
                "medir-cadeia-mapping.py",
                "medir-cram-b3.py (+ calc-enderecos-ram-b3.py, derivacao de referencia)",
                "exportar-camadas-b2.py",
            ],
        },
    }
    falhas = []
    if not contro["veredito"].startswith("CONTROLES-COMPLETOS"):
        falhas.append("E12")
    if mapping["veredito"] != "CADEIA-MAPPING-E14-E16-OK":
        falhas.append("E14-E16")
    if not e17.get("unica"):
        falhas.append("E17-probe")
    if not cram_ok:
        falhas.append("E18R-E21")

    d_doc = {
        "schema_version": "rex-parallel-b/avaliacao-d/1",
        "gerado_por": "scripts/rex_profiles/parallel_recovery_20261004/b/exportar-camadas-b2.py",
        "proposito": "export para avaliacao da frente D; ferramenta de pesquisa; "
                     "NAO candidata a produto; nenhum campo espera-consumo do "
                     "produto; codecs artificiais do benchmark NAO sao adaptados aqui",
        "tempo_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "codec": {"nome": "Enigma (variante plain, Sonic 1)",
                  "decompressor_rom": "jsr $171E (unico sitio, 0x1B6D2)",
                  "value_offset": 0,
                  "value_offset_evidencia": "move.w #$0,D0 imediatamente antes da chamada (0x1B6CE)"},
        "pins": {"rom_sha256": CS.ROM_SHA256,
                 "decoder_sha256": cadeia["pins"]["decoder_sha256"],
                 "s1disasm": "064e3c68eb19cc85b8801b087f9d95f9b3e82cea"},
        "streams": [{"offset": s["offset"], "bytes_consumidos": s["bytes_consumidos"],
                     "output_size": s["output_size"], "output_sha256": s["output_sha256"]}
                    for s in cadeia["streams"]],
        "geometria_saida": {"bytes": 4096, "grade": "64x64 de IDs 1 byte",
                            "projecao": {"base": "0xFF1020", "stride": 128}},
        "limites": ["sem execucao: decode paridade com PIN, nao com consumo do jogo",
                    "sem afirmacao acustica/visual derivada daqui"],
    }

    saida1 = out_dir / "export-camadas-b2.json"
    saida2 = out_dir / "export-avaliacao-d.json"
    camadas["veredito"] = "EXPORT-CAMADAS-OK" if not falhas else "FALHAS: " + ",".join(falhas)
    saida1.write_text(json.dumps(camadas, ensure_ascii=False, indent=1) + "\n")
    saida2.write_text(json.dumps(d_doc, ensure_ascii=False, indent=1) + "\n")
    print(f"[e17] PLC: {e17.get('ocorrencias')} unica={e17.get('unica')} "
          f"walls={e17.get('walls', {}).get('art_offset')}")
    print("veredito:", camadas["veredito"])
    print("evidencia:", saida1, "|", saida2)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
