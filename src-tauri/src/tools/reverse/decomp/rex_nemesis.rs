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

/// Codifica tiles 4bpp em Nemesis (contrato do decoder acima). Códigos canônicos de
/// comprimento limitado a 8 bits ocupam o início do espaço de códigos e somam no máximo
/// 63/64 (Kraft), deixando o prefixo inline `111111` livre; símbolos sem espaço viram
/// corrida inline. Escolhe o menor entre modo normal e XOR. A saída é sempre validada
/// pelo próprio decoder (`None` se não reproduzir os tiles — não deveria acontecer).
pub fn encode(tile_bytes: &[u8]) -> Option<Vec<u8>> {
    if !tile_bytes.len().is_multiple_of(TILE_BYTES) || tile_bytes.len() / TILE_BYTES > MAX_TILES {
        return None;
    }
    let a = encode_mode(tile_bytes, false);
    let b = encode_mode(tile_bytes, true);
    let best = if b.len() < a.len() { b } else { a };
    let back = decode(&best, &DecodeOptions::default()).ok()?;
    (back.bytes == tile_bytes && back.stats.bytes_lidos == best.len()).then_some(best)
}

fn encode_mode(tile_bytes: &[u8], xor: bool) -> Vec<u8> {
    let tiles = tile_bytes.len() / TILE_BYTES;
    let mut prev = 0u32;
    let mut pix = Vec::with_capacity(tiles * TILE_PIXELS);
    for c in tile_bytes.chunks_exact(4) {
        let mut r = u32::from_be_bytes([c[0], c[1], c[2], c[3]]);
        if xor {
            let cur = r;
            r ^= prev;
            prev = cur;
        }
        for k in (0..8).rev() {
            pix.push(((r >> (k * 4)) & 0xF) as u8);
        }
    }
    // Corridas maximais (índice, comprimento); cada uma é partida em símbolos de 1..8.
    let mut runs: Vec<(u8, usize)> = Vec::new();
    for p in &pix {
        match runs.last_mut() {
            Some((v, n)) if v == p => *n += 1,
            _ => runs.push((*p, 1)),
        }
    }
    // Começa guloso (blocos de 8) e itera: códigos -> partição ótima por custo -> códigos.
    let mut codes = build_codes(&partition(&runs, |_, _| 1));
    let mut best = emit(tiles, xor, &partition(&runs, |_, _| 1), &codes);
    for _ in 0..6 {
        let cost = |v: u8, k: u8| codes.get(&(v, k)).map_or(13, |(l, _)| *l);
        let toks = partition(&runs, cost);
        codes = build_codes(&toks);
        let out = emit(tiles, xor, &toks, &codes);
        if out.len() < best.len() {
            best = out;
        } else {
            break;
        }
    }
    best
}

type Codes = std::collections::HashMap<(u8, u8), (u32, u16)>;

/// Parte cada corrida em símbolos de 1..8 pixels minimizando bits (DP por corrida).
fn partition(runs: &[(u8, usize)], cost: impl Fn(u8, u8) -> u32) -> Vec<(u8, u8)> {
    let mut toks = Vec::new();
    for (v, n) in runs {
        let n = *n;
        let mut dp = vec![(u32::MAX, 0u8); n + 1];
        dp[0] = (0, 0);
        for i in 1..=n {
            for k in 1..=i.min(8) {
                let c = dp[i - k].0.saturating_add(cost(*v, k as u8));
                if c < dp[i].0 {
                    dp[i] = (c, k as u8);
                }
            }
        }
        let mut parts = Vec::new();
        let mut i = n;
        while i > 0 {
            let k = dp[i].1;
            parts.push((*v, k));
            i -= usize::from(k);
        }
        toks.extend(parts.into_iter().rev());
    }
    toks
}

