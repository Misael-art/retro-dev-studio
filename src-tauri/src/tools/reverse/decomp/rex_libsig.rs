//! Dicionário de assinaturas de biblioteca M68K (motor genérico, estilo FLIRT).
//!
//! Plano: `docs/12_DECOMPILACAO_PAREADA_PLANO.md` item 0.4 ("hash normalizado,
//! tolerante a relocação"). Nada aqui cita jogo: o dicionário é DADO aprendido de
//! pares `ROM + symbol.txt` (ground truth de builds próprios) e aplicado a ROMs BYOR.
//!
//! Três peças:
//! 1. `insn_len` — decodificador de tamanho de instrução 68000 que também marca quais
//!    bytes de extensão dependem do link (abs.W/abs.L, d16(PC), d8(PC,Xn), deslocamento
//!    de desvio, imediato .L com cara de endereço). Esses bytes viram curinga.
//! 2. `learn` — agrupa funções por nome entre PROJETOS independentes; um nome cujo hash
//!    normalizado coincide em >= `min_projects` projetos é biblioteca. Código de jogo
//!    difere por projeto e cai fora sozinho (nenhuma lista de nomes embutida).
//! 3. `scan` — índice por âncora (primeiros bytes normalizados estritos) + verificação
//!    do hash completo com máscara sensível à região. Saída é evidência L1 (forma
//!    estática), nunca prova de consumo.
//!
//! Limites honestos: o release do SGDK 2.11 é LTO; o dicionário vale para o mesmo par
//! SDK/compilador que gerou o ground truth. Outra versão = outro dicionário (medido,
//! não suposto). Funções curtas demais são recusadas (`MIN_FUNC_BYTES`) por ambiguidade.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

pub const DICT_SCHEMA: &str = "rex-libsig/v1";
/// Funções menores que isso casam por acaso em qualquer ROM; ficam fora do dicionário.
pub const MIN_FUNC_BYTES: usize = 12;
/// Bytes normalizados usados como âncora do índice.
pub const ANCHOR_BYTES: usize = 8;
/// Teto defensivo para uma função do ground truth (dados misturados ao `.text`).
pub const MAX_FUNC_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Size {
    B,
    W,
    L,
}

/// Uma instrução decodificada: tamanho total e quais faixas (offset relativo, len) são
/// dependentes de link. `branch` guarda o alvo relativo de desvios PC-relativos.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InsnShape {
    pub len: usize,
    pub link_dependent: Vec<(usize, usize)>,
    pub branch: Option<(usize, usize, i64)>,
}

fn word(bytes: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*bytes.get(at)?, *bytes.get(at + 1)?]))
}

fn long(bytes: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes([
        *bytes.get(at)?,
        *bytes.get(at + 1)?,
        *bytes.get(at + 2)?,
        *bytes.get(at + 3)?,
    ]))
}

/// Imediato de 32 bits que provavelmente é endereço resolvido pelo linker (ROM/RAM).
/// Registradores de hardware ($A0xxxx Z80/IO, $C000xx VDP) são estáveis e ficam.
fn looks_like_link_address(value: u32) -> bool {
    let v = value & 0x00FF_FFFF;
    let high = value >> 24;
    (high == 0 || high == 0xFF) && ((0x200..0x0040_0000).contains(&v) || v >= 0x00FF_0000)
}

/// Extensão de um operando efetivo; empurra faixas link-dependentes em `out`.
fn ea_ext(
    bytes: &[u8],
    mode: u16,
    reg: u16,
    size: Size,
    at: usize,
    out: &mut Vec<(usize, usize)>,
) -> Option<usize> {
    Some(match mode {
        0..=4 => 0,
        5 | 6 => 2,
        7 => match reg {
            0 => {
                out.push((at, 2));
                2
            }
            1 => {
                out.push((at, 4));
                4
            }
            2 | 3 => {
                out.push((at, 2));
                2
            }
            4 => match size {
                Size::B | Size::W => 2,
                Size::L => {
                    if looks_like_link_address(long(bytes, at)?) {
                        out.push((at, 4));
                    }
                    4
                }
            },
            _ => return None,
        },
        _ => return None,
    })
}

fn size2(bits: u16) -> Option<Size> {
    match bits {
        0 => Some(Size::B),
        1 => Some(Size::W),
        2 => Some(Size::L),
        _ => None,
    }
}

