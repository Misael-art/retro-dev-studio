//! Grafo de recursos SGDK recuperado por FORMA de estrutura (motor, sem nome de jogo).
//!
//! O rescomp grava estruturas fixas por tipo de recurso. Elas sobrevivem a qualquer
//! versão do compilador (são dados, não código), então servem a ROMs da família SGDK
//! mesmo quando o dicionário de código (`rex_libsig`) não cobre a versão do SDK.
//!
//! Cada aresta é validada; nenhum candidato vira recurso por aparência:
//! * `TileSet {u16 compression; u16 numTile; u32 tiles*}` — o stream decodifica para
//!   exatamente `numTile*32` bytes com o codec DECLARADO (reuso de `rex_resources`);
//! * `Palette {u16 length; u32 data*}` — `length` em 16/32/48/64 e toda palavra de cor
//!   é 9-bit válida (`& 0xF111 == 0`);
//! * `TileMap {u16 compression; u16 w; u16 h; u32 tilemap*}` — decodifica para `w*h*2`
//!   e todo índice de tile (`& 0x7FF`) é `< numTile` do TileSet irmão;
//! * `Image {Palette*; TileSet*; TileMap*}` — só existe se as TRÊS arestas fecham.
//!
//! Evidência: L2 (consistência interna). Não prova que o jogo usa o recurso em tela.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use super::rex_aplib::AplibLimits;
use super::rex_codecs::Lz4wLimits;
use super::rex_resources::md_color_word_to_rgb;
use super::rex_resources::{
    scan_tileset_headers, verify_aplib_resource, verify_lz4w_resource, HeaderCompression,
    TilesetCandidate,
};
use crate::tools::asset_extractor::encode_indexed_png;

const MAX_MAP_DIM: usize = 1024;

fn be16(rom: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*rom.get(at)?, *rom.get(at + 1)?]))
}

fn be32(rom: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes([
        *rom.get(at)?,
        *rom.get(at + 1)?,
        *rom.get(at + 2)?,
        *rom.get(at + 3)?,
    ]))
}

fn rom_ptr(rom: &[u8], at: usize) -> Option<usize> {
    let p = be32(rom, at)? as usize;
    (p != 0 && p < rom.len() && p.is_multiple_of(2)).then_some(p)
}

