//! ETAPA 3 §4 (obrigacao 6) — negativos de mascara, um por classe de defeito
//! medida pela varredura exaustiva de word (E4).
//!
//! A varredura exaustiva de word (E4) roda mais de uma vez e cada passada deixa
//! série bruta. Ordem medida (preservada em
//! `docs/…/c/EVIDENCIA-REPRODUTIBILIDADE-ETAPA3-2026-10-05.md` e no sidecar da
//! evidência):
//!
//!   * **passada 1** (sem as guardas): `15 716` não conformes = `1 992` criticas +
//!     `13 724` de classe iv.
//!   * **passada 2** (com as nove guardas das ETAPAs 1/2): `divergencia-critica =
//!     16 156`, sendo `15 708` recusas legitimas ainda sem linha na tabela de
//!     justificativas (classe iv), **`135`** leituras com comprimento diferente do
//!     instrumento (classe i), **`313`** leituras sobre word que o instrumento
//!     imprime como `.short` (classe ii) e **`0`** divergencias de endereco efetivo
//!     (classe iii). As `448 = 135 + 313` dessa passada eram os defeitos reais de
//!     mascara; cada teste abaixo fixa um deles, e todos os rotulos sao word exatos
//!     do corpus, portanto a propria varredura e o contra-teste.
//!   * **passada vigente** (depois dos reparos de mascara e da tabela de 39
//!     justificativas, inclusive o espaco `%001`/`b8=0` de R15 e o par ADDA/SUBA/
//!     CMPA): `acordo = 36 878`, `acordo-recusa = 14 292`, `recusa-declarada =
//!     14 366` e **`divergencia-critica = 0`** em 65 536 slots, com
//!     `alvo-confrontado = 4 212` (nao-vazio, como exige R-3.2-a). `bash
//!     tools/varredura-mascaras.sh --check` reproduce os digestos dessa passada a
//!     partir das mascaras hoje em `src/decode.rs`.
//!
//! Cuidado com um choque de numeros que ja enganou este arquivo: o `448` da classe
//! (i)+(ii) da passada 2 e o `448` de words lidas pelo instrumento dentro do espaco
//! R15 sao grandezas diferentes que por acaso dao o mesmo valor. Ver ADENDO R-3.8.
//!
//! Duas provas independentes por classe, ambas no instrumento pinado (binutils
//! 2.41; caminho em `tools/varredura-mascaras.sh`, override `M68K_TOOLCHAIN`):
//!
//!   * `m68k-elf-as -m68000` RECUSA a forma (`operands mismatch`), ou
//!   * `m68k-elf-objdump -b binary -m m68k -D` le a word como `.short` ou com
//!     outro comprimento.
//!
//! Sonda desta rodada: `~/rds-scratch/xe-c3-e4-probe2/sonda-as-68000.txt`
//! (2026-10-05). Formas **ACEITAS** medidas (ficam como instrucoes):
//!   `3208 movew %a0,%d1`   `2208 movel %a0,%d1`   `5048 addqw #8,%a0`
//!   `5088 addql #8,%a0`    `5108 subqb #8,%a0`    `43d0 lea %a0@,%a1`
//!   `4850 pea %a0@`        `487a 0010 pea %pc@(0x12)`
//!   `48e0 8000 moveml %d0,%a0@-`   `4cd8 0001 moveml %a0@+,%d0`
//!   `08c0 0003 bset #3,%d0`        `c280 andl %d0,%d1`   `4482 negl %d2`
//! Formas **RECUSADAS** pelo `as -m68000` (motivos da sonda, citados em cada teste):
//!   `move.b %a0,%d1`, `move.b %d0,%a0`, `lea %d0,%a1`, `lea %a0,%a1`,
//!   `lea %a0@+,%a1`, `lea %a0@-,%a1`, `addq.b #8,%a0`, `btst #3,%a0`,
//!   `btst %d0,%a1`, `ori.w #3,%a0`, `ori.l #3,%a0`, `ori.b #3,(16,%pc)`,
//!   `ori.l #3,(16,%pc)`, `cmpi.l #3,(16,%pc)`, `addi.w #3,(16,%pc)`,
//!   `move.w #3,(16,%pc)`, `move.l #3,(16,%pc)`, `movem.l %d0,%a0@+`,
//!   `movem.w %d0,%a0@+`, `movem.l %a0@-,%d0`, `pea %a0@+`, `pea %a0@-`,
//!   `pea #3`, `neg.l (16,%pc)`, `not.w (16,%pc)`, `clr.l (16,%pc)`,
//!   `tst.l (16,%pc)`, `neg.l %a0`.
//!
//! E4-4 esta respeitada em toda linha: nenhuma forma entra na lista fechada; as
//! leituras 68020 que o instrumento generico faz (MVS/MVZ, PACK/UNPK) saem dela.

use rex_cfg::decode::{decode_at, FrontierKind, Outcome};

/// Preenchimento do corpus E4: `nop` (`4E71`) repetido. Da words suficientes para
/// o instrumento ler extensoes sem depender do slot vizinho.
const PREENCHIMENTO: [u8; 8] = [0x4E, 0x71, 0x4E, 0x71, 0x4E, 0x71, 0x4E, 0x71];

fn janela(word: u16) -> Vec<u8> {
    let mut v = word.to_be_bytes().to_vec();
    v.extend_from_slice(&PREENCHIMENTO);
    v
}

