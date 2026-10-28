//! Snapshot do VDP do Mega Drive a partir do savestate do Genesis Plus GX (Experimental).
//!
//! O core nao expoe VRAM/CRAM pela API de memoria do Libretro (`RETRO_MEMORY_VIDEO_RAM`
//! tem tamanho 0), mas o savestate carrega o contexto completo do VDP. O layout lido aqui
//! e o de `state.c`/`vdp_context_save` do GPGX 1.7.x: versao (16) | WRAM (0x10000) |
//! ZRAM (0x2000) | zstate (1) | zbank (4) | io_reg (0x10) | SAT (0x400) | VRAM (0x10000) |
//! CRAM (0x80) | VSRAM (0x80) | regs (0x20). Nada e chutado: o cabecalho tem de ser
//! `GENPLUS-GX 1.7`, a WRAM do savestate tem de bater byte a byte com a WRAM exposta pelo
//! core e os registradores tem de descrever o modo 5; senao a leitura e recusada.
//!
//! Com o snapshot, a tela e recomposta como o VDP faz (planos A/B com tiles 4bpp, paletas,
//! flips e scroll; plano Window; sprites pela cadeia de links da SAT) respeitando a prioridade
//! por tile/sprite. Sombra/realce e o limite de sprites por linha nao sao modelados.

use image::{Rgba, RgbaImage};

const HEADER: &[u8] = b"GENPLUS-GX 1.7";
const WRAM_OFFSET: usize = 16;
const WRAM_SIZE: usize = 0x10000;
const VDP_OFFSET: usize = WRAM_OFFSET + WRAM_SIZE + 0x2000 + 1 + 4 + 0x10;
const SAT_CACHE: usize = 0x400;
const VRAM_SIZE: usize = 0x10000;

#[derive(Debug, Clone)]
pub struct VdpSnapshot {
    /// VRAM na ordem do Mega Drive (big-endian por palavra).
    pub vram: Vec<u8>,
    /// 64 cores em 9 bits `BBBGGGRRR`.
    pub cram: [u16; 64],
    pub vsram: [u16; 40],
    pub regs: [u8; 32],
}

pub fn parse_gpgx_state(state: &[u8], wram: &[u8]) -> Result<VdpSnapshot, String> {
    if !state.starts_with(HEADER) {
        return Err(format!(
            "Savestate nao e do Genesis Plus GX 1.7 (cabecalho {:?}); captura do VDP recusada.",
            String::from_utf8_lossy(&state[..state.len().min(16)])
        ));
    }
    let end = VDP_OFFSET + SAT_CACHE + VRAM_SIZE + 0x80 + 0x80 + 0x20;
    if state.len() < end {
        return Err("Savestate menor que o layout esperado do VDP.".to_string());
    }
    if wram.len() != WRAM_SIZE || state[WRAM_OFFSET..WRAM_OFFSET + WRAM_SIZE] != *wram {
        return Err(
            "WRAM do savestate nao confere com a WRAM do core; layout nao reconhecido, captura recusada."
                .to_string(),
        );
    }
    let vram_at = VDP_OFFSET + SAT_CACHE;
    let cram_at = vram_at + VRAM_SIZE;
    let vsram_at = cram_at + 0x80;
    let regs_at = vsram_at + 0x80;
    let mut regs = [0u8; 32];
    regs.copy_from_slice(&state[regs_at..regs_at + 32]);
    if regs[1] & 0x04 == 0 || regs[2] & 0xC7 != 0 || regs[4] & 0xF8 != 0 {
        return Err("Registradores do VDP fora do modo 5; captura recusada.".to_string());
    }
    let word = |at: usize| u16::from_le_bytes([state[at], state[at + 1]]);
    let mut vram = Vec::with_capacity(VRAM_SIZE);
    for pair in state[vram_at..cram_at].chunks(2) {
        vram.extend_from_slice(&[pair[1], pair[0]]);
    }
    let mut cram = [0u16; 64];
    for (index, color) in cram.iter_mut().enumerate() {
        *color = word(cram_at + index * 2) & 0x1FF;
    }
    if cram.iter().any(|c| *c > 0x1FF) {
        return Err("CRAM fora do formato 9 bits; captura recusada.".to_string());
    }
    let mut vsram = [0u16; 40];
    for (index, value) in vsram.iter_mut().enumerate() {
        *value = word(vsram_at + index * 2) & 0x7FF;
    }
    Ok(VdpSnapshot {
        vram,
        cram,
        vsram,
        regs,
    })
}

