//! Clipboard/drop adapter for Photo2SGDK. Conversion reuses its transparency,
//! quantization and PNG preview functions; publishing uses the PixelEditor writer.
use super::*;
use image::ImageDecoder;
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read};
use std::net::{IpAddr, ToSocketAddrs};
use std::time::Duration;

const MAX_BYTES: u64 = 20 * 1024 * 1024;
const MAX_PIXELS: u64 = 64 * 1024 * 1024;
const MAX_FRAMES: usize = 256;

#[derive(Deserialize)]
pub struct ArtInput {
    pub name: Option<String>,
    pub bytes: Option<Vec<u8>>,
    pub path: Option<String>,
    pub url: Option<String>,
}

#[derive(Serialize)]
pub struct PreparedArt {
    source_relative: String,
    name: String,
    source_width: u32,
    source_height: u32,
    frame_count: usize,
    preview_base64: String,
    suggested_role: String,
    background_mode: String,
    warnings: Vec<String>,
    /// Native PixelEditor document, with ALL GIF frames and their original delays.
    doc_json: Option<String>,
}

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => {
            !v.is_private()
                && !v.is_loopback()
                && !v.is_link_local()
                && !v.is_broadcast()
                && !v.is_unspecified()
                && !v.is_multicast()
                && v.octets()[0] != 0
                && v.octets()[0] < 224
                && !(v.octets()[0] == 100 && v.octets()[1] & 0xc0 == 0x40)
        }
        IpAddr::V6(v) => v
            .to_ipv4_mapped()
            .map(|v| public_ip(IpAddr::V4(v)))
            .unwrap_or(
                !v.is_loopback()
                    && !v.is_unspecified()
                    && !v.is_multicast()
                    && v.segments()[0] & 0xfe00 != 0xfc00
                    && v.segments()[0] & 0xffc0 != 0xfe80,
            ),
    }
}

fn fetch_image(url: &str) -> Result<Vec<u8>, String> {
    let mut url = reqwest::Url::parse(url).map_err(|_| "Endereço de imagem inválido.")?;
    for _ in 0..4 {
        if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
            return Err("Use uma imagem HTTPS pública ou solte o arquivo local.".into());
        }
        let host = url.host_str().ok_or("Endereço sem servidor.")?.to_string();
        let addresses: Vec<_> = (host.as_str(), url.port_or_known_default().unwrap_or(443))
            .to_socket_addrs()
            .map_err(|_| "Não foi possível localizar o servidor da imagem.")?
            .collect();
        if addresses.is_empty() || addresses.iter().any(|a| !public_ip(a.ip())) {
            return Err("O endereço não é uma imagem pública. Solte o arquivo local.".into());
        }
        // Pin the validated DNS answers. Redirects are checked again, without
        // credentials, cookies, proxy inheritance or forwarding sensitive headers.
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(8))
            .resolve_to_addrs(&host, &addresses)
            .user_agent("RetroDevStudio-image-import/0.1")
            .build()
            .map_err(|e| e.to_string())?;
        let response = client.get(url.clone()).send().map_err(|_| {
            "Não foi possível obter a imagem. Copie a imagem ou solte o arquivo local."
        })?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|h| h.to_str().ok())
                .ok_or("Redirecionamento de imagem inválido.")?;
            url = url
                .join(location)
                .map_err(|_| "Redirecionamento inválido.")?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!(
                "O servidor recusou a imagem ({}). Solte o arquivo local.",
                response.status()
            ));
        }
        if response.content_length().is_some_and(|n| n > MAX_BYTES) {
            return Err("A imagem excede 20 MB.".into());
        }
        let mut bytes = Vec::new();
        response
            .take(MAX_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("A imagem excede 20 MB.".into());
        }
        return Ok(bytes);
    }
    Err("O endereço redirecionou muitas vezes. Solte o arquivo local.".into())
}

