//! Decodificador do subconjunto 68000 do `'rex-cfg/v2'.
//!
//! Unica fonte da tabela de (mascara, valor, consumo de extensao) — CONTRACT.md §3.
//! Regra historica de desvio: displacamento relativo de Bcc/BSR/DBcc e tomado em
//! `endereco_da_instrucao + 2` (primeiro word de extensao), nunca no fim da
//! instrucao. Onde o subconjunto nao cobre, o resultado e `Frontier`: nenhum
//! comprimento e inventado.
//!
//! Toda mascara aqui foi fixada por medicao direta contra o instrumento
//! independente (m68k-elf-as / m68k-elf-objdump, binutils 2.41): o mapa
//! endereco->(bytes, mnemonico) vive em `fixtures/calib-objdump.txt` e e
//! consumido por `tests/calib_parity.rs`. A opiniao da CPU-alvo vem de
//! `tools/sonda-as-68000.sh` (`as -m68000`), que separa "a forma nao existe na
//! alvo" de "existe mas nao esta na lista fechada de §3". Forma fora de §3 e
//! sempre fronteira, mesmo com comprimento comprovavel; forma dentro de §3 so e
//! lida com comprimento medido — nao com o que um montador generico aceita.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrontierKind {
    /// opcode (ou forma) fora da tabela do contrato
    OpcodeForaDoSubconjunto,
    /// JMP/JSR com alvo nao comprovado — permanece desconhecido
    IndirectOpaque,
    /// TRAP #n — caminho para, opaco
    TrapOpaco,
    /// proxima instrucao comecaria alem do fim da regiao
    LimiteDeRegiao,
    /// faltam bytes dentro da regiao para completar a instrucao
    Truncada,
    /// --max-insn atingido
    LimiteDeTrabalho,
}

impl FrontierKind {
    pub fn label(self) -> &'static str {
        match self {
            FrontierKind::OpcodeForaDoSubconjunto => "opcode-fora-do-subconjunto",
            FrontierKind::IndirectOpaque => "indirect-opaque",
            FrontierKind::TrapOpaco => "trap-opaco",
            FrontierKind::LimiteDeRegiao => "limite-de-regiao",
            FrontierKind::Truncada => "truncada",
            FrontierKind::LimiteDeTrabalho => "limite-de-trabalho",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frontier {
    pub kind: FrontierKind,
    pub opcode: Option<u16>,
    pub motivo: String,
    /// Bytes cujo COMPRIMENTO esta comprovado apesar do caminho parar aqui — hoje
    /// so JMP/JSR indiretos, cuja extensao de modo e conhecida (o alvo e que nao
    /// e). Sem isto, o grafo teria de escolher entre reclamara instrução (o que
    /// este contrato probe por tabela, nao por aparencia) ou perder a cobertura
    /// de um byte que uma varredura linear leria como codigo.
    pub consumo: Option<u16>,
}

impl Frontier {
    pub fn fora(opcode: Option<u16>, motivo: impl Into<String>) -> Self {
        Self {
            kind: FrontierKind::OpcodeForaDoSubconjunto,
            opcode,
            motivo: motivo.into(),
            consumo: None,
        }
    }
    pub fn indirect(opcode: Option<u16>, motivo: impl Into<String>) -> Self {
        Self {
            kind: FrontierKind::IndirectOpaque,
            opcode,
            motivo: motivo.into(),
            consumo: None,
        }
    }
    pub fn truncada(opcode: Option<u16>, motivo: impl Into<String>) -> Self {
        Self {
            kind: FrontierKind::Truncada,
            opcode,
            motivo: motivo.into(),
            consumo: None,
        }
    }
    pub fn limite_regiao(motivo: impl Into<String>) -> Self {
        Self {
            kind: FrontierKind::LimiteDeRegiao,
            opcode: None,
            motivo: motivo.into(),
            consumo: None,
        }
    }
    /// Marca os bytes comprovados desta fronteira (ver campo `consumo`).
    pub fn com_consumo(mut self, bytes: u16) -> Self {
        self.consumo = Some(bytes);
        self
    }
}

/// Fluxo de controle da instrucao ja decodificada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Flow {
    /// continua linearmente na instrucao seguinte
    Normal,
    /// Bcc/DBcc: aresta de desvio `taken` + queda; BRA: `has_fall=false`
    Branch { taken: u32, has_fall: bool },
    /// BSR/JSR com alvo comprovado: aresta de chamada + continuacao
    Call { target: u32 },
    /// JMP absoluto comprovado: aresta de salto, sem queda
    Jmp { target: u32 },
    /// RTS: termina o caminho, nenhuma aresta de volta inventada
    Ret,
    /// TRAP #n: termina o caminho como fronteira opaca
    Trap,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ins {
    pub addr: u32,
    pub len: u16,
    /// apresentacao (nao e pseudocodigo; ver CONTRACT §0.4)
    pub mnem: String,
    /// token de familia, comparavel ao primeiro token do objdump
    pub family: String,
    pub flow: Flow,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Insn(Ins),
    Frontier(Frontier),
}

impl Outcome {
    pub fn is_frontier(&self) -> bool {
        matches!(self, Outcome::Frontier(_))
    }
}

// ---------------------------------------------------------------------------
// janela de leitura
// ---------------------------------------------------------------------------

struct Cur<'a> {
    b: &'a [u8],
    /// endereco absoluto do proximo byte ainda nao consumido
    next_addr: u32,
}

impl<'a> Cur<'a> {
    fn word(&mut self) -> Option<u16> {
        if self.b.len() < 2 {
            return None;
        }
        let w = u16::from_be_bytes([self.b[0], self.b[1]]);
        self.b = &self.b[2..];
        self.next_addr = self.next_addr.checked_add(2)?;
        Some(w)
    }
    fn remaining(&self) -> usize {
        self.b.len()
    }
}

/// Codigo de tamanho do imediato no sentido de `mode_words`: %00=B %01=W %10=L.
fn imm_code_of(size: u8) -> u8 {
    match size {
        1 => 0b00,
        2 => 0b01,
        4 => 0b10,
        _ => 0b11,
    }
}

/// Extensao do modo de enderecamento 68000 em numero de words.
/// Modos: 0=Dn 1=An 2=(An) 3=(An)+ 4=-(An) 5=d16(An) 6=d8(An,Xn) 7=modo-7.
/// No modo 7, `sub` = %000 abs.W, %001 abs.L, %010 d16(PC), %011 d8(PC,Xn),
/// %100 imediato, %101..%111 reservados (ou 68020) — recusados.
fn mode_words(mode: u8, sub: u8, imm_code: u8) -> Option<usize> {
    match mode {
        0..=4 => Some(0),
        5 | 6 => Some(1),
        7 => match sub {
            0 => Some(1),
            1 => Some(2),
            2 => Some(1),
            3 => Some(1),
            4 => match imm_code {
                0b00 | 0b01 => Some(1),
                0b10 => Some(2),
                _ => None,
            },
            _ => None,
        },
        _ => None,
    }
}

/// Operando bruto (modo, registrador, words de extensao ja consumidos).
#[derive(Debug, Clone, PartialEq, Eq)]
struct Ea {
    mode: u8,
    reg: u8,
    w: Vec<u16>,
    size: u8,
}

/// Campos da word de extensao dos modos indexados (%110 `d8(An,Xn)` e %111.011
/// `d8(PC,Xn)`), layout medido em 2026-10-04 contra o instrumento (sonda
/// `probe-191c` e corpus `calib2`): bit15 tipo do indice (%0=Dn %1=An),
/// bits14-12 registrador, bit11 tamanho (%0=W %1=L), bits7-0 disp8.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Indice {
    disp: u8,
    reg: u8,
    is_a: bool,
    long: bool,
}

impl Indice {
    fn tipo(&self) -> char {
        if self.is_a {
            'a'
        } else {
            'd'
        }
    }
}

fn indice(w0: u16) -> Indice {
    Indice {
        disp: w0 as u8,
        reg: bits(w0, 12, 3),
        is_a: w0 & 0x8000 != 0,
        long: w0 & 0x0800 != 0,
    }
}

/// Verdadeiro quando a word indexada carrega os campos privativos de 68010/68020
/// (bits 10-8: escala ou deslocamento de 16 bits). O instrumento le esses casos
/// com MAIS uma word de extensao, entao reclamar comprimento seria inventa-lo;
/// o contrato §3 nao os contem => fronteira.
fn campo_indice_68020(w0: u16) -> bool {
    bits(w0, 8, 3) != 0
}

