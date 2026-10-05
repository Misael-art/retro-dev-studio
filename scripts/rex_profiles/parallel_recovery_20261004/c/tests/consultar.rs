//! `rex-cfg consultar` — a barreira de sítios congelada em
//! EXPECTATIONS-ETAPA2.md §5, exercida como processo real.
//!
//! O que este arquivo prova é a DISCRIMINAÇÃO: os mesmos bytes que um
//! escaneador linear promeveria a consumidor (`4eb9`/`4ef9`/`4efa` dentro de
//! dados, no miolo de outra instrução ou num vão não alcançado) recebem
//! `consumidor-validado: "nao"` com motivo estrutural, enquanto uma chamada
//! provada dentro do fluxo recebe `"sim"`. Um verificador que respondesse
//! `"nao"` a tudo passaria nos negativos e falharia aqui: os casos positivos
//! (V1/V2) estão no mesmo arquivo de propósito.
//!
//! V5: as restrições do parser de A são verificadas por um mini-parseador
//! próprio neste teste (objeto único e plano, sem aninhamento, sem chave
//! duplicada, inteiros só dígitos, sem `\u`, ASCII-only). Não se importa o
//! crate de A: ele é read-only e está fora do território desta frente.

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

use rex_gameplay::json::Json;

const FIX10: &str = "fx10isca";
/// `fx10isca.bin` termina em 0x4e (78 bytes): a região cobre cabeça, vão,
/// miolos e a ilha de dados.
const REG_10: &str = "0x0:0x4e";
const FIX11: &str = "fx11assimetrica";
const REG_11: &str = "0x0:0x100";
/// Matriz autoral ETAPA 2 (§1): 140 bytes, regiao `0x0:0x8c`; cada linha tem a
/// sua propria raiz, como em `tests/fx09_matriz.rs`.
const FIX09: &str = "fx09_matriz_isa";
const REG_09: &str = "0x0:0x8c";

/// Formato congelado em §5: endereços saem como cadeias hex (`"0x031DCC"`).
fn h(v: u32) -> String {
    format!("0x{v:06X}")
}

/// Ordem de emissão fixada em EXPECTATIONS-ETAPA2.md §5.
const CHAVES: &[&str] = &[
    "schema",
    "ferramenta",
    "versao",
    "base-sha",
    "objeto-sha256",
    "objeto-tamanho",
    "regiao-inicio",
    "regiao-fim",
    "raizes",
    "proveniencias",
    "sitio",
    "veredito",
    "bloco",
    "instrucao-tam",
    "instrucao-classe",
    "instrucao-mnem",
    "alvo",
    "alvo-status",
    "consumidor-validado",
    "promovivel-vinculo-estrutural",
    "motivos",
    "limites",
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
    fn opcoes(&self, chave: &str) -> Option<String> {
        let j = self.json();
        match j.get(chave) {
            None => panic!("chave {chave} ausente\n{}", self.bruto),
            Some(Json::Null) => None,
            Some(Json::Str(s)) => Some(s.clone()),
            Some(outra) => panic!("{chave}: esperado Str|Null, obtido {outra:?}"),
        }
    }
    /// `instrucao-tam` é contagem: inteiro decimal ou null (§5).
    fn tam(&self) -> Option<i64> {
        let j = self.json();
        match j.get("instrucao-tam") {
            None => panic!("instrucao-tam ausente\n{}", self.bruto),
            Some(Json::Null) => None,
            Some(Json::Int(n)) => Some(*n),
            Some(outra) => panic!("instrucao-tam: esperado Int|Null, obtido {outra:?}"),
        }
    }
    fn motivos(&self) -> Vec<String> {
        self.lista("motivos")
    }
}

fn ok(r: &Rodada) {
    assert_eq!(
        r.code, 0,
        "esperado 0, obtido {}\nstdout: {}\nstderr: {}",
        r.code, r.stdout, r.stderr
    );
}

