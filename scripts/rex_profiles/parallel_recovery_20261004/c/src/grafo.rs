//! Analise de fluxo delimitada do `'rex-cfg/v2': blocos, arestas, chamadas,
//! fronteiras, cobertura e veredito de sitio.
//!
//! O que esta camada NAO faz, por contrato (CONTRACT §0 e §6):
//! - nao promove o grau de evidencia de uma raiz declarada;
//! - nao resolve chamada indireta por aparencia (o alvo permanece desconhecido);
//! - nao inventa comprimento de opcode nao comprovado (o caminho para);
//! - nao decodifica nada fora da regiao declarada;
//! - nao propaga pilha nem registradores (`params`/`clobbers` sao fixos).
//!
//! Determinismo: todos os conjuntos de trabalho sao arvores ordenadas
//! (`BTreeMap`/`BTreeSet`) e as listas de saida sao ordenadas por endereco. Duas
//! execucoes sobre os mesmos bytes dao o mesmo texto byte a byte.

use std::collections::{BTreeMap, BTreeSet};

use crate::decode::{decode_at, Flow, FrontierKind, Ins, Outcome};

/// Vocabulario de proveniencia de raiz (CONTRACT §1). A ferramenta so aceita
/// esses textos e nunca os reinterpreta.
pub const VOCABULARIO_PROVENIENCIA: &[&str] = &[
    "candidato",
    "referencia-estatica",
    "vinculo-estrutural",
    "vetor-plataforma",
    "dentro-de-fluxo",
];