fn hex8(v: u8) -> String {
    format!("{v:#x}")
}

impl Ea {
    fn long(&self) -> u32 {
        ((self.w[0] as u32) << 16) | self.w[1] as u32
    }
    fn text(&self) -> String {
        match self.mode {
            0 => format!("%d{}", self.reg),
            1 => format!("%a{}", self.reg),
            2 => format!("%a{}@", self.reg),
            3 => format!("%a{}@+", self.reg),
            4 => format!("%a{}@-", self.reg),
            5 => format!("%a{}@({:#06x})", self.reg, self.w[0]),
            6 => {
                let ix = indice(self.w[0]);
                format!(
                    "%a{}@({},%{}{}:{})",
                    self.reg,
                    hex8(ix.disp),
                    ix.tipo(),
                    ix.reg,
                    if ix.long { "l" } else { "w" }
                )
            }
            7 => match self.reg {
                0 => format!("({:#06x}).w", self.w[0]),
                1 => format!("({:#010x}).l", self.long()),
                2 => format!("({:+}).w,%pc", self.w[0] as i16),
                3 => {
                    let ix = indice(self.w[0]);
                    format!(
                        "({0},%{1}{2}:{3}),%pc",
                        hex8(ix.disp),
                        ix.tipo(),
                        ix.reg,
                        if ix.long { "l" } else { "w" }
                    )
                }
                4 => {
                    if self.w.len() == 2 {
                        format!("#({:#010x})", self.long())
                    } else if self.size == 1 {
                        format!("#({:#04x})", self.w[0] & 0xFF)
                    } else {
                        format!("#({:#06x})", self.w[0])
                    }
                }
                r => format!("<reservado 7.{r}>"),
            },
            m => format!("<modo {m} invalido>"),
        }
    }
}

fn read_ea(cur: &mut Cur<'_>, mode: u8, reg: u8, size: u8) -> Result<Ea, Frontier> {
    let n =
        mode_words(mode, if mode == 7 { reg } else { 0 }, imm_code_of(size)).ok_or_else(|| {
            Frontier::fora(
                None,
                format!("modo {mode}.{reg} invalido ou 68020 fora do contrato"),
            )
        })?;
    if cur.remaining() < n * 2 {
        return Err(Frontier::truncada(
            None,
            format!("faltam {n} words para o operando modo {mode}.{reg}"),
        ));
    }
    let mut w = Vec::with_capacity(n);
    for _ in 0..n {
        w.push(cur.word().expect("verificado acima"));
    }
    // Modos indexados com campos de 68010/68020 (escala / disp16) nao estao na
    // lista fechada §3 e o instrumento lhes da outra extensão: fronteira.
    if (mode == 6 || (mode == 7 && reg == 3)) && campo_indice_68020(w[0]) {
        return Err(Frontier::fora(
            None,
            format!(
                "modo {mode}.{reg} com campo de indice 68020 ({:#06x})",
                w[0]
            ),
        ));
    }
    Ok(Ea { mode, reg, w, size })
}

fn b(op: u16, i: u32) -> u8 {
    ((op >> i) & 1) as u8
}
fn bits(op: u16, lo: u32, width: u32) -> u8 {
    ((op >> lo) & ((1u16 << width) - 1)) as u8
}

/// Tamanho do grupo MOVE: %01=B %10=L %11=W (%00 = grupo especial 0).
fn move_size(ss: u8) -> Option<(u8, &'static str)> {
    match ss {
        0b01 => Some((1, "b")),
        0b10 => Some((4, "l")),
        0b11 => Some((2, "w")),
        _ => None,
    }
}

/// Tamanho %00=B %01=W %10=L — grupo de 2 operandos quando %11 não é especial
/// (MUL/DIV/ADDA/SUBA/CMPA), OR/AND/EOR com imediato e desvios com extensão.
fn size_of_ss(ss: u8) -> Option<(u8, &'static str)> {
    match ss {
        0b00 => Some((1, "b")),
        0b01 => Some((2, "w")),
        0b10 => Some((4, "l")),
        _ => None,
    }
}

fn branch_mnem(cond4: u8) -> &'static str {
    match cond4 {
        0 => "bra",
        1 => "bsr",
        2 => "bhi",
        3 => "bls",
        4 => "bcc",
        5 => "bcs",
        6 => "bne",
        7 => "beq",
        8 => "bvc",
        9 => "bvs",
        10 => "bpl",
        11 => "bmi",
        12 => "bge",
        13 => "blt",
        14 => "bgt",
        _ => "ble",
    }
}

fn cc_mnem(cond4: u8) -> &'static str {
    [
        "t", "f", "hi", "ls", "cc", "cs", "ne", "eq", "vc", "vs", "pl", "mi", "ge", "lt", "gt",
        "le",
    ][cond4 as usize]
}

/// Familia a partir de um mnemonico com sufixo de tamanho (`moveb`, `addql`,
/// `braw`, `movemw`, `linkw`). A comparacao com o objdump e por familia, nao por
/// texto: `movew %d6,%ccr` e `movew %sr,%d6` tem familia `move`, e `eori` nao tem
/// familia `eor` (medido no instrumento; ver testes de paridade).
///
/// Regra: retira exatamente UM caractere de tamanho de `{b,w,l,s}` quando o token
/// tem 4+ caracteres. Preserva `rts`, `bls`, `bcs`, `bvs`, `seq`, `sne`, `dbf`,
/// `moveq`, `chk`, `lea`, `pea`, `nop`, `trap`.
fn family_of(mnem: &str) -> String {
    let tok = mnem.split(' ').next().unwrap_or("");
    if tok.len() >= 4 {
        let last = tok.as_bytes()[tok.len() - 1];
        if matches!(last, b'b' | b'w' | b'l' | b's') {
            return tok[..tok.len() - 1].to_string();
        }
    }
    tok.to_string()
}

fn mk(addr: u32, next_addr: u32, mnem: String, flow: Flow) -> Ins {
    let family = family_of(&mnem);
    Ins {
        addr,
        len: (next_addr - addr) as u16,
        mnem,
        family,
        flow,
    }
}

fn out(op: u16, motivo: impl Into<String>) -> Frontier {
    Frontier::fora(Some(op), motivo)
}

/// Modo 7 proibido como operando (reservados; %010/%011 PC sao recusados so
/// onde o contrato lista apenas modos de memoria/registro/absoluto).
const SRC7_BAD: [u8; 3] = [5, 6, 7];

/// Alvo efetivo de um operando absoluto de `JSR`/`JMP`. `(xxx).W` e sign-estendida
/// para 32 bits antes de ser usada (M68000PRM 2.2.16); `(xxx).L` e a longword
/// inteira (PRM 2.2.17).
fn abs_target(ea: &Ea) -> u32 {
    if ea.reg == 1 {
        ea.long()
    } else {
        i32::from(ea.w[0] as i16) as u32
    }
}

/// Decodifica uma instrucao em `addr`. `bytes` = janela [addr, fim_da_regiao).
/// Nunca devolve comprimento inventado.
pub fn decode_at(bytes: &[u8], addr: u32) -> Outcome {
    match decode_inner(bytes, addr) {
        Ok(ins) => Outcome::Insn(ins),
        Err(f) => Outcome::Frontier(f),
    }
}

fn decode_inner(bytes: &[u8], addr: u32) -> Result<Ins, Frontier> {
    if bytes.is_empty() {
        return Err(Frontier::limite_regiao("nenhum byte disponivel na regiao"));
    }
    if bytes.len() < 2 {
        return Err(Frontier::truncada(
            None,
            "regiao termina no meio de um opcode word",
        ));
    }
    let op = u16::from_be_bytes([bytes[0], bytes[1]]);
    let mut cur = Cur {
        b: &bytes[2..],
        next_addr: addr + 2,
    };
    classify(op, addr, &mut cur)
}

fn classify(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    let hi = op >> 12;
    match hi {
        0 => decode_grupo0(op, addr, cur),
        1..=3 => decode_move(op, addr, cur),
        4 => decode_especial(op, addr, cur),
        5 => decode_q_s_db(op, addr, cur),
        6 | 7 => decode_branch(op, addr, cur),
        0b1010 => Err(out(op, "grupo %1010 reservado - recusado")),
        0b1110 => decode_shift(op, addr, cur),
        0b1000 | 0b1001 | 0b1011 | 0b1100 | 0b1101 => decode_geral(op, addr, cur),
        _ => Err(out(op, "grupo %1111 (coprocessador/reservado) - recusado")),
    }
}

