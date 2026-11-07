//! Contrato de suporte de nos logicos por plataforma (Experimental).
//!
//! Antes de gerar qualquer codigo, o build recusa grafos com nos que o emissor da
//! plataforma nao sabe traduzir, com diagnostico estruturado (plataforma, entidade, no).
//! Vale para grafos editados no app, importados ou alterados fora dele.

use crate::core::diagnostics::{ActionableDiagnostic, DiagnosticArea};
use crate::ugdm::entities::Scene;

/// Nos sem traducao por plataforma. `condition_on_ground` depende do estado de apoio
/// da fisica do emissor Mega Drive, que o emissor SNES nao tem.
const UNSUPPORTED: &[(&str, &str, &str)] = &[
    (
        "snes",
        "condition_on_ground",
        "o estado de apoio no chao so existe na fisica do Mega Drive",
    ),
    (
        "megadrive",
        "camera_bounds",
        "o no legado nao tem runtime; remova-o e desenhe limites em Configurar camera",
    ),
    (
        "snes",
        "camera_bounds",
        "o no legado nao tem runtime; remova-o e desenhe limites em Configurar camera",
    ),
];

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct LogicSupportIssue {
    pub platform: String,
    pub entity_id: String,
    pub node_id: String,
    pub node_type: String,
    pub reason: String,
}

/// R5: object paths are refused before codegen when invalid, unsupported on the target, or
/// competing with physics/input for the same object's position.
pub fn path_support_issues(target: &str, resolved_scene: &Scene) -> Vec<LogicSupportIssue> {
    let mut issues = Vec::new();
    for entity in &resolved_scene.entities {
        let Some(path) = entity.components.path.as_ref() else {
            continue;
        };
        let reason = if let Some(why) = crate::ugdm::components::path_issue(path) {
            Some(why)
        } else if target != "megadrive" {
            Some("trajeto ainda sem runtime nesta plataforma".to_string())
        } else if entity.components.sprite.is_none() {
            Some("trajeto exige um sprite no objeto".to_string())
        } else if entity.components.physics.is_some() || entity.components.input.is_some() {
            Some("fisica/entrada tambem movem este objeto; remova-as ou o trajeto".to_string())
        } else {
            None
        };
        if let Some(reason) = reason {
            issues.push(LogicSupportIssue {
                platform: target.to_string(),
                entity_id: entity.entity_id.clone(),
                node_id: "path".to_string(),
                node_type: "path".to_string(),
                reason,
            });
        }
    }
    issues
}

/// R5: «Iniciar/Parar trajeto» must target an object that has a path in this scene.
pub fn path_trigger_issues(target: &str, resolved_scene: &Scene) -> Vec<LogicSupportIssue> {
    let with_path: std::collections::HashSet<&str> = resolved_scene
        .entities
        .iter()
        .filter(|entity| entity.components.path.is_some())
        .map(|entity| entity.entity_id.as_str())
        .collect();
    let mut issues = Vec::new();
    for entity in &resolved_scene.entities {
        let Some(graph) = entity
            .components
            .logic
            .as_ref()
            .and_then(|logic| logic.graph.as_deref())
        else {
            continue;
        };
        let Ok(parsed) = serde_json::from_str::<GraphNodes>(graph) else {
            continue;
        };
        for node in parsed.nodes {
            if node.node_type != "path_start" && node.node_type != "path_stop" {
                continue;
            }
            let goal = node
                .params
                .get("target")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if !with_path.contains(goal) {
                issues.push(LogicSupportIssue {
                    platform: target.to_string(),
                    entity_id: entity.entity_id.clone(),
                    node_id: node.id,
                    node_type: node.node_type,
                    reason: format!("o objeto '{goal}' nao tem trajeto nesta cena"),
                });
            }
        }
    }
    issues
}

#[derive(serde::Deserialize)]
struct GraphNodes {
    #[serde(default)]
    nodes: Vec<GraphNode>,
}

#[derive(serde::Deserialize)]
struct GraphNode {
    id: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(default)]
    params: serde_json::Map<String, serde_json::Value>,
}

