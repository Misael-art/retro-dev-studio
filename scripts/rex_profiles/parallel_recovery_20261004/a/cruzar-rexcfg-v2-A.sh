#!/usr/bin/env bash
# Paso 7 (letra A, 2026-10-06): consumo do resultado corrigido de C
# (`rex-cfg/v2`, PR #108, source SHA exacto 5f97368942e3255e08e8f0dbe6e6ab6be8ab09e1,
# serie lineal 8ea5821..5f97368; verificado con git merge-base --is-ancestor).
# Expectativas conxeladas ANTES (serie 78ea72a):
# docs/.../a/EXPECTATIONS-CRUZAMENTO-REXCFG-V2-A.md (V0-V7). Non copia o
# decoder de C: executa a súa CLI como ferramenta externa e compara vereditos.
# O arnés v1 (cruzar-rexcfg-A.sh, rex-cfg 275f2af) NON se toca: serie §6.2
# conservada. Verificar-sitios.py tampouco (identidade byte a byte que C
# rexistrou en REVISAO-C-DE-A-ETAPA3.md §4/§5).
#
# Require: rex-cfg construído desde `git archive 5f973689` en
# cfg-target-5f97368 (V0). Uso: bash cruzar-rexcfg-v2-A.sh [dir-v11] [dir-m3c] [dir-saida]
set -uo pipefail
A_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="${REX_CFG_BIN:-$HOME/rds-scratch/cfg-target-5f97368/debug/rex-cfg}"
CFG_PIN="5f2f6fd7b371efe1d2c3aa60f730905d0434cf55274ac80f64873d1f25b4899b"
SRC11="${1:-$HOME/rds-scratch/xe-a-evidencia-v11}"
SRCM="${2:-$HOME/rds-scratch/xe-a-evidencia-m3c}"
OUT="${3:-$HOME/rds-scratch/xe-a-rexcfg-cruzamento-v2}"
mkdir -p "$OUT"
SONIC="$HOME/.retrodev/rex_corpus_a_work/staged/Sonic the Hedgehog (USA, Europe).bin"
SOR="$HOME/.retrodev/rex_corpus_a_holdout/staged/Streets of Rage (World) (Translated PtBr)__Streets of Rage (World).gen"
SONIC_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
SOR_PIN="304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d"
PHEL_MEM_PIN="842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6"

[ -x "$CFG" ] || { echo "ABORT: rex-cfg v2 sen construír ($CFG; V0 do conxelado)"; exit 1; }
[ "$(sha256sum "$CFG" | cut -d' ' -f1)" = "$CFG_PIN" ] || { echo "ABORT: rex-cfg diverxe do pin 5f973689"; exit 1; }
[ "$(sha256sum "$SONIC" | cut -d' ' -f1)" = "$SONIC_PIN" ] || { echo "ABORT: Sonic diverxe do pin"; exit 1; }
[ "$(sha256sum "$SOR" | cut -d' ' -f1)" = "$SOR_PIN" ] || { echo "ABORT: SoR diverxe do pin"; exit 1; }
for SRC in "$SRC11" "$SRCM"; do
  PHEL_MEM="$SRC/Phelios (USA).gen"
  [ -f "$PHEL_MEM" ] || { echo "ABORT: membro Phelios non está en \$SRC ($PHEL_MEM)"; exit 1; }
  [ "$(sha256sum "$PHEL_MEM" | cut -d' ' -f1)" = "$PHEL_MEM_PIN" ] || { echo "ABORT: membro Phelios diverxe do pin §6"; exit 1; }
done

