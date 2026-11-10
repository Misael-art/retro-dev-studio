//! Primitivas gráficas genéricas do Mega Drive, SEM conhecimento de jogo:
//! tiles 4bpp, peças de sprite-mapping (formato Sonic 1/2 de 5 bytes), CRAM
//! e composição indexada. Puro: sem I/O, sem serialização. Um perfil (ex.:
//! `sonic_ss_walls`) fornece a ORIGEM de cada entrada (offsets, paleta) e
//! carrega a prova; aqui só há aritmética verificada e recusas explícitas.
//!
//! Regras de honestidade: nada é preenchido. Tile fora da arte = erro; tile
//! inteiramente zero é REPORTADO como vazio (nunca como arte recuperada);
//! a paleta é um parâmetro do chamador (estática, observada ou escolhida) e a
//! composição devolve índices, nunca cores presumidas.

pub const TILE_BYTES: usize = 32;
pub const PALETTE_LINES: usize = 4;
pub const COLORS_PER_LINE: usize = 16;
pub const PIECE_BYTES: usize = 5;
pub const MAX_PIECES: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GfxError {
    /// Leitura além do buffer (tabela, frame ou peça).
    OutOfRange,
    /// Peça aponta para tile além da arte disponível.
    TileOutOfArt,
    /// Contagem de peças acima de `MAX_PIECES` ou frame sem peças legíveis.
    BadPieceCount,
    /// Palavra de paleta/linha fora de 0..=3 ou tamanho de paleta errado.
    BadPalette,
}

impl GfxError {
    pub fn code(&self) -> &'static str {
        match self {
            GfxError::OutOfRange => "out-of-range",
            GfxError::TileOutOfArt => "tile-out-of-art",
            GfxError::BadPieceCount => "bad-piece-count",
            GfxError::BadPalette => "bad-palette",
        }
    }
}

/// Peça de mapping: nome de tile de 16 bits decomposto como o VDP o lê.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Piece {
    pub y: i8,
    pub x: i8,
    /// Largura/altura em tiles (1..=4).
    pub w: u8,
    pub h: u8,
    /// Índice do primeiro tile (11 bits), RELATIVO à base de arte do chamador.
    pub tile: u16,
    pub priority: bool,
    /// Linha de paleta 0..=3 codificada na própria peça.
    pub palette: u8,
    pub xflip: bool,
    pub yflip: bool,
}

impl Piece {
    pub fn tile_count(&self) -> usize {
        usize::from(self.w) * usize::from(self.h)
    }
}

/// Lê uma peça de 5 bytes: `y, size(0000wwhh), name(2), x`.
pub fn parse_piece(b: &[u8]) -> Result<Piece, GfxError> {
    if b.len() < PIECE_BYTES {
        return Err(GfxError::OutOfRange);
    }
    let name = u16::from_be_bytes([b[2], b[3]]);
    Ok(Piece {
        y: b[0] as i8,
        x: b[4] as i8,
        w: ((b[1] >> 2) & 3) + 1,
        h: (b[1] & 3) + 1,
        tile: name & 0x7FF,
        priority: name & 0x8000 != 0,
        palette: ((name >> 13) & 3) as u8,
        xflip: name & 0x0800 != 0,
        yflip: name & 0x1000 != 0,
    })
}

/// Frame `i` de uma tabela de mappings com ponteiros de 16 bits RELATIVOS ao
/// início da tabela (`table_off`), cada frame = `count(1) + count*5`.
/// `frame_count` vem da PROVA do perfil (tamanho da tabela), nunca é adivinhado.
pub fn parse_frame(
    rom: &[u8],
    table_off: usize,
    frame_count: usize,
    i: usize,
) -> Result<Vec<Piece>, GfxError> {
    if i >= frame_count {
        return Err(GfxError::OutOfRange);
    }
    let p = table_off
        .checked_add(2 * i)
        .and_then(|a| rom.get(a..a + 2))
        .ok_or(GfxError::OutOfRange)?;
    let rel = usize::from(u16::from_be_bytes([p[0], p[1]]));
    let off = table_off.checked_add(rel).ok_or(GfxError::OutOfRange)?;
    let n = usize::from(*rom.get(off).ok_or(GfxError::OutOfRange)?);
    if n == 0 || n > MAX_PIECES {
        return Err(GfxError::BadPieceCount);
    }
    let mut out = Vec::with_capacity(n);
    for k in 0..n {
        let a = off + 1 + k * PIECE_BYTES;
        out.push(parse_piece(
            rom.get(a..a + PIECE_BYTES).ok_or(GfxError::OutOfRange)?,
        )?);
    }
    Ok(out)
}

