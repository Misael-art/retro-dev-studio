//! Descoberta de código 68000 por descida recursiva (motor; sem nome de jogo).
//!
//! A partir dos vetores (reset e interrupções), segue o fluxo de controle com o
//! decodificador de tamanho de `rex_libsig`: desvios relativos (`Bcc/BRA/BSR/DBcc`) e
//! `JSR/JMP` com alvo estático (abs.W/abs.L/d16(PC)). Produz funções (alvos de chamada),
//! grafo de chamadas e referências estáticas de cada função (endereços absolutos e
//! PC-relativos usados como operando), que o chamador cruza com recursos/strings.
//!
//! Limites honestos: chamadas indiretas (`jsr (a0)`, tabelas de ponteiros) não são
//! seguidas — sementes extras podem ser passadas por quem tem evidência (ex.: ponteiros
//! de função provados). Bytes não alcançados continuam "desconhecidos".

use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

use super::rex_libsig::insn_len;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DiscoveredFunction {
    pub start: u32,
    /// Bytes de instrução alcançados a partir deste início (pode ser descontíguo).
    pub code_bytes: u32,
    pub calls: Vec<u32>,
    /// Operandos estáticos (abs/PC-rel/imediato com cara de endereço) — candidatos a xref.
    pub refs: Vec<u32>,
    /// Subconjunto de `refs` em contexto de ponteiro de código (`lea`/`pea`/`move.l #x`
    /// para registrador de endereço ou memória): únicas sementes da camada inferida.
    pub code_refs: Vec<u32>,
    /// Termina num salto indireto não resolvido (tabela de estados/callbacks).
    pub has_indirect: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct CodeMap {
    pub functions: Vec<DiscoveredFunction>,
    /// Inícios de instrução alcançados (para cobertura/desmontagem).
    pub insn_count: usize,
    pub code_bytes: usize,
    /// Faixas contíguas de instruções alcançadas `[início, fim)`.
    pub ranges: Vec<(u32, u32)>,
    pub invalid_stops: usize,
}

fn be16(rom: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*rom.get(at)?, *rom.get(at + 1)?]))
}

fn be32(rom: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes([
        *rom.get(at)?,
        *rom.get(at + 1)?,
        *rom.get(at + 2)?,
        *rom.get(at + 3)?,
    ]))
}

/// Alvos estáticos de uma instrução: (alvo, é_chamada, é_salto_incondicional, é_desvio).
struct Flow {
    len: usize,
    branch: Option<u32>,
    call: Option<u32>,
    jump: Option<u32>,
    stops: bool,
    indirect: bool,
    refs: Vec<u32>,
    code_refs: Vec<u32>,
}

/// Operando em contexto de ponteiro: `lea`, `pea`, ou `move.l #imm` cujo destino não é
/// registrador de dados. Constantes (`move.l #1000,d0`, `cmpi`, `addi`) e leituras de
/// memória (`move.l lbl,d0`) ficam de fora.
fn pointer_context(op: u16) -> bool {
    let src_mode = (op >> 3) & 7;
    let src_reg = op & 7;
    let lea = op & 0xF1C0 == 0x41C0;
    let pea = op & 0xFFC0 == 0x4840;
    let move_l_imm = op >> 12 == 2 && src_mode == 7 && src_reg == 4 && (op >> 6) & 7 != 0;
    lea || pea || move_l_imm
}

