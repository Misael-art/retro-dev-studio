//! Referencias por caminho e operacoes de modelo (Experimental, REQ-03/04/05).
//!
//! Assets do projeto ainda sao referenciados pelo caminho (`assets/...`) em cenas, prefabs e grafos.
//! Este modulo audita essas referencias, renomeia/move um asset atualizando TODAS as referencias
//! exatas numa transacao (copia de seguranca antes de escrever, desfeita se qualquer passo falhar) e
//! aplica a excecao local de uma instancia ao modelo (prefab). Toda escrita deixa uma copia
//! recuperavel em `.rds/backups/<id>/` e `restore_backup` devolve exatamente os bytes anteriores.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

const REFERENCE_DIRS: [&str; 3] = ["scenes", "prefabs", "graphs"];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PathReference {
    /// Arquivo do projeto que contem a referencia (relativo).
    pub file: String,
    /// JSON Pointer do valor.
    pub pointer: String,
    pub value: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct BackupFile {
    pub file: String,
    /// `false` = o arquivo nao existia antes (restaurar = apagar).
    pub existed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProjectBackup {
    pub id: String,
    pub dir: String,
    pub files: Vec<BackupFile>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RenameReport {
    pub from: String,
    pub to: String,
    /// (arquivo, referencias atualizadas)
    pub updated: Vec<(String, usize)>,
    pub backup: ProjectBackup,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApplyToModelReport {
    pub entity_id: String,
    pub component: String,
    pub prefab: String,
    /// Instancias da cena que usam o modelo (todas recebem a mudanca).
    pub uses: usize,
    pub backup: ProjectBackup,
}

fn json_files(project: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        let mut entries: Vec<_> = entries.flatten().map(|e| e.path()).collect();
        entries.sort();
        for path in entries {
            if path.is_dir() {
                walk(&path, out);
            } else if path.extension().and_then(|e| e.to_str()) == Some("json") {
                out.push(path);
            }
        }
    }
    for dir in REFERENCE_DIRS {
        walk(&project.join(dir), &mut out);
    }
    out
}

fn relative(project: &Path, path: &Path) -> String {
    path.strip_prefix(project)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn collect_refs(value: &Value, pointer: String, out: &mut Vec<(String, String)>) {
    match value {
        Value::String(text) if text.starts_with("assets/") => out.push((pointer, text.clone())),
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                collect_refs(item, format!("{pointer}/{i}"), out);
            }
        }
        Value::Object(map) => {
            for (key, item) in map {
                let escaped = key.replace('~', "~0").replace('/', "~1");
                collect_refs(item, format!("{pointer}/{escaped}"), out);
            }
        }
        Value::String(text) if text.trim_start().starts_with('{') => {
            // Grafo serializado dentro de uma string (logic.graph): referencias tambem contam.
            if let Ok(inner) = serde_json::from_str::<Value>(text) {
                collect_refs(&inner, format!("{pointer}#json"), out);
            }
        }
        _ => {}
    }
}

/// Todas as referencias `assets/...` de cenas, prefabs e grafos, com existencia do arquivo.
pub fn audit_path_references(project: &Path) -> Result<Vec<PathReference>, String> {
    let mut out = Vec::new();
    for file in json_files(project) {
        let text = fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
        let Ok(json) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let mut refs = Vec::new();
        collect_refs(&json, String::new(), &mut refs);
        for (pointer, value) in refs {
            let exists = project.join(&value).is_file();
            out.push(PathReference {
                file: relative(project, &file),
                pointer,
                value,
                exists,
            });
        }
    }
    Ok(out)
}

fn replace_exact(value: &mut Value, from: &str, to: &str) -> usize {
    match value {
        Value::String(text) if text == from => {
            *text = to.to_string();
            1
        }
        Value::String(text) if text.trim_start().starts_with('{') => {
            if let Ok(mut inner) = serde_json::from_str::<Value>(text) {
                let n = replace_exact(&mut inner, from, to);
                if n > 0 {
                    *text = inner.to_string();
                }
                n
            } else {
                0
            }
        }
        Value::Array(items) => items.iter_mut().map(|i| replace_exact(i, from, to)).sum(),
        Value::Object(map) => map.values_mut().map(|i| replace_exact(i, from, to)).sum(),
        _ => 0,
    }
}

fn backup_files(project: &Path, files: &[PathBuf], reason: &str) -> Result<ProjectBackup, String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let id = format!("b{stamp}");
    let dir = project.join(".rds").join("backups").join(&id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for file in files {
        let rel = relative(project, file);
        let existed = file.is_file();
        if existed {
            let target = dir.join(&rel);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(file, &target).map_err(|e| format!("copia de seguranca de {rel}: {e}"))?;
        }
        list.push(BackupFile { file: rel, existed });
    }
    let backup = ProjectBackup {
        id,
        dir: dir.to_string_lossy().to_string(),
        files: list,
        reason: reason.to_string(),
    };
    fs::write(
        dir.join("backup.json"),
        serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(backup)
}

/// Devolve exatamente os bytes guardados (e apaga arquivos que nao existiam antes).
pub fn restore_backup(project: &Path, backup_id: &str) -> Result<ProjectBackup, String> {
    if !backup_id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Identificador de copia invalido.".to_string());
    }
    let dir = project.join(".rds").join("backups").join(backup_id);
    let backup: ProjectBackup = serde_json::from_str::<serde_json::Value>(
        &fs::read_to_string(dir.join("backup.json"))
            .map_err(|e| format!("copia {backup_id}: {e}"))?,
    )
    .ok()
    .and_then(|v| {
        Some(ProjectBackup {
            id: v["id"].as_str()?.to_string(),
            dir: v["dir"].as_str()?.to_string(),
            reason: v["reason"].as_str().unwrap_or_default().to_string(),
            files: v["files"]
                .as_array()?
                .iter()
                .filter_map(|f| {
                    Some(BackupFile {
                        file: f["file"].as_str()?.to_string(),
                        existed: f["existed"].as_bool()?,
                    })
                })
                .collect(),
        })
    })
    .ok_or_else(|| "backup.json ilegivel".to_string())?;
    for f in &backup.files {
        let target = project.join(&f.file);
        if f.existed {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(dir.join(&f.file), &target)
                .map_err(|e| format!("restaurar {}: {e}", f.file))?;
        } else if target.exists() {
            fs::remove_file(&target).map_err(|e| format!("remover {}: {e}", f.file))?;
        }
    }
    Ok(backup)
}

fn checked_asset_path(project: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim();
    if !rel.starts_with("assets/") || rel.contains("..") || rel.contains('\\') {
        return Err(format!(
            "'{rel}' precisa ficar dentro de assets/ (sem '..')."
        ));
    }
    Ok(project.join(rel))
}

/// Move/renomeia um asset e atualiza todas as referencias EXATAS ao caminho antigo. Nada e alterado
/// se o destino existir, a extensao mudar ou qualquer escrita falhar (tudo e restaurado).
pub fn rename_project_asset(project: &Path, from: &str, to: &str) -> Result<RenameReport, String> {
    let source = checked_asset_path(project, from)?;
    let target = checked_asset_path(project, to)?;
    if !source.is_file() {
        return Err(format!("Asset '{from}' nao existe."));
    }
    if target.exists() {
        return Err(format!(
            "Ja existe '{to}'; escolha outro nome (renomear nao sobrescreve)."
        ));
    }
    if source.extension() != target.extension() {
        return Err("Renomear nao muda o tipo do arquivo (extensao diferente).".to_string());
    }
    let mut changes: Vec<(PathBuf, String, usize)> = Vec::new();
    for file in json_files(project) {
        let text = fs::read_to_string(&file).map_err(|e| e.to_string())?;
        let Ok(mut json) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let n = replace_exact(&mut json, from.trim(), to.trim());
        if n > 0 {
            let out = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
            changes.push((file, out, n));
        }
    }
    let mut touched: Vec<PathBuf> = changes.iter().map(|(f, _, _)| f.clone()).collect();
    touched.push(source.clone());
    touched.push(target.clone());
    let backup = backup_files(project, &touched, &format!("renomear {from} -> {to}"))?;
    let result = (|| -> Result<Vec<(String, usize)>, String> {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::rename(&source, &target).map_err(|e| format!("mover arquivo: {e}"))?;
        let mut updated = Vec::new();
        for (file, text, n) in &changes {
            fs::write(file, text).map_err(|e| format!("{}: {e}", relative(project, file)))?;
            updated.push((relative(project, file), *n));
        }
        Ok(updated)
    })();
    match result {
        Ok(updated) => Ok(RenameReport {
            from: from.trim().to_string(),
            to: to.trim().to_string(),
            updated,
            backup,
        }),
        Err(error) => {
            // Transacao: volta ao ultimo estado valido.
            let _ = restore_backup(project, &backup.id);
            Err(format!("Renomeacao desfeita, nada mudou: {error}"))
        }
    }
}

/// Aplica a excecao local `component` da instancia ao modelo (prefab) e devolve a instancia a herdar.
pub fn apply_override_to_model(
    project: &Path,
    scene_path: &str,
    entity_id: &str,
    component: &str,
) -> Result<ApplyToModelReport, String> {
    const COMPONENTS: [&str; 8] = [
        "sprite",
        "collision",
        "input",
        "physics",
        "audio",
        "logic",
        "camera",
        "tilemap",
    ];
    if !COMPONENTS.contains(&component) {
        return Err(format!("Componente '{component}' desconhecido."));
    }
    let scene_file = project.join(scene_path);
    let mut scene: Value =
        serde_json::from_str(&fs::read_to_string(&scene_file).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let entities = scene["entities"]
        .as_array_mut()
        .ok_or("Cena sem entidades")?;
    let entity = entities
        .iter_mut()
        .find(|e| e["entity_id"] == entity_id)
        .ok_or_else(|| format!("Entidade '{entity_id}' nao existe na cena."))?;
    let prefab = entity["prefab"]
        .as_str()
        .filter(|p| !p.is_empty())
        .ok_or("A entidade nao e instancia de um modelo.")?
        .to_string();
    let value = entity["components"][component].clone();
    if value.is_null() {
        return Err(format!(
            "'{component}' nao e excecao local desta instancia."
        ));
    }
    let prefab_file = project.join("prefabs").join(&prefab);
    let mut model: Value =
        serde_json::from_str(&fs::read_to_string(&prefab_file).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    model["components"][component] = value;
    entity["components"][component] = Value::Null;
    let uses = entities
        .iter()
        .filter(|e| e["prefab"].as_str() == Some(prefab.as_str()))
        .count();
    let backup = backup_files(
        project,
        &[scene_file.clone(), prefab_file.clone()],
        &format!("aplicar {component} de {entity_id} ao modelo {prefab}"),
    )?;
    let result = (|| -> Result<(), String> {
        fs::write(
            &prefab_file,
            serde_json::to_string_pretty(&model).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        fs::write(
            &scene_file,
            serde_json::to_string_pretty(&scene).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    })();
    if let Err(error) = result {
        let _ = restore_backup(project, &backup.id);
        return Err(format!("Aplicacao ao modelo desfeita, nada mudou: {error}"));
    }
    Ok(ApplyToModelReport {
        entity_id: entity_id.to_string(),
        component: component.to_string(),
        prefab,
        uses,
        backup,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "rds-refs-{name}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("assets/sprites")).unwrap();
        fs::create_dir_all(dir.join("scenes")).unwrap();
        fs::create_dir_all(dir.join("prefabs")).unwrap();
        fs::write(dir.join("project.rds"), "{}").unwrap();
        fs::write(dir.join("assets/sprites/hero.png"), b"PNGDATA").unwrap();
        fs::write(dir.join("assets/sprites/other.png"), b"OTHER").unwrap();
        let graph =
            serde_json::json!({"nodes":[{"id":"n","params":{"image":"assets/sprites/hero.png"}}]})
                .to_string();
        fs::write(
            dir.join("scenes/main.json"),
            serde_json::to_string_pretty(&serde_json::json!({
                "scene_id": "main",
                "entities": [
                    {"entity_id": "a", "prefab": "enemy.json", "components": {"sprite": null, "logic": {"graph": graph}}},
                    {"entity_id": "b", "prefab": "enemy.json", "components": {"sprite": {"asset": "assets/sprites/other.png"}}},
                    {"entity_id": "c", "prefab": null, "components": {"sprite": {"asset": "assets/sprites/hero.png"}}}
                ]
            }))
            .unwrap(),
        )
        .unwrap();
        fs::write(
            dir.join("prefabs/enemy.json"),
            serde_json::to_string_pretty(&serde_json::json!({"entity_id": "enemy", "components": {"sprite": {"asset": "assets/sprites/hero.png"}}})).unwrap(),
        )
        .unwrap();
        dir
    }

    #[test]
    fn audit_lists_references_including_inline_graphs_and_missing_files() {
        let p = project("audit");
        fs::remove_file(p.join("assets/sprites/other.png")).unwrap();
        let refs = audit_path_references(&p).unwrap();
        assert!(refs.iter().any(|r| r.file == "prefabs/enemy.json"
            && r.value == "assets/sprites/hero.png"
            && r.exists));
        assert!(refs
            .iter()
            .any(|r| r.pointer.contains("#json") && r.value == "assets/sprites/hero.png"));
        assert!(refs
            .iter()
            .any(|r| r.value == "assets/sprites/other.png" && !r.exists));
        let _ = fs::remove_dir_all(p);
    }

    #[test]
    fn rename_updates_every_exact_reference_and_restore_returns_the_bytes() {
        let p = project("rename");
        let scene_before = fs::read(p.join("scenes/main.json")).unwrap();
        let prefab_before = fs::read(p.join("prefabs/enemy.json")).unwrap();
        let report =
            rename_project_asset(&p, "assets/sprites/hero.png", "assets/chars/hero_v2.png")
                .unwrap();
        assert!(!p.join("assets/sprites/hero.png").exists());
        assert_eq!(
            fs::read(p.join("assets/chars/hero_v2.png")).unwrap(),
            b"PNGDATA"
        );
        let refs = audit_path_references(&p).unwrap();
        assert!(
            refs.iter().all(|r| r.value != "assets/sprites/hero.png"),
            "nenhuma referencia antiga"
        );
        assert_eq!(
            refs.iter()
                .filter(|r| r.value == "assets/chars/hero_v2.png")
                .count(),
            3
        );
        assert!(
            refs.iter().any(|r| r.value == "assets/sprites/other.png"),
            "outra referencia intacta"
        );
        assert_eq!(report.updated.iter().map(|(_, n)| n).sum::<usize>(), 3);
        restore_backup(&p, &report.backup.id).unwrap();
        assert_eq!(fs::read(p.join("scenes/main.json")).unwrap(), scene_before);
        assert_eq!(
            fs::read(p.join("prefabs/enemy.json")).unwrap(),
            prefab_before
        );
        assert!(p.join("assets/sprites/hero.png").is_file());
        assert!(!p.join("assets/chars/hero_v2.png").exists());
        let _ = fs::remove_dir_all(p);
    }

    #[test]
    fn rename_refuses_overwrite_type_change_and_outside_assets() {
        let p = project("refuse");
        let before = fs::read(p.join("scenes/main.json")).unwrap();
        assert!(
            rename_project_asset(&p, "assets/sprites/hero.png", "assets/sprites/other.png")
                .is_err()
        );
        assert!(
            rename_project_asset(&p, "assets/sprites/hero.png", "assets/sprites/hero.bmp").is_err()
        );
        assert!(rename_project_asset(&p, "assets/sprites/hero.png", "../hero.png").is_err());
        assert!(
            rename_project_asset(&p, "assets/sprites/none.png", "assets/sprites/x.png").is_err()
        );
        assert_eq!(fs::read(p.join("scenes/main.json")).unwrap(), before);
        let _ = fs::remove_dir_all(p);
    }

    #[test]
    fn apply_override_to_model_moves_the_exception_into_the_prefab_with_backup() {
        let p = project("apply");
        let scene_before = fs::read(p.join("scenes/main.json")).unwrap();
        let report = apply_override_to_model(&p, "scenes/main.json", "b", "sprite").unwrap();
        assert_eq!((report.prefab.as_str(), report.uses), ("enemy.json", 2));
        let model: Value =
            serde_json::from_str(&fs::read_to_string(p.join("prefabs/enemy.json")).unwrap())
                .unwrap();
        assert_eq!(
            model["components"]["sprite"]["asset"],
            "assets/sprites/other.png"
        );
        let scene: Value =
            serde_json::from_str(&fs::read_to_string(p.join("scenes/main.json")).unwrap()).unwrap();
        assert!(
            scene["entities"][1]["components"]["sprite"].is_null(),
            "instancia volta a herdar"
        );
        assert!(
            apply_override_to_model(&p, "scenes/main.json", "a", "sprite").is_err(),
            "sem excecao local"
        );
        assert!(
            apply_override_to_model(&p, "scenes/main.json", "c", "sprite").is_err(),
            "nao e instancia"
        );
        restore_backup(&p, &report.backup.id).unwrap();
        assert_eq!(fs::read(p.join("scenes/main.json")).unwrap(), scene_before);
        let _ = fs::remove_dir_all(p);
    }
}
