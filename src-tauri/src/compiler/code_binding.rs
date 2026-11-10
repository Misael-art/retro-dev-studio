//! Vinculos e sincronizacao codigo <-> modelo do editor de C/SGDK (Experimental).
//!
//! Em projetos autorais o C emitido e uma *projecao editavel* do modelo canonico
//! (cena + grafos). Este modulo:
//! - projeta o documento de codigo sem os delimitadores de build, com vinculos por
//!   projeto/cena/instancia/grafo/node/revisao (`CodeDocument`, `CodeBinding`);
//! - analisa uma transacao de edicao (`CodeEditTransaction`) sobre a regiao de um node
//!   de UMA instancia e devolve um recibo versionado (`CodeEditReceipt`):
//!   * alteracao representavel -> novos parametros do node, comprovados por reemissao;
//!   * logica adicional -> a regiao vira um no de codigo (`code_block`), sem execucao
//!     duplicada (os nodes absorvidos saem do grafo);
//!   * texto incompleto -> rascunho recuperavel guardado no proprio grafo;
//!   * contexto/revisao divergente -> `stale`, sem mutacao.
//!
//! Nada aqui grava em disco nem muta a cena: o recibo traz o novo grafo da instancia e
//! o owner existente (`editorStore`/save canonico) aplica, com o historico unificado.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::compiler::ast_generator::generate_ast;
use crate::compiler::build_provenance::{
    graph_revision_hash, parse_marker, BuildMappingStatus, CodeBinding, GeneratedSourceLocation,
    ProvenanceMarker,
};
use crate::compiler::sgdk_emitter::emit_sgdk_with_collision;
use crate::core::project_mgr::{load_project, resolve_prefabs};
use crate::core::rom_mastering::sha256_hex;
use crate::ugdm::entities::Scene;

pub const CODE_DOCUMENT_SCHEMA: &str = "rds-code-document/v1";
pub const CODE_EDIT_SCHEMA: &str = "rds-code-edit/v1";
pub const CODE_BLOCK_NODE_TYPE: &str = "code_block";
/// Limite de combinacoes de parametros reemitidas por transacao.
const MAX_PARAM_ATTEMPTS: usize = 128;

// ── Contratos ────────────────────────────────────────────────────────────────

