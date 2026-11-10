#!/usr/bin/env python3
"""CONTRATO CORRIGIDO da cadeia Sonic (frente b, parallel_recovery_20261004).

Separa tres camadas que a frente B antiga confundiu (P1 do review PR #97):
  1. CODEC  — Enigma (variante plain), saida = 4096 bytes;
  2. LAYOUT — os 4096 bytes = grade 64x64 de IDs de bloco de 1 byte;
  3. PROJECÃO — o consumidor copia bytes para RAM com stride 128
     (RAM[$FF1020 + r*128 + c] = plain[r*64 + c]).

$FF4000 e WRAM ($FF0000-$FFFFFF), NAO porta de dados VDP ($C00004/$C0A004).
A visao antiga "2048 palavras VDP / nametable 64x32 com flip/paleta/prioridade"
e reprovada pelos proprios bytes da ROM (copia com move.b, destino $FF4000).

Este modulo e ferramenta de pesquisa/analise. NUNCA e candidato a produto.
Proveniencia: expectativas congeladas em
docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS.md (commit anterior).
"""
from __future__ import annotations

import hashlib
import importlib.util
import pathlib
import struct

SCHEMA = "rex-parallel-b/cadeia-sonic/2"
ROOT = pathlib.Path(__file__).resolve().parents[4]  # ate a raiz da worktree

# ---------- E1: identidade do alvo ----------
ROM_SHA256 = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
ROM_SIZE = 531577
ROM_PADRAO = "/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin"

# ---------- E4: paridade preservada (hashes de review-pr97.json) ----------
TABELA = 0x1B64C
STREAMS = [0x65432, 0x656AC, 0x65ABE, 0x65E1A, 0x662F4, 0x667C6]
CONSUMIDOS = [634, 1042, 860, 1242, 1233, 784]
PLAIN_SHA = [
    "322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0",
    "4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d",
    "3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954",
    "04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7",
    "5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8",
    "78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94",
]
OUTPUT_SIZE = 4096

# decodificador externo: modulo da frente B antiga, pinado pelo SHA que o
# review-pr97 usou (decoder_script_sha256). Reuso como CONSUMIDOR EXTERNO;
# nada daqui e transplantado para o produto.
DECODER_SHA256 = "a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2"
DECODER_CANDIDATOS = [
    pathlib.Path("/home/misael/RDS-REX-CORPUS-B/scripts/rex_corpus_b/enigma_research.py"),
    ROOT / "scripts/rex_corpus_b/enigma_research.py",
]

# ---------- E5/E6: geometria ----------
LINHAS = 64
COLUNAS = 64
STRIDE = 128  # 64 bytes de dados + 64 bytes de padding por linha
CELL_BYTES = 1  # ID de bloco de 1 byte por celula
BASE_DECOMPRESSAO = 0xFF4000  # WRAM
BASE_LAYOUT = 0xFF1020
VDP_DATA_PORT_LONG = 0xC00004
VDP_DATA_PORT_WORD = 0xC0A004
WRAM_INICIO, WRAM_FIM = 0xFF0000, 0xFFFFFF

