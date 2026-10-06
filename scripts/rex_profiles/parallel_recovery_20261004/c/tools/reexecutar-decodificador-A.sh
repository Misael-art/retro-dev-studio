#!/usr/bin/env bash
# Reexecucao da revisao independente de A (EXPECTATIONS-ETAPA2 §7.5).
#
#   bash tools/reexecutar-decodificador-A.sh [dir-saida]
#
# Extrai O blob publicado de A (`git show <SHA_A>:.../src/instr.rs`), confere o
# SHA-256 do blob contra o pino registrado em REVISAO-C-DE-A.md §6, monta um
# arbitro de execucao MINIMO na copia (nada toca a worktree de A), roda as 18
# sondas da matriz `fx09_matriz_isa.bin` (fixture autoral) + as quatro formas
# curtas, e exige serie identica a congelada abaixo.
#
# Por que executa em vez de so ler o codigo: a tabela §7.5 classifica `estado-
# apos-correcao` por linha; leitura de codigo nao prova comprimento nem alvo.
# O arbitro nao reimplementa nada de A: inclui o arquivo dela por `#[path]`.
#
# Saidas (sonda bruta, copia, binario) vao para dir-saida (default
# ~/rds-scratch/reexec-a) e NAO para a arvore versionada.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .../c/tools -> c -> parallel_recovery_20261004 -> rex_profiles -> scripts -> raiz
REPO="$(cd "$AQUI/../../../../.." && pwd)"
OUT="${1:-$HOME/rds-scratch/reexec-a}"
SHA_A="${SHA_A:-bd40e92269eb60b0df9b8ed0ddff561a0d19a4b3}"
BLOB="scripts/rex_profiles/parallel_recovery_20261004/a/src/instr.rs"
# pino de REVISAO-C-DE-A.md §6 (instr.rs exatamente como publicado em SHA_A)
PIN_INSTR="72096ce78c24351929f9b01824c17518dadebd4f4f3feb3525cb0de581eb1dbe"
FX09="$REPO/scripts/rex_profiles/parallel_recovery_20261004/c/fixtures/fx09_matriz_isa.bin"
PIN_FX09="b9f76bea893d690588f5803c7f6b393627dc223f2d864ed8f193c9a27c059924"

mkdir -p "$OUT"
falhas=0
marca() { echo "$1 $2"; [ "$1" = "FALHA" ] && falhas=$((falhas + 1)); return 0; }

if ! git -C "$REPO" cat-file -e "$SHA_A^{commit}" 2>/dev/null; then
    echo "AVISO: $SHA_A nao esta no object store local; busque o head de PR #107:"
    echo "  git -C $REPO fetch origin refs/pull/107/head"
fi
git -C "$REPO" show "$SHA_A:$BLOB" >"$OUT/instr.rs" 2>"$OUT/git-show.err" || {
    echo "FALHA extract: $(cat "$OUT/git-show.err")"; exit 1; }

tem=$(sha256sum "$OUT/instr.rs" | cut -d' ' -f1)
[ "$tem" = "$PIN_INSTR" ] \
    && marca OK "instr.rs de A confere com o pino ($tem)" \
    || marca FALHA "instr.rs diverge do pino: esperado $PIN_INSTR, obtido $tem — §7.5 precisa de nova linha de reexecucao, nao deste script"

fx=$(sha256sum "$FX09" | cut -d' ' -f1)
[ "$fx" = "$PIN_FX09" ] \
    && marca OK "fx09 confere ($fx)" \
    || marca FALHA "fx09 diverge do pino: $fx"

cp "$FX09" "$OUT/fx09_matriz_isa.bin"
cat >"$OUT/main.rs" <<'RS'
// Arbitro gerado por tools/reexecutar-decodificador-A.sh — NAO e codigo de C.
// Executa o decodificador PUBLICADO de A (blob conferido por SHA-256) sobre as
// sondas da matriz autoral fx09 + formas curtas medidas pelo instrumento.
#[path = "instr.rs"]
mod instr;

use instr::{decodificar, Forma, InstrErro};

const FX09: &[u8] = include_bytes!("fx09_matriz_isa.bin");

fn linha(site: u32, rotulo: &str, buf: &[u8]) -> String {
    match decodificar(buf, site) {
        Ok(f) => {
            let extra = match &f {
                Forma::LeaAbsL { operando, .. } | Forma::LeaAbsW { operando, .. } => {
                    format!("operando={operando:#010x}")
                }
                Forma::LeaPcD16 { destino, .. } => format!("destino={destino:#010x}"),
                Forma::BsrS { alvo }
                | Forma::BsrW { alvo }
                | Forma::JsrAbsL { alvo }
                | Forma::JsrAbsW { alvo }
                | Forma::JsrPcD16 { alvo }
                | Forma::JmpAbsL { alvo }
                | Forma::JmpAbsW { alvo }
                | Forma::JmpPcD16 { alvo } => format!("alvo={alvo:#010x}"),
            };
            format!(
                "{site:#06x} {rotulo:<9} OK   {} len={} {extra}",
                f.nome(),
                f.lonxitude()
            )
        }
        Err(e) => format!(
            "{site:#06x} {rotulo:<9} ERR  {}",
            match e {
                InstrErro::MoiCurta => "MoiCurta".to_string(),
                InstrErro::NonForma => "NonForma".to_string(),
                InstrErro::Recusa { motivo } => format!("Recusa({motivo})"),
            }
        ),
    }
}