// ---------------------------------------------------------------------------
// %0000 — tamanho %00: bitops, op1 imediato, MOVEP
// ---------------------------------------------------------------------------

fn decode_grupo0(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    if b(op, 8) == 1 {
        // bitop forma registrador: %0000 ddd 1 cc mmm rrr
        // (medido: 0312 btst %d1,%a2@; 0559 bchg %d2,%a1@+; 0784 bclr %d3,%d4;
        //  0beb bset %d5,%a3@(8); 01c1 bset %d0,%d1)
        //
        // MOVEP ocipa %0000 ddd 1 ss 001 rrr com rrr = An: medido com o
        // instrumento em cinco formas (`0308/0509/0748/094f/0f4d` impressos como
        // movepw/movepl) — o campo de modo vale %001 em todas. %001 como operando
        // de bitop e An-direto, que a lista fechada de CONTRACT §3 nao contem:
        // recusar os dois cobre MOVEP sem inventar comprimento.
        let mode = bits(op, 3, 3);
        let reg = (op & 7) as u8;
        if mode == 0b001 {
            return Err(out(
                op,
                "MOVEP (modo %001 medido em movepw/movepl) ou An-direto: fora da lista fechada (contrato 3)",
            ));
        }
        // Destino de bitop com modo %111: %000/%001 sao abs.W/abs.L validos
        // (medido `08f8 0000 1234 bset #0,(1234).w`); %010 (PC) e %011 (PC com
        // indice) nao montam no `as -m68000` (`bset %d0,(16,%pc)` recusado) e
        // %100 e registro de codigo de condicao, que a lista fechada §3 nao
        // contem. A mascara antiga parava em %101.
        if mode == 7 && reg >= 2 {
            return Err(out(op, "bitop registrador com PC/CCR-SR/reservado"));
        }
        let src = bits(op, 9, 3);
        let name = bitop_name(bits(op, 6, 2));
        let ea = read_ea(cur, mode, reg, 1)?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("{name} %d{src},{}", ea.text()),
            Flow::Normal,
        ));
    }
    match bits(op, 9, 3) {
        4 => {
            // bitop imediato: %0000 100o o? mmm rrr + word cujo BYTE BAIXO e o
            // numero do bit, ANTES das extensoes do ea
            // (medido: 0804 0003 btst #3,%d4; 08a9 0001 0010 bclr #1,%a1@(16);
            //  08f8 0000 1234 bset #0,(1234).w; 08f9 0007 1234 5678 bset #7,(12345678).l)
            let mode = bits(op, 3, 3);
            let reg = (op & 7) as u8;
            if mode == 1 {
                return Err(out(
                    op,
                    "bitop imediato com destino An invalido (sonda as -m68000; instrumento .short)",
                ));
            }
            if mode == 7 && reg >= 2 {
                return Err(out(op, "bitop imediato com PC/CCR-SR/reservado"));
            }
            let name = bitop_name(bits(op, 6, 2));
            if cur.remaining() < 2 {
                return Err(Frontier::truncada(
                    Some(op),
                    "bitop imediato sem word do numero do bit",
                ));
            }
            let bit = (cur.word().unwrap() & 0xFF) as u32;
            let ea = read_ea(cur, mode, reg, 1)?;
            Ok(mk(
                addr,
                cur.next_addr,
                format!("{name} #{bit},{}", ea.text()),
                Flow::Normal,
            ))
        }
        g => {
            let name = match g {
                0 => "ori",
                1 => "andi",
                2 => "subi",
                3 => "addi",
                5 => "eori",
                6 => "cmpi",
                4 => {
                    return Err(out(
                        op,
                        "%0000 100 (bchg/bset/clr/cmpl imediato, 68020) - recusado",
                    ))
                }
                _ => return Err(out(
                    op,
                    "grupo %0000 111 (MOVE-CCR/SR, STOP, BKPT ou reservado) fora do subconjunto",
                )),
            };
            let (size, sfx) = size_of_ss(bits(op, 6, 2))
                .ok_or_else(|| out(op, "op1 imediato com tamanho %11"))?;
            let mode = bits(op, 3, 3);
            let reg = (op & 7) as u8;
            // Destino modo 7: %000 abs.W e %001 abs.L ficam como estavam. %010 em
            // diante nao e destino legitimo de op1-imediato no MC68000: medido com
            // o instrumento pinado, `003a`/`007a` (byte/word) imprimem `.short` e
            // `00ba` (long) e lido como `oril #imm,%d2` em 6 bytes — forma que o
            // `as -m68000` nao monta e que o PRM nao documenta, portanto fronteira
            // declarada, nunca leitura com comprimento proprio. %011/%100 sao
            // CCR/SR (medido `0a3c 0003` = `eorib #3,%ccr` e `007c 0007` =
            // `oriw #7,%sr`, ambos de 4 bytes) e %101..%111 reservados/68020.
            // Mesma regra de destino ja aplicada em MOVE (`dmode == 7 && dreg >= 2`)
            // e nos grupos unario/Scc/ADDQ.
            //
            // Modo %001 (An direta): M68000PRM 4-154 (pagina ORI, l.11259-11267)
            // restringe o destino a "Only data alterable addressing modes" e marca
            // a linha `An` como `—`; o `as -m68000` pinado recusa as seis familias
            // (`ori/andi/subi/addi/eori/cmpi` com `%aN`, sonda v4 l.31-40, todas
            // "operands mismatch"). NAO se pode alegar `.short` aqui: a varredura
            // E4 mediu o grupo inteiro com `short=0/64` e o instrumento le `0088`
            // como `oril #imm,%d0` (6 bytes) e `0c08` como `cmpib #113,%d0`
            // (4 bytes) — engana-se ao imprimir `%dN`, mas nunca imprime `.short`.
            if mode == 1 {
                return Err(out(
                    op,
                    "op1 imediato com destino An direta: prm 4-154 (l.11259-11267) so admite modos de dados alteraveis e marca An como -, e o as -m68000 recusa ori/andi/subi/addi/eori/cmpi com %aN (sonda v4); o instrumento le (medido 0088 = oril #imm,%d0 em 6 bytes, short=0/64) mas a forma nao esta na lista fechada (contrato 3)",
                ));
            }
            if mode == 7 && reg >= 2 {
                return Err(out(
                    op,
                    "op1 imediato com destino PC, CCR/SR ou reservado fora da lista (contrato 3)",
                ));
            }
            let imm = read_imm(cur, size)?;
            let ea = read_ea(cur, mode, reg, size)?;
            Ok(mk(
                addr,
                cur.next_addr,
                format!("{name}{sfx} {imm}, {}", ea.text()),
                Flow::Normal,
            ))
        }
    }
}

fn bitop_name(cc: u8) -> &'static str {
    match cc {
        0b00 => "btst",
        0b01 => "bchg",
        0b10 => "bclr",
        _ => "bset",
    }
}

// ---------------------------------------------------------------------------
// %0001..%0011 — MOVE / MOVEA
// ---------------------------------------------------------------------------

fn decode_move(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    let (size, sfx) = move_size(bits(op, 12, 2))
        .ok_or_else(|| out(op, "MOVE com campo de tamanho %00 (reservado)"))?;
    let dreg = bits(op, 9, 3);
    let dmode = bits(op, 6, 3);
    let smode = bits(op, 3, 3);
    let sreg = (op & 7) as u8;
    if smode == 7 && (sreg == 2 || sreg == 3 || SRC7_BAD.contains(&sreg)) {
        return Err(out(
            op,
            "MOVE com fonte PC-relativo ou reservada (fora do contrato 3)",
        ));
    }
    // MOVE.B com fonte An direta: PRM 4-118 fecha o tamanho byte ("For byte size
    // operation, address register direct is not allowed") e o `as -m68000` pinado
    // recusa `move.b %a0,%d1`. O instrumento imprime `.short` para as 336 words
    // do espaco `%0001 ddd dmm 001 rrr`; os tamanhos .W/.L com a mesma fonte sao
    // validos (medido `3208 movew %a0,%d1`, `2208 movel %a0,%d1`) e seguem lidos.
    if size == 1 && smode == 1 {
        return Err(out(
            op,
            "MOVE.B com fonte An direta invalida (PRM 4-118; sonda as -m68000)",
        ));
    }
    let src = read_ea(cur, smode, sreg, size)?;
    if dmode == 1 {
        // MOVEA: PRM 4-119 da os unicos tamanhos possiveis ("Size = (Word,
        // Long)") e a nota de rodape do §MOVE fecha o outro lado ("For byte size
        // operation, address register direct is not allowed."). Os dois casos
        // sao o mesmo par de bits, entao um so rotulo nomeia as duas leituras
        // invalidas.
        if size == 1 {
            return Err(out(
                op,
                "MOVE/MOVEA de tamanho byte com destino An invalido (PRM 4-118/4-119)",
            ));
        }
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("movea{sfx} {}, %a{dreg}", src.text()),
            Flow::Normal,
        ));
    }
    if dmode == 7 && dreg >= 2 {
        return Err(out(op, "MOVE com destino imediato/PC/reservado"));
    }
    let dst = read_ea(cur, dmode, dreg, size)?;
    Ok(mk(
        addr,
        cur.next_addr,
        format!("move{sfx} {}, {}", src.text(), dst.text()),
        Flow::Normal,
    ))
}

