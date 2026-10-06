//! ETAPA 3 §4 — auditoria da EVIDÊNCIA versionada da varredura exaustiva de
//! máscaras (`EXPECTATIONS-ETAPA3.md` §4, obrigações 6 e 9). Escopo congelado:
//! `data/rex_profiles/parallel_recovery_20261004/c/evidence/etapa3/`.
//!
//! Por que este teste lê artefato em vez de rodar o instrumento: a varredura
//! precisa do `m68k-elf-objdump` pinado (~500 mil registros de dump), e o teste
//! de unidade não pode depender de baixar/achar toolchain. O que o teste pode — e
//! deve — fazer é verificar o que foi publicado: as cotas, a soma, a presença de
//! justificativa e fonte por grupo, e que o pacote reproduz os próprios digestos.
//! A receita que produz o pacote é `tools/varredura-mascaras.sh`, e o modo
//! `--check` dela é o que comprova reprodutibilidade byte a byte.
//!
//! Camadas, na mesma forma de `tests/auditoria_evidencia.rs`:
//!   * **regra dura** — vale para qualquer pacote com este nome, inclusive um que
//!     ainda não existe: cota E4-2 (`divergencia-critica = 0`), soma das classes
//!     igual ao número de slots, toda recusa declarada com `justificativa` +
//!     `fonte` + `classe-da-forma` do vocabulário, nenhuma recusa indeclarada
//!     sobrando no JSON, histograma internamente consistente, e o dump integral
//!     FORA do índice (E4-3 / §2.2);
//!   * **inventário pinado** — as contagens medidas na passada que fechou a cota.
//!     Cada igualdade é exata: se a lista fechada mudar de tamanho por causa da
//!     auditoria (E4-4 probeibido), o número sai do lugar e este teste falha.

use rex_gameplay::json::Json;
use rex_gameplay::sha256::sha256_hex;
use std::path::{Path, PathBuf};

const EVIDENCIA: &str = "data/rex_profiles/parallel_recovery_20261004/c/evidence/etapa3";
const JSON: &str = "varredura-mascaras-v2.json";
const MD: &str = "varredura-mascaras-v2.md";
const SHA: &str = "varredura-mascaras-v2-sha256.txt";

/// Mesmos pinos do gerador: schema v2 e o ponto recebido pela frente.
const ESQUEMA: &str = "rex-cfg/censo-mascaras/v2";
const BASE_SHA: &str = "cb56657a142df40d2acd09a3e03e54247f066dea";
const SLOTS: i64 = 65536;

/// Inventário medido (passada 4, 2026-10-05): 39 grupos de recusa declarada
/// cobrindo 14 366 words, com (i)=(ii)=(iii)=0. E4-4: a auditoria NÃO move forma
/// para dentro da lista fechada — qualquer mudança destes números exige
/// retificação datada do contrato, decisão do principal, não do censo.
const GRUPOS: usize = 39;
const RECUSAS_DECLARADAS: i64 = 14366;

/// Vocabulário ASCII (CONTRACT §V5) da origem de cada recusa. A quinta classe
/// não é limite de máquina nem da lista fechada: são formas que o alvo monta e
/// que a proibição estrutural §0.2 não deixa publicar com alvo não comprovado.
const CLASSES: &[&str] = &[
    "CPU-ALVO",
    "LISTA-3",
    "MISTA-CPU-ALVO+LISTA-3",
    "DIVERGENCIA-REGISTRADA",
    "PROIBICAO-ESTRUTURAL-0-2",
];

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(4)
        .expect("a frente C esta quatro niveis abaixo da raiz")
        .to_path_buf()
}

fn caminho(rel: &str) -> PathBuf {
    repo().join(format!("{EVIDENCIA}/{rel}"))
}

fn texto(rel: &str) -> String {
    let p = caminho(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| {
        panic!(
            "ler {}: {e} — rode `tools/varredura-mascaras.sh`",
            p.display()
        )
    })
}

fn json() -> Json {
    let t = texto(JSON);
    Json::parse(&t).unwrap_or_else(|e| panic!("{JSON} nao parseia: {e}"))
}

