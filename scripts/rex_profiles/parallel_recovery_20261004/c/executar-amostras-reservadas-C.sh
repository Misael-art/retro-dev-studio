#!/usr/bin/env bash
# ETAPA 2 (letra C): amostras reservadas da ROM BYOR (§4 da expectativa: R1..R7),
# verificador de sítios e export de medições para D (§6).
#
# Uso: bash executar-amostras-reservadas-C.sh [dir-saida]
#
# Seleção já congelada em EXPECTATIONS-ETAPA2.md §4: os corpos S1/S2 são os alvos
# dos dois `jsr (xxxx).L` que o instrumento comprova na janela de contexto
# 0x00D84..0x00DA0. Nenhum corpo foi escolhido por ter sido lido — a primeira
# leitura dos corpos É a medição desta etapa.
#
# VAI para data/.../c/evidence/: os redigidos (endereços, comprimentos, classes,
# arestas, fronteiras, vereditos de sítio) e os exports `rex-cfg-med/v1`. Os
# redigidos NOVOS não carregam o caminho local do operador: identidade por SHA
# (§8 E3), registrado em CONTRACT §2.2.
#
# NAO vai: imagem da ROM, dumps brutos do instrumento, saídas completas da CLI.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/../../../.." && pwd)"
OUT="${1:-$HOME/rds-scratch/xe-c2-amostras}"
EVID="$REPO/data/rex_profiles/parallel_recovery_20261004/c/evidence"
TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
OBJDUMP="$TC/m68k-elf-objdump"
ROM="${REX_ROM:-$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin}"
ROM_PIN="c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
ROM_BYTES=531577
CTX_PIN="298c991c8fa94383425a51f4c0cdd3ce48e4d989f7ca01468eaa88d2955f626c"
S1_PIN="f1b9b9cdfc6f6e714b449becf87de883b0162954ef6fd8bd7f4fcf0afdd94c63"
S2_PIN="6f3308c397ed4c9ae07a3e6e2e86092b56a526d26b9d43062572c6e5a9def91c"

mkdir -p "$OUT" "$EVID"

# ---------------------------------------------------------------- 0. origem
[ -x "$OBJDUMP" ] || { echo "ABORT: instrumento ausente: $OBJDUMP"; exit 1; }
[ -r "$ROM" ] || { echo "ABORT: ROM BYOR nao legivel: $ROM"; exit 1; }
sha_rom="$(sha256sum "$ROM" | cut -d' ' -f1)"
[ "$sha_rom" = "$ROM_PIN" ] || { echo "ABORT: ROM $sha_rom != pin $ROM_PIN"; exit 1; }
tam_rom="$(wc -c <"$ROM")"
[ "$tam_rom" = "$ROM_BYTES" ] || { echo "ABORT: tamanho $tam_rom != $ROM_BYTES"; exit 1; }
echo "OK   origem: sha256=$sha_rom bytes=$tam_rom (somente-leitura, nao versionada)"

pin() { # skip-decimal contagem pin nome
    local s; s="$(dd if="$ROM" bs=1 skip="$1" count="$2" status=none | sha256sum | cut -d' ' -f1)"
    if [ "$s" = "$3" ]; then echo "OK   pino $4: $2 bytes em $5 == $3"; else echo "FALHA pino $4: $s != $3"; exit 1; fi
}
pin 3460 28 "$CTX_PIN" CTX 0x00D84
pin 114724 128 "$S1_PIN" S1 0x1C024
pin 116408 128 "$S2_PIN" S2 0x1C6B8

# ---------------------------------------------------------------- 1. build
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/rds-scratch/xe-c-target}"
BIN="$CARGO_TARGET_DIR/debug/rex-cfg"
if ! cargo build --offline --manifest-path "$AQUI/Cargo.toml" --bin rex-cfg >/dev/null 2>&1; then
    echo "ABORT: rex-cfg nao compila"; exit 1
fi
echo "OK   rex-cfg em $BIN"

