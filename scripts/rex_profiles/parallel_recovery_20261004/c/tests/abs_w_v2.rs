//! ETAPA 3 §1 (E1-1, E1-6) — `(xxx).W` é **sign-estendida** antes de ser usada.
//!
//! Fonte: M68000PRM §2.2.16 (Apêndice A das expectativas congeladas), não o
//! decoder. Os comprimentos e codificações abaixo foram medidos no instrumento
//! pinado (sondas S1..S12): a word de extensão vem colada na palavra de
//! instrução, `4EB8`/`4EF8` são `JSR`/`JMP (xxx).W` e `4EB9`/`4EF9` as formas
//! longas.
//!
//! Cada caso discriminante registra explicitamente o valor que a **hipótese
//! antiga** (zero-extensão, ETAPA 1/2) produziria e assera que ele não é
//! produzido. Casos em que as duas leituras coincidem (`0x7FFF`, `0x0000`) ficam
//! no arquivo de propósito: E1-1 exige que Q1 = a word lida nesses casos, e um
//! verificador que só olha bit15 = 1 não distinguisheria uma regressão que
//! zerasse a extensão toda.

use rex_cfg::decode::{decode_at, Flow, Outcome};
use rex_cfg::grafo::RaizDeclarada;
use rex_cfg::sitio::{consultar, Pedido};
use rex_gameplay::json::Json;
use std::path::{Path, PathBuf};

fn bytes_de(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .map(|t| u16::from_str_radix(t, 16).unwrap_or_else(|_| panic!("token invalido {t}")))
        .flat_map(|w| [(w >> 8) as u8, w as u8])
        .collect()
}

fn alvo_de(outcome: &Outcome) -> Option<u32> {
    match outcome {
        Outcome::Insn(i) => match &i.flow {
            Flow::Call { target } | Flow::Jmp { target } => Some(*target),
            _ => None,
        },
        Outcome::Frontier(_) => None,
    }
}

/// (bytes, endereco, alvo efetivo correto, alvo que a zero-extensao daria,
/// discriminante?).
const ABS_W: &[(&str, u32, u32, u32, bool)] = &[
    ("4EB8 8000", 0x1000, 0xFFFF_8000, 0x0000_8000, true),
    ("4EB8 FFFE", 0x1000, 0xFFFF_FFFE, 0x0000_FFFE, true),
    ("4EB8 7FFF", 0x1000, 0x0000_7FFF, 0x0000_7FFF, false),
    ("4EB8 0000", 0x1000, 0x0000_0000, 0x0000_0000, false),
    ("4EF8 8000", 0x1000, 0xFFFF_8000, 0x0000_8000, true),
    ("4EF8 F000", 0x1000, 0xFFFF_F000, 0x0000_F000, true),
];

#[test]
fn jsr_jmp_abs_w_tem_alvo_sign_estendido_e_nao_zero_estendido() {
    for (hex, addr, correta, zero_ext, discriminante) in ABS_W {
        let buf = bytes_de(hex);
        let outcome = decode_at(&buf, *addr);
        let alvo = alvo_de(&outcome).unwrap_or_else(|| {
            panic!("{hex} em {addr:#06x}: sem alvo declarado, outcome {outcome:?}")
        });
        assert_eq!(
            alvo, *correta,
            "{hex} em {addr:#06x}: PRM 2.2.16 da {correta:#010x}, a ferramenta deu {alvo:#010x}"
        );
        if *discriminante {
            assert_ne!(
                alvo, *zero_ext,
                "{hex}: a hipotese aposentada (zero-extensao) produziria {zero_ext:#010x}; \
                 este valor esta registrado como NAO produzido"
            );
        }
    }
}

/// E1-6 — as formas longas não sofrem sign-extensão (PRM §2.2.17) e não podem
/// colapsar com as curtas: `4EB9 8000 0000` vale 0x80000000 enquanto
/// `4EB8 0000` vale 0.
const ABS_L: &[(&str, u32, u32)] = &[
    ("4EB9 8000 0000", 0x1000, 0x8000_0000),
    ("4EF9 8000 0000", 0x1000, 0x8000_0000),
    ("4EB9 FFFF 8000", 0x1000, 0xFFFF_8000),
    ("4EB9 0000 0004", 0x1000, 0x0000_0004),
];

