//! Paridade do decodificador contra o INSTRUMENTO INDEPENDENTE.
//!
//! Os arquivos `fixtures/calib*-objdump.txt` foram produzidos por
//! `m68k-elf-as` + `m68k-elf-objdump` (binutils 2.41 do host) sobre os corpus
//! autorais `fixtures/calib.s` e `fixtures/calib2.s`. Cada registro do objdump
//! é uma afirmação do instrumento sobre (bytes, comprimento, mnemônico, alvo
//! absoluto). Este teste não usa o decodificador para nada além de comparar:
//! round-trip interno próprio não conta como prova (CONTRACT §5).
//!
//! O parser do instrumento está em `tests/support/oracle.rs`, compartilhado com
//! os testes de fluxo.
//!
//! Regra de espera, derivada do contrato e das recusas comprovadas pelo próprio
//! instrumento (mnemônicos que o objdump imprime como recusa/68020, chamadas
//! indiretas e modos PC em MOVE): nesses casos a ferramenta NÃO reclama
//! comprimento — produz fronteira. Em todos os demais casos ela DEVE reproduzir
//! comprimento, família e alvo do instrumento.

#[path = "support/oracle.rs"]
mod oracle;

use oracle::{desvio_disp8_ff, family_of_token, parse_objdump, Rec};
use rex_cfg::decode::{decode_at, Flow, FrontierKind, Outcome};

/// Mnemônicos que o PRÓPRIO instrumento imprime como recusa ou como forma fora
/// do subconjunto 68000 do contrato (§3, §6). A ferramenta deve parar neles.
const INSTRUMENT_REFUSALS: &[&str] = &[
    "trapv", "illegal", "bkpt", "movepw", "movepl", "extw", "extl", "divull", "divsl",
];

enum Expect {
    Insn,
    Frontier(FrontierKind),
}

impl Expect {
    fn is_frontier(&self) -> bool {
        matches!(self, Expect::Frontier(_))
    }
}

/// Único ponto em que o CONTRATO manda parar e o instrumento não para:
/// `disp8 = 0xFF` em desvio. Medido em calib 0x14c, o objdump (alvo genérico do
/// host) imprime `67ff` como `beqs 14d`; em fx02, com outros bytes depois, o
/// MESMO instrumento imprime a mesma palavra como `beql` de 6 bytes. O par de
/// bytes não tem comprimento comprovável, então a ferramenta recusa (CONTRACT
/// §0.3 e §3) e este teste registra e imprime o desvio em vez de fingi-lo
/// concordância.
fn override_de_contrato(rec: &Rec) -> bool {
    desvio_disp8_ff(rec)
}

/// Campos de indice que o 68000 nao tem (escala, displacamento de 16 bits no
/// modo de indice): enderecos de calib2 (unico corpus onde essas formas estao
/// montadas) onde o INSTRUMENTO le a word de extensao com bits10-8 != 0. Medidos no dump versionado: `1031 0108`,
/// `1031 0208` e `d0b9 0208 4e71` (aqui o proprio instrumento passa a ler SEIS
/// bytes e engole o `nop` seguinte — ou seja, o comprimento nao e comprovavel
/// pelo subconjunto). Fora da lista fechada de CONTRACT §3: a ferramenta PARA.
const INDICE_68020: &[u32] = &[0x10c, 0x110, 0x114];