/// Invoca `rex-cfg consultar` e devolve o JSON bruto escrito em `--out`.
fn consultar(nome: &str, regiao: &str, raizes: &[(&str, &str)], sitio: &str) -> Rodada {
    let dir = dir_unico("consultar");
    let out = dir.join("sitio.json");
    let mut argv: Vec<String> = vec![
        "consultar".into(),
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
    argv.extend_from_slice(&[
        "--site".to_string(),
        sitio.to_string(),
        "--out".to_string(),
        out.display().to_string(),
    ]);
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

// ---------------------------------------------------------------------------
// V1 — o caminho positivo: chamada provada, dentro de fluxo, alvo comprovado
// ---------------------------------------------------------------------------

#[test]
fn v1_chamada_provada_dentro_de_fluxo_diz_sim() {
    // fx10: 0x02 = `6100 0024` bsr.w 0x28 (comisco), alcancado de cabeca (0x00).
    let r = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x2");
    ok(&r);
    assert_eq!(r.texto("schema"), "rex-cfg-sitio/v1");
    assert_eq!(r.texto("ferramenta"), "rex-cfg");
    assert_eq!(r.texto("versao"), "0.1.0");
    assert_eq!(
        r.texto("base-sha"),
        "cb56657a142df40d2acd09a3e03e54247f066dea"
    );
    assert_eq!(r.texto("regiao-inicio"), h(0x00));
    assert_eq!(r.texto("regiao-fim"), h(0x4e));
    assert_eq!(r.texto("sitio"), h(0x02));
    assert_eq!(r.lista("raizes"), vec![h(0x00)]);
    assert_eq!(r.lista("proveniencias"), vec!["referencia-estatica"]);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.opcoes("bloco").as_deref(), Some(h(0x00).as_str()));
    assert_eq!(r.tam(), Some(4));
    assert_eq!(r.texto("instrucao-classe"), "bsr");
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x28).as_str()));
    assert_eq!(r.texto("alvo-status"), "resolvido");
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "sim");
    assert_eq!(r.motivos(), Vec::<String>::new(), "sem motivo sem falha");
}

#[test]
fn v1_jsr_abs_l_com_alvo_fora_da_regiao_tem_alvo_comprovado() {
    // fx11: 0x0e = `4eb9 0000 0128` jsr (xxx).L. O alvo e comprovado (longword
    // literal, igual ao instrumento: `jsr 128 <longe_b>`); o status informa que
    // nao e navegavel intra-regiao.
    let r = consultar(FIX11, REG_11, &[("0x8", "referencia-estatica")], "0xe");
    ok(&r);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.texto("instrucao-classe"), "jsr");
    assert_eq!(r.tam(), Some(6));
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x128).as_str()));
    assert_eq!(r.texto("alvo-status"), "fora-da-regiao");
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "sim");
    let j = r.json();
    assert_eq!(
        j.get("objeto-sha256").and_then(|v| v.as_str().ok()),
        Some("83d3b9918b40c16433037709d78dad59dcb524a009b6f24eb1a1fdad9d0edcb2"),
        "identidade do objeto faz parte da resposta"
    );
    assert_eq!(
        j.get("objeto-tamanho").and_then(|v| v.as_i64().ok()),
        Some(300)
    );
}

// ---------------------------------------------------------------------------
// V2 — proveniência é porta de promoção, não enfeite
// ---------------------------------------------------------------------------

#[test]
fn v2_raiz_candidato_nao_promove_vinculo_estrutural() {
    // MESMA instrução, MESMA região; só a proveniência da raiz muda. `candidato`
    // e o grau da raiz declarada pelo operador (CONTRACT §1).
    let r = consultar(FIX10, REG_10, &[("0x0", "candidato")], "0x2");
    ok(&r);
    assert_eq!(
        r.texto("consumidor-validado"),
        "sim",
        "a estrutura nao depende da proveniencia: {}\n{}",
        r.stdout,
        r.bruto
    );
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
    assert!(
        r.motivos()
            .iter()
            .any(|m| m.starts_with("proveniencia-nao-autoriza-vinculo")),
        "motivos sem a razao de promocao: {:?}",
        r.motivos()
    );
    assert!(
        r.lista("limites")
            .contains(&"raiz-declarada-nao-promovida".to_string()),
        "limites sem o aviso de nao-promocao: {:?}",
        r.lista("limites")
    );
}

#[test]
fn v2_vetor_plataforma_promove() {
    let r = consultar(FIX10, REG_10, &[("0x0", "vetor-plataforma")], "0x2");
    ok(&r);
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "sim");
}