impl VdpSnapshot {
    fn vword(&self, addr: usize) -> u16 {
        let addr = addr & 0xFFFE;
        u16::from_be_bytes([self.vram[addr], self.vram[addr + 1]])
    }

    pub fn screen_width(&self) -> u32 {
        if self.regs[12] & 0x01 != 0 {
            320
        } else {
            256
        }
    }

    pub fn screen_height(&self) -> u32 {
        if self.regs[1] & 0x08 != 0 {
            240
        } else {
            224
        }
    }

    pub fn plane_a_base(&self) -> usize {
        ((self.regs[2] as usize) & 0x38) << 10
    }

    pub fn plane_b_base(&self) -> usize {
        ((self.regs[4] as usize) & 0x07) << 13
    }

    pub fn sat_base(&self) -> usize {
        let mask = if self.screen_width() == 320 {
            0x7E
        } else {
            0x7F
        };
        ((self.regs[5] as usize) & mask) << 9
    }

    fn hscroll_base(&self) -> usize {
        ((self.regs[13] as usize) & 0x3F) << 10
    }

    /// Tamanho do plano em celulas (largura, altura).
    pub fn plane_size(&self) -> (usize, usize) {
        let dim = |bits: u8| match bits & 3 {
            0 => 32,
            1 => 64,
            _ => 128,
        };
        (dim(self.regs[16]), dim(self.regs[16] >> 4))
    }

    pub fn color(&self, index: usize) -> Rgba<u8> {
        let value = self.cram[index & 63];
        // Mesmos niveis que o Genesis Plus GX entrega no framebuffer (~34 por passo, branco 238).
        let scale = |c: u16| ((c & 7) * 34) as u8;
        Rgba([scale(value), scale(value >> 3), scale(value >> 6), 255])
    }

    pub fn backdrop(&self) -> Rgba<u8> {
        self.color((self.regs[7] & 0x3F) as usize)
    }

    /// Indice de cor (0 = transparente) de um pixel de tile.
    fn tile_pixel(&self, tile: usize, x: usize, y: usize) -> usize {
        let byte = self.vram[(tile * 32 + y * 4 + x / 2) & 0xFFFF];
        (if x.is_multiple_of(2) {
            byte >> 4
        } else {
            byte & 0x0F
        }) as usize
    }

    fn hscroll(&self, plane_b: bool, line: usize) -> i32 {
        let row = match self.regs[11] & 3 {
            0 => 0,
            2 => line & !7,
            3 => line,
            _ => line & 7,
        };
        let value = self.vword(self.hscroll_base() + row * 4 + if plane_b { 2 } else { 0 });
        (value & 0x3FF) as i32
    }

    fn vscroll(&self, plane_b: bool, column: usize) -> i32 {
        let index = if self.regs[11] & 0x04 != 0 {
            (column / 16) * 2
        } else {
            0
        } + usize::from(plane_b);
        (self.vsram[index.min(39)] & 0x3FF) as i32
    }

    fn window_base(&self) -> usize {
        let mask = if self.screen_width() == 320 {
            0x3C
        } else {
            0x3E
        };
        ((self.regs[3] as usize) & mask) << 10
    }

    /// O plano Window substitui o plano A nas linhas/colunas definidas por R17/R18.
    fn in_window(&self, sx: usize, sy: usize) -> bool {
        let (h, v) = (self.regs[17], self.regs[18]);
        let hp = ((h & 0x1F) as usize) * 16;
        let vp = ((v & 0x1F) as usize) * 8;
        let in_h = if h & 0x80 != 0 { sx >= hp } else { sx < hp };
        let in_v = if v & 0x80 != 0 { sy >= vp } else { sy < vp };
        in_h || in_v
    }

