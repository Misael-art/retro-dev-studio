//! Expectativas de FLUXO dos fixtures `fx01..fx08`, contra o INSTRUMENTO
//! independente.
//!
//! Congeladas em `docs/rex_profiles/parallel_recovery_20261004/c/
//! EXPECTATIONS-ETAPA1.md` §2 (tabela fx01..fx08) ANTES de qualquer
//! implementacao. Cada teste le os bytes do fixture montado e linkado
//! (`fixtures/fxNN.bin`), roda a analise de fluxo delimitada e compara os alvos
//! de aresta com o alvo absoluto impresso por `m68k-elf-objdump` para a MESMA
//! instrucao (`fixtures/fxNN-objdump.txt`). Comprimento e alvo do instrumento
//! sao a referencia; round-trip interno nao e prova.
//!
//! Regras que os testes abaixo tambem verificam, por serem o ponto da letra C:
//! - base de deslocamento = `instrucao + 2` (a formula historica), nunca `+ len`;
//! - o valor que a formula ERRADA produziria e registrado como NAO produzido;
//! - onde o subconjunto nao cobre, o caminho PARA: fronteira, sem continuar por
//!   comprimento inventado e sem decodificar fora da regiao.

#[path = "support/oracle.rs"]
mod oracle;

use oracle::{desvio_disp8_ff, parse_objdump, Rec};
use rex_cfg::grafo::{analisar, analisar_com_proveniencias, Analise, Status, Tipo, Veredito};

/// Regiao sem recorte: o fixture inteiro, com limite de trabalho folgado.
const TUDO: (u32, u32) = (0x0, 0xFFFF_FFFF);
const SEM_LIMITE: u64 = u64::MAX / 4;

fn bin_de(nome: &str) -> &'static [u8] {
    match nome {
        "fx01_branches" => include_bytes!("../fixtures/fx01_branches.bin"),
        "fx02_extended" => include_bytes!("../fixtures/fx02_extended.bin"),
        "fx03_dbcc" => include_bytes!("../fixtures/fx03_dbcc.bin"),
        "fx04_calls" => include_bytes!("../fixtures/fx04_calls.bin"),
        "fx05_indirect" => include_bytes!("../fixtures/fx05_indirect.bin"),
        "fx06_data_opcodes" => include_bytes!("../fixtures/fx06_data_opcodes.bin"),
        "fx07_out_of_region" => include_bytes!("../fixtures/fx07_out_of_region.bin"),
        "fx08_relative_base_historico" => {
            include_bytes!("../fixtures/fx08_relative_base_historico.bin")
        }
        other => panic!("fixture desconhecido {other}"),
    }
}

/// Roda a analise de um fixture com raizes `candidato` (grau declarado pelo
/// operador, nunca promovido pela ferramenta).
fn fx(nome: &str, raizes: &[u32], regiao: (u32, u32), sitios: &[u32]) -> Analise {
    analisar(bin_de(nome), raizes, regiao, sitios, SEM_LIMITE)
        .unwrap_or_else(|e| panic!("{nome}: analise falhou: {e}"))
}

fn registro(recs: &[Rec], addr: u32) -> &Rec {
    recs.iter()
        .find(|r| r.addr == addr)
        .unwrap_or_else(|| panic!("o instrumento nao tem registro proprio em {addr:#x}"))
}

/// Alvo do instrumento, obrigatorio presence: os testes so fazem sentido em
/// enderecos que o instrumento resolveu.
fn alvo_instrumento(recs: &[Rec], addr: u32) -> u32 {
    registro(recs, addr)
        .target
        .unwrap_or_else(|| panic!("instrumento nao declara alvo em {addr:#x}"))
}

fn alvo_de(e: &rex_cfg::grafo::Aresta) -> u32 {
    e.alvo
        .unwrap_or_else(|| panic!("aresta em {:#x} sem alvo", e.origem))
}

