# Matriz de avaliación — frente D (paralela 2026-10-04)

Xerado por `pontuar.mjs`; cada capacidade co seu denominador conxelado.
**Non existe percentual único** (§8): as fraccións por capacidade non se suman
porque miden dominios distintos (cadea/ISA/enderezamento/decode/adulteración).

### Frente A @ `cbb6895`

- evidencia: `medidas/A-cbb6895.jsonl` (sha `d05ce278a43b…`, auditada: SI)
- denominador conxelado: 29 filas — fonte: data/rex_profiles/parallel_recovery_20261004/d/frentes/a/dA-truth-v1.json
- procedencia da ferramenta: `A@cbb6895` — byte a byte co commit (15 ficheiros comparados, 0 diverxentes, 0 faltantes)

| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |
|---|---|---|---|---|---|---|
| KA1 | 9 | 9 | 9 | 0 | 0 | 0 |
| KA1-b | 2 | 2 | 2 | 0 | 2 | 0 |
| KA2 | 4 | 4 | 4 | 0 | 0 | 0 |
| KA3 | 1 | 1 | 1 | 0 | 0 | 0 |
| KA3-g | 2 | 2 | 2 | 0 | 0 | 0 |
| KA4 | 3 | 3 | 3 | 0 | 0 | 0 |
| TA | 8 | 8 | 7 | 1 | 0 | 0 |

Falhas conservadas (R0 — non se exclúen de capacidade alegada):
- `TA/TA-5` rc=2 esperado 6 — {"campo":"rc","esperado":6,"medido":2} — operando .L alterado no registro, imagem inalterada

Excluídas do denominador (1) con motivo:
- `TA-controle/TA-2-control` → CONTROLADO: eixo identidade confunde a receita TA-2; queda como observación
### Frente A @ `bd40e92`

- evidencia: `medidas/A-bd40e92.jsonl` (sha `c2004f89e914…`, auditada: SI)
- denominador conxelado: 29 filas — fonte: data/rex_profiles/parallel_recovery_20261004/d/frentes/a/dA-truth-v1.json
- procedencia da ferramenta: `A_corrixido@bd40e92` — byte a byte co commit (52 ficheiros comparados, 0 diverxentes, 0 faltantes)

| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |
|---|---|---|---|---|---|---|
| KA1 | 9 | 9 | 4 | 5 | 0 | 0 |
| KA1-b | 2 | 2 | 2 | 0 | 2 | 0 |
| KA2 | 4 | 4 | 4 | 0 | 0 | 0 |
| KA3 | 1 | 1 | 1 | 0 | 0 | 0 |
| KA3-g | 2 | 2 | 2 | 0 | 0 | 0 |
| KA4 | 3 | 3 | 2 | 1 | 0 | 0 |
| TA | 8 | 8 | 6 | 2 | 0 | 0 |

Falhas conservadas (R0 — non se exclúen de capacidade alegada):
- `KA1/KA1-2` rc=4 esperado 0 — {"campo":"carga_forma","esperado":"lea.w/A1","medido":null,"motivo":"sen cadena"} — ERRO(4): fluxo: enderezo 0xFF8400 en rexión work-ram sen backing ROM
- `KA1/KA1-bsr.l` rc=0 esperado 0 — {"campo":"chamada_forma","esperado":"bsr.l","medido":"jsr.l"}
- `KA1/KA1-jsr.w` rc=0 esperado 0 — {"campo":"chamada_forma","esperado":"jsr.w","medido":"jmp.pcd16"}
- `KA1/KA1-jmp.l` rc=0 esperado 0 — {"campo":"chamada_forma","esperado":"jmp.l","medido":null}
- `KA1/KA1-jmp.w` rc=0 esperado 0 — {"campo":"chamada_forma","esperado":"jmp.w","medido":null}
- `KA4/KA4-2` rc=4 esperado 0 — {"campo":"saida_sha256","esperado":"38723a2e5e8a17aa7950dc008209944e898f69a7bd10a23c839d341e935fd5ca","medido":null}
- `TA/TA-3` rc=7 esperado 11 — {"campo":"rc","esperado":11,"medido":7} — chamada real declarada nun sitio lexítimo fóra da ventá tras a carga: só a xeometría pode rexeitala. Erata pré-medição de D: a receita original (+1, sitio ímpar) cae no elo sitio-chamada (bytes diverxentes, rc 5) porque A compara bytes antes de mirar o aliñamento — leído en verify.rs, non medido. A inalcanzabilidade da guarda de aliñamento queda rexistrada como observación de auditoría, non como fila do denominador.
- `TA/TA-5` rc=2 esperado 6 — {"campo":"rc","esperado":6,"medido":2} — operando .L alterado no registro, imagem inalterada