// ---------------------------------------------------------------------------
// %0100 — especial
// ---------------------------------------------------------------------------

fn decode_especial(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    let mode = bits(op, 3, 3);
    let mreg = (op & 7) as u8;

    // Fluxo exato (medido: 4e71, 4e75)
    if op == 0x4E71 {
        return Ok(mk(addr, cur.next_addr, "nop".into(), Flow::Normal));
    }
    if op == 0x4E75 {
        return Ok(mk(addr, cur.next_addr, "rts".into(), Flow::Ret));
    }
    // TRAP #n — o vetor ocupa o nibble BAIXO: os 16 codomes `4e40..=4e4f` sao os
    // 16 vetores que a referencia primaria declara ("TRAP #0 to TRAP #15", apendice
    // do MC68000 local, linha 2410-2412). Medido duas vezes nesta ETAPA: o
    // instrumento le `0x4e48` como `trap #8` e `0x4e4f` como `trap #15` (2B), e o
    // GAS pinado monta `trap #8` -> `4e48` e `trap #1` -> `4e41` (sonda
    // xe-c3-e4-probe6, 2026-10-05). A mascara `0xFFF8` desta linha truncava o
    // vetor em 3 bits e empurrava `#8..#15` para a recusa do grupo `%0100`,
    // contrariando a lista 3. 4e76 = TRAPV, impresso como recusa pelo instrumento,
    // e 4e72 = STOP - nenhum dos dois na lista 3.
    if (op & 0xFFF0) == 0x4E40 {
        let n = (op & 0xF) as u32;
        return Ok(mk(addr, cur.next_addr, format!("trap #{n}"), Flow::Trap));
    }
    // LINK (medido 4e56 fff8 = 4B) / UNLK (medido 4e5e = 2B)
    if (op & 0xFFF8) == 0x4E50 {
        if cur.remaining() < 2 {
            return Err(Frontier::truncada(
                Some(op),
                "LINK sem o word de deslocamento",
            ));
        }
        let d = cur.word().unwrap();
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("linkw %a{mreg},#({d:#06x})"),
            Flow::Normal,
        ));
    }
    if (op & 0xFFF8) == 0x4E58 {
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("unlk %a{mreg}"),
            Flow::Normal,
        ));
    }
    // MOVE SR→Dn / Dn→CCR / Dn→SR (medido 40c6 movew %sr,%d6; 44c6 movew %d6,%ccr;
    // 46c6 movew %d6,%sr). Os tres tem operando modo %000 e comprimento 2.
    if mode == 0 {
        let base = op & 0xFFC0;
        if matches!(base, 0x40C0 | 0x44C0 | 0x46C0) {
            let txt = match base {
                0x40C0 => format!("movew %sr,%d{mreg}"),
                0x44C0 => format!("movew %d{mreg},%ccr"),
                _ => format!("movew %d{mreg},%sr"),
            };
            return Ok(mk(addr, cur.next_addr, txt, Flow::Normal));
        }
    }
    // JSR %0100 1110 1? / JMP %0100 1111 1? (medido jsr=4eb8/4eb9, jmp=4ef8/4ef9;
    // os modos %010/%011 de PC tambem caem aqui e ficam como alvo nao comprovado)
    if (op & 0xFFC0) == 0x4E80 || (op & 0xFFC0) == 0x4EC0 {
        let is_jmp = (op & 0xFFC0) == 0x4EC0;
        let n = if is_jmp { "jmp" } else { "jsr" };
        if mode == 7 && matches!(mreg, 0 | 1) {
            let ea = read_ea(cur, mode, mreg, if mreg == 1 { 4 } else { 2 })?;
            let target = abs_target(&ea);
            let flow = if is_jmp {
                Flow::Jmp { target }
            } else {
                Flow::Call { target }
            };
            return Ok(mk(
                addr,
                cur.next_addr,
                format!("{n} ({:#010x})", target),
                flow,
            ));
        }
        let palavras = mode_words(mode, if mode == 7 { mreg } else { 0 }, 0b11);
        let consumo = palavras
            .filter(|n| cur.remaining() >= n * 2)
            .map(|n| (2 + 2 * n) as u16);
        let mut f = Frontier::indirect(
            Some(op),
            "JSR/JMP com alvo nao comprovado (indireto ou PC) - permanece desconhecido",
        );
        if let Some(n) = consumo {
            f = f.com_consumo(n);
        }
        return Err(f);
    }
    // LEA %0100 aaa 1 11 mmm rrr (medido 41f9, 43d0, 45e9, 4bfa). No espaco
    // b8..b6, LEA vale 111; CHK vale 110 (.W) ou 100 (.L) — a mascara precisa
    // incluir b6 para nao confundir os dois.
    if (op & 0xF1C0) == 0x41C0 {
        // LEA aceita somente modos de memoria: `as -m68000` recusa Dn-direto
        // (`lea %d0,%a1`), An-direto (`lea %a0,%a1`), auto-incremento
        // (`lea %a0@+,%a1`) e auto-decremento (`lea %a0@-,%a1`) — e o
        // instrumento imprime `.short` para as 248 words dos quatro modos.
        // `(An)`, `d16(An)`, abs, PC e PC-indexado montam (medido `43d0 lea
        // %a0@,%a1`, `41fa lea (16,%pc),%a0`) e continuam lidos.
        if matches!(mode, 0 | 1 | 3 | 4) {
            return Err(out(
                op,
                "LEA com fonte de registrador ou auto-incremento: so modos de memoria (sonda as -m68000)",
            ));
        }
        if mode == 7 && mreg >= 4 {
            return Err(out(op, "LEA com imediato/reservado"));
        }
        let ea = read_ea(cur, mode, mreg, 2)?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("lea {}, %a{g}", ea.text(), g = bits(op, 9, 3)),
            Flow::Normal,
        ));
    }
    // CHK %0100 ddd 1 s0 mmm rrr (medido 4184 chkw %d4,%d0 e 4310 chkl %a0@,%d1).
    // O codigo de tamanho de CHK esta contestado entre as duas fontes desta ETAPA: o
    // PRM da ao campo `11 — Word` / `10 — Long` (l. 7643-4, p. 4-70) e marca Long
    // como "MC68020, MC68030, MC68040 only" (l. 7603), mas o instrumento pinado le
    // `41bc` como `chkw` em 4 bytes, `413c` como `chkl` em 6 bytes e imprime
    // `.short` sobre `41fc`, que e justamente a word que o PRM declara como o CHK.W
    // do MC68000. Com fonte em registrador ou memoria a divergencia nao muda o
    // comprimento (zero ou uma word de extensao nos dois modelos), entao a leitura
    // fica; com `#imm` o numero de words de extensao depende do tamanho, portanto a
    // forma e fronteira e nao se exporta (secao 4, E4-2).
    if (op & 0xF140) == 0x4100 {
        let sfx = if b(op, 7) == 1 { "w" } else { "l" };
        if mode == 1 {
            return Err(out(
                op,
                "chk com fonte %aN direta: prm l.7650 marca o modo como ausente e o as -m68000 recusa `chk.w %a0,%d1` (operands mismatch)",
            ));
        }
        if mode == 7 && mreg == 4 {
            return Err(out(
                op,
                "chk com imediato: divergencia nao resolvida de tamanho entre prm l.7643-4 (11=w, 10=l so 68020+) e o instrumento (41bc=chkw 4b, 413c=chkl 6b, 41fc=.short)",
            ));
        }
        if mode == 7 && mreg >= 5 {
            return Err(out(op, "chk com modo 7 reservado ou de indice 68020"));
        }
        let ea = read_ea(cur, mode, mreg, if sfx == "w" { 2 } else { 4 })?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("chk{sfx} {}, %d{g}", ea.text(), g = bits(op, 9, 3)),
            Flow::Normal,
        ));
    }
    // %0100 1000 01 mmm rrr — SWAP com modo %000, BKPT em 484f, PEA nos demais
    // modos (medido swap=4840 base, pea 4851 %a1@ / 4879 abs.L / 4878 abs.W;
    // 484f impresso como `bkpt 7`; 4881/48c1 impressos como extw/extl)
    if (op & 0xFFC0) == 0x4840 {
        if mode == 0 {
            return Ok(mk(
                addr,
                cur.next_addr,
                format!("swap %d{mreg}"),
                Flow::Normal,
            ));
        }
        if op == 0x484F {
            return Err(out(op, "BKPT (68010+) fora do subconjunto - recusado"));
        }
        if mode == 1 {
            return Err(out(op, "PEA com An-direto fora da lista (contrato 3)"));
        }
        // PEA empurra um endereco efetivo: `as -m68000` recusa `pea %a0@+` e
        // `pea %a0@-` (e o instrumento imprime `.short` para as 16 words), mas
        // aceita `pea %a0@` (`4850`) e `pea (16,%pc)` (`487a 0010`).
        if mode == 3 || mode == 4 {
            return Err(out(
                op,
                "PEA com %aN@+ ou %aN@- invalido (sonda as -m68000; instrumento .short)",
            ));
        }
        if mode == 7 && mreg >= 4 {
            return Err(out(op, "PEA com imediato/reservado"));
        }
        let ea = read_ea(cur, mode, mreg, 2)?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("pea {}", ea.text()),
            Flow::Normal,
        ));
    }
    // EXT.W / EXT.L (medido 4881/48c1, impressos pelo instrumento como recusa de
    // subconjunto? nao: sao validos, mas EXT nao esta na lista fechada §3)
    if mode == 0 && matches!((op & 0xFFC0) >> 6, 0x122 | 0x123) {
        return Err(out(
            op,
            "EXT nao esta no subconjunto do contrato 3 - recusado",
        ));
    }
    // MOVEM %0100 1d0 0 1? mmm rrr (medido 4891/48ea escrita, 4c99/4c9d/4cd2/4cdd
    // leitura). Bits fixos: %0100, b11=1, b9=0, b8=0, b7=1; b10 = direcao e b6 =
    // tamanho (.W/.L). Suportado apenas para COMPRIMENTO: a lista de
    // registradores e consumida sem interpretacao. A mascara nao pode fixar b8
    // (engoliria `4ab9` = tstl abs.L, medido em 0xca) nem b6 (perderia o .L).
    if (op & 0xFB80) == 0x4880 {
        return decode_movem(op, addr, cur, mode, mreg);
    }
    // unarios %0100 ooo 0 ss mmm rrr (medido 4200 clrb, 4251 clrw, 4284 clrl,
    // 4401 negb, 4446 negw, 4614 notb, 4682 notl, 4a1b tstb, 4a43 tstw, 4a51 tstl)
    let name = match bits(op, 9, 3) {
        0b001 => "clr",
        0b010 => "neg",
        0b011 => "not",
        0b101 => "tst",
        _ => return Err(out(op, "grupo %0100 fora do subconjunto")),
    };
    if b(op, 8) == 1 {
        return Err(out(op, "%0100 com b8=1 fora do subconjunto"));
    }
    let (sz, sfx) = size_of_ss(bits(op, 6, 2)).ok_or_else(|| out(op, "unario com tamanho %11"))?;
    if mode == 1 {
        return Err(out(op, "unario com An invalido"));
    }
    // CLR/NEG/NOT nao tem imediato nem modo reservado: o instrumento imprime
    // `.short` para `423a`/`427a`/`42ba` (clr) e `443a`/`447a`/`44ba` (neg), e o
    // `as -m68000` recusa `neg.l (16,%pc)`. TST conserva o imediato porque o
    // proprio instrumento o le (`4aba` = `tstl #imm`, 4 bytes medidos); ai a cota
    // E4-2 so permite recusar com sonda, e a sonda mostra leitura concordante.
    let mreg_proibido = if name == "tst" { 4 } else { 2 };
    if mode == 7 && mreg >= mreg_proibido {
        return Err(out(
            op,
            "unario com imediato (so TST) ou modo %101..%111 reservado",
        ));
    }
    let ea = read_ea(cur, mode, mreg, sz)?;
    Ok(mk(
        addr,
        cur.next_addr,
        format!("{name}{sfx} {}", ea.text()),
        Flow::Normal,
    ))
}

