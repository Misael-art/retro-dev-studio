//! Camera component -> existing AST/emitter integration. All frame state is static in generated C.
use super::ast_generator::{AstNode, AstOutput, UnsupportedSemantic};
use crate::ugdm::{
    components::{CameraArea, VisualCameraConfig},
    entities::Scene,
};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct CompiledCamera {
    pub config: VisualCameraConfig,
    pub target_var: Option<String>,
    pub targets: Vec<String>,
    pub x: i32,
    pub y: i32,
    pub offset_x: i32,
    pub offset_y: i32,
}
#[derive(Debug, Clone)]
pub struct CompiledCameraProgram {
    pub cameras: Vec<CompiledCamera>,
    pub initial: usize,
    pub screen_width: i32,
    pub fps: i32,
    pub layer_ids: Vec<String>,
    pub errors: Vec<String>,
}
fn area_valid(b: &CameraArea) -> bool {
    [b.x, b.y, b.width, b.height]
        .iter()
        .all(|n| (-16000..=16000).contains(n))
        && b.width > 0
        && b.height > 0
        && (-16000..=16000).contains(&b.x.saturating_add(b.width))
        && (-16000..=16000).contains(&b.y.saturating_add(b.height))
}
fn pattern_code(pattern: &str) -> Option<u8> {
    [
        "fixed",
        "platformer",
        "exploration",
        "auto_horizontal",
        "auto_vertical",
        "rooms",
        "beat_em_up",
        "arena",
        "sequence",
    ]
    .iter()
    .position(|p| *p == pattern)
    .map(|n| n as u8)
}
pub fn camera_ids(scene: &Scene) -> Vec<String> {
    let mut ids: Vec<_> = scene
        .entities
        .iter()
        .filter(|e| {
            e.components
                .camera
                .as_ref()
                .is_some_and(|c| c.visual.is_some())
        })
        .map(|e| e.entity_id.clone())
        .collect();
    ids.sort();
    ids
}
pub fn compile(
    scene: &Scene,
    vars: &HashMap<String, String>,
    width: i32,
    fps: u32,
) -> Option<CompiledCameraProgram> {
    let ids = camera_ids(scene);
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
    let initial_id = &active.first()?.entity_id;
    let layer_ids: Vec<_> = scene
        .entities
        .iter()
        .filter(|e| e.components.tilemap.is_some())
        .map(|e| e.entity_id.clone())
        .collect();
    let mut errors = Vec::new();
    if active.len() != 1 {
        errors.push("escolha exatamente uma camera visual ativa".into());
    }
    if ids.len() > 8 {
        errors.push("use ate oito cameras visuais por cena".into());
    }
    if ids.windows(2).any(|p| p[0] == p[1]) {
        errors.push("identidades de camera duplicadas na cena".into());
    }
    if layer_ids.len() > 2 {
        errors.push(
            "camera visual: ate dois planos residentes compativeis; WINDOW reservado ao HUD".into(),
        );
    }
    if scene.entities.iter().any(|e| {
        e.components
            .tilemap
            .as_ref()
            .is_some_and(|t| t.scroll_x != 0 || t.scroll_y != 0)
    }) {
        errors.push("zere deslocamentos antigos dos tilemaps antes da camera visual; use a posicao do cenario".into());
    }
    if scene.retrofx.as_ref().is_some_and(|fx| {
        fx.parallax_layers.iter().any(|l| l.enabled) || fx.raster_lines.iter().any(|l| l.enabled)
    }) || scene.entities.iter().any(|e| {
        e.components.logic.as_ref().is_some_and(|l| {
            if l.graph_ref.is_some() && l.graph.is_none() {
                return true;
            }
            l.graph.as_ref().is_some_and(|g| {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(g) else {
                    return true;
                };
                v["nodes"].as_array().is_some_and(|nodes| {
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
    let mut cameras = Vec::new();
    for id in &ids {
        let e = scene.entities.iter().find(|e| &e.entity_id == id)?;
        let c = e.components.camera.as_ref()?;
        let v = c.visual.as_ref()?.clone();
        let a = &v.advanced;
        let target_var = c
            .follow_entity
            .as_ref()
            .and_then(|id| vars.get(id))
            .cloned();
        let follow = ["platformer", "exploration", "rooms", "beat_em_up"]
            .contains(&v.pattern.as_str())
            || (v.pattern == "sequence" && a.return_to_target);
        if v.version != 1 || pattern_code(&v.pattern).is_none() {
            errors.push(format!("{id}: versao ou padrao visual nao reconhecido"));
        }
        if (follow || (a.activation.is_some() && v.pattern != "arena")) && target_var.is_none() {
            errors.push(format!(
                "{id}: alvo da camera removido ou sem sprite; escolha um personagem"
            ));
        }
        let ints = [
            v.anchor_x,
            v.anchor_y,
            v.screen_x,
            v.screen_y,
            v.response_x,
            v.response_y,
            v.dead_zone_x,
            v.dead_zone_y,
            v.look_ahead,
            v.max_speed,
            v.speed,
            c.offset_x,
            c.offset_y,
            e.transform.x,
            e.transform.y,
            a.priority,
        ];
        if ints.iter().any(|n| !(-16000..=16000).contains(n))
            || !area_valid(&v.bounds)
            || a.activation.as_ref().is_some_and(|b| !area_valid(b))
        {
            errors.push(format!("{id}: coordenadas/limites de camera invalidos"));
        }
        if !(1..=60).contains(&v.response_x)
            || !(1..=60).contains(&v.response_y)
            || !(1..=256).contains(&v.max_speed)
            || !(0..=width).contains(&v.screen_x)
            || !(0..=224).contains(&v.screen_y)
            || v.dead_zone_x < 0
            || v.dead_zone_y < 0
            || v.look_ahead < 0
        {
            errors.push(format!("{id}: resposta/enquadramento de camera invalidos"));
        }
        let mut room_ids = std::collections::BTreeSet::new();
        if a.rooms.len() > 16
            || (v.pattern == "rooms" && a.rooms.is_empty())
            || a.rooms.iter().any(|r| {
                r.id.is_empty()
                    || r.name.trim().is_empty()
                    || r.name.chars().count() > 80
                    || !room_ids.insert(r.id.clone())
                    || !area_valid(&r.area)
                    || !(-16000..=16000).contains(&r.priority)
            })
        {
            errors.push(format!(
                "{id}: salas invalidas (identidade unica, area e prioridade; maximo16)"
            ));
        }
        if a.path.len() > 32
            || (v.pattern == "sequence" && a.path.is_empty())
            || a.path.iter().any(|p| {
                !(-16000..=16000).contains(&p.x)
                    || !(-16000..=16000).contains(&p.y)
                    || !(0..=36000).contains(&p.frames)
                    || !(0..=36000).contains(&p.wait)
            })
        {
            errors.push(format!(
                "{id}: percurso invalido (ate32 pontos; duracao/espera de0 a36000 quadros)"
            ));
        }
        let unique: std::collections::BTreeSet<_> = a.targets.iter().collect();
        let targets: Vec<_> = a
            .targets
            .iter()
            .filter_map(|id| vars.get(id).cloned())
            .collect();
        if a.targets.len() > 4
            || (v.pattern == "arena"
                && (a.targets.len() < 2
                    || unique.len() != a.targets.len()
                    || targets.len() != a.targets.len()))
        {
            errors.push(format!("{id}: arena exige2 a4 alvos diferentes com sprite"));
        }
        let mut layers = std::collections::BTreeSet::new();
        if a.parallax.iter().any(|p| {
            !layers.insert(p.entity_id.clone())
                || !layer_ids.contains(&p.entity_id)
                || !(0..=200).contains(&p.ratio_x)
                || !(0..=200).contains(&p.ratio_y)
        }) {
            errors.push(format!(
                "{id}: paralaxe exige planos distintos e razoes de0 a200%"
            ));
        }
        cameras.push(CompiledCamera {
            config: v,
            target_var,
            targets,
            x: e.transform.x,
            y: e.transform.y,
            offset_x: c.offset_x,
            offset_y: c.offset_y,
        });
    }
    Some(CompiledCameraProgram {
        initial: ids.iter().position(|id| id == initial_id)?,
        cameras,
        screen_width: width,
        fps: fps.clamp(1, 120) as i32,
        layer_ids,
        errors,
    })
}
pub fn find(ast: &AstOutput) -> Option<&CompiledCameraProgram> {
    ast.nodes.iter().find_map(|n| match n {
        AstNode::ConfigureCamera(c) => Some(c.as_ref()),
        _ => None,
    })
}
pub fn errors(ast: &AstOutput) -> Vec<UnsupportedSemantic> {
    let mut errors: Vec<_> = find(ast)
        .map(|c| {
            c.errors
                .iter()
                .map(|reason| UnsupportedSemantic {
                    node_id: "visual_camera".into(),
                    reason: reason.clone(),
                })
                .collect()
        })
        .unwrap_or_default();
    if find(ast).is_none()
        && ast
            .logic_scripts
            .iter()
            .any(|s| super::ast_generator::ops_control_camera(&s.ops))
    {
        errors.push(UnsupportedSemantic {
            node_id: "camera_control".into(),
            reason: "escolha uma camera visual ativa antes de usar controle por evento".into(),
        });
    }
    errors
}
pub fn render_definitions(p: &CompiledCameraProgram) -> String {
    if !p.errors.is_empty() {
        return String::new();
    }
    let mut out=format!("#define RDS_VISUAL_CAMERA_COUNT {}\n#define RDS_VISUAL_CAMERA_WIDTH {}\n#define RDS_VISUAL_CAMERA_FPS {}\n#define RDS_VISUAL_CAMERA_INITIAL {}\n",p.cameras.len(),p.screen_width,p.fps,p.initial);
    let mut data = String::new();
    let mut rooms = Vec::new();
    let mut points = Vec::new();
    let mut targets = Vec::new();
    let mut configs = Vec::new();
    for c in &p.cameras {
        let v = &c.config;
        let a = &v.advanced;
        let room_start = rooms.len();
        let path_start = points.len();
        let target_start = targets.len();
        let mut sorted = a.rooms.clone();
        sorted.sort_by(|l, r| r.priority.cmp(&l.priority).then(l.id.cmp(&r.id)));
        for r in &sorted {
            rooms.push(format!(
                "{{{},{},{},{},{}}}",
                r.area.x,
                r.area.y,
                r.area.width,
                r.area.height,
                u8::from(r.smooth)
            ));
        }
        for point in &a.path {
            points.push(format!(
                "{{{},{},{}L,{}L}}",
                point.x, point.y, point.frames, point.wait
            ));
        }
        for target in &c.targets {
            targets.push(format!("{{&{target}_x,&{target}_y}}"));
        }
        let b = &v.bounds;
        let reg = a.activation.as_ref();
        let ptr = c
            .target_var
            .as_ref()
            .map(|s| format!("&{s}_x,&{s}_y"))
            .unwrap_or_else(|| "0,0".into());
        let ratios = |x: bool| -> String {
            (0..2)
                .map(|i| {
                    p.layer_ids
                        .get(i)
                        .and_then(|id| a.parallax.iter().find(|l| &l.entity_id == id))
                        .map(|l| if x { l.ratio_x } else { l.ratio_y })
                        .unwrap_or(100)
                        .to_string()
                })
                .collect::<Vec<_>>()
                .join(",")
        };
        configs.push(format!("{{{pattern},{x},{y},{ox},{oy},{ax},{ay},{sx},{sy},{hx},{hy},{rx},{ry},{dx},{dy},{look},{max},{speed},{paused},{minx},{miny},{maxx},{maxy},{back},{ret},{smooth},{ptr},{rs},{rc},{ps},{pc},{ts},{tc},{has},{gx},{gy},{gw},{gh},{priority},{{{ratio_x}}},{{{ratio_y}}}}}",
            pattern=pattern_code(&v.pattern).unwrap_or(0),x=c.x,y=c.y,ox=c.offset_x,oy=c.offset_y,ax=v.anchor_x,ay=v.anchor_y,sx=v.screen_x,sy=v.screen_y,hx=u8::from(v.horizontal),hy=u8::from(v.vertical),
            rx=v.response_x,ry=v.response_y,dx=v.dead_zone_x,dy=v.dead_zone_y,look=v.look_ahead,max=v.max_speed,speed=v.speed,paused=u8::from(v.paused),minx=b.x,miny=b.y,maxx=b.x+(b.width-p.screen_width).max(0),maxy=b.y+(b.height-224).max(0),
            back=u8::from(a.allow_backtracking),ret=u8::from(a.return_to_target),smooth=u8::from(a.smooth_transition),rs=room_start,rc=a.rooms.len(),ps=path_start,pc=a.path.len(),ts=target_start,tc=c.targets.len(),has=u8::from(reg.is_some()),
            gx=reg.map_or(0,|b|b.x),gy=reg.map_or(0,|b|b.y),gw=reg.map_or(1,|b|b.width),gh=reg.map_or(1,|b|b.height),priority=a.priority,ratio_x=ratios(true),ratio_y=ratios(false)));
    }
    if rooms.is_empty() {
        rooms.push("{0,0,1,1,0}".into());
    }
    if points.is_empty() {
        points.push("{0,0,0L,0L}".into());
    }
    if targets.is_empty() {
        targets.push("{0,0}".into());
    }
    data.push_str(&format!("static const RdsCameraRoom rds_cam_rooms[] = {{{}}};\nstatic const RdsCameraPoint rds_cam_points[] = {{{}}};\nstatic const RdsCameraTarget rds_cam_targets[] = {{{}}};\nstatic const RdsCameraConfig rds_cam_configs[] = {{{}}};\n",rooms.join(","),points.join(","),targets.join(","),configs.join(",\n")));
    data.push_str(&format!(
        "static u16 rds_cam_pauses[RDS_VISUAL_CAMERA_COUNT] = {{{}}};\n",
        p.cameras
            .iter()
            .map(|c| u8::from(c.config.paused).to_string())
            .collect::<Vec<_>>()
            .join(",")
    ));
    out.push_str(
        &include_str!("camera_runtime_template.c").replace("/* RDS_CAMERA_DATA */", &data),
    );
    out
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
            assert_eq!(c.matches("rds_visual_camera_init();").count(), 1);
            assert!(
                c.find("rds_visual_camera_init();").unwrap()
                    < c.find(if target == "snes" {
                        "while (1)"
                    } else {
                        "while (TRUE)"
                    })
                    .unwrap()
            );
            let tick = c.find("rds_visual_camera_tick();").unwrap();
            let render = c
                .rfind(if target == "snes" {
                    "oamUpdate();"
                } else {
                    "SPR_update();"
                })
                .unwrap();
            assert!(tick < render);
            let program = find(&ast).unwrap();
            let values = &program.cameras[program.initial].config;
            assert_eq!(
                (values.anchor_x, values.screen_x, values.look_ahead),
                (8, 128, 32)
            );
            assert_eq!(
                values.bounds.width - program.screen_width,
                if target == "snes" { 768 } else { 704 }
            );
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
        assert!(md.contains("-24 - ((s32)rds_camera_x * rds_camera_ratio_x[0]) / 100"));
        assert!(md.contains("((s32)rds_camera_y * rds_camera_ratio_y[0]) / 100 - 17"));
        let snes = emit_snes(&generate_ast(&project("snes"), &s), "Camera").main_c;
        assert!(snes.contains("bgSetScroll(0, ((s32)rds_camera_x * rds_camera_ratio_x[0]) / 100 - -24, ((s32)rds_camera_y * rds_camera_ratio_y[0]) / 100 - 17)"));
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

    #[test]
    fn camera_event_parameters_fail_closed_and_inactive_cameras_do_not_follow_implicitly() {
        for target in ["megadrive", "snes"] {
            for frames in [
                serde_json::json!(12),
                serde_json::json!("12"),
                serde_json::json!("bad"),
                serde_json::json!(2.5),
            ] {
                let valid = frames == serde_json::json!(12) || frames == serde_json::json!("12");
                let mut s = scene();
                let graph = serde_json::json!({"nodes":[
                    {"id":"start","type":"event_start","params":{}},
                    {"id":"control","type":"camera_control","params":{"target":"camera","action":"shake","frames":frames,"x":4,"y":2}}
                ],"edges":[{"fromNode":"start","fromPort":"exec","toNode":"control","toPort":"exec"}]});
                s.entities[0].components.logic = Some(
                    serde_json::from_value(serde_json::json!({"graph":graph.to_string()})).unwrap(),
                );
                let ast = generate_ast(&project(target), &s);
                let errors = super::super::ast_generator::collect_unsupported_semantics(&ast);
                assert_eq!(errors.is_empty(), valid, "{target}: {errors:?}");
                if valid {
                    let c = if target == "snes" {
                        emit_snes(&ast, "Camera").main_c
                    } else {
                        emit_sgdk(&ast, "Camera").main_c
                    };
                    assert!(c.contains("rds_visual_camera_control(0, 4, 12, 4, 2);"));
                }
            }
            let mut s = scene();
            s.entities[1]
                .components
                .camera
                .as_mut()
                .unwrap()
                .visual
                .as_mut()
                .unwrap()
                .active = false;
            let ast = generate_ast(&project(target), &s);
            assert!(find(&ast).is_none());
            assert!(
                ast.logic_scripts.is_empty(),
                "inactive visual camera must not fall back to legacy follow"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn generated_c_camera_contracts_execute_reference_trajectories() {
        use crate::core::rom_mastering::sha256_hex;
        use std::{
            fs,
            process::Command,
            time::{SystemTime, UNIX_EPOCH},
        };
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target-test/validation/camera-runtime-contracts")
            .join(format!("{}-{stamp}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let mut cases: Vec<(&str, Scene, u32, &str)> = Vec::new();
        cases.push(("follow-effects",scene(),60,r#"
            u16 i;
            rds_visual_camera_tick();assert(rds_camera_x==280&&rds_camera_y==104);
            spr_hero_x=480;rds_visual_camera_tick();assert(rds_camera_x==294);
            rds_visual_camera_control(0,2,0,0,0);spr_hero_x=680;rds_visual_camera_tick();assert(rds_camera_x==294);
            rds_visual_camera_control(0,3,0,0,0);rds_visual_camera_tick();assert(rds_camera_x==310);
            rds_visual_camera_control(0,5,3,5,-3);
            for(i=0;i<3;i++){rds_visual_camera_tick();assert(rds_camera_x-rds_camera_base_x==5&&rds_camera_y-rds_camera_base_y==-3);}
            rds_visual_camera_tick();assert(rds_camera_x==rds_camera_base_x&&rds_camera_y==rds_camera_base_y);
            rds_visual_camera_control(0,4,4,4,2);
            for(i=0;i<4;i++){rds_visual_camera_tick();assert(rds_camera_x-rds_camera_base_x==((i&1)?-4:4));assert(rds_camera_y-rds_camera_base_y==((i&1)?-2:2));}
            rds_visual_camera_tick();assert(rds_camera_x==rds_camera_base_x&&rds_camera_y==rds_camera_base_y);
        "#));
        let mut auto = scene();
        {
            let v = auto.entities[1]
                .components
                .camera
                .as_mut()
                .unwrap()
                .visual
                .as_mut()
                .unwrap();
            v.pattern = "auto_horizontal".into();
            v.speed = -7;
            v.bounds.x = -1000;
            v.bounds.width = 2000;
        }
        auto.entities[1].transform.x = 400;
        auto.entities[1].transform.y = 200;
        cases.push((
            "signed-pal-scroll",
            auto,
            50,
            r#"
            u16 i;rds_visual_camera_tick();assert(rds_camera_x==400);
            for(i=0;i<50;i++){rds_visual_camera_tick();}
            assert(rds_camera_x==393&&rds_cam_remainder==0);
            rds_visual_camera_control(0,2,0,0,0);rds_visual_camera_tick();assert(rds_camera_x==393);
        "#,
        ));
        let mut rooms = scene();
        {
            let v = rooms.entities[1]
                .components
                .camera
                .as_mut()
                .unwrap()
                .visual
                .as_mut()
                .unwrap();
            v.pattern = "rooms".into();
            v.advanced=serde_json::from_value(serde_json::json!({"rooms":[
                {"id":"left","name":"Left","area":{"x":0,"y":0,"width":320,"height":224},"priority":0,"smooth":false},
                {"id":"right","name":"Right","area":{"x":320,"y":0,"width":320,"height":224},"priority":0,"smooth":false},
                {"id":"small","name":"Small","area":{"x":640,"y":0,"width":100,"height":100},"priority":1,"smooth":false}
            ]})).unwrap();
        }
        cases.push(("room-borders-return-small",rooms,60,r#"
            rds_visual_camera_tick();assert(rds_camera_x==320&&rds_camera_y==0);
            spr_hero_x=310;rds_visual_camera_tick();assert(rds_camera_x==0);
            spr_hero_x=312;rds_visual_camera_tick();assert(rds_camera_x==320);
            spr_hero_x=1100;spr_hero_y=500;rds_visual_camera_tick();assert(rds_camera_x==320&&rds_camera_y==0);
            spr_hero_x=650;spr_hero_y=50;rds_visual_camera_tick();assert(rds_camera_x==640&&rds_camera_y==0);
        "#));
        let mut arena = scene();
        {
            let mut other = arena.entities[0].clone();
            other.entity_id = "other".into();
            arena.entities.push(other);
            let c = arena.entities[1].components.camera.as_mut().unwrap();
            c.follow_entity = None;
            let v = c.visual.as_mut().unwrap();
            v.pattern = "arena".into();
            v.response_x = 1;
            v.response_y = 1;
            v.max_speed = 256;
            v.look_ahead = 0;
            v.screen_x = 160;
            v.advanced.targets = vec!["hero".into(), "other".into()];
        }
        cases.push(("arena-separation",arena,60,r#"
            rds_visual_camera_tick();assert(rds_camera_x==448&&rds_camera_separated==1);
            spr_other_x=500;rds_visual_camera_tick();assert(rds_camera_x==298&&rds_camera_separated==0);
        "#));
        let mut sequence = scene();
        {
            let v = sequence.entities[1]
                .components
                .camera
                .as_mut()
                .unwrap()
                .visual
                .as_mut()
                .unwrap();
            v.pattern = "sequence".into();
            v.advanced=serde_json::from_value(serde_json::json!({"path":[{"x":120,"y":60,"frames":4,"wait":2},{"x":220,"y":80,"frames":0,"wait":1}]})).unwrap();
        }
        cases.push((
            "sequence-duration-wait-cut",
            sequence,
            60,
            r#"
            const s16 xs[]={0,30,60,90,120,120,120,220,220,220};u16 i;
            for(i=0;i<10;i++){rds_visual_camera_tick();assert(rds_camera_x==xs[i]);}
            assert(rds_cam_path_index==2);
        "#,
        ));
        let mut regions = scene();
        {
            let c = regions.entities[1].components.camera.as_mut().unwrap();
            c.visual.as_mut().unwrap().pattern = "fixed".into();
            let mut other = regions.entities[1].clone();
            other.entity_id = "camera_b".into();
            other.transform.x = 640;
            let v = other
                .components
                .camera
                .as_mut()
                .unwrap()
                .visual
                .as_mut()
                .unwrap();
            v.active = false;
            v.advanced.activation = Some(CameraArea {
                x: 300,
                y: 0,
                width: 400,
                height: 224,
            });
            v.advanced.smooth_transition = true;
            v.response_x = 1;
            v.max_speed = 16;
            regions.entities.push(other);
        }
        cases.push(("regions-manual-precedence",regions,60,r#"
            rds_visual_camera_tick();assert(rds_camera_active==1&&rds_camera_x==640);
            rds_visual_camera_control(0,0,0,0,0);rds_visual_camera_tick();assert(rds_camera_active==0&&rds_camera_x==0);
            rds_visual_camera_tick();assert(rds_camera_active==0);
            rds_visual_camera_control(0,1,0,0,0);rds_visual_camera_tick();assert(rds_camera_active==1&&rds_camera_x==16);
            rds_visual_camera_tick();assert(rds_camera_x==32);
        "#));
        for (name, scene, fps, body) in cases {
            let program = compile(
                &scene,
                &HashMap::from([
                    ("hero".into(), "spr_hero".into()),
                    ("other".into(), "spr_other".into()),
                ]),
                320,
                fps,
            )
            .unwrap();
            assert!(program.errors.is_empty(), "{}", program.errors.join("; "));
            let source=format!("#include <assert.h>\n#include <stdint.h>\ntypedef int16_t s16;typedef uint16_t u16;typedef int32_t s32;\ns16 spr_hero_x=400,spr_hero_y=200,spr_other_x=800,spr_other_y=200;\nstatic volatile s16 rds_camera_x=0,rds_camera_y=0;\nstatic s16 rds_camera_ratio_x[2],rds_camera_ratio_y[2];\n{}\nint main(void){{rds_cam_offset_left[0]=0x5555;rds_cam_shake_left[0]=0x5555;rds_camera_active=99;rds_visual_camera_init();assert(rds_cam_offset_left[0]==0&&rds_cam_shake_left[0]==0);\n{body}\nreturn 0;}}\n",render_definitions(&program));
            let c = dir.join(format!("{name}.c"));
            let exe = dir.join(name);
            fs::write(&c, &source).unwrap();
            let result = Command::new("cc")
                .args(["-std=c99", "-Wall", "-Wextra", "-Werror"])
                .arg(&c)
                .arg("-o")
                .arg(&exe)
                .output()
                .expect("host certificate requires a C compiler");
            assert!(
                result.status.success(),
                "{}: {}",
                c.display(),
                String::from_utf8_lossy(&result.stderr)
            );
            let run = Command::new(&exe).output().unwrap();
            assert!(
                run.status.success(),
                "{}: {}",
                c.display(),
                String::from_utf8_lossy(&run.stderr)
            );
            let receipt = serde_json::json!({"tier":"host_c_reference","status":"passed","case":name,"source_sha256":sha256_hex(source.as_bytes()),"fps":fps});
            fs::write(
                dir.join(format!("{name}.json")),
                serde_json::to_vec_pretty(&receipt).unwrap(),
            )
            .unwrap();
        }
        println!("CAMERA_C_REFERENCE {}", dir.display());
    }
}
