//! O contrato de cadea `rex-kosinski-chain/v1`.
//!
//! Unha cadea é un elo a elo do que pide a misión: identidade/mapper →
//! sitio de carga (bytes medidos) → argumentos → chamada (aritmética
//! comprobada) → rutina (hash medido) → stream → saída validada. Cada campo
//! é escalar ou lista de cadenas: nada anidado que poida agochar estado.
//!
//! Regras estruturais ([`Cadea::validar`]):
//! - `referencia-estatica` **prohibe** elos de chamada: se a hai, a cadea
//!   miente por defecto (herdado do gardafío `rex-corpus-resource/v2`);
//! - `vinculo-estrutural` **esixe** carga + chamada + rutina medidas;
//! - `observado-en-runtime` non se pode escribir aqui: esta fronte non executa;
//! - un enderezo declarado polo usuario fica marcado en `orixe` como
//!   `declarado-probado`: a ferramenta proba os bytes, **non descobre** o
//!   enderezo, e non o promove a `descoberto`.

use crate::json::{self, Valor};

pub const SCHEMA_CADEA: &str = "rex-kosinski-chain/v1";

/// Niveis de evidencia que a cadea pode afirmar (vocabulario herdado de
/// `rex-corpus-resource/v2`, ampliado co `candidato` medible).
pub const NIVEIS: [&str; 4] = [
    "candidato",
    "referencia-estatica",
    "vinculo-estrutural",
    "observado-en-runtime",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cadea {
    pub imaxe_sha256: String,
    pub mapper: String,
    pub estado_mapper: String,
    // --- sitio de carga (sempre presente: é a entrada declarada) ---
    pub carga_sitio: u32,
    pub carga_bytes: Vec<u8>,
    pub carga_forma: String,
    pub carga_operando: u32,
    // --- argumento de destino (opcional: mídese se hai forma) ---
    pub destino_sitio: Option<u32>,
    pub destino_bytes: Option<Vec<u8>>,
    pub destino_forma: Option<String>,
    pub destino_operando: Option<u32>,
    pub destino_rexion: Option<String>,
    // --- chamada (opcional: sen ela a cadea non pasa de referencia-estatica) ---
    pub chamada_sitio: Option<u32>,
    pub chamada_bytes: Option<Vec<u8>>,
    pub chamada_forma: Option<String>,
    pub chamada_alvo: Option<u32>,
    // --- rutina chamada (presente só se hai chamada) ---
    pub rutina_sitio: Option<u32>,
    pub rutina_lonxitude: Option<u64>,
    pub rutina_sha256: Option<String>,
    // --- stream e saída validada ---
    pub fluxo_cpu: u32,
    pub fluxo_offset: u64,
    pub tramo_entrada: u64,
    pub bytes_consumidos: u64,
    pub saida_bytes: u64,
    pub saida_sha256: String,
    // --- codec e límites ---
    pub codec: String,
    pub variante: String,
    pub limite_max_saida: u64,
    pub limite_orzamento: u64,
    // --- epistemoloxía ---
    pub confianza: String,
    pub limitacions: Vec<String>,
    /// Unha entrada `campo=orixe` por campo: `declarado-probado`, `medido`,
    /// `non-medido`. Nunca `descoberto` para un enderezo fornecido polo usuario.
    pub orixe: Vec<String>,
}

impl Cadea {
    /// Orde fixa de claves: dous JSONL coñecidos mesmos valores dean bytes
    /// idénticos (property da versión en hash, como nos rexistros v2).
    pub fn campos(&self) -> Vec<(String, Valor)> {
        let hexbytes = |v: &Option<Vec<u8>>| -> Valor {
            match v {
                Some(b) => Valor::Str(hex_maíus(b)),
                None => Valor::Null,
            }
        };
        let addr = |v: u32| Valor::Str(hex_enderezo(v));
        let opt_addr = |v: &Option<u32>| -> Valor {
            match v {
                Some(x) => Valor::Str(hex_enderezo(*x)),
                None => Valor::Null,
            }
        };
        let opt_str = |v: &Option<String>| -> Valor {
            match v {
                Some(s) => Valor::Str(s.clone()),
                None => Valor::Null,
            }
        };
        vec![
            ("schema_version".into(), Valor::Str(SCHEMA_CADEA.into())),
            ("imaxe_sha256".into(), Valor::Str(self.imaxe_sha256.clone())),
            ("mapper".into(), Valor::Str(self.mapper.clone())),
            (
                "estado_mapper".into(),
                Valor::Str(self.estado_mapper.clone()),
            ),
            ("carga_sitio".into(), addr(self.carga_sitio)),
            (
                "carga_bytes".into(),
                Valor::Str(hex_maíus(&self.carga_bytes)),
            ),
            ("carga_forma".into(), Valor::Str(self.carga_forma.clone())),
            ("carga_operando".into(), addr(self.carga_operando)),
            ("destino_sitio".into(), opt_addr(&self.destino_sitio)),
            ("destino_bytes".into(), hexbytes(&self.destino_bytes)),
            ("destino_forma".into(), opt_str(&self.destino_forma)),
            ("destino_operando".into(), opt_addr(&self.destino_operando)),
            ("destino_rexion".into(), opt_str(&self.destino_rexion)),
            ("chamada_sitio".into(), opt_addr(&self.chamada_sitio)),
            ("chamada_bytes".into(), hexbytes(&self.chamada_bytes)),
            ("chamada_forma".into(), opt_str(&self.chamada_forma)),
            ("chamada_alvo".into(), opt_addr(&self.chamada_alvo)),
            ("rutina_sitio".into(), opt_addr(&self.rutina_sitio)),
            (
                "rutina_lonxitude".into(),
                match self.rutina_lonxitude {
                    Some(n) => Valor::Int(n),
                    None => Valor::Null,
                },
            ),
            ("rutina_sha256".into(), opt_str(&self.rutina_sha256)),
            ("fluxo_cpu".into(), addr(self.fluxo_cpu)),
            ("fluxo_offset".into(), Valor::Int(self.fluxo_offset)),
            ("tramo_entrada".into(), Valor::Int(self.tramo_entrada)),
            ("bytes_consumidos".into(), Valor::Int(self.bytes_consumidos)),
            ("saida_bytes".into(), Valor::Int(self.saida_bytes)),
            ("saida_sha256".into(), Valor::Str(self.saida_sha256.clone())),
            ("codec".into(), Valor::Str(self.codec.clone())),
            ("variante".into(), Valor::Str(self.variante.clone())),
            ("limite_max_saida".into(), Valor::Int(self.limite_max_saida)),
            ("limite_orzamento".into(), Valor::Int(self.limite_orzamento)),
            ("confianza".into(), Valor::Str(self.confianza.clone())),
            ("limitacions".into(), Valor::Lista(self.limitacions.clone())),
            ("orixe".into(), Valor::Lista(self.orixe.clone())),
        ]
    }

    pub fn to_json(&self) -> String {
        json::render(&self.campos())
    }

    pub fn desde_campos(campos: Vec<(String, Valor)>) -> Result<Cadea, String> {
        let get =
            |k: &str| -> Option<&Valor> { campos.iter().find(|(n, _)| n == k).map(|(_, v)| v) };
        let cadea = |k: &str| -> Result<String, String> {
            get(k)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| format!("campo `{k}`: esperaba cadea"))
        };
        let opt_cadea = |k: &str| -> Result<Option<String>, String> {
            match get(k) {
                None => Ok(None),
                Some(Valor::Null) => Ok(None),
                Some(v) => v
                    .as_str()
                    .map(|s| Some(s.to_string()))
                    .ok_or_else(|| format!("campo `{k}`: esperaba cadea ou null")),
            }
        };
        let num = |k: &str| -> Result<u64, String> {
            get(k)
                .and_then(|v| v.as_uint())
                .ok_or_else(|| format!("campo `{k}`: esperaba enteiro"))
        };
        let addr = |k: &str| -> Result<u32, String> {
            let s = cadea(k)?;
            analizar_enderezo(&s).ok_or_else(|| format!("campo `{k}`: enderezo malformado: {s}"))
        };
        let opt_addr = |k: &str| -> Result<Option<u32>, String> {
            match opt_cadea(k)? {
                Some(s) => analizar_enderezo(&s)
                    .map(Some)
                    .ok_or_else(|| format!("campo `{k}`: enderezo malformado: {s}")),
                None => Ok(None),
            }
        };
        let bytes_hex = |k: &str| -> Result<Vec<u8>, String> {
            let s = cadea(k)?;
            analizar_hex_bytes(&s).ok_or_else(|| format!("campo `{k}`: hex malformado"))
        };
        let opt_bytes_hex = |k: &str| -> Result<Option<Vec<u8>>, String> {
            match opt_cadea(k)? {
                Some(s) => analizar_hex_bytes(&s)
                    .map(Some)
                    .ok_or_else(|| format!("campo `{k}`: hex malformado")),
                None => Ok(None),
            }
        };
        let lista = |k: &str| -> Result<Vec<String>, String> {
            match get(k) {
                None => Ok(Vec::new()),
                Some(v) => v
                    .as_lista()
                    .map(|l| l.to_vec())
                    .ok_or_else(|| format!("campo `{k}`: esperaba lista")),
            }
        };
        let opt_num = |k: &str| -> Result<Option<u64>, String> {
            match get(k) {
                None => Ok(None),
                Some(Valor::Null) => Ok(None),
                Some(v) => v
                    .as_uint()
                    .map(Some)
                    .ok_or_else(|| format!("campo `{k}`: esperaba enteiro ou null")),
            }
        };

        // Claves descoñecidas rexeitanse: un contrato plano non admite campos
        // extras que poidan contradicir os fixos.
        const COÑECIDAS: [&str; 33] = [
            "schema_version",
            "imaxe_sha256",
            "mapper",
            "estado_mapper",
            "carga_sitio",
            "carga_bytes",
            "carga_forma",
            "carga_operando",
            "destino_sitio",
            "destino_bytes",
            "destino_forma",
            "destino_operando",
            "destino_rexion",
            "chamada_sitio",
            "chamada_bytes",
            "chamada_forma",
            "chamada_alvo",
            "rutina_sitio",
            "rutina_lonxitude",
            "rutina_sha256",
            "fluxo_cpu",
            "fluxo_offset",
            "tramo_entrada",
            "bytes_consumidos",
            "saida_bytes",
            "saida_sha256",
            "codec",
            "variante",
            "limite_max_saida",
            "limite_orzamento",
            "confianza",
            "limitacions",
            "orixe",
        ];
        for (k, _) in &campos {
            if !COÑECIDAS.contains(&k.as_str()) {
                return Err(format!("campo descoñecido: {k}"));
            }
        }
        let esquema = get("schema_version").ok_or_else(|| "sen-esquema".to_string())?;
        if esquema.as_str() != Some(SCHEMA_CADEA) {
            return Err(format!(
                "esquema incorrecto: {}",
                esquema.as_str().unwrap_or("?")
            ));
        }

        Ok(Cadea {
            imaxe_sha256: cadea("imaxe_sha256")?,
            mapper: cadea("mapper")?,
            estado_mapper: cadea("estado_mapper")?,
            carga_sitio: addr("carga_sitio")?,
            carga_bytes: bytes_hex("carga_bytes")?,
            carga_forma: cadea("carga_forma")?,
            carga_operando: addr("carga_operando")?,
            destino_sitio: opt_addr("destino_sitio")?,
            destino_bytes: opt_bytes_hex("destino_bytes")?,
            destino_forma: opt_cadea("destino_forma")?,
            destino_operando: opt_addr("destino_operando")?,
            destino_rexion: opt_cadea("destino_rexion")?,
            chamada_sitio: opt_addr("chamada_sitio")?,
            chamada_bytes: opt_bytes_hex("chamada_bytes")?,
            chamada_forma: opt_cadea("chamada_forma")?,
            chamada_alvo: opt_addr("chamada_alvo")?,
            rutina_sitio: opt_addr("rutina_sitio")?,
            rutina_lonxitude: opt_num("rutina_lonxitude")?,
            rutina_sha256: opt_cadea("rutina_sha256")?,
            fluxo_cpu: addr("fluxo_cpu")?,
            fluxo_offset: num("fluxo_offset")?,
            tramo_entrada: num("tramo_entrada")?,
            bytes_consumidos: num("bytes_consumidos")?,
            saida_bytes: num("saida_bytes")?,
            saida_sha256: cadea("saida_sha256")?,
            codec: cadea("codec")?,
            variante: cadea("variante")?,
            limite_max_saida: num("limite_max_saida")?,
            limite_orzamento: num("limite_orzamento")?,
            confianza: cadea("confianza")?,
            limitacions: lista("limitacions")?,
            orixe: lista("orixe")?,
        })
    }

    pub fn desde_json(texto: &str) -> Result<Cadea, String> {
        let campos =
            json::interpretar(texto).map_err(|m| format!("{}: {}", m.codigo, m.detalle))?;
        Cadea::desde_campos(campos)
    }

    /// Coherencia entre o afirmado e o estrutura (non mide a imaxe: iso e
    /// [`crate::verify`]).
    pub fn validar(&self) -> Result<(), String> {
        if !NIVEIS.contains(&self.confianza.as_str()) {
            return Err(format!("confianza descoñecida: {}", self.confianza));
        }
        if self.confianza == "observado-en-runtime" {
            return Err("observado-en-runtime: esta fronte non executa a ROM".into());
        }
        if !forma_sha256(&self.imaxe_sha256) {
            return Err("imaxe_sha256 fora de forma (64 hex minúsculas)".into());
        }
        if !forma_sha256(&self.saida_sha256) {
            return Err("saida_sha256 fora de forma".into());
        }
        if let Some(h) = &self.rutina_sha256 {
            if !forma_sha256(h) {
                return Err("rutina_sha256 fora de forma".into());
            }
        }
        if self.carga_bytes.is_empty() {
            return Err("carga_bytes baleira".into());
        }
        let hai_chamada = self.chamada_sitio.is_some();
        if hai_chamada
            != (self.chamada_bytes.is_some()
                && self.chamada_forma.is_some()
                && self.chamada_alvo.is_some())
        {
            return Err(
                "elos de chamada incompletos: sitio+bytes+forma+alvo xuntos ou nada".into(),
            );
        }
        let hai_rutina = self.rutina_sitio.is_some();
        if hai_rutina != (self.rutina_lonxitude.is_some() && self.rutina_sha256.is_some()) {
            return Err("elos de rutina incompletos".into());
        }
        match self.confianza.as_str() {
            "referencia-estatica" | "candidato" if hai_chamada => {
                return Err(format!(
                    "confianza `{}` con chamada medida: a cadea miente por defecto",
                    self.confianza
                ));
            }
            "vinculo-estrutural" => {
                if !hai_chamada || !hai_rutina {
                    return Err("vinculo-estrutural sen chamada e rutina medidas".into());
                }
                if self.carga_operando != self.fluxo_cpu {
                    return Err(
                        "vinculo-estrutural: o operando da carga non e o fluxo da cadea".into(),
                    );
                }
            }
            _ => {}
        }
        if !hai_chamada && self.carga_operando != self.fluxo_cpu {
            return Err(
                "o operando da carga debe coincidir co fluxo (ou declarar outro elo)".into(),
            );
        }
        let destino_completo = self.destino_sitio.is_some()
            && self.destino_bytes.is_some()
            && self.destino_forma.is_some()
            && self.destino_operando.is_some()
            && self.destino_rexion.is_some();
        let destino_algún = self.destino_sitio.is_some()
            || self.destino_bytes.is_some()
            || self.destino_forma.is_some()
            || self.destino_operando.is_some()
            || self.destino_rexion.is_some();
        if destino_algún && !destino_completo {
            return Err("elos de destino incompletos".into());
        }
        Ok(())
    }
}

