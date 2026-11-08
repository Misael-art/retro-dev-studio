//! Trajetos autorais de objeto (Experimental, R5) para Mega Drive/SGDK.
//!
//! Cada trajeto e uma lista de pontos relativos a posicao inicial, em retas/Bezier quadraticas.
//! `frames` e o tempo para CHEGAR ao ponto e `wait` a pausa ao chegar. Modos:
//! - `once`: para no ultimo ponto;
//! - `loop`: do ultimo ponto volta ao ponto 0 usando `frames` do ponto 0 (sem salto escondido);
//! - `pingpong`: inverte a direcao nas pontas.
//!
//! Custo logico: 13 x N bytes em tabelas `const` na ROM e 12 bytes em RAM por trajeto
//! (sem contar alinhamento). Por quadro ativo: duas divisoes s32, lineares ou quadraticas.
//! Pausar conserva posicao/fase/espera e zera dx/dy; iniciar retoma, e once concluido fica no fim.
//! O trajeto escreve `<sprite>_x/_y` depois da
//! logica do quadro, entao ele e o dono da posicao (a build recusa fisica/entrada no mesmo objeto).

use super::ast_generator::{collect_physics_applications, AstNode, AstOutput};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathSpec {
    pub id: String,
    pub var_name: String,
    pub start_x: i32,
    pub start_y: i32,
    pub mode: String,
    pub points: Vec<(i32, i32, u32, u32)>,
    pub curves: Vec<Option<(i32, i32)>>,
    pub autostart: bool,
    pub platform: Option<(i32, i32, u32)>,
}

/// C identifier fragment for an object's path (shared with `LogicOp::PathControl`).
pub fn path_id(entity_id: &str) -> String {
    sanitize(entity_id)
}

fn sanitize(id: &str) -> String {
    let s: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    if s.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        format!("p_{s}")
    } else {
        s
    }
}

pub fn collect_paths(ast: &AstOutput) -> Vec<PathSpec> {
    ast.nodes
        .iter()
        .filter_map(|node| match node {
            AstNode::ObjectPath {
                entity_id,
                var_name,
                start_x,
                start_y,
                mode,
                points,
                curves,
                autostart,
                platform,
            } => Some(PathSpec {
                id: sanitize(entity_id),
                var_name: var_name.clone(),
                start_x: *start_x,
                start_y: *start_y,
                mode: mode.clone(),
                points: points.clone(),
                curves: curves.clone(),
                autostart: *autostart,
                platform: *platform,
            }),
            _ => None,
        })
        .collect()
}

fn table<T: ToString>(values: impl Iterator<Item = T>) -> String {
    values.map(|v| v.to_string()).collect::<Vec<_>>().join(", ")
}

