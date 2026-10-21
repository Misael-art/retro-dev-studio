//! Plano de paletas por cena (Experimental). UMA fonte para editor (IPC), revisao, build e
//! vinculo de execucao: recursos logicos, usos, cores por indice, bancos fisicos, reservas,
//! conflitos e trocas por evento. O modelo e agnostico; o adaptador do destino informa a
//! capacidade (`Capacity`) e a conversao de cor. Hoje so o Mega Drive tem adaptador.
//!
//! Regras (sem sobrescrita silenciosa):
//! - Cada uso (sprite, tilemap, texto) referencia um recurso: explicito (`PaletteEntry` com `id`
//!   cujo `uses` contem a entidade) ou implicito (`asset:<caminho>` com as cores que o build
//!   gera para o arquivo; `fonte:padrao` para o texto, indice 15).
//! - Um recurso explicito com o mesmo `id` de um implicito o substitui (cores editadas, banco fixado).
//! - Bancos: recursos fixados primeiro (banco pedido; incompativel = conflito), depois os demais na
//!   ordem do primeiro uso, cada um num banco livre. Compartilhar banco e escolha explicita (fixar no
//!   banco de outro recurso) e so e aceito se as cores coincidirem nos indices usados por ambos, na
//!   precisao do destino. Sem banco livre = erro com os usos; nada e sobrescrito.
//! - Trocas por evento reescrevem so os indices do recurso alvo no banco; o alcance (usos afetados)
//!   e calculado e, se a troca foi declarada "so esta instancia", outro uso afetado bloqueia.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::ast_generator::{AstNode, AstOutput, LogicOp};
use crate::ugdm::entities::{PaletteEntry, Scene};

pub const SCHEMA: &str = "retrodev.palette_plan/v1";
pub const FONT_RESOURCE: &str = "fonte:padrao";
pub const FONT_INDEX: usize = 15;
pub const FONT_DEFAULT: [u8; 3] = [0xEE, 0xEE, 0xEE];
const SCENE_TEXT_USE: &str = "(texto da cena)";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Capacity {
    pub banks: usize,
    pub colors_per_bank: usize,
}

pub const MEGADRIVE: Capacity = Capacity {
    banks: 4,
    colors_per_bank: 16,
};

/// Cor no destino (Mega Drive, 9 bits): mesma conversao do rescomp do SGDK pinado
/// (`tools/rescomp/.../Util.toVDPColor`: `(c >> 4) & 0xE` por canal).
pub fn md_color(rgb: [u8; 3]) -> u16 {
    let c = |v: u8| u16::from((v >> 4) & 0xE);
    c(rgb[0]) | (c(rgb[1]) << 4) | (c(rgb[2]) << 8)
}

pub fn hex(rgb: [u8; 3]) -> String {
    format!("#{:02X}{:02X}{:02X}", rgb[0], rgb[1], rgb[2])
}

