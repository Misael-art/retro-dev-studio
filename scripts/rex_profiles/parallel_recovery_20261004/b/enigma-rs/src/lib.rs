// Decoder Enigma puro — clean-room derivado do desempacotador 68k pinado
// (`_inc/Decompression/Enigma Decompression.asm`, SHA-256
// 76fed2de986b3e79e1f2bd517b06cc9eb64cff0a1679b77268c9a31bfee4136e do s1disasm
// 064e3c68eb19cc85b8801b087f9d95f9b3e82cea). Nenhum byte de codigo mdcomp ou do
// Python de pesquisa foi copiado ou portado (politica da rodada B4).
//
// Contrato e expectativas congelados em
// docs/rex_profiles/parallel_recovery_20261004/b/EXPECTATIONS-ENIGMA-B4.md.
// Camada: SO decoder (stream -> palavras). Grade 64x64 e projecao WRAM nao
// vivem aqui (permanecem nos scripts Python da frente, provados na B2).
#![forbid(unsafe_code)]

pub const HEADER_LEN: usize = 6;
pub const PACKET_LENGTH_MIN: u8 = 1;
pub const PACKET_LENGTH_MAX: u8 = 11;
pub const MASK_BYTE_MAX: u8 = 0x1F;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    /// Teto absoluto de bytes de saida. Verificado antes de cada escrita;
    /// nada e emitido alem do limite.
    pub max_output_bytes: usize,
    /// Teto de tokens processados (aritmado por token, incluindo o terminador).
    pub work_limit: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Limits { max_output_bytes: 8 * 1024 * 1024, work_limit: 4_000_000 }
    }
}

#[derive(Clone, Copy, Default)]
pub struct DecodeOptions<'a> {
    /// Equivalente ao d0 (art tile base) do EniDec do console: somado no
    /// carregamento dos valores incr/common e em cada fetch inline, tudo
    /// mod 2^16 (semantica do asm). Recursos reais usam 0.
    pub value_offset: u16,
    pub limits: Limits,
    /// Cancelamento cooperativo, verificado em fronteira de token.
    pub cancel: Option<&'a dyn Fn() -> bool>,
}

impl std::fmt::Debug for DecodeOptions<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DecodeOptions")
            .field("value_offset", &self.value_offset)
            .field("limits", &self.limits)
            .field("cancel", &self.cancel.is_some())
            .finish()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnigmaError {
    /// < 6 bytes de cabecalho; EOF a meio de token/flags/valor; sem terminador.
    Truncated,
    /// packet_length fora de 1..=11 ou byte de mascara > 0x1F.
    MalformedHeader,
    /// Proxima palavra excederia `max_output_bytes`. Zero saida ao chamador.
    ExcessiveOutput,
    /// Tokens > `work_limit`.
    WorkLimit,
    /// `cancel()` verdadeiro em fronteira de token.
    Cancelled,
}

impl EnigmaError {
    /// Codigo do contrato CONTRACTS.md §4 (+ extensao declarada malformed-header).
    pub fn code(&self) -> &'static str {
        match self {
            EnigmaError::Truncated => "truncated",
            EnigmaError::MalformedHeader => "malformed-header",
            EnigmaError::ExcessiveOutput => "excessive-output",
            EnigmaError::WorkLimit => "work-limit",
            EnigmaError::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stats {
    /// Bits consumidos pelo parsing depois do cabecalho.
    pub bits_lidos: u64,
    /// Bytes fisicamente lidos: HEADER_LEN + ceil(bits_lidos/8).
    pub bytes_lidos: usize,
    /// Alinhamento par do `EniDec_Done` do console (0 ou 1 com sitio inicial par).
    pub padding_console: usize,
    /// Vao de armazenamento: `bytes_lidos + padding_console` (sempre par).
    pub bytes_armazenados: usize,
    pub tokens: u64,
    /// Palavras emitidas a partir de valores inline lidos do stream
    /// (tokens 1|xx, incluindo as corridas de delta).
    pub valores_inline: u64,
    pub terminador: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnigmaDecoded {
    /// Palavras 16 bits na ordem emitida pelo console.
    pub words: Vec<u16>,
    pub stats: Stats,
}

impl EnigmaDecoded {
    /// Serializacao big-endian — dominio dos SHA-256 pinados (E23/E24).
    pub fn bytes_be(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.words.len() * 2);
        for w in &self.words {
            out.extend_from_slice(&w.to_be_bytes());
        }
        out
    }
}

struct BitReader<'a> {
    stream: &'a [u8],
    /// Posicao em bits desde o inicio do stream; comeca apos o cabecalho.
    pos: usize,
}

impl<'a> BitReader<'a> {
    fn novo(stream: &'a [u8]) -> Self {
        BitReader { stream, pos: HEADER_LEN * 8 }
    }

