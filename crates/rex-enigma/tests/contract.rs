// Contrato do decoder Enigma sobre fixtures AUTORAIS e reproduzíveis: nenhum
// byte de ROM comercial e nenhum corpus BYOR. O oraculo e um codificador de
// teste escrito aqui (leitor/escritor de bits independente do decoder), entao
// "decode(encode(x)) == x" nao e o decoder concordando consigo mesmo.

use rex_enigma::{decode, DecodeOptions, EnigmaError, Limits, HEADER_LEN};

struct BitWriter {
    bytes: Vec<u8>,
    nbits: usize,
}

impl BitWriter {
    fn new() -> Self {
        BitWriter {
            bytes: Vec::new(),
            nbits: 0,
        }
    }
    fn bit(&mut self, b: u16) {
        if self.nbits % 8 == 0 {
            self.bytes.push(0);
        }
        if b & 1 == 1 {
            let last = self.bytes.len() - 1;
            self.bytes[last] |= 0x80 >> (self.nbits % 8);
        }
        self.nbits += 1;
    }
    fn bits(&mut self, v: u16, n: u8) {
        for i in (0..n).rev() {
            self.bit(v >> i);
        }
    }
}

/// Codificador de teste (variante plain): usa os cinco tipos de token.
/// `pl` bits de valor inline; `mask` = byte PCCVH.
fn encode(words: &[u16], pl: u8, mask: u8, incr: u16, common: u16) -> Vec<u8> {
    let mut w = BitWriter::new();
    let mut next_incr = incr;
    let mut i = 0;
    let inline_val = |w: &mut BitWriter, v: u16| {
        for j in (0..5u8).rev() {
            if (mask >> j) & 1 == 1 {
                w.bit(v >> (j + 11));
            }
        }
        let flag_bits: u16 = (0..5u8)
            .filter(|j| (mask >> j) & 1 == 1)
            .map(|j| 1u16 << (j + 11))
            .sum();
        w.bits(v & !flag_bits & ((1u32 << pl) as u16).wrapping_sub(1), pl);
    };
    while i < words.len() {
        let rest = &words[i..];
        // corrida do valor comum
        let n_common = rest.iter().take(16).take_while(|&&x| x == common).count();
        // corrida incrementing (valor persistente)
        let mut n_incr = 0;
        while n_incr < rest.len().min(16) && rest[n_incr] == next_incr.wrapping_add(n_incr as u16) {
            n_incr += 1;
        }
        if n_common > 0 && n_common >= n_incr {
            w.bit(0);
            w.bit(1);
            w.bits((n_common - 1) as u16, 4);
            i += n_common;
        } else if n_incr > 0 {
            w.bit(0);
            w.bit(0);
            w.bits((n_incr - 1) as u16, 4);
            next_incr = next_incr.wrapping_add(n_incr as u16);
            i += n_incr;
        } else {
            // corrida inline de delta 0/+1/-1 com 2+ elementos, senao literais
            let v0 = rest[0];
            let mut best = (3u16, 1usize);
            for (mode, step) in [(0u16, 0u16), (1, 1), (2, 0xFFFF)] {
                let mut n = 1;
                while n < rest.len().min(16)
                    && rest[n] == v0.wrapping_add(step.wrapping_mul(n as u16))
                {
                    n += 1;
                }
                if n > best.1 {
                    best = (mode, n);
                }
            }
            if best.0 != 3 {
                w.bit(1);
                w.bits(best.0, 2);
                w.bits((best.1 - 1) as u16, 4);
                inline_val(&mut w, v0);
                i += best.1;
            } else {
                // 16 literais (cnt4=0xF) seria o terminador: o maximo e 15
                let n = rest.len().min(15);
                w.bit(1);
                w.bits(3, 2);
                w.bits((n - 1) as u16, 4);
                for &v in &rest[..n] {
                    inline_val(&mut w, v);
                }
                i += n;
            }
        }
    }
    w.bits(0x7F, 7); // terminador 1|11|1111
    let mut out = vec![pl, mask];
    out.extend_from_slice(&incr.to_be_bytes());
    out.extend_from_slice(&common.to_be_bytes());
    out.extend_from_slice(&w.bytes);
    out
}

fn opts() -> DecodeOptions<'static> {
    DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: 1 << 20,
            work_limit: 1 << 20,
        },
        cancel: None,
    }
}

fn be(words: &[u16]) -> Vec<u8> {
    words.iter().flat_map(|w| w.to_be_bytes()).collect()
}