fn decode_frames(bytes: &[u8]) -> Result<(Vec<RgbaImage>, Vec<u32>, ImageFormat), String> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_BYTES {
        return Err("Imagem vazia ou maior que 20 MB.".into());
    }
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let format = reader
        .format()
        .ok_or("Formato de imagem não reconhecido.")?;
    let (w, h) = reader
        .into_dimensions()
        .map_err(|e| format!("Imagem ilegível: {e}"))?;
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > MAX_PIXELS {
        return Err("A imagem excede o limite de 64 MP.".into());
    }
    let animated = match format {
        ImageFormat::Gif => {
            let mut decoder = GifDecoder::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
            decoder
                .set_limits(image::Limits::default())
                .map_err(|e| e.to_string())?;
            Some(decoder.into_frames())
        }
        ImageFormat::Png => {
            let decoder = image::codecs::png::PngDecoder::new(Cursor::new(bytes))
                .map_err(|e| e.to_string())?;
            if decoder.is_apng().map_err(|e| e.to_string())? {
                Some(decoder.apng().map_err(|e| e.to_string())?.into_frames())
            } else {
                None
            }
        }
        ImageFormat::WebP => {
            let decoder = image::codecs::webp::WebPDecoder::new(Cursor::new(bytes))
                .map_err(|e| e.to_string())?;
            if decoder.has_animation() {
                Some(decoder.into_frames())
            } else {
                None
            }
        }
        _ => None,
    };
    if let Some(animation) = animated {
        let mut frames = Vec::new();
        let mut delays = Vec::new();
        for frame in animation {
            if frames.len() >= MAX_FRAMES
                || (frames.len() as u64 + 1) * u64::from(w) * u64::from(h) > MAX_PIXELS
            {
                return Err(
                    "A animação excede 256 quadros ou 64 MP somados. Nenhum quadro foi descartado."
                        .into(),
                );
            }
            let frame = frame.map_err(|e| format!("Animação corrompida: {e}"))?;
            let (n, d) = frame.delay().numer_denom_ms();
            delays.push(if n == 0 {
                100
            } else {
                ((n as f64 / d.max(1) as f64).round() as u32).max(1)
            });
            frames.push(frame.into_buffer());
        }
        if frames.is_empty() {
            return Err("GIF sem quadros.".into());
        }
        Ok((frames, delays, format))
    } else {
        let image = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|e| e.to_string())?
            .decode()
            .map_err(|e| format!("Imagem corrompida ou incompatível: {e}"))?
            .into_rgba8();
        Ok((vec![image], vec![100], format))
    }
}

fn no_background(image: &RgbaImage) -> TransparencyAnalysis {
    let mask: Vec<_> = image
        .pixels()
        .map(|p| p[3] < ALPHA_TRANSPARENT_THRESHOLD)
        .collect();
    let transparent_pixels = mask.iter().filter(|p| **p).count();
    TransparencyAnalysis {
        mask,
        transparent_pixels,
        mode: BackgroundMode::Alpha,
    }
}

#[cfg(test)]
fn convert_frames(
    frames: &[RgbaImage],
    delays: &[u32],
    name: &str,
    role: &str,
    background: &str,
) -> Result<(String, String, String, Vec<String>), String> {
    convert_frames_with_method(frames, delays, name, role, background, "balanced")
}

