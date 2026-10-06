#!/usr/bin/env bash
# Gera (e verifica) os fixtures autorais de `rex-cfg/v1` com o INSTRUMENTO
# independente: binutils 2.41 do host, provisionada pelo launcher do projeto.
#
#   ./tools/make-fixtures.sh          # (re)gerar fixtures/*.bin e fixtures/*-objdump.txt
#   ./tools/make-fixtures.sh --check  # regenerar em dir temporario e exigir igualdade
#
# Nada aqui roda em CI sem o toolchain: os .bin e .txt gerados sao versionados e
# os testes consomem os arquivos versionados. Este script e a prova de que eles
# sao reproduziveis a partir das fontes `.s` autorais (modo --check).
#
# Pipeline por fixture: as -> ld (texto em 0, entrada rotulada) -> objdump -d
# (referencia independente) -> objcopy -O binary (bytes que os testes leem).
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIX="$AQUI/fixtures"
MODO="${1:-gerar}"

# Toolchain pinado pelo launcher (mesmo caminho usado na calibracao). NAO
# procura um `as` arbitrario do PATH: paridade exige o instrumento medido.
TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
AS="$TC/m68k-elf-as"
LD="$TC/m68k-elf-ld"
OBJDUMP="$TC/m68k-elf-objdump"
OBJCOPY="$TC/m68k-elf-objcopy"
for b in "$AS" "$LD" "$OBJDUMP" "$OBJCOPY"; do
    [ -x "$b" ] || { echo "ERRO: instrumento ausente: $b (defina M68K_TOOLCHAIN)" >&2; exit 1; }
done

# corpus de calibracao: apenas a referencia objdump (os testes de paridade leem
# o texto); fixtures de fluxo: referencia + bytes.
CALIB=(calib calib2)
FX=(fx01_branches fx02_extended fx03_dbcc fx04_calls fx05_indirect
    fx06_data_opcodes fx07_out_of_region fx08_relative_base_historico
    fx09_matriz_isa fx10isca fx11assimetrica fx12_absW)

# cada fixture entra com o simbolo de entrada (evita warning do linker e prende
# o endereco-base em 0, que e o que os testes assumem via --origin 0x0).
# Convencao do nome do arquivo: `fxNN_descricao.s` rotula o inicio como `fxNN`.
# Os dois fixtures de ETAPA2 nao seguem a convencao porque o rotulo curto e o
# nome que aparece nas expectativas congeladas (`fx10`/`fx11`), entao o mapa e
# explicito: trocar o rotulo reescreveria EXPECTATIONS-ETAPA2.md, que e frozen.
entrada() {
    case "$1" in
        fx10isca) echo fx10 ;;
        fx11assimetrica) echo fx11 ;;
        *) echo "${1%%_*}" ;;
    esac
}

gerar() {
    local dir="$1" nome="$2" com_bytes="$3"
    mkdir -p "$dir"
    "$AS" -o "$dir/$nome.o" "$FIX/$nome.s"
    if [ "$com_bytes" = sim ]; then
        "$LD" -o "$dir/$nome.elf" "$dir/$nome.o" -Ttext 0 -e "$(entrada "$nome")" \
            --no-warn-mismatch --build-id=none 2>/dev/null
        "$OBJDUMP" -d "$dir/$nome.elf" | normalizaCabecalho > "$dir/$nome-objdump.txt"
        "$OBJCOPY" -O binary -j .text "$dir/$nome.elf" "$dir/$nome.bin"
        chmod 644 "$dir/$nome.bin"
        rm -f "$dir/$nome.elf"
    else
        "$OBJDUMP" -d "$dir/$nome.o" | normalizaCabecalho > "$dir/$nome-objdump.txt"
    fi
    rm -f "$dir/$nome.o"
}

# A primeira linha do `objdump -d` carrega o caminho do arquivo disassemblado.
# Em `--check` esse caminho e um mktemp, entao a comparacao byte a byte acusaria
# drift por causa do diretorio, nao do conteudo. So o nome do artefato fica no
# corpus: a referencia independe de onde foi montada (medido 2026-10-04).
normalizaCabecalho() {
    sed -E 's@.*/([^/]*\.(o|elf)): +file format@\1: file format@'
}

if [ "$MODO" = "--check" ]; then
    TMP="$(mktemp -d "${TMPDIR:-/home/misael/rds-scratch}/rex-cfg-fix.XXXXXX")"
    trap 'rm -rf "$TMP"' EXIT
    for n in "${CALIB[@]}" "${FX[@]}"; do
        gerando=nao; case " ${FX[*]} " in *" $n "*) gerando=sim ;; esac
        gerar "$TMP" "$n" "$([ "$gerando" = sim ] && echo sim || echo nao)"
        sufixos=(-objdump.txt)
        [ "$gerando" = sim ] && sufixos+=(.bin)
        for sufixo in "${sufixos[@]}"; do
            src="$FIX/$n$sufixo"
            [ -e "$src" ] || { echo "DRIFT: fixture ausente no repo: $src" >&2; exit 1; }
            cmp -s "$src" "$TMP/$n$sufixo" || {
                echo "DRIFT: $n$sufixo nao e reproduzivel a partir de $n.s" >&2
                diff -u "$src" "$TMP/$n$sufixo" | head -40 >&2 || true
                exit 1
            }
        done
    done
    echo "OK: $(( ${#CALIB[@]} + ${#FX[@]} )) corpus reproduziveis a partir das fontes .s (objdump + bytes identicos)"
    # A tabela de palavras de §5 e um artefato de fixture como os outros, mas nao
    # nasce de uma fonte `.s`: nasce do objdump pinado sobre um corpus de slots.
    # Ela entra no mesmo gate por sua propria receita, que e um script separado.
    bash "$AQUI/tools/gerar-fx13-mascaras.sh" --check
    exit 0
fi

for n in "${CALIB[@]}"; do gerar "$FIX" "$n" nao; done
for n in "${FX[@]}"; do gerar "$FIX" "$n" sim; done

( cd "$AQUI" && sha256sum fixtures/*.s fixtures/*.bin fixtures/*-objdump.txt fixtures/*.tsv \
    > fixtures/MANIFEST.sha256 )
echo "gerado: $(ls "$FIX"/*.bin | wc -l) binarios, $(ls "$FIX"/*-objdump.txt | wc -l) referencias"
wc -c < "$FIX/MANIFEST.sha256" | xargs echo "MANIFEST.sha256:" bytes
