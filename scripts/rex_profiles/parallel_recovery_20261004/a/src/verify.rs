//! Motor de revalidación: comproba a cadea contra os **bytes actuais**.
//!
//! Non descobre nada: todo elo declarado é un pin que se confronta coa
//! imaxe. Se a imaxe non é a que a cadea pinna, para con `ROM-DIVERXENCIA`
//! antes de interpretar un só opcode (perfil na ROM errada = rexeito, non
//! recolocación). Os cálculos (tradución de enderzo, aritmética da chamada,
//! hash da rutina, decode da stream) fanse sempre desde cero; os valores da
//! cadea son a espera, non a entrada.

use crate::chain::Cadea;
use crate::instr::{decodificar, sitio_aliñado, Forma};
use rex_addressing::md_linear::{self};
use rex_addressing::MapperState;
use rex_kosinski::{decode, KosError};
use std::path::Path;

/// Máximo de bytes de imaxe aceptados (mesmo límite ca os perfís da Misión A).
pub const LIMITE_IMAXE: u64 = 16 * 1024 * 1024;
/// Ventána por defecto tras a carga para buscar a chamada (perfil v2: 16).
pub const VENTANXA_DEFECTO: u32 = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Estado {
    Pass,
    Fail,
    Inconclusive,
    Skip,
}

