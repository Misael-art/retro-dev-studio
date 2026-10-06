//! Misión 3 (2026-10-05): controles conxelados en
//! `docs/rex_profiles/parallel_recovery_20261004/a/RESPOSTA-D-A.md` §4/§5/§6
//! (HEAD do conxelado `6a123e1`) **antes** de medir.
//!
//! * K12a/K12b/K13a/K13b — TA-3/TA-5 son **prioridade de validación**, non
//!   defecto de detección: pinnan a rc exacta e a serie de elos. Deben ser
//!   verdes no HEAD actual (a redea non cambia o motor `revalidar`).
//! * K14/K15 — un rexistro «estilo v1» non pode gañar confianza estrutural
//!   sen revalidación (paso 3): a medición v1.1 rexeita polo seu propio peso.
//! * K16–K19 — as **gardas do tramo** (paso 6): chamada tras `bra`/`rts`,
//!   rexistro-fonte sobrescrito, dous candidatos no recto, e emparellamento
//!   declarado por `--chamada-sitio`. Estas **falvan no HEAD conxelado**:
//!   `buscar_chamada` aínda toma o primeiro candidato da ventá (o defecto
//!   que D expuxo en KA1-bsr.l).
//!
//! Harness sintética autoral propia (imaxe de 64 KiB creada aqui; ningún
//! byte comercial). Ningún test copia a implementación: cada un falla se a
//! garda correspondente se relaxa.

use rex_chain::chain::Cadea;
use rex_chain::verify::{codigo, revalidar, Estado};
use std::path::Path;
use std::process::{Command, Output};

const ROM_SIZE: u32 = 0x1_0000;

fn imaxe_base() -> Vec<u8> {
    let mut v = vec![0u8; ROM_SIZE as usize];
    // 0x0100: lea.abs.l $200,A0 (carga declarada)
    v[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x02, 0x00]);
    // 0x0108: bsr.w $600
    v[0x108..0x10C].copy_from_slice(&[0x61, 0x00, 0x04, 0xF6]);
    // 0x0110: lea.abs.l $A00000,A1
    v[0x110..0x116].copy_from_slice(&[0x43, 0xF9, 0x00, 0xA0, 0x00, 0x00]);
    let fluxo: [u8; 23] = [
        0xFF, 0xFF, b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A',
        b'A', b'A', 0x02, 0x00, b'A', 0x00, 0x00, 0x00,
    ];
    v[0x200..0x200 + fluxo.len()].copy_from_slice(&fluxo);
    // 0x0600: rutina de 8 bytes.
    v[0x600..0x608].copy_from_slice(&[0x70, 0x00, 0x4E, 0x75, 0x30, 0x3C, 0x00, 0x04]);
    // 0x0700: rutina alternativa de 8 bytes (para K12).
    v[0x700..0x708].copy_from_slice(&[0x30, 0x3C, 0x00, 0x08, 0x4E, 0x75, 0x70, 0x00]);
    v
}

fn sha(d: &[u8]) -> String {
    rex_kosinski::edit::sha256_hex(d)
}

/// Cadea baseline medida desde `imaxe_base()` (a parella boa de sempre).
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

fn hai_pass(elos: &[(String, Estado, String)], nome: &str) -> bool {
    elos.iter().any(|(n, e, _)| n == nome && *e == Estado::Pass)
}

// ---------------------------------------------------------------- K12a: xeometría

#[test]
fn k12a_chamada_fora_da_ventana_con_vinculo_coherente_da_rc11() {
    // RESPOSTA-D-A §4 K12a: chamada lexítima en 0x218 (bsr.w → 0x700),
    // rutina == alvo calculado, todo lo demais coherente. Só o estra
    // estra a xeometría → rc 11 `XEOMETRIA`: o elo de xeometría segue
    // existindo (a fila TA-3 de D non perde detección, gaña en prioridade).
    let mut imaxe = imaxe_base();
    imaxe[0x218..0x21C].copy_from_slice(&[0x61, 0x00, 0x04, 0xE6]); // bsr.w → 0x700
    let mut c = cadea_ok(&imaxe);
    c.chamada_sitio = Some(0x0218);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x04, 0xE6]); // 0x218+2+0x4E6 = 0x700
    c.chamada_forma = Some("bsr.w".into());
    c.chamada_alvo = Some(0x0700);
    c.rutina_sitio = Some(0x0700);
    c.rutina_sha256 = Some(sha(&imaxe[0x700..0x708]));
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::XEOMETRIA_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "xeometria");
    assert!(
        elo.2.contains("0x000218") && elo.2.contains("ventána 16"),
        "detalle inestable: {}",
        elo.2
    );
    // o vínculo chamada→rutina PASA aqui (a diferenza con K12b): rc 11 e
    // non rc 7 porque o único estra é a xeometría.
    assert!(hai_pass(&elos, "vinculo-chamada-rutina"), "{elos:?}");
}

