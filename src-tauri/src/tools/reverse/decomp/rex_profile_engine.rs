//! Motor de perfis em dado (`ProfileSpec`, contrato `rex-profile-spec/v2`).
//!
//! Interpreta padrões, restrições, relações (`subsumes`, `pair`, `follow`), campos, notas e detalhes de um
//! `ProfileSpec` e devolve as instâncias encontradas na ROM, sem conhecer nenhum jogo ou rotina: tudo o
//! que é específico vem do dado. A projeção para o grafo e a sua revisão ficam em `rex_profile_graph`.
//!
//! Classe suportada: uma relação `pair` (âncora ↔ alvo, com consistência de capturas, pareamento mútuo
//! opcional e regra de empate explícita), no máximo uma `subsumes` entre âncoras e relações `follow` que
//! partem do alvo do `pair`. Qualquer outra forma é RECUSADA na validação, nunca interpretada pela metade.
//!
//! O que o motor afirma é ESTÁTICO (forma e consistência). Uma assinatura encontrada não é um consumidor
//! executado: `EngineInstance` nunca declara consumo observado.

use std::collections::{BTreeMap, HashMap};

use super::rex_edit::{plan_field_edits, EditError, FieldEnc, FieldView, Patch, PlanError};
use super::rex_evidence::EvidenceLevel;
use super::rex_profile_spec::{
    CaptureRole, Condition, ConstraintSpec, NumFmt, ProfileSpec, RelationSpec, RomBinding,
    SpecError, TextPart, TieRule,
};
use super::rex_sigscan::{Match, Pattern};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineError {
    /// O dado é inválido (ver `SpecError`).
    Spec(SpecError),
    /// Um limite de trabalho declarado pelo perfil foi excedido (ROM, ocorrências ou instâncias).
    WorkLimit(String),
}

impl From<SpecError> for EngineError {
    fn from(e: SpecError) -> Self {
        EngineError::Spec(e)
    }
}

/// Erro de uma operação sobre um perfil carregado. Os códigos são os mesmos da superfície anterior.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProfileError {
    /// Instância não encontrada nesta ROM (ou a ROM mudou desde a localização).
    InstanceNotFound,
    /// Valor fora do domínio aceito ou que não cabe na largura/sinal do campo.
    OutOfRange,
    /// Nada a alterar: recusa explícita, nunca no-op silencioso.
    NoChange,
    /// O campo pedido não existe nesta instância.
    FieldUnavailable,
    /// O IPS não consegue representar o patch.
    IpsUnrepresentable,
    /// O grafo enviado diverge do canônico reconstruído da ROM.
    GraphDiverges(Vec<String>),
    /// Valores pedidos por duas fontes (formulário e grafo) ao mesmo tempo.
    ParamsConflict,
    /// Os bytes antigos não coincidem com os do patch.
    StaleBytes,
    /// O perfil pedido não está carregado.
    ProfileUnknown(String),
    /// O perfil carregado não é o que gerou a localização/grafo (hash ou revisão diferentes).
    ProfileMismatch { expected: String, loaded: String },
    /// Limite de trabalho do perfil excedido.
    WorkLimit(String),
    /// O perfil está vinculado a outras ROMs (por SHA-256).
    RomNotBound,
    /// O analisador da classe recusou a região (opcode fora do subconjunto, laço, saída não alcançada…).
    RegionRefused(String),
}

impl ProfileError {
    pub fn code(&self) -> &'static str {
        match self {
            ProfileError::InstanceNotFound => "instance-not-found",
            ProfileError::OutOfRange => "out-of-range",
            ProfileError::NoChange => "no-change",
            ProfileError::FieldUnavailable => "field-unavailable",
            ProfileError::IpsUnrepresentable => "ips-unrepresentable",
            ProfileError::GraphDiverges(_) => "graph-diverges",
            ProfileError::ParamsConflict => "params-conflict",
            ProfileError::StaleBytes => "stale-bytes",
            ProfileError::ProfileUnknown(_) => "profile-unknown",
            ProfileError::ProfileMismatch { .. } => "profile-mismatch",
            ProfileError::WorkLimit(_) => "work-limit",
            ProfileError::RomNotBound => "rom-not-bound",
            ProfileError::RegionRefused(_) => "region-refused",
        }
    }
}

impl From<EditError> for ProfileError {
    fn from(e: EditError) -> ProfileError {
        match e {
            EditError::StaleBytes => ProfileError::StaleBytes,
            EditError::IpsUnrepresentable => ProfileError::IpsUnrepresentable,
        }
    }
}

impl From<PlanError> for ProfileError {
    fn from(e: PlanError) -> ProfileError {
        match e {
            PlanError::FieldUnavailable => ProfileError::FieldUnavailable,
            PlanError::OutOfRange => ProfileError::OutOfRange,
            PlanError::NoChange => ProfileError::NoChange,
            PlanError::OutOfBounds => ProfileError::StaleBytes,
        }
    }
}

impl From<EngineError> for ProfileError {
    fn from(e: EngineError) -> ProfileError {
        match e {
            EngineError::WorkLimit(m) => ProfileError::WorkLimit(m),
            EngineError::Spec(s) => ProfileError::ProfileUnknown(s.to_string()),
        }
    }
}

/// Captura resolvida: valor bruto (bytes na ordem do arquivo, lidos como big-endian) e OFFSET DE ARQUIVO.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CapView {
    pub value: u32,
    pub rom_offset: usize,
    pub len: usize,
}

/// Ocorrência de um padrão do perfil.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchView {
    pub pattern: String,
    pub offset: usize,
    pub caps: BTreeMap<String, CapView>,
}