// ---------------------------------------------------------------------------
// fx01 — desvios: todo alvo de aresta == alvo do instrumento; a formula errada
//        nao e produzida; o caminho para no rts sem continuar.
// ---------------------------------------------------------------------------
#[test]
fn fx01_cada_aresta_de_desvio_reproduz_o_alvo_do_instrumento() {
    let nome = "fx01_branches";
    let recs = parse_objdump(include_str!("../fixtures/fx01_branches-objdump.txt"));
    let a = fx(nome, &[0x0], TUDO, &[]);

    let desvios_instru: Vec<&Rec> = recs
        .iter()
        .filter(|r| r.target.is_some() && !desvio_disp8_ff(r))
        .collect();
    assert!(
        desvios_instru.len() >= 6,
        "fx01: esperado pelo menos 6 desvios com alvo do instrumento, obtido {}",
        desvios_instru.len()
    );

    for r in &desvios_instru {
        let e = a
            .arestas
            .iter()
            .find(|e| e.origem == r.addr && matches!(e.tipo, Tipo::Desvio | Tipo::Chamada))
            .unwrap_or_else(|| {
                panic!(
                    "fx01: nenhuma aresta de desvio partindo de {:#x} [{}]",
                    r.addr, r.token
                )
            });
        assert_eq!(
            alvo_de(e),
            r.target.unwrap(),
            "fx01: {:#x} [{}] alvo do instrumento {:#x}, grafo {:#x}",
            r.addr,
            r.token,
            r.target.unwrap(),
            alvo_de(e)
        );
        assert_eq!(e.status, Status::Resolvido, "fx01: aresta em {:#x}", r.addr);
    }
}

#[test]
fn fx01_o_alvo_da_formula_errada_nao_aparece_no_grafo() {
    // Casos discriminantes medidos no instrumento: displacamento em endereco par,
    // de modo que base = instr+2 e base = fim da instrucao dao alvos diferentes.
    const DISCRIMINANTES: &[(u32, &str, u32, u32)] = &[
        (0x18, "bne.w +4", 0x1e, 0x20),
        (0x1e, "dbra -10", 0x16, 0x18),
        (0x22, "dbf -20", 0x10, 0x12),
    ];
    let a = fx("fx01_branches", &[0x0], TUDO, &[]);
    for (addr, o_que, correta, errada) in DISCRIMINANTES {
        let alvos: Vec<u32> = a
            .arestas
            .iter()
            .filter(|e| e.origem == *addr)
            .filter_map(|e| e.alvo)
            .collect();
        assert!(!alvos.is_empty(), "fx01: sem aresta em {addr:#x} ({o_que})");
        assert!(
            alvos.contains(correta),
            "fx01: {addr:#x} ({o_que}) deveria apontar para {correta:#x}; obtido {alvos:?}"
        );
        assert!(
            !alvos.contains(errada),
            "fx01: {addr:#x} ({o_que}): a formula historica ERRADA (base = fim da instrucao) \
             produziria {errada:#x}; este valor esta registrado como NAO produzido"
        );
    }
}

#[test]
fn fx01_o_caminho_termina_no_rts_sem_aresta_de_volta() {
    let recs = parse_objdump(include_str!("../fixtures/fx01_branches-objdump.txt"));
    let a = fx("fx01_branches", &[0x0], TUDO, &[]);
    // O `rts` do fx01 esta em 0x26 (medido no instrumento). Nada comeca depois
    // dele e a aresta de retorno nao tem alvo inventado.
    assert_eq!(
        registro(&recs, 0x26).token,
        "rts",
        "fx01: o rts mudou de endereco; ajuste a MEDICAO, nao o teste"
    );
    let entradas: Vec<u32> = a.blocos.iter().map(|b| b.entrada).collect();
    assert!(
        !entradas.iter().any(|e| e >= &0x28),
        "fx01: existe bloco depois do rts: {entradas:?}"
    );
    let de_retorno: Vec<&_> = a
        .arestas
        .iter()
        .filter(|e| e.tipo == Tipo::RetornoFronteira)
        .collect();
    assert_eq!(
        de_retorno.len(),
        1,
        "fx01: esperado um terminador de retorno"
    );
    assert_eq!(de_retorno[0].origem, 0x26);
    assert!(
        de_retorno[0].alvo.is_none(),
        "fx01: retorno com alvo inventado"
    );
}

#[test]
fn fx01_sitio_dentro_de_instrucao_e_miolo_nao_inicio() {
    // 0x0a e o beq.w de 4 bytes (medido), que pertence ao bloco iniciado em 0x08;
    // 0x0c cai NO MIOLO dessa instrucao.
    let a = fx("fx01_branches", &[0x0], TUDO, &[0x0a, 0x0c]);
    let v = |addr: u32| {
        a.sitios
            .iter()
            .find(|s| s.endereco == addr)
            .unwrap_or_else(|| panic!("sitio {addr:#x} ausente"))
    };
    assert_eq!(v(0x0a).veredito, "instrucao-de-bloco");
    assert_eq!(v(0x0a).bloco, Some(0x8));
    assert_eq!(v(0x0c).veredito, "miolo-de-instrucao");
    assert_eq!(
        v(0x0c).bloco,
        Some(0x8),
        "miolo deve apontar o bloco que o cobre"
    );
}

