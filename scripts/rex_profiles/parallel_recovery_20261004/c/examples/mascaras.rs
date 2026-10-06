//! ETAPA 3 §4 (fim da obrigação 6) — auditoria EXAUSTIVA de máscaras sobre o
//! subconjunto efetivamente suportado, com o instrumento pinado como árbitro.
//!
//! Duas fases, para que a medição e a classificação tenham receitas separadas:
//!
//!   cargo run --release --example mascaras -- emit-corpus <arquivo.bin>
//!   cargo run --release --example mascaras -- classificar <corpus.bin> <dump.txt> \\
//!         <saida.json> <saida.md> <dir-do-toolchain>
//!
//! Corpus determinístico: 65 536 slots de 16 bytes; o word de cada slot É o
//! índice do slot (`0x0000..=0xFFFF`), o resto é `4E71` (nop). Cobrir os
//! 65 536 espaços de word de instrução não é amostragem: é o espaço inteiro de
//! palavras, e é o que permite dizer "a máscara do caso X diverge" em vez de
//! "não apareceu no meu conjunto de fixtures".
//!
//! Classes (congeladas em `EXPECTATIONS-ETAPA3.md` §4): `acordo`,
//! `acordo-recusa`, `recusa-declarada`, `divergencia-critica`, com cota
//! `divergencia-critica = 0`. Uma recusa nossa sobre algo que o instrumento
//! decodifica só é legítima se estiver na tabela de recusas declaradas abaixo,
//! com justificativa e fonte; grupo sem entrada na tabela faz o programa falhar
//! em vez de produzir evidência muda.
//!
//! Paridade com o objdump é árbitro de **comprimento e exibição**, não prova de
//! equivalência arquitetural (Apêndice B das expectativas). Onde divergir de
//! verdade, a referência primária manda e a divergência sai listada.

use rex_cfg::decode::{decode_at, Flow, Ins, Outcome};
use std::collections::BTreeMap;
use std::io::Write;

#[path = "../tests/support/oracle.rs"]
mod oracle;
use oracle::{desvio_disp8_ff, parse_objdump, Rec};

const PALAVRAS: usize = 1 << 16;
const SLOT_BYTES: usize = 16;
const PREENCHIMENTO: [u8; 2] = [0x4E, 0x71];
const ESQUEMA: &str = "rex-cfg/censo-mascaras/v2";
const BASE_SHA: &str = "cb56657a142df40d2acd09a3e03e54247f066dea";
const VERSAO_INSTRUMENTO: &str = "binutils 2.41";
const FLAGS_INSTRUMENTO: &str = "-b binary -m m68k -D";

/// Digestos dos dois binários pinados que servem de árbitro.
#[derive(Debug, Clone)]
struct Instrumento {
    as_sha: String,
    objdump_sha: String,
}

/// Receita do corpus, versão 2 (a de V1, Apêndice A, sem alteração de forma).
fn gerar_corpus() -> Vec<u8> {
    let mut v = Vec::with_capacity(PALAVRAS * SLOT_BYTES);
    for palavra in 0u32..PALAVRAS as u32 {
        v.extend_from_slice(&(palavra as u16).to_be_bytes());
        let mut resto = (SLOT_BYTES - 2) / 2;
        while resto > 0 {
            v.extend_from_slice(&PREENCHIMENTO);
            resto -= 1;
        }
    }
    v
}

