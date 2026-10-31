//! Remontagem da ROM a partir do projeto recuperado (motor; sem nome de jogo).
//!
//! Prova de que a decomposição é sem perda: as fontes editáveis do projeto (PNG de
//! Image/Sprite, paletas nos PNG, `.xgc`) REGENERAM os bytes que representam, e todo o
//! resto vem de segmentos preservados. `rebuild` deve devolver a ROM idêntica (mesmo
//! SHA-256); editar um PNG muda só os bytes de tile correspondentes.
//!
//! Regenera-se apenas o que tem inversa exata:
//! * tiles NÃO comprimidos de Image (pixel lido da 1ª célula do mapa que usa o tile,
//!   desfazendo flip) e de Sprite (peças sem sobreposição dentro da célula);
//! * dados de paleta (inversa 9-bit da PLTE do PNG);
//! * música XGC (arquivo binário).
//!
//! Streams comprimidos ficam preservados até o reencode provar igualdade de bytes.
//! Pixels cuja cor é ambígua na linha de paleta (cores repetidas) também tornam o item
//! "preservado" — sem adivinhar índice.

use serde::{Deserialize, Serialize};
use std::path::Path;

use super::rex_sgdk_resources::{RecoveredImage, RecoveredSprite, SgdkResourceGraph};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TileSource {
    /// Pixel (x,y) do canto do tile no PNG, flips e linha de paleta.
    pub x: u32,
    pub y: u32,
    pub hflip: bool,
    pub vflip: bool,
    pub pal_line: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Emitter {
    Preserved {
        offset: u32,
        len: u32,
        file: String,
    },
    Tiles {
        offset: u32,
        png: String,
        tiles: Vec<TileSource>,
        /// Índices (1..15) usados pelos tiles originais, por linha de paleta: a cor do
        /// PNG é resolvida primeiro entre eles (inversa exata mesmo com slots repetidos).
        used: Vec<Vec<u8>>,
        label: String,
    },
    Palette {
        offset: u32,
        png: String,
        count: u32,
        label: String,
    },
    Binary {
        offset: u32,
        file: String,
        label: String,
    },
    /// Arte Nemesis: PNG inalterado restitui `original`; editado é reencodado e precisa
    /// caber em `len` (o resto do intervalo mantém os bytes originais).
    Nemesis {
        offset: u32,
        len: u32,
        tiles: u32,
        png: String,
        original: String,
        label: String,
        /// Linha de paleta (0..3) de cada tile no PNG de 64 cores; vazio = tons de cinza.
        #[serde(default)]
        tile_lines: Vec<u8>,
    },
    /// Mapa Enigma (palavras em JSON) ou dados Kosinski (binário descomprimido): fonte
    /// inalterada restitui `original`; editada é reencodada e precisa caber em `len`.
    Codec {
        codec: String,
        offset: u32,
        len: u32,
        file: String,
        original: String,
        label: String,
    },
}

/// Paleta de 64 cores e linhas por tile da arte Nemesis `offset` (ligação provada em
/// `md.art_palettes`; sem ligação: linhas zeradas e tons de cinza, índice = valor).
/// Cores repetidas numa linha recebem um desvio imperceptível (+1 no azul, até ficar
/// única): o PNG continua fiel à vista e a inversa cor→índice é exata. A remontagem da arte
/// só lê índices; as cores da ROM vêm das paletas, nunca deste PNG.
pub fn nemesis_palette(graph: &SgdkResourceGraph, offset: u32) -> (Vec<u8>, Vec<[u8; 3]>) {
    let gray: Vec<[u8; 3]> = (0..16u8).map(|i| [i * 17; 3]).collect();
    let mut pal: Vec<[u8; 3]> = gray.repeat(4);
    let Some(link) = graph.md.art_palettes.iter().find(|a| a.stream == offset) else {
        return (Vec::new(), pal);
    };
    for (l, line) in link.lines.iter().enumerate() {
        if let Some(words) = line {
            for (i, w) in words.iter().enumerate() {
                pal[l * 16 + i] = super::rex_resources::md_color_word_to_rgb(*w);
            }
        }
        for i in 1..16 {
            while pal[l * 16..l * 16 + i].contains(&pal[l * 16 + i]) {
                pal[l * 16 + i][2] = pal[l * 16 + i][2].wrapping_add(1);
            }
        }
    }
    (link.tile_lines.clone(), pal)
}

/// PNG indexado (16 colunas de tiles) da arte Nemesis com a linha de cada tile.
pub fn nemesis_png(tiles: &[u8], lines: &[u8], pal: &[[u8; 3]]) -> Vec<u8> {
    let (w, h, mut px) = super::rex_nemesis::tiles_to_sheet(tiles);
    let cols = (w / 8) as usize;
    for (i, p) in px.iter_mut().enumerate() {
        let t = (i / w as usize / 8) * cols + (i % w as usize) / 8;
        *p += 16 * lines.get(t).copied().unwrap_or(0);
    }
    crate::tools::asset_extractor::encode_indexed_png(&px, w, h, pal)
}

/// Inversa de `nemesis_png`: tiles 4bpp lidos pela cor dentro da linha de cada tile.
pub fn nemesis_tiles_from_png(png: &[u8], lines: &[u8], tiles: usize) -> Result<Vec<u8>, String> {
    let pal = png_palette(png).ok_or("PNG sem PLTE")?;
    let rgba = image::load_from_memory(png)
        .map_err(|e| e.to_string())?
        .to_rgba8();
    let (w, cols) = (rgba.width() as usize, rgba.width() as usize / 8);
    let mut px = vec![0u8; rgba.pixels().len()];
    for (i, p) in rgba.pixels().enumerate() {
        let t = (i / w / 8) * cols + (i % w) / 8;
        if t >= tiles {
            continue;
        }
        let l = usize::from(lines.get(t).copied().unwrap_or(0)) * 16;
        px[i] = pal
            .get(l..l + 16)
            .and_then(|line| line.iter().position(|c| *c == [p.0[0], p.0[1], p.0[2]]))
            .ok_or_else(|| format!("cor fora da linha de paleta no pixel {i}"))?
            as u8;
    }
    Ok(super::rex_nemesis::sheet_to_tiles(&px, rgba.width(), tiles))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebuildPlan {
    pub schema: String,
    pub rom_size: u32,
    pub rom_sha256: String,
    pub emitters: Vec<Emitter>,
    /// Itens que não puderam virar fonte editável e o motivo (preservados).
    pub preserved_items: Vec<(String, String)>,
}

fn color_to_word(rgb: [u8; 3]) -> u16 {
    let v = |c: u8| ((u32::from(c) * 7 + 127) / 255) as u16;
    (v(rgb[0]) << 1) | (v(rgb[1]) << 5) | (v(rgb[2]) << 9)
}

/// Lê a PLTE de um PNG (qualquer editor que preserve PNG indexado a mantém).
pub fn png_palette(png: &[u8]) -> Option<Vec<[u8; 3]>> {
    let mut at = 8usize;
    while at + 12 <= png.len() {
        let len = u32::from_be_bytes(png[at..at + 4].try_into().ok()?) as usize;
        let kind = &png[at + 4..at + 8];
        if kind == b"PLTE" {
            let data = png.get(at + 8..at + 8 + len)?;
            return Some(data.chunks_exact(3).map(|c| [c[0], c[1], c[2]]).collect());
        }
        at += 12 + len;
    }
    None
}

/// Índices 1..15 usados por linha nos tiles originais (via fontes de tile).
fn used_indices(tiles: &[u8], sources: &[TileSource]) -> Vec<Vec<u8>> {
    let mut used = [[false; 16]; 4];
    for (i, src) in sources.iter().enumerate() {
        for b in &tiles[i * 32..i * 32 + 32] {
            for idx in [b >> 4, b & 0x0F] {
                used[src.pal_line as usize][idx as usize] = true;
            }
        }
    }
    used.iter()
        .map(|l| (1..16u8).filter(|i| l[*i as usize]).collect())
        .collect()
}

/// Inversa exata exige que nenhum par de índices USADOS na mesma linha tenha a mesma cor.
fn used_unambiguous(colors: &[u16], used: &[Vec<u8>]) -> bool {
    used.iter().enumerate().all(|(line, idxs)| {
        let mut seen = std::collections::HashSet::new();
        idxs.iter()
            .all(|i| seen.insert(colors.get(line * 16 + *i as usize).copied().unwrap_or(0)))
    })
}

fn image_tiles(img: &RecoveredImage) -> Result<Vec<TileSource>, String> {
    if img.tileset.compression != "none" {
        return Err(format!("tiles {} comprimidos", img.tileset.compression));
    }
    let w = img.tilemap.width as usize;
    let mut src: Vec<Option<TileSource>> = vec![None; img.tileset.num_tiles as usize];
    for (i, cell) in img.tilemap.cells.iter().enumerate() {
        let t = (cell & 0x7FF) as usize;
        if src[t].is_none() {
            let line = ((cell >> 13) & 3) as u8;
            src[t] = Some(TileSource {
                x: ((i % w) * 8) as u32,
                y: ((i / w) * 8) as u32,
                hflip: cell & 0x0800 != 0,
                vflip: cell & 0x1000 != 0,
                pal_line: line,
            });
        }
    }
    src.into_iter()
        .enumerate()
        .map(|(i, s)| s.ok_or_else(|| format!("tile {i} não usado pelo mapa")))
        .collect()
}

/// Tiles de cada quadro de sprite na folha (linha = animação, coluna = quadro).
/// TileSet de um quadro: offset do stream, fontes dos tiles e bytes originais.
type FrameTiles = (u32, Vec<TileSource>, Vec<u8>);

fn sprite_frame_tiles(sp: &RecoveredSprite) -> Result<Vec<FrameTiles>, String> {
    let (cw, ch, ox, oy) = sp.sheet_cell();
    let mut out = Vec::new();
    for (r, anim) in sp.animations.iter().enumerate() {
        for (c, frame) in anim.frames.iter().enumerate() {
            if frame.tileset.compression != "none" {
                return Err(format!("tiles {} comprimidos", frame.tileset.compression));
            }
            let mut tiles = Vec::new();
            let mut rects: Vec<(i32, i32, i32, i32)> = Vec::new();
            for p in &frame.parts {
                let (x0, y0) = (i32::from(p.x) - ox, i32::from(p.y) - oy);
                let (x1, y1) = (x0 + 8 * i32::from(p.w_tiles), y0 + 8 * i32::from(p.h_tiles));
                if x0 < 0 || y0 < 0 || x1 as usize > cw || y1 as usize > ch {
                    return Err("peça fora da célula".into());
                }
                if rects
                    .iter()
                    .any(|(a, b, cc, d)| x0 < *cc && *a < x1 && y0 < *d && *b < y1)
                {
                    return Err("peças sobrepostas".into());
                }
                rects.push((x0, y0, x1, y1));
                for tx in 0..p.w_tiles as i32 {
                    for ty in 0..p.h_tiles as i32 {
                        tiles.push(TileSource {
                            x: (c * cw) as u32 + (x0 + tx * 8) as u32,
                            y: (r * ch) as u32 + (y0 + ty * 8) as u32,
                            hflip: false,
                            vflip: false,
                            pal_line: 0,
                        });
                    }
                }
            }
            out.push((
                frame.tileset.stream_offset,
                tiles,
                frame.tileset.tiles.clone(),
            ));
        }
    }
    Ok(out)
}

/// Monta o plano. `regions` de cada emissor regenerado são retiradas dos preservados.
pub fn plan(rom: &[u8], graph: &SgdkResourceGraph) -> RebuildPlan {
    let mut emitters = Vec::new();
    let mut preserved_items = Vec::new();
    let mut covered: Vec<(usize, usize)> = Vec::new();
    for img in &graph.images {
        let name = format!("img_{:06x}", img.header_offset);
        let png = format!("res/img/{name}.png");
        match image_tiles(img) {
            Ok(tiles) => {
                let used = used_indices(&img.tileset.tiles, &tiles);
                if used_unambiguous(&img.palette.colors, &used) {
                    covered.push((img.tileset.stream_offset as usize, tiles.len() * 32));
                    emitters.push(Emitter::Tiles {
                        offset: img.tileset.stream_offset,
                        png: png.clone(),
                        tiles,
                        used,
                        label: name.clone(),
                    });
                } else {
                    preserved_items.push((name.clone(), "índices usados com a mesma cor".into()));
                }
            }
            Err(why) => preserved_items.push((name.clone(), why)),
        }
        let n = img.palette.colors.len();
        covered.push((img.palette.data_offset as usize, n * 2));
        emitters.push(Emitter::Palette {
            offset: img.palette.data_offset,
            png,
            count: n as u32,
            label: name,
        });
    }
    for sp in &graph.sprites {
        let name = format!("spr_{:06x}", sp.header_offset);
        let png = format!("res/spr/{name}.png");
        match sprite_frame_tiles(sp) {
            Ok(frames) => {
                for (offset, tiles, data) in frames {
                    let used = used_indices(&data, &tiles);
                    if !used_unambiguous(&sp.palette.colors, &used) {
                        preserved_items
                            .push((name.clone(), "índices usados com a mesma cor".into()));
                        continue;
                    }
                    // Quadros podem compartilhar o mesmo TileSet: emite uma vez.
                    if covered.iter().any(|(s, _)| *s == offset as usize) {
                        continue;
                    }
                    covered.push((offset as usize, tiles.len() * 32));
                    emitters.push(Emitter::Tiles {
                        offset,
                        png: png.clone(),
                        tiles,
                        used,
                        label: name.clone(),
                    });
                }
            }
            Err(why) => preserved_items.push((name.clone(), why)),
        }
        if !covered
            .iter()
            .any(|(s, _)| *s == sp.palette.data_offset as usize)
        {
            covered.push((sp.palette.data_offset as usize, 32));
            emitters.push(Emitter::Palette {
                offset: sp.palette.data_offset,
                png,
                count: 16,
                label: name,
            });
        }
    }
    for (i, x) in graph.music.iter().enumerate() {
        covered.push((x.offset as usize, x.len as usize));
        emitters.push(Emitter::Binary {
            offset: x.offset,
            file: format!("res/music/music_{i:02}.xgc"),
            label: format!("music_{i:02}"),
        });
    }
    for (codec, list) in [
        ("enigma", &graph.md.enigma),
        ("kosinski", &graph.md.kosinski),
    ] {
        for c in list {
            let ext = if codec == "enigma" { "json" } else { "bin" };
            covered.push((c.offset as usize, c.len as usize));
            emitters.push(Emitter::Codec {
                codec: codec.into(),
                offset: c.offset,
                len: c.len,
                file: format!("res/map/{codec}_{:06x}.{ext}", c.offset),
                original: format!("rex/map/{codec}_{:06x}.orig", c.offset),
                label: format!("{codec}_{:06x}", c.offset),
            });
        }
    }
    for st in &graph.nemesis {
        let (tile_lines, _) = nemesis_palette(graph, st.offset);
        covered.push((st.offset as usize, st.len as usize));
        emitters.push(Emitter::Nemesis {
            tile_lines,
            offset: st.offset,
            len: st.len,
            tiles: st.tiles,
            png: format!("res/nem/nem_{:06x}.png", st.offset),
            original: format!("rex/nem/{:06x}.nem", st.offset),
            label: format!("nem_{:06x}", st.offset),
        });
    }
    // Segmentos preservados = complemento da união regenerada.
    let mut mask = vec![false; rom.len()];
    for (s, n) in &covered {
        let end = (s + n).min(rom.len());
        mask[*s..end].fill(true);
    }
    let mut at = 0usize;
    let mut seg = 0usize;
    while at < rom.len() {
        if mask[at] {
            at += 1;
            continue;
        }
        let start = at;
        while at < rom.len() && !mask[at] {
            at += 1;
        }
        emitters.insert(
            seg,
            Emitter::Preserved {
                offset: start as u32,
                len: (at - start) as u32,
                file: format!("rex/preserved/{start:06x}.bin"),
            },
        );
        seg += 1;
    }
    RebuildPlan {
        schema: "rex-sgdk-rebuild/v1".into(),
        rom_size: rom.len() as u32,
        rom_sha256: super::fingerprint::sha256_hex(rom),
        emitters,
        preserved_items,
    }
}

/// Grava os segmentos preservados e o plano em `out/rex/`.
pub fn write_plan(rom: &[u8], plan: &RebuildPlan, out: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(out.join("rex/preserved"))?;
    for e in &plan.emitters {
        if let Emitter::Preserved { offset, len, file } = e {
            let s = *offset as usize;
            std::fs::write(out.join(file), &rom[s..s + *len as usize])?;
        }
    }
    std::fs::write(
        out.join("rex/rebuild.json"),
        serde_json::to_string_pretty(plan).unwrap_or_default(),
    )
}

fn tile_from_png(
    rgba: &image::RgbaImage,
    pal: &[[u8; 3]],
    used: &[Vec<u8>],
    t: &TileSource,
) -> Result<[u8; 32], String> {
    let mut out = [0u8; 32];
    for row in 0..8u32 {
        for col in 0..8u32 {
            let sx = t.x + if t.hflip { 7 - col } else { col };
            let sy = t.y + if t.vflip { 7 - row } else { row };
            let p = rgba.get_pixel(sx, sy).0;
            let idx = if p[3] == 0 {
                0
            } else {
                let line = usize::from(t.pal_line) * 16;
                let word = color_to_word([p[0], p[1], p[2]]);
                let preferred = used
                    .get(usize::from(t.pal_line))
                    .cloned()
                    .unwrap_or_default();
                preferred
                    .iter()
                    .map(|i| *i as usize)
                    .chain(1..16)
                    .find(|i| pal.get(line + i).map(|c| color_to_word(*c)) == Some(word))
                    .ok_or_else(|| format!("cor fora da paleta em ({sx},{sy})"))?
                    as u8
            };
            let b = &mut out[(row * 4 + col / 2) as usize];
            *b |= if col % 2 == 0 { idx << 4 } else { idx };
        }
    }
    Ok(out)
}

/// Remonta a ROM a partir do projeto em `dir`.
pub fn rebuild(dir: &Path) -> Result<Vec<u8>, String> {
    let text = std::fs::read_to_string(dir.join("rex/rebuild.json")).map_err(|e| e.to_string())?;
    let plan: RebuildPlan = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let mut rom = vec![0u8; plan.rom_size as usize];
    let read = |f: &str| std::fs::read(dir.join(f)).map_err(|e| format!("{f}: {e}"));
    for e in &plan.emitters {
        match e {
            Emitter::Preserved { offset, file, .. } | Emitter::Binary { offset, file, .. } => {
                let data = read(file)?;
                let s = *offset as usize;
                rom.get_mut(s..s + data.len())
                    .ok_or("fora da ROM")?
                    .copy_from_slice(&data);
            }
            Emitter::Palette {
                offset, png, count, ..
            } => {
                let pal = png_palette(&read(png)?).ok_or("PNG sem PLTE")?;
                for i in 0..*count as usize {
                    let w = color_to_word(*pal.get(i).ok_or("PLTE curta")?);
                    let at = *offset as usize + i * 2;
                    rom[at..at + 2].copy_from_slice(&w.to_be_bytes());
                }
            }
            Emitter::Nemesis {
                offset,
                len,
                tiles,
                png,
                original,
                label,
                tile_lines,
            } => {
                let orig = read(original)?;
                let dec = super::rex_nemesis::decode(&orig, &Default::default())
                    .map_err(|e| format!("{label}: original não decodifica ({})", e.code()))?;
                let edited = nemesis_tiles_from_png(&read(png)?, tile_lines, *tiles as usize)
                    .map_err(|e| format!("{png}: {e}"))?;
                let mut region = orig.clone();
                if edited != dec.bytes {
                    let enc = super::rex_nemesis::encode(&edited)
                        .ok_or_else(|| format!("{label}: reencode falhou"))?;
                    if enc.len() > *len as usize {
                        return Err(format!(
                            "{label}: edição gera {} bytes, o espaço original tem {len}; relocação ainda não suportada",
                            enc.len()
                        ));
                    }
                    region[..enc.len()].copy_from_slice(&enc);
                }
                let s = *offset as usize;
                rom.get_mut(s..s + region.len())
                    .ok_or("fora da ROM")?
                    .copy_from_slice(&region);
            }
            Emitter::Codec {
                codec,
                offset,
                len,
                file,
                original,
                label,
            } => {
                let orig = read(original)?;
                let src = read(file)?;
                let plain: Vec<u8> = if codec == "enigma" {
                    let words: Vec<u16> =
                        serde_json::from_slice(&src).map_err(|e| format!("{file}: {e}"))?;
                    words.iter().flat_map(|w| w.to_be_bytes()).collect()
                } else {
                    src
                };
                let current: Vec<u8> = if codec == "enigma" {
                    rex_enigma::decode(&orig, &Default::default())
                        .map_err(|_| format!("{label}: original não decodifica"))?
                        .bytes_be()
                } else {
                    ::rex_kosinski::decode(&orig, 0x10000, 4_000_000)
                        .map_err(|_| format!("{label}: original não decodifica"))?
                        .output
                };
                let mut region = orig.clone();
                if plain != current {
                    let enc = if codec == "enigma" {
                        let words: Vec<u16> = plain
                            .chunks_exact(2)
                            .map(|c| u16::from_be_bytes([c[0], c[1]]))
                            .collect();
                        super::rex_md_tables::enigma_encode(&words)
                    } else {
                        ::rex_kosinski::encode_optimal(&plain, 0x20000, 256_000_000)
                            .ok()
                            .map(|e| e.stream)
                    }
                    .ok_or_else(|| format!("{label}: reencode falhou"))?;
                    if enc.len() > *len as usize {
                        return Err(format!(
                            "{label}: edição gera {} bytes, o espaço original tem {len}; relocação ainda não suportada",
                            enc.len()
                        ));
                    }
                    region[..enc.len()].copy_from_slice(&enc);
                }
                let s = *offset as usize;
                rom.get_mut(s..s + region.len())
                    .ok_or("fora da ROM")?
                    .copy_from_slice(&region);
            }
            Emitter::Tiles {
                offset,
                png,
                tiles,
                used,
                ..
            } => {
                let bytes = read(png)?;
                let pal = png_palette(&bytes).ok_or("PNG sem PLTE")?;
                let rgba = image::load_from_memory(&bytes)
                    .map_err(|e| e.to_string())?
                    .to_rgba8();
                for (i, t) in tiles.iter().enumerate() {
                    let tile = tile_from_png(&rgba, &pal, used, t)?;
                    let at = *offset as usize + i * 32;
                    rom[at..at + 32].copy_from_slice(&tile);
                }
            }
        }
    }
    Ok(rom)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn color_inverse_roundtrips_all_512_words() {
        use super::super::rex_resources::md_color_word_to_rgb;
        for r in 0..8u16 {
            for g in 0..8u16 {
                for b in 0..8u16 {
                    let w = (r << 1) | (g << 5) | (b << 9);
                    assert_eq!(color_to_word(md_color_word_to_rgb(w)), w);
                }
            }
        }
    }

    #[test]
    fn ambiguity_only_counts_used_indices() {
        let mut pal = vec![0u16; 16];
        pal[1] = 0x0EEE;
        pal[2] = 0x0EEE; // slot repetido
        pal[3] = 0x000E;
        assert!(
            used_unambiguous(&pal, &[vec![1, 3]]),
            "repetido mas não usado: ok"
        );
        assert!(
            !used_unambiguous(&pal, &[vec![1, 2]]),
            "dois usados com a mesma cor"
        );
    }
}
