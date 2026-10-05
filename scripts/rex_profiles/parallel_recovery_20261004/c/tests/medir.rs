//! `rex-cfg medir` — export de medições para D, congelado em
//! EXPECTATIONS-ETAPA2.md §6 (obrigação 8). As quatro dimensões
//! (comprimento, operandos, fluxo, alcance) saem **separadas**, cada uma com o
//! seu denominador, sem soma entre elas.
//!
//! Os números esperados NÃO saem da ferramenta: saem da tabela manual
//! commitada junto do fixture assimétrico (`fixtures/fx11-expectativas.md`,
//! §2 e a errata A-8), que é a expectativa. Divergência ferramenta ↔ tabela é
//! FAIL, conforme o protocolo da rodada.
//!
//! MD1: os três textos de `limites` são fixos. O texto congelado em §6 usa
//! acentos; a saída desta frente é ASCII-only (mesma regra V5 de §5, que vale
//! para todo objeto exportado por `rex-cfg`), então os textos são gravados sem
//! acento — normalização de grafia, não de sentido, registrada em CONTRACT §3.
//! MD2: nenhum byte literal do objeto no export. MD3: identidade por SHA +
//! comando de reprodução, sem caminho local. MD4: `status` por dimensão em
//! {medido, pendente, recusado}.

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

use rex_gameplay::json::Json;

const FIX11: &str = "fx11assimetrica";
const REG_11: &str = "0x0:0x100";

/// Ordem de emissão do objeto (fixada aqui, antes de implementar).
const CHAVES: &[&str] = &[
    "schema",
    "ferramenta",
    "versao",
    "base-sha",
    "objeto-sha256",
    "objeto-tamanho",
    "regiao-inicio",
    "regiao-fim",
    "raiz",
    "raiz-proveniencia",
    "comando",
    "comprimento-status",
    "comprimento-unidade",
    "comprimento-instrucoes-provadas",
    "comprimento-bytes-regiao",
    "comprimento-por-tamanho",
    "operandos-status",
    "operandos-unidade",
    "operandos-instrucoes-com-extensao",
    "operandos-palavras-de-extensao",
    "operandos-valores-status",
    "operandos-valores-motivo",
    "fluxo-status",
    "fluxo-unidade",
    "fluxo-blocos-alcancados",
    "fluxo-arestas",
    "fluxo-por-tipo-status",
    "alcance-status",
    "alcance-unidade",
    "alcance-bytes-decodificados",
    "alcance-bytes-regiao",
    "alcance-fracao",
    "alcance-vaos",
    "alcance-fronteiras-por-tipo",
    "agregado",
    "pendencia-motivos",
    "limites",
];

/// MD1 — textos fixos (grafia ASCII, ver cabeçalho).
const LIMITES_MD1: &[&str] = &[
    "paridade com objdump nao equivale a observacao em runtime",
    "nenhuma dimensao promove outra",
    "sem execucao, sem DAC, sem VRAM",
];

fn bin() -> &'static Path {
    Path::new(env!("CARGO_BIN_EXE_rex-cfg"))
}

fn fixture(nome: &str) -> String {
    format!("{}/fixtures/{nome}.bin", env!("CARGO_MANIFEST_DIR"))
}

static RODADAS: AtomicUsize = AtomicUsize::new(0);

