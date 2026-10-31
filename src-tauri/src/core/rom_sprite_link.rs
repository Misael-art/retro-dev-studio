//! Ligacao de um sprite capturado da ROM ao recurso SGDK e ao codigo C que o usa (Experimental).
//!
//! O VDP so guarda tiles e a linha de paleta; o nome do recurso nao existe em runtime. A ligacao
//! e reconstruida por evidencia, sem chute:
//! 1. recurso: os pixels opacos do sprite (cores reduzidas a 3 bits por canal, como o VDP) tem de
//!    aparecer exatamente numa folha `SPRITE` dos manifestos (com ou sem espelhamento). As
//!    folhas sao pre-filtradas pelas cores: todas as cores do sprite tem de existir na folha;
//! 2. codigo: o simbolo do recurso e procurado nos fontes C indexados. Uma referencia fora de
//!    funcao (tabela/array de recursos) e seguida uma vez pelo nome da tabela, para chegar a
//!    funcao que de fato usa o recurso.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;
use serde::{Deserialize, Serialize};

use crate::core::sgdk_c_graph::{load_c_graph_index, load_indexed_c_graph, CGraphNode};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpriteCodeRef {
    pub file: String,
    pub line: usize,
    pub function: Option<String>,
    pub node_id: Option<String>,
    pub text: String,
    /// Tabela pela qual a referencia foi alcancada (ex.: `ken_sprites[]`), quando indireta.
    pub via: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpriteLink {
    pub resource: String,
    pub sheet: String,
    /// Retangulo do sprite dentro da folha (x, y, largura, altura).
    pub rect: [u32; 4],
    pub flipped: bool,
    pub refs: Vec<SpriteCodeRef>,
}

const TRANSPARENT: u16 = 0xFFFF;

/// Cor reduzida ao espaco do VDP: 3 bits por canal (como o rescomp converte o PNG).
fn md_color(r: u8, g: u8, b: u8) -> u16 {
    ((r as u16 >> 5) << 6) | ((g as u16 >> 5) << 3) | (b as u16 >> 5)
}

/// Mesma reducao para uma cor que veio da CRAM (niveis ~34 por passo).
fn md_color_from_cram(r: u8, g: u8, b: u8) -> u16 {
    let q = |c: u8| ((c as u16 + 17) / 34).min(7);
    (q(r) << 6) | (q(g) << 3) | q(b)
}

struct Sheet {
    name: String,
    path: PathBuf,
    width: usize,
    height: usize,
    pixels: Vec<u16>,
    colors: BTreeSet<u16>,
}

fn load_sheet(name: &str, path: &Path) -> Option<Sheet> {
    let image = image::open(path).ok()?.to_rgba8();
    let (width, height) = (image.width() as usize, image.height() as usize);
    let mut colors = BTreeSet::new();
    let pixels = image
        .pixels()
        .map(|p| {
            if p[3] < 128 {
                TRANSPARENT
            } else {
                let c = md_color(p[0], p[1], p[2]);
                colors.insert(c);
                c
            }
        })
        .collect();
    Some(Sheet {
        name: name.to_string(),
        path: path.to_path_buf(),
        width,
        height,
        pixels,
        colors,
    })
}

/// Pixels opacos (x, y, cor) do sprite; `flip` espelha horizontalmente.
fn opaque_pixels(sprite: &RgbaImage, flip: bool) -> Vec<(usize, usize, u16)> {
    let w = sprite.width() as usize;
    sprite
        .enumerate_pixels()
        .filter(|(_, _, p)| p[3] != 0)
        .map(|(x, y, p)| {
            let x = if flip { w - 1 - x as usize } else { x as usize };
            (x, y as usize, md_color_from_cram(p[0], p[1], p[2]))
        })
        .collect()
}

fn find_in_sheet(
    sheet: &Sheet,
    pixels: &[(usize, usize, u16)],
    w: usize,
    h: usize,
) -> Option<(usize, usize)> {
    if sheet.width < w || sheet.height < h || pixels.is_empty() {
        return None;
    }
    let (fx, fy, fc) = pixels[0];
    for oy in 0..=sheet.height - h {
        for ox in 0..=sheet.width - w {
            if sheet.pixels[(oy + fy) * sheet.width + ox + fx] != fc {
                continue;
            }
            if pixels
                .iter()
                .all(|(x, y, c)| sheet.pixels[(oy + y) * sheet.width + ox + x] == *c)
            {
                return Some((ox, oy));
            }
        }
    }
    None
}

/// Folhas dos recursos SPRITE, decodificadas uma vez por captura.
pub struct SpriteSheets(Vec<Sheet>);

pub fn load_sheets(resources: &[(String, PathBuf)]) -> SpriteSheets {
    SpriteSheets(
        resources
            .iter()
            .filter_map(|(name, path)| load_sheet(name, path))
            .collect(),
    )
}

/// Recurso SPRITE cuja folha contem exatamente o sprite capturado.
pub fn match_sprite_resource(
    sprite: &RgbaImage,
    sheets: &SpriteSheets,
    host_root: &Path,
) -> Option<SpriteLink> {
    let (w, h) = (sprite.width() as usize, sprite.height() as usize);
    let plain = opaque_pixels(sprite, false);
    // Peca quase vazia nao identifica nada.
    if plain.len() < 8 {
        return None;
    }
    let needed: BTreeSet<u16> = plain.iter().map(|p| p.2).collect();
    let flipped = opaque_pixels(sprite, true);
    for sheet in &sheets.0 {
        if !needed.is_subset(&sheet.colors) {
            continue;
        }
        for (pixels, is_flipped) in [(&plain, false), (&flipped, true)] {
            if let Some((x, y)) = find_in_sheet(sheet, pixels, w, h) {
                return Some(SpriteLink {
                    resource: sheet.name.clone(),
                    sheet: sheet
                        .path
                        .strip_prefix(host_root)
                        .unwrap_or(&sheet.path)
                        .to_string_lossy()
                        .replace('\\', "/"),
                    rect: [x as u32, y as u32, w as u32, h as u32],
                    flipped: is_flipped,
                    refs: Vec::new(),
                });
            }
        }
    }
    None
}

fn is_ident(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// Linhas (1-based) com o identificador como palavra inteira, fora de comentario de linha.
fn symbol_lines(text: &str, symbol: &str) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    for (index, line) in text.lines().enumerate() {
        let code = line.split("//").next().unwrap_or("");
        let mut from = 0;
        while let Some(pos) = code[from..].find(symbol) {
            let at = from + pos;
            let before = code[..at].chars().next_back();
            let after = code[at + symbol.len()..].chars().next();
            if !before.is_some_and(is_ident) && !after.is_some_and(is_ident) {
                out.push((index + 1, line.trim().to_string()));
                break;
            }
            from = at + symbol.len();
        }
    }
    out
}

/// Node mais interno que contem a linha e a funcao que o envolve.
fn deepest_at(node: &CGraphNode, line: usize) -> Option<(&CGraphNode, Option<String>)> {
    if line < node.start_line || line > node.end_line {
        return None;
    }
    let here = node.function.clone();
    match node
        .children
        .iter()
        .filter(|child| child.role != "syntax")
        .find_map(|child| deepest_at(child, line))
    {
        Some((inner, function)) => Some((inner, function.or(here))),
        None => Some((node, here)),
    }
}

/// Nome declarado numa linha de tabela/array (`const X *nome[] = {`), procurando para tras.
fn declared_table(lines: &[&str], line: usize) -> Option<String> {
    for index in (line.saturating_sub(64)..line).rev() {
        let text = lines.get(index)?;
        if let Some(eq) = text.find('=') {
            let head = text[..eq].trim_end();
            let head = head.trim_end_matches(|c: char| {
                c == ']' || c.is_ascii_digit() || c == '[' || c.is_whitespace()
            });
            let name: String = head
                .chars()
                .rev()
                .take_while(|c| is_ident(*c))
                .collect::<String>()
                .chars()
                .rev()
                .collect();
            if !name.is_empty() && !name.chars().next().unwrap().is_ascii_digit() {
                return Some(name);
            }
        }
        if text.trim_end().ends_with(';') && index + 1 != line {
            break;
        }
    }
    None
}

/// Referencias do simbolo no C indexado do overlay, seguindo tabelas uma vez.
pub fn code_refs(overlay_dir: &Path, host_root: &Path, symbol: &str) -> Vec<SpriteCodeRef> {
    let Ok(index) = load_c_graph_index(overlay_dir) else {
        return Vec::new();
    };
    let sources: Vec<(String, String)> = index
        .files
        .iter()
        .filter_map(|entry| {
            fs::read_to_string(host_root.join(&entry.source_file))
                .ok()
                .map(|text| (entry.source_file.clone(), text))
        })
        .collect();
    let mut refs = Vec::new();
    let search = |symbol: &str,
                  via: Option<String>,
                  refs: &mut Vec<SpriteCodeRef>,
                  tables: &mut Vec<String>| {
        for (file, text) in &sources {
            let hits = symbol_lines(text, symbol);
            if hits.is_empty() {
                continue;
            }
            let graph = load_indexed_c_graph(overlay_dir, file).ok();
            let lines: Vec<&str> = text.lines().collect();
            for (line, snippet) in hits {
                let found = graph.as_ref().and_then(|g| deepest_at(&g.root, line));
                let node = found.as_ref().map(|(n, _)| *n);
                let function = found.as_ref().and_then(|(_, f)| f.clone());
                if function.is_none() && via.is_none() {
                    if let Some(table) = declared_table(&lines, line) {
                        if table != symbol && !tables.contains(&table) {
                            tables.push(table);
                        }
                    }
                }
                refs.push(SpriteCodeRef {
                    file: file.clone(),
                    line,
                    function,
                    node_id: node.map(|n| n.id.clone()),
                    text: snippet,
                    via: via.clone(),
                });
            }
        }
    };
    let mut tables = Vec::new();
    search(symbol, None, &mut refs, &mut tables);
    for table in tables.clone().into_iter().take(4) {
        search(&table, Some(table.clone()), &mut refs, &mut Vec::new());
    }
    // Usos dentro de funcoes primeiro: e onde o comportamento esta.
    refs.sort_by_key(|r| {
        (
            r.function.is_none(),
            r.via.is_some(),
            r.file.clone(),
            r.line,
        )
    });
    refs.dedup_by(|a, b| a.file == b.file && a.line == b.line);
    refs.truncate(24);
    refs
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn finds_flipped_piece_in_sheet_and_follows_resource_table_to_function() {
        let dir = std::env::temp_dir().join(format!("rds_sprite_link_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("res")).unwrap();
        // Folha 16x8 com uma peca 4x2 em (9,3).
        let mut sheet = RgbaImage::from_pixel(16, 8, Rgba([255, 0, 255, 0]));
        let piece = [[0xE0u8, 0x20, 0x20, 0x00], [0x20, 0xE0, 0xE0, 0xE0]];
        for (y, row) in piece.iter().enumerate() {
            for (x, v) in row.iter().enumerate() {
                if *v != 0 {
                    sheet.put_pixel(9 + x as u32, 3 + y as u32, Rgba([*v, 0, 0, 255]));
                }
            }
        }
        sheet.save(dir.join("res/hero.png")).unwrap();
        // O sprite na tela veio espelhado e com as cores da CRAM (niveis de 34).
        let mut captured = RgbaImage::new(4, 2);
        for (y, row) in piece.iter().enumerate() {
            for (x, v) in row.iter().enumerate() {
                if *v != 0 {
                    let level = (*v as u16 >> 5) as u8 * 34;
                    captured.put_pixel(3 - x as u32, y as u32, Rgba([level, 0, 0, 255]));
                }
            }
        }
        let resources = vec![("spr_hero".to_string(), dir.join("res/hero.png"))];
        // Peca pequena demais nao conta; amplia a amostra repetindo a peca numa folha maior.
        assert!(match_sprite_resource(&captured, &load_sheets(&resources), &dir).is_none());
        let mut big_sheet = RgbaImage::from_pixel(32, 16, Rgba([0, 0, 0, 0]));
        let mut big_capture = RgbaImage::new(8, 4);
        for y in 0..4u32 {
            for x in 0..8u32 {
                let v = [0x20u8, 0x60, 0xA0, 0xE0][((x + y) % 4) as usize];
                big_sheet.put_pixel(20 + x, 5 + y, Rgba([0, v, 0, 255]));
                big_capture.put_pixel(7 - x, y, Rgba([0, (v >> 5) * 34, 0, 255]));
            }
        }
        big_sheet.save(dir.join("res/hero.png")).unwrap();
        let link =
            match_sprite_resource(&big_capture, &load_sheets(&resources), &dir).expect("match");
        assert_eq!(link.resource, "spr_hero");
        assert_eq!(link.sheet, "res/hero.png");
        assert_eq!(link.rect, [20, 5, 8, 4]);
        assert!(link.flipped);

        // Codigo: o recurso esta numa tabela; a tabela e usada numa funcao.
        fs::create_dir_all(dir.join("src")).unwrap();
        let source = "#include <genesis.h>\nconst SpriteDefinition *hero_frames[] = {\n    &spr_hero,\n};\nvoid hero_spawn(void) {\n    SPR_addSprite(hero_frames[0], 10, 20, TILE_ATTR(PAL1, 0, 0, 0));\n}\n";
        fs::write(dir.join("src/hero.c"), source).unwrap();
        let overlay = dir.join("rds");
        fs::create_dir_all(&overlay).unwrap();
        crate::core::sgdk_c_graph::write_c_graph_project(&dir, &overlay).expect("graph");
        let refs = code_refs(&overlay, &dir, "spr_hero");
        let in_fn = refs
            .iter()
            .find(|r| r.function.as_deref() == Some("hero_spawn"))
            .expect("uso na funcao");
        assert_eq!((in_fn.file.as_str(), in_fn.line), ("src/hero.c", 6));
        assert_eq!(in_fn.via.as_deref(), Some("hero_frames"));
        assert!(in_fn.node_id.is_some());
        assert!(refs.iter().any(|r| r.line == 3 && r.function.is_none()));
        let _ = fs::remove_dir_all(&dir);
    }

    /// Liga os sprites de um quadro real (`RDS_PROBE_OUT`) ao projeto SGDK (`RDS_SGDK_HOST`, com
    /// overlay em `<host>/rds`).
    #[test]
    #[ignore]
    fn link_real_capture_sprites() {
        let dir = std::env::var("RDS_PROBE_OUT").expect("probe");
        let host = PathBuf::from(std::env::var("RDS_SGDK_HOST").expect("host"));
        let state = fs::read(format!("{dir}/state.bin")).unwrap();
        let wram = fs::read(format!("{dir}/wram.bin")).unwrap();
        let snapshot = crate::emulator::vdp_snapshot::parse_gpgx_state(&state, &wram).unwrap();
        let started = std::time::Instant::now();
        let sheets = load_sheets(&crate::core::project_mgr::sgdk_sprite_resource_images(
            &host,
        ));
        println!("sheets={} load={:?}", sheets.0.len(), started.elapsed());
        let mut linked = 0;
        for sprite in snapshot.sprites() {
            let image = snapshot.render_sprite(&sprite);
            match match_sprite_resource(&image, &sheets, &host) {
                Some(link) => {
                    linked += 1;
                    let refs = code_refs(&host.join("rds"), &host, &link.resource);
                    let first = refs.iter().find(|r| r.function.is_some());
                    println!(
                        "SAT {} PAL{} -> {} {} {:?} refs={} first_fn={:?}",
                        sprite.slot,
                        sprite.palette,
                        link.resource,
                        link.sheet,
                        link.rect,
                        refs.len(),
                        first.map(|r| (r.file.clone(), r.line, r.function.clone(), r.via.clone()))
                    );
                }
                None => println!("SAT {} PAL{} -> sem recurso", sprite.slot, sprite.palette),
            }
        }
        println!("linked={linked} total={:?}", started.elapsed());
    }
}
