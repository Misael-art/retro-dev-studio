//! patch_studio.rs — ROM Patch Studio: criação e aplicação de patches IPS e BPS.
//!
//! Compliance legal: este módulo NUNCA distribui ROMs. Apenas gera/aplica patches
//! diferenciais (IPS/BPS) que requerem que o usuário forneça a ROM original.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

// ── Resultado ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PatchResult {
    pub ok: bool,
    pub message: String,
    pub bytes_changed: u32,
    pub patch_hash: Option<String>,
}

impl PatchResult {
    fn ok(msg: impl Into<String>, changed: u32) -> Self {
        Self {
            ok: true,
            message: msg.into(),
            bytes_changed: changed,
            patch_hash: None,
        }
    }
    fn ok_with_hash(msg: impl Into<String>, changed: u32, patch_hash: String) -> Self {
        Self {
            ok: true,
            message: msg.into(),
            bytes_changed: changed,
            patch_hash: Some(patch_hash),
        }
    }
    fn err(msg: impl Into<String>) -> Self {
        Self {
            ok: false,
            message: msg.into(),
            bytes_changed: 0,
            patch_hash: None,
        }
    }
}

// ── IPS ───────────────────────────────────────────────────────────────────────
// Formato IPS: https://zerosoft.zophar.net/ips.htm
// Header: "PATCH" (5 bytes)
// Records: offset (3 bytes BE) + size (2 bytes BE) + data
// EOF: "EOF" (3 bytes)

const IPS_HEADER: &[u8] = b"PATCH";
const IPS_EOF: &[u8] = b"EOF";

/// Cria um patch IPS comparando `original` com `modified`.
/// Retorna os bytes do patch IPS (para salvar em arquivo).
pub fn create_ips(original: &[u8], modified: &[u8]) -> Result<Vec<u8>, String> {
    if original.len() > 0xFF_FFFF {
        return Err("IPS não suporta ROMs maiores que 16MB.".to_string());
    }

    let mut patch = IPS_HEADER.to_vec();
    let len = original.len().min(modified.len());
    let mut i = 0usize;

    while i < len {
        if original[i] == modified[i] {
            i += 1;
            continue;
        }
        // Encontrou diferença — colete run de bytes diferentes
        let start = i;
        while i < len && (i - start) < 0xFFFF && original[i] != modified[i] {
            i += 1;
        }
        let data = &modified[start..i];
        let offset = start as u32;
        // offset 3 bytes BE
        patch.push(((offset >> 16) & 0xFF) as u8);
        patch.push(((offset >> 8) & 0xFF) as u8);
        patch.push((offset & 0xFF) as u8);
        // size 2 bytes BE
        let size = data.len() as u16;
        patch.push((size >> 8) as u8);
        patch.push((size & 0xFF) as u8);
        patch.extend_from_slice(data);
    }

    patch.extend_from_slice(IPS_EOF);
    Ok(patch)
}

/// Aplica um patch IPS a `original` e retorna a ROM patcheada.
pub fn apply_ips(original: &[u8], patch: &[u8]) -> Result<Vec<u8>, String> {
    if !patch.starts_with(IPS_HEADER) {
        return Err("Patch inválido: header IPS 'PATCH' não encontrado.".to_string());
    }

    let mut rom = original.to_vec();
    let mut pos = IPS_HEADER.len();

    loop {
        if pos + 3 > patch.len() {
            return Err("Patch corrompido: truncado antes do EOF.".to_string());
        }
        if &patch[pos..pos + 3] == IPS_EOF {
            break;
        }
        let offset = ((patch[pos] as usize) << 16)
            | ((patch[pos + 1] as usize) << 8)
            | (patch[pos + 2] as usize);
        pos += 3;

        if pos + 2 > patch.len() {
            return Err("Patch corrompido: size faltando.".to_string());
        }
        let size = ((patch[pos] as usize) << 8) | (patch[pos + 1] as usize);
        pos += 2;

        if size == 0 {
            // RLE record: 2 bytes length + 1 byte fill value
            if pos + 3 > patch.len() {
                return Err("Patch corrompido: RLE record incompleto.".to_string());
            }
            let rle_len = ((patch[pos] as usize) << 8) | (patch[pos + 1] as usize);
            let rle_byte = patch[pos + 2];
            pos += 3;
            let end = offset + rle_len;
            if end > rom.len() {
                rom.resize(end, 0);
            }
            for b in &mut rom[offset..end] {
                *b = rle_byte;
            }
        } else {
            if pos + size > patch.len() {
                return Err("Patch corrompido: dados incompletos.".to_string());
            }
            let data = &patch[pos..pos + size];
            pos += size;
            let end = offset + size;
            if end > rom.len() {
                rom.resize(end, 0);
            }
            rom[offset..end].copy_from_slice(data);
        }
    }

    Ok(rom)
}

// ── BPS ───────────────────────────────────────────────────────────────────────
// Formato BPS simplificado (subset): header "BPS1" + source_size + target_size
// + metadata_size + actions + source_checksum + target_checksum + patch_checksum
// Esta implementação suporta apenas o tipo de ação SourceRead (copia da source).

const BPS_HEADER: &[u8] = b"BPS1";

/// Varint BPS da especificação (byuu): 7 bits por byte, bit 7 marca o ÚLTIMO
/// byte, e cada byte não final subtrai 1 do restante (`value -= 1`). Sem esse
/// ajuste o patch só funcionaria neste produto e seria recusado por Flips/beat.
fn encode_varint(mut value: u64, out: &mut Vec<u8>) {
    loop {
        let x = (value & 0x7F) as u8;
        value >>= 7;
        if value == 0 {
            out.push(0x80 | x);
            break;
        }
        out.push(x);
        value -= 1;
    }
}

