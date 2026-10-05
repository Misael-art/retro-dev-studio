//! Inspeção SOMENTE-LEITURA da cadeia de consumidores e recursos do Sonic 1
//! (fases especiais), congelada em
//! `docs/rex_profiles/integration_20261005/EXPECTATIONS-INSP-2026-10-05.md`.
//!
//! Todo o domínio (endereços, bytes esperados, pins, recusas) vive aqui;
//! `inspection.rs` só faz a ponte de sessão e a UI só renderiza. Nada neste
//! módulo escreve bytes: a assinatura recebe `&[u8]` emprestado e o veredito
//! é calculado do conteúdo real da ROM da sessão.
//!
//! Proveniência dos números: frente B (PR #105 @ `08024d9`), cadeia
//! reexecutada pelo integrador na ROM pinada `c7da53a1…` em 2026-10-05
//! (veredito `PROMOVIDO (evidencia completa)`, JSON idêntico ao versionado
//! exceto timestamp). O decoder Enigma referenciado é EXTERNO e pinado por
//! SHA; ele declara não poder entrar no produto (derivado de leitura do
//! `enigma.cc` LGPL da mdcomp) — por isso o nível "recurso" alega apenas
//! identidade + integridade, nunca decodificação interna.

use serde::{Deserialize, Serialize};

use super::rom_library::sha256_hex;

pub const PERFIL_ID: &str = "sonic1_fase_especial_layouts_v1";
pub const PERFIL_ROTULO: &str =
    "Sonic 1 (EUA/Europa) — blocos das fases especiais (medição estática, Experimental)";
pub const IDIOMA: &str = "pt-BR";

pub const ROM_PIN_SHA256: &str = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb";
pub const ROM_PIN_TAMANHO: usize = 531577;

pub const TABELA_ADDR: usize = 0x1B64C;
pub const STREAM_OFFSETS: [usize; 6] = [0x65432, 0x656AC, 0x65ABE, 0x65E1A, 0x662F4, 0x667C6];
pub const STREAM_CONSUMIDOS: [usize; 6] = [634, 1042, 860, 1242, 1233, 784];
/// SHA-256 do span de cada stream, medido diretamente na ROM pinada
/// (leitura, 2026-10-05). Integridade do recurso verificada ao vivo.
pub const SPAN_PINS: [&str; 6] = [
    "dc1a0a6ee0c3d2f6b52b7393dec9ae6ad41fc8831a0176b1467f484167d39853",
    "4015dccb21c86ee98a3a8e6cf2dcccfea5d0cb046f8981bad59dfa0b88d3db7a",
    "6b8467c2b0cb5c07d5bb2a4865af4b754e3eebe9aeb32ce2c9d44d5c5a58f232",
    "8996ca4fe2bda84806faccfa5d9d98723191a9331165f67fa14c02021dcb5929",
    "6981fbd8f38881246faad30727a3632111c7484e03d9ce9fda021a8597641672",
    "daf1a80e13a9b0712cb692a27de7771453855951e07ee9e7dab402a59621ae93",
];
/// SHA-256 do plain de 4096 bytes medido pelo decoder externo pinado
/// (referência estática; o app NÃO decodifica Enigma nesta rodada).
pub const PLAIN_REF_SHA: [&str; 6] = [
    "322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0",
    "4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d",
    "3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954",
    "04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7",
    "5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8",
    "78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94",
];

pub const LINHAS: usize = 64;
pub const COLUNAS: usize = 64;
pub const STRIDE: usize = 128;
pub const CELULA_BYTES: usize = 1;
pub const OUTPUT_SIZE: usize = 4096;
pub const BASE_LAYOUT: usize = 0xFF1020;
pub const BASE_DECOMPRESSAO: usize = 0xFF4000;
pub const WRAM_INICIO: usize = 0xFF0000;
pub const WRAM_FIM: usize = 0xFFFFFF;
pub const VDP_PORTA_DADOS: usize = 0xC00004;

pub const MAPINDEX_ADDR: usize = 0x1B738;
pub const MAPINDEX_ENTRADAS: usize = 78;
pub const MAPINDEX_ENTRADA_BYTES: usize = 6;
pub const MAPINDEX_ID01_ESPERADO: &str = "0002c5640142";
pub const MAPINDEX_PTR_ID01: usize = 0x2C564;