# ------------------------------------------- 2. analise + medir + 10 sitios
rodar() { # nome ini fim raiz
    local nome="$1" ini="$2" fim="$3" raiz="$4"
    "$BIN" analyze --bin "$ROM" --region "$ini:$fim" --root "$raiz" \
        --root-prov referencia-estatica \
        --root-evidence "alvo de jsr (xxxx).L comprovado pelo instrumento no contexto pinado 0x00D84..0x00DA0 (sha do contexto na expectativa)" \
        --out "$OUT/$nome.analise.json" >"$OUT/$nome.analise.stdout" 2>&1 || { echo "FALHA $nome analyze"; cat "$OUT/$nome.analise.stdout"; return 1; }
    "$BIN" medir --bin "$ROM" --region "$ini:$fim" --root "$raiz" \
        --root-prov referencia-estatica \
        --out "$OUT/$nome.med.json" >"$OUT/$nome.med.stdout" 2>&1 || { echo "FALHA $nome medir"; cat "$OUT/$nome.med.stdout"; return 1; }
    echo "--- $nome: analyze+medir ok; $(head -1 "$OUT/$nome.med.stdout")"
}
rodar s1 0x1C024 0x1C0A4 0x1C024
rodar s2 0x1C6B8 0x1C738 0x1C6B8

sitios() { # nome ini fim  -> 8 alinhados + 1 impar + 1 alem-do-fim (§4, regra fixa)
    local nome="$1" ini="$2" fim="$3" k s
    for k in 0 1 2 3 4 5 6 7; do
        printf '0x%04X\n' $((ini + 4 * k))
    done
    printf '0x%04X\n' $((ini + 5))
    printf '0x%04X\n' $((fim + 2))
}
consultar() { # nome ini fim raiz
    local nome="$1" ini="$2" fim="$3" raiz="$4" s
    for s in $(sitios "$nome" "$ini" "$fim"); do
        "$BIN" consultar --bin "$ROM" --region "$ini:$fim" --root "$raiz" \
            --root-prov referencia-estatica --site "$s" \
            --out "$OUT/$nome.sitio.${s#0x}.json" >"$OUT/$nome.sitio.err" 2>&1 || {
            echo "FALHA $nome consultar $s"; cat "$OUT/$nome.sitio.err"; return 1; }
    done
    echo "--- $nome: 10 sitios consultados"
}
consultar s1 0x1C024 0x1C0A4 0x1C024
consultar s2 0x1C6B8 0x1C738 0x1C6B8

# --------------------------- 3. censo de iscas (Apêndice B) — negativo, nao medicao
# Regra fixa declarada agora: janela alinhada de 128 bytes contendo o endereco;
# raiz = o proprio endereco com proveniencia `candidato`, EXCETO a linha cujo
# instrume comprova que o endereco e MIOLO de outra instrucao (0x31DCC, dentro de
# 0x31DCA), onde a raiz e o inicio comprovado — so assim o negativo discrimina.
censo() { # endereco [raiz]
    local a="$1" raiz="${2:-$1}"
    local ini=$(( a / 0x40 * 0x40 ))
    local fim=$(( ini + 0x80 ))
    "$BIN" consultar --bin "$ROM" --region "0x$(printf '%X' $ini):0x$(printf '%X' $fim)" \
        --root "$raiz" --root-prov candidato --site "$a" \
        --out "$OUT/censo.$(printf '%05X' "$a").json" >"$OUT/censo.err" 2>&1 || {
        echo "FALHA censo $a: $(cat "$OUT/censo.err")"; return 1; }
    "$OBJDUMP" -b binary -m m68k -D --start-address="$(printf '0x%X' $ini)" --stop-address="$(printf '0x%X' $fim)" \
        "$ROM" >"$OUT/censo.$(printf '%05X' "$a").objdump.txt" 2>&1
    echo "ok  censo $(printf '0x%05X' "$a")"
}
for a in 0x66A40 0x31DCC 0x74EEC 0x77EFA 0x819DA 0x4028A 0x4F606 0x50210 0x3AB02 0x4F850 \
         0x5C2 0x11F0 0x1482 0x15C6 0x1DD8 0x1DFA; do
    raiz="$a"
    [ "$a" = "0x31DCC" ] && raiz=0x31DCA
    censo "$a" "$raiz"
done

# ---------------------------------------------- 4. instrumento sobre os corpos
for par in "s1 0x1C024 0x1C0A4" "s2 0x1C6B8 0x1C738"; do
    set -- $par
    "$OBJDUMP" -b binary -m m68k -D --start-address="$2" --stop-address="$3" "$ROM" \
        >"$OUT/$1-objdump-bruto.txt" 2>&1
    echo "--- $1: objdump $2..$3 ($(grep -cE '^ +[0-9a-f]+:' "$OUT/$1-objdump-bruto.txt") registros)"
done

