//! Leitura nativa e SOMENTE-LEITURA dos seis layouts das fases especiais do
//! Sonic 1: Enigma (núcleo `rex-enigma`) → bytes → grade 64×64 de IDs de um
//! byte → projeção em WRAM com stride 128. Contrato congelado em
//! `docs/rex_profiles/integration_20261006/EXPECTATIONS-LAYOUTS-2026-10-06.md`.
//!
//! Três camadas, mantidas separadas (nada aqui é "nametable VDP"):
//!  1. Enigma produz BYTES (`rex_enigma::decode`; bytes lidos ≠ padding ≠
//!     tamanho armazenado ≠ saída descomprimida);
//!  2. o perfil Sonic interpreta esses 4096 bytes como grade 64×64 de IDs;
//!  3. o consumidor (`0x1B6E8..0x1B702`) projeta os IDs em
//!     `RAM[$FF1020 + linha*128 + coluna]`.
//!
//! Tudo é calculado do conteúdo da ROM recebida agora. Os hashes pinados são
//! referência histórica para comparação, nunca "decode realizado".

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use super::rom_library::sha256_hex;
use super::sonic_consumers as cons;

pub const FORMATO_RESUMO: &str = "layouts-info/v1";
pub const FORMATO_GRADE: &str = "layout-grid/v1";
pub const FORMATO_CELULA: &str = "layout-cell/v1";
pub const ROTULO_REPRESENTACAO: &str = "Mapa de IDs";
pub const LAYOUTS: usize = 6;
pub const MAX_SAIDA_BYTES: usize = cons::OUTPUT_SIZE;
/// Cada token produz ≥ 1 palavra; 2048 palavras + terminador, com folga de 2x.
pub const MAX_TOKENS: u64 = 4096;
/// Janela máxima de leitura do stream (os reais consomem ≤ 1242 bytes).
pub const JANELA_STREAM_MAX: usize = 8192;
pub const REQUEST_ID_MAX: usize = 64;
/// Slot do ID k na WRAM: `$FF4000 + 8k` (carregador pinado 0x1B706..0x1B722).
pub const SLOT_BASE: usize = 0xFF4000;

/// Pin de um layout: offset, bytes consumidos medidos e hashes históricos.
#[derive(Debug, Clone, Copy)]
pub struct PinLayout {
    pub offset: usize,
    pub consumidos: usize,
    pub span_sha256: &'static str,
    pub plain_sha256: &'static str,
}

