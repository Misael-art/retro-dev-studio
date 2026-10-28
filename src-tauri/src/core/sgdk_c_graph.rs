//! Grafo C sem perdas para projetos SGDK (Experimental).
//!
//! Cada arquivo `.c`/`.h` do doador vira uma arvore de nodes produzida por um parser C
//! real (tree-sitter-c). Toda faixa de bytes do arquivo pertence a exatamente uma folha,
//! entao `regenerate_c_source` devolve o arquivo original byte a byte; editar o texto de
//! uma folha altera o C que o build consome. Nao ha vocabulario fechado: statements sem
//! node especifico continuam como folhas de C bruto editaveis, nunca descartados.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const SGDK_C_GRAPH_SCHEMA: &str = "sgdk-c-graph/v1";
pub const SGDK_C_GRAPH_INDEX_SCHEMA: &str = "sgdk-c-graph-index/v1";
pub const SGDK_C_GRAPH_DIR: &str = "code";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CGraphNode {
    pub id: String,
    /// Tipo do node no parser (`function_definition`, `if_statement`, ...) ou `syntax`.
    pub kind: String,
    /// `item` (unidade de logica), `syntax` (pontuacao/espacos entre itens) ou `comment`.
    pub role: String,
    pub label: String,
    pub start_line: usize,
    pub end_line: usize,
    /// Texto C da folha; `None` em nodes estruturais (o texto vem dos filhos).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<CGraphNode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub function: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub calls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CGraphFile {
    pub schema: String,
    pub source_file: String,
    pub source_sha256: String,
    pub parse_error_nodes: usize,
    pub root: CGraphNode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CStateMachine {
    pub file: String,
    pub function: Option<String>,
    pub subject: String,
    pub states: Vec<String>,
    pub line: usize,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CGraphFunction {
    pub file: String,
    pub name: String,
    pub line: usize,
    pub node_id: String,
    pub calls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CGraphIndexEntry {
    pub source_file: String,
    pub graph_file: String,
    pub source_sha256: String,
    pub roundtrip_exact: bool,
    pub parse_error_nodes: usize,
    /// Fonte no doador mudou desde a geracao do grafo; o grafo nao foi sobrescrito.
    #[serde(default)]
    pub stale: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CGraphIndex {
    pub schema: String,
    pub files: Vec<CGraphIndexEntry>,
    pub functions: Vec<CGraphFunction>,
    pub state_machines: Vec<CStateMachine>,
    pub entry_points: Vec<String>,
}

fn c_language() -> tree_sitter::Language {
    tree_sitter_c::LANGUAGE.into()
}

/// Nodes cujos filhos-item viram nodes proprios (o resto vira `syntax`).
fn is_container(kind: &str) -> bool {
    matches!(
        kind,
        "translation_unit"
            | "compound_statement"
            | "case_statement"
            | "function_definition"
            | "if_statement"
            | "else_clause"
            | "switch_statement"
            | "while_statement"
            | "for_statement"
            | "do_statement"
            | "labeled_statement"
            | "preproc_if"
            | "preproc_ifdef"
            | "preproc_else"
            | "preproc_elif"
            | "preproc_elifdef"
    )
}

fn is_item(kind: &str) -> bool {
    is_container(kind)
        || kind.ends_with("_statement")
        || kind.ends_with("_definition")
        || kind.ends_with("_declaration")
        || kind.starts_with("preproc_")
        || matches!(
            kind,
            "declaration"
                | "type_definition"
                | "comment"
                | "struct_specifier"
                | "enum_specifier"
                | "union_specifier"
                | "ERROR"
        )
}

/// O cabecalho de uma estrutura de controle (condicao, `case X:`) fica como `syntax`
/// dentro do container; so o corpo vira itens.
fn child_is_item(parent_kind: &str, child: &tree_sitter::Node) -> bool {
    let kind = child.kind();
    match parent_kind {
        "function_definition" => kind == "compound_statement",
        "if_statement" | "while_statement" | "for_statement" | "do_statement"
        | "switch_statement" | "labeled_statement" => {
            matches!(kind, "compound_statement" | "else_clause") || kind.ends_with("_statement")
        }
        "else_clause" => kind == "compound_statement" || kind.ends_with("_statement"),
        "case_statement" => {
            child.is_named()
                && is_item(kind)
                && Some(child.id())
                    != child
                        .parent()
                        .and_then(|p| p.child_by_field_name("value"))
                        .map(|v| v.id())
        }
        "preproc_if" | "preproc_ifdef" | "preproc_elif" | "preproc_elifdef" => {
            is_item(kind)
                && Some(child.id())
                    != child
                        .parent()
                        .and_then(|p| p.child_by_field_name("condition"))
                        .map(|v| v.id())
        }
        _ => is_item(kind),
    }
}

struct Builder<'a> {
    source: &'a str,
    errors: usize,
    line_starts: Vec<usize>,
}

impl Builder<'_> {
    fn line_of(&self, byte: usize) -> usize {
        self.line_starts.partition_point(|start| *start <= byte)
    }

    fn leaf(&self, id: String, kind: &str, role: &str, start: usize, end: usize) -> CGraphNode {
        let text = &self.source[start..end];
        CGraphNode {
            id,
            kind: kind.to_string(),
            role: role.to_string(),
            label: compact_label(text),
            start_line: self.line_of(start),
            end_line: self.line_of(end.saturating_sub(1).max(start)),
            text: Some(text.to_string()),
            children: Vec::new(),
            function: None,
            calls: Vec::new(),
        }
    }

    fn build(
        &mut self,
        node: tree_sitter::Node,
        id: String,
        start: usize,
        end: usize,
    ) -> CGraphNode {
        let kind = node.kind();
        let function = (kind == "function_definition")
            .then(|| function_name(&node, self.source))
            .flatten();
        let expand = is_container(kind);
        let calls = if !expand || kind == "function_definition" {
            collect_calls(&node, self.source)
        } else {
            Vec::new()
        };
        if !expand {
            let mut leaf = self.leaf(
                id,
                kind,
                if kind == "comment" { "comment" } else { "item" },
                start,
                end,
            );
            leaf.function = function;
            leaf.calls = calls;
            return leaf;
        }

        let mut children = Vec::new();
        let mut cursor = start;
        let mut walker = node.walk();
        for child in node.children(&mut walker) {
            if !child_is_item(kind, &child) || child.start_byte() < cursor {
                continue;
            }
            if cursor < child.start_byte() {
                children.push(self.leaf(
                    format!("{id}.s{}", children.len()),
                    "syntax",
                    "syntax",
                    cursor,
                    child.start_byte(),
                ));
            }
            let child_id = format!("{id}.{}", children.len());
            children.push(self.build(child, child_id, child.start_byte(), child.end_byte()));
            cursor = child.end_byte();
        }
        if cursor < end {
            children.push(self.leaf(
                format!("{id}.s{}", children.len()),
                "syntax",
                "syntax",
                cursor,
                end,
            ));
        }
        let header_end = node
            .children(&mut node.walk())
            .find(|child| child_is_item(kind, child))
            .map(|child| child.start_byte())
            .unwrap_or(end);
        CGraphNode {
            id,
            kind: kind.to_string(),
            role: "item".to_string(),
            label: compact_label(&self.source[start..header_end.max(start)]),
            start_line: self.line_of(start),
            end_line: self.line_of(end.saturating_sub(1).max(start)),
            text: None,
            children,
            function,
            calls,
        }
    }
}

fn count_errors(node: &tree_sitter::Node) -> usize {
    let mut count = usize::from(node.is_error() || node.is_missing());
    let mut walker = node.walk();
    for child in node.children(&mut walker) {
        if child.has_error() || child.is_missing() {
            count += count_errors(&child);
        }
    }
    count
}

fn function_name(node: &tree_sitter::Node, source: &str) -> Option<String> {
    let mut declarator = node.child_by_field_name("declarator")?;
    loop {
        if declarator.kind() == "identifier" {
            return Some(source[declarator.byte_range()].to_string());
        }
        declarator = declarator.child_by_field_name("declarator")?;
    }
}

fn collect_calls(node: &tree_sitter::Node, source: &str) -> Vec<String> {
    let mut calls = BTreeSet::new();
    let mut stack = vec![*node];
    while let Some(current) = stack.pop() {
        if current.kind() == "call_expression" {
            if let Some(callee) = current.child_by_field_name("function") {
                if callee.kind() == "identifier" {
                    calls.insert(source[callee.byte_range()].to_string());
                }
            }
        }
        let mut walker = current.walk();
        stack.extend(current.children(&mut walker));
    }
    calls.into_iter().collect()
}

fn compact_label(text: &str) -> String {
    let line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    let mut label: String = line.chars().take(96).collect();
    if line.chars().count() > 96 {
        label.push('…');
    }
    label
}

pub fn parse_c_source(source_file: &str, source: &str) -> Result<CGraphFile, String> {
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&c_language())
        .map_err(|e| format!("tree-sitter-c indisponivel: {e}"))?;
    let tree = parser
        .parse(source, None)
        .ok_or_else(|| format!("Parser C nao produziu arvore para '{source_file}'."))?;
    let line_starts = std::iter::once(0)
        .chain(source.match_indices('\n').map(|(i, _)| i + 1))
        .collect();
    let mut builder = Builder {
        source,
        errors: count_errors(&tree.root_node()),
        line_starts,
    };
    let root = builder.build(tree.root_node(), "n".to_string(), 0, source.len());
    Ok(CGraphFile {
        schema: SGDK_C_GRAPH_SCHEMA.to_string(),
        source_file: source_file.to_string(),
        source_sha256: crate::core::rom_mastering::sha256_hex(source.as_bytes()),
        parse_error_nodes: builder.errors,
        root,
    })
}

fn append_text(node: &CGraphNode, out: &mut String) {
    if let Some(text) = &node.text {
        out.push_str(text);
    }
    for child in &node.children {
        append_text(child, out);
    }
}

pub fn regenerate_c_source(graph: &CGraphFile) -> String {
    let mut out = String::new();
    append_text(&graph.root, &mut out);
    out
}

fn visit<'a>(
    node: &'a CGraphNode,
    function: Option<&'a str>,
    f: &mut impl FnMut(&'a CGraphNode, Option<&'a str>),
) {
    f(node, function);
    let scope = node.function.as_deref().or(function);
    for child in &node.children {
        visit(child, scope, f);
    }
}

