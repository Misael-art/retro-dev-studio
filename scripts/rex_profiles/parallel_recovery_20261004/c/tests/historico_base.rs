//! Provas discriminantes exigidas por CONTRACT §5 e congeladas em
//! EXPECTATIONS-ETAPA1.md §1 (unidades sem montagem).
//!
//! (a) A regra historica: displacamento relativo de Bcc/BRA/BSR/DBcc e tomado em
//!     `endereco_da_instrucao + 2` (primeiro word de extensao), NUNCA no fim da
//!     instrucao. Os casos abaixo tem displacamento em endereco par tal que as
//!     duas formulas divergem em 2; o valor da formula ERRADA e registrado
//!     explicitamente como NAO produzido.
//! (b) Cross-check com `rex-gameplay::m68k::decode` nas formas comuns aos dois
//!     subconjuntos: comprimento e alvo identicos. Round-trip interno proprio nao
//!     conta como prova.

use rex_cfg::decode::{decode_at, Flow, Outcome};

fn bytes_de(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .map(|t| u16::from_str_radix(t, 16).unwrap_or_else(|_| panic!("token invalido {t}")))
        .flat_map(|w| [(w >> 8) as u8, w as u8])
        .collect()
}

fn alvo_de(outcome: &Outcome) -> Option<u32> {
    match outcome {
        Outcome::Insn(i) => match &i.flow {
            Flow::Branch { taken, .. } => Some(*taken),
            Flow::Call { target } | Flow::Jmp { target } => Some(*target),
            _ => None,
        },
        Outcome::Frontier(_) => None,
    }
}

/// (a) Regra historica. Em cada linha: (bytes, endereco, alvo CORRETO com base
/// instr+2, alvo que a formula ERRADA (base = fim da instrucao) produziria).
const CASOS_DISCRIMINANTES: &[(&str, u32, u32, u32)] = &[
    // beq.w, disp = -10 em endereco par
    ("6700 FFF6", 0x1000, 0x0FF8, 0x0FFA),
    // dbf d4, disp = -10 (DBcc tem sempre word de extensao)
    ("51CC FFF6", 0x1000, 0x0FF8, 0x0FFA),
    // bra.w, disp = -10
    ("6000 FFF6", 0x1000, 0x0FF8, 0x0FFA),
    // bne.w adiante: 0x2002 + 22 = 0x2018; a formula errada daria 0x201A
    ("6600 0016", 0x2000, 0x2018, 0x201A),
    // bcc.s NAO discrimina (2 bytes: instr+2 == fim); fica fora desta tabela
    // por honestidade: so os casos de 4 bytes distinguem as duas formulas.
];

#[test]
fn base_de_desvio_e_instrucao_mais_2_e_nao_fim_da_instrucao() {
    for (hex, addr, correta, errada) in CASOS_DISCRIMINANTES {
        let outcome = decode_at(&bytes_de(hex), *addr);
        let taken = alvo_de(&outcome)
            .unwrap_or_else(|| panic!("{hex} em {addr:#06x}: a ferramenta nao declarou alvo"));
        assert_eq!(
            taken, *correta,
            "{hex} em {addr:#06x}: esperado {correta:#06x} (base = instr+2), obtido {taken:#06x}"
        );
        assert_ne!(
            taken, *errada,
            "{hex} em {addr:#06x}: a formula historica ERRADA (base = fim da instrucao) produziria \
             {errada:#06x}; este valor esta registrado como NAO produzido"
        );
    }
}

/// (b) Formas comuns aos dois subconjuntos. Cada entrada e (rotulo, hex,
/// endereco de teste). Comprimento e alvo devem bater exatamente.
const FORMAS_COMUNS: &[(&str, &str, u32)] = &[
    ("move.l abs.L,d1", "2039 1234 5678", 0x1000),
    ("move.l d1,abs.L", "23C1 1234 5678", 0x1002),
    ("addq.l #2,d3", "5483", 0x1004),
    ("moveq #15,d4", "780F", 0x1006),
    ("cmp.l d2,d3", "B682", 0x1008),
    ("btst #3,d3", "0803 0003", 0x100A),
    ("bra.s +6", "6006", 0x100C),
    ("beq.w +6", "6700 0006", 0x100E),
    ("bne.w -10", "6600 FFF6", 0x1010),
    ("pea abs.W", "4878 1234", 0x1012),
    ("move.l abs.L,-(sp)", "2F39 1234 5678", 0x1014),
    ("jsr abs.L", "4EB9 1234 5678", 0x1016),
];

