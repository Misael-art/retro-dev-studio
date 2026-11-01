//! Visual camera contract shared by the existing AST and target emitters.
//! No allocation in the emitted frame loop; legacy cameras keep their old path.
use std::collections::HashMap;

use crate::ugdm::{components::VisualCameraConfig, entities::Scene};

use super::ast_generator::{AstNode, AstOutput, UnsupportedSemantic};

#[derive(Debug, Clone)]
pub struct CompiledCamera {
    pub config: VisualCameraConfig,
    pub target_var: Option<String>,
    pub x: i32,
    pub y: i32,
    pub offset_x: i32,
    pub offset_y: i32,
    pub screen_width: i32,
    pub fps: i32,
    pub errors: Vec<String>,
}

pub fn compile(
    scene: &Scene,
    vars: &HashMap<String, String>,
    width: i32,
    fps: u32,
) -> Option<CompiledCamera> {
    let active: Vec<_> = scene
        .entities
        .iter()
        .filter(|e| {
            e.components
                .camera
                .as_ref()
                .and_then(|c| c.visual.as_ref())
                .is_some_and(|v| v.active)
        })
        .collect();
    let entity = *active.first()?;
    let camera = entity.components.camera.as_ref()?;
    let config = camera.visual.as_ref()?.clone();
    let target_var = camera
        .follow_entity
        .as_ref()
        .and_then(|id| vars.get(id))
        .cloned();
    let mut errors = Vec::new();
    if active.len() != 1 {
        errors.push("escolha exatamente uma camera visual ativa".into());
    }
    let patterns = [
        "fixed",
        "platformer",
        "exploration",
        "auto_horizontal",
        "auto_vertical",
    ];
    if config.version != 1 || !patterns.contains(&config.pattern.as_str()) {
        errors.push("versao ou padrao visual nao reconhecido".into());
    }
    if ["platformer", "exploration"].contains(&config.pattern.as_str()) && target_var.is_none() {
        errors.push("alvo da camera removido ou sem sprite; escolha um personagem".into());
    }
    let b = &config.bounds;
    if scene.entities.iter().any(|e| {
        e.components
            .tilemap
            .as_ref()
            .is_some_and(|t| t.scroll_x != 0 || t.scroll_y != 0)
    }) {
        errors.push("zere deslocamentos antigos dos tilemaps antes da camera visual; use a posicao do cenario".into());
    }
    let ints = [
        config.anchor_x,
        config.anchor_y,
        config.screen_x,
        config.screen_y,
        config.response_x,
        config.response_y,
        config.dead_zone_x,
        config.dead_zone_y,
        config.look_ahead,
        config.max_speed,
        config.speed,
        b.x,
        b.y,
        b.width,
        b.height,
        camera.offset_x,
        camera.offset_y,
        entity.transform.x,
        entity.transform.y,
    ];
    if ints.iter().any(|n| !(-16000..=16000).contains(n))
        || b.width < 1
        || b.height < 1
        || !(-16000..=16000).contains(&b.x.saturating_add(b.width))
        || !(-16000..=16000).contains(&b.y.saturating_add(b.height))
    {
        errors.push("coordenadas/limites de camera invalidos (pixels inteiros ate 16000)".into());
    }
    if !(1..=60).contains(&config.response_x)
        || !(1..=60).contains(&config.response_y)
        || !(1..=256).contains(&config.max_speed)
        || !(0..=width).contains(&config.screen_x)
        || !(0..=224).contains(&config.screen_y)
        || config.dead_zone_x < 0
        || config.dead_zone_y < 0
        || config.look_ahead < 0
    {
        errors.push("resposta/enquadramento de camera invalidos".into());
    }
    if scene.retrofx.as_ref().is_some_and(|fx| {
        fx.parallax_layers.iter().any(|l| l.enabled) || fx.raster_lines.iter().any(|l| l.enabled)
    }) || scene.entities.iter().any(|e| {
        e.components.logic.as_ref().is_some_and(|logic| {
            if logic.graph_ref.is_some() && logic.graph.is_none() {
                return true;
            }
            logic.graph.as_ref().is_some_and(|graph| {
                let Ok(value) = serde_json::from_str::<serde_json::Value>(graph) else {
                    return true;
                };
                value["nodes"].as_array().is_some_and(|nodes| {
                    nodes.iter().any(|n| {
                        [
                            "camera_follow",
                            "camera_bounds",
                            "move_camera",
                            "scroll_tilemap",
                            "effect_parallax",
                            "effect_raster",
                        ]
                        .contains(&n["type"].as_str().unwrap_or(""))
                    })
                })
            })
        })
    }) {
        errors.push("camera visual conflita com comandos legados de camera/rolagem; remova-os antes de converter".into());
    }
    Some(CompiledCamera {
        config,
        target_var,
        x: entity.transform.x,
        y: entity.transform.y,
        offset_x: camera.offset_x,
        offset_y: camera.offset_y,
        screen_width: width,
        fps: fps.clamp(1, 120) as i32,
        errors,
    })
}

