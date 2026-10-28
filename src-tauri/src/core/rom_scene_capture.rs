//! Cena capturada da ROM em execucao (Experimental).
//!
//! Em projetos cujo jogo e montado pelo C em runtime (tilesets em fita, tiles colocados por
//! codigo), os recursos isolados nao mostram a tela. A captura le o VDP do core
//! (`emulator::vdp_snapshot`) e grava uma cena do Studio com o que o jogo exibe naquele
//! quadro: plano B, plano A e cada sprite da SAT como imagem posicionada. E referencia
//! visual fiel ao quadro; nao altera o C nem a ROM.

use std::fs;
use std::path::Path;

use serde::Serialize;
use serde_json::json;

use crate::emulator::vdp_snapshot::{VdpPlane, VdpSnapshot};

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct RomSceneCapture {
    pub scene_path: String,
    pub scene_id: String,
    pub sprite_count: usize,
    pub vram_used_bytes: u32,
    pub width: u32,
    pub height: u32,
}

fn slug(name: &str) -> String {
    let mut out = String::new();
    for ch in name.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if !out.ends_with('_') {
            out.push('_');
        }
    }
    let out = out.trim_matches('_').to_string();
    if out.is_empty() {
        "captura".to_string()
    } else {
        out
    }
}

struct ImageEntity<'a> {
    id: &'a str,
    name: &'a str,
    asset: &'a str,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    hint: &'a str,
    priority: &'a str,
    palette_line: usize,
}

fn image_entity(e: ImageEntity) -> serde_json::Value {
    let ImageEntity {
        id,
        name,
        asset,
        x,
        y,
        width: w,
        height: h,
        hint,
        priority,
        palette_line,
    } = e;
    json!({
        "entity_id": id,
        "display_name": name,
        "prefab": null,
        "transform": { "x": x, "y": y },
        "components": {
            "sprite": {
                "asset": asset,
                "frame_width": w,
                "frame_height": h,
                "pivot": null,
                "palette_slot": 0,
                "animations": {},
                "priority": priority,
                "meta_sprite": false
            },
            "collision": null,
            "input": null,
            "physics": null,
            "audio": null,
            "logic": { "logic_hints": [hint, format!("rom_capture:pal{palette_line}")], "variables": {} },
            "camera": null,
            "tilemap": null
        }
    })
}