/// Decodifica o tamanho da instrução 68000 em `bytes[0..]`. `None` = opcode inválido
/// ou truncado (o chamador trata como dado e recusa a assinatura naquele ponto).
pub fn insn_len(bytes: &[u8]) -> Option<InsnShape> {
    let op = word(bytes, 0)?;
    let mut ld = Vec::new();
    let mode = (op >> 3) & 7;
    let reg = op & 7;
    let mut branch = None;
    let len = match op >> 12 {
        0x0 => {
            if op & 0x0138 == 0x0108 {
                4 // MOVEP
            } else if op & 0x0100 != 0 {
                2 + ea_ext(bytes, mode, reg, Size::B, 2, &mut ld)?
            } else if op & 0xFF00 == 0x0800 {
                4 + ea_ext(bytes, mode, reg, Size::B, 4, &mut ld)?
            } else {
                let kind = (op >> 9) & 7;
                if !matches!(kind, 0 | 1 | 2 | 3 | 5 | 6) {
                    return None;
                }
                if op & 0x3F == 0x3C {
                    4 // ORI/ANDI/EORI to CCR/SR
                } else {
                    let s = size2((op >> 6) & 3)?;
                    let imm = if s == Size::L { 4 } else { 2 };
                    if s == Size::L && looks_like_link_address(long(bytes, 2)?) {
                        ld.push((2, 4));
                    }
                    2 + imm + ea_ext(bytes, mode, reg, s, 2 + imm, &mut ld)?
                }
            }
        }
        0x1..=0x3 => {
            let s = match op >> 12 {
                1 => Size::B,
                3 => Size::W,
                _ => Size::L,
            };
            let src = ea_ext(bytes, mode, reg, s, 2, &mut ld)?;
            let dmode = (op >> 6) & 7;
            let dreg = (op >> 9) & 7;
            if dmode == 7 && dreg > 1 {
                return None;
            }
            2 + src + ea_ext(bytes, dmode, dreg, s, 2 + src, &mut ld)?
        }
        0x4 => match op {
            0x4E70 | 0x4E71 | 0x4E73 | 0x4E75 | 0x4E76 | 0x4E77 | 0x4AFC => 2,
            0x4E72 => 4,
            _ if op & 0xFFF0 == 0x4E40 => 2,
            _ if op & 0xFFF8 == 0x4E50 => 4,
            _ if op & 0xFFF8 == 0x4E58 => 2,
            _ if op & 0xFFF0 == 0x4E60 => 2,
            _ if op & 0xFF80 == 0x4E80 => 2 + ea_ext(bytes, mode, reg, Size::L, 2, &mut ld)?,
            _ if op & 0xF1C0 == 0x41C0 || op & 0xFFC0 == 0x4840 && mode != 0 => {
                2 + ea_ext(bytes, mode, reg, Size::L, 2, &mut ld)?
            }
            _ if op & 0xFFF8 == 0x4840 => 2, // SWAP
            _ if op & 0xF1C0 == 0x4180 => 2 + ea_ext(bytes, mode, reg, Size::W, 2, &mut ld)?,
            _ if op & 0xFB80 == 0x4880 => {
                if mode == 0 {
                    2 // EXT
                } else {
                    4 + ea_ext(bytes, mode, reg, Size::W, 4, &mut ld)?
                }
            }
            _ if op & 0xFFC0 == 0x4AC0 || op & 0xFFC0 == 0x4800 => {
                2 + ea_ext(bytes, mode, reg, Size::B, 2, &mut ld)?
            }
            _ if op & 0xF900 == 0x4000 || op & 0xFF00 == 0x4A00 => {
                let s = match (op >> 6) & 3 {
                    3 => Size::W, // MOVE SR/CCR
                    b => size2(b)?,
                };
                2 + ea_ext(bytes, mode, reg, s, 2, &mut ld)?
            }
            _ => return None,
        },
        0x5 => {
            if op & 0xF0F8 == 0x50C8 {
                let disp = word(bytes, 2)? as i16 as i64;
                branch = Some((2, 2, 2 + disp));
                4
            } else if (op >> 6) & 3 == 3 {
                2 + ea_ext(bytes, mode, reg, Size::B, 2, &mut ld)?
            } else {
                2 + ea_ext(bytes, mode, reg, size2((op >> 6) & 3)?, 2, &mut ld)?
            }
        }
        0x6 => {
            let d8 = (op & 0xFF) as u8;
            if d8 == 0 {
                let disp = word(bytes, 2)? as i16 as i64;
                branch = Some((2, 2, 2 + disp));
                4
            } else {
                branch = Some((1, 1, 2 + (d8 as i8) as i64));
                2
            }
        }
        0x7 => 2,
        0x8 | 0xC => {
            let opm = (op >> 6) & 7;
            let bcd = op & 0xF1F0 == 0x8100 || op & 0xF1F0 == 0xC100;
            let exg = op >> 12 == 0xC && matches!(op & 0xF1F8, 0xC140 | 0xC148 | 0xC188);
            if bcd || exg {
                2 // SBCD/ABCD/EXG
            } else if opm == 3 || opm == 7 {
                2 + ea_ext(bytes, mode, reg, Size::W, 2, &mut ld)?
            } else {
                2 + ea_ext(bytes, mode, reg, size2(opm & 3)?, 2, &mut ld)?
            }
        }
        0x9 | 0xD | 0xB => {
            let opm = (op >> 6) & 7;
            if opm == 3 {
                2 + ea_ext(bytes, mode, reg, Size::W, 2, &mut ld)?
            } else if opm == 7 {
                2 + ea_ext(bytes, mode, reg, Size::L, 2, &mut ld)?
            } else if (op >> 12 != 0xB && op & 0x0130 == 0x0100)
                || (op >> 12 == 0xB && op & 0xF138 == 0xB108)
            {
                2 // ADDX/SUBX/CMPM
            } else {
                2 + ea_ext(bytes, mode, reg, size2(opm & 3)?, 2, &mut ld)?
            }
        }
        0xE => {
            if (op >> 6) & 3 == 3 {
                2 + ea_ext(bytes, mode, reg, Size::W, 2, &mut ld)?
            } else {
                2
            }
        }
        _ => return None,
    };
    if len > bytes.len() {
        return None;
    }
    Some(InsnShape {
        len,
        link_dependent: ld,
        branch,
    })
}