// ---------------------------------------------------------------------------
// V3 / B2 / B3 / B4 — dado, miolo de instrução e sítio ímpar
// ---------------------------------------------------------------------------

#[test]
fn b2_isca_em_dado_nao_alcancado_e_nega_com_veredito() {
    // ilha_de_dados: 0x34 `4ef9 00011234`, 0x3a `4eb9 00011236`,
    // 0x48 `41f9 0000abcd`. Todas "decodificam limpas" para um escaneador
    // linear; nenhuma esta em fluxo a partir de 0x00.
    for sitio in [0x34u32, 0x3a, 0x48] {
        let r = consultar(
            FIX10,
            REG_10,
            &[("0x0", "referencia-estatica")],
            &format!("{sitio:#x}"),
        );
        ok(&r);
        assert_eq!(
            r.texto("veredito"),
            "dentro-regiao-nao-alcancado",
            "sitio {sitio:#x}: {}",
            r.bruto
        );
        assert_eq!(r.texto("consumidor-validado"), "nao");
        assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
        assert_eq!(r.opcoes("alvo"), None, "sitio {sitio:#x} sem alvo");
        assert_eq!(r.texto("alvo-status"), "ausente");
        assert_eq!(r.opcoes("bloco"), None);
        assert_eq!(r.tam(), None);
        assert!(
            r.motivos()
                .iter()
                .any(|m| m == "dentro-regiao-nao-alcancado"),
            "motivos sem o veredito: {:?}\n{}",
            r.motivos(),
            r.bruto
        );
    }
    // idem na ilha do vao, pulada pelo bra.w da cabeça
    let r = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0xa");
    ok(&r);
    assert_eq!(r.texto("veredito"), "dentro-regiao-nao-alcancado");
    assert_eq!(r.texto("consumidor-validado"), "nao");
}

#[test]
fn b3_isca_no_miolo_de_instrucao_provada_e_nega_com_miolo() {
    // 0x28 = `942c 4efc` subb %a4@(20220),%d2   -> miolo em 0x2a (word 4efc)
    // 0x2c = `223c 1234 4eb9` move.l #imm32,%d1 -> miolo em 0x30 (word 4eb9)
    // O bloco provedor dos dois e o de 0x28 (comisco): os dois miolos estao na
    // mesma corrida, e o motivo aponta a instrucao que cobre.
    for (sitio, cobridora) in [(0x2au32, 0x28u32), (0x30, 0x2c)] {
        let r = consultar(
            FIX10,
            REG_10,
            &[("0x0", "referencia-estatica")],
            &format!("{sitio:#x}"),
        );
        ok(&r);
        assert_eq!(
            r.texto("veredito"),
            "miolo-de-instrucao",
            "sitio {sitio:#x}"
        );
        assert_eq!(r.texto("consumidor-validado"), "nao");
        assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
        assert_eq!(r.opcoes("alvo"), None);
        assert_eq!(r.opcoes("bloco").as_deref(), Some(h(0x28).as_str()));
        let esperado = format!("miolo-de-instrucao:{}", h(cobridora));
        assert!(
            r.motivos().contains(&esperado),
            "motivos sem a cobridora {esperado}: {:?}\n{}",
            r.motivos(),
            r.bruto
        );
    }
}

#[test]
fn b3_a_word_4eb9_no_miolo_gera_zero_chamadas() {
    // O ponto duro da barreira: de 0x30 em diante os bytes sao `4eb9 4e75 …`,
    // que lidos a partir dali decodificam "limpos" como jsr (xxx).L. A analise
    // a partir da raiz declarada nao pode registrar instrucao nem chamada ali.
    let r = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x30");
    ok(&r);
    assert_eq!(r.texto("veredito"), "miolo-de-instrucao");
    assert_eq!(r.opcoes("instrucao-classe"), None);
    assert_eq!(r.opcoes("instrucao-mnem"), None);
    assert_eq!(r.tam(), None);
    assert_eq!(r.texto("consumidor-validado"), "nao");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
}

