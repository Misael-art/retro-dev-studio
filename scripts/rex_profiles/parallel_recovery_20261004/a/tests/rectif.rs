//! Tests discriminantes da RECTIFICACION-A (v1.1) — escríbense ANTES da
//! corrección e **deen fallar no HEAD `cbb6895`** (misión, paso 3).
//!
//! Cada bytes e cada alvo provén do instrumento pinado
//! (`m68k-elf-as`/`m68k-elf-objdump` binutils 2.41 —
//! `fixtures/fxA01..fxA04-objdump.txt` — cruzado con `wla-68000` e `cstool`),
//! nunca do propio decoder. Os nomes de forma (`bsr.s`, `jsr.pcd16`, …) e os
//! motivos de recusa (`68020-non-declarado`, `indefinido-68000`,
//! `fora-de-subconxunto`) están conxelados en RECTIFICACION-A §3.

use rex_chain::instr::{decodificar, Forma};

fn nome(bytes: &[u8], sitio: u32) -> String {
    decodificar(bytes, sitio)
        .unwrap_or_else(|e| panic!("esperado Ok para {bytes:02X?} en {sitio:#X}: {e:?}"))
        .nome()
}

fn err_serie(bytes: &[u8], sitio: u32) -> String {
    match decodificar(bytes, sitio) {
        Ok(f) => panic!("esperado Err para {bytes:02X?} en {sitio:#X}, obtido {f:?}"),
        Err(e) => format!("{e:?}"),
    }
}

// — Defecto "BSR curto consumido como BSR de palabra" —

#[test]
fn r1_bsr_s_dous_bytes() {
    // Instrumento: `611a` en 0x00 -> `bsrs 1c` (fxA03-objdump). d8=+0x1A,
    // base=sitio+2: 0 + 2 + 0x1A = 0x1C. HEAD le 4 bytes: MoiCurta/NonForma.
    let f = decodificar(&[0x61, 0x1A], 0x0000).expect("bsr.s valido");
    assert_eq!(f.nome(), "bsr.s");
    assert_eq!(f.lonxitude(), 2, "BSR.S ocupa 2 bytes, non 4");
    assert!(format!("{f:?}").contains("alvo: 28"), "{f:?} != 0x1C");
}

#[test]
fn r1b_bsr_s_negativo_e_autodiscriminante() {
    // `61 f8` en 0x06 (fxA03): base 8, d8=-8 -> alvo 0 (backward).
    let f = decodificar(&[0x61, 0xF8], 0x0006).expect("bsr.s backward");
    assert_eq!(f.lonxitude(), 2);
    assert!(format!("{f:?}").contains("alvo: 0"), "{f:?}");
    // `61 05` en 0x1370 (cstool medido): alvo 0x1377 = 5997.
    assert_eq!(nome(&[0x61, 0x05], 0x1370), "bsr.s");
}

// — Defecto "61FF/BSR longo mestura variantes de CPU" —

#[test]
fn r2_bsr_ff_recusado_non_aceptado() {
    // `61 FF 00 00 12 34`: familia 68020 (as -m68000: "needs 68020",
    // recusas.txt S1; wla: Cannot process). Recusa explícita con motivo.
    let serie = err_serie(&[0x61, 0xFF, 0x00, 0x00, 0x12, 0x34], 0x0100);
    assert!(
        serie.contains("68020-non-declarado"),
        "motivo inestable ou aceptado: {serie}"
    );
}

// — Defectos jsr.w=4EB8 / jmp.w=4EF8 / jmp.l=4EF9 (conxelado dicia
//    4EFA/4EFC/4EFD) —

#[test]
fn r3_jsr_w_e_4eb8_con_signo() {
    // Instrumento: `4eb8 9400` -> `jsr ffff9400` (fxA02-objdump). Efectivo
    // 32 bits con extension de sinal: 0xFFFF9400 = 4294939648.
    let f = decodificar(&[0x4E, 0xB8, 0x94, 0x00], 0).expect("jsr.w 4eb8");
    assert_eq!(f.nome(), "jsr.w");
    assert_eq!(f.lonxitude(), 4);
    assert!(format!("{f:?}").contains("alvo: 4294939648"), "{f:?}");
    // `4eb8 1234` (bit15 apagado): alvo 0x1234 = 4660.
    assert!(format!("{:?}", decodificar(&[0x4E, 0xB8, 0x12, 0x34], 0).unwrap())
        .contains("alvo: 4660"));
}

