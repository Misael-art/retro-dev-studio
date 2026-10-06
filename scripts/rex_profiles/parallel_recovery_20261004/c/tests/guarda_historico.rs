//! Guard E2-1 — EXPECTATIONS-ETAPA3 §2.
//!
//! A retificação de P-absW muda o decoder, o sítio e o export. Isso não pode
//! reescrever a história: os seis JSONs redigidos e os dois manifestos publicados
//! nas ETAPAs 1/2 ficam byte a byte como estão. Este ficheiro pincha os digestos
//! e corre em `cargo test` a partir de agora — ou seja, falha se alguma
//! re-derivação da ETAPA 3 escrever por cima de um artefato histórico.
//!
//! Os digestos dos seis JSONs são os congelados em `MANIFEST-ETAPA2.md`
//! (linhas da tabela de artefatos versionados). Os dois manifestos não têm
//! digesto próprio publicado; são pinados aqui nos bytes que tinham no ponto
//! recebido `8ea5821`, antes de qualquer evidência nova desta etapa.
//!
//! Porque um guard que só passa não prova nada, `conferir` é chamada com
//! entradas envenenadas em dois testes: um digesto esperado errado e um byte
//! extra num conteúdo têm de produzir exatamente uma falha, com o nome do
//! ficheiro. É a versão reproduzível do "ver o teste falhar".

use rex_gameplay::sha256::sha256_hex;
use std::path::{Path, PathBuf};

const EVIDENCIA: &str = "data/rex_profiles/parallel_recovery_20261004/c/evidence";

/// (arquivo, sha256 esperado). Ordem alfabética de arquivo.
const PINADOS: &[(&str, &str)] = &[
    (
        "censo-iscas.redigido.json",
        "6c446c292824c7e5a7256046abca9e0e1a6ca3862503157df1660d8a3b8954ef",
    ),
    (
        "r1.redigido.json",
        "d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4",
    ),
    (
        "r2.redigido.json",
        "524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3",
    ),
    (
        "r3.redigido.json",
        "c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea",
    ),
    (
        "s1.redigido.json",
        "110e5cda4f22be65e646ea7027d2ffb3fdf9751f2f06ae56518253709f657ad3",
    ),
    (
        "s2.redigido.json",
        "bb6db8baaa9d644d918364588c3c5b90c7d81fd4d3517123ce32361824c0a06a",
    ),
    (
        "MANIFEST.md",
        "657c216efd027e02381cdea145e5b5920e52ce294b44378883fd407097e01bdd",
    ),
    (
        "MANIFEST-ETAPA2.md",
        "25406d83481b252ea215e768e80ad46035bdcaee4ae187041cc17ef6b94dcf5b",
    ),
];

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(4)
        .expect("a frente C esta quatro niveis abaixo da raiz")
        .to_path_buf()
}

fn ler(nome: &str) -> Vec<u8> {
    let p = repo().join(EVIDENCIA).join(nome);
    std::fs::read(&p).unwrap_or_else(|e| panic!("ler {}: {e}", p.display()))
}

/// Compara (nome, digesto esperado) com (nome, conteúdo). Devolve uma linha por
/// divergência: digesto esperado que não bate, conteúdo sem entrada pinada e
/// pinado ausente da leitura.
fn conferir(esperado: &[(&str, &str)], lidos: &[(&str, Vec<u8>)]) -> Vec<String> {
    let mut falhas = Vec::new();
    for (nome, digesto) in esperado {
        let algum = lidos.iter().find(|(n, _)| n == nome);
        match algum {
            None => falhas.push(format!("{nome}: nao foi lido")),
            Some((_, conteudo)) => {
                let real = sha256_hex(conteudo);
                if real != *digesto {
                    falhas.push(format!("{nome}: esperado {digesto}, conteudo da {real}"));
                }
            }
        }
    }
    for (nome, _) in lidos {
        if !esperado.iter().any(|(n, _)| n == nome) {
            falhas.push(format!("{nome}: lido sem digesto pinado"));
        }
    }
    falhas
}

fn lidos() -> Vec<(&'static str, Vec<u8>)> {
    PINADOS.iter().map(|(n, _)| (*n, ler(n))).collect()
}

#[test]
fn e2_1_os_oito_artefatos_historicos_estao_nos_digestos_congelados() {
    let falhas = conferir(PINADOS, &lidos());
    assert!(
        falhas.is_empty(),
        "E2-1: a ETAPA 3 alterou evidencia historica:\n{}",
        falhas.join("\n")
    );
}

#[test]
fn e2_1_o_guard_repele_digesto_esperado_adulterado() {
    // O guard nao pode ser decorativo: um digesto errado tem de falhar, e so o
    // ficheiro correspondente aparece na lista.
    let alvo = "s2.redigido.json";
    let mut esperado: Vec<(String, String)> = PINADOS
        .iter()
        .map(|(n, d)| (n.to_string(), d.to_string()))
        .collect();
    let idx = esperado
        .iter()
        .position(|(n, _)| n == alvo)
        .expect("o pinado deveria conter s2");
    let antigo = esperado[idx].1.clone();
    let adulterado = format!("{}ff", &antigo[..62]);
    assert_ne!(
        antigo, adulterado,
        "o envenenamento tem de mudar o digesto comparado"
    );
    esperado[idx].1 = adulterado;
    let refs: Vec<(&str, &str)> = esperado
        .iter()
        .map(|(n, d)| (n.as_str(), d.as_str()))
        .collect();

    let falhas = conferir(&refs, &lidos());
    assert_eq!(
        falhas.len(),
        1,
        "digesto adulterado deveria dar exatamente uma falha, veio {falhas:?}"
    );
    assert!(
        falhas[0].starts_with("s2.redigido.json:"),
        "a falha deveria nomear o ficheiro adulterado: {}",
        falhas[0]
    );
}

