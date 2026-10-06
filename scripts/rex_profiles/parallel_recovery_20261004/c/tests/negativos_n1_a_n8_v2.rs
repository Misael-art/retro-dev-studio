//! ETAPA 3 §5 (obrigação 7) — negativos independentes N1..N8.
//!
//! Nenhum valor esperado aqui sai do decoder. As três fontes usadas são as que
//! `EXPECTATIONS-ETAPA3.md §5` autoriza:
//!
//!   (i)  o instrumento pinado — `fixtures/fx12_absW-objdump.txt` (montado por
//!        `as -m68000` + `ld -Ttext 0`, receita `tools/make-fixtures.sh`) e as
//!        leituras do `objdump -b binary -m m68k -D` / `as -m68000` reproduzidas
//!        em `tools/sonda-as-68000.sh`;
//!   (ii) a referência primária — M68000PRM §2.2.16/§2.2.17 (Q1→Q2) e a UM §3
//!        (Q3 = 24 bits do barramento), transcritas na tabela §1.2;
//!   (iii) bytes construídos com `.short`/`.word` que o montador não produziria
//!        (ilhas, arestas de região, caminhos não alcançados).
//!
//! Cada teste registra no comentário **a mudança de produção que o faria
//! falhar**: é isso que torna o negativo discriminante em vez de espelho da
//! implementação.

use rex_cfg::decode::{decode_at, Flow, FrontierKind, Outcome};
use rex_cfg::grafo::{analisar, RaizDeclarada, Status};
use rex_cfg::sitio::{consultar, Pedido};
use rex_gameplay::json::Json;
use std::path::Path;

// ---------------------------------------------------------------------------
// infraestrutura
// ---------------------------------------------------------------------------

/// Words separadas por espaço → bytes big-endian (oráculo iii).
fn bytes_de(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .map(|t| u16::from_str_radix(t, 16).unwrap_or_else(|_| panic!("token invalido {t}")))
        .flat_map(|w| [(w >> 8) as u8, w as u8])
        .collect()
}

fn h(v: u32) -> String {
    format!("0x{v:06X}")
}

fn fixture_bytes(nome: &str) -> Vec<u8> {
    let p = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join(format!("{nome}.bin"));
    std::fs::read(&p).unwrap_or_else(|e| panic!("ler {}: {e}", p.display()))
}

/// Despacho pelo caminho canônico (`rex_cfg::sitio::consultar`, a mesma função
/// que a CLI chama). `origin` desloca o buffer, de modo que endereço == índice,
/// como a CLI faz com `--origin`. `raizes` são pares (endereço, procedência).
fn sitio(arquivo: &[u8], origin: u32, regiao: (u32, u32), raizes: &[(u32, &str)], s: u32) -> Json {
    let mut buf: Vec<u8> = vec![0; origin as usize];
    buf.extend_from_slice(arquivo);
    let declaradas: Vec<RaizDeclarada> = raizes
        .iter()
        .map(|(e, p)| RaizDeclarada {
            endereco: *e,
            proveniencia: (*p).to_string(),
            evidencia: None,
        })
        .collect();
    let p = Pedido {
        buf: &buf,
        arquivo,
        origin,
        regiao,
        raizes: &declaradas,
        sitio: s,
        max_insn: 5000,
    };
    consultar(&p).unwrap_or_else(|e| panic!("consultar {s:#x}: {e}"))
}

fn campo_str(j: &Json, k: &str) -> Option<String> {
    match j.get(k) {
        None => panic!("chave {k} ausente: {}", j.pretty()),
        Some(Json::Null) => None,
        Some(v) => Some(
            v.as_str()
                .unwrap_or_else(|e| panic!("{k}: {e}"))
                .to_string(),
        ),
    }
}

fn campo_int(j: &Json, k: &str) -> Option<i64> {
    match j.get(k) {
        None => panic!("chave {k} ausente: {}", j.pretty()),
        Some(Json::Null) => None,
        Some(v) => Some(v.as_i64().unwrap_or_else(|e| panic!("{k}: {e}"))),
    }
}

fn motivos(j: &Json) -> Vec<String> {
    j.get("motivos")
        .unwrap_or_else(|| panic!("motivos ausente: {}", j.pretty()))
        .as_arr()
        .unwrap_or_else(|e| panic!("motivos: {e}"))
        .iter()
        .map(|v| {
            v.as_str()
                .unwrap_or_else(|e| panic!("motivo: {e}"))
                .to_string()
        })
        .collect()
}

fn limites(j: &Json) -> Vec<String> {
    j.get("limites")
        .unwrap_or_else(|| panic!("limites ausente"))
        .as_arr()
        .unwrap_or_else(|e| panic!("limites: {e}"))
        .iter()
        .map(|v| {
            v.as_str()
                .unwrap_or_else(|e| panic!("limite: {e}"))
                .to_string()
        })
        .collect()
}

/// O bloco de endereço inteiro. Se qualquer campo dele traz valor, o sítio está
/// publicando um operando — e sem instrução provada não há operando, só payload.
const BLOCO_ENDERECO: &[&str] = &[
    "operando-bruto",
    "endereco-efetivo",
    "endereco-de-barramento",
    "forma-do-operando",
    "semantica-do-operando",
    "fonte-da-semantica",
];