/// Normaliza `code` instrução a instrução, zerando bytes link-dependentes.
/// `region`: `Some(n)` mantém desvios cujo alvo cai em `[0, n)` (intra-função) e mascara
/// os demais; `None` mascara todo desvio (modo âncora, sem conhecer o tamanho).
/// Devolve `None` se encontrar opcode inválido antes de `limit` bytes.
pub fn normalize(code: &[u8], limit: usize, region: Option<usize>) -> Option<Vec<u8>> {
    let limit = limit.min(code.len());
    let mut out = Vec::with_capacity(limit + 4);
    let mut pc = 0usize;
    while pc < limit {
        let shape = insn_len(&code[pc..])?;
        let mut chunk = code[pc..pc + shape.len].to_vec();
        for (at, n) in &shape.link_dependent {
            chunk[*at..*at + *n].fill(0);
        }
        if let Some((at, n, rel)) = shape.branch {
            let target = pc as i64 + rel;
            let inside = region.is_some_and(|r| target >= 0 && (target as usize) < r);
            if !inside {
                chunk[at..at + n].fill(0);
            }
        }
        out.extend_from_slice(&chunk);
        pc += shape.len;
    }
    out.truncate(limit);
    Some(out)
}

/// Portão de "parece código": dados no `.text` (paletas, amostras zeradas) decodificam
/// como instruções válidas (`0000` = `ori.b #0,d0`). Exige que a região caminhe por
/// instruções até o fim, termine num desvio incondicional/retorno e não seja dominada
/// por palavras zero nem por um único valor repetido.
pub fn is_code_like(code: &[u8], size: usize) -> bool {
    let Some(region) = code.get(..size) else {
        return false;
    };
    let words: Vec<u16> = region
        .chunks_exact(2)
        .map(|w| u16::from_be_bytes([w[0], w[1]]))
        .collect();
    if words.is_empty() {
        return false;
    }
    let zeros = words.iter().filter(|w| **w == 0).count();
    let mut distinct = words.clone();
    distinct.sort_unstable();
    distinct.dedup();
    if zeros * 4 > words.len() || distinct.len() * 3 < words.len().min(30) {
        return false;
    }
    let mut pc = 0usize;
    let mut saw_terminator = false;
    while pc < size {
        let Some(shape) = insn_len(&region[pc..]) else {
            return false;
        };
        let op = words[pc / 2];
        // rts/rte/rtr, jmp, bra (incondicional)
        if matches!(op, 0x4E75 | 0x4E73 | 0x4E77) || op & 0xFFC0 == 0x4EC0 || op & 0xFF00 == 0x6000
        {
            saw_terminator = true;
        }
        pc += shape.len;
    }
    pc == size && saw_terminator
}

