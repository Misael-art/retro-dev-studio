#!/usr/bin/env bash
# Fase 6 (letra A): cadeas reais en Sonic 1 e SoR + negativos §6 + mostra
# reservada Phelios. Non escribe dentro da árbore versionada: os artefactos
# van a [dir-saida] (por defecto ~/rds-scratch/xe-a-evidencia) e este script
# imprime o log integral que debe conservarse como evidencia bruta.
#
# ROMs, bytes comerciais e saídas decodificadas NON se versionan (§7).
# Uso: bash executar-evidencia-A.sh [dir-saida]
set -uo pipefail
REPO="${REX_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
BIN="${REX_CHAIN_BIN:-$HOME/rds-scratch/chain-target/debug/rex-chain}"
OUT="${1:-$HOME/rds-scratch/xe-a-evidencia}"
mkdir -p "$OUT"
SONIC="$HOME/.retrodev/rex_corpus_a_work/staged/Sonic the Hedgehog (USA, Europe).bin"
SOR="$HOME/.retrodev/rex_corpus_a_holdout/staged/Streets of Rage (World) (Translated PtBr)__Streets of Rage (World).gen"
SONIC_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
SOR_PIN="304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d"
RUTINA_PIN="e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90"

[ -x "$BIN" ] || { echo "ABORT: rex-chain sen construír ($BIN)"; exit 1; }
[ "$(sha256sum "$SONIC" | cut -d' ' -f1)" = "$SONIC_PIN" ] || { echo "ABORT: Sonic diverxe do pin §0"; exit 1; }
[ "$(sha256sum "$SOR" | cut -d' ' -f1)" = "$SOR_PIN" ] || { echo "ABORT: SoR diverxe do pin §0"; exit 1; }

fai=0
check() { # nome rc_esperado rc_obtido detalle
  if [ "$2" = "$3" ]; then echo "OK   $1: rc=$3 ($4)"; else echo "FALLO $1: esperaba rc=$2, obtido rc=$3 ($4)"; fai=$((fai+1)); fi; }

echo "===== A/B. CADENAS REAIS (xanela §5/§7 + par declarado §5.6) ====="
# Dous rexistros por sitio, como conxelou RESPOSTA-D-A §5.6/§7.2:
#  - `.xanela.jsonl`: medir SEN declaración — o efecto honesto das gardas
#    sobre datos reais (promoción só cando o recto está totalmente modelado
#    e ten candidato único).
#  - `-$n.jsonl`: emparellamento **declarado** (`--chamada-sitio`), cos
#    sitios da serie histórica §6.3 (medición propia de A, non descuberto).
#    Este é o rexistro principal revalidable elo a elo.
run_cadea() { # imaxe rom-size prefixo nome carga destino chamada
  local img="$1" rom="$2" pref="$3" n="$4" carga="$5" destino="$6" ch="$7"
  if ! "$BIN" construir-cadea --imaxe "$img" --rom-size "$rom" --carga-sitio "$carga" \
      --destino-sitio "$destino" --rutina-lonxitude 160 --limite-max-saida 200000 --limite-orzamento 2000000 \
      > "$OUT/$pref-$n.xanela.jsonl" 2>"$OUT/$pref-$n.xanela.err"; then
    echo "FALLO xanela-$pref-$n: $(cat "$OUT/$pref-$n.xanela.err")"; fai=$((fai+1)); return
  fi
  python3 "$REPO/scripts/rex_profiles/parallel_recovery_20261004/a/resumo-xanela.py" "$OUT/$pref-$n.xanela.jsonl"
  if ! "$BIN" construir-cadea --imaxe "$img" --rom-size "$rom" --carga-sitio "$carga" \
      --destino-sitio "$destino" --chamada-sitio "$ch" \
      --rutina-lonxitude 160 --limite-max-saida 200000 --limite-orzamento 2000000 \
      > "$OUT/$pref-$n.jsonl" 2>"$OUT/$pref-$n.construir.err"; then
    echo "FALLO construido-$pref-$n: $(cat "$OUT/$pref-$n.construir.err")"; fai=$((fai+1)); return
  fi
  "$BIN" revalidar --imaxe "$img" --cadea "$OUT/$pref-$n.jsonl" > "$OUT/$pref-$n.revalidar.txt" 2>&1
  local rc=$?
  check "revalidar-$pref-$n" 0 "$rc" "$(tail -1 "$OUT/$pref-$n.revalidar.txt")"
  local sha; sha="$(python3 -c "import json;print(json.load(open('$OUT/$pref-$n.jsonl'))['rutina_sha256'])")"
  if [ "$sha" = "$RUTINA_PIN" ]; then echo "OK   rutina-$pref-$n sha==pin e8028514…"; else echo "REXISTRADO rutina-$pref-$n sha=$sha != pin $RUTINA_PIN (non se axusta)"; fi
  echo "     cadea: $(sha256sum "$OUT/$pref-$n.jsonl" | cut -d' ' -f1)  confianza=$(python3 -c "import json;print(json.load(open('$OUT/$pref-$n.jsonl'))['confianza'])")  par-declarado=$(python3 -c "import json;print(any(l=='par-declarado' for l in json.load(open('$OUT/$pref-$n.jsonl'))['limitacions']))")"
}
run_cadea "$SONIC" 0x100000 sonic 3082 0x03082 0x03088 0x0308E
run_cadea "$SONIC" 0x100000 sonic 1364 0x01364 0x0136A 0x01370
run_cadea "$SONIC" 0x100000 sonic 51BC 0x051BC 0x051C2 0x051C6
run_cadea "$SOR" 0x80000 sor 16D2 0x016D2 0x016D8 0x016DE
run_cadea "$SOR" 0x80000 sor 087FC 0x087FC 0x08802 0x08808
run_cadea "$SOR" 0x80000 sor 08842 0x08842 0x08848 0x0884E
run_cadea "$SOR" 0x80000 sor 10636 0x10636 0x1063C 0x10642
run_cadea "$SOR" 0x80000 sor 10852 0x10852 0x10858 0x1085E
run_cadea "$SOR" 0x80000 sor 119B4 0x119B4 0x119BA 0x119C0