# ---------- E2: sítios verificados byte a byte ----------
# Nota 68000: em `dbf`, a base do deslocamento e a palavra de extensao
# (opcode+2), nao o fim da instrucao. Alvos ja conferidos contra o texto
# do s1disasm @ 064e3c68.
SITIOS = [
    (0x1B646, "4b4c4d4e", "'KLMN' marca imediatamente antes da tabela", "contexto"),
    (0x1B64C, "00065432", "entrada 0 da tabela = stream 0x65432", "tabela"),
    (0x1B650, "000656ac", "entrada 1 = 0x656ac", "tabela"),
    (0x1B654, "00065abe", "entrada 2 = 0x65abe", "tabela"),
    (0x1B658, "00065e1a", "entrada 3 = 0x65e1a", "tabela"),
    (0x1B65C, "000662f4", "entrada 4 = 0x662f4", "tabela"),
    (0x1B660, "000667c6", "entrada 5 = 0x667c6", "tabela"),
    (0x1B6B6, "e548", "lsl.w #2,d0 (indice*4; e548 CONFIRMADO por m68k-elf-as -m68000)", "indexacao"),
    (0x1B6C4, "207b0086", "movea.l (d8,PC,D0.w),A0; disp8=0x86=-122 (signed) -> 0x1B6C6-122=0x1B64C (base da tabela; Xn=D0.w)", "tabela->entrada"),
    (0x1B6C8, "43f900ff4000", "lea $FF4000,A1 (WRAM; NAO porta VDP)", "destino"),
    (0x1B6CE, "303c0000", "move.w #$0,D0 (value_offset = 0 medido)", "parametro"),
    (0x1B6D2, "4eb90000171e", "jsr $171E (EniDec; unico sítio na ROM)", "chamada"),
    (0x1B6D8, "43f900ff0000", "lea $FF0000,A1", "limpar buffer"),
    (0x1B6DE, "303c0fff", "move.w #$0FFF,D0 (4096 longs)", "limpar buffer"),
    (0x1B6E2, "4299", "clr.l (a1)+", "limpar buffer"),
    (0x1B6E4, "51c8fffc", "dbf d0 -> 0x1B6E2", "limpar buffer"),
    (0x1B6E8, "43f900ff1020", "lea $FF1020,A1 (layout com padding)", "projecao"),
    (0x1B6EE, "41f900ff4000", "lea $FF4000,A0 (saida do codec)", "projecao"),
    (0x1B6F4, "723f", "moveq #$3F,D1 (64 linhas)", "projecao"),
    (0x1B6F6, "743f", "moveq #$3F,D2 (64 colunas)", "projecao"),
    (0x1B6F8, "12d8", "move.b (a0)+,(a1)+ — OPERANDO DE 8 BITS (discriminante; objdump do toolchain confere)", "projecao"),
    (0x1B6FA, "51cafffc", "dbf d2 -> 0x1B6F8", "projecao"),
    (0x1B6FE, "43e90040", "lea 64(a1),a1 — pula 64 bytes de padding (forma LEA segundo o objdump do toolchain, NAO ADDA)", "projecao"),
    (0x1B702, "51c9fff2", "dbf d1 -> 0x1B6F6", "projecao"),
    (0x1B706, "43f900ff4008", "lea $FF4008,A1 (slots de definicao)", "id->definicao"),
    (0x1B70C, "41f90001b738", "lea $1B738,A0 (SS_MapIndex)", "id->definicao"),
    (0x1B712, "724d", "moveq #$4D,D1 (78 entradas)", "id->definicao"),
    (0x1B714, "22d8", "move.l (a0)+,(a1)+", "id->definicao"),
    (0x1B716, "32fc0000", "move.w #$0,(a1)+", "id->definicao"),
    (0x1B71A, "1368fffcffff", "move.b -4(a0),-1(a1) (frame no byte baixo; instrucao de 6 bytes, limite ate 0x1B720)", "id->definicao"),
    (0x1B720, "32d8", "move.w (a0)+,(a1)+ (paleta|vram)", "id->definicao"),
    (0x1B722, "51c9fff0", "dbf d1 -> 0x1B714", "id->definicao"),
    (0x1B726, "43f900ff4400", "lea $FF4400,A1 (fila de animacoes)", "contexto"),
    (0x1B72C, "323c003f", "move.w #$3F,D1 (63)", "contexto"),
    (0x1B730, "4299", "clr.l (a1)+", "contexto"),
    (0x1B732, "51c9fffc", "dbf d1 -> 0x1B730", "contexto"),
    (0x1B736, "4e75", "rts", "contexto"),
]