pub const PROVA_CADEIA_SHA256: &str =
    "d32236c7e77c4902eaf6c84d1e06237c3a369036d67c9c4df9734789c3139d92";
pub const DECODER_EXTERNO_SHA256: &str =
    "a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2";
pub const ORIGEM_MEDICAO: &str =
    "frente B (PR #105) reexecutada pelo integrador na ROM pinada em 2026-10-05";

/// Um sítio byte-a-byte da cadeia medida. `papel` é classe técnica; a frase
/// em português simples é derivada do papel na UI (nunca o contrário).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SitioDef {
    pub endereco: usize,
    pub esperado_hex: &'static str,
    pub papel: &'static str,
}

pub const SITIOS: [SitioDef; 37] = [
    SitioDef {
        endereco: 0x1B646,
        esperado_hex: "4b4c4d4e",
        papel: "contexto",
    },
    SitioDef {
        endereco: 0x1B64C,
        esperado_hex: "00065432",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B650,
        esperado_hex: "000656ac",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B654,
        esperado_hex: "00065abe",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B658,
        esperado_hex: "00065e1a",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B65C,
        esperado_hex: "000662f4",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B660,
        esperado_hex: "000667c6",
        papel: "tabela",
    },
    SitioDef {
        endereco: 0x1B6B6,
        esperado_hex: "e548",
        papel: "indexacao",
    },
    SitioDef {
        endereco: 0x1B6C4,
        esperado_hex: "207b0086",
        papel: "tabela->entrada",
    },
    SitioDef {
        endereco: 0x1B6C8,
        esperado_hex: "43f900ff4000",
        papel: "destino",
    },
    SitioDef {
        endereco: 0x1B6CE,
        esperado_hex: "303c0000",
        papel: "parametro",
    },
    SitioDef {
        endereco: 0x1B6D2,
        esperado_hex: "4eb90000171e",
        papel: "chamada",
    },
    SitioDef {
        endereco: 0x1B6D8,
        esperado_hex: "43f900ff0000",
        papel: "limpar buffer",
    },
    SitioDef {
        endereco: 0x1B6DE,
        esperado_hex: "303c0fff",
        papel: "limpar buffer",
    },
    SitioDef {
        endereco: 0x1B6E2,
        esperado_hex: "4299",
        papel: "limpar buffer",
    },
    SitioDef {
        endereco: 0x1B6E4,
        esperado_hex: "51c8fffc",
        papel: "limpar buffer",
    },
    SitioDef {
        endereco: 0x1B6E8,
        esperado_hex: "43f900ff1020",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6EE,
        esperado_hex: "41f900ff4000",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6F4,
        esperado_hex: "723f",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6F6,
        esperado_hex: "743f",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6F8,
        esperado_hex: "12d8",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6FA,
        esperado_hex: "51cafffc",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B6FE,
        esperado_hex: "43e90040",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B702,
        esperado_hex: "51c9fff2",
        papel: "consumidor",
    },
    SitioDef {
        endereco: 0x1B706,
        esperado_hex: "43f900ff4008",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B70C,
        esperado_hex: "41f90001b738",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B712,
        esperado_hex: "724d",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B714,
        esperado_hex: "22d8",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B716,
        esperado_hex: "32fc0000",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B71A,
        esperado_hex: "1368fffcffff",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B720,
        esperado_hex: "32d8",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B722,
        esperado_hex: "51c9fff0",
        papel: "id->definicao",
    },
    SitioDef {
        endereco: 0x1B726,
        esperado_hex: "43f900ff4400",
        papel: "contexto",
    },
    SitioDef {
        endereco: 0x1B72C,
        esperado_hex: "323c003f",
        papel: "contexto",
    },
    SitioDef {
        endereco: 0x1B730,
        esperado_hex: "4299",
        papel: "contexto",
    },
    SitioDef {
        endereco: 0x1B732,
        esperado_hex: "51c9fffc",
        papel: "contexto",
    },
    SitioDef {
        endereco: 0x1B736,
        esperado_hex: "4e75",
        papel: "contexto",
    },
];

pub const MOTIVOS_FALSO_LIDER: [&str; 3] = [
    "a copia usa byte por byte (move.b medido em 0x1B6F8); um par de bytes nao forma uma celula de 16 bits",
    "o destino medido e $FF4000, que e RAM interna; a porta do video e $C00004 — nenhum acesso a ela nestes sitios",
    "a cada linha o programa salta 64 bytes (lea 64(a1) em 0x1B6FE); o modelo antigo nao tem esse vao",
];

