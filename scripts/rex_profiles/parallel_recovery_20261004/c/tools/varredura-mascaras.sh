#!/usr/bin/env bash
# ETAPA 3 §4 — auditoria exaustiva de máscaras (fim da obrigação 6).
#
#   ./tools/varredura-mascaras.sh          # (re)gerar a evidência -v2
#   ./tools/varredura-mascaras.sh --check  # regerar em dir temporário e exigir igualdade
#
# Pipeline (a receita é a prova; o dump integral de ~500 mil registros NÃO entra
# no índice — EXPECTATIONS-ETAPA3 §2.2):
#   1. `rex-cfg --example mascaras emit-corpus`   -> corpus determinístico 1 MiB
#   2. `m68k-elf-objdump -b binary -m m68k -D`    -> referência independente
#   3. `... classificar`                           -> contagens, divergências e
#      tabela de recusas declaradas; grupo sem justificativa, ou qualquer
#      `divergencia-critica`, faz o gerador FALHAR em vez de escrever evidência.
#
# O instrumento é o mesmo pinado do launcher (não procura `objdump` no PATH).
# REX_SCRATCH=<dir> faz a rodada usar esse diretório em vez de mktemp -d; o
# dump tem ~20 MB e /tmp pode ser pequeno.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$AQUI/../../../../data/rex_profiles/parallel_recovery_20261004/c/evidence/etapa3"
MODO="${1:-gerar}"

TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
OBJDUMP="$TC/m68k-elf-objdump"
[ -x "$OBJDUMP" ] || { echo "ERRO: instrumento ausente: $OBJDUMP (defina M68K_TOOLCHAIN)" >&2; exit 1; }

gerar_para() {
    local dir="$1"
    mkdir -p "$dir"
    (cd "$AQUI" && cargo run --quiet --release --example mascaras -- emit-corpus "$dir/corpus-mascaras.bin")
    # `-D` e obrigatorio: com `-d` sobre `-b binary` o instrumento nao imprime
    # nenhuma linha (medido na sonda V1; nota de metodo das expectativas).
    "$OBJDUMP" -b binary -m m68k -D "$dir/corpus-mascaras.bin" > "$dir/dump-mascaras.txt"
    (cd "$AQUI" && cargo run --quiet --release --example mascaras -- classificar \
        "$dir/corpus-mascaras.bin" "$dir/dump-mascaras.txt" \
        "$dir/varredura-mascaras-v2.json" "$dir/varredura-mascaras-v2.md" "$TC")
}

TMP_BASE="${REX_SCRATCH:-}"
if [ -n "$TMP_BASE" ]; then
    TMP="$TMP_BASE/varredura-$$"
    mkdir -p "$TMP"
else
    TMP="$(mktemp -d)"
fi
trap 'rc=$?; if [ "$rc" -ne 0 ]; then
    # E4-2 em FAIL: a serie bruta (dump, corpus e qualquer redigido parcial) tem de
    # sobreviver para o diagnostico. Nao ha edicao posterior de expectativa sem ela.
    echo "ERRO: rodada $rc encerrada sem fechar a cota; serie bruta em $TMP" >&2
else
    rm -rf "$TMP"
fi' EXIT

if [ "$MODO" = "--check" ]; then
    gerar_para "$TMP/novo"
    for f in varredura-mascaras-v2.json varredura-mascaras-v2.md; do
        cmp -s "$TMP/novo/$f" "$DATA/$f" || {
            echo "ERRO: $f nao reproduz a partir da receita (diff com $DATA/$f)" >&2
            exit 1
        }
    done
    echo "OK: evidencia de mascaras reproduzivel (digestos iguais)."
    exit 0
fi

[ "$MODO" = "gerar" ] || { echo "uso: $0 [gerar|--check]" >&2; exit 2; }
gerar_para "$TMP"
mkdir -p "$DATA"
cp "$TMP/varredura-mascaras-v2.json" "$TMP/varredura-mascaras-v2.md" "$DATA/"
{
    echo '# Digestos da rodada E4. Corpus e dump NAO sao versionados (E4-3 e 2.2 das'
    echo '# expectativas): sao regeneraveis byte a byte a partir desta receita, o que o'
    echo '# modo --check comprava. Os dois primeiros nomes sao relativos a data/.../evidence.'
    echo '# O sha do dump integral e um registro DESTA rodada: a linha 2 do cabecalho do'
    echo '# objdump embute o caminho do corpus, entao ele muda entre rodadas sem mudar o'
    echo '# conteudo. O oraculo de igualdade do conteudo e o sha do corpo (da 3a linha em'
    echo '# diante), medido em 2026-10-05 e registrado em'
    echo '# docs/.../c/EVIDENCIA-REPRODUTIBILIDADE-ETAPA3-2026-10-05.md: e1cc688a588ce77d'
    echo '# 2281737f60dbf2566c716835b54a46846deb5b8f4fe422e0 (idem na rodada preservada).'
    (cd "$DATA" && sha256sum varredura-mascaras-v2.json varredura-mascaras-v2.md)
    (cd "$TMP" && sha256sum corpus-mascaras.bin dump-mascaras.txt)
} > "$DATA/varredura-mascaras-v2-sha256.txt"
cat "$DATA/varredura-mascaras-v2-sha256.txt"