// ------------------------------------------------------- K12b: fila TA-3 de D

#[test]
fn k12b_ta3_reproducido_o_vinculo_gana_a_xeometria_rc7() {
    // RESPOSTA-D-A §4 K12b = fila TA-3: chamada fóra da ventá **e**
    // `rutina_sitio ≠ alvo`. Ambos os defectos son reais; o elo de vínculo
    // execútase antes do de xeometría → rc 7, e a xeometría nin se evalúa.
    // Demuestra que a diverxencia con D é prioridade de validación.
    let mut imaxe = imaxe_base();
    imaxe[0x218..0x21C].copy_from_slice(&[0x61, 0x00, 0x04, 0xE6]); // bsr.w → 0x700
    let mut c = cadea_ok(&imaxe);
    c.chamada_sitio = Some(0x0218);
    c.chamada_bytes = Some(vec![0x61, 0x00, 0x04, 0xE6]);
    c.chamada_forma = Some("bsr.w".into());
    c.chamada_alvo = Some(0x0700);
    c.rutina_sitio = Some(0x0900); // ≠ alvo calculado 0x700
    c.rutina_sha256 = Some(sha(&imaxe[0x900..0x908]));
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ALVO_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "vinculo-chamada-rutina");
    // o detalle nomea as tres magnitudes (calculado, bus, rutina afirmada)
    assert!(elo.2.contains("0x000700"), "{:?}", elo.2);
    assert!(elo.2.contains("0x000900"), "{:?}", elo.2);
    // elos previos PASS: sitio-chamada, forma, aritmética e alvo meden ben
    for nome in ["sitio-chamada", "alvo-chamada"] {
        assert!(hai_pass(&elos, nome), "elo {nome} debe pasar: {elos:?}");
    }
    // e a xeometría queda sen avaliar: o seu motivo **non** aparece na serie
    assert!(
        !elos.iter().any(|(n, _, _)| n == "xeometria"),
        "rc7 debe atallar antes da xeometría: {elos:?}"
    );
}

// ------------------------------------------------------ K13a: fila TA-5 de D

#[test]
fn k13a_mutacion_solo_json_da_rc2_esquema_con_motivo() {
    // RESPOSTA-D-A §4 K13a = fila TA-5: rexistro cuxa declaración é
    // internamente incoherente (`carga_operando` ≠ `fluxo_cpu` en
    // vinculo-estrutural). O contrato rexeita **antes de medir nada** →
    // rc 2 ESQUEMA co motivo conxelado.
    let mut imaxe = imaxe_base();
    imaxe[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x80, 0x00]);
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    c.carga_bytes = vec![0x41, 0xF9, 0x00, 0x00, 0x80, 0x00];
    c.carga_operando = 0x008004; // mentira só no JSON: os bytes din 0x8000
    c.fluxo_cpu = 0x008000;
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ESQUEMA, "{elos:?}");
    let elo = elo_fallo(&elos, "esquema");
    assert!(
        elo.2.contains("o bus do operando da carga non e o fluxo"),
        "motivo conxelado ausente: {}",
        elo.2
    );
    // a serie para aqui: non se mide nin un opcode.
    assert_eq!(elos.len(), 1, "{elos:?}");
}

// ----------------------------------------------------- K13b: rc6 coherente