impl Piece {
    /// Nome de tile de 16 bits como o VDP o somaria ao `art_tile` do objeto:
    /// `campo + nome` (módulo 2^16), re-decomposto. É o que o jogo faz ao montar sprites.
    pub fn with_base(&self, campo: u16) -> Piece {
        let raw = (u16::from(self.priority) << 15)
            | (u16::from(self.palette) << 13)
            | (u16::from(self.yflip) << 12)
            | (u16::from(self.xflip) << 11)
            | self.tile;
        let n = campo.wrapping_add(raw);
        Piece {
            tile: n & 0x7FF,
            priority: n & 0x8000 != 0,
            palette: ((n >> 13) & 3) as u8,
            xflip: n & 0x0800 != 0,
            yflip: n & 0x1000 != 0,
            ..*self
        }
    }
}

/// Deslocamentos dos frames de uma tabela de ponteiros relativos, por regra
/// CONSERVADORA: palavra k válida se `2*(k+1) <= v < 0x100` e `2*k <` menor
/// ponteiro visto. Para ao primeiro dado que não parece ponteiro; nunca lê
/// além de `MAX_FRAMES_TABLE`. A regra é heurística: o chamador só a usa para
/// frames CONFIRMADOS por outra evidência.
pub const MAX_FRAMES_TABLE: usize = 32;

pub fn frame_offsets(rom: &[u8], table_off: usize) -> Vec<usize> {
    let mut out = Vec::new();
    let mut min = usize::MAX;
    for k in 0..MAX_FRAMES_TABLE {
        if 2 * k >= min {
            break;
        }
        let Some(w) = table_off.checked_add(2 * k).and_then(|a| rom.get(a..a + 2)) else {
            break;
        };
        let v = usize::from(u16::from_be_bytes([w[0], w[1]]));
        if v < 2 * (k + 1) || v >= 0x100 {
            break;
        }
        min = min.min(v);
        out.push(v);
    }
    out
}

/// Peças do frame no deslocamento `off` (absoluto). `Ok(vec![])` = frame
/// legitimamente vazio (contagem 0), distinto de erro.
pub fn parse_frame_at(rom: &[u8], off: usize) -> Result<Vec<Piece>, GfxError> {
    let n = usize::from(*rom.get(off).ok_or(GfxError::OutOfRange)?);
    if n > MAX_PIECES {
        return Err(GfxError::BadPieceCount);
    }
    let mut out = Vec::with_capacity(n);
    for k in 0..n {
        let a = off + 1 + k * PIECE_BYTES;
        out.push(parse_piece(
            rom.get(a..a + PIECE_BYTES).ok_or(GfxError::OutOfRange)?,
        )?);
    }
    Ok(out)
}

/// Cue de uma lista de carga de arte (PLC): stream comprimido → destino VRAM.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlcCue {
    pub stream_offset: usize,
    pub vram: u16,
}

impl PlcCue {
    /// Índice do primeiro tile no destino (VRAM / 32).
    pub fn first_tile(&self) -> usize {
        usize::from(self.vram) / TILE_BYTES
    }
}

pub const MAX_PLC_CUES: usize = 64;

/// Lista PLC do Sonic 1/2: `count-1 (w)` seguido de `count × (stream.l, vram.w)`.
/// O chamador (perfil) fornece o offset PROVADO; aqui só há leitura com limites.
pub fn parse_plc(rom: &[u8], off: usize) -> Result<Vec<PlcCue>, GfxError> {
    let h = rom.get(off..off + 2).ok_or(GfxError::OutOfRange)?;
    let n = usize::from(u16::from_be_bytes([h[0], h[1]])) + 1;
    if n > MAX_PLC_CUES {
        return Err(GfxError::BadPieceCount);
    }
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let a = off + 2 + i * 6;
        let b = rom.get(a..a + 6).ok_or(GfxError::OutOfRange)?;
        out.push(PlcCue {
            stream_offset: u32::from_be_bytes([b[0], b[1], b[2], b[3]]) as usize,
            vram: u16::from_be_bytes([b[4], b[5]]),
        });
    }
    Ok(out)
}

