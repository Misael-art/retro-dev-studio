//! Localizador por assinatura de bytes, genérico e puro (sem I/O): padrões com bytes
//! fixos, curingas e CAPTURAS nomeadas. É a base para reconhecer a MESMA lógica em
//! ROMs diferentes sem endereços fixos: o perfil declara a forma da lógica, o
//! localizador a confirma em cada ROM e devolve os campos capturados (deslocamentos
//! de objeto, imediatos, endereços de RAM) com o offset de cada captura na ROM.
//!
//! Sintaxe do padrão (hex separado por espaços):
//!
//! * `4E 75` bytes fixos;
//! * `..` 1 byte qualquer;
//! * `{nome:N}` captura de N bytes (1..=4) como valor big-endian; o MESMO nome em dois
//!   pontos exige valores IGUAIS (retro-referência);
//! * `{_:N}` N bytes ignorados (sem nome, sem consistência).
//!
//! Instruções 68000 são alinhadas em palavra: só offsets pares são testados.

use std::collections::HashMap;

pub const MAX_PATTERN_BYTES: usize = 128;
pub const MAX_MATCHES: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SigError {
    Empty,
    TooLong,
    BadToken(String),
    BadCapture(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Tok {
    Byte(u8),
    Any,
    Cap { name: String, len: usize },
}

#[derive(Debug, Clone)]
pub struct Pattern {
    toks: Vec<Tok>,
    len: usize,
}

/// Uma captura resolvida: valor BE e a posição absoluta dela na ROM (para editar no lugar).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Captured {
    pub value: u32,
    pub rom_offset: usize,
    pub len: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Match {
    pub offset: usize,
    pub len: usize,
    pub caps: HashMap<String, Captured>,
}

impl Pattern {
    pub fn parse(src: &str) -> Result<Pattern, SigError> {
        let mut toks = Vec::new();
        let mut len = 0usize;
        for raw in src.split_whitespace() {
            if raw == ".." {
                toks.push(Tok::Any);
                len += 1;
            } else if let Some(inner) = raw.strip_prefix('{').and_then(|r| r.strip_suffix('}')) {
                let (name, n) = inner
                    .split_once(':')
                    .ok_or_else(|| SigError::BadCapture(raw.to_string()))?;
                let n: usize = n
                    .parse()
                    .map_err(|_| SigError::BadCapture(raw.to_string()))?;
                if name.is_empty() || !(1..=4).contains(&n) && name != "_" {
                    return Err(SigError::BadCapture(raw.to_string()));
                }
                if name == "_" {
                    if n == 0 || n > MAX_PATTERN_BYTES {
                        return Err(SigError::BadCapture(raw.to_string()));
                    }
                    for _ in 0..n {
                        toks.push(Tok::Any);
                    }
                } else {
                    toks.push(Tok::Cap {
                        name: name.to_string(),
                        len: n,
                    });
                }
                len += n;
            } else {
                if raw.len() != 2 {
                    return Err(SigError::BadToken(raw.to_string()));
                }
                let b =
                    u8::from_str_radix(raw, 16).map_err(|_| SigError::BadToken(raw.to_string()))?;
                toks.push(Tok::Byte(b));
                len += 1;
            }
            if len > MAX_PATTERN_BYTES {
                return Err(SigError::TooLong);
            }
        }
        if len == 0 {
            return Err(SigError::Empty);
        }
        Ok(Pattern { toks, len })
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    fn try_at(&self, rom: &[u8], at: usize) -> Option<Match> {
        if at + self.len > rom.len() {
            return None;
        }
        let mut caps: HashMap<String, Captured> = HashMap::new();
        let mut p = at;
        for t in &self.toks {
            match t {
                Tok::Byte(b) => {
                    if rom[p] != *b {
                        return None;
                    }
                    p += 1;
                }
                Tok::Any => p += 1,
                Tok::Cap { name, len } => {
                    let v = rom[p..p + len]
                        .iter()
                        .fold(0u32, |a, b| (a << 8) | u32::from(*b));
                    match caps.get(name) {
                        Some(prev) if prev.value != v => return None,
                        Some(_) => {}
                        None => {
                            caps.insert(
                                name.clone(),
                                Captured {
                                    value: v,
                                    rom_offset: p,
                                    len: *len,
                                },
                            );
                        }
                    }
                    p += len;
                }
            }
        }
        Some(Match {
            offset: at,
            len: self.len,
            caps,
        })
    }

    /// Todas as ocorrências (offsets pares), até `MAX_MATCHES`. O corte é reportado.
    pub fn scan(&self, rom: &[u8]) -> (Vec<Match>, bool) {
        let mut out = Vec::new();
        if rom.len() < self.len {
            return (out, false);
        }
        let first = self.toks.iter().find_map(|t| match t {
            Tok::Byte(b) => Some(*b),
            _ => None,
        });
        let first_pos = self.toks.iter().position(|t| matches!(t, Tok::Byte(_)));
        let mut at = 0usize;
        while at + self.len <= rom.len() {
            // pré-filtro barato pelo primeiro byte fixo
            if let (Some(b), Some(fp)) = (first, first_pos) {
                if rom[at + fp] != b {
                    at += 2;
                    continue;
                }
            }
            if let Some(m) = self.try_at(rom, at) {
                if out.len() >= MAX_MATCHES {
                    return (out, true);
                }
                out.push(m);
            }
            at += 2;
        }
        (out, false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_recusa_padroes_invalidos() {
        assert_eq!(Pattern::parse("").unwrap_err(), SigError::Empty);
        assert!(matches!(Pattern::parse("4E 7"), Err(SigError::BadToken(_))));
        assert!(matches!(Pattern::parse("ZZ"), Err(SigError::BadToken(_))));
        assert!(matches!(
            Pattern::parse("{x:0}"),
            Err(SigError::BadCapture(_))
        ));
        assert!(matches!(
            Pattern::parse("{x:5}"),
            Err(SigError::BadCapture(_))
        ));
        assert!(matches!(
            Pattern::parse("{x}"),
            Err(SigError::BadCapture(_))
        ));
        let longo = vec!["00"; MAX_PATTERN_BYTES + 1].join(" ");
        assert_eq!(Pattern::parse(&longo).unwrap_err(), SigError::TooLong);
        assert_eq!(Pattern::parse("4E 75 .. {a:2} {_:3}").unwrap().len(), 8);
    }

    #[test]
    fn captura_valor_be_e_posicao_na_rom() {
        let rom = [0u8, 0, 0x34, 0x3C, 0x06, 0x80, 0x4E, 0x75];
        let p = Pattern::parse("34 3C {imp:2} 4E 75").unwrap();
        let (m, cut) = p.scan(&rom);
        assert!(!cut);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].offset, 2);
        assert_eq!(
            m[0].caps["imp"],
            Captured {
                value: 0x0680,
                rom_offset: 4,
                len: 2
            }
        );
    }

    #[test]
    fn mesmo_nome_exige_valores_iguais() {
        let p = Pattern::parse("0C 68 {cap:2} {vy:2} 6C 06 31 7C {cap:2} {vy:2}").unwrap();
        let ok = [
            0x0C, 0x68, 0xF0, 0x40, 0x00, 0x12, 0x6C, 0x06, 0x31, 0x7C, 0xF0, 0x40, 0x00, 0x12,
        ];
        assert_eq!(p.scan(&ok).0.len(), 1);
        let mut ruim = ok;
        ruim[10] = 0xF1; // cap diferente na 2ª ocorrência
        assert!(p.scan(&ruim).0.is_empty());
        let mut ruim2 = ok;
        ruim2[13] = 0x14; // vy diferente
        assert!(p.scan(&ruim2).0.is_empty());
    }

    #[test]
    fn so_testa_offsets_pares_e_nao_estoura_o_fim() {
        let rom = [0x00, 0x4E, 0x75, 0x00];
        let p = Pattern::parse("4E 75").unwrap();
        assert!(p.scan(&rom).0.is_empty()); // ocorrência em offset 1 (ímpar)
        assert!(p.scan(&[0x4E]).0.is_empty());
        assert!(p.scan(&[]).0.is_empty());
        let rom2 = [0x4E, 0x75, 0x4E, 0x75];
        assert_eq!(p.scan(&rom2).0.len(), 2);
    }

    #[test]
    fn limite_de_ocorrencias_e_reportado() {
        let rom: Vec<u8> = (0..(MAX_MATCHES + 10)).flat_map(|_| [0x4E, 0x75]).collect();
        let (m, cut) = Pattern::parse("4E 75").unwrap().scan(&rom);
        assert_eq!(m.len(), MAX_MATCHES);
        assert!(cut);
    }

    #[test]
    fn curingas_e_ignorados_casam_qualquer_byte() {
        let p = Pattern::parse("67 .. {_:2} 4E 75").unwrap();
        assert_eq!(p.scan(&[0x67, 0x12, 0xAA, 0xBB, 0x4E, 0x75]).0.len(), 1);
        assert!(p.scan(&[0x66, 0x12, 0xAA, 0xBB, 0x4E, 0x75]).0.is_empty());
    }
}