fn decode_varint(data: &[u8], pos: &mut usize) -> Result<u64, String> {
    let mut result = 0u64;
    let mut shift = 1u64;
    // Um u64 cabe em no máximo 10 bytes de 7 bits; mais que isso é entrada malformada.
    for _ in 0..10 {
        let Some(&b) = data.get(*pos) else {
            return Err("BPS: varint truncado.".to_string());
        };
        *pos += 1;
        let part = u64::from(b & 0x7F)
            .checked_mul(shift)
            .ok_or("BPS: varint excede 64 bits.")?;
        result = result
            .checked_add(part)
            .ok_or("BPS: varint excede 64 bits.")?;
        if b & 0x80 != 0 {
            return Ok(result);
        }
        shift = shift
            .checked_mul(128)
            .ok_or("BPS: varint excede 64 bits.")?;
        result = result
            .checked_add(shift)
            .ok_or("BPS: varint excede 64 bits.")?;
    }
    Err("BPS: varint excede 64 bits.".to_string())
}

fn crc32_simple(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

pub fn patch_hash_hex(data: &[u8]) -> String {
    format!("{:08X}", crc32_simple(data))
}

fn validate_patch_output_path(patch_path: &Path, expected_extension: &str) -> Result<(), String> {
    let extension = patch_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    match extension.as_deref() {
        Some(value) if value == expected_extension => Ok(()),
        _ => Err(format!(
            "Saida invalida: o Patch Studio exporta apenas arquivos .{}.",
            expected_extension
        )),
    }
}

fn encode_signed_offset(delta: i64, out: &mut Vec<u8>) {
    let encoded = if delta < 0 {
        ((-delta) as u64) << 1 | 1
    } else {
        (delta as u64) << 1
    };
    encode_varint(encoded, out);
}

fn source_copy_candidate(
    original: &[u8],
    modified: &[u8],
    target_pos: usize,
) -> Option<(usize, usize)> {
    if target_pos >= modified.len() {
        return None;
    }

    let mut best: Option<(usize, usize)> = None;
    for source_start in 0..original.len() {
        if source_start == target_pos || original[source_start] != modified[target_pos] {
            continue;
        }

        let mut run_len = 0usize;
        while target_pos + run_len < modified.len()
            && source_start + run_len < original.len()
            && modified[target_pos + run_len] == original[source_start + run_len]
        {
            run_len += 1;
        }

        if run_len >= 4 && best.is_none_or(|(_, best_len)| run_len > best_len) {
            best = Some((source_start, run_len));
        }
    }

    best
}

/// Cria um patch BPS (subset SourceRead/TargetRead/SourceCopy) entre `original` e `modified`.
pub fn create_bps(original: &[u8], modified: &[u8]) -> Result<Vec<u8>, String> {
    let mut patch = BPS_HEADER.to_vec();

    encode_varint(original.len() as u64, &mut patch);
    encode_varint(modified.len() as u64, &mut patch);
    encode_varint(0, &mut patch); // metadata size = 0

    let mut i = 0usize;
    let mut source_copy_pos = 0i64;

    while i < modified.len() {
        if i < original.len() && original[i] == modified[i] {
            let start = i;
            while i < modified.len() && i < original.len() && original[i] == modified[i] {
                i += 1;
            }
            let run = (i - start) as u64;
            encode_varint((run - 1) << 2, &mut patch);
            continue;
        }

        if let Some((source_start, run_len)) = source_copy_candidate(original, modified, i) {
            encode_varint((((run_len as u64) - 1) << 2) | 2, &mut patch);
            encode_signed_offset(source_start as i64 - source_copy_pos, &mut patch);
            source_copy_pos = source_start as i64 + run_len as i64;
            i += run_len;
            continue;
        }

        let start = i;
        i += 1;
        while i < modified.len() {
            let same_position = i < original.len() && original[i] == modified[i];
            let reusable_source = source_copy_candidate(original, modified, i).is_some();
            if same_position || reusable_source {
                break;
            }
            i += 1;
        }

        let data = &modified[start..i];
        let run = data.len() as u64;
        encode_varint(((run - 1) << 2) | 1, &mut patch);
        patch.extend_from_slice(data);
    }

    if modified.len() > i {
        while i < modified.len() {
            let start = i;
            while i < modified.len() {
                let same_position = i < original.len() && original[i] == modified[i];
                let reusable_source = source_copy_candidate(original, modified, i).is_some();
                if same_position || reusable_source {
                    break;
                }
                i += 1;
            }
            let data = &modified[start..i];
            let run = data.len() as u64;
            encode_varint(((run - 1) << 2) | 1, &mut patch);
            patch.extend_from_slice(data);
        }
    }

    // Checksums (CRC32 LE)
    let src_crc = crc32_simple(original).to_le_bytes();
    let tgt_crc = crc32_simple(modified).to_le_bytes();
    patch.extend_from_slice(&src_crc);
    patch.extend_from_slice(&tgt_crc);
    let patch_crc = crc32_simple(&patch).to_le_bytes();
    patch.extend_from_slice(&patch_crc);

    Ok(patch)
}

/// Teto de saída de um patch BPS (acima de qualquer ROM de MD/SNES suportada).
/// Validado ANTES de alocar: um cabeçalho malicioso não força alocação gigante.
pub const BPS_MAX_OUTPUT: u64 = 64 * 1024 * 1024;

/// Erro estruturado do aplicador BPS: o chamador decide o que mostrar; nenhum
/// arquivo é tocado pelo aplicador em memória.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BpsError {
    pub code: &'static str,
    pub message: String,
}

impl BpsError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for BpsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

