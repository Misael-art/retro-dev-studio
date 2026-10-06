//! Tests do contrato `rex-kosinski-chain/v1`: gardafíos estruturais herdadas
//! de `rex-corpus-resource/v2` e roundtrip byte a byte.

use rex_chain::chain::{analizar_enderezo, analizar_hex_bytes, forma_sha256, Cadea};

const SHA_A: &str = "a00000000000000000000000000000000000000000000000000000000000000a";
const SHA_B: &str = "b00000000000000000000000000000000000000000000000000000000000000b";
const SHA_C: &str = "c00000000000000000000000000000000000000000000000000000000000000c";

fn base() -> Cadea {
    Cadea {
        imaxe_sha256: SHA_A.into(),
        mapper: "md-linear".into(),
        estado_mapper: "rom_size=0x100000".into(),
        carga_sitio: 0x01364,
        carga_bytes: vec![0x41, 0xF9, 0x00, 0x03, 0xF0, 0x9A],
        carga_forma: "lea.l/A0".into(),
        carga_operando: 0x03F09A,
        destino_sitio: None,
        destino_bytes: None,
        destino_forma: None,
        destino_operando: None,
        destino_rexion: None,
        chamada_sitio: None,
        chamada_bytes: None,
        chamada_forma: None,
        chamada_alvo: None,
        rutina_sitio: None,
        rutina_lonxitude: None,
        rutina_sha256: None,
        fluxo_cpu: 0x03F09A,
        fluxo_offset: 0x3F09A,
        tramo_entrada: 273375,
        bytes_consumidos: 8453,
        saida_bytes: 41984,
        saida_sha256: SHA_B.into(),
        codec: "kosinski".into(),
        variante: "base-non-modular".into(),
        limite_max_saida: 65536,
        limite_orzamento: 1_048_576,
        confianza: "referencia-estatica".into(),
        limitacions: vec!["sen-execucion".into()],
        orixe: vec!["carga_sitio=declarado-probado".into()],
    }
}

#[test]
fn referencia_estatica_valida() {
    assert_eq!(base().validar(), Ok(()));
}

#[test]
fn referencia_estatica_con_chamada_miente_por_defecto() {
    let mut c = base();
    c.chamada_sitio = Some(0x1370);
    // incompleto primeiro: sitio sen bytes+forma+alvo
    assert!(c.validar().is_err());
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x05, 0x2A]);
    c.chamada_forma = Some("bsr.w".into());
    c.chamada_alvo = Some(0x189C);
    // completo, pero a confianza xa non corresponde á medida
    assert_eq!(
        c.validar(),
        Err(
            "confianza `referencia-estatica` con chamada medida: a cadea miente por defecto".into()
        )
    );
}

#[test]
fn vinculo_esixe_chamada_rutina_e_fluxo_coherente() {
    let mut c = base();
    c.confianza = "vinculo-estrutural".into();
    assert!(c.validar().is_err()); // sen chamada nin rutina
    c.chamada_sitio = Some(0x1370);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x05, 0x2A]);
    c.chamada_forma = Some("bsr.w".into());
    c.chamada_alvo = Some(0x189C);
    assert!(c.validar().is_err()); // chamada sen rutina
    c.rutina_sitio = Some(0x189C);
    c.rutina_lonxitude = Some(160);
    c.rutina_sha256 = Some(SHA_C.into());
    assert_eq!(c.validar(), Ok(()));
    // operando da carga que non é o fluxo da cadea: vínculo roto
    c.fluxo_cpu = 0x040000;
    assert!(c.validar().is_err());
}

#[test]
fn observado_en_runtime_non_se_pode_escribir_aqui() {
    let mut c = base();
    c.confianza = "observado-en-runtime".into();
    assert!(c.validar().unwrap_err().contains("non executa"));
    c.confianza = "nada-do-vocabulario".into();
    assert!(c.validar().unwrap_err().contains("descoñecida"));
}

#[test]
fn formas_de_hex_e_sha() {
    assert!(forma_sha256(SHA_A));
    assert!(!forma_sha256(&SHA_A.to_uppercase())); // SHA publicado en minúsculas
    assert!(!forma_sha256("abc"));
    assert_eq!(analizar_enderezo("0x03F09A"), Some(0x03F09A));
    assert_eq!(analizar_enderezo("0x03f09a"), None); // maiúsculas obrigadas
    assert_eq!(analizar_enderezo("3F09A"), None); // con 0x
    assert_eq!(analizar_enderezo("0x1_0000_00"), None); // fóra de 24 bits con underscores
    assert_eq!(analizar_hex_bytes("41F9"), Some(vec![0x41, 0xF9]));
    assert_eq!(analizar_hex_bytes("41F"), None); // lonxitude impar
    assert_eq!(analizar_hex_bytes(""), None);
}

#[test]
fn roundtrip_to_json_desde_json_estable() {
    let c = base();
    let texto = c.to_json();
    let de_volta = Cadea::desde_json(&texto).expect("roundtrip");
    assert_eq!(de_volta, c);
    // dous coñecidos mesmos valores → mesmos bytes (property do pin por hash)
    assert_eq!(texto, c.to_json());
}

#[test]
fn campo_descoñecido_rexeitado() {
    let texto = base().to_json();
    let mut injectado = texto.clone();
    // inxecta antes do peche: as claves extra podían contradicir as fixas
    injectado.pop();
    injectado.push_str(r#","inventado":"si"}"#);
    assert!(Cadea::desde_json(&injectado)
        .unwrap_err()
        .contains("descoñecido"));
}

#[test]
fn esquema_eixo_rexeitado() {
    assert!(Cadea::desde_json(r#"{"schema_version":"outra"}"#)
        .unwrap_err()
        .contains("esquema incorrecto"));
    assert!(Cadea::desde_json("{}").unwrap_err().contains("sen-esquema"));
}

#[test]
fn elos_de_destino_incompletos_rexeitados() {
    let mut c = base();
    c.destino_sitio = Some(0x3082); // sitio sen bytes/forma/operando/rexion
    assert!(c.validar().unwrap_err().contains("destino"));
}
