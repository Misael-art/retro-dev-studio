//! Recurso gráfico comprimido em Kosinski base dentro de um **slot** fixo da ROM.
//!
//! Camada de FORMATO DO RECURSO, sem conhecimento de jogo: não há título,
//! offset fixo nem nome de personagem aqui. Um perfil (ex.: `streets_of_rage`)
//! entrega o `SlotSpec` (offset, tamanho do slot, tamanho e hash do plain) e a
//! lista de streams vizinhos a proteger; este módulo só executa a transação:
//!
//! 1. a base decodifica exatamente na evidência do perfil;
//! 2. a cópia atual só difere da base DENTRO do slot e ainda decodifica;
//! 3. as edições de pixel (4bpp chunky) são aplicadas ao plain da cópia;
//! 4. o plain é recomprimido (parse ótimo) e DEVE caber no slot — sem
//!    deslocar nada; falta de espaço é recusa, não relocação;
//! 5. ida e volta no decoder; vizinhos decodificam igual; diff só no slot;
//! 6. BPS canônico base→modificada, reaplicado byte a byte.
//!
//! Nada é escrito em disco aqui (puro): quem persiste é o adaptador.

use super::rex_codecs::CodecError;
use super::rex_kosinski::{
    kosinski_decode, kosinski_encode_optimal, KosinskiDecodeLimits, KosinskiEncodeLimits,
};
use super::rex_resources::{md_write_pixel_index, PixelEdit};

/// Slot de um stream Kosinski: o espaço comprovadamente dele.
#[derive(Debug, Clone, Copy)]
pub struct SlotSpec<'a> {
    pub offset: usize,
    /// Bytes que o stream original consome (e que a edição pode usar).
    pub len: usize,
    pub plain_len: usize,
    pub plain_sha256: &'a str,
}

/// Stream vizinho cuja decodificação deve permanecer idêntica.
#[derive(Debug, Clone, Copy)]
pub struct GuardStream<'a> {
    pub offset: usize,
    pub consumed: usize,
    pub plain_sha256: &'a str,
}

#[derive(Debug)]
pub struct Applied {
    pub modified_rom: Vec<u8>,
    pub modified_rom_sha256: String,
    pub plain_after: Vec<u8>,
    /// Bytes do novo stream (<= slot.len).
    pub stream_len: usize,
    pub slot_len: usize,
    pub tiles_changed: Vec<u32>,
    pub pixels_changed: u32,
    pub patch_bps: Vec<u8>,
    pub patch_bps_sha256: String,
    /// Vizinhos conferidos como idênticos após a edição.
    pub guards_verified: usize,
    /// Bytes que diferem da base (todos dentro do slot).
    pub changed_offsets: Vec<u64>,
}

#[derive(Debug)]
pub enum Outcome {
    /// Nenhum pixel mudaria: nada é escrito.
    NoOp,
    Applied(Box<Applied>),
}

fn sha(bytes: &[u8]) -> String {
    super::rom_library::sha256_hex(bytes)
}

fn slot_bytes<'a>(rom: &'a [u8], offset: usize, len: usize) -> Result<&'a [u8], CodecError> {
    offset
        .checked_add(len)
        .and_then(|end| rom.get(offset..end))
        .ok_or_else(|| CodecError::new("invalid_reference", "slot fora da ROM"))
}

