//! Trajetos autorais de objeto (Experimental, R5) para Mega Drive/SGDK.
//!
//! Cada trajeto e uma lista de pontos relativos a posicao inicial do sprite, percorridos em retas.
//! `frames` e o tempo para CHEGAR ao ponto e `wait` a pausa ao chegar. Modos:
//! - `once`: para no ultimo ponto;
//! - `loop`: do ultimo ponto volta ao ponto 0 usando `frames` do ponto 0 (sem salto escondido);
//! - `pingpong`: inverte a direcao nas pontas.
//!
//! Custo: tabelas `const` em ROM (4 x N valores) e 7 bytes de estado em RAM por trajeto; por quadro,
//! uma interpolacao linear com uma divisao inteira. O trajeto escreve `<sprite>_x/_y` depois da
//! logica do quadro, entao ele e o dono da posicao (a build recusa fisica/entrada no mesmo objeto).

use super::ast_generator::{AstNode, AstOutput};

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
             static u16 rds_path_{id}_t = 0; static u16 rds_path_{id}_hold = 0;\n\
             static u8 rds_path_{id}_on = {on};\n\
             static s16 rds_path_{id}_dx = 0; static s16 rds_path_{id}_dy = 0;\n",
            on = u8::from(path.autostart)
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
            _ => format!("if (rds_path_{id}_seg == {last}) rds_path_{id}_done = 1; "),
        };
        out.push_str(&format!(
            "{pad}{{ /* trajeto {id} ({mode}) */\n\
             {pad}    u16 a = rds_path_{id}_seg; u16 b = {next};\n\
             {pad}    s32 px = rds_path_{id}_px[a]; s32 py = rds_path_{id}_py[a];\n\
             {pad}    if (!rds_path_{id}_done && rds_path_{id}_on) {{\n\
             {pad}        if (rds_path_{id}_hold > 0) {{ rds_path_{id}_hold--; }}\n\
             {pad}        else {{\n\
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
        assert!(once.contains("if (rds_path_plat_1_seg == 1) rds_path_plat_1_done = 1;"));
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
}