#[test]
fn k13b_mutacion_de_bytes_con_declaracion_coherente_da_rc6() {
    // RESPOSTA-D-A §4 K13b: a cadea é internamente coherente (declara
    // exactlyamente os bytes adulterados, `operando == fluxo` no bus), e só
    // a **imaxe** diverxe do que a gramática mide. rc 6 ARGUMENTO sigue
    // alcanzable — a recusa temperá de K13a non o substitúe.
    let mut imaxe = imaxe_base();
    imaxe[0x100..0x106].copy_from_slice(&[0x41, 0xF9, 0x00, 0x00, 0x80, 0x04]);
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    c.carga_bytes = vec![0x41, 0xF9, 0x00, 0x00, 0x80, 0x04];
    c.carga_operando = 0x000200; // afirmado coherente co fluxo real da cadea
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ARGUMENTO_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "argumento-fonte");
    assert!(elo.2.contains("medido=0x008004"), "{:?}", elo.2);
    assert!(elo.2.contains("cadea=0x000200"), "{:?}", elo.2);
    // A serie para no elo de medición: `sitio-carga` nin se rexistra (a
    // redea atalla no primeiro FAIL). O que importa: rc 6, non rc 2 — a
    // estrutura pasou e foi a **capa de medición** a que diverxe.
    assert_eq!(elos.len(), 4, "{elos:?}");
    assert!(hai_pass(&elos, "esquema"), "{elos:?}");
}

// ------------------------------------------- K14: rexistro «estilo v1» caducado

#[test]
fn k14_rexistro_v1_ceroextendido_rexeitado_pela_medicion_v11() {
    // RESPOSTA-D-A §3/§6: un rexistro creado baixo a táboa v1 (lea.w
    // cero-extendida: `43F89400` → operando `0x00009400`) NON pode gañar
    // confianza estrutural sen revalidación. A cadea é internamente
    // coherente (bytes+forma+operando estilo v1); é a medición v1.1
    // (extensión de sinal, PRM §2.2.16) a que a rexeita. rc ≠ 0.
    let mut imaxe = imaxe_base();
    // destino v1-era: lea.w/A1 con bytes 43 F8 94 00 no sitio 0x110.
    imaxe[0x110..0x114].copy_from_slice(&[0x43, 0xF8, 0x94, 0x00]);
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    c.destino_bytes = Some(vec![0x43, 0xF8, 0x94, 0x00]);
    c.destino_forma = Some("lea.w/A1".into());
    c.destino_operando = Some(0x0000_9400); // lectura v1: cero-extensión
    c.destino_rexion = Some("ram-68k-mirror".into());
    let (cod, elos) = revalida(&imaxe, &c);
    assert_ne!(cod, codigo::OK, "{elos:?}");
    assert_eq!(cod, codigo::ARGUMENTO_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "argumento-destino");
    // v1.1 mide 0xFFFF9400 (sign-extended); o rexistro v1 afirma 0x009400
    assert!(elo.2.contains("medido=0xFFFF9400"), "{:?}", elo.2);
    assert!(elo.2.contains("cadea=0x009400"), "{:?}", elo.2);
}

// ------------------------------------------- K15: rexistro «etiqueta v1» caducado

#[test]
fn k15_etiqueta_v1_jsr_w_sobre_4efafa_rexeitada() {
    // RESPOSTA-D-A §6 K15: un rexistro v1 que rotulaba `4E FA` como `jsr.w`.
    // A gramática v1.1 mide `jmp.pcd16` → rc 7 `forma-chamada` FAIL, con
    // todos os demais elos da chamada coherentes coa imaxe. Un rexistro
    // antigo non se promove porque os seus bytes «encaixan»: a etiqueta é
    // parte da medición.
    let mut imaxe = imaxe_base();
    // 0x108: jmp (d16,PC) → alvo 0x900 (4E FA 07 F6: 0x108+2+0x7F6=0x900)
    imaxe[0x108..0x10C].copy_from_slice(&[0x4E, 0xFA, 0x07, 0xF6]);
    let rutina = imaxe[0x600..0x608].to_vec();
    imaxe[0x900..0x908].copy_from_slice(&rutina);
    let mut c = cadea_ok(&imaxe_base());
    c.imaxe_sha256 = sha(&imaxe);
    c.chamada_bytes = Some(vec![0x4E, 0xFA, 0x07, 0xF6]);
    c.chamada_forma = Some("jsr.w".into()); // etiqueta v1, caducada
    c.chamada_alvo = Some(0x0900);
    c.rutina_sitio = Some(0x0900);
    c.rutina_sha256 = Some(sha(&imaxe[0x900..0x908]));
    let (cod, elos) = revalida(&imaxe, &c);
    assert_eq!(cod, codigo::ALVO_DIVERXENTE, "{elos:?}");
    let elo = elo_fallo(&elos, "forma-chamada");
    assert!(elo.2.contains("jmp.pcd16"), "{:?}", elo.2);
    assert!(elo.2.contains("jsr.w"), "{:?}", elo.2);
}