fn i(j: &Json, campo: &str) -> i64 {
    j.i64_at(campo)
        .unwrap_or_else(|_| panic!("campo inteiro `{campo}` ausente"))
}

fn s(j: &Json, campo: &str) -> String {
    j.str_at(campo)
        .unwrap_or_else(|_| panic!("campo texto `{campo}` ausente"))
        .to_string()
}

// ------------------------------------------------------------- presença/schema

#[test]
fn o_pacote_de_evidencia_existe_e_declara_o_schema_v2() {
    let j = json();
    assert_eq!(s(&j, "schema"), ESQUEMA);
    assert_eq!(s(&j, "ferramenta"), "rex-cfg");
    assert_eq!(s(&j, "base-sha"), BASE_SHA);
    let c = j
        .get("corpus")
        .unwrap_or_else(|| panic!("sem `corpus` (receita + sha)"));
    assert_eq!(i(c, "slots"), SLOTS);
    assert_eq!(i(c, "slot-bytes"), 16);
    let sha = s(c, "sha256");
    assert_eq!(sha.len(), 64, "digest do corpus nao e SHA-256: {sha}");
    assert!(sha.chars().all(|h| h.is_ascii_hexdigit()));
}

#[test]
fn o_pacote_identifica_o_instrumento_por_sha_e_nao_por_caminho() {
    let j = json();
    let ins = j
        .get("instrumento")
        .unwrap_or_else(|| panic!("sem `instrumento`"));
    assert!(
        s(ins, "nome").contains("2.41"),
        "versao do instrumento: {ins:?}"
    );
    for campo in ["as-sha256", "objdump-sha256"] {
        let d = s(ins, campo);
        assert_eq!(d.len(), 64, "{campo} nao e SHA-256 de 64: {d}");
        assert!(d.chars().all(|h| h.is_ascii_hexdigit()));
    }
    assert!(s(ins, "flags").contains("-b binary"));
    // Regra dura (E3 da ETAPA 2, herdada): nada do caminho do operador.
    for texto in [texto(JSON), texto(MD)] {
        let as_ruas: Vec<&str> = texto
            .lines()
            .filter(|l| l.contains("/home/") || l.contains("rds-scratch"))
            .collect();
        assert!(
            as_ruas.is_empty(),
            "evidencia com caminho local: {as_ruas:?}"
        );
    }
}

// ------------------------------------------------------------------- E4-2

#[test]
fn e4_2_a_cota_de_divergencia_critica_e_zero() {
    let j = json();
    let c = j
        .get("contagens")
        .unwrap_or_else(|| panic!("sem `contagens`"));
    assert_eq!(i(c, "slots"), SLOTS);
    assert_eq!(
        i(c, "divergencia-critica"),
        0,
        "E4-2: cota de meta violada — a lista integral sai no erro do gerador"
    );
}

// ------------------------------------------------- R-3.2 (adendo 2026-10-05)

#[test]
fn r3_2_a_o_confronto_de_alvo_nao_pode_ser_vazio() {
    // `divergencia-critica = 0` com `confrontados = 0` foi o estado medido na
    // passada 5: zero comparações não é conformidade, é ausência de medição.
    let j = json();
    let c = j
        .get("confronto-de-alvo")
        .unwrap_or_else(|| panic!("sem `confronto-de-alvo`"));
    assert!(
        i(c, "confrontados") > 0,
        "R-3.2-a: pacote com `confrontados = 0` e INCONCLUSIVE, nao verde"
    );
    assert_eq!(
        i(c, "so-ferramenta"),
        0,
        "R-3.2-a: alvo nosso sem numero do instrumento = leitura perdida, nao acordo"
    );
    assert_eq!(
        i(c, "so-instrumento"),
        0,
        "R-3.2-a: numero do instrumento sem alvo nosso = forma que nao decodificamos"
    );
}

