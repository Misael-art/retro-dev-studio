//! Controles de adulteración dos pasos 7–9 (misión: *"adulterem opcode,
//! extensión, sítio, destino, identidade e vínculo da chamada, demonstrando
//! a rejeição"*). Expectativas conxeladas en
//! `docs/rex_profiles/parallel_recovery_20261004/a/CONTROLES-ADULTERACION-A.md`
//! (HEAD do conxelado `95137ce`) antes de implementar: as clases K4–K9 pinnan
//! rexeitamentos que xa existían; **K10 expón o defecto do vínculo**
//! (chamada→rutina sen coherencia co alvo calculado) e escribe o rc=7 que a
//! corrección debe producir.
//!
//! Harness propia e autoral (imaxe sintética de 64 KiB, ningún byte
//! comercial); duplica deliberadamente a de `tests/verify.rs` para que cada
//! ficheiro de tests sexa lexible sen ir procurar helpers alleos.

use rex_chain::chain::Cadea;
use rex_chain::verify::{codigo, revalidar, Estado};

const ROM_SIZE: u32 = 0x1_0000;

fn imaxe_base() -> Vec<u8> {
    let mut v = vec![0u8; ROM_SIZE as usize];
    // 0x0100: lea.abs.l $000200,A0
    v[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x02, 0x00]);
    // 0x0108: bsr.w $0600
    v[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xF6]);
    // 0x0110: lea.abs.l $A00000,A1 (ventaná VRAM/IO)
    v[0x110..0x116].copy_from_slice(&[0x43, 0xF9, 0x00, 0xA0, 0x00, 0x00]);
    // 0x0200: fluxo Kosinski: 16 literais + terminator (ver tests/verify.rs).
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

/// Cadea baseline medida desde `imaxe` (como faría `construir-cadea`).
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

fn revalida(imaxe: &[u8], c: &Cadea) -> (i32, Vec<(String, Estado, String)>) {
    let r = revalidar(imaxe, c, 16);
    (
        r.codigo,
        r.elos
            .iter()
            .map(|e| (e.nome.to_string(), e.estado, e.detalle.clone()))
            .collect(),
    )
}

fn elo_fallo<'a>(elos: &'a [(String, Estado, String)], nome: &str) -> &'a (String, Estado, String) {
    elos.iter()
        .find(|(n, e, _)| n == nome && *e == Estado::Fail)
        .unwrap_or_else(|| panic!("sen elo {nome} en FAIL: {elos:?}"))
}

// ------------------------------------------------------------------- K4: opcode

#[test]
fn k4_opcode_bra_w_no_sitio_da_chamada_rexeitado() {
    // Bra.w (`60 00 04 F6`) no sitio do bsr.w real, declarado cos seus bytes
    // exactos: os bytes ENCAZAN pero a gramática conxelada recúusa — un
    // opcode de salto condicionado non é chamada. rc=5, motivo estable.
    let base = imaxe_base();
    let mut imaxe = base.clone();
    imaxe[0x108..0x10C].copy_from_slice(&[0x60, 0x00, 0x04, 0xF6]);
    let mut c = cadea_ok(&base);
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_bytes = Some(vec![0x60, 0x00, 0x04, 0xF6]);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::SITIO_DIVERXENCIA, "{elos:?}");
    let (_, _, detalle) = elo_fallo(&elos, "sitio-chamada");
    assert!(
        detalle.contains("fora-de-subconxunto"),
        "motivo inestable sen `fora-de-subconxunto`: {detalle}"
    );
}

// -------------------------------------------------------------- K5: forma mentira

#[test]
fn k5_forma_de_chamada_mentiresa_rexeitada() {
    // Bytes reais intactos; a cadea declara `jmp.l` onde a imaxe mede `bsr.w`.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.chamada_forma = Some("jmp.l".into());
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ALVO_DIVERXENTE, "{elos:?}");
    elo_fallo(&elos, "forma-chamada");
}

// ------------------------------------------------------- K6: recusa 61 FF co seu motivo

#[test]
fn k6_bsr_l_61ff_rexeitado_con_motivo_estable() {
    // BSR.L (familia 68020+) declarado cos bytes exactos da imaxe: a gramática
    // recúusao explicitamente e o motivo `68020-non-declarado` debe ser
    // visible no resultado estruturado (paso 8: motivos estables de recusa).
    let base = imaxe_base();
    let mut imaxe = base.clone();
    imaxe[0x108..0x10E].copy_from_slice(&[0x61, 0xFF, 0x00, 0x00, 0x12, 0x34]);
    let mut c = cadea_ok(&base);
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_bytes = Some(vec![0x61, 0xFF, 0x00, 0x00, 0x12, 0x34]);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::SITIO_DIVERXENCIA, "{elos:?}");
    let (_, _, detalle) = elo_fallo(&elos, "sitio-chamada");
    assert!(
        detalle.contains("68020-non-declarado"),
        "motivo inestable sen `68020-non-declarado`: {detalle}"
    );
}