/// Decodifica o stream do slot; `max_consumed` limita o que ele pode consumir.
pub fn decode_slot(rom: &[u8], slot: &SlotSpec<'_>) -> Result<(Vec<u8>, usize), CodecError> {
    slot_bytes(rom, slot.offset, slot.len)?;
    let stream = rom
        .get(slot.offset..)
        .ok_or_else(|| CodecError::new("invalid_reference", "stream fora da ROM"))?;
    let limits = KosinskiDecodeLimits {
        max_output: slot.plain_len,
        ..Default::default()
    };
    let decoded = kosinski_decode(stream, &limits)?;
    if decoded.data.len() != slot.plain_len {
        return Err(CodecError::new(
            "evidence_mismatch",
            format!(
                "stream decodifica {} bytes; o perfil declara {}",
                decoded.data.len(),
                slot.plain_len
            ),
        ));
    }
    if decoded.bytes_consumed > slot.len {
        return Err(CodecError::new(
            "slot_overrun",
            format!(
                "stream consome {} bytes; o slot tem {}",
                decoded.bytes_consumed, slot.len
            ),
        ));
    }
    Ok((decoded.data, decoded.bytes_consumed))
}

/// Confere a base contra a evidência do perfil (consumo e hash exatos).
pub fn verify_base(rom: &[u8], slot: &SlotSpec<'_>) -> Result<Vec<u8>, CodecError> {
    let (plain, consumed) = decode_slot(rom, slot)?;
    if consumed != slot.len || sha(&plain) != slot.plain_sha256 {
        return Err(CodecError::new(
            "evidence_mismatch",
            "a base não corresponde à evidência do slot (consumo ou hash do plain)",
        ));
    }
    Ok(plain)
}

/// A cópia só pode diferir da base dentro do slot e deve decodificar.
/// Devolve o plain vigente da cópia.
pub fn validate_copy(base: &[u8], copy: &[u8], slot: &SlotSpec<'_>) -> Result<Vec<u8>, CodecError> {
    if base.len() != copy.len() {
        return Err(CodecError::new("overflow", "a cópia mudou de tamanho"));
    }
    let (lo, hi) = (slot.offset, slot.offset + slot.len);
    if let Some(i) = base
        .iter()
        .zip(copy)
        .position(|(a, b)| a != b)
        .filter(|&i| i < lo)
        .or_else(|| {
            base[hi..]
                .iter()
                .zip(&copy[hi..])
                .position(|(a, b)| a != b)
                .map(|i| hi + i)
        })
    {
        return Err(CodecError::new(
            "copy_out_of_scope",
            format!("a cópia difere da base fora do slot (primeiro byte {i:#x})"),
        ));
    }
    decode_slot(copy, slot).map(|(plain, _)| plain)
}

