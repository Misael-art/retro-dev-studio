//! `rex-cfg medir` — export de medições `rex-cfg-med/v2` para a frente D
//! (EXPECTATIONS-ETAPA2.md §6, obrigação 8).
//!
//! As quatro dimensões saem **separadas**, cada uma com o seu próprio
//! denominador, e nenhuma soma entre elas existe no objeto (A4/§6):
//!
//! | dimensão | unidade | denominador |
//! |---|---|---|
//! | comprimento | instruções provadas | bytes da região |
//! | operandos | palavras de extensão | instruções com extensão |
//! | fluxo | arestas por `(tipo,status)` | blocos alcançados |
//! | alcance | bytes decodificados | bytes da região |
//!
//! MD2 é a razão de `operandos-valores-status = "recusado"`: os valores dos
//! operandos **são** bytes literais do objeto, e o export não carrega byte
//! nenhum da ROM. A contagem de extensões é aritmética exata sobre os
//! comprimentos já provados (subseto fechado: todo opcode com extensão tem
//! extensão em palavras de 2 bytes), não uma alegação sobre efetividade de
//! modo de endereçamento.
//!
//! MD4: `status` por dimensão ∈ {`medido`, `pendente`, `recusado`}. Os números
//! continuam presentes quando o trabalho foi truncado por `--max-insn`; o que
//! muda é o status, que passa a `pendente` nas quatro dimensões — contagem
//! truncada não é cobertura.
//!
//! MD1: os três textos de `limites` são fixos. O §6 os grava com acentos; a
//! saída desta frente é ASCII-only (mesma regra V5 de §5, que vale para todo
//! objeto emitido por `rex-cfg`), então a grafia é sem acento — normalização
//! de grafia, não de sentido, registrada em CONTRACT §3.

use rex_gameplay::json::Json;

use crate::export::BASE_SHA;
use crate::grafo::{analisar_com_evidencias, Analise, RaizDeclarada};

pub const SCHEMA: &str = "rex-cfg-med/v2";
pub const TOOL_NAME: &str = "rex-cfg";

/// MD1 — textos fixos do export de medições (grafia ASCII, ver cabeçalho).
const LIMITES_MED: &[&str] = &[
    "paridade com objdump nao equivale a observacao em runtime",
    "nenhuma dimensao promove outra",
    "sem execucao, sem DAC, sem VRAM",
];

/// MD4 — vocabulário de status por dimensão.
const MEDIDO: &str = "medido";
const PENDENTE: &str = "pendente";
const RECUSADO: &str = "recusado";

/// Motivo pelo qual nenhum valor de operando sai daqui (MD2).
const MOTIVO_VALORES: &str = "md2:nenhum-byte-literal-do-objeto-no-export";

/// Parâmetros de uma medição. `buf` é o objeto já deslocado por `--origin`, de
/// modo que endereço == índice; `arquivo` são os bytes como lidos, que dão a
/// identidade (SHA-256 e tamanho) do objeto. Uma única raiz: §3 A4 proíbe
/// agregado, e o denominador de cada dimensão é o desta execução.
#[derive(Debug)]
pub struct Pedido<'a> {
    pub buf: &'a [u8],
    pub arquivo: &'a [u8],
    pub origin: u32,
    pub regiao: (u32, u32),
    pub raiz: &'a RaizDeclarada,
    pub max_insn: u64,
}

fn hex(v: u32) -> String {
    format!("0x{v:06X}")
}

fn hex_json(v: u32) -> Json {
    Json::str(hex(v))
}

fn int(v: i64) -> Json {
    Json::Int(v)
}

/// Histograma determinístico `chave=N`, ordenado por chave.
fn histograma(chaves: &[String]) -> Vec<String> {
    let mut ordenadas = chaves.to_vec();
    ordenadas.sort();
    let mut saida: Vec<(String, i64)> = Vec::new();
    for c in ordenadas {
        match saida.last_mut() {
            Some((ultima, q)) if *ultima == c => *q += 1,
            _ => saida.push((c, 1)),
        }
    }
    saida.into_iter().map(|(c, q)| format!("{c}={q}")).collect()
}

/// Dimensões 1 e 2 — comprimento e operandos, a partir dos comprimentos já
/// provados pelo grafo. Nada aqui re-decodifica: os nós são exatamente os que
/// a análise alegou.
fn dimensoes_de_instrucao(a: &Analise) -> (i64, Vec<String>, i64, i64) {
    let mut tamanhos: Vec<i64> = Vec::new();
    let mut com_extensao: i64 = 0;
    let mut palavras: i64 = 0;
    for b in &a.blocos {
        for i in &b.instrucoes {
            let tam = i64::from(i.tam);
            tamanhos.push(tam);
            if tam > 2 {
                com_extensao += 1;
                palavras += (tam - 2) / 2;
            }
        }
    }
    let nos = i64::try_from(tamanhos.len()).expect("contagem de instrucoes provadas");
    // Histograma `tamanho=quantidade`, ordenado por tamanho crescente para não
    // depender da ordem de visita dos blocos.
    let mut pares: Vec<(i64, i64)> = Vec::new();
    for tam in tamanhos {
        match pares.iter_mut().find(|(k, _)| *k == tam) {
            Some((_, q)) => *q += 1,
            None => pares.push((tam, 1)),
        }
    }
    pares.sort();
    let por_tamanho = pares.into_iter().map(|(t, q)| format!("{t}={q}")).collect();
    (nos, por_tamanho, com_extensao, palavras)
}

