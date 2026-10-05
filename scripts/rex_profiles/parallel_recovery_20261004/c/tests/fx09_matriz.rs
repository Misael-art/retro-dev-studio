//! MATRIZ AUTORAL `fx09_matriz_isa` — linhas M1..M14 de
//! `docs/rex_profiles/parallel_recovery_20261004/c/EXPECTATIONS-ETAPA2.md` §1.
//!
//! FIXTURE AUTORAL (identificado como autoral): código escrito para expor cada
//! linha da matriz, não é recorte de ROM. Cada linha é uma rotina própria
//! (`[instrução da matriz][nop][rts]`) e o teste roda uma análise por linha, com
//! a raiz declarada no rótulo `mNN`, de modo que o caminho de uma linha não
//! dependa da linha anterior.
//!
//! A referência é o INSTRUMENTO pinado (`fixtures/fx09_matriz_isa-objdump.txt`,
//! `m68k-elf-objdump` binutils 2.41): comprimento, família e alvo absolutos
//! vêm do dump, nunca do próprio decodificador (CONTRACT §5 — round-trip
//! interno não conta como prova). Onde a linha exige parada, o que se verifica
//! é a AUSÊNCIA de alvo numérico no grafo.
//!
//! Nomes de aresta/tipo de fronteira seguem o `ADENDO-ETAPA2-2026-10-04.md`
//! (A-1, A-6): `bsr`/`jsr` geram aresta `chamada`, `jmp` absoluto gera `desvio`,
//! e JSR/JMP cujo modo é válido mas está fora da lista fechada gera a fronteira
//! `indirect-opaque`. O conteúdo duro (alvo do instrumento, comprimento, nenhum
//! alvo alegado, nenhum consumidor) é o congelado em §1.

#[path = "support/oracle.rs"]
// O suporte e compartilhado pelos alvos de teste; nem toda afirmacao do
// instrumento e consumida por este alvo.
#[allow(dead_code)]
mod oracle;

use oracle::{parse_objdump, Rec};
use rex_cfg::grafo::{analisar, Analise, Chamada, InstrucaoView, Status, Tipo};

const BIN: &[u8] = include_bytes!("../fixtures/fx09_matriz_isa.bin");
const DUMP: &str = include_str!("../fixtures/fx09_matriz_isa-objdump.txt");
/// Regiao = o fixture inteiro (140 bytes), sem recorte.
const REGIAO: (u32, u32) = (0x0, 0x8C);
const SEM_LIMITE: u64 = u64::MAX / 4;

fn recs() -> Vec<Rec> {
    parse_objdump(DUMP)
}

/// Registro do instrumento no endereço da linha; obrigatorio presence.
fn registro(addr: u32) -> Rec {
    recs()
        .into_iter()
        .find(|r| r.addr == addr)
        .unwrap_or_else(|| panic!("o instrumento nao tem registro em {addr:#x}"))
}

/// Uma analise por linha: raiz = rotulo `mNN`, sitio = o mesmo endereco.
fn linha(raiz: u32) -> Analise {
    analisar(BIN, &[raiz], REGIAO, &[raiz], SEM_LIMITE)
        .unwrap_or_else(|e| panic!("raiz {raiz:#x}: analise falhou: {e}"))
}

fn instr(a: &Analise, endereco: u32) -> &InstrucaoView {
    a.blocos
        .iter()
        .flat_map(|b| b.instrucoes.iter())
        .find(|i| i.endereco == endereco)
        .unwrap_or_else(|| panic!("{endereco:#x}: nenhuma instrucao comprovada no grafo"))
}

fn tem_instrucao(a: &Analise, endereco: u32) -> bool {
    a.blocos
        .iter()
        .any(|b| b.instrucoes.iter().any(|i| i.endereco == endereco))
}

fn saida_da_linha(a: &Analise, endereco: u32) -> Vec<&rex_cfg::grafo::Aresta> {
    a.arestas.iter().filter(|e| e.origem == endereco).collect()
}