fn flow(rom: &[u8], pc: usize) -> Option<Flow> {
    let shape = insn_len(rom.get(pc..)?)?;
    let op = be16(rom, pc)?;
    let mut refs = Vec::new();
    for (at, n) in &shape.link_dependent {
        let ext = pc + at;
        let v = match n {
            4 => be32(rom, ext)?,
            _ => {
                let w = be16(rom, ext)?;
                // abs.W é sinal-estendido; d16(PC)/d8(PC,Xn) são relativos à extensão.
                let mode = (op >> 3) & 7;
                let reg = op & 7;
                let src_is_pcrel = mode == 7 && (reg == 2 || reg == 3);
                if src_is_pcrel && *at == 2 {
                    if reg == 3 {
                        (ext as i64 + i64::from((w & 0xFF) as u8 as i8)) as u32
                    } else {
                        (ext as i64 + i64::from(w as i16)) as u32
                    }
                } else {
                    w as i16 as i32 as u32
                }
            }
        };
        refs.push(v & 0x00FF_FFFF);
    }
    let rel = shape.branch.map(|(_, _, r)| (pc as i64 + r) as u32);
    let mut f = Flow {
        len: shape.len,
        branch: None,
        call: None,
        jump: None,
        stops: false,
        indirect: false,
        code_refs: if pointer_context(op) {
            refs.first().copied().into_iter().collect()
        } else {
            Vec::new()
        },
        refs,
    };
    match op {
        0x4E75 | 0x4E73 | 0x4E77 => f.stops = true,
        _ if op & 0xFF00 == 0x6100 => f.call = rel, // BSR
        _ if op & 0xFF00 == 0x6000 => {
            f.jump = rel; // BRA
            f.stops = true;
        }
        _ if op >> 12 == 6 || op & 0xF0F8 == 0x50C8 => f.branch = rel, // Bcc / DBcc
        _ if op & 0xFFC0 == 0x4E80 || op & 0xFFC0 == 0x4EC0 => {
            let is_call = op & 0xFFC0 == 0x4E80;
            let mode = (op >> 3) & 7;
            let reg = op & 7;
            let static_target = (mode == 7 && reg <= 2)
                .then(|| f.refs.first().copied())
                .flatten();
            match (is_call, static_target) {
                (true, Some(t)) => f.call = Some(t),
                (false, Some(t)) => {
                    f.jump = Some(t);
                    f.stops = true;
                }
                (true, None) => f.indirect = true,
                (false, None) => {
                    f.indirect = true;
                    f.stops = true;
                }
            }
        }
        _ => {}
    }
    Some(f)
}

/// Descobre código a partir de `seeds` (endereços de função). Endereços fora de
/// `[code_lo, code_hi)` ou ímpares não são seguidos.
pub fn discover(rom: &[u8], seeds: &[u32], code_hi: u32) -> CodeMap {
    let in_rom =
        |a: u32| a >= 0x200 && a < code_hi && a.is_multiple_of(2) && (a as usize) < rom.len();
    let mut owner: BTreeMap<u32, u32> = BTreeMap::new(); // pc -> função
    let mut funcs: BTreeMap<u32, DiscoveredFunction> = BTreeMap::new();
    let mut fqueue: Vec<u32> = seeds.iter().copied().filter(|a| in_rom(*a)).collect();
    let mut invalid = 0usize;
    while let Some(start) = fqueue.pop() {
        if funcs.contains_key(&start) {
            continue;
        }
        let mut f = DiscoveredFunction {
            start,
            code_bytes: 0,
            calls: Vec::new(),
            refs: Vec::new(),
            code_refs: Vec::new(),
            has_indirect: false,
        };
        let mut work = vec![start];
        let mut seen = BTreeSet::new();
        while let Some(mut pc) = work.pop() {
            loop {
                if !seen.insert(pc) || owner.get(&pc).is_some_and(|o| *o != start) && pc != start {
                    break;
                }
                let Some(fl) = flow(rom, pc as usize) else {
                    if std::env::var_os("RDS_FLOW_DEBUG").is_some() {
                        eprintln!(
                            "invalid@{pc:#x} {:02x?}",
                            rom.get(pc as usize..pc as usize + 6)
                        );
                    }
                    invalid += 1;
                    break;
                };
                owner.entry(pc).or_insert(start);
                f.code_bytes += fl.len as u32;
                f.refs.extend(fl.refs.iter().copied());
                f.code_refs.extend(fl.code_refs.iter().copied());
                f.has_indirect |= fl.indirect;
                if let Some(t) = fl.call.filter(|t| in_rom(*t)) {
                    f.calls.push(t);
                    fqueue.push(t);
                }
                if let Some(t) = fl.branch.filter(|t| in_rom(*t)) {
                    work.push(t);
                }
                if let Some(t) = fl.jump.filter(|t| in_rom(*t)) {
                    work.push(t);
                }
                if fl.stops {
                    break;
                }
                pc += fl.len as u32;
            }
        }
        f.calls.sort_unstable();
        f.calls.dedup();
        f.refs.sort_unstable();
        f.refs.dedup();
        f.code_refs.sort_unstable();
        f.code_refs.dedup();
        funcs.insert(start, f);
    }
    let code_bytes = funcs.values().map(|f| f.code_bytes as usize).sum();
    let mut ranges: Vec<(u32, u32)> = Vec::new();
    for pc in owner.keys() {
        let len = insn_len(&rom[*pc as usize..]).map_or(2, |s| s.len) as u32;
        match ranges.last_mut() {
            Some((_, end)) if *end == *pc => *end = pc + len,
            _ => ranges.push((*pc, pc + len)),
        }
    }
    CodeMap {
        insn_count: owner.len(),
        code_bytes,
        ranges,
        invalid_stops: invalid,
        functions: funcs.into_values().collect(),
    }
}

