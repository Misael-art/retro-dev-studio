//! Texto de interface autoral (Experimental, REQ-15) para Mega Drive/SGDK.
//!
//! Cada `HudText` desenha `label` na grade de texto (tiles de 8 px) ao iniciar e, se houver valor
//! ligado, escreve o numero logo depois do rotulo, redesenhando so quando o valor muda.
//! `rds_hud_<id>_shown` guarda o ultimo valor desenhado (observavel na RAM). Limites do destino
//! validados no build: grade H40 de 40x28, fonte padrao SGDK so com ASCII imprimivel.

use std::collections::BTreeSet;

use super::ast_generator::{AstNode, AstOutput, LogicOp};

pub const TEXT_COLUMNS: u32 = 40;
pub const TEXT_ROWS: u32 = 28;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HudSpec {
    pub id: String,
    pub entity_id: String,
    pub column: u32,
    pub row: u32,
    pub label: String,
    pub binding: Option<(String, String)>,
    pub digits: u8,
}

fn sanitize(id: &str) -> String {
    let s: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    if s.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        format!("h_{s}")
    } else {
        s
    }
}

pub fn collect_huds(ast: &AstOutput) -> Vec<HudSpec> {
    ast.nodes
        .iter()
        .filter_map(|node| match node {
            AstNode::HudText {
                entity_id,
                column,
                row,
                label,
                binding,
                digits,
            } => Some(HudSpec {
                id: sanitize(entity_id),
                entity_id: entity_id.clone(),
                column: *column,
                row: *row,
                label: label.clone(),
                binding: binding.clone(),
                digits: *digits,
            }),
            _ => None,
        })
        .collect()
}

fn strike_ids(ast: &AstOutput) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    fn walk(ops: &[LogicOp], out: &mut BTreeSet<String>) {
        for op in ops {
            match op {
                LogicOp::AuthoredStrike { strike_id, .. } => {
                    out.insert(strike_id.clone());
                }
                LogicOp::SourceMapped { op, .. } => walk(std::slice::from_ref(op.as_ref()), out),
                LogicOp::ConditionOverlap {
                    if_true, if_false, ..
                }
                | LogicOp::ConditionBool {
                    if_true, if_false, ..
                } => {
                    walk(if_true, out);
                    walk(if_false, out);
                }
                _ => {}
            }
        }
    }
    for script in &ast.logic_scripts {
        walk(&script.ops, &mut out);
    }
    out
}

/// Motivo de recusa (bloqueia o build) ou expressao C do valor ligado.
pub fn validate(
    hud: &HudSpec,
    logic_vars: &BTreeSet<String>,
    ast: &AstOutput,
) -> Result<Option<String>, String> {
    if let Some(bad) = hud.label.chars().find(|c| !(' '..='~').contains(c)) {
        return Err(format!(
            "texto '{}' usa '{bad}', fora da fonte padrao do destino (ASCII imprimivel)",
            hud.entity_id
        ));
    }
    if hud.digits == 0 || hud.digits > 5 {
        return Err(format!(
            "texto '{}': digitos {} fora de 1..=5",
            hud.entity_id, hud.digits
        ));
    }
    let width = hud.label.chars().count() as u32
        + if hud.binding.is_some() {
            hud.digits as u32
        } else {
            0
        };
    if hud.row >= TEXT_ROWS || hud.column + width > TEXT_COLUMNS {
        return Err(format!(
            "texto '{}' em ({}, {}) com {width} caracteres sai da grade {TEXT_COLUMNS}x{TEXT_ROWS}",
            hud.entity_id, hud.column, hud.row
        ));
    }
    match &hud.binding {
        None => Ok(None),
        Some((kind, source)) if kind == "strike_hp" => {
            let id = sanitize(source);
            if strike_ids(ast).contains(&id) {
                Ok(Some(format!("rds_strike_{id}_hp")))
            } else {
                Err(format!(
                    "texto '{}' ligado a vida do golpe '{source}', que nao existe nos comportamentos",
                    hud.entity_id
                ))
            }
        }
        Some((kind, source)) if kind == "logic_var" => {
            if logic_vars.contains(source) {
                Ok(Some(format!("(u16)logic_var_{source}")))
            } else {
                Err(format!(
                    "texto '{}' ligado a variavel '{source}', que nao existe nos comportamentos",
                    hud.entity_id
                ))
            }
        }
        Some((kind, _)) => Err(format!(
            "texto '{}': vinculo '{kind}' nao suportado (strike_hp ou logic_var)",
            hud.entity_id
        )),
    }
}

