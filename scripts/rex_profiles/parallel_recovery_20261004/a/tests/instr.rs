//! Formas e aritmética relativas — fixtures montadas á man (EXPECTATIONS-A §3)
//! reancoradas á táboa normativa **v1.1** (RECTIFICACION-A §3).
//!
//! Os bytes das fixtures escríbense á man desde a táboa de expectativas; os
//! alvos esperados calcúlanse na justificación de cada test, non coa
//! ferramenta. Ningunha fixture se xera cun codificador propio: un round-trip
//! interno non proba a aritmética.
//!
//! Casos **superseded** (a súa expectativa v1 quedou refutada polo
//! instrumento pinado; anótase aquí, non se borra en silencio):
//! * `fa4` v1 aceptaba `61 FF` como BSR.L → v1.1 recúsao (`68020-non-declarado`).
//! * `fa5` v1 chamaba `jsr.w` a `4E FA` cero-extendido → v1.1: `4E FA` é
//!   `jmp.pcd16` e `jsr.w` é `4E B8` con signo.
//! * `fa7` v1 exigía `lea.w` sen signo → v1.1: extensión de sinal (medido
//!   `43f8 8000 → lea ffff8000,%a1`).
//! * os dous testes `…fóra de barramento…` v1 rexeitaban por rango → v1.1:
//!   `decodificar` é ISA pura (efectivo de 32 bits; o bus deriva en verify).
//! * `forma_non_modelada` v1 dicía que `4E F9` non era forma → v1.1: é
//!   `jmp.l` (medido); sonda-se `4E FB`, que si é NonForma.

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
fn fa4_bsr_ff_recusado_68020_non_declarado() {
    // SUPERSEDED: v1 aceptaba `61 FF dd dd dd dd` como BSR.L con base sitio+4.
    // v1.1 (RECTIFICACION §3): BSR.L é familia 68020+ — `as -m68000` rexeita
    // (`recusas.txt` S1: "needs 68020"), `wla-68000` rexeita. Recusa explícita
    // con motivo estable; non ampliamos a CPU en silencio.
    let bytes = [0x61u8, 0xFF, 0xFF, 0xFF, 0xFE, 0x00];
    assert_eq!(
        decodificar(v(&bytes), 0x010000),
        Err(InstrErro::Recusa {
            motivo: "68020-non-declarado"
        })
    );
}

#[test]
fn fa4b_bsr_s_dous_bytes() {
    // Forma curta v1.1 (instrumento, fxA03: `611a → bsrs 1c`): 2 bytes,
    // d8 signado, base = palabra de extensión (sitio + 2).
    let f = decodificar(v(&[0x61, 0x1A]), 0x00).unwrap();
    assert_eq!(f.nome(), "bsr.s");
    assert_eq!(f.lonxitude(), 2);
    match f {
        Forma::BsrS { alvo } => assert_eq!(alvo, 0x1C),
        outro => panic!("{outro:?}"),
    }
    // `61 f8` en 0x06 (fxA03 medido): base 0x08, d8 = -8 -> alvo 0x00.
    assert_eq!(
        decodificar(v(&[0x61, 0xF8]), 0x06),
        Ok(Forma::BsrS { alvo: 0x00 })
    );
}