#[test]
fn e2_1_o_guard_repele_conteudo_com_um_byte_extra() {
    // Prova do outro lado: se a re-derivacao escrever por cima de um artefato
    // historico, o guard falha por ele.
    let mut lidos = lidos();
    lidos
        .iter_mut()
        .find(|(n, _)| *n == "censo-iscas.redigido.json")
        .unwrap()
        .1
        .push(b'\n');
    let falhas = conferir(PINADOS, &lidos);
    assert_eq!(
        falhas.len(),
        1,
        "um byte extra deveria dar exatamente uma falha, veio {falhas:?}"
    );
    assert!(
        falhas[0].starts_with("censo-iscas.redigido.json:"),
        "a falha deveria nomear o ficheiro escrito: {}",
        falhas[0]
    );
}

/// O inventário é o conjunto, não uma amostra: um ficheiro histórico apagado ou
/// renomeado tem de falhar no guard em vez de encolher a lista em silêncio.
/// Subpastas declaradas da pasta de evidencia. Cada uma e pinada por conteudo em
/// teste proprio (`e4_3_...` responde por `etapa3/`); aqui ela so entra na lista
/// para que o inventario do nivel de cima nao a trate como invasor.
const SUBPASTAS_DECLARADAS: &[&str] = &["etapa3"];

/// O nome viola E2-1? Historico pinado e permitido; arquivo novo so e permitido
/// com sufixo `-v2` (`.md`/`.json`/`.txt`); pasta so e permitida declarada.
///
/// Funcao pura para que o envenenamento seja reproduzivel em teste, como ja se
/// faz com `conferir`.
fn fora_do_contrato(nome: &str, eh_dir: bool, subpastas: &[&str]) -> bool {
    if PINADOS.iter().any(|(n, _)| *n == nome) {
        return false;
    }
    if eh_dir {
        return !subpastas.contains(&nome);
    }
    !(nome.ends_with("-v2.md") || nome.ends_with("-v2.json") || nome.ends_with("-v2.txt"))
}

/// Le a pasta devolvendo (nome, eh_diretorio) em ordem de nome.
fn inventario() -> Vec<(String, bool)> {
    let mut v: Vec<(String, bool)> = std::fs::read_dir(repo().join(EVIDENCIA))
        .expect("ler a pasta de evidencia")
        .map(|e| {
            let e = e.expect("entrada da pasta de evidencia");
            let nome = e.file_name().to_string_lossy().into_owned();
            let dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            (nome, dir)
        })
        .collect();
    v.sort();
    v
}

#[test]
fn e2_1_a_pasta_de_evidencia_contem_exatamente_os_oito_pinados() {
    let encontrados = inventario();
    let fora: Vec<&String> = encontrados
        .iter()
        .filter(|(n, d)| fora_do_contrato(n, *d, SUBPASTAS_DECLARADAS))
        .map(|(n, _)| n)
        .collect();
    assert_eq!(
        fora.len(),
        0,
        "E2-1: artefatos na pasta que nao sao historicos nem -v2: {fora:?}"
    );
    let nomes: Vec<String> = encontrados.iter().map(|(n, _)| n.clone()).collect();
    for (nome, _) in PINADOS {
        assert!(
            nomes.iter().any(|x| x == nome),
            "E2-1: artifacto historico {nome} desapareceu da pasta"
        );
    }
}

#[test]
fn e2_1_o_guard_repele_arquivo_novo_sem_sufixo_v2() {
    // Sem esta prova o inventario e decorativo: foi exatamente o que medimos em
    // 2026-10-06 — a primeira versao do filtro guardava apenas os nomes `-v2`,
    // entao um arquivo estranho nunca aparecia na lista de infracoes.
    assert!(
        fora_do_contrato("invasor.md", false, SUBPASTAS_DECLARADAS),
        "arquivo novo sem sufixo -v2 tem de ser infracao"
    );
    assert!(
        fora_do_contrato("MANIFEST-ETAPA3.txt", false, SUBPASTAS_DECLARADAS),
        "evidencia nova sem -v2 tem de ser infracao"
    );
    // Controles negativos: o que o contrato permite nao pode ser infracao.
    assert!(
        !fora_do_contrato("delta-v1-v2.md", false, SUBPASTAS_DECLARADAS),
        "o sufixo -v2 e o canal previsto por E2-2"
    );
    assert!(
        !fora_do_contrato("r1.redigido.json", false, SUBPASTAS_DECLARADAS),
        "o historico pinado e sempre permitido"
    );
}

#[test]
fn e2_1_o_guard_repele_subpasta_nao_declarada() {
    assert!(
        fora_do_contrato("etapa4", true, SUBPASTAS_DECLARADAS),
        "pasta nova so entra declarada e pinada por conteudo"
    );
    assert!(
        !fora_do_contrato("etapa3", true, SUBPASTAS_DECLARADAS),
        "etapa3 ja e pinada por e4_3"
    );
}