fn deve_recusar(word: u16, rotulo: &str) {
    match decode_at(&janela(word), 0x1000) {
        Outcome::Frontier(f) => {
            assert_eq!(
                f.kind,
                FrontierKind::OpcodeForaDoSubconjunto,
                "{word:#06x} ({rotulo}): classe de fronteira errada: {}",
                f.kind.label()
            );
            assert!(
                !f.motivo.is_empty(),
                "{word:#06x} ({rotulo}): recusa sem motivo declaravel (E4-1 iv)"
            );
            assert!(
                f.motivo.is_ascii(),
                "{word:#06x} ({rotulo}): motivo fora do vocabulario ASCII (regra V5): {}",
                f.motivo
            );
            assert_eq!(
                f.consumo, None,
                "{word:#06x} ({rotulo}): forma recusada nao pode reclamar bytes"
            );
        }
        Outcome::Insn(ins) => panic!(
            "{word:#06x} ({rotulo}): ferramenta leu {} bytes (`{}`) onde sonda+E4 provam forma invalida",
            ins.len, ins.mnem
        ),
    }
}

fn deve_ler(word: u16, bytes: u16, familia: &str, rotulo: &str) {
    match decode_at(&janela(word), 0x1000) {
        Outcome::Insn(ins) => {
            assert_eq!(
                ins.len, bytes,
                "{word:#06x} ({rotulo}): comprimento {}",
                ins.len
            );
            assert_eq!(ins.family, familia, "{word:#06x} ({rotulo}): familia");
        }
        Outcome::Frontier(f) => panic!(
            "{word:#06x} ({rotulo}): forma comprovada pela sonda virou recusa: {}",
            f.motivo
        ),
    }
}

/// R1 — grupo `%0111` com `b8=1` NAO e MOVEQ: sao MVS/MVZ/CPMOVE (68020), que o
/// `as -m68000` nem mesmo monta. A ferramenta tratava toda essa regiao como desvio
/// de 2 bytes: 808 divergencias (i) (`mvsb`/`mvzw` lidos em 4 ou 6 bytes) e 88 (ii).
#[test]
fn r1_grupo_0111_com_b8_um_nao_e_moveq() {
    for word in [
        0x7100u16, 0x71FF, 0x73A5, 0x75C0, 0x77E1, 0x7900, 0x7BCD, 0x7FFF,
    ] {
        deve_recusar(word, "MVS/MVZ 68020 (b8=1)");
    }
    // MOVEQ legitimo (b8=0), medido `7025 moveq #37,%d0`.
    deve_ler(0x7025, 2, "moveq", "moveq");
}

/// R2 — `MOVE.B` com fonte An direto: PRM 4-118 ("For byte size operation, address
/// register direct is not allowed.") e sonda (RECUSA). A ferramenta leu 336 words.
#[test]
fn r2_moveb_com_fonte_an_direto_e_invalido() {
    for word in [0x1008u16, 0x1208, 0x1E08, 0x1F88] {
        deve_recusar(word, "move.b com fonte %aN (instrumento .short)");
    }
    // Contrapesos medidos no mesmo dump: `%aN@` como fonte E como destino e um
    // byte valido (`1090 moveb %a0@,%a0@`), e An direto existe para `.W`/`.L`.
    deve_ler(0x1090, 2, "move", "move.b %a0@,%a0@ (medido 1090)");
    deve_ler(0x3208, 2, "move", "move.w %a0,%d1 (medido 3208)");
    deve_ler(0x2208, 2, "move", "move.l %a0,%d1 (medido 2208)");
}

/// R3 — fonte de `LEA`: somente modos de memoria. A sonda recusa `%dN`, `%aN`,
/// `%aN@+` e `%aN@-`; a ferramenta aceitava os quatro (248 words).
#[test]
fn r3_lea_recusa_fonte_de_registro_e_auto_indecrementacao() {
    for (word, r) in [
        (0x41C0u16, "lea com fonte %d0"),
        (0x41C8, "lea com fonte %a0"),
        (0x41D8, "lea com fonte %a0@+"),
        (0x41E0, "lea com fonte %a0@-"),
        (0x49D8, "lea com fonte %a3@+ (medido .short)"),
        (0x4DE0, "lea com fonte %a0@- e destino %a3"),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0x41D0, 2, "lea", "lea %a0@,%a0 (medido 41d0)");
    deve_ler(
        0x41FA,
        4,
        "lea",
        "lea com disp16(pc) como fonte (medido 41fa)",
    );
}

/// R4 — `ADDQ` com EA = An direto em `.B` (sonda: `addq.b #8,%a0` RECUSA; `.W` e
/// `.L` aceitas; `subq.b #8,%a0` aceito e fica). Destino PC-relativo/CCR/SR
/// imediato tambem fora: as 8 words `addqb #X,(+20081).w,%pc` medidas (ii).
#[test]
fn r4_addq_b_com_an_direto_e_invalido() {
    for (word, r) in [
        (0x5008u16, "addq.b #8,%a0 (medido .short)"),
        (0x5208, "addq.b #1,%a0 (medido .short)"),
        (0x5808, "addq.b #4,%a0 (medido .short)"),
        (0x503A, "addq.b destino (16,%pc)"),
        (0x507A, "addq.w destino (16,%pc)"),
        (0x50BA, "addq.l destino (16,%pc)"),
        (0x513A, "subq.b destino (16,%pc)"),
        (0x517A, "subq.w destino (16,%pc)"),
        (0x57BA, "subq.l destino (16,%pc) (medido .short)"),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0x5048, 2, "addq", "addq.w #8,%a0 (medido)");
    deve_ler(0x5088, 2, "addq", "addq.l #8,%a0 (medido)");
    deve_ler(0x5108, 2, "subq", "subq.b #8,%a0 (medido)");
}