echo "===== C. NEGATIVOS (§6) sobre a cadea sonic-3082 (par declarado) ====="
N="$OUT/sonic-3082.jsonl"

# C1. imaxe equivocada: cadea Sonic revalidada contra SoR → ROM-DIVERXENCIA (3)
"$BIN" revalidar --imaxe "$SOR" --cadea "$N" >"$OUT/neg-imaxe.txt" 2>&1
check "neg-imaxe-trocada" 3 "$?" "identidade detén antes de decodificar"

# C2. bytes do sitio alterados na CADEA (declaración 41F9→42F9) → SITIO (5)
python3 - "$N" "$OUT/neg-sitio.jsonl" <<'PY'
import json, sys, re
c = open(sys.argv[1], encoding="utf-8").read()
assert '"carga_bytes":"41F90003F09A"' in c
open(sys.argv[2], "w", encoding="utf-8").write(c.replace('"carga_bytes":"41F90003F09A"', '"carga_bytes":"42F90003F09A"'))
PY
"$BIN" revalidar --imaxe "$SONIC" --cadea "$OUT/neg-sitio.jsonl" >"$OUT/neg-sitio.txt" 2>&1
check "neg-bytes-sitio" 5 "$?" "bytes declarados != bytes da imaxe"

# C3. alvo declarado 0x0189C→0x0189E → ALVO (7)
python3 - "$N" "$OUT/neg-alvo.jsonl" <<'PY'
import json, sys
o = json.loads(open(sys.argv[1], encoding="utf-8").read())
assert o["chamada_alvo"] == "0x00189C", o["chamada_alvo"]
o["chamada_alvo"] = "0x00189E"
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
PY
"$BIN" revalidar --imaxe "$SONIC" --cadea "$OUT/neg-alvo.jsonl" >"$OUT/neg-alvo.txt" 2>&1
check "neg-alvo-mutado" 7 "$?" "aritmética da chamada non coincide"

# C4. argumento lea declarado 0x3F09A→0x3F09B (fluxo coherente para que o elo
#     mapper non o deteña antes) → ARGUMENTO (6)
python3 - "$N" "$OUT/neg-arg.jsonl" <<'PY'
import json, sys
o = json.loads(open(sys.argv[1], encoding="utf-8").read())
assert o["carga_operando"] == "0x03F09A" and o["fluxo_cpu"] == "0x03F09A"
o["carga_operando"] = "0x03F09B"
o["fluxo_cpu"] = "0x03F09B"
o["fluxo_offset"] = o["fluxo_offset"] + 1  # tradución md-linear coherente
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
PY
"$BIN" revalidar --imaxe "$SONIC" --cadea "$OUT/neg-arg.jsonl" >"$OUT/neg-arg.txt" 2>&1
check "neg-argumento-mutado" 6 "$?" "operando medido != operando declarado"

# C5. stream truncada: tramo = bytes_consumidos-1 → INCONCLUSIVE (10), nunca OK
python3 - "$N" "$OUT/neg-trun.jsonl" <<'PY'
import json, sys
o = json.loads(open(sys.argv[1], encoding="utf-8").read())
o["tramo_entrada"] = o["bytes_consumidos"] - 1
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
PY
"$BIN" revalidar --imaxe "$SONIC" --cadea "$OUT/neg-trun.jsonl" >"$OUT/neg-trun.txt" 2>&1
check "neg-stream-truncada" 10 "$?" "decoder Truncated → INCONCLUSIVE-TRUNCADA"