// ------------------------------------------------------------------ K7: destino bytes

#[test]
fn k7_bytes_de_destino_alterados_rexeitados() {
    // Imaxe intacta; `destino_bytes` declarados cun bit trocado no último
    // byte: o pin de bytes do destino falla antes de decodificar.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.destino_bytes = Some(vec![0x43, 0xF9, 0x00, 0xA0, 0x00, 0x01]);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::SITIO_DIVERXENCIA, "{elos:?}");
    let elo = elo_fallo(&elos, "sitio-destino");
    // non é fallo vago: o detalle enfronta imaxe vs cadea en hex estábel
    assert!(elo.2.contains("43F900A00000"), "{:?}", elo.2);
}

// --------------------------------------------------------- K8: destino operando mentira

#[test]
fn k8_operando_de_destino_alterado_rexeitado() {
    // Bytes e forma reais; a cadea afirma destino 0xA00004 cando a instrución
    // mide 0xA00000 — adulteración da *extensión/argumento* do destino.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.destino_operando = Some(0xA00004);
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ARGUMENTO_DIVERXENTE, "{elos:?}");
    elo_fallo(&elos, "argumento-destino");
}

// ---------------------------------------------------------- K9: destino rexión mentira

#[test]
fn k9_rexion_de_destino_mentiresa_rexeitada() {
    // Todo o destino real, pero a cadea clasifica a ventaná A00000 como `rom`:
    // mentira de clase de memoria, detectada polo bus de 24 bits.
    let imaxe = imaxe_base();
    let mut c = cadea_ok(&imaxe);
    c.destino_rexion = Some("rom".into());
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::REXION_DIVERXENTE, "{elos:?}");
    elo_fallo(&elos, "rexion-destino");
}

// ------------------------------------------------------------- K10: vínculo da chamada

#[test]
fn k10_vinculo_chamada_rutina_incoherente_rexeitado() {
    // Adulteración coherente do vínculo: o `bsr.w` da IMAXE repóntase a 0x5F0
    // (`61 00 04 E6`: 0x108+2+0x4E6=0x5F0) e a cadea declara bytes+alvo
    // coherentes con esa imaxe; a rutina afirmada queda en 0x600 co seu hash
    // real. Todos os elos iso-lados pasan — só o vínculo chamada→rutina pode
    // rexeitala. Conxelado en 95137ce como rc=7; no código actual (sen o elo
    // `vinculo-chamada-rutina`) obtense rc=0: o defecto que a corrección
    // pecha, declarado en CONTROLES-ADULTERACION-A §2/§4.
    let base = imaxe_base();
    let mut imaxe = base.clone();
    imaxe[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xE6]);
    let mut c = cadea_ok(&base);
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x04, 0xE6]);
    c.chamada_alvo = Some(0x05F0);
    // rutina_sitio/rutina_sha256 seguen sendo 0x600 e o hash real deses bytes
    // (a imaxe non cambiou ali).
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ALVO_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "vinculo-chamada-rutina");
    // o fallo debe nomear as tres magnitudes: calculado, bus e rutina afirmada
    assert!(elo.2.contains("0x0005F0"), "{:?}", elo.2);
    assert!(elo.2.contains("0x000600"), "{:?}", elo.2);
    // e nada antes fallou: sitio-chamada e alvo-chamada pasan (non é K4/K11)
    assert!(
        elos.iter()
            .any(|(n, e, _)| n == "sitio-chamada" && *e == Estado::Pass),
        "{elos:?}"
    );
    assert!(
        elos.iter()
            .any(|(n, e, _)| n == "alvo-chamada" && *e == Estado::Pass),
        "{elos:?}"
    );
}

#[test]
fn k10b_coherencia_total_sigue_validando() {
    // Control positivo do vínculo: repointar a chamada E a rutina xuntas
    // (rutina hashada no novo alvo, bytes reais ali) debe seguir en rc=0.
    // Demostra que K10 rexeita o VÍNCULO roto, non o desprazamento en si.
    let base = imaxe_base();
    let mut imaxe = base.clone();
    // rutina desprazada: copia os 8 bytes de 0x600 a 0x5F0 e repointa o bsr
    let rutina = imaxe[0x600..0x608].to_vec();
    imaxe[0x5F0..0x5F8].copy_from_slice(&rutina);
    imaxe[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xE6]);
    let mut c = cadea_ok(&base);
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x04, 0xE6]);
    c.chamada_alvo = Some(0x05F0);
    c.rutina_sitio = Some(0x05F0);
    c.rutina_sha256 = Some(sha(&imaxe[0x5F0..0x5F8]));
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::OK, "{elos:?}");
}