fn expected(rec: &Rec, corpus: &str) -> Expect {
    if rec.token.starts_with('.') {
        return Expect::Frontier(FrontierKind::OpcodeForaDoSubconjunto);
    }
    if override_de_contrato(rec) {
        return Expect::Frontier(FrontierKind::OpcodeForaDoSubconjunto);
    }
    if corpus == "calib2" && INDICE_68020.contains(&rec.addr) {
        return Expect::Frontier(FrontierKind::OpcodeForaDoSubconjunto);
    }
    if INSTRUMENT_REFUSALS.contains(&rec.token.as_str()) {
        return Expect::Frontier(FrontierKind::OpcodeForaDoSubconjunto);
    }
    if (rec.token == "jmp" || rec.token == "jsr")
        && rec.text.split('<').next().unwrap_or("").contains('%')
    {
        return Expect::Frontier(FrontierKind::IndirectOpaque);
    }
    // Operando PC-relativo: os modos PC não estão na lista fechada de §3 (valem
    // para LEA/PEA, que §3 autoriza em modos de memória). Medido no corpus: o
    // instrumento le `movel %pc@(16),%d0` e `addl %pc@(8,%d1:w),%d0` e a
    // ferramenta para neles — limite declarado, nenhum comprimento inventado.
    let fam = family_of_token(&rec.token);
    if rec.text.contains("%pc") && !matches!(fam.as_str(), "lea" | "pea") {
        return Expect::Frontier(FrontierKind::OpcodeForaDoSubconjunto);
    }
    Expect::Insn
}

fn check_dump(nome: &str, dump: &str) {
    let recs = parse_objdump(dump);
    assert!(!recs.is_empty(), "{nome}: parser não encontrou registros");

    // Reconciliação independente do comprimento: delta de endereço até o
    // próximo registro não-continuação deve bater com a contagem de words.
    let addrs: Vec<u32> = recs.iter().map(|r| r.addr).collect();
    for (i, r) in recs.iter().enumerate() {
        if i + 1 < addrs.len() {
            assert_eq!(
                addrs[i + 1] - r.addr,
                r.len,
                "{nome}: em {:#x} o delta de endereços do instrumento não bate com os bytes impressos",
                r.addr
            );
        }
    }

    let mut falhas: Vec<String> = Vec::new();
    let mut instruidas = 0usize;
    let mut fronteiras = 0usize;
    for r in &recs {
        let outcome = decode_at(&r.bytes, r.addr);
        match expected(r, nome) {
            Expect::Frontier(kind) => {
                fronteiras += 1;
                match &outcome {
                    Outcome::Frontier(f) if f.kind == kind => {}
                    Outcome::Frontier(f) => falhas.push(format!(
                        "{:#x} [{}] fronteira esperada {} obtida {} ({})",
                        r.addr,
                        r.text,
                        kind.label(),
                        f.kind.label(),
                        f.motivo
                    )),
                    Outcome::Insn(i) => falhas.push(format!(
                        "{:#x} [{}] esperava fronteira {}, reclamou instrução {} de {} bytes",
                        r.addr,
                        r.text,
                        kind.label(),
                        i.mnem,
                        i.len
                    )),
                }
                continue;
            }
            Expect::Insn => instruidas += 1,
        }
        let familia = family_of_token(&r.token);
        let i = match &outcome {
            Outcome::Insn(i) => i,
            Outcome::Frontier(f) => {
                falhas.push(format!(
                    "{:#x} [{}] esperava instrução de {} bytes, obtido fronteira {} ({})",
                    r.addr,
                    r.text,
                    r.len,
                    f.kind.label(),
                    f.motivo
                ));
                continue;
            }
        };
        if i.addr != r.addr {
            falhas.push(format!(
                "{:#x} [{}] endereço devolvido {} ",
                r.addr, r.text, i.addr
            ));
        }
        if i.len as u32 != r.len {
            falhas.push(format!(
                "{:#x} [{}] comprimento instrumento {} / ferramenta {}",
                r.addr, r.text, r.len, i.len
            ));
        }
        if i.family != familia {
            falhas.push(format!(
                "{:#x} [{}] família instrumento {} / ferramenta {} (mnem {:?})",
                r.addr, r.text, familia, i.family, i.mnem
            ));
        }
        if let Some(alvo) = r.target {
            let obtido = match &i.flow {
                Flow::Branch { taken, .. } => Some(*taken),
                Flow::Call { target } => Some(*target),
                Flow::Jmp { target } => Some(*target),
                _ => None,
            };
            match obtido {
                Some(t) if t == alvo => {}
                Some(t) => falhas.push(format!(
                    "{:#x} [{}] alvo instrumento {:#x} / ferramenta {:#x}",
                    r.addr, r.text, alvo, t
                )),
                None => falhas.push(format!(
                    "{:#x} [{}] instrumento aponta alvo {:#x} e a ferramenta não declara nenhum",
                    r.addr, r.text, alvo
                )),
            }
        }
    }

    let overrides: Vec<String> = recs
        .iter()
        .filter(|r| override_de_contrato(r))
        .map(|r| format!("{:#x} [{}]", r.addr, r.token))
        .collect();
    println!(
        "{nome}: {} registros = {} instruções + {} fronteiras (override de contrato sobre o \
         instrumento em {}: {})",
        recs.len(),
        instruidas,
        fronteiras,
        overrides.len(),
        if overrides.is_empty() {
            "nenhum".into()
        } else {
            overrides.join(", ")
        }
    );
    assert!(
        falhas.is_empty(),
        "{nome}: {} divergências:\n{}",
        falhas.len(),
        falhas.join("\n")
    );
}

