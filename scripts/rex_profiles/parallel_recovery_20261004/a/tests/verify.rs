//! Tests discriminantes do motor de revalidación sobre unha **imaxe
//! sintética autoral** (ningún byte comercial no repositorio).
//!
//! A imaxe contén a estrutura medida: `lea.abs.l fluxo,A0` → `bsr.w rutina`,
//! fluxo Kosinski de 16 literais + terminator, e rutina de 8 bytes. Cada
//! test negativo altera UN aspecto (bytes, alvo, SHA, xeometría) e exixe o
//! código de saída concreto: un test que pasa por vacuo non discriminada.

use rex_chain::chain::{hex_maíus, Cadea};
use rex_chain::verify::{codigo, revalidar, Estado};

// md-linear esixe rom_size potencia de 2 en [0x10000, 4 MiB]: imaxe de 64 KiB.
const ROM_SIZE: u32 = 0x1_0000;

fn imaxe_base() -> Vec<u8> {
    let mut v = vec![0u8; ROM_SIZE as usize];
    // 0x0100: lea.abs.l $000200,A0
    v[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x02, 0x00]);
    // 0x0108: bsr.w $0600  → alvo = 0x108 + 2 + 0x4F6 = 0x600
    v[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xF6]);
    // 0x0110: lea.abs.l $A00000,A1 (destino coñecido: ventaná VRAM/IO)
    v[0x110..0x116].copy_from_slice(&[0x43, 0xF9, 0x00, 0xA0, 0x00, 0x00]);
    // 0x0200: fluxo Kosinski: D0=FFFF (16 literais), early fetch de D1=0002
    // (`0,1` separado), 16º literal, Low=00 High=00 c=00 → terminator.
    let fluxo: [u8; 23] = [
        0xFF, 0xFF, // D0
        b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A',
        b'A', // literais 1..15
        0x02, 0x00, // D1 (early fetch antes do literal 16)
        b'A', // literal 16
        0x00, 0x00, 0x00, // Low, High (Count3=0), c=0 → terminator
    ];
    v[0x200..0x200 + fluxo.len()].copy_from_slice(&fluxo);
    // 0x0600: rutina de 8 bytes.
    v[0x600..0x608].copy_from_slice(&[0x70, 0x00, 0x4E, 0x75, 0x30, 0x3C, 0x00, 0x04]);
    v
}

fn sha(d: &[u8]) -> String {
    rex_kosinski::edit::sha256_hex(d)
}

/// Cadea baseline completa, construída **desde a imaxe medida**, como faría
/// `construir-cadea`; os valores esperados son o que a ferramenta mide.
fn cadea_ok(imaxe: &[u8]) -> Cadea {
    let off_fluxo = 0x200usize;
    let entrada = &imaxe[off_fluxo..];
    let d = rex_kosinski::decode(entrada, 4096, 65536).expect("fluxo sintético válido");
    Cadea {
        imaxe_sha256: sha(imaxe),
        mapper: "md-linear".into(),
        estado_mapper: "rom_size=0x010000".into(),
        carga_sitio: 0x0100,
        carga_bytes: vec![0x41, 0xF9, 0x00, 0x00, 0x02, 0x00],
        carga_forma: "lea.l/A0".into(),
        carga_operando: 0x000200,
        destino_sitio: Some(0x0110),
        destino_bytes: Some(vec![0x43, 0xF9, 0x00, 0xA0, 0x00, 0x00]),
        destino_forma: Some("lea.l/A1".into()),
        destino_operando: Some(0xA00000),
        destino_rexion: Some("io/vram-window".into()),
        chamada_sitio: Some(0x0108),
        chamada_bytes: Some(vec![0x61, 0x00, 0x04, 0xF6]),
        chamada_forma: Some("bsr.w".into()),
        chamada_alvo: Some(0x0600),
        rutina_sitio: Some(0x0600),
        rutina_lonxitude: Some(8),
        rutina_sha256: Some(sha(&imaxe[0x600..0x608])),
        fluxo_cpu: 0x000200,
        fluxo_offset: 0x200,
        tramo_entrada: (imaxe.len() - off_fluxo) as u64,
        bytes_consumidos: d.bytes_consumed as u64,
        saida_bytes: d.output.len() as u64,
        saida_sha256: sha(&d.output),
        codec: "kosinski".into(),
        variante: "base-non-modular".into(),
        limite_max_saida: 4096,
        limite_orzamento: 65536,
        confianza: "vinculo-estrutural".into(),
        limitacions: vec!["proba-sintetica".into()],
        orixe: vec!["carga_sitio=declarado-probado".into()],
    }
}

fn revalida(imaxe: &[u8], c: &Cadea) -> (i32, Vec<(String, Estado)>) {
    let r = revalidar(imaxe, c, 16);
    (
        r.codigo,
        r.elos
            .iter()
            .map(|e| (e.nome.to_string(), e.estado))
            .collect(),
    )
}

#[test]
fn cadea_completa_revalida_en_zero() {
    let imaxe = imaxe_base();
    let c = cadea_ok(&imaxe);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::OK, "{elos:?}");
    for nome in [
        "esquema",
        "identidade",
        "mapper",
        "sitio-carga",
        "argumento-fonte",
        "sitio-destino",
        "rexion-destino",
        "sitio-chamada",
        "alvo-chamada",
        "xeometria",
        "rutina",
        "saída",
    ] {
        assert!(
            elos.iter().any(|(n, e)| n == nome && *e == Estado::Pass),
            "elo {nome} non pasou: {elos:?}"
        );
    }
}

