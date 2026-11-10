//! Classe SEMÂNTICA de perfil (`rex-semantic-profile/v1`): a regra não é localizada por assinatura; é
//! DERIVADA dos bytes por um analisador, dentro de uma região.
//!
//! Separação de papéis:
//! * o PERFIL (dado) traz configuração e conhecimento declarado — identidade, procedência, vínculo com a
//!   ROM, limites, quais modos de seleção aceita, rótulo da edição e afirmações do autor. Não descreve
//!   instruções: não há linguagem de análise dentro do JSON;
//! * o ANALISADOR (`analyzer.kind`, uma operação genérica por classe) deriva as operações dos bytes. O
//!   único existente é `counter_compare_gate`, que é o crate `rex-gameplay` reutilizado como está
//!   (decodificação, região/CFG, elevação, grafo, reconstrução);
//! * o MOTOR (este módulo + `rex_profile_ipc`) coordena e valida: identidade, projeção para o grafo
//!   compartilhado, revisão contra o que a ROM diz agora, plano de edição como `rex_edit::Patch`.
//!
//! A região é SELECIONADA, não descoberta: por varredura estrutural (candidato) ou por entrada e saídas
//! declaradas pelo usuário. Chamadas externas ficam opacas; nada é simulado como operação vazia.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use rex_gameplay::graph::{edit_threshold, open_graph, Hints};
use rex_gameplay::patch::{patch_threshold, regenerate_from_graph};

use super::rex_edit::Patch;
use super::rex_evidence::EvidenceAxis;
use super::rex_profile_engine::ProfileError;
use super::rex_profile_graph::{
    canonical_signature, declared_profile_sha256, review_against, GraphReview, ReviewField,
    ReviewIdentity, BRIDGE_PARAM,
};
use super::rex_profile_spec::{
    bad, is_sha256_hex, limit, text_ok, unique, validate_header, ArchSpec, EvidenceSpec, Header,
    Provenance, RomBinding, SpecError, SpecStatus, HARD_MAX_ROM_BYTES, MAX_LIST, MAX_SPEC_BYTES,
};

pub const SEMANTIC_SCHEMA: &str = "rex-semantic-profile/v1";
pub const HARD_MAX_CANDIDATES: usize = 64;
pub const MAX_EXITS: usize = 64;
/// Nome do parâmetro (no nó de entrada) que guarda o offset da região.
pub const INSTANCE_PARAM: &str = "entry";

/// Analisadores existentes. Um por CLASSE de lógica, nunca por jogo ou por perfil.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalyzerKind {
    /// Guarda opcional → soma opcional de contador → comparação assinada de 32 bits com limiar → dois
    /// resultados de estado, com chamada externa opaca opcional (`crates/rex-gameplay`).
    CounterCompareGate,
    /// Nested WRAM copy, byte/word only; caller-declared region.
    CopyGrid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnalyzerSpec {
    pub kind: AnalyzerKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelectionSpec {
    /// Aceita candidatos da varredura estrutural do analisador.
    pub structural_scan: bool,
    /// Aceita região declarada pelo usuário (entrada e saídas).
    pub declared_region: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SemanticLimits {
    pub max_rom_bytes: u64,
    pub max_candidates: usize,
}

/// A única edição da classe: o nome do campo e o rótulo com que aparece.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SemanticEdit {
    pub field: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SemanticSpec {
    pub schema: String,
    pub id: String,
    pub revision: u32,
    pub status: SpecStatus,
    pub title: String,
    pub summary: String,
    pub artifact_tag: String,
    pub arch: ArchSpec,
    pub provenance: Provenance,
    pub rom_binding: RomBinding,
    pub work_limits: SemanticLimits,
    pub analyzer: AnalyzerSpec,
    pub selection: SelectionSpec,
    pub edit: SemanticEdit,
    pub evidence: EvidenceSpec,
    pub limits: Vec<String>,
}

impl SemanticSpec {
    pub fn from_json(text: &str) -> Result<SemanticSpec, SpecError> {
        if text.len() > MAX_SPEC_BYTES {
            return Err(SpecError::TooLarge);
        }
        #[derive(Deserialize)]
        struct Head {
            schema: String,
        }
        let head: Head = serde_json::from_str(text).map_err(|e| SpecError::Parse(e.to_string()))?;
        if head.schema != SEMANTIC_SCHEMA {
            return Err(SpecError::WrongSchema(head.schema));
        }
        let spec: SemanticSpec =
            serde_json::from_str(text).map_err(|e| SpecError::Parse(e.to_string()))?;
        spec.validate()?;
        Ok(spec)
    }

    pub fn validate(&self) -> Result<(), SpecError> {
        if self.schema != SEMANTIC_SCHEMA {
            return Err(SpecError::WrongSchema(self.schema.clone()));
        }
        validate_header(&Header {
            id: &self.id,
            revision: self.revision,
            title: &self.title,
            summary: &self.summary,
            artifact_tag: &self.artifact_tag,
            arch: &self.arch,
            provenance: &self.provenance,
            rom_binding: &self.rom_binding,
            limits: &self.limits,
        })?;
        let w = &self.work_limits;
        if w.max_rom_bytes == 0
            || w.max_rom_bytes > HARD_MAX_ROM_BYTES
            || w.max_candidates == 0
            || w.max_candidates > HARD_MAX_CANDIDATES
        {
            return bad("bad-work-limits", format!("{w:?}"));
        }
        if !self.selection.structural_scan && !self.selection.declared_region {
            return bad("no-selection", "nenhum modo de seleção habilitado");
        }
        // o campo editável é o do analisador, não um nome livre
        match self.analyzer.kind {
            AnalyzerKind::CopyGrid => {
                if self.edit.field != "bytes_per_cell" {
                    return bad("unknown-field", "copy-grid edits only bytes_per_cell");
                }
                if self.selection.structural_scan {
                    return bad(
                        "unsupported-selection",
                        "copy-grid requires declared region",
                    );
                }
            }
            AnalyzerKind::CounterCompareGate => {
                if self.edit.field != "threshold" {
                    return bad("unknown-field", format!("edit.field '{}'", self.edit.field));
                }
            }
        }
        text_ok("edit.label", &self.edit.label)?;
        limit("evidence.claims", self.evidence.claims.len(), MAX_LIST)?;
        limit("evidence.unknown", self.evidence.unknown.len(), MAX_LIST)?;
        unique(
            "afirmação",
            self.evidence.claims.iter().map(|c| c.id.as_str()),
        )?;
        for u in &self.evidence.unknown {
            text_ok("evidence.unknown", u)?;
        }
        for c in &self.evidence.claims {
            let ctx = format!("afirmação '{}'", c.id);
            text_ok("claim.statement", &c.statement)?;
            if matches!(
                c.level.axis(),
                EvidenceAxis::Identity | EvidenceAxis::Static
            ) {
                return bad("claim-not-runtime", ctx);
            }
            if c.refs.is_empty() || c.refs.iter().any(|r| r.trim().is_empty()) {
                return bad("claim-without-reference", ctx);
            }
            if c.scope.roms.is_empty()
                || c.scope
                    .roms
                    .iter()
                    .any(|r| !is_sha256_hex(&r.sha256) || r.instance_offsets.is_empty())
            {
                return bad("claim-without-scope", ctx);
            }
            text_ok("claim.scope.conditions", &c.scope.conditions)?;
            if c.fields != [self.edit.field.clone()]
                || c.scope.values.iter().any(|v| v.field != self.edit.field)
            {
                return bad("unknown-field", ctx);
            }
        }
        Ok(())
    }
}

/// Como a região foi escolhida. Nenhum dos dois modos é descoberta de rotina.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectionMode {
    /// Candidato da varredura estrutural do analisador (só encontra a forma com guarda).
    StructuralScan,
    /// Entrada e saídas informadas pelo usuário.
    DeclaredRegion,
}

impl SelectionMode {
    pub fn code(self) -> &'static str {
        match self {
            SelectionMode::StructuralScan => "structural_scan",
            SelectionMode::DeclaredRegion => "declared_region",
        }
    }
    pub fn label_pt(self) -> &'static str {
        match self {
            SelectionMode::StructuralScan => "candidato por varredura estrutural (forma com guarda); não é descoberta de rotina nem prova de uso em jogo",
            SelectionMode::DeclaredRegion => "região declarada pelo usuário (entrada e saídas informadas); nada foi descoberto automaticamente",
        }
    }
    fn from_code(code: &str) -> Option<SelectionMode> {
        [SelectionMode::StructuralScan, SelectionMode::DeclaredRegion]
            .into_iter()
            .find(|m| m.code() == code)
    }
}

