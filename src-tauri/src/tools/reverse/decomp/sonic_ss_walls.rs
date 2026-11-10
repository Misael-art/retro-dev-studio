//! Perfil Sonic 1 — composição SOMENTE-LEITURA das paredes da fase especial.
//! Cadeia: ID de bloco → SS_MapIndex (0x1B738) → Map_SSWalls (0x2C564) →
//! arte Nemesis (0x2C5E4, base de tile 0x142) → paleta → imagem indexada.
//! Genérico em `rex_nemesis` + `rex_mdgfx`; aqui só há ORIGEM e prova.
//! Contrato: docs/rex_profiles/integration_20261007/EXPECTATIONS-SS-REMONTAGEM-2026-10-07.md.
//!
//! Níveis de prova (nada aqui é "consumo observado"):
//!  * ID→registro→ponteiro: vínculo estrutural estático (loader pinado por B);
//!  * mapping/arte: decodificados AGORA da ROM recebida, conferidos contra pins;
//!  * paleta: CANDIDATA ESTÁTICA (Pal_SpecialStage); o estado do jogo muda por
//!    PalCycle_SS/fade e nunca é atribuído a ela;
//!  * o frame de rotação é estado de execução: o chamador escolhe 0..15.

use serde::{Deserialize, Serialize};

use super::rex_mdgfx as gfx;
use super::rex_nemesis as nem;
use super::rom_library::sha256_hex;
use super::sonic_consumers as cons;

pub const FORMATO_INFO: &str = "ss-walls-info/v1";
pub const FORMATO_COMPOSICAO: &str = "ss-walls-compose/v1";
pub const ART_OFFSET: usize = 0x2C5E4;
pub const ART_TILES: usize = 249;
pub const ART_BYTES_LIDOS: usize = 2360;
pub const ART_SHA256: &str = "5c36a38a784b3d40f506cffdd248aa20bda8464b7923093b4be5d0f8e7202860";
pub const ART_TILE_BASE: u16 = 0x142; // VRAM $2840 / 32 (PLC_SpecialStage, B)
pub const MAP_TABLE: usize = 0x2C564;
pub const MAP_BYTES: usize = 128;
pub const MAP_FRAMES: usize = 16;
pub const MAP_SHA256: &str = "e9270b82c93fb0588a2310a2d148b48688b08ecfd945e8c7a3483a62c1b0fc46";
pub const PALLOAD_TABLE: usize = 0x2168;
pub const PALLOAD_ID: usize = 10; // Pal_SpecialStage
pub const PAL_PTR: usize = 0x26C8;
pub const PAL_SHA256: &str = "2f9072d8714ac735dba537f2cbb00aeac349b411fc86d1ef76fb9c81b7c3432d";
pub const PAL_ROTULO: &str = "candidata estática (Pal_SpecialStage, carregada em 0x469A)";
pub const PLC_OFFSET: usize = 0x1D992; // PLC_SpecialStage (B: ocorrencia unica, 17 cues)
pub const PLC_CUES: usize = 17;
/// Pares (ponteiro do mapping, campo do registro, frame) CONFIRMADOS por pixel contra frames
/// do core em 2 capturas de entrada independentes (docs/.../EXPECTATIONS-SS-MAPPINGS-2026-10-07.md,
/// evidência ss-mappings-confirmacao.json). Só estes geram imagem; o resto mostra a estrutura lida.
pub const CONFIRMADOS: [(usize, u16, usize); 13] = [
    (0x1B90C, 0x22F0, 0),
    (0x1B90C, 0x0251, 0),
    (0x1B90C, 0x0251, 1),
    (0x1B90C, 0x02F0, 0),
    (0x1B90C, 0x04F0, 0),
    (0x1B920, 0x0470, 0),
    (0x1B920, 0x0470, 1),
    (0x1B920, 0x0470, 2),
    (0x1B920, 0x0470, 3),
    (0x1B940, 0x0263, 0),
    (0x1B940, 0x0263, 1),
    (0x1B950, 0x0263, 0),
    (0x1B950, 0x0263, 1),
];
pub const NIVEL_PAREDES: &str =
    "confirmado por frame do core (16/16 frames, evidência ss-walls-core-frame.json)";
pub const NIVEL_CONFIRMADO: &str =
    "confirmado por pixel contra frames do core genesis_plus_gx em 2 capturas de entrada independentes";
pub const JANELA_ART: usize = 8192;
pub const MAX_TOKENS: u64 = 40_000;