#[test]
fn abs_l_mantem_a_longword_inteira() {
    for (hex, addr, correta) in ABS_L {
        let buf = bytes_de(hex);
        let outcome = decode_at(&buf, *addr);
        let alvo = alvo_de(&outcome)
            .unwrap_or_else(|| panic!("{hex} em {addr:#06x}: sem alvo, outcome {outcome:?}"));
        assert_eq!(
            alvo, *correta,
            "{hex}: esperado {correta:#010x}, obtido {alvo:#010x}"
        );
    }
    // nao-colapso explicito: mesmo operando baixo, as duas familias dao alvos
    // diferentes.
    let curta = alvo_de(&decode_at(&bytes_de("4EB8 0000"), 0x1000)).unwrap();
    let longa = alvo_de(&decode_at(&bytes_de("4EB9 0000 0000"), 0x1000)).unwrap();
    assert_eq!(
        curta, longa,
        "ambos zero: coincidencia numerica, nao fusao de campos"
    );
    let curta_topo = alvo_de(&decode_at(&bytes_de("4EB8 0001"), 0x1000)).unwrap();
    let longa_topo = alvo_de(&decode_at(&bytes_de("4EB9 0001 0000"), 0x1000)).unwrap();
    assert_ne!(
        curta_topo, longa_topo,
        "as familias nao podem colapsar: (0x0001).w e (0x00010000).l"
    );
}

/// N1 (obrigação 7) — sinal no operando não vaza para o comprimento: as quatro
/// formas de `4EB8` têm 4 bytes e as de `4EB9` têm 6, com bit15 ligado ou não.
#[test]
fn o_sinal_do_operando_nao_muda_o_comprimento() {
    for (hex, len) in [
        ("4EB8 8000", 4u16),
        ("4EB8 7FFF", 4),
        ("4EF8 F000", 4),
        ("4EB9 8000 0000", 6),
        ("4EF9 FFFF FFFF", 6),
    ] {
        let buf = bytes_de(hex);
        match decode_at(&buf, 0x1000) {
            Outcome::Insn(i) => assert_eq!(i.len, len, "{hex}: comprimento {:#x}", i.len),
            other => panic!("{hex}: esperado instrucao, obtido {other:?}"),
        }
    }
}

// ---------------------------------------------------------------------------
// Bloco de endereço no objeto `rex-cfg-sitio/v2` (E1-2, E1-3, E1-4, E1-5)
// ---------------------------------------------------------------------------

fn h(v: u32) -> String {
    format!("0x{v:06X}")
}

fn fixture(nome: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join(format!("{nome}.bin"))
}

fn ler_fixture(nome: &str) -> Vec<u8> {
    std::fs::read(fixture(nome)).unwrap_or_else(|e| panic!("ler {}: {e}", nome))
}

fn raiz(endereco: u32, proveniencia: &str) -> RaizDeclarada {
    RaizDeclarada {
        endereco,
        proveniencia: proveniencia.to_string(),
        evidencia: None,
    }
}

/// Despacho pelo caminho canônico (mesma função que a CLI chama), com origem
/// declarada — `--origin` é o mapeamento que autoriza Q4.
fn sítio(
    arquivo: &[u8],
    origin: u32,
    regiao: (u32, u32),
    raizes: &[RaizDeclarada],
    s: u32,
) -> Json {
    let mut buf: Vec<u8> = vec![0; origin as usize];
    buf.extend_from_slice(arquivo);
    let p = Pedido {
        buf: &buf,
        arquivo,
        origin,
        regiao,
        raizes,
        sitio: s,
        max_insn: 5000,
    };
    consultar(&p).unwrap_or_else(|e| panic!("consultar {s:#x}: {e}"))
}

fn str_field(j: &Json, k: &str) -> Option<String> {
    match j.get(k) {
        None => panic!("chave {k} ausente: {}", j.pretty()),
        Some(Json::Null) => None,
        Some(v) => Some(
            v.as_str()
                .unwrap_or_else(|e| panic!("{k}: {e}"))
                .to_string(),
        ),
    }
}

fn int_field(j: &Json, k: &str) -> Option<i64> {
    match j.get(k) {
        None => panic!("chave {k} ausente: {}", j.pretty()),
        Some(Json::Null) => None,
        Some(v) => Some(v.as_i64().unwrap_or_else(|e| panic!("{k}: {e}"))),
    }
}