/// Caminha linearmente a partir de `at` até um terminador (rts/rte/rtr/jmp/bra) sem
/// opcode inválido, em no máximo `limit` bytes: forma mínima de "isto é código".
fn walks_as_code(rom: &[u8], at: u32, limit: usize) -> bool {
    let mut pc = at as usize;
    let end = (at as usize + limit).min(rom.len());
    let mut n = 0;
    while pc < end {
        let Some(fl) = flow(rom, pc) else {
            return false;
        };
        n += 1;
        if fl.stops {
            return n >= 2;
        }
        pc += fl.len;
    }
    false
}

/// Início de função compilada não é "caído em": o que vem antes é terminador
/// (`rts`/`rte`/`rtr`, `bra`, `jmp`) ou preenchimento (`0000`/`nop`). Checa as formas
/// fixas que terminam em `at` (decodificação para trás é ambígua; só estas são aceitas).
fn follows_terminator(rom: &[u8], at: u32) -> bool {
    let a = at as usize;
    let w = |back: usize| a.checked_sub(back).and_then(|p| be16(rom, p));
    matches!(w(2), Some(0x4E75 | 0x4E73 | 0x4E77 | 0x0000 | 0x4E71))
        || w(2).is_some_and(|x| x & 0xFF00 == 0x6000 && x & 0xFF != 0 && x & 0xFF != 0xFF)
        || w(4).is_some_and(|x| x == 0x6000 || x == 0x4EF8 || x & 0xFFF8 == 0x4EE8)
        || w(4) == Some(0x4EFA)
        || w(6) == Some(0x4EF9)
}

/// Segunda camada (rotulada `inferida`): ponteiros para código. Candidatos são palavras
/// de 32 bits alinhadas em qualquer ponto da ROM (tabelas de estado/callback) e
/// operandos de funções já descobertas, que caiam em `[0x200, code_hi)`. Aceita-se só o
/// alvo que caminha como código, não parte uma instrução já decodificada e não cai em
/// faixa excluída (dados recuperados).
pub fn pointer_seeds(rom: &[u8], map: &CodeMap, code_hi: u32, exclude: &[(u32, u32)]) -> Vec<u32> {
    let inside_code = |a: u32| map.ranges.iter().any(|(s, e)| a >= *s && a < *e);
    let excluded = |a: u32| exclude.iter().any(|(s, e)| a >= *s && a < *e);
    // Só operandos de código já descoberto (ex.: `move.l #fn,-(sp)` antes de registrar um
    // callback). Varredura cega de palavras da ROM foi medida e rejeitada (P 0,19–0,61).
    let cands: BTreeSet<u32> = map
        .functions
        .iter()
        .flat_map(|f| f.code_refs.iter().copied())
        .collect();
    cands
        .into_iter()
        .filter(|a| *a >= 0x200 && *a < code_hi && a.is_multiple_of(2))
        .filter(|a| !map.functions.iter().any(|f| f.start == *a))
        .filter(|a| !excluded(*a))
        // Alvo dentro de função já descoberta é rótulo do corpo, não início de função.
        .filter(|a| !inside_code(*a))
        .filter(|a| follows_terminator(rom, *a))
        .filter(|a| walks_as_code(rom, *a, 4096))
        .collect()
}

/// Descoberta completa: vetores + operandos que apontam para código, até ponto fixo.
pub fn discover_with_operand_seeds(rom: &[u8], code_hi: u32, exclude: &[(u32, u32)]) -> CodeMap {
    let mut seeds = vector_seeds(rom);
    let mut map = discover(rom, &seeds, code_hi);
    for _ in 0..16 {
        let extra = pointer_seeds(rom, &map, code_hi, exclude);
        if extra.is_empty() {
            break;
        }
        seeds.extend(extra);
        map = discover(rom, &seeds, code_hi);
    }
    map
}