fn dir_unico(rotulo: &str) -> std::path::PathBuf {
    let base = std::env::var("TMPDIR").unwrap_or_else(|_| "/home/misael/rds-scratch".to_string());
    let dir = Path::new(&base).join(format!(
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
    bruto: String,
    dir: std::path::PathBuf,
}

impl Drop for Rodada {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

impl Rodada {
    fn json(&self) -> Json {
        Json::parse(&self.bruto).unwrap_or_else(|e| panic!("JSON invalido: {e}\n{}", self.bruto))
    }
    fn texto(&self, chave: &str) -> String {
        let j = self.json();
        match j.get(chave) {
            Some(Json::Str(s)) => s.clone(),
            other => panic!("{chave}: esperado Str, obtido {other:?}\n{}", self.bruto),
        }
    }
    fn int(&self, chave: &str) -> i64 {
        let j = self.json();
        match j.get(chave) {
            Some(Json::Int(v)) => *v,
            other => panic!("{chave}: esperado Int, obtido {other:?}\n{}", self.bruto),
        }
    }
    fn lista(&self, chave: &str) -> Vec<String> {
        let j = self.json();
        let arr = j
            .get(chave)
            .and_then(|v| v.as_arr().ok())
            .unwrap_or_else(|| panic!("{chave} nao e lista\n{}", self.bruto));
        arr.iter()
            .map(|v| {
                v.as_str()
                    .unwrap_or_else(|e| panic!("{}: lista so de cadenas: {e}", self.bruto))
                    .to_string()
            })
            .collect()
    }
    /// Chaves do objeto, na ordem em que foram parseadas.
    fn chaves(&self) -> Vec<String> {
        match self.json() {
            Json::Obj(campos) => campos.into_iter().map(|(k, _)| k).collect(),
            outro => panic!("objeto esperado, obtido {outro:?}"),
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn medir(nome: &str, regiao: &str, raizes: &[(&str, &str)], extras: &[&str]) -> Rodada {
    let dir = dir_unico("medir");
    let out = dir.join("med.json");
    let mut argv: Vec<String> = vec![
        "medir".into(),
        "--bin".into(),
        fixture(nome),
        "--origin".into(),
        "0x0".into(),
        "--region".into(),
        regiao.into(),
    ];
    for (end, prov) in raizes {
        argv.extend_from_slice(&["--root".to_string(), (*end).into()]);
        argv.extend_from_slice(&["--root-prov".to_string(), (*prov).into()]);
    }
    argv.extend(extras.iter().map(|s| s.to_string()));
    argv.extend_from_slice(&["--out".to_string(), out.display().to_string()]);
    let refs: Vec<&str> = argv.iter().map(String::as_str).collect();
    let saida = Command::new(bin())
        .args(&refs)
        .output()
        .expect("binario executavel");
    let texto = |b: Vec<u8>| String::from_utf8_lossy(&b).to_string();
    let bruto = std::fs::read_to_string(&out).unwrap_or_default();
    Rodada {
        code: saida.status.code().unwrap_or(-1),
        stdout: texto(saida.stdout),
        stderr: texto(saida.stderr),
        bruto,
        dir,
    }
}

fn ok(r: &Rodada) {
    assert_eq!(
        r.code, 0,
        "esperado 0, obtido {}\nstdout: {}\nstderr: {}",
        r.code, r.stdout, r.stderr
    );
}

/// Raiz B da tabela: seis blocos, dez nós com pesos `[2,4] [6] [4] [2,4] [2,2] [4,2]`.
fn raiz_b() -> Rodada {
    medir(FIX11, REG_11, &[("0x08", "candidato")], &[])
}

// ---------------------------------------------------------------------------
// MD3 — identidade e reprodução
// ---------------------------------------------------------------------------

#[test]
fn md3_objeto_identificado_por_sha_e_comando_sem_caminho_local() {
    let r = raiz_b();
    ok(&r);
    let sha = r.texto("objeto-sha256");
    assert_eq!(sha.len(), 64, "sha256 hex de 64 digitos: {sha}");
    assert_eq!(
        r.texto("schema"),
        "rex-cfg-med/v1",
        "esquema proprio, nao reusado de analyze ou consultar"
    );
    assert_eq!(r.int("objeto-tamanho"), 300, "fx11 tem 300 bytes");
    let comando = r.texto("comando");
    assert!(comando.starts_with("rex-cfg medir "), "comando: {comando}");
    assert!(
        comando.contains(&format!("sha256={sha}")),
        "o comando tem de nomear o objeto pelo SHA, nao pelo caminho: {comando}"
    );
    assert!(
        !comando.contains('/') && !comando.contains('\\'),
        "caminho local no comando e FAIL por E3/MD3: {comando}"
    );
    assert!(comando.contains("--root 0x000008"), "comando: {comando}");
    assert_eq!(r.texto("raiz"), "0x000008");
    assert_eq!(r.texto("raiz-proveniencia"), "candidato");
}

// ---------------------------------------------------------------------------
// §6 — as quatro dimensões separadas, cada uma com denominador próprio
// ---------------------------------------------------------------------------

#[test]
fn seis_quatro_dimensoes_com_status_e_unidade_proprios() {
    let r = raiz_b();
    ok(&r);
    for dim in ["comprimento", "operandos", "fluxo", "alcance"] {
        let status = r.texto(&format!("{dim}-status"));
        assert!(
            ["medido", "pendente", "recusado"].contains(&status.as_str()),
            "MD4: status de {dim} fora do vocabulario: {status}"
        );
        assert_eq!(status, "medido", "{dim} medido numa execucao completa");
        let unidade = r.texto(&format!("{dim}-unidade"));
        assert!(
            !unidade.is_empty() && unidade.is_ascii() && !unidade.contains(' '),
            "unidade de {dim} deve ser um token ascii: {unidade}"
        );
    }
    // O agregado e proibido por A4: nao ha chave que some dimensoes.
    for chave in r.chaves() {
        let minusculo = chave.to_lowercase();
        for vedado in ["total", "media", "somatorio", "global", "consolidado"] {
            assert!(
                !minusculo.contains(vedado),
                "chave agregada `{chave}` viola §3 A4 / §6 (sem soma entre dimensoes)"
            );
        }
    }
    assert_eq!(r.texto("agregado"), "proibido");
}

#[test]
fn seis_comprimento_bate_com_a_tabela_de_pes_por_bloco() {
    let r = raiz_b();
    ok(&r);
    // Tabela (fx11-expectativas.md §2): pesos [2,4] [6] [4] [2,4] [2,2] [4,2]
    // = 10 nos, 5x2 + 4x4 + 1x6 = 32 bytes.
    assert_eq!(
        r.int("comprimento-instrucoes-provadas"),
        10,
        "tabela: 10 nos"
    );
    assert_eq!(
        r.int("comprimento-bytes-regiao"),
        256,
        "denominador proprio"
    );
    let mut por_tamanho = r.lista("comprimento-por-tamanho");
    por_tamanho.sort();
    assert_eq!(
        por_tamanho,
        vec!["2=5", "4=4", "6=1"],
        "tabela: cinco word, quatro 4-byte, uma 6-byte"
    );
}

#[test]
fn seis_operandos_contam_extensoes_sem_alegar_efetividade() {
    let r = raiz_b();
    ok(&r);
    // Derivado da MESMA tabela: instrucoes com bytes alem do opcode = 4 de
    // 4 bytes + 1 de 6 bytes = 5; palavras de extensao = (4*2 + 4)/2 = 6.
    assert_eq!(r.int("operandos-instrucoes-com-extensao"), 5);
    assert_eq!(r.int("operandos-palavras-de-extensao"), 6);
    assert_eq!(r.texto("operandos-unidade"), "palavras-de-extensao");
    // A linha congelada de §6 promete "word/longword literal, SEM alegacao de
    // efetividade" e MD2 proibe bytes literais: os VALORES nunca saem aqui.
    assert_eq!(r.texto("operandos-valores-status"), "recusado");
    assert!(
        r.texto("operandos-valores-motivo")
            .contains("md2:nenhum-byte-literal"),
        "motivo da recusa: {}",
        r.texto("operandos-valores-motivo")
    );
}

#[test]
fn seis_fluxo_por_tipo_e_status_bate_com_a_tabela_corrigida() {
    let r = raiz_b();
    ok(&r);
    assert_eq!(r.int("fluxo-blocos-alcancados"), 6, "tabela: 6 blocos");
    assert_eq!(r.int("fluxo-arestas"), 10, "tabela: arestas(b) = 10");
    // Errata A-8: quatro quedas (nao cinco) + 3 chamadas + 2 desvios + 1 retorno.
    let mut chaves = r.lista("fluxo-por-tipo-status");
    chaves.sort();
    assert_eq!(
        chaves,
        vec![
            "chamada/fora-da-regiao=1",
            "chamada/indireto-opaco=1",
            "chamada/resolvido=1",
            "desvio/fora-da-regiao=1",
            "desvio/resolvido=1",
            "queda/resolvido=4",
            "retorno-fronteira/indireto-opaco=1",
        ],
        "tabela (linha arestas por (tipo,status), apos A-8)"
    );
    let soma: i64 = r
        .lista("fluxo-por-tipo-status")
        .iter()
        .map(|c| c.rsplit('=').next().unwrap().parse::<i64>().unwrap())
        .sum();
    assert_eq!(
        soma,
        r.int("fluxo-arestas"),
        "detalhamento e contagem concordam"
    );
}

#[test]
fn seis_alcance_reproduz_a_fracao_denominada_pela_regiao() {
    let r = raiz_b();
    ok(&r);
    assert_eq!(r.int("alcance-bytes-decodificados"), 32, "tabela: 32 bytes");
    assert_eq!(r.int("alcance-bytes-regiao"), 256, "denominador da raiz B");
    assert_eq!(r.texto("alcance-fracao"), "0.1250", "tabela: 32/256");
    assert!(r.int("alcance-vaos") >= 1, "ha vao alem dos nos");
    let mut tipos = r.lista("alcance-fronteiras-por-tipo");
    tipos.sort();
    assert_eq!(
        tipos,
        vec!["indirect-opaque=1", "limite-de-regiao=2"],
        "tabela: fronteiras(b)"
    );
}

/// As dimensoes medem a mesma execucao: a soma dos pesos de `comprimento` e os
/// `bytes-decodificados` de `alcance` têm de coincidir. Isso nao e um agregado
/// entre dimensoes (proibido por §6); e a conferencia de que nenhuma delas
/// inventou numero.
#[test]
fn seis_comprimento_e_alcance_conferem_entre_si_sem_serem_somados() {
    let r = raiz_b();
    ok(&r);
    let pesos: i64 = r
        .lista("comprimento-por-tamanho")
        .iter()
        .map(|par| {
            let (tam, qtd) = par.split_once('=').expect("formato tam=qtd");
            tam.parse::<i64>().unwrap() * qtd.parse::<i64>().unwrap()
        })
        .sum();
    assert_eq!(
        pesos,
        r.int("alcance-bytes-decodificados"),
        "comprimento diz {pesos} bytes, alcance diz {}",
        r.int("alcance-bytes-decodificados")
    );
}

// ---------------------------------------------------------------------------
// §3 A4 — uma raiz por execucao; o denominador nunca e compartilhado
// ---------------------------------------------------------------------------

#[test]
fn a4_duas_raizes_sao_erro_de_uso_porque_agregar_e_proibido() {
    let r = medir(
        FIX11,
        REG_11,
        &[("0x08", "candidato"), ("0x00", "candidato")],
        &[],
    );
    assert_eq!(r.code, 2, "duas raizes: esperado 2, stderr {}", r.stderr);
    let erro = r.stderr.to_lowercase();
    assert!(
        erro.contains("uma raiz") || erro.contains("agreg"),
        "a mensagem tem de dizer por que: {}",
        r.stderr
    );
    assert!(r.bruto.is_empty(), "nada e escrito com erro de uso");
}

#[test]
fn a4_raiz_a_tem_denominador_proprio_e_nada_de_b_aparece() {
    let r = medir(FIX11, REG_11, &[("0x00", "candidato")], &[]);
    ok(&r);
    // Tabela, coluna raiz_a: 1 bloco, 1 no de 2 bytes, sem arestas.
    assert_eq!(r.int("comprimento-instrucoes-provadas"), 1);
    assert_eq!(r.int("alcance-bytes-decodificados"), 2);
    assert_eq!(r.texto("alcance-fracao"), "0.0078");
    assert_eq!(r.int("fluxo-blocos-alcancados"), 1);
    assert_eq!(r.int("fluxo-arestas"), 0);
    assert!(r.lista("fluxo-por-tipo-status").is_empty());
    // Nenhum operando estendido: cinco palavras? nao — zero, medido.
    assert_eq!(r.int("operandos-instrucoes-com-extensao"), 0);
    assert_eq!(r.int("operandos-palavras-de-extensao"), 0);
    assert_eq!(r.texto("operandos-status"), "medido", "zero e medida");
    assert_eq!(r.texto("raiz"), "0x000000");
    let comando = r.texto("comando");
    assert!(comando.contains("--root 0x000000"), "comando: {comando}");
}

// ---------------------------------------------------------------------------
// MD4 — `pendente` e resultado legitimo quando o trabalho e truncado
// ---------------------------------------------------------------------------

#[test]
fn md4_trabalho_truncado_da_pendente_em_todas_as_dimensoes() {
    let r = medir(
        FIX11,
        REG_11,
        &[("0x08", "candidato")],
        &["--max-insn", "3"],
    );
    ok(&r);
    for dim in ["comprimento", "operandos", "fluxo", "alcance"] {
        assert_eq!(
            r.texto(&format!("{dim}-status")),
            "pendente",
            "{dim} nao pode ser `medido` numa varredura truncada"
        );
    }
    let motivos = r.lista("pendencia-motivos");
    assert_eq!(motivos, vec!["limite-de-trabalho"], "motivo da pendencia");
    // Os numeros continuam la (sao o que foi possivel medir), mas nao Prometem
    // completude: a fracao nao e a da tabela.
    assert_ne!(r.texto("alcance-fracao"), "0.1250");
}

#[test]
fn md4_sem_truncamento_pendencia_fica_vazia() {
    let r = raiz_b();
    ok(&r);
    assert!(r.lista("pendencia-motivos").is_empty());
}

// ---------------------------------------------------------------------------
// MD1 — limites fixos; MD2 — nenhum literal do objeto
// ---------------------------------------------------------------------------

#[test]
fn md1_limites_fixos_do_export_de_medicoes() {
    let r = raiz_b();
    ok(&r);
    let limites = r.lista("limites");
    for texto in LIMITES_MD1 {
        assert!(
            limites.iter().any(|l| l == texto),
            "MD1: limite fixo ausente: {texto}\nobtido: {limites:?}"
        );
    }
}

#[test]
fn md2_nenhum_byte_literal_do_objeto_sai_no_export() {
    let r = raiz_b();
    ok(&r);
    let proibidas = [
        "dump",
        "disassembly",
        "opcode-stream",
        "alvo",
        "operando-valor",
    ];
    for chave in r.chaves() {
        for p in proibidas {
            assert!(
                !chave.contains(p),
                "chave `{chave}` exporia conteudo do objeto (MD2)"
            );
        }
    }
    // Nenhuma string com 12+ hex contiguos fora dos comprimentos de SHA.
    let mut corridas: Vec<String> = Vec::new();
    let mut atual = String::new();
    for c in r.bruto.chars() {
        if c.is_ascii_hexdigit() {
            atual.push(c);
        } else {
            if !atual.is_empty() {
                corridas.push(std::mem::take(&mut atual));
            }
        }
    }
    if !atual.is_empty() {
        corridas.push(atual);
    }
    for corrida in &corridas {
        let n = corrida.len();
        assert!(
            n < 12 || n == 40 || n == 64,
            "sequencia de {n} hex contiguos no export (so SHA-1/SHA-256 sao \
             aceitos): {corrida}\nserie: {}",
            r.bruto
        );
    }
}

#[test]
fn v5_objeto_plano_ascii_sem_chave_duplicada_na_ordem_congelada() {
    let r = raiz_b();
    ok(&r);
    assert!(
        r.bruto.is_ascii(),
        "V5: saida deve ser ASCII-only\n{}",
        r.bruto
    );
    let chaves = r.chaves();
    let mut esperado: Vec<String> = CHAVES.iter().map(|s| s.to_string()).collect();
    assert_eq!(chaves.len(), esperado.len(), "ordem/quantidade de chaves");
    let mut vistos: Vec<String> = Vec::new();
    for c in &chaves {
        assert!(!vistos.contains(c), "chave duplicada: {c}");
        vistos.push(c.clone());
    }
    // A ordem de emissao e a congelada no teste (paridade pos-ordenacao tambem).
    esperado.sort();
    let mut reais = chaves.clone();
    reais.sort();
    assert_eq!(esperado, reais, "conjunto de chaves do rex-cfg-med/v1");
}

#[test]
fn medir_recusa_flags_de_analyze_que_nao_sao_do_export() {
    // --md / --region-prov / --root-evidence / --site: a assinatura de `medir`
    // e a do objeto plano; flags alheias sao erro de uso, nunca ignoradas.
    for extra in [
        vec!["--md", "/dev/null"],
        vec!["--region-prov", "texto"],
        vec!["--root-evidence", "texto"],
        vec!["--site", "0x08"],
    ] {
        let r = medir(FIX11, REG_11, &[("0x08", "candidato")], &extra);
        assert_eq!(r.code, 2, "{extra:?} deveria ser erro de uso: {}", r.stderr);
        assert!(r.bruto.is_empty(), "{extra:?} escreveu saida com erro");
    }
}

#[test]
fn saida_deterministica_entre_duas_execucoes() {
    let a = raiz_b();
    let b = raiz_b();
    ok(&a);
    ok(&b);
    assert_eq!(a.bruto, b.bruto, "byte a byte, duas execucoes");
}
