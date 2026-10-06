//! Rodada B5 — `value_offset` conforme o desempacotador real do console.
//!
//! Expectativas CONGELADAS ANTES da correcao (ver `EXPECTATIONS-ENIGMA-B5.md`).
//! Cada valor esperado abaixo foi calculado A MAO a partir do asm pinado
//! (`_inc/Decompression/Enigma Decompression.asm`, s1disasm 064e3c68…):
//!
//!   d3 = base                       (movea.w d0,a3 ; move.w a3,d3)
//!   P  (mascara 0x10): se flag -> ori.w  #$8000,d3
//!   C1 (mascara 0x08): se flag -> addi.w #$4000,d3
//!   C0 (mascara 0x04): se flag -> addi.w #$2000,d3
//!   V  (mascara 0x02): se flag -> ori.w  #$1000,d3
//!   H  (mascara 0x01): se flag -> ori.w  #$0800,d3
//!   valor = (raw & mascara_pl) + d3  (add.w d3,d1), tudo mod 2^16
//!   incr   = hdr + base (adda.w) ; comum = hdr + base (adda.w)
//!
//! Nao ha oraculo de execucao 68000 independente nesta maquina: os valores sao
//! derivacao manual do mesmo asm que o decoder implementa (UMA linha de
//! entendimento, nao duas — ver o documento).

use rex_enigma::{decode, DecodeOptions, EnigmaError, Limits};

fn bits_para_bytes(bits: &str) -> Vec<u8> {
    let limpos: Vec<u8> = bits.chars().filter(|c| *c == '0' || *c == '1').map(|c| c as u8 - b'0').collect();
    let mut out = Vec::new();
    for chunk in limpos.chunks(8) {
        let mut b = 0u8;
        for x in chunk {
            b = (b << 1) | *x;
        }
        out.push(b << (8 - chunk.len()));
    }
    out
}

/// header + tokens + terminador `1|11|1111`.
fn stream(pl: u8, mask: u8, incr: u16, common: u16, bits: &str) -> Vec<u8> {
    let mut s = vec![pl, mask];
    s.extend_from_slice(&incr.to_be_bytes());
    s.extend_from_slice(&common.to_be_bytes());
    s.extend(bits_para_bytes(&format!("{bits} 1111111")));
    s
}

fn opts(offset: u16, max: usize) -> DecodeOptions<'static> {
    DecodeOptions { value_offset: offset, limits: Limits { max_output_bytes: max, work_limit: 4_000_000 }, cancel: None }
}

fn palavras(s: &[u8], offset: u16) -> Vec<u16> {
    decode(s, &opts(offset, 65536)).expect("decode ok").words
}

const I1: &str = "1000000"; // 1|00|0000: inline lido uma vez, repetido 1x

#[test]
fn inline_prioridade_e_offset_do_defeito_reproduzido() {
    // pl=4, mask=P. flag=1, raw=0101.
    let s = stream(4, 0x10, 0, 0, &format!("{I1} 1 0101"));
    assert_eq!(palavras(&s, 0x0000), vec![0x8005]);
    // DEFEITO: o pacote integrado dava 0005 (soma 8000+8000 em vez de OR no d3).
    assert_eq!(palavras(&s, 0x8000), vec![0x8005]);
    assert_eq!(palavras(&s, 0xC001), vec![0xC006]); // C001|8000 = C001 ; +5
    assert_eq!(palavras(&s, 0x7FFF), vec![0x0004]); // 7FFF|8000 = FFFF ; +5 = 1_0004 -> 0004
}

#[test]
fn inline_sem_flag_so_soma_o_offset() {
    let s = stream(4, 0x10, 0, 0, &format!("{I1} 0 0101"));
    assert_eq!(palavras(&s, 0x0000), vec![0x0005]);
    assert_eq!(palavras(&s, 0x8000), vec![0x8005]);
    assert_eq!(palavras(&s, 0xC001), vec![0xC006]);
    assert_eq!(palavras(&s, 0xFFFF), vec![0x0004]);
}

#[test]
fn paleta_alta_e_baixa_somam_com_carry_e_nao_fazem_or() {
    let hi = stream(4, 0x08, 0, 0, &format!("{I1} 1 0101"));
    assert_eq!(palavras(&hi, 0x0000), vec![0x4005]);
    assert_eq!(palavras(&hi, 0x4000), vec![0x8005]); // 4000+4000 (OR daria 4005)
    assert_eq!(palavras(&hi, 0x8000), vec![0xC005]);
    assert_eq!(palavras(&hi, 0xC001), vec![0x0006]); // C001+4000 = 1_0001 -> 0001 ; +5
    let lo = stream(4, 0x04, 0, 0, &format!("{I1} 1 0101"));
    assert_eq!(palavras(&lo, 0x0000), vec![0x2005]);
    assert_eq!(palavras(&lo, 0x2000), vec![0x4005]); // 2000+2000 (OR daria 2005)
    assert_eq!(palavras(&lo, 0xE000), vec![0x0005]); // E000+2000 = 1_0000 -> 0000 ; +5
}

#[test]
fn flips_fazem_or_e_nao_somam() {
    let v = stream(4, 0x02, 0, 0, &format!("{I1} 1 0101"));
    assert_eq!(palavras(&v, 0x0000), vec![0x1005]);
    assert_eq!(palavras(&v, 0x1000), vec![0x1005]); // 1000|1000 (soma daria 2005)
    let h = stream(4, 0x01, 0, 0, &format!("{I1} 1 0101"));
    assert_eq!(palavras(&h, 0x0000), vec![0x0805]);
    assert_eq!(palavras(&h, 0x0800), vec![0x0805]); // 0800|0800 (soma daria 1005)
}

