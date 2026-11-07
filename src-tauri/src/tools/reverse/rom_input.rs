//! Bounded ZIP/7z input adapter. Game semantics remain in loader/inspection.
//! Archives are never unpacked onto a filesystem using member paths.
use super::{
    decomp::{
        extract::{canonical_dir_under, write_file_immutable},
        rom_library::decomp_work_dir,
    },
    loader::rex_identify_bytes,
};
use crate::core::rom_mastering::sha256_hex;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, LazyLock, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

const ROM_LIMIT: usize = 32 * 1024 * 1024;
const CONTAINER_LIMIT: usize = 128 * 1024 * 1024;
const LIST_LIMIT: usize = 1024 * 1024;
const MAX_ENTRIES: usize = 2048;
const TOTAL_LIMIT: u64 = 256 * 1024 * 1024;
static JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub struct InputJob {
    id: String,
    cancelled: Arc<AtomicBool>,
}
impl Drop for InputJob {
    fn drop(&mut self) {
        if let Ok(mut jobs) = JOBS.lock() {
            jobs.remove(&self.id);
        }
    }
}
impl InputJob {
    pub fn begin(id: String) -> Result<Self, String> {
        if id.is_empty()
            || id.len() > 80
            || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
        {
            return Err("Identificador de preparação inválido.".into());
        }
        let mut jobs = JOBS
            .lock()
            .map_err(|_| "Registro de preparação indisponível.")?;
        if jobs.len() >= 4 || jobs.contains_key(&id) {
            return Err("Outra preparação está em andamento. Cancele ou aguarde.".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(id.clone(), cancelled.clone());
        Ok(Self { id, cancelled })
    }
    fn check(&self) -> Result<(), String> {
        if self.cancelled.load(Ordering::Relaxed) {
            Err("Preparação cancelada. Escolha outro arquivo ou tente novamente.".into())
        } else {
            Ok(())
        }
    }
}
pub fn cancel(id: &str) -> Result<(), String> {
    if let Some(flag) = JOBS
        .lock()
        .map_err(|_| "Registro de preparação indisponível.")?
        .get(id)
    {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomInputMember {
    pub name: String,
    pub size: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomInputProbe {
    pub input_id: String,
    pub source_path: String,
    pub source_sha256: String,
    pub kind: String,
    pub members: Vec<RomInputMember>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomInputResolved {
    pub input: RomInputProbe,
    pub member: String,
    pub member_sha256: String,
    pub normalized_sha256: String,
    pub rom_path: String,
    pub receipt_path: String,
}
fn input_dir(work: &Path, hash: &str) -> Result<PathBuf, String> {
    let dir = canonical_dir_under(work, &["extract", hash, "inputs"])?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Não foi possível proteger a cópia privada: {e}"))?;
    }
    Ok(dir)
}
fn read_bounded(path: &Path, limit: usize, job: &InputJob) -> Result<Vec<u8>, String> {
    job.check()?;
    let file = File::open(path).map_err(|e| {
        format!("Não foi possível ler o arquivo: {e}. Selecione um arquivo local acessível.")
    })?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("Selecione um arquivo regular.".into());
    }
    let mut bytes = Vec::new();
    file.take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    job.check()?;
    if bytes.len() > limit {
        return Err(format!(
            "Arquivo excede o limite de {} MiB. Escolha uma entrada menor.",
            limit / 1024 / 1024
        ));
    }
    Ok(bytes)
}
fn safe_member(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with(['/', '\\', '@'])
        && !name.chars().any(|c| c.is_control() || c == ':')
        && name
            .replace('\\', "/")
            .split('/')
            .all(|p| !p.is_empty() && p != "." && p != "..")
}
fn rom_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|s| {
            ["md", "gen", "bin", "smd"]
                .iter()
                .any(|ext| s.eq_ignore_ascii_case(ext))
        })
}
fn parse_listing(text: &str) -> Result<Vec<RomInputMember>, String> {
    let mut all_names = HashSet::new();
    let mut members = Vec::new();
    let mut total = 0u64;
    for record in text
        .replace("\r\n", "\n")
        .split("\n\n")
        .filter(|s| !s.trim().is_empty())
    {
        if all_names.len() >= MAX_ENTRIES {
            return Err("Compactado excede 2048 entradas. Prepare um arquivo menor.".into());
        }
        let mut fields = BTreeMap::new();
        for line in record.lines() {
            let (key, value) = line.split_once(" = ").ok_or(
                "Lista de membros ambígua ou inválida. Recrie o compactado com nomes simples.",
            )?;
            if fields.insert(key, value).is_some() {
                return Err("Lista de membros ambígua: campo duplicado.".into());
            }
        }
        let name = *fields.get("Path").ok_or("Membro sem nome.")?;
        // Folder names may end in slash, but never escape the archive namespace.
        if !safe_member(name.trim_end_matches(['/', '\\']))
            || !all_names.insert(name.replace('\\', "/"))
        {
            return Err("Caminho inseguro ou membro duplicado no compactado. Recrie-o sem caminhos absolutos, .. ou nomes duplicados.".into());
        }
        if fields.get("Encrypted") == Some(&"+") {
            return Err("Compactado protegido por senha. Descompacte-o localmente pelo seu gerenciador e selecione a ROM.".into());
        }
        if fields.contains_key("Symbolic Link")
            || fields.contains_key("Hard Link")
            || fields
                .get("Attributes")
                .is_some_and(|s| s.split_whitespace().any(|a| a.starts_with('l')))
        {
            return Err("Links não são aceitos no compactado. Selecione a ROM regular.".into());
        }
        let size = fields
            .get("Size")
            .ok_or("Membro sem tamanho verificável.")?
            .parse::<u64>()
            .map_err(|_| "Tamanho de membro inválido.")?;
        total = total.checked_add(size).ok_or("Tamanho total inválido.")?;
        if total > TOTAL_LIMIT {
            return Err(
                "Compactado excede 256 MiB descomprimidos. Prepare um arquivo menor.".into(),
            );
        }
        let folder = fields.get("Folder") == Some(&"+")
            || fields.get("Attributes").is_some_and(|s| s.starts_with('D'));
        if !folder && rom_extension(name) {
            if size > ROM_LIMIT as u64 {
                return Err("ROM no compactado excede 32 MiB. Selecione uma ROM menor.".into());
            }
            members.push(RomInputMember {
                name: name.to_string(),
                size,
            });
        }
    }
    if members.is_empty() {
        return Err(
            "Nenhuma ROM .md, .bin, .gen ou .smd encontrada. Escolha outro arquivo.".into(),
        );
    }
    Ok(members)
}

// Bounded readers prevent a forged directory or decompression bomb from allocating
// unbounded memory. A deadline/cancellation always kills and reaps our own child.
fn seven_zip(
    path: &Path,
    member: Option<&str>,
    limit: usize,
    job: &InputJob,
) -> Result<Vec<u8>, String> {
    job.check()?;
    let mut cmd = Command::new("7z");
    cmd.args(if member.is_some() {
        vec!["x", "-so", "-spd", "-ssc"]
    } else {
        vec!["l", "-slt", "-ba", "-sccUTF-8"]
    });
    cmd.args(["-mmt=1", "-smemx64m", "-pRDS-no-password", "--"])
        .arg(path);
    if let Some(name) = member {
        cmd.arg(name);
    }
    let mut child = cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        .map_err(|e| format!("7-Zip (7z) não está disponível: {e}. Instale-o pelo gerenciador oficial do sistema ou selecione a ROM já descompactada."))?;
    let out = child.stdout.take().ok_or("Saída do 7-Zip indisponível.")?;
    let err = child
        .stderr
        .take()
        .ok_or("Diagnóstico do 7-Zip indisponível.")?;
    let overflow = Arc::new(AtomicBool::new(false));
    let flag = overflow.clone();
    let stdout = thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = out.take((limit + 1) as u64).read_to_end(&mut bytes);
        if bytes.len() > limit {
            flag.store(true, Ordering::Relaxed);
        }
        (result, bytes)
    });
    let flag = overflow.clone();
    let stderr = thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = err.take(8193).read_to_end(&mut bytes);
        if bytes.len() > 8192 {
            flag.store(true, Ordering::Relaxed);
        }
        (result, bytes)
    });
    let began = Instant::now();
    let status = loop {
        if job.check().is_err()
            || overflow.load(Ordering::Relaxed)
            || began.elapsed() > Duration::from_secs(60)
        {
            let _ = child.kill();
            let _ = child.wait();
            break None;
        }
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };
    let (out_result, bytes) = stdout
        .join()
        .map_err(|_| "Falha na leitura limitada do 7-Zip.")?;
    let (err_result, errors) = stderr
        .join()
        .map_err(|_| "Falha no diagnóstico do 7-Zip.")?;
    job.check()?;
    if overflow.load(Ordering::Relaxed) || status.is_none() {
        return Err(
            "Preparação excedeu o limite de tamanho ou 60 segundos. Selecione a ROM descompactada."
                .into(),
        );
    }
    out_result.map_err(|e| e.to_string())?;
    err_result.map_err(|e| e.to_string())?;
    if !status.is_some_and(|s| s.success()) {
        let detail = String::from_utf8_lossy(&errors);
        return Err(format!("Compactado inválido, protegido por senha ou não suportado. Descompacte-o localmente e selecione a ROM. {}", detail.chars().take(500).collect::<String>()));
    }
    Ok(bytes)
}