fn bps_varint(patch: &[u8], pos: &mut usize, end: usize) -> Result<u64, BpsError> {
    // Lê só dentro do corpo (nunca os rodapés de CRC como se fossem ação).
    let body = &patch[..end];
    decode_varint(body, pos).map_err(|m| {
        let code = if m.contains("excede") {
            "bps_varint_overflow"
        } else {
            "bps_truncated"
        };
        BpsError::new(code, m)
    })
}

fn bps_signed(data: u64) -> (bool, u64) {
    (data & 1 != 0, data >> 1)
}

fn bps_offset(current: u64, data: u64) -> Result<u64, BpsError> {
    let (negative, magnitude) = bps_signed(data);
    let next = if negative {
        current.checked_sub(magnitude)
    } else {
        current.checked_add(magnitude)
    };
    next.ok_or_else(|| BpsError::new("bps_offset_out_of_range", "offset relativo sai do domínio"))
}

/// Aplica um patch BPS (especificação byuu) a `original`, com validação estrita:
/// tudo que o patch declara tem que caber, exatamente, em origem/saída/corpo;
/// nada é cortado, substituído por zero nem completado silenciosamente.
pub fn apply_bps_checked(original: &[u8], patch: &[u8]) -> Result<Vec<u8>, BpsError> {
    if !patch.starts_with(BPS_HEADER) {
        return Err(BpsError::new(
            "bps_bad_header",
            "header BPS1 não encontrado",
        ));
    }
    if patch.len() < BPS_HEADER.len() + 3 + 12 {
        return Err(BpsError::new("bps_truncated", "patch curto demais"));
    }
    let footer = patch.len() - 12;
    let word = |at: usize| u32::from_le_bytes(patch[at..at + 4].try_into().unwrap());
    let (source_crc, target_crc, patch_crc) = (word(footer), word(footer + 4), word(footer + 8));
    if crc32_simple(&patch[..patch.len() - 4]) != patch_crc {
        return Err(BpsError::new(
            "bps_patch_crc",
            format!(
                "CRC32 do patch inválido (esperado {patch_crc:08X}, obtido {:08X})",
                crc32_simple(&patch[..patch.len() - 4])
            ),
        ));
    }
    let mut pos = BPS_HEADER.len();
    let source_size = bps_varint(patch, &mut pos, footer)?;
    let target_size = bps_varint(patch, &mut pos, footer)?;
    let metadata_size = bps_varint(patch, &mut pos, footer)?;
    if source_size != original.len() as u64 {
        if let Some(legacy) = legacy_bps_diagnosis(original, patch) {
            return Err(legacy);
        }
        return Err(BpsError::new(
            "bps_source_size",
            format!(
                "tamanho da base divergente (esperado {source_size}, observado {})",
                original.len()
            ),
        ));
    }
    if crc32_simple(original) != source_crc {
        return Err(BpsError::new(
            "bps_source_crc",
            format!(
                "checksum da base divergente (esperado {source_crc:08X}, observado {:08X})",
                crc32_simple(original)
            ),
        ));
    }
    if target_size > BPS_MAX_OUTPUT {
        return Err(BpsError::new(
            "bps_output_budget",
            format!("saída declarada de {target_size} bytes excede o teto de {BPS_MAX_OUTPUT}"),
        ));
    }
    let target_size = target_size as usize;
    let meta_end = usize::try_from(metadata_size)
        .ok()
        .and_then(|m| pos.checked_add(m))
        .filter(|&end| end <= footer)
        .ok_or_else(|| BpsError::new("bps_metadata", "metadados ultrapassam o corpo"))?;
    pos = meta_end;

    let mut output = vec![0u8; target_size];
    let mut out_pos = 0usize;
    let (mut source_rel, mut target_rel) = (0u64, 0u64);
    while out_pos < target_size {
        if pos >= footer {
            return Err(BpsError::new(
                "bps_truncated",
                format!("corpo termina com {out_pos} de {target_size} bytes produzidos"),
            ));
        }
        let data = bps_varint(patch, &mut pos, footer)?;
        let length = usize::try_from(data >> 2)
            .ok()
            .and_then(|l| l.checked_add(1))
            .ok_or_else(|| BpsError::new("bps_length", "comprimento de ação inválido"))?;
        let end = out_pos
            .checked_add(length)
            .filter(|&e| e <= target_size)
            .ok_or_else(|| {
                BpsError::new(
                    "bps_action_outside_output",
                    format!(
                        "ação de {length} bytes em {out_pos} ultrapassa a saída de {target_size}"
                    ),
                )
            })?;
        match data & 3 {
            0 => {
                let src = original.get(out_pos..end).ok_or_else(|| {
                    BpsError::new("bps_source_range", "SourceRead fora da origem")
                })?;
                output[out_pos..end].copy_from_slice(src);
            }
            1 => {
                let data_end = pos
                    .checked_add(length)
                    .filter(|&e| e <= footer)
                    .ok_or_else(|| {
                        BpsError::new("bps_truncated", "TargetRead excede o corpo do patch")
                    })?;
                output[out_pos..end].copy_from_slice(&patch[pos..data_end]);
                pos = data_end;
            }
            2 => {
                let offset = bps_varint(patch, &mut pos, footer)?;
                source_rel = bps_offset(source_rel, offset)?;
                let start = usize::try_from(source_rel)
                    .map_err(|_| BpsError::new("bps_source_range", "SourceCopy fora da origem"))?;
                let src = start
                    .checked_add(length)
                    .and_then(|e| original.get(start..e))
                    .ok_or_else(|| {
                        BpsError::new("bps_source_range", "SourceCopy fora da origem")
                    })?;
                output[out_pos..end].copy_from_slice(src);
                source_rel += length as u64;
            }
            _ => {
                let offset = bps_varint(patch, &mut pos, footer)?;
                target_rel = bps_offset(target_rel, offset)?;
                let start = usize::try_from(target_rel)
                    .ok()
                    .filter(|&s| s < out_pos)
                    .ok_or_else(|| {
                        BpsError::new(
                            "bps_target_history",
                            "TargetCopy referencia saída ainda não produzida",
                        )
                    })?;
                // Byte a byte: a cópia sobreposta (RLE) lê bytes que acabou de produzir.
                for i in 0..length {
                    output[out_pos + i] = output[start + i];
                }
                target_rel += length as u64;
            }
        }
        out_pos = end;
    }
    if pos != footer {
        return Err(BpsError::new(
            "bps_trailing_data",
            format!(
                "{} byte(s) de corpo sobram depois da saída completa",
                footer - pos
            ),
        ));
    }
    if crc32_simple(&output) != target_crc {
        return Err(BpsError::new(
            "bps_target_crc",
            "o resultado não confere com o checksum do alvo",
        ));
    }
    Ok(output)
}

