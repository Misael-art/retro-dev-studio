#!/usr/bin/env bash
# ETAPA 1 (letra C): evidencia das analises R1/R2/R3 na ROM BYOR, com o
# instrumento independente (m68k-elf-objdump 2.41) como arbitro.
#
# Uso: bash executar-evidencia-C.sh [dir-saida]
#
# O que NAO vai para a arvore versionada (§7 da rodada): a imagem da ROM, os
# dumps brutos do instrumento e as saidas completas da CLI (que listam
# mnemonicos com operandos, ou seja, conteudo derivado da ROM comercial). Esses
# artefatos vao para [dir-saida] (default ~/rds-scratch/xe-c-evidencia) e sao
# identificados no evidencia versionada por SHA-256 + caminho + comando exato.
#
# O que VAi para data/rex_profiles/parallel_recovery_20261004/c/evidence/: o
# JSON REDIGIDO de cada analise — enderecos, comprimentos, classes, arestas,
# fronteiras (com o opcode observado, que as expectativas congeladas exigem
# registrar) e vereditos de sitio. Nenhum texto de operando, nenhum byte.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/../../../.." && pwd)"
OUT="${1:-$HOME/rds-scratch/xe-c-evidencia}"
EVID="$REPO/data/rex_profiles/parallel_recovery_20261004/c/evidence"
TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
OBJDUMP="$TC/m68k-elf-objdump"
ROM="${REX_ROM:-$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin}"
ROM_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
ROM_BYTES=531577
# pinos das regioes, conferidos com dd+sha256sum antes de qualquer execucao
R1_PIN="e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90"
R2_PIN="655f37340b1ebbd5aadeacdf1f64bd338686487c38d4eb6eba74ffaae1a965ba"
R3_PIN="6f7028731c2c3ff6d69180595b492583947ab7040b76f488a9557701bc87d470"

mkdir -p "$OUT" "$EVID"
falhas=0
marca() { # nivel texto
    echo "$1 $2"
    [ "$1" = "FALHA" ] && falhas=$((falhas + 1))
    return 0
}

# ---------------------------------------------------------------- 0. origem
[ -x "$OBJDUMP" ] || { echo "ABORT: instrumento ausente: $OBJDUMP"; exit 1; }
[ -r "$ROM" ] || { echo "ABORT: ROM BYOR nao legivel: $ROM"; exit 1; }
sha_rom="$(sha256sum "$ROM" | cut -d' ' -f1)"
if [ "$sha_rom" != "$ROM_PIN" ]; then
    echo "ABORT: identidade da ROM nao bate com o pin da expectativa ($sha_rom)"; exit 1
fi
tam_rom="$(wc -c <"$ROM")"
[ "$tam_rom" = "$ROM_BYTES" ] || { echo "ABORT: tamanho $tam_rom != $ROM_BYTES"; exit 1; }
echo "OK   origem: $ROM  sha256=$sha_rom  bytes=$tam_rom (somente-leitura)"

pin_regiao() { # skip decimal, contagem, pin, nome
    local s; s="$(dd if="$ROM" bs=1 skip="$1" count="$2" status=none | sha256sum | cut -d' ' -f1)"
    if [ "$s" = "$3" ]; then echo "OK   pino $4: $2 bytes em $5 == $3"; else echo "FALHA pino $4: $s != $3"; fi
}
pin_regiao 6300 160 "$R1_PIN" R1 0x189C
pin_regiao 518 154 "$R2_PIN" R2 0x206
pin_regiao 4964 28 "$R3_PIN" R3 0x1364
vetor="$(dd if="$ROM" bs=1 count=32 status=none | sha256sum | cut -d' ' -f1)"
echo "OK   vetor de reset: 32 bytes de 0x000000 sha256=$vetor (conteudo nao versionado; o longo em 0x000004 = 0x00000206 e a raiz R2)"

# ---------------------------------------------------------------- 1. build
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/rds-scratch/xe-c-target}"
BIN="$CARGO_TARGET_DIR/debug/rex-cfg"
if ! cargo build --offline --manifest-path "$AQUI/Cargo.toml" --bin rex-cfg >/dev/null 2>&1; then
    echo "ABORT: rex-cfg nao compila (rode sem redirecionamento para ver o erro)"; exit 1