fn switch_states(node: &CGraphNode) -> Vec<String> {
    let mut states = Vec::new();
    let mut stack: Vec<&CGraphNode> = node.children.iter().collect();
    while let Some(current) = stack.pop() {
        if current.kind == "case_statement" {
            states.push(current.label.trim_end_matches(':').trim().to_string());
        } else if current.kind != "switch_statement" {
            stack.extend(current.children.iter());
        }
    }
    states.reverse();
    states
}

fn switch_subject(label: &str) -> String {
    let after = label.trim_start_matches("switch").trim();
    let inner = after.strip_prefix('(').unwrap_or(after);
    let mut depth = 1usize;
    let mut subject = String::new();
    for ch in inner.chars() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    break;
                }
            }
            _ => {}
        }
        subject.push(ch);
    }
    subject.trim().to_string()
}

fn summarize(
    graph: &CGraphFile,
    functions: &mut Vec<CGraphFunction>,
    machines: &mut Vec<CStateMachine>,
) {
    visit(&graph.root, None, &mut |node, function| {
        if node.kind == "function_definition" {
            if let Some(name) = &node.function {
                functions.push(CGraphFunction {
                    file: graph.source_file.clone(),
                    name: name.clone(),
                    line: node.start_line,
                    node_id: node.id.clone(),
                    calls: node.calls.clone(),
                });
            }
        }
        if node.kind == "switch_statement" {
            let states = switch_states(node);
            if states.len() >= 2 {
                machines.push(CStateMachine {
                    file: graph.source_file.clone(),
                    function: function.map(str::to_string),
                    subject: switch_subject(&node.label),
                    states,
                    line: node.start_line,
                    node_id: node.id.clone(),
                });
            }
        }
    });
}