# pins das dúas series (rompe se calquera serie muda)
verifica_pin() { # dir ficheiro pin
  local got; got="$(sha256sum "$1/$2.jsonl" | cut -d' ' -f1)"
  if [ "$got" = "$3" ]; then echo "pin-ok $2"; else echo "ABORT $1/$2.jsonl: $got != $3"; return 1; fi
}
fai=0
echo "===== PINS serie §6.1 (v11) ====="
verifica_pin "$SRC11" sonic-3082 2ec2fd903e4bb28e88c6091a7b71e2f8d9dc894e03c83ab2248b07304ec1687a || fai=$((fai+1))
verifica_pin "$SRC11" sonic-1364 793c5681226e0d38b7514f744170f05e2a62c27c9173d2a2f774080bd0d2aaae || fai=$((fai+1))
verifica_pin "$SRC11" sonic-51BC 8ffc94a508261382e622d066646f60fd1fb7512bbe6b26d069bcfe34753ecfb3 || fai=$((fai+1))
verifica_pin "$SRC11" sor-16D2   b4b98b95626a972e7922bc5c81fd60b6ff209f6e0428aaae0235b88a19115317 || fai=$((fai+1))
verifica_pin "$SRC11" sor-087FC  bb6b578173f125805d712e2fda8b63ba82a99193b6ca78348dfaf495a8cd5839 || fai=$((fai+1))
verifica_pin "$SRC11" sor-08842  c952c42cb918f15c71eef0393c1b63da2da70e43ed1722bf0d18a6d883fc6544 || fai=$((fai+1))
verifica_pin "$SRC11" sor-10636  ad3718aff65e507e066a3fb61052d1b1f372c13dd7f29c064810f16b61eda8ad || fai=$((fai+1))
verifica_pin "$SRC11" sor-10852  ecf98bd5c1292d2ef9df54cba83a8ef497ea3fd40ab5b07199d4bff54c872ef4 || fai=$((fai+1))
verifica_pin "$SRC11" sor-119B4  7d4ed6e57da5ab4fbc6d380af24539852b4f0e73e2945bf69310d4ca5f0f691c || fai=$((fai+1))
verifica_pin "$SRC11" phelios-varredura 07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694 || fai=$((fai+1))
echo "===== PINS serie §8.6 (m3c, par-declarado) ====="
verifica_pin "$SRCM" sonic-3082 7d8f9d57c1962836cc9833af9415128bc8fafe7d5761d3e0b2c71c17b74bfa91 || fai=$((fai+1))
verifica_pin "$SRCM" sonic-1364 6b41ef5fee177097ab030951dd4a27bf2bbc92689f147f41f381af51299eea0a || fai=$((fai+1))
verifica_pin "$SRCM" sonic-51BC 863bd833fbea6dcddfb7d20748949c300112051310668e2fd22c3e4027cf3b56 || fai=$((fai+1))
verifica_pin "$SRCM" sor-16D2   2ba860227b551727c8e0e802eef3e5b69674222bf06eb8259b2147a8ecf8b7d5 || fai=$((fai+1))
verifica_pin "$SRCM" sor-087FC  27d90c82d94395fbdfa3b53467b99f24660d7b5d00a895f5be0214c907b27692 || fai=$((fai+1))
verifica_pin "$SRCM" sor-08842  059495f29d6fe24aaa7b028c1e2a40f24de6df7b697b19833ddc985f34b16426 || fai=$((fai+1))
verifica_pin "$SRCM" sor-10636  ef8d2f3411781320def23b9dc907eee5655b99458b68f937a8fc223ae0630104 || fai=$((fai+1))
verifica_pin "$SRCM" sor-10852  d1e976a47e64dfd8224ecaa7c4ae6a52d5f9cac2bc8a11993a3d5da8f9f1aefa || fai=$((fai+1))
verifica_pin "$SRCM" sor-119B4  f33a4118fc4ff4eedb52c7c6a0835242cea0ab9f26b108808982c0c835f7b056 || fai=$((fai+1))
verifica_pin "$SRCM" phelios-varredura 07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694 || fai=$((fai+1))
[ "$fai" = 0 ] || { echo "ABORT: algunha serie non coincide cos seus pins"; exit 1; }

