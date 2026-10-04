//! A CLI congelada em CONTRACT §2, exercida como processo real.
//!
//! O teste roda o binario `rex-cfg` (`CARGO_BIN_EXE_rex-cfg`) sobre fixtures
//! autorais e verifica o que o contrato promete: enderecos absolutos com
//! `--origin`, provencia validada pelo vocabulario, `--site` no export, JSON
//! deterministico no arquivo saido e codigos de saida distinguindo erro de uso
//! de erro de analise. Nada aqui le ROM: BYOR fica fora de teste de CI
//! (CONTRACT §5).

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

use rex_gameplay::json::Json;

fn bin() -> &'static Path {
    Path::new(env!("CARGO_BIN_EXE_rex-cfg"))
}

fn fixture(nome: &str) -> String {
    format!("{}/fixtures/{nome}", env!("CARGO_MANIFEST_DIR"))
}

static RODADAS: AtomicUsize = AtomicUsize::new(0);

/// Diretorio temporario UNIQUE por rodada: testes rodam em threads dentro do
/// mesmo processo e `std::process::id()` sozinho colidiria.
fn dir_unico(rotulo: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "rex-cfg-{}-{}-{}",
        rotulo,
        std::process::id(),
        RODADAS.fetch_add(1, Ordering::SeqCst)
    ));
    std::fs::create_dir_all(&dir).expect("dir temporario");
    dir
}

struct Rodada {
    code: i32,
    stdout: String,
    stderr: String,
    out: std::path::PathBuf,
    dir: std::path::PathBuf,
}

impl Drop for Rodada {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn roda(args: &[&str]) -> Rodada {
    let dir = dir_unico("cli");
    let out = dir.join("analise.json");
    let mut comandos: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    comandos.push("--out".to_string());
    comandos.push(out.display().to_string());
    let argv: Vec<&str> = comandos.iter().map(String::as_str).collect();
    let saida = Command::new(bin())
        .args(&argv)
        .output()
        .expect("binario executavel");
    let texto = |b: Vec<u8>| String::from_utf8_lossy(&b).to_string();
    Rodada {
        code: saida.status.code().unwrap_or(-1),
        stdout: texto(saida.stdout),
        stderr: texto(saida.stderr),
        out,
        dir,
    }
}

impl Rodada {
    fn json(&self) -> Json {
        let texto = std::fs::read_to_string(&self.out).unwrap_or_else(|e| {
            panic!(
                "sem JSON em {}: {e}\n{} {}",
                self.out.display(),
                self.stdout,
                self.stderr
            )
        });
        Json::parse(&texto).unwrap_or_else(|e| panic!("JSON invalido: {e}\n{texto}"))
    }
}

#[test]
fn analyze_escreve_o_json_com_o_objeto_a_regiao_e_os_sitios() {
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx04_calls.bin"),
        "--region",
        "0x0:0x28",
        "--root",
        "0x0",
        "--root-prov",
        "candidato",
        "--site",
        "0x10",
    ]);
    assert_eq!(r.code, 0, "stderr: {}", r.stderr);
    let j = r.json();
    assert_eq!(j.str_at("schema").unwrap(), "rex-cfg/v1");
    assert_eq!(j.field("objeto").unwrap().i64_at("tamanho").unwrap(), 0x28);
    assert_eq!(j.field("objeto").unwrap().str_at("sha256").unwrap(), {
        rex_gameplay::sha256::sha256_hex(&std::fs::read(fixture("fx04_calls.bin")).unwrap())
    });
    let regiao = j.field("regiao").unwrap();
    assert_eq!(regiao.i64_at("inicio").unwrap(), 0);
    assert_eq!(regiao.i64_at("fim").unwrap(), 0x28);
    assert!(!regiao.str_at("proveniencia").unwrap().is_empty());
    // 0x10 e miolo do jsr.abs.L de 0x0e (medido no instrumento)
    let sitios = j.field("sitios").unwrap().as_arr().unwrap();
    assert_eq!(sitios.len(), 1);
    assert_eq!(sitios[0].i64_at("endereco").unwrap(), 0x10);
    assert_eq!(sitios[0].str_at("veredito").unwrap(), "miolo-de-instrucao");
    // a CLI imprime um resumo de uma linha com as contagens (evidencia)
    assert!(
        r.stdout.contains("rex-cfg/v1"),
        "stdout sem identidade: {}",
        r.stdout
    );
    assert!(
        r.stdout.contains("blocos="),
        "stdout sem contagens: {}",
        r.stdout
    );
}