#[test]
fn paridade_calib_corpo() {
    check_dump("calib", include_str!("../fixtures/calib-objdump.txt"));
}

#[test]
fn paridade_calib2_memoria_e_fluxo() {
    check_dump("calib2", include_str!("../fixtures/calib2-objdump.txt"));
}

#[test]
fn parser_registra_os_dois_corpus_por_inteiro() {
    // Guarda contra apodrecimento do parser: os dois corpus têm mais de 60
    // registros cada e exatamente as fronteiras conhecidas do instrumento.
    let a = parse_objdump(include_str!("../fixtures/calib-objdump.txt"));
    let b = parse_objdump(include_str!("../fixtures/calib2-objdump.txt"));
    assert!(
        a.len() > 60 && b.len() > 40,
        "parser perdeu registros: {} / {}",
        a.len(),
        b.len()
    );
    let recusa = |recs: &[Rec], corpus: &str, end: u32| {
        recs.iter()
            .any(|r| r.addr == end && expected(r, corpus).is_frontier())
    };
    // Fronteiras medidas no corpus regenerado (2026-10-04): `movepw` em 0x148,
    // o par `67ff` em 0x14c (override de contrato — aqui o instrumento le o
    // triplo `67ff 51ff 4e76` como UMA instrucao `beql` de 6 bytes, entao
    // 0x14e/0x150 nao sao registros proprios), `.short 0xf000` em 0x152 e
    // `illegal` em 0x154. A pinha anterior (0x14c/0x14e/0x150 como tres
    // registros de 2 bytes) veio de uma leitura do instrumento em que os mesmos
    // bytes saiam como `beqs -1`; a divergencia esta registrada no Adendo
    // datado, com a serie bruta do objdump atual.
    for end in [0x148_u32, 0x14c, 0x152, 0x154] {
        assert!(
            recusa(&a, "calib", end),
            "calib: fronteira esperada ausente em {end:#x}"
        );
    }
    // `jmp %a1@` / `jsr %a3@(16)` (indiretos) e recusas 68020/formas fora em calib2
    for end in [0x112_u32, 0x114] {
        assert!(
            a.iter().any(|r| r.addr == end
                && matches!(
                    expected(r, "calib"),
                    Expect::Frontier(FrontierKind::IndirectOpaque)
                )),
            "calib: indireto esperado ausente em {end:#x}"
        );
    }
    assert!(b
        .iter()
        .any(|r| r.addr == 0x36 && expected(r, "calib2").is_frontier())); // extw
    assert!(b
        .iter()
        .any(|r| r.addr == 0xf4 && expected(r, "calib2").is_frontier())); // bkpt
    assert!(b
        .iter()
        .any(|r| r.addr == 0xf6 && expected(r, "calib2").is_frontier())); // movepl
    assert!(b
        .iter()
        .any(|r| r.addr == 0xea && expected(r, "calib2").is_frontier())); // jmp %a1@
}