/// Tile `t` da arte (4bpp) como 64 índices 0..=15, linha a linha.
pub fn tile_indices(art: &[u8], t: usize) -> Result<[u8; 64], GfxError> {
    let b = t
        .checked_mul(TILE_BYTES)
        .and_then(|a| art.get(a..a + TILE_BYTES))
        .ok_or(GfxError::TileOutOfArt)?;
    let mut out = [0u8; 64];
    for y in 0..8 {
        for x in 0..8 {
            let byte = b[y * 4 + x / 2];
            out[y * 8 + x] = if x % 2 == 0 { byte >> 4 } else { byte & 0xF };
        }
    }
    Ok(out)
}

pub fn tile_is_empty(art: &[u8], t: usize) -> Result<bool, GfxError> {
    Ok(tile_indices(art, t)?.iter().all(|&p| p == 0))
}

/// Imagem indexada: `pixels[y*w+x]` = linha*16 + índice (0 = transparente, em
/// qualquer linha). `x0,y0` = canto superior esquerdo relativo à origem do
/// objeto (coordenadas das peças).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Indexed {
    pub x0: i32,
    pub y0: i32,
    pub w: usize,
    pub h: usize,
    /// Valor 0 = transparente; senão `(linha << 4) | índice` com índice 1..=15.
    pub pixels: Vec<u8>,
    /// Tiles usados (índice absoluto na arte) e quais são totalmente vazios.
    pub tiles_usados: Vec<usize>,
    pub tiles_vazios: Vec<usize>,
}

/// Compõe as peças de um frame. `tile_base` é somado ao índice relativo da
/// peça (campo do registro, ex. `$0142`→`0x142`... o chamador passa o índice
/// do tile 0 DA ARTE DECODIFICADA, ou seja `0` quando a arte começa na base).
/// `line_override`: linha de paleta imposta (por registro); `None` usa a da peça.
/// Flips por peça e `object_xflip/yflip` (flags de render do objeto) são
/// aplicados; peças posteriores sobrescrevem as anteriores só onde opacas.
pub fn compose(
    pieces: &[Piece],
    art: &[u8],
    tile_base: usize,
    line_override: Option<u8>,
    object_xflip: bool,
    object_yflip: bool,
) -> Result<Indexed, GfxError> {
    if pieces.is_empty() {
        return Err(GfxError::BadPieceCount);
    }
    if line_override.is_some_and(|l| usize::from(l) >= PALETTE_LINES) {
        return Err(GfxError::BadPalette);
    }
    // Retângulo envolvente (em pixels, sem flip de objeto).
    let (mut x0, mut y0, mut x1, mut y1) = (i32::MAX, i32::MAX, i32::MIN, i32::MIN);
    for p in pieces {
        x0 = x0.min(i32::from(p.x));
        y0 = y0.min(i32::from(p.y));
        x1 = x1.max(i32::from(p.x) + 8 * i32::from(p.w));
        y1 = y1.max(i32::from(p.y) + 8 * i32::from(p.h));
    }
    let (w, h) = ((x1 - x0) as usize, (y1 - y0) as usize);
    let mut buf = vec![0u8; w * h];
    let mut usados: Vec<usize> = Vec::new();
    let mut vazios: Vec<usize> = Vec::new();
    for p in pieces {
        for k in 0..p.tile_count() {
            let t = tile_base + usize::from(p.tile) + k;
            if !usados.contains(&t) {
                usados.push(t);
                if tile_is_empty(art, t)? {
                    vazios.push(t);
                }
            }
        }
    }
    // Cada pixel da peça é calculado em coordenadas da peça (u,v), espelhado
    // como um todo, e só então o tile e o pixel são resolvidos a partir da
    // posição ESPELHADA (um espelho por tile não reposicionaria os tiles).
    for p in pieces {
        let line = line_override.unwrap_or(p.palette);
        let (pw, ph) = (8 * usize::from(p.w), 8 * usize::from(p.h));
        for v in 0..ph {
            for u in 0..pw {
                let (su, sv) = (
                    if p.xflip { pw - 1 - u } else { u },
                    if p.yflip { ph - 1 - v } else { v },
                );
                let (cx, cy) = (su / 8, sv / 8);
                let t = tile_base + usize::from(p.tile) + cx * usize::from(p.h) + cy;
                let px = tile_indices(art, t)?;
                let c = px[(sv % 8) * 8 + (su % 8)];
                if c == 0 {
                    continue;
                }
                let gx = (i32::from(p.x) - x0) as usize + u;
                let gy = (i32::from(p.y) - y0) as usize + v;
                buf[gy * w + gx] = (line << 4) | c;
            }
        }
    }
    let (mut ox0, mut oy0) = (x0, y0);
    if object_xflip {
        for r in 0..h {
            buf[r * w..(r + 1) * w].reverse();
        }
        ox0 = -x1;
    }
    if object_yflip {
        let mut flipped = Vec::with_capacity(buf.len());
        for r in (0..h).rev() {
            flipped.extend_from_slice(&buf[r * w..(r + 1) * w]);
        }
        buf = flipped;
        oy0 = -y1;
    }
    usados.sort_unstable();
    vazios.sort_unstable();
    Ok(Indexed {
        x0: ox0,
        y0: oy0,
        w,
        h,
        pixels: buf,
        tiles_usados: usados,
        tiles_vazios: vazios,
    })
}

