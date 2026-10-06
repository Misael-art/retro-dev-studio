//! Fixture autoral **assimétrico** `fx11assimetrica` — EXPECTATIONS-ETAPA2 §3,
//! casos A1..A4, contra a tabela manual commitada junto do fixture
//! (`fixtures/fx11-expectativas.md`), que é a expectativa. A ferramenta é que é
//! comparada a ela: divergência ferramenta ↔ tabela = FAIL (§3 A3); divergência
//! tabela ↔ instrumento = retificação por Adendo datado.
//!
//! FIXTURE AUTORAL: código escrito para ter dois fluxos de tamanho deliberadamente
//! desigual; não é recorte de ROM.
//!
//! A1 é o ponto estrutural deste arquivo: cada análise tem UMA raiz declarada e
//! TODAS as métricas são verificadas por raiz, com denominador próprio (região
//! `[0x00, 0x100)` = 256 bytes nas duas análises). Nenhum agregado entre raízes
//! é computed, e A4 proíbe que o export publique um.

use rex_cfg::grafo::{analisar, Analise, Status, Tipo};

const BIN: &[u8] = include_bytes!("../fixtures/fx11assimetrica.bin");
/// Regiao declarada: os primeiros 256 bytes dos 300 do fixture.
const REGIAO: (u32, u32) = (0x0, 0x100);
const SEM_LIMITE: u64 = u64::MAX / 4;

fn raiz_unica(r: u32) -> Analise {
    analisar(BIN, &[r], REGIAO, &[], SEM_LIMITE)
        .unwrap_or_else(|e| panic!("raiz {r:#x}: analise falhou: {e}"))
}

fn entradas(a: &Analise) -> Vec<u32> {
    let mut v: Vec<u32> = a.blocos.iter().map(|b| b.entrada).collect();
    v.sort_unstable();
    v
}

fn pes_por_bloco(a: &Analise, entrada: u32) -> Vec<u16> {
    a.blocos
        .iter()
        .find(|b| b.entrada == entrada)
        .unwrap_or_else(|| panic!("sem bloco em {entrada:#x}"))
        .instrucoes
        .iter()
        .map(|i| i.tam)
        .collect()
}

fn nos(a: &Analise) -> usize {
    a.blocos.iter().map(|b| b.instrucoes.len()).sum()
}

/// Raizes **declaradas** pelo operador (as derivadas de fluxo viram lideres com
/// proveniencia propria; tabela §0: "lider = raiz declarada + todo alvo interno
/// de aresta").
fn declaradas(a: &Analise) -> Vec<u32> {
    let mut v: Vec<u32> = a
        .raizes
        .iter()
        .filter(|r| r.proveniencia != "dentro-de-fluxo")
        .map(|r| r.endereco)
        .collect();
    v.sort_unstable();
    v
}

fn chave(e: &rex_cfg::grafo::Aresta) -> String {
    format!("{}/{}", e.tipo.label(), e.status.label())
}

// ---------------------------------------------------------------------------
// raiz A — curta: para no opcode recusado, sem chamada, sem laco
// ---------------------------------------------------------------------------

#[test]
fn a1_raiz_a_tem_denominador_proprio_e_um_bloco() {
    let a = raiz_unica(0x00);
    assert_eq!(
        a.regiao, REGIAO,
        "A1: dominio da raiz A e a regiao declarada"
    );
    assert_eq!(a.cobertura.bytes_regiao, 256);
    assert_eq!(declaradas(&a), vec![0x00], "A1: uma unica raiz declarada");
    assert_eq!(entradas(&a), vec![0x00], "tabela: blocos(a) = {{0x00}}");
    assert_eq!(a.blocos[0].instrucoes.len(), 1, "tabela: 1 no");
    assert_eq!(pes_por_bloco(&a, 0x00), vec![2], "tabela: 0x00:2");
    assert!(a.arestas.is_empty(), "tabela: arestas(a) = 0");
    assert!(a.chamadas.is_empty(), "tabela: chamadas(a) = 0");
    assert_eq!(nos(&a), 1);
}

#[test]
fn a2_raiz_a_para_no_opcode_recusado_sem_nem_continuar() {
    let a = raiz_unica(0x00);
    assert_eq!(a.fronteiras.len(), 1, "tabela: fronteiras(a) = 1");
    let f = &a.fronteiras[0];
    assert_eq!(f.endereco, 0x02);
    assert_eq!(f.tipo, "opcode-fora-do-subconjunto");
    assert_eq!(f.opcode, Some(0x484B), "bkpt #3 medido pelo instrumento");
    // `nop` em 0x04 e `rts` em 0x06 nao sao alcancados: nada e decodificado
    // depois da fronteira.
    assert_eq!(a.cobertura.bytes_decodificados, 2, "tabela: 2 bytes");
    assert_eq!(a.cobertura.fracao, "0.0078", "tabela: 2/256");
    assert!(
        !a.blocos
            .iter()
            .any(|b| b.instrucoes.iter().any(|i| i.endereco >= 0x04)),
        "A2: a leitura continuou depois da fronteira"
    );
}