fn chamada(a: &Analise, endereco: u32) -> Option<&Chamada> {
    a.chamadas.iter().find(|c| c.sitio == endereco)
}

fn fronteira(a: &Analise, endereco: u32) -> Option<&rex_cfg::grafo::FronteiraExport> {
    a.fronteiras.iter().find(|f| f.endereco == endereco)
}

/// Todo alvo numerico alegado pelo grafo (arestas + chamadas).
fn alvos(a: &Analise) -> Vec<u32> {
    a.arestas
        .iter()
        .filter_map(|e| e.alvo)
        .chain(a.chamadas.iter().filter_map(|c| c.alvo))
        .collect()
}

// ---------------------------------------------------------------------------
// M1/M2/M2b — BSR curto vs. palavra, sinal e comprimento (defeito 3 do briefing)
// ---------------------------------------------------------------------------

#[test]
fn m01_bsr_curto_comprimento_2_e_nao_engole_a_word_seguinte() {
    let r = registro(0x00);
    assert_eq!(
        r.token, "bsrs",
        "M1: o instrumento le a forma curta em 0x00"
    );
    let a = linha(0x00);
    let i = instr(&a, 0x00);
    assert_eq!(i.tam as u32, r.len, "M1: comprimento do instrumento");
    assert_eq!(i.tam, 2, "M1: bsr.s tem 2 bytes — nao 4");
    assert_eq!(i.classe, "bsr");
    // A tabela de A nao modela a forma curta: leria d16 a partir de 0x02 e
    // alegaria um alvo a partir do `nop` (0x4E71 + base). Esse alvo NAO pode existir.
    let alvo_leitura_d16 = u32::from_be_bytes([BIN[2], BIN[3], 0, 0]).wrapping_add(0x02 + 2);
    assert!(
        !alvos(&a).contains(&alvo_leitura_d16),
        "M1: alvo da leitura de d16 ({alvo_leitura_d16:#x}) aparece no grafo"
    );
    // O `nop` de 0x02 continua instrução comprovada: nada foi engolido.
    assert_eq!(instr(&a, 0x02).tam, 2, "M1: nop em 0x02 esta intacto");
    assert_eq!(instr(&a, 0x02).classe, "nop");
    let alvo = r.target.expect("M1: alvo do instrumento");
    let e = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x00 && e.tipo == Tipo::Chamada)
        .expect("M1: aresta de chamada (A-6: bsr gera `chamada`, nao `desvio`)");
    assert_eq!(e.alvo, Some(alvo), "M1: alvo == instrumento ({alvo:#x})");
    assert_eq!(e.status, Status::Resolvido);
    assert!(fronteira(&a, 0x00).is_none(), "M1: sem fronteira na linha");
}

#[test]
fn m02_bsr_palavra_positivo_reproduz_alvo_do_instrumento() {
    let r = registro(0x06);
    let a = linha(0x06);
    assert_eq!(instr(&a, 0x06).tam, 4, "M2: bsr.w tem 4 bytes");
    assert_eq!(instr(&a, 0x06).classe, "bsr");
    let c = chamada(&a, 0x06).expect("M2: bsr e registrado como chamada");
    assert_eq!(c.alvo, r.target, "M2: alvo == instrumento (0x88)");
    assert_eq!(c.status, Status::Resolvido);
    assert!(fronteira(&a, 0x06).is_none());
}

#[test]
fn m02b_bsr_palavra_negativo_estende_sinal_do_disp16() {
    let r = registro(0x0E);
    let a = linha(0x0E);
    assert_eq!(instr(&a, 0x0E).tam, 4, "M2b: comprimento 4");
    let c = chamada(&a, 0x0E).expect("M2b: chamada registrada");
    assert_eq!(c.alvo, r.target, "M2b: alvo == instrumento (0x06)");
    // Sem extensao de sinal a word `FFFE` daria 0x10 + 0xFFFE = 0x10006.
    assert!(
        !alvos(&a).contains(&0x10006),
        "M2b: alvo da leitura SEM extensao de sinal (0x10006) aparece no grafo"
    );
    assert!(!alvos(&a).contains(&0xFFFF8000));
}