/// Identidade de um documento: respostas de outro projeto/cena/revisao sao descartadas.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeContext {
    pub project: String,
    pub scene_id: String,
    /// SHA-256 do texto projetado (sem delimitadores).
    pub revision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeDocument {
    pub schema: String,
    pub context: CodeContext,
    /// `authored_projection`: o modelo (cena/grafos) e a fonte de verdade.
    pub kind: String,
    /// Fonte que governa o build deste documento.
    pub governs_build: String,
    pub target: String,
    pub file: String,
    pub text: String,
    /// Vinculos com intervalos nas coordenadas de `text`.
    pub bindings: Vec<CodeBinding>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CodeEditScope {
    /// Padrao: so a instancia selecionada.
    Instance,
    /// Definicao compartilhada: todos os usos listados no recibo.
    Shared,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeEditTransaction {
    pub schema: String,
    pub context: CodeContext,
    pub instance_id: String,
    pub node_id: String,
    pub graph_sha256: String,
    /// Novo texto completo da regiao do node.
    pub new_text: String,
    pub scope: CodeEditScope,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CodeEditStatus {
    NoChange,
    NodeParams,
    CodeNode,
    Draft,
    Stale,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChangedParam {
    pub node_id: String,
    pub key: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CodeEditReceipt {
    pub schema: String,
    /// Eco do contexto da transacao: o cliente descarta recibos de outro contexto.
    pub context: CodeContext,
    pub status: CodeEditStatus,
    pub instance_id: String,
    pub node_id: String,
    pub scope: CodeEditScope,
    /// Novo grafo serializado da instancia (ausente em no_change/stale/rejected).
    pub graph: Option<String>,
    pub changed_params: Vec<ChangedParam>,
    /// Nodes cuja regiao estava dentro da regiao substituida (removidos do grafo).
    pub absorbed_node_ids: Vec<String>,
    /// Outras instancias que usam a mesma definicao compartilhada (`graph_ref`).
    pub shared_uses: Vec<String>,
    pub message: String,
}

// ── Utilitarios de texto ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokenKind {
    Ident,
    Number,
    Literal,
    Comment,
    Punct,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Token {
    kind: TokenKind,
    text: String,
    /// Linha (base 0) relativa ao inicio do texto.
    line: usize,
}

fn lex(text: &str) -> Vec<Token> {
    let chars = text.chars().collect::<Vec<_>>();
    let mut tokens = Vec::new();
    let mut index = 0;
    let mut line = 0;
    while index < chars.len() {
        let current = chars[index];
        if current == '\n' {
            line += 1;
            index += 1;
            continue;
        }
        if current.is_whitespace() {
            index += 1;
            continue;
        }
        let start = index;
        let start_line = line;
        let kind = if current == '/' && chars.get(index + 1) == Some(&'/') {
            while index < chars.len() && chars[index] != '\n' {
                index += 1;
            }
            TokenKind::Comment
        } else if current == '/' && chars.get(index + 1) == Some(&'*') {
            index += 2;
            while index < chars.len()
                && !(chars[index] == '*' && chars.get(index + 1) == Some(&'/'))
            {
                if chars[index] == '\n' {
                    line += 1;
                }
                index += 1;
            }
            index = (index + 2).min(chars.len());
            TokenKind::Comment
        } else if current == '"' || current == '\'' {
            index += 1;
            while index < chars.len() && chars[index] != current && chars[index] != '\n' {
                if chars[index] == '\\' {
                    index += 1;
                }
                index += 1;
            }
            index = (index + 1).min(chars.len());
            TokenKind::Literal
        } else if current.is_ascii_digit() {
            while index < chars.len() && (chars[index].is_alphanumeric() || chars[index] == '.') {
                index += 1;
            }
            TokenKind::Number
        } else if current.is_alphabetic() || current == '_' {
            while index < chars.len() && (chars[index].is_alphanumeric() || chars[index] == '_') {
                index += 1;
            }
            TokenKind::Ident
        } else {
            index += 1;
            TokenKind::Punct
        };
        tokens.push(Token {
            kind,
            text: chars[start..index.min(chars.len())].iter().collect(),
            line: start_line,
        });
    }
    tokens
}

fn same_tokens(left: &[Token], right: &[Token]) -> bool {
    left.len() == right.len()
        && left
            .iter()
            .zip(right)
            .all(|(a, b)| a.kind == b.kind && a.text == b.text)
}

fn parse_c_int(text: &str) -> Option<i64> {
    let trimmed = text.trim_end_matches(['u', 'U', 'l', 'L']);
    if let Some(hex) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    {
        return i64::from_str_radix(hex, 16).ok();
    }
    trimmed.parse::<i64>().ok()
}

/// Devolve o nome da primeira chamada de alocacao dinamica da libc usada em `code`.
/// `MEM_alloc`/`MEM_free` do SGDK nao sao afetados (identificadores distintos).
pub fn forbidden_dynamic_memory(code: &str) -> Option<&'static str> {
    let tokens = lex(code);
    tokens.windows(2).find_map(|pair| {
        if pair[0].kind != TokenKind::Ident || pair[1].text != "(" {
            return None;
        }
        ["malloc", "calloc", "realloc", "free"]
            .into_iter()
            .find(|name| pair[0].text == *name)
    })
}

/// Remove a indentacao comum e os espacos finais, preservando linhas internas.
pub fn dedent(text: &str) -> String {
    let lines = text.lines().collect::<Vec<_>>();
    let common = lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.chars().take_while(|c| *c == ' ' || *c == '\t').count())
        .min()
        .unwrap_or(0);
    let mut out = lines
        .iter()
        .map(|line| {
            if line.trim().is_empty() {
                String::new()
            } else {
                line.chars().skip(common).collect::<String>()
            }
        })
        .collect::<Vec<_>>();
    while out.first().is_some_and(|line| line.is_empty()) {
        out.remove(0);
    }
    while out.last().is_some_and(|line| line.is_empty()) {
        out.pop();
    }
    out.join("\n")
}

/// Emite um no de codigo na indentacao do ponto de insercao, linha a linha.
pub fn indent_code_block(code: &str, indent: &str) -> String {
    let mut out = String::new();
    for line in dedent(code).lines() {
        if !line.is_empty() {
            out.push_str(indent);
            out.push_str(line);
        }
        out.push('\n');
    }
    out
}

/// O texto forma instrucoes C completas? (tree-sitter, mesmo parser do grafo C.)
pub fn region_is_complete(text: &str) -> bool {
    let wrapped = format!("void rds_region_probe(void) {{\n{text}\n}}\n");
    let mut parser = tree_sitter::Parser::new();
    if parser
        .set_language(&tree_sitter_c::LANGUAGE.into())
        .is_err()
    {
        return false;
    }
    let Some(tree) = parser.parse(&wrapped, None) else {
        return false;
    };
    let root = tree.root_node();
    // A regiao tem de continuar dentro da unica funcao de sondagem: uma chave a mais
    // fecharia a funcao e criaria itens soltos.
    !root.has_error() && root.named_child_count() == 1
}

// ── Projecao do documento ────────────────────────────────────────────────────

/// Projeta o documento a partir do C emitido (com delimitadores): o texto sai sem os
/// delimitadores e cada vinculo recebe o intervalo correspondente.
pub fn project_document(project: &str, scene: &Scene, target: &str, main_c: &str) -> CodeDocument {
    struct Open {
        graph_sha256: String,
        instance_id: Option<String>,
        node_id: String,
        first_line: usize,
    }
    let mut out_lines = Vec::<&str>::new();
    let mut open = Vec::<Open>::new();
    let mut regions = Vec::<(String, String, String, usize, usize)>::new();
    for line in main_c.lines() {
        match parse_marker(line) {
            Some(ProvenanceMarker::Begin {
                graph_sha256,
                instance_id,
                node_id,
                ..
            }) => open.push(Open {
                graph_sha256,
                instance_id,
                node_id,
                first_line: out_lines.len() + 1,
            }),
            Some(ProvenanceMarker::End {
                graph_sha256,
                instance_id,
                node_id,
            }) => {
                if let Some(position) = open.iter().rposition(|candidate| {
                    candidate.graph_sha256 == graph_sha256
                        && candidate.node_id == node_id
                        && candidate.instance_id == instance_id
                }) {
                    let begun = open.remove(position);
                    if let Some(instance) = begun.instance_id {
                        if begun.first_line <= out_lines.len() {
                            regions.push((
                                instance,
                                begun.graph_sha256,
                                begun.node_id,
                                begun.first_line,
                                out_lines.len(),
                            ));
                        }
                    }
                }
            }
            None => out_lines.push(line),
        }
    }
    let mut text = out_lines.join("\n");
    if main_c.ends_with('\n') {
        text.push('\n');
    }
    let revision = sha256_hex(text.as_bytes());

    let mut bindings = Vec::new();
    for entity in &scene.entities {
        let Some(serialized) = entity
            .components
            .logic
            .as_ref()
            .and_then(|logic| logic.graph.as_deref())
        else {
            continue;
        };
        let Ok(graph) = serde_json::from_str::<Value>(serialized) else {
            continue;
        };
        let graph_sha256 = graph_revision_hash(serialized);
        let mut nodes = graph_nodes(&graph)
            .iter()
            .filter_map(|node| Some((node.get("id")?.as_str()?, node.get("type")?.as_str()?)))
            .collect::<Vec<_>>();
        nodes.sort();
        for (node_id, node_type) in nodes {
            let generated_locations = regions
                .iter()
                .filter(|(instance, graph, node, _, _)| {
                    instance == &entity.entity_id && graph == &graph_sha256 && node == node_id
                })
                .map(|(_, _, _, start, end)| GeneratedSourceLocation {
                    file: "src/main.c".to_string(),
                    start_line: *start,
                    start_column: 1,
                    end_line: *end,
                    end_column: out_lines
                        .get(end.saturating_sub(1))
                        .map(|line| line.chars().count() + 1)
                        .unwrap_or(1),
                })
                .collect::<Vec<_>>();
            let mapped = !generated_locations.is_empty();
            bindings.push(CodeBinding {
                project: project.to_string(),
                scene_id: scene.scene_id.clone(),
                instance_id: entity.entity_id.clone(),
                graph_sha256: graph_sha256.clone(),
                node_id: node_id.to_string(),
                semantic_stage: node_type.to_string(),
                revision: revision.clone(),
                status: if mapped {
                    BuildMappingStatus::Mapped
                } else {
                    BuildMappingStatus::Unsupported
                },
                generated_locations,
                unsupported_reason: (!mapped)
                    .then(|| "Sem trecho C autonomo nesta revisao.".to_string()),
            });
        }
    }

    CodeDocument {
        schema: CODE_DOCUMENT_SCHEMA.to_string(),
        context: CodeContext {
            project: project.to_string(),
            scene_id: scene.scene_id.clone(),
            revision,
        },
        kind: "authored_projection".to_string(),
        governs_build: "scene_model".to_string(),
        target: target.to_string(),
        file: "src/main.c".to_string(),
        text,
        bindings,
    }
}

fn graph_nodes(graph: &Value) -> &[Value] {
    graph
        .get("nodes")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn graph_edges(graph: &Value) -> &[Value] {
    graph
        .get("edges")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn edge_field<'a>(edge: &'a Value, key: &str) -> &'a str {
    edge.get(key).and_then(Value::as_str).unwrap_or("")
}

fn region_text(document: &CodeDocument, location: &GeneratedSourceLocation) -> String {
    document
        .text
        .lines()
        .skip(location.start_line - 1)
        .take(location.end_line + 1 - location.start_line)
        .collect::<Vec<_>>()
        .join("\n")
}

fn single_region<'a>(
    document: &'a CodeDocument,
    instance_id: &str,
    node_id: &str,
) -> Option<&'a GeneratedSourceLocation> {
    let binding = document
        .bindings
        .iter()
        .find(|binding| binding.instance_id == instance_id && binding.node_id == node_id)?;
    match binding.generated_locations.as_slice() {
        [only] => Some(only),
        _ => None,
    }
}

fn instance_graph(scene: &Scene, instance_id: &str) -> Option<String> {
    scene
        .entities
        .iter()
        .find(|entity| entity.entity_id == instance_id)?
        .components
        .logic
        .as_ref()?
        .graph
        .clone()
}

/// Copia da cena com o grafo de UMA instancia trocado; as demais ficam intactas.
pub fn scene_with_instance_graph(scene: &Scene, instance_id: &str, graph: &str) -> Scene {
    let mut next = scene.clone();
    if let Some(logic) = next
        .entities
        .iter_mut()
        .find(|entity| entity.entity_id == instance_id)
        .and_then(|entity| entity.components.logic.as_mut())
    {
        logic.graph = Some(graph.to_string());
    }
    next
}

fn shared_uses(scene: &Scene, instance_id: &str) -> Vec<String> {
    let reference = scene
        .entities
        .iter()
        .find(|entity| entity.entity_id == instance_id)
        .and_then(|entity| entity.components.logic.as_ref())
        .and_then(|logic| logic.graph_ref.as_deref())
        .map(str::trim)
        .filter(|reference| !reference.is_empty());
    let Some(reference) = reference else {
        return Vec::new();
    };
    scene
        .entities
        .iter()
        .filter(|entity| entity.entity_id != instance_id)
        .filter(|entity| {
            entity
                .components
                .logic
                .as_ref()
                .and_then(|logic| logic.graph_ref.as_deref())
                .map(str::trim)
                == Some(reference)
        })
        .map(|entity| entity.entity_id.clone())
        .collect()
}

// ── Rascunhos no grafo ───────────────────────────────────────────────────────

fn without_draft(mut graph: Value, node_id: &str) -> Value {
    let emptied = match graph.get_mut("codeDrafts").and_then(Value::as_array_mut) {
        Some(drafts) => {
            drafts.retain(|draft| draft.get("nodeId").and_then(Value::as_str) != Some(node_id));
            drafts.is_empty()
        }
        None => false,
    };
    if emptied {
        if let Some(object) = graph.as_object_mut() {
            object.remove("codeDrafts");
        }
    }
    graph
}

fn with_draft(graph: Value, node_id: &str, text: &str, reason: &str) -> Value {
    let mut graph = without_draft(graph, node_id);
    if let Some(object) = graph.as_object_mut() {
        let drafts = object.entry("codeDrafts").or_insert_with(|| json!([]));
        if let Some(list) = drafts.as_array_mut() {
            list.push(json!({ "nodeId": node_id, "text": text, "reason": reason }));
        }
    }
    graph
}

// ── Analise da transacao ─────────────────────────────────────────────────────

struct Analysis<'a> {
    project: &'a str,
    target: &'a str,
    scene: &'a Scene,
    emit: &'a dyn Fn(&Scene) -> String,
    tx: &'a CodeEditTransaction,
}