/// Operação da regra, derivada dos bytes pelo analisador.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OperationView {
    pub id: String,
    pub kind: String,
    pub text: String,
    /// Sempre `recovered_from_rom`: nada aqui vem do perfil.
    pub origin: String,
    /// Faixas `[início, fim)` de OFFSET DE ARQUIVO das instruções que sustentam a operação.
    pub rom_ranges: Vec<(u64, u64)>,
    pub editable: bool,
    /// Parte não compreendida (ex.: chamada externa): registrada, não recuperada.
    pub opaque: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemanticInstance {
    pub entry: u32,
    pub exits: Vec<u32>,
    pub selection: SelectionMode,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    /// Offset de arquivo do byte imediato que guarda o limiar.
    pub immediate_at: usize,
    pub operations: Vec<OperationView>,
    /// Grafo do analisador, como ele o emite (usado só para pedir a reconstrução a ele).
    analyzer_graph: String,
}

#[derive(Clone)]
pub struct SemanticEngine {
    spec: SemanticSpec,
    sha256: String,
}

fn refused(e: String) -> ProfileError {
    ProfileError::RegionRefused(e)
}

fn hex6(v: u32) -> String {
    format!("0x{v:06X}")
}

fn parse_hex(v: &Value) -> Option<u64> {
    u64::from_str_radix(v.as_str()?.trim_start_matches("0x"), 16).ok()
}

/// Portas dos tipos de node da classe (as do editor: `nodeDefinitions.ts`).
fn ports(node_type: &str) -> (&'static [&'static str], &'static [&'static str]) {
    match node_type {
        "rom_region_entry" => (&[], &["exec"]),
        "rom_region_exit" => (&["exec"], &[]),
        "rom_input_bit_guard" | "rom_counter_compare" => (&["exec"], &["true", "false"]),
        _ => (&["exec"], &["exec"]),
    }
}

/// Parâmetros que o editor acrescenta por omissão a cada tipo: a projeção os escreve todos, para que o
/// grafo seja um ponto fixo da hidratação do editor (mesma assinatura estrutural nos dois lados).
fn default_params(node_type: &str) -> Vec<(&'static str, Value)> {
    let s = |v: &str| json!(v);
    let mut d = vec![
        ("semantic_origin", s("recovered_from_rom")),
        ("source_mappings", s("")),
    ];
    d.extend(match node_type {
        "rom_region_entry" | "rom_region_exit" => vec![("address", s(""))],
        "rom_input_bit_guard" => vec![("register", s("")), ("bit", json!(0)), ("skip_exit", s(""))],
        "rom_counter_add" => vec![
            ("address", s("")),
            ("step", json!(1)),
            ("width_bits", json!(32)),
            ("signedness", s("")),
        ],
        "rom_counter_compare" => vec![
            ("address", s("")),
            ("operator", s(">=")),
            ("threshold", json!(0)),
            ("recovered_threshold", json!(0)),
            ("threshold_min", json!(0)),
            ("threshold_max", json!(0)),
            ("width_bits", json!(32)),
            ("lowering", s("")),
        ],
        "rom_state_write" => vec![
            ("address", s("")),
            ("value", json!(0)),
            ("width_bits", json!(32)),
        ],
        "rom_external_call" => vec![
            ("target", s("")),
            ("understood", s("false")),
            ("clobbers", s("")),
            ("readonly", s("true")),
            ("opaco", s("true")),
        ],
        _ => vec![],
    });
    d
}

/// Valor escalar para o editor: número e texto ficam; booleano vira texto; lista/objeto vira JSON compacto.
fn scalar(v: &Value) -> Option<Value> {
    match v {
        Value::Null => None,
        Value::Number(_) | Value::String(_) => Some(v.clone()),
        Value::Bool(b) => Some(json!(b.to_string())),
        other => Some(json!(other.to_string())),
    }
}

impl SemanticEngine {
    pub fn new(spec: SemanticSpec, profile_sha256: &str) -> Result<SemanticEngine, SpecError> {
        spec.validate()?;
        Ok(SemanticEngine {
            spec,
            sha256: profile_sha256.to_string(),
        })
    }

    pub fn spec(&self) -> &SemanticSpec {
        &self.spec
    }

    pub fn profile_sha256(&self) -> &str {
        &self.sha256
    }