# V3: dixestos conxelados en EXPECTATIONS-CRUZAMENTO-REXCFG-V2-A.md §1
digest_espera() {
  case "$1" in
    phelios-varredura) echo 15c2fff2bd05182646dee7f9463105b6d271d8e6ff9a66acc7963620b02aec9d ;;
    sonic-1364)        echo 9129ddd14d330d69a39e0c217a3dc6c60572fec0726abaefda4124e17bec9e3b ;;
    sonic-3082)        echo 8c85d3adb3f93f666cbab8bc561ad6dcb2592903430ffe7f762a739c46fde0bc ;;
    sonic-51BC)        echo b19e3cefdc791ef05fe00b746fa05080a79a4d0186824773b407666f5ff31d76 ;;
    sor-087FC)         echo 3d9c3d50b890125321ab25252b1d2b1f297bf142fd4195ff55ca98f51c68cf29 ;;
    sor-08842)         echo 3e343a4a7e80e07a6da9d0c0cd9f494a2b9f26ff3977140d39c4200678ef8b13 ;;
    sor-10636)         echo 03a0f82021dcc9245255d20cf883fff74d385a153c1b19e316719b213d753923 ;;
    sor-10852)         echo d24bba28a96759dadc5188473b01f8d7aa9726a92472b5ed00b5d4691a40ad65 ;;
    sor-119B4)         echo 57907a09fd3b0a19ed834e90b177fdfe6f0071e60550d09a126d5d817496d34e ;;
    sor-16D2)          echo 91e3045830616e5f607c9e3a4cc3eacaace83aedec5bd4ee226deb4b25e0f830 ;;
  esac
}
medir_digest() { # ficheiro-rexcfg
  python3 - "$1" <<'PY'
import json,sys,hashlib
d=json.load(open(sys.argv[1],encoding='utf-8'))
s=';'.join(f"{x['endereco']}:{x['veredito']}" for x in d['sitios'])
print(hashlib.sha256(s.encode()).hexdigest())
print(d.get('schema','(sen campo)'), file=sys.stderr)
PY
}

fai=0
echo "===== CRUZAMENTO rex-cfg/v2 (5f973689, bin $CFG_PIN) ====="
run() { # serie dir nome imaxe
  local serie="$1" src="$2" n="$3" imaxe="$4"
  python3 "$A_DIR/verificar-sitios.py" --rex-cfg "$CFG" --jsonl "$src/$n.jsonl" \
      --bin "$imaxe" --out "$OUT/$serie-$n.rexcfg.json" >"$OUT/$serie-$n.out" 2>&1
  local rc=$?
  local got; got="$(medir_digest "$OUT/$serie-$n.rexcfg.json" 2>>"$OUT/schema.txt")"
  local esp; esp="$(digest_espera "$n")"
  if [ "$rc" = 0 ] && [ "$got" = "$esp" ]; then
    echo "OK-cadea $serie $n (digest==$got)"
  else
    echo "FALLO-cadea $serie $n rc=$rc digest: medido=$got esperado=$esp"
    fai=$((fai+1))
  fi
}
for serie in v11 m3c; do
  [ "$serie" = v11 ] && src="$SRC11" || src="$SRCM"
  run "$serie" "$src" sonic-3082 "$SONIC"
  run "$serie" "$src" sonic-1364 "$SONIC"
  run "$serie" "$src" sonic-51BC "$SONIC"
  run "$serie" "$src" sor-16D2 "$SOR"
  run "$serie" "$src" sor-087FC "$SOR"
  run "$serie" "$src" sor-08842 "$SOR"
  run "$serie" "$src" sor-10636 "$SOR"
  run "$serie" "$src" sor-10852 "$SOR"
  run "$serie" "$src" sor-119B4 "$SOR"
  run "$serie" "$src" phelios-varredura "$src/Phelios (USA).gen"
done

echo "===== NEGATIVO §5: identidade do obxecto trocada (serie m3c) ====="
python3 "$A_DIR/verificar-sitios.py" --rex-cfg "$CFG" --jsonl "$SRCM/sonic-3082.jsonl" \
    --bin "$SOR" --out "$OUT/neg-identidade.rexcfg.json" >"$OUT/neg-identidade.txt" 2>&1
rc=$?
if [ "$rc" = 2 ]; then echo "OK   neg-identidade: rc=2 sen analizar ($(tail -1 "$OUT/neg-identidade.txt"))";
else echo "FALLO neg-identidade: esperaba rc=2, obtido rc=$rc"; fai=$((fai+1)); fi

echo "===== schema dos obxectos consumidos (V5: rex-cfg/v2) ====="
sort -u "$OUT/schema.txt" 2>/dev/null

echo "===== SHA dos exports ====="
( cd "$OUT" && sha256sum *.rexcfg.json )

echo "===== TOTAIS ====="
echo "fallos=$fai"
[ "$fai" = 0 ] || exit 1
exit 0