    /// Pixel de um plano na tela: indice de cor (0 = transparente), linha de paleta e prioridade.
    pub fn plane_pixel(&self, plane: VdpPlane, sx: usize, sy: usize) -> PlanePixel {
        let (base, cells_w, px, py) = match plane {
            VdpPlane::Window => {
                if !self.in_window(sx, sy) {
                    return PlanePixel::default();
                }
                let cells = if self.screen_width() == 320 { 64 } else { 32 };
                (self.window_base(), cells, sx, sy)
            }
            VdpPlane::A | VdpPlane::B => {
                if plane == VdpPlane::A && self.in_window(sx, sy) {
                    return PlanePixel::default();
                }
                let plane_b = plane == VdpPlane::B;
                let (cells_w, cells_h) = self.plane_size();
                let (pw, ph) = (cells_w as i32 * 8, cells_h as i32 * 8);
                let px = (sx as i32 - self.hscroll(plane_b, sy)).rem_euclid(pw) as usize;
                let py = (sy as i32 + self.vscroll(plane_b, sx)).rem_euclid(ph) as usize;
                let base = if plane_b {
                    self.plane_b_base()
                } else {
                    self.plane_a_base()
                };
                (base, cells_w, px, py)
            }
        };
        let entry = self.vword(base + ((py / 8) * cells_w + px / 8) * 2);
        let (mut tx, mut ty) = (px % 8, py % 8);
        if entry & 0x0800 != 0 {
            tx = 7 - tx;
        }
        if entry & 0x1000 != 0 {
            ty = 7 - ty;
        }
        PlanePixel {
            index: self.tile_pixel((entry & 0x7FF) as usize, tx, ty),
            palette: ((entry >> 13) & 3) as usize,
            high: entry & 0x8000 != 0,
        }
    }

    /// Camada de um plano filtrada por prioridade e, opcionalmente, por linha de paleta.
    /// Pixels fora do filtro ficam transparentes; a tela e a soma das camadas.
    pub fn render_plane_layer(
        &self,
        plane: VdpPlane,
        high: bool,
        palette: Option<usize>,
    ) -> RgbaImage {
        let (w, h) = (self.screen_width(), self.screen_height());
        let mut image = RgbaImage::new(w, h);
        for sy in 0..h as usize {
            for sx in 0..w as usize {
                let pixel = self.plane_pixel(plane, sx, sy);
                if pixel.index != 0
                    && pixel.high == high
                    && palette.is_none_or(|p| p == pixel.palette)
                {
                    let color = self.color(pixel.palette * 16 + pixel.index);
                    image.put_pixel(sx as u32, sy as u32, color);
                }
            }
        }
        image
    }

    /// Linhas de paleta com pixels visiveis numa camada de plano.
    pub fn plane_layer_palettes(&self, plane: VdpPlane, high: bool) -> Vec<usize> {
        let mut seen = [false; 4];
        for sy in 0..self.screen_height() as usize {
            for sx in 0..self.screen_width() as usize {
                let pixel = self.plane_pixel(plane, sx, sy);
                if pixel.index != 0 && pixel.high == high {
                    seen[pixel.palette] = true;
                }
            }
        }
        (0..4).filter(|p| seen[*p]).collect()
    }

    /// Plano (A ou B) como aparece na tela, com scroll; pixels de cor 0 transparentes.
    #[cfg(test)]
    pub fn render_plane(&self, plane_b: bool) -> RgbaImage {
        let plane = if plane_b { VdpPlane::B } else { VdpPlane::A };
        let mut image = self.render_plane_layer(plane, false, None);
        image::imageops::overlay(
            &mut image,
            &self.render_plane_layer(plane, true, None),
            0,
            0,
        );
        image
    }

    /// Sprites na ordem da cadeia de links (indice 0 primeiro = mais a frente).
    pub fn sprites(&self) -> Vec<VdpSprite> {
        let mut sprites = Vec::new();
        let mut index = 0usize;
        let mut seen = [false; 80];
        let max = if self.screen_width() == 320 { 80 } else { 64 };
        while index < max && !seen[index] {
            seen[index] = true;
            let at = self.sat_base() + index * 8;
            let size = self.vram[(at + 2) & 0xFFFF];
            let attr = self.vword(at + 4);
            let sprite = VdpSprite {
                slot: index,
                x: (self.vword(at + 6) & 0x1FF) as i32 - 128,
                y: (self.vword(at) & 0x3FF) as i32 - 128,
                cells_w: ((size >> 2) & 3) as usize + 1,
                cells_h: (size & 3) as usize + 1,
                tile: (attr & 0x7FF) as usize,
                palette: ((attr >> 13) & 3) as usize,
                hflip: attr & 0x0800 != 0,
                vflip: attr & 0x1000 != 0,
                high: attr & 0x8000 != 0,
            };
            sprites.push(sprite);
            let link = (self.vram[(at + 3) & 0xFFFF] & 0x7F) as usize;
            if link == 0 {
                break;
            }
            index = link;
        }
        sprites
    }