    fn bound(&self, rom: &[u8], rom_sha256: &str) -> Result<bool, ProfileError> {
        if rom.len() as u64 > self.spec.work_limits.max_rom_bytes {
            return Err(ProfileError::WorkLimit(format!(
                "ROM de {} bytes acima do limite do perfil ({})",
                rom.len(),
                self.spec.work_limits.max_rom_bytes
            )));
        }
        Ok(match &self.spec.rom_binding {
            RomBinding::Signature => true,
            RomBinding::Sha256 { sha256 } => sha256.iter().any(|s| s == rom_sha256),
        })
    }

    /// Candidatos da varredura estrutural do analisador. `Ok(None)`: perfil vinculado a outras ROMs.
    pub fn candidates(
        &self,
        rom: &[u8],
        rom_sha256: &str,
    ) -> Result<Option<Vec<SemanticInstance>>, ProfileError> {
        if !self.bound(rom, rom_sha256)? {
            return Ok(None);
        }
        if !self.spec.selection.structural_scan {
            return Ok(Some(Vec::new()));
        }
        let found = match self.spec.analyzer.kind {
            AnalyzerKind::CounterCompareGate => rex_gameplay::scan_guarded_candidates(rom),
            AnalyzerKind::CopyGrid => return Ok(Some(Vec::new())),
        };
        if found.len() > self.spec.work_limits.max_candidates {
            return Err(ProfileError::WorkLimit(format!(
                "mais de {} candidatos",
                self.spec.work_limits.max_candidates
            )));
        }
        let mut out = Vec::new();
        for c in found {
            out.push(self.analyze(rom, c.entry, &[c.exit], SelectionMode::StructuralScan)?);
        }
        Ok(Some(out))
    }

    /// Recupera a regra de uma região DECLARADA (entrada e saídas).
    pub fn recover_declared(
        &self,
        rom: &[u8],
        rom_sha256: &str,
        entry: u32,
        exits: &[u32],
    ) -> Result<SemanticInstance, ProfileError> {
        if !self.bound(rom, rom_sha256)? {
            return Err(ProfileError::RomNotBound);
        }
        if !self.spec.selection.declared_region {
            return Err(refused(
                "este perfil não aceita região declarada".to_string(),
            ));
        }
        self.analyze(rom, entry, exits, SelectionMode::DeclaredRegion)
    }

    /// Re-deriva a instância que um pedido aponta (entrada, saídas e modo vêm do pedido; a regra, da ROM).
    pub fn instance(
        &self,
        rom: &[u8],
        rom_sha256: &str,
        entry: u32,
        exits: &[u32],
        selection: SelectionMode,
    ) -> Result<SemanticInstance, ProfileError> {
        if !self.bound(rom, rom_sha256)? {
            return Err(ProfileError::RomNotBound);
        }
        self.analyze(rom, entry, exits, selection)
    }

    fn analyze(
        &self,
        rom: &[u8],
        entry: u32,
        exits: &[u32],
        selection: SelectionMode,
    ) -> Result<SemanticInstance, ProfileError> {
        if (selection == SelectionMode::DeclaredRegion && !self.spec.selection.declared_region)
            || (selection == SelectionMode::StructuralScan && !self.spec.selection.structural_scan)
        {
            return Err(refused("selection mode not enabled by this profile".into()));
        }
        if exits.is_empty() || exits.len() > MAX_EXITS {
            return Err(refused(format!(
                "a região exige de 1 a {MAX_EXITS} saídas declaradas"
            )));
        }
        if !entry.is_multiple_of(2)
            || exits.iter().any(|e| !e.is_multiple_of(2))
            || exits.contains(&entry)
        {
            return Err(refused(
                "entrada e saídas têm de ser pares e a entrada não pode ser uma saída".to_string(),
            ));
        }
        match self.spec.analyzer.kind {
            AnalyzerKind::CopyGrid => {
                let grid = super::rex_copy_grid::recover(rom, entry, exits).map_err(refused)?;
                let graph = grid.graph();
                Ok(SemanticInstance {
                    entry,
                    exits: exits.to_vec(),
                    selection,
                    value: i64::from(grid.width),
                    min: 1,
                    max: i64::from(
                        *grid
                            .widths()
                            .iter()
                            .max()
                            .ok_or_else(|| refused("no supported width".into()))?,
                    ),
                    immediate_at: entry as usize + grid.transfer_offset(),
                    operations: operations(&graph),
                    analyzer_graph: graph.to_string(),
                })
            }
            AnalyzerKind::CounterCompareGate => {
                // rótulos de endereço não são usados: o motor não recebe símbolos
                let rec =
                    rex_gameplay::recover(rom, entry, exits, &Hints::default()).map_err(refused)?;
                let (min, max) = rec.rule.compare.editable_range();
                let graph: Value = serde_json::from_str(&rec.graph_json)
                    .map_err(|e| refused(format!("grafo do analisador inválido: {e}")))?;
                Ok(SemanticInstance {
                    entry,
                    exits: exits.to_vec(),
                    selection,
                    value: rec.rule.compare.threshold,
                    min,
                    max,
                    immediate_at: rec.rule.compare.k_at as usize + 1,
                    operations: operations(&graph),
                    analyzer_graph: rec.graph_json,
                })
            }
        }
    }

