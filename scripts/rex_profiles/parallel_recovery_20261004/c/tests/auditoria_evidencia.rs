//! Auditoria dos JSONs redigidos versionados — EXPECTATIONS-ETAPA2 §8 (E1/E2/E3/E5),
//! obrigação 9. Escopo congelado em §8: `data/rex_profiles/parallel_recovery_20261004/c/evidence/`.
//!
//! Duas camadas, e a distinção é o ponto do teste:
//!   * **regra dura** — vale para qualquer arquivo, inclusive um que ainda não
//!     existe: nenhum dump de byte comercial (E2), reprodução sem caminho local
//!     (E3), origem declarada (E1), referência ao instrumento e ao veredito do
//!     comparador (E5);
//!   * **inventário histórico pinado** — as colisões medidas na letra de §8, nos
//!     arquivos da ETAPA 1 publicados em `275f2af`, que §8 E4 manda preservar. Cada
//!     inventário é uma *igualdade exata*: uma violação nova no lugar de uma
//!     registrada falha, e uma registrada que desaparece também falha.
//!
//! Colisões letra-versus-intenção registradas com campo e valor (o adendo datado
//! propõe a redação ao integrador; §8 não é reescrito):
//!   * E2 veda as chaves `bytes`/`dump`/`hex`/`disassembly`/`opcode-stream`, e
//!     `bytes` é substring de contadores legítimos (`cobertura.bytes-regiao`,
//!     `pino-do-corpo.bytes`). A regra dura é a do conteúdo: chave com `bytes` só
//!     porta inteiro.
//!   * E2 aceita "string hexadecimal de comprimento 40 ou 64"; o `comando` do
//!     `medir` traz `--bin sha256=<64 hex>` dentro de uma string mais longa. A
//!     regra dura é a do *run* contíguo: todo run ≥ 12 hex mede 40 ou 64.
//!   * E1 pede `raizes`+`regiao` em "todo arquivo redigido"; o censo é por sítio e
//!     declara a janela na `regra` e em cada linha.
//!   * E3 veda "o caminho local do `--bin`" no output e E1 exige `objeto` com
//!     "caminho declarado". A regra dura vale no campo que reproduz (`comando`);
//!     os quatro campos de origem das herdadas ficam no inventário.

use rex_gameplay::json::Json;
use rex_gameplay::sha256::sha256_hex;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const EVIDENCIA: &str = "data/rex_profiles/parallel_recovery_20261004/c/evidence";

/// Redigidos auditados. Arquivo novo na pasta sem entrada aqui cai em
/// `a_auditoria_cobre_todos_os_arquivos_da_pasta`.
const REDIGIDOS: &[&str] = &[
    "censo-iscas.redigido.json",
    "r1.redigido.json",
    "r2.redigido.json",
    "r3.redigido.json",
    "s1.redigido.json",
    "s2.redigido.json",
];
const MANIFESTS: &[&str] = &["MANIFEST.md", "MANIFEST-ETAPA2.md"];

/// As três evidências novas da ETAPA 2, e só elas, têm de declarar instrumento e
/// veredito dentro do próprio JSON.
const NOVAS: &[&str] = &[
    "censo-iscas.redigido.json",
    "s1.redigido.json",
    "s2.redigido.json",
];
/// As herdadas da ETAPA 1, preservadas por §8 E4.
const HERDADAS: &[&str] = &["r1.redigido.json", "r2.redigido.json", "r3.redigido.json"];

/// Identidade da ROM BYOR (ETAPA 1 §0): só o digest é versionado; este teste não
/// lê a ROM.
const ROM_SHA: &str = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb";
const ROM_BYTES: i64 = 531577;
/// Ponto recebido pela frente, gravado nas evidências novas.
const BASE: &str = "cb56657a142df40d2acd09a3e03e54247f066dea";

fn frente() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_path_buf()
}

fn repo() -> PathBuf {
    frente()
        .ancestors()
        .nth(4)
        .expect("a frente C esta quatro niveis abaixo da raiz")
        .to_path_buf()
}