fn full_hash(code: &[u8], size: usize) -> Option<String> {
    let norm = normalize(code, size, Some(size))?;
    if norm.len() < size {
        return None;
    }
    Some(super::fingerprint::sha256_hex(&norm)[..32].to_string())
}

fn anchor_of(code: &[u8]) -> Option<[u8; ANCHOR_BYTES]> {
    let norm = normalize(code, ANCHOR_BYTES, None)?;
    norm.get(..ANCHOR_BYTES)?.try_into().ok()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(text.get(i..i + 2)?, 16).ok())
        .collect()
}

/// Função do ground truth: nome, endereço e tamanho (até o próximo símbolo).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TruthFunction {
    pub name: String,
    pub addr: u32,
    pub size: u32,
}

/// Extrai funções de um `symbol.txt` (formato `nm`: `addr tipo nome`, ordenado).
/// Tamanho = distância ao próximo símbolo com endereço maior; o último é descartado.
pub fn truth_functions(symbol_txt: &str, rom_len: usize) -> Vec<TruthFunction> {
    let mut all: Vec<(u32, char, String)> = symbol_txt
        .lines()
        .filter_map(|line| {
            let mut it = line.split_whitespace();
            let addr = u32::from_str_radix(it.next()?, 16).ok()?;
            let kind = it.next()?.chars().next()?;
            let name = it.next()?.to_string();
            Some((addr, kind, name))
        })
        .filter(|(addr, kind, _)| (*addr as usize) < rom_len && *kind != 'a' && *kind != 'A')
        .collect();
    all.sort_by_key(|(addr, _, _)| *addr);
    let mut out = Vec::new();
    for (i, (addr, kind, name)) in all.iter().enumerate() {
        if !matches!(kind, 'T' | 't' | 'W' | 'w') {
            continue;
        }
        let next = all[i + 1..]
            .iter()
            .find(|(a, _, _)| a > addr)
            .map(|(a, _, _)| *a);
        if let Some(next) = next {
            out.push(TruthFunction {
                name: name.clone(),
                addr: *addr,
                size: next - addr,
            });
        }
    }
    out
}

/// Entrada do dicionário: o que se versiona (sem bytes de código de terceiros: só
/// âncora normalizada de 8 bytes e hash truncado do corpo normalizado).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibSignature {
    pub name: String,
    pub size: u32,
    pub anchor: String,
    pub hash: String,
    /// Projetos independentes em que o corpo normalizado coincidiu.
    pub projects: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibSigDictionary {
    pub schema: String,
    /// Rótulo do par SDK/toolchain a que o dicionário pertence (ex.: `sgdk-2.11/gcc13-lto`).
    pub toolchain: String,
    pub min_projects: u32,
    pub source_projects: Vec<String>,
    pub signatures: Vec<LibSignature>,
    /// Nomes vistos em >= min_projects mas com corpos divergentes (inlining/LTO): não
    /// entram como assinatura, ficam listados para auditoria.
    pub unstable: Vec<String>,
}

/// Um projeto do ground truth: nome independente + bytes da ROM + funções.
pub struct TruthProject<'a> {
    pub project: String,
    pub rom: &'a [u8],
    pub functions: Vec<TruthFunction>,
}

/// Corpo normalizado visto: projetos que o contêm, tamanho e âncora.
type Variant = (Vec<String>, u32, String);