fn bloco_inteiro_nulo(j: &Json, rotulo: &str) {
    for k in BLOCO_ENDERECO {
        assert_eq!(
            campo_str(j, k),
            None,
            "{rotulo}: {k} publicado sem instrucao provada no sítio — payload de outra \
             instrucao virou operando: {}",
            j.pretty()
        );
    }
    assert_eq!(
        campo_int(j, "offset-de-objeto"),
        None,
        "{rotulo}: Q4 sobre payload"
    );
}

// ---------------------------------------------------------------------------
// N1 — os oito operandos absolutos do fixture conferidos contra o alvo que o
// instrumento IMPRIME (oráculo i). Discrimina: qualquer regressão do `(xxx).W`
// para zero-extensão muda Q2 e Q3 em bit15 = 1; o comparando é o número que o
// objdump pinado escreveu no corpus versionado, não uma conta desta entrega.
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct LinhaDoInstrumento {
    endereco: u32,
    words: Vec<u16>,
    alvo: u32,
}

/// Lê `fx12_absW-objdump.txt`: `   0:\t4eb8 8000     \tjsr ffff8000 <_end+…>`.
fn ler_referencia_do_instrumento() -> Vec<LinhaDoInstrumento> {
    let p = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join("fx12_absW-objdump.txt");
    let texto = std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("ler {}: {e}", p.display()));
    let mut saida = Vec::new();
    for linha in texto.lines() {
        let campos: Vec<&str> = linha.split('\t').collect();
        if campos.len() < 3 || !campos[0].trim_end().ends_with(':') {
            continue;
        }
        let endereco = match u32::from_str_radix(campos[0].trim().trim_end_matches(':'), 16) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let words: Vec<u16> = campos[1]
            .split_whitespace()
            .filter_map(|t| u16::from_str_radix(t, 16).ok())
            .collect();
        let mut it = campos[2].split_whitespace();
        let _mnem = it.next();
        // só linhas com número de alvo; `rts`/`nop` não têm operando
        let alvo = match it.next() {
            Some(t) => match u32::from_str_radix(t.split('<').next().unwrap_or(t), 16) {
                Ok(v) => v,
                Err(_) => continue,
            },
            None => continue,
        };
        if words.is_empty() {
            continue;
        }
        saida.push(LinhaDoInstrumento {
            endereco,
            words,
            alvo,
        });
    }
    saida
}

#[test]
fn n1_os_oito_absolutos_de_fx12_batem_com_o_alvo_do_instrumento() {
    let arquivo = fixture_bytes("fx12_absW");
    let linhas = ler_referencia_do_instrumento();
    assert_eq!(
        linhas.len(),
        8,
        "fx12_absW-objdump.txt tem de trazer as 8 transferencias absolutas de §5: {linhas:?}"
    );

    // origin alto: os alvos `0x1` e `0x7FFF` caem FORA da janela declarada, de
    // modo que nenhum corpo de rotina inventado seja alcançado (§1.3).
    let origem = 0x0008_0000u32;
    let regiao = (origem, origem + arquivo.len() as u32);

    for l in &linhas {
        let s = origem + l.endereco;
        let j = sitio(&arquivo, origem, regiao, &[(s, "candidato")], s);
        let word = l.words[0];
        assert!(
            matches!(word, 0x4EB8 | 0x4EF8),
            "{s:#08x}: esperado JSR/JMP (xxx).W, instrumento imprimiu {word:#06x}"
        );
        let bruto = u32::from(l.words[1]);
        let q2 = l.alvo; // o número do instrumento, não uma conta daqui
        let q3 = q2 & 0x00FF_FFFF;

        assert_eq!(
            campo_str(&j, "operando-bruto").as_deref(),
            Some(h(bruto).as_str()),
            "{s:#08x}: Q1 e a word como esta no objeto"
        );
        assert_eq!(
            campo_str(&j, "endereco-efetivo").as_deref(),
            Some(h(q2).as_str()),
            "{s:#08x}: Q2 tem de ser o alvo que o instrumento imprime"
        );
        assert_eq!(
            campo_str(&j, "alvo").as_deref(),
            Some(h(q2).as_str()),
            "{s:#08x}: E1-4 — alvo == Q2, nunca a word zero-estendida"
        );
        assert_eq!(
            campo_str(&j, "endereco-de-barramento").as_deref(),
            Some(h(q3).as_str()),
            "{s:#08x}: Q3 == Q2 & 0x00FFFFFF (UM §3)"
        );
        assert_eq!(campo_int(&j, "instrucao-tam"), Some(4), "{s:#08x}: tam");
        assert_eq!(
            campo_str(&j, "forma-do-operando").as_deref(),
            Some("abs-w"),
            "{s:#08x}: forma"
        );
        assert_eq!(
            campo_str(&j, "semantica-do-operando").as_deref(),
            Some("sign-estendida"),
            "{s:#08x}: E1-5"
        );
        assert_eq!(
            campo_str(&j, "fonte-da-semantica").as_deref(),
            Some("M68000PRM 2.2.16"),
            "{s:#08x}: E1-5"
        );
        assert_eq!(
            campo_str(&j, "veredito").as_deref(),
            Some("instrucao-de-bloco"),
            "{s:#08x}: veredito"
        );
        if bruto & 0x8000 != 0 {
            assert_ne!(
                campo_str(&j, "alvo").as_deref(),
                Some(h(bruto).as_str()),
                "{s:#08x}: a hipotese aposentada (zero-extensao) publicaria {}",
                h(bruto)
            );
        }
    }
}

