//! Escada de evidência do REX (contrato de `docs/14_REX_ARQUITETURA_UNIVERSAL.md` §3.2).
//!
//! Tipo puro, sem I/O e sem conhecimento de jogo. Toda afirmação do motor carrega o NÍVEL MAIS ALTO
//! realmente provado e nunca é transmitida além dele. Esta fase (F0) só define o contrato: nenhum
//! comando, UI ou perfil existente passa a usá-lo ainda.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum EvidenceLevel {
    /// ROM identificada por SHA-256, região e tamanho.
    #[serde(rename = "L0")]
    L0Identity,
    /// O padrão estático casou (forma), sem execução.
    #[serde(rename = "L1")]
    L1StaticForm,
    /// Invariantes internos fecham (pareamento, domínios), sem execução.
    #[serde(rename = "L2")]
    L2Consistency,
    /// A execução alcançou a rotina: chamador e argumentos medidos.
    #[serde(rename = "L3")]
    L3ObservedConsumption,
    /// Estado/saída observados em execução (sonda técnica).
    #[serde(rename = "L4")]
    L4MeasuredEffect,
    /// Editar o dado muda o efeito como previsto, com controles.
    #[serde(rename = "L5")]
    L5EditCausality,
    /// Recompila e iguala.
    #[serde(rename = "L6")]
    L6EquivalentRebuild,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvidenceError {
    UnknownLevel(String),
    /// Afirmação em L3 ou acima sem nenhuma base citada (relatório, hash, id de medição).
    MissingBasis(EvidenceLevel),
    EmptyStatement,
    /// Tentativa de transmitir a afirmação acima do nível provado.
    ExceedsProven {
        asked: EvidenceLevel,
        proven: EvidenceLevel,
    },
}

impl EvidenceLevel {
    pub const ALL: [EvidenceLevel; 7] = [
        EvidenceLevel::L0Identity,
        EvidenceLevel::L1StaticForm,
        EvidenceLevel::L2Consistency,
        EvidenceLevel::L3ObservedConsumption,
        EvidenceLevel::L4MeasuredEffect,
        EvidenceLevel::L5EditCausality,
        EvidenceLevel::L6EquivalentRebuild,
    ];

    pub fn code(self) -> &'static str {
        match self {
            EvidenceLevel::L0Identity => "L0",
            EvidenceLevel::L1StaticForm => "L1",
            EvidenceLevel::L2Consistency => "L2",
            EvidenceLevel::L3ObservedConsumption => "L3",
            EvidenceLevel::L4MeasuredEffect => "L4",
            EvidenceLevel::L5EditCausality => "L5",
            EvidenceLevel::L6EquivalentRebuild => "L6",
        }
    }

    pub fn from_code(code: &str) -> Result<EvidenceLevel, EvidenceError> {
        EvidenceLevel::ALL
            .into_iter()
            .find(|l| l.code() == code)
            .ok_or_else(|| EvidenceError::UnknownLevel(code.to_string()))
    }

    /// Rótulo curto em português para a interface.
    pub fn label_pt(self) -> &'static str {
        match self {
            EvidenceLevel::L0Identity => "ROM identificada",
            EvidenceLevel::L1StaticForm => "forma estática reconhecida",
            EvidenceLevel::L2Consistency => "consistência interna verificada",
            EvidenceLevel::L3ObservedConsumption => "uso observado na execução",
            EvidenceLevel::L4MeasuredEffect => "efeito medido na execução",
            EvidenceLevel::L5EditCausality => "edição com efeito previsto e medido",
            EvidenceLevel::L6EquivalentRebuild => "reconstrução equivalente",
        }
    }

    /// Níveis em que a prova depende de execução (L3 em diante) e portanto exige base citada.
    pub fn requires_basis(self) -> bool {
        self >= EvidenceLevel::L3ObservedConsumption
    }
}

/// Eixo de uma afirmação. Os eixos são INDEPENDENTES: efeito medido não implica consumo observado e
/// vice-versa (adendo de 2026-10-09); nenhum eixo é inferido de outro.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceAxis {
    Identity,
    Static,
    Trace,
    Effect,
    Reconstruction,
}

impl EvidenceLevel {
    pub fn axis(self) -> EvidenceAxis {
        match self {
            EvidenceLevel::L0Identity => EvidenceAxis::Identity,
            EvidenceLevel::L1StaticForm | EvidenceLevel::L2Consistency => EvidenceAxis::Static,
            EvidenceLevel::L3ObservedConsumption => EvidenceAxis::Trace,
            EvidenceLevel::L4MeasuredEffect | EvidenceLevel::L5EditCausality => {
                EvidenceAxis::Effect
            }
            EvidenceLevel::L6EquivalentRebuild => EvidenceAxis::Reconstruction,
        }
    }
}

/// Afirmação do motor com o nível provado e a base que o sustenta.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Claim {
    pub statement: String,
    pub level: EvidenceLevel,
    /// Referências verificáveis (hash/id de relatório, de medição). Obrigatório de L3 em diante.
    pub basis: Vec<String>,
}

