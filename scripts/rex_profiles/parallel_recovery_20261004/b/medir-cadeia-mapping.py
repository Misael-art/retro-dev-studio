#!/usr/bin/env python3
"""Frente b (ADENDA-B2, E14–E16): cadeia ID → SS_MapIndex → slot → mapping → consumidor.

Mede a ROM BYOR (so leitura) CONTRA as predicoes congeladas em
docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS-ADENDA-B2.md.
Nada aqui reinterpreta as predicoes: divergencia = FAIL com serie bruta.

Predicoes de estrutura sao DERIVADAS das macros pinadas do s1disasm
(064e3c68) — nao da ROM. O consumer S1 e montado pelo toolchain m68k-elf
pinado (mesmo metodo de montar-isa.py) e buscado na ROM; a busca exige
ocorrencia UNICA. Nenhum nivel "consumo observado" e alegado: nao ha
execucao nesta frente; os niveis ficam em vinculo-estrutural /
equivalencia-estatica (codigo presente).

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/medir-cadeia-mapping.py \
      --rom <BYOR> --out data/.../evidencia/cadeia-mapping-b2.json
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
MI = _carregar("montar_isa", HERE / "montar-isa.py")

# ---------------- E15: predicoes de Map_SSWalls (derivadas das macros) ----------------
MAP_SSWALLS = 0x2C564            # ponteiro do registro ID $01 (pin SS_MAPINDEX)
PALAVRAS_TABELA = bytes.fromhex(
    "00200026002c00320038003e0044004a00500056005c00620068006e0074007a")
FRAME_STRAIGHT = bytes.fromhex("01f40a0000f4")
TILE_ANGLED = [0x09 + 0x10 * k for k in range(15)]  # angled1..angledF
FRAME_TAM = 6                    # 1 byte de contagem + 5 bytes de peca
TOTAL_PREDITO = 32 + 16 * FRAME_TAM   # 128


def frame_angled(tile):
    return bytes.fromhex(f"01f00f00{tile:02x}f0")


def decodificar_peca_ver1(buf):
    """Leitura pela codificacao ver1 pinada (para o registro, nao para provar)."""
    contagem = buf[0]
    pecas = []
    for i in range(contagem):
        p = buf[1 + 5 * i: 6 + 5 * i]
        ypos = p[0] - 256 if p[0] >= 128 else p[0]
        w = ((p[1] >> 2) & 3) + 1
        h = (p[1] & 3) + 1
        tile = ((p[2] & 1) << 8) | p[3]
        xflip = (p[2] >> 7) & 1
        yflip = (p[2] >> 6) & 1
        pal = (p[2] >> 4) & 3
        pri = (p[2] >> 5) & 1
        xpos = p[4] - 256 if p[4] >= 128 else p[4]
        pecas.append({"ypos": hex(p[0]), "xpos": hex(p[4]), "w": w, "h": h,
                      "tile": hex(tile), "xflip": xflip, "yflip": yflip,
                      "paleta": pal, "prioridade": pri})
    return {"contagem_pecas": contagem, "pecas": pecas}


def medir_estrutura(rom):
    obtido = rom[MAP_SSWALLS:MAP_SSWALLS + TOTAL_PREDITO]
    divergencias = []
    if len(obtido) != TOTAL_PREDITO:
        divergencias.append({"offset": "buffer", "esperado": TOTAL_PREDITO,
                             "obtido": len(obtido)})
    palavras = obtido[0:32]
    if palavras != PALAVRAS_TABELA:
        divergencias.append({"offset": hex(MAP_SSWALLS), "papel": "tabela-palavras",
                             "esperado": PALAVRAS_TABELA.hex(), "obtido": palavras.hex()})
    frames = []
    for i in range(16):
        nome = ".straight" if i == 0 else f".angled{i:X}" if i < 10 else ".angled" + format(i, "X")
        esperado = FRAME_STRAIGHT if i == 0 else frame_angled(TILE_ANGLED[i - 1])
        ini = 32 + i * FRAME_TAM
        ob = obtido[ini:ini + FRAME_TAM]
        ok = ob == esperado
        frames.append({"frame": nome, "offset_absoluto": hex(MAP_SSWALLS + ini),
                       "offset_tabela": hex(ini), "esperado": esperado.hex(),
                       "obtido": ob.hex(), "confere": ok,
                       "palavra_ponteiro": palavras[2 * i: 2 * i + 2].hex(),
                       "leitura_ver1": decodificar_peca_ver1(ob)})
        if not ok:
            divergencias.append({"offset": hex(MAP_SSWALLS + ini), "papel": "frame-" + nome,
                                 "esperado": esperado.hex(), "obtido": ob.hex()})
    return {"tabela_addr": hex(MAP_SSWALLS), "tamanho_predito": TOTAL_PREDITO,
            "anclora": "palavras relativas ao rotulo da tabela (adda.w (a1,d1.w),a1 "
                       "com d1=frame*2)",
            "frames": frames, "divergencias": divergencias,
            "série_bruta_hex": obtido.hex()}


# ---------------- E14: layout do slot em $FF4000 + 8*k ----------------
def medir_slot(rom):
    idx = CS.lermapa_indices(rom)
    registros = {"addr": idx["addr"], "entradas": idx["entradas"]}
    slot_id01 = None
    anomalias = []
    for e in idx["lista"]:
        rec = bytes.fromhex(e["raw"])
        # semantica dos instrucoes pinadas 0x1B714..0x1B722:
        # move.l (a0)+,(a1)+ -> [0..3]; move.w #$0,(a1)+ -> [4..5]=0;
        # move.b -4(a0),-1(a1) -> [5]=rec[0]; move.w (a0)+,(a1)+ -> [6..7]
        slot = rec[0:4] + b"\x00" + rec[0:1] + rec[4:6]
        if e["id"] == 0x01:
            slot_id01 = slot.hex()
        palavra_frame = struct.unpack(">H", slot[4:6])[0]
        palavra_vram = struct.unpack(">H", slot[6:8])[0]
        if palavra_frame > 0xFF or (slot[4] != 0):
            anomalias.append({"id": hex(e["id"]), "motivo": "palavra-frame fora de 0..$FF"})
        if palavra_vram & 0x8000:
            anomalias.append({"id": hex(e["id"]),
                              "motivo": f"movea.w de {palavra_vram:04x} sinaliza negativo "
                                        "(a3 >= 0x8000) — desconhecido, nao interpretado"})
        ptr = struct.unpack(">I", slot[0:4])[0] & 0xFFFFFF
        if ptr & 1:
            anomalias.append({"id": hex(e["id"]), "motivo": "ponteiro de mappings impar"})
    esperado_id01 = bytes.fromhex("0002c56400000142").hex()
    return {"base": "$FF4000 (v_ss_spritesettings) — os 37 sitios ja pinados",
            "layout_predito": "[0..3]=long (frame<<24|ptr), [4]=0, [5]=frame, [6..7]=pal|vram",
            "registrado_de": "0x1B714 move.l / 0x1B716 move.w #$0 / 0x1B71A move.b -4(a0),-1(a1) / 0x1B720 move.w",
            "slot_id01_obtido": slot_id01, "slot_id01_esperado": esperado_id01,
            "slot_id01_confere": slot_id01 == esperado_id01,
            "entradas": registros, "anomalias": anomalias,
            "nota": "simulacao do CARREGADOR pinado sobre os 78 registros de SS_MapIndex; "
                    "nao e execucao — nivel vinculo-estrutural"}


# ---------------- E16: bloco consumidor SS_ShowLayout ----------------
S1_GAS = [
    "lea (0xff4000).l,%a5",
    "lsl.w #3,%d0",
    "lea (%a5,%d0.w),%a5",
    "movea.l (%a5)+,%a1",
    "move.w (%a5)+,%d1",
    "add.w %d1,%d1",
    "adda.w (%a1,%d1.w),%a1",
    "movea.w (%a5)+,%a3",
    "moveq #0,%d1",
    "move.b (%a1)+,%d1",
    "subq.b #1,%d1",
]


def desmontar(tmpdir, nome, hexbytes, org):
    """objdump -d do toolchain sobre os bytes na posicao real da ROM:
    desmontagem LINHA A LINHA (leitura independente, mesmo metodo do montar-isa)."""
    s = tmpdir / f"inv-{nome}.s"
    o = tmpdir / f"inv-{nome}.o"
    s.write_text(".text\n" + f".org 0x{org:x}\n.byte " +
                 ",".join(f"0x{b:02x}" for b in hexbytes) + "\n")
    MI.run([str(MI.AS), "-m68000", "-o", str(o), str(s)])
    r = MI.run([str(MI.OBJDUMP), "-d", "--start-address", f"0x{org:x}",
               "--stop-address", f"0x{org + len(hexbytes)}", str(o)])
    linhas = []
    for linha in r.stdout.splitlines():
        partes = linha.split("\t")
        if len(partes) >= 3:
            linhas.append({"endereco": partes[0].strip().rstrip(":"),
                           "bytes": partes[1].strip(), "mnemonico": partes[-1].strip()})
    return linhas


def medir_consumidor(rom, tmpdir):
    # org=0: sem padding de secao — objcopy -j .text devolve exatamente as instruces
    seq = MI.assemble(tmpdir, "consumidor-s1", org=0, linhas=S1_GAS)
    ocorrencias = []
    pos = rom.find(seq)
    while pos != -1:
        ocorrencias.append(pos)
        pos = rom.find(seq, pos + 1)
    res = {"bloco_gas": S1_GAS, "bytes_montados": seq.hex(),
           "tamanho": len(seq), "ocorrencias": [hex(o) for o in ocorrencias],
           "unica": len(ocorrencias) == 1}
    if len(ocorrencias) != 1:
        res["veredito_parcial"] = ("INCONCLUSIVE: 0 ocorrencias" if not ocorrencias
                                   else f"AMBIGUO: {len(ocorrencias)} ocorrencias")
        return res
    alvo = ocorrencias[0]
    # branch/jsr esperados MONTADOS pelo toolchain (bmi.s saltando um jsr abs.l de
    # 6 bytes = disp +6; prefixo jsr abs.l), nao por adivinhacao de opcode
    ramo = MI.assemble(tmpdir, "bmi-antecipa-jsr", org=0,
                       linhas=["bmi.s LB", "jsr (0).l", "LB: moveq #0,%d0"])[:2]
    pref_jsr = MI.assemble(tmpdir, "jsr-abs-l", org=0, linhas=["jsr (0).l"])[:2]
    cauda = rom[alvo + len(seq): alvo + len(seq) + 8]
    bmi = cauda[0:2]
    jsr = cauda[2:8]
    alvo_build = struct.unpack(">I", jsr[2:6])[0] if jsr[0:2] == pref_jsr else None
    res["ramo_esperado_montado"] = ramo.hex()
    res["jsr_prefixo_montado"] = pref_jsr.hex()
    res["cauda"] = {"bmi_s": bmi.hex(), "esperado": ramo.hex(),
                    "confere": bmi == ramo,
                    "jsr": jsr.hex(), "formato_jsr_abs_l": jsr[0:2] == pref_jsr,
                    "alvo_buildspr_normal": hex(alvo_build) if alvo_build is not None else None}
    full = seq + cauda
    res["desmontagem_objdump"] = desmontar(tmpdir, "consumidor-s1", full, alvo)
    if alvo_build is not None and alvo_build + 16 <= len(rom):
        res["prologo_buildspr_normal"] = {
            "addr": hex(alvo_build),
            "bytes": rom[alvo_build:alvo_build + 16].hex(),
            "desmontagem_objdump": desmontar(tmpdir, "buildspr-prologo",
                                             rom[alvo_build:alvo_build + 16], alvo_build)}
    res["veredito_parcial"] = ("CODIGO-CONSUMIDOR-PRESENTE-OCORRENCIA-UNICA"
                               if res["cauda"]["confere"] and alvo_build is not None
                               else "CAUDA-DIVERGENTE (serie bruta em cauda)")
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--rom", default=CS.ROM_PADRAO)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)

    rom = CS.carregar_rom(a.rom)
    tmp = pathlib.Path.home() / "rds-scratch" / "par-b" / "tmp-mapping"
    tmp.mkdir(parents=True, exist_ok=True)

    estrutura = medir_estrutura(rom)
    slot = medir_slot(rom)
    consumidor = medir_consumidor(rom, tmp)

    falhas = []
    if estrutura["divergencias"]:
        falhas.append("E15-estrutura")
    if not slot["slot_id01_confere"]:
        falhas.append("E14-slot-id01")
    if consumidor.get("veredito_parcial", "").startswith("INCONCLUSIVE") or \
       consumidor.get("veredito_parcial", "").startswith("AMBIGUO") or \
       consumidor.get("veredito_parcial", "").startswith("CAUDA"):
        falhas.append("E16-consumidor:" + consumidor["veredito_parcial"].split(":")[0])

    doc = {
        "schema_version": "rex-parallel-b/cadeia-mapping/1",
        "gerado_por": "scripts/rex_profiles/parallel_recovery_20261004/b/medir-cadeia-mapping.py",
        "expectativas": "E14/E15/E16 de docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS-ADENDA-B2.md",
        "tempo_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "pins": {"rom_sha256": CS.ROM_SHA256,
                 "s1disasm": "064e3c68eb19cc85b8801b087f9d95f9b3e82cea",
                 "toolchain_as_sha256": MI.AS_SHA, "toolchain_objdump_sha256": MI.OBJDUMP_SHA},
        "niveis": {
            "estrutura_mapping": "equivalencia-estatica (predicao por macro vs bytes da ROM)",
            "slot": "vinculo-estrutural (carregador pinado simulado; sem execucao)",
            "consumidor": "codigo-presente-na-ROM (ocorrencia unica montada pelo "
                          "toolchain); NAO e 'consumo observado' — sem runtime nesta frente",
        },
        "estrutura": estrutura,
        "slot": slot,
        "consumidor": consumidor,
        "veredito": ("CADEIA-MAPPING-E14-E16-OK" if not falhas
                     else "FALHAS: " + ", ".join(falhas)),
    }
    out = pathlib.Path(a.out)
    if not (out.resolve() == CS.ROOT or out.resolve().is_relative_to(CS.ROOT)):
        raise CS.RecusaErro("caminho", f"--out fora da arvore: {a.out}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(f"[estrutura] {estrutura['tamanho_predito']}B; divergencias: "
          f"{len(estrutura['divergencias'])}")
    print(f"[slot] id01 confere: {slot['slot_id01_confere']}; anomalias: {len(slot['anomalias'])}")
    print(f"[consumidor] ocorrencias: {consumidor['ocorrencias']}; "
          f"{consumidor.get('veredito_parcial')}")
    print("veredito:", doc["veredito"])
    print("evidencia:", out)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
