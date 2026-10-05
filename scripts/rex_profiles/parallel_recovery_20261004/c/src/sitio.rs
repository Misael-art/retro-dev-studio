//! `rex-cfg consultar` — verificador estrutural de UM sítio, export
//! `rex-cfg-sitio/v1` (EXPECTATIONS-ETAPA2.md §5).
//!
//! Este módulo é a barreira propriamente dita. Ele não descobre código: recebe
//! região, raízes explícitas e um sítio, e responde se aquele sítio é um
//! **consumidor validado** de um endereço. A resposta é sempre um objeto JSON
//! plano, consumível pelo parser de `rex-kosinski-chain` (frente A), e nunca
//! alega runtime (V4).
//!
//! As quatro condições de V1 são avaliadas uma a uma e cada falha vira um
//! motivo legível em `motivos`:
//!
//! 1. instrução **provada** começando exatamente no sítio (veredito
//!    `instrucao-de-bloco`);
//! 2. o bloco que a contém está em fluxo alcançado a partir de raiz declarada;
//! 3. a classe é de transferência incondicional do subconjunto (`bsr`, `jsr`,
//!    `jmp`, `bra`) **com alvo comprovado**;
//! 4. o alvo registrado pelo grafo é igual ao operando **re-derivado dos bytes**
//!    pelas regras da matriz §1 (base sempre `instr+2`). É a equivalência que A
//!    usa em `carga_operando == fluxo_cpu`; reimplementá-la aqui, à parte do
//!    decoder, é o que faz um alvo inventado — como o `jsr abs.w` que A publica
//!    para `4E FA` — falhar em vez de passar.
//!
//! V2 é o portão de promoção: só `referencia-estatica` e `vetor-plataforma`
//! autorizam vínculo, e só quando a raiz que autoriza alcança o próprio sítio
//! (medido por análise de raiz única, nunca por agregado entre raízes).

use rex_gameplay::json::Json;

use crate::export::BASE_SHA;
use crate::grafo::{
    analisar_com_evidencias, Analise, Bloco, InstrucaoView, RaizDeclarada, Status, Tipo, Veredito,
};

pub const SCHEMA: &str = "rex-cfg-sitio/v1";
pub const TOOL_NAME: &str = "rex-cfg";

/// Famílias de transferência incondicional aceitas como consumidor (V1-iii).
const TRANSFERENCIA: &[&str] = &["bsr", "jsr", "jmp", "bra"];

/// Proveniências que autorizam promover a `vinculo-estrutural` (V2).
const AUTORIZA_VINCULO: &[&str] = &["referencia-estatica", "vetor-plataforma"];

/// Textos fixos de limite do objeto de sítio. São ASCII por contrato (§5: o
/// parser de A rejeita byte não-ASCII e qualquer escape), por isso não são os
/// textos de `grafo::LIMITES`, que carregam acentos.
const LIMITES_SITIO: &[&str] = &[
    "analise intra-regiao apenas; fluxo que sai da regiao termina na fronteira",
    "sem execucao: nada aqui prova consumo em runtime (observado-em-runtime nao e alegado)",
    "consumidor-validado e estrutural: paridade com objdump nao equivale a observacao em runtime",
    // EXPECTATIONS-ETAPA2 §1.1: o alvo de `(xxx).W` sai como operando bruto sob
    // esta hipotese; a extensao nao foi resolvida por fonte primaria.
    "extensao-abs-w-hipotese-zero-extendida",
];

const LIMITE_NAO_PROMOVIDA: &str = "raiz-declarada-nao-promovida";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StatusAlvo {
    Resolvido,
    ForaDaRegiao,
    IndiretoOpaco,
    Armadilha,
    Ausente,
}

impl StatusAlvo {
    fn from(s: Status) -> Self {
        match s {
            Status::Resolvido => StatusAlvo::Resolvido,
            Status::ForaDaRegiao => StatusAlvo::ForaDaRegiao,
            Status::IndiretoOpaco => StatusAlvo::IndiretoOpaco,
            Status::Armadilha => StatusAlvo::Armadilha,
        }
    }
    fn label(self) -> &'static str {
        match self {
            StatusAlvo::Resolvido => "resolvido",
            StatusAlvo::ForaDaRegiao => "fora-da-regiao",
            StatusAlvo::IndiretoOpaco => "indireto-opaco",
            StatusAlvo::Armadilha => "armadilha",
            StatusAlvo::Ausente => "ausente",
        }
    }
}

