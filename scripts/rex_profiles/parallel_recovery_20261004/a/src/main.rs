//! CLI `rex-chain`: medir, construír e revalidar cadeas Kosinski.
//!
//! Verbos:
//! - `revalidar`: confrontationa unha cadea escrita contra os bytes actuais
//!   da imaxe; sae con código estable (contrato §códigos).
//! - `construir-cadea`: mide una cadea nova **desde un sitio declarado polo
//!   usuario** (a ferramenta proba os bytes, non descobre o enderezo).
//! - `detectar`: varre a imaxe coa gramática conxelada e emite parellas
//!   carga→chamada como detección automática (orixe `descoberto-por-varredura`).
//! - `medir-bytes`: axudante de auditoría, imprime hex nun offset.

use rex_addressing::md_linear;
use rex_chain::chain::{analizar_enderezo, hex_maíus, Cadea};
use rex_chain::instr::{decodificar, sitio_aliñado, Forma, InstrErro, BARRAMENTO};
use rex_chain::verify::{
    clasificar_rexion, codigo, estado_desde_corda, ler_imaxe, offset_rom, revalidar,
    VENTANXA_DEFECTO,
};
use rex_kosinski::{decode, KosError};
use std::path::Path;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let código = match execut(&args) {
        Ok(c) => c,
        Err((c, m)) => {
            eprintln!("ERRO({c}): {m}");
            c
        }
    };
    std::process::exit(código);
}

fn execut(args: &[String]) -> Result<i32, (i32, String)> {
    if args.is_empty() {
        return Err((codigo::USO, uso().to_string()));
    }
    let flags = interpretar_flags(&args[1..]).map_err(|m| (codigo::USO, m))?;
    match args[0].as_str() {
        "revalidar" => revalidar_verb(&flags),
        "construir-cadea" => construir_verb(&flags),
        "detectar" => detectar_verb(&flags),
        "medir-bytes" => medir_bytes_verb(&flags),
        other => Err((
            codigo::USO,
            format!("verbo descoñecido: {other}\n{}", uso()),
        )),
    }
}

fn uso() -> &'static str {
    "uso: rex-chain revalidar --imaxe F --cadea F [--liña N] [--ventanxa N]\n\
     \x20     rex-chain construir-cadea --imaxe F --rom-size 0x.. --carga-sitio 0x.. \\\n\
     \x20        --rutina-lonxitude N --limite-max-saida N --limite-orzamento N \\\n\
     \x20        [--destino-sitio 0x..] [--chamada-sitio 0x..] [--ventanxa N]\n\
     \x20     rex-chain detectar --imaxe F --rom-size 0x.. --rutina-lonxitude N \\\n\
     \x20        --limite-max-saida N --limite-orzamento N [--ventanxa N] [--max-cadeas N]\n\
     \x20     rex-chain medir-bytes --imaxe F --offset N --lonxe N"
}

#[derive(Default)]
struct Flags {
    v: Vec<(String, String)>,
}

impl Flags {
    fn get(&self, n: &str) -> Option<&str> {
        self.v.iter().find(|(k, _)| k == n).map(|(_, x)| x.as_str())
    }
}

fn interpretar_flags(args: &[String]) -> Result<Flags, String> {
    let mut f = Flags::default();
    let mut i = 0;
    while i < args.len() {
        let nome = args[i]
            .strip_prefix("--")
            .ok_or_else(|| format!("agrdamento posicional non admitido: {}", args[i]))?
            .to_string();
        let valor = args
            .get(i + 1)
            .ok_or_else(|| format!("falta valor para --{nome}"))?;
        if f.v.iter().any(|(k, _)| *k == nome) {
            return Err(format!("flag duplicada: --{nome}"));
        }
        f.v.push((nome, valor.clone()));
        i += 2;
    }
    Ok(f)
}

fn require_addr(f: &Flags, n: &str) -> Result<u32, (i32, String)> {
    let raw = f
        .get(n)
        .ok_or_else(|| (codigo::USO, format!("falta --{n}")))?;
    analizar_enderezo(raw)
        .ok_or_else(|| (codigo::USO, format!("--{n} non é enderezo 0x hex: {raw}")))
}

fn opt_addr(f: &Flags, n: &str) -> Result<Option<u32>, (i32, String)> {
    match f.get(n) {
        None => Ok(None),
        Some(raw) => analizar_enderezo(raw)
            .map(Some)
            .ok_or_else(|| (codigo::USO, format!("--{n} non é enderezo 0x hex: {raw}"))),
    }
}