/// R5 — bitop (BTST/BCHG/BCLR/BSET): destino An direto e destino modo 7 a partir de
/// `%010` nao montam (sonda: `btst #3,%a0` e `btst %d0,%a1` RECUSADAS). As words
/// abaixo sao as medidas `(ii)` do corpus; as duas `...49` pertencem a MOVEP, que o
/// instrumento le como `movepl` e a lista fechada nao contem.
#[test]
fn r5_bitop_recusa_destino_an_e_modo_7_a_partir_de_2() {
    for (word, r) in [
        (0x0808u16, "btst #imediato,%a0 (medido .short)"),
        (0x087A, "bchg #imediato,(16,%pc) (medido .short)"),
        (0x017A, "btst %d0,(16,%pc) (medido .short)"),
        (0x037C, "bchg %d1,#imediato (medido .short)"),
        (
            0x0149,
            "movepl %a1@(+20081),%d0: MOVEP fora da lista (medido 4 bytes)",
        ),
        (
            0x09C9,
            "movepl %d4,%a1@(+20081): MOVEP fora da lista (medido 4 bytes)",
        ),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0x08C0, 4, "bset", "bset #3,%d0 (medido 08c0 0003)");
    deve_ler(0x01C0, 2, "bset", "bset %d0,%d0 (medido 01c0)");
    deve_ler(0x0312, 2, "btst", "btst %d1,%a2@ (medido 0312)");
    deve_ler(
        0x08F8,
        6,
        "bset",
        "bset #0,(1234).w (medido 08f8 0000 1234)",
    );
}

/// R6 — op1 imediato (ORI/ANDI/SUBI/ADDI/EORI/CMPI): destino An direto, PC-relativo
/// ou CCR/SR nao estao na lista fechada e o `as -m68000` recusa (sonda cobriu
/// ori/addi/cmpi em tres tamanhos). `00BA` e a divergencia (i) 8v6: o instrumento
/// generico le `oril #imm,%d2` com uma word a menos que a ferramenta.
#[test]
fn r6_op1_imediato_recusa_destino_an_pc_e_ccr_sr() {
    for (word, r) in [
        (0x0008u16, "ori.b #,%a0 (medido .short)"),
        (0x0048, "ori.w #,%a0 (medido .short)"),
        (0x00BA, "ori.l #,(16,%pc) (medido oril ...,%d2 em 6)"),
        (0x02BA, "andi.l #,(16,%pc)"),
        (0x04BA, "subi.l #,(16,%pc)"),
        (0x06BA, "addi.l #,(16,%pc)"),
        (0x0ABA, "eori.l #,(16,%pc)"),
        (0x0CBA, "cmpi.l #,(16,%pc) (medido cmpil ...,%pc@())"),
        (0x007C, "ori.w #%imm,%sr (medido oriw #20081,%sr)"),
        (
            0x0C7C,
            "cmpi.w #%imm,%sr (instrumento imprime cmpiw ...,%d4 em 4 bytes)",
        ),
        (
            0x0ABC,
            "eori.l #%imm,%sr (instrumento imprime eoril ...,%d4 em 6 bytes)",
        ),
        (
            0x00C0,
            "instrumento le `bitrev %d0` (68020): tamanho %11 fora da lista",
        ),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0x0078, 6, "ori", "ori.w #imm,(xxx).w (medido 0078)");
    deve_ler(0x0080, 6, "ori", "ori.l #imm,%d0 (medido 0080)");
    deve_ler(0x0C41, 4, "cmpi", "cmpi.w #imm,%d1 (medido 0c41)");
}