// ---------------------------------------------------------------------------
// fx02 — extensao word e recusa da forma 68020.
// ---------------------------------------------------------------------------
#[test]
fn fx02_disp8_zero_resolve_pela_extensao_word_com_base_instr_mais_2() {
    let recs = parse_objdump(include_str!("../fixtures/fx02_extended-objdump.txt"));
    // 0x06: `6300 0004` = desvio com disp8 = 0, extensao word; alvo do
    // instrumento = 0x06 + 2 + 4 = 0x0c. A formula errada daria 0x0e.
    let r = registro(&recs, 0x06);
    assert_eq!(
        r.len, 4,
        "fx02: o instrumento le a extensao word como {} bytes",
        r.len
    );
    let correta = alvo_instrumento(&recs, 0x06);
    assert_eq!(correta, 0x0c);
    let a = fx("fx02_extended", &[0x0], TUDO, &[]);
    let e = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x06 && e.tipo == Tipo::Desvio)
        .expect("fx02: sem aresta de desvio em 0x06");
    assert_eq!(alvo_de(e), correta);
    assert_ne!(
        alvo_de(e),
        0x0e,
        "fx02: a formula da base errada (fim da instrucao) produz 0x0e"
    );
}

#[test]
fn fx02_disp8_ff_produz_fronteira_sem_reclamar_comprimento() {
    let recs = parse_objdump(include_str!("../fixtures/fx02_extended-objdump.txt"));
    let r = registro(&recs, 0x0e);
    assert!(
        desvio_disp8_ff(r),
        "fx02: 0x0e deveria ser o probe disp8=0xFF"
    );
    // Medido: com `nop;rts` depois, o MESMO instrumento le 6 bytes (`beql`); no
    // corpus calib, com `51ff` depois, leu 2 bytes (`beqs`). O par de bytes nao
    // tem comprimento comprovavel — a ferramenta para.
    assert_eq!(
        r.len, 6,
        "fx02: registro do instrumento em 0x0e tem {} bytes",
        r.len
    );
    let a = fx("fx02_extended", &[0x0], TUDO, &[0x0e, 0x10]);
    let f = a
        .fronteiras
        .iter()
        .find(|f| f.endereco == 0x0e)
        .unwrap_or_else(|| panic!("fx02: sem fronteira em 0x0e; {:?}", a.fronteiras));
    assert_eq!(f.tipo, "opcode-fora-do-subconjunto");
    assert_eq!(f.opcode, Some(0x67FF));
    // A instrucao nao e reclamada: nenhum byte em 0x0e..0x10 pertence a bloco.
    let dec = a.enderecos_decodificados();
    assert!(
        !dec.contains(&0x0e),
        "fx02: reclamou a forma ambigua: {dec:?}"
    );
    assert!(
        !a.blocos.iter().any(|b| b.entrada > 0x0e),
        "fx02: a analise continuou depois da fronteira: {:?}",
        a.blocos
            .iter()
            .map(|b| (b.entrada, b.instrucoes.len()))
            .collect::<Vec<_>>()
    );
    assert_eq!(a.veredito_sitio(0x10), Veredito::DentroRegiaoNaoAlcancado);
    assert_eq!(a.veredito_sitio(0x0e), Veredito::PontoDeFronteira);
}