fn decode_movem(
    op: u16,
    addr: u32,
    cur: &mut Cur<'_>,
    mode: u8,
    mreg: u8,
) -> Result<Ins, Frontier> {
    // b10 = 1 leitura (mem->reg), 0 escrita (reg->mem); b6 = 0 .W / 1 .L
    let sfx = if b(op, 6) == 0 { "w" } else { "l" };
    let read = b(op, 10) == 1;
    if mode <= 1 {
        return Err(out(op, "MOVEM com operando de registrador direto"));
    }
    // A direcao decide quais modos de memoria existem: escrita nao aceita
    // auto-incremento (`movem.w %d0,%a0@+` recusado pelo `as -m68000` pinado, e
    // o instrumento imprime `.short` para `4898`/`48d8`); leitura nao aceita
    // auto-decremento (`movem.l %a0@-,%d0` recusado; `4ca0`/`4ce0` sao
    // `.short`). Os dois lados opostos montam (medido `48e0 8000` escrita com
    // %a0@- e `4cd8 0001` leitura com %a0@+), entao a guarda e par, nao geral.
    if !read && mode == 3 {
        return Err(out(
            op,
            "MOVEM escrita com %aN@+ invalido (sonda as -m68000; instrumento .short)",
        ));
    }
    if read && mode == 4 {
        return Err(out(
            op,
            "MOVEM leitura com %aN@- invalido (sonda as -m68000; instrumento .short)",
        ));
    }
    // Destino de escrita com modo %111: %010 (d16,PC) e so leitura; o `as -m68000`
    // recusa `movem.w %d0,(16,%pc)` e o instrumento imprime `.short` (`48ba`).
    // Leitura com `(16,%pc)` e valida e usada em tabelas reais (medido
    // `4cba 0001 0010 movemw %pc@(0x14),%d0`) — por isso a guarda e so da escrita.
    if !read && mode == 7 && mreg >= 2 {
        return Err(out(op, "MOVEM escrita com destino PC/CCR-SR/reservado"));
    }
    if mode == 7 && mreg >= 4 {
        return Err(out(op, "MOVEM com imediato/reservado"));
    }
    let ext = mode_words(mode, if mode == 7 { mreg } else { 0 }, 0b01)
        .ok_or_else(|| out(op, "MOVEM modo 7 reservado ou 68020"))?;
    if cur.remaining() < (ext + 1) * 2 {
        return Err(Frontier::truncada(
            Some(op),
            "MOVEM sem extensoes completas",
        ));
    }
    for _ in 0..ext {
        let _ = cur.word();
    }
    let _ = cur.word();
    let dir_txt = if read {
        "mem->reg (lista nao-inferida)"
    } else {
        "reg->mem (lista nao-inferida)"
    };
    Ok(mk(
        addr,
        cur.next_addr,
        format!("movem{sfx} {dir_txt}"),
        Flow::Normal,
    ))
}

// ---------------------------------------------------------------------------
// %0101 — Scc / DBcc / ADDQ / SUBQ
// ---------------------------------------------------------------------------

