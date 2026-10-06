//! Subconxunto de instruccións 68000 que a cadea Kosinski modela — **v1.1**
//! (RECTIFICACION-A.md, conxelada 2026-10-04 antes da corrección).
//!
//! Perfil declarado `md68000-chain16`: MC68000 base máis exactamente a
//! extensión de deslocamento de palabra en BSR (`61 00 dd dd`), aceptada pol
//! instrumento `m68k-elf-as -m68000` e medida no corpus. Só se decodifican
//! as formas da táboa §3 da rectificación, coa aritmética fixada polo
//! instrumento pinado (`m68k-elf-as`/`m68k-elf-objdump` binutils 2.41,
//! cruzado con `wla-68000` e capstone 5.0.9; ver `fixtures/*-objdump.txt`):
//!
//! * Os desprazamentos relativos (`Bcc`/`BSR`/`(d16,PC)`) son relativos á
//!   **palabra de extensión** (`sitio + 2`), non ao fin dinámico.
//! * `(xxx).W` leva **extensión de sinal** a 32 bits (medido:
//!   `43f8 8000 → lea ffff8000,%a1`; `4eb8 9400 → jsr ffff9400`).
//! * `decodificar` é ISA pura: reporta o **enderezo efectivo de 32 bits** e
//!   nunca clampa nin rexeita por rango; a truncación a bus de 24 bits
//!   (`efectivo & 0xFF_FFFF`) e a tradución a desprazamento de ficheiro
//!   fanse na capa de verificación (modelo de tres niveis, RECTIFICACION §2).
//! * As formas non suportadas producen `InstrErro::Recusa` con motivo
//!   estable: `68020-non-declarado` (`61 FF`), `indefinido-68000`
//!   (`4E FC`/`4E FD`), `fora-de-subconxunto` (indirectos por rexistro
//!   `4E 90..9F`/`4E D0..DF`, `bra`/`Bcc` `60..67`, `Scc`/`DBcc`
//!   `50..5F` con `b1 & 0xC0 == 0xC0`, é dicir `C0..FF` — a máscara casa
//!   as dúas familias; rótulo correxido por `REVISAO-C-DE-A-ETAPA3.md` §1.5,
//!   comportamento idéntico).

/// Máscara do bus de 24 bits do 68000 (A0–A23): `bus = efectivo & BARRAMENTO`.
/// O efectivo de 32 bits pode exceder o bus (extensión de sinal ou rollover
/// da PC); iso non é erro ISA, é materia da capa de rexións.
pub const BARRAMENTO: u32 = 0xFF_FFFF;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Forma {
    /// `lea (xxx).L,An` — `4x F9` + longword; operativo = efectivo 32 bits.
    LeaAbsL { registro: u8, operando: u32 },
    /// `lea (xxx).W,An` — `4x F8` + palabra; **extensión de sinal** (v1.1).
    LeaAbsW { registro: u8, operando: u32 },
    /// `lea (d16,PC),An` — `4x FA` + d16 con signo, base `sitio + 2`.
    LeaPcD16 { registro: u8, destino: u32 },
    /// `bsr.b`/BSR curto — `61 dd` co `dd ∉ {00, FF}`; **2 bytes**;
    /// alvo = `sitio + 2 + d8` signado.
    BsrS { alvo: u32 },
    /// BSR con deslocamento de palabra — `61 00 dd dd` (extensión chain16
    /// declarada); 4 bytes; alvo = `sitio + 2 + d16` signado.
    BsrW { alvo: u32 },
    /// `jsr (xxx).L` — `4E B9` + longword.
    JsrAbsL { alvo: u32 },
    /// `jsr (xxx).W` — `4E B8` + palabra con extensión de sinal (v1.1).
    JsrAbsW { alvo: u32 },
    /// `jsr (d16,PC)` — `4E BA`; alvo = `sitio + 2 + d16`.
    JsrPcD16 { alvo: u32 },
    /// `jmp (xxx).L` — `4E F9` (v1.1; o conxelado v1 dicía `4E FD`).
    JmpAbsL { alvo: u32 },
    /// `jmp (xxx).W` — `4E F8` (v1.1; o conxelado v1 dicía `4E FC`).
    JmpAbsW { alvo: u32 },
    /// `jmp (d16,PC)` — `4E FA` (v1.1; o conxelado v1 chamáballe `jsr.w`).
    JmpPcD16 { alvo: u32 },
}