fn require_num(f: &Flags, n: &str) -> Result<u64, (i32, String)> {
    let raw = f
        .get(n)
        .ok_or_else(|| (codigo::USO, format!("falta --{n}")))?;
    raw.parse::<u64>()
        .map_err(|_| (codigo::USO, format!("--{n} non é decimal: {raw}")))
}

fn opt_num(f: &Flags, n: &str, defecto: u64) -> Result<u64, (i32, String)> {
    match f.get(n) {
        None => Ok(defecto),
        Some(raw) => raw
            .parse::<u64>()
            .map_err(|_| (codigo::USO, format!("--{n} non é decimal: {raw}"))),
    }
}

fn require_flag<'a>(f: &'a Flags, n: &str) -> Result<&'a str, (i32, String)> {
    f.get(n)
        .ok_or_else(|| (codigo::USO, format!("falta --{n}")))
}

// ---------------------------------------------------------------- revalidar

fn revalidar_verb(f: &Flags) -> Result<i32, (i32, String)> {
    let imaxe = ler_imaxe(Path::new(require_flag(f, "imaxe")?))?;
    let liña = opt_num(f, "liña", 1)? as usize;
    if liña == 0 {
        return Err((codigo::USO, "--liña é 1-based".to_string()));
    }
    let cadea = ler_cadea(Path::new(require_flag(f, "cadea")?), liña)?;
    let ventanxa = opt_num(f, "ventanxa", u64::from(VENTANXA_DEFECTO))? as u32;
    let res = revalidar(&imaxe, &cadea, ventanxa);
    println!("rex-chain revalidar codigo={}", res.codigo);
    println!("{}", res.resumen());
    Ok(res.codigo)
}

fn ler_cadea(ruta: &Path, liña: usize) -> Result<Cadea, (i32, String)> {
    let texto = std::fs::read_to_string(ruta)
        .map_err(|e| (codigo::LECTURA_ERRO, format!("sen-cadea: {e}")))?;
    let liñas: Vec<&str> = texto.lines().filter(|l| !l.trim().is_empty()).collect();
    let esc = liñas.get(liña - 1).ok_or_else(|| {
        (
            codigo::USO,
            format!(
                "o ficheiro ten {} liñas non baleiras, pedese a {liña}",
                liñas.len()
            ),
        )
    })?;
    Cadea::desde_json(esc).map_err(|m| (codigo::ESQUEMA, m))
}

// ------------------------------------------------------------ construir-cadea

/// Peças medidas que despois se ensamblan nunha `Cadea`. Un tipo intermedio:
/// `Cadea` ten 34 campos fixos e dúas rutas de construción (declarada e
/// varrida); sen isto a ensamblaxe duplicariase.
struct Partes {
    imaxe_sha256: String,
    estado_str: String,
    carga_sitio: u32,
    carga_bytes: Vec<u8>,
    carga_forma: String,
    carga_operando: u32,
    destino: Option<(u32, Vec<u8>, String, u32, String)>,
    chamada: Option<(u32, Vec<u8>, String, u32)>,
    rutina: Option<(u32, u64, String)>,
    fluxo_cpu: u32,
    fluxo_offset: u64,
    tramo_entrada: u64,
    bytes_consumidos: u64,
    saida_bytes: u64,
    saida_sha256: String,
    limite_max_saida: u64,
    limite_orzamento: u64,
    confianza: String,
    limitacions: Vec<String>,
    orixe: Vec<String>,
    /// Serie bruta do escano do tramo (consumida por `detectar`/`construir`;
    /// non forma parte da cadea).
    tramo: InfoTramo,
}

