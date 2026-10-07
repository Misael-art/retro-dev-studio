//! Perfil `Streets of Rage (World)` (imagem PtBr de 512 KiB): fonte do jogo.
//!
//! O perfil fornece IDENTIDADE, ESTRUTURAS e PROVA; o codec e a transação são
//! genéricos (`rex_kosinski`, `rex_kosinski_resource`). Aqui moram os offsets
//! medidos e a conferência estática da cadeia
//! `referência → decoder → destino → VDP`:
//!
//! - ROM: SHA-256 `ROM_SHA256` (membro `Streets of Rage (World).gen`, CRC-32
//!   `88e4ef3c`, do zip "Translated PtBr"). É uma tradução, não a ROM original.
//! - Stream Kosinski base em `0x389A0` (514 bytes → 1568 bytes = 49 tiles 4bpp
//!   de uma fonte itálica).
//! - Decoder: rotina `$085A2` (160 bytes, identidade morfológica Kosinski base,
//!   idêntica à do Sonic 1); chamada por `jsr $085A2` com A0=fonte, A1=destino.
//! - Referências ao stream: `lea $389A0,A0` em `$087FC` (destino `$FF7000`,
//!   depois 50 passadas de 32 bytes para a VRAM) e em `$119B4` (destino
//!   `$FF7000`, tiles escolhidos por uma lista) e a entrada 0 da tabela do
//!   carregador `$B748` (`$B768`: `$389A0 → $FF0000`), esta última comprovada
//!   em execução no core (stream decodificado em `$FF0000` nos quadros 183-184).
//!
//! NÃO provado aqui: a paleta com que cada tela pinta estes tiles (a prévia é
//! em escala de cinza por índice) nem o mapa tile→caractere.

use super::rex_kosinski_resource::{GuardStream, SlotSpec};

pub const PROFILE_ID: &str = "streets_of_rage_world_ptbr/font_kosinski/v1";
pub const RESOURCE_ID: &str = "sor1_font";
pub const ROM_SHA256: &str = "304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d";
pub const ROM_LEN: usize = 0x80000;

pub const STREAM_OFFSET: usize = 0x389A0;
pub const STREAM_LEN: usize = 514;
pub const PLAIN_LEN: usize = 1568;
pub const TILES: usize = PLAIN_LEN / 32;
pub const PLAIN_SHA256: &str = "4d4660eeb4f03a1078fa44baa0b9943512f275f986de123b3edf7a604170cf69";

pub const DECODER_OFFSET: usize = 0x85A2;
pub const DECODER_LEN: usize = 160;
pub const DECODER_SHA256: &str = "e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90";

/// Referência de código ao stream: `(offset, bytes esperados)`.
pub const LEA_SITES: [usize; 2] = [0x087FC, 0x119B4];
const LEA_PATTERN: [u8; 6] = [0x41, 0xF9, 0x00, 0x03, 0x89, 0xA0];
/// Entrada 0 da tabela do carregador: `src.l, dst.l`.
pub const LOADER_TABLE_ENTRY0: usize = 0xB768;
const LOADER_ENTRY0: [u8; 8] = [0x00, 0x03, 0x89, 0xA0, 0x00, 0xFF, 0x00, 0x00];
/// `jsr $085A2` do carregador de tabela.
const LOADER_JSR: (usize, [u8; 6]) = (0xB75C, [0x4E, 0xB9, 0x00, 0x00, 0x85, 0xA2]);

pub fn slot() -> SlotSpec<'static> {
    SlotSpec {
        offset: STREAM_OFFSET,
        len: STREAM_LEN,
        plain_len: PLAIN_LEN,
        plain_sha256: PLAIN_SHA256,
    }
}