fn ler(rel: &str) -> Vec<u8> {
    let p = repo().join(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("ler {}: {e}", p.display()))
}

fn texto(rel: &str) -> String {
    String::from_utf8(ler(rel)).unwrap_or_else(|e| panic!("{rel} nao e UTF-8: {e}"))
}

fn evid(nome: &str) -> String {
    format!("{EVIDENCIA}/{nome}")
}

fn json_de(nome: &str) -> Json {
    let t = texto(&evid(nome));
    Json::parse(&t).unwrap_or_else(|e| panic!("{nome} nao parseia: {e}\n{t}"))
}

/// O gerador dá pretty com um campo por linha e a chave como primeiro token
/// entre aspas da linha; devolve o token do valor (sem a vírgulo final).
fn valores_das_chaves<'a>(texto: &'a str, chave: &str) -> Vec<&'a str> {
    let alvo = format!("\"{chave}\":");
    texto
        .lines()
        .map(str::trim_start)
        .filter_map(|l| l.strip_prefix(&alvo))
        .map(|v| v.trim_start().trim_end_matches(','))
        .collect()
}

/// Pares (chave, valor) de toda linha de campo escalar — string entre aspas ou
/// inteiro. Containers (`{`/`[`) ficam de fora porque não portam conteúdo.
fn pares_chave_valor(texto: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for l in texto.lines() {
        let Some(apos_ini) = l.trim_start().strip_prefix('"') else {
            continue;
        };
        let Some(fim) = apos_ini.find('"') else {
            continue;
        };
        let chave = &apos_ini[..fim];
        let Some(depois) = apos_ini[fim + 1..].trim_start().strip_prefix(':') else {
            continue;
        };
        let depois = depois.trim_start().trim_end_matches(',');
        if depois.starts_with('"') || depois.parse::<i64>().is_ok() {
            out.push((chave.to_string(), depois.to_string()));
        }
    }
    out
}

/// Runs contíguos de `[0-9a-fA-F]` com >= 12 caracteres, sobre o texto inteiro
/// (chaves inclusas): é assim que um dump de ROM aparece num redigido.
fn runs_hex(texto: &str) -> Vec<String> {
    let b = texto.as_bytes();
    let eh = |c: u8| c.is_ascii_digit() || (0x41..=0x46).contains(&c) || (0x61..=0x66).contains(&c);
    let mut out = Vec::new();
    let mut i = 0usize;
    while i < b.len() {
        if !eh(b[i]) {
            i += 1;
            continue;
        }
        let ini = i;
        while i < b.len() && eh(b[i]) {
            i += 1;
        }
        if i - ini >= 12 {
            out.push(texto[ini..i].to_string());
        }
    }
    out
}

fn presentes<T: AsRef<str>>(jsons: &[(T, Json)], campo: &str) -> Vec<String> {
    jsons
        .iter()
        .filter(|(_, j)| j.get(campo).is_some())
        .map(|(n, _)| n.as_ref().to_string())
        .collect()
}

fn ausentes<T: AsRef<str>>(jsons: &[(T, Json)], campo: &str) -> Vec<String> {
    jsons
        .iter()
        .filter(|(_, j)| j.get(campo).is_none())
        .map(|(n, _)| n.as_ref().to_string())
        .collect()
}

// --------------------------------------------------------------- cobertura

#[test]
fn a_auditoria_cobre_todos_os_arquivos_da_pasta() {
    let mut encontrados: Vec<String> = std::fs::read_dir(repo().join(EVIDENCIA))
        .expect("pasta de evidencia")
        .filter_map(|e| {
            let n = e.ok()?.path().file_name()?.to_string_lossy().to_string();
            (n.ends_with(".json") || n.ends_with(".md")).then_some(n)
        })
        .collect();
    encontrados.sort();
    let mut esperado: Vec<String> = REDIGIDOS.iter().map(|s| s.to_string()).collect();
    esperado.extend(MANIFESTS.iter().map(|s| s.to_string()));
    esperado.sort();
    assert_eq!(encontrados, esperado, "a pasta auditada mudou de conteudo");
}

