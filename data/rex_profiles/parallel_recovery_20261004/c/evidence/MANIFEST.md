# evidencia da ETAPA 1 (frente C) — 2026-10-04

ROM BYOR somente-leitura: `/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin`
sha256=c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb  bytes=531577
Vetor de reset (32 bytes de 0x000000): sha256=66a88a2471192a07fb48ce9bc73ba3125aa983e1cf0604e5a465ecf71c1e7a6d (conteudo nao versionado)
Pinos de regiao (dd + sha256sum): R1(0x189C,160)=e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90 R2(0x206,154)=655f37340b1ebbd5aadeacdf1f64bd338686487c38d4eb6eba74ffaae1a965ba R3(0x1364,28)=6f7028731c2c3ff6d69180595b492583947ab7040b76f488a9557701bc87d470

## instrumento (arbitro de comprimento e alvo)

- binario: `m68k-elf-objdump` — versao `GNU objdump (GNU Binutils) 2.41`
- sha256 do binario: `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f`
- flags: `-b binary -m m68k -D` (offset == endereco na imagem plana)
- limite: paridade com o instrumento **nao** equivale a observacao em runtime

Este manifesto registra caminhos locais do operador de proposito: ele e o
indicador do que NAO esta no indice. Os redigidos JSON dao identidade por
SHA-256 (§8 E3). Bloco acrescentado em 2026-10-05 pela auditoria da ETAPA 2,
sem reescrever os tres redigidos publicados na ETAPA 1.

## serie bruta do comparador

```
OK r1: paridade com o instrumento em 66 registros do objdump (comparados=66, divergencias=0, alem-do-limite-declarado=0, instrucoes da ferramenta sem registro=0)
     evidencia redigida: /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r1.redigido.json sha256=d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4
OK r2: paridade com o instrumento em 54 registros do objdump (comparados=15, divergencias=0, alem-do-limite-declarado=39, instrucoes da ferramenta sem registro=0)
      registros do instrumento alem do limite declarado (39): 0x23a movel de 2B, 0x23c moveq de 2B, 0x23e moveb de 2B, 0x240 movew de 2B, 0x242 addw de 2B, 0x244 dbf de 4B, 0x248 movel de 2B, 0x24a movew de 2B ...
     evidencia redigida: /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r2.redigido.json sha256=524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3
OK r3: paridade com o instrumento em 6 registros do objdump (comparados=6, divergencias=0, alem-do-limite-declarado=0, instrucoes da ferramenta sem registro=0)
     evidencia redigida: /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r3.redigido.json sha256=c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea
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

| artefato | sha256 | onde esta |
|---|---|---|
| r1.json | 318364322561bff357648cd1d041c39f3ddefa70c4174af66cea4c89ca513465 | /home/misael/rds-scratch/xe-c-evidencia/r1.json (FORA do indice) |
| r2.json | 1c197a8af3b3c6d4bd8baa74309bdda7a06177e712b150115fe86adc2b0faba0 | /home/misael/rds-scratch/xe-c-evidencia/r2.json (FORA do indice) |
| r3.json | d33a236e26b70d9987d879b5240094390134223a7b02aa75e9fcbde4fd2c1677 | /home/misael/rds-scratch/xe-c-evidencia/r3.json (FORA do indice) |
| r1-objdump-bruto.txt | 82d1fbb6be2a8c6d429aa7233753ce6f132ade68c2b5bfff8c86a1ba5a219fb1 | /home/misael/rds-scratch/xe-c-evidencia/r1-objdump-bruto.txt (FORA do indice) |
| r2-objdump-bruto.txt | 1c65ef8d2c0547655ed41b0643b1959f0cee5b493928f8cf3dcaf67c1f77a56a | /home/misael/rds-scratch/xe-c-evidencia/r2-objdump-bruto.txt (FORA do indice) |
| r3-objdump-bruto.txt | 82ca0b2dee3732a8717bbb809374ae356929aa81b52fd3a28446be18d98e88cf | /home/misael/rds-scratch/xe-c-evidencia/r3-objdump-bruto.txt (FORA do indice) |
| censo-iscas.redigido.json | 6c446c292824c7e5a7256046abca9e0e1a6ca3862503157df1660d8a3b8954ef | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/censo-iscas.redigido.json (versionado) |
| r1.redigido.json | d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r1.redigido.json (versionado) |
| r2.redigido.json | 524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r2.redigido.json (versionado) |
| r3.redigido.json | c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r3.redigido.json (versionado) |
| s1.redigido.json | 110e5cda4f22be65e646ea7027d2ffb3fdf9751f2f06ae56518253709f657ad3 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/s1.redigido.json (versionado) |
| s2.redigido.json | bb6db8baaa9d644d918364588c3c5b90c7d81fd4d3517123ce32361824c0a06a | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/s2.redigido.json (versionado) |