/// Sementes do cabeçalho 68000: reset (vetor 1) e vetores de exceção/interrupção que
/// apontam para a ROM.
pub fn vector_seeds(rom: &[u8]) -> Vec<u32> {
    (1..64)
        .filter_map(|i| be32(rom, i * 4))
        .filter(|a| *a >= 0x200 && (*a as usize) < rom.len() && a.is_multiple_of(2))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follows_calls_branches_and_stops_at_returns() {
        let mut rom = vec![0u8; 0x400];
        rom[4..8].copy_from_slice(&0x200u32.to_be_bytes());
        // 0x200: jsr $00000300 ; bne.s +2 ; nop ; rts
        rom[0x200..0x20C]
            .copy_from_slice(&[0x4E, 0xB9, 0, 0, 3, 0, 0x66, 0x02, 0x4E, 0x71, 0x4E, 0x75]);
        // 0x300: lea $00000380,a0 ; jsr (a0) ; rts
        rom[0x300..0x30A].copy_from_slice(&[0x41, 0xF9, 0, 0, 3, 0x80, 0x4E, 0x90, 0x4E, 0x75]);
        let map = discover(&rom, &vector_seeds(&rom), 0x400);
        assert_eq!(map.functions.len(), 2);
        let main = &map.functions[0];
        assert_eq!((main.start, main.calls.clone()), (0x200, vec![0x300]));
        let callee = &map.functions[1];
        assert!(callee.has_indirect, "jsr (a0) é indireto");
        assert!(callee.refs.contains(&0x380), "lea abs.L vira referência");
    }

    #[test]
    fn only_pointer_contexts_seed_code() {
        assert!(super::pointer_context(0x41F9)); // lea abs.l,a0
        assert!(super::pointer_context(0x4879)); // pea abs.l
        assert!(super::pointer_context(0x2F3C)); // move.l #x,-(sp)
        assert!(super::pointer_context(0x207C)); // movea.l #x,a0
        assert!(!super::pointer_context(0x203C)); // move.l #x,d0: constante
        assert!(!super::pointer_context(0x0C80)); // cmpi.l #x,d0
        assert!(!super::pointer_context(0x2039)); // move.l abs.l,d0: leitura de dado
    }

    #[test]
    fn function_entry_must_follow_a_terminator() {
        let mut rom = vec![0u8; 0x40];
        rom[0x10..0x12].copy_from_slice(&[0x4E, 0x75]); // rts
        rom[0x12..0x14].copy_from_slice(&[0x44, 0x80]); // neg.l d0
        assert!(super::follows_terminator(&rom, 0x12));
        assert!(!super::follows_terminator(&rom, 0x14), "caído de neg.l");
        rom[0x20..0x26].copy_from_slice(&[0x4E, 0xF9, 0, 0, 0x02, 0x00]); // jmp abs.l
        assert!(super::follows_terminator(&rom, 0x26));
    }

    #[test]
    fn pc_relative_reference_is_resolved() {
        let mut rom = vec![0u8; 0x400];
        // 0x200: lea $10(pc),a0 ; rts   => alvo = 0x202 + 0x10
        rom[0x200..0x206].copy_from_slice(&[0x41, 0xFA, 0x00, 0x10, 0x4E, 0x75]);
        let map = discover(&rom, &[0x200], 0x400);
        assert_eq!(map.functions[0].refs, vec![0x212]);
    }

    /// BYOR: compara inícios de função descobertos com `symbol.txt` (T/t) por projeto.
    #[test]
    #[ignore = "BYOR: RDS_SGDKRES_TRUTH"]
    fn flow_function_starts_vs_truth() {
        // Limiares congelados antes da medição (FREEZE-2026-10-31).
        const MIN_P_STRICT: f64 = 0.95;
        const MIN_P_OPS: f64 = 0.90;
        let list = std::env::var("RDS_SGDKRES_TRUTH").expect("RDS_SGDKRES_TRUTH ausente");
        let mut failures = Vec::new();
        let mut rows = 0;
        for line in std::fs::read_to_string(&list)
            .unwrap_or_else(|e| panic!("{list}: {e}"))
            .lines()
        {
            rows += 1;
            let c: Vec<&str> = line.split('\t').collect();
            let rom = std::fs::read(c[1]).unwrap_or_else(|e| panic!("{}: {e}", c[1]));
            let truth: BTreeSet<u32> = std::fs::read_to_string(c[2])
                .unwrap_or_else(|e| panic!("{}: {e}", c[2]))
                .lines()
                .filter_map(|l| {
                    let mut it = l.split_whitespace();
                    let a = u32::from_str_radix(it.next()?, 16).ok()?;
                    matches!(it.next()?, "T" | "t").then_some(a)
                })
                .collect();
            let map = discover(&rom, &vector_seeds(&rom), rom.len() as u32);
            let found: BTreeSet<u32> = map.functions.iter().map(|f| f.start).collect();
            let ok = found.intersection(&truth).count();
            if std::env::var_os("RDS_FLOW_DEBUG").is_some() {
                let fp: Vec<String> = found
                    .difference(&truth)
                    .map(|a| format!("{a:06x}"))
                    .collect();
                println!("fp {}: {fp:?}", c[0]);
            }
            println!(
                "flow {:16} found={:5} truth={:5} ok={:5} P={:.3} R={:.3} code_bytes={} invalid={}",
                c[0],
                found.len(),
                truth.len(),
                ok,
                ok as f64 / found.len().max(1) as f64,
                ok as f64 / truth.len().max(1) as f64,
                map.code_bytes,
                map.invalid_stops
            );
            // Camada inferida: entrada é só a ROM e os recursos recuperados (sem vazamento
            // do ground truth).
            let graph = super::super::rex_sgdk_resources::recover_graph(&rom);
            let mut exclude: Vec<(u32, u32)> = graph
                .images
                .iter()
                .map(|i| {
                    (
                        i.tileset.stream_offset,
                        i.tileset.stream_offset + i.tileset.stream_bytes,
                    )
                })
                .collect();
            exclude.extend(graph.music.iter().map(|m| (m.offset, m.offset + m.len)));
            let map2 = discover_with_operand_seeds(&rom, rom.len() as u32, &exclude);
            let found2: BTreeSet<u32> = map2.functions.iter().map(|f| f.start).collect();
            let ok2 = found2.intersection(&truth).count();
            if std::env::var_os("RDS_FLOW_DEBUG").is_some() {
                // FP do tier inferido por classe: dentro de código estrito (rótulo) ou fora.
                let inside = |x: u32| map.ranges.iter().any(|(s, e)| x >= *s && x < *e);
                let (mut lab, mut out) = (Vec::new(), Vec::new());
                for x in found2.difference(&truth).filter(|x| !found.contains(x)) {
                    if inside(*x) {
                        lab.push(format!("{x:06x}"))
                    } else {
                        out.push(format!("{x:06x}"))
                    }
                }
                println!(
                    "fp+ops {} rotulo={} fora={} {out:?}",
                    c[0],
                    lab.len(),
                    out.len()
                );
            }
            println!(
                "flow+ops {:12} found={:5} truth={:5} ok={:5} P={:.3} R={:.3} code_bytes={}",
                c[0],
                found2.len(),
                truth.len(),
                ok2,
                ok2 as f64 / found2.len().max(1) as f64,
                ok2 as f64 / truth.len().max(1) as f64,
                map2.code_bytes
            );
            let p1 = ok as f64 / found.len().max(1) as f64;
            let p2 = ok2 as f64 / found2.len().max(1) as f64;
            if truth.is_empty() || found.is_empty() {
                failures.push(format!("{}: sem funções ou sem verdade", c[0]));
            }
            if p1 < MIN_P_STRICT {
                failures.push(format!("{}: P estrita {p1:.3} < {MIN_P_STRICT}", c[0]));
            }
            if p2 < MIN_P_OPS {
                failures.push(format!("{}: P operandos {p2:.3} < {MIN_P_OPS}", c[0]));
            }
            if ok2 < ok {
                failures.push(format!(
                    "{}: operandos perderam funções ({ok2} < {ok})",
                    c[0]
                ));
            }
        }
        assert!(rows > 0, "lista de verdade vazia");
        assert!(failures.is_empty(), "limiares reprovados: {failures:#?}");
    }
}