// ------------------------------------------------------------------- E2

#[test]
fn e2_nenhum_dump_de_bytes_comerciais_em_nenhum_arquivo() {
    for nome in REDIGIDOS.iter().chain(MANIFESTS.iter()) {
        let t = texto(&evid(nome));
        let ruins: Vec<String> = runs_hex(&t)
            .into_iter()
            .filter(|r| r.len() != 40 && r.len() != 64)
            .map(|r| format!("{} chars comecando em {}", r.len(), &r[..r.len().min(48)]))
            .collect();
        assert!(
            ruins.is_empty(),
            "E2 {nome}: run(s) de hex >= 12 que nao sao blob de 40/64 = provavel conteudo derivado da ROM: {ruins:?}"
        );
    }
}

#[test]
fn e2_a_regra_repele_um_corpo_de_rom_e_aceita_um_digest() {
    // Auto-discriminação: sem este teste, um scanner quebrado daria "0 violacoes"
    // para qualquer arquivo.
    let corpo = "0123456789abcdef".repeat(20); // 320 hex contíguos
    let amostra = format!("{{\"pino\": \"{ROM_SHA}\", \"corpo\": \"{corpo}\"}}");
    let runs = runs_hex(&amostra);
    assert_eq!(runs.len(), 2, "os dois blobs tem de ser achados: {runs:?}");
    let ruins: Vec<usize> = runs
        .iter()
        .map(|r| r.len())
        .filter(|l| *l != 40 && *l != 64)
        .collect();
    assert_eq!(ruins, vec![320usize], "so o corpo de ROM e reprovado");
    assert_eq!(runs.iter().find(|r| r.len() == 64).unwrap(), ROM_SHA);
}

#[test]
fn e2_distribuicao_real_de_blobs_aceitos() {
    // Registro numérico para o adendo datado: que comprimentos existem de fato. Um
    // formato novo já é pego pelo teste da regra dura; este grava a distribuição.
    let mut hist: BTreeMap<usize, usize> = BTreeMap::new();
    for nome in REDIGIDOS.iter().chain(MANIFESTS.iter()) {
        for r in runs_hex(&texto(&evid(nome))) {
            *hist.entry(r.len()).or_default() += 1;
        }
    }
    let chaves: Vec<usize> = hist.keys().copied().collect();
    assert_eq!(chaves, vec![40usize, 64], "distribuicao de blobs: {hist:?}");
    assert!(
        *hist.get(&64).unwrap_or(&0) >= 60 && *hist.get(&40).unwrap_or(&0) >= 1,
        "esperado >= 60 SHA-256 e >= 1 SHA-1 de commit; obtido {hist:?}"
    );
}

#[test]
fn e2_chave_que_contem_bytes_so_porta_inteiro() {
    let mut ofensores = Vec::new();
    let mut contadores = 0usize;
    for nome in REDIGIDOS {
        let t = texto(&evid(nome));
        for (chave, valor) in pares_chave_valor(&t) {
            if chave.contains("bytes") {
                if valor.parse::<i64>().is_ok() {
                    contadores += 1;
                } else {
                    ofensores.push(format!("{nome}::{chave} = {valor}"));
                }
            }
        }
    }
    assert!(
        ofensores.is_empty(),
        "E2: chave com `bytes` portando nao-inteiro (dump?): {ofensores:?}"
    );
    assert!(
        contadores >= 18,
        "a auditoria nao pode estar vazia: {contadores} contadores de bytes nas seis evidencias \
         (18 e o total medido: 2 por herdada + 6 por amostra nova)"
    );
}

#[test]
fn e2_os_outros_quatro_nomes_proibidos_nao_aparecem_como_chave() {
    let proibidas = ["dump", "hex", "disassembly", "opcode-stream"];
    let mut achadas = Vec::new();
    for nome in REDIGIDOS {
        let t = texto(&evid(nome));
        for p in proibidas {
            if !valores_das_chaves(&t, p).is_empty() {
                achadas.push(format!("{nome}::{p}"));
            }
        }
    }
    assert!(
        achadas.is_empty(),
        "E2: chave proibida por nome: {achadas:?}"
    );
}

