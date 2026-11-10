//! Cadeia original MUGEN -> programa de estados executavel (`mugen.original_chain.v1`,
//! Experimental). Contrato: `crates/rex-mugen/CONTRACT.md`, secao «Cadeia original».
//!
//! Converte, a partir do texto real do CMD/CNS, SOMENTE o subconjunto necessario a uma
//! cadeia delimitada: comando -> condicao -> mudanca de estado -> animacao -> retorno.
//! Nada aqui executa conteudo do pacote; o resultado e dado (`Program`) que o compilador
//! traduz para C. Cada operacao convertida carrega `SourceRef` (arquivo, secao, linha,
//! texto) e o digest do programa cobre todo o mapeamento: adulterar a fonte mapeada no
//! grafo bloqueia o build. Controlador, gatilho ou parametro fora do subconjunto NUNCA e
//! ignorado em silencio: o controlador inteiro fica «nao convertido», com motivo.

use std::collections::{BTreeMap, BTreeSet};

use rex_mugen::sha256::sha256_hex;
use serde::{Deserialize, Serialize};

pub const SCHEMA: &str = "retrodev.mugen_chain/v1";
pub const PROFILE: &str = "mugen.original_chain.v1";
/// Extensao versionada (`mugen.original_chain.v2`, Experimental): `AnimElem = N` e `HitDef`
/// num subconjunto declarado contra um alvo de treino. Programas v1 continuam validos e
/// serializam exatamente como antes (os campos novos sao omitidos quando vazios).
pub const SCHEMA_V2: &str = "retrodev.mugen_chain/v2";
pub const PROFILE_V2: &str = "mugen.original_chain.v2";
/// Vida inicial do alvo de treino quando o CNS nao declara `[Data] life` (padrao MUGEN).
pub const DEFAULT_TARGET_LIFE: i32 = 1000;
/// Entradas do registro de acertos (16 bytes cada) na RAM.
pub const HIT_LOG_ENTRIES: usize = 32;
pub const HIT_LOG_ENTRY_BYTES: usize = 16;
/// Entradas do anel de rastreio na RAM (observabilidade para a prova).
pub const TRACE_ENTRIES: usize = 512;
/// Bytes por entrada: 11 palavras de 16 bits (tick, stateno, time, flags, action, cmd, pad,
/// animtick, vx, x, vtimer).
pub const TRACE_ENTRY_BYTES: usize = 22;
/// Teto de mudancas de estado encadeadas no mesmo tick (evita laco infinito).
pub const MAX_CHANGES_PER_TICK: u32 = 16;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceRef {
    pub file: String,
    pub section: String,
    pub line: u32,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Cmp {
    Eq,
    Ne,
    Lt,
    Gt,
    Le,
    Ge,
}

impl Cmp {
    pub fn c_op(self) -> &'static str {
        match self {
            Cmp::Eq => "==",
            Cmp::Ne => "!=",
            Cmp::Lt => "<",
            Cmp::Gt => ">",
            Cmp::Le => "<=",
            Cmp::Ge => ">=",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Expr {
    Always,
    Command {
        name: String,
        negate: bool,
    },
    StateType {
        value: String,
        negate: bool,
    },
    Ctrl {
        op: Cmp,
        value: i32,
    },
    StateNo {
        op: Cmp,
        value: i32,
    },
    Time {
        op: Cmp,
        value: i32,
    },
    AnimTime {
        op: Cmp,
        value: i32,
    },
    /// v2: `AnimElem = N` — verdadeiro no primeiro tick do elemento N (1-based) da animacao
    /// do estado. `start` = soma das duracoes dos elementos 1..N-1; `period` = duracao total
    /// (a animacao sem `Loopstart` recomeca do elemento 1). Derivado do AIR na analise.
    AnimElem {
        value: i32,
        start: u32,
        period: u32,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Trigger {
    pub expr: Expr,
    pub src: SourceRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Controller {
    pub id: String,
    pub src: SourceRef,
    /// Estado alvo do `ChangeState`; `-1` (sem significado) num `HitDef`.
    pub target: i32,
    pub set_ctrl: Option<bool>,
    pub all: Vec<Trigger>,
    pub groups: Vec<Vec<Trigger>>,
    /// v2: controlador `HitDef` (ativa o golpe; nao muda de estado).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hitdef: Option<HitDef>,
}

/// Parametro lido de um `HitDef`, com origem. `executed` muda o resultado medido;
/// `inert` foi lido e declarado sem efeito no alvo de treino do recorte (motivo em `effect`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HitParam {
    pub key: String,
    pub value: String,
    pub class: String,
    pub effect: String,
    pub src: SourceRef,
}

/// `HitDef` do subconjunto v2 (ver CONTRACT.md, «HitDef original»).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HitDef {
    /// Dano no acerto (`damage` 1o componente), 0..=9999.
    pub damage: i32,
    /// `hitflag` normalizado (maiusculas); o padrao MUGEN e `MAF`.
    pub hitflag: String,
    /// O alvo de treino fica sempre em pe (`S`): acerta se `hitflag` contem H ou M.
    pub hits_standing: bool,
    /// `pausetime` p1 (congelamento do atacante) e p2 (tremor do alvo), em ticks.
    pub pause_p1: u16,
    pub pause_p2: u16,
    /// `kill = 0` deixa o alvo com no minimo 1 de vida.
    pub kill: bool,
    pub params: Vec<HitParam>,
}

/// Vida inicial do alvo de treino (`[Data] life` do CNS, ou o padrao MUGEN declarado).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TargetLife {
    pub value: i32,
    /// `source` (lida do CNS) ou `default` (1000, padrao MUGEN; nao veio da fonte).
    pub origin: String,
    pub src: Option<SourceRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StateProgram {
    pub no: i32,
    /// `source` (Statedef do pacote) ou `stand_in` (autoral RetroDev, estado externo).
    pub origin: String,
    pub statetype: Option<String>,
    pub ctrl: Option<bool>,
    pub velset_q8: Option<i32>,
    pub anim: Option<i32>,
    pub src: Option<SourceRef>,
    pub controllers: Vec<Controller>,
    /// v2: `movetype` do Statedef (`A` = ataque: so assim um HitDef ativo acerta).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub movetype: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandDef {
    pub name: String,
    /// `press` | `hold` | `release`.
    pub kind: String,
    /// Letra MUGEN do botao (`a b c x y z s`), quando o comando e de botao.
    pub button: Option<String>,
    /// Direcao (`U D F B`), quando o comando e de direcao segurada.
    pub dir: Option<String>,
    /// `true` para `$X` (qualquer direcao que contenha X).
    pub any_dir: bool,
    pub src: SourceRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Program {
    pub schema: String,
    pub profile: String,
    pub entity: String,
    pub pad: String,
    /// Botao MUGEN -> botao do Mega Drive (autoral, declarado no relatorio).
    pub bindings: BTreeMap<String, String>,
    pub commands: Vec<CommandDef>,
    /// `Statedef -1` convertido, na ordem da fonte.
    pub special: Vec<Controller>,
    pub states: Vec<StateProgram>,
    pub initial_state: i32,
    pub digest: String,
    /// v2: vida inicial do alvo de treino (presente somente com HitDef convertido).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_life: Option<TargetLife>,
}

impl Program {
    pub fn is_v2(&self) -> bool {
        self.profile == PROFILE_V2
    }

    /// Controladores `HitDef` do programa, na ordem em que o runtime os numera.
    pub fn hitdefs(&self) -> Vec<&Controller> {
        self.states
            .iter()
            .flat_map(|s| s.controllers.iter())
            .filter(|c| c.hitdef.is_some())
            .collect()
    }

    fn uses_v2_features(&self) -> bool {
        let controllers = || {
            self.special
                .iter()
                .chain(self.states.iter().flat_map(|s| s.controllers.iter()))
        };
        self.target_life.is_some()
            || self.states.iter().any(|s| s.movetype.is_some())
            || controllers().any(|c| {
                c.hitdef.is_some()
                    || c.all
                        .iter()
                        .chain(c.groups.iter().flatten())
                        .any(|t| matches!(t.expr, Expr::AnimElem { .. }))
            })
    }

    /// Digest canonico de tudo exceto o proprio campo `digest` e o nome da entidade
    /// (copiar o programa para outra entidade nao e adulteracao; a semantica e o mapeamento
    /// de fonte sao cobertos).
    pub fn compute_digest(&self) -> String {
        let mut copy = self.clone();
        copy.digest = String::new();
        copy.entity = String::new();
        sha256_hex(serde_json::to_string(&copy).unwrap_or_default().as_bytes())
    }

    pub fn seal(mut self) -> Self {
        self.digest = self.compute_digest();
        self
    }

    /// Consistencia interna exigida do grafo antes de gerar C. Qualquer edicao manual do
    /// programa (condicao, alvo, linha de origem) sem refazer o digest e recusada.
    pub fn validate(&self) -> Result<(), String> {
        match (self.schema.as_str(), self.profile.as_str()) {
            (SCHEMA, PROFILE) => {
                if self.uses_v2_features() {
                    return Err("programa v1 com recursos do v2 (AnimElem/HitDef)".into());
                }
            }
            (SCHEMA_V2, PROFILE_V2) => {}
            _ => return Err("esquema/perfil do programa desconhecido".into()),
        }
        if self.digest != self.compute_digest() {
            return Err(
                "digest do programa nao confere (grafo/mapeamento de fonte adulterado)".into(),
            );
        }
        let check_src = |what: &str, s: &SourceRef| -> Result<(), String> {
            if s.file.is_empty() || s.line == 0 || s.text.trim().is_empty() {
                return Err(format!("{what}: mapeamento de fonte incompleto"));
            }
            Ok(())
        };
        let mut numbers = BTreeSet::new();
        for st in &self.states {
            if !numbers.insert(st.no) {
                return Err(format!("estado {} duplicado", st.no));
            }
            match (st.origin.as_str(), &st.src) {
                ("source", Some(s)) => check_src(&format!("statedef {}", st.no), s)?,
                ("stand_in", None) => {}
                _ => {
                    return Err(format!(
                        "estado {}: origem/mapeamento inconsistentes",
                        st.no
                    ))
                }
            }
        }
        if !numbers.contains(&self.initial_state) {
            return Err("estado inicial inexistente".into());
        }
        let names: BTreeSet<&str> = self.commands.iter().map(|c| c.name.as_str()).collect();
        for c in &self.commands {
            check_src(&format!("comando {}", c.name), &c.src)?;
        }
        let controllers = self
            .special
            .iter()
            .chain(self.states.iter().flat_map(|s| s.controllers.iter()));
        if let Some(t) = &self.target_life {
            if !(1..=32767).contains(&t.value) {
                return Err(format!("vida do alvo {} fora de 1..=32767", t.value));
            }
            match (t.origin.as_str(), &t.src) {
                ("source", Some(s)) => check_src("vida do alvo", s)?,
                ("default", None) => {}
                _ => return Err("vida do alvo: origem/mapeamento inconsistentes".into()),
            }
        }
        if self.is_v2() && !self.hitdefs().is_empty() && self.target_life.is_none() {
            return Err("HitDef sem vida do alvo declarada".into());
        }
        if self.special.iter().any(|c| c.hitdef.is_some()) {
            return Err("HitDef no estado -1 fora do subconjunto".into());
        }
        for c in controllers {
            check_src(&format!("controlador {}", c.id), &c.src)?;
            if let Some(h) = &c.hitdef {
                if !(0..=9999).contains(&h.damage) {
                    return Err(format!(
                        "controlador {}: dano {} fora de 0..=9999",
                        c.id, h.damage
                    ));
                }
                if h.pause_p1 > 255 || h.pause_p2 > 255 {
                    return Err(format!("controlador {}: pausetime fora de 0..=255", c.id));
                }
                let standing = h.hitflag.contains('H') || h.hitflag.contains('M');
                if standing != h.hits_standing {
                    return Err(format!("controlador {}: hitflag incoerente", c.id));
                }
                for prm in &h.params {
                    check_src(&format!("parametro {} de {}", prm.key, c.id), &prm.src)?;
                }
            } else if !numbers.contains(&c.target) {
                return Err(format!(
                    "controlador {}: estado alvo {} inexistente",
                    c.id, c.target
                ));
            }
            if c.groups.is_empty() {
                return Err(format!("controlador {}: sem trigger1", c.id));
            }
            for t in c.all.iter().chain(c.groups.iter().flatten()) {
                check_src(&format!("gatilho de {}", c.id), &t.src)?;
                if let Expr::Command { name, .. } = &t.expr {
                    if !names.contains(name.as_str()) {
                        return Err(format!("controlador {}: comando '{name}' ausente", c.id));
                    }
                }
                if let Expr::AnimElem {
                    value,
                    start,
                    period,
                } = &t.expr
                {
                    if *value < 1 || *period == 0 || start >= period {
                        return Err(format!("controlador {}: AnimElem nao resolvido", c.id));
                    }
                }
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------- entrada e leitura

#[derive(Debug, Clone)]
pub struct SourceFile {
    pub name: String,
    pub text: String,
    pub sha256: String,
}

impl SourceFile {
    pub fn new(name: &str, bytes: &[u8]) -> Self {
        SourceFile {
            name: name.to_string(),
            text: String::from_utf8_lossy(bytes).into_owned(),
            sha256: sha256_hex(bytes),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct CommonDependency {
    /// Valor de `stcommon` no DEF (p.ex. `common1.cns`) e a linha no DEF.
    pub requested: Option<String>,
    pub def_line: Option<u32>,
    /// Arquivo localizado DENTRO do pacote (nunca de outra instalacao).
    pub file: Option<SourceFile>,
}

#[derive(Clone)]
pub struct ChainInput<'a> {
    pub def_name: String,
    pub cmd: Option<SourceFile>,
    pub state_files: Vec<SourceFile>,
    pub common: CommonDependency,
    pub chain_states: Vec<i32>,
    /// Acoes AIR selecionadas: numero -> total de ticks (0 = sem fim).
    pub actions: &'a BTreeMap<i32, u32>,
    pub entity: String,
    /// v2: forma de cada acao selecionada (duracoes, Loopstart, flips, caixas). Vazio =
    /// `AnimElem`/`HitDef` nao resolviveis (o resultado e o mesmo do v1).
    pub shapes: BTreeMap<i32, ActionShape>,
}

/// Forma de uma acao AIR usada para resolver `AnimElem` e validar o golpe.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ActionShape {
    /// Duracao por elemento; `None` = `-1` (parado).
    pub durations: Vec<Option<u32>>,
    pub loopstart: Option<usize>,
    /// Elemento com flip H ou V.
    pub flipped: Vec<bool>,
    /// Numero de Clsn1 por elemento.
    pub clsn1: Vec<usize>,
}

pub struct ChainAnalysis {
    pub program: Result<Program, String>,
    pub report: serde_json::Value,
}

struct Line {
    no: u32,
    key: String,
    value: String,
    text: String,
}

struct Section {
    header: String,
    line: u32,
    lines: Vec<Line>,
}

fn parse_sections(text: &str) -> Vec<Section> {
    let mut out: Vec<Section> = Vec::new();
    for (i, raw) in text.replace('\r', "").split('\n').enumerate() {
        let no = i as u32 + 1;
        let body = raw.split(';').next().unwrap_or("").trim();
        if body.is_empty() {
            continue;
        }
        if body.starts_with('[') {
            let header = body
                .trim_start_matches('[')
                .split(']')
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            out.push(Section {
                header,
                line: no,
                lines: Vec::new(),
            });
            continue;
        }
        let Some(section) = out.last_mut() else {
            continue;
        };
        if let Some((k, v)) = body.split_once('=') {
            section.lines.push(Line {
                no,
                key: k.trim().to_ascii_lowercase(),
                value: v.trim().to_string(),
                text: body.to_string(),
            });
        }
    }
    out
}

fn src_of(file: &str, sec: &Section, line: Option<&Line>) -> SourceRef {
    SourceRef {
        file: file.to_string(),
        section: format!("[{}]", sec.header),
        line: line.map(|l| l.no).unwrap_or(sec.line),
        text: line
            .map(|l| l.text.clone())
            .unwrap_or_else(|| format!("[{}]", sec.header)),
    }
}

fn parse_int(v: &str) -> Option<i32> {
    let t = v.trim();
    if t.is_empty() {
        return None;
    }
    t.parse::<i32>().ok()
}

fn parse_cmp(op: &str) -> Option<Cmp> {
    Some(match op {
        "=" => Cmp::Eq,
        "!=" => Cmp::Ne,
        "<" => Cmp::Lt,
        ">" => Cmp::Gt,
        "<=" => Cmp::Le,
        ">=" => Cmp::Ge,
        _ => return None,
    })
}

/// Um gatilho do subconjunto: `lhs op rhs` simples. Qualquer outra forma e recusada com
/// motivo (nenhuma avaliacao parcial).
pub fn parse_expr(raw: &str) -> Result<Expr, String> {
    let t = raw.trim();
    if t == "1" {
        return Ok(Expr::Always);
    }
    if t.chars().any(|c| {
        matches!(
            c,
            '(' | ')' | '&' | '|' | ',' | '[' | ']' | '+' | '*' | '/' | '%' | '^' | '~' | ':'
        )
    }) || t.contains("==")
    {
        return Err("expressao composta (operadores/funcoes) fora do subconjunto".into());
    }
    let (op_at, op_len) = ["!=", "<=", ">=", "=", "<", ">"]
        .iter()
        .filter_map(|op| t.find(op).map(|i| (i, op.len())))
        .min_by_key(|(i, len)| (*i, std::cmp::Reverse(*len)))
        .ok_or_else(|| {
            format!("'{t}': trigger sem comparacao (MoveContact, MoveHit etc. fora do subconjunto)")
        })?;
    let lhs = t[..op_at].trim().to_ascii_lowercase();
    let op_text = &t[op_at..op_at + op_len];
    let rhs = t[op_at + op_len..].trim();
    let op = parse_cmp(op_text).ok_or_else(|| format!("operador '{op_text}' desconhecido"))?;
    match lhs.as_str() {
        "command" => {
            let name = rhs
                .strip_prefix('"')
                .and_then(|r| r.strip_suffix('"'))
                .filter(|n| !n.is_empty() && !n.contains('"'))
                .ok_or_else(|| "command exige nome entre aspas".to_string())?;
            match op {
                Cmp::Eq | Cmp::Ne => Ok(Expr::Command {
                    name: name.to_string(),
                    negate: op == Cmp::Ne,
                }),
                _ => Err("command so aceita = e !=".into()),
            }
        }
        "statetype" => {
            let v = rhs.to_ascii_uppercase();
            if !matches!(v.as_str(), "S" | "C" | "A" | "L") || !matches!(op, Cmp::Eq | Cmp::Ne) {
                return Err("statetype so aceita = / != com S, C, A ou L".into());
            }
            Ok(Expr::StateType {
                value: v,
                negate: op == Cmp::Ne,
            })
        }
        "animelem" => {
            if op != Cmp::Eq {
                return Err("AnimElem so aceita = N (sem , op e sem outros operadores)".into());
            }
            let value = parse_int(rhs)
                .filter(|v| *v >= 1)
                .ok_or_else(|| format!("animelem: '{rhs}' nao e inteiro literal >= 1"))?;
            Ok(Expr::AnimElem {
                value,
                start: 0,
                period: 0,
            })
        }
        "ctrl" | "stateno" | "time" | "animtime" => {
            let value = parse_int(rhs)
                .ok_or_else(|| format!("{lhs}: valor '{rhs}' nao e inteiro literal"))?;
            Ok(match lhs.as_str() {
                "ctrl" => Expr::Ctrl { op, value },
                "stateno" => Expr::StateNo { op, value },
                "time" => Expr::Time { op, value },
                _ => Expr::AnimTime { op, value },
            })
        }
        other => Err(format!("gatilho '{other}' fora do subconjunto")),
    }
}

// ---------------------------------------------------------------- comandos (CMD)

#[derive(Debug)]
struct CommandClass {
    def: Option<CommandDef>,
    name: String,
    src: SourceRef,
    reason: Option<String>,
}

fn classify_command(file: &str, sec: &Section) -> CommandClass {
    let get = |k: &str| sec.lines.iter().find(|l| l.key == k);
    let name_line = get("name");
    let name = name_line
        .map(|l| l.value.trim_matches('"').to_string())
        .unwrap_or_default();
    let cmd_line = get("command");
    let src = src_of(file, sec, cmd_line.or(name_line));
    let fail = |why: String| CommandClass {
        def: None,
        name: name.clone(),
        src: src.clone(),
        reason: Some(why),
    };
    let Some(cmd_line) = cmd_line else {
        return fail("sem 'command'".into());
    };
    if name.is_empty() {
        return fail("sem 'name'".into());
    }
    match get("time").map(|l| l.value.as_str()) {
        Some("1") => {}
        Some(other) => {
            return fail(format!(
                "time = {other}: janela de comando diferente de 1 tick nao e convertida"
            ))
        }
        None => return fail("sem time (padrao 15: janela nao convertida)".into()),
    }
    if let Some(b) = get("buffer.time") {
        if b.value != "1" {
            return fail(format!("buffer.time = {}: nao convertido (so 1)", b.value));
        }
    }
    let spec: String = cmd_line
        .value
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    if spec.contains(',') || spec.contains('+') || spec.contains('>') {
        return fail("sequencia/combinacao de entradas fora do subconjunto".into());
    }
    let (kind, rest) = if let Some(r) = spec.strip_prefix('/') {
        ("hold", r.to_string())
    } else if let Some(r) = spec.strip_prefix('~') {
        ("release", r.to_string())
    } else {
        ("press", spec.clone())
    };
    let (any_dir, base) = match rest.strip_prefix('$') {
        Some(r) => (true, r.to_string()),
        None => (false, rest.clone()),
    };
    let lower = base.to_ascii_lowercase();
    let is_button =
        matches!(lower.as_str(), "a" | "b" | "c" | "x" | "y" | "z" | "s") && base == lower;
    let is_dir = matches!(base.as_str(), "U" | "D" | "F" | "B");
    let def = if is_button && !any_dir {
        CommandDef {
            name: name.clone(),
            kind: kind.into(),
            button: Some(lower),
            dir: None,
            any_dir: false,
            src: src.clone(),
        }
    } else if is_dir && kind == "hold" {
        CommandDef {
            name: name.clone(),
            kind: "hold".into(),
            button: None,
            dir: Some(base),
            any_dir,
            src: src.clone(),
        }
    } else {
        return fail(format!(
            "entrada '{}' fora do subconjunto (botao, /botao, ~botao, /direcao, /$direcao)",
            cmd_line.value
        ));
    };
    CommandClass {
        def: Some(def),
        name,
        src,
        reason: None,
    }
}

// ---------------------------------------------------------------- estados (CNS)

struct RawState<'a> {
    no: i32,
    file: &'a str,
    def: &'a Section,
    controllers: Vec<&'a Section>,
}

fn collect_states<'a>(
    files: &'a [(String, Vec<Section>)],
) -> (BTreeMap<i32, Vec<RawState<'a>>>, Vec<String>) {
    let mut out: BTreeMap<i32, Vec<RawState<'a>>> = BTreeMap::new();
    let mut warnings = Vec::new();
    for (file, sections) in files {
        let mut current: Option<(i32, usize)> = None;
        for sec in sections {
            let lower = sec.header.to_ascii_lowercase();
            if let Some(rest) = lower.strip_prefix("statedef") {
                match rest.trim().parse::<i32>() {
                    Ok(no) => {
                        let list = out.entry(no).or_default();
                        list.push(RawState {
                            no,
                            file,
                            def: sec,
                            controllers: Vec::new(),
                        });
                        current = Some((no, list.len() - 1));
                    }
                    Err(_) => {
                        current = None;
                        warnings.push(format!(
                            "{file}:{}: Statedef '{}' sem numero literal",
                            sec.line, sec.header
                        ));
                    }
                }
            } else if lower.starts_with("state ") || lower.starts_with("state\t") {
                if let Some((no, idx)) = current {
                    out.get_mut(&no).unwrap()[idx].controllers.push(sec);
                }
            }
        }
    }
    (out, warnings)
}

fn op(rows: &mut Vec<serde_json::Value>, row: serde_json::Value) {
    rows.push(row);
}

#[allow(clippy::too_many_arguments)]
fn row(
    id: &str,
    kind: &str,
    src: Option<&SourceRef>,
    class: &str,
    implementation: &str,
    test: &str,
    limit: &str,
) -> serde_json::Value {
    serde_json::json!({
        "id": id, "kind": kind, "source": src, "class": class,
        "implementation": implementation, "test": test, "limit": limit,
    })
}

/// Resolve `AnimElem = N` contra a animacao do estado (AIR). Recusa com motivo quando a
/// animacao e desconhecida, tem `Loopstart`, elemento parado (-1) ou N fora da acao.
fn resolve_animelem(t: &mut Trigger, shape: Option<(i32, &ActionShape)>) -> Result<(), String> {
    let Expr::AnimElem { value, .. } = t.expr.clone() else {
        return Ok(());
    };
    let Some((anim, sh)) = shape else {
        return Err("AnimElem exige estado com anim literal e acao selecionada".into());
    };
    if sh.loopstart.is_some() {
        return Err(format!(
            "AnimElem sobre a acao {anim} com Loopstart fora do subconjunto"
        ));
    }
    let n = value as usize;
    if n == 0 || n > sh.durations.len() {
        return Err(format!(
            "AnimElem = {value}: a acao {anim} tem {} elementos",
            sh.durations.len()
        ));
    }
    let Some(period) = sh
        .durations
        .iter()
        .try_fold(0u32, |acc, d| d.filter(|v| *v > 0).map(|v| acc + v))
    else {
        return Err(format!(
            "AnimElem sobre a acao {anim} com elemento parado (-1) ou 0"
        ));
    };
    let start: u32 = sh.durations[..n - 1].iter().map(|d| d.unwrap_or(0)).sum();
    t.expr = Expr::AnimElem {
        value,
        start,
        period,
    };
    Ok(())
}

/// Parametros de `HitDef` lidos e declarados SEM efeito no alvo de treino do recorte v2 (o alvo
/// fica parado, em pe, sem guarda, sem fisica, sem estado de acerto, sem energia, som ou faisca).
/// Cada um muda o resultado no motor original; aqui o efeito e registrado como nao modelado.
const HITDEF_INERT: &[(&str, &str)] = &[
    (
        "attr",
        "atributo so filtra ReversalDef/NotHitBy, que o alvo de treino nao tem",
    ),
    ("guardflag", "o alvo de treino nunca defende"),
    ("animtype", "animacao de reacao do alvo nao modelada"),
    ("air.animtype", "alvo nunca esta no ar"),
    ("fall.animtype", "alvo nunca cai"),
    (
        "priority",
        "sem golpe simultaneo do alvo (sem troca de prioridade)",
    ),
    ("numhits", "contador de combo nao modelado"),
    ("sparkno", "faisca de acerto nao desenhada"),
    ("guard.sparkno", "faisca de defesa nao desenhada"),
    ("sparkxy", "faisca de acerto nao desenhada"),
    ("hitsound", "som de acerto nao tocado"),
    ("guardsound", "som de defesa nao tocado"),
    ("ground.type", "reacao do alvo nao modelada"),
    ("air.type", "alvo nunca esta no ar"),
    ("ground.slidetime", "o alvo nao desliza"),
    ("ground.hittime", "o alvo nao entra em estado de acerto"),
    ("ground.velocity", "o alvo nao e empurrado"),
    ("ground.cornerpush.veloff", "sem canto de tela"),
    ("guard.slidetime", "o alvo nunca defende"),
    ("guard.hittime", "o alvo nunca defende"),
    ("guard.ctrltime", "o alvo nunca defende"),
    ("guard.velocity", "o alvo nunca defende"),
    ("guard.dist", "o alvo nunca defende"),
    ("guard.pausetime", "o alvo nunca defende"),
    ("guard.kill", "o alvo nunca defende"),
    ("guard.cornerpush.veloff", "sem canto de tela"),
    ("airguard.velocity", "o alvo nunca defende no ar"),
    ("airguard.ctrltime", "o alvo nunca defende no ar"),
    ("airguard.cornerpush.veloff", "sem canto de tela"),
    ("air.velocity", "alvo nunca esta no ar"),
    ("air.hittime", "alvo nunca esta no ar"),
    ("air.juggle", "sem juggle"),
    ("air.fall", "alvo nunca esta no ar"),
    ("air.cornerpush.veloff", "sem canto de tela"),
    ("down.velocity", "alvo nunca esta deitado"),
    ("down.hittime", "alvo nunca esta deitado"),
    ("down.bounce", "alvo nunca esta deitado"),
    ("down.cornerpush.veloff", "sem canto de tela"),
    ("getpower", "sem barra de energia"),
    ("givepower", "sem barra de energia"),
    ("fall", "o alvo nao cai"),
    ("fall.recover", "o alvo nao cai"),
    ("fall.recovertime", "o alvo nao cai"),
    ("fall.damage", "o alvo nao cai"),
    ("fall.xvelocity", "o alvo nao cai"),
    ("fall.yvelocity", "o alvo nao cai"),
    ("yaccel", "o alvo nao e lancado"),
    ("id", "sem gatilhos de alvo (NumTarget/TargetState)"),
    ("chainid", "sem cadeia de golpes no alvo"),
    ("nochainid", "sem cadeia de golpes no alvo"),
    ("p1sprpriority", "camada de desenho nao alterada"),
    ("p2sprpriority", "camada de desenho nao alterada"),
    ("p2facing", "orientacao do alvo de treino fixa"),
    ("forcestand", "o alvo ja esta sempre em pe"),
    ("forcenofall", "o alvo nao cai"),
    ("envshake.time", "tremor de tela nao modelado"),
    ("envshake.freq", "tremor de tela nao modelado"),
    ("envshake.ampl", "tremor de tela nao modelado"),
    ("envshake.phase", "tremor de tela nao modelado"),
    ("fall.envshake.time", "tremor de tela nao modelado"),
    ("fall.envshake.freq", "tremor de tela nao modelado"),
    ("fall.envshake.ampl", "tremor de tela nao modelado"),
    ("fall.envshake.phase", "tremor de tela nao modelado"),
    ("palfx.time", "efeito de paleta nao modelado"),
    ("palfx.mul", "efeito de paleta nao modelado"),
    ("palfx.add", "efeito de paleta nao modelado"),
    ("palfx.sinadd", "efeito de paleta nao modelado"),
    ("palfx.invertall", "efeito de paleta nao modelado"),
    ("palfx.color", "efeito de paleta nao modelado"),
];

/// Inteiro literal, opcionalmente com segundo componente literal (`a, b`).
fn parse_pair(v: &str) -> Option<(i32, Option<i32>)> {
    let mut it = v.split(',');
    let a = parse_int(it.next()?)?;
    let b = match it.next() {
        Some(t) => Some(parse_int(t)?),
        None => None,
    };
    if it.next().is_some() {
        return None;
    }
    Some((a, b))
}

fn convert_hitdef(
    file: &str,
    sec: &Section,
    state_no: i32,
    index: usize,
    commands: &BTreeMap<String, CommandDef>,
    bad_commands: &BTreeMap<String, String>,
    shape: Option<(i32, &ActionShape)>,
) -> Result<Controller, String> {
    if state_no < 0 {
        return Err("HitDef em estado especial (-1/-2/-3) fora do subconjunto v2".into());
    }
    let mut all: Vec<Trigger> = Vec::new();
    let mut groups: BTreeMap<u32, Vec<Trigger>> = BTreeMap::new();
    let mut params: Vec<HitParam> = Vec::new();
    let mut damage: Option<i32> = None;
    let mut hitflag = "MAF".to_string();
    let mut pause = (0u16, 0u16);
    let mut kill = true;
    let mut why: Vec<String> = Vec::new();
    for l in &sec.lines {
        let src = src_of(file, sec, Some(l));
        let mut exec = |key: &str, effect: String| {
            params.push(HitParam {
                key: key.into(),
                value: l.value.clone(),
                class: "executed".into(),
                effect,
                src: src.clone(),
            })
        };
        match l.key.as_str() {
            "type" | "name" => {}
            "triggerall" => match parse_expr(&l.value) {
                Ok(e) => all.push(Trigger { expr: e, src }),
                Err(e) => why.push(format!("linha {}: {e}", l.no)),
            },
            k if k
                .strip_prefix("trigger")
                .and_then(|n| n.parse::<u32>().ok())
                .is_some() =>
            {
                let n = k["trigger".len()..].parse::<u32>().unwrap();
                match parse_expr(&l.value) {
                    Ok(e) => groups.entry(n).or_default().push(Trigger { expr: e, src }),
                    Err(e) => why.push(format!("linha {}: {e}", l.no)),
                }
            }
            "damage" => match parse_pair(&l.value) {
                Some((d, g)) if (0..=9999).contains(&d) => {
                    damage = Some(d);
                    exec(
                        "damage",
                        format!(
                            "dano {d} subtraido da vida do alvo no tick do contato{}",
                            g.map(|g| format!("; dano na defesa {g} lido, sem efeito (o alvo nunca defende)"))
                                .unwrap_or_default()
                        ),
                    );
                }
                _ => why.push(format!(
                    "linha {}: damage '{}' fora de inteiro literal 0..=9999[, defesa]",
                    l.no, l.value
                )),
            },
            "hitflag" => {
                let v = l.value.trim().to_ascii_uppercase();
                if v.is_empty() || !v.chars().all(|c| "HLMAFD".contains(c)) {
                    why.push(format!(
                        "linha {}: hitflag '{}' fora de H/L/M/A/F/D ('+'/'-' exigem estado de acerto do alvo)",
                        l.no, l.value
                    ));
                } else {
                    hitflag = v.clone();
                    let standing = v.contains('H') || v.contains('M');
                    exec(
                        "hitflag",
                        if standing {
                            format!("{v}: alcanca o alvo de treino em pe (H ou M)")
                        } else {
                            format!("{v}: NAO alcanca o alvo de treino em pe (sem H/M); o golpe ativa e nao acerta")
                        },
                    );
                }
            }
            "pausetime" => match parse_pair(&l.value) {
                Some((a, b)) if (0..=255).contains(&a) && (0..=255).contains(&b.unwrap_or(0)) => {
                    let b = b.unwrap_or(0);
                    pause = (a as u16, b as u16);
                    exec(
                        "pausetime",
                        format!("atacante congela {a} ticks apos o contato (Time, animacao e controladores param); tremor do alvo {b} ticks so contado na RAM"),
                    );
                }
                _ => why.push(format!(
                    "linha {}: pausetime '{}' fora de literais 0..=255",
                    l.no, l.value
                )),
            },
            "kill" => match parse_int(&l.value) {
                Some(v) => {
                    kill = v != 0;
                    exec(
                        "kill",
                        if kill {
                            "o acerto pode zerar a vida".into()
                        } else {
                            "o acerto deixa no minimo 1 de vida".into()
                        },
                    );
                }
                None => why.push(format!("linha {}: kill '{}' nao literal", l.no, l.value)),
            },
            k => match HITDEF_INERT.iter().find(|(name, _)| *name == k) {
                Some((name, effect)) => params.push(HitParam {
                    key: (*name).into(),
                    value: l.value.clone(),
                    class: "inert".into(),
                    effect: (*effect).into(),
                    src,
                }),
                None => why.push(format!(
                    "linha {}: parametro '{k}' do HitDef fora do subconjunto v2 (altera atacante, alvo ou ordem de forma nao modelada)",
                    l.no
                )),
            },
        }
    }
    if damage.is_none() {
        // MUGEN: damage omitido = 0. Declarado para que o efeito nulo seja explicito.
        damage = Some(0);
    }
    for t in all.iter_mut().chain(groups.values_mut().flatten()) {
        if let Err(e) = resolve_animelem(t, shape) {
            why.push(e);
        }
        if let Expr::Command { name, .. } = &t.expr {
            if let Some(reason) = bad_commands.get(name) {
                why.push(format!("comando '{name}' nao convertido: {reason}"));
            } else if !commands.contains_key(name) {
                why.push(format!("comando '{name}' nao definido no CMD"));
            }
        }
        if matches!(t.expr, Expr::AnimTime { .. }) && shape.is_none() {
            why.push("AnimTime exige animacao conhecida".into());
        }
    }
    if groups.is_empty() || groups.keys().copied().ne(1..=groups.len() as u32) {
        why.push("grupos trigger<N> ausentes ou nao contiguos a partir de trigger1".into());
    }
    match shape {
        Some((anim, sh)) => {
            if sh.flipped.iter().any(|f| *f) {
                why.push(format!(
                    "acao {anim} com elemento espelhado: transformacao das caixas pelo flip do elemento fora do subconjunto"
                ));
            }
            if sh.clsn1.iter().all(|n| *n == 0) {
                why.push(format!(
                    "acao {anim} sem Clsn1: o golpe nunca alcancaria o alvo"
                ));
            }
        }
        None => why.push("HitDef exige estado com anim literal e acao selecionada".into()),
    }
    if !why.is_empty() {
        return Err(why.join("; "));
    }
    let hits_standing = hitflag.contains('H') || hitflag.contains('M');
    Ok(Controller {
        id: format!("{state_no}#{index}"),
        src: src_of(file, sec, None),
        target: -1,
        set_ctrl: None,
        all,
        groups: groups.into_values().collect(),
        hitdef: Some(HitDef {
            damage: damage.unwrap_or(0),
            hitflag,
            hits_standing,
            pause_p1: pause.0,
            pause_p2: pause.1,
            kill,
            params,
        }),
    })
}

#[allow(clippy::too_many_arguments)]
fn convert_controller(
    file: &str,
    sec: &Section,
    state_no: i32,
    index: usize,
    commands: &BTreeMap<String, CommandDef>,
    bad_commands: &BTreeMap<String, String>,
    valid_targets: &BTreeSet<i32>,
    shape: Option<(i32, &ActionShape)>,
) -> Result<Controller, String> {
    let kind = sec
        .lines
        .iter()
        .find(|l| l.key == "type")
        .map(|l| l.value.to_ascii_lowercase())
        .unwrap_or_default();
    if kind == "hitdef" && shape.is_some() {
        return convert_hitdef(file, sec, state_no, index, commands, bad_commands, shape);
    }
    if kind != "changestate" {
        let shown = sec
            .lines
            .iter()
            .find(|l| l.key == "type")
            .map(|l| l.value.clone())
            .unwrap_or_else(|| "?".into());
        return Err(format!(
            "controlador '{shown}' fora do subconjunto (so ChangeState)"
        ));
    }
    let mut value: Option<i32> = None;
    let mut set_ctrl: Option<bool> = None;
    let mut all: Vec<Trigger> = Vec::new();
    let mut groups: BTreeMap<u32, Vec<Trigger>> = BTreeMap::new();
    for l in &sec.lines {
        let trigger = |expr: Expr| Trigger {
            expr,
            src: src_of(file, sec, Some(l)),
        };
        match l.key.as_str() {
            "type" | "name" => {}
            "value" => {
                value = Some(parse_int(&l.value).ok_or_else(|| {
                    format!("linha {}: value '{}' nao e inteiro literal", l.no, l.value)
                })?)
            }
            "ctrl" => {
                set_ctrl = Some(
                    parse_int(&l.value)
                        .ok_or_else(|| format!("linha {}: ctrl '{}' nao literal", l.no, l.value))?
                        != 0,
                )
            }
            "triggerall" => all.push(trigger(
                parse_expr(&l.value).map_err(|e| format!("linha {}: {e}", l.no))?,
            )),
            k if k
                .strip_prefix("trigger")
                .and_then(|n| n.parse::<u32>().ok())
                .is_some() =>
            {
                let n = k["trigger".len()..].parse::<u32>().unwrap();
                groups.entry(n).or_default().push(trigger(
                    parse_expr(&l.value).map_err(|e| format!("linha {}: {e}", l.no))?,
                ));
            }
            other => {
                return Err(format!(
                    "linha {}: parametro '{other}' do ChangeState nao e convertido",
                    l.no
                ))
            }
        }
    }
    let target = value.ok_or("ChangeState sem value")?;
    let mut why: Vec<String> = Vec::new();
    for t in all.iter_mut().chain(groups.values_mut().flatten()) {
        if let Err(e) = resolve_animelem(t, shape) {
            why.push(e);
        }
    }
    for t in all.iter().chain(groups.values().flatten()) {
        if let Expr::Command { name, .. } = &t.expr {
            if let Some(reason) = bad_commands.get(name) {
                why.push(format!("comando '{name}' nao convertido: {reason}"));
            } else if !commands.contains_key(name) {
                why.push(format!("comando '{name}' nao definido no CMD"));
            }
        }
    }
    if !valid_targets.contains(&target) {
        why.push(format!("estado alvo {target} fora da cadeia convertida"));
    }
    if groups.is_empty() || groups.keys().copied().ne(1..=groups.len() as u32) {
        why.push("grupos trigger<N> ausentes ou nao contiguos a partir de trigger1".into());
    }
    if !why.is_empty() {
        return Err(why.join("; "));
    }
    Ok(Controller {
        id: format!("{state_no}#{index}"),
        src: src_of(file, sec, None),
        target,
        set_ctrl,
        all,
        groups: groups.into_values().collect(),
        hitdef: None,
    })
}

struct StateConv {
    state: StateProgram,
    rows: Vec<serde_json::Value>,
}

fn convert_statedef(rs: &RawState<'_>) -> StateConv {
    let mut st = StateProgram {
        no: rs.no,
        origin: "source".into(),
        statetype: None,
        ctrl: None,
        velset_q8: None,
        anim: None,
        src: Some(src_of(rs.file, rs.def, None)),
        controllers: Vec::new(),
        movetype: None,
    };
    let mut rows = Vec::new();
    for l in &rs.def.lines {
        if l.key == "movetype" {
            // Registrado aqui; so passa a fazer parte do programa no v2 (HitDef convertido).
            let v = l.value.trim().to_ascii_uppercase();
            if matches!(v.as_str(), "A" | "I" | "H") {
                st.movetype = Some(v);
            }
        }
        let src = src_of(rs.file, rs.def, Some(l));
        let id = format!("state.{}.{}", rs.no, l.key);
        match l.key.as_str() {
            "type" => match l.value.to_ascii_uppercase().as_str() {
                v @ ("S" | "C" | "A" | "L") => {
                    st.statetype = Some(v.to_string());
                    op(
                        &mut rows,
                        row(
                            &id,
                            "statedef",
                            Some(&src),
                            "converted",
                            "tipo do estado (alimenta StateType dos gatilhos)",
                            "core::mugen_chain::tests::converts_the_stand_x_chain_with_source_mapping_and_explicit_gaps + mugen_original_chain_real_ken_capture",
                            "-",
                        ),
                    );
                }
                _ => op(
                    &mut rows,
                    row(
                        &id,
                        "statedef",
                        Some(&src),
                        "unconverted",
                        "type fora de S/C/A/L",
                        "-",
                        "tipo do estado nao muda",
                    ),
                ),
            },
            "ctrl" => match parse_int(&l.value) {
                Some(v) => {
                    st.ctrl = Some(v != 0);
                    op(
                        &mut rows,
                        row(
                            &id,
                            "statedef",
                            Some(&src),
                            "converted",
                            "ctrl aplicado na entrada do estado",
                            "core::mugen_chain::tests::converts_the_stand_x_chain_with_source_mapping_and_explicit_gaps + mugen_original_chain_real_ken_capture",
                            "-",
                        ),
                    );
                }
                None => op(
                    &mut rows,
                    row(
                        &id,
                        "statedef",
                        Some(&src),
                        "unconverted",
                        "ctrl nao literal",
                        "-",
                        "ctrl nao muda",
                    ),
                ),
            },
            "anim" => match parse_int(&l.value) {
                Some(v) => {
                    st.anim = Some(v);
                    op(
                        &mut rows,
                        row(
                            &id,
                            "statedef",
                            Some(&src),
                            "converted",
                            "anim aplicada na entrada (reinicia a animacao)",
                            "core::mugen_chain::tests::converts_the_stand_x_chain_with_source_mapping_and_explicit_gaps + mugen_original_chain_real_ken_capture",
                            "-",
                        ),
                    );
                }
                None => op(
                    &mut rows,
                    row(
                        &id,
                        "statedef",
                        Some(&src),
                        "unconverted",
                        "anim nao literal",
                        "-",
                        "animacao nao muda",
                    ),
                ),
            },
            "velset" => {
                let mut it = l.value.splitn(2, ',');
                let x = it.next().unwrap_or("").trim().to_string();
                let y = it.next().map(|v| v.trim().to_string());
                let y_zero = y
                    .as_deref()
                    .map(|v| crate::core::mugen_profile::parse_velocity_q8(v).map(|q| q.q8 == 0))
                    .unwrap_or(Ok(true));
                match (crate::core::mugen_profile::parse_velocity_q8(&x), y_zero) {
                    (Ok(q), Ok(true)) => {
                        st.velset_q8 = Some(q.q8);
                        op(
                            &mut rows,
                            row(
                                &id,
                                "statedef",
                                Some(&src),
                                "converted",
                                &format!(
                                    "velset x = {} (Q8.8 = {}) aplicado na entrada; y = 0",
                                    x, q.q8
                                ),
                                "core::mugen_chain::tests::converts_the_stand_x_chain_with_source_mapping_and_explicit_gaps + mugen_original_chain_real_ken_capture",
                                "so o eixo x; arredondamento Q8.8 ao mais proximo",
                            ),
                        );
                    }
                    _ => op(
                        &mut rows,
                        row(
                            &id,
                            "statedef",
                            Some(&src),
                            "unconverted",
                            "velset fora de x literal com y = 0",
                            "-",
                            "velocidade nao muda",
                        ),
                    ),
                }
            }
            "poweradd" => op(
                &mut rows,
                row(
                    &id,
                    "statedef",
                    Some(&src),
                    "unconverted",
                    "sem barra de energia no perfil",
                    "-",
                    "a energia nao aumenta; efeito original opaco",
                ),
            ),
            "juggle" => op(
                &mut rows,
                row(
                    &id,
                    "statedef",
                    Some(&src),
                    "unconverted",
                    "pontos de juggle dependem de acerto (HitDef)",
                    "-",
                    "sem combate",
                ),
            ),
            "movetype" => op(
                &mut rows,
                row(
                    &id,
                    "statedef",
                    Some(&src),
                    "unconverted",
                    "nenhum gatilho convertido consulta MoveType",
                    "-",
                    "sem efeito observavel na cadeia",
                ),
            ),
            "physics" => op(
                &mut rows,
                row(
                    &id,
                    "statedef",
                    Some(&src),
                    "unconverted",
                    "friccao/gravidade nao modeladas; vx = 0 na cadeia",
                    "-",
                    "sem efeito enquanto a velocidade x for 0 e nao houver movimento vertical",
                ),
            ),
            other => op(
                &mut rows,
                row(
                    &id,
                    "statedef",
                    Some(&src),
                    "unconverted",
                    &format!("parametro '{other}' fora do subconjunto"),
                    "-",
                    "parametro ignorado e declarado",
                ),
            ),
        }
    }
    StateConv { state: st, rows }
}

pub fn stand_in_state() -> StateProgram {
    StateProgram {
        no: 0,
        origin: "stand_in".into(),
        statetype: Some("S".into()),
        ctrl: Some(true),
        velset_q8: None,
        anim: Some(0),
        src: None,
        controllers: Vec::new(),
        movetype: None,
    }
}

/// Bindings autorais MUGEN -> Mega Drive (pad de 3 botoes alcancavel pelo teclado do
/// produto: X/Y/Z nao chegam ao jogo). Declarado no relatorio como `authored`.
pub fn default_bindings() -> BTreeMap<String, String> {
    [
        ("x", "BUTTON_A"),
        ("y", "BUTTON_B"),
        ("z", "BUTTON_C"),
        ("s", "BUTTON_START"),
    ]
    .iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}

fn gather_special(files: &[(String, Vec<Section>)], target: i32) -> Vec<(String, usize, Section2)> {
    let mut out = Vec::new();
    for (file, sections) in files {
        let mut inside = false;
        let mut idx = 0usize;
        for (si, sec) in sections.iter().enumerate() {
            let lower = sec.header.to_ascii_lowercase();
            if let Some(rest) = lower.strip_prefix("statedef") {
                inside = rest.trim().parse::<i32>().ok() == Some(target);
            } else if inside && lower.starts_with("state ") {
                out.push((file.clone(), idx, Section2(si)));
                idx += 1;
            }
        }
    }
    out
}

struct Section2(usize);

/// Analise + conversao. O relatorio separa: convertido da fonte, aproximado, autoral e
/// nao convertido; o programa so existe se a cadeia tiver entrada e retorno executaveis.
pub fn analyze(input: &ChainInput<'_>) -> ChainAnalysis {
    let mut files: Vec<(String, Vec<Section>)> = Vec::new();
    let mut hashes = serde_json::Map::new();
    let mut add = |f: &SourceFile| {
        hashes.insert(f.name.clone(), serde_json::json!(f.sha256));
        files.push((f.name.clone(), parse_sections(&f.text)));
    };
    if let Some(c) = &input.cmd {
        add(c);
    }
    for f in &input.state_files {
        if input.cmd.as_ref().map(|c| c.name.as_str()) != Some(f.name.as_str()) {
            add(f);
        }
    }
    if let Some(f) = &input.common.file {
        add(f);
    }
    let mut rows: Vec<serde_json::Value> = Vec::new();
    let mut dependencies = Vec::new();
    dependencies.push(match (&input.common.requested, &input.common.file) {
        (Some(req), Some(f)) => serde_json::json!({"name": req, "declared_in": format!("{}:{}", input.def_name, input.common.def_line.unwrap_or(0)),
            "status": "resolved_in_package", "sha256": f.sha256, "consequence": "estados comuns lidos do pacote; hash registrado"}),
        (Some(req), None) => serde_json::json!({"name": req, "declared_in": format!("{}:{}", input.def_name, input.common.def_line.unwrap_or(0)),
            "status": "missing", "sha256": null,
            "consequence": "estados comuns (p.ex. estado 0) ausentes do pacote; nenhuma outra instalacao foi presumida equivalente. O estado 0 passa a ser um stand-in AUTORAL minimo"}),
        (None, _) => serde_json::json!({"name": null, "status": "not_declared", "sha256": null,
            "consequence": "DEF sem stcommon"}),
    });

    let (states, warnings) = collect_states(&files);
    // comandos
    let mut commands: BTreeMap<String, CommandDef> = BTreeMap::new();
    let mut bad_commands: BTreeMap<String, String> = BTreeMap::new();
    let mut command_order: Vec<String> = Vec::new();
    let mut unconverted_commands = Vec::new();
    if let Some(cmd) = &input.cmd {
        let sections = &files.iter().find(|(n, _)| *n == cmd.name).unwrap().1;
        for sec in sections {
            if !sec.header.eq_ignore_ascii_case("command") {
                continue;
            }
            let c = classify_command(&cmd.name, sec);
            match (c.def, c.reason) {
                (Some(def), _) => {
                    if commands.contains_key(&def.name) {
                        bad_commands.insert(def.name.clone(), "nome duplicado no CMD".into());
                        commands.remove(&def.name);
                    } else if !bad_commands.contains_key(&def.name) {
                        command_order.push(def.name.clone());
                        commands.insert(def.name.clone(), def);
                    }
                }
                (None, Some(why)) => {
                    bad_commands.insert(c.name.clone(), why.clone());
                    unconverted_commands
                        .push(serde_json::json!({"name": c.name, "source": c.src, "reason": why}));
                }
                (None, None) => {}
            }
        }
    }

    // estados da cadeia
    let mut program_states: Vec<StateProgram> = Vec::new();
    let mut valid_targets: BTreeSet<i32> = input.chain_states.iter().copied().collect();
    valid_targets.insert(0);
    let mut errors: Vec<String> = Vec::new();
    let mut raw_by_no: BTreeMap<i32, &RawState<'_>> = BTreeMap::new();
    for no in valid_targets.clone() {
        match states.get(&no).map(|v| v.as_slice()) {
            Some([one]) => {
                raw_by_no.insert(no, one);
            }
            Some(many) if many.len() > 1 => errors.push(format!(
                "estado {no} definido {} vezes ({}); nenhuma escolha silenciosa",
                many.len(),
                many.iter()
                    .map(|s| format!("{}:{}", s.file, s.def.line))
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
            _ => {}
        }
    }
    for no in &input.chain_states {
        if !raw_by_no.contains_key(no)
            && !errors
                .iter()
                .any(|e| e.starts_with(&format!("estado {no} ")))
        {
            errors.push(format!("estado {no} nao existe no pacote"));
        }
    }
    let mut missing_anim = BTreeSet::new();
    for no in valid_targets.iter().copied() {
        let Some(rs) = raw_by_no.get(&no) else {
            if no == 0 {
                program_states.push(stand_in_state());
                op(&mut rows, row("state.0.stand_in", "statedef", None, "authored",
                    "stand-in RetroDev: statetype S, ctrl 1, anim 0, sem controladores (estado 0 vive em common1.cns, ausente)",
                    "core::mugen_chain::tests::missing_common_is_reported_and_package_common_supplies_state_zero_with_hash",
                    "NAO e o estado 0 original: walk/crouch/jump/turn e demais efeitos do estado comum nao existem"));
            }
            continue;
        };
        let mut conv = convert_statedef(rs);
        if let Some(a) = conv.state.anim {
            if !input.actions.contains_key(&a) {
                missing_anim.insert(no);
                errors.push(format!(
                    "estado {no}: anim {a} nao esta nas acoes selecionadas"
                ));
            }
        }
        rows.append(&mut conv.rows);
        program_states.push(conv.state);
    }
    if !errors.is_empty() {
        return ChainAnalysis {
            program: Err(errors.join("; ")),
            report: serde_json::json!({"schema": SCHEMA, "profile": PROFILE, "status": "refused",
                "errors": errors, "dependencies": dependencies, "files": hashes}),
        };
    }

    // controladores dos estados incluidos
    let mut unconverted_controllers = Vec::new();
    for st in program_states.iter_mut() {
        let Some(rs) = raw_by_no.get(&st.no) else {
            continue;
        };
        let shape = st.anim.and_then(|a| input.shapes.get(&a).map(|s| (a, s)));
        for (idx, sec) in rs.controllers.iter().enumerate() {
            let id = format!("state.{}.controller.{}", st.no, idx);
            match convert_controller(
                rs.file,
                sec,
                st.no,
                idx,
                &commands,
                &bad_commands,
                &valid_targets,
                shape,
            ) {
                Ok(c) => {
                    if c.groups
                        .iter()
                        .flatten()
                        .chain(c.all.iter())
                        .any(|t| matches!(t.expr, Expr::AnimTime { .. }))
                    {
                        let a = st
                            .anim
                            .and_then(|a| input.actions.get(&a))
                            .copied()
                            .unwrap_or(0);
                        if a == 0 {
                            let why =
                                "AnimTime sobre animacao sem fim (-1) nao e convertido".to_string();
                            op(
                                &mut rows,
                                row(
                                    &id,
                                    "controller",
                                    Some(&c.src),
                                    "unconverted",
                                    &why,
                                    "-",
                                    "sem retorno",
                                ),
                            );
                            unconverted_controllers.push(
                                serde_json::json!({"id": id, "source": c.src, "reason": why}),
                            );
                            continue;
                        }
                    }
                    if let Some(h) = &c.hitdef {
                        op(&mut rows, row(&id, "controller", Some(&c.src), "converted",
                            &format!("HitDef (v2): ativa o golpe quando os gatilhos valem, na ordem da fonte; um contato Clsn1 x Clsn2 com o alvo de treino aplica dano {} e desativa o golpe", h.damage),
                            "core::mugen_chain::tests::hitdef_* + mugen_hitdef_real_build_run + mugen-hitdef", "um acerto por ativacao; mudanca de estado desativa; alvo de treino parado e em pe"));
                        for prm in &h.params {
                            let (class, limit) = if prm.class == "executed" {
                                ("converted", "-".to_string())
                            } else {
                                ("approximate", format!("lido, sem efeito: {}", prm.effect))
                            };
                            op(
                                &mut rows,
                                row(
                                    &format!("{id}.param.{}", prm.key),
                                    "hitdef_param",
                                    Some(&prm.src),
                                    class,
                                    &if prm.class == "executed" {
                                        prm.effect.clone()
                                    } else {
                                        format!(
                                            "{} = {} (nao modelado no alvo de treino)",
                                            prm.key, prm.value
                                        )
                                    },
                                    "core::mugen_chain::tests::hitdef_*",
                                    &limit,
                                ),
                            );
                        }
                    } else {
                        op(&mut rows, row(&id, "controller", Some(&c.src), "converted",
                            &format!("ChangeState {} avaliado a cada tick apos o estado -1, na ordem da fonte", c.target),
                            "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original", "-"));
                    }
                    for t in c.all.iter().chain(c.groups.iter().flatten()) {
                        op(
                            &mut rows,
                            row(
                                &format!("{id}.trigger.{}", t.src.line),
                                "trigger",
                                Some(&t.src),
                                "converted",
                                &describe_expr(&t.expr),
                                "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original",
                                "-",
                            ),
                        );
                    }
                    st.controllers.push(c);
                }
                Err(why) => {
                    let src = src_of(rs.file, sec, None);
                    op(&mut rows, row(&id, "controller", Some(&src), "unconverted", &why, "-",
                        "o controlador nao executa; o estado NAO e declarado inteiramente convertido"));
                    unconverted_controllers
                        .push(serde_json::json!({"id": id, "source": src, "reason": why}));
                }
            }
        }
    }

    // estado -1
    let mut special = Vec::new();
    let mut special_total = 0usize;
    let mut special_unconverted = 0usize;
    for (file, idx, Section2(si)) in gather_special(&files, -1) {
        special_total += 1;
        let sections = &files.iter().find(|(n, _)| *n == file).unwrap().1;
        let sec = &sections[si];
        let id = format!("special.-1.controller.{idx}");
        match convert_controller(
            &file,
            sec,
            -1,
            idx,
            &commands,
            &bad_commands,
            &valid_targets,
            None,
        ) {
            Ok(c) => {
                op(&mut rows, row(&id, "controller", Some(&c.src), "converted",
                    &format!("entrada da cadeia: ChangeState {} no estado -1 (antes do estado atual)", c.target),
                    "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original", "-"));
                for t in c.all.iter().chain(c.groups.iter().flatten()) {
                    op(
                        &mut rows,
                        row(
                            &format!("{id}.trigger.{}", t.src.line),
                            "trigger",
                            Some(&t.src),
                            "converted",
                            &describe_expr(&t.expr),
                            "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original",
                            "-",
                        ),
                    );
                }
                let mut c = c;
                c.id = format!("-1#{idx}");
                special.push(c);
            }
            Err(why) => {
                special_unconverted += 1;
                let src = src_of(&file, sec, None);
                // Uma linha por controlador nao convertido do estado -1 (sem omissao).
                unconverted_controllers
                    .push(serde_json::json!({"id": id, "source": src, "reason": why}));
            }
        }
    }
    // -2 / -3: nenhum convertido
    for target in [-2, -3] {
        for (file, idx, Section2(si)) in gather_special(&files, target) {
            let sections = &files.iter().find(|(n, _)| *n == file).unwrap().1;
            let sec = &sections[si];
            let src = src_of(&file, sec, None);
            let reason =
                "estado especial -2/-3 nao convertido (Pos y, PlaySnd e afins fora do subconjunto)";
            unconverted_controllers.push(
                serde_json::json!({"id": format!("special.{target}.controller.{idx}"),
                "source": src, "reason": reason}),
            );
        }
    }

    // comandos usados
    let used: BTreeSet<String> = special
        .iter()
        .chain(program_states.iter().flat_map(|s| s.controllers.iter()))
        .flat_map(|c| c.all.iter().chain(c.groups.iter().flatten()))
        .filter_map(|t| match &t.expr {
            Expr::Command { name, .. } => Some(name.clone()),
            _ => None,
        })
        .collect();
    let program_commands: Vec<CommandDef> = command_order
        .iter()
        .filter(|n| used.contains(*n))
        .filter_map(|n| commands.get(n).cloned())
        .collect();
    for c in &program_commands {
        let (class, how) = match (c.kind.as_str(), c.button.as_deref(), c.dir.as_deref()) {
            ("press", Some(b), _) => (
                "converted",
                format!("borda de subida do botao '{b}' neste tick (time = 1)"),
            ),
            ("hold", Some(b), _) => ("converted", format!("botao '{b}' segurado neste tick")),
            ("release", Some(b), _) => ("converted", format!("soltura do botao '{b}' neste tick")),
            (_, _, Some(d)) => (
                "converted",
                format!(
                    "direcao '{d}' segurada neste tick ({})",
                    if c.any_dir {
                        "qualquer direcao que a contenha"
                    } else {
                        "exata"
                    }
                ),
            ),
            _ => ("unconverted", "-".into()),
        };
        op(&mut rows, row(&format!("command.{}", c.name), "command", Some(&c.src), class, &how,
            "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original", "janela time = 1 e buffer.time padrao 1 (nao consta no CMD; doc primaria de cmd inacessivel no momento do registro)"));
    }
    let bindings = default_bindings();
    for (def, b) in program_commands
        .iter()
        .filter_map(|c| c.button.as_ref().map(|b| (c, b)))
    {
        if let Some(md) = bindings.get(b.as_str()) {
            op(
                &mut rows,
                row(
                    &format!("binding.{}", def.name),
                    "input_binding",
                    None,
                    "authored",
                    &format!("botao MUGEN '{b}' ligado ao {md} do Mega Drive (teclado nativo)"),
                    "core::mugen_profile::tests::original_chain_report_separates_converted_approximate_authored_and_unconverted",
                    "escolha autoral do RetroDev: o pad de 3 botoes do teclado nao tem X/Y/Z",
                ),
            );
        }
    }
    for c in &program_commands {
        if let Some(b) = &c.button {
            if !bindings.contains_key(b.as_str()) {
                return ChainAnalysis {
                    program: Err(format!(
                        "comando '{}': botao '{b}' sem ligacao alcancavel no pad de 3 botoes",
                        c.name
                    )),
                    report: serde_json::json!({"schema": SCHEMA, "profile": PROFILE, "status": "refused",
                        "errors": [format!("botao '{b}' sem ligacao")], "dependencies": dependencies, "files": hashes}),
                };
            }
        }
    }
    op(&mut rows, row("approx.anim_time", "semantics", None, "approximate",
        "AnimTime = ticks desde a entrada da animacao - duracao total do AIR (soma das duracoes)",
        "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original",
        "definicao derivada da documentacao de trigger (AnimTime) e da duracao do AIR; igualdade com o motor original nao certificada"));
    op(&mut rows, row("approx.tick_order", "semantics", None, "approximate",
        "ordem por tick: comandos, -1, estado atual (reinicio no novo estado), depois avanco de Time e da animacao",
        "mugen_original_chain_real_ken_capture + verify-mugen-chain.py + mugen-original", "ordem documentada em cns.html; detalhes finos (pausas, persistent) nao modelados"));

    if special.is_empty() {
        return ChainAnalysis {
            program: Err("nenhum controlador do estado -1 alcanca a cadeia (comando nao suportado ou alvo fora dela)".into()),
            report: serde_json::json!({"schema": SCHEMA, "profile": PROFILE, "status": "refused",
                "errors": ["cadeia sem entrada"], "dependencies": dependencies, "files": hashes,
                "unconverted_controllers": unconverted_controllers, "unconverted_commands": unconverted_commands}),
        };
    }
    let returns = program_states
        .iter()
        .any(|s| s.origin == "source" && s.controllers.iter().any(|c| c.target == 0));
    if !returns {
        return ChainAnalysis {
            program: Err("a cadeia nao tem retorno convertido ao estado 0".into()),
            report: serde_json::json!({"schema": SCHEMA, "profile": PROFILE, "status": "refused",
                "errors": ["cadeia sem retorno"], "dependencies": dependencies, "files": hashes,
                "unconverted_controllers": unconverted_controllers}),
        };
    }
    program_states.sort_by_key(|s| s.no);
    // v2 somente quando a cadeia usa AnimElem ou HitDef convertido; caso contrario o
    // programa e byte a byte o mesmo do v1.
    let v2 = special
        .iter()
        .chain(program_states.iter().flat_map(|s| s.controllers.iter()))
        .any(|c| {
            c.hitdef.is_some()
                || c.all
                    .iter()
                    .chain(c.groups.iter().flatten())
                    .any(|t| matches!(t.expr, Expr::AnimElem { .. }))
        });
    let has_hitdef = program_states
        .iter()
        .any(|s| s.controllers.iter().any(|c| c.hitdef.is_some()));
    let mut target_life = None;
    for st in program_states.iter_mut() {
        if !has_hitdef {
            st.movetype = None;
        }
    }
    if has_hitdef {
        for r in rows.iter_mut() {
            if r["kind"] == "statedef"
                && r["id"].as_str().is_some_and(|id| id.ends_with(".movetype"))
            {
                r["class"] = serde_json::json!("converted");
                r["implementation"] = serde_json::json!("movetype aplicado na entrada; um HitDef ativo so acerta com movetype = A (regra adotada do Mugenesis/SGDK Forge)");
                r["test"] = serde_json::json!("core::mugen_chain::tests::hitdef_*");
                r["limit"] = serde_json::json!("so A/I/H literais");
            }
        }
        let life = files
            .iter()
            .filter(|(n, _)| input.state_files.iter().any(|f| &f.name == n))
            .flat_map(|(n, secs)| secs.iter().map(move |sec| (n, sec)))
            .find(|(_, sec)| sec.header.eq_ignore_ascii_case("data"))
            .and_then(|(n, sec)| {
                sec.lines
                    .iter()
                    .find(|l| l.key == "life")
                    .map(|l| (parse_int(&l.value), src_of(n, sec, Some(l))))
            });
        target_life = Some(match life {
            Some((Some(v), src)) if (1..=32767).contains(&v) => {
                op(
                    &mut rows,
                    row(
                        "target.life",
                        "target",
                        Some(&src),
                        "converted",
                        &format!("vida inicial do alvo de treino = {v} ([Data] life do CNS)"),
                        "core::mugen_chain::tests::hitdef_*",
                        "o alvo de treino e uma copia parada do personagem",
                    ),
                );
                TargetLife {
                    value: v,
                    origin: "source".into(),
                    src: Some(src),
                }
            }
            _ => {
                op(&mut rows, row("target.life", "target", None, "authored",
                    &format!("vida inicial do alvo de treino = {DEFAULT_TARGET_LIFE} (padrao MUGEN; [Data] life ausente ou fora de 1..=32767)"),
                    "core::mugen_chain::tests::hitdef_*", "valor nao veio da fonte"));
                TargetLife {
                    value: DEFAULT_TARGET_LIFE,
                    origin: "default".into(),
                    src: None,
                }
            }
        });
        op(&mut rows, row("target.training", "target", None, "authored",
            "alvo de treino: outra entidade MUGEN da cena escolhida no Inspector; fica parada, em pe (S), sem guarda, virada para a direita; Clsn2 do quadro atual",
            "mugen-hitdef + mugen_hitdef_real_build_run", "nao e um oponente MUGEN: sem estado de acerto, empurrao, defesa, IA ou energia"));
        op(&mut rows, row("approx.hit_order", "semantics", None, "approximate",
            "ordem por tick v2: comandos, -1, estado atual (HitDef ativa), rastro, avanco de Time/animacao do atacante, tick de animacao de todos os sprites, depois contato Clsn1 x Clsn2 com o quadro exibido neste tick",
            "core::mugen_chain::tests::hitdef_* + verify-mugen-chain.py --hitdef", "deteccao apos a logica de todos os jogadores, como cns.html e o Mugenesis; prioridade e troca de golpes nao modeladas"));
        op(&mut rows, row("approx.hit_geometry", "semantics", None, "approximate",
            "caixas relativas ao eixo, facing fixo a direita (sem espelhar x), cantos normalizados (min/max) e bordas inclusivas (como o Mugenesis)",
            "core::mugen_chain::tests::hitdef_* + mugen_hitdef_real_build_run", "borda inclusiva e escolha do Mugenesis; o motor original nao foi executado"));
        op(&mut rows, row("approx.hit_pause", "semantics", None, "approximate",
            "pausetime p1: nos p1 ticks seguintes ao contato o atacante nao executa controladores e Time/animacao nao avancam; p2 so e contado na RAM",
            "mugen_hitdef_real_build_run + verify-mugen-chain.py --hitdef", "comandos pressionados durante a pausa sao perdidos (buffer.time 1); ignorehitpause recusado"));
    }
    let program = Program {
        schema: if v2 { SCHEMA_V2 } else { SCHEMA }.into(),
        profile: if v2 { PROFILE_V2 } else { PROFILE }.into(),
        entity: input.entity.clone(),
        pad: "JOY_1".into(),
        bindings,
        commands: program_commands,
        special,
        states: program_states,
        initial_state: 0,
        digest: String::new(),
        target_life,
    }
    .seal();
    if let Err(e) = program.validate() {
        return ChainAnalysis {
            program: Err(e.clone()),
            report: serde_json::json!({"schema": SCHEMA, "profile": PROFILE, "status": "refused", "errors": [e]}),
        };
    }
    let count = |c: &str| rows.iter().filter(|r| r["class"] == c).count();
    let summary = serde_json::json!({
        "converted": count("converted"), "approximate": count("approximate"),
        "authored": count("authored"), "unconverted": count("unconverted") + unconverted_controllers.len(),
    });
    let chain = describe_chain(&program);
    // Nenhum estado e declarado «completo» se algum item seu ficou de fora.
    let state_status: Vec<serde_json::Value> = program
        .states
        .iter()
        .map(|st| {
            let prefix = format!("state.{}.", st.no);
            let mine: Vec<&serde_json::Value> = rows
                .iter()
                .filter(|r| r["id"].as_str().is_some_and(|id| id.starts_with(&prefix)))
                .collect();
            let converted = mine.iter().filter(|r| r["class"] == "converted").count();
            let unconverted = mine.iter().filter(|r| r["class"] == "unconverted").count();
            let authored = st.origin == "stand_in";
            serde_json::json!({
                "state": st.no, "origin": st.origin, "converted": converted, "unconverted": unconverted,
                "verdict": if authored { "autoral" } else if unconverted == 0 { "completo" } else { "parcial" },
            })
        })
        .collect();
    let hitdefs: Vec<serde_json::Value> = program
        .states
        .iter()
        .flat_map(|st| st.controllers.iter().map(move |c| (st, c)))
        .filter_map(|(st, c)| c.hitdef.as_ref().map(|h| serde_json::json!({
            "controller": c.id, "state": st.no, "anim": st.anim, "source": c.src,
            "triggers": c.all.iter().chain(c.groups.iter().flatten()).map(|t| serde_json::json!({"text": describe_expr(&t.expr), "source": t.src})).collect::<Vec<_>>(),
            "damage": h.damage, "hitflag": h.hitflag, "hits_standing_target": h.hits_standing,
            "pausetime": [h.pause_p1, h.pause_p2], "kill": h.kill,
            "executed": h.params.iter().filter(|p| p.class == "executed").map(|p| serde_json::json!({"key": p.key, "value": p.value, "effect": p.effect, "source": p.src})).collect::<Vec<_>>(),
            "inert": h.params.iter().filter(|p| p.class == "inert").map(|p| serde_json::json!({"key": p.key, "value": p.value, "effect": p.effect, "source": p.src})).collect::<Vec<_>>(),
        })))
        .collect();
    let notice = if program.is_v2() {
        "Cadeia original delimitada com HitDef (v2, Experimental). Nao e conversao integral do personagem nem combate MUGEN: o golpe acerta um alvo de treino parado."
    } else {
        "Cadeia original delimitada (Experimental). Nao e conversao integral do personagem; sem colisao, dano ou combate."
    };
    let report = serde_json::json!({
        "schema": program.schema, "profile": program.profile, "status": "converted", "maturity": "Experimental",
        "hitdefs": hitdefs, "target_life": program.target_life,
        "program_sha256": program.digest, "entity": input.entity,
        "command_bits": program.commands.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
        "chain_states": input.chain_states, "chain": chain, "state_status": state_status,
        "dependencies": dependencies, "files": hashes,
        "operations": rows, "summary": summary,
        "unconverted_controllers": unconverted_controllers,
        "unconverted_commands": unconverted_commands,
        "special_minus1": {"total": special_total, "converted": special_total - special_unconverted, "unconverted": special_unconverted},
        "warnings": warnings,
        "notice": notice,
    });
    ChainAnalysis {
        program: Ok(program),
        report,
    }
}

fn describe_chain(p: &Program) -> serde_json::Value {
    let mut steps = Vec::new();
    for c in &p.special {
        steps.push(serde_json::json!({"step": "entrada", "controller": c.id, "target": c.target, "source": c.src}));
    }
    for s in &p.states {
        for c in &s.controllers {
            steps.push(serde_json::json!({"step": "estado", "state": s.no, "controller": c.id, "target": c.target, "source": c.src}));
        }
    }
    serde_json::json!(steps)
}

/// Estados que algum controlador do estado -1 do CMD aponta, com o resultado da analise para
/// cada um (para o usuario escolher a cadeia na revisao). Recusados trazem o motivo.
pub fn candidates(input: &ChainInput<'_>) -> serde_json::Value {
    let mut sections: Vec<Vec<Section>> = Vec::new();
    if let Some(c) = &input.cmd {
        sections.push(parse_sections(&c.text));
    }
    let mut targets = BTreeSet::new();
    for secs in &sections {
        let mut inside = false;
        for sec in secs {
            let lower = sec.header.to_ascii_lowercase();
            if let Some(rest) = lower.strip_prefix("statedef") {
                inside = rest.trim().parse::<i32>().ok() == Some(-1);
            } else if inside && lower.starts_with("state ") {
                if let Some(v) = sec
                    .lines
                    .iter()
                    .find(|l| l.key == "value")
                    .and_then(|l| parse_int(&l.value))
                {
                    targets.insert(v);
                }
            }
        }
    }
    let mut ok = Vec::new();
    let mut refused = Vec::new();
    for t in targets.into_iter().filter(|t| *t != 0) {
        let mut i = input.clone();
        i.chain_states = vec![t];
        match analyze(&i).program {
            Ok(p) => ok.push(serde_json::json!({
                "state": t,
                "entries": p.special.iter().map(|c| serde_json::json!({"source": c.src})).collect::<Vec<_>>(),
                "commands": p.commands.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
            })),
            Err(e) => refused.push(serde_json::json!({"state": t, "reason": e})),
        }
    }
    serde_json::json!({"available": ok, "refused": refused})
}

pub fn describe_expr(e: &Expr) -> String {
    let c = |o: &Cmp| match o {
        Cmp::Eq => "=",
        Cmp::Ne => "!=",
        Cmp::Lt => "<",
        Cmp::Gt => ">",
        Cmp::Le => "<=",
        Cmp::Ge => ">=",
    };
    match e {
        Expr::Always => "sempre verdadeiro (1)".into(),
        Expr::Command { name, negate } => {
            format!("comando {} \"{name}\"", if *negate { "!=" } else { "=" })
        }
        Expr::StateType { value, negate } => {
            format!("StateType {} {value}", if *negate { "!=" } else { "=" })
        }
        Expr::Ctrl { op, value } => format!("Ctrl {} {value}", c(op)),
        Expr::StateNo { op, value } => format!("StateNo {} {value}", c(op)),
        Expr::Time { op, value } => format!("Time {} {value}", c(op)),
        Expr::AnimTime { op, value } => format!("AnimTime {} {value}", c(op)),
        Expr::AnimElem {
            value,
            start,
            period,
        } => format!(
            "AnimElem = {value} (1o tick do elemento {value}: relogio da animacao mod {period} = {start})"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CMD: &str = "[Command]\nname = \"x\"\ncommand = x\ntime = 1\n\n[Command]\nname = \"holddown\"\ncommand = /$D\ntime = 1\n\n[Command]\nname = \"qcf_x\"\ncommand = ~D, DF, F, x\ntime = 15\n\n[Statedef -1]\n\n[State -1]\ntype = ChangeState\nvalue = 200\ntriggerall = command = \"x\"\ntriggerall = command != \"holddown\"\ntrigger1 = statetype = S\ntrigger1 = ctrl = 1\ntrigger2 = stateno = 200\ntrigger2 = time > 5\n\n[State -1]\ntype = ChangeState\nvalue = 1000\ntriggerall = command = \"qcf_x\"\ntrigger1 = ctrl = 1\n";
    const CNS: &str = "[Statedef 200]\ntype = S\nmovetype = A\nphysics = S\njuggle = 1\nvelset = 0,0\nctrl = 0\nanim = 200\npoweradd = 15\n\n[State 200, 1]\ntype = HitDef\ntrigger1 = AnimElem = 2\ndamage = 34\n\n[State 200, 2]\ntype = ChangeState\ntrigger1 = AnimTime = 0\nvalue = 0\nctrl = 1\n\n[State 200, 3]\ntype = PlaySnd\ntrigger1 = time = 1\nvalue = 6,0\n";

    fn actions() -> BTreeMap<i32, u32> {
        [(0, 36), (200, 6)].into_iter().collect()
    }

    fn input<'a>(cmd: &str, cns: &str, actions: &'a BTreeMap<i32, u32>) -> ChainInput<'a> {
        ChainInput {
            def_name: "k.def".into(),
            cmd: Some(SourceFile::new("k.cmd", cmd.as_bytes())),
            state_files: vec![SourceFile::new("k.cns", cns.as_bytes())],
            common: CommonDependency {
                requested: Some("common1.cns".into()),
                def_line: Some(12),
                file: None,
            },
            chain_states: vec![200],
            actions,
            entity: "kenmasters".into(),
            shapes: BTreeMap::new(),
        }
    }

    #[test]
    fn converts_the_stand_x_chain_with_source_mapping_and_explicit_gaps() {
        let a = actions();
        let r = analyze(&input(CMD, CNS, &a));
        let p = r.program.expect("programa");
        assert_eq!(p.special.len(), 1);
        assert_eq!(p.special[0].all.len(), 2);
        assert_eq!(p.special[0].groups.len(), 2);
        assert_eq!(p.special[0].src.line, 18);
        assert_eq!(
            p.states
                .iter()
                .map(|s| (s.no, s.origin.as_str()))
                .collect::<Vec<_>>(),
            vec![(0, "stand_in"), (200, "source")]
        );
        let s200 = p.states.iter().find(|s| s.no == 200).unwrap();
        assert_eq!(
            (s200.ctrl, s200.velset_q8, s200.anim),
            (Some(false), Some(0), Some(200))
        );
        assert_eq!(s200.controllers.len(), 1);
        assert_eq!(s200.controllers[0].target, 0);
        assert_eq!(s200.controllers[0].set_ctrl, Some(true));
        p.validate().unwrap();
        let rep = r.report;
        let un: Vec<String> = rep["unconverted_controllers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["reason"].as_str().unwrap().to_string())
            .collect();
        assert!(un.iter().any(|w| w.contains("HitDef")), "{un:?}");
        assert!(un.iter().any(|w| w.contains("PlaySnd")), "{un:?}");
        assert!(
            un.iter()
                .any(|w| w.contains("qcf_x") && w.contains("time = 15")),
            "{un:?}"
        );
        assert_eq!(rep["dependencies"][0]["status"], "missing");
        let classes: BTreeSet<&str> = rep["operations"]
            .as_array()
            .unwrap()
            .iter()
            .map(|o| o["class"].as_str().unwrap())
            .collect();
        for c in ["converted", "approximate", "authored", "unconverted"] {
            assert!(classes.contains(c), "classe {c} ausente");
        }
        for o in rep["operations"].as_array().unwrap() {
            if o["class"] == "converted" && o["kind"] != "command" {
                assert!(o["source"]["line"].as_u64().unwrap() > 0, "{o}");
            }
        }
    }

    #[test]
    fn missing_common_is_reported_and_package_common_supplies_state_zero_with_hash() {
        let a = actions();
        let mut i = input(CMD, CNS, &a);
        i.common.file = Some(SourceFile::new(
            "common1.cns",
            b"[Statedef 0]\ntype = S\nctrl = 1\nanim = 0\n\n[State 0, 1]\ntype = ChangeState\ntrigger1 = 1 = 2\nvalue = 200\n",
        ));
        let r = analyze(&i);
        let p = r.program.unwrap();
        let s0 = p.states.iter().find(|s| s.no == 0).unwrap();
        assert_eq!(s0.origin, "source", "estado 0 do pacote, nao stand-in");
        assert_eq!(r.report["dependencies"][0]["status"], "resolved_in_package");
        assert!(
            r.report["dependencies"][0]["sha256"]
                .as_str()
                .unwrap()
                .len()
                == 64
        );
    }

    #[test]
    fn negative_unsupported_condition_leaves_the_controller_unconverted() {
        let a = actions();
        let cns = CNS.replace(
            "trigger1 = AnimTime = 0",
            "trigger1 = AnimTime = 0 && Time > 1",
        );
        let r = analyze(&input(CMD, &cns, &a));
        assert!(r.program.is_err(), "sem retorno convertido nao ha cadeia");
        let cns = CNS.replace("trigger1 = AnimTime = 0", "trigger1 = MoveContact");
        assert!(analyze(&input(CMD, &cns, &a)).program.is_err());
    }

    #[test]
    fn negative_wrong_command_and_missing_command_do_not_enter_the_state() {
        let a = actions();
        let cmd = CMD.replace("command = x\ntime = 1", "command = ~D, DF, x\ntime = 1");
        assert!(
            analyze(&input(&cmd, CNS, &a)).program.is_err(),
            "x virou sequencia"
        );
        let cmd = CMD.replace(
            "triggerall = command = \"x\"",
            "triggerall = command = \"fantasma\"",
        );
        let r = analyze(&input(&cmd, CNS, &a));
        assert!(r.program.is_err());
        assert!(r.report["unconverted_controllers"]
            .to_string()
            .contains("fantasma"));
    }

    #[test]
    fn negative_missing_animation_or_ambiguous_state_refuses() {
        let mut a = actions();
        a.remove(&200);
        assert!(analyze(&input(CMD, CNS, &a)).program.is_err());
        let a = actions();
        let dup = format!("{CNS}\n[Statedef 200]\nanim = 200\n");
        let r = analyze(&input(CMD, &dup, &a));
        assert!(r.program.unwrap_err().contains("definido 2 vezes"));
    }

    #[test]
    fn tampered_program_is_refused_by_validate() {
        let a = actions();
        let p = analyze(&input(CMD, CNS, &a)).program.unwrap();
        let mut bad = p.clone();
        bad.special[0].groups[1][1].expr = Expr::Time {
            op: Cmp::Gt,
            value: 0,
        };
        assert!(bad.validate().unwrap_err().contains("adulterado"));
        let mut bad = p.clone();
        bad.special[0].src.line = 0;
        assert!(bad.validate().is_err());
        let mut bad = p.clone();
        bad.special[0].src.text = "outra coisa".into();
        assert!(bad.validate().unwrap_err().contains("adulterado"));
        // refazer o digest nao salva um mapeamento vazio
        let mut bad = p.clone();
        bad.states[1].src = None;
        assert!(bad.seal().validate().is_err());
    }

    #[test]
    fn expression_grammar_is_strict() {
        assert_eq!(
            parse_expr("Time> 5").unwrap(),
            Expr::Time {
                op: Cmp::Gt,
                value: 5
            }
        );
        assert_eq!(
            parse_expr("AnimTime= 0").unwrap(),
            Expr::AnimTime {
                op: Cmp::Eq,
                value: 0
            }
        );
        assert_eq!(
            parse_expr("command != \"holddown\"").unwrap(),
            Expr::Command {
                name: "holddown".into(),
                negate: true
            }
        );
        for bad in [
            "MoveContact",
            "Pos y != 0",
            "power >= 1000",
            "Time > 1 && Ctrl",
            "stateno = 200, 210",
            "Vel X = 0",
            "command = x",
            "statetype > S",
            "time = abc",
            "p2statetype = A",
        ] {
            assert!(parse_expr(bad).is_err(), "{bad} deveria ser recusado");
        }
    }

    #[test]
    fn independent_programs_do_not_share_state() {
        let a = actions();
        let mut i1 = input(CMD, CNS, &a);
        let mut i2 = input(CMD, CNS, &a);
        i1.entity = "a".into();
        i2.entity = "b".into();
        let (p1, p2) = (analyze(&i1).program.unwrap(), analyze(&i2).program.unwrap());
        assert_eq!(
            p1.digest, p2.digest,
            "o nome da entidade nao entra no digest"
        );
        assert_ne!(p1.entity, p2.entity);
        assert_eq!(p1.states, p2.states);
    }

    // ------------------------------------------------------------ v2: HitDef original

    fn ken_shapes() -> BTreeMap<i32, ActionShape> {
        [
            (
                0,
                ActionShape {
                    durations: vec![Some(6); 6],
                    loopstart: None,
                    flipped: vec![false; 6],
                    clsn1: vec![0; 6],
                },
            ),
            (
                200,
                ActionShape {
                    durations: vec![Some(2), Some(2), Some(2)],
                    loopstart: None,
                    flipped: vec![false; 3],
                    clsn1: vec![0, 1, 0],
                },
            ),
        ]
        .into_iter()
        .collect()
    }

    fn v2_input<'a>(cns: &str, actions: &'a BTreeMap<i32, u32>) -> ChainInput<'a> {
        let mut i = input(CMD, cns, actions);
        i.shapes = ken_shapes();
        i
    }

    const KEN_HITDEF: &str = "[Data]\nlife = 1000\n\n[Statedef 200]\ntype = S\nmovetype= A\nphysics = S\nvelset = 0,0\nctrl = 0\nanim = 200\n\n[State 200, 1]\ntype = HitDef\ntrigger1 = AnimElem = 2\nattr = S,NA\ndamage = 34\nanimtype = Light\ngetpower = 30,15\nguardflag = MA\nhitflag = MAF\npriority= 3,Hit\npausetime = 7,8\nsparkxy = -10,-70\nhitsound = S10,0\nground.velocity = -4\nair.velocity = -1.3,-3\n\n[State 200, 2]\ntype = ChangeState\ntrigger1 = AnimTime= 0\nvalue =0\nctrl = 1\n";

    #[test]
    fn hitdef_converts_with_animelem_source_mapping_and_declared_params() {
        let a = actions();
        let r = analyze(&v2_input(KEN_HITDEF, &a));
        let p = r.program.expect("v2 convertido");
        assert_eq!(p.profile, PROFILE_V2);
        assert_eq!(p.schema, SCHEMA_V2);
        let s200 = p.states.iter().find(|s| s.no == 200).unwrap();
        assert_eq!(s200.movetype.as_deref(), Some("A"));
        let hd = &s200.controllers[0];
        let h = hd.hitdef.as_ref().expect("HitDef");
        assert_eq!((h.damage, h.pause_p1, h.pause_p2, h.kill), (34, 7, 8, true));
        assert_eq!(h.hitflag, "MAF");
        assert!(h.hits_standing);
        assert_eq!(hd.src.line, 12, "{:?}", hd.src);
        assert_eq!(
            hd.groups[0][0].expr,
            Expr::AnimElem {
                value: 2,
                start: 2,
                period: 6
            }
        );
        let exec: Vec<&str> = h
            .params
            .iter()
            .filter(|p| p.class == "executed")
            .map(|p| p.key.as_str())
            .collect();
        assert_eq!(exec, ["damage", "hitflag", "pausetime"]);
        assert!(h
            .params
            .iter()
            .all(|p| p.src.line > 0 && !p.src.text.is_empty()));
        assert!(h
            .params
            .iter()
            .any(|p| p.key == "ground.velocity" && p.class == "inert"));
        let life = p.target_life.as_ref().unwrap();
        assert_eq!((life.value, life.origin.as_str()), (1000, "source"));
        // a ordem da fonte e preservada: HitDef antes do ChangeState de retorno
        assert!(s200.controllers[1].hitdef.is_none());
        assert_eq!(s200.controllers[1].target, 0);
        p.validate().unwrap();
        let rep = &r.report;
        assert_eq!(rep["profile"], PROFILE_V2);
        assert_eq!(rep["hitdefs"][0]["damage"], 34);
        assert!(rep["operations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|o| o["id"] == "state.200.movetype" && o["class"] == "converted"));
        assert!(!rep["unconverted_controllers"]
            .as_array()
            .unwrap()
            .iter()
            .any(|u| u["reason"].as_str().unwrap_or("").contains("HitDef")));
    }

    #[test]
    fn hitdef_v1_compatibility_without_air_shapes_is_byte_identical() {
        // Sem a forma do AIR a analise e exatamente a do v1: HitDef nao convertido.
        let a = actions();
        let p = analyze(&input(CMD, CNS, &a)).program.unwrap();
        assert_eq!(p.profile, PROFILE);
        let json = serde_json::to_string(&p).unwrap();
        for absent in ["hitdef", "movetype", "target_life"] {
            assert!(!json.contains(absent), "{absent} vazou no v1: {json}");
        }
        // um programa v1 serializado antes do v2 continua lendo e validando
        let reread: Program = serde_json::from_str(&json).unwrap();
        reread.validate().unwrap();
        assert_eq!(reread.compute_digest(), p.digest);
        // v1 com recurso do v2 e recusado (nao ha promocao silenciosa)
        let mut bad = p.clone();
        bad.states[0].movetype = Some("A".into());
        assert!(bad.seal().validate().unwrap_err().contains("v1"));
    }

    #[test]
    fn hitdef_out_of_contract_cases_are_refused_with_the_reason() {
        let a = actions();
        let cases: [(&str, &str, &str); 7] = [
            ("damage = 34", "damage = 34\np2stateno = 5000", "p2stateno"),
            (
                "damage = 34",
                "damage = 34\nignorehitpause = 1",
                "ignorehitpause",
            ),
            ("hitflag = MAF", "hitflag = MAF+", "hitflag"),
            ("damage = 34", "damage = 34 * 2", "damage"),
            ("pausetime = 7,8", "pausetime = 7,var(1)", "pausetime"),
            (
                "trigger1 = AnimElem = 2",
                "trigger1 = AnimElem = 9",
                "elementos",
            ),
            (
                "trigger1 = AnimElem = 2",
                "trigger1 = MoveContact",
                "MoveContact",
            ),
        ];
        for (from, to, needle) in cases {
            let cns = KEN_HITDEF.replace(from, to);
            let r = analyze(&v2_input(&cns, &a));
            let p = r.program.unwrap();
            assert!(p.hitdefs().is_empty(), "{to}: HitDef nao deveria converter");
            assert_eq!(p.profile, PROFILE, "{to}: sem recurso v2 fica v1");
            let un = r.report["unconverted_controllers"].to_string();
            assert!(un.contains(needle), "{to}: motivo sem '{needle}': {un}");
        }
        // elemento espelhado na acao do golpe
        let mut i = v2_input(KEN_HITDEF, &a);
        i.shapes.get_mut(&200).unwrap().flipped[1] = true;
        let r = analyze(&i);
        assert!(r.program.unwrap().hitdefs().is_empty());
        assert!(r.report["unconverted_controllers"]
            .to_string()
            .contains("espelhado"));
        // Loopstart na acao do golpe
        let mut i = v2_input(KEN_HITDEF, &a);
        i.shapes.get_mut(&200).unwrap().loopstart = Some(1);
        assert!(analyze(&i).program.unwrap().hitdefs().is_empty());
        // sem Clsn1
        let mut i = v2_input(KEN_HITDEF, &a);
        i.shapes.get_mut(&200).unwrap().clsn1 = vec![0, 0, 0];
        assert!(analyze(&i).report["unconverted_controllers"]
            .to_string()
            .contains("Clsn1"));
    }

    #[test]
    fn hitdef_defaults_life_and_hitflag_reach() {
        let a = actions();
        let cns = KEN_HITDEF
            .replace("[Data]\nlife = 1000\n\n", "")
            .replace("hitflag = MAF", "hitflag = A");
        let p = analyze(&v2_input(&cns, &a)).program.unwrap();
        let life = p.target_life.clone().unwrap();
        assert_eq!(
            (life.value, life.origin.as_str()),
            (DEFAULT_TARGET_LIFE, "default")
        );
        assert!(life.src.is_none());
        let h = p.hitdefs()[0].hitdef.clone().unwrap();
        assert!(!h.hits_standing, "hitflag A nao alcanca o alvo em pe");
    }

    #[test]
    fn hitdef_tampering_blocks_validation() {
        let a = actions();
        let p = analyze(&v2_input(KEN_HITDEF, &a)).program.unwrap();
        let mut bad = p.clone();
        bad.states
            .iter_mut()
            .find(|s| s.no == 200)
            .unwrap()
            .controllers[0]
            .hitdef
            .as_mut()
            .unwrap()
            .damage = 99;
        assert!(bad.validate().unwrap_err().contains("adulterado"));
        let mut bad = p.clone();
        bad.states
            .iter_mut()
            .find(|s| s.no == 200)
            .unwrap()
            .controllers[0]
            .hitdef
            .as_mut()
            .unwrap()
            .params[0]
            .src
            .line = 0;
        assert!(bad.seal().validate().is_err());
        let mut bad = p.clone();
        bad.target_life = None;
        assert!(bad.seal().validate().unwrap_err().contains("vida"));
        let mut bad = p;
        bad.states
            .iter_mut()
            .find(|s| s.no == 200)
            .unwrap()
            .controllers[0]
            .hitdef
            .as_mut()
            .unwrap()
            .hitflag = "A".into();
        assert!(bad.seal().validate().unwrap_err().contains("hitflag"));
    }
}