/// Tabela canônica limitada a 8 bits, Kraft <= 63/64 (prefixo inline livre), só com
/// símbolos cuja economia sobre o inline (13 bits) paga a entrada de tabela.
fn build_codes(toks: &[(u8, u8)]) -> Codes {
    let mut freq: std::collections::BTreeMap<(u8, u8), u64> = Default::default();
    for t in toks {
        *freq.entry(*t).or_default() += 1;
    }
    let mut syms: Vec<((u8, u8), u64)> = freq.into_iter().collect();
    syms.sort_by(|x, y| y.1.cmp(&x.1).then(x.0.cmp(&y.0)));
    loop {
        let mut lens = huffman_lengths(&syms.iter().map(|s| s.1).collect::<Vec<_>>());
        for l in lens.iter_mut() {
            *l = (*l).clamp(1, 8);
        }
        let kraft = |lens: &[u32]| lens.iter().map(|l| 1u32 << (8 - l)).sum::<u32>();
        while kraft(&lens) > 252 {
            match (0..lens.len()).rev().find(|i| lens[*i] < 8) {
                Some(i) => lens[i] += 1,
                None => {
                    lens.pop();
                    syms.pop();
                }
            }
        }
        // Entrada custa 16 bits (+ troca de índice): descarta a menos lucrativa e refaz.
        let worst = (0..syms.len())
            .filter(|i| syms[*i].1 * u64::from(13u32.saturating_sub(lens[*i])) < 16)
            .min_by_key(|i| syms[*i].1);
        if let Some(i) = worst {
            syms.remove(i);
            continue;
        }
        let mut order: Vec<usize> = (0..syms.len()).collect();
        order.sort_by_key(|i| (lens[*i], syms[*i].0));
        let mut codes = Codes::default();
        let (mut code, mut cur_len) = (0u32, 0u32);
        for i in order {
            let l = lens[i];
            code <<= l - cur_len;
            cur_len = l;
            codes.insert(syms[i].0, (l, code as u16));
            code += 1;
        }
        return codes;
    }
}

fn emit(tiles: usize, xor: bool, toks: &[(u8, u8)], codes: &Codes) -> Vec<u8> {
    let hdr = (tiles as u16) | if xor { 0x8000 } else { 0 };
    let mut out = hdr.to_be_bytes().to_vec();
    let mut by_pal: Vec<((u8, u8), (u32, u16))> = codes.iter().map(|(k, v)| (*k, *v)).collect();
    by_pal.sort_by_key(|(k, _)| *k);
    let mut last_pal = None;
    for ((p, run), (l, c)) in by_pal {
        if last_pal != Some(p) {
            out.push(0x80 | p);
            last_pal = Some(p);
        }
        out.push(((run - 1) << 4) | l as u8);
        out.push(c as u8);
    }
    out.push(0xFF);
    let (mut acc, mut n) = (0u64, 0u32);
    let mut put = |out: &mut Vec<u8>, v: u32, bits: u32| {
        acc = (acc << bits) | u64::from(v);
        n += bits;
        while n >= 8 {
            out.push((acc >> (n - 8)) as u8);
            n -= 8;
        }
    };
    for t in toks {
        match codes.get(t) {
            Some((l, c)) => put(&mut out, u32::from(*c), *l),
            None => {
                put(&mut out, u32::from(INLINE_PREFIX), INLINE_PREFIX_LEN);
                put(&mut out, (u32::from(t.1 - 1) << 4) | u32::from(t.0), 7);
            }
        }
    }
    if n > 0 {
        out.push((acc << (8 - n)) as u8);
    }
    out
}

