//! ETAPA 3 §5 (obrigacao 7) — `fx13_mascaras`: tabela versionada de palavras do
//! censo §4 com o **veredito do instrumento**, usada como oraculo externo do
//! decodificador.
//!
//! Por que isto existe alem de `mascaras_v2_negativos.rs`: aquele arquivo fixa
//! classes de defeito com rotulos escolhidos a mao, e `varredura_mascaras_v2.rs`
//! fixa os **totais** do censo. Entre os dois nao havia uma tabela por palavra que
//! sobreviva a uma mudanca de mascara: `fixtures/fx13_mascaras.tsv` e essa tabela.
//! Ela e **gerada** (`tools/gerar-fx13-mascaras.sh`) com o `objdump` pinado sobre o
//! mesmo tipo de slot do corpus de §4 (16 bytes: a word e resto `4E71`), e o modo
//! `--check` de `tools/make-fixtures.sh` exige que a mesa receita reproduza o
//! arquivo byte a byte. Uma coluna e autoral (`esperado`, com a `fonte` da
//! referencia primaria ou da sonda do montador); as colunas do instrumento sao
//! medidas, nao lembradas.
//!
//! O teste abaixo e deliberadamente **duas** assercoes por linha:
//!
//!   1. o `esperado` bate com o que o `decode_at` faz hoje — se a mascara mudar de
//!      lado sem retificacao datada, a linha quebra;
//!   2. o `esperado` bate com o **veredito do instrumento** registrado na tabela,
//!      segundo a taxonomia de §4: `leitura=N` so e legitima quando o instrumento
//!      le a word em N bytes (classe (i) = comprimento diferente, classe (ii) =
//!      leitura sobre `.short`, ambas criticas); `recusa` e legitima em qualquer
//!      veredito do instrumento, mas ai a linha tem de ser uma das recusas
//!      declaradas do censo, com fonte citada.
//!
//! A coluna `esperado` tem vocabulario fechado em tres formas:
//!
//!   * `leitura=N` — publicamos instrucao de N bytes;
//!   * `recusa-<classe>` — fronteira declarada, onde `<classe>` e exatamente o
//!     rotulo de `FrontierKind::label()` (`opcode-fora-do-subconjunto`,
//!     `indirect-opaque`, `trap-opaco`, `limite-de-regiao`, `truncada`,
//!     `limite-de-trabalho`). A classe nao e um detalhe de implementacao: e a
//!     alegacao do contrato. `4E90` (`jsr %a0@`) e o caso que obriga o pino — o
//!     opcode esta na lista fechada, o que falta e o alvo, e o censo §4 a coloca
//!     no grupo `PROIBICAO-ESTRUTURAL-0-2` de 52 words, nao como opcode
//!     desconhecido. Uma mascara que passasse a recusar essa word como
//!     `opcode-fora-do-subconjunto` estaria a alegar outra coisa, e a linha quebra.
//!
//! A classe tambem decide se a recusa pode reclamar bytes: `consumo` so e
//! declarado quando o comprimento esta comprovado (`indirect-opaque`), e a linha
//! da tabela pinja qual das duas situacoes vale.
//!
//! Nenhum numero desta tabela vem do decodificador.

use rex_cfg::decode::{decode_at, FrontierKind, Outcome};

const TABELA: &str = "fixtures/fx13_mascaras.tsv";
const SLOT_BYTES: usize = 16;

#[derive(Debug)]
struct Linha {
    slot: u32,
    word: u16,
    esperado: String,
    token: String,
    bytes_instrumento: u16,
    fonte: String,
}

/// Vocabulario explicito da classe de fronteira declarada na tabela. Uma classe
/// fora desta lista e um erro de transcricao da expectativa, nao uma descoberta.
fn classe_declorada(esperado: &str) -> Option<FrontierKind> {
    let rotulo = esperado.strip_prefix("recusa-")?;
    let kinds = [
        FrontierKind::OpcodeForaDoSubconjunto,
        FrontierKind::IndirectOpaque,
        FrontierKind::TrapOpaco,
        FrontierKind::LimiteDeRegiao,
        FrontierKind::Truncada,
        FrontierKind::LimiteDeTrabalho,
    ];
    kinds
        .iter()
        .copied()
        .find(|k| k.label() == rotulo)
        .or_else(|| {
            panic!("`{esperado}`: classe de fronteira fora do vocabulario de FrontierKind::label()")
        })
}