/// Uma recusa nossa precisa de par nomeado: rótulo exato + por que o subconjunto
/// fecha aí + a fonte. `divergencia-critica` não tem tabela — tem de ser zero.
///
/// (motivo, classe da forma, justificativa, fonte)
const RECUSAS_DECLARADAS: &[(&str, &str, &str, &str)] = &[
    (
        "%0111 com b8=1 = MVS/MVZ/CPMOVE (68020), nao MOVEQ nem desvio - fora do subconjunto",
        "CPU-ALVO",
        "So maquina: o grupo %0111 com b8=1 so e codificado por 68020/68040/CPU32; nenhum dos mnemonicos que o instrumento imprime sobre essas 1952 words monta no montador da CPU-alvo.",
        "sonda as -m68000 (v9 l.64,65,187-189: mvs/mvz/bitrev/callm/rtm recusados); M68000PRM sha 06e4864b l.23789-23808 (Table 8-2: 1111 = Coprocessor Interface/MC68040 and CPU32 Extensions)",
    ),
    (
        "BKPT (68010+) fora do subconjunto - recusado",
        "CPU-ALVO",
        "So maquina: BKPT e 68010+, e a unica word do grupo recusa no montador da CPU-alvo; nao e limite de lista fechada.",
        "sonda v9 l.61 (bkpt #3: invalid instruction for this architecture; needs 68010 or higher)",
    ),
    (
        "EXT nao esta no subconjunto do contrato 3 - recusado",
        "LISTA-3",
        "So escopo: o alvo monta EXT.W e EXT.L sobre registrador de dados (4880/48c0) e o ramo do decoder so aceita o modo %000, entao as 16 words sao justamente as formas montaveis; a recusa vem da lista fechada do contrato 3.",
        "sonda v9 l.45,46 (ext.l/ext.w montam); src/decode.rs ramo EXT (campo %100 do grupo %0100 com modo %000)",
    ),
    (
        "JSR/JMP com alvo nao comprovado (indireto ou PC) - permanece desconhecido",
        "PROIBICAO-ESTRUTURAL-0-2",
        "Nem maquina nem lista: jsr/jmp com fonte indireta, PC-relativa e absoluto curto montam no alvo, mas a proibicao 0.2 nao permite publicar alvo nao comprovado; o caminho para ali e vira fronteira.",
        "sonda v9 l.116-118 (4e90/4ed0/4efa0008) e l.214,215 (4eb88000/4ef88000); CONTRACT 0.2",
    ),
    (
        "LEA com fonte de registrador ou auto-incremento: so modos de memoria (sonda as -m68000)",
        "CPU-ALVO",
        "So maquina: LEA exige operando de memoria; registrador direto, (An)+ e -(An) recusam no alvo e as 8 words do grupo sao exatamente essas formas.",
        "sonda v9 l.105,106,108,109 (recusam) contra l.107,211,212 (outras formas de LEA montam)",
    ),
    (
        "MOVE com fonte PC-relativo ou reservada (fora do contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens no rotulo: fonte PC-relativa com (d16,PC) e real no alvo e cai fora apenas por escopo, enquanto os modos reservados do campo de modo nao sao codificaveis na CPU-alvo.",
        "sonda v9 l.119,120 (movel/movemb com (d16,PC) montam) contra l.92,93,190,191 (registros de codigo e USP recusam); M68000PRM l.2770-2780 (Tabela 2-4)",
    ),
    (
        "MOVE/MOVEA de tamanho byte com destino An invalido (PRM 4-118/4-119)",
        "CPU-ALVO",
        "So maquina: tamanho byte com destino An nao e montavel no alvo - MOVEA so tem .W/.L e o .B e rejeitado nas duas direcoes.",
        "sonda v9 l.26,27,29 (move.b com %aN e movea.b recusam); M68000PRM 4-118/4-119 (MOVEA: Attributes Size = Word, Long)",
    ),
    (
        "MOVEM com operando de registrador direto",
        "CPU-ALVO",
        "So maquina: o operando de registrador direto no lado da lista do MOVEM recusa no montador da CPU-alvo nas duas direcoes.",
        "sonda v9 l.115,210 (recusam) contra l.113,114,224 (modos de memoria montam)",
    ),
    (
        "MOVEP (modo %001 medido em movepw/movepl) ou An-direto: fora da lista fechada (contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: MOVEP e instrugao real do MC68000 (monta com deslocamento em (d8,An)) e cai fora apenas por escopo, enquanto o operando An-direto que o mesmo rotulo nomeia recusa no alvo.",
        "sonda v9 l.56,57 (movepl 01c80008 / movepw 03890008 montam) contra l.43,44,199 (An-direto recusa); M68000PRM l.23791 (grupo 0000 = Bit Manipulation/MOVEP/Immediate)",
    ),
    (
        "PEA com An-direto fora da lista (contrato 3)",
        "CPU-ALVO",
        "So maquina: PEA exige operando de memoria; An-direto recusa no montador da CPU-alvo.",
        "sonda v9 l.112 (pea %a0 recusa) contra l.110,213 (pea %a0@ e pea (xxx).w montam)",
    ),
    (
        "Scc com destino PC, imediato ou reservado",
        "CPU-ALVO",
        "So maquina: Scc escreve no destino, e PC-relativo, imediato e os modos reservados nunca sao destinos alteraveis na CPU-alvo; as tres formas recusam no montador.",
        "sonda v9 l.102,103,164 (recusam) contra l.208,209 (abs.W e (An) montam, outro rotulo); M68000PRM l.2770-2780",
    ),
    (
        "add/sub/cmp.b com fonte %aN direta: footnote `word and long only` (prm l.5040) e o as -m68000 recusa `add.b %a0,%d1`",
        "CPU-ALVO",
        "So maquina: An nao e operando de dados (Tabela 2-4 marca Data = -) e o alvo recusa as familias de byte com fonte An; as mesmas fontes em .W/.L pertencem a outro rotulo.",
        "sonda v9 l.20-23 (or.b/and.l/cmp.b/eor.b com %aN recusam) contra l.18,19 (sub.w/add.l com %aN montam); M68000PRM l.5036-5040 (footnote Word and long only) e l.2757",
    ),
    (
        "b8=1 com fonte Dn direta = familia SBCD/ABCD/EXG/ADDX/SUBX/PACK (68010/68020): fora da lista fechada (contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: abcd/addx/subx/sbcd/exg entre registradores montam no alvo e caem fora apenas por escopo, enquanto pack/unpack sao 68020 e recusam na CPU-alvo.",
        "sonda v9 l.49,51,54,55,145-148 (montam) contra l.47,48 (pack/unpack: needs 68020); M68000PRM l.23799,23803,23804",
    ),
    (
        "b8=1 com modo %001 = familia sbcd/abcd/addx/subx/cmpm/exg/pack/unpk e mov3q 68020: fora da lista fechada (contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: as familias de memoria (An)/(An)+/(An)- de cmpm/abcd/addx/subx/exg montam no alvo (so escopo fecha), enquanto mov3q e 68EC020/CPU32 e recusa.",
        "sonda v9 l.51,53-55,224 (montam) contra l.50,52,124 (subx.l/sbcd com %aN@ e mov3q recusam); M68000PRM l.23799-23804",
    ),
    (
        "bitop imediato com PC/CCR-SR/reservado",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: bitop imediato com destino PC monta no alvo quando a operacao somente le (btst) e recusa quando escreve (bset/bclr), e CCR/SR e os modos reservados nunca montam.",
        "sonda v9 l.122,197 (btst imediato com (d16,PC) e (d8,PC,Xn) montam) contra l.162,198 (bset/bclr #3 com (d16,PC) recusam) e l.178 (bset #3,%sr)",
    ),
    (
        "bitop registrador com PC/CCR-SR/reservado",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: bitop registrador com destino (d16,PC) monta no alvo na forma de leitura (btst) e recusa nas de escrita (bset/bchg); os modos reservados recusam nas duas.",
        "sonda v9 l.163 (btst %d0,(16,%pc) = 013a0010) contra l.194,195 (bset %d0,(16,%pc) e com indice recusam) e l.179 (bchg %d0,%ccr)",
    ),
    (
        "chk com imediato: divergencia nao resolvida de tamanho entre prm l.7643-4 (11=w, 10=l so 68020+) e o instrumento (41bc=chkw 4b, 413c=chkl 6b, 41fc=.short)",
        "DIVERGENCIA-REGISTRADA",
        "Referencia primaria e instrumento conflituam e o comprimento nao e comprovavel para o alvo: o PRM da %11 = word e %10 = long (long somente em 68020+), mas o as -m68000 monta chk.w como %10 e o objdump le %10 como chkl de 6 bytes e imprime .short para %11. A recusa fica ate decisao do principal (E4-4).",
        "sonda v9 l.99,100 (chk #3,%d0 e chk.w = 41bc0003) e l.180 (chk.l: needs 68020); M68000PRM l.7602-7603 (Size = Word, Long* / *MC68020+), l.7642-7644, l.7652",
    ),
    (
        "desvio com disp8 = 0xFF: forma de extensao 68020 ambigua - comprimento nao comprovavel, caminho interrompido (contrato 3; o instrumento le .S -1) [desvio lido como .S pelo instrumento]",
        "DIVERGENCIA-REGISTRADA",
        "Divergencia registrada: o instrumento le essas 16 words como desvio de 6 bytes (.S), mas disp8 = %FF e forma de extensao 68020 que o alvo nao produz (o montador recusa -1 em disp8); sem comprimento comprovavel o caminho para por seguranca estrutural, nao por cobertura.",
        "sonda v9 l.181,182 (bra.b #-1 e beq.b #-1 recusam); M68000PRM Table 3-9 l.3761-3766 (Bcc 8/16/32; DBcc 16); CONTRACT 0.3 (retificada em R-2 de 2026-10-05)",
    ),
    (
        "forma de memoria do grupo %1110 com campo de familia %100..%111: nao definida (prm tabela 3-5 l.3617-3660)",
        "CPU-ALVO",
        "So maquina: na forma de memoria do grupo %1110 os campos de familia %100..%111 (bit field e multiplicador-acumulador) sao 68020/5206e e recusam no alvo; as familias %000..%011 de memoria montam e tem rotulo proprio.",
        "sonda v9 l.183-189 (bfextu/bfins/macl/mac/bitrev recusam) contra l.70-77,79-82 (shift/rotate de memoria montam); M68000PRM l.3607-3617 (Table 3-5) e l.23805",
    ),
    (
        "forma ea->Dn com fonte imediata - invalido",
        "CPU-ALVO",
        "So maquina: a direcao ea->Dn com fonte imediata nao e producivel no alvo - o montador reescreve sempre para o grupo de imediato proprio (op1) ou para ADDQ/SUBQ e nunca emite essa word.",
        "sonda v9 l.140-144 (add.w #3,%d0 sai addqw 5640; or.b #3,%d1 sai orib 00010003); M68000PRM l.2780 (imediato: Alterable = -) e l.11262-11268",
    ),
    (
        "grupo %0100 fora do subconjunto",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: dentro do grupo %0100 com b8=0 o campo %000 contem MOVE-do-SR (40c0) e o campo %100 contem MOVEM de memoria para lista (48d0), que montam no alvo e caem fora so por escopo, enquanto EXT em modos de memoria (68020) e o campo %110 recusam.",
        "sonda v9 l.222,224 (montam) contra l.193 (ext.w %a0@: needs 68020) e l.218,223 (move.l %d0,%ccr e move.w %sr,%ccr recusam)",
    ),
    (
        "grupo %1010 reservado - recusado",
        "CPU-ALVO",
        "So maquina: o codigo de operacao %1010 e declarado nao atribuido/reservado pela referencia primaria, e nenhuma forma do grupo e montavel no montador da CPU-alvo.",
        "M68000PRM l.23801 (Table 8-2: 1010 = Unassigned, Reserved); sonda v9 nao tem nenhuma forma MONTE nesse grupo",
    ),
    (
        "grupo %1111 (coprocessador/reservado) - recusado",
        "CPU-ALVO",
        "So maquina: %1111 e a interface de coprocessador e as extensoes MC68040/CPU32; o ponto numerico e as extensoes recusam no montador da CPU-alvo.",
        "M68000PRM l.23806-23808; sonda v9 l.91 (moves.w: needs 68010+), l.133 (fmove.l: needs 68020), l.183,184 (bfextu/bfins)",
    ),
    (
        "modo 6.0 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %110 com reg %000 (A0) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000 e qualquer outro valor e escala ou deslocamento grande de 68020. Nota honesta: as 794 words desta linha sao word de opcode + o preenchimento 4e71 do proprio corpus, nao instrucoes de ROM.",
        "sonda v9 l.169,170 (postbyte com bits 10-8 = %000 montam) contra l.171-173 (escala: scale factor invalid on this architecture; needs cpu32 or 68020); M68000PRM l.2764 e l.5036-5040",
    ),
    (
        "modo 6.1 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %110 com reg %001 (A1) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000 e qualquer outro valor e escala ou deslocamento grande de 68020. Mesmo registro de metodo da primeira linha do modo %110: sao words de opcode + preenchimento 4e71.",
        "sonda v9 l.169,170 contra l.171-173; M68000PRM l.2764 e l.5036-5040",
    ),
    (
        "modo 6.2 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %110 com reg %010 (A2) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "sonda v9 l.169,170 contra l.171-173; M68000PRM l.2764 e l.5036-5040",
    ),
    (
        "modo 6.3 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %110 com reg %011 (A3) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "sonda v9 l.169,170 contra l.171-173; M68000PRM l.2764 e l.5036-5040",
    ),
    (
        "modo 6.4 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %110 com reg %100 (A4) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "sonda v9 l.169,170 contra l.171-173; M68000PRM l.2764 e l.5036-5040",
    ),
    (
        "modo 6.5 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o modo %110 com reg %101 nao existe no MC68000 (a Tabela 2-4 para em reg %100 para o modo %110), e o postbyte ainda traz os bits 10-8 = %011 do preenchimento. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "M68000PRM l.2764 (unico 110 com reg. number:An) e l.5036-5040; sonda v9 l.171-173 (campo de indice de 68020 recusa)",
    ),
    (
        "modo 6.6 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o modo %110 com reg %110 nao existe no MC68000, e o postbyte ainda traz os bits 10-8 = %011 do preenchimento; e linha-F na referencia primaria. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "M68000PRM l.2764 e l.5036-5040; sonda v9 l.171-173",
    ),
    (
        "modo 6.7 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o modo %110 com reg %111 nao existe no MC68000, e o postbyte ainda traz os bits 10-8 = %011 do preenchimento; e linha-F na referencia primaria. Mesmo registro de metodo da primeira linha do modo %110: words de opcode + preenchimento 4e71.",
        "M68000PRM l.2764 e l.5036-5040; sonda v9 l.171-173",
    ),
    (
        "modo 7.3 com campo de indice 68020 (0x4e71)",
        "CPU-ALVO",
        "So maquina: o postbyte do modo %111 com reg %011 ((d8,PC,Xn)) e recusado porque os bits 10-8 do campo de indice valem %011 no preenchimento do slot; no MC68000 esse campo e %000. As 28 words sao opcode + preenchimento 4e71.",
        "sonda v9 l.151,154,155 ((d8,PC,Xn) com postbyte legal monta) contra l.171-173 (escala/campo de 68020 recusa); M68000PRM l.2772 e l.5036-5040",
    ),
    (
        "op1 imediato com destino An direta: prm 4-154 (l.11259-11267) so admite modos de dados alteraveis e marca An como -, e o as -m68000 recusa ori/andi/subi/addi/eori/cmpi com %aN (sonda v4); o instrumento le (medido 0088 = oril #imm,%d0 em 6 bytes, short=0/64) mas a forma nao esta na lista fechada (contrato 3)",
        "CPU-ALVO",
        "So maquina: nos seis grupos de imediato o destino An esta marcado como nao permitido pela referencia (Only data alterable) e o montador da CPU-alvo recusa ori/andi/subi/addi/eori/cmpi com %aN em todos os tamanhos.",
        "M68000PRM l.11262-11268 (linha An: - -) e l.5036-5040; sonda v9 l.31-40 (recusam) contra l.41,42 (Dn e (An) montam)",
    ),
    (
        "op1 imediato com destino PC, CCR/SR ou reservado fora da lista (contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: destino CCR/SR nos grupos de imediato existe no alvo, mas apenas em .W (ori.w #3,%sr = 007c0003 e eori.b #3,%ccr = 0a3c0003), enquanto (d16,PC)/(d8,PC,Xn) estao marcados como nao permitidos e os modos reservados recusam.",
        "sonda v9 l.157,159 (montam) contra l.158 (andi.l #3,%sr) e l.160-162 (cmpi/addi/bset com (16,%pc)); M68000PRM l.11271-11272",
    ),
    (
        "op1 imediato com tamanho %11",
        "CPU-ALVO",
        "So maquina: o campo de tamanho dos grupos de imediato so vale %00/%01/%10 na referencia e o montador nunca emite %11, portanto a word com %11 nao e producivel no alvo.",
        "M68000PRM l.11257-11260 (00/01/10); sonda v9 l.200-207 (emissoes medidas: 4200/4280/0040/0c80/5680)",
    ),
    (
        "operando PC-relativo ou reservado fora do subconjunto (contrato 3)",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: operando PC-relativo com (d16,PC) e real no alvo nos grupos gerais quando a direcao e leitura (limite de escopo), enquanto os modos reservados do campo de modo e a escrita em PC-relativo nao sao codificaveis na CPU-alvo.",
        "sonda v9 l.174-177 (or/add/sub/cmp com (8,%pc) montam) contra l.92,93,190,191 (reservados recusam); M68000PRM l.2770-2780",
    ),
    (
        "unario com An invalido",
        "CPU-ALVO",
        "So maquina: os unarios escrevem no destino e An nao e destino de dados no MC68000 (Tabela 2-4: Data = - para An); o alvo recusa clr/neg com %aN.",
        "sonda v9 l.126,166 (clr.l %a0 e neg.l %a0 recusam); M68000PRM l.2757 e l.5036-5040",
    ),
    (
        "unario com imediato (so TST) ou modo %101..%111 reservado",
        "CPU-ALVO",
        "So maquina: imediato nunca e destino alteravel e os modos %101..%111 com reg reservado nao existem na CPU-alvo; o montador recusa tst com imediato e clr/tst com (d16,PC).",
        "sonda v9 l.101,127,168 (tst.l #3, clr.l (16,%pc), tst.l (16,%pc) recusam); M68000PRM l.2780",
    ),
    (
        "unario com tamanho %11",
        "MISTA-CPU-ALVO+LISTA-3",
        "Duas origens: o campo %11 do grupo %0100 nao e tamanho de operando, mas abriga instrucoes reais do alvo - TAS (4ac0/4ad0/4ae8) e MOVE-para-CCR/SR (44c0/46c0), que montam - enquanto as demais combinacoes de %11 recusam.",
        "sonda v9 l.62,63,192,216,217 (montam) contra l.92,190,191,218 (recusam); M68000PRM l.7626 (formato do grupo %0100) e l.23795",
    ),
];