impl Claim {
    pub fn new(
        statement: &str,
        level: EvidenceLevel,
        basis: Vec<String>,
    ) -> Result<Claim, EvidenceError> {
        if statement.trim().is_empty() {
            return Err(EvidenceError::EmptyStatement);
        }
        let basis: Vec<String> = basis
            .into_iter()
            .map(|b| b.trim().to_string())
            .filter(|b| !b.is_empty())
            .collect();
        if level.requires_basis() && basis.is_empty() {
            return Err(EvidenceError::MissingBasis(level));
        }
        Ok(Claim {
            statement: statement.trim().to_string(),
            level,
            basis,
        })
    }

    /// A afirmação só pode ser apresentada no nível `asked` se `asked` não excede o provado.
    pub fn present_at(&self, asked: EvidenceLevel) -> Result<EvidenceLevel, EvidenceError> {
        if asked > self.level {
            Err(EvidenceError::ExceedsProven {
                asked,
                proven: self.level,
            })
        } else {
            Ok(asked)
        }
    }
}

/// Teto de um conjunto de afirmações: o menor nível entre elas (uma cadeia vale o seu elo mais fraco).
pub fn weakest(claims: &[Claim]) -> Option<EvidenceLevel> {
    claims.iter().map(|c| c.level).min()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn niveis_sao_ordenados_e_os_codigos_fazem_ida_e_volta() {
        let mut prev = None;
        for l in EvidenceLevel::ALL {
            if let Some(p) = prev {
                assert!(l > p);
            }
            prev = Some(l);
            assert_eq!(EvidenceLevel::from_code(l.code()).unwrap(), l);
            assert!(!l.label_pt().is_empty());
        }
        assert_eq!(
            EvidenceLevel::from_code("L7"),
            Err(EvidenceError::UnknownLevel("L7".into()))
        );
        assert!(EvidenceLevel::from_code("l1").is_err());
    }

    #[test]
    fn serializa_como_codigo_curto() {
        let j = serde_json::to_string(&EvidenceLevel::L5EditCausality).unwrap();
        assert_eq!(j, "\"L5\"");
        let l: EvidenceLevel = serde_json::from_str("\"L3\"").unwrap();
        assert_eq!(l, EvidenceLevel::L3ObservedConsumption);
        assert!(serde_json::from_str::<EvidenceLevel>("\"L9\"").is_err());
    }

    #[test]
    fn de_l3_em_diante_exige_base_e_abaixo_nao() {
        assert!(Claim::new("forma", EvidenceLevel::L1StaticForm, vec![]).is_ok());
        assert!(Claim::new("consistente", EvidenceLevel::L2Consistency, vec![]).is_ok());
        for l in [
            EvidenceLevel::L3ObservedConsumption,
            EvidenceLevel::L4MeasuredEffect,
            EvidenceLevel::L5EditCausality,
            EvidenceLevel::L6EquivalentRebuild,
        ] {
            assert_eq!(
                Claim::new("x", l, vec![]),
                Err(EvidenceError::MissingBasis(l))
            );
            // base só com espaços não conta
            assert_eq!(
                Claim::new("x", l, vec!["  ".into()]),
                Err(EvidenceError::MissingBasis(l))
            );
            assert!(Claim::new("x", l, vec!["relatorio:sha256:ab".into()]).is_ok());
        }
    }

    #[test]
    fn afirmacao_vazia_e_recusada() {
        assert_eq!(
            Claim::new("  ", EvidenceLevel::L0Identity, vec![]),
            Err(EvidenceError::EmptyStatement)
        );
    }

    #[test]
    fn nao_se_apresenta_acima_do_provado() {
        let c = Claim::new("pulo localizado", EvidenceLevel::L2Consistency, vec![]).unwrap();
        assert_eq!(
            c.present_at(EvidenceLevel::L1StaticForm),
            Ok(EvidenceLevel::L1StaticForm)
        );
        assert_eq!(
            c.present_at(EvidenceLevel::L2Consistency),
            Ok(EvidenceLevel::L2Consistency)
        );
        assert_eq!(
            c.present_at(EvidenceLevel::L4MeasuredEffect),
            Err(EvidenceError::ExceedsProven {
                asked: EvidenceLevel::L4MeasuredEffect,
                proven: EvidenceLevel::L2Consistency
            })
        );
    }

    #[test]
    fn cadeia_vale_o_elo_mais_fraco() {
        let a = Claim::new("a", EvidenceLevel::L5EditCausality, vec!["r1".into()]).unwrap();
        let b = Claim::new("b", EvidenceLevel::L1StaticForm, vec![]).unwrap();
        assert_eq!(weakest(&[a.clone(), b]), Some(EvidenceLevel::L1StaticForm));
        assert_eq!(weakest(&[a]), Some(EvidenceLevel::L5EditCausality));
        assert_eq!(weakest(&[]), None);
    }
}
