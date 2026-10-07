//! Decoder Nemesis (arte 4bpp comprimida do Mega Drive) — puro, sem I/O e sem
//! serialização. Genérico: não conhece nenhum jogo; quem sabe *onde* há um
//! stream (perfil Sonic, outro título) passa a janela de bytes.
//!
//! Formato (documentação pública do codec; sem código de terceiros):
//!  * cabeçalho de 2 bytes BE: bit 15 = modo XOR, bits 0..14 = nº de tiles;
//!  * tabela de códigos: byte `0xFF` encerra; byte com bit 7 = novo índice de
//!    paleta (nibble baixo); demais bytes = `0RRRLLLL` (corrida `RRR+1`, tamanho
//!    de código `LLLL`) seguido de 1 byte com o código (alinhado à direita);
//!  * bits de dados MSB-first: código da tabela → `run` pixels do índice
//!    corrente; prefixo `111111` + 7 bits (`RRR`,`CCCC`) = corrida inline;
//!  * 8 pixels = 1 linha de 32 bits; no modo XOR cada linha é XOR da anterior.
//!
//! Contrato estrito (mais estreito que o console, por desenho): tabela com
//! código de tamanho 0 ou > 8, valor ≥ 2^tamanho, entrada sem índice de
//! paleta, códigos que não formam um conjunto livre de prefixos (inclusive com
//! o prefixo inline `111111`), corrida que ultrapassa o total de pixels ou
//! stream sem bits suficientes são RECUSADOS. Todo erro entrega zero saída.

pub const HEADER_LEN: usize = 2;
pub const INLINE_PREFIX_LEN: u32 = 6;
pub const INLINE_PREFIX: u16 = 0x3F;
pub const MAX_CODE_LEN: u32 = 8;
pub const TILE_BYTES: usize = 32;
pub const TILE_PIXELS: usize = 64;
pub const MAX_TILES: usize = 0x7FFF;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    /// Teto de bytes de saída, verificado antes de alocar/escrever.
    pub max_output_bytes: usize,
    /// Teto de códigos (corridas) processados.
    pub work_limit: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Limits {
            max_output_bytes: 1024 * 1024,
            work_limit: 2_100_000,
        }
    }
}

#[derive(Clone, Copy, Default)]
pub struct DecodeOptions<'a> {
    pub limits: Limits,
    /// Cancelamento cooperativo, consultado a cada 256 códigos.
    pub cancel: Option<&'a dyn Fn() -> bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NemesisError {
    /// Stream acaba no cabeçalho, na tabela ou nos bits de dados.
    Truncated,
    /// Entrada de tabela inválida (tamanho, valor, paleta ausente, prefixos).
    MalformedTable,
    /// Código de dados sem correspondência em até 8 bits.
    InvalidCode,
    /// Corrida ultrapassa o total de pixels declarado no cabeçalho.
    PixelOverrun,
    /// `tiles * 32` acima de `max_output_bytes`.
    ExcessiveOutput,
    WorkLimit,
    Cancelled,
}

