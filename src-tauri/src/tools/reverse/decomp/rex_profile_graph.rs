//! Projeção de uma instância de perfil para o NodeGraph v1 do editor e revisão do grafo de volta.
//!
//! A projeção vem do DADO (`ProfileSpec::projection`): nós de tipos já existentes, parâmetros literais ou
//! textos de partes tipadas, um nó `var_set` por campo editável. Nada além do que as capturas provam entra
//! no grafo. O grafo é descritivo: editar um valor nele não altera a ROM; a ROM só muda pelo plano de edição.
//!
//! A revisão NÃO confia no cliente: reconstrói o grafo canônico da ROM e compara. Só valores de nós
//! editáveis, posição, rótulo e os parâmetros de vínculo da sessão podem diferir.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use super::rex_edit::FieldEnc;
use super::rex_profile_engine::{Engine, EngineError, EngineInstance, ProfileError};
use super::rex_profile_spec::{node_ports, Port, RomSpan, Scalar, SpecError};

/// Marca do nó de entrada (ponte de edição).
pub const BRIDGE_PARAM: &str = "ponte_edicao";
/// Parâmetros do nó de entrada que NÃO fazem parte da estrutura canônica: vínculo de sessão. A identidade
/// que eles carregam é conferida explicitamente na revisão, não pela assinatura.
pub const BINDING_PARAMS: [&str; 6] = [
    "rom_path",
    "assinatura_estrutural",
    "perfil_sha256",
    "perfil_revisao",
    "perfil_dir",
    "instancia_param",
];

fn hex_off(o: usize) -> String {
    format!("0x{o:06X}")
}

fn io(ports: &[Port]) -> Vec<Value> {
    ports
        .iter()
        .map(|(id, kind, dt)| match dt {
            Some(d) => json!({"id": id, "label": id, "kind": kind, "dataType": d}),
            None => json!({"id": id, "label": id, "kind": kind}),
        })
        .collect()
}

fn inconsistent(at: String) -> EngineError {
    EngineError::Spec(SpecError::Invalid {
        rule: "projection-inconsistent",
        at,
    })
}

