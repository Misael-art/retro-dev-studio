//! Núcleo de edição do REX: lista de `Patch` com bytes antigos conferidos, aplicação a uma CÓPIA, IPS
//! estrito (gerador e aplicador independentes) e planejamento genérico de edição de campos inteiros
//! (1, 2 ou 4 bytes, com ou sem sinal, big ou little-endian).
//!
//! Puro e sem conhecimento de jogo ou de perfil: opera sobre offsets, bytes e domínios. Extraído de
//! do primeiro perfil na F1 (`docs/14_REX_ARQUITETURA_UNIVERSAL.md`) sem mudar comportamento:
//! a ROM de entrada nunca é alterada e o tamanho nunca muda.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Patch {
    pub offset: usize,
    pub old: Vec<u8>,
    pub new: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditError {
    /// Os bytes antigos não coincidem com os da ROM (ROM já editada/diferente) ou o patch sai da ROM.
    StaleBytes,
    /// O IPS não representa o patch (ou o IPS lido é malformado).
    IpsUnrepresentable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanError {
    /// O campo pedido não existe nesta instância.
    FieldUnavailable,
    /// Valor fora do domínio aceito do campo.
    OutOfRange,
    /// Nada a alterar: recusa explícita, nunca no-op silencioso.
    NoChange,
    /// Um offset de campo fica fora da ROM.
    OutOfBounds,
}

/// Codificação de um inteiro editável no arquivo: largura em bytes (1, 2 ou 4), sinal e ordem dos bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct FieldEnc {
    pub width: u8,
    pub signed: bool,
    pub little: bool,
}

impl FieldEnc {
    /// Imediato de 16 bits com sinal, big-endian.
    pub const IMM16_BE: FieldEnc = FieldEnc {
        width: 2,
        signed: true,
        little: false,
    };

    /// Faixa representável pela largura e pelo sinal.
    pub fn range(self) -> (i64, i64) {
        let bits = u32::from(self.width) * 8;
        if self.signed {
            (-(1i64 << (bits - 1)), (1i64 << (bits - 1)) - 1)
        } else {
            (0, (1i64 << bits) - 1)
        }
    }

    /// Valor a partir dos bytes como estão no arquivo.
    pub fn decode(self, bytes: &[u8]) -> i64 {
        let raw = if self.little {
            bytes
                .iter()
                .rev()
                .fold(0u64, |a, b| (a << 8) | u64::from(*b))
        } else {
            bytes.iter().fold(0u64, |a, b| (a << 8) | u64::from(*b))
        };
        let bits = u32::from(self.width) * 8;
        if self.signed && (raw >> (bits - 1)) & 1 == 1 {
            raw as i64 - (1i64 << bits)
        } else {
            raw as i64
        }
    }

    /// Bytes de arquivo de `value`; `None` se não cabe na largura/sinal (overflow nunca é truncado).
    pub fn encode(self, value: i64) -> Option<Vec<u8>> {
        let (lo, hi) = self.range();
        if value < lo || value > hi {
            return None;
        }
        let mut out = (value as u64).to_be_bytes()[8 - usize::from(self.width)..].to_vec();
        if self.little {
            out.reverse();
        }
        Some(out)
    }
}

/// Visão mínima de um campo editável para o planejamento.
#[derive(Debug, Clone, Copy)]
pub struct FieldView<'a> {
    pub name: &'a str,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    pub rom_offsets: &'a [usize],
    pub enc: FieldEnc,
}