pub fn probe(work: &Path, path: &str, job: &InputJob) -> Result<RomInputProbe, String> {
    let bytes = read_bounded(Path::new(path), CONTAINER_LIMIT, job)?;
    let kind = if bytes.starts_with(b"7z\xbc\xaf\x27\x1c") {
        "7z"
    } else if bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06") {
        "zip"
    } else {
        "rom"
    };
    if kind == "rom" {
        if bytes.len() > ROM_LIMIT {
            return Err("ROM excede 32 MiB.".into());
        }
        rex_identify_bytes(&bytes)?;
    }
    let hash = sha256_hex(&bytes);
    let dir = input_dir(work, &hash)?;
    let snapshot = dir.join(format!("source.{kind}"));
    write_file_immutable(&snapshot, &bytes, &hash)?;
    let members = if kind == "rom" {
        vec![RomInputMember {
            name: Path::new(path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("rom.bin")
                .to_string(),
            size: bytes.len() as u64,
        }]
    } else {
        let listing = seven_zip(&snapshot, None, LIST_LIMIT, job)?;
        parse_listing(std::str::from_utf8(&listing).map_err(|_| {
            "Nomes de membros não são UTF-8. Recrie o compactado com nomes simples."
        })?)?
    };
    job.check()?;
    let mut probe = RomInputProbe {
        input_id: String::new(),
        source_path: path.into(),
        source_sha256: hash,
        kind: kind.into(),
        members,
    };
    let manifest = serde_json::to_vec(&probe).map_err(|e| e.to_string())?;
    probe.input_id = sha256_hex(&manifest);
    let manifests = input_dir(work, &probe.input_id)?;
    write_file_immutable(&manifests.join("input.json"), &manifest, &probe.input_id)?;
    Ok(probe)
}
pub fn resolve(
    work: &Path,
    input_id: &str,
    member: &str,
    job: &InputJob,
) -> Result<RomInputResolved, String> {
    let manifest = read_bounded(
        &input_dir(work, input_id)?.join("input.json"),
        LIST_LIMIT,
        job,
    )?;
    if sha256_hex(&manifest) != input_id {
        return Err("Identidade da preparação mudou. Selecione novamente o arquivo.".into());
    }
    let mut input: RomInputProbe = serde_json::from_slice(&manifest).map_err(|e| e.to_string())?;
    input.input_id = input_id.into();
    let selected = input
        .members
        .iter()
        .find(|m| m.name == member)
        .ok_or("Escolha explicitamente um membro da lista.")?;
    let snapshot = input_dir(work, &input.source_sha256)?.join(format!(
        "source.{}",
        match input.kind.as_str() {
            "zip" => "zip",
            "7z" => "7z",
            "rom" => "rom",
            _ => return Err("Formato de entrada inválido.".into()),
        }
    ));
    let source = read_bounded(&snapshot, CONTAINER_LIMIT, job)?;
    if sha256_hex(&source) != input.source_sha256 {
        return Err(
            "Arquivo de origem divergiu da identidade registrada. Selecione-o novamente.".into(),
        );
    }
    let bytes = if input.kind == "rom" {
        source
    } else {
        if !safe_member(member) {
            return Err("Nome de membro inseguro.".into());
        }
        seven_zip(&snapshot, Some(member), ROM_LIMIT, job)?
    };
    if bytes.len() as u64 != selected.size {
        return Err("Tamanho extraído diverge do membro selecionado.".into());
    }
    let identity = rex_identify_bytes(&bytes)?;
    job.check()?;
    let member_sha256 = sha256_hex(&bytes);
    let dir = input_dir(work, &member_sha256)?;
    let rom = dir.join("rom.bin");
    write_file_immutable(&rom, &bytes, &member_sha256)?;
    let receipt_path =
        input_dir(work, input_id)?.join(format!("{}.json", sha256_hex(member.as_bytes())));
    let resolved = RomInputResolved {
        input,
        member: member.into(),
        member_sha256,
        normalized_sha256: identity.normalized_sha256,
        rom_path: rom.to_string_lossy().into(),
        receipt_path: receipt_path.to_string_lossy().into(),
    };
    let receipt = serde_json::to_vec(&resolved).map_err(|e| e.to_string())?;
    write_file_immutable(&receipt_path, &receipt, &sha256_hex(&receipt))?;
    Ok(resolved)
}
pub fn work_dir() -> PathBuf {
    decomp_work_dir()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn listing_rejects_unsafe_duplicate_encrypted_and_bombs() {
        for text in [
            "Path = ../game.md\nSize = 512",
            "Path = /game.md\nSize = 512",
            "Path = @game.md\nSize = 512",
            "Path = game.md\nSize = 512\nEncrypted = +",
            "Path = game.md\nSize = 512\nSymbolic Link = other",
            "Path = game.md\nSize = 33554433",
            "Path = a.txt\nSize = 268435457",
            "Path = game.md\nSize = 512\nPath = other.md",
            "Path = game.md\nSize = 512\n\nPath = game.md\nSize = 512",
        ] {
            assert!(parse_listing(text).is_err(), "{text}");
        }
        assert_eq!(
            parse_listing("Path = a.md\nSize = 512\n\nPath = other/b.SMD\nSize = 16384")
                .unwrap()
                .len(),
            2
        );
    }
    #[test]
    fn cancellation_prevents_read_and_writes() {
        let job = InputJob::begin("cancel-test".into()).unwrap();
        cancel("cancel-test").unwrap();
        assert!(probe(Path::new("unused"), "missing.md", &job)
            .unwrap_err()
            .contains("cancelada"));
    }
    #[test]
    #[ignore = "requires optional system 7z; run explicitly on archive QA host"]
    fn real_zip_and_7z_preserve_identity_and_require_member() {
        let root = std::env::temp_dir().join(format!("rds-input-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let mut rom = vec![0u8; 0x8000];
        rom[0x100..0x110].copy_from_slice(b"SEGA GENESIS    ");
        fs::write(root.join("a.md"), &rom).unwrap();
        fs::write(root.join("b.bin"), &rom).unwrap();
        let job = InputJob::begin("archive-test".into()).unwrap();
        for kind in ["zip", "7z"] {
            let archive = root.join(format!("two.{kind}"));
            let status = Command::new("7z")
                .current_dir(&root)
                .args(["a", "-y"])
                .arg(&archive)
                .args(["a.md", "b.bin"])
                .stdout(Stdio::null())
                .status()
                .expect("7z is the optional archive input dependency on this QA host");
            assert!(status.success());
            let p = probe(&root.join("work"), archive.to_str().unwrap(), &job).unwrap();
            assert_eq!(p.members.len(), 2);
            assert!(resolve(&root.join("work"), &p.input_id, "missing.md", &job).is_err());
            let r = resolve(&root.join("work"), &p.input_id, "b.bin", &job).unwrap();
            assert_eq!(r.member_sha256, sha256_hex(&rom));
            assert_eq!(
                r.input.source_sha256,
                sha256_hex(&fs::read(&archive).unwrap())
            );
            assert_eq!(fs::read(r.rom_path).unwrap(), rom);
            fs::write(&archive, b"changed after preparation").unwrap();
            assert!(
                resolve(&root.join("work"), &p.input_id, "a.md", &job).is_ok(),
                "uses immutable snapshot, never changed source"
            );
        }
        let encrypted = root.join("encrypted.zip");
        assert!(Command::new("7z")
            .current_dir(&root)
            .args(["a", "-y", "-pfixture-only"])
            .arg(&encrypted)
            .arg("a.md")
            .stdout(Stdio::null())
            .status()
            .unwrap()
            .success());
        assert!(probe(&root.join("work"), encrypted.to_str().unwrap(), &job)
            .unwrap_err()
            .contains("senha"));
        let corrupt = root.join("broken.zip");
        fs::write(&corrupt, b"PK\x03\x04invalid").unwrap();
        assert!(probe(&root.join("work"), corrupt.to_str().unwrap(), &job).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