fn decode_q_s_db(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    let cond = bits(op, 8, 4);
    if bits(op, 6, 2) == 0b11 {
        let mode = bits(op, 3, 3);
        let mreg = (op & 7) as u8;
        if mode == 0b001 {
            // DBcc (medido 51cc 0030 / 51cb ffbe / 5cca 0028): SEMPRE 4 bytes; o
            // displacamento e um word COM SINAL na extensao, nao um disp8. Em
            // %111 mmm rrr o modo ficaria %111 = reserva, entao `51ff` cai em Scc
            // e e recusado. Serie do instrumento pinado (binutils 2.41, sha
            // e3a404cc, `-b binary -m m68k -D` num objeto de 1 word + nop):
            // `51ff` le `sf %d7` em 2 bytes — nao `.short`, como uma nota anterior
            // dizia (corrigida em ADENDO-ETAPA3-2026-10-05 R-3.7). A recusa
            // permanece: o subconjunto nao suporta Scc, e o instrumento ler nao
            // obriga a publicar.
            let reg = mreg;
            if cur.remaining() < 2 {
                return Err(Frontier::truncada(
                    Some(op),
                    "DBcc sem word de displacamento",
                ));
            }
            let d = cur.word().unwrap() as i16;
            // BASE HISTORICA: addr + 2 (primeiro word de extensao), nunca addr + 4
            let taken = (addr + 2).wrapping_add(d as i32 as u32);
            let mn = format!("db{}", cc_mnem(cond));
            return Ok(mk(
                addr,
                cur.next_addr,
                format!("{mn} %d{reg},({taken:#08x})"),
                Flow::Branch {
                    taken,
                    has_fall: true,
                },
            ));
        }
        // Scc ea.B (medido 57c1 seq %d1, 56d4 sne %a4@)
        if mode == 1 {
            return Err(out(op, "Scc para An invalido"));
        }
        if mode == 7 && mreg >= 2 {
            return Err(out(op, "Scc com destino PC, imediato ou reservado"));
        }
        let ea = read_ea(cur, mode, mreg, 1)?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("s{} {}", cc_mnem(cond), ea.text()),
            Flow::Normal,
        ));
    }
    // ADDQ/SUBQ (medido 5813 addqb, 50b9 addql, 550f subqb)
    let count = {
        let v = bits(op, 9, 3);
        if v == 0 {
            8
        } else {
            v
        }
    };
    let name = if b(op, 8) == 0 { "addq" } else { "subq" };
    let (size, sfx) =
        size_of_ss(bits(op, 6, 2)).ok_or_else(|| out(op, "ADDQ/SUBQ com tamanho %11"))?;
    let mode = bits(op, 3, 3);
    let mreg = (op & 7) as u8;
    // ADDQ/SUBQ fazem leitura E escrita no operando: destino PC-relativo (%010)
    // e reservado/68020 (%011, %101..%111) nao montam (`as -m68000` recusa
    // `addq.l #3,(16,%pc)`) e o instrumento imprime `.short`. A mascara antiga
    // parava em %100 e deixava %010/%011 passarem com extensao lida (classe (ii)).
    if mode == 7 && mreg >= 2 {
        return Err(out(op, "ADDQ/SUBQ com destino PC, imediato ou reservado"));
    }
    // ADDQ.B com destino An direto: `as -m68000` recusa `addq.b #8,%a0` e o
    // instrumento imprime `.short` (`5008`). SUBQ.B com o mesmo destino e aceito
    // (medido `5108 subqb #8,%a0`) e continua lido — a assimetria e do proprio
    // instrumento, nao uma escolha desta ferramenta.
    if name == "addq" && size == 1 && mode == 1 {
        return Err(out(
            op,
            "ADDQ.B com destino An invalido (sonda as -m68000; instrumento .short)",
        ));
    }
    let ea = read_ea(cur, mode, mreg, size)?;
    Ok(mk(
        addr,
        cur.next_addr,
        format!("{name}{sfx} #{count}, {}", ea.text()),
        Flow::Normal,
    ))
}

// ---------------------------------------------------------------------------
// %0110/%0111 — MOVEQ / Bcc / BSR / BRA
// ---------------------------------------------------------------------------

fn decode_branch(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    if (op >> 12) == 7 && b(op, 8) == 0 {
        // MOVEQ (medido 780f, 74ff: b8=0; tamanho e sempre .L)
        let dreg = bits(op, 9, 3);
        let imm = ((op & 0xFF) as i8) as i32;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("moveq #{imm},%d{dreg}"),
            Flow::Normal,
        ));
    }
    // %0111 com b8=1 NAO e desvio: no MC68020 esse espaco e MVS/MVZ/CPMOVE
    // (medido `7100 mvsb %d0,%d0`, `73a5 mvzb %a5@-,%d1`, `75c0 mvzw %d0,%d2`;
    // o `as -m68000` nem monta essas formas). A mascara antiga lia tudo como
    // `bsr/bcc .S` de 2 bytes, e o instrumento le 4 (classe (i) da auditoria
    // E4). Recusar nao amplia a ISA: nenhum dos tres nomes esta na lista
    // fechada de CONTRACT §3.
    if (op >> 12) == 7 {
        return Err(out(
            op,
            "%0111 com b8=1 = MVS/MVZ/CPMOVE (68020), nao MOVEQ nem desvio - fora do subconjunto",
        ));
    }
    let cond = bits(op, 8, 4);
    let name = branch_mnem(cond);
    // Formato medido (606a/6000 006a/6700 ff76/67ff): os dois bits de "tamanho"
    // SAO os bits altos do displacamento. So o byte baixo distingue as formas:
    // 0x00 -> word de extensao (.W, 4 bytes); demais -> disp8 (.S, 2 bytes).
    //
    // `disp8 = 0xFF` e o unico ponto em que o CONTRACT §0.3/§3 e a expectativa
    // congelada de fx02 mandam RECUSAR embora o instrumento leia a forma: o
    // objdump do host (alvo generico, binutils 2.41) imprime `67ff` como
    // `beqs 14d` (medido em calib 0x14c). Em 68020+ esses dois bytes sao o
    // prefixo de um desvio .W com word de extensao — o mesmo par de bytes tem
    // dois comprimentos possiveis conforme a CPU. Como o alvo do contrato e
    // 68000 e a ferramenta nao pode afirmar comprimento, o caminho para aqui e
    // os bytes viram vao na cobertura. Desvio documentado no Adendo datado.
    let low = (op & 0xFF) as u8;
    if low == 0xFF {
        return Err(out(
            op,
            "desvio com disp8 = 0xFF: forma de extensao 68020 ambigua - comprimento \
             nao comprovavel, caminho interrompido (contrato 3; o instrumento le .S -1)",
        ));
    }
    let (d, sfx) = if low == 0 {
        if cur.remaining() < 2 {
            return Err(Frontier::truncada(
                Some(op),
                "desvio .W sem word de displacamento",
            ));
        }
        (cur.word().unwrap() as i16, "w")
    } else {
        (low as i8 as i16, "s")
    };
    // BASE HISTORICA: addr + 2 (primeiro word de extensao), nunca addr + len
    let taken = (addr + 2).wrapping_add(d as i32 as u32);
    let flow = match cond {
        0 => Flow::Branch {
            taken,
            has_fall: false,
        },
        1 => Flow::Call { target: taken },
        _ => Flow::Branch {
            taken,
            has_fall: true,
        },
    };
    Ok(mk(
        addr,
        cur.next_addr,
        format!("{name}{sfx} ({taken:#08x})"),
        flow,
    ))
}

// ---------------------------------------------------------------------------
// %1110 — shift/rotacao: registrador em b/w/l e memoria somente .W
// ---------------------------------------------------------------------------

