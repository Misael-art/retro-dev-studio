#!/usr/bin/env bash
# ETAPA 3 §5 — gera (e verifica) `fixtures/fx13_mascaras.tsv`: subset de slots do
# corpus da varredura §4, uma linha por word, com o VEREDITO DO INSTRUMENTO
# medido nesta rodada e o veredito que a referencia primaria manda publicar.
#
#   ./tools/gerar-fx13-mascaras.sh          # escrever fixtures/fx13_mascaras.tsv
#   ./tools/gerar-fx13-mascaras.sh --check  # regerar em dir temporario e exigir igualdade
#
# Colunas (separadas por TAB):
#   slot-endereco  word  esperado  token-do-instrumento  bytes-do-instrumento  fonte
#
# * `esperado` e autoral: `leitura=N` (publicamos instrucao de N bytes) ou
#   `recusa-<classe>`, onde `<classe>` e o rotulo exato de `FrontierKind::label()`
#   (vocabulario em `CONTRACT.md`: `opcode-fora-do-subconjunto`, `indirect-opaque`,
#   `trap-opaco`, `limite-de-regiao`, `truncada`, `limite-de-trabalho`). A classe e
#   parte da alegacao, nao um detalhe da maquina: `4E90` e JSR com alvo nao
#   comprovado, o opcode esta na lista fechada (`CONTRACT.md` §0 item 2, l.45-47 e
#   §3, l.191; a retificacao de ADENDO-ETAPA2 reescreve §1 M8/M9 nesse sentido) e o
#   censo §4 a tem no grupo `PROIBICAO-ESTRUTURAL-0-2` (52 words) — recusar aquela
#   word como opcode desconhecido seria alegar outra coisa. A justificativa vive na
#   coluna `fonte`.
# * `token`/`bytes` sao medidos com o objdump pinado, no mesmo formato de slot do
#   censo (§4): word + 14 bytes de `4E71`. Convencao: `.short` vale `bytes = 0`,
#   porque o instrumento nao le instrucao nenhuma.
# * o arquivo nao tem data nem caminho absoluto: os unicos valores que mudam entre
#   rodadas sao os digestos do instrumente, e eles mudam so se o toolchain mudar.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIX="$AQUI/fixtures"
ALVO="$FIX/fx13_mascaras.tsv"
MODO="${1:-gerar}"
DATA="$AQUI/../../../../data/rex_profiles/parallel_recovery_20261004/c/evidence/etapa3"

TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
AS="$TC/m68k-elf-as"
OBJDUMP="$TC/m68k-elf-objdump"
for b in "$AS" "$OBJDUMP"; do
    [ -x "$b" ] || { echo "ERRO: instrumento ausente: $b (defina M68K_TOOLCHAIN)" >&2; exit 1; }
done