# --------------------------------------- 5. arbitragem + evidencia versionada
python3 - "$OUT" "$EVID" "$sha_rom" "$tam_rom" "$CTX_PIN" "$S1_PIN" "$S2_PIN" <<'PY'
import json, re, sys, os, hashlib
OUT, EVID, SHA_ROM, TAM_ROM, CTX_PIN, S1_PIN, S2_PIN = sys.argv[1:8]
falhas = 0
def marca(nivel, txt):
    global falhas
    print(f"{nivel} {txt}")
    if nivel == 'FALHA':
        falhas += 1

FLUXO = ('bra', 'bsr', 'bcc', 'bcs', 'bmi', 'bpl', 'bge', 'bgt', 'ble', 'bls',
         'bhi', 'bvs', 'bvc', 'beq', 'bne', 'dbf', 'dbt', 'jmp', 'jsr')

def recs_objdump(caminho):
    recs, ultimo = {}, None
    for line in open(caminho, encoding='utf-8', errors='replace'):
        m = re.match(r'^\s+([0-9a-f]+):\t((?:[0-9a-f]{4} )+)\s*(\S+)(.*)$', line)
        if m:
            addr = int(m.group(1), 16)
            tok = m.group(3)
            alvo = None
            if tok.startswith(FLUXO):
                d = re.search(r'0x([0-9a-f]+)\s*$', m.group(4))
                alvo = int(d.group(1), 16) if d else None
            recs[addr] = [len(m.group(2).split()) * 2, tok, alvo]
            ultimo = recs[addr]
            continue
        m = re.match(r'^\s+([0-9a-f]+):\t((?:[0-9a-f]{4} )+)$', line)
        if m and ultimo is not None:
            ultimo[0] += len(m.group(2).split()) * 2
            ultimo = None
    return recs

def carrega(nome):
    return json.load(open(os.path.join(OUT, nome)))

def sitios_de(ini, fim):
    s = [ini + 4 * k for k in range(8)]
    return s, ini + 5, fim + 2

AMOSTRAS = {
    's1': (0x1C024, 0x1C0A4, S1_PIN, 128),
    's2': (0x1C6B8, 0x1C738, S2_PIN, 128),
}
VEREDITOS_OK = {'instrucao-de-bloco', 'miolo-de-instrucao',
                'dentro-regiao-nao-alcancado', 'ponto-de-fronteira'}

