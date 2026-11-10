//! Origem de uma evidência: quem afirma e o que isso autoriza a dizer.
//!
//! Quatro origens que nunca se fundem: DECLARADA (o autor do perfil escreveu), HISTÓRICA CURADA (registro
//! do repositório, embutido na compilação, de uma medição passada com procedência), OBSERVADA pelo
//! aplicativo (esta sessão fez e conferiu) e DESCONHECIDA. Um perfil não ganha rótulo de efeito, consumo
//! ou equivalência por declarar o nível; referência e SHA num JSON não comprovam medição; integridade de
//! um registro não é veracidade do conteúdo.

use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use super::rex_profile_registry::Origin;

include!(concat!(env!("OUT_DIR"), "/rex_curated_evidence.rs"));

pub const CURATED_SCHEMA: &str = "rex-curated-evidence/v1";

/// Sob o quê a medição foi feita.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeasuredUnder {
    /// `"code"`: antes de o perfil virar dado; `"data"`: com o perfil em dado.
    pub profile_form: String,
    /// SHA-256 do arquivo do perfil na medição (`null` quando o perfil ainda era código).
    pub profile_sha256: Option<String>,
    pub commit: String,
    pub binary_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReportRef {
    /// Caminho no repositório.
    pub path: String,
    pub sha256: String,
}

/// Registro curado de UMA medição passada. É histórico: nunca é uma observação do aplicativo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CuratedRecord {
    pub id: String,
    pub profile_id: String,
    pub claim_id: String,
    pub measured_under: MeasuredUnder,
    /// SHA-256 dos arquivos de perfil aos quais o registro se aplica.
    pub applies_to_profile_sha256: Vec<String>,
    /// Por que o registro vale para esses perfis quando não foi medido sob eles (vazio se foi).
    pub carried_by: String,
    pub rom_sha256: String,
    pub instance_offsets: Vec<u64>,
    pub report: ReportRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CuratedFile {
    pub schema: String,
    pub records: Vec<CuratedRecord>,
}