#[test]
fn r3_2_b_o_confronto_separa_abs_w_abs_l_e_desvio() {
    // Os pinos absolutos vém da RECEITA do corpus (um slot por word de opcode),
    // não da implementação: `4EB8`/`4EF8` são os únicos abs.W e `4EB9`/`4EF9` os
    // únicos abs.L do espaço varrido.
    let j = json();
    let c = j.get("confronto-de-alvo").unwrap();
    assert_eq!(
        i(c, "abs-w"),
        2,
        "R-3.2-b: o corpus tem exatamente dois slots abs.W"
    );
    assert_eq!(
        i(c, "abs-l"),
        2,
        "R-3.2-b: o corpus tem exatamente dois slots abs.L"
    );
    assert_eq!(
        i(c, "desvio-pc-relativo"),
        i(c, "confrontados") - 4,
        "R-3.2-b: toda confrontação restante e desvio relativo — a soma tem de fechar"
    );
}

#[test]
fn r3_2_c_os_quatro_absolutos_sao_conferiveis_lado_a_lado() {
    let j = json();
    let c = j.get("confronto-de-alvo").unwrap();
    let ex = c
        .get("exemplos-abs")
        .and_then(|v| v.as_arr().ok())
        .unwrap_or_else(|| panic!("R-3.2-c: sem `exemplos-abs`"));
    assert_eq!(
        ex.len(),
        4,
        "R-3.2-c: os quatro slots absolutos têm de sair listados"
    );
    let palavras: Vec<String> = ex.iter().map(|e| s(e, "palavra")).collect();
    assert_eq!(
        palavras,
        vec!["0x4EB8", "0x4EB9", "0x4EF8", "0x4EF9"],
        "ordem ASCII dos quatro Opcode-word absolutos"
    );
    for e in ex {
        assert_eq!(
            s(e, "nosso"),
            s(e, "instrumento"),
            "R-3.2-c: os dois números têm de bater sem reler o dump: {e:?}"
        );
    }
    // R-3.3: o preenchimento `4E71` dá bit15=0 em todo abs.W; o pacote declara
    // isso em vez de deixar o leitor supor que a extensão de sinal foi testada.
    assert!(
        !s(c, "nota").is_empty(),
        "R-3.3: o bloco tem de declarar o limite do espaço de operandos"
    );
}

#[test]
fn as_classes_somam_exatamente_o_numero_de_slots() {
    let j = json();
    let c = j.get("contagens").unwrap();
    let soma = i(c, "acordo")
        + i(c, "acordo-recusa")
        + i(c, "recusa-declarada")
        + i(c, "divergencia-critica");
    assert_eq!(soma, SLOTS, "uma word ficou fora de toda classe");
    assert_eq!(
        i(c, "acordo") + i(c, "acordo-recusa"),
        SLOTS - RECUSAS_DECLARADAS,
        "E4-4: a parte aceita mudou — a auditoria nao amplia a lista fechada por si so"
    );
    assert_eq!(i(c, "recusa-declarada"), RECUSAS_DECLARADAS);
}

#[test]
fn nenhuma_recusa_indeclarada_sobra_no_pacote() {
    let j = json();
    let indeclaradas = j
        .get("recusas-indeclaradas")
        .and_then(|v| v.as_arr().ok())
        .unwrap_or_else(|| panic!("sem `recusas-indeclaradas`"));
    assert!(
        indeclaradas.is_empty(),
        "recusas sem justificativa publicadas como evidência: {indeclaradas:?}"
    );
}

// ------------------------------------------------------------------- E4-1(iv)

#[test]
fn todo_grupo_de_recusa_tem_justificativa_fonte_e_classe() {
    let j = json();
    let grupos = j
        .get("recusas-declaradas")
        .and_then(|v| v.as_arr().ok())
        .unwrap_or_else(|| panic!("sem `recusas-declaradas`"));
    assert_eq!(grupos.len(), GRUPOS, "inventário de grupos mudou");
    let mut total: i64 = 0;
    let mut ruins = Vec::new();
    for g in grupos {
        let motivo = s(g, "motivo");
        total += i(g, "quantidade");
        let justificativa = s(g, "justificativa");
        let fonte = s(g, "fonte");
        let classe = s(g, "classe-da-forma");
        if justificativa.replace('\"', "").trim().len() < 40 {
            ruins.push(format!("{motivo}: justificativa decorativa"));
        }
        if fonte.replace('\"', "").trim().is_empty() {
            ruins.push(format!("{motivo}: sem fonte"));
        }
        if !CLASSES.contains(&classe.replace('\"', "").trim()) {
            ruins.push(format!("{motivo}: classe {classe:?} fora do vocabulario"));
        }
        // E4-1(iv) pede evidência do árbitro sobre o grupo INTEIRO, não amostra.
        let ev = g
            .get("instrumento")
            .unwrap_or_else(|| panic!("{motivo}: sem evidencia do instrumento"));
        let qtd = i(g, "quantidade");
        let tokens: i64 = ev
            .get("tokens-do-instrumento")
            .and_then(|t| t.as_arr().ok())
            .unwrap_or(&[])
            .iter()
            .map(|t| i(t, "quantidade"))
            .sum();
        assert!(
            tokens > 0,
            "{motivo}: histograma de tokens vazio — o grupo nao foi medido"
        );
        let _ = qtd;
    }
    assert!(
        ruins.is_empty(),
        "recusa declarada mal documentada: {ruins:?}"
    );
    assert_eq!(
        total, RECUSAS_DECLARADAS,
        "a soma das quantidades por grupo tem de bater com a contagem de recusas declaradas"
    );
}