// ---------------------------------------------------------------------------
// M3 — BSR.L (forma 68020): parada, sem aresta e sem entrada em chamadas
// ---------------------------------------------------------------------------

#[test]
fn m03_bsr_l_68020_interrompe_o_caminho_sem_alegar_alvo() {
    let r = registro(0x16);
    assert_eq!(r.token, "bsrl", "M3: o instrumento le a forma 68020");
    let a = linha(0x16);
    assert!(
        !tem_instrucao(&a, 0x16),
        "M3: 61ff nao pode virar instrucao comprovada"
    );
    let f = fronteira(&a, 0x16).expect("M3: fronteira obrigatorio");
    assert_eq!(f.tipo, "opcode-fora-do-subconjunto");
    assert_eq!(f.opcode, Some(0x61FF));
    assert!(saida_da_linha(&a, 0x16).is_empty(), "M3: sem aresta");
    assert!(chamada(&a, 0x16).is_none(), "M3: sem entrada em chamadas");
    // O alvo que o instrumento calcula para a forma 68020 (base instr+2) NAO e
    // alegado pela ferramenta — e exatamente a contradicao registrada em §1 M3.
    let alvo_instrumento = r.target.expect("M3: o instrumento declara alvo");
    assert!(
        !alvos(&a).contains(&alvo_instrumento),
        "M3: alvo 68020 do instrumento ({alvo_instrumento:#x}) alegado pela ferramenta"
    );
    assert!(alvos(&a).is_empty(), "M3: nenhum alvo numerico no grafo");
}

// ---------------------------------------------------------------------------
// M4/M5 — JSR abs.W (bit15) e abs.L
// ---------------------------------------------------------------------------

#[test]
fn m04_jsr_abs_w_bit15_exporta_operando_bruto_e_para_na_fronteira() {
    let r = registro(0x20);
    let a = linha(0x20);
    assert_eq!(instr(&a, 0x20).tam, 4, "M4: comprimento 4 comprovado");
    assert_eq!(instr(&a, 0x20).classe, "jsr");
    let c = chamada(&a, 0x20).expect("M4: aresta de chamada");
    assert_eq!(c.alvo, Some(0x8000), "M4: operando bruto (word) exportado");
    assert_eq!(c.status, Status::ForaDaRegiao);
    // P-absW (1.1): o instrumento EXIBE 0xFFFF8000; a diferenca e registro de
    // interpretacao pendente, nao resultado estrutural.
    assert_eq!(r.target, Some(0xFFFF8000), "M4: leitura do instrumento");
    assert_ne!(c.alvo, r.target, "M4: a ferramenta nao adota a exibicao");
    let f = fronteira(&a, 0x20).expect("M4: fronteira de regiao");
    assert_eq!(f.tipo, "limite-de-regiao");
    assert!(saida_da_linha(&a, 0x20)
        .iter()
        .any(|e| e.tipo == Tipo::Chamada && e.alvo == Some(0x8000)));
}

#[test]
fn m05_jsr_abs_l_alvo_identico_ao_do_instrumento() {
    let r = registro(0x28);
    let a = linha(0x28);
    assert_eq!(instr(&a, 0x28).tam, 6, "M5: jsr abs.L tem 6 bytes");
    assert_eq!(instr(&a, 0x28).classe, "jsr");
    let c = chamada(&a, 0x28).expect("M5: chamada");
    assert_eq!(c.alvo, r.target, "M5: alvo == instrumento (0x88)");
    assert_eq!(c.alvo, Some(0x88));
    assert_eq!(c.status, Status::Resolvido);
    assert!(fronteira(&a, 0x28).is_none());
}

// ---------------------------------------------------------------------------
// M6/M7 — JMP abs.W (bit15) e abs.L: desvio sem queda
// ---------------------------------------------------------------------------

