use std::path::Path;

use serde::Serialize;

use crate::hardware::{constraint_engine, HwStatus};
use crate::ugdm::entities::Scene;

use super::project_mgr::{load_project, load_scene, resolve_prefabs, validate_scene};

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
pub struct DraftValidationResult {
    pub ok: bool,
    pub error: String,
    pub hw_status: HwStatus,
}

impl DraftValidationResult {
    pub fn success(hw_status: HwStatus) -> Self {
        Self {
            ok: true,
            error: String::new(),
            hw_status,
        }
    }

    pub fn failure(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            error: message.into(),
            hw_status: HwStatus::default(),
        }
    }
}

/// Projeto C nativo (overlay SGDK): a ROM vem do C original, entao o orcamento estimado a
/// partir da cena do Studio nao descreve o jogo. Devolve so os limites do Mega Drive; o uso
/// real de VRAM e medido no core em execucao (`emulator_vram_usage`).
fn native_c_hw_status(project: &crate::ugdm::entities::Project) -> Option<HwStatus> {
    let meta = project.template_metadata.as_ref()?;
    if meta.template_id != "legacy_sgdk_overlay" || project.target != "megadrive" {
        return None;
    }
    Some(HwStatus {
        analysis_mode: "native_c".to_string(),
        vram_limit: 64 * 1024,
        sprite_limit: 80,
        scanline_sprite_limit: 20,
        dma_limit: 7 * 1024,
        palette_banks_limit: 4,
        bg_layers_limit: 2,
        ..HwStatus::default()
    })
}

pub fn validate_scene_draft(project_dir: &Path, scene_json: &str) -> DraftValidationResult {
    let project = match load_project(project_dir) {
        Ok(project) => project,
        Err(error) => return DraftValidationResult::failure(error.to_string()),
    };

    let scene = match serde_json::from_str::<Scene>(scene_json) {
        Ok(scene) => scene,
        Err(error) => {
            return DraftValidationResult::failure(format!(
                "JSON de cena invalido para preview: {}",
                error
            ));
        }
    };

    if let Some(status) = native_c_hw_status(&project) {
        return DraftValidationResult::success(status);
    }

    if let Err(error) = validate_scene(&scene) {
        return DraftValidationResult::failure(error.to_string());
    }

    let resolved_scene = match resolve_prefabs(project_dir, &scene) {
        Ok(scene) => scene,
        Err(error) => return DraftValidationResult::failure(error.to_string()),
    };

    let source_kind = project
        .template_metadata
        .as_ref()
        .map(|meta| meta.source_kind.as_str());

    match constraint_engine::hw_status_for_target_with_source_kind(
        &project.target,
        &resolved_scene,
        source_kind,
    ) {
        Ok(hw_status) => DraftValidationResult::success(hw_status),
        Err(error) => DraftValidationResult::failure(error),
    }
}

pub fn authoritative_hw_status(project_dir: &Path) -> Result<HwStatus, String> {
    let project = load_project(project_dir).map_err(|error| error.to_string())?;
    if let Some(status) = native_c_hw_status(&project) {
        return Ok(status);
    }
    let scene = load_scene(project_dir, &project.entry_scene).map_err(|error| error.to_string())?;
    let resolved_scene = resolve_prefabs(project_dir, &scene).map_err(|error| error.to_string())?;

    let source_kind = project
        .template_metadata
        .as_ref()
        .map(|meta| meta.source_kind.as_str());

    constraint_engine::hw_status_for_target_with_source_kind(
        &project.target,
        &resolved_scene,
        source_kind,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn fixture_dir(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("projects")
            .join(name)
    }

    #[test]
    fn validates_canonical_megadrive_fixture_draft() {
        let project_dir = fixture_dir("megadrive_dummy");
        let scene_json = fs::read_to_string(project_dir.join("scenes").join("main.json"))
            .expect("read fixture scene");

        let result = validate_scene_draft(&project_dir, &scene_json);

        assert!(result.ok, "unexpected error: {}", result.error);
        assert!(result.hw_status.errors.is_empty());
    }

    #[test]
    fn rejects_invalid_scene_json() {
        let project_dir = fixture_dir("megadrive_dummy");
        let result = validate_scene_draft(&project_dir, "{ invalid json");

        assert!(!result.ok);
        assert!(result.error.contains("JSON de cena invalido"));
    }

    #[test]
    fn rejects_semantically_invalid_scene() {
        let project_dir = fixture_dir("megadrive_dummy");
        let invalid_scene = r#"{
          "scene_id": "main",
          "entities": [
            { "entity_id": "dup", "transform": { "x": 0, "y": 0 }, "components": {} },
            { "entity_id": "dup", "transform": { "x": 8, "y": 8 }, "components": {} }
          ],
          "background_layers": [],
          "palettes": []
        }"#;

        let result = validate_scene_draft(&project_dir, invalid_scene);

        assert!(!result.ok);
        assert!(result.error.contains("duplicado"));
    }

    #[test]
    fn live_preview_matches_authoritative_megadrive_hw_status() {
        let project_dir = fixture_dir("megadrive_dummy");
        let scene_json = fs::read_to_string(project_dir.join("scenes").join("main.json"))
            .expect("read fixture scene");

        let preview = validate_scene_draft(&project_dir, &scene_json);
        let authoritative = authoritative_hw_status(&project_dir).expect("authoritative status");

        assert!(preview.ok, "unexpected preview error: {}", preview.error);
        assert_eq!(preview.hw_status, authoritative);
    }

    #[test]
    fn live_preview_matches_authoritative_snes_hw_status() {
        let project_dir = fixture_dir("snes_dummy");
        let scene_json = fs::read_to_string(project_dir.join("scenes").join("main.json"))
            .expect("read fixture scene");

        let preview = validate_scene_draft(&project_dir, &scene_json);
        let authoritative = authoritative_hw_status(&project_dir).expect("authoritative status");

        assert!(preview.ok, "unexpected preview error: {}", preview.error);
        assert_eq!(preview.hw_status, authoritative);
    }

    #[test]
    fn native_c_overlay_reports_hardware_limits_without_scene_estimate() {
        let dir = std::env::temp_dir().join(format!("rds_native_c_hw_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let host = dir.join("game");
        fs::create_dir_all(host.join("src")).unwrap();
        fs::write(host.join("src/main.c"), "int main(void){return 0;}\n").unwrap();
        fs::write(host.join("Makefile"), "all:\n").unwrap();
        let overlay =
            crate::core::project_mgr::import_legacy_sgdk_project(&host, Some("G")).unwrap();
        let status = authoritative_hw_status(&overlay).unwrap();
        assert_eq!(status.analysis_mode, "native_c");
        assert_eq!(status.vram_limit, 65536);
        assert_eq!(status.vram_used, 0);
        assert!(status.warnings.is_empty() && status.errors.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
