#!/usr/bin/env python3
"""B5: roda 11 mutantes sobre enigma-rs/src/lib.rs e exige que a suite os mate. Restaura o arquivo."""
import pathlib, shutil, subprocess, sys
crate = pathlib.Path(__file__).resolve().parent / "enigma-rs"
lib = crate / "src/lib.rs"
bak = lib.with_suffix(".rs.bak")
shutil.copy(lib, bak)
src = lib.read_text()
M = [
 ("common sem base", "let common = u16::from_be_bytes([stream[4], stream[5]]).wrapping_add(base);", "let common = u16::from_be_bytes([stream[4], stream[5]]);"),
 ("incr sem base", "let mut incr = u16::from_be_bytes([stream[2], stream[3]]).wrapping_add(base);", "let mut incr = u16::from_be_bytes([stream[2], stream[3]]);"),
 ("limite >=", "if (words.len() + 1) * 2 > max_output_bytes", "if (words.len() + 1) * 2 >= max_output_bytes"),
 ("limite sem +1", "if (words.len() + 1) * 2 > max_output_bytes", "if words.len() * 2 > max_output_bytes"),
 ("P como soma", "4 => d3 | 0x8000,", "4 => d3.wrapping_add(0x8000),"),
 ("C1 como OR", "3 => d3.wrapping_add(0x4000),", "3 => d3 | 0x4000,"),
 ("C0 como OR", "2 => d3.wrapping_add(0x2000),", "2 => d3 | 0x2000,"),
 ("V como soma", "1 => d3 | 0x1000,", "1 => d3.wrapping_add(0x1000),"),
 ("H como soma", "_ => d3 | 0x0800,", "_ => d3.wrapping_add(0x0800),"),
 ("ordem das flags", "for j in (0..5u8).rev() {", "for j in 0..5u8 {"),
 ("inline sem base", "let mut d3 = value_offset;", "let mut d3 = 0u16;"),
]
vivos = []
try:
    for nome, a, b in M:
        if a not in src:
            sys.exit(f"mutante {nome}: trecho nao encontrado (lib.rs mudou)")
        lib.write_text(src.replace(a, b, 1))
        r = subprocess.run(["cargo", "test", "--offline"], cwd=crate, capture_output=True, text=True)
        print(f"{nome:20} {'MORTO' if r.returncode else 'SOBREVIVEU'}")
        if r.returncode == 0:
            vivos.append(nome)
finally:
    shutil.move(bak, lib)
sys.exit(1 if vivos else 0)
