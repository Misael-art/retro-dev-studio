//! Perfil REX como DADO — contrato `rex-profile-spec/v2`.
//!
//! Esquema + validação estrita. Quem interpreta o dado é `rex_profile_engine`; quem o carrega é
//! `rex_profile_registry`. O perfil é só dado: não há script, expressão nem código carregável. Todo texto
//! dinâmico é uma lista de partes TIPADAS (`TextPart`) com um conjunto fechado de formatos; nenhuma string é
//! interpretada. Qualquer chave desconhecida, versão desconhecida, referência inválida, duplicidade, overflow
//! ou estrutura acima dos limites é RECUSADA com um código de regra (`SpecError::Invalid { rule, .. }`).
//!
//! Três noções de endereço nunca se confundem: OFFSET DE ARQUIVO (onde os bytes estão no arquivo da ROM),
//! ENDEREÇO DE BARRAMENTO (o que a CPU vê; `rom_mapping` liga os dois) e DESLOCAMENTO DE ENDEREÇO EFETIVO
//! (parcela `d16(An)` cuja base só existe em execução). O papel de cada captura (`CaptureRole`) diz qual é.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use super::rex_edit::FieldEnc;
use super::rex_evidence::{EvidenceAxis, EvidenceLevel};
use super::rex_sigscan::Pattern;