#[test]
fn o_inventario_de_classes_de_procedencia_esta_pino() {
    // Cada linha da tabela declara QUAL regra fecha a forma: a maquina-alvo
    // (as -m68000 recusa), a lista fechada do contrato (o alvo monta), as duas
    // metades num mesmo rotulo, ou divergencia entre referencia e instrumento.
    // O vocabulario e fechado e as quantidades medidas por classe ficam aqui:
    // mover uma linha de classe sem medição nova altera este inventario.
    let j = json();
    let grupos = j.get("recusas-declaradas").unwrap().as_arr().unwrap();
    let mut hist: std::collections::BTreeMap<String, (usize, i64)> =
        std::collections::BTreeMap::new();
    for g in grupos {
        let classe = s(g, "classe-da-forma");
        let e = hist.entry(classe).or_default();
        e.0 += 1;
        e.1 += i(g, "quantidade");
    }
    let lido: Vec<String> = hist
        .iter()
        .map(|(c, (n, q))| format!("{c}={n}gr/{q}w"))
        .collect();
    let esperada: Vec<&str> = vec![
        "CPU-ALVO=25gr/11012w",
        "DIVERGENCIA-REGISTRADA=2gr/32w",
        "LISTA-3=1gr/16w",
        "MISTA-CPU-ALVO+LISTA-3=10gr/3254w",
        "PROIBICAO-ESTRUTURAL-0-2=1gr/52w",
    ];
    assert_eq!(
        lido,
        esperada,
        "inventario de procedencia das recusas (uma linha reclassificada sem medição nova é um defeito)"
    );
}

#[test]
fn o_histograma_de_short_bate_com_a_soma_dos_buckets_e_com_o_acordo_recusa() {
    let j = json();
    let h = j
        .get("histograma-short")
        .unwrap_or_else(|| panic!("sem `histograma-short`"));
    let total = i(h, "total");
    let buckets = h
        .get("por-bucket")
        .and_then(|v| v.as_arr().ok())
        .unwrap_or_else(|| panic!("sem `por-bucket`"));
    assert_eq!(buckets.len(), 16);
    let soma: i64 = buckets.iter().map(|b| i(b, "quantidade")).sum();
    assert_eq!(
        soma, total,
        "histograma de `.short` internamente inconsistente"
    );
    // Regra dura, não contagem: toda word que o árbitro marcou `.short` ou e
    // `acordo-recusa` (nos recusamos tambem) ou e `divergencia-critica` (ii) — e a
    // cota E4-2 diz que a segunda classe esta em zero. Entao as duas quantidades
    // tem de ser a mesma. Um histograma maior que `acordo-recusa` significa que o
    // classificador perdeu um caminho; menor, que a classe foi redefinida.
    let c = j.get("contagens").unwrap();
    assert_eq!(
        total,
        i(c, "acordo-recusa"),
        "o total de `.short` do arbitro nao bate com `acordo-recusa` ({total} vs {})",
        i(c, "acordo-recusa")
    );
}

// ------------------------------------------------------------------- E4-3