/// Fontes que o makefile do SGDK compila: `src/` e `inc/` (raiz so quando nao ha `src/`).
pub fn collect_c_sources(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut stack: Vec<PathBuf> = ["src", "inc"]
        .iter()
        .map(|dir| root.join(dir))
        .filter(|dir| dir.is_dir())
        .collect();
    let flat_root = !root.join("src").is_dir();
    if flat_root {
        stack.push(root.to_path_buf());
    }
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if !(flat_root && dir == root) && !name.starts_with('.') {
                    stack.push(path);
                }
            } else if matches!(
                path.extension()
                    .and_then(|e| e.to_str())
                    .map(str::to_ascii_lowercase)
                    .as_deref(),
                Some("c" | "h")
            ) {
                files.push(path);
            }
        }
    }
    files.sort();
    files.dedup();
    files
}

fn rel_string(root: &Path, file: &Path) -> String {
    file.strip_prefix(root)
        .unwrap_or(file)
        .to_string_lossy()
        .replace('\\', "/")
}

pub fn graph_path_for(overlay_dir: &Path, source_rel: &str) -> PathBuf {
    overlay_dir
        .join(SGDK_C_GRAPH_DIR)
        .join(format!("{source_rel}.cgraph.json"))
}

pub fn load_c_graph(path: &Path) -> Result<CGraphFile, String> {
    let raw =
        fs::read_to_string(path).map_err(|e| format!("Falha ao ler '{}': {e}", path.display()))?;
    let graph: CGraphFile = serde_json::from_str(&raw)
        .map_err(|e| format!("Grafo C invalido '{}': {e}", path.display()))?;
    if graph.schema != SGDK_C_GRAPH_SCHEMA {
        return Err(format!(
            "Schema de grafo C nao suportado: '{}'.",
            graph.schema
        ));
    }
    Ok(graph)
}