    /// Projeção para o grafo COMPARTILHADO: os nós e conexões do analisador, com parâmetros escalares, o
    /// vínculo de ponte no nó de entrada e a marca de edição no único nó editável.
    pub fn graph_json(&self, inst: &SemanticInstance, rom_sha256: &str) -> String {
        let analyzer: Value = serde_json::from_str(&inst.analyzer_graph).unwrap_or(Value::Null);
        let empty = Vec::new();
        let field = &self.spec.edit.field;
        let mut nodes: Vec<Value> = Vec::new();
        for n in analyzer["nodes"].as_array().unwrap_or(&empty) {
            let t = n["type"].as_str().unwrap_or("");
            let mut params: Map<String, Value> = Map::new();
            for (k, v) in default_params(t) {
                params.insert(k.to_string(), v);
            }
            for (k, v) in n["params"].as_object().unwrap_or(&Map::new()) {
                if let Some(v) = scalar(v) {
                    params.insert(k.clone(), v);
                }
            }
            if t == "rom_region_entry" {
                params.insert("perfil".into(), json!(self.spec.id));
                params.insert("rom_sha256".into(), json!(rom_sha256));
                params.insert(INSTANCE_PARAM.into(), json!(inst.entry));
                params.insert(
                    "saidas".into(),
                    json!(inst
                        .exits
                        .iter()
                        .map(|e| hex6(*e))
                        .collect::<Vec<_>>()
                        .join(",")),
                );
                params.insert("selecao".into(), json!(inst.selection.code()));
                params.insert(BRIDGE_PARAM.into(), json!(1));
                params.insert("perfil_sha256".into(), json!(self.sha256));
                params.insert("perfil_revisao".into(), json!(self.spec.revision));
                params.insert("instancia_param".into(), json!(INSTANCE_PARAM));
            }
            if t == "rom_counter_compare" || t == "rom_copy_grid" {
                params.insert("editavel".into(), json!(1));
                params.insert("campo".into(), json!(field));
                params.insert("campo_param".into(), json!(field));
                params.insert(field.clone(), json!(inst.value));
                params.insert("valor_original".into(), json!(inst.value));
                params.insert("faixa".into(), json!(format!("{}..{}", inst.min, inst.max)));
                params.insert(
                    "rom_offsets".into(),
                    json!(format!("0x{:06X}", inst.immediate_at)),
                );
            }
            let (ins, outs) = ports(t);
            let io = |ids: &[&str]| -> Vec<Value> {
                ids.iter()
                    .map(|id| json!({"id": id, "label": id, "kind": "exec"}))
                    .collect()
            };
            nodes.push(json!({
                "id": n["id"], "type": t, "label": n["label"], "x": n["x"], "y": n["y"],
                "inputs": io(ins), "outputs": io(outs), "params": Value::Object(params)
            }));
        }
        let edges: Vec<Value> = analyzer["edges"]
            .as_array()
            .unwrap_or(&empty)
            .iter()
            .map(|e| json!({"id": e["id"], "fromNode": e["fromNode"], "fromPort": e["fromPort"], "toNode": e["toNode"], "toPort": e["toPort"]}))
            .collect();
        let assinatura = canonical_signature(&json!({"nodes": nodes, "edges": edges}));
        if let Some(ev) = nodes.iter_mut().find(|n| n["type"] == "rom_region_entry") {
            ev["params"]["assinatura_estrutural"] = json!(assinatura);
        }
        let meta = json!({
            "profile_id": self.spec.id, "profile_sha256": self.sha256, "profile_revision": self.spec.revision,
            "class": "semantic_region", "analyzer": self.spec.analyzer.kind,
            "rom_sha256": rom_sha256, INSTANCE_PARAM: hex6(inst.entry), "selection": inst.selection.code(),
            "descritivo": true,
            "aviso": if self.spec.analyzer.kind == AnalyzerKind::CounterCompareGate { "Grafo descritivo, derivado dos bytes pelo analisador. So o limiar e editavel; mudar topologia, operador ou enderecos aqui nao e compilado.".to_string() } else { format!("Grafo descritivo derivado dos bytes. Somente {} editável; topologia e outros parâmetros não são compilados.", self.spec.edit.field) },
            "campos_editaveis": [field],
        });
        serde_json::to_string_pretty(
            &json!({"version": 1, "nodes": nodes, "edges": edges, "rex_logic_recovery": meta}),
        )
        .unwrap_or_default()
    }

    /// Revisão do grafo do cliente: a região (entrada, saídas, modo) é a que o grafo declara; a regra é
    /// re-derivada da ROM e o grafo tem de coincidir com essa re-derivação, exceto o valor do limiar.
    pub fn review(
        &self,
        rom: &[u8],
        rom_sha256: &str,
        entry: u32,
        current_json: &str,
    ) -> Result<(GraphReview, SemanticInstance), ProfileError> {
        let diverges = |m: &str| ProfileError::GraphDiverges(vec![m.to_string()]);
        let cur: Value = serde_json::from_str(current_json)
            .map_err(|_| diverges("o grafo não é JSON válido"))?;
        let mut review = GraphReview::default();
        match declared_profile_sha256(&cur) {
            Some(h) if h != self.sha256 => {
                return Err(ProfileError::ProfileMismatch {
                    expected: h,
                    loaded: self.sha256.clone(),
                })
            }
            Some(_) => {}
            None => review.legacy_binding = true,
        }
        let bridge = cur["nodes"]
            .as_array()
            .and_then(|a| a.iter().find(|n| n["params"][BRIDGE_PARAM] == 1))
            .ok_or_else(|| diverges("grafo sem o nó de entrada da ponte"))?;
        let exits: Vec<u32> = bridge["params"]["saidas"]
            .as_str()
            .unwrap_or("")
            .split(',')
            .filter(|s| !s.is_empty())
            .map(|s| u32::from_str_radix(s.trim().trim_start_matches("0x"), 16))
            .collect::<Result<_, _>>()
            .map_err(|_| diverges("saídas da região ilegíveis no grafo"))?;
        let selection = bridge["params"]["selecao"]
            .as_str()
            .and_then(SelectionMode::from_code)
            .ok_or_else(|| diverges("modo de seleção ilegível no grafo"))?;
        let inst = self.instance(rom, rom_sha256, entry, &exits, selection)?;
        let canon: Value = serde_json::from_str(&self.graph_json(&inst, rom_sha256))
            .map_err(|_| diverges("grafo canônico inválido"))?;
        review_against(
            &mut review,
            &canon,
            &cur,
            &ReviewIdentity {
                profile_id: &self.spec.id,
                rom_sha256,
                instance_param: INSTANCE_PARAM,
                instance_offset: entry as usize,
            },
            &[ReviewField {
                name: self.spec.edit.field.clone(),
                value: inst.value,
                min: inst.min,
                max: inst.max,
                enc: None,
            }],
        );
        Ok((review, inst))
    }