// ---------------------------------------------------------------------------
// fx03 — DBcc: duas arestas cada (taken com base instr+2, queda em instr+4).
// ---------------------------------------------------------------------------
#[test]
fn fx03_dbcc_tem_duas_arestas_e_bate_com_o_instrumento() {
    let nome = "fx03_dbcc";
    let recs = parse_objdump(include_str!("../fixtures/fx03_dbcc-objdump.txt"));
    let a = fx(nome, &[0x0], TUDO, &[]);
    let dbs: Vec<&Rec> = recs.iter().filter(|r| r.token.starts_with("db")).collect();
    assert!(
        dbs.len() >= 3,
        "{nome}: esperado >= 3 DBcc no fixture, obtido {}",
        dbs.len()
    );
    for r in &dbs {
        assert_eq!(
            r.len, 4,
            "{nome}: DBcc em {:#x} medido com {} bytes",
            r.addr, r.len
        );
        let n = a.arestas.iter().filter(|e| e.origem == r.addr).count();
        assert_eq!(
            n, 2,
            "{nome}: DBcc em {:#x} deveria ter 2 arestas (taken + queda); tem {n}",
            r.addr
        );
        let tomada = a
            .arestas
            .iter()
            .find(|e| e.origem == r.addr && e.tipo == Tipo::Desvio)
            .expect("aresta taken");
        assert_eq!(
            alvo_de(tomada),
            alvo_instrumento(&recs, r.addr),
            "{nome}: alvo do DBcc em {:#x}",
            r.addr
        );
        let queda = a
            .arestas
            .iter()
            .find(|e| e.origem == r.addr && e.tipo == Tipo::Queda)
            .expect("aresta queda");
        assert_eq!(
            alvo_de(queda),
            r.addr + 4,
            "{nome}: queda do DBcc em {:#x}",
            r.addr
        );
        // as duas leituras da formula errada possiveis para um DBcc de 4 bytes
        assert_ne!(
            alvo_de(tomada),
            r.addr + 2,
            "{nome}: taken com base = instr+2 e disp 0"
        );
    }
}

// ---------------------------------------------------------------------------
// fx04 — chamadas: arestas com alvo, continuacao pos-chamada, rts sem volta.
// ---------------------------------------------------------------------------
#[test]
fn fx04_chamadas_tem_alvo_resolvido_e_a_subrotina_vira_bloco_dentro_de_fluxo() {
    let recs = parse_objdump(include_str!("../fixtures/fx04_calls-objdump.txt"));
    let a = fx("fx04_calls", &[0x0], TUDO, &[]);

    // tres sitios de chamada medidos: 0x02 (bsr.w), 0x08 (jsr abs.W), 0x0e (abs.L)
    for s in [0x02u32, 0x08, 0x0e] {
        let alvo = alvo_instrumento(&recs, s);
        let c = a
            .chamadas
            .iter()
            .find(|c| c.sitio == s)
            .unwrap_or_else(|| panic!("fx04: chamada ausente em {s:#x}; {:?}", a.chamadas));
        assert_eq!(
            c.alvo,
            Some(alvo),
            "fx04: chamada em {s:#x} tem alvo {:?}",
            c.alvo
        );
        assert_eq!(c.status, Status::Resolvido);
        assert_eq!(c.params, "nao-inferidos", "fx04: params nunca promovidos");
        assert_eq!(c.clobbers, "nao-modelado", "fx04: clobbers nunca modelados");
        let e = a
            .arestas
            .iter()
            .find(|e| e.origem == s && e.tipo == Tipo::Chamada)
            .expect("aresta de chamada");
        assert_eq!(alvo_de(e), alvo);
        assert!(
            a.raizes
                .iter()
                .any(|r| r.endereco == alvo && r.grau == "dentro-de-fluxo"),
            "fx04: alvo {alvo:#x} nao entrou como raiz derivada dentro-de-fluxo"
        );
    }

    // continuacao pos-chamada analisada como fluxo da chamadora.
    // Medido no instrumento: o `jsr abs.L` de 0x0e ocupa 6 bytes (0x0e..0x14),
    // entao 0x10 NAO e inicio de instrucao da chamadora — e miolo. A lista
    // original deste teste (congelada antes da montagem) trazia 0x10 como
    // instrucao; a medicao refuta essa aritmetica e o teste passa a afirmar o
    // que o instrumento mostra, incluindo o veredito de miolo.
    let dec = a.enderecos_decodificados();
    for esperado in [0x06u32, 0x0c, 0x14] {
        assert!(
            dec.contains(&esperado),
            "fx04: fluxo da chamadora nao passou por {esperado:#x}; lidos {dec:?}"
        );
    }
    assert!(
        !dec.contains(&0x10),
        "fx04: 0x10 e miolo do jsr.abs.L de 6 bytes em 0x0e, nao instrucao: {dec:?}"
    );
    let a_miolo = fx("fx04_calls", &[0x0], TUDO, &[0x10]);
    assert_eq!(a_miolo.veredito_sitio(0x10), Veredito::MioloDeInstrucao);

    // rts das sub-rotinas: terminador sem alvo (0x1e sub1, 0x22 sub2w, 0x26 sub2)
    for s in [0x1eu32, 0x22, 0x26] {
        assert_eq!(
            registro(&recs, s).token,
            "rts",
            "fx04: {s:#x} nao e rts no instrumento"
        );
        let t = a
            .arestas
            .iter()
            .find(|e| e.origem == s && e.tipo == Tipo::RetornoFronteira)
            .unwrap_or_else(|| panic!("fx04: sem terminador de retorno em {s:#x}"));
        assert!(
            t.alvo.is_none(),
            "fx04: retorno em {s:#x} com alvo inventado"
        );
    }
}

