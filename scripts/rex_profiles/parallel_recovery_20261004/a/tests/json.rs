//! Tests do parser JSON plano: todo o que non coñece rexeítase, nada se
//! estima. Un lector que "arregla" evidencia malformada é peor que ningún.

use rex_chain::json::{interpretar, render, Valor};

fn v(v: Valor) -> Valor {
    v
}

#[test]
fn obxecto_plano_aceitado() {
    let campos = interpretar(r#"{"a":"b","n":7,"l":["x","y"],"z":null}"#).unwrap();
    assert_eq!(campos.len(), 4);
    assert_eq!(campos[0], ("a".to_string(), v(Valor::Str("b".into()))));
    assert_eq!(campos[1], ("n".to_string(), v(Valor::Int(7))));
    match &campos[2].1 {
        Valor::Lista(l) => assert_eq!(l, &vec!["x".to_string(), "y".to_string()]),
        outra => panic!("esperaba lista, {outra:?}"),
    }
    assert_eq!(campos[3].1, Valor::Null);
}

#[test]
fn clave_duplicada_rexeitada() {
    let m = interpretar(r#"{"a":"x","a":"y"}"#).unwrap_err();
    assert_eq!(m.codigo, "ESQUEMA");
    assert!(m.detalle.contains("duplicada"));
}

#[test]
fn anidamento_rexeitado() {
    // un obxecto interior podería agochar estado: o contrato plano non o admite
    assert!(interpretar(r#"{"a":{"b":"c"}}"#).is_err());
    // listas con números tampouco (só cadeas)
    assert!(interpretar(r#"{"a":[1,2]}"#).is_err());
}

#[test]
fn texto_sobrante_rexeitado() {
    assert!(interpretar(r#"{"a":"x"} {"b":"y"}"#).is_err());
    assert!(interpretar(r#"{ "a":"x" , }"#).is_err());
}

#[test]
fn unicode_escape_rexeitado() {
    // os campos do contrato son ASCII: \u abriría a porta a homoglyphs
    assert!(interpretar(r#"{"a":"A"}"#).is_ok());
    assert!(interpretar("{\"a\":\"\\u0041\"}").is_err());
}

#[test]
fn enteiro_desbordado_rexeitado() {
    let big = "9".repeat(30);
    let texto = format!("{{\"n\":{big}}}");
    assert!(interpretar(&texto).is_err());
    // signo e decimal non admitidos: os límites do contrato son decimais sans
    assert!(interpretar(r#"{"n":-4}"#).is_err());
    assert!(interpretar(r#"{"n":2.0}"#).is_err());
}

#[test]
fn render_orden_fixo_e_roundtrip() {
    let campos = vec![
        ("b".to_string(), Valor::Str("2".into())),
        ("a".to_string(), Valor::Int(1)),
        ("l".to_string(), Valor::Lista(vec!["x".into(), "y".into()])),
        ("n".to_string(), Valor::Null),
    ];
    let texto = render(&campos);
    assert_eq!(texto, r#"{"b":"2","a":1,"l":["x","y"],"n":null}"#);
    let de_volta = interpretar(&texto).unwrap();
    assert_eq!(de_volta, campos);
}

#[test]
fn render_escape_minimo() {
    let campos = vec![("k".to_string(), Valor::Str("a\"b\\c".into()))];
    let texto = render(&campos);
    assert_eq!(texto, r#"{"k":"a\"b\\c"}"#);
    assert_eq!(interpretar(&texto).unwrap(), campos);
}