#[test]
fn todas_as_flags_na_ordem_do_asm() {
    let tudo = stream(4, 0x1F, 0, 0, &format!("{I1} 11111 0101"));
    assert_eq!(palavras(&tudo, 0x0000), vec![0xF805]);
    assert_eq!(palavras(&tudo, 0x8000), vec![0xF805]); // P ja em 8000: OR nao duplica
    // C001: P -> C001 ; C1 -> 1_0001=0001 ; C0 -> 2001 ; V -> 3001 ; H -> 3801 ; +5
    assert_eq!(palavras(&tudo, 0xC001), vec![0x3806]);
    // flags P,C0,H (10101): C001 ; C0 -> E001 ; H -> E801 ; +5
    let alt = stream(4, 0x1F, 0, 0, &format!("{I1} 10101 0101"));
    assert_eq!(palavras(&alt, 0xC001), vec![0xE806]);
    // mascara 0x0A (C1,V) so le 2 bits de flag: 8000 ; C1 -> C000 ; V -> D000 ; +5
    let parcial = stream(4, 0x0A, 0, 0, &format!("{I1} 11 0101"));
    assert_eq!(palavras(&parcial, 0x8000), vec![0xD005]);
}

#[test]
fn packet_length_maximo_do_dominio_com_offset() {
    let s = stream(11, 0x00, 0, 0, &format!("{I1} 11111111111"));
    assert_eq!(palavras(&s, 0x0000), vec![0x07FF]);
    assert_eq!(palavras(&s, 0x8001), vec![0x8800]); // 7FF+8001
}

#[test]
fn incremental_soma_offset_persiste_e_da_volta() {
    // 0|0|0010 (cnt 3) depois 0|0|0000 (cnt 1): o valor persiste entre tokens
    let s = stream(1, 0, 0x0010, 0, "000010 000000");
    assert_eq!(palavras(&s, 0x8000), vec![0x8010, 0x8011, 0x8012, 0x8013]);
    assert_eq!(palavras(&s, 0x0000), vec![0x0010, 0x0011, 0x0012, 0x0013]);
    let w = stream(1, 0, 0xFFFE, 0, "000010");
    assert_eq!(palavras(&w, 0x0003), vec![0x0001, 0x0002, 0x0003]); // FFFE+3 = 1_0001
}

#[test]
fn comum_soma_offset_incluindo_wrap() {
    let c = stream(1, 0, 0, 0x0007, "010001"); // 0|1|0001 cnt 2
    assert_eq!(palavras(&c, 0x0000), vec![0x0007, 0x0007]);
    assert_eq!(palavras(&c, 0xC001), vec![0xC008, 0xC008]);
    assert_eq!(palavras(&c, 0x8000), vec![0x8007, 0x8007]);
    let w = stream(1, 0, 0, 0xFFFF, "010001");
    assert_eq!(palavras(&w, 0x0001), vec![0x0000, 0x0000]);
    // common NAO recebe flags: o stream so tem flags nos tokens inline
    let p = stream(4, 0x10, 0, 0x0001, "010000");
    assert_eq!(palavras(&p, 0x8000), vec![0x8001]);
}

#[test]
fn corridas_inline_repetem_incrementam_e_decrementam_o_valor_ja_somado() {
    // modo 1 (+1), cnt 3, flag P, raw F, base 0: d1 = 800F -> 800F, 8010, 8011
    let m1 = stream(4, 0x10, 0, 0, "1010010 1 1111");
    assert_eq!(palavras(&m1, 0x0000), vec![0x800F, 0x8010, 0x8011]);
    // modo 2 (-1), cnt 3, sem flags, raw 1, base 8000: 8001, 8000, 7FFF
    let m2 = stream(4, 0x00, 0, 0, "1100010 0001");
    assert_eq!(palavras(&m2, 0x8000), vec![0x8001, 0x8000, 0x7FFF]);
    // modo 0 repete: C004 C004
    let m0 = stream(4, 0x00, 0, 0, "1000001 0011");
    assert_eq!(palavras(&m0, 0xC001), vec![0xC004, 0xC004]);
    // modo 3 (valores independentes): flags novas em cada um
    let m3 = stream(4, 0x10, 0, 0, "1110001 1 0001 0 0010");
    assert_eq!(palavras(&m3, 0x8000), vec![0x8001, 0x8002]);
    assert_eq!(palavras(&m3, 0x0000), vec![0x8001, 0x0002]);
}

fn exato(s: &[u8], palavras_esperadas: usize) {
    let n = palavras_esperadas * 2;
    assert_eq!(decode(s, &opts(0, n)).expect("no limite exato").words.len(), palavras_esperadas);
    assert_eq!(decode(s, &opts(0, n + 2)).expect("folga").words.len(), palavras_esperadas);
    assert_eq!(decode(s, &opts(0, n - 1)), Err(EnigmaError::ExcessiveOutput));
    assert_eq!(decode(s, &opts(0, n - 2)), Err(EnigmaError::ExcessiveOutput));
}

#[test]
fn limite_exato_de_saida_nos_tres_caminhos() {
    exato(&stream(1, 0, 0x0001, 0, "001111"), 16); // incremental, 16 palavras
    exato(&stream(1, 0, 0, 0x0001, "011111"), 16); // comum, 16 palavras
    exato(&stream(4, 0x00, 0, 0, "1001111 0001"), 16); // inline repetido
    // inline modo 3: cccc=14 -> 15 valores independentes
    exato(&stream(4, 0x00, 0, 0, &format!("1111110 {}", "0001 ".repeat(15))), 15);
}
