//! Formas e aritmética relativas — fixtures montadas á man (EXPECTATIONS-A §3).
//!
//! Os bytes das fixtures escríbense á man desde a táboa de expectativas; os
//! alvos esperados calcúlanse na justificación de cada test, non coa
//! ferramenta. Ningunha fixture se xera cun codificador propio: un round-trip
//! interno non proba a aritmética.

use rex_chain::instr::{decodificar, Forma, InstrErro};

fn v(hexes: &[u8]) -> &[u8] {
    hexes
}

#[test]
fn fa1_bsr_w_positivo_sobre_a_alegacion_sonic() {
    // `61 00 05 2A` en 0x001370: base = 0x1370 + 2 = 0x1372; disp = +0x052A.
    // 0x1372 + 0x52A = 0x189C (comprobo a man: 0x372+0x52A=0x89C).
    let bytes = [0x61u8, 0x00, 0x05, 0x2A];
    assert_eq!(
        decodificar(v(&bytes), 0x001370),
        Ok(Forma::BsrW { alvo: 0x189C })
    );
}

#[test]
fn fa2_bsr_w_negativo_segunda_alegacion_sonic() {
    // `61 00 E8 0C` en 0x00308E: base = 0x3090; disp = 0xE80C - 0x10000 = -0x17F4.
    // 0x3090 - 0x17F4 = 0x189C (a man: 0x3090-0x17F4 = 0x189C).
    let bytes = [0x61u8, 0x00, 0xE8, 0x0C];
    assert_eq!(
        decodificar(v(&bytes), 0x00308E),
        Ok(Forma::BsrW { alvo: 0x189C })
    );
}

#[test]
fn fa3_bsr_w_negativo_grande_terceira_alegacion() {
    // `61 00 C6 D4` en 0x0051C6: base = 0x51C8; disp = -(0x10000-0xC6D4) = -0x392C.
    // 0x51C8 - 0x392C = 0x189C (a man: 0x51C8-0x392C: 0x51C8-0x3900=0x18C8; -0x2C=0x189C).
    let bytes = [0x61u8, 0x00, 0xC6, 0xD4];
    assert_eq!(
        decodificar(v(&bytes), 0x0051C6),
        Ok(Forma::BsrW { alvo: 0x189C })
    );
}

#[test]
fn fa4_bsr_l_base_e_a_palabra_mas_a_extension() {
    // `61 FF FF FF FE 00` en 0x010000: disp32 = 0xFFFFFE00 = -0x200.
    // BSR.L ocupa 6 bytes; a PC durante a lectura da extension longa e
    // sitio+6, pero o desprazamento e relativo a sitio+4 (palabra de
    // extension): 0x10000 + 4 - 0x200 = 0xFE04.
    let bytes = [0x61u8, 0xFF, 0xFF, 0xFF, 0xFE, 0x00];
    assert_eq!(
        decodificar(v(&bytes), 0x010000),
        Ok(Forma::BsrL { alvo: 0xFE04 })
    );
}

#[test]
fn fa5_jsr_abs_w_extension_curta_cero_extendida() {
    // `4E FA 18 9C`: jsr (xxx).W — o word e o enderezo, cero-extendido a 24 bits.
    let bytes = [0x4Eu8, 0xFA, 0x18, 0x9C];
    assert_eq!(
        decodificar(v(&bytes), 0x2000),
        Ok(Forma::JsrAbsW { alvo: 0x189C })
    );
}

#[test]
fn fa6_lea_abs_l_rexistro_decodificado_pola_formula_pinnada() {
    // `43 F9 00 00 85 A2`: lea (0x85A2).L,A1. rexistro = (0x43 >> 1) & 7 = 1.
    // (FA-6 conxelado originalmente usaba `4B`, que é A5: o byte do fixture
    // estaba mal, a fórmula pinada é correcta — desvio rexistrado.)
    let bytes = [0x43u8, 0xF9, 0x00, 0x00, 0x85, 0xA2];
    assert_eq!(
        decodificar(v(&bytes), 0x3000),
        Ok(Forma::LeaAbsL {
            registro: 1,
            operando: 0x85A2
        })
    );
}

#[test]
fn fa7_lea_abs_w_extension_curta_sen_signo() {
    // `43 F8 94 00`: lea ($9400).W,A1 -> 0x00009400. A extension curta NUNCA
    // se interpreta con signo: 0x9400 como i16 sería -0x6C00; eso sería
    // unha classe de erro que este test impide.
    let bytes = [0x43u8, 0xF8, 0x94, 0x00];
    assert_eq!(
        decodificar(v(&bytes), 0x3000),
        Ok(Forma::LeaAbsW {
            registro: 1,
            operando: 0x0000_9400
        })
    );
}