/// E1-4 — `alvo` É o endereço efetivo (Q2) e Q1 sai em campo próprio, inclusive
/// quando bit15 = 0 (fx04 `4eb8 0020`, operando dentro do objeto).
#[test]
fn e1_4_o_alvo_e_q2_e_o_operando_bruto_sai_em_campo_proprio() {
    let arquivo = ler_fixture("fx04_calls");
    let j = sítio(
        &arquivo,
        0,
        (0x0, 0x28),
        &[raiz(0x0, "referencia-estatica")],
        0x8,
    );
    assert_eq!(str_field(&j, "schema").unwrap(), "rex-cfg-sitio/v2");
    assert_eq!(str_field(&j, "alvo").as_deref(), Some(h(0x20).as_str()));
    assert_eq!(
        str_field(&j, "operando-bruto").as_deref(),
        Some(h(0x20).as_str()),
        "Q1 e a word como esta no objeto"
    );
    assert_eq!(
        str_field(&j, "endereco-efetivo").as_deref(),
        Some(h(0x20).as_str())
    );
    assert_eq!(
        str_field(&j, "endereco-de-barramento").as_deref(),
        Some(h(0x20).as_str())
    );
    assert_eq!(str_field(&j, "forma-do-operando").as_deref(), Some("abs-w"));
    // E1-5: o modelo e declarado no objeto, nao implicito.
    assert_eq!(str_field(&j, "modelo-de-cpu").as_deref(), Some("mc68000"));
    assert_eq!(
        str_field(&j, "semantica-do-operando").as_deref(),
        Some("sign-estendida")
    );
    assert_eq!(
        str_field(&j, "fonte-da-semantica").as_deref(),
        Some("M68000PRM 2.2.16")
    );
    // E1-3: com a janela declarada cobrindo Q2, existe offset de objeto.
    assert_eq!(int_field(&j, "offset-de-objeto"), Some(0x20));
    assert_eq!(
        str_field(&j, "offset-de-objeto-status").as_deref(),
        Some("dentro-do-objeto")
    );
    assert_eq!(str_field(&j, "consumidor-validado").as_deref(), Some("sim"));
}

/// E1-1/E1-4 — bit15 ligado: Q1 != Q2, `alvo` = Q2 sign-estendida, e o valor da
/// hipótese aposentada (0x008000) não aparece em nenhum campo de alvo.
#[test]
fn e1_1_com_bit15_ligado_q1_diferente_de_q2_e_o_alvo_e_q2() {
    let arquivo = ler_fixture("fx09_matriz_isa");
    let j = sítio(&arquivo, 0, (0x0, 0x8c), &[raiz(0x20, "candidato")], 0x20);
    assert_eq!(
        str_field(&j, "operando-bruto").as_deref(),
        Some(h(0x8000).as_str())
    );
    assert_eq!(
        str_field(&j, "endereco-efetivo").as_deref(),
        Some(h(0xFFFF_8000).as_str())
    );
    assert_eq!(
        str_field(&j, "alvo").as_deref(),
        Some(h(0xFFFF_8000).as_str()),
        "obligacao 2: o campo de alvo efetivo nao pode carregar a word zero-estendida"
    );
    assert_ne!(
        str_field(&j, "operando-bruto"),
        str_field(&j, "endereco-efetivo"),
        "coincidencia numerica so existe quando bit15 = 0"
    );
    // E1-2 — Q3 e aritmetica pura sobre Q2 com mascara de 24 bits.
    assert_eq!(
        str_field(&j, "endereco-de-barramento").as_deref(),
        Some(h(0xFF_8000).as_str())
    );
    assert_ne!(
        str_field(&j, "endereco-de-barramento"),
        str_field(&j, "endereco-efetivo"),
        "a truncagem de 24 bits tem de ser visivel"
    );
    // E1-3 — fora da janela declarada nao ha offset inventado.
    assert_eq!(int_field(&j, "offset-de-objeto"), None);
    assert_eq!(
        str_field(&j, "offset-de-objeto-status").as_deref(),
        Some("fora-do-objeto")
    );
    // A hipotese e o registro pendente saem do objeto.
    let limites: Vec<String> = j
        .get("limites")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    for esperado in [
        "sign-estenda-de-abs-w-segundo-m68000prm-2.2.16",
        "bus-24-bits-mc68000",
        "offset-de-objeto-so-com-mapeamento-declarado",
    ] {
        assert!(
            limites.contains(&esperado.to_string()),
            "limites sem {esperado}: {limites:?}"
        );
    }
    for aposentada in [
        "extensao-abs-w-hipotese-zero-extendida",
        "interpretacao-pendente:abs-w-bit15",
    ] {
        assert!(
            !limites.iter().any(|l| l.contains(aposentada)),
            "{aposentada} nao pode voltar a aparecer em limites: {limites:?}"
        );
        let motivos: Vec<String> = j
            .get("motivos")
            .unwrap()
            .as_arr()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap().to_string())
            .collect();
        assert!(
            !motivos.iter().any(|m| m.contains(aposentada)),
            "{aposentada} nao pode voltar a aparecer em motivos: {motivos:?}"
        );
    }
}

