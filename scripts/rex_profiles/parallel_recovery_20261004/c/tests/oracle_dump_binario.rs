//! O leitor do INSTRUMENTO tem de entender os dois formatos de número que o
//! próprio `m68k-elf-objdump` imprime — medidos, não lembrados:
//!
//! * `objdump -d` sobre um ELF montado com símbolos imprime alvo em hex puro com
//!   rótulo entre `<>` (`bras 156 <lbl1>`);
//! * `objdump -b binary -m m68k -D` (a varredura exaustiva §4) não tem símbolos e
//!   imprime `0x` na frente do número (`jsr 0x4e71`, `jmp 0x4e714e71`).
//!
//! A segunda forma é linha medida de `dump-mascaras.txt` (corpus de 1 MiB da
//! receita `tools/varredura-mascaras.sh`):
//! `   4eb80:\t4eb8 4e71      \tjsr 0x4e71` e `   4ef90:\t4ef9 4e71 4e71 \tjmp
//! 0x4e714e71`. Se o leitor descartar esses números, a classe `divergencia-critica
//! (iii)` do E4-1 deixa de ser uma comparação e passa a ser ausência de medição —
//! que é exatamente o defeito que este arquivo existe para impedir.

#[path = "support/oracle.rs"]
mod oracle;

use oracle::{instrument_target, parse_objdump};

#[test]
fn le_o_alvo_absoluto_com_prefixo_hex_do_dump_binario() {
    // Forma medida em dump-mascaras.txt (registro do slot 0x4EB8).
    assert_eq!(
        instrument_target("jsr", "jsr 0x4e71"),
        Some(0x0000_4E71),
        "abs.W com bit15=0: o instrumento imprime o numero com 0x"
    );
    // Forma medida na sonda as -m68000: (0x8000).w vira jsr 0xffff8000.
    assert_eq!(
        instrument_target("jsr", "jsr 0xffff8000"),
        Some(0xFFFF_8000),
        "abs.W com bit15=1: o instrumento imprime o numero JA sign-estendido"
    );
}

#[test]
fn le_o_alvo_de_longword_absoluto_no_dump_binario() {
    let recs = parse_objdump(
        "Disassembly of section .data:\n\
         00000000 <.data>:\n\
            4ef90:\t4ef9 4e71 4e71 \tjmp 0x4e714e71\n\
            4ef96:\t4e71           \tnop\n",
    );
    assert_eq!(recs.len(), 2, "dois registros no, dois lidos");
    assert_eq!(recs[0].addr, 0x4ef90);
    assert_eq!(recs[0].len, 6, "jmp abs.L = tres words");
    assert_eq!(
        recs[0].target,
        Some(0x4e71_4e71),
        "abs.L: o numero impresso e o proprio operando"
    );
}

#[test]
fn continua_lembrando_o_hex_puro_do_dump_com_simbolos() {
    // `objdump -d` em ELF montado (fixtures fx09/fx10/fx11): sem 0x, com rotulo.
    assert_eq!(
        instrument_target("bras", "bras 156 <lbl1>"),
        Some(0x156),
        "regressao: quebrar o formato antigo invalidaria a paridade das ETAPAs 1-2"
    );
    assert_eq!(
        instrument_target("jmpl", "jmp 12345678 <.data+0x4>"),
        Some(0x1234_5678)
    );
}

#[test]
fn nao_inventa_alvo_onde_o_instrumento_nao_imprime_numero() {
    // Indireto, imediato e registrador nao tem endereco efetivo absoluto.
    for (token, text) in [
        ("jmp", "jmp %a2@"),
        ("jmpl", "jmp %pc@(0xa)"),
        ("moveal", "moveal #0x8,%a0"),
        ("orib", "orib #113,%d0"),
        ("nop", "nop"),
    ] {
        assert_eq!(
            instrument_target(token, text),
            None,
            "{text} nao e forma absoluta - inventar alvo aqui fabricaria a classe (iii)"
        );
    }
}