#[test]
fn fa8_lea_pcd16_positivo() {
    // `41 FA 00 22` en 0x002000: destino = 0x2000 + 2 + 0x22 = 0x2024.
    let bytes = [0x41u8, 0xFA, 0x00, 0x22];
    assert_eq!(
        decodificar(v(&bytes), 0x2000),
        Ok(Forma::LeaPcD16 {
            registro: 0,
            destino: 0x2024
        })
    );
}

#[test]
fn lea_pcd16_negativo() {
    // `45 FA FF FC` en 0x002000: disp = -4; destino = 0x2000 + 2 - 4 = 0x1FFE.
    let bytes = [0x45u8, 0xFA, 0xFF, 0xFC];
    assert_eq!(
        decodificar(v(&bytes), 0x2000),
        Ok(Forma::LeaPcD16 {
            registro: 2,
            destino: 0x1FFE
        })
    );
}

#[test]
fn jsr_e_jmp_abs_l_se_distinguen() {
    let jsr = [0x4Eu8, 0xB9, 0x00, 0x00, 0x85, 0xA2];
    let jmp = [0x4Eu8, 0xFD, 0x00, 0x00, 0x85, 0xA2];
    assert_eq!(
        decodificar(v(&jsr), 0x100),
        Ok(Forma::JsrAbsL { alvo: 0x85A2 })
    );
    assert_eq!(
        decodificar(v(&jmp), 0x100),
        Ok(Forma::JmpAbsL { alvo: 0x85A2 })
    );
    let jmpw = [0x4Eu8, 0xFC, 0x18, 0x9C];
    assert_eq!(
        decodificar(v(&jmpw), 0x100),
        Ok(Forma::JmpAbsW { alvo: 0x189C })
    );
}

#[test]
fn operando_longos_fóra_de_barramento_rexeitanse() {
    // 4E B9 con operando 0x01000000 (> 0xFFFFFF): o 68000 non pode ler eso.
    let bytes = [0x4Eu8, 0xB9, 0x01, 0x00, 0x00, 0x00];
    assert_eq!(
        decodificar(v(&bytes), 0x100),
        Err(InstrErro::AlvoFóraBarramento {
            calculado: 0x0100_0000
        })
    );
}

#[test]
fn bsr_que_sae_do_barramento_pol_positivo_rexeitado() {
    // `61 00 00 02` en 0x000000: base = 2, disp = +2 -> alvo = 4 (dentro).
    let dento = [0x61u8, 0x00, 0x00, 0x02];
    assert_eq!(decodificar(v(&dento), 0), Ok(Forma::BsrW { alvo: 4 }));
    // `61 00 00 04` en 0xFFFFFE: base = 0xFFFFFE + 2 = 0x1000000 xa fóra do
    // barramento de 24 bits: 0x1000000 + 4 = 0x1000004, rexéitase con serie.
    let fóra = [0x61u8, 0x00, 0x00, 0x04];
    assert_eq!(
        decodificar(v(&fóra), 0xFFFFFE),
        Err(InstrErro::AlvoFóraBarramento {
            calculado: 0x0100_0004
        })
    );
}

#[test]
fn bytes_incompletos_non_inventan_forma() {
    // `41 F9 00 00` — lea.l sen a longword completa: MoiCurta, non offset 0.
    let bytes = [0x41u8, 0xF9, 0x00, 0x00];
    assert_eq!(decodificar(v(&bytes), 0x100), Err(InstrErro::MoiCurta));
    let nada: [u8; 0] = [];
    assert_eq!(decodificar(&nada, 0), Err(InstrErro::MoiCurta));
}

#[test]
fn forma_non_modelada_rexeitada() {
    // `70 3F` (moveq) non e ningunha forma da cadea.
    let bytes = [0x70u8, 0x3F];
    assert_eq!(decodificar(v(&bytes), 0x100), Err(InstrErro::NonForma));
    // 4E F9 (trap?) non modelada; 0x4E e par, tampouco pasa por lea.
    let tramp = [0x4Eu8, 0xF9, 0x00, 0x00, 0x18, 0x9C];
    assert_eq!(decodificar(v(&tramp), 0x100), Err(InstrErro::NonForma));
}

#[test]
fn lea_abs_w_reg_decodifica_para_tódolos_an() {
    // `4F F8 00 10`: rexistro = (0x4F>>1)&7 = 7 (A7).
    let bytes = [0x4Fu8, 0xF8, 0x00, 0x10];
    assert_eq!(
        decodificar(v(&bytes), 0),
        Ok(Forma::LeaAbsW {
            registro: 7,
            operando: 0x10
        })
    );
}