/// Aplica edições de pixel à cópia e reinsere no slot. Ver o módulo.
pub fn apply_pixel_edits(
    base: &[u8],
    copy: &[u8],
    slot: &SlotSpec<'_>,
    guards: &[GuardStream<'_>],
    edits: &[PixelEdit],
) -> Result<Outcome, CodecError> {
    let base_plain = verify_base(base, slot)?;
    let copy_plain = validate_copy(base, copy, slot)?;
    let tiles = slot.plain_len / 32;
    let mut edited = copy_plain.clone();
    for e in edits {
        if e.tile as usize >= tiles {
            return Err(CodecError::new(
                "tile_out_of_resource",
                format!("tile {} fora do recurso ({} tiles)", e.tile, tiles),
            ));
        }
        md_write_pixel_index(
            &mut edited,
            e.tile as usize,
            e.row as usize,
            e.col as usize,
            e.index,
        )?;
    }
    if edited == copy_plain {
        return Ok(Outcome::NoOp);
    }
    let mut modified = base.to_vec();
    if edited != base_plain {
        let limits = KosinskiEncodeLimits {
            max_stream: slot.len.max(1) * 8,
            ..Default::default()
        };
        let stream = kosinski_encode_optimal(&edited, &limits)?;
        if stream.len() > slot.len {
            return Err(CodecError::new(
                "needs_space",
                format!(
                    "o stream recomprimido tem {} bytes e o slot tem {}; sem relocação comprovada, nada foi escrito",
                    stream.len(),
                    slot.len
                ),
            ));
        }
        modified[slot.offset..slot.offset + stream.len()].copy_from_slice(&stream);
    }
    // Ida e volta no contexto real.
    let (round, stream_len) = decode_slot(&modified, slot)?;
    if round != edited {
        return Err(CodecError::new(
            "roundtrip_mismatch",
            "o stream gravado não decodifica para o plain editado",
        ));
    }
    let mut guards_verified = 0;
    for g in guards {
        let stream = modified
            .get(g.offset..)
            .ok_or_else(|| CodecError::new("invalid_reference", "vizinho fora da ROM"))?;
        let d = kosinski_decode(stream, &KosinskiDecodeLimits::default())?;
        if d.bytes_consumed != g.consumed || sha(&d.data) != g.plain_sha256 {
            return Err(CodecError::new(
                "dependent_modified",
                format!(
                    "o stream vizinho em {:#x} mudaria; transação recusada",
                    g.offset
                ),
            ));
        }
        guards_verified += 1;
    }
    let changed_offsets: Vec<u64> = base
        .iter()
        .zip(&modified)
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .map(|(i, _)| i as u64)
        .collect();
    if changed_offsets
        .iter()
        .any(|&o| (o as usize) < slot.offset || (o as usize) >= slot.offset + slot.len)
    {
        return Err(CodecError::new(
            "copy_out_of_scope",
            "a escrita atingiria bytes fora do slot",
        ));
    }
    let patch_bps = crate::tools::patch_studio::create_bps(base, &modified)
        .map_err(|m| CodecError::new("patch_failed", m))?;
    let reapplied = crate::tools::patch_studio::apply_bps(base, &patch_bps)
        .map_err(|m| CodecError::new("patch_failed", m))?;
    if reapplied != modified {
        return Err(CodecError::new(
            "patch_failed",
            "o BPS reaplicado não reproduz a cópia byte a byte",
        ));
    }
    let mut tiles_changed: Vec<u32> = edited
        .chunks(32)
        .zip(base_plain.chunks(32))
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .map(|(i, _)| i as u32)
        .collect();
    tiles_changed.sort_unstable();
    let pixels_changed = edited
        .iter()
        .zip(&base_plain)
        .map(|(a, b)| u32::from(a >> 4 != b >> 4) + u32::from(a & 15 != b & 15))
        .sum();
    Ok(Outcome::Applied(Box::new(Applied {
        modified_rom_sha256: sha(&modified),
        modified_rom: modified,
        plain_after: edited,
        stream_len,
        slot_len: slot.len,
        tiles_changed,
        pixels_changed,
        patch_bps_sha256: sha(&patch_bps),
        patch_bps,
        guards_verified,
        changed_offsets,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Arte autoral: `tiles` tiles 4bpp com padrão determinístico.
    fn plain(tiles: usize, seed: u32) -> Vec<u8> {
        (0..tiles * 32)
            .map(|i| {
                let v = (i as u32).wrapping_mul(2654435761).wrapping_add(seed) >> 17;
                (((v % 5) << 4) | ((v >> 3) % 5)) as u8
            })
            .collect()
    }

    /// ROM autoral: 64 bytes de cabeça, slot com o stream (+ tail 0xAA) e um
    /// segundo stream vizinho logo depois.
    struct Fix {
        rom: Vec<u8>,
        slot_off: usize,
        slot_len: usize,
        plain_sha: String,
        guard_off: usize,
        guard_consumed: usize,
        guard_sha: String,
        plain_len: usize,
    }

    fn fixture(tiles: usize, tail: usize) -> Fix {
        let p = plain(tiles, 1);
        let s = kosinski_encode_optimal(&p, &KosinskiEncodeLimits::default()).unwrap();
        let g = plain(6, 9);
        let gs = kosinski_encode_optimal(&g, &KosinskiEncodeLimits::default()).unwrap();
        let mut rom = vec![0x11; 64];
        let slot_off = rom.len();
        rom.extend_from_slice(&s);
        rom.extend(std::iter::repeat(0xAA).take(tail));
        let guard_off = rom.len();
        rom.extend_from_slice(&gs);
        rom.extend_from_slice(&[0x22; 16]);
        Fix {
            slot_len: s.len(),
            plain_sha: sha(&p),
            guard_consumed: gs.len(),
            guard_sha: sha(&g),
            plain_len: p.len(),
            rom,
            slot_off,
            guard_off,
        }
    }

    macro_rules! spec {
        ($f:expr) => {
            SlotSpec {
                offset: $f.slot_off,
                len: $f.slot_len,
                plain_len: $f.plain_len,
                plain_sha256: &$f.plain_sha,
            }
        };
    }
    macro_rules! guard {
        ($f:expr) => {
            [GuardStream {
                offset: $f.guard_off,
                consumed: $f.guard_consumed,
                plain_sha256: &$f.guard_sha,
            }]
        };
    }
    fn edit(tile: u32, row: u32, col: u32, index: u8) -> PixelEdit {
        PixelEdit {
            tile,
            row,
            col,
            index,
        }
    }
    fn applied(o: Outcome) -> Applied {
        match o {
            Outcome::Applied(a) => *a,
            Outcome::NoOp => panic!("esperava Applied"),
        }
    }
    fn err(r: Result<Outcome, CodecError>) -> String {
        r.expect_err("esperava recusa").code.to_string()
    }

    #[test]
    fn edicao_cabe_no_slot_so_muda_o_slot_e_o_bps_reproduz() {
        let f = fixture(8, 40);
        let slot = spec!(f);
        let a = applied(
            apply_pixel_edits(&f.rom, &f.rom, &slot, &guard!(f), &[edit(2, 3, 5, 15)]).unwrap(),
        );
        assert_eq!(a.pixels_changed, 1);
        assert_eq!(a.tiles_changed, vec![2]);
        assert!(a.stream_len <= f.slot_len);
        assert!(a
            .changed_offsets
            .iter()
            .all(|&o| (o as usize) >= f.slot_off && (o as usize) < f.slot_off + f.slot_len));
        assert_eq!(a.guards_verified, 1);
        assert_eq!(a.modified_rom.len(), f.rom.len());
        let reapplied = crate::tools::patch_studio::apply_bps(&f.rom, &a.patch_bps).unwrap();
        assert_eq!(reapplied, a.modified_rom);
        // O pixel editado é o único que mudou no plain.
        let (p, _) = decode_slot(&a.modified_rom, &slot).unwrap();
        assert_eq!(p[2 * 32 + 3 * 4 + 5 / 2] & 0x0F, 15);
    }

    #[test]
    fn no_op_nao_escreve_nada() {
        let f = fixture(8, 40);
        let slot = spec!(f);
        let cur = decode_slot(&f.rom, &slot).unwrap().0;
        let idx = (cur[1 * 32] >> 4) as u8; // pixel (tile 1, linha 0, col 0) já vale isto
        assert!(matches!(
            apply_pixel_edits(&f.rom, &f.rom, &slot, &guard!(f), &[edit(1, 0, 0, idx)]).unwrap(),
            Outcome::NoOp
        ));
        assert!(matches!(
            apply_pixel_edits(&f.rom, &f.rom, &slot, &guard!(f), &[]).unwrap(),
            Outcome::NoOp
        ));
    }

    #[test]
    fn edicoes_acumulam_sobre_a_copia_e_voltar_ao_original_restaura_a_base() {
        let f = fixture(8, 40);
        let slot = spec!(f);
        let a1 =
            applied(apply_pixel_edits(&f.rom, &f.rom, &slot, &[], &[edit(0, 0, 0, 14)]).unwrap());
        let a2 = applied(
            apply_pixel_edits(&f.rom, &a1.modified_rom, &slot, &[], &[edit(5, 7, 7, 13)]).unwrap(),
        );
        assert_eq!(a2.tiles_changed, vec![0, 5]);
        let orig = decode_slot(&f.rom, &slot).unwrap().0;
        let back = applied(
            apply_pixel_edits(
                &f.rom,
                &a2.modified_rom,
                &slot,
                &[],
                &[
                    edit(0, 0, 0, orig[0] >> 4),
                    edit(5, 7, 7, orig[5 * 32 + 7 * 4 + 3] & 15),
                ],
            )
            .unwrap(),
        );
        assert_eq!(
            back.modified_rom, f.rom,
            "plain igual ao original => bytes originais"
        );
        assert!(back.changed_offsets.is_empty());
    }

    #[test]
    fn recusas_identidade_escopo_tile_e_espaco() {
        let f = fixture(8, 40);
        let slot = spec!(f);
        // identidade errada: hash do plain não bate
        let ruim = SlotSpec {
            plain_sha256: &f.guard_sha,
            ..slot
        };
        assert_eq!(
            err(apply_pixel_edits(
                &f.rom,
                &f.rom,
                &ruim,
                &[],
                &[edit(0, 0, 0, 1)]
            )),
            "evidence_mismatch"
        );
        // base adulterada dentro do stream
        let mut adulterada = f.rom.clone();
        adulterada[f.slot_off + 3] ^= 0xFF;
        assert!(
            apply_pixel_edits(&adulterada, &adulterada, &slot, &[], &[edit(0, 0, 0, 1)]).is_err()
        );
        // cópia alterada fora do slot
        let mut fora = f.rom.clone();
        fora[3] ^= 1;
        assert_eq!(
            err(apply_pixel_edits(
                &f.rom,
                &fora,
                &slot,
                &[],
                &[edit(0, 0, 0, 9)]
            )),
            "copy_out_of_scope"
        );
        // tile fora do recurso / pixel fora do tile
        assert_eq!(
            err(apply_pixel_edits(
                &f.rom,
                &f.rom,
                &slot,
                &[],
                &[edit(8, 0, 0, 1)]
            )),
            "tile_out_of_resource"
        );
        assert!(apply_pixel_edits(&f.rom, &f.rom, &slot, &[], &[edit(0, 8, 0, 1)]).is_err());
        assert!(apply_pixel_edits(&f.rom, &f.rom, &slot, &[], &[edit(0, 0, 0, 16)]).is_err());
        // falta de espaço: slot justo e edição que piora a compressão
        let p = plain(40, 3);
        let s = kosinski_encode_optimal(&p, &KosinskiEncodeLimits::default()).unwrap();
        let mut rom = vec![0u8; 8];
        rom.extend_from_slice(&s);
        rom.extend_from_slice(&[0x77; 64]);
        let sha_p = sha(&p);
        let justo = SlotSpec {
            offset: 8,
            len: s.len(),
            plain_len: p.len(),
            plain_sha256: &sha_p,
        };
        let muitas: Vec<PixelEdit> = (0..40u32)
            .flat_map(|t| {
                (0..8u32).map(move |r| edit(t, r, (r + t) % 8, ((t * 7 + r * 3) % 15 + 1) as u8))
            })
            .collect();
        let before = rom.clone();
        assert_eq!(
            err(apply_pixel_edits(&rom, &rom, &justo, &[], &muitas)),
            "needs_space"
        );
        assert_eq!(rom, before, "recusa não escreve nada");
    }

    #[test]
    fn vizinho_que_mudaria_e_recusado() {
        let f = fixture(8, 0);
        let slot = spec!(f);
        // Vizinho declarado dentro do slot: qualquer edição o muda.
        let g = [GuardStream {
            offset: f.slot_off,
            consumed: f.slot_len,
            plain_sha256: &f.plain_sha,
        }];
        assert_eq!(
            err(apply_pixel_edits(
                &f.rom,
                &f.rom,
                &slot,
                &g,
                &[edit(0, 0, 0, 15)]
            )),
            "dependent_modified"
        );
    }
}
