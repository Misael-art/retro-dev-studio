use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::core::rom_mastering::sha256_hex;
use crate::ugdm::entities::Scene;

/// v2 (2026-11-10): identidade por instancia (`bindings`) alem da visao agregada por
/// hash de grafo (`graphs`, mantida para leitores v1). Mapas v1 continuam desserializaveis
/// (campos novos com default); o frontend os converte em vinculos de instancia desconhecida.
pub const SOURCE_MAP_SCHEMA_VERSION: u32 = 2;
pub const SOURCE_MAP_FILE_NAME: &str = "rds-node-source-map.v1.json";
pub const BUILD_PROVENANCE_EVIDENCE_LABEL: &str = "Proveniência de build observada";

const MARKER_BEGIN: &str = "// RDS-BUILD-PROVENANCE-BEGIN";
const MARKER_END: &str = "// RDS-BUILD-PROVENANCE-END";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BuildSourceMap {
    pub schema_version: u32,
    pub kind: String,
    pub evidence_label: String,
    /// Projeto dono do mapa (v2; vazio em mapas v1).
    #[serde(default)]
    pub project: String,
    /// Cena compilada (v2; vazio em mapas v1).
    #[serde(default)]
    pub scene_id: String,
    /// Revisao do C gerado a que os intervalos pertencem (v2; SHA-256 do fonte).
    #[serde(default)]
    pub revision: String,
    pub target: String,
    pub generated_file: String,
    pub generated_source_sha256: String,
    pub artifact: BuildArtifactProvenance,
    pub limitations: Vec<String>,
    pub graphs: Vec<GraphBuildProvenance>,
    /// Vinculos por instancia (v2). Duas instancias com grafos identicos tem entradas
    /// distintas aqui, ao contrario de `graphs`, que agrupa por hash.
    #[serde(default)]
    pub bindings: Vec<CodeBinding>,
}

