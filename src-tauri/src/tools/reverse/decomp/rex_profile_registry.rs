//! Registro de perfis REX: de onde vêm e como são escolhidos.
//!
//! Carga: (1) perfis EMBUTIDOS, enumerados na compilação a partir de `data/rex_profiles/specs/*.json`
//! (`build.rs`); (2) perfis AUTORAIS, lidos em tempo de execução de uma pasta indicada pelo usuário.
//! Seleção: não há escolha por nome de jogo nem por id — todo perfil carregado tenta a ROM, e quem
//! reconhece aparece no resultado. Um arquivo que não passa na validação estrita é REJEITADO com o motivo,
//! nunca ignorado em silêncio; id repetido também é rejeitado (o primeiro carregado prevalece).

use std::fs;
use std::path::Path;

use serde::Serialize;

use super::rex_profile_engine::{Engine, EngineError};
use super::rex_profile_semantic::{SemanticEngine, SemanticSpec, SEMANTIC_SCHEMA};
use super::rex_profile_spec::{ProfileSpec, MAX_SPEC_BYTES};
use super::rom_library::sha256_hex;

include!(concat!(env!("OUT_DIR"), "/rex_builtin_profiles.rs"));

/// Máximo de arquivos lidos de uma pasta de perfis autorais.
pub const MAX_PROFILE_FILES: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Builtin,
    Directory,
}

#[derive(Clone)]
pub struct LoadedProfile {
    pub engine: Engine,
    pub origin: Origin,
    pub file: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Rejected {
    pub file: String,
    /// Código estável da regra violada (`SpecError::rule`) ou `duplicate-profile`, `io`, `work-limit`.
    pub rule: String,
    pub message: String,
}

/// Perfil da classe semântica (a regra é derivada por um analisador, não localizada por assinatura).
#[derive(Clone)]
pub struct LoadedSemantic {
    pub engine: SemanticEngine,
    pub origin: Origin,
    pub file: String,
}

#[derive(Clone, Default)]
pub struct Registry {
    pub profiles: Vec<LoadedProfile>,
    pub semantic: Vec<LoadedSemantic>,
    pub rejected: Vec<Rejected>,
}

impl Registry {
    fn add(&mut self, origin: Origin, file: &str, text: &str) {
        let reject = |rule: &str, message: String| Rejected {
            file: file.to_string(),
            rule: rule.to_string(),
            message,
        };
        // a CLASSE do perfil é o esquema do arquivo; nunca o id nem o nome
        #[derive(serde::Deserialize)]
        struct Head {
            schema: String,
        }
        let is_semantic =
            serde_json::from_str::<Head>(text).is_ok_and(|h| h.schema == SEMANTIC_SCHEMA);
        if is_semantic {
            let spec = match SemanticSpec::from_json(text) {
                Ok(s) => s,
                Err(e) => return self.rejected.push(reject(e.rule(), e.to_string())),
            };
            if let Some(prev) = self.file_of(&spec.id) {
                let msg = format!("id '{}' já carregado de '{prev}'", spec.id);
                return self.rejected.push(reject("duplicate-profile", msg));
            }
            return match SemanticEngine::new(spec, &sha256_hex(text.as_bytes())) {
                Ok(engine) => self.semantic.push(LoadedSemantic {
                    engine,
                    origin,
                    file: file.to_string(),
                }),
                Err(e) => self.rejected.push(reject(e.rule(), e.to_string())),
            };
        }
        let spec = match ProfileSpec::from_json(text) {
            Ok(s) => s,
            Err(e) => return self.rejected.push(reject(e.rule(), e.to_string())),
        };
        if let Some(prev) = self.file_of(&spec.id) {
            let msg = format!("id '{}' já carregado de '{prev}'", spec.id);
            return self.rejected.push(reject("duplicate-profile", msg));
        }
        match Engine::new(spec, &sha256_hex(text.as_bytes())) {
            Ok(engine) => self.profiles.push(LoadedProfile {
                engine,
                origin,
                file: file.to_string(),
            }),
            Err(EngineError::Spec(e)) => self.rejected.push(reject(e.rule(), e.to_string())),
            Err(EngineError::WorkLimit(m)) => self.rejected.push(reject("work-limit", m)),
        }
    }

