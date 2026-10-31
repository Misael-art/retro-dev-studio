//! ROM → pasta de projeto SGDK recuperado (motor; nenhuma referência a jogo).
//!
//! Junta o que os motores já provam — recursos por forma (`rex_sgdk_resources`) e
//! funções de biblioteca por assinatura (`rex_libsig`) — numa árvore que o importador
//! SGDK do Studio entende (`res/*.res` + PNG indexado + binários), e num manifesto que
//! diz, byte a byte, o que foi atribuído e o que continua desconhecido.
//!
//! Nada é inventado: código de jogo não reconhecido NÃO vira C; fica como região
//! desconhecida no mapa de cobertura, preservada pela ROM original (BYOR).

use serde::Serialize;
use std::path::Path;

use super::rex_libsig::{scan, LibMatch, LibSigDictionary};
use super::rex_sgdk_resources::{image_png, recover_graph, SgdkResourceGraph};

#[derive(Debug, Clone, Serialize)]
pub struct CoverageRange {
    pub start: u32,
    pub end: u32,
    pub kind: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectManifest {
    pub schema: &'static str,
    pub rom_sha256: String,
    pub rom_size: usize,
    pub header_title: String,
    pub evidence: &'static str,
    pub images: usize,
    pub sprites: usize,
    pub sprite_frames: usize,
    pub music: usize,
    pub library_functions: usize,
    pub code_functions: usize,
    pub code_functions_strict: usize,
    /// Bytes da ROM atribuídos a recursos/bibliotecas recuperados (sem dupla contagem).
    /// Código descoberto fica fora desta métrica: alcançar instruções não é recuperá-las.
    pub attributed_bytes: usize,
    /// Bytes de instrução alcançados pela descoberta de fluxo (medida separada).
    pub code_discovered_bytes: usize,
    pub coverage_ratio: f64,
    pub ranges: Vec<CoverageRange>,
    pub library: Vec<LibMatch>,
    pub limits: Vec<&'static str>,
}

fn header_title(rom: &[u8]) -> String {
    rom.get(0x150..0x180)
        .map(|b| {
            String::from_utf8_lossy(b)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        })
        .unwrap_or_default()
}

/// Faixas de bytes efetivamente cobertas por cada item recuperado.
fn coverage(graph: &SgdkResourceGraph, rom: &[u8], lib: &[LibMatch]) -> Vec<CoverageRange> {
    let mut r = Vec::new();
    let mut push = |start: usize, len: usize, kind: &str, label: String| {
        r.push(CoverageRange {
            start: start as u32,
            end: (start + len) as u32,
            kind: kind.into(),
            label,
        });
    };
    for img in &graph.images {
        let label = format!("image_{:06x}", img.header_offset);
        push(img.header_offset as usize, 12, "image", label.clone());
        push(
            img.palette.header_offset as usize,
            img.palette.header_bytes(),
            "palette",
            label.clone(),
        );
        push(
            img.palette.data_offset as usize,
            img.palette.colors.len() * 2,
            "palette_data",
            label.clone(),
        );
        push(
            img.tileset.header_offset as usize,
            8,
            "tileset",
            label.clone(),
        );
        let ts = &img.tileset;
        push(
            ts.stream_offset as usize,
            ts.stream_bytes as usize,
            "tiles",
            label.clone(),
        );
        push(
            img.tilemap.header_offset as usize,
            10,
            "tilemap",
            label.clone(),
        );
        let tm = &img.tilemap;
        push(
            tm.stream_offset as usize,
            tm.stream_bytes as usize,
            "tilemap_data",
            label.clone(),
        );
    }
    for sp in &graph.sprites {
        let label = format!("sprite_{:06x}", sp.header_offset);
        push(sp.header_offset as usize, 14, "sprite", label.clone());
        push(
            sp.palette.data_offset as usize,
            sp.palette.colors.len() * 2,
            "palette_data",
            label.clone(),
        );
        for anim in &sp.animations {
            for f in &anim.frames {
                let ts = &f.tileset;
                push(ts.header_offset as usize, 8, "tileset", label.clone());
                push(
                    ts.stream_offset as usize,
                    ts.stream_bytes as usize,
                    "tiles",
                    label.clone(),
                );
            }
        }
    }
    for (i, x) in graph.music.iter().enumerate() {
        push(
            x.offset as usize,
            x.len as usize,
            "music_xgc",
            format!("music_{i:02}"),
        );
    }
    for m in lib {
        push(
            m.addr as usize,
            m.size as usize,
            "library_code",
            m.name.clone(),
        );
    }
    push(
        0,
        0x200.min(rom.len()),
        "header_vectors",
        "vectors+header".into(),
    );
    r.retain(|c| c.end > c.start && (c.end as usize) <= rom.len());
    r.sort_by_key(|c| (c.start, c.end));
    r
}

fn union_len(ranges: &[CoverageRange]) -> usize {
    let mut total = 0usize;
    let mut cur: Option<(u32, u32)> = None;
    for c in ranges {
        match cur {
            Some((s, e)) if c.start <= e => cur = Some((s, e.max(c.end))),
            Some((s, e)) => {
                total += (e - s) as usize;
                cur = Some((c.start, c.end));
            }
            None => cur = Some((c.start, c.end)),
        }
    }
    if let Some((s, e)) = cur {
        total += (e - s) as usize;
    }
    total
}

/// Função do esqueleto lógico: camada de evidência, nome e o que ela referencia.
#[derive(Debug, Clone, Serialize)]
pub struct LogicFunction {
    pub start: u32,
    pub name: String,
    /// `estrita` (descida a partir dos vetores) ou `operando` (ponteiro em operando).
    pub tier: &'static str,
    pub code_bytes: u32,
    pub calls: Vec<String>,
    pub resources: Vec<String>,
    pub strings: Vec<String>,
    pub has_indirect: bool,
}

fn c_string_at(rom: &[u8], at: usize) -> Option<String> {
    let bytes = rom.get(at..)?;
    let end = bytes.iter().take(96).position(|b| *b == 0)?;
    let s = &bytes[..end];
    (s.len() >= 4 && s.iter().all(|b| (0x20..0x7F).contains(b)))
        .then(|| String::from_utf8_lossy(s).into_owned())
}

/// Constrói o esqueleto lógico e devolve também as faixas de código descobertas.
pub fn logic_skeleton(
    rom: &[u8],
    graph: &SgdkResourceGraph,
    library: &[LibMatch],
) -> (Vec<LogicFunction>, Vec<(u32, u32)>) {
    use super::rex_m68k_flow::{discover, discover_with_operand_seeds, vector_seeds};
    use std::collections::HashMap;
    let mut exclude: Vec<(u32, u32)> = Vec::new();
    let mut names: HashMap<u32, String> = HashMap::new();
    for img in &graph.images {
        let n = format!("img_{:06x}", img.header_offset);
        exclude.push((
            img.tileset.stream_offset,
            img.tileset.stream_offset + img.tileset.stream_bytes,
        ));
        exclude.push((
            img.tilemap.stream_offset,
            img.tilemap.stream_offset + img.tilemap.stream_bytes,
        ));
        for a in [
            img.header_offset,
            img.palette.header_offset,
            img.tileset.header_offset,
            img.tilemap.header_offset,
        ] {
            names.entry(a).or_insert_with(|| n.clone());
        }
    }
    for sp in &graph.sprites {
        let n = format!("spr_{:06x}", sp.header_offset);
        names.entry(sp.header_offset).or_insert_with(|| n.clone());
        names
            .entry(sp.palette.header_offset)
            .or_insert_with(|| n.clone());
        for f in sp.animations.iter().flat_map(|a| &a.frames) {
            exclude.push((
                f.tileset.stream_offset,
                f.tileset.stream_offset + f.tileset.stream_bytes,
            ));
        }
    }
    for (i, m) in graph.music.iter().enumerate() {
        exclude.push((m.offset, m.offset + m.len));
        names.insert(m.offset, format!("music_{i:02}"));
    }
    let lib: HashMap<u32, &str> = library.iter().map(|m| (m.addr, m.name.as_str())).collect();
    let strict: std::collections::HashSet<u32> =
        discover(rom, &vector_seeds(rom), rom.len() as u32)
            .functions
            .iter()
            .map(|f| f.start)
            .collect();
    let map = discover_with_operand_seeds(rom, rom.len() as u32, &exclude);
    let fname = |a: u32| {
        lib.get(&a)
            .map_or_else(|| format!("fn_{a:06x}"), |n| (*n).to_string())
    };
    let funcs = map
        .functions
        .iter()
        .map(|f| LogicFunction {
            start: f.start,
            name: fname(f.start),
            tier: if strict.contains(&f.start) {
                "estrita"
            } else {
                "operando"
            },
            code_bytes: f.code_bytes,
            calls: f.calls.iter().map(|c| fname(*c)).collect(),
            resources: f
                .refs
                .iter()
                .filter_map(|r| names.get(r).cloned())
                .collect(),
            strings: f
                .refs
                .iter()
                .filter_map(|r| c_string_at(rom, *r as usize))
                .collect(),
            has_indirect: f.has_indirect,
        })
        .collect();
    (funcs, map.ranges)
}

/// Escreve o projeto recuperado em `out` e devolve o manifesto.
pub fn write_recovered_project(
    rom: &[u8],
    dict: Option<&LibSigDictionary>,
    out: &Path,
) -> std::io::Result<ProjectManifest> {
    let graph = recover_graph(rom);
    let library = dict.map(|d| scan(d, rom)).unwrap_or_default();
    for sub in ["res/img", "res/spr", "res/music", "rex"] {
        std::fs::create_dir_all(out.join(sub))?;
    }
    let mut res = String::from(
        "// Recursos recuperados da ROM por forma de estrutura (REX, Experimental).\n\
         // Sintaxe SGDK 2.11. Música: binário XGC original (XGM_startPlay), alinhado a 256.\n\n",
    );
    for img in &graph.images {
        let name = format!("img_{:06x}", img.header_offset);
        std::fs::write(out.join(format!("res/img/{name}.png")), image_png(img))?;
        res.push_str(&format!(
            "IMAGE {name} \"img/{name}.png\" {} NONE\n",
            img.tileset.compression.to_uppercase()
        ));
    }
    let mut frames = 0usize;
    for sp in &graph.sprites {
        let name = format!("spr_{:06x}", sp.header_offset);
        std::fs::write(out.join(format!("res/spr/{name}.png")), sp.sheet_png().2)?;
        let (cw, ch, _, _) = sp.sheet_cell();
        let timer = sp
            .animations
            .first()
            .and_then(|a| a.frames.first())
            .map(|f| f.timer)
            .unwrap_or(0);
        frames += sp.animations.iter().map(|a| a.frames.len()).sum::<usize>();
        res.push_str(&format!(
            "SPRITE {name} \"spr/{name}.png\" {} {} NONE {timer}\n",
            cw.div_ceil(8),
            ch.div_ceil(8)
        ));
    }
    for (i, x) in graph.music.iter().enumerate() {
        let name = format!("music_{i:02}");
        std::fs::write(
            out.join(format!("res/music/{name}.xgc")),
            &rom[x.offset as usize..(x.offset + x.len) as usize],
        )?;
        res.push_str(&format!(
            "BIN {name} \"music/{name}.xgc\" 256 256 0 NONE FALSE\n"
        ));
    }
    std::fs::write(out.join("res/recovered.res"), res)?;
    let (logic, code_ranges) = logic_skeleton(rom, &graph, &library);
    let mut ranges = coverage(&graph, rom, &library);
    let attributed = union_len(&ranges);
    ranges.extend(code_ranges.iter().map(|(s, e)| CoverageRange {
        start: *s,
        end: *e,
        kind: "code".into(),
        label: "descoberto".into(),
    }));
    ranges.sort_by_key(|c| (c.start, c.end));
    let code_discovered: usize = code_ranges.iter().map(|(s, e)| (e - s) as usize).sum();
    let manifest = ProjectManifest {
        schema: "rex-sgdk-project/v1",
        rom_sha256: super::fingerprint::sha256_hex(rom),
        rom_size: rom.len(),
        header_title: header_title(rom),
        evidence: "L2 (consistência estrutural); nenhum item tem consumo observado",
        images: graph.images.len(),
        sprites: graph.sprites.len(),
        sprite_frames: frames,
        music: graph.music.len(),
        library_functions: library.len(),
        code_functions: logic.len(),
        code_functions_strict: logic.iter().filter(|f| f.tier == "estrita").count(),
        attributed_bytes: attributed,
        code_discovered_bytes: code_discovered,
        coverage_ratio: attributed as f64 / rom.len().max(1) as f64,
        ranges,
        library,
        limits: vec![
            "código de jogo não é convertido em C: há esqueleto (funções, chamadas, xrefs) em rex/logic.json",
            "despacho indireto (tabelas de salto, ponteiros carregados de dados) não é seguido",
            "música XGM2, PCM avulso, fontes e mapas de nível fora de Image ainda não recuperados",
            "SPRITE usa timer do 1º quadro; timers por quadro ficam no manifesto do grafo",
        ],
    };
    std::fs::write(
        out.join("rex/manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap_or_default(),
    )?;
    std::fs::write(
        out.join("rex/graph.json"),
        serde_json::to_string_pretty(&graph).unwrap_or_default(),
    )?;
    std::fs::write(
        out.join("rex/logic.json"),
        serde_json::to_string_pretty(&logic).unwrap_or_default(),
    )?;
    let plan = super::rex_sgdk_rebuild::plan(rom, &graph);
    super::rex_sgdk_rebuild::write_plan(rom, &plan, out)?;
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn union_counts_overlaps_once() {
        let r = |s, e| CoverageRange {
            start: s,
            end: e,
            kind: String::new(),
            label: String::new(),
        };
        assert_eq!(union_len(&[r(0, 10), r(5, 20), r(30, 40)]), 30);
        assert_eq!(union_len(&[]), 0);
    }

    #[test]
    #[ignore = "BYOR: RDS_REX_ROM, RDS_REX_OUT, RDS_LIBSIG_DICT opcional"]
    fn write_project_from_rom() {
        let path = std::env::var("RDS_REX_ROM").expect("RDS_REX_ROM ausente: corpus obrigatório");
        let rom = std::fs::read(&path).unwrap_or_else(|e| panic!("ROM {path}: {e}"));
        let dict: Option<LibSigDictionary> = std::env::var("RDS_LIBSIG_DICT")
            .ok()
            .map(|p| serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap());
        let out =
            std::path::PathBuf::from(std::env::var("RDS_REX_OUT").expect("RDS_REX_OUT ausente"));
        let m = write_recovered_project(&rom, dict.as_ref(), &out).unwrap();
        let rebuilt = super::super::rex_sgdk_rebuild::rebuild(&out).unwrap();
        let sha = super::super::fingerprint::sha256_hex(&rom);
        // Gate de conservação: no-op tem de restituir a ROM byte a byte.
        assert_eq!(rebuilt.len(), rom.len(), "tamanho remontado diverge");
        assert!(rebuilt == rom, "no-op não é byte-exato");
        assert_eq!(super::super::fingerprint::sha256_hex(&rebuilt), sha);
        // Prova de edição: 1 pixel numa Image regenerada => exatamente 1 byte de tile muda.
        let plan: super::super::rex_sgdk_rebuild::RebuildPlan =
            serde_json::from_str(&std::fs::read_to_string(out.join("rex/rebuild.json")).unwrap())
                .unwrap();
        let mut graph = recover_graph(&rom);
        let target = plan.emitters.iter().find_map(|e| match e {
            super::super::rex_sgdk_rebuild::Emitter::Tiles {
                offset, png, tiles, ..
            } if png.starts_with("res/img/") => Some((*offset, png.clone(), tiles[0].clone())),
            _ => None,
        });
        // ROM sem Image regenerável não tem prova de edição: o chamador decide se exige.
        let require_edit = std::env::var_os("RDS_REX_REQUIRE_EDIT").is_some();
        let has_target = target.is_some();
        assert!(
            has_target || !require_edit,
            "nenhuma Image regenerável: prova de edição ausente"
        );
        if let Some((offset, png, src)) = target {
            let img = graph
                .images
                .iter_mut()
                .find(|i| i.tileset.stream_offset == offset)
                .unwrap();
            let original = std::fs::read(out.join(&png)).unwrap();
            // pixel (0,0) do tile 0, desfazendo o flip da célula-fonte
            let col = if src.hflip { 7 } else { 0 };
            let row = if src.vflip { 7 } else { 0 };
            let at = row * 4 + col / 2;
            let shift = if col % 2 == 0 { 4 } else { 0 };
            let cur = (img.tileset.tiles[at] >> shift) & 0x0F;
            let line = usize::from(src.pal_line) * 16;
            let next = (1..16u8)
                .find(|i| {
                    *i != cur
                        && img.palette.colors[line + *i as usize]
                            != img.palette.colors[line + cur as usize]
                })
                .unwrap();
            img.tileset.tiles[at] = (img.tileset.tiles[at] & !(0x0F << shift)) | (next << shift);
            std::fs::write(
                out.join(&png),
                super::super::rex_sgdk_resources::image_png(img),
            )
            .unwrap();
            let edited = super::super::rex_sgdk_rebuild::rebuild(&out).unwrap();
            let diffs: Vec<usize> = (0..rom.len()).filter(|i| edited[*i] != rom[*i]).collect();
            println!(
                "edicao 1 pixel: bytes alterados={:?} esperado=[{:#x}]",
                diffs.iter().map(|d| format!("{d:#x}")).collect::<Vec<_>>(),
                offset as usize + at
            );
            assert_eq!(diffs, vec![offset as usize + at]);
            std::fs::write(out.join(&png), original).unwrap();
            let reverted = super::super::rex_sgdk_rebuild::rebuild(&out).unwrap();
            assert!(reverted == rom, "reverter a edição não restituiu a ROM");
        }
        println!("remontagem identica=true sha={sha} edicao={has_target}");
        println!(
            "projeto {} images={} sprites={} frames={} music={} lib={} funcs={} (estritas {}) recursos={:.3} ({} / {} bytes) codigo_alcancado={}",
            m.header_title, m.images, m.sprites, m.sprite_frames, m.music, m.library_functions, m.code_functions, m.code_functions_strict,
            m.coverage_ratio, m.attributed_bytes, m.rom_size, m.code_discovered_bytes
        );
    }
}