impl MatchView {
    pub fn cap(&self, name: &str) -> Option<u32> {
        self.caps.get(name).map(|c| c.value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EngineField {
    pub name: String,
    pub label: String,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    /// Offsets de ARQUIVO onde o inteiro aparece. Mais de um = editados juntos.
    pub rom_offsets: Vec<usize>,
    pub enc: FieldEnc,
    /// Nível ESTÁTICO calculado para esta instância: L2 quando a consistência que sustenta o campo fechou
    /// (pareamento), L1 quando só a forma casou.
    pub static_level: EvidenceLevel,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EngineInstance {
    /// Ocorrência âncora (offset bruto da ocorrência).
    pub anchor: MatchView,
    /// Offset de referência da instância: o da ocorrência, somado ao prefixo quando a âncora é o padrão
    /// `outer` de uma `subsumes` (a forma maior contém a menor a partir do prefixo).
    pub anchor_offset: usize,
    /// A âncora casou pelo padrão `outer` de uma `subsumes`.
    pub anchor_is_outer: bool,
    /// Alvos ligados, por id de relação (`pair` e `follow`).
    pub links: BTreeMap<String, MatchView>,
    pub fields: Vec<EngineField>,
    /// Ligações NÃO feitas por ambiguidade (empate recusado, repetição divergente), com o motivo.
    pub ambiguities: Vec<String>,
}

/// Resultado de uma localização.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Located {
    pub instances: Vec<EngineInstance>,
    /// Ocorrências descartadas por restrição entre capturas.
    pub rejected_by_constraint: usize,
    /// `false` quando o perfil está vinculado por SHA-256 a outras ROMs (nada foi procurado).
    pub bound: bool,
}

#[derive(Clone)]
pub struct Engine {
    spec: ProfileSpec,
    sha256: String,
    compiled: HashMap<String, Vec<Pattern>>,
    subsumes: Option<(String, String, usize)>,
    pair: PairShape,
    follows: Vec<FollowShape>,
}

#[derive(Clone)]
struct PairShape {
    id: String,
    from: Vec<String>,
    to: String,
    on: Vec<String>,
    max: usize,
    mutual: bool,
    tie: TieRule,
}

#[derive(Clone)]
struct FollowShape {
    id: String,
    to: String,
    on: Vec<String>,
    max: usize,
    tie: TieRule,
}

/// Menor por `key`; `Err(n)` quando há `n > 1` candidatos empatados e a regra é recusar.
fn nearest<T: Copy>(
    cands: impl Iterator<Item = T>,
    key: impl Fn(T) -> usize,
    tie: TieRule,
) -> Result<Option<T>, usize> {
    let mut best: Option<(T, usize)> = None;
    let mut ties = 0usize;
    for c in cands {
        let k = key(c);
        match best {
            Some((_, b)) if k > b => {}
            Some((_, b)) if k == b => ties += 1,
            _ => {
                best = Some((c, k));
                ties = 1;
            }
        }
    }
    if ties > 1 && tie == TieRule::Refuse {
        return Err(ties);
    }
    Ok(best.map(|(c, _)| c))
}

impl Engine {
    /// `profile_sha256` é o SHA-256 do ARQUIVO do perfil (identidade exata do dado).
    pub fn new(spec: ProfileSpec, profile_sha256: &str) -> Result<Engine, EngineError> {
        spec.validate()?;
        let mut compiled: HashMap<String, Vec<Pattern>> = HashMap::new();
        for p in &spec.patterns {
            let pats = p
                .sources
                .iter()
                .map(|s| Pattern::parse(s))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| {
                    EngineError::Spec(SpecError::Invalid {
                        rule: "pattern-invalid",
                        at: format!("{}: {e:?}", p.id),
                    })
                })?;
            compiled.insert(p.id.clone(), pats);
        }
        let mut subsumes = None;
        let mut pair = None;
        let mut follows = Vec::new();
        for r in &spec.relations {
            match r {
                RelationSpec::Subsumes {
                    outer,
                    inner,
                    prefix_len,
                    ..
                } => subsumes = Some((outer.clone(), inner.clone(), *prefix_len)),
                RelationSpec::Pair {
                    id,
                    from,
                    to,
                    consistent_on,
                    max_distance,
                    mutual,
                    tie,
                } => {
                    pair = Some(PairShape {
                        id: id.clone(),
                        from: from.clone(),
                        to: to.clone(),
                        on: consistent_on.clone(),
                        max: *max_distance,
                        mutual: *mutual,
                        tie: *tie,
                    })
                }
                RelationSpec::Follow {
                    id,
                    to,
                    consistent_on,
                    max_distance,
                    tie,
                    ..
                } => follows.push(FollowShape {
                    id: id.clone(),
                    to: to.clone(),
                    on: consistent_on.clone(),
                    max: *max_distance,
                    tie: *tie,
                }),
            }
        }
        // `validate` já garantiu a forma; a ausência aqui seria um defeito do validador
        let pair = pair.ok_or(EngineError::Spec(SpecError::Invalid {
            rule: "unsupported-shape",
            at: "sem relação pair".to_string(),
        }))?;
        Ok(Engine {
            spec,
            sha256: profile_sha256.to_string(),
            compiled,
            subsumes,
            pair,
            follows,
        })
    }

    pub fn spec(&self) -> &ProfileSpec {
        &self.spec
    }

    /// SHA-256 do arquivo do perfil.
    pub fn profile_sha256(&self) -> &str {
        &self.sha256
    }

    /// Valor tipado de uma captura (largura, sinal e endianess do tipo declarado).
    pub fn typed(&self, rom: &[u8], name: &str, cap: &CapView) -> Option<i64> {
        let ty = self.spec.capture(name)?;
        rom.get(cap.rom_offset..cap.rom_offset + cap.len)
            .map(|b| ty.decode(b))
    }

    fn passes(&self, rom: &[u8], m: &MatchView) -> bool {
        self.spec
            .constraints
            .iter()
            .filter(|c| c.pattern() == m.pattern)
            .all(|c| {
                let val = |name: &str| m.caps.get(name).and_then(|cv| self.typed(rom, name, cv));
                match c {
                    ConstraintSpec::Range {
                        capture, min, max, ..
                    } => val(capture).is_some_and(|v| v >= *min && v <= *max),
                    ConstraintSpec::Distinct { a, b, .. } => {
                        matches!((val(a), val(b)), (Some(x), Some(y)) if x != y)
                    }
                    ConstraintSpec::MultipleOf {
                        capture, modulo, ..
                    } => val(capture).is_some_and(|v| v.rem_euclid(*modulo) == 0),
                }
            })
    }

    fn scan(
        &self,
        id: &str,
        rom: &[u8],
        rejected: &mut usize,
    ) -> Result<Vec<MatchView>, EngineError> {
        let max = self.spec.work_limits.max_matches_per_pattern;
        let mut v: Vec<MatchView> = Vec::new();
        for p in &self.compiled[id] {
            let (found, truncated) = p.scan(rom);
            if truncated || found.len() > max {
                return Err(EngineError::WorkLimit(format!(
                    "padrão '{id}': mais de {max} ocorrências"
                )));
            }
            v.extend(found.iter().map(|m| view(id, m)));
        }
        v.sort_by_key(|m| m.offset);
        v.dedup_by_key(|m| m.offset);
        if v.len() > max {
            return Err(EngineError::WorkLimit(format!(
                "padrão '{id}': mais de {max} ocorrências"
            )));
        }
        let before = v.len();
        v.retain(|m| self.passes(rom, m));
        *rejected += before - v.len();
        Ok(v)
    }

    /// Todas as instâncias do perfil na ROM, em ordem de offset da âncora.
    pub fn locate(&self, rom: &[u8], rom_sha256: &str) -> Result<Located, EngineError> {
        if rom.len() as u64 > self.spec.work_limits.max_rom_bytes {
            return Err(EngineError::WorkLimit(format!(
                "ROM de {} bytes acima do limite do perfil ({})",
                rom.len(),
                self.spec.work_limits.max_rom_bytes
            )));
        }
        if let RomBinding::Sha256 { sha256 } = &self.spec.rom_binding {
            if !sha256.iter().any(|s| s == rom_sha256) {
                return Ok(Located::default());
            }
        }
        self.locate_any(rom)
    }

    /// Localização sem conferir o vínculo do perfil com a ROM (usada para reler a CÓPIA gerada).
    pub fn locate_any(&self, rom: &[u8]) -> Result<Located, EngineError> {
        if rom.len() as u64 > self.spec.work_limits.max_rom_bytes {
            return Err(EngineError::WorkLimit(format!(
                "ROM de {} bytes acima do limite do perfil ({})",
                rom.len(),
                self.spec.work_limits.max_rom_bytes
            )));
        }
        let mut rejected = 0usize;
        let mut anchors: Vec<(MatchView, bool)> = Vec::new();
        if let Some((outer, inner, prefix)) = &self.subsumes {
            for m in self.scan(outer, rom, &mut rejected)? {
                anchors.push((m, true));
            }
            for m in self.scan(inner, rom, &mut rejected)? {
                if !anchors.iter().any(|(s, _)| s.offset + prefix == m.offset) {
                    anchors.push((m, false));
                }
            }
            // as demais âncoras do pair (fora do subsumes) também entram
            for id in &self.pair.from {
                if id != outer && id != inner {
                    for m in self.scan(id, rom, &mut rejected)? {
                        anchors.push((m, false));
                    }
                }
            }
        } else {
            for id in &self.pair.from {
                for m in self.scan(id, rom, &mut rejected)? {
                    anchors.push((m, false));
                }
            }
        }
        anchors.sort_by_key(|(m, _)| m.offset);
        if anchors.len() > self.spec.work_limits.max_instances {
            return Err(EngineError::WorkLimit(format!(
                "mais de {} instâncias",
                self.spec.work_limits.max_instances
            )));
        }
        let targets = self.scan(&self.pair.to, rom, &mut rejected)?;
        let mut follow_targets: Vec<Vec<MatchView>> = Vec::new();
        for f in &self.follows {
            follow_targets.push(self.scan(&f.to, rom, &mut rejected)?);
        }
        let consistent = |a: &MatchView, b: &MatchView, on: &[String]| {
            on.iter()
                .all(|k| a.cap(k).is_some() && a.cap(k) == b.cap(k))
        };
        let prefix = self.subsumes.as_ref().map(|s| s.2).unwrap_or(0);
        let mut out = Vec::new();
        for (ai, (a, is_outer)) in anchors.iter().enumerate() {
            let mut ambiguities = Vec::new();
            let near = nearest(
                targets.iter().filter(|t| {
                    consistent(a, t, &self.pair.on) && t.offset.abs_diff(a.offset) <= self.pair.max
                }),
                |t| t.offset.abs_diff(a.offset),
                self.pair.tie,
            )
            .unwrap_or_else(|n| {
                ambiguities.push(format!(
                    "{}: {n} candidatos à mesma distância; nenhum foi ligado",
                    self.pair.id
                ));
                None
            });
            let paired = near.filter(|t| {
                if !self.pair.mutual {
                    return true;
                }
                let back = nearest(
                    anchors.iter().enumerate().filter(|(_, (o, _))| {
                        consistent(o, t, &self.pair.on)
                            && t.offset.abs_diff(o.offset) <= self.pair.max
                    }),
                    |(_, (o, _))| t.offset.abs_diff(o.offset),
                    self.pair.tie,
                );
                match back {
                    Ok(b) => b.map(|(i, _)| i) == Some(ai),
                    Err(n) => {
                        ambiguities.push(format!(
                            "{}: o alvo em {:#x} tem {n} âncoras à mesma distância; nenhuma foi ligada",
                            self.pair.id, t.offset
                        ));
                        false
                    }
                }
            });
            let mut links: BTreeMap<String, MatchView> = BTreeMap::new();
            if let Some(t) = paired {
                links.insert(self.pair.id.clone(), t.clone());
                for (f, cands) in self.follows.iter().zip(&follow_targets) {
                    let c = nearest(
                        cands.iter().filter(|c| {
                            consistent(c, t, &f.on)
                                && c.offset > t.offset
                                && c.offset - t.offset <= f.max
                        }),
                        |c| c.offset - t.offset,
                        f.tie,
                    )
                    .unwrap_or_else(|n| {
                        ambiguities.push(format!(
                            "{}: {n} candidatos à mesma distância; nenhum foi ligado",
                            f.id
                        ));
                        None
                    });
                    if let Some(c) = c {
                        links.insert(f.id.clone(), c.clone());
                    }
                }
            }
            let fields = self.fields_of(rom, a, &links, &mut ambiguities);
            out.push(EngineInstance {
                anchor: a.clone(),
                anchor_offset: if *is_outer {
                    a.offset + prefix
                } else {
                    a.offset
                },
                anchor_is_outer: *is_outer,
                links,
                fields,
                ambiguities,
            });
        }
        Ok(Located {
            instances: out,
            rejected_by_constraint: rejected,
            bound: true,
        })
    }

    fn fields_of(
        &self,
        rom: &[u8],
        anchor: &MatchView,
        links: &BTreeMap<String, MatchView>,
        ambiguities: &mut Vec<String>,
    ) -> Vec<EngineField> {
        let mut fields = Vec::new();
        for f in &self.spec.fields {
            let on_anchor = f.patterns.contains(&anchor.pattern);
            let src: Option<&MatchView> = if on_anchor {
                Some(anchor)
            } else {
                links.values().find(|l| f.patterns.contains(&l.pattern))
            };
            let ok_req = match f.requires.as_deref() {
                None => true,
                Some(r) => links.contains_key(r),
            };
            let (Some(m), true) = (src, ok_req) else {
                continue;
            };
            let (Some(c), Some(ty)) = (m.caps.get(&f.capture), self.spec.capture(&f.capture))
            else {
                continue;
            };
            let w = usize::from(ty.width);
            let Some(bytes) = rom.get(c.rom_offset..c.rom_offset + w) else {
                continue;
            };
            let mut offs = vec![c.rom_offset];
            offs.extend(f.extra_offsets.iter().map(|o| m.offset + o));
            // toda repetição tem de conter os mesmos bytes: senão editar "junto" seria inventar
            if offs.iter().any(|o| rom.get(*o..*o + w) != Some(bytes)) {
                ambiguities.push(format!(
                    "campo '{}': repetições com bytes diferentes; campo não oferecido",
                    f.name
                ));
                continue;
            }
            // consistência fechada = a instância está pareada (campo da âncora) ou o campo vem de um alvo ligado
            let consistent = !on_anchor || links.contains_key(&self.pair.id);
            fields.push(EngineField {
                name: f.name.clone(),
                label: f.label.clone(),
                value: ty.decode(bytes),
                min: f.min,
                max: f.max,
                rom_offsets: offs,
                enc: ty.enc(),
                static_level: if consistent {
                    EvidenceLevel::L2Consistency
                } else {
                    EvidenceLevel::L1StaticForm
                },
            });
        }
        fields
    }

    /// A instância cujo offset de referência é `instance_offset`.
    pub fn instance_at(
        &self,
        rom: &[u8],
        rom_sha256: &str,
        instance_offset: usize,
    ) -> Result<EngineInstance, ProfileError> {
        let located = self.locate(rom, rom_sha256)?;
        if !located.bound {
            return Err(ProfileError::RomNotBound);
        }
        located
            .instances
            .into_iter()
            .find(|i| i.anchor_offset == instance_offset)
            .ok_or(ProfileError::InstanceNotFound)
    }

    /// Planeja a edição de campos de UMA instância (domínio, largura, no-op recusado, bytes antigos guardados).
    pub fn plan_edit(
        &self,
        rom: &[u8],
        inst: &EngineInstance,
        wanted: &[(&str, Option<i64>)],
    ) -> Result<Vec<Patch>, PlanError> {
        let views: Vec<FieldView<'_>> = inst
            .fields
            .iter()
            .map(|f| FieldView {
                name: &f.name,
                value: f.value,
                min: f.min,
                max: f.max,
                rom_offsets: &f.rom_offsets,
                enc: f.enc,
            })
            .collect();
        plan_field_edits(rom, &views, wanted)
    }

    /// Uma lista de condições é uma conjunção.
    pub fn holds(&self, conds: &[Condition], inst: &EngineInstance) -> bool {
        conds.iter().all(|c| match c {
            Condition::Link { id } => inst.links.contains_key(id),
            Condition::NoLink { id } => !inst.links.contains_key(id),
            Condition::Field { name } => inst.fields.iter().any(|f| f.name == *name),
            Condition::NoField { name } => !inst.fields.iter().any(|f| f.name == *name),
            Condition::AnchorPattern { id } => inst.anchor.pattern == *id,
        })
    }

    /// Texto a partir de partes tipadas. Nada é interpretado: cada parte é literal, captura ou offset.
    pub fn render(&self, rom: &[u8], parts: &[TextPart], inst: &EngineInstance) -> String {
        let mut out = String::new();
        for part in parts {
            match part {
                TextPart::Lit { t, when } => {
                    if self.holds(when, inst) {
                        out.push_str(t);
                    }
                }
                TextPart::Capture { name, of, fmt } => {
                    let m = if of == "anchor" {
                        Some(&inst.anchor)
                    } else {
                        inst.links.get(of)
                    };
                    let v = m
                        .and_then(|m| m.caps.get(name))
                        .and_then(|c| self.typed(rom, name, c).map(|v| (v, c.len)));
                    match v {
                        Some((v, len)) => out.push_str(&fmt_num(v, len, *fmt)),
                        None => out.push('?'),
                    }
                }
                TextPart::Offset { of, fmt } => {
                    let o = match of.as_str() {
                        "instance" => Some(inst.anchor_offset),
                        "anchor_match" => Some(inst.anchor.offset),
                        rel => inst.links.get(rel).map(|m| m.offset),
                    };
                    match o {
                        Some(o) => out.push_str(&fmt_num(o as i64, 8, *fmt)),
                        None => out.push('?'),
                    }
                }
            }
        }
        out
    }

    /// Notas da instância, na ordem do perfil.
    pub fn notes(&self, rom: &[u8], inst: &EngineInstance) -> Vec<String> {
        self.spec
            .notes
            .iter()
            .filter(|n| self.holds(&n.when, inst))
            .map(|n| self.render(rom, &n.text, inst))
            .collect()
    }

    /// Detalhes `(rótulo, texto)` da instância.
    pub fn details(&self, rom: &[u8], inst: &EngineInstance) -> Vec<(String, String)> {
        self.spec
            .details
            .iter()
            .filter(|d| self.holds(&d.when, inst))
            .map(|d| (d.label.clone(), self.render(rom, &d.text, inst)))
            .collect()
    }

    /// Capturas tipadas da instância: `(origem, nome, papel, valor, offset de arquivo, endereço de
    /// barramento designado)`. O endereço de barramento só existe para capturas `bus_address`.
    pub fn captures(&self, rom: &[u8], inst: &EngineInstance) -> Vec<CaptureFact> {
        let mut out = Vec::new();
        let mut push = |source: &str, m: &MatchView| {
            for (name, c) in &m.caps {
                let (Some(ty), Some(bytes)) = (
                    self.spec.capture(name),
                    rom.get(c.rom_offset..c.rom_offset + c.len),
                ) else {
                    continue;
                };
                out.push(CaptureFact {
                    source: source.to_string(),
                    name: name.clone(),
                    role: ty.role,
                    value: ty.decode(bytes),
                    file_offset: c.rom_offset,
                    designates_bus_address: (ty.role == CaptureRole::BusAddress)
                        .then(|| self.spec.bus_address_of(ty, bytes)),
                });
            }
        };
        push("anchor", &inst.anchor);
        for (rel, m) in &inst.links {
            push(rel, m);
        }
        out
    }
}

/// Fato sobre uma captura, com as três noções de endereço separadas.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureFact {
    /// `"anchor"` ou o id da relação que ligou a ocorrência.
    pub source: String,
    pub name: String,
    pub role: CaptureRole,
    pub value: i64,
    /// Onde os bytes da captura estão NO ARQUIVO.
    pub file_offset: usize,
    /// Endereço de BARRAMENTO que a captura designa (só para `bus_address`).
    pub designates_bus_address: Option<u64>,
}

fn fmt_num(v: i64, len: usize, fmt: NumFmt) -> String {
    // em hexadecimal, o valor é mostrado como os bytes o escrevem (complemento de dois na largura)
    let raw = if len >= 8 {
        v as u64
    } else {
        (v as u64) & ((1u64 << (len * 8)) - 1)
    };
    match fmt {
        NumFmt::Hex => format!("{raw:#x}"),
        NumFmt::HexBare => format!("{raw:x}"),
        NumFmt::Hex6 => format!("0x{raw:06X}"),
        NumFmt::Dec => v.to_string(),
    }
}

fn view(pattern: &str, m: &Match) -> MatchView {
    MatchView {
        pattern: pattern.to_string(),
        offset: m.offset,
        caps: m
            .caps
            .iter()
            .map(|(k, c)| {
                (
                    k.clone(),
                    CapView {
                        value: c.value,
                        rom_offset: c.rom_offset,
                        len: c.len,
                    },
                )
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::super::rex_edit::{apply, ips, ips_apply_strict};
    use super::super::rex_profile_graph::{graph_json, review_graph};
    use super::super::rex_profile_testkit::*;
    use super::super::rom_library::sha256_hex;
    use super::*;
    use serde_json::{json, Value};
    use std::path::{Path, PathBuf};

    fn fixtures_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/rex_profiles/specs/fixtures")
    }

    fn from_hex(h: &str) -> Vec<u8> {
        (0..h.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&h[i..i + 2], 16).unwrap())
            .collect()
    }

    /// Corpo ÚNICO e genérico: nenhum nome de perfil, jogo ou campo aparece aqui. Cada fixture traz o
    /// perfil (inline ou por arquivo), a ROM em hex e o resultado esperado. Além de localizar e planejar,
    /// cada edição passa pela PROJEÇÃO: grafo gerado do dado → valores trocados nos nós → revisão contra a
    /// ROM → o mesmo patch do plano direto.
    fn run_fixture(path: &Path) {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let doc: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        let spec_text = match doc.get("spec_file") {
            Some(f) => std::fs::read_to_string(fixtures_dir().join(f.as_str().unwrap())).unwrap(),
            None => doc["spec"].to_string(),
        };
        let expect = &doc["expect"];
        let engine = match ProfileSpec::from_json(&spec_text) {
            Err(e) => {
                let kind = if e.rule() == "unsupported-shape" {
                    "unsupported"
                } else {
                    "spec"
                };
                assert_eq!(expect["error"], kind, "{name}: {e}");
                if let Some(rule) = expect.get("rule") {
                    assert_eq!(rule, e.rule(), "{name}: regra da recusa");
                }
                return;
            }
            Ok(spec) => {
                assert!(expect.get("error").is_none(), "{name}: esperava recusa");
                Engine::new(spec, &sha256_hex(spec_text.as_bytes())).unwrap()
            }
        };
        let rom = from_hex(doc["rom_hex"].as_str().unwrap());
        let sha = sha256_hex(&rom);
        let found = engine.locate(&rom, &sha).unwrap().instances;
        let want = expect["instances"].as_array().unwrap();
        assert_eq!(found.len(), want.len(), "{name}: numero de instancias");
        for (i, (f, w)) in found.iter().zip(want).enumerate() {
            let at = format!("{name}#{i}");
            assert_eq!(
                f.anchor_offset as u64,
                w["anchor_offset"].as_u64().unwrap(),
                "{at}"
            );
            assert_eq!(
                f.anchor_is_outer,
                w["anchor_is_outer"].as_bool().unwrap(),
                "{at}"
            );
            let links: BTreeMap<String, u64> = f
                .links
                .iter()
                .map(|(k, m)| (k.clone(), m.offset as u64))
                .collect();
            let wl: BTreeMap<String, u64> = w["links"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(k, v)| (k.clone(), v.as_u64().unwrap()))
                .collect();
            assert_eq!(links, wl, "{at}: ligacoes");
            let wf = w["fields"].as_array().unwrap();
            assert_eq!(f.fields.len(), wf.len(), "{at}: campos");
            for (a, b) in f.fields.iter().zip(wf) {
                assert_eq!(a.name, b["name"].as_str().unwrap(), "{at}");
                assert_eq!(a.value, b["value"].as_i64().unwrap(), "{at}.{}", a.name);
                let offs: Vec<u64> = a.rom_offsets.iter().map(|o| *o as u64).collect();
                let bo: Vec<u64> = b["rom_offsets"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_u64().unwrap())
                    .collect();
                assert_eq!(offs, bo, "{at}.{}: offsets", a.name);
            }
            // toda instância projeta um grafo que a própria revisão aceita como canônico e sem mudanças
            let g = graph_json(&engine, &rom, f, &sha).unwrap();
            let rev = review_graph(&engine, &rom, &sha, f.anchor_offset, &g).unwrap();
            assert!(
                rev.structural_ok && rev.problems.is_empty(),
                "{at}: {rev:?}"
            );
            assert!(rev.changes.is_empty() && !rev.legacy_binding, "{at}");
        }
        for (k, e) in doc["edits"].as_array().unwrap().iter().enumerate() {
            let at = format!("{name}/edit{k}");
            let inst = &found[e["instance"].as_u64().unwrap() as usize];
            let set: Vec<(String, i64)> = e["set"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(n, v)| (n.clone(), v.as_i64().unwrap()))
                .collect();
            let wanted: Vec<(&str, Option<i64>)> =
                set.iter().map(|(n, v)| (n.as_str(), Some(*v))).collect();
            let plan = engine.plan_edit(&rom, inst, &wanted);
            if let Some(err) = e["expect"].get("error") {
                assert_eq!(
                    format!("{:?}", plan.unwrap_err()),
                    err.as_str().unwrap(),
                    "{at}"
                );
                continue;
            }
            let patches = plan.unwrap_or_else(|e| panic!("{at}: {e:?}"));
            let mut offs: Vec<u64> = patches.iter().map(|p| p.offset as u64).collect();
            offs.sort_unstable();
            let mut want: Vec<u64> = e["expect"]["patch_offsets"]
                .as_array()
                .unwrap()
                .iter()
                .map(|v| v.as_u64().unwrap())
                .collect();
            want.sort_unstable();
            assert_eq!(offs, want, "{at}: offsets do patch");
            let copy = apply(&rom, &patches).unwrap();
            assert_eq!(copy.len(), rom.len(), "{at}: tamanho");
            let changed: Vec<usize> = (0..rom.len()).filter(|i| rom[*i] != copy[*i]).collect();
            assert!(
                changed.iter().all(|i| patches
                    .iter()
                    .any(|p| (p.offset..p.offset + p.new.len()).contains(i))),
                "{at}: byte alterado fora dos patches"
            );
            assert!(!changed.is_empty(), "{at}: nada mudou");
            let ips_bytes = ips(&patches).unwrap();
            assert_eq!(
                ips_apply_strict(&rom, &ips_bytes).unwrap(),
                copy,
                "{at}: ips"
            );
            assert_eq!(
                apply(&copy, &patches),
                Err(EditError::StaleBytes),
                "{at}: reaplicar"
            );
            // a cópia relocalizada devolve os novos valores
            let again = engine.locate_any(&copy).unwrap().instances;
            for (n, v) in &set {
                let got = again[e["instance"].as_u64().unwrap() as usize]
                    .fields
                    .iter()
                    .find(|f| f.name == *n)
                    .unwrap_or_else(|| panic!("{at}: campo {n} sumiu"));
                assert_eq!(got.value, *v, "{at}: {n} na copia");
            }
            // o MESMO pedido feito pelo grafo: valores postos nos nós, revisão contra a ROM
            let mut g: Value =
                serde_json::from_str(&graph_json(&engine, &rom, inst, &sha).unwrap()).unwrap();
            for n in g["nodes"].as_array_mut().unwrap() {
                let campo = n["params"]["campo"].as_str().map(str::to_string);
                if let Some((_, v)) = set.iter().find(|(f, _)| Some(f) == campo.as_ref()) {
                    n["params"]["value"] = json!(v);
                }
            }
            let rev =
                review_graph(&engine, &rom, &sha, inst.anchor_offset, &g.to_string()).unwrap();
            assert!(rev.accepted(), "{at}: revisao {rev:?}");
            let by_graph: Vec<(&str, Option<i64>)> = rev
                .changes
                .iter()
                .map(|(n, v)| (n.as_str(), Some(*v)))
                .collect();
            let mut a = engine.plan_edit(&rom, inst, &by_graph).unwrap();
            let mut b = patches.clone();
            a.sort_by_key(|p| p.offset);
            b.sort_by_key(|p| p.offset);
            assert_eq!(a, b, "{at}: plano pelo grafo");
        }
    }

    #[test]
    fn fixtures_de_perfil_passam_pelo_mesmo_corpo_de_teste() {
        let mut files: Vec<PathBuf> = std::fs::read_dir(fixtures_dir())
            .expect("pasta de fixtures")
            .map(|e| e.unwrap().path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        files.sort();
        assert!(!files.is_empty(), "sem fixtures");
        for f in &files {
            run_fixture(f);
        }
        println!(
            "{} fixtures executados pelo mesmo corpo de teste",
            files.len()
        );
    }

    fn located(engine: &Engine, rom: &[u8]) -> Vec<EngineInstance> {
        engine.locate(rom, &sha256_hex(rom)).unwrap().instances
    }

    #[test]
    fn localiza_valores_tipados_em_larguras_sinal_e_ordem_de_bytes_diferentes() {
        let e = engine_of(&mini());
        let rom = mini_rom();
        let found = located(&e, &rom);
        assert_eq!(found.len(), 2);
        let (full, lone) = (&found[0], &found[1]);
        assert_eq!((full.anchor_offset, lone.anchor_offset), (A1, A2));
        let f = |i: &EngineInstance, n: &str| i.fields.iter().find(|f| f.name == n).cloned();
        let lim = f(full, "lim").unwrap();
        let low = f(full, "low").unwrap();
        let top = f(full, "top").unwrap();
        assert_eq!((lim.value, lim.rom_offsets.clone()), (300, vec![A1 + 2]));
        assert_eq!((low.value, low.rom_offsets.clone()), (80, vec![B1 + 3]));
        assert_eq!(
            (top.value, top.rom_offsets.clone()),
            (100_000, vec![C1 + 2])
        );
        assert_eq!((low.enc.width, low.enc.signed), (1, false));
        assert_eq!((top.enc.width, top.enc.little), (4, true));
        assert_eq!(full.links["p"].offset, B1);
        assert_eq!(full.links["f"].offset, C1);
        // estático: pareado = consistência (L2); âncora sozinha = só forma (L1)
        assert!(full
            .fields
            .iter()
            .all(|f| f.static_level == EvidenceLevel::L2Consistency));
        assert_eq!(lone.fields.len(), 1);
        assert_eq!(lone.fields[0].static_level, EvidenceLevel::L1StaticForm);
        assert_eq!(e.notes(&rom, full), ["portão em 0x40"]);
        assert_eq!(
            e.notes(&rom, lone),
            ["portão em 0x100", "sem par: só o limite é oferecido"]
        );
        assert_eq!(
            e.details(&rom, lone),
            [("objeto".to_string(), "+20".to_string())]
        );
    }

    #[test]
    fn capturas_separam_offset_de_arquivo_barramento_e_deslocamento() {
        let e = engine_of(&mini());
        let rom = mini_rom();
        let caps = e.captures(&rom, &located(&e, &rom)[0]);
        let cap = |src: &str, n: &str| {
            caps.iter()
                .find(|c| c.source == src && c.name == n)
                .unwrap()
                .clone()
        };
        let obj = cap("anchor", "obj");
        assert_eq!(
            (
                obj.role,
                obj.value,
                obj.file_offset,
                obj.designates_bus_address
            ),
            (CaptureRole::EaDisplacement, 0x10, A1 + 6, None)
        );
        let ram = cap("f", "ram");
        assert_eq!(ram.role, CaptureRole::BusAddress);
        assert_eq!(ram.file_offset, C1 + 10);
        // os bytes F6 02 no ARQUIVO designam o endereço de BARRAMENTO 0xFFF602 (RAM)
        assert_eq!(ram.designates_bus_address, Some(0xFF_F602));
        assert_eq!(cap("p", "low").designates_bus_address, None);
    }

    #[test]
    fn candidatos_ambiguos_nao_sao_ligados_e_o_motivo_fica_registrado() {
        // dois alvos consistentes à MESMA distância da âncora (um antes, um depois)
        let mut rom = mini_rom();
        put(&mut rom, A1 - 0x20, &pat_b(11, 0x10));
        let refuse = engine_of(&mini());
        let i = &located(&refuse, &rom)[0];
        assert!(i.links.is_empty(), "empate recusado não liga a nenhum");
        assert_eq!(i.fields.len(), 1, "sem par, só o campo da âncora");
        assert_eq!(i.fields[0].static_level, EvidenceLevel::L1StaticForm);
        assert_eq!(i.ambiguities.len(), 1);
        assert!(
            i.ambiguities[0].contains("2 candidatos"),
            "{:?}",
            i.ambiguities
        );
        assert!(refuse.plan_edit(&rom, i, &[("low", Some(1))]) == Err(PlanError::FieldUnavailable));
        // a regra explícita `first` escolhe o de menor offset — e isso é dito no dado, não suposto
        let first = engine_of(&mini_with(|m| m["relations"][0]["tie"] = json!("first")));
        let j = &located(&first, &rom)[0];
        assert_eq!(j.links["p"].offset, A1 - 0x20);
        assert!(j.ambiguities.is_empty());
        // dois seguidores equidistantes não existem (follow é só para a frente); duas ÂNCORAS disputando
        // o mesmo alvo com pareamento mútuo: ninguém leva
        let mut rom2 = mini_rom();
        put(&mut rom2, B1 + 0x20, &pat_a(7, 0x10));
        let both = located(&refuse, &rom2);
        assert!(both
            .iter()
            .filter(|i| i.anchor.cap("obj") == Some(0x10))
            .all(|i| i.links.is_empty()));
        assert!(both
            .iter()
            .any(|i| i.ambiguities.iter().any(|a| a.contains("âncoras"))));
    }

    #[test]
    fn pareamento_incompativel_nao_liga_e_nao_inventa_campo() {
        let e = engine_of(&mini());
        // alvo com OUTRO objeto: inconsistente
        let mut rom = mini_rom();
        put(&mut rom, B1, &pat_b(80, 0x30));
        let i = &located(&e, &rom)[0];
        assert!(i.links.is_empty() && i.ambiguities.is_empty());
        assert_eq!(
            i.fields.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(),
            ["lim"]
        );
        // alvo consistente mas além da distância máxima
        let mut far = vec![0x80u8; 0x400];
        put(&mut far, 0x40, &pat_a(300, 0x10));
        put(&mut far, 0x40 + 66, &pat_b(80, 0x10));
        assert!(located(&e, &far)[0].links.is_empty());
        // seguidor ANTES do alvo não é seguidor
        let mut back = mini_rom();
        put(&mut back, C1, &[0x80; 12]);
        put(&mut back, B1 - 0x10, &pat_c(1, 0x10, 0xF602));
        let k = &located(&e, &back)[0];
        assert!(k.links.contains_key("p") && !k.links.contains_key("f"));
    }

    #[test]
    fn restricoes_entre_capturas_descartam_ocorrencias_e_contam() {
        let e = engine_of(&mini());
        let mut rom = mini_rom();
        put(&mut rom, 0x180, &pat_a(9, 0x0300)); // obj fora de 0..255
        put(&mut rom, 0x190, &pat_a(9, 0x0011)); // obj ímpar
        let l = e.locate(&rom, &sha256_hex(&rom)).unwrap();
        assert_eq!(l.instances.len(), 2);
        assert_eq!(l.rejected_by_constraint, 2);
        let d = engine_of(&mini_with(|m| {
            m["patterns"][0]["sources"] = json!(["30 3C {lim:2} 4A 6E {obj:2} 0C 40 {lim2:2}"]);
            m["captures"].as_array_mut().unwrap().push(json!({"name": "lim2", "width": 2, "signed": true, "endianness": "big", "role": "opaque"}));
            m["constraints"].as_array_mut().unwrap().push(
                json!({"kind": "distinct", "id": "lims", "pattern": "a", "a": "lim", "b": "lim2"}),
            );
        }));
        let mut r = vec![0x80u8; 0x100];
        let mut same = pat_a(300, 0x10);
        same.extend([0x0C, 0x40, 0x01, 0x2C]);
        let mut diff = pat_a(300, 0x10);
        diff.extend([0x0C, 0x40, 0x00, 0x01]);
        put(&mut r, 0x20, &same);
        put(&mut r, 0x60, &diff);
        let l = d.locate(&r, &sha256_hex(&r)).unwrap();
        assert_eq!(
            l.instances
                .iter()
                .map(|i| i.anchor_offset)
                .collect::<Vec<_>>(),
            [0x60]
        );
        assert_eq!(l.rejected_by_constraint, 1);
    }

    #[test]
    fn limites_de_trabalho_recusam_em_vez_de_cortar_em_silencio() {
        let rom = mini_rom();
        let sha = sha256_hex(&rom);
        let wl =
            |k: &'static str, v: u64| engine_of(&mini_with(|m| m["work_limits"][k] = json!(v)));
        assert!(matches!(
            wl("max_rom_bytes", 0x100).locate(&rom, &sha),
            Err(EngineError::WorkLimit(_))
        ));
        assert!(matches!(
            wl("max_matches_per_pattern", 1).locate(&rom, &sha),
            Err(EngineError::WorkLimit(_))
        ));
        assert!(matches!(
            wl("max_instances", 1).locate(&rom, &sha),
            Err(EngineError::WorkLimit(_))
        ));
        assert!(wl("max_instances", 2).locate(&rom, &sha).is_ok());
        assert!(matches!(
            wl("max_instances", 1).instance_at(&rom, &sha, A1),
            Err(ProfileError::WorkLimit(_))
        ));
    }

    #[test]
    fn perfil_vinculado_por_sha_nao_tenta_outra_rom() {
        let rom = mini_rom();
        let sha = sha256_hex(&rom);
        let bound = |h: String| {
            engine_of(&mini_with(move |m| {
                m["rom_binding"] = json!({"mode": "sha256", "sha256": [h]})
            }))
        };
        let other = bound("a".repeat(64));
        let l = other.locate(&rom, &sha).unwrap();
        assert!(!l.bound && l.instances.is_empty());
        assert_eq!(
            other.instance_at(&rom, &sha, A1),
            Err(ProfileError::RomNotBound)
        );
        let same = bound(sha.clone());
        let l = same.locate(&rom, &sha).unwrap();
        assert!(l.bound && l.instances.len() == 2);
        // a CÓPIA editada tem outro SHA: só a releitura explícita (`locate_any`) a alcança
        assert_eq!(same.locate_any(&rom).unwrap().instances.len(), 2);
    }

    #[test]
    fn edicao_escreve_na_largura_e_ordem_certas_e_preserva_o_resto() {
        let e = engine_of(&mini());
        let rom = mini_rom();
        let inst = &located(&e, &rom)[0];
        let patches = e
            .plan_edit(
                &rom,
                inst,
                &[
                    ("lim", Some(-1)),
                    ("low", Some(200)),
                    ("top", Some(0x0001_0203)),
                ],
            )
            .unwrap_err();
        assert_eq!(
            patches,
            PlanError::OutOfRange,
            "lim=-1 está fora do domínio 1..1000"
        );
        let patches = e
            .plan_edit(
                &rom,
                inst,
                &[
                    ("lim", Some(999)),
                    ("low", Some(200)),
                    ("top", Some(0x0001_0203)),
                ],
            )
            .unwrap();
        assert_eq!(
            patches
                .iter()
                .map(|p| (p.offset, p.new.clone()))
                .collect::<Vec<_>>(),
            [
                (A1 + 2, vec![0x03, 0xE7]),
                (B1 + 3, vec![200]),
                (C1 + 2, vec![0x03, 0x02, 0x01, 0x00]),
            ]
        );
        let copy = apply(&rom, &patches).unwrap();
        let touched: Vec<usize> = (0..rom.len()).filter(|i| rom[*i] != copy[*i]).collect();
        // fora dos 7 bytes dos três campos, NADA mudou
        assert!(touched
            .iter()
            .all(|i| (A1 + 2..A1 + 4).contains(i) || *i == B1 + 3 || (C1 + 2..C1 + 6).contains(i)));
        assert_eq!(copy.len(), rom.len());
        assert_eq!(
            ips_apply_strict(&rom, &ips(&patches).unwrap()).unwrap(),
            copy
        );
        let again = &e.locate_any(&copy).unwrap().instances[0];
        assert_eq!(
            again.fields.iter().map(|f| f.value).collect::<Vec<_>>(),
            [999, 200, 0x0001_0203]
        );
        // a segunda instância não foi tocada
        assert_eq!(e.locate_any(&copy).unwrap().instances[1].fields[0].value, 5);
        // domínio do perfil e largura do tipo são limites diferentes; os dois recusam
        assert_eq!(
            e.plan_edit(&rom, inst, &[("low", Some(201))]),
            Err(PlanError::OutOfRange)
        );
        assert_eq!(
            e.plan_edit(&rom, inst, &[("top", Some(100_001))]),
            Err(PlanError::OutOfRange)
        );
        assert_eq!(
            e.plan_edit(&rom, inst, &[("lim", Some(300))]),
            Err(PlanError::NoChange)
        );
        assert_eq!(
            e.plan_edit(&rom, inst, &[("nada", Some(1))]),
            Err(PlanError::FieldUnavailable)
        );
        let lone = &located(&e, &rom)[1];
        assert_eq!(
            e.plan_edit(&rom, lone, &[("low", Some(1))]),
            Err(PlanError::FieldUnavailable)
        );
    }

    #[test]
    fn repeticao_divergente_tira_o_campo_em_vez_de_editar_pela_metade() {
        // `extra_offsets` aponta para bytes que não repetem a captura: o campo não é oferecido
        let e = engine_of(&mini_with(|m| m["fields"][0]["extra_offsets"] = json!([6])));
        let rom = mini_rom();
        let i = &located(&e, &rom)[0];
        assert!(!i.fields.iter().any(|f| f.name == "lim"));
        assert!(i.ambiguities.iter().any(|a| a.contains("repetições")));
    }

    #[test]
    fn texto_com_cara_de_codigo_sai_literal() {
        let e = engine_of(&mini_with(|m| {
            m["notes"][0]["text"][0]["t"] = json!("{lim} ${obj} $(rm -rf /) `id` <%= x %> ");
        }));
        let rom = mini_rom();
        let n = e.notes(&rom, &located(&e, &rom)[0]);
        assert_eq!(n[0], "{lim} ${obj} $(rm -rf /) `id` <%= x %> 0x40");
        assert_eq!(fmt_num(-16, 2, NumFmt::Hex), "0xfff0");
        assert_eq!(fmt_num(-16, 2, NumFmt::Dec), "-16");
        assert_eq!(fmt_num(0x1A, 8, NumFmt::Hex6), "0x00001A");
        assert_eq!(fmt_num(0x1A, 1, NumFmt::HexBare), "1a");
    }

    #[test]
    fn rom_vazia_ou_menor_que_o_padrao_nao_gera_instancia() {
        let e = engine_of(&mini());
        assert!(located(&e, &[]).is_empty());
        assert!(located(&e, &[0u8; 6]).is_empty());
    }
}