fn tem_justificativa(motivo: &str) -> bool {
    RECUSAS_DECLARADAS.iter().any(|(m, ..)| *m == motivo)
}

#[derive(Debug)]
struct Conta {
    acordo: u64,
    acordo_recusa: u64,
    recusa_declarada: u64,
    divergencia_critica: u64,
    /// E4-1(iii): casos em que as duas partes publicam um alvo e ele é comparado.
    alvo_confrontado: u64,
    alvo_so_ferramenta: u64,
    alvo_so_instrumento: u64,
    /// R-3.2-b: o confronto separado por forma. Os contadores absolutos não são
    /// uma conveniência de leitura — sem eles, 4 208 desvios escondem os 4 slots
    /// que de fato testam `abs.W`/`abs.L`.
    alvo_abs_w: u64,
    alvo_abs_l: u64,
    alvo_desvio: u64,
    /// R-3.2-c: (palavra, forma, alvo nosso, número do instrumento, texto do
    /// instrumento) para cada slot absoluto, conferível sem reler o dump.
    exemplos_abs: Vec<(u16, &'static str, u32, u32, String)>,
    /// histograma pedido por E4-3: quantos slots o instrumento marcou `.short`,
    /// no total e por nibble alto do word.
    instrumento_short: u64,
    short_por_prefixo: [u64; 16],
    grupos: BTreeMap<String, Grupo>,
    /// E4-1(iv): recusas sem entrada na tabela, agrupadas por motivo. É o sinal
    /// de descoberta da primeira passada — no artefato final tem de estar vazio.
    recusas_indeclaradas: BTreeMap<String, Grupo>,
    divergencias: Vec<(u16, String)>,
}

/// Um grupo de recusa, com a evidência do árbitro sobre **todas** as suas words.
///
/// A primeira passada listava 8 exemplos e o resto ficava afirmável só de memória;
/// E4-1(iv) pede justificativa por grupo, e uma justificativa que vale para 8
/// amostras não vale para 1 952 words. Aqui cada grupo carrega o histograma de
/// tokens e de comprimentos que o instrumento imprime sobre o grupo inteiro, mais
/// quantas das suas words o instrumento recusa (`.short`). É isso que permite
/// escrever "estas 478 words são `rol*`/`ror*`, lidas em 2B pelo instrumento" como
/// medição e não como impressão.
#[derive(Debug, Default)]
struct Grupo {
    qtd: u64,
    exemplos: Vec<u16>,
    /// words do grupo que o instrumento imprime como `.short`
    short: u64,
    /// token do instrumento (sem sufixo de tamanho perdido) -> quantidade
    tokens: BTreeMap<String, u64>,
    /// comprimento impresso pelo instrumento -> quantidade
    comprimentos: BTreeMap<u32, u64>,
}

impl Grupo {
    fn observar(&mut self, palavra: u16, rec: &Rec) {
        self.qtd += 1;
        if self.exemplos.len() < 8 {
            self.exemplos.push(palavra);
        }
        if rec.token.starts_with(".short") {
            self.short += 1;
        }
        *self.tokens.entry(rec.token.clone()).or_insert(0) += 1;
        *self.comprimentos.entry(rec.len).or_insert(0) += 1;
    }

