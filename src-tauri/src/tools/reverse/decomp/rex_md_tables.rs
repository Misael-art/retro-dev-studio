//! Tabelas de recursos de motores Mega Drive não-SGDK, provadas por arestas tipadas
//! (motor; sem nome de jogo, sem offsets fixos).
//!
//! Cada estrutura só é aceita se se apoia em algo já provado:
//! * tabela de deslocamentos (words relativos à base) cujos alvos são listas de carga com
//!   contador `{dc.w n-1; n × {ptr.l, vram.w}}`, ancorada em ≥2 listas já provadas pelo
//!   localizador de streams Nemesis; recupera listas de 1 entrada que a varredura cega
//!   (≥2 entradas consecutivas) não pode aceitar;
//! * registros de passo fixo em que um campo aponta (24 bits; byte alto = etiqueta) para
//!   arte provada em TODAS as linhas; campos irmãos só ganham tipo se exatamente um codec
//!   estrito (Enigma, Kosinski, Nemesis) decodifica o alvo em todas as linhas;
//! * tabelas de paleta `{ptr.l, destino.w, contador.w}` cujos alvos são palavras de cor MD
//!   válidas; o índice de paleta de um registro é o campo de byte que varia entre linhas e
//!   cabe na tabela;
//! * linha de paleta por tile de arte: votos das palavras de mapa (Enigma) que referenciam
//!   o tile na VRAM onde a lista de carga da linha o coloca.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

use super::rex_nemesis::{self, LocatedStream};

fn be16(rom: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*rom.get(at)?, *rom.get(at + 1)?]))
}

fn be32(rom: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(rom.get(at..at + 4)?.try_into().ok()?))
}

fn rom_ptr(rom: &[u8], v: u32) -> Option<u32> {
    (v >= 0x200 && (v as usize) < rom.len() && v.is_multiple_of(2)).then_some(v)
}

