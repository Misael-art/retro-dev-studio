//! ADAPTADOR DE COMPATIBILIDADE da superfície tipada anterior do perfil `m68k.platformer_jump.v1`.
//! O produto usa `rex_profile_ipc` (genérico); este módulo delega a ele e existe para conservar a API e os
//! testes anteriores como regressão.
//! Garantias: a ROM de entrada nunca é alterada; a saída é uma CÓPIA nova (e um IPS) em um
//! diretório escolhido, com `create_new` (nunca sobrescreve); o tamanho não muda; a cópia é
//! relida e re-localizada para conferir que os valores pedidos estão lá.

#[cfg(test)]
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::inspection::InspectionError;
use super::rex_platformer_jump::{self as jump, JumpInstance, JumpParams, Patch};
use super::rex_profile_ipc::{self as generic, fail, read_rom, request_ok, ProfileEditRequest};
use super::rom_library::sha256_hex;

pub use super::rex_profile_ipc::MAX_ROM_BYTES;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct JumpLocateRequest {
    pub rom_path: String,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct JumpInstanceView {
    pub instance: JumpInstance,
    /// NodeGraph v1 descritivo da instância (um nó editável por constante).
    pub graph_json: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct JumpLocateResponse {
    pub profile_id: String,
    pub rom_sha256: String,
    pub rom_size: usize,
    pub instances: Vec<JumpInstanceView>,
    pub limites: Vec<String>,
}

pub fn ipc_locate(req: &JumpLocateRequest) -> Result<JumpLocateResponse, InspectionError> {
    request_ok(&req.request_id)?;
    let rom = read_rom(&req.rom_path)?;
    let sha = sha256_hex(&rom);
    let instances = jump::locate(&rom)
        .into_iter()
        .map(|i| {
            let graph_json = jump::graph_json(&rom, &i, &sha);
            JumpInstanceView {
                instance: i,
                graph_json,
            }
        })
        .collect();
    Ok(JumpLocateResponse {
        profile_id: jump::PROFILE_ID.to_string(),
        rom_sha256: sha,
        rom_size: rom.len(),
        instances,
        limites: vec![
            "Localização por assinatura de bytes: prova a forma da rotina e a consistência dos campos de objeto, não que ela seja chamada em gameplay.".to_string(),
            "Só constantes de 16 bits dentro de instruções existentes são editáveis; a ROM não cresce.".to_string(),
            "Altura e teto só aparecem quando o pareamento com o pulo é inequívoco.".to_string(),
        ],
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct JumpEditRequest {
    pub rom_path: String,
    pub jump_offset: usize,
    /// Valores pedidos diretamente (formulário). Mutuamente exclusivo com `graph_json`.
    #[serde(default)]
    pub params: JumpParams,
    /// Grafo do canvas. O núcleo o REVISA contra o canônico reconstruído da ROM e deriva os valores
    /// dele; não confia nos metadados que o frontend carrega.
    #[serde(default)]
    pub graph_json: Option<String>,
    pub output_dir: String,
    pub request_id: String,
    /// OBRIGATÓRIA: identidade (SHA-256) da ROM da localização/grafo. ROM em disco diferente: recusa
    /// (`identity_mismatch`) sem gravar nada.
    pub expected_rom_sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct JumpEditResponse {
    pub rom_sha256_before: String,
    pub rom_sha256_after: String,
    /// Identidade e instância a que o resultado pertence (para o frontend descartar resposta velha).
    pub identity_rom_sha256: String,
    pub jump_offset: usize,
    /// Valores que ESTA cópia aplica (campo, valor).
    pub params_applied: Vec<(String, i32)>,
    pub patched_path: String,
    pub ips_path: String,
    pub ips_sha256: String,
    pub patches: Vec<Patch>,
    pub size_unchanged: bool,
    pub original_untouched: bool,
    /// O IPS gravado, reaplicado por um aplicador independente, reproduz a cópia byte a byte.
    pub ips_reproduces_copy: bool,
    /// Valores relidos da CÓPIA gravada, por campo (conferência pós-escrita).
    pub values_after: Vec<(String, i32)>,
    pub avisos: Vec<String>,
}

// ----------------------------------------------------------------- publicação segura
// A mecânica (temporários, hard_link, desfazimento só do que é nosso) vive em `rex_publish`; aqui fica
// o adaptador que fala o tipo de erro desta superfície.

#[cfg(test)]
pub(crate) use super::rex_publish::WriteFail;
use super::rex_publish::{self, PublishError};
pub(crate) use super::rex_publish::{Fs, RealFs};

/// Verificação do par lido de volta (cópia, IPS) antes de publicar.
pub(crate) type VerifyPair<'a> = &'a dyn Fn(&[u8], &[u8]) -> Result<(), InspectionError>;

/// Publica cópia + IPS JUNTOS ou nada (ver `rex_publish::publish_pair`).
pub(crate) fn publish_pair(
    fs: &dyn Fs,
    out_dir: &Path,
    base: &str,
    bin: &[u8],
    ips: &[u8],
    verify: VerifyPair<'_>,
) -> Result<(PathBuf, PathBuf, Vec<String>), InspectionError> {
    let verify_core =
        |b: &[u8], i: &[u8]| verify(b, i).map_err(|e| PublishError::new(&e.code, e.message));
    rex_publish::publish_pair(fs, out_dir, base, bin, ips, &verify_core)
        .map_err(|e| fail(&e.code, e.message))
}

pub fn ipc_edit(req: &JumpEditRequest) -> Result<JumpEditResponse, InspectionError> {
    ipc_edit_with(&RealFs, req)
}

pub(crate) fn ipc_edit_with(
    fs: &dyn Fs,
    req: &JumpEditRequest,
) -> Result<JumpEditResponse, InspectionError> {
    let narrow = |v: Vec<(String, i64)>| -> Vec<(String, i32)> {
        v.into_iter().map(|(n, x)| (n, x as i32)).collect()
    };
    let r = generic::ipc_edit_with(
        fs,
        &ProfileEditRequest {
            rom_path: req.rom_path.clone(),
            profile_id: jump::PROFILE_ID.to_string(),
            profile_sha256: None,
            instance_offset: req.jump_offset,
            values: req
                .params
                .pairs()
                .into_iter()
                .map(|(n, v)| (n.to_string(), i64::from(v)))
                .collect(),
            graph_json: req.graph_json.clone(),
            output_dir: req.output_dir.clone(),
            request_id: req.request_id.clone(),
            expected_rom_sha256: req.expected_rom_sha256.clone(),
            profiles_dir: None,
            region_exits: Vec::new(),
            region_selection: None,
        },
    )?;
    Ok(JumpEditResponse {
        rom_sha256_before: r.rom_sha256_before,
        rom_sha256_after: r.rom_sha256_after,
        identity_rom_sha256: r.identity_rom_sha256,
        jump_offset: r.instance_offset,
        params_applied: narrow(r.values_applied),
        patched_path: r.patched_path,
        ips_path: r.ips_path,
        ips_sha256: r.ips_sha256,
        patches: r.patches,
        size_unchanged: r.size_unchanged,
        original_untouched: r.original_untouched,
        ips_reproduces_copy: r.ips_reproduces_copy,
        values_after: narrow(r.values_after),
        avisos: r.avisos,
    })
}

#[cfg(test)]
mod tests {
    use super::super::rex_platformer_jump::JumpError;
    use super::*;
    use serde_json::{json, Value};
    use std::cell::RefCell;

    fn dir(nome: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("rex-jump-ipc-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn rom_em(d: &Path) -> String {
        let p = d.join("fixture.bin");
        fs::write(&p, jump::fixture_rom()).unwrap();
        p.to_string_lossy().into_owned()
    }

    fn sha() -> String {
        sha256_hex(&jump::fixture_rom())
    }

    fn off() -> usize {
        jump::locate(&jump::fixture_rom())[0].jump_offset
    }

    fn req(rom: &str, out: &Path, params: JumpParams) -> JumpEditRequest {
        JumpEditRequest {
            rom_path: rom.to_string(),
            jump_offset: off(),
            params,
            graph_json: None,
            output_dir: out.to_string_lossy().into_owned(),
            request_id: "t-1".to_string(),
            expected_rom_sha256: sha(),
        }
    }

    fn imp(v: i32) -> JumpParams {
        JumpParams {
            imp: Some(v),
            ..Default::default()
        }
    }

    fn graph() -> Value {
        let rom = jump::fixture_rom();
        let i = &jump::locate(&rom)[0];
        serde_json::from_str(&jump::graph_json(&rom, i, &sha())).unwrap()
    }

    fn node_mut<'a>(g: &'a mut Value, id: &str) -> &'a mut Value {
        g["nodes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|n| n["id"] == id)
            .unwrap()
    }

    fn req_graph(rom: &str, out: &Path, g: &Value) -> JumpEditRequest {
        let mut r = req(rom, out, JumpParams::default());
        r.graph_json = Some(g.to_string());
        r
    }

    fn arquivos(d: &Path) -> Vec<String> {
        let mut v: Vec<String> = fs::read_dir(d)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn localizar_devolve_instancia_e_grafo() {
        let d = dir("loc");
        let rom = rom_em(&d);
        let r = ipc_locate(&JumpLocateRequest {
            rom_path: rom,
            request_id: "l-1".into(),
        })
        .unwrap();
        assert_eq!(r.instances.len(), 1);
        assert!(r.instances[0].graph_json.contains("rex_logic_recovery"));
        assert!(r.instances[0].graph_json.contains("assinatura_estrutural"));
        assert_eq!(r.rom_size, jump::fixture_rom().len());
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn editar_grava_copia_e_ips_juntos_sem_tocar_a_original_e_reproduz_byte_a_byte() {
        let d = dir("ed");
        let out = d.join("saida");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let r = ipc_edit(&req(&rom, &out, imp(0x900))).unwrap();
        assert!(r.original_untouched && r.size_unchanged && r.ips_reproduces_copy);
        assert_eq!(r.identity_rom_sha256, sha());
        assert_eq!(r.params_applied, vec![("imp".to_string(), 0x900)]);
        assert!(r
            .values_after
            .iter()
            .any(|(n, v)| n == "imp" && *v == 0x900));
        // exatamente 2 arquivos finais, nenhum temporário
        assert_eq!(arquivos(&out).len(), 2, "{:?}", arquivos(&out));
        assert!(arquivos(&out).iter().all(|n| !n.ends_with(".tmp")));
        // reaplicação independente a partir dos ARQUIVOS no disco
        let bin = fs::read(&r.patched_path).unwrap();
        let ips = fs::read(&r.ips_path).unwrap();
        assert_eq!(
            jump::ips_apply_strict(&jump::fixture_rom(), &ips).unwrap(),
            bin
        );
        assert_eq!(fs::read(&rom).unwrap(), jump::fixture_rom());
        // não sobrescreve
        let e = ipc_edit(&req(&rom, &out, imp(0x900))).unwrap_err();
        assert_eq!(e.code, "output_exists_or_unwritable");
        assert_eq!(arquivos(&out).len(), 2);
        let _ = fs::remove_dir_all(d);
    }

    // ------------------------------------------------------------ identidade
    #[test]
    fn identidade_obrigatoria_rom_trocada_entre_localizar_e_gerar_nao_deixa_arquivos() {
        let d = dir("ident");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        // 1) identidade ausente/curta
        let mut r = req(&rom, &out, imp(0x900));
        r.expected_rom_sha256 = String::new();
        assert_eq!(ipc_edit(&r).unwrap_err().code, "identity_mismatch");
        // 2) a ROM em disco muda DEPOIS de localizar (identidade da localização = a antiga)
        let identidade_antiga = sha();
        let mut outra = jump::fixture_rom();
        outra[0] ^= 0xFF; // fora da rotina: o perfil ainda localizaria, mas é OUTRA ROM
        fs::write(&rom, &outra).unwrap();
        let mut r = req(&rom, &out, imp(0x900));
        r.expected_rom_sha256 = identidade_antiga;
        assert_eq!(ipc_edit(&r).unwrap_err().code, "identity_mismatch");
        assert!(
            arquivos(&out).is_empty(),
            "recusa sem arquivos novos: {:?}",
            arquivos(&out)
        );
        let _ = fs::remove_dir_all(d);
    }

    // ------------------------------------------------------------ grafo: integridade
    #[test]
    fn grafo_canonico_com_valor_editado_gera_e_deriva_os_valores_da_rom_nao_do_cliente() {
        let d = dir("gok");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let mut g = graph();
        node_mut(&mut g, "imp")["params"]["value"] = json!(2304);
        // rótulo livre; o plano parte dos bytes REAIS da ROM, não de metadados do cliente
        node_mut(&mut g, "imp")["label"] = json!("outro rótulo");
        // posições e pinned podem mudar livremente
        node_mut(&mut g, "ev")["x"] = json!(999);
        node_mut(&mut g, "ev")["pinned"] = json!(true);
        node_mut(&mut g, "ev")["params"]["rom_path"] = json!("/qualquer/caminho");
        let r = ipc_edit(&req_graph(&rom, &out, &g)).unwrap();
        assert_eq!(r.params_applied, vec![("imp".to_string(), 2304)]);
        assert_eq!(r.patches.len(), 1);
        assert_eq!(r.patches[0].old, vec![0x06, 0x80], "o 'antes' vem da ROM");
        // adulterar o valor ORIGINAL declarado (metadado de origem) é recusado, não aceito como base
        let mut t = graph();
        node_mut(&mut t, "imp")["params"]["value"] = json!(2304);
        node_mut(&mut t, "imp")["params"]["valor_original"] = json!(2304);
        let out2 = d.join("s2");
        fs::create_dir_all(&out2).unwrap();
        assert_eq!(
            ipc_edit(&req_graph(&rom, &out2, &t)).unwrap_err().code,
            "graph-diverges"
        );
        assert!(arquivos(&out2).is_empty());
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn grafo_com_campos_duplicados_e_recusado_sem_escolher_um_dos_dois() {
        let d = dir("gdup");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let mut g = graph();
        let mut copia = node_mut(&mut g, "imp").clone();
        copia["id"] = json!("imp_2");
        copia["params"]["value"] = json!(2500);
        node_mut(&mut g, "imp")["params"]["value"] = json!(2304);
        g["nodes"].as_array_mut().unwrap().push(copia);
        let e = ipc_edit(&req_graph(&rom, &out, &g)).unwrap_err();
        assert_eq!(e.code, "graph-diverges");
        assert!(e.message.contains("nó novo: imp_2"), "{}", e.message);
        // mesmo se o intruso for apresentado como o mesmo campo com o MESMO id e valores diferentes não existe: ids são únicos;
        // o caso de duplicidade por `campo` também é recusado (id diferente, campo igual)
        assert!(arquivos(&out).is_empty());
        let rev = jump::review_graph(&jump::fixture_rom(), &sha(), off(), &g.to_string()).unwrap();
        assert!(!rev.structural_ok);
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn duplicidade_de_campo_entre_nos_canonicos_vira_problema_de_valor() {
        // troca o `campo` de outro nó editável para "imp" (sem mexer em ids): vira alteração de origem E campo duplicado
        let mut g = graph();
        node_mut(&mut g, "impw")["params"]["campo"] = json!("imp");
        node_mut(&mut g, "impw")["params"]["value"] = json!(1000);
        node_mut(&mut g, "imp")["params"]["value"] = json!(2304);
        let rev = jump::review_graph(&jump::fixture_rom(), &sha(), off(), &g.to_string()).unwrap();
        assert!(!rev.structural_ok, "{:?}", rev);
        assert!(
            rev.problems.iter().any(|p| p.contains("duplicado")),
            "{:?}",
            rev.problems
        );
        assert!(!rev.accepted());
    }

    #[test]
    fn mudancas_de_topologia_origem_ou_campo_nao_sao_aplicadas() {
        let d = dir("gtop");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let casos: Vec<(&str, Box<dyn Fn(&mut Value)>)> = vec![
            (
                "nó removido",
                Box::new(|g| {
                    g["nodes"]
                        .as_array_mut()
                        .unwrap()
                        .retain(|n| n["id"] != "vel");
                }),
            ),
            (
                "conexão removida",
                Box::new(|g| {
                    g["edges"].as_array_mut().unwrap().remove(0);
                }),
            ),
            (
                "conexão nova",
                Box::new(|g| {
                    g["edges"].as_array_mut().unwrap().push(json!({"id":"x","fromNode":"ev","fromPort":"exec","toNode":"vel","toPort":"exec"}));
                }),
            ),
            (
                "conexão redirecionada",
                Box::new(|g| {
                    g["edges"][1]["toNode"] = json!("vel");
                }),
            ),
            (
                "origem alterada",
                Box::new(|g| {
                    node_mut(g, "imp")["params"]["rom_offsets"] = json!("0x000000");
                }),
            ),
            (
                "bytes de origem alterados",
                Box::new(|g| {
                    node_mut(g, "imp")["params"]["rom_bytes"] = json!("0000");
                }),
            ),
            (
                "faixa alterada",
                Box::new(|g| {
                    node_mut(g, "imp")["params"]["faixa"] = json!("0..65535");
                }),
            ),
            (
                "campo trocado",
                Box::new(|g| {
                    node_mut(g, "imp")["params"]["campo"] = json!("cut");
                }),
            ),
            (
                "tipo alterado",
                Box::new(|g| {
                    node_mut(g, "sub")["type"] = json!("var_set");
                }),
            ),
            (
                "identidade (instância)",
                Box::new(|g| {
                    node_mut(g, "ev")["params"]["jump_offset"] = json!(0);
                }),
            ),
            (
                "identidade (ROM)",
                Box::new(|g| {
                    node_mut(g, "ev")["params"]["rom_sha256"] = json!("0".repeat(64));
                }),
            ),
            (
                "nó novo",
                Box::new(|g| {
                    let mut n = node_mut(g, "vel").clone();
                    n["id"] = json!("novo");
                    g["nodes"].as_array_mut().unwrap().push(n);
                }),
            ),
        ];
        for (nome, f) in casos {
            let mut g = graph();
            node_mut(&mut g, "imp")["params"]["value"] = json!(2304); // há uma edição de valor legítima junto
            f(&mut g);
            let e = ipc_edit(&req_graph(&rom, &out, &g)).unwrap_err();
            assert_eq!(e.code, "graph-diverges", "{nome}: {}", e.message);
            assert!(arquivos(&out).is_empty(), "{nome}: nada gravado");
        }
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn so_posicao_pinned_rotulo_e_caminho_da_rom_podem_mudar_sem_perder_a_ponte() {
        let rom = jump::fixture_rom();
        let mut g = graph();
        for n in g["nodes"].as_array_mut().unwrap() {
            n["x"] = json!(5);
            n["y"] = json!(7);
            n["pinned"] = json!(true);
            n["label"] = json!("renomeado");
        }
        node_mut(&mut g, "ev")["params"]["rom_path"] = json!("/x");
        let rev = jump::review_graph(&rom, &sha(), off(), &g.to_string()).unwrap();
        assert!(rev.structural_ok && rev.problems.is_empty());
        assert_eq!(rev.changes, JumpParams::default());
        // assinatura canônica igual à do grafo original
        assert_eq!(
            jump::canonical_signature(&g),
            jump::canonical_signature(&graph())
        );
    }

    #[test]
    fn params_e_grafo_ao_mesmo_tempo_sao_recusados() {
        let d = dir("conf");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let mut g = graph();
        node_mut(&mut g, "imp")["params"]["value"] = json!(2304);
        let mut r = req_graph(&rom, &out, &g);
        r.params = imp(0x900);
        assert_eq!(ipc_edit(&r).unwrap_err().code, "params-conflict");
        assert!(arquivos(&out).is_empty());
        let _ = fs::remove_dir_all(d);
    }

    // ------------------------------------------------------------ domínio IPS
    #[test]
    fn ips_recusa_offset_fora_do_dominio_antes_de_qualquer_escrita() {
        let p = |o: usize, n: usize| Patch {
            offset: o,
            old: vec![0; n],
            new: vec![1; n],
        };
        // reprodução da revisão: 0x1000100 era serializado como 0x100
        assert_eq!(
            jump::ips(&[p(0x100_0100, 2)]),
            Err(JumpError::IpsUnrepresentable)
        );
        assert_eq!(
            jump::ips(&[p(0x100_0000, 2)]),
            Err(JumpError::IpsUnrepresentable)
        );
        assert!(jump::ips(&[p(0xFF_FFFF, 1)]).is_ok());
        assert!(jump::ips(&[p(0xFF_FFFE, 2)]).is_ok());
        // marcador EOF como offset
        assert_eq!(
            jump::ips(&[p(0x45_4F46, 2)]),
            Err(JumpError::IpsUnrepresentable)
        );
        assert!(jump::ips(&[p(0x45_4F45, 2)]).is_ok()); // cobre o endereço, mas o campo offset não é "EOF"
        assert!(jump::ips(&[p(0x45_4F47, 2)]).is_ok());
        // tamanhos
        assert_eq!(
            jump::ips(&[Patch {
                offset: 0x10,
                old: vec![],
                new: vec![]
            }]),
            Err(JumpError::IpsUnrepresentable)
        );
        assert!(jump::ips(&[p(0x10, 0xFFFF)]).is_ok());
        assert_eq!(
            jump::ips(&[Patch {
                offset: 0x10,
                old: vec![0; 0x1_0000],
                new: vec![1; 0x1_0000]
            }]),
            Err(JumpError::IpsUnrepresentable)
        );
        // sobreposição e vazio
        assert_eq!(
            jump::ips(&[p(0x10, 4), p(0x12, 4)]),
            Err(JumpError::IpsUnrepresentable)
        );
        assert!(jump::ips(&[p(0x10, 2), p(0x12, 2)]).is_ok());
        assert_eq!(jump::ips(&[]), Err(JumpError::IpsUnrepresentable));
    }

    #[test]
    fn aplicador_estrito_recusa_ips_malformado() {
        let rom = vec![0u8; 64];
        let bom = jump::ips(&[Patch {
            offset: 4,
            old: vec![0, 0],
            new: vec![1, 2],
        }])
        .unwrap();
        assert_eq!(jump::ips_apply_strict(&rom, &bom).unwrap()[4..6], [1, 2]);
        let mut sem_eof = bom.clone();
        sem_eof.truncate(sem_eof.len() - 3);
        assert!(jump::ips_apply_strict(&rom, &sem_eof).is_err());
        let mut lixo = bom.clone();
        lixo.push(0);
        assert!(jump::ips_apply_strict(&rom, &lixo).is_err());
        assert!(jump::ips_apply_strict(&rom, b"PATXH\x00\x00\x04\x00\x01\x01EOF").is_err());
        assert!(jump::ips_apply_strict(&rom, b"PATCH\x00\x00\x04\x00\x00EOF").is_err()); // RLE
        assert!(jump::ips_apply_strict(&rom, b"PATCH\x00\x00\x40\x00\x01\x01EOF").is_err()); // além do fim: não cresce
        assert!(jump::ips_apply_strict(&rom, b"PATCH\x00\x00\x04\x00\x05\x01EOF").is_err());
        // truncado
    }

    #[test]
    fn rom_com_instancia_alem_de_16_mib_recusa_sem_gravar_nada() {
        // a revisão: instância em 0x1000100 era serializada como 0x100
        let d = dir("grande");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let mut rom = vec![0u8; 0x100_0100];
        rom.extend(jump::fixture_rom());
        rom.extend(vec![0u8; 64]);
        let p = d.join("grande.bin");
        fs::write(&p, &rom).unwrap();
        let sha_g = sha256_hex(&rom);
        let off_g = jump::locate(&rom)[0].jump_offset;
        assert!(off_g > 0xFF_FFFF);
        let imp_off = jump::locate(&rom)[0].fields[0].rom_offsets[0];
        assert!(imp_off > 0xFF_FFFF);
        let r = JumpEditRequest {
            rom_path: p.to_string_lossy().into_owned(),
            jump_offset: off_g,
            params: imp(0x900),
            graph_json: None,
            output_dir: out.to_string_lossy().into_owned(),
            request_id: "g".into(),
            expected_rom_sha256: sha_g,
        };
        let e = ipc_edit(&r).unwrap_err();
        assert_eq!(e.code, "ips-unrepresentable", "{}", e.message);
        assert!(arquivos(&out).is_empty());
        let _ = fs::remove_dir_all(d);
    }

    // ------------------------------------------------------------ publicação segura
    #[derive(Default)]
    struct Faulty {
        /// n-ésima chamada de write_new que falha (1-based) e se o arquivo "foi criado".
        falha_write: Option<(usize, bool)>,
        /// n-ésima chamada de hard_link que falha.
        falha_link: Option<usize>,
        nao_mesmo_arquivo: bool,
        falha_remove_final: bool,
        writes: RefCell<usize>,
        links: RefCell<usize>,
    }

    impl Fs for Faulty {
        fn write_new(&self, p: &Path, bytes: &[u8]) -> Result<(), WriteFail> {
            *self.writes.borrow_mut() += 1;
            let n = *self.writes.borrow();
            if let Some((k, criado)) = self.falha_write {
                if k == n {
                    let e = std::io::Error::other("injetado: disco cheio");
                    if criado {
                        let _ = fs::write(p, &bytes[..bytes.len() / 2]); // arquivo parcial deixado por nós
                        return Err(WriteFail::Created(e));
                    }
                    return Err(WriteFail::NotCreated(e));
                }
            }
            RealFs.write_new(p, bytes)
        }
        fn hard_link(&self, from: &Path, to: &Path) -> std::io::Result<()> {
            *self.links.borrow_mut() += 1;
            if self.falha_link == Some(*self.links.borrow()) {
                return Err(std::io::Error::other("injetado: link falhou"));
            }
            RealFs.hard_link(from, to)
        }
        fn remove(&self, p: &Path) -> std::io::Result<()> {
            if self.falha_remove_final
                && p.extension().is_some_and(|e| e == "bin")
                && !p.to_string_lossy().ends_with(".tmp")
            {
                return Err(std::io::Error::other("injetado: remoção negada"));
            }
            RealFs.remove(p)
        }
        fn same_file(&self, a: &Path, b: &Path) -> bool {
            !self.nao_mesmo_arquivo && RealFs.same_file(a, b)
        }
        fn exists(&self, p: &Path) -> bool {
            RealFs.exists(p)
        }
        fn read(&self, p: &Path) -> std::io::Result<Vec<u8>> {
            RealFs.read(p)
        }
    }

    fn base_do(r: &JumpEditResponse) -> String {
        Path::new(&r.patched_path)
            .file_stem()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    /// Descobre o nome base que a geração usaria (gera numa pasta lixo).
    fn nome_base(rom: &str, d: &Path) -> String {
        let lixo = d.join("lixo");
        fs::create_dir_all(&lixo).unwrap();
        let r = ipc_edit(&req(rom, &lixo, imp(0x900))).unwrap();
        let b = base_do(&r);
        let _ = fs::remove_dir_all(lixo);
        b
    }

    #[test]
    fn colisao_previa_no_caminho_do_ips_nao_publica_nada_e_preserva_o_arquivo_alheio() {
        let d = dir("colis");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let base = nome_base(&rom, &d);
        let alheio = out.join(format!("{base}.ips"));
        fs::write(&alheio, b"arquivo de OUTRA sessao").unwrap();
        let e = ipc_edit(&req(&rom, &out, imp(0x900))).unwrap_err();
        assert_eq!(e.code, "output_exists_or_unwritable");
        assert_eq!(fs::read(&alheio).unwrap(), b"arquivo de OUTRA sessao");
        assert_eq!(
            arquivos(&out),
            vec![format!("{base}.ips")],
            "sem .bin, sem temporários"
        );
        // colisão no .bin
        fs::remove_file(&alheio).unwrap();
        let alheio_bin = out.join(format!("{base}.bin"));
        fs::write(&alheio_bin, b"alheio bin").unwrap();
        assert!(ipc_edit(&req(&rom, &out, imp(0x900))).is_err());
        assert_eq!(fs::read(&alheio_bin).unwrap(), b"alheio bin");
        assert_eq!(arquivos(&out), vec![format!("{base}.bin")]);
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn colisao_que_surge_entre_a_checagem_e_a_publicacao_desfaz_so_o_que_e_nosso() {
        // simula a corrida: o IPS final aparece (de outra sessão) logo antes do segundo link
        struct Corrida {
            out: PathBuf,
            base: String,
        }
        impl Fs for Corrida {
            fn write_new(&self, p: &Path, b: &[u8]) -> Result<(), WriteFail> {
                RealFs.write_new(p, b)
            }
            fn hard_link(&self, from: &Path, to: &Path) -> std::io::Result<()> {
                if to.extension().is_some_and(|e| e == "ips") {
                    fs::write(
                        self.out.join(format!("{}.ips", self.base)),
                        b"alheio criado na corrida",
                    )?;
                }
                RealFs.hard_link(from, to)
            }
            fn remove(&self, p: &Path) -> std::io::Result<()> {
                RealFs.remove(p)
            }
            fn same_file(&self, a: &Path, b: &Path) -> bool {
                RealFs.same_file(a, b)
            }
            fn exists(&self, p: &Path) -> bool {
                RealFs.exists(p)
            }
            fn read(&self, p: &Path) -> std::io::Result<Vec<u8>> {
                RealFs.read(p)
            }
        }
        let d = dir("corrida");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let base = nome_base(&rom, &d);
        let e = ipc_edit_with(
            &Corrida {
                out: out.clone(),
                base: base.clone(),
            },
            &req(&rom, &out, imp(0x900)),
        )
        .unwrap_err();
        assert_eq!(e.code, "output_exists_or_unwritable");
        assert!(e.message.contains("desfeita"), "{}", e.message);
        // a cópia que publicamos foi desfeita; o arquivo alheio permanece; nenhum temporário
        assert_eq!(arquivos(&out), vec![format!("{base}.ips")]);
        assert_eq!(
            fs::read(out.join(format!("{base}.ips"))).unwrap(),
            b"alheio criado na corrida"
        );
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn falha_de_escrita_nao_anuncia_conclusao_e_limpa_so_os_temporarios_nossos() {
        let d = dir("wfail");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        let alheio = out.join("nao-mexer.txt");
        fs::write(&alheio, b"outra sessao").unwrap();
        for (n, criado) in [(1, true), (2, true), (1, false), (2, false)] {
            let f = Faulty {
                falha_write: Some((n, criado)),
                ..Default::default()
            };
            let e = ipc_edit_with(&f, &req(&rom, &out, imp(0x900))).unwrap_err();
            assert!(
                e.code == "io_error" || e.code == "output_exists_or_unwritable",
                "{n}/{criado}: {}",
                e.code
            );
            assert_eq!(
                arquivos(&out),
                vec!["nao-mexer.txt".to_string()],
                "falha n={n} criado={criado}: sem finais nem temporários"
            );
        }
        assert_eq!(fs::read(&alheio).unwrap(), b"outra sessao");
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn falha_no_primeiro_link_nao_deixa_nada_e_no_segundo_desfaz_a_copia_nossa() {
        let d = dir("lfail");
        let out = d.join("s");
        fs::create_dir_all(&out).unwrap();
        let rom = rom_em(&d);
        for n in [1usize, 2] {
            let f = Faulty {
                falha_link: Some(n),
                ..Default::default()
            };
            let e = ipc_edit_with(&f, &req(&rom, &out, imp(0x900))).unwrap_err();
            assert_eq!(e.code, "output_exists_or_unwritable");
            assert!(arquivos(&out).is_empty(), "link {n}: {:?}", arquivos(&out));
        }
        // segundo link falha E a remoção do primeiro é negada: o erro AVISA que há arquivo parcial
        let f = Faulty {
            falha_link: Some(2),
            falha_remove_final: true,
            ..Default::default()
        };
        let e = ipc_edit_with(&f, &req(&rom, &out, imp(0x900))).unwrap_err();
        assert!(
            e.message.contains("ATENÇÃO") && e.message.contains("não pôde ser removida"),
            "{}",
            e.message
        );
        // e quando o arquivo publicado já não é o nosso, não é removido
        let _ = fs::remove_dir_all(&out);
        fs::create_dir_all(&out).unwrap();
        let f = Faulty {
            falha_link: Some(2),
            nao_mesmo_arquivo: true,
            ..Default::default()
        };
        let e = ipc_edit_with(&f, &req(&rom, &out, imp(0x900))).unwrap_err();
        assert!(
            e.message.contains("não é mais o arquivo que publiquei"),
            "{}",
            e.message
        );
        assert_eq!(
            arquivos(&out)
                .iter()
                .filter(|n| n.ends_with(".bin"))
                .count(),
            1,
            "o arquivo suspeito foi preservado"
        );
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn recusas_estruturadas() {
        let d = dir("rec");
        let rom = rom_em(&d);
        let out = d.clone();
        let c = |e: InspectionError| e.code;
        assert_eq!(
            c(ipc_edit(&req(&rom, &out, imp(0))).unwrap_err()),
            "out-of-range"
        );
        assert_eq!(
            c(ipc_edit(&req(&rom, &out, JumpParams::default())).unwrap_err()),
            "no-change"
        );
        assert_eq!(
            c(ipc_edit(&req("", &out, JumpParams::default())).unwrap_err()),
            "invalid_request"
        );
        assert_eq!(
            c(ipc_edit(&req("/nao/existe.bin", &out, JumpParams::default())).unwrap_err()),
            "invalid_request"
        );
        let mut r = req(&rom, &out, imp(0x700));
        r.output_dir = "/nao/existe".into();
        assert_eq!(c(ipc_edit(&r).unwrap_err()), "invalid_request");
        let mut r = req(&rom, &out, imp(0x700));
        r.request_id = String::new();
        assert_eq!(c(ipc_edit(&r).unwrap_err()), "invalid_request");
        let mut r = req(&rom, &out, imp(0x700));
        r.jump_offset += 2;
        assert_eq!(c(ipc_edit(&r).unwrap_err()), "instance-not-found");
        let grande = d.join("grande.bin");
        let f = fs::File::create(&grande).unwrap();
        f.set_len(MAX_ROM_BYTES + 1).unwrap();
        assert_eq!(
            c(ipc_locate(&JumpLocateRequest {
                rom_path: grande.to_string_lossy().into_owned(),
                request_id: "g".into()
            })
            .unwrap_err()),
            "invalid_request"
        );
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn rom_sem_instancia_devolve_lista_vazia_sem_erro() {
        let d = dir("vazia");
        let p = d.join("x.bin");
        fs::write(&p, [0x4E, 0x71].repeat(256)).unwrap();
        let r = ipc_locate(&JumpLocateRequest {
            rom_path: p.to_string_lossy().into_owned(),
            request_id: "v".into(),
        })
        .unwrap();
        assert!(r.instances.is_empty());
        let _ = fs::remove_dir_all(d);
    }
}