pub fn parse_hex(text: &str) -> Option<[u8; 3]> {
    let t = text.trim().trim_start_matches('#');
    if t.len() != 6 {
        return None;
    }
    let v = u32::from_str_radix(t, 16).ok()?;
    Some([(v >> 16) as u8, (v >> 8) as u8, v as u8])
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanUse {
    pub entity_id: String,
    /// `sprite` | `tilemap` | `font`
    pub role: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset: Option<String>,
    /// Indices de cor que este uso le (do arquivo convertido; fonte = 15).
    pub indices: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanResource {
    pub id: String,
    pub name: String,
    /// `asset` (cores do arquivo) | `asset_editado` | `variante` | `autoral` | `fonte`
    pub origin: String,
    /// 16 entradas; `""` = indice sem cor definida.
    pub colors: Vec<String>,
    pub used_indices: Vec<usize>,
    pub uses: Vec<PlanUse>,
    /// Referencias totais (entidades + trocas que apontam para o recurso).
    pub references: usize,
    /// Usos residentes ao mesmo tempo nesta cena (trocas programadas nao contam).
    pub simultaneous_uses: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_bank: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank: Option<usize>,
    /// `residente` | `programada` | `conflito` | `sem_banco`
    pub state: String,
    /// Pixels levados a cor mais proxima ao converter o arquivo (limite de 16 entradas).
    pub quantized_pixels: usize,
    pub source_colors: usize,
    /// Origem/evidencia de cada campo.
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanBank {
    pub bank: usize,
    pub resources: Vec<String>,
    /// 16 entradas (`""` = sem cor; indice 0 = transparencia / cor de fundo no banco 0).
    pub colors: Vec<String>,
    /// Valores do destino (Mega Drive: 9 bits) que o build carrega.
    pub target_values: Vec<u16>,
    /// `livre` | `em_uso` | `compartilhada` | `reservada` | `conflito`
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanSwap {
    pub id: String,
    /// Disparo: `golpe:<id>` (cada acerto aplicado do golpe autoral).
    pub trigger: String,
    pub target_entity: String,
    pub palette: String,
    pub frames: u16,
    /// `instancia` | `grupo`
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank: Option<usize>,
    pub written_indices: Vec<usize>,
    pub affected_uses: Vec<String>,
    pub on_values: Vec<u16>,
    pub off_values: Vec<u16>,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlanDiagnostic {
    /// `error` | `warning`
    pub severity: String,
    pub code: String,
    pub message: String,
    pub uses: Vec<String>,
    pub resources: Vec<String>,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PalettePlan {
    pub schema: String,
    pub scene_id: String,
    pub target: String,
    pub capacity: Capacity,
    pub resources: Vec<PlanResource>,
    pub banks: Vec<PlanBank>,
    pub swaps: Vec<PlanSwap>,
    pub diagnostics: Vec<PlanDiagnostic>,
    /// Banco de cada uso (entidade -> banco); ausente = sem banco (erro no diagnostico).
    pub entity_banks: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_bank: Option<usize>,
    pub evidence: BTreeMap<String, String>,
}

impl PalettePlan {
    #[allow(dead_code)] // usado pelos testes e pelo teste real; o build filtra por codigo
    pub fn has_errors(&self) -> bool {
        self.diagnostics.iter().any(|d| d.severity == "error")
    }
}

/// Cores derivadas de um asset (o build usa a mesma funcao).
/// Cores (RGB, indice 0 = transparencia), pixels aproximados e cores distintas do arquivo.
pub type AssetColors = (Vec<[u8; 3]>, usize, usize);

pub type AssetPaletteFn<'a> = dyn Fn(
        &str,
        Option<&super::ast_generator::SpriteAsset>,
    ) -> Result<(Vec<[u8; 3]>, usize, usize), String>
    + 'a;

struct Res {
    id: String,
    name: String,
    origin: String,
    colors: Vec<Option<[u8; 3]>>,
    uses: Vec<PlanUse>,
    pinned: Option<usize>,
    quantized: usize,
    source_colors: usize,
    evidence: String,
    first_use: usize,
    swap_refs: usize,
}

impl Res {
    fn used(&self) -> Vec<usize> {
        let mut v: Vec<usize> = self.uses.iter().flat_map(|u| u.indices.clone()).collect();
        v.sort_unstable();
        v.dedup();
        v
    }
}

fn entry_colors(entry: &PaletteEntry) -> Vec<Option<[u8; 3]>> {
    let mut colors: Vec<Option<[u8; 3]>> = entry.colors.iter().map(|c| parse_hex(c)).collect();
    colors.resize(16, None);
    colors.truncate(16);
    colors
}

/// Paletas de troca declaradas nas logicas (`LogicOp::PaletteSwapOnHit`).
pub fn collect_swaps(ast: &AstOutput) -> Vec<(String, String, String, String, u16, String)> {
    fn walk(ops: &[LogicOp], out: &mut Vec<(String, String, String, String, u16, String)>) {
        for op in ops {
            match op {
                LogicOp::PaletteSwapOnHit {
                    swap_id,
                    strike_id,
                    target_entity,
                    palette_id,
                    frames,
                    scope,
                } => {
                    if !out.iter().any(|s| s.0 == *swap_id) {
                        out.push((
                            swap_id.clone(),
                            strike_id.clone(),
                            target_entity.clone(),
                            palette_id.clone(),
                            *frames,
                            scope.clone(),
                        ));
                    }
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
                LogicOp::WhileLoop { body, done, .. } | LogicOp::ForLoop { body, done, .. } => {
                    walk(body, out);
                    walk(done, out);
                }
                LogicOp::HardwareBudgetCheck { if_ok, if_warn, .. } => {
                    walk(if_ok, out);
                    walk(if_warn, out);
                }
                LogicOp::HardwareEvent { ops, .. } => walk(ops, out),
                LogicOp::StateMachine { states, .. } => {
                    for state in states {
                        walk(&state.body, out);
                        for t in &state.transitions {
                            walk(&t.if_matched, out);
                            walk(&t.if_unmatched, out);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    let mut out = Vec::new();
    for script in &ast.logic_scripts {
        walk(&script.ops, &mut out);
    }
    out
}

/// Plano com o adaptador Mega Drive, lendo as cores dos assets do projeto pelo mesmo conversor
/// do build.
pub fn plan_megadrive(project_dir: &Path, scene: &Scene, ast: &AstOutput) -> PalettePlan {
    let palette_of = |path: &str, sprite: Option<&super::ast_generator::SpriteAsset>| {
        super::build_orch::sgdk_asset_palette(project_dir, path, sprite)
    };
    plan(scene, ast, MEGADRIVE, "megadrive", &palette_of)
}

fn bank_colors_for(members: &[usize], resources: &[Res]) -> Vec<Option<[u8; 3]>> {
    let mut colors = vec![None; 16];
    for m in members {
        for i in resources[*m].used() {
            if colors[i].is_none() {
                colors[i] = resources[*m].colors[i];
            }
        }
    }
    colors
}

pub fn plan(
    scene: &Scene,
    ast: &AstOutput,
    capacity: Capacity,
    target: &str,
    asset_palette: &AssetPaletteFn,
) -> PalettePlan {
    let mut diagnostics: Vec<PlanDiagnostic> = Vec::new();
    let diag = |severity: &str,
                code: &str,
                message: String,
                uses: Vec<String>,
                resources: Vec<String>,
                actions: Vec<&str>| PlanDiagnostic {
        severity: severity.to_string(),
        code: code.to_string(),
        message,
        uses,
        resources,
        actions: actions.into_iter().map(str::to_string).collect(),
    };
    let explicit: Vec<&PaletteEntry> = scene.palettes.iter().filter(|p| p.id.is_some()).collect();
    let explicit_by_id = |id: &str| {
        explicit
            .iter()
            .find(|p| p.id.as_deref() == Some(id))
            .copied()
    };
    let mut resources: Vec<Res> = Vec::new();
    let mut derived_cache: BTreeMap<String, Result<AssetColors, String>> = BTreeMap::new();

    // 1. Usos, na ordem das entidades (deterministico).
    let mut uses: Vec<(PlanUse, Option<u8>)> = Vec::new();
    for entity in &scene.entities {
        if let Some(tm) = &entity.components.tilemap {
            uses.push((
                PlanUse {
                    entity_id: entity.entity_id.clone(),
                    role: "tilemap".into(),
                    asset: Some(tm.tileset.clone()),
                    indices: vec![],
                },
                None,
            ));
        }
        if let Some(sp) = &entity.components.sprite {
            uses.push((
                PlanUse {
                    entity_id: entity.entity_id.clone(),
                    role: "sprite".into(),
                    asset: Some(sp.asset.clone()),
                    indices: vec![],
                },
                (sp.palette_slot > 0).then_some(sp.palette_slot),
            ));
        }
        if entity.components.hud.is_some() {
            uses.push((
                PlanUse {
                    entity_id: entity.entity_id.clone(),
                    role: "font".into(),
                    asset: None,
                    indices: vec![FONT_INDEX],
                },
                None,
            ));
        }
    }
    if ast
        .nodes
        .iter()
        .any(|n| matches!(n, AstNode::DrawText { .. }))
    {
        uses.push((
            PlanUse {
                entity_id: SCENE_TEXT_USE.into(),
                role: "font".into(),
                asset: None,
                indices: vec![FONT_INDEX],
            },
            None,
        ));
    }

    // 2. Recurso de cada uso.
    for (order, (mut use_, legacy_slot)) in uses.into_iter().enumerate() {
        let assigned: Vec<&&PaletteEntry> = explicit
            .iter()
            .filter(|p| p.uses.contains(&use_.entity_id))
            .collect();
        if assigned.len() > 1 {
            diagnostics.push(diag(
                "error",
                "uso_duplicado",
                format!(
                    "'{}' esta atribuido a mais de uma paleta ({}).",
                    use_.entity_id,
                    assigned
                        .iter()
                        .filter_map(|p| p.id.clone())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                vec![use_.entity_id.clone()],
                assigned.iter().filter_map(|p| p.id.clone()).collect(),
                vec!["Manter uma atribuicao"],
            ));
        }
        // Indices lidos pelo uso: do arquivo convertido (sprite/tilemap) ou 15 (fonte).
        let mut derived: Option<(Vec<[u8; 3]>, usize, usize)> = None;
        if let Some(asset) = use_.asset.clone() {
            let sprite = if use_.role == "sprite" {
                ast.sprite_assets.iter().find(|a| a.asset_path == asset)
            } else {
                None
            };
            let key = format!("{}|{}", use_.role, asset);
            let result = derived_cache
                .entry(key)
                .or_insert_with(|| asset_palette(&asset, sprite))
                .clone();
            match result {
                Ok(d) => {
                    use_.indices = (1..d.0.len()).collect();
                    derived = Some(d);
                }
                Err(why) => {
                    diagnostics.push(diag(
                        "error",
                        "asset_ilegivel",
                        format!("Cores de '{}' indisponiveis: {why}", asset),
                        vec![use_.entity_id.clone()],
                        vec![],
                        vec!["Corrigir o arquivo"],
                    ));
                    continue;
                }
            }
        }
        let implicit_id = match &use_.asset {
            Some(a) => format!("asset:{a}"),
            None => FONT_RESOURCE.to_string(),
        };
        let id = assigned
            .first()
            .and_then(|p| p.id.clone())
            .unwrap_or_else(|| implicit_id.clone());
        if let Some(existing) = resources.iter_mut().find(|r| r.id == id) {
            existing.uses.push(use_);
            continue;
        }
        let entry = explicit_by_id(&id);
        let (colors, origin, evidence, quantized, source_colors) = match (entry, &derived) {
            (Some(e), d) => {
                let origin = e.origin.clone().unwrap_or_else(|| {
                    if id == implicit_id {
                        if use_.role == "font" {
                            "fonte".into()
                        } else {
                            "asset_editado".into()
                        }
                    } else {
                        "autoral".into()
                    }
                });
                (
                    entry_colors(e),
                    origin,
                    "cores gravadas no projeto (recurso explicito)".to_string(),
                    d.as_ref().map(|d| d.1).unwrap_or(0),
                    d.as_ref().map(|d| d.2).unwrap_or(0),
                )
            }
            (None, Some(d)) => {
                let mut colors: Vec<Option<[u8; 3]>> = d.0.iter().map(|c| Some(*c)).collect();
                colors[0] = None;
                colors.resize(16, None);
                (
                    colors,
                    "asset".into(),
                    "derivadas do arquivo pelo mesmo conversor do build (ordem de primeira aparicao)".to_string(),
                    d.1,
                    d.2,
                )
            }
            (None, None) => {
                let mut colors = vec![None; 16];
                colors[FONT_INDEX] = Some(FONT_DEFAULT);
                (
                    colors,
                    "fonte".into(),
                    "fonte padrao SGDK: indice 15".to_string(),
                    0,
                    0,
                )
            }
        };
        let name = entry
            .and_then(|e| e.name.clone())
            .unwrap_or_else(|| match &use_.asset {
                Some(a) => Path::new(a)
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| a.clone()),
                None => "Fonte do texto".to_string(),
            });
        let pinned = entry.and_then(|e| e.bank).or(legacy_slot).map(usize::from);
        resources.push(Res {
            id,
            name,
            origin,
            colors,
            uses: vec![use_],
            pinned,
            quantized,
            source_colors,
            evidence,
            first_use: order,
            swap_refs: 0,
        });
    }

    // 3. Recursos so referenciados por trocas (programados) e explicitos sem uso (biblioteca).
    let swaps_raw = collect_swaps(ast);
    for (_, _, _, palette_id, _, _) in &swaps_raw {
        if let Some(r) = resources.iter_mut().find(|r| r.id == *palette_id) {
            r.swap_refs += 1;
            continue;
        }
        match explicit_by_id(palette_id) {
            Some(e) => resources.push(Res {
                id: palette_id.clone(),
                name: e.name.clone().unwrap_or_else(|| palette_id.clone()),
                origin: e.origin.clone().unwrap_or_else(|| "autoral".into()),
                colors: entry_colors(e),
                uses: vec![],
                pinned: e.bank.map(usize::from),
                quantized: 0,
                source_colors: 0,
                evidence: "cores gravadas no projeto (recurso explicito)".into(),
                first_use: usize::MAX,
                swap_refs: 1,
            }),
            None => diagnostics.push(diag(
                "error",
                "troca_sem_paleta",
                format!("A troca usa a paleta '{palette_id}', que nao existe na cena."),
                vec![],
                vec![palette_id.clone()],
                vec!["Escolher outra paleta na troca"],
            )),
        }
    }
    for e in &explicit {
        let id = e.id.clone().unwrap_or_default();
        if !resources.iter().any(|r| r.id == id) {
            resources.push(Res {
                id: id.clone(),
                name: e.name.clone().unwrap_or_else(|| id.clone()),
                origin: e.origin.clone().unwrap_or_else(|| "autoral".into()),
                colors: entry_colors(e),
                uses: vec![],
                pinned: e.bank.map(usize::from),
                quantized: 0,
                source_colors: 0,
                evidence: "cores gravadas no projeto (sem uso nesta cena)".into(),
                first_use: usize::MAX,
                swap_refs: 0,
            });
        }
    }

    // 4. Cores definidas para cada indice usado; aviso de quantizacao (visivel, nao silenciosa).
    for r in &resources {
        let missing: Vec<usize> = r
            .used()
            .into_iter()
            .filter(|i| r.colors.get(*i).copied().flatten().is_none())
            .collect();
        if !missing.is_empty() {
            diagnostics.push(diag(
                "error",
                "cor_ausente",
                format!(
                    "Paleta '{}' nao define os indices {:?} usados por {}.",
                    r.name,
                    missing,
                    r.uses
                        .iter()
                        .map(|u| u.entity_id.clone())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                r.uses.iter().map(|u| u.entity_id.clone()).collect(),
                vec![r.id.clone()],
                vec!["Definir as cores", "Atribuir outra paleta"],
            ));
        }
        if r.quantized > 0 {
            diagnostics.push(diag(
                "warning",
                "cores_reduzidas",
                format!(
                    "'{}' tem {} cores; o destino aceita 15 + transparencia por paleta: {} pixels ficam com a cor mais proxima.",
                    r.name, r.source_colors, r.quantized
                ),
                r.uses.iter().map(|u| u.entity_id.clone()).collect(),
                vec![r.id.clone()],
                vec!["Reduzir as cores no arquivo"],
            ));
        }
    }

    // 5. Bancos.
    let resident: Vec<usize> = {
        let mut idx: Vec<usize> = (0..resources.len())
            .filter(|i| !resources[*i].uses.is_empty())
            .collect();
        idx.sort_by_key(|i| {
            (
                resources[*i].pinned.is_none(),
                resources[*i].pinned.unwrap_or(0),
                resources[*i].first_use,
            )
        });
        idx
    };
    let mut bank_members: Vec<Vec<usize>> = vec![Vec::new(); capacity.banks];
    let mut bank_conflict: Vec<bool> = vec![false; capacity.banks];
    let mut assigned_bank: BTreeMap<usize, usize> = BTreeMap::new();
    let compatible = |members: &[usize], r: usize, resources: &[Res]| -> Option<(String, usize)> {
        for m in members {
            for i in resources[r].used() {
                if resources[*m].used().contains(&i) {
                    let (a, b) = (resources[r].colors[i], resources[*m].colors[i]);
                    if let (Some(a), Some(b)) = (a, b) {
                        if md_color(a) != md_color(b) {
                            return Some((resources[*m].id.clone(), i));
                        }
                    }
                }
            }
        }
        None
    };
    for r in resident {
        let uses_of = |r: usize| {
            resources[r]
                .uses
                .iter()
                .map(|u| u.entity_id.clone())
                .collect::<Vec<_>>()
        };
        if let Some(bank) = resources[r].pinned {
            if bank >= capacity.banks {
                diagnostics.push(diag(
                    "error",
                    "banco_inexistente",
                    format!(
                        "'{}' esta fixada no banco {bank}; o destino tem {} bancos.",
                        resources[r].name, capacity.banks
                    ),
                    uses_of(r),
                    vec![resources[r].id.clone()],
                    vec!["Fixar em outro banco", "Remover a fixacao"],
                ));
                continue;
            }
            if let Some((other, index)) = compatible(&bank_members[bank], r, &resources) {
                bank_conflict[bank] = true;
                let other_uses: Vec<String> = resources
                    .iter()
                    .find(|x| x.id == other)
                    .map(|x| x.uses.iter().map(|u| u.entity_id.clone()).collect())
                    .unwrap_or_default();
                diagnostics.push(diag(
                    "error",
                    "conflito_de_cores",
                    format!(
                        "'{}' e '{}' disputam o banco {bank} com cores diferentes no indice {index} (usos: {} x {}).",
                        resources[r].name,
                        resources.iter().find(|x| x.id == other).map(|x| x.name.clone()).unwrap_or(other.clone()),
                        uses_of(r).join(", "),
                        other_uses.join(", ")
                    ),
                    [uses_of(r), other_uses].concat(),
                    vec![resources[r].id.clone(), other],
                    vec!["Fixar em outro banco", "Remover a fixacao", "Igualar as cores do indice"],
                ));
                continue;
            }
            bank_members[bank].push(r);
            assigned_bank.insert(r, bank);
            continue;
        }
        match (0..capacity.banks).find(|b| bank_members[*b].is_empty() && !bank_conflict[*b]) {
            Some(bank) => {
                bank_members[bank].push(r);
                assigned_bank.insert(r, bank);
            }
            None if resources[r].id == FONT_RESOURCE => {
                // Fonte sem banco livre: divide um banco cujo indice 15 esta livre ou ja tem a mesma
                // cor (verificado; nada muda). Sem nenhum e com texto so do formato anterior (DrawText),
                // le o indice 15 do banco 0 como antes -- declarado com a cor resultante.
                let legacy_only = resources[r]
                    .uses
                    .iter()
                    .all(|u| u.entity_id == SCENE_TEXT_USE);
                let shared = (0..capacity.banks).find(|b| {
                    !bank_conflict[*b] && compatible(&bank_members[*b], r, &resources).is_none()
                });
                let (bank, message) = match shared {
                    Some(b) => (Some(b), format!("Fonte do texto divide o banco {b} (indice 15 livre ou com a mesma cor; nenhuma cor muda).")),
                    None if legacy_only && !bank_members[0].is_empty() => {
                        let color = bank_colors_for(&bank_members[0], &resources)[FONT_INDEX].map(hex).unwrap_or_else(|| "sem cor".into());
                        (Some(0), format!("Texto da cena (formato anterior) le o indice 15 do banco 0, como antes: cor {color}. Para cor propria, libere um banco."))
                    }
                    None => (None, String::new()),
                };
                match bank {
                    Some(b) => {
                        diagnostics.push(diag(
                            "warning",
                            "fonte_compartilhada",
                            message,
                            uses_of(r),
                            vec![resources[r].id.clone()],
                            vec!["Liberar um banco para a fonte"],
                        ));
                        bank_members[b].push(r);
                        assigned_bank.insert(r, b);
                    }
                    None => diagnostics.push(diag(
                        "error",
                        "bancos_esgotados",
                        format!(
                            "Sem banco livre nem compativel para a fonte do texto ({}).",
                            uses_of(r).join(", ")
                        ),
                        uses_of(r),
                        vec![resources[r].id.clone()],
                        vec!["Remover um uso da cena", "Usar a mesma paleta em dois usos"],
                    )),
                }
            }
            None => {
                let compatible_banks: Vec<String> = (0..capacity.banks)
                    .filter(|b| compatible(&bank_members[*b], r, &resources).is_none())
                    .map(|b| format!("Compartilhar o banco {b} (cores compativeis)"))
                    .collect();
                let mut actions: Vec<&str> = compatible_banks.iter().map(String::as_str).collect();
                actions.extend(["Usar a mesma paleta de outro uso", "Remover um uso da cena"]);
                diagnostics.push(diag(
                    "error",
                    "bancos_esgotados",
                    format!(
                        "Sem banco livre para '{}' ({}): os {} bancos ja estao ocupados por {}.",
                        resources[r].name,
                        uses_of(r).join(", "),
                        capacity.banks,
                        bank_members
                            .iter()
                            .enumerate()
                            .map(|(b, m)| format!(
                                "{b}: {}",
                                m.iter()
                                    .map(|i| resources[*i].name.clone())
                                    .collect::<Vec<_>>()
                                    .join("+")
                            ))
                            .collect::<Vec<_>>()
                            .join("; ")
                    ),
                    uses_of(r),
                    vec![resources[r].id.clone()],
                    actions,
                ));
            }
        }
    }

    // 6. Cores de cada banco.
    let bank_colors = |members: &[usize], resources: &[Res]| -> Vec<Option<[u8; 3]>> {
        let mut colors = vec![None; 16];
        for m in members {
            for i in resources[*m].used() {
                if colors[i].is_none() {
                    colors[i] = resources[*m].colors[i];
                }
            }
        }
        colors
    };
    let mut banks = Vec::new();
    for b in 0..capacity.banks {
        let members = &bank_members[b];
        let colors = bank_colors(members, &resources);
        let state = if bank_conflict[b] {
            "conflito"
        } else if members.is_empty() {
            "livre"
        } else if members.iter().any(|m| resources[*m].pinned == Some(b))
            && members.len() == 1
            && resources[members[0]].uses.len() == 1
        {
            "reservada"
        } else if members.len() > 1
            || members
                .iter()
                .map(|m| resources[*m].uses.len())
                .sum::<usize>()
                > 1
        {
            "compartilhada"
        } else {
            "em_uso"
        };
        banks.push(PlanBank {
            bank: b,
            resources: members.iter().map(|m| resources[*m].id.clone()).collect(),
            colors: colors
                .iter()
                .map(|c| c.map(hex).unwrap_or_default())
                .collect(),
            target_values: colors
                .iter()
                .map(|c| c.map(md_color).unwrap_or(0))
                .collect(),
            state: state.to_string(),
        });
    }

    // 7. Trocas: alcance e valores.
    let mut swaps = Vec::new();
    for (swap_id, strike_id, target_entity, palette_id, frames, scope) in swaps_raw {
        let target_res = resources
            .iter()
            .position(|r| r.uses.iter().any(|u| u.entity_id == target_entity));
        let swap_res = resources.iter().position(|r| r.id == palette_id);
        let mut ok = true;
        let (mut bank, mut written, mut affected, mut on_values, mut off_values) =
            (None, vec![], vec![], vec![], vec![]);
        match (target_res, swap_res) {
            (Some(t), Some(s)) => match assigned_bank.get(&t) {
                Some(b) => {
                    bank = Some(*b);
                    written = resources[t].used();
                    let missing: Vec<usize> = written
                        .iter()
                        .copied()
                        .filter(|i| resources[s].colors[*i].is_none())
                        .collect();
                    if !missing.is_empty() {
                        ok = false;
                        diagnostics.push(diag(
                            "error",
                            "troca_incompativel",
                            format!("A troca '{swap_id}' usa '{}', que nao define os indices {:?} de '{}'.", resources[s].name, missing, target_entity),
                            vec![target_entity.clone()],
                            vec![palette_id.clone()],
                            vec!["Definir as cores na paleta da troca", "Escolher outra paleta"],
                        ));
                    }
                    for m in &bank_members[*b] {
                        for u in &resources[*m].uses {
                            if u.indices.iter().any(|i| written.contains(i))
                                && !affected.contains(&u.entity_id)
                            {
                                affected.push(u.entity_id.clone());
                            }
                        }
                    }
                    let off = bank_colors(&bank_members[*b], &resources);
                    let mut on = off.clone();
                    for i in &written {
                        on[*i] = resources[s].colors[*i];
                    }
                    off_values = off.iter().map(|c| c.map(md_color).unwrap_or(0)).collect();
                    on_values = on.iter().map(|c| c.map(md_color).unwrap_or(0)).collect();
                    if scope == "instancia" && affected.iter().any(|e| *e != target_entity) {
                        ok = false;
                        diagnostics.push(diag(
                            "error",
                            "troca_alcance",
                            format!(
                                "A troca '{swap_id}' foi declarada so para '{target_entity}', mas o banco {b} tambem e lido por {}: as cores deles mudariam juntas.",
                                affected.iter().filter(|e| **e != target_entity).cloned().collect::<Vec<_>>().join(", ")
                            ),
                            affected.clone(),
                            vec![resources[t].id.clone()],
                            vec!["Criar variante local para o alvo", "Declarar a troca para o grupo"],
                        ));
                    }
                }
                None => ok = false,
            },
            _ => {
                ok = false;
                if target_res.is_none() {
                    diagnostics.push(diag(
                        "error",
                        "troca_sem_alvo",
                        format!("A troca '{swap_id}' aponta para '{target_entity}', que nao usa paleta nesta cena."),
                        vec![target_entity.clone()],
                        vec![],
                        vec!["Escolher outro alvo"],
                    ));
                }
            }
        }
        swaps.push(PlanSwap {
            id: swap_id,
            trigger: format!("golpe:{strike_id}"),
            target_entity,
            palette: palette_id,
            frames,
            scope,
            bank,
            written_indices: written,
            affected_uses: affected,
            on_values,
            off_values,
            ok,
        });
    }

    let mut entity_banks = BTreeMap::new();
    let mut text_bank = None;
    for (r, b) in &assigned_bank {
        for u in &resources[*r].uses {
            if u.role == "font" {
                if text_bank.is_some() && text_bank != Some(*b) {
                    diagnostics.push(diag(
                        "error",
                        "fonte_dividida",
                        "Textos da cena em paletas de bancos diferentes: o destino usa um banco para todo texto.".into(),
                        vec![u.entity_id.clone()],
                        vec![resources[*r].id.clone()],
                        vec!["Usar a mesma paleta para todos os textos"],
                    ));
                }
                text_bank = Some(*b);
            }
            entity_banks.insert(u.entity_id.clone(), *b);
        }
    }

    let plan_resources = resources
        .iter()
        .enumerate()
        .map(|(i, r)| PlanResource {
            id: r.id.clone(),
            name: r.name.clone(),
            origin: r.origin.clone(),
            colors: r
                .colors
                .iter()
                .map(|c| c.map(hex).unwrap_or_default())
                .collect(),
            used_indices: r.used(),
            uses: r.uses.clone(),
            references: r.uses.len() + r.swap_refs,
            simultaneous_uses: r.uses.len(),
            pinned_bank: r.pinned,
            bank: assigned_bank.get(&i).copied(),
            state: if assigned_bank.contains_key(&i) {
                "residente"
            } else if r.uses.is_empty() && r.swap_refs > 0 {
                "programada"
            } else if r.uses.is_empty() {
                "sem_uso"
            } else if diagnostics
                .iter()
                .any(|d| d.code == "conflito_de_cores" && d.resources.first() == Some(&r.id))
            {
                "conflito"
            } else {
                "sem_banco"
            }
            .to_string(),
            quantized_pixels: r.quantized,
            source_colors: r.source_colors,
            evidence: r.evidence.clone(),
        })
        .collect();

    let mut evidence = BTreeMap::new();
    evidence.insert(
        "cores".into(),
        "arquivos convertidos pelo conversor do build; recursos explicitos do projeto".into(),
    );
    evidence.insert(
        "bancos".into(),
        "planejador deterministico (fixados, depois ordem do primeiro uso)".into(),
    );
    evidence.insert(
        "valores".into(),
        format!("{target}: conversao do rescomp pinado ((c >> 4) & 0xE)"),
    );
    evidence.insert(
        "execucao".into(),
        "plano, nao leitura de CRAM: a memoria de cor nao e observada".into(),
    );
    evidence.insert(
        "contexto".into(),
        "cena inteira; trocas por evento sao o unico periodo modelado".into(),
    );

    PalettePlan {
        schema: SCHEMA.into(),
        scene_id: scene.scene_id.clone(),
        target: target.into(),
        capacity,
        resources: plan_resources,
        banks,
        swaps,
        diagnostics,
        entity_banks,
        text_bank,
        evidence,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::ast_generator::LogicScript;

    // Cores ficticias por asset (indice 0 = transparencia, como o conversor do build).
    fn colors_of(path: &str) -> Vec<[u8; 3]> {
        let base: Vec<[u8; 3]> = match path {
            "fundo.png" => vec![
                [0, 0, 0],
                [0x20, 0x60, 0xA0],
                [0x40, 0xA0, 0x40],
                [0xC0, 0x60, 0x20],
            ],
            "ken.png" => vec![
                [0, 0, 0],
                [0xE0, 0xC0, 0xA0],
                [0xA0, 0x20, 0x20],
                [0x20, 0x20, 0x20],
                [0xE0, 0xE0, 0xE0],
            ],
            "ryu.png" => vec![[0, 0, 0], [0xE0, 0xC0, 0xA0], [0xE0, 0xE0, 0xE0]],
            "chao.png" => vec![[0, 0, 0], [0x20, 0x60, 0xA0], [0x40, 0xA0, 0x40]],
            "extra.png" => vec![[0, 0, 0], [0x80, 0x00, 0x80]],
            _ => vec![[0, 0, 0], [0xFF, 0xFF, 0xFF]],
        };
        base
    }

    fn palette_fn() -> impl Fn(
        &str,
        Option<&crate::compiler::ast_generator::SpriteAsset>,
    ) -> Result<(Vec<[u8; 3]>, usize, usize), String> {
        |p: &str, _| Ok((colors_of(p), 0, colors_of(p).len() - 1))
    }

    fn scene(json: serde_json::Value) -> Scene {
        serde_json::from_value(json).unwrap()
    }

    fn sprite(id: &str, asset: &str) -> serde_json::Value {
        serde_json::json!({ "entity_id": id, "transform": {"x":0,"y":0},
            "components": { "sprite": { "asset": asset, "frame_width": 32, "frame_height": 32, "pivot": null } } })
    }
    fn tilemap(id: &str, tileset: &str) -> serde_json::Value {
        serde_json::json!({ "entity_id": id, "transform": {"x":0,"y":0},
            "components": { "tilemap": { "tileset": tileset, "map_width": 40, "map_height": 28 } } })
    }
    fn hud(id: &str) -> serde_json::Value {
        serde_json::json!({ "entity_id": id, "transform": {"x":0,"y":0},
            "components": { "hud": { "column": 2, "row": 4, "label": "VIDA:" } } })
    }
    fn empty_ast() -> AstOutput {
        AstOutput {
            nodes: vec![],
            sprite_assets: vec![],
            logic_scripts: vec![],
        }
    }
    fn swap_ast(target: &str, palette: &str, scope: &str) -> AstOutput {
        AstOutput {
            nodes: vec![],
            sprite_assets: vec![],
            logic_scripts: vec![LogicScript {
                ops: vec![LogicOp::PaletteSwapOnHit {
                    swap_id: "dano".into(),
                    strike_id: "golpe".into(),
                    target_entity: target.into(),
                    palette_id: palette.into(),
                    frames: 8,
                    scope: scope.into(),
                }],
            }],
        }
    }
    fn run(s: &Scene, ast: &AstOutput) -> PalettePlan {
        plan(s, ast, MEGADRIVE, "megadrive", &palette_fn())
    }
    fn codes(p: &PalettePlan) -> Vec<String> {
        p.diagnostics.iter().map(|d| d.code.clone()).collect()
    }

    #[test]
    fn scenery_character_and_font_get_separate_banks_without_overwrite() {
        // A colisao antiga: tilemap e personagem no banco 0, fonte lendo o indice 15 do tilemap.
        let s = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ken_2", "ken.png"), hud("vida")] }),
        );
        let p = run(&s, &empty_ast());
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        assert_eq!(p.entity_banks["mundo"], 0);
        assert_eq!(p.entity_banks["ken"], 1);
        assert_eq!(
            p.entity_banks["ken_2"], 1,
            "mesmo asset = mesmo recurso = mesmo banco"
        );
        assert_eq!(p.entity_banks["vida"], 2);
        assert_eq!(p.text_bank, Some(2));
        assert_eq!(p.banks[3].state, "livre");
        assert_eq!(
            p.banks[1].state, "compartilhada",
            "2 instancias do personagem"
        );
        let ken = p
            .resources
            .iter()
            .find(|r| r.id == "asset:ken.png")
            .unwrap();
        assert_eq!((ken.references, ken.simultaneous_uses), (2, 2));
        assert_eq!(p.banks[1].target_values[2], md_color([0xA0, 0x20, 0x20]));
        assert_eq!(
            md_color([0xA0, 0x20, 0x20]),
            0x22A,
            "rescomp: (c >> 4) & 0xE"
        );
    }

    #[test]
    fn compatible_sharing_is_accepted_and_conflicting_pin_is_refused_with_uses() {
        // chao.png coincide com fundo.png nos indices 1..2 -> compartilhar o banco 0 e aceito.
        let mut s = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), tilemap("chao", "chao.png"), sprite("ken", "ken.png")] }),
        );
        s.palettes.push(PaletteEntry {
            id: Some("asset:chao.png".into()),
            bank: Some(0),
            colors: colors_of("chao.png")
                .iter()
                .enumerate()
                .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
                .collect(),
            ..Default::default()
        });
        // Fixar 'mundo' tambem no 0 (ja era) para o compartilhamento ser explicito.
        s.palettes.push(PaletteEntry {
            id: Some("asset:fundo.png".into()),
            bank: Some(0),
            colors: colors_of("fundo.png")
                .iter()
                .enumerate()
                .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
                .collect(),
            ..Default::default()
        });
        let p = run(&s, &empty_ast());
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        assert_eq!((p.entity_banks["mundo"], p.entity_banks["chao"]), (0, 0));
        assert_eq!(p.banks[0].state, "compartilhada");
        assert_eq!(p.entity_banks["ken"], 1);
        // Personagem fixado no banco 0: indice 1 difere -> conflito, nada sobrescrito.
        s.palettes.push(PaletteEntry {
            id: Some("asset:ken.png".into()),
            bank: Some(0),
            colors: colors_of("ken.png")
                .iter()
                .enumerate()
                .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
                .collect(),
            ..Default::default()
        });
        let p = run(&s, &empty_ast());
        let d = p
            .diagnostics
            .iter()
            .find(|d| d.code == "conflito_de_cores")
            .expect("conflito");
        assert!(
            d.uses.contains(&"ken".to_string()) && d.uses.contains(&"mundo".to_string()),
            "{d:?}"
        );
        assert!(d.message.contains("indice 1"));
        assert!(
            !p.entity_banks.contains_key("ken"),
            "sem banco = sem uso silencioso"
        );
        assert_eq!(p.banks[0].state, "conflito");
        assert_eq!(
            p.banks[0].resources,
            vec!["asset:fundo.png", "asset:chao.png"],
            "banco 0 intacto"
        );
    }

    #[test]
    fn exhaustion_is_diagnosed_with_compatible_alternatives_and_no_overwrite() {
        let s = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ryu", "ryu.png"), hud("vida"), sprite("x", "extra.png")] }),
        );
        let p = run(&s, &empty_ast());
        let d = p
            .diagnostics
            .iter()
            .find(|d| d.code == "bancos_esgotados")
            .expect("esgotado");
        assert_eq!(d.uses, vec!["x"]);
        assert!(
            d.actions.iter().any(|a| a.contains("Compartilhar o banco")),
            "{:?}",
            d.actions
        );
        assert_eq!(
            p.banks.iter().filter(|b| !b.resources.is_empty()).count(),
            4
        );
        assert!(!p.entity_banks.contains_key("x"));
        // Biblioteca grande sem uso nao bloqueia.
        let mut s2 = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null, "entities": [sprite("ken", "ken.png")] }),
        );
        for i in 0..10 {
            s2.palettes.push(PaletteEntry {
                id: Some(format!("lib{i}")),
                colors: vec!["#FFFFFF".into(); 16],
                ..Default::default()
            });
        }
        assert!(!run(&s2, &empty_ast()).has_errors());
    }

    #[test]
    fn local_variant_isolates_and_partial_release_keeps_the_bank() {
        let base = serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ken_2", "ken.png"), sprite("ken_3", "ken.png")] });
        let ken_colors: Vec<String> = colors_of("ken.png")
            .iter()
            .enumerate()
            .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
            .collect();
        let mut s = scene(base.clone());
        s.palettes.push(PaletteEntry {
            id: Some("variante:ken_2".into()),
            name: Some("Ken 2".into()),
            origin: Some("variante".into()),
            uses: vec!["ken_2".into(), "ken_3".into()],
            colors: ken_colors.clone(),
            ..Default::default()
        });
        let p = run(&s, &empty_ast());
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        assert_eq!(p.entity_banks["ken"], 1);
        assert_eq!(
            p.entity_banks["ken_2"], 2,
            "variante tem banco proprio (capacidade real)"
        );
        // Liberar um uso da variante (ken_3 volta ao original): o banco da variante continua ocupado.
        s.palettes[0].uses = vec!["ken_2".into()];
        let p = run(&s, &empty_ast());
        assert_eq!(p.entity_banks["ken_3"], 1);
        assert_eq!(p.entity_banks["ken_2"], 2);
        assert_eq!(p.banks[2].state, "em_uso");
        // Liberar o ultimo uso: o banco fica livre.
        s.palettes[0].uses.clear();
        let p = run(&s, &empty_ast());
        assert_eq!(p.banks[2].state, "livre");
        assert_eq!(
            p.resources
                .iter()
                .find(|r| r.id == "variante:ken_2")
                .unwrap()
                .state,
            "sem_uso"
        );
    }

    #[test]
    fn editing_the_shared_palette_changes_exactly_its_users() {
        let s0 = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ken_2", "ken.png")] }),
        );
        let before = run(&s0, &empty_ast());
        let mut s = s0.clone();
        let mut colors: Vec<String> = colors_of("ken.png")
            .iter()
            .enumerate()
            .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
            .collect();
        colors[2] = "#2020E0".into();
        s.palettes.push(PaletteEntry {
            id: Some("asset:ken.png".into()),
            colors,
            ..Default::default()
        });
        let after = run(&s, &empty_ast());
        assert_eq!(before.banks[0], after.banks[0], "fundo inalterado");
        assert_ne!(
            before.banks[1].target_values[2],
            after.banks[1].target_values[2]
        );
        assert_eq!(
            before.banks[1].target_values[1], after.banks[1].target_values[1],
            "so o indice editado"
        );
        assert_eq!(
            after.entity_banks["ken"], after.entity_banks["ken_2"],
            "os dois usos mudam juntos"
        );
        // Restaurar (remover a edicao) devolve o plano original.
        assert_eq!(run(&s0, &empty_ast()), before);
    }

    #[test]
    fn hiding_in_the_editor_does_not_change_the_rom_plan() {
        let mut v = serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png")] });
        let a = run(&scene(v.clone()), &empty_ast());
        v["layers"] = serde_json::json!([{ "id": "l1", "name": "Personagens", "kind": "sprite", "visible": false, "locked": false, "entity_ids": ["ken"] }]);
        let b = run(&scene(v), &empty_ast());
        assert_eq!(a.banks, b.banks);
        assert_eq!(a.entity_banks, b.entity_banks);
    }

    #[test]
    fn instance_swap_needs_its_own_bank_and_writes_only_the_target_indices() {
        let base = serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ken_2", "ken.png"), hud("vida")] });
        let mut dano: Vec<String> = vec![String::new(); 16];
        for c in dano.iter_mut().take(5).skip(1) {
            *c = "#E02020".into();
        }
        let mut s = scene(base);
        s.palettes.push(PaletteEntry {
            id: Some("dano".into()),
            name: Some("Dano".into()),
            colors: dano.clone(),
            ..Default::default()
        });
        // Sem variante: ken e ken_2 dividem o banco -> "so esta instancia" e recusado com o motivo.
        let p = run(&s, &swap_ast("ken_2", "dano", "instancia"));
        let d = p
            .diagnostics
            .iter()
            .find(|d| d.code == "troca_alcance")
            .expect("alcance");
        assert!(d.message.contains("ken") && d.actions.iter().any(|a| a.contains("variante")));
        // Grupo: aceito, afeta os dois.
        let p = run(&s, &swap_ast("ken_2", "dano", "grupo"));
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        assert_eq!(p.swaps[0].affected_uses, vec!["ken", "ken_2"]);
        assert_eq!(
            p.resources.iter().find(|r| r.id == "dano").unwrap().state,
            "programada"
        );
        // Com variante local para ken_2: aceito como instancia; so os indices 1..4 mudam.
        let ken_colors: Vec<String> = colors_of("ken.png")
            .iter()
            .enumerate()
            .map(|(i, c)| if i == 0 { String::new() } else { hex(*c) })
            .collect();
        s.palettes.push(PaletteEntry {
            id: Some("variante:ken_2".into()),
            origin: Some("variante".into()),
            uses: vec!["ken_2".into()],
            colors: ken_colors,
            ..Default::default()
        });
        let p = run(&s, &swap_ast("ken_2", "dano", "instancia"));
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        let sw = &p.swaps[0];
        assert_eq!(sw.affected_uses, vec!["ken_2"]);
        assert_eq!(sw.bank, Some(p.entity_banks["ken_2"]));
        assert_ne!(sw.bank, Some(p.entity_banks["ken"]));
        assert_eq!(sw.written_indices, vec![1, 2, 3, 4]);
        for i in 0..16 {
            if (1..=4).contains(&i) {
                assert_eq!(sw.on_values[i], md_color([0xE0, 0x20, 0x20]));
            } else {
                assert_eq!(
                    sw.on_values[i], sw.off_values[i],
                    "indice {i} fora do alvo inalterado"
                );
            }
        }
        // Paleta de troca sem os indices do alvo: recusada.
        s.palettes[0].colors = vec![String::new(), "#E02020".into()];
        assert!(codes(&run(&s, &swap_ast("ken_2", "dano", "instancia")))
            .contains(&"troca_incompativel".to_string()));
    }

    #[test]
    fn legacy_palette_slot_pins_and_missing_colors_block() {
        let mut v = serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [sprite("ken", "ken.png")] });
        v["entities"][0]["components"]["sprite"]["palette_slot"] = serde_json::json!(3);
        let p = run(&scene(v.clone()), &empty_ast());
        assert_eq!(
            p.entity_banks["ken"], 3,
            "palette_slot antigo continua valendo"
        );
        let mut s = scene(v);
        s.palettes.push(PaletteEntry {
            id: Some("asset:ken.png".into()),
            colors: vec![String::new(), "#FFFFFF".into()],
            ..Default::default()
        });
        assert!(codes(&run(&s, &empty_ast())).contains(&"cor_ausente".to_string()));
    }

    fn full_colors(n: u8) -> Vec<String> {
        (0..16)
            .map(|i| {
                if i == 0 {
                    String::new()
                } else {
                    hex([n, i as u8 * 8, 0])
                }
            })
            .collect()
    }

    #[test]
    fn font_shares_a_compatible_bank_or_keeps_the_legacy_text_rule_without_overwrite() {
        // Quatro recursos ocupam os 4 bancos; 'extra' usa so os indices 1..2 (15 livre).
        let mut s = scene(
            serde_json::json!({ "scene_id": "main", "display_name": null,
            "entities": [tilemap("mundo", "fundo.png"), sprite("ken", "ken.png"), sprite("ryu", "ryu.png"), sprite("x", "extra.png"), hud("vida")] }),
        );
        let p = run(&s, &empty_ast());
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        let d = p
            .diagnostics
            .iter()
            .find(|d| d.code == "fonte_compartilhada")
            .expect("aviso visivel");
        assert!(d.message.contains("nenhuma cor muda"));
        let shared = p.text_bank.unwrap();
        assert!(p.banks[shared]
            .resources
            .contains(&FONT_RESOURCE.to_string()));
        assert_eq!(p.banks[shared].colors[FONT_INDEX], hex(FONT_DEFAULT));
        // Todos os bancos com indice 15 ocupado por outra cor: HUD novo = erro (nada sobrescrito)...
        for (id, n) in [
            ("asset:fundo.png", 10u8),
            ("asset:ken.png", 20),
            ("asset:ryu.png", 30),
            ("asset:extra.png", 40),
        ] {
            s.palettes.push(PaletteEntry {
                id: Some(id.into()),
                colors: full_colors(n),
                ..Default::default()
            });
        }
        let custom = |p: &str,
                      _: Option<&crate::compiler::ast_generator::SpriteAsset>|
         -> Result<AssetColors, String> {
            let _ = p;
            Ok(((0..16).map(|i| [i as u8, 0, 0]).collect(), 0, 15))
        };
        let p = plan(&s, &empty_ast(), MEGADRIVE, "megadrive", &custom);
        assert!(
            p.diagnostics
                .iter()
                .any(|d| d.code == "bancos_esgotados" && d.uses == vec!["vida".to_string()]),
            "{:?}",
            p.diagnostics
        );
        // ...e so texto do formato anterior (DrawText) = le o indice 15 do banco 0, com a cor declarada.
        s.entities.retain(|e| e.entity_id != "vida");
        let legacy_ast = AstOutput {
            nodes: vec![AstNode::DrawText {
                x: 1,
                y: 1,
                text: "TITULO".into(),
                palette_slot: 0,
            }],
            sprite_assets: vec![],
            logic_scripts: vec![],
        };
        let p = plan(&s, &legacy_ast, MEGADRIVE, "megadrive", &custom);
        assert!(!p.has_errors(), "{:?}", p.diagnostics);
        assert_eq!(p.text_bank, Some(0));
        let d = p
            .diagnostics
            .iter()
            .find(|d| d.code == "fonte_compartilhada")
            .unwrap();
        assert!(d.message.contains(&hex([10, 15 * 8, 0])), "{}", d.message);
        assert_eq!(
            p.banks[0].colors[FONT_INDEX],
            hex([10, 15 * 8, 0]),
            "cor do banco 0 intacta"
        );
    }
}