    /// Só os perfis embutidos.
    pub fn builtin() -> Registry {
        let mut r = Registry::default();
        for (file, text) in BUILTIN_PROFILES {
            r.add(Origin::Builtin, file, text);
        }
        r
    }

    /// Embutidos + os `*.json` de `dir` (sem subpastas, em ordem de nome, com limites de quantidade e tamanho).
    pub fn load(dir: Option<&Path>) -> Registry {
        let mut r = Registry::builtin();
        let Some(dir) = dir else { return r };
        let shown = dir.to_string_lossy().into_owned();
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(e) => {
                r.rejected.push(Rejected {
                    file: shown,
                    rule: "io".into(),
                    message: format!("pasta de perfis inacessível: {e}"),
                });
                return r;
            }
        };
        let mut files: Vec<_> = entries
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        files.sort();
        if files.len() > MAX_PROFILE_FILES {
            r.rejected.push(Rejected {
                file: shown,
                rule: "work-limit".into(),
                message: format!(
                    "{} arquivos na pasta; só os {MAX_PROFILE_FILES} primeiros foram lidos",
                    files.len()
                ),
            });
            files.truncate(MAX_PROFILE_FILES);
        }
        for path in files {
            let name = path.to_string_lossy().into_owned();
            let io = |m: String| Rejected {
                file: name.clone(),
                rule: "io".into(),
                message: m,
            };
            // tamanho conferido ANTES de ler; só arquivo regular
            match fs::symlink_metadata(&path) {
                Ok(m) if !m.is_file() => r.rejected.push(io("não é um arquivo regular".into())),
                Ok(m) if m.len() > MAX_SPEC_BYTES as u64 => r.rejected.push(Rejected {
                    file: name.clone(),
                    rule: "too-large".into(),
                    message: format!("{} bytes; recusado sem ler", m.len()),
                }),
                Ok(_) => match fs::read_to_string(&path) {
                    Ok(text) => r.add(Origin::Directory, &name, &text),
                    Err(e) => r.rejected.push(io(format!("falha ao ler: {e}"))),
                },
                Err(e) => r.rejected.push(io(format!("inacessível: {e}"))),
            }
        }
        r
    }

    pub fn find(&self, id: &str) -> Option<&LoadedProfile> {
        self.profiles.iter().find(|p| p.engine.spec().id == id)
    }

    pub fn find_semantic(&self, id: &str) -> Option<&LoadedSemantic> {
        self.semantic.iter().find(|p| p.engine.spec().id == id)
    }

    /// Arquivo que já carregou este id, em qualquer classe (o id é único no registro inteiro).
    fn file_of(&self, id: &str) -> Option<String> {
        self.find(id)
            .map(|p| p.file.clone())
            .or_else(|| self.find_semantic(id).map(|p| p.file.clone()))
    }
}

#[cfg(test)]
mod tests {
    use super::super::rex_profile_testkit::*;
    use super::*;
    use serde_json::json;

    fn dir(nome: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("rex-registry-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn embutidos_vem_do_diretorio_de_dados_e_sao_validos() {
        let r = Registry::builtin();
        assert_eq!(
            r.rejected,
            [],
            "todo perfil embutido tem de passar na validação estrita"
        );
        assert!(!r.profiles.is_empty());
        assert!(r.profiles.iter().all(|p| p.origin == Origin::Builtin));
        // a lista é a do diretório, sem nome escrito no código
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/rex_profiles/specs");
        let mut on_disk: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.is_file() && p.extension().is_some_and(|x| x == "json"))
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        on_disk.sort();
        let mut loaded: Vec<String> = r
            .profiles
            .iter()
            .map(|p| p.file.clone())
            .chain(r.semantic.iter().map(|p| p.file.clone()))
            .collect();
        loaded.sort();
        assert_eq!(loaded, on_disk);
        for p in &r.profiles {
            assert_eq!(p.engine.profile_sha256().len(), 64);
        }
    }

