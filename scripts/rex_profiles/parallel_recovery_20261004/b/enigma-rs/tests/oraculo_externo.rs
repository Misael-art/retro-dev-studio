// Paridade contra a referencia externa pinada (E23-E28 do congelamento
// EXPECTATIONS-ENIGMA-B4.md, commit 3268ac7). Os numeros abaixo estao
// COPIADOS DO DOCUMENTO CONGELADO — nao sao recalculados pelo produto.
//
// Gate local: exige a ROM pinada e as fixtures do corpus-B no host. Se
// faltarem, o teste falha com mensagem explicita (nao existe skip silencioso).

use rex_enigma::{decode, DecodeOptions, EnigmaError, Limits};

const ROM_SHA: &str = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb";

fn env_ou(padrao: &str, var: &str) -> String {
    std::env::var(var).unwrap_or_else(|_| padrao.to_string())
}

fn rom() -> Vec<u8> {
    let home = env_ou("/home/misael", "HOME");
    let caminho = env_ou(
        &format!("{home}/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin"),
        "REX_ENIGMA_ROM",
    );
    let dados = std::fs::read(&caminho)
        .unwrap_or_else(|e| panic!("GATE-LOCAL: ROM ausente ({caminho}): {e}"));
    let sha = rex_kosinski::edit::sha256_hex(&dados);
    assert_eq!(sha, ROM_SHA, "GATE-LOCAL: ROM nao confere com o pinnado");
    dados
}

fn fixdir() -> String {
    env_ou(
        "/home/misael/RDS-REX-CORPUS-B/data/rex_corpus_b/vendor/data/rex_profiles/codec/enigma",
        "REX_ENIGMA_FIXDIR",
    )
}

fn le(p: &str) -> Vec<u8> {
    std::fs::read(p).unwrap_or_else(|e| panic!("GATE-LOCAL: fixture ausente ({p}): {e}"))
}

fn sha(b: &[u8]) -> String {
    rex_kosinski::edit::sha256_hex(b)
}

fn opts(max_out: usize, work: u64) -> DecodeOptions<'static> {
    DecodeOptions {
        value_offset: 0,
        limits: Limits { max_output_bytes: max_out, work_limit: work },
        cancel: None,
    }
}

// ------------------------------------------------------------------- E23

#[test]
fn e23_paridade_seis_streams_ss() {
    let r = rom();
    let casos: [(usize, usize, usize, usize, &str); 6] = [
        (0x65432, 634, 0, 634, "322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0"),
        (0x656ac, 1042, 0, 1042, "4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d"),
        (0x65abe, 860, 0, 860, "3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954"),
        (0x65e1a, 1242, 0, 1242, "04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7"),
        (0x662f4, 1233, 1, 1234, "5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8"),
        (0x667c6, 784, 0, 784, "78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94"),
    ];
    for (off, lidos, pad, arm, sha_esperada) in casos {
        let d = decode(&r[off..], &opts(8 * 1024 * 1024, 4_000_000))
            .unwrap_or_else(|e| panic!("0x{off:X}: ERRO {e:?}"));
        let bytes = d.bytes_be();
        assert_eq!(bytes.len(), 4096, "0x{off:X}");
        assert_eq!(sha(&bytes), sha_esperada, "0x{off:X} sha");
        assert_eq!(d.stats.bytes_lidos, lidos, "0x{off:X} lidos");
        assert_eq!(d.stats.padding_console, pad, "0x{off:X} padding");
        assert_eq!(d.stats.bytes_armazenados, arm, "0x{off:X} armazenados");
        assert!(d.stats.terminador, "0x{off:X} terminador");
        let d2 = decode(&r[off..], &opts(8 * 1024 * 1024, 4_000_000)).expect("ok2");
        assert_eq!(d2.bytes_be(), bytes, "0x{off:X} determinismo");
    }
}

// ------------------------------------------------------------------- E24

#[test]
fn e24_paridade_dez_pares_plain() {
    let f = fixdir();
    // (nome, bytes_lidos congelados)
    let casos = [
        ("alternating_runs", 84usize),
        ("big_deltas", 91),
        ("const_500", 18),
        ("empty", 7),
        ("noise_1k", 1058),
        ("planes_4k", 4222),
        ("ramp_signed", 17),
        ("single_word", 8),
        ("threshold_edge", 10),
        ("zeros_64", 11),
    ];
    for (nome, lidos) in casos {
        let eni = le(&format!("{f}/plain/{nome}.eni"));
        let bin = le(&format!("{f}/plain/{nome}.bin"));
        let d = decode(&eni, &opts(8 * 1024 * 1024, 4_000_000))
            .unwrap_or_else(|e| panic!("{nome}: ERRO {e:?}"));
        assert_eq!(d.bytes_be(), bin, "{nome} saida != .bin");
        assert_eq!(d.stats.bytes_lidos, lidos, "{nome} lidos");
        assert_eq!(d.stats.padding_console, lidos % 2, "{nome} padding");
        assert_eq!(d.stats.bytes_armazenados % 2, 0, "{nome} arm par");
        assert!(d.stats.terminador, "{nome} terminador");
        // bytes do ficheiro alem do consumo nao sao consumo
        assert!(eni.len() >= d.stats.bytes_lidos, "{nome} ficheiro < lidos");
    }
}

// ------------------------------------------------------------------- E25