fn convert_frames_with_method(
    frames: &[RgbaImage],
    delays: &[u32],
    name: &str,
    role: &str,
    background: &str,
    method: &str,
) -> Result<(String, String, String, Vec<String>), String> {
    if !["balanced", "dominant", "floyd"].contains(&method) {
        return Err("Método de conversão desconhecido. Escolha Agrupamento, Contornos limpos ou Gradientes.".into());
    }
    if role != "sprite" && role != "background" {
        return Err("Escolha cenário ou personagem/objeto.".into());
    }
    if role == "background" && frames.len() > 1 {
        return Err(
            "Esta animação possui vários quadros. Use Personagem/objeto para preservar todos."
                .into(),
        );
    }
    let first = frames.first().ok_or("A imagem não contém quadros.")?;
    if delays.len() != frames.len()
        || frames
            .iter()
            .any(|frame| frame.dimensions() != first.dimensions())
    {
        return Err(
            "A animação contém medidas ou tempos incompletos. O original foi preservado.".into(),
        );
    }
    let analyses: Vec<_> = frames
        .iter()
        .map(|frame| {
            if role == "sprite" && background != "keep" {
                detect_transparency(frame)
            } else {
                no_background(frame)
            }
        })
        .collect();
    // Trim one COMMON transparent rectangle, never recenter individual frames:
    // the animation's feet, effects and frame-to-frame offsets stay aligned.
    let trim = role == "sprite"
        && frames.len() > 1
        && frames
            .iter()
            .any(|f| f.pixels().any(|p| p[3] < ALPHA_TRANSPARENT_THRESHOLD));
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (first.width(), first.height(), 0, 0);
    if trim {
        for (frame, analysis) in frames.iter().zip(&analyses) {
            let masked = analysis.transparent_pixels < analysis.mask.len();
            for (x, y, p) in frame.enumerate_pixels() {
                if p[3] >= ALPHA_TRANSPARENT_THRESHOLD
                    && (!masked || !analysis.mask[(y * frame.width() + x) as usize])
                {
                    min_x = min_x.min(x);
                    min_y = min_y.min(y);
                    max_x = max_x.max(x + 1);
                    max_y = max_y.max(y + 1);
                }
            }
        }
    }
    let (crop_x, crop_y, crop_w, crop_h) = if trim && max_x > min_x && max_y > min_y {
        (min_x, min_y, max_x - min_x, max_y - min_y)
    } else {
        (0, 0, first.width(), first.height())
    };
    let scale = if role == "sprite" {
        (64.0 / crop_w.max(crop_h) as f64).min(1.0)
    } else {
        (320.0 / crop_w as f64).min(224.0 / crop_h as f64).min(1.0)
    };
    let w = ((crop_w as f64 * scale).round() as u32).max(1);
    let h = ((crop_h as f64 * scale).round() as u32).max(1);
    let (fw, fh) = (align_up(w, 8), align_up(h, 8));
    // Preserve GIF canvas positions and quantize one palette over ALL frames.
    let mut strip = RgbaImage::new(fw * frames.len() as u32, fh);
    let mut removed = 0;
    for (i, frame) in frames.iter().enumerate() {
        let analysis = &analyses[i];
        let mut rgba = frame.clone();
        // Reject a background guess that would erase the entire object.
        if analysis.transparent_pixels < analysis.mask.len() {
            for (p, clear) in rgba.pixels_mut().zip(&analysis.mask) {
                if *clear {
                    *p = Rgba([0, 0, 0, 0]);
                    removed += 1;
                }
            }
        }
        // Only the pixel-art threshold matters. Stop after 65 colors rather
        // than allocating a set proportional to a large photograph.
        let mut distinct = std::collections::HashSet::new();
        let pixel_art = rgba.pixels().filter(|p| p[3] >= 128).all(|p| {
            distinct.insert([p[0], p[1], p[2]]);
            distinct.len() <= 64
        });
        let filter = if pixel_art {
            image::imageops::FilterType::Nearest
        } else {
            image::imageops::FilterType::Lanczos3
        };
        let cropped = image::imageops::crop_imm(&rgba, crop_x, crop_y, crop_w, crop_h).to_image();
        let resized = image::imageops::resize(&cropped, w, h, filter);
        image::imageops::overlay(&mut strip, &resized, (i as u32 * fw) as i64, 0);
    }
    let transparency = no_background(&strip);
    let palette = build_palette_with_method(&strip, &transparency, method == "dominant");
    if palette.is_empty() {
        return Err("A imagem não contém pixels visíveis. O original foi preservado.".into());
    }
    let preview = if method == "floyd" {
        render_floyd_preview(&strip, &transparency, &palette, fw)
    } else {
        render_quantized_preview(&strip, &transparency, &palette)
    };
    let colors: Vec<_> = std::iter::once(vec![7, 0, 7])
        .chain(palette.iter().map(|c| {
            vec![
                ((c.r as u32 * 7 + 127) / 255) as u8,
                ((c.g as u32 * 7 + 127) / 255) as u8,
                ((c.b as u32 * 7 + 127) / 255) as u8,
            ]
        }))
        .collect();
    let mut colors = colors;
    colors.resize(16, vec![0, 0, 0]);
    let docs: Vec<_> = frames.iter().enumerate().map(|(i, _)| {
        let mut pixels = vec![0u8; (fw * fh) as usize];
        for y in 0..fh { for x in 0..fw {
            let p = preview.get_pixel(i as u32 * fw+x,y);
            if p[3] >= 128 { pixels[(y*fw+x) as usize] = palette.iter().position(|c| c.r==p[0]&&c.g==p[1]&&c.b==p[2]).unwrap_or(0) as u8+1; }
        }}
        serde_json::json!({"id":format!("frame_{i}"),"durationMs":delays[i],"cels":[BASE64.encode(pixels)]})
    }).collect();
    let mut empty_colors = vec![vec![0, 0, 0]; 16];
    empty_colors[0] = vec![7, 0, 7];
    let doc = serde_json::json!({"schema":"retrodev.pixel/v1","name":name,"conversionMethod":method,"paletteLines":[0],"width":fw,"height":fh,"target":if role=="sprite" {"sprite"} else {"plane"},"palettes":[colors,empty_colors,empty_colors,empty_colors],"layers":[{"id":"art","name":"Imagem","visible":true}],"frames":docs});
    let mut warnings = Vec::new();
    if (crop_w, crop_h) != first.dimensions() {
        warnings.push(format!("Margens transparentes retiradas de todos os quadros com o mesmo recorte ({crop_w}×{crop_h}). Posições e tempos da animação preservados."));
    }
    if scale < 1.0 {
        warnings.push(format!(
            "{}×{} → {}×{} px; original preservado.",
            first.width(),
            first.height(),
            w,
            h
        ));
    }
    warnings.push("Cores adaptadas à paleta do Mega Drive (15 + transparência).".into());
    Ok((
        doc.to_string(),
        encode_preview_png(&preview)?,
        if removed > 0 { "automatic" } else { "alpha" }.into(),
        warnings,
    ))
}

fn ingest(
    project_root: &Path,
    input: ArtInput,
    role: Option<String>,
    background: Option<String>,
) -> Result<PreparedArt, String> {
    ingest_with_method(project_root, input, role, background, "balanced")
}