// ---------------------------------------------------------------------------
// N2 — truncagem de barramento. Discrimina: aplicar Q4 sobre Q3 (espelho
// inventado) em vez de sobre Q2.
// ---------------------------------------------------------------------------

#[test]
fn n2_a_word_ffff_da_q2_ffffffff_q3_00ffffff_e_nao_inventa_offset() {
    let arquivo = fixture_bytes("fx12_absW");
    let origem = 0x0008_0000u32;
    let regiao = (origem, origem + arquivo.len() as u32);
    // 0x04 = `4eb8 ffff` = jsr (0xFFFF).w (medido no objdump do fixture).
    let s = origem + 0x04;
    let j = sitio(&arquivo, origem, regiao, &[(s, "candidato")], s);
    assert_eq!(campo_str(&j, "operando-bruto"), Some(h(0xFFFF)));
    assert_eq!(campo_str(&j, "endereco-efetivo"), Some(h(0xFFFF_FFFF)));
    assert_eq!(
        campo_str(&j, "endereco-de-barramento"),
        Some(h(0x00FF_FFFF)),
        "Q3 e Q2 mascarado, nao uma segunda leitura do sinal"
    );
    assert_eq!(campo_int(&j, "offset-de-objeto"), None);
    assert_eq!(
        campo_str(&j, "offset-de-objeto-status").as_deref(),
        Some("fora-do-objeto")
    );
    for esperado in [
        "bus-24-bits-mc68000",
        "offset-de-objeto-so-com-mapeamento-declarado",
    ] {
        assert!(
            limites(&j).iter().any(|l| l == esperado),
            "limites sem {esperado}: {:?}",
            limites(&j)
        );
    }
}

/// O caso que discrimina de verdade: a janela declarada cobre **Q3** (`0xFF8000`)
/// mas não **Q2** (`0xFFFF8000`). Se Q4 fosse calculado sobre Q3 — o espelho de
/// 24 bits que §1.2 proíbe confundir com endereço de arquivo — o campo sairia
/// `0x20` com status `dentro-do-objeto`.
#[test]
fn n2_b_o_offset_e_calculado_sobre_q2_e_nao_sobre_o_espeho_de_24_bits() {
    let arquivo = fixture_bytes("fx12_absW");
    let origem = 0x00FF_7FE0u32;
    let regiao = (origem, origem + arquivo.len() as u32);
    assert!(
        origem <= 0x00FF_8000 && 0x00FF_8000 < regiao.1,
        "precondicao do teste: Q3 dentro da janela"
    );
    let j = sitio(&arquivo, origem, regiao, &[(origem, "candidato")], origem);
    assert_eq!(campo_str(&j, "operando-bruto"), Some(h(0x8000)));
    assert_eq!(campo_str(&j, "endereco-efetivo"), Some(h(0xFFFF_8000)));
    assert_eq!(
        campo_str(&j, "endereco-de-barramento"),
        Some(h(0x00FF_8000)),
        "Q3 continua publicavel: e a truncagem declarada do modelo, nao um offset"
    );
    assert_eq!(
        campo_int(&j, "offset-de-objeto"),
        None,
        "Q4 sobre Q3 daria offset 0x20 e status dentro-do-objeto"
    );
    assert_eq!(
        campo_str(&j, "offset-de-objeto-status").as_deref(),
        Some("fora-do-objeto")
    );
}

// ---------------------------------------------------------------------------
// N3 — arestas de região. Discrimina: off-by-one em `regiao.1` (tratar `fim`
// como inclusivo) e descartar em silêncio a aresta que bate na fronteira.
// ---------------------------------------------------------------------------