impl Partes {
    fn cadea(self) -> Cadea {
        let (d_sitio, d_bytes, d_forma, d_operando, d_rexion) = match self.destino {
            Some((a, b, c, d, e)) => (Some(a), Some(b), Some(c), Some(d), Some(e)),
            None => (None, None, None, None, None),
        };
        let (c_sitio, c_bytes, c_forma, c_alvo) = match self.chamada {
            Some((a, b, c, d)) => (Some(a), Some(b), Some(c), Some(d)),
            None => (None, None, None, None),
        };
        let (r_sitio, r_lon, r_sha) = match self.rutina {
            Some((a, b, c)) => (Some(a), Some(b), Some(c)),
            None => (None, None, None),
        };
        Cadea {
            imaxe_sha256: self.imaxe_sha256,
            mapper: md_linear::PROFILE_ID.to_string(),
            estado_mapper: self.estado_str,
            carga_sitio: self.carga_sitio,
            carga_bytes: self.carga_bytes,
            carga_forma: self.carga_forma,
            carga_operando: self.carga_operando,
            destino_sitio: d_sitio,
            destino_bytes: d_bytes,
            destino_forma: d_forma,
            destino_operando: d_operando,
            destino_rexion: d_rexion,
            chamada_sitio: c_sitio,
            chamada_bytes: c_bytes,
            chamada_forma: c_forma,
            chamada_alvo: c_alvo,
            rutina_sitio: r_sitio,
            rutina_lonxitude: r_lon,
            rutina_sha256: r_sha,
            fluxo_cpu: self.fluxo_cpu,
            fluxo_offset: self.fluxo_offset,
            tramo_entrada: self.tramo_entrada,
            bytes_consumidos: self.bytes_consumidos,
            saida_bytes: self.saida_bytes,
            saida_sha256: self.saida_sha256,
            codec: "kosinski".to_string(),
            variante: "base-non-modular".to_string(),
            limite_max_saida: self.limite_max_saida,
            limite_orzamento: self.limite_orzamento,
            confianza: self.confianza,
            limitacions: self.limitacions,
            orixe: self.orixe,
        }
    }
}

fn construir_verb(f: &Flags) -> Result<i32, (i32, String)> {
    let imaxe = ler_imaxe(Path::new(require_flag(f, "imaxe")?))?;
    let rom_size = require_addr(f, "rom-size")?;
    let (st, _) = mapper_desde(rom_size)?;
    let carga_sitio = require_addr(f, "carga-sitio")?;
    let rutina_lon = require_num(f, "rutina-lonxitude")?;
    let max_saida = require_num(f, "limite-max-saida")?;
    let orzamento = require_num(f, "limite-orzamento")?;
    let destino_sitio = opt_addr(f, "destino-sitio")?;
    let chamado_declarado = opt_addr(f, "chamada-sitio")?;
    let ventanxa = opt_num(f, "ventanxa", u64::from(VENTANXA_DEFECTO))? as usize;

    let partes = medir_cadea(
        &imaxe,
        &rex_kosinski::edit::sha256_hex(&imaxe),
        &st,
        Medicion {
            rom_size,
            carga_sitio,
            destino_sitio,
            chamado_declarado,
            rutina_lon,
            max_saida,
            orzamento,
            ventanxa,
            varrida: false,
        },
    )?;
    let cadea = partes.cadea();
    if let Err(e) = cadea.validar() {
        return Err((
            codigo::ESQUEMA,
            format!("a cadea medida non pasa o contrato: {e}"),
        ));
    }
    println!("{}", cadea.to_json());
    Ok(codigo::OK)
}

/// Parámetros dunha medición; `medir_cadea` úsase desde dous verbos e once
/// argumentos soltos serían ilegibles.
#[derive(Clone, Copy)]
struct Medicion {
    rom_size: u32,
    carga_sitio: u32,
    destino_sitio: Option<u32>,
    /// Emparellamento **declarado** polo usuario (RESPOSTA-D-A §5.6): cando
    /// está presente, a chamada promóvese polo sitio declarado — non polo
    /// varredor do tramo — coa súa epistemoloxía separada (`par-declarado`).
    chamado_declarado: Option<u32>,
    rutina_lon: u64,
    max_saida: u64,
    orzamento: u64,
    ventanxa: usize,
    varrida: bool,
}

/// Candidato do recto: `(sitio, bytes da instrución, nome da forma, alvo
/// efectivo de 32 bits)`.
type Candidato = (u32, Vec<u8>, String, u32);

/// Resultado do escano do tramo recto (gardas de RESPOSTA-D-A §5). Non é
/// análise de alcançabilidade: é o vocabulario pechado declarado no conxelado.
struct InfoTramo {
    /// Candidatos de chamada con backing ROM no recto (roto antes deles).
    candidatos: Vec<Candidato>,
    /// Gardas que rompen o recto, na orde de escaneo (`roto-bra`,
    /// `roto-rts`, `sobrescrito-A0`).
    roturas: Vec<String>,
    /// Bcc `62..67` atopados: non rompen, rexistran ambigüidade de camiño.
    bcc: Vec<String>,
    /// Recusas da gramática no tramo (`recusa-no-tramo:<motivo>@<sitio>`).
    recusadas: Vec<String>,
    /// Palabras sen forma modelada: o seu span real non se modela (límite
    /// declarado en RESPOSTA-D-A §7).
    non_modeladas: u32,
}

