use std::fs;
use std::path::Path;

/// Perfis REX embutidos: TODOS os `*.json` de `data/rex_profiles/specs/` (sem subpastas), em ordem de nome.
/// O binário nunca nomeia um perfil: acrescentar um arquivo ali o embute na próxima compilação.
fn embed_rex_profiles() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/rex_profiles/specs");
    println!("cargo:rerun-if-changed={}", dir.display());
    let mut files: Vec<_> = fs::read_dir(&dir)
        .map(|rd| {
            rd.filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().is_some_and(|x| x == "json"))
                .collect()
        })
        .unwrap_or_default();
    files.sort();
    let mut out = String::from("pub const BUILTIN_PROFILES: &[(&str, &str)] = &[\n");
    for f in &files {
        println!("cargo:rerun-if-changed={}", f.display());
        let name = f.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        out.push_str(&format!(
            "    ({name:?}, include_str!({:?})),\n",
            f.canonicalize().unwrap_or_else(|_| f.clone())
        ));
    }
    out.push_str("];\n");
    let dest =
        Path::new(&std::env::var("OUT_DIR").expect("OUT_DIR")).join("rex_builtin_profiles.rs");
    fs::write(dest, out).expect("gravar a lista de perfis embutidos");
}

/// Registros curados de evidência histórica: todos os `*.json` de `data/rex_profiles/evidence/`.
fn embed_curated_evidence() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/rex_profiles/evidence");
    println!("cargo:rerun-if-changed={}", dir.display());
    let mut files: Vec<_> = fs::read_dir(&dir)
        .map(|rd| {
            rd.filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().is_some_and(|x| x == "json"))
                .collect()
        })
        .unwrap_or_default();
    files.sort();
    let mut out = String::from("pub const CURATED_EVIDENCE: &[(&str, &str)] = &[\n");
    for f in &files {
        println!("cargo:rerun-if-changed={}", f.display());
        let name = f.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        out.push_str(&format!(
            "    ({name:?}, include_str!({:?})),\n",
            f.canonicalize().unwrap_or_else(|_| f.clone())
        ));
    }
    out.push_str("];\n");
    let dest =
        Path::new(&std::env::var("OUT_DIR").expect("OUT_DIR")).join("rex_curated_evidence.rs");
    fs::write(dest, out).expect("gravar a lista de evidencia curada");
}

fn main() {
    embed_rex_profiles();
    embed_curated_evidence();
    tauri_build::build();
}