/// Planeja a regravação dos inteiros de `fields` com os valores `wanted` (na ordem dada; `None` ignora).
/// Valida domínio e largura, recusa no-op e confere que cada offset cabe na ROM. Guarda os bytes ANTIGOS.
pub fn plan_field_edits(
    rom: &[u8],
    fields: &[FieldView<'_>],
    wanted: &[(&str, Option<i64>)],
) -> Result<Vec<Patch>, PlanError> {
    let mut patches = Vec::new();
    for (name, val) in wanted {
        let Some(val) = *val else { continue };
        let f = fields
            .iter()
            .find(|f| f.name == *name)
            .ok_or(PlanError::FieldUnavailable)?;
        if val < f.min || val > f.max {
            return Err(PlanError::OutOfRange);
        }
        let new = f.enc.encode(val).ok_or(PlanError::OutOfRange)?;
        if val == f.value {
            continue;
        }
        for &o in f.rom_offsets {
            let old = o
                .checked_add(new.len())
                .and_then(|end| rom.get(o..end))
                .ok_or(PlanError::OutOfBounds)?;
            patches.push(Patch {
                offset: o,
                old: old.to_vec(),
                new: new.clone(),
            });
        }
    }
    if patches.is_empty() {
        return Err(PlanError::NoChange);
    }
    Ok(patches)
}

/// Aplica a uma CÓPIA: confere os bytes antigos; o tamanho nunca muda.
pub fn apply(rom: &[u8], patches: &[Patch]) -> Result<Vec<u8>, EditError> {
    let mut out = rom.to_vec();
    for p in patches {
        let end = p
            .offset
            .checked_add(p.new.len())
            .ok_or(EditError::StaleBytes)?;
        if p.new.len() != p.old.len() || end > out.len() || out[p.offset..end] != p.old[..] {
            return Err(EditError::StaleBytes);
        }
        out[p.offset..end].copy_from_slice(&p.new);
    }
    Ok(out)
}

pub const IPS_MAX_OFFSET: usize = 0xFF_FFFF;
/// Os 3 bytes "EOF" lidos como offset: um registro começando aqui seria lido como o terminador.
pub const IPS_EOF_OFFSET: usize = 0x45_4F46;
pub const IPS_MAX_RECORD: usize = 0xFFFF;

/// Patch IPS só com os bytes alterados (não carrega nenhum byte inalterado da ROM).
/// Recusa ANTES de qualquer escrita o que o formato não representa: offset > 0xFFFFFF, offset igual
/// ao marcador `EOF`, registro vazio (tamanho 0 seria RLE no IPS) ou > 0xFFFF, e registros sobrepostos.
pub fn ips(patches: &[Patch]) -> Result<Vec<u8>, EditError> {
    if patches.is_empty() {
        return Err(EditError::IpsUnrepresentable);
    }
    let mut sorted: Vec<&Patch> = patches.iter().collect();
    sorted.sort_by_key(|p| p.offset);
    let mut prev_end = 0usize;
    let mut out = b"PATCH".to_vec();
    for p in sorted {
        let n = p.new.len();
        if p.offset > IPS_MAX_OFFSET
            || p.offset == IPS_EOF_OFFSET
            || n == 0
            || n > IPS_MAX_RECORD
            || p.offset < prev_end
        {
            return Err(EditError::IpsUnrepresentable);
        }
        out.extend_from_slice(&(p.offset as u32).to_be_bytes()[1..]);
        out.extend_from_slice(&(n as u16).to_be_bytes());
        out.extend_from_slice(&p.new);
        prev_end = p.offset + n;
    }
    out.extend_from_slice(b"EOF");
    Ok(out)
}

/// Aplicador IPS ESTRITO e independente do gerador (outro código, lê os bytes como estão no arquivo):
/// cabeçalho `PATCH`, registros `offset(3) size(2) dados` até o terminador `EOF`; recusa RLE (size 0),
/// registro além do fim da ROM (a cópia nunca cresce), truncamento e bytes depois do `EOF`.
pub fn ips_apply_strict(rom: &[u8], ips: &[u8]) -> Result<Vec<u8>, EditError> {
    if ips.len() < 8 || &ips[..5] != b"PATCH" {
        return Err(EditError::IpsUnrepresentable);
    }
    let mut out = rom.to_vec();
    let mut q = 5usize;
    loop {
        let head = ips.get(q..q + 3).ok_or(EditError::IpsUnrepresentable)?;
        if head == b"EOF" {
            return if q + 3 == ips.len() {
                Ok(out)
            } else {
                Err(EditError::IpsUnrepresentable)
            };
        }
        let off = (usize::from(head[0]) << 16) | (usize::from(head[1]) << 8) | usize::from(head[2]);
        let sz = ips.get(q + 3..q + 5).ok_or(EditError::IpsUnrepresentable)?;
        let n = (usize::from(sz[0]) << 8) | usize::from(sz[1]);
        if n == 0 {
            return Err(EditError::IpsUnrepresentable);
        }
        let data = ips
            .get(q + 5..q + 5 + n)
            .ok_or(EditError::IpsUnrepresentable)?;
        let end = off.checked_add(n).ok_or(EditError::IpsUnrepresentable)?;
        if end > out.len() {
            return Err(EditError::IpsUnrepresentable);
        }
        out[off..end].copy_from_slice(data);
        q += 5 + n;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rom() -> Vec<u8> {
        (0u8..64).collect()
    }

    fn view<'a>(name: &'a str, value: i64, min: i64, max: i64, offs: &'a [usize]) -> FieldView<'a> {
        FieldView {
            name,
            value,
            min,
            max,
            rom_offsets: offs,
            enc: FieldEnc::IMM16_BE,
        }
    }

    #[test]
    fn planeja_so_o_que_muda_e_guarda_os_bytes_antigos() {
        let r = rom();
        let offs = [4usize, 20];
        let f = [view("a", 0x0405, 1, 0x7FFF, &offs)];
        let p = plan_field_edits(&r, &f, &[("a", Some(0x0900))]).unwrap();
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].old, vec![4, 5]);
        assert_eq!(p[0].new, vec![0x09, 0x00]);
        assert_eq!(p[1].old, vec![20, 21]);
        let out = apply(&r, &p).unwrap();
        assert_eq!(out.len(), r.len());
        assert_eq!(&out[4..6], &[0x09, 0x00]);
        assert_eq!(&out[20..22], &[0x09, 0x00]);
        // reaplicar sobre a cópia (bytes antigos já não conferem)
        assert_eq!(apply(&out, &p), Err(EditError::StaleBytes));
    }

    #[test]
    fn recusa_campo_ausente_dominio_noop_e_offset_fora_da_rom() {
        let r = rom();
        let offs = [4usize];
        let f = [view("a", 0x0405, 1, 0x7FFF, &offs)];
        assert_eq!(
            plan_field_edits(&r, &f, &[("b", Some(5))]),
            Err(PlanError::FieldUnavailable)
        );
        assert_eq!(
            plan_field_edits(&r, &f, &[("a", Some(0))]),
            Err(PlanError::OutOfRange)
        );
        assert_eq!(
            plan_field_edits(&r, &f, &[("a", Some(0x8000))]),
            Err(PlanError::OutOfRange)
        );
        assert_eq!(
            plan_field_edits(&r, &f, &[("a", Some(0x0405))]),
            Err(PlanError::NoChange)
        );
        assert_eq!(
            plan_field_edits(&r, &f, &[("a", None)]),
            Err(PlanError::NoChange)
        );
        let far = [63usize];
        let g = [view("a", 1, 1, 10, &far)];
        assert_eq!(
            plan_field_edits(&r, &g, &[("a", Some(2))]),
            Err(PlanError::OutOfBounds)
        );
        let huge = [usize::MAX];
        let h = [view("a", 1, 1, 10, &huge)];
        assert_eq!(
            plan_field_edits(&r, &h, &[("a", Some(2))]),
            Err(PlanError::OutOfBounds)
        );
    }

    #[test]
    fn ips_ida_e_volta_com_aplicador_independente() {
        let r = rom();
        let offs = [10usize];
        let f = [view("a", 0x0A0B, 1, 0x7FFF, &offs)];
        let p = plan_field_edits(&r, &f, &[("a", Some(0x0123))]).unwrap();
        let copia = apply(&r, &p).unwrap();
        let ips_bytes = ips(&p).unwrap();
        assert_eq!(&ips_bytes[..5], b"PATCH");
        assert_eq!(&ips_bytes[ips_bytes.len() - 3..], b"EOF");
        assert_eq!(ips_apply_strict(&r, &ips_bytes).unwrap(), copia);
    }

    #[test]
    fn ips_recusa_o_que_o_formato_nao_representa() {
        let p = |o: usize, n: usize| Patch {
            offset: o,
            old: vec![0; n],
            new: vec![1; n],
        };
        assert_eq!(ips(&[]), Err(EditError::IpsUnrepresentable));
        assert_eq!(ips(&[p(0x100_0100, 2)]), Err(EditError::IpsUnrepresentable));
        assert_eq!(
            ips(&[p(IPS_EOF_OFFSET, 2)]),
            Err(EditError::IpsUnrepresentable)
        );
        assert_eq!(ips(&[p(0x10, 0)]), Err(EditError::IpsUnrepresentable));
        assert_eq!(
            ips(&[p(0x10, IPS_MAX_RECORD + 1)]),
            Err(EditError::IpsUnrepresentable)
        );
        assert_eq!(
            ips(&[p(0x10, 4), p(0x12, 4)]),
            Err(EditError::IpsUnrepresentable)
        );
        assert!(ips(&[p(IPS_MAX_OFFSET, 1)]).is_ok());
    }

    #[test]
    fn aplicador_estrito_recusa_ips_malformado() {
        let r = rom();
        assert_eq!(
            ips_apply_strict(&r, b"PATCH"),
            Err(EditError::IpsUnrepresentable)
        );
        assert_eq!(
            ips_apply_strict(&r, b"XATCHEOFxxxx"),
            Err(EditError::IpsUnrepresentable)
        );
        // lixo depois do EOF
        assert_eq!(
            ips_apply_strict(&r, b"PATCHEOFzz"),
            Err(EditError::IpsUnrepresentable)
        );
        // registro além do fim da ROM
        let mut bad = b"PATCH".to_vec();
        bad.extend([0x00, 0x00, 0x3F, 0x00, 0x04, 1, 2, 3, 4]);
        bad.extend(b"EOF");
        assert_eq!(
            ips_apply_strict(&r, &bad),
            Err(EditError::IpsUnrepresentable)
        );
        // RLE (tamanho 0)
        let mut rle = b"PATCH".to_vec();
        rle.extend([0x00, 0x00, 0x04, 0x00, 0x00]);
        rle.extend(b"EOF");
        assert_eq!(
            ips_apply_strict(&r, &rle),
            Err(EditError::IpsUnrepresentable)
        );
    }

    #[test]
    fn codificacao_respeita_largura_sinal_e_ordem_dos_bytes_e_nunca_trunca() {
        let u8_ = FieldEnc {
            width: 1,
            signed: false,
            little: false,
        };
        let le32 = FieldEnc {
            width: 4,
            signed: false,
            little: true,
        };
        assert_eq!(FieldEnc::IMM16_BE.encode(-2), Some(vec![0xFF, 0xFE]));
        assert_eq!(FieldEnc::IMM16_BE.decode(&[0xFF, 0xFE]), -2);
        assert_eq!(FieldEnc::IMM16_BE.encode(32768), None);
        assert_eq!(FieldEnc::IMM16_BE.encode(-32769), None);
        assert_eq!(u8_.encode(255), Some(vec![0xFF]));
        assert_eq!(u8_.encode(256), None);
        assert_eq!(u8_.encode(-1), None);
        assert_eq!(u8_.decode(&[0xFF]), 255);
        assert_eq!(le32.encode(0x0102_0304), Some(vec![4, 3, 2, 1]));
        assert_eq!(le32.decode(&[4, 3, 2, 1]), 0x0102_0304);
        assert_eq!(le32.encode(1 << 32), None);
        assert_eq!(le32.range(), (0, 0xFFFF_FFFF));
    }

    #[test]
    fn plano_recusa_valor_que_nao_cabe_na_largura_mesmo_dentro_do_dominio_declarado() {
        let offs = [4usize];
        let f = FieldView {
            name: "b",
            value: 4,
            min: 0,
            max: 1000,
            rom_offsets: &offs,
            enc: FieldEnc {
                width: 1,
                signed: false,
                little: false,
            },
        };
        assert_eq!(
            plan_field_edits(&rom(), &[f], &[("b", Some(300))]),
            Err(PlanError::OutOfRange)
        );
        let ok = plan_field_edits(&rom(), &[f], &[("b", Some(200))]).unwrap();
        assert_eq!(ok[0].old, vec![4]);
        assert_eq!(ok[0].new, vec![200]);
    }
}