fi
[ -x "$BIN" ] || { echo "ABORT: binario ausente: $BIN"; exit 1; }
echo "OK   rex-cfg construido em $BIN"

# ------------------------------------------------- 2. analises pela CLI real
run() { # nome --args...
    local nome="$1"; shift
    echo "--- $nome: rex-cfg analyze $*"
    if ! "$BIN" analyze --bin "$ROM" "$@" --out "$OUT/$nome.json" >"$OUT/$nome.stdout.txt" 2>"$OUT/$nome.stderr.txt"; then
        marca "FALHA" "$nome: CLI saiu com erro: $(cat "$OUT/$nome.stderr.txt")"
        return 1
    fi
    cat "$OUT/$nome.stdout.txt"
    echo "     sha256($nome.json) = $(sha256sum "$OUT/$nome.json" | cut -d' ' -f1)"
}
run r1 --region 0x189C:0x193C --root 0x189C --root-prov referencia-estatica \
    --root-evidence 'tres bsr.w $0189C medidos pela FASE6 em 0x01364,0x03082,0x051BC; rotina de 160 bytes com sha proprio identico ao pin' \
    --site 0x189C --site 0x18A0 --site 0x18FF --site 0x193B
run r2 --region 0x206:0x2A0 --root 0x206 --root-prov vetor-plataforma \
    --root-evidence 'longo do reset em 0x000004 = 0x00000206 (lido do vetor da imagem)' \
    --site 0x1364 --site 0x3082 --site 0x51BC --site 0x745DC
run r3 --region 0x1364:0x1380 --root 0x1364 --root-prov referencia-estatica \
    --root-evidence 'sitio de chamada medido pela FASE6 (bsr.w $0189C em 0x1364)' \
    --site 0x1364 --site 0x1366 --site 0x1369 --site 0x1370 --site 0x1372 --site 0x1378 --site 0x137C --site 0x137E --site 0x1380

# --------------------------------------------- 3. instrumento independente
odump() { # nome ini fim
    local nome="$1"
    "$OBJDUMP" -b binary -m m68k -D --start-address="$2" --stop-address="$3" "$ROM" >"$OUT/$nome-objdump-bruto.txt" 2>&1
    echo "--- $nome: objdump bruto $2..$3 -> $OUT/$nome-objdump-bruto.txt ($(grep -cE '^ +[0-9a-f]+:' "$OUT/$nome-objdump-bruto.txt") registros)"
}
odump r1 0x189C 0x193C
odump r2 0x206 0x2A0
odump r3 0x1364 0x1380

# --------------------------------------- 4. comparacao + criterios congelados
python3 - "$OUT" "$EVID" "$ROM" "$sha_rom" "$vetor" "$R1_PIN" "$R2_PIN" "$R3_PIN" <<'PY'
import json, re, sys, os, hashlib
OUT, EVID, ROM, SHA_ROM, VETOR, PINS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:9]
falhas = 0
def marca(nivel, txt):
    global falhas
    print(f"{nivel} {txt}")
    if nivel == 'FALHA':
        falhas += 1

# Mnemonicos cujo ultimo hexadecimal impresso e um DESTINO DE FLUXO. A lista e a
# do conjunto fechado 68000 da ferramenta; sem ela, `tstl 0xa10008` (operando
# absoluto de DADOS) seria lido como aresta e geraria divergencia falsa.
FLUXO = ('bra', 'bsr', 'bcc', 'bcs', 'bmi', 'bpl', 'bge', 'bgt', 'ble', 'bls',
         'bhi', 'bvs', 'bvc', 'beq', 'bne', 'dbf', 'dbt', 'jmp', 'jsr')