#[test]
fn v3_sitio_impar_nunca_e_instrucao_de_bloco() {
    // 0x2b: impar e dentro de `942c 4efc` (0x28, tam 4).
    let r = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x2b");
    ok(&r);
    assert_ne!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.texto("consumidor-validado"), "nao");
    assert!(
        r.motivos().iter().any(|m| m == "sitio-impar"),
        "motivos sem sitio-impar: {:?}",
        r.motivos()
    );
}

// ---------------------------------------------------------------------------
// B5 / B6 — raiz declarada sobre a isca: analiza-se, mas não se promove
// ---------------------------------------------------------------------------

#[test]
fn b5_raiz_declarada_sobre_a_isca_nao_promove_grau() {
    // A barreira nao proibe analisar uma raiz declarada; proibe alegar vinculo.
    // 0x34 = `4ef9 00011234`: com raiz ali ha instrucao provada e alvo
    // comprovado, mas a proveniencia `candidato` barra a promocao.
    let r = consultar(FIX10, REG_10, &[("0x34", "candidato")], "0x34");
    ok(&r);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x11234).as_str()));
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
    assert!(r
        .lista("limites")
        .contains(&"raiz-declarada-nao-promovida".to_string()));
    assert_eq!(r.lista("proveniencias"), vec!["candidato".to_string()]);
}

#[test]
fn b5_promocao_so_vem_de_raiz_que_autoriza_vinculo() {
    // Mesma isca com proveniencia que autoriza: o sitio passa a ser promotivel.
    // Se o teste acima falha por excesso de rigor, este falha por frouxido —
    // os dois juntos é que dão sentido ao portão.
    let r = consultar(FIX10, REG_10, &[("0x34", "referencia-estatica")], "0x34");
    ok(&r);
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "sim");
}

#[test]
fn b6_jmp_d16_pc_nao_produz_alvo_nem_consumidor() {
    // 0x40 = `4efa 1234` = jmp d16(PC): forma 68000 valida e FORA da lista
    // fechada. A frente A rotula estes bytes como `jsr abs.w` e publica um
    // alvo inventado. Formulação retificada por ADENDO-ETAPA2 A-2: com a isca
    // declarada raiz, o grafo registra fronteira `indirect-opaque` com ALVO NULO
    // — o negativo duro e "nenhum alvo numerico, nenhuma aresta resolvida,
    // nenhum consumidor", e e isso que se cobra aqui.
    let r = consultar(FIX10, REG_10, &[("0x40", "candidato")], "0x40");
    ok(&r);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.texto("instrucao-classe"), "jmp");
    assert_eq!(
        r.opcoes("alvo"),
        None,
        "4E FA nao pode ter alvo numerico: {}",
        r.bruto
    );
    assert_eq!(r.texto("alvo-status"), "indireto-opaco");
    assert_eq!(r.texto("consumidor-validado"), "nao");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
    assert_eq!(
        r.motivos(),
        vec!["alvo-nao-comprovado".to_string()],
        "motivos duplicariam a mesma ausencia de alvo"
    );
}

#[test]
fn b6_ilha_sem_raiz_declurada_nao_gera_chamadas() {
    // O outro lado de B6, este sem retificacao nenhuma: sem raiz na ilha, os
    // sitos de isca nao tem instrucao, nao tem bloco e nao tem chamada.
    for sitio in [0x16u32, 0x40] {
        let r = consultar(
            FIX10,
            REG_10,
            &[("0x0", "referencia-estatica")],
            &format!("{sitio:#x}"),
        );
        ok(&r);
        assert_eq!(r.texto("veredito"), "dentro-regiao-nao-alcancado");
        assert_eq!(r.opcoes("alvo"), None);
        assert_eq!(r.opcoes("bloco"), None);
        assert_eq!(r.texto("consumidor-validado"), "nao");
    }
}

// ---------------------------------------------------------------------------
// §1.1 P-absW — a interpretação de (xxx).W é registro, não veredito
// ---------------------------------------------------------------------------

#[test]
fn pabsw_hiptese_de_extensao_declarada_em_limites() {
    // §1.1: o alvo de `(xxx).W` sai como operando BRUTO sob hipótese declarada.
    // A hipotese tem de ser visivel ao consumidor em todo despacho, senao o
    // campo `alvo` leria como fato.
    let r = consultar(FIX09, REG_09, &[("0x20", "candidato")], "0x20");
    ok(&r);
    assert!(
        r.lista("limites")
            .contains(&"extensao-abs-w-hipotese-zero-extendida".to_string()),
        "limites: {}",
        r.bruto
    );
}

