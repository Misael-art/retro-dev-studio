//! Commit the scene and its external graphs together, and finish an interrupted
//! commit only if every file still matches a known before/after image.
use super::project_mgr::{
    graph_write_path, sync_parent_dir, validate_scene, validate_scene_path,
    write_text_atomically_with_retry, LoadError,
};
use super::rom_mastering::sha256_hex;
use crate::ugdm::entities::Scene;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File};
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

const PENDING: &str = ".rds/scene-save/pending.json";
const SCHEMA: &str = "rds.scene-save/1";

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Change {
    before: Option<String>,
    after: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Intent {
    schema: String,
    operation: String,
    scene: String,
    files: BTreeMap<String, Change>,
}

fn error(message: impl std::fmt::Display) -> LoadError {
    LoadError(format!("Salvamento de cena: {message}"))
}

fn checked_path(root: &Path, relative: &Path) -> Result<PathBuf, LoadError> {
    let mut result = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(error("caminho fora do projeto"));
        };
        result.push(part);
        match fs::symlink_metadata(&result) {
            Ok(meta) if meta.is_symlink() => {
                return Err(error(format!("link recusado: {}", result.display())))
            }
            Ok(_) => {}
            Err(e) if e.kind() == ErrorKind::NotFound => {}
            Err(e) => return Err(error(e)),
        }
    }
    Ok(result)
}

fn read_optional(path: &Path) -> Result<Option<Vec<u8>>, LoadError> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(error(format!("{}: {e}", path.display()))),
    }
}

fn matches_before(change: &Change, current: Option<&[u8]>) -> bool {
    current.map(sha256_hex) == change.before
}

fn check_change(change: &Change, bytes: Option<&[u8]>, name: &str) -> Result<bool, LoadError> {
    if bytes == Some(change.after.as_bytes()) {
        return Ok(false);
    }
    if !matches_before(change, bytes) {
        return Err(error(format!(
            "conflito externo em {name}. Preserve o rascunho e confira o arquivo no disco."
        )));
    }
    Ok(true)
}

fn operation_id(scene: &str, files: &BTreeMap<String, Change>) -> Result<String, LoadError> {
    Ok(sha256_hex(
        &serde_json::to_vec(&(SCHEMA, scene, files)).map_err(error)?,
    ))
}

fn lock(root: &Path) -> Result<File, LoadError> {
    let path = checked_path(root, Path::new(".rds/scene-save/writer.lock"))?;
    fs::create_dir_all(path.parent().unwrap()).map_err(error)?;
    let file = File::options()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
        .map_err(error)?;
    file.try_lock()
        .map_err(|e| error(format!("outra gravação ou recuperação em andamento: {e}")))?;
    Ok(file)
}

fn apply(root: &Path, intent: &Intent) -> Result<(), LoadError> {
    if intent.schema != SCHEMA || intent.operation != operation_id(&intent.scene, &intent.files)? {
        return Err(error(
            "intenção desconhecida ou corrompida, preservada para inspeção",
        ));
    }
    validate_scene_path(&intent.scene)?;
    let scene_change = intent
        .files
        .get(&intent.scene)
        .ok_or_else(|| error("intenção sem cena"))?;
    let scene: Scene = serde_json::from_str(&scene_change.after).map_err(error)?;
    validate_scene(&scene)?;
    let allowed: HashSet<PathBuf> = scene
        .entities
        .iter()
        .filter_map(|e| e.components.logic.as_ref()?.graph_ref.as_deref())
        .map(|reference| graph_write_path(root, reference))
        .collect::<Result<_, _>>()?;
    let mut targets = Vec::new();
    // Preflight the entire set before even creating a destination directory.
    for (name, change) in &intent.files {
        let path = checked_path(root, Path::new(name))?;
        if name != &intent.scene && !allowed.contains(&path) {
            return Err(error("arquivo fora das referências da cena"));
        }
        let current = read_optional(&path)?;
        if check_change(change, current.as_deref(), name)? {
            targets.push((name, path, change));
        }
    }
    targets.sort_by_key(|(name, _, _)| *name == &intent.scene);
    for (name, path, change) in targets {
        checked_path(root, Path::new(name))?;
        if check_change(change, read_optional(&path)?.as_deref(), name)? {
            fs::create_dir_all(path.parent().unwrap()).map_err(error)?;
            write_text_atomically_with_retry(&path, &change.after)?;
        }
    }
    finish(root, intent, "committed")
}