/// `0x` + seis hex maiúsculas (enderezo 68000 de 24 bits).
pub fn hex_enderezo(v: u32) -> String {
    format!("0x{v:06X}")
}

pub fn hex_maíus(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02X}"));
    }
    s
}

/// `0x` + 4..8 hex maiúsculas. Devolve o valor ou `None` (sen estimacións).
pub fn analizar_enderezo(s: &str) -> Option<u32> {
    let corpo = s.strip_prefix("0x")?;
    if corpo.len() < 4 || corpo.len() > 8 {
        return None;
    }
    if !corpo
        .bytes()
        .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_lowercase())
    {
        return None;
    }
    u32::from_str_radix(corpo, 16).ok()
}

pub fn analizar_hex_bytes(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 || s.len() < 2 {
        return None;
    }
    if !s
        .bytes()
        .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_lowercase())
    {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    let v = s.as_bytes();
    let dígito = |c: u8| -> Option<u8> {
        match c {
            b'0'..=b'9' => Some(c - b'0'),
            b'A'..=b'F' => Some(c - b'A' + 10),
            _ => None,
        }
    };
    for par in v.chunks(2) {
        out.push(dígito(par[0])? * 16 + dígito(par[1])?);
    }
    Some(out)
}

/// 64 hex minúsculas: forma de SHA-256 publicado.
pub fn forma_sha256(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