/// Comprimentos de Huffman (sem limite) para frequências em ordem decrescente.
fn huffman_lengths(freq: &[u64]) -> Vec<u32> {
    if freq.len() <= 1 {
        return vec![1; freq.len()];
    }
    use std::cmp::Reverse;
    let mut heap: std::collections::BinaryHeap<Reverse<(u64, usize)>> = Default::default();
    let mut parent: Vec<usize> = vec![usize::MAX; freq.len()];
    for (i, f) in freq.iter().enumerate() {
        heap.push(Reverse((*f, i)));
    }
    while heap.len() > 1 {
        let Reverse((fa, a)) = heap.pop().unwrap();
        let Reverse((fb, b)) = heap.pop().unwrap();
        let node = parent.len();
        parent.push(usize::MAX);
        parent[a] = node;
        parent[b] = node;
        heap.push(Reverse((fa + fb, node)));
    }
    (0..freq.len())
        .map(|i| {
            let (mut d, mut x) = (0, i);
            while parent[x] != usize::MAX {
                x = parent[x];
                d += 1;
            }
            d
        })
        .collect()
}

/// Folha de tiles 4bpp em 16 colunas: (largura, altura, índices por pixel).
pub fn tiles_to_sheet(tile_bytes: &[u8]) -> (u32, u32, Vec<u8>) {
    let n = tile_bytes.len() / TILE_BYTES;
    let cols = 16usize.min(n.max(1));
    let rows = n.div_ceil(cols).max(1);
    let (w, h) = (cols * 8, rows * 8);
    let mut px = vec![0u8; w * h];
    for t in 0..n {
        for y in 0..8 {
            for x in 0..8 {
                let b = tile_bytes[t * 32 + y * 4 + x / 2];
                px[(t / cols * 8 + y) * w + t % cols * 8 + x] =
                    if x % 2 == 0 { b >> 4 } else { b & 15 };
            }
        }
    }
    (w as u32, h as u32, px)
}

/// Inversa de `tiles_to_sheet` para `tiles` tiles.
pub fn sheet_to_tiles(px: &[u8], w: u32, tiles: usize) -> Vec<u8> {
    let w = w as usize;
    let cols = w / 8;
    let mut out = vec![0u8; tiles * TILE_BYTES];
    for t in 0..tiles {
        for y in 0..8 {
            for x in 0..8 {
                let v = px[(t / cols * 8 + y) * w + t % cols * 8 + x] & 15;
                out[t * 32 + y * 4 + x / 2] |= if x % 2 == 0 { v << 4 } else { v };
            }
        }
    }
    out
}

/// Stream Nemesis localizado por aresta tipada: entrada `{ptr.l, vram.w}` de uma lista
/// de carga de padrões (PLC) com o stream decodificado sem erro no alvo.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LocatedStream {
    pub offset: u32,
    /// Bytes do stream (cabeçalho + tabela + dados), como lidos pelo decoder.
    pub len: u32,
    pub tiles: u32,
    pub xor_mode: bool,
    /// Destino VRAM da primeira entrada que o referencia.
    pub vram: u16,
    /// Tabela PLC que provou o stream.
    pub table: u32,
}