/// Buffer comum: a instrucao comeca em `addr`, com folga depois dela.
/// `rex-gameplay::m68k::decode` indexa o buffer pelo proprio offset; `decode_at`
/// recebe a janela cortada no mesmo endereco. As duas visoes sao o MESMO buffer.
fn janela(bytes: &[u8], addr: u32) -> Vec<u8> {
    let mut buf = vec![0u8; addr as usize];
    buf.extend_from_slice(bytes);
    while buf.len() < addr as usize + 32 {
        buf.push(0);
    }
    buf
}

#[test]
fn paridade_com_rex_gameplay_m68k_nas_formas_comuns() {
    let mut falhas: Vec<String> = Vec::new();
    for (nome, hex, addr) in FORMAS_COMUNS {
        let buf = janela(&bytes_de(hex), *addr);
        let nosso = decode_at(&buf[*addr as usize..], *addr);
        let deles = rex_gameplay::m68k::decode(&buf, *addr);
        match (&nosso, &deles) {
            (Outcome::Insn(i), Ok(d)) => {
                if i.len as u32 != d.len {
                    falhas.push(format!(
                        "{nome} em {addr:#06x}: comprimento nosso {} / rex-gameplay {}",
                        i.len, d.len
                    ));
                }
                if let Some(alvo) = alvo_de(&nosso) {
                    let alvo_deles = match &d.insn {
                        rex_gameplay::m68k::Insn::Bra { target, .. } => *target,
                        rex_gameplay::m68k::Insn::Bcc { target, .. } => *target,
                        rex_gameplay::m68k::Insn::JsrAbsL { target } => *target,
                        other => {
                            falhas.push(format!(
                                "{nome} em {addr:#06x}: nossa instrucao declara alvo {alvo:#06x} e o \
                                 outro lado nao tem desvio correspondente ({other:?})"
                            ));
                            continue;
                        }
                    };
                    if alvo != alvo_deles {
                        falhas.push(format!(
                            "{nome} em {addr:#06x}: alvo nosso {alvo:#06x} / rex-gameplay {alvo_deles:#06x}"
                        ));
                    }
                }
            }
            (Outcome::Insn(i), Err(e)) => falhas.push(format!(
                "{nome} em {addr:#06x}: a ferramenta leu {} de {} bytes e rex-gameplay recusou ({e})",
                i.mnem, i.len
            )),
            (Outcome::Frontier(f), Ok(d)) => falhas.push(format!(
                "{nome} em {addr:#06x}: nossa fronteira {} e rex-gameplay leu {} bytes",
                f.kind.label(),
                d.len
            )),
            (Outcome::Frontier(_), Err(_)) => {}
        }
    }
    println!(
        "cross-check rex-gameplay: {} formas comuns comparadas",
        FORMAS_COMUNS.len()
    );
    assert!(
        falhas.is_empty(),
        "divergencias com rex-gameplay:\n{}",
        falhas.join("\n")
    );
}

/// Recusa concordante: formas fora dos dois subconjuntos param dos dois lados;
/// nenhum comprimento e reclamado. As quatro formas foram escolhidas por
/// MEDICAO no instrumento, nao de memoria:
/// - `F000`: grupo `%1111` (coprocessador/reservado) — CONTRACT §3 nao o contem;
/// - `4E76`: TRAPV — o instrumento lê `trapv` em 2 bytes (medido no mesmo objeto
///   isolado), mas a forma nao esta nos subconjuntos fechados, entao os dois
///   lados param;
/// - `51FF`: DBcc/Scc com campo de modo `%111` — recusa-se a forma. Nota
///   anterior dizia que o instrumento imprimia `.short 0x51ff` "medido em calib
///   0x14e": **falso**, em calib 0x14c o instrumento lê `67ff 51ff 4e76` como um
///   `beql` de 6 bytes (aqueles bytes nem são um registro). Medido de novo em
///   objeto isolado (`objdump -b binary -m m68k -D`, binutils 2.41 sha e3a404cc):
///   `51ff` = `sf %d7` em 2 bytes — o instrumento LÊ, a ferramenta recusa porque
///   Scc está fora do subconjunto. A recusa continua concordante com
///   `rex-gameplay` (ambos param); o que não pode é citar medição inexistente
///   (ADENDO-ETAPA3-2026-10-05 R-3.7);
/// - `0E00`: balde `%0000 xxx 111 ...` (MOVES e afins), fora da lista fechada.
#[test]
fn ambos_param_em_opcode_fora_dos_dois_subconjuntos() {
    for hex in ["F000", "4E76", "51FF", "0E00 0001"] {
        let buf = janela(&bytes_de(hex), 0x3000);
        let nosso = decode_at(&buf[0x3000..], 0x3000);
        let deles = rex_gameplay::m68k::decode(&buf, 0x3000);
        assert!(nosso.is_frontier(), "{hex}: a ferramenta deveria parar");
        assert!(deles.is_err(), "{hex}: rex-gameplay deveria recusar");
    }
}
