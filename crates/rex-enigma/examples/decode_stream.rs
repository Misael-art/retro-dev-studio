// Ferramenta de aceite: decodifica um stream em `<arquivo> <offset-hex>` e grava a
// saida bruta em `<saida>`; as contas vao para stdout em `chave=valor`. So std.
use rex_enigma::{decode, DecodeOptions, EnigmaError, Limits};

fn main() {
    let a: Vec<String> = std::env::args().skip(1).collect();
    if a.len() != 3 {
        eprintln!("uso: decode_stream <arquivo> <offset-hex> <saida>");
        std::process::exit(64);
    }
    let dados = std::fs::read(&a[0]).unwrap_or_else(|e| {
        eprintln!("io: {e}");
        std::process::exit(66)
    });
    let off = usize::from_str_radix(a[1].trim_start_matches("0x"), 16).unwrap_or_else(|_| {
        eprintln!("offset invalido");
        std::process::exit(64)
    });
    if off >= dados.len() {
        println!("erro=fora-do-arquivo");
        std::process::exit(2);
    }
    let opts = DecodeOptions {
        value_offset: 0,
        limits: Limits {
            max_output_bytes: 8192,
            work_limit: 8192,
        },
        cancel: None,
    };
    match decode(&dados[off..], &opts) {
        Ok(d) => {
            let s = d.stats;
            std::fs::write(&a[2], d.bytes_be()).expect("gravar saida");
            println!("bytes_lidos={}", s.bytes_lidos);
            println!("padding_alinhamento={}", (off + s.bytes_lidos) % 2);
            println!(
                "bytes_armazenados={}",
                s.bytes_lidos + (off + s.bytes_lidos) % 2
            );
            println!("saida_bytes={}", d.words.len() * 2);
            println!("tokens={}", s.tokens);
        }
        Err(e) => {
            println!("erro={}", e.code());
            std::process::exit(if e == EnigmaError::Cancelled { 3 } else { 1 });
        }
    }
}