/// Streams Kosinski vizinhos já medidos neste corpus (frente A): a edição não
/// pode alterá-los. É o escopo ANALISADO; não é uma varredura do jogo todo.
pub fn guards() -> [GuardStream<'static>; 4] {
    [
        GuardStream {
            offset: 0x1CAEC,
            consumed: 611,
            plain_sha256: "f2b96499a5547a872d168e51f14f9846e2013060aadaca3a1810204bdaf1fceb",
        },
        GuardStream {
            offset: 0x1F596,
            consumed: 374,
            plain_sha256: "9fc8ceeb41096fbbdf844803e2a37af1a259058e10ceb61b2b46d67b804ad29b",
        },
        GuardStream {
            offset: 0x71C6C,
            consumed: 656,
            plain_sha256: "56ba7c54f6b273e95f392a5630673996298767dafc4eb912b58c1cd920d5e3ce",
        },
        GuardStream {
            offset: 0x795A2,
            consumed: 7581,
            plain_sha256: "07cabd018ad00804d54ba2c61bcd25ec933b5ba89fa382e74169022423688fd2",
        },
    ]
}

/// Quantos vizinhos/estruturas fazem parte do escopo declarado.
pub const SCOPE_NOTE: &str = "escopo analisado: 4 streams Kosinski vizinhos já medidos + todos os bytes fora do slot (diff exato com a base); o resto da ROM não foi analisado funcionalmente";

/// Consumidores conhecidos do stream (para a UI e para o ledger).
pub fn consumers() -> Vec<(usize, &'static str)> {
    vec![
        (
            0x087FC,
            "lea $389A0,A0 → $FF7000 → VDP (50 passadas de 32 bytes)",
        ),
        (
            0x119B4,
            "lea $389A0,A0 → $FF7000 → VDP (lista de tiles em $11A20)",
        ),
        (
            0x0B768,
            "tabela do carregador $B748, entrada 0 → $FF0000 (observado no core)",
        ),
    ]
}

/// Prova estática da cadeia nesta ROM: identidade + decoder + referências.
/// Falha com o primeiro elo que não confere.
pub fn verify_profile(rom: &[u8]) -> Result<(), String> {
    if rom.len() != ROM_LEN {
        return Err(format!("tamanho {} diferente de {}", rom.len(), ROM_LEN));
    }
    let sha = super::rom_library::sha256_hex(rom);
    if sha != ROM_SHA256 {
        return Err(format!("SHA-256 {sha} não é o da imagem do perfil"));
    }
    let dec = &rom[DECODER_OFFSET..DECODER_OFFSET + DECODER_LEN];
    if super::rom_library::sha256_hex(dec) != DECODER_SHA256 {
        return Err("rotina decoder $085A2 não confere".into());
    }
    for off in LEA_SITES {
        if rom[off..off + 6] != LEA_PATTERN {
            return Err(format!("referência `lea $389A0` ausente em {off:#x}"));
        }
        if rom[off + 6..off + 12] != [0x43, 0xF9, 0x00, 0xFF, 0x70, 0x00] {
            return Err(format!("destino $FF7000 ausente após {off:#x}"));
        }
    }
    if rom[LOADER_TABLE_ENTRY0..LOADER_TABLE_ENTRY0 + 8] != LOADER_ENTRY0 {
        return Err("entrada 0 da tabela do carregador não confere".into());
    }
    if rom[LOADER_JSR.0..LOADER_JSR.0 + 6] != LOADER_JSR.1 {
        return Err("jsr $085A2 do carregador não confere".into());
    }
    Ok(())
}

