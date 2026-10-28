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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block: Option<CBlock>,
}

/// Leitura em bloco de um statement simples (chamada ou atribuicao). Editar os campos
/// reescreve so esse statement via `block_statement_text`; o resto do C nao muda.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CBlock {
    /// Tipo no vocabulario do NodeGraph (`sprite_move`, `sprite_anim`, ...) ou `c_call` /
    /// `set_variable` quando nao ha node especifico.
    pub node_type: String,
    /// `call` ou `assign`.
    pub form: String,
    /// Funcao chamada (form `call`) ou alvo da atribuicao (form `assign`).
    pub target: String,
    /// Operador da atribuicao (`=`, `+=`, ...); vazio em chamadas.
    #[serde(default)]
    pub operator: String,
    /// Argumentos da chamada, ou `[valor]` na atribuicao.
    pub args: Vec<String>,
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
pub struct CStateTransition {
    pub from: String,
    pub to: String,
    pub line: usize,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CStateMachine {
    pub file: String,
    pub function: Option<String>,
    pub subject: String,
    pub states: Vec<String>,
    /// Atribuicoes `subject = X` dentro de cada `case` (de -> para).
    #[serde(default)]
    pub transitions: Vec<CStateTransition>,
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
            block: None,
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
            leaf.block = statement_block(&node, self.source);
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
            block: None,
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

/// Vocabulario NodeGraph para chamadas SGDK (mesmas familias do inventario semantico).
pub fn sgdk_call_node_type(name: &str) -> &'static str {
    let has = |needle: &str| name.contains(needle);
    if name.starts_with("JOY_") {
        "input_held"
    } else if name.starts_with("SPR_") {
        if has("Anim") || has("Frame") {
            "sprite_anim"
        } else if has("Position") {
            "sprite_move"
        } else if has("add") || has("Add") {
            "spawn_entity"
        } else if has("release") || has("Release") {
            "destroy_entity"
        } else {
            "sprite_op"
        }
    } else if name.starts_with("PAL_") || has("Palette") {
        "palette_op"
    } else if name.starts_with("DMA_") {
        "dma_budget"
    } else if (name.starts_with("VDP_") || name.starts_with("MAP_")) && has("Scroll") {
        "scroll_tilemap"
    } else if name.starts_with("VDP_") || name.starts_with("MAP_") {
        "vdp_op"
    } else if name.starts_with("XGM") || name.starts_with("SND_") || name.starts_with("PSG_") {
        "action_sound"
    } else if name.starts_with("SYS_") {
        "system_op"
    } else {
        "c_call"
    }
}

fn statement_block(node: &tree_sitter::Node, source: &str) -> Option<CBlock> {
    if node.kind() != "expression_statement" || node.has_error() {
        return None;
    }
    let expr = node.named_child(0)?;
    if node.named_child_count() != 1 {
        return None;
    }
    let text = |n: tree_sitter::Node| source[n.byte_range()].to_string();
    match expr.kind() {
        "call_expression" => {
            let callee = expr.child_by_field_name("function")?;
            if callee.kind() != "identifier" {
                return None;
            }
            let arguments = expr.child_by_field_name("arguments")?;
            let mut walker = arguments.walk();
            let children: Vec<_> = arguments.named_children(&mut walker).collect();
            // Comentarios dentro dos argumentos se perderiam ao reescrever: sem bloco.
            if children.iter().any(|arg| arg.kind() == "comment") {
                return None;
            }
            let name = text(callee);
            Some(CBlock {
                node_type: sgdk_call_node_type(&name).to_string(),
                form: "call".to_string(),
                target: name,
                operator: String::new(),
                args: children.into_iter().map(text).collect(),
            })
        }
        "assignment_expression" => {
            let left = expr.child_by_field_name("left")?;
            let right = expr.child_by_field_name("right")?;
            let operator = expr.child_by_field_name("operator").map(text)?;
            Some(CBlock {
                node_type: "set_variable".to_string(),
                form: "assign".to_string(),
                target: text(left),
                operator,
                args: vec![text(right)],
            })
        }
        _ => None,
    }
}

/// C de um statement a partir dos campos do bloco.
pub fn block_statement_text(block: &CBlock) -> String {
    match block.form.as_str() {
        "assign" => format!(
            "{} {} {};",
            block.target,
            block.operator,
            block.args.first().map(String::as_str).unwrap_or("0")
        ),
        _ => format!("{}({});", block.target, block.args.join(", ")),
    }
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

fn case_name(label: &str) -> String {
    let label = label.trim();
    let label = label.strip_prefix("case").map(str::trim).unwrap_or(label);
    label.split(':').next().unwrap_or(label).trim().to_string()
}

fn normalized(text: &str) -> String {
    text.chars().filter(|c| !c.is_whitespace()).collect()
}

/// Valor atribuido a `subject` num statement (`subject = X`), se houver.
fn switch_states(node: &CGraphNode) -> Vec<String> {
    let mut states = Vec::new();
    let mut stack: Vec<&CGraphNode> = node.children.iter().rev().collect();
    while let Some(current) = stack.pop() {
        if current.kind == "case_statement" {
            states.push(case_name(&current.label));
        } else if current.kind != "switch_statement" {
            stack.extend(current.children.iter().rev());
        }
    }
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

fn is_state_like_name(target: &str) -> bool {
    let last = target
        .rsplit(['.', '>', '[', ']', '*', '&', '(', ')'])
        .find(|part| !part.is_empty())
        .unwrap_or(target)
        .to_ascii_lowercase();
    ["state", "mode", "phase", "step", "scene"]
        .iter()
        .any(|word| last.contains(word))
}

fn is_state_change_call(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    ["set", "change", "goto", "enter", "switch"]
        .iter()
        .any(|verb| lower.contains(verb))
        && ["state", "scene", "mode", "phase"]
            .iter()
            .any(|noun| lower.contains(noun))
}

/// Pares `subject == VALOR` de uma condicao (`if (a == B && c)`).
fn equality_guards(label: &str) -> Vec<(String, String)> {
    let condition = switch_subject(
        label
            .trim_start_matches("else")
            .trim()
            .trim_start_matches("if"),
    );
    condition
        .split("&&")
        .filter_map(|term| {
            let (left, right) = term.split_once("==")?;
            let clean = |side: &str| {
                side.trim()
                    .trim_matches(|c| c == '(' || c == ')')
                    .trim()
                    .to_string()
            };
            let (left, right) = (clean(left), clean(right));
            (!left.is_empty() && !right.is_empty() && !right.contains('='))
                .then(|| (normalized(&left), right))
        })
        .collect()
}

struct TransitionWalk<'a> {
    switch_subjects: &'a BTreeSet<String>,
    found: Vec<(String, CStateTransition)>,
}

impl TransitionWalk<'_> {
    fn walk(
        &mut self,
        node: &CGraphNode,
        current_switch: Option<&str>,
        guards: &mut Vec<(String, String)>,
    ) {
        if let Some(block) = &node.block {
            let target = normalized(&block.target);
            let assign = block.form == "assign"
                && block.operator == "="
                && (self.switch_subjects.contains(&target) || is_state_like_name(&target));
            let call = block.form == "call" && is_state_change_call(&block.target);
            let to = if assign {
                block.args.first()
            } else if call {
                block.args.last()
            } else {
                None
            };
            if let Some(to) = to.filter(|value| !value.contains('(')) {
                let subject = if assign { target } else { block.target.clone() };
                let from = guards
                    .iter()
                    .rev()
                    .find(|(guarded, _)| *guarded == subject)
                    .map(|(_, state)| state.clone())
                    .unwrap_or_else(|| "*".to_string());
                self.found.push((
                    subject,
                    CStateTransition {
                        from,
                        to: to.trim().to_string(),
                        line: node.start_line,
                        node_id: node.id.clone(),
                    },
                ));
            }
        }
        let pushed = match node.kind.as_str() {
            "case_statement" => current_switch
                .map(|subject| {
                    guards.push((subject.to_string(), case_name(&node.label)));
                    1
                })
                .unwrap_or(0),
            _ => 0,
        };
        let inner_subject = if node.kind == "switch_statement" {
            Some(normalized(&switch_subject(&node.label)))
        } else {
            None
        };
        for child in &node.children {
            // A guarda de um `if` vale para o ramo verdadeiro, nao para o `else`.
            let if_guards = if node.kind == "if_statement" && child.kind != "else_clause" {
                equality_guards(&node.label)
            } else {
                Vec::new()
            };
            let count = if_guards.len();
            guards.extend(if_guards);
            let subject = inner_subject.as_deref().or(current_switch);
            self.walk(child, subject, guards);
            guards.truncate(guards.len() - count);
        }
        guards.truncate(guards.len() - pushed);
    }
}

fn summarize(
    graph: &CGraphFile,
    functions: &mut Vec<CGraphFunction>,
    machines: &mut Vec<CStateMachine>,
) {
    let mut file_machines = Vec::new();
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
            let subject = switch_subject(&node.label);
            let states = switch_states(node);
            if states.len() >= 2 {
                file_machines.push(CStateMachine {
                    file: graph.source_file.clone(),
                    function: function.map(str::to_string),
                    subject,
                    states,
                    transitions: Vec::new(),
                    line: node.start_line,
                    node_id: node.id.clone(),
                });
            }
        }
    });

    let switch_subjects: BTreeSet<String> = file_machines
        .iter()
        .map(|m| normalized(&m.subject))
        .collect();
    let mut walk = TransitionWalk {
        switch_subjects: &switch_subjects,
        found: Vec::new(),
    };
    walk.walk(&graph.root, None, &mut Vec::new());

    let mut loose: std::collections::BTreeMap<String, Vec<CStateTransition>> = Default::default();
    for (subject, transition) in walk.found {
        match file_machines
            .iter_mut()
            .find(|m| normalized(&m.subject) == subject)
        {
            Some(machine) => machine.transitions.push(transition),
            None => loose.entry(subject).or_default().push(transition),
        }
    }
    // Variavel de estado sem `switch`: so vira maquina com 2+ destinos distintos.
    for (subject, transitions) in loose {
        let mut states: Vec<String> = Vec::new();
        for t in &transitions {
            for state in [&t.from, &t.to] {
                if state != "*" && !states.contains(state) {
                    states.push(state.clone());
                }
            }
        }
        let targets: BTreeSet<_> = transitions.iter().map(|t| t.to.as_str()).collect();
        let boolean = targets.iter().all(|t| {
            matches!(
                t.to_ascii_lowercase().as_str(),
                "true" | "false" | "0" | "1"
            )
        });
        if targets.len() < 2 || boolean {
            continue;
        }
        file_machines.push(CStateMachine {
            file: graph.source_file.clone(),
            function: None,
            subject,
            states,
            line: transitions[0].line,
            node_id: transitions[0].node_id.clone(),
            transitions,
        });
    }
    machines.extend(file_machines);
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
        // Grafo sem edicao (C regenerado == fonte) e sempre reconstruido com o parser atual;
        // so grafos editados sao preservados (e marcados `stale` se a fonte mudou).
        let (graph, stale) = match load_c_graph(&graph_path) {
            Ok(existing) if regenerate_c_source(&existing).as_bytes() != bytes.as_slice() => {
                let stale = existing.source_sha256 != fresh.source_sha256;
                (existing, stale)
            }
            _ => {
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
    refresh_c_graph_index(overlay_dir)?;
    Ok(rebuilt)
}

/// Recalcula funcoes, FSMs e entradas do indice a partir dos grafos gravados (apos edicao).
pub fn refresh_c_graph_index(overlay_dir: &Path) -> Result<CGraphIndex, String> {
    let mut index = load_c_graph_index(overlay_dir)?;
    let (mut functions, mut machines) = (Vec::new(), Vec::new());
    for entry in &index.files {
        let graph = load_c_graph(&overlay_dir.join(&entry.graph_file))?;
        summarize(&graph, &mut functions, &mut machines);
    }
    index.entry_points = functions
        .iter()
        .filter(|f| f.name == "main" && f.file.ends_with(".c"))
        .map(|f| format!("{}:{}", f.file, f.name))
        .collect();
    index.functions = functions;
    index.state_machines = machines;
    let path = overlay_dir.join(SGDK_C_GRAPH_DIR).join("index.json");
    fs::write(
        &path,
        serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Falha ao gravar '{}': {e}", path.display()))?;
    Ok(index)
}

/// Edita um statement pelos campos do bloco (sem digitar C). So aceita node com bloco.
pub fn update_c_graph_block(
    overlay_dir: &Path,
    source_file: &str,
    node_id: &str,
    block: &CBlock,
) -> Result<CGraphFile, String> {
    let graph = load_indexed_c_graph(overlay_dir, source_file)?;
    let mut found = None;
    visit(&graph.root, None, &mut |node, _| {
        if node.id == node_id {
            found = Some(node.block.clone());
        }
    });
    let Some(Some(current)) = found else {
        return Err(format!(
            "Node '{node_id}' nao e um bloco editavel em '{source_file}'."
        ));
    };
    if current.form != block.form || block.target.trim().is_empty() {
        return Err("Bloco invalido: forma diferente ou alvo vazio.".to_string());
    }
    update_c_graph_node(
        overlay_dir,
        source_file,
        node_id,
        &block_statement_text(block),
    )
}

/// Prepara em `staging` uma copia buildavel da raiz C (sem `out/`, `rds/`, `.git`).
/// `src/`, `inc/`, `res/` e arquivos da raiz sao copiados (o build pode gerar arquivos ao
/// lado deles); o resto vira hardlink, para nao duplicar gigabytes de dados por build.
/// Symlinks (inclusive quebrados) sao preservados. Fontes editadas sao gravadas por cima.
pub fn stage_c_project(
    host_root: &Path,
    staging: &Path,
    edited: &[(String, String)],
) -> Result<(), String> {
    fn place(from: &Path, to: &Path, link: bool) -> Result<(), String> {
        let file_type = fs::symlink_metadata(from)
            .map_err(|e| e.to_string())?
            .file_type();
        if file_type.is_symlink() {
            let target = fs::read_link(from).map_err(|e| e.to_string())?;
            #[cfg(unix)]
            return std::os::unix::fs::symlink(&target, to)
                .map_err(|e| format!("Falha ao recriar link '{}': {e}", from.display()));
            #[cfg(not(unix))]
            {
                let _ = target;
                if !from.is_file() {
                    return Ok(());
                }
            }
        }
        if file_type.is_dir() {
            fs::create_dir_all(to).map_err(|e| e.to_string())?;
            for entry in fs::read_dir(from).map_err(|e| e.to_string())?.flatten() {
                place(&entry.path(), &to.join(entry.file_name()), link)?;
            }
            return Ok(());
        }
        if link && fs::hard_link(from, to).is_ok() {
            return Ok(());
        }
        fs::copy(from, to)
            .map(|_| ())
            .map_err(|e| format!("Falha ao copiar '{}': {e}", from.display()))
    }

    fs::create_dir_all(staging).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(host_root)
        .map_err(|e| e.to_string())?
        .flatten()
    {
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        if ["out", "rds", ".git"].contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        let copied = !path.is_dir() || ["src", "inc", "res"].contains(&name.as_str());
        place(&path, &staging.join(entry.file_name()), !copied)?;
    }
    for (rel, text) in edited {
        let target = staging.join(rel);
        let _ = fs::remove_file(&target);
        fs::write(&target, text)
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

static u16 sceneMode;
static void tick(void)
{
    if (sceneMode == MODE_TITLE && start) sceneMode = MODE_GAME;
    else sceneMode = MODE_TITLE;
    if (start) sceneReady = TRUE; else sceneReady = FALSE;
    APP_changeScene(SCENE_MENU);
}

static void update(u16 joy)
{
    switch (state)
    {
        case ST_IDLE:
            if (joy & BUTTON_RIGHT) state = ST_WALK;
            break;
        case ST_WALK: {
            SPR_setAnim(player, 1);
            if (joy & BUTTON_A) { state = ST_JUMP; }
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
        assert_eq!(names, ["dbg", "tick", "update", "main"]);
        let main = functions.iter().find(|f| f.name == "main").unwrap();
        assert!(main.calls.contains(&"SPR_update".to_string()));
        assert!(main.calls.contains(&"update".to_string()));
        assert_eq!(machines.len(), 2);
        assert_eq!(machines[0].subject, "state");
        assert_eq!(machines[0].function.as_deref(), Some("update"));
        assert_eq!(machines[0].states, ["ST_IDLE", "ST_WALK", "default"]);
        let edges: Vec<_> = machines[0]
            .transitions
            .iter()
            .map(|t| (t.from.as_str(), t.to.as_str()))
            .collect();
        assert_eq!(edges, [("ST_IDLE", "ST_WALK"), ("ST_WALK", "ST_JUMP")]);
        let mode = machines
            .iter()
            .find(|m| m.subject == "sceneMode")
            .expect("fsm sem switch");
        let mode_edges: Vec<_> = mode
            .transitions
            .iter()
            .map(|t| (t.from.as_str(), t.to.as_str()))
            .collect();
        assert_eq!(
            mode_edges,
            [("MODE_TITLE", "MODE_GAME"), ("*", "MODE_TITLE")]
        );
        assert!(
            !machines.iter().any(|m| m.subject == "APP_changeScene"),
            "1 destino so nao e FSM"
        );
    }

    #[test]
    fn c_graph_exposes_blocks_with_nodegraph_vocabulary_and_rewrites_them() {
        let graph = parse_c_source("src/main.c", SAMPLE).expect("parse");
        let mut blocks = Vec::new();
        visit(&graph.root, None, &mut |n, _| {
            if let Some(b) = &n.block {
                blocks.push(b.clone());
            }
        });
        let anim = blocks.iter().find(|b| b.target == "SPR_setAnim").unwrap();
        assert_eq!(anim.node_type, "sprite_anim");
        assert_eq!(anim.args, ["player", "1"]);
        let mut edited = anim.clone();
        edited.args[1] = "ANIM_WALK".to_string();
        assert_eq!(
            block_statement_text(&edited),
            "SPR_setAnim(player, ANIM_WALK);"
        );
        assert!(blocks
            .iter()
            .any(|b| b.form == "assign" && b.target == "state" && b.args == ["ST_WALK"]));
        assert_eq!(sgdk_call_node_type("SPR_setPosition"), "sprite_move");
        assert_eq!(sgdk_call_node_type("XGM_startPlay"), "action_sound");
        assert_eq!(sgdk_call_node_type("update"), "c_call");
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

        // Grafo nao editado de versao antiga do parser (sem blocos) e reconstruido.
        let gp = graph_path_for(&overlay, "src/main.c");
        let legacy = fs::read_to_string(&gp).unwrap();
        let mut old_format: serde_json::Value = serde_json::from_str(&legacy).unwrap();
        fn strip_blocks(v: &mut serde_json::Value) {
            if let Some(map) = v.as_object_mut() {
                map.remove("block");
                map.values_mut().for_each(strip_blocks);
            } else if let Some(items) = v.as_array_mut() {
                items.iter_mut().for_each(strip_blocks);
            }
        }
        strip_blocks(&mut old_format);
        fs::write(&gp, old_format.to_string()).unwrap();
        write_c_graph_project(&host, &overlay).unwrap();
        assert!(fs::read_to_string(&gp).unwrap().contains("\"block\""));

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

        // Edicao por bloco reescreve so o statement.
        let mut anim_id = None;
        visit(
            &load_indexed_c_graph(&overlay, "src/main.c").unwrap().root,
            None,
            &mut |n, _| {
                if n.block.as_ref().is_some_and(|b| b.target == "SPR_setAnim") {
                    anim_id = Some(n.id.clone());
                }
            },
        );
        let block = CBlock {
            node_type: "sprite_anim".into(),
            form: "call".into(),
            target: "SPR_setAnim".into(),
            operator: String::new(),
            args: vec!["player".into(), "2".into()],
        };
        let after =
            update_c_graph_block(&overlay, "src/main.c", anim_id.as_deref().unwrap(), &block)
                .unwrap();
        let text = regenerate_c_source(&after);
        assert!(text.contains("SPR_setAnim(player, 2);") && text.contains("x += SPEED * 2"));
        assert!(update_c_graph_block(&overlay, "src/main.c", "n", &block).is_err());
        let fsm_before = load_c_graph_index(&overlay).unwrap().state_machines[0]
            .transitions
            .len();
        let with_new_edge = regenerate_c_source(&after).replace(
            "SPR_setAnim(player, 2);",
            "SPR_setAnim(player, 2); state = ST_IDLE;",
        );
        update_c_graph_node(&overlay, "src/main.c", "n", &with_new_edge).unwrap();
        assert_eq!(
            load_c_graph_index(&overlay).unwrap().state_machines[0]
                .transitions
                .len(),
            fsm_before + 1,
            "indice recalculado apos edicao"
        );
        update_c_graph_node(&overlay, "src/main.c", "n", &text).unwrap();

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
            let mut block_types: std::collections::BTreeMap<String, usize> =
                std::collections::BTreeMap::new();
            for file in collect_c_sources(root) {
                let Ok(source) = fs::read_to_string(&file) else {
                    continue;
                };
                let graph = parse_c_source(&rel_string(root, &file), &source).unwrap();
                files += 1;
                exact += usize::from(regenerate_c_source(&graph) == source);
                errors += graph.parse_error_nodes;
                visit(&graph.root, None, &mut |n, _| {
                    leaves += usize::from(n.text.is_some());
                    if let Some(block) = &n.block {
                        *block_types.entry(block.node_type.clone()).or_insert(0) += 1;
                    }
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
            let transitions: usize = machines.iter().map(|m| m.transitions.len()).sum();
            let with_transitions = machines
                .iter()
                .filter(|m| !m.transitions.is_empty())
                .count();
            println!(
                "CGRAPH_FSM transitions={transitions} machines_with_transitions={with_transitions}"
            );
            for m in machines
                .iter()
                .filter(|m| !m.transitions.is_empty())
                .take(4)
            {
                let edges: Vec<_> = m
                    .transitions
                    .iter()
                    .map(|t| format!("{}->{}", t.from, t.to))
                    .collect();
                println!(
                    "CGRAPH_FSM_SAMPLE {}:{} {} {edges:?}",
                    m.file, m.line, m.subject
                );
            }
            println!("CGRAPH_BLOCKS {block_types:?}");
            assert_eq!(
                files, exact,
                "round-trip deve ser exato em todos os arquivos"
            );
        }
    }
}