/// Parâmetros de uma consulta. `buf` é o objeto já deslocado por `--origin`,
/// de modo que endereço == índice, como em `analyze`; `arquivo` são os bytes
/// como lidos, que dão a identidade (SHA-256 e tamanho) do objeto.
#[derive(Debug)]
pub struct Pedido<'a> {
    pub buf: &'a [u8],
    pub arquivo: &'a [u8],
    pub regiao: (u32, u32),
    pub raizes: &'a [RaizDeclarada],
    pub sitio: u32,
    pub max_insn: u64,
}

fn hex(v: u32) -> String {
    format!("0x{v:06X}")
}

fn hex_json(v: u32) -> Json {
    Json::str(hex(v))
}

fn bloco_que_cobre(a: &Analise, endereco: u32) -> Option<&Bloco> {
    a.blocos.iter().find(|b| {
        b.instrucoes
            .iter()
            .any(|i| endereco >= i.endereco && endereco < i.endereco + u32::from(i.tam))
    })
}

fn instrucao_em(a: &Analise, endereco: u32) -> Option<&InstrucaoView> {
    a.blocos
        .iter()
        .flat_map(|b| b.instrucoes.iter())
        .find(|i| i.endereco == endereco)
}

/// Instrução comprovada que engole o endereço (miolo), quando houver.
fn instrucao_cobridora(a: &Analise, endereco: u32) -> Option<u32> {
    a.blocos
        .iter()
        .flat_map(|b| b.instrucoes.iter())
        .find(|i| endereco > i.endereco && endereco < i.endereco + u32::from(i.tam))
        .map(|i| i.endereco)
}

/// Alvo e status da transferência que sai do sítio. `chamadas` é a fonte
/// primária (bsr/jsr/jmp registrados pelo grafo); sem ela, uma aresta de desvio
/// (Bcc/DBcc) ainda comprova um alvo — que a regra de classe trata depois.
fn transferencia(a: &Analise, sitio: u32) -> Option<(Option<u32>, StatusAlvo)> {
    if let Some(c) = a.chamadas.iter().find(|c| c.sitio == sitio) {
        return Some((c.alvo, StatusAlvo::from(c.status)));
    }
    let mut desvios = a
        .arestas
        .iter()
        .filter(|e| e.origem == sitio && e.tipo == Tipo::Desvio)
        .map(|e| (e.alvo, StatusAlvo::from(e.status)));
    let com_alvo = desvios.by_ref().find(|(alvo, _)| alvo.is_some())?;
    Some(com_alvo)
}

/// V1-iv: re-derive o alvo **dos bytes**, sem consultar o grafo, pelas regras
/// da matriz §1 — deslocamento relativo sempre com base `instr+2`, `(xxx).W`
/// lido como word sob a hipótese de extensão declarada em §1.1.
///
/// `None` é resposta, não erro: `4E FA`/`4E FC`/`4E FD` são justamente as
/// formas que a frente A rotula como `jsr abs.w` e publica alvo inventado.
fn rederivar(buf: &[u8], sitio: u32) -> Option<u32> {
    let i = sitio as usize;
    let word = |k: usize| -> Option<u16> {
        let a = buf.get(k..k + 2)?;
        Some(u16::from_be_bytes([a[0], a[1]]))
    };
    let long = |k: usize| -> Option<u32> {
        let a = buf.get(k..k + 4)?;
        Some(u32::from_be_bytes([a[0], a[1], a[2], a[3]]))
    };
    /// `instr+2+disp`, com desvio de sinal; alvo fora do espaço de 32 bits = None
    fn soma(base: u32, disp: i32) -> Option<u32> {
        u32::try_from(i64::from(base) + i64::from(disp)).ok()
    }
    let op = word(i)?;
    let alto = (op >> 8) as u8;
    let baixo = op as u8;
    if alto & 0xF0 == 0x60 {
        // BRA/BSR/Bcc: disp16(PC) quando o byte baixo é nulo; senão disp8(PC).
        let disp = if baixo == 0 {
            i32::from(word(i + 2)? as i16)
        } else {
            i32::from(baixo as i8)
        };
        return soma(sitio + 2, disp);
    }
    if alto == 0x51 && baixo & 0xF8 == 0xC8 {
        // DBcc: word de condição + disp16 com base instr+2.
        return soma(sitio + 2, i32::from(word(i + 2)? as i16));
    }
    if alto == 0x4E {
        return match baixo {
            0xB8 | 0xF8 => u32::from(word(i + 2)?).into(),
            0xB9 | 0xF9 => long(i + 2),
            _ => None,
        };
    }
    None
}

