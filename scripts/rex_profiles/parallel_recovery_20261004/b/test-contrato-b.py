#!/usr/bin/env python3
"""Testes discriminantes da frente b (parallel_recovery_20261004).

Cobrem o contrato corrigido e DEVEM falhar na interpretacao antiga
($FF4000 = porta VDP; pares de bytes = palavras de nametable 64x32).
Tests independentes de ROM rodam sempre; os gates por ROM (BYOR) pulam
com motivo honesto quando a ROM pinada nao esta disponivel.

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/test-contrato-b.py
  (ROM BYOR em CS.ROM_PADRAO ativa tambem os testes de paridade/cadeia real)
"""
from __future__ import annotations

import pathlib
import struct
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import contrato_sonic as CS  # noqa: E402

ROM_DISPONIVEL = pathlib.Path(CS.ROM_PADRAO).exists()


def bloco_consumidor_fake():
    """Reconstroi o trecho 0x1B640-0x1B800 a partir dos SITIOS pinados,
    preenchendo o resto com zeros. NAO e a ROM real: so permite exercitar o
    verificador de sítios e as mutacoes sem depender do corpus BYOR."""
    rom = bytearray(0x1B800)
    for offset, hexbytes, _d, _p in CS.SITIOS:
        rom[offset:offset + len(bytes.fromhex(hexbytes))] = bytes.fromhex(hexbytes)
    return bytes(rom)