/// (disp8, tipo do indice, numero, tamanho) do primeiro operando com indice de
/// um texto de mnemonico. O instrumento imprime o displacamento sem prefixo
/// (`@(7f,%a3:l)`) e a ferramenta no seu estilo habitual (`@(0x7f,%a3:l)`):
/// compara-se o CAMPO de 8 bits da word de extensao, que e o que ambos leem.
fn indice_operando(texto: &str) -> Option<(u8, char, u8, char)> {
    let ini = texto.find("@(")?;
    let dentro = texto[ini + 2..].split_once(')')?.0;
    if !dentro.contains('%') {
        return None; // `%(An)` ou `@(d16)` sem indice
    }
    let (d, r) = dentro.split_once(',')?;
    let disp = u32::from_str_radix(d.trim_start_matches("0x"), 16).ok()? as u8;
    let r = r.trim_start_matches('%');
    let (reg, tam) = r.split_once(':')?;
    let (tipo, num) = reg.split_at(1);
    Some((
        disp,
        tipo.chars().next()?,
        num.parse().ok()?,
        tam.chars().next()?,
    ))
}

#[test]
fn paridade_de_operandos_com_indice_contra_o_instrumento() {
    // O comprimento e o alvo ja eram comparados; os CAMPOS do operando com
    // indice (registrador, tamanho do indice, displacamento) nao eram. A
    // mediacao na ROM (R1, 0x191C) mostrou que a ferramenta lia esses campos
    // com o layout errado: `1031 2000` e indice D2 em word, nao D0 com
    // displacamento 0x20. Este teste e a prova independente que falta.
    let mut comparados = 0usize;
    let mut falhas: Vec<String> = Vec::new();
    for (corpus, dump) in [
        ("calib", include_str!("../fixtures/calib-objdump.txt")),
        ("calib2", include_str!("../fixtures/calib2-objdump.txt")),
    ] {
        for r in parse_objdump(dump) {
            // No modo PC o instrumento imprime um endereco computado (e nao o
            // campo de 8 bits), entao a comparacao de campo nao e possivel ai.
            if r.text.contains("%pc@(") || expected(&r, corpus).is_frontier() {
                continue;
            }
            let Some(esperado) = indice_operando(&r.text) else {
                continue;
            };
            match decode_at(&r.bytes, r.addr) {
                Outcome::Insn(i) => match indice_operando(&i.mnem) {
                    None => falhas.push(format!(
                        "{:#x} [{}] ferramenta nao imprimiu operando de indice: {}",
                        r.addr, r.text, i.mnem
                    )),
                    Some(obtido) if obtido == esperado => comparados += 1,
                    Some(obtido) => falhas.push(format!(
                        "{:#x} instrumento {:?} / ferramenta {:?} (mnem {})",
                        r.addr, esperado, obtido, i.mnem
                    )),
                },
                Outcome::Frontier(f) => falhas.push(format!(
                    "{:#x} [{}] fronteira {}: {}",
                    r.addr,
                    r.text,
                    f.kind.label(),
                    f.motivo
                )),
            }
        }
    }
    assert!(
        falhas.is_empty(),
        "{} divergencias de operando com indice:\n{}",
        falhas.len(),
        falhas.join("\n")
    );
    assert!(
        comparados >= 4,
        "comparacoes de indice = {comparados}; o corpus tem ao menos quatro \
         formas com indice (movel/movew/calib2 e as duas novas de lblidx)"
    );
    println!("indice: {comparados} operandos comparados campo a campo com o instrumento");
}

#[test]
fn campos_de_indice_68020_param_sem_reclamar_comprimento() {
    let recs = parse_objdump(include_str!("../fixtures/calib2-objdump.txt"));
    for end in INDICE_68020 {
        let r = recs
            .iter()
            .find(|r| r.addr == *end)
            .unwrap_or_else(|| panic!("calib2: registro {end:#x} ausente"));
        match decode_at(&r.bytes, r.addr) {
            Outcome::Frontier(f) => assert_eq!(
                f.kind,
                FrontierKind::OpcodeForaDoSubconjunto,
                "{end:#x}: fronteira errada ({})",
                f.motivo
            ),
            Outcome::Insn(i) => panic!(
                "calib2 {end:#x} [{}] reclamou {} bytes para um campo de indice 68020",
                r.text, i.len
            ),
        }
    }
}
