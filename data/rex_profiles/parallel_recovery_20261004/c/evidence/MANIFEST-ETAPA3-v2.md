# MANIFEST ETAPA 3 (v2) — série bruta do comparador contra o instrumento, 2026-10-06

ROM BYOR sha256 c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb (531577 bytes), não versionada. Binário: rex-cfg desta worktree (schema rex-cfg/v2). Instrumento: m68k-elf-objdump GNU 2.41 `-b binary -m m68k -D` (sha e flags idênticos aos de MANIFEST-ETAPA2.md). Os scripts de ETAPA 1/2 foram executados em CÓPIA com a pasta de evidência redirecionada para scratch: os redigidos v1 históricos não foram reescritos (conferido por `git status` limpo).

## R1/R2/R3 (executar-evidencia-C.sh)
```
OK   instrumento: GNU objdump (GNU Binutils) 2.41 sha256=e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f flags='-b binary -m m68k -D'
OK   origem: Sonic the Hedgehog (USA, Europe).bin  sha256=c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb  bytes=531577 (somente-leitura)
OK   pino R1: 160 bytes em 0x189C == e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90
OK   pino R2: 154 bytes em 0x206 == 655f37340b1ebbd5aadeacdf1f64bd338686487c38d4eb6eba74ffaae1a965ba
OK   pino R3: 28 bytes em 0x1364 == 6f7028731c2c3ff6d69180595b492583947ab7040b76f488a9557701bc87d470
OK   vetor de reset: 32 bytes de 0x000000 sha256=66a88a2471192a07fb48ce9bc73ba3125aa983e1cf0604e5a465ecf71c1e7a6d (conteudo nao versionado; o longo em 0x000004 = 0x00000206 e a raiz R2)
OK   rex-cfg construido em rex-cfg
OK r1: paridade com o instrumento em 66 registros do objdump (comparados=66, divergencias=0, alem-do-limite-declarado=0, instrucoes da ferramenta sem registro=0)
OK r2: paridade com o instrumento em 54 registros do objdump (comparados=15, divergencias=0, alem-do-limite-declarado=39, instrucoes da ferramenta sem registro=0)
OK r3: paridade com o instrumento em 6 registros do objdump (comparados=6, divergencias=0, alem-do-limite-declarado=0, instrucoes da ferramenta sem registro=0)
OK R1.1 cobertura 160/160: 160/160 fracao=1.0000
OK R1.1 fronteiras = 0 (esperado 0)
OK R1.1 nenhuma aresta fora-da-regiao
OK R1.1 terminador em 0x193a classe rts
OK R1.4 numero de instrucoes = 66 (esperado 66)
OK R1.4 cinco DBcc nas posicoes congeladas: ['0x18ac', '0x18c8', '0x18dc', '0x18ee', '0x1922']
OK R1.4 arestas de laco para tras = 5 (esperado >= 5)
OK R1.4 chamadas = 0 (rotina folha; esperado 0)
OK R1.3 0x18ac: alvo 0x18ba; formula certa 0x18ba, formula historica errada 0x18b8
OK R1.3 0x1930: alvo 0x18a8; formula certa 0x18a8, formula historica errada 0x18aa
OK R2.1 primeira instrucao 0x206: {'endereco': 518, 'tam': 6, 'mnem': 'tstl (0x00a10008).l', 'classe': 'tst'}
OK R2.1 desvio em 0x20C -> 0x214, esperado 0x214
OK R2.1 desvio em 0x214 -> 0x292, esperado 0x292 (a formula historica produziria 0x294)
OK R2.2 lea logo depois do desvio: {'endereco': 534, 'tam': 4, 'mnem': 'lea (+124).w,%pc, %a5', 'classe': 'lea'} (doc congelado dizia 0x218)
OK R2.2 movem: {'endereco': 538, 'tam': 4, 'mnem': 'movemw mem->reg (lista nao-inferida)', 'classe': 'movem'} (doc congelado dizia 0x21C)
OK R2.2 primeira fronteira antes de 0x256: [('0x23a', 'opcode-fora-do-subconjunto'), ('0x292', 'limite-de-regiao')]
OK R2.3 aresta de desvio em 0x292 com status fora-da-regiao
OK R2.3 nenhum byte >= 0x2A0 decodificado
OK R2.4 cobertura 54/154 e 2 vao(es)
OK R2.5 sitio 0x1364 = fora-da-regiao
OK R2.5 sitio 0x3082 = fora-da-regiao
OK R2.5 sitio 0x51bc = fora-da-regiao
OK R2.5 sitio 0x745dc = fora-da-regiao
OK R3.1 lea em 0x1364 (6B): {'endereco': 4964, 'tam': 6, 'mnem': 'lea (0x00072e7c).l, %a0', 'classe': 'lea'}
OK R3.1 instrucao de 6B em 0x136A: {'endereco': 4970, 'tam': 6, 'mnem': 'lea (0x00a00000).l, %a1', 'classe': 'lea'} (doc congelado rotulou move.abs.L->D1)
OK R3.1 chamada em 0x1370 alvo 0x189c declarado e nao andado: [{'sitio': 4976, 'alvo': 6300, 'forma': 'bsr', 'params': 'nao-inferidos', 'clobbers': 'nao-modelado', 'status': 'fora-da-regiao'}]
OK R3.1 a formula historica (0x189E) nao aparece no grafo
OK R3.2 continuacao pos-chamada em 0x1374 (8B): {'endereco': 4980, 'tam': 8, 'mnem': 'movew #(0x0000), (0x00a11200).l', 'classe': 'move'}
OK R3.2 fronteira limite-de-regiao em 0x1380
OK R3.3 sitio 0x1364: instrucao-de-bloco (esperado instrucao-de-bloco)
OK R3.3 sitio 0x1366: miolo-de-instrucao (esperado miolo-de-instrucao)
OK R3.3 sitio 0x1369: miolo-de-instrucao (esperado miolo-de-instrucao)
OK R3.3 sitio 0x1370: instrucao-de-bloco (esperado instrucao-de-bloco)
OK R3.3 sitio 0x1372: miolo-de-instrucao (esperado miolo-de-instrucao)
OK R3.3 sitio 0x1378: miolo-de-instrucao (esperado miolo-de-instrucao)
OK R3.3 sitio 0x137c: instrucao-de-bloco (esperado instrucao-de-bloco)
OK R3.3 sitio 0x137e: instrucao-de-bloco (esperado instrucao-de-bloco)
OK R3.3 sitio 0x1380: fora-da-regiao (esperado fora-da-regiao)
FIM: divergencias criticas = 0
```