#[test]
fn fa5_jsr_w_e_4eb8_con_extension_de_sinal() {
    // SUPERSEDED: v1 dicía `jsr.w = 4E FA` cero-extendido. Instrumento
    // (fxA02): `4eb8 9400 → jsr ffff9400` — jsr.w é **4E B8** e **herda o
    // signo**; `4E FA` é `jmp (d16,PC)` (ver r8 en tests/rectif.rs).
    let bytes = [0x4Eu8, 0xB8, 0x18, 0x9C];
    assert_eq!(
        decodificar(v(&bytes), 0x2000),
        Ok(Forma::JsrAbsW { alvo: 0x189C })
    );
    // bit15 ligado: 0x9400 -> efectivo 0xFFFF9400 (medido, non estimado).
    assert_eq!(
        decodificar(v(&[0x4E, 0xB8, 0x94, 0x00]), 0x2000),
        Ok(Forma::JsrAbsW { alvo: 0xFFFF_9400 })
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
fn fa7_lea_abs_w_con_extension_de_sinal() {
    // SUPERSEDED: v1 exigía cero-extensión ("A extension curta NUNCA se
    // interpreta con signo"). Refutado polo instrumento: fxA01-objdump mide
    // `43f8 8000 → lea ffff8000,%a1` e `45f8 7f00 → lea 7f00,%a2`. O campo
    // `operando` é dende v1.1 o **enderezo efectivo** de 32 bits.
    assert_eq!(
        decodificar(v(&[0x43u8, 0xF8, 0x80, 0x00]), 0x3000),
        Ok(Forma::LeaAbsW {
            registro: 1,
            operando: 0xFFFF_8000
        })
    );
    assert_eq!(
        decodificar(v(&[0x45u8, 0xF8, 0x7F, 0x00]), 0x3000),
        Ok(Forma::LeaAbsW {
            registro: 2,
            operando: 0x0000_7F00
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
fn jsr_e_jmp_abs_se_distinguen_todas_as_extensions() {
    // O conxelado v1 inventou `jmp.l = 4E FD` e `jmp.w = 4E FC`. Instrumento
    // (fxA02/sonda bruta): `4ef9` = jmp.l, `4ef8` = jmp.w, `4efc/fd` =
    // `.short` (indefinido). Cruzado con cstool e wla.
    let jsr = [0x4Eu8, 0xB9, 0x00, 0x00, 0x85, 0xA2];
    let jmp = [0x4Eu8, 0xF9, 0x00, 0x00, 0x85, 0xA2];
    assert_eq!(
        decodificar(v(&jsr), 0x100),
        Ok(Forma::JsrAbsL { alvo: 0x85A2 })
    );
    assert_eq!(
        decodificar(v(&jmp), 0x100),
        Ok(Forma::JmpAbsL { alvo: 0x85A2 })
    );
    let jmpw = [0x4Eu8, 0xF8, 0x18, 0x9C];
    assert_eq!(
        decodificar(v(&jmpw), 0x100),
        Ok(Forma::JmpAbsW { alvo: 0x189C })
    );
    // relativo: 4E BA = jsr (d16,PC), 4E FA = jmp (d16,PC) — base sitio+2.
    assert_eq!(
        decodificar(v(&[0x4E, 0xBA, 0x00, 0x04]), 0x2000),
        Ok(Forma::JsrPcD16 { alvo: 0x2006 })
    );
    assert_eq!(
        decodificar(v(&[0x4E, 0xFA, 0x00, 0x04]), 0x0018),
        Ok(Forma::JmpPcD16 { alvo: 0x001E })
    );
    // 4E FC/FD: indefinidos con motivo estable (r9/r10 en rectif.rs).
    for b in [[0x4Eu8, 0xFC, 0x12, 0x34], [0x4E, 0xFD, 0x00, 0x00]] {
        assert_eq!(
            decodificar(v(&b), 0x100),
            Err(InstrErro::Recusa {
                motivo: "indefinido-68000"
            })
        );
    }
}

#[test]
fn operando_longos_decodificase_efectivo_32b() {
    // SUPERSEDED: v1 rexeitaba `4E B9 01000000` con AlvoFóraBarramento.
    // v1.1 (RECTIFICACION §2): decodificar é ISA pura — reporta o efectivo
    // de 32 bits; a truncación a bus (`& 0xFF_FFFF`) e a rexión fanse na
    // capa de verificación.
    let bytes = [0x4Eu8, 0xB9, 0x01, 0x00, 0x00, 0x00];
    assert_eq!(
        decodificar(v(&bytes), 0x100),
        Ok(Forma::JsrAbsL { alvo: 0x0100_0000 })
    );
}

#[test]
fn bsr_rollover_decodificase_wrapping_a_32b() {
    // SUPERSEDED: v1 rexeitaba o alvo que pasaba de 0xFFFFFF. v1.1: aritmética
    // de PC con wrap — `61 00 00 04` en 0xFFFFFE: base = 0x1000000 (wrap a
    // 0 dentro do u32? non: 0xFFFFFE+2+4 = 0x1000004, efectivo lexítimo de
    // 32 bits; o bus sería 0x000004, materia da capa de rexións).
    let dento = [0x61u8, 0x00, 0x00, 0x02];
    assert_eq!(decodificar(v(&dento), 0), Ok(Forma::BsrW { alvo: 4 }));
    let fóra = [0x61u8, 0x00, 0x00, 0x04];
    assert_eq!(
        decodificar(v(&fóra), 0xFFFFFE),
        Ok(Forma::BsrW { alvo: 0x0100_0004 })
    );
}

#[test]
fn bytes_incompletos_non_inventan_forma() {
    // `41 F9 00 00` — lea.l sen a longword completa: MoiCurta, non offset 0.
    let bytes = [0x41u8, 0xF9, 0x00, 0x00];
    assert_eq!(decodificar(v(&bytes), 0x100), Err(InstrErro::MoiCurta));
    // `61 00` a secas: bsr.w sen d16 — MoiCurta (bsr.s sería `61 dd`, dd≠0).
    assert_eq!(
        decodificar(v(&[0x61, 0x00]), 0x100),
        Err(InstrErro::MoiCurta)
    );
    let nada: [u8; 0] = [];
    assert_eq!(decodificar(&nada, 0), Err(InstrErro::MoiCurta));
}

#[test]
fn forma_non_modelada_rexeitada() {
    // `70 3F` (moveq) non e ningunha forma da cadea.
    let bytes = [0x70u8, 0x3F];
    assert_eq!(decodificar(v(&bytes), 0x100), Err(InstrErro::NonForma));
    // SUPERSEDED: v1 usaba aquí `4E F9` ("trap? non modelada"); v1.1 sabe que
    // 4E F9 é jmp.l (medido, fxA02). Sonda NonForma honesta: `4E C9` é TRAP
    // #9 — 68000 real, pero nin na táboa normativa v1.1 nin na de recusas:
    // cae en NonForma (xa que `decodificar` só afirma o que a táboa pinna).
    let sen_forma = [0x4Eu8, 0xC9, 0x00, 0x00, 0x18, 0x9C];
    assert_eq!(decodificar(v(&sen_forma), 0x100), Err(InstrErro::NonForma));
    // indirectos por rexistro: existen en 68000 pero fóra do subconxunto.
    assert_eq!(
        decodificar(v(&[0x4E, 0xD0]), 0x100),
        Err(InstrErro::Recusa {
            motivo: "fora-de-subconxunto"
        })
    );
    assert_eq!(
        decodificar(v(&[0x4E, 0x92]), 0x100),
        Err(InstrErro::Recusa {
            motivo: "fora-de-subconxunto"
        })
    );
}

#[test]
fn lea_abs_w_reg_decodifica_para_tódolos_an() {
    // `4F F8 00 10`: rexistro = (0x4F>>1)&7 = 7 (A7). bit15=0: o signo non
    // altera o efectivo (v1.1 segue verde neste caso v1).
    let bytes = [0x4Fu8, 0xF8, 0x00, 0x10];
    assert_eq!(
        decodificar(v(&bytes), 0),
        Ok(Forma::LeaAbsW {
            registro: 7,
            operando: 0x10
        })
    );
}