class TestContrato(unittest.TestCase):
    # ---------- fixture assimetrica (E5/E6) ----------
    def setUp(self):
        # formulas independentes da implementacao (escritas em EXPECTATIONS):
        # celula(r,c) = (r*7 + c*13) % 0x4E, com (0,0)=0x01, (63,63)=0x26,
        # (63,0)=0x2F.
        self.plain = bytearray((r * 7 + c * 13) % 0x4E
                               for r in range(64) for c in range(64))
        self.plain[0] = 0x01
        self.plain[-1] = 0x26
        self.plain[63 * 64] = 0x2F
        self.plain = bytes(self.plain)

    def test_primeira_e_ultima_celula(self):
        self.assertEqual(CS.celula(self.plain, 0, 0), 0x01)
        self.assertEqual(CS.celula(self.plain, 63, 63), 0x26)
        self.assertEqual(CS.celula(self.plain, 63, 0), 0x2F)

    def test_fronteiras_de_linha(self):
        # ultima celula da linha r e plain[r*64+63]; primeira da linha r+1 e
        # plain[(r+1)*64]; valores adjacentes NAODO coincidem na fixture
        for r in range(63):
            a = CS.celula(self.plain, r, 63)
            b = CS.celula(self.plain, r + 1, 0)
            grade = CS.layout_de_plain(self.plain)
            self.assertEqual(grade[r][63], a)
            self.assertEqual(grade[r + 1][0], b)
        # colunas 63->64 nao existem; posicao 64 na linha 0 e PADDING
        grade = CS.layout_de_plain(self.plain)
        self.assertEqual(len(grade), 64)
        self.assertTrue(all(len(row) == 64 for row in grade))

    def test_projecao_expectativa_independente(self):
        buf = CS.projetar(self.plain)
        self.assertEqual(len(buf), 64 * 128)
        # formula escrita a mao contra este teste (nao reusa projetar):
        for (r, c, esperado) in [(0, 0, 0x01), (0, 1, (7 * 0 + 13 * 1) % 0x4E),
                                 (63, 63, 0x26), (63, 0, 0x2F), (40, 3, (40 * 7 + 3 * 13) % 0x4E)]:
            self.assertEqual(buf[r * 128 + c], self.plain[r * 64 + c])
            self.assertEqual(buf[r * 128 + c], esperado)
        # padding inteiro zerado
        for r in range(64):
            self.assertEqual(buf[r * 128 + 64: r * 128 + 128], bytes(64))

    def test_inverso_roundtrip_e_recusa_de_padding(self):
        buf = CS.projetar(self.plain)
        self.assertEqual(CS.inverso_projecao(buf), self.plain)
        with self.assertRaises(CS.RecusaErro):
            CS.posicao_no_plain(0 * 128 + 64)   # primeira posicao de padding
        with self.assertRaises(CS.RecusaErro):
            CS.posicao_no_plain(63 * 128 + 127)  # ultima posicao de padding
        sujo = bytearray(buf)
        sujo[10] = 0xFF  # linha 0, coluna 10: nao e padding — ok como dado
        sujo[64] = 0x01  # padding sujo -> inverso deve recusar (nao calar)
        with self.assertRaises(CS.RecusaErro):
            CS.inverso_projecao(bytes(sujo))

    def test_posicao_projetada_formula(self):
        self.assertEqual(CS.posicao_projetada(0), 0)
        self.assertEqual(CS.posicao_projetada(1), 1)
        self.assertEqual(CS.posicao_projetada(64), 128)      # linha 1, col 0
        self.assertEqual(CS.posicao_projetada(64 * 64 - 1), 63 * 128 + 63)

    # ---------- refutacao da interpretacao antiga (E5/E7 do review) ----------
    def test_antiga_reprovada_pela_fixture(self):
        # par de bytes != celula: (0,1) na grade nova e plain[1]; na antiga e
        # a palavra plain[2:4] — a fixture garante que os modelos divergem.
        nova = CS.celula(self.plain, 0, 1)
        antiga_word = struct.unpack(">H", self.plain[2:4])[0]
        self.assertNotEqual(nova, antiga_word)
        self.assertNotEqual(nova, antiga_word >> 8)
        # grade antiga tem 32 linhas: as linhas 32..63 simplesmente nao existem
        antiga = CS.interpretacao_antiga(self.plain)
        self.assertEqual(antiga["linhas"], 32)
        self.assertEqual(antiga["celulas"], 2048)
        refut = CS.refutar_interpretacao_antiga(self.plain)
        self.assertEqual(refut["veredito"], "REFUTADA pelos bytes do consumidor")
        self.assertGreaterEqual(len(refut["motivos"]), 3)

    def test_ff4000_jamais_porta_vdp(self):
        self.assertTrue(CS.WRAM_INICIO <= 0xFF4000 <= CS.WRAM_FIM)
        self.assertNotEqual(0xFF4000, CS.VDP_DATA_PORT_LONG)
        self.assertNotEqual(0xFF4000, CS.VDP_DATA_PORT_WORD)
        # o sitio pinado carrega $FF4000 (WRAM), nao $C00004/$C0A004
        self.assertIn((0x1B6C8, "43f900ff4000",
                       "lea $FF4000,A1 (WRAM; NAO porta VDP)", "destino"), CS.SITIOS)

    def test_grade_64x32_recusada(self):
        with self.assertRaises(CS.RecusaErro):
            CS.layout_de_plain(self.plain, linhas=32, colunas=64)

    def test_stride_sem_padding_recusado(self):
        with self.assertRaises(CS.RecusaErro):
            CS.projetar(self.plain, stride=64)

    def test_word_vdp_recusa_sem_prova_especifica(self):
        # rejeicao da alegacao "nametable": sem byte de escrita na porta VDP no
        # sítio, o verificador de sítios do destino VDP diverge
        mut = bytearray(bloco_consumidor_fake())
        mut[0x1B6C8:0x1B6CE] = bytes.fromhex("43f900c00004")
        diverg = CS.verificar_sitios(bytes(mut))
        self.assertTrue(any(d["offset"] == "0x1b6c8" for d in diverg))

    # ---------- sítios / mutacoes (E2/E8) sobre o bloco reconstruido ----------
    def test_bloco_fake_passa_no_verificador(self):
        self.assertEqual(CS.verificar_sitios(bloco_consumidor_fake()), [])

    def test_sitio_alterado_detectado(self):
        for off in (0x1B6C4, 0x1B6D2, 0x1B6F8):
            mut = bytearray(bloco_consumidor_fake())
            mut[off] ^= 0xFF
            diverg = CS.verificar_sitios(bytes(mut))
            self.assertTrue(any(d["offset"] == hex(off) for d in diverg),
                            f"mutacao em {off:#x} nao detectada")

    def test_move_b_e_trocado_por_move_w_e_detectado(self):
        mut = bytearray(bloco_consumidor_fake())
        mut[0x1B6F8:0x1B6FA] = bytes.fromhex("32d8")  # move.w (a0)+,d1
        diverg = CS.verificar_sitios(bytes(mut))
        self.assertTrue(any(d["offset"] == "0x1b6f8" for d in diverg))

    def test_stream_fora_da_tabela_recusada_sem_rom(self):
        class DecFake:
            @staticmethod
            def decode(_s, **_k):
                raise AssertionError("nao deve decodificar")
        with self.assertRaises(CS.RecusaErro):
            CS.decodificar_stream(b"\x00" * 0x200000, DecFake(), 0x99999)

    def test_decoder_ausente_motivo_observavel(self):
        orig = CS.DECODER_CANDIDATOS
        CS.DECODER_CANDIDATOS = [pathlib.Path("/nonexistent/enigma_research.py")]
        try:
            with self.assertRaises(CS.RecusaErro) as ctx:
                CS.resolver_decoder()
            self.assertIn("decoder-ausente", str(ctx.exception))
        finally:
            CS.DECODER_CANDIDATOS = orig

    def test_recusa_rom_errada(self):
        with self.assertRaises(CS.RecusaErro) as ctx:
            CS.carregar_rom("/dev/null")
        self.assertTrue(str(ctx.exception).startswith("[rom-tamanho]")
                        or str(ctx.exception).startswith("[rom-ausente]"))

    # ---------- ROM real: paridade, cadeia e SS_MapIndex ----------
    def require_rom(self):
        if not ROM_DISPONIVEL:
            self.skipTest(f"ROM BYOR ausente ({CS.ROM_PADRAO}) — "
                          "gate nao executado = nao aprovado")

    def test_seis_hashes_preservados(self):
        self.require_rom()
        rom = CS.carregar_rom(CS.ROM_PADRAO)
        decoder, _p, _s = CS.resolver_decoder()
        for i, off in enumerate(CS.STREAMS):
            plain, consumido = CS.decodificar_stream(rom, decoder, off)
            self.assertEqual(len(plain), CS.OUTPUT_SIZE, f"stream {off:#x}")
            self.assertEqual(consumido, CS.CONSUMIDOS[i], f"stream {off:#x}")
            self.assertEqual(CS.sha256(plain), CS.PLAIN_SHA[i], f"stream {off:#x}")
            # determinismo (NAO identidade): decode duplo coincide
            plain2, _ = CS.decodificar_stream(rom, decoder, off)
            self.assertEqual(plain, plain2)

    def test_cadeia_completa_na_rom(self):
        self.require_rom()
        rom = CS.carregar_rom(CS.ROM_PADRAO)
        self.assertEqual(CS.verificar_sitios(rom), [])

    def test_ss_mapindex_elo_id_definicao(self):
        self.require_rom()
        rom = CS.carregar_rom(CS.ROM_PADRAO)
        doc = CS.lermapa_indices(rom)
        self.assertEqual(doc["entradas"], 78)
        self.assertEqual(doc["primeiro"]["raw"], "0002c5640142")
        self.assertEqual(doc["primeiro"]["mappings_ptr"], "0x2c564")
        self.assertTrue(all(e["mappings_ptr_in_rom"] for e in doc["lista"]))
        # ID k -> slot $FF4000 + 8*k (prova por bytes em 0x1B706-0x1B722);
        # o campo paleta|vram do ID $01 confere com ArtTile_SS_Wall=$142 do
        # pino s1disasm 064e3c68 — comparacao com referencia independente.
        self.assertEqual(int(doc["primeiro"]["word"], 16), 0x142)

    def test_geometria_real_e_64x64(self):
        self.require_rom()
        rom = CS.carregar_rom(CS.ROM_PADRAO)
        decoder, _p, _s = CS.resolver_decoder()
        plain, _ = CS.decodificar_stream(rom, decoder, CS.STREAMS[0])
        grade = CS.layout_de_plain(plain)
        self.assertEqual((len(grade), len(grade[0])), (64, 64))
        ids = {b for row in grade for b in row}
        # IDs devem caber no dominio da tabela de definicoes ($00..$4E);
        # se algum ID > $4E aparecer, o elo e declarado incompleto (nao falha
        # silencioso — falha visivel).
        self.assertLessEqual(max(ids), 0x4E)


if __name__ == "__main__":
    unittest.main(verbosity=2)