/// Grava `assets/rom_capture/<slug>/*.png` e `scenes/rom_capture_<slug>.json`.
/// Recusa sobrescrever uma captura existente com o mesmo nome.
pub fn write_rom_capture_scene(
    project_dir: &Path,
    name: &str,
    snapshot: &VdpSnapshot,
) -> Result<RomSceneCapture, String> {
    let slug = slug(name);
    let scene_id = format!("rom_capture_{slug}");
    let scene_rel = format!("scenes/{scene_id}.json");
    let scene_path = project_dir.join(&scene_rel);
    if scene_path.exists() {
        return Err(format!(
            "Ja existe uma captura '{scene_rel}'; escolha outro nome."
        ));
    }
    let asset_dir_rel = format!("assets/rom_capture/{slug}");
    let asset_dir = project_dir.join(&asset_dir_rel);
    fs::create_dir_all(&asset_dir)
        .map_err(|e| format!("Falha ao criar '{}': {e}", asset_dir.display()))?;
    let save = |image: &image::RgbaImage, file: &str| -> Result<String, String> {
        image
            .save(asset_dir.join(file))
            .map_err(|e| format!("Falha ao gravar '{file}': {e}"))?;
        Ok(format!("{asset_dir_rel}/{file}"))
    };

    let (w, h) = (snapshot.screen_width(), snapshot.screen_height());
    // Uma imagem por (prioridade, plano, linha de paleta) e um sprite por entrada da SAT:
    // cada entidade usa exatamente uma linha da CRAM, como no hardware, e a ordem das
    // camadas e a ordem de prioridade do VDP.
    let mut entities = vec![image_entity(ImageEntity {
        id: "rom_backdrop",
        name: "Cor de fundo (backdrop)",
        asset: &save(
            &image::RgbaImage::from_pixel(w, h, snapshot.backdrop()),
            "backdrop.png",
        )?,
        x: 0,
        y: 0,
        width: w,
        height: h,
        hint: "rom_capture:backdrop",
        priority: "background",
        palette_line: (snapshot.regs[7] as usize >> 4) & 3,
    })];
    let mut layer_ids: [Vec<String>; 4] = Default::default();
    let mut uses: [Vec<String>; 4] = Default::default();
    layer_ids[0].push("rom_backdrop".to_string());
    uses[(snapshot.regs[7] as usize >> 4) & 3].push("rom_backdrop".to_string());
    let sprites = snapshot.sprites();
    for (level, high) in [(0usize, false), (2usize, true)] {
        let tier = if high { "alta" } else { "baixa" };
        for (plane, code, label) in [
            (VdpPlane::B, "b", "Plano B"),
            (VdpPlane::A, "a", "Plano A"),
            (VdpPlane::Window, "w", "Window"),
        ] {
            for line in snapshot.plane_layer_palettes(plane, high) {
                let id = format!("rom_plane_{code}_{tier}_pal{line}");
                let image = snapshot.render_plane_layer(plane, high, Some(line));
                entities.push(image_entity(ImageEntity {
                    id: &id,
                    name: &format!("{label} · prioridade {tier} · PAL{line}"),
                    asset: &save(&image, &format!("plane_{code}_{tier}_pal{line}.png"))?,
                    x: 0,
                    y: 0,
                    width: w,
                    height: h,
                    hint: &format!("rom_capture:plane_{code}"),
                    priority: if high { "foreground" } else { "background" },
                    palette_line: line,
                }));
                layer_ids[level].push(id.clone());
                uses[line].push(id);
            }
        }
        // Fim da cadeia primeiro: o sprite 0 da SAT fica por cima, como no VDP.
        for sprite in sprites.iter().rev().filter(|s| s.high == high) {
            let id = format!("rom_sprite_{:02}", sprite.slot);
            let image = snapshot.render_sprite(sprite);
            entities.push(image_entity(ImageEntity {
                id: &id,
                name: &format!(
                    "Sprite SAT {} · tile {} · PAL{}",
                    sprite.slot, sprite.tile, sprite.palette
                ),
                asset: &save(&image, &format!("sprite_{:02}.png", sprite.slot))?,
                x: sprite.x,
                y: sprite.y,
                width: image.width(),
                height: image.height(),
                hint: "rom_capture:sprite",
                priority: if high { "foreground" } else { "background" },
                palette_line: sprite.palette,
            }));
            layer_ids[level + 1].push(id.clone());
            uses[sprite.palette].push(id);
        }
    }
    let layer_names = [
        ("rom_planes_low", "Planos · prioridade baixa", "background"),
        ("rom_sprites_low", "Sprites · prioridade baixa", "sprite"),
        ("rom_planes_high", "Planos · prioridade alta", "tile"),
        ("rom_sprites_high", "Sprites · prioridade alta", "sprite"),
    ];
    let layers: Vec<_> = layer_names
        .iter()
        .zip(layer_ids)
        .enumerate()
        .filter(|(_, (_, ids))| !ids.is_empty())
        .map(|(depth, ((id, name, kind), ids))| {
            json!({ "id": id, "name": name, "kind": kind, "visible": true,
                    "locked": false, "depth": depth, "entity_ids": ids })
        })
        .collect();
    // As 4 linhas da CRAM como recursos explicitos fixados no banco do hardware.
    let palettes: Vec<_> = (0..4)
        .map(|line| {
            let colors: Vec<String> = (0..16)
                .map(|i| {
                    if i == 0 {
                        String::new()
                    } else {
                        let c = snapshot.color(line * 16 + i);
                        format!("#{:02X}{:02X}{:02X}", c[0], c[1], c[2])
                    }
                })
                .collect();
            json!({ "slot": line, "id": format!("cram:pal{line}"),
                    "name": format!("CRAM PAL{line}"), "bank": line,
                    "origin": "rom_capture", "colors": colors, "uses": uses[line] })
        })
        .collect();
    let scene = json!({
        "scene_id": scene_id,
        "schema_version": "1.7.0",
        "display_name": format!("Captura da ROM — {}", name.trim()),
        "background_layers": [],
        "entities": entities,
        "palettes": palettes,
        "retrofx": null,
        "collision_map": null,
        "layers": layers
    });
    fs::write(
        &scene_path,
        serde_json::to_string_pretty(&scene).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Falha ao gravar '{}': {e}", scene_path.display()))?;
    Ok(RomSceneCapture {
        scene_path: scene_rel,
        scene_id,
        sprite_count: sprites.len(),
        vram_used_bytes: snapshot.vram_used_bytes(),
        width: w,
        height: h,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rom_capture_scene_is_a_loadable_studio_scene_with_planes_and_sprites() {
        let dir = std::env::temp_dir().join(format!("rds_rom_capture_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("scenes")).unwrap();
        let mut vram = vec![0u8; 0x10000];
        vram[32] = 0x11;
        // Plano B: celula 0 PAL1 prioridade alta, celula 1 PAL2 prioridade baixa.
        vram[0xC000..0xC004].copy_from_slice(&[0xA0, 0x01, 0x40, 0x01]);
        vram[0xF400..0xF408].copy_from_slice(&[0x00, 140, 0x00, 0x00, 0x00, 0x01, 0x00, 130]);
        let mut regs = [0u8; 32];
        regs[..17].copy_from_slice(&[
            0x04, 0x74, 0x38, 0x34, 0x06, 0x7A, 0, 0, 0, 0, 0, 0, 0x81, 0x3C, 0, 0x02, 0x01,
        ]);
        let mut cram = [0u16; 64];
        cram[1] = 7;
        cram[17] = 0x38;
        cram[33] = 0x1C0;
        let snapshot = VdpSnapshot {
            vram,
            cram,
            vsram: [0; 40],
            regs,
        };

        let result = write_rom_capture_scene(&dir, "Tela Título", &snapshot).expect("capture");
        assert_eq!(result.scene_path, "scenes/rom_capture_tela_t_tulo.json");
        assert_eq!(result.sprite_count, 1);
        let scene =
            crate::core::project_mgr::load_scene(&dir, &result.scene_path).expect("load scene");
        let ids: Vec<_> = scene
            .entities
            .iter()
            .map(|e| e.entity_id.as_str())
            .collect();
        assert_eq!(
            ids,
            [
                "rom_backdrop",
                "rom_plane_b_baixa_pal2",
                "rom_sprite_00",
                "rom_plane_b_alta_pal1"
            ]
        );
        assert_eq!(
            (scene.entities[2].transform.x, scene.entities[2].transform.y),
            (2, 12)
        );
        let layers = scene.layers.as_ref().expect("camadas");
        let names: Vec<_> = layers.iter().map(|l| l.id.as_str()).collect();
        assert_eq!(
            names,
            ["rom_planes_low", "rom_sprites_low", "rom_planes_high"]
        );
        let pal = |line: usize| &scene.palettes[line].uses;
        assert_eq!(pal(0), &["rom_backdrop", "rom_sprite_00"]);
        assert_eq!(pal(1), &["rom_plane_b_alta_pal1"]);
        assert_eq!(pal(2), &["rom_plane_b_baixa_pal2"]);
        // Cada entidade usa uma unica linha da CRAM: o plano de paletas nao acusa conflito.
        let ast = crate::compiler::ast_generator::AstOutput {
            nodes: vec![],
            sprite_assets: vec![],
            logic_scripts: vec![],
        };
        let plan = crate::compiler::palette_plan::plan_megadrive(&dir, &scene, &ast);
        assert!(!plan.has_errors(), "{:?}", plan.diagnostics);
        assert_eq!(plan.entity_banks.get("rom_plane_b_alta_pal1"), Some(&1));
        assert!(dir
            .join("assets/rom_capture/tela_t_tulo/sprite_00.png")
            .is_file());
        assert!(
            write_rom_capture_scene(&dir, "Tela Título", &snapshot).is_err(),
            "nao sobrescreve"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
