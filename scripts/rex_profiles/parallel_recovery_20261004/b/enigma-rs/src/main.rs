// CLI da frente b (rodada B4): reproduz um decode e exporta resultado
// estruturado (requisito 8). Camada exportada: "decoder-bytes" — nada de
// grade 64x64 nem projecao WRAM aqui.

use rex_enigma::{decode, DecodeOptions, EnigmaError, Limits};

fn uso() -> ! {
    eprintln!(
        "uso:\n  rex-enigma decode-file <eni> [--max-out N] [--work-limit N] [--value-offset N] [--json <saida>]\n  rex-enigma decode-rom  <bin> <offset-hex> [--max-out N] [--work-limit N] [--value-offset N] [--json <saida>]"
    );
    std::process::exit(1);
}

fn parse_flags(args: &[String]) -> (usize, u64, u16, Option<String>) {
    let mut max_out = 8 * 1024 * 1024usize;
    let mut work: u64 = 4_000_000;
    let mut voff = 0u16;
    let mut json = None;
    let mut i = 0;
    while i < args.len() {
        let (flag, valor) = (&args[i], args.get(i + 1).cloned().unwrap_or_default());
        match flag.as_str() {
            "--max-out" => max_out = valor.parse().unwrap_or_else(|_| uso()),
            "--work-limit" => work = valor.parse().unwrap_or_else(|_| uso()),
            "--value-offset" => {
                voff = if let Some(h) = valor.strip_prefix("0x") {
                    u16::from_str_radix(h, 16).unwrap_or_else(|_| uso())
                } else {
                    valor.parse().unwrap_or_else(|_| uso())
                }
            }
            "--json" => json = Some(valor),
            _ => uso(),
        }
        i += 2;
    }
    (max_out, work, voff, json)
}

fn exit_code(e: &EnigmaError) -> i32 {
    match e {
        EnigmaError::Truncated => 2,
        EnigmaError::MalformedHeader => 3,
        EnigmaError::ExcessiveOutput => 4,
        EnigmaError::WorkLimit => 5,
        EnigmaError::Cancelled => 6,
    }
}

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 2 {
        uso();
    }
    let cmd = args[0].as_str();
    let (origem, dados, offset, resto) = match cmd {
        "decode-file" => {
            let p = &args[1];
            let dados = std::fs::read(p).unwrap_or_else(|e| {
                eprintln!("io: {p}: {e}");
                std::process::exit(1);
            });
            ("file".to_string(), dados, None, args[2..].to_vec())
        }
        "decode-rom" => {
            if args.len() < 3 {
                uso();
            }
            let p = &args[1];
            let todo = std::fs::read(p).unwrap_or_else(|e| {
                eprintln!("io: {p}: {e}");
                std::process::exit(1);
            });
            let hex = args[2].trim_start_matches("0x");
            let off = usize::from_str_radix(hex, 16).unwrap_or_else(|_| uso());
            if off >= todo.len() {
                eprintln!("offset fora do ficheiro");
                std::process::exit(1);
            }
            let slice = todo[off..].to_vec();
            ("rom".to_string(), slice, Some(off), args[3..].to_vec())
        }
        _ => uso(),
    };
    let (max_out, work, voff, json) = parse_flags(&resto);
    let opts = DecodeOptions {
        value_offset: voff,
        limits: Limits { max_output_bytes: max_out, work_limit: work },
        cancel: None,
    };

    let mut doc = String::new();
    doc.push_str("{\n");
    doc.push_str(" \"schema\": \"rex-enigma-cli/v1\",\n");
    doc.push_str(" \"camada\": \"decoder-bytes\",\n");
    doc.push_str(&format!(" \"origem\": \"{origem}\",\n"));
    if let Some(o) = offset {
        doc.push_str(&format!(" \"offset\": \"0x{o:X}\",\n"));
    }
    doc.push_str(&format!(" \"value_offset\": {voff},\n \"max_output_bytes\": {max_out},\n \"work_limit\": {work},\n"));

    match decode(&dados, &opts) {
        Ok(d) => {
            let bytes = d.bytes_be();
            let sha = rex_kosinski::edit::sha256_hex(&bytes);
            // determinismo: segundo decode tem de ser byte-idêntico
            let d2 = decode(&dados, &opts).expect("segundo decode falhou");
            let determinismo = d2.bytes_be() == bytes;
            let s = d.stats;
            doc.push_str(" \"veredito\": \"OK\",\n \"erro\": null,\n");
            doc.push_str(&format!(" \"output_size\": {},\n", bytes.len()));
            doc.push_str(&format!(" \"output_sha256\": \"{sha}\",\n"));
            doc.push_str(&format!(" \"bits_lidos\": {},\n", s.bits_lidos));
            doc.push_str(&format!(" \"bytes_lidos\": {},\n", s.bytes_lidos));
            doc.push_str(&format!(" \"padding_console\": {},\n", s.padding_console));
            doc.push_str(&format!(" \"bytes_armazenados\": {},\n", s.bytes_armazenados));
            doc.push_str(&format!(" \"tokens\": {},\n", s.tokens));
            doc.push_str(&format!(" \"valores_inline\": {},\n", s.valores_inline));
            doc.push_str(&format!(" \"terminador\": {},\n", s.terminador));
            doc.push_str(&format!(" \"determinismo_decode_duplo\": {determinismo}\n}}\n"));
            let code = if determinismo { 0 } else { 7 };
            saida(doc, json);
            std::process::exit(code);
        }
        Err(e) => {
            doc.push_str(" \"veredito\": \"ERRO\",\n");
            doc.push_str(&format!(" \"erro\": \"{}\"\n}}\n", e.code()));
            let code = exit_code(&e);
            saida(doc, json);
            std::process::exit(code);
        }
    }
}

fn saida(doc: String, json: Option<String>) {
    match json {
        Some(p) => {
            std::fs::write(&p, doc).unwrap_or_else(|e| {
                eprintln!("io: {p}: {}", json_escape(&e.to_string()));
                std::process::exit(1);
            });
        }
        None => print!("{doc}"),
    }
}
