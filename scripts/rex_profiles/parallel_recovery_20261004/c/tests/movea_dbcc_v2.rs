//! ETAPA 3 §3 (obrigações 5 e 6) + negativo de vocabulário (obrigação 7).
//!
//! Duas coisas ficam separadas de propósito neste arquivo, porque a missão exige
//! distinguir **comportamento implementado** de **descrição contratual errada**:
//!
//! * o decoder já faz o que a referência primária manda para `MOVEA` (só `.W`
//!   e `.L`) e para `DBcc` (deslocamento de **palavra**, base = instrução + 2);
//!   os testes abaixo são guardas regressivos — eles **passam na primeira
//!   execução** e é isso que registra que o defeito estava na redação de
//!   `CONTRACT.md` §3, não no código (retificação datada em
//!   `CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md`);
//! * os rótulos produzidos (`motivo`) nunca foram exercitados fora dos fixtures
//!   da ETAPA 1/2. O teste de varredura e o teste de objeto são **RED** nesta
//!   entrega: provam que parte dos motivos carries byte não-ASCII e que o
//!   rótulo de recusa de byte+An nomeava um mnemônico que a ISA não tem.
//!
//! Fontes primárias (M68000PRM, SHA-256 `06e4864b…47c4e8`):
//!   §MOVEA p. 4-119  "Attributes: Size = (Word, Long)"
//!   §MOVE  p. 4-118  "*For byte size operation, address register direct is not
//!                     allowed."
//!   §DBcc  p. 4-90   "Size = (Word)"; "…plus the sign-extended 16-bit
//!                     displacement. The value in the program counter is the
//!                     address of the instruction word of the DBcc instruction
//!                     plus two."
//!   §Bcc   p. 4-25   "If the 8-bit displacement field in the instruction word
//!                     is all ones ($FF), the 32-bit displacement … is used" —
//!                     regra de Bcc/BSR/BRA, que o contrato estendia a `DBcc`.
//!
//! Todas as codificações abaixo foram medidas no instrumento pinado
//! (`m68k-elf-as -m68000` + `m68k-elf-objdump -d`, Apêndice A das expectativas
//! congeladas): `3A7C 0004` = `moveaw #4,%a5`, `2A7C 0000 0004` = `moveal`,
//! `3248`/`2248` = `movea.w`/`movea.l` com fonte `(An)` (2 bytes: fonte
//! registrada nao tem word de extensao), `3478 0100` = `moveaw $100.w,%a2`,
//! `1240` = `.short` (o instrumento recusa), `51C8 8000` em 0x0C = `dbf` com
//! alvo `ffff800e`, `51C8 7FFF` em 0x10 = `8011`, `51C8 11FF` em 0x14 = `1215`,
//! `51C8 0000` em 0x28 = `2a`.

use rex_cfg::decode::{decode_at, Flow, Frontier, Ins, Outcome};
use rex_cfg::grafo::RaizDeclarada;
use rex_cfg::sitio::{consultar, Pedido};
use rex_gameplay::json::Json;

fn bytes_de(hex: &str) -> Vec<u8> {
    hex.split_whitespace()
        .map(|t| u16::from_str_radix(t, 16).unwrap_or_else(|_| panic!("token invalido {t}")))
        .flat_map(|w| [(w >> 8) as u8, w as u8])
        .collect()
}

fn instrucao(o: &Outcome, hex: &str) -> Ins {
    match o {
        Outcome::Insn(i) => i.clone(),
        Outcome::Frontier(f) => panic!("{hex}: esperava instrucao, veio fronteira {}", f.motivo),
    }
}

fn fronteira(o: &Outcome, hex: &str) -> Frontier {
    match o {
        Outcome::Frontier(f) => f.clone(),
        Outcome::Insn(i) => panic!("{hex}: esperava recusa, veio `{}`", i.mnem),
    }
}