#[test]
fn r5_jmp_w_e_4ef8() {
    // Instrumento: `4ef8 1234` -> `jmp 1234` (fxA02). HEAD: NonForma.
    let f = decodificar(&[0x4E, 0xF8, 0x12, 0x34], 0).expect("jmp.w 4ef8");
    assert_eq!(f.nome(), "jmp.w");
    assert_eq!(f.lonxitude(), 4);
    // bit15 ligado -> signo tamén (medido: `4ef8 9400 -> jmp ffff9400`).
    assert!(format!("{:?}", decodificar(&[0x4E, 0xF8, 0x94, 0x00], 0).unwrap())
        .contains("alvo: 4294939648"));
}

#[test]
fn r6_jmp_l_e_4ef9() {
    // Instrumento: `4ef9 1234 5678` -> `jmp 12345678` (fxA02; tamén
    // sonda-opcodes-brutos). HEAD tratábao como NonForma ("trap?").
    let f = decodificar(&[0x4E, 0xF9, 0x00, 0x00, 0x85, 0xA2], 0x100).expect("jmp.l 4ef9");
    assert_eq!(f.nome(), "jmp.l");
    assert_eq!(f.lonxitude(), 6);
    assert!(format!("{f:?}").contains("alvo: 34210"), "{f:?}"); // 0x85A2
}

#[test]
fn r7_jsr_pcd16_e_4eba() {
    // Instrumento: `4eba 0004` en 0x0A -> `jsr %pc@(10)`; cstool en 0x2000:
    // alvo = 0x2000+2+4 = 0x2006 = 8202.
    let f = decodificar(&[0x4E, 0xBA, 0x00, 0x04], 0x2000).expect("jsr.pcd16 4eba");
    assert_eq!(f.nome(), "jsr.pcd16");
    assert_eq!(f.lonxitude(), 4);
    assert!(format!("{f:?}").contains("alvo: 8202"), "{f:?}");
}

#[test]
fn r8_jmp_pcd16_e_4efa_non_jsr_w() {
    // FALSO RECOÑECEMENTO central: o conxelado v1 chamaba "jsr.w $189C" a
    // `4E FA 18 9C`. Instrumento: `4efa 1234 -> jmp %pc@(1236)` e
    // `4efa 0004` en 0x18 -> `jmp %pc@(1e)`. Para sitio 0:
    // alvo = 0 + 2 + 0x189C = 0x189E = 6302.
    let f = decodificar(&[0x4E, 0xFA, 0x18, 0x9C], 0).expect("jmp.pcd16 4efa");
    assert_eq!(f.nome(), "jmp.pcd16", "4E FA non e jsr.w");
    assert_eq!(f.lonxitude(), 4);
    assert!(format!("{f:?}").contains("alvo: 6302"), "{f:?}");
}

// — 4EFC/4EFD indefinidos; indirectos (An) fora de subconxunto —

#[test]
fn r9_4efc_indefinido() {
    // objdump imprime `4efc` como `.short 0x4efc` (sonda bruta): non hai
    // forma 68000 ahi. HEAD inventaba "jmp.w".
    let serie = err_serie(&[0x4E, 0xFC, 0x12, 0x34], 0x100);
    assert!(serie.contains("indefinido-68000"), "{serie}");
}

#[test]
fn r10_4efd_indefinido() {
    // objdump: `.short 0x4efd` — HEAD inventaba "jmp.l".
    let serie = err_serie(&[0x4E, 0xFD, 0x00, 0x00, 0x18, 0x9C], 0x100);
    assert!(serie.contains("indefinido-68000"), "{serie}");
}