/// NodeGraph v1 (formato do editor) da instância, segundo a projeção declarada no perfil.
pub fn graph_json(
    engine: &Engine,
    rom: &[u8],
    inst: &EngineInstance,
    rom_sha256: &str,
) -> Result<String, EngineError> {
    let spec = engine.spec();
    let pr = &spec.projection;
    let mut nodes: Vec<Value> = Vec::new();
    let mut edges: Vec<Value> = Vec::new();
    let field = |name: &str| inst.fields.iter().find(|f| f.name == name);
    for n in pr.nodes.iter().filter(|n| engine.holds(&n.when, inst)) {
        let mut params: Map<String, Value> = Map::new();
        if let Some(nf) = &n.field {
            let f = field(&nf.name).ok_or_else(|| {
                inconsistent(format!("nó '{}': campo '{}' ausente", n.id, nf.name))
            })?;
            params.insert("var_name".into(), json!(nf.var_name));
            params.insert("value".into(), json!(f.value));
            params.insert("valor_original".into(), json!(f.value));
            params.insert("descricao".into(), json!(nf.description));
            params.insert("editavel".into(), json!(1));
            params.insert("campo".into(), json!(nf.name));
            params.insert("faixa".into(), json!(format!("{}..{}", f.min, f.max)));
            params.insert(
                "rom_offsets".into(),
                json!(f
                    .rom_offsets
                    .iter()
                    .map(|o| hex_off(*o))
                    .collect::<Vec<_>>()
                    .join(",")),
            );
        }
        for p in &n.params {
            let v = match (&p.value, &p.text) {
                (Some(Scalar::Int(i)), _) => json!(i),
                (Some(Scalar::Str(s)), _) => json!(s),
                (None, Some(parts)) => json!(engine.render(rom, parts, inst)),
                (None, None) => Value::Null,
            };
            params.insert(p.key.clone(), v);
        }
        if n.id == pr.entry_node {
            params.insert("perfil".into(), json!(spec.id));
            params.insert("rom_sha256".into(), json!(rom_sha256));
            params.insert(pr.instance_param.clone(), json!(inst.anchor_offset));
            params.insert(BRIDGE_PARAM.into(), json!(1));
            params.insert("perfil_sha256".into(), json!(engine.profile_sha256()));
            params.insert("perfil_revisao".into(), json!(spec.revision));
            params.insert("instancia_param".into(), json!(pr.instance_param));
        }
        params.insert(
            "origem".into(),
            json!(format!("recuperado do ROM (perfil {})", spec.id)),
        );
        let span = match &n.rom_span {
            None => None,
            Some(RomSpan::Instance { delta, len }) => Some((inst.anchor_offset, *delta, *len)),
            Some(RomSpan::Field {
                field: name,
                delta,
                len,
            }) => field(name).map(|f| (f.rom_offsets[0], *delta, *len)),
            Some(RomSpan::Link { link, delta, len }) => {
                inst.links.get(link).map(|m| (m.offset, *delta, *len))
            }
        };
        if let Some((base, delta, len)) = span {
            if let Some(a) = (base as i64)
                .checked_add(delta)
                .and_then(|a| usize::try_from(a).ok())
            {
                params.insert("rom_addr".into(), json!(hex_off(a)));
                params.insert(
                    "rom_bytes".into(),
                    json!(rom
                        .get(a..a.saturating_add(len))
                        .map(|b| b.iter().map(|x| format!("{x:02x}")).collect::<String>())
                        .unwrap_or_default()),
                );
            }
        }
        let (i, o) = node_ports(&n.node_type)
            .ok_or_else(|| inconsistent(format!("nó '{}': tipo sem portas", n.id)))?;
        nodes.push(json!({
            "id": n.id, "type": n.node_type, "label": n.label,
            "x": 40 + 330 * n.col, "y": 40 + 190 * n.row,
            "inputs": io(i), "outputs": io(o), "params": Value::Object(params)
        }));
    }
    let present = |id: &str| nodes.iter().any(|n| n["id"] == id);
    for e in pr.edges.iter().filter(|e| engine.holds(&e.when, inst)) {
        if !present(&e.from.0) || !present(&e.to.0) {
            return Err(inconsistent(format!(
                "aresta {}>{}: nó ausente nesta instância",
                e.from.0, e.to.0
            )));
        }
        let id = format!("e{}", edges.len() + 1);
        edges.push(json!({"id": id, "fromNode": e.from.0, "fromPort": e.from.1, "toNode": e.to.0, "toPort": e.to.1}));
    }
    // Assinatura estrutural: o que é CANÔNICO (topologia, tipos, portas, parâmetros de origem). Valores dos
    // nós editáveis, posições, rótulos e o vínculo de sessão ficam fora: são o que o usuário pode mexer.
    let assinatura = canonical_signature(&json!({"nodes": nodes, "edges": edges}));
    if let Some(ev) = nodes.iter_mut().find(|n| n["id"] == pr.entry_node.as_str()) {
        ev["params"]["assinatura_estrutural"] = json!(assinatura);
    }
    let mut meta = Map::new();
    meta.insert("profile_id".into(), json!(spec.id));
    meta.insert("profile_sha256".into(), json!(engine.profile_sha256()));
    meta.insert("profile_revision".into(), json!(spec.revision));
    meta.insert("rom_sha256".into(), json!(rom_sha256));
    meta.insert(
        pr.instance_param.clone(),
        json!(hex_off(inst.anchor_offset)),
    );
    meta.insert("descritivo".into(), json!(true));
    meta.insert(
        "aviso".into(),
        json!("Grafo descritivo. Alterar valores aqui nao altera a ROM; a ROM so muda pelo plano de edicao (patch sem crescimento)."),
    );
    meta.insert(
        "campos_editaveis".into(),
        json!(inst
            .fields
            .iter()
            .map(|f| f.name.clone())
            .collect::<Vec<_>>()),
    );
    Ok(serde_json::to_string_pretty(
        &json!({"version": 1, "nodes": nodes, "edges": edges, "rex_logic_recovery": Value::Object(meta)}),
    )
    .unwrap_or_default())
}