/// Declaracoes (depois do runtime MUGEN, que define os golpes) e erros de validacao.
pub fn render_decls(ast: &AstOutput, logic_vars: &BTreeSet<String>) -> String {
    let mut out = String::new();
    for hud in collect_huds(ast) {
        match validate(&hud, logic_vars, ast) {
            Err(why) => out.push_str(&format!(
                "#error \"RetroDev HUD: {}\"\n",
                why.replace('"', "'")
            )),
            Ok(Some(_)) => out.push_str(&format!(
                "static volatile u16 rds_hud_{}_shown = 0xFFFF;\n",
                hud.id
            )),
            Ok(None) => {}
        }
    }
    out
}

/// Com camera de mundo, os planos A/B rolam com a camera; o texto da interface passa para o plano
/// WINDOW (fixo na tela), cobrindo so as linhas do HUD: do topo ate a ultima linha usada, ou da
/// primeira linha usada ate o fim. Nessas linhas o plano A fica coberto (limite declarado). HUD nas
/// duas metades da tela ao mesmo tempo nao cabe numa janela e bloqueia o build.
pub fn render_window_setup(ast: &AstOutput, logic_vars: &BTreeSet<String>) -> String {
    let rows: Vec<u32> = collect_huds(ast)
        .into_iter()
        .filter(|hud| validate(hud, logic_vars, ast).is_ok())
        .map(|hud| hud.row)
        .collect();
    let (Some(&min), Some(&max)) = (rows.iter().min(), rows.iter().max()) else {
        return String::new();
    };
    let half = TEXT_ROWS / 2;
    let vpos = if max < half {
        format!("VDP_setWindowVPos(FALSE, {});", max + 1)
    } else if min >= half {
        format!("VDP_setWindowVPos(TRUE, {min});")
    } else {
        return format!(
            "#error \"RetroDev HUD: com camera, o texto da interface usa o plano fixo WINDOW, que cobre o topo OU a base da tela; linhas {min} e {max} estao nas duas metades\"\n"
        );
    };
    format!("    VDP_setWindowHPos(FALSE, 0); {vpos} VDP_setTextPlane(WINDOW);\n")
}

/// Desenho inicial do rotulo.
pub fn render_init(hud: &HudSpec) -> String {
    format!(
        "    VDP_drawText(\"{}\", {}, {});\n",
        hud.label.replace('\\', "\\\\").replace('"', "\\\""),
        hud.column,
        hud.row
    )
}

/// Atualizacao por quadro (so redesenha quando o valor muda).
pub fn render_updates(ast: &AstOutput, logic_vars: &BTreeSet<String>, indent: usize) -> String {
    let pad = " ".repeat(indent);
    let mut out = String::new();
    for hud in collect_huds(ast) {
        let Ok(Some(expr)) = validate(&hud, logic_vars, ast) else {
            continue;
        };
        let column = hud.column + hud.label.chars().count() as u32;
        out.push_str(&format!(
            "{pad}{{ const u16 v = {expr}; if (v != rds_hud_{id}_shown) {{ char b[8]; uintToStr(v, b, {digits}); VDP_drawText(b, {column}, {row}); rds_hud_{id}_shown = v; }} }}\n",
            id = hud.id,
            digits = hud.digits,
            row = hud.row
        ));
    }
    out
}