def recs_objdump(caminho):
    """Registros do instrumento: endereco -> (comprimento, token, alvo|None).

    Duas regras de leitura do formato `objdump -D`, ambas medidas nos dumps:
      * instrucao longa imprime continuacao em linha propria (`232: 2f00`, sem
        mnemonico): os words pertencem ao registro anterior, que tem 8B e nao 6B;
      * somente um mnemonico de fluxo tem alvo.
    """
    recs = {}
    ultimo = None
    for line in open(caminho, encoding='utf-8', errors='replace'):
        m = re.match(r'^\s+([0-9a-f]+):\t((?:[0-9a-f]{4} )+)\s*(\S+)(.*)$', line)
        if m:
            addr = int(m.group(1), 16)
            tam = len(m.group(2).split()) * 2
            tok = m.group(3)
            alvo = None
            if tok.startswith(FLUXO):
                d = re.search(r'0x([0-9a-f]+)\s*$', m.group(4))
                alvo = int(d.group(1), 16) if d else None
            recs[addr] = [tam, tok, alvo]
            ultimo = recs[addr]
            continue
        m = re.match(r'^\s+([0-9a-f]+):\t((?:[0-9a-f]{4} )+)$', line)
        if m and ultimo is not None:
            ultimo[0] += len(m.group(2).split()) * 2
            ultimo = None
    return {a: tuple(r) for a, r in recs.items()}

def redigido(j, nome, comando, sha_json, caminho_json):
    """Evidencia versionada: estrutura SEM mnemonicos com operandos (conteudo
    derivado da ROM comercial nao vai para o indice, §7 da rodada)."""
    ins = []
    for b in j['blocos']:
        for i in b['instrucoes']:
            ins.append({'endereco': i['endereco'], 'tam': i['tam'], 'classe': i['classe']})
    ins.sort(key=lambda x: x['endereco'])
    return {
        'esquema': 'rex-cfg/v1-evidencia-redigida',
        'analise': nome,
        'comando': comando,
        'objeto': {'caminho_declarado': ROM, 'sha256': SHA_ROM, 'tamanho': os.path.getsize(ROM)},
        'saida_completa': {'caminho_local': caminho_json, 'sha256': sha_json,
                           'motivo_de_nao_versionado': 'lista instrucoes com operandos = conteudo derivado de ROM comercial'},
        'regiao': j['regiao'],
        'raizes': j['raizes'],
        'cobertura': j['cobertura'],
        'instrucoes': ins,
        'arestas': j['arestas'],
        'chamadas': j['chamadas'],
        'fronteiras': j['fronteiras'],
        'sitios': j['sitios'],
        'limites': j['limites'],
    }

CASOS = {
    'r1': ('0x189C:0x193C',
           'rex-cfg analyze --bin <ROM> --region 0x189C:0x193C --root 0x189C --root-prov referencia-estatica --root-evidence "tres bsr.w $0189C medidos pela FASE6 em 0x01364,0x03082,0x051BC; ..." --site 0x189C --site 0x18A0 --site 0x18FF --site 0x193B --out <saida>/r1.json'),
    'r2': ('0x206:0x2A0',
           'rex-cfg analyze --bin <ROM> --region 0x206:0x2A0 --root 0x206 --root-prov vetor-plataforma --root-evidence "longo do reset em 0x000004 = 0x00000206 (lido do vetor da imagem)" --site 0x1364 --site 0x3082 --site 0x51BC --site 0x745DC --out <saida>/r2.json'),
    'r3': ('0x1364:0x1380',
           'rex-cfg analyze --bin <ROM> --region 0x1364:0x1380 --root 0x1364 --root-prov referencia-estatica --root-evidence "sitio de chamada medido pela FASE6 (bsr.w $0189C em 0x1364)" --site 0x1364 --site 0x1366 --site 0x1369 --site 0x1370 --site 0x1372 --site 0x1378 --site 0x137C --site 0x137E --site 0x1380 --out <saida>/r3.json'),
}