#[test]
fn e25_negativos_corpus_com_codigos_do_produto() {
    let f = fixdir();
    let o = opts(8 * 1024 * 1024, 4_000_000);
    let e01 = le(&format!("{f}/negative/e01_odd_bytes_tail.bin"));
    assert_eq!(decode(&e01, &o), Err(EnigmaError::Truncated));
    let e02 = le(&format!("{f}/negative/e02_truncated_last_byte.eni"));
    assert_eq!(decode(&e02, &o), Err(EnigmaError::Truncated));
    // e03: [4:6] e o common value — aceita, byte-identica ao planes_4k pleno
    let e03 = le(&format!("{f}/negative/e03_len_inflated.eni"));
    let bin = le(&format!("{f}/plain/planes_4k.bin"));
    let d3 = decode(&e03, &o).expect("e03 aceite");
    assert_eq!(d3.bytes_be(), bin, "e03 != planes_4k pleno");
    assert_eq!(d3.stats.bytes_lidos, 4222, "e03 lidos");
    // e04 (retificacao §4): aceita, saida identica ao const_500 pleno
    let e04 = le(&format!("{f}/negative/e04_mode_02.eni"));
    let const_bin = le(&format!("{f}/plain/const_500.bin"));
    let d4 = decode(&e04, &o).expect("e04 aceite");
    assert_eq!(d4.bytes_be(), const_bin, "e04 != const_500 pleno");
    assert_eq!(d4.stats.bytes_lidos, 18, "e04 lidos");
    let e05 = le(&format!("{f}/negative/e05_empty_stream.eni"));
    assert_eq!(decode(&e05, &o), Err(EnigmaError::Truncated));
    let e06 = le(&format!("{f}/negative/e06_garbage_ff_255b.eni"));
    assert_eq!(decode(&e06, &o), Err(EnigmaError::MalformedHeader));
    let e07 = le(&format!("{f}/negative/e07_planes_4k.eni"));
    assert_eq!(decode(&e07, &opts(1024, 4_000_000)), Err(EnigmaError::ExcessiveOutput));
}

// ------------------------------------------------------------------- E26

#[test]
fn e26_hardening_entradas_reservadas() {
    let f = fixdir();
    let pleno = le(&format!("{f}/plain/planes_4k.eni"));
    for pl in [0u8, 12, 128, 255] {
        let mut s = pleno.clone();
        s[0] = pl;
        assert_eq!(decode(&s, &opts(8 * 1024 * 1024, 4_000_000)), Err(EnigmaError::MalformedHeader), "pl={pl}");
    }
    for m in [0x20u8, 0xFF] {
        let mut s = pleno.clone();
        s[1] = m;
        assert_eq!(decode(&s, &opts(8 * 1024 * 1024, 4_000_000)), Err(EnigmaError::MalformedHeader), "m={m}");
    }
    assert_eq!(decode(&pleno, &opts(8 * 1024 * 1024, 8)), Err(EnigmaError::WorkLimit));
    let c = DecodeOptions {
        value_offset: 0,
        limits: Limits { max_output_bytes: 8 * 1024 * 1024, work_limit: 4_000_000 },
        cancel: Some(&|| true),
    };
    assert_eq!(decode(&pleno, &c), Err(EnigmaError::Cancelled));
    assert_eq!(decode(&pleno[..5], &opts(8 * 1024 * 1024, 4_000_000)), Err(EnigmaError::Truncated));
}

// ------------------------------------------------------------------- E27

#[test]
fn e27_invariante_contabilidade() {
    let f = fixdir();
    let r = rom();
    let nomes = ["alternating_runs", "big_deltas", "const_500", "empty", "noise_1k",
                 "planes_4k", "ramp_signed", "single_word", "threshold_edge", "zeros_64"];
    let mut entradas: Vec<Vec<u8>> = nomes
        .iter()
        .map(|n| le(&format!("{f}/plain/{n}.eni")))
        .collect();
    entradas.extend([
        r[0x65432..].to_vec(),
        r[0x656ac..].to_vec(),
        r[0x65abe..].to_vec(),
        r[0x65e1a..].to_vec(),
        r[0x662f4..].to_vec(),
        r[0x667c6..].to_vec(),
    ]);
    for e in entradas {
        if let Ok(d) = decode(&e, &opts(8 * 1024 * 1024, 4_000_000)) {
            let s = d.stats;
            assert_eq!(s.bytes_armazenados, s.bytes_lidos + s.padding_console);
            assert_eq!(s.padding_console, s.bytes_lidos % 2);
            assert_eq!(s.bytes_armazenados % 2, 0);
        }
    }
}

// ------------------------------------------------------------------- E28

#[test]
fn e28_sem_panic_cortes_fills_e_lcg() {
    let f = fixdir();
    let r = rom();
    let pleno = le(&format!("{f}/plain/planes_4k.eni"));
    let o = opts(8 * 1024 * 1024, 4_000_000);
    // cortes de planes_4k: k = 1..len passo 16 (264 cortes congelados no doc)
    let mut n = 0;
    for k in (1..pleno.len()).step_by(16) {
        let _ = decode(&pleno[..k], &o);
        n += 1;
    }
    assert_eq!(n, 264, "serie de cortes congelada em E28");
    // metades das 6 streams SS
    for off in [0x65432usize, 0x656ac, 0x65abe, 0x65e1a, 0x662f4, 0x667c6] {
        let s = &r[off..off + 1200];
        let _ = decode(&s[..600], &o);
        let _ = decode(s, &o);
    }
    let _ = decode(&vec![0u8; 256], &o);
    let _ = decode(&vec![0xFFu8; 256], &o);
    // LCG deterministico (semente 20261005, 128 entradas, comprimentos <= 512)
    let mut x: u64 = 20261005;
    let mut nxt = move || {
        x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (x >> 33) as u8
    };
    for _ in 0..128 {
        let len = 1 + usize::from(nxt()) % 512;
        let entrada: Vec<u8> = (0..len).map(|_| nxt()).collect();
        let _ = decode(&entrada, &o);
    }
}
