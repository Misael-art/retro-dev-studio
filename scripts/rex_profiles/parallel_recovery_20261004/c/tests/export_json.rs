//! Export `rex-cfg/v2`: forma, vocabulario e determinismo.
//!
//! As chaves e os textos seguem CONTRACT §4 literalmente (incluindo a mistura
//! `caminho_declarado` / `bytes-decodificados` que o contrato congelou). Nada
//! aqui e medicao de ROM: as afirmacoes sao sobre o TEXTO do export, e o
//! determinismo e comparado byte a byte entre duas execucoes — round-trip
//! interno nao e prova de paridade com o instrumento (isso vive em
//! `calib_parity.rs` e `fx_fluxo.rs`).

use rex_cfg::export::{export_json, export_markdown, Objeto, BASE_SHA, SCHEMA, TOOL_NAME};
use rex_cfg::grafo::{analisar, analisar_com_proveniencias, LIMITES};
use rex_gameplay::json::Json;

const FX01: &[u8] = include_bytes!("../fixtures/fx01_branches.bin");
const FX04: &[u8] = include_bytes!("../fixtures/fx04_calls.bin");
const FX05: &[u8] = include_bytes!("../fixtures/fx05_indirect.bin");

fn json_de(bytes: &'static [u8], raizes: &[u32], caminho: &str) -> Json {
    let texto = exporta(bytes, raizes, caminho);
    Json::parse(&texto).unwrap_or_else(|e| panic!("export nao é JSON valido: {e}\n{texto}"))
}

fn exporta(bytes: &'static [u8], raizes: &[u32], caminho: &str) -> String {
    let analise = analisar(bytes, raizes, (0x0, 0xFFFF_FFFF), &[0x0], u64::MAX / 4)
        .expect("analise do fixture");
    let objeto = Objeto {
        caminho_declarado: caminho,
        bytes,
    };
    export_json(&analise, &objeto, "fixture autoral montado com m68k-elf-as")
}

fn texto_de(item: &Json, campo: &str, permitidos: &[&str], onde: &str) {
    let obtido = item
        .str_at(campo)
        .unwrap_or_else(|_| panic!("{onde}: campo {campo} nao e texto"));
    assert!(
        permitidos.contains(&obtido),
        "{onde}.{campo} = {obtido:?} fora do vocabulario congelado (§4)"
    );
}

#[test]
fn corpo_usa_o_vocabulario_de_textos_do_contrato() {
    let j = json_de(FX04, &[0x0], "fixtures/fx04_calls.bin");

    for (i, e) in j
        .field("arestas")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .enumerate()
    {
        let onde = format!("arestas[{i}]");
        texto_de(
            e,
            "tipo",
            &["queda", "desvio", "chamada", "retorno-fronteira"],
            &onde,
        );
        texto_de(
            e,
            "status",
            &["resolvido", "fora-da-regiao", "indireto-opaco", "armadilha"],
            &onde,
        );
        assert!(e.field("origem").is_ok(), "{onde} sem origem");
        match e.field("alvo").unwrap() {
            Json::Null => assert_eq!(e.str_at("tipo").unwrap(), "retorno-fronteira", "{onde}"),
            Json::Int(_) => {}
            other => panic!("{onde}: alvo nem inteiro nem nulo: {other:?}"),
        }
    }
    for (i, s) in j
        .field("sitios")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .enumerate()
    {
        texto_de(
            s,
            "veredito",
            &[
                "instrucao-de-bloco",
                "miolo-de-instrucao",
                "dentro-regiao-nao-alcancado",
                "fora-da-regiao",
                "ponto-de-fronteira",
            ],
            &format!("sitios[{i}]"),
        );
    }

    for (i, b) in j
        .field("blocos")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .enumerate()
    {
        let onde = format!("blocos[{i}]");
        assert_eq!(b.str_at("saida").unwrap(), "fim-de-bloco", "{onde}");
        assert!(
            b.field("alcanado-por").is_ok(),
            "{onde} sem campo alcanado-por"
        );
        let ins = b.field("instrucoes").unwrap().as_arr().unwrap();
        assert!(!ins.is_empty(), "{onde} vazio no export");
        for (k, item) in ins.iter().enumerate() {
            assert!(
                item.field("endereco").is_ok() && item.field("tam").is_ok(),
                "{onde}.instrucoes[{k}]"
            );
            assert!(
                !item.str_at("mnem").unwrap().is_empty(),
                "{onde}.instrucoes[{k}] sem mnem"
            );
            assert!(
                !item.str_at("classe").unwrap().is_empty(),
                "{onde}.instrucoes[{k}] sem classe"
            );
        }
        for (k, s) in b
            .field("sucessores")
            .unwrap()
            .as_arr()
            .unwrap()
            .iter()
            .enumerate()
        {
            texto_de(
                s,
                "tipo",
                &["queda", "desvio", "chamada"],
                &format!("{onde}.sucessores[{k}]"),
            );
            assert!(s.field("alvo").is_ok(), "{onde}.sucessores[{k}] sem alvo");
        }
    }

    // raizes: o grau declarado pelo operador nunca e promovido (§0.1, §1)
    let raizes = j.field("raizes").unwrap().as_arr().unwrap();
    assert_eq!(raizes[0].i64_at("endereco").unwrap(), 0);
    assert_eq!(raizes[0].str_at("grau").unwrap(), "candidato");
    assert_eq!(raizes[0].str_at("proveniencia").unwrap(), "candidato");

    // chamadas: params/clobbers sao literais do contrato, nunca inferidos
    for c in j.field("chamadas").unwrap().as_arr().unwrap() {
        assert_eq!(c.str_at("params").unwrap(), "nao-inferidos");
        assert_eq!(c.str_at("clobbers").unwrap(), "nao-modelado");
    }

    let limites = j.field("limites").unwrap().as_arr().unwrap();
    let textos: Vec<&str> = limites.iter().map(|l| l.as_str().unwrap()).collect();
    assert_eq!(
        textos, LIMITES,
        "limites do export diferentes dos textos do contrato"
    );
}