fn ingest_with_method(
    project_root: &Path,
    input: ArtInput,
    role: Option<String>,
    background: Option<String>,
    method: &str,
) -> Result<PreparedArt, String> {
    let root = project_root.canonicalize().map_err(|e| e.to_string())?;
    if !root.join("project.rds").is_file() {
        return Err("Abra um projeto para adicionar imagens.".into());
    }
    let provided = usize::from(input.bytes.is_some())
        + usize::from(input.path.is_some())
        + usize::from(input.url.is_some());
    if provided != 1 {
        return Err("Forneça uma única origem de imagem.".into());
    }
    let bytes = if let Some(bytes) = input.bytes {
        bytes
    } else if let Some(path) = input.path {
        let f = File::open(path).map_err(|e| format!("Não foi possível abrir a imagem: {e}"))?;
        if !f.metadata().map_err(|e| e.to_string())?.is_file() {
            return Err("Solte um arquivo de imagem.".into());
        }
        let mut bytes = Vec::new();
        f.take(MAX_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        bytes
    } else {
        fetch_image(input.url.as_deref().unwrap_or_default())?
    };
    let (frames, delays, format) = decode_frames(&bytes)?;
    let digest = crate::core::rom_mastering::sha256_hex(&bytes);
    let state_dir = root.join(".rds");
    if state_dir.exists()
        && !state_dir
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(&root)
    {
        return Err("A pasta de originais aponta para fora do projeto.".into());
    }
    fs::create_dir_all(&state_dir).map_err(|e| e.to_string())?;
    let dir = state_dir.join("art-sources");
    if dir.exists()
        && !dir
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(&root)
    {
        return Err("A pasta de originais aponta para fora do projeto.".into());
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if !dir
        .canonicalize()
        .map_err(|e| e.to_string())?
        .starts_with(&root)
    {
        return Err("A pasta de originais aponta para fora do projeto.".into());
    }
    let extension = format.extensions_str().first().copied().unwrap_or("img");
    let source_relative = format!(".rds/art-sources/{digest}.{extension}");
    let source = root.join(&source_relative);
    if source.exists() {
        if source.is_symlink() || fs::read(&source).map_err(|e| e.to_string())? != bytes {
            return Err("A cópia do original não confere; preserve o arquivo existente.".into());
        }
    } else {
        crate::core::project_mgr::write_bytes_atomically_with_retry(&source, &bytes)
            .map_err(|e| e.to_string())?;
    }
    let name = sanitize_sprite_name(input.name.as_deref().unwrap_or("imagem_colada"))
        .chars()
        .take(96)
        .collect::<String>();
    let first = &frames[0];
    let analysis = detect_transparency(first);
    let hint = if frames.len() > 1
        || analysis.transparent_pixels > 0 && first.width() <= 256 && first.height() <= 256
    {
        "sprite"
    } else {
        "background"
    };
    let (doc_json, preview_base64, background_mode, warnings) = if let Some(role) = role {
        let (doc, png, mode, warnings) = convert_frames_with_method(
            &frames,
            &delays,
            &name,
            &role,
            background.as_deref().unwrap_or("auto"),
            method,
        )?;
        let mut document: serde_json::Value =
            serde_json::from_str(&doc).map_err(|e| e.to_string())?;
        document["originalSource"] = source_relative.clone().into();
        (Some(document.to_string()), png, mode, warnings)
    } else {
        let thumb = image::imageops::thumbnail(first, 320, 224);
        (
            None,
            encode_preview_png(&thumb)?,
            analysis.mode.label().into(),
            vec![],
        )
    };
    Ok(PreparedArt {
        source_relative,
        name,
        source_width: first.width(),
        source_height: first.height(),
        frame_count: frames.len(),
        preview_base64,
        suggested_role: hint.into(),
        background_mode,
        warnings,
        doc_json,
    })
}

#[tauri::command]
pub async fn art_ingest_input(
    project_root: String,
    input: ArtInput,
    role: Option<String>,
    background: Option<String>,
    conversion: Option<String>,
) -> Result<PreparedArt, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ingest_with_method(
            Path::new(&project_root),
            input,
            role,
            background,
            conversion.as_deref().unwrap_or("balanced"),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

fn clipboard_png(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let pixels = u64::from(width) * u64::from(height);
    if pixels == 0 || pixels > MAX_PIXELS || rgba.len() as u64 != pixels * 4 {
        return Err("A imagem copiada excede 64 MP ou possui dados incompletos.".into());
    }
    struct LimitedPng(Vec<u8>);
    impl std::io::Write for LimitedPng {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            if self.0.len() as u64 + bytes.len() as u64 > MAX_BYTES {
                return Err(std::io::Error::other("A imagem copiada excede 20 MB."));
            }
            self.0.extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut png = LimitedPng(Vec::new());
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(rgba, width, height, image::ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    Ok(png.0)
}

#[derive(Serialize)]
pub struct NativeClipboardCapture {
    image: Option<PreparedArt>,
    html: Option<String>,
}

#[tauri::command]
pub async fn art_ingest_clipboard(project_root: String) -> Result<NativeClipboardCapture, String> {
    tauri::async_runtime::spawn_blocking(move || {
        static READ_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _reading=READ_LOCK.try_lock().map_err(|_|"Já estamos lendo a imagem copiada. Aguarde e cole novamente.".to_string())?;
        if !Path::new(&project_root).join("project.rds").is_file(){return Err("Abra um projeto antes de colar uma imagem.".into());}
        let mut clipboard=arboard::Clipboard::new().map_err(|e|format!("A área de transferência está indisponível: {e}"))?;
        // The native provider is also used by Tauri's clipboard plugin. Read its
        // HTML representation as well: browsers flatten GIF pixels but retain
        // the original image URL there. Never write, poll or execute clipboard content.
        let html=match clipboard.get().html() {
            Ok(html) if html.len()<=256*1024 => Some(html),
            Ok(_) => return Err("Os dados copiados excedem 256 KB de informações de origem. Solte o arquivo da imagem.".into()),
            Err(arboard::Error::ContentNotAvailable|arboard::Error::ClipboardNotSupported)=>None,
            Err(e)=>return Err(format!("Não foi possível ler a origem da imagem: {e}")),
        };
        let image=match clipboard.get_image() {
            Ok(image)=>image,
            Err(arboard::Error::ContentNotAvailable)=>return Ok(NativeClipboardCapture{image:None,html}),
            Err(e)=>return Err(format!("Não foi possível ler a imagem copiada: {e}. Solte o arquivo ou use Imagem.")),
        };
        let width=u32::try_from(image.width).map_err(|_|"Imagem copiada muito larga.")?;
        let height=u32::try_from(image.height).map_err(|_|"Imagem copiada muito alta.")?;
        let bytes=clipboard_png(&image.bytes,width,height)?;
        let image=ingest(Path::new(&project_root),ArtInput{name:Some("imagem_colada".into()),bytes:Some(bytes),path:None,url:None},None,None)?;
        Ok(NativeClipboardCapture{image:Some(image),html})
    }).await.map_err(|e|e.to_string())?
}

/// Project the native document into the existing asset catalog. The wire field
/// `sgdk_resource` is retained for compatibility; `pixel_document` identifies its
/// native source. PNG geometry must agree with the document before reuse.
pub fn pixel_asset_authoring(
    root: &Path,
    relative: &str,
    image_width: Option<u32>,
    image_height: Option<u32>,
) -> Option<crate::core::project_mgr::SgdkAssetAuthoring> {
    if !(relative.starts_with("assets/sprites/pixel/")
        || relative.starts_with("assets/tilesets/pixel/"))
        || !relative.ends_with(".png")
        || relative.contains("..")
    {
        return None;
    }
    let doc_relative = relative.strip_suffix(".png")?.to_owned() + ".rdspixel.json";
    let file = root.join(&doc_relative);
    let mut result = crate::core::project_mgr::SgdkAssetAuthoring {
        resource_name: Path::new(relative)
            .file_stem()?
            .to_string_lossy()
            .into_owned(),
        resource_kind: "SPRITE".into(),
        sprite: None,
        pixel_document: Some(doc_relative),
        variants: vec![],
    };
    let read_document = || -> Option<serde_json::Value> {
        let canonical_root = root.canonicalize().ok()?;
        if !file.is_file()
            || !file.canonicalize().ok()?.starts_with(&canonical_root)
            || file.metadata().ok()?.len() > MAX_BYTES
        {
            return None;
        }
        serde_json::from_slice(&fs::read(&file).ok()?).ok()
    };
    let Some(document) = read_document() else {
        return Some(result);
    };
    let name = document["name"].as_str().unwrap_or("imagem");
    let name = name
        .rsplit_once('_')
        .filter(|(_, suffix)| suffix.len() == 32 && suffix.bytes().all(|c| c.is_ascii_hexdigit()))
        .map(|(prefix, _)| prefix)
        .unwrap_or(name);
    let plane = document["target"] == "plane";
    result.resource_name = name.to_owned();
    let layout = || -> Option<crate::ugdm::components::SpriteComponent> {
        if document["schema"] != "retrodev.pixel/v1" || !(plane || document["target"] == "sprite") {
            return None;
        }
        let width = u32::try_from(document["width"].as_u64()?).ok()?;
        let height = u32::try_from(document["height"].as_u64()?).ok()?;
        let frames = document["frames"].as_array()?;
        if frames.is_empty()
            || frames.len() > 255
            || width == 0
            || height == 0
            || width % 8 != 0
            || height % 8 != 0
            || image_width != width.checked_mul(frames.len() as u32)
            || image_height != Some(height)
        {
            return None;
        }
        if plane && (frames.len() != 1 || width > 320 || height > 224)
            || !plane && (width > 64 || height > 64)
        {
            return None;
        }
        let mut indices = Vec::new();
        let mut durations = Vec::new();
        for (index, frame) in frames.iter().enumerate() {
            let ms = frame["durationMs"].as_u64()?;
            if ms == 0 || ms > 600_000 {
                return None;
            }
            let mut ticks = ((ms * 60 + 500) / 1000).max(1);
            while ticks > 0 {
                indices.push(index);
                durations.push(ticks.min(255));
                ticks = ticks.saturating_sub(255);
                if indices.len() > 255 {
                    return None;
                }
            }
        }
        serde_json::from_value(serde_json::json!({"asset":relative,"frame_width":width,"frame_height":height,"meta_sprite":width>32||height>32,"palette_slot":0,"priority":"foreground","animations":{"idle":{"frames":indices,"fps":10,"loop":true,"frame_durations":durations}}})).ok()
    };
    let sprite = layout();
    if plane && sprite.is_some() {
        result.resource_kind = "IMAGE".into();
    } else if !plane {
        result.sprite = sprite;
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ingress_conversion_choices_preserve_alpha_timing_and_frame_boundaries() {
        let mut picture = RgbaImage::from_fn(16, 16, |x, y| {
            Rgba([(x * 17) as u8, (y * 17) as u8, ((x + y) * 8) as u8, 255])
        });
        picture.put_pixel(15, 15, Rgba([0, 0, 0, 0]));
        for method in ["balanced", "dominant", "floyd"] {
            let frames = [picture.clone(), picture.clone()];
            let first = convert_frames_with_method(
                &frames,
                &[100, 250],
                "conversion",
                "sprite",
                "keep",
                method,
            )
            .unwrap();
            assert_eq!(
                first,
                convert_frames_with_method(
                    &frames,
                    &[100, 250],
                    "conversion",
                    "sprite",
                    "keep",
                    method
                )
                .unwrap()
            );
            let doc: serde_json::Value = serde_json::from_str(&first.0).unwrap();
            assert_eq!(doc["conversionMethod"], method);
            assert_eq!(doc["frames"].as_array().unwrap().len(), 2);
            assert_eq!(doc["frames"][1]["durationMs"], 250);
            assert_eq!(
                doc["frames"][0]["cels"], doc["frames"][1]["cels"],
                "error diffusion must restart per frame"
            );
            let pixels = BASE64
                .decode(doc["frames"][0]["cels"][0].as_str().unwrap())
                .unwrap();
            assert!(pixels[0] > 0, "opaque black must remain visible");
            assert_eq!(pixels[255], 0);
            assert!(pixels.iter().all(|p| *p < 16));
            let preview = image::load_from_memory(&BASE64.decode(first.1).unwrap())
                .unwrap()
                .into_rgba8();
            assert_eq!(preview.get_pixel(15, 15)[3], 0);
            assert_eq!(preview.get_pixel(0, 0)[3], 255);
            assert!(doc["palettes"][0].as_array().unwrap().iter().all(|c| c
                .as_array()
                .unwrap()
                .iter()
                .all(|v| v.as_u64().unwrap() <= 7)));
        }
        assert!(
            convert_frames_with_method(&[picture], &[100], "bad", "sprite", "keep", "unknown")
                .is_err()
        );
    }

    #[test]
    #[ignore = "operator-provided private color reference and output directory required"]
    fn ingress_color_reference_quality_report() {
        let source = std::env::var("RDS_COLOR_REFERENCE").expect("RDS_COLOR_REFERENCE");
        let previous = std::env::var("RDS_COLOR_PREVIOUS").expect("RDS_COLOR_PREVIOUS");
        let output = std::env::var("RDS_COLOR_OUTPUT").expect("RDS_COLOR_OUTPUT");
        let (frames, delays, _) = decode_frames(&fs::read(source).unwrap()).unwrap();
        let (doc, preview, _, _) =
            convert_frames(&frames, &delays, "color_reference", "background", "keep").unwrap();
        let converted = image::load_from_memory(&BASE64.decode(preview).unwrap())
            .unwrap()
            .into_rgba8();
        let prior = image::open(previous).unwrap().into_rgba8();
        assert_eq!(converted.dimensions(), prior.dimensions());
        let scale = (320.0 / frames[0].width() as f64)
            .min(224.0 / frames[0].height() as f64)
            .min(1.0);
        let w = (frames[0].width() as f64 * scale).round() as u32;
        let h = (frames[0].height() as f64 * scale).round() as u32;
        let reference =
            image::imageops::resize(&frames[0], w, h, image::imageops::FilterType::Lanczos3);
        let error = |image: &RgbaImage| -> u64 {
            reference
                .enumerate_pixels()
                .map(|(x, y, p)| {
                    (0..3)
                        .map(|c| {
                            let d = i64::from(p[c]) - i64::from(image.get_pixel(x, y)[c]);
                            (d * d) as u64
                        })
                        .sum::<u64>()
                })
                .sum()
        };
        let before = error(&prior);
        let after = error(&converted);
        assert!(
            after < before,
            "color error must improve: before={before},after={after}"
        );
        fs::create_dir_all(&output).unwrap();
        converted
            .save(Path::new(&output).join("converted.png"))
            .unwrap();
        fs::write(Path::new(&output).join("converted.rdspixel.json"), doc).unwrap();
        let report = serde_json::json!({"before_squared_rgb_error":before,"after_squared_rgb_error":after,"reduction_percent":100.0*(before-after) as f64/before as f64,"content_width":w,"content_height":h,"comparison":"same Lanczos resize, opaque content only, fixed MD 15-color budget"});
        fs::write(
            Path::new(&output).join("quality.json"),
            serde_json::to_vec_pretty(&report).unwrap(),
        )
        .unwrap();
        println!("{report}");
    }

    #[test]
    fn ingress_native_catalog_preserves_layout_without_any_scene_and_refuses_stale_documents() {
        let dir = std::env::temp_dir().join(format!(
            "rds-pixel-catalog-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("assets/sprites/pixel")).unwrap();
        let relative = "assets/sprites/pixel/ball.png";
        let (raw, png, _, _) = convert_frames(
            &[
                RgbaImage::from_pixel(16, 16, Rgba([255, 0, 0, 255])),
                RgbaImage::from_pixel(16, 16, Rgba([0, 0, 255, 255])),
            ],
            &[40, 150],
            "ball",
            "sprite",
            "keep",
        )
        .unwrap();
        fs::write(dir.join(relative), BASE64.decode(png).unwrap()).unwrap();
        let document = dir.join("assets/sprites/pixel/ball.rdspixel.json");
        fs::write(&document, &raw).unwrap();
        let catalog = pixel_asset_authoring(&dir, relative, Some(32), Some(16)).unwrap();
        let sprite = catalog.sprite.unwrap();
        assert_eq!(sprite.frame_width, 16);
        assert_eq!(sprite.animations["idle"].frames, vec![0, 1]);
        assert_eq!(sprite.animations["idle"].frame_durations, Some(vec![2, 9]));
        assert!(pixel_asset_authoring(&dir, relative, Some(16), Some(16))
            .unwrap()
            .sprite
            .is_none());
        fs::write(&document, "invalid").unwrap();
        assert!(pixel_asset_authoring(&dir, relative, Some(32), Some(16))
            .unwrap()
            .sprite
            .is_none());
        fs::remove_file(&document).unwrap();
        assert!(pixel_asset_authoring(&dir, relative, Some(32), Some(16))
            .unwrap()
            .sprite
            .is_none());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn ingress_native_clipboard_encoder_preserves_rgba_and_bounds_dimensions() {
        let rgba = [255, 0, 0, 255, 0, 255, 0, 0];
        let png = clipboard_png(&rgba, 2, 1).unwrap();
        assert_eq!(
            image::load_from_memory(&png)
                .unwrap()
                .into_rgba8()
                .into_raw(),
            rgba
        );
        assert!(clipboard_png(&rgba, 100_000, 100_000).is_err());
        assert!(clipboard_png(&rgba, 4, 4).is_err());
    }
    #[test]
    fn ingress_common_rasters_convert_without_requiring_preparation() {
        for format in [
            ImageFormat::Png,
            ImageFormat::Jpeg,
            ImageFormat::Bmp,
            ImageFormat::Pnm,
            ImageFormat::WebP,
        ] {
            let rgb = image::RgbImage::from_pixel(21, 13, image::Rgb([255, 0, 0]));
            let mut buffer = Cursor::new(Vec::new());
            image::DynamicImage::ImageRgb8(rgb)
                .write_to(&mut buffer, format)
                .unwrap();
            let (frames, delays, _) = decode_frames(buffer.get_ref()).unwrap();
            let (raw, png, _, _) =
                convert_frames(&frames, &delays, "photo", "background", "keep").unwrap();
            let doc: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(doc["width"], 24);
            assert_eq!(doc["height"], 16);
            let picture = image::load_from_memory(&BASE64.decode(png).unwrap())
                .unwrap()
                .into_rgba8();
            assert_eq!(picture.get_pixel(10, 6).0, [255, 0, 0, 255]);
        }
    }

    #[test]
    fn ingress_preserves_original_and_repeated_preparation_is_idempotent() {
        let dir = std::env::temp_dir().join(format!(
            "rds-art-ingress-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("project.rds"), "{}").unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(RgbaImage::from_pixel(16, 16, Rgba([255, 0, 0, 255])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let input = || ArtInput {
            name: Some("../an image".into()),
            bytes: Some(bytes.get_ref().clone()),
            path: None,
            url: None,
        };
        let first = ingest(&dir, input(), None, None).unwrap();
        let second = ingest(&dir, input(), Some("sprite".into()), Some("keep".into())).unwrap();
        assert_eq!(first.source_relative, second.source_relative);
        assert_eq!(
            fs::read(dir.join(&second.source_relative)).unwrap(),
            *bytes.get_ref()
        );
        assert_eq!(
            fs::read_dir(dir.join(".rds/art-sources")).unwrap().count(),
            1
        );
        assert!(
            !dir.join("assets").exists(),
            "Preparation must not publish a scene asset"
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn ingress_rejects_animation_overflow_without_returning_a_partial_animation() {
        let mut bytes = Vec::new();
        {
            let mut encoder = image::codecs::gif::GifEncoder::new(&mut bytes);
            for _ in 0..=MAX_FRAMES {
                encoder
                    .encode_frame(image::Frame::new(RgbaImage::from_pixel(
                        1,
                        1,
                        Rgba([255, 0, 0, 255]),
                    )))
                    .unwrap();
            }
        }
        let error = decode_frames(&bytes)
            .err()
            .expect("must refuse rather than truncate");
        assert!(error.contains("256 quadros"));
    }

    #[test]
    #[ignore = "requires operator-supplied GIF and private output directory"]
    fn ingress_operator_gif_report() {
        let input = std::env::var("RDS_OPERATOR_GIF").expect("RDS_OPERATOR_GIF");
        let output = std::path::PathBuf::from(
            std::env::var("RDS_OPERATOR_GIF_OUTPUT").expect("RDS_OPERATOR_GIF_OUTPUT"),
        );
        let bytes = fs::read(input).unwrap();
        let (frames, delays, _) = decode_frames(&bytes).unwrap();
        let (raw, png, _, warnings) =
            convert_frames(&frames, &delays, "operator_gif", "sprite", "auto").unwrap();
        fs::create_dir_all(&output).unwrap();
        for (i, frame) in frames.iter().enumerate() {
            frame
                .save(output.join(format!("decoded-{i:03}.png")))
                .unwrap();
        }
        fs::write(output.join("converted.rdspixel.json"), raw).unwrap();
        fs::write(output.join("converted.png"), BASE64.decode(png).unwrap()).unwrap();
        fs::write(output.join("report.json"), serde_json::to_vec_pretty(&serde_json::json!({"source_sha256":crate::core::rom_mastering::sha256_hex(&bytes),"frames":frames.len(),"delays":delays,"warnings":warnings})).unwrap()).unwrap();
    }

    #[test]
    fn ingress_animated_trim_uses_one_shared_crop_and_one_palette_without_losing_positions() {
        let mut first = RgbaImage::new(80, 40);
        let mut second = first.clone();
        for y in 16..24 {
            for x in 16..24 {
                first.put_pixel(x, y, Rgba([255, 0, 0, 255]));
                second.put_pixel(x + 32, y, Rgba([0, 0, 255, 255]));
            }
        }
        let (raw, _, _, warnings) =
            convert_frames(&[first, second], &[40, 150], "moving", "sprite", "keep").unwrap();
        let doc: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(doc["width"], 40);
        assert_eq!(doc["height"], 8);
        assert_eq!(doc["frames"][0]["durationMs"], 40);
        assert_eq!(doc["frames"][1]["durationMs"], 150);
        let a = BASE64
            .decode(doc["frames"][0]["cels"][0].as_str().unwrap())
            .unwrap();
        let b = BASE64
            .decode(doc["frames"][1]["cels"][0].as_str().unwrap())
            .unwrap();
        assert!(a[0] > 0);
        assert_eq!(a[32], 0);
        assert_eq!(b[0], 0);
        assert!(b[32] > 0);
        assert_eq!(doc["paletteLines"], serde_json::json!([0]));
        for line in 1..4 {
            for slot in 1..16 {
                assert_eq!(doc["palettes"][line][slot], serde_json::json!([0, 0, 0]));
            }
        }
        assert!(warnings.iter().any(|w| w.contains("transparentes")));
        assert!(convert_frames(&[], &[], "empty", "sprite", "keep").is_err());
    }

    #[test]
    fn ingress_keeps_all_gif_frames_and_delays() {
        let mut bytes = Vec::new();
        {
            let mut encoder = image::codecs::gif::GifEncoder::new(&mut bytes);
            for (color, delay) in [([255, 0, 0, 255], 40), ([0, 0, 255, 255], 150)] {
                encoder
                    .encode_frame(image::Frame::from_parts(
                        RgbaImage::from_pixel(16, 16, Rgba(color)),
                        0,
                        0,
                        image::Delay::from_numer_denom_ms(delay, 1),
                    ))
                    .unwrap();
            }
        }
        let (frames, delays, _) = decode_frames(&bytes).unwrap();
        assert_eq!(delays, vec![40, 150]);
        let (raw, _, _, _) = convert_frames(&frames, &delays, "gif", "sprite", "keep").unwrap();
        let doc: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(doc["frames"].as_array().unwrap().len(), 2);
        assert_ne!(doc["frames"][0]["cels"], doc["frames"][1]["cels"]);
        assert_eq!(doc["frames"][1]["durationMs"], 150);
    }
    #[test]
    fn ingress_corrupt_and_network_sources_are_bounded() {
        assert!(decode_frames(b"GIF89a").is_err());
        assert!(!public_ip("127.0.0.1".parse().unwrap()));
        assert!(!public_ip("::ffff:192.168.1.3".parse().unwrap()));
        assert!(!public_ip("169.254.169.254".parse().unwrap()));
        assert!(public_ip("1.1.1.1".parse().unwrap()));
        assert!(fetch_image("file:///etc/passwd").is_err());
    }
    #[test]
    fn ingress_background_preserves_opaque_border_sprite_can_keep_or_remove_it() {
        let mut picture = RgbaImage::from_pixel(24, 24, Rgba([255, 255, 255, 255]));
        for y in 8..16 {
            for x in 8..16 {
                picture.put_pixel(x, y, Rgba([255, 0, 0, 255]));
            }
        }
        for (role, mode, transparent) in [
            ("background", "auto", false),
            ("sprite", "keep", false),
            ("sprite", "auto", true),
        ] {
            let (_, png, _, _) =
                convert_frames(&[picture.clone()], &[100], "object", role, mode).unwrap();
            let image = image::load_from_memory(&BASE64.decode(png).unwrap())
                .unwrap()
                .into_rgba8();
            assert_eq!(image.get_pixel(0, 0)[3] == 0, transparent);
            assert_eq!(image.get_pixel(12, 12)[3], 255);
        }
    }
}