/// Dimensão 3 — fluxo: arestas agrupadas por `(tipo,status)`.
fn fluxo_por_tipo(a: &Analise) -> Vec<String> {
    let chaves: Vec<String> = a
        .arestas
        .iter()
        .map(|e| format!("{}/{}", e.tipo.label(), e.status.label()))
        .collect();
    histograma(&chaves)
}

/// Dimensão 4 — alcance: fronteiras agrupadas por tipo.
fn fronteiras_por_tipo(a: &Analise) -> Vec<String> {
    let chaves: Vec<String> = a.fronteiras.iter().map(|f| f.tipo.clone()).collect();
    histograma(&chaves)
}

/// Roda a análise de raiz única e exporta as quatro dimensões. `Err` é só
/// falha de análise (código 1); erro de uso pertence à CLI.
pub fn medir(p: &Pedido) -> Result<Json, String> {
    let analise = analisar_com_evidencias(
        p.buf,
        std::slice::from_ref(p.raiz),
        p.regiao,
        &[],
        p.max_insn,
    )?;

    let truncado = analise.atingiu_limite_de_trabalho;
    let status = if truncado { PENDENTE } else { MEDIDO };

    let bytes_regiao = i64::from(analise.regiao.1 - analise.regiao.0);
    let (nos, por_tamanho, com_extensao, palavras) = dimensoes_de_instrucao(&analise);
    let fluxo = fluxo_por_tipo(&analise);
    let fronteiras = fronteiras_por_tipo(&analise);

    // Identidade do objeto = bytes do arquivo como lido, sem o preenchimento de
    // base: --origin desloca endereços, não o conteúdo (MD3).
    let sha = rex_gameplay::sha256::sha256_hex(p.arquivo);
    let comando = format!(
        "rex-cfg medir --bin sha256={sha} --origin {} --region {}:{} --root {} --root-prov {} \
         --max-insn {} --out <arquivo>",
        hex(p.origin),
        hex(analise.regiao.0),
        hex(analise.regiao.1),
        hex(p.raiz.endereco),
        p.raiz.proveniencia,
        p.max_insn,
    );

    let pendencia: Vec<String> = if truncado {
        vec!["limite-de-trabalho".to_string()]
    } else {
        Vec::new()
    };

    Ok(Json::obj(vec![
        ("schema", Json::str(SCHEMA)),
        ("ferramenta", Json::str(TOOL_NAME)),
        ("versao", Json::str(env!("CARGO_PKG_VERSION"))),
        ("base-sha", Json::str(BASE_SHA)),
        ("objeto-sha256", Json::str(sha)),
        ("objeto-tamanho", int(p.arquivo.len() as i64)),
        ("regiao-inicio", hex_json(analise.regiao.0)),
        ("regiao-fim", hex_json(analise.regiao.1)),
        ("raiz", hex_json(p.raiz.endereco)),
        ("raiz-proveniencia", Json::str(p.raiz.proveniencia.clone())),
        ("comando", Json::str(comando)),
        // --- comprimento ---
        ("comprimento-status", Json::str(status)),
        ("comprimento-unidade", Json::str("instrucoes-provadas")),
        ("comprimento-instrucoes-provadas", int(nos)),
        ("comprimento-bytes-regiao", int(bytes_regiao)),
        (
            "comprimento-por-tamanho",
            Json::Arr(por_tamanho.into_iter().map(Json::str).collect()),
        ),
        // --- operandos ---
        ("operandos-status", Json::str(status)),
        ("operandos-unidade", Json::str("palavras-de-extensao")),
        ("operandos-instrucoes-com-extensao", int(com_extensao)),
        ("operandos-palavras-de-extensao", int(palavras)),
        ("operandos-valores-status", Json::str(RECUSADO)),
        ("operandos-valores-motivo", Json::str(MOTIVO_VALORES)),
        // --- fluxo ---
        ("fluxo-status", Json::str(status)),
        ("fluxo-unidade", Json::str("arestas")),
        ("fluxo-blocos-alcancados", int(analise.blocos.len() as i64)),
        ("fluxo-arestas", int(analise.arestas.len() as i64)),
        (
            "fluxo-por-tipo-status",
            Json::Arr(fluxo.into_iter().map(Json::str).collect()),
        ),
        // --- alcance ---
        ("alcance-status", Json::str(status)),
        ("alcance-unidade", Json::str("bytes")),
        (
            "alcance-bytes-decodificados",
            int(i64::from(analise.cobertura.bytes_decodificados)),
        ),
        (
            "alcance-bytes-regiao",
            int(i64::from(analise.cobertura.bytes_regiao)),
        ),
        (
            "alcance-fracao",
            Json::str(analise.cobertura.fracao.clone()),
        ),
        ("alcance-vaos", int(analise.cobertura.vaos.len() as i64)),
        (
            "alcance-fronteiras-por-tipo",
            Json::Arr(fronteiras.into_iter().map(Json::str).collect()),
        ),
        // --- A4: nada soma as quatro dimensões ---
        ("agregado", Json::str("proibido")),
        (
            "pendencia-motivos",
            Json::Arr(pendencia.into_iter().map(Json::str).collect()),
        ),
        (
            "limites",
            Json::Arr(LIMITES_MED.iter().map(|s| Json::str(*s)).collect()),
        ),
    ]))
}