impl Analysis<'_> {
    fn receipt(&self, status: CodeEditStatus, message: impl Into<String>) -> CodeEditReceipt {
        CodeEditReceipt {
            schema: CODE_EDIT_SCHEMA.to_string(),
            context: self.tx.context.clone(),
            status,
            instance_id: self.tx.instance_id.clone(),
            node_id: self.tx.node_id.clone(),
            scope: self.tx.scope,
            graph: None,
            changed_params: Vec::new(),
            absorbed_node_ids: Vec::new(),
            shared_uses: shared_uses(self.scene, &self.tx.instance_id),
            message: message.into(),
        }
    }

    fn project_with(&self, graph: &Value) -> CodeDocument {
        let scene = scene_with_instance_graph(self.scene, &self.tx.instance_id, &graph.to_string());
        project_document(self.project, &scene, self.target, &(self.emit)(&scene))
    }

    fn draft(&self, graph: Value, reason: &str) -> CodeEditReceipt {
        let graph = with_draft(graph, &self.tx.node_id, &self.tx.new_text, reason);
        let mut receipt = self.receipt(CodeEditStatus::Draft, reason);
        receipt.graph = Some(graph.to_string());
        receipt
    }
}

/// Analisa uma transacao sobre a regiao de um node de uma instancia. `emit` devolve o C
/// (com delimitadores) da cena dada; e chamado de novo para comprovar cada resultado.
pub fn analyze_code_edit(
    project: &str,
    target: &str,
    scene: &Scene,
    emit: &dyn Fn(&Scene) -> String,
    tx: &CodeEditTransaction,
) -> CodeEditReceipt {
    let analysis = Analysis {
        project,
        target,
        scene,
        emit,
        tx,
    };
    if tx.schema != CODE_EDIT_SCHEMA {
        return analysis.receipt(
            CodeEditStatus::Rejected,
            format!("Esquema de transacao desconhecido: {}.", tx.schema),
        );
    }
    let document = project_document(project, scene, target, &emit(scene));
    if document.context != tx.context {
        return analysis.receipt(
            CodeEditStatus::Stale,
            "A transacao pertence a outro projeto, cena ou revisao; nada foi alterado.",
        );
    }
    let Some(serialized) = instance_graph(scene, &tx.instance_id) else {
        return analysis.receipt(CodeEditStatus::Rejected, "Instancia sem grafo de logica.");
    };
    if graph_revision_hash(&serialized) != tx.graph_sha256 {
        return analysis.receipt(
            CodeEditStatus::Stale,
            "O grafo da instancia mudou desde a leitura; nada foi alterado.",
        );
    }
    let Ok(graph) = serde_json::from_str::<Value>(&serialized) else {
        return analysis.receipt(CodeEditStatus::Rejected, "Grafo da instancia ilegivel.");
    };
    let Some(location) = single_region(&document, &tx.instance_id, &tx.node_id).cloned() else {
        return analysis.receipt(
            CodeEditStatus::Rejected,
            "Este node nao tem uma regiao unica de codigo nesta revisao.",
        );
    };

    let original = lex(&region_text(&document, &location));
    let edited = lex(&tx.new_text);
    if same_tokens(&original, &edited) {
        return analysis.receipt(CodeEditStatus::NoChange, "Sem alteracao de codigo.");
    }
    if !region_is_complete(&tx.new_text) {
        return analysis.draft(
            graph,
            "Texto incompleto: guardado como rascunho, o modelo nao mudou.",
        );
    }

    if let Some((next, changed)) =
        try_param_edit(&analysis, &graph, &document, &location, &original, &edited)
    {
        let mut receipt = analysis.receipt(
            CodeEditStatus::NodeParams,
            "Alteracao representavel: parametros do node atualizados.",
        );
        receipt.graph = Some(without_draft(next, &tx.node_id).to_string());
        receipt.changed_params = changed;
        return receipt;
    }

    match replace_with_code_node(&analysis, &graph, &document, &location, &edited) {
        Ok((next, absorbed)) => {
            let mut receipt = analysis.receipt(
                CodeEditStatus::CodeNode,
                "Logica sem equivalente visual: a regiao passou a ser um no de codigo.",
            );
            receipt.graph = Some(next.to_string());
            receipt.absorbed_node_ids = absorbed;
            receipt
        }
        Err(reason) => analysis.draft(graph, &reason),
    }
}