/// Vinculo codigo <-> modelo: projeto, cena, instancia, grafo, node e revisao.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeBinding {
    pub project: String,
    pub scene_id: String,
    /// Entidade dona do grafo. Vazio = instancia desconhecida (mapa v1 convertido).
    pub instance_id: String,
    pub graph_sha256: String,
    pub node_id: String,
    pub semantic_stage: String,
    pub revision: String,
    pub status: BuildMappingStatus,
    pub generated_locations: Vec<GeneratedSourceLocation>,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BuildArtifactProvenance {
    pub path: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphBuildProvenance {
    pub graph_version: u32,
    pub graph_sha256: String,
    pub entries: Vec<NodeBuildProvenance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NodeBuildProvenance {
    pub node_id: String,
    pub semantic_stage: String,
    pub status: BuildMappingStatus,
    pub generated_locations: Vec<GeneratedSourceLocation>,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BuildMappingStatus {
    Mapped,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GeneratedSourceLocation {
    pub file: String,
    pub start_line: usize,
    pub start_column: usize,
    pub end_line: usize,
    pub end_column: usize,
}

#[derive(Debug, Deserialize)]
struct StoredGraphEnvelope {
    #[serde(default = "default_graph_version")]
    version: u32,
    #[serde(default)]
    nodes: Vec<StoredGraphNode>,
}

#[derive(Debug, Deserialize)]
struct StoredGraphNode {
    id: String,
    #[serde(rename = "type")]
    node_type: String,
}

#[derive(Debug)]
struct ActiveMarker {
    graph_sha256: String,
    instance_id: Option<String>,
    node_id: String,
    marker_line: usize,
}

/// Delimitador de proveniencia lido de uma linha do C gerado. `instance_id` e `None`
/// nos marcadores v1 (sem instancia).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProvenanceMarker {
    Begin {
        graph_sha256: String,
        instance_id: Option<String>,
        node_id: String,
        semantic_stage: String,
    },
    End {
        graph_sha256: String,
        instance_id: Option<String>,
        node_id: String,
    },
}

/// Le um delimitador v1 (sem instancia) ou v2 (com instancia) de uma linha.
pub fn parse_marker(line: &str) -> Option<ProvenanceMarker> {
    let trimmed = line.trim();
    if let Some(payload) = trimmed.strip_prefix(MARKER_BEGIN) {
        let fields = payload.split_whitespace().collect::<Vec<_>>();
        if fields.len() != 3 && fields.len() != 4 {
            return None;
        }
        let instance_id = match fields.get(3) {
            Some(field) => Some(hex_decode(field.strip_prefix('i')?)?),
            None => None,
        };
        return Some(ProvenanceMarker::Begin {
            graph_sha256: fields[0].to_string(),
            instance_id,
            node_id: hex_decode(fields[1])?,
            semantic_stage: hex_decode(fields[2])?,
        });
    }
    if let Some(payload) = trimmed.strip_prefix(MARKER_END) {
        let fields = payload.split_whitespace().collect::<Vec<_>>();
        if fields.len() != 2 && fields.len() != 3 {
            return None;
        }
        let instance_id = match fields.get(2) {
            Some(field) => Some(hex_decode(field.strip_prefix('i')?)?),
            None => None,
        };
        return Some(ProvenanceMarker::End {
            graph_sha256: fields[0].to_string(),
            instance_id,
            node_id: hex_decode(fields[1])?,
        });
    }
    None
}

fn default_graph_version() -> u32 {
    1
}

pub fn graph_revision_hash(serialized_graph: &str) -> String {
    sha256_hex(serialized_graph.as_bytes())
}

pub fn begin_marker(
    graph_sha256: &str,
    instance_id: &str,
    node_id: &str,
    semantic_stage: &str,
) -> String {
    format!(
        "{MARKER_BEGIN} {graph_sha256} {} {} i{}",
        hex_encode(node_id.as_bytes()),
        hex_encode(semantic_stage.as_bytes()),
        hex_encode(instance_id.as_bytes())
    )
}

pub fn end_marker(graph_sha256: &str, instance_id: &str, node_id: &str) -> String {
    format!(
        "{MARKER_END} {graph_sha256} {} i{}",
        hex_encode(node_id.as_bytes()),
        hex_encode(instance_id.as_bytes())
    )
}

const UNSUPPORTED_REASON: &str = "Nenhum trecho C autônomo foi emitido para este nó nesta revisão; ele pode ser uma âncora de fluxo, expressão incorporada, setup agregado ou tipo ainda não mapeável.";

pub fn build_source_map(
    project: &str,
    scene: &Scene,
    target: &str,
    main_c: &str,
) -> BuildSourceMap {
    let regions = collect_generated_regions(main_c);
    let revision = sha256_hex(main_c.as_bytes());
    let mut locations = BTreeMap::<(String, String), Vec<GeneratedSourceLocation>>::new();
    for region in &regions {
        locations
            .entry((region.graph_sha256.clone(), region.node_id.clone()))
            .or_default()
            .push(region.location.clone());
    }
    let mut graphs = BTreeMap::<String, GraphBuildProvenance>::new();
    let mut bindings = Vec::<CodeBinding>::new();

    for entity in &scene.entities {
        let Some(serialized_graph) = entity
            .components
            .logic
            .as_ref()
            .and_then(|logic| logic.graph.as_deref())
        else {
            continue;
        };
        let Ok(mut graph) = serde_json::from_str::<StoredGraphEnvelope>(serialized_graph) else {
            continue;
        };

        let graph_sha256 = graph_revision_hash(serialized_graph);
        graph.nodes.sort_by(|left, right| left.id.cmp(&right.id));
        for node in &graph.nodes {
            let generated_locations = regions
                .iter()
                .filter(|region| {
                    region.graph_sha256 == graph_sha256
                        && region.node_id == node.id
                        && region.instance_id.as_deref() == Some(entity.entity_id.as_str())
                })
                .map(|region| region.location.clone())
                .collect::<Vec<_>>();
            let mapped = !generated_locations.is_empty();
            bindings.push(CodeBinding {
                project: project.to_string(),
                scene_id: scene.scene_id.clone(),
                instance_id: entity.entity_id.clone(),
                graph_sha256: graph_sha256.clone(),
                node_id: node.id.clone(),
                semantic_stage: node.node_type.clone(),
                revision: revision.clone(),
                status: if mapped {
                    BuildMappingStatus::Mapped
                } else {
                    BuildMappingStatus::Unsupported
                },
                generated_locations,
                unsupported_reason: (!mapped).then(|| UNSUPPORTED_REASON.to_string()),
            });
        }
        let entry = graphs
            .entry(graph_sha256.clone())
            .or_insert_with(|| GraphBuildProvenance {
                graph_version: graph.version,
                graph_sha256: graph_sha256.clone(),
                entries: Vec::new(),
            });

        for node in graph.nodes {
            if entry
                .entries
                .iter()
                .any(|candidate| candidate.node_id == node.id)
            {
                continue;
            }
            let key = (graph_sha256.clone(), node.id.clone());
            let generated_locations = locations.get(&key).cloned().unwrap_or_default();
            let mapped = !generated_locations.is_empty();
            entry.entries.push(NodeBuildProvenance {
                node_id: node.id,
                semantic_stage: node.node_type,
                status: if mapped {
                    BuildMappingStatus::Mapped
                } else {
                    BuildMappingStatus::Unsupported
                },
                generated_locations,
                unsupported_reason: (!mapped).then(|| UNSUPPORTED_REASON.to_string()),
            });
        }
        entry
            .entries
            .sort_by(|left, right| left.node_id.cmp(&right.node_id));
    }

    BuildSourceMap {
        schema_version: SOURCE_MAP_SCHEMA_VERSION,
        kind: "node_build_source_map".to_string(),
        evidence_label: BUILD_PROVENANCE_EVIDENCE_LABEL.to_string(),
        project: project.to_string(),
        scene_id: scene.scene_id.clone(),
        revision: revision.clone(),
        target: target.to_string(),
        generated_file: "src/main.c".to_string(),
        generated_source_sha256: revision,
        artifact: BuildArtifactProvenance {
            path: None,
            sha256: None,
        },
        limitations: vec![
            "Este mapa registra proveniência do build; não observa execução, PC, registradores ou estado do emulador.".to_string(),
            "Nós sem intervalo C verificável permanecem unsupported com motivo explícito.".to_string(),
        ],
        graphs: graphs.into_values().collect(),
        bindings,
    }
}

pub fn attach_rom_artifact(source_map: &mut BuildSourceMap, rom_path: &Path) -> Result<(), String> {
    let bytes = std::fs::read(rom_path).map_err(|error| {
        format!(
            "Falha ao ler ROM para proveniência de build '{}': {}",
            rom_path.display(),
            error
        )
    })?;
    source_map.artifact = BuildArtifactProvenance {
        path: Some(rom_path.to_string_lossy().to_string()),
        sha256: Some(sha256_hex(&bytes)),
    };
    Ok(())
}

pub fn serialize_source_map(source_map: &BuildSourceMap) -> Result<String, String> {
    serde_json::to_string_pretty(source_map)
        .map(|json| format!("{json}\n"))
        .map_err(|error| format!("Falha ao serializar source map de build: {error}"))
}

/// Regiao de C emitida para um node, com a instancia quando o marcador e v2.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeneratedRegion {
    pub graph_sha256: String,
    pub instance_id: Option<String>,
    pub node_id: String,
    pub location: GeneratedSourceLocation,
}

pub fn collect_generated_regions(main_c: &str) -> Vec<GeneratedRegion> {
    let lines = main_c.lines().collect::<Vec<_>>();
    let mut active = Vec::<ActiveMarker>::new();
    let mut regions = Vec::<GeneratedRegion>::new();

    for (index, line) in lines.iter().enumerate() {
        let line_number = index + 1;
        match parse_marker(line) {
            Some(ProvenanceMarker::Begin {
                graph_sha256,
                instance_id,
                node_id,
                ..
            }) => active.push(ActiveMarker {
                graph_sha256,
                instance_id,
                node_id,
                marker_line: line_number,
            }),
            Some(ProvenanceMarker::End {
                graph_sha256,
                instance_id,
                node_id,
            }) => {
                let Some(position) = active.iter().rposition(|marker| {
                    marker.graph_sha256 == graph_sha256
                        && marker.node_id == node_id
                        && marker.instance_id == instance_id
                }) else {
                    continue;
                };
                let marker = active.remove(position);
                let start_line = marker.marker_line + 1;
                let end_line = line_number.saturating_sub(1);
                if start_line <= end_line {
                    let end_column = lines
                        .get(end_line.saturating_sub(1))
                        .map(|line| line.chars().count() + 1)
                        .unwrap_or(1);
                    regions.push(GeneratedRegion {
                        graph_sha256: marker.graph_sha256,
                        instance_id: marker.instance_id,
                        node_id: marker.node_id,
                        location: GeneratedSourceLocation {
                            file: "src/main.c".to_string(),
                            start_line,
                            start_column: 1,
                            end_line,
                            end_column,
                        },
                    });
                }
            }
            None => {}
        }
    }

    regions
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn hex_decode(value: &str) -> Option<String> {
    if !value.len().is_multiple_of(2) {
        return None;
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    for pair in value.as_bytes().chunks_exact(2) {
        let high = hex_nibble(pair[0])?;
        let low = hex_nibble(pair[1])?;
        bytes.push((high << 4) | low);
    }
    String::from_utf8(bytes).ok()
}

fn hex_nibble(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ugdm::components::{Components, LogicComponent};
    use crate::ugdm::entities::{Entity, Transform};

    fn scene_with_graph(graph: &str) -> Scene {
        Scene {
            scene_id: "source-map".to_string(),
            schema_version: None,
            display_name: None,
            background_layers: Vec::new(),
            entities: vec![Entity {
                entity_id: "player".to_string(),
                display_name: None,
                prefab: None,
                transform: Transform::default(),
                components: Components {
                    logic: Some(LogicComponent {
                        graph: Some(graph.to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            }],
            palettes: Vec::new(),
            retrofx: None,
            collision_map: None,
            layers: None,
        }
    }

    #[test]
    fn source_map_serialization_is_deterministic_and_maps_real_lines() {
        let graph = r#"{"version":1,"nodes":[{"id":"move-1","type":"sprite_move"},{"id":"event-1","type":"event_update"}],"edges":[]}"#;
        let hash = graph_revision_hash(graph);
        let main_c = format!(
            "void tick(void) {{\n    {}\n    player_x += 1;\n    {}\n}}\n",
            begin_marker(&hash, "player", "move-1", "sprite_move"),
            end_marker(&hash, "player", "move-1")
        );
        let scene = scene_with_graph(graph);
        let first = build_source_map("proj", &scene, "megadrive", &main_c);
        let second = build_source_map("proj", &scene, "megadrive", &main_c);

        assert_eq!(
            serialize_source_map(&first).unwrap(),
            serialize_source_map(&second).unwrap()
        );
        let entries = &first.graphs[0].entries;
        let mapped = entries
            .iter()
            .find(|entry| entry.node_id == "move-1")
            .unwrap();
        assert_eq!(mapped.status, BuildMappingStatus::Mapped);
        assert_eq!(mapped.generated_locations[0].start_line, 3);
        assert_eq!(main_c.lines().nth(2), Some("    player_x += 1;"));
        let unsupported = entries
            .iter()
            .find(|entry| entry.node_id == "event-1")
            .unwrap();
        assert_eq!(unsupported.status, BuildMappingStatus::Unsupported);
        assert!(unsupported
            .unsupported_reason
            .as_deref()
            .unwrap()
            .contains("Nenhum trecho C"));
    }

    #[test]
    fn identical_graphs_on_two_instances_keep_distinct_bindings() {
        let graph = r#"{"version":1,"nodes":[{"id":"move-1","type":"sprite_move"}],"edges":[]}"#;
        let hash = graph_revision_hash(graph);
        let mut scene = scene_with_graph(graph);
        let mut twin = scene.entities[0].clone();
        twin.entity_id = "player_2".to_string();
        scene.entities.push(twin);
        let main_c = format!(
            "{}\na();\n{}\n{}\nb();\nb2();\n{}\n",
            begin_marker(&hash, "player", "move-1", "sprite_move"),
            end_marker(&hash, "player", "move-1"),
            begin_marker(&hash, "player_2", "move-1", "sprite_move"),
            end_marker(&hash, "player_2", "move-1"),
        );
        let map = build_source_map("proj", &scene, "megadrive", &main_c);

        assert_eq!(map.schema_version, 2);
        // A visao agregada v1 continua reunindo as duas instancias sob o mesmo hash...
        assert_eq!(map.graphs.len(), 1);
        assert_eq!(map.graphs[0].entries[0].generated_locations.len(), 2);
        // ...mas os vinculos v2 distinguem cada instancia.
        let of = |instance: &str| {
            map.bindings
                .iter()
                .find(|binding| binding.instance_id == instance)
                .unwrap()
        };
        assert_eq!(of("player").generated_locations.len(), 1);
        assert_eq!(of("player").generated_locations[0].start_line, 2);
        assert_eq!(of("player_2").generated_locations[0].start_line, 5);
        assert_eq!(of("player_2").generated_locations[0].end_line, 6);
        assert_eq!(of("player").project, "proj");
        assert_eq!(of("player").scene_id, "source-map");
        assert_eq!(of("player").revision, map.generated_source_sha256);
    }

    #[test]
    fn legacy_v1_map_and_markers_are_still_readable() {
        let graph = r#"{"version":1,"nodes":[{"id":"move-1","type":"sprite_move"}],"edges":[]}"#;
        let hash = graph_revision_hash(graph);
        // Marcadores v1: sem campo de instancia.
        let legacy_c = format!(
            "// RDS-BUILD-PROVENANCE-BEGIN {hash} {} {}\nx();\n// RDS-BUILD-PROVENANCE-END {hash} {}\n",
            hex_encode(b"move-1"),
            hex_encode(b"sprite_move"),
            hex_encode(b"move-1"),
        );
        let regions = collect_generated_regions(&legacy_c);
        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].instance_id, None);
        assert_eq!(regions[0].location.start_line, 2);

        // Mapa v1 gravado por builds antigos: sem project/scene/bindings.
        let legacy_json = format!(
            r#"{{"schema_version":1,"kind":"node_build_source_map","evidence_label":"x","target":"megadrive","generated_file":"src/main.c","generated_source_sha256":"abc","artifact":{{"path":null,"sha256":null}},"limitations":[],"graphs":[{{"graph_version":1,"graph_sha256":"{hash}","entries":[{{"node_id":"move-1","semantic_stage":"sprite_move","status":"mapped","generated_locations":[{{"file":"src/main.c","start_line":2,"start_column":1,"end_line":2,"end_column":5}}],"unsupported_reason":null}}]}}]}}"#
        );
        let legacy: BuildSourceMap = serde_json::from_str(&legacy_json).unwrap();
        assert_eq!(legacy.schema_version, 1);
        assert!(legacy.bindings.is_empty());
        assert_eq!(legacy.project, "");
        assert_eq!(
            legacy.graphs[0].entries[0].generated_locations[0].start_line,
            2
        );
    }

    #[test]
    fn graph_revision_hash_rejects_any_serialized_revision_change() {
        let first = graph_revision_hash(r#"{"version":1,"nodes":[],"edges":[]}"#);
        let second = graph_revision_hash(r#"{"version":1,"nodes":[1],"edges":[]}"#);
        assert_ne!(first, second);
        assert_eq!(first.len(), 64);
    }
}