fn finish(root: &Path, intent: &Intent, status: &str) -> Result<(), LoadError> {
    let pending = checked_path(root, Path::new(PENDING))?;
    if fs::read(&pending).map_err(error)? != serde_json::to_vec(intent).map_err(error)? {
        return Err(error(
            "a intenção mudou durante a operação, preservada para inspeção",
        ));
    }
    let receipt = checked_path(root, Path::new(".rds/scene-save/last.json"))?;
    let terminal = serde_json::json!({"schema": SCHEMA, "operation": intent.operation, "scene": intent.scene, "status":status});
    write_text_atomically_with_retry(&receipt, &terminal.to_string())?;
    fs::remove_file(&pending).map_err(error)?;
    sync_parent_dir(&pending).map_err(error)
}

fn abort_if_untouched(root: &Path, intent: &Intent) -> Result<bool, LoadError> {
    for (name, change) in &intent.files {
        let path = checked_path(root, Path::new(name))?;
        if !matches_before(change, read_optional(&path)?.as_deref()) {
            return Ok(false);
        }
    }
    finish(root, intent, "aborted")?;
    Ok(true)
}

fn recover_locked(root: &Path) -> Result<(), LoadError> {
    let pending = checked_path(root, Path::new(PENDING))?;
    if let Some(bytes) = read_optional(&pending)? {
        let intent = serde_json::from_slice(&bytes)
            .map_err(|e| error(format!("intenção ilegível, preservada: {e}")))?;
        apply(root, &intent)?;
    }
    Ok(())
}

pub(crate) fn recover(root: &Path) -> Result<(), LoadError> {
    // A read of an untouched project must not create any hidden files.
    match fs::symlink_metadata(root.join(PENDING)) {
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(error(e)),
        Ok(_) => {}
    }
    let _lock = lock(root)?;
    recover_locked(root)
}

pub(crate) fn begin(root: &Path) -> Result<File, LoadError> {
    let guard = lock(root)?;
    recover_locked(root)?;
    Ok(guard)
}

