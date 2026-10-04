//! Subconxunto de instruccións 68000 que a cadea Kosinski modela.
//!
//! Só se decodifican formas concretas, coa aritmética relativa fixada en
//! `EXPECTATIONS-A.md` §3: o desprazamento de `Bcc`/`BSR`/`DBcc` e de
//! `(d16,PC)` é relativo á **palabra de extensión** (`sitio + 2`), non ao fin
//! dinámico da execución. `bsr.l` toma `sitio + 4` porque a extensión ocupa
//! seis bytes no total. Unha instrución que calcule un alvo fóra do barramento
//! de 24 bits do 68000 non é un vínculo: é `AlvoFóraBarramento`.

/// Barramento de 24 bits do 68000 (MD1/MD2 sen MMU).
pub const BARRAMENTO: i64 = 0xFF_FFFF;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Forma {
    /// `lea (xxx).L,An` — `4x F9` + longword.
    LeaAbsL { registro: u8, operando: u32 },
    /// `lea (xxx).W,An` — `4x F8` + palabra; extensión curta cero-extendida.
    LeaAbsW { registro: u8, operando: u32 },
    /// `lea (d16,PC),An` — `4x FA` + d16 con signo, base `sitio + 2`.
    LeaPcD16 { registro: u8, destino: u32 },
    /// `bsr.w` — `61 dd` co `dd != FF`; alvo = `sitio + 2 + d16` signado.
    BsrW { alvo: u32 },
    /// `bsr.l` — `61 FF dd dd dd dd`; alvo = `sitio + 4 + d32` signado.
    BsrL { alvo: u32 },
    /// `jsr (xxx).L` — `4E B9`.
    JsrAbsL { alvo: u32 },
    /// `jsr (xxx).W` — `4E FA`.
    JsrAbsW { alvo: u32 },
    /// `jmp (xxx).L` — `4E FD`.
    JmpAbsL { alvo: u32 },
    /// `jmp (xxx).W` — `4E FC`.
    JmpAbsW { alvo: u32 },
}

impl Forma {
    /// Nome estable da forma para o contrato (`rex-kosinski-chain/v1`).
    pub fn nome(&self) -> String {
        match self {
            Forma::LeaAbsL { registro, .. } => format!("lea.l/A{registro}"),
            Forma::LeaAbsW { registro, .. } => format!("lea.w/A{registro}"),
            Forma::LeaPcD16 { registro, .. } => format!("lea.pcd16/A{registro}"),
            Forma::BsrW { .. } => "bsr.w".to_string(),
            Forma::BsrL { .. } => "bsr.l".to_string(),
            Forma::JsrAbsL { .. } => "jsr.l".to_string(),
            Forma::JsrAbsW { .. } => "jsr.w".to_string(),
            Forma::JmpAbsL { .. } => "jmp.l".to_string(),
            Forma::JmpAbsW { .. } => "jmp.w".to_string(),
        }
    }

    /// Bytes que ocupa a instrución na imaxe.
    pub fn lonxitude(&self) -> usize {
        match self {
            Forma::LeaAbsL { .. } | Forma::JsrAbsL { .. } | Forma::JmpAbsL { .. } => 6,
            Forma::BsrL { .. } => 6,
            Forma::LeaAbsW { .. } | Forma::LeaPcD16 { .. } | Forma::BsrW { .. } => 4,
            Forma::JsrAbsW { .. } | Forma::JmpAbsW { .. } => 4,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InstrErro {
    /// A xanela de bytes non chega para completar a forma.
    MoiCurta,
    /// Os bytes non cumpren ningunha forma desta conxunto.
    NonForma,
    /// A forma calcula un alvo fóra de `0x000000..=0xFFFFFF`.
    AlvoFóraBarramento { calculado: i64 },
}

/// Decodifica a instrución que comeza exactamente en `bytes[0]`, informada
/// pola súa dirección de imaxe `sitio` (para as formas relativas).
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
                // Extension curta: cero-extendida, NUNCA con signo.
                return Ok(Forma::LeaAbsW {
                    registro,
                    operando: u32::from(be16(&bytes[2..4])),
                });
            }
            0xFA => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                let destino = sumar_relativo(sitio, 2, sign16(be16(&bytes[2..4])) as i64)?;
                return Ok(Forma::LeaPcD16 { registro, destino });
            }
            _ => {}
        }
    }
    if b0 == 0x61 {
        if b1 == 0xFF {
            if bytes.len() < 6 {
                return Err(InstrErro::MoiCurta);
            }
            let alvo = sumar_relativo(sitio, 4, i64::from(sign32(be32(&bytes[2..6]))))?;
            return Ok(Forma::BsrL { alvo });
        }
        if bytes.len() < 4 {
            return Err(InstrErro::MoiCurta);
        }
        let disp = sign16(be16(&bytes[2..4]));
        let alvo = sumar_relativo(sitio, 2, disp as i64)?;
        return Ok(Forma::BsrW { alvo });
    }
    if b0 == 0x4E {
        match b1 {
            0xB9 => {
                if bytes.len() < 6 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JsrAbsL {
                    alvo: operando_rom(be32(&bytes[2..6]))?,
                });
            }
            0xFD => {
                if bytes.len() < 6 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JmpAbsL {
                    alvo: operando_rom(be32(&bytes[2..6]))?,
                });
            }
            0xFA => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JsrAbsW {
                    alvo: u32::from(be16(&bytes[2..4])),
                });
            }
            0xFC => {
                if bytes.len() < 4 {
                    return Err(InstrErro::MoiCurta);
                }
                return Ok(Forma::JmpAbsW {
                    alvo: u32::from(be16(&bytes[2..4])),
                });
            }
            _ => {}
        }
    }
    Err(InstrErro::NonForma)
}

/// `true` se `bytes` poderían ser a metade baixa dunha palabra impar — a
/// conxunto só se usa con sitios aliñados a palabra (as instrucións 68000
/// están aliñadas: un opcode en desprazamento impar non é código).
pub fn sitio_aliñado(sitio: u32) -> bool {
    sitio % 2 == 0
}

fn operando_rom(v: u32) -> Result<u32, InstrErro> {
    if i64::from(v) <= BARRAMENTO {
        Ok(v)
    } else {
        Err(InstrErro::AlvoFóraBarramento {
            calculado: i64::from(v),
        })
    }
}

fn sumar_relativo(sitio: u32, base: i64, disp: i64) -> Result<u32, InstrErro> {
    let alvo = i64::from(sitio) + base + disp;
    if !(0..=BARRAMENTO).contains(&alvo) {
        return Err(InstrErro::AlvoFóraBarramento { calculado: alvo });
    }
    // `alvo` está en 0..=0xFFFFFF, sempre cabe en u32.
    Ok(alvo as u32)
}

fn be16(x: &[u8]) -> u16 {
    u16::from_be_bytes([x[0], x[1]])
}

fn be32(x: &[u8]) -> u32 {
    u32::from_be_bytes([x[0], x[1], x[2], x[3]])
}

fn sign16(v: u16) -> i16 {
    v as i16
}

fn sign32(v: u32) -> i32 {
    v as i32
}