/// Campos do grupo de shift/rotacao, ajustados sobre medicao no `as`/`objdump`
/// pinados (`tools/sonda-as-68000.sh`, saida v4):
/// - forma de REGISTRADOR `%1110 c c c d ss i tt rrr` (prm 4-113): `ccc` =
///   contagem imediata (0 => 8) ou Dn quando `i=1`, `ss` = tamanho (00 b, 01 w,
///   10 l), `tt` = familia (%00 AS, %01 LS, %10 ROX, %11 ROL/ROR) e `d` a direcao.
///   Medidos: `e701 aslb #3,%d1`, `e741 aslw #3,%d1`, `e781 asll`, `e641 asrw`,
///   `e5a1 asll %d2,%d1`, `e711 roxlb #3,%d1`, `e799 roll #3,%d1`.
/// - forma de MEMORIA `%1110 t t t d 11 mmm rrr` — o `%11` na posicao do campo de
///   tamanho NAO e um tamanho: sao os dois bits fixos que distinguem a forma
///   (prm 4-115, MEMORY SHIFTS, l.9635+). Medidos no montador da CPU-alvo: `e1d0
///   asl.w %a0@`, `e0d0 asr.w`, `e3d0 lsl.w`, `e2d0 lsr.w`, `e5d0 roxl.w`, `e7d0
///   rol.w`, `e1d8`, `e1e0`, `e1e80008 (8,%a0)`, `e1f804d2 (1234).w`; `asl.l
///   %a0@` e RECUSADO pelo montador porque "Memory shift and rotate operations
///   shift word operands one bit position only" (prm 3.1.4 l.3605) — na forma de
///   memoria nao ha campo de tamanho, entao o unico comprimento e word.
///
/// A familia de rotacao (ROXL/ROXR/ROL/ROR) e real na CPU-alvo: prm tabela 3-5
/// l.3646-3660 lista registrador em 8/16/32 e memoria em 16, o `as -m68000` monta
/// todas e o `objdump` pinado le as 1024 words do espaco em 2 bytes. Ela ja era
/// lida em `rex-cfg/v1` e ja estava nos fixtures de paridade (`fixtures/calib.s`
/// 0xc2, `calib2.s` 0x74-0x7a = roxlw/roxrw/roxll/roxrl), que sao o oraculo
/// independente desta frente; o que faltava era o nome dela em §3 l.185, que so
/// citava ASL/ASR/LSL/LSR. §3 esta retificado pelo adendum datado de 2026-10-05
/// (`docs/.../CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md`), nao por vontade da
/// auditoria de cobrir mais words (E4-4).
fn decode_shift(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    if b(op, 12) == 1 {
        return Err(out(op, "%1111/68010 (BKPT, CAS, TAS) fora do subconjunto"));
    }
    let dir_left = b(op, 8) == 1;
    if bits(op, 6, 2) == 0b11 {
        let nome = match bits(op, 9, 3) {
            0b000 if dir_left => "asl",
            0b000 => "asr",
            0b001 if dir_left => "lsl",
            0b001 => "lsr",
            0b010 if dir_left => "roxl",
            0b010 => "roxr",
            0b011 if dir_left => "rol",
            0b011 => "ror",
            _ => {
                return Err(out(
                    op,
                    "forma de memoria do grupo %1110 com campo de familia %100..%111: nao definida (prm tabela 3-5 l.3617-3660)",
                ))
            }
        };
        let mode = bits(op, 3, 3);
        let mreg = (op & 7) as u8;
        if mode == 0 || mode == 1 {
            return Err(out(
                op,
                "shift para memoria com destino em registrador direto: prm 4-115 (l.9635+) so lista modos de memoria alteravel",
            ));
        }
        if mode == 7 && mreg >= 2 {
            // Numeração de modo %111 medida nesta ETAPA com o par pinado
            // (`move.l` fonte): 7.0 = (xxx).w (2038), 7.1 = (xxx).l (2039),
            // 7.2 = (d16,PC) (203a), 7.4 = #%imediato (203c); 7.3 = (d8,PC,Xn) e
            // 7.5..7.7 ficam fora. Destino de shift so aceita memoria alteravel
            // (prm 4-115), entao PC, imediato e reservados = fronteira.
            return Err(out(
                op,
                "shift para memoria com imediato, PC ou modo reservado (prm 4-115 l.9635+; contrato 3)",
            ));
        }
        let ea = read_ea(cur, mode, mreg, 2)?;
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("{nome}w {}", ea.text()),
            Flow::Normal,
        ));
    }
    let sfx = match bits(op, 6, 2) {
        0b00 => "b",
        0b01 => "w",
        // %10 = long; %11 ja foi tomado pela rama de memoria acima
        _ => "l",
    };
    let reg_cnt = b(op, 5) == 1;
    let base = match bits(op, 3, 2) {
        0b00 if dir_left => "asl",
        0b00 => "asr",
        0b01 if dir_left => "lsl",
        0b01 => "lsr",
        0b10 if dir_left => "roxl",
        0b10 => "roxr",
        0b11 if dir_left => "rol",
        0b11 => "ror",
        // os quatro valores de `tt` cobrem todo o espaco; o ramo so existe para
        // o decodificador nao pantejar sobre byte nao confiavel.
        _ => {
            return Err(out(
                op,
                "forma de registrador do grupo %1110 com familia nao definida (prm tabela 3-5 l.3617-3660)",
            ))
        }
    };
    let reg = (op & 7) as u8;
    let mnem = if reg_cnt {
        // contagem registradora: o campo de contagem e um Dn
        let cnt = bits(op, 9, 3);
        format!("{base}{sfx} %d{cnt},%d{reg}")
    } else {
        let c = bits(op, 9, 3);
        let count = if c == 0 { 8 } else { c };
        format!("{base}{sfx} #{count},%d{reg}")
    };
    Ok(mk(addr, cur.next_addr, mnem, Flow::Normal))
}

// ---------------------------------------------------------------------------
// %1000..%1101 — OR/SUB/CMP/AND/ADD + EOR
// ---------------------------------------------------------------------------

