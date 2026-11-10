//! Apoio de TESTE dos módulos de perfil: um perfil mínimo AUTORAL (não descreve jogo algum), escrito em
//! JSON como qualquer perfil, e a ROM sintética que ele reconhece. Usa larguras, sinal e ordem de bytes
//! diferentes de imm16 com sinal, restrição entre capturas e regra de empate `refuse`.

use serde_json::Value;

use super::rex_profile_engine::Engine;
use super::rex_profile_spec::ProfileSpec;
use super::rom_library::sha256_hex;

pub(crate) const MINI_ID: &str = "m68k.mini_gate.v1";

const MINI_JSON: &str = r#"{
     "schema": "rex-profile-spec/v2", "id": "m68k.mini_gate.v1", "revision": 1, "status": "draft",
     "title": "Portão mínimo", "summary": "Perfil mínimo autoral para os testes do motor.", "artifact_tag": "mini",
     "arch": {"cpu": "m68k", "endianness": "big", "instruction_alignment": 2, "bus_address_bits": 24},
     "rom_mapping": {"kind": "linear", "file_header_bytes": 0, "bus_base": 0},
     "provenance": {"author": "teste", "created": "2026-10-09", "derived_from": ["rex_profile_testkit.rs"], "notes": ""},
     "rom_binding": {"mode": "signature"},
     "work_limits": {"max_rom_bytes": 65536, "max_matches_per_pattern": 8, "max_instances": 4},
     "captures": [
      {"name": "lim", "width": 2, "signed": true, "endianness": "big", "role": "immediate"},
      {"name": "obj", "width": 2, "signed": true, "endianness": "big", "role": "ea_displacement"},
      {"name": "low", "width": 1, "signed": false, "endianness": "big", "role": "immediate"},
      {"name": "top", "width": 4, "signed": false, "endianness": "little", "role": "immediate"},
      {"name": "ram", "width": 2, "signed": false, "endianness": "big", "role": "bus_address"}
     ],
     "patterns": [
      {"id": "a", "sources": ["30 3C {lim:2} 4A 6E {obj:2}"]},
      {"id": "b", "sources": ["12 3C 00 {low:1} B2 6E {obj:2}"]},
      {"id": "c", "sources": ["2D 7C {top:4} {obj:2} 4A 78 {ram:2}"]}
     ],
     "constraints": [
      {"kind": "range", "id": "obj_curto", "pattern": "a", "capture": "obj", "min": 0, "max": 255},
      {"kind": "multiple_of", "id": "obj_par", "pattern": "a", "capture": "obj", "modulo": 2}
     ],
     "relations": [
      {"kind": "pair", "id": "p", "from": ["a"], "to": "b", "consistent_on": ["obj"], "max_distance": 64, "mutual": true, "tie": "refuse"},
      {"kind": "follow", "id": "f", "from": "b", "to": "c", "consistent_on": ["obj"], "max_distance": 32, "tie": "refuse"}
     ],
     "fields": [
      {"name": "lim", "label": "Limite", "patterns": ["a"], "capture": "lim", "extra_offsets": [], "min": 1, "max": 1000, "requires": null},
      {"name": "low", "label": "Piso", "patterns": ["b"], "capture": "low", "extra_offsets": [], "min": 0, "max": 200, "requires": "p"},
      {"name": "top", "label": "Teto", "patterns": ["c"], "capture": "top", "extra_offsets": [], "min": 0, "max": 100000, "requires": "f"}
     ],
     "projection": {"entry_node": "ev", "instance_param": "gate_offset",
      "nodes": [
       {"id": "ev", "type": "event_update", "label": "Entrada", "col": 0, "row": 0, "params": [{"key": "rate", "value": "frame"}], "rom_span": {"base": "instance", "delta": 0, "len": 4}},
       {"id": "cmp", "type": "condition_compare", "label": "Objeto presente?", "col": 0, "row": 1,
        "params": [{"key": "operator", "value": "!="}, {"key": "b", "value": 0},
                   {"key": "descricao", "text": [{"p": "lit", "t": "campo +"}, {"p": "capture", "name": "obj", "of": "anchor", "fmt": "hex"}]}]},
       {"id": "n_lim", "type": "var_set", "label": "Limite", "col": 1, "row": 1, "field": {"name": "lim", "var_name": "limite", "description": "move.w #lim,d0"}, "rom_span": {"base": "field", "field": "lim", "delta": -2, "len": 4}},
       {"id": "n_low", "type": "var_set", "label": "Piso", "col": 2, "row": 1, "when": [{"if": "field", "name": "low"}], "field": {"name": "low", "var_name": "piso", "description": "move.b #low,d1"}},
       {"id": "n_top", "type": "var_set", "label": "Teto", "col": 3, "row": 1, "when": [{"if": "link", "id": "f"}, {"if": "field", "name": "top"}], "field": {"name": "top", "var_name": "teto", "description": "move.l #top,(obj,a6)"}, "rom_span": {"base": "link", "link": "f", "delta": 0, "len": 8}}
      ],
      "edges": [
       {"from": ["ev", "exec"], "to": ["cmp", "exec"]},
       {"from": ["cmp", "true"], "to": ["n_lim", "exec"]},
       {"from": ["n_lim", "exec"], "to": ["n_low", "exec"], "when": [{"if": "field", "name": "low"}]},
       {"from": ["n_low", "exec"], "to": ["n_top", "exec"], "when": [{"if": "link", "id": "f"}, {"if": "field", "name": "top"}]}
      ]},
     "notes": [
      {"text": [{"p": "lit", "t": "portão em "}, {"p": "offset", "of": "instance", "fmt": "hex"}]},
      {"when": [{"if": "no_link", "id": "p"}], "text": [{"p": "lit", "t": "sem par: só o limite é oferecido"}]}
     ],
     "details": [{"label": "objeto", "text": [{"p": "lit", "t": "+"}, {"p": "capture", "name": "obj", "of": "anchor", "fmt": "hex_bare"}]}],
     "evidence": {"claims": [], "unknown": ["nenhum efeito medido; nenhum consumo observado"]},
     "limits": ["perfil autoral de teste: só forma e consistência"]
    }"#;