fn janela(site: usize, n: usize) -> Vec<u8> {
    FX09[site..site + n].to_vec()
}

fn main() {
    let probes: Vec<(u32, &str, Vec<u8>)> = vec![
        (0x06, "bsr.w", janela(0x06, 4)),
        (0x0e, "bsr.w-", janela(0x0e, 4)),
        (0x16, "61FF", janela(0x16, 6)),
        (0x20, "4EB8", janela(0x20, 4)),
        (0x28, "4EB9", janela(0x28, 6)),
        (0x32, "4EF8", janela(0x32, 4)),
        (0x3a, "4EF9", janela(0x3a, 6)),
        (0x44, "4EFA", janela(0x44, 4)),
        (0x4c, "4EFC", janela(0x4c, 4)),
        (0x52, "4EFD", janela(0x52, 4)),
        (0x58, "2A7C", janela(0x58, 6)),
        (0x62, "0A7CFC", janela(0x62, 4)),
        (0x6a, "41F8", janela(0x6a, 4)),
        (0x72, "41FA", janela(0x72, 4)),
        // formas curtas: bytes digitados a partir da leitura do instrumento
        // (`611a -> bsrs 1c`, `6102` em fx09@0x00) e dos alvos impressos nas
        // tres ocurrencias do censo; nenhum byte de ROM comercial e versionado.
        (0x00, "bsr.s-0", janela(0x00, 2)),
        (0x5c2, "bsr.s-1", vec![0x61, 0x06]),
        (0x11f0, "bsr.s-2", vec![0x61, 0x02]),
        (0x1482, "bsr.s-3", vec![0x61, 0x06]),
    ];
    for (site, rotulo, buf) in &probes {
        let hex: Vec<String> = buf.iter().map(|b| format!("{b:02x}")).collect();
        println!("{} | {}", linha(*site, rotulo, buf), hex.join(" "));
    }
}
RS

if ! rustc --edition 2021 -o "$OUT/sonda" "$OUT/main.rs" >"$OUT/rustc.log" 2>&1; then
    marca FALHA "compilacao do arbitro: $(tail -3 "$OUT/rustc.log" | tr '\n' ' ')"
    exit 1
fi
marca OK "arbitro compilado (rustc, sem dependencias externas)"

"$OUT/sonda" >"$OUT/sonda-bruto.txt" 2>&1
marca INFO "serie bruta: $OUT/sonda-bruto.txt ($(wc -l <"$OUT/sonda-bruto.txt") linhas)"

cat >"$OUT/esperado.txt" <<'ESPERADO'
0x0006 bsr.w     OK   bsr.w len=4 alvo=0x00000088 | 61 00 00 80
0x000e bsr.w-    OK   bsr.w len=4 alvo=0x00000006 | 61 00 ff f6
0x0016 61FF      ERR  Recusa(68020-non-declarado) | 61 ff 00 00 12 34
0x0020 4EB8      OK   jsr.w len=4 alvo=0xffff8000 | 4e b8 80 00
0x0028 4EB9      OK   jsr.l len=6 alvo=0x00000088 | 4e b9 00 00 00 88
0x0032 4EF8      OK   jmp.w len=4 alvo=0xffff8000 | 4e f8 80 00
0x003a 4EF9      OK   jmp.l len=6 alvo=0x00800000 | 4e f9 00 80 00 00
0x0044 4EFA      OK   jmp.pcd16 len=4 alvo=0x0000127a | 4e fa 12 34
0x004c 4EFC      ERR  Recusa(indefinido-68000) | 4e fc 4e 71
0x0052 4EFD      ERR  Recusa(indefinido-68000) | 4e fd 4e 71
0x0058 2A7C      ERR  NonForma | 2a 7c 12 34 56 78
0x0062 0A7CFC    ERR  NonForma | 0a 7c fc 00
0x006a 41F8      OK   lea.w/A0 len=4 operando=0xffff8000 | 41 f8 80 00
0x0072 41FA      OK   lea.pcd16/A0 len=4 destino=0x00000032 | 41 fa ff be
0x0000 bsr.s-0   OK   bsr.s len=2 alvo=0x00000004 | 61 02
0x05c2 bsr.s-1   OK   bsr.s len=2 alvo=0x000005ca | 61 06
0x11f0 bsr.s-2   OK   bsr.s len=2 alvo=0x000011f4 | 61 02
0x1482 bsr.s-3   OK   bsr.s len=2 alvo=0x0000148a | 61 06
ESPERADO

if diff -u "$OUT/esperado.txt" "$OUT/sonda-bruto.txt" >"$OUT/diff.txt"; then
    marca OK "serie identica a congelada em §7.5 (18/18 linhas)"
else
    marca FALHA "serie diverge da congelada; diff em $OUT/diff.txt"
    cat "$OUT/diff.txt"
fi

echo "resumo: falhas=$falhas"
[ "$falhas" -eq 0 ] || exit 1