    fn plan_copy_grid(
        &self,
        rom: &[u8],
        sha: &str,
        inst: &SemanticInstance,
        value: i64,
    ) -> Result<(Vec<Patch>, bool), ProfileError> {
        use rex_gameplay::patch::{md_checksum, MD_CHECKSUM_AT};
        if super::rom_library::sha256_hex(rom) != sha {
            return Err(refused("base SHA-256 mismatch".into()));
        }
        let grid = super::rex_copy_grid::recover(rom, inst.entry, &inst.exits).map_err(refused)?;
        let rebuilt_base = self.instance(rom, sha, inst.entry, &inst.exits, inst.selection)?;
        if rebuilt_base != *inst {
            return Err(refused("stale or altered recovered instance".into()));
        }
        let mut edited = grid.clone();
        edited.width = value as u32;
        let body = edited.encode().map_err(refused)?;
        let at = inst.entry as usize;
        let mut by_graph = rom.to_vec();
        by_graph[at..at + grid.length()].copy_from_slice(&body);
        let mut by_field = rom.to_vec();
        let width_at = at + grid.transfer_offset();
        let width_bits = match value {
            1 => 0x10,
            2 => 0x30,
            4 => 0x20,
            _ => return Err(ProfileError::OutOfRange),
        };
        by_field[width_at] = (by_field[width_at] & 0xCF) | width_bits;
        if by_graph != by_field {
            return Err(refused(
                "typed re-encoding differs from width-field patch".into(),
            ));
        }
        let mut patches = vec![Patch {
            offset: width_at,
            old: vec![rom[width_at]],
            new: vec![by_graph[width_at]],
        }];
        let mut checksum = false;
        if md_checksum(rom).is_some_and(|sum| {
            sum == u16::from_be_bytes([rom[MD_CHECKSUM_AT], rom[MD_CHECKSUM_AT + 1]])
        }) {
            let new = md_checksum(&by_graph)
                .expect("header preserved")
                .to_be_bytes()
                .to_vec();
            if new != rom[MD_CHECKSUM_AT..MD_CHECKSUM_AT + 2] {
                patches.insert(
                    0,
                    Patch {
                        offset: MD_CHECKSUM_AT,
                        old: rom[MD_CHECKSUM_AT..MD_CHECKSUM_AT + 2].to_vec(),
                        new,
                    },
                );
                checksum = true;
            }
        }
        Ok((patches, checksum))
    }

    /// Plano de edição do limiar: o ANALISADOR reconstrói (pelos seus dois caminhos, conferidos iguais) e o
    /// motor recebe o resultado como lista de `Patch` com os bytes antigos. `true` = o checksum do
    /// cabeçalho também foi atualizado (só quando a base já o tinha válido).
    pub fn plan(
        &self,
        rom: &[u8],
        rom_sha256: &str,
        inst: &SemanticInstance,
        threshold: i64,
    ) -> Result<(Vec<Patch>, bool), ProfileError> {
        if threshold < inst.min || threshold > inst.max {
            return Err(ProfileError::OutOfRange);
        }
        if threshold == inst.value {
            return Err(ProfileError::NoChange);
        }
        if self.spec.analyzer.kind == AnalyzerKind::CopyGrid {
            return self.plan_copy_grid(rom, rom_sha256, inst, threshold);
        }
        let rebuilt = match self.spec.analyzer.kind {
            AnalyzerKind::CopyGrid => unreachable!("handled above"),
            AnalyzerKind::CounterCompareGate => {
                let edited = edit_threshold(&inst.analyzer_graph, threshold).map_err(refused)?;
                let opened = open_graph(&edited).map_err(refused)?;
                let by_patch = patch_threshold(rom, rom_sha256, &opened).map_err(refused)?;
                let by_graph = regenerate_from_graph(rom, rom_sha256, &opened).map_err(refused)?;
                if by_patch.bytes != by_graph.bytes {
                    return Err(refused(
                        "os dois caminhos de reconstrução do analisador divergem; nada foi gerado"
                            .to_string(),
                    ));
                }
                by_patch
            }
        };
        if rebuilt.bytes.len() != rom.len() {
            return Err(refused("a reconstrução mudou o tamanho da ROM".to_string()));
        }
        // diferenças contíguas viram um Patch cada, com os bytes ANTIGOS
        let mut patches: Vec<Patch> = Vec::new();
        let mut i = 0;
        while i < rom.len() {
            if rom[i] == rebuilt.bytes[i] {
                i += 1;
                continue;
            }
            let start = i;
            while i < rom.len() && rom[i] != rebuilt.bytes[i] {
                i += 1;
            }
            patches.push(Patch {
                offset: start,
                old: rom[start..i].to_vec(),
                new: rebuilt.bytes[start..i].to_vec(),
            });
        }
        if patches.is_empty() {
            return Err(ProfileError::NoChange);
        }
        Ok((patches, rebuilt.checksum_updated))
    }
}