// ==================================================================== CLI
// K16–K19 exercitan as gardas do tramo na CLI real (construir-cadea /
// detectar). Están conxeladas como predicións en RESPOSTA-D-A §5/§6 e
// **falvan no HEAD `6a123e1`**: a serie vermelha queda rexistrada en §8.

fn dir_de_trallo(nome: &str) -> std::path::PathBuf {
    let d = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("segmento-{nome}"));
    std::fs::create_dir_all(&d).expect("tmpdir");
    d
}

fn rex_chain() -> Command {
    Command::new(env!("CARGO_BIN_EXE_rex-chain"))
}

fn escribir_imaxe(d: &Path, v: &[u8], nome: &str) -> std::path::PathBuf {
    let p = d.join(nome);
    std::fs::write(&p, v).expect("escribir imaxe");
    p
}

fn construir(imaxe: &Path, extra: &[&str]) -> (Output, String) {
    let mut args: Vec<&str> = vec![
        "construir-cadea",
        "--imaxe",
        imaxe.to_str().unwrap(),
        "--rom-size",
        "0x10000",
        "--carga-sitio",
        "0x0100",
        "--rutina-lonxitude",
        "8",
        "--limite-max-saida",
        "4096",
        "--limite-orzamento",
        "65536",
    ];
    args.extend_from_slice(extra);
    let out = rex_chain().args(&args).output().expect("rex-chain");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    (out, stdout)
}

fn cadea_desde_stdout(out: &Output, stdout: &str) -> Cadea {
    assert!(
        out.status.success(),
        "rc={:?} stderr={}",
        out.status.code(),
        String::from_utf8_lossy(&out.stderr)
    );
    let liñas: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(liñas.len(), 1, "esperábase un JSONL: {liñas:?}");
    Cadea::desde_json(liñas[0]).expect("JSONL parseábel")
}

#[test]
fn k16_chamada_tras_bra_non_se_emparella_segmento_roto() {
    // garda `roto-bra`: bra.w `60 00 FF FA` en 0x106 rompe o recto antes da
    // chamada en 0x10C. Predición RESPOSTA-D-A §5: sen candidatos no recto →
    // sen promover; `referencia-estatica` + limitación
    // `segmento-roto:roto-bra@0x0106`.
    let d = dir_de_trallo("k16");
    let mut imaxe = imaxe_base();
    imaxe[0x106..0x10A].copy_from_slice(&[0x60, 0x00, 0xFF, 0xFA]); // bra.w -6
    imaxe[0x10C..0x110].copy_from_slice(&[0x61, 0x00, 0x04, 0xF0]); // bsr.w → 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k16.bin");
    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica", "{:?}", c.confianza);
    assert_eq!(c.chamada_sitio, None, "non pode emparellar tras bra");
    assert!(
        c.limitacions
            .iter()
            .any(|l| l.starts_with("segmento-roto:roto-bra@0x0106")),
        "{:?}",
        c.limitacions
    );
}

#[test]
fn k16b_chamada_tras_rts_non_se_emparella() {
    // garda `roto-rts`: `4E 75` en 0x106 → mesma predición con motivo
    // `roto-rts`.
    let d = dir_de_trallo("k16b");
    let mut imaxe = imaxe_base();
    imaxe[0x106..0x108].copy_from_slice(&[0x4E, 0x75]); // rts
    imaxe[0x10C..0x110].copy_from_slice(&[0x61, 0x00, 0x04, 0xF0]); // bsr.w → 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k16b.bin");
    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica");
    assert_eq!(c.chamada_sitio, None);
    assert!(
        c.limitacions
            .iter()
            .any(|l| l.starts_with("segmento-roto:roto-rts@0x0106")),
        "{:?}",
        c.limitacions
    );
}