/// Aprende o dicionário a partir de projetos independentes.
pub fn learn(
    toolchain: &str,
    projects: &[TruthProject<'_>],
    min_projects: u32,
) -> LibSigDictionary {
    // nome -> hash -> variante
    let mut seen: BTreeMap<String, BTreeMap<String, Variant>> = BTreeMap::new();
    for project in projects {
        for func in &project.functions {
            let size = func.size as usize;
            if !(MIN_FUNC_BYTES..=MAX_FUNC_BYTES).contains(&size) {
                continue;
            }
            let Some(code) = project.rom.get(func.addr as usize..) else {
                continue;
            };
            if !is_code_like(code, size) {
                continue;
            }
            let (Some(hash), Some(anchor)) = (full_hash(code, size), anchor_of(code)) else {
                continue;
            };
            let slot = seen
                .entry(func.name.clone())
                .or_default()
                .entry(hash)
                .or_insert_with(|| (Vec::new(), func.size, hex(&anchor)));
            if !slot.0.contains(&project.project) {
                slot.0.push(project.project.clone());
            }
        }
    }
    let mut signatures = Vec::new();
    let mut unstable = Vec::new();
    for (name, variants) in seen {
        let total: usize = variants.values().map(|v| v.0.len()).sum();
        let mut best: Vec<_> = variants.into_iter().collect();
        best.sort_by_key(|(_, v)| std::cmp::Reverse(v.0.len()));
        let (hash, (projs, size, anchor)) = best.swap_remove(0);
        if projs.len() as u32 >= min_projects {
            signatures.push(LibSignature {
                name,
                size,
                anchor,
                hash,
                projects: projs.len() as u32,
            });
        } else if total as u32 >= min_projects {
            unstable.push(name);
        }
    }
    let mut source_projects: Vec<String> = projects.iter().map(|p| p.project.clone()).collect();
    source_projects.sort();
    source_projects.dedup();
    LibSigDictionary {
        schema: DICT_SCHEMA.to_string(),
        toolchain: toolchain.to_string(),
        min_projects,
        source_projects,
        signatures,
        unstable,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibMatch {
    pub addr: u32,
    pub name: String,
    pub size: u32,
}

/// Procura todas as assinaturas na ROM (offsets pares). Sobreposições são resolvidas
/// pela assinatura mais longa; nomes com o mesmo corpo (aliases) aparecem todos.
pub fn scan(dict: &LibSigDictionary, rom: &[u8]) -> Vec<LibMatch> {
    let mut by_anchor: HashMap<[u8; ANCHOR_BYTES], Vec<&LibSignature>> = HashMap::new();
    for sig in &dict.signatures {
        if let Some(anchor) = unhex(&sig.anchor).and_then(|a| a.try_into().ok()) {
            by_anchor.entry(anchor).or_default().push(sig);
        }
    }
    let mut hits = Vec::new();
    let mut offset = 0usize;
    while offset + ANCHOR_BYTES <= rom.len() {
        if let Some(cands) = anchor_of(&rom[offset..]).and_then(|a| by_anchor.get(&a)) {
            for sig in cands {
                if full_hash(&rom[offset..], sig.size as usize).as_deref() == Some(&sig.hash) {
                    hits.push(LibMatch {
                        addr: offset as u32,
                        name: sig.name.clone(),
                        size: sig.size,
                    });
                }
            }
        }
        offset += 2;
    }
    // Remove casamentos contidos em outro casamento mais longo (ex.: corpo comum).
    hits.sort_by_key(|m| (m.addr, std::cmp::Reverse(m.size)));
    let mut kept: Vec<LibMatch> = Vec::new();
    let mut covered_until = 0u32;
    let mut last_start = u32::MAX;
    for hit in hits {
        if hit.addr < covered_until && hit.addr != last_start {
            continue;
        }
        if hit.addr != last_start {
            covered_until = hit.addr + hit.size;
            last_start = hit.addr;
        }
        kept.push(hit);
    }
    kept
}

/// Métrica de holdout contra o ground truth de um projeto NÃO usado no aprendizado.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HoldoutScore {
    pub project: String,
    /// Funções do projeto cujo nome existe no dicionário (denominador de recall).
    pub expected: usize,
    pub matched_correct: usize,
    pub matched_wrong: usize,
    pub precision: f64,
    pub recall: f64,
    /// Bytes de `.text` cobertos por casamentos corretos / bytes de funções do projeto.
    pub byte_coverage: f64,
}

pub fn score_holdout(dict: &LibSigDictionary, project: &TruthProject<'_>) -> HoldoutScore {
    let names: std::collections::HashSet<&str> =
        dict.signatures.iter().map(|s| s.name.as_str()).collect();
    let truth: HashMap<u32, Vec<&str>> =
        project.functions.iter().fold(HashMap::new(), |mut m, f| {
            m.entry(f.addr).or_default().push(f.name.as_str());
            m
        });
    let hits = scan(dict, project.rom);
    let mut correct = 0usize;
    let mut wrong = 0usize;
    let mut correct_addrs = std::collections::HashSet::new();
    for hit in &hits {
        let ok = truth
            .get(&hit.addr)
            .is_some_and(|ns| ns.contains(&hit.name.as_str()));
        if ok {
            correct += 1;
            correct_addrs.insert(hit.addr);
        } else {
            wrong += 1;
        }
    }
    let expected = project
        .functions
        .iter()
        .filter(|f| names.contains(f.name.as_str()) && f.size as usize >= MIN_FUNC_BYTES)
        .count();
    let total_bytes: u64 = project.functions.iter().map(|f| f.size as u64).sum();
    let covered: u64 = project
        .functions
        .iter()
        .filter(|f| correct_addrs.contains(&f.addr))
        .map(|f| f.size as u64)
        .sum();
    let ratio = |a: usize, b: usize| if b == 0 { 0.0 } else { a as f64 / b as f64 };
    HoldoutScore {
        project: project.project.clone(),
        expected,
        matched_correct: correct,
        matched_wrong: wrong,
        precision: ratio(correct, correct + wrong),
        recall: ratio(correct_addrs.len(), expected),
        byte_coverage: if total_bytes == 0 {
            0.0
        } else {
            covered as f64 / total_bytes as f64
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_common_instruction_lengths() {
        let cases: &[(&[u8], usize)] = &[
            (&[0x4E, 0x75], 2),                      // rts
            (&[0x4E, 0xB9, 0, 0, 0x12, 0x34], 6),    // jsr abs.l
            (&[0x20, 0x3C, 0, 0, 0, 1], 6),          // move.l #1,d0
            (&[0x33, 0xFC, 0, 1, 0, 0xFF, 0, 0], 8), // move.w #1,abs.l
            (&[0x48, 0xE7, 0x3F, 0x3E], 4),          // movem.l regs,-(sp)
            (&[0x61, 0x00, 0x01, 0x00], 4),          // bsr.w
            (&[0x66, 0x08], 2),                      // bne.s
            (&[0x51, 0xC8, 0xFF, 0xFC], 4),          // dbf d0
            (&[0x41, 0xFA, 0x00, 0x10], 4),          // lea d16(pc),a0
            (&[0x48, 0x79, 0, 0, 0x20, 0], 6),       // pea abs.l
            (&[0x0C, 0x80, 0, 0, 0, 5], 6),          // cmpi.l #5,d0
            (&[0x08, 0x39, 0, 7, 0, 0xA1, 0, 1], 8), // btst #7,abs.l
            (&[0x4E, 0x56, 0xFF, 0xF0], 4),          // link
            (&[0xE3, 0x48], 2),                      // lsl.w #1,d0
            (&[0x70, 0x01], 2),                      // moveq
        ];
        for (code, len) in cases {
            assert_eq!(insn_len(code).map(|s| s.len), Some(*len), "{code:02x?}");
        }
        assert_eq!(insn_len(&[0xF0, 0x00]), None);
    }

    #[test]
    fn normalization_survives_relocation() {
        // jsr $00001234 ; lea $FF0100,a0 ; move.l #$00ABCD00,d0 ; move.w #$0003,d1 ; rts
        let a = [
            0x4E, 0xB9, 0, 0, 0x12, 0x34, 0x41, 0xF9, 0, 0xFF, 0x01, 0x00, 0x20, 0x3C, 0, 0x0A,
            0xBC, 0xD0, 0x32, 0x3C, 0, 3, 0x4E, 0x75,
        ];
        let mut b = a;
        b[4] = 0x56; // outro alvo de jsr
        b[11] = 0x80; // outra variável em RAM
        b[16] = 0x11; // outro ponteiro de recurso
        assert_eq!(full_hash(&a, a.len()), full_hash(&b, b.len()));
        let mut c = a;
        c[21] = 4; // constante diferente = função diferente
        assert_ne!(full_hash(&a, a.len()), full_hash(&c, c.len()));
    }

    #[test]
    fn intra_function_branches_are_kept_external_masked() {
        // bne.s +2 (interno) ; rts ; rts
        let a = [0x66, 0x02, 0x4E, 0x75, 0x4E, 0x75];
        let mut b = a;
        b[1] = 0x00; // alvo diferente => corpo diferente
        b[2] = 0x00;
        b[3] = 0x02;
        assert_ne!(normalize(&a, 6, Some(6)), normalize(&b, 6, Some(6)));
        // bra.w para fora da função: deslocamento vira curinga
        let far1 = [0x60, 0x00, 0x10, 0x00, 0x4E, 0x75];
        let far2 = [0x60, 0x00, 0x20, 0x00, 0x4E, 0x75];
        assert_eq!(normalize(&far1, 6, Some(6)), normalize(&far2, 6, Some(6)));
    }

    fn fake_rom(body_at: usize, pad: u8) -> Vec<u8> {
        let body = [
            0x4E, 0x56, 0, 0, 0x20, 0x2E, 0, 8, 0x4E, 0xB9, 0, 0, 0x40, 0x00, 0xD0, 0x81, 0x4E,
            0x5E, 0x4E, 0x75,
        ];
        let mut rom = vec![pad; 0x400];
        rom[body_at..body_at + body.len()].copy_from_slice(&body);
        rom[body_at + 12] = (body_at >> 8) as u8; // relocação diferente por ROM
        rom
    }

    #[test]
    fn learn_requires_independent_projects_and_scan_finds_relocated_copy() {
        let r1 = fake_rom(0x100, 0x4E);
        let r2 = fake_rom(0x180, 0x71);
        let f = |addr| {
            vec![TruthFunction {
                name: "LIB_fn".into(),
                addr,
                size: 20,
            }]
        };
        let p1 = TruthProject {
            project: "a".into(),
            rom: &r1,
            functions: f(0x100),
        };
        let p2 = TruthProject {
            project: "b".into(),
            rom: &r2,
            functions: f(0x180),
        };
        let solo = learn("t", std::slice::from_ref(&p1), 2);
        assert!(
            solo.signatures.is_empty(),
            "um projeto só não prova biblioteca"
        );
        let dict = learn("t", &[p1, p2], 2);
        assert_eq!(dict.signatures.len(), 1);
        let r3 = fake_rom(0x2A0, 0x00);
        let hits = scan(&dict, &r3);
        assert_eq!(
            hits,
            vec![LibMatch {
                addr: 0x2A0,
                name: "LIB_fn".into(),
                size: 20
            }]
        );
        // controle negativo: ROM sem a função
        assert!(scan(&dict, &vec![0x4E; 0x400]).is_empty());
    }

    #[test]
    fn data_in_text_is_not_code_like() {
        assert!(!is_code_like(&[0u8; 32], 32), "paleta preta");
        let mut pal = Vec::new();
        for i in 0..16u16 {
            pal.extend_from_slice(&((i * 0x0222) & 0x0EEE).to_be_bytes());
        }
        assert!(!is_code_like(&pal, 32), "paleta sem retorno");
        let body = [
            0x4E, 0x56, 0, 0, 0x20, 0x2E, 0, 8, 0xD0, 0x81, 0x4E, 0x5E, 0x4E, 0x75,
        ];
        assert!(is_code_like(&body, body.len()));
    }

    #[test]
    fn truth_functions_sizes_from_next_symbol() {
        let txt = "00000200 T _start\n00000210 t helper\n00000240 R table\n00000300 T last\n";
        let f = truth_functions(txt, 0x1000);
        assert_eq!(f.len(), 2);
        assert_eq!((f[0].name.as_str(), f[0].size), ("_start", 0x10));
        assert_eq!((f[1].name.as_str(), f[1].size), ("helper", 0x30));
    }
}

/// Runner BYOR (fora do CI): aprende, mede holdout leave-one-project-out e varre um
/// corpus. Entradas por ambiente; nada de ROM no repositório.
/// * `RDS_LIBSIG_TRUTH`: arquivo TSV `projeto<TAB>rom.bin<TAB>symbol.txt` (um por linha);
/// * `RDS_LIBSIG_CORPUS`: diretório com ROMs BYOR a varrer (opcional);
/// * `RDS_LIBSIG_OUT`: diretório de saída (dicionário + relatórios).
#[cfg(test)]
mod runner {
    use super::*;
    use std::path::PathBuf;

    #[test]
    #[ignore = "BYOR: requer RDS_LIBSIG_TRUTH/RDS_LIBSIG_OUT"]
    fn libsig_learn_holdout_and_scan() {
        let truth_list = std::env::var("RDS_LIBSIG_TRUTH").expect("RDS_LIBSIG_TRUTH");
        let out = PathBuf::from(std::env::var("RDS_LIBSIG_OUT").expect("RDS_LIBSIG_OUT"));
        let toolchain =
            std::env::var("RDS_LIBSIG_TOOLCHAIN").unwrap_or_else(|_| "sgdk-2.11/gcc13-lto".into());
        std::fs::create_dir_all(&out).unwrap();
        let mut roms = Vec::new();
        for line in std::fs::read_to_string(&truth_list).unwrap().lines() {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() != 3 {
                continue;
            }
            let rom = std::fs::read(cols[1]).unwrap();
            let sym = std::fs::read_to_string(cols[2]).unwrap();
            roms.push((cols[0].to_string(), rom, sym));
        }
        assert!(roms.len() >= 3, "holdout exige >= 3 projetos");
        let projects: Vec<TruthProject> = roms
            .iter()
            .map(|(p, rom, sym)| TruthProject {
                project: p.clone(),
                rom,
                functions: truth_functions(sym, rom.len()),
            })
            .collect();
        // Holdout: aprende sem o projeto i, mede no projeto i.
        let mut scores = Vec::new();
        for i in 0..projects.len() {
            let train: Vec<TruthProject> = projects
                .iter()
                .enumerate()
                .filter(|(_, p)| p.project != projects[i].project)
                .map(|(_, p)| TruthProject {
                    project: p.project.clone(),
                    rom: p.rom,
                    functions: p.functions.clone(),
                })
                .collect();
            let dict = learn(&toolchain, &train, 2);
            let s = score_holdout(&dict, &projects[i]);
            println!(
                "holdout {:40} sigs={:4} expected={:4} ok={:4} wrong={:3} P={:.3} R={:.3} bytes={:.3}",
                s.project, dict.signatures.len(), s.expected, s.matched_correct, s.matched_wrong, s.precision, s.recall, s.byte_coverage
            );
            scores.push(s);
        }
        let dict = learn(&toolchain, &projects, 2);
        println!(
            "dicionario final: {} assinaturas, {} instaveis",
            dict.signatures.len(),
            dict.unstable.len()
        );
        std::fs::write(
            out.join("dictionary.json"),
            serde_json::to_string_pretty(&dict).unwrap(),
        )
        .unwrap();
        std::fs::write(
            out.join("holdout.json"),
            serde_json::to_string_pretty(&scores).unwrap(),
        )
        .unwrap();
        if let Ok(corpus) = std::env::var("RDS_LIBSIG_CORPUS") {
            let mut report = Vec::new();
            let mut entries: Vec<_> = std::fs::read_dir(corpus)
                .unwrap()
                .flatten()
                .map(|e| e.path())
                .collect();
            entries.sort();
            for path in entries {
                let rom = std::fs::read(&path).unwrap();
                let hits = scan(&dict, &rom);
                let bytes: u64 = hits.iter().map(|h| h.size as u64).sum();
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                println!("corpus {:60} hits={:4} bytes={:7}", name, hits.len(), bytes);
                report.push(serde_json::json!({
                    "rom": name,
                    "sha256": super::super::fingerprint::sha256_hex(&rom),
                    "hits": hits.len(),
                    "matched_bytes": bytes,
                    "matches": hits,
                }));
            }
            std::fs::write(
                out.join("corpus-scan.json"),
                serde_json::to_string_pretty(&report).unwrap(),
            )
            .unwrap();
        }
    }

    /// Diferencial do decodificador: imprime os inícios de instrução de cada função do
    /// ground truth para comparação externa com `m68k-elf-objdump`.
    #[test]
    #[ignore = "BYOR: requer RDS_LIBSIG_DIFF_ROM/RDS_LIBSIG_DIFF_SYM/RDS_LIBSIG_OUT"]
    fn libsig_dump_boundaries() {
        let rom = std::fs::read(std::env::var("RDS_LIBSIG_DIFF_ROM").unwrap()).unwrap();
        let sym = std::fs::read_to_string(std::env::var("RDS_LIBSIG_DIFF_SYM").unwrap()).unwrap();
        let out = PathBuf::from(std::env::var("RDS_LIBSIG_OUT").unwrap());
        let mut lines = String::new();
        for f in truth_functions(&sym, rom.len()) {
            let mut pc = f.addr as usize;
            let end = (f.addr + f.size) as usize;
            while pc < end {
                match insn_len(&rom[pc..]) {
                    Some(s) => {
                        lines.push_str(&format!("{pc:x}\n"));
                        pc += s.len;
                    }
                    None => break,
                }
            }
        }
        std::fs::write(out.join("boundaries.txt"), lines).unwrap();
    }
}