// ------------------------------------------------------------------- E1

#[test]
fn e1_todo_redigido_declara_a_origem_do_objeto_e_o_comando() {
    for nome in REDIGIDOS {
        let j = json_de(nome);
        let o = j.get("objeto").unwrap_or_else(|| {
            panic!("E1 {nome}: sem `objeto` (caminho declarado + SHA + tamanho)")
        });
        assert_eq!(
            o.get("sha256").and_then(|v| v.as_str().ok()),
            Some(ROM_SHA),
            "{nome}: identidade do objeto nao e o SHA-256 pinado"
        );
        assert_eq!(
            o.get("tamanho").and_then(|v| v.as_i64().ok()),
            Some(ROM_BYTES),
            "{nome}: tamanho do objeto"
        );
        assert!(
            o.get("caminho_declarado")
                .and_then(|v| v.as_str().ok())
                .is_some(),
            "{nome}: sem caminho declarado (E1)"
        );
        let t = texto(&evid(nome));
        let cmds = valores_das_chaves(&t, "comando");
        assert!(!cmds.is_empty(), "{nome}: sem comando de reproducao");
        for c in cmds {
            assert!(
                c.contains("rex-cfg"),
                "{nome}: comando sem a ferramenta: {c}"
            );
        }
    }
    let j: Vec<(&str, Json)> = todos();
    assert_eq!(
        ausentes(&j, "base-da-ferramenta"),
        HERDADAS.to_vec(),
        "E1: `base-da-ferramenta` divergiu do inventario historico da ETAPA 1"
    );
    for nome in presentes(&j, "base-da-ferramenta") {
        assert_eq!(
            json_de(&nome)
                .get("base-da-ferramenta")
                .unwrap()
                .as_str()
                .unwrap(),
            BASE,
            "{nome}: base da ferramenta trocou"
        );
    }
}

fn todos<'a>() -> Vec<(&'a str, Json)> {
    REDIGIDOS.iter().map(|n| (*n, json_de(n))).collect()
}

#[test]
fn e1_raizes_declaram_proveniencia_e_grau_e_nunca_promovem() {
    let vocab = [
        "candidato",
        "referencia-estatica",
        "vinculo-estrutural",
        "vetor-plataforma",
        "dentro-de-fluxo",
    ];
    for nome in [
        "r1.redigido.json",
        "r2.redigido.json",
        "r3.redigido.json",
        "s1.redigido.json",
        "s2.redigido.json",
    ] {
        let j = json_de(nome);
        let raizes = j
            .get("raizes")
            .and_then(|v| v.as_arr().ok())
            .unwrap_or_else(|| panic!("E1 {nome}: sem `raizes`"));
        assert!(!raizes.is_empty(), "{nome}: nenhuma raiz declarada");
        for r in raizes {
            let prov = r
                .str_at("proveniencia")
                .unwrap_or_else(|_| panic!("{nome}: raiz sem proveniencia"));
            let grau = r
                .str_at("grau")
                .unwrap_or_else(|_| panic!("{nome}: raiz sem grau"));
            assert!(
                vocab.contains(&prov),
                "{nome}: proveniencia {prov} fora do vocabulario"
            );
            assert_eq!(
                prov, grau,
                "{nome}: grau {grau} promovido de {prov} (CONTRACT §0.1)"
            );
            let ev = r
                .get("evidencia")
                .and_then(|v| v.as_str().ok())
                .unwrap_or("");
            assert!(
                ev.chars().count() >= 30,
                "{nome}: evidencia da raiz em {prov} decorativa ou ausente: {ev:?}"
            );
        }
        for ch in j
            .get("chamadas")
            .and_then(|v| v.as_arr().ok())
            .unwrap_or(&[])
        {
            assert_eq!(
                ch.str_at("params").unwrap_or("?"),
                "nao-inferidos",
                "{nome}: chamada com params inventados"
            );
            assert_eq!(
                ch.str_at("clobbers").unwrap_or("?"),
                "nao-modelado",
                "{nome}: chamada com clobbers inventados"
            );
        }
    }
}