#[test]
fn pabsw_jsr_abs_w_bit15_registra_interpretacao_pendente_sem_mudar_veredito() {
    // 0x20 = `4eb8 8000` = jsr (xxx).W com bit15 ligado. O instrumento EXIBE
    // ffff8000; a ferramenta publica o operando bruto 0x008000. §1.1 congela que
    // isso e `interpretacao-pendente` — nem FAIL nem PASS — e que nenhuma
    // classificacao estrutural pode depender da interpretacao.
    let r = consultar(FIX09, REG_09, &[("0x20", "candidato")], "0x20");
    ok(&r);
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x8000).as_str()));
    assert_eq!(r.texto("alvo-status"), "fora-da-regiao");
    assert!(
        r.motivos()
            .contains(&"interpretacao-pendente:abs-w-bit15".to_string()),
        "motivos: {}",
        r.bruto
    );
    // O resto da resposta nao se move por causa do registro:
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.tam(), Some(4));
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.texto("promovivel-vinculo-estrutural"), "nao");
}

#[test]
fn pabsw_abs_l_alvo_grande_nao_registra_pendencia() {
    // Controle discriminante: 0x3a = `4ef9 00800000` (jmp abs.L, M7) tem alvo com
    // bit ligado e esta FORA da regiao, mas o operando e longword — nao ha
    // questao de extensao. Um registro ancorado em "alvo suspeito/fora da regiao"
    // passaria aqui e no teste de cima; ancorado na FORMA so passa neste conjunto.
    let r = consultar(FIX09, REG_09, &[("0x3a", "candidato")], "0x3a");
    ok(&r);
    assert_eq!(r.texto("alvo-status"), "fora-da-regiao");
    assert!(
        !r.motivos()
            .iter()
            .any(|m| m.starts_with("interpretacao-pendente")),
        "motivos: {}",
        r.bruto
    );
}

// ---------------------------------------------------------------------------
// V1 (iv) — equivalência alvo ↔ operando medido; classe de transferência
// ---------------------------------------------------------------------------

#[test]
fn equivalencia_alvo_igual_ao_operando_medido_para_bsr_word() {
    // fx11 0x0a = `6100 0016`: base 0x0a+2 + 0x16 = 0x22, exatamente o que o
    // instrumento imprime (`bsrw 22 <sub_b>` na referencia versionada).
    let r = consultar(FIX11, REG_11, &[("0x8", "referencia-estatica")], "0xa");
    ok(&r);
    assert_eq!(r.texto("consumidor-validado"), "sim");
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x22).as_str()));
    assert_eq!(r.texto("alvo-status"), "resolvido");
    assert_eq!(r.motivos(), Vec::<String>::new());
}

#[test]
fn equivalencia_sinal_de_deslocamento_negativo() {
    // fx11 0x1a = `51cd ffec` dbra %d5,0x8: 0x1a+2-20 = 0x1e-20 = 0x08.
    // dbra e condicional: nao e consumidor, mas o alvo tem de bater com a
    // extensao de sinal medida pelo instrumento (`dbf %d5,8 <raiz_b>`).
    let r = consultar(FIX11, REG_11, &[("0x8", "referencia-estatica")], "0x1a");
    ok(&r);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.opcoes("alvo").as_deref(), Some(h(0x08).as_str()));
    assert_eq!(r.texto("consumidor-validado"), "nao");
    assert!(
        r.motivos()
            .iter()
            .any(|m| m.starts_with("classe-condicional")),
        "motivos: {:?}",
        r.motivos()
    );
}

#[test]
fn desvio_condicional_nao_e_consumidor() {
    // fx11 0x14 = `6700 0112` beq.w longe_b: alvo comprovado, classe
    // condicional. §5 V1 (iii) so autoriza as familias de transferencia do
    // subconjunto (bsr/jsr/jmp/bra).
    let r = consultar(FIX11, REG_11, &[("0x8", "referencia-estatica")], "0x14");
    ok(&r);
    assert_eq!(r.texto("veredito"), "instrucao-de-bloco");
    assert_eq!(r.texto("consumidor-validado"), "nao");
    assert!(r
        .motivos()
        .iter()
        .any(|m| m.starts_with("classe-condicional")));
}

