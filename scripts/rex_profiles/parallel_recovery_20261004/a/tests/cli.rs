//! Pasos 7–8 na CLI real: *un root declarado polo usuario continua sendo
//! root local* e *resultado estruturado con motivos estábeis*.
//!
//! Executa o binario `rex-chain` contra a imaxe sintética autoral (a mesma
//! familia de `tests/verify.rs`/`tests/adulteracion.rs`; ningún byte
//! comercial) e pinna:
//! - `construir-cadea` desde sitio declarado: `orixe` di
//!   `carga_sitio=declarado-probado`, **nunca** `descoberto`, confianza
//!   `vinculo-estrutural`, limitación `sen-execucion`;
//! - `detectar` é a única ruta que emite `descoberto-por-varredura`;
//! - ningunha saída contiene `observado-en-runtime` (vocabulario pechado);
//! - `revalidar` imprime `rex-chain revalidar codigo=N` + resumo por elo,
//!   exit-code = N, e **dúas execucións dan stdout byte a byte idéntico**;
//! - identidade adulterada → `codigo=3` con elo `identidade=FAIL` visible.

use rex_chain::chain::Cadea;
use std::path::Path;
use std::process::{Command, Output};

const ROM_SIZE: u32 = 0x1_0000;

fn imaxe_base() -> Vec<u8> {
    let mut v = vec![0u8; ROM_SIZE as usize];
    v[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x02, 0x00]);
    v[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xF6]);
    v[0x110..0x116].copy_from_slice(&[0x43, 0xF9, 0x00, 0xA0, 0x00, 0x00]);
    let fluxo: [u8; 23] = [
        0xFF, 0xFF, b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A',
        b'A', b'A', 0x02, 0x00, b'A', 0x00, 0x00, 0x00,
    ];
    v[0x200..0x200 + fluxo.len()].copy_from_slice(&fluxo);
    v[0x600..0x608].copy_from_slice(&[0x70, 0x00, 0x4E, 0x75, 0x30, 0x3C, 0x00, 0x04]);
    v
}

/// Directorio de traballo exclusivo por test (os tests corren en paralelo).
fn dir_de_trallo(nome: &str) -> std::path::PathBuf {
    let d = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("cli-{nome}"));
    std::fs::create_dir_all(&d).expect("tmpdir");
    d
}

fn rex_chain() -> Command {
    Command::new(env!("CARGO_BIN_EXE_rex-chain"))
}

fn executar(args: &[&str]) -> Output {
    let out = rex_chain()
        .args(args)
        .output()
        .expect("rex-chain executábel");
    assert!(
        !out.stdout.is_empty() || !out.stderr.is_empty(),
        "execución muda: {args:?}"
    );
    out
}

fn escribir_imaxe(d: &Path) -> std::path::PathBuf {
    let p = d.join("synth-cli.bin");
    std::fs::write(&p, imaxe_base()).expect("escribir imaxe");
    p
}