# C6. mapper incorrecto: rom_size=0x80000 sobre Sonic → MAPPER (4), sen clampa
python3 - "$N" "$OUT/neg-mapper.jsonl" <<'PY'
import json, sys
o = json.loads(open(sys.argv[1], encoding="utf-8").read())
o["estado_mapper"] = "rom_size=0x80000"
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
PY
"$BIN" revalidar --imaxe "$SONIC" --cadea "$OUT/neg-mapper.jsonl" >"$OUT/neg-mapper.txt" 2>&1
RC=$?; OUT1="$(tail -1 "$OUT/neg-mapper.txt")"
if [ "$RC" = 4 ]; then echo "OK   neg-mapper: rc=4 ($OUT1)"; else echo "FALLO neg-mapper: rc=$RC ($OUT1)"; fai=$((fai+1)); fi

# C7. referencia externa ausente → SKIP rc=3 (executa so o script de fase 5
#     cunha cache baleira; non toca ~/.cache real)
REX_CODEC_CACHE="$OUT/cache-baleira" bash "$REPO/scripts/rex_profiles/parallel_recovery_20261004/a/comparar-oraculo-streams.sh" "$OUT/neg-oraculo" >"$OUT/neg-oraculo.txt" 2>&1
check "neg-oraculo-ausente" 3 "$?" "modo comparativo queda SKIP/BLOCKED con motivo"

echo "===== D. MOSTRA RESERVADA PHELIOS (§1) ====="
PHEL_ZIP=$(find /home/misael/emulation -type f -iname 'Phelios (USA)*.zip' 2>/dev/null | head -1)
[ -n "${PHEL_ZIP:-}" ] || { echo "PENDENCIA: contedor Phelios non atopado en ~/emulation"; fai=$((fai+1)); }
if [ -n "${PHEL_ZIP:-}" ]; then
  PSHA=$(sha256sum "$PHEL_ZIP" | cut -d' ' -f1)
  echo "contedor: $PHEL_ZIP"
  echo "sha256:   $PSHA  (pin §1: 67e09944a0ec6da02d7a32ebfac4f0664dd8ff8086493bbe7e4218decf8b9faf)"
  if [ "$PSHA" != "67e09944a0ec6da02d7a32ebfac4f0664dd8ff8086493bbe7e4218decf8b9faf" ]; then
    echo "ABORT mostra reservada: contedor diverxe do pin §1"; fai=$((fai+1))
  else
    unzip -l "$PHEL_ZIP"
    unzip -t "$PHEL_ZIP" >/dev/null && echo "CRC-32 do membro verificado (unzip -t ok)"
    PHELIOS="$OUT/Phelios (USA).gen"
    unzip -p "$PHEL_ZIP" "Phelios (USA).gen" > "$PHELIOS"
    echo "membro extraido (temporal, fora da árbore): $(stat -c%s "$PHELIOS") B  sha256=$(sha256sum "$PHELIOS" | cut -d' ' -f1)"
    "$BIN" detectar --imaxe "$PHELIOS" --rom-size 0x80000 --rutina-lonxitude 160 --limite-max-saida 200000 --limite-orzamento 2000000 > "$OUT/phelios-varredura.jsonl" 2>"$OUT/phelios-varredura.resumo.txt"
    RC=$?
    echo "detectar rc=$RC"
    echo "resumo bruto: $(cat "$OUT/phelios-varredura.resumo.txt")"
    if [ -s "$OUT/phelios-varredura.jsonl" ]; then
      head -1 "$OUT/phelios-varredura.jsonl" | python3 -c "import json,sys; o=json.load(sys.stdin); print('primeira cadea varrida:', o['carga_sitio'], o['confianza'], o['orixe'][0])"
      # revalida a primeira cadea emitida (meta: >=1 tamén aquí, se a hai)
      "$BIN" revalidar --imaxe "$PHELIOS" --cadea "$OUT/phelios-varredura.jsonl" --liña 1 > "$OUT/phelios-revalidar.txt" 2>&1
      echo "revalidar-phelios-1 rc=$?  $(tail -1 "$OUT/phelios-revalidar.txt")"
    else
      echo "INVENTARIO HONESTO: 0 cadeas na mostra Phelios coa gramática conxelada (non e fallo do detector; §1)"
    fi
  fi
fi

echo "===== TOTAIS ====="
echo "fallos=$fai"
[ "$fai" = 0 ] || exit 1
exit 0