/// O sítio é `JSR/JMP (xxx).W` (`4EB8`/`4EF8`) com o **word** de operando com
/// bit15 ligado? É a única forma pelo qual o alvo alegado depende de uma
/// interpretação não resolvida por fonte primária (§1.1); `(xxx).L` publica a
/// longword inteira e não tem essa pendência. Bytes insuficientes = falso.
fn absw_bit15(buf: &[u8], sitio: u32) -> bool {
    let Some(quarteto) = buf.get(sitio as usize..sitio as usize + 4) else {
        return false;
    };
    let op = u16::from_be_bytes([quarteto[0], quarteto[1]]);
    let operando = u16::from_be_bytes([quarteto[2], quarteto[3]]);
    matches!(op, 0x4EB8 | 0x4EF8) && operando & 0x8000 != 0
}

/// Roda a análise com uma única raiz e pergunta se o sítio é instrução de bloco
/// **a partir dela** — alcançabilidade por raiz, não agregado (§3 A4, §5 V2).
fn raiz_alcanca(p: &Pedido, raiz: &RaizDeclarada) -> Result<bool, String> {
    let a = analisar_com_evidencias(
        p.buf,
        std::slice::from_ref(raiz),
        p.regiao,
        &[p.sitio],
        p.max_insn,
    )?;
    Ok(a.veredito_sitio(p.sitio) == Veredito::InstrucaoDeBloco)
}

/// Responde à consulta no objeto `rex-cfg-sitio/v1`. `Err` é só falha de
/// análise (código de saída 1); erro de uso pertence à CLI.
pub fn consultar(p: &Pedido) -> Result<Json, String> {
    let declared: Vec<RaizDeclarada> = p.raizes.to_vec();
    let analise = analisar_com_evidencias(p.buf, &declared, p.regiao, &[p.sitio], p.max_insn)?;
    let veredito = analise.veredito_sitio(p.sitio);
    let dentro_de_bloco = veredito == Veredito::InstrucaoDeBloco;
    let mut motivos: Vec<String> = Vec::new();

    // V1-i — instrução provada começando exatamente no sítio.
    let instrucao: Option<InstrucaoView> = instrucao_em(&analise, p.sitio).cloned();
    if !dentro_de_bloco {
        motivos.push(veredito.label().to_string());
        if p.sitio % 2 == 1 {
            motivos.push("sitio-impar".to_string());
        }
        if let Some(cobridora) = instrucao_cobridora(&analise, p.sitio) {
            motivos.push(format!("miolo-de-instrucao:{}", hex(cobridora)));
        }
    } else if instrucao.is_none() {
        motivos.push("sem-instrucao-provada-no-sitio".to_string());
    }

    // V1-ii — bloco em fluxo alcançado a partir de raiz declarada.
    let bloco = bloco_que_cobre(&analise, p.sitio);
    if dentro_de_bloco {
        match bloco {
            None => motivos.push("bloco-ausente".to_string()),
            Some(b) if b.alcancado_por.is_empty() => {
                motivos.push("bloco-sem-origem-declarada".to_string())
            }
            Some(_) => {}
        }
    }

    // V1-iii — classe de transferência incondicional com alvo comprovado.
    let (alvo, status) = match transferencia(&analise, p.sitio) {
        Some((a, s)) => (a, s),
        None => (None, StatusAlvo::Ausente),
    };
    let classe: Option<String> = instrucao.as_ref().map(|i| i.classe.clone());
    if dentro_de_bloco {
        match classe.as_deref() {
            None => motivos.push("classe-desconhecida".to_string()),
            Some(c) if !TRANSFERENCIA.contains(&c) => {
                motivos.push(format!("classe-condicional:{c}"))
            }
            Some(_) if alvo.is_none() => motivos.push("alvo-nao-comprovado".to_string()),
            Some(_) => {}
        }
    }

    // V1-iv — alvo do grafo == operando medido, re-derivado dos bytes. Só se
    // aplica quando o grafo ALEGA um alvo: a alegação é o que tem de ser
    // justificado. Um sítio sem alegação já foi reprovado por V1-iii com
    // `alvo-nao-comprovado`, e reprová-lo duas vezes poluiria o motivo.
    let eh_transferencia = dentro_de_bloco
        && classe
            .as_deref()
            .is_some_and(|c| TRANSFERENCIA.contains(&c));
    if eh_transferencia {
        if let Some(registrado) = alvo {
            let operando = rederivar(p.buf, p.sitio);
            if operando != Some(registrado) {
                motivos.push(format!(
                    "equivalencia-operando-alvo:grafo={} operando={}",
                    hex(registrado),
                    operando.map(hex).unwrap_or_else(|| "nulo".to_string())
                ));
            }
        }
    }

    let consumidor = motivos.is_empty();

    // §1.1 P-absW — registro informativo, nunca veredito: entra DEPOIS de
    // `consumidor` ser calculado justamente porque nenhuma classificacao
    // estrutural pode depender da interpretacao de `(xxx).W`. O alvo publicado
    // permanece o operando bruto, sob a hipotese declarada em `limites`.
    if alvo.is_some() && absw_bit15(p.buf, p.sitio) {
        motivos.push("interpretacao-pendente:abs-w-bit15".to_string());
    }

    // V2 — portão de promoção.
    let mut promotivel = false;
    if consumidor {
        for r in p.raizes {
            if AUTORIZA_VINCULO.contains(&r.proveniencia.as_str()) && raiz_alcanca(p, r)? {
                promotivel = true;
                break;
            }
        }
        if !promotivel {
            let provs: Vec<&str> = p.raizes.iter().map(|r| r.proveniencia.as_str()).collect();
            motivos.push(format!(
                "proveniencia-nao-autoriza-vinculo:{}",
                provs.join("+")
            ));
        }
    }

    let mut limites: Vec<&'static str> = LIMITES_SITIO.to_vec();
    if consumidor && !promotivel {
        limites.push(LIMITE_NAO_PROMOVIDA);
    }

    Ok(exportar(
        p,
        veredito.label(),
        &instrucao,
        bloco.map(|b| b.entrada),
        alvo,
        status,
        consumidor,
        promotivel,
        motivos,
        limites,
    ))
}