#[test]
fn m06_jmp_abs_w_gera_desvio_sem_queda() {
    let r = registro(0x32);
    let a = linha(0x32);
    assert_eq!(instr(&a, 0x32).tam, 4, "M6: comprimento 4");
    assert_eq!(instr(&a, 0x32).classe, "jmp");
    let saidas = saida_da_linha(&a, 0x32);
    assert_eq!(saidas.len(), 1, "M6: exatamente uma aresta (sem queda)");
    assert_eq!(saidas[0].tipo, Tipo::Desvio, "M6: aresta de desvio");
    assert_eq!(saidas[0].alvo, Some(0x8000), "M6: operando bruto");
    assert_eq!(saidas[0].status, Status::ForaDaRegiao);
    assert_eq!(r.target, Some(0xFFFF8000), "M6: leitura do instrumento");
    assert!(
        fronteira(&a, 0x32).is_some(),
        "M6: para na fronteira de regiao"
    );
    assert!(!tem_instrucao(&a, 0x36), "M6: nada depois da saida e lido");
}

#[test]
fn m07_jmp_abs_l_alvo_identico_ao_do_instrumento() {
    let r = registro(0x3a);
    let a = linha(0x3a);
    assert_eq!(instr(&a, 0x3a).tam, 6, "M7: comprimento 6");
    let saidas = saida_da_linha(&a, 0x3a);
    assert_eq!(saidas.len(), 1, "M7: sem queda");
    assert_eq!(saidas[0].tipo, Tipo::Desvio);
    assert_eq!(saidas[0].alvo, r.target, "M7: alvo == instrumento");
    assert_eq!(saidas[0].alvo, Some(0x800000));
    assert_eq!(saidas[0].status, Status::ForaDaRegiao);
}

// ---------------------------------------------------------------------------
// M8/M9 — os opcodes trocados de A (retificacao A-1: fronteira `indirect-opaque`)
// ---------------------------------------------------------------------------

#[test]
fn m08_jmp_d16_pc_nao_vira_jsr_abs_w_nem_produce_alvo() {
    let r = registro(0x44);
    assert_eq!(r.token, "jmp", "M8: o instrumento le 4EFA como JMP d16(PC)");
    let a = linha(0x44);
    assert_eq!(instr(&a, 0x44).tam, 4, "M8: comprimento 4");
    assert_eq!(
        instr(&a, 0x44).classe,
        "jmp",
        "M8: familia jmp, NUNCA jsr abs.W"
    );
    let f = fronteira(&a, 0x44).expect("M8: fronteira obrigatoria");
    assert_eq!(f.tipo, "indirect-opaque", "M8 (A-1): tipo da fronteira");
    assert_eq!(f.opcode, Some(0x4EFA));
    let c = chamada(&a, 0x44).expect("M8 (A-2): a linha tem entrada em chamadas");
    assert_eq!(c.alvo, None, "M8: nenhum alvo numerico");
    assert_eq!(c.status, Status::IndiretoOpaco);
    let saidas = saida_da_linha(&a, 0x44);
    assert_eq!(saidas.len(), 1);
    assert_eq!(saidas[0].status, Status::IndiretoOpaco);
    assert!(
        alvos(&a).is_empty(),
        "M8: o grafo inteiro sem alvo numerico"
    );
}

#[test]
fn m09a_4efc_e_fronteira_e_o_instrumento_tambem_recusa() {
    let r = registro(0x4c);
    assert_eq!(
        r.token, ".short",
        "M9a: o proprio instrumento nao decodifica 4EFC como JMP/JSR"
    );
    let a = linha(0x4c);
    assert!(!tem_instrucao(&a, 0x4C), "M9a: sem comprimento alegado");
    let f = fronteira(&a, 0x4c).expect("M9a: fronteira obrigatoria");
    assert_eq!(f.opcode, Some(0x4EFC));
    assert!(saida_da_linha(&a, 0x4C).is_empty());
    assert!(chamada(&a, 0x4c).is_none());
    assert!(alvos(&a).is_empty());
}