/// Campos do grupo de 2 operandos, ajustados sobre a sonda medida (`gen.s` ->
/// objdump), nao de memoria. Layout `%nnnn ddd o ss mmm rrr`:
/// - `ss` %00=B %01=W %10=L e `o` = direcao (%0 ea->Dn, %1 Dn->ea);
/// - `ss` = %11 NAO e um tamanho: com `o`=%0/%1 significa MULU/MULS e
///   DIVU/DIVS (destino Dn, medida `c2c0 muluw %d0,%d1`, `83c0 divsw`), e nos
///   grupos ADD/SUB/CMP significa ADDA/SUBA/CMPA com `o` escolhendo .W/.L
///   (medidas `d6c0 addaw %d0,%a3` de 2 bytes e `d7d2 addal %a2@,%a3`).
///
/// Por isso nenhum tamanho aqui e lido "de cabeca".
fn decode_geral(op: u16, addr: u32, cur: &mut Cur<'_>) -> Result<Ins, Frontier> {
    let hi = op >> 12;
    let dreg = bits(op, 9, 3);
    let dir = b(op, 8);
    let mode = bits(op, 3, 3);
    let mreg = (op & 7) as u8;
    let ss = bits(op, 6, 2);
    // Modos 7 %010/%011 (PC) e %101..%111 (reservados/68020) nao estao na lista
    // fechada de §3 para este grupo; o instrumento so montou formas sem PC. O
    // imediato (%100) e tratado por ramo: so MUL/DIV o aceitam como fonte.
    if mode == 7 && matches!(mreg, 2 | 3 | 5 | 6 | 7) {
        return Err(out(
            op,
            "operando PC-relativo ou reservado fora do subconjunto (contrato 3)",
        ));
    }

    if ss == 0b11 {
        let (name, sfx) = match (hi, dir) {
            (0b1100, 0) => ("mulu", "w"),
            (0b1100, 1) => ("muls", "w"),
            (0b1000, 0) => ("divu", "w"),
            (0b1000, 1) => ("divs", "w"),
            (0b1101, 0) => ("adda", "w"),
            (0b1101, 1) => ("adda", "l"),
            (0b1001, 0) => ("suba", "w"),
            (0b1001, 1) => ("suba", "l"),
            (0b1011, 0) => ("cmpa", "w"),
            (0b1011, 1) => ("cmpa", "l"),
            _ => {
                return Err(out(
                    op,
                    "grupo de 2 operandos com tamanho %11 fora do subconjunto - recusado",
                ))
            }
        };
        let size = if sfx == "w" { 2 } else { 4 };
        let muldiv = matches!(hi, 0b1100 | 0b1000);
        // Fonte `%aN` direta. Para ADDA/SUBA/CMPA todos os modos de EA sao fonte
        // valida: a pagina de `ADD` (PRM l. 5022, p. 4-5) diz "If the location
        // specified is a source operand, all addressing modes can be used", as
        // paginas proprias declaram `<ea>,An` (l. 5096/12222/7946) e o instrumento
        // le as 384 words em 2B (medido `d2c8 addaw %a0,%a1`). Para MUL/DIV a mesma
        // referencia marca `An` como `—` na tabela de modos de fonte (l. 10720 e
        // 8741), o `as -m68000` recusa `mulu.w %a0,%d0` e o instrumento imprime
        // `.short` sobre `c0c8`/`80c8` — medidos, nao lembrados.
        if mode == 1 && muldiv {
            return Err(out(
                op,
                "mul/div (ss=%11) com fonte %aN direta: prm l.10720/8741 marcam o modo como ausente, o as -m68000 recusa `mulu.w %a0,%d0` e o instrumento le .short (medido em c0c8/80c8)",
            ));
        }
        // O imediato e fonte comprovada nos dois ramos: `88fc 0003 divuw #3,%d4`
        // (MUL/DIV, PRM l. 10721 lista `#<data>` = 111.100) e `d0fc`/`93fc`
        // (ADDA/SUBA .W/.L, 4B/6B medidos no instrumento, PRM §2.2.18 l. 2704).
        let ea = read_ea(cur, mode, mreg, size)?;
        let dst = if muldiv {
            format!("%d{dreg}")
        } else {
            format!("%a{dreg}")
        };
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("{name}{sfx} {}, {dst}", ea.text()),
            Flow::Normal,
        ));
    }

    let (size, sfx) = size_of_ss(ss).ok_or_else(|| out(op, "tamanho %11 tratado acima"))?;
    let name_g = match hi {
        0b1000 => "or",
        0b1001 => "sub",
        // %1011 com direcao=1 e EOR em qualquer tamanho comprovado (medido
        // b141 eorw, b192 eorl, b12a 0010 eorb) — inclusive .B, ao contrario do
        // que a leitura inicial do contrato sugeria.
        0b1011 if dir == 1 => "eor",
        0b1011 => "cmp",
        0b1100 => "and",
        0b1101 => "add",
        _ => return Err(out(op, "grupo de 2 operandos reservado - recusado")),
    };
    // O modo `%001` (An direto) ten dous motivos distintos segundo `b8`, e a
    // auditoria E4-1(iv) pide un motivo por familia de word. Con `b8=1` o espaco e a
    // familia X/BCD/CMPM/EXG/PACK e o MOV3Q de 68020 — medido no instrumento:
    // `d348 addxw %a0@-,%a1@-`, `9348 subxw`, `b348 cmpmw %a0@+,%a1@+`, `c348 exg`,
    // `8348 pack`, `a348 mov3ql`. MC68000 real en parte, pero nada diso esta na lista
    // fechada de §3. Con `b8=0` o espaco e MEDIDO no corpus de §4: 960 words
    // (`hi` nas cinco familias, fonte `%001`, `ss != %11`) das que o instrumento le
    // 448, todas en 2 bytes (`addw`/`addl`/`subw`/`subl`/`cmpb`/`cmpw`/`cmpl` × 64
    // cada), e imprime `.short` sobre as 512 restantes (`or`/`and` en calquera
    // tamaño, `add.b`, `sub.b`); a maskara anterior recusaba as 960 (serie completa e
    // refraseamento da alegacion antiga en ADENDO-ETAPA3-2026-10-05 R-3.8). A referencia
    // primaria non manda recusar ADD/SUB/CMP: as paginas de `ADD` (l. 5022-5028),
    // `SUB` (l. 12151-12156) e `CMP` (l. 7904-7909) dicen "source operand, all
    // addressing modes" e listan
    // `An* 001`, co footnote `*Word and long only` (l. 5040); `AND` (l. 5460-5466),
    // `OR` (l. 11150-11152) e `EOR` (l. 9010-9016) marcan `An` como `—`. O
    // `as -m68000` bate exatamente nessa fronteira: monta `d248 addw %a0,%d1`,
    // `d288 addl`, `9248 subw`, `b248 cmpw`; recusa `add.b %a0,%d1`, `cmp.b
    // %a0,%d1` (sonda v9 l.20-23) e todo `and/or/eor.{b,w,l} %a0,%d1` con
    // "operands mismatch". `sub.b` recusa-se aqui polo footnote `*Word and long
    // only`, que a pagina de `SUB` comparte coa de `ADD`.
    if mode == 1 {
        if dir == 1 {
            return Err(out(
                op,
                "b8=1 com modo %001 = familia sbcd/abcd/addx/subx/cmpm/exg/pack/unpk e mov3q 68020: fora da lista fechada (contrato 3)",
            ));
        }
        if matches!(hi, 0b1000 | 0b1100) {
            return Err(out(
                op,
                "or/and com fonte %aN direta: prm l.5466/11152 marcam o modo como ausente e o as -m68000 recusa `or.w %a0,%d1`/`and.w %a0,%d1`",
            ));
        }
        if ss == 0b00 {
            return Err(out(
                op,
                "add/sub/cmp.b com fonte %aN direta: footnote `word and long only` (prm l.5040) e o as -m68000 recusa `add.b %a0,%d1`",
            ));
        }
    }
    // `b8` e o campo de direcao do grupo de 2 operandos: `0` = `<ea>` -> Dn e `1`
    // = Dn -> `<ea>`, portanto `b8=1` com EA em modo `%010..%110` e forma
    // documentada e O ROM real a usa (medido no calib: `d591 addl %d2,%a1@` em
    // `0x7e`, `9b78 1234 subw %d5,1234` em `0x80`; e no corpus E4: `8110 orb`,
    // `8190 orl`, `9190 subl`, `b190 eorl`, `c190 andl`, `d190 addl`). Nos modos
    // indexados `%101`/`%110` a word de extensao do corpus e sempre `4e71` e tem
    // campos de escala 68020, portanto ai continuam fronteira declarada.
    // Uma recusa larga de `b8=1` quebrou a paridade do calib — a primeira
    // correcao desta ETAPA fez exatamente isso e falhou por isso.
    //
    // O que NAO existe no subconjunto e `b8=1` com fonte em registrador direto:
    // `%000` e a familia SBCD (so .B), ABCD (so .B), ADDX/SUBX, EXG e PACK/UNPK
    // (68010/68020, lida em 4 bytes), e `%001` e SBCD/ABCD/ADDX/SUBX em
    // auto-decrementacao (ou CMPM em %1011). Medido no instrumento pinado sobre
    // o espaco inteiro: `8100 sbcd`, `8140 pack` (4B), `8180 unpk` (4B),
    // `c100 abcd`, `c140 exg`, `c180 .short`, `9100/9140/9180 subx`,
    // `d100/d140/d180 addx`, `b108 cmpm`. Nenhuma dessas formas esta na lista
    // fechada de §3 e a recusa e o unico caminho que nao inventa rotulo nem
    // comprimento. Excecao: `%1011` com `%000` e EOR (medido `b100 eorb`,
    // `b140 eorw`, `b180 eorl`), que fica.
    if dir == 1 && mode == 0 && hi != 0b1011 {
        return Err(out(
            op,
            "b8=1 com fonte Dn direta = familia SBCD/ABCD/EXG/ADDX/SUBX/PACK (68010/68020): fora da lista fechada (contrato 3)",
        ));
    }
    // Com `b8=1` o destino e um `<ea>` de escrita: imediato (%100) nao e destino
    // em nenhum grupo (medido `813c`/`817c`/`913c`/`b13c`/`c13c`/`d13c` como
    // `.short`), e os modos `%101..%111` com campo `%010..%111` ja caem na
    // checagem de PC/reservados acima.
    if dir == 1 && mode == 7 && mreg >= 4 {
        return Err(out(
            op,
            "b8=1 com destino imediato ou modo reservado: forma inexistente (instrumento .short)",
        ));
    }
    let ea = read_ea(cur, mode, mreg, size)?;
    if dir == 0 {
        // forma ea->Dn: imediato como fonte nao existe (so nos grupos op1 do §3)
        if mode == 7 && mreg == 4 {
            return Err(out(op, "forma ea->Dn com fonte imediata - invalido"));
        }
        return Ok(mk(
            addr,
            cur.next_addr,
            format!("{name_g}{sfx} {}, %d{dreg}", ea.text()),
            Flow::Normal,
        ));
    }
    Ok(mk(
        addr,
        cur.next_addr,
        format!("{name_g}{sfx} %d{dreg}, {}", ea.text()),
        Flow::Normal,
    ))
}

fn read_imm(cur: &mut Cur<'_>, size: u8) -> Result<String, Frontier> {
    match size {
        1 | 2 => {
            if cur.remaining() < 2 {
                return Err(Frontier::truncada(None, "imediato .B/.W sem word"));
            }
            let w = cur.word().unwrap();
            Ok(format!("#({:#06x})", if size == 1 { w & 0xFF } else { w }))
        }
        4 => {
            if cur.remaining() < 4 {
                return Err(Frontier::truncada(None, "imediato .L sem words"));
            }
            let hi = cur.word().unwrap() as u32;
            let lo = cur.word().unwrap() as u32;
            Ok(format!("#({:#010x})", (hi << 16) | lo))
        }
        _ => Err(Frontier::fora(None, "tamanho imediato invalido")),
    }
}