pub const MODELO_FALSO_LIDER: &str = "nametable-64x32-palavras-vdp";

pub const DESCONHECIDOS: [&str; 5] = [
    "A imagem destas fases ainda não foi comprovada: saber onde o dado vai e o que ele significa não prova como o console desenha aquilo.",
    "Nenhum trecho do jogo foi executado nesta análise: tudo foi lido dos bytes do arquivo.",
    "As cores (paleta) e os desenhos (art) referenciados pela tabela de IDs não foram reconstruídos nem conferidos.",
    "A decodificação Enigma dentro do app não está ativa: a ferramenta usada na medição é externa e sua licença impede copiar para o produto nesta rodada.",
    "Isto vale para o Sonic 1 (EUA/Europa) medido; outras versões podem ser diferentes e serão recusadas se os bytes não conferirem.",
];

fn err(code: &str, detail: impl Into<String>) -> String {
    format!("{code}: {}", detail.into())
}

fn hex_str(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn parse_hex(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err(err("consumers_hex_impar", s));
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16)
                .map_err(|e| err("consumers_hex_invalido", format!("{s}: {e}")))
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IdentidadeRom {
    pub rom_sha256: String,
    pub rom_tamanho: usize,
    pub confere_com_pin: bool,
    pub pin_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SitioVisto {
    pub endereco: String,
    pub papel: String,
    pub esperado_hex: String,
    pub obtido_hex: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntradaTabela {
    pub hex_entrada: String,
    pub offset_stream: String,
    pub lido_hex: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Cadeia {
    pub tabela_hex: String,
    pub entradas: Vec<EntradaTabela>,
    pub chamada_hex: String,
    pub destino_hex: String,
    pub destino_classe: String,
    pub valor_offset_param: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Recurso {
    pub indice: usize,
    pub offset_hex: String,
    pub span_bytes: usize,
    pub span_sha256: String,
    pub span_ok: bool,
    pub plain_sha256_referencia: String,
    pub plain_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Interpretacao {
    pub celula_bytes: usize,
    pub linhas: usize,
    pub colunas: usize,
    pub stride: usize,
    pub base_ram_hex: String,
    pub nivel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MapIndex {
    pub addr_hex: String,
    pub entradas: usize,
    pub registro_id01_hex: String,
    pub id01_ok: bool,
    pub ponteiro_id01_hex: String,
    pub ponteiro_dentro_rom: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecusaFalsoLider {
    pub modelo: String,
    pub veredito: String,
    pub motivos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LimitesFonte {
    pub prova_cadeia_sha256: String,
    pub decoder_externo_sha256: String,
    pub origem: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConsumersInfo {
    pub perfil_id: String,
    pub perfil_rotulo: String,
    pub idioma: String,
    pub identidade: IdentidadeRom,
    pub sitios: Vec<SitioVisto>,
    pub veredito_sitios: String,
    pub cadeia: Cadeia,
    pub recursos: Vec<Recurso>,
    pub interpretacao: Interpretacao,
    pub mapindex: MapIndex,
    pub recusa_falso_lider: RecusaFalsoLider,
    pub desconhecidos: Vec<String>,
    pub limites_fonte: LimitesFonte,
}

/// A geometria que os bytes do consumidor proveem; qualquer outra é recusada
/// com motivo (regra do produto, sem importar o crate da frente C).
pub fn validar_geometria(linhas: usize, colunas: usize, stride: usize) -> Result<(), String> {
    if (linhas, colunas, stride) != (LINHAS, COLUNAS, STRIDE) {
        return Err(err(
            "consumers_geometria_errada",
            format!(
                "consumidor prova grade {LINHAS}x{COLUNAS} de {CELULA_BYTES} byte com stride {STRIDE}; grade pedida {linhas}x{colunas} stride {stride} recusada"
            ),
        ));
    }
    Ok(())
}

/// Read-only inspection of this session's ROM against the measured Sonic 1
/// special-stage consumer chain. Refuses the whole chain when any pinned
/// site diverges — never a silent partial pass.
pub fn describe(_base: &[u8], rom: &[u8]) -> Result<ConsumersInfo, String> {
    // Fronteira 1: tudo o que a cadeia alega medir precisa caber na ROM lida.
    let mut fora: Vec<String> = Vec::new();
    for s in SITIOS.iter() {
        let n = s.esperado_hex.len() / 2;
        if s.endereco + n > rom.len() {
            fora.push(format!("sitio 0x{:x} ({}B)", s.endereco, n));
        }
    }
    let mapindex_fim = MAPINDEX_ADDR + MAPINDEX_ENTRADAS * MAPINDEX_ENTRADA_BYTES;
    if mapindex_fim > rom.len() {
        fora.push(format!(
            "ss_mapindex 0x{:x}..0x{:x}",
            MAPINDEX_ADDR, mapindex_fim
        ));
    }
    for (i, off) in STREAM_OFFSETS.iter().enumerate() {
        if off + STREAM_CONSUMIDOS[i] > rom.len() {
            fora.push(format!(
                "stream {i} 0x{off:x}..0x{:x}",
                off + STREAM_CONSUMIDOS[i]
            ));
        }
    }
    if !fora.is_empty() {
        return Err(err(
            "consumers_fora_da_rom",
            format!(
                "rom tem {} bytes; fora da ROM: {}",
                rom.len(),
                fora.join("; ")
            ),
        ));
    }

    // Fronteira 2: os 37 sítios byte a byte. Qualquer divergência recusa a
    // cadeia inteira (EXPECTATIONS-INSP §1: nunca "ok" parcial silencioso).
    let mut sitios: Vec<SitioVisto> = Vec::with_capacity(SITIOS.len());
    let mut divergentes: Vec<String> = Vec::new();
    for s in SITIOS.iter() {
        let esperado = parse_hex(s.esperado_hex)?;
        let fim = s.endereco + esperado.len();
        let obtido = &rom[s.endereco..fim];
        let ok = obtido == esperado.as_slice();
        if !ok {
            divergentes.push(format!(
                "0x{:x} esperado {} obtido {}",
                s.endereco,
                hex_str(&esperado),
                hex_str(obtido)
            ));
        }
        sitios.push(SitioVisto {
            endereco: format!("0x{:x}", s.endereco),
            papel: s.papel.to_string(),
            esperado_hex: s.esperado_hex.to_string(),
            obtido_hex: hex_str(obtido),
            ok,
        });
    }
    if !divergentes.is_empty() {
        return Err(err(
            "consumers_sitios_divergentes",
            format!(
                "{}/{} sitios divergem; cadeia, recursos e interpretacao recusados: [{}]",
                divergentes.len(),
                SITIOS.len(),
                divergentes.join("; ")
            ),
        ));
    }

    // Fronteira 3: SS_MapIndex — registro do ID $01 e ponteiro, lidos ao vivo.
    let registro = &rom[MAPINDEX_ADDR..MAPINDEX_ADDR + 6];
    let id01_ok = hex_str(registro) == MAPINDEX_ID01_ESPERADO;
    let ptr = u32::from_be_bytes([0, registro[1], registro[2], registro[3]]);
    let ponteiro_dentro_rom = ptr as usize >= 0x200 && (ptr as usize) < rom.len();
    if !id01_ok || ptr as usize != MAPINDEX_PTR_ID01 || !ponteiro_dentro_rom {
        return Err(err(
            "consumers_mapindex_divergente",
            format!(
                "0x{:x}: registro esperado {} obtido {}; ponteiro {:#x} (esperado {:#x})",
                MAPINDEX_ADDR,
                MAPINDEX_ID01_ESPERADO,
                hex_str(registro),
                ptr,
                MAPINDEX_PTR_ID01
            ),
        ));
    }

    // Nível 4 (vínculo estrutural): tabela relida ao vivo, cabeçalhos dos
    // streams lidos nos offsets provados, destino e parâmetro conferidos.
    let mut entradas = Vec::with_capacity(6);
    for (i, &off) in STREAM_OFFSETS.iter().enumerate() {
        let slot = TABELA_ADDR + i * 4;
        let lido = &rom[slot..slot + 4];
        let valor = u32::from_be_bytes([lido[0], lido[1], lido[2], lido[3]]);
        entradas.push(EntradaTabela {
            hex_entrada: hex_str(lido),
            offset_stream: format!("{:#x}", valor),
            lido_hex: hex_str(&rom[off..off + 6]),
            ok: valor as usize == off,
        });
    }
    let destino = u32::from_be_bytes([rom[0x1B6CA], rom[0x1B6CB], rom[0x1B6CC], rom[0x1B6CD]]);
    let destino_classe = if (WRAM_INICIO as u32..=WRAM_FIM as u32).contains(&destino) {
        "wram"
    } else {
        "outra"
    };

    // Nível 5 (identidade + integridade): SHA do span calculado DA ROM
    // carregada, conferido contra os pins medidos em 2026-10-05.
    let recursos: Vec<Recurso> = (0..6)
        .map(|i| {
            let ini = STREAM_OFFSETS[i];
            let span = &rom[ini..ini + STREAM_CONSUMIDOS[i]];
            let sha = sha256_hex(span);
            Recurso {
                indice: i,
                offset_hex: format!("{:#x}", ini),
                span_bytes: STREAM_CONSUMIDOS[i],
                span_sha256: sha.clone(),
                span_ok: sha == SPAN_PINS[i],
                plain_sha256_referencia: PLAIN_REF_SHA[i].to_string(),
                plain_status: "medido-externo".to_string(),
            }
        })
        .collect();

    let rom_sha = sha256_hex(rom);
    Ok(ConsumersInfo {
        perfil_id: PERFIL_ID.to_string(),
        perfil_rotulo: PERFIL_ROTULO.to_string(),
        idioma: IDIOMA.to_string(),
        identidade: IdentidadeRom {
            rom_sha256: rom_sha.clone(),
            rom_tamanho: rom.len(),
            confere_com_pin: rom_sha == ROM_PIN_SHA256 && rom.len() == ROM_PIN_TAMANHO,
            pin_sha256: ROM_PIN_SHA256.to_string(),
        },
        sitios,
        veredito_sitios: "todos-ok".to_string(),
        cadeia: Cadeia {
            tabela_hex: format!("{:#x}", TABELA_ADDR),
            entradas,
            chamada_hex: hex_str(&rom[0x1B6D2..0x1B6D8]),
            destino_hex: format!("{:x}", destino & 0xFF_FFFF),
            destino_classe: destino_classe.to_string(),
            valor_offset_param: u16::from_be_bytes([rom[0x1B6D0], rom[0x1B6D1]]),
        },
        recursos,
        interpretacao: Interpretacao {
            celula_bytes: CELULA_BYTES,
            linhas: LINHAS,
            colunas: COLUNAS,
            stride: STRIDE,
            base_ram_hex: format!("{:x}", BASE_LAYOUT),
            nivel: "vinculo-estrutural-estatico".to_string(),
        },
        mapindex: MapIndex {
            addr_hex: format!("{:#x}", MAPINDEX_ADDR),
            entradas: MAPINDEX_ENTRADAS,
            registro_id01_hex: hex_str(registro),
            id01_ok,
            ponteiro_id01_hex: format!("{:#x}", ptr),
            ponteiro_dentro_rom,
        },
        recusa_falso_lider: RecusaFalsoLider {
            modelo: MODELO_FALSO_LIDER.to_string(),
            veredito: "REFUTADA".to_string(),
            motivos: MOTIVOS_FALSO_LIDER.iter().map(|s| s.to_string()).collect(),
        },
        desconhecidos: DESCONHECIDOS.iter().map(|s| s.to_string()).collect(),
        limites_fonte: LimitesFonte {
            prova_cadeia_sha256: PROVA_CADEIA_SHA256.to_string(),
            decoder_externo_sha256: DECODER_EXTERNO_SHA256.to_string(),
            origem: ORIGEM_MEDICAO.to_string(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hx(s: &str) -> Vec<u8> {
        parse_hex(s).unwrap()
    }

    /// Fixture autoral: ROM esparsa com os bytes pinados nos endereços
    /// corretos + mapa SS_MapIndex sintético + streams com padrão determinístico
    /// (NUNCA conteúdo real de ROM comercial).
    fn rom_medida(tam: usize) -> Vec<u8> {
        let mut rom = vec![0u8; tam];
        for s in SITIOS.iter() {
            let bytes = hx(s.esperado_hex);
            rom[s.endereco..s.endereco + bytes.len()].copy_from_slice(&bytes);
        }
        // SS_MapIndex: registro do ID $01 pinado + 77 registros sintéticos com
        // ponteiro dentro da ROM.
        let id01 = hx(MAPINDEX_ID01_ESPERADO);
        rom[MAPINDEX_ADDR..MAPINDEX_ADDR + 6].copy_from_slice(&id01);
        for i in 1..MAPINDEX_ENTRADAS {
            let o = MAPINDEX_ADDR + i * MAPINDEX_ENTRADA_BYTES;
            if o + MAPINDEX_ENTRADA_BYTES > tam {
                break;
            }
            let ptr = (0x200 + i * 0x100) as u32;
            rom[o] = 0;
            rom[o + 1..o + 4].copy_from_slice(&ptr.to_be_bytes()[1..]);
            rom[o + 4] = (i >> 8) as u8;
            rom[o + 5] = i as u8;
        }
        // Streams: padrão autorais determinísticos (os span pins reais NÃO são
        // reproduzíveis aqui; a igualdade verde só acontece na ROM pinada, via E2E).
        for (i, off) in STREAM_OFFSETS.iter().enumerate() {
            let fim = off + STREAM_CONSUMIDOS[i];
            if fim > tam {
                continue;
            }
            for (j, b) in rom[*off..fim].iter_mut().enumerate() {
                *b = ((i * 31 + j * 7) % 251) as u8;
            }
        }
        rom
    }

    fn rom_base_fake() -> &'static [u8] {
        b"fixture-autoral-sem-rom-comercial"
    }

    // T1 — todos os 37 sítios conferem na fixture medida.
    #[test]
    fn t1_todos_os_sitios_conferem_na_fixture_medida() {
        let rom = rom_medida(0x67000);
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert_eq!(info.sitios.len(), 37);
        assert!(info.sitios.iter().all(|s| s.ok), "{:?}", info.sitios);
        assert_eq!(info.veredito_sitios, "todos-ok");
    }

    // T2 — inverter o operando da cópia (move.b → move.w) recusa a cadeia.
    #[test]
    fn t2_inverter_operando_da_copia_recusa_cadeia() {
        let mut rom = rom_medida(0x67000);
        rom[0x1B6F8..0x1B6FA].copy_from_slice(&[0x32, 0xd8]); // move.w (a0)+,(a1)+
        let e = describe(rom_base_fake(), &rom).expect_err("deve recusar");
        assert!(e.starts_with("consumers_sitios_divergentes"), "{e}");
        assert!(e.contains("0x1b6f8"), "{e}");
    }

    // T3 — ROM mais curta que os sítios é recusa explícita, sem "ok" silencioso.
    #[test]
    fn t3_rom_curta_recusa_por_fora_da_rom() {
        let rom = vec![0u8; 0x1B640];
        let e = describe(rom_base_fake(), &rom).expect_err("deve recusar");
        assert!(e.starts_with("consumers_fora_da_rom"), "{e}");
    }

    // T4 — trocar duas entradas da tabela é capturado no detalhe da recusa.
    #[test]
    fn t4_tabela_de_streams_e_relida_da_rom() {
        let mut rom = rom_medida(0x67000);
        let a = hx("00065abe");
        let b = hx("00065e1a");
        rom[0x1B654..0x1B658].copy_from_slice(&b);
        rom[0x1B658..0x1B65C].copy_from_slice(&a);
        let e = describe(rom_base_fake(), &rom).expect_err("deve recusar");
        assert!(e.starts_with("consumers_sitios_divergentes"), "{e}");
        assert!(e.contains("0x1b654") && e.contains("0x1b658"), "{e}");
    }

    // T5 — a SHA do span é calculada da ROM carregada; mexer dentro/fora
    // altera/não altera conforme o caso, e span_ok usa os pins medidos.
    #[test]
    fn t5_integridade_do_span_e_conferida() {
        let rom = rom_medida(0x67000);
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert_eq!(info.recursos.len(), 6);
        for (i, r) in info.recursos.iter().enumerate() {
            let esperado =
                sha256_hex(&rom[STREAM_OFFSETS[i]..STREAM_OFFSETS[i] + STREAM_CONSUMIDOS[i]]);
            assert_eq!(r.span_sha256, esperado, "span sha do stream {i}");
            assert_eq!(r.span_bytes, STREAM_CONSUMIDOS[i]);
            assert!(
                !r.span_ok,
                "fixture autoral não pode coincidir com pin real"
            );
            assert_eq!(r.plain_status, "medido-externo");
        }
        let mut mexido = rom.clone();
        let meio = STREAM_OFFSETS[0] + 300;
        mexido[meio] ^= 0xFF;
        let info2 = describe(rom_base_fake(), &mexido).expect("descrever");
        assert_ne!(info2.recursos[0].span_sha256, info.recursos[0].span_sha256);
        // fora do span não altera
        let mut fora = rom.clone();
        fora[STREAM_OFFSETS[1] - 1] ^= 0xFF;
        let info3 = describe(rom_base_fake(), &fora).expect("descrever");
        assert_eq!(info3.recursos[1].span_sha256, info.recursos[1].span_sha256);
    }

    // T6 — SS_MapIndex: registro do ID $01 e ponteiro conferidos ao vivo.
    #[test]
    fn t6_mapindex_id01_e_ponteiro_conferem() {
        let rom = rom_medida(0x67000);
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert!(info.mapindex.id01_ok);
        assert_eq!(info.mapindex.registro_id01_hex, MAPINDEX_ID01_ESPERADO);
        assert!(info.mapindex.ponteiro_dentro_rom);
        let mut adulterado = rom.clone();
        adulterado[MAPINDEX_ADDR + 3] ^= 0x01;
        let e = describe(rom_base_fake(), &adulterado).expect_err("deve recusar");
        assert!(e.starts_with("consumers_mapindex_divergente"), "{e}");
    }

    // T7 — falso líder refutado pelos bytes, com os 3 motivos congelados;
    // geometria divergente é recusada com motivo.
    #[test]
    fn t7_falso_lider_e_refutado_pelos_bytes() {
        let rom = rom_medida(0x67000);
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert_eq!(info.recusa_falso_lider.modelo, MODELO_FALSO_LIDER);
        assert_eq!(info.recusa_falso_lider.veredito, "REFUTADA");
        assert_eq!(
            info.recusa_falso_lider.motivos,
            MOTIVOS_FALSO_LIDER
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<_>>()
        );
        assert!(validar_geometria(64, 64, 128).is_ok());
        let e = validar_geometria(32, 64, 128).expect_err("recusa");
        assert!(e.starts_with("consumers_geometria_errada"), "{e}");
        let e2 = validar_geometria(64, 64, 64).expect_err("recusa");
        assert!(e2.contains("stride 64"), "{e2}");
    }

    // T8 — inspecionar não escreve: a ROM da sessão sai byte-idêntica.
    #[test]
    fn t8_inspecionar_nao_escreve() {
        let rom = rom_medida(0x67000);
        let antes = rom.clone();
        let _ = describe(rom_base_fake(), &rom);
        assert_eq!(rom, antes);
        // e o resultado reporta a identidade real daquela ROM
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert_eq!(info.identidade.rom_sha256, sha256_hex(&rom));
        assert_eq!(info.identidade.rom_tamanho, rom.len());
        assert!(
            !info.identidade.confere_com_pin,
            "fixture autoral não é o pin"
        );
        assert_eq!(info.identidade.pin_sha256, ROM_PIN_SHA256);
    }

    // T9 — valores fixos do contrato; nenhum nível é promovido.
    #[test]
    fn t9_valores_fixos_do_contrato() {
        let rom = rom_medida(0x67000);
        let info = describe(rom_base_fake(), &rom).expect("descrever");
        assert_eq!(info.cadeia.valor_offset_param, 0);
        assert_eq!(info.cadeia.destino_hex, "ff4000");
        assert_eq!(info.cadeia.destino_classe, "wram");
        assert_eq!(info.cadeia.tabela_hex, "0x1b64c");
        assert_eq!(info.interpretacao.celula_bytes, 1);
        assert_eq!(info.interpretacao.linhas, 64);
        assert_eq!(info.interpretacao.colunas, 64);
        assert_eq!(info.interpretacao.stride, 128);
        assert_eq!(info.interpretacao.base_ram_hex, "ff1020");
        assert_eq!(info.interpretacao.nivel, "vinculo-estrutural-estatico");
        assert_eq!(info.desconhecidos.len(), DESCONHECIDOS.len());
        assert_eq!(info.idioma, "pt-BR");
        assert_eq!(info.perfil_id, PERFIL_ID);
        assert_eq!(info.limites_fonte.prova_cadeia_sha256, PROVA_CADEIA_SHA256);
        assert_eq!(
            info.limites_fonte.decoder_externo_sha256,
            DECODER_EXTERNO_SHA256
        );
        assert_eq!(info.mapindex.entradas, MAPINDEX_ENTRADAS);
    }
}