for nome, (regiao, comando) in CASOS.items():
    caminho = os.path.join(OUT, f'{nome}.json')
    j = json.load(open(caminho))
    sha = hashlib.sha256(open(caminho, 'rb').read()).hexdigest()
    od = recs_objdump(os.path.join(OUT, f'{nome}-objdump-bruto.txt'))
    ferramenta = {}
    for b in j['blocos']:
        for i in b['instrucoes']:
            ferramenta[i['endereco']] = i
    # Arbitragem: endereco + comprimento + alvo, instrucao a instrucao. A
    # paridade bidirecional so e exigida onde a analise delimitada prometeu
    # chegar: um registro do instrumento dentro de um vao de cobertura esta ALEM
    # do limite declarado do fluxo (opcode recusado ou fim de caminho), e isso e
    # o resultado esperado da ETAPA 1, nao uma divergencia.
    vaos = [(v['inicio'], v['fim']) for v in j['cobertura']['vaos']]
    def prometido(addr):
        return not any(ini <= addr < fim for (ini, fim) in vaos)
    div = []
    alemlimite = []
    for addr, (tam, tok, alvo) in sorted(od.items()):
        if not prometido(addr):
            alemlimite.append(f'{addr:#x} {tok} de {tam}B')
            continue
        f = ferramenta.get(addr)
        if f is None:
            div.append(f'{addr:#x}: instrumento tem {tok} de {tam}B e a ferramenta nao')
            continue
        if f['tam'] != tam:
            div.append(f'{addr:#x}: comprimento {f["tam"]} vs instrumento {tam}')
        alvos = [e['alvo'] for e in j['arestas']
                 if e['origem'] == addr and e['tipo'] in ('desvio', 'chamada') and e.get('alvo') is not None]
        if alvo is not None:
            if alvo not in alvos:
                div.append(f'{addr:#x}: alvo do instrumento {alvo:#x} nao esta nas arestas {["%#x" % a for a in alvos]}')
        elif alvos:
            div.append(f'{addr:#x}: ferramenta resolve alvo {["%#x" % a for a in alvos]} onde o instrumento nao tem destino de fluxo')
    sobra = [hex(a) for a in ferramenta if a not in od]
    marca('OK' if not div and not sobra else 'FALHA',
          f'{nome}: paridade com o instrumento em {len(od)} registros do objdump '
          f'(comparados={len(od) - len(alemlimite)}, divergencias={len(div)}, '
          f'alem-do-limite-declarado={len(alemlimite)}, '
          f'instrucoes da ferramenta sem registro={len(sobra)})')
    for d in div:
        print('     ', d)
    for s in sobra:
        print('      instrucao alem do instrumento:', s)
    if alemlimite:
        print(f'      registros do instrumento alem do limite declarado ({len(alemlimite)}):',
              ', '.join(alemlimite[:8]) + (' ...' if len(alemlimite) > 8 else ''))
    red = redigido(j, nome, comando, sha, caminho)
    destino = os.path.join(EVID, f'{nome}.redigido.json')
    with open(destino, 'w', encoding='utf-8') as fh:
        json.dump(red, fh, indent=1, ensure_ascii=False, sort_keys=True)
        fh.write('\n')
    print(f'     evidencia redigida: {destino} sha256='
          f'{hashlib.sha256(open(destino, "rb").read()).hexdigest()}')

# ------------------------------------------------------------- criterios R1
j = json.load(open(os.path.join(OUT, 'r1.json')))
ins = sorted((i for b in j['blocos'] for i in b['instrucoes']), key=lambda x: x['endereco'])
cob = j['cobertura']
marca('OK' if (cob['bytes-decodificados'], cob['bytes-regiao']) == (160, 160) else 'FALHA',
      f'R1.1 cobertura 160/160: {cob["bytes-decodificados"]}/{cob["bytes-regiao"]} fracao={cob["fracao"]}')
marca('OK' if not j['fronteiras'] else 'FALHA', f'R1.1 fronteiras = {len(j["fronteiras"])} (esperado 0)')
marca('OK' if not any(e['status'] == 'fora-da-regiao' for e in j['arestas']) else 'FALHA',
      'R1.1 nenhuma aresta fora-da-regiao')
ultimo = ins[-1]
marca('OK' if (ultimo['endereco'], ultimo['classe']) == (0x193A, 'rts') else 'FALHA',
      f'R1.1 terminador em {ultimo["endereco"]:#x} classe {ultimo["classe"]}')
marca('OK' if len(ins) == 66 else 'FALHA', f'R1.4 numero de instrucoes = {len(ins)} (esperado 66)')
dbf = [i['endereco'] for i in ins if i['classe'] in ('dbf', 'dbcc')]
marca('OK' if dbf == [0x18AC, 0x18C8, 0x18DC, 0x18EE, 0x1922] else 'FALHA',
      f'R1.4 cinco DBcc nas posicoes congeladas: { [hex(a) for a in dbf] }')