#[test]
fn fx04_sitio_de_chamada_fora_da_regiao_continua_instrucao_de_bloco() {
    // EXPECTATIONS-ETAPA1.md, R3 expectativa 3: o sitio 0x1370 (um `bsr.w` cujo
    // alvo cai fora da regiao) tem veredito `instrucao-de-bloco`. A regra geral
    // testada aqui e de precedencia: um endereco que e INSTRUCOES COMPROVADAS
    // mantem `instrucao-de-bloco` mesmo quando a analise registra uma
    // fronteira nesse mesmo endereco; `ponto-de-fronteira` e o veredito de um
    // endereco que so tem fronteira (opcode recusado — ver fx02).
    //
    // fx04 recortado em [0x0,0xc): 0x02 `bsr.w`->0x16 e 0x08 `jsr abs.W`->0x20
    // apontam para alem do fim declarado, entao ambos viram fronteira SEM
    // deixarem de ser instrucoes lidas do fluxo.
    let a = fx("fx04_calls", &[0x0], (0x0, 0xc), &[0x02, 0x08]);
    for s in [0x02u32, 0x08] {
        assert!(
            a.fronteiras.iter().any(|f| f.endereco == s),
            "fx04: a chamada em {s:#x} nao registrou fronteira de regiao"
        );
        assert!(
            a.enderecos_decodificados().contains(&s),
            "fx04: {s:#x} nao e instrucao comprovada; lidos {:?}",
            a.enderecos_decodificados()
        );
        assert_eq!(
            a.veredito_sitio(s),
            Veredito::InstrucaoDeBloco,
            "fx04: sitio de chamada {s:#x} perdeu o grau de instrucao"
        );
    }
    // nenhum dos alvos foi inventado nem andado: as arestas dizem fora-da-regiao
    for e in a.arestas.iter().filter(|e| e.tipo == Tipo::Chamada) {
        assert_eq!(e.status, Status::ForaDaRegiao, "fx04: {:?}", e);
    }
    assert!(
        a.blocos
            .iter()
            .flat_map(|b| b.instrucoes.iter())
            .all(|i| u32::from(i.tam) > 0 && i.endereco + u32::from(i.tam) <= 0xc),
        "fx04: instrucao fora da regiao declarada"
    );
}