// ---------------------------------------------------------------------------
// V4 / V5 — formato consumível por A
// ---------------------------------------------------------------------------

#[test]
fn v5_saida_passa_no_parser_de_a_na_ordem_congelada() {
    let r = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x2");
    ok(&r);
    let chaves = validar_plano(&r.bruto);
    assert_eq!(
        chaves,
        CHAVES.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
        "ordem/conjunto de chaves diverge do congelado em §5"
    );
    assert!(
        r.lista("limites")
            .iter()
            .any(|l| l.contains("sem execucao")),
        "limites sem a ressalva de runtime (V4): {:?}",
        r.lista("limites")
    );
}

#[test]
fn v5_duas_invocacoes_iguais_sao_byte_a_byte_identica() {
    let a = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x2");
    let b = consultar(FIX10, REG_10, &[("0x0", "referencia-estatica")], "0x2");
    ok(&a);
    ok(&b);
    assert_eq!(a.bruto, b.bruto, "saida nao deterministica");
    assert!(
        !a.bruto.contains("/home/misael"),
        "caminho absoluto local vazou no export:\n{}",
        a.bruto
    );
    assert!(
        !a.bruto.contains("caminho_declarado"),
        "o objeto plano nao pode carregar caminho\n{}",
        a.bruto
    );
}