/// Reconhece (sem aplicar) o formato LEGADO: as versões anteriores deste produto gravavam o varint
/// como LEB128 simples, sem o `value -= 1` da especificação BPS. Esses patches só funcionavam aqui
/// (Flips/beat os recusam). Como o formato é ambíguo, NUNCA é aceito automaticamente: o aplicador
/// só explica e indica como reexportar a partir da edição verificada (sessão: base + cópia + ledger).
fn legacy_bps_diagnosis(original: &[u8], patch: &[u8]) -> Option<BpsError> {
    let footer = patch.len().checked_sub(12)?;
    let mut pos = BPS_HEADER.len();
    let mut legacy = || -> Option<u64> {
        let mut value = 0u64;
        let mut shift = 0u32;
        loop {
            let b = *patch.get(pos)?;
            pos += 1;
            value |= u64::from(b & 0x7F).checked_shl(shift)?;
            shift += 7;
            if b & 0x80 != 0 {
                return Some(value);
            }
            if shift > 63 {
                return None;
            }
        }
    };
    let source_size = legacy()?;
    let _target_size = legacy()?;
    let _meta = legacy()?;
    let source_crc = u32::from_le_bytes(patch[footer..footer + 4].try_into().ok()?);
    if source_size == original.len() as u64 && source_crc == crc32_simple(original) {
        Some(BpsError::new(
            "bps_legacy_format",
            "este patch usa o formato BPS antigo deste produto (varint fora da especificação, \
             incompatível com Flips/beat) e não é aplicado automaticamente. Nenhum arquivo foi \
             alterado. Para obter um patch válido, abra a sessão da edição (base + cópia verificadas) \
             e use \"Exportar patch BPS\" de novo.",
        ))
    } else {
        None
    }
}

/// Aplica um patch BPS a `original` (erro como texto `codigo: mensagem`).
pub fn apply_bps(original: &[u8], patch: &[u8]) -> Result<Vec<u8>, String> {
    apply_bps_checked(original, patch).map_err(|e| e.to_string())
}

fn reject_overwrite(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let input = fs::canonicalize(input_path)
        .map_err(|error| format!("Erro ao resolver ROM base: {error}"))?;
    let output = if output_path.exists() {
        fs::canonicalize(output_path)
            .map_err(|error| format!("Erro ao resolver saída da ROM: {error}"))?
    } else {
        output_path.to_path_buf()
    };
    if input == output {
        return Err(
            "A ROM original não pode ser sobrescrita; escolha outro arquivo de saída.".to_string(),
        );
    }
    Ok(())
}

// ── IPC-level helpers (chamados de lib.rs) ───────────────────────────────────

/// Cria um patch IPS a partir de dois arquivos e salva em `patch_path`.
pub fn create_ips_file(
    original_path: &Path,
    modified_path: &Path,
    patch_path: &Path,
) -> PatchResult {
    if let Err(error) = validate_patch_output_path(patch_path, "ips") {
        return PatchResult::err(error);
    }
    let orig = match fs::read(original_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM original: {e}")),
    };
    let modif = match fs::read(modified_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM modificada: {e}")),
    };
    let patch = match create_ips(&orig, &modif) {
        Ok(p) => p,
        Err(e) => return PatchResult::err(e),
    };
    let changed = patch.len() as u32;
    if let Err(e) = write_atomic(patch_path, &patch) {
        return PatchResult::err(format!("Erro ao salvar patch: {e}"));
    }
    PatchResult::ok(
        format!("Patch IPS criado: {} bytes de diferença.", changed),
        changed,
    )
}

/// Aplica um patch IPS a uma ROM e salva a ROM patcheada em `output_path`.
pub fn apply_ips_file(rom_path: &Path, patch_path: &Path, output_path: &Path) -> PatchResult {
    if let Err(error) = reject_overwrite(rom_path, output_path) {
        return PatchResult::err(error);
    }
    let rom = match fs::read(rom_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM: {e}")),
    };
    let patch = match fs::read(patch_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler patch: {e}")),
    };
    let patched = match apply_ips(&rom, &patch) {
        Ok(r) => r,
        Err(e) => return PatchResult::err(e),
    };
    let changed = patched
        .iter()
        .zip(rom.iter())
        .filter(|(a, b)| a != b)
        .count() as u32;
    if let Err(e) = fs::write(output_path, &patched) {
        return PatchResult::err(format!("Erro ao salvar ROM patcheada: {e}"));
    }
    PatchResult::ok(
        format!("Patch IPS aplicado: {} bytes alterados.", changed),
        changed,
    )
}