# ---------------------------------------------------------------------------
# Linhas autorais: word, esperado, fonte. Todo rotulo aqui ja foi medido nesta
# ETAPA (sonda `as -m68000`, censo §4 ou referencia primaria), e a lista e o
# inventario das mascaras que a ETAPA 3 tocou.
# ---------------------------------------------------------------------------
linhas() {
    cat <<'TSV'
4E71	leitura=2	as -m68000 e o objdump pinado medidos (sonda v9); baseline do corpus 4
3208	leitura=2	M68000PRM Tabela 3-9 (MOVE); sonda as -m68000: movew %a0,%d1
2208	leitura=2	M68000PRM Tabela 3-9 (MOVE); sonda as -m68000: movel %a0,%d1
5048	leitura=2	M68000PRM 4-32 (ADDQ com destino An); sonda as -m68000: addqw #8,%a0
5088	leitura=2	M68000PRM 4-32 (ADDQ); sonda as -m68000: addql #8,%a0
5108	leitura=2	M68000PRM 4-118 (SUBQ); sonda as -m68000: subqb #8,%a0
43D0	leitura=2	M68000PRM 4-90 (LEA so fonte de endereco); sonda as -m68000: lea %a0@,%a1
4850	leitura=2	M68000PRM 4-144 (PEA); sonda as -m68000: pea %a0@
487A	leitura=4	M68000PRM 4-144 (PEA em modo de 4 bytes); sonda as -m68000: pea %pc@(0x12)
48E0	leitura=4	M68000PRM 4-138 (MOVEM, fonte An- com lista de registradores); sonda as -m68000
4CD8	leitura=4	M68000PRM 4-138 (MOVEM %a0@+ com lista de destino); sonda as -m68000
08C0	leitura=4	M68000PRM 3.5 (BSET com imediato de 8 bits); sonda as -m68000: bset #3,%d0
C280	leitura=2	M68000PRM Tabela 3-13 (AND Dn,ea); sonda as -m68000: andl %d0,%d1
4482	leitura=2	M68000PRM Tabela 3-16 (NEG); sonda as -m68000: negl %d2
D248	leitura=2	M68000PRM l.5022-5040 (ADD, An* com footnote word/long only); sonda as -m68000
D288	leitura=2	M68000PRM l.5022-5040 (ADD); sonda as -m68000: addl %a0,%d1
9248	leitura=2	M68000PRM l.12151-12156 (SUB); sonda as -m68000: subw %a0,%d1
B248	leitura=2	M68000PRM l.7904-7909 (CMP); sonda as -m68000: cmpw %a0,%d1
B141	leitura=2	M68000PRM Tabela 3-13 (EOR com direcao b8=1); censo 4: b141 eorw
E1D0	leitura=2	M68000PRM 3.1.4 l.3605 e formato MEMORY SHIFTS l.9635+; sonda as -m68000
51C8	leitura=4	M68000PRM 3.2.4 (DBcc, displacement e word com sinal); censo 4: 4 bytes
4EB8	leitura=4	M68000PRM 2.2.16 (extensao de sinal) e 4-152; censo 4: jsr absoluto curto
4EB9	leitura=6	M68000PRM 2.2.17 (abs.L literal); censo 4: jsr 0x4e714e71
D0C0	leitura=2	M68000PRM Tabela 3-13 (ADDA: ss=%11, tamanho no bit 10); auditoria E4 do par ADDA/SUBA/CMPA
90C0	leitura=2	M68000PRM Tabela 3-13 (SUBA); auditoria E4 do par ADDA/SUBA/CMPA
B0C0	leitura=2	M68000PRM Tabela 3-13 (CMPA); auditoria E4 do par ADDA/SUBA/CMPA
C248	recusa-opcode-fora-do-subconjunto	M68000PRM l.5460-5466 (AND marca An como modo ausente); sonda as -m68000: operands mismatch
8248	recusa-opcode-fora-do-subconjunto	M68000PRM l.11150-11152 (OR marca An como modo ausente); sonda as -m68000
B008	recusa-opcode-fora-do-subconjunto	M68000PRM Tabela 2-4 (An nao e operando de dados); sonda as -m68000 recusa cmp.b %a0,%d1; censo 4 registra o instrumento lendo cmpb (short=0/64)
D208	recusa-opcode-fora-do-subconjunto	M68000PRM l.5040 footnote Word and long only; sonda as -m68000 recusa add.b %a0,%d1
9008	recusa-opcode-fora-do-subconjunto	M68000PRM l.5040 e l.12151-12156 (SUB comparte o footnote); sonda as -m68000
51FF	recusa-opcode-fora-do-subconjunto	M68000PRM Tabela 3-19 (Scc/DBcc com bit11=0 e cc de 3 bits); censo 4: o instrumento le sf %d7 e nos recusamos
4E90	recusa-indirect-opaque	CONTRACT.md 0 item 2 (l.45-47) e 3 (l.191): JMP/JSR indiretos produzem fronteira indirect-opaque, nunca opcode-fora-do-subconjunto; censo 4: grupo de 52 words PROIBICAO-ESTRUTURAL-0-2
7100	recusa-opcode-fora-do-subconjunto	M68000PRM l.23789-23808 (Tabela 8-2: %0111 com b8=1 e 68020/68040); sonda as -m68000
484F	recusa-opcode-fora-do-subconjunto	sonda as -m68000: needs 68010 or higher (BKPT); M68000PRM nao contem BKPT
413C	recusa-opcode-fora-do-subconjunto	M68000PRM l.7643-7644 (CHK so com ea) e codigo de tamanho %00 reservado; teste r14
0088	recusa-opcode-fora-do-subconjunto	M68000PRM l.11262-11268 (imediato: so modos de dados alteraveis); sonda as -m68000; censo 4: short=0/64
TSV
}