pub fn find(ast: &AstOutput) -> Option<&CompiledCamera> {
    ast.nodes.iter().find_map(|n| match n {
        AstNode::ConfigureCamera(c) => Some(c.as_ref()),
        _ => None,
    })
}

pub fn errors(ast: &AstOutput) -> Vec<UnsupportedSemantic> {
    find(ast)
        .map(|c| {
            c.errors
                .iter()
                .map(|reason| UnsupportedSemantic {
                    node_id: "visual_camera".into(),
                    reason: reason.clone(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Same integer arithmetic as core/cameraWorkflow.ts, including signed division toward zero.
pub fn render_definitions(camera: &CompiledCamera) -> String {
    if !camera.errors.is_empty() {
        return String::new();
    }
    let v = &camera.config;
    let b = &v.bounds;
    let target_x = camera
        .target_var
        .as_ref()
        .map(|s| format!("{s}_x"))
        .unwrap_or_else(|| "0".into());
    let target_y = camera
        .target_var
        .as_ref()
        .map(|s| format!("{s}_y"))
        .unwrap_or_else(|| "0".into());
    let mut body = String::new();
    if ["platformer", "exploration"].contains(&v.pattern.as_str()) && camera.target_var.is_some() {
        body.push_str("    if (rds_cam_initialized && tx != rds_cam_previous_x) rds_cam_direction = tx > rds_cam_previous_x ? 1 : -1;\n");
        if v.horizontal {
            body.push_str(&format!("    dx = tx + {anchor} - {screen} + {offset} + {look} * rds_cam_direction;\n    cx = rds_cam_initialized ? rds_cam_approach(cx, dx, {dead}, {response}, {speed}) : dx;\n",
                anchor=v.anchor_x,screen=v.screen_x,offset=camera.offset_x,look=v.look_ahead,dead=v.dead_zone_x,response=v.response_x,speed=v.max_speed));
        }
        if v.vertical {
            body.push_str(&format!("    dy = ty + {anchor} - {screen} + {offset};\n    cy = rds_cam_initialized ? rds_cam_approach(cy, dy, {dead}, {response}, {speed}) : dy;\n",
                anchor=v.anchor_y,screen=v.screen_y,offset=camera.offset_y,dead=v.dead_zone_y,response=v.response_y,speed=v.max_speed));
        }
    } else if !v.paused
        && ((v.pattern == "auto_horizontal" && v.horizontal)
            || (v.pattern == "auto_vertical" && v.vertical))
    {
        body.push_str(&format!("    if (rds_cam_initialized) {{ rds_cam_remainder += {speed}; step = rds_cam_remainder / {fps}; rds_cam_remainder -= step * {fps}; {axis} += step; }}\n",
            speed=v.speed,fps=camera.fps,axis=if v.pattern=="auto_horizontal" {"cx"} else {"cy"}));
    }
    // Avoid unused helper warnings on the official C compilers for a fixed/auto camera.
    let approach = if ["platformer", "exploration"].contains(&v.pattern.as_str())
        && (v.horizontal || v.vertical)
    {
        "static s32 rds_cam_approach(s32 current, s32 desired, s32 dead, s32 response, s32 speed) {\n    s32 diff = desired - current; s32 distance = diff < 0 ? -diff : diff; s32 step;\n    distance -= dead; if (distance <= 0) return current; step = distance / response; if (step < 1) step = 1; if (step > speed) step = speed; return current + (diff < 0 ? -step : step);\n}\n"
    } else {
        ""
    };
    format!("// Visual camera v1: stable world anchor -> screen point; one tick after game movement.\nstatic u8 rds_cam_initialized = 0;\nstatic s32 rds_cam_previous_x = 0, rds_cam_direction = 0, rds_cam_remainder = 0;\n{approach}static void rds_visual_camera_tick(void) {{\n    s32 tx = {target_x}, ty = {target_y}, dx = 0, dy = 0, step = 0;\n    s32 cx = rds_cam_initialized ? rds_camera_x : {base_x};\n    s32 cy = rds_cam_initialized ? rds_camera_y : {base_y};\n    (void)ty; (void)dx; (void)dy; (void)step; (void)rds_cam_direction; (void)rds_cam_remainder;\n{body}    if (cx < {min_x}) cx = {min_x}; if (cx > {max_x}) cx = {max_x};\n    if (cy < {min_y}) cy = {min_y}; if (cy > {max_y}) cy = {max_y};\n    rds_camera_x = (s16)cx; rds_camera_y = (s16)cy; rds_cam_previous_x = tx; rds_cam_initialized = 1;\n}}\n",
        base_x=camera.x.saturating_add(camera.offset_x),base_y=camera.y.saturating_add(camera.offset_y),
        min_x=b.x,min_y=b.y,max_x=b.x+(b.width-camera.screen_width).max(0),max_y=b.y+(b.height-224).max(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::{
        ast_generator::generate_ast, sgdk_emitter::emit_sgdk, snes_emitter::emit_snes,
    };
    use crate::ugdm::{components::CameraComponent, entities::Project};

    fn scene() -> Scene {
        serde_json::from_value(serde_json::json!({"scene_id":"main","entities":[
            {"entity_id":"hero","transform":{"x":400,"y":200},"components":{"sprite":{
                "asset":"hero.png","frame_width":32,"frame_height":48,"palette_slot":0,"animations":{}}}},
            {"entity_id":"camera","transform":{"x":0,"y":0},"components":{"camera":{
                "follow_entity":"hero","offset_x":0,"offset_y":0,"visual":{
                    "version":1,"active":true,"pattern":"platformer","anchor_x":8,"anchor_y":16,
                    "screen_x":128,"screen_y":112,"horizontal":true,"vertical":true,
                    "response_x":8,"response_y":12,"dead_zone_x":0,"dead_zone_y":32,"look_ahead":32,
                    "max_speed":16,"speed":60,"paused":false,"bounds":{"x":0,"y":0,"width":1024,"height":512}
                }}}}
        ]})).unwrap()
    }
    fn project(target: &str) -> Project {
        serde_json::from_value(serde_json::json!({"rds_version":"1","name":"Camera test","target":target,
            "resolution":{"width":if target=="snes" {256} else {320},"height":224},"fps":60,"entry_scene":"main"})).unwrap()
    }
    #[test]
    fn legacy_serialization_and_explicit_conversion_roundtrip() {
        let legacy: CameraComponent =
            serde_json::from_str(r#"{"follow_entity":"hero","offset_x":-160,"offset_y":-112}"#)
                .unwrap();
        assert!(legacy.visual.is_none());
        assert!(!serde_json::to_string(&legacy).unwrap().contains("visual"));
        let original = scene();
        let json = serde_json::to_string(&original).unwrap();
        assert_eq!(original, serde_json::from_str::<Scene>(&json).unwrap());
    }
    #[test]
    fn both_emitters_tick_after_gameplay_before_sprite_presentation() {
        for target in ["megadrive", "snes"] {
            let ast = generate_ast(&project(target), &scene());
            assert!(super::errors(&ast).is_empty());
            assert!(
                ast.logic_scripts.is_empty(),
                "no implicit legacy follow competes with visual camera"
            );
            let c = if target == "snes" {
                emit_snes(&ast, "Camera").main_c
            } else {
                emit_sgdk(&ast, "Camera").main_c
            };
            assert!(!c.contains("#error"), "{c}");
            assert_eq!(c.matches("rds_visual_camera_tick();").count(), 1);
            let tick = c.find("rds_visual_camera_tick();").unwrap();
            let render = c
                .rfind(if target == "snes" {
                    "oamUpdate();"
                } else {
                    "SPR_update();"
                })
                .unwrap();
            assert!(tick < render);
            assert!(c.contains("tx + 8 - 128 + 0 + 32 * rds_cam_direction"));
            assert!(c.contains(if target == "snes" {
                "if (cx > 768)"
            } else {
                "if (cx > 704)"
            }));
            assert!(c.contains(if target == "snes" {
                "spr_hero_x - rds_camera_x"
            } else {
                "SPR_setPosition(spr_hero, spr_hero_x, spr_hero_y)"
            }));
        }
    }
    #[test]
    fn removed_target_and_duplicate_active_camera_fail_closed() {
        let mut s = scene();
        s.entities[1]
            .components
            .camera
            .as_mut()
            .unwrap()
            .follow_entity = Some("removed".into());
        let ast = generate_ast(&project("megadrive"), &s);
        assert!(super::errors(&ast)
            .iter()
            .any(|e| e.reason.contains("alvo")));
        s.entities.push(s.entities[1].clone());
        assert!(super::errors(&generate_ast(&project("megadrive"), &s))
            .iter()
            .any(|e| e.reason.contains("exatamente uma")));
    }
    #[test]
    fn visual_background_origins_match_world_coordinates_on_both_targets() {
        let mut s = scene();
        s.entities.push(serde_json::from_value(serde_json::json!({"entity_id":"world","transform":{"x":-24,"y":17},"components":{"tilemap":{
            "tileset":"world.png","map_width":32,"map_height":32,"scroll_x":0,"scroll_y":0
        }}})).unwrap());
        let md = emit_sgdk(&generate_ast(&project("megadrive"), &s), "Camera").main_c;
        assert!(md.contains("-24 - rds_camera_x"));
        assert!(md.contains("rds_camera_y - 17"));
        let snes = emit_snes(&generate_ast(&project("snes"), &s), "Camera").main_c;
        assert!(snes.contains("bgSetScroll(0, rds_camera_x - -24, rds_camera_y - 17)"));
        s.entities
            .last_mut()
            .unwrap()
            .components
            .tilemap
            .as_mut()
            .unwrap()
            .scroll_x = 1;
        assert!(super::errors(&generate_ast(&project("megadrive"), &s))
            .iter()
            .any(|e| e.reason.contains("deslocamentos antigos")));
    }
    #[test]
    fn visual_camera_resolves_before_managed_sprite_residency() {
        let mut s = scene();
        for i in 0..18 {
            let mut hero = s.entities[0].clone();
            hero.entity_id = format!("hero_{i}");
            s.entities.push(hero);
        }
        let c = emit_sgdk(&generate_ast(&project("megadrive"), &s), "Camera").main_c;
        let tick = c.find("rds_visual_camera_tick();").unwrap();
        let residency = c.rfind("rds_sync_sprite_residency();").unwrap();
        assert!(
            tick < residency,
            "visibility must use this frame's camera, including entering sprites"
        );
    }
    #[test]
    fn legacy_camera_nodes_cannot_override_visual_configuration() {
        let mut s = scene();
        let mut value = serde_json::to_value(&s).unwrap();
        value["entities"][0]["components"]["logic"] =
            serde_json::json!({"graph":r#"{"nodes":[{"type":"camera_follow"}],"edges":[]}"#});
        s = serde_json::from_value(value).unwrap();
        let compiled = compile(
            &s,
            &HashMap::from([("hero".into(), "spr_hero".into())]),
            320,
            60,
        )
        .unwrap();
        assert!(compiled.errors.iter().any(|e| e.contains("conflita")));
    }
}
