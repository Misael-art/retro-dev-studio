# Tabela manual de `fx11_assimetrica` — derivada da fonte `.s`, ANTES de executar a ferramenta

Exigência: `EXPECTATIONS-ETAPA2.md` §3, caso A3. Esta tabela é a expectativa; a
ferramenta é que é comparada a ela. Divergência ferramenta ↔ tabela = **FAIL**.
Divergência tabela ↔ instrumento = a tabela é corrigida por **Adendo datado**
(`ADENDO-ETAPA2-*.md`), nunca por reexecução nem por ajuste de limiar.

## 0. Derivação

Endereços e comprimentos vêm da fonte `.s` (montador pinado, `ld -Ttext 0 -e fx11`)
e são conferidos na referência independente `fx11_assimetrica-objdump.txt`, que é
gerada pelo mesmo pipeline de `tools/make-fixtures.sh`. As regras de aresta/
chamada/fronteira usadas para contar são as de `CONTRACT.md` §4 e §0 (as mesmas
que produziram a evidência R1/R2 da ETAPA 1) — nenhuma contagem vem da ferramenta.

Regras aplicadas, na ordem:

| Situação | Efeito no export (CONTRACT §4) |
|---|---|
| `bsr`/`jsr` com alvo **dentro** da região | aresta `chamada(resolvido)` + aresta `queda(resolvido)` + 1 entrada em `chamadas` + o alvo vira **líder** de bloco |
| `jsr` com alvo **fora** | aresta `chamada(fora-da-regiao)` + `queda(resolvido)` + 1 `chamadas(forа-da-regiao)` + **fronteira `limite-de-regiao`** no sítio; nada fora é decodificado |
| `beq.w` com alvo fora, com fallthrough | aresta `desvio(fora-da-regiao)` + `queda(resolvido)` + fronteira `limite-de-regiao`; sem entrada em `chamadas` |
| `dbra` com alvo dentro | aresta `desvio(resolvido)` + `queda(resolvido)` |
| `rts` | aresta `retorno-fronteira` (alvo nulo); o caminho termina |
| `jmp (An)` | **nó** com comprimento de tabela (2) + fronteira `indirect-opaque` + aresta `chamada(indireto-opaco)` + `chamadas(alvo=nulo)` |
| `bkpt #n` | família recusada (§6, mesmo caso pinado em `calib2 0xf4`): fronteira `opcode-fora-do-subconjunto`, **sem nó**, caminho para |
| líder | raiz declarada + todo alvo interno de aresta |
| bloco | corrida maximal de nós contíguos a partir de um líder, parada em terminador, vão ou próximo líder |

## 1. Fonte (endereços derivados do `.s`)

```
0x00 raiz_a: moveq #0,%d3        7600            2 B
0x02         bkpt #3             484b            (recusada)
0x04         nop                 4e71            nao alcancado
0x06         rts                 4e75            nao alcancado

0x08 raiz_b: moveq #0,%d7        7e00            2 B
0x0a         bsr.w sub_b         6100 0016       4 B   alvo 0x22 (dentro)
0x0e         jsr   longe_b:l     4eb9 0000 0128  6 B   alvo 0x128 (fora)
0x14         beq.w longe_b       6700 0112       4 B   alvo 0x128 (fora)
0x18         addq.l #1,%d1       5281            2 B
0x1a         dbra  %d5,raiz_b    51cd ffec       4 B   alvo 0x08 (dentro)
0x1e         nop                 4e71            2 B
0x20         rts                 4e75            2 B
0x22 sub_b:  movem.l %d2-%d5,%sp@-  48e7 3c00    4 B   (so comprimento)
0x26         jmp (%a2)           4ed2            2 B   alvo desconhecido
0x128 longe_b: (FORA da regiao declarada — nao deve ser decodificado)
```

## 2. Expectativa por raiz — região `[0x00, 0x100)` (256 bytes), uma raiz por análise

| métrica | `raiz_a` | `raiz_b` |
|---|---|---|
| blocos (entradas) | 1 → `{0x00}` | 6 → `{0x08, 0x0e, 0x14, 0x18, 0x1e, 0x22}` |
| instruções por bloco | `0x00:2` | `0x08:[2,4]` `0x0e:[6]` `0x14:[4]` `0x18:[2,4]` `0x1e:[2,2]` `0x22:[4,2]` |
| instruções (nós) | 1 | 10 |
| arestas | 0 | 10 |
| arestas por `(tipo,status)` | — | `chamada/resolvido 1` · `chamada/fora-da-regiao 1` · `chamada/indireto-opaco 1` · `desvio/fora-da-regiao 1` · `desvio/resolvido 1` · `queda/resolvido 5` · `retorno-fronteira/indireto-opaco 1` |
| chamadas | 0 | 3 — `0x0a resolvido`, `0x0e fora-da-regiao`, `0x26 indireto-opaco (alvo=nulo)` |
| fronteiras | 1 — `0x02 opcode-fora-do-subconjunto` | 3 — `0x0e limite-de-regiao`, `0x14 limite-de-regiao`, `0x26 indirect-opaco` |
| bytes-decodificados | 2 | 32 |
| fração (2/256, 32/256) | `0,0078` | `0,1250` |
| vãos cobertos | `0x02..0x100` exceto nós | idem, menos os nós acima |

Relações exigidas por `EXPECTATIONS-ETAPA2.md` §3 A2:

- `|blocos(b)| = 6 > 1 = |blocos(a)|` ✓
- `fronteiras(a) = 1` do tipo `opcode-fora-do-subconjunto` ✓
- `fronteiras(b) = 3`, com **dois tipos distintos**: `indirect-opaco` e
  `limite-de-regiao` (este último é o vocabulário exportado para "alvo fora da
  região"; o *status* da aresta correspondente é `fora-da-regiao`) ✓
- `chamadas(b)` contém exatamente **uma** entrada `fora-da-regiao` e **uma**
  `resolvido` ✓ (a terceira é `indireto-opaco`, com `alvo = nulo`)

## 3. O que a tabela **não** promete

- Nada sobre o conteúdo de `longe_b` (fora da região): a análise não deve
  decodificá-lo, e isso é medido por `bytes-decodificados`, não por promessa.
- Nada sobre fração global das duas raízes: agregar é proibido (A4).
- Nada sobre `mnem` exato além da família (apresentação, §0.4).
