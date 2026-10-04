#!/usr/bin/env python3
"""CLI da frente b — verifica a cadeia Sonic corrigida na ROM real (BYOR, so leitura).

Modos:
  cadeia     — prova tabela->entrada->stream->chamada->destino->parametros pelos
               bytes; confirma os 6 hashes preservados; projeta o layout;
               refuta a interpretacao antiga; sae do SS_MapIndex ao ponteiro de
               mappings do ID $01.
  negativos  — executa as recusas reais (rom-errada, sitio-alterado,
               destino-alterado, stream-fora-da-tabela, geometria-errada,
               consumidor-ausente) e registra cada recusa observada.
  fixture    — exibe o resultado discriminante da fixture assimetrica
               (a interpretacao antiga deve ser REPROVADA).

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py \
      cadeia --rom "/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin" \
      --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/cadeia-sonic.json \
      [--render FORA-DO-GIT/dir] [--modo verificado]

Modo `verificado` (padrao) so promove saida com todos os pins conferidos;
modo `hipotetico` existe rotulado e nunca produz buffer `promovido`.
Ferramenta de pesquisa; nunca candidata a produto.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import pathlib
import struct
import sys
import zlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import contrato_sonic as CS  # noqa: E402

ROOT = CS.ROOT


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def _json_ordenado(o):
    return json.dumps(o, ensure_ascii=False, indent=1, sort_keys=False)


def _confinar_na_arvore(p, rotulo):
    rp = pathlib.Path(p).resolve()
    if not (rp == ROOT or rp.is_relative_to(ROOT)):
        raise CS.RecusaErro("caminho", f"{rotulo} fora da arvore do repositorio: {p}")
    return rp


def png_diagnostico(pasta, nome, linhas_ids, escala=8):
    """PNG 8-bit cinza: VISUALIZACAO DIAGNOSTICA DE IDs, nao grafico reconstruido.
    Exigido FORA da arvore versionada (derivado de conteudo comercial)."""
    base = pathlib.Path(pasta).resolve()
    if base == ROOT or base.is_relative_to(ROOT):
        raise CS.RecusaErro("caminho-render",
                            "PNGs de diagnostico devem ir FORA do Git (passar --render "
                            f"com diretorio fora da arvore; recebido {pasta})")
    base.mkdir(parents=True, exist_ok=True)
    alvo = base / nome
    h, w = len(linhas_ids), len(linhas_ids[0])
    corpo = b"".join(b"\x00" + bytes(v for v in row for _ in range(escala))
                     for row in linhas_ids for _ in range(escala))

    def chunk(tipo, dado):
        return (struct.pack(">I", len(dado)) + tipo + dado
                + struct.pack(">I", zlib.crc32(tipo + dado) & 0xFFFFFFFF))
    ihdr = struct.pack(">IIBBBBB", w * escala, h * escala, 8, 0, 0, 0, 0)
    alvo.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
                     + chunk(b"IDAT", zlib.compress(corpo, 9)) + chunk(b"IEND", b""))
    return str(alvo), _sha(alvo.read_bytes())


def fixture_assimetrica():
    """Plain autoral 64x64: IDs distintos por celula, pares desiguais, primeira
    e ultima celula distintas, bordas de linha com valores unicos. Expectativas
    independentes: cada celula (r,c) vale (r*7 + c*13) % 0x4E, com (0,0)=1 e
    (63,63) explicito — formulas escritas antes da implementacao (E5/E6)."""
    plain = bytearray((r * 7 + c * 13) % 0x4E for r in range(CS.LINHAS)
                      for c in range(CS.COLUNAS))
    plain[0] = 0x01          # primeira celula = parede azul (ID $01)
    plain[-1] = 0x26         # ultima celula = ID $26
    plain[63 * 64] = 0x2F    # primeira da ultima linha
    return bytes(plain)


def expectativas_fixture(plain):
    """Calcula expectativas por formulas independentes do modulo (laudo do teste)."""
    exp = {}
    exp["primeira_celula"] = plain[0]
    exp["ultima_celula"] = plain[CS.LINHAS * CS.COLUNAS - 1]
    exp["celula_0_1"] = plain[1]
    exp["celula_63_63"] = plain[63 * 64 + 63]
    # projecao esperada: RAM[r*128+c] = plain[r*64+c]; padding [r*128+64..+127] = 0
    buf = bytearray(CS.LINHAS * CS.STRIDE)
    for r in range(CS.LINHAS):
        for c in range(CS.COLUNAS):
            buf[r * CS.STRIDE + c] = plain[r * CS.COLUNAS + c]
    exp["projecao_sha"] = _sha(bytes(buf))
    exp["projecao_primeiro_byte"] = buf[0]
    exp["projecao_pos_linha63_col63"] = buf[63 * 128 + 63]
    exp["padding_linha0"] = bytes(buf[64:128])
    return exp


def modo_cadeia(a):
    rom = CS.carregar_rom(a.rom)
    decoder, decoder_path, decoder_sha = CS.resolver_decoder(a.decoder)
    doc = {
        "schema_version": CS.SCHEMA,
        "gerado_por": "scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py",
        "modo": a.modo,
        "tempo_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "pins": {
            "rom_sha256": CS.ROM_SHA256, "rom_size": CS.ROM_SIZE,
            "decoder_sha256": decoder_sha, "decoder_caminho": decoder_path,
            "tabela": hex(CS.TABELA),
            "expectativas_doc": "docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS.md",
        },
    }
    # 1) sítios byte a byte (tabela -> entrada -> stream -> chamada -> destino -> parametros)
    divergencias = CS.verificar_sitios(rom)
    doc["sitios"] = {"total": len(CS.SITIOS), "divergentes": divergencias}
    if divergencias:
        doc["veredito"] = "NAO-PROMOVIDO: sitios divergentes"
        _emitir(doc, a)
        raise CS.RecusaErro("sitio-alterado",
                            f"{len(divergencias)} sítios divergem dos bytes pinados")
    # 2) codec: seis streams, hashes preservados + determinismo (nao identidade)
    streams = []
    for i, off in enumerate(CS.STREAMS):
        plain, consumido = CS.decodificar_stream(rom, decoder, off)
        plain2, consumido2 = CS.decodificar_stream(rom, decoder, off)
        sha = _sha(plain)
        ok_hash = sha == CS.PLAIN_SHA[i]
        ok_consumido = consumido == CS.CONSUMIDOS[i]
        streams.append({
            "indice": i, "offset": hex(off),
            "bytes_consumidos": consumido, "consumido_conferido": ok_consumido,
            "output_size": len(plain), "output_sha256": sha,
            "hash_preservado": ok_hash,
            "determinismo_decode_duplo": plain == plain2,
            "nivel": "vinculo estrutural + paridade de codec",
        })
        if not (ok_hash and ok_consumido):
            _emitir(doc, a)
            raise CS.RecusaErro("paridade-perdida",
                                f"stream {off:#x}: hash/consumidos divergem do pin")
    doc["streams"] = streams
    # 3) layout + projecao do stream 0 (amostra completa) e estatistica das 6
    p0, _ = CS.decodificar_stream(rom, decoder, CS.STREAMS[0])
    layout = CS.layout_de_plain(p0)
    proj = CS.projetar(p0)
    inverso = CS.inverso_projecao(proj)
    doc["projecao_amostra"] = {
        "offset": hex(CS.STREAMS[0]), "layout_sha": _sha(p0),
        "buffer_projetado_sha": _sha(proj), "tamanho_buffer": len(proj),
        "inverso_roundtrip": inverso == p0,
        "base_destino": hex(CS.BASE_LAYOUT), "stride": CS.STRIDE,
    }
    if inverso != p0:
        raise CS.RecusaErro("inverso", "round-trip projetar->inverso nao e identidade")
    ids = sorted({b for row in layout for b in row})
    doc["estatisticas_ids_stream0"] = {
        "distintos": len(ids), "minimo": hex(ids[0]), "maximo": hex(ids[-1]),
        "zeros": sum(row.count(0) for row in layout),
    }
    # 4) refutacao documentada
    doc["refutacao_antiga"] = CS.refutar_interpretacao_antiga(p0)
    # 5) elo ID -> definicao (E7)
    doc["ss_mapindex"] = {k: v for k, v in CS.lermapa_indices(rom).items() if k != "lista"}
    mapeamento = CS.lermapa_indices(rom)
    doc["ss_mapindex"]["amostra_id01"] = mapeamento["primeiro"]
    # 6) fixture assimetrica discriminante
    fx = fixture_assimetrica()
    exp = expectativas_fixture(fx)
    proj_fx = CS.projetar(fx)
    doc["fixture_assimetrica"] = {
        "plain_sha": _sha(fx),
        "projecao_sha": _sha(proj_fx), "projecao_conforme_expectativa": _sha(proj_fx) == exp["projecao_sha"],
        "primeira_celula": fx[0], "ultima_celula": fx[-1],
        "antiga_reprovada": _antiga_reprovada_na_fixture(fx),
    }
    # 7) renders de diagnostico (fora do Git)
    if a.render:
        renders = {}
        for i, off in enumerate(CS.STREAMS):
            plain, _ = CS.decodificar_stream(rom, decoder, off)
            linhas = CS.layout_de_plain(plain)
            nome = f"diagnostico-ids-{off:x}.png"
            caminho, sha = png_diagnostico(a.render, nome, linhas)
            renders[hex(off)] = {"caminho": caminho, "sha256": sha,
                                 "rotulo": "diagnostico do layout 64x64 (IDs de 1 byte) "
                                           "— NAO e grafico reconstruido"}
        caminho, sha = png_diagnostico(a.render, "diagnostico-ids-fixture.png",
                                       CS.layout_de_plain(fx))
        renders["fixture"] = {"caminho": caminho, "sha256": sha}
        doc["renders_diagnostico"] = renders
    doc["niveis"] = {
        "candidato": "nenhum",
        "referencia_estatica": "s1disasm @ 064e3c68 (pin conferido) + review-pr97.json",
        "vinculo_estrutural": "sitios E2 verificados byte a byte; SS_MapIndex lida",
        "consumo_observado": "NAO alegado — nenhuma execucao de emulador nesta frente",
        "semantica_recuperada": "layout 64x64 de IDs + projecao stride 128 (com consumidores "
                                "por bytes ate o ponteiro de mappings)",
        "reconstrucao_equivalente": "NAO alegada — arte/mappings/paleta nao provados",
    }
    doc["veredito"] = "PROMOVIDO (evidencia completa)" if a.modo == "verificado" else \
        "HIPOTETICO — nao promover"
    _emitir(doc, a)
    print(f"[cadeia] {len(CS.SITIOS)} sitios ok; 6 hashes preservados; "
          f"projecao stride {CS.STRIDE} roundtrip ok; veredito: {doc['veredito']}")
    print("evidencia:", _saida_path(a))
    return 0


def _antiga_reprovada_na_fixture(plain):
    """A visao antiga junta pares de bytes em UMA celula de 16 bits (grade
    64x32 de palavras VDP). O consumidor real copia 64x64 celulas de 1 byte
    (move.b em 0x1B6F8, padding saltado em 0x1B6FE). Na fixture, onde cada
    byte e unico, os dois modelos dao celulas diferentes na MESMA posicao
    logistica — e a antiga nem tem linha 40. Discriminante por construcao."""
    # antiga: entrada j = big-endian word em plain[2j:2j+2], grade 32x64
    def celula_antiga(r, c):
        j = r * 64 + c
        w = struct.unpack(">H", plain[2 * j:2 * j + 2])[0]
        return {"word": w, "tile": w & 0x7FF, "hflip": (w >> 11) & 1,
                "vflip": (w >> 12) & 1, "paleta": (w >> 13) & 3,
                "prioridade": (w >> 15) & 1}
    a01 = celula_antiga(0, 1)
    n01 = plain[0 * CS.COLUNAS + 1]
    a_ultima_linha = plain[2 * (31 * 64 + 63):2 * (31 * 64 + 63) + 2].hex()
    nova_linha40 = plain[40 * 64]
    return {
        "celula_linha0_col1_antiga": a01,
        "celula_linha0_col1_nova": n01,
        "antiga_diverge": a01["tile"] != n01 or (a01["word"] >> 8) != n01,
        "celula_nova_fora_da_grade_antiga": {
            "linha": 40, "coluna": 0, "valor_novo": nova_linha40,
            "motivo": "a grade antiga tem 32 linhas; as linhas 32..63 do layout "
                      "64x64 simplesmente nao existem na interpretacao refutada",
        },
        "motivo": "pares de bytes como celulas de 16 bits contradizem o operando "
                  "move.b medido e a grade 64x64 exigida pela copia de 64 linhas "
                  "de 64 bytes com salto de padding de 64",
    }


def modo_negativos(a):
    rom = CS.carregar_rom(a.rom)
    decoder, decoder_path, decoder_sha = CS.resolver_decoder(a.decoder)
    resultados = []

    def registrar(nome, fn):
        try:
            fn()
            resultados.append({"negativo": nome, "recusado": False,
                               "motivo": "NAO RECUSOU — FAIL"})
        except CS.RecusaErro as e:
            resultados.append({"negativo": nome, "recusado": True,
                               "codigo": e.codigo, "motivo": str(e)})

    # (1) ROM errada
    def rom_errada():
        mut = bytearray(rom)
        mut[0x150] ^= 0xFF
        CS.carregar_rom(_gravar_tmp(bytes(mut)))
    registrar("rom-errada", rom_errada)
    # (2) sitio alterado — byte da chamada jsr $171E
    def sitio_alterado():
        mut = bytearray(rom)
        mut[0x1B6D2] = 0x4E ^ 0x01
        if CS.verificar_sitios(bytes(mut)):
            raise CS.RecusaErro("sitio-alterado", "byte 0x1B6D2 mutado: sitios divergem")
    registrar("sitio-alterado", sitio_alterado)
    # (3) destino alterado — $FF4000 trocado pela porta VDP real
    def destino_alterado():
        mut = bytearray(rom)
        mut[0x1B6C8:0x1B6CE] = bytes.fromhex("43f900c00004")  # lea $C00004,A1
        if CS.verificar_sitios(bytes(mut)):
            raise CS.RecusaErro("destino-alterado",
                                "destino $C00004 (porta VDP) diverge do pin WRAM $FF4000")
    registrar("destino-alterado", destino_alterado)
    # (4) stream fora da tabela
    def stream_fora():
        CS.decodificar_stream(rom, decoder, 0x99999)
    registrar("stream-fora-da-tabela", stream_fora)
    # (5) geometria errada — tratar como 64x32 / stride 64
    def geometria_errada():
        plain, _ = CS.decodificar_stream(rom, decoder, CS.STREAMS[0])
        CS.layout_de_plain(plain, linhas=32, colunas=64)  # grade do modelo refutado
    registrar("geometria-errada-64x32", geometria_errada)

    def geometria_stride():
        plain, _ = CS.decodificar_stream(rom, decoder, CS.STREAMS[0])
        CS.projetar(plain, stride=64)  # sem padding: contradiz adda.w #$40
    registrar("geometria-errada-stride64", geometria_stride)
    # (6) consumidor ausente — verificar sem evidencia dos sitios e recusa
    def consumidor_ausente():
        sintaxe = CS.verificar_sitios(b"\x00" * 0x1B800, sitios=CS.SITIOS)
        if sintaxe:
            raise CS.RecusaErro("consumidor-ausente",
                                f"{len(sintaxe)} sitios ausentes/zerados — cadeia nao provada")
    registrar("consumidor-ausente", consumidor_ausente)

    doc = {
        "schema_version": CS.SCHEMA, "componente": "negativos",
        "tempo_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "pins": {"rom_sha256": CS.ROM_SHA256, "decoder_sha256": decoder_sha},
        "resultados": resultados,
        "nota_identidade": "decode duplo mede DETERMINISMO, nunca identidade "
                           "com o consumo do jogo (sem execucao nesta frente)",
    }
    recusados = sum(1 for r in resultados if r["recusado"])
    doc["veredito"] = f"{recusados}/{len(resultados)} recusas observadas"
    _gravar_evidencia(doc, a)
    for r in resultados:
        mark = "RECUSADO" if r["recusado"] else "NAO-RECUSOU-FAIL"
        print(f"[negativo] {r['negativo']}: {mark} — {r.get('motivo', r.get('codigo', ''))}")
    if recusados != len(resultados):
        raise CS.RecusaErro("negativo-flaco", "um negativo nao recusou; teste nao discriminante")
    print("evidencia:", _saida_path(a))
    return 0


_TMP = pathlib.Path.home() / "rds-scratch" / "par-b" / "tmp-negativos.bin"


def _gravar_tmp(b):
    _TMP.parent.mkdir(parents=True, exist_ok=True)
    _TMP.write_bytes(b)
    return str(_TMP)


def _saida_path(a):
    return _confinar_na_arvore(a.out, "--out")


def _gravar_evidencia(doc, a):
    p = _saida_path(a)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(_json_ordenado(doc) + "\n")


def _emitir(doc, a):
    _gravar_evidencia(doc, a)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("modo_cmd", choices=["cadeia", "negativos", "fixture"])
    ap.add_argument("--rom", default=CS.ROM_PADRAO)
    ap.add_argument("--decoder", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--modo", choices=["verificado", "hipotetico"], default="verificado")
    ap.add_argument("--render", default=None,
                    help="diretorio FORA do Git para PNGs de diagnostico de IDs")
    a = ap.parse_args(argv)
    if a.modo == "hipotetico" and a.modo_cmd == "cadeia":
        pass  # rotulado no doc; nao produz buffer promovido
    if a.modo_cmd == "cadeia":
        return modo_cadeia(a)
    if a.modo_cmd == "negativos":
        return modo_negativos(a)
    fx = fixture_assimetrica()
    exp = expectativas_fixture(fx)
    doc = {
        "schema_version": CS.SCHEMA, "componente": "fixture-assimetrica",
        "plain_sha": _sha(fx),
        "expectativas": {
            "primeira_celula": exp["primeira_celula"],
            "ultima_celula": exp["ultima_celula"],
            "celula_0_1": exp["celula_0_1"],
            "celula_63_63": exp["celula_63_63"],
            "projecao_sha": exp["projecao_sha"],
            "padding_linha0_sha": _sha(exp["padding_linha0"]),
            "padding_linha0_todo_zero": all(v == 0 for v in exp["padding_linha0"]),
        },
        "medida": {
            "projecao_sha": _sha(CS.projetar(fx)),
            "inverso_roundtrip": CS.inverso_projecao(CS.projetar(fx)) == fx,
        },
        "antiga_reprovada": _antiga_reprovada_na_fixture(fx),
    }
    ok = (doc["medida"]["projecao_sha"] == exp["projecao_sha"]
          and doc["medida"]["inverso_roundtrip"]
          and doc["antiga_reprovada"]["antiga_diverge"])
    doc["veredito"] = "PASS" if ok else "FAIL"
    _gravar_evidencia(doc, a)
    print(f"[fixture] discriminante: antiga_diverge="
          f"{doc['antiga_reprovada']['antiga_diverge']}, projecao conforme "
          f"expectativa propria={ok}; veredito: {doc['veredito']}")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except CS.RecusaErro as e:
        print(f"[recusa] {e}", file=sys.stderr)
        sys.exit(2)