## S1/S2 e censo (executar-amostras-reservadas-C.sh)
```
OK   origem: sha256=c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb bytes=531577 (somente-leitura, nao versionada)
OK   pino CTX: 28 bytes em 0x00D84 == 298c991c8fa94383425a51f4c0cdd3ce48e4d989f7ca01468eaa88d2955f626c
OK   pino S1: 128 bytes em 0x1C024 == f1b9b9cdfc6f6e714b449becf87de883b0162954ef6fd8bd7f4fcf0afdd94c63
OK   pino S2: 128 bytes em 0x1C6B8 == 6f3308c397ed4c9ae07a3e6e2e86092b56a526d26b9d43062572c6e5a9def91c
OK   instrumento: GNU objdump (GNU Binutils) 2.41 sha256=e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f flags='-b binary -m m68k -D'
OK   rex-cfg em rex-cfg
OK s1 R1: 8 sitios alinhados com veredito estrutural ['instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'ponto-de-fronteira', 'dentro-regiao-nao-alcancado']
OK s1 R2: sitio impar 0x1c029 = miolo-de-instrucao (consumidor nao)
OK s1 R3: 0x1c0a6 = fora-da-regiao; instrucoes >= 0x1c0a4: []
OK s1 R4: raizes [(114724, 'referencia-estatica', 'referencia-estatica')]
OK s1 R5: 1 chamadas, todas com sitio par e instrucao provada; ruins=[]
OK s1 R6: paridade de comprimento em 8 nos comparados com 32 registros do instrumento (divergencias=0, sem registro=0)
OK s1 R6 alvo 0x1c028 = 0x1c044 (instrumento: 114756)
OK s1 R6 alvo 0x1c030 = 0x1c510 (instrumento: 115984)
OK s1 medir: status das quatro dimensoes [('comprimento', 'medido'), ('operandos', 'medido'), ('fluxo', 'medido'), ('alcance', 'medido')] agregado=proibido pendencia=[]
OK s2 R1: 8 sitios alinhados com veredito estrutural ['instrucao-de-bloco', 'instrucao-de-bloco', 'instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'miolo-de-instrucao', 'instrucao-de-bloco', 'instrucao-de-bloco']
OK s2 R2: sitio impar 0x1c6bd = miolo-de-instrucao (consumidor nao)
OK s2 R3: 0x1c73a = fora-da-regiao; instrucoes >= 0x1c738: []
OK s2 R4: raizes [(116408, 'referencia-estatica', 'referencia-estatica')]
OK s2 R5: 3 chamadas, todas com sitio par e instrucao provada; ruins=[]
OK s2 R6: paridade de comprimento em 36 nos comparados com 37 registros do instrumento (divergencias=0, sem registro=0)
OK s2 R6 alvo 0x1c6bc = 0x1c7a2 (instrumento: 116642)
OK s2 R6 alvo 0x1c6c4 = 0x1c6d8 (instrumento: 116440)
OK s2 R6 alvo 0x1c6d4 = 0x1c8da (instrumento: 116954)
OK s2 R6 alvo 0x1c6dc = 0x1c6f8 (instrumento: 116472)
OK s2 R6 alvo 0x1c6de = 0x1c6e4 (instrumento: 116452)
OK s2 R6 alvo 0x1c6e0 = 0x1c80e (instrumento: 116750)
OK s2 R6 alvo 0x1c6f4 = 0x1c8d0 (instrumento: 116944)
OK s2 R6 alvo 0x1c6fc = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c702 = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c70e = 0x1c78c (instrumento: 116620)
OK s2 R6 alvo 0x1c716 = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c722 = 0x1c734 (instrumento: 116532)
OK s2 R6 alvo 0x1c72e = 0x1c734 (instrumento: 116532)
OK s2 medir: status das quatro dimensoes [('comprimento', 'medido'), ('operandos', 'medido'), ('fluxo', 'medido'), ('alcance', 'medido')] agregado=proibido pendencia=[]
OK R7: censo com 16 enderecos; 16 nao promovidos (raiz candidato); violacoes=0
OK s1: evidencia redigida versionada sha256=3d2cddebedf361f13ba2a1839412fb559d7954c6e281c070873b281ec990cbd9 bytes_nao_ascii=0
OK s2: evidencia redigida versionada sha256=cec63dc5bb7b4cb7c53d3b897767f5c1d1c9ec56a6482bb33e5138e3d8e6c62f bytes_nao_ascii=0
OK   censo versionado: sha256=243b37b74aa639e68965b97792858b95ad2aa4bc7dcf1d98618ffa0d8a9716f9
FIM: divergencias criticas = 0
```

Veredito: divergencias críticas = 0 nas duas rodadas; delta v1→v2 em `delta-etapa3-v2.md` (110 linhas, todas invariantes: as amostras não contêm abs.W com bit15=1, ver R-3.3).