/// Registros curados embutidos na compilação (`data/rex_profiles/evidence/*.json`).
pub fn curated_records() -> &'static [CuratedRecord] {
    static RECORDS: OnceLock<Vec<CuratedRecord>> = OnceLock::new();
    RECORDS.get_or_init(|| {
        CURATED_EVIDENCE
            .iter()
            .filter_map(|(_, text)| serde_json::from_str::<CuratedFile>(text).ok())
            .filter(|f| f.schema == CURATED_SCHEMA)
            .flat_map(|f| f.records)
            .collect()
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClaimOrigin {
    /// Só a palavra do autor do perfil.
    Declared,
    /// Há registro curado no repositório (histórico, com procedência).
    Curated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Applicability {
    /// Registro curado para ESTA ROM, ESTA instância e ESTE arquivo de perfil.
    ThisInstance,
    /// Registro curado, mas de outra ROM ou de outra instância.
    OtherTarget,
    /// Registro curado, mas para outro arquivo (revisão) do perfil.
    OtherRevision,
    /// Sem registro curado: só declaração.
    NotCurated,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ClaimStanding {
    pub origin: ClaimOrigin,
    pub applicability: Applicability,
    /// Registros que sustentam a classificação (vazio quando só declarada).
    pub records: Vec<CuratedRecord>,
    /// O registro aplicável foi medido antes de o perfil ser este arquivo e transportado por equivalência.
    pub inherited: bool,
}

/// Classifica UMA afirmação de um perfil para uma ROM e instância.
pub fn classify_claim(
    records: &[CuratedRecord],
    profile_origin: Origin,
    profile_id: &str,
    profile_sha256: &str,
    claim_id: &str,
    rom_sha256: &str,
    instance_offset: u64,
) -> ClaimStanding {
    let declared = ClaimStanding {
        origin: ClaimOrigin::Declared,
        applicability: Applicability::NotCurated,
        records: Vec::new(),
        inherited: false,
    };
    // curadoria é do repositório: um perfil lido de pasta nunca a herda, mesmo com o mesmo id
    if profile_origin != Origin::Builtin {
        return declared;
    }
    let of_claim: Vec<&CuratedRecord> = records
        .iter()
        .filter(|r| r.profile_id == profile_id && r.claim_id == claim_id)
        .collect();
    if of_claim.is_empty() {
        return declared;
    }
    let for_profile: Vec<&CuratedRecord> = of_claim
        .iter()
        .copied()
        .filter(|r| {
            r.applies_to_profile_sha256
                .iter()
                .any(|s| s == profile_sha256)
        })
        .collect();
    let (applicability, kept) = if for_profile.is_empty() {
        (Applicability::OtherRevision, of_claim)
    } else {
        let here: Vec<&CuratedRecord> = for_profile
            .iter()
            .copied()
            .filter(|r| r.rom_sha256 == rom_sha256 && r.instance_offsets.contains(&instance_offset))
            .collect();
        if here.is_empty() {
            (Applicability::OtherTarget, for_profile)
        } else {
            (Applicability::ThisInstance, here)
        }
    };
    ClaimStanding {
        origin: ClaimOrigin::Curated,
        applicability,
        // herdado: nenhum dos registros aplicáveis foi medido sob ESTE arquivo de perfil
        inherited: applicability == Applicability::ThisInstance
            && kept
                .iter()
                .all(|r| r.measured_under.profile_sha256.as_deref() != Some(profile_sha256)),
        records: kept.into_iter().cloned().collect(),
    }
}

/// Há registro curado desta afirmação para ESTE arquivo de perfil (em alguma ROM/instância)?
pub fn curated_for_profile(
    records: &[CuratedRecord],
    profile_origin: Origin,
    profile_id: &str,
    profile_sha256: &str,
    claim_id: &str,
) -> Vec<CuratedRecord> {
    if profile_origin != Origin::Builtin {
        return Vec::new();
    }
    records
        .iter()
        .filter(|r| {
            r.profile_id == profile_id
                && r.claim_id == claim_id
                && r.applies_to_profile_sha256
                    .iter()
                    .any(|s| s == profile_sha256)
        })
        .cloned()
        .collect()
}

/// Identificador desta execução do aplicativo.
pub fn app_session() -> &'static str {
    static SESSION: OnceLock<String> = OnceLock::new();
    SESSION.get_or_init(|| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let seed = format!("{}:{now}", std::process::id());
        super::rom_library::sha256_hex(seed.as_bytes())[..16].to_string()
    })
}

/// Algo que o aplicativo fez e conferiu, com a sessão em que o fez.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppObservation {
    /// `static_form_matched`, `copy_reread`, `ips_reproduces_copy`, `operations_derived_from_bytes`.
    pub kind: String,
    pub session: String,
    pub request_id: String,
}

impl AppObservation {
    pub fn now(kind: &str, request_id: &str) -> AppObservation {
        AppObservation {
            kind: kind.to_string(),
            session: app_session().to_string(),
            request_id: request_id.to_string(),
        }
    }
}

/// A observação é DESTA sessão do aplicativo?
pub fn observation_is_current(obs: &AppObservation) -> bool {
    obs.session == app_session()
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROM: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const PSHA: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    fn record() -> CuratedRecord {
        CuratedRecord {
            id: "r1".into(),
            profile_id: "m68k.x.v1".into(),
            claim_id: "efeito".into(),
            measured_under: MeasuredUnder {
                profile_form: "code".into(),
                profile_sha256: None,
                commit: "c".repeat(40),
                binary_sha256: "d".repeat(64),
            },
            applies_to_profile_sha256: vec![PSHA.into()],
            carried_by: "equivalência".into(),
            rom_sha256: ROM.into(),
            instance_offsets: vec![0x100],
            report: ReportRef {
                path: "data/x.json".into(),
                sha256: "e".repeat(64),
            },
        }
    }

    fn standing(origin: Origin, psha: &str, claim: &str, rom: &str, inst: u64) -> ClaimStanding {
        classify_claim(&[record()], origin, "m68k.x.v1", psha, claim, rom, inst)
    }

    #[test]
    fn registro_curado_vale_so_para_rom_instancia_e_arquivo_de_perfil_listados() {
        let ok = standing(Origin::Builtin, PSHA, "efeito", ROM, 0x100);
        assert_eq!(
            (ok.origin, ok.applicability),
            (ClaimOrigin::Curated, Applicability::ThisInstance)
        );
        assert!(
            ok.inherited,
            "medido antes de o perfil ser este arquivo: herdado"
        );
        assert_eq!(ok.records.len(), 1);
        // N3: registro íntegro, mas de outra instância / de outra ROM
        let outra_inst = standing(Origin::Builtin, PSHA, "efeito", ROM, 0x200);
        assert_eq!(outra_inst.applicability, Applicability::OtherTarget);
        let outra_rom = standing(Origin::Builtin, PSHA, "efeito", &"f".repeat(64), 0x100);
        assert_eq!(outra_rom.applicability, Applicability::OtherTarget);
        // N4: resultado de outra revisão (outro arquivo) do perfil
        let outra_rev = standing(Origin::Builtin, &"9".repeat(64), "efeito", ROM, 0x100);
        assert_eq!(outra_rev.applicability, Applicability::OtherRevision);
        assert_eq!(outra_rev.origin, ClaimOrigin::Curated);
    }

    #[test]
    fn sem_registro_ou_vindo_de_pasta_a_afirmacao_e_so_declarada() {
        // N2: a afirmação cita uma referência, mas não há registro curado para ela
        let sem = standing(Origin::Builtin, PSHA, "outra_afirmacao", ROM, 0x100);
        assert_eq!(
            (sem.origin, sem.applicability),
            (ClaimOrigin::Declared, Applicability::NotCurated)
        );
        assert!(sem.records.is_empty());
        // N1: perfil de PASTA com o mesmo id, a mesma afirmação, a mesma ROM e a mesma instância
        let externo = standing(Origin::Directory, PSHA, "efeito", ROM, 0x100);
        assert_eq!(
            (externo.origin, externo.applicability),
            (ClaimOrigin::Declared, Applicability::NotCurated)
        );
        assert!(externo.records.is_empty());
    }

    #[test]
    fn observacao_de_outra_sessao_nao_e_observacao_atual() {
        let atual = AppObservation::now("copy_reread", "r1");
        assert!(observation_is_current(&atual));
        // N5: registro com o identificador de uma sessão anterior
        let antiga = AppObservation {
            session: "0123456789abcdef".into(),
            ..atual.clone()
        };
        assert!(!observation_is_current(&antiga));
        assert_eq!(app_session().len(), 16);
    }
}