/// Grade 64x64 de IDs de 1 byte (2048 palavras): faixas, rampas e ruido
/// deterministico — autoral, sem relacao com qualquer jogo.
fn grade_autoral() -> Vec<u16> {
    let mut seed = 0x2545_F491u32;
    let mut ids = vec![0u8; 4096];
    for r in 0..64usize {
        for c in 0..64usize {
            ids[r * 64 + c] = match r % 4 {
                0 => 0,
                1 => (c as u8) & 0x3F,
                2 => {
                    seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                    ((seed >> 24) as u8) % 79
                }
                _ => 0x2A,
            };
        }
    }
    ids.chunks(2)
        .map(|p| u16::from_be_bytes([p[0], p[1]]))
        .collect()
}

#[test]
fn roundtrip_grade_autoral_com_valor_de_11_bits() {
    let words: Vec<u16> = grade_autoral().iter().map(|w| w & 0x07FF).collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let d = decode(&stream, &opts()).expect("decode");
    assert_eq!(d.bytes_be(), be(&words));
    assert_eq!(d.words.len(), 2048);
    assert!(d.stats.terminador);
}

#[test]
fn roundtrip_palavras_completas_com_flags_pccvh() {
    let mut seed = 7u32;
    let words: Vec<u16> = (0..600)
        .map(|i| {
            seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12_345);
            if i % 7 < 3 {
                0xA123
            } else {
                (seed >> 8) as u16
            }
        })
        .collect();
    let stream = encode(&words, 11, 0x1F, 0xA120, 0xA123);
    let d = decode(&stream, &opts()).expect("decode");
    assert_eq!(d.words, words);
}

#[test]
fn delta_menos_um_dobra_em_zero_sem_panic() {
    let words = vec![1u16, 0, 0xFFFF, 0xFFFE];
    let stream = encode(&words, 11, 0x1F, 0x0000, 0x0000);
    // mod 2^16 e semantica do console; 0xFFFF exige as flags para caber em pl=11
    let d = decode(&stream, &opts()).expect("decode");
    assert_eq!(d.words, words);
}

#[test]
fn contabilidade_separa_lidos_padding_armazenado_e_saida() {
    let words: Vec<u16> = grade_autoral().iter().map(|w| w & 0x07FF).collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let d = decode(&stream, &opts()).expect("decode");
    let s = d.stats;
    assert_eq!(
        s.bytes_lidos,
        HEADER_LEN + (s.bits_lidos as usize).div_ceil(8)
    );
    assert_eq!(
        s.bytes_lidos,
        stream.len(),
        "stream sem bytes alem do consumo"
    );
    assert_eq!(s.padding_console, s.bytes_lidos % 2);
    assert_eq!(s.bytes_armazenados, s.bytes_lidos + s.padding_console);
    assert_eq!(s.bytes_armazenados % 2, 0);
    assert_eq!(
        d.bytes_be().len(),
        4096,
        "saida descomprimida independente do consumo"
    );
    // bytes alem do terminador nao sao consumo
    let mut longo = stream.clone();
    longo.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]);
    let d2 = decode(&longo, &opts()).expect("decode longo");
    assert_eq!(d2.stats, d.stats);
    assert_eq!(d2.words, d.words);
}

#[test]
fn todo_prefixo_proprio_do_consumo_e_truncado() {
    let words: Vec<u16> = grade_autoral()
        .iter()
        .map(|w| w & 0x07FF)
        .take(200)
        .collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let lidos = decode(&stream, &opts()).expect("ok").stats.bytes_lidos;
    for n in 0..lidos {
        assert_eq!(
            decode(&stream[..n], &opts()),
            Err(EnigmaError::Truncated),
            "prefixo de {n} bytes"
        );
    }
}

#[test]
fn byte_adulterado_nunca_gera_panic_e_respeita_os_limites() {
    let words: Vec<u16> = grade_autoral()
        .iter()
        .map(|w| w & 0x07FF)
        .take(300)
        .collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let o = DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: 8192,
            work_limit: 100_000,
        },
        cancel: None,
    };
    let original = decode(&stream, &o).unwrap().bytes_be();
    let mut diferiu = 0;
    for pos in 0..stream.len() {
        for bit in 0..8 {
            let mut m = stream.clone();
            m[pos] ^= 1 << bit;
            match decode(&m, &o) {
                Ok(d) => {
                    assert!(d.bytes_be().len() <= 8192);
                    if d.bytes_be() != original {
                        diferiu += 1;
                    }
                }
                Err(_) => diferiu += 1,
            }
        }
    }
    assert!(
        diferiu > 0,
        "adulteracao tem de ser detectavel por saida ou erro"
    );
}

