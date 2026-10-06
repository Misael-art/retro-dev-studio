#!/usr/bin/env bash
# make-fixtures-a.sh — xera e verifica os fixtures autorais da letra A
# (retificacion 68000, 2026-10-04) co INSTRUMENTO independente: binutils
# 2.41 m68k-elf provisionada pelo launcher do proxecto en:
#   /home/misael/.cache/retrodevstudio/17f7bcf5.../source-build-m68k_gcc/source/install/bin
# Sobrescribible con M68K_TOOLCHAIN. Non busca un `as` do PATH: a paridade
# exige o instrumento medido (mesma política que a ferramenta da frente C).
#
#   ./tools/make-fixtures-a.sh          # (re)gerar fixtures/*.bin y *-objdump.txt
#   ./tools/make-fixtures-a.sh --check  # regenerar en temp e exigir igualdade
#
# Pipeline por fixture: as -> ld (-Ttext 0 -e fxNN) -> objdump -d (referencia
# independente) -> objcopy -O binary (bytes que os tests consomen). As
# sondas de recusa S1/S4 montanse aparte e a súa saída (rc + stderr)
# versionase como `fixtures/recusas.txt`.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIX="$AQUI/fixtures"
MODO="${1:-gerar}"

TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
AS="$TC/m68k-elf-as"
LD="$TC/m68k-elf-ld"
OBJDUMP="$TC/m68k-elf-objdump"
OBJCOPY="$TC/m68k-elf-objcopy"
for b in "$AS" "$LD" "$OBJDUMP" "$OBJCOPY"; do
    [ -x "$b" ] || { echo "ERRO: instrumento ausente: $b (defina M68K_TOOLCHAIN)" >&2; exit 1; }
done

FX=(fxA01_lea fxA02_calls fxA03_bsr fxA04_recusa)

normalizaCabecalho() {
    sed -E 's@.*/([^/]*\.(o|elf)): +file format@\1: file format@'
}

gerar() {
    local dir="$1" nome="$2"
    mkdir -p "$dir"
    "$AS" -o "$dir/$nome.o" "$FIX/$nome.s"
    "$LD" -o "$dir/$nome.elf" "$dir/$nome.o" -Ttext 0 -e "${nome%%_*}" \
        --no-warn-mismatch --build-id=none 2>/dev/null
    "$OBJDUMP" -d "$dir/$nome.elf" | normalizaCabecalho > "$dir/$nome-objdump.txt"
    "$OBJCOPY" -O binary -j .text "$dir/$nome.elf" "$dir/$nome.bin"
    chmod 644 "$dir/$nome.bin"
    rm -f "$dir/$nome.elf" "$dir/$nome.o"
}

# Sondas de recusa montadas individualmente co -m68000 estrito.
sondas_recusa() {
    local dir="$1" tmp
    tmp="$(mktemp -d "${TMPDIR:-/home/misael/rds-scratch}/rxa.XXXXXX")"
    {
        echo "# recusas.txt — instrument: $("$AS" --version | head -1)"
        echo
        echo "## S1: 'bsr.l al' con m68k-elf-as -m68000 (instrumento: $("$AS" --version | head -1))"
        printf '.text\n.globl f\nf:\n        bsr.l al\n        nop\nal:\n        rts\n' > "$tmp/s1.s"
        if (cd "$tmp" && "$AS" -m68000 -o s1.o s1.s) 2>"$tmp/s1.err"; then
            echo "RC=0 ASSEMBLOU — A RECTIFICACION DEBE REABRIRSE"
        else
            echo "RC=$? (recusado polo montador 68000)"
            sed -n '1,3p' "$tmp/s1.err"
        fi
        echo
        echo "## S4: indirectos por rexistro — assemblan, decoder recusa (fora-de-subconxunto)"
        echo "jmp (%a0) -> 4e d0 / jsr (%a2) -> 4e 92 (ver fxA04_recusa-objdump.txt)"
    } > "$dir/recusas.txt"
    rm -rf "$tmp"
}

if [ "$MODO" = "--check" ]; then
    TMPD="$(mktemp -d "${TMPDIR:-/home/misael/rds-scratch}/rxa-check.XXXXXX")"
    trap 'rm -rf "$TMPD"' EXIT
    for n in "${FX[@]}"; do
        gerar "$TMPD" "$n"
        for sufixo in "-objdump.txt" ".bin"; do
            cmp -s "$FIX/$n$sufixo" "$TMPD/$n$sufixo" || {
                echo "DRIFT: $n$sufixo non e reproducible desde $n.s" >&2
                diff -u "$FIX/$n$sufixo" "$TMPD/$n$sufixo" | head -40 >&2 || true
                exit 1
            }
        done
    done
    sondas_recusa "$TMPD"
    cmp -s "$FIX/recusas.txt" "$TMPD/recusas.txt" || {
        echo "DRIFT: recusas.txt non reproduce igual" >&2; exit 1; }
    echo "OK: ${#FX[@]} fixtures + recusas reproducibles (objdump e bytes identicos)"
    exit 0
fi

for n in "${FX[@]}"; do gerar "$FIX" "$n"; done
sondas_recusa "$FIX"
sha256sum "$AS" "$LD" "$OBJDUMP" "$OBJCOPY" > "$FIX/INSTRUMENTO.sha256"
echo "OK: fixtures xerados; toolchain pineado en fixtures/INSTRUMENTO.sha256"