#[test]
fn e1_regiao_e_janela_declaram_o_que_foi_delimitado() {
    for nome in [
        "r1.redigido.json",
        "r2.redigido.json",
        "r3.redigido.json",
        "s1.redigido.json",
        "s2.redigido.json",
    ] {
        let j = json_de(nome);
        let r = j
            .get("regiao")
            .unwrap_or_else(|| panic!("E1 {nome}: sem regiao"));
        let ini = r
            .i64_at("inicio")
            .unwrap_or_else(|_| panic!("{nome}: regiao.inicio"));
        let fim = r
            .i64_at("fim")
            .unwrap_or_else(|_| panic!("{nome}: regiao.fim"));
        assert!(ini < fim, "{nome}: regiao vazia {ini:#x}..{fim:#x}");
    }
    // O censo e por sitio: a janela mora na `regra` e em cada uma das 16 linhas.
    let t = texto(&evid("censo-iscas.redigido.json"));
    assert!(
        valores_das_chaves(&t, "regra")[0].contains("janela alinhada"),
        "censo sem regra de janela"
    );
    assert_eq!(
        valores_das_chaves(&t, "sitio").len(),
        16,
        "censo do Apendice B"
    );
    assert_eq!(
        valores_das_chaves(&t, "veredito").len(),
        16,
        "censo sem veredito por linha"
    );
}

// ------------------------------------------------------------------- E3

#[test]
fn e3_o_comando_registrado_nao_contem_caminho_local() {
    let mut ofensores = Vec::new();
    for nome in REDIGIDOS {
        let t = texto(&evid(nome));
        for chave in ["comando", "comando-de-medicoes"] {
            for v in valores_das_chaves(&t, chave) {
                if v.contains("/home/") || v.contains("~") || v.contains(".bin") {
                    ofensores.push(format!("{nome}::{chave} = {v}"));
                }
            }
        }
    }
    assert!(
        ofensores.is_empty(),
        "E3: comando de reproducao com caminho do operador (identidade deve ser por SHA): {ofensores:?}"
    );
}

#[test]
fn e3_o_comando_de_medicoes_identifica_o_objeto_por_sha() {
    // Prova de que E3 nao e so proibicao: o `medir` registra o objeto como
    // `--bin sha256=<64 hex>`, reproduzivel em qualquer maquina com o mesmo digest.
    for nome in ["s1.redigido.json", "s2.redigido.json"] {
        let t = texto(&evid(nome));
        let cmd = valores_das_chaves(&t, "comando-de-medicoes")
            .first()
            .cloned()
            .unwrap_or_else(|| panic!("E3 {nome}: sem comando-de-medicoes"));
        assert!(
            cmd.contains(&format!("--bin sha256={ROM_SHA}")),
            "{nome}: o comando de medicoes nao identifica o objeto por SHA: {cmd}"
        );
        assert!(
            cmd.contains("rex-cfg medir"),
            "{nome}: comando nao e do medir"
        );
    }
}

#[test]
fn e3_inventario_pinado_de_campos_que_portam_caminho_do_operador() {
    // Contrapeso: a letra de E3 diria "nenhum caminho local no output". A medição
    // mostra 2 campos em cada uma das tres evidencias da ETAPA 1 que declaram
    // origem por caminho. §8 E4 manda preservar o histórico; a igualdade exata faz
    // qualquer campo NOVO fora do índice falhar aqui.
    let mut fora = Vec::new();
    for nome in REDIGIDOS {
        let t = texto(&evid(nome));
        for (chave, valor) in pares_chave_valor(&t) {
            if valor.starts_with("\"/home/") {
                fora.push(format!("{nome}::{chave}"));
            }
        }
    }
    let esperado: Vec<String> = HERDADAS
        .iter()
        .flat_map(|n| {
            [
                format!("{n}::caminho_declarado"),
                format!("{n}::caminho_local"),
            ]
        })
        .collect();
    assert_eq!(
        fora,
        esperado,
        "E3: campos com caminho local divergiram do inventario historico (um novo exige retificacao datada, nao edicao das herdadas)"
    );
}

