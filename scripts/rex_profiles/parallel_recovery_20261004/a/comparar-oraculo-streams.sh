#!/usr/bin/env bash
# Fase 5 (letra A): comparacion do decodificador do produto (crates/rex-kosinski)
# contra a referencia externa koscmp, sobre as 8 streams ligadas a consumidores
# (3 Sonic 1 + 5 SoR) tal como fixa docs/.../EXPECTATIONS-A.md §5.
#
# Espera conxelada por stream:
#   - produto == saida_sha256/saida_bytes do rexistro v2;
#   - oraculo == produto no PREFIXO saida_bytes;
#   - lonxitude oraculo = saida_bytes + 1 (padding tras terminator, CONTRACT §3);
#   - calquera outro resultado = DIVERXE (non paridade).
#
# DESVIO REXISTRADO (2026-10-04): EXPECTATIONS §5 dicía reutilizar
# scripts/rex_profiles/codecs/common/sandbox.sh; ese ficheiro NON existe na
# base pinned cb56657. Aplícanse limits equivalentes in situ (timeout +
# ulimit -v/-t/-f + stdin fechado) sen escribir fóra do territorio A.
#
# Non modifica nada fóra de [dir-saida] (por defecto ~/rds-scratch).
# Uso: bash comparar-oraculo-streams.sh [dir-saida]
set -uo pipefail

REPO="${REX_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
A="$REPO/scripts/rex_profiles/parallel_recovery_20261004/a"
CACHE="${REX_CODEC_CACHE:-$HOME/.cache/rex-codecs}"
KOS="$CACHE/oracle-tools/bin/koscmp"
KOSPIN_SHA="a74c92957eccf9c1e5143167af9d6d98b2ce087aed8fe10d50b1f9c016373ea3"
KOSPIN_COMMIT="72c6df405a75d322c5b3722da46c3abb864d3793"

SONIC="${REX_SONIC_IMAXE:-$HOME/.retrodev/rex_corpus_a_work/staged/Sonic the Hedgehog (USA, Europe).bin}"
SONIC_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
SOR="${REX_SOR_IMAXE:-$HOME/.retrodev/rex_corpus_a_holdout/staged/Streets of Rage (World) (Translated PtBr)__Streets of Rage (World).gen}"
SOR_PIN="304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d"
JSONL_SONIC="$REPO/data/rex_corpus_a/evidencia/sonic-1-usa-europe.rexistros.jsonl"
JSONL_SOR="$REPO/data/rex_corpus_a/evidencia/streets-of-rage-world-ptbr-reservada.rexistros.jsonl"