# ---------------------------------------------------------------------------
# Corpus no formato exato do censo §4: slot de 16 bytes, word no inicio, resto
# `4E71`. O endereco de cada slot e o indice do rotulo, como na varredura.
# ---------------------------------------------------------------------------
escreve_corpus() {
    local destino="$1" i=0 hi lo byte
    : > "$destino"
    while IFS=$'\t' read -r word _esperado _fonte; do
        [ -n "$word" ] || continue
        hi=$(( (0x$word >> 8) & 0xFF ))
        lo=$(( 0x$word & 0xFF ))
        printf "\\x$(printf '%02x' "$hi")\\x$(printf '%02x' "$lo")" >> "$destino"
        for _ in 1 2 3 4 5 6 7; do printf '\x4e\x71' >> "$destino"; done
        i=$((i + 1))
    done < <(linhas)
    printf 'corpus fx13: %d slots de %d bytes = %d bytes\n' "$i" 16 "$((i * 16))" >&2
}

gera_tsv() {
    local dir="$1"
    mkdir -p "$dir"
    escreve_corpus "$dir/corpus-fx13.bin"
    "$OBJDUMP" -b binary -m m68k -D "$dir/corpus-fx13.bin" > "$dir/dump-fx13.txt"
    sha_as="$(sha256sum "$AS" | cut -d' ' -f1)"
    sha_od="$(sha256sum "$OBJDUMP" | cut -d' ' -f1)"
    sha_corpus="$(sha256sum "$dir/corpus-fx13.bin" | cut -d' ' -f1)"
    sha_c4="$(cd "$DATA" 2>/dev/null && grep -F 'corpus-mascaras.bin' varredura-mascaras-v2-sha256.txt | cut -d' ' -f1 || echo indisponivel)"
    awk -v dump="$dir/dump-fx13.txt" -v sha_as="$sha_as" -v sha_od="$sha_od" \
        -v sha_corpus="$sha_corpus" -v sha_c4="$sha_c4" '
        function hex2dec(s,   i, c, v) {
            v = 0
            for (i = 1; i <= length(s); i++) {
                c = substr(s, i, 1)
                if (c >= "0" && c <= "9") v = v * 16 + c + 0
                else { c = toupper(c); v = v * 16 + index("ABCDEF", c) + 9 }
            }
            return v
        }
        BEGIN {
            FS = "\t"
            # registro do instrumento: endereco -> token e numero de bytes
            while ((getline linha < dump) > 0) {
                n = split(linha, p, "\t")
                if (n < 3) continue
                addr = p[1]; sub(/:$/, "", addr); gsub(/ /, "", addr)
                # o endereco do dump esta em HEX; a chave do mapa e decimal. Sem esta
                # conversao antes do dedupe, `10` (0x10=16) colidia com `a` (10).
                a = hex2dec(addr)
                if (a in visto) continue
                # a coluna de bytes tem espacos de alinhamento no fim: sem cortar, o
                # split conta um campo vazio e todo comprimento sai +2 bytes.
                col = p[2]
                gsub(/^ +/, "", col)
                gsub(/ +$/, "", col)
                palavras = split(col, w, / +/)
                token = p[3]; sub(/^ +/, "", token); split(token, t, " ")
                visto[a] = 1
                tok[a] = t[1]
                # um token que comeca por `.` (`.short`, `.word`, `.long`) nao e uma
                # instrucao lida: e o instrumento despejando bytes. Convencao da
                # tabela: nesse caso `bytes-do-instrumento = 0`.
                bytes[a] = (substr(t[1], 1, 1) == ".") ? 0 : palavras * 2
            }
            close(dump)
            printf "# fixtures/fx13_mascaras.tsv — ETAPA 3 §5: subset de slots da varredura §4 com o veredito medido do instrumento.\n"
            printf "# receita: tools/gerar-fx13-mascaras.sh (word + 14 bytes de 4E71 por slot, objdump -b binary -m m68k -D)\n"
            printf "# instrumento pinado: m68k-elf-as sha256 %s\n", sha_as
            printf "# instrumento pinado: m68k-elf-objdump sha256 %s\n", sha_od
            printf "# corpus desta tabela sha256 %s\n", sha_corpus
            printf "# corpus do censo §4 (de onde os rotulos sao subset) sha256 %s\n", sha_c4
            printf "# colunas: slot-endereco, word, esperado(nosso), token-do-instrumento, bytes-do-instrumento, fonte\n"
            printf "# vocabulario de `esperado`: `leitura=N` ou `recusa-<classe>`, com <classe> igual ao rotulo de FrontierKind::label() (CONTRACT.md)\n"
            printf "# convencao: bytes-do-instrumento = 0 quando o verbo comeca por ponto (`.short`, `.word`, `.long`): o instrumento nao le instrucao nenhuma\n"
            slot = 0
            while ((getline linha < ENVIRON["LINHAS_FILE"]) > 0) {
                n = split(linha, c, "\t")
                if (n < 3) continue
                if (!(slot in visto)) {
                    printf "ERRO: o instrumento nao imprimiu registro no slot %d (word %s)\n", slot, c[1] > "/dev/stderr"
                    exit 1
                }
                printf "%04X\t%s\t%s\t%s\t%d\t%s\n", slot, c[1], c[2], tok[slot], bytes[slot], c[3]
                slot += 16
            }
        }
    ' /dev/null > "$dir/fx13_mascaras.tsv"
}