    fn pop(&mut self) -> Result<u16, EnigmaError> {
        let byte = self.pos >> 3;
        if byte >= self.stream.len() {
            return Err(EnigmaError::Truncated);
        }
        let bit = (self.stream[byte] >> (7 - (self.pos & 7))) & 1;
        self.pos += 1;
        Ok(u16::from(bit))
    }

    /// Le `n` bits MSB-first.
    fn read(&mut self, n: u8) -> Result<u16, EnigmaError> {
        let mut v = 0u16;
        for _ in 0..n {
            v = (v << 1) | self.pop()?;
        }
        Ok(v)
    }

    fn bits_lidos(&self) -> u64 {
        (self.pos - HEADER_LEN * 8) as u64
    }
}

/// PCCVH: o bit j da mascara byte[1] (j=4..0 = P,C,C,V,H) habilita a leitura
/// de 1 bit de flag do stream; se 1, soma o bit de valor (j + 11). Ordem de
/// leitura conforme o asm (priority primeiro).
fn fetch_inline(
    bits: &mut BitReader<'_>,
    packet_length: u8,
    mask_byte: u8,
    value_offset: u16,
) -> Result<u16, EnigmaError> {
    let mut flags = 0u16;
    for j in (0..5u8).rev() {
        // && curto-circuita como o aninhamento do asm: so le bit de flag se a
        // mascara habilita aquela posicao.
        if (mask_byte >> j) & 1 == 1 && bits.pop()? == 1 {
            flags |= 1u16 << (j + 11);
        }
    }
    let raw = bits.read(packet_length)?;
    // console: (raw & mask) + base + Σ flags, tudo mod 2^16 (addi/ori do asm;
    // bits de flag disjoint do raw <= 2^11-1, add == or nesta parcela).
    Ok(raw.wrapping_add(value_offset).wrapping_add(flags))
}

fn emit(
    words: &mut Vec<u16>,
    w: u16,
    max_output_bytes: usize,
) -> Result<(), EnigmaError> {
    if (words.len() + 1) * 2 > max_output_bytes {
        return Err(EnigmaError::ExcessiveOutput);
    }
    words.push(w);
    Ok(())
}

/// Decodifica um stream Enigma (variante plain do console/Sonic 1).
/// Erro => nenhuma saida e entregue ao chamador.
pub fn decode(stream: &[u8], opts: &DecodeOptions) -> Result<EnigmaDecoded, EnigmaError> {
    if stream.len() < HEADER_LEN {
        return Err(EnigmaError::Truncated);
    }
    let packet_length = stream[0];
    let mask_byte = stream[1];
    if !(PACKET_LENGTH_MIN..=PACKET_LENGTH_MAX).contains(&packet_length) {
        return Err(EnigmaError::MalformedHeader);
    }
    if mask_byte > MASK_BYTE_MAX {
        return Err(EnigmaError::MalformedHeader);
    }
    let base = opts.value_offset;
    let mut incr = u16::from_be_bytes([stream[2], stream[3]]).wrapping_add(base);
    let common = u16::from_be_bytes([stream[4], stream[5]]).wrapping_add(base);

    let mut bits = BitReader::novo(stream);
    let mut words: Vec<u16> = Vec::new();
    let mut tokens: u64 = 0;
    let mut valores_inline: u64 = 0u64;

    loop {
        tokens += 1;
        if tokens > opts.limits.work_limit {
            return Err(EnigmaError::WorkLimit);
        }
        if let Some(cancel) = opts.cancel {
            if cancel() {
                return Err(EnigmaError::Cancelled);
            }
        }

        if bits.pop()? == 1 {
            // token de 7 bits: 1 | mm | cccc
            let mode = bits.read(2)?;
            let cnt4 = bits.read(4)?;
            if mode == 3 {
                if cnt4 == 0x0F {
                    // EniDec_Done do console: alinha e sai
                    let bits_lidos = bits.bits_lidos();
                    let bytes_lidos = HEADER_LEN + ((bits_lidos as usize) + 7) / 8;
                    let padding_console = bytes_lidos % 2;
                    return Ok(EnigmaDecoded {
                        words,
                        stats: Stats {
                            bits_lidos,
                            bytes_lidos,
                            padding_console,
                            bytes_armazenados: bytes_lidos + padding_console,
                            tokens,
                            valores_inline,
                            terminador: true,
                        },
                    });
                }
                // cccc+1 valores inline, cada um com flags novas
                for _ in 0..cnt4 + 1 {
                    let v = fetch_inline(&mut bits, packet_length, mask_byte, base)?;
                    valores_inline += 1;
                    emit(&mut words, v, opts.limits.max_output_bytes)?;
                }
            } else {
                // inline lido UMA vez + corrida com delta 0/+1/-1
                let mut v = fetch_inline(&mut bits, packet_length, mask_byte, base)?;
                valores_inline += u64::from(cnt4) + 1;
                let passo: u16 = match mode {
                    0 => 0,
                    1 => 1,
                    _ => u16::MAX,
                };
                for _ in 0..cnt4 + 1 {
                    emit(&mut words, v, opts.limits.max_output_bytes)?;
                    v = v.wrapping_add(passo);
                }
            }
        } else {
            // token de 6 bits: 0 | s | cccc
            let kind = bits.pop()?;
            let cnt = bits.read(4)? + 1;
            if kind == 0 {
                // corrida incrementing; o valor persiste entre tokens (a2)
                let mut v = incr;
                for _ in 0..cnt {
                    emit(&mut words, v, opts.limits.max_output_bytes)?;
                    v = v.wrapping_add(1);
                }
                incr = v;
            } else {
                for _ in 0..cnt {
                    emit(&mut words, common, opts.limits.max_output_bytes)?;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(max: usize) -> DecodeOptions<'static> {
        DecodeOptions {
            value_offset: 0,
            limits: Limits { max_output_bytes: max, work_limit: 4_000_000 },
            cancel: None,
        }
    }

    // ---- streams artesanais: bytes montados a mao a partir do contrato,
    // ---- saidas calculadas a mao (nao pelo produto) — testes de especificacao.

    #[test]
    fn incr_run_de_2_palavras_e_terminador() {
        // header: pl=1, mask=0, incr=0x1234, common=0x0000
        // bits: 0|0|0001 (incr-run cnt=1 -> 2 palavras) | 1|11|1111 (terminador)
        // 6 + 7 = 13 bits -> ceil=2 bytes -> lidos=8, padding 0
        let linear: Vec<u8> = [
            vec![0u8, 0, 0, 0, 0, 1],  // incr-run, cnt=1 -> 2 palavras
            vec![1, 1, 1, 1, 1, 1, 1], // terminador
        ]
        .concat();
        let mut stream = vec![0x01u8, 0x00, 0x12, 0x34, 0x00, 0x00];
        for chunk in linear.chunks(8) {
            let mut b = 0u8;
            for x in chunk {
                b = (b << 1) | *x;
            }
            stream.push(b << (8 - chunk.len()));
        }
        let d = decode(&stream, &opts(65536)).expect("ok");
        assert_eq!(d.words, vec![0x1234, 0x1235]);
        assert_eq!(d.stats.bits_lidos, 13);
        assert_eq!(d.stats.bytes_lidos, 6 + 2);
        assert_eq!(d.stats.padding_console, 0); // 8 par
        assert!(d.stats.terminador);
        assert_eq!(d.stats.tokens, 2);
    }

    #[test]
    fn common_run_e_inline_com_flags() {
        // pl=4, mask=0x00 (sem flags), incr=0, common=0x0007
        // token A: 0 1 0010 -> common-run cnt=2 -> 3 palavras de 0x0007
        // token B: 1 00 0010 -> inline-run modo 0, cnt=2 -> valor inline (4 bits)
        //          lido 1 vez, repetido 3 vezes. valor bits = 1011 -> 0xB
        // token C: terminador 1111111
        let linear: Vec<u8> = [
            vec![0u8, 1, 0, 0, 1, 0],
            vec![1, 0, 0, 0, 0, 1, 0],
            vec![1, 0, 1, 1],
            vec![1, 1, 1, 1, 1, 1, 1],
        ]
        .concat();
        let mut stream = vec![0x04u8, 0x00, 0x00, 0x00, 0x00, 0x07];
        for chunk in linear.chunks(8) {
            let mut b = 0u8;
            for x in chunk {
                b = (b << 1) | *x;
            }
            stream.push(b << (8 - chunk.len()));
        }
        let d = decode(&stream, &opts(65536)).expect("ok");
        assert_eq!(d.words, vec![0x0007, 0x0007, 0x0007, 0x000B, 0x000B, 0x000B]);
        assert_eq!(d.stats.valores_inline, 3);
    }

    #[test]
    fn mask_priority_le_bit_de_flag() {
        // pl=4, mask=0x10 (P): antes do valor inline le 1 bit de flag;
        // token 1|00|0000: flag=1 -> valor = 0x5 | 0x8000 ; incr=common=0
        let linear: Vec<u8> =
            [vec![1u8, 0, 0, 0, 0, 0, 0], vec![1], vec![0, 1, 0, 1], vec![1, 1, 1, 1, 1, 1, 1]]
                .concat();
        let mut stream = vec![0x04u8, 0x10, 0x00, 0x00, 0x00, 0x00];
        for chunk in linear.chunks(8) {
            let mut b = 0u8;
            for x in chunk {
                b = (b << 1) | *x;
            }
            stream.push(b << (8 - chunk.len()));
        }
        let d = decode(&stream, &opts(65536)).expect("ok");
        assert_eq!(d.words, vec![0x8005]);
    }

    #[test]
    fn truncado_sem_terminador_e_meio_token() {
        // header valido + 1 byte 0b0000_0100 comeca incr-run mas acaba no EOF
        let s = [0x01u8, 0x00, 0x00, 0x00, 0x00, 0x00, 0b0000_0110];
        // 000 001 -> 2 palavras incr (0x0000,0x0001) depois 1 bit sobra p/ o
        // proximo token (pop do 8o bit -> 0; precisa de mais bits) => Truncated
        assert_eq!(decode(&s, &opts(65536)), Err(EnigmaError::Truncated));
        let curto = [0x01u8, 0x00, 0x00, 0x00, 0x00];
        assert_eq!(decode(&curto, &opts(65536)), Err(EnigmaError::Truncated));
    }

    #[test]
    fn cabecalhos_reservados_recusados() {
        for pl in [0u8, 12, 128, 255] {
            let s = [pl, 0x00, 0, 0, 0, 0, 0xFF, 0xFF];
            assert_eq!(decode(&s, &opts(65536)), Err(EnigmaError::MalformedHeader), "pl={pl}");
        }
        for m in [0x20u8, 0xFF] {
            let s = [0x0Bu8, m, 0, 0, 0, 0, 0xFF, 0xFF];
            assert_eq!(decode(&s, &opts(65536)), Err(EnigmaError::MalformedHeader), "m={m}");
        }
    }

    #[test]
    fn limite_de_saida_zero_saida_ao_chamador() {
        // comum-run gigante: 1 token -> palavras ate estourar max_out=4 (2 palavras)
        let linear: Vec<u8> = vec![vec![0u8, 1, 1, 1, 1, 1]; 1].concat(); // 1 token de 6 bits
        let mut stream = vec![0x01u8, 0x00, 0x00, 0x00, 0xAB, 0xCD];
        for chunk in linear.chunks(8) {
            let mut b = 0u8;
            for x in chunk {
                b = (b << 1) | *x;
            }
            stream.push(b << (8 - chunk.len()));
        }
        // token 0|1|1111 -> common-run de 16 palavras; max 4 bytes = 2 palavras
        assert_eq!(decode(&stream, &opts(4)), Err(EnigmaError::ExcessiveOutput));
    }

    #[test]
    fn work_limit_e_cancel() {
        let s = [0x01u8, 0x00, 0, 0, 0, 0, 0xFF, 0xFF]; // 1|11|1111 = terminador no 1o token
        let o = DecodeOptions {
            value_offset: 0,
            limits: Limits { max_output_bytes: 16, work_limit: 0 },
            cancel: None,
        };
        assert_eq!(decode(&s, &o), Err(EnigmaError::WorkLimit));
        let o2 = DecodeOptions {
            value_offset: 0,
            limits: Limits { max_output_bytes: 16, work_limit: 9 },
            cancel: Some(&|| true),
        };
        assert_eq!(decode(&s, &o2), Err(EnigmaError::Cancelled));
        let o3 = DecodeOptions {
            value_offset: 0,
            limits: Limits { max_output_bytes: 16, work_limit: 9 },
            cancel: None,
        };
        assert!(decode(&s, &o3).is_ok());
    }

    #[test]
    fn padding_da_contabilidade() {
        // terminador logo apos o header: 7 bits -> lidos=7 -> impar -> padding 1
        let s = [0x01u8, 0x00, 0, 0, 0, 0, 0b1111_1110];
        let d = decode(&s, &opts(65536)).expect("ok");
        assert_eq!(d.stats.bits_lidos, 7);
        assert_eq!(d.stats.bytes_lidos, 7);
        assert_eq!(d.stats.padding_console, 1);
        assert_eq!(d.stats.bytes_armazenados, 8);
        assert!(d.words.is_empty());
    }
}