/// Declaracoes globais: tabelas constantes e estado observavel na RAM (`rds_path_<id>_seg`...).
pub fn render_decls(ast: &AstOutput) -> String {
    let mut out = String::new();
    for path in collect_paths(ast) {
        let id = &path.id;
        let n = path.points.len();
        out.push_str(&format!(
            "static const s16 rds_path_{id}_px[{n}] = {{ {} }};\n",
            table(path.points.iter().map(|p| p.0))
        ));
        out.push_str(&format!(
            "static const s16 rds_path_{id}_py[{n}] = {{ {} }};\n",
            table(path.points.iter().map(|p| p.1))
        ));
        out.push_str(&format!(
            "static const u16 rds_path_{id}_frames[{n}] = {{ {} }};\n",
            table(path.points.iter().map(|p| p.2))
        ));
        out.push_str(&format!(
            "static const u16 rds_path_{id}_wait[{n}] = {{ {} }};\n",
            table(path.points.iter().map(|p| p.3))
        ));
        let curve = |pick: fn(&(i32, i32)) -> i32| {
            table((0..n).map(|i| {
                path.curves
                    .get(i)
                    .copied()
                    .flatten()
                    .map(|c| pick(&c))
                    .unwrap_or(0)
            }))
        };
        out.push_str(&format!(
            "static const s16 rds_path_{id}_cx[{n}] = {{ {} }};\n",
            curve(|c| c.0)
        ));
        out.push_str(&format!(
            "static const s16 rds_path_{id}_cy[{n}] = {{ {} }};\n",
            curve(|c| c.1)
        ));
        out.push_str(&format!(
            "static const u8 rds_path_{id}_hc[{n}] = {{ {} }};\n",
            table((0..n).map(|i| u8::from(matches!(path.curves.get(i), Some(Some(_))))))
        ));
        out.push_str(&format!(
            "static u8 rds_path_{id}_seg = 0; static s8 rds_path_{id}_dir = 1; static u8 rds_path_{id}_done = 0;\n\
             static u16 rds_path_{id}_t = 0; static u16 rds_path_{id}_hold = {initial_wait};\n\
             static u8 rds_path_{id}_on = {on};\n\
             static s16 rds_path_{id}_dx = 0; static s16 rds_path_{id}_dy = 0;\n",
            on = u8::from(path.autostart),
            initial_wait = path.points[0].3,
        ));
    }
    if !collect_platforms(ast).is_empty() && !platform_actors(ast).is_empty() {
        out.push_str(include_str!("path_contact_template.c"));
        for (var, _, _) in platform_actors(ast) {
            out.push_str(&format!("static s16 rds_path_support_{var} = -1;\n"));
        }
    }
    out
}

/// The current platform contract applies to gravity bodies with a collision-map ground probe.
fn platform_actors(ast: &AstOutput) -> Vec<(String, u32, u32)> {
    collect_physics_applications(ast)
        .into_iter()
        .filter_map(|body| {
            if !body.gravity {
                return None;
            }
            body.ground
                .map(|ground| (body.var_name, ground.body_width, ground.body_height))
        })
        .collect()
}

/// Snapshot before physics, once per game frame. No work is emitted in scenes without platforms.
pub fn render_platform_snapshots(ast: &AstOutput, indent: usize) -> String {
    if collect_platforms(ast).is_empty() {
        return String::new();
    }
    let pad = " ".repeat(indent);
    platform_actors(ast)
        .into_iter()
        .map(|(var, _, _)| {
            format!("{pad}s16 rds_path_pre_{var}_x = {var}_x, rds_path_pre_{var}_y = {var}_y;\n")
        })
        .collect()
}

/// Resolve relative swept top contact after both physics and path advancement. A body is carried
/// once, by the earliest surface; ties retain its previous support, then scene order.
pub fn render_platform_transport(ast: &AstOutput, indent: usize) -> String {
    let platforms = collect_platforms(ast);
    if platforms.is_empty() {
        return String::new();
    }
    let pad = " ".repeat(indent);
    let mut out = String::new();
    for (var, bw, bh) in platform_actors(ast) {
        out.push_str(&format!(
            "{pad}{{ RdsPathContact rds_best = {{0,0,0,1}}, rds_candidate = {{0,0,0,1}}; s16 rds_support = -1;\n"
        ));
        for (index, (id, platform, ox, oy, width)) in platforms.iter().enumerate() {
            if platform == &var {
                continue;
            }
            out.push_str(&format!(
                "{pad}  if (rds_path_top_contact(rds_path_pre_{var}_x, rds_path_pre_{var}_y, {var}_x, {var}_y, {bw}, {bh}, {var}_vel_y,\n\
                 {pad}      {platform}_x - rds_path_{id}_dx + ({ox}), {platform}_y - rds_path_{id}_dy + ({oy}), {platform}_x + ({ox}), {platform}_y + ({oy}), {width}, rds_path_support_{var} == {index}, &rds_candidate)) {{\n\
                 {pad}    if (rds_support < 0 || rds_path_contact_before(&rds_candidate, &rds_best) || (rds_path_support_{var} == {index} && !rds_path_contact_before(&rds_best, &rds_candidate))) {{ rds_best = rds_candidate; rds_support = {index}; }}\n\
                 {pad}  }}\n"
            ));
        }
        out.push_str(&format!(
            "{pad}  if (rds_support >= 0) {{ {var}_x = rds_best.x; {var}_y = rds_best.y; {var}_vel_y = 0; {var}_on_ground = 1; SPR_setPosition({var}, {var}_x, {var}_y); }}\n\
             {pad}  else if (rds_path_support_{var} >= 0 && {var}_vel_y < 0) {{ {var}_on_ground = 0; }}\n\
             {pad}  rds_path_support_{var} = rds_support;\n{pad}}}\n"
        ));
    }
    out
}