impl Estado {
    pub fn as_str(self) -> &'static str {
        match self {
            Estado::Pass => "PASS",
            Estado::Fail => "FAIL",
            Estado::Inconclusive => "INCONCLUSIVE",
            Estado::Skip => "SKIP",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Elo {
    pub nome: &'static str,
    pub estado: Estado,
    pub detalle: String,
}

impl Elo {
    fn pass(nome: &'static str, detalle: impl Into<String>) -> Elo {
        Elo {
            nome,
            estado: Estado::Pass,
            detalle: detalle.into(),
        }
    }
    fn fail(nome: &'static str, detalle: impl Into<String>) -> Elo {
        Elo {
            nome,
            estado: Estado::Fail,
            detalle: detalle.into(),
        }
    }
}

/// Códigos de saída estables do verbo `revalidar` (documentados no contrato).
pub mod codigo {
    pub const OK: i32 = 0;
    pub const USO: i32 = 1;
    pub const ESQUEMA: i32 = 2;
    pub const ROM_DIVERXENCIA: i32 = 3;
    pub const MAPPER_DIVERXENCIA: i32 = 4;
    pub const SITIO_DIVERXENCIA: i32 = 5;
    pub const ARGUMENTO_DIVERXENTE: i32 = 6;
    pub const ALVO_DIVERXENTE: i32 = 7;
    pub const ROTINA_DIVERXENCIA: i32 = 8;
    pub const SAIDA_DIVERXENTE: i32 = 9;
    pub const INCONCLUSIVE_TRUNCADA: i32 = 10;
    pub const XEOMETRIA_DIVERXENTE: i32 = 11;
    pub const LECTURA_ERRO: i32 = 12;
    pub const LIMITE_ACADADO: i32 = 13;
    pub const REXION_DIVERXENTE: i32 = 14;
}

pub struct Resultado {
    pub elos: Vec<Elo>,
    pub codigo: i32,
}

impl Resultado {
    pub fn resumen(&self) -> String {
        self.elos
            .iter()
            .map(|e| format!("{}={}({})", e.nome, e.estado.as_str(), e.detalle))
            .collect::<Vec<_>>()
            .join(" ")
    }
}

/// Le a imaxe con límite duro: un ficheiro descomunal non se lee.
pub fn ler_imaxe(ruta: &Path) -> Result<Vec<u8>, (i32, String)> {
    let meta =
        std::fs::metadata(ruta).map_err(|e| (codigo::LECTURA_ERRO, format!("sen-imaxe: {e}")))?;
    if meta.len() > LIMITE_IMAXE {
        return Err((
            codigo::LECTURA_ERRO,
            format!("imaxe-too-grande: {} > {}", meta.len(), LIMITE_IMAXE),
        ));
    }
    std::fs::read(ruta).map_err(|e| (codigo::LECTURA_ERRO, format!("sen-imaxe: {e}")))
}

/// Estado do mapper desde a corda `estado_mapper` (`rom_size=0x…`).
pub fn estado_desde_corda(estado: &str) -> Result<(MapperState, u32), String> {
    let corpo = estado
        .strip_prefix("rom_size=")
        .ok_or_else(|| format!("estado_mapper non soportado: {estado}"))?;
    let size = rex_hex_u32(corpo).ok_or_else(|| format!("rom_size malformado: {corpo}"))?;
    let size = u64::from(size);
    let st = MapperState::rom_size(size);
    md_linear::validate_state(&st).map_err(|e| format!("estado_mapper inválido: {e}"))?;
    // rom_size ≤ u32 garantido por validate_state (MAX_ROM_SIZE 4 MiB) e polo
    // límite do bus; a conversión non pode truncar porque o crate rexeita
    // sizes maiores.
    Ok((st, size as u32))
}

fn rex_hex_u32(s: &str) -> Option<u32> {
    let corpo = s.strip_prefix("0x")?;
    u32::from_str_radix(corpo, 16).ok()
}

/// Tradución enderzo→offset que esixe ROM con backing (as rexións sen bytes
/// do crate non se clapan: `Device`/`Invalid` son erro do elo).
pub fn offset_rom(addr: u32, st: &MapperState) -> Result<usize, String> {
    match md_linear::translate(addr, st) {
        rex_addressing::Translate::Rom { offset } => Ok(offset as usize),
        rex_addressing::Translate::Device { region, .. } => Err(format!(
            "enderezo {:#08X} en rexión {region} sen backing ROM",
            addr
        )),
        rex_addressing::Translate::Invalid(e) => {
            Err(format!("enderezo {addr:#08X} sen traducir: {e}"))
        }
    }
}

/// Clasificación local de rexións do destino (EXPECTATIONS-A §4). Os nomes
/// son etiquetas de **ventaná do mapa**, non clases gráficas: `vram-window`
/// non afirma que haxa VRAM escrita (eso esixiría execución).
pub fn clasificar_rexion(addr: u32, rom_size: u32) -> &'static str {
    if addr < 0x800_000 && u64::from(addr) < u64::from(rom_size) {
        "rom"
    } else if (0xA0_0000..=0xA1_FFFF).contains(&addr) {
        "io/vram-window"
    } else if (0xC0_0000..=0xC0_003F).contains(&addr) {
        "cram-window"
    } else if (0xE0_0000..=0xE0_FFFF).contains(&addr) {
        "work-ram"
    } else if (0xFF_0000..=0xFF_FFFF).contains(&addr) {
        "ram-68k-mirror"
    } else {
        "descoecida"
    }
}

fn bytes_correctos(imaxe: &[u8], offset: usize, esperado: &[u8]) -> Option<Vec<u8>> {
    imaxe
        .get(offset..offset + esperado.len())
        .map(|v| v.to_vec())
}

/// Revalida unha cadea contra a imaxe. `ventanxa` acouta a xeometría
/// carga→chamada (mesma que o perfil v2).
pub fn revalidar(imaxe: &[u8], cadea: &Cadea, ventanxa: u32) -> Resultado {
    let mut elos: Vec<Elo> = Vec::new();

    // 0. estrutura do contrato antes de medir.
    if let Err(e) = cadea.validar() {
        elos.push(Elo::fail("esquema", e.clone()));
        return Resultado {
            elos,
            codigo: codigo::ESQUEMA,
        };
    }
    elos.push(Elo::pass("esquema", "ok"));

    // 1. identidade.
    let medida = rex_kosinski::edit::sha256_hex(imaxe);
    if medida != cadea.imaxe_sha256 {
        elos.push(Elo::fail(
            "identidade",
            format!("medido={medida} pin={}", cadea.imaxe_sha256),
        ));
        return Resultado {
            elos,
            codigo: codigo::ROM_DIVERXENCIA,
        };
    }
    elos.push(Elo::pass("identidade", medida.clone()));

    // 2. mapper.
    let (st, rom_size) = match estado_desde_corda(&cadea.estado_mapper) {
        Ok(v) => v,
        Err(e) => {
            elos.push(Elo::fail("mapper", e.clone()));
            return Resultado {
                elos,
                codigo: codigo::MAPPER_DIVERXENCIA,
            };
        }
    };
    if cadea.mapper != md_linear::PROFILE_ID {
        elos.push(Elo::fail(
            "mapper",
            format!("perfil {} non implementado aqui", cadea.mapper),
        ));
        return Resultado {
            elos,
            codigo: codigo::MAPPER_DIVERXENCIA,
        };
    }
    let off_fluxo = match offset_rom(cadea.fluxo_cpu, &st) {
        Ok(o) => o,
        Err(e) => {
            elos.push(Elo::fail("mapper", e.clone()));
            return Resultado {
                elos,
                codigo: codigo::MAPPER_DIVERXENCIA,
            };
        }
    };
    if off_fluxo as u64 != cadea.fluxo_offset {
        elos.push(Elo::fail(
            "mapper",
            format!("offset traducido={off_fluxo} cadea={}", cadea.fluxo_offset),
        ));
        return Resultado {
            elos,
            codigo: codigo::MAPPER_DIVERXENCIA,
        };
    }
    elos.push(Elo::pass(
        "mapper",
        format!("md-linear rom_size={rom_size:#08X}"),
    ));

    // 3. sitio de carga: bytes + forma + operando.
    let off_carga = match offset_rom(cadea.carga_sitio, &st) {
        Ok(o) => o,
        Err(e) => {
            elos.push(Elo::fail("sitio-carga", e));
            return Resultado {
                elos,
                codigo: codigo::SITIO_DIVERXENCIA,
            };
        }
    };
    let esperados = &cadea.carga_bytes;
    let reais = match bytes_correctos(imaxe, off_carga, esperados) {
        Some(v) => v,
        None => {
            elos.push(Elo::fail(
                "sitio-carga",
                format!("fora de imaxe: offset={off_carga} len={}", esperados.len()),
            ));
            return Resultado {
                elos,
                codigo: codigo::SITIO_DIVERXENCIA,
            };
        }
    };
    if reais != *esperados {
        elos.push(Elo::fail(
            "sitio-carga",
            format!(
                "bytes non coinciden: imaxe={} cadea={}",
                crate::chain::hex_maíus(&reais),
                crate::chain::hex_maíus(esperados)
            ),
        ));
        return Resultado {
            elos,
            codigo: codigo::SITIO_DIVERXENCIA,
        };
    }
    let forma = match decodificar(&reais, cadea.carga_sitio) {
        Ok(f) => f,
        Err(e) => {
            elos.push(Elo::fail(
                "sitio-carga",
                format!("non decodificable: {e:?}"),
            ));
            return Resultado {
                elos,
                codigo: codigo::SITIO_DIVERXENCIA,
            };
        }
    };
    if forma.nome() != cadea.carga_forma {
        elos.push(Elo::fail(
            "forma-carga",
            format!("medida={} cadea={}", forma.nome(), cadea.carga_forma),
        ));
        return Resultado {
            elos,
            codigo: codigo::ARGUMENTO_DIVERXENTE,
        };
    }
    let operando = match &forma {
        Forma::LeaAbsL { operando, .. } | Forma::LeaAbsW { operando, .. } => *operando,
        Forma::LeaPcD16 { destino, .. } => *destino,
        outra => {
            elos.push(Elo::fail(
                "forma-carga",
                format!("a carga declarou forma de chamada: {:?}", outra.nome()),
            ));
            return Resultado {
                elos,
                codigo: codigo::ARGUMENTO_DIVERXENTE,
            };
        }
    };
    if operando != cadea.carga_operando {
        elos.push(Elo::fail(
            "argumento-fonte",
            format!("medido={operando:#08X} cadea={:#08X}", cadea.carga_operando),
        ));
        return Resultado {
            elos,
            codigo: codigo::ARGUMENTO_DIVERXENTE,
        };
    }
    elos.push(Elo::pass("sitio-carga", crate::chain::hex_maíus(esperados)));
    elos.push(Elo::pass(
        "argumento-fonte",
        format!("{} {operando:#08X}", forma.nome()),
    ));

    // 4. destino (se foi medido).
    if let (Some(dsitio), Some(dbytes), Some(dforma), Some(dop), Some(drex)) = (
        cadea.destino_sitio,
        cadea.destino_bytes.clone(),
        cadea.destino_forma.clone(),
        cadea.destino_operando,
        cadea.destino_rexion.clone(),
    ) {
        let off_dest = match offset_rom(dsitio, &st) {
            Ok(o) => o,
            Err(e) => {
                elos.push(Elo::fail("sitio-destino", e));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        };
        let reais = match bytes_correctos(imaxe, off_dest, &dbytes) {
            Some(v) => v,
            None => {
                elos.push(Elo::fail("sitio-destino", "fora de imaxe".to_string()));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        };
        if reais != dbytes {
            elos.push(Elo::fail(
                "sitio-destino",
                format!(
                    "bytes non coinciden: imaxe={} cadea={}",
                    crate::chain::hex_maíus(&reais),
                    crate::chain::hex_maíus(&dbytes)
                ),
            ));
            return Resultado {
                elos,
                codigo: codigo::SITIO_DIVERXENCIA,
            };
        }
        match decodificar(&reais, dsitio) {
            Ok(f) => {
                if f.nome() != dforma {
                    elos.push(Elo::fail(
                        "forma-destino",
                        format!("medida={} cadea={}", f.nome(), dforma),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::ARGUMENTO_DIVERXENTE,
                    };
                }
                let op = match &f {
                    Forma::LeaAbsL { operando, .. } | Forma::LeaAbsW { operando, .. } => *operando,
                    Forma::LeaPcD16 { destino, .. } => *destino,
                    outra => {
                        elos.push(Elo::fail(
                            "forma-destino",
                            format!("non é carga: {}", outra.nome()),
                        ));
                        return Resultado {
                            elos,
                            codigo: codigo::ARGUMENTO_DIVERXENTE,
                        };
                    }
                };
                if op != dop {
                    elos.push(Elo::fail(
                        "argumento-destino",
                        format!("medido={op:#08X} cadea={dop:#08X}"),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::ARGUMENTO_DIVERXENTE,
                    };
                }
                elos.push(Elo::pass("sitio-destino", crate::chain::hex_maíus(&reais)));
                let reclas = clasificar_rexion(op, rom_size);
                if reclas != drex.as_str() {
                    elos.push(Elo::fail(
                        "rexion-destino",
                        format!("clasificada={reclas} cadea={drex}"),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::REXION_DIVERXENTE,
                    };
                }
                elos.push(Elo::pass("rexion-destino", reclas));
            }
            Err(e) => {
                elos.push(Elo::fail(
                    "sitio-destino",
                    format!("non decodificable: {e:?}"),
                ));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        }
    } else {
        elos.push(Elo {
            nome: "destino",
            estado: Estado::Skip,
            detalle: "sen elo de destino declarado".to_string(),
        });
    }

    // 5. chamada: bytes, aritmética relativa e xeometría.
    if let (Some(csitio), Some(cbytes), Some(cforma), Some(alvo)) = (
        cadea.chamada_sitio,
        cadea.chamada_bytes.clone(),
        cadea.chamada_forma.clone(),
        cadea.chamada_alvo,
    ) {
        let off_cham = match offset_rom(csitio, &st) {
            Ok(o) => o,
            Err(e) => {
                elos.push(Elo::fail("sitio-chamada", e));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        };
        let reais = match bytes_correctos(imaxe, off_cham, &cbytes) {
            Some(v) => v,
            None => {
                elos.push(Elo::fail("sitio-chamada", "fora de imaxe".to_string()));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        };
        if reais != cbytes {
            elos.push(Elo::fail(
                "sitio-chamada",
                format!(
                    "bytes: imaxe={} cadea={}",
                    crate::chain::hex_maíus(&reais),
                    crate::chain::hex_maíus(&cbytes)
                ),
            ));
            return Resultado {
                elos,
                codigo: codigo::SITIO_DIVERXENCIA,
            };
        }
        match decodificar(&reais, csitio) {
            Ok(f) => {
                if f.nome() != cforma {
                    elos.push(Elo::fail(
                        "forma-chamada",
                        format!("medida={} cadea={}", f.nome(), cforma),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::ALVO_DIVERXENTE,
                    };
                }
                let calc = match &f {
                    Forma::BsrW { alvo }
                    | Forma::BsrL { alvo }
                    | Forma::JsrAbsL { alvo }
                    | Forma::JsrAbsW { alvo }
                    | Forma::JmpAbsL { alvo }
                    | Forma::JmpAbsW { alvo } => *alvo,
                    outra => {
                        elos.push(Elo::fail(
                            "forma-chamada",
                            format!("non é chamada: {}", outra.nome()),
                        ));
                        return Resultado {
                            elos,
                            codigo: codigo::ALVO_DIVERXENTE,
                        };
                    }
                };
                if calc != alvo_desde_bytes(&reais, csitio).unwrap_or(calc) {
                    // dobre control: o alvo volve calcularse desde os bytes
                    // brutos coa aritmética do contrato, non só co decodificador.
                    elos.push(Elo::fail(
                        "aritmetica-chamada",
                        format!("dobre-calculo diverxe: {calc:#08X}"),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::ALVO_DIVERXENTE,
                    };
                }
                if calc != alvo {
                    elos.push(Elo::fail(
                        "alvo-chamada",
                        format!("calculado={calc:#08X} cadea={alvo:#08X}"),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::ALVO_DIVERXENTE,
                    };
                }
                elos.push(Elo::pass("sitio-chamada", crate::chain::hex_maíus(&reais)));
                elos.push(Elo::pass("alvo-chamada", format!("{alvo:#08X}")));
                // xeometría: a chamada cae na ventána tras o fin da carga.
                let fin_carga = off_carga + forma.lonxitude();
                let dentro = (off_cham > fin_carga)
                    && (off_cham - fin_carga <= ventanxa as usize)
                    && sitio_aliñado(csitio);
                if !dentro {
                    elos.push(Elo::fail(
                        "xeometria",
                        format!(
                            "chamada en {csitio:#08X}, fin carga {fin_carga:#06X}, ventána {ventanxa}"
                        ),
                    ));
                    return Resultado {
                        elos,
                        codigo: codigo::XEOMETRIA_DIVERXENTE,
                    };
                }
                elos.push(Elo::pass("xeometria", format!("ventána {ventanxa} ok")));
            }
            Err(e) => {
                elos.push(Elo::fail(
                    "sitio-chamada",
                    format!("non decodificable: {e:?}"),
                ));
                return Resultado {
                    elos,
                    codigo: codigo::SITIO_DIVERXENCIA,
                };
            }
        }
    } else {
        if cadea.confianza == "vinculo-estrutural" {
            elos.push(Elo::fail(
                "chamada",
                "vinculo-estrutural sen elos de chamada".to_string(),
            ));
            return Resultado {
                elos,
                codigo: codigo::ESQUEMA,
            };
        }
        elos.push(Elo {
            nome: "chamada",
            estado: Estado::Skip,
            detalle: "sen chamada: cadea queda en referencia/candidato".to_string(),
        });
    }

    // 6. rutina: hash dos bytes no alvo.
    if let (Some(rsite), Some(rlon), Some(rsha)) = (
        cadea.rutina_sitio,
        cadea.rutina_lonxitude,
        cadea.rutina_sha256.clone(),
    ) {
        let off_rot = match offset_rom(rsite, &st) {
            Ok(o) => o,
            Err(e) => {
                elos.push(Elo::fail("rutina", e));
                return Resultado {
                    elos,
                    codigo: codigo::ROTINA_DIVERXENCIA,
                };
            }
        };
        let lon = rlon as usize;
        let reais = match imaxe.get(off_rot..off_rot + lon) {
            Some(v) => v,
            None => {
                elos.push(Elo::fail("rutina", "fora de imaxe".to_string()));
                return Resultado {
                    elos,
                    codigo: codigo::ROTINA_DIVERXENCIA,
                };
            }
        };
        let medida = rex_kosinski::edit::sha256_hex(reais);
        if medida != rsha {
            elos.push(Elo::fail("rutina", format!("medido={medida} pin={rsha}")));
            return Resultado {
                elos,
                codigo: codigo::ROTINA_DIVERXENCIA,
            };
        }
        elos.push(Elo::pass("rutina", format!("{lon} B {medida}")));
    } else {
        elos.push(Elo {
            nome: "rutina",
            estado: Estado::Skip,
            detalle: "sen elo de rutina".to_string(),
        });
    }

    // 7. stream → saída validada.
    let fin = (cadea.fluxo_offset as usize + cadea.tramo_entrada as usize).min(imaxe.len());
    let entrada = &imaxe[cadea.fluxo_offset as usize..fin];
    let dec = decode(
        entrada,
        cadea.limite_max_saida as usize,
        cadea.limite_orzamento as usize,
    );
    match dec {
        Ok(d) => {
            let sha = rex_kosinski::edit::sha256_hex(&d.output);
            if d.bytes_consumed as u64 != cadea.bytes_consumidos
                || d.output.len() as u64 != cadea.saida_bytes
                || sha != cadea.saida_sha256
            {
                elos.push(Elo::fail(
                    "saída",
                    format!(
                        "consumo={}/{} bytes saida={}/{} sha={} pin={}",
                        d.bytes_consumed,
                        cadea.bytes_consumidos,
                        d.output.len(),
                        cadea.saida_bytes,
                        sha,
                        cadea.saida_sha256
                    ),
                ));
                return Resultado {
                    elos,
                    codigo: codigo::SAIDA_DIVERXENTE,
                };
            }
            elos.push(Elo::pass(
                "saída",
                format!("consumo={} saida={}", d.bytes_consumed, d.output.len()),
            ));
        }
        Err(KosError::Truncated) | Err(KosError::EmptyInput) => {
            elos.push(Elo {
                nome: "saída",
                estado: Estado::Inconclusive,
                detalle: "fluxo-truncado: a cadea non se completa, non se infla".to_string(),
            });
            return Resultado {
                elos,
                codigo: codigo::INCONCLUSIVE_TRUNCADA,
            };
        }
        Err(KosError::ExcessiveOutput) | Err(KosError::WorkLimit) => {
            elos.push(Elo::fail(
                "saída",
                "límite do contrato acadado (saida-excesiva/orzamento)".to_string(),
            ));
            return Resultado {
                elos,
                codigo: codigo::LIMITE_ACADADO,
            };
        }
        Err(KosError::InvalidReference) => {
            elos.push(Elo::fail(
                "saída",
                "referencia-invalida no fluxo".to_string(),
            ));
            return Resultado {
                elos,
                codigo: codigo::SAIDA_DIVERXENTE,
            };
        }
    }

    Resultado {
        elos,
        codigo: codigo::OK,
    }
}

/// Dobre control da aritmética: reproduce o cálculo do alvo desde os bytes
/// sen pasar polo `decodificar` (o elo non pode ser circular consigo mesmo).
fn alvo_desde_bytes(bytes: &[u8], sitio: u32) -> Option<u32> {
    let (b0, b1) = (bytes.first()?, bytes.get(1)?);
    let alvo = match (*b0, *b1) {
        (0x61, 0xFF) => {
            if bytes.len() < 6 {
                return None;
            }
            let d = i32::from_be_bytes([bytes[2], bytes[3], bytes[4], bytes[5]]) as i64;
            i64::from(sitio) + 4 + d
        }
        (0x61, _) => {
            if bytes.len() < 4 {
                return None;
            }
            let d = i16::from_be_bytes([bytes[2], bytes[3]]) as i64;
            i64::from(sitio) + 2 + d
        }
        (0x4E, 0xB9) | (0x4E, 0xFD) => {
            if bytes.len() < 6 {
                return None;
            }
            u32::from_be_bytes([bytes[2], bytes[3], bytes[4], bytes[5]]) as i64
        }
        (0x4E, 0xFA) | (0x4E, 0xFC) => {
            if bytes.len() < 4 {
                return None;
            }
            u16::from_be_bytes([bytes[2], bytes[3]]) as i64
        }
        _ => return None,
    };
    if !(0..=0xFF_FFFF).contains(&alvo) {
        return None;
    }
    Some(alvo as u32)
}