/// Diagnóstico para ROM sem perfil: o que se sabe e o que falta.
pub fn unsupported_reason(rom: &[u8]) -> String {
    match verify_profile(rom) {
        Ok(()) => String::new(),
        Err(e) => format!("Esta ROM não tem perfil de fonte do Streets of Rage: {e}."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::reverse::decomp::rex_kosinski::{
        kosinski_encode_optimal, KosinskiEncodeLimits,
    };
    use crate::tools::reverse::decomp::rex_kosinski_resource as res;
    use crate::tools::reverse::decomp::rex_resources::PixelEdit;

    fn byor() -> Option<Vec<u8>> {
        let p = std::env::var("RDS_SOR_ROM").ok()?;
        Some(std::fs::read(p).expect("RDS_SOR_ROM ilegível"))
    }

    #[test]
    fn tabela_de_vizinhos_nao_se_sobrepoe_ao_slot() {
        for g in guards() {
            let (a, b) = (g.offset, g.offset + g.consumed);
            assert!(
                b <= STREAM_OFFSET || a >= STREAM_OFFSET + STREAM_LEN,
                "{a:#x}"
            );
        }
    }

    #[test]
    fn rom_diferente_recebe_diagnostico_preciso() {
        let msg = unsupported_reason(&[0u8; 100]);
        assert!(msg.contains("tamanho 100"), "{msg}");
        let mut rom = vec![0u8; ROM_LEN];
        rom[0] = 1;
        assert!(
            unsupported_reason(&rom).contains("SHA-256"),
            "sha diferente"
        );
    }

    #[test]
    #[ignore = "BYOR Streets of Rage; RDS_SOR_ROM obrigatório"]
    fn byor_prova_estatica_e_stream_real() {
        let rom = byor().expect("RDS_SOR_ROM");
        verify_profile(&rom).unwrap();
        let plain = res::verify_base(&rom, &slot()).unwrap();
        assert_eq!(plain.len(), PLAIN_LEN);
        for g in guards() {
            let d = crate::tools::reverse::decomp::rex_kosinski::kosinski_decode(
                &rom[g.offset..],
                &Default::default(),
            )
            .unwrap();
            assert_eq!(d.bytes_consumed, g.consumed);
            assert_eq!(
                super::super::rom_library::sha256_hex(&d.data),
                g.plain_sha256
            );
        }
        // O encoder ótimo cabe no slot original (o guloso do crate não cabe).
        let opt = kosinski_encode_optimal(&plain, &KosinskiEncodeLimits::default()).unwrap();
        let greedy = crate::tools::reverse::decomp::rex_kosinski::kosinski_encode(
            &plain,
            &KosinskiEncodeLimits::default(),
        )
        .unwrap();
        eprintln!(
            "otimo={} guloso={} slot={}",
            opt.len(),
            greedy.len(),
            STREAM_LEN
        );
        assert!(opt.len() <= STREAM_LEN);
    }

    #[test]
    #[ignore = "BYOR Streets of Rage; RDS_SOR_ROM obrigatório"]
    fn byor_edicao_real_cabe_e_preserva_vizinhos() {
        let rom = byor().expect("RDS_SOR_ROM");
        let out = res::apply_pixel_edits(
            &rom,
            &rom,
            &slot(),
            &guards(),
            &[PixelEdit {
                tile: 1,
                row: 3,
                col: 3,
                index: 15,
            }],
        )
        .unwrap();
        let res::Outcome::Applied(a) = out else {
            panic!("no-op inesperado")
        };
        eprintln!(
            "stream={} slot={} bytes={} bps={}",
            a.stream_len,
            a.slot_len,
            a.changed_offsets.len(),
            a.patch_bps.len()
        );
        assert_eq!(a.guards_verified, 4);
    }

    /// Ferramenta de reprodução (não é gate): grava a ROM editada pela MESMA
    /// transação do produto. `RDS_SOR_EDITS="tile:linha:col:indice,..."`,
    /// `RDS_SOR_OUT` = arquivo de saída, `RDS_SOR_BPS` (opcional) = patch.
    #[test]
    #[ignore = "ferramenta BYOR: RDS_SOR_ROM, RDS_SOR_EDITS, RDS_SOR_OUT"]
    fn byor_gera_rom_editada() {
        let rom = byor().expect("RDS_SOR_ROM");
        let edits: Vec<PixelEdit> = std::env::var("RDS_SOR_EDITS")
            .expect("RDS_SOR_EDITS")
            .split(',')
            .map(|e| {
                let v: Vec<u32> = e.split(':').map(|n| n.parse().unwrap()).collect();
                PixelEdit {
                    tile: v[0],
                    row: v[1],
                    col: v[2],
                    index: v[3] as u8,
                }
            })
            .collect();
        let out = res::apply_pixel_edits(&rom, &rom, &slot(), &guards(), &edits).unwrap();
        let res::Outcome::Applied(a) = out else {
            panic!("no-op")
        };
        std::fs::write(
            std::env::var("RDS_SOR_OUT").expect("RDS_SOR_OUT"),
            &a.modified_rom,
        )
        .unwrap();
        if let Ok(p) = std::env::var("RDS_SOR_BPS") {
            std::fs::write(p, &a.patch_bps).unwrap();
        }
        eprintln!(
            "stream={}/{} sha={}",
            a.stream_len, a.slot_len, a.modified_rom_sha256
        );
    }
}