Excluídas do denominador (1) con motivo:
- `TA-controle/TA-2-control` → CONTROLADO: eixo identidade confunde a receita TA-2; queda como observación
### Frente B @ `cffe17f`

- evidencia: `medidas/B-cffe17f.jsonl` (sha `d47f10e45687…`, auditada: SI)
- denominador conxelado: 14 filas — fonte: data/rex_profiles/parallel_recovery_20261004/d/frentes/b/dB-truth-v1.json
- procedencia da ferramenta: `B_velho@cffe17f` — byte a byte co commit (4 ficheiros comparados, 0 diverxentes, 0 faltantes)

| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |
|---|---|---|---|---|---|---|
| KB1 | 4 | 4 | 4 | 0 | 0 | 0 |
| KB2 | 2 | 2 | 2 | 0 | 0 | 0 |
| KB3 | 4 | 4 | 4 | 0 | 0 | 0 |
| KB4 | 2 | 2 | 2 | 0 | 0 | 0 |
| NB | 2 | 2 | 2 | 0 | 0 | 0 |

Excluídas do denominador (4) con motivo:
- `audit/CONTROLE-IDENTIDADE-B` → CONTROLADO: a proba anexa de B é auditada recompoñendo D o digest da ROM e do descodificador que realmente se pasaron
- `audit/CONTROLE-SONDA-VIVA-B` → CONTROLADO: control que demonstra que as filas KB1 non son vacuas: a mesma sonda cega ante a mutación sería unha sona morta
- `audit/CONTROLE-ESPELLO-B` → CONTROLADO: ningunha fila de B conta a concordancia autor+espello como validación; o oráculo é a ROM
- `TC/CONTROLE-JSON-TAMPER-B` → NÃO APLICÁVEL: a ferramenta real non consume evidencia JSON como entrada (o `--out` só escribe); a receita de §6 non é alcanzable. O eixo de identidade medírase en NB-2 coa ROM adulterada, que é a entrada que B si valida.
### Frente B @ `396e0b8`

- evidencia: `medidas/B-396e0b8.jsonl` (sha `c506f0ffebf2…`, auditada: SI)
- denominador conxelado: 14 filas — fonte: data/rex_profiles/parallel_recovery_20261004/d/frentes/b/dB-truth-v1.json
- procedencia da ferramenta: `B@396e0b8` — byte a byte co commit (6 ficheiros comparados, 0 diverxentes, 0 faltantes)

| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |
|---|---|---|---|---|---|---|
| KB1 | 4 | 4 | 4 | 0 | 0 | 0 |
| KB2 | 2 | 2 | 2 | 0 | 0 | 0 |
| KB3 | 4 | 4 | 4 | 0 | 0 | 0 |
| KB4 | 2 | 2 | 2 | 0 | 0 | 0 |
| NB | 2 | 2 | 2 | 0 | 0 | 0 |

Excluídas do denominador (4) con motivo:
- `audit/CONTROLE-IDENTIDADE-B` → CONTROLADO: a proba anexa de B é auditada recompoñendo D o digest da ROM e do descodificador que realmente se pasaron
- `audit/CONTROLE-SONDA-VIVA-B` → CONTROLADO: control que demonstra que as filas KB1 non son vacuas: a mesma sonda cega ante a mutación sería unha sona morta
- `audit/CONTROLE-ESPELLO-B` → CONTROLADO: ningunha fila de B conta a concordancia autor+espello como validación; o oráculo é a ROM
- `TC/CONTROLE-JSON-TAMPER-B` → NÃO APLICÁVEL: a ferramenta real non consume evidencia JSON como entrada (o `--out` só escribe); a receita de §6 non é alcanzable. O eixo de identidade medírase en NB-2 coa ROM adulterada, que é a entrada que B si valida.
### Frente C @ `275f2af`