fn err(code: &str, detail: impl Into<String>) -> String {
    format!("{code}: {}", detail.into())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Elo {
    pub ordem: usize,
    pub de: String,
    pub para: String,
    pub origem: String,
    pub nivel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArteInfo {
    pub offset_hex: String,
    pub bytes_lidos: usize,
    pub tiles: usize,
    pub modo_xor: bool,
    pub saida_sha256: String,
    pub confere_pin: bool,
    pub tiles_vazios: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaletaInfo {
    pub rotulo: String,
    pub natureza: String,
    pub entrada_palload_hex: String,
    pub ponteiro_hex: String,
    pub sha256: String,
    pub confere_pin: bool,
    /// 64 palavras CRAM (4 linhas × 16), hex de 4 dígitos.
    pub palavras_hex: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SsWallsInfo {
    pub formato: String,
    pub sessao_id: String,
    pub rom_sha256: String,
    pub arte: ArteInfo,
    pub mapping_tabela_hex: String,
    pub mapping_frames: usize,
    pub mapping_sha256: String,
    pub mapping_confere_pin: bool,
    pub paleta: PaletaInfo,
    /// IDs de bloco (1-based) cujo registro aponta para este mapping, com a linha de paleta do registro.
    pub ids_cobertos: Vec<IdCoberto>,
    pub desconhecidos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IdCoberto {
    pub id: u8,
    pub linha_paleta: u8,
    pub campo_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArteVinculada {
    pub cue_indice: usize,
    pub stream_offset_hex: String,
    pub vram_hex: String,
    pub tile_inicial: usize,
    pub tiles: usize,
    pub bytes_lidos: usize,
    /// Posição do tile-base do registro dentro desta arte.
    pub posicao_na_arte: usize,
    pub nivel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SsWallsComposicao {
    pub formato: String,
    pub sessao_id: String,
    pub rom_sha256: String,
    pub id: u8,
    pub id_hex: String,
    /// "composta" | "id-zero" | "fora-da-tabela" | "mapping-nao-decodificado"
    pub status: String,
    pub explicacao: String,
    pub frame: Option<usize>,
    pub linha_paleta: Option<u8>,
    pub largura: usize,
    pub altura: usize,
    pub x0: i32,
    pub y0: i32,
    /// 1 byte por pixel: 0 transparente, senão (linha<<4)|índice, em hex.
    pub pixels_hex: String,
    /// RGBA de exibição com a paleta ESTÁTICA rotulada em `paleta_rotulo`.
    pub rgba_hex: String,
    pub paleta_rotulo: String,
    pub tiles_usados: Vec<usize>,
    pub tiles_vazios: Vec<usize>,
    pub cadeia: Vec<Elo>,
    pub integridade: String,
    pub aviso_frame: String,
    /// Arte (cue do PLC) que ocupa o tile-base do registro, quando existe.
    #[serde(default)]
    pub arte_vinculada: Option<ArteVinculada>,
    #[serde(default)]
    pub arte_explicacao: String,
    /// Frames que a tabela do registro oferece (regra conservadora) e quais têm confirmação por pixel.
    #[serde(default)]
    pub frames_total: usize,
    #[serde(default)]
    pub frames_confirmados: Vec<usize>,
    #[serde(default)]
    pub nivel_confirmacao: String,
    #[serde(default)]
    pub pecas: usize,
}

#[derive(Debug)]
struct Chain {
    art: Vec<u8>,
    art_stats: nem::Stats,
    pal: [u16; 64],
    pal_sha: String,
    art_sha: String,
}

fn decodificar_arte(
    rom: &[u8],
    cancel: &dyn Fn() -> bool,
) -> Result<(Vec<u8>, nem::Stats), String> {
    let ini = ART_OFFSET;
    if ini >= rom.len() {
        return Err(err("ss_fora_da_rom", format!("arte 0x{ini:x} fora da ROM")));
    }
    let fim = (ini + JANELA_ART).min(rom.len());
    let opts = nem::DecodeOptions {
        limits: nem::Limits {
            max_output_bytes: ART_TILES * nem::TILE_BYTES,
            work_limit: MAX_TOKENS,
        },
        cancel: Some(cancel),
    };
    let d = nem::decode(&rom[ini..fim], &opts).map_err(|e| {
        err(
            if e == nem::NemesisError::Cancelled {
                "cancelled"
            } else {
                "ss_decode"
            },
            format!("arte 0x{ini:x}: {}", e.code()),
        )
    })?;
    Ok((d.bytes, d.stats))
}

fn cadeia(rom: &[u8], cancel: &dyn Fn() -> bool) -> Result<Chain, String> {
    if cancel() {
        return Err(err("cancelled", "Análise cancelada pelo usuário"));
    }
    let (art, art_stats) = decodificar_arte(rom, cancel)?;
    if art_stats.tiles != ART_TILES {
        return Err(err(
            "ss_arte_tamanho",
            format!(
                "a arte tem {} tiles; o perfil exige {ART_TILES}",
                art_stats.tiles
            ),
        ));
    }
    // Entrada do PalLoad: ptr.l, ramaddr.w, contagem.w
    let ent = PALLOAD_TABLE + PALLOAD_ID * 8;
    let e = rom
        .get(ent..ent + 8)
        .ok_or_else(|| err("ss_fora_da_rom", "tabela PalLoad fora da ROM"))?;
    let ptr = u32::from_be_bytes([e[0], e[1], e[2], e[3]]) as usize;
    let ram = u16::from_be_bytes([e[4], e[5]]);
    let cnt = u16::from_be_bytes([e[6], e[7]]);
    if ptr != PAL_PTR || ram != 0xFB00 || cnt != 0x1F {
        return Err(err(
            "ss_paleta_entrada",
            format!(
                "entrada PalLoad #{PALLOAD_ID} diverge: ptr {ptr:#x} ram {ram:#x} cnt {cnt:#x}"
            ),
        ));
    }
    let pb = rom
        .get(ptr..ptr + 128)
        .ok_or_else(|| err("ss_fora_da_rom", "paleta fora da ROM"))?;
    let pal = gfx::palette_words(pb).map_err(|g| err("ss_paleta", g.code()))?;
    Ok(Chain {
        art_sha: sha256_hex(&art),
        pal_sha: sha256_hex(pb),
        art,
        art_stats,
        pal,
    })
}

fn tabela_confere(rom: &[u8]) -> Result<String, String> {
    let t = rom
        .get(MAP_TABLE..MAP_TABLE + MAP_BYTES)
        .ok_or_else(|| err("ss_fora_da_rom", "Map_SSWalls fora da ROM"))?;
    Ok(sha256_hex(t))
}

fn registro(rom: &[u8], id: u8) -> (usize, usize, u16) {
    let addr = cons::MAPINDEX_ADDR + (usize::from(id) - 1) * cons::MAPINDEX_ENTRADA_BYTES;
    let r = &rom[addr..addr + cons::MAPINDEX_ENTRADA_BYTES];
    (
        addr,
        u32::from_be_bytes([0, r[1], r[2], r[3]]) as usize,
        u16::from_be_bytes([r[4], r[5]]),
    )
}

fn identidade(rom: &[u8], esperado: Option<&str>) -> Result<String, String> {
    let atual = sha256_hex(rom);
    if let Some(e) = esperado {
        if e != atual {
            return Err(err(
                "ss_rom_mudou",
                format!(
                    "a ROM da sessão mudou (esperada {}…, atual {}…); recarregue",
                    &e[..e.len().min(12)],
                    &atual[..12]
                ),
            ));
        }
    }
    Ok(atual)
}

fn desconhecidos() -> Vec<String> {
    vec![
        "O frame de rotação mostrado (0..15) é estado de execução: aqui você escolhe um; o jogo não foi observado escolhendo.".to_string(),
        "A paleta é uma candidata estática. O jogo troca cores por ciclo/fade; a composição não diz que o jogo mostrou essas cores.".to_string(),
        "Os IDs 1–36 (paredes) têm 16 frames confirmados. Para os IDs 37–78 só os frames CONFIRMADOS por pixel contra o core geram imagem; os outros mostram a estrutura lida ou o motivo da recusa.".to_string(),
        "Nenhum trecho do jogo foi executado nesta leitura; a comparação com um frame de um core é evidência separada.".to_string(),
        "Espelhamento de objeto (flip) e prioridade de sprite não foram provados para estes blocos; a composição não os aplica.".to_string(),
    ]
}

/// Cue do PLC cuja arte ocupa `tile_base` (destino VRAM/32 ≤ base < destino + tiles).
/// Todo cue é decodificado AGORA com limites; erro de um cue recusa a consulta.
fn vinculo_de_arte(
    rom: &[u8],
    tile_base: usize,
    cancel: &dyn Fn() -> bool,
) -> Result<Option<(ArteVinculada, Vec<u8>)>, String> {
    let cues = gfx::parse_plc(rom, PLC_OFFSET).map_err(|g| err("ss_plc", g.code()))?;
    if cues.len() != PLC_CUES {
        return Err(err(
            "ss_plc",
            format!("PLC com {} cues; o perfil exige {PLC_CUES}", cues.len()),
        ));
    }
    for (i, cue) in cues.iter().enumerate() {
        if cancel() {
            return Err(err("cancelled", "Análise cancelada pelo usuário"));
        }
        let fim = (cue.stream_offset + JANELA_ART).min(rom.len());
        let ini = cue.stream_offset.min(fim);
        let opts = nem::DecodeOptions {
            limits: nem::Limits {
                max_output_bytes: 0x800 * nem::TILE_BYTES,
                work_limit: MAX_TOKENS,
            },
            cancel: Some(cancel),
        };
        let d = nem::decode(&rom[ini..fim], &opts).map_err(|e| {
            err(
                if e == nem::NemesisError::Cancelled {
                    "cancelled"
                } else {
                    "ss_plc_arte"
                },
                format!("cue {i} em {:#x}: {}", cue.stream_offset, e.code()),
            )
        })?;
        let ini_tile = cue.first_tile();
        if tile_base >= ini_tile && tile_base < ini_tile + d.stats.tiles {
            return Ok(Some((ArteVinculada {
                cue_indice: i,
                stream_offset_hex: format!("{:#x}", cue.stream_offset),
                vram_hex: format!("{:#x}", cue.vram),
                tile_inicial: ini_tile,
                tiles: d.stats.tiles,
                bytes_lidos: d.stats.bytes_lidos,
                posicao_na_arte: tile_base - ini_tile,
                nivel: "vínculo estrutural estático (destino VRAM do cue = base de tile do registro); arte decodificada agora".to_string(),
            }, d.bytes)));
        }
    }
    Ok(None)
}

fn explica_arte(v: &Option<ArteVinculada>, tile_base: usize) -> String {
    match v {
        Some(a) => format!(
            "A base de tile {tile_base:#x} do registro cai na arte do cue {} do PLC ({} tiles, stream {}, VRAM {}), posição {} dentro dela. Isto liga o ID a uma arte decodificada; sem o mapping decodificado não há composição.",
            a.cue_indice, a.tiles, a.stream_offset_hex, a.vram_hex, a.posicao_na_arte
        ),
        None => format!(
            "A base de tile {tile_base:#x} do registro não cai em nenhuma das {PLC_CUES} artes do PLC da fase especial; a origem dessa arte (carregada por outro caminho) não foi comprovada."
        ),
    }
}

pub fn info(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: Option<&str>,
    cancel: &dyn Fn() -> bool,
) -> Result<SsWallsInfo, String> {
    let rom_sha = identidade(rom, esperado)?;
    cons::describe(base, rom).map(|_| ())?;
    let ch = cadeia(rom, cancel)?;
    let map_sha = tabela_confere(rom)?;
    let vazios = (0..ch.art_stats.tiles)
        .filter(|t| gfx::tile_is_empty(&ch.art, *t).unwrap_or(false))
        .collect();
    let mut ids = Vec::new();
    for id in 1..=cons::MAPINDEX_ENTRADAS as u8 {
        let (_, ptr, campo) = registro(rom, id);
        if ptr == MAP_TABLE {
            ids.push(IdCoberto {
                id,
                linha_paleta: ((campo >> 13) & 3) as u8,
                campo_hex: format!("{campo:#06x}"),
            });
        }
    }
    Ok(SsWallsInfo {
        formato: FORMATO_INFO.to_string(),
        sessao_id: sessao_id.to_string(),
        rom_sha256: rom_sha,
        arte: ArteInfo {
            offset_hex: format!("{ART_OFFSET:#x}"),
            bytes_lidos: ch.art_stats.bytes_lidos,
            tiles: ch.art_stats.tiles,
            modo_xor: ch.art_stats.xor_mode,
            confere_pin: ch.art_sha == ART_SHA256 && ch.art_stats.bytes_lidos == ART_BYTES_LIDOS,
            saida_sha256: ch.art_sha,
            tiles_vazios: vazios,
        },
        mapping_tabela_hex: format!("{MAP_TABLE:#x}"),
        mapping_frames: MAP_FRAMES,
        mapping_confere_pin: map_sha == MAP_SHA256,
        mapping_sha256: map_sha,
        paleta: PaletaInfo {
            rotulo: PAL_ROTULO.to_string(),
            natureza: "estatica".to_string(),
            entrada_palload_hex: format!("{:#x}", PALLOAD_TABLE + PALLOAD_ID * 8),
            ponteiro_hex: format!("{PAL_PTR:#x}"),
            confere_pin: ch.pal_sha == PAL_SHA256,
            sha256: ch.pal_sha,
            palavras_hex: ch.pal.iter().map(|w| format!("{w:04x}")).collect(),
        },
        ids_cobertos: ids,
        desconhecidos: desconhecidos(),
    })
}

fn vazia(
    sessao: &str,
    rom_sha: &str,
    id: u8,
    status: &str,
    explicacao: String,
) -> SsWallsComposicao {
    SsWallsComposicao {
        formato: FORMATO_COMPOSICAO.to_string(),
        sessao_id: sessao.to_string(),
        rom_sha256: rom_sha.to_string(),
        id,
        id_hex: format!("{id:#04x}"),
        status: status.to_string(),
        explicacao,
        frame: None,
        linha_paleta: None,
        largura: 0,
        altura: 0,
        x0: 0,
        y0: 0,
        pixels_hex: String::new(),
        rgba_hex: String::new(),
        paleta_rotulo: PAL_ROTULO.to_string(),
        tiles_usados: vec![],
        tiles_vazios: vec![],
        cadeia: vec![],
        integridade: String::new(),
        aviso_frame: String::new(),
        arte_vinculada: None,
        arte_explicacao: String::new(),
        frames_total: 0,
        frames_confirmados: vec![],
        nivel_confirmacao: String::new(),
        pecas: 0,
    }
}

#[allow(clippy::too_many_arguments)]
fn compor_outro(
    sessao_id: &str,
    rom_sha: &str,
    rom: &[u8],
    id: u8,
    ptr: usize,
    campo: u16,
    frame: usize,
    cancel: &dyn Fn() -> bool,
) -> Result<SsWallsComposicao, String> {
    let base_tile = usize::from(campo & 0x7FF);
    let achado = vinculo_de_arte(rom, base_tile, cancel)?;
    let (vinc, art) = match achado {
        Some((a, b)) => (Some(a), Some(b)),
        None => (None, None),
    };
    let offs = gfx::frame_offsets(rom, ptr);
    let confirmados: Vec<usize> = (0..offs.len())
        .filter(|f| CONFIRMADOS.contains(&(ptr, campo, *f)))
        .collect();
    let mut v = vazia(
        sessao_id,
        rom_sha,
        id,
        "mapping-nao-decodificado",
        format!("O registro do ID {id:#04x} aponta para o mapping {ptr:#x}, cuja tabela de frames não pôde ser lida; nenhuma imagem foi inventada."),
    );
    v.linha_paleta = Some(((campo >> 13) & 3) as u8);
    v.arte_explicacao = explica_arte(&vinc, base_tile);
    v.frames_total = offs.len();
    v.frames_confirmados = confirmados.clone();
    v.arte_vinculada = vinc.clone();
    if offs.is_empty() {
        return Ok(v);
    }
    if frame >= offs.len() {
        return Err(err(
            "ss_frame_invalido",
            format!(
                "frame {frame} inexistente; a tabela {ptr:#x} oferece {} (0..={})",
                offs.len(),
                offs.len() - 1
            ),
        ));
    }
    v.frame = Some(frame);
    let fo = ptr + offs[frame];
    let pecas = gfx::parse_frame_at(rom, fo).map_err(|g| err("ss_mapping", g.code()))?;
    v.pecas = pecas.len();
    if pecas.is_empty() {
        v.status = "frame-vazio".to_string();
        v.explicacao = format!("O frame {frame} do mapping {ptr:#x} tem 0 peças: é um frame vazio, não há imagem a mostrar.");
        return Ok(v);
    }
    let (Some(av), Some(art)) = (vinc, art) else {
        v.status = "arte-sem-cue".to_string();
        v.explicacao = format!("O frame {frame} tem {} peça(s), mas a arte da base de tile {base_tile:#x} não foi comprovada; nenhuma imagem foi inventada.", pecas.len());
        return Ok(v);
    };
    // Tile efetivo = campo + nome; relativo à arte do cue.
    let mut rel = Vec::with_capacity(pecas.len());
    let mut fora = false;
    for p in &pecas {
        let e = p.with_base(campo);
        match usize::from(e.tile).checked_sub(av.tile_inicial) {
            Some(r) if r + e.tile_count() <= av.tiles => rel.push(gfx::Piece {
                tile: r as u16,
                ..e
            }),
            _ => {
                fora = true;
                break;
            }
        }
    }
    if fora {
        v.status = "tile-fora-da-arte".to_string();
        v.explicacao = format!("O frame {frame} referencia tiles além da arte do cue {} ({} tiles); recusado, nada foi preenchido.", av.cue_indice, av.tiles);
        return Ok(v);
    }
    if !CONFIRMADOS.contains(&(ptr, campo, frame)) {
        v.status = "estrutura-sem-confirmacao".to_string();
        v.explicacao = format!("O frame {frame} foi lido ({} peça(s)) e cabe na arte do cue {}, mas NÃO foi confirmado contra pixels de um core; nenhuma imagem é mostrada.", pecas.len(), av.cue_indice);
        return Ok(v);
    }
    let img = gfx::compose(&rel, &art, 0, None, false, false)
        .map_err(|g| err("ss_composicao", g.code()))?;
    let pal = palette_estatica(rom)?;
    v.pixels_hex = img.pixels.iter().map(|b| format!("{b:02x}")).collect();
    v.rgba_hex = gfx::to_rgba(&img, &pal)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    v.largura = img.w;
    v.altura = img.h;
    v.x0 = img.x0;
    v.y0 = img.y0;
    v.tiles_usados = img.tiles_usados;
    v.tiles_vazios = img.tiles_vazios;
    v.status = "composta".to_string();
    v.explicacao = format!("Frame {frame} do mapping {ptr:#x} composto da arte do cue {} decodificada agora; cores = paleta estática rotulada.", av.cue_indice);
    v.nivel_confirmacao = NIVEL_CONFIRMADO.to_string();
    v.integridade =
        "arte, mapping e paleta lidos agora; confirmação por pixel é evidência externa registrada"
            .to_string();
    v.aviso_frame = "O frame é uma escolha sua; o jogo não foi observado escolhendo.".to_string();
    v.cadeia = vec![
        Elo {
            ordem: 1,
            de: format!("ID {id:#04x}"),
            para: format!(
                "registro SS_MapIndex {:#x}",
                cons::MAPINDEX_ADDR + (usize::from(id) - 1) * cons::MAPINDEX_ENTRADA_BYTES
            ),
            origem: format!("{:#x} + (ID-1)*6", cons::MAPINDEX_ADDR),
            nivel: "vínculo estrutural estático".into(),
        },
        Elo {
            ordem: 2,
            de: format!("registro ({campo:#06x})"),
            para: format!("mapping {ptr:#x}"),
            origem: "ponteiro de 24 bits do registro".into(),
            nivel: "vínculo estrutural estático".into(),
        },
        Elo {
            ordem: 3,
            de: format!("mapping, frame {frame}"),
            para: format!("{} peça(s)", pecas.len()),
            origem: format!(
                "tabela de ponteiros relativos em {ptr:#x} (regra conservadora de contagem)"
            ),
            nivel: NIVEL_CONFIRMADO.into(),
        },
        Elo {
            ordem: 4,
            de: "peças (nome = campo + nome da peça)".into(),
            para: format!(
                "arte do cue {} ({} tiles, stream {})",
                av.cue_indice, av.tiles, av.stream_offset_hex
            ),
            origem: format!(
                "PLC_SpecialStage {PLC_OFFSET:#x}: destino VRAM {} = base de tile",
                av.vram_hex
            ),
            nivel: "vínculo estrutural estático; arte decodificada agora".into(),
        },
        Elo {
            ordem: 5,
            de: "linha de paleta (campo + nome)".into(),
            para: PAL_ROTULO.into(),
            origem: format!("PalLoad #{PALLOAD_ID} → {PAL_PTR:#x}"),
            nivel: "candidata estática; estado do jogo NÃO provado".into(),
        },
    ];
    Ok(v)
}

fn palette_estatica(rom: &[u8]) -> Result<[u16; 64], String> {
    let pb = rom
        .get(PAL_PTR..PAL_PTR + 128)
        .ok_or_else(|| err("ss_fora_da_rom", "paleta fora da ROM"))?;
    gfx::palette_words(pb).map_err(|g| err("ss_paleta", g.code()))
}

pub fn compor(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: &str,
    id: u8,
    frame: usize,
    cancel: &dyn Fn() -> bool,
) -> Result<SsWallsComposicao, String> {
    let rom_sha = identidade(rom, Some(esperado))?;
    cons::describe(base, rom).map(|_| ())?;
    if id == 0 {
        return Ok(vazia(
            sessao_id,
            &rom_sha,
            0,
            "id-zero",
            "O ID 0 não tem registro; não há o que compor.".to_string(),
        ));
    }
    if usize::from(id) > cons::MAPINDEX_ENTRADAS {
        return Ok(vazia(
            sessao_id,
            &rom_sha,
            id,
            "fora-da-tabela",
            format!(
                "O ID {id:#04x} está além dos {} registros; nenhuma composição foi comprovada.",
                cons::MAPINDEX_ENTRADAS
            ),
        ));
    }
    let (addr, ptr, campo) = registro(rom, id);
    if ptr != MAP_TABLE {
        return compor_outro(sessao_id, &rom_sha, rom, id, ptr, campo, frame, cancel);
    }
    if frame >= MAP_FRAMES {
        return Err(err(
            "ss_frame_invalido",
            format!(
                "frame {frame} inexistente; há {MAP_FRAMES} (0..={})",
                MAP_FRAMES - 1
            ),
        ));
    }
    if campo & 0x7FF != ART_TILE_BASE {
        return Err(err(
            "ss_base_de_tile",
            format!("campo {campo:#06x} não aponta para a base de tile {ART_TILE_BASE:#x} da arte decodificada"),
        ));
    }
    let linha = ((campo >> 13) & 3) as u8;
    let ch = cadeia(rom, cancel)?;
    let pecas = gfx::parse_frame(rom, MAP_TABLE, MAP_FRAMES, frame)
        .map_err(|g| err("ss_mapping", g.code()))?;
    let img = gfx::compose(&pecas, &ch.art, 0, Some(linha), false, false)
        .map_err(|g| err("ss_composicao", g.code()))?;
    let rgba = gfx::to_rgba(&img, &ch.pal);
    let map_sha = tabela_confere(rom)?;
    let vinc = vinculo_de_arte(rom, usize::from(ART_TILE_BASE), cancel)?.map(|(a, _)| a);
    if vinc.as_ref().map(|a| (a.cue_indice, a.posicao_na_arte)) != Some((2, 0)) {
        return Err(err(
            "ss_plc",
            "o cue das paredes não ocupa a base de tile 0x142",
        ));
    }
    let integro = ch.art_sha == ART_SHA256 && ch.pal_sha == PAL_SHA256 && map_sha == MAP_SHA256;
    let cad = vec![
        Elo {
            ordem: 1,
            de: format!("ID {id:#04x}"),
            para: format!("registro SS_MapIndex {addr:#x}"),
            origem: format!("{:#x} + (ID-1)*6", cons::MAPINDEX_ADDR),
            nivel: "vínculo estrutural estático".into(),
        },
        Elo {
            ordem: 2,
            de: format!("registro ({campo:#06x})"),
            para: format!("mapping Map_SSWalls {MAP_TABLE:#x}"),
            origem: "ponteiro de 24 bits do registro".into(),
            nivel: "vínculo estrutural estático".into(),
        },
        Elo {
            ordem: 3,
            de: format!("mapping, frame {frame}"),
            para: format!("{} peça(s)", pecas.len()),
            origem: format!("tabela de 16 ponteiros relativos em {MAP_TABLE:#x} ({MAP_BYTES} B)"),
            nivel: "decodificado agora da ROM; confere pin".to_string(),
        },
        Elo {
            ordem: 4,
            de: "peças".into(),
            para: format!(
                "arte Nemesis {ART_OFFSET:#x} ({} tiles)",
                ch.art_stats.tiles
            ),
            origem: format!(
                "base de tile {ART_TILE_BASE:#x} = VRAM $2840 (PLC_SpecialStage, 0x1D992)"
            ),
            nivel: "decodificado agora; vínculo da base é estrutural estático".into(),
        },
        Elo {
            ordem: 5,
            de: format!("linha de paleta {linha} (do registro)"),
            para: PAL_ROTULO.into(),
            origem: format!(
                "PalLoad #{PALLOAD_ID} em {:#x} → {PAL_PTR:#x}",
                PALLOAD_TABLE + PALLOAD_ID * 8
            ),
            nivel: "candidata estática; estado do jogo NÃO provado".into(),
        },
    ];
    Ok(SsWallsComposicao {
        formato: FORMATO_COMPOSICAO.to_string(),
        sessao_id: sessao_id.to_string(),
        rom_sha256: rom_sha,
        id,
        id_hex: format!("{id:#04x}"),
        status: "composta".to_string(),
        explicacao: format!("Frame {frame} do mapping das paredes, composto da arte decodificada agora; cores = paleta estática rotulada."),
        frame: Some(frame),
        linha_paleta: Some(linha),
        largura: img.w,
        altura: img.h,
        x0: img.x0,
        y0: img.y0,
        pixels_hex: img.pixels.iter().map(|b| format!("{b:02x}")).collect(),
        rgba_hex: rgba.iter().map(|b| format!("{b:02x}")).collect(),
        paleta_rotulo: PAL_ROTULO.to_string(),
        tiles_usados: img.tiles_usados,
        tiles_vazios: img.tiles_vazios,
        cadeia: cad,
        integridade: if integro { "confere com as referências pinadas".into() } else { "DIVERGE das referências pinadas (ROM editada?)".into() },
        aviso_frame: "O frame de rotação é estado de execução, escolhido por você; o jogo não foi observado.".to_string(),
        arte_explicacao: explica_arte(&vinc, usize::from(ART_TILE_BASE)),
        arte_vinculada: vinc,
        frames_total: MAP_FRAMES,
        frames_confirmados: (0..MAP_FRAMES).collect(),
        nivel_confirmacao: NIVEL_PAREDES.to_string(),
        pecas: pecas.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pins_coerentes_e_rotulo_de_paleta_estatica() {
        assert_eq!(ART_TILES * 32, 7968);
        assert!(PAL_ROTULO.contains("candidata estática"));
        assert_eq!(MAP_BYTES, MAP_FRAMES * 8);
    }

    #[test]
    fn desconhecidos_nao_atribuem_paleta_nem_execucao() {
        let d = desconhecidos().join(" ");
        assert!(d.contains("candidata estática"));
        assert!(d.contains("não foi observado"));
    }

    #[test]
    fn rom_curta_e_recusada_sem_panic() {
        let rom = vec![0u8; 100];
        let r = decodificar_arte(&rom, &|| false);
        assert!(r.unwrap_err().starts_with("ss_fora_da_rom"));
        assert!(cadeia(&rom, &|| false).is_err());
    }

    #[test]
    fn cancelamento_e_codigo_estruturado() {
        let rom = vec![0u8; 0x30000];
        assert!(cadeia(&rom, &|| true).unwrap_err().starts_with("cancelled"));
    }

    #[test]
    #[ignore = "BYOR: exige REX_SONIC_ROM apontando para a ROM pinada c7da53a1…; ausente = não executado"]
    fn byor_composicao_real_16_frames_e_36_ids() {
        let path = std::env::var("REX_SONIC_ROM").expect("REX_SONIC_ROM");
        let rom = std::fs::read(path).unwrap();
        assert_eq!(sha256_hex(&rom), cons::ROM_PIN_SHA256);
        let sha = sha256_hex(&rom);
        let inf = info(&rom, &rom, "t", Some(&sha), &|| false).unwrap();
        assert!(inf.arte.confere_pin && inf.mapping_confere_pin && inf.paleta.confere_pin);
        assert_eq!(inf.arte.tiles, 249);
        assert_eq!(inf.arte.tiles_vazios, vec![121, 124, 133, 136]);
        assert_eq!(inf.ids_cobertos.len(), 36);
        for id in 1..=36u8 {
            for f in 0..16 {
                let c = compor(&rom, &rom, "t", &sha, id, f, &|| false).unwrap();
                assert_eq!(c.status, "composta");
                assert_eq!(c.linha_paleta, Some((id - 1) / 9));
                assert!(c.pixels_hex.len() == c.largura * c.altura * 2);
            }
        }
        // Despejo opcional para a comparação independente (C4), feito por script externo.
        if let Ok(dump) = std::env::var("REX_SS_DUMP") {
            let mut linhas = Vec::new();
            for f in 0..16 {
                let c = compor(&rom, &rom, "t", &sha, 1, f, &|| false).unwrap();
                linhas.push(format!(
                    "{f} {} {} {} {} {}",
                    c.largura, c.altura, c.x0, c.y0, c.pixels_hex
                ));
            }
            std::fs::write(dump, linhas.join("\n")).unwrap();
        }
        // IDs 37..78: imagem SÓ para frames confirmados; o resto, estrutura/recusa sem pixels.
        let mut linhas2 = Vec::new();
        let mut sem_cue = Vec::new();
        let mut com_imagem = 0usize;
        for id in 37..=78u8 {
            let c0 = compor(&rom, &rom, "t", &sha, id, 0, &|| false).unwrap();
            match &c0.arte_vinculada {
                Some(a) => assert_eq!(a.posicao_na_arte, 0, "id {id}"),
                None => sem_cue.push(id),
            }
            let (_, ptr, campo) = registro(&rom, id);
            for f in 0..c0.frames_total {
                let c = compor(&rom, &rom, "t", &sha, id, f, &|| false).unwrap();
                let conf = CONFIRMADOS.contains(&(ptr, campo, f));
                assert_eq!(
                    c.status == "composta",
                    conf,
                    "id {id} frame {f} status {}",
                    c.status
                );
                assert_eq!(!c.pixels_hex.is_empty(), conf, "id {id} frame {f}");
                if conf {
                    com_imagem += 1;
                    linhas2.push(format!(
                        "{ptr} {campo} {f} {} {} {}",
                        c.largura, c.altura, c.pixels_hex
                    ));
                } else {
                    assert!(c.rgba_hex.is_empty() && c.nivel_confirmacao.is_empty());
                }
            }
        }
        assert_eq!(
            sem_cue,
            vec![58, 66, 67, 68, 69],
            "IDs cuja base de tile (0x7b2) não está no PLC"
        );
        // 13 pares confirmados; IDs que compartilham (ptr,campo) repetem o par
        assert!(com_imagem >= CONFIRMADOS.len());
        if let Ok(dump) = std::env::var("REX_SS_DUMP2") {
            linhas2.sort();
            linhas2.dedup();
            std::fs::write(dump, linhas2.join("\n")).unwrap();
        }
        let o = compor(&rom, &rom, "t", &sha, 38, 0, &|| false).unwrap();
        assert_ne!(o.status, "composta");
        assert!(o.pixels_hex.is_empty());
        // frame inexistente e ROM trocada
        assert!(compor(&rom, &rom, "t", &sha, 1, 16, &|| false).is_err());
        assert!(compor(&rom, &rom, "t", &"0".repeat(64), 1, 0, &|| false).is_err());
    }
}