fn fnv1a64_hex(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{h:016x}")
}

fn is_editable_node(n: &Value) -> bool {
    n["params"]["editavel"] == 1
}

/// Nome do parâmetro que guarda o valor editável de um nó (`campo_param`; por omissão `value`).
pub fn value_param(n: &Value) -> &str {
    n["params"]["campo_param"].as_str().unwrap_or("value")
}

fn is_bridge_node(n: &Value) -> bool {
    n["params"][BRIDGE_PARAM] == 1
}

fn ports_canon(v: &Value) -> String {
    v.as_array()
        .map(|a| {
            a.iter()
                .map(|p| {
                    format!(
                        "{}:{}:{}",
                        p["id"].as_str().unwrap_or(""),
                        p["kind"].as_str().unwrap_or(""),
                        p["dataType"].as_str().unwrap_or("")
                    )
                })
                .collect::<Vec<_>>()
                .join(",")
        })
        .unwrap_or_default()
}

/// Forma canônica de UM nó: tipo, portas e parâmetros de origem.
fn node_canon(n: &Value) -> String {
    let editable = is_editable_node(n);
    let bridge = is_bridge_node(n);
    let mut kv: Vec<String> = n["params"]
        .as_object()
        .map(|m| {
            m.iter()
                .filter(|(k, _)| {
                    !(editable && k.as_str() == value_param(n))
                        && !(bridge && BINDING_PARAMS.contains(&k.as_str()))
                })
                .map(|(k, v)| format!("{k}={v}"))
                .collect()
        })
        .unwrap_or_default();
    kv.sort();
    format!(
        "N|{}|{}|in:{}|out:{}|{}",
        n["id"].as_str().unwrap_or(""),
        n["type"].as_str().unwrap_or(""),
        ports_canon(&n["inputs"]),
        ports_canon(&n["outputs"]),
        kv.join(";")
    )
}

fn edge_canon(e: &Value) -> String {
    format!(
        "E|{}.{}>{}.{}",
        e["fromNode"].as_str().unwrap_or(""),
        e["fromPort"].as_str().unwrap_or(""),
        e["toNode"].as_str().unwrap_or(""),
        e["toPort"].as_str().unwrap_or("")
    )
}

/// Texto canônico do grafo: nós e arestas ordenados; exclui valores editáveis, posições, rótulos,
/// `pinned`, ids de aresta e o vínculo de sessão. Qualquer diferença aqui é mudança de LÓGICA.
pub fn canonical_string(g: &Value) -> String {
    let mut lines: Vec<String> = g["nodes"]
        .as_array()
        .map(|a| a.iter().map(node_canon).collect())
        .unwrap_or_default();
    lines.sort();
    let mut edges: Vec<String> = g["edges"]
        .as_array()
        .map(|a| a.iter().map(edge_canon).collect())
        .unwrap_or_default();
    edges.sort();
    lines.extend(edges);
    lines.join("\n")
}