/// Varre os grafos de logica ja resolvidos (prefab e graph_ref aplicados).
pub fn logic_support_issues(target: &str, resolved_scene: &Scene) -> Vec<LogicSupportIssue> {
    let mut issues = Vec::new();
    for entity in &resolved_scene.entities {
        let Some(graph) = entity
            .components
            .logic
            .as_ref()
            .and_then(|logic| logic.graph.as_deref())
        else {
            continue;
        };
        let Ok(parsed) = serde_json::from_str::<GraphNodes>(graph) else {
            continue;
        };
        for node in parsed.nodes {
            if let Some((platform, node_type, reason)) =
                UNSUPPORTED.iter().find(|(platform, node_type, _)| {
                    *platform == target && *node_type == node.node_type
                })
            {
                issues.push(LogicSupportIssue {
                    platform: platform.to_string(),
                    entity_id: entity.entity_id.clone(),
                    node_id: node.id,
                    node_type: node_type.to_string(),
                    reason: reason.to_string(),
                });
            }
        }
    }
    issues
}

#[derive(serde::Deserialize)]
struct GraphBehaviors {
    #[serde(default)]
    nodes: Vec<BehaviorNode>,
    #[serde(default)]
    behaviors: Vec<BehaviorRecord>,
}

#[derive(serde::Deserialize)]
struct BehaviorNode {
    id: String,
    #[serde(default)]
    params: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(serde::Deserialize)]
struct BehaviorRecord {
    id: String,
    #[serde(rename = "behaviorId")]
    behavior_id: String,
    #[serde(default)]
    params: std::collections::HashMap<String, serde_json::Value>,
}

/// Referencias quebradas de comportamentos (grafo importado/editado fora do app):
/// nos gerados apontando para entidade inexistente, ou item/objetivo/passagem
/// apontando para contador/movimento que nao existe mais. Recusam o build.
pub fn behavior_reference_issues(resolved_scene: &Scene) -> Vec<LogicSupportIssue> {
    let entity_ids: std::collections::HashSet<&str> = resolved_scene
        .entities
        .iter()
        .map(|entity| entity.entity_id.as_str())
        .collect();
    let parsed: Vec<(String, GraphBehaviors)> = resolved_scene
        .entities
        .iter()
        .filter_map(|entity| {
            let graph = entity.components.logic.as_ref()?.graph.as_deref()?;
            serde_json::from_str::<GraphBehaviors>(graph)
                .ok()
                .map(|parsed| (entity.entity_id.clone(), parsed))
        })
        .collect();
    let counters: std::collections::HashSet<&str> = parsed
        .iter()
        .flat_map(|(_, graph)| graph.behaviors.iter())
        .filter(|record| record.behavior_id == "counter")
        .map(|record| record.id.as_str())
        .collect();
    let mut issues = Vec::new();
    let param = |params: &std::collections::HashMap<String, serde_json::Value>, key: &str| {
        params
            .get(key)
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string()
    };
    for (entity_id, graph) in &parsed {
        for node in &graph.nodes {
            if param(&node.params, "behavior_instance").is_empty() {
                continue;
            }
            for key in ["target", "a", "b"] {
                let value = param(&node.params, key);
                if !value.is_empty() && value != "self" && !entity_ids.contains(value.as_str()) {
                    issues.push(LogicSupportIssue {
                        platform: "any".to_string(),
                        entity_id: entity_id.clone(),
                        node_id: node.id.clone(),
                        node_type: "behavior_reference".to_string(),
                        reason: format!(
                            "o comportamento aponta para a entidade '{value}', que nao existe"
                        ),
                    });
                }
            }
        }
        let local: std::collections::HashSet<&str> = graph
            .behaviors
            .iter()
            .map(|record| record.id.as_str())
            .collect();
        for record in &graph.behaviors {
            let counter = param(&record.params, "counter");
            if matches!(record.behavior_id.as_str(), "collectible" | "objective")
                && !counter.is_empty()
                && !counters.contains(counter.as_str())
            {
                issues.push(LogicSupportIssue {
                    platform: "any".to_string(),
                    entity_id: entity_id.clone(),
                    node_id: record.id.clone(),
                    node_type: record.behavior_id.clone(),
                    reason: format!("o contador '{counter}' nao existe mais"),
                });
            }
            let movement = param(&record.params, "movement");
            if record.behavior_id == "gated_passage" && !local.contains(movement.as_str()) {
                issues.push(LogicSupportIssue {
                    platform: "any".to_string(),
                    entity_id: entity_id.clone(),
                    node_id: record.id.clone(),
                    node_type: record.behavior_id.clone(),
                    reason: format!(
                        "o movimento '{movement}' bloqueado pela passagem nao existe mais"
                    ),
                });
            }
        }
    }
    issues
}

