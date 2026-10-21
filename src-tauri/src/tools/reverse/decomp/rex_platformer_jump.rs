//! Perfil `m68k.platformer_jump.v1` (Experimental): localiza por ASSINATURA a lógica de
//! pulo de plataformas M68000 da família Sonic (impulso rotacionado pelo ângulo, altura
//! variável por soltar o botão, teto de subida) e permite editar com segurança as
//! CONSTANTES dela (imediatos de 16 bits) sem crescer a ROM.
//!
//! Nada aqui é endereço fixo: o perfil declara a forma; cada ROM confirma. Se a forma
//! não confirma (assinatura, consistência de campos entre as três partes), não há
//! instância e nenhuma edição é oferecida. Edições são listas de `Patch` com os bytes
//! ANTIGOS conferidos na aplicação; a ROM original nunca é alterada (a função devolve
//! uma cópia) e o tamanho nunca muda.
//!
//! Limites declarados: o perfil não prova que a rotina seja chamada em gameplay; prova
//! a forma + a consistência dos campos de objeto. A verificação de efeito (o pulo mudou
//! de fato) é separada, no core de emulação.

use serde::{Deserialize, Serialize};

use std::sync::OnceLock;

use super::rex_edit::{self, EditError, PlanError};
use super::rex_profile_engine::{Engine, EngineInstance, ProfileError};
use super::rex_profile_graph as graph;
use super::rex_profile_registry::Registry;
#[cfg(test)]
use super::rex_sigscan::{Match, Pattern};

// ADAPTADOR DE COMPATIBILIDADE. O caminho do produto (UI → `rex_profile_ipc` → motor) não passa por aqui:
// este módulo conserva a API tipada anterior (`JumpInstance`, `JumpParams`, `JumpError`) sobre o motor
// genérico e guarda, só para teste, o código antigo como oráculo de equivalência.
pub use super::rex_edit::Patch;
pub use super::rex_profile_graph::{canonical_signature, canonical_string};

pub const PROFILE_ID: &str = "m68k.platformer_jump.v1";
pub const PAIR_WINDOW: usize = 0x4000;
pub const CAP_WINDOW: usize = 0x100;

#[cfg(test)]
const PAT_JUMP: &str = "34 3C {imp:2} 08 28 00 06 {st:2} 67 04 34 3C {impw:2} 70 00 10 28 {ang:2} 04 00 00 40 4E B9 {sin:4} C3 C2 E0 81 D3 68 {vx:2} C1 C2 E0 80 D1 68 {vy:2}";
#[cfg(test)]
const PAT_JUMP_SUPER: &str = "34 3C {imp:2} 4A 38 {sup:2} 67 04 34 3C {imps:2} 08 28 00 06 {st:2} 67 04 34 3C {impw:2} 70 00 10 28 {ang:2} 04 00 00 40 4E B9 {sin:4} C3 C2 E0 81 D3 68 {vx:2} C1 C2 E0 80 D1 68 {vy:2}";
/// A altura aparece com o desvio curto (`6F xx`) ou com o desvio de palavra (`6F 00 xxxx`).
#[cfg(test)]
const PAT_HEIGHT: [&str; 2] = [
    "4A 28 {flag:2} 67 {_:1} 32 3C {cut:2} 08 28 00 06 {st:2} 67 04 32 3C {cutw:2} B2 68 {vy:2} 6F {_:1} 10 38 {held:2} 02 00 00 70 66 04 31 41 {vy:2}",
    "4A 28 {flag:2} 67 {_:1} 32 3C {cut:2} 08 28 00 06 {st:2} 67 04 32 3C {cutw:2} B2 68 {vy:2} 6F 00 {_:2} 10 38 {held:2} 02 00 00 70 66 04 31 41 {vy:2}",
];
/// Comprimento do prefixo `move.w #imp,d2; tst.b sup; beq.s; move.w #imps,d2` (o padrão simples começa depois dele).
#[cfg(test)]
const SUPER_PREFIX: usize = 10;
#[cfg(test)]
const PAT_CAP: &str = "0C 68 {cap:2} {vy:2} 6C 06 31 7C {cap:2} {vy:2}";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JumpError {
    /// Instância não encontrada nesta ROM (ou ROM mudou desde a localização).
    InstanceNotFound,
    /// Valor fora da faixa segura do campo.
    OutOfRange,
    /// Nada a alterar (valores iguais aos atuais): recusa explícita, nunca no-op silencioso.
    NoChange,
    /// O campo pedido não existe nesta instância (ex.: altura não pareada).
    FieldUnavailable,
    /// O IPS não consegue representar o patch (offset > 0xFFFFFF, offset = marcador EOF, tamanho 0 ou > 0xFFFF, sobreposição).
    IpsUnrepresentable,
    /// O grafo enviado diverge do canônico reconstruído da ROM (topologia, origem, campos, duplicados ou valor inválido).
    GraphDiverges,
    /// Valores pedidos por duas fontes (params e grafo) ao mesmo tempo.
    ParamsConflict,
    /// Os bytes antigos não coincidem com os do patch (ROM já editada/diferente).
    StaleBytes,
}

impl JumpError {
    pub fn code(&self) -> &'static str {
        match self {
            JumpError::InstanceNotFound => "instance-not-found",
            JumpError::OutOfRange => "out-of-range",
            JumpError::NoChange => "no-change",
            JumpError::FieldUnavailable => "field-unavailable",
            JumpError::IpsUnrepresentable => "ips-unrepresentable",
            JumpError::GraphDiverges => "graph-diverges",
            JumpError::ParamsConflict => "params-conflict",
            JumpError::StaleBytes => "stale-bytes",
        }
    }
}

/// Campo editável: onde está (offsets de ROM dos imediatos de 16 bits) e o valor atual.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JumpField {
    pub name: String,
    pub label: String,
    pub value: i32,
    pub min: i32,
    pub max: i32,
    /// Offsets absolutos de ROM onde o imediato (2 bytes, BE) aparece. Mais de um = editados juntos.
    pub rom_offsets: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JumpInstance {
    pub profile_id: String,
    pub jump_offset: usize,
    pub height_offset: Option<usize>,
    pub cap_offset: Option<usize>,
    /// Deslocamentos de campo do objeto (rótulos só estruturais; não são nomes do jogo).
    pub status_off: u32,
    pub vel_x_off: u32,
    pub vel_y_off: u32,
    pub jump_flag_off: u32,
    pub held_ram: u32,
    pub fields: Vec<JumpField>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct JumpParams {
    pub imp: Option<i32>,
    pub imps: Option<i32>,
    pub impw: Option<i32>,
    pub cut: Option<i32>,
    pub cutw: Option<i32>,
    pub cap: Option<i32>,
}

#[cfg(test)]
fn v(m: &Match, k: &str) -> u32 {
    m.caps[k].value
}

#[cfg(test)]
fn at(m: &Match, k: &str) -> usize {
    m.caps[k].rom_offset
}

#[cfg(test)]
fn s16(x: u32) -> i32 {
    i32::from(x as u16 as i16)
}

#[cfg(test)]
fn field(name: &str, label: &str, value: i32, min: i32, max: i32, offs: Vec<usize>) -> JumpField {
    JumpField {
        name: name.to_string(),
        label: label.to_string(),
        value,
        min,
        max,
        rom_offsets: offs,
    }
}

/// Relações do perfil em dado (ids do JSON) que este adaptador traduz para `JumpInstance`.
const REL_HEIGHT: &str = "pair_height";
const REL_CAP: &str = "follow_cap";

fn engine() -> Option<&'static Engine> {
    static ENGINE: OnceLock<Option<Engine>> = OnceLock::new();
    ENGINE
        .get_or_init(|| {
            Registry::builtin()
                .find(PROFILE_ID)
                .map(|p| p.engine.clone())
        })
        .as_ref()
}

fn cap_or0(inst: &EngineInstance, rel: Option<&str>, k: &str) -> u32 {
    let m = match rel {
        None => Some(&inst.anchor),
        Some(r) => inst.links.get(r),
    };
    m.and_then(|m| m.cap(k)).unwrap_or(0)
}