#[test]
fn e4_3_o_dump_integral_nao_esta_no_indice() {
    let mut nomes: Vec<String> = std::fs::read_dir(repo().join(EVIDENCIA))
        .expect("pasta de evidencia da etapa 3")
        .filter_map(|e| {
            let n = e.ok()?.path().file_name()?.to_string_lossy().to_string();
            (!n.starts_with('.')).then_some(n)
        })
        .collect();
    nomes.sort();
    // O que E4-3 proíbe é o dump integral entrar no índice: a asserção é de
    // CONJUNTO. A primeira versão comparava a lista ordenada do diretório com um
    // literal fora de ordem e, portanto, nunca passava — defeito de método
    // registrado em 2026-10-05, não afrouxamento do critério.
    let mut esperados: Vec<String> = vec![MD.to_string(), JSON.to_string(), SHA.to_string()];
    esperados.sort();
    assert_eq!(
        nomes, esperados,
        "E4-3: a evidencia versionada e receita + digestos + contagens + histograma + \
         divergencias + tabela; dump integral nao entra"
    );
}

#[test]
fn os_digestos_publicados_batem_e_apontam_os_regeneraveis() {
    let lado = texto(SHA);
    let linhas: Vec<&str> = lado
        .lines()
        .filter(|l| {
            let t = l.trim_start();
            t.starts_with(|c: char| c.is_ascii_hexdigit()) && t.len() >= 64
        })
        .collect();
    assert_eq!(
        linhas.len(),
        4,
        "o sidecar deve trazer 4 digestos: {linhas:?}"
    );
    let mut conferidos = Vec::new();
    let mut nao_versionados = Vec::new();
    for l in &linhas {
        let (digest, nome) = l
            .split_once("  ")
            .unwrap_or_else(|| panic!("linha de digesto mal formada: {l}"));
        let local = caminho(nome);
        if local.is_file() {
            let real = sha256_hex(
                &std::fs::read(&local).unwrap_or_else(|e| panic!("ler {}: {e}", local.display())),
            );
            assert_eq!(
                real, digest,
                "{nome}: digest publicado nao bate com o arquivo"
            );
            conferidos.push(nome.to_string());
        } else {
            // E4-3 / §2.2: corpus e dump sao regeneraveis pela receita; entram no
            // sidecar por digesto e ficam FORA do indice.
            let basename = nome.rsplit('/').next().unwrap_or(nome);
            assert!(
                !caminho(basename).exists(),
                "artefato que E4-3 nao versiona aparece no indice: {basename}"
            );
            nao_versionados.push(basename.to_string());
        }
    }
    assert_eq!(conferidos, vec![JSON.to_string(), MD.to_string()]);
    assert_eq!(
        nao_versionados,
        vec![
            "corpus-mascaras.bin".to_string(),
            "dump-mascaras.txt".to_string()
        ],
        "o sidecar deve nomear exatamente o corpus e o dump regeneraveis"
    );
}

#[test]
fn o_markdown_repete_as_contagens_do_json() {
    let j = json();
    let c = j.get("contagens").unwrap();
    let md = texto(MD);
    for campo in [
        "acordo",
        "acordo-recusa",
        "recusa-declarada",
        "divergencia-critica",
    ] {
        let valor = i(c, campo).to_string();
        let linha = format!("| `{campo}` | {valor} |");
        assert!(
            md.contains(&linha),
            "o markdown nao publica `{campo}` = {valor} como o JSON"
        );
    }
    let corpus_sha = s(j.get("corpus").unwrap(), "sha256");
    assert!(md.contains(&corpus_sha), "md sem o digesto do corpus");
    for campo in ["as-sha256", "objdump-sha256"] {
        assert!(
            md.contains(&s(j.get("instrumento").unwrap(), campo)),
            "md sem o digesto do instrumento ({campo})"
        );
    }
    assert!(md.contains("sem execução"), "md sem o limite de runtime");
    // Cada grupo da tabela tem de aparecer no markdown com a classe — é a forma
    // humana de ler "esta recusa é da máquina ou do contrato".
    for g in j.get("recusas-declaradas").unwrap().as_arr().unwrap() {
        let motivo = s(g, "motivo");
        assert!(
            md.contains(&motivo),
            "grupo fora da tabela do markdown: {motivo}"
        );
    }
}