# ---------- E7: SS_MapIndex ----------
SS_MAPINDEX_ADDR = 0x1B738
SS_MAPINDEX_ENTRADAS = 78
SS_MAPINDEX_ENTRADA_BYTES = 6
SS_MAPINDEX_ID_PRIMEIRO = 0x01
# registro do ID $01 conferido nos bytes ANTES de implementar o parser:
SS_MAPINDEX_ID01_ESPERADO = bytes.fromhex("0002c5640142")
# ponteiro de mappings do ID $01 deve cair dentro da ROM:
MAP_SSWALLS_PTR_ESPERADO = 0x2C564


class RecusaErro(Exception):
    """Recusa com motivo observavel — nunca um booleano mudo."""

    def __init__(self, codigo, mensagem):
        super().__init__(f"[{codigo}] {mensagem}")
        self.codigo = codigo
        self.mensagem = mensagem


# ---------------- carregamento ----------------

def sha256(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()


def carregar_rom(caminho):
    p = pathlib.Path(caminho)
    if not p.exists():
        raise RecusaErro("rom-ausente", f"ROM BYOR nao encontrada: {caminho}")
    dados = p.read_bytes()
    if len(dados) != ROM_SIZE:
        raise RecusaErro("rom-tamanho", f"esperado {ROM_SIZE} bytes, obtido {len(dados)}")
    if sha256(dados) != ROM_SHA256:
        raise RecusaErro("rom-errada",
                         f"SHA-256 diverge do pin ({sha256(dados)[:12]} != {ROM_SHA256[:12]}); "
                         "recusado antes de promover qualquer saida")
    return dados


def resolver_decoder(caminho_explicito=None):
    cands = ([pathlib.Path(caminho_explicito)] if caminho_explicito else []) + DECODER_CANDIDATOS
    for c in cands:
        if c.exists() and sha256(c.read_bytes()) == DECODER_SHA256:
            spec = importlib.util.spec_from_file_location("eni_decoder", c)
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            return m, str(c), sha256(c.read_bytes())
    raise RecusaErro(
        "decoder-ausente",
        "decodificador Enigma pinado (SHA " + DECODER_SHA256[:12] + ") nao localizado; "
        f"candidatos tentados: {[str(c) for c in cands]}")


# ---------------- E2: verificacao byte a byte ----------------

def verificar_sitios(rom, sitios=SITIOS):
    divergencias = []
    for offset, hexbytes, descricao, papel in sitios:
        esperado = bytes.fromhex(hexbytes)
        obtido = rom[offset:offset + len(esperado)]
        if obtido != esperado:
            divergencias.append({
                "offset": hex(offset), "papel": papel, "descricao": descricao,
                "esperado": esperado.hex(), "obtido": obtido.hex(),
            })
    return divergencias


# ---------------- E4: codec ----------------

def decodificar_stream(rom, decoder, offset, value_offset=0):
    if offset not in STREAMS:
        raise RecusaErro("stream-fora-da-tabela",
                         f"offset {offset:#x} nao pertence a tabela {TABELA:#x} "
                         f"(entradas validas: {[hex(s) for s in STREAMS]})")
    dados, consumido = decoder.decode(rom[offset:], max_out=1 << 20,
                                      work_limit=1 << 24, value_offset=value_offset)
    if len(dados) != OUTPUT_SIZE:
        raise RecusaErro("geometria-saida",
                         f"saida esperada {OUTPUT_SIZE} bytes, obtida {len(dados)}")
    return dados, consumido


# ---------------- E5: layout ----------------

def layout_de_plain(plain, linhas=LINHAS, colunas=COLUNAS, conforme_consumidor=True):
    if conforme_consumidor and (linhas, colunas) != (LINHAS, COLUNAS):
        raise RecusaErro("geometria-errada",
                         f"consumidor prova grade {LINHAS}x{COLUNAS} de 1 byte "
                         f"(move.b em 0x1B6F8 + salto de padding em 0x1B6FE); "
                         f"grade pedida {linhas}x{colunas} e recusada")
    esperado = linhas * colunas * CELL_BYTES
    if len(plain) != esperado:
        raise RecusaErro("geometria-layout",
                         f"layout {linhas}x{colunas} de {CELL_BYTES}B exige {esperado} "
                         f"bytes, obtido {len(plain)}")
    return [plain[r * colunas:(r + 1) * colunas] for r in range(linhas)]


def celula(plain, r, c):
    return plain[r * COLUNAS + c]


# ---------------- E6: projecao ----------------

def projetar(plain, base=BASE_LAYOUT, linhas=LINHAS, colunas=COLUNAS, stride=STRIDE,
             conforme_consumidor=True):
    """RAM[base + r*stride + c] = plain[r*colunas + c]; padding preservado (0)."""
    if conforme_consumidor and (linhas, colunas, stride) != (LINHAS, COLUNAS, STRIDE):
        raise RecusaErro("geometria-errada",
                         f"consumidor prova {LINHAS} linhas x {COLUNAS} colunas com "
                         f"stride {STRIDE} (bytes 0x1B6F4-0x1B702); geometria pedida "
                         f"{linhas}x{colunas} stride {stride} recusada")
    if stride < colunas:
        raise RecusaErro("geometria-stride",
                         f"stride {stride} menor que {colunas} colunas de 1 byte")
    if len(plain) != linhas * colunas:
        raise RecusaErro("geometria-projecao",
                         f"projecao exige {linhas * colunas} bytes, obtido {len(plain)}")
    buffer = bytearray(linhas * stride)
    for r in range(linhas):
        ini = r * stride
        buffer[ini:ini + colunas] = plain[r * colunas:(r + 1) * colunas]
    return bytes(buffer)


def inverso_projecao(buffer, linhas=LINHAS, colunas=COLUNAS, stride=STRIDE):
    if len(buffer) != linhas * stride:
        raise RecusaErro("geometria-inverso",
                         f"buffer projetado esperado {linhas * stride} bytes, "
                         f"obtido {len(buffer)}")
    plain = bytearray(linhas * colunas)
    for r in range(linhas):
        ini = r * stride
        row = buffer[ini:ini + colunas]
        pad = buffer[ini + colunas:ini + stride]
        if any(pad):
            raise RecusaErro("padding-sujo",
                            f"linha {r}: padding nao preservado ({sum(pad)} bytes != 0)")
        plain[r * colunas:(r + 1) * colunas] = row
    return bytes(plain)


def posicao_projetada(pos_no_plain, stride=STRIDE, colunas=COLUNAS):
    """Indice no plain (r*colunas+c) -> indice no buffer projetado (nao inclui base)."""
    r, c = divmod(pos_no_plain, colunas)
    return r * stride + c


def posicao_no_plain(pos_no_buffer, stride=STRIDE, colunas=COLUNAS):
    r, c = divmod(pos_no_buffer, stride)
    if c >= colunas:
        raise RecusaErro("padding-nao-invertivel",
                         f"posicao {pos_no_buffer:#x} cai em padding de linha "
                         f"(c={c} >= {colunas}); nao e celula de layout")
    return r * colunas + c


# ---------------- refutacao da interpretacao antiga ----------------

def interpretacao_antiga(plain):
    """A alegacao refutada do RELATORIO-INTEGRACION-B (nao para uso):
    2048 palavras big-endian = nametable 64x32 com campos flip/paleta/prioridade,
    escritas pela porta de dados VDP. Preservada apenas para ser reprovada."""
    if len(plain) != OUTPUT_SIZE:
        raise RecusaErro("geometria-antiga", f"esperado {OUTPUT_SIZE}, obtido {len(plain)}")
    palavras = [w for (w,) in struct.iter_unpack(">H", plain)]
    return {"palavras": palavras,
            "celulas": len(palavras), "linhas": 32, "colunas": 64,
            "destino_alegado": "porta de dados VDP",
            "campos_por_palavra": {"tile": "w & 0x7FF", "hflip": "bit 11",
                                   "vflip": "bit 12", "paleta": "bits 13-14",
                                   "prioridade": "bit 15"}}


def refutar_interpretacao_antiga(plain):
    """Retorna motivos concretos pelos quais a visao antiga contradiz os bytes."""
    motivos = []
    antiga = interpretacao_antiga(plain)
    # (a) geometria: o consumidor copia 64 linhas de 64 bytes com stride 128;
    #     a visao antiga produziria 64 linhas de 128 bytes CONTINUOS (sem
    #     padding) — buffers diferentes para o mesmo plain assimetrico.
    antigo_buffer = bytearray(64 * 128)
    for r in range(64):
        antigo_buffer[r * 128:(r + 1) * 128] = plain[r * 128:(r + 1) * 128]
    novo_buffer = projetar(plain)
    if bytes(antigo_buffer) != novo_buffer:
        motivos.append("a visao de palavras continua (sem padding) difere da copia "
                       "byte-a-byte com salto de 64 observada nos bytes em 0x1B6FE")
    # (b) operandos: a copia e move.b (0x1B6F8); palavras de 16 bits exigiriam
    #     move.w — o par de bytes NUNCA forma uma celula no destino.
    motivos.append("a copia usa move.b (byte) por posicao; interpretar pares como "
                   "uma celula de 16 bits contradiz o operando de 8 bits medido")
    # (c) destino: $FF4000 esta em WRAM; porta VDP e $C00004/$C0A004.
    motivos.append(f"destino $FF4000 esta em WRAM ({WRAM_INICIO:#x}-"
                   f"{WRAM_FIM:#x}); porta VDP e {VDP_DATA_PORT_LONG:#x} — "
                   "nenhum lea/v move para a porta VDP no sítio medido")
    return {"alegacao_antiga": antiga, "motivos": motivos,
            "veredito": "REFUTADA pelos bytes do consumidor"}


# ---------------- E7: elo ID -> definicao ----------------

def lermapa_indices(rom):
    base = SS_MAPINDEX_ADDR
    fim = base + SS_MAPINDEX_ENTRADAS * SS_MAPINDEX_ENTRADA_BYTES
    if fim > len(rom):
        raise RecusaErro("ssmapindex-fora", "tabela alem do fim da ROM")
    entradas = []
    for i in range(SS_MAPINDEX_ENTRADAS):
        o = base + i * SS_MAPINDEX_ENTRADA_BYTES
        rec = rom[o:o + SS_MAPINDEX_ENTRADA_BYTES]
        long_ = struct.unpack(">I", rec[0:4])[0]
        word = struct.unpack(">H", rec[4:6])[0]
        frame = long_ >> 24
        ptr = long_ & 0xFFFFFF
        entradas.append({
            "id": SS_MAPINDEX_ID_PRIMEIRO + i, "raw": rec.hex(),
            "frame": frame, "mappings_ptr": hex(ptr),
            "mappings_ptr_in_rom": 0x200 <= ptr < len(rom),
            "word": hex(word),
        })
    if rom[base:base + 6] != SS_MAPINDEX_ID01_ESPERADO:
        raise RecusaErro("ssmapindex-id01",
                         f"registro do ID $01 = {rom[base:base + 6].hex()} != "
                         f"{SS_MAPINDEX_ID01_ESPERADO.hex()} (conferido antes do parser)")
    for e in entradas:
        if not e["mappings_ptr_in_rom"]:
            raise RecusaErro("ssmapindex-ponteiro",
                             f"ID ${e['id']:02X}: ponteiro fora da ROM ({e['mappings_ptr']})")
    return {"addr": hex(base), "entradas": SS_MAPINDEX_ENTRADAS,
            "slot_stride": 8, "slots_base": "$FF4008 (slot do ID k = $FF4000 + 8*k)",
            "primeiro": entradas[0],
            "mappings_ptr_id01": hex(MAP_SSWALLS_PTR_ESPERADO), "lista": entradas}
