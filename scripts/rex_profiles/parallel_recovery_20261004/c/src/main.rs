//! CLI `rex-cfg` — congelada em CONTRACT §2.
//!
//! `rex-cfg analyze --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM
//! [--region-prov <texto>] --root 0xENDERECO ... --root-prov <vocabulario> ...
//! [--root-evidence <texto> ...] --site 0xENDERECO ... [--max-insn N]
//! --out <json> [--md <markdown>]`
//!
//! Códigos de saída: `0` análise escrita; `1` erro de análise (região, raiz,
//! leitura do objeto); `2` erro de uso (flag ausente, endereço malformado,
//! proveniência fora do vocabulário). O `--bin` é aberto somente-leitura.
//!
//! A assinatura de `analyze` não muda. `consultar` (EXPECTATIONS-ETAPA2 §5,
//! registrado em CONTRACT §2.1) recebe um único `--site` e escreve o objeto
//! plano `rex-cfg-sitio/v1`; os códigos de saída são os mesmos três.

use std::path::PathBuf;
use std::process::ExitCode;

use rex_cfg::export::{export_json, export_markdown, Objeto};
use rex_cfg::grafo::{analisar_com_evidencias, RaizDeclarada, VOCABULARIO_PROVENIENCIA};
use rex_cfg::sitio;

const USAGE: &str = "usage: rex-cfg analyze --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM \
                    [--region-prov <texto>] --root 0xENDERECO ... --root-prov <vocabulario> ... \
                    [--root-evidence <texto> ...] --site 0xENDERECO ... [--max-insn N] --out <json> \
                    [--md <markdown>]
       rex-cfg consultar --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM \
                    --root 0xENDERECO ... --root-prov <vocabulario> ... --site 0xENDERECO \
                    --out <json> [--max-insn N]
  regioes: inicio inclusivo, fim exclusivo; enderecos com prefixo 0x (hex) ou decimal
  --root/--root-prov/--root-evidence: por posicao; proveniencia aceita: ";

const MAX_INSN_PADRAO: u64 = 100_000;

#[derive(Debug)]
enum Erro {
    Uso(String),
    Analise(String),
}