pub fn canonical_signature(g: &Value) -> String {
    fnv1a64_hex(&canonical_string(g))
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphReview {
    /// Topologia, origem e metadados de origem iguais ao canônico reconstruído da ROM.
    pub structural_ok: bool,
    /// Diferenças estruturais (nó removido/novo, aresta mudada, origem/campo alterado, identidade).
    pub differences: Vec<String>,
    /// Problemas de VALOR (duplicado, não inteiro, fora do domínio): impedem a edição sem serem "mudança de lógica".
    pub problems: Vec<String>,
    /// Mudanças de valor derivadas do grafo contra os valores REAIS da ROM (nunca do `valor_original` do
    /// cliente), na ordem dos campos do perfil.
    pub changes: Vec<(String, i64)>,
    /// O grafo não traz o SHA-256 do perfil (gravado antes do vínculo por hash): aceito, mas avisado.
    pub legacy_binding: bool,
}

impl GraphReview {
    pub fn accepted(&self) -> bool {
        self.structural_ok && self.problems.is_empty() && !self.changes.is_empty()
    }
}

/// SHA-256 do perfil declarado no nó de entrada de um grafo, se houver.
pub fn declared_profile_sha256(graph: &Value) -> Option<String> {
    graph["nodes"]
        .as_array()?
        .iter()
        .find(|n| is_bridge_node(n))?["params"]["perfil_sha256"]
        .as_str()
        .map(str::to_string)
}

/// Revisão do grafo enviado pelo frontend contra o canônico RECONSTRUÍDO DA ROM (não confia em metadados
/// do cliente): perfil, instância, identidade, nós, arestas, campos e valores originais vêm da ROM.
pub fn review_graph(
    engine: &Engine,
    rom: &[u8],
    rom_sha256: &str,
    instance_offset: usize,
    current_json: &str,
) -> Result<GraphReview, ProfileError> {
    let diverges = |m: &str| ProfileError::GraphDiverges(vec![m.to_string()]);
    let cur: Value =
        serde_json::from_str(current_json).map_err(|_| diverges("o grafo não é JSON válido"))?;
    let mut review = GraphReview::default();
    let r = &mut review;
    // o perfil carregado tem de ser o que gerou o grafo: hash diferente é outro dado, não "mudança de lógica"
    match declared_profile_sha256(&cur) {
        Some(h) if h != engine.profile_sha256() => {
            return Err(ProfileError::ProfileMismatch {
                expected: h,
                loaded: engine.profile_sha256().to_string(),
            })
        }
        Some(_) => {}
        None => r.legacy_binding = true,
    }
    let inst = engine.instance_at(rom, rom_sha256, instance_offset)?;
    let canon: Value = serde_json::from_str(
        &graph_json(engine, rom, &inst, rom_sha256).map_err(ProfileError::from)?,
    )
    .map_err(|_| diverges("grafo canônico inválido"))?;
    let fields: Vec<ReviewField> = inst
        .fields
        .iter()
        .map(|f| ReviewField {
            name: f.name.clone(),
            value: f.value,
            min: f.min,
            max: f.max,
            enc: Some(f.enc),
        })
        .collect();
    review_against(
        r,
        &canon,
        &cur,
        &ReviewIdentity {
            profile_id: &engine.spec().id,
            rom_sha256,
            instance_param: &engine.spec().projection.instance_param,
            instance_offset,
        },
        &fields,
    );
    Ok(review)
}

/// Campo editável como a ROM o tem agora (a referência da revisão).
pub struct ReviewField {
    pub name: String,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    /// Codificação no arquivo, quando o valor é gravado tal qual (`None`: a classe valida por conta própria).
    pub enc: Option<FieldEnc>,
}

pub struct ReviewIdentity<'a> {
    pub profile_id: &'a str,
    pub rom_sha256: &'a str,
    pub instance_param: &'a str,
    pub instance_offset: usize,
}