/// Mide todos os elos desde un sitio de carga. Usado por `construir-cadea`
/// (orixe declarado polo usuario) e `detectar` (orixe varrido).
fn medir_cadea(
    imaxe: &[u8],
    imaxe_sha256: &str,
    st: &rex_addressing::MapperState,
    m: Medicion,
) -> Result<Partes, (i32, String)> {
    let Medicion {
        rom_size,
        carga_sitio,
        destino_sitio,
        chamado_declarado,
        rutina_lon,
        max_saida,
        orzamento,
        ventanxa,
        varrida,
    } = m;
    let estado_str = format!("rom_size=0x{rom_size:06X}");

    // 1. carga.
    let off_carga = offset_rom(carga_sitio, st)
        .map_err(|e| (codigo::SITIO_DIVERXENCIA, format!("carga-sitio: {e}")))?;
    let vent = imaxe.get(off_carga..off_carga + 6).ok_or_else(|| {
        (
            codigo::SITIO_DIVERXENCIA,
            "carga-sitio fora da imaxe".to_string(),
        )
    })?;
    if !sitio_aliñado(carga_sitio) {
        return Err((
            codigo::SITIO_DIVERXENCIA,
            format!("carga-sitio {carga_sitio:#08X} impar: un opcode impar non é código 68k"),
        ));
    }
    let forma = decodificar(vent, carga_sitio).map_err(|e| {
        (
            codigo::SITIO_DIVERXENCIA,
            format!("non é forma de carga: {e:?}"),
        )
    })?;
    let operando = operando_carga(&forma).ok_or((
        codigo::ARGUMENTO_DIVERXENTE,
        format!(
            "a forma medida {} non é unha carga lea: só se emparellan cargas ao fluxo",
            forma.nome()
        ),
    ))?;
    let carga_bytes = vent[..forma.lonxitude()].to_vec();

    // 2. chamada na ventána tras a carga. Dous camiños (RESPOSTA-D-A §5/§6):
    //    o varredor do **tramo recto** com gardas pechadas, ou o emparellamento
    //    **declarado** polo usuario (`--chamada-sitio`), cuxa epistemoloxía
    //    queda separada no rexistro. A xanela segue sendo a xeometría do
    //    contrato; as gardas deciden que se *promove* dentro dela.
    let fin_carga = off_carga + forma.lonxitude();
    let carga_reg = match &forma {
        Forma::LeaAbsL { registro, .. }
        | Forma::LeaAbsW { registro, .. }
        | Forma::LeaPcD16 { registro, .. } => *registro,
        _ => {
            return Err((
                codigo::ARGUMENTO_DIVERXENTE,
                "a carga non é forma lea co rexistro coñecido".to_string(),
            ))
        }
    };
    let (parella, tramo) = match chamado_declarado {
        Some(sitio) => (
            chamada_desde_declaracion(imaxe, st, sitio)?,
            InfoTramo {
                candidatos: Vec::new(),
                roturas: Vec::new(),
                bcc: Vec::new(),
                recusadas: Vec::new(),
                non_modeladas: 0,
            },
        ),
        None => {
            let t = escanar_tramo(imaxe, st, fin_carga, ventanxa, carga_reg);
            // §5.3 + §7: só promove o candidato único cando toda a xanela
            // está modelada. Canto hai palabras sen forma modelada, o span
            // real é descoñecido e a palabra probe podería caer dentro del:
            // eses pares só se promoven pola vía declarada (--chamada-sitio).
            let parella = if t.candidatos.len() == 1 && t.non_modeladas == 0 {
                t.candidatos.first().cloned()
            } else {
                None
            };
            (parella, t)
        }
    };
    let ambiguous = parella.is_none() && tramo.candidatos.len() >= 2;
    if parella.is_none() && varrida && !ambiguous {
        return Err((
            codigo::XEOMETRIA_DIVERXENTE,
            "sen chamada na ventána".to_string(),
        ));
    }

    // 3. destino declarado (opcional).
    let destino = match destino_sitio {
        Some(dsitio) => {
            let off_dest = offset_rom(dsitio, st)
                .map_err(|e| (codigo::SITIO_DIVERXENCIA, format!("destino-sitio: {e}")))?;
            let v = imaxe.get(off_dest..off_dest + 6).ok_or_else(|| {
                (
                    codigo::SITIO_DIVERXENCIA,
                    "destino-sitio fora da imaxe".to_string(),
                )
            })?;
            let df = decodificar(v, dsitio).map_err(|e| {
                (
                    codigo::SITIO_DIVERXENCIA,
                    format!("destino non decodificable: {e:?}"),
                )
            })?;
            let dop = operando_carga(&df).ok_or((
                codigo::ARGUMENTO_DIVERXENTE,
                "destino-sitio non contén unha carga lea".to_string(),
            ))?;
            let dop_bus = dop & BARRAMENTO;
            let rexion = clasificar_rexion(dop_bus, rom_size);
            Some((
                dsitio,
                v[..df.lonxitude()].to_vec(),
                df.nome(),
                dop,
                rexion.to_string(),
            ))
        }
        None => None,
    };

    // 4. fluxo e rutina. Modelo de tres niveis (RECTIFICACION §2): o
    //    efectivo de 32 bits queda nos campos `*_operando`/`chamada_alvo`;
    //    o mapper e o hash da rutina workan co **bus** (`efectivo &
    //    0xFF_FFFF`), que é o que o 68000 presenta físicamente.
    let operando_bus = operando & BARRAMENTO;
    let off_fluxo = offset_rom(operando_bus, st)
        .map_err(|e| (codigo::MAPPER_DIVERXENCIA, format!("fluxo: {e}")))?;
    let rutina = match &parella {
        Some((_, _, _, alvo)) => {
            let alvo_bus = *alvo & BARRAMENTO;
            let off_rot = offset_rom(alvo_bus, st).map_err(|e| {
                (
                    codigo::ROTINA_DIVERXENCIA,
                    format!("alvo {alvo:#08X} (bus {alvo_bus:#08X}) sen backing ROM: {e}"),
                )
            })?;
            let rbytes = imaxe
                .get(off_rot..off_rot + rutina_lon as usize)
                .ok_or_else(|| {
                    (
                        codigo::ROTINA_DIVERXENCIA,
                        "rutina fóra da imaxe".to_string(),
                    )
                })?;
            Some((alvo_bus, rutina_lon, rex_kosinski::edit::sha256_hex(rbytes)))
        }
        None => None,
    };

    // 5. decodificación do fluxo.
    let entrada = &imaxe[off_fluxo..];
    let dec = decode(entrada, max_saida as usize, orzamento as usize).map_err(|e| {
        let (c, d) = erro_decodificador(&e);
        (c, format!("fluxo en {off_fluxo:#06X}: {d}"))
    })?;

    // 6. ensamblaxe epistemolóxica.
    let (confianza, mut limitacions) = match &parella {
        Some(_) => (
            "vinculo-estrutural".to_string(),
            vec![
                "emparellamento-ventana-heuristico: a chamada está na ventána, non se probou o fluxo de control".to_string(),
                "sen-execucion: ningunha proba de runtime nesta fronte".to_string(),
            ],
        ),
        None => (
            "referencia-estatica".to_string(),
            vec![
                "sen-chamada-na-ventana: queda en referencia do enderezo, non consumidor probado".to_string(),
                "sen-execucion: ningunha proba de runtime nesta fronte".to_string(),
            ],
        ),
    };
    let mut orixe = vec![format!(
        "carga_sitio={}",
        if varrida {
            "descoberto-por-varredura"
        } else {
            "declarado-probado"
        }
    )];
    if parella.is_some() {
        limitacions.push("rutina-hashada-non-desasemblada: o contido da rutina é un pin, non semantics recuperadas".to_string());
        if chamado_declarado.is_some() {
            // epistemoloxía separada do par declarado (§5.6)
            limitacions.push("par-declarado".to_string());
            orixe.push("chamada_sitio=declarado-probado".to_string());
        } else {
            orixe.push("chamada_sitio=medido-heuristica-ventana".to_string());
        }
        orixe.push("rutina=hash-medido".to_string());
        // gardas vistas no tramo que non rompían o recto: rexístranse, nunca
        // se clampan en silencio (§5.1).
        for b in &tramo.bcc {
            limitacions.push(format!("camiños-condicionais:bcc@{b}"));
        }
        for r in &tramo.recusadas {
            limitacions.push(r.clone());
        }
    }
    if ambiguous {
        limitacions.push(format!(
            "ventana-ambigua:{}-candidatos",
            tramo.candidatos.len()
        ));
    } else if parella.is_none() {
        if tramo.non_modeladas > 0 {
            limitacions.push(format!(
                "tramo-non-modelado:{}-palabras: o span real non se modela e a palabra probe podería caer dentro del (limite §7); a promción estrutural require declaracion explicita (--chamada-sitio)",
                tramo.non_modeladas
            ));
        }
        for r in &tramo.roturas {
            limitacions.push(format!("segmento-roto:{r}"));
        }
    }
    orixe.extend([
        "carga_operando=medido".to_string(),
        "fluxo=derivado-da-carga".to_string(),
        "saida=medida".to_string(),
    ]);
    if varrida {
        orixe.push("varredura-gramatica-conxelada".to_string());
    }
    // Efectivo ≠ bus (extensión de sinal ou rollover da PC): rexistrar como
    // limitación, nunca clampa en silencio (RECTIFICACION §2).
    if operando_bus != operando {
        limitacions.push(format!(
            "efectivo≠bus(carga): efectivo={operando:#08X} → bus={operando_bus:#08X}: o fluxo pinase polo bus de 24 bits"
        ));
    }
    if let Some((_, _, _, dop, _)) = &destino {
        if *dop & BARRAMENTO != *dop {
            limitacions.push(format!(
                "efectivo≠bus(destino): efectivo={dop:#08X} → bus={:#08X}: a rexión clasifícase polo bus",
                *dop & BARRAMENTO
            ));
        }
    }
    if let Some((_, _, _, alvo)) = &parella {
        if *alvo & BARRAMENTO != *alvo {
            limitacions.push(format!(
                "efectivo≠bus(chamada): efectivo={alvo:#08X} → bus={:#08X}: a rutina pinase no bus",
                *alvo & BARRAMENTO
            ));
        }
    }

    Ok(Partes {
        imaxe_sha256: imaxe_sha256.to_string(),
        estado_str,
        carga_sitio,
        carga_bytes,
        carga_forma: forma.nome(),
        carga_operando: operando,
        destino,
        chamada: parella,
        rutina,
        fluxo_cpu: operando_bus,
        fluxo_offset: off_fluxo as u64,
        tramo_entrada: (imaxe.len() - off_fluxo) as u64,
        bytes_consumidos: u64::try_from(dec.bytes_consumed).unwrap_or(u64::MAX),
        saida_bytes: u64::try_from(dec.output.len()).unwrap_or(u64::MAX),
        saida_sha256: rex_kosinski::edit::sha256_hex(&dec.output),
        limite_max_saida: max_saida,
        limite_orzamento: orzamento,
        confianza,
        limitacions,
        orixe,
        tramo,
    })
}