// ---------------------------------------------------------------------------
// E3-1 — MOVEA tem tamanhos .W e .L SOMENTE (PRM §MOVEA); MOVEA.B não existe,
// e MOVE.B com destino An é inválido (PRM §MOVE, nota de rodapé).
// ---------------------------------------------------------------------------

/// (bytes, comprimento medido no instrumento, prefixo de mnemônico esperado).
/// `MOVEA.W` é VÁLIDO: a linha 156 do contrato o tratava como parte de um
/// subconjunto ".B/.W/.L", e o exemplo de "combinação inválida" dado lá
/// (`MOVE.W → An`) é exatamente o `movea.w` que o instrumento monta.
const MOVEA_VALIDAS: &[(&str, u16, &str)] = &[
    ("3A7C 0004 4E71", 4, "moveaw"),
    ("2A7C 0000 0004 4E71", 6, "moveal"),
    ("3248 4E71", 2, "moveaw"),
    ("2248 4E71", 2, "moveal"),
    ("3478 0100 4E71", 4, "moveaw"),
];

#[test]
fn e3_1_movea_w_e_movea_l_sao_validas_com_os_comprimentos_medidos() {
    for (hex, len, prefixo) in MOVEA_VALIDAS {
        let buf = bytes_de(hex);
        let i = instrucao(&decode_at(&buf, 0x1000), hex);
        assert_eq!(
            i.len, *len,
            "{hex}: comprimento {:#x}, esperado {len}",
            i.len
        );
        assert!(
            i.mnem.starts_with(prefixo),
            "{hex}: mnemonico `{}` deveria comecar por `{prefixo}`",
            i.mnem
        );
        assert_eq!(i.addr, 0x1000);
        assert_eq!(i.addr + i.len as u32, 0x1000 + *len as u32, "{hex}: queda");
    }
}

/// Controle discriminante: o tamanho byte é aceito quando o destino é Dn. Sem
/// este caso, uma recusa ampla demais ("byte nunca") passaria nos testes de
/// recusa de byte+An.
#[test]
fn e3_1_move_byte_com_destino_dn_continua_valido() {
    for (hex, len) in [("1000 4E71", 2u16), ("1200 4E71", 2), ("103C 0004 4E71", 4)] {
        let buf = bytes_de(hex);
        let i = instrucao(&decode_at(&buf, 0x1000), hex);
        assert!(i.mnem.starts_with("moveb"), "{hex}: `{}`", i.mnem);
        assert_eq!(i.len, len, "{hex}: comprimento {}", i.len);
    }
}

/// O rótulo de recusa nomeia as DUAS leituras inválidas: `MOVEA.B` não existe na
/// ISA e `MOVE.B` com destino An é proibido pela nota de rodapé do §MOVE.
const MOTIVO_BYTE_PARA_AN: &str =
    "MOVE/MOVEA de tamanho byte com destino An invalido (PRM 4-118/4-119)";

/// (bytes, leitura que o instrumento/desmontador faria se a forma existisse).
const BYTE_PARA_AN: &[(&str, &str)] = &[
    ("1240 4E71", "move.b %d0,%a1"),
    ("127C 0004 4E71", "move.b #4,%a1"),
    ("1260 4E71", "move.b %a0@,%a1"),
];

#[test]
fn e3_1_tamanho_byte_com_destino_an_e_recusado_e_nao_vira_movea() {
    for (hex, forma_inexistente) in BYTE_PARA_AN {
        let buf = bytes_de(hex);
        let f = fronteira(&decode_at(&buf, 0x1000), hex);
        assert_eq!(f.kind.label(), "opcode-fora-do-subconjunto", "{hex}");
        assert_eq!(
            f.motivo, MOTIVO_BYTE_PARA_AN,
            "{hex} ({forma_inexistente}): motivo {:#?}",
            f.motivo
        );
        // Nenhum comprimento é reclamado por uma instrução não comprovada.
        assert_eq!(f.consumo, None, "{hex}: consumo declarado {:?}", f.consumo);
    }
}

