//! Publicação conjunta e segura de dois artefatos (cópia da ROM + IPS): ou os dois, ou nada.
//!
//! Escreve temporários exclusivos (`create_new`), confere o conteúdo lido de volta, publica cada um com
//! `hard_link` (falha se o destino existe, nunca sobrescreve) e, se o segundo destino falhar, desfaz SÓ o
//! primeiro link, que é nosso. Nunca remove arquivo preexistente ou de outra sessão. Extraído de
//! do primeiro adaptador IPC na F1 (`docs/14_REX_ARQUITETURA_UNIVERSAL.md`) sem mudar comportamento nem mensagens;
//! sem conhecimento de jogo ou de perfil.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Erro da publicação: código estável + mensagem. O adaptador de cada superfície o converte para o seu tipo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublishError {
    pub code: String,
    pub message: String,
}

impl PublishError {
    pub fn new(code: &str, message: impl Into<String>) -> PublishError {
        PublishError {
            code: code.to_string(),
            message: message.into(),
        }
    }
}

pub(crate) enum WriteFail {
    /// O arquivo NÃO foi criado por nós (já existia ou não deu para abrir).
    NotCreated(std::io::Error),
    /// Foi criado por nós e a escrita falhou: pode e deve ser removido.
    Created(std::io::Error),
}

/// Superfície de sistema de arquivos usada pela publicação; os testes injetam falhas por aqui.
pub(crate) trait Fs {
    fn write_new(&self, p: &Path, bytes: &[u8]) -> Result<(), WriteFail>;
    fn hard_link(&self, from: &Path, to: &Path) -> std::io::Result<()>;
    fn remove(&self, p: &Path) -> std::io::Result<()>;
    fn same_file(&self, a: &Path, b: &Path) -> bool;
    fn exists(&self, p: &Path) -> bool;
    fn read(&self, p: &Path) -> std::io::Result<Vec<u8>>;
}

pub(crate) struct RealFs;

impl Fs for RealFs {
    fn write_new(&self, p: &Path, bytes: &[u8]) -> Result<(), WriteFail> {
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(p)
            .map_err(WriteFail::NotCreated)?;
        f.write_all(bytes).map_err(WriteFail::Created)?;
        f.sync_all().map_err(WriteFail::Created)
    }
    fn hard_link(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        fs::hard_link(from, to)
    }
    fn remove(&self, p: &Path) -> std::io::Result<()> {
        fs::remove_file(p)
    }
    fn same_file(&self, a: &Path, b: &Path) -> bool {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            match (fs::metadata(a), fs::metadata(b)) {
                (Ok(x), Ok(y)) => x.dev() == y.dev() && x.ino() == y.ino(),
                _ => false,
            }
        }
        #[cfg(not(unix))]
        {
            matches!((fs::read(a), fs::read(b)), (Ok(x), Ok(y)) if x == y)
        }
    }
    fn exists(&self, p: &Path) -> bool {
        fs::symlink_metadata(p).is_ok()
    }
    fn read(&self, p: &Path) -> std::io::Result<Vec<u8>> {
        fs::read(p)
    }
}