/// Localiza streams Nemesis por listas `{ptr.l, vram.w}` (motor; sem nome de jogo).
/// Uma lista vale só com `min_entries` entradas consecutivas, ponteiros pares para a ROM
/// fora do cabeçalho, VRAM múltiplo de 32 e TODOS os alvos decodificando no contrato
/// estrito e cabendo na VRAM a partir do destino (`vram + tiles*32 <= 64 KiB`, limite de
/// hardware); uma entrada ruim derruba a lista inteira.
pub fn locate_plc_streams(rom: &[u8], min_entries: usize) -> Vec<LocatedStream> {
    let be32 = |p: usize| {
        rom.get(p..p + 4)
            .map(|b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
    };
    let be16 = |p: usize| rom.get(p..p + 2).map(|b| u16::from_be_bytes([b[0], b[1]]));
    let opts = DecodeOptions::default();
    let mut cache: std::collections::HashMap<u32, Option<Stats>> = Default::default();
    let mut decode_at = |a: u32| {
        *cache.entry(a).or_insert_with(|| {
            decode(&rom[a as usize..], &opts)
                .ok()
                .filter(|d| d.stats.tiles > 0)
                .map(|d| d.stats)
        })
    };
    let entry_ok = |p: usize| {
        let (Some(ptr), Some(vram)) = (be32(p), be16(p + 4)) else {
            return None;
        };
        (ptr >= 0x200
            && (ptr as usize) < rom.len()
            && ptr.is_multiple_of(2)
            && vram.is_multiple_of(0x20))
        .then_some((ptr, vram))
    };
    let mut out: Vec<LocatedStream> = Vec::new();
    let mut p = 0x200usize;
    while p + 6 <= rom.len() {
        let mut entries = Vec::new();
        let mut q = p;
        while let Some(e) = entry_ok(q) {
            entries.push(e);
            q += 6;
        }
        if entries.len() < min_entries {
            p += 2;
            continue;
        }
        let decoded: Option<Vec<Stats>> = entries
            .iter()
            .map(|(a, vram)| {
                decode_at(*a).filter(|st| usize::from(*vram) + st.tiles * TILE_BYTES <= 0x10000)
            })
            .collect();
        match decoded {
            Some(stats) => {
                for ((ptr, vram), st) in entries.iter().zip(stats) {
                    if out.iter().any(|s| s.offset == *ptr) {
                        continue;
                    }
                    out.push(LocatedStream {
                        offset: *ptr,
                        len: st.bytes_lidos as u32,
                        tiles: st.tiles as u32,
                        xor_mode: st.xor_mode,
                        vram: *vram,
                        table: p as u32,
                    });
                }
                p = q;
            }
            None => p += 2,
        }
    }
    out.sort_by_key(|s| s.offset);
    out
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

    #[test]
    fn plc_list_locates_streams_and_one_bad_entry_drops_the_list() {
        let art = testkit::encode_inline(&[0x11; 64], false);
        let mut rom = vec![0u8; 0x400];
        rom[0x300..0x300 + art.len()].copy_from_slice(&art);
        rom[0x340..0x340 + art.len()].copy_from_slice(&art);
        let put = |rom: &mut Vec<u8>, at: usize, ptr: u32, vram: u16| {
            rom[at..at + 4].copy_from_slice(&ptr.to_be_bytes());
            rom[at + 4..at + 6].copy_from_slice(&vram.to_be_bytes());
        };
        put(&mut rom, 0x220, 0x300, 0x0000);
        put(&mut rom, 0x226, 0x340, 0x0040);
        rom[0x22C..0x232].fill(0xFF); // fim da lista: ponteiro fora da ROM
        let found = locate_plc_streams(&rom, 2);
        assert_eq!(
            found
                .iter()
                .map(|s| (s.offset, s.tiles, s.vram))
                .collect::<Vec<_>>(),
            vec![(0x300, 2, 0), (0x340, 2, 0x40)]
        );
        assert_eq!(found[0].len as usize, art.len());
        // Segunda entrada aponta para lixo: a lista inteira é recusada.
        put(&mut rom, 0x226, 0x3F0, 0x0040);
        rom[0x3F0..0x3F4].copy_from_slice(&[0x00, 0x02, 0x05, 0x00]);
        assert!(locate_plc_streams(&rom, 2).iter().all(|s| s.table != 0x220));
    }

    #[test]
    #[ignore = "BYOR: RDS_REX_CORPUS_DIR"]
    fn plc_streams_across_corpus() {
        let dir = std::env::var("RDS_REX_CORPUS_DIR").expect("RDS_REX_CORPUS_DIR ausente");
        let mut names: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .collect();
        names.sort();
        for path in names
            .iter()
            .filter(|p| p.extension().is_some_and(|e| e == "bin"))
        {
            let rom = std::fs::read(path).unwrap();
            let s = locate_plc_streams(&rom, 2);
            let tables: std::collections::BTreeSet<u32> = s.iter().map(|x| x.table).collect();
            let bytes: u32 = s.iter().map(|x| x.len).sum();
            println!(
                "plc\t{}\tstreams={}\ttables={}\tbytes={}\ttiles={}",
                path.file_name().unwrap().to_string_lossy(),
                s.len(),
                tables.len(),
                bytes,
                s.iter().map(|x| x.tiles).sum::<u32>()
            );
        }
    }

    #[test]
    #[ignore = "BYOR: RDS_REX_ROM, RDS_REX_OUT (folha de contato em tons de cinza)"]
    fn plc_contact_sheet() {
        let rom = std::fs::read(std::env::var("RDS_REX_ROM").unwrap()).unwrap();
        let out = std::path::PathBuf::from(std::env::var("RDS_REX_OUT").unwrap());
        std::fs::create_dir_all(&out).unwrap();
        let s = locate_plc_streams(&rom, 2);
        let mut overlaps = 0;
        for w in s.windows(2) {
            if w[0].offset + w[0].len > w[1].offset {
                overlaps += 1;
            }
        }
        println!("streams={} overlaps={overlaps}", s.len());
        let (mut a, mut b, mut le) = (0usize, 0usize, 0usize);
        for st in &s {
            let d = decode(&rom[st.offset as usize..], &DecodeOptions::default()).unwrap();
            let e = encode(&d.bytes).unwrap().len();
            a += st.len as usize;
            b += e;
            le += usize::from(e <= st.len as usize);
        }
        println!("reencode: original={a} nosso={b} cabem={le}/{}", s.len());
        let pal: Vec<[u8; 3]> = (0..16).map(|i| [i * 17; 3]).collect();
        for st in &s {
            let d = decode(&rom[st.offset as usize..], &DecodeOptions::default()).unwrap();
            let cols = 16usize.min(st.tiles as usize);
            let rows = (st.tiles as usize).div_ceil(cols);
            let (w, h) = (cols * 8, rows * 8);
            let mut px = vec![0u8; w * h];
            for t in 0..st.tiles as usize {
                for y in 0..8 {
                    for x in 0..8 {
                        let b = d.bytes[t * 32 + y * 4 + x / 2];
                        let v = if x % 2 == 0 { b >> 4 } else { b & 15 };
                        px[(t / cols * 8 + y) * w + t % cols * 8 + x] = v;
                    }
                }
            }
            let png =
                crate::tools::asset_extractor::encode_indexed_png(&px, w as u32, h as u32, &pal);
            std::fs::write(out.join(format!("nem_{:06x}.png", st.offset)), png).unwrap();
            println!(
                "{:06x} len={} tiles={} vram={:04x} table={:06x}",
                st.offset, st.len, st.tiles, st.vram, st.table
            );
        }
    }

    #[test]
    fn encoder_roundtrips_through_the_strict_decoder() {
        let mut seed = 0x1234_5678u32;
        let mut rnd = || {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            seed
        };
        // Arte com corridas, ruído puro e um único índice: todos reproduzem byte a byte.
        let mut art = vec![0u8; 32 * 40];
        for (i, b) in art.iter_mut().enumerate() {
            *b = if i % 7 < 4 {
                0x11
            } else {
                (rnd() & 0xFF) as u8 & 0x37
            };
        }
        let noise: Vec<u8> = (0..32 * 9).map(|_| rnd() as u8).collect();
        for tiles in [art, noise, vec![0x55; 64], Vec::new()] {
            let enc = encode(&tiles).expect("codifica");
            let dec = decode(&enc, &DecodeOptions::default()).unwrap();
            assert_eq!(dec.bytes, tiles);
            assert_eq!(dec.stats.bytes_lidos, enc.len());
        }
    }

    #[test]
    fn sheet_roundtrips_tiles() {
        let tiles: Vec<u8> = (0..32 * 20).map(|i| (i * 37 % 256) as u8).collect();
        let (w, _, px) = tiles_to_sheet(&tiles);
        assert_eq!(sheet_to_tiles(&px, w, 20), tiles);
    }
}