fn tabela() -> Vec<Linha> {
    let caminho = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(TABELA);
    let texto = std::fs::read_to_string(&caminho).unwrap_or_else(|e| {
        panic!("{TABELA}: ausente ({e}) — gere com tools/gerar-fx13-mascaras.sh")
    });
    let mut linhas = Vec::new();
    for (n, mentira) in texto.lines().enumerate() {
        let bruto = mentira.trim();
        if bruto.is_empty() || bruto.starts_with('#') {
            continue;
        }
        let c: Vec<&str> = bruto.split('\t').collect();
        assert_eq!(
            c.len(),
            6,
            "linha {} de {TABELA}: esperava 6 colunas, obtive {} em {mentira:?}",
            n + 1,
            c.len()
        );
        let slot = u32::from_str_radix(c[0].trim_start_matches("0x"), 16)
            .unwrap_or_else(|e| panic!("linha {}: slot {:?} ({e})", n + 1, c[0]));
        let word = u16::from_str_radix(c[1].trim_start_matches("0x"), 16)
            .unwrap_or_else(|e| panic!("linha {}: word {:?} ({e})", n + 1, c[1]));
        let bytes_instrumento = c[4]
            .trim()
            .parse::<u16>()
            .unwrap_or_else(|e| panic!("linha {}: bytes {:?} ({e})", n + 1, c[4]));
        linhas.push(Linha {
            slot,
            word,
            esperado: c[2].trim().to_string(),
            token: c[3].trim().to_string(),
            bytes_instrumento,
            fonte: c[5].trim().to_string(),
        });
    }
    linhas
}

/// Um buffer so, com os slots nas mesmas posicoes relativas da tabela. `decode_at`
/// recebe a **janela** cujo byte 0 esta em `addr` (contrato §6), por isso o corte
/// comeca no proprio slot: e exatamente ali que o instrumento pousou a word, e o
/// vizinho que ele viu (`4E71`) continua na janela.
fn corpus(linhas: &[Linha]) -> Vec<u8> {
    let topo = linhas
        .iter()
        .map(|l| l.slot as usize + SLOT_BYTES)
        .max()
        .unwrap_or(0);
    let mut buf = vec![0u8; topo];
    for l in linhas {
        let i = l.slot as usize;
        buf[i..i + 2].copy_from_slice(&l.word.to_be_bytes());
        let mut j = i + 2;
        while j + 2 <= i + SLOT_BYTES {
            buf[j..j + 2].copy_from_slice(&[0x4E, 0x71]);
            j += 2;
        }
    }
    buf
}

fn rotulo(l: &Linha) -> String {
    format!(
        "{:04x} @slot {:04x} (instrumento: `{}` {}B; esperado `{}`; fonte: {})",
        l.word, l.slot, l.token, l.bytes_instrumento, l.esperado, l.fonte
    )
}

#[test]
fn fx13_a_tabela_existe_e_cobre_as_tres_formas_de_veredito() {
    let l = tabela();
    assert!(
        l.len() >= 24,
        "tabela com {} linhas: subset de §4 tem de ser discriminativo",
        l.len()
    );
    let leituras = l
        .iter()
        .filter(|x| x.esperado.starts_with("leitura="))
        .count();
    let recusas = l
        .iter()
        .filter(|x| x.esperado.starts_with("recusa-"))
        .count();
    assert_eq!(
        leituras + recusas,
        l.len(),
        "linha com `esperado` fora do vocabulario `leitura=N` / `recusa-<classe>`"
    );
    assert!(
        leituras >= 12,
        "{leituras} linhas de leitura — insuficiente para fixar as mascaras"
    );
    assert!(
        recusas >= 8,
        "{recusas} linhas de recusa — insuficiente para fixar as fronteiras"
    );
    // as duas pernas de recusa tem de aparecer: word que o instrumento imprime como
    // `.short` (acordo-recusa) e word que o instrumento LE (recusa-declarada).
    let recusa_curta = l
        .iter()
        .any(|x| x.esperado.starts_with("recusa-") && x.bytes_instrumento == 0);
    let recusa_lida = l
        .iter()
        .any(|x| x.esperado.starts_with("recusa-") && x.bytes_instrumento > 0);
    assert!(
        recusa_curta,
        "nenhuma recusa sobre word que o instrumento imprime como `.short`"
    );
    assert!(
        recusa_lida,
        "nenhuma recusa declarada sobre word que o instrumento le"
    );
    // e tem de haver pelo menos duas classes de fronteira distintas, senao a coluna
    // de classe nao discrimina nada (4E90 e a segunda classe, medida no censo §4).
    let classes: usize = l
        .iter()
        .filter_map(|x| classe_declorada(&x.esperado))
        .map(|k| k.label().to_string())
        .collect::<std::collections::HashSet<String>>()
        .len();
    assert!(
        classes >= 2,
        "{classes} classe(s) de fronteira na tabela: a coluna nao discrimina"
    );
    // slots distintos e alinhados de 16, como no corpus de §4
    let mut slots: Vec<u32> = l.iter().map(|x| x.slot).collect();
    slots.sort_unstable();
    slots.dedup();
    assert_eq!(
        slots.len(),
        l.len(),
        "dois rotulos no mesmo slot: a tabela nao e injetiva"
    );
    for x in &l {
        assert_eq!(
            x.slot % SLOT_BYTES as u32,
            0,
            "{}: slot nao alinhado",
            rotulo(x)
        );
    }
}