#[test]
fn uso_rejeita_zero_ou_dois_sitios() {
    // --site he unico por invocacao (§5). Codigo 2 = erro de uso, ja congelado.
    let dir = dir_unico("uso");
    let out = dir.join("s.json");
    let sem_site = Command::new(bin())
        .args([
            "consultar",
            "--bin",
            &fixture(FIX10),
            "--region",
            REG_10,
            "--root",
            "0x0",
            "--root-prov",
            "candidato",
            "--out",
            out.to_str().unwrap(),
        ])
        .output()
        .expect("binario");
    assert_eq!(sem_site.status.code(), Some(2), "faltando --site");
    let e1 = String::from_utf8_lossy(&sem_site.stderr)
        .lines()
        .next()
        .unwrap_or_default()
        .to_string();
    assert!(
        e1.contains("--site"),
        "erro de uso deveria nomear a flag ausente, nao ser recusa generica de \
         subcomando: {e1}"
    );

    let dois_sitios = Command::new(bin())
        .args([
            "consultar",
            "--bin",
            &fixture(FIX10),
            "--region",
            REG_10,
            "--root",
            "0x0",
            "--root-prov",
            "candidato",
            "--site",
            "0x2",
            "--site",
            "0x34",
            "--out",
            out.to_str().unwrap(),
        ])
        .output()
        .expect("binario");
    assert_eq!(dois_sitios.status.code(), Some(2), "dois --site");
    let e2 = String::from_utf8_lossy(&dois_sitios.stderr)
        .lines()
        .next()
        .unwrap_or_default()
        .to_string();
    assert!(
        e2.contains("--site"),
        "erro de uso deveria nomear o excesso de --site: {e2}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn raiz_fora_do_vocabulario_continua_sendo_erro_de_uso() {
    let r = consultar(FIX10, REG_10, &[("0x0", "observado-em-runtime")], "0x2");
    assert_eq!(r.code, 2, "grau proibido deveria ser erro de uso");
    let primeira = r.stderr.lines().next().unwrap_or_default();
    assert!(
        primeira.contains("proveniencia"),
        "erro de uso deveria nomear a proveniencia, nao o subcomando: {primeira}"
    );
}

// ---------------------------------------------------------------------------
// mini-parseador das restrições de A (V5) — objeto único e plano
// ---------------------------------------------------------------------------

/// Aceita exatamente o que `rex-kosinski-chain` aceita (linhas 80–238 do
/// `src/json.rs` de A, lidas em `~/rds-scratch/a-docs`): um objeto plano no
/// nível superior; valores-cadenas, `null`, inteiro só-dígitos ou lista de
/// cadenas; rejeita objeto aninhado, chave duplicada, texto sobrante, escape
/// `\u`, sinal/ponto em número e qualquer byte não-ASCII.
fn validar_plano(texto: &str) -> Vec<String> {
    for c in texto.chars() {
        assert!(c.is_ascii(), "byte nao-ASCII no export de sitio: {c:?}");
        assert!(
            !c.is_control() || matches!(c, '\n' | '\r' | '\t'),
            "byte de controle no export: {c:?}"
        );
    }
    assert!(!texto.contains("\\u"), "escape \\u presente\n{texto}");
    let mut p = Plano {
        b: texto.as_bytes(),
        i: 0,
    };
    p.espace();
    let chaves = p.objeto_raiz();
    p.espace();
    assert_eq!(p.i, texto.len(), "texto sobrando depois do objeto");
    chaves
}

struct Plano<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Plano<'a> {
    fn espace(&mut self) {
        while self.i < self.b.len() && self.b[self.i].is_ascii_whitespace() {
            self.i += 1;
        }
    }
    fn atual(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }
    fn come(&mut self, c: u8) {
        self.espace();
        assert_eq!(
            self.atual(),
            Some(c),
            "esperado {:?} em {}\n{}",
            c as char,
            self.i,
            String::from_utf8_lossy(self.b)
        );
        self.i += 1;
    }
    fn objeto_raiz(&mut self) -> Vec<String> {
        self.come(b'{');
        let mut chaves = Vec::new();
        self.espace();
        if self.atual() == Some(b'}') {
            self.i += 1;
            return chaves;
        }
        loop {
            let chave = self.cadena();
            assert!(
                !chaves.contains(&chave),
                "chave duplicada {chave:?} — A rejeita"
            );
            chaves.push(chave);
            self.come(b':');
            self.valor_plano();
            self.espace();
            match self.atual() {
                Some(b',') => self.i += 1,
                Some(b'}') => {
                    self.i += 1;
                    return chaves;
                }
                c => panic!("esperado , ou }} em {}, obtido {c:?}", self.i),
            }
        }
    }
    fn valor_plano(&mut self) {
        self.espace();
        match self.atual() {
            Some(b'{') => panic!("objeto aninhado — o parser de A rejeita"),
            Some(b'[') => self.lista_cadenas(),
            Some(b'"') => {
                self.cadena();
            }
            Some(b'n') => {
                self.tomar(4);
            }
            Some(c) if c.is_ascii_digit() => {
                let ini = self.i;
                while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                    self.i += 1;
                }
                let n = &String::from_utf8_lossy(self.b)[ini..self.i];
                assert!(
                    n.chars().all(|c| c.is_ascii_digit()) && !n.is_empty(),
                    "inteiro com sinal/ponto ({n:?}) — A rejeita"
                );
            }
            c => panic!("valor inesperado em {}, comecando com {c:?}", self.i),
        }
    }
    fn lista_cadenas(&mut self) {
        self.come(b'[');
        self.espace();
        if self.atual() == Some(b']') {
            self.i += 1;
            return;
        }
        loop {
            self.espace();
            assert_eq!(self.atual(), Some(b'"'), "lista de nao-cadenas — A rejeita");
            self.cadena();
            self.espace();
            match self.atual() {
                Some(b',') => self.i += 1,
                Some(b']') => {
                    self.i += 1;
                    return;
                }
                c => panic!("esperado , ou ] em {}, obtido {c:?}", self.i),
            }
        }
    }
    fn tomar(&mut self, n: usize) -> String {
        let ateh = (self.i + n).min(self.b.len());
        let s = String::from_utf8_lossy(&self.b[self.i..ateh]).to_string();
        self.i = ateh;
        s
    }
    fn cadena(&mut self) -> String {
        self.come(b'"');
        let ini = self.i;
        loop {
            assert!(self.i < self.b.len(), "cadena nao terminada");
            match self.b[self.i] {
                b'"' => {
                    let s = String::from_utf8_lossy(&self.b[ini..self.i]).to_string();
                    self.i += 1;
                    return s;
                }
                b'\\' => panic!("escape em cadena — o export nao precisa de nenhum"),
                _ => self.i += 1,
            }
        }
    }
}