# O awk le as linhas autorais por ENVIRON; materializa-as em arquivo temporario.
TMP="$(mktemp -d "${TMPDIR:-/home/misael/rds-scratch}/rex-cfg-fx13.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
linhas > "$TMP/linhas.tsv"
# A coluna `fonte` tem de sair ASCII (regra V5 do contrato, e o teste de fx13
# exige): nenhuma linha autoral traz travessao, paragrafo ou acento.
if LC_ALL=C sed -e 's/\t//g' -e 's/[ -~]//g' "$TMP/linhas.tsv" | LC_ALL=C grep -q .; then
    echo "ERRO: linhas autorais com byte nao-ASCII (regra V5):" >&2
    LC_ALL=C grep -n '[^ -	~]' "$TMP/linhas.tsv" >&2 || true
    exit 1
fi
export LINHAS_FILE="$TMP/linhas.tsv"

if [ "$MODO" = "--check" ]; then
    gera_tsv "$TMP/novo"
    [ -e "$ALVO" ] || { echo "DRIFT: $ALVO ausente no repo" >&2; exit 1; }
    cmp -s "$ALVO" "$TMP/novo/fx13_mascaras.tsv" || {
        echo "DRIFT: fx13_mascaras.tsv nao e reproduzivel a partir das linhas autorais" >&2
        diff -u "$ALVO" "$TMP/novo/fx13_mascaras.tsv" | head -40 >&2 || true
        exit 1
    }
    echo "OK: fx13_mascaras.tsv reproduzivel a partir do instrumento pinado"
    exit 0
fi

[ "$MODO" = "gerar" ] || { echo "uso: $0 [gerar|--check]" >&2; exit 2; }
gera_tsv "$TMP/novo"
cp "$TMP/novo/fx13_mascaras.tsv" "$ALVO"
echo "gerado: $ALVO ($(wc -l < "$ALVO") linhas, $(grep -vc '^#' "$ALVO") rotulos)"