/// Atualizacao por quadro (dentro do laco do jogo, depois da logica).
pub fn render_updates(ast: &AstOutput, indent: usize) -> String {
    let pad = " ".repeat(indent);
    let mut out = String::new();
    for path in collect_paths(ast) {
        let id = &path.id;
        let var = &path.var_name;
        let last = path.points.len() - 1;
        let next = match path.mode.as_str() {
            "loop" => format!("(rds_path_{id}_seg + 1) % {}", last + 1),
            "pingpong" => format!("rds_path_{id}_seg + rds_path_{id}_dir"),
            _ => format!("rds_path_{id}_seg + 1"),
        };
        // Segment time: in pingpong the way back reuses the time of the way out (frames of
        // the higher index), so point 0's unused frames never becomes a divisor.
        // The same index picks the segment's time and curve control, so the way back of a
        // pingpong retraces the same curve and point 0's unused frames never divide.
        let seg_index = if path.mode == "pingpong" {
            format!("(rds_path_{id}_dir > 0 ? b : a)")
        } else {
            "b".to_string()
        };
        let on_arrive = match path.mode.as_str() {
            "loop" => String::new(),
            "pingpong" => format!(
                "if (rds_path_{id}_seg == {last}) rds_path_{id}_dir = -1; else if (rds_path_{id}_seg == 0) rds_path_{id}_dir = 1; "
            ),
            _ => format!("if (rds_path_{id}_seg == {last} && rds_path_{id}_hold == 0) rds_path_{id}_done = 1; "),
        };
        let after_hold = if path.mode == "once" {
            format!("if (rds_path_{id}_seg == {last} && rds_path_{id}_hold == 0) rds_path_{id}_done = 1;")
        } else {
            String::new()
        };
        out.push_str(&format!(
            "{pad}{{ /* trajeto {id} ({mode}) */\n\
             {pad}    u16 a = rds_path_{id}_seg; u16 b = {next};\n\
             {pad}    s32 px = {var}_x - ({sx}); s32 py = {var}_y - ({sy});\n\
             {pad}    if (!rds_path_{id}_done && rds_path_{id}_on) {{\n\
             {pad}        if (rds_path_{id}_hold > 0) {{ rds_path_{id}_hold--; {after_hold} }}\n\
             {pad}        else {{\n\
             {pad}            px = rds_path_{id}_px[a]; py = rds_path_{id}_py[a];\n\
             {pad}            u16 ci = {seg_index}; s32 f = rds_path_{id}_frames[ci];\n\
             {pad}            s32 t = ++rds_path_{id}_t; s32 u = f - t;\n\
             {pad}            if (rds_path_{id}_hc[ci]) {{ /* Bezier quadratica: pesos somam f*f (cabe em s32) */\n\
             {pad}                s32 ff = f * f;\n\
             {pad}                px = (rds_path_{id}_px[a] * u * u + 2 * rds_path_{id}_cx[ci] * u * t + rds_path_{id}_px[b] * t * t) / ff;\n\
             {pad}                py = (rds_path_{id}_py[a] * u * u + 2 * rds_path_{id}_cy[ci] * u * t + rds_path_{id}_py[b] * t * t) / ff;\n\
             {pad}            }} else {{\n\
             {pad}                px += ((s32)(rds_path_{id}_px[b] - rds_path_{id}_px[a]) * t) / f;\n\
             {pad}                py += ((s32)(rds_path_{id}_py[b] - rds_path_{id}_py[a]) * t) / f;\n\
             {pad}            }}\n\
             {pad}            if (t >= f) {{ rds_path_{id}_t = 0; rds_path_{id}_seg = b; rds_path_{id}_hold = rds_path_{id}_wait[b]; {on_arrive}}}\n\
             {pad}        }}\n\
             {pad}    }}\n\
             {pad}    rds_path_{id}_dx = ({sx} + px) - {var}_x; rds_path_{id}_dy = ({sy} + py) - {var}_y;\n\
             {pad}    {var}_x = {sx} + px; {var}_y = {sy} + py;\n\
             {pad}    SPR_setPosition({var}, {var}_x, {var}_y);\n\
             {pad}}}\n",
            mode = path.mode,
            sx = path.start_x,
            sy = path.start_y,
        ));
    }
    out
}