fn construir(imaxe: &Path) -> String {
    let out = executar(&[
        "construir-cadea",
        "--imaxe",
        imaxe.to_str().unwrap(),
        "--rom-size",
        "0x10000",
        "--carga-sitio",
        "0x0100",
        "--destino-sitio",
        "0x0110",
        "--rutina-lonxitude",
        "8",
        "--limite-max-saida",
        "4096",
        "--limite-orzamento",
        "65536",
    ]);
    assert!(
        out.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8(out.stdout).expect("stdout utf-8");
    let liñas: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(
        liñas.len(),
        1,
        "construir-cadea debe emitir un JSONL: {liñas:?}"
    );
    liñas[0].to_string()
}

#[test]
fn raiz_declarada_fica_local_nunha_cadea_construida() {
    // Paso 7: medir desde un sitio declarado polo usuario NON o promove a
    // descuberto, alcance de boot nin observación de runtime.
    let d = dir_de_trallo("raiz-local");
    let imaxe = escribir_imaxe(&d);
    let jsonl = construir(&imaxe);
    let c = Cadea::desde_json(&jsonl).expect("a saída da CLI debe voltar a parsearse");
    assert_eq!(c.confianza, "vinculo-estrutural");
    assert!(
        c.orixe.iter().any(|o| o == "carga_sitio=declarado-probado"),
        "{:?}",
        c.orixe
    );
    assert!(
        !c.orixe.iter().any(|o| o.contains("descoberto")),
        "un sitio declarado xamais sai como descuberto: {:?}",
        c.orixe
    );
    assert!(
        c.limitacions.iter().any(|l| l.contains("sen-execucion")),
        "{:?}",
        c.limitacions
    );
    // pinos da medición sintética (o que a ferramenta MIDE, non o que afirma)
    assert_eq!(c.carga_sitio, 0x0100);
    assert_eq!(c.chamada_alvo, Some(0x0600));
    assert_eq!(c.rutina_sitio, Some(0x0600));
    assert_eq!(c.destino_rexion.as_deref(), Some("io/vram-window"));
    // vocabulario pechado: nin a palabra reservada nin a saída cruda
    assert!(!jsonl.contains("observado-en-runtime"), "{jsonl}");
}

#[test]
fn detectar_e_a_unica_ruta_de_descoberto() {
    // Complemento do paso 7: `detectar` sí marca `descoberto-por-varredura`
    // — a distinción entre as dúas rutas é real e medible na CLI.
    let d = dir_de_trallo("descoberto");
    let imaxe = escribir_imaxe(&d);
    let out = executar(&[
        "detectar",
        "--imaxe",
        imaxe.to_str().unwrap(),
        "--rom-size",
        "0x10000",
        "--rutina-lonxitude",
        "8",
        "--limite-max-saida",
        "4096",
        "--limite-orzamento",
        "65536",
    ]);
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("descoberto-por-varredura"),
        "varredura sen marca de descuberto: {stdout}"
    );
    assert!(!stdout.contains("observado-en-runtime"));
}

#[test]
fn revalidar_por_cli_estruturado_reproducible_e_con_negativos() {
    // Paso 8: resultado estruturado (liña `codigo=N` + resumo por elo),
    // reproducibilidade byte a byte e motivo estable no negativo.
    let d = dir_de_trallo("estruturado");
    let imaxe = escribir_imaxe(&d);
    let jsonl = construir(&imaxe);
    let cadea = d.join("cadea.jsonl");
    std::fs::write(&cadea, format!("{jsonl}\n")).expect("escribir cadea");

    let args = [
        "revalidar",
        "--imaxe",
        imaxe.to_str().unwrap(),
        "--cadea",
        cadea.to_str().unwrap(),
    ];
    let a = executar(&args);
    let b = executar(&args);
    assert!(a.status.success(), "agardado rc=0 na parella boa");
    assert_eq!(
        a.stdout, b.stdout,
        "dúas execucións sobre a mesma parella deben dar stdout idéntico"
    );
    let texto = String::from_utf8_lossy(&a.stdout);
    let liñas: Vec<&str> = texto.lines().collect();
    assert_eq!(liñas[0], "rex-chain revalidar codigo=0");
    for elo in [
        "esquema=PASS",
        "identidade=PASS",
        "xeometria=PASS",
        "saída=PASS",
    ] {
        assert!(liñas[1].contains(elo), "sen elo {elo}: {}", liñas[1]);
    }

    // Negativo de identidade: imaxe cun byte trocado lonxe de todo elo
    // medido — só a SHA pode detela, e o resumo debe mostrar o motivo.
    let peca = d.join("synth-tampered.bin");
    let mut v = imaxe_base();
    v[0x9FF0] ^= 0xFF;
    std::fs::write(&peca, &v).expect("escribir imaxe adulterada");
    let args_malas = [
        "revalidar",
        "--imaxe",
        peca.to_str().unwrap(),
        "--cadea",
        cadea.to_str().unwrap(),
    ];
    let out = rex_chain().args(args_malas).output().expect("exec");
    assert_eq!(out.status.code(), Some(3), "rc de ROM_DIVERXENCIA");
    let texto = String::from_utf8_lossy(&out.stdout);
    assert!(texto.contains("rex-chain revalidar codigo=3"), "{texto}");
    assert!(texto.contains("identidade=FAIL"), "{texto}");
}