#[test]
fn k17_rexistro_fonte_sobrescrito_non_promove() {
    // garda `sobrescrito`: `43 F8 80 00` (lea.w/A1) non toca A0 → word
    // recoñecida de carga allea (avanza 4); `41 F8 00 00` (lea.w/A0) en
    // 0x10C escribe o rexistro da carga **antes** do candidato → o candidato
    // en 0x114 xa non está no recto.
    let d = dir_de_trallo("k17");
    let mut imaxe = imaxe_base();
    imaxe[0x108..0x10C].fill(0); // sen outros candidatos no recto
    imaxe[0x106..0x10A].copy_from_slice(&[0x43, 0xF8, 0x80, 0x00]); // lea.w/A1 (alleo)
    imaxe[0x10C..0x110].copy_from_slice(&[0x41, 0xF8, 0x00, 0x00]); // lea.w/A0 ← sobrescrita
    imaxe[0x114..0x118].copy_from_slice(&[0x61, 0x00, 0x04, 0xF8]); // bsr.w → 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k17.bin");
    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica");
    assert_eq!(c.chamada_sitio, None, "a chamada tras sobrescrita non vale");
    assert!(
        c.limitacions
            .iter()
            .any(|l| l.starts_with("segmento-roto:sobrescrito-A0@0x010C")),
        "{:?}",
        c.limitacions
    );
}

#[test]
fn k18_dous_candidatos_no_recto_ambigua_non_promove() {
    // garda de ambigüidade: `4E B9 …0600` (jsr.l → 0x600) en 0x106 e
    // `61 00 04 F2` (bsr.w: 0x10C+2+0x4F2 = 0x600) en 0x10C, dous
    // candidatos lexítimos no recto. Predición §5.4: construir queda
    // `referencia-estatica` con `ventana-ambigua:2-candidatos`; detectar
    // conta `ambiguas=1` e non emite esa cadea.
    let d = dir_de_trallo("k18");
    let mut imaxe = imaxe_base();
    imaxe[0x108..0x10C].fill(0); // retira o bsr.w base: dous candidatos, non tres
    imaxe[0x106..0x10C].copy_from_slice(&[0x4E, 0xB9, 0x00, 0x00, 0x06, 0x00]);
    imaxe[0x10C..0x110].copy_from_slice(&[0x61, 0x00, 0x04, 0xF2]); // bsr.w → 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k18.bin");

    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica");
    assert_eq!(c.chamada_sitio, None, "ambiguo non se promove");
    assert!(
        c.limitacions
            .iter()
            .any(|l| l == "ventana-ambigua:2-candidatos"),
        "{:?}",
        c.limitacions
    );

    let imaxe_arg = imaxe_p.to_str().unwrap().to_string();
    let out = rex_chain()
        .args([
            "detectar",
            "--imaxe",
            &imaxe_arg,
            "--rom-size",
            "0x10000",
            "--rutina-lonxitude",
            "8",
            "--limite-max-saida",
            "4096",
            "--limite-orzamento",
            "65536",
            "--max-cadeas",
            "1",
        ])
        .output()
        .expect("rex-chain detectar");
    assert!(out.status.success());
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    assert!(stderr.contains("ambiguas=1"), "{stderr}");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    assert!(
        !stdout.contains("0x000100") || !stdout.contains("vinculo-estrutural"),
        "detectar non debe emitir a cadea ambigua: {stdout}"
    );
}

#[test]
fn k19_chamada_declarada_promove_con_par_declarado() {
    // vía §5.6: o recto está roto (sobrescrito), pero o usuario declara
    // `--chamada-sitio 0x114`; a ferramenta proba bytes/aritmética/vínculo/
    // hash e promove con epistemoloxía separada (`par-declarado`, orixe
    // `chamada_sitio=declarado-probado`) — nunca `medido-heuristica-ventana`.
    let d = dir_de_trallo("k19");
    let mut imaxe = imaxe_base();
    imaxe[0x108..0x10C].fill(0); // sen outros candidatos no recto
    imaxe[0x106..0x10A].copy_from_slice(&[0x43, 0xF8, 0x80, 0x00]); // lea.w/A1
    imaxe[0x10C..0x110].copy_from_slice(&[0x41, 0xF8, 0x00, 0x00]); // lea.w/A0 sobrescribe
    imaxe[0x114..0x118].copy_from_slice(&[0x61, 0x00, 0x04, 0xF8]); // bsr.w → 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k19.bin");

    // control: sen declaración queda en referencia-estatica (K17).
    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica");

    // con declaración: promócese o par probado.
    let (out, stdout) = construir(&imaxe_p, &["--chamada-sitio", "0x0114"]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "vinculo-estrutural");
    assert_eq!(c.chamada_sitio, Some(0x0114));
    assert_eq!(c.chamada_alvo, Some(0x060E));
    assert_eq!(c.rutina_sitio, Some(0x060E));
    assert!(
        c.limitacions.iter().any(|l| l == "par-declarado"),
        "{:?}",
        c.limitacions
    );
    assert!(
        c.orixe
            .iter()
            .any(|o| o == "chamada_sitio=declarado-probado"),
        "{:?}",
        c.orixe
    );
    assert!(
        !c.orixe
            .iter()
            .any(|o| o.contains("medido-heuristica-ventana")),
        "un par declarado non pode levar a orixe do varredor: {:?}",
        c.orixe
    );
}