fn mapper_desde(rom_size: u32) -> Result<(rex_addressing::MapperState, u32), (i32, String)> {
    let estado_str = format!("rom_size=0x{rom_size:06X}");
    estado_desde_corda(&estado_str)
        .map_err(|e| (codigo::MAPPER_DIVERXENCIA, format!("mapper: {e}")))
}

fn operando_carga(f: &Forma) -> Option<u32> {
    match f {
        Forma::LeaAbsL { operando, .. }
        | Forma::LeaAbsW { operando, .. }
        | Forma::LeaPcD16 {
            destino: operando, ..
        } => Some(*operando),
        _ => None,
    }
}

fn chamada_de(f: &Forma) -> Option<u32> {
    match f {
        Forma::BsrS { alvo }
        | Forma::BsrW { alvo }
        | Forma::JsrAbsL { alvo }
        | Forma::JsrAbsW { alvo }
        | Forma::JsrPcD16 { alvo }
        | Forma::JmpAbsL { alvo }
        | Forma::JmpAbsW { alvo }
        | Forma::JmpPcD16 { alvo } => Some(*alvo),
        _ => None,
    }
}

/// Escano do tramo `fin_carga .. +ventanxa` co **vocabulario de gardas
/// pechado** de RESPOSTA-D-A §5: `roto-bra`, `roto-rts`, `sobrescrito-An`,
/// `bcc` (non rompe, rexístrase) e recusas da gramática (non rompen nin
/// emparellan, rexístranse). Unha vez rota a serie recta, os candidatos
/// posteriores non contan. Nada fóra do vocabulario se promove nin se
/// rexeita por el: as palabras sen forma modelada avanzan 2 bytes e
/// rexístranse como límite de span (§7) — non é análise de alcançabilidade.
/// O paso aliñase por palabra (paridade de instrución, §5.1); cando a forma
/// está modelada, o avance é a **súa lonxitude**, de xeito que os operandos
/// dun `bsr.w`/`jsr.l` non contan como palabras non modeladas (§7.2).
fn escanar_tramo(
    imaxe: &[u8],
    st: &rex_addressing::MapperState,
    fin_carga: usize,
    ventanxa: usize,
    carga_reg: u8,
) -> InfoTramo {
    let mut t = InfoTramo {
        candidatos: Vec::new(),
        roturas: Vec::new(),
        bcc: Vec::new(),
        recusadas: Vec::new(),
        non_modeladas: 0,
    };
    let to = (fin_carga + ventanxa).min(imaxe.len());
    let mut off = fin_carga;
    while off + 2 <= to {
        let sitio = off as u32;
        let b0 = imaxe[off];
        let b1 = imaxe[off + 1];
        if b0 == 0x60 {
            // bra.s `60 dd` / bra.w `60 00 dd dd`: salto incondicional → o
            // candidato posterior non está no recto.
            t.roturas.push(format!("roto-bra@{sitio:#06X}"));
            break;
        }
        if b0 == 0x4E && b1 == 0x75 {
            t.roturas.push(format!("roto-rts@{sitio:#06X}"));
            break;
        }
        let avance = match decodificar(&imaxe[off..(imaxe.len() - off).min(6) + off], sitio) {
            Ok(f) => {
                match &f {
                    Forma::LeaAbsL { registro, .. }
                    | Forma::LeaAbsW { registro, .. }
                    | Forma::LeaPcD16 { registro, .. } => {
                        if *registro == carga_reg {
                            t.roturas
                                .push(format!("sobrescrito-A{carga_reg}@{sitio:#06X}"));
                            break;
                        }
                        // carga noutro rexistro: recta, non rompe.
                    }
                    _ => {
                        if let Some(alvo) = chamada_de(&f) {
                            // backing ROM exigido no BUS do efectivo (tres
                            // niveis): sen ela o candidato non é promobible.
                            if offset_rom(alvo & BARRAMENTO, st).is_ok() {
                                let bytes = imaxe[off..off + f.lonxitude()].to_vec();
                                t.candidatos.push((sitio, bytes, f.nome(), alvo));
                            }
                        }
                    }
                }
                f.lonxitude()
            }
            Err(InstrErro::Recusa { motivo }) => {
                if (0x62..=0x67).contains(&b0) {
                    // Bcc: non rompe o recto; rexistra ambigüidade de camiño.
                    t.bcc.push(format!("{sitio:#06X}"));
                } else {
                    t.recusadas
                        .push(format!("recusa-no-tramo:{motivo}@{sitio:#06X}"));
                }
                2
            }
            // NonForma / MoiCurta: fóra do vocabulario — non promove nin
            // rexeita; o span real non se modela (límite §7).
            Err(_) => {
                t.non_modeladas += 1;
                2
            }
        };
        off += avance;
    }
    t
}