impl Erro {
    fn codigo(&self) -> ExitCode {
        match self {
            Erro::Uso(_) => ExitCode::from(2),
            Erro::Analise(_) => ExitCode::from(1),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Sub {
    Analyze,
    Consultar,
}

#[derive(Debug, Default)]
struct Pedidos {
    sub: Option<Sub>,
    bin: Option<PathBuf>,
    origin: u32,
    regiao: Option<(u32, u32)>,
    region_prov: Option<String>,
    roots: Vec<u32>,
    root_provs: Vec<String>,
    root_evidences: Vec<String>,
    sites: Vec<u32>,
    max_insn: Option<u64>,
    out: Option<PathBuf>,
    md: Option<PathBuf>,
}

fn endereco(texto: &str) -> Result<u32, Erro> {
    let t = texto.trim();
    let (radix, corpo) = if let Some(rest) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
        (16, rest)
    } else {
        (10, t)
    };
    let valor = u32::from_str_radix(corpo, radix).map_err(|e| {
        Erro::Uso(format!(
            "endereco {texto:?} invalido (use 0x… para hex): {e}"
        ))
    })?;
    Ok(valor)
}

fn uso<T>(msg: String) -> Result<T, Erro> {
    Err(Erro::Uso(msg))
}

fn parse_args(args: &[String]) -> Result<Pedidos, Erro> {
    let mut p = Pedidos::default();
    // subcomando
    let mut i = match args.first().map(String::as_str) {
        Some("analyze") => {
            p.sub = Some(Sub::Analyze);
            1usize
        }
        Some("consultar") => {
            p.sub = Some(Sub::Consultar);
            1usize
        }
        Some(other) => {
            return uso(format!(
                "subcomando desconhecido {other:?} (unicos: analyze, consultar)"
            ))
        }
        None => return uso("faltou o subcomando analyze ou consultar".to_string()),
    };
    let proximo = |args: &[String], i: &mut usize| -> Result<String, Erro> {
        *i += 1;
        args.get(*i)
            .cloned()
            .ok_or_else(|| Erro::Uso(format!("flag {} espera um valor", args[*i - 1])))
    };

    while i < args.len() {
        match args[i].as_str() {
            "--bin" => {
                let v = proximo(args, &mut i)?;
                p.bin = Some(PathBuf::from(v));
            }
            "--origin" => {
                let v = proximo(args, &mut i)?;
                p.origin = endereco(&v)?;
            }
            "--region" => {
                let v = proximo(args, &mut i)?;
                let Some((a, b)) = v.split_once(':') else {
                    return uso(format!("--region espera 0xINICIO:0xFIM, obtido {v:?}"));
                };
                let (ini, fim) = (endereco(a)?, endereco(b)?);
                if ini >= fim {
                    return uso(format!(
                        "regiao vazia: inicio {ini:#x} >= fim {fim:#x} (fim e exclusivo)"
                    ));
                }
                p.regiao = Some((ini, fim));
            }
            "--region-prov" => p.region_prov = Some(proximo(args, &mut i)?),
            "--root" => {
                let v = proximo(args, &mut i)?;
                p.roots.push(endereco(&v)?);
            }
            "--root-prov" => {
                let v = proximo(args, &mut i)?;
                if !VOCABULARIO_PROVENIENCIA.contains(&v.as_str()) {
                    return uso(format!(
                        "proveniencia {v:?} fora do vocabulario (§1): {}",
                        VOCABULARIO_PROVENIENCIA.join(", ")
                    ));
                }
                p.root_provs.push(v);
            }
            "--root-evidence" => p.root_evidences.push(proximo(args, &mut i)?),
            "--site" => {
                let v = proximo(args, &mut i)?;
                p.sites.push(endereco(&v)?);
            }
            "--max-insn" => {
                let v = proximo(args, &mut i)?;
                let n = v
                    .trim()
                    .parse::<u64>()
                    .map_err(|e| Erro::Uso(format!("--max-insn {v:?} invalido: {e}")))?;
                if n == 0 {
                    return uso("--max-insn precisa ser >= 1".to_string());
                }
                p.max_insn = Some(n);
            }
            "--out" => {
                let v = proximo(args, &mut i)?;
                p.out = Some(PathBuf::from(v));
            }
            "--md" => {
                let v = proximo(args, &mut i)?;
                p.md = Some(PathBuf::from(v));
            }
            other => return uso(format!("flag desconhecida {other:?}")),
        }
        i += 1;
    }

    if p.bin.is_none() {
        return uso("faltou --bin".to_string());
    }
    if p.regiao.is_none() {
        return uso("faltou --region 0xINICIO:0xFIM".to_string());
    }
    if p.roots.is_empty() {
        return uso("faltou pelo menos um --root".to_string());
    }
    if p.root_provs.len() != p.roots.len() {
        return uso(format!(
            "--root e --root-prov vao por posicao: {} raizes, {} proveniencias",
            p.roots.len(),
            p.root_provs.len()
        ));
    }
    if !p.root_evidences.is_empty() && p.root_evidences.len() != p.roots.len() {
        return uso(format!(
            "--root-evidence tambem vai por posicao: {} raizes, {} evidencias",
            p.roots.len(),
            p.root_evidences.len()
        ));
    }
    if p.out.is_none() {
        return uso("faltou --out <json>".to_string());
    }
    if p.sub == Some(Sub::Consultar) {
        // A assinatura de `consultar` esta congelada em EXPECTATIONS-ETAPA2 §5;
        // as flags de `analyze` que ela nao tem sao erro de uso, nao ignoradas.
        if p.md.is_some() {
            return uso("consultar nao escreve --md: a resposta e so o JSON plano".to_string());
        }
        if p.region_prov.is_some() {
            return uso(
                "consultar nao recebe --region-prov: a regiao nao e objeto da resposta".to_string(),
            );
        }
        if !p.root_evidences.is_empty() {
            return uso(
                "consultar nao recebe --root-evidence: a resposta nao exporta evidencia"
                    .to_string(),
            );
        }
        match p.sites.len() {
            0 => return uso("faltou --site 0xENDERECO (exatamente um por invocacao)".to_string()),
            1 => {}
            n => {
                return uso(format!(
                    "consultar recebe exatamente um --site: um sitio, um objeto plano; obtido {n}"
                ))
            }
        }
    }
    Ok(p)
}

fn executar(args: &[String]) -> Result<(), Erro> {
    let p = parse_args(args)?;
    let bin = p
        .bin
        .clone()
        .ok_or_else(|| Erro::Uso("faltou --bin".to_string()))?;
    let (regiao_ini, regiao_fim) = p
        .regiao
        .ok_or_else(|| Erro::Uso("faltou --region".to_string()))?;
    let bytes = std::fs::read(&bin)
        .map_err(|e| Erro::Analise(format!("nao foi possivel ler {}: {e}", bin.display())))?;
    if bytes.is_empty() {
        return Err(Erro::Analise(format!("objeto vazio: {}", bin.display())));
    }

    // Enderecos sao absolutos: base 0 do --bin + --origin (CONTRACT §2). O
    // buffer e deslocado por --origin para que a analise trabalhe na mesma base
    // sem reimpor o offset em cada campo exportado.
    let mut buf: Vec<u8> = Vec::with_capacity(p.origin as usize + bytes.len());
    buf.resize(p.origin as usize, 0);
    buf.extend_from_slice(&bytes);
    let fim_efetivo = buf.len() as u32;

    let mut proveniencia = p
        .region_prov
        .clone()
        .unwrap_or_else(|| "declarada pelo operador".to_string());
    if regiao_fim > fim_efetivo {
        proveniencia.push_str(&format!(
            "; recortado ao objeto (fim declarado {regiao_fim:#x} > tamanho {fim_efetivo:#x})"
        ));
    }

    let raizes: Vec<RaizDeclarada> = p
        .roots
        .iter()
        .enumerate()
        .map(|(k, a)| RaizDeclarada {
            endereco: *a,
            proveniencia: p.root_provs[k].clone(),
            evidencia: p.root_evidences.get(k).cloned(),
        })
        .collect();

    if p.sub == Some(Sub::Consultar) {
        let out = p
            .out
            .clone()
            .ok_or_else(|| Erro::Uso("faltou --out".to_string()))?;
        let sitio_end = *p
            .sites
            .first()
            .ok_or_else(|| Erro::Uso("faltou --site".to_string()))?;
        let valor = sitio::consultar(&sitio::Pedido {
            buf: &buf,
            arquivo: &bytes,
            regiao: (regiao_ini, regiao_fim),
            raizes: &raizes,
            sitio: sitio_end,
            max_insn: p.max_insn.unwrap_or(MAX_INSN_PADRAO),
        })
        .map_err(Erro::Analise)?;
        std::fs::write(&out, valor.pretty())
            .map_err(|e| Erro::Analise(format!("nao foi possivel {}: {e}", out.display())))?;
        let campo = |k: &str| {
            valor
                .get(k)
                .and_then(|v| v.as_str().ok())
                .unwrap_or("?")
                .to_string()
        };
        println!(
            "rex-cfg-sitio/v1 — objeto {} (sha256 {}, {} bytes) — regiao {:#x}..{:#x} — sitio {} \
             — veredito {} — consumidor {} — promotivel {} — motivos {} — saida {}",
            bin.display(),
            rex_gameplay::sha256::sha256_hex(&bytes),
            bytes.len(),
            regiao_ini,
            regiao_fim,
            campo("sitio"),
            campo("veredito"),
            campo("consumidor-validado"),
            campo("promovivel-vinculo-estrutural"),
            valor
                .get("motivos")
                .and_then(|v| v.as_arr().ok())
                .map(|a| a.len())
                .unwrap_or(0),
            out.display()
        );
        return Ok(());
    }

    let analise = analisar_com_evidencias(
        &buf,
        &raizes,
        (regiao_ini, regiao_fim),
        &p.sites,
        p.max_insn.unwrap_or(MAX_INSN_PADRAO),
    )
    .map_err(Erro::Analise)?;

    // Identidade do objeto = bytes do arquivo como lido, sem o preenchimento de
    // base: --origin desloca enderecos, nao o conteudo.
    let caminho = bin.to_string_lossy().to_string();
    let objeto = Objeto {
        caminho_declarado: &caminho,
        bytes: &bytes,
    };
    let json = export_json(&analise, &objeto, &proveniencia);
    let out = p
        .out
        .clone()
        .ok_or_else(|| Erro::Uso("faltou --out".to_string()))?;
    std::fs::write(&out, json)
        .map_err(|e| Erro::Analise(format!("nao foi possivel {}: {e}", out.display())))?;
    if let Some(md) = &p.md {
        let texto = export_markdown(&analise, &objeto, &proveniencia);
        std::fs::write(md, texto)
            .map_err(|e| Erro::Analise(format!("nao foi possivel {}: {e}", md.display())))?;
    }

    println!(
        "rex-cfg/v1 — objeto {} (sha256 {}, {} bytes) — regiao {:#x}..{:#x} — blocos={} arestas={} \
         chamadas={} fronteiras={} cobertura={}/{} ({}) — saida {}",
        bin.display(),
        rex_gameplay::sha256::sha256_hex(&bytes),
        bytes.len(),
        analise.regiao.0,
        analise.regiao.1,
        analise.blocos.len(),
        analise.arestas.len(),
        analise.chamadas.len(),
        analise.fronteiras.len(),
        analise.cobertura.bytes_decodificados,
        analise.cobertura.bytes_regiao,
        analise.cobertura.fracao,
        out.display()
    );
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match executar(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(Erro::Uso(m)) => {
            eprintln!("erro de uso: {m}");
            eprint!("{USAGE}{}", VOCABULARIO_PROVENIENCIA.join(", "));
            eprintln!();
            Erro::Uso(m).codigo()
        }
        Err(Erro::Analise(m)) => {
            eprintln!("erro de analise: {m}");
            Erro::Analise(m).codigo()
        }
    }
}