/// Cria um patch BPS a partir de dois arquivos e salva em `patch_path`.
pub fn create_bps_file(
    original_path: &Path,
    modified_path: &Path,
    patch_path: &Path,
) -> PatchResult {
    let orig = match fs::read(original_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM original: {e}")),
    };
    let modif = match fs::read(modified_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM modificada: {e}")),
    };
    let patch = match create_bps(&orig, &modif) {
        Ok(p) => p,
        Err(e) => return PatchResult::err(e),
    };
    let changed = patch.len() as u32;
    if let Err(e) = write_atomic(patch_path, &patch) {
        return PatchResult::err(format!("Erro ao salvar patch: {e}"));
    }
    PatchResult::ok(
        format!("Patch BPS criado: {} bytes de patch.", changed),
        changed,
    )
}

pub fn create_ips_file_compliance(
    original_path: &Path,
    modified_path: &Path,
    patch_path: &Path,
) -> PatchResult {
    if let Err(error) = validate_patch_output_path(patch_path, "ips") {
        return PatchResult::err(error);
    }

    let result = create_ips_file(original_path, modified_path, patch_path);
    if !result.ok {
        return result;
    }

    let patch = match fs::read(patch_path) {
        Ok(bytes) => bytes,
        Err(error) => {
            return PatchResult::err(format!(
                "Patch IPS criado, mas o hash nao pode ser calculado: {}",
                error
            ))
        }
    };

    PatchResult::ok_with_hash(result.message, result.bytes_changed, patch_hash_hex(&patch))
}

pub fn create_bps_file_compliance(
    original_path: &Path,
    modified_path: &Path,
    patch_path: &Path,
) -> PatchResult {
    if let Err(error) = validate_patch_output_path(patch_path, "bps") {
        return PatchResult::err(error);
    }

    let result = create_bps_file(original_path, modified_path, patch_path);
    if !result.ok {
        return result;
    }

    let patch = match fs::read(patch_path) {
        Ok(bytes) => bytes,
        Err(error) => {
            return PatchResult::err(format!(
                "Patch BPS criado, mas o hash nao pode ser calculado: {}",
                error
            ))
        }
    };

    PatchResult::ok_with_hash(result.message, result.bytes_changed, patch_hash_hex(&patch))
}

/// Aplica um patch BPS a uma ROM e salva a ROM patcheada em `output_path`.
/// Escrita atômica: temporário no mesmo diretório + rename; nunca deixa arquivo parcial.
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".rds-tmp");
    let tmp = PathBuf::from(tmp);
    let result = fs::write(&tmp, bytes).and_then(|_| fs::rename(&tmp, path));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

pub fn apply_bps_file(rom_path: &Path, patch_path: &Path, output_path: &Path) -> PatchResult {
    if let Err(error) = reject_overwrite(rom_path, output_path) {
        return PatchResult::err(error);
    }
    let rom = match fs::read(rom_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler ROM: {e}")),
    };
    let patch = match fs::read(patch_path) {
        Ok(b) => b,
        Err(e) => return PatchResult::err(format!("Erro ao ler patch: {e}")),
    };
    let patched = match apply_bps(&rom, &patch) {
        Ok(r) => r,
        Err(e) => return PatchResult::err(e),
    };
    let changed = patched
        .iter()
        .zip(rom.iter())
        .filter(|(a, b)| a != b)
        .count() as u32;
    if let Err(e) = write_atomic(output_path, &patched) {
        return PatchResult::err(format!("Erro ao salvar ROM patcheada: {e}"));
    }
    PatchResult::ok(
        format!("Patch BPS aplicado: {} bytes alterados.", changed),
        changed,
    )
}

#[cfg(test)]
mod tests {
    /// Gera um patch no formato LEGADO (varint LEB128 sem o ajuste da spec), como o produto fazia.
    fn legacy_patch(src: &[u8], tgt: &[u8]) -> Vec<u8> {
        fn lv(mut v: u64, o: &mut Vec<u8>) {
            loop {
                let mut x = (v & 0x7F) as u8;
                v >>= 7;
                if v == 0 {
                    x |= 0x80;
                }
                o.push(x);
                if x & 0x80 != 0 {
                    break;
                }
            }
        }
        let mut p = BPS_HEADER.to_vec();
        lv(src.len() as u64, &mut p);
        lv(tgt.len() as u64, &mut p);
        lv(0, &mut p);
        // um TargetRead com o alvo inteiro
        lv((((tgt.len() as u64) - 1) << 2) | 1, &mut p);
        p.extend_from_slice(tgt);
        p.extend_from_slice(&crc32_simple(src).to_le_bytes());
        p.extend_from_slice(&crc32_simple(tgt).to_le_bytes());
        let c = crc32_simple(&p).to_le_bytes();
        p.extend_from_slice(&c);
        p
    }

    #[test]
    fn patch_legado_e_reconhecido_explicado_e_nunca_aplicado_automaticamente() {
        let src = vec![3u8; 20000];
        let mut tgt = src.clone();
        tgt[5] = 9;
        let legacy = legacy_patch(&src, &tgt);
        let err = apply_bps_checked(&src, &legacy).unwrap_err();
        assert_eq!(err.code, "bps_legacy_format", "{err}");
        assert!(
            err.message.contains("Exportar patch BPS") && err.message.contains("Nenhum arquivo")
        );
        // ROM diferente => não é diagnosticado como legado da base (erro comum de tamanho/CRC)
        let other = vec![4u8; 20000];
        assert_ne!(
            apply_bps_checked(&other, &legacy).unwrap_err().code,
            "bps_legacy_format"
        );
        // patches cujos varints são todos < 128 coincidem com a spec e continuam aplicando normalmente
        let s2 = vec![1u8; 30];
        let mut t2 = s2.clone();
        t2[1] = 2;
        assert_eq!(apply_bps(&s2, &legacy_patch(&s2, &t2)).unwrap(), t2);
    }