/// Node mais interno (da mesma instancia) cuja regiao contem a linha dada.
fn innermost_node(document: &CodeDocument, instance_id: &str, line: usize) -> Option<String> {
    document
        .bindings
        .iter()
        .filter(|binding| binding.instance_id == instance_id)
        .filter_map(|binding| match binding.generated_locations.as_slice() {
            [only] if only.start_line <= line && line <= only.end_line => {
                Some((only.end_line - only.start_line, binding.node_id.clone()))
            }
            _ => None,
        })
        .min()
        .map(|(_, node_id)| node_id)
}

/// O node e os nodes de dados que o alimentam (ate 4 saltos por portas nao-exec).
fn node_with_data_sources(graph: &Value, node_id: &str) -> Vec<String> {
    let mut found = vec![node_id.to_string()];
    let mut frontier = vec![node_id.to_string()];
    for _ in 0..4 {
        let mut next = Vec::new();
        for edge in graph_edges(graph) {
            if frontier.iter().any(|id| id == edge_field(edge, "toNode"))
                && edge_field(edge, "toPort") != "exec"
            {
                let source = edge_field(edge, "fromNode").to_string();
                if !found.contains(&source) {
                    found.push(source.clone());
                    next.push(source);
                }
            }
        }
        frontier = next;
    }
    found
}