impl Forma {
    /// Nome estable da forma para o contrato (`rex-kosinski-chain/v1.1`).
    pub fn nome(&self) -> String {
        match self {
            Forma::LeaAbsL { registro, .. } => format!("lea.l/A{registro}"),
            Forma::LeaAbsW { registro, .. } => format!("lea.w/A{registro}"),
            Forma::LeaPcD16 { registro, .. } => format!("lea.pcd16/A{registro}"),
            Forma::BsrS { .. } => "bsr.s".to_string(),
            Forma::BsrW { .. } => "bsr.w".to_string(),
            Forma::JsrAbsL { .. } => "jsr.l".to_string(),
            Forma::JsrAbsW { .. } => "jsr.w".to_string(),
            Forma::JsrPcD16 { .. } => "jsr.pcd16".to_string(),
            Forma::JmpAbsL { .. } => "jmp.l".to_string(),
            Forma::JmpAbsW { .. } => "jmp.w".to_string(),
            Forma::JmpPcD16 { .. } => "jmp.pcd16".to_string(),
        }
    }

    /// Bytes que ocupa a instrución na imaxe.
    pub fn lonxitude(&self) -> usize {
        match self {
            Forma::BsrS { .. } => 2,
            Forma::LeaAbsL { .. } | Forma::JsrAbsL { .. } | Forma::JmpAbsL { .. } => 6,
            Forma::LeaAbsW { .. }
            | Forma::LeaPcD16 { .. }
            | Forma::BsrW { .. }
            | Forma::JsrAbsW { .. }
            | Forma::JsrPcD16 { .. }
            | Forma::JmpAbsW { .. }
            | Forma::JmpPcD16 { .. } => 4,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InstrErro {
    /// A xanela de bytes non chega para completar a forma.
    MoiCurta,
    /// Os bytes non cumpren ningunha forma coñecida desta conxunto.
    NonForma,
    /// Forma coñecida que o perfil declarado non admite: recusa **explícita**
    /// con motivo estable (RECTIFICACION-A §3), nunca aceptación silenciosa.
    Recusa { motivo: &'static str },
}

/// Decodifica a instrución que comeza exactamente en `bytes[0]`, informada
/// pola súa dirección de imaxe `sitio` (para as formas relativas). O campo
/// de enderezo de cada forma é o **efectivo de 32 bits**: aquí non se clampa
/// nin se rexeita por rango (modelo de tres niveis, RECTIFICACION §2).
pub fn decodificar(bytes: &[u8], sitio: u32) -> Result<Forma, InstrErro> {
    let b = |i: usize| -> Option<u8> { bytes.get(i).copied() };
    let (b0, b1) = match (b(0), b(1)) {
        (Some(x), Some(y)) => (x, y),
        _ => return Err(InstrErro::MoiCurta),
    };
    // lea: primeiro byte 4x impar (exclúe 4E — jmp/jsr, par), segundo byte
    // selecciona a extensión de enderzo.
    if b0 & 0xF0 == 0x40 && b0 & 1 == 1 {
        let registro = (b0 >> 1) & 7;
        match b1 {
            0xF9 => {
                if bytes.len() < 6 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::LeaAbsL {
                    registro,
                    operando: be32(&bytes[2..6]),
                });
            }
            0xF8 => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                // v1.1 (medido `43f8 8000 -> lea ffff8000,%a1`): EXTENSIÓN
                // DE SINAL do word a 32 bits. O conxelado v1 cero-extendía.
                return Ok(Forma::LeaAbsW {
                    registro,
                    operando: sign16(be16(&bytes[2..4])) as u32,
                });
            }
            0xFA => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                let destino = efectivo_relativo(sitio, sign16(be16(&bytes[2..4])));
                return Ok(Forma::LeaPcD16 { registro, destino });
            }
            _ => {}
        }
    }
    if b0 == 0x61 {
        if b1 == 0xFF {
            // BSR.L é familia 68020+ (instrumento -m68000: "needs 68020";
            // wla: "Cannot process"). Recusa explícita: non ampliamos a CPU.
            return Err(InstrErro::Recusa {
                motivo: "68020-non-declarado",
            });
        }
        if b1 == 0x00 {
            // Forma de palabra (extensión chain16 declarada): 4 bytes.
            if bytes.len() < 4 {
                return Err(InstrErro::MoiCurta);
            }
            let alvo = efectivo_relativo(sitio, sign16(be16(&bytes[2..4])));
            return Ok(Forma::BsrW { alvo });
        }
        // BSR.S curto: 2 bytes, d8 signado (medido `611a -> bsrs 1c`).
        let alvo = efectivo_relativo(sitio, i64::from(b1 as i8));
        return Ok(Forma::BsrS { alvo });
    }
    if b0 == 0x4E {
        match b1 {
            0xB9 => {
                if bytes.len() < 6 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JsrAbsL {
                    alvo: be32(&bytes[2..6]),
                });
            }
            0xB8 => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JsrAbsW {
                    alvo: sign16(be16(&bytes[2..4])) as u32,
                });
            }
            0xBA => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JsrPcD16 {
                    alvo: efectivo_relativo(sitio, sign16(be16(&bytes[2..4]))),
                });
            }
            0xF9 => {
                if bytes.len() < 6 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JmpAbsL {
                    alvo: be32(&bytes[2..6]),
                });
            }
            0xF8 => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JmpAbsW {
                    alvo: sign16(be16(&bytes[2..4])) as u32,
                });
            }
            0xFA => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JmpPcD16 {
                    alvo: efectivo_relativo(sitio, sign16(be16(&bytes[2..4]))),
                });
            }
            0xFC | 0xFD => {
                // O instrumento imprímelos como `.short`: non son formas
                // 68000 (o conxelado v1 inventáballe jmp.w/jmp.l).
                return Err(InstrErro::Recusa {
                    motivo: "indefinido-68000",
                });
            }
            _ if (0x90..=0x9F).contains(&b1) || (0xD0..=0xDF).contains(&b1) => {
                // jsr/jmp indirecto por rexistro (medido `4ed0 = jmp %a0@`,
                // `4e92 = jsr %a2@`): existe en 68000 pero está fóra do
                // subconxunto declarado.
                return Err(InstrErro::Recusa {
                    motivo: "fora-de-subconxunto",
                });
            }
            _ => {}
        }
    }
    if (0x60..=0x67).contains(&b0) {
        // bra/Bcc (medido `6000 -> braw`, `6700 -> beqw`): fora do subconxunto.
        return Err(InstrErro::Recusa {
            motivo: "fora-de-subconxunto",
        });
    }
    if (0x50..=0x5F).contains(&b0) && b1 & 0xC0 == 0xC0 {
        // DBcc/Scc (medido `51cb -> dbf %d3`): fora do subconxunto.
        return Err(InstrErro::Recusa {
            motivo: "fora-de-subconxunto",
        });
    }
    Err(InstrErro::NonForma)
}

/// `true` se `bytes` poderían ser a metade baixa dunha palabra impar — a
/// conxunto só se usa con sitios aliñados a palabra (as instrucións 68000
/// están aliñadas: un opcode en desprazamento impar non é código).
pub fn sitio_aliñado(sitio: u32) -> bool {
    sitio % 2 == 0
}

/// Enderezo efectivo de 32 bits para formas relativas: `sitio + 2 + disp`,
/// con aritmética de PC en tres dígito—wrap a 32 bits (o bus de 24 bits
/// deriva na capa de verificación; aquí non se clampa nada).
fn efectivo_relativo(sitio: u32, disp: i64) -> u32 {
    (i64::from(sitio) + 2 + disp) as u32
}

fn be16(x: &[u8]) -> u16 {
    u16::from_be_bytes([x[0], x[1]])
}

fn be32(x: &[u8]) -> u32 {
    u32::from_be_bytes([x[0], x[1], x[2], x[3]])
}

fn sign16(v: u16) -> i64 {
    i64::from(v as i16)
}