// ---------------------------------------------------------------------------
// E3-2 — DBcc: deslocamento de PALAVRA com sinal, sempre 4 bytes, base
// instrução + 2 (PRM §DBcc). A recusa de disp8 = 0xFF é de Bcc/BSR/BRA
// (PRM §Bcc) e não pode vazar para cá.
// ---------------------------------------------------------------------------

/// (bytes, endereço, alvo medido no instrumento, alvo que a base histórica
/// errada — fim da instrução — produziria).
const DBCC_DISP16: &[(&str, u32, u32, u32)] = &[
    ("51C8 8000", 0x000C, 0xFFFF_800E, 0xFFFF_8010),
    ("51C8 7FFF", 0x0010, 0x0000_8011, 0x0000_8013),
    ("51C8 11FF", 0x0014, 0x0000_1215, 0x0000_1217),
    ("51C8 0000", 0x0028, 0x0000_002A, 0x0000_002C),
    ("51C8 FFBE", 0x0040, 0x0000_0000, 0x0000_0002),
];

#[test]
fn e3_2_dbcc_e_sempre_de_quatro_bytes_com_disp16_com_sinal() {
    for (hex, addr, correta, base_errada) in DBCC_DISP16 {
        let buf = bytes_de(hex);
        let i = instrucao(&decode_at(&buf, *addr), hex);
        assert_eq!(i.len, 4, "{hex}: DBcc tem tamanho fixo 4, obtido {}", i.len);
        let Flow::Branch { taken, has_fall } = i.flow else {
            panic!("{hex}: fluxo {:?}, esperado desvio com queda", i.flow);
        };
        assert_eq!(
            taken, *correta,
            "{hex} em {addr:#06x}: PRM 4.90 (base = word da instrucao + 2, disp16 com \
             sinal) da {correta:#010x}; a ferramenta deu {taken:#010x}"
        );
        assert!(has_fall, "{hex}: DBcc sempre tem queda (contador = -1)");
        assert_ne!(
            taken, *base_errada,
            "{hex}: a base aposentada (fim da instrucao) daria {base_errada:#010x}; \
             registrado como NAO produzido"
        );
        assert!(i.mnem.starts_with("db"), "{hex}: `{}`", i.mnem);
    }
}

/// Discriminante simétrico da obrigação 6: os mesmos dois bits baixos `0xFF`
/// significam coisas diferentes nas duas famílias. Em `DBcc` são um disp16
/// perfeitamente válido; em `Bcc`/`BSR`/`BRA` selecionam a forma de 32 bits
/// (MC68020+), fora do subconjunto.
#[test]
fn e3_2_a_recusa_de_disp8_ff_nao_se_aplica_a_dbcc() {
    let dbcc = instrucao(&decode_at(&bytes_de("51C8 11FF"), 0x0014), "51C8 11FF");
    assert_eq!(dbcc.len, 4);
    assert_eq!(
        dbcc.flow,
        Flow::Branch {
            taken: 0x1215,
            has_fall: true
        }
    );

    for hex in ["67FF 4E71", "61FF 0000 1234", "60FF 4E71"] {
        let f = fronteira(&decode_at(&bytes_de(hex), 0x0100), hex);
        assert_eq!(f.kind.label(), "opcode-fora-do-subconjunto", "{hex}");
        assert!(
            f.motivo.contains("disp8 = 0xFF"),
            "{hex}: motivo inesperado {:#?}",
            f.motivo
        );
        assert_eq!(f.consumo, None, "{hex}: nenhum byte reclamado");
    }
}