fn to_jump(engine: &Engine, rom: &[u8], i: EngineInstance) -> JumpInstance {
    JumpInstance {
        profile_id: PROFILE_ID.to_string(),
        jump_offset: i.anchor_offset,
        height_offset: i.links.get(REL_HEIGHT).map(|h| h.offset),
        cap_offset: i.links.get(REL_CAP).map(|c| c.offset),
        status_off: cap_or0(&i, None, "st"),
        vel_x_off: cap_or0(&i, None, "vx"),
        vel_y_off: cap_or0(&i, None, "vy"),
        jump_flag_off: cap_or0(&i, Some(REL_HEIGHT), "flag"),
        held_ram: cap_or0(&i, Some(REL_HEIGHT), "held"),
        notes: engine.notes(rom, &i),
        fields: i
            .fields
            .into_iter()
            .map(|f| JumpField {
                name: f.name,
                label: f.label,
                value: f.value as i32,
                min: f.min as i32,
                max: f.max as i32,
                rom_offsets: f.rom_offsets,
            })
            .collect(),
    }
}

/// Localiza as instâncias do perfil na ROM pelo motor genérico, com o perfil em dado embutido
/// (`data/rex_profiles/specs/m68k.platformer_jump.v1.json`). Notas, campos e ligações vêm do dado.
pub fn locate(rom: &[u8]) -> Vec<JumpInstance> {
    let Some(engine) = engine() else {
        return Vec::new();
    };
    engine
        .locate_any(rom)
        .map(|l| l.instances)
        .unwrap_or_default()
        .into_iter()
        .map(|i| to_jump(engine, rom, i))
        .collect()
}

/// IMPLEMENTAÇÃO DE REFERÊNCIA (anterior à F1): só existe nos testes, como oráculo da equivalência com o
/// motor orientado a dado. Semântica original preservada.
#[cfg(test)]
pub(crate) fn locate_reference(rom: &[u8]) -> Vec<JumpInstance> {
    let (Ok(pj), Ok(pjs), Ok(pc)) = (
        Pattern::parse(PAT_JUMP),
        Pattern::parse(PAT_JUMP_SUPER),
        Pattern::parse(PAT_CAP),
    ) else {
        return Vec::new();
    };
    let ph: Vec<Pattern> = PAT_HEIGHT
        .iter()
        .filter_map(|p| Pattern::parse(p).ok())
        .collect();
    let (supers, _) = pjs.scan(rom);
    let (plain, _) = pj.scan(rom);
    // o padrão simples também casa dentro do super (a partir do 2º move.w): descartar
    let mut jumps: Vec<(Match, bool)> = supers.into_iter().map(|m| (m, true)).collect();
    for m in plain {
        if !jumps
            .iter()
            .any(|(s, _)| s.offset + SUPER_PREFIX == m.offset)
        {
            jumps.push((m, false));
        }
    }
    jumps.sort_by_key(|(m, _)| m.offset);
    let mut heights: Vec<Match> = ph.iter().flat_map(|p| p.scan(rom).0).collect();
    heights.sort_by_key(|m| m.offset);
    heights.dedup_by_key(|m| m.offset);
    let (caps, _) = pc.scan(rom);
    let consistent = |j: &Match, h: &Match| v(h, "st") == v(j, "st") && v(h, "vy") == v(j, "vy");
    let mut out = Vec::new();
    for (ji, (j, is_super)) in jumps.iter().enumerate() {
        let near = heights
            .iter()
            .filter(|h| consistent(j, h) && h.offset.abs_diff(j.offset) <= PAIR_WINDOW)
            .min_by_key(|h| h.offset.abs_diff(j.offset));
        let paired = near.filter(|h| {
            let back = jumps
                .iter()
                .enumerate()
                .filter(|(_, (o, _))| {
                    consistent(o, h) && h.offset.abs_diff(o.offset) <= PAIR_WINDOW
                })
                .min_by_key(|(_, (o, _))| h.offset.abs_diff(o.offset))
                .map(|(i, _)| i);
            back == Some(ji)
        });
        let mut fields = vec![field(
            "imp",
            "Impulso do pulo",
            s16(v(j, "imp")),
            1,
            0x7FFF,
            vec![at(j, "imp")],
        )];
        if *is_super {
            fields.push(field(
                "imps",
                "Impulso do pulo na forma super",
                s16(v(j, "imps")),
                1,
                0x7FFF,
                vec![at(j, "imps")],
            ));
        }
        fields.push(field(
            "impw",
            "Impulso do pulo submerso",
            s16(v(j, "impw")),
            1,
            0x7FFF,
            vec![at(j, "impw")],
        ));
        let mut notes = vec![format!(
            "impulso em {:#x}{}",
            j.offset,
            if *is_super {
                " (com variante de forma super)"
            } else {
                ""
            }
        )];
        let mut height_offset = None;
        let mut cap_offset = None;
        let (mut flag_off, mut held_ram) = (0u32, 0u32);
        if let Some(h) = paired {
            height_offset = Some(h.offset);
            flag_off = v(h, "flag");
            held_ram = v(h, "held");
            fields.push(field(
                "cut",
                "Corte da altura ao soltar o botão",
                s16(v(h, "cut")),
                -0x7FFF,
                -1,
                vec![at(h, "cut")],
            ));
            fields.push(field(
                "cutw",
                "Corte da altura submerso",
                s16(v(h, "cutw")),
                -0x7FFF,
                -1,
                vec![at(h, "cutw")],
            ));
            notes.push(format!(
                "altura em {:#x} (pareamento mútuo, campos consistentes)",
                h.offset
            ));
            let c = caps
                .iter()
                .filter(|c| {
                    v(c, "vy") == v(h, "vy")
                        && c.offset > h.offset
                        && c.offset - h.offset <= CAP_WINDOW
                })
                .min_by_key(|c| c.offset - h.offset);
            if let Some(c) = c {
                cap_offset = Some(c.offset);
                fields.push(field(
                    "cap",
                    "Teto de velocidade ascendente",
                    s16(v(c, "cap")),
                    -0x7FFF,
                    -1,
                    vec![at(c, "cap"), c.offset + 10],
                ));
                notes.push(format!("teto de subida em {:#x}", c.offset));
            } else {
                notes.push("teto de subida não localizado: campo 'cap' indisponível".to_string());
            }
        } else {
            notes.push(
                "altura não pareada de forma inequívoca: campos de corte e teto NÃO são oferecidos"
                    .to_string(),
            );
        }
        out.push(JumpInstance {
            profile_id: PROFILE_ID.to_string(),
            jump_offset: if *is_super {
                j.offset + SUPER_PREFIX
            } else {
                j.offset
            },
            height_offset,
            cap_offset,
            status_off: v(j, "st"),
            vel_x_off: v(j, "vx"),
            vel_y_off: v(j, "vy"),
            jump_flag_off: flag_off,
            held_ram,
            fields,
            notes,
        });
    }
    out
}

fn hex_off(o: usize) -> String {
    format!("0x{o:06X}")
}

/// Grafo NodeGraph v1 da instância, gerado pelo motor a partir da projeção declarada no perfil.
pub fn graph_json(rom: &[u8], inst: &JumpInstance, rom_sha256: &str) -> String {
    let Some(engine) = engine() else {
        return String::new();
    };
    engine
        .locate_any(rom)
        .ok()
        .and_then(|l| {
            l.instances
                .into_iter()
                .find(|i| i.anchor_offset == inst.jump_offset)
        })
        .and_then(|i| graph::graph_json(engine, rom, &i, rom_sha256).ok())
        .unwrap_or_default()
}