// ---------------------------------------------------------------------------
// raiz B — longa: seis blocos, dez nos, dez arestas, tres chamadas
// ---------------------------------------------------------------------------

#[test]
fn a1_raiz_b_tem_o_mesm_denominador_e_seis_blocos() {
    let a = raiz_unica(0x08);
    assert_eq!(a.regiao, REGIAO, "A1: mesma regiao declarada");
    assert_eq!(a.cobertura.bytes_regiao, 256);
    assert_eq!(declaradas(&a), vec![0x08], "A1: uma unica raiz declarada");
    // Tabela §0: todo alvo interno de aresta vira lider. O export registra esse
    // lider como raiz derivada (`dentro-de-fluxo`), sem promover grau (§0.1).
    let derivadas: Vec<(u32, &str)> = {
        let mut v: Vec<(u32, &str)> = a
            .raizes
            .iter()
            .map(|r| (r.endereco, r.proveniencia.as_str()))
            .collect();
        v.sort_unstable();
        v
    };
    assert_eq!(
        derivadas,
        vec![(0x08, "candidato"), (0x22, "dentro-de-fluxo")],
        "tabela §0: lider = raiz declarada + alvo interno do bsr"
    );
    assert_eq!(
        entradas(&a),
        vec![0x08, 0x0E, 0x14, 0x18, 0x1E, 0x22],
        "tabela: blocos(b) = 0x08, 0x0e, 0x14, 0x18, 0x1e, 0x22"
    );
    assert_eq!(nos(&a), 10, "tabela: 10 nos");
}

#[test]
fn a3_raiz_b_reproduz_os_pes_de_cada_bloco() {
    let a = raiz_unica(0x08);
    assert_eq!(pes_por_bloco(&a, 0x08), vec![2, 4], "tabela 0x08:[2,4]");
    assert_eq!(pes_por_bloco(&a, 0x0E), vec![6], "tabela 0x0e:[6]");
    assert_eq!(pes_por_bloco(&a, 0x14), vec![4], "tabela 0x14:[4]");
    assert_eq!(pes_por_bloco(&a, 0x18), vec![2, 4], "tabela 0x18:[2,4]");
    assert_eq!(pes_por_bloco(&a, 0x1E), vec![2, 2], "tabela 0x1e:[2,2]");
    assert_eq!(pes_por_bloco(&a, 0x22), vec![4, 2], "tabela 0x22:[4,2]");
    assert_eq!(a.cobertura.bytes_decodificados, 32, "tabela: 32 bytes");
    assert_eq!(a.cobertura.fracao, "0.1250", "tabela: 32/256");
}

#[test]
fn a3_raiz_b_nada_fora_da_regiao_e_decodificado() {
    let a = raiz_unica(0x08);
    for b in &a.blocos {
        for i in &b.instrucoes {
            assert!(
                i.endereco < 0x100,
                "A3: instrucao fora da regiao declarada: {:#x}",
                i.endereco
            );
        }
    }
    // `longe_b` esta em 0x128: os dois saltos que o apontam param na fronteira.
    assert!(
        !a.enderecos_decodificados().contains(&0x128),
        "A3: 0x128 (fora) foi decodificado"
    );
}

#[test]
fn a2_fronteiras_de_b_sao_tres_e_de_dois_tipos_distintos() {
    let a = raiz_unica(0x08);
    let mut tipos: Vec<(u32, &str)> = a
        .fronteiras
        .iter()
        .map(|f| (f.endereco, f.tipo.as_str()))
        .collect();
    tipos.sort_unstable();
    assert_eq!(
        tipos,
        vec![
            (0x0E, "limite-de-regiao"),
            (0x14, "limite-de-regiao"),
            (0x26, "indirect-opaque"),
        ],
        "tabela: fronteiras(b)"
    );
    let distintos: Vec<&str> = {
        let mut v: Vec<&str> = a.fronteiras.iter().map(|f| f.tipo.as_str()).collect();
        v.sort_unstable();
        v.dedup();
        v
    };
    assert_eq!(distintos.len(), 2, "A2: dois tipos distintos");
}