pub(crate) fn mini() -> Value {
    serde_json::from_str(MINI_JSON).expect("JSON do perfil de teste")
}

/// O perfil mínimo após `f` mexer no JSON.
pub(crate) fn mini_with(f: impl FnOnce(&mut Value)) -> Value {
    let mut v = mini();
    f(&mut v);
    v
}

pub(crate) fn text(v: &Value) -> String {
    serde_json::to_string_pretty(v).unwrap()
}

pub(crate) fn engine_of(v: &Value) -> Engine {
    let t = text(v);
    Engine::new(
        ProfileSpec::from_json(&t).expect("perfil de teste valido"),
        &sha256_hex(t.as_bytes()),
    )
    .unwrap()
}

pub(crate) fn put(rom: &mut [u8], at: usize, bytes: &[u8]) {
    rom[at..at + bytes.len()].copy_from_slice(bytes);
}

pub(crate) const A1: usize = 0x40;
pub(crate) const B1: usize = 0x60;
pub(crate) const C1: usize = 0x70;
pub(crate) const A2: usize = 0x100;

pub(crate) fn pat_a(lim: i16, obj: u16) -> Vec<u8> {
    let mut v = vec![0x30, 0x3C];
    v.extend(lim.to_be_bytes());
    v.extend([0x4A, 0x6E]);
    v.extend(obj.to_be_bytes());
    v
}

pub(crate) fn pat_b(low: u8, obj: u16) -> Vec<u8> {
    let mut v = vec![0x12, 0x3C, 0x00, low, 0xB2, 0x6E];
    v.extend(obj.to_be_bytes());
    v
}

pub(crate) fn pat_c(top: u32, obj: u16, ram: u16) -> Vec<u8> {
    let mut v = vec![0x2D, 0x7C];
    v.extend(top.to_le_bytes());
    v.extend(obj.to_be_bytes());
    v.extend([0x4A, 0x78]);
    v.extend(ram.to_be_bytes());
    v
}

/// Duas instâncias: uma completa (`A1` ↔ `B1` → `C1`, objeto +0x10) e uma só com a âncora (`A2`, +0x20).
/// O resto da ROM é um padrão determinístico não nulo, para provar preservação fora do escopo.
pub(crate) fn mini_rom() -> Vec<u8> {
    let mut rom: Vec<u8> = (0..0x200u32).map(|i| (i * 7 + 3) as u8 | 0x80).collect();
    put(&mut rom, A1, &pat_a(300, 0x10));
    put(&mut rom, B1, &pat_b(80, 0x10));
    put(&mut rom, C1, &pat_c(100_000, 0x10, 0xF602));
    put(&mut rom, A2, &pat_a(5, 0x20));
    rom
}

/// Imagem de ROM montada a partir de um trecho hex do crate `rex-gameplay` (fixtures autorais dele).
pub(crate) fn crate_fixture(name: &str) -> Vec<u8> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../crates/rex-gameplay/fixtures")
        .join(name);
    let text = std::fs::read_to_string(path).expect("fixture do crate");
    let mut image = Vec::new();
    for line in text.lines().filter(|l| !l.starts_with('#')) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        match parts[0] {
            "rom_size" => image = vec![0u8; parts[1].parse().unwrap()],
            "at" => {
                let at = usize::from_str_radix(parts[1].trim_start_matches("0x"), 16).unwrap();
                for (i, k) in (0..parts[2].len()).step_by(2).enumerate() {
                    image[at + i] = u8::from_str_radix(&parts[2][k..k + 2], 16).unwrap();
                }
            }
            _ => {}
        }
    }
    image
}

/// A variante autoral executável da classe semântica (gerada por `make-authored-counter-gate.py`).
pub(crate) fn authored_gate_rom() -> Vec<u8> {
    std::fs::read(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../data/rex_profiles/authoring/counter_gate/rom-autoral-counter-gate.bin"),
    )
    .expect("ROM autoral da classe semantica")
}
