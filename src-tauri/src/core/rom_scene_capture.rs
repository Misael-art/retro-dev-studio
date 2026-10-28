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

use crate::emulator::vdp_snapshot::VdpSnapshot;

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
            "logic": { "logic_hints": [hint], "variables": {} },
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
    let mut backdrop = image::RgbaImage::from_pixel(w, h, snapshot.backdrop());
    image::imageops::overlay(&mut backdrop, &snapshot.render_plane(true), 0, 0);
    let mut entities = vec![
        image_entity(ImageEntity {
            id: "rom_plane_b",
            name: "Plano B (fundo)",
            asset: &save(&backdrop, "plane_b.png")?,
            x: 0,
            y: 0,
            width: w,
            height: h,
            hint: "rom_capture:plane_b",
            priority: "background",
        }),
        image_entity(ImageEntity {
            id: "rom_plane_a",
            name: "Plano A",
            asset: &save(&snapshot.render_plane(false), "plane_a.png")?,
            x: 0,
            y: 0,
            width: w,
            height: h,
            hint: "rom_capture:plane_a",
            priority: "foreground",
        }),
    ];
    let sprites = snapshot.sprites();
    // Fim da cadeia primeiro: o sprite 0 da SAT fica por cima, como no VDP.
    for sprite in sprites.iter().rev() {
        let file = format!("sprite_{:02}.png", sprite.slot);
        let image = snapshot.render_sprite(sprite);
        let asset = save(&image, &file)?;
        entities.push(image_entity(ImageEntity {
            id: &format!("rom_sprite_{:02}", sprite.slot),
            name: &format!("Sprite SAT {} (tile {})", sprite.slot, sprite.tile),
            asset: &asset,
            x: sprite.x,
            y: sprite.y,
            width: image.width(),
            height: image.height(),
            hint: "rom_capture:sprite",
            priority: "foreground",
        }));
    }
    let scene = json!({
        "scene_id": scene_id,
        "schema_version": "1.7.0",
        "display_name": format!("Captura da ROM — {}", name.trim()),
        "background_layers": [],
        "entities": entities,
        "palettes": [],
        "retrofx": null,
        "collision_map": null,
        "layers": null
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
        vram[0xF400..0xF408].copy_from_slice(&[0x00, 140, 0x00, 0x00, 0x00, 0x01, 0x00, 130]);
        let mut regs = [0u8; 32];
        regs[..17].copy_from_slice(&[
            0x04, 0x74, 0x38, 0x34, 0x06, 0x7A, 0, 0, 0, 0, 0, 0, 0x81, 0x3C, 0, 0x02, 0x01,
        ]);
        let mut cram = [0u16; 64];
        cram[1] = 7;
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
        assert_eq!(ids, ["rom_plane_b", "rom_plane_a", "rom_sprite_00"]);
        assert_eq!(
            (scene.entities[2].transform.x, scene.entities[2].transform.y),
            (2, 12)
        );
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