#[test]
fn cabecalho_pccvh_e_packet_length() {
    let base = |pl: u8, m: u8| {
        let mut s = vec![pl, m, 0, 0, 0, 0];
        s.push(0xFF); // terminador no 1o token
        s.push(0xFF);
        s
    };
    for pl in 1..=11u8 {
        assert!(decode(&base(pl, 0x1F), &opts()).is_ok(), "pl={pl}");
    }
    for pl in [0u8, 12, 16, 255] {
        assert_eq!(
            decode(&base(pl, 0), &opts()),
            Err(EnigmaError::MalformedHeader),
            "pl={pl}"
        );
    }
    for m in 0x00..=0x1Fu8 {
        assert!(decode(&base(4, m), &opts()).is_ok(), "mask={m:#x}");
    }
    for m in [0x20u8, 0x40, 0x80, 0xFF] {
        assert_eq!(
            decode(&base(4, m), &opts()),
            Err(EnigmaError::MalformedHeader),
            "mask={m:#x}"
        );
    }
    assert_eq!(decode(&[], &opts()), Err(EnigmaError::Truncated));
    assert_eq!(
        decode(&[4, 0, 0, 0, 0], &opts()),
        Err(EnigmaError::Truncated)
    );
}

#[test]
fn limite_de_saida_e_exato_e_nao_entrega_saida_parcial() {
    let words: Vec<u16> = grade_autoral().iter().map(|w| w & 0x07FF).collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let com = |max| DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: max,
            work_limit: 1 << 20,
        },
        cancel: None,
    };
    assert!(decode(&stream, &com(4096)).is_ok());
    assert_eq!(
        decode(&stream, &com(4094)),
        Err(EnigmaError::ExcessiveOutput)
    );
    assert_eq!(decode(&stream, &com(0)), Err(EnigmaError::ExcessiveOutput));
}

#[test]
fn limite_de_trabalho_e_exato() {
    let words: Vec<u16> = grade_autoral().iter().map(|w| w & 0x07FF).collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let tokens = decode(&stream, &opts()).unwrap().stats.tokens;
    let com = |work| DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: 1 << 20,
            work_limit: work,
        },
        cancel: None,
    };
    assert!(decode(&stream, &com(tokens)).is_ok());
    assert_eq!(
        decode(&stream, &com(tokens - 1)),
        Err(EnigmaError::WorkLimit)
    );
}

#[test]
fn cancelamento_cooperativo_em_fronteira_de_token() {
    use std::cell::Cell;
    let words: Vec<u16> = grade_autoral().iter().map(|w| w & 0x07FF).collect();
    let stream = encode(&words, 11, 0x00, 0, 0x002A);
    let chamadas = Cell::new(0u32);
    let cancel = || {
        chamadas.set(chamadas.get() + 1);
        chamadas.get() > 5
    };
    let o = DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: 1 << 20,
            work_limit: 1 << 20,
        },
        cancel: Some(&cancel),
    };
    assert_eq!(decode(&stream, &o), Err(EnigmaError::Cancelled));
    assert_eq!(chamadas.get(), 6, "cancel consultado uma vez por token");
}

#[test]
fn entrada_aleatoria_nunca_entra_em_panic() {
    let mut seed = 0xC0FF_EE11u32;
    for _ in 0..2000 {
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        let len = (seed >> 24) as usize % 96;
        let mut s: Vec<u8> = Vec::with_capacity(len);
        for _ in 0..len {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            s.push((seed >> 16) as u8);
        }
        if s.len() >= 2 {
            s[0] = 1 + (s[0] % 11);
            s[1] &= 0x1F;
        }
        let o = DecodeOptions {
            value_offset: (seed & 0xFFFF) as u16,
            limits: Limits {
                max_output_bytes: 512,
                work_limit: 10_000,
            },
            cancel: None,
        };
        if let Ok(d) = decode(&s, &o) {
            assert!(d.bytes_be().len() <= 512);
            assert!(d.stats.bytes_lidos <= s.len());
        }
    }
}

#[test]
fn value_offset_soma_mod_2_16_no_incr_comum_e_inline() {
    // incr=0xFFFF, common=0x0001, offset=2: incr 0x0001; common 0x0003.
    // tokens: incr-run(1) | common-run(1) | inline literal(1, pl=4, 0x5) | fim
    let mut w = BitWriter::new();
    w.bit(0);
    w.bit(0);
    w.bits(0, 4);
    w.bit(0);
    w.bit(1);
    w.bits(0, 4);
    w.bit(1);
    w.bits(3, 2);
    w.bits(0, 4);
    w.bits(0x5, 4);
    w.bits(0x7F, 7);
    let mut s = vec![4u8, 0x00, 0xFF, 0xFF, 0x00, 0x01];
    s.extend_from_slice(&w.bytes);
    let o = DecodeOptions {
        value_offset: 2,
        ..opts()
    };
    assert_eq!(decode(&s, &o).unwrap().words, vec![0x0001, 0x0003, 0x0007]);
}