/// Textos fixos de limite, exigidos no export (CONTRACT §4 `limites`).
pub const LIMITES: &[&str] = &[
    "analise intra-regiao apenas; fluxo que sai da regiao termina na fronteira",
    "sem propagação de pilha/registrador: graus de parametro sao sempre nao-inferidos",
    "sem execucao: nada aqui prova consumo em runtime (observado-em-runtime nao e alegado)",
    "dentro-de-fluxo nao implica alcancabilidade desde o boot nem execucao real",
    "miolo-de-instrucao prova que o casamento linear ali nao e inicio de instrucao DESTE fluxo",
    "subconjunto 68000 documentado: opcode fora da tabela interrompe o caminho",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Raiz {
    pub endereco: u32,
    pub proveniencia: String,
    pub evidencia: Option<String>,
    /// grau registrado pelo operador; a analise NUNCA promove este campo
    pub grau: String,
    /// se a raiz foi criada por esta analise ao resolver uma chamada
    pub derivada: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Tipo {
    Queda,
    Desvio,
    Chamada,
    RetornoFronteira,
}

impl Tipo {
    pub fn label(self) -> &'static str {
        match self {
            Tipo::Queda => "queda",
            Tipo::Desvio => "desvio",
            Tipo::Chamada => "chamada",
            Tipo::RetornoFronteira => "retorno-fronteira",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Status {
    Resolvido,
    ForaDaRegiao,
    IndiretoOpaco,
    Armadilha,
}

impl Status {
    pub fn label(self) -> &'static str {
        match self {
            Status::Resolvido => "resolvido",
            Status::ForaDaRegiao => "fora-da-regiao",
            Status::IndiretoOpaco => "indireto-opaco",
            Status::Armadilha => "armadilha",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Aresta {
    pub origem: u32,
    pub alvo: Option<u32>,
    pub tipo: Tipo,
    pub status: Status,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Chamada {
    pub sitio: u32,
    pub alvo: Option<u32>,
    /// familia do opcode (`bsr`, `jsr`, `jmp`) — apresentacao, nao semantica
    pub forma: String,
    pub params: &'static str,
    pub clobbers: &'static str,
    pub status: Status,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FronteiraExport {
    pub endereco: u32,
    pub tipo: String,
    pub opcode: Option<u16>,
    pub motivo: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstrucaoView {
    pub endereco: u32,
    pub tam: u16,
    pub mnem: String,
    /// familia do mnemonico, comparavel ao primeiro token do objdump
    pub classe: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sucessor {
    pub alvo: u32,
    pub tipo: Tipo,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bloco {
    pub entrada: u32,
    pub instrucoes: Vec<InstrucaoView>,
    pub saida: String,
    pub sucessores: Vec<Sucessor>,
    /// enderecos que apontam para este bloco, ou `"raiz"` quando a entrada foi
    /// declarada pelo operador
    pub alcancado_por: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Vao {
    pub inicio: u32,
    pub fim: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cobertura {
    pub bytes_decodificados: u32,
    pub bytes_regiao: u32,
    /// razao como texto fixo (`"0.5000"`), porque o JSON do projeto so carrega
    /// inteiros e a formatacao de float nao e determinista entre plataformas
    pub fracao: String,
    pub vaos: Vec<Vao>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Veredito {
    InstrucaoDeBloco,
    MioloDeInstrucao,
    DentroRegiaoNaoAlcancado,
    ForaDaRegiao,
    PontoDeFronteira,
}

impl Veredito {
    pub fn label(self) -> &'static str {
        match self {
            Veredito::InstrucaoDeBloco => "instrucao-de-bloco",
            Veredito::MioloDeInstrucao => "miolo-de-instrucao",
            Veredito::DentroRegiaoNaoAlcancado => "dentro-regiao-nao-alcancado",
            Veredito::ForaDaRegiao => "fora-da-regiao",
            Veredito::PontoDeFronteira => "ponto-de-fronteira",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sitio {
    pub endereco: u32,
    pub veredito: String,
    /// entrada do bloco que cobre o endereco, quando houver
    pub bloco: Option<u32>,
}

/// Resultado de uma analise. Nao carrega caminho/SHA do objeto: esses campos sao
/// do export (CONTRACT §4 `objeto`) e vivem em `export.rs`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Analise {
    pub regiao: (u32, u32),
    pub raizes: Vec<Raiz>,
    pub blocos: Vec<Bloco>,
    pub arestas: Vec<Aresta>,
    pub chamadas: Vec<Chamada>,
    pub fronteiras: Vec<FronteiraExport>,
    pub cobertura: Cobertura,
    pub sitios: Vec<Sitio>,
    pub limites: Vec<&'static str>,
    /// true quando o trabalho foi interrompido por `--max-insn`
    pub atingiu_limite_de_trabalho: bool,
}

impl Analise {
    /// Enderecos de inicio de instrucao reclamados por algum bloco, ordenados.
    pub fn enderecos_decodificados(&self) -> Vec<u32> {
        self.blocos
            .iter()
            .flat_map(|b| b.instrucoes.iter().map(|i| i.endereco))
            .collect()
    }

    pub fn veredito_sitio(&self, endereco: u32) -> Veredito {
        let (ini, fim) = self.regiao;
        if endereco < ini || endereco >= fim {
            return Veredito::ForaDaRegiao;
        }
        for b in &self.blocos {
            for i in &b.instrucoes {
                if endereco == i.endereco {
                    // um sitio que e instrucao comprovada conserva o grau mesmo
                    // quando a analise tambem registra fronteira ali (chamada ou
                    // desvio cujo alvo cai fora da regiao): a fronteira ja esta
                    // em `fronteiras`, e o contrato nao define que ela encobre a
                    // instrucao (EXPECTATIONS R3 expectativa 3)
                    return Veredito::InstrucaoDeBloco;
                }
            }
        }
        if self.fronteiras.iter().any(|f| f.endereco == endereco) {
            return Veredito::PontoDeFronteira;
        }
        for b in &self.blocos {
            for i in &b.instrucoes {
                if endereco > i.endereco && endereco < i.endereco + u32::from(i.tam) {
                    return Veredito::MioloDeInstrucao;
                }
            }
        }
        Veredito::DentroRegiaoNaoAlcancado
    }

    /// Entrada do bloco que cobre o endereco (para o campo `bloco` dos sitios).
    fn bloco_em(&self, endereco: u32) -> Option<u32> {
        self.blocos.iter().find_map(|b| {
            b.instrucoes
                .iter()
                .any(|i| endereco >= i.endereco && endereco < i.endereco + u32::from(i.tam))
                .then_some(b.entrada)
        })
    }

    fn sitio(&self, endereco: u32) -> Sitio {
        Sitio {
            endereco,
            veredito: self.veredito_sitio(endereco).label().to_string(),
            bloco: self.bloco_em(endereco),
        }
    }
}

// ---------------------------------------------------------------------------
// nucleo
// ---------------------------------------------------------------------------

/// Item ja reclamado pelo caminho: instrucao comprovada ou forma indireta cujo
/// comprimento esta na tabela mas cujo alvo permanece desconhecido.
#[derive(Debug, Clone)]
struct No {
    endereco: u32,
    tam: u16,
    mnem: String,
    classe: String,
    /// terminador de caminho? (desvio sem queda/JMP/chamada/rts/trap/fronteira indireta)
    terminador: bool,
}

struct Andarilho<'a> {
    /// arquivo inteiro; os enderecos de trabalho sao relativos ao inicio dele
    bytes: &'a [u8],
    /// inicio da regiao (inclusivo) — alvo abaixo dele NAO e dentro da regiao
    ini: u32,
    /// fim da regiao, ja limitado ao tamanho do arquivo
    fim: u32,
    nos: BTreeMap<u32, No>,
    arestas: Vec<Aresta>,
    chamadas: Vec<Chamada>,
    fronteiras: Vec<FronteiraExport>,
    /// enderecos que devem comecar um bloco
    lideres: BTreeSet<u32>,
    fila: BTreeSet<u32>,
    trabalho: u64,
    max_trabalho: u64,
    atingiu_limite: bool,
}

impl<'a> Andarilho<'a> {
    fn reclama_em(&self, addr: u32) -> bool {
        self.nos.contains_key(&addr)
    }

    /// Dentro da regiao declarada: inicio inclusivo, fim exclusivo. Um alvo
    /// ABAIXO do inicio esta fora da regiao tanto quanto um acima do fim — a
    /// analise e intra-regiao (CONTRACT §6).
    fn dentro(&self, alvo: u32) -> bool {
        alvo >= self.ini && alvo < self.fim
    }

    fn registre_aresta(&mut self, origem: u32, alvo: Option<u32>, tipo: Tipo, status: Status) {
        // dedupe: a passada de blocos pode sintetizar a mesma queda
        if self
            .arestas
            .iter()
            .any(|a| a.origem == origem && a.alvo == alvo && a.tipo == tipo)
        {
            return;
        }
        self.arestas.push(Aresta {
            origem,
            alvo,
            tipo,
            status,
        });
        if let Some(a) = alvo {
            if self.dentro(a) {
                // todo alvo interno e um ponto de entrada a analisar: lider para
                // a particao de blocos e item de fila para o caminho
                self.lideres.insert(a);
                self.fila.insert(a);
            }
        }
    }

    fn fronteira(
        &mut self,
        endereco: u32,
        tipo: &str,
        opcode: Option<u16>,
        motivo: impl Into<String>,
    ) {
        if self.fronteiras.iter().any(|f| f.endereco == endereco) {
            return;
        }
        self.fronteiras.push(FronteiraExport {
            endereco,
            tipo: tipo.to_string(),
            opcode,
            motivo: motivo.into(),
        });
    }

    /// Traduz o tipo interno de fronteira para o vocabulario congelado do
    /// contrato: `truncada` (faltam bytes na janela) e sempre um limite de
    /// regiao visto do lado de dentro.
    fn tipo_de_fronteira(kind: FrontierKind) -> &'static str {
        match kind {
            FrontierKind::Truncada | FrontierKind::LimiteDeRegiao => "limite-de-regiao",
            FrontierKind::IndirectOpaque => "indirect-opaque",
            FrontierKind::TrapOpaco => "trap-opaco",
            FrontierKind::LimiteDeTrabalho => "limite-de-trabalho",
            FrontierKind::OpcodeForaDoSubconjunto => "opcode-fora-do-subconjunto",
        }
    }

    fn forma_indireta(opcode: Option<u16>) -> &'static str {
        match opcode {
            Some(op) if (op & 0xFFC0) == 0x4E80 => "jsr",
            Some(op) if (op & 0xFFC0) == 0x4EC0 => "jmp",
            _ => "desconhecida",
        }
    }

    fn caminhar(&mut self, start: u32) {
        let mut addr = start;
        loop {
            if self.reclama_em(addr) {
                // ponto de juntura: a cadeia anterior ja reclamou este endereco
                return;
            }
            if addr >= self.fim {
                self.fronteira(
                    addr,
                    "limite-de-regiao",
                    None,
                    "a proxima instrucao comecaria no ou alem do fim da regiao declarada",
                );
                return;
            }
            if self.trabalho >= self.max_trabalho {
                self.atingiu_limite = true;
                self.fronteira(
                    addr,
                    "limite-de-trabalho",
                    None,
                    "limite de trabalho atingido; o caminho para aqui sem hipoteses",
                );
                return;
            }
            let janela = &self.bytes[addr as usize..self.fim as usize];
            match decode_at(janela, addr) {
                Outcome::Insn(ins) => {
                    self.trabalho += 1;
                    let proximo = ins.addr + u32::from(ins.len);
                    let terminador = match &ins.flow {
                        Flow::Normal => false,
                        Flow::Branch { taken, has_fall } => {
                            self.aresta_de_desvio(&ins, *taken, *has_fall, proximo);
                            !*has_fall
                        }
                        Flow::Call { target } => {
                            self.aresta_de_chamada(&ins, *target, proximo);
                            true
                        }
                        Flow::Jmp { target } => {
                            self.aresta_de_jmp(&ins, *target);
                            true
                        }
                        Flow::Ret => {
                            self.registre_aresta(
                                ins.addr,
                                None,
                                Tipo::RetornoFronteira,
                                Status::IndiretoOpaco,
                            );
                            true
                        }
                        Flow::Trap => {
                            self.fronteira(
                                ins.addr,
                                "trap-opaco",
                                Some(ler_word(self.bytes, ins.addr)),
                                "TRAP #n: efeito de excepcionamento fora do modelo; o caminho para",
                            );
                            true
                        }
                    };
                    self.nos.insert(
                        ins.addr,
                        No {
                            endereco: ins.addr,
                            tam: ins.len,
                            mnem: ins.mnem.clone(),
                            classe: ins.family.clone(),
                            terminador,
                        },
                    );
                    if terminador {
                        return;
                    }
                    addr = proximo;
                }
                Outcome::Frontier(f) => {
                    let tipo = Self::tipo_de_fronteira(f.kind);
                    // JMP/JSR indiretos tem comprimento na tabela: os bytes sao
                    // reclamados, o alvo nao. Nenhum dos dois e inventado.
                    if let Some(tam) = f.consumo.filter(|_| f.kind == FrontierKind::IndirectOpaque)
                    {
                        let forma = Self::forma_indireta(f.opcode);
                        self.trabalho += 1;
                        self.nos.insert(
                            addr,
                            No {
                                endereco: addr,
                                tam,
                                mnem: format!("{forma} <indireto>"),
                                classe: forma.to_string(),
                                terminador: true,
                            },
                        );
                        self.fronteiras.retain(|x| x.endereco != addr);
                        self.fronteira(addr, tipo, f.opcode, f.motivo.clone());
                        self.registre_aresta(addr, None, Tipo::Chamada, Status::IndiretoOpaco);
                        self.chamadas.push(Chamada {
                            sitio: addr,
                            alvo: None,
                            forma: forma.to_string(),
                            params: "nao-inferidos",
                            clobbers: "nao-modelado",
                            status: Status::IndiretoOpaco,
                        });
                        return;
                    }
                    self.fronteira(addr, tipo, f.opcode, f.motivo);
                    return;
                }
            }
        }
    }

    fn aresta_de_desvio(&mut self, ins: &Ins, taken: u32, has_fall: bool, proximo: u32) {
        let dentro = self.dentro(taken);
        self.registre_aresta(ins.addr, Some(taken), Tipo::Desvio, se_resolvido(dentro));
        if !dentro {
            self.fronteira(
                ins.addr,
                "limite-de-regiao",
                Some(ler_word(self.bytes, ins.addr)),
                format!("desvio aponta para {taken:#x}, fora da regiao declarada"),
            );
        }
        if has_fall {
            self.registre_aresta(ins.addr, Some(proximo), Tipo::Queda, Status::Resolvido);
        }
    }

    fn aresta_de_chamada(&mut self, ins: &Ins, target: u32, proximo: u32) {
        let dentro = self.dentro(target);
        self.registre_aresta(ins.addr, Some(target), Tipo::Chamada, se_resolvido(dentro));
        self.registre_aresta(ins.addr, Some(proximo), Tipo::Queda, Status::Resolvido);
        self.chamadas.push(Chamada {
            sitio: ins.addr,
            alvo: Some(target),
            forma: ins.family.clone(),
            params: "nao-inferidos",
            clobbers: "nao-modelado",
            status: se_resolvido(dentro),
        });
        if dentro {
            self.fila.insert(target);
        } else {
            self.fronteira(
                ins.addr,
                "limite-de-regiao",
                Some(ler_word(self.bytes, ins.addr)),
                format!(
                    "chamada aponta para {target:#x}, fora da regiao: nada fora e decodificado"
                ),
            );
        }
    }

    fn aresta_de_jmp(&mut self, ins: &Ins, target: u32) {
        let dentro = self.dentro(target);
        self.registre_aresta(ins.addr, Some(target), Tipo::Desvio, se_resolvido(dentro));
        self.chamadas.push(Chamada {
            sitio: ins.addr,
            alvo: Some(target),
            forma: "jmp".to_string(),
            params: "nao-inferidos",
            clobbers: "nao-modelado",
            status: se_resolvido(dentro),
        });
        if dentro {
            // JMP e uma transferencia: o destino entra como raiz derivada
            self.fila.insert(target);
        } else {
            self.fronteira(
                ins.addr,
                "limite-de-regiao",
                Some(ler_word(self.bytes, ins.addr)),
                format!("salto aponta para {target:#x}, fora da regiao declarada"),
            );
        }
    }
}

fn se_resolvido(dentro: bool) -> Status {
    if dentro {
        Status::Resolvido
    } else {
        Status::ForaDaRegiao
    }
}

fn ler_word(bytes: &[u8], addr: u32) -> u16 {
    let a = addr as usize;
    if a + 1 < bytes.len() {
        u16::from_be_bytes([bytes[a], bytes[a + 1]])
    } else {
        0
    }
}

/// Analisa `bytes` a partir de raizes explicitas dentro de `regiao`
/// (inicio inclusivo, fim exclusivo), limitado a `max_insn` instrucoes.
///
/// Os enderecos de `regiao`, `raizes` e `sitios` sao relativos ao inicio do
/// buffer. A CLI trata `--origin` deslocando o proprio buffer (preenche os bytes
/// antes da base), de modo que os enderecos exportados sejam os absolutos que o
/// contrato pede sem reimpor a base em cada campo.
pub fn analisar(
    bytes: &[u8],
    raizes: &[u32],
    regiao: (u32, u32),
    sitios: &[u32],
    max_insn: u64,
) -> Result<Analise, String> {
    let pares: Vec<(u32, &'static str)> = raizes.iter().map(|a| (*a, "candidato")).collect();
    analisar_com_proveniencias(bytes, &pares, regiao, sitios, max_insn)
}

/// Igual a [`analisar`], mas cada raiz traz a proveniencia declarada pelo
/// operador. Proveniencia fora do vocabulario = erro (CONTRACT §2).
pub fn analisar_com_proveniencias(
    bytes: &[u8],
    raizes: &[(u32, &str)],
    regiao: (u32, u32),
    sitios: &[u32],
    max_insn: u64,
) -> Result<Analise, String> {
    let declaradas: Vec<RaizDeclarada> = raizes
        .iter()
        .map(|(a, p)| RaizDeclarada {
            endereco: *a,
            proveniencia: (*p).to_string(),
            evidencia: None,
        })
        .collect();
    analisar_com_evidencias(bytes, &declaradas, regiao, sitios, max_insn)
}

/// Raiz como o operador a declara na CLI (§2: `--root` / `--root-prov` /
/// `--root-evidence`, por posicao).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RaizDeclarada {
    pub endereco: u32,
    pub proveniencia: String,
    pub evidencia: Option<String>,
}

/// Forma completa: cada raiz traz proveniencia e evidencia textual. O grau
/// exportado e a proveniencia declarada, sempre (§0.1: nunca promovido).
pub fn analisar_com_evidencias(
    bytes: &[u8],
    raizes: &[RaizDeclarada],
    regiao: (u32, u32),
    sitios: &[u32],
    max_insn: u64,
) -> Result<Analise, String> {
    let (ini, fim_declarado) = regiao;
    if bytes.is_empty() {
        return Err("buffer vazio".to_string());
    }
    if ini >= bytes.len() as u32 {
        return Err(format!(
            "regiao invalida: inicio {ini:#x} alem do tamanho {:#x}",
            bytes.len()
        ));
    }
    // A regiao e interceptada com o objeto: nada fora do arquivo pode ser
    // decodificado, e o fim exclusivo nunca ultrapassa os bytes disponíveis.
    let fim = fim_declarado.min(bytes.len() as u32);
    if ini >= fim {
        return Err(format!(
            "regiao vazia depois do recorte: {ini:#x}..{fim:#x}"
        ));
    }
    if raizes.is_empty() {
        return Err("nenhuma raiz declarada".to_string());
    }
    for r in raizes {
        if !VOCABULARIO_PROVENIENCIA.contains(&r.proveniencia.as_str()) {
            return Err(format!(
                "proveniencia {:?} fora do vocabulario (§1): {}",
                r.proveniencia,
                VOCABULARIO_PROVENIENCIA.join(", ")
            ));
        }
        if r.endereco < ini || r.endereco >= fim {
            return Err(format!(
                "raiz {:#x} fora da regiao {ini:#x}..{fim:#x}",
                r.endereco
            ));
        }
    }
    if max_insn == 0 {
        return Err("--max-insn precisa ser >= 1".to_string());
    }

    let mut fila: BTreeSet<u32> = raizes.iter().map(|r| r.endereco).collect();
    let mut w = Andarilho {
        bytes,
        ini,
        fim,
        nos: BTreeMap::new(),
        arestas: Vec::new(),
        chamadas: Vec::new(),
        fronteiras: Vec::new(),
        lideres: BTreeSet::new(),
        fila: BTreeSet::new(),
        trabalho: 0,
        max_trabalho: max_insn,
        atingiu_limite: false,
    };
    // raizes declaradas sao leader por definicao
    for r in raizes {
        w.lideres.insert(r.endereco);
    }
    while let Some(&start) = fila.iter().next() {
        fila.take(&start);
        if w.reclama_em(start) {
            continue;
        }
        w.caminhar(start);
        // novos alvos entram pela fila interna do andarilho
        for n in std::mem::take(&mut w.fila) {
            fila.insert(n);
        }
    }

    let raizes_out = montra_raizes(raizes, &w);
    let (mut blocos, sinteticas) = montar_blocos(&w);
    let arestas = {
        let mut a = w.arestas.clone();
        a.extend(sinteticas);
        a.sort_by_key(|e| (e.origem, e.tipo as u8, e.alvo.unwrap_or(u32::MAX)));
        a.dedup();
        a
    };
    let declaradas: Vec<u32> = raizes.iter().map(|r| r.endereco).collect();
    anotar_blocos(&mut blocos, &arestas, &declaradas);
    // A fronteira e o endereco onde o caminho para; pode coincidir com uma
    // instrucao comprovada (desvio para fora da regiao, JMP indireto cujo
    // comprimento esta na tabela e cujo alvo nao esta).
    let mut fronteiras = w.fronteiras.clone();
    fronteiras.sort_by_key(|f| f.endereco);
    let cobertura = calcular_cobertura(&blocos, ini, fim);
    let mut chamadas = w.chamadas.clone();
    chamadas.sort_by_key(|c| c.sitio);
    chamadas.dedup_by_key(|c| c.sitio);

    let mut base = Analise {
        regiao: (ini, fim),
        raizes: raizes_out,
        blocos,
        arestas,
        chamadas,
        fronteiras,
        cobertura,
        sitios: Vec::new(),
        limites: LIMITES.to_vec(),
        atingiu_limite_de_trabalho: w.atingiu_limite,
    };
    let mut qs: Vec<u32> = sitios.to_vec();
    qs.sort_unstable();
    qs.dedup();
    base.sitios = qs.iter().map(|a| base.sitio(*a)).collect();
    Ok(base)
}

fn montra_raizes(declaradas: &[RaizDeclarada], w: &Andarilho<'_>) -> Vec<Raiz> {
    let mut out: Vec<Raiz> = declaradas
        .iter()
        .map(|r| Raiz {
            endereco: r.endereco,
            proveniencia: r.proveniencia.clone(),
            evidencia: r.evidencia.clone(),
            grau: r.proveniencia.clone(),
            derivada: false,
        })
        .collect();
    // raizes derivadas: alvos de chamada comprovados dentro da regiao. O grau e
    // `dentro-de-fluxo` e NAO promotion de nada (§1).
    let mut derivadas: BTreeSet<u32> = BTreeSet::new();
    for c in &w.chamadas {
        if let Some(alvo) = c.alvo {
            if w.dentro(alvo) && !declaradas.iter().any(|r| r.endereco == alvo) {
                derivadas.insert(alvo);
            }
        }
    }
    for d in derivadas {
        out.push(Raiz {
            endereco: d,
            proveniencia: "dentro-de-fluxo".to_string(),
            evidencia: None,
            grau: "dentro-de-fluxo".to_string(),
            derivada: true,
        });
    }
    out.sort_by_key(|r| (r.endereco, r.derivada));
    out
}

/// Passada dos blocos: cada lider comeca um bloco que corre ate um terminador ou
/// ate o proximo lider (ponto de juntura). Retorna os blocos e as arestas de
/// queda que a passada de fluxo precisa registrar porque a cadeia linear passou
/// por uma juntura sem terminator explicito.
fn montar_blocos(w: &Andarilho<'_>) -> (Vec<Bloco>, Vec<Aresta>) {
    let mut blocos: Vec<Bloco> = Vec::new();
    let mut sinteticas: Vec<Aresta> = Vec::new();
    for entrada in w.lideres.iter().copied() {
        if !w.nos.contains_key(&entrada) {
            continue;
        }
        let mut instrucoes: Vec<InstrucaoView> = Vec::new();
        let mut addr = entrada;
        while let Some(no) = w.nos.get(&addr) {
            instrucoes.push(InstrucaoView {
                endereco: no.endereco,
                tam: no.tam,
                mnem: no.mnem.clone(),
                classe: no.classe.clone(),
            });
            let ultimo = no.endereco;
            if no.terminador {
                break;
            }
            let prox = ultimo + u32::from(no.tam);
            if !w.nos.contains_key(&prox) {
                break;
            }
            if w.lideres.contains(&prox) {
                // juntura: o proximo endereco comeca outro bloco; a queda entre
                // eles e uma aresta real do fluxo
                let ja_registrada =
                    w.arestas.iter().chain(sinteticas.iter()).any(|a| {
                        a.origem == ultimo && a.alvo == Some(prox) && a.tipo == Tipo::Queda
                    });
                if !ja_registrada {
                    sinteticas.push(Aresta {
                        origem: ultimo,
                        alvo: Some(prox),
                        tipo: Tipo::Queda,
                        status: Status::Resolvido,
                    });
                }
                break;
            }
            addr = prox;
        }
        if instrucoes.is_empty() {
            continue;
        }
        blocos.push(Bloco {
            entrada,
            instrucoes,
            saida: "fim-de-bloco".to_string(),
            sucessores: Vec::new(),
            alcancado_por: Vec::new(),
        });
    }
    (blocos, sinteticas)
}

/// Sucessores e `alcancado-por` sao derivados do conjunto FINAL de arestas
/// (fluxo + junturas sintetizadas), para o export nao perder a queda de juntura.
fn anotar_blocos(blocos: &mut [Bloco], arestas: &[Aresta], raizes_declaradas: &[u32]) {
    for b in blocos.iter_mut() {
        let Some(ultima) = b.instrucoes.last() else {
            continue;
        };
        let ultimo = ultima.endereco;
        let fim_bloco = ultimo + u32::from(ultima.tam);
        let mut sucessores: Vec<Sucessor> = arestas
            .iter()
            .filter(|a| a.origem == ultimo && a.alvo.is_some() && a.tipo != Tipo::RetornoFronteira)
            .filter_map(|a| a.alvo.map(|alvo| Sucessor { alvo, tipo: a.tipo }))
            .collect();
        sucessores.sort_by_key(|s| (s.tipo as u8, s.alvo));
        sucessores.dedup();
        b.sucessores = sucessores;

        let mut ponteiros: BTreeSet<String> = BTreeSet::new();
        for a in arestas {
            let Some(alvo) = a.alvo else { continue };
            if alvo >= b.entrada && alvo < fim_bloco {
                // origens de dentro do proprio bloco nao sao "alcancado por"
                if a.origem >= b.entrada && a.origem < fim_bloco {
                    continue;
                }
                ponteiros.insert(format!("{:#x}", a.origem));
            }
        }
        let mut v: Vec<String> = Vec::new();
        if raizes_declaradas.contains(&b.entrada) {
            v.push("raiz".to_string());
        }
        v.extend(ponteiros);
        b.alcancado_por = v;
    }
}

fn calcular_cobertura(blocos: &[Bloco], ini: u32, fim: u32) -> Cobertura {
    let mut intervalos: Vec<(u32, u32)> = Vec::new();
    let mut decodificados = 0u32;
    for b in blocos {
        for i in &b.instrucoes {
            intervalos.push((i.endereco, i.endereco + u32::from(i.tam)));
            decodificados += u32::from(i.tam);
        }
    }
    intervalos.sort_unstable();
    let mut vaos: Vec<Vao> = Vec::new();
    let mut varredura = ini;
    for (a, f) in intervalos {
        if a > varredura {
            vaos.push(Vao {
                inicio: varredura,
                fim: a,
            });
        }
        varredura = varredura.max(f);
    }
    if varredura < fim {
        vaos.push(Vao {
            inicio: varredura,
            fim,
        });
    }
    let bytes_regiao = fim - ini;
    Cobertura {
        bytes_decodificados: decodificados,
        bytes_regiao,
        fracao: razao(decodificados, bytes_regiao),
        vaos,
    }
}

/// Razao em texto com quatro casas, calculada com inteiros (sem float).
fn razao(num: u32, den: u32) -> String {
    if den == 0 {
        return "0.0000".to_string();
    }
    let mil = (num as u64 * 10_000) / den as u64;
    format!("{}.{:04}", mil / 10_000, mil % 10_000)
}