#[test]
fn m09b_4efd_e_fronteira_e_o_instrumento_tambem_recusa() {
    let r = registro(0x52);
    assert_eq!(r.token, ".short", "M9b: o instrumento nao decodifica 4EFD");
    let a = linha(0x52);
    assert!(!tem_instrucao(&a, 0x52));
    let f = fronteira(&a, 0x52).expect("M9b: fronteira obrigatoria");
    assert_eq!(f.opcode, Some(0x4EFD));
    assert!(saida_da_linha(&a, 0x52).is_empty());
    assert!(chamada(&a, 0x52).is_none());
    assert!(alvos(&a).is_empty());
}

// ---------------------------------------------------------------------------
// M10/M11 — o opcode que A troca por MOVEA imediato
// ---------------------------------------------------------------------------

#[test]
fn m10_movea_imediato_nunca_e_consumidor_nem_alvo() {
    let r = registro(0x58);
    assert_eq!(r.token, "moveal", "M10: 2A7C e MOVEA #imm (medido)");
    let a = linha(0x58);
    let i = instr(&a, 0x58);
    assert_eq!(i.tam as u32, r.len, "M10: comprimento do instrumento (6)");
    assert_eq!(i.classe, "movea");
    assert!(chamada(&a, 0x58).is_none(), "M10: nao e chamada");
    assert!(saida_da_linha(&a, 0x58)
        .iter()
        .all(|e| e.tipo == Tipo::Queda));
    // Nenhum operando alegado: o imediato 0x12345678 nao vira alvo de nada.
    assert!(
        !alvos(&a).contains(&0x1234_5678),
        "M10: imediato alegado como alvo"
    );
    assert!(alvos(&a).is_empty());
}

#[test]
fn m11_0a7c_fc00_e_para_no_maximo_ou_eori_nunca_movea() {
    let r = registro(0x62);
    assert_eq!(
        r.token, "eoriw",
        "M11: o instrumento le 0A7C FC00 como eori.w #imm,%sr"
    );
    assert_eq!(r.len, 4, "M11: comprimento do instrumento");
    let a = linha(0x62);
    // 1 M11 aceita DOIS resultados: (a) fronteira opcode-fora-do-subconjunto,
    // ou (b) `eori` com destino CCR/SR. Em nenhum caso comprimento inventado.
    let front = fronteira(&a, 0x62);
    let ins = a
        .blocos
        .iter()
        .flat_map(|b| b.instrucoes.iter())
        .find(|i| i.endereco == 0x62);
    let opcao_a = front.is_some_and(|f| f.tipo == "opcode-fora-do-subconjunto");
    let opcao_b =
        ins.is_some_and(|i| i.classe == "eori" && i.tam as u32 == r.len && !i.mnem.contains("%a"));
    assert!(
        opcao_a || opcao_b,
        "M11: nem (a) nem (b); medido fronteira={front:?} instrucao={ins:?}"
    );
    if let Some(i) = ins {
        assert_ne!(i.classe, "movea", "M11: a linha de A diz movea — refutado");
        assert_eq!(i.tam as u32, r.len, "M11: comprimento NUNCA inventado");
    }
    assert!(chamada(&a, 0x62).is_none(), "M11: nao e consumidor");
    // O `nop` de 0x66 e o `rts` de 0x68 continuam no lugar: nada foi engolido.
    // Um comprimento 6 desloca o caminho para 0x68 e NUNCA reclama o nop.
    assert!(
        !tem_instrucao(&a, 0x64) && !tem_instrucao(&a, 0x65),
        "M11: inicio de instrucao dentro dos 4 bytes da linha"
    );
    if tem_instrucao(&a, 0x66) {
        assert_eq!(instr(&a, 0x66).classe, "nop", "M11: nop intacto em 0x66");
    }
    if tem_instrucao(&a, 0x68) {
        assert_eq!(
            instr(&a, 0x68).classe,
            "rts",
            "M11: rts em 0x68 so se 0x66 foi lido"
        );
    }
}

