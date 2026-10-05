#!/usr/bin/env bash
# Paso 6 (letra A): cruzamento do sítio das 10 cadeas con `rex-cfg/v1`
# (frente C, PR #108 HEAD exacto 275f2af). Expectativas conxeladas ANTES:
# docs/.../a/EXPECTATIONS-CRUZAMENTO-REXCFG-A.md. Non copia o decoder de C:
# executa a súa CLI como ferramenta externa e compara vereditos.
#
# Require: rex-cfg construído desde `git archive 275f2af` en scratch (ver §0
# do conxelado) e a serie v1.1 de cadeas de executar-evidencia-A.sh.
# Uso: bash cruzar-rexcfg-A.sh [dir-cadeas] [dir-saida]
set -uo pipefail
A_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="${REX_CFG_BIN:-$HOME/rds-scratch/cfg-target-275f2af/debug/rex-cfg}"
CFG_PIN="7daeb51d151f54cc29843d352fcb69ccf5d0406dbbed5c90dd2e6da81094a927"
SRC="${1:-$HOME/rds-scratch/xe-a-evidencia-v11}"
OUT="${2:-$HOME/rds-scratch/xe-a-rexcfg-cruzamento}"
mkdir -p "$OUT"
SONIC="$HOME/.retrodev/rex_corpus_a_work/staged/Sonic the Hedgehog (USA, Europe).bin"
SOR="$HOME/.retrodev/rex_corpus_a_holdout/staged/Streets of Rage (World) (Translated PtBr)__Streets of Rage (World).gen"
PHEL_MEM="$SRC/Phelios (USA).gen"
SONIC_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
SOR_PIN="304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d"
PHEL_MEM_PIN="842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6"

[ -x "$CFG" ] || { echo "ABORT: rex-cfg sen construír ($CFG; ver §0 do conxelado)"; exit 1; }
[ "$(sha256sum "$CFG" | cut -d' ' -f1)" = "$CFG_PIN" ] || { echo "ABORT: rex-cfg diverxe do pin 275f2af"; exit 1; }
[ "$(sha256sum "$SONIC" | cut -d' ' -f1)" = "$SONIC_PIN" ] || { echo "ABORT: Sonic diverxe do pin"; exit 1; }
[ "$(sha256sum "$SOR" | cut -d' ' -f1)" = "$SOR_PIN" ] || { echo "ABORT: SoR diverxe do pin"; exit 1; }
[ -f "$PHEL_MEM" ] || { echo "ABORT: membro Phelios non está en \$SRC ($PHEL_MEM); reextraedo con executar-evidencia-A.sh §D"; exit 1; }
[ "$(sha256sum "$PHEL_MEM" | cut -d' ' -f1)" = "$PHEL_MEM_PIN" ] || { echo "ABORT: membro Phelios diverxe do pin §6"; exit 1; }

# pins das cadeas v1.1 (INFORME-A §6 + §6.1) — rompe se a serie muda
verifica_pin() { # ficheiro pin
  local got; got="$(sha256sum "$SRC/$1.jsonl" | cut -d' ' -f1)"
  if [ "$got" = "$2" ]; then echo "pin-ok $1"; else echo "ABORT $1.jsonl: $got != $2"; return 1; fi
}
fai=0
verifica_pin sonic-3082 2ec2fd903e4bb28e88c6091a7b71e2f8d9dc894e03c83ab2248b07304ec1687a || fai=$((fai+1))
verifica_pin sonic-1364 793c5681226e0d38b7514f744170f05e2a62c27c9173d2a2f774080bd0d2aaae || fai=$((fai+1))
verifica_pin sonic-51BC 8ffc94a508261382e622d066646f60fd1fb7512bbe6b26d069bcfe34753ecfb3 || fai=$((fai+1))
verifica_pin sor-16D2   b4b98b95626a972e7922bc5c81fd60b6ff209f6e0428aaae0235b88a19115317 || fai=$((fai+1))
verifica_pin sor-087FC  bb6b578173f125805d712e2fda8b63ba82a99193b6ca78348dfaf495a8cd5839 || fai=$((fai+1))
verifica_pin sor-08842  c952c42cb918f15c71eef0393c1b63da2da70e43ed1722bf0d18a6d883fc6544 || fai=$((fai+1))
verifica_pin sor-10636  ad3718aff65e507e066a3fb61052d1b1f372c13dd7f29c064810f16b61eda8ad || fai=$((fai+1))
verifica_pin sor-10852  ecf98bd5c1292d2ef9df54cba83a8ef497ea3fd40ab5b07199d4bff54c872ef4 || fai=$((fai+1))
verifica_pin sor-119B4  7d4ed6e57da5ab4fbc6d380af24539852b4f0e73e2945bf69310d4ca5f0f691c || fai=$((fai+1))
verifica_pin phelios-varredura 07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694 || fai=$((fai+1))
[ "$fai" = 0 ] || { echo "ABORT: serie de cadeas non coincide cos pins §6/§6.1"; exit 1; }

echo "===== CRUZAMENTO rex-cfg/v1 (275f2af, bin $CFG_PIN) ====="
fai=0
run() { # nome imaxe
  local n="$1" imaxe="$2"
  python3 "$A_DIR/verificar-sitios.py" --rex-cfg "$CFG" --jsonl "$SRC/$n.jsonl" \
      --bin "$imaxe" --out "$OUT/$n.rexcfg.json"
  local rc=$?
  if [ "$rc" = 0 ]; then echo "OK-cadea $n"; else echo "FALLO-cadea $n rc=$rc"; fai=$((fai+1)); fi
}
run sonic-3082 "$SONIC"
run sonic-1364 "$SONIC"
run sonic-51BC "$SONIC"
run sor-16D2 "$SOR"
run sor-087FC "$SOR"
run sor-08842 "$SOR"
run sor-10636 "$SOR"
run sor-10852 "$SOR"
run sor-119B4 "$SOR"
run phelios-varredura "$PHEL_MEM"

echo "===== NEGATIVO §5: identidade do obxecto trocada ====="
python3 "$A_DIR/verificar-sitios.py" --rex-cfg "$CFG" --jsonl "$SRC/sonic-3082.jsonl" \
    --bin "$SOR" --out "$OUT/neg-identidade.rexcfg.json" >"$OUT/neg-identidade.txt" 2>&1
rc=$?
if [ "$rc" = 2 ]; then echo "OK   neg-identidade: rc=2 sen analizar ($(tail -1 "$OUT/neg-identidade.txt"))";
else echo "FALLO neg-identidade: esperaba rc=2, obtido rc=$rc"; fai=$((fai+1)); fi

echo "===== SHA dos exports ====="
( cd "$OUT" && sha256sum *.rexcfg.json )

echo "===== TOTAIS ====="
echo "fallos=$fai"
[ "$fai" = 0 ] || exit 1
exit 0