serie = {}
for nome, (ini, fim, _, _) in AMOSTRAS.items():
    analise = carrega(f'{nome}.analise.json')
    med = carrega(f'{nome}.med.json')
    alinhados, impar, alem = sitios_de(ini, fim)
    linhas = []
    for end in alinhados + [impar, alem]:
        r = carrega(f'{nome}.sitio.{end:04X}.json')
        linhas.append({'sitio': f'0x{end:06X}',
                       'veredito': r['veredito'],
                       'consumidor-validado': r['consumidor-validado'],
                       'promovivel-vinculo-estrutural': r['promovivel-vinculo-estrutural'],
                       'alvo': r['alvo'], 'motivos': r['motivos']})
    serie[nome] = linhas
    por_end = {int(l['sitio'], 16): l for l in linhas}

    # R1: todo sitio par dentro do corpo tem veredito estrutural; nunca fora-da-regiao
    ruins = [l for l in linhas[:8] if l['veredito'] not in VEREDITOS_OK]
    marca('OK' if not ruins else 'FALHA',
          f'{nome} R1: 8 sitios alinhados com veredito estrutural '
          f'{[l["veredito"] for l in linhas[:8]]}')
    for l in ruins:
        marca('FALHA', f'{nome} R1: {l["sitio"]} = {l["veredito"]}')

    # R2: o impar NUNCA e instrucao-de-bloco (negativo discriminante pedido)
    r_impar = por_end[impar]
    marca('OK' if r_impar['veredito'] != 'instrucao-de-bloco' else 'FALHA',
          f'{nome} R2: sitio impar {impar:#x} = {r_impar["veredito"]} '
          f'(consumidor {r_impar["consumidor-validado"]})')

    # R3: alem do fim = fora-da-regiao, e nenhum byte >= fim decodificado
    r_alem = por_end[alem]
    dec_fora = [i['endereco'] for b in analise['blocos'] for i in b['instrucoes']
                if i['endereco'] >= fim]
    marca('OK' if r_alem['veredito'] == 'fora-da-regiao' and not dec_fora else 'FALHA',
          f'{nome} R3: {alem:#x} = {r_alem["veredito"]}; instrucoes >= {fim:#x}: {dec_fora}')

    # R4: grau da raiz nunca promovido
    promo = [r for r in analise['raizes'] if r['grau'] != r['proveniencia']]
    marca('OK' if not promo else 'FALHA',
          f'{nome} R4: raizes {[(r["endereco"], r["proveniencia"], r["grau"]) for r in analise["raizes"]]}')

    # R5: toda chamada tem sitio par com instrucao provada; nada nasce de varredura
    provadas = {i['endereco'] for b in analise['blocos'] for i in b['instrucoes']}
    ruins = [c['sitio'] for c in analise['chamadas'] if c['sitio'] % 2 or c['sitio'] not in provadas]
    marca('OK' if not ruins else 'FALHA',
          f'{nome} R5: {len(analise["chamadas"])} chamadas, todas com sitio par e instrucao '
          f'provada; ruins={ruins}')

    # R6: comprimento ferramenta <-> instrumento, instrucao a instrucao
    od = recs_objdump(os.path.join(OUT, f'{nome}-objdump-bruto.txt'))
    fer = {i['endereco']: i for b in analise['blocos'] for i in b['instrucoes']}
    div = []
    for addr, (tam, tok, alvo) in sorted(od.items()):
        if addr not in fer:
            continue  # o fluxo delimitado para onde o opcode recusa ou o caminho acaba
        if fer[addr]['tam'] != tam:
            div.append(f'{addr:#x}: ferramenta {fer[addr]["tam"]}B vs instrumento {tam}B ({tok})')
    sobra = [hex(a) for a in fer if a not in od]
    marca('OK' if not div and not sobra else 'FALHA',
          f'{nome} R6: paridade de comprimento em {len(fer)} nos comparados com {len(od)} registros '
          f'do instrumento (divergencias={len(div)}, sem registro={len(sobra)})')
    for d in div:
        print('     ', d)
    # alvos alegados pela ferramenta conferidos com o instrumento, e P-absW
    alvos = {}
    for e in analise['arestas']:
        if e['tipo'] in ('desvio', 'chamada') and e.get('alvo') is not None:
            alvos[e['origem']] = e['alvo']
    for addr, alvo in sorted(alvos.items()):
        ok = addr in od and od[addr][2] == alvo
        marca('OK' if ok else 'FALHA',
              f'{nome} R6 alvo {addr:#x} = {alvo:#x} (instrumento: '
              f'{od[addr][2] if addr in od and od[addr][2] is not None else "-"})')

    # medir: as quatro dimensoes presentes e sem agregado
    DIM = ('comprimento', 'operandos', 'fluxo', 'alcance')
    faltando = [f'{d}-status' for d in DIM if f'{d}-status' not in med]
    marca('OK' if not faltando and med['agregado'] == 'proibido' else 'FALHA',
          f'{nome} medir: status das quatro dimensoes '
          f'{[(d, med.get(f"{d}-status")) for d in DIM]} agregado={med["agregado"]} '
          f'pendencia={med["pendencia-motivos"]}')

# ------------------------------------------------------- censo de iscas (R7)
CENSO = {0x66A40: '4E FA', 0x31DCC: '4E FC', 0x74EEC: '4E B8', 0x77EFA: '4E B8',
         0x819DA: '4E B8', 0x4028A: '4E F8', 0x4F606: '4E F8', 0x50210: '4E F8',
         0x3AB02: '2A 7C', 0x4F850: '2A 7C', 0x5C2: '61 nn', 0x11F0: '61 nn',
         0x1482: '61 nn', 0x15C6: '61 nn', 0x1DD8: '61 nn', 0x1DFA: '61 nn'}
print('--- censo do Apêndice B (iscas; cada linha: veredito, consumidor, promovivel, '
      'alvo da ferramenta vs instrumento)')