pub const SPEC_SCHEMA: &str = "rex-profile-spec/v2";
pub const MAX_SPEC_BYTES: usize = 256 * 1024;
pub const MAX_PATTERNS: usize = 32;
pub const MAX_SOURCES: usize = 8;
pub const MAX_CAPTURES: usize = 64;
pub const MAX_CONSTRAINTS: usize = 64;
pub const MAX_RELATIONS: usize = 16;
pub const MAX_FIELDS: usize = 64;
pub const MAX_NODES: usize = 128;
pub const MAX_EDGES: usize = 256;
pub const MAX_TEXT_PARTS: usize = 16;
pub const MAX_TEXT_LEN: usize = 512;
pub const MAX_LIST: usize = 64;
/// Tetos absolutos dos limites de trabalho que um perfil pode declarar.
pub const HARD_MAX_ROM_BYTES: u64 = 32 * 1024 * 1024;
pub const HARD_MAX_MATCHES: usize = super::rex_sigscan::MAX_MATCHES;
pub const HARD_MAX_INSTANCES: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpecStatus {
    Draft,
    Experimental,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Endianness {
    Big,
    Little,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArchSpec {
    pub cpu: String,
    pub endianness: Endianness,
    /// Alinhamento das instruções em bytes (o localizador só testa offsets múltiplos dele).
    pub instruction_alignment: u32,
    pub bus_address_bits: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MappingKind {
    Linear,
}

/// Liga OFFSET DE ARQUIVO a ENDEREÇO DE BARRAMENTO: `barramento = bus_base + (arquivo - file_header_bytes)`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RomMapping {
    pub kind: MappingKind,
    pub file_header_bytes: u64,
    pub bus_base: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Provenance {
    pub author: String,
    /// Data `AAAA-MM-DD`.
    pub created: String,
    /// Documentos/relatórios de que o perfil deriva (caminhos do repositório ou ids de evidência).
    pub derived_from: Vec<String>,
    pub notes: String,
}

/// Vínculo com a ROM: por assinatura (qualquer ROM em que a forma casa) ou restrito a ROMs por SHA-256.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase", deny_unknown_fields)]
pub enum RomBinding {
    Signature,
    Sha256 { sha256: Vec<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkLimits {
    pub max_rom_bytes: u64,
    pub max_matches_per_pattern: usize,
    pub max_instances: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureRole {
    /// Constante dentro da instrução/dado.
    Immediate,
    /// Deslocamento de endereço efetivo (`d16(An)`): a base só existe em execução.
    EaDisplacement,
    /// Endereço absoluto de barramento (2 bytes = forma curta com extensão de sinal; 4 bytes = longa).
    BusAddress,
    /// Bytes capturados só para consistência; nenhuma interpretação é afirmada.
    Opaque,
}

/// Tipo de uma captura. Vale para a captura de mesmo nome em TODOS os padrões.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CaptureSpec {
    pub name: String,
    pub width: u8,
    pub signed: bool,
    pub endianness: Endianness,
    pub role: CaptureRole,
}

impl CaptureSpec {
    /// Codificação da captura (largura, sinal, endianess) no formato do núcleo de edição.
    pub fn enc(&self) -> FieldEnc {
        FieldEnc {
            width: self.width,
            signed: self.signed,
            little: self.endianness == Endianness::Little,
        }
    }

    /// Valor tipado a partir dos bytes como estão no arquivo.
    pub fn decode(&self, bytes: &[u8]) -> i64 {
        self.enc().decode(bytes)
    }

    /// Faixa representável pela largura e pelo sinal.
    pub fn range(&self) -> (i64, i64) {
        self.enc().range()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatternSpec {
    pub id: String,
    /// Formas alternativas na sintaxe de `rex_sigscan` (o motor une as ocorrências).
    pub sources: Vec<String>,
}

/// Restrição sobre capturas de UMA ocorrência; a ocorrência que a viola é descartada (e contada).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ConstraintSpec {
    Range {
        id: String,
        pattern: String,
        capture: String,
        min: i64,
        max: i64,
    },
    Distinct {
        id: String,
        pattern: String,
        a: String,
        b: String,
    },
    MultipleOf {
        id: String,
        pattern: String,
        capture: String,
        modulo: i64,
    },
}

impl ConstraintSpec {
    pub fn id(&self) -> &str {
        match self {
            ConstraintSpec::Range { id, .. }
            | ConstraintSpec::Distinct { id, .. }
            | ConstraintSpec::MultipleOf { id, .. } => id,
        }
    }
    pub fn pattern(&self) -> &str {
        match self {
            ConstraintSpec::Range { pattern, .. }
            | ConstraintSpec::Distinct { pattern, .. }
            | ConstraintSpec::MultipleOf { pattern, .. } => pattern,
        }
    }
}

/// O que fazer quando dois candidatos estão à MESMA distância mínima.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TieRule {
    /// O de menor offset vence (comportamento histórico do primeiro perfil).
    First,
    /// Ambiguidade: não liga a nenhum e registra o motivo.
    Refuse,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum RelationSpec {
    /// `inner` casa também dentro de `outer` a partir de `prefix_len`: a ocorrência de `outer` prevalece.
    Subsumes {
        id: String,
        outer: String,
        inner: String,
        prefix_len: usize,
    },
    /// Pareia cada ocorrência de `from` com a mais próxima de `to` cujas capturas `consistent_on` são
    /// iguais, dentro de `max_distance`; com `mutual`, `from` também tem de ser o mais próximo de `to`.
    Pair {
        id: String,
        from: Vec<String>,
        to: String,
        consistent_on: Vec<String>,
        max_distance: usize,
        mutual: bool,
        tie: TieRule,
    },
    /// Liga `to` ao `from` pareado: `to` posterior, a no máximo `max_distance`, com capturas iguais.
    Follow {
        id: String,
        from: String,
        to: String,
        consistent_on: Vec<String>,
        max_distance: usize,
        tie: TieRule,
    },
}

impl RelationSpec {
    pub fn id(&self) -> &str {
        match self {
            RelationSpec::Subsumes { id, .. }
            | RelationSpec::Pair { id, .. }
            | RelationSpec::Follow { id, .. } => id,
        }
    }
}

/// Campo editável: uma captura de papel `immediate`, com o domínio ACEITO pelo perfil (não é "seguro em
/// gameplay"). Largura, sinal e endianess vêm do tipo da captura.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FieldSpec {
    pub name: String,
    pub label: String,
    /// Padrões em que o campo pode aparecer; a captura tem de existir em TODOS.
    pub patterns: Vec<String>,
    pub capture: String,
    /// Offsets relativos ao início da ocorrência que são regravados junto (repetições da captura).
    pub extra_offsets: Vec<usize>,
    pub min: i64,
    pub max: i64,
    /// Relação que precisa valer para o campo existir.
    pub requires: Option<String>,
}

/// Condição sobre uma instância. Uma lista de condições é uma conjunção.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "if", rename_all = "snake_case", deny_unknown_fields)]
pub enum Condition {
    Link { id: String },
    NoLink { id: String },
    Field { name: String },
    NoField { name: String },
    AnchorPattern { id: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NumFmt {
    /// `0x1a`
    Hex,
    /// `1a`
    HexBare,
    /// `0x00001A`
    Hex6,
    Dec,
}

/// Parte de um texto. `of` é `"anchor"` ou o id de uma relação `pair`/`follow`; em `Offset`, `of` também
/// pode ser `"instance"` (offset de referência da instância) ou `"anchor_match"` (início da ocorrência).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "p", rename_all = "snake_case", deny_unknown_fields)]
pub enum TextPart {
    Lit {
        t: String,
        #[serde(default)]
        when: Vec<Condition>,
    },
    Capture {
        name: String,
        of: String,
        fmt: NumFmt,
    },
    Offset {
        of: String,
        fmt: NumFmt,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Scalar {
    Int(i64),
    Str(String),
}

/// Parâmetro de um nó: literal (`value`) OU texto com partes (`text`), nunca os dois.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ParamSpec {
    pub key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Scalar>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<Vec<TextPart>>,
}

/// Liga um nó `var_set` a um campo editável.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeFieldSpec {
    pub name: String,
    pub var_name: String,
    pub description: String,
}

/// Trecho da ROM (offset de arquivo) que o nó documenta: `base + delta`, `len` bytes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "base", rename_all = "lowercase", deny_unknown_fields)]
pub enum RomSpan {
    Instance {
        delta: i64,
        len: usize,
    },
    Field {
        field: String,
        delta: i64,
        len: usize,
    },
    Link {
        link: String,
        delta: i64,
        len: usize,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeSpec {
    pub id: String,
    /// Tipo de node JÁ EXISTENTE no editor (ver `node_ports`).
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub col: i32,
    pub row: i32,
    #[serde(default)]
    pub when: Vec<Condition>,
    #[serde(default)]
    pub params: Vec<ParamSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<NodeFieldSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rom_span: Option<RomSpan>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EdgeSpec {
    /// `[nó, porta de saída]`
    pub from: (String, String),
    /// `[nó, porta de entrada]`
    pub to: (String, String),
    #[serde(default)]
    pub when: Vec<Condition>,
}

/// Projeção da instância para o NodeGraph v1 do editor, só com tipos de node existentes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectionSpec {
    pub entry_node: String,
    /// Chave do parâmetro (no nó de entrada e nos metadados) que guarda o offset da instância.
    pub instance_param: String,
    pub nodes: Vec<NodeSpec>,
    pub edges: Vec<EdgeSpec>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NoteSpec {
    #[serde(default)]
    pub when: Vec<Condition>,
    pub text: Vec<TextPart>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DetailSpec {
    pub label: String,
    #[serde(default)]
    pub when: Vec<Condition>,
    pub text: Vec<TextPart>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScopeValues {
    pub field: String,
    pub values: Vec<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScopeRom {
    pub sha256: String,
    /// Offsets de ARQUIVO das instâncias em que a medição foi feita nesta ROM.
    pub instance_offsets: Vec<u64>,
}

/// Onde a afirmação vale: em quais ROMs e instâncias, com quais valores e sob que condições.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClaimScope {
    pub roms: Vec<ScopeRom>,
    pub values: Vec<ScopeValues>,
    pub conditions: String,
}

/// Afirmação de evidência obtida em EXECUÇÃO (consumo, efeito, reconstrução). Forma e consistência
/// estáticas não são declaradas: o motor as calcula por instância.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClaimSpec {
    pub id: String,
    pub level: EvidenceLevel,
    pub fields: Vec<String>,
    pub statement: String,
    pub scope: ClaimScope,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceSpec {
    pub claims: Vec<ClaimSpec>,
    /// O que continua desconhecido, em texto.
    pub unknown: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProfileSpec {
    pub schema: String,
    /// Identidade: `arch.nome.vN`.
    pub id: String,
    /// Revisão do DADO deste perfil (a identidade exata é o SHA-256 do arquivo).
    pub revision: u32,
    pub status: SpecStatus,
    /// Nome curto para a interface.
    pub title: String,
    pub summary: String,
    /// Marca usada no nome dos artefatos publicados.
    pub artifact_tag: String,
    pub arch: ArchSpec,
    pub rom_mapping: RomMapping,
    pub provenance: Provenance,
    pub rom_binding: RomBinding,
    pub work_limits: WorkLimits,
    pub captures: Vec<CaptureSpec>,
    pub patterns: Vec<PatternSpec>,
    pub constraints: Vec<ConstraintSpec>,
    pub relations: Vec<RelationSpec>,
    pub fields: Vec<FieldSpec>,
    pub projection: ProjectionSpec,
    pub notes: Vec<NoteSpec>,
    pub details: Vec<DetailSpec>,
    pub evidence: EvidenceSpec,
    /// Limites declarados em texto (o que NÃO está provado).
    pub limits: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpecError {
    TooLarge,
    Parse(String),
    /// Versão de esquema desconhecida (inclui `rex-profile-spec/v1`).
    WrongSchema(String),
    /// Regra de validação violada: `rule` é o código estável; `at` diz onde.
    Invalid {
        rule: &'static str,
        at: String,
    },
}

impl SpecError {
    pub fn rule(&self) -> &'static str {
        match self {
            SpecError::TooLarge => "too-large",
            SpecError::Parse(_) => "parse",
            SpecError::WrongSchema(_) => "wrong-schema",
            SpecError::Invalid { rule, .. } => rule,
        }
    }
}

impl std::fmt::Display for SpecError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpecError::TooLarge => write!(f, "perfil maior que {MAX_SPEC_BYTES} bytes"),
            SpecError::Parse(e) => write!(f, "JSON inválido para o contrato: {e}"),
            SpecError::WrongSchema(s) => {
                write!(
                    f,
                    "versão de esquema desconhecida: '{s}' (aceita: {SPEC_SCHEMA})"
                )
            }
            SpecError::Invalid { rule, at } => write!(f, "{rule}: {at}"),
        }
    }
}

pub(crate) fn bad<T>(rule: &'static str, at: impl Into<String>) -> Result<T, SpecError> {
    Err(SpecError::Invalid {
        rule,
        at: at.into(),
    })
}

/// Porta de um tipo de node: `(id, kind, dataType)`.
pub type Port = (&'static str, &'static str, Option<&'static str>);

/// Portas `(entradas, saídas)` dos tipos de node que a projeção pode usar. Tipo fora da tabela é recusado.
pub fn node_ports(node_type: &str) -> Option<(&'static [Port], &'static [Port])> {
    const EXEC: Port = ("exec", "exec", None);
    match node_type {
        "event_update" => Some((&[], &[EXEC])),
        "input_pressed" => Some((&[EXEC], &[EXEC])),
        "condition_compare" => Some((
            &[EXEC, ("a", "data", Some("int")), ("b", "data", Some("int"))],
            &[("true", "exec", None), ("false", "exec", None)],
        )),
        "var_set" => Some((&[EXEC, ("value", "data", Some("int"))], &[EXEC])),
        _ => None,
    }
}

/// Chaves de parâmetro que o motor escreve; um perfil não pode declará-las.
pub const RESERVED_PARAMS: [&str; 17] = [
    "origem",
    "rom_addr",
    "rom_bytes",
    "perfil",
    "rom_sha256",
    "ponte_edicao",
    "assinatura_estrutural",
    "rom_path",
    "perfil_sha256",
    "perfil_revisao",
    "perfil_dir",
    "instancia_param",
    "valor_original",
    "editavel",
    "campo",
    "faixa",
    "rom_offsets",
];

/// Capturas nomeadas (`{nome:N}`) de uma fonte de padrão com a largura, sem `_` e sem repetição.
pub fn capture_sizes(source: &str) -> Vec<(String, usize)> {
    let mut out: Vec<(String, usize)> = Vec::new();
    let mut rest = source;
    while let Some(i) = rest.find('{') {
        let after = &rest[i + 1..];
        let Some(j) = after.find('}') else { break };
        if let Some((name, n)) = after[..j].split_once(':') {
            if name != "_" && !out.iter().any(|(k, _)| k == name) {
                out.push((name.to_string(), n.parse().unwrap_or(0)));
            }
        }
        rest = &after[j + 1..];
    }
    out
}

pub fn capture_names(source: &str) -> Vec<String> {
    capture_sizes(source).into_iter().map(|(n, _)| n).collect()
}

pub(crate) fn ident(s: &str, max: usize) -> bool {
    !s.is_empty()
        && s.len() <= max
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

fn valid_id(id: &str) -> bool {
    // arch.nome.vN, minúsculas, dígitos, '_' e '.'
    let parts: Vec<&str> = id.split('.').collect();
    parts.len() == 3
        && parts.iter().all(|p| ident(p, 48))
        && parts[2].starts_with('v')
        && parts[2].len() > 1
        && parts[2][1..].chars().all(|c| c.is_ascii_digit())
}

pub fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64
        && s.chars()
            .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
}

pub(crate) fn text_ok(what: &str, s: &str) -> Result<(), SpecError> {
    if s.trim().is_empty() {
        return bad("empty-text", what);
    }
    if s.len() > MAX_TEXT_LEN {
        return bad("limit-exceeded", format!("{what}: texto > {MAX_TEXT_LEN}"));
    }
    Ok(())
}

pub(crate) fn limit(what: &str, n: usize, max: usize) -> Result<(), SpecError> {
    if n > max {
        bad("limit-exceeded", format!("{what}: {n} > {max}"))
    } else {
        Ok(())
    }
}

pub(crate) fn unique<'a>(
    what: &'static str,
    ids: impl Iterator<Item = &'a str>,
) -> Result<(), SpecError> {
    let mut seen = HashSet::new();
    for id in ids {
        if !seen.insert(id) {
            return bad("duplicate", format!("{what} '{id}'"));
        }
    }
    Ok(())
}

/// Cabeçalho comum a TODO perfil, qualquer que seja a classe (esquema): identidade, revisão, textos,
/// arquitetura, procedência, vínculo com a ROM e limites declarados.
pub(crate) struct Header<'a> {
    pub id: &'a str,
    pub revision: u32,
    pub title: &'a str,
    pub summary: &'a str,
    pub artifact_tag: &'a str,
    pub arch: &'a ArchSpec,
    pub provenance: &'a Provenance,
    pub rom_binding: &'a RomBinding,
    pub limits: &'a [String],
}

pub(crate) fn validate_header(h: &Header<'_>) -> Result<(), SpecError> {
    if !valid_id(h.id) {
        return bad("bad-id", h.id.to_string());
    }
    if h.revision == 0 {
        return bad("bad-revision", "revision deve ser >= 1");
    }
    text_ok("title", h.title)?;
    text_ok("summary", h.summary)?;
    if h.artifact_tag.is_empty()
        || h.artifact_tag.len() > 16
        || !h
            .artifact_tag
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    {
        return bad("bad-artifact-tag", h.artifact_tag.to_string());
    }
    // arquitetura: só o que o localizador realmente faz é aceito
    if h.arch.cpu != "m68k"
        || h.arch.endianness != Endianness::Big
        || h.arch.instruction_alignment != 2
        || h.arch.bus_address_bits != 24
    {
        return bad("unsupported-arch", format!("{:?}", h.arch));
    }
    if !h.id.starts_with(&format!("{}.", h.arch.cpu)) {
        return bad("bad-id", "o id deve começar pela arquitetura");
    }
    // procedência
    text_ok("provenance.author", &h.provenance.author)?;
    let d = h.provenance.created.as_bytes();
    if d.len() != 10
        || d[4] != b'-'
        || d[7] != b'-'
        || !d
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    {
        return bad("bad-provenance", "created deve ser AAAA-MM-DD");
    }
    limit(
        "provenance.derived_from",
        h.provenance.derived_from.len(),
        MAX_LIST,
    )?;
    if h.provenance.derived_from.is_empty() {
        return bad("bad-provenance", "derived_from vazio");
    }
    for r in &h.provenance.derived_from {
        text_ok("provenance.derived_from", r)?;
    }
    if h.provenance.notes.len() > MAX_TEXT_LEN {
        return bad("limit-exceeded", "provenance.notes");
    }
    if let RomBinding::Sha256 { sha256 } = h.rom_binding {
        limit("rom_binding.sha256", sha256.len(), MAX_LIST)?;
        if sha256.is_empty() || !sha256.iter().all(|s| is_sha256_hex(s)) {
            return bad("bad-rom-binding", "sha256 vazio ou malformado");
        }
        unique("rom_binding.sha256", sha256.iter().map(String::as_str))?;
    }
    if h.limits.is_empty() {
        return bad("no-limits", "limits vazio");
    }
    limit("limits", h.limits.len(), MAX_LIST)?;
    for l in h.limits {
        text_ok("limits", l)?;
    }
    Ok(())
}

/// Visão das relações que a validação e o motor usam.
struct Shape<'a> {
    pair_id: &'a str,
    anchors: &'a [String],
    pair_to: &'a str,
    /// id da relação -> padrão alvo (`pair` e `follow`).
    link_target: HashMap<&'a str, &'a str>,
}

impl ProfileSpec {
    pub fn from_json(text: &str) -> Result<ProfileSpec, SpecError> {
        if text.len() > MAX_SPEC_BYTES {
            return Err(SpecError::TooLarge);
        }
        #[derive(Deserialize)]
        struct Head {
            schema: String,
        }
        // a versão é lida antes de tudo: um esquema desconhecido é recusado como tal, não como "campo faltando"
        let head: Head = serde_json::from_str(text).map_err(|e| SpecError::Parse(e.to_string()))?;
        if head.schema != SPEC_SCHEMA {
            return Err(SpecError::WrongSchema(head.schema));
        }
        let spec: ProfileSpec =
            serde_json::from_str(text).map_err(|e| SpecError::Parse(e.to_string()))?;
        spec.validate()?;
        Ok(spec)
    }

    pub fn field(&self, name: &str) -> Option<&FieldSpec> {
        self.fields.iter().find(|f| f.name == name)
    }

    pub fn capture(&self, name: &str) -> Option<&CaptureSpec> {
        self.captures.iter().find(|c| c.name == name)
    }

    /// Tipo do campo (o da sua captura).
    pub fn field_type(&self, f: &FieldSpec) -> Option<&CaptureSpec> {
        self.capture(&f.capture)
    }

    /// Endereço de barramento de um offset de arquivo, quando o mapeamento o cobre.
    pub fn file_to_bus(&self, file_offset: u64) -> Option<u64> {
        let rel = file_offset.checked_sub(self.rom_mapping.file_header_bytes)?;
        let bus = self.rom_mapping.bus_base.checked_add(rel)?;
        (bus < 1u64 << self.arch.bus_address_bits).then_some(bus)
    }

    /// Offset de arquivo de um endereço de barramento, se ele cai na ROM mapeada de `rom_len` bytes.
    pub fn bus_to_file(&self, bus: u64, rom_len: u64) -> Option<u64> {
        let rel = bus.checked_sub(self.rom_mapping.bus_base)?;
        let file = rel.checked_add(self.rom_mapping.file_header_bytes)?;
        (file < rom_len).then_some(file)
    }

    /// Endereço de barramento que uma captura `bus_address` designa (forma curta estende o sinal).
    pub fn bus_address_of(&self, cap: &CaptureSpec, bytes: &[u8]) -> u64 {
        let enc = FieldEnc {
            signed: cap.width < 4,
            ..cap.enc()
        };
        (enc.decode(bytes) as u64) & ((1u64 << self.arch.bus_address_bits) - 1)
    }

    fn shape(&self) -> Result<Shape<'_>, SpecError> {
        let mut pair = None;
        let mut link_target = HashMap::new();
        for r in &self.relations {
            match r {
                RelationSpec::Pair { id, from, to, .. } => {
                    if pair
                        .replace((id.as_str(), from.as_slice(), to.as_str()))
                        .is_some()
                    {
                        return bad("unsupported-shape", "mais de uma relação pair");
                    }
                    link_target.insert(id.as_str(), to.as_str());
                }
                RelationSpec::Follow { id, to, .. } => {
                    link_target.insert(id.as_str(), to.as_str());
                }
                RelationSpec::Subsumes { .. } => {}
            }
        }
        let Some((pair_id, anchors, pair_to)) = pair else {
            return bad("unsupported-shape", "sem relação pair (âncora ↔ alvo)");
        };
        Ok(Shape {
            pair_id,
            anchors,
            pair_to,
            link_target,
        })
    }

    pub fn validate(&self) -> Result<(), SpecError> {
        if self.schema != SPEC_SCHEMA {
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
        if self.rom_mapping.file_header_bytes > HARD_MAX_ROM_BYTES
            || self.rom_mapping.bus_base >= 1u64 << self.arch.bus_address_bits
        {
            return bad("bad-rom-mapping", format!("{:?}", self.rom_mapping));
        }
        // limites de trabalho
        let w = &self.work_limits;
        if w.max_rom_bytes == 0
            || w.max_rom_bytes > HARD_MAX_ROM_BYTES
            || w.max_matches_per_pattern == 0
            || w.max_matches_per_pattern > HARD_MAX_MATCHES
            || w.max_instances == 0
            || w.max_instances > HARD_MAX_INSTANCES
        {
            return bad("bad-work-limits", format!("{w:?}"));
        }
        // capturas tipadas
        limit("captures", self.captures.len(), MAX_CAPTURES)?;
        unique("captura", self.captures.iter().map(|c| c.name.as_str()))?;
        for c in &self.captures {
            if !ident(&c.name, 16) {
                return bad("bad-capture", c.name.clone());
            }
            if ![1, 2, 4].contains(&c.width) {
                return bad("bad-capture", format!("{}: largura {}", c.name, c.width));
            }
            if c.role == CaptureRole::BusAddress && (c.width == 1 || c.signed) {
                return bad(
                    "bad-capture",
                    format!(
                        "{}: endereço de barramento tem 2 ou 4 bytes e é declarado sem sinal",
                        c.name
                    ),
                );
            }
        }
        // padrões
        if self.patterns.is_empty() {
            return bad("no-patterns", "patterns vazio");
        }
        limit("patterns", self.patterns.len(), MAX_PATTERNS)?;
        unique("padrão", self.patterns.iter().map(|p| p.id.as_str()))?;
        let mut pat_caps: HashMap<&str, Vec<HashSet<String>>> = HashMap::new();
        let mut pat_len: HashMap<&str, usize> = HashMap::new();
        let mut used_caps: HashSet<String> = HashSet::new();
        for p in &self.patterns {
            if !ident(&p.id, 32) {
                return bad("bad-id", format!("padrão '{}'", p.id));
            }
            if p.sources.is_empty() {
                return bad("pattern-without-sources", p.id.clone());
            }
            limit("sources", p.sources.len(), MAX_SOURCES)?;
            unique("fonte de padrão", p.sources.iter().map(String::as_str))?;
            let mut shortest = usize::MAX;
            for s in &p.sources {
                let parsed = Pattern::parse(s).map_err(|e| SpecError::Invalid {
                    rule: "pattern-invalid",
                    at: format!("{}: {e:?}", p.id),
                })?;
                shortest = shortest.min(parsed.len());
                let sizes = capture_sizes(s);
                for (name, n) in &sizes {
                    let Some(c) = self.capture(name) else {
                        return bad("unknown-capture", format!("{}: '{name}' sem tipo", p.id));
                    };
                    if usize::from(c.width) != *n {
                        return bad(
                            "capture-width-mismatch",
                            format!(
                                "{}: '{name}' tem {n} byte(s) no padrão e {} no tipo",
                                p.id, c.width
                            ),
                        );
                    }
                    used_caps.insert(name.clone());
                }
                pat_caps
                    .entry(p.id.as_str())
                    .or_default()
                    .push(sizes.into_iter().map(|(n, _)| n).collect());
            }
            pat_len.insert(p.id.as_str(), shortest);
        }
        if let Some(c) = self.captures.iter().find(|c| !used_caps.contains(&c.name)) {
            return bad("unused-capture", c.name.clone());
        }
        // captura disponível em TODAS as formas alternativas de um padrão
        let has_cap = |pat: &str, cap: &str| -> bool {
            pat_caps
                .get(pat)
                .is_some_and(|forms| forms.iter().all(|f| f.contains(cap)))
        };
        let need_pat = |ctx: &str, id: &str| -> Result<(), SpecError> {
            if pat_len.contains_key(id) {
                Ok(())
            } else {
                bad("unknown-pattern", format!("{ctx}: '{id}'"))
            }
        };
        let need_cap = |ctx: &str, pat: &str, cap: &str| -> Result<(), SpecError> {
            if has_cap(pat, cap) {
                Ok(())
            } else {
                bad("unknown-capture", format!("{ctx}: '{cap}' em '{pat}'"))
            }
        };
        // restrições entre capturas
        limit("constraints", self.constraints.len(), MAX_CONSTRAINTS)?;
        unique("restrição", self.constraints.iter().map(|c| c.id()))?;
        for c in &self.constraints {
            if !ident(c.id(), 32) {
                return bad("bad-id", format!("restrição '{}'", c.id()));
            }
            need_pat(c.id(), c.pattern())?;
            match c {
                ConstraintSpec::Range {
                    id,
                    pattern,
                    capture,
                    min,
                    max,
                } => {
                    need_cap(id, pattern, capture)?;
                    let (lo, hi) = self
                        .capture(capture)
                        .map(CaptureSpec::range)
                        .unwrap_or((0, 0));
                    if min > max {
                        return bad("domain-inverted", format!("restrição '{id}'"));
                    }
                    if *min < lo || *max > hi {
                        return bad("domain-overflow", format!("restrição '{id}'"));
                    }
                }
                ConstraintSpec::Distinct { id, pattern, a, b } => {
                    need_cap(id, pattern, a)?;
                    need_cap(id, pattern, b)?;
                    if a == b {
                        return bad("bad-constraint", format!("'{id}': a == b"));
                    }
                }
                ConstraintSpec::MultipleOf {
                    id,
                    pattern,
                    capture,
                    modulo,
                } => {
                    need_cap(id, pattern, capture)?;
                    if *modulo < 2 {
                        return bad("bad-constraint", format!("'{id}': modulo < 2"));
                    }
                }
            }
        }
        // relações
        limit("relations", self.relations.len(), MAX_RELATIONS)?;
        unique("relação", self.relations.iter().map(|r| r.id()))?;
        for r in &self.relations {
            if !ident(r.id(), 32) {
                return bad("bad-id", format!("relação '{}'", r.id()));
            }
            match r {
                RelationSpec::Subsumes {
                    id,
                    outer,
                    inner,
                    prefix_len,
                } => {
                    need_pat(id, outer)?;
                    need_pat(id, inner)?;
                    if *prefix_len == 0 || *prefix_len >= pat_len[outer.as_str()] {
                        return bad("subsumes-bad-prefix", id.clone());
                    }
                }
                RelationSpec::Pair {
                    id,
                    from,
                    to,
                    consistent_on,
                    max_distance,
                    ..
                } => {
                    if *max_distance == 0 {
                        return bad("relation-bad-distance", id.clone());
                    }
                    if consistent_on.is_empty() || from.is_empty() {
                        return bad("relation-empty-consistency", id.clone());
                    }
                    unique("âncora", from.iter().map(String::as_str))?;
                    need_pat(id, to)?;
                    for f in from {
                        need_pat(id, f)?;
                        if f == to {
                            return bad(
                                "incompatible-pairing",
                                format!("'{id}': '{f}' é âncora e alvo"),
                            );
                        }
                        for c in consistent_on {
                            need_cap(id, f, c)?;
                        }
                    }
                    for c in consistent_on {
                        need_cap(id, to, c)?;
                    }
                }
                RelationSpec::Follow {
                    id,
                    from,
                    to,
                    consistent_on,
                    max_distance,
                    ..
                } => {
                    if *max_distance == 0 {
                        return bad("relation-bad-distance", id.clone());
                    }
                    if consistent_on.is_empty() {
                        return bad("relation-empty-consistency", id.clone());
                    }
                    need_pat(id, from)?;
                    need_pat(id, to)?;
                    for c in consistent_on {
                        need_cap(id, from, c)?;
                        need_cap(id, to, c)?;
                    }
                }
            }
        }
        // forma de relações que o motor executa (classe v2)
        let shape = self.shape()?;
        let mut n_sub = 0;
        for r in &self.relations {
            match r {
                RelationSpec::Subsumes { outer, inner, .. } => {
                    n_sub += 1;
                    if n_sub > 1 {
                        return bad("unsupported-shape", "mais de uma relação subsumes");
                    }
                    if !shape.anchors.contains(outer) || !shape.anchors.contains(inner) {
                        return bad(
                            "unsupported-shape",
                            "subsumes entre padrões que não são âncoras do pair",
                        );
                    }
                }
                RelationSpec::Follow { from, to, .. } => {
                    if from != shape.pair_to {
                        return bad("unsupported-shape", "follow que não parte do alvo do pair");
                    }
                    if shape.anchors.contains(to) || to == shape.pair_to {
                        return bad(
                            "incompatible-pairing",
                            "follow aponta para âncora ou para o alvo do pair",
                        );
                    }
                }
                RelationSpec::Pair { .. } => {}
            }
        }
        let _ = shape.pair_id;
        // campos
        if self.fields.is_empty() {
            return bad("no-fields", "fields vazio");
        }
        limit("fields", self.fields.len(), MAX_FIELDS)?;
        unique("campo", self.fields.iter().map(|f| f.name.as_str()))?;
        for f in &self.fields {
            if !ident(&f.name, 32) {
                return bad("bad-id", format!("campo '{}'", f.name));
            }
            text_ok("field.label", &f.label)?;
            if f.patterns.is_empty() {
                return bad("unknown-pattern", format!("campo '{}' sem padrão", f.name));
            }
            unique("padrão do campo", f.patterns.iter().map(String::as_str))?;
            let Some(ty) = self.capture(&f.capture) else {
                return bad(
                    "unknown-capture",
                    format!("campo '{}': '{}'", f.name, f.capture),
                );
            };
            if ty.role != CaptureRole::Immediate {
                return bad("field-not-immediate", f.name.clone());
            }
            for p in &f.patterns {
                need_pat(&f.name, p)?;
                need_cap(&f.name, p, &f.capture)?;
                if let Some(off) = f
                    .extra_offsets
                    .iter()
                    .find(|o| **o + usize::from(ty.width) > pat_len[p.as_str()])
                {
                    return bad("extra-offset-out-of-pattern", format!("{}: {off}", f.name));
                }
                // um campo vive na âncora ou no alvo de uma relação
                let in_anchor = shape.anchors.contains(p);
                let in_link = shape.link_target.values().any(|t| t == p);
                if !in_anchor && !in_link {
                    return bad("field-unreachable", format!("{}: padrão '{p}'", f.name));
                }
            }
            limit("extra_offsets", f.extra_offsets.len(), 8)?;
            // um offset relativo ao início da ocorrência só tem UM significado se o campo vive em um único
            // padrão de forma única; com formas alternativas ele apontaria para bytes diferentes em cada uma
            if !f.extra_offsets.is_empty()
                && (f.patterns.len() != 1
                    || pat_caps.get(f.patterns[0].as_str()).map(Vec::len) != Some(1))
            {
                return bad("extra-offset-ambiguous-form", f.name.clone());
            }
            if f.min > f.max {
                return bad("domain-inverted", f.name.clone());
            }
            let (lo, hi) = ty.range();
            if f.min < lo || f.max > hi {
                return bad(
                    "domain-overflow",
                    format!("{}: {}..{} não cabe em {lo}..{hi}", f.name, f.min, f.max),
                );
            }
            if let Some(req) = &f.requires {
                if !shape.link_target.contains_key(req.as_str()) {
                    return bad("unknown-relation", format!("{}: '{req}'", f.name));
                }
            }
        }
        // condições, textos, projeção
        let cond_ok = |ctx: &str, conds: &[Condition]| -> Result<(), SpecError> {
            limit("when", conds.len(), 8)?;
            for c in conds {
                match c {
                    Condition::Link { id } | Condition::NoLink { id } => {
                        if !shape.link_target.contains_key(id.as_str()) {
                            return bad("unknown-relation", format!("{ctx}: '{id}'"));
                        }
                    }
                    Condition::Field { name } | Condition::NoField { name } => {
                        if self.field(name).is_none() {
                            return bad("unknown-field", format!("{ctx}: '{name}'"));
                        }
                    }
                    Condition::AnchorPattern { id } => {
                        if !shape.anchors.contains(id) {
                            return bad("unknown-pattern", format!("{ctx}: '{id}' não é âncora"));
                        }
                    }
                }
            }
            Ok(())
        };
        let guarded = |conds: &[Condition], rel: &str| {
            conds
                .iter()
                .any(|c| matches!(c, Condition::Link { id } if id == rel))
        };
        let text_parts_ok =
            |ctx: &str, parts: &[TextPart], when: &[Condition]| -> Result<(), SpecError> {
                if parts.is_empty() {
                    return bad("empty-text", ctx);
                }
                limit("text", parts.len(), MAX_TEXT_PARTS)?;
                for part in parts {
                    match part {
                        TextPart::Lit { t, when: w } => {
                            if t.is_empty() || t.len() > MAX_TEXT_LEN {
                                return bad("empty-text", format!("{ctx}: parte literal"));
                            }
                            cond_ok(ctx, w)?;
                        }
                        TextPart::Capture { name, of, .. } => {
                            if of == "anchor" {
                                // com a condição `anchor_pattern`, só AQUELA âncora precisa ter a captura
                                let only: Vec<&String> = when
                                    .iter()
                                    .filter_map(|c| match c {
                                        Condition::AnchorPattern { id } => Some(id),
                                        _ => None,
                                    })
                                    .collect();
                                for a in shape
                                    .anchors
                                    .iter()
                                    .filter(|a| only.is_empty() || only.contains(a))
                                {
                                    need_cap(ctx, a, name)?;
                                }
                            } else {
                                let Some(target) = shape.link_target.get(of.as_str()) else {
                                    return bad("unknown-relation", format!("{ctx}: '{of}'"));
                                };
                                need_cap(ctx, target, name)?;
                                if !guarded(when, of) {
                                    return bad(
                                        "unguarded-reference",
                                        format!("{ctx}: usa '{of}' sem condição link"),
                                    );
                                }
                            }
                        }
                        TextPart::Offset { of, .. } => {
                            if of != "instance" && of != "anchor_match" {
                                if !shape.link_target.contains_key(of.as_str()) {
                                    return bad("unknown-relation", format!("{ctx}: '{of}'"));
                                }
                                if !guarded(when, of) {
                                    return bad(
                                        "unguarded-reference",
                                        format!("{ctx}: usa '{of}' sem condição link"),
                                    );
                                }
                            }
                        }
                    }
                }
                Ok(())
            };
        // campo presente em toda instância: todas as âncoras o têm e nada o condiciona
        let field_always = |name: &str| {
            self.field(name).is_some_and(|f| {
                f.requires.is_none() && shape.anchors.iter().all(|a| f.patterns.contains(a))
            })
        };
        let field_guarded = |conds: &[Condition], name: &str| {
            field_always(name)
                || conds
                    .iter()
                    .any(|c| matches!(c, Condition::Field { name: n } if n == name))
        };
        limit("notes", self.notes.len(), MAX_LIST)?;
        for (i, n) in self.notes.iter().enumerate() {
            let ctx = format!("notes[{i}]");
            cond_ok(&ctx, &n.when)?;
            text_parts_ok(&ctx, &n.text, &n.when)?;
        }
        limit("details", self.details.len(), MAX_LIST)?;
        unique("detalhe", self.details.iter().map(|d| d.label.as_str()))?;
        for d in &self.details {
            text_ok("detail.label", &d.label)?;
            cond_ok(&d.label, &d.when)?;
            text_parts_ok(&d.label, &d.text, &d.when)?;
        }
        let pr = &self.projection;
        if pr.nodes.is_empty() {
            return bad("no-projection", "projection.nodes vazio");
        }
        limit("projection.nodes", pr.nodes.len(), MAX_NODES)?;
        limit("projection.edges", pr.edges.len(), MAX_EDGES)?;
        unique("nó", pr.nodes.iter().map(|n| n.id.as_str()))?;
        if !ident(&pr.instance_param, 32) || RESERVED_PARAMS.contains(&pr.instance_param.as_str()) {
            return bad("bad-instance-param", pr.instance_param.clone());
        }
        let mut projected: HashSet<&str> = HashSet::new();
        for n in &pr.nodes {
            let ctx = format!("nó '{}'", n.id);
            if !ident(&n.id, 32) {
                return bad("bad-id", ctx);
            }
            text_ok("node.label", &n.label)?;
            if node_ports(&n.node_type).is_none() {
                return bad("unsupported-node-type", format!("{ctx}: '{}'", n.node_type));
            }
            if !(0..=64).contains(&n.col) || !(0..=64).contains(&n.row) {
                return bad("limit-exceeded", format!("{ctx}: col/row fora de 0..=64"));
            }
            cond_ok(&ctx, &n.when)?;
            limit("params", n.params.len(), 16)?;
            unique("parâmetro", n.params.iter().map(|p| p.key.as_str()))?;
            for p in &n.params {
                if !ident(&p.key, 32)
                    || RESERVED_PARAMS.contains(&p.key.as_str())
                    || p.key == pr.instance_param
                {
                    return bad("reserved-param", format!("{ctx}: '{}'", p.key));
                }
                match (&p.value, &p.text) {
                    (Some(Scalar::Str(s)), None) => {
                        if s.len() > MAX_TEXT_LEN {
                            return bad("limit-exceeded", format!("{ctx}: '{}'", p.key));
                        }
                    }
                    (Some(Scalar::Int(_)), None) => {}
                    (None, Some(parts)) => text_parts_ok(&ctx, parts, &n.when)?,
                    _ => {
                        return bad(
                            "bad-param",
                            format!("{ctx}: '{}' exige value OU text", p.key),
                        )
                    }
                }
            }
            if let Some(nf) = &n.field {
                if n.node_type != "var_set" || !n.params.is_empty() {
                    return bad("field-node-type", ctx);
                }
                if self.field(&nf.name).is_none() {
                    return bad("unknown-field", format!("{ctx}: '{}'", nf.name));
                }
                if !projected.insert(nf.name.as_str()) {
                    return bad(
                        "duplicate",
                        format!("campo '{}' projetado em dois nós", nf.name),
                    );
                }
                if !field_guarded(&n.when, &nf.name) {
                    return bad(
                        "unguarded-reference",
                        format!("{ctx}: campo '{}' sem condição field", nf.name),
                    );
                }
                text_ok("node.field.var_name", &nf.var_name)?;
                text_ok("node.field.description", &nf.description)?;
            }
            if let Some(span) = &n.rom_span {
                let len = match span {
                    RomSpan::Instance { len, .. } => *len,
                    RomSpan::Field { field, len, .. } => {
                        if self.field(field).is_none() {
                            return bad("unknown-field", format!("{ctx}: '{field}'"));
                        }
                        if !field_guarded(&n.when, field) {
                            return bad(
                                "unguarded-reference",
                                format!("{ctx}: rom_span de '{field}'"),
                            );
                        }
                        *len
                    }
                    RomSpan::Link { link, len, .. } => {
                        if !shape.link_target.contains_key(link.as_str()) {
                            return bad("unknown-relation", format!("{ctx}: '{link}'"));
                        }
                        if !guarded(&n.when, link) {
                            return bad(
                                "unguarded-reference",
                                format!("{ctx}: rom_span de '{link}'"),
                            );
                        }
                        *len
                    }
                };
                if len == 0 || len > 64 {
                    return bad("limit-exceeded", format!("{ctx}: rom_span.len"));
                }
            }
        }
        let Some(entry) = pr.nodes.iter().find(|n| n.id == pr.entry_node) else {
            return bad("unknown-node", format!("entry_node '{}'", pr.entry_node));
        };
        if !entry.when.is_empty() || entry.field.is_some() {
            return bad(
                "bad-entry-node",
                "o nó de entrada não pode ser condicional nem editável",
            );
        }
        let mut seen_edges = HashSet::new();
        for e in &pr.edges {
            let ctx = format!("aresta {}.{}>{}.{}", e.from.0, e.from.1, e.to.0, e.to.1);
            cond_ok(&ctx, &e.when)?;
            let port = |node: &str, port: &str, output: bool| -> Result<(), SpecError> {
                let Some(n) = pr.nodes.iter().find(|n| n.id == node) else {
                    return bad("unknown-node", ctx.clone());
                };
                let (ins, outs) = node_ports(&n.node_type).unwrap_or((&[], &[]));
                let set = if output { outs } else { ins };
                if set.iter().any(|(id, _, _)| *id == port) {
                    Ok(())
                } else {
                    bad("unknown-port", ctx.clone())
                }
            };
            port(&e.from.0, &e.from.1, true)?;
            port(&e.to.0, &e.to.1, false)?;
            if !seen_edges.insert((&e.from, &e.to, &e.when)) {
                return bad("duplicate", ctx);
            }
        }
        // evidência: afirmações obtidas em execução, com referência e escopo
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
            if !ident(&c.id, 32) {
                return bad("bad-id", ctx);
            }
            text_ok("claim.statement", &c.statement)?;
            if matches!(
                c.level.axis(),
                EvidenceAxis::Identity | EvidenceAxis::Static
            ) {
                return bad(
                    "claim-not-runtime",
                    format!("{ctx}: forma/consistência é calculada pelo motor"),
                );
            }
            limit("claim.refs", c.refs.len(), MAX_LIST)?;
            if c.refs.is_empty() || c.refs.iter().any(|r| r.trim().is_empty()) {
                return bad("claim-without-reference", ctx);
            }
            limit("claim.scope.roms", c.scope.roms.len(), MAX_LIST)?;
            if c.scope.roms.is_empty()
                || c.scope.roms.iter().any(|r| {
                    !is_sha256_hex(&r.sha256)
                        || r.instance_offsets.is_empty()
                        || r.instance_offsets.len() > MAX_LIST
                })
            {
                return bad("claim-without-scope", ctx);
            }
            unique(
                "claim.scope.roms",
                c.scope.roms.iter().map(|r| r.sha256.as_str()),
            )?;
            text_ok("claim.scope.conditions", &c.scope.conditions)?;
            if c.fields.is_empty() {
                return bad("claim-without-scope", format!("{ctx}: fields vazio"));
            }
            unique("claim.fields", c.fields.iter().map(String::as_str))?;
            for f in &c.fields {
                if self.field(f).is_none() {
                    return bad("unknown-field", format!("{ctx}: '{f}'"));
                }
            }
            limit("claim.scope.values", c.scope.values.len(), MAX_FIELDS)?;
            unique(
                "claim.scope.values",
                c.scope.values.iter().map(|v| v.field.as_str()),
            )?;
            for v in &c.scope.values {
                let Some(f) = self.field(&v.field).filter(|_| c.fields.contains(&v.field)) else {
                    return bad("unknown-field", format!("{ctx}: valores de '{}'", v.field));
                };
                limit("claim.scope.values.values", v.values.len(), MAX_LIST)?;
                if v.values.is_empty() {
                    return bad(
                        "claim-without-scope",
                        format!("{ctx}: '{}' sem valores", v.field),
                    );
                }
                if let Some(x) = v.values.iter().find(|x| **x < f.min || **x > f.max) {
                    return bad("measured-outside-domain", format!("{ctx}: {}={x}", v.field));
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::rex_profile_testkit::{mini, mini_with, text};
    use super::*;
    use serde_json::{json, Value};

    const JUMP: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../data/rex_profiles/specs/m68k.platformer_jump.v1.json"
    ));

    /// Regra pela qual o perfil mínimo, depois de `f`, é recusado.
    fn rule(f: impl FnOnce(&mut Value)) -> &'static str {
        match ProfileSpec::from_json(&text(&mini_with(f))) {
            Ok(_) => "aceito",
            Err(e) => e.rule(),
        }
    }

    #[test]
    fn perfis_validos_fazem_ida_e_volta() {
        for t in [JUMP.to_string(), text(&mini())] {
            let s = ProfileSpec::from_json(&t).expect("valida");
            let again = ProfileSpec::from_json(&serde_json::to_string(&s).unwrap()).unwrap();
            assert_eq!(s, again);
        }
        let j = ProfileSpec::from_json(JUMP).unwrap();
        assert_eq!(j.id, "m68k.platformer_jump.v1");
        assert_eq!(j.revision, 2);
        assert_eq!(j.status, SpecStatus::Experimental);
    }

    #[test]
    fn versao_desconhecida_e_recusada_como_versao_inclusive_a_v1() {
        for v in [
            "rex-profile-spec/v1",
            "rex-profile-spec/v3",
            "outra-coisa",
            "",
        ] {
            let e =
                ProfileSpec::from_json(&text(&mini_with(|m| m["schema"] = json!(v)))).unwrap_err();
            assert_eq!(e, SpecError::WrongSchema(v.to_string()));
        }
        // um arquivo v1 de verdade (campos de outro contrato) é recusado pela VERSÃO, não por "campo faltando"
        let v1 = r#"{"schema":"rex-profile-spec/v1","id":"m68k.x.v1","status":"draft","arch":"m68k","summary":"s","evidence_ceiling":"L2","patterns":[],"relations":[],"fields":[],"limits":["l"]}"#;
        assert_eq!(
            ProfileSpec::from_json(v1).unwrap_err().rule(),
            "wrong-schema"
        );
    }

    #[test]
    fn perfil_malformado_chave_desconhecida_e_chave_repetida_sao_recusados() {
        assert_eq!(ProfileSpec::from_json("{").unwrap_err().rule(), "parse");
        assert_eq!(ProfileSpec::from_json("[]").unwrap_err().rule(), "parse");
        assert_eq!(rule(|m| m["script"] = json!("rm -rf")), "parse");
        assert_eq!(rule(|m| m["fields"][0]["eval"] = json!("x+1")), "parse");
        assert_eq!(
            rule(|m| m["projection"]["nodes"][0]["code"] = json!("fn(){}")),
            "parse"
        );
        assert_eq!(
            rule(|m| {
                m.as_object_mut().unwrap().remove("limits");
            }),
            "parse"
        );
        // chave repetida no MESMO objeto (duas definições concorrentes) não é "a última vence"
        let dup =
            text(&mini()).replacen("\"revision\": 1,", "\"revision\": 1, \"revision\": 2,", 1);
        assert_eq!(ProfileSpec::from_json(&dup).unwrap_err().rule(), "parse");
        let big = format!("{}{}", text(&mini()), " ".repeat(MAX_SPEC_BYTES));
        assert_eq!(
            ProfileSpec::from_json(&big).unwrap_err(),
            SpecError::TooLarge
        );
    }

    #[test]
    fn duplicidades_sao_recusadas_uma_a_uma() {
        let dup = |path: &'static str| {
            move |m: &mut Value| {
                let arr = m.pointer_mut(path).unwrap().as_array_mut().unwrap();
                let first = arr[arr.len() - 1].clone();
                arr.push(first);
            }
        };
        assert_eq!(rule(dup("/captures")), "duplicate");
        assert_eq!(rule(dup("/patterns")), "duplicate");
        assert_eq!(rule(dup("/constraints")), "duplicate");
        assert_eq!(rule(dup("/relations")), "duplicate");
        assert_eq!(rule(dup("/fields")), "duplicate");
        assert_eq!(rule(dup("/projection/nodes")), "duplicate");
        assert_eq!(rule(dup("/projection/edges")), "duplicate");
        assert_eq!(rule(dup("/details")), "duplicate");
        assert_eq!(rule(dup("/patterns/0/sources")), "duplicate");
        assert_eq!(rule(dup("/projection/nodes/1/params")), "duplicate");
        // o MESMO campo em dois nós (ids diferentes): nenhum dos dois é "o certo"
        assert_eq!(
            rule(|m| {
                let mut n = m["projection"]["nodes"][2].clone();
                n["id"] = json!("n_lim2");
                m["projection"]["nodes"].as_array_mut().unwrap().push(n);
            }),
            "duplicate"
        );
    }

    #[test]
    fn referencias_invalidas_sao_recusadas() {
        assert_eq!(
            rule(|m| m["fields"][0]["capture"] = json!("nao_existe")),
            "unknown-capture"
        );
        assert_eq!(
            rule(|m| m["fields"][0]["patterns"] = json!(["zz"])),
            "unknown-pattern"
        );
        assert_eq!(
            rule(|m| m["fields"][1]["requires"] = json!("zz")),
            "unknown-relation"
        );
        assert_eq!(
            rule(|m| m["relations"][0]["to"] = json!("zz")),
            "unknown-pattern"
        );
        assert_eq!(
            rule(|m| m["relations"][0]["consistent_on"] = json!(["lim"])),
            "unknown-capture"
        );
        assert_eq!(
            rule(|m| m["constraints"][0]["capture"] = json!("low")),
            "unknown-capture"
        );
        assert_eq!(
            rule(|m| m["projection"]["entry_node"] = json!("zz")),
            "unknown-node"
        );
        assert_eq!(
            rule(|m| m["projection"]["edges"][0]["to"] = json!(["zz", "exec"])),
            "unknown-node"
        );
        assert_eq!(
            rule(|m| m["projection"]["edges"][0]["from"] = json!(["ev", "saida"])),
            "unknown-port"
        );
        assert_eq!(
            rule(|m| m["projection"]["edges"][0]["to"] = json!(["cmp", "true"])),
            "unknown-port"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][2]["field"]["name"] = json!("zz")),
            "unknown-field"
        );
        assert_eq!(
            rule(|m| m["notes"][0]["text"][1]["of"] = json!("zz")),
            "unknown-relation"
        );
        assert_eq!(
            rule(|m| m["details"][0]["text"][1]["name"] = json!("low")),
            "unknown-capture"
        );
        assert_eq!(
            rule(|m| m["notes"][1]["when"][0]["id"] = json!("zz")),
            "unknown-relation"
        );
        // captura do padrão sem tipo declarado, e tipo declarado sem uso
        assert_eq!(
            rule(|m| {
                m["captures"].as_array_mut().unwrap().remove(1);
            }),
            "unknown-capture"
        );
        assert_eq!(
            rule(|m| {
                m["captures"].as_array_mut().unwrap().push(json!({"name": "sobra", "width": 2, "signed": false, "endianness": "big", "role": "opaque"}))
            }),
            "unused-capture"
        );
        assert_eq!(
            rule(|m| m["captures"][0]["width"] = json!(4)),
            "capture-width-mismatch"
        );
    }

    #[test]
    fn offset_extra_e_captura_de_ancora_so_valem_onde_tem_um_unico_sentido() {
        // repetição declarada por offset num campo que vive em dois padrões (ou num padrão de duas formas):
        // o mesmo número apontaria para bytes diferentes em cada um
        let two_anchors = |m: &mut Value| {
            m["patterns"]
                .as_array_mut()
                .unwrap()
                .push(json!({"id": "a2", "sources": ["4E 71 30 3C {lim:2} 4A 6E {obj:2}"]}));
            m["relations"][0]["from"] = json!(["a", "a2"]);
            m["fields"][0]["patterns"] = json!(["a", "a2"]);
        };
        assert_eq!(rule(two_anchors), "aceito");
        assert_eq!(
            rule(|m| {
                two_anchors(m);
                m["fields"][0]["extra_offsets"] = json!([2]);
            }),
            "extra-offset-ambiguous-form"
        );
        assert_eq!(
            rule(|m| {
                m["patterns"][0]["sources"] = json!([
                    "30 3C {lim:2} 4A 6E {obj:2}",
                    "4E 71 30 3C {lim:2} 4A 6E {obj:2}"
                ]);
                m["fields"][0]["extra_offsets"] = json!([2]);
            }),
            "extra-offset-ambiguous-form"
        );
        // captura que só UMA das âncoras tem: sem condição é referência inválida; com `anchor_pattern`, vale
        let only_a2 = |guard: bool| {
            move |m: &mut Value| {
                m["captures"].as_array_mut().unwrap().push(json!({"name": "ext", "width": 2, "signed": false, "endianness": "big", "role": "opaque"}));
                m["patterns"].as_array_mut().unwrap().push(
                    json!({"id": "a2", "sources": ["4E B8 {ext:2} 30 3C {lim:2} 4A 6E {obj:2}"]}),
                );
                m["relations"][0]["from"] = json!(["a", "a2"]);
                m["fields"][0]["patterns"] = json!(["a", "a2"]);
                m["details"][0]["text"] =
                    json!([{"p": "capture", "name": "ext", "of": "anchor", "fmt": "hex"}]);
                if guard {
                    m["details"][0]["when"] = json!([{"if": "anchor_pattern", "id": "a2"}]);
                }
            }
        };
        assert_eq!(rule(only_a2(false)), "unknown-capture");
        assert_eq!(rule(only_a2(true)), "aceito");
    }

    #[test]
    fn referencia_a_ligacao_ou_campo_opcional_exige_condicao() {
        // texto que usa o alvo de uma relação sem `when: link` leria uma ligação que pode não existir
        assert_eq!(
            rule(|m| m["notes"][0]["text"][1] = json!({"p": "offset", "of": "p", "fmt": "hex"})),
            "unguarded-reference"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][3]["when"] = json!([])),
            "unguarded-reference"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][4]["when"] = json!([{"if": "field", "name": "top"}])),
            "unguarded-reference"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][0]["when"] = json!([{"if": "link", "id": "p"}])),
            "bad-entry-node"
        );
    }

    #[test]
    fn limites_numericos_e_overflow_sao_recusados() {
        assert_eq!(
            rule(|m| {
                m["fields"][0]["min"] = json!(10);
                m["fields"][0]["max"] = json!(5);
            }),
            "domain-inverted"
        );
        // domínio que não cabe na largura/sinal da captura
        assert_eq!(
            rule(|m| m["fields"][0]["max"] = json!(32768)),
            "domain-overflow"
        );
        assert_eq!(
            rule(|m| m["fields"][0]["min"] = json!(-32769)),
            "domain-overflow"
        );
        assert_eq!(
            rule(|m| m["fields"][1]["max"] = json!(256)),
            "domain-overflow"
        );
        assert_eq!(
            rule(|m| m["fields"][1]["min"] = json!(-1)),
            "domain-overflow"
        );
        assert_eq!(
            rule(|m| m["fields"][2]["max"] = json!(4_294_967_296i64)),
            "domain-overflow"
        );
        assert_eq!(
            rule(|m| m["constraints"][0]["max"] = json!(70000)),
            "domain-overflow"
        );
        // inteiro que não cabe no tipo do contrato nem chega à validação
        assert_eq!(
            ProfileSpec::from_json(&text(&mini()).replacen(
                "\"max\": 1000",
                "\"max\": 99999999999999999999",
                1
            ))
            .unwrap_err()
            .rule(),
            "parse"
        );
        assert_eq!(rule(|m| m["revision"] = json!(0)), "bad-revision");
        assert_eq!(rule(|m| m["revision"] = json!(-1)), "parse");
        assert_eq!(
            rule(|m| m["relations"][0]["max_distance"] = json!(0)),
            "relation-bad-distance"
        );
        assert_eq!(
            rule(|m| m["fields"][0]["extra_offsets"] = json!([7])),
            "extra-offset-out-of-pattern"
        );
        assert_eq!(
            rule(|m| m["constraints"][1]["modulo"] = json!(1)),
            "bad-constraint"
        );
        assert_eq!(
            rule(|m| m["captures"][0]["width"] = json!(3)),
            "bad-capture"
        );
        assert_eq!(
            rule(|m| m["captures"][4]["signed"] = json!(true)),
            "bad-capture"
        );
    }

    #[test]
    fn estruturas_acima_dos_limites_sao_recusadas() {
        assert_eq!(
            rule(|m| m["work_limits"]["max_rom_bytes"] = json!(HARD_MAX_ROM_BYTES + 1)),
            "bad-work-limits"
        );
        assert_eq!(
            rule(|m| m["work_limits"]["max_matches_per_pattern"] = json!(HARD_MAX_MATCHES + 1)),
            "bad-work-limits"
        );
        assert_eq!(
            rule(|m| m["work_limits"]["max_instances"] = json!(0)),
            "bad-work-limits"
        );
        assert_eq!(
            rule(|m| m["title"] = json!("x".repeat(MAX_TEXT_LEN + 1))),
            "limit-exceeded"
        );
        assert_eq!(
            rule(|m| {
                let p = m["patterns"][2].clone();
                for i in 0..MAX_PATTERNS {
                    let mut q = p.clone();
                    q["id"] = json!(format!("extra{i}"));
                    m["patterns"].as_array_mut().unwrap().push(q);
                }
            }),
            "limit-exceeded"
        );
        assert_eq!(
            rule(|m| {
                let lit = json!({"p": "lit", "t": "x"});
                m["notes"][0]["text"] = json!(vec![lit; MAX_TEXT_PARTS + 1]);
            }),
            "limit-exceeded"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][1]["col"] = json!(65)),
            "limit-exceeded"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][0]["rom_span"]["len"] = json!(65)),
            "limit-exceeded"
        );
        // padrão maior que o localizador aceita
        assert_eq!(
            rule(|m| m["patterns"][0]["sources"] = json!([format!(
                "30 3C {{lim:2}} 4A 6E {{obj:2}} {}",
                "00 ".repeat(200)
            )])),
            "pattern-invalid"
        );
    }

    #[test]
    fn pareamento_incompativel_e_forma_fora_da_classe_sao_recusados() {
        assert_eq!(
            rule(|m| m["relations"][0]["to"] = json!("a")),
            "incompatible-pairing"
        );
        assert_eq!(
            rule(|m| m["relations"][1]["to"] = json!("a")),
            "incompatible-pairing"
        );
        assert_eq!(
            rule(|m| m["relations"][1]["from"] = json!("a")),
            "unsupported-shape"
        );
        assert_eq!(
            rule(|m| {
                m["relations"].as_array_mut().unwrap().remove(0);
                m["fields"].as_array_mut().unwrap().truncate(1);
            }),
            "unsupported-shape"
        );
        assert_eq!(
            rule(|m| {
                let mut p = m["relations"][0].clone();
                p["id"] = json!("p2");
                m["relations"].as_array_mut().unwrap().push(p);
            }),
            "unsupported-shape"
        );
        assert_eq!(
            rule(|m| m["relations"][0]["tie"] = json!("random")),
            "parse"
        );
        // campo num padrão que nenhuma relação alcança
        assert_eq!(
            rule(|m| {
                m["patterns"]
                    .as_array_mut()
                    .unwrap()
                    .push(json!({"id": "solto", "sources": ["30 3C {lim:2} 4E 75"]}));
                m["fields"][0]["patterns"] = json!(["solto"]);
            }),
            "field-unreachable"
        );
    }

    #[test]
    fn arquitetura_tipos_de_node_e_parametros_reservados() {
        assert_eq!(
            rule(|m| m["arch"]["cpu"] = json!("z80")),
            "unsupported-arch"
        );
        assert_eq!(
            rule(|m| m["arch"]["endianness"] = json!("little")),
            "unsupported-arch"
        );
        assert_eq!(
            rule(|m| m["arch"]["instruction_alignment"] = json!(1)),
            "unsupported-arch"
        );
        assert_eq!(rule(|m| m["id"] = json!("z80.mini_gate.v1")), "bad-id");
        assert_eq!(rule(|m| m["id"] = json!("m68k.Mini.v1")), "bad-id");
        assert_eq!(
            rule(|m| m["projection"]["nodes"][1]["type"] = json!("custom_script")),
            "unsupported-node-type"
        );
        for k in [
            "editavel",
            "campo",
            "ponte_edicao",
            "perfil",
            "rom_sha256",
            "origem",
            "perfil_sha256",
            "gate_offset",
        ] {
            assert_eq!(
                rule(|m| m["projection"]["nodes"][1]["params"][0]["key"] = json!(k)),
                "reserved-param",
                "{k}"
            );
        }
        assert_eq!(
            rule(|m| m["projection"]["instance_param"] = json!("campo")),
            "bad-instance-param"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][1]["params"][0] = json!({"key": "x"})),
            "bad-param"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][1]["params"][0] =
                json!({"key": "x", "value": 1, "text": [{"p": "lit", "t": "a"}]})),
            "bad-param"
        );
        assert_eq!(
            rule(|m| m["projection"]["nodes"][2]["type"] = json!("condition_compare")),
            "field-node-type"
        );
        // só captura `immediate` é editável: deslocamento e endereço não viram campo
        assert_eq!(
            rule(|m| m["captures"][0]["role"] = json!("ea_displacement")),
            "field-not-immediate"
        );
        assert_eq!(
            rule(|m| m["artifact_tag"] = json!("../x")),
            "bad-artifact-tag"
        );
    }

    #[test]
    fn texto_e_lista_de_partes_tipadas_nunca_expressao() {
        // parte de tipo desconhecido não existe no contrato
        assert_eq!(
            rule(|m| m["notes"][0]["text"][0] = json!({"p": "expr", "t": "1+1"})),
            "parse"
        );
        assert_eq!(
            rule(|m| m["notes"][0]["text"][1]["fmt"] = json!("printf")),
            "parse"
        );
        assert_eq!(
            rule(|m| m["notes"][0]["text"] = json!("texto solto")),
            "parse"
        );
        assert_eq!(rule(|m| m["notes"][0]["text"] = json!([])), "empty-text");
        // um literal com cara de modelo/código é aceito COMO LITERAL (o motor prova que não o interpreta)
        assert_eq!(
            rule(|m| m["notes"][0]["text"][0]["t"] = json!("{lim} ${obj} `id` <%= x %>")),
            "aceito"
        );
    }

    #[test]
    fn afirmacoes_de_evidencia_exigem_referencia_escopo_e_eixo_de_execucao() {
        let claim = |level: &str| {
            json!({"id": "c1", "level": level, "fields": ["lim"], "statement": "s",
                   "scope": {"roms": [{"sha256": "a".repeat(64), "instance_offsets": [64]}], "values": [{"field": "lim", "values": [300, 400]}], "conditions": "c"},
                   "refs": ["docs/x.md"]})
        };
        let with = |c: Value| move |m: &mut Value| m["evidence"]["claims"] = json!([c]);
        assert_eq!(rule(with(claim("L5"))), "aceito");
        assert_eq!(rule(with(claim("L3"))), "aceito");
        // forma/consistência são calculadas pelo motor por instância: não se declaram
        assert_eq!(rule(with(claim("L1"))), "claim-not-runtime");
        assert_eq!(rule(with(claim("L2"))), "claim-not-runtime");
        assert_eq!(rule(with(claim("L9"))), "parse");
        let mut c = claim("L5");
        c["refs"] = json!([]);
        assert_eq!(rule(with(c)), "claim-without-reference");
        let mut c = claim("L5");
        c["scope"]["roms"] = json!([]);
        assert_eq!(rule(with(c)), "claim-without-scope");
        let mut c = claim("L5");
        c["scope"]["roms"][0]["sha256"] = json!("ABC");
        assert_eq!(rule(with(c)), "claim-without-scope");
        let mut c = claim("L5");
        c["scope"]["roms"][0]["instance_offsets"] = json!([]);
        assert_eq!(rule(with(c)), "claim-without-scope");
        let mut c = claim("L5");
        c["scope"]["values"][0]["values"] = json!([300, 5000]);
        assert_eq!(rule(with(c)), "measured-outside-domain");
        let mut c = claim("L5");
        c["fields"] = json!(["zz"]);
        assert_eq!(rule(with(c)), "unknown-field");
        let mut c = claim("L5");
        c["scope"]["values"][0]["field"] = json!("low");
        assert_eq!(rule(with(c)), "unknown-field");
        assert_eq!(rule(|m| m["limits"] = json!([])), "no-limits");
        assert_eq!(
            rule(|m| m["provenance"]["created"] = json!("ontem")),
            "bad-provenance"
        );
        assert_eq!(
            rule(|m| m["provenance"]["derived_from"] = json!([])),
            "bad-provenance"
        );
        assert_eq!(
            rule(|m| m["rom_binding"] = json!({"mode": "sha256", "sha256": []})),
            "bad-rom-binding"
        );
        assert_eq!(
            rule(|m| m["rom_binding"] = json!({"mode": "sha256", "sha256": ["xyz"]})),
            "bad-rom-binding"
        );
    }

    #[test]
    fn as_tres_nocoes_de_endereco_sao_distintas() {
        let s = ProfileSpec::from_json(&text(&mini_with(|m| {
            m["rom_mapping"] = json!({"kind": "linear", "file_header_bytes": 512, "bus_base": 0});
        })))
        .unwrap();
        // offset de arquivo 0x240, com cabeçalho de 512 bytes, é o endereço de barramento 0x40
        assert_eq!(s.file_to_bus(0x240), Some(0x40));
        assert_eq!(s.file_to_bus(0x100), None); // dentro do cabeçalho: não está no barramento
        assert_eq!(s.bus_to_file(0x40, 0x1000), Some(0x240));
        assert_eq!(s.bus_to_file(0x2000, 0x1000), None); // fora do arquivo
                                                         // endereço curto (2 bytes) estende o sinal até o barramento de 24 bits: é RAM, não cai na ROM
        let ram = s.capture("ram").unwrap();
        assert_eq!(s.bus_address_of(ram, &[0xF6, 0x02]), 0xFF_F602);
        assert_eq!(s.bus_to_file(0xFF_F602, 0x1000), None);
        assert_eq!(s.bus_address_of(ram, &[0x12, 0x34]), 0x1234);
        // deslocamento de endereço efetivo não é endereço: não há conversão para ele
        assert_eq!(s.capture("obj").unwrap().role, CaptureRole::EaDisplacement);
    }

    #[test]
    fn o_dado_do_primeiro_perfil_declara_escopo_e_desconhecidos() {
        let j = ProfileSpec::from_json(JUMP).unwrap();
        let campos: Vec<&str> = j
            .evidence
            .claims
            .iter()
            .flat_map(|c| c.fields.iter().map(String::as_str))
            .collect();
        assert_eq!(campos, ["imp", "cut"]);
        assert!(j
            .evidence
            .claims
            .iter()
            .all(|c| c.level == EvidenceLevel::L5EditCausality
                && !c.refs.is_empty()
                && c.scope.roms.len() == 2));
        assert!(j
            .evidence
            .claims
            .iter()
            .all(|c| c.level.axis() != EvidenceAxis::Trace));
        assert!(j.evidence.unknown.iter().any(|u| u.contains("consumo")));
        for (n, lo, hi) in [
            ("imp", 1, 32767),
            ("imps", 1, 32767),
            ("impw", 1, 32767),
            ("cut", -32767, -1),
            ("cutw", -32767, -1),
            ("cap", -32767, -1),
        ] {
            let f = j.field(n).unwrap();
            assert_eq!((f.min, f.max), (lo, hi), "{n}");
        }
    }
}