    #[test]
    fn apply_bps_file_preserva_arquivos_quando_recusa_e_grava_atomicamente() {
        let dir = std::env::temp_dir().join(format!("rds-bps-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (rom, patch, out) = (
            dir.join("rom.bin"),
            dir.join("old.bps"),
            dir.join("out.bin"),
        );
        let src = vec![3u8; 20000];
        let mut tgt = src.clone();
        tgt[5] = 9;
        std::fs::write(&rom, &src).unwrap();
        std::fs::write(&patch, legacy_patch(&src, &tgt)).unwrap();
        let before = (std::fs::read(&rom).unwrap(), std::fs::read(&patch).unwrap());
        let r = apply_bps_file(&rom, &patch, &out);
        assert!(
            !r.ok && r.message.contains("bps_legacy_format"),
            "{}",
            r.message
        );
        assert!(!out.exists(), "recusa não cria saída");
        assert_eq!(
            (std::fs::read(&rom).unwrap(), std::fs::read(&patch).unwrap()),
            before
        );
        // válido: sem temporário sobrando
        let good = dir.join("good.bps");
        let bytes = create_bps(&src, &tgt).unwrap();
        std::fs::write(&good, bytes).unwrap();
        assert!(apply_bps_file(&rom, &good, &out).ok);
        assert_eq!(std::fs::read(&out).unwrap(), tgt);
        assert!(!dir.join("out.bin.rds-tmp").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Ferramenta de interoperabilidade (não é gate): executa trabalhos do JSON em
    /// `RDS_BPS_JOBS` pelo CAMINHO CANÔNICO do produto e grava `RDS_BPS_RESULTS`.
    /// Trabalho: {"mode":"create"|"apply","a":path,"b":path,"out":path}
    /// (create: a=origem b=alvo; apply: a=origem b=patch).
    #[test]
    #[ignore = "ferramenta de interoperabilidade: RDS_BPS_JOBS e RDS_BPS_RESULTS"]
    fn bps_interop_tool() {
        let jobs: serde_json::Value =
            serde_json::from_slice(&std::fs::read(std::env::var("RDS_BPS_JOBS").unwrap()).unwrap())
                .unwrap();
        let mut results = Vec::new();
        for job in jobs.as_array().unwrap() {
            let get = |k: &str| job[k].as_str().unwrap().to_string();
            let a = std::fs::read(get("a")).unwrap();
            let b = std::fs::read(get("b")).unwrap();
            let r = if get("mode") == "create" {
                create_bps(&a, &b)
            } else {
                apply_bps_checked(&a, &b).map_err(|e| e.to_string())
            };
            match r {
                Ok(bytes) => {
                    std::fs::write(get("out"), bytes).unwrap();
                    results.push(serde_json::json!({"ok": true}));
                }
                Err(e) => results.push(serde_json::json!({"ok": false, "error": e})),
            }
        }
        std::fs::write(
            std::env::var("RDS_BPS_RESULTS").unwrap(),
            serde_json::to_vec(&results).unwrap(),
        )
        .unwrap();
    }

    // ---- Aplicador estrito (PR #110): os 5 casos reproduzidos + fronteiras ----

    fn mk(source: &[u8], target: &[u8], meta: &[u8], body: &[u8]) -> Vec<u8> {
        let mut p = BPS_HEADER.to_vec();
        encode_varint(source.len() as u64, &mut p);
        encode_varint(target.len() as u64, &mut p);
        encode_varint(meta.len() as u64, &mut p);
        p.extend_from_slice(meta);
        p.extend_from_slice(body);
        p.extend_from_slice(&crc32_simple(source).to_le_bytes());
        p.extend_from_slice(&crc32_simple(target).to_le_bytes());
        let c = crc32_simple(&p).to_le_bytes();
        p.extend_from_slice(&c);
        p
    }
    fn act(kind: u64, len: usize) -> Vec<u8> {
        let mut o = Vec::new();
        encode_varint((((len as u64) - 1) << 2) | kind, &mut o);
        o
    }
    fn rel(delta: i64) -> Vec<u8> {
        let mut o = Vec::new();
        let v = if delta < 0 {
            ((-delta) as u64) << 1 | 1
        } else {
            (delta as u64) << 1
        };
        encode_varint(v, &mut o);
        o
    }
    fn cat(parts: &[&[u8]]) -> Vec<u8> {
        parts.concat()
    }

    #[test]
    fn repro1_patch_sem_acoes_para_alvo_nao_vazio_e_recusado() {
        assert!(apply_bps(&[1], &mk(&[1], &[0], &[], &[])).is_err());
    }

    #[test]
    fn repro2_sourcecopy_com_offset_negativo_e_recusado_nao_vira_zero() {
        let body = cat(&[&act(2, 1), &rel(-1)]);
        assert!(apply_bps(&[5, 6], &mk(&[5, 6], &[0], &[], &body)).is_err());
    }

    #[test]
    fn repro3_targetcopy_de_historico_futuro_e_recusado() {
        let body = cat(&[&act(3, 1), &rel(0)]);
        assert!(apply_bps(&[1], &mk(&[1], &[0], &[], &body)).is_err());
    }

    #[test]
    fn repro4_targetread_maior_que_a_saida_nao_e_cortado() {
        let body = cat(&[&act(1, 2), &[7, 9]]);
        assert!(apply_bps(&[1], &mk(&[1], &[7], &[], &body)).is_err());
    }

    #[test]
    fn repro5_varint_de_21_bytes_nao_vira_valor_enganoso() {
        let mut v = vec![0x00u8; 20];
        v.push(0x80);
        let mut pos = 0;
        assert!(decode_varint(&v, &mut pos).is_err());
        let mut pos = 0;
        assert!(
            decode_varint(&[0x00; 12], &mut pos).is_err(),
            "11+ bytes sem terminador"
        );
    }

    #[test]
    fn as_quatro_acoes_tamanhos_diferentes_e_metadados_funcionam() {
        let src: Vec<u8> = (0..32u8).collect();
        // saída 40 bytes: SourceRead 4 | TargetRead 3 | SourceCopy 5 (src[20..25]) | TargetCopy 8 (rel 0) | SourceRead? não: preenche com TargetRead
        let mut tgt = Vec::new();
        tgt.extend_from_slice(&src[0..4]);
        tgt.extend_from_slice(&[0xAA, 0xBB, 0xCC]);
        tgt.extend_from_slice(&src[20..25]);
        let hist: Vec<u8> = tgt[0..8].to_vec();
        tgt.extend_from_slice(&hist);
        tgt.extend_from_slice(&[1, 2, 3]);
        let body = cat(&[
            &act(0, 4),
            &act(1, 3),
            &[0xAA, 0xBB, 0xCC],
            &act(2, 5),
            &rel(20),
            &act(3, 8),
            &rel(0),
            &act(1, 3),
            &[1, 2, 3],
        ]);
        let p = mk(&src, &tgt, b"meta autoral", &body);
        assert_eq!(apply_bps_checked(&src, &p).unwrap(), tgt);
        // alvo menor que a origem
        let small = src[..10].to_vec();
        let p2 = mk(&src, &small, &[], &act(0, 10));
        assert_eq!(apply_bps(&src, &p2).unwrap(), small);
    }

    #[test]
    fn targetcopy_sobreposto_valido_repete_o_byte_recem_produzido() {
        let body = cat(&[&act(1, 1), &[9], &act(3, 5), &rel(0)]);
        let p = mk(&[], &[9, 9, 9, 9, 9, 9], &[], &body);
        assert_eq!(apply_bps(&[], &p).unwrap(), vec![9; 6]);
    }

    #[test]
    fn fronteiras_de_varint_e_ida_e_volta_do_aplicador() {
        for len in [1usize, 127, 128, 129, 16511, 16512, 20000] {
            let src = vec![0x55u8; len];
            let mut tgt = src.clone();
            tgt[len - 1] ^= 1;
            let p = create_bps(&src, &tgt).unwrap();
            assert_eq!(apply_bps(&src, &p).unwrap(), tgt, "len {len}");
        }
    }

    #[test]
    fn recusas_estruturais_com_codigos() {
        let src = vec![1u8, 2, 3, 4];
        let ok = cat(&[&act(0, 4)]);
        assert_eq!(
            apply_bps_checked(&src, &mk(&src, &src, &[], &ok)).unwrap(),
            src
        );
        let code = |p: Vec<u8>| apply_bps_checked(&src, &p).unwrap_err().code;
        // sobra corpo depois da saída completa
        assert_eq!(
            code(mk(&src, &src, &[], &cat(&[&ok, &[0x80]]))),
            "bps_trailing_data"
        );
        // ação passa da saída declarada
        assert_eq!(
            code(mk(&src, &src, &[], &act(0, 5))),
            "bps_action_outside_output"
        );
        // SourceRead além da origem (saída maior que a origem)
        let big = vec![0u8; 8];
        assert_eq!(
            apply_bps_checked(&src, &mk(&src, &big, &[], &act(0, 8)))
                .unwrap_err()
                .code,
            "bps_source_range"
        );
        // orçamento de saída antes de alocar
        let mut huge = BPS_HEADER.to_vec();
        encode_varint(4, &mut huge);
        encode_varint(1 << 40, &mut huge);
        encode_varint(0, &mut huge);
        huge.extend_from_slice(&crc32_simple(&src).to_le_bytes());
        huge.extend_from_slice(&0u32.to_le_bytes());
        let c = crc32_simple(&huge).to_le_bytes();
        huge.extend_from_slice(&c);
        assert_eq!(code(huge), "bps_output_budget");
        // metadados passando do corpo
        let mut m = BPS_HEADER.to_vec();
        encode_varint(4, &mut m);
        encode_varint(4, &mut m);
        encode_varint(999, &mut m);
        m.extend_from_slice(&crc32_simple(&src).to_le_bytes());
        m.extend_from_slice(&crc32_simple(&src).to_le_bytes());
        let c = crc32_simple(&m).to_le_bytes();
        m.extend_from_slice(&c);
        assert_eq!(code(m), "bps_metadata");
        // rodapé nunca é lido como ação: corpo vazio + saída pendente
        assert_eq!(code(mk(&src, &src, &[], &[])), "bps_truncated");
        // base errada
        let other = vec![9u8; 4];
        assert_eq!(
            apply_bps_checked(&other, &mk(&src, &src, &[], &ok))
                .unwrap_err()
                .code,
            "bps_source_crc"
        );
        // CRC do alvo: corpo válido que produz algo diferente do declarado
        let mut wrong = src.clone();
        wrong[0] ^= 1;
        assert_eq!(code(mk(&src, &wrong, &[], &ok)), "bps_target_crc");
    }

    #[test]
    fn truncar_ou_mutar_o_patch_nunca_entra_em_panico() {
        let src: Vec<u8> = (0..64u8).collect();
        let mut tgt = src.clone();
        tgt[10] ^= 0xFF;
        tgt[40] ^= 0x0F;
        let p = create_bps(&src, &tgt).unwrap();
        for n in 0..p.len() {
            assert!(apply_bps(&src, &p[..n]).is_err(), "prefixo {n}");
        }
        let body_end = p.len() - 12;
        for i in 4..body_end {
            let mut m = p.clone();
            m[i] ^= 0xA5;
            let l = m.len();
            let c = crc32_simple(&m[..l - 4]).to_le_bytes();
            m[l - 4..].copy_from_slice(&c);
            if let Ok(out) = apply_bps(&src, &m) {
                assert_eq!(
                    out, tgt,
                    "mutação em {i} produziu saída diferente do alvo declarado"
                );
            }
        }
    }

    #[test]
    fn varint_bps_segue_a_especificacao_byuu() {
        let enc = |v: u64| {
            let mut o = Vec::new();
            encode_varint(v, &mut o);
            o
        };
        assert_eq!(enc(0), [0x80]);
        assert_eq!(enc(127), [0xFF]);
        assert_eq!(enc(128), [0x00, 0x80]);
        assert_eq!(enc(129), [0x01, 0x80]);
        assert_eq!(enc(16511), [0x7F, 0xFF]);
        assert_eq!(enc(16512), [0x00, 0x00, 0x80]);
        // 524288 (0x80000): tamanho de ROM de 512 KiB
        for v in [
            0u64,
            1,
            127,
            128,
            255,
            16383,
            16384,
            524_288,
            1 << 40,
            u64::MAX >> 1,
        ] {
            let bytes = enc(v);
            let mut pos = 0;
            assert_eq!(decode_varint(&bytes, &mut pos).unwrap(), v, "{v}");
            assert_eq!(pos, bytes.len());
        }
        let mut pos = 0;
        assert!(
            decode_varint(&[0x00; 20], &mut pos).is_err(),
            "varint sem terminador"
        );
    }

    #[test]
    fn apply_bps_recusa_alvo_que_nao_confere_com_o_crc() {
        let a: Vec<u8> = (0..300u32).map(|i| i as u8).collect();
        let mut b = a.clone();
        b[10] ^= 0xFF;
        let mut patch = create_bps(&a, &b).unwrap();
        assert_eq!(apply_bps(&a, &patch).unwrap(), b);
        // troca um byte de TargetRead e refaz só o CRC do patch: o do alvo denuncia
        let n = patch.len();
        let pos = patch.iter().rposition(|&x| x == b[10]).unwrap();
        patch[pos] ^= 1;
        let crc = crc32_simple(&patch[..n - 4]).to_le_bytes();
        patch[n - 4..].copy_from_slice(&crc);
        assert!(apply_bps(&a, &patch).unwrap_err().contains("alvo"));
    }

    use super::{
        apply_bps, apply_bps_checked, apply_bps_file, crc32_simple, create_bps, decode_varint,
        encode_varint, BPS_HEADER, BPS_MAX_OUTPUT,
    };

    fn create_bps_target_read_only(original: &[u8], modified: &[u8]) -> Vec<u8> {
        let mut patch = BPS_HEADER.to_vec();
        encode_varint(original.len() as u64, &mut patch);
        encode_varint(modified.len() as u64, &mut patch);
        encode_varint(0, &mut patch);

        let len = original.len().min(modified.len());
        let mut index = 0usize;
        while index < len {
            if original[index] == modified[index] {
                let start = index;
                while index < len && original[index] == modified[index] {
                    index += 1;
                }
                encode_varint((((index - start) as u64) - 1) << 2, &mut patch);
            } else {
                let start = index;
                while index < len && original[index] != modified[index] {
                    index += 1;
                }
                let data = &modified[start..index];
                encode_varint((((data.len() as u64) - 1) << 2) | 1, &mut patch);
                patch.extend_from_slice(data);
            }
        }

        if modified.len() > len {
            let extra = &modified[len..];
            encode_varint((((extra.len() as u64) - 1) << 2) | 1, &mut patch);
            patch.extend_from_slice(extra);
        }

        patch.extend_from_slice(&crc32_simple(original).to_le_bytes());
        patch.extend_from_slice(&crc32_simple(modified).to_le_bytes());
        let patch_crc = crc32_simple(&patch).to_le_bytes();
        patch.extend_from_slice(&patch_crc);
        patch
    }

    #[test]
    fn create_bps_emits_smaller_patch_when_source_copy_is_available() {
        let original = b"AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH".to_vec();
        let modified = b"AAAABBBBCCCCAAAABBBBFFFFGGGGHHHH".to_vec();

        let optimized = create_bps(&original, &modified).expect("optimized bps");
        let baseline = create_bps_target_read_only(&original, &modified);

        assert!(optimized.len() < baseline.len());

        let restored = apply_bps(&original, &optimized).expect("apply optimized bps");
        assert_eq!(restored, modified);
    }

    #[test]
    fn test_create_and_apply_ips_match() {
        // Simulates a tiny ROM that got patched
        let original = vec![0u8; 1000];
        let mut modified = original.clone();
        modified[500] = 0xAA;
        modified[501] = 0xBB;
        modified[999] = 0xCC;

        let patch = super::create_ips(&original, &modified).expect("Failed to create IPS patch");
        let restored = super::apply_ips(&original, &patch).expect("Failed to apply IPS patch");

        assert_eq!(restored, modified);
    }

    #[test]
    fn test_create_and_apply_bps_match() {
        // Simulates a tiny ROM that got patched
        let original = vec![0u8; 1000];
        let mut modified = original.clone();
        modified[500] = 0xAA;
        modified[501] = 0xBB;
        modified[999] = 0xCC;

        let patch = super::create_bps(&original, &modified).expect("Failed to create BPS patch");
        let restored = super::apply_bps(&original, &patch).expect("Failed to apply BPS patch");

        assert_eq!(restored, modified);
    }

    #[test]
    fn apply_bps_rejects_a_different_base_with_the_same_size() {
        let original = b"sonic-base-rom".to_vec();
        let mut modified = original.clone();
        modified[5] ^= 0x20;
        let patch = create_bps(&original, &modified).expect("create bps");

        let mut wrong_base = original.clone();
        wrong_base[0] ^= 0x01;
        let error = apply_bps(&wrong_base, &patch).expect_err("wrong base must be rejected");
        assert!(error.contains("checksum da base divergente"), "{error}");
    }
}