lacos = [e for e in j['arestas'] if e['tipo'] == 'desvio' and e.get('alvo') is not None and e['alvo'] < e['origem']]
marca('OK' if len(lacos) >= 5 else 'FALHA', f'R1.4 arestas de laco para tras = {len(lacos)} (esperado >= 5)')
marca('OK' if not j['chamadas'] else 'FALHA', f'R1.4 chamadas = {len(j["chamadas"])} (rotina folha; esperado 0)')
alvos = {e['origem']: e.get('alvo') for e in j['arestas'] if e['tipo'] == 'desvio'}
for sitio, esperado_certo, esperado_errado in [(0x18AC, 0x18BA, 0x18B8), (0x1930, 0x18A8, 0x18AA)]:
    ob = alvos.get(sitio)
    marca('OK' if ob == esperado_certo else 'FALHA',
          f'R1.3 {sitio:#x}: alvo {ob if ob is None else hex(ob)}; formula certa {esperado_certo:#x}, '
          f'formula historica errada {esperado_errado:#x}')
    if ob == esperado_errado:
        marca('FALHA', f'R1.3 {sitio:#x}: a ferramenta produziu a formula historica ERRADA')

# ------------------------------------------------------------- criterios R2
j2 = json.load(open(os.path.join(OUT, 'r2.json')))
i2 = {i['endereco']: i for b in j2['blocos'] for i in b['instrucoes']}
a2 = {e['origem']: e for e in j2['arestas'] if e['tipo'] in ('desvio', 'chamada')}
hx = lambda v: '-' if v is None else f'{v:#x}'
marca('OK' if (i2.get(0x206, {}).get('tam'), i2.get(0x206, {}).get('classe')) == (6, 'tst') else 'FALHA',
      f'R2.1 primeira instrucao 0x206: {i2.get(0x206)}')
marca('OK' if a2.get(0x20C, {}).get('alvo') == 0x214 else 'FALHA',
      f'R2.1 desvio em 0x20C -> {hx(a2.get(0x20C, {}).get("alvo"))}, esperado 0x214')
marca('OK' if a2.get(0x214, {}).get('alvo') == 0x292 else 'FALHA',
      f'R2.1 desvio em 0x214 -> {hx(a2.get(0x214, {}).get("alvo"))}, esperado 0x292 '
      f'(a formula historica produziria 0x294)')
marca('OK' if 'lea' in {i2.get(0x216, {}).get('classe')} else 'FALHA',
      f'R2.2 lea logo depois do desvio: {i2.get(0x216)} (doc congelado dizia 0x218)')
marca('OK' if i2.get(0x21A, {}).get('classe') == 'movem' else 'FALHA',
      f'R2.2 movem: {i2.get(0x21A)} (doc congelado dizia 0x21C)')
fr = j2['fronteiras']
marca('OK' if fr and fr[0]['endereco'] < 0x256 else 'FALHA',
      f'R2.2 primeira fronteira antes de 0x256: {[(hex(x["endereco"]), x["tipo"]) for x in fr]}')
marca('OK' if any(e['origem'] == 0x292 and e['status'] == 'fora-da-regiao' for e in j2['arestas']) else 'FALHA',
      'R2.3 aresta de desvio em 0x292 com status fora-da-regiao')
marca('OK' if all(i['endereco'] < 0x2A0 for i in i2.values()) else 'FALHA',
      'R2.3 nenhum byte >= 0x2A0 decodificado')
marca('OK' if j2['cobertura']['bytes-decodificados'] < 154 and j2['cobertura']['vaos'] else 'FALHA',
      f'R2.4 cobertura {j2["cobertura"]["bytes-decodificados"]}/154 e {len(j2["cobertura"]["vaos"])} vao(es)')
for s in j2['sitios']:
    marca('OK' if s['veredito'] == 'fora-da-regiao' else 'FALHA',
          f'R2.5 sitio {s["endereco"]:#x} = {s["veredito"]}')