/// Chamada no sitio **declarado** polo usuario (`--chamada-sitio`): a
/// ferramenta proba que ali hai unha forma de chamada con backing ROM no
/// bus; non descubre nada e non depende do escano do tramo.
fn chamada_desde_declaracion(
    imaxe: &[u8],
    st: &rex_addressing::MapperState,
    sitio: u32,
) -> Result<Option<Candidato>, (i32, String)> {
    if !sitio_aliñado(sitio) {
        return Err((
            codigo::SITIO_DIVERXENCIA,
            format!("--chamada-sitio {sitio:#08X} impar: un opcode impar non é código 68k"),
        ));
    }
    let off = offset_rom(sitio, st)
        .map_err(|e| (codigo::SITIO_DIVERXENCIA, format!("chamada-sitio: {e}")))?;
    let lon = (imaxe.len() - off).min(6);
    let vent = imaxe.get(off..off + lon).ok_or((
        codigo::SITIO_DIVERXENCIA,
        "chamada-sitio fora da imaxe".to_string(),
    ))?;
    let f = decodificar(vent, sitio).map_err(|e| {
        (
            codigo::SITIO_DIVERXENCIA,
            format!("chamada declarada: {e:?}"),
        )
    })?;
    let alvo = chamada_de(&f).ok_or((
        codigo::ARGUMENTO_DIVERXENTE,
        format!(
            "o sitio declarado {sitio:#08X} non contén unha forma de chamada ({})",
            f.nome()
        ),
    ))?;
    if offset_rom(alvo & BARRAMENTO, st).is_err() {
        return Err((
            codigo::ROTINA_DIVERXENCIA,
            format!("alvo {alvo:#08X} sen backing ROM no bus: rutina non alcanzable"),
        ));
    }
    Ok(Some((
        sitio,
        vent[..f.lonxitude()].to_vec(),
        f.nome(),
        alvo,
    )))
}