/// Decodifica `expected_len` bytes de `ptr` com o codec declarado; só aceita tamanho exato.
/// Devolve também os bytes do stream consumidos na ROM.
pub fn decode_declared(
    rom: &[u8],
    compression: HeaderCompression,
    ptr: usize,
    expected_len: usize,
) -> Option<(Vec<u8>, usize)> {
    match compression {
        HeaderCompression::None => rom
            .get(ptr..ptr.checked_add(expected_len)?)
            .map(|b| (b.to_vec(), expected_len)),
        codec => {
            let cand = TilesetCandidate {
                header_offset: 0,
                compression: codec,
                num_tiles: expected_len / 32,
                stream_offset: ptr,
                expected_len,
            };
            match codec {
                HeaderCompression::Lz4w => verify_lz4w_resource(rom, &cand, &Lz4wLimits::default())
                    .ok()
                    .map(|r| (r.decoded, r.bytes_consumed)),
                _ => verify_aplib_resource(rom, &cand, &AplibLimits::default())
                    .ok()
                    .map(|r| (r.decoded, r.bytes_consumed)),
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredPalette {
    pub header_offset: u32,
    pub data_offset: u32,
    pub colors: Vec<u16>,
    /// Layout do cabeçalho: `len_ptr` (`{u16 length; u16* data}`, SGDK atual) ou
    /// `index_len_ptr` (`{u16 index; u16 length; u16* data}`, rescomp antigo).
    #[serde(default = "default_palette_layout")]
    pub layout: String,
}

fn default_palette_layout() -> String {
    "len_ptr".into()
}

impl RecoveredPalette {
    /// Bytes do cabeçalho na ROM.
    pub fn header_bytes(&self) -> usize {
        if self.layout == "index_len_ptr" {
            8
        } else {
            6
        }
    }
}

/// Layouts de Palette conhecidos, em ordem de tentativa: (nome, offset do length,
/// offset do ponteiro de dados). Um cabeçalho só vale num layout se a forma inteira fecha.
const PALETTE_LAYOUTS: [(&str, usize, usize); 2] = [("len_ptr", 0, 2), ("index_len_ptr", 2, 4)];

pub fn parse_palette(rom: &[u8], at: usize) -> Option<RecoveredPalette> {
    PALETTE_LAYOUTS
        .iter()
        .find_map(|(name, len_at, ptr_at)| parse_palette_layout(rom, at, name, *len_at, *ptr_at))
}

fn parse_palette_layout(
    rom: &[u8],
    at: usize,
    layout: &str,
    len_at: usize,
    ptr_at: usize,
) -> Option<RecoveredPalette> {
    // `index` (layout antigo) é a primeira entrada de CRAM: 0..63.
    if len_at > 0 && be16(rom, at)? >= 64 {
        return None;
    }
    let len = be16(rom, at + len_at)? as usize;
    if !matches!(len, 16 | 32 | 48 | 64) {
        return None;
    }
    let data = rom_ptr(rom, at + ptr_at)?;
    let colors: Vec<u16> = (0..len)
        .map(|i| be16(rom, data + i * 2))
        .collect::<Option<_>>()?;
    if colors.iter().any(|c| c & 0xF111 != 0) || colors.iter().all(|c| *c == colors[0]) {
        return None;
    }
    Some(RecoveredPalette {
        header_offset: at as u32,
        data_offset: data as u32,
        colors,
        layout: layout.to_string(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredTileset {
    pub header_offset: u32,
    pub compression: String,
    pub num_tiles: u32,
    pub stream_offset: u32,
    pub stream_bytes: u32,
    #[serde(skip)]
    pub tiles: Vec<u8>,
}

pub fn parse_tileset(rom: &[u8], at: usize) -> Option<RecoveredTileset> {
    let comp = HeaderCompression::from_field(be16(rom, at)?)?;
    let num = be16(rom, at + 2)? as usize;
    let ptr = rom_ptr(rom, at + 4)?;
    if num == 0 || num > 2048 {
        return None;
    }
    let (tiles, stream_bytes) = decode_declared(rom, comp, ptr, num * 32)?;
    Some(RecoveredTileset {
        header_offset: at as u32,
        compression: comp.as_str().to_string(),
        num_tiles: num as u32,
        stream_offset: ptr as u32,
        stream_bytes: stream_bytes as u32,
        tiles,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredTilemap {
    pub header_offset: u32,
    pub compression: String,
    pub width: u16,
    pub height: u16,
    pub stream_offset: u32,
    pub stream_bytes: u32,
    #[serde(skip)]
    pub cells: Vec<u16>,
}

pub fn parse_tilemap(rom: &[u8], at: usize, num_tiles: u32) -> Option<RecoveredTilemap> {
    let comp = HeaderCompression::from_field(be16(rom, at)?)?;
    let w = be16(rom, at + 2)? as usize;
    let h = be16(rom, at + 4)? as usize;
    let ptr = rom_ptr(rom, at + 6)?;
    if w == 0 || h == 0 || w > MAX_MAP_DIM || h > MAX_MAP_DIM {
        return None;
    }
    let (raw, stream_bytes) = decode_declared(rom, comp, ptr, w * h * 2)?;
    let cells: Vec<u16> = raw
        .chunks_exact(2)
        .map(|c| u16::from_be_bytes([c[0], c[1]]))
        .collect();
    if cells.iter().any(|c| u32::from(c & 0x7FF) >= num_tiles) {
        return None;
    }
    Some(RecoveredTilemap {
        header_offset: at as u32,
        compression: comp.as_str().to_string(),
        width: w as u16,
        height: h as u16,
        stream_offset: ptr as u32,
        stream_bytes: stream_bytes as u32,
        cells,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredImage {
    pub header_offset: u32,
    pub palette: RecoveredPalette,
    pub tileset: RecoveredTileset,
    pub tilemap: RecoveredTilemap,
}

impl RecoveredImage {
    /// Pixels indexados 8-bit (`linha_de_paleta*16 + cor`) — formato que o rescomp lê.
    pub fn indexed_pixels(&self) -> (u32, u32, Vec<u8>) {
        let (w, h) = (self.tilemap.width as usize, self.tilemap.height as usize);
        let (pw, ph) = (w * 8, h * 8);
        let mut px = vec![0u8; pw * ph];
        for ty in 0..h {
            for tx in 0..w {
                let cell = self.tilemap.cells[ty * w + tx];
                let tile = (cell & 0x7FF) as usize;
                let pal = ((cell >> 13) & 3) as u8;
                let (hf, vf) = (cell & 0x0800 != 0, cell & 0x1000 != 0);
                for row in 0..8 {
                    for col in 0..8 {
                        let sr = if vf { 7 - row } else { row };
                        let sc = if hf { 7 - col } else { col };
                        let byte = self.tileset.tiles[tile * 32 + sr * 4 + sc / 2];
                        let idx = if sc % 2 == 0 { byte >> 4 } else { byte & 0x0F };
                        px[(ty * 8 + row) * pw + tx * 8 + col] = pal * 16 + idx;
                    }
                }
            }
        }
        (pw as u32, ph as u32, px)
    }
}

/// Image = três ponteiros cujas três estruturas validam e se cruzam (TileMap < numTile).
pub fn parse_image(rom: &[u8], at: usize) -> Option<RecoveredImage> {
    let pal_at = rom_ptr(rom, at)?;
    let ts_at = rom_ptr(rom, at + 4)?;
    let map_at = rom_ptr(rom, at + 8)?;
    let palette = parse_palette(rom, pal_at)?;
    let tileset = parse_tileset(rom, ts_at)?;
    let tilemap = parse_tilemap(rom, map_at, tileset.num_tiles)?;
    Some(RecoveredImage {
        header_offset: at as u32,
        palette,
        tileset,
        tilemap,
    })
}

/// PNG indexado (rescomp-compatível) de uma Image recuperada.
pub fn image_png(img: &RecoveredImage) -> Vec<u8> {
    let (w, h, px) = img.indexed_pixels();
    let pal: Vec<[u8; 3]> = img
        .palette
        .colors
        .iter()
        .map(|c| md_color_word_to_rgb(*c))
        .collect();
    encode_indexed_png(&px, w, h, &pal)
}

/// Música XGM compilada (XGC, saída do `xgmtool` embutida pelo rescomp; little-endian):
/// tabela de 63 amostras `{u16 addr/256, u16 len/256}`, `u16 SLEN/256`, versão, flags,
/// amostras, `u32 MLEN` e quadros. Cada quadro XGC começa com um byte de TAMANHO (que
/// se inclui); a música só é aceita se os tamanhos encadearem EXATAMENTE até `MLEN`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredXgm {
    pub offset: u32,
    /// Bytes do recurso (tabela..fim da música, sem tags GD3 opcionais).
    pub len: u32,
    pub samples: u32,
    pub sample_bytes: u32,
    pub music_bytes: u32,
    pub frames: u32,
    pub pal: bool,
}

/// Mínimo de quadros para não aceitar encadeamentos curtos por acaso.
const MIN_XGC_FRAMES: u32 = 16;

fn le16(rom: &[u8], at: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*rom.get(at)?, *rom.get(at + 1)?]) as usize)
}

/// Encadeia os quadros XGC; devolve o número de quadros se fechar exatamente.
pub fn parse_xgc_frames(music: &[u8]) -> Option<u32> {
    let mut pc = 0usize;
    let mut frames = 0u32;
    while pc < music.len() {
        let size = music[pc] as usize;
        if size == 0 {
            return None;
        }
        pc += size;
        frames += 1;
    }
    (pc == music.len()).then_some(frames)
}

pub fn parse_xgm(rom: &[u8], at: usize) -> Option<RecoveredXgm> {
    let slen = le16(rom, at + 252)? * 256;
    let mut samples = 0u32;
    for e in 0..63 {
        let a = le16(rom, at + e * 4)? * 256;
        let n = le16(rom, at + e * 4 + 2)? * 256;
        if a == 0xFFFF * 256 && n == 256 {
            continue;
        }
        if n == 0 || a + n > slen {
            return None;
        }
        samples += 1;
    }
    let version = *rom.get(at + 254)?;
    let info = *rom.get(at + 255)?;
    if version > 1 || info & 0xF8 != 0 {
        return None;
    }
    let m = at + 256 + slen;
    let mlen = u32::from_le_bytes(rom.get(m..m + 4)?.try_into().ok()?) as usize;
    if mlen < 2 {
        return None;
    }
    let music = rom.get(m + 4..m + 4 + mlen)?;
    let frames = parse_xgc_frames(music)?;
    if frames < MIN_XGC_FRAMES {
        return None;
    }
    Some(RecoveredXgm {
        offset: at as u32,
        len: (256 + slen + 4 + mlen) as u32,
        samples,
        sample_bytes: slen as u32,
        music_bytes: mlen as u32,
        frames,
        pal: info & 1 != 0,
    })
}

/// Varre inícios pares. O rescomp atual alinha XGM em 256 bytes, mas versões antigas
/// empacotam faixas logo após a anterior (e após o tag GD3); a validação é a cadeia
/// exata de quadros, não o alinhamento.
pub fn recover_xgm(rom: &[u8]) -> Vec<RecoveredXgm> {
    recover_xgm_aligned(rom, 2)
}

fn recover_xgm_aligned(rom: &[u8], align: usize) -> Vec<RecoveredXgm> {
    let mut out: Vec<RecoveredXgm> = Vec::new();
    let mut at = 0usize;
    while at + 260 <= rom.len() {
        if let Some(x) = parse_xgm(rom, at) {
            at += (x.len as usize).div_ceil(align) * align;
            out.push(x);
            continue;
        }
        at += align;
    }
    out
}

/// Layout declarado de SpriteDefinition/Animation/AnimationFrame. O formato muda entre
/// gerações do SGDK; cada layout é aceito só quando a cadeia inteira valida.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum SpriteLayout {
    /// SGDK 1.x: `{Palette*; u16 nAnim; Animation**; u16 maxTile; u16 maxSpr}`,
    /// `Animation {u16 nFrame; Frame**; u16 len; u8* seq; s16 loop}`,
    /// `Frame {u8 nSpr; u8 w; u8 h; u8 timer; 4x{parts*; collision*}; TileSet*}`.
    Sgdk1x,
    /// SGDK 1.x antigo: Definition/Animation como `Sgdk1x`, mas
    /// `Frame {u16 nSpr; Part** parts; Collision*; TileSet*; s16 w; s16 h; u16 timer}` e
    /// `Part {s16 y; u16 size; s16 x; u16 numTile}` em palavras.
    Sgdk1xWide,
    /// SGDK 2.x: `{u16 w; u16 h; Palette*; u16 nAnim; Animation**; u16 maxTile; u16 maxSpr}`,
    /// `Animation {u8 nFrame; u8 loop; Frame**}`, `Frame {u8 nSpr; u8 timer; TileSet*; ...}`.
    Sgdk2x,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredFrame {
    pub offset: u32,
    pub num_sprite: u8,
    pub timer: u8,
    /// Largura/altura em pixels quando o layout as guarda por quadro (1.x).
    pub size_px: Option<(u16, u16)>,
    pub tileset: RecoveredTileset,
    /// Peças de hardware (variante sem flip), na ordem em que consomem o TileSet.
    pub parts: Vec<SpritePart>,
}

/// Uma peça VDP de um quadro: deslocamento em pixels e tamanho em tiles.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpritePart {
    pub x: i16,
    pub y: i16,
    pub w_tiles: u8,
    pub h_tiles: u8,
}

/// Lê uma peça e confere `numTile == largura*altura` do código de tamanho VDP.
fn part_from(size: u8, x: i16, y: i16, num_tile: u8) -> Option<SpritePart> {
    let (w, h) = (((size >> 2) & 3) + 1, (size & 3) + 1);
    (size & 0xF0 == 0 && num_tile == w * h).then_some(SpritePart {
        x,
        y,
        w_tiles: w,
        h_tiles: h,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredAnimation {
    pub offset: u32,
    pub frames: Vec<RecoveredFrame>,
    /// Sequência de índices de quadro (1.x); vazia quando o layout não a tem.
    pub sequence: Vec<u8>,
    pub loop_index: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecoveredSprite {
    pub header_offset: u32,
    pub layout: SpriteLayout,
    pub palette: RecoveredPalette,
    pub animations: Vec<RecoveredAnimation>,
    pub max_num_tile: u16,
    pub max_num_sprite: u16,
    pub size_px: Option<(u16, u16)>,
}

const MAX_ANIMS: usize = 64;
const MAX_FRAMES: usize = 256;

fn ptr_array(rom: &[u8], at: usize, n: usize) -> Option<Vec<usize>> {
    (0..n).map(|i| rom_ptr(rom, at + i * 4)).collect()
}

fn parse_frame(
    rom: &[u8],
    at: usize,
    layout: SpriteLayout,
    max_tile: u16,
) -> Option<RecoveredFrame> {
    let (num_sprite, timer, size_px, ts_at) = match layout {
        SpriteLayout::Sgdk1x => (
            *rom.get(at)?,
            *rom.get(at + 3)?,
            Some((u16::from(*rom.get(at + 1)?), u16::from(*rom.get(at + 2)?))),
            rom_ptr(rom, at + 36)?,
        ),
        SpriteLayout::Sgdk1xWide => {
            let n = be16(rom, at)?;
            let (w, h, timer) = (
                be16(rom, at + 14)?,
                be16(rom, at + 16)?,
                be16(rom, at + 18)?,
            );
            if n > 0xFF || timer > 0xFF || w == 0 || h == 0 || w > 512 || h > 512 {
                return None;
            }
            (n as u8, timer as u8, Some((w, h)), rom_ptr(rom, at + 10)?)
        }
        // 2.x: bit 7 de numSprite é flag do rescomp; a contagem está nos 7 bits baixos.
        SpriteLayout::Sgdk2x => (
            *rom.get(at)? & 0x7F,
            *rom.get(at + 1)?,
            None,
            rom_ptr(rom, at + 2)?,
        ),
    };
    if num_sprite == 0 || num_sprite > 80 {
        return None;
    }
    let tileset = parse_tileset(rom, ts_at)?;
    if tileset.num_tiles > u32::from(max_tile) {
        return None;
    }
    let n = num_sprite as usize;
    let parts = match layout {
        // 1.x: lista de ponteiros para `{u8 numTile; s8 y; u8 size; s8 x}` (variante 0).
        SpriteLayout::Sgdk1x => ptr_array(rom, rom_ptr(rom, at + 4)?, n)?
            .into_iter()
            .map(|p| {
                let b = rom.get(p..p + 4)?;
                part_from(b[2], i16::from(b[3] as i8), i16::from(b[1] as i8), b[0])
            })
            .collect::<Option<Vec<_>>>()?,
        SpriteLayout::Sgdk1xWide => ptr_array(rom, rom_ptr(rom, at + 2)?, n)?
            .into_iter()
            .map(|p| {
                let (y, size) = (be16(rom, p)? as i16, be16(rom, p + 2)?);
                let (x, num) = (be16(rom, p + 4)? as i16, be16(rom, p + 6)?);
                if size > 0xFF || num > 0xFF {
                    return None;
                }
                part_from(size as u8, x, y, num as u8)
            })
            .collect::<Option<Vec<_>>>()?,
        // 2.x: `FrameVDPSprite {offY; offYFlip; size; offX; offXFlip; numTile}` em linha.
        SpriteLayout::Sgdk2x => (0..n)
            .map(|i| {
                let b = rom.get(at + 10 + i * 6..at + 16 + i * 6)?;
                part_from(b[2], i16::from(b[3]), i16::from(b[0]), b[5])
            })
            .collect::<Option<Vec<_>>>()?,
    };
    let used: u32 = parts
        .iter()
        .map(|p| u32::from(p.w_tiles) * u32::from(p.h_tiles))
        .sum();
    if used != tileset.num_tiles {
        return None;
    }
    Some(RecoveredFrame {
        offset: at as u32,
        num_sprite,
        timer,
        size_px,
        tileset,
        parts,
    })
}

impl RecoveredFrame {
    /// Compõe o quadro (índices 0..15) num canvas `w x h`; tiles de cada peça em ordem
    /// de coluna (ordem do VDP). Pixels fora do canvas são recortados.
    pub fn compose(&self, w: usize, h: usize) -> Vec<u8> {
        self.compose_at(w, h, 0, 0)
    }

    /// Como `compose`, com a origem do quadro deslocada para `(-ox, -oy)` no canvas
    /// (peças com deslocamento negativo continuam visíveis).
    pub fn compose_at(&self, w: usize, h: usize, ox: i32, oy: i32) -> Vec<u8> {
        let mut px = vec![0u8; w * h];
        let mut tile = 0usize;
        for part in &self.parts {
            for tx in 0..part.w_tiles as usize {
                for ty in 0..part.h_tiles as usize {
                    for row in 0..8 {
                        for col in 0..8 {
                            let b = self.tileset.tiles[tile * 32 + row * 4 + col / 2];
                            let idx = if col % 2 == 0 { b >> 4 } else { b & 0x0F };
                            let x = part.x as i32 - ox + (tx * 8 + col) as i32;
                            let y = part.y as i32 - oy + (ty * 8 + row) as i32;
                            if idx != 0 && x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h
                            {
                                px[y as usize * w + x as usize] = idx;
                            }
                        }
                    }
                    tile += 1;
                }
            }
        }
        px
    }
}

fn parse_animation(
    rom: &[u8],
    at: usize,
    layout: SpriteLayout,
    max_tile: u16,
) -> Option<RecoveredAnimation> {
    let (n, frames_at, sequence, loop_index) = match layout {
        SpriteLayout::Sgdk1x | SpriteLayout::Sgdk1xWide => {
            let n = be16(rom, at)? as usize;
            let len = be16(rom, at + 6)? as usize;
            let seq_at = rom_ptr(rom, at + 8)?;
            let seq = rom.get(seq_at..seq_at + len)?.to_vec();
            (n, rom_ptr(rom, at + 2)?, seq, be16(rom, at + 12)? as i16)
        }
        SpriteLayout::Sgdk2x => (
            *rom.get(at)? as usize,
            rom_ptr(rom, at + 2)?,
            Vec::new(),
            i16::from(*rom.get(at + 1)?),
        ),
    };
    if n == 0 || n > MAX_FRAMES || sequence.iter().any(|i| *i as usize >= n) {
        return None;
    }
    let frames = ptr_array(rom, frames_at, n)?
        .into_iter()
        .map(|f| parse_frame(rom, f, layout, max_tile))
        .collect::<Option<Vec<_>>>()?;
    Some(RecoveredAnimation {
        offset: at as u32,
        frames,
        sequence,
        loop_index,
    })
}

pub fn parse_sprite(rom: &[u8], at: usize, layout: SpriteLayout) -> Option<RecoveredSprite> {
    let (pal_at, n_at, anims_at, max_at, size_px) = match layout {
        SpriteLayout::Sgdk1x | SpriteLayout::Sgdk1xWide => (at, at + 4, at + 6, at + 10, None),
        SpriteLayout::Sgdk2x => (
            at + 4,
            at + 8,
            at + 10,
            at + 14,
            Some((be16(rom, at)?, be16(rom, at + 2)?)),
        ),
    };
    let palette = parse_palette(rom, rom_ptr(rom, pal_at)?)?;
    let n = be16(rom, n_at)? as usize;
    let max_num_tile = be16(rom, max_at)?;
    let max_num_sprite = be16(rom, max_at + 2)?;
    if n == 0 || n > MAX_ANIMS || max_num_tile == 0 || max_num_sprite == 0 || max_num_sprite > 80 {
        return None;
    }
    let animations = ptr_array(rom, rom_ptr(rom, anims_at)?, n)?
        .into_iter()
        .map(|a| parse_animation(rom, a, layout, max_num_tile))
        .collect::<Option<Vec<_>>>()?;
    Some(RecoveredSprite {
        header_offset: at as u32,
        layout,
        palette,
        animations,
        max_num_tile,
        max_num_sprite,
        size_px,
    })
}

/// Sprites: varredura de todo offset par (recursos ligados mas nunca referenciados por
/// código não são alvo de ponteiro). Cada layout declarado é tentado e só a cadeia
/// inteira (paleta → animações → quadros → TileSets decodificados) conta.
fn recover_sprites(rom: &[u8]) -> Vec<RecoveredSprite> {
    let mut out = Vec::new();
    let mut at = 0usize;
    while at + 18 <= rom.len() {
        for layout in [
            SpriteLayout::Sgdk1x,
            SpriteLayout::Sgdk1xWide,
            SpriteLayout::Sgdk2x,
        ] {
            if let Some(sp) = parse_sprite(rom, at, layout) {
                out.push(sp);
                break;
            }
        }
        at += 2;
    }
    out
}

impl RecoveredSprite {
    /// Tamanho da célula em pixels: o da definição (2.x) ou o maior quadro (1.x).
    pub fn cell_size(&self) -> (usize, usize) {
        if let Some((w, h)) = self.size_px {
            return (w as usize, h as usize);
        }
        self.animations
            .iter()
            .flat_map(|a| &a.frames)
            .filter_map(|f| f.size_px)
            .fold((8, 8), |(w, h), (fw, fh)| {
                (w.max(fw as usize), h.max(fh as usize))
            })
    }

    /// Célula da folha: união do tamanho declarado com o retângulo de TODAS as peças.
    /// Devolve `(largura, altura, origem_x, origem_y)`; origem <= 0 quando alguma peça
    /// tem deslocamento negativo.
    pub fn sheet_cell(&self) -> (usize, usize, i32, i32) {
        let (dw, dh) = self.cell_size();
        let (mut x0, mut y0, mut x1, mut y1) = (0i32, 0i32, dw as i32, dh as i32);
        for p in self
            .animations
            .iter()
            .flat_map(|a| &a.frames)
            .flat_map(|f| &f.parts)
        {
            x0 = x0.min(i32::from(p.x));
            y0 = y0.min(i32::from(p.y));
            x1 = x1.max(i32::from(p.x) + 8 * i32::from(p.w_tiles));
            y1 = y1.max(i32::from(p.y) + 8 * i32::from(p.h_tiles));
        }
        // múltiplo de 8: o rescomp fatia a folha em tiles
        (
            ((x1 - x0) as usize).div_ceil(8) * 8,
            ((y1 - y0) as usize).div_ceil(8) * 8,
            x0,
            y0,
        )
    }

    /// Folha editável: uma linha por animação, um quadro por coluna, células de
    /// `sheet_cell` (o quadro declarado fica em `(-origem)`); índices 0..15, paleta 0.
    pub fn sheet_png(&self) -> (u32, u32, Vec<u8>) {
        let (cw, ch, ox, oy) = self.sheet_cell();
        let cols = self
            .animations
            .iter()
            .map(|a| a.frames.len())
            .max()
            .unwrap_or(1);
        let rows = self.animations.len().max(1);
        let (w, h) = (cw * cols, ch * rows);
        let mut px = vec![0u8; w * h];
        for (r, anim) in self.animations.iter().enumerate() {
            for (c, frame) in anim.frames.iter().enumerate() {
                let cell = frame.compose_at(cw, ch, ox, oy);
                for y in 0..ch {
                    let dst = (r * ch + y) * w + c * cw;
                    px[dst..dst + cw].copy_from_slice(&cell[y * cw..(y + 1) * cw]);
                }
            }
        }
        let pal: Vec<[u8; 3]> = self
            .palette
            .colors
            .iter()
            .take(16)
            .map(|c| md_color_word_to_rgb(*c))
            .collect();
        (
            w as u32,
            h as u32,
            encode_indexed_png(&px, w as u32, h as u32, &pal),
        )
    }
}

/// Inventário estrutural da ROM.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SgdkResourceGraph {
    pub images: Vec<RecoveredImage>,
    /// TileSets verificados que nenhuma Image referencia (sprites, fontes, tiles soltos).
    pub loose_tilesets: Vec<RecoveredTileset>,
    /// Paletas válidas apontadas por ponteiros da ROM mas não por uma Image.
    pub loose_palettes: Vec<RecoveredPalette>,
    pub tileset_candidates: usize,
    pub music: Vec<RecoveredXgm>,
    pub sprites: Vec<RecoveredSprite>,
}

pub fn recover_graph(rom: &[u8]) -> SgdkResourceGraph {
    let candidates = scan_tileset_headers(rom);
    let mut tilesets: BTreeMap<u32, RecoveredTileset> = BTreeMap::new();
    for c in &candidates {
        if let Some(ts) = parse_tileset(rom, c.header_offset) {
            tilesets.insert(ts.header_offset, ts);
        }
    }
    // Images: só testa offsets cujo 2º ponteiro aponta para um TileSet verificado.
    let mut images = Vec::new();
    let mut used = std::collections::HashSet::new();
    let mut used_pal = std::collections::HashSet::new();
    let mut at = 0usize;
    while at + 12 <= rom.len() {
        if be32(rom, at + 4).is_some_and(|p| tilesets.contains_key(&p)) {
            if let Some(img) = parse_image(rom, at) {
                used.insert(img.tileset.header_offset);
                used_pal.insert(img.palette.header_offset);
                images.push(img);
            }
        }
        at += 2;
    }
    // Alvos de ponteiros alinhados da ROM: recurso solto só conta se algo aponta para ele.
    let mut targets = std::collections::BTreeSet::new();
    let mut at = 0usize;
    while at + 4 <= rom.len() {
        if let Some(p) = rom_ptr(rom, at) {
            targets.insert(p as u32);
        }
        at += 2;
    }
    // Código compilado pode endereçar o campo `data` direto (`move.l pal+ptr_at,...`):
    // ponteiro para o campo também é evidência de uso, desde que o cabeçalho feche.
    // Os layouts se sobrepõem (o antigo contém um `len_ptr` válido 2 bytes adiante):
    // agrupa por dados e, se mais de um layout fecha, marca `ambiguous` e só atribui os
    // 6 bytes comuns (`length` + `data*`).
    // O layout antigo tem a MESMA forma de um TileSet não comprimido
    // (`{0; numTile; tiles*}`): solto, só vale se uma aresta tipada (Image/Sprite cujas
    // outras arestas fecham) já provou esse layout nesta ROM.
    let sprites = recover_sprites(rom);
    let proven: std::collections::HashSet<&str> = images
        .iter()
        .map(|i| i.palette.layout.as_str())
        .chain(sprites.iter().map(|s| s.palette.layout.as_str()))
        .collect();
    let allowed = |layout: &str| layout == "len_ptr" || proven.contains(layout);
    let mut loose: BTreeMap<u32, RecoveredPalette> = BTreeMap::new();
    for t in &targets {
        let direct = parse_palette(rom, *t as usize);
        let via_field = PALETTE_LAYOUTS.iter().filter_map(|(name, len_at, ptr_at)| {
            let at = (*t as usize).checked_sub(*ptr_at)?;
            parse_palette_layout(rom, at, name, *len_at, *ptr_at)
        });
        for pal in direct.into_iter().chain(via_field) {
            if used_pal.contains(&pal.header_offset) || !allowed(&pal.layout) {
                continue;
            }
            match loose.entry(pal.data_offset) {
                std::collections::btree_map::Entry::Vacant(e) => {
                    e.insert(pal);
                }
                std::collections::btree_map::Entry::Occupied(mut e) => {
                    let cur = e.get_mut();
                    if cur.layout != pal.layout {
                        if pal.layout == "len_ptr" {
                            cur.header_offset = pal.header_offset;
                        }
                        cur.layout = "ambiguous".into();
                    }
                }
            }
        }
    }
    let loose_palettes: Vec<RecoveredPalette> = loose.into_values().collect();
    SgdkResourceGraph {
        images,
        // Sem compressão o decode não prova nada: só entra via pai validado (Image/Sprite).
        loose_tilesets: tilesets
            .into_values()
            .filter(|t| !used.contains(&t.header_offset))
            .filter(|t| t.compression != "none")
            .collect(),
        loose_palettes,
        tileset_candidates: candidates.len(),
        music: recover_xgm(rom),
        sprites,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn put16(rom: &mut [u8], at: usize, v: u16) {
        rom[at..at + 2].copy_from_slice(&v.to_be_bytes());
    }
    fn put32(rom: &mut [u8], at: usize, v: u32) {
        rom[at..at + 4].copy_from_slice(&v.to_be_bytes());
    }

    /// ROM sintética com uma Image não comprimida 2x1 tiles (tile 1 espelhado em H).
    fn synthetic() -> Vec<u8> {
        let mut rom = vec![0u8; 0x1000];
        // paleta @0x100 -> dados @0x110
        put16(&mut rom, 0x100, 16);
        put32(&mut rom, 0x102, 0x110);
        for i in 0..16u16 {
            put16(&mut rom, 0x110 + i as usize * 2, (i * 0x0222) & 0x0EEE);
        }
        // tileset @0x200 -> 2 tiles @0x300
        put16(&mut rom, 0x200, 0);
        put16(&mut rom, 0x202, 2);
        put32(&mut rom, 0x204, 0x300);
        for i in 0..64 {
            rom[0x300 + i] = if i < 32 { 0x12 } else { 0x34 };
        }
        // tilemap @0x400 -> 2x1 @0x410
        put16(&mut rom, 0x400, 0);
        put16(&mut rom, 0x402, 2);
        put16(&mut rom, 0x404, 1);
        put32(&mut rom, 0x406, 0x410);
        put16(&mut rom, 0x410, 0x0000);
        put16(&mut rom, 0x412, 0x2801); // pal1, hflip, tile 1
                                        // image @0x500
        put32(&mut rom, 0x500, 0x100);
        put32(&mut rom, 0x504, 0x200);
        put32(&mut rom, 0x508, 0x400);
        rom
    }

    #[test]
    fn recovers_image_with_all_edges_validated() {
        let rom = synthetic();
        let g = recover_graph(&rom);
        assert_eq!(g.images.len(), 1);
        let img = &g.images[0];
        assert_eq!(img.header_offset, 0x500);
        let (w, h, px) = img.indexed_pixels();
        assert_eq!((w, h), (16, 8));
        assert_eq!(&px[0..2], &[1, 2]);
        // tile 1 = 0x34 com hflip e paleta 1: coluna 8 lê o nibble da coluna 7 (=4)
        assert_eq!(px[8], 16 + 4);
        assert_eq!(px[15], 16 + 3);
    }

    /// Cadeia `Sgdk1xWide` mínima: Definition @0x1F0 → Animation @0x1D0 → Frame @0x1A0
    /// (2 peças: 4x4 + 4x2 = 24 tiles) → TileSet @0x200; Palette antiga @0x100.
    fn synthetic_sprite_1x_wide() -> Vec<u8> {
        let mut rom = vec![0u8; 0x800];
        put16(&mut rom, 0x100, 0);
        put16(&mut rom, 0x102, 16);
        put32(&mut rom, 0x104, 0x110);
        for i in 0..16u16 {
            put16(&mut rom, 0x110 + i as usize * 2, (i * 0x0222) & 0x0EEE);
        }
        for (at, w) in [(0x180, [0, 0x0F, 0, 16]), (0x188, [0x20, 0x0D, 0, 8])] {
            for (i, v) in w.iter().enumerate() {
                put16(&mut rom, at + i * 2, *v);
            }
        }
        put32(&mut rom, 0x190, 0x180);
        put32(&mut rom, 0x194, 0x188);
        for (i, v) in [2u16, 0, 0, 0, 0, 0, 0, 32, 48, 3].iter().enumerate() {
            put16(&mut rom, 0x1A0 + i * 2, *v);
        }
        put32(&mut rom, 0x1A2, 0x190);
        put32(&mut rom, 0x1AA, 0x200);
        put32(&mut rom, 0x1C0, 0x1A0);
        put16(&mut rom, 0x1D0, 1);
        put32(&mut rom, 0x1D2, 0x1C0);
        put16(&mut rom, 0x1D6, 2);
        put32(&mut rom, 0x1D8, 0x1C4);
        put32(&mut rom, 0x1E0, 0x1D0);
        put32(&mut rom, 0x1F0, 0x100);
        put16(&mut rom, 0x1F4, 1);
        put32(&mut rom, 0x1F6, 0x1E0);
        put16(&mut rom, 0x1FA, 24);
        put16(&mut rom, 0x1FC, 2);
        put16(&mut rom, 0x200, 0);
        put16(&mut rom, 0x202, 24);
        put32(&mut rom, 0x204, 0x400);
        for i in 0..24 * 32 {
            rom[0x400 + i] = 0x11;
        }
        rom
    }

    #[test]
    fn recovers_sprite_with_wide_1x_frame_layout() {
        let rom = synthetic_sprite_1x_wide();
        let sp = recover_sprites(&rom);
        assert_eq!(sp.len(), 1);
        let (s, f) = (&sp[0], &sp[0].animations[0].frames[0]);
        assert_eq!(
            (s.header_offset, s.layout),
            (0x1F0, SpriteLayout::Sgdk1xWide)
        );
        assert_eq!(s.palette.layout, "index_len_ptr");
        assert_eq!((f.num_sprite, f.timer, f.size_px), (2, 3, Some((32, 48))));
        assert_eq!(s.animations[0].sequence, vec![0, 0]);
        let tiles: Vec<_> = f
            .parts
            .iter()
            .map(|p| (p.w_tiles, p.h_tiles, p.y))
            .collect();
        assert_eq!(tiles, vec![(4, 4, 0), (4, 2, 32)]);
        // Peças que não somam o TileSet (15 em vez de 16 tiles) derrubam a cadeia.
        let mut bad = rom.clone();
        put16(&mut bad, 0x186, 15);
        assert!(recover_sprites(&bad).is_empty());
    }

    #[test]
    fn xgc_found_when_packed_without_256_alignment() {
        let one = |rom: &mut Vec<u8>, at: usize| {
            for e in 0..63 {
                rom[at + e * 4..at + e * 4 + 4].copy_from_slice(&[0xFF, 0xFF, 0x01, 0x00]);
            }
            rom[at + 252..at + 256].fill(0); // SLEN=0, versão 0, NTSC
            let music = [1u8; 20];
            rom[at + 256..at + 260].copy_from_slice(&20u32.to_le_bytes());
            rom[at + 260..at + 280].copy_from_slice(&music);
            at + 280
        };
        let mut rom = vec![0xEEu8; 0x800];
        let end = one(&mut rom, 0x42);
        one(&mut rom, end + 0x10); // faixa seguinte logo após um "tag"
        let found: Vec<u32> = recover_xgm(&rom).iter().map(|x| x.offset).collect();
        assert_eq!(found, vec![0x42, (end + 0x10) as u32]);
        assert!(recover_xgm_aligned(&rom, 256).is_empty());
    }

    #[test]
    fn xgc_requires_frames_to_chain_exactly() {
        let mut rom = vec![0u8; 0x400];
        for e in 0..63 {
            rom[e * 4..e * 4 + 4].copy_from_slice(&[0xFF, 0xFF, 0x01, 0x00]);
        }
        // SLEN=0, NTSC; 20 quadros: 19 vazios + um de 3 bytes
        let mut music = vec![1u8; 19];
        music.extend_from_slice(&[3, 0x7E, 0x00]);
        rom[256..260].copy_from_slice(&(music.len() as u32).to_le_bytes());
        rom[260..260 + music.len()].copy_from_slice(&music);
        let x = parse_xgm(&rom, 0).expect("xgc valido");
        assert_eq!((x.frames, x.len), (20, 260 + 22));
        rom[278] = 9; // tamanho que ultrapassa MLEN
        assert!(parse_xgm(&rom, 0).is_none());
        assert!(
            parse_xgm(&[0u8; 0x400], 0).is_none(),
            "região zerada não é música"
        );
    }

    #[test]
    fn rejects_image_when_tilemap_exceeds_tileset() {
        let mut rom = synthetic();
        put16(&mut rom, 0x412, 0x0005); // tile 5 >= numTile 2
        assert!(recover_graph(&rom).images.is_empty());
        let mut rom = synthetic();
        put16(&mut rom, 0x110, 0x0001); // cor inválida (bit fora do 9-bit)
        assert!(parse_image(&rom, 0x500).is_none());
    }

    /// Mesma Image com Palette no layout antigo `{index; length; data*}` @0x180.
    fn synthetic_indexed_palette() -> Vec<u8> {
        let mut rom = synthetic();
        put16(&mut rom, 0x180, 0);
        put16(&mut rom, 0x182, 16);
        put32(&mut rom, 0x184, 0x110);
        put32(&mut rom, 0x500, 0x180);
        rom
    }

    #[test]
    fn recovers_image_with_indexed_palette_layout() {
        let g = recover_graph(&synthetic_indexed_palette());
        assert_eq!(g.images.len(), 1);
        let pal = &g.images[0].palette;
        assert_eq!(
            (pal.header_offset, pal.layout.as_str()),
            (0x180, "index_len_ptr")
        );
        assert_eq!((pal.data_offset, pal.header_bytes()), (0x110, 8));
        // index fora da CRAM (>= 64) não é Palette antiga.
        let mut rom = synthetic_indexed_palette();
        put16(&mut rom, 0x180, 64);
        assert!(recover_graph(&rom).images.is_empty());
    }

    #[test]
    fn loose_palette_is_evidenced_by_reference_to_its_data_field() {
        // Image @0x500 (layout antigo) prova o layout; a 2ª paleta @0x700 é só referida
        // pelo campo `data`.
        let mut rom = synthetic_indexed_palette();
        put16(&mut rom, 0x700, 0);
        put16(&mut rom, 0x702, 16);
        put32(&mut rom, 0x704, 0x110);
        put32(&mut rom, 0x600, 0x704); // `move.l pal+4,...`
        let g = recover_graph(&rom);
        let found: Vec<_> = g
            .loose_palettes
            .iter()
            .map(|p| (p.header_offset, p.layout.as_str()))
            .collect();
        // O campo também fecha como `len_ptr` @0x702: sem outra evidência, é ambíguo.
        assert_eq!(found, vec![(0x702, "ambiguous")]);
        // Sem nenhuma referência, a forma sozinha não basta.
        put32(&mut rom, 0x600, 0);
        assert!(recover_graph(&rom).loose_palettes.is_empty());
    }

    #[test]
    fn indexed_layout_needs_a_typed_edge_before_loose_use() {
        // TileSet não comprimido {0; 16; tiles*} tem a forma de Palette antiga.
        let mut rom = synthetic();
        put16(&mut rom, 0x700, 0);
        put16(&mut rom, 0x702, 16);
        put32(&mut rom, 0x704, 0x110);
        put32(&mut rom, 0x600, 0x700);
        let g = recover_graph(&rom);
        assert!(
            g.loose_palettes.iter().all(|p| p.layout == "len_ptr"),
            "{:?}",
            g.loose_palettes
        );
    }
}

/// Runner BYOR: `RDS_SGDKRES_TRUTH` (TSV `projeto<TAB>rom<TAB>symbol.txt`, opcional),
/// `RDS_SGDKRES_CORPUS` (dir de ROMs, opcional), `RDS_SGDKRES_OUT` (saída).
#[cfg(test)]
mod runner {
    use super::*;
    use std::path::PathBuf;

    /// Compara cada quadro composto com a arte ORIGINAL (PNG citado no `.res`), pixel a
    /// pixel: transparência (índice 0) e cor 9-bit. Mede fidelidade da recomposição.
    #[test]
    #[ignore = "BYOR: requer RDS_SGDKRES_TRUTH (rom em <projeto>/.../rom.bin)"]
    fn sgdk_sprite_pixels_match_source_art() {
        let list = std::env::var("RDS_SGDKRES_TRUTH").unwrap();
        for line in std::fs::read_to_string(list).unwrap().lines() {
            let c: Vec<&str> = line.split('\t').collect();
            let rom = std::fs::read(c[1]).unwrap();
            let project = c[1]
                .split("/rds/")
                .next()
                .unwrap()
                .split("/out/")
                .next()
                .unwrap();
            let mut decl = std::collections::HashMap::new();
            for entry in std::fs::read_dir(format!("{project}/res"))
                .into_iter()
                .flatten()
                .flatten()
            {
                let text = std::fs::read_to_string(entry.path()).unwrap_or_default();
                for l in text.lines() {
                    let t: Vec<&str> = l.split_whitespace().collect();
                    if t.len() >= 3 && t[0] == "SPRITE" {
                        decl.insert(
                            t[1].to_string(),
                            format!("{project}/res/{}", t[2].trim_matches('"')),
                        );
                    }
                }
            }
            let syms: std::collections::HashMap<u32, String> = std::fs::read_to_string(c[2])
                .unwrap()
                .lines()
                .filter_map(|l| {
                    let mut it = l.split_whitespace();
                    let a = u32::from_str_radix(it.next()?, 16).ok()?;
                    it.next()?;
                    Some((a, it.next()?.to_string()))
                })
                .collect();
            let (mut frames, mut exact, mut px_total, mut px_bad) =
                (0usize, 0usize, 0usize, 0usize);
            for sp in recover_graph(&rom).sprites {
                let Some(src) = syms.get(&sp.header_offset).and_then(|n| decl.get(n)) else {
                    continue;
                };
                let Ok(img) = image::open(src) else { continue };
                let img = img.to_rgba8();
                let (cw, ch) = sp.cell_size();
                for (r, anim) in sp.animations.iter().enumerate() {
                    for (k, frame) in anim.frames.iter().enumerate() {
                        let cell = frame.compose(cw, ch);
                        let mut bad = 0usize;
                        for y in 0..ch {
                            for x in 0..cw {
                                let (sx, sy) = ((k * cw + x) as u32, (r * ch + y) as u32);
                                if sx >= img.width() || sy >= img.height() {
                                    continue;
                                }
                                let p = img.get_pixel(sx, sy).0;
                                let idx = cell[y * cw + x];
                                let src_rgb9 = (
                                    u16::from(p[0] >> 5),
                                    u16::from(p[1] >> 5),
                                    u16::from(p[2] >> 5),
                                );
                                let pal0 = sp.palette.colors[0];
                                let pal0_rgb9 = ((pal0 >> 1) & 7, (pal0 >> 5) & 7, (pal0 >> 9) & 7);
                                let src_transparent = p[3] == 0 || src_rgb9 == pal0_rgb9;
                                let ok = if idx == 0 {
                                    src_transparent
                                } else {
                                    let w = sp.palette.colors[idx as usize];
                                    !src_transparent
                                        && src_rgb9 == ((w >> 1) & 7, (w >> 5) & 7, (w >> 9) & 7)
                                };
                                px_total += 1;
                                if !ok {
                                    bad += 1;
                                }
                            }
                        }
                        frames += 1;
                        px_bad += bad;
                        if bad == 0 {
                            exact += 1;
                        }
                    }
                }
            }
            println!(
                "pixels {:16} frames={frames:5} exact={exact:5} pixel_match={:.4}",
                c[0],
                if px_total == 0 {
                    0.0
                } else {
                    1.0 - px_bad as f64 / px_total as f64
                }
            );
        }
    }

    #[test]
    #[ignore = "BYOR: diagnóstico RDS_SGDKRES_ROM + RDS_SGDKRES_ADDRS (hex, vírgula)"]
    fn sgdk_sprite_refusal_reasons() {
        let rom = std::fs::read(std::env::var("RDS_SGDKRES_ROM").unwrap()).unwrap();
        for a in std::env::var("RDS_SGDKRES_ADDRS").unwrap().split(',') {
            let at = usize::from_str_radix(a.trim_start_matches("0x"), 16).unwrap();
            let max_tile = be16(&rom, at + 14).unwrap();
            let arr = rom_ptr(&rom, at + 10).unwrap();
            for i in 0..be16(&rom, at + 8).unwrap() as usize {
                let an = rom_ptr(&rom, arr + i * 4).unwrap();
                let fr = rom_ptr(&rom, an + 2).unwrap();
                for j in 0..rom[an] as usize {
                    let f = rom_ptr(&rom, fr + j * 4).unwrap();
                    let ts = rom_ptr(&rom, f + 2).unwrap();
                    if parse_tileset(&rom, ts).is_none() {
                        let c = TilesetCandidate {
                            header_offset: ts,
                            compression: HeaderCompression::from_field(be16(&rom, ts).unwrap())
                                .unwrap(),
                            num_tiles: be16(&rom, ts + 2).unwrap() as usize,
                            stream_offset: rom_ptr(&rom, ts + 4).unwrap(),
                            expected_len: be16(&rom, ts + 2).unwrap() as usize * 32,
                        };
                        let err = verify_lz4w_resource(&rom, &c, &Lz4wLimits::default()).err();
                        println!("{a} anim{i} frame{j} tileset {ts:#x} REJEITADO max_tile={max_tile} {c:?} {err:?}");
                    }
                }
            }
        }
    }

    #[test]
    #[ignore = "BYOR: requer RDS_SGDKRES_OUT e TRUTH/CORPUS"]
    fn sgdk_resources_truth_and_corpus() {
        let out = PathBuf::from(std::env::var("RDS_SGDKRES_OUT").unwrap());
        std::fs::create_dir_all(&out).unwrap();
        if let Ok(list) = std::env::var("RDS_SGDKRES_TRUTH") {
            for line in std::fs::read_to_string(list).unwrap().lines() {
                let c: Vec<&str> = line.split('\t').collect();
                let rom = std::fs::read(c[1]).unwrap();
                let syms: std::collections::HashMap<u32, String> = std::fs::read_to_string(c[2])
                    .unwrap()
                    .lines()
                    .filter_map(|l| {
                        let mut it = l.split_whitespace();
                        let a = u32::from_str_radix(it.next()?, 16).ok()?;
                        it.next()?;
                        Some((a, it.next()?.to_string()))
                    })
                    .collect();
                let g = recover_graph(&rom);
                let named = g
                    .images
                    .iter()
                    .filter(|i| syms.contains_key(&i.header_offset))
                    .count();
                let spr_named = g
                    .sprites
                    .iter()
                    .filter(|i| syms.contains_key(&i.header_offset))
                    .count();
                let spr_names: Vec<&str> = g
                    .sprites
                    .iter()
                    .filter_map(|i| syms.get(&i.header_offset).map(String::as_str))
                    .take(4)
                    .collect();
                let layouts: std::collections::BTreeSet<_> =
                    g.sprites.iter().map(|s| s.layout).collect();
                println!(
                    "truth {:16} sprites={:3} named={:3} layouts={layouts:?} sample={spr_names:?}",
                    c[0],
                    g.sprites.len(),
                    spr_named
                );
                let names: Vec<&str> = g
                    .images
                    .iter()
                    .filter_map(|i| syms.get(&i.header_offset).map(String::as_str))
                    .take(6)
                    .collect();
                println!(
                    "truth {:16} images={:3} named={:3} loose_ts={:4} loose_pal={:4} sample={:?}",
                    c[0],
                    g.images.len(),
                    named,
                    g.loose_tilesets.len(),
                    g.loose_palettes.len(),
                    names
                );
            }
        }
        if let Ok(dir) = std::env::var("RDS_SGDKRES_CORPUS") {
            let mut paths: Vec<_> = std::fs::read_dir(dir)
                .unwrap()
                .flatten()
                .map(|e| e.path())
                .collect();
            paths.sort();
            for path in paths {
                let rom = std::fs::read(&path).unwrap();
                let g = recover_graph(&rom);
                let stem = path
                    .file_stem()
                    .unwrap()
                    .to_string_lossy()
                    .chars()
                    .take(24)
                    .collect::<String>();
                let dir = out.join(&stem);
                if !g.images.is_empty() {
                    std::fs::create_dir_all(&dir).unwrap();
                    for img in g.images.iter().take(400) {
                        std::fs::write(
                            dir.join(format!("img_{:06x}.png", img.header_offset)),
                            image_png(img),
                        )
                        .unwrap();
                    }
                }
                if !g.images.is_empty() || !g.music.is_empty() || !g.sprites.is_empty() {
                    std::fs::create_dir_all(&dir).unwrap();
                    std::fs::write(
                        dir.join("graph.json"),
                        serde_json::to_string_pretty(&g).unwrap(),
                    )
                    .unwrap();
                }
                for sp in g.sprites.iter().take(800) {
                    std::fs::write(
                        dir.join(format!("spr_{:06x}.png", sp.header_offset)),
                        sp.sheet_png().2,
                    )
                    .unwrap();
                }
                for (i, x) in g.music.iter().enumerate() {
                    std::fs::create_dir_all(&dir).unwrap();
                    let file = &rom[x.offset as usize..(x.offset + x.len) as usize];
                    std::fs::write(dir.join(format!("music_{i:02}_{:06x}.xgc", x.offset)), file)
                        .unwrap();
                }
                println!(
                    "corpus {:24} sprites={:3} music={:2} images={:4} loose_ts={:4} loose_pal={:4} cand={}",
                    stem,
                    g.sprites.len(),
                    g.music.len(),
                    g.images.len(),
                    g.loose_tilesets.len(),
                    g.loose_palettes.len(),
                    g.tileset_candidates
                );
            }
        }
    }
}

#[cfg(test)]
mod diag {
    use super::*;

    /// BYOR: nº de XGC por ROM com varredura alinhada em 256 e em 2 bytes
    /// (`RDS_REX_CORPUS_DIR`, um `.bin` por ROM). Comparar com tags XGMTool externas.
    #[test]
    #[ignore = "BYOR: RDS_REX_CORPUS_DIR"]
    fn xgm_count_by_alignment() {
        let dir = std::env::var("RDS_REX_CORPUS_DIR").expect("RDS_REX_CORPUS_DIR ausente");
        let mut files: Vec<_> = std::fs::read_dir(&dir)
            .unwrap_or_else(|e| panic!("{dir}: {e}"))
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "bin"))
            .collect();
        files.sort();
        assert!(!files.is_empty(), "corpus vazio");
        for f in files {
            let rom = std::fs::read(&f).unwrap();
            println!(
                "xgm\t{}\t{}\t{}",
                recover_xgm_aligned(&rom, 256).len(),
                recover_xgm_aligned(&rom, 2).len(),
                f.file_name().unwrap().to_string_lossy()
            );
        }
    }

    /// BYOR: por que uma ROM SGDK fica sem Image? Conta cada aresta que reprova.
    #[test]
    #[ignore = "BYOR: RDS_REX_ROM"]
    fn image_edge_failures() {
        let p = std::env::var("RDS_REX_ROM").expect("RDS_REX_ROM ausente");
        let rom = std::fs::read(&p).unwrap_or_else(|e| panic!("{p}: {e}"));
        let cands = scan_tileset_headers(&rom);
        let mut ts = BTreeMap::new();
        let mut by_comp: BTreeMap<String, usize> = BTreeMap::new();
        for c in &cands {
            if let Some(t) = parse_tileset(&rom, c.header_offset) {
                *by_comp.entry(t.compression.clone()).or_default() += 1;
                ts.insert(t.header_offset, t);
            }
        }
        println!(
            "candidatos={} tilesets={} {by_comp:?}",
            cands.len(),
            ts.len()
        );
        let (mut refs, mut pal_fail, mut map_fail, mut shown) = (0, 0, 0, 0);
        let mut at = 0;
        while at + 12 <= rom.len() {
            if let Some(t) = be32(&rom, at + 4).and_then(|p| ts.get(&p)) {
                refs += 1;
                let pal = rom_ptr(&rom, at).and_then(|p| parse_palette(&rom, p));
                let map = rom_ptr(&rom, at + 8).and_then(|p| parse_tilemap(&rom, p, t.num_tiles));
                pal_fail += usize::from(pal.is_none());
                map_fail += usize::from(map.is_none());
                if (pal.is_none() || map.is_none()) && shown < 6 {
                    shown += 1;
                    let dump = |a: Option<usize>| {
                        a.and_then(|a| rom.get(a..a + 12))
                            .map(|b| format!("{b:02x?}"))
                    };
                    println!(
                        "@{at:#x} ts={:#x} n={} pal={:?} {:?} map={:?} {:?} prev={:02x?}",
                        t.header_offset,
                        t.num_tiles,
                        pal.is_some(),
                        dump(rom_ptr(&rom, at)),
                        map.is_some(),
                        dump(rom_ptr(&rom, at + 8)),
                        &rom[at.saturating_sub(8)..at + 12]
                    );
                }
            }
            at += 2;
        }
        println!("refs_a_tileset={refs} pal_falha={pal_fail} map_falha={map_fail}");
        let g = recover_graph(&rom);
        for p in &g.loose_palettes {
            println!(
                "loose_pal {:x} {:x} {}",
                p.header_offset, p.data_offset, p.layout
            );
        }
        println!(
            "images={} sprites={} music={}",
            g.images.len(),
            g.sprites.len(),
            g.music.len()
        );
    }
}