#[test]
fn e3_o_que_nao_foi_versionado_tem_digest_e_motivo() {
    for nome in [
        "r1.redigido.json",
        "r2.redigido.json",
        "r3.redigido.json",
        "s1.redigido.json",
        "s2.redigido.json",
    ] {
        let j = json_de(nome);
        let s = j
            .get("saida_completa")
            .unwrap_or_else(|| panic!("E3 {nome}: saida completa nao registrada"));
        let sha = s.str_at("sha256").unwrap_or_default();
        assert_eq!(sha.len(), 64, "{nome}: saida_completa sem SHA-256 de 64");
        assert!(
            sha.chars().all(|c| c.is_ascii_hexdigit()),
            "{nome}: SHA invalido {sha}"
        );
        assert!(
            s.get("motivo_de_nao_versionado")
                .and_then(|v| v.as_str().ok())
                .is_some(),
            "{nome}: saida nao versionada sem motivo"
        );
    }
    for nome in ["s1.redigido.json", "s2.redigido.json"] {
        let j = json_de(nome);
        for chave in ["pino-do-corpo", "contexto-de-selecao"] {
            let o = j
                .get(chave)
                .unwrap_or_else(|| panic!("E3 {nome}: sem {chave}"));
            assert_eq!(
                o.str_at("sha256").unwrap_or_default().len(),
                64,
                "{nome}: {chave} sem pin de 64 hex"
            );
        }
    }
}

// ------------------------------------------------------------------- E5

#[test]
fn e5_as_evidencias_novas_declaram_o_instrumento_no_json() {
    // O instrumento e o arbitro de comprimento e alvo. Identificado por versao e
    // SHA-256 do binario, nunca pelo caminho do operador.
    for nome in NOVAS {
        let j = json_de(nome);
        let i = j
            .get("instrumento")
            .unwrap_or_else(|| panic!("E5 {nome}: nenhuma referencia ao instrumento"));
        let versao = i.str_at("versao").unwrap_or_default();
        assert!(
            versao.contains("2.41"),
            "{nome}: versao do instrumento nao pinada: {versao}"
        );
        assert_eq!(
            i.str_at("sha256").unwrap_or_default().len(),
            64,
            "{nome}: instrumento sem SHA-256"
        );
        assert!(
            i.str_at("papel")
                .unwrap_or_default()
                .contains("nao equivale"),
            "{nome}: papel do instrumento sem o limite declarado (paridade != runtime)"
        );
        assert!(
            !i.str_at("caminho_declarado")
                .unwrap_or_default()
                .contains("/home/"),
            "{nome}: instrumento referenciado por caminho local"
        );
    }
    let j = todos();
    assert_eq!(
        ausentes(&j, "instrumento"),
        HERDADAS.to_vec(),
        "E5: referencia ao instrumento divergiu do inventario historico"
    );
}

#[test]
fn e5_as_evidencias_novas_declaram_o_veredito_do_comparador() {
    for nome in NOVAS {
        let j = json_de(nome);
        let v = j
            .get("veredito-do-comparador")
            .unwrap_or_else(|| panic!("E5 {nome}: sem veredito do comparador"));
        assert_eq!(
            v.i64_at("divergencias-criticas").unwrap_or(-1),
            0,
            "{nome}: o comparador nao fechou com zero divergencias"
        );
        let criterios = v
            .get("criterios")
            .and_then(|c| c.as_arr().ok())
            .unwrap_or(&[]);
        assert!(
            criterios.len() >= 7,
            "{nome}: criterios auditados: {criterios:?}"
        );
        let serie = v.str_at("serie-bruta").unwrap_or_default();
        assert!(
            serie.contains("MANIFEST"),
            "{nome}: serie bruta fora do arquivo versionado: {serie}"
        );
    }
}

