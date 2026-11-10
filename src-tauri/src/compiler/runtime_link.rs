//! Vinculo execucao -> projeto (`retrodev.runtime_link/v1`, Experimental).
//!
//! Gravado pelo build depois da ROM, ao lado do source map: para cada entidade com sprite, onde a
//! posicao e a animacao vivem na RAM (enderecos lidos do ELF do proprio build), quais animacoes e
//! ocorrencias foram compiladas e o deslocamento de cada quadro na tela. O vinculo pertence a UMA
//! ROM (`rom_sha256`); a UI recusa usa-lo com outra ROM, outra epoca do core ou recurso alterado.
//! Slots fisicos do VDP nao sao identidade: a identidade e a entidade do projeto.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::ast_generator::{AstNode, AstOutput};
use crate::ugdm::entities::Scene;

pub const RUNTIME_LINK_SCHEMA: &str = "retrodev.runtime_link/v1";
pub const RUNTIME_LINK_FILE_NAME: &str = "rds-runtime-link.v1.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkSymbols {
    pub x: u32,
    pub y: u32,
    pub anim: Option<u32>,
    pub frame: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkPivot {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkEntity {
    pub entity_id: String,
    pub origin: String,
    pub var_name: String,
    pub frame_width: u32,
    pub frame_height: u32,
    pub pivot: Option<RuntimeLinkPivot>,
    pub symbols: RuntimeLinkSymbols,
    pub animations: Vec<String>,
    pub occurrences: BTreeMap<String, Vec<String>>,
    pub frame_offsets: BTreeMap<String, Vec<(i32, i32)>>,
    /// Asset compilado (caminho no projeto) e SHA-256 do arquivo no momento do build.
    pub asset: String,
    pub asset_sha256: Option<String>,
    /// Por animacao, por ocorrencia: (indice da imagem, grupo SFF, imagem SFF); -1 sem MUGEN.
    pub occurrence_images: BTreeMap<String, Vec<(i32, i32, i32)>>,
    /// Por animacao, por ocorrencia: caixas compiladas (ataque, corpo) relativas ao eixo, normalizadas.
    #[serde(default)]
    pub occurrence_boxes: BTreeMap<String, Vec<RuntimeLinkBoxes>>,
    /// Eventos na ordem da tabela da ROM (`evlast` indexa esta lista) e contadores na RAM.
    #[serde(default)]
    pub events: BTreeMap<String, Vec<RuntimeLinkEvent>>,
    #[serde(default)]
    pub event_symbols: Option<RuntimeLinkEventSymbols>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkBoxes {
    pub attack: Vec<[i32; 4]>,
    pub body: Vec<[i32; 4]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkEvent {
    pub id: String,
    pub occurrence: String,
    pub tick: u32,
    pub sound: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkEventSymbols {
    pub fired: u32,
    pub last: u32,
    /// Animacao (indice) em que o ultimo evento disparou.
    pub last_anim: u32,
}

/// Mapa de colisao fisica compilado (celulas solidas), em pixels de mundo.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkCollision {
    pub tile_width: u32,
    pub tile_height: u32,
    pub width: u32,
    pub height: u32,
    pub solid: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkTilemap {
    pub entity_id: String,
    pub x: i32,
    pub y: i32,
    pub width_px: u32,
    pub height_px: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkCamera {
    pub x: u32,
    pub y: u32,
}

/// Texto de interface: retangulo na tela (pixels) e simbolo do valor exibido, se ligado.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkHud {
    pub entity_id: String,
    pub x: u32,
    pub y: u32,
    pub width_px: u32,
    pub height_px: u32,
    pub shown_symbol: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLink {
    pub schema: String,
    pub target: String,
    pub rom_sha256: String,
    pub generated_source_sha256: String,
    pub entities: Vec<RuntimeLinkEntity>,
    pub tilemaps: Vec<RuntimeLinkTilemap>,
    #[serde(default)]
    pub hud: Vec<RuntimeLinkHud>,
    /// Enderecos de `rds_camera_x/y` quando a cena tem camera seguindo (mundo - camera = tela).
    #[serde(default)]
    pub camera: Option<RuntimeLinkCamera>,
    #[serde(default)]
    pub collision: Option<RuntimeLinkCollision>,
    /// Bancos por entidade e simbolos das trocas, do plano de paletas usado no build (nao e
    /// leitura da memoria de cor).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub palette: Option<RuntimeLinkPalette>,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkPaletteSwap {
    pub id: String,
    pub target_entity: String,
    pub palette: String,
    pub bank: usize,
    pub affected_uses: Vec<String>,
    pub frames: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count_symbol: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_symbol: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restores_symbol: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeLinkPalette {
    pub schema: String,
    /// Entidade -> (banco, recurso, nome).
    pub entities: BTreeMap<String, (usize, String, String)>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_bank: Option<usize>,
    pub swaps: Vec<RuntimeLinkPaletteSwap>,
    pub evidence: String,
}

pub fn palette_link(
    plan: &crate::compiler::palette_plan::PalettePlan,
    symbols: &BTreeMap<String, u32>,
) -> RuntimeLinkPalette {
    let mut entities = BTreeMap::new();
    for r in &plan.resources {
        if let Some(bank) = r.bank {
            for u in &r.uses {
                entities.insert(u.entity_id.clone(), (bank, r.id.clone(), r.name.clone()));
            }
        }
    }
    RuntimeLinkPalette {
        schema: plan.schema.clone(),
        entities,
        text_bank: plan.text_bank,
        swaps: plan
            .swaps
            .iter()
            .filter(|s| s.ok)
            .filter_map(|s| {
                Some(RuntimeLinkPaletteSwap {
                    id: s.id.clone(),
                    target_entity: s.target_entity.clone(),
                    palette: s.palette.clone(),
                    bank: s.bank?,
                    affected_uses: s.affected_uses.clone(),
                    frames: s.frames,
                    count_symbol: symbols.get(&format!("rds_palswap_{}_count", s.id)).copied(),
                    left_symbol: symbols.get(&format!("rds_palswap_{}_left", s.id)).copied(),
                    restores_symbol: symbols
                        .get(&format!("rds_palswap_{}_restores", s.id))
                        .copied(),
                })
            })
            .collect(),
        evidence: "plano usado no build; a memoria de cor (CRAM) nao e lida".to_string(),
    }
}

/// Simbolos de um ELF32 big-endian (m68k): nome -> endereco.
pub fn elf32_symbols(elf: &[u8]) -> Result<BTreeMap<String, u32>, String> {
    let r16 = |o: usize| -> Result<u16, String> {
        elf.get(o..o + 2)
            .map(|b| u16::from_be_bytes([b[0], b[1]]))
            .ok_or_else(|| "ELF truncado".to_string())
    };
    let r32 = |o: usize| -> Result<u32, String> {
        elf.get(o..o + 4)
            .map(|b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
            .ok_or_else(|| "ELF truncado".to_string())
    };
    if elf.len() < 52 || &elf[0..4] != b"\x7fELF" || elf[4] != 1 || elf[5] != 2 {
        return Err("rom.out nao e ELF32 big-endian".to_string());
    }
    let sh_off = r32(32)? as usize;
    let sh_size = r16(46)? as usize;
    let sh_count = r16(48)? as usize;
    let mut out = BTreeMap::new();
    for i in 0..sh_count {
        let sec = sh_off + i * sh_size;
        if r32(sec + 4)? != 2 {
            continue;
        }
        let table = r32(sec + 16)? as usize;
        let size = r32(sec + 20)? as usize;
        let strtab_sec = sh_off + r32(sec + 24)? as usize * sh_size;
        let strings = r32(strtab_sec + 16)? as usize;
        let mut c = table;
        while c + 16 <= table + size {
            let name_off = r32(c)? as usize;
            if name_off != 0 {
                let start = strings + name_off;
                let end = elf[start..]
                    .iter()
                    .position(|b| *b == 0)
                    .map(|p| start + p)
                    .ok_or_else(|| "nome de simbolo sem terminador".to_string())?;
                out.insert(
                    String::from_utf8_lossy(&elf[start..end]).into_owned(),
                    r32(c + 4)?,
                );
            }
            c += 16;
        }
    }
    Ok(out)
}

/// Monta o vinculo a partir da cena compilada, do AST e dos simbolos do ELF.
pub fn build_runtime_link(
    scene: &Scene,
    ast: &AstOutput,
    target: &str,
    rom_sha256: &str,
    generated_source_sha256: &str,
    symbols: &BTreeMap<String, u32>,
    asset_sha256: &dyn Fn(&str) -> Option<String>,
) -> RuntimeLink {
    let mut limitations = vec![
        "Retangulo de selecao = celula do quadro (inclui transparencia); escolha entre sobrepostos na UI.".to_string(),
        "Posicao na tela = posicao no mundo (RAM) - camera (quando a cena tem camera).".to_string(),
    ];
    let spawns: Vec<(&String, &String)> = ast
        .nodes
        .iter()
        .filter_map(|node| match node {
            AstNode::SpawnSprite {
                var_name,
                resource_name,
                ..
            } => Some((var_name, resource_name)),
            _ => None,
        })
        .collect();
    let sprite_entities: Vec<_> = scene
        .entities
        .iter()
        .filter(|e| e.components.sprite.is_some())
        .collect();
    let mut entities = Vec::new();
    if spawns.len() != sprite_entities.len() {
        limitations.push(format!(
            "Correspondencia entidade->sprite indisponivel ({} entidades com sprite, {} sprites gerados); nenhuma entidade vinculada.",
            sprite_entities.len(),
            spawns.len()
        ));
    } else {
        for (entity, (var, resource)) in sprite_entities.iter().zip(spawns) {
            let sprite = entity.components.sprite.as_ref().expect("filtrado");
            let (Some(x), Some(y)) = (
                symbols.get(&format!("{var}_x")),
                symbols.get(&format!("{var}_y")),
            ) else {
                limitations.push(format!(
                    "Entidade '{}': posicao sem simbolo no ELF; fora do vinculo.",
                    entity.entity_id
                ));
                continue;
            };
            let asset = ast
                .sprite_assets
                .iter()
                .find(|a| &a.resource_name == resource);
            let mugen = asset.is_some_and(|a| a.animations.iter().any(|an| an.mugen.is_some()));
            let mut animations = Vec::new();
            let mut occurrences = BTreeMap::new();
            let mut frame_offsets = BTreeMap::new();
            let mut occurrence_images = BTreeMap::new();
            let mut occurrence_boxes = BTreeMap::new();
            let mut events = BTreeMap::new();
            if let Some(asset) = asset {
                for an in &asset.animations {
                    animations.push(an.name.clone());
                    if let Some(def) = sprite.animations.get(&an.name) {
                        if let Ok(ids) = super::ast_generator::animation_occurrence_ids(def) {
                            occurrences.insert(an.name.clone(), ids);
                        }
                        let images = def
                            .frames
                            .iter()
                            .enumerate()
                            .map(|(i, image)| {
                                let source = def.mugen_frames.as_ref().and_then(|m| m.get(i));
                                (
                                    *image as i32,
                                    source.map(|f| f.group).unwrap_or(-1),
                                    source.map(|f| f.image).unwrap_or(-1),
                                )
                            })
                            .collect();
                        occurrence_images.insert(an.name.clone(), images);
                    }
                    if let Some(Ok(t)) = &an.mugen {
                        let norm = |b: &[i32; 4]| {
                            [
                                b[0].min(b[2]),
                                b[1].min(b[3]),
                                b[0].max(b[2]),
                                b[1].max(b[3]),
                            ]
                        };
                        occurrence_boxes.insert(
                            an.name.clone(),
                            t.frames
                                .iter()
                                .map(|f| RuntimeLinkBoxes {
                                    attack: f.clsn1.iter().map(norm).collect(),
                                    body: f.clsn2.iter().map(norm).collect(),
                                })
                                .collect(),
                        );
                        let ids = occurrences.get(&an.name).cloned().unwrap_or_default();
                        events.insert(
                            an.name.clone(),
                            t.events
                                .iter()
                                .map(|e| RuntimeLinkEvent {
                                    id: e.id.clone(),
                                    occurrence: ids.get(e.frame).cloned().unwrap_or_default(),
                                    tick: e.tick,
                                    sound: e.sound.clone(),
                                })
                                .collect(),
                        );
                        let flip_x = 2 * t.anchor.0 - t.cell.0 as i32;
                        let flip_y = 2 * t.anchor.1 - t.cell.1 as i32;
                        frame_offsets.insert(
                            an.name.clone(),
                            t.frames
                                .iter()
                                .map(|f| {
                                    (
                                        f.dx + if f.hflip { flip_x } else { 0 },
                                        f.dy + if f.vflip { flip_y } else { 0 },
                                    )
                                })
                                .collect(),
                        );
                    }
                }
            }
            let (anim, frame) = if mugen {
                (
                    symbols.get(&format!("rds_mugen_{var}_anim")).copied(),
                    symbols.get(&format!("rds_mugen_{var}_frame")).copied(),
                )
            } else {
                (None, None)
            };
            entities.push(RuntimeLinkEntity {
                entity_id: entity.entity_id.clone(),
                origin: if mugen { "mugen" } else { "authored" }.to_string(),
                var_name: var.clone(),
                frame_width: sprite.frame_width,
                frame_height: sprite.frame_height,
                pivot: sprite
                    .pivot
                    .as_ref()
                    .map(|p| RuntimeLinkPivot { x: p.x, y: p.y }),
                symbols: RuntimeLinkSymbols {
                    x: *x,
                    y: *y,
                    anim,
                    frame,
                },
                animations,
                occurrences,
                frame_offsets,
                asset: sprite.asset.clone(),
                asset_sha256: asset_sha256(&sprite.asset),
                occurrence_images,
                occurrence_boxes,
                events,
                event_symbols: match (
                    symbols.get(&format!("rds_mugen_{var}_evfired")),
                    symbols.get(&format!("rds_mugen_{var}_evlast")),
                    symbols.get(&format!("rds_mugen_{var}_evlast_anim")),
                ) {
                    (Some(fired), Some(last), Some(last_anim)) => Some(RuntimeLinkEventSymbols {
                        fired: *fired,
                        last: *last,
                        last_anim: *last_anim,
                    }),
                    _ => None,
                },
            });
        }
    }
    let draws: Vec<(i32, i32, &String)> = ast
        .nodes
        .iter()
        .filter_map(|node| match node {
            AstNode::DrawTilemap {
                x,
                y,
                resource_name,
                ..
            } => Some((*x, *y, resource_name)),
            _ => None,
        })
        .collect();
    let tilemap_entities: Vec<_> = scene
        .entities
        .iter()
        .filter(|e| e.components.tilemap.is_some())
        .collect();
    let mut tilemaps = Vec::new();
    if draws.len() == tilemap_entities.len() {
        for (entity, (x, y, _)) in tilemap_entities.iter().zip(draws) {
            let tilemap = entity.components.tilemap.as_ref().expect("filtrado");
            if tilemap.scroll_x != 0 || tilemap.scroll_y != 0 {
                limitations.push(format!(
                    "Tilemap '{}': rolagem do plano nao considerada na selecao.",
                    entity.entity_id
                ));
            }
            // O emissor desenha em grade de 8 px (VDP_drawImageEx em tiles).
            tilemaps.push(RuntimeLinkTilemap {
                entity_id: entity.entity_id.clone(),
                x: (x.max(0) / 8) * 8,
                y: (y.max(0) / 8) * 8,
                width_px: tilemap.map_width * 8,
                height_px: tilemap.map_height * 8,
            });
        }
    } else {
        limitations
            .push("Correspondencia de tilemaps indisponivel; cenario fora do vinculo.".to_string());
    }
    let hud = super::hud_runtime::collect_huds(ast)
        .into_iter()
        .map(|h| {
            let chars = h.label.chars().count() as u32
                + if h.binding.is_some() {
                    h.digits as u32
                } else {
                    0
                };
            RuntimeLinkHud {
                shown_symbol: symbols.get(&format!("rds_hud_{}_shown", h.id)).copied(),
                entity_id: h.entity_id,
                x: h.column * 8,
                y: h.row * 8,
                width_px: chars * 8,
                height_px: 8,
            }
        })
        .collect();
    RuntimeLink {
        schema: RUNTIME_LINK_SCHEMA.to_string(),
        target: target.to_string(),
        rom_sha256: rom_sha256.to_string(),
        generated_source_sha256: generated_source_sha256.to_string(),
        entities,
        tilemaps,
        hud,
        palette: None,
        collision: scene.collision_map.as_ref().map(|map| {
            let data = map.normalize();
            RuntimeLinkCollision {
                tile_width: u32::from(map.tile_width),
                tile_height: u32::from(map.tile_height),
                width: map.width,
                height: map.height,
                solid: data
                    .iter()
                    .enumerate()
                    .filter(|(_, v)| **v != 0)
                    .map(|(i, _)| i as u32)
                    .collect(),
            }
        }),
        camera: match (symbols.get("rds_camera_x"), symbols.get("rds_camera_y")) {
            (Some(x), Some(y)) => Some(RuntimeLinkCamera { x: *x, y: *y }),
            _ => None,
        },
        limitations,
    }
}