// ---------------------------------------------------------------------------
// M12/M13 — LEA: comprimento comprovado, nenhuma efetividade alegada
// ---------------------------------------------------------------------------

#[test]
fn m12_lea_abs_w_comprimento_4_e_nenhum_alvo() {
    let r = registro(0x6a);
    let a = linha(0x6a);
    assert_eq!(instr(&a, 0x6a).tam, 4, "M12: comprimento 4 comprovado");
    assert_eq!(instr(&a, 0x6a).classe, "lea");
    assert!(chamada(&a, 0x6a).is_none());
    assert!(
        !alvos(&a).contains(&0x8000) && !alvos(&a).contains(&0xFFFF8000),
        "M12: ferramenta alega efetividade do endereco"
    );
    assert!(alvos(&a).is_empty());
    assert!(
        r.text.contains("ffff8000"),
        "M12: o instrumento EXIBE o endereco com sinal: {}",
        r.text
    );
}

#[test]
fn m13_lea_d16_pc_mesma_regra_de_base_dos_desvios() {
    let r = registro(0x72);
    let a = linha(0x72);
    assert_eq!(instr(&a, 0x72).tam, 4, "M13: comprimento 4");
    assert_eq!(instr(&a, 0x72).classe, "lea");
    assert!(chamada(&a, 0x72).is_none());
    assert!(
        alvos(&a).is_empty(),
        "M13: nenhum alvo alegado (nao e fluxo)"
    );
    // A base do instrumento para d16(PC) e instrucao+2 com sinal — a UNICA linha
    // da tabela de A que converge. Medida aqui a partir dos bytes do fixture.
    let disp = i16::from_be_bytes([BIN[0x74], BIN[0x75]]) as i32;
    let efetivo = (0x72u32 + 2).wrapping_add(disp as u32);
    assert_eq!(efetivo, 0x32, "M13: base instr+2 + disp sinalizado");
    assert!(
        r.text.contains("(32"),
        "M13: o instrumento imprime o mesmo endereco efetivo: {}",
        r.text
    );
}

// ---------------------------------------------------------------------------
// M14 — Scc vs. DBcc
// ---------------------------------------------------------------------------

#[test]
fn m14a_sf_tem_2_bytes_e_nao_engole_a_word_seguinte() {
    let r = registro(0x7a);
    assert_eq!(r.token, "sf", "M14a: 51C3 e Scc, nao DBcc");
    let a = linha(0x7a);
    assert_eq!(instr(&a, 0x7a).tam, 2, "M14a: comprimento 2");
    assert_eq!(instr(&a, 0x7a).classe, "sf");
    assert_eq!(
        instr(&a, 0x7c).classe,
        "nop",
        "M14a: nop em 0x7C nao engolido"
    );
    assert_eq!(instr(&a, 0x7e).classe, "rts");
    assert!(chamada(&a, 0x7a).is_none());
    assert!(alvos(&a).is_empty());
}

#[test]
fn m14b_dbcc_com_disp16_negativo_dá_aresta_de_desvio_e_queda() {
    let r = registro(0x80);
    assert_eq!(r.token, "dbf");
    let a = linha(0x80);
    assert_eq!(instr(&a, 0x80).tam, 4, "M14b: comprimento 4");
    assert_eq!(instr(&a, 0x80).classe, "dbf");
    let desvio = saida_da_linha(&a, 0x80)
        .into_iter()
        .find(|e| e.tipo == Tipo::Desvio)
        .expect("M14b: aresta de desvio do laco");
    assert_eq!(desvio.alvo, r.target, "M14b: alvo == instrumento (0x80)");
    assert_eq!(desvio.status, Status::Resolvido);
    assert!(saida_da_linha(&a, 0x80)
        .iter()
        .any(|e| e.tipo == Tipo::Queda && e.alvo == Some(0x84)));
    assert!(chamada(&a, 0x80).is_none(), "M14b: DBcc nao e chamada");
}