#[test]
fn n3_uma_janela_pequena_trata_fim_como_exclusivo_e_lista_a_aresta() {
    // Quatro `jmp (xxx).L` com alvos exatamente inicio, inicio+2, fim-2 e fim.
    // Construídos (§5 oráculo iii): o montador não produziria esta sequência,
    // que não tem símbolo para nenhum dos alvos. A janela vai de 0x100 a 0x118 —
    // exatamente depois do quarto jmp — para que `fim` caia num byte real do
    // objeto (o `rts` de 0x118) e o teste de aresta não vire artefato de
    // preenchimento.
    let arquivo = bytes_de("4EF9 0000 0100  4EF9 0000 0102  4EF9 0000 0116  4EF9 0000 0118  4E75");
    let (ini, fim) = (0x100u32, 0x118u32);
    assert_eq!(arquivo.len(), 0x1a, "cofra: 4 jmp de 6 bytes + um rts");

    for (s, alvo, esperado) in [
        (0x100u32, 0x100u32, "resolvido"),
        (0x106, 0x102, "resolvido"),
        (0x10c, 0x116, "resolvido"),
        (0x112, 0x118, "fora-da-regiao"),
    ] {
        let j = sitio(&arquivo, ini, (ini, fim), &[(s, "candidato")], s);
        assert_eq!(
            campo_str(&j, "veredito").as_deref(),
            Some("instrucao-de-bloco"),
            "{s:#06x}: {}",
            j.pretty()
        );
        assert_eq!(
            campo_str(&j, "alvo").as_deref(),
            Some(h(alvo).as_str()),
            "{s:#06x}: alvo publicado"
        );
        assert_eq!(
            campo_str(&j, "alvo-status").as_deref(),
            Some(esperado),
            "{s:#06x}: status do alvo {alvo:#06x} com regiao [{ini:#06x},{fim:#06x})"
        );
    }

    // `fim` exclusivo também para o sítio consultado. A raiz tem de ficar
    // DENTRO da janela (`analisar` recusa raiz fora da região — erro de uso,
    // CONTRACT §6): o que está em teste é o grau do sítio, não o da raiz.
    let j = sitio(&arquivo, ini, (ini, fim), &[(ini, "candidato")], fim);
    assert_eq!(
        campo_str(&j, "veredito").as_deref(),
        Some("fora-da-regiao"),
        "sitio == fim tem de ser fora-da-regiao"
    );
    assert_eq!(
        campo_str(&j, "alvo"),
        None,
        "fora-da-regiao nao publica alvo"
    );
    bloco_inteiro_nulo(&j, "sitio == fim");

    // A aresta que bate na fronteira tem de estar LISTADA, não ignorada em
    // silêncio. Mesmo deslocamento do auxiliar `sitio`: endereço == índice, com
    // `origin` 0x100 preenchido antes do corpo.
    let mut buf: Vec<u8> = vec![0; ini as usize];
    buf.extend_from_slice(&arquivo);
    let a = analisar(&buf, &[0x112], (ini, fim), &[0x112], 5000).expect("analisar 0x112");
    let listada = a
        .chamadas
        .iter()
        .any(|c| c.sitio == 0x112 && c.alvo == Some(0x118) && c.status == Status::ForaDaRegiao)
        || a.arestas.iter().any(|e| {
            e.origem == 0x112 && e.alvo == Some(0x118) && e.status == Status::ForaDaRegiao
        });
    assert!(
        listada,
        "aresta 0x112 -> {fim:#06x} desapareceu: chamadas={:?} arestas={:?}",
        a.chamadas
            .iter()
            .map(|c| (c.sitio, c.alvo, c.status.label()))
            .collect::<Vec<_>>(),
        a.arestas
            .iter()
            .map(|e| (e.origem, e.alvo, e.status.label()))
            .collect::<Vec<_>>()
    );
}

// ---------------------------------------------------------------------------
// N4 — interior de instrução. Discrimina: um scanner linear que volte a aceitar
// aparência — a word `4eb8` que É payload de um `jmp (xxx).L` provado não pode
// publicar operando nem alvo.
// ---------------------------------------------------------------------------

#[test]
fn n4_ilhas_o_segundo_word_de_uma_instrucao_real_nao_vira_operando_de_outra() {
    // Ilha A: `4ef9 0000 4eb8` = jmp (0x00004eb8).l — 6 bytes. O word em +4 é
    // `4eb8`, que lido a partir dali decodifica "limpo" como JSR (xxx).W.
    let ilha_a = bytes_de("4EF9 0000 4EB8 4E75");
    let j = sitio(&ilha_a, 0, (0x0, 0xa), &[(0, "referencia-estatica")], 0x4);
    assert_eq!(
        campo_str(&j, "veredito").as_deref(),
        Some("miolo-de-instrucao"),
        "{}",
        j.pretty()
    );
    assert!(
        motivos(&j)
            .iter()
            .any(|m| m == &format!("miolo-de-instrucao:{}", h(0u32))),
        "motivos sem a instrucao cobridora: {:?}",
        motivos(&j)
    );
    assert_eq!(campo_str(&j, "consumidor-validado").as_deref(), Some("nao"));
    assert_eq!(
        campo_str(&j, "promovivel-vinculo-estrutural").as_deref(),
        Some("nao")
    );
    assert_eq!(campo_str(&j, "alvo"), None, "miolo nao publica alvo");
    bloco_inteiro_nulo(&j, "ilha A, word 4eb8 em 0x4");

    // Ilha B: `4eb8 8000 4ef9 …` — o word interno em +2 é o payload `8000`; a
    // instrução provedora mantém o próprio bloco intacto.
    let ilha_b = bytes_de("4EB8 8000 4EF9 0000 1234 4E75");
    let dentro = sitio(&ilha_b, 0, (0x0, 0xc), &[(0, "referencia-estatica")], 0x0);
    assert_eq!(
        campo_str(&dentro, "operando-bruto").as_deref(),
        Some(h(0x8000).as_str())
    );
    assert_eq!(
        campo_str(&dentro, "endereco-efetivo").as_deref(),
        Some(h(0xFFFF_8000).as_str())
    );
    let miolo = sitio(&ilha_b, 0, (0x0, 0xc), &[(0, "referencia-estatica")], 0x2);
    assert_eq!(
        campo_str(&miolo, "veredito").as_deref(),
        Some("miolo-de-instrucao")
    );
    assert_eq!(campo_str(&miolo, "alvo"), None);
    bloco_inteiro_nulo(&miolo, "ilha B, word 8000 em 0x2");
}