/// Núcleo da revisão, comum a todas as classes: compara o grafo do cliente com o CANÔNICO re-derivado da
/// ROM (nós, conexões, identidade) e deriva as mudanças de valor contra os valores reais.
pub fn review_against(
    r: &mut GraphReview,
    canon: &Value,
    cur: &Value,
    id: &ReviewIdentity<'_>,
    fields: &[ReviewField],
) {
    let empty = Vec::new();
    let cn = canon["nodes"].as_array().unwrap_or(&empty);
    let un = cur["nodes"].as_array().unwrap_or(&empty);
    for c in cn {
        match un.iter().find(|u| u["id"] == c["id"]) {
            None => r
                .differences
                .push(format!("nó removido: {}", c["id"].as_str().unwrap_or("?"))),
            Some(u) => {
                if node_canon(u) != node_canon(c) {
                    r.differences.push(format!(
                        "nó alterado (tipo, portas ou origem): {}",
                        c["id"].as_str().unwrap_or("?")
                    ));
                }
            }
        }
    }
    for u in un {
        if !cn.iter().any(|c| c["id"] == u["id"]) {
            r.differences
                .push(format!("nó novo: {}", u["id"].as_str().unwrap_or("?")));
        }
    }
    let mut ce: Vec<String> = canon["edges"]
        .as_array()
        .unwrap_or(&empty)
        .iter()
        .map(edge_canon)
        .collect();
    let mut ue: Vec<String> = cur["edges"]
        .as_array()
        .unwrap_or(&empty)
        .iter()
        .map(edge_canon)
        .collect();
    ce.sort();
    ue.sort();
    for e in &ce {
        if !ue.contains(e) {
            r.differences.push(format!("conexão removida: {}", &e[2..]));
        }
    }
    for e in &ue {
        if !ce.contains(e) {
            r.differences.push(format!("conexão nova: {}", &e[2..]));
        }
    }
    // identidade declarada no nó de entrada: perfil, ROM e instância têm de ser os da localização
    if let Some(ev) = un.iter().find(|u| is_bridge_node(u)) {
        let p = &ev["params"];
        if p["perfil"] != id.profile_id
            || p["rom_sha256"] != id.rom_sha256
            || p[id.instance_param] != id.instance_offset
        {
            r.differences.push(
                "identidade do grafo (perfil, ROM ou instância) difere da localização".to_string(),
            );
        }
    }
    // valores: por campo, UM nó; o original é o da ROM
    let mut seen: Vec<String> = Vec::new();
    let mut wanted: Vec<(String, i64)> = Vec::new();
    for u in un.iter().filter(|u| is_editable_node(u)) {
        let campo = u["params"]["campo"].as_str().unwrap_or("").to_string();
        let Some(f) = fields.iter().find(|f| f.name == campo) else {
            continue;
        };
        if seen.contains(&campo) {
            r.problems
                .push(format!("campo duplicado: {campo} aparece em mais de um nó"));
            continue;
        }
        seen.push(campo.clone());
        let val = match &u["params"][value_param(u)] {
            Value::Number(n) => n.as_i64(),
            Value::String(t) => t.trim().parse::<i64>().ok(),
            _ => None,
        };
        let Some(val) = val else {
            r.problems.push(format!("valor não inteiro em {campo}"));
            continue;
        };
        if val < f.min || val > f.max || f.enc.is_some_and(|e| e.encode(val).is_none()) {
            r.problems.push(format!(
                "valor de {campo} fora da faixa {}..{}",
                f.min, f.max
            ));
            continue;
        }
        if val != f.value {
            wanted.push((campo, val));
        }
    }
    r.changes = fields
        .iter()
        .filter_map(|f| wanted.iter().find(|(n, _)| *n == f.name).cloned())
        .collect();
    r.structural_ok = r.differences.is_empty();
}

#[cfg(test)]
mod tests {
    use super::super::rex_profile_testkit::*;
    use super::super::rom_library::sha256_hex;
    use super::*;

    struct Ctx {
        engine: Engine,
        rom: Vec<u8>,
        sha: String,
    }

    fn ctx() -> Ctx {
        let rom = mini_rom();
        Ctx {
            engine: engine_of(&mini()),
            sha: sha256_hex(&rom),
            rom,
        }
    }

    impl Ctx {
        fn graph(&self, at: usize) -> Value {
            let inst = self.engine.instance_at(&self.rom, &self.sha, at).unwrap();
            serde_json::from_str(&graph_json(&self.engine, &self.rom, &inst, &self.sha).unwrap())
                .unwrap()
        }
        fn review(&self, g: &Value) -> Result<GraphReview, ProfileError> {
            review_graph(&self.engine, &self.rom, &self.sha, A1, &g.to_string())
        }
    }