#[test]
fn bytes_alterados_no_sitio_de_carga() {
    let mut imaxe = imaxe_base();
    imaxe[0x101] = 0xFA; // 41 F9 → 41 FA: cambia a forma
    let c = cadea_ok(&imaxe_base());
    // a identidade tamén cambia: pródase antes do sitio — probamos con sha actualizado
    let mut c2 = c;
    c2.imaxe_sha256 = sha(&imaxe);
    let (cod, elos) = revalida(&imaxe, &c2);
    assert_eq!(cod, codigo::SITIO_DIVERXENCIA, "{elos:?}");
}

#[test]
fn imaxe_equivocada_rexeitada_por_identidade() {
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.imaxe_sha256 = "0".repeat(64); // outra ROM: o pin non encaza
    let (cod, _) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ROM_DIVERXENCIA);
}

#[test]
fn argumento_fonte_diferente() {
    // Os bytes da imaxe seguen intactos: a cadea afirma un operando $000300
    // que a instrución medida non declara → elo argumento-fonte falla.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.carga_operando = 0x000300;
    c.fluxo_cpu = 0x000300;
    c.fluxo_offset = 0x300;
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ARGUMENTO_DIVERXENTE, "{elos:?}");
}

#[test]
fn alvo_de_chamada_alterado() {
    // Bytes reais do bsr sen cambiar: a cadea afirma un alvo $0700 que a
    // aritmética do contrato (sitio+2+d16) non produce.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.chamada_alvo = Some(0x0700);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ALVO_DIVERXENTE, "{elos:?}");
}

#[test]
fn rutina_bytes_diferentes() {
    let mut imaxe = imaxe_base();
    imaxe[0x602] ^= 0xFF; // rutina distinta no mesmo alvo
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    let (cod, _) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ROTINA_DIVERXENCIA);
}

#[test]
fn fluxo_truncado_inconclusivo_non_ok() {
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    // recortamos o tramo a 20 bytes: falta Low/High/c do terminator →
    // Truncated. O contrato di INCONCLUSIVE: unha cadea truncada non se
    // presenta como OK nin se infla.
    c.tramo_entrada = 20;
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::INCONCLUSIVE_TRUNCADA, "{elos:?}");
    assert!(elos
        .iter()
        .any(|(n, e)| n == "saída" && *e == Estado::Inconclusive));
}

#[test]
fn saida_diferente_rexeitada() {
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.saida_sha256 = sha("outra saida".as_bytes());
    let (cod, _) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::SAIDA_DIVERXENTE);
}

#[test]
fn chamada_fora_de_ventana_xeometria() {
    let mut imaxe = imaxe_base();
    // movemos o bsr a 0x140: fin de carga 0x106, distancia 0x3A > ventá 16.
    // disp = 0x600 − (0x140+2) = 0x4BE → bytes 61 00 04 BE.
    imaxe[0x108..0x10C].copy_from_slice(&[0x00, 0x00, 0x00, 0x00]);
    imaxe[0x140..0x144].copy_from_slice(&[0x61, 0x00, 0x04, 0xBE]);
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_sitio = Some(0x140);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x04, 0xBE]);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::XEOMETRIA_DIVERXENTE, "{elos:?}");
}

#[test]
fn opcode_falso_en_datos_non_revalida() {
    // Bytes DENTRO do fluxo (sitio impar 0x0201: datos, non código). A cadea
    // afirma os bytes reais aí, pero ningunha forma do subconxunto os
    // decodifica → SITIO_DIVERXENCIA. Unha secuencia atopada en datos
    // NON é código alcanzable.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.carga_sitio = 0x0201;
    c.carga_bytes = imaxe[0x201..0x207].to_vec();
    c.chamada_sitio = None;
    c.chamada_bytes = None;
    c.chamada_forma = None;
    c.chamada_alvo = None;
    c.rutina_sitio = None;
    c.rutina_lonxitude = None;
    c.rutina_sha256 = None;
    c.destino_sitio = None;
    c.destino_bytes = None;
    c.destino_forma = None;
    c.destino_operando = None;
    c.destino_rexion = None;
    c.confianza = "referencia-estatica".into();
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::SITIO_DIVERXENCIA, "{elos:?}");
}

#[test]
fn mapper_erroneo_detectado() {
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    // rom_size=0x200: o fluxo $000200 queda fóra do backing ROM — un mapper
    // incorrecto non se «clapa» nin se recoloca: falla o elo mapper.
    c.estado_mapper = "rom_size=0x000200".into();
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::MAPPER_DIVERXENCIA, "{elos:?}");
}

#[test]
fn imaxe_maior_que_rom_size_rexeitada() {
    // Caso §6 (rom_size=0x80000 sobre Sonic de 531 577 B): o rom_size é
    // válido e ningún enderezo da cadea o supera — o único elo que pode
    // detectar o perfil incorrecto é a dimensión da imaxe vs backing.
    let mut imaxe = imaxe_base();
    imaxe.resize(128 * 1024, 0);
    let c = cadea_ok(&imaxe); // estado herdado: rom_size=0x10000 < 128 KiB
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::MAPPER_DIVERXENCIA, "{elos:?}");
    assert!(elos
        .iter()
        .any(|(n, e)| n == "mapper" && *e == Estado::Fail));
}

#[test]
fn esquema_incoherente_rexeitado_antes_de_medir() {
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    // referencia-estatica non pode levar chamada medida (gardafío herdado v2)
    c.confianza = "referencia-estatica".into();
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ESQUEMA, "{elos:?}");
}

#[test]
fn hex_bytes_forma_estable() {
    assert_eq!(hex_maíus(&[0x41, 0x0F, 0xF9]), "410FF9");
}