/// Verificação do par lido de volta (cópia, IPS) antes de publicar.
pub(crate) type VerifyPair<'a> = &'a dyn Fn(&[u8], &[u8]) -> Result<(), PublishError>;

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// Publica cópia + IPS JUNTOS ou nada. Escreve temporários exclusivos (`create_new`), verifica o
/// conteúdo lido de volta, publica cada um com `hard_link` (falha se o destino já existe, nunca
/// sobrescreve) e, se o segundo destino falhar, desfaz SÓ o primeiro link, que é nosso (confere
/// que é o mesmo arquivo). Nunca remove arquivo preexistente ou de outra sessão.
pub(crate) fn publish_pair(
    fs: &dyn Fs,
    out_dir: &Path,
    base: &str,
    bin: &[u8],
    ips: &[u8],
    verify: VerifyPair<'_>,
) -> Result<(PathBuf, PathBuf, Vec<String>), PublishError> {
    let final_bin = out_dir.join(format!("{base}.bin"));
    let final_ips = out_dir.join(format!("{base}.ips"));
    for p in [&final_bin, &final_ips] {
        if fs.exists(p) {
            return Err(PublishError::new(
                "output_exists_or_unwritable",
                format!(
                    "{} já existe (nunca sobrescrevo); nada foi gravado",
                    p.display()
                ),
            ));
        }
    }
    let seq = TMP_SEQ.fetch_add(1, Ordering::SeqCst);
    let pid = std::process::id();
    let tmp_bin = out_dir.join(format!(".{base}.{pid}.{seq}.bin.tmp"));
    let tmp_ips = out_dir.join(format!(".{base}.{pid}.{seq}.ips.tmp"));
    let mut ours: Vec<&Path> = Vec::new();
    let cleanup = |ours: &[&Path]| {
        for p in ours {
            let _ = fs.remove(p);
        }
    };
    for (tmp, bytes) in [(&tmp_bin, bin), (&tmp_ips, ips)] {
        match fs.write_new(tmp, bytes) {
            Ok(()) => ours.push(tmp),
            Err(WriteFail::Created(e)) => {
                ours.push(tmp);
                cleanup(&ours);
                return Err(PublishError::new(
                    "io_error",
                    format!(
                        "falha ao gravar o temporário {}: {e}; nada foi publicado",
                        tmp.display()
                    ),
                ));
            }
            Err(WriteFail::NotCreated(e)) => {
                cleanup(&ours);
                return Err(PublishError::new(
                    "output_exists_or_unwritable",
                    format!(
                        "não foi possível criar o temporário {}: {e}; nada foi publicado",
                        tmp.display()
                    ),
                ));
            }
        }
    }
    let lido_bin = fs
        .read(&tmp_bin)
        .map_err(|e| PublishError::new("io_error", format!("falha ao reler o temporário: {e}")));
    let lido_ips = fs
        .read(&tmp_ips)
        .map_err(|e| PublishError::new("io_error", format!("falha ao reler o temporário: {e}")));
    let conferido = match (lido_bin, lido_ips) {
        (Ok(b), Ok(i)) if b == bin && i == ips => verify(&b, &i),
        (Ok(_), Ok(_)) => Err(PublishError::new(
            "verify_failed",
            "o conteúdo gravado difere do esperado",
        )),
        (Err(e), _) | (_, Err(e)) => Err(e),
    };
    if let Err(e) = conferido {
        cleanup(&ours);
        return Err(e);
    }
    if let Err(e) = fs.hard_link(&tmp_bin, &final_bin) {
        cleanup(&ours);
        return Err(PublishError::new(
            "output_exists_or_unwritable",
            format!(
                "não foi possível publicar {}: {e}; nada foi publicado",
                final_bin.display()
            ),
        ));
    }
    if let Err(e) = fs.hard_link(&tmp_ips, &final_ips) {
        let mut aviso = String::new();
        if fs.same_file(&final_bin, &tmp_bin) {
            if let Err(e2) = fs.remove(&final_bin) {
                aviso = format!(
                    " ATENÇÃO: a cópia {} ficou publicada e não pôde ser removida ({e2})",
                    final_bin.display()
                );
            }
        } else {
            aviso = format!(
                " ATENÇÃO: {} não é mais o arquivo que publiquei; não o removi",
                final_bin.display()
            );
        }
        cleanup(&ours);
        return Err(PublishError::new(
            "output_exists_or_unwritable",
            format!("não foi possível publicar {}: {e}; a geração foi desfeita (nada anunciado).{aviso}", final_ips.display()),
        ));
    }
    let mut avisos = Vec::new();
    for p in &ours {
        if let Err(e) = fs.remove(p) {
            avisos.push(format!("temporário {} não removido: {e}", p.display()));
        }
    }
    Ok((final_bin, final_ips, avisos))
}