#[test]
fn k20_tramo_non_modelado_non_promove_e_a_declaracion_resolve() {
    // Límite conxelado §7.2: cando o recto contén palabras sen forma
    // modelada (aquí `2A 7C` movea.l #imm/A1 — lacuna §6.4 da revisión de
    // C — e zeros), un candidato único **non** se promove pola xanela: a
    // palabra probe podería caer dentro del. Con `--chamada-sitio` (§5.6)
    // o mesmo par promoese coa epistemoloxía declarada.
    let d = dir_de_trallo("k20");
    let mut imaxe = imaxe_base();
    imaxe[0x106..0x10A].copy_from_slice(&[0x2A, 0x7C, 0x00, 0xA0]); // movea.l (non modelada)
    imaxe[0x10A..0x10E].copy_from_slice(&[0x00, 0x00, 0x00, 0x00]);
    imaxe[0x10E..0x112].copy_from_slice(&[0x61, 0x00, 0x04, 0xF0]); // bsr.w: 0x110+0x4F0 = 0x600
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k20.bin");

    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "referencia-estatica", "{:?}", c.confianza);
    assert_eq!(
        c.chamada_sitio, None,
        "candidato único non modelado: non promove"
    );
    assert!(
        c.limitacions
            .iter()
            .any(|l| l.starts_with("tramo-non-modelado:")),
        "{:?}",
        c.limitacions
    );
    assert!(
        !c.limitacions
            .iter()
            .any(|l| l.starts_with("ventana-ambigua")),
        "un só candidato non é ambigüidade: {:?}",
        c.limitacions
    );

    // a única vía de promover este par: declaración explícita (§5.6/§7.2).
    let (out, stdout) = construir(&imaxe_p, &["--chamada-sitio", "0x010E"]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "vinculo-estrutural");
    assert_eq!(c.chamada_alvo, Some(0x0600));
    assert!(
        c.limitacions.iter().any(|l| l == "par-declarado"),
        "{:?}",
        c.limitacions
    );
}

#[test]
fn k20b_operandos_de_forma_modelada_non_contan_like_non_modeladas() {
    // Corolario de §7.2 co paso por lonxitude: os operandos dun `jsr.l`
    // modelado NON son instrucións — non contan como palabras non modeladas
    // e a xanela recta e única promove (§5.3) como na serie histórica.
    let d = dir_de_trallo("k20b");
    let mut imaxe = imaxe_base();
    imaxe[0x108..0x10C].fill(0); // sen outros candidatos
    imaxe[0x106..0x10C].copy_from_slice(&[0x4E, 0xB9, 0x00, 0x00, 0x06, 0x00]); // jsr.l → 0x600
    imaxe[0x10C..0x110].copy_from_slice(&[0x43, 0xF8, 0x80, 0x00]); // lea.w/A1 (modelada, allea)
    let imaxe_p = escribir_imaxe(&d, &imaxe, "k20b.bin");

    let (out, stdout) = construir(&imaxe_p, &[]);
    let c = cadea_desde_stdout(&out, &stdout);
    assert_eq!(c.confianza, "vinculo-estrutural", "{:?}", c.limitacions);
    assert_eq!(c.chamada_sitio, Some(0x0106));
    assert_eq!(c.chamada_alvo, Some(0x0600));
    assert!(
        !c.limitacions
            .iter()
            .any(|l| l.starts_with("tramo-non-modelado")),
        "{:?}",
        c.limitacions
    );
    assert!(
        c.orixe
            .iter()
            .any(|o| o == "chamada_sitio=medido-heuristica-ventana"),
        "{:?}",
        c.orixe
    );
}