// The caller holds the project writer while checking the editor's baseline
// and preparing these changes. A persisted intent is queried on the next open.
pub(crate) fn commit(
    root: &Path,
    scene_path: &str,
    scene: &Scene,
    graphs: &BTreeMap<PathBuf, String>,
    _guard: &File,
) -> Result<(), LoadError> {
    validate_scene_path(scene_path)?;
    validate_scene(scene)?;
    // Every reference must either be part of this commit or readable already.
    // Otherwise an invalid scene could be published before its missing graph
    // is discovered by the post-save read.
    for reference in scene.entities.iter().filter_map(|e| {
        let logic = e.components.logic.as_ref()?;
        logic
            .graph_ref
            .as_ref()
            .filter(|_| logic.graph.as_deref().is_none_or(|g| g.trim().is_empty()))
    }) {
        let path = graph_write_path(root, reference)?;
        checked_path(root, path.strip_prefix(root).map_err(error)?)?;
        if !graphs.contains_key(&path) && read_optional(&path)?.is_none() {
            return Err(error(format!("grafo ausente: {reference}")));
        }
    }
    let mut files = BTreeMap::new();
    let mut changed = false;
    let scene_json = serde_json::to_string_pretty(scene).map_err(error)?;
    let scene_dest = root.join(scene_path);
    for (path, after) in graphs
        .iter()
        .chain(std::iter::once((&scene_dest, &scene_json)))
    {
        let relative = path.strip_prefix(root).map_err(error)?;
        let path = checked_path(root, relative)?;
        let before = read_optional(&path)?;
        changed |= before.as_deref() != Some(after.as_bytes());
        files.insert(
            relative
                .to_str()
                .ok_or_else(|| error("caminho não UTF-8"))?
                .replace(std::path::MAIN_SEPARATOR, "/"),
            Change {
                before: before.as_deref().map(sha256_hex),
                after: after.clone(),
            },
        );
    }
    if !changed {
        return Ok(());
    }
    let scene_path = scene_path.replace(std::path::MAIN_SEPARATOR, "/");
    let intent = Intent {
        schema: SCHEMA.into(),
        operation: operation_id(&scene_path, &files)?,
        scene: scene_path,
        files,
    };
    let pending = checked_path(root, Path::new(PENDING))?;
    write_text_atomically_with_retry(&pending, &serde_json::to_string(&intent).map_err(error)?)?;
    if let Err(failure) = apply(root, &intent) {
        // A rejected save with no effects must remain readable, including while
        // the destination is still read-only. Ambiguous/partial writes retain
        // their durable intent instead of being retried or discarded here.
        if let Err(abort_error) = abort_if_untouched(root, &intent) {
            return Err(error(format!(
                "{failure}. Intenção preservada ({abort_error})"
            )));
        }
        return Err(failure);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::project_mgr::{canonical_scene, create_project_skeleton, load_scene};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn project() -> (PathBuf, Scene) {
        let dir = std::env::temp_dir().join(format!(
            "rds-save-set-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        create_project_skeleton(&dir, "Transactional save", "megadrive").unwrap();
        let mut json = serde_json::to_value(canonical_scene("main", None)).unwrap();
        json["entities"] = serde_json::json!([
            {"entity_id":"a","transform":{"x":0,"y":0},"components":{"logic":{"graph_ref":"graphs/a.json"}}},
            {"entity_id":"b","transform":{"x":0,"y":0},"components":{"logic":{"graph_ref":"graphs/b.json"}}}
        ]);
        let scene: Scene = serde_json::from_value(json).unwrap();
        fs::create_dir_all(dir.join("graphs")).unwrap();
        fs::write(dir.join("graphs/a.json"), "{}").unwrap();
        fs::write(dir.join("graphs/b.json"), "{}").unwrap();
        (dir, scene)
    }

    fn pending(root: &Path, scene: &Scene) -> Intent {
        let scene_path = "scenes/main.json";
        let mut files = BTreeMap::new();
        for name in ["graphs/a.json", "graphs/b.json", scene_path] {
            let bytes = fs::read(root.join(name)).unwrap();
            let after = if name == scene_path {
                serde_json::to_string_pretty(scene).unwrap()
            } else {
                r#"{"nodes":[]}"#.into()
            };
            files.insert(
                name.into(),
                Change {
                    before: Some(sha256_hex(&bytes)),
                    after,
                },
            );
        }
        Intent {
            schema: SCHEMA.into(),
            operation: operation_id(scene_path, &files).unwrap(),
            scene: scene_path.into(),
            files,
        }
    }

    #[test]
    fn abort_requires_every_file_to_be_unchanged_and_preserves_an_uncertain_intent() {
        let (dir, scene) = project();
        let guard = begin(&dir).unwrap();
        let intent = pending(&dir, &scene);
        let path = dir.join(PENDING);
        fs::write(&path, serde_json::to_vec(&intent).unwrap()).unwrap();
        fs::write(
            dir.join("graphs/a.json"),
            &intent.files["graphs/a.json"].after,
        )
        .unwrap();
        assert!(!abort_if_untouched(&dir, &intent).unwrap());
        assert!(path.exists());
        fs::write(dir.join("graphs/a.json"), "{}").unwrap();
        fs::write(&path, b"unknown").unwrap();
        assert!(abort_if_untouched(&dir, &intent).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"unknown");
        fs::write(&path, serde_json::to_vec(&intent).unwrap()).unwrap();
        assert!(abort_if_untouched(&dir, &intent).unwrap());
        assert!(!path.exists());
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(dir.join(".rds/scene-save/last.json")).unwrap())
                .unwrap();
        assert_eq!(receipt["status"], "aborted");
        drop(guard);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failure_on_second_graph_or_invalid_scene_preserves_every_input() {
        let (dir, mut scene) = project();
        let guard = begin(&dir).unwrap();
        let original = fs::read(dir.join("scenes/main.json")).unwrap();
        let bad = dir.join("graphs/b.json");
        fs::remove_file(&bad).unwrap();
        fs::create_dir(&bad).unwrap();
        let graphs = BTreeMap::from([
            (dir.join("graphs/a.json"), r#"{"nodes":[]}"#.into()),
            (bad.clone(), "{}".into()),
        ]);
        assert!(commit(&dir, "scenes/main.json", &scene, &graphs, &guard).is_err());
        fs::remove_dir(&bad).unwrap();
        scene.scene_id.clear();
        assert!(commit(&dir, "scenes/main.json", &scene, &graphs, &guard).is_err());
        assert_eq!(fs::read(dir.join("graphs/a.json")).unwrap(), b"{}");
        assert_eq!(fs::read(dir.join("scenes/main.json")).unwrap(), original);
        assert!(!dir.join(PENDING).exists());
        drop(guard);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn reopen_finishes_partial_intent_and_refuses_external_or_unknown_state() {
        let (dir, scene) = project();
        let guard = begin(&dir).unwrap();
        assert!(begin(&dir).is_err());
        let mut intent = pending(&dir, &scene);
        let intent_path = dir.join(PENDING);
        write_text_atomically_with_retry(&intent_path, &serde_json::to_string(&intent).unwrap())
            .unwrap();
        fs::write(
            dir.join("graphs/a.json"),
            &intent.files["graphs/a.json"].after,
        )
        .unwrap();
        drop(guard);
        fs::write(dir.join("graphs/b.json"), "external edit").unwrap();
        let original = fs::read(dir.join(&intent.scene)).unwrap();
        assert!(load_scene(&dir, &intent.scene).is_err());
        assert_eq!(fs::read(dir.join(&intent.scene)).unwrap(), original);
        assert_eq!(
            fs::read(dir.join("graphs/b.json")).unwrap(),
            b"external edit"
        );
        fs::write(dir.join("graphs/b.json"), "{}").unwrap();
        intent.schema = "future".into();
        fs::write(&intent_path, serde_json::to_vec(&intent).unwrap()).unwrap();
        assert!(load_scene(&dir, &intent.scene).is_err());
        assert_eq!(fs::read(dir.join("graphs/b.json")).unwrap(), b"{}");
        intent.schema = SCHEMA.into();
        fs::write(&intent_path, serde_json::to_vec(&intent).unwrap()).unwrap();
        let recovered = load_scene(&dir, &intent.scene).unwrap();
        assert_eq!(recovered.entities.len(), 2);
        for (name, change) in &intent.files {
            assert_eq!(fs::read_to_string(dir.join(name)).unwrap(), change.after);
        }
        assert!(!intent_path.exists());
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(dir.join(".rds/scene-save/last.json")).unwrap())
                .unwrap();
        assert_eq!(receipt["operation"], intent.operation);
        load_scene(&dir, &intent.scene).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn second_graph_write_denial_retains_intent_until_reopen_can_finish() {
        use std::os::unix::fs::PermissionsExt;
        let (dir, mut scene) = project();
        scene.entities[1]
            .components
            .logic
            .as_mut()
            .unwrap()
            .graph_ref = Some("graphs/locked/b.json".into());
        let locked = dir.join("graphs/locked");
        fs::create_dir(&locked).unwrap();
        fs::write(locked.join("b.json"), "{}").unwrap();
        let guard = begin(&dir).unwrap();
        let original_scene = fs::read(dir.join("scenes/main.json")).unwrap();
        let graph_json = r#"{"nodes":[]}"#;
        let graphs = BTreeMap::from([
            (dir.join("graphs/a.json"), graph_json.into()),
            (locked.join("b.json"), graph_json.into()),
        ]);
        let permissions = fs::metadata(&locked).unwrap().permissions();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o555)).unwrap();
        let result = commit(&dir, "scenes/main.json", &scene, &graphs, &guard);
        // Restore this test-owned directory before assertions, even on failure.
        fs::set_permissions(&locked, permissions).unwrap();
        assert!(
            result.is_err(),
            "the test must run without permission bypass"
        );
        assert_eq!(
            fs::read_to_string(dir.join("graphs/a.json")).unwrap(),
            graph_json
        );
        assert_eq!(fs::read_to_string(locked.join("b.json")).unwrap(), "{}");
        assert_eq!(
            fs::read(dir.join("scenes/main.json")).unwrap(),
            original_scene
        );
        assert!(dir.join(PENDING).exists());
        drop(guard);
        let recovered = load_scene(&dir, "scenes/main.json").unwrap();
        assert_eq!(recovered.entities.len(), 2);
        assert_eq!(
            fs::read_to_string(locked.join("b.json")).unwrap(),
            graph_json
        );
        assert!(!dir.join(PENDING).exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