// ---------------------------------------------------------------------------
// N5 — caminho não alcançado. Discrimina: promoção por decodificação local — a
// mesma word que N1 prova como instrução, fora de fluxo declarado, não publica
// alvo nem operando.
// ---------------------------------------------------------------------------

#[test]
fn n5_a_mesma_word_absoluta_em_dado_nao_alcancado_nao_publica_alvo() {
    // `rts` na raiz encerra o fluxo; `4eb8 8000` vem depois, como dado.
    let arquivo = bytes_de("4E75 4EB8 8000 4E71 4E71 4E71 4E71 4E75");
    let j = sitio(&arquivo, 0, (0x0, 0x10), &[(0, "referencia-estatica")], 0x2);
    assert_eq!(
        campo_str(&j, "veredito").as_deref(),
        Some("dentro-regiao-nao-alcancado"),
        "{}",
        j.pretty()
    );
    assert_eq!(
        campo_str(&j, "alvo"),
        None,
        "nada alcançado tem alvo comprovado"
    );
    assert_eq!(campo_str(&j, "alvo-status").as_deref(), Some("ausente"));
    assert_eq!(campo_str(&j, "consumidor-validado").as_deref(), Some("nao"));
    assert_eq!(
        campo_str(&j, "promovivel-vinculo-estrutural").as_deref(),
        Some("nao")
    );
    assert!(
        motivos(&j)
            .iter()
            .any(|m| m == "dentro-regiao-nao-alcancado"),
        "motivos: {:?}",
        motivos(&j)
    );
    bloco_inteiro_nulo(&j, "ilha de dados em 0x2");
}

// ---------------------------------------------------------------------------
// N6 — transferências indiretas e modos reservados do grupo `4E`. Discrimina:
// inventar comprimento para ler a extensão de um modo não suportado.
// ---------------------------------------------------------------------------