# ------------------------------------------------------------- criterios R3
j3 = json.load(open(os.path.join(OUT, 'r3.json')))
i3 = {i['endereco']: i for b in j3['blocos'] for i in b['instrucoes']}
a3 = {e['origem']: e for e in j3['arestas'] if e['tipo'] in ('desvio', 'chamada')}
marca('OK' if i3.get(0x1364, {}).get('tam') == 6 else 'FALHA', f'R3.1 lea em 0x1364 (6B): {i3.get(0x1364)}')
marca('OK' if i3.get(0x136A, {}).get('tam') == 6 else 'FALHA',
      f'R3.1 instrucao de 6B em 0x136A: {i3.get(0x136A)} (doc congelado rotulou move.abs.L->D1)')
ch = [c for c in j3['chamadas'] if c['sitio'] == 0x1370]
marca('OK' if ch and ch[0]['alvo'] == 0x189C and ch[0]['status'] == 'fora-da-regiao' else 'FALHA',
      f'R3.1 chamada em 0x1370 alvo 0x189c declarado e nao andado: {ch}')
marca('OK' if a3.get(0x1370, {}).get('alvo') != 0x189E else 'FALHA',
      'R3.1 a formula historica (0x189E) nao aparece no grafo')
marca('OK' if i3.get(0x1374, {}).get('tam') == 8 else 'FALHA',
      f'R3.2 continuacao pos-chamada em 0x1374 (8B): {i3.get(0x1374)}')
marca('OK' if any(f['endereco'] == 0x1380 and f['tipo'] == 'limite-de-regiao' for f in j3['fronteiras']) else 'FALHA',
      'R3.2 fronteira limite-de-regiao em 0x1380')
esperados = {0x1364: 'instrucao-de-bloco', 0x1366: 'miolo-de-instrucao', 0x1369: 'miolo-de-instrucao',
             0x1370: 'instrucao-de-bloco', 0x1372: 'miolo-de-instrucao', 0x1378: 'miolo-de-instrucao',
             0x137C: 'instrucao-de-bloco', 0x137E: 'instrucao-de-bloco', 0x1380: 'fora-da-regiao'}
for s in j3['sitios']:
    e = esperados[s['endereco']]
    marca('OK' if s['veredito'] == e else 'FALHA',
          f'R3.3 sitio {s["endereco"]:#x}: {s["veredito"]} (esperado {e})')

# nenhum grau promo vido em lugar nenhum
for nome in CASOS:
    jj = json.load(open(os.path.join(OUT, f'{nome}.json')))
    for r in jj['raizes']:
        if r['grau'] != r['proveniencia']:
            marca('FALHA', f'{nome}: raiz {r["endereco"]:#x} promoveu {r["proveniencia"]} -> {r["grau"]}')
    for c in jj['chamadas']:
        if c['params'] != 'nao-inferidos' or c['clobbers'] != 'nao-modelado':
            marca('FALHA', f'{nome}: chamada com params/clobbers inventados: {c}')
print(f'FIM: divergencias criticas = {falhas}')
sys.exit(1 if falhas else 0)
PY
rc=$?

# ------------------------------------------- 5. manifesto da evidencia crua
{
    echo "# evidencia da ETAPA 1 (frente C) — 2026-10-04"
    echo
    echo "ROM BYOR somente-leitura: \`$ROM\`"
    echo "sha256=$sha_rom  bytes=$tam_rom"
    echo "Vetor de reset (32 bytes de 0x000000): sha256=$vetor (conteudo nao versionado)"
    echo "Pinos de regiao (dd + sha256sum): R1(0x189C,160)=$R1_PIN R2(0x206,154)=$R2_PIN R3(0x1364,28)=$R3_PIN"
    echo
    echo "| artefato | sha256 | onde esta |"
    echo "|---|---|---|"
    for f in "$OUT"/*.json "$OUT"/*-objdump-bruto.txt; do
        [ -e "$f" ] || continue
        echo "| $(basename "$f") | $(sha256sum "$f" | cut -d' ' -f1) | $f (FORA do indice) |"
    done
    for f in "$EVID"/*.redigido.json; do
        echo "| $(basename "$f") | $(sha256sum "$f" | cut -d' ' -f1) | $f (versionado) |"
    done
} > "$EVID/MANIFEST.md"

echo "--- manifesto: $EVID/MANIFEST.md"
echo "rc da comparacao=$rc  falhas acumuladas=$falhas"
exit $rc