#[allow(clippy::too_many_arguments)]
fn exportar(
    p: &Pedido,
    veredito: &'static str,
    instrucao: &Option<InstrucaoView>,
    bloco: Option<u32>,
    alvo: Option<u32>,
    status: StatusAlvo,
    consumidor: bool,
    promotivel: bool,
    motivos: Vec<String>,
    limites: Vec<&'static str>,
) -> Json {
    // Sítio que não é início de instrução comprovada não tem instrução: os
    // campos `instrucao-*` são nulos inclusive no caso `miolo-de-instrucao`,
    // onde a instrução cobridora é reportada em `motivos`.
    let provada = (veredito == "instrucao-de-bloco").then_some(instrucao.as_ref());
    Json::obj(vec![
        ("schema", Json::str(SCHEMA)),
        ("ferramenta", Json::str(TOOL_NAME)),
        ("versao", Json::str(env!("CARGO_PKG_VERSION"))),
        ("base-sha", Json::str(BASE_SHA)),
        (
            "objeto-sha256",
            Json::str(rex_gameplay::sha256::sha256_hex(p.arquivo)),
        ),
        ("objeto-tamanho", Json::Int(p.arquivo.len() as i64)),
        ("regiao-inicio", hex_json(p.regiao.0)),
        ("regiao-fim", hex_json(p.regiao.1)),
        (
            "raizes",
            Json::Arr(p.raizes.iter().map(|r| hex_json(r.endereco)).collect()),
        ),
        (
            "proveniencias",
            Json::Arr(
                p.raizes
                    .iter()
                    .map(|r| Json::str(r.proveniencia.clone()))
                    .collect(),
            ),
        ),
        ("sitio", hex_json(p.sitio)),
        ("veredito", Json::str(veredito)),
        ("bloco", bloco.map(hex_json).unwrap_or(Json::Null)),
        (
            "instrucao-tam",
            match provada.flatten() {
                Some(i) => Json::Int(i64::from(i.tam)),
                None => Json::Null,
            },
        ),
        (
            "instrucao-classe",
            match provada.flatten() {
                Some(i) => Json::str(i.classe.clone()),
                None => Json::Null,
            },
        ),
        (
            "instrucao-mnem",
            match provada.flatten() {
                Some(i) => Json::str(i.mnem.clone()),
                None => Json::Null,
            },
        ),
        ("alvo", alvo.map(hex_json).unwrap_or(Json::Null)),
        ("alvo-status", Json::str(status.label())),
        (
            "consumidor-validado",
            Json::str(if consumidor { "sim" } else { "nao" }),
        ),
        (
            "promovivel-vinculo-estrutural",
            Json::str(if promotivel { "sim" } else { "nao" }),
        ),
        (
            "motivos",
            Json::Arr(motivos.into_iter().map(Json::str).collect()),
        ),
        (
            "limites",
            Json::Arr(limites.into_iter().map(Json::str).collect()),
        ),
    ])
}