#[test]
fn e3_2_dbcc_sem_word_de_displacamento_e_fronteira_truncada() {
    let f = fronteira(&decode_at(&bytes_de("51C8"), 0x0010), "51C8");
    assert_eq!(f.kind.label(), "truncada");
    assert_eq!(f.consumo, None);
    // `51FF` tem os mesmos bits de máscara de DBcc mas modo %111 = reserva: cai
    // na família Scc e é recusado. Medido no instrumento pinado em objeto
    // isolado: `51ff` = `sf %d7` (2 bytes) — o instrumento lê, o subconjunto não
    // suporta Scc (a nota antiga `.short 0x51ff` era citação falsa; ADENDO R-3.7).
    let f2 = fronteira(&decode_at(&bytes_de("51FF 4E71"), 0x0010), "51FF");
    assert_eq!(f2.kind.label(), "opcode-fora-do-subconjunto");
    assert!(
        !f2.motivo.contains("db"),
        "DBcc inventado em 51FF: {:?}",
        f2.motivo
    );
}

// ---------------------------------------------------------------------------
// N-ASCII (obrigação 7 — caminhos não alcançados pelos fixtures) — todo texto
// publicado no objeto de sítio tem de ser ASCII: o parser da frente A recusa
// byte não-ASCII e qualquer escape (CONTRACT §6). Os motivos de recusa nunca
// foram exercitados fora dos fixtures da ETAPA 1/2.
// ---------------------------------------------------------------------------

/// Varredura de todas as 65 536 palavras de instrução possíveis: nenhum motivo,
/// mnemônico ou família produzida pode carregar byte não-ASCII.
#[test]
fn n_ascii_nenhum_texto_produzido_contem_byte_nao_ascii() {
    let mut exemplos: Vec<(u16, String)> = Vec::new();
    for op in 0u32..=0xFFFF {
        let op = op as u16;
        let buf: Vec<u8> = [
            (op >> 8) as u8,
            op as u8,
            0x00,
            0x04,
            0x4E,
            0x71,
            0x4E,
            0x75,
            0x00,
            0x00,
        ]
        .to_vec();
        let txt = match decode_at(&buf, 0x1000) {
            Outcome::Insn(i) => [i.mnem.as_str(), i.family.as_str()].join(" "),
            Outcome::Frontier(f) => f.motivo.clone(),
        };
        if !txt.is_ascii() {
            exemplos.push((op, txt));
        }
    }
    assert!(
        exemplos.is_empty(),
        "{} palavra(s) de instrução produzem texto nao-ASCII; primeiros: {:?}",
        exemplos.len(),
        &exemplos[..exemplos.len().min(8)]
    );
}

fn raiz(endereco: u32) -> RaizDeclarada {
    RaizDeclarada {
        endereco,
        proveniencia: "referencia-estatica".to_string(),
        evidencia: None,
    }
}

/// Teste de objeto: o JSON inteiro do despacho de um sítio tem de ser ASCII,
/// incluindo `limites` e `motivos`. Witnesses escolhidos por alcançarem ramos
/// que nenhum fixture cobre: `jmp (a0)` (fronteira indireta, a mais comum em ROM
/// real) e o desvio com disp8 = 0xFF.
#[test]
fn n_ascii_o_objeto_de_sitio_inteiro_e_ascii_em_ramos_nao_cobertos() {
    for (hex, sitio) in [
        ("4ED0 4E71", 0x0u32),
        ("67FF 4E71", 0x0),
        ("1240 4E71", 0x0),
    ] {
        let arquivo = bytes_de(hex);
        let mut buf = arquivo.clone();
        buf.extend_from_slice(&[0x4E, 0x75, 0x4E, 0x71]);
        let p = Pedido {
            buf: &buf,
            arquivo: &arquivo,
            origin: 0,
            regiao: (0, buf.len() as u32),
            raizes: &[raiz(sitio)],
            sitio,
            max_insn: 500,
        };
        let j: Json = consultar(&p).unwrap_or_else(|e| panic!("{hex}: {e}"));
        let txt = j.pretty();
        let maus: Vec<char> = txt.chars().filter(|c| !c.is_ascii()).collect();
        assert!(
            maus.is_empty(),
            "{hex}: objeto de sitio com {} byte(s) nao-ASCII {:?}\n{txt}",
            maus.len(),
            maus
        );
    }
}