/// IMPLEMENTAÇÃO DE REFERÊNCIA do grafo (código anterior à migração para dado): só existe nos testes, como
/// oráculo da igualdade com a projeção declarativa.
#[cfg(test)]
pub(crate) fn graph_json_reference(rom: &[u8], inst: &JumpInstance, rom_sha256: &str) -> String {
    use serde_json::{json, Value};
    let mut nodes: Vec<Value> = Vec::new();
    let mut edges: Vec<Value> = Vec::new();
    let io = |ins: &[(&str, &str, Option<&str>)]| -> Vec<Value> {
        ins.iter()
            .map(|(id, kind, dt)| match dt {
                Some(d) => json!({"id": id, "label": id, "kind": kind, "dataType": d}),
                None => json!({"id": id, "label": id, "kind": kind}),
            })
            .collect()
    };
    let ports = |t: &str| -> (Vec<Value>, Vec<Value>) {
        match t {
            "event_update" => (io(&[]), io(&[("exec", "exec", None)])),
            "input_pressed" => (io(&[("exec", "exec", None)]), io(&[("exec", "exec", None)])),
            "condition_compare" => (
                io(&[
                    ("exec", "exec", None),
                    ("a", "data", Some("int")),
                    ("b", "data", Some("int")),
                ]),
                io(&[("true", "exec", None), ("false", "exec", None)]),
            ),
            _ => (
                io(&[("exec", "exec", None), ("value", "data", Some("int"))]),
                io(&[("exec", "exec", None)]),
            ),
        }
    };
    let mut col_row = std::collections::HashMap::new();
    let mut add = |id: &str,
                   t: &str,
                   label: &str,
                   col: i32,
                   row: i32,
                   mut params: serde_json::Map<String, Value>,
                   rom_at: Option<(usize, usize)>| {
        params.insert(
            "origem".into(),
            json!("recuperado do ROM (perfil m68k.platformer_jump.v1)"),
        );
        if let Some((a, n)) = rom_at {
            params.insert("rom_addr".into(), json!(hex_off(a)));
            params.insert(
                "rom_bytes".into(),
                json!(rom
                    .get(a..a + n)
                    .map(|b| b.iter().map(|x| format!("{x:02x}")).collect::<String>())
                    .unwrap_or_default()),
            );
        }
        let (i, o) = ports(t);
        col_row.insert(id.to_string(), (col, row));
        nodes.push(json!({"id": id, "type": t, "label": label, "x": 40 + 330 * col, "y": 40 + 190 * row, "inputs": i, "outputs": o, "params": Value::Object(params)}));
    };
    let mut edge = |a: &str, ap: &str, b: &str, bp: &str| {
        let id = format!("e{}", edges.len() + 1);
        edges.push(json!({"id": id, "fromNode": a, "fromPort": ap, "toNode": b, "toPort": bp}));
    };
    let pm = |kv: Vec<(&str, Value)>| -> serde_json::Map<String, Value> {
        kv.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
    };
    let fld = |name: &str| inst.fields.iter().find(|f| f.name == name);
    let editable = |name: &str, var: &str, descr: &str| -> serde_json::Map<String, Value> {
        let f = fld(name).expect("campo existente");
        pm(vec![
            ("var_name", json!(var)),
            ("value", json!(f.value)),
            ("valor_original", json!(f.value)),
            ("descricao", json!(descr)),
            ("editavel", json!(1)),
            ("campo", json!(name)),
            ("faixa", json!(format!("{}..{}", f.min, f.max))),
            (
                "rom_offsets",
                json!(f
                    .rom_offsets
                    .iter()
                    .map(|o| hex_off(*o))
                    .collect::<Vec<_>>()
                    .join(",")),
            ),
        ])
    };
    let imm_at = |name: &str| fld(name).map(|f| (f.rom_offsets[0] - 2, 4usize));
    add(
        "ev",
        "event_update",
        "Pulo: chamado pelo modo no chão",
        0,
        0,
        pm(vec![
            ("rate", json!("frame")),
            ("perfil", json!(PROFILE_ID)),
            ("rom_sha256", json!(rom_sha256)),
            ("jump_offset", json!(inst.jump_offset)),
            ("ponte_edicao", json!(1)),
        ]),
        Some((inst.jump_offset, 4)),
    );
    add(
        "btn",
        "input_pressed",
        "A, B ou C pressionado",
        0,
        1,
        pm(vec![
            ("pad", json!("JOY_1")),
            ("button", json!("BUTTON_A|B|C")),
        ]),
        None,
    );
    add(
        "sub",
        "condition_compare",
        "Submerso? (bit 6 do status)",
        0,
        2,
        pm(vec![
            ("operator", json!("==")),
            ("a", json!("sonic_submerso")),
            ("b", json!(1)),
            (
                "descricao",
                json!(format!("byte de status +{:#x}, bit 6", inst.status_off)),
            ),
        ]),
        Some((inst.jump_offset + 4, 6)),
    );
    add(
        "imp",
        "var_set",
        "Impulso do pulo",
        1,
        3,
        editable("imp", "impulso_pulo", "move.w #imp,d2"),
        imm_at("imp"),
    );
    if fld("imps").is_some() {
        add(
            "imps",
            "var_set",
            "Impulso do pulo (forma super)",
            2,
            3,
            editable(
                "imps",
                "impulso_pulo_super",
                "variante com teste de forma super",
            ),
            imm_at("imps"),
        );
    }
    add(
        "impw",
        "var_set",
        "Impulso do pulo submerso",
        1,
        4,
        editable(
            "impw",
            "impulso_pulo_submerso",
            "move.w #impw,d2 quando submerso",
        ),
        imm_at("impw"),
    );
    add(
        "vel",
        "var_set",
        "Velocidade += impulso rotacionado pelo ângulo",
        0,
        5,
        pm(vec![
            ("var_name", json!("vel_y")),
            ("value", json!(0)),
            (
                "descricao",
                json!(format!(
                    "vx(+{:#x}) += cos*d2>>8; vy(+{:#x}) += sin*d2>>8",
                    inst.vel_x_off, inst.vel_y_off
                )),
            ),
        ]),
        None,
    );
    edge("ev", "exec", "btn", "exec");
    edge("btn", "exec", "sub", "exec");
    edge("sub", "false", "imp", "exec");
    edge("sub", "true", "impw", "exec");
    if fld("imps").is_some() {
        edge("imp", "exec", "imps", "exec");
        edge("imps", "exec", "vel", "exec");
    } else {
        edge("imp", "exec", "vel", "exec");
    }
    edge("impw", "exec", "vel", "exec");
    if let Some(h) = inst.height_offset {
        add(
            "aev",
            "event_update",
            "Altura variável: chamada pelo modo no ar",
            4,
            0,
            pm(vec![("rate", json!("frame"))]),
            Some((h, 6)),
        );
        add(
            "jf",
            "condition_compare",
            "Flag de pulo != 0?",
            4,
            1,
            pm(vec![
                ("operator", json!("!=")),
                ("a", json!("pulando")),
                ("b", json!(0)),
                (
                    "descricao",
                    json!(format!("byte do objeto +{:#x}", inst.jump_flag_off)),
                ),
            ]),
            Some((h, 6)),
        );
        add(
            "sub2",
            "condition_compare",
            "Submerso?",
            4,
            2,
            pm(vec![
                ("operator", json!("==")),
                ("a", json!("sonic_submerso")),
                ("b", json!(1)),
            ]),
            None,
        );
        add(
            "cut",
            "var_set",
            "Corte da altura ao soltar o botão",
            4,
            3,
            editable(
                "cut",
                "corte_altura",
                "vy := corte se vy < corte e o botão foi solto",
            ),
            imm_at("cut"),
        );
        add(
            "cutw",
            "var_set",
            "Corte da altura submerso",
            5,
            3,
            editable("cutw", "corte_altura_submerso", "idem, submerso"),
            imm_at("cutw"),
        );
        edge("aev", "exec", "jf", "exec");
        edge("jf", "true", "sub2", "exec");
        edge("sub2", "false", "cut", "exec");
        edge("sub2", "true", "cutw", "exec");
        if fld("cap").is_some() {
            add(
                "cap",
                "var_set",
                "Teto de velocidade ascendente (flag == 0)",
                6,
                2,
                editable("cap", "teto_subida", "vy := teto se vy < teto e não pulou"),
                inst.cap_offset.map(|c| (c, 6)),
            );
            edge("jf", "false", "cap", "exec");
        }
    }
    // Assinatura estrutural: o que é CANÔNICO (topologia, tipos, portas, parâmetros de origem). Valores dos
    // nós editáveis, posições, rótulos e o caminho da ROM ficam fora: são o que o usuário pode mexer.
    let assinatura = canonical_signature(&json!({"nodes": nodes, "edges": edges}));
    if let Some(ev) = nodes.iter_mut().find(|n| n["id"] == "ev") {
        ev["params"]["assinatura_estrutural"] = json!(assinatura);
    }
    let meta = json!({
        "profile_id": PROFILE_ID, "rom_sha256": rom_sha256, "jump_offset": hex_off(inst.jump_offset),
        "descritivo": true,
        "aviso": "Grafo descritivo. Alterar valores aqui nao altera a ROM; a ROM so muda pelo plano de edicao (patch sem crescimento).",
        "campos_editaveis": inst.fields.iter().map(|f| f.name.clone()).collect::<Vec<_>>(),
    });
    serde_json::to_string_pretty(
        &json!({"version": 1, "nodes": nodes, "edges": edges, "rex_logic_recovery": meta}),
    )
    .unwrap_or_default()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphReview {
    /// Topologia, origem e metadados de origem iguais ao canônico reconstruído da ROM.
    pub structural_ok: bool,
    /// Diferenças estruturais (nó removido/novo, aresta mudada, origem/campo alterado, identidade).
    pub differences: Vec<String>,
    /// Problemas de VALOR (duplicado, não inteiro): impedem a edição sem serem "mudança de lógica".
    pub problems: Vec<String>,
    /// Mudanças de valor derivadas do grafo contra os valores REAIS da ROM (nunca do `valor_original` do cliente).
    pub changes: JumpParams,
}

impl GraphReview {
    pub fn accepted(&self) -> bool {
        self.structural_ok && self.problems.is_empty() && self.changes != JumpParams::default()
    }
}

impl JumpParams {
    /// Pares `(campo, valor)` pedidos.
    pub fn pairs(&self) -> Vec<(&'static str, i32)> {
        [
            ("imp", self.imp),
            ("imps", self.imps),
            ("impw", self.impw),
            ("cut", self.cut),
            ("cutw", self.cutw),
            ("cap", self.cap),
        ]
        .into_iter()
        .filter_map(|(n, v)| v.map(|v| (n, v)))
        .collect()
    }

    fn set(&mut self, name: &str, v: i32) {
        match name {
            "imp" => self.imp = Some(v),
            "imps" => self.imps = Some(v),
            "impw" => self.impw = Some(v),
            "cut" => self.cut = Some(v),
            "cutw" => self.cutw = Some(v),
            "cap" => self.cap = Some(v),
            _ => {}
        }
    }
}

impl From<ProfileError> for JumpError {
    fn from(e: ProfileError) -> JumpError {
        match e {
            ProfileError::InstanceNotFound
            | ProfileError::ProfileUnknown(_)
            | ProfileError::RomNotBound
            | ProfileError::RegionRefused(_)
            | ProfileError::WorkLimit(_) => JumpError::InstanceNotFound,
            ProfileError::OutOfRange => JumpError::OutOfRange,
            ProfileError::NoChange => JumpError::NoChange,
            ProfileError::FieldUnavailable => JumpError::FieldUnavailable,
            ProfileError::IpsUnrepresentable => JumpError::IpsUnrepresentable,
            ProfileError::GraphDiverges(_) | ProfileError::ProfileMismatch { .. } => {
                JumpError::GraphDiverges
            }
            ProfileError::ParamsConflict => JumpError::ParamsConflict,
            ProfileError::StaleBytes => JumpError::StaleBytes,
        }
    }
}

/// Revisão do grafo pelo motor genérico, traduzida para os tipos desta API.
pub fn review_graph(
    rom: &[u8],
    rom_sha256: &str,
    jump_offset: usize,
    current_json: &str,
) -> Result<GraphReview, JumpError> {
    let engine = engine().ok_or(JumpError::InstanceNotFound)?;
    let r = graph::review_graph(engine, rom, rom_sha256, jump_offset, current_json)?;
    let mut changes = JumpParams::default();
    for (n, v) in &r.changes {
        changes.set(n, *v as i32);
    }
    Ok(GraphReview {
        structural_ok: r.structural_ok,
        differences: r.differences,
        problems: r.problems,
        changes,
    })
}

impl From<EditError> for JumpError {
    fn from(e: EditError) -> JumpError {
        ProfileError::from(e).into()
    }
}

impl From<PlanError> for JumpError {
    fn from(e: PlanError) -> JumpError {
        ProfileError::from(e).into()
    }
}

/// Plano de edição: re-localiza (nunca confia no cliente), valida faixa, recusa no-op.
pub fn plan_edit(
    rom: &[u8],
    jump_offset: usize,
    params: &JumpParams,
) -> Result<Vec<Patch>, JumpError> {
    let engine = engine().ok_or(JumpError::InstanceNotFound)?;
    let inst = engine
        .locate_any(rom)
        .map_err(ProfileError::from)?
        .instances
        .into_iter()
        .find(|i| i.anchor_offset == jump_offset)
        .ok_or(JumpError::InstanceNotFound)?;
    let wanted: Vec<(&str, Option<i64>)> = params
        .pairs()
        .into_iter()
        .map(|(n, v)| (n, Some(i64::from(v))))
        .collect();
    Ok(engine.plan_edit(rom, &inst, &wanted)?)
}

/// Aplica a uma CÓPIA: confere os bytes antigos; o tamanho nunca muda.
pub fn apply(rom: &[u8], patches: &[Patch]) -> Result<Vec<u8>, JumpError> {
    Ok(rex_edit::apply(rom, patches)?)
}

/// Patch IPS só com os bytes alterados; ver `rex_edit::ips`.
pub fn ips(patches: &[Patch]) -> Result<Vec<u8>, JumpError> {
    Ok(rex_edit::ips(patches)?)
}

/// Aplicador IPS estrito e independente do gerador; ver `rex_edit::ips_apply_strict`.
pub fn ips_apply_strict(rom: &[u8], ips: &[u8]) -> Result<Vec<u8>, JumpError> {
    Ok(rex_edit::ips_apply_strict(rom, ips)?)
}

#[cfg(test)]
pub(crate) fn fixture_rom() -> Vec<u8> {
    tests::base()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ROM sintética AUTORAL com a forma do perfil (bytes montados à mão a partir da
    // gramática do perfil, com deslocamentos de objeto DIFERENTES dos de qualquer jogo).
    fn forma(
        st: u16,
        vx: u16,
        vy: u16,
        flag: u16,
        held: u16,
        imp: u16,
        impw: u16,
        cut: u16,
        cutw: u16,
        cap: u16,
    ) -> Vec<u8> {
        let mut b = vec![0x34, 0x3C];
        b.extend(imp.to_be_bytes());
        b.extend([0x08, 0x28, 0x00, 0x06]);
        b.extend(st.to_be_bytes());
        b.extend([0x67, 0x04, 0x34, 0x3C]);
        b.extend(impw.to_be_bytes());
        b.extend([
            0x70, 0x00, 0x10, 0x28, 0x00, 0x26, 0x04, 0x00, 0x00, 0x40, 0x4E, 0xB9, 0, 0, 0x29,
            0xDA,
        ]);
        b.extend([0xC3, 0xC2, 0xE0, 0x81, 0xD3, 0x68]);
        b.extend(vx.to_be_bytes());
        b.extend([0xC1, 0xC2, 0xE0, 0x80, 0xD1, 0x68]);
        b.extend(vy.to_be_bytes());
        b.extend([0x4E, 0x75]);
        // altura
        b.extend([0x4A, 0x28]);
        b.extend(flag.to_be_bytes());
        b.extend([0x67, 0x26, 0x32, 0x3C]);
        b.extend(cut.to_be_bytes());
        b.extend([0x08, 0x28, 0x00, 0x06]);
        b.extend(st.to_be_bytes());
        b.extend([0x67, 0x04, 0x32, 0x3C]);
        b.extend(cutw.to_be_bytes());
        b.extend([0xB2, 0x68]);
        b.extend(vy.to_be_bytes());
        b.extend([0x6F, 0x0E, 0x10, 0x38]);
        b.extend(held.to_be_bytes());
        b.extend([0x02, 0x00, 0x00, 0x70, 0x66, 0x04, 0x31, 0x41]);
        b.extend(vy.to_be_bytes());
        b.extend([0x4E, 0x75]);
        // teto
        b.extend([0x0C, 0x68]);
        b.extend(cap.to_be_bytes());
        b.extend(vy.to_be_bytes());
        b.extend([0x6C, 0x06, 0x31, 0x7C]);
        b.extend(cap.to_be_bytes());
        b.extend(vy.to_be_bytes());
        b.extend([0x4E, 0x75]);
        b
    }

    fn rom_com(f: Vec<u8>) -> Vec<u8> {
        let mut r = [0x4E, 0x71].repeat(64);
        r.extend(f);
        r.extend([0x4E, 0x71].repeat(64));
        r
    }

    pub(super) fn base() -> Vec<u8> {
        rom_com(forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x0680, 0x0380, 0xFC00, 0xFE00, 0xF040,
        ))
    }

    #[test]
    fn localiza_por_assinatura_com_campos_de_objeto_diferentes_dos_do_sonic1() {
        let i = locate(&base());
        assert_eq!(i.len(), 1);
        let i = &i[0];
        assert_eq!(
            (
                i.status_off,
                i.vel_x_off,
                i.vel_y_off,
                i.jump_flag_off,
                i.held_ram
            ),
            (0x2A, 0x18, 0x1A, 0x40, 0xF66A)
        );
        let g = |n: &str| i.fields.iter().find(|f| f.name == n).unwrap().value;
        assert_eq!(
            (g("imp"), g("impw"), g("cut"), g("cutw"), g("cap")),
            (0x680, 0x380, -0x400, -0x200, -0xFC0)
        );
        assert!(i.cap_offset.is_some());
    }

    #[test]
    fn campos_inconsistentes_entre_as_partes_nao_formam_instancia() {
        // altura com outro offset de velocidade vertical: não pareia
        let mut f = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let k = f
            .windows(4)
            .position(|w| w == [0xB2, 0x68, 0x00, 0x1A])
            .unwrap();
        f[k + 3] = 0x1C;
        let so_impulso = |r: Vec<u8>| {
            let i = locate(&r);
            assert_eq!(i.len(), 1);
            assert!(i[0].height_offset.is_none() && i[0].fields.iter().all(|x| x.name != "cut"));
            assert_eq!(
                plan_edit(
                    &r,
                    i[0].jump_offset,
                    &JumpParams {
                        cut: Some(-0x300),
                        ..Default::default()
                    }
                ),
                Err(JumpError::FieldUnavailable)
            );
        };
        so_impulso(rom_com(f));
        // status diferente
        let mut g = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let k = g
            .windows(4)
            .rposition(|w| w == [0x08, 0x28, 0x00, 0x06])
            .unwrap();
        g[k + 5] = 0x2B;
        so_impulso(rom_com(g));
        assert!(locate(&[0u8; 100]).is_empty());
        assert!(locate(&[]).is_empty());
    }

    #[test]
    fn sem_teto_a_instancia_existe_mas_sem_o_campo_cap() {
        let mut f = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let k = f.windows(2).position(|w| w == [0x0C, 0x68]).unwrap();
        f.truncate(k);
        let i = locate(&rom_com(f));
        assert_eq!(i.len(), 1);
        assert!(i[0].fields.iter().all(|x| x.name != "cap"));
        assert_eq!(
            plan_edit(&rom_com(vec![]), 0, &JumpParams::default()),
            Err(JumpError::InstanceNotFound)
        );
    }

    #[test]
    fn edicao_gera_patches_sem_crescer_e_so_nos_imediatos() {
        let rom = base();
        let off = locate(&rom)[0].jump_offset;
        let p = plan_edit(
            &rom,
            off,
            &JumpParams {
                imp: Some(0x800),
                cap: Some(-0x1000),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(p.len(), 3); // imp + cap (2 lugares)
        let novo = apply(&rom, &p).unwrap();
        assert_eq!(novo.len(), rom.len());
        let diff: usize = rom.iter().zip(&novo).filter(|(a, b)| a != b).count();
        assert!(diff <= 6);
        let i = &locate(&novo)[0];
        assert_eq!(
            i.fields.iter().find(|f| f.name == "imp").unwrap().value,
            0x800
        );
        assert_eq!(
            i.fields.iter().find(|f| f.name == "cap").unwrap().value,
            -0x1000
        );
        assert_eq!(
            i.fields.iter().find(|f| f.name == "impw").unwrap().value,
            0x380
        ); // intacto
           // ROM original intacta
        assert_eq!(locate(&rom)[0].fields[0].value, 0x680);
    }

    #[test]
    fn recusas_faixa_no_op_e_bytes_obsoletos() {
        let rom = base();
        let off = locate(&rom)[0].jump_offset;
        for bad in [0, -5, 0x8000] {
            assert_eq!(
                plan_edit(
                    &rom,
                    off,
                    &JumpParams {
                        imp: Some(bad),
                        ..Default::default()
                    }
                ),
                Err(JumpError::OutOfRange)
            );
        }
        assert_eq!(
            plan_edit(
                &rom,
                off,
                &JumpParams {
                    cut: Some(1),
                    ..Default::default()
                }
            ),
            Err(JumpError::OutOfRange)
        );
        assert_eq!(
            plan_edit(
                &rom,
                off,
                &JumpParams {
                    cut: Some(-0x8000),
                    ..Default::default()
                }
            ),
            Err(JumpError::OutOfRange)
        );
        assert_eq!(
            plan_edit(
                &rom,
                off,
                &JumpParams {
                    imp: Some(0x680),
                    ..Default::default()
                }
            ),
            Err(JumpError::NoChange)
        );
        assert_eq!(
            plan_edit(&rom, off, &JumpParams::default()),
            Err(JumpError::NoChange)
        );
        assert_eq!(
            plan_edit(
                &rom,
                off + 2,
                &JumpParams {
                    imp: Some(0x700),
                    ..Default::default()
                }
            ),
            Err(JumpError::InstanceNotFound)
        );
        let p = plan_edit(
            &rom,
            off,
            &JumpParams {
                imp: Some(0x700),
                ..Default::default()
            },
        )
        .unwrap();
        let editada = apply(&rom, &p).unwrap();
        // aplicar o mesmo patch sobre a ROM já editada: bytes antigos não conferem
        assert_eq!(apply(&editada, &p), Err(JumpError::StaleBytes));
        assert_eq!(apply(&rom[..4], &p), Err(JumpError::StaleBytes));
    }

    #[test]
    fn ips_so_carrega_bytes_alterados_e_reproduz_a_edicao() {
        let rom = base();
        let off = locate(&rom)[0].jump_offset;
        let p = plan_edit(
            &rom,
            off,
            &JumpParams {
                cutw: Some(-0x300),
                ..Default::default()
            },
        )
        .unwrap();
        let ips = ips(&p).unwrap();
        assert_eq!(&ips[..5], b"PATCH");
        assert_eq!(&ips[ips.len() - 3..], b"EOF");
        assert_eq!(ips.len(), 5 + 5 + 2 + 3);
        // aplicação independente do IPS
        let mut out = rom.clone();
        let mut q = 5;
        while &ips[q..q + 3] != b"EOF" {
            let o = (usize::from(ips[q]) << 16)
                | (usize::from(ips[q + 1]) << 8)
                | usize::from(ips[q + 2]);
            let n = (usize::from(ips[q + 3]) << 8) | usize::from(ips[q + 4]);
            out[o..o + n].copy_from_slice(&ips[q + 5..q + 5 + n]);
            q += 5 + n;
        }
        assert_eq!(out, apply(&rom, &p).unwrap());
    }

    #[test]
    fn variante_super_expoe_imps_sem_duplicar_a_instancia() {
        let mut r = [0x4E, 0x71].repeat(64);
        r.extend([0x34, 0x3C, 0x06, 0x80, 0x4A, 0x38, 0xFE, 0x19, 0x67, 0x04]); // move.w #imp; tst.b sup; beq.s
        r.extend(forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x0800, 0x0380, 0xFC00, 0xFE00, 0xF040,
        ));
        r.extend([0x4E, 0x71].repeat(64));
        let i = locate(&r);
        assert_eq!(
            i.len(),
            1,
            "o padrão simples não pode contar de novo dentro do super"
        );
        let g = |n: &str| i[0].fields.iter().find(|f| f.name == n).map(|f| f.value);
        assert_eq!(
            (g("imp"), g("imps"), g("impw")),
            (Some(0x680), Some(0x800), Some(0x380))
        );
        let p = plan_edit(
            &r,
            i[0].jump_offset,
            &JumpParams {
                imp: Some(0x700),
                imps: Some(0x900),
                ..Default::default()
            },
        )
        .unwrap();
        let n = apply(&r, &p).unwrap();
        let j = &locate(&n)[0];
        assert_eq!(
            j.fields.iter().find(|f| f.name == "imp").unwrap().value,
            0x700
        );
        assert_eq!(
            j.fields.iter().find(|f| f.name == "imps").unwrap().value,
            0x900
        );
    }

    #[test]
    fn altura_com_desvio_de_palavra_tambem_e_reconhecida() {
        let mut f = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let k = f
            .windows(4)
            .position(|w| w == [0x6F, 0x0E, 0x10, 0x38])
            .unwrap();
        f.splice(k..k + 2, [0x6F, 0x00, 0x00, 0x0E]);
        let i = locate(&rom_com(f));
        assert_eq!(i.len(), 1);
        assert!(i[0].height_offset.is_some());
        assert!(
            i[0].fields.iter().any(|x| x.name == "cut")
                && i[0].fields.iter().any(|x| x.name == "cap")
        );
    }

    #[test]
    fn pareamento_so_se_mutuo_o_pulo_sem_altura_propria_nao_herda_a_do_vizinho() {
        let completo = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let fim_a = completo.windows(2).position(|w| w == [0x4E, 0x75]).unwrap() + 2;
        let so_pulo = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x7C0, 0x3C0, 0xFC00, 0xFE00, 0xF040,
        )[..fim_a]
            .to_vec();
        let mut r = [0x4E, 0x71].repeat(32);
        r.extend(&completo);
        r.extend([0x4E, 0x71].repeat(32));
        r.extend(&so_pulo); // 2º pulo, mais perto do fim; a altura mais próxima dele é a do 1º bloco
        r.extend([0x4E, 0x71].repeat(32));
        let i = locate(&r);
        assert_eq!(i.len(), 2);
        let (a, b) = (&i[0], &i[1]);
        assert!(a.height_offset.is_some() && a.fields.iter().any(|x| x.name == "cut"));
        assert!(
            b.height_offset.is_none()
                && b.fields.iter().all(|x| x.name != "cut" && x.name != "cap")
        );
        assert_eq!(
            b.fields.iter().find(|x| x.name == "imp").unwrap().value,
            0x7C0
        );
    }

    #[test]
    fn grafo_gerado_tem_um_no_editavel_por_campo_com_bytes_e_portas_validos() {
        let rom = base();
        let i = &locate(&rom)[0];
        let g: serde_json::Value = serde_json::from_str(&graph_json(&rom, i, "sha")).unwrap();
        let nodes = g["nodes"].as_array().unwrap();
        let edges = g["edges"].as_array().unwrap();
        // um nó editável por campo, com os offsets de ROM e a faixa do campo
        for f in &i.fields {
            let n = nodes
                .iter()
                .find(|n| n["params"]["campo"] == f.name.as_str())
                .unwrap_or_else(|| panic!("nó de {}", f.name));
            assert_eq!(n["params"]["value"], f.value);
            let want: Vec<String> = f.rom_offsets.iter().map(|o| format!("0x{o:06X}")).collect();
            assert_eq!(n["params"]["rom_offsets"], want.join(","));
            assert_eq!(n["params"]["faixa"], format!("{}..{}", f.min, f.max));
        }
        // bytes lidos da ROM, conferíveis
        for n in nodes {
            if let (Some(a), Some(b)) = (
                n["params"]["rom_addr"].as_str(),
                n["params"]["rom_bytes"].as_str(),
            ) {
                let a = usize::from_str_radix(&a[2..], 16).unwrap();
                let lido: String = rom[a..a + b.len() / 2]
                    .iter()
                    .map(|x| format!("{x:02x}"))
                    .collect();
                assert_eq!(lido, b, "{}", n["id"]);
            }
        }
        // toda aresta liga portas que existem
        for e in edges {
            let a = nodes.iter().find(|n| n["id"] == e["fromNode"]).unwrap();
            let b = nodes.iter().find(|n| n["id"] == e["toNode"]).unwrap();
            assert!(a["outputs"]
                .as_array()
                .unwrap()
                .iter()
                .any(|p| p["id"] == e["fromPort"]));
            assert!(b["inputs"]
                .as_array()
                .unwrap()
                .iter()
                .any(|p| p["id"] == e["toPort"]));
        }
        assert_eq!(g["rex_logic_recovery"]["descritivo"], true);
    }

    #[test]
    fn grafo_sem_altura_pareada_nao_tem_ramo_de_altura() {
        let completo = forma(
            0x2A, 0x18, 0x1A, 0x40, 0xF66A, 0x680, 0x380, 0xFC00, 0xFE00, 0xF040,
        );
        let fim_a = completo.windows(2).position(|w| w == [0x4E, 0x75]).unwrap() + 2;
        let rom = rom_com(completo[..fim_a].to_vec());
        let i = &locate(&rom)[0];
        let g: serde_json::Value = serde_json::from_str(&graph_json(&rom, i, "sha")).unwrap();
        let ids: Vec<&str> = g["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| n["id"].as_str().unwrap())
            .collect();
        assert!(ids.contains(&"imp") && !ids.contains(&"cut") && !ids.contains(&"jf"));
    }
    #[test]
    #[ignore = "BYOR: exige REX_SONIC_ROM (Sonic 1 pinada) e opcionalmente REX_DELTA_ROM; ausente = não executado"]
    fn byor_localiza_no_sonic1_e_no_delta() {
        let s1 = std::fs::read(std::env::var("REX_SONIC_ROM").expect("REX_SONIC_ROM")).unwrap();
        let i = locate(&s1);
        assert_eq!(i.len(), 1);
        assert_eq!(
            (i[0].jump_offset, i[0].height_offset, i[0].cap_offset),
            (0x1340C, Some(0x13498), Some(0x134C4))
        );
        assert_eq!(
            (
                i[0].status_off,
                i[0].vel_y_off,
                i[0].jump_flag_off,
                i[0].held_ram
            ),
            (0x22, 0x12, 0x3C, 0xF602)
        );
        let g = |n: &str| i[0].fields.iter().find(|f| f.name == n).unwrap().value;
        assert_eq!(
            (g("imp"), g("impw"), g("cut"), g("cutw"), g("cap")),
            (0x680, 0x380, -0x400, -0x200, -0xFC0)
        );
        if let Ok(dump) = std::env::var("REX_JUMP_DUMP") {
            let mut all = serde_json::json!({ "sonic1": i.clone() });
            if let Ok(p) = std::env::var("REX_DELTA_ROM") {
                all["delta"] = serde_json::to_value(locate(&std::fs::read(p).unwrap())).unwrap();
            }
            std::fs::write(dump, serde_json::to_string_pretty(&all).unwrap()).unwrap();
        }
        if let Ok(p) = std::env::var("REX_DELTA_ROM") {
            let d = std::fs::read(p).unwrap();
            let di = locate(&d);
            assert!(!di.is_empty());
            let a = di
                .iter()
                .find(|x| x.jump_offset == 0x1A170)
                .expect("instância em 0x1A170");
            assert_eq!(
                (a.status_off, a.vel_y_off, a.jump_flag_off, a.held_ram),
                (0x2A, 0x1A, 0x40, 0xF66A)
            );
        }
    }
    #[test]
    #[ignore = "BYOR: gera ROMs editadas em REX_JUMP_OUT para a verificação no core; exige REX_SONIC_ROM e REX_DELTA_ROM"]
    fn byor_gera_edicoes_para_verificacao_no_core() {
        let out = std::env::var("REX_JUMP_OUT").expect("REX_JUMP_OUT");
        let s1 = std::fs::read(std::env::var("REX_SONIC_ROM").expect("REX_SONIC_ROM")).unwrap();
        let d = std::fs::read(std::env::var("REX_DELTA_ROM").expect("REX_DELTA_ROM")).unwrap();
        let mut meta = Vec::new();
        let mut gerar = |nome: &str, rom: &[u8], off: usize, params: JumpParams| {
            let p = plan_edit(rom, off, &params).unwrap();
            let novo = apply(rom, &p).unwrap();
            assert_eq!(novo.len(), rom.len());
            std::fs::write(format!("{out}/{nome}.bin"), &novo).unwrap();
            std::fs::write(format!("{out}/{nome}.ips"), ips(&p).unwrap()).unwrap();
            meta.push(serde_json::json!({ "nome": nome, "jump_offset": off, "patches": p }));
        };
        gerar(
            "s1-imp-0900",
            &s1,
            0x1340C,
            JumpParams {
                imp: Some(0x900),
                ..Default::default()
            },
        );
        gerar(
            "s1-cut-0600",
            &s1,
            0x1340C,
            JumpParams {
                cut: Some(-0x600),
                ..Default::default()
            },
        );
        gerar(
            "s1-cap-0800",
            &s1,
            0x1340C,
            JumpParams {
                cap: Some(-0x800),
                ..Default::default()
            },
        );
        for (o, n) in [(0x16914usize, "a"), (0x1732A, "b"), (0x1A170, "c")] {
            gerar(
                &format!("delta-{n}-imp-0900"),
                &d,
                o,
                JumpParams {
                    imp: Some(0x900),
                    ..Default::default()
                },
            );
        }
        gerar(
            "delta-a-cut-0600",
            &d,
            0x16914,
            JumpParams {
                cut: Some(-0x600),
                ..Default::default()
            },
        );
        gerar(
            "delta-c-cut-0600",
            &d,
            0x1A170,
            JumpParams {
                cut: Some(-0x600),
                ..Default::default()
            },
        );
        for (nome, rom) in [("s1", &s1), ("delta", &d)] {
            let sha = super::super::rom_library::sha256_hex(rom);
            for i in locate(rom) {
                std::fs::write(
                    format!("{out}/grafo-{nome}-{:x}.nodegraph.json", i.jump_offset),
                    graph_json(rom, &i, &sha),
                )
                .unwrap();
            }
        }
        std::fs::write(
            format!("{out}/meta.json"),
            serde_json::to_string_pretty(&meta).unwrap(),
        )
        .unwrap();
    }
}

/// F1-1: o perfil em dado, interpretado pelo motor (`locate`), reproduz o código anterior
/// (`locate_reference`) em TODA a `JumpInstance`, inclusive as notas.
#[cfg(test)]
mod equivalencia {
    use super::*;
    use std::collections::HashMap;

    use super::super::rex_profile_spec::ProfileSpec;

    fn spec() -> ProfileSpec {
        engine()
            .expect("perfil em dado embutido e valido")
            .spec()
            .clone()
    }

    /// M5: o grafo que o motor projeta do DADO é igual ao do código antigo, descontadas só as chaves novas
    /// de vínculo no nó de entrada e nos metadados, e tem a MESMA assinatura estrutural (grafos salvos
    /// antes da migração continuam canônicos).
    fn grafo_igual(rom: &[u8], inst: &JumpInstance) {
        use serde_json::Value;
        let sha = "0".repeat(64);
        let mut novo: Value = serde_json::from_str(&graph_json(rom, inst, &sha)).unwrap();
        let velho: Value = serde_json::from_str(&graph_json_reference(rom, inst, &sha)).unwrap();
        assert_eq!(
            canonical_string(&novo),
            canonical_string(&velho),
            "forma canonica em {:#x}",
            inst.jump_offset
        );
        let ev = |g: &Value| {
            g["nodes"]
                .as_array()
                .unwrap()
                .iter()
                .find(|n| n["id"] == "ev")
                .unwrap()["params"]
                .clone()
        };
        assert_eq!(
            ev(&novo)["assinatura_estrutural"],
            ev(&velho)["assinatura_estrutural"],
            "assinatura estrutural em {:#x}",
            inst.jump_offset
        );
        assert_eq!(ev(&novo)["perfil_sha256"].as_str().map(str::len), Some(64));
        for n in novo["nodes"].as_array_mut().unwrap() {
            if n["id"] == "ev" {
                let p = n["params"].as_object_mut().unwrap();
                for k in ["perfil_sha256", "perfil_revisao", "instancia_param"] {
                    assert!(p.remove(k).is_some(), "chave de vinculo {k} ausente");
                }
            }
        }
        let meta = novo["rex_logic_recovery"].as_object_mut().unwrap();
        for k in ["profile_sha256", "profile_revision"] {
            assert!(meta.remove(k).is_some(), "metadado de vinculo {k} ausente");
        }
        assert_eq!(novo, velho, "grafo em {:#x}", inst.jump_offset);
    }

    /// Materializa um padrão do dado com valores de captura (a mesma captura repetida recebe o mesmo valor).
    fn instantiate(source: &str, vals: &HashMap<&str, u32>) -> Vec<u8> {
        let mut out = Vec::new();
        for tok in source.split_whitespace() {
            if let Some(inner) = tok.strip_prefix('{').and_then(|t| t.strip_suffix('}')) {
                let (name, n) = inner.split_once(':').unwrap();
                let n: usize = n.parse().unwrap();
                let v = if name == "_" { 0 } else { vals[name] };
                out.extend(&v.to_be_bytes()[4 - n..]);
            } else {
                out.push(u8::from_str_radix(tok, 16).unwrap());
            }
        }
        out
    }

    fn vals() -> HashMap<&'static str, u32> {
        HashMap::from([
            ("imp", 0x0680),
            ("imps", 0x0800),
            ("impw", 0x0380),
            ("st", 0x0022),
            ("vx", 0x0010),
            ("vy", 0x0012),
            ("sup", 0x0F00),
            ("ang", 0x0026),
            ("sin", 0x0000_29DA),
            ("flag", 0x003C),
            ("held", 0xF603),
            ("cut", 0xFC00),
            ("cutw", 0xFE00),
            ("cap", 0xFA00),
        ])
    }

    fn src(s: &ProfileSpec, id: &str, i: usize) -> String {
        s.patterns.iter().find(|p| p.id == id).unwrap().sources[i].clone()
    }

    fn igual(rom: &[u8]) -> Vec<JumpInstance> {
        let novo = locate(rom);
        assert_eq!(novo, locate_reference(rom));
        for i in &novo {
            grafo_igual(rom, i);
        }
        novo
    }

    #[test]
    fn perfil_embutido_valida_e_o_motor_sobe() {
        assert!(
            engine().is_some(),
            "o JSON embutido tem de ser valido e suportado"
        );
        assert_eq!(spec().id, PROFILE_ID);
    }

    #[test]
    fn rom_sintetica_e_rom_sem_instancia() {
        let r = jump_fixture();
        assert_eq!(igual(&r).len(), 1);
        assert!(igual(&vec![0u8; 4096]).is_empty());
        assert!(igual(&[]).is_empty());
    }

    fn jump_fixture() -> Vec<u8> {
        fixture_rom()
    }

    #[test]
    fn duas_instancias_forma_super_e_altura_nao_pareada() {
        let s = spec();
        let base = jump_fixture();
        let mut two = base.clone();
        two.extend(vec![0u8; 0x200]);
        two.extend(base.clone());
        assert_eq!(igual(&two).len(), 2);

        let v = vals();
        let mut sup = instantiate(&src(&s, "jump_super", 0), &v);
        sup.extend([0x4E, 0x75]);
        sup.extend(instantiate(&src(&s, "height", 0), &v));
        sup.extend([0x4E, 0x75]);
        sup.extend(instantiate(&src(&s, "cap", 0), &v));
        sup.extend([0x4E, 0x75]);
        let e = igual(&sup);
        assert_eq!(e.len(), 1);
        assert!(e[0].fields.iter().any(|f| f.name == "imps"));
        assert!(e[0].cap_offset.is_some());
        assert!(e[0].notes[0].contains("variante de forma super"));

        // a segunda forma de altura (desvio de palavra 6F 00 xxxx)
        let mut wide = instantiate(&src(&s, "jump_super", 0), &v);
        wide.extend([0x4E, 0x75]);
        wide.extend(instantiate(&src(&s, "height", 1), &v));
        wide.extend([0x4E, 0x75]);
        wide.extend(instantiate(&src(&s, "cap", 0), &v));
        assert_eq!(igual(&wide).len(), 1);

        // altura não pareada: st diferente => sem cut/cutw/cap
        let mut v2 = v.clone();
        let mut broken = instantiate(&src(&s, "jump_super", 0), &v);
        broken.extend([0x4E, 0x75]);
        v2.insert("st", 0x0044);
        broken.extend(instantiate(&src(&s, "height", 0), &v2));
        broken.extend([0x4E, 0x75]);
        let e = igual(&broken);
        assert_eq!(e.len(), 1);
        assert!(e[0].height_offset.is_none());
        assert!(e[0]
            .fields
            .iter()
            .all(|f| f.name != "cut" && f.name != "cap"));
        assert!(e[0].notes.iter().any(|n| n.contains("NÃO são oferecidos")));
    }

    #[test]
    fn pareamento_mutuo_e_ambiguidade_igual_ao_codigo_antigo() {
        // um pulo, duas alturas consistentes, uma delas mais próxima: o antigo e o motor escolhem igual
        let s = spec();
        let v = vals();
        let mut rom = instantiate(&src(&s, "jump", 0), &v);
        rom.extend([0x4E, 0x75]);
        rom.extend(instantiate(&src(&s, "height", 0), &v));
        rom.extend([0x4E, 0x75]);
        rom.extend(vec![0u8; 0x40]);
        rom.extend(instantiate(&src(&s, "height", 0), &v));
        rom.extend([0x4E, 0x75]);
        igual(&rom);
        // dois pulos disputando uma altura
        let mut rom2 = instantiate(&src(&s, "jump", 0), &v);
        rom2.extend([0x4E, 0x75]);
        rom2.extend(vec![0u8; 0x20]);
        rom2.extend(instantiate(&src(&s, "jump", 0), &v));
        rom2.extend([0x4E, 0x75]);
        rom2.extend(instantiate(&src(&s, "height", 0), &v));
        rom2.extend([0x4E, 0x75]);
        let e = igual(&rom2);
        assert_eq!(e.len(), 2);
        assert_eq!(
            e.iter().filter(|i| i.height_offset.is_some()).count(),
            1,
            "so o mutuamente mais proximo pareia"
        );
    }

    #[test]
    fn rom_curta_ou_truncada_no_meio_do_padrao() {
        let r = jump_fixture();
        for cut in [0usize, 1, 2, 7, 33, r.len() / 2, r.len() - 1] {
            igual(&r[..cut]);
        }
    }

    /// ROMs reais (BYOR, fora do Git): `RDS_INSPECTION_ROM` (Sonic 1) e `RDS_JUMP_DELTA_ROM` (Delta).
    /// `cargo test --lib equivalencia::roms_reais -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn roms_reais() {
        let mut vistos = 0;
        for var in ["RDS_INSPECTION_ROM", "RDS_JUMP_DELTA_ROM"] {
            let Ok(path) = std::env::var(var) else {
                continue;
            };
            let rom = std::fs::read(&path).expect("ROM legivel");
            let e = igual(&rom);
            println!(
                "{var}: {} instancia(s) iguais entre motor e codigo antigo",
                e.len()
            );
            assert!(!e.is_empty(), "{var}");
            vistos += 1;
        }
        assert!(
            vistos > 0,
            "defina RDS_INSPECTION_ROM e/ou RDS_JUMP_DELTA_ROM"
        );
    }

    /// I7: grafos de pulo SALVOS ANTES da migração (arquivos versionados, sem `perfil_sha256` nem
    /// `instancia_param`) continuam reabrindo: o motor os aceita pela estrutura contra a ROM real, deriva
    /// os valores e produz o mesmo patch do pedido direto.
    #[test]
    #[ignore = "BYOR: exige RDS_INSPECTION_ROM e/ou RDS_JUMP_DELTA_ROM"]
    fn grafos_salvos_antes_da_migracao_reabrem_nas_roms_reais() {
        use super::super::rom_library::sha256_hex;
        use serde_json::{json, Value};
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../data/rex_profiles/integration_20261007/grafos-gerados");
        let engine = engine().unwrap();
        let mut reabertos = 0;
        for var in ["RDS_INSPECTION_ROM", "RDS_JUMP_DELTA_ROM"] {
            let Ok(path) = std::env::var(var) else {
                continue;
            };
            let rom = std::fs::read(&path).expect("ROM legivel");
            let sha = sha256_hex(&rom);
            for entry in std::fs::read_dir(&dir).unwrap() {
                let file = entry.unwrap().path();
                let salvo = std::fs::read_to_string(&file).unwrap();
                let mut g: Value = serde_json::from_str(&salvo).unwrap();
                let ev = g["nodes"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|n| n["params"]["ponte_edicao"] == 1)
                    .unwrap()["params"]
                    .clone();
                if ev["rom_sha256"] != sha.as_str() {
                    continue;
                }
                assert!(
                    ev.get("perfil_sha256").is_none(),
                    "arquivo anterior ao vinculo"
                );
                let off = ev["jump_offset"].as_u64().unwrap() as usize;
                let r = graph::review_graph(engine, &rom, &sha, off, &salvo).unwrap();
                assert!(
                    r.structural_ok && r.problems.is_empty() && r.legacy_binding,
                    "{}: {r:?}",
                    file.display()
                );
                assert!(r.changes.is_empty());
                let imp = locate(&rom)
                    .into_iter()
                    .find(|i| i.jump_offset == off)
                    .unwrap()
                    .fields[0]
                    .value;
                for n in g["nodes"].as_array_mut().unwrap() {
                    if n["params"]["campo"] == "imp" {
                        n["params"]["value"] = json!(imp + 640);
                    }
                }
                let r = graph::review_graph(engine, &rom, &sha, off, &g.to_string()).unwrap();
                assert_eq!(r.changes, [("imp".to_string(), i64::from(imp + 640))]);
                let direto = plan_edit(
                    &rom,
                    off,
                    &JumpParams {
                        imp: Some(imp + 640),
                        ..Default::default()
                    },
                )
                .unwrap();
                assert_eq!(direto.len(), 1);
                assert_eq!(direto[0].new, ((imp + 640) as i16).to_be_bytes());
                println!("{var}: {} reaberto em {off:#x}", file.display());
                reabertos += 1;
            }
        }
        assert!(
            reabertos > 0,
            "nenhum grafo salvo corresponde as ROMs fornecidas"
        );
    }
}
