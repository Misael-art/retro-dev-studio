//! Export `rex-cfg/v1` (CONTRACT §4): JSON ordenado, deterministico, e um
//! resumo em markdown com os mesmos numeros.
//!
//! As chaves seguem o contrato **literalmente**, inclusive a mistura de estilos
//! (`caminho_declarado` com underscore, `bytes-decodificados` com hyfen) que foi
//! congelada em `docs/.../c/CONTRACT.md` §4. Nenhum campo é acrescentado além da
//! lista do contrato: o export é o contrato serializado.
//!
//! Números são sempre inteiros (`Json::Int`) — o JSON do projeto não carrega
//! fracionários, por isso `fracao` é texto com quatro casas.

use rex_gameplay::json::Json;

use crate::grafo::Analise;

pub const SCHEMA: &str = "rex-cfg/v1";
pub const TOOL_NAME: &str = "rex-cfg";
/// Base congelada do contrato (worktree de referência da frente C).
pub const BASE_SHA: &str = "cb56657a142df40d2acd09a3e03e54247f066dea";

/// Identidade do objeto analisado. O digest é sempre dos bytes passados à
/// análise — nunca de um caminho ou de um tamanho declarado à parte.
#[derive(Debug, Clone, Copy)]
pub struct Objeto<'a> {
    pub caminho_declarado: &'a str,
    pub bytes: &'a [u8],
}

fn end(v: u32) -> Json {
    Json::Int(i64::from(v))
}

fn alvo_json(alvo: Option<u32>) -> Json {
    match alvo {
        Some(a) => end(a),
        None => Json::Null,
    }
}

pub fn export_valor(analise: &Analise, objeto: &Objeto, regiao_proveniencia: &str) -> Json {
    let digest = rex_gameplay::sha256::sha256_hex(objeto.bytes);

    let raizes: Vec<Json> = analise
        .raizes
        .iter()
        .map(|r| {
            Json::obj(vec![
                ("endereco", end(r.endereco)),
                ("proveniencia", Json::str(r.proveniencia.clone())),
                (
                    "evidencia",
                    match &r.evidencia {
                        Some(t) => Json::str(t.clone()),
                        None => Json::Null,
                    },
                ),
                ("grau", Json::str(r.grau.clone())),
            ])
        })
        .collect();

    let blocos: Vec<Json> = analise
        .blocos
        .iter()
        .map(|b| {
            let instrucoes: Vec<Json> = b
                .instrucoes
                .iter()
                .map(|i| {
                    Json::obj(vec![
                        ("endereco", end(i.endereco)),
                        ("tam", Json::Int(i64::from(i.tam))),
                        ("mnem", Json::str(i.mnem.clone())),
                        ("classe", Json::str(i.classe.clone())),
                    ])
                })
                .collect();
            let sucessores: Vec<Json> = b
                .sucessores
                .iter()
                .map(|s| {
                    Json::obj(vec![
                        ("alvo", end(s.alvo)),
                        ("tipo", Json::str(s.tipo.label())),
                    ])
                })
                .collect();
            Json::obj(vec![
                ("entrada", end(b.entrada)),
                ("instrucoes", Json::Arr(instrucoes)),
                ("saida", Json::str(b.saida.clone())),
                ("sucessores", Json::Arr(sucessores)),
                (
                    "alcanado-por",
                    Json::Arr(b.alcancado_por.iter().cloned().map(Json::str).collect()),
                ),
            ])
        })
        .collect();

    let arestas: Vec<Json> = analise
        .arestas
        .iter()
        .map(|a| {
            Json::obj(vec![
                ("origem", end(a.origem)),
                ("alvo", alvo_json(a.alvo)),
                ("tipo", Json::str(a.tipo.label())),
                ("status", Json::str(a.status.label())),
            ])
        })
        .collect();

    let chamadas: Vec<Json> = analise
        .chamadas
        .iter()
        .map(|c| {
            Json::obj(vec![
                ("sitio", end(c.sitio)),
                ("alvo", alvo_json(c.alvo)),
                ("forma", Json::str(c.forma.clone())),
                ("params", Json::str(c.params)),
                ("clobbers", Json::str(c.clobbers)),
                ("status", Json::str(c.status.label())),
            ])
        })
        .collect();

    let fronteiras: Vec<Json> = analise
        .fronteiras
        .iter()
        .map(|f| {
            Json::obj(vec![
                ("endereco", end(f.endereco)),
                ("tipo", Json::str(f.tipo.clone())),
                (
                    "opcode",
                    match f.opcode {
                        Some(op) => Json::Int(i64::from(op)),
                        None => Json::Null,
                    },
                ),
                ("motivo", Json::str(f.motivo.clone())),
            ])
        })
        .collect();

    let vaos: Vec<Json> = analise
        .cobertura
        .vaos
        .iter()
        .map(|v| Json::obj(vec![("inicio", end(v.inicio)), ("fim", end(v.fim))]))
        .collect();

    let sitios: Vec<Json> = analise
        .sitios
        .iter()
        .map(|s| {
            Json::obj(vec![
                ("endereco", end(s.endereco)),
                ("veredito", Json::str(s.veredito.clone())),
                ("bloco", alvo_json(s.bloco)),
            ])
        })
        .collect();

    Json::obj(vec![
        ("schema", Json::str(SCHEMA)),
        (
            "tool",
            Json::obj(vec![
                ("name", Json::str(TOOL_NAME)),
                ("version", Json::str(env!("CARGO_PKG_VERSION"))),
                ("base_sha", Json::str(BASE_SHA)),
            ]),
        ),
        (
            "objeto",
            Json::obj(vec![
                ("caminho_declarado", Json::str(objeto.caminho_declarado)),
                ("sha256", Json::str(digest)),
                ("tamanho", Json::Int(objeto.bytes.len() as i64)),
            ]),
        ),
        (
            "regiao",
            Json::obj(vec![
                ("inicio", end(analise.regiao.0)),
                ("fim", end(analise.regiao.1)),
                ("proveniencia", Json::str(regiao_proveniencia)),
            ]),
        ),
        ("raizes", Json::Arr(raizes)),
        ("blocos", Json::Arr(blocos)),
        ("arestas", Json::Arr(arestas)),
        ("chamadas", Json::Arr(chamadas)),
        ("fronteiras", Json::Arr(fronteiras)),
        (
            "cobertura",
            Json::obj(vec![
                (
                    "bytes-decodificados",
                    Json::Int(analise.cobertura.bytes_decodificados as i64),
                ),
                (
                    "bytes-regiao",
                    Json::Int(analise.cobertura.bytes_regiao as i64),
                ),
                ("fracao", Json::str(analise.cobertura.fracao.clone())),
                ("vaos", Json::Arr(vaos)),
            ]),
        ),
        ("sitios", Json::Arr(sitios)),
        (
            "limites",
            Json::Arr(analise.limites.iter().map(|l| Json::str(*l)).collect()),
        ),
    ])
}