/// Gera/atualiza `<overlay>/code/` a partir das fontes C do doador. Grafos existentes cuja
/// fonte mudou nao sao sobrescritos (podem conter edicoes do usuario): ficam `stale`.
pub fn write_c_graph_project(host_root: &Path, overlay_dir: &Path) -> Result<CGraphIndex, String> {
    let mut entries = Vec::new();
    let mut functions = Vec::new();
    let mut machines = Vec::new();
    for file in collect_c_sources(host_root) {
        let rel = rel_string(host_root, &file);
        let bytes =
            fs::read(&file).map_err(|e| format!("Falha ao ler '{}': {e}", file.display()))?;
        let Ok(source) = String::from_utf8(bytes.clone()) else {
            // Fonte nao-UTF-8 nao pode ser representada sem perdas como texto; fica fora do grafo.
            continue;
        };
        let fresh = parse_c_source(&rel, &source)?;
        let roundtrip_exact = regenerate_c_source(&fresh).as_bytes() == bytes.as_slice();
        let graph_path = graph_path_for(overlay_dir, &rel);
        let (graph, stale) = match load_c_graph(&graph_path) {
            Ok(existing) if existing.source_sha256 == fresh.source_sha256 => (existing, false),
            Ok(existing) => (existing, true),
            Err(_) => {
                if let Some(parent) = graph_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let json = serde_json::to_string_pretty(&fresh).map_err(|e| e.to_string())?;
                fs::write(&graph_path, json)
                    .map_err(|e| format!("Falha ao gravar '{}': {e}", graph_path.display()))?;
                (fresh, false)
            }
        };
        summarize(&graph, &mut functions, &mut machines);
        entries.push(CGraphIndexEntry {
            source_file: rel.clone(),
            graph_file: rel_string(overlay_dir, &graph_path),
            source_sha256: crate::core::rom_mastering::sha256_hex(&bytes),
            roundtrip_exact,
            parse_error_nodes: graph.parse_error_nodes,
            stale,
        });
    }
    let entry_points = functions
        .iter()
        .filter(|f| f.name == "main" && f.file.ends_with(".c"))
        .map(|f| format!("{}:{}", f.file, f.name))
        .collect();
    let index = CGraphIndex {
        schema: SGDK_C_GRAPH_INDEX_SCHEMA.to_string(),
        files: entries,
        functions,
        state_machines: machines,
        entry_points,
    };
    let index_path = overlay_dir.join(SGDK_C_GRAPH_DIR).join("index.json");
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(
        &index_path,
        serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Falha ao gravar '{}': {e}", index_path.display()))?;
    Ok(index)
}

/// Fontes cujo C regenerado do grafo difere do arquivo do doador (edicoes feitas nos nodes).
/// Grafo `stale` recusa o build: a fonte mudou fora do Studio e aplicar o grafo apagaria isso.
pub fn edited_c_sources(
    host_root: &Path,
    overlay_dir: &Path,
) -> Result<Vec<(String, String)>, String> {
    let code_dir = overlay_dir.join(SGDK_C_GRAPH_DIR);
    if !code_dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut edited = Vec::new();
    for file in collect_c_sources(host_root) {
        let rel = rel_string(host_root, &file);
        let graph_path = graph_path_for(overlay_dir, &rel);
        if !graph_path.is_file() {
            continue;
        }
        let graph = load_c_graph(&graph_path)?;
        let current =
            fs::read(&file).map_err(|e| format!("Falha ao ler '{}': {e}", file.display()))?;
        let regenerated = regenerate_c_source(&graph);
        if regenerated.as_bytes() == current.as_slice() {
            continue;
        }
        if crate::core::rom_mastering::sha256_hex(&current) != graph.source_sha256 {
            return Err(format!(
                "Fonte '{rel}' mudou fora do Studio depois do grafo C; build recusado para nao sobrescrever nenhuma das versoes. Reimporte ou reconcilie o grafo."
            ));
        }
        edited.push((rel, regenerated));
    }
    Ok(edited)
}

pub fn load_c_graph_index(overlay_dir: &Path) -> Result<CGraphIndex, String> {
    let path = overlay_dir.join(SGDK_C_GRAPH_DIR).join("index.json");
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Indice de grafos C indisponivel '{}': {e}", path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("Indice de grafos C invalido: {e}"))
}

/// So arquivos listados no indice podem ser lidos/escritos (sem caminhos arbitrarios).
fn indexed_graph_path(overlay_dir: &Path, source_file: &str) -> Result<PathBuf, String> {
    let index = load_c_graph_index(overlay_dir)?;
    index
        .files
        .iter()
        .find(|entry| entry.source_file == source_file)
        .map(|entry| overlay_dir.join(&entry.graph_file))
        .ok_or_else(|| format!("Fonte '{source_file}' nao pertence ao grafo C do projeto."))
}

pub fn load_indexed_c_graph(overlay_dir: &Path, source_file: &str) -> Result<CGraphFile, String> {
    load_c_graph(&indexed_graph_path(overlay_dir, source_file)?)
}

fn set_node_text(node: &mut CGraphNode, node_id: &str, text: &str) -> bool {
    if node.id == node_id {
        node.text = Some(text.to_string());
        node.children.clear();
        return true;
    }
    node.children
        .iter_mut()
        .any(|child| set_node_text(child, node_id, text))
}

/// Substitui o C de um node (folha ou estrutura inteira) e reconstroi o grafo do arquivo a
/// partir do C resultante, preservando o SHA da fonte-base do doador (deteccao de drift).
pub fn update_c_graph_node(
    overlay_dir: &Path,
    source_file: &str,
    node_id: &str,
    text: &str,
) -> Result<CGraphFile, String> {
    let path = indexed_graph_path(overlay_dir, source_file)?;
    let mut graph = load_c_graph(&path)?;
    if !set_node_text(&mut graph.root, node_id, text) {
        return Err(format!("Node '{node_id}' nao existe em '{source_file}'."));
    }
    let mut rebuilt = parse_c_source(source_file, &regenerate_c_source(&graph))?;
    rebuilt.source_sha256 = graph.source_sha256;
    fs::write(
        &path,
        serde_json::to_string_pretty(&rebuilt).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Falha ao gravar '{}': {e}", path.display()))?;
    Ok(rebuilt)
}

/// Copia a raiz C para `staging` (sem `out/`, `rds/`, `.git`) e grava as fontes editadas.
pub fn stage_c_project(
    host_root: &Path,
    staging: &Path,
    edited: &[(String, String)],
) -> Result<(), String> {
    fn copy_dir(from: &Path, to: &Path, top: bool) -> Result<(), String> {
        fs::create_dir_all(to).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(from).map_err(|e| e.to_string())?.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if top
                && ["out", "rds", ".git"]
                    .iter()
                    .any(|skip| name.eq_ignore_ascii_case(skip))
            {
                continue;
            }
            let path = entry.path();
            let target = to.join(&name);
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            if file_type.is_symlink() {
                // Symlinks (inclusive quebrados) sao preservados como estao no doador.
                let link = fs::read_link(&path).map_err(|e| e.to_string())?;
                #[cfg(unix)]
                std::os::unix::fs::symlink(&link, &target)
                    .map_err(|e| format!("Falha ao recriar link '{}': {e}", path.display()))?;
                #[cfg(not(unix))]
                if path.is_file() {
                    fs::copy(&path, &target).map_err(|e| e.to_string())?;
                }
                #[cfg(not(unix))]
                let _ = link;
            } else if file_type.is_dir() {
                copy_dir(&path, &target, false)?;
            } else {
                fs::copy(&path, &target)
                    .map_err(|e| format!("Falha ao copiar '{}': {e}", path.display()))?;
            }
        }
        Ok(())
    }
    copy_dir(host_root, staging, true)?;
    // Wrappers de build alternativo (SGDKForge) reutilizam o cabecalho do ultimo build normal.
    let rom_head = host_root.join("out").join("rom_head.bin");
    if rom_head.is_file() {
        fs::create_dir_all(staging.join("out")).map_err(|e| e.to_string())?;
        fs::copy(&rom_head, staging.join("out").join("rom_head.bin")).map_err(|e| e.to_string())?;
    }
    for (rel, text) in edited {
        fs::write(staging.join(rel), text)
            .map_err(|e| format!("Falha ao gravar fonte editada '{rel}': {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"#include <genesis.h>
#include "player.h"

#define SPEED 2
// estados do jogador
typedef enum { ST_IDLE, ST_WALK, ST_JUMP } State;
static State state = ST_IDLE;

#if DEBUG
static void dbg(void) { KLog("x"); }
#endif

static void update(u16 joy)
{
    switch (state)
    {
        case ST_IDLE:
            if (joy & BUTTON_RIGHT) state = ST_WALK;
            break;
        case ST_WALK: {
            SPR_setAnim(player, 1);
            break;
        }
        default:
            break;
    }
    for (int i = 0; i < 3; i++) x += SPEED;
}

int main(bool hard)
{
    SPR_init();
    while (TRUE) { update(JOY_readJoypad(JOY_1)); SPR_update(); SYS_doVBlankProcess(); }
    return 0;
}
"#;

    #[test]
    fn c_graph_roundtrip_is_byte_exact() {
        let graph = parse_c_source("src/main.c", SAMPLE).expect("parse");
        assert_eq!(regenerate_c_source(&graph), SAMPLE);
        assert_eq!(graph.parse_error_nodes, 0);
    }

    #[test]
    fn c_graph_roundtrip_survives_broken_and_macro_heavy_source() {
        let weird = "#define F(x) x##_t\nF(u8) a = {;\nvoid g( { MACRO_BLOCK { } }\r\n\t\n";
        let graph = parse_c_source("src/weird.c", weird).expect("parse");
        assert_eq!(regenerate_c_source(&graph), weird);
        assert!(
            graph.parse_error_nodes > 0,
            "erros de parse devem ser contados, nao escondidos"
        );
    }

    #[test]
    fn c_graph_extracts_functions_calls_and_switch_state_machines() {
        let graph = parse_c_source("src/main.c", SAMPLE).expect("parse");
        let (mut functions, mut machines) = (Vec::new(), Vec::new());
        summarize(&graph, &mut functions, &mut machines);
        let names: Vec<_> = functions.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["dbg", "update", "main"]);
        let main = functions.iter().find(|f| f.name == "main").unwrap();
        assert!(main.calls.contains(&"SPR_update".to_string()));
        assert!(main.calls.contains(&"update".to_string()));
        assert_eq!(machines.len(), 1);
        assert_eq!(machines[0].subject, "state");
        assert_eq!(machines[0].function.as_deref(), Some("update"));
        assert_eq!(
            machines[0].states,
            ["case ST_IDLE", "case ST_WALK", "default"]
        );
    }

    fn find_mut<'a>(
        node: &'a mut CGraphNode,
        pred: &dyn Fn(&CGraphNode) -> bool,
    ) -> Option<&'a mut CGraphNode> {
        if pred(node) {
            return Some(node);
        }
        node.children
            .iter_mut()
            .find_map(|child| find_mut(child, pred))
    }

    #[test]
    fn c_graph_leaf_edit_changes_regenerated_source_and_staging() {
        let dir = std::env::temp_dir().join(format!("rds_cgraph_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let host = dir.join("game");
        fs::create_dir_all(host.join("src")).unwrap();
        fs::create_dir_all(host.join("out")).unwrap();
        fs::write(host.join("src/main.c"), SAMPLE).unwrap();
        fs::write(host.join("out/rom.bin"), b"old").unwrap();
        let overlay = host.join("rds");

        let index = write_c_graph_project(&host, &overlay).expect("index");
        assert_eq!(index.files.len(), 1);
        assert!(index.files[0].roundtrip_exact);
        assert_eq!(index.entry_points, ["src/main.c:main"]);
        assert!(edited_c_sources(&host, &overlay).unwrap().is_empty());

        let graph_path = graph_path_for(&overlay, "src/main.c");
        let mut graph = load_c_graph(&graph_path).unwrap();
        let leaf = find_mut(&mut graph.root, &|n| {
            n.text.as_deref().is_some_and(|t| t.contains("x += SPEED"))
                && n.children.is_empty()
                && n.kind != "syntax"
        })
        .unwrap();
        let text = leaf
            .text
            .take()
            .unwrap()
            .replace("x += SPEED", "x += SPEED * 2");
        leaf.text = Some(text);
        fs::write(&graph_path, serde_json::to_string(&graph).unwrap()).unwrap();

        let edited = edited_c_sources(&host, &overlay).unwrap();
        assert_eq!(edited.len(), 1);
        assert!(edited[0].1.contains("x += SPEED * 2"));
        assert_eq!(
            fs::read_to_string(host.join("src/main.c")).unwrap(),
            SAMPLE,
            "doador intocado"
        );

        let staging = dir.join("stage");
        stage_c_project(&host, &staging, &edited).unwrap();
        assert!(fs::read_to_string(staging.join("src/main.c"))
            .unwrap()
            .contains("SPEED * 2"));
        assert!(!staging.join("out").exists() && !staging.join("rds").exists());

        // Edicao via API: reconstroi a estrutura e mantem o SHA-base.
        let updated = update_c_graph_node(
            &overlay,
            "src/main.c",
            "n",
            &format!("{SAMPLE}int extra(void) {{ return 1; }}\n"),
        )
        .unwrap();
        assert!(updated
            .root
            .children
            .iter()
            .any(|n| n.function.as_deref() == Some("extra")));
        assert_eq!(updated.source_sha256, graph.source_sha256);
        assert!(update_c_graph_node(&overlay, "../etc/passwd", "n", "x").is_err());
        update_c_graph_node(&overlay, "src/main.c", "n", &regenerate_c_source(&graph)).unwrap();

        // Re-geracao nao apaga a edicao.
        write_c_graph_project(&host, &overlay).unwrap();
        assert!(regenerate_c_source(&load_c_graph(&graph_path).unwrap()).contains("SPEED * 2"));

        // Fonte alterada fora do Studio + grafo editado => recusa.
        fs::write(host.join("src/main.c"), format!("{SAMPLE}\n// externo\n")).unwrap();
        assert!(edited_c_sources(&host, &overlay).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    /// Prova sobre corpus real: `RDS_SGDK_C_GRAPH_ROOTS` com raizes separadas por `:`.
    #[test]
    #[ignore]
    fn c_graph_real_corpus_roundtrip_report() {
        let roots = std::env::var("RDS_SGDK_C_GRAPH_ROOTS").expect("RDS_SGDK_C_GRAPH_ROOTS");
        for root in roots.split(':').filter(|r| !r.is_empty()) {
            let root = Path::new(root);
            let (mut files, mut exact, mut errors, mut functions, mut machines) =
                (0, 0, 0, Vec::new(), Vec::new());
            let mut leaves = 0usize;
            for file in collect_c_sources(root) {
                let Ok(source) = fs::read_to_string(&file) else {
                    continue;
                };
                let graph = parse_c_source(&rel_string(root, &file), &source).unwrap();
                files += 1;
                exact += usize::from(regenerate_c_source(&graph) == source);
                errors += graph.parse_error_nodes;
                visit(&graph.root, None, &mut |n, _| {
                    leaves += usize::from(n.text.is_some())
                });
                summarize(&graph, &mut functions, &mut machines);
                if graph.parse_error_nodes > 0 {
                    println!(
                        "CGRAPH_ERR {} {}",
                        graph.parse_error_nodes, graph.source_file
                    );
                }
            }
            println!(
                "CGRAPH root={} files={files} roundtrip_exact={exact} parse_error_nodes={errors} leaves={leaves} functions={} state_machines={}",
                root.display(),
                functions.len(),
                machines.len()
            );
            assert_eq!(
                files, exact,
                "round-trip deve ser exato em todos os arquivos"
            );
        }
    }
}