#[test]
fn origin_desloca_todos_os_enderecos_exportados() {
    // MESMA analise, duas bases: com --origin 0x1000 todo endereco exportado
    // sobe 0x1000. E a regra de endereco do contrato (§2: base 0 do --bin +
    // --origin), e nao uma reimpressao de hexadecimal.
    //
    // fx01 usa so desvios RELATIVOS: o displacamento montado no arquivo tambem
    // sobe com a base, entao a analise e identica modulo 0x1000. Fixture com
    // operando absoluto (fx04) nao tem essa propriedade — o alvo absoluto e um
    // literal do arquivo e NAO segue --origin; isso tem teste proprio abaixo.
    let sem = roda(&[
        "analyze",
        "--bin",
        &fixture("fx01_branches.bin"),
        "--region",
        "0x0:0x28",
        "--root",
        "0x0",
        "--root-prov",
        "referencia-estatica",
    ])
    .json();
    let com = roda(&[
        "analyze",
        "--bin",
        &fixture("fx01_branches.bin"),
        "--origin",
        "0x1000",
        "--region",
        "0x1000:0x1028",
        "--root",
        "0x1000",
        "--root-prov",
        "referencia-estatica",
    ])
    .json();

    let bloco_de = |j: &Json| -> Vec<i64> {
        j.field("blocos")
            .unwrap()
            .as_arr()
            .unwrap()
            .iter()
            .map(|b| b.i64_at("entrada").unwrap())
            .collect()
    };
    let (mut a, mut b) = (bloco_de(&sem), bloco_de(&com));
    a.sort_unstable();
    b.sort_unstable();
    assert!(!a.is_empty(), "sem blocos exportados");
    assert_eq!(
        b,
        a.iter().map(|e| e + 0x1000).collect::<Vec<_>>(),
        "--origin nao deslocou as entradas de bloco"
    );
    assert_eq!(
        com.field("regiao").unwrap().i64_at("inicio").unwrap(),
        0x1000
    );
    // as arestas tambem usam a base absoluta
    let origem_de_aresta = com
        .field("arestas")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .map(|e| e.i64_at("origem").unwrap())
        .collect::<Vec<_>>();
    assert!(
        origem_de_aresta.iter().all(|o| *o >= 0x1000 && *o < 0x1028),
        "aresta com endereco fora da base: {origem_de_aresta:?}"
    );
    // a cobertura e a mesma nas duas bases: --origin nao reescreve o programa
    assert_eq!(
        com.field("cobertura")
            .unwrap()
            .i64_at("bytes-decodificados")
            .unwrap(),
        sem.field("cobertura")
            .unwrap()
            .i64_at("bytes-decodificados")
            .unwrap(),
        "--origin mudou a quantidade de bytes provados"
    );
}

#[test]
fn alvo_absoluto_abaixo_do_inicio_da_regiao_e_fora_da_regiao() {
    // Defeito real que esta regra captura: com --origin, o alvo de um
    // `jsr.abs` e um LITERAL do arquivo (0x20, 0x24 em fx04) e nao sobe com a
    // base. Antes do portao de regiao o andarilho descia para baixo de
    // `--region inicio` e caminhada pela area de padding zerado.
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx04_calls.bin"),
        "--origin",
        "0x1000",
        "--region",
        "0x1000:0x1028",
        "--root",
        "0x1000",
        "--root-prov",
        "referencia-estatica",
    ]);
    assert_eq!(r.code, 0, "stderr: {}", r.stderr);
    let j = r.json();

    for b in j.field("blocos").unwrap().as_arr().unwrap() {
        let entrada = b.i64_at("entrada").unwrap();
        assert!(
            (0x1000..0x1028).contains(&entrada),
            "bloco com entrada fora da regiao declarada: {entrada:#x}"
        );
    }

    // o `bsr.w` relativo continua resolvido dentro da regiao; os dois `jsr`
    // absolutos apontam para literais abaixo da base e tem de ser declarados
    // `fora-da-regiao` com o alvo declarado (nenhum alvo inventado, none andado)
    let arestas = j.field("arestas").unwrap().as_arr().unwrap();
    let mut chamada_fora: Vec<i64> = arestas
        .iter()
        .filter(|a| {
            a.str_at("tipo").unwrap() == "chamada"
                && a.str_at("status").unwrap() == "fora-da-regiao"
        })
        .filter_map(|a| a.field("alvo").and_then(|v| v.as_i64()).ok())
        .collect();
    chamada_fora.sort_unstable();
    assert_eq!(
        chamada_fora,
        vec![0x20, 0x24],
        "os alvos absolutos fora da regiao devem ser exatamente os literais do arquivo"
    );
    assert!(
        arestas.iter().any(|a| {
            a.str_at("tipo").unwrap() == "chamada" && a.str_at("status").unwrap() == "resolvido"
        }),
        "o bsr.w relativo perdeu a aresta resolvida: {}",
        r.stdout
    );
    // e nada fora da regiao foi decodificado: nenhum endereco abaixo da base
    // aparece na lista de instrucoes de bloco algum
    let enderecos: Vec<i64> = j
        .field("blocos")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .flat_map(|b| b.field("instrucoes").unwrap().as_arr().unwrap().to_vec())
        .filter_map(|i| i.i64_at("endereco").ok())
        .collect();
    assert!(!enderecos.is_empty(), "nenhuma instrucao exportada");
    assert!(
        enderecos.iter().all(|e| *e >= 0x1000),
        "decodificou bytes abaixo do inicio da regiao: {enderecos:?}"
    );
}