pub fn export_json(analise: &Analise, objeto: &Objeto, regiao_proveniencia: &str) -> String {
    export_valor(analise, objeto, regiao_proveniencia).pretty()
}

/// Resumo humano com os MESMOS numeros do JSON (o teste compara as contagens).
pub fn export_markdown(analise: &Analise, objeto: &Objeto, regiao_proveniencia: &str) -> String {
    let mut out = String::new();
    out.push_str(&format!("# {SCHEMA} — analise de fluxo delimitada\n\n"));
    out.push_str(&format!(
        "- objeto: `{}` — SHA-256 `{}` — {} bytes\n",
        objeto.caminho_declarado,
        rex_gameplay::sha256::sha256_hex(objeto.bytes),
        objeto.bytes.len()
    ));
    out.push_str(&format!(
        "- regiao: {:#06x}..{:#06x} (fim exclusivo) — proveniencia: {}\n",
        analise.regiao.0, analise.regiao.1, regiao_proveniencia
    ));
    out.push_str(&format!(
        "- blocos: {} | arestas: {} | chamadas: {} | fronteiras: {}\n",
        analise.blocos.len(),
        analise.arestas.len(),
        analise.chamadas.len(),
        analise.fronteiras.len()
    ));
    out.push_str(&format!(
        "- cobertura: {} de {} bytes ({})\n\n",
        analise.cobertura.bytes_decodificados,
        analise.cobertura.bytes_regiao,
        analise.cobertura.fracao
    ));

    if !analise.cobertura.vaos.is_empty() {
        out.push_str("## Vaoes nao decodificados\n\n");
        for v in &analise.cobertura.vaos {
            out.push_str(&format!("- {:#06x}..{:#06x}\n", v.inicio, v.fim));
        }
        out.push('\n');
    }

    out.push_str("## Raizes (grau como declarado; nunca promovido)\n\n");
    for r in &analise.raizes {
        out.push_str(&format!(
            "- {:#06x} — proveniencia `{}` — grau `{}`{}\n",
            r.endereco,
            r.proveniencia,
            r.grau,
            if r.derivada {
                " (derivada desta analise)"
            } else {
                ""
            }
        ));
    }
    out.push('\n');

    if !analise.fronteiras.is_empty() {
        out.push_str("## Fronteiras (onde o caminho para)\n\n");
        for f in &analise.fronteiras {
            out.push_str(&format!(
                "- {:#06x} `{}` opcode {} — {}\n",
                f.endereco,
                f.tipo,
                match f.opcode {
                    Some(op) => format!("{op:#06x}"),
                    None => "nulo".to_string(),
                },
                f.motivo
            ));
        }
        out.push('\n');
    }

    if !analise.chamadas.is_empty() {
        out.push_str("## Chamadas (`params` nao-inferidos, `clobbers` nao-modelado)\n\n");
        for c in &analise.chamadas {
            out.push_str(&format!(
                "- {:#06x} `{}` → {} [{}] — params: {}, clobbers: {}\n",
                c.sitio,
                c.forma,
                match c.alvo {
                    Some(a) => format!("{a:#06x}"),
                    None => "desconhecido".to_string(),
                },
                c.status.label(),
                c.params,
                c.clobbers
            ));
        }
        out.push('\n');
    }

    if !analise.sitios.is_empty() {
        out.push_str("## Veredito dos sitios consultados\n\n");
        for s in &analise.sitios {
            out.push_str(&format!(
                "- {:#06x} → `{}`{}\n",
                s.endereco,
                s.veredito,
                match s.bloco {
                    Some(b) => format!(" (bloco {:#06x})", b),
                    None => String::new(),
                }
            ));
        }
        out.push('\n');
    }

    out.push_str("## Limites assumidos\n\n");
    for l in &analise.limites {
        out.push_str(&format!("- {l}\n"));
    }
    if analise.atingiu_limite_de_trabalho {
        out.push_str(
            "\n- **limite-de-trabalho atingido**: a analise parou por `--max-insn`, \
                      nao por exaustao do fluxo.\n",
        );
    }
    out
}