    #[test]
    fn pasta_de_perfis_carrega_os_validos_e_rejeita_os_demais_com_o_motivo() {
        let d = dir("mix");
        let builtin_id = Registry::builtin().profiles[0].engine.spec().id.clone();
        fs::write(d.join("10-ok.json"), text(&mini())).unwrap();
        fs::write(
            d.join("20-repetido.json"),
            text(&mini_with(|m| m["title"] = json!("Cópia"))),
        )
        .unwrap();
        fs::write(d.join("30-quebrado.json"), "{ nao e json").unwrap();
        fs::write(
            d.join("40-v1.json"),
            text(&mini_with(|m| m["schema"] = json!("rex-profile-spec/v1"))),
        )
        .unwrap();
        fs::write(
            d.join("50-campo-duplicado.json"),
            text(&mini_with(|m| {
                let f = m["fields"][0].clone();
                m["fields"].as_array_mut().unwrap().push(f);
            })),
        )
        .unwrap();
        fs::write(
            d.join("60-sombra.json"),
            text(&mini_with(|m| m["id"] = json!(builtin_id))),
        )
        .unwrap();
        fs::write(d.join("70-enorme.json"), " ".repeat(MAX_SPEC_BYTES + 1)).unwrap();
        fs::write(
            d.join("80-overflow.json"),
            text(&mini_with(|m| m["fields"][1]["max"] = json!(300))),
        )
        .unwrap();
        fs::write(d.join("leia-me.txt"), "não é perfil").unwrap();
        fs::create_dir(d.join("90-pasta.json")).unwrap();
        let r = Registry::load(Some(&d));
        let ids: Vec<&str> = r
            .profiles
            .iter()
            .map(|p| p.engine.spec().id.as_str())
            .collect();
        assert!(ids.contains(&MINI_ID) && ids.contains(&builtin_id.as_str()));
        assert_eq!(
            r.profiles
                .iter()
                .filter(|p| p.origin == Origin::Directory)
                .count(),
            1
        );
        // o embutido NÃO pode ser sombreado por um arquivo da pasta com o mesmo id
        assert_eq!(r.find(&builtin_id).unwrap().origin, Origin::Builtin);
        assert_eq!(
            r.find(MINI_ID).unwrap().engine.spec().title,
            "Portão mínimo"
        );
        let rules: Vec<(String, &str)> = r
            .rejected
            .iter()
            .map(|x| {
                (
                    Path::new(&x.file)
                        .file_name()
                        .unwrap()
                        .to_string_lossy()
                        .into_owned(),
                    x.rule.as_str(),
                )
            })
            .collect();
        assert_eq!(
            rules,
            [
                ("20-repetido.json".to_string(), "duplicate-profile"),
                ("30-quebrado.json".to_string(), "parse"),
                ("40-v1.json".to_string(), "wrong-schema"),
                ("50-campo-duplicado.json".to_string(), "duplicate"),
                ("60-sombra.json".to_string(), "duplicate-profile"),
                ("70-enorme.json".to_string(), "too-large"),
                ("80-overflow.json".to_string(), "domain-overflow"),
                ("90-pasta.json".to_string(), "io"),
            ]
        );
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn pasta_inexistente_e_dita_e_os_embutidos_continuam() {
        let r = Registry::load(Some(Path::new("/nao/existe/rex-perfis")));
        assert_eq!(r.profiles.len(), Registry::builtin().profiles.len());
        assert_eq!(r.rejected.len(), 1);
        assert_eq!(r.rejected[0].rule, "io");
    }

    #[test]
    fn o_hash_do_perfil_e_o_do_arquivo() {
        let d = dir("hash");
        let t = text(&mini());
        fs::write(d.join("p.json"), &t).unwrap();
        let r = Registry::load(Some(&d));
        assert_eq!(
            r.find(MINI_ID).unwrap().engine.profile_sha256(),
            sha256_hex(t.as_bytes())
        );
        let _ = fs::remove_dir_all(&d);
    }
}