/// Moving platform: (path id, sprite var, box offset x, offset y, width).
pub type PlatformSpec = (String, String, i32, i32, u32);

pub fn collect_platforms(ast: &AstOutput) -> Vec<PlatformSpec> {
    collect_paths(ast)
        .into_iter()
        .filter_map(|p| p.platform.map(|(ox, oy, w)| (p.id, p.var_name, ox, oy, w)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ast_with(mode: &str, points: Vec<(i32, i32, u32, u32)>) -> AstOutput {
        AstOutput {
            nodes: vec![AstNode::ObjectPath {
                entity_id: "plat-1".to_string(),
                var_name: "spr_plat".to_string(),
                start_x: 100,
                start_y: 50,
                mode: mode.to_string(),
                curves: vec![None; points.len()],
                autostart: mode != "once",
                platform: None,
                points,
            }],
            sprite_assets: Vec::new(),
            logic_scripts: Vec::new(),
        }
    }

    #[test]
    fn emits_rom_tables_and_owns_sprite_position_each_frame() {
        let ast = ast_with(
            "pingpong",
            vec![(0, 0, 0, 0), (64, 0, 32, 10), (64, -16, 8, 0)],
        );
        let decls = render_decls(&ast);
        assert!(decls.contains("static const s16 rds_path_plat_1_px[3] = { 0, 64, 64 };"));
        assert!(decls.contains("static const u16 rds_path_plat_1_frames[3] = { 0, 32, 8 };"));
        assert!(decls.contains("static const u16 rds_path_plat_1_wait[3] = { 0, 10, 0 };"));
        let update = render_updates(&ast, 4);
        assert!(update.contains("spr_plat_x = 100 + px; spr_plat_y = 50 + py;"));
        assert!(update.contains("SPR_setPosition(spr_plat, spr_plat_x, spr_plat_y);"));
        assert!(update.contains("rds_path_plat_1_dir = -1"));
        assert!(update.contains("b = rds_path_plat_1_seg + rds_path_plat_1_dir"));
        assert!(update.contains("u16 ci = (rds_path_plat_1_dir > 0 ? b : a);"));
        assert!(decls.contains("static const u8 rds_path_plat_1_hc[3] = { 0, 0, 0 };"));
    }

    #[test]
    fn loop_returns_through_point_zero_and_once_stops_at_the_end() {
        let looped = render_updates(&ast_with("loop", vec![(0, 0, 20, 0), (32, 0, 20, 0)]), 0);
        assert!(looped.contains("b = (rds_path_plat_1_seg + 1) % 2"));
        assert!(!looped.contains("_done = 1"));
        let once = render_updates(&ast_with("once", vec![(0, 0, 0, 0), (32, 0, 20, 5)]), 0);
        assert!(once.contains(
            "if (rds_path_plat_1_seg == 1 && rds_path_plat_1_hold == 0) rds_path_plat_1_done = 1;"
        ));
    }

    #[test]
    fn curve_control_is_emitted_and_used_with_the_segment_index() {
        let mut ast = ast_with("loop", vec![(0, 0, 20, 0), (64, 0, 30, 0)]);
        if let AstNode::ObjectPath { curves, .. } = &mut ast.nodes[0] {
            curves[1] = Some((32, -48));
        }
        let decls = render_decls(&ast);
        assert!(decls.contains("static const s16 rds_path_plat_1_cx[2] = { 0, 32 };"));
        assert!(decls.contains("static const s16 rds_path_plat_1_cy[2] = { 0, -48 };"));
        assert!(decls.contains("static const u8 rds_path_plat_1_hc[2] = { 0, 1 };"));
        let update = render_updates(&ast, 0);
        assert!(update.contains("u16 ci = b;"));
        assert!(update.contains("if (rds_path_plat_1_hc[ci])"));
        assert!(update.contains("2 * rds_path_plat_1_cx[ci] * u * t"));
    }

    /// Mirrors the emitted integer formula; the worst case must fit in s32.
    #[test]
    fn quadratic_integer_formula_hits_endpoints_and_stays_in_s32() {
        let eval = |a: i64, c: i64, b: i64, f: i64, t: i64| {
            let u = f - t;
            (a * u * u + 2 * c * u * t + b * t * t) / (f * f)
        };
        assert_eq!(eval(0, 32, 64, 30, 0), 0);
        assert_eq!(eval(0, 32, 64, 30, 30), 64);
        assert_eq!(eval(0, -48, 0, 30, 15), -24);
        let worst = 2048_i64 * 600 * 600;
        assert!(worst < i32::MAX as i64, "{worst}");
    }

    #[test]
    fn on_state_gates_the_update_and_follows_autostart() {
        let started = ast_with("loop", vec![(0, 0, 20, 0), (32, 0, 20, 0)]);
        assert!(render_decls(&started).contains("static u8 rds_path_plat_1_on = 1;"));
        assert!(render_updates(&started, 0)
            .contains("if (!rds_path_plat_1_done && rds_path_plat_1_on)"));
        let waiting = ast_with("once", vec![(0, 0, 0, 0), (32, 0, 20, 0)]);
        assert!(render_decls(&waiting).contains("static u8 rds_path_plat_1_on = 0;"));
        assert_eq!(path_id("plat-1"), "plat_1");
    }

    #[test]
    fn records_frame_delta_and_lists_only_solid_paths_as_platforms() {
        let mut ast = ast_with("pingpong", vec![(0, 0, 0, 0), (64, 0, 32, 0)]);
        assert!(collect_platforms(&ast).is_empty());
        assert!(render_updates(&ast, 0).contains("rds_path_plat_1_dx = (100 + px) - spr_plat_x;"));
        assert!(render_decls(&ast).contains("static s16 rds_path_plat_1_dx = 0;"));
        if let AstNode::ObjectPath { platform, .. } = &mut ast.nodes[0] {
            *platform = Some((0, 2, 32));
        }
        assert_eq!(
            collect_platforms(&ast),
            vec![("plat_1".to_string(), "spr_plat".to_string(), 0, 2, 32)]
        );
    }

    /// Execute the actual emitted C, not a second interpolation implementation.
    #[cfg(unix)]
    #[test]
    fn generated_c_preserves_phase_position_and_waits_across_pause() {
        use crate::core::rom_mastering::sha256_hex;
        use std::{fs, process::Command};
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("rds-path-reference-{}-{stamp}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for mode in ["once", "loop", "pingpong"] {
            for curved in [false, true] {
                let mut ast = ast_with(mode, vec![(0, 0, 32, 7), (64, 0, 32, 11)]);
                if let AstNode::ObjectPath {
                    autostart, curves, ..
                } = &mut ast.nodes[0]
                {
                    *autostart = true;
                    if curved {
                        curves[1] = Some((32, -48));
                    }
                }
                let name = format!("{mode}-{}", if curved { "curve" } else { "line" });
                let source = format!(
                    r#"
#include <assert.h>
#include <stdint.h>
typedef int8_t s8; typedef uint8_t u8; typedef int16_t s16; typedef uint16_t u16; typedef int32_t s32;
static s16 spr_plat_x = 100, spr_plat_y = 50;
#define SPR_setPosition(s,x,y) ((void)(x), (void)(y))
{decls}
static void tick(void) {{ {update} }}
int main(void) {{
  s16 expected_x[180], expected_y[180];
  u16 i;
  for(i=0;i<180;i++) {{ tick(); expected_x[i]=spr_plat_x; expected_y[i]=spr_plat_y; }}
  /* Independent checkpoints: initial wait, first segment midpoint, endpoint. */
  assert(expected_x[6]==100 && expected_y[6]==50);
  assert(expected_x[22]==132 && expected_y[22]=={mid_y});
  assert(expected_x[38]==164 && expected_y[38]==50);
  rds_path_plat_1_seg=0; rds_path_plat_1_dir=1; rds_path_plat_1_done=0;
  rds_path_plat_1_t=0; rds_path_plat_1_hold=7; rds_path_plat_1_on=1;
  spr_plat_x=100; spr_plat_y=50;
  for(i=0;i<180;i++) {{
    tick(); assert(spr_plat_x==expected_x[i] && spr_plat_y==expected_y[i]);
    if(i==0 || i==22 || i==38 || i==43 || i==75 || i==123) {{
      s16 x=spr_plat_x,y=spr_plat_y; u16 t=rds_path_plat_1_t, hold=rds_path_plat_1_hold;
      u8 seg=rds_path_plat_1_seg,done=rds_path_plat_1_done; s8 dir=rds_path_plat_1_dir;
      u16 j; rds_path_plat_1_on=0;
      for(j=0;j<13;j++) {{
        tick(); assert(spr_plat_x==x && spr_plat_y==y);
        assert(rds_path_plat_1_dx==0 && rds_path_plat_1_dy==0);
        assert(rds_path_plat_1_t==t && rds_path_plat_1_hold==hold);
        assert(rds_path_plat_1_seg==seg && rds_path_plat_1_done==done && rds_path_plat_1_dir==dir);
      }}
      rds_path_plat_1_on=1;
    }}
  }}
  {finished}
  return 0;
}}
"#,
                    decls = render_decls(&ast),
                    update = render_updates(&ast, 2),
                    mid_y = if curved { 26 } else { 50 },
                    finished = if mode == "once" {
                        "assert(rds_path_plat_1_done==1 && rds_path_plat_1_hold==0 && spr_plat_x==164);"
                    } else {
                        "assert(rds_path_plat_1_done==0);"
                    },
                );
                let c = dir.join(format!("{name}.c"));
                let exe = dir.join(&name);
                fs::write(&c, &source).unwrap();
                let compile = Command::new("cc")
                    .args(["-std=c99", "-Wall", "-Wextra", "-Werror"])
                    .arg(&c)
                    .arg("-o")
                    .arg(&exe)
                    .output()
                    .expect("C compiler required by host certificate");
                assert!(
                    compile.status.success(),
                    "{name}: {}",
                    String::from_utf8_lossy(&compile.stderr)
                );
                let run = Command::new(&exe).output().unwrap();
                assert!(
                    run.status.success(),
                    "{name}: {}",
                    String::from_utf8_lossy(&run.stderr)
                );
                fs::write(dir.join(format!("{name}.json")), serde_json::to_vec_pretty(&serde_json::json!({
                    "tier":"host_c_reference", "case":name, "status":"passed", "source_sha256":sha256_hex(source.as_bytes()),
                    "coverage":"pause at initial wait, segment midpoint, arrival, endpoint wait, reverse and completion; no-pause control"
                })).unwrap()).unwrap();
            }
        }
        println!("PATH_C_REFERENCE {}", dir.display());
    }

    #[cfg(unix)]
    #[test]
    fn top_contact_covers_vertical_motion_fast_crossing_edges_jump_and_two_surfaces() {
        use crate::core::rom_mastering::sha256_hex;
        use std::{fs, process::Command};
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("rds-path-contact-{}-{stamp}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let source = [
            "#include <assert.h>\n#include <stdint.h>\ntypedef uint8_t u8; typedef uint16_t u16; typedef int16_t s16; typedef int32_t s32;\n",
            include_str!("path_contact_template.c"),
            r#"
int main(void) {
    RdsPathContact c = {123, 456, 0, 1}, early, late;
    /* Attached descending/rising surfaces retain exact feet, without a 4px tolerance. */
    assert(rds_path_top_contact(44,84,44,84,8,16,0,40,100,40,104,32,1,&c));
    assert(c.x==44 && c.y==88);
    assert(rds_path_top_contact(44,84,44,84,8,16,0,40,100,40,92,32,1,&c));
    assert(c.x==44 && c.y==76);
    /* Fast horizontal motion, reversal and pause use this frame's displacement. */
    assert(rds_path_top_contact(44,84,44,84,8,16,0,40,100,72,100,32,1,&c));
    assert(c.x==76 && c.y==84);
    assert(rds_path_top_contact(44,84,44,84,8,16,0,40,100,8,100,32,1,&c));
    assert(c.x==12 && c.y==84);
    assert(rds_path_top_contact(44,84,44,84,8,16,0,40,100,40,100,32,1,&c));
    assert(c.x==44 && c.y==84);
    /* Edge departure, jumping and contact from below do not attach or alter output. */
    c.x=123; c.y=456;
    assert(!rds_path_top_contact(44,84,80,84,8,16,0,40,100,40,100,32,1,&c));
    assert(!rds_path_top_contact(44,84,44,83,8,16,-16,40,100,40,104,32,1,&c));
    assert(!rds_path_top_contact(44,90,44,90,8,16,0,40,100,40,92,32,0,&c));
    assert(c.x==123 && c.y==456);
    /* Relative sweep catches a rising surface and a fast horizontal crossing. */
    assert(rds_path_top_contact(44,70,44,90,8,16,32,40,100,48,92,32,0,&c));
    assert(c.x==48 && c.y==76 && c.time_n==14 && c.time_d==28);
    assert(rds_path_top_contact(40,70,40,98,8,16,32,0,100,64,100,32,0,&c));
    assert(c.x==72 && c.y==84);
    /* A falling actor cannot catch a descending platform that moves away faster. */
    assert(!rds_path_top_contact(44,70,44,90,8,16,32,40,100,40,116,32,0,&c));
    assert(rds_path_top_contact(44,64,44,104,8,16,32,40,90,40,90,32,0,&early));
    assert(rds_path_top_contact(44,64,44,104,8,16,32,40,100,40,100,32,0,&late));
    assert(rds_path_contact_before(&early,&late));
    assert(!rds_path_contact_before(&late,&early));
    assert(!rds_path_contact_before(&early,&early));
    /* Signed world coordinates are preserved, without unsigned wrap. */
    assert(rds_path_top_contact(-20,-16,-20,-16,8,16,0,-24,0,-28,-4,32,1,&c));
    assert(c.x==-24 && c.y==-20);
    return 0;
}
"#,
        ].concat();
        let c = dir.join("contacts.c");
        let exe = dir.join("contacts");
        fs::write(&c, &source).unwrap();
        let compile = Command::new("cc")
            .args(["-std=c99", "-Wall", "-Wextra", "-Werror"])
            .arg(&c)
            .arg("-o")
            .arg(&exe)
            .output()
            .expect("C compiler required by host certificate");
        assert!(
            compile.status.success(),
            "{}",
            String::from_utf8_lossy(&compile.stderr)
        );
        let run = Command::new(&exe).output().unwrap();
        assert!(
            run.status.success(),
            "{}",
            String::from_utf8_lossy(&run.stderr)
        );
        fs::write(dir.join("contacts.json"), serde_json::to_vec_pretty(&serde_json::json!({
            "tier":"host_c_reference", "status":"passed", "source_sha256":sha256_hex(source.as_bytes()),
            "coverage":"vertical, fast horizontal crossing, pause/reversal, edge, jump, underside, support ordering and signed coordinates",
            "limits":"one-way top contact; ROM/core, terrain/crush policy and target CPU cost require separate proof"
        })).unwrap()).unwrap();
        println!("PATH_CONTACT_C_REFERENCE {}", dir.display());
    }

    #[test]
    fn canonical_emitter_snapshots_before_physics_and_transports_after_current_path_step() {
        use super::super::ast_generator::generate_ast;
        use crate::ugdm::entities::{Project, Scene};
        let project: Project = serde_json::from_value(serde_json::json!({
            "rds_version":"1.0", "schema_version":crate::ugdm::entities::CURRENT_SCHEMA_VERSION,
            "name":"Platform contact regression", "target":"megadrive", "resolution":{"width":320,"height":224},
            "fps":60, "palette_mode":"4x16", "entry_scene":"scenes/main.json"
        })).unwrap();
        let mut scene: Scene = serde_json::from_value(serde_json::json!({
            "scene_id":"main", "background_layers":[], "palettes":[],
            "collision_map":{"width":40,"height":28,"tile_width":8,"tile_height":8,"data":vec![0u8;40*28]},
            "entities":[
                {"entity_id":"actor","transform":{"x":44,"y":84},"components":{
                    "sprite":{"asset":"actor.png","frame_width":8,"frame_height":16},
                    "physics":{"gravity":true,"gravity_strength":6,"max_velocity":{"x":32,"y":128},"friction":0,"bounce":0}
                }},
                {"entity_id":"lift","transform":{"x":40,"y":100},"components":{
                    "sprite":{"asset":"lift.png","frame_width":32,"frame_height":8},
                    "collision":{"shape":"rect","solid":true,"width":32,"height":8,"offset":{"x":0,"y":0}},
                    "path":{"mode":"pingpong","points":[{"x":0,"y":0},{"x":64,"y":32,"frames":16}]}
                }}
            ]
        })).unwrap();
        let ast = generate_ast(&project, &scene);
        let c = super::super::sgdk_emitter::emit_sgdk_with_collision(
            &ast,
            &project.name,
            Some(&vec![0u8; 40 * 28]),
        )
        .main_c;
        let snapshot = c
            .find("s16 rds_path_pre_spr_actor_x")
            .expect("actor snapshot");
        let physics = c.find("spr_actor_vel_y +=").expect("canonical physics");
        let path = c
            .find("/* trajeto lift (pingpong) */")
            .expect("path advance");
        let transport = c
            .find("if (rds_path_top_contact(rds_path_pre_spr_actor_x")
            .expect("transport");
        let present = c.rfind("SPR_update();").expect("presentation");
        assert!(snapshot < physics && physics < path && path < transport && transport < present);
        assert!(c.contains("rds_path_support_spr_actor"));
        assert!(!c.contains("rds_pt + 4"));
        // Unrelated scenes do not gain contact state, snapshots, code or another frame clock.
        scene.entities.pop();
        let without = generate_ast(&project, &scene);
        let baseline = super::super::sgdk_emitter::emit_sgdk_with_collision(
            &without,
            &project.name,
            Some(&vec![0u8; 40 * 28]),
        )
        .main_c;
        assert!(!baseline.contains("RdsPathContact"));
        assert!(!baseline.contains("rds_path_pre_"));
        assert!(!baseline.contains("rds_path_support_"));
    }
}