/// E1-6 — `abs.L` e literal (PRM 2.2.17): a longword inteira e o alvo, Q3 e a
/// truncagem. Bytes sintetizados pela codificacao medida no instrumento pinado.
#[test]
fn e1_6_abs_l_nao_e_sign_estendida_e_q3_trunca_a_longword() {
    // 4EF9 FFFF8000 = jmp (xxx).L com bit31 ligado — sob qualquer leitura de
    // sinal isto mudaria; a longword e tomada literal.
    let arquivo = bytes_de("4EF9 FFFF 8000 4E71 4E75 0000");
    let j = sítio(
        &arquivo,
        0,
        (0x0, 0xc),
        &[raiz(0x0, "referencia-estatica")],
        0,
    );
    assert_eq!(str_field(&j, "forma-do-operando").as_deref(), Some("abs-l"));
    assert_eq!(
        str_field(&j, "operando-bruto").as_deref(),
        Some(h(0xFFFF_8000).as_str())
    );
    assert_eq!(
        str_field(&j, "endereco-efetivo").as_deref(),
        Some(h(0xFFFF_8000).as_str()),
        "abs.L nao sofre sign-extensao"
    );
    assert_eq!(
        str_field(&j, "endereco-de-barramento").as_deref(),
        Some(h(0xFF_8000).as_str())
    );
    assert_eq!(
        str_field(&j, "semantica-do-operando").as_deref(),
        Some("literal")
    );
    assert_eq!(
        str_field(&j, "fonte-da-semantica").as_deref(),
        Some("M68000PRM 2.2.17")
    );
}

/// Sítio sem operando absoluto (BSR relativo, fx09 M2 em 0x12) não pode fingir
/// bloco de endereço: os campos saem nulos e o status diz por quê.
#[test]
fn sitio_relativo_publica_o_bloco_de_endereco_nulo() {
    let arquivo = ler_fixture("fx09_matriz_isa");
    let j = sítio(&arquivo, 0, (0x0, 0x8c), &[raiz(0x12, "candidato")], 0x12);
    for k in [
        "operando-bruto",
        "endereco-efetivo",
        "endereco-de-barramento",
        "offset-de-objeto",
        "forma-do-operando",
        "semantica-do-operando",
        "fonte-da-semantica",
    ] {
        assert_eq!(
            str_field(&j, k),
            None,
            "{k} nao pode ter valor sem operando absoluto"
        );
    }
    assert_eq!(
        str_field(&j, "offset-de-objeto-status").as_deref(),
        Some("sem-operando-absoluto")
    );
    assert_eq!(str_field(&j, "modelo-de-cpu").as_deref(), Some("mc68000"));
}

/// E1-3 — a janela declarada é o que autoriza Q4: o MESMO objeto consultado com
/// origem diferente ganha ou perde o offset conforme Q2 caia na janela.
#[test]
fn e1_3_o_offset_depende_somente_do_mapeamento_declarado() {
    let arquivo = ler_fixture("fx04_calls");
    // origin = 0: alvo 0x20 esta dentro de [0, 40).
    let dentro = sítio(
        &arquivo,
        0,
        (0x0, 0x28),
        &[raiz(0x0, "referencia-estatica")],
        0x8,
    );
    assert_eq!(int_field(&dentro, "offset-de-objeto"), Some(0x20));
    // origin = 0x40: as instrucoes mudam de endereco; redeclaramos regiao e raiz
    // na mesma base. O alvo 0x20 passa a cair FORA de [0x40, 0x40+40).
    let fora = sítio(
        &arquivo,
        0x40,
        (0x40, 0x68),
        &[raiz(0x40, "referencia-estatica")],
        0x48,
    );
    assert_eq!(str_field(&fora, "alvo").as_deref(), Some(h(0x20).as_str()));
    assert_eq!(int_field(&fora, "offset-de-objeto"), None);
    assert_eq!(
        str_field(&fora, "offset-de-objeto-status").as_deref(),
        Some("fora-do-objeto"),
        "a ferramenta nao inventa offset para alvo fora do mapeamento"
    );
}