#[test]
fn r11_indirectos_an_fora_de_subconxunto() {
    // Instrumento: `4ed0 = jmp %a0@`, `4e92 = jsr %a2@` (fxA02/fxA04 dump).
    // Assemblan en 68000 pero o subconxunto declarado non os inclúe: recusa
    // con motivo estable (HEAD: NonForma xeral, sen motivo).
    for bse in [&[0x4E, 0xD0][..], &[0x4E, 0x92][..]] {
        let serie = err_serie(bse, 0x100);
        assert!(serie.contains("fora-de-subconxunto"), "{serie}");
    }
    // bra/beq/dbcc (fxA04: 6000 000c / 6700 0008 / 51cb 0004): mesmo motivo.
    for bse in [
        &[0x60, 0x00, 0x00, 0x0C][..],
        &[0x67, 0x00, 0x00, 0x08][..],
        &[0x51, 0xCB, 0x00, 0x04][..],
    ] {
        let serie = err_serie(bse, 0x100);
        assert!(serie.contains("fora-de-subconxunto"), "{serie}");
    }
}

// — Defecto "LEA absoluto curto sen extensión de sinal" —

#[test]
fn r12_lea_w_signo_bit15() {
    // Instrumento: `43f8 8000 -> lea ffff8000,%a1` (fxA01). O campo
    // `operando` pasa a ser o ENDEREZO EFECTIVO de 32 bits.
    let f = decodificar(&[0x43, 0xF8, 0x80, 0x00], 0x3000).expect("lea.w");
    match f {
        Forma::LeaAbsW { registro, operando } => {
            assert_eq!(registro, 1);
            assert_eq!(operando, 0xFFFF_8000, "sen extension de sinal: defecto v1");
        }
        outro => panic!("forma equivocada: {outro:?}"),
    }
    // bit15=0: `45f8 7f00 -> lea 7f00,%a2` (fxA01).
    let ok = decodificar(&[0x45, 0xF8, 0x7F, 0x00], 0).unwrap();
    match ok {
        Forma::LeaAbsW { registro, operando } => {
            assert_eq!((registro, operando), (2, 0x7F00));
        }
        outro => panic!("{outro:?}"),
    }
}

// — Modelo de tres niveis: o decode xa non rexeita >24 bits; sepárao —

#[test]
fn r13_jsr_l_25_bits_e_forma_valida_efectivo_32b() {
    // `4eb9 01000000`: HEAD rexeitaba con AlvoFóraBarramento. v1.1: decodificar
    // é ISA pura — reporta o efectivo de 32 bits; a truncación a bus (24 pi
    // 68000) e o offset de ficheiro fanse na capa de verificación.
    let f = decodificar(&[0x4E, 0xB9, 0x01, 0x00, 0x00, 0x00], 0x100).expect("jsr.l valido");
    assert_eq!(f.nome(), "jsr.l");
    assert!(format!("{f:?}").contains("alvo: 16777216"), "{f:?}");
}

#[test]
fn r14_bsr_w_cadea_real_sonic_segue_valida() {
    // FA-2 real: `61 00 E8 0C` en 0x308E -> 0x189C (mantense; anchor de que
    // a correção non rompe as cadeas). Tamén FA-1: 61 00 05 2A @0x1370.
    let a = decodificar(&[0x61, 0x00, 0xE8, 0x0C], 0x308E).unwrap();
    assert_eq!(a.nome(), "bsr.w");
    assert!(format!("{a:?}").contains("alvo: 6300"), "{a:?}"); // 0x189C
    let b = decodificar(&[0x61, 0x00, 0x05, 0x2A], 0x1370).unwrap();
    assert!(format!("{b:?}").contains("alvo: 6300"), "{b:?}");
}

// — Walks sobre os fixtures montados polo instrumento —