fn erro_decodificador(e: &KosError) -> (i32, String) {
    match e {
        KosError::Truncated | KosError::EmptyInput => (
            codigo::INCONCLUSIVE_TRUNCADA,
            "fluxo-truncado: sen terminator medible; queda inconcluso, non se infla".to_string(),
        ),
        KosError::InvalidReference => (
            codigo::SAIDA_DIVERXENTE,
            "referencia-invalida no fluxo".to_string(),
        ),
        KosError::ExcessiveOutput => (
            codigo::LIMITE_ACADADO,
            "saida-excede-limite: suba --limite-max-saida sabelosamente".to_string(),
        ),
        KosError::WorkLimit => (
            codigo::LIMITE_ACADADO,
            "orzamento-acabado: suba --limite-orzamento sabelosamente".to_string(),
        ),
    }
}

// ------------------------------------------------------------------ detectar

fn detectar_verb(f: &Flags) -> Result<i32, (i32, String)> {
    let imaxe = ler_imaxe(Path::new(require_flag(f, "imaxe")?))?;
    let rom_size = require_addr(f, "rom-size")?;
    let (st, _) = mapper_desde(rom_size)?;
    let rutina_lon = require_num(f, "rutina-lonxitude")?;
    let max_saida = require_num(f, "limite-max-saida")?;
    let orzamento = require_num(f, "limite-orzamento")?;
    let ventanxa = opt_num(f, "ventanxa", u64::from(VENTANXA_DEFECTO))? as usize;
    let max_cadeas = opt_num(f, "max-cadeas", 200)?;

    let mut emitidas = 0u64;
    let mut cargas = 0u64;
    let mut sen_parella = 0u64;
    let mut ambiguas = 0u64;
    let mut fluxo_rexeitado = 0u64;
    let mut cortada = false;
    let sha_imaxe = rex_kosinski::edit::sha256_hex(&imaxe);
    let mut off = 0usize;
    while off + 6 <= imaxe.len() {
        let b0 = imaxe[off];
        let b1 = imaxe[off + 1];
        let parece_lea = b0 & 0xF0 == 0x40 && b0 & 1 == 1 && matches!(b1, 0xF8..=0xFA);
        if parece_lea {
            let sitio = off as u32;
            if let Ok(forma) = decodificar(&imaxe[off..off + 6], sitio) {
                if let Some(op) = operando_carga(&forma) {
                    if offset_rom(op & BARRAMENTO, &st).is_ok() {
                        cargas += 1;
                        match medir_cadea(
                            &imaxe,
                            &sha_imaxe,
                            &st,
                            Medicion {
                                rom_size,
                                carga_sitio: sitio,
                                destino_sitio: None,
                                chamado_declarado: None,
                                rutina_lon,
                                max_saida,
                                orzamento,
                                ventanxa,
                                varrida: true,
                            },
                        ) {
                            Ok(partes) => {
                                let n_cand = partes.tramo.candidatos.len();
                                let cadea = partes.cadea();
                                match cadea.validar() {
                                    Ok(()) => {
                                        if n_cand >= 2 {
                                            // §5.4: dous candidatos no recto
                                            // → non se promove NINGÚN.
                                            ambiguas += 1;
                                            eprintln!(
                                                "AMBIGUA {sitio:#08X}: {n_cand} candidatos no recto"
                                            );
                                        } else {
                                            println!("{}", cadea.to_json());
                                            emitidas += 1;
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("REXEITADA {sitio:#08X}: {e}");
                                        fluxo_rexeitado += 1;
                                    }
                                }
                            }
                            Err((_, m)) => {
                                if m.contains("sen chamada") {
                                    sen_parella += 1;
                                } else {
                                    fluxo_rexeitado += 1;
                                    eprintln!("REXEITADA {sitio:#08X}: {m}");
                                }
                            }
                        }
                        if emitidas >= max_cadeas {
                            cortada = true;
                            break;
                        }
                    }
                }
            }
        }
        off += 2;
    }
    eprintln!(
        "rex-chain detectar cargas={cargas} sen-parella={sen_parella} ambiguas={ambiguas} rexeitadas={fluxo_rexeitado} emitidas={emitidas}{}",
        if cortada { " varredura-interrompida-max-cadeas" } else { "" }
    );
    Ok(codigo::OK)
}

// --------------------------------------------------------------- medir-bytes

fn medir_bytes_verb(f: &Flags) -> Result<i32, (i32, String)> {
    let imaxe = ler_imaxe(Path::new(require_flag(f, "imaxe")?))?;
    let offset = require_num(f, "offset")? as usize;
    let lonxe = require_num(f, "lonxe")? as usize;
    let reais = imaxe
        .get(offset..offset + lonxe)
        .ok_or((codigo::USO, "fora da imaxe".to_string()))?;
    println!("{}@{offset} = {}", hex_maíus(reais), lonxe);
    Ok(codigo::OK)
}