    fn node<'a>(g: &'a mut Value, id: &str) -> &'a mut Value {
        g["nodes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|n| n["id"] == id)
            .unwrap_or_else(|| panic!("nó {id}"))
    }

    #[test]
    fn projecao_usa_so_o_que_a_instancia_tem() {
        let c = ctx();
        let ids = |g: &Value| -> Vec<String> {
            g["nodes"]
                .as_array()
                .unwrap()
                .iter()
                .map(|n| n["id"].as_str().unwrap().to_string())
                .collect()
        };
        let full = c.graph(A1);
        assert_eq!(ids(&full), ["ev", "cmp", "n_lim", "n_low", "n_top"]);
        assert_eq!(full["edges"].as_array().unwrap().len(), 4);
        // a instância sem par não ganha nós nem conexões dos campos que não tem
        let lone = c.graph(A2);
        assert_eq!(ids(&lone), ["ev", "cmp", "n_lim"]);
        assert_eq!(lone["edges"].as_array().unwrap().len(), 2);
        let mut g = full.clone();
        let ev = node(&mut g, "ev")["params"].clone();
        assert_eq!(ev["perfil"], MINI_ID);
        assert_eq!(ev["rom_sha256"], c.sha.as_str());
        assert_eq!(ev["gate_offset"], A1);
        assert_eq!(ev["instancia_param"], "gate_offset");
        assert_eq!(ev["perfil_sha256"], c.engine.profile_sha256());
        assert_eq!(ev["rom_addr"], "0x000040");
        assert_eq!(ev["rom_bytes"], "303c012c");
        let top = node(&mut g, "n_top")["params"].clone();
        assert_eq!(
            (top["value"].clone(), top["valor_original"].clone()),
            (json!(100_000), json!(100_000))
        );
        assert_eq!(top["faixa"], "0..100000");
        assert_eq!(top["rom_offsets"], "0x000072");
        assert_eq!(top["campo"], "top");
        assert_eq!(node(&mut g, "cmp")["params"]["descricao"], "campo +0x10");
        assert_eq!(full["rex_logic_recovery"]["gate_offset"], "0x000040");
        assert_eq!(
            full["rex_logic_recovery"]["campos_editaveis"],
            json!(["lim", "low", "top"])
        );
    }

    #[test]
    fn posicao_rotulo_e_vinculo_de_sessao_nao_sao_estrutura() {
        let c = ctx();
        let canon = c.graph(A1);
        let mut g = canon.clone();
        node(&mut g, "n_lim")["x"] = json!(9999);
        node(&mut g, "n_lim")["label"] = json!("renomeado");
        node(&mut g, "n_lim")["pinned"] = json!(true);
        node(&mut g, "ev")["params"]["rom_path"] = json!("/outra/pasta/rom.bin");
        node(&mut g, "ev")["params"]["perfil_dir"] = json!("/perfis");
        g["edges"][0]["id"] = json!("zz");
        assert_eq!(canonical_signature(&g), canonical_signature(&canon));
        let r = c.review(&g).unwrap();
        assert!(
            r.structural_ok && r.changes.is_empty() && !r.legacy_binding,
            "{r:?}"
        );
    }

    #[test]
    fn valores_vem_da_rom_e_saem_na_ordem_do_perfil() {
        let c = ctx();
        let mut g = c.graph(A1);
        node(&mut g, "n_top")["params"]["value"] = json!(7);
        node(&mut g, "n_lim")["params"]["value"] = json!("450"); // texto numérico vindo do campo do canvas
                                                                 // o cliente mente sobre o original: é ignorado, o original é o da ROM
        node(&mut g, "n_lim")["params"]["valor_original"] = json!(450);
        let r = c.review(&g).unwrap();
        assert!(
            !r.structural_ok,
            "valor_original adulterado é metadado de origem alterado"
        );
        let mut g = c.graph(A1);
        node(&mut g, "n_top")["params"]["value"] = json!(7);
        node(&mut g, "n_lim")["params"]["value"] = json!("450");
        let r = c.review(&g).unwrap();
        assert!(r.accepted());
        assert_eq!(
            r.changes,
            [("lim".to_string(), 450), ("top".to_string(), 7)]
        );
    }

    #[test]
    fn grafo_adulterado_nao_e_aceito() {
        let c = ctx();
        let canon = c.graph(A1);
        let refused = |name: &str, f: &dyn Fn(&mut Value)| {
            let mut g = canon.clone();
            node(&mut g, "n_lim")["params"]["value"] = json!(400);
            f(&mut g);
            let r = c.review(&g).unwrap_or_else(|e| panic!("{name}: {e:?}"));
            assert!(!r.accepted(), "{name}: aceito indevidamente");
            (r.differences, r.problems)
        };
        let (d, _) = refused("nó removido", &|g| {
            g["nodes"]
                .as_array_mut()
                .unwrap()
                .retain(|n| n["id"] != "cmp")
        });
        assert!(d.iter().any(|x| x == "nó removido: cmp"), "{d:?}");
        let (d, _) = refused("nó novo", &|g| {
            let mut n = g["nodes"][1].clone();
            n["id"] = json!("extra");
            g["nodes"].as_array_mut().unwrap().push(n);
        });
        assert!(d.iter().any(|x| x == "nó novo: extra"));
        let (d, _) = refused("conexão removida", &|g| {
            g["edges"].as_array_mut().unwrap().remove(1);
        });
        assert!(d.iter().any(|x| x.starts_with("conexão removida")));
        let (d, _) = refused("conexão trocada", &|g| {
            g["edges"][1]["fromPort"] = json!("false")
        });
        assert!(
            d.iter().any(|x| x.starts_with("conexão nova"))
                && d.iter().any(|x| x.starts_with("conexão removida"))
        );
        let (d, _) = refused("campo trocado", &|g| {
            node(g, "n_low")["params"]["campo"] = json!("lim")
        });
        assert!(d.iter().any(|x| x.contains("n_low")));
        refused("offsets trocados", &|g| {
            node(g, "n_lim")["params"]["rom_offsets"] = json!("0x000000")
        });
        refused("faixa alargada", &|g| {
            node(g, "n_lim")["params"]["faixa"] = json!("-9..99999")
        });
        refused("tipo trocado", &|g| {
            node(g, "cmp")["type"] = json!("var_set")
        });
        refused("porta nova", &|g| {
            node(g, "cmp")["outputs"]
                .as_array_mut()
                .unwrap()
                .push(json!({"id": "x", "kind": "exec"}))
        });
        refused("origem trocada", &|g| {
            node(g, "cmp")["params"]["origem"] = json!("inventado")
        });
        let (d, _) = refused("ROM declarada trocada", &|g| {
            node(g, "ev")["params"]["rom_sha256"] = json!("f".repeat(64))
        });
        assert!(d.iter().any(|x| x.contains("identidade")), "{d:?}");
        refused("instância declarada trocada", &|g| {
            node(g, "ev")["params"]["gate_offset"] = json!(A2)
        });
        refused("perfil declarado trocado", &|g| {
            node(g, "ev")["params"]["perfil"] = json!("m68k.outro.v1")
        });
        refused("nó de entrada sem a marca", &|g| {
            node(g, "ev")["params"]
                .as_object_mut()
                .unwrap()
                .remove(BRIDGE_PARAM);
        });
        // problemas de VALOR: não são mudança de lógica, mas impedem a edição
        let (_, p) = refused("não inteiro", &|g| {
            node(g, "n_lim")["params"]["value"] = json!("abc")
        });
        assert_eq!(p, ["valor não inteiro em lim"]);
        let (_, p) = refused("fracionário", &|g| {
            node(g, "n_lim")["params"]["value"] = json!(1.5)
        });
        assert_eq!(p, ["valor não inteiro em lim"]);
        let (_, p) = refused("fora do domínio", &|g| {
            node(g, "n_lim")["params"]["value"] = json!(1001)
        });
        assert_eq!(p, ["valor de lim fora da faixa 1..1000"]);
        let (_, p) = refused("não cabe em 64 bits", &|g| {
            node(g, "n_lim")["params"]["value"] = json!(1e30)
        });
        assert_eq!(p, ["valor não inteiro em lim"]);
        let (d, p) = refused("campo duplicado", &|g| {
            let mut n = node(g, "n_lim").clone();
            n["id"] = json!("n_lim_b");
            g["nodes"].as_array_mut().unwrap().push(n);
        });
        assert!(d.iter().any(|x| x == "nó novo: n_lim_b"));
        assert_eq!(p, ["campo duplicado: lim aparece em mais de um nó"]);
        assert_eq!(
            c.review(&json!("isto não é um grafo"))
                .unwrap()
                .structural_ok,
            false
        );
        assert!(matches!(
            review_graph(&c.engine, &c.rom, &c.sha, A1, "{ lixo"),
            Err(ProfileError::GraphDiverges(_))
        ));
    }

    #[test]
    fn grafo_de_outra_instancia_ou_de_rom_que_mudou_e_recusado() {
        let c = ctx();
        let g = c.graph(A1);
        assert_eq!(
            review_graph(&c.engine, &c.rom, &c.sha, 0x44, &g.to_string()),
            Err(ProfileError::InstanceNotFound)
        );
        // o grafo de A1 apresentado como se fosse de A2
        let r = review_graph(&c.engine, &c.rom, &c.sha, A2, &g.to_string()).unwrap();
        assert!(!r.structural_ok);
        // ROM editada depois de o grafo ser gerado: o canônico mudou (valor original e bytes)
        let mut rom2 = c.rom.clone();
        put(&mut rom2, A1, &pat_a(301, 0x10));
        let r = review_graph(&c.engine, &rom2, &sha256_hex(&rom2), A1, &g.to_string()).unwrap();
        assert!(!r.structural_ok);
    }

    #[test]
    fn perfil_de_outro_hash_ou_revisao_e_recusado_na_reabertura() {
        let c = ctx();
        let g = c.graph(A1);
        // o MESMO id, com o dado alterado (rótulo, domínio, revisão): outro SHA-256
        for alter in [
            (|m: &mut Value| m["fields"][0]["max"] = json!(999)) as fn(&mut Value),
            |m| m["revision"] = json!(2),
            |m| m["fields"][0]["label"] = json!("Outro rótulo"),
        ] {
            let other = engine_of(&mini_with(alter));
            assert_ne!(other.profile_sha256(), c.engine.profile_sha256());
            let err = review_graph(&other, &c.rom, &c.sha, A1, &g.to_string()).unwrap_err();
            assert_eq!(err.code(), "profile-mismatch");
            assert_eq!(
                err,
                ProfileError::ProfileMismatch {
                    expected: c.engine.profile_sha256().to_string(),
                    loaded: other.profile_sha256().to_string()
                }
            );
        }
    }

    #[test]
    fn grafo_sem_hash_do_perfil_e_aceito_pela_estrutura_e_avisado() {
        // grafos gravados antes do vínculo por hash não têm as chaves novas no nó de entrada
        let c = ctx();
        let mut g = c.graph(A1);
        let assinatura = node(&mut g, "ev")["params"]["assinatura_estrutural"].clone();
        for k in ["perfil_sha256", "perfil_revisao", "instancia_param"] {
            node(&mut g, "ev")["params"]
                .as_object_mut()
                .unwrap()
                .remove(k);
        }
        assert_eq!(
            json!(canonical_signature(&g)),
            assinatura,
            "a assinatura não depende do vínculo"
        );
        node(&mut g, "n_low")["params"]["value"] = json!(9);
        let r = c.review(&g).unwrap();
        assert!(r.accepted() && r.legacy_binding);
        assert_eq!(r.changes, [("low".to_string(), 9)]);
        // ...mas a estrutura continua sendo conferida: sem hash não é "passe livre"
        node(&mut g, "n_low")["params"]["campo"] = json!("top");
        assert!(!c.review(&g).unwrap().structural_ok);
    }

    /// Conformidade entre o núcleo e a ponte TS: o MESMO arquivo é conferido pelo vitest
    /// (`profileGraphBridge.test.ts`), que recalcula a assinatura estrutural gravada aqui.
    /// Regerar: `REX_WRITE_CONFORMANCE=1 cargo test --lib grafo_de_conformidade`.
    #[test]
    fn grafo_de_conformidade_com_a_ponte_ts() {
        let c = ctx();
        let inst = c.engine.instance_at(&c.rom, &c.sha, A1).unwrap();
        let text = graph_json(&c.engine, &c.rom, &inst, &c.sha).unwrap() + "\n";
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(
            "../data/rex_profiles/integration_20261009/conformidade/grafo-mini.nodegraph.json",
        );
        if std::env::var("REX_WRITE_CONFORMANCE").is_ok() {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, &text).unwrap();
        }
        assert_eq!(
            std::fs::read_to_string(&path).expect("arquivo de conformidade"),
            text,
            "a projeção do perfil de teste mudou: regere o arquivo e rode o vitest"
        );
    }
}