/// R7 — MOVEM: escrita com `(An)+` e leitura com `-(An)` recusadas pelo montador
/// pinado (medido nos dois tamanhos); modo 7 reservado fora da lista. Leitura com
/// `(d16,PC)` e com `%aN@+` sao formas que o instrumento le e o montador aceita
/// (`4cba` 6 bytes, `4c9c` 4 bytes) e portanto continuam lidas.
#[test]
fn r7_movem_recusa_auto_indecrementacao_incompativel_e_pc() {
    for (word, r) in [
        (0x4898u16, "movem.w escrita com %a0@+ (medido .short)"),
        (0x48D8, "movem.l escrita com %a3@+ (medido .short)"),
        (0x4CA0, "movem.w leitura com %a0@- (medido .short)"),
        (0x4CE0, "movem.l leitura com %a0@- (medido .short)"),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(
        0x48E0,
        4,
        "movem",
        "movem.l %d0/%d4-%d6/...,%a0@- (medido 48e0)",
    );
    deve_ler(0x4CD8, 4, "movem", "movem.l %a0@+,%d0/... (medido 4cd8)");
    deve_ler(0x4CBA, 6, "movem", "movem.w (16,%pc),%d0/... (medido 4cba)");
    deve_ler(0x4C9C, 4, "movem", "movem.w %a4@+,%d0/... (medido 4c9c)");
}

/// R8 — PEA: modos de auto-indecrementacao nao montam (medido `4858`/`4860`/`485b`/
/// `4866` como `.short`). PC-relativo como fonte e VALIDO (medido `487a 0010`)
/// e continua lido.
#[test]
fn r8_pea_recusa_auto_indecrementacao() {
    for word in [0x4858u16, 0x4860, 0x485B, 0x4866] {
        deve_recusar(word, "pea com %aN@+ ou %aN@- (medido .short)");
    }
    deve_ler(0x4850, 2, "pea", "pea %a0@ (medido 4850)");
    deve_ler(0x487A, 4, "pea", "pea (16,%pc) (medido 487a 0010)");
}

/// R9 — unarios (CLR/NEG/NOT/TST) e Scc: CLR/NEG/NOT nao tem imediato nem modo
/// reservado (medido `42ba`/`44ba`/`46ba` — os dois ultimos sao as divergencias (i)
/// 4v2, porque o instrumento imprime `negl %d2` em 2 bytes). TST conserva a leitura
/// do PC-relativo e do imediato que o instrumento faz (`4aba` 4, `4abc` 6) e so
/// recusa %101..%111. `4afc` e lido pelo instrumento como `illegal` e nao esta na
/// lista fechada.
#[test]
fn r9_unario_e_scc_recusam_destino_modo_7_a_partir_de_2() {
    for (word, r) in [
        (0x42BAu16, "clr.l com imediato (medido .short)"),
        (0x44BA, "neg.l com imediato (instrumento negl %d2 em 2)"),
        (0x46BA, "not.l com imediato (instrumento notl %d2 em 2)"),
        (0x42FC, "clr.l com modo %111 (medido .short)"),
        (0x4AFC, "illegal (68010+): fora da lista fechada"),
        (0x57BA, "Scc com destino (16,%pc) (medido .short)"),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0x4482, 2, "neg", "neg.l %d2 (medido)");
    deve_ler(0x4200, 2, "clr", "clr.b %d0 (medido 4200)");
    deve_ler(0x4A1B, 2, "tst", "tst.b %a3@+ (medido 4a1b)");
    deve_ler(0x4ABA, 4, "tst", "tst.l (16,%pc) (medido 4aba)");
    deve_ler(0x57C1, 2, "seq", "Scc com destino %dN (medido 57c1)");
}

/// R10 — grupo de 2 operandos com `d=1` e EA = `%000`: no MC68000 esse par de
/// campos e a familia X/BCD/EXG/PACK/UNPK, nao OR/AND/SUB/CMP/ADD. Medidas no
/// instrumento: `8100 sbcd`, `8140 pack` (4 bytes), `8180 unpk` (4 bytes),
/// `c100 abcd`, `c140 exg`, `d140 addxw`, `d180 addxl`, `9180 subxl`, e
/// `c180` = `.short` (AND.L `d=1` com EA=Dn nao existe). A leitura correta e
/// `andl %d0,%d1` = `c280` (medido), isto e, `d=0` com EA=Dn.
///
/// Refusar e o que o contrato manda: nenhum desses mnemonicos esta na lista
/// fechada §3 e a ferramenta os imprimia como `addl`/`andw`, ou seja, com campo
/// semanticamente errado (objetivo da ETAPA 3). O comprimento nao e inventado.
#[test]
fn r10_geral_com_d_um_e_ea_dn_direto_e_familia_x_fora_da_lista() {
    for (word, r) in [
        (0x8100u16, "sbcd (medido 8100) - nao OR"),
        (0x8140, "pack 4 bytes (medido 8140 4e71)"),
        (0x8180, "unpk 4 bytes (medido 8180 4e71)"),
        (0x9100, "subxb (medido 9100)"),
        (0x9140, "subxw (medido 9140)"),
        (0x9180, "subxl (medido 9180)"),
        (0xC100, "abcd (medido c100)"),
        (0xC140, "exg (medido c140)"),
        (0xC180, ".short 0xc180 (medido)"),
        (0xD100, "addxb (medido d100)"),
        (0xD140, "addxw (medido d140)"),
        (0xD180, "addxl (medido d180)"),
        (0x817C, "divs com destino imediato (.short medido)"),
        (0x837C, "or.w com destino imediato (.short medido)"),
        (0x937C, "sub.w com destino imediato (.short medido)"),
        (0xC37C, "and.w com destino imediato (.short medido)"),
        (0xD37C, "add.w com destino imediato (.short medido)"),
    ] {
        deve_recusar(word, r);
    }
    deve_ler(0xC280, 2, "and", "and.l %d0,%d1 (medido c280, d=0)");
    deve_ler(0xB141, 2, "eor", "eor.w %d0,%d1 (calib b141)");
    deve_ler(0xB180, 2, "eor", "eor.l %d0,%d0 (medido b180)");
    deve_ler(0xC2C0, 2, "mulu", "mulu.w %d0,%d1 (calib c2c0)");
    deve_ler(0xD6C0, 2, "adda", "adda.w %d0,%a3 (calib d6c0)");
    deve_ler(0xC1FC, 4, "muls", "mulsw #imediato,%d0 (medido c1fc 4e71)");
}

/// Contrapeso: as formas de fluxo comprovadas nas ETAPAs 1/2 continuam lidas com
/// os mesmos comprimentos. Uma recusa excessiva quebra este teste.
#[test]
fn fluxo_comprovado_continua_lido() {
    deve_ler(0x4EB8, 4, "jsr", "jsr (xxx).w");
    deve_ler(0x4EB9, 6, "jsr", "jsr (xxx).l");
    deve_ler(0x4EF8, 4, "jmp", "jmp (xxx).w");
    deve_ler(0x4EF9, 6, "jmp", "jmp (xxx).l");
    deve_ler(0x6000, 4, "bra", "bra.w");
    deve_ler(0x66FE, 2, "bne", "bne.s");
    deve_ler(0x51C8, 4, "dbf", "dbf com word de desplazamento");
    deve_ler(0x4E71, 2, "nop", "nop");
    deve_ler(0x4E75, 2, "rts", "rts");
    deve_ler(0x22FC, 6, "move", "move.l #imm,%d1 (calib)");
}

/// R11 — contrapeso da familia `b8=1`. A recta `1101 ddd 1 ss mmm rrr` dos grupos
/// OR/SUB/CMP(EOR)/AND/ADD **e** o formato documentado de destino em EA (Dn ->
/// `<ea>`), e o ROM real o usa: o calib mede `d591 addl %d2,%a1@` em `0x7e` e
/// `9b78 1234 subw %d5,1234` em `0x80`. A primeira correcao desta ETAPA recusou
/// todo `b8=1` e quebrou a paridade do calib (duas divergencias, medidas em
/// `cargo test`); a mapa integral do subespaco (sonda `xe-c3-e4-probe4`,
/// 2026-10-05, sobre o dump dos 65 536 words) mostra que so os modos `%000` e
/// `%001` abren a familia especial (SBCD/ABCD/ADDX/SUBX/EXG, e PACK/UNPK, lida
/// em 4 bytes) e que em `%111` so os destinos `abs.W`/`abs.L` existem. Este teste
/// fixa a parte **lida**: se a guarda volver a ser larga demais, falha aqui e no
/// calib ao mesmo tempo.
#[test]
fn r11_formato_b8_um_de_dn_para_ea_continua_lido() {
    deve_ler(0xD591, 2, "add", "addl %d2,%a1@ (calib 0x7e)");
    deve_ler(0x9B78, 4, "sub", "subw %d5,abs.W (calib 0x80)");
    // un exemplo por grupo e por faixa de modo, todos com comprimento do instrumento.
    // Os rotulos de familia sao os que a ferramenta emite: `family_of` so tira o
    // sufixo de tamanho em tokens de 4+ caracteres, entao `orb`/`orl` ficam inteiros.
    deve_ler(0x8110, 2, "orb", "orb %dN,%a0@ (medido 8110)");
    deve_ler(0x8190, 2, "orl", "orl %dN,%a0@ (medido 8190)");
    deve_ler(0xC190, 2, "and", "andl %dN,%a0@ (medido c190)");
    deve_ler(0x9190, 2, "sub", "subl %dN,%a0@ (medido 9190)");
    deve_ler(0xB190, 2, "eor", "eorl %dN,%a0@ (medido b190)");
    deve_ler(0xD190, 2, "add", "addl %dN,%a0@ (medido d190)");
    deve_ler(0xD1A0, 2, "add", "addl %dN,%a0@- (medido d1a0)");
    deve_ler(0xD138, 4, "add", "addb %dN,abs.W (medido d138, 4B)");
    deve_ler(0x81B8, 4, "orl", "orl %dN,abs.W (medido 81b8, 4B)");
    // o modo %000 de CMP com b8=1 EOR, que existe (medido b100/b140/b180)
    deve_ler(0xB100, 2, "eor", "eorb %dN,%dN (medido b100)");
}

/// R12 — o vetor de `TRAP #n` ocupa **quatro** bits (`0x4E40 | n`, `n` em
/// `0..=15`), não três. A máscara `0xFFF8` da ferramenta deixava
/// `0x4E48..=0x4E4F` caírem na recusa genérica do grupo `%0100`, e a varredura E4
/// mediu essas oito words como recusa declarável (classe iv) sobre um instrumento
/// que as lê. A §3 do contrato lista `TRAP #n` sem restringir o vetor, e o
/// MC68000 define o formato com campo de 4 bits. Este teste fixa os dois lados:
/// os dezesseis vetores continuam sendo **leituras** (`Flow::Trap`) e o número
/// impresso é o vetor real da word, não `#0` por troncamento.
#[test]
fn r12_trap_tem_vetor_de_quatro_bits() {
    for vetor in 0u16..16 {
        let word = 0x4E40 | vetor;
        match decode_at(&janela(word), 0x1000) {
            Outcome::Insn(ins) => {
                assert_eq!(ins.len, 2, "{word:#06x}: comprimento {}", ins.len);
                assert_eq!(
                    ins.mnem,
                    format!("trap #{vetor}"),
                    "{word:#06x}: vetor truncado (mnemonico `{}`)",
                    ins.mnem
                );
                assert!(
                    matches!(ins.flow, rex_cfg::decode::Flow::Trap),
                    "{word:#06x}: fluxo {:?}",
                    ins.flow
                );
            }
            Outcome::Frontier(f) => panic!(
                "{word:#06x} (trap #{vetor}): recusado com `{}` - a secao 3 lista TRAP #n para os 16 vetores",
                f.motivo
            ),
        }
    }
}

/// R13 — modos de fonte do grupo `ss=%11` com destino `An` (ADDA/SUBA/CMPA).
/// A PRM diz, na pagina de `ADD` (l. 5022, p. 4-5): "If the location specified is a
/// source operand, **all addressing modes** can be used", e as paginas de `ADDA`
/// (l. 5096), `SUBA` (l. 12222) e `CMPA` (l. 7946) declaram a sintaxe
/// `<ea>,An` com `Size = (Word, Long)`; Tabela 3-3 (l. 3537/3562/3544) repete
/// `16, 32`. `%aN` direto e `#imm` sao dois desses modos (§2.2.2, l. 2093, com
/// "NUMBER OF EXTENSION WORDS: 0"; §2.2.18, l. 2704). A mascara da ferramenta
/// recusava os dois, o que a varredura E4 mediu como 384 + 48 words de recusa sem
/// base — e o comprimento delas nao esta contestado: o instrumento le
/// `d2c8 addaw %a0,%a1` (2B), `d3c9 addal %a1,%a1` (2B), `d0fc addaw #20081,%a0`
/// (4B) e `93fc subal #1316048497,%a1` (6B), e o `as -m68000` monta as quatro
/// formas (`tools/sonda-as-68000.sh`, v3). O contrapeso e MUL/DIV: a mesma pagina
/// do PRM (l. 10720, tabela de modos de fonte de `MULU`) marca `An` como `—` para
/// esses grupos, o `as -m68000` recusa `mulu.w %a0,%d0`, e o instrumento imprime
/// `.short` sobre `c0c8`/`80c8` — medidos em `probe8.bin`. Essa parte continua
/// recusada.
#[test]
fn r13_adda_suba_cmpa_aceitam_fonte_an_direto_e_imediato() {
    // fonte %aN direta: zero words de extensao => 2 bytes em qualquer tamanho
    deve_ler(0xD2C8, 2, "adda", "addaw %a0,%a1 (medido d2c8)");
    deve_ler(0x90C8, 2, "suba", "subaw %a0,%a0 (medido 90c8)");
    deve_ler(0xB2C8, 2, "cmpa", "cmpaw %a0,%a1 (medido b2c8)");
    deve_ler(0xD3C9, 2, "adda", "addal %a1,%a1 (medido d3c9)");
    // fonte imediata: 1 word em .W, 2 words em .L (comprimentos do instrumento)
    deve_ler(0xD0FC, 4, "adda", "addaw #imm,%a0 (medido d0fc, 4B)");
    deve_ler(0x90FC, 4, "suba", "subaw #imm,%a0 (medido 90fc, 4B)");
    deve_ler(0xB4FC, 4, "cmpa", "cmpaw #imm,%a2 (medido b4fc, 4B)");
    deve_ler(0x93FC, 6, "suba", "subal #imm,%a1 (medido 93fc, 6B)");
    // o operando bruto tem de sair como o registrador/valor da word, nao truncado
    match decode_at(&janela(0xD3C9), 0x1000) {
        Outcome::Insn(ins) => assert_eq!(ins.mnem, "addal %a1, %a1", "mnemonico {:?}", ins.mnem),
        Outcome::Frontier(f) => panic!("recusado: {}", f.motivo),
    }
    match decode_at(&janela(0xD0FC), 0x1000) {
        Outcome::Insn(ins) => assert_eq!(
            ins.mnem, "addaw #(0x4e71), %a0",
            "operando imediato {:?}",
            ins.mnem
        ),
        Outcome::Frontier(f) => panic!("recusado: {}", f.motivo),
    }
    // contrapeso: MUL/DIV com fonte %aN continuam fora (instrumento .short)
    deve_recusar(0xC0C8, "mulu/muls com fonte %a0 (instrumento .short)");
    deve_recusar(0x80C8, "divu/divs com fonte %a0 (instrumento .short)");
}

/// R14 — `CHK` com fonte imediata: o campo SIZE de CHK esta **contestestado** entre
/// a referencia primaria e o instrumento, e comprimento contestado nao se exporta.
/// O PRM (l. 7643-7644, p. 4-70) da ao campo `11 — Word operation / 10 — Long
/// operation`, com Long marcado como "MC68020, MC68030, MC68040 only" (l. 7603);
/// a mesma tabela lista `#<data>` como modo valido de fonte (l. 7651) e `An` como
/// `—` (l. 7650). O instrumento pinado, porem, le `41bc` como `chkw #imm` em 4B e
/// `413c` como `chkl #imm` em 6B, e imprime `.short` sobre `41fc` — exatamente a
/// word que o PRM declara como o CHK.W do MC68000 (medidas em `probe8.bin`/
/// `probe9.bin`). As hipoteses divergem em comprimento (4B vs 6B) e em fluxo, e o
/// `as -m68000` recusa `chk.l` para a CPU-alvo. A recusa e a saida estruturalmente
/// segura; o motivo tem de nomear a divergencia em vez de alegar que a forma nao
/// existe (o que ja esteve escrito aqui com uma sonda defeituosa).
#[test]
fn r14_chk_com_imediato_recusa_por_divergencia_nao_resolvida() {
    for word in [
        0x41BCu16, 0x43BC, 0x45BC, 0x47BC, 0x49BC, 0x4BBC, 0x4DBC, 0x4FBC,
    ] {
        match decode_at(&janela(word), 0x1000) {
            Outcome::Frontier(f) => {
                assert!(
                    f.motivo.contains("divergencia") && f.motivo.contains("chk"),
                    "{word:#06x}: motivo nao nomeia a divergencia de tamanho: `{}`",
                    f.motivo
                );
                assert_eq!(f.consumo, None, "{word:#06x}: recusa nao pode reclamar bytes");
            }
            Outcome::Insn(ins) => panic!(
                "{word:#06x}: leitura com tamanho contestado (PRM l.7643-4 vs instrumento) exportada como `{}` {}B",
                ins.mnem, ins.len
            ),
        }
    }
    // o outro codigo de tamanho medido pelo instrumento (`.short` em 413c = chkl 6B)
    // e o codigo que o PRM reserva para 68020+: mesma recusa, mesmo motivo.
    deve_recusar(0x413C, "chk com imediato no codigo de tamanho 00");
    // contrapeso: CHK com fonte de registrador/memoria nao esta contestado e fica.
    deve_ler(0x4184, 2, "chk", "chkw %d4,%d0 (medido na calibracao)");
    deve_ler(0x4310, 2, "chk", "chkl %a0@,%d1 (medido na calibracao)");
}

/// R15 — fonte `%aN` direta nos grupos de 2 operandos com destino `Dn`. A mascara
/// antiga recusava o subespaco inteiro. O espaco, MEDIDO sobre o corpus da
/// varredura exaustiva de §4 (sha `b2f4b455…`; corpo do dump regenerado com o
/// `objdump` pinado, ver ADENDO R-3.7): `hi ∈ {1000 or, 1001 sub, 1011 cmp, 1100
/// and, 1101 add}` com `b8=0`, fonte em modo `%001` e `ss != %11` sao **960
/// words**, das quais o instrumento le **448** — todas em 2 bytes, `addw`, `addl`,
/// `subw`, `subl`, `cmpb`, `cmpw`, `cmpl` com **64** cada — e imprime `.short`
/// sobre as **512** restantes (todo `or`/`and` com fonte `%aN`, mais `add.b` e
/// `sub.b`). A redacao anterior ("448 words, `short=0/448`") errava nos dois
/// numeros: 448 e o que o instrumento LE, nao o tamanho do espaco, e o `.short`
/// nao e zero — e precisamente a diferenca 960 − 448 = 512 (ADENDO R-3.8).
///
/// Ficamento registrado no censo: as 64 words `cmp.b` com fonte `%aN` (p. ex.
/// `b008`) SAEM do grupo `recusas-declaradas` como `short=0/64 | tokens: cmpb x64
/// | 2B x64`, ou seja, o instrumento le e este decoder recusa — divergencia
/// ISA-vs-instrumento pinada abaixo, nao silenciada.
///
/// A referencia primaria separa os dois lados:
/// - `ADD` (PRM l. 5022-5028, p. 4-5): "source operand, all addressing modes", com a
///   linha `An* 001 reg. number:An` e o footnote `*Word and long only` (l. 5040);
///   `SUB` repete (l. 12151-12156) e `CMP` tambem (l. 7904-7909).
/// - `AND` (l. 5460-5466), `OR` (l. 11150-11152) e `EOR` (l. 9010-9016) dizem "only
///   data addressing modes" e marcam `An` como `—`.
///
/// O `as -m68000` bate exatamente nessa fronteira (sonda desta ETAPA): monta
/// `add.w %a0,%d1` = d248, `add.l %a0,%d1` = d288, `sub.w %a0,%d1` = 9248 e
/// `cmp.w %a0,%d1` = b248; recusa `add.b %a0,%d1`, `and.{b,w,l} %a0,%d1`,
/// `or.{b,w,l} %a0,%d1` e `eor.{b,w,l} %a0,%d1` com "operands mismatch".
#[test]
fn r15_fonte_an_direta_e_valida_em_add_sub_cmp_so_word_long() {
    deve_ler(0xD248, 2, "add", "addw %a0,%d1 (medido d248)");
    deve_ler(0xD288, 2, "add", "addl %a0,%d1 (medido d288)");
    deve_ler(0x9248, 2, "sub", "subw %a0,%d1 (medido 9248)");
    deve_ler(0xB248, 2, "cmp", "cmpw %a0,%d1 (medido b248)");
    match decode_at(&janela(0xD248), 0x1000) {
        Outcome::Insn(ins) => {
            assert_eq!(ins.mnem, "addw %a0, %d1", "operando bruto {:?}", ins.mnem)
        }
        Outcome::Frontier(f) => panic!("recusado: {}", f.motivo),
    }
    // byte com fonte %aN: o footnote "Word and long only" (l. 5040) e o GAS recusam
    deve_recusar(0xD208, "add.b com fonte %aN (word and long only)");
    deve_recusar(0x9008, "sub.b com fonte %aN (word and long only)");
    // CMP nao carrega o footnote: o instrumento le as 64 words de `cmp.b` com fonte
    // `%aN` (medidas de `b008` a `b70f`) como `cmpb` de 2 bytes (censo §4, grupo
    // `short=0/64 | tokens: cmpb x64`). Aqui a recusa
    // e a da maquina-alvo — o `as -m68000` recusa `cmp.b %a0,%d1` (sonda v9
    // l.20-23) porque a Tabela 2-4 marca `An` como nao-operando de dados. O pino
    // abaixo guarda a DIVERGENCIA registrada contra o instrumento, nao um acordo.
    deve_recusar(
        0xB008,
        "cmp.b com fonte %aN: divergencia ISA-vs-instrumento registrada",
    );
    // AND/OR/EOR: `An` nao e modo de fonte nestes grupos (l. 5466/11152/9016)
    deve_recusar(0xC248, "and.w com fonte %aN");
    deve_recusar(0x8248, "or.w com fonte %aN");
    deve_recusar(0xB348, "eor.w com fonte %aN (dir=1)");
    // destino %aN com `b8=1` segue fora: ai o espaco e a familia X/BCD/CMPM
    // (`1101 ddd 1 ss 001 rrr` = addx/subx/cmpm), que o §3 nao lista.
    deve_recusar(
        0xD348,
        "d348 = addx/subx/cmpm com An: fora da lista fechada",
    );
}

/// R16 — grupo `%1110` (shift/rotacao). Os motivos antigos diziam "shift com
/// tamanho %11" e "o gas deste instrumento recusa montar, sem prova de
/// comprimento" e "ROX.B nao existe no 68000". Medido nesta ETAPA (sonda
/// `tools/sonda-as-68000.sh` -> v4, linhas 70-88): o campo de tamanho (bits 7-6)
/// vale `%11` SO na forma de MEMORIA, e o `as -m68000` monta exatamente essas
/// formas — `e1d0 asl.w %a0@`, `e0d0 asr.w`, `e3d0 lsl.w`, `e2d0 lsr.w`, `e5d0
/// roxl.w`, `e7d0 rol.w`, `e1d8`, `e1e0`, `e1e80008`, `e1f804d2` — e recusa
/// `asl.l %a0@` ("Memory shift and rotate operations shift word operands one bit
/// position only", M68000PRM 3.1.4 l.3605; formato MEMORY SHIFTS l.9635+). Na
/// forma de memoria nao ha campo de tamanho, portanto o comprimento e sempre 2
/// bytes + extensoes do modo. Montadores e oraculos independentes: os fixtures
/// `calib.s`/`calib2.s` ja trazem `roxlw/roxrw/roxll/roxrl` (0xc2, 0x74-0x7a) e o
/// `objdump` pinado le as 1024 words do espaco `%1110` — a familia de rotacao
/// estava implementada e so nao tinha nome em §3 l.185, que o adendum datado de
/// 2026-10-05 corrige; a auditoria nao moveu forma nenhuma para dentro da lista
/// (E4-4).
#[test]
fn r16_grupo_1110_forma_de_memoria_e_campos_de_familia_corrigidos() {
    for (word, bytes, familia, rotulo) in [
        (0xE1D0u16, 2u16, "asl", "asl.w %a0@ (medido e1d0)"),
        (0xE0D0, 2, "asr", "asr.w %a0@ (medido e0d0)"),
        (0xE3D0, 2, "lsl", "lsl.w %a0@ (medido e3d0)"),
        (0xE2D0, 2, "lsr", "lsr.w %a0@ (medido e2d0)"),
        (0xE5D0, 2, "roxl", "roxl.w %a0@ (medido e5d0)"),
        (0xE4D0, 2, "roxr", "roxr.w %a0@ (medido e4d0)"),
        (0xE7D0, 2, "rol", "rol.w %a0@ (medido e7d0)"),
        (0xE6D0, 2, "ror", "ror.w %a0@ (medido e6d0)"),
        (0xE1D8, 2, "asl", "asl.w %a0@+ (medido e1d8)"),
        (0xE1E0, 2, "asl", "asl.w -(%a0) (medido e1e0)"),
        (0xE1E8, 4, "asl", "asl.w (8,%a0) (medido e1e80008)"),
        (0xE1F8, 4, "asl", "asl.w (1234).w (medido e1f804d2)"),
        (0xE1F9, 6, "asl", "asl.w (12345678).l (modo 7.1 = 2 words)"),
    ] {
        deve_ler(word, bytes, familia, rotulo);
    }
    for (word, mnem) in [
        (0xE1D0u16, "aslw %a0@"),
        (0xE7D0, "rolw %a0@"),
        (0xE1E8, "aslw %a0@(0x4e71)"),
    ] {
        match decode_at(&janela(word), 0x1000) {
            Outcome::Insn(ins) => assert_eq!(ins.mnem, mnem, "operando bruto {:?}", ins.mnem),
            Outcome::Frontier(f) => panic!("{word:#06x}: recusado: {}", f.motivo),
        }
    }
    // So modos de memoria alteravel (prm 4-115 l.9635+): registrador direto,
    // imediato, PC e reservados ficam como fronteira.
    for (word, rotulo) in [
        (0xE1C0u16, "modo %000 = Dn direto"),
        (0xE1C8, "modo %001 = An direto"),
        (0xE1FA, "modo 7.2 = (d16,PC)"),
        (0xE1FC, "modo 7.4 = #%imediato"),
        (0xE1FE, "modo 7.6 reservado"),
    ] {
        deve_recusar(word, rotulo);
        if let Outcome::Frontier(f) = decode_at(&janela(word), 0x1000) {
            assert!(
                f.motivo.contains("4-115"),
                "{word:#06x}: o motivo tem de citar a pagina MEMORY SHIFTS: {}",
                f.motivo
            );
        }
    }
    // Campo de familia %100..%111 na forma de memoria nao esta na tabela 3-5.
    for word in [0xE9D0u16, 0xEBD0, 0xEDD0, 0xEFD0] {
        deve_recusar(word, "familia %100..%111 nao definida (prm tabela 3-5)");
    }
    // Registrador: as oito formas (4 familias x 2 direcoes) nos tres tamanhos,
    // com contagem imediata ou em Dn. Medidos na sonda v4: e701/e741/e781/e641/
    // e5a1 (AS/LS) e e711/e751/e799/e719/e759/e659/e270 (ROX/ROL/ROR, inclusive
    // byte — o motivo antigo "ROX.B nao existe no 68000" e falso: tabela 3-5
    // l.3654/3659 lista 8, 16, 32 e o montador pinado monta e711/e710).
    for (word, familia, rotulo) in [
        (0xE701u16, "asl", "asl.b #3,%d1"),
        (0xE741, "asl", "asl.w #3,%d1"),
        (0xE781, "asl", "asl.l #3,%d1"),
        (0xE641, "asr", "asr.w #3,%d1"),
        (0xE5A1, "asl", "asl.l %d2,%d1"),
        (0xE711, "roxl", "roxl.b #3,%d1"),
        (0xE710, "roxl", "roxl.b #3,%d0 (instrumento le, probe11)"),
        (0xE751, "roxl", "roxl.w #3,%d1"),
        (0xE799, "rol", "rol.l #3,%d1"),
        (0xE719, "rol", "rol.b #3,%d1"),
        (0xE759, "rol", "rol.w #3,%d1"),
        (0xE659, "ror", "ror.w #3,%d1"),
        (0xE270, "roxr", "roxr.w %d1,%d0"),
    ] {
        deve_ler(word, 2, familia, rotulo);
    }
}

/// R17 — motivo de `op1-imediato com destino An`. A varredura E4 mediu o grupo
/// inteiro (64 words) com `short=0/64`: o instrumento NAO imprime `.short` para
/// elas — le `0088` como `oril #imm,%d0` em 6 bytes, `0c08` como `cmpib #113,%d0`
/// em 4 (probe desta ETAPA). O que as exclui e a referencia primaria e a CPU-alvo:
/// M68000PRM 4-154 (l.11259-11267) restringe o destino de ORI/ANDI/EORI a "Only
/// data alterable addressing modes" e marca `An` como `—`, e o `as -m68000` pinado
/// recusa as seis familias com "operands mismatch" (sonda v4, linhas 31-40).
#[test]
fn r17_motivo_de_op1_imediato_com_an_cita_a_referencia_e_nao_afirma_short() {
    for word in [0x0088u16, 0x0288, 0x0488, 0x0688, 0x0A88, 0x0C88] {
        match decode_at(&janela(word), 0x1000) {
            Outcome::Frontier(f) => {
                assert!(
                    f.motivo.contains("prm 4-154") && f.motivo.contains("as -m68000"),
                    "{word:#06x}: o motivo tem de apontar referencia primaria e CPU-alvo: {}",
                    f.motivo
                );
                assert!(
                    !f.motivo.contains("instrumento .short"),
                    "{word:#06x}: o motivo alega `.short` e a varredura mediu short=0/64 no grupo: {}",
                    f.motivo
                );
            }
            Outcome::Insn(ins) => panic!("{word:#06x}: leitura indevida (`{}`)", ins.mnem),
        }
    }
    // Byte/word com destino An de fato imprimem `.short` (probe 0008/0048) e seguem
    // recusados pelo mesmo motivo de referencia.
    deve_recusar(0x0008, "ori.b #,%a0 (medido .short)");
    deve_recusar(0x0048, "ori.w #,%a0 (medido .short)");
}