#[test]
fn proveniencia_fora_do_vocabulario_e_erro_de_uso() {
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx01_branches.bin"),
        "--region",
        "0x0:0x28",
        "--root",
        "0x0",
        "--root-prov",
        "observado-em-runtime",
    ]);
    assert_ne!(r.code, 0, "proveniencia fora do vocabulario deveria falhar");
    assert!(
        r.stderr.contains("vocabulario"),
        "stderr sem a razao do veto: {}",
        r.stderr
    );
    assert!(!r.out.exists(), "escreveu JSON apesar do erro");
}

#[test]
fn root_sem_proveniencia_par_e_erro() {
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx01_branches.bin"),
        "--region",
        "0x0:0x28",
        "--root",
        "0x0",
        "--root",
        "0x8",
        "--root-prov",
        "candidato",
    ]);
    assert_ne!(r.code, 0, "faltou --root-prov para a segunda raiz");
    assert!(r.stderr.contains("proveniencia"), "stderr: {}", r.stderr);
}

#[test]
fn regiao_fora_do_arquivo_e_erro_de_analise() {
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx01_branches.bin"),
        "--region",
        "0x0:0x9000",
        "--root",
        "0x0",
        "--root-prov",
        "candidato",
    ]);
    // o contrato limita a regiao ao objeto: fim 0x9000 alem do arquivo NAO e
    // erro de uso, e recortado e registrado — a analise acontece na intersecao
    assert_eq!(r.code, 0, "stderr: {}", r.stderr);
    let j = r.json();
    assert_eq!(j.field("regiao").unwrap().i64_at("fim").unwrap(), 0x28);
    assert!(
        j.field("regiao")
            .unwrap()
            .str_at("proveniencia")
            .unwrap()
            .contains("recort"),
        "recorte nao declarado na proveniencia: {:?}",
        j.field("regiao").unwrap().str_at("proveniencia").unwrap()
    );
}

#[test]
fn raiz_fora_da_regiao_e_erro() {
    let r = roda(&[
        "analyze",
        "--bin",
        &fixture("fx04_calls.bin"),
        "--region",
        "0x0:0xc",
        "--root",
        "0x16",
        "--root-prov",
        "candidato",
    ]);
    assert_ne!(r.code, 0, "raiz fora da regiao deveria falhar");
    assert!(r.stderr.contains("fora da regiao"), "stderr: {}", r.stderr);
}

#[test]
fn ausencia_de_bin_e_uso_com_codigo_dois() {
    let r = roda(&[
        "analyze",
        "--region",
        "0x0:0x10",
        "--root",
        "0x0",
        "--root-prov",
        "candidato",
    ]);
    assert_eq!(
        r.code, 2,
        "erro de uso deveria dar codigo 2; stderr: {}",
        r.stderr
    );
    assert!(r.stderr.contains("usage"), "sem linha de uso: {}", r.stderr);
}

#[test]
fn md_opcional_escreve_o_resumo_com_os_mesmos_numeros() {
    let dir = dir_unico("md");
    let out = dir.join("a.json");
    let md = dir.join("a.md");
    let saida = Command::new(bin())
        .args([
            "analyze",
            "--bin",
            &fixture("fx06_data_opcodes.bin"),
            "--region",
            "0x0:0x1e",
            "--root",
            "0x0",
            "--root-prov",
            "candidato",
            "--site",
            "0x10",
            "--out",
        ])
        .arg(&out)
        .arg("--md")
        .arg(&md)
        .output()
        .unwrap();
    assert_eq!(
        saida.status.code(),
        Some(0),
        "stderr: {}",
        String::from_utf8_lossy(&saida.stderr)
    );
    let texto_md = std::fs::read_to_string(&md).unwrap();
    let json = Json::parse(&std::fs::read_to_string(&out).unwrap()).unwrap();
    let cob = json.field("cobertura").unwrap();
    assert!(texto_md.contains(&cob.i64_at("bytes-decodificados").unwrap().to_string()));
    assert!(texto_md.contains(cob.str_at("fracao").unwrap()));
    assert!(
        texto_md.contains("miolo-de-instrucao") || texto_md.contains("dentro-regiao-nao-alcancado")
    );
    assert!(texto_md.contains("nao-inferidos"));
    let _ = std::fs::remove_dir_all(&dir);
}