/// Lista de carga com contador em `at`: `n-1` seguido de `n` entradas `{ptr.l, vram.w}`.
fn counted_list(rom: &[u8], at: usize) -> Option<Vec<(u32, u16)>> {
    let c = be16(rom, at)?;
    if c >= 64 {
        return None;
    }
    (0..=usize::from(c))
        .map(|i| {
            let p = at + 2 + i * 6;
            let ptr = rom_ptr(rom, be32(rom, p)?)?;
            let vram = be16(rom, p + 4)?;
            vram.is_multiple_of(0x20).then_some((ptr, vram))
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OffsetTable {
    pub base: u32,
    /// Endereço do contador de cada lista, na ordem da tabela (índice = etiqueta).
    pub lists: Vec<u32>,
}

/// Tabelas de deslocamentos para listas de carga, ancoradas em listas já provadas
/// (`proven` = endereço da 1ª entrada). A tabela termina antes do seu primeiro alvo.
pub fn locate_offset_tables(rom: &[u8], proven: &BTreeSet<u32>) -> Vec<OffsetTable> {
    let mut out = Vec::new();
    let mut b = 0x200usize;
    while b + 4 <= rom.len() {
        let mut lists = Vec::new();
        let mut first_target = usize::MAX;
        loop {
            let at = b + lists.len() * 2;
            if at >= first_target {
                break;
            }
            let Some(w) = be16(rom, at).filter(|w| *w > 0 && w.is_multiple_of(2)) else {
                break;
            };
            let t = b + usize::from(w);
            if counted_list(rom, t).is_none() {
                break;
            }
            first_target = first_target.min(t);
            lists.push(t as u32);
        }
        let anchors = lists.iter().filter(|t| proven.contains(&(*t + 2))).count();
        if lists.len() >= 2 && anchors >= 2 {
            let n = lists.len();
            out.push(OffsetTable {
                base: b as u32,
                lists,
            });
            b += n * 2;
        } else {
            b += 2;
        }
    }
    out
}

/// Streams Nemesis: varredura de listas (≥2 entradas) + listas alcançadas por tabelas de
/// deslocamentos ancoradas. Cada entrada extra ainda precisa decodificar e caber na VRAM.
pub fn locate_art_streams(rom: &[u8]) -> (Vec<LocatedStream>, Vec<OffsetTable>) {
    let mut streams = rex_nemesis::locate_plc_streams(rom, 2);
    let proven: BTreeSet<u32> = streams.iter().map(|s| s.table).collect();
    let tables = locate_offset_tables(rom, &proven);
    let known: BTreeSet<u32> = streams.iter().map(|s| s.offset).collect();
    let mut extra: BTreeMap<u32, LocatedStream> = BTreeMap::new();
    for t in &tables {
        for list in &t.lists {
            for (ptr, vram) in counted_list(rom, *list as usize).unwrap_or_default() {
                if known.contains(&ptr) || extra.contains_key(&ptr) {
                    continue;
                }
                let Ok(d) = rex_nemesis::decode(&rom[ptr as usize..], &Default::default()) else {
                    continue;
                };
                let st = d.stats;
                if st.tiles == 0 || usize::from(vram) + st.tiles * rex_nemesis::TILE_BYTES > 0x10000
                {
                    continue;
                }
                extra.insert(
                    ptr,
                    LocatedStream {
                        offset: ptr,
                        len: st.bytes_lidos as u32,
                        tiles: st.tiles as u32,
                        xor_mode: st.xor_mode,
                        vram,
                        table: list + 2,
                    },
                );
            }
        }
    }
    streams.extend(extra.into_values());
    streams.sort_by_key(|s| s.offset);
    // Sobreposição entre streams aceitos derruba o mais curto (não há dois donos de um byte).
    let mut keep: Vec<LocatedStream> = Vec::new();
    for s in streams {
        match keep.last() {
            Some(prev) if prev.offset + prev.len > s.offset => {
                if s.len > prev.len {
                    keep.pop();
                    keep.push(s);
                }
            }
            _ => keep.push(s),
        }
    }
    (keep, tables)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodecStream {
    pub offset: u32,
    /// Bytes do stream comprimido consumidos pelo decoder.
    pub len: u32,
    /// Tamanho da saída descomprimida.
    pub plain_len: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecordField {
    /// Deslocamento do campo dentro da linha.
    pub at: u32,
    /// `nemesis`, `enigma`, `kosinski` (ponteiro 24 bits) ou `byte`.
    pub kind: String,
    /// Por linha: alvo (ponteiro) ou valor (byte).
    pub values: Vec<u32>,
    /// Por linha: byte alto do ponteiro (etiqueta; 0 se ausente). Vazio para `byte`.
    #[serde(default)]
    pub tags: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecordTable {
    pub offset: u32,
    pub stride: u32,
    pub rows: u32,
    pub fields: Vec<RecordField>,
}

fn decode_kind(rom: &[u8], at: u32, kind: &str) -> Option<CodecStream> {
    let s = &rom[at as usize..];
    match kind {
        "nemesis" => rex_nemesis::decode(s, &Default::default())
            .ok()
            .filter(|d| d.stats.tiles > 0)
            .map(|d| CodecStream {
                offset: at,
                len: d.stats.bytes_lidos as u32,
                plain_len: d.bytes.len() as u32,
            }),
        "enigma" => rex_enigma::decode(s, &Default::default())
            .ok()
            .filter(|d| !d.words.is_empty())
            .map(|d| CodecStream {
                offset: at,
                len: d.stats.bytes_lidos as u32,
                plain_len: (d.words.len() * 2) as u32,
            }),
        "kosinski" => ::rex_kosinski::decode(s, 0x10000, 4_000_000)
            .ok()
            .filter(|d| !d.output.is_empty())
            .map(|d| CodecStream {
                offset: at,
                len: d.bytes_consumed as u32,
                plain_len: d.output.len() as u32,
            }),
        _ => None,
    }
}

pub const CODECS: [&str; 3] = ["nemesis", "enigma", "kosinski"];

/// Tabelas de registros ancoradas em arte provada (ver doc do módulo).
pub fn locate_record_tables(rom: &[u8], art: &[LocatedStream]) -> Vec<RecordTable> {
    let proven: BTreeSet<u32> = art.iter().map(|s| s.offset).collect();
    let anchored = |p: usize| be32(rom, p).is_some_and(|v| proven.contains(&(v & 0x00FF_FFFF)));
    let mut out: Vec<RecordTable> = Vec::new();
    let mut taken: BTreeSet<usize> = BTreeSet::new();
    for p in (0x200..rom.len().saturating_sub(4)).step_by(2) {
        if taken.contains(&p) || !anchored(p) {
            continue;
        }
        // Passo com mais linhas ancoradas a partir de `p` (mínimo 3; empate: menor passo).
        let best = (8..=32usize)
            .step_by(2)
            .map(|s| {
                let n = (0..).take_while(|k| anchored(p + k * s)).count();
                (n, s)
            })
            .max_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
        let Some((rows, stride)) = best.filter(|(n, _)| *n >= 3) else {
            continue;
        };
        let row = |k: usize| p + k * stride;
        let mut fields = vec![RecordField {
            at: 0,
            kind: "nemesis".into(),
            values: (0..rows)
                .map(|k| be32(rom, row(k)).unwrap() & 0x00FF_FFFF)
                .collect(),
            tags: (0..rows).map(|k| rom[row(k)]).collect(),
        }];
        let mut covered = vec![false; stride];
        covered[..4].fill(true);
        for g in (4..=stride - 4).step_by(2) {
            if covered[g..g + 4].iter().any(|c| *c) {
                continue;
            }
            let ptrs: Option<Vec<u32>> = (0..rows)
                .map(|k| rom_ptr(rom, be32(rom, row(k) + g)? & 0x00FF_FFFF))
                .collect();
            let Some(ptrs) = ptrs else { continue };
            let ok: Vec<&str> = CODECS
                .iter()
                .copied()
                .filter(|kind| ptrs.iter().all(|a| decode_kind(rom, *a, kind).is_some()))
                .collect();
            if let [kind] = ok[..] {
                covered[g..g + 4].fill(true);
                fields.push(RecordField {
                    at: g as u32,
                    kind: kind.into(),
                    values: ptrs,
                    tags: (0..rows).map(|k| rom[row(k) + g]).collect(),
                });
            }
        }
        for (g, c) in covered.iter().enumerate() {
            if !c {
                fields.push(RecordField {
                    at: g as u32,
                    kind: "byte".into(),
                    values: (0..rows).map(|k| u32::from(rom[row(k) + g])).collect(),
                    tags: Vec::new(),
                });
            }
        }
        fields.sort_by_key(|f| f.at);
        // Só vale como registro se tipar algo NOVO (codec ≠ Nemesis); senão é a própria
        // lista de carga vista com outro passo.
        if !fields
            .iter()
            .any(|f| f.kind == "enigma" || f.kind == "kosinski")
        {
            continue;
        }
        taken.extend((0..rows).map(row));
        out.push(RecordTable {
            offset: p as u32,
            stride: stride as u32,
            rows: rows as u32,
            fields,
        });
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaletteEntry {
    pub ptr: u32,
    pub dest: u16,
    pub words: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaletteTable {
    pub offset: u32,
    /// Leitura do contador que vale para TODAS as entradas: `longs-1`, `words-1` ou `bytes`.
    pub count_form: String,
    pub entries: Vec<PaletteEntry>,
}

fn color_ok(rom: &[u8], at: usize, words: usize) -> bool {
    (0..words).all(|i| be16(rom, at + i * 2).is_some_and(|w| w & 0xF111 == 0))
}

/// Leitura do contador de uma entrada de paleta: palavras de cor.
type CountForm = fn(u16) -> usize;

/// Tabelas `{ptr.l, destino.w, contador.w}` (≥4 entradas) de paletas MD válidas.
pub fn locate_palette_tables(rom: &[u8]) -> Vec<PaletteTable> {
    let forms: [(&str, CountForm); 3] = [
        ("longs-1", |c| (usize::from(c) + 1) * 2),
        ("words-1", |c| usize::from(c) + 1),
        ("bytes", |c| usize::from(c) / 2),
    ];
    let mut out = Vec::new();
    let mut p = 0x200usize;
    while p + 8 <= rom.len() {
        let mut best: Option<(&str, Vec<PaletteEntry>)> = None;
        for (name, words) in forms {
            let mut entries = Vec::new();
            let mut q = p;
            while let (Some(ptr), Some(dest), Some(c)) =
                (be32(rom, q), be16(rom, q + 4), be16(rom, q + 6))
            {
                let n = words(c);
                if rom_ptr(rom, ptr).is_none()
                    || !(16..=64).contains(&n)
                    || !n.is_multiple_of(16)
                    || !color_ok(rom, ptr as usize, n)
                {
                    break;
                }
                entries.push(PaletteEntry {
                    ptr,
                    dest,
                    words: n as u32,
                });
                q += 8;
            }
            if entries.len() >= 4 && best.as_ref().is_none_or(|(_, b)| entries.len() > b.len()) {
                best = Some((name, entries));
            }
        }
        match best {
            Some((form, entries)) => {
                let n = entries.len();
                out.push(PaletteTable {
                    offset: p as u32,
                    count_form: form.into(),
                    entries,
                });
                p += n * 8;
            }
            None => p += 2,
        }
    }
    out
}

/// Paleta e linha por tile ligadas a um stream de arte.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArtPalette {
    pub stream: u32,
    /// Registro que provou a ligação (tabela, linha).
    pub record_table: u32,
    pub row: u32,
    pub palette_table: u32,
    pub palette_index: u32,
    /// 64 cores (4 linhas × 16); linha sem fonte provada fica `None`.
    pub lines: Vec<Option<Vec<u16>>>,
    /// Linha de paleta de cada tile (votos do mapa; sem voto = linha majoritária).
    pub tile_lines: Vec<u8>,
    pub voted_tiles: u32,
}

/// Arte carregada por uma linha de registro: lista de carga da etiqueta do campo de arte
/// (se contiver a arte do campo) ou só o stream do campo; `(stream, vram)`.
pub fn row_art(
    rom: &[u8],
    art: &[LocatedStream],
    offsets: &[OffsetTable],
    rec: &RecordTable,
    r: usize,
) -> Vec<(u32, u16)> {
    let Some(f) = rec.fields.iter().find(|f| f.kind == "nemesis") else {
        return Vec::new();
    };
    let own = f.values[r];
    let tag = usize::from(f.tags[r]);
    offsets
        .iter()
        .filter_map(|t| t.lists.get(tag))
        .filter_map(|l| counted_list(rom, *l as usize))
        .find(|entries| entries.iter().any(|(p, _)| *p == own))
        .unwrap_or_else(|| {
            art.iter()
                .find(|s| s.offset == own)
                .map(|s| vec![(s.offset, s.vram)])
                .unwrap_or_default()
        })
}

/// Liga arte a paleta por registros (ver doc do módulo).
pub fn link_art_palettes(
    rom: &[u8],
    art: &[LocatedStream],
    offsets: &[OffsetTable],
    records: &[RecordTable],
    palettes: &[PaletteTable],
) -> Vec<ArtPalette> {
    let by_offset: BTreeMap<u32, &LocatedStream> = art.iter().map(|s| (s.offset, s)).collect();
    let mut out: BTreeMap<u32, ArtPalette> = BTreeMap::new();
    for rec in records {
        let maps: Vec<&RecordField> = rec.fields.iter().filter(|f| f.kind == "enigma").collect();
        for pt in palettes {
            let n = pt.entries.len() as u32;
            // Índice: campo de byte que varia entre as linhas e sempre cabe na tabela.
            let Some(idx) = rec.fields.iter().find(|f| {
                f.kind == "byte"
                    && f.values.iter().all(|v| *v < n)
                    && f.values.iter().collect::<BTreeSet<_>>().len() > 1
            }) else {
                continue;
            };
            let base_dest = pt.entries.iter().map(|e| e.dest).min().unwrap_or(0);
            let line_of = |e: &PaletteEntry| usize::from(e.dest.wrapping_sub(base_dest)) / 32;
            for r in 0..rec.rows as usize {
                let entry = &pt.entries[idx.values[r] as usize];
                let mut lines: Vec<Option<Vec<u16>>> = vec![None; 4];
                let read = |e: &PaletteEntry, k: usize| -> Vec<u16> {
                    (0..16)
                        .map(|i| be16(rom, e.ptr as usize + (k * 16 + i) * 2).unwrap_or(0))
                        .collect()
                };
                for k in 0..(entry.words as usize / 16) {
                    if let Some(slot) = lines.get_mut(line_of(entry) + k) {
                        *slot = Some(read(entry, k));
                    }
                }
                // Linha faltante: só a entrada de 1 linha ÚNICA naquele destino a completa.
                for (l, slot) in lines.iter_mut().enumerate() {
                    if slot.is_some() {
                        continue;
                    }
                    let single: Vec<&PaletteEntry> = pt
                        .entries
                        .iter()
                        .filter(|e| e.words == 16 && line_of(e) == l)
                        .collect();
                    if let [e] = single[..] {
                        *slot = Some(read(e, 0));
                    }
                }
                let set = row_art(rom, art, offsets, rec, r);
                for (ptr, vram) in set {
                    let Some(st) = by_offset.get(&ptr) else {
                        continue;
                    };
                    if out.contains_key(&ptr) {
                        continue;
                    }
                    let first = u32::from(vram) / 32;
                    let mut votes = vec![[0u32; 4]; st.tiles as usize];
                    for m in &maps {
                        let Ok(d) =
                            rex_enigma::decode(&rom[m.values[r] as usize..], &Default::default())
                        else {
                            continue;
                        };
                        for w in d.words {
                            let t = u32::from(w & 0x7FF);
                            if t >= first && t < first + st.tiles {
                                votes[(t - first) as usize][usize::from((w >> 13) & 3)] += 1;
                            }
                        }
                    }
                    let voted = votes.iter().filter(|v| v.iter().any(|c| *c > 0)).count();
                    if voted == 0 {
                        continue;
                    }
                    let mut total = [0u32; 4];
                    for v in &votes {
                        for l in 0..4 {
                            total[l] += v[l];
                        }
                    }
                    let major = (0..4).max_by_key(|l| total[*l]).unwrap_or(0) as u8;
                    let tile_lines = votes
                        .iter()
                        .map(|v| {
                            if v.iter().all(|c| *c == 0) {
                                major
                            } else {
                                (0..4).max_by_key(|l| v[*l]).unwrap_or(0) as u8
                            }
                        })
                        .collect();
                    out.insert(
                        ptr,
                        ArtPalette {
                            stream: ptr,
                            record_table: rec.offset,
                            row: r as u32,
                            palette_table: pt.offset,
                            palette_index: idx.values[r],
                            lines: lines.clone(),
                            tile_lines,
                            voted_tiles: voted as u32,
                        },
                    );
                }
            }
        }
    }
    out.into_values().collect()
}

/// Codifica palavras em Enigma (variante plain, `value_offset = 0`): corridas
/// incrementais/comuns, corridas inline de passo 0/+1/-1 e literais; validado pelo decoder.
pub fn enigma_encode(words: &[u16]) -> Option<Vec<u8>> {
    let raw_max = words.iter().map(|w| w & 0x7FF).max().unwrap_or(0);
    let pl = (16 - raw_max.leading_zeros()).max(1) as u8;
    let mask = words.iter().fold(0u16, |m, w| m | (w >> 11)) as u8 & 0x1F;
    let mut freq: BTreeMap<u16, usize> = BTreeMap::new();
    for w in words {
        *freq.entry(*w).or_default() += 1;
    }
    let common = freq
        .iter()
        .max_by_key(|(w, n)| (**n, std::cmp::Reverse(**w)))
        .map_or(0, |(w, _)| *w);
    let mut incr = words.first().copied().unwrap_or(0);
    let mut out = vec![pl, mask];
    out.extend(incr.to_be_bytes());
    out.extend(common.to_be_bytes());
    let mut bits: Vec<u8> = Vec::new();
    let put = |bits: &mut Vec<u8>, v: u32, n: u32| {
        for k in (0..n).rev() {
            bits.push(((v >> k) & 1) as u8);
        }
    };
    let inline = |bits: &mut Vec<u8>, w: u16| {
        for j in (0..5u16).rev() {
            if (mask >> j) & 1 == 1 {
                bits.push(((w >> (j + 11)) & 1) as u8);
            }
        }
        for k in (0..pl).rev() {
            bits.push(((w >> k) & 1) as u8);
        }
    };
    let run_len = |i: usize, step: u16| {
        (1..16)
            .take_while(|j| {
                i + j < words.len()
                    && words[i + j] == words[i].wrapping_add(step.wrapping_mul(*j as u16))
            })
            .count()
            + 1
    };
    let mut i = 0;
    while i < words.len() {
        if words[i] == incr {
            let n = run_len(i, 1);
            put(&mut bits, (n - 1) as u32, 6);
            incr = incr.wrapping_add(n as u16);
            i += n;
            continue;
        }
        if words[i] == common {
            let n = (1..16)
                .take_while(|j| i + j < words.len() && words[i + j] == common)
                .count()
                + 1;
            put(&mut bits, 0x10 | (n - 1) as u32, 6);
            i += n;
            continue;
        }
        let (mode, n) = [(0u32, 0u16), (1, 1), (2, u16::MAX)]
            .iter()
            .map(|(m, st)| (*m, run_len(i, *st)))
            .max_by_key(|(_, n)| *n)
            .unwrap();
        if n >= 2 {
            put(&mut bits, 0x40 | (mode << 4) | (n - 1) as u32, 7);
            inline(&mut bits, words[i]);
            i += n;
            continue;
        }
        // Literais até o próximo início de corrida (máx. 15: cccc=15 é o terminador).
        let mut n = 1;
        while n < 15
            && i + n < words.len()
            && words[i + n] != incr
            && words[i + n] != common
            && [0u16, 1, u16::MAX].iter().all(|st| run_len(i + n, *st) < 2)
        {
            n += 1;
        }
        put(&mut bits, 0x70 | (n - 1) as u32, 7);
        for w in &words[i..i + n] {
            inline(&mut bits, *w);
        }
        i += n;
    }
    put(&mut bits, 0x7F, 7);
    for chunk in bits.chunks(8) {
        let mut b = 0u8;
        for (k, x) in chunk.iter().enumerate() {
            b |= x << (7 - k);
        }
        out.push(b);
    }
    if out.len() % 2 == 1 {
        out.push(0);
    }
    let back = rex_enigma::decode(&out, &Default::default()).ok()?;
    (back.words == words && back.stats.bytes_armazenados == out.len()).then_some(out)
}

/// Tudo o que este módulo prova numa ROM.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct MdTables {
    pub offset_tables: Vec<OffsetTable>,
    pub records: Vec<RecordTable>,
    pub palettes: Vec<PaletteTable>,
    pub art_palettes: Vec<ArtPalette>,
    /// Streams Enigma/Kosinski tipados pelos registros (únicos, por offset).
    pub enigma: Vec<CodecStream>,
    pub kosinski: Vec<CodecStream>,
}

pub fn recover(rom: &[u8], art: &[LocatedStream], offset_tables: Vec<OffsetTable>) -> MdTables {
    let records = locate_record_tables(rom, art);
    let palettes = locate_palette_tables(rom);
    let art_palettes = link_art_palettes(rom, art, &offset_tables, &records, &palettes);
    let mut streams: BTreeMap<(&str, u32), CodecStream> = BTreeMap::new();
    for f in records.iter().flat_map(|r| &r.fields) {
        if f.kind == "enigma" || f.kind == "kosinski" {
            for v in &f.values {
                if let Some(s) = decode_kind(rom, *v, &f.kind) {
                    streams.insert((if f.kind == "enigma" { "e" } else { "k" }, *v), s);
                }
            }
        }
    }
    let pick = |k: &str| {
        streams
            .iter()
            .filter(|((kk, _), _)| *kk == k)
            .map(|(_, s)| s.clone())
            .collect()
    };
    MdTables {
        enigma: pick("e"),
        kosinski: pick("k"),
        offset_tables,
        records,
        palettes,
        art_palettes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn put32(rom: &mut [u8], at: usize, v: u32) {
        rom[at..at + 4].copy_from_slice(&v.to_be_bytes());
    }
    fn put16(rom: &mut [u8], at: usize, v: u16) {
        rom[at..at + 2].copy_from_slice(&v.to_be_bytes());
    }

    #[test]
    fn palette_table_needs_valid_colors_for_every_entry() {
        let mut rom = vec![0u8; 0x1000];
        for k in 0..4 {
            put32(&mut rom, 0x300 + k * 8, 0x800 + k as u32 * 0x20);
            put16(&mut rom, 0x304 + k * 8, 0xFB00);
            put16(&mut rom, 0x306 + k * 8, 7); // longs-1 => 16 palavras
        }
        for i in 0..64 {
            put16(&mut rom, 0x800 + i * 2, 0x0E2A & 0x0EEE);
        }
        let t = locate_palette_tables(&rom);
        assert_eq!(t.len(), 1);
        assert_eq!((t[0].offset, t[0].entries.len()), (0x300, 4));
        assert_eq!(t[0].count_form, "longs-1");
        // Uma cor inválida (bit 0 ligado) na 3ª paleta encurta a tabela para < 4: recusada.
        put16(&mut rom, 0x840, 0x0001);
        assert!(locate_palette_tables(&rom)
            .iter()
            .all(|t| t.offset != 0x300));
    }

    #[test]
    fn offset_table_needs_two_anchored_counted_lists() {
        let mut rom = vec![0u8; 0x1000];
        // base 0x400: três deslocamentos para listas em 0x410, 0x420, 0x430.
        for (k, t) in [0x410usize, 0x420, 0x430].iter().enumerate() {
            put16(&mut rom, 0x400 + k * 2, (t - 0x400) as u16);
            put16(&mut rom, *t, 0); // 1 entrada
            put32(&mut rom, t + 2, 0x800);
            put16(&mut rom, t + 6, 0x0020);
        }
        let one: BTreeSet<u32> = [0x412].into();
        assert!(
            locate_offset_tables(&rom, &one).is_empty(),
            "1 âncora não basta"
        );
        let two: BTreeSet<u32> = [0x412, 0x422].into();
        let t = locate_offset_tables(&rom, &two);
        assert_eq!(t[0].base, 0x400);
        assert_eq!(t[0].lists, vec![0x410, 0x420, 0x430]);
    }

    #[test]
    #[ignore = "BYOR: RDS_REX_ROM"]
    fn md_tables_on_rom() {
        let rom = std::fs::read(std::env::var("RDS_REX_ROM").unwrap()).unwrap();
        let (art, offs) = locate_art_streams(&rom);
        let t = recover(&rom, &art, offs);
        println!(
            "art={} offset_tables={} records={} palettes={} art_palettes={} enigma={} kosinski={}",
            art.len(),
            t.offset_tables.len(),
            t.records.len(),
            t.palettes.len(),
            t.art_palettes.len(),
            t.enigma.len(),
            t.kosinski.len()
        );
        for r in &t.records {
            let kinds: Vec<String> = r
                .fields
                .iter()
                .map(|f| format!("{}@{}", f.kind, f.at))
                .collect();
            println!(
                "record {:06x} stride={} rows={} {kinds:?}",
                r.offset, r.stride, r.rows
            );
        }
        for c in &t.enigma {
            let w = rex_enigma::decode(&rom[c.offset as usize..], &Default::default())
                .unwrap()
                .words;
            let e = enigma_encode(&w).map_or(0, |e| e.len());
            println!("enigma {:06x} original={} nosso={e}", c.offset, c.len);
        }
        for c in &t.kosinski {
            let p = ::rex_kosinski::decode(&rom[c.offset as usize..], 0x10000, 4_000_000)
                .unwrap()
                .output;
            let e = ::rex_kosinski::encode_optimal(&p, 0x20000, 256_000_000)
                .map_or(0, |e| e.stream.len());
            println!("kosinski {:06x} original={} nosso={e}", c.offset, c.len);
        }
        for p in &t.palettes {
            println!(
                "palettes {:06x} {} entries={}",
                p.offset,
                p.count_form,
                p.entries.len()
            );
        }
        for a in &t.art_palettes {
            let have: Vec<bool> = a.lines.iter().map(|l| l.is_some()).collect();
            println!(
                "art {:06x} pal#{} lines={have:?} voted={}/{}",
                a.stream,
                a.palette_index,
                a.voted_tiles,
                a.tile_lines.len()
            );
        }
    }

    #[test]
    fn enigma_encoder_roundtrips_through_the_decoder() {
        let mut seed = 99u32;
        let mut rnd = || {
            seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12345);
            (seed >> 16) as u16
        };
        let mut words: Vec<u16> = (0..40).map(|i| 0x2000 + i).collect();
        words.extend(std::iter::repeat_n(0x0000, 30));
        words.extend((0..50).map(|_| rnd() & 0xF8FF));
        words.extend((0..20).map(|i| 0x4100u16.wrapping_sub(i)));
        let enc = enigma_encode(&words).expect("codifica");
        assert_eq!(
            rex_enigma::decode(&enc, &Default::default()).unwrap().words,
            words
        );
        assert!(enigma_encode(&[]).is_some());
    }

    #[test]
    #[ignore = "BYOR: RDS_REX_CORPUS_DIR"]
    fn md_tables_across_corpus() {
        let dir = std::env::var("RDS_REX_CORPUS_DIR").expect("RDS_REX_CORPUS_DIR ausente");
        let mut names: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .collect();
        names.sort();
        for path in names
            .iter()
            .filter(|p| p.extension().is_some_and(|e| e == "bin"))
        {
            let rom = std::fs::read(path).unwrap();
            let (art, offs) = locate_art_streams(&rom);
            let t = recover(&rom, &art, offs);
            println!(
                "md\t{}\tart={}\toffset_tables={}\trecords={}\tpalette_tables={}\tlinks={}\tenigma={}\tkosinski={}",
                path.file_name().unwrap().to_string_lossy(),
                art.len(),
                t.offset_tables.len(),
                t.records.len(),
                t.palettes.len(),
                t.art_palettes.len(),
                t.enigma.len(),
                t.kosinski.len()
            );
        }
    }
}