pub fn pins_reais() -> [PinLayout; LAYOUTS] {
    let mut out = [PinLayout {
        offset: 0,
        consumidos: 0,
        span_sha256: "",
        plain_sha256: "",
    }; LAYOUTS];
    for (i, p) in out.iter_mut().enumerate() {
        *p = PinLayout {
            offset: cons::STREAM_OFFSETS[i],
            consumidos: cons::STREAM_CONSUMIDOS[i],
            span_sha256: cons::SPAN_PINS[i],
            plain_sha256: cons::PLAIN_REF_SHA[i],
        };
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReferenciaHistorica {
    pub natureza: String,
    pub plain_sha256: String,
    pub confere: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContaBytes {
    /// Bytes efetivamente lidos do stream (cabeçalho + bits até o terminador).
    pub bytes_lidos: usize,
    /// Alinhamento par do console, considerando a paridade do endereço real.
    pub padding_alinhamento: usize,
    /// Vão de armazenamento no console: lidos + padding.
    pub tamanho_armazenado: usize,
    /// Saída descomprimida (a grade de IDs).
    pub saida_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LayoutResumo {
    pub indice: usize,
    pub rotulo: String,
    pub stream_offset_hex: String,
    pub tabela_slot_hex: String,
    pub bytes: ContaBytes,
    pub tokens: u64,
    pub saida_sha256: String,
    pub span_sha256: String,
    pub span_confere_pin: bool,
    pub consumo_confere_pin: bool,
    pub referencia: ReferenciaHistorica,
    /// "confere" só quando span, consumo e saída coincidem com as referências.
    pub integridade: String,
    pub ids_distintos: usize,
    pub maior_id: u8,
    pub celulas_zero: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Geometria {
    pub linhas: usize,
    pub colunas: usize,
    pub celula_bytes: usize,
    pub stride_ram: usize,
    pub base_ram_hex: String,
    pub nivel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CamadaExplicada {
    pub ordem: usize,
    pub titulo: String,
    pub texto: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LayoutsInfo {
    pub formato: String,
    pub perfil_id: String,
    pub idioma: String,
    pub sessao_id: String,
    pub rom_sha256: String,
    pub rom_tamanho: usize,
    pub rom_confere_pin: bool,
    pub representacao: String,
    pub geometria: Geometria,
    pub layouts: Vec<LayoutResumo>,
    pub camadas: Vec<CamadaExplicada>,
    pub desconhecidos: Vec<String>,
    pub limites: LimitesDecode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LimitesDecode {
    pub max_saida_bytes: usize,
    pub max_tokens: u64,
    pub janela_stream_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LayoutGrade {
    pub formato: String,
    pub sessao_id: String,
    pub rom_sha256: String,
    pub indice: usize,
    pub representacao: String,
    pub linhas: usize,
    pub colunas: usize,
    /// 4096 IDs, um byte cada, linha a linha, em hexadecimal (8192 chars).
    pub ids_hex: String,
    pub saida_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OrigemCelula {
    pub layout_indice: usize,
    pub stream_offset_hex: String,
    pub tabela_slot_hex: String,
    /// Posição do byte na saída descomprimida (`linha*64 + coluna`).
    pub saida_offset: usize,
    pub saida_offset_hex: String,
    pub palavra_indice: usize,
    pub byte_na_palavra: String,
    pub endereco_ram_hex: String,
    pub explicacao: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DefinicaoEstrutural {
    pub id_hex: String,
    pub registro_endereco_hex: String,
    pub registro_hex: String,
    pub ponteiro_mapeamentos_hex: String,
    pub byte_inicial_hex: String,
    pub campo_hex: String,
    pub slot_ram_hex: String,
    pub nivel: String,
    pub nao_decodificado: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LayoutCelula {
    pub formato: String,
    pub sessao_id: String,
    pub rom_sha256: String,
    pub indice: usize,
    pub linha: usize,
    pub coluna: usize,
    pub id: u8,
    pub id_hex: String,
    pub origem: OrigemCelula,
    /// "comprovada" | "id-zero" | "fora-da-tabela"
    pub definicao_status: String,
    pub definicao: Option<DefinicaoEstrutural>,
    pub definicao_explicacao: String,
}

fn err(code: &str, detail: impl Into<String>) -> String {
    format!("{code}: {}", detail.into())
}

pub fn pin_para_cancel(f: &dyn Fn() -> bool) -> Result<(), String> {
    if f() {
        return Err(err("cancelled", "Análise cancelada pelo usuário"));
    }
    Ok(())
}

// ---------------------------------------------------------------- cancelamento

fn registro_cancel() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static R: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn validar_request_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > REQUEST_ID_MAX
        || !id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err(err(
            "layouts_parametro_invalido",
            format!("request_id deve ter 1..={REQUEST_ID_MAX} caracteres [a-z0-9-]"),
        ));
    }
    Ok(())
}

/// Registra um token de cancelamento para o request; o guard remove no drop.
pub struct TokenCancel {
    id: Option<String>,
    flag: Arc<AtomicBool>,
}

impl TokenCancel {
    pub fn novo(request_id: Option<&str>) -> Result<Self, String> {
        let flag = Arc::new(AtomicBool::new(false));
        match request_id {
            Some(id) => {
                validar_request_id(id)?;
                registro_cancel()
                    .lock()
                    .map_err(|e| e.to_string())?
                    .insert(id.to_string(), flag.clone());
                Ok(Self {
                    id: Some(id.to_string()),
                    flag,
                })
            }
            None => Ok(Self { id: None, flag }),
        }
    }
    pub fn cancelado(&self) -> bool {
        self.flag.load(Ordering::Acquire)
    }
}

impl Drop for TokenCancel {
    fn drop(&mut self) {
        if let (Some(id), Ok(mut r)) = (&self.id, registro_cancel().lock()) {
            r.remove(id);
        }
    }
}

/// Pede o cancelamento cooperativo de um request em andamento. Retorna se o
/// request estava registrado (já terminado = `false`, sem erro).
pub fn cancelar(request_id: &str) -> Result<bool, String> {
    validar_request_id(request_id)?;
    let r = registro_cancel().lock().map_err(|e| e.to_string())?;
    match r.get(request_id) {
        Some(flag) => {
            flag.store(true, Ordering::Release);
            Ok(true)
        }
        None => Ok(false),
    }
}

// ----------------------------------------------------------------- decode

#[derive(Debug, Clone)]
pub struct LayoutDecodificado {
    pub ids: Vec<u8>,
    pub stats: rex_enigma::Stats,
    pub offset: usize,
}

/// Decodifica UM layout da ROM recebida, com limites e cancelamento. Erro do
/// núcleo vira código estruturado `layouts_decode_<codigo>`.
pub fn decodificar(
    rom: &[u8],
    pin: &PinLayout,
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutDecodificado, String> {
    let ini = pin.offset;
    if ini >= rom.len() {
        return Err(err(
            "layouts_fora_da_rom",
            format!("stream 0x{ini:x} fora da ROM de {} bytes", rom.len()),
        ));
    }
    let fim = (ini + JANELA_STREAM_MAX).min(rom.len());
    let opts = rex_enigma::DecodeOptions {
        value_offset: 0,
        limits: rex_enigma::Limits {
            max_output_bytes: MAX_SAIDA_BYTES,
            work_limit: MAX_TOKENS,
        },
        cancel: Some(cancel),
    };
    let d = rex_enigma::decode(&rom[ini..fim], &opts).map_err(|e| {
        err(
            if e == rex_enigma::EnigmaError::Cancelled {
                "cancelled"
            } else {
                "layouts_decode"
            },
            format!(
                "stream 0x{ini:x}: {}{}",
                e.code(),
                if e == rex_enigma::EnigmaError::Cancelled {
                    " — análise cancelada pelo usuário".to_string()
                } else {
                    String::new()
                }
            ),
        )
    })?;
    let ids = d.bytes_be();
    if ids.len() != MAX_SAIDA_BYTES {
        return Err(err(
            "layouts_saida_tamanho",
            format!(
                "stream 0x{ini:x} produziu {} bytes; a grade exige {MAX_SAIDA_BYTES}",
                ids.len()
            ),
        ));
    }
    let mut stats = d.stats;
    // O padding do console depende da paridade do endereço real do stream.
    stats.padding_console = (ini + stats.bytes_lidos) % 2;
    stats.bytes_armazenados = stats.bytes_lidos + stats.padding_console;
    Ok(LayoutDecodificado {
        ids,
        stats,
        offset: ini,
    })
}

fn resumo_de(rom: &[u8], indice: usize, pin: &PinLayout, dec: &LayoutDecodificado) -> LayoutResumo {
    let span_fim = (pin.offset + dec.stats.bytes_lidos).min(rom.len());
    let span_sha = sha256_hex(&rom[pin.offset..span_fim]);
    let saida_sha = sha256_hex(&dec.ids);
    let span_ok = span_sha == pin.span_sha256;
    let consumo_ok = dec.stats.bytes_lidos == pin.consumidos;
    let plain_ok = saida_sha == pin.plain_sha256;
    let mut presentes = [false; 256];
    for &b in &dec.ids {
        presentes[b as usize] = true;
    }
    LayoutResumo {
        indice,
        rotulo: format!("Layout {} de {LAYOUTS}", indice + 1),
        stream_offset_hex: format!("{:#x}", pin.offset),
        tabela_slot_hex: format!("{:#x}", cons::TABELA_ADDR + indice * 4),
        bytes: ContaBytes {
            bytes_lidos: dec.stats.bytes_lidos,
            padding_alinhamento: dec.stats.padding_console,
            tamanho_armazenado: dec.stats.bytes_armazenados,
            saida_bytes: dec.ids.len(),
        },
        tokens: dec.stats.tokens,
        saida_sha256: saida_sha,
        span_sha256: span_sha,
        span_confere_pin: span_ok,
        consumo_confere_pin: consumo_ok,
        referencia: ReferenciaHistorica {
            natureza: "medida externa histórica (comparação, não é o decode atual)".to_string(),
            plain_sha256: pin.plain_sha256.to_string(),
            confere: plain_ok,
        },
        integridade: if span_ok && consumo_ok && plain_ok {
            "confere".to_string()
        } else {
            "diverge-da-referencia".to_string()
        },
        ids_distintos: presentes.iter().filter(|p| **p).count(),
        maior_id: dec.ids.iter().copied().max().unwrap_or(0),
        celulas_zero: dec.ids.iter().filter(|b| **b == 0).count(),
    }
}

fn camadas() -> Vec<CamadaExplicada> {
    vec![
        CamadaExplicada {
            ordem: 1,
            titulo: "Enigma entrega bytes".to_string(),
            texto: "O descompressor Enigma do app lê o bloco comprimido da ROM e devolve 4096 bytes. Ele não sabe o que os bytes significam.".to_string(),
        },
        CamadaExplicada {
            ordem: 2,
            titulo: "O perfil Sonic lê os bytes como uma grade de IDs".to_string(),
            texto: "Os 4096 bytes formam uma grade de 64 linhas × 64 colunas. Cada célula é um ID de um byte. Este é um mapa de IDs, não uma imagem montada.".to_string(),
        },
        CamadaExplicada {
            ordem: 3,
            titulo: "O jogo copia os IDs para a memória de trabalho".to_string(),
            texto: "O trecho de código que consome o layout copia cada ID para a RAM do console (a partir de $FF1020), saltando 128 bytes por linha. Isto não é a tabela de tiles do vídeo (VDP).".to_string(),
        },
    ]
}

fn desconhecidos() -> Vec<String> {
    vec![
        "O que cada ID desenha: arte, paleta, espelhamento e prioridade por célula não foram provados. O mapa mostra só os IDs.".to_string(),
        "Nenhum trecho do jogo foi executado: o app decodificou a ROM, o que não demonstra que o jogo consumiu esse recurso em execução.".to_string(),
        "A ligação entre os IDs e a arte (tabela de definições) é um vínculo estrutural estático; as cores (CRAM) são só evidência estática, não captura em execução.".to_string(),
        "Valor igual ao de uma referência externa histórica é uma comparação; ela não substitui o decode feito agora.".to_string(),
        "Vale para o Sonic 1 (EUA/Europa) medido; outras versões são recusadas quando os bytes não conferem.".to_string(),
    ]
}

fn checar_identidade(rom: &[u8], esperado: Option<&str>) -> Result<String, String> {
    let atual = sha256_hex(rom);
    if let Some(e) = esperado {
        if e != atual {
            return Err(err(
                "layouts_rom_mudou",
                format!(
                    "a ROM da sessão mudou (esperada {}…, atual {}…); recarregue os layouts",
                    &e[..e.len().min(12)],
                    &atual[..12]
                ),
            ));
        }
    }
    Ok(atual)
}

fn gate_cadeia(base: &[u8], rom: &[u8]) -> Result<(), String> {
    // Cadeia inteira de 37 sítios, tabela, SS_MapIndex: recusa total se divergir.
    cons::describe(base, rom).map(|_| ())
}

pub fn resumo_com_pins(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: Option<&str>,
    pins: &[PinLayout; LAYOUTS],
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutsInfo, String> {
    pin_para_cancel(cancel)?;
    let rom_sha = checar_identidade(rom, esperado)?;
    gate_cadeia(base, rom)?;
    let mut layouts = Vec::with_capacity(LAYOUTS);
    for (i, pin) in pins.iter().enumerate() {
        pin_para_cancel(cancel)?;
        let dec = decodificar(rom, pin, cancel)?;
        layouts.push(resumo_de(rom, i, pin, &dec));
    }
    Ok(LayoutsInfo {
        formato: FORMATO_RESUMO.to_string(),
        perfil_id: cons::PERFIL_ID.to_string(),
        idioma: cons::IDIOMA.to_string(),
        sessao_id: sessao_id.to_string(),
        rom_confere_pin: rom_sha == cons::ROM_PIN_SHA256 && rom.len() == cons::ROM_PIN_TAMANHO,
        rom_sha256: rom_sha,
        rom_tamanho: rom.len(),
        representacao: ROTULO_REPRESENTACAO.to_string(),
        geometria: Geometria {
            linhas: cons::LINHAS,
            colunas: cons::COLUNAS,
            celula_bytes: cons::CELULA_BYTES,
            stride_ram: cons::STRIDE,
            base_ram_hex: format!("{:x}", cons::BASE_LAYOUT),
            nivel: "vinculo-estrutural-estatico".to_string(),
        },
        layouts,
        camadas: camadas(),
        desconhecidos: desconhecidos(),
        limites: LimitesDecode {
            max_saida_bytes: MAX_SAIDA_BYTES,
            max_tokens: MAX_TOKENS,
            janela_stream_bytes: JANELA_STREAM_MAX,
        },
    })
}

pub fn resumo(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: Option<&str>,
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutsInfo, String> {
    resumo_com_pins(base, rom, sessao_id, esperado, &pins_reais(), cancel)
}

fn validar_indice(indice: usize) -> Result<(), String> {
    if indice >= LAYOUTS {
        return Err(err(
            "layouts_indice_invalido",
            format!(
                "layout {indice} inexistente; há {LAYOUTS} (0..={})",
                LAYOUTS - 1
            ),
        ));
    }
    Ok(())
}

pub fn grade_com_pins(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: &str,
    indice: usize,
    pins: &[PinLayout; LAYOUTS],
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutGrade, String> {
    validar_indice(indice)?;
    pin_para_cancel(cancel)?;
    let rom_sha = checar_identidade(rom, Some(esperado))?;
    gate_cadeia(base, rom)?;
    let dec = decodificar(rom, &pins[indice], cancel)?;
    Ok(LayoutGrade {
        formato: FORMATO_GRADE.to_string(),
        sessao_id: sessao_id.to_string(),
        rom_sha256: rom_sha,
        indice,
        representacao: ROTULO_REPRESENTACAO.to_string(),
        linhas: cons::LINHAS,
        colunas: cons::COLUNAS,
        ids_hex: dec.ids.iter().map(|b| format!("{b:02x}")).collect(),
        saida_sha256: sha256_hex(&dec.ids),
    })
}

pub fn grade(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: &str,
    indice: usize,
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutGrade, String> {
    grade_com_pins(
        base,
        rom,
        sessao_id,
        esperado,
        indice,
        &pins_reais(),
        cancel,
    )
}

/// Definição estrutural do ID: registro `k-1` de SS_MapIndex (loader pinado).
fn definicao(rom: &[u8], id: u8) -> (String, Option<DefinicaoEstrutural>, String) {
    if id == 0 {
        return (
            "id-zero".to_string(),
            None,
            "O ID 0 não tem registro: a tabela de definições começa no ID 1.".to_string(),
        );
    }
    let k = id as usize;
    if k > cons::MAPINDEX_ENTRADAS {
        return (
            "fora-da-tabela".to_string(),
            None,
            format!(
                "O ID {id:#04x} está além dos {} registros da tabela; nenhuma definição estrutural foi comprovada para ele.",
                cons::MAPINDEX_ENTRADAS
            ),
        );
    }
    let addr = cons::MAPINDEX_ADDR + (k - 1) * cons::MAPINDEX_ENTRADA_BYTES;
    let rec = &rom[addr..addr + cons::MAPINDEX_ENTRADA_BYTES];
    let ptr = u32::from_be_bytes([0, rec[1], rec[2], rec[3]]);
    let campo = u16::from_be_bytes([rec[4], rec[5]]);
    let hex: String = rec.iter().map(|b| format!("{b:02x}")).collect();
    (
        "comprovada".to_string(),
        Some(DefinicaoEstrutural {
            id_hex: format!("{id:#04x}"),
            registro_endereco_hex: format!("{addr:#x}"),
            registro_hex: hex,
            ponteiro_mapeamentos_hex: format!("{ptr:#x}"),
            byte_inicial_hex: format!("{:#04x}", rec[0]),
            campo_hex: format!("{campo:#06x}"),
            slot_ram_hex: format!("{:x}", SLOT_BASE + 8 * k),
            nivel: "vinculo-estrutural-estatico".to_string(),
            nao_decodificado: vec![
                "o que o campo de 16 bits significa (paleta/VRAM) não foi decodificado".to_string(),
                "os desenhos apontados pelo ponteiro não foram reconstruídos".to_string(),
            ],
        }),
        format!(
            "O ID {id:#04x} é o registro {k} da tabela em {addr:#x}; o carregador do jogo o copia para o slot ${:x} da RAM. Isto prova a ligação estrutural, não o desenho.",
            SLOT_BASE + 8 * k
        ),
    )
}

#[allow(clippy::too_many_arguments)]
pub fn celula_com_pins(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: &str,
    indice: usize,
    linha: usize,
    coluna: usize,
    pins: &[PinLayout; LAYOUTS],
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutCelula, String> {
    validar_indice(indice)?;
    if linha >= cons::LINHAS || coluna >= cons::COLUNAS {
        return Err(err(
            "layouts_celula_fora_da_grade",
            format!(
                "célula ({linha}, {coluna}) fora da grade {}×{}",
                cons::LINHAS,
                cons::COLUNAS
            ),
        ));
    }
    pin_para_cancel(cancel)?;
    let rom_sha = checar_identidade(rom, Some(esperado))?;
    gate_cadeia(base, rom)?;
    let dec = decodificar(rom, &pins[indice], cancel)?;
    let saida_offset = linha * cons::COLUNAS + coluna;
    let id = dec.ids[saida_offset];
    let (status, def, explicacao) = definicao(rom, id);
    Ok(LayoutCelula {
        formato: FORMATO_CELULA.to_string(),
        sessao_id: sessao_id.to_string(),
        rom_sha256: rom_sha,
        indice,
        linha,
        coluna,
        id,
        id_hex: format!("{id:#04x}"),
        origem: OrigemCelula {
            layout_indice: indice,
            stream_offset_hex: format!("{:#x}", pins[indice].offset),
            tabela_slot_hex: format!("{:#x}", cons::TABELA_ADDR + indice * 4),
            saida_offset,
            saida_offset_hex: format!("{saida_offset:#x}"),
            palavra_indice: saida_offset / 2,
            byte_na_palavra: if saida_offset % 2 == 0 { "alto" } else { "baixo" }.to_string(),
            endereco_ram_hex: format!(
                "{:x}",
                cons::BASE_LAYOUT + linha * cons::STRIDE + coluna
            ),
            explicacao: format!(
                "Este ID é o byte {saida_offset} da saída do Enigma do layout {} (bloco comprimido em {:#x}); não existe um byte único dele na ROM. O jogo o copia para ${:x}.",
                indice + 1,
                pins[indice].offset,
                cons::BASE_LAYOUT + linha * cons::STRIDE + coluna
            ),
        },
        definicao_status: status,
        definicao: def,
        definicao_explicacao: explicacao,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn celula(
    base: &[u8],
    rom: &[u8],
    sessao_id: &str,
    esperado: &str,
    indice: usize,
    linha: usize,
    coluna: usize,
    cancel: &dyn Fn() -> bool,
) -> Result<LayoutCelula, String> {
    celula_com_pins(
        base,
        rom,
        sessao_id,
        esperado,
        indice,
        linha,
        coluna,
        &pins_reais(),
        cancel,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hx(s: &str) -> Vec<u8> {
        (0..s.len() / 2)
            .map(|i| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap())
            .collect()
    }

    // ---- codificador de teste, independente do decoder: 128 blocos de 16
    // ---- palavras idênticas (`1|00|1111` + 5 bits de flag + 11 bits) + terminador.
    struct Bits {
        bytes: Vec<u8>,
        n: usize,
    }
    impl Bits {
        fn put(&mut self, v: u32, bits: u32) {
            for i in (0..bits).rev() {
                if self.n.is_multiple_of(8) {
                    self.bytes.push(0);
                }
                if (v >> i) & 1 == 1 {
                    let l = self.bytes.len() - 1;
                    self.bytes[l] |= 0x80 >> (self.n % 8);
                }
                self.n += 1;
            }
        }
    }

    /// `blocos[j]` = palavra repetida 16x (bytes 32j..32j+32 = hi,lo,hi,lo…).
    fn enigma_de_blocos(blocos: &[u16]) -> Vec<u8> {
        let mut b = Bits {
            bytes: Vec::new(),
            n: 0,
        };
        for &w in blocos {
            b.put(0b1_00_1111, 7);
            for j in (0..5u32).rev() {
                b.put(u32::from(w >> (11 + j)) & 1, 1);
            }
            b.put(u32::from(w) & 0x7FF, 11);
        }
        b.put(0x7F, 7);
        let mut out = vec![11u8, 0x1F, 0, 0, 0, 0];
        out.extend(b.bytes);
        out
    }

    /// Oráculo: byte `o` da saída de 4096 bytes dado `blocos`.
    fn oraculo(blocos: &[u16], o: usize) -> u8 {
        let w = blocos[o / 32];
        if o.is_multiple_of(2) {
            (w >> 8) as u8
        } else {
            w as u8
        }
    }

    fn blocos_do_layout(i: usize) -> Vec<u16> {
        (0..128usize)
            .map(|j| {
                // IDs variados: 0, 1, 78 (último com definição), 79 (fora), até 0xFE
                let a = ((i * 37 + j * 11) % 256) as u16;
                let b = match j % 8 {
                    0 => 0u16,
                    1 => 1,
                    2 => 78,
                    3 => 79,
                    _ => ((i * 5 + j * 3) % 256) as u16,
                };
                (a << 8) | b
            })
            .collect()
    }

    struct Fixture {
        rom: Vec<u8>,
        pins: [PinLayout; LAYOUTS],
        blocos: Vec<Vec<u16>>,
    }

    fn fixture() -> Fixture {
        let mut rom = vec![0u8; 0x67000];
        for s in cons::SITIOS.iter() {
            let b = hx(s.esperado_hex);
            rom[s.endereco..s.endereco + b.len()].copy_from_slice(&b);
        }
        let id01 = hx(cons::MAPINDEX_ID01_ESPERADO);
        rom[cons::MAPINDEX_ADDR..cons::MAPINDEX_ADDR + 6].copy_from_slice(&id01);
        for i in 1..cons::MAPINDEX_ENTRADAS {
            let o = cons::MAPINDEX_ADDR + i * cons::MAPINDEX_ENTRADA_BYTES;
            let ptr = (0x200 + i * 0x100) as u32;
            rom[o + 1..o + 4].copy_from_slice(&ptr.to_be_bytes()[1..]);
            rom[o] = i as u8;
            rom[o + 4] = 0x10;
            rom[o + 5] = i as u8;
        }
        let mut blocos = Vec::new();
        let mut spans: Vec<(usize, usize)> = Vec::new();
        for i in 0..LAYOUTS {
            let bl = blocos_do_layout(i);
            let s = enigma_de_blocos(&bl);
            let off = cons::STREAM_OFFSETS[i];
            assert!(s.len() < 600, "stream autoral cabe antes do próximo");
            rom[off..off + s.len()].copy_from_slice(&s);
            spans.push((off, s.len()));
            blocos.push(bl);
        }
        let leak = |s: String| -> &'static str { Box::leak(s.into_boxed_str()) };
        let mut pins = pins_reais();
        for i in 0..LAYOUTS {
            let (off, len) = spans[i];
            let plain: Vec<u8> = (0..4096).map(|o| oraculo(&blocos[i], o)).collect();
            pins[i] = PinLayout {
                offset: off,
                consumidos: len,
                span_sha256: leak(sha256_hex(&rom[off..off + len])),
                plain_sha256: leak(sha256_hex(&plain)),
            };
        }
        Fixture { rom, pins, blocos }
    }

    fn nunca() -> bool {
        false
    }

    const BASE: &[u8] = b"fixture-autoral-sem-rom-comercial";

    #[test]
    fn l7_seis_layouts_decodificados_agora_e_conferidos() {
        let f = fixture();
        let info =
            resumo_com_pins(BASE, &f.rom, "inspection-1-0", None, &f.pins, &nunca).expect("resumo");
        assert_eq!(info.formato, "layouts-info/v1");
        assert_eq!(info.representacao, "Mapa de IDs");
        assert_eq!(info.sessao_id, "inspection-1-0");
        assert_eq!(info.rom_sha256, sha256_hex(&f.rom));
        assert_eq!(info.layouts.len(), 6);
        for (i, l) in info.layouts.iter().enumerate() {
            let plain: Vec<u8> = (0..4096).map(|o| oraculo(&f.blocos[i], o)).collect();
            assert_eq!(
                l.saida_sha256,
                sha256_hex(&plain),
                "saída {i} calculada agora"
            );
            assert_eq!(l.bytes.saida_bytes, 4096);
            assert_eq!(l.bytes.bytes_lidos, f.pins[i].consumidos);
            assert_eq!(l.bytes.padding_alinhamento, l.bytes.bytes_lidos % 2);
            assert_eq!(
                l.bytes.tamanho_armazenado,
                l.bytes.bytes_lidos + l.bytes.padding_alinhamento
            );
            assert_eq!(l.integridade, "confere", "layout {i}");
            assert_eq!(
                l.stream_offset_hex,
                format!("{:#x}", cons::STREAM_OFFSETS[i])
            );
            assert_eq!(l.tabela_slot_hex, format!("{:#x}", 0x1B64C + i * 4));
        }
        assert!(!info.rom_confere_pin, "fixture autoral não é a ROM pinada");
        // a camada 3 nunca é rotulada como nametable/tabela de tiles do VDP
        let t: String = info.camadas.iter().map(|c| c.texto.clone()).collect();
        assert!(t.contains("Isto não é a tabela de tiles do vídeo"));
    }

    #[test]
    fn l7_referencia_historica_nao_vira_decode_realizado() {
        let f = fixture();
        // com os pins REAIS, a fixture decodifica (saída calculada agora) mas
        // diverge da referência histórica: nada é "confere" por tabela.
        let info = resumo(BASE, &f.rom, "s-1", None, &nunca).expect("resumo");
        for l in &info.layouts {
            assert_eq!(l.integridade, "diverge-da-referencia");
            assert!(!l.referencia.confere && !l.span_confere_pin);
            assert!(l.referencia.natureza.contains("histórica"));
            assert_ne!(l.saida_sha256, l.referencia.plain_sha256);
            assert_eq!(l.bytes.saida_bytes, 4096);
        }
    }

    #[test]
    fn l7_celulas_fronteiras_stride_e_correspondencia_byte() {
        let f = fixture();
        let esp = sha256_hex(&f.rom);
        let c = |l, r, k| celula_com_pins(BASE, &f.rom, "s-1", &esp, l, r, k, &f.pins, &nunca);
        for (linha, col, off, ram) in [
            (0usize, 0usize, 0usize, 0xFF1020usize),
            (0, 63, 63, 0xFF105F),
            (1, 0, 64, 0xFF10A0),
            (63, 63, 4095, 0xFF2FDF),
            (31, 32, 31 * 64 + 32, 0xFF1020 + 31 * 128 + 32),
        ] {
            let cel = c(2, linha, col).expect("célula");
            assert_eq!(cel.origem.saida_offset, off);
            assert_eq!(cel.origem.endereco_ram_hex, format!("{ram:x}"));
            assert_eq!(cel.id, oraculo(&f.blocos[2], off), "({linha},{col})");
            assert_eq!(cel.origem.palavra_indice, off / 2);
            assert_eq!(
                cel.origem.byte_na_palavra,
                if off % 2 == 0 { "alto" } else { "baixo" }
            );
        }
        // a grade inteira bate byte a byte com o oráculo, nos 6 layouts
        for i in 0..LAYOUTS {
            let g = grade_com_pins(BASE, &f.rom, "s-1", &esp, i, &f.pins, &nunca).expect("grade");
            assert_eq!(g.ids_hex.len(), 8192);
            assert_eq!((g.linhas, g.colunas), (64, 64));
            for o in 0..4096 {
                let b = u8::from_str_radix(&g.ids_hex[o * 2..o * 2 + 2], 16).unwrap();
                assert_eq!(b, oraculo(&f.blocos[i], o), "layout {i} byte {o}");
            }
        }
        // amostra de células via comando de célula == grade
        for o in (0..4096).step_by(97) {
            let cel = c(0, o / 64, o % 64).unwrap();
            assert_eq!(cel.id, oraculo(&f.blocos[0], o));
        }
    }

    #[test]
    fn l7_definicao_estrutural_so_quando_comprovada() {
        let f = fixture();
        // IDs 0, 1, 78 e 79 aparecem nos 8 primeiros blocos (j%8 = 0,1,2,3), byte lo.
        let esp = sha256_hex(&f.rom);
        let por_id = |alvo: u8| -> LayoutCelula {
            for o in (1..4096).step_by(2) {
                if oraculo(&f.blocos[0], o) == alvo {
                    return celula_com_pins(
                        BASE,
                        &f.rom,
                        "s-1",
                        &esp,
                        0,
                        o / 64,
                        o % 64,
                        &f.pins,
                        &nunca,
                    )
                    .unwrap();
                }
            }
            panic!("id {alvo} ausente");
        };
        let z = por_id(0);
        assert_eq!(z.definicao_status, "id-zero");
        assert!(z.definicao.is_none());
        let um = por_id(1);
        assert_eq!(um.definicao_status, "comprovada");
        let d = um.definicao.unwrap();
        assert_eq!(d.registro_endereco_hex, "0x1b738");
        assert_eq!(d.registro_hex, cons::MAPINDEX_ID01_ESPERADO);
        assert_eq!(d.ponteiro_mapeamentos_hex, "0x2c564");
        assert_eq!(d.campo_hex, "0x0142");
        assert_eq!(d.slot_ram_hex, "ff4008");
        assert_eq!(d.nivel, "vinculo-estrutural-estatico");
        assert!(!d.nao_decodificado.is_empty());
        let ult = por_id(78);
        assert_eq!(
            ult.definicao.unwrap().registro_endereco_hex,
            format!("{:#x}", 0x1B738 + 77 * 6)
        );
        let fora = por_id(79);
        assert_eq!(fora.definicao_status, "fora-da-tabela");
        assert!(fora.definicao.is_none());
        assert!(fora
            .definicao_explicacao
            .contains("nenhuma definição estrutural"));
    }

    #[test]
    fn l8_recusas_de_parametros_e_identidade() {
        let f = fixture();
        let esp = sha256_hex(&f.rom);
        let e = |r: Result<LayoutCelula, String>| r.expect_err("deve recusar");
        assert!(e(celula_com_pins(
            BASE, &f.rom, "s", &esp, 6, 0, 0, &f.pins, &nunca
        ))
        .starts_with("layouts_indice_invalido"));
        assert!(e(celula_com_pins(
            BASE,
            &f.rom,
            "s",
            &esp,
            usize::MAX,
            0,
            0,
            &f.pins,
            &nunca
        ))
        .starts_with("layouts_indice_invalido"));
        assert!(e(celula_com_pins(
            BASE, &f.rom, "s", &esp, 0, 64, 0, &f.pins, &nunca
        ))
        .starts_with("layouts_celula_fora_da_grade"));
        assert!(e(celula_com_pins(
            BASE, &f.rom, "s", &esp, 0, 0, 64, &f.pins, &nunca
        ))
        .starts_with("layouts_celula_fora_da_grade"));
        assert!(e(celula_com_pins(
            BASE,
            &f.rom,
            "s",
            &esp,
            0,
            usize::MAX,
            0,
            &f.pins,
            &nunca
        ))
        .starts_with("layouts_celula_fora_da_grade"));
        // resposta antiga: SHA esperado pertence a outra ROM
        let outra = "0".repeat(64);
        assert!(e(celula_com_pins(
            BASE, &f.rom, "s", &outra, 0, 0, 0, &f.pins, &nunca
        ))
        .starts_with("layouts_rom_mudou"));
        assert!(
            grade_com_pins(BASE, &f.rom, "s", &outra, 0, &f.pins, &nunca)
                .unwrap_err()
                .starts_with("layouts_rom_mudou")
        );
        assert!(
            resumo_com_pins(BASE, &f.rom, "s", Some(&outra), &f.pins, &nunca)
                .unwrap_err()
                .starts_with("layouts_rom_mudou")
        );
        // mudar um byte fora dos streams muda a identidade ⇒ o SHA antigo é recusado
        let mut r2 = f.rom.clone();
        r2[0x100] ^= 1;
        assert!(resumo_com_pins(BASE, &r2, "s", Some(&esp), &f.pins, &nunca)
            .unwrap_err()
            .starts_with("layouts_rom_mudou"));
        assert!(resumo_com_pins(BASE, &r2, "s", Some(&sha256_hex(&r2)), &f.pins, &nunca).is_ok());
    }

    #[test]
    fn l8_rom_incompativel_e_cadeia_adulterada_sao_recusadas() {
        let f = fixture();
        let zeros = vec![0u8; 0x67000];
        let e = resumo_com_pins(BASE, &zeros, "s", None, &f.pins, &nunca).unwrap_err();
        assert!(e.starts_with("consumers_sitios_divergentes"), "{e}");
        let curta = vec![0u8; 0x1000];
        let e = resumo_com_pins(BASE, &curta, "s", None, &f.pins, &nunca).unwrap_err();
        assert!(e.starts_with("consumers_fora_da_rom"), "{e}");
        let mut r = f.rom.clone();
        r[0x1B6F8..0x1B6FA].copy_from_slice(&[0x32, 0xd8]);
        let e = resumo_com_pins(BASE, &r, "s", None, &f.pins, &nunca).unwrap_err();
        assert!(e.starts_with("consumers_sitios_divergentes"), "{e}");
    }

    #[test]
    fn l8_stream_truncada_adulterada_e_limites_do_decode() {
        let f = fixture();
        let p = f.pins[5];
        // truncada: a ROM acaba no meio do stream
        let cortada = &f.rom[..p.offset + 100];
        let e = decodificar(cortada, &p, &nunca).unwrap_err();
        assert!(
            e.starts_with("layouts_decode") && e.contains("truncated"),
            "{e}"
        );
        // adulterada no cabeçalho: packet_length reservado
        let mut r = f.rom.clone();
        r[p.offset] = 12;
        let e = decodificar(&r, &p, &nunca).unwrap_err();
        assert!(e.contains("malformed-header"), "{e}");
        // adulterada no meio: ou erro estruturado ou saída diferente (nunca igual)
        let mut r = f.rom.clone();
        r[p.offset + 40] ^= 0xFF;
        match decodificar(&r, &p, &nunca) {
            Ok(d) => {
                let plain: Vec<u8> = (0..4096).map(|o| oraculo(&f.blocos[5], o)).collect();
                assert!(d.ids != plain || d.stats.bytes_lidos != p.consumidos);
            }
            Err(e) => assert!(
                e.starts_with("layouts_decode") || e.starts_with("layouts_saida"),
                "{e}"
            ),
        }
        let info = resumo_com_pins(BASE, &r, "s", None, &f.pins, &nunca);
        if let Ok(i) = info {
            assert_eq!(i.layouts[5].integridade, "diverge-da-referencia");
        }
        // saída maior que a grade: 2049 palavras ⇒ excessive-output; menor ⇒ tamanho
        let mut b = Bits {
            bytes: Vec::new(),
            n: 0,
        };
        for _ in 0..129 {
            b.put(0b1_00_1111, 7);
            b.put(0, 16);
        }
        b.put(0x7F, 7);
        let mut grande = vec![11u8, 0x1F, 0, 0, 0, 0];
        grande.extend(b.bytes);
        let mut rom = vec![0u8; 0x1000];
        rom[0x100..0x100 + grande.len()].copy_from_slice(&grande);
        let pin = PinLayout {
            offset: 0x100,
            consumidos: 0,
            span_sha256: "",
            plain_sha256: "",
        };
        let e = decodificar(&rom, &pin, &nunca).unwrap_err();
        assert!(e.contains("excessive-output"), "{e}");
        let mut b = Bits {
            bytes: Vec::new(),
            n: 0,
        };
        for _ in 0..127 {
            b.put(0b1_00_1111, 7);
            b.put(0, 16);
        }
        b.put(0x7F, 7);
        let mut pequeno = vec![11u8, 0x1F, 0, 0, 0, 0];
        pequeno.extend(b.bytes);
        rom[0x100..0x100 + pequeno.len()].copy_from_slice(&pequeno);
        let e = decodificar(&rom, &pin, &nunca).unwrap_err();
        assert!(e.starts_with("layouts_saida_tamanho"), "{e}");
        // stream fora da ROM
        let pin2 = PinLayout {
            offset: 0x2000,
            ..pin
        };
        assert!(decodificar(&rom, &pin2, &nunca)
            .unwrap_err()
            .starts_with("layouts_fora_da_rom"));
    }

    #[test]
    fn l8_padding_usa_a_paridade_do_endereco_real() {
        let f = fixture();
        let p = f.pins[1];
        let stream = f.rom[p.offset..p.offset + p.consumidos].to_vec();
        let mut rom = vec![0u8; 0x1000];
        for (off, esperado_par) in [(0x100usize, 0usize), (0x101, 1)] {
            rom.iter_mut().for_each(|b| *b = 0);
            rom[off..off + stream.len()].copy_from_slice(&stream);
            let pin = PinLayout { offset: off, ..p };
            let d = decodificar(&rom, &pin, &nunca).unwrap();
            assert_eq!(d.stats.bytes_lidos, stream.len());
            assert_eq!(
                d.stats.padding_console,
                (off + stream.len()) % 2,
                "off {off:#x}"
            );
            assert_eq!(
                d.stats.bytes_armazenados % 2 == 0,
                (off + d.stats.bytes_armazenados) % 2 == off % 2
            );
            let _ = esperado_par;
        }
    }

    #[test]
    fn l8_cancelamento_e_request_id() {
        let f = fixture();
        let sim = || true;
        let e = resumo_com_pins(BASE, &f.rom, "s", None, &f.pins, &sim).unwrap_err();
        assert!(e.starts_with("cancelled"), "{e}");
        // cancelamento no meio do decode (núcleo): 3º token
        let cont = std::cell::Cell::new(0);
        let meio = || {
            cont.set(cont.get() + 1);
            cont.get() > 3
        };
        let e = decodificar(&f.rom, &f.pins[0], &meio).unwrap_err();
        assert!(e.starts_with("cancelled"), "{e}");
        // registro de tokens
        let t = TokenCancel::novo(Some("req-abc-1")).unwrap();
        assert!(!t.cancelado());
        assert_eq!(cancelar("req-abc-1"), Ok(true));
        assert!(t.cancelado());
        assert_eq!(cancelar("req-inexistente"), Ok(false));
        drop(t);
        assert_eq!(cancelar("req-abc-1"), Ok(false), "guard remove no drop");
        for ruim in ["", "A", "a b", "a/b", &"x".repeat(65), "..", "é"] {
            assert!(
                validar_request_id(ruim)
                    .unwrap_err()
                    .starts_with("layouts_parametro_invalido"),
                "{ruim:?}"
            );
            assert!(TokenCancel::novo(Some(ruim)).is_err());
        }
        assert!(validar_request_id(&"x".repeat(64)).is_ok());
    }

    #[test]
    fn l7_somente_leitura() {
        let f = fixture();
        let antes = f.rom.clone();
        let esp = sha256_hex(&f.rom);
        let _ = resumo_com_pins(BASE, &f.rom, "s", None, &f.pins, &nunca).unwrap();
        let _ = grade_com_pins(BASE, &f.rom, "s", &esp, 3, &f.pins, &nunca).unwrap();
        let _ = celula_com_pins(BASE, &f.rom, "s", &esp, 3, 5, 6, &f.pins, &nunca).unwrap();
        assert_eq!(f.rom, antes);
    }

    #[test]
    fn l6_nomenclatura_vdp_dados_c00000_controle_c00004() {
        assert_eq!(cons::VDP_PORTA_DADOS, 0xC00000);
        assert_eq!(cons::VDP_PORTA_CONTROLE, 0xC00004);
        assert!(cons::MOTIVOS_FALSO_LIDER[1].contains("$C00000"));
        assert!(cons::MOTIVOS_FALSO_LIDER[1].contains("controle em $C00004"));
    }

    // Aceite REAL (BYOR): a ROM pinada precisa existir; ausência NÃO é PASS.
    #[test]
    #[ignore = "BYOR: exige REX_SONIC_ROM apontando para a ROM pinada c7da53a1…; ausente = não executado"]
    fn byor_seis_layouts_reais_na_rom_pinada() {
        let caminho = std::env::var("REX_SONIC_ROM")
            .expect("BYOR ausente: defina REX_SONIC_ROM (não é PASS)");
        let rom = std::fs::read(&caminho).expect("ler ROM BYOR");
        assert_eq!(sha256_hex(&rom), cons::ROM_PIN_SHA256, "ROM não é a pinada");
        let info = resumo(&rom, &rom, "s", None, &nunca).expect("resumo real");
        assert!(info.rom_confere_pin);
        let consumo = [634usize, 1042, 860, 1242, 1233, 784];
        let pad = [0usize, 0, 0, 0, 1, 0];
        for (i, l) in info.layouts.iter().enumerate() {
            assert_eq!(l.integridade, "confere", "layout {i}");
            assert_eq!(l.bytes.bytes_lidos, consumo[i]);
            assert_eq!(l.bytes.padding_alinhamento, pad[i]);
            assert_eq!(l.bytes.tamanho_armazenado, consumo[i] + pad[i]);
            assert_eq!(l.bytes.saida_bytes, 4096);
            assert_eq!(l.saida_sha256, cons::PLAIN_REF_SHA[i]);
        }
    }
}