#[test]
fn a2_chamadas_de_b_exatamente_uma_por_status_e_a_indireta_sem_alvo() {
    let a = raiz_unica(0x08);
    assert_eq!(a.chamadas.len(), 3, "tabela: chamadas(b) = 3");
    let por_sitio = |s: u32| a.chamadas.iter().find(|c| c.sitio == s);
    let c = por_sitio(0x0a).expect("bsr.w em 0x0a");
    assert_eq!(c.status, Status::Resolvido);
    assert_eq!(c.alvo, Some(0x22), "alvo dentro da regiao");
    let c = por_sitio(0x0e).expect("jsr.abs.L em 0x0e");
    assert_eq!(c.status, Status::ForaDaRegiao);
    assert_eq!(c.alvo, Some(0x128));
    let c = por_sitio(0x26).expect("jmp (%a2) em 0x26");
    assert_eq!(c.status, Status::IndiretoOpaco);
    assert_eq!(c.alvo, None, "A2: nenhum alvo numerico na indireta");
    assert_eq!(c.forma, "jmp");
    // O `beq.w` de 0x14 salta, nao chama: nao pode ter entrada em chamadas.
    assert!(
        por_sitio(0x14).is_none(),
        "A2: desvio condicional nao e chamada"
    );
    let fora = a
        .chamadas
        .iter()
        .filter(|c| c.status == Status::ForaDaRegiao)
        .count();
    let resolvidas = a
        .chamadas
        .iter()
        .filter(|c| c.status == Status::Resolvido)
        .count();
    assert_eq!((fora, resolvidas), (1, 1), "A2: exatamente uma de cada");
}

#[test]
fn a1_arestas_de_b_por_tipo_e_status_batem_com_a_tabela() {
    let a = raiz_unica(0x08);
    let mut chaves: Vec<String> = a.arestas.iter().map(chave).collect();
    chaves.sort();
    // Tabela §2, linha "arestas por (tipo,status)" + linha "arestas = 10",
    // retificada pelo ADENDO-ETAPA2-2026-10-04 A-8: a corrida linear dentro de
    // um bloco NAO emite aresta de queda (CONTRACT §4 + `montar_blocos`, regra
    // ja publicada na ETAPA 1). As quedas existem so nos pontos de transferencia
    // e nas junturas: 0x0a->0x0e, 0x0e->0x14, 0x14->0x18, 0x1a->0x1e = 4.
    let esperadas: &[&str] = &[
        "chamada/fora-da-regiao",
        "chamada/indireto-opaco",
        "chamada/resolvido",
        "desvio/fora-da-regiao",
        "desvio/resolvido",
        "queda/resolvido",
        "queda/resolvido",
        "queda/resolvido",
        "queda/resolvido",
        "retorno-fronteira/indireto-opaco",
    ];
    let mut esperadas: Vec<String> = esperadas.iter().map(|s| s.to_string()).collect();
    esperadas.sort();
    assert_eq!(
        chaves, esperadas,
        "ADENDO A-8: 4 quedas + 3 chamadas + 2 desvios + 1 retorno = 10"
    );
    assert_eq!(a.arestas.len(), 10, "tabela: arestas(b) = 10");
    // Invariante que a tabela nao garantia: o detalhamento por (tipo,status) e a
    // contagem total sao o MESMO conjunto. Com ele as duas linhas nao podem mais
    // divergir em silencio.
    assert_eq!(
        chaves.len(),
        a.arestas.len(),
        "linha (tipo,status) e linha arestas tem de concordar"
    );
}

#[test]
fn a2_assimetria_e_a_prova_nada_de_raiz_a_aparece_em_b() {
    let a = raiz_unica(0x00);
    let b = raiz_unica(0x08);
    assert!(
        b.blocos.len() > a.blocos.len(),
        "A2: |blocos(b)| > |blocos(a)|"
    );
    assert_ne!(a.cobertura.fracao, b.cobertura.fracao);
    // A0/A4: as duas fracoes sao denominadas pela MESMA regiao; nao ha media.
    assert_eq!(a.cobertura.bytes_regiao, b.cobertura.bytes_regiao);
    assert_eq!(a.fronteiras[0].tipo, "opcode-fora-do-subconjunto");
    assert!(b
        .fronteiras
        .iter()
        .all(|f| f.tipo != "opcode-fora-do-subconjunto"));
}

#[test]
fn a1_laco_e_retorno_registrados_como_na_tabela() {
    let a = raiz_unica(0x08);
    let desvio = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x1a && e.tipo == Tipo::Desvio)
        .expect("dbra em 0x1a deve ter aresta de desvio");
    assert_eq!(desvio.alvo, Some(0x08), "laco para raiz_b");
    assert_eq!(desvio.status, Status::Resolvido);
    let queda_1a = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x1a && e.tipo == Tipo::Queda)
        .expect("dbra tem queda");
    assert_eq!(queda_1a.alvo, Some(0x1e));
    let retorno = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x20 && e.tipo == Tipo::RetornoFronteira)
        .expect("rts em 0x20 e fronteira de retorno");
    assert_eq!(retorno.alvo, None);
    assert_eq!(retorno.status, Status::IndiretoOpaco);
    // O `jmp (%a2)` de 0x26 nao tem queda: o caminho termina ali.
    assert!(
        !a.arestas
            .iter()
            .any(|e| e.origem == 0x26 && e.tipo == Tipo::Queda),
        "0x26: jmp nao pode ter fallthrough"
    );
}