#[test]
fn r15_andar_fx_a01_lea() {
    let bin = include_bytes!("../fixtures/fxA01_lea.bin");
    let esperado: [(usize, &str, usize); 5] = [
        (0x00, "lea.l/A0", 6),
        (0x06, "lea.w/A1", 4),
        (0x0A, "lea.w/A2", 4),
        (0x0E, "lea.pcd16/A3", 4),
        (0x12, "lea.pcd16/A4", 4),
    ];
    for (sitio, nome_forma, lonx) in esperado {
        let f = decodificar(&bin[sitio..], sitio as u32).unwrap_or_else(|e| {
            panic!("fxA01 en {sitio:#04X}: {e:?}");
        });
        assert_eq!(f.nome(), nome_forma, "fxA01 @{sitio:#04X}");
        assert_eq!(f.lonxitude(), lonx, "fxA01 @{sitio:#04X}");
    }
    // lea.w/A1 co bit15: efectivo 0xFFFF8000 (instrumento) e nada clampa.
    let f = decodificar(&bin[0x06..], 0x06).unwrap();
    match f {
        Forma::LeaAbsW { operando, .. } => assert_eq!(operando, 0xFFFF8000),
        outro => panic!("{outro:?}"),
    }
    // lea.pcd16 @0x0E disp +8: 0x0E+2+8 = 0x18 = fxA01_fin (fxA01-objdump).
    assert!(format!("{:?}", decodificar(&bin[0x0E..], 0x0E).unwrap()).contains("destino: 24"));
}

#[test]
fn r16_andar_fx_a02_calls() {
    let bin = include_bytes!("../fixtures/fxA02_calls.bin");
    let esperado: [(usize, &str); 6] = [
        (0x00, "jsr.l"),
        (0x06, "jsr.w"),
        (0x0A, "jsr.pcd16"),
        (0x0E, "jmp.l"),
        (0x14, "jmp.w"),
        (0x18, "jmp.pcd16"),
    ];
    for (sitio, nome_forma) in esperado {
        let f = decodificar(&bin[sitio..], sitio as u32)
            .unwrap_or_else(|e| panic!("fxA02 en {sitio:#04X}: {e:?}"));
        assert_eq!(f.nome(), nome_forma);
    }
    // @0x06 jsr.w 0x9400: efectivo 0xFFFF9400; @0x14 jmp.w idem.
    for s in [0x06usize, 0x14] {
        let serie = format!("{:?}", decodificar(&bin[s..], s as u32).unwrap());
        assert!(serie.contains("alvo: 4294939648"), "fxA02 @{s:#04X}: {serie}");
    }
    // @0x1C `4ed0` e @0x1E `4e92`: indirectos — recusa estable.
    for s in [0x1Cusize, 0x1E] {
        let serie = match decodificar(&bin[s..], s as u32) {
            Ok(f) => panic!("fxA02 @{s:#04X} non debe decodificarse: {f:?}"),
            Err(e) => format!("{e:?}"),
        };
        assert!(serie.contains("fora-de-subconxunto"), "{serie}");
    }
}

#[test]
fn r17_andar_fx_a03_bsr() {
    let bin = include_bytes!("../fixtures/fxA03_bsr.bin");
    let esperado: [(usize, &str, usize, u32); 5] = [
        (0x00, "bsr.s", 2, 0x1C),
        (0x02, "bsr.w", 4, 0x1C),
        (0x06, "bsr.s", 2, 0x00),
        (0x08, "bsr.w", 4, 0x00),
        (0x0C, "bsr.w", 4, 0x1C), // `bsr` automatico do montador = forma de palabra
    ];
    for (sitio, nome_forma, lonx, alvo) in esperado {
        let f = decodificar(&bin[sitio..], sitio as u32)
            .unwrap_or_else(|e| panic!("fxA03 en {sitio:#04X}: {e:?}"));
        assert_eq!(f.nome(), nome_forma);
        assert_eq!(f.lonxitude(), lonx);
        assert!(
            format!("{f:?}").contains(&format!("alvo: {alvo}")),
            "fxA03 @{sitio:#04X}: {f:?} != alvo {alvo}"
        );
    }
}

#[test]
fn r18_andar_fx_a04_todos_recusados() {
    let bin = include_bytes!("../fixtures/fxA04_recusa.bin");
    let sondas = [0x00usize, 0x02, 0x04, 0x08, 0x0C];
    for sitio in sondas {
        let serie = match decodificar(&bin[sitio..], sitio as u32) {
            Ok(f) => panic!("fxA04 @{sitio:#04X} aceptado: {f:?}"),
            Err(e) => format!("{e:?}"),
        };
        assert!(
            serie.contains("fora-de-subconxunto") || serie.contains("indefinido-68000"),
            "fxA04 @{sitio:#04X}: {serie}"
        );
    }
}