- evidencia: `medidas/C-275f2af.jsonl` (sha `7e5969d099d1…`, auditada: SI)
- denominador conxelado: 42 filas — fonte: EXTENSOES-D.md §5 (táboa conxelada; as fichas de C non pinan denominador)
- procedencia da ferramenta: `C@275f2af` — byte a byte co commit (46 ficheiros comparados, 0 diverxentes, 0 faltantes)

| capacidade | denominador | graduadas | PASS | falhas | non suportado | desconhecido |
|---|---|---|---|---|---|---|
| KC1 | 20 | 20 | 19 | 1 | 1 | 0 |
| KC2 | 6 | 6 | 6 | 0 | 0 | 0 |
| KC3 | 3 | 3 | 2 | 1 | 0 | 0 |
| KC4 | 4 | 4 | 3 | 1 | 0 | 0 |
| KC5 | 5 | 5 | 5 | 0 | 0 | 0 |
| TC | 4 | 4 | 4 | 0 | 0 | 0 |

Falhas conservadas (R0 — non se exclúen de capacidade alegada):
- `KC1/KC1-movea.l #imm32,A1` rc=0 esperado null — {"campo":"comportamento","esperado":"fronteira opcode-fora-do-subconjunto","medido":"decodificado como moveal #(0x00001111), %a1 (tam 6)"} — C aceptou unha forma fóra da súa lista fechada §3 sen declarala soportada; o eixo desta fila é a fronteira, non o comprimento
- `KC3/KC3-move-w-imm-an` rc=0 esperado null — {"campo":"fronteira","esperado":"fronteira no endereço","medido":"decodificado como moveaw %a0, %a0 (tam 2)"} — combinação destino An em MOVE.W é inválida no ISA
- `KC4/KC4-jmp-ind-an` rc=0 esperado null — {"campo":"fronteira","esperado":"indirect-opaco","medido":"indirect-opaque"}

Excluídas do denominador (6) con motivo:
- `audit/CONTROLE-IDENTIDADE-CX1` → CONTROLADO: a proba auditase recompondo o digest do --bin lido, non consultando o hash por existir
- `audit/CONTROLE-IDENTIDADE-CX2` → CONTROLADO: a proba auditase recompondo o digest do --bin lido, non consultando o hash por existir
- `audit/CONTROLE-IDENTIDADE-CX3` → CONTROLADO: a proba auditase recompondo o digest do --bin lido, non consultando o hash por existir
- `audit/CONTROLE-IDENTIDADE-CX4` → CONTROLADO: a proba auditase recompondo o digest do --bin lido, non consultando o hash por existir
- `TC/TC-4-control` → CONTROLADO: control observado: sen raíz extra a receita mide alcançabilidade, non lonxitude (errata §6)
- `audit/CONTROLE-COHERENCIA-CX1` → CONTROLADO: a diferenza ten de explicarse polas instrucións que C recusa na fronteira e non por bytes inventados; fronteiras non-de-región nesta rexión: ["0x00000A/203a","0x000042/ffff"]

## Holdouts (fora dos denominadores)

- `medidas/holdouts-v3.jsonl` (sha `38ea1a9068f8…`, auditada: SI)
  - A: 28/30 PASS, falhas H-A/TA-5, void nenhum, inconclusivas nenhuma
  - B: 4/4 PASS, falhas nenhuma, void nenhum, inconclusivas nenhuma
  - C: 5/5 PASS, falhas nenhuma, void nenhum, inconclusivas nenhuma
  - D: 0/2 PASS, falhas nenhuma, void H-A-v1-VOID, H-A-v2-VOID, inconclusivas nenhuma
  - VOID rexistrado contra D: `H-A-v1-VOID` — entrada inválida autorada por D: fluxo s2 (149 B en 0x9400) pisou o final de s1 (1157 B en 0x9000); o decodificador de D rexeita a imaxe (`referencia antes do historico`), polo que a recusa de A non informa sobre A
  - VOID rexistrado contra D: `H-A-v2-VOID` — streams válidos, pero a sonda lea.l d16(PC),A2 en 0x414 tiña desprazamento 0x8bec → asinado −28 924, alvo fóra da imaxe; a fila KA1-3 medía a autoría de D, non a forma de carga de A