/// Operações da regra, lidas do grafo do analisador (nó a nó), sem reinterpretar a semântica.
fn operations(graph: &Value) -> Vec<OperationView> {
    let empty = Vec::new();
    graph["nodes"]
        .as_array()
        .unwrap_or(&empty)
        .iter()
        .map(|n| {
            let p = &n["params"];
            let mut parts: Vec<String> = Vec::new();
            if let Some(obj) = p.as_object() {
                for (k, v) in obj {
                    if ["source_mappings", "semantic_origin", "lowering", "editable"]
                        .contains(&k.as_str())
                    {
                        continue;
                    }
                    if let Some(s) = scalar(v) {
                        let s = s
                            .as_str()
                            .map(str::to_string)
                            .unwrap_or_else(|| s.to_string());
                        parts.push(format!("{k}={s}"));
                    }
                }
            }
            let rom_ranges = p["source_mappings"]
                .as_array()
                .unwrap_or(&empty)
                .iter()
                .filter_map(|m| Some((parse_hex(&m["rom_start"])?, parse_hex(&m["rom_end"])?)))
                .collect();
            OperationView {
                id: n["id"].as_str().unwrap_or("").to_string(),
                kind: n["type"].as_str().unwrap_or("").to_string(),
                text: parts.join(" · "),
                origin: p["semantic_origin"].as_str().unwrap_or("").to_string(),
                rom_ranges,
                editable: n["type"] == "rom_counter_compare" || n["type"] == "rom_copy_grid",
                opaque: p["understood"] == false,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::rex_edit::{apply, ips, ips_apply_strict};
    use super::super::rex_profile_registry::Registry;
    use super::super::rex_profile_testkit::{authored_gate_rom, crate_fixture};
    use super::super::rom_library::sha256_hex;
    use super::*;

    const SPEC: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../data/rex_profiles/specs/m68k.counter_threshold_state_gate.v1.json"
    ));

    fn engine() -> SemanticEngine {
        SemanticEngine::new(
            SemanticSpec::from_json(SPEC).unwrap(),
            &sha256_hex(SPEC.as_bytes()),
        )
        .unwrap()
    }

    fn rule(f: impl FnOnce(&mut Value)) -> &'static str {
        let mut v: Value = serde_json::from_str(SPEC).unwrap();
        f(&mut v);
        match SemanticSpec::from_json(&v.to_string()) {
            Ok(_) => "aceito",
            Err(e) => e.rule(),
        }
    }

    fn op<'a>(i: &'a SemanticInstance, id: &str) -> &'a OperationView {
        i.operations
            .iter()
            .find(|o| o.id == id)
            .unwrap_or_else(|| panic!("operação {id}"))
    }

    #[test]
    fn perfil_semantico_embutido_carrega_pelo_esquema_e_o_contrato_recusa_o_resto() {
        let reg = Registry::builtin();
        assert_eq!(reg.rejected, []);
        assert_eq!(reg.semantic.len(), 2);
        assert_eq!(
            reg.find_semantic("m68k.counter_threshold_state_gate.v1")
                .unwrap()
                .engine
                .spec()
                .analyzer
                .kind,
            AnalyzerKind::CounterCompareGate
        );
        // o mesmo id não está na lista de perfis de assinatura: a classe vem do esquema do arquivo
        assert!(reg.find(&reg.semantic[0].engine.spec().id).is_none());
        assert_eq!(rule(|_| {}), "aceito");
        assert_eq!(
            rule(|m| m["schema"] = json!("rex-semantic-profile/v2")),
            "wrong-schema"
        );
        assert_eq!(
            rule(|m| m["schema"] = json!("rex-profile-spec/v2")),
            "wrong-schema"
        );
        // não há linguagem de análise no JSON: analisador desconhecido ou "programa" não existem no contrato
        assert_eq!(rule(|m| m["analyzer"]["kind"] = json!("custom")), "parse");
        assert_eq!(
            rule(|m| m["analyzer"]["script"] = json!("if d0 > 3")),
            "parse"
        );
        assert_eq!(rule(|m| m["instructions"] = json!(["moveq"])), "parse");
        assert_eq!(
            rule(|m| m["edit"]["field"] = json!("operator")),
            "unknown-field"
        );
        assert_eq!(
            rule(|m| m["selection"] = json!({"structural_scan": false, "declared_region": false})),
            "no-selection"
        );
        assert_eq!(
            rule(|m| m["work_limits"]["max_candidates"] = json!(0)),
            "bad-work-limits"
        );
        assert_eq!(
            rule(|m| m["work_limits"]["max_candidates"] = json!(HARD_MAX_CANDIDATES + 1)),
            "bad-work-limits"
        );
        assert_eq!(
            rule(|m| m["evidence"]["claims"][0]["fields"] = json!(["operator"])),
            "unknown-field"
        );
        assert_eq!(
            rule(|m| m["evidence"]["claims"][0]["refs"] = json!([])),
            "claim-without-reference"
        );
        assert_eq!(
            rule(|m| m["evidence"]["claims"][0]["level"] = json!("L2")),
            "claim-not-runtime"
        );
        assert_eq!(
            rule(|m| m["arch"]["cpu"] = json!("z80")),
            "unsupported-arch"
        );
        assert_eq!(rule(|m| m["limits"] = json!([])), "no-limits");
        assert_eq!(rule(|m| m["id"] = json!("Gate")), "bad-id");
    }

    #[test]
    fn caso_existente_e_recuperado_dos_bytes_pelos_dois_modos_de_selecao() {
        let e = engine();
        // fixture de ajuste do crate: a varredura acha exatamente um candidato
        let rom = crate_fixture("goal_original_t6.hex");
        let sha = sha256_hex(&rom);
        let found = e.candidates(&rom, &sha).unwrap().unwrap();
        assert_eq!(found.len(), 1);
        let i = &found[0];
        assert_eq!(
            (i.entry, i.exits.clone(), i.selection),
            (0x946, vec![0x970], SelectionMode::StructuralScan)
        );
        assert_eq!((i.value, i.min, i.max), (6, -127, 128));
        assert!(op(i, "compare").text.contains("operator=>="));
        assert!(
            op(i, "guard").text.contains("register=D0") && op(i, "guard").text.contains("bit=3")
        );
        assert!(op(i, "set_call").opaque && !op(i, "compare").opaque);
        assert!(i
            .operations
            .iter()
            .all(|o| o.origin == "recovered_from_rom"));
        // duas passagens: a regra 2 não tem guarda — a varredura não a acha; só a região DECLARADA
        let two = crate_fixture("two_passages.hex");
        let sha2 = sha256_hex(&two);
        let scan = e.candidates(&two, &sha2).unwrap().unwrap();
        assert_eq!(scan.iter().map(|i| i.entry).collect::<Vec<_>>(), [0xA4C]);
        let decl = e
            .recover_declared(&two, &sha2, 0xAA0, &[0xAC8, 0xC7A])
            .unwrap();
        assert_eq!(
            (decl.value, decl.selection),
            (60, SelectionMode::DeclaredRegion)
        );
        assert!(decl
            .operations
            .iter()
            .all(|o| o.kind != "rom_input_bit_guard" && o.kind != "rom_counter_add"));
        // o rótulo da seleção nunca diz "descoberta"
        assert!(SelectionMode::StructuralScan
            .label_pt()
            .contains("não é descoberta de rotina"));
        assert!(SelectionMode::DeclaredRegion
            .label_pt()
            .contains("nada foi descoberto automaticamente"));
    }

    #[test]
    fn variante_autoral_difere_do_caso_existente_em_registradores_enderecos_e_orientacao() {
        let e = engine();
        let rom = authored_gate_rom();
        let sha = sha256_hex(&rom);
        let i = e.recover_declared(&rom, &sha, 0x400, &[0x444]).unwrap();
        let base = e
            .candidates(&crate_fixture("goal_original_t6.hex"), "x")
            .unwrap()
            .unwrap()
            .remove(0);
        // derivado dos bytes: operador, limiar, passo, registrador/bit da guarda, endereços, dois resultados
        assert_eq!(
            (i.value, i.min, i.max, i.immediate_at),
            (40, -128, 127, 0x41B)
        );
        assert!(
            op(&i, "compare").text.contains("operator=<")
                && !op(&i, "compare").text.contains("operator=<=")
        );
        assert!(
            op(&i, "guard").text.contains("register=D3") && op(&i, "guard").text.contains("bit=5")
        );
        assert!(
            op(&i, "counter_add").text.contains("step=3")
                && op(&i, "counter_add").text.contains("address=0xFF9010")
        );
        assert!(
            op(&i, "set_write").text.contains("address=0xFF9024")
                && op(&i, "set_write").text.contains("value=9")
        );
        assert!(op(&i, "other_write").text.contains("value=0"));
        assert!(op(&i, "set_call").opaque && op(&i, "set_call").text.contains("target=0x000600"));
        // não é relocação dos mesmos bytes: as instruções da comparação e da guarda são outras
        for id in ["guard", "counter_add", "compare", "set_write"] {
            assert_ne!(op(&i, id).text, op(&base, id).text, "{id}");
        }
        assert_ne!(
            (i.min, i.max),
            (base.min, base.max),
            "a orientação do CMP muda o viés do limiar"
        );
        // a mesma região também é proposta pela varredura (tem guarda), com o mesmo resultado
        let scan = e.candidates(&rom, &sha).unwrap().unwrap();
        assert_eq!(scan.len(), 1);
        assert_eq!(
            (scan[0].entry, scan[0].exits.clone(), scan[0].value),
            (0x400, vec![0x444], 40)
        );
    }

    #[test]
    fn regiao_fora_do_subconjunto_e_recusada_com_motivo_e_nada_e_inventado() {
        let e = engine();
        let rom = authored_gate_rom();
        let sha = sha256_hex(&rom);
        let refused = |entry: u32, exits: &[u32]| match e.recover_declared(&rom, &sha, entry, exits)
        {
            Err(ProfileError::RegionRefused(m)) => m,
            other => panic!("esperava recusa: {:?}", other.map(|i| i.value)),
        };
        // o código de partida usa instruções fora do subconjunto (move.w #..,sr; lea; dbra)
        assert!(!refused(0x200, &[0x444]).is_empty());
        // saída declarada que a região nunca alcança
        assert!(!refused(0x400, &[0x7FE]).is_empty());
        // entrada no meio de uma operação (no CMP): não é a forma
        assert!(!refused(0x41C, &[0x444]).is_empty());
        // entrada DEPOIS da guarda: é uma forma válida (a guarda é opcional) — e por isso a entrada
        // declarada molda o que se recupera: quem declara 0x406 obtém a regra SEM guarda. Declarar não é descobrir.
        let sem_guarda = e.recover_declared(&rom, &sha, 0x406, &[0x444]).unwrap();
        assert!(sem_guarda
            .operations
            .iter()
            .all(|o| o.kind != "rom_input_bit_guard"));
        assert_eq!(sem_guarda.value, 40);
        assert!(!refused(0x401, &[0x444]).is_empty(), "entrada ímpar");
        assert!(!refused(0x400, &[]).is_empty(), "sem saída declarada");
        assert!(
            !refused(0x400, &[0x400]).is_empty(),
            "entrada igual à saída"
        );
        // ROM sem a forma: zero candidatos, sem erro
        assert_eq!(
            e.candidates(&vec![0x4Eu8; 4096], "x")
                .unwrap()
                .unwrap()
                .len(),
            0
        );
        // perfil vinculado a outra ROM não é tentado
        let mut v: Value = serde_json::from_str(SPEC).unwrap();
        v["rom_binding"] = json!({"mode": "sha256", "sha256": ["a".repeat(64)]});
        let bound =
            SemanticEngine::new(SemanticSpec::from_json(&v.to_string()).unwrap(), "h").unwrap();
        assert!(bound.candidates(&rom, &sha).unwrap().is_none());
        assert_eq!(
            bound.recover_declared(&rom, &sha, 0x400, &[0x444]).err(),
            Some(ProfileError::RomNotBound)
        );
    }

    fn node<'a>(g: &'a mut Value, id: &str) -> &'a mut Value {
        g["nodes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|n| n["id"] == id)
            .unwrap()
    }

    #[test]
    fn projecao_compartilhada_tem_vinculo_e_a_revisao_rederiva_da_rom() {
        let e = engine();
        let rom = authored_gate_rom();
        let sha = sha256_hex(&rom);
        let inst = e.recover_declared(&rom, &sha, 0x400, &[0x444]).unwrap();
        let text = e.graph_json(&inst, &sha);
        let mut g: Value = serde_json::from_str(&text).unwrap();
        let ev = node(&mut g, "entry")["params"].clone();
        assert_eq!(ev["perfil"], e.spec().id.as_str());
        assert_eq!(ev["perfil_sha256"], e.profile_sha256());
        assert_eq!(
            (ev["entry"].clone(), ev["instancia_param"].clone()),
            (json!(0x400), json!("entry"))
        );
        assert_eq!(
            (ev["saidas"].clone(), ev["selecao"].clone()),
            (json!("0x000444"), json!("declared_region"))
        );
        let cmp = node(&mut g, "compare")["params"].clone();
        assert_eq!(
            (
                cmp["editavel"].clone(),
                cmp["campo"].clone(),
                cmp["campo_param"].clone()
            ),
            (json!(1), json!("threshold"), json!("threshold"))
        );
        assert_eq!(
            (
                cmp["threshold"].clone(),
                cmp["valor_original"].clone(),
                cmp["faixa"].clone()
            ),
            (json!(40), json!(40), json!("-128..127"))
        );
        assert_eq!(cmp["rom_offsets"], "0x00041B");
        // todo parâmetro é escalar (o editor só guarda texto e número)
        assert!(g["nodes"].as_array().unwrap().iter().all(|n| n["params"]
            .as_object()
            .unwrap()
            .values()
            .all(|v| v.is_string() || v.is_number())));
        assert_eq!(node(&mut g, "set_call")["params"]["understood"], "false");
        // sem mudanças: canônico
        let (r, _) = e.review(&rom, &sha, 0x400, &text).unwrap();
        assert!(
            r.structural_ok && r.problems.is_empty() && r.changes.is_empty() && !r.legacy_binding,
            "{r:?}"
        );
        // só o limiar: aceito
        node(&mut g, "compare")["params"]["threshold"] = json!(100);
        node(&mut g, "compare")["x"] = json!(999);
        let (r, _) = e.review(&rom, &sha, 0x400, &g.to_string()).unwrap();
        assert!(r.accepted());
        assert_eq!(r.changes, [("threshold".to_string(), 100)]);
        // qualquer outra coisa é mudança de lógica que NÃO é compilada
        let refused = |name: &str, f: &dyn Fn(&mut Value)| {
            let mut t: Value = serde_json::from_str(&text).unwrap();
            node(&mut t, "compare")["params"]["threshold"] = json!(100);
            f(&mut t);
            let (r, _) = e
                .review(&rom, &sha, 0x400, &t.to_string())
                .unwrap_or_else(|x| panic!("{name}: {x:?}"));
            assert!(!r.accepted(), "{name}: aceito indevidamente");
            (r.differences, r.problems)
        };
        refused("operador", &|t| {
            node(t, "compare")["params"]["operator"] = json!(">=")
        });
        refused("endereço do contador", &|t| {
            node(t, "counter_add")["params"]["address"] = json!("0xFF9999")
        });
        refused("passo", &|t| {
            node(t, "counter_add")["params"]["step"] = json!(1)
        });
        refused("valor de estado", &|t| {
            node(t, "set_write")["params"]["value"] = json!(1)
        });
        refused("bit da guarda", &|t| {
            node(t, "guard")["params"]["bit"] = json!(3)
        });
        refused("mapeamento", &|t| {
            node(t, "compare")["params"]["source_mappings"] = json!("[]")
        });
        refused("chamada externa removida", &|t| {
            t["nodes"]
                .as_array_mut()
                .unwrap()
                .retain(|n| n["id"] != "set_call")
        });
        refused("chamada marcada como compreendida", &|t| {
            node(t, "set_call")["params"]["understood"] = json!("true")
        });
        refused("conexão trocada", &|t| {
            t["edges"][0]["toNode"] = json!("compare")
        });
        refused("faixa alargada", &|t| {
            node(t, "compare")["params"]["faixa"] = json!("-9999..9999")
        });
        refused("ROM declarada", &|t| {
            node(t, "entry")["params"]["rom_sha256"] = json!("f".repeat(64))
        });
        refused("perfil declarado", &|t| {
            node(t, "entry")["params"]["perfil"] = json!("m68k.outro.v1")
        });
        let (_, p) = refused("fora da faixa", &|t| {
            node(t, "compare")["params"]["threshold"] = json!(128)
        });
        assert_eq!(p, ["valor de threshold fora da faixa -128..127"]);
        let (_, p) = refused("não inteiro", &|t| {
            node(t, "compare")["params"]["threshold"] = json!("x")
        });
        assert_eq!(p, ["valor não inteiro em threshold"]);
        // saídas adulteradas no grafo: a região deixa de ser recuperável
        let mut t: Value = serde_json::from_str(&text).unwrap();
        node(&mut t, "entry")["params"]["saidas"] = json!("0x0007FE");
        assert!(matches!(
            e.review(&rom, &sha, 0x400, &t.to_string()),
            Err(ProfileError::RegionRefused(_))
        ));
        // outro arquivo de perfil
        let mut v: Value = serde_json::from_str(SPEC).unwrap();
        v["revision"] = json!(2);
        let other = SemanticEngine::new(
            SemanticSpec::from_json(&v.to_string()).unwrap(),
            &sha256_hex(v.to_string().as_bytes()),
        )
        .unwrap();
        assert_eq!(
            other
                .review(&rom, &sha, 0x400, &text)
                .err()
                .map(|x| x.code()),
            Some("profile-mismatch")
        );
    }

    #[test]
    fn plano_de_edicao_vem_do_analisador_e_vira_patch_do_nucleo_compartilhado() {
        let e = engine();
        let rom = authored_gate_rom();
        let sha = sha256_hex(&rom);
        let inst = e.recover_declared(&rom, &sha, 0x400, &[0x444]).unwrap();
        let (patches, checksum) = e.plan(&rom, &sha, &inst, 100).unwrap();
        // a ROM autoral tem checksum de cabeçalho válido: ele também é atualizado, e isso é dito
        assert!(checksum);
        assert_eq!(
            patches
                .iter()
                .map(|p| (p.offset, p.old.clone()))
                .collect::<Vec<_>>()[1],
            (0x41B, vec![40])
        );
        assert_eq!(patches[1].new, vec![100]);
        assert_eq!(
            (
                patches[0].offset >= 0x18E && patches[0].offset < 0x190,
                patches.len()
            ),
            (true, 2)
        );
        let copy = apply(&rom, &patches).unwrap();
        assert_eq!(copy.len(), rom.len());
        let changed: Vec<usize> = (0..rom.len()).filter(|i| rom[*i] != copy[*i]).collect();
        assert!(
            changed
                .iter()
                .all(|i| *i == 0x41B || (0x18E..0x190).contains(i)),
            "{changed:x?}"
        );
        assert_eq!(
            ips_apply_strict(&rom, &ips(&patches).unwrap()).unwrap(),
            copy
        );
        // a cópia, re-analisada do zero, tem o novo limiar e o resto da regra igual
        let again = e
            .recover_declared(&copy, &sha256_hex(&copy), 0x400, &[0x444])
            .unwrap();
        assert_eq!(again.value, 100);
        assert_eq!(
            again
                .operations
                .iter()
                .filter(|o| o.id != "compare")
                .collect::<Vec<_>>(),
            inst.operations
                .iter()
                .filter(|o| o.id != "compare")
                .collect::<Vec<_>>()
        );
        // fronteiras da faixa: cabem; um além: recusa
        assert!(e.plan(&rom, &sha, &inst, -128).is_ok() && e.plan(&rom, &sha, &inst, 127).is_ok());
        assert_eq!(
            e.plan(&rom, &sha, &inst, 128).err(),
            Some(ProfileError::OutOfRange)
        );
        assert_eq!(
            e.plan(&rom, &sha, &inst, -129).err(),
            Some(ProfileError::OutOfRange)
        );
        assert_eq!(
            e.plan(&rom, &sha, &inst, 40).err(),
            Some(ProfileError::NoChange)
        );
        // identidade errada da base: o analisador recusa
        assert!(matches!(
            e.plan(&rom, &"0".repeat(64), &inst, 100),
            Err(ProfileError::RegionRefused(_))
        ));
        // fixture sem checksum válido: só o imediato muda
        let base = crate_fixture("goal_original_t6.hex");
        let bsha = sha256_hex(&base);
        let bi = e.candidates(&base, &bsha).unwrap().unwrap().remove(0);
        let (bp, bck) = e.plan(&base, &bsha, &bi, 12).unwrap();
        assert!(!bck);
        assert_eq!(
            bp.iter()
                .map(|p| (p.offset, p.old.clone(), p.new.clone()))
                .collect::<Vec<_>>(),
            [(0x961, vec![5], vec![11])]
        );
    }

    /// Conformidade com o editor: o MESMO arquivo é hidratado pelo vitest (`profileGraphBridge.test.ts`),
    /// que recalcula a assinatura estrutural gravada aqui. Regerar: `REX_WRITE_CONFORMANCE=1 cargo test`.
    #[test]
    fn grafo_semantico_de_conformidade_com_o_editor() {
        let e = engine();
        let rom = authored_gate_rom();
        let sha = sha256_hex(&rom);
        let inst = e.recover_declared(&rom, &sha, 0x400, &[0x444]).unwrap();
        let text = e.graph_json(&inst, &sha) + "\n";
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(
            "../data/rex_profiles/integration_20261009/conformidade/grafo-gate.nodegraph.json",
        );
        if std::env::var("REX_WRITE_CONFORMANCE").is_ok() {
            std::fs::write(&path, &text).unwrap();
        }
        assert_eq!(
            std::fs::read_to_string(&path).expect("arquivo de conformidade"),
            text
        );
    }
}
