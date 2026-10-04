//! Leitor da saida de `m68k-elf-objdump -d` — o INSTRUMENTO INDEPENDENTE.
//!
//! Compartilhado pelos testes: `calib_parity.rs` (paridade do decodificador) e
//! `fx_fluxo.rs` (alvos absolutos que o grafo deve reproduzir). Nada aqui invoca
//! o decodificador: esta camada so extrai as afirmacoes do instrumento sobre
//! (bytes, comprimento, mnemonico, alvo). Round-trip interno proprio nao conta
//! como prova (CONTRACT §5).

#[derive(Debug, Clone)]
pub struct Rec {
    pub addr: u32,
    /// comprimento total = words proprios + words de linhas de continuacao
    pub len: u32,
    /// primeiro token impresso pelo objdump (`moveb`, `dbf`, `.short`, ...)
    pub token: String,
    pub text: String,
    /// alvo absoluto impresso pelo instrumento, quando houver
    pub target: Option<u32>,
    pub bytes: Vec<u8>,
}

/// Analisa a saida de `objdump -d`. Linhas de registro:
/// `  a4:\t0c6c 5678 0010 \tcmpiw #22136,%a4@(16)`. Linhas de continuacao
/// (instrucao maior que o limite de impressao) tem a coluna de texto vazia.
pub fn parse_objdump(dump: &str) -> Vec<Rec> {
    let mut out: Vec<Rec> = Vec::new();
    for line in dump.lines() {
        let Some((loc, rest)) = split_once_tab(line) else {
            continue;
        };
        let Some(addr) = parse_loc(loc) else { continue };
        let (hexcol, text) = match rest.find('\t') {
            Some(i) => (&rest[..i], rest[i + 1..].trim()),
            None => (rest, ""),
        };
        let mut bytes = Vec::new();
        for tok in hexcol.split_whitespace() {
            if tok.len() != 4 || !tok.chars().all(|c| c.is_ascii_hexdigit()) {
                panic!("registro {loc}: token de byte inesperado {tok:?}");
            }
            let w = u16::from_str_radix(tok, 16).expect("hex validado acima");
            bytes.push((w >> 8) as u8);
            bytes.push(w as u8);
        }
        if text.is_empty() {
            // continuacao: acrescenta bytes a instrucao anterior
            let prev = out
                .last_mut()
                .unwrap_or_else(|| panic!("continuacao sem registro em {loc}"));
            assert_eq!(
                prev.addr + prev.len,
                addr,
                "continuacao em {loc} nao e contigua a instrucao anterior"
            );
            prev.bytes.extend_from_slice(&bytes);
            prev.len += bytes.len() as u32;
            continue;
        }
        let token = text.split([' ', '\t']).next().unwrap_or("").to_string();
        let target = instrument_target(&token, text);
        out.push(Rec {
            addr,
            len: bytes.len() as u32,
            token,
            text: text.to_string(),
            target,
            bytes,
        });
    }
    out
}

fn split_once_tab(line: &str) -> Option<(&str, &str)> {
    let (a, b) = line.split_once('\t')?;
    Some((a.trim(), b))
}

fn parse_loc(loc: &str) -> Option<u32> {
    let hex = loc.strip_suffix(':')?;
    if hex.is_empty() || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    u32::from_str_radix(hex, 16).ok()
}

/// O instrumento imprime o alvo absoluto antes do deslocamento simbolico:
/// `bras 156 <lbl1>`, `dbf %d3,e8 <lblback>`, `jmp 12345678 <...>`. Indiretos
/// (`jmp %a2@`) e imediatos nao tem alvo.
pub fn instrument_target(token: &str, text: &str) -> Option<u32> {
    let fam = family_of_token(token);
    let is_flow = matches!(
        fam.as_str(),
        "bra"
            | "bsr"
            | "bcc"
            | "bcs"
            | "beq"
            | "bne"
            | "bmi"
            | "bpl"
            | "bvs"
            | "bvc"
            | "bhi"
            | "bls"
            | "bge"
            | "blt"
            | "bgt"
            | "ble"
            | "jmp"
            | "jsr"
    ) || fam.starts_with("db");
    if !is_flow {
        return None;
    }
    let body = text.split('<').next().unwrap_or(text).trim();
    let last = body.split([' ', ',']).next_back()?;
    if last.starts_with('%') || last.starts_with('#') {
        return None;
    }
    u32::from_str_radix(last, 16).ok()
}

/// Familia comparavel: o objdump imprime o sufixo de tamanho colado ao
/// mnemonico; retiramos exatamente um caractere de `{b,w,l,s}` quando o token
/// tem 4+ caracteres (preserva `rts`, `bls`, `bcs`, `bvs`, `seq`, `sne`).
pub fn family_of_token(token: &str) -> String {
    let t = token.trim_end_matches('\'');
    if t.len() >= 4 {
        let last = t.as_bytes()[t.len() - 1];
        if matches!(last, b'b' | b'w' | b'l' | b's') {
            return t[..t.len() - 1].to_string();
        }
    }
    t.to_string()
}

/// Verdadeiro quando o registro do instrumento e um desvio lido como forma
/// curta de 2 bytes cujo byte baixo do opcode e `0xFF`. Usado pelos dois testes
/// como o unico ponto em que o CONTRATO manda parar embora o instrumento leia.
pub fn desvio_disp8_ff(rec: &Rec) -> bool {
    let fam = family_of_token(&rec.token);
    let eh_desvio = matches!(
        fam.as_str(),
        "bra"
            | "bsr"
            | "bcc"
            | "bcs"
            | "beq"
            | "bne"
            | "bmi"
            | "bpl"
            | "bvs"
            | "bvc"
            | "bhi"
            | "bls"
            | "bge"
            | "blt"
            | "bgt"
            | "ble"
    );
    eh_desvio && rec.bytes.get(1) == Some(&0xFF)
}
