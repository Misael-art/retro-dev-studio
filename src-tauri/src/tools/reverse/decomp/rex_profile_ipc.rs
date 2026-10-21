//! Superfície IPC genérica dos perfis REX: catálogo, localizar e gerar edição.
//!
//! Não conhece nenhum perfil: recebe o id como dado e trabalha com o que o registro carregou.
//! Garantias: a ROM de entrada nunca é alterada; a saída é uma CÓPIA nova (e um IPS) em um diretório
//! escolhido, publicados juntos e sem sobrescrever (`rex_publish`); o tamanho não muda; a cópia é relida
//! e re-localizada para conferir os valores; toda resposta carrega a identidade (ROM, perfil, instância,
//! pedido) para o frontend descartar resultado de outro contexto.
//!
//! O que se afirma é estático. `consumer_observed` é sempre `false`: uma assinatura encontrada nos dados
//! não é um consumidor executado, e nada aqui mede execução.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::inspection::InspectionError;
use super::rex_edit::{self, Patch};
use super::rex_evidence::EvidenceLevel;
use super::rex_evidence_origin::{
    app_session, classify_claim, curated_for_profile, curated_records, AppObservation,
    Applicability, ClaimOrigin, CuratedRecord,
};
use super::rex_profile_engine::{Engine, EngineInstance, ProfileError};
use super::rex_profile_graph::{self as graph, GraphReview};
use super::rex_profile_registry::{LoadedProfile, LoadedSemantic, Origin, Registry, Rejected};
use super::rex_profile_semantic::{OperationView, SelectionMode, SemanticEngine, SemanticInstance};
use super::rex_profile_spec::{CaptureRole, RomBinding};
use super::rex_publish::{self, Fs, PublishError, RealFs};
use super::rom_library::sha256_hex;

pub const MAX_ROM_BYTES: u64 = 32 * 1024 * 1024;

pub(crate) fn fail(code: &str, message: impl Into<String>) -> InspectionError {
    InspectionError {
        code: code.to_string(),
        message: message.into(),
        retryable: false,
    }
}

pub(crate) fn from_profile(e: ProfileError) -> InspectionError {
    let msg = match &e {
        ProfileError::InstanceNotFound => {
            "a instância não existe nesta ROM (ROM mudou desde a localização?)".to_string()
        }
        ProfileError::OutOfRange => "valor fora da faixa segura do campo".to_string(),
        ProfileError::NoChange => "nenhum valor muda: nada a gerar".to_string(),
        ProfileError::FieldUnavailable => {
            "o campo pedido não existe nesta instância (ligação não pareada?)".to_string()
        }
        ProfileError::StaleBytes => {
            "os bytes antigos não coincidem: a ROM já foi editada ou é outra".to_string()
        }
        ProfileError::IpsUnrepresentable => "o formato IPS não representa este patch (offset acima de 0xFFFFFF, offset igual ao marcador EOF, registro vazio/grande ou sobreposto); nada foi gravado".to_string(),
        ProfileError::GraphDiverges(motivos) => format!(
            "o grafo não representa a lógica da ROM e não será aplicado: {}",
            motivos.iter().take(6).cloned().collect::<Vec<_>>().join("; ")
        ),
        ProfileError::ParamsConflict => {
            "valores pedidos por duas fontes (formulário e grafo); envie só uma".to_string()
        }
        ProfileError::ProfileUnknown(id) => {
            format!("perfil não carregado: {id}; nada foi gravado")
        }
        ProfileError::ProfileMismatch { expected, loaded } => format!(
            "o perfil carregado ({}…) não é o que gerou esta localização/grafo ({}…); localize de novo com o perfil atual",
            &loaded[..loaded.len().min(12)],
            &expected[..expected.len().min(12)]
        ),
        ProfileError::WorkLimit(m) => format!("limite de trabalho do perfil excedido: {m}"),
        ProfileError::RegionRefused(m) => {
            format!("o analisador recusou a região: {m}; nada foi gravado")
        }
        ProfileError::RomNotBound => {
            "o perfil está vinculado a outras ROMs (SHA-256); esta não é uma delas".to_string()
        }
    };
    fail(e.code(), msg)
}

pub(crate) fn request_ok(id: &str) -> Result<(), InspectionError> {
    if id.is_empty() || id.len() > 128 {
        return Err(fail(
            "invalid_request",
            "request_id vazio ou maior que 128 caracteres",
        ));
    }
    Ok(())
}

pub(crate) fn read_rom(path: &str) -> Result<Vec<u8>, InspectionError> {
    if path.trim().is_empty() {
        return Err(fail("invalid_request", "rom_path vazio"));
    }
    let meta =
        fs::metadata(path).map_err(|e| fail("invalid_request", format!("ROM inacessível: {e}")))?;
    if !meta.is_file() {
        return Err(fail("invalid_request", "rom_path não é um arquivo"));
    }
    if meta.len() > MAX_ROM_BYTES {
        return Err(fail(
            "invalid_request",
            format!(
                "ROM de {} bytes excede {MAX_ROM_BYTES}; recusada sem ler",
                meta.len()
            ),
        ));
    }
    fs::read(path).map_err(|e| fail("io_error", format!("falha ao ler a ROM: {e}")))
}

fn registry(dir: &Option<String>) -> Registry {
    match dir.as_deref().map(str::trim).filter(|d| !d.is_empty()) {
        Some(d) => Registry::load(Some(Path::new(d))),
        None => Registry::builtin(),
    }
}