pub fn issue_diagnostic(issue: &LogicSupportIssue) -> ActionableDiagnostic {
    let area = if issue.platform == "snes" {
        DiagnosticArea::BuildSnes
    } else {
        DiagnosticArea::BuildSgdk
    };
    ActionableDiagnostic::blocking_error(
        area,
        if issue.node_type == "path" {
            format!(
                "O trajeto da entidade '{}' foi recusado em {}: {}.",
                issue.entity_id, issue.platform, issue.reason
            )
        } else if issue.platform == "any" {
            format!(
                "A logica da entidade '{}' tem uma referencia quebrada em '{}': {}.",
                issue.entity_id, issue.node_id, issue.reason
            )
        } else {
            format!(
                "A entidade '{}' usa o no '{}' ({}), que nao e suportado em {}: {}.",
                issue.entity_id, issue.node_id, issue.node_type, issue.platform, issue.reason
            )
        },
        format!(
            "platform={} entity={} node={} type={}",
            issue.platform, issue.entity_id, issue.node_id, issue.node_type
        ),
        if issue.node_type == "path" {
            "Ajuste os pontos/tempos do trajeto no Inspector, remova fisica/entrada do objeto ou compile para Mega Drive."
        } else {
            "Remova o no (ou o comportamento que o gerou) dessa entidade, ou compile para Mega Drive."
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ugdm::components::{Components, LogicComponent};
    use crate::ugdm::entities::{Entity, Transform};
    use std::collections::HashMap;

    #[test]
    fn path_trigger_must_target_an_object_with_a_path() {
        let mut scene = scene_with(
            r#"{"nodes":[{"id":"go","type":"path_start","params":{"target":"plat"}},{"id":"halt","type":"path_stop","params":{"target":"ghost"}}],"edges":[]}"#,
        );
        let mut plat = scene.entities[0].clone();
        plat.entity_id = "plat".to_string();
        plat.components = serde_json::from_str(
            r#"{"sprite":{"asset":"a.png","frame_width":16,"frame_height":16,"pivot":null},"path":{"mode":"loop","points":[{"x":0,"y":0,"frames":10},{"x":32,"y":0,"frames":10}]}}"#,
        )
        .expect("plat");
        scene.entities.push(plat);
        let issues = path_trigger_issues("megadrive", &scene);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].node_id, "halt");
        assert!(issues[0].reason.contains("ghost"));
        assert!(issue_diagnostic(&issues[0]).blocking);
    }

    fn scene_with_path(components_json: &str) -> Scene {
        let mut scene = scene_with(r#"{"nodes":[],"edges":[]}"#);
        scene.entities[0].components =
            serde_json::from_str(components_json).expect("components json");
        scene
    }

    #[test]
    fn path_is_refused_when_invalid_off_target_or_competing_for_position() {
        let sprite =
            r#""sprite":{"asset":"a.png","frame_width":16,"frame_height":16,"pivot":null}"#;
        let good = format!(
            r#"{{{sprite},"path":{{"mode":"pingpong","points":[{{"x":0,"y":0}},{{"x":64,"y":0,"frames":32,"wait":10}}]}}}}"#
        );
        assert!(path_support_issues("megadrive", &scene_with_path(&good)).is_empty());
        let snes = path_support_issues("snes", &scene_with_path(&good));
        assert_eq!(snes.len(), 1);
        assert!(issue_diagnostic(&snes[0]).blocking);

        let jump = format!(
            r#"{{{sprite},"path":{{"mode":"once","points":[{{"x":8,"y":0}},{{"x":64,"y":0,"frames":32}}]}}}}"#
        );
        assert!(path_support_issues("megadrive", &scene_with_path(&jump))[0]
            .reason
            .contains("primeiro ponto"));
        let zero = format!(
            r#"{{{sprite},"path":{{"mode":"once","points":[{{"x":0,"y":0}},{{"x":64,"y":0,"frames":0}}]}}}}"#
        );
        assert_eq!(
            path_support_issues("megadrive", &scene_with_path(&zero)).len(),
            1
        );
        let loop_needs_return = format!(
            r#"{{{sprite},"path":{{"mode":"loop","points":[{{"x":0,"y":0,"frames":0}},{{"x":64,"y":0,"frames":20}}]}}}}"#
        );
        assert_eq!(
            path_support_issues("megadrive", &scene_with_path(&loop_needs_return)).len(),
            1
        );
        let physics = format!(
            r#"{{{sprite},"physics":{{"gravity":true}},"path":{{"mode":"once","points":[{{"x":0,"y":0}},{{"x":64,"y":0,"frames":32}}]}}}}"#
        );
        let competing = path_support_issues("megadrive", &scene_with_path(&physics));
        assert_eq!(competing.len(), 1);
        assert!(competing[0].reason.contains("fisica"));
        let no_sprite =
            r#"{"path":{"mode":"once","points":[{"x":0,"y":0},{"x":64,"y":0,"frames":32}]}}"#;
        assert!(
            path_support_issues("megadrive", &scene_with_path(no_sprite))[0]
                .reason
                .contains("sprite")
        );
    }

    fn scene_with(graph: &str) -> Scene {
        Scene {
            scene_id: "main".to_string(),
            schema_version: None,
            display_name: None,
            background_layers: Vec::new(),
            entities: vec![Entity {
                entity_id: "fox".to_string(),
                display_name: None,
                prefab: None,
                transform: Transform { x: 0, y: 0 },
                components: Components {
                    logic: Some(LogicComponent {
                        graph: Some(graph.to_string()),
                        graph_ref: None,
                        graph_origin: None,
                        logic_hints: Vec::new(),
                        external_source_refs: Vec::new(),
                        imported_semantics: None,
                        recovered_rule: None,
                        variables: HashMap::new(),
                    }),
                    ..Components::default()
                },
            }],
            palettes: Vec::new(),
            retrofx: None,
            collision_map: None,
            layers: None,
        }
    }

    #[test]
    fn snes_refuses_condition_on_ground_but_megadrive_and_other_graphs_pass() {
        let with_node = scene_with(
            r#"{"nodes":[{"id":"g","type":"condition_on_ground","params":{"target":"fox"}}],"edges":[]}"#,
        );
        let without = scene_with(
            r#"{"nodes":[{"id":"m","type":"sprite_move","params":{"target":"fox"}}],"edges":[]}"#,
        );
        let issues = logic_support_issues("snes", &with_node);
        assert_eq!(
            issues,
            vec![LogicSupportIssue {
                platform: "snes".to_string(),
                entity_id: "fox".to_string(),
                node_id: "g".to_string(),
                node_type: "condition_on_ground".to_string(),
                reason: "o estado de apoio no chao so existe na fisica do Mega Drive".to_string(),
            }]
        );
        assert!(issue_diagnostic(&issues[0]).blocking);
        assert!(logic_support_issues("megadrive", &with_node).is_empty());
        assert!(logic_support_issues("snes", &without).is_empty());
    }

    #[test]
    fn refuses_broken_behavior_references_from_external_edits() {
        let orphan_entity = scene_with(
            r#"{"nodes":[{"id":"bh_item_x_1__hide","type":"destroy_entity","params":{"target":"ghost","behavior_instance":"bh_item_x_1"}}],"edges":[]}"#,
        );
        let issues = behavior_reference_issues(&orphan_entity);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].reason.contains("'ghost'"));
        let orphan_counter = scene_with(
            r#"{"nodes":[],"edges":[],"behaviors":[{"id":"bh_item_x_1","behaviorId":"collectible","label":"x","params":{"counter":"bh_ctr_gone_1","item":"fox"},"nodeIds":[],"edgeIds":[],"generated":{}}]}"#,
        );
        assert!(behavior_reference_issues(&orphan_counter)[0]
            .reason
            .contains("bh_ctr_gone_1"));
        let fine = scene_with(
            r#"{"nodes":[{"id":"n","type":"destroy_entity","params":{"target":"fox","behavior_instance":"bh"}}],"edges":[]}"#,
        );
        assert!(behavior_reference_issues(&fine).is_empty());
    }
}