#[test]
fn cabecalho_identifica_esquema_ferramenta_e_objeto() {
    let j = json_de(FX01, &[0x0], "fixtures/fx01_branches.bin");
    assert_eq!(j.str_at("schema").unwrap(), SCHEMA);
    assert_eq!(j.str_at("schema").unwrap(), "rex-cfg/v2");

    let tool = j.field("tool").unwrap();
    assert_eq!(tool.str_at("name").unwrap(), TOOL_NAME);
    assert!(
        !tool.str_at("version").unwrap().is_empty(),
        "tool.version vazio"
    );
    assert_eq!(
        tool.str_at("base_sha").unwrap(),
        BASE_SHA,
        "tool.base_sha deve pinar a base do contrato (cb56657...)"
    );

    let objeto = j.field("objeto").unwrap();
    assert_eq!(
        objeto.str_at("caminho_declarado").unwrap(),
        "fixtures/fx01_branches.bin"
    );
    let digest = objeto.str_at("sha256").unwrap();
    assert_eq!(digest.len(), 64, "sha256 nao parece um digest: {digest}");
    assert!(
        digest.chars().all(|c| c.is_ascii_hexdigit()),
        "sha256 com caracteres nao-hex: {digest}"
    );
    assert_eq!(
        digest,
        rex_gameplay::sha256::sha256_hex(FX01),
        "objeto.sha256 nao e o digest dos bytes analisados"
    );
    assert_eq!(objeto.i64_at("tamanho").unwrap() as usize, FX01.len());

    let regiao = j.field("regiao").unwrap();
    assert_eq!(regiao.i64_at("inicio").unwrap(), 0);
    assert_eq!(
        regiao.i64_at("fim").unwrap(),
        FX01.len() as i64,
        "fim exclusivo = tamanho do objeto"
    );
    assert!(!regiao.str_at("proveniencia").unwrap().is_empty());
}

#[test]
fn cobertura_soma_comprimentos_e_a_fracao_e_texto_inteiro() {
    let j = json_de(FX05, &[0x0, 0x4], "fixtures/fx05_indirect.bin");
    let cob = j.field("cobertura").unwrap();
    let dec = cob.i64_at("bytes-decodificados").unwrap();
    let reg = cob.i64_at("bytes-regiao").unwrap();
    assert!(
        reg > 0 && dec > 0 && dec <= reg,
        "cobertura sem sentido: {dec}/{reg}"
    );

    // fracao e texto com quatro casas: o JSON do projeto so carrega inteiros
    let fracao = cob.str_at("fracao").unwrap();
    assert!(
        fracao.contains('.') && fracao.split('.').count() == 2,
        "fracao = {fracao:?}"
    );
    let casas = fracao.split('.').nth(1).unwrap();
    assert_eq!(casas.len(), 4, "fracao sem quatro casas: {fracao}");

    // soma dos comprimentos dos blocos == bytes-decodificados (nao bounding box)
    let soma: i64 = j
        .field("blocos")
        .unwrap()
        .as_arr()
        .unwrap()
        .iter()
        .flat_map(|b| b.field("instrucoes").unwrap().as_arr().unwrap().iter())
        .map(|i| i.i64_at("tam").unwrap())
        .sum();
    assert_eq!(
        soma, dec,
        "cobertura nao e a soma dos comprimentos provados"
    );

    // vaos: spans dentro da regiao que nenhum byte reclamado cobre
    for vao in cob.field("vaos").unwrap().as_arr().unwrap() {
        let ini = vao.i64_at("inicio").unwrap();
        let fim = vao.i64_at("fim").unwrap();
        assert!(ini < fim, "vao degenerado: {ini:#x}..{fim:#x}");
        assert!(fim <= reg && ini >= 0, "vao fora da regiao");
    }
}