// ---------------------------------------------------------------------------
// fx05 — indiretos: fronteira indirect-opaque, chamada com alvo nulo.
// ---------------------------------------------------------------------------
#[test]
fn fx05_indiretos_param_e_nao_sugerem_alvo() {
    let recs = parse_objdump(include_str!("../fixtures/fx05_indirect-objdump.txt"));
    let mut vistos = 0;
    for r in &recs {
        if (r.token == "jmp" || r.token == "jsr") && r.text.contains('%') {
            assert!(
                r.target.is_none(),
                "fx05: o instrumento nao deveria imprimir alvo em {:#x} [{}]",
                r.addr,
                r.text
            );
            vistos += 1;
        }
    }
    assert_eq!(vistos, 2, "fx05: esperados os dois indiretos do fixture");

    // duas raizes: o caminho para no jmp, entao o jsr precisa de raiz propria
    let a = fx("fx05_indirect", &[0x0, 0x4], TUDO, &[]);
    for (sitio, esperado) in [(0x02u32, "jmp"), (0x06u32, "jsr")] {
        let f = a
            .fronteiras
            .iter()
            .find(|f| f.endereco == sitio)
            .unwrap_or_else(|| panic!("fx05: sem fronteira no {esperado} em {sitio:#x}"));
        assert_eq!(f.tipo, "indirect-opaque");
        let c = a
            .chamadas
            .iter()
            .find(|c| c.sitio == sitio)
            .unwrap_or_else(|| panic!("fx05: {esperado} ausente de chamadas"));
        assert_eq!(
            c.alvo, None,
            "fx05: {esperado} com alvo sugerido por aparencia"
        );
        assert_eq!(c.status, Status::IndiretoOpaco);
        assert_eq!(c.forma, esperado);
    }
    // o caminho para no indireto: o jmp e reclamado (comprimento comprovavel),
    // mas nao tem nenhuma aresta de saida — nem desvio, nem queda.
    let dec = a.enderecos_decodificados();
    assert!(
        dec.contains(&0x02) && dec.contains(&0x06),
        "fx05: os proprios indiretos: {dec:?}"
    );
    for s in [0x02u32, 0x06] {
        let saidas: Vec<&_> = a.arestas.iter().filter(|e| e.origem == s).collect();
        assert!(
            !saidas
                .iter()
                .any(|e| matches!(e.tipo, Tipo::Queda | Tipo::Desvio)),
            "fx05: {s:#x} continuou o fluxo alem do indireto: {:?}",
            saidas.iter().map(|e| (e.tipo, e.alvo)).collect::<Vec<_>>()
        );
        for e in &saidas {
            assert_eq!(e.tipo, Tipo::Chamada, "fx05: {s:#x} com aresta inesperada");
            assert_eq!(e.alvo, None, "fx05: {s:#x} com alvo sugerido por aparencia");
            assert_eq!(e.status, Status::IndiretoOpaco);
        }
    }
    assert!(
        !dec.contains(&0x0a),
        "fx05: a queda depois do jsr indireto nao deveria ser alcancada"
    );
    assert!(
        !dec.contains(&0x0c),
        "fx05: o rts depois do jsr nao deveria ser alcancado"
    );
}

#[test]
fn fx05_a_raiz_declarada_mantem_o_grau_candidato() {
    // CONTRACT §1: `dentro-de-fluxo` nao promove a raiz declarada; o grau da
    // raiz e o que o operador registrou.
    let a = analisar_com_proveniencias(
        bin_de("fx05_indirect"),
        &[(0x0, "candidato"), (0x4, "referencia-estatica")],
        TUDO,
        &[],
        SEM_LIMITE,
    )
    .expect("fx05: analise com proveniencias");
    assert_eq!(a.raizes.iter().filter(|r| r.endereco == 0x0).count(), 1);
    assert_eq!(
        a.raizes.iter().find(|r| r.endereco == 0x0).unwrap().grau,
        "candidato"
    );
    assert_eq!(
        a.raizes.iter().find(|r| r.endereco == 0x4).unwrap().grau,
        "referencia-estatica"
    );
}

// ---------------------------------------------------------------------------
// fx06 — dados que imitam codigo: vao inteiro e veredito de sitio.
// ---------------------------------------------------------------------------
#[test]
fn fx06_bytes_de_data_nao_sao_cobertos_e_o_vao_cobre_o_span_inteiro() {
    let recs = parse_objdump(include_str!("../fixtures/fx06_data_opcodes-objdump.txt"));
    assert_eq!(registro(&recs, 0x0a).token, "rts");
    // fx06.bin tem 0x1e bytes: fluxo ate 0x0c, dados de 0x0c a 0x1e
    let a = fx("fx06_data_opcodes", &[0x0], (0x0, 0x1e), &[]);

    let dec = a.enderecos_decodificados();
    assert!(
        !dec.iter().any(|e| *e >= 0x0c),
        "fx06: bloco cobriu bytes de dados: {dec:?}"
    );

    let dao = a
        .cobertura
        .vaos
        .iter()
        .find(|d| d.inicio == 0x0c)
        .unwrap_or_else(|| panic!("fx06: vaos = {:?}", a.cobertura.vaos));
    assert_eq!(
        dao.fim, 0x1e,
        "fx06: o vao deveria terminar no fim da regiao"
    );
    assert_eq!(a.cobertura.bytes_regiao, 0x1e);
    assert_eq!(a.cobertura.bytes_decodificados, 0x0c);
    // soma dos comprimentos, nao bounding box: 0x0c = 2+2+2+2+2+2
    let soma: u32 = a
        .blocos
        .iter()
        .flat_map(|b| b.instrucoes.iter().map(|i| u32::from(i.tam)))
        .sum();
    assert_eq!(soma, a.cobertura.bytes_decodificados);

    // sitios dentro dos dados = dentro-regiao-nao-alcancado, inclusive onde a
    // varredura linear leria `4eb9 ...` como jsr
    for s in [0x0cu32, 0x10, 0x16] {
        assert_eq!(
            a.veredito_sitio(s),
            Veredito::DentroRegiaoNaoAlcancado,
            "fx06: sitio {s:#x}"
        );
    }
}