#[test]
fn fx13_cada_leitura_bate_com_o_comprimento_e_o_rotulo_do_instrumento() {
    let l = tabela();
    let buf = corpus(&l);
    for x in l.iter().filter(|x| x.esperado.starts_with("leitura=")) {
        let esperado: u16 = x.esperado["leitura=".len()..]
            .parse()
            .unwrap_or_else(|e| panic!("{}: esperado {:?} ({e})", rotulo(x), x.esperado));
        // (2) o `esperado` nao pode contradizer o instrumento: `.short` lido como
        // instrucao nossa e a classe (ii) do censo, e comprimento diferente e a (i).
        assert!(
            !x.token.starts_with('.'),
            "{}: leitura nossa sobre word que o instrumento imprime como {} (classe ii)",
            rotulo(x),
            x.token
        );
        assert_eq!(
            x.bytes_instrumento,
            esperado,
            "{}: comprimento diverge do instrumento (classe i)",
            rotulo(x)
        );
        match decode_at(&buf[x.slot as usize..], x.slot) {
            Outcome::Insn(ins) => {
                assert_eq!(ins.len, esperado, "{}: len nosso", rotulo(x));
                assert_eq!(ins.addr, x.slot, "{}: endereco do sitio", rotulo(x));
                let stem = ins.mnem.split([' ', '(']).next().unwrap_or(&ins.mnem);
                assert_eq!(
                    stem,
                    x.token,
                    "{}: rotulo nosso vs verbo do instrumento",
                    rotulo(x)
                );
            }
            Outcome::Frontier(f) => panic!(
                "{}: virou fronteira {} — {}",
                rotulo(x),
                f.kind.label(),
                f.motivo
            ),
        }
    }
}

#[test]
fn fx13_cada_recusa_declara_a_classe_de_fronteira_bate() {
    let l = tabela();
    let buf = corpus(&l);
    for x in l.iter().filter(|x| x.esperado.starts_with("recusa-")) {
        let esperada = classe_declorada(&x.esperado)
            .unwrap_or_else(|| panic!("{}: classe inexistivel", rotulo(x)));
        match decode_at(&buf[x.slot as usize..], x.slot) {
            Outcome::Frontier(f) => {
                assert_eq!(
                    f.kind,
                    esperada,
                    "{}: classe de fronteira diverge da declarada ({})",
                    rotulo(x),
                    esperada.label()
                );
                assert!(
                    !f.motivo.is_empty(),
                    "{}: recusa sem motivo declaravel (E4-1 iv)",
                    rotulo(x)
                );
                assert!(
                    f.motivo.is_ascii(),
                    "{}: motivo nao-ASCII (regra V5): {}",
                    rotulo(x),
                    f.motivo
                );
                // A reclamação de bytes e **por classe**, e a linha da tabela e o
                // lugar onde isso fica pinado: `consumo` so existe quando o
                // COMPRIMENTO esta comprovado apesar do caminho parar (campo
                // documentado em `src/decode.rs`), e hoje isso vale para
                // `indirect-opaque` — a extensao de modo de `JMP/JSR` e conhecida,
                // o alvo e que nao. Nas demais classes a recusa nao pode reclamar
                // byte nenhum, senão a fronteira estaria a fingir comprimento.
                match esperada {
                    FrontierKind::IndirectOpaque => assert_eq!(
                        f.consumo,
                        Some(x.bytes_instrumento),
                        "{}: fronteira de comprimento comprovado deve reclamar os bytes que o instrumento le",
                        rotulo(x)
                    ),
                    _ => assert_eq!(
                        f.consumo,
                        None,
                        "{}: classe {} nao pode reclamar bytes",
                        rotulo(x),
                        esperada.label()
                    ),
                }
            }
            Outcome::Insn(ins) => panic!(
                "{}: virou instrucao de {} bytes (`{}`) onde a tabela declara recusa",
                rotulo(x),
                ins.len,
                ins.mnem
            ),
        }
    }
}

#[test]
fn fx13_a_fonte_de_cada_linha_aponta_para_um_oraculo() {
    for x in tabela() {
        let f = x.fonte.as_str();
        assert!(
            f.len() >= 8 && f.is_ascii(),
            "{}: fonte precisa de citar oraculo (PRM l./Tabela, sonda `as -m68000`, censo §4 ou contrato §3) em ASCII",
            rotulo(&x)
        );
        let citou = [
            "prm",
            "sonda",
            "censo",
            "contrato",
            "tabela",
            "gas",
            "as -m68000",
        ]
        .iter()
        .any(|k| f.to_ascii_lowercase().contains(k));
        assert!(citou, "{}: fonte sem marcador de oraculo: {f}", rotulo(&x));
    }
}

#[test]
fn fx13_o_cabecalho_fixa_o_instrumento_que_produziu_a_tabela() {
    let caminho = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(TABELA);
    let texto = std::fs::read_to_string(&caminho).expect("tabela legivel");
    let cabecalho: String = texto
        .lines()
        .filter(|l| l.starts_with('#'))
        .collect::<Vec<_>>()
        .join("\n");
    for chave in ["objdump", "61874055", "e3a404cc", "b2f4b455"] {
        // sha do `as` e do `objdump` pinados e o digesto do corpus de §4, de onde os
        // rotulos desta tabela sao subset.
        assert!(
            cabecalho.contains(chave),
            "cabeecalho da tabela nao pinna {chave}"
        );
    }
}