#[test]
fn e5_o_limite_de_runtime_e_declarado_dentro_de_cada_evidencia() {
    // "um leitor que so tem o JSON consegue decidir o que foi medido e o que ficou
    // pendente" (§8 E5): o limite nao cabe so no relatorio.
    for nome in REDIGIDOS {
        let t = texto(&evid(nome));
        assert!(
            t.contains("sem execucao"),
            "{nome}: nao declara que nada aqui e observacao em runtime"
        );
    }
    let com_paridade: Vec<&str> = NOVAS
        .iter()
        .filter(|n| texto(&evid(n)).contains("nao equivale"))
        .copied()
        .collect();
    assert_eq!(
        com_paridade,
        NOVAS.to_vec(),
        "E5/obrigacao 8: evidencia nova sem o limite de paridade declarado no proprio JSON"
    );
}

#[test]
fn e5_manifesto_amarra_cada_redigido_ao_instrumento_e_ao_veredito() {
    // O leitor do bundle: cada redigido aparece numa tabela cujo SHA confere com o
    // arquivo, no mesmo manifesto que nomeia o instrumento e grava o veredito.
    for nome in REDIGIDOS {
        let digest = sha256_hex(&ler(&evid(nome)));
        let mut amarrado = false;
        for m in MANIFESTS {
            let t = texto(&evid(m));
            let Some(linha) = t.lines().find(|l| l.starts_with(&format!("| {nome} |"))) else {
                continue;
            };
            let col: Vec<&str> = linha.split('|').map(str::trim).collect();
            assert_eq!(
                col[2], digest,
                "E5 {m}: digest de {nome} nao bate com o arquivo"
            );
            assert!(
                t.contains("m68k-elf-objdump"),
                "E5 {m}: nao nomeia o instrumento"
            );
            assert!(
                t.contains("divergencias criticas"),
                "E5 {m}: sem veredito do comparador"
            );
            assert!(t.contains(ROM_SHA), "E5 {m}: sem a identidade da ROM lida");
            amarrado = true;
        }
        assert!(
            amarrado,
            "E5: {nome} nao esta amarrado a nenhum manifesto versionado"
        );
    }
}

#[test]
fn e5_o_manifesto_de_fixtures_conferir_byte_a_byte() {
    // As fixtures autorais sao o caminho de reproducao sem ROM comercial: o pin de
    // cada uma tem de bater com o arquivo versionado, senao o leitor nao reproduz.
    let mf = std::fs::read_to_string(frente().join("fixtures/MANIFEST.sha256")).unwrap();
    let mut ruins = Vec::new();
    let mut conferidas = 0usize;
    for linha in mf.lines().filter(|l| !l.trim().is_empty()) {
        let (digest, rel) = linha
            .split_once("  ")
            .unwrap_or_else(|| panic!("linha mal formada: {linha}"));
        let bruto = std::fs::read(frente().join(rel))
            .unwrap_or_else(|e| panic!("fixture registrada mas ausente: {rel}: {e}"));
        let real = sha256_hex(&bruto);
        if real != digest {
            ruins.push(format!("{rel}: manifesto diz {digest}, arquivo tem {real}"));
        }
        conferidas += 1;
    }
    assert!(
        conferidas >= 30,
        "manifesto de fixtures curto demais: {conferidas}"
    );
    assert!(
        ruins.is_empty(),
        "E5: digest de fixture nao bate: {ruins:?}"
    );
}

#[test]
fn e5_os_pins_da_amostra_estao_no_manifesto_e_no_redigido() {
    // O corpo e o contexto de cada amostra ficam pinados nos dois lados, com o
    // mesmo digest: e o que permite reexecutar sem confiar na narracao.
    let m = texto(&evid("MANIFEST-ETAPA2.md"));
    for nome in ["s1.redigido.json", "s2.redigido.json"] {
        let j = json_de(nome);
        for campo in ["pino-do-corpo", "contexto-de-selecao"] {
            let sha = j.get(campo).unwrap().str_at("sha256").unwrap();
            assert!(
                m.contains(sha),
                "{nome}: {campo} ({sha}) nao esta no manifesto"
            );
        }
    }
}