impl NemesisError {
    pub fn code(&self) -> &'static str {
        match self {
            NemesisError::Truncated => "truncated",
            NemesisError::MalformedTable => "malformed-table",
            NemesisError::InvalidCode => "invalid-code",
            NemesisError::PixelOverrun => "pixel-overrun",
            NemesisError::ExcessiveOutput => "excessive-output",
            NemesisError::WorkLimit => "work-limit",
            NemesisError::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stats {
    pub tiles: usize,
    pub xor_mode: bool,
    pub table_entries: usize,
    /// Bits de dados consumidos depois da tabela.
    pub data_bits: u64,
    /// Bytes fisicamente lidos: cabeçalho + tabela + ceil(data_bits/8).
    pub bytes_lidos: usize,
    pub codes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NemesisDecoded {
    /// `tiles * 32` bytes: 4bpp, 2 pixels por byte (nibble alto = pixel da esquerda).
    pub bytes: Vec<u8>,
    pub stats: Stats,
}

#[derive(Clone, Copy)]
struct Entry {
    len: u32,
    code: u16,
    pal: u8,
    run: u8,
}

fn prefixo_conflita(a: (u32, u16), b: (u32, u16)) -> bool {
    let (la, ca) = a;
    let (lb, cb) = b;
    let m = la.min(lb);
    (ca >> (la - m)) == (cb >> (lb - m))
}

struct Bits<'a> {
    data: &'a [u8],
    pos: usize,
}

impl Bits<'_> {
    fn bit(&mut self) -> Result<u16, NemesisError> {
        let byte = self.pos >> 3;
        if byte >= self.data.len() {
            return Err(NemesisError::Truncated);
        }
        let b = (self.data[byte] >> (7 - (self.pos & 7))) & 1;
        self.pos += 1;
        Ok(u16::from(b))
    }
    fn read(&mut self, n: u32) -> Result<u16, NemesisError> {
        let mut v = 0u16;
        for _ in 0..n {
            v = (v << 1) | self.bit()?;
        }
        Ok(v)
    }
}

fn parse_table(stream: &[u8]) -> Result<(Vec<Entry>, usize), NemesisError> {
    let mut p = HEADER_LEN;
    let mut pal: Option<u8> = None;
    let mut entries: Vec<Entry> = Vec::new();
    loop {
        let b = *stream.get(p).ok_or(NemesisError::Truncated)?;
        p += 1;
        if b == 0xFF {
            break;
        }
        if b & 0x80 != 0 {
            pal = Some(b & 0x0F);
            continue;
        }
        let run = ((b >> 4) & 7) + 1;
        let len = u32::from(b & 0x0F);
        let code = u16::from(*stream.get(p).ok_or(NemesisError::Truncated)?);
        p += 1;
        let pal = pal.ok_or(NemesisError::MalformedTable)?;
        if len == 0 || len > MAX_CODE_LEN || u32::from(code) >= (1u32 << len) {
            return Err(NemesisError::MalformedTable);
        }
        // Livre de prefixos: contra as entradas anteriores e o prefixo inline.
        if prefixo_conflita((len, code), (INLINE_PREFIX_LEN, INLINE_PREFIX))
            || entries
                .iter()
                .any(|e| prefixo_conflita((len, code), (e.len, e.code)))
        {
            return Err(NemesisError::MalformedTable);
        }
        entries.push(Entry {
            len,
            code,
            pal,
            run,
        });
    }
    Ok((entries, p))
}

/// Decodifica um stream Nemesis a partir do primeiro byte do cabeçalho.
/// `stream` pode ser uma janela maior que o stream: o decoder para no último
/// pixel declarado e informa `bytes_lidos`.
pub fn decode(stream: &[u8], opts: &DecodeOptions) -> Result<NemesisDecoded, NemesisError> {
    if stream.len() < HEADER_LEN {
        return Err(NemesisError::Truncated);
    }
    let hdr = u16::from_be_bytes([stream[0], stream[1]]);
    let xor_mode = hdr & 0x8000 != 0;
    let tiles = usize::from(hdr & 0x7FFF);
    let out_len = tiles * TILE_BYTES;
    if out_len > opts.limits.max_output_bytes {
        return Err(NemesisError::ExcessiveOutput);
    }
    let (entries, data_start) = parse_table(stream)?;

    let total = tiles * TILE_PIXELS;
    let mut bits = Bits {
        data: stream,
        pos: data_start * 8,
    };
    let mut pixels: Vec<u8> = Vec::with_capacity(total);
    let mut codes: u64 = 0;
    while pixels.len() < total {
        codes += 1;
        if codes > opts.limits.work_limit {
            return Err(NemesisError::WorkLimit);
        }
        if codes.is_multiple_of(256) {
            if let Some(c) = opts.cancel {
                if c() {
                    return Err(NemesisError::Cancelled);
                }
            }
        }
        let mut code = 0u16;
        let mut len = 0u32;
        let (pix, run) = loop {
            code = (code << 1) | bits.bit()?;
            len += 1;
            if len == INLINE_PREFIX_LEN && code == INLINE_PREFIX {
                let v = bits.read(7)?;
                break ((v & 0xF) as u8, (((v >> 4) & 7) + 1) as usize);
            }
            if let Some(e) = entries.iter().find(|e| e.len == len && e.code == code) {
                break (e.pal, usize::from(e.run));
            }
            if len >= MAX_CODE_LEN {
                return Err(NemesisError::InvalidCode);
            }
        };
        if pixels.len() + run > total {
            return Err(NemesisError::PixelOverrun);
        }
        pixels.resize(pixels.len() + run, pix);
    }

    let mut bytes = Vec::with_capacity(out_len);
    let mut prev = 0u32;
    for row in pixels.chunks_exact(8) {
        let mut w = 0u32;
        for &c in row {
            w = (w << 4) | u32::from(c);
        }
        if xor_mode {
            w ^= prev;
        }
        prev = w;
        bytes.extend_from_slice(&w.to_be_bytes());
    }
    let data_bits = (bits.pos - data_start * 8) as u64;
    Ok(NemesisDecoded {
        bytes,
        stats: Stats {
            tiles,
            xor_mode,
            table_entries: entries.len(),
            data_bits,
            bytes_lidos: data_start + (data_bits as usize).div_ceil(8),
            codes,
        },
    })
}

#[cfg(test)]
pub(crate) mod testkit {
    //! Codificador de TESTE (independente do decoder): só corridas inline,
    //! sempre válido; ou tabela explícita montada à mão pelos testes.
    pub struct BitW {
        pub bytes: Vec<u8>,
        n: usize,
    }
    impl BitW {
        pub fn new() -> Self {
            BitW {
                bytes: Vec::new(),
                n: 0,
            }
        }
        pub fn put(&mut self, v: u32, bits: u32) {
            for k in (0..bits).rev() {
                if self.n.is_multiple_of(8) {
                    self.bytes.push(0);
                }
                let b = ((v >> k) & 1) as u8;
                let last = self.bytes.len() - 1;
                self.bytes[last] |= b << (7 - (self.n % 8));
                self.n += 1;
            }
        }
    }
    /// Stream Nemesis só com corridas inline; `xor` aplica a transformação inversa.
    pub fn encode_inline(tile_bytes: &[u8], xor: bool) -> Vec<u8> {
        assert_eq!(tile_bytes.len() % 32, 0);
        let tiles = tile_bytes.len() / 32;
        let mut rows: Vec<u32> = tile_bytes
            .chunks_exact(4)
            .map(|c| u32::from_be_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        if xor {
            let mut prev = 0u32;
            for r in rows.iter_mut() {
                let cur = *r;
                *r = cur ^ prev;
                prev = cur;
            }
        }
        let mut pix: Vec<u8> = Vec::new();
        for r in rows {
            for k in (0..8).rev() {
                pix.push(((r >> (k * 4)) & 0xF) as u8);
            }
        }
        let mut out = vec![
            (((tiles >> 8) as u8) & 0x7F) | if xor { 0x80 } else { 0 },
            tiles as u8,
            0xFF,
        ];
        let mut w = BitW::new();
        let mut i = 0;
        while i < pix.len() {
            let mut run = 1;
            while i + run < pix.len() && pix[i + run] == pix[i] && run < 8 {
                run += 1;
            }
            w.put(0x3F, 6);
            w.put(((run as u32 - 1) << 4) | u32::from(pix[i]), 7);
            i += run;
        }
        out.extend(w.bytes);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::testkit::*;
    use super::*;

    fn o() -> DecodeOptions<'static> {
        DecodeOptions::default()
    }

    fn tiles_autorais() -> Vec<u8> {
        // 3 tiles: gradiente, listras e um tile vazio — padrões autorais.
        let mut v = Vec::new();
        for t in 0..3u8 {
            for row in 0..8u8 {
                for col in 0..4u8 {
                    let a = if t == 2 { 0 } else { (row + col + t) & 0xF };
                    let b = if t == 2 { 0 } else { (row * 3 + col) & 0xF };
                    v.push((a << 4) | b);
                }
            }
        }
        v
    }

    #[test]
    fn roundtrip_inline_com_e_sem_xor() {
        let art = tiles_autorais();
        for xor in [false, true] {
            let s = encode_inline(&art, xor);
            let d = decode(&s, &o()).expect("ok");
            assert_eq!(d.bytes, art, "xor={xor}");
            assert_eq!(d.stats.tiles, 3);
            assert_eq!(d.stats.xor_mode, xor);
            assert_eq!(d.stats.bytes_lidos, s.len());
        }
    }

    #[test]
    fn tabela_explicita_decodifica_a_mao() {
        // 1 tile; paleta 5, entrada: run=8 len=1 code=0 → "0" = 8 pixels de cor 5;
        // 8 linhas de 0 → 8 códigos, 1 bit cada → 1 byte de dados 0x00.
        // Mas 1 tile = 64 pixels = 8 códigos de 8 pixels.
        let s = [0x00u8, 0x01, 0x85, 0x71, 0x00, 0xFF, 0x00];
        let d = decode(&s, &o()).expect("ok");
        assert_eq!(d.bytes, vec![0x55u8; 32]);
        assert_eq!(d.stats.table_entries, 1);
        assert_eq!(d.stats.data_bits, 8);
        assert_eq!(d.stats.bytes_lidos, 7);
    }

    #[test]
    fn janela_maior_que_o_stream_para_no_ultimo_pixel() {
        let art = tiles_autorais();
        let mut s = encode_inline(&art, true);
        let n = s.len();
        s.extend_from_slice(&[0xAA; 64]);
        let d = decode(&s, &o()).expect("ok");
        assert_eq!(d.stats.bytes_lidos, n);
    }

    #[test]
    fn todo_prefixo_proprio_e_truncado_sem_panic() {
        let s = encode_inline(&tiles_autorais(), true);
        for k in 0..s.len() {
            assert_eq!(decode(&s[..k], &o()), Err(NemesisError::Truncated), "k={k}");
        }
    }

    #[test]
    fn tabela_malformada_e_recusada() {
        // len 0; len 9; código >= 2^len; entrada sem paleta; prefixos em conflito;
        // conflito com o prefixo inline 111111.
        let casos: [&[u8]; 6] = [
            &[0, 1, 0x85, 0x00, 0x00, 0xFF, 0],
            &[0, 1, 0x85, 0x09, 0x00, 0xFF, 0],
            &[0, 1, 0x85, 0x01, 0x02, 0xFF, 0],
            &[0, 1, 0x01, 0x00, 0xFF, 0],
            &[0, 1, 0x85, 0x71, 0x00, 0x72, 0x01, 0xFF, 0],
            &[0, 1, 0x85, 0x76, 0x3F, 0xFF, 0],
        ];
        for (i, c) in casos.iter().enumerate() {
            assert_eq!(
                decode(c, &o()),
                Err(NemesisError::MalformedTable),
                "caso {i}"
            );
        }
    }

    #[test]
    fn codigo_sem_correspondencia_e_corrida_alem_do_total() {
        // Só a entrada "0" definida; dados começam com bit 1 → prefixos 1,10,... sem match.
        let s = [0u8, 1, 0x85, 0x71, 0x00, 0xFF, 0b1000_0000, 0, 0];
        assert_eq!(decode(&s, &o()), Err(NemesisError::InvalidCode));
        // 1 tile (64 px) mas corridas inline de 7 px: a 10ª chegaria a 70 > 64.
        let mut w = BitW::new();
        for _ in 0..10 {
            w.put(0x3F, 6);
            w.put((6 << 4) | 3, 7);
        }
        let mut s = vec![0u8, 1, 0xFF];
        s.extend(w.bytes);
        assert_eq!(decode(&s, &o()), Err(NemesisError::PixelOverrun));
    }

    #[test]
    fn limites_e_cancelamento_exatos() {
        let art = tiles_autorais();
        let s = encode_inline(&art, false);
        let lim = |max: usize, work: u64| DecodeOptions {
            limits: Limits {
                max_output_bytes: max,
                work_limit: work,
            },
            cancel: None,
        };
        assert!(decode(&s, &lim(96, 4_000_000)).is_ok());
        assert_eq!(
            decode(&s, &lim(95, 4_000_000)),
            Err(NemesisError::ExcessiveOutput)
        );
        let n = decode(&s, &o()).unwrap().stats.codes;
        assert!(decode(&s, &lim(96, n)).is_ok());
        assert_eq!(decode(&s, &lim(96, n - 1)), Err(NemesisError::WorkLimit));
        let c = || true;
        let oc = DecodeOptions {
            limits: Limits::default(),
            cancel: Some(&c),
        };
        // poucos códigos (<256) → cancelamento só é visto com bastante trabalho.
        let grande = vec![0x11u8; 32 * 40];
        let sg = encode_inline(&grande, false);
        assert_eq!(decode(&sg, &oc), Err(NemesisError::Cancelled));
    }

    #[test]
    fn ruido_nunca_da_panic() {
        let mut x = 0x1234_5678u32;
        for _ in 0..4000 {
            let mut v = Vec::new();
            for _ in 0..(x % 200) {
                x = x.wrapping_mul(1664525).wrapping_add(1013904223);
                v.push((x >> 24) as u8);
            }
            let _ = decode(&v, &o());
            x = x.wrapping_mul(1664525).wrapping_add(1013904223);
        }
    }

    #[test]
    fn tiles_zero_e_valido_e_vazio() {
        let d = decode(&[0, 0, 0xFF], &o()).expect("ok");
        assert!(d.bytes.is_empty());
        assert_eq!(d.stats.bytes_lidos, 3);
    }
}