#[test]
fn n6_indiretos_de_2_bytes_nao_inventam_alvo_nem_extensao() {
    // Oráculo congelado, NÃO a implementação desta entrega:
    //   * `EXPECTATIONS-ETAPA1.md` linha `fx05_indirect` — `jmp (An)` e
    //     `jsr (d16,An)` SAEM COMO PONTO-DE-FRONTEIRA `indirect-opaque`, com
    //     entrada em `chamadas` de `alvo = nulo` e `status = indireto-opaco`;
    //   * `ADENDO-ETAPA2-2026-10-04.md` §4 (M8/M9) — VERIFICADO nos três pinos;
    //   * `EXPECTATIONS-ETAPA3.md` §5 N6 — pede `indireto-opaco` para essas
    //     formas, e nunca "instrução".
    // Medido com o instrumento pinado (`objdump -b binary -m m68k -D`, série em
    // `rds-scratch/xe-c3-neg`): `4e90` -> `jsr %a0@`, `4ed0` -> `jmp %a0@`,
    // ambos 2 bytes e sem extensão. O negativo discriminateiro aqui é o
    // COMPRIMENTO reclamado pela fronteira: 2 bytes, exatamente os do modo.
    for word in [0x4E90u16, 0x4E91, 0x4ED0, 0x4ED7] {
        let buf = bytes_de(&format!("{word:04X} 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert_eq!(f.kind, FrontierKind::IndirectOpaque, "{word:#06x}");
                assert!(!f.motivo.is_empty() && f.motivo.is_ascii(), "{word:#06x}");
                assert_eq!(
                    f.consumo,
                    Some(2),
                    "{word:#06x}: modo sem extensão não pode reclamar mais bytes"
                );
            }
            Outcome::Insn(i) => panic!(
                "{word:#06x}: virou instrucao (`{}`, {} bytes) — a ETAPA 1 congela fronteira \
                 indirect-opaco para esses modos",
                i.mnem, i.len
            ),
        }
    }

    // No objeto de sítio: a precedência congelada na ETAPA 1/2 vale — um endereço
    // que É instrução comprovada mantém `instrucao-de-bloco` mesmo quando a
    // análise registra fronteira ali (`fx_fluxo.rs::fx04_sitio_de_chamada_fora_da_
    // regiao_continua_instrucao_de_bloco`), e o pino `consultar.rs::b6_jmp_d16_pc_
    // nao_produz_alvo_nem_consumidor` fixa exatamente esse par para `4E FA`:
    // veredito `instrucao-de-bloco`, `alvo` nulo, `alvo-status` `indireto-opaco`,
    // nada promovível, motivo único `alvo-nao-comprovado`.
    let arquivo = bytes_de("4E90 4E75 4E71 4E71");
    let j = sitio(&arquivo, 0, (0x0, 0x8), &[(0, "referencia-estatica")], 0x0);
    assert_eq!(
        campo_str(&j, "veredito").as_deref(),
        Some("instrucao-de-bloco"),
        "{}",
        j.pretty()
    );
    assert_eq!(campo_str(&j, "alvo"), None);
    assert_eq!(
        campo_str(&j, "alvo-status").as_deref(),
        Some("indireto-opaco"),
        "{}",
        j.pretty()
    );
    assert_eq!(
        motivos(&j),
        vec!["alvo-nao-comprovado".to_string()],
        "motivos duplicariam a mesma ausencia de alvo (precedente B6)"
    );
    assert_eq!(campo_str(&j, "consumidor-validado").as_deref(), Some("nao"));
    assert_eq!(
        campo_str(&j, "promovivel-vinculo-estrutural").as_deref(),
        Some("nao")
    );
    bloco_inteiro_nulo(&j, "jsr (a0) em 0x0");

    // `jmp (xxx).L` com alvo fora da janela: o alvo É publicado (longword
    // literal comprovado) com status `fora-da-regiao`. A cláusula de §5 N6 que
    // pedia `promovivel: nao` aqui está RETIRADA (ADENDO R-3.6): ela fundia dois
    // graus independentes, e a ETAPA 2 congela o par oposto em
    // `tests/consultar.rs::v1_jsr_abs_l_com_alvo_fora_da_regiao_tem_alvo_
    // comprovado` (alvo-status `fora-da-regiao` **com** consumidor `sim` e
    // promovivel `sim` sob raiz `referencia-estatica`). E5-1 proíbe afrouxar
    // aquela asserção, então o contrato — não a implementação — é que errava.
    // O que discriminia a promoção é a proveniência, e isso fica pino abaixo.
    let longo = bytes_de("4EF9 FFFF 8000 4E75");
    let j = sitio(&longo, 0, (0x0, 0x8), &[(0, "referencia-estatica")], 0x0);
    assert_eq!(
        campo_str(&j, "alvo").as_deref(),
        Some(h(0xFFFF_8000).as_str())
    );
    assert_eq!(
        campo_str(&j, "alvo-status").as_deref(),
        Some("fora-da-regiao")
    );
    assert_eq!(campo_str(&j, "consumidor-validado").as_deref(), Some("sim"));
    assert_eq!(
        campo_str(&j, "promovivel-vinculo-estrutural").as_deref(),
        Some("sim"),
        "a promoción depende só da proveniência da raiz (precedente congelado)"
    );
    let j = sitio(&longo, 0, (0x0, 0x8), &[(0, "candidato")], 0x0);
    assert_eq!(
        campo_str(&j, "promovivel-vinculo-estrutural").as_deref(),
        Some("nao"),
        "mesmos bytes, mesma janela: so a proveniencia muda"
    );
}

/// Os modos do grupo `4E` que o MC68000 **não** implementa: `#imediato` e os
/// registradores reservados `%101..%111` do modo `%111`. Medido com o instrumento
/// pinado (série `rds-scratch/xe-c3-neg`): `4ebc`, `4efc`, `4efd`, `4efe`, `4eff`
/// saem do `objdump -m m68k` como `.short` — o instrumento também não lê extensão
/// alguma. §5 N6 pede consumo de extensões **só onde a forma é documentada**, e o
/// oráculo (i)+(ii) não autoriza comprimento nenhum aqui.
///
/// Discrimina: a fronteira reclamar bytes que o modo não tem — um `consumo` não
/// nulo numa forma que o instrumento imprime como `.short` faria o scan pular
/// payload alheio e reabrir a porta que a ETAPA 2 fechou.
#[test]
fn n6_b_formas_reservadas_do_grupo_4e_nao_reclamam_bytes() {
    for word in [
        0x4EBCu16, 0x4EBD, 0x4EBE, 0x4EBF, 0x4EFC, 0x4EFD, 0x4EFE, 0x4EFF,
    ] {
        let buf = bytes_de(&format!("{word:04X} 4E71 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert!(!f.motivo.is_empty(), "{word:#06x}: recusa sem motivo");
                assert!(f.motivo.is_ascii(), "{word:#06x}: motivo nao-ASCII");
                assert_eq!(
                    f.consumo, None,
                    "{word:#06x}: o instrumento le `.short` e a ferramenta reclama bytes"
                );
            }
            Outcome::Insn(i) => panic!(
                "{word:#06x}: o instrumento le `.short` e a ferramenta leu {} bytes (`{}`)",
                i.len, i.mnem
            ),
        }
    }

    // Auto-incremento e auto-decremento são modos documentados do MC68000: a
    // fronteira existe (alvo opaco) mas o comprimento é o do modo, 2 bytes —
    // exatamente o que §5 N6 nomeia como `4e99`…`4e9f`.
    for word in [0x4E99u16, 0x4E9F, 0x4ED9, 0x4EDF] {
        let buf = bytes_de(&format!("{word:04X} 4E71 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert_eq!(f.kind, FrontierKind::IndirectOpaque, "{word:#06x}");
                assert_eq!(f.consumo, Some(2), "{word:#06x}: modo sem extensao");
            }
            other => panic!("{word:#06x}: esperado fronteira, obtido {other:?}"),
        }
    }
}

// ---------------------------------------------------------------------------
// N7 — formas de outra CPU. Discrimina: "consertar" a extensão de sinal trocando
// o subconjunto. As recusas congeladas na ETAPA 2 têm de continuar recusas.
// ---------------------------------------------------------------------------

#[test]
fn n7_formas_de_outra_cpu_continuam_recusadas_apos_a_correcao_do_abs_w() {
    for (hex, rotulo) in [
        ("61FF 0000 1234", "BSR.L 68020 (instrumento: bsrl)"),
        ("67FF 4E71", "Bcc.L 68020"),
        ("4AFC", "ILLEGAL 68010+ (instrumento: illegal)"),
    ] {
        let buf = bytes_de(&format!("{hex} 4E71 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert_eq!(
                    f.kind,
                    FrontierKind::OpcodeForaDoSubconjunto,
                    "{hex} ({rotulo})"
                );
                assert!(
                    !f.motivo.is_empty() && f.motivo.is_ascii(),
                    "{hex}: motivo {:?}",
                    f.motivo
                );
                assert_eq!(f.consumo, None, "{hex}: recusa reclama bytes");
            }
            Outcome::Insn(i) => panic!(
                "{hex} ({rotulo}): reabriu — a ferramenta leu {} bytes (`{}`)",
                i.len, i.mnem
            ),
        }
    }

    // `4efc`/`4efd` pertencem ao grupo `4E` de JSR/JMP: continuam recusa, e o
    // motivo congelado na ETAPA 1/2 (grupo de 52 words do censo §4) tem de ser o
    // mesmo — a correção do `abs.W` não pode ter aberto a porta nem trocado a
    // rótulagem. Medido: o instrumento lê `.short`; a fronteira não reclama
    // bytes.
    for hex in ["4EFC 0000", "4EFD 0000"] {
        let buf = bytes_de(&format!("{hex} 4E71 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert_eq!(
                    f.motivo,
                    "JSR/JMP com alvo nao comprovado (indireto ou PC) - permanece desconhecido",
                    "{hex}: o motivo congelado da ETAPA 1/2 mudou"
                );
                assert_eq!(f.consumo, None, "{hex}: recusa reclama bytes");
            }
            Outcome::Insn(i) => panic!(
                "{hex}: reabriu como instrucao de {} bytes (`{}`)",
                i.len, i.mnem
            ),
        }
    }
}

/// A parte que a varredura §4 não cobre: a **extensão** de um modo indexado com
/// bits 10-8 ≠ 0 é campo de 68020 (escala). Medido nesta rodada: `as -m68000`
/// RECUSA `move.b (%a0,%d0:w:8),…` (`bad expression`) e o objdump genérico lê
/// `11f0 0700` como `moveb %a0@(0,%d0:w:8)`, enquanto `11f0 0000` é o indexado
/// legítimo de 68000. O censo nunca viu essa extensão porque o preenchimento do
/// corpus é `4E71` (bits 10-8 = 0).
///
/// Discrimina: aceitar a extensão indexada só porque o comprimento coincide —
/// leitura de um modo não documentado no subconjunto (E4-4: nada entra na lista).
#[test]
fn n7_a_extensao_indexada_com_escala_nos_bits_10_8_nao_e_suportada() {
    let legitimo = bytes_de("11F0 0000 4E71 4E75");
    match decode_at(&legitimo, 0x1000) {
        Outcome::Insn(i) => assert_eq!(i.len, 6, "indexado de 68000: opcode + extensao"),
        Outcome::Frontier(f) => panic!("indexado legitimo virou recusa: {}", f.motivo),
    }

    for ext in [0x0100u16, 0x0200, 0x0700] {
        let buf = bytes_de(&format!("11F0 {ext:04X} 4E71 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Frontier(f) => {
                assert_eq!(
                    f.kind,
                    FrontierKind::OpcodeForaDoSubconjunto,
                    "ext {ext:#06x}"
                );
                assert!(
                    !f.motivo.is_empty() && f.motivo.is_ascii(),
                    "ext {ext:#06x}"
                );
                assert_eq!(f.consumo, None, "ext {ext:#06x}: recusa reclama bytes");
            }
            Outcome::Insn(i) => panic!(
                "11f0 {ext:04x}: a ferramenta leu {} bytes (`{}`) de um modo com bits 10-8 != 0, \
                 que o as -m68000 recusa (escala 68020)",
                i.len, i.mnem
            ),
        }
    }
}

// ---------------------------------------------------------------------------
// N8 — DBcc: arestas e formas reservadas. Discrimina: a regra `disp8 = 0xFF`
// (Bcc/BSR/BRA, PRM §Bcc) vazando para DBcc (E3-2), e a queda sendo perdida.
// ---------------------------------------------------------------------------

#[test]
fn n8_dbcc_usa_base_sitio_mais_2_e_a_queda_fica_em_sitio_mais_4() {
    // Comprimento e base medidos no instrumento pinado: `51c8 8000` são 4 bytes
    // e o desvio toma `sitio+2` como base. Em 0x1000: 0x1002 − 0x8000 =
    // 0xFFFF9002 (disp16 = −32768) e 0x1002 + 0x7FFF = 0x9001 (disp16 = +32767).
    for (hex, alvo) in [("51C8 8000", 0xFFFF_9002u32), ("51C8 7FFF", 0x0000_9001u32)] {
        let buf = bytes_de(&format!("{hex} 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Insn(i) => {
                assert_eq!(i.len, 4, "{hex}: DBcc tem 4 bytes");
                assert_eq!(i.addr, 0x1000, "{hex}: endereco do sitio");
                match &i.flow {
                    Flow::Branch { taken, has_fall } => {
                        assert_eq!(*taken, alvo, "{hex}: alvo = sitio+2+disp16");
                        assert!(has_fall, "{hex}: DBcc sempre tem queda em sitio+4");
                    }
                    other => panic!("{hex}: fluxo {other:?} — esperado Branch"),
                }
            }
            other => panic!("{hex}: esperado DBcc, obtido {other:?}"),
        }
    }
}

/// `51FF` continua recusa: deslocado, os bits 7-3 de `51FF` são `%11111`, não o
/// `%11001` fixo do formato (PRM §DBcc, format lido na extração sha `a36371ae…`),
/// então a palavra pertence ao espaço `Scc` com destino reservado. Medido: o
/// objdump pinado lê `51ff` como `sf %d7` (2 bytes) e a ferramenta recusa com o
/// motivo da ETAPA 1/2.
///
/// **Retificação §5 N8 (letra `5cca`)** — ver `ADENDO-ETAPA3-2026-10-05.md` R-3.5:
/// a cláusula que pedia `5CCA` recusado é retirada, porque conflita com duas
/// evidências anteriores e publicadas: o corpus congelado `fx03_dbcc.s` contém
/// `dbge %d5,f1` = `5CCD fff6` e o teste `fx03_dbcc_tem_duas_arestas_e_bate_com_o_
/// instrumento` o compara ao objdump; e o instrumento pinado lê `5CC8/5CCA/5EC8/
/// 5FC8` como DBcc de 4 bytes. Recusá-los criaria divergência crítica contra o
/// árbitro escolhido em §4. O que fica **pinado** aqui é a divergência de ISA, em
/// vez de apagada: o formato MC68000 fixa bit11 = 0 e tem campo de condição de
/// 3 bits (Tabela 3-19), enquanto o `objdump -m m68k` genérico modela o campo de
/// 4 bits da família inteira. Aceitar essas words é paridade com o instrumento,
/// NÃO afirmação de que o MC68000 as executa.
#[test]
fn n8_reserva_51ff_e_a_divergencia_de_condicao_de_4_bits_fica_pinned() {
    let buf = bytes_de("51FF 0000 4E71 4E75");
    match decode_at(&buf, 0x1000) {
        Outcome::Frontier(f) => {
            assert_eq!(f.kind, FrontierKind::OpcodeForaDoSubconjunto);
            assert!(!f.motivo.is_empty() && f.motivo.is_ascii(), "{}", f.motivo);
            assert_eq!(f.consumo, None, "recusa reclama bytes");
        }
        Outcome::Insn(i) => panic!("51ff: virou instrucao de {} bytes (`{}`)", i.len, i.mnem),
    }

    // O registro da divergência: estas quatro words SAEM como DBcc de 4 bytes,
    // seguindo o instrumento, embora o formato do MC68000 não as contenha. Se a
    // máscara mudar de lado sem retificação datada, este pino falha.
    for (hex, mnem) in [
        ("5CC8 0028", "dbge"),
        ("5CCA 0028", "dbge"),
        ("5EC8 0028", "dbgt"),
        ("5FC8 0028", "dble"),
    ] {
        let buf = bytes_de(&format!("{hex} 4E75"));
        match decode_at(&buf, 0x1000) {
            Outcome::Insn(i) => {
                assert_eq!(i.len, 4, "{hex}: paridade com o instrumento (4 bytes)");
                assert!(
                    i.mnem.starts_with(&format!("{mnem} ")),
                    "{hex}: mnemonico `{}` — esperado `{mnem}`",
                    i.mnem
                );
            }
            other => panic!(
                "{hex}: virou recusa ({other:?}) — isso é divergencia critica contra o \
                 instrumento e exige retificação datada, nao edicao deste pino"
            ),
        }
    }

    // E3-2: a recusa de disp8 = 0xFF pertence a Bcc/BSR/BRA e não pode vazar —
    // `51C8 FF00` (disp16 = 0xFF00) tem de ser lida como DBcc de 4 bytes.
    let buf = bytes_de("51C8 FF00 4E75");
    match decode_at(&buf, 0x1000) {
        Outcome::Insn(i) => assert_eq!(i.len, 4, "51c8 ff00: DBcc de 4 bytes"),
        other => panic!("51c8 ff00: esperado DBcc, obtido {other:?}"),
    }
}