// ----------------------------------------------------------------- catálogo

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ClaimView {
    pub id: String,
    pub level: EvidenceLevel,
    pub level_label: String,
    pub statement: String,
    pub fields: Vec<String>,
    /// Valores que o AUTOR declara terem sido medidos, por campo.
    pub values: Vec<(String, Vec<i64>)>,
    /// ROMs (SHA-256) e instâncias (offset de arquivo) do escopo DECLARADO.
    pub roms: Vec<(String, Vec<u64>)>,
    pub conditions: String,
    pub refs: Vec<String>,
    /// `declared`: só a palavra do autor. `curated`: há registro histórico no repositório para ESTE
    /// arquivo de perfil. Nenhuma das duas é observação do aplicativo.
    pub origin: ClaimOrigin,
    pub records: Vec<CuratedRecord>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileInfo {
    /// `signature` (localizada por assinatura) ou `semantic_region` (derivada por analisador numa região).
    pub class: String,
    /// Como uma instância pode ser escolhida: `signature`, `structural_scan`, `declared_region`.
    pub selection_modes: Vec<String>,
    pub id: String,
    pub revision: u32,
    /// SHA-256 do arquivo do perfil: identidade exata do dado.
    pub sha256: String,
    pub title: String,
    pub summary: String,
    pub status: String,
    pub origin: Origin,
    pub file: String,
    pub arch: String,
    /// `"signature"` ou `"sha256"`.
    pub rom_binding: String,
    pub instance_param: String,
    pub author: String,
    pub created: String,
    pub derived_from: Vec<String>,
    /// Edições que o perfil suporta, por campo: rótulo, domínio aceito e codificação.
    pub editable: Vec<String>,
    /// O que NÃO está provado (texto do perfil).
    pub limits: Vec<String>,
    /// O que continua desconhecido (texto do perfil).
    pub unknown: Vec<String>,
    /// Afirmações obtidas em execução, com referência e escopo.
    pub claims: Vec<ClaimView>,
}

fn info(p: &LoadedProfile) -> ProfileInfo {
    let s = p.engine.spec();
    ProfileInfo {
        class: "signature".into(),
        selection_modes: vec!["signature".into()],
        id: s.id.clone(),
        revision: s.revision,
        sha256: p.engine.profile_sha256().to_string(),
        title: s.title.clone(),
        summary: s.summary.clone(),
        status: format!("{:?}", s.status).to_lowercase(),
        origin: p.origin,
        file: p.file.clone(),
        arch: format!(
            "{} · {:?}-endian · barramento de {} bits",
            s.arch.cpu, s.arch.endianness, s.arch.bus_address_bits
        )
        .to_lowercase(),
        rom_binding: match s.rom_binding {
            RomBinding::Signature => "signature".into(),
            RomBinding::Sha256 { .. } => "sha256".into(),
        },
        instance_param: s.projection.instance_param.clone(),
        author: s.provenance.author.clone(),
        created: s.provenance.created.clone(),
        derived_from: s.provenance.derived_from.clone(),
        editable: s
            .fields
            .iter()
            .map(|f| {
                let ty = s.field_type(f).map(|t| t.enc());
                format!(
                    "{}: {}..{}{}",
                    f.label,
                    f.min,
                    f.max,
                    ty.map(|e| format!(
                        " (inteiro de {} bits {}, {}-endian)",
                        u32::from(e.width) * 8,
                        if e.signed { "com sinal" } else { "sem sinal" },
                        if e.little { "little" } else { "big" }
                    ))
                    .unwrap_or_default()
                )
            })
            .collect(),
        limits: s.limits.clone(),
        unknown: s.evidence.unknown.clone(),
        claims: s
            .evidence
            .claims
            .iter()
            .map(|c| {
                let records = curated_for_profile(
                    curated_records(),
                    p.origin,
                    &s.id,
                    p.engine.profile_sha256(),
                    &c.id,
                );
                ClaimView {
                    id: c.id.clone(),
                    level: c.level,
                    level_label: c.level.label_pt().to_string(),
                    statement: c.statement.clone(),
                    fields: c.fields.clone(),
                    values: c
                        .scope
                        .values
                        .iter()
                        .map(|v| (v.field.clone(), v.values.clone()))
                        .collect(),
                    roms: c
                        .scope
                        .roms
                        .iter()
                        .map(|r| (r.sha256.clone(), r.instance_offsets.clone()))
                        .collect(),
                    conditions: c.scope.conditions.clone(),
                    refs: c.refs.clone(),
                    origin: if records.is_empty() {
                        ClaimOrigin::Declared
                    } else {
                        ClaimOrigin::Curated
                    },
                    records,
                }
            })
            .collect(),
    }
}

fn claim_views(
    claims: &[super::rex_profile_spec::ClaimSpec],
    origin: Origin,
    profile_id: &str,
    profile_sha256: &str,
) -> Vec<ClaimView> {
    claims
        .iter()
        .map(|c| {
            let records =
                curated_for_profile(curated_records(), origin, profile_id, profile_sha256, &c.id);
            ClaimView {
                id: c.id.clone(),
                level: c.level,
                level_label: c.level.label_pt().to_string(),
                statement: c.statement.clone(),
                fields: c.fields.clone(),
                values: c
                    .scope
                    .values
                    .iter()
                    .map(|v| (v.field.clone(), v.values.clone()))
                    .collect(),
                roms: c
                    .scope
                    .roms
                    .iter()
                    .map(|r| (r.sha256.clone(), r.instance_offsets.clone()))
                    .collect(),
                conditions: c.scope.conditions.clone(),
                refs: c.refs.clone(),
                origin: if records.is_empty() {
                    ClaimOrigin::Declared
                } else {
                    ClaimOrigin::Curated
                },
                records,
            }
        })
        .collect()
}

/// Afirmações de execução sobre UM campo de UMA instância, cada uma com a sua origem.
fn claims_on_field(
    claims: &[super::rex_profile_spec::ClaimSpec],
    origin: Origin,
    profile_id: &str,
    profile_sha256: &str,
    field: &str,
    rom_sha256: &str,
    instance_offset: u64,
) -> Vec<ClaimOnField> {
    claims
        .iter()
        .filter(|c| c.fields.iter().any(|f| f == field))
        .map(|c| {
            let standing = classify_claim(
                curated_records(),
                origin,
                profile_id,
                profile_sha256,
                &c.id,
                rom_sha256,
                instance_offset,
            );
            ClaimOnField {
                claim: c.id.clone(),
                level: c.level,
                level_label: c.level.label_pt().to_string(),
                values: c
                    .scope
                    .values
                    .iter()
                    .find(|v| v.field == field)
                    .map(|v| v.values.clone())
                    .unwrap_or_default(),
                declared_scope_matches: c.scope.roms.iter().any(|r| {
                    r.sha256 == rom_sha256 && r.instance_offsets.contains(&instance_offset)
                }),
                origin: standing.origin,
                applicability: standing.applicability,
                records: standing.records,
                inherited: standing.inherited,
                conditions: c.scope.conditions.clone(),
                refs: c.refs.clone(),
            }
        })
        .collect()
}

fn info_semantic(p: &LoadedSemantic) -> ProfileInfo {
    let s = p.engine.spec();
    let mut modes = Vec::new();
    if s.selection.structural_scan {
        modes.push(SelectionMode::StructuralScan.code().to_string());
    }
    if s.selection.declared_region {
        modes.push(SelectionMode::DeclaredRegion.code().to_string());
    }
    ProfileInfo {
        class: "semantic_region".into(),
        selection_modes: modes,
        id: s.id.clone(),
        revision: s.revision,
        sha256: p.engine.profile_sha256().to_string(),
        title: s.title.clone(),
        summary: s.summary.clone(),
        status: format!("{:?}", s.status).to_lowercase(),
        origin: p.origin,
        file: p.file.clone(),
        arch: format!(
            "{} · {:?}-endian · barramento de {} bits",
            s.arch.cpu, s.arch.endianness, s.arch.bus_address_bits
        )
        .to_lowercase(),
        rom_binding: match s.rom_binding {
            RomBinding::Signature => "signature".into(),
            RomBinding::Sha256 { .. } => "sha256".into(),
        },
        instance_param: super::rex_profile_semantic::INSTANCE_PARAM.to_string(),
        author: s.provenance.author.clone(),
        created: s.provenance.created.clone(),
        derived_from: s.provenance.derived_from.clone(),
        editable: vec![format!(
            "{}: a faixa é derivada de cada instância (o valor tem de caber na instrução original)",
            s.edit.label
        )],
        limits: s.limits.clone(),
        unknown: s.evidence.unknown.clone(),
        claims: claim_views(
            &s.evidence.claims,
            p.origin,
            &s.id,
            p.engine.profile_sha256(),
        ),
    }
}

/// Visão de uma instância da classe semântica: as operações vêm do analisador; o que é declarado é dito.
fn semantic_view(
    p: &LoadedSemantic,
    request_id: &str,
    rom_sha256: &str,
    inst: &SemanticInstance,
) -> InstanceView {
    let engine: &SemanticEngine = &p.engine;
    let s = engine.spec();
    let field = &s.edit.field;
    let mut declared = vec![
        "rótulo do campo editável, título, limites e afirmações vêm do perfil (dado)".to_string(),
    ];
    declared.push(match inst.selection {
        SelectionMode::DeclaredRegion => format!(
            "entrada 0x{:06X} e saída(s) {} informadas pelo usuário",
            inst.entry,
            inst.exits.iter().map(|e| format!("0x{e:06X}")).collect::<Vec<_>>().join(", ")
        ),
        SelectionMode::StructuralScan => format!(
            "entrada 0x{:06X} e saída {} propostas pela varredura estrutural (a própria guarda dá a saída)",
            inst.entry,
            inst.exits.iter().map(|e| format!("0x{e:06X}")).collect::<Vec<_>>().join(", ")
        ),
    });
    InstanceView {
        selection: SelectionView {
            mode: inst.selection.code().to_string(),
            label: inst.selection.label_pt().to_string(),
        },
        operations: inst.operations.clone(),
        declared,
        region_exits: inst.exits.clone(),
        instance_offset: inst.entry as usize,
        instance_bus_address: Some(u64::from(inst.entry)),
        anchor_pattern: format!("{:?}", s.analyzer.kind),
        links: Vec::new(),
        fields: vec![FieldView {
            name: field.clone(),
            label: s.edit.label.clone(),
            value: inst.value,
            min: inst.min,
            max: inst.max,
            rom_offsets: vec![inst.immediate_at],
            bus_addresses: vec![Some(inst.immediate_at as u64)],
            width: 1,
            signed: s.analyzer.kind
                == super::rex_profile_semantic::AnalyzerKind::CounterCompareGate,
            little_endian: false,
            // a regra foi DERIVADA dos bytes e re-conferida pelo analisador: consistência estática
            static_level: EvidenceLevel::L2Consistency,
            static_label: EvidenceLevel::L2Consistency.label_pt().to_string(),
            claims: claims_on_field(
                &s.evidence.claims,
                p.origin,
                &s.id,
                engine.profile_sha256(),
                field,
                rom_sha256,
                u64::from(inst.entry),
            ),
        }],
        notes: inst
            .operations
            .iter()
            .filter(|o| o.opaque)
            .map(|o| {
                format!(
                    "parte opaca: {} ({}) — registrada, não recuperada",
                    o.id, o.text
                )
            })
            .collect(),
        details: Vec::new(),
        captures: Vec::new(),
        ambiguities: Vec::new(),
        graph_json: engine.graph_json(inst, rom_sha256),
        consumer_observed: false,
        observations: vec![
            AppObservation::now("static_form_matched", request_id),
            AppObservation::now("operations_derived_from_bytes", request_id),
        ],
    }
}

/// O que o motor garante e o que ele NÃO afirma, para qualquer perfil.
fn engine_limits() -> Vec<String> {
    vec![
        "Localização por assinatura de bytes: prova a forma da rotina e a consistência das capturas, não que ela seja chamada em gameplay.".to_string(),
        "Só inteiros dentro de instruções ou dados que a ROM já tem são editáveis; a ROM não cresce.".to_string(),
        "Gerar cópia não recompila o grafo: grava uma cópia da ROM com os valores trocados e um patch IPS.".to_string(),
        "Consumo em execução não é observado por este motor: nenhuma instância tem chamador ou argumentos medidos.".to_string(),
    ]
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct ProfileCatalogRequest {
    pub request_id: String,
    /// Pasta de perfis autorais (opcional). Sem ela, só os embutidos.
    #[serde(default)]
    pub profiles_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileCatalogResponse {
    pub app_session: String,
    pub profiles: Vec<ProfileInfo>,
    /// Arquivos recusados pela validação, com o motivo.
    pub rejected: Vec<Rejected>,
    pub engine_limits: Vec<String>,
}

pub fn ipc_catalog(req: &ProfileCatalogRequest) -> Result<ProfileCatalogResponse, InspectionError> {
    request_ok(&req.request_id)?;
    let reg = registry(&req.profiles_dir);
    Ok(ProfileCatalogResponse {
        app_session: app_session().to_string(),
        profiles: reg
            .profiles
            .iter()
            .map(info)
            .chain(reg.semantic.iter().map(info_semantic))
            .collect(),
        rejected: reg.rejected,
        engine_limits: engine_limits(),
    })
}

// ----------------------------------------------------------------- localizar

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ClaimOnField {
    pub claim: String,
    pub level: EvidenceLevel,
    pub level_label: String,
    pub values: Vec<i64>,
    /// `declared` (só a palavra do autor) ou `curated` (há registro histórico no repositório).
    pub origin: ClaimOrigin,
    /// O registro curado vale para ESTA ROM, instância e arquivo de perfil?
    pub applicability: Applicability,
    /// Registros curados que sustentam a classificação (vazio quando só declarada).
    pub records: Vec<CuratedRecord>,
    /// Medido antes de o perfil ser este arquivo e transportado por equivalência.
    pub inherited: bool,
    /// O escopo DECLARADO pelo autor cita esta ROM e esta instância (não é comprovação de nada).
    pub declared_scope_matches: bool,
    pub conditions: String,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FieldView {
    pub name: String,
    pub label: String,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    /// OFFSETS DE ARQUIVO onde o inteiro aparece. Mais de um = editados juntos.
    pub rom_offsets: Vec<usize>,
    /// ENDEREÇOS DE BARRAMENTO correspondentes (`null` quando o mapeamento não cobre o offset).
    pub bus_addresses: Vec<Option<u64>>,
    pub width: u8,
    pub signed: bool,
    pub little_endian: bool,
    /// Verificação ESTÁTICA desta instância: `L1` (só a forma) ou `L2` (forma + consistência).
    pub static_level: EvidenceLevel,
    pub static_label: String,
    /// Afirmações de execução sobre este campo, cada uma com a sua ORIGEM. Nenhuma é observação do
    /// aplicativo: são declaração do autor ou registro histórico curado.
    pub claims: Vec<ClaimOnField>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CaptureView {
    pub source: String,
    pub name: String,
    pub role: CaptureRole,
    pub value: i64,
    /// Onde os bytes estão no ARQUIVO.
    pub file_offset: usize,
    /// Endereço de BARRAMENTO que a captura designa (só `bus_address`).
    pub designates_bus_address: Option<u64>,
    /// Offset de arquivo desse endereço, quando ele cai dentro da ROM mapeada.
    pub designates_file_offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LinkView {
    pub relation: String,
    pub pattern: String,
    pub file_offset: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SelectionView {
    /// `signature`, `structural_scan` ou `declared_region`.
    pub mode: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InstanceView {
    /// Como esta instância foi escolhida (rotulado; nunca "descoberta de rotina").
    pub selection: SelectionView,
    /// Operações DERIVADAS dos bytes por um analisador (vazio na classe de assinatura).
    pub operations: Vec<OperationView>,
    /// O que foi DECLARADO (pelo usuário ou pelo perfil) e não derivado da ROM.
    pub declared: Vec<String>,
    /// Saídas da região (classe semântica); vazio na classe de assinatura.
    pub region_exits: Vec<u32>,
    /// Offset de ARQUIVO de referência da instância.
    pub instance_offset: usize,
    /// Endereço de BARRAMENTO correspondente.
    pub instance_bus_address: Option<u64>,
    pub anchor_pattern: String,
    pub links: Vec<LinkView>,
    pub fields: Vec<FieldView>,
    pub notes: Vec<String>,
    pub details: Vec<(String, String)>,
    pub captures: Vec<CaptureView>,
    /// Ligações não feitas por ambiguidade, com o motivo.
    pub ambiguities: Vec<String>,
    /// NodeGraph v1 descritivo da instância (um nó editável por campo).
    pub graph_json: String,
    /// Sempre `false`: assinatura encontrada não é consumidor executado.
    pub consumer_observed: bool,
    /// O que o APLICATIVO fez e conferiu nesta instância, com a sessão em que o fez. Reconhecer a forma
    /// é uma observação estática; efeito, consumo e equivalência nunca aparecem aqui por declaração.
    pub observations: Vec<AppObservation>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileMatch {
    pub profile: ProfileInfo,
    pub instances: Vec<InstanceView>,
    /// Ocorrências descartadas por restrição entre capturas.
    pub rejected_by_constraint: usize,
    /// `false`: o perfil está vinculado a outras ROMs e não foi tentado nesta.
    pub bound: bool,
    /// Recusa deste perfil nesta ROM (ex.: limite de trabalho), sem afetar os demais.
    pub error: Option<InspectionError>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct DeclaredRegion {
    pub profile_id: String,
    pub entry: u32,
    pub exits: Vec<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct ProfileLocateRequest {
    pub rom_path: String,
    pub request_id: String,
    #[serde(default)]
    pub profiles_dir: Option<String>,
    /// Regiões DECLARADAS pelo usuário para perfis da classe semântica que as aceitam.
    #[serde(default)]
    pub declared_regions: Vec<DeclaredRegion>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileLocateResponse {
    pub request_id: String,
    /// Sessão do aplicativo que produziu esta resposta.
    pub app_session: String,
    pub rom_sha256: String,
    pub rom_size: usize,
    /// Um item por perfil carregado, tenha ou não reconhecido algo.
    pub matches: Vec<ProfileMatch>,
    pub rejected: Vec<Rejected>,
    pub limites: Vec<String>,
}

pub(crate) fn instance_view(
    engine: &Engine,
    origin: Origin,
    request_id: &str,
    rom: &[u8],
    rom_sha256: &str,
    inst: &EngineInstance,
) -> Result<InstanceView, InspectionError> {
    let spec = engine.spec();
    let graph_json = graph::graph_json(engine, rom, inst, rom_sha256)
        .map_err(|e| from_profile(ProfileError::from(e)))?;
    let fields = inst
        .fields
        .iter()
        .map(|f| FieldView {
            name: f.name.clone(),
            label: f.label.clone(),
            value: f.value,
            min: f.min,
            max: f.max,
            rom_offsets: f.rom_offsets.clone(),
            bus_addresses: f
                .rom_offsets
                .iter()
                .map(|o| spec.file_to_bus(*o as u64))
                .collect(),
            width: f.enc.width,
            signed: f.enc.signed,
            little_endian: f.enc.little,
            static_level: f.static_level,
            static_label: f.static_level.label_pt().to_string(),
            claims: spec
                .evidence
                .claims
                .iter()
                .filter(|c| c.fields.contains(&f.name))
                .map(|c| {
                    let standing = classify_claim(
                        curated_records(),
                        origin,
                        &spec.id,
                        engine.profile_sha256(),
                        &c.id,
                        rom_sha256,
                        inst.anchor_offset as u64,
                    );
                    ClaimOnField {
                        claim: c.id.clone(),
                        level: c.level,
                        level_label: c.level.label_pt().to_string(),
                        values: c
                            .scope
                            .values
                            .iter()
                            .find(|v| v.field == f.name)
                            .map(|v| v.values.clone())
                            .unwrap_or_default(),
                        declared_scope_matches: c.scope.roms.iter().any(|r| {
                            r.sha256 == rom_sha256
                                && r.instance_offsets.contains(&(inst.anchor_offset as u64))
                        }),
                        origin: standing.origin,
                        applicability: standing.applicability,
                        records: standing.records,
                        inherited: standing.inherited,
                        conditions: c.scope.conditions.clone(),
                        refs: c.refs.clone(),
                    }
                })
                .collect(),
        })
        .collect();
    Ok(InstanceView {
        selection: SelectionView {
            mode: "signature".into(),
            label: "assinatura de bytes declarada pelo perfil; a forma casou nesta ROM".into(),
        },
        operations: Vec::new(),
        declared: vec![
            "padrões, relações, campos, domínios, notas e projeção vêm do perfil (dado)".into(),
        ],
        region_exits: Vec::new(),
        instance_offset: inst.anchor_offset,
        instance_bus_address: spec.file_to_bus(inst.anchor_offset as u64),
        anchor_pattern: inst.anchor.pattern.clone(),
        links: inst
            .links
            .iter()
            .map(|(rel, m)| LinkView {
                relation: rel.clone(),
                pattern: m.pattern.clone(),
                file_offset: m.offset,
            })
            .collect(),
        fields,
        notes: engine.notes(rom, inst),
        details: engine.details(rom, inst),
        captures: engine
            .captures(rom, inst)
            .into_iter()
            .map(|c| CaptureView {
                designates_file_offset: c
                    .designates_bus_address
                    .and_then(|b| spec.bus_to_file(b, rom.len() as u64)),
                source: c.source,
                name: c.name,
                role: c.role,
                value: c.value,
                file_offset: c.file_offset,
                designates_bus_address: c.designates_bus_address,
            })
            .collect(),
        ambiguities: inst.ambiguities.clone(),
        graph_json,
        consumer_observed: false,
        observations: vec![AppObservation::now("static_form_matched", request_id)],
    })
}

pub fn ipc_locate(req: &ProfileLocateRequest) -> Result<ProfileLocateResponse, InspectionError> {
    request_ok(&req.request_id)?;
    let rom = read_rom(&req.rom_path)?;
    let sha = sha256_hex(&rom);
    let reg = registry(&req.profiles_dir);
    let mut matches = Vec::new();
    for p in &reg.profiles {
        let mut m = ProfileMatch {
            profile: info(p),
            instances: Vec::new(),
            rejected_by_constraint: 0,
            bound: true,
            error: None,
        };
        match p.engine.locate(&rom, &sha) {
            Err(e) => m.error = Some(from_profile(ProfileError::from(e))),
            Ok(located) => {
                m.bound = located.bound;
                m.rejected_by_constraint = located.rejected_by_constraint;
                for inst in &located.instances {
                    match instance_view(&p.engine, p.origin, &req.request_id, &rom, &sha, inst) {
                        Ok(v) => m.instances.push(v),
                        Err(e) => m.error = Some(e),
                    }
                }
            }
        }
        matches.push(m);
    }
    for p in &reg.semantic {
        let mut m = ProfileMatch {
            profile: info_semantic(p),
            instances: Vec::new(),
            rejected_by_constraint: 0,
            bound: true,
            error: None,
        };
        let declared: Vec<&DeclaredRegion> = req
            .declared_regions
            .iter()
            .filter(|d| d.profile_id == p.engine.spec().id)
            .collect();
        match p.engine.candidates(&rom, &sha) {
            Err(e) => m.error = Some(from_profile(e)),
            Ok(None) => m.bound = false,
            Ok(Some(found)) => {
                // a região declarada pelo usuário prevalece sobre o candidato de mesma entrada
                for inst in found
                    .iter()
                    .filter(|c| !declared.iter().any(|d| d.entry == c.entry))
                {
                    m.instances
                        .push(semantic_view(p, &req.request_id, &sha, inst));
                }
                for d in &declared {
                    match p.engine.recover_declared(&rom, &sha, d.entry, &d.exits) {
                        Ok(inst) => {
                            m.instances
                                .push(semantic_view(p, &req.request_id, &sha, &inst))
                        }
                        Err(e) => m.error = Some(from_profile(e)),
                    }
                }
                m.instances.sort_by_key(|i| i.instance_offset);
            }
        }
        matches.push(m);
    }
    // região declarada para um perfil que não está carregado: dito, não ignorado
    let mut rejected = reg.rejected.clone();
    for d in &req.declared_regions {
        if reg.find_semantic(&d.profile_id).is_none() {
            rejected.push(Rejected {
                file: d.profile_id.clone(),
                rule: "profile-unknown".into(),
                message: "região declarada para um perfil que não está carregado ou não é da classe semântica".into(),
            });
        }
    }
    Ok(ProfileLocateResponse {
        request_id: req.request_id.clone(),
        app_session: app_session().to_string(),
        rom_sha256: sha,
        rom_size: rom.len(),
        matches,
        rejected,
        limites: engine_limits(),
    })
}

// ----------------------------------------------------------------- editar

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct ProfileEditRequest {
    pub rom_path: String,
    pub profile_id: String,
    /// SHA-256 do perfil que gerou a localização. Diferente do carregado: recusa (`profile-mismatch`).
    /// Ausente só para grafos gravados antes do vínculo por hash (o grafo é então revisado por estrutura).
    #[serde(default)]
    pub profile_sha256: Option<String>,
    pub instance_offset: usize,
    /// Valores pedidos diretamente (formulário). Mutuamente exclusivo com `graph_json`.
    #[serde(default)]
    pub values: BTreeMap<String, i64>,
    /// Grafo do canvas. O núcleo o REVISA contra o canônico reconstruído da ROM e deriva os valores
    /// dele; não confia nos metadados que o frontend carrega.
    #[serde(default)]
    pub graph_json: Option<String>,
    pub output_dir: String,
    pub request_id: String,
    /// OBRIGATÓRIA: identidade (SHA-256) da ROM da localização/grafo. ROM em disco diferente: recusa
    /// (`identity_mismatch`) sem gravar nada.
    pub expected_rom_sha256: String,
    #[serde(default)]
    pub profiles_dir: Option<String>,
    /// Classe semântica, pedido pelo formulário: saídas e modo de seleção da região (no pedido pelo
    /// grafo, vêm do próprio grafo).
    #[serde(default)]
    pub region_exits: Vec<u32>,
    #[serde(default)]
    pub region_selection: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProfileEditResponse {
    pub request_id: String,
    pub app_session: String,
    /// O que o aplicativo conferiu ao gerar ESTA cópia (releitura, IPS). Não é efeito em jogo.
    pub observations: Vec<AppObservation>,
    pub rom_sha256_before: String,
    pub rom_sha256_after: String,
    /// Identidade a que o resultado pertence (para o frontend descartar resposta velha).
    pub identity_rom_sha256: String,
    pub profile_id: String,
    pub profile_sha256: String,
    pub instance_offset: usize,
    /// Valores que ESTA cópia aplica (campo, valor).
    pub values_applied: Vec<(String, i64)>,
    pub patched_path: String,
    pub ips_path: String,
    pub ips_sha256: String,
    pub patches: Vec<Patch>,
    pub bytes_changed: usize,
    pub size_unchanged: bool,
    pub original_untouched: bool,
    /// O IPS gravado, reaplicado por um aplicador independente, reproduz a cópia byte a byte.
    pub ips_reproduces_copy: bool,
    /// Valores relidos da CÓPIA gravada, por campo (conferência pós-escrita).
    pub values_after: Vec<(String, i64)>,
    pub avisos: Vec<String>,
    /// O checksum do cabeçalho também foi atualizado (só quando a base já o tinha válido).
    pub checksum_updated: bool,
}

/// Relê `(campo, valor)` de uma cópia gerada.
type Reread = Box<dyn Fn(&[u8]) -> Option<Vec<(String, i64)>>>;

/// Plano de edição de UMA classe, pronto para a publicação comum.
struct Planned {
    profile_id: String,
    profile_sha256: String,
    artifact_tag: String,
    applied: Vec<(String, i64)>,
    patches: Vec<Patch>,
    avisos: Vec<String>,
    checksum_updated: bool,
    /// Relê os valores dos campos na CÓPIA (ignorando o vínculo do perfil com a ROM de origem).
    reread: Reread,
}

fn hash_ok(asked: &Option<String>, loaded: &str) -> Result<(), InspectionError> {
    match asked {
        Some(h) if h != loaded => Err(from_profile(ProfileError::ProfileMismatch {
            expected: h.clone(),
            loaded: loaded.to_string(),
        })),
        _ => Ok(()),
    }
}

const LEGACY_AVISO: &str = "Grafo gravado antes do vínculo por SHA-256 do perfil: aceito porque a estrutura confere com a reconstruída da ROM pelo perfil atual.";

/// Classe de assinatura: valores do formulário ou do grafo → `Patch` pelos campos do perfil.
fn plan_signature(
    loaded: &LoadedProfile,
    req: &ProfileEditRequest,
    rom: &[u8],
    before: &str,
) -> Result<Planned, InspectionError> {
    let engine = loaded.engine.clone();
    hash_ok(&req.profile_sha256, engine.profile_sha256())?;
    let mut avisos = Vec::new();
    // valores: do formulário OU do grafo (revisado contra o canônico da ROM), nunca dos dois
    let wanted: Vec<(String, i64)> = match &req.graph_json {
        Some(g) => {
            if !req.values.is_empty() {
                return Err(from_profile(ProfileError::ParamsConflict));
            }
            let rev =
                reviewed(&engine, rom, before, req.instance_offset, g).map_err(from_profile)?;
            if rev.legacy_binding {
                avisos.push(LEGACY_AVISO.to_string());
            }
            rev.changes
        }
        None => req.values.iter().map(|(k, v)| (k.clone(), *v)).collect(),
    };
    let inst = engine
        .instance_at(rom, before, req.instance_offset)
        .map_err(from_profile)?;
    // um campo que o perfil não tem, ou que esta instância não oferece, é recusa — nunca ignorado
    if wanted
        .iter()
        .any(|(n, _)| !inst.fields.iter().any(|f| f.name == *n))
    {
        return Err(from_profile(ProfileError::FieldUnavailable));
    }
    // ordem dos campos do PERFIL: o patch não depende da ordem em que o cliente enviou
    let ordered: Vec<(&str, Option<i64>)> = engine
        .spec()
        .fields
        .iter()
        .filter_map(|f| {
            wanted
                .iter()
                .find(|(n, _)| *n == f.name)
                .map(|(_, v)| (f.name.as_str(), Some(*v)))
        })
        .collect();
    let applied: Vec<(String, i64)> = ordered
        .iter()
        .map(|(n, v)| (n.to_string(), v.unwrap_or_default()))
        .collect();
    let patches = engine
        .plan_edit(rom, &inst, &ordered)
        .map_err(|e| from_profile(ProfileError::from(e)))?;
    let offset = req.instance_offset;
    Ok(Planned {
        profile_id: engine.spec().id.clone(),
        profile_sha256: engine.profile_sha256().to_string(),
        artifact_tag: engine.spec().artifact_tag.clone(),
        applied,
        patches,
        avisos,
        checksum_updated: false,
        reread: Box::new(move |copy| {
            engine
                .locate_any(copy)
                .ok()?
                .instances
                .into_iter()
                .find(|i| i.anchor_offset == offset)
                .map(|i| i.fields.into_iter().map(|f| (f.name, f.value)).collect())
        }),
    })
}

/// Classe semântica: a região vem do pedido (formulário) ou do grafo; a regra é re-derivada da ROM pelo
/// analisador e a reconstrução dele chega aqui como `Patch`.
fn plan_semantic(
    loaded: &LoadedSemantic,
    req: &ProfileEditRequest,
    rom: &[u8],
    before: &str,
) -> Result<Planned, InspectionError> {
    let engine = loaded.engine.clone();
    hash_ok(&req.profile_sha256, engine.profile_sha256())?;
    let field = engine.spec().edit.field.clone();
    let entry = u32::try_from(req.instance_offset)
        .map_err(|_| from_profile(ProfileError::InstanceNotFound))?;
    let mut avisos = Vec::new();
    let (inst, wanted): (SemanticInstance, Vec<(String, i64)>) = match &req.graph_json {
        Some(g) => {
            if !req.values.is_empty() {
                return Err(from_profile(ProfileError::ParamsConflict));
            }
            let (rev, inst) = engine.review(rom, before, entry, g).map_err(from_profile)?;
            if !rev.structural_ok || !rev.problems.is_empty() {
                let mut motivos = rev.differences.clone();
                motivos.extend(rev.problems.clone());
                return Err(from_profile(ProfileError::GraphDiverges(motivos)));
            }
            if rev.legacy_binding {
                avisos.push(LEGACY_AVISO.to_string());
            }
            (inst, rev.changes)
        }
        None => {
            let selection = match req.region_selection.as_deref() {
                Some("structural_scan") => SelectionMode::StructuralScan,
                Some("declared_region") => SelectionMode::DeclaredRegion,
                _ => {
                    return Err(fail(
                        "invalid_request",
                        "region_selection e region_exits são obrigatórios para a classe semântica sem grafo",
                    ))
                }
            };
            let inst = engine
                .instance(rom, before, entry, &req.region_exits, selection)
                .map_err(from_profile)?;
            (
                inst,
                req.values.iter().map(|(k, v)| (k.clone(), *v)).collect(),
            )
        }
    };
    if wanted.iter().any(|(n, _)| *n != field) {
        return Err(from_profile(ProfileError::FieldUnavailable));
    }
    let Some((_, threshold)) = wanted.first().cloned() else {
        return Err(from_profile(ProfileError::NoChange));
    };
    let (patches, checksum_updated) = engine
        .plan(rom, before, &inst, threshold)
        .map_err(from_profile)?;
    if checksum_updated {
        avisos.push("O checksum do cabeçalho (0x18E) também foi atualizado, porque a ROM de origem o tinha válido.".to_string());
    }
    let (exits, selection) = (inst.exits.clone(), inst.selection);
    Ok(Planned {
        profile_id: engine.spec().id.clone(),
        profile_sha256: engine.profile_sha256().to_string(),
        artifact_tag: engine.spec().artifact_tag.clone(),
        applied: vec![(field.clone(), threshold)],
        patches,
        avisos,
        checksum_updated,
        reread: Box::new(move |copy| {
            // a cópia é re-analisada do zero: o limiar relido vem dos bytes dela
            let after = sha256_hex(copy);
            let relido = SemanticEngine::new(
                super::rex_profile_semantic::SemanticSpec {
                    rom_binding: RomBinding::Signature,
                    ..engine.spec().clone()
                },
                engine.profile_sha256(),
            )
            .ok()?
            .instance(copy, &after, entry, &exits, selection)
            .ok()?;
            Some(vec![(field.clone(), relido.value)])
        }),
    })
}

pub fn ipc_edit(req: &ProfileEditRequest) -> Result<ProfileEditResponse, InspectionError> {
    ipc_edit_with(&RealFs, req)
}

/// Revisão do grafo com os motivos de recusa na forma de erro.
fn reviewed(
    engine: &Engine,
    rom: &[u8],
    sha: &str,
    instance_offset: usize,
    g: &str,
) -> Result<GraphReview, ProfileError> {
    let rev = graph::review_graph(engine, rom, sha, instance_offset, g)?;
    if !rev.structural_ok || !rev.problems.is_empty() {
        let mut motivos = rev.differences.clone();
        motivos.extend(rev.problems.clone());
        return Err(ProfileError::GraphDiverges(motivos));
    }
    Ok(rev)
}

pub(crate) fn ipc_edit_with(
    fs: &dyn Fs,
    req: &ProfileEditRequest,
) -> Result<ProfileEditResponse, InspectionError> {
    request_ok(&req.request_id)?;
    let rom = read_rom(&req.rom_path)?;
    let before = sha256_hex(&rom);
    // identidade ANTES de qualquer outra coisa: ROM trocada entre localizar e gerar não deixa rastro
    if req.expected_rom_sha256.len() != 64 || req.expected_rom_sha256 != before {
        return Err(fail(
            "identity_mismatch",
            format!(
                "a ROM em disco ({}…) não é a da localização/grafo ({}…); localize de novo a partir desta ROM",
                &before[..12],
                &req.expected_rom_sha256[..req.expected_rom_sha256.len().min(12)]
            ),
        ));
    }
    let out_dir = Path::new(&req.output_dir);
    if req.output_dir.trim().is_empty() || !out_dir.is_dir() {
        return Err(fail(
            "invalid_request",
            "output_dir deve ser um diretório existente",
        ));
    }
    let reg = registry(&req.profiles_dir);
    // a CLASSE do perfil carregado decide o plano; a publicação é a mesma para todas
    let planned = if let Some(loaded) = reg.find(&req.profile_id) {
        plan_signature(loaded, req, &rom, &before)?
    } else if let Some(loaded) = reg.find_semantic(&req.profile_id) {
        plan_semantic(loaded, req, &rom, &before)?
    } else {
        return Err(from_profile(ProfileError::ProfileUnknown(
            req.profile_id.clone(),
        )));
    };
    let Planned {
        profile_id,
        profile_sha256,
        artifact_tag,
        applied,
        patches,
        mut avisos,
        checksum_updated,
        reread,
    } = planned;
    let edit_err = |e: rex_edit::EditError| from_profile(ProfileError::from(e));
    let novo = rex_edit::apply(&rom, &patches).map_err(edit_err)?;
    let ips = rex_edit::ips(&patches).map_err(edit_err)?; // formato não representa => recusa antes de escrever
    if rex_edit::ips_apply_strict(&rom, &ips).map_err(edit_err)? != novo {
        return Err(fail(
            "verify_failed",
            "o IPS gerado não reproduz a cópia (verificação antes de gravar)",
        ));
    }
    let after = sha256_hex(&novo);
    let stem = Path::new(&req.rom_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("rom")
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();
    let base = format!(
        "{stem}.{}-{:x}-{}",
        artifact_tag,
        req.instance_offset,
        &after[..8]
    );
    let verify = |b: &[u8], i: &[u8]| -> Result<(), PublishError> {
        // o IPS LIDO DE VOLTA, reaplicado por aplicador independente, tem de reproduzir a cópia LIDA DE VOLTA
        let re = rex_edit::ips_apply_strict(&rom, i).map_err(|e| {
            let e = from_profile(ProfileError::from(e));
            PublishError::new(&e.code, e.message)
        })?;
        if re != b || b != novo.as_slice() {
            return Err(PublishError::new(
                "verify_failed",
                "o IPS gravado não reproduz a cópia gravada byte a byte",
            ));
        }
        Ok(())
    };
    let (patched, ips_path, publish_avisos): (PathBuf, PathBuf, Vec<String>) =
        rex_publish::publish_pair(fs, out_dir, &base, &novo, &ips, &verify)
            .map_err(|e| fail(&e.code, e.message))?;
    avisos.extend(publish_avisos);
    let lido = fs
        .read(&patched)
        .map_err(|e| fail("io_error", format!("falha ao reler a cópia publicada: {e}")))?;
    if sha256_hex(&lido) != after {
        return Err(fail(
            "verify_failed",
            "a cópia publicada não confere com o esperado",
        ));
    }
    // a cópia tem outro SHA-256: a releitura ignora o vínculo do perfil com a ROM de origem
    let values_after: Vec<(String, i64)> = reread(&lido)
        .ok_or_else(|| fail("verify_failed", "a instância sumiu da cópia publicada"))?;
    // o que foi pedido tem de ser o que a cópia contém
    if applied
        .iter()
        .any(|(n, v)| !values_after.iter().any(|(m, w)| m == n && w == v))
    {
        return Err(fail(
            "verify_failed",
            "os valores relidos da cópia não são os pedidos",
        ));
    }
    let original_untouched = fs
        .read(Path::new(&req.rom_path))
        .map(|b| sha256_hex(&b) == before)
        .unwrap_or(false);
    Ok(ProfileEditResponse {
        request_id: req.request_id.clone(),
        app_session: app_session().to_string(),
        observations: vec![
            AppObservation::now("copy_reread", &req.request_id),
            AppObservation::now("ips_reproduces_copy", &req.request_id),
        ],
        rom_sha256_before: before.clone(),
        rom_sha256_after: after,
        identity_rom_sha256: before,
        profile_id,
        profile_sha256,
        instance_offset: req.instance_offset,
        values_applied: applied,
        patched_path: patched.to_string_lossy().into_owned(),
        ips_path: ips_path.to_string_lossy().into_owned(),
        ips_sha256: sha256_hex(&ips),
        bytes_changed: (0..rom.len()).filter(|i| rom[*i] != lido[*i]).count(),
        patches,
        size_unchanged: lido.len() == rom.len(),
        original_untouched,
        ips_reproduces_copy: true,
        values_after,
        avisos,
        checksum_updated,
    })
}

#[cfg(test)]
mod tests {
    use super::super::rex_profile_testkit::*;
    use super::super::rex_publish::WriteFail;
    use super::*;
    use serde_json::{json, Value};
    use std::cell::RefCell;

    /// Pasta de trabalho com a ROM sintética, uma pasta de perfis com o perfil mínimo e uma de saída.
    struct Bench {
        root: PathBuf,
        rom: String,
        profiles: String,
        out: String,
        sha: String,
    }

    fn bench(nome: &str) -> Bench {
        let root =
            std::env::temp_dir().join(format!("rex-profile-ipc-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("perfis")).unwrap();
        fs::create_dir_all(root.join("saida")).unwrap();
        fs::write(root.join("rom.bin"), mini_rom()).unwrap();
        fs::write(root.join("perfis/mini.json"), text(&mini())).unwrap();
        Bench {
            rom: root.join("rom.bin").to_string_lossy().into_owned(),
            profiles: root.join("perfis").to_string_lossy().into_owned(),
            out: root.join("saida").to_string_lossy().into_owned(),
            sha: sha256_hex(&mini_rom()),
            root,
        }
    }

    impl Drop for Bench {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    impl Bench {
        fn locate(&self) -> ProfileLocateResponse {
            ipc_locate(&ProfileLocateRequest {
                rom_path: self.rom.clone(),
                request_id: "loc-1".into(),
                profiles_dir: Some(self.profiles.clone()),
                declared_regions: Vec::new(),
            })
            .unwrap()
        }
        fn mini_match(&self) -> ProfileMatch {
            self.locate()
                .matches
                .into_iter()
                .find(|m| m.profile.id == MINI_ID)
                .expect("perfil da pasta carregado")
        }
        fn edit_req(&self, values: &[(&str, i64)]) -> ProfileEditRequest {
            ProfileEditRequest {
                rom_path: self.rom.clone(),
                profile_id: MINI_ID.into(),
                profile_sha256: Some(self.mini_match().profile.sha256),
                instance_offset: A1,
                values: values.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
                graph_json: None,
                output_dir: self.out.clone(),
                request_id: "edit-1".into(),
                expected_rom_sha256: self.sha.clone(),
                profiles_dir: Some(self.profiles.clone()),
                region_exits: Vec::new(),
                region_selection: None,
            }
        }
        fn outputs(&self) -> Vec<String> {
            let mut v: Vec<String> = fs::read_dir(&self.out)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            v.sort();
            v
        }
        fn rom_intact(&self) -> bool {
            fs::read(&self.rom).unwrap() == mini_rom()
        }
    }

    #[test]
    fn catalogo_diz_de_onde_veio_cada_perfil_e_o_que_ele_nao_prova() {
        let b = bench("catalogo");
        let only = ipc_catalog(&ProfileCatalogRequest {
            request_id: "c".into(),
            profiles_dir: None,
        })
        .unwrap();
        assert!(only.profiles.iter().all(|p| p.origin == Origin::Builtin));
        assert!(!only.profiles.iter().any(|p| p.id == MINI_ID));
        let c = ipc_catalog(&ProfileCatalogRequest {
            request_id: "c".into(),
            profiles_dir: Some(b.profiles.clone()),
        })
        .unwrap();
        let m = c.profiles.iter().find(|p| p.id == MINI_ID).unwrap();
        assert_eq!(
            (
                m.origin,
                m.revision,
                m.rom_binding.as_str(),
                m.instance_param.as_str()
            ),
            (Origin::Directory, 1, "signature", "gate_offset")
        );
        assert_eq!(m.sha256, sha256_hex(text(&mini()).as_bytes()));
        assert_eq!(
            m.editable,
            [
                "Limite: 1..1000 (inteiro de 16 bits com sinal, big-endian)",
                "Piso: 0..200 (inteiro de 8 bits sem sinal, big-endian)",
                "Teto: 0..100000 (inteiro de 32 bits sem sinal, little-endian)",
            ]
        );
        assert!(m.claims.is_empty() && !m.unknown.is_empty() && !m.limits.is_empty());
        assert!(c.engine_limits.iter().any(|l| l.contains("prova a forma")));
        assert!(c
            .engine_limits
            .iter()
            .any(|l| l.contains("não recompila o grafo")));
        // o primeiro perfil traz as medições COM escopo
        let j = only
            .profiles
            .iter()
            .find(|p| !p.claims.is_empty())
            .expect("perfil com efeito medido");
        assert!(j
            .claims
            .iter()
            .all(|c| !c.refs.is_empty() && !c.roms.is_empty() && !c.values.is_empty()));
        assert!(ipc_catalog(&ProfileCatalogRequest {
            request_id: String::new(),
            profiles_dir: None
        })
        .is_err());
    }

    #[test]
    fn localizar_tenta_todos_os_perfis_e_nunca_afirma_consumo() {
        let b = bench("localizar");
        let r = b.locate();
        assert_eq!(
            (r.rom_sha256.as_str(), r.rom_size, r.request_id.as_str()),
            (b.sha.as_str(), 0x200, "loc-1")
        );
        // um item por perfil carregado: quem não reconhece aparece com zero instâncias, não some
        assert!(r.matches.len() >= 2);
        assert!(r
            .matches
            .iter()
            .filter(|m| m.profile.id != MINI_ID)
            .all(|m| m.instances.is_empty() && m.error.is_none()));
        let m = b.mini_match();
        assert_eq!(m.instances.len(), 2);
        let i = &m.instances[0];
        assert_eq!(
            (i.instance_offset, i.instance_bus_address),
            (A1, Some(A1 as u64))
        );
        assert!(m.instances.iter().all(|i| !i.consumer_observed));
        assert_eq!(
            i.fields
                .iter()
                .map(|f| (f.name.as_str(), f.value))
                .collect::<Vec<_>>(),
            [("lim", 300), ("low", 80), ("top", 100_000)]
        );
        assert!(i
            .fields
            .iter()
            .all(|f| f.static_level == EvidenceLevel::L2Consistency && f.claims.is_empty()));
        assert_eq!(
            m.instances[1].fields[0].static_level,
            EvidenceLevel::L1StaticForm
        );
        let ram = i.captures.iter().find(|c| c.name == "ram").unwrap();
        assert_eq!(
            (
                ram.file_offset,
                ram.designates_bus_address,
                ram.designates_file_offset
            ),
            (C1 + 10, Some(0xFF_F602), None)
        );
        let g: Value = serde_json::from_str(&i.graph_json).unwrap();
        assert_eq!(g["rex_logic_recovery"]["profile_id"], MINI_ID);
    }

    #[test]
    fn escopo_declarado_de_outra_instancia_nao_e_apresentado_como_desta() {
        // a ROM sintética tem a forma do perfil com afirmações L5, mas NÃO é uma das ROMs do escopo
        let b = bench("escopo");
        let other = "b".repeat(64);
        fs::write(
            Path::new(&b.profiles).join("mini.json"),
            text(&mini_with(|m| {
                m["evidence"]["claims"] = json!([{"id": "medido", "level": "L5", "fields": ["lim"], "statement": "efeito medido",
                    "scope": {"roms": [{"sha256": other, "instance_offsets": [64]}, {"sha256": b.sha, "instance_offsets": [256]}],
                              "values": [{"field": "lim", "values": [300, 400]}], "conditions": "bancada"},
                    "refs": ["docs/medicao.md"]}]);
            })),
        )
        .unwrap();
        let m = b.mini_match();
        let lim = |i: usize| {
            m.instances[i]
                .fields
                .iter()
                .find(|f| f.name == "lim")
                .unwrap()
                .claims[0]
                .clone()
        };
        // o escopo DECLARADO cita a instância 0x100 desta ROM, não a A1 — e nos dois casos é só declaração:
        // um perfil de pasta não tem registro curado
        assert_eq!(lim(0).declared_scope_matches, false);
        assert_eq!(lim(1).declared_scope_matches, true);
        assert!([lim(0), lim(1)]
            .iter()
            .all(|c| c.origin == ClaimOrigin::Declared
                && c.applicability == Applicability::NotCurated
                && c.records.is_empty()));
        assert_eq!(lim(1).values, [300, 400]);
        assert!(m.instances[0]
            .fields
            .iter()
            .find(|f| f.name == "low")
            .unwrap()
            .claims
            .is_empty());
        // mesmo com efeito medido, o consumo continua não observado, e o nível estático não sobe
        assert!(m.instances.iter().all(|i| !i.consumer_observed));
        assert_eq!(
            m.instances[1].fields[0].static_level,
            EvidenceLevel::L1StaticForm
        );
    }

    #[test]
    fn editar_pelo_formulario_publica_copia_e_ips_e_preserva_o_resto() {
        let b = bench("form");
        let r = ipc_edit(&b.edit_req(&[("top", 77), ("lim", 999)])).unwrap();
        // ordem do PERFIL, não a do pedido
        assert_eq!(
            r.values_applied,
            [("lim".to_string(), 999), ("top".to_string(), 77)]
        );
        assert_eq!(
            (
                r.profile_id.as_str(),
                r.instance_offset,
                r.request_id.as_str()
            ),
            (MINI_ID, A1, "edit-1")
        );
        assert_eq!(r.identity_rom_sha256, b.sha);
        assert!(
            r.size_unchanged && r.original_untouched && r.ips_reproduces_copy && b.rom_intact()
        );
        assert_eq!(
            r.values_after,
            [
                ("lim".to_string(), 999),
                ("low".to_string(), 80),
                ("top".to_string(), 77)
            ]
        );
        let base = format!("rom.mini-{A1:x}-{}", &r.rom_sha256_after[..8]);
        assert_eq!(b.outputs(), [format!("{base}.bin"), format!("{base}.ips")]);
        let copy = fs::read(&r.patched_path).unwrap();
        let rom = mini_rom();
        let diff: Vec<usize> = (0..rom.len()).filter(|i| rom[*i] != copy[*i]).collect();
        assert_eq!(r.bytes_changed, diff.len());
        assert!(
            diff.iter()
                .all(|i| (A1 + 2..A1 + 4).contains(i) || (C1 + 2..C1 + 6).contains(i)),
            "{diff:?}"
        );
        // reaplicação INDEPENDENTE: o IPS do disco sobre a ROM original dá a cópia do disco
        let ips = fs::read(&r.ips_path).unwrap();
        assert_eq!(rex_edit::ips_apply_strict(&rom, &ips).unwrap(), copy);
        assert_eq!(sha256_hex(&ips), r.ips_sha256);
        // gerar de novo os mesmos valores não sobrescreve
        let again = ipc_edit(&b.edit_req(&[("top", 77), ("lim", 999)])).unwrap_err();
        assert_eq!(again.code, "output_exists_or_unwritable");
        assert_eq!(b.outputs().len(), 2);
    }

    #[test]
    fn salvar_reabrir_e_editar_pelo_grafo() {
        let b = bench("grafo");
        let m = b.mini_match();
        // "salvar": o grafo vira texto no disco; "reabrir": lê do disco e edita os valores dos nós
        let saved = Path::new(&b.out).join("../grafo-salvo.json");
        fs::write(&saved, &m.instances[0].graph_json).unwrap();
        let mut g: Value = serde_json::from_str(&fs::read_to_string(&saved).unwrap()).unwrap();
        for n in g["nodes"].as_array_mut().unwrap() {
            if n["params"]["campo"] == "low" {
                n["params"]["value"] = json!(123);
            }
            n["x"] = json!(1); // reorganizado no canvas
        }
        let mut req = b.edit_req(&[]);
        req.graph_json = Some(g.to_string());
        let r = ipc_edit(&req).unwrap();
        assert_eq!(r.values_applied, [("low".to_string(), 123)]);
        assert_eq!(fs::read(&r.patched_path).unwrap()[B1 + 3], 123);
        assert!(r.avisos.is_empty(), "{:?}", r.avisos);
        assert!(b.rom_intact());
        // formulário E grafo no mesmo pedido: recusa
        let mut both = b.edit_req(&[("lim", 2)]);
        both.graph_json = Some(g.to_string());
        assert_eq!(ipc_edit(&both).unwrap_err().code, "params-conflict");
        // grafo sem mudança: nada a gerar
        let mut none = b.edit_req(&[]);
        none.graph_json = Some(m.instances[0].graph_json.clone());
        assert_eq!(ipc_edit(&none).unwrap_err().code, "no-change");
        // grafo adulterado: recusa com os motivos, sem arquivo novo
        let before = b.outputs();
        g["nodes"].as_array_mut().unwrap().remove(1);
        let mut bad = b.edit_req(&[]);
        bad.graph_json = Some(g.to_string());
        let e = ipc_edit(&bad).unwrap_err();
        assert_eq!(e.code, "graph-diverges");
        assert!(e.message.contains("nó removido: cmp"), "{}", e.message);
        assert_eq!(b.outputs(), before);
    }

    #[test]
    fn recusas_nao_deixam_arquivo_e_cada_uma_tem_o_seu_codigo() {
        let b = bench("recusas");
        let code = |req: ProfileEditRequest| {
            let e = ipc_edit(&req).unwrap_err();
            assert!(b.outputs().is_empty(), "recusa '{}' deixou arquivo", e.code);
            assert!(b.rom_intact());
            e.code
        };
        let with = |f: &dyn Fn(&mut ProfileEditRequest)| {
            let mut r = b.edit_req(&[("lim", 400)]);
            f(&mut r);
            r
        };
        assert_eq!(
            code(with(&|r| r.values = [("lim".to_string(), 1001)].into())),
            "out-of-range"
        );
        assert_eq!(
            code(with(&|r| r.values = [("low".to_string(), 256)].into())),
            "out-of-range"
        );
        assert_eq!(
            code(with(&|r| r.values = [("lim".to_string(), 300)].into())),
            "no-change"
        );
        assert_eq!(code(with(&|r| r.values.clear())), "no-change");
        assert_eq!(
            code(with(&|r| r.values = [("nao_existe".to_string(), 1)].into())),
            "field-unavailable"
        );
        // a segunda instância não tem o campo `low` (sem par)
        assert_eq!(
            code(with(&|r| {
                r.instance_offset = A2;
                r.values = [("low".to_string(), 1)].into();
            })),
            "field-unavailable"
        );
        assert_eq!(
            code(with(&|r| r.instance_offset = 0x44)),
            "instance-not-found"
        );
        assert_eq!(
            code(with(&|r| r.profile_id = "m68k.fantasma.v1".into())),
            "profile-unknown"
        );
        // o perfil autoral não foi informado: não está carregado
        assert_eq!(code(with(&|r| r.profiles_dir = None)), "profile-unknown");
        assert_eq!(
            code(with(&|r| r.profile_sha256 = Some("0".repeat(64)))),
            "profile-mismatch"
        );
        assert_eq!(
            code(with(&|r| r.expected_rom_sha256 = "0".repeat(64))),
            "identity_mismatch"
        );
        assert_eq!(
            code(with(&|r| r.expected_rom_sha256 = String::new())),
            "identity_mismatch"
        );
        assert_eq!(
            code(with(&|r| r.output_dir = "/nao/existe".into())),
            "invalid_request"
        );
        assert_eq!(
            code(with(&|r| r.request_id = String::new())),
            "invalid_request"
        );
        assert_eq!(
            code(with(&|r| r.rom_path = "/nao/existe.bin".into())),
            "invalid_request"
        );
    }

    #[test]
    fn rom_trocada_entre_localizar_e_gerar_e_recusada() {
        let b = bench("rom-trocada");
        let req = b.edit_req(&[("lim", 400)]);
        // outra ROM no mesmo caminho, com a MESMA forma e outro valor
        let mut other = mini_rom();
        put(&mut other, A1, &pat_a(301, 0x10));
        fs::write(&b.rom, &other).unwrap();
        let e = ipc_edit(&req).unwrap_err();
        assert_eq!(e.code, "identity_mismatch");
        assert!(b.outputs().is_empty());
        assert_eq!(
            fs::read(&b.rom).unwrap(),
            other,
            "a ROM trocada também não é tocada"
        );
    }

    #[test]
    fn perfil_alterado_entre_localizar_e_gerar_e_recusado() {
        let b = bench("perfil-trocado");
        let req = b.edit_req(&[("lim", 400)]);
        let graph = b.mini_match().instances[0].graph_json.clone();
        // o MESMO id, com o domínio alargado: é outro dado
        fs::write(
            Path::new(&b.profiles).join("mini.json"),
            text(&mini_with(|m| m["fields"][0]["max"] = json!(5000))),
        )
        .unwrap();
        assert_eq!(ipc_edit(&req).unwrap_err().code, "profile-mismatch");
        // pelo grafo salvo, sem o hash no pedido: o hash gravado no nó de entrada recusa do mesmo jeito
        let mut by_graph = b.edit_req(&[]);
        by_graph.profile_sha256 = None;
        let mut g: Value = serde_json::from_str(&graph).unwrap();
        for n in g["nodes"].as_array_mut().unwrap() {
            if n["params"]["campo"] == "lim" {
                n["params"]["value"] = json!(4000); // só caberia no perfil alterado
            }
        }
        by_graph.graph_json = Some(g.to_string());
        assert_eq!(ipc_edit(&by_graph).unwrap_err().code, "profile-mismatch");
        assert!(b.outputs().is_empty() && b.rom_intact());
    }

    /// Sistema de arquivos que falha na N-ésima escrita (deixando ou não um arquivo parcial nosso).
    struct Faulty {
        fail_at: usize,
        created: bool,
        writes: RefCell<usize>,
    }

    impl Fs for Faulty {
        fn write_new(&self, p: &Path, bytes: &[u8]) -> Result<(), WriteFail> {
            *self.writes.borrow_mut() += 1;
            if *self.writes.borrow() == self.fail_at {
                let e = std::io::Error::other("injetado: disco cheio");
                if self.created {
                    let _ = fs::write(p, &bytes[..bytes.len() / 2]);
                    return Err(WriteFail::Created(e));
                }
                return Err(WriteFail::NotCreated(e));
            }
            RealFs.write_new(p, bytes)
        }
        fn hard_link(&self, from: &Path, to: &Path) -> std::io::Result<()> {
            RealFs.hard_link(from, to)
        }
        fn remove(&self, p: &Path) -> std::io::Result<()> {
            RealFs.remove(p)
        }
        fn same_file(&self, a: &Path, b: &Path) -> bool {
            RealFs.same_file(a, b)
        }
        fn exists(&self, p: &Path) -> bool {
            RealFs.exists(p)
        }
        fn read(&self, p: &Path) -> std::io::Result<Vec<u8>> {
            RealFs.read(p)
        }
    }

    #[test]
    fn falha_de_publicacao_nao_altera_a_original_nem_deixa_metade() {
        for (fail_at, created) in [(1, false), (1, true), (2, false), (2, true)] {
            let b = bench(&format!("pub-{fail_at}-{created}"));
            let fs_ = Faulty {
                fail_at,
                created,
                writes: RefCell::new(0),
            };
            let e = ipc_edit_with(&fs_, &b.edit_req(&[("lim", 400)])).unwrap_err();
            assert!(!e.code.is_empty());
            assert!(
                b.outputs().is_empty(),
                "falha na escrita {fail_at} (criado={created}) deixou {:?}",
                b.outputs()
            );
            assert!(b.rom_intact());
            // e, depois da falha, a mesma edição ainda funciona (nada ficou no caminho)
            assert!(ipc_edit(&b.edit_req(&[("lim", 400)])).is_ok());
            assert_eq!(b.outputs().len(), 2);
        }
    }

    #[test]
    fn perfil_recusado_na_pasta_aparece_como_rejeitado_e_nao_trava_os_outros() {
        let b = bench("rejeitado");
        fs::write(Path::new(&b.profiles).join("quebrado.json"), "{").unwrap();
        let r = b.locate();
        assert_eq!(r.rejected.len(), 1);
        assert_eq!(r.rejected[0].rule, "parse");
        assert_eq!(b.mini_match().instances.len(), 2);
        // limite de trabalho estourado por UM perfil vira erro DAQUELE perfil
        fs::write(
            Path::new(&b.profiles).join("mini.json"),
            text(&mini_with(|m| m["work_limits"]["max_instances"] = json!(1))),
        )
        .unwrap();
        let m = b.mini_match();
        assert_eq!(
            m.error.as_ref().map(|e| e.code.as_str()),
            Some("work-limit")
        );
        assert!(m.instances.is_empty());
        assert!(b
            .locate()
            .matches
            .iter()
            .any(|x| x.profile.id != MINI_ID && x.error.is_none()));
    }

    /// N1 (Etapa 2): um perfil de PASTA que alega causalidade (L5) com referências e o SHA certo da ROM
    /// não ganha rótulo de evidência verificada: é só declaração do autor.
    #[test]
    fn perfil_externo_alegando_causalidade_e_so_declaracao() {
        let b = bench("origem");
        fs::write(
            Path::new(&b.profiles).join("mini.json"),
            text(&mini_with(|m| {
                m["evidence"]["claims"] = json!([{"id": "medido", "level": "L5", "fields": ["lim"], "statement": "efeito medido",
                    "scope": {"roms": [{"sha256": b.sha, "instance_offsets": [64]}],
                              "values": [{"field": "lim", "values": [300, 400]}], "conditions": "bancada"},
                    "refs": ["docs/medicao.md", "data/relatorio-que-nao-existe.json"]}]);
            })),
        )
        .unwrap();
        let v = serde_json::to_value(b.locate()).unwrap();
        let m = v["matches"]
            .as_array()
            .unwrap()
            .iter()
            .find(|m| m["profile"]["id"] == MINI_ID)
            .unwrap();
        let claim = &m["instances"][0]["fields"][0]["claims"][0];
        assert_eq!(claim["origin"], "declared", "{claim}");
        assert_eq!(claim["applicability"], "not_curated");
        assert_eq!(claim["records"], json!([]));
        // o escopo DECLARADO bate com esta ROM e instância — e continua sendo só declaração
        assert_eq!(claim["declared_scope_matches"], true);
        assert!(
            claim.get("this_instance").is_none() && claim.get("this_rom").is_none(),
            "rótulo antigo de medição"
        );
        // a única coisa que o aplicativo OBSERVOU foi o reconhecimento estático, nesta sessão
        let obs = &m["instances"][0]["observations"];
        assert_eq!(obs[0]["kind"], "static_form_matched");
        assert_eq!(obs[0]["session"], v["app_session"]);
        assert!(obs
            .as_array()
            .unwrap()
            .iter()
            .all(|o| o["kind"] != "effect_measured"));
    }

    /// N2: toda afirmação de perfil EMBUTIDO tem registro curado (referência que existe); senão é só declaração.
    #[test]
    fn afirmacoes_dos_perfis_embutidos_tem_registro_curado_integro() {
        let c = serde_json::to_value(
            ipc_catalog(&ProfileCatalogRequest {
                request_id: "c".into(),
                profiles_dir: None,
            })
            .unwrap(),
        )
        .unwrap();
        let mut vistos = 0;
        for p in c["profiles"].as_array().unwrap() {
            for claim in p["claims"].as_array().unwrap() {
                vistos += 1;
                assert_eq!(claim["origin"], "curated", "{}: {}", p["id"], claim["id"]);
                let recs = claim["records"].as_array().unwrap();
                assert!(!recs.is_empty());
                for r in recs {
                    // integridade do registro: o relatório citado existe no repositório e tem o SHA registrado
                    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join("..")
                        .join(r["report"]["path"].as_str().unwrap());
                    let bytes = fs::read(&path)
                        .unwrap_or_else(|_| panic!("relatório ausente: {}", path.display()));
                    assert_eq!(
                        sha256_hex(&bytes),
                        r["report"]["sha256"].as_str().unwrap(),
                        "{}",
                        path.display()
                    );
                }
            }
        }
        assert!(vistos > 0, "nenhuma afirmação embutida conferida");
    }

    fn claims_do_primeiro_campo(rom_path: &str) -> Vec<(usize, Value)> {
        let r = ipc_locate(&ProfileLocateRequest {
            rom_path: rom_path.to_string(),
            request_id: "origem".into(),
            profiles_dir: None,
            declared_regions: Vec::new(),
        })
        .unwrap();
        let v = serde_json::to_value(r).unwrap();
        v["matches"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|m| m["instances"].as_array().unwrap().clone())
            .filter(|i| !i["fields"][0]["claims"].as_array().unwrap().is_empty())
            .map(|i| {
                (
                    i["instance_offset"].as_u64().unwrap() as usize,
                    i["fields"][0]["claims"][0].clone(),
                )
            })
            .collect()
    }

    /// N3 pelo produto: o perfil embutido TEM registros curados íntegros, mas a ROM sintética com a mesma
    /// forma não é nenhuma das ROMs medidas — o registro existe e não vale para ela.
    #[test]
    fn registro_curado_de_outra_rom_nao_vale_para_a_rom_que_so_tem_a_forma() {
        let b = bench("outra-rom");
        fs::write(&b.rom, super::super::rex_platformer_jump::fixture_rom()).unwrap();
        let claims = claims_do_primeiro_campo(&b.rom);
        assert!(
            !claims.is_empty(),
            "a ROM sintética tem a forma do perfil embutido com afirmações"
        );
        for (_, c) in &claims {
            assert_eq!(c["origin"], "curated");
            assert_eq!(c["applicability"], "other_target", "{c}");
            assert_eq!(c["declared_scope_matches"], false);
            assert_eq!(c["inherited"], false);
        }
    }

    /// BYOR: nas ROMs reais, só a instância medida tem registro aplicável; as outras instâncias da mesma
    /// ROM têm o registro e ele não vale para elas.
    #[test]
    #[ignore = "BYOR: exige RDS_INSPECTION_ROM e/ou RDS_JUMP_DELTA_ROM"]
    fn registros_curados_nas_roms_reais_valem_so_para_a_instancia_medida() {
        let mut vistos = 0;
        for (var, medida) in [
            ("RDS_INSPECTION_ROM", 0x1340Cusize),
            ("RDS_JUMP_DELTA_ROM", 0x16914),
        ] {
            let Ok(path) = std::env::var(var) else {
                continue;
            };
            let claims = claims_do_primeiro_campo(&path);
            assert!(claims.iter().any(|(o, _)| *o == medida), "{var}");
            for (off, c) in &claims {
                let esperado = if *off == medida {
                    "this_instance"
                } else {
                    "other_target"
                };
                assert_eq!(c["applicability"], esperado, "{var} {off:#x}");
                assert_eq!(c["origin"], "curated");
                if *off == medida {
                    // há um registro medido sob ESTE arquivo de perfil e um anterior, herdado
                    let recs = c["records"].as_array().unwrap();
                    assert_eq!(recs.len(), 2, "{var}");
                    assert!(recs
                        .iter()
                        .any(|r| r["measured_under"]["profile_form"] == "code"));
                    assert!(recs
                        .iter()
                        .any(|r| r["measured_under"]["profile_form"] == "data"));
                    assert_eq!(c["inherited"], false);
                }
                println!("{var} {off:#x}: {}", c["applicability"]);
            }
            vistos += 1;
        }
        assert!(
            vistos > 0,
            "defina RDS_INSPECTION_ROM e/ou RDS_JUMP_DELTA_ROM"
        );
    }

    // ------------------------------------------------------------ classe semântica (F1b)

    const GATE: &str = "m68k.counter_threshold_state_gate.v1";

    struct GateBench {
        root: PathBuf,
        rom: String,
        out: String,
        sha: String,
        bytes: Vec<u8>,
    }

    impl Drop for GateBench {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn gate_bench(nome: &str, bytes: Vec<u8>) -> GateBench {
        let root = std::env::temp_dir().join(format!("rex-gate-ipc-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("saida")).unwrap();
        fs::write(root.join("rom.bin"), &bytes).unwrap();
        GateBench {
            rom: root.join("rom.bin").to_string_lossy().into_owned(),
            out: root.join("saida").to_string_lossy().into_owned(),
            sha: sha256_hex(&bytes),
            bytes,
            root,
        }
    }

    impl GateBench {
        fn locate(&self, declared: Vec<DeclaredRegion>) -> ProfileLocateResponse {
            ipc_locate(&ProfileLocateRequest {
                rom_path: self.rom.clone(),
                request_id: "gate-loc".into(),
                profiles_dir: None,
                declared_regions: declared,
            })
            .unwrap()
        }
        fn gate(&self, declared: Vec<DeclaredRegion>) -> ProfileMatch {
            self.locate(declared)
                .matches
                .into_iter()
                .find(|m| m.profile.id == GATE)
                .unwrap()
        }
        fn req(&self, inst: &InstanceView, profile_sha: &str) -> ProfileEditRequest {
            ProfileEditRequest {
                rom_path: self.rom.clone(),
                profile_id: GATE.into(),
                profile_sha256: Some(profile_sha.to_string()),
                instance_offset: inst.instance_offset,
                values: BTreeMap::new(),
                graph_json: None,
                output_dir: self.out.clone(),
                request_id: "gate-edit".into(),
                expected_rom_sha256: self.sha.clone(),
                profiles_dir: None,
                region_exits: inst.region_exits.clone(),
                region_selection: Some(inst.selection.mode.clone()),
            }
        }
        fn outputs(&self) -> Vec<String> {
            let mut v: Vec<String> = fs::read_dir(&self.out)
                .unwrap()
                .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            v.sort();
            v
        }
    }

    #[test]
    fn classe_semantica_aparece_no_mesmo_catalogo_e_na_mesma_localizacao() {
        let c = ipc_catalog(&ProfileCatalogRequest {
            request_id: "c".into(),
            profiles_dir: None,
        })
        .unwrap();
        let g = c
            .profiles
            .iter()
            .find(|p| p.id == GATE)
            .expect("perfil semântico no catálogo");
        assert_eq!(g.class, "semantic_region");
        assert_eq!(g.selection_modes, ["structural_scan", "declared_region"]);
        assert_eq!(
            (g.origin, g.revision, g.instance_param.as_str()),
            (Origin::Builtin, 1, "entry")
        );
        assert_eq!(g.sha256.len(), 64);
        assert!(c.profiles.iter().any(|p| p.class == "signature"));
        // a afirmação histórica da classe é curada (herdada de quando era só código), não observada
        assert_eq!(g.claims[0].origin, ClaimOrigin::Curated);
        assert_eq!(g.claims[0].records[0].measured_under.profile_form, "code");

        let b = gate_bench("loc", authored_gate_rom());
        let r = b.locate(Vec::new());
        // os perfis de assinatura também tentaram esta ROM e não reconheceram nada
        assert!(r
            .matches
            .iter()
            .filter(|m| m.profile.class == "signature")
            .all(|m| m.instances.is_empty() && m.error.is_none()));
        let m = b.gate(Vec::new());
        assert_eq!(m.instances.len(), 1);
        let i = &m.instances[0];
        assert_eq!(
            (i.instance_offset, i.region_exits.clone()),
            (0x400, vec![0x444])
        );
        assert_eq!(i.selection.mode, "structural_scan");
        assert!(i.selection.label.contains("não é descoberta de rotina"));
        assert!(!i.consumer_observed);
        // operações DERIVADAS, parte opaca dita, e o que é declarado separado
        assert_eq!(
            i.operations
                .iter()
                .map(|o| o.kind.as_str())
                .collect::<Vec<_>>(),
            [
                "rom_region_entry",
                "rom_input_bit_guard",
                "rom_counter_add",
                "rom_counter_compare",
                "rom_state_write",
                "rom_external_call",
                "rom_state_write",
                "rom_region_exit",
            ]
        );
        assert!(i
            .operations
            .iter()
            .all(|o| o.origin == "recovered_from_rom"));
        assert_eq!(
            i.operations
                .iter()
                .filter(|o| o.opaque)
                .map(|o| o.id.as_str())
                .collect::<Vec<_>>(),
            ["set_call"]
        );
        assert_eq!(
            i.operations
                .iter()
                .filter(|o| o.editable)
                .map(|o| o.id.as_str())
                .collect::<Vec<_>>(),
            ["compare"]
        );
        assert!(i.notes[0].contains("parte opaca") && i.notes[0].contains("não recuperada"));
        assert!(i
            .declared
            .iter()
            .any(|d| d.contains("propostas pela varredura estrutural")));
        let f = &i.fields[0];
        assert_eq!(
            (f.name.as_str(), f.label.as_str(), f.value, f.min, f.max),
            ("threshold", "Limiar do contador", 40, -128, 127)
        );
        assert_eq!(f.rom_offsets, [0x41B]);
        // o registro curado da classe é de OUTRA ROM: existe e não vale para esta
        assert_eq!(
            (f.claims[0].origin, f.claims[0].applicability),
            (ClaimOrigin::Curated, Applicability::OtherTarget)
        );
        let kinds: Vec<&str> = i.observations.iter().map(|o| o.kind.as_str()).collect();
        assert_eq!(
            kinds,
            ["static_form_matched", "operations_derived_from_bytes"]
        );
        assert!(i.observations.iter().all(|o| o.session == r.app_session));
    }

    #[test]
    fn regiao_declarada_e_rotulada_como_declarada_e_recusa_tem_motivo() {
        let b = gate_bench("decl", crate_fixture("two_passages.hex"));
        // sem declarar nada: só o candidato da varredura (regra 1, com guarda)
        let scan = b.gate(Vec::new());
        assert_eq!(
            scan.instances
                .iter()
                .map(|i| (i.instance_offset, i.selection.mode.as_str()))
                .collect::<Vec<_>>(),
            [(0xA4C, "structural_scan")]
        );
        // declarando a regra 2 (sem guarda): aparece, rotulada como declarada
        let decl = |entry: u32, exits: Vec<u32>| DeclaredRegion {
            profile_id: GATE.into(),
            entry,
            exits,
        };
        let m = b.gate(vec![decl(0xAA0, vec![0xAC8, 0xC7A])]);
        assert_eq!(
            m.instances
                .iter()
                .map(|i| (i.instance_offset, i.selection.mode.as_str()))
                .collect::<Vec<_>>(),
            [(0xA4C, "structural_scan"), (0xAA0, "declared_region")]
        );
        let d = &m.instances[1];
        assert_eq!(
            (d.fields[0].value, d.region_exits.clone()),
            (60, vec![0xAC8, 0xC7A])
        );
        assert!(d
            .selection
            .label
            .contains("nada foi descoberto automaticamente"));
        assert!(d
            .declared
            .iter()
            .any(|x| x.contains("informadas pelo usuário")));
        // declarar a MESMA entrada do candidato: fica uma instância, a declarada
        let same = b.gate(vec![decl(0xA4C, vec![0xA76])]);
        assert_eq!(
            same.instances
                .iter()
                .map(|i| (i.instance_offset, i.selection.mode.as_str()))
                .collect::<Vec<_>>(),
            [(0xA4C, "declared_region")]
        );
        // região que o analisador recusa: erro do perfil nesta ROM, com o motivo; o candidato continua
        let bad = b.gate(vec![decl(0xAA0, vec![0xFFFE])]);
        assert_eq!(
            bad.error.as_ref().map(|e| e.code.as_str()),
            Some("region-refused")
        );
        assert_eq!(bad.instances.len(), 1);
        // região declarada para um perfil que não é da classe / não existe: dito, não ignorado
        let r = b.locate(vec![DeclaredRegion {
            profile_id: "m68k.platformer_jump.v1".into(),
            entry: 0xAA0,
            exits: vec![0xAC8],
        }]);
        assert_eq!(
            r.rejected
                .iter()
                .map(|x| x.rule.as_str())
                .collect::<Vec<_>>(),
            ["profile-unknown"]
        );
    }

    #[test]
    fn editar_o_limiar_usa_a_mesma_publicacao_e_as_mesmas_conferencias() {
        let b = gate_bench("edit", authored_gate_rom());
        let m = b.gate(Vec::new());
        let inst = &m.instances[0];
        let mut req = b.req(inst, &m.profile.sha256);
        req.values = [("threshold".to_string(), 100)].into();
        let r = ipc_edit(&req).unwrap();
        assert_eq!((r.profile_id.as_str(), r.instance_offset), (GATE, 0x400));
        assert_eq!(r.values_applied, [("threshold".to_string(), 100)]);
        assert_eq!(r.values_after, [("threshold".to_string(), 100)]);
        assert!(
            r.size_unchanged && r.original_untouched && r.ips_reproduces_copy && r.checksum_updated
        );
        assert!(r.avisos.iter().any(|a| a.contains("checksum do cabeçalho")));
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes, "original intacta");
        // cópia + IPS publicados juntos, com a marca do perfil no nome
        let base = format!("rom.gate-400-{}", &r.rom_sha256_after[..8]);
        assert_eq!(b.outputs(), [format!("{base}.bin"), format!("{base}.ips")]);
        let copy = fs::read(&r.patched_path).unwrap();
        let diff: Vec<usize> = (0..copy.len())
            .filter(|i| copy[*i] != b.bytes[*i])
            .collect();
        assert!(
            diff.contains(&0x41B)
                && diff
                    .iter()
                    .all(|i| *i == 0x41B || (0x18E..0x190).contains(i)),
            "{diff:x?}"
        );
        assert_eq!(copy[0x41B], 100);
        // reaplicação independente do IPS do disco
        assert_eq!(
            rex_edit::ips_apply_strict(&b.bytes, &fs::read(&r.ips_path).unwrap()).unwrap(),
            copy
        );
        // o checksum da cópia é o padrão válido
        let sum = copy[0x200..].chunks(2).fold(0u32, |a, w| {
            a.wrapping_add(u32::from(u16::from_be_bytes([w[0], w[1]])))
        }) as u16;
        assert_eq!(u16::from_be_bytes([copy[0x18E], copy[0x18F]]), sum);
        // observações: só o que o aplicativo conferiu; nada de efeito
        assert_eq!(
            r.observations
                .iter()
                .map(|o| o.kind.as_str())
                .collect::<Vec<_>>(),
            ["copy_reread", "ips_reproduces_copy"]
        );
        // de novo: não sobrescreve
        assert_eq!(
            ipc_edit(&req).unwrap_err().code,
            "output_exists_or_unwritable"
        );
    }

    #[test]
    fn editar_pelo_grafo_salvo_e_reaberto_e_recusar_topologia_alterada() {
        let b = gate_bench("grafo", authored_gate_rom());
        let m = b.gate(Vec::new());
        let inst = &m.instances[0];
        // salvar → encerrar → reabrir: o grafo vai e volta do disco como texto
        let saved = b.root.join("grafo.json");
        fs::write(&saved, &inst.graph_json).unwrap();
        let mut g: Value = serde_json::from_str(&fs::read_to_string(&saved).unwrap()).unwrap();
        for n in g["nodes"].as_array_mut().unwrap() {
            if n["params"]["campo"] == "threshold" {
                n["params"]["threshold"] = json!(-7);
            }
        }
        let mut req = b.req(inst, &m.profile.sha256);
        // pelo grafo, a região vem do PRÓPRIO grafo: o pedido não precisa repeti-la
        req.region_exits = Vec::new();
        req.region_selection = None;
        req.graph_json = Some(g.to_string());
        let r = ipc_edit(&req).unwrap();
        assert_eq!(r.values_after, [("threshold".to_string(), -7)]);
        assert_eq!(fs::read(&r.patched_path).unwrap()[0x41B], (-7i8) as u8);
        // topologia/operador alterados no canvas NÃO são compilados: recusa com o motivo, sem arquivo novo
        let before = b.outputs();
        for n in g["nodes"].as_array_mut().unwrap() {
            if n["id"] == "compare" {
                n["params"]["operator"] = json!(">=");
            }
        }
        req.graph_json = Some(g.to_string());
        let e = ipc_edit(&req).unwrap_err();
        assert_eq!(e.code, "graph-diverges");
        assert!(
            e.message.contains("nó alterado") && e.message.contains("compare"),
            "{}",
            e.message
        );
        g["nodes"]
            .as_array_mut()
            .unwrap()
            .retain(|n| n["id"] != "set_call");
        req.graph_json = Some(g.to_string());
        assert_eq!(ipc_edit(&req).unwrap_err().code, "graph-diverges");
        assert_eq!(b.outputs(), before);
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
    }

    #[test]
    fn recusas_da_classe_semantica_tem_codigo_e_nao_deixam_arquivo() {
        let b = gate_bench("recusas", authored_gate_rom());
        let m = b.gate(Vec::new());
        let inst = m.instances[0].clone();
        let psha = m.profile.sha256.clone();
        let code = |f: &dyn Fn(&mut ProfileEditRequest)| {
            let mut r = b.req(&inst, &psha);
            r.values = [("threshold".to_string(), 100)].into();
            f(&mut r);
            let e = ipc_edit(&r).unwrap_err();
            assert!(b.outputs().is_empty(), "'{}' deixou arquivo", e.code);
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
            e.code
        };
        assert_eq!(
            code(&|r| r.values = [("threshold".to_string(), 128)].into()),
            "out-of-range"
        );
        assert_eq!(
            code(&|r| r.values = [("threshold".to_string(), -129)].into()),
            "out-of-range"
        );
        assert_eq!(
            code(&|r| r.values = [("threshold".to_string(), 40)].into()),
            "no-change"
        );
        assert_eq!(code(&|r| r.values.clear()), "no-change");
        assert_eq!(
            code(&|r| r.values = [("operator".to_string(), 1)].into()),
            "field-unavailable"
        );
        assert_eq!(code(&|r| r.region_selection = None), "invalid_request");
        assert_eq!(code(&|r| r.region_exits = vec![0x7FE]), "region-refused");
        assert_eq!(code(&|r| r.instance_offset = 0x41C), "region-refused");
        assert_eq!(
            code(&|r| r.profile_sha256 = Some("0".repeat(64))),
            "profile-mismatch"
        );
        assert_eq!(
            code(&|r| r.expected_rom_sha256 = "0".repeat(64)),
            "identity_mismatch"
        );
        assert_eq!(
            code(&|r| r.profile_id = "m68k.fantasma.v1".into()),
            "profile-unknown"
        );
        // falha de publicação: nada no destino, original intacta, e depois a mesma edição funciona
        let mut r = b.req(&inst, &psha);
        r.values = [("threshold".to_string(), 100)].into();
        for (fail_at, created) in [(1, true), (2, false)] {
            let e = ipc_edit_with(
                &Faulty {
                    fail_at,
                    created,
                    writes: RefCell::new(0),
                },
                &r,
            )
            .unwrap_err();
            assert!(!e.code.is_empty() && b.outputs().is_empty());
        }
        assert!(ipc_edit(&r).is_ok());
    }

    /// Mutante sobrevivente da checagem de 2026-10-10: na classe semântica, o escopo DECLARADO só "cita esta
    /// ROM e instância" se a ROM E o offset coincidem. O trecho hex do crate tem a região no MESMO offset
    /// (0x946) da ROM do escopo, mas é outra imagem (outro SHA-256): não é a ROM declarada.
    #[test]
    fn classe_semantica_escopo_declarado_exige_rom_e_instancia() {
        let b = gate_bench("escopo", crate_fixture("goal_original_t6.hex"));
        let m = b.gate(Vec::new());
        let i = &m.instances[0];
        assert_eq!(i.instance_offset, 0x946, "mesmo offset do escopo declarado");
        let c = &i.fields[0].claims[0];
        assert_ne!(
            b.sha,
            "86c4e90ded38b9c74fdf209254639716a874f2e8ebd8787b3789cc36dbdb4f7e"
        );
        assert!(
            !c.declared_scope_matches,
            "outra ROM com o mesmo offset não é o escopo declarado"
        );
        assert_eq!(c.applicability, Applicability::OtherTarget);
    }
    // Curated lab transfer: author-owned image reproduced from the pinned .S/.ld.
    fn lab_comparison_bench(name: &str) -> GateBench {
        let text = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/rex_semantic_holdout/holdout.hex"
        ));
        let hex: String = text.split_whitespace().collect();
        let bytes: Vec<u8> = (0..hex.len())
            .step_by(2)
            .map(|at| u8::from_str_radix(&hex[at..at + 2], 16).unwrap())
            .collect();
        assert_eq!(bytes.len(), 2593);
        assert_eq!(
            sha256_hex(&bytes),
            "8246bb88cbb3f11a45e976347e63c0a7a22bfd17bfccfc0e9bb1f7deb7f6f218"
        );
        gate_bench(name, bytes)
    }
    fn lab_comparison_match(b: &GateBench) -> ProfileMatch {
        b.gate(vec![DeclaredRegion {
            profile_id: GATE.into(),
            entry: 0x240,
            exits: vec![0x25E],
        }])
    }
    fn lab_package_graph() -> Value {
        serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../data/rex_profiles/rea_lab_20261015/integration-package/graph.nodegraph.json"
        )))
        .unwrap()
    }
    #[test]
    fn lab_comparison_backend_rederives_and_reviews_curated_package() {
        let b = lab_comparison_bench("lab-package");
        let m = lab_comparison_match(&b);
        assert_eq!(m.instances.len(), 1);
        let i = &m.instances[0];
        assert_eq!(i.selection.mode, "declared_region");
        assert!(!i.consumer_observed);
        assert_eq!(i.fields[0].value, 5);
        assert_eq!(i.fields[0].rom_offsets, [0x247]);
        let actual: Value = serde_json::from_str(&i.graph_json).unwrap();
        let expected = lab_package_graph();
        // Compare the backend's own structural signature, not an adapter exemption.
        assert_eq!(
            super::super::rex_profile_graph::canonical_signature(&actual),
            super::super::rex_profile_graph::canonical_signature(&expected)
        );
        let compare = actual["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|n| n["id"] == "compare")
            .unwrap();
        assert_eq!(compare["params"]["operator"], ">=");
        assert_eq!(compare["params"]["signed"], "true");
        let ranges: usize = actual["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| {
                serde_json::from_str::<Value>(n["params"]["source_mappings"].as_str().unwrap())
                    .unwrap()
                    .as_array()
                    .unwrap()
                    .len()
            })
            .sum();
        assert_eq!(ranges, 9);
        let mut edited = expected;
        edited["nodes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|n| n["id"] == "compare")
            .unwrap()["params"]["threshold"] = json!(6);
        let mut req = b.req(i, &m.profile.sha256);
        req.graph_json = Some(edited.to_string());
        req.region_exits.clear();
        req.region_selection = None;
        let published = ipc_edit(&req).unwrap();
        let copy = fs::read(&published.patched_path).unwrap();
        let differences: Vec<_> = b
            .bytes
            .iter()
            .zip(&copy)
            .enumerate()
            .filter_map(|(at, (a, b))| (a != b).then_some(at))
            .collect();
        assert_eq!(differences, [0x247]);
        assert!(!published.checksum_updated);
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        assert_eq!(
            rex_edit::ips_apply_strict(&b.bytes, &fs::read(&published.ips_path).unwrap()).unwrap(),
            copy
        );
        let before: Vec<_> = b
            .outputs()
            .iter()
            .map(|name| {
                (
                    name.clone(),
                    fs::read(Path::new(&b.out).join(name)).unwrap(),
                )
            })
            .collect();
        assert_eq!(
            ipc_edit(&req).unwrap_err().code,
            "output_exists_or_unwritable"
        );
        assert_eq!(b.outputs().len(), 2);
        for (name, bytes) in before {
            assert_eq!(fs::read(Path::new(&b.out).join(name)).unwrap(), bytes);
        }
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
    }
    #[test]
    fn lab_comparison_discriminating_refusals_leave_no_publication() {
        let b = lab_comparison_bench("lab-refusals");
        let m = lab_comparison_match(&b);
        let inst = &m.instances[0];
        let mutate = |change: &dyn Fn(&mut Value), expected_code: &str| {
            let mut graph = lab_package_graph();
            graph["nodes"]
                .as_array_mut()
                .unwrap()
                .iter_mut()
                .find(|n| n["id"] == "compare")
                .unwrap()["params"]["threshold"] = json!(6);
            change(&mut graph);
            let mut req = b.req(inst, &m.profile.sha256);
            req.graph_json = Some(graph.to_string());
            let error = ipc_edit(&req).unwrap_err();
            assert_eq!(error.code, expected_code);
            if graph["nodes"][1]["params"]["threshold"] == 128 {
                assert!(error.message.contains("fora da faixa"));
            }
            assert!(b.outputs().is_empty());
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        };
        mutate(
            &|g| {
                g["nodes"][1]["params"]["source_mappings"] = json!("[]");
            },
            "graph-diverges",
        );
        mutate(
            &|g| {
                g["nodes"][1]["params"]["operator"] = json!("<");
            },
            "graph-diverges",
        );
        mutate(
            &|g| {
                g["edges"][0]["toNode"] = json!("other_write");
            },
            "graph-diverges",
        );
        mutate(
            &|g| {
                g["nodes"][1]["params"]["threshold"] = json!(128);
            },
            "graph-diverges",
        );
        for (rom_hash, profile_hash, code) in [
            (
                "0".repeat(64),
                m.profile.sha256.clone(),
                "identity_mismatch",
            ),
            (b.sha.clone(), "0".repeat(64), "profile-mismatch"),
        ] {
            let mut req = b.req(inst, &profile_hash);
            req.values = [("threshold".into(), 6)].into();
            req.expected_rom_sha256 = rom_hash;
            assert_eq!(ipc_edit(&req).unwrap_err().code, code);
            assert!(b.outputs().is_empty());
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        }
    }
    #[test]
    fn copy_grid_backend_publication_and_discriminating_refusals() {
        let hex: String = include_str!("../../../../tests/fixtures/rex_copy_grid/copy.hex")
            .split_whitespace()
            .collect();
        let bytes: Vec<u8> = (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect();
        assert_eq!(
            sha256_hex(&bytes),
            "7930303a67df243f9452eb906b8931aa83d60c02ed090016dd1be1bea37e2f31"
        );
        let b = gate_bench("copy-grid", bytes);
        let result = b.locate(vec![DeclaredRegion {
            profile_id: "m68k.copy_grid.v1".into(),
            entry: 0x400,
            exits: vec![0x41E],
        }]);
        let m = result
            .matches
            .iter()
            .find(|m| m.profile.id == "m68k.copy_grid.v1")
            .unwrap();
        let inst = &m.instances[0];
        assert_eq!(
            (inst.fields[0].value, inst.fields[0].min, inst.fields[0].max),
            (1, 1, 2)
        );
        assert!(!inst.fields[0].signed && !inst.consumer_observed);
        let graph: Value = serde_json::from_str(&inst.graph_json).unwrap();
        assert_eq!(graph["nodes"][1]["type"], "rom_copy_grid");
        let mut req = b.req(inst, &m.profile.sha256);
        req.profile_id = m.profile.id.clone();
        req.values = [("bytes_per_cell".into(), 2)].into();
        for v in [-1, 0, 3, 4, i64::MAX] {
            let mut bad = req.clone();
            bad.values = [("bytes_per_cell".into(), v)].into();
            assert!(ipc_edit(&bad).is_err());
            assert!(b.outputs().is_empty());
        }
        let mut bad = req.clone();
        bad.expected_rom_sha256 = "f".repeat(64);
        assert!(ipc_edit(&bad).is_err());
        assert!(b.outputs().is_empty());
        bad = req.clone();
        bad.profile_sha256 = Some("e".repeat(64));
        assert!(ipc_edit(&bad).is_err());
        assert!(b.outputs().is_empty());
        bad = req.clone();
        bad.profile_id = GATE.into();
        assert!(ipc_edit(&bad).is_err());
        assert!(b.outputs().is_empty());
        for which in 0..7 {
            let mut altered = graph.clone();
            altered["nodes"][1]["params"]["bytes_per_cell"] = json!(2);
            match which {
                0 => altered["nodes"][1]["params"]["row_stride_bytes"] = json!(999),
                1 => altered["nodes"][1]["params"]["source_address"] = json!("0xFF0000"),
                2 => altered["nodes"][1]["params"]["source_mappings"] = json!("[]"),
                3 => altered["edges"][0]["toNode"] = json!("exit"),
                4 => altered["nodes"][1]["params"]["bytes_per_cell"] = json!(3),
                5 => altered["nodes"][1]["params"]["faixa"] = json!("1..4"),
                _ => altered["nodes"][0]["params"]["saidas"] = json!("0x00041C"),
            }
            bad = req.clone();
            bad.values.clear();
            bad.graph_json = Some(altered.to_string());
            assert!(ipc_edit(&bad).is_err(), "tampered graph {which}");
            assert!(b.outputs().is_empty());
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        }
        let mut edited = graph;
        edited["nodes"][1]["params"]["bytes_per_cell"] = json!(2);
        req.values.clear();
        req.graph_json = Some(edited.to_string());
        let result = ipc_edit(&req).unwrap();
        let copy = fs::read(&result.patched_path).unwrap();
        assert!(result.original_untouched && result.ips_reproduces_copy && result.size_unchanged);
        assert_eq!(result.values_after, [("bytes_per_cell".into(), 2)]);
        assert_eq!(
            (0..copy.len())
                .filter(|i| copy[*i] != b.bytes[*i])
                .collect::<Vec<_>>(),
            [0x410]
        );
        let patch = fs::read(&result.ips_path).unwrap();
        assert_eq!(
            super::super::rex_edit::ips_apply_strict(&b.bytes, &patch).unwrap(),
            copy
        );
        assert!(ipc_edit(&req).is_err());
        assert_eq!(b.outputs().len(), 2);
        assert_eq!(fs::read(&result.patched_path).unwrap(), copy);
        assert_eq!(fs::read(&result.ips_path).unwrap(), patch);
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        if let Ok(out) = std::env::var("RDS_COPY_GRID_AUTHOR_OUTPUT") {
            let out = Path::new(&out);
            fs::create_dir(out).unwrap();
            let grid = super::super::rex_copy_grid::recover(&b.bytes, 0x400, &[0x41E]).unwrap();
            let mut rebuilt = b.bytes.clone();
            rebuilt[0x400..0x41E].copy_from_slice(&grid.encode().unwrap());
            assert_eq!(rebuilt, b.bytes);
            fs::write(out.join("original-rebuilt.bin"), rebuilt).unwrap();
            let mut edited = grid;
            edited.width = 2;
            let mut rebuilt = b.bytes.clone();
            rebuilt[0x400..0x41E].copy_from_slice(&edited.encode().unwrap());
            assert_eq!(rebuilt, copy);
            fs::write(out.join("modified-rebuilt.bin"), rebuilt).unwrap();
            fs::write(out.join("published-copy.bin"), &copy).unwrap();
            fs::write(out.join("published.ips"), &patch).unwrap();
        }
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../data/rex_profiles/integration_20261016/copy-grid-conformance.nodegraph.json");
        if std::env::var("REX_WRITE_CONFORMANCE").is_ok() {
            fs::write(path, inst.graph_json.clone() + "\n").unwrap();
        }
    }
    #[test]
    fn copy_grid_malformed_rom_never_publishes() {
        let hex: String = include_str!("../../../../tests/fixtures/rex_copy_grid/copy.hex")
            .split_whitespace()
            .collect();
        let base: Vec<u8> = (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect();
        let pristine = gate_bench("copy-pristine", base.clone());
        let located = pristine.locate(vec![DeclaredRegion {
            profile_id: "m68k.copy_grid.v1".into(),
            entry: 0x400,
            exits: vec![0x41E],
        }]);
        let m = located
            .matches
            .iter()
            .find(|m| m.profile.id == "m68k.copy_grid.v1")
            .unwrap();
        for (case, at, word) in [
            ("jump", 0x414, 0x7FFFu16),
            ("counters", 0x412, 0x51CD),
            ("pointers", 0x406, 0x49F9),
            ("map", 0x408, 0x00FE),
            ("stride", 0x418, 0x7FFF),
        ] {
            let mut rom = base.clone();
            rom[at..at + 2].copy_from_slice(&word.to_be_bytes());
            let b = gate_bench(case, rom);
            let mut req = b.req(&m.instances[0], &m.profile.sha256);
            req.profile_id = "m68k.copy_grid.v1".into();
            req.values = [("bytes_per_cell".into(), 2)].into();
            assert!(ipc_edit(&req).is_err(), "{case}");
            assert!(b.outputs().is_empty());
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        }
    }

    #[test]
    #[ignore = "requires pinned local authorized BYOR; writes private harness inputs only"]
    fn copy_grid_pinned_byor_uses_same_backend_and_publication() {
        let path = std::env::var("RDS_COPY_GRID_BYOR").expect("local pinned BYOR path");
        let bytes = fs::read(path).unwrap();
        assert_eq!(
            sha256_hex(&bytes),
            "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
        );
        let b = gate_bench("copy-byor", bytes);
        let located = b.locate(vec![DeclaredRegion {
            profile_id: "m68k.copy_grid.v1".into(),
            entry: 0x1B6E8,
            exits: vec![0x1B706],
        }]);
        let m = located
            .matches
            .iter()
            .find(|m| m.profile.id == "m68k.copy_grid.v1")
            .unwrap();
        let i = &m.instances[0];
        assert!(!i.consumer_observed);
        let graph: Value = serde_json::from_str(&i.graph_json).unwrap();
        assert_eq!(graph["nodes"][1]["params"]["rows"], 64);
        assert_eq!(graph["nodes"][1]["params"]["columns"], 64);
        let mut req = b.req(i, &m.profile.sha256);
        req.profile_id = m.profile.id.clone();
        req.values = [("bytes_per_cell".into(), 2)].into();
        let result = ipc_edit(&req).unwrap();
        let copy = fs::read(result.patched_path).unwrap();
        assert_eq!(
            (0..copy.len())
                .filter(|j| copy[*j] != b.bytes[*j])
                .collect::<Vec<_>>(),
            [0x1B6F8]
        );
        assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
        let out =
            std::env::var("RDS_COPY_GRID_PRIVATE_OUTPUT").expect("new external output directory");
        fs::create_dir(&out).unwrap();
        let g = super::super::rex_copy_grid::recover(&b.bytes, 0x1B6E8, &[0x1B706]).unwrap();
        let mut original_rebuilt = b.bytes.clone();
        original_rebuilt[0x1B6E8..0x1B706].copy_from_slice(&g.encode().unwrap());
        assert_eq!(original_rebuilt, b.bytes);
        let mut g2 = g;
        g2.width = 2;
        let mut modified_rebuilt = b.bytes.clone();
        modified_rebuilt[0x1B6E8..0x1B706].copy_from_slice(&g2.encode().unwrap());
        assert_eq!(modified_rebuilt, copy);
        fs::write(
            Path::new(&out).join("original-rebuilt.bin"),
            original_rebuilt,
        )
        .unwrap();
        fs::write(
            Path::new(&out).join("modified-rebuilt.bin"),
            modified_rebuilt,
        )
        .unwrap();
        fs::write(Path::new(&out).join("published-copy.bin"), copy).unwrap();
        fs::write(
            Path::new(&out).join("published.ips"),
            fs::read(result.ips_path).unwrap(),
        )
        .unwrap();
    }

    #[test]
    #[ignore = "requires private identity-pinned transfer cases; no corpus bundled"]
    fn copy_grid_linear_private_profiles_share_publication() {
        let config = std::env::var("RDS_LINEAR_COPY_CASES").expect("private frozen cases JSON");
        let cases: Value = serde_json::from_slice(&fs::read(config).unwrap()).unwrap();
        for case in cases["cases"].as_array().unwrap() {
            let bytes = fs::read(case["rom_path"].as_str().unwrap()).unwrap();
            assert_eq!(sha256_hex(&bytes), case["rom_sha256"].as_str().unwrap());
            let entry = case["entry"].as_u64().unwrap() as u32;
            let exit = case["exit"].as_u64().unwrap() as u32;
            let width = case["edited_width"].as_i64().unwrap();
            let grid = super::super::rex_copy_grid::recover(&bytes, entry, &[exit]).unwrap();
            assert!(grid.linear.is_some());
            assert_eq!(grid.encode().unwrap(), bytes[entry as usize..exit as usize]);
            let b = gate_bench("linear-private", bytes);
            let located = b.locate(vec![DeclaredRegion {
                profile_id: "m68k.copy_grid.v1".into(),
                entry,
                exits: vec![exit],
            }]);
            let m = located
                .matches
                .iter()
                .find(|m| m.profile.id == "m68k.copy_grid.v1")
                .unwrap();
            let inst = &m.instances[0];
            assert!(!inst.consumer_observed);
            let mut req = b.req(inst, &m.profile.sha256);
            req.profile_id = m.profile.id.clone();
            for invalid in [0, 3, 5] {
                req.values = [("bytes_per_cell".into(), invalid)].into();
                assert!(ipc_edit(&req).is_err());
                assert!(b.outputs().is_empty());
            }
            req.values = [("bytes_per_cell".into(), width)].into();
            let result = ipc_edit(&req).unwrap();
            let copy = fs::read(&result.patched_path).unwrap();
            let expected = fs::read(case["expected_copy"].as_str().unwrap()).unwrap();
            assert_eq!(
                sha256_hex(&expected),
                case["expected_copy_sha256"].as_str().unwrap()
            );
            assert_eq!(copy, expected);
            let mut edited = grid.clone();
            edited.width = width as u32;
            assert_eq!(
                edited.encode().unwrap(),
                copy[entry as usize..exit as usize]
            );
            assert_eq!(fs::read(&b.rom).unwrap(), b.bytes);
            let output = Path::new(case["output"].as_str().unwrap());
            fs::create_dir(output).unwrap();
            fs::write(
                output.join("original-rebuilt-region.bin"),
                grid.encode().unwrap(),
            )
            .unwrap();
            fs::write(
                output.join("modified-rebuilt-region.bin"),
                edited.encode().unwrap(),
            )
            .unwrap();
            fs::write(output.join("published-copy.bin"), copy).unwrap();
            fs::write(
                output.join("published.ips"),
                fs::read(result.ips_path).unwrap(),
            )
            .unwrap();
            fs::write(output.join("graph.nodegraph.json"), &inst.graph_json).unwrap();
            println!("linear profile {entry:#x}..{exit:#x}, width {width}, independent copy exact");
        }
    }
}