    pub fn render_sprite(&self, sprite: &VdpSprite) -> RgbaImage {
        let (w, h) = (sprite.cells_w * 8, sprite.cells_h * 8);
        let mut image = RgbaImage::new(w as u32, h as u32);
        for y in 0..h {
            for x in 0..w {
                let sx = if sprite.hflip { w - 1 - x } else { x };
                let sy = if sprite.vflip { h - 1 - y } else { y };
                // Tiles de sprite sao dispostos coluna a coluna.
                let tile = sprite.tile + (sx / 8) * sprite.cells_h + sy / 8;
                let index = self.tile_pixel(tile, sx % 8, sy % 8);
                if index != 0 {
                    image.put_pixel(x as u32, y as u32, self.color(sprite.palette * 16 + index));
                }
            }
        }
        image
    }

    /// Tela composta na ordem de prioridade do VDP: backdrop, B/A/Window baixos, sprites
    /// baixos, B/A/Window altos, sprites altos (sombra/realce nao modelados).
    #[cfg(test)]
    pub fn compose_screen(&self) -> RgbaImage {
        let (w, h) = (self.screen_width(), self.screen_height());
        let mut screen = RgbaImage::from_pixel(w, h, self.backdrop());
        let sprites = self.sprites();
        for high in [false, true] {
            for plane in [VdpPlane::B, VdpPlane::A, VdpPlane::Window] {
                image::imageops::overlay(
                    &mut screen,
                    &self.render_plane_layer(plane, high, None),
                    0,
                    0,
                );
            }
            for sprite in sprites.iter().rev().filter(|s| s.high == high) {
                image::imageops::overlay(
                    &mut screen,
                    &self.render_sprite(sprite),
                    sprite.x as i64,
                    sprite.y as i64,
                );
            }
        }
        screen
    }

