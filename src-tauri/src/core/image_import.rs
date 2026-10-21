//! Importar imagem de cenario para o projeto (Experimental): copia o arquivo escolhido pelo
//! usuario para `assets/tilesets/`, sem alterar os bytes; a cena instancia o tilemap pelo
//! caminho canonico (`createTilemapEntityFromAsset`). Valida o que o destino exige (dimensoes
//! em tiles de 8 px) e informa as cores; reduzir cores nunca acontece aqui.

use std::fs;
use std::path::Path;

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ImportedImage {
    pub relative_path: String,
    pub width: u32,
    pub height: u32,
    pub tiles_wide: u32,
    pub tiles_high: u32,
    /// Cores opacas distintas no arquivo.
    pub colors: usize,
    pub sha256: String,
    pub reused_existing: bool,
    pub warnings: Vec<String>,
}

fn slug(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect();
    let s = s.trim_matches('_').to_string();
    if s.is_empty() {
        "cenario".to_string()
    } else {
        s
    }
}

pub fn import_project_image(project_dir: &Path, source: &Path) -> Result<ImportedImage, String> {
    if !project_dir.join("project.rds").is_file() {
        return Err(format!(
            "'{}' nao e um projeto RetroDev.",
            project_dir.display()
        ));
    }
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !["png", "bmp"].contains(&ext.as_str()) {
        return Err("Use uma imagem PNG ou BMP.".to_string());
    }
    let bytes = fs::read(source)
        .map_err(|e| format!("Nao foi possivel ler '{}': {e}", source.display()))?;
    let image = image::load_from_memory(&bytes).map_err(|e| format!("Imagem invalida: {e}"))?;
    let (width, height) = (image.width(), image.height());
    if width == 0 || height == 0 || width % 8 != 0 || height % 8 != 0 {
        return Err(format!(
            "A imagem tem {width}x{height} px; o cenario precisa de largura e altura multiplas de 8 (tiles)."
        ));
    }
    if width > 1024 || height > 1024 {
        return Err(format!(
            "A imagem tem {width}x{height} px; o plano do destino aceita ate 1024x1024 px."
        ));
    }
    let rgba = image.to_rgba8();
    let mut distinct = std::collections::BTreeSet::new();
    for p in rgba.pixels() {
        if p[3] != 0 {
            distinct.insert([p[0], p[1], p[2]]);
        }
    }
    let mut warnings = Vec::new();
    if distinct.len() > 15 {
        warnings.push(format!(
            "{} cores: o destino guarda 15 + transparencia por paleta; o plano de paletas mostra os pixels que mudariam.",
            distinct.len()
        ));
    }
    let sha = crate::core::rom_mastering::sha256_hex(&bytes);
    let dir = project_dir.join("assets").join("tilesets");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Nao foi possivel criar '{}': {e}", dir.display()))?;
    let stem = slug(
        &source
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
    );
    let mut n = 0;
    let (relative_path, reused) = loop {
        let name = if n == 0 {
            format!("{stem}.{ext}")
        } else {
            format!("{stem}_{n}.{ext}")
        };
        let path = dir.join(&name);
        let rel = format!("assets/tilesets/{name}");
        if !path.exists() {
            fs::write(&path, &bytes)
                .map_err(|e| format!("Nao foi possivel gravar '{}': {e}", path.display()))?;
            break (rel, false);
        }
        if fs::read(&path)
            .map(|b| crate::core::rom_mastering::sha256_hex(&b) == sha)
            .unwrap_or(false)
        {
            break (rel, true);
        }
        n += 1;
    };
    Ok(ImportedImage {
        relative_path,
        width,
        height,
        tiles_wide: width / 8,
        tiles_high: height / 8,
        colors: distinct.len(),
        sha256: sha,
        reused_existing: reused,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("rds-image-import-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("project.rds"), "{}").unwrap();
        dir
    }

    fn png(path: &Path, w: u32, h: u32) {
        let img =
            image::RgbaImage::from_fn(w, h, |x, _| image::Rgba([(x % 3) as u8 * 80, 40, 200, 255]));
        img.save(path).unwrap();
    }

    #[test]
    fn copies_bytes_into_tilesets_and_reuses_identical_file() {
        let dir = project("copy");
        let src = dir.join("fundo largo.png");
        png(&src, 640, 224);
        let a = import_project_image(&dir, &src).unwrap();
        assert_eq!(a.relative_path, "assets/tilesets/fundo_largo.png");
        assert_eq!((a.tiles_wide, a.tiles_high, a.colors), (80, 28, 3));
        assert_eq!(
            fs::read(dir.join(&a.relative_path)).unwrap(),
            fs::read(&src).unwrap()
        );
        let b = import_project_image(&dir, &src).unwrap();
        assert!(b.reused_existing);
        assert_eq!(b.relative_path, a.relative_path);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn refuses_sizes_outside_tiles_and_non_images() {
        let dir = project("refuse");
        let src = dir.join("torto.png");
        png(&src, 30, 16);
        assert!(import_project_image(&dir, &src)
            .unwrap_err()
            .contains("multiplas de 8"));
        let txt = dir.join("x.txt");
        fs::write(&txt, "x").unwrap();
        assert!(import_project_image(&dir, &txt).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