    /// Top-N tokens por quantidade (desempate lexicográfico, para ser
    /// determinístico); o resto vem agregado numa linha `outros`.
    fn tokens_top(&self, n: usize) -> Vec<(String, u64)> {
        let mut ordem: Vec<(String, u64)> =
            self.tokens.iter().map(|(t, q)| (t.clone(), *q)).collect();
        ordem.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        if ordem.len() <= n {
            return ordem;
        }
        let cauda = ordem.split_off(n);
        let outros: u64 = cauda.iter().map(|(_, q)| q).sum();
        ordem.push((format!("outros({} tokens)", cauda.len()), outros));
        ordem
    }

    /// Assinatura compacta do árbitro para o grupo: `.short`, tokens dominantes
    /// e comprimentos. Vai na evidência versionada e no erro de E4-1(iv).
    fn assinatura(&self, n: usize) -> String {
        let tokens = self
            .tokens_top(n)
            .iter()
            .map(|(t, q)| format!("{t} x{q}"))
            .collect::<Vec<_>>()
            .join(",");
        let comprimentos = self
            .comprimentos
            .iter()
            .map(|(l, q)| format!("{l}B x{q}"))
            .collect::<Vec<_>>()
            .join(",");
        format!(
            "short={}/{} | tokens: {tokens} | comprimentos: {comprimentos}",
            self.short, self.qtd
        )
    }
}

impl Conta {
    fn novo() -> Self {
        Self {
            acordo: 0,
            acordo_recusa: 0,
            recusa_declarada: 0,
            divergencia_critica: 0,
            alvo_confrontado: 0,
            alvo_so_ferramenta: 0,
            alvo_so_instrumento: 0,
            alvo_abs_w: 0,
            alvo_abs_l: 0,
            alvo_desvio: 0,
            exemplos_abs: Vec::new(),
            instrumento_short: 0,
            short_por_prefixo: [0; 16],
            grupos: BTreeMap::new(),
            recusas_indeclaradas: BTreeMap::new(),
            divergencias: Vec::new(),
        }
    }
    fn critico(&mut self, palavra: u16, motivo: String) {
        self.divergencia_critica += 1;
        self.divergencias.push((palavra, motivo));
    }
    fn registrar_recusa(&mut self, palavra: u16, motivo: String, rec: &Rec) {
        self.grupos
            .entry(motivo)
            .or_default()
            .observar(palavra, rec);
    }
    fn registrar_indeclarada(&mut self, palavra: u16, motivo: String, rec: &Rec) {
        self.recusas_indeclaradas
            .entry(motivo)
            .or_default()
            .observar(palavra, rec);
    }
}

fn primeiro_por_slot(recs: &[Rec]) -> BTreeMap<u32, &Rec> {
    let mut m = BTreeMap::new();
    for r in recs {
        m.entry(r.addr).or_insert(r);
    }
    m
}

/// O número que a ferramenta afirma como alvo efetivo da instrução, quando há
/// aresta estrutural comprovada. `None` = forma sem alvo (imediato, registre,
/// `rts`, `trap`) ou fronteira.
fn alvo_nosso(ins: &Ins) -> Option<u32> {
    match &ins.flow {
        Flow::Branch { taken, .. } => Some(*taken),
        Flow::Call { target } | Flow::Jmp { target } => Some(*target),
        Flow::Normal | Flow::Ret | Flow::Trap => None,
    }
}

fn classificar(corpus: &[u8], recs: &[Rec]) -> Conta {
    let mut c = Conta::novo();
    let por_addr = primeiro_por_slot(recs);
    for (i, palavra) in (0u32..PALAVRAS as u32).enumerate() {
        let addr = (i * SLOT_BYTES) as u32;
        let Some(rec) = por_addr.get(&addr) else {
            c.critico(palavra as u16, "sem-registro-no-inicio-do-slot".to_string());
            continue;
        };
        let outcome = decode_at(&corpus[addr as usize..], addr);
        let instrumento_recusou = rec.token.starts_with(".short");
        if instrumento_recusou {
            c.instrumento_short += 1;
            c.short_por_prefixo[(palavra >> 12) as usize] += 1;
        }
        match (&outcome, instrumento_recusou) {
            (Outcome::Insn(ins), false) => {
                if ins.len as u32 != rec.len {
                    c.critico(
                        palavra as u16,
                        format!(
                            "(i) comprimento divergente: ferramenta {} vs instrumento {} ({})",
                            ins.len, rec.len, rec.text
                        ),
                    );
                    continue;
                }
                match (rec.target, alvo_nosso(ins)) {
                    (Some(do_instrumento), Some(nosso)) => {
                        c.alvo_confrontado += 1;
                        // A forma vem do Opcode-word do slot (a receita do corpus
                        // é um slot por word de opcode), nunca do decodificador:
                        // é assim que o pino de `abs-w`/`abs-l` independe da
                        // implementação que está sendo auditada.
                        match palavra {
                            0x4EB8 | 0x4EF8 => {
                                c.alvo_abs_w += 1;
                                c.exemplos_abs.push((
                                    palavra as u16,
                                    "abs-w",
                                    nosso,
                                    do_instrumento,
                                    rec.text.clone(),
                                ));
                            }
                            0x4EB9 | 0x4EF9 => {
                                c.alvo_abs_l += 1;
                                c.exemplos_abs.push((
                                    palavra as u16,
                                    "abs-l",
                                    nosso,
                                    do_instrumento,
                                    rec.text.clone(),
                                ));
                            }
                            _ => c.alvo_desvio += 1,
                        }
                        if do_instrumento != nosso {
                            c.critico(
                                palavra as u16,
                                format!(
                                    "(iii) endereco-efetivo divergente: ferramenta {:#010X} vs \
                                     instrumento {:#010X} ({})",
                                    nosso, do_instrumento, rec.text
                                ),
                            );
                        } else {
                            c.acordo += 1;
                        }
                    }
                    (None, Some(_)) => {
                        c.alvo_so_ferramenta += 1;
                        c.acordo += 1;
                    }
                    (Some(_), None) => {
                        c.alvo_so_instrumento += 1;
                        c.acordo += 1;
                    }
                    (None, None) => c.acordo += 1,
                }
            }
            (Outcome::Insn(ins), true) => c.critico(
                palavra as u16,
                format!(
                    "(ii) comprimento inventado sobre word que o instrumento nao decodifica: \
                     ferramenta {} (`{}`), instrumento `.short`",
                    ins.len, ins.mnem
                ),
            ),
            (Outcome::Frontier(_), true) => c.acordo_recusa += 1,
            (Outcome::Frontier(f), false) => {
                // O único ponto em que o contrato manda parar embora o
                // instrumento leia a forma. O motivo já nomeia a família e o
                // instrumento fica registrado no grupo.
                let mut motivo = f.motivo.clone();
                if desvio_disp8_ff(rec) {
                    motivo = format!("{motivo} [desvio lido como .S pelo instrumento]");
                }
                if tem_justificativa(&motivo) {
                    c.recusa_declarada += 1;
                    c.registrar_recusa(palavra as u16, motivo, rec);
                } else {
                    c.registrar_indeclarada(palavra as u16, motivo.clone(), rec);
                    c.critico(
                        palavra as u16,
                        format!("(iv) recusa sem motivo declaravel: {motivo}"),
                    );
                }
            }
        }
    }
    c
}

fn evidencia_json(g: &Grupo) -> rex_gameplay::json::Json {
    use rex_gameplay::json::Json;
    Json::obj(vec![
        ("short-do-instrumento", Json::Int(g.short as i64)),
        (
            "tokens-do-instrumento",
            Json::Arr(
                g.tokens_top(12)
                    .iter()
                    .map(|(t, q)| {
                        Json::obj(vec![
                            ("token", Json::str(t.clone())),
                            ("quantidade", Json::Int(*q as i64)),
                        ])
                    })
                    .collect(),
            ),
        ),
        (
            "comprimentos-do-instrumento",
            Json::Arr(
                g.comprimentos
                    .iter()
                    .map(|(l, q)| {
                        Json::obj(vec![
                            ("bytes", Json::Int(*l as i64)),
                            ("quantidade", Json::Int(*q as i64)),
                        ])
                    })
                    .collect(),
            ),
        ),
    ])
}

fn texto_json(c: &Conta, corpus_sha: &str, tc: &Instrumento) -> rex_gameplay::json::Json {
    use rex_gameplay::json::Json;
    let exemplos_json = |exemplos: &[u16]| {
        Json::Arr(
            exemplos
                .iter()
                .map(|p| Json::str(format!("0x{p:04X}")))
                .collect(),
        )
    };
    let grupos: Vec<Json> = c
        .grupos
        .iter()
        .map(|(motivo, g)| {
            let justificativa = RECUSAS_DECLARADAS
                .iter()
                .find(|(m, ..)| *m == motivo.as_str());
            Json::obj(vec![
                ("motivo", Json::str(motivo.clone())),
                ("quantidade", Json::Int(g.qtd as i64)),
                ("exemplos", exemplos_json(&g.exemplos)),
                ("instrumento", evidencia_json(g)),
                (
                    "justificativa",
                    justificativa
                        .map(|(_, _, j, _)| Json::str(*j))
                        .unwrap_or(Json::Null),
                ),
                (
                    "fonte",
                    justificativa
                        .map(|(_, _, _, f)| Json::str(*f))
                        .unwrap_or(Json::Null),
                ),
                (
                    "classe-da-forma",
                    justificativa
                        .map(|(_, classe, _, _)| Json::str(*classe))
                        .unwrap_or(Json::Null),
                ),
            ])
        })
        .collect();
    let indeclaradas: Vec<Json> = c
        .recusas_indeclaradas
        .iter()
        .map(|(motivo, g)| {
            Json::obj(vec![
                ("motivo", Json::str(motivo.clone())),
                ("quantidade", Json::Int(g.qtd as i64)),
                ("exemplos", exemplos_json(&g.exemplos)),
                ("instrumento", evidencia_json(g)),
            ])
        })
        .collect();
    Json::obj(vec![
        ("schema", Json::str(ESQUEMA)),
        ("ferramenta", Json::str("rex-cfg")),
        ("versao", Json::str(env!("CARGO_PKG_VERSION"))),
        ("base-sha", Json::str(BASE_SHA)),
        (
            "corpus",
            Json::obj(vec![
                (
                    "receita",
                    Json::str("slot de 16 bytes; word = indice do slot; resto 4E71"),
                ),
                ("slots", Json::Int(PALAVRAS as i64)),
                ("slot-bytes", Json::Int(SLOT_BYTES as i64)),
                ("sha256", Json::str(corpus_sha)),
            ]),
        ),
        (
            "instrumento",
            Json::obj(vec![
                ("nome", Json::str(VERSAO_INSTRUMENTO)),
                ("as-sha256", Json::str(tc.as_sha.clone())),
                ("objdump-sha256", Json::str(tc.objdump_sha.clone())),
                ("flags", Json::str(FLAGS_INSTRUMENTO)),
            ]),
        ),
        (
            "contagens",
            Json::obj(vec![
                ("slots", Json::Int(PALAVRAS as i64)),
                ("acordo", Json::Int(c.acordo as i64)),
                ("acordo-recusa", Json::Int(c.acordo_recusa as i64)),
                ("recusa-declarada", Json::Int(c.recusa_declarada as i64)),
                (
                    "divergencia-critica",
                    Json::Int(c.divergencia_critica as i64),
                ),
            ]),
        ),
        (
            "confronto-de-alvo",
            Json::obj(vec![
                (
                    "descricao",
                    Json::str("E4-1(iii): alvo efetivo nosso vs numero exibido pelo instrumento"),
                ),
                ("confrontados", Json::Int(c.alvo_confrontado as i64)),
                ("so-ferramenta", Json::Int(c.alvo_so_ferramenta as i64)),
                ("so-instrumento", Json::Int(c.alvo_so_instrumento as i64)),
                // R-3.2-b: sem a separação por forma, 4 208 desvios escondem os
                // 4 slots que de fato exercitam `abs.W`/`abs.L`.
                ("abs-w", Json::Int(c.alvo_abs_w as i64)),
                ("abs-l", Json::Int(c.alvo_abs_l as i64)),
                ("desvio-pc-relativo", Json::Int(c.alvo_desvio as i64)),
                (
                    "exemplos-abs",
                    Json::Arr(
                        c.exemplos_abs
                            .iter()
                            .map(|(palavra, forma, nosso, instrumento, texto)| {
                                Json::obj(vec![
                                    ("palavra", Json::str(format!("0x{palavra:04X}"))),
                                    ("forma", Json::str(*forma)),
                                    ("nosso", Json::str(format!("0x{nosso:08X}"))),
                                    ("instrumento", Json::str(format!("0x{instrumento:08X}"))),
                                    ("texto-do-instrumento", Json::str(texto.clone())),
                                ])
                            })
                            .collect(),
                    ),
                ),
                (
                    "nota",
                    Json::str(
                        "limite do espaco de operandos: os 14 words de cada slot sao 4E71, \
                         portanto todo abs.W confrontado tem bit15=0. O censo prova \
                         comprimento, aceite e numero exibido; a extensao de sinal de abs.W \
                         e provada pelos negativos N1/N2 com palavras construidas (0x8000, \
                         0xFFFF), nao por esta tabela. Nada aqui envolve execucao: paridade \
                         estatica, sem execucao de ROM.",
                    ),
                ),
            ]),
        ),
        (
            "histograma-short",
            Json::obj(vec![
                (
                    "bucket",
                    Json::str("nibble alto do word de instrução (0xn000..0xnFFF)"),
                ),
                ("total", Json::Int(c.instrumento_short as i64)),
                (
                    "por-bucket",
                    Json::Arr(
                        (0u16..16)
                            .map(|n| {
                                Json::obj(vec![
                                    ("nibble", Json::str(format!("{n:X}"))),
                                    (
                                        "quantidade",
                                        Json::Int(c.short_por_prefixo[n as usize] as i64),
                                    ),
                                ])
                            })
                            .collect(),
                    ),
                ),
            ]),
        ),
        ("recusas-indeclaradas", Json::Arr(indeclaradas)),
        (
            "criterio",
            Json::str("EXPECTATIONS-ETAPA3 4: divergencia-critica = 0"),
        ),
        (
            "divergencias",
            Json::Arr(
                c.divergencias
                    .iter()
                    .map(|(p, m)| {
                        Json::obj(vec![
                            ("palavra", Json::str(format!("0x{p:04X}"))),
                            ("descricao", Json::str(m.clone())),
                        ])
                    })
                    .collect(),
            ),
        ),
        ("recusas-declaradas", Json::Arr(grupos)),
    ])
}

fn texto_markdown(c: &Conta, corpus_sha: &str, tc: &Instrumento, total_registros: usize) -> String {
    let mut s = String::new();
    s.push_str(&format!(
        "# Auditoria exaustiva de máscaras — {ESQUEMA}\n\n\
         Receita: `tools/varredura-mascaras.sh` (este repositório). Corpus determinístico de \
         {PALAVRAS} slots de {SLOT_BYTES} bytes (word = índice do slot, resto `4E71`), \
         sha256 `{corpus_sha}`.\n\n\
         Instrumento pinado ({VERSAO_INSTRUMENTO}): `m68k-elf-as` sha256 `{}`, `m68k-elf-objdump` \
         sha256 `{}`;_flags_ `{FLAGS_INSTRUMENTO}`, {} registros no dump integral (o dump NÃO é \
         versionado — ver §2.2 das expectativas; este arquivo versiona receita, digesto do corpus, \
         contagens, lista de divergências e tabela de recusas declaradas).\n\n",
        tc.as_sha, tc.objdump_sha, total_registros
    ));
    s.push_str("## Contagens por classe\n\n");
    s.push_str("| classe | quantidade |\n|---|---|\n");
    s.push_str(&format!("| `acordo` | {} |\n", c.acordo));
    s.push_str(&format!("| `acordo-recusa` | {} |\n", c.acordo_recusa));
    s.push_str(&format!(
        "| `recusa-declarada` | {} |\n",
        c.recusa_declarada
    ));
    s.push_str(&format!(
        "| `divergencia-critica` | {} |\n\n",
        c.divergencia_critica
    ));
    s.push_str(&format!(
        "Soma: {} de {PALAVRAS} slots — a soma **tem** de bater com o número de slots; \
         a verificação é o teste `tests/varredura_mascaras_v2.rs`.\n\n",
        c.acordo + c.acordo_recusa + c.recusa_declarada + c.divergencia_critica
    ));
    s.push_str("## Confronto de alvo (E4-1(iii) e adendo R-3.2)\n\n");
    s.push_str(&format!(
        "Alvos confrontados entre as duas partes: **{}**. Só-ferramenta (nós publicamos aresta, \
         o instrumento não imprime número): {}; só-instrumento: {}. Um `acordo` de comprimento sem \
         alvo confrontado não é prova de endereço: por isso esta linha existe separada — e um \
         `confrontados = 0` com `divergencia-critica = 0` **não** é verde, é ausência de medição \
         (foi o estado da passada 4/5, registrado em R-3.2).\n\n",
        c.alvo_confrontado, c.alvo_so_ferramenta, c.alvo_so_instrumento
    ));
    s.push_str(&format!(
        "Por forma: `abs.W` {}, `abs.L` {}, desvio PC-relativo {} — os contadores absolutos \
         saem da receita do corpus (um slot por word de opcode: `4EB8`/`4EF8` e `4EB9`/`4EF9`), \
         não do decodificador.\n\n",
        c.alvo_abs_w, c.alvo_abs_l, c.alvo_desvio
    ));
    s.push_str("| palavra | forma | alvo nosso | número do instrumento | registro do instrumento |\n|---|---|---|---|---|\n");
    for (palavra, forma, nosso, instrumento, texto) in &c.exemplos_abs {
        s.push_str(&format!(
            "| `0x{palavra:04X}` | `{forma}` | `0x{nosso:08X}` | `0x{instrumento:08X}` | `{texto}` |\n"
        ));
    }
    s.push_str(
        "\n**Limite declarado (R-3.3)**: o preenchimento de todo slot é `4E71`, então cada \
         operando `abs.W` confrontado aqui tem `bit15 = 0`. Este censo auditam comprimento, aceite \
         e o número exibido; a **extensão de sinal** de `abs.W` é provada pelos negativos N1/N2 \
         (`tests/abs_w_v2.rs`, palavras construídas `0x8000`/`0xFFFF`), não por esta \
         tabela. Nada neste pacote envolve execução: é paridade estática, sem execução de ROM, e \
         nenhuma ROM comercial foi lida ou modificada para produzi-lo.\n\n",
    );
    s.push_str("## Histograma de `.short` do instrumento (E4-3)\n\n");
    s.push_str("| nibble alto | bucket | quantidade |\n|---|---|---|\n");
    for (n, qtd) in c.short_por_prefixo.iter().enumerate() {
        s.push_str(&format!(
            "| `0x{n:X}` | `0x{n:01X}000`–`0x{n:01X}FFF` | {} |\n",
            qtd
        ));
    }
    s.push_str(&format!(
        "\nTotal `.short`: **{}**.\n\n",
        c.instrumento_short
    ));
    s.push_str("## Divergências críticas\n\n");
    if c.divergencias.is_empty() {
        s.push_str("Nenhuma. Cota `divergencia-critica = 0` cumprida.\n\n");
    } else {
        s.push_str("| palavra | descrição |\n|---|---|\n");
        for (p, m) in &c.divergencias {
            s.push_str(&format!("| `0x{p:04X}` | {m} |\n"));
        }
        s.push('\n');
    }
    s.push_str("## Recusas declaradas (nossa recusa sobre forma que o instrumento lê)\n\n");
    s.push_str(
        "Cada grupo tem de ter justificativa e fonte nomeada; grupo sem entrada na tabela \
                sai como `divergencia-critica` pela regra E4-1(iv) e o gerador recusa produzir \
                evidência.\n\n",
    );
    s.push_str("| motivo | qtd | exemplos | classe | justificativa | fonte | evidencia do instrumento (todas as words do grupo) |\n|---|---|---|---|---|---|---|\n");
    for (motivo, g) in &c.grupos {
        let j = RECUSAS_DECLARADAS
            .iter()
            .find(|(m, ..)| *m == motivo.as_str());
        let (classe, just, fonte) = j
            .map(|(_, classe, just, fonte)| (*classe, *just, *fonte))
            .unwrap_or(("SEM-ENTRADA", "SEM-ENTRADA", "SEM-ENTRADA"));
        s.push_str(&format!(
            "| `{}` | {} | {} | {} | {} | {} | {} |\n",
            motivo.replace('|', "\\|"),
            g.qtd,
            g.exemplos
                .iter()
                .map(|p| format!("`0x{p:04X}`"))
                .collect::<Vec<_>>()
                .join(", "),
            classe,
            just,
            fonte,
            g.assinatura(4).replace('|', "\\|")
        ));
    }
    s.push_str("\n## O que isto não prova\n\n");
    s.push_str(
        "- Paridade de comprimento com o objdump é árbitro de **exibição**, não equivalência \
                arquitetural (Apêndice B das expectativas).\n\
                 - O corpus cobre o espaço de **palavras de instrução**; máscaras que só se \
                distinguem por words de extensão repetidos (listas `MOVEM`, modos de campo) entram \
                na auditoria pelo caminho do instrumento, não por amostragem de conteúdo.\n\
                 - Nada aqui é observação em runtime.\n",
    );
    s
}

fn sha_arquivo(p: &std::path::Path) -> String {
    let b = std::fs::read(p).unwrap_or_else(|e| panic!("ler {}: {e}", p.display()));
    rex_gameplay::sha256::sha256_hex(&b)
}

fn main() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(modo) = args.first().map(|s| s.as_str()) else {
        return Err("uso: mascaras <emit-corpus|classificar> ...".to_string());
    };
    if modo == "emit-corpus" {
        let destino = args.get(1).ok_or("falta <arquivo.bin>")?;
        std::fs::write(destino, gerar_corpus()).map_err(|e| e.to_string())?;
        println!("corpus: {destino} ({} bytes)", PALAVRAS * SLOT_BYTES);
        return Ok(());
    }
    if modo != "classificar" {
        return Err(format!("modo desconhecido: {modo}"));
    }
    let mut it = args.iter().skip(1);
    let corpus_path = it.next().ok_or("falta <corpus.bin>")?.clone();
    let dump_path = it.next().ok_or("falta <dump.txt>")?.clone();
    let saida_json = it.next().ok_or("falta <saida.json>")?.clone();
    let saida_md = it.next().ok_or("falta <saida.md>")?.clone();
    let tc_dir = it.next().ok_or("falta <dir-do-toolchain>")?.clone();