    /// Bytes de VRAM com dados (blocos de 32 bytes com algum byte diferente de zero).
    pub fn vram_used_bytes(&self) -> u32 {
        self.vram
            .chunks(32)
            .filter(|tile| tile.iter().any(|byte| *byte != 0))
            .count() as u32
            * 32
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VdpSprite {
    pub slot: usize,
    pub x: i32,
    pub y: i32,
    pub cells_w: usize,
    pub cells_h: usize,
    pub tile: usize,
    pub palette: usize,
    pub hflip: bool,
    pub vflip: bool,
    pub high: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VdpPlane {
    A,
    B,
    Window,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PlanePixel {
    pub index: usize,
    pub palette: usize,
    pub high: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Savestate sintetico no layout GPGX 1.7 com um tile, um plano e um sprite.
    fn synthetic_state() -> (Vec<u8>, Vec<u8>) {
        let mut state = vec![0u8; VDP_OFFSET + SAT_CACHE + VRAM_SIZE + 0x120 + 64];
        state[..16].copy_from_slice(b"GENPLUS-GX 1.7.6");
        let wram: Vec<u8> = (0..WRAM_SIZE).map(|i| (i % 251) as u8).collect();
        state[WRAM_OFFSET..WRAM_OFFSET + WRAM_SIZE].copy_from_slice(&wram);
        let mut vram = vec![0u8; VRAM_SIZE];
        // Tile 1: pixel (0,0) cor 1, pixel (1,0) cor 2.
        vram[32] = 0x12;
        // Plano A em 0xE000, celula (0,0) -> tile 1, paleta 1, hflip.
        vram[0xE000] = 0x28;
        vram[0xE001] = 0x01;
        // SAT em 0xF400: sprite 0 em (130,140) 1x1 celula, tile 1, link 0.
        let sat = [0x00, 140, 0x00, 0x00, 0x00, 0x01, 0x00, 130];
        vram[0xF400..0xF408].copy_from_slice(&sat);
        let vram_at = VDP_OFFSET + SAT_CACHE;
        for (i, pair) in vram.chunks(2).enumerate() {
            state[vram_at + i * 2] = pair[1];
            state[vram_at + i * 2 + 1] = pair[0];
        }
        let cram_at = vram_at + VRAM_SIZE;
        state[cram_at + 2] = 0x07; // cor 1: vermelho maximo
        state[cram_at + 34] = 0x38; // paleta 1, cor 1: verde maximo
        let regs_at = cram_at + 0x100;
        let regs = [
            0x04, 0x74, 0x38, 0x34, 0x06, 0x7A, 0, 0, 0, 0, 0, 0, 0x81, 0x3C, 0, 0x02, 0x01,
        ];
        state[regs_at..regs_at + regs.len()].copy_from_slice(&regs);
        (state, wram)
    }

    #[test]
    fn parses_gpgx_layout_and_recomposes_plane_and_sprite() {
        let (state, wram) = synthetic_state();
        let snapshot = parse_gpgx_state(&state, &wram).expect("parse");
        assert_eq!(snapshot.plane_a_base(), 0xE000);
        assert_eq!(snapshot.plane_b_base(), 0xC000);
        assert_eq!(snapshot.sat_base(), 0xF400);
        assert_eq!(snapshot.plane_size(), (64, 32));
        assert_eq!(
            (snapshot.screen_width(), snapshot.screen_height()),
            (320, 224)
        );

        let plane = snapshot.render_plane(false);
        // hflip: pixel (7,0) recebe o pixel 0 do tile (cor 1 da paleta 1 = verde).
        assert_eq!(*plane.get_pixel(7, 0), Rgba([0, 238, 0, 255]));
        assert_eq!(plane.get_pixel(0, 0)[3], 0, "cor 0 e transparente");

        let sprites = snapshot.sprites();
        assert_eq!(sprites.len(), 1);
        assert_eq!((sprites[0].x, sprites[0].y), (2, 12));
        let image = snapshot.render_sprite(&sprites[0]);
        assert_eq!(*image.get_pixel(0, 0), Rgba([238, 0, 0, 255]));
        assert_eq!(snapshot.vram_used_bytes(), 32 * 3);
    }

    /// Recompoe a tela de um savestate real (`RDS_PROBE_OUT` com state.bin e wram.bin).
    #[test]
    #[ignore]
    fn compose_real_state_dump() {
        let dir = std::env::var("RDS_PROBE_OUT").expect("dir");
        let state = std::fs::read(format!("{dir}/state.bin")).unwrap();
        let wram = std::fs::read(format!("{dir}/wram.bin")).unwrap();
        let snapshot = parse_gpgx_state(&state, &wram).expect("parse real");
        let composed = snapshot.compose_screen();
        composed.save(format!("{dir}/compose.png")).unwrap();
        // Fidelidade contra o framebuffer do proprio core, quando a sonda o gravou.
        if let Ok(frame) = image::open(format!("{dir}/framebuffer.png")) {
            let frame = frame.to_rgba8();
            let worst = composed
                .pixels()
                .zip(frame.pixels())
                .map(|(a, b)| (0..3).map(|c| a[c].abs_diff(b[c])).max().unwrap())
                .max()
                .unwrap();
            println!("VDP max_channel_diff={worst}");
            assert!(worst <= 8, "recomposicao diverge do framebuffer");
        }
        println!(
            "VDP sprites={} vram_used={} planeA={:#x} planeB={:#x}",
            snapshot.sprites().len(),
            snapshot.vram_used_bytes(),
            snapshot.plane_a_base(),
            snapshot.plane_b_base()
        );
    }

    #[test]
    fn refuses_unknown_layout_instead_of_guessing() {
        let (mut state, wram) = synthetic_state();
        let mut other = wram.clone();
        other[0] ^= 0xFF;
        assert!(parse_gpgx_state(&state, &other)
            .unwrap_err()
            .contains("WRAM"));
        state[..16].copy_from_slice(b"GENPLUS-GX 1.6.0");
        assert!(parse_gpgx_state(&state, &wram).is_err());
    }
}