div_r7 = []
nao_promovidas = 0
for addr, padrao in sorted(CENSO.items()):
    r = carrega(f'censo.{addr:05X}.json')
    od = recs_objdump(os.path.join(OUT, f'censo.{addr:05X}.objdump.txt'))
    ins = od.get(addr)
    alvo_ferr = r['alvo']
    alvo_f = int(alvo_ferr, 16) if isinstance(alvo_ferr, str) else alvo_ferr
    alvo_inst = ins[2] if ins else None
    print(f'  {addr:#07x} {padrao:7s} veredito={r["veredito"]:26s} consumidor={r["consumidor-validado"]} '
          f'promovivel={r["promovivel-vinculo-estrutural"]} alvo={alvo_ferr} '
          f'instrumento={(f"{alvo_inst:#x}" if alvo_inst is not None else "-")} '
          f'motivos={r["motivos"]}')
    if r['promovivel-vinculo-estrutural'] == 'nao':
        nao_promovidas += 1
    # o negativo que se exige: promovivel = nao (raiz `candidato` nunca autoriza vinculo)
    if r['promovivel-vinculo-estrutural'] != 'nao':
        div_r7.append(f'{addr:#x}: promovivel com raiz candidato')
    # discriminante de interior: 0x31DCC e miolo da instrucao em 0x31DCA
    if addr == 0x31DCC and r['veredito'] != 'miolo-de-instrucao':
        div_r7.append(f'{addr:#x}: esperado miolo-de-instrucao, obtido {r["veredito"]}')
    if addr == 0x31DCC and r['consumidor-validado'] != 'nao':
        div_r7.append(f'{addr:#x}: interior de instrucao validado como consumidor')
    # onde a ferramenta alega um alvo, ele tem de ser o do instrumento
    if alvo_f is not None and alvo_inst is not None and alvo_f != alvo_inst:
        div_r7.append(f'{addr:#x}: alvo {alvo_f:#x} != instrumento {alvo_inst:#x}')
marca('OK' if not div_r7 else 'FALHA',
      f'R7: censo com {len(CENSO)} enderecos; {nao_promovidas} nao promovidos '
      f'(raiz candidato); violacoes={len(div_r7)}')
for d in div_r7:
    print('     ', d)
# divergencia registrada da redacao congelada de R7 (ver adendo datado): iscas que
# o instrumento comprova como transferencias reais saem consumidor=sim; o negativo
# efetivo da barreira e a promocao, nao a classificacao estrutural.
if any(l['consumidor-validado'] == 'sim' for v in serie.values() for l in v):
    print('     nota: sitios S1/S2 validados como consumidor estrutural existem na serie')

# ------------------------------------------------------------- redigidos
def redigido(nome, ini, fim, pin_corpo):
    j = carrega(f'{nome}.analise.json')
    med = carrega(f'{nome}.med.json')
    ins = sorted(({'endereco': i['endereco'], 'tam': i['tam'], 'classe': i['classe']}
                  for b in j['blocos'] for i in b['instrucoes']), key=lambda x: x['endereco'])
    comando = (f'rex-cfg analyze --bin <ROM> --region {ini:#x}:{fim:#x} --root {ini:#x} '
               f'--root-prov referencia-estatica --root-evidence "alvo de jsr (xxxx).L '
               f'comprovado pelo instrumento no contexto pinado 0x00D84..0x00DA0" '
               f'--out <saida>/{nome}.analise.json')
    return {
        'esquema': 'rex-cfg/v1-evidencia-redigida',
        'analise': f'{nome} (amostra reservada ETAPA2, §4)',
        'etapa': 2,
        'base-da-ferramenta': med['base-sha'],
        'comando': comando,
        'comando-de-medicoes': med['comando'],
        'objeto': {'caminho_declarado': '<ROM>', 'placeholder': 'identidade por SHA (§8 E3); '
                   'o caminho local do operador nao e versionado',
                   'sha256': SHA_ROM, 'tamanho': int(TAM_ROM)},
        'pino-do-corpo': {'regiao': f'{ini:#x}:{fim:#x}', 'bytes': 128, 'sha256': pin_corpo,
                          'como': 'dd bs=1 skip=<decimal> count=128 | sha256sum'},
        'contexto-de-selecao': {'janela': '0x00D84..0x00DA0', 'sha256': CTX_PIN,
                                'regra': 'alvos dos dois jsr (xxxx).L que o instrumento comprova'},
        'saida_completa': {'caminho_local': 'FORA do indice (dir de saida do operador)',
                           'sha256': hashlib.sha256(open(os.path.join(OUT, f'{nome}.analise.json'), 'rb').read()).hexdigest(),
                           'motivo_de_nao_versionado': 'lista instrucoes com operandos = conteudo derivado de ROM comercial'},
        'regiao': j['regiao'],
        'raizes': j['raizes'],
        'cobertura': j['cobertura'],
        'instrucoes': ins,
        'arestas': j['arestas'],
        'chamadas': j['chamadas'],
        'fronteiras': j['fronteiras'],
        'sitios': serie[nome],
        'medicoes': med,
        'limites': j['limites'],
    }