/// CRAM `0000BBB0GGG0RRR0` → níveis 0..=7 por canal.
pub fn cram_levels(word: u16) -> (u8, u8, u8) {
    (
        ((word >> 1) & 7) as u8,
        ((word >> 5) & 7) as u8,
        ((word >> 9) & 7) as u8,
    )
}

/// Conversão de exibição documentada (C6): nível `n` → `round(n*255/7)`.
/// NÃO é a tabela de nenhum core; só a representação da UI.
pub fn cram_to_rgb8(word: u16) -> (u8, u8, u8) {
    let f = |n: u8| ((u32::from(n) * 255 + 3) / 7) as u8;
    let (r, g, b) = cram_levels(word);
    (f(r), f(g), f(b))
}

/// Palavras de uma paleta de 4 linhas (64 BE) a partir de bytes.
pub fn palette_words(bytes: &[u8]) -> Result<[u16; 64], GfxError> {
    if bytes.len() != 128 {
        return Err(GfxError::BadPalette);
    }
    let mut out = [0u16; 64];
    for (i, w) in out.iter_mut().enumerate() {
        *w = u16::from_be_bytes([bytes[2 * i], bytes[2 * i + 1]]);
    }
    Ok(out)
}

/// RGBA de uma imagem indexada com a paleta dada (índice 0 = alfa 0).
pub fn to_rgba(img: &Indexed, pal: &[u16; 64]) -> Vec<u8> {
    let mut out = Vec::with_capacity(img.pixels.len() * 4);
    for &p in &img.pixels {
        if p & 0xF == 0 {
            out.extend_from_slice(&[0, 0, 0, 0]);
        } else {
            let (r, g, b) = cram_to_rgb8(pal[usize::from(p)]);
            out.extend_from_slice(&[r, g, b, 255]);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn art_autoral() -> Vec<u8> {
        // 4 tiles: cada pixel = (tile*4 + linha + coluna) % 15 + 1  (nunca zero),
        // exceto o tile 3 (vazio).
        let mut v = Vec::new();
        for t in 0..4usize {
            for y in 0..8usize {
                for x in 0..4usize {
                    let f = |xx: usize| -> u8 {
                        if t == 3 {
                            0
                        } else {
                            ((t * 4 + y + xx) % 15 + 1) as u8
                        }
                    };
                    v.push((f(x * 2) << 4) | f(x * 2 + 1));
                }
            }
        }
        v
    }

    #[test]
    fn frame_offsets_regra_conservadora_e_frame_vazio() {
        // 3 ponteiros (6,12,18) seguidos de dado que não é ponteiro (0x01F4)
        let rom = [0, 6, 0, 12, 0, 18, 1, 0xF4, 0x0A, 0, 0, 0xF4];
        assert_eq!(frame_offsets(&rom, 0), vec![6, 12, 18]);
        // ponteiro ímpar é válido (dados de mapping têm alinhamento de byte)
        assert_eq!(frame_offsets(&[0, 5, 0, 9, 0, 0], 0), vec![5, 9]);
        assert_eq!(frame_offsets(&[], 0), Vec::<usize>::new());
        assert_eq!(parse_frame_at(&[0], 0), Ok(vec![]));
        assert_eq!(parse_frame_at(&[1, 0, 0], 0), Err(GfxError::OutOfRange));
        assert_eq!(parse_frame_at(&[0xFF], 0), Err(GfxError::BadPieceCount));
    }

    #[test]
    fn with_base_soma_modulo_e_redecompoe() {
        let p = parse_piece(&[0, 0x0A, 0x00, 0x09, 0]).unwrap(); // nome 0x0009
        let q = p.with_base(0x2F0 | 0x2000);
        assert_eq!(q.tile, 0x2F9);
        assert_eq!(q.palette, 1);
        // vai-e-volta no módulo 2^16: base 0xFFFF + nome 1 = 0
        let r = parse_piece(&[0, 0x00, 0x00, 0x01, 0])
            .unwrap()
            .with_base(0xFFFF);
        assert_eq!(
            (r.tile, r.palette, r.xflip, r.yflip, r.priority),
            (0, 0, false, false, false)
        );
    }

    #[test]
    fn plc_le_cues_com_limites() {
        // 2 cues: (0x00012345 → vram 0x0A20), (0x00000010 → 0x0000)
        let mut b = vec![0x00, 0x01];
        b.extend_from_slice(&[0x00, 0x01, 0x23, 0x45, 0x0A, 0x20]);
        b.extend_from_slice(&[0x00, 0x00, 0x00, 0x10, 0x00, 0x00]);
        let c = parse_plc(&b, 0).unwrap();
        assert_eq!(c.len(), 2);
        assert_eq!(c[0].stream_offset, 0x12345);
        assert_eq!(c[0].first_tile(), 0x51);
        assert_eq!(parse_plc(&b[..13], 0), Err(GfxError::OutOfRange));
        assert_eq!(parse_plc(&[0x00, 0x40], 0), Err(GfxError::BadPieceCount));
        assert_eq!(parse_plc(&[], 0), Err(GfxError::OutOfRange));
    }

    #[test]
    fn peca_decompoe_o_nome_de_tile_do_vdp() {
        // y=-12 size w=3,h=3 (0b1010) nome=0xE80F → pri=1 pal=3 yflip=0 xflip=1 tile=0x00F? (0x080F&0x7FF)
        let p = parse_piece(&[0xF4, 0x0A, 0xE8, 0x0F, 0xF8]).unwrap();
        assert_eq!((p.y, p.x, p.w, p.h), (-12, -8, 3, 3));
        assert!(p.priority && p.xflip && !p.yflip);
        assert_eq!(p.palette, 3);
        assert_eq!(p.tile, 0x00F);
        assert_eq!(parse_piece(&[0; 4]), Err(GfxError::OutOfRange));
    }

    #[test]
    fn frame_le_tabela_relativa_e_recusa_o_que_nao_cabe() {
        // tabela com 1 frame: ptr=2 → count=1 + 1 peça
        let rom = [0x00, 0x02, 0x01, 0xF8, 0x00, 0x00, 0x01, 0xF8];
        let f = parse_frame(&rom, 0, 1, 0).unwrap();
        assert_eq!(f.len(), 1);
        assert_eq!(parse_frame(&rom, 0, 1, 1), Err(GfxError::OutOfRange));
        assert_eq!(parse_frame(&rom[..7], 0, 1, 0), Err(GfxError::OutOfRange));
        let zero = [0x00, 0x02, 0x00];
        assert_eq!(parse_frame(&zero, 0, 1, 0), Err(GfxError::BadPieceCount));
        let enorme = [0x00, 0x02, 0xFF];
        assert_eq!(parse_frame(&enorme, 0, 1, 0), Err(GfxError::BadPieceCount));
    }

    #[test]
    fn tile_fora_da_arte_e_erro_e_vazio_e_reportado() {
        let art = art_autoral();
        assert!(tile_indices(&art, 3).unwrap().iter().all(|&p| p == 0));
        assert_eq!(tile_is_empty(&art, 3), Ok(true));
        assert_eq!(tile_is_empty(&art, 0), Ok(false));
        assert_eq!(tile_indices(&art, 4), Err(GfxError::TileOutOfArt));
        let p = Piece {
            y: 0,
            x: 0,
            w: 1,
            h: 1,
            tile: 4,
            priority: false,
            palette: 0,
            xflip: false,
            yflip: false,
        };
        assert_eq!(
            compose(&[p], &art, 0, None, false, false),
            Err(GfxError::TileOutOfArt)
        );
    }

    #[test]
    fn composicao_2x2_usa_ordem_coluna_major_e_reporta_vazios() {
        let art = art_autoral();
        let p = Piece {
            y: 0,
            x: 0,
            w: 2,
            h: 2,
            tile: 0,
            priority: false,
            palette: 1,
            xflip: false,
            yflip: false,
        };
        let img = compose(&[p], &art, 0, None, false, false).unwrap();
        assert_eq!((img.w, img.h), (16, 16));
        // coluna 0 = tiles 0 (cima) e 1 (baixo); coluna 1 = tiles 2 e 3 (vazio)
        let t0 = tile_indices(&art, 0).unwrap();
        let t1 = tile_indices(&art, 1).unwrap();
        let t2 = tile_indices(&art, 2).unwrap();
        assert_eq!(img.pixels[0], (1 << 4) | t0[0]);
        assert_eq!(img.pixels[8 * 16], (1 << 4) | t1[0]);
        assert_eq!(img.pixels[8], (1 << 4) | t2[0]);
        assert_eq!(img.pixels[8 * 16 + 8], 0); // tile 3 vazio => transparente
        assert_eq!(img.tiles_vazios, vec![3]);
        assert_eq!(img.tiles_usados, vec![0, 1, 2, 3]);
    }

    #[test]
    fn flips_de_peca_e_de_objeto_sao_espelhos_exatos() {
        let art = art_autoral();
        let mk = |xf, yf| Piece {
            y: 0,
            x: 0,
            w: 2,
            h: 1,
            tile: 0,
            priority: false,
            palette: 0,
            xflip: xf,
            yflip: yf,
        };
        let base = compose(&[mk(false, false)], &art, 0, None, false, false).unwrap();
        let xf = compose(&[mk(true, false)], &art, 0, None, false, false).unwrap();
        for y in 0..base.h {
            for x in 0..base.w {
                assert_eq!(
                    xf.pixels[y * base.w + x],
                    base.pixels[y * base.w + (base.w - 1 - x)]
                );
            }
        }
        let yf = compose(&[mk(false, true)], &art, 0, None, false, false).unwrap();
        for y in 0..base.h {
            assert_eq!(
                &yf.pixels[y * base.w..(y + 1) * base.w],
                &base.pixels[(base.h - 1 - y) * base.w..(base.h - y) * base.w]
            );
        }
        // flip de objeto equivale ao flip da peça e troca a origem
        let ox = compose(&[mk(false, false)], &art, 0, None, true, false).unwrap();
        assert_eq!(ox.pixels, xf.pixels);
        assert_eq!(ox.x0, -16);
        let oy = compose(&[mk(false, false)], &art, 0, None, false, true).unwrap();
        assert_eq!(oy.pixels, yf.pixels);
        assert_eq!(oy.y0, -8);
    }

    #[test]
    fn linha_imposta_vale_e_linha_invalida_e_recusada() {
        let art = art_autoral();
        let p = Piece {
            y: 0,
            x: 0,
            w: 1,
            h: 1,
            tile: 0,
            priority: false,
            palette: 0,
            xflip: false,
            yflip: false,
        };
        let img = compose(&[p], &art, 0, Some(2), false, false).unwrap();
        assert!(img.pixels.iter().all(|&v| v >> 4 == 2));
        assert_eq!(
            compose(&[p], &art, 0, Some(4), false, false),
            Err(GfxError::BadPalette)
        );
        assert_eq!(
            compose(&[], &art, 0, None, false, false),
            Err(GfxError::BadPieceCount)
        );
    }

    #[test]
    fn cram_niveis_conversao_e_paleta() {
        assert_eq!(cram_levels(0x0EEE), (7, 7, 7));
        assert_eq!(cram_levels(0x0822), (1, 1, 4));
        assert_eq!(cram_to_rgb8(0x0EEE), (255, 255, 255));
        assert_eq!(cram_to_rgb8(0x0000), (0, 0, 0));
        assert_eq!(cram_to_rgb8(0x0222), (36, 36, 36)); // round(255/7)
        assert_eq!(cram_to_rgb8(0x0CCC), (219, 219, 219)); // round(6*255/7)
        assert_eq!(palette_words(&[0u8; 127]), Err(GfxError::BadPalette));
        let mut b = [0u8; 128];
        b[2] = 0x0E;
        b[3] = 0xEE;
        assert_eq!(palette_words(&b).unwrap()[1], 0x0EEE);
    }

    #[test]
    fn rgba_so_pinta_indices_nao_zero() {
        let art = art_autoral();
        let p = Piece {
            y: 0,
            x: 0,
            w: 1,
            h: 1,
            tile: 3,
            priority: false,
            palette: 0,
            xflip: false,
            yflip: false,
        };
        let img = compose(&[p], &art, 0, None, false, false).unwrap();
        let rgba = to_rgba(&img, &[0x0EEE; 64]);
        assert!(rgba.chunks_exact(4).all(|px| px[3] == 0)); // tile vazio: nada pintado
    }
}