fn numeric_param(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => number.as_i64(),
        Value::String(text) => text.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn like_param(original: &Value, number: i64) -> Value {
    match original {
        Value::String(_) => Value::String(number.to_string()),
        _ => json!(number),
    }
}

fn param_candidates(
    graph: &Value,
    node_ids: &[String],
    old: &Token,
    new: &Token,
) -> Vec<ChangedParam> {
    let mut candidates = Vec::new();
    for node in graph_nodes(graph) {
        let Some(id) = node.get("id").and_then(Value::as_str) else {
            continue;
        };
        if !node_ids.iter().any(|candidate| candidate == id) {
            continue;
        }
        let Some(params) = node.get("params").and_then(Value::as_object) else {
            continue;
        };
        for (key, value) in params {
            let candidate = match old.kind {
                TokenKind::Number => {
                    let (Some(before), Some(after), Some(current)) = (
                        parse_c_int(&old.text),
                        parse_c_int(&new.text),
                        numeric_param(value),
                    ) else {
                        continue;
                    };
                    if current == before {
                        Some(like_param(value, after))
                    } else if current == -before && before != 0 {
                        Some(like_param(value, -after))
                    } else {
                        None
                    }
                }
                TokenKind::Ident => value.as_str().and_then(|current| {
                    if current.is_empty() {
                        return None;
                    }
                    if current == old.text {
                        return Some(Value::String(new.text.clone()));
                    }
                    // Ex.: param "a" emitido como BUTTON_A; BUTTON_B -> param "b".
                    let prefix_len = old.text.len().checked_sub(current.len())?;
                    let (prefix, tail) = old.text.split_at_checked(prefix_len)?;
                    if !tail.eq_ignore_ascii_case(current) {
                        return None;
                    }
                    let renamed = new.text.strip_prefix(prefix)?;
                    Some(Value::String(if current.chars().any(char::is_lowercase) {
                        renamed.to_lowercase()
                    } else {
                        renamed.to_string()
                    }))
                }),
                _ => None,
            };
            if let Some(value) = candidate {
                candidates.push(ChangedParam {
                    node_id: id.to_string(),
                    key: key.clone(),
                    value,
                });
            }
        }
    }
    candidates
}

fn apply_params(graph: &Value, changes: &[ChangedParam]) -> Value {
    let mut next = graph.clone();
    if let Some(nodes) = next.get_mut("nodes").and_then(Value::as_array_mut) {
        for change in changes {
            if let Some(params) = nodes
                .iter_mut()
                .find(|node| node.get("id").and_then(Value::as_str) == Some(&change.node_id))
                .and_then(|node| node.get_mut("params"))
                .and_then(Value::as_object_mut)
            {
                params.insert(change.key.clone(), change.value.clone());
            }
        }
    }
    next
}

/// Tenta explicar a edicao so com parametros de nodes. Cada hipotese e comprovada
/// reemitindo o C: so vale se a regiao reemitida for identica ao texto editado.
fn try_param_edit(
    analysis: &Analysis<'_>,
    graph: &Value,
    document: &CodeDocument,
    location: &GeneratedSourceLocation,
    original: &[Token],
    edited: &[Token],
) -> Option<(Value, Vec<ChangedParam>)> {
    if original.len() != edited.len() {
        return None;
    }
    let mut per_diff = Vec::<Vec<ChangedParam>>::new();
    for (old, new) in original.iter().zip(edited) {
        if old.text == new.text && old.kind == new.kind {
            continue;
        }
        if old.kind != new.kind || !matches!(old.kind, TokenKind::Number | TokenKind::Ident) {
            return None;
        }
        let owner = innermost_node(
            document,
            &analysis.tx.instance_id,
            location.start_line + old.line,
        )?;
        let candidates = param_candidates(graph, &node_with_data_sources(graph, &owner), old, new);
        if candidates.is_empty() {
            return None;
        }
        per_diff.push(candidates);
    }
    if per_diff.is_empty() || per_diff.len() > 6 {
        return None;
    }

    let mut attempts = 0;
    let mut choice = vec![0usize; per_diff.len()];
    loop {
        attempts += 1;
        if attempts > MAX_PARAM_ATTEMPTS {
            return None;
        }
        let mut changes = Vec::<ChangedParam>::new();
        let mut consistent = true;
        for (diff, picked) in per_diff.iter().zip(&choice) {
            let change = &diff[*picked];
            match changes
                .iter()
                .find(|other| other.node_id == change.node_id && other.key == change.key)
            {
                Some(other) if other.value != change.value => consistent = false,
                Some(_) => {}
                None => changes.push(change.clone()),
            }
        }
        if consistent {
            let next = apply_params(graph, &changes);
            let projected = analysis.project_with(&next);
            if let Some(region) =
                single_region(&projected, &analysis.tx.instance_id, &analysis.tx.node_id)
            {
                if same_tokens(&lex(&region_text(&projected, region)), edited) {
                    return Some((next, changes));
                }
            }
        }
        // Proxima combinacao (odometro).
        let mut position = 0;
        loop {
            if position == choice.len() {
                return None;
            }
            choice[position] += 1;
            if choice[position] < per_diff[position].len() {
                break;
            }
            choice[position] = 0;
            position += 1;
        }
    }
}

fn retain_ids(graph: &mut Value, list: &str, field: &str, removed: &BTreeSet<String>) {
    if let Some(items) = graph.get_mut(list).and_then(Value::as_array_mut) {
        for item in items {
            if let Some(ids) = item.get_mut(field).and_then(Value::as_array_mut) {
                ids.retain(|id| id.as_str().is_none_or(|id| !removed.contains(id)));
            }
        }
    }
}

/// Troca a regiao por um no de codigo com o mesmo id (as conexoes de fluxo de entrada e
/// de continuacao sao preservadas) e remove os nodes cuja regiao estava dentro dela.
fn replace_with_code_node(
    analysis: &Analysis<'_>,
    graph: &Value,
    document: &CodeDocument,
    location: &GeneratedSourceLocation,
    edited: &[Token],
) -> Result<(Value, Vec<String>), String> {
    let tx = analysis.tx;
    let absorbed = document
        .bindings
        .iter()
        .filter(|binding| binding.instance_id == tx.instance_id && binding.node_id != tx.node_id)
        .filter(|binding| {
            !binding.generated_locations.is_empty()
                && binding.generated_locations.iter().all(|inner| {
                    location.start_line <= inner.start_line && inner.end_line <= location.end_line
                })
        })
        .map(|binding| binding.node_id.clone())
        .collect::<BTreeSet<_>>();

    for edge in graph_edges(graph) {
        let from = edge_field(edge, "fromNode");
        let to = edge_field(edge, "toNode");
        let leaves_region = (absorbed.contains(from)
            || (from == tx.node_id && edge_field(edge, "fromPort") != "exec"))
            && !absorbed.contains(to)
            && to != tx.node_id;
        if leaves_region {
            return Err(format!(
                "A regiao continua em '{to}', fora do trecho editado; guardado como rascunho para nao duplicar nem perder fluxo."
            ));
        }
    }

    let mut next = without_draft(graph.clone(), &tx.node_id);
    let code = dedent(&tx.new_text);
    let summary = code.lines().next().unwrap_or("").trim().to_string();
    if let Some(nodes) = next.get_mut("nodes").and_then(Value::as_array_mut) {
        nodes.retain(|node| {
            node.get("id")
                .and_then(Value::as_str)
                .is_none_or(|id| !absorbed.contains(id))
        });
        let node = nodes
            .iter_mut()
            .find(|node| node.get("id").and_then(Value::as_str) == Some(&tx.node_id))
            .and_then(Value::as_object_mut)
            .ok_or_else(|| "Node da regiao ausente do grafo.".to_string())?;
        let replaced = node
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let previous = node
            .get("params")
            .and_then(|params| params.get("replaced_type"))
            .and_then(Value::as_str)
            .map(str::to_string);
        node.insert("type".into(), json!(CODE_BLOCK_NODE_TYPE));
        node.insert("label".into(), json!("Código C"));
        node.insert(
            "inputs".into(),
            json!([{ "id": "exec", "label": "▶", "kind": "exec" }]),
        );
        node.insert(
            "outputs".into(),
            json!([{ "id": "exec", "label": "▶", "kind": "exec" }]),
        );
        node.insert(
            "params".into(),
            json!({
                "code": code,
                "summary": summary,
                "replaced_type": previous.unwrap_or(replaced),
            }),
        );
    }
    let mut removed_edges = BTreeSet::new();
    if let Some(edges) = next.get_mut("edges").and_then(Value::as_array_mut) {
        edges.retain(|edge| {
            let from = edge_field(edge, "fromNode");
            let to = edge_field(edge, "toNode");
            let keep = !absorbed.contains(from)
                && !absorbed.contains(to)
                && !(from == tx.node_id && edge_field(edge, "fromPort") != "exec")
                && !(to == tx.node_id && edge_field(edge, "toPort") != "exec");
            if !keep {
                removed_edges.insert(edge_field(edge, "id").to_string());
            }
            keep
        });
    }
    for list in ["groups", "behaviors"] {
        retain_ids(&mut next, list, "nodeIds", &absorbed);
        retain_ids(&mut next, list, "edgeIds", &removed_edges);
    }

    // Comprovacao: o texto aparece exatamente uma vez, na regiao do no de codigo.
    let projected = analysis.project_with(&next);
    let region = single_region(&projected, &tx.instance_id, &tx.node_id).ok_or_else(|| {
        "O no de codigo nao gerou uma regiao unica; guardado como rascunho.".to_string()
    })?;
    if !same_tokens(&lex(&region_text(&projected, region)), edited) {
        return Err(
            "A reemissao do no de codigo nao reproduziu o texto; guardado como rascunho."
                .to_string(),
        );
    }
    Ok((next, absorbed.into_iter().collect()))
}

// ── IPC ──────────────────────────────────────────────────────────────────────

fn with_authored_scene<T>(
    project_dir: &str,
    scene_json: &str,
    run: impl FnOnce(&str, &Scene, &dyn Fn(&Scene) -> String) -> T,
) -> Result<T, String> {
    let dir = std::path::Path::new(project_dir);
    let project = load_project(dir).map_err(|error| error.to_string())?;
    if project.target != "megadrive" {
        return Err(
            "Editor de codigo (Experimental): so projetos Mega Drive/SGDK sao suportados."
                .to_string(),
        );
    }
    let scene = serde_json::from_str::<Scene>(scene_json)
        .map_err(|error| format!("JSON de cena invalido: {error}"))?;
    let resolved = resolve_prefabs(dir, &scene).map_err(|error| error.to_string())?;
    let emit = |scene: &Scene| {
        let ast = generate_ast(&project, scene);
        let collision = scene.collision_map.as_ref().map(|map| map.normalize());
        emit_sgdk_with_collision(&ast, &project.name, collision.as_deref()).main_c
    };
    Ok(run(&project.target, &resolved, &emit))
}

/// Projeta o documento de codigo da cena dada (rascunho em memoria, nao o disco).
#[tauri::command]
pub async fn code_document_project(
    project_dir: String,
    scene_json: String,
) -> Result<CodeDocument, String> {
    crate::run_heavy_result_command("code_document_project", move || {
        with_authored_scene(&project_dir, &scene_json, |target, scene, emit| {
            project_document(&project_dir, scene, target, &emit(scene))
        })
    })
    .await
}

/// Analisa uma transacao de edicao e devolve o recibo; nao grava nem muta a cena.
#[tauri::command]
pub async fn code_edit_analyze(
    project_dir: String,
    scene_json: String,
    transaction: CodeEditTransaction,
) -> Result<CodeEditReceipt, String> {
    crate::run_heavy_result_command("code_edit_analyze", move || {
        with_authored_scene(&project_dir, &scene_json, |target, scene, emit| {
            analyze_code_edit(&project_dir, target, scene, emit, &transaction)
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ugdm::entities::Project;

    fn project() -> Project {
        serde_json::from_value(json!({
            "rds_version": "1", "name": "code_binding", "target": "megadrive",
            "resolution": { "width": 320, "height": 224 }, "fps": 60, "entry_scene": "main"
        }))
        .expect("project fixture")
    }

    fn move_graph(dx: i32) -> String {
        json!({
            "version": 1,
            "nodes": [
                { "id": "tick", "type": "event_update", "label": "Tick", "x": 0, "y": 0, "inputs": [], "outputs": [], "params": {} },
                { "id": "move", "type": "sprite_move", "label": "Move", "x": 200, "y": 0, "inputs": [], "outputs": [], "params": { "target": "self", "dx": dx, "dy": 0 } },
                { "id": "after", "type": "sprite_move", "label": "After", "x": 400, "y": 0, "inputs": [], "outputs": [], "params": { "target": "self", "dx": 0, "dy": 11 } }
            ],
            "edges": [
                { "id": "e1", "fromNode": "tick", "fromPort": "exec", "toNode": "move", "toPort": "exec" },
                { "id": "e2", "fromNode": "move", "fromPort": "exec", "toNode": "after", "toPort": "exec" }
            ]
        })
        .to_string()
    }

    fn entity(id: &str, graph: &str) -> Value {
        json!({
            "entity_id": id, "transform": { "x": 16, "y": 24 },
            "components": {
                "sprite": { "asset": "assets/sprites/hero.png", "frame_width": 16, "frame_height": 16 },
                "logic": { "graph": graph }
            }
        })
    }

    /// Duas instancias com grafos byte a byte identicos.
    fn twin_scene() -> Scene {
        let graph = move_graph(37);
        serde_json::from_value(json!({
            "scene_id": "main",
            "entities": [entity("hero_a", &graph), entity("hero_b", &graph)]
        }))
        .expect("scene fixture")
    }

    fn emit(scene: &Scene) -> String {
        let project = project();
        emit_sgdk_with_collision(&generate_ast(&project, scene), &project.name, None).main_c
    }

    fn document(scene: &Scene) -> CodeDocument {
        project_document("proj", scene, "megadrive", &emit(scene))
    }

    fn region(document: &CodeDocument, instance: &str, node: &str) -> String {
        region_text(
            document,
            single_region(document, instance, node).expect("regiao unica"),
        )
    }

    fn transaction(
        scene: &Scene,
        instance: &str,
        node: &str,
        new_text: String,
    ) -> CodeEditTransaction {
        CodeEditTransaction {
            schema: CODE_EDIT_SCHEMA.to_string(),
            context: document(scene).context,
            instance_id: instance.to_string(),
            node_id: node.to_string(),
            graph_sha256: graph_revision_hash(&instance_graph(scene, instance).unwrap()),
            new_text,
            scope: CodeEditScope::Instance,
        }
    }

    fn analyze(scene: &Scene, tx: &CodeEditTransaction) -> CodeEditReceipt {
        analyze_code_edit("proj", "megadrive", scene, &emit, tx)
    }

    #[test]
    fn document_has_no_delimiters_and_separates_identical_instances() {
        let scene = twin_scene();
        let doc = document(&scene);
        assert!(!doc.text.contains("RDS-BUILD-PROVENANCE"));
        assert_eq!(doc.kind, "authored_projection");
        let a = single_region(&doc, "hero_a", "move").unwrap();
        let b = single_region(&doc, "hero_b", "move").unwrap();
        assert_ne!(a.start_line, b.start_line);
        assert!(region(&doc, "hero_a", "move").contains("37"));
        assert!(region(&doc, "hero_b", "move").contains("37"));
        // Mesmo hash de grafo nas duas instancias: so a instancia as distingue.
        let hash = |instance: &str| {
            doc.bindings
                .iter()
                .find(|binding| binding.instance_id == instance && binding.node_id == "move")
                .unwrap()
                .graph_sha256
                .clone()
        };
        assert_eq!(hash("hero_a"), hash("hero_b"));
    }

    #[test]
    fn representable_edit_updates_only_the_selected_instance() {
        let scene = twin_scene();
        let before = document(&scene);
        let edited = region(&before, "hero_a", "move").replace("37", "41");
        let receipt = analyze(
            &scene,
            &transaction(&scene, "hero_a", "move", edited.clone()),
        );

        assert_eq!(
            receipt.status,
            CodeEditStatus::NodeParams,
            "{}",
            receipt.message
        );
        assert_eq!(
            receipt.changed_params,
            vec![ChangedParam {
                node_id: "move".into(),
                key: "dx".into(),
                value: json!(41)
            }]
        );
        let next = scene_with_instance_graph(&scene, "hero_a", receipt.graph.as_deref().unwrap());
        let after = document(&next);
        assert!(same_tokens(
            &lex(&region(&after, "hero_a", "move")),
            &lex(&edited)
        ));
        // A outra instancia identica nao foi tocada: grafo e codigo iguais aos de antes.
        assert_eq!(
            instance_graph(&next, "hero_b"),
            instance_graph(&scene, "hero_b")
        );
        assert_eq!(
            region(&after, "hero_b", "move"),
            region(&before, "hero_b", "move")
        );
        // Node -> codigo: so o intervalo afetado mudou.
        assert_eq!(
            region(&after, "hero_a", "after"),
            region(&before, "hero_a", "after")
        );
    }

    #[test]
    fn free_logic_becomes_a_code_node_that_runs_once_and_keeps_connections() {
        let scene = twin_scene();
        let before = document(&scene);
        let original = region(&before, "hero_a", "move");
        let edited = format!(
            "{original}\n    // ação ✓ só desta instância\n    VDP_drawText(\"olá\", 1, 1);"
        );
        let receipt = analyze(
            &scene,
            &transaction(&scene, "hero_a", "move", edited.clone()),
        );

        assert_eq!(
            receipt.status,
            CodeEditStatus::CodeNode,
            "{}",
            receipt.message
        );
        let graph: Value = serde_json::from_str(receipt.graph.as_deref().unwrap()).unwrap();
        let node = graph_nodes(&graph)
            .iter()
            .find(|node| node["id"] == "move")
            .unwrap();
        assert_eq!(node["type"], CODE_BLOCK_NODE_TYPE);
        assert_eq!(node["params"]["replaced_type"], "sprite_move");
        // Conexoes de entrada e de continuacao preservadas.
        assert_eq!(graph_edges(&graph).len(), 2);

        let next = scene_with_instance_graph(&scene, "hero_a", receipt.graph.as_deref().unwrap());
        let main_c = emit(&next);
        assert_eq!(main_c.matches("// ação ✓ só desta instância").count(), 1);
        assert_eq!(main_c.matches("VDP_drawText(\"olá\", 1, 1);").count(), 1);
        let after = document(&next);
        assert!(same_tokens(
            &lex(&region(&after, "hero_a", "move")),
            &lex(&edited)
        ));
        assert_eq!(
            region(&after, "hero_a", "after"),
            region(&before, "hero_a", "after")
        );
        assert_eq!(
            region(&after, "hero_b", "move"),
            region(&before, "hero_b", "move")
        );

        // Editar de novo o no de codigo continua sendo um no de codigo (sem empilhar).
        let again = format!("{edited}\n    VDP_clearText(1, 1, 3);");
        let second = analyze(&next, &transaction(&next, "hero_a", "move", again));
        assert_eq!(
            second.status,
            CodeEditStatus::CodeNode,
            "{}",
            second.message
        );
        let graph: Value = serde_json::from_str(second.graph.as_deref().unwrap()).unwrap();
        let node = graph_nodes(&graph)
            .iter()
            .find(|node| node["id"] == "move")
            .unwrap();
        assert_eq!(node["params"]["replaced_type"], "sprite_move");
    }

    #[test]
    fn incomplete_text_is_kept_as_a_recoverable_draft_without_touching_nodes() {
        let scene = twin_scene();
        let original = region(&document(&scene), "hero_a", "move");
        let edited = format!("{original}\n    if (");
        let receipt = analyze(
            &scene,
            &transaction(&scene, "hero_a", "move", edited.clone()),
        );

        assert_eq!(receipt.status, CodeEditStatus::Draft);
        let graph: Value = serde_json::from_str(receipt.graph.as_deref().unwrap()).unwrap();
        assert_eq!(graph["codeDrafts"][0]["nodeId"], "move");
        assert_eq!(graph["codeDrafts"][0]["text"], edited);
        let original_graph: Value =
            serde_json::from_str(&instance_graph(&scene, "hero_a").unwrap()).unwrap();
        assert_eq!(graph["nodes"], original_graph["nodes"]);
        assert_eq!(graph["edges"], original_graph["edges"]);
        // O rascunho nao muda o codigo emitido e some quando a edicao e concluida.
        let drafted =
            scene_with_instance_graph(&scene, "hero_a", receipt.graph.as_deref().unwrap());
        assert_eq!(document(&drafted).text, document(&scene).text);
        let done = analyze(
            &drafted,
            &transaction(&drafted, "hero_a", "move", original.replace("37", "5")),
        );
        assert_eq!(done.status, CodeEditStatus::NodeParams, "{}", done.message);
        let graph: Value = serde_json::from_str(done.graph.as_deref().unwrap()).unwrap();
        assert!(graph.get("codeDrafts").is_none());
    }

    #[test]
    fn late_or_foreign_transactions_are_discarded() {
        let scene = twin_scene();
        let text = region(&document(&scene), "hero_a", "move").replace("37", "41");
        let mut other_revision = transaction(&scene, "hero_a", "move", text.clone());
        other_revision.context.revision = "0".repeat(64);
        assert_eq!(
            analyze(&scene, &other_revision).status,
            CodeEditStatus::Stale
        );

        let mut other_project = transaction(&scene, "hero_a", "move", text.clone());
        other_project.context.project = "outro".to_string();
        assert_eq!(
            analyze(&scene, &other_project).status,
            CodeEditStatus::Stale
        );

        let mut other_graph = transaction(&scene, "hero_a", "move", text.clone());
        other_graph.graph_sha256 = "f".repeat(64);
        let receipt = analyze(&scene, &other_graph);
        assert_eq!(receipt.status, CodeEditStatus::Stale);
        assert!(receipt.graph.is_none());

        let unchanged = transaction(
            &scene,
            "hero_a",
            "move",
            region(&document(&scene), "hero_a", "move"),
        );
        assert_eq!(analyze(&scene, &unchanged).status, CodeEditStatus::NoChange);
    }

    #[test]
    fn shared_definition_reports_the_other_uses() {
        let mut scene = twin_scene();
        for entity in &mut scene.entities {
            entity.components.logic.as_mut().unwrap().graph_ref = Some("graphs/hero.json".into());
        }
        let text = region(&document(&scene), "hero_a", "move").replace("37", "41");
        let receipt = analyze(&scene, &transaction(&scene, "hero_a", "move", text));
        assert_eq!(receipt.shared_uses, vec!["hero_b".to_string()]);
        assert_eq!(receipt.scope, CodeEditScope::Instance);
    }

    #[test]
    fn text_helpers_cover_completeness_memory_and_indentation() {
        assert!(region_is_complete("x = 1;\nif (x) { y(); }"));
        assert!(!region_is_complete("if (x) {"));
        assert!(!region_is_complete("x = 1; }"));
        assert_eq!(forbidden_dynamic_memory("p = malloc(4);"), Some("malloc"));
        assert_eq!(forbidden_dynamic_memory("MEM_free(p); // free later"), None);
        assert_eq!(
            indent_code_block("    a();\n      b();\n\n    c();\r\n", "  "),
            "  a();\n    b();\n\n  c();\n"
        );
    }
}
