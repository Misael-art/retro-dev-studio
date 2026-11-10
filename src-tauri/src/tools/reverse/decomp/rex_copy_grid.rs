//! Bounded M68000 nested copy operation. No title, hash dispatch, runtime interpreter,
//! source-byte implementation or publisher. File offsets and CPU WRAM addresses differ.
use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CopyGrid {
    pub entry: u32,
    pub source: u32,
    pub destination: u32,
    pub source_register: u16,
    pub destination_register: u16,
    pub row_register: u16,
    pub column_register: u16,
    pub rows: u32,
    pub columns: u32,
    pub width: u32,
    pub gap: u32,
    pub linear: Option<LinearCopy>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AddressInit {
    AbsoluteLong(u32),
    AbsoluteWord(i16),
    PcRelativeWord(i16),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CopyInit {
    Pointer {
        register: u16,
        address: AddressInit,
    },
    Count {
        register: u16,
        word: bool,
        value: u16,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinearCopy {
    pub initializers: Vec<CopyInit>,
    pub source_raw: u32,
    pub destination_raw: u32,
    pub transfer_offset: usize,
    pub rom_size: u32,
}

fn require(ok: bool, why: &str) -> Result<(), String> {
    if ok {
        Ok(())
    } else {
        Err(why.to_string())
    }
}

impl CopyGrid {
    pub fn transfer_offset(&self) -> usize {
        self.linear.as_ref().map_or(16, |l| l.transfer_offset)
    }
    pub fn length(&self) -> usize {
        self.linear.as_ref().map_or(30, |l| l.transfer_offset + 6)
    }
    pub fn widths(&self) -> Vec<u32> {
        let choices: &[u32] = if self.linear.is_some() {
            &[1, 2, 4]
        } else {
            &[1, 2]
        };
        choices
            .iter()
            .copied()
            .filter(|width| {
                let mut candidate = self.clone();
                candidate.width = *width;
                candidate.validate().is_ok()
            })
            .collect()
    }
    pub fn stride(&self) -> u32 {
        self.columns * self.width + self.gap
    }
    pub fn copied(&self) -> u32 {
        self.rows * self.columns * self.width
    }
    pub fn span(&self) -> u32 {
        (self.rows - 1) * self.stride() + self.columns * self.width
    }

    pub fn validate(&self) -> Result<(), String> {
        if let Some(linear) = &self.linear {
            require(
                self.rows == 1 && self.gap == 0,
                "single loop has no rows/gap",
            )?;
            require(
                [1, 2, 4].contains(&self.width),
                "only byte/word/long transfer",
            )?;
            require((1..=32768).contains(&self.columns), "bounded DBRA count")?;
            require(
                self.source_register < 7
                    && self.destination_register < 7
                    && self.source_register != self.destination_register
                    && self.column_register < 8,
                "pointer/counter alias or A7 unsupported",
            )?;
            let size = self
                .columns
                .checked_mul(self.width)
                .ok_or("copy size overflow")?;
            let src_end = self.source.checked_add(size).ok_or("source overflow")?;
            let dst_end = self
                .destination
                .checked_add(size)
                .ok_or("destination overflow")?;
            let source_rom =
                self.source < linear.rom_size && src_end <= linear.rom_size.min(0x400000);
            require(
                (source_rom || (self.source >= 0xff0000 && src_end <= 0x1000000))
                    && self.destination >= 0xff0000
                    && dst_end <= 0x1000000,
                "copy outside linear ROM/canonical WRAM domain",
            )?;
            require(
                src_end <= self.destination || dst_end <= self.source,
                "overlapping copy unsupported",
            )?;
            require(
                self.width == 1 || (self.source | self.destination) & 1 == 0,
                "word/long pointers must be even",
            )?;
            require(
                linear.source_raw & 0xffffff == self.source
                    && linear.destination_raw & 0xffffff == self.destination,
                "raw32/bus24 pointers disconnected",
            )?;
            return Ok(());
        }
        require(
            (1..=128).contains(&self.rows) && (1..=128).contains(&self.columns),
            "MOVEQ/DBRA counts outside 0..127; DBRA iterates count+1",
        )?;
        require(
            (1..=2).contains(&self.width),
            "only byte/word transfer proven",
        )?;
        require(
            self.gap <= i16::MAX as u32,
            "signed LEA gap outside nonnegative i16",
        )?;
        require(
            self.source_register < 7
                && self.destination_register < 7
                && self.source_register != self.destination_register,
            "pointer alias or A7 postincrement unsupported",
        )?;
        require(
            self.row_register < 8
                && self.column_register < 8
                && self.row_register != self.column_register,
            "DBRA counter alias unsupported",
        )?;
        let row = self
            .columns
            .checked_mul(self.width)
            .ok_or("row size overflow")?;
        let stride = row.checked_add(self.gap).ok_or("stride overflow")?;
        let copied = row.checked_mul(self.rows).ok_or("copy size overflow")?;
        let advance = stride
            .checked_mul(self.rows)
            .ok_or("destination advance overflow")?;
        let span = advance.checked_sub(self.gap).ok_or("span underflow")?;
        let src_end = self
            .source
            .checked_add(copied)
            .ok_or("source address overflow")?;
        let dst_end = self
            .destination
            .checked_add(span)
            .ok_or("destination address overflow")?;
        let dst_final = self
            .destination
            .checked_add(advance)
            .ok_or("final pointer overflow")?;
        require(
            self.source >= 0xFF0000
                && src_end <= 0x1000000
                && self.destination >= 0xFF0000
                && dst_end <= 0x1000000
                && dst_final <= 0x1000000,
            "address/span/final pointer outside canonical CPU24 WRAM map",
        )?;
        require(
            src_end <= self.destination || dst_end <= self.source,
            "source/destination envelopes overlap; memmove unsupported",
        )?;
        require(
            self.width == 1 || (self.source | self.destination | stride) & 1 == 0,
            "word source/destination/stride must be even",
        )
    }

    /// Re-encode fields; provenance bytes are deliberately absent from this representation.
    pub fn encode(&self) -> Result<Vec<u8>, String> {
        self.validate()?;
        if let Some(linear) = &self.linear {
            let mut b = Vec::new();
            for init in &linear.initializers {
                if let CopyInit::Pointer { register, address } = init {
                    let raw = match address {
                        AddressInit::AbsoluteLong(v) => *v,
                        AddressInit::AbsoluteWord(v) => *v as i32 as u32,
                        AddressInit::PcRelativeWord(v) => {
                            (i64::from(self.entry) + b.len() as i64 + 2 + i64::from(*v)) as u32
                        }
                    };
                    require(
                        (*register == self.source_register && raw == linear.source_raw)
                            || (*register == self.destination_register
                                && raw == linear.destination_raw),
                        "pointer initializer disconnected",
                    )?;
                }
                let words = match init {
                    CopyInit::Pointer {
                        register,
                        address: AddressInit::AbsoluteLong(raw),
                    } => vec![0x41f9 | register << 9, (raw >> 16) as u16, *raw as u16],
                    CopyInit::Pointer {
                        register,
                        address: AddressInit::AbsoluteWord(raw),
                    } => vec![0x41f8 | register << 9, *raw as u16],
                    CopyInit::Pointer {
                        register,
                        address: AddressInit::PcRelativeWord(disp),
                    } => vec![0x41fa | register << 9, *disp as u16],
                    CopyInit::Count {
                        register,
                        word,
                        value,
                    } => {
                        require(
                            *register == self.column_register
                                && u32::from(*value) + 1 == self.columns,
                            "counter initialization disconnected",
                        )?;
                        require(*word || *value < 128, "MOVEQ sign/count outside domain")?;
                        if *word {
                            vec![0x303c | register << 9, *value]
                        } else {
                            vec![0x7000 | register << 9 | value]
                        }
                    }
                };
                for w in words {
                    b.extend_from_slice(&w.to_be_bytes());
                }
            }
            require(
                b.len() == linear.transfer_offset,
                "initializer extent disconnected",
            )?;
            for w in [
                self.transfer_opcode(),
                0x51c8 | self.column_register,
                (-4i16) as u16,
            ] {
                b.extend_from_slice(&w.to_be_bytes());
            }
            return Ok(b);
        }
        let mut b = Vec::with_capacity(30);
        let mut word = |w: u16| b.extend_from_slice(&w.to_be_bytes());
        word(0x41F9 | self.destination_register << 9);
        word((self.destination >> 16) as u16);
        word(self.destination as u16);
        word(0x41F9 | self.source_register << 9);
        word((self.source >> 16) as u16);
        word(self.source as u16);
        word(0x7000 | self.row_register << 9 | (self.rows - 1) as u16);
        word(0x7000 | self.column_register << 9 | (self.columns - 1) as u16);
        word(
            (if self.width == 1 { 0x1000 } else { 0x3000 })
                | self.destination_register << 9
                | 0xD8
                | self.source_register,
        );
        word(0x51C8 | self.column_register);
        word((-4i16) as u16);
        word(0x41E8 | self.destination_register << 9 | self.destination_register);
        word(self.gap as u16);
        word(0x51C8 | self.row_register);
        word((-14i16) as u16);
        Ok(b)
    }

    pub fn graph(&self) -> Value {
        if let Some(linear) = &self.linear {
            let widths = self.widths();
            let counter = linear
                .initializers
                .iter()
                .find_map(|i| match i {
                    CopyInit::Count { word, .. } => Some(*word),
                    _ => None,
                })
                .unwrap_or(false);
            let mappings = json!([{"rom_start":format!("0x{:06X}",self.entry),"rom_end":format!("0x{:06X}",self.entry+self.length() as u32)}]);
            return json!({"nodes":[
                {"id":"entry","type":"rom_region_entry","label":"Entrada declarada","x":0,"y":0,"params":{"address":format!("0x{:06X}",self.entry),"semantic_origin":"recovered_from_rom","source_mappings":[]}},
                {"id":"copy_grid","type":"rom_copy_grid","label":"Cópia contígua (Experimental)","x":300,"y":0,"params":{
                    "semantic_origin":"recovered_from_rom","source_mappings":mappings,
                    "source_address":format!("0x{:06X}",self.source),"destination_address":format!("0x{:06X}",self.destination),
                    "source_register":format!("A{}",self.source_register),"destination_register":format!("A{}",self.destination_register),
                    "address_space":"CPU bus24; origem ROM linear ou WRAM; destino WRAM; registradores32 separados",
                    "source_register_initial32":format!("0x{:08X}",linear.source_raw),"destination_register_initial32":format!("0x{:08X}",linear.destination_raw),
                    "rows":1,"columns":self.columns,"bytes_per_cell":self.width,"allowed_widths":widths.iter().map(u32::to_string).collect::<Vec<_>>().join(","),
                    "row_counter":"nenhum; cópia contígua sem loop externo",
                    "column_counter":format!("D{}={} → DBRA low16 → FFFF; {}",self.column_register,self.columns-1,if counter { "MOVE.W preserva high16" } else { "MOVEQ zera high16" }),
                    "initialization":format!("{:?}",linear.initializers),
                    "source_increment_bytes":self.width,"destination_increment_bytes":self.width,"source_row_stride_bytes":self.copied(),
                    "row_gap_bytes":0,"row_stride_bytes":self.stride(),"copied_bytes":self.copied(),"output_span_bytes":self.span(),
                    "condition":"DBRA decrementa low16; repete MOVE até FFFF; LEA não muda CCR",
                    "state":"MOVE define N/Z pelo último valor, limpa V/C, preserva X; demais D/A e SP preservados neste trecho",
                    "unknown":"caller, estado inicial, significado do dado, consumidores, IRQ, ciclos e stack interior não recuperados; saída é fallthrough",
                    "lowering":"Somente larguras declaradas em allowed_widths; reconstrução tipada de LEA/MOVEQ ou MOVE.W/MOVE/DBRA; topologia não compilável"
                }},
                {"id":"exit","type":"rom_region_exit","label":"Saída declarada","x":700,"y":0,"params":{"address":format!("0x{:06X}",self.entry+self.length() as u32),"semantic_origin":"recovered_from_rom","source_mappings":[]}}
            ],"edges":[{"id":"e0","fromNode":"entry","fromPort":"exec","toNode":"copy_grid","toPort":"exec"},{"id":"e1","fromNode":"copy_grid","fromPort":"exec","toNode":"exit","toPort":"exec"}]});
        }
        let sites = [
            (0, 6),
            (6, 6),
            (12, 2),
            (14, 2),
            (16, 2),
            (18, 4),
            (22, 4),
            (26, 4),
        ];
        let mappings: Vec<_> = sites.iter().map(|(at,len)| json!({"rom_start": format!("0x{:06X}", self.entry+at), "rom_end": format!("0x{:06X}", self.entry+at+len)})).collect();
        json!({"nodes": [
            {"id":"entry", "type":"rom_region_entry", "label":"Entrada declarada", "x":0,"y":0,"params":{"address":format!("0x{:06X}",self.entry),"semantic_origin":"recovered_from_rom","source_mappings":[]}},
            {"id":"copy_grid", "type":"rom_copy_grid", "label":"Cópia de grade (Experimental)","x":300,"y":0,"params":{
                "semantic_origin":"recovered_from_rom", "source_mappings":mappings,
                "source_address":format!("0x{:06X}",self.source), "destination_address":format!("0x{:06X}",self.destination),
                "address_space":"CPU24 WRAM [FF0000,1000000); origem binária = offset de arquivo",
                "source_register":format!("A{}",self.source_register), "destination_register":format!("A{}",self.destination_register),
                "row_counter":format!("D{}={} → DBRA low16 → FFFF",self.row_register,self.rows-1),
                "column_counter":format!("D{}={} → DBRA low16 → FFFF",self.column_register,self.columns-1),
                "rows":self.rows,"columns":self.columns,"bytes_per_cell":self.width,
                "source_increment_bytes":self.width,"destination_increment_bytes":self.width,
                "source_row_stride_bytes":self.columns*self.width,"row_gap_bytes":self.gap,"row_stride_bytes":self.stride(),
                "copied_bytes":self.copied(),"output_span_bytes":self.span(),
                "unknown":"caller/estado inicial não recuperados; recurso/consumidor gráfico desconhecidos; flags/registradores/stack não comparados",
                "lowering":"Somente bytes_per_cell 1↔2; parâmetros derivados descrevem a ROM base. Revalidar mapa/alinhamento/sobreposição na publicação; topologia não compilável."
            }},
            {"id":"exit", "type":"rom_region_exit", "label":"Saída declarada", "x":700,"y":0,"params":{"address":format!("0x{:06X}",self.entry+30),"semantic_origin":"recovered_from_rom","source_mappings":[]}}
        ],"edges":[
            {"id":"e0","fromNode":"entry","fromPort":"exec","toNode":"copy_grid","toPort":"exec"},
            {"id":"e1","fromNode":"copy_grid","fromPort":"exec","toNode":"exit","toPort":"exec"}
        ]})
    }

    fn transfer_opcode(&self) -> u16 {
        (match self.width {
            1 => 0x1000,
            2 => 0x3000,
            4 => 0x2000,
            _ => 0,
        }) | self.destination_register << 9
            | 0xd8
            | self.source_register
    }
}

pub fn recover(rom: &[u8], entry: u32, exits: &[u32]) -> Result<CopyGrid, String> {
    if exits.len() == 1 && entry.checked_add(30) != Some(exits[0]) {
        return recover_linear(rom, entry, exits[0]);
    }
    let end = entry.checked_add(30).ok_or("region offset overflow")?;
    require(
        entry.is_multiple_of(2) && end <= 0x400000 && exits == [end],
        "requires complete declared 30-byte region in linear ROM [0,400000)",
    )?;
    let b = rom
        .get(entry as usize..end as usize)
        .ok_or("truncated declared copy region")?;
    let w = |at| u16::from_be_bytes([b[at], b[at + 1]]);
    let abs = |at| u32::from_be_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]]);
    require(
        w(0) & 0xF1FF == 0x41F9 && w(6) & 0xF1FF == 0x41F9,
        "expected destination/source absolute LEA",
    )?;
    require(
        w(12) & 0xF100 == 0x7000 && w(14) & 0xF100 == 0x7000,
        "expected MOVEQ row/column counters",
    )?;
    let rows = (w(12) as u8 as i8) as i32;
    let columns = (w(14) as u8 as i8) as i32;
    require(
        rows >= 0 && columns >= 0,
        "negative sign-extended MOVEQ DBRA counter unsupported",
    )?;
    let copy = w(16);
    require(
        copy & 0xF1F8 == 0x10D8 || copy & 0xF1F8 == 0x30D8,
        "expected MOVE.B/W (An)+,(An)+",
    )?;
    require(
        w(18) & 0xFFF8 == 0x51C8 && w(26) & 0xFFF8 == 0x51C8 && w(22) & 0xF1F8 == 0x41E8,
        "unsupported nested loop control",
    )?;
    // DBRA base is instruction PC+2, with signed 16-bit displacement (not PC+4).
    require(
        20i32 + i32::from(w(20) as i16) == 16 && 28i32 + i32::from(w(28) as i16) == 14,
        "DBRA target outside supported transfer/counter initialization",
    )?;
    let destination_register = (copy >> 9) & 7;
    let source_register = copy & 7;
    require(
        (w(0) >> 9) & 7 == destination_register && (w(6) >> 9) & 7 == source_register,
        "disconnected pointer initialization",
    )?;
    require(
        w(18) & 7 == (w(14) >> 9) & 7 && w(26) & 7 == (w(12) >> 9) & 7,
        "disconnected DBRA counters",
    )?;
    require(
        w(22) & 7 == destination_register && (w(22) >> 9) & 7 == destination_register,
        "disconnected row advance",
    )?;
    require(
        (w(24) as i16) >= 0,
        "negative signed LEA row gap unsupported",
    )?;
    let grid = CopyGrid {
        entry,
        source: abs(8),
        destination: abs(2),
        source_register,
        destination_register,
        row_register: (w(12) >> 9) & 7,
        column_register: (w(14) >> 9) & 7,
        rows: rows as u32 + 1,
        columns: columns as u32 + 1,
        width: if copy >> 12 == 1 { 1 } else { 2 },
        gap: u32::from(w(24)),
        linear: None,
    };
    grid.validate()?;
    let alternative = CopyGrid {
        width: 3 - grid.width,
        ..grid.clone()
    };
    alternative
        .validate()
        .map_err(|e| format!("alternative edit width invalid: {e}"))?;
    require(
        grid.encode()? == b,
        "typed reconstruction diverges from declared bytes",
    )?;
    Ok(grid)
}

fn recover_linear(rom: &[u8], entry: u32, end: u32) -> Result<CopyGrid, String> {
    require(
        entry.is_multiple_of(2)
            && end <= 0x400000
            && end > entry
            && (16..=22).contains(&(end - entry)),
        "complete bounded linear copy region required",
    )?;
    let b = rom
        .get(entry as usize..end as usize)
        .ok_or("truncated linear copy")?;
    let w = |at: usize| -> Result<u16, String> {
        let raw = b.get(at..at + 2).ok_or("truncated instruction")?;
        Ok(u16::from_be_bytes([raw[0], raw[1]]))
    };
    let mut at = 0;
    let mut initializers = Vec::new();
    let mut pointers = Vec::new();
    let mut counter = None;
    for _ in 0..3 {
        let op = w(at)?;
        let register = (op >> 9) & 7;
        if [0x41f9, 0x41f8, 0x41fa].contains(&(op & 0xf1ff)) {
            let (address, raw, size) = match op & 0xf1ff {
                0x41f9 => {
                    let raw = (u32::from(w(at + 2)?) << 16) | u32::from(w(at + 4)?);
                    (AddressInit::AbsoluteLong(raw), raw, 6)
                }
                0x41f8 => {
                    let v = w(at + 2)? as i16;
                    (AddressInit::AbsoluteWord(v), v as i32 as u32, 4)
                }
                _ => {
                    let v = w(at + 2)? as i16;
                    let raw = (entry as i64 + at as i64 + 2 + i64::from(v)) as u32;
                    (AddressInit::PcRelativeWord(v), raw, 4)
                }
            };
            require(
                !pointers.iter().any(|(r, _)| *r == register),
                "repeated pointer initialization",
            )?;
            pointers.push((register, raw));
            initializers.push(CopyInit::Pointer { register, address });
            at += size;
        } else {
            require(counter.is_none(), "repeated/unknown count initialization")?;
            let (word, value, size) = if op & 0xf100 == 0x7000 {
                require(op & 255 < 128, "negative MOVEQ count unsupported")?;
                (false, op & 255, 2)
            } else {
                require(op & 0xf1ff == 0x303c, "unknown operation; not a no-op")?;
                let value = w(at + 2)?;
                require(value < 32768, "word counter outside bounded domain")?;
                (true, value, 4)
            };
            counter = Some((register, value));
            initializers.push(CopyInit::Count {
                register,
                word,
                value,
            });
            at += size;
        }
    }
    require(
        at + 6 == b.len() && pointers.len() == 2,
        "initializer/region extent",
    )?;
    let op = w(at)?;
    require(
        [0x10d8, 0x20d8, 0x30d8].contains(&(op & 0xf1f8)),
        "expected MOVE.B/W/L postincrement",
    )?;
    let sr = op & 7;
    let dr = (op >> 9) & 7;
    let source_raw = pointers
        .iter()
        .find(|(r, _)| *r == sr)
        .ok_or("source not initialized")?
        .1;
    let destination_raw = pointers
        .iter()
        .find(|(r, _)| *r == dr)
        .ok_or("destination not initialized")?
        .1;
    let (cr, value) = counter.ok_or("counter not initialized")?;
    require(
        w(at + 2)? == 0x51c8 | cr && w(at + 4)? == (-4i16) as u16,
        "unsupported DBRA counter/target",
    )?;
    let grid = CopyGrid {
        entry,
        source: source_raw & 0xffffff,
        destination: destination_raw & 0xffffff,
        source_register: sr,
        destination_register: dr,
        row_register: cr,
        column_register: cr,
        rows: 1,
        columns: u32::from(value) + 1,
        width: match op >> 12 {
            1 => 1,
            3 => 2,
            _ => 4,
        },
        gap: 0,
        linear: Some(LinearCopy {
            initializers,
            source_raw,
            destination_raw,
            transfer_offset: at,
            rom_size: rom.len().min(0x400000) as u32,
        }),
    };
    grid.validate()?;
    require(
        grid.widths().len() >= 2,
        "no alternative width in memory domain",
    )?;
    require(grid.encode()? == b, "typed linear reconstruction diverges")?;
    Ok(grid)
}

#[cfg(test)]
mod tests {
    use super::*;
    pub fn fixture() -> Vec<u8> {
        let hex: String = include_str!("../../../../tests/fixtures/rex_copy_grid/copy.hex")
            .split_whitespace()
            .collect();
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }
    #[test]
    fn copy_grid_linear_forms_reconstruct_and_refuse_unknown_flow() {
        // Author literals, not copied commercial bytes. Three initialization orders,
        // absolute32, signed absolute16, PC-relative16, MOVEQ and MOVE.W counts.
        for (hex, source, destination, count, width) in [
            (
                "41f90000050043f8f400700322d851c8fffc",
                0x500,
                0xfff400,
                4,
                4,
            ),
            (
                "700343f9ffff820041fa00fa32d851c8fffc",
                0x504,
                0xff8200,
                4,
                2,
            ),
            (
                "45f8f600303c008041f90000060014d851c8fffc",
                0x600,
                0xfff600,
                129,
                1,
            ),
        ] {
            let body: Vec<u8> = (0..hex.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
                .collect();
            let mut rom = vec![0; 0x1000];
            rom[0x400..0x400 + body.len()].copy_from_slice(&body);
            let end = 0x400 + body.len() as u32;
            let grid = recover(&rom, 0x400, &[end]).unwrap();
            assert_eq!(
                (grid.source, grid.destination, grid.columns, grid.width),
                (source, destination, count, width)
            );
            assert_eq!(grid.encode().unwrap(), body);
            assert_eq!(grid.widths(), [1, 2, 4]);
            for width in [1, 2, 4] {
                let mut edited = grid.clone();
                edited.width = width;
                let encoded = edited.encode().unwrap();
                assert_eq!(encoded.len(), body.len());
                assert!(encoded
                    .iter()
                    .zip(&body)
                    .enumerate()
                    .all(|(i, (a, b))| a == b || i == grid.transfer_offset()));
                let mut copy = rom.clone();
                copy[0x400..end as usize].copy_from_slice(&encoded);
                assert_eq!(recover(&copy, 0x400, &[end]).unwrap(), edited);
            }
            let mut bad = grid.clone();
            bad.width = 3;
            assert!(bad.encode().is_err());
            let mut bad = grid.clone();
            bad.source += 2;
            assert!(bad.encode().is_err());
            for offset in [
                grid.transfer_offset(),
                grid.transfer_offset() + 2,
                grid.transfer_offset() + 4,
            ] {
                let mut bad = rom.clone();
                bad[0x400 + offset] ^= 0x80;
                assert!(recover(&bad, 0x400, &[end]).is_err());
            }
            // A legal but different MOVE is recovered as a different operator, not hidden.
            let mut bad = rom.clone();
            bad[0x400 + grid.transfer_offset()] ^= 0x20;
            if let Ok(other) = recover(&bad, 0x400, &[end]) {
                assert_ne!(other, grid);
            }
        }
    }
    #[test]
    fn copy_grid_typed_reconstruction_and_transfer_domain() {
        let rom = fixture();
        let grid = recover(&rom, 0x400, &[0x41E]).unwrap();
        assert_eq!(
            (
                grid.rows,
                grid.columns,
                grid.width,
                grid.stride(),
                grid.copied(),
                grid.span()
            ),
            (4, 8, 1, 24, 32, 80)
        );
        assert_eq!(grid.encode().unwrap(), rom[0x400..0x41E]);
        let mut word = grid.clone();
        word.width = 2;
        assert_eq!((word.stride(), word.copied(), word.span()), (32, 64, 112));
        let mut other = rom.clone();
        other[0x400..0x41E].copy_from_slice(&word.encode().unwrap());
        assert_eq!(
            (0..rom.len())
                .filter(|i| rom[*i] != other[*i])
                .collect::<Vec<_>>(),
            [0x410]
        );
        assert_eq!(recover(&other, 0x400, &[0x41E]).unwrap(), word);
        // Different registers, counters, pointers and gap; no implementation changes.
        let mut transfer = grid.clone();
        transfer.source_register = 5;
        transfer.destination_register = 6;
        transfer.row_register = 0;
        transfer.column_register = 7;
        transfer.rows = 1;
        transfer.columns = 128;
        transfer.source = 0xFF8000;
        transfer.destination = 0xFF1000;
        transfer.gap = 20;
        other[0x400..0x41E].copy_from_slice(&transfer.encode().unwrap());
        assert_eq!(recover(&other, 0x400, &[0x41E]).unwrap(), transfer);
        assert_eq!(
            grid.graph()["nodes"][1]["params"]["source_mappings"]
                .as_array()
                .unwrap()
                .len(),
            8
        );
    }
    #[test]
    fn copy_grid_discriminating_decoder_refusals() {
        let base = fixture();
        let cases = [
            ("inner target", 0x414, 0x7FFF),
            ("outer target", 0x41C, 0x7FFF),
            ("negative rows", 0x40C, 0x7280),
            ("counter alias", 0x40E, 0x7207),
            ("counter disconnect", 0x412, 0x51CD),
            ("pointer disconnect", 0x406, 0x49F9),
            ("A7", 0x410, 0x14DF),
            ("row advance disconnect", 0x416, 0x45EB),
            ("negative gap", 0x418, 0xFFFF),
            ("stride exceeds WRAM", 0x418, 0x7FFF),
            ("outside map", 0x408, 0x00FE),
            ("overlap", 0x40A, 0x7000),
            ("unaligned source", 0x40A, 0x5001),
            ("long width", 0x410, 0x24DB),
        ];
        for (name, at, w) in cases {
            let mut rom = base.clone();
            rom[at..at + 2].copy_from_slice(&(w as u16).to_be_bytes());
            assert!(recover(&rom, 0x400, &[0x41E]).is_err(), "{name}");
        }
        assert!(recover(&base[..0x41D], 0x400, &[0x41E]).is_err());
        assert!(recover(&base, 0x400, &[0x41C]).is_err());
        assert!(recover(&base, u32::MAX - 1, &[0]).is_err());
        let grid = recover(&base, 0x400, &[0x41E]).unwrap();
        for width in [0, 3, 4, u32::MAX] {
            let mut g = grid.clone();
            g.width = width;
            assert!(g.encode().is_err());
        }
        let mut alias = grid.clone();
        alias.column_register = alias.row_register;
        assert!(alias.encode().unwrap_err().contains("counter alias"));
        let mut alias = grid.clone();
        alias.source_register = alias.destination_register;
        assert!(alias.encode().unwrap_err().contains("pointer alias"));
        let mut sp = grid.clone();
        sp.source_register = 7;
        assert!(sp.encode().unwrap_err().contains("A7"));
        let mut huge = grid.clone();
        huge.gap = u32::MAX;
        assert!(huge.encode().is_err());
        let mut wrapped = grid;
        wrapped.source = u32::MAX - 4;
        assert!(wrapped.encode().is_err());
    }
}