#[test]
fn fx06_com_regiao_parando_no_rts_o_sitio_e_fora_da_regiao() {
    // Segunda metade da expectativa de fx06: "ou fora, conforme --region".
    let a = fx("fx06_data_opcodes", &[0x0], (0x0, 0x0c), &[0x0c, 0x10]);
    for s in [0x0cu32, 0x10] {
        assert_eq!(a.veredito_sitio(s), Veredito::ForaDaRegiao, "fx06: {s:#x}");
    }
    assert_eq!(a.cobertura.bytes_regiao, 0x0c);
    assert_eq!(a.cobertura.bytes_decodificados, 0x0c);
    assert!(
        a.cobertura.vaos.is_empty(),
        "fx06: regiao toda decodificada nao tem vao"
    );
}

// ---------------------------------------------------------------------------
// fx07 — desvio para fora da regiao.
// ---------------------------------------------------------------------------
#[test]
fn fx07_desvio_fora_da_regiao_para_a_analise_sem_leer_fora() {
    let recs = parse_objdump(include_str!("../fixtures/fx07_out_of_region-objdump.txt"));
    // 0x02: `6700 0106` -> alvo do instrumento 0x10a, fora da regiao 0x0..0x12
    let alvo = alvo_instrumento(&recs, 0x02);
    assert_eq!(alvo, 0x10a);
    let a = fx("fx07_out_of_region", &[0x0], (0x0, 0x12), &[]);
    let e = a
        .arestas
        .iter()
        .find(|e| e.origem == 0x02 && e.tipo == Tipo::Desvio)
        .expect("fx07: sem aresta de desvio em 0x02");
    assert_eq!(alvo_de(e), alvo, "fx07: o alvo deve ser o do instrumento");
    assert_eq!(e.status, Status::ForaDaRegiao);
    assert!(
        a.fronteiras
            .iter()
            .any(|f| f.endereco == 0x02 && f.tipo == "limite-de-regiao"),
        "fx07: fronteira de regiao ausente no salto; {:?}",
        a.fronteiras
    );
    let dec = a.enderecos_decodificados();
    assert!(
        dec.iter().all(|e| *e < 0x12),
        "fx07: decodificou fora da regiao: {dec:?}"
    );
    assert!(
        !dec.contains(&0x10a),
        "fx07: analise seguiu para dentro de `longe`"
    );
    // o fluxo que fica dentro da regiao continua ate o rts
    assert!(
        dec.contains(&0x06) && dec.contains(&0x08),
        "fx07: queda do salto nao analisada"
    );
}

// ---------------------------------------------------------------------------
// fx08 — formula historica em instrucoes de 4 bytes, contra o instrumento.
// ---------------------------------------------------------------------------
#[test]
fn fx08_alvo_da_ferramenta_igual_ao_instrumento_e_igual_a_instr_mais_2_mais_disp() {
    let recs = parse_objdump(include_str!(
        "../fixtures/fx08_relative_base_historico-objdump.txt"
    ));
    let a = fx("fx08_relative_base_historico", &[0x0], TUDO, &[]);
    let casos: Vec<&Rec> = recs
        .iter()
        .filter(|r| r.len == 4 && r.target.is_some() && !desvio_disp8_ff(r))
        .collect();
    assert!(
        casos.len() >= 3,
        "fx08: esperados >= 3 desvios/DBcc de 4 bytes, obtido {}",
        casos.len()
    );
    for r in &casos {
        let e = a
            .arestas
            .iter()
            .find(|x| x.origem == r.addr && matches!(x.tipo, Tipo::Desvio | Tipo::Chamada))
            .unwrap_or_else(|| panic!("fx08: sem aresta em {:#x} [{}]", r.addr, r.token));
        let correta = r.target.unwrap();
        let errada = correta + 2; // base = fim da instrucao em vez de instr + 2
        assert_eq!(alvo_de(e), correta, "fx08: {:#x} [{}]", r.addr, r.token);
        assert_ne!(
            alvo_de(e),
            errada,
            "fx08: {:#x}: a formula ERRADA daria {errada:#x}; registrado como NAO produzido",
            r.addr
        );
    }
}