    let corpus = std::fs::read(&corpus_path).map_err(|e| e.to_string())?;
    if corpus.len() != PALAVRAS * SLOT_BYTES {
        return Err(format!(
            "corpus com {} bytes, esperado {}",
            corpus.len(),
            PALAVRAS * SLOT_BYTES
        ));
    }
    let dump = std::fs::read_to_string(&dump_path).map_err(|e| e.to_string())?;
    let recs = parse_objdump(&dump);
    let c = classificar(&corpus, &recs);

    let dir_tc = std::path::PathBuf::from(&tc_dir);
    let instrumento = Instrumento {
        as_sha: sha_arquivo(&dir_tc.join("m68k-elf-as")),
        objdump_sha: sha_arquivo(&dir_tc.join("m68k-elf-objdump")),
    };
    let corpus_sha = rex_gameplay::sha256::sha256_hex(&corpus);

    if c.divergencia_critica != 0 {
        // Lista integral (E4-3) escrita SEMPRE que a cota falha: é o insumo da
        // correção de máscara. Não entra no índice — o artefato versionado só
        // existe quando a cota é cumprida.
        let lateral = format!("{saida_md}.divergencias.txt");
        let mut corpo = String::new();
        for (p, d) in &c.divergencias {
            corpo.push_str(&format!("0x{p:04X}\t{d}\n"));
        }
        std::fs::write(&lateral, corpo).map_err(|e| e.to_string())?;
        let mut msg = format!(
            "divergencia-critica = {} (cota E4-2: 0); lista integral em {lateral}\n",
            c.divergencia_critica
        );
        if !c.recusas_indeclaradas.is_empty() {
            // Leitura do instrumento para cada mostra: sem ela, a tabela de
            // justificativas de E4-1(iv) teria que ser escrita de memoria. Com
            // ela, cada linha da tabela cita o que o arbitro imprime naquele word.
            let mut por_slot: BTreeMap<u32, &Rec> = BTreeMap::new();
            for r in &recs {
                if r.addr % SLOT_BYTES as u32 == 0 {
                    por_slot.entry(r.addr / SLOT_BYTES as u32).or_insert(r);
                }
            }
            msg.push_str(&format!(
                "\n{} grupo(s) de recusa sem motivo declaravel (E4-1(iv)):\n",
                c.recusas_indeclaradas.len()
            ));
            for (motivo, g) in &c.recusas_indeclaradas {
                let exemplos = g
                    .exemplos
                    .iter()
                    .map(|p| format!("0x{p:04X}"))
                    .collect::<Vec<_>>()
                    .join(",");
                let leituras = g
                    .exemplos
                    .iter()
                    .take(2)
                    .map(|p| match por_slot.get(&(*p as u32)) {
                        Some(r) => {
                            format!(
                                "0x{p:04X} instrumento: {} [{}] ({}B)",
                                r.token, r.text, r.len
                            )
                        }
                        None => format!("0x{p:04X} instrumento: sem registro"),
                    })
                    .collect::<Vec<_>>()
                    .join(" | ");
                msg.push_str(&format!(
                    "  [{}] {motivo}\n      ex: {exemplos}\n      {leituras}\n      \
                     grupo inteiro: {}\n",
                    g.qtd,
                    g.assinatura(4)
                ));
            }
        }
        let outras: Vec<&(u16, String)> = c
            .divergencias
            .iter()
            .filter(|(_, d)| !d.starts_with("(iv)"))
            .collect();
        msg.push_str(&format!(
            "\ndivergencias de comprimento/alvo/aceite: {} (amostra de 20)\n",
            outras.len()
        ));
        for (p, d) in outras.into_iter().take(20) {
            msg.push_str(&format!("  0x{p:04X}: {d}\n"));
        }
        return Err(msg);
    }

    let json = texto_json(&c, &corpus_sha, &instrumento).pretty();
    std::fs::write(&saida_json, &json).map_err(|e| e.to_string())?;
    let md = texto_markdown(&c, &corpus_sha, &instrumento, recs.len());
    std::fs::write(&saida_md, &md).map_err(|e| e.to_string())?;
    let mut stdout = std::io::stdout();
    writeln!(
        stdout,
        "slots={} acordo={} acordo-recusa={} recusa-declarada={} divergencia-critica={} \
         alvo-confrontado={} short={}",
        PALAVRAS,
        c.acordo,
        c.acordo_recusa,
        c.recusa_declarada,
        c.divergencia_critica,
        c.alvo_confrontado,
        c.instrumento_short
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