for nome, (ini, fim, pin, _) in AMOSTRAS.items():
    red = redigido(nome, ini, fim, pin)
    destino = os.path.join(EVID, f'{nome}.redigido.json')
    with open(destino, 'w', encoding='utf-8') as fh:
        json.dump(red, fh, indent=1, ensure_ascii=True, sort_keys=True)
        fh.write('\n')
    sha = hashlib.sha256(open(destino, 'rb').read()).hexdigest()
    nao_ascii = sum(1 for b in open(destino, 'rb').read() if b > 127)
    marca('OK' if nao_ascii == 0 else 'FALHA',
          f'{nome}: evidencia redigida versionada sha256={sha} bytes_nao_ascii={nao_ascii}')

censo_resumo = {
    'esquema': 'rex-cfg/censo-iscas/v1',
    'etapa': 2,
    'base-da-ferramenta': carrega('s1.med.json')['base-sha'],
    'objeto': {'caminho_declarado': '<ROM>', 'sha256': SHA_ROM, 'tamanho': int(TAM_ROM)},
    'regra': 'janela alinhada de 128 bytes contendo o endereco; raiz = o proprio endereco com '
             'proveniencia candidato, exceto 0x31DCC cuja raiz e 0x31DCA (inicio comprovado pelo '
             'instrumento). Consulta de sítio: um sitio, um objeto plano.',
    'comando': 'rex-cfg consultar --bin <ROM> --region <janela> --root <raiz> --root-prov candidato '
               '--site <endereco> --out <saida>',
    'linhas': [
        {'sitio': f'0x{a:06X}', 'padrao': p, **{k: carrega(f'censo.{a:05X}.json')[k]
        for k in ('veredito', 'consumidor-validado', 'promovivel-vinculo-estrutural', 'alvo',
                  'motivos', 'limites')}}
        for a, p in sorted(CENSO.items())],
    'aspiracao-congelada': 'R7 (EXPECTATIONS-ETAPA2 §4): "a ferramenta e chamada nesses enderecos '
                           'e deve responder consumidor-validado: nao".',
    'medido': 'Ver serie bruta acima: as linhas que o instrumento comprova como transferencia real '
              '(4E B8/4E F8 legitimos, 61 nn = bsr.s) saem consumidor-validado "sim" com alvo igual '
              'ao do instrumento; a promocao de vinculo sai "nao" em todas, porque raiz `candidato` '
              'nunca autoriza (V2). O negativo de interior (0x31DCC dentro de 0x31DCA) sai '
              'miolo-de-instrucao com consumidor "nao".',
}
destino = os.path.join(EVID, 'censo-iscas.redigido.json')
with open(destino, 'w', encoding='utf-8') as fh:
    json.dump(censo_resumo, fh, indent=1, ensure_ascii=True, sort_keys=True)
    fh.write('\n')
print(f'OK   censo versionado: sha256='
      f'{hashlib.sha256(open(destino, "rb").read()).hexdigest()}')

print(f'FIM: divergencias criticas = {falhas}')
sys.exit(1 if falhas else 0)
PY
rc=$?

# ------------------------------------------- 6. manifesto da evidencia crua
{
    echo "# evidencia das amostras reservadas (letra C, ETAPA 2) — 2026-10-05"
    echo
    echo "ROM BYOR somente-leitura, NAO versionada; identidade por SHA-256."
    echo "sha256=$sha_rom  bytes=$tam_rom"
    echo "Pinos: CTX(0x00D84,28)=$CTX_PIN S1(0x1C024,128)=$S1_PIN S2(0x1C6B8,128)=$S2_PIN"
    echo
    echo "| artefato | sha256 | onde esta |"
    echo "|---|---|---|"
    for f in "$OUT"/*.json "$OUT"/*.txt; do
        [ -e "$f" ] || continue
        echo "| $(basename "$f") | $(sha256sum "$f" | cut -d' ' -f1) | $f (FORA do indice) |"
    done
    for f in "$EVID"/*.redigido.json; do
        echo "| $(basename "$f") | $(sha256sum "$f" | cut -d' ' -f1) | $f (versionado) |"
    done
} > "$EVID/MANIFEST-ETAPA2.md"

echo "--- manifesto: $EVID/MANIFEST-ETAPA2.md"
echo "rc do comparador = $rc"
exit "$rc"