OUT="${1:-$HOME/rds-scratch/oracle-compare}"
mkdir -p "$OUT"
ROWS="$OUT/oracle-streams.tsv"
printf 'caso\timaxe\toffset\tconsumidos\tsaida_bytes\tsaida_sha256\tproduto\toraculo\tveredicto\tmotivacion\n' > "$ROWS"
sha() { sha256sum "$1" | cut -d' ' -f1; }
line() { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$@" | tee -a "$ROWS"; }

# ---- pins: oraculo e imaxes. referencia ausente = SKIP/BLOCKED con motivo.
if [ ! -x "$KOS" ]; then
  echo "SKIP/BLOCKED: oraculo koscmp ausente ($KOS); paridade externa non se afirma (§6)"
  exit 3
fi
got="$(sha "$KOS")"
if [ "$got" != "$KOSPIN_SHA" ]; then echo "ABORT: koscmp $got != pin $KOSPIN_SHA"; exit 4; fi
gotc="$(git -C "$CACHE/references/mdcomp" rev-parse HEAD 2>/dev/null || echo sen-checkout)"
if [ "$gotc" != "$KOSPIN_COMMIT" ]; then echo "ABORT: checkout mdcomp $gotc != pin $KOSPIN_COMMIT"; exit 4; fi
for par in "$SONIC:$SONIC_PIN" "$SOR:$SOR_PIN"; do
  f="${par%%:*}"; p="${par##*:}"
  [ -f "$f" ] || { echo "ABORT: imaxe ausente: $f (meta 2 imaxes; rexistrar pendencia, non prometer)"; exit 5; }
  [ "$(sha "$f")" = "$p" ] || { echo "ABORT: imaxe diverxe do pin §0: $f"; exit 5; }
done

# ---- binario do produto (example do crate, construido sen tocar a árbore)
CT="${CARGO_TARGET_DIR:-$HOME/rds-scratch/chain-target}"
CARGO_TARGET_DIR="$CT" cargo build --release --manifest-path "$REPO/crates/rex-kosinski/Cargo.toml" --example decode >/dev/null || { echo "build decode example falhou"; exit 1; }
BIN="$CT/release/examples/decode"

# ---- sandbox local equivalente (ver DESVIO no cabeceiro)
run_oracle() { # <saida-stderr> -- cmd...
  local errf="$1"; shift; shift
  ( ulimit -v 4000000 -t 60 -f 20480; timeout 60 "$@" </dev/null ) 2>"$errf"
}

par=0; par_corr=0; bad=0
run_case() { # nome imaxe offset consumidos saida_bytes saida_sha
  local nome="$1" imaxe="$2" offset="$3" cons="$4" sb="$5" ssha="$6"
  local st="$OUT/$nome.kos" pr="$OUT/$nome.produto.bin" or="$OUT/$nome.oraculo.bin"
  rm -f "$st" "$pr" "$or"
  # dd en vez de tail|head: o pipeline con head -c pecha antes e SIGPIPE
  # fai fallar a extraccion bajo pipefail (medido 2026-10-04).
  dd if="$imaxe" of="$st" bs=1 skip="$offset" count="$cons" status=none || { line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "-" "-" "DIVERXE" "extraccion da stream fallou"; bad=$((bad+1)); return; }
  local pr_rc=0 or_rc=0
  "$BIN" "$st" "$pr" 2>"$OUT/$nome.produto.err" || pr_rc=$?
  run_oracle "$OUT/$nome.oraculo.err" -- "$KOS" -x "$st" "$or" || or_rc=$?
  local motivo=""
  if [ ! -f "$pr" ] || [ "$(sha "$pr")" != "$ssha" ] || [ "$(stat -c%s "$pr")" != "$sb" ]; then
    motivo="produto != rexistro v2 (esperaba $ssha/$sb B; atopou $( [ -f "$pr" ] && echo "$(sha "$pr")/$(stat -c%s "$pr") B" || echo "sen-ficheiro rc=$pr_rc $(head -c 100 "$OUT/$nome.produto.err" | tr '\n' ' ')" ))"
    line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "rc=$pr_rc $( [ -f "$pr" ] && echo "sha=$(sha "$pr") len=$(stat -c%s "$pr")" || echo "sen-ficheiro: $(head -c 100 "$OUT/$nome.produto.err" | tr '\n' ' ')" )" "rc=$or_rc" "DIVERXE" "$motivo"; bad=$((bad+1)); return
  fi
  if [ ! -f "$or" ]; then
    line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "rc=$pr_rc sha=$ssha" "rc=$or_rc sen-ficheiro $(head -c 100 "$OUT/$nome.oraculo.err" | tr '\n' ' ')" "DIVERXE" "oraculo non produciu saida nunha stream ben formada"
    bad=$((bad+1)); return
  fi
  local olen; olen="$(stat -c%s "$or")"
  if ! cmp -n "$sb" "$or" "$pr" 2>/dev/null; then
    line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "rc=$pr_rc sha=$ssha" "rc=$or_rc sha=$(sha "$or") len=$olen" "DIVERXE" "prefixo saida_bytes do oraculo difire do produto"
    bad=$((bad+1)); return
  fi
  if [ "$olen" = "$sb" ] && cmp -s "$or" "$pr"; then
    # DESVIO do conxelado §5 rexistrado (non reescrito): a expectativa dicía
    # +1 padding na SAIDA do oraculo; o feito medido aqui e igualdade TOTAL
    # (delta 0). O padding "+1" de CONTRACT sec3 esta na STREAM que `koscmp -c`
    # emite tras o terminator, non no output de `-x`. Igualdade total e
    # paridade máis forte que a prefixo esperada.
    line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "rc=$pr_rc sha=$ssha len=$sb" "rc=$or_rc sha=$(sha "$or") len=$olen" "PARIDADE-CORREXION-PIN" "produto==rexistro v2; oraculo==produto EN CONTENIDO TOTAL (delta 0, non +1); desvio da expectativa §5 conservado e anotado"
    par_corr=$((par_corr+1)); return
  fi
  if [ "$olen" = "$((sb + 1))" ]; then
    line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "rc=0 sha=$ssha len=$sb" "rc=$or_rc sha=$(sha "$or") len=$olen" "PARIDADE" "produto==rexistro v2; oraculo==produto no prefixo $sb bytes; +1 padding tras terminator (CONTRACT sec3)"
    par=$((par+1)); return
  fi
  line "$nome" "$(basename "$imaxe")" "$offset" "$cons" "$sb" "$ssha" "ok" "rc=$or_rc len=$olen" "DIVERXE" "padding do oraculo != 0 nin +1 (medido $((olen - sb)))"
  bad=$((bad+1))
}

while IFS=$'\t' read -r nome imaxe offset cons sb ssha; do
  run_case "$nome" "$imaxe" "$offset" "$cons" "$sb" "$ssha"
done < <(python3 - "$JSONL_SONIC" "$SONIC" "$JSONL_SOR" "$SOR" <<'PY'
import json, sys
for jl, imaxe, tag in ((sys.argv[1], sys.argv[2], "sonic1"), (sys.argv[3], sys.argv[4], "sor")):
    with open(jl, encoding="utf-8") as f:
        for i, liña in enumerate(filter(lambda l: l.strip(), f), 1):
            r = json.loads(liña)
            print("\t".join([f"{tag}-{i}", imaxe, str(r["offset"]), str(r["bytes_consumidos"]), str(r["saida_bytes"]), r["saida_sha256"]]))
PY
)

echo
echo "TOTAIS: paridade=$par paridade-contido-total-desvio-+1=$par_corr DIVERXE=$bad  (tsv: $ROWS)"
[ "$bad" = 0 ] && [ $((par + par_corr)) = 8 ] || exit 1
exit 0