#[test]
fn fronteiras_registradas_tem_tipo_do_vocabulario_e_motivo_legivel() {
    // fx02: o par 67ff interrompe o caminho sem reclamar comprimento
    let bytes: &'static [u8] = include_bytes!("../fixtures/fx02_extended.bin");
    let texto = exporta(bytes, &[0x0], "fixtures/fx02_extended.bin");
    let j = Json::parse(&texto).expect("json valido");
    let fs = j.field("fronteiras").unwrap().as_arr().unwrap();
    assert!(
        !fs.is_empty(),
        "fx02 deveria exportar ao menos uma fronteira"
    );
    for f in fs {
        let tipo = f.str_at("tipo").unwrap();
        assert!(
            [
                "opcode-fora-do-subconjunto",
                "indirect-opaque",
                "trap-opaco",
                "limite-de-regiao",
                "limite-de-trabalho"
            ]
            .contains(&tipo),
            "tipo de fronteira {tipo:?} fora do vocabulario"
        );
        assert!(
            !f.str_at("motivo").unwrap().is_empty(),
            "fronteira sem motivo"
        );
        assert!(f.field("endereco").is_ok());
        match f.field("opcode").unwrap() {
            Json::Null => {}
            Json::Int(_) => {}
            other => panic!("opcode de fronteira nao e inteiro nem nulo: {other:?}"),
        }
    }
}

#[test]
fn export_e_deterministico_byte_a_byte() {
    let a = exporta(FX04, &[0x0], "fixtures/fx04_calls.bin");
    let b = exporta(FX04, &[0x0], "fixtures/fx04_calls.bin");
    assert_eq!(
        a, b,
        "duas execucoes sobre os mesmos bytes dao texto diferente"
    );

    // ordem das raizes nao altera o texto (normalizacao por endereco)
    let c = {
        let analise = analisar(
            FX04,
            &[0x16, 0x0],
            (0x0, 0xFFFF_FFFF),
            &[0x0e, 0x02],
            100_000,
        )
        .unwrap();
        export_json(
            &analise,
            &Objeto {
                caminho_declarado: "x",
                bytes: FX04,
            },
            "p",
        )
    };
    let d = {
        let analise = analisar(
            FX04,
            &[0x0, 0x16],
            (0x0, 0xFFFF_FFFF),
            &[0x02, 0x0e],
            100_000,
        )
        .unwrap();
        export_json(
            &analise,
            &Objeto {
                caminho_declarado: "x",
                bytes: FX04,
            },
            "p",
        )
    };
    assert_eq!(c, d, "a ordem de --root/--site alterou o export");

    // proveniancias declaradas entram no export sem promover o grau
    let analise = analisar_com_proveniencias(
        FX04,
        &[(0x0, "vetor-plataforma"), (0x16, "referencia-estatica")],
        (0x0, 0xFFFF_FFFF),
        &[],
        100_000,
    )
    .unwrap();
    let texto = export_json(
        &analise,
        &Objeto {
            caminho_declarado: "x",
            bytes: FX04,
        },
        "p",
    );
    let j = Json::parse(&texto).unwrap();
    let raizes = j.field("raizes").unwrap().as_arr().unwrap();
    let grau_de = |end: i64| {
        raizes
            .iter()
            .find(|r| r.i64_at("endereco").unwrap() == end)
            .unwrap()
            .str_at("grau")
            .unwrap()
            .to_string()
    };
    assert_eq!(grau_de(0x0), "vetor-plataforma");
    assert_eq!(grau_de(0x16), "referencia-estatica");
    for r in raizes {
        assert_ne!(
            r.str_at("grau").unwrap(),
            "observado-em-runtime",
            "grau promovido"
        );
    }
}

#[test]
fn markdown_resumo_cita_os_mesmos_numeros_do_json() {
    let analise = analisar(FX01, &[0x0], (0x0, 0xFFFF_FFFF), &[0x0a], u64::MAX / 4).unwrap();
    let objeto = Objeto {
        caminho_declarado: "fixtures/fx01_branches.bin",
        bytes: FX01,
    };
    let md = export_markdown(&analise, &objeto, "fixture autoral");
    assert!(
        md.contains("rex-cfg/v2"),
        "markdown sem identidade de esquema"
    );
    assert!(
        md.contains(&analise.cobertura.bytes_decodificados.to_string()),
        "md sem bytes decodificados"
    );
    assert!(
        md.contains(&analise.blocos.len().to_string()),
        "md sem contagem de blocos"
    );
    assert!(
        md.contains(&analise.fronteiras.len().to_string()),
        "md sem contagem de fronteiras"
    );
    assert!(md.contains("nao-inferidos"), "md sem os limites de chamada");
    assert!(
        md.contains(&analise.cobertura.fracao),
        "md sem a fracao de cobertura"
    );
}
