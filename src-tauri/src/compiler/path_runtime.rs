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
            } => Some(PathSpec {
                id: sanitize(entity_id),
                var_name: var_name.clone(),
                start_x: *start_x,
                start_y: *start_y,
                mode: mode.clone(),
                points: points.clone(),
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
        out.push_str(&format!(
            "static u8 rds_path_{id}_seg = 0; static s8 rds_path_{id}_dir = 1; static u8 rds_path_{id}_done = 0;\n\
             static u16 rds_path_{id}_t = 0; static u16 rds_path_{id}_hold = 0;\n"
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
        let seg_frames = if path.mode == "pingpong" {
            format!("rds_path_{id}_frames[rds_path_{id}_dir > 0 ? b : a]")
        } else {
            format!("rds_path_{id}_frames[b]")
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
             {pad}    if (!rds_path_{id}_done) {{\n\
             {pad}        if (rds_path_{id}_hold > 0) {{ rds_path_{id}_hold--; }}\n\
             {pad}        else {{\n\
             {pad}            u16 f = {seg_frames};\n\
             {pad}            rds_path_{id}_t++;\n\
             {pad}            px += ((s32)(rds_path_{id}_px[b] - rds_path_{id}_px[a]) * rds_path_{id}_t) / f;\n\
             {pad}            py += ((s32)(rds_path_{id}_py[b] - rds_path_{id}_py[a]) * rds_path_{id}_t) / f;\n\
             {pad}            if (rds_path_{id}_t >= f) {{ rds_path_{id}_t = 0; rds_path_{id}_seg = b; rds_path_{id}_hold = rds_path_{id}_wait[b]; {on_arrive}}}\n\
             {pad}        }}\n\
             {pad}    }}\n\
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
        assert!(update.contains("u16 f = rds_path_plat_1_frames[rds_path_plat_1_dir > 0 ? b : a];"));
    }

    #[test]
    fn loop_returns_through_point_zero_and_once_stops_at_the_end() {
        let looped = render_updates(&ast_with("loop", vec![(0, 0, 20, 0), (32, 0, 20, 0)]), 0);
        assert!(looped.contains("b = (rds_path_plat_1_seg + 1) % 2"));
        assert!(!looped.contains("_done = 1"));
        let once = render_updates(&ast_with("once", vec![(0, 0, 0, 0), (32, 0, 20, 5)]), 0);
        assert!(once.contains("if (rds_path_plat_1_seg == 1) rds_path_plat_1_done = 1;"));
    }
}
