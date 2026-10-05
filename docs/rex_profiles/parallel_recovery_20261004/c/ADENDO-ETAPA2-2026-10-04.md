# ADENDO datado — EXPECTATIONS-ETAPA2.md (2026-10-04)

Retificação de texto congelado, na forma prevista pelo protocolo do projeto
("Expectativas devem preceder a medição. Se o contrato estiver errado, faça uma
retificação versionada, preserve a história e reexecute os casos afetados").

Este arquivo **não reescreve** `EXPECTATIONS-ETAPA2.md`: o documento congelado
fica como foi assinado, e cada divergência entre o texto congelado e o contrato
já vigente (e medido) da ferramenta é registrada aqui, com evidência bruta,
endereço e comando. Nenhum limiar foi alterado; nenhuma medição foi refeita para
"fechar" um resultado. As cinco retificações abaixo corrigem **nomes de
representação** e **descrições de fixture** — o conteúdo duro das expectativas
(nenhum alvo numérico, nenhum `consumidor-validado: "sim"`, nenhum grau
promovido, denominadores por raiz) permanece exigido e testado.

Instrumento pinado (mesmo da calibração): binutils 2.41 `m68k-elf-*` em
`/home/misael/.cache/retrodevstudio/17f7bcf5…/source-build-m68k_gcc/source/install/bin`.
Fixtures autorais ETAPA 2, commit `618b3023a38f6e688aa57a60816c19af6d174d5a`:

| fixture | SHA-256 do `.bin` | tamanho |
|---|---|---|
| `fx09_matriz_isa.bin` | `b9f76bea893d690588f5803c7f6b393627dc223f2d864ed8f193c9a27c059924` | 140 |
| `fx10isca.bin` | `fc892d2aba88078ff27a905871464bc3b9bfa8ad1e4d6a6a58d5ac23517f268d` | 78 |
| `fx11assimetrica.bin` | `83d3b9918b40c16433037709d78dad59dcb524a009b6f24eb1a1fdad9d0edcb2` | 300 |

---

## A-1 · §1 linhas M8/M9 — o nome do tipo de fronteira

**Congelado:** "M8 … **fronteira** `opcode-fora-do-subconjunto`"; "M9 … **fronteira**"
(sem nome, mesma coluna).

**Medido (contrato vigente desde ETAPA 1, `CONTRACT.md` §4 e `src/decode.rs`):**
JSR/JMP cujo modo de endereço **é válido em 68000** mas está fora da lista fechada
do §3 (que só autoriza `(xxx).W` e `(xxx).L`) recebe a fronteira
`indirect-opaco`, com `alvo = null` — não `opcode-fora-do-subconjunto`, que é o
vocabulário para **opcode ausente da tabela** (ex.: `bkpt`, família recusada).

Evidência bruta (`fx10isca.bin`, raiz declarada sobre a isca de `4E FA`):

```
$ rex-cfg analyze --bin fixtures/fx10isca.bin --origin 0x0 --region 0x0:0x4e \
    --root 0x40 --root-prov candidato --site 0x40 --out …/b6.json
fronteiras: [{"endereco": 64, "tipo": "indirect-opaque", "opcode": 20218,
              "motivo": "JSR/JMP com alvo nao comprovado (indireto ou PC) — permanece desconhecido"}]
arestas:    [{"origem": 64, "alvo": null, "tipo": "chamada", "status": "indireto-opaco"}]
chamadas:   [{"sitio": 64, "alvo": null, "forma": "jmp", "params": "nao-inferidos",
              "clobbers": "nao-modelado", "status": "indireto-opaco"}]
```

**Retificação:** onde §1 M8/M9 diz `opcode-fora-do-subconjunto`, leia
`indirect-opaco`. **O que a linha exige não muda:** nenhum alvo numérico é
publicado, nenhuma aresta `chamada(resolvido)` existe, `consumidor-validado` é
`"nao"`, e o par `(JSR, abs.W)` que a frente A alega para `4E FA` continua
refutado — agora também pela re-derivação de V1-iv, que devolve `None` para o
sub-modo 2 do modo 7.

**Por que não se mudou o código para satisfazer o texto:** `indirect-opaco` com
nó de comprimento comprovado é comportamento congelado em `CONTRACT.md` §4 e
pinned por `fixtures/fx05_indirect` na ETAPA 1, cuja evidência (R1/R2/R3) já foi
publicada no PR #108. Alterá-lo exigiria reexecutar e republicar a ETAPA 1 inteira
para ganhar um nome de coluna. Registra-se a divergência, não se quebra a
evidência anterior.

---

## A-2 · §2 caso B6 — "não geram arestas nem `chamadas`"

**Congelado:** "B6: `4efa`/`4efc` na ilha **não** geram arestas nem `chamadas`; o
caminho para na fronteira."

**Medido:** quando — e somente quando — o operador **declara a isca como raiz**, o
grafo registra um nó de comprimento de tabela (4 para `4E FA`, 2 para `4E FC`),
**uma** aresta `chamada/indireto-opaco` com `alvo: null` e **uma** entrada em
`chamadas` com `alvo: null`. A série bruta está em A-1.

**Retificação:** o negativo duro de B6 é reformulado, sem enfraquecer a exigência:

- **nenhum `alvo` numérico** é publicado (é `null` nos dois casos);
- **nenhuma aresta com status `resolvido`** sai do sítio;
- `consumidor-validado: "nao"` e `promovivel-vinculo-estrutural: "nao"`;
- dentro de dado não alcançado (sem raiz ali), **não existe** entrada em `chamadas`
  para aquele span — é o que B2 mede, e mede.

Ou seja: a isca gera uma *fronteira honesta com alvo nulo*, não um consumidor. O
texto original ("zero arestas, zero chamadas") descrevia o efeito desejado em
termos que o vocabulário do contrato não usa; a coluna `alvo` é o que discrimina.

---

## A-3 · §2 item 2 — descrição do caso "miolo"

**Congelado:** "uma instrução de **6 bytes** dentro de um bloco alcançado cujo
**segundo word** é `4efc` …; e outra cujo **terceiro word** é `4eb9`."

**Medido no fixture montado (`fx10isca-objdump.txt`, instrumento):**

```
00000028 <comisco>:
  28: 942c 4efc        subb %a4@(20220),%d2      <- 4 bytes; SEGUNDO word = 4efc
  2c: 223c 1234 4eb9   movel #305417913,%d1      <- 6 bytes; TERCEIRO word = 4eb9
  32: 4e75             rts
```

**Retificação:** a aparência `4efc` é o segundo word de uma instrução de **4**
bytes (não 6); a aparência `4eb9` é o terceiro word da instrução de 6 bytes
seguinte. Os dois miolos medidos pelos testes são `0x2A` (dentro de `0x28`) e
`0x30` (dentro de `0x2C`), ambos em `bloco: "0x000028"`, ambos com motivo
`miolo-de-instrucao:0x000028` / `miolo-de-instrucao:0x00002C`. O espelho do caso
de ROM medido em `0x31DCC` (`subb %a4@(20220),%d2`) continua válido e é o
motivo pelo qual o `4efc` está ali.

---

## A-4 · §5 lista de chaves — token solto `sítio→ "sitio"`

**Congelado:** a lista de chaves contém `sítio→ "sitio"`, que é anotação do autor
do documento (a chave a emitir é ASCII), não uma chave.

**Retificação:** a chave emitida é **`sitio`**, como já constava da anotação. A
ordem congelada de 22 chaves é respeitada byte a byte e é verificada por teste
(`v5_saida_passa_no_parser_de_a_na_ordem_congelada`).

---

## A-5 · §5 V1-iv — forma de avaliar a equivalência com a assinatura congelada

**Congelado:** V1-(iv) exige que "o alvo declarado no sítio é igual ao operando
medido", e a assinatura de `consultar` **não** traz flag para o operador declarar
um alvo externo.

**Decisão registrada:** a equivalência é avaliada **dentro da ferramenta**, com
uma reimplementação independente do cálculo do alvo a partir dos bytes do objeto
(`src/sitio.rs::rederivar`), e só se aplica quando o grafo **alega** um alvo
(`alvo != null`). Assim:

- o defeito que a regra quer pegar — alvo inventado, como o `jsr abs.w` que A
  publica para `4E FA` — falha, porque a re-derivação devolve `None` para os
  sub-modos 2/3/6/7 do modo 7 e a discrepância é publicada em `motivos`;
- um sítio sem alegação de alvo não é "reprovado duas vezes": o motivo é
  `alvo-nao-comprovado` (V1-iii), único;
- a comparação com um alvo *declarado por A* continua possível do lado de A: a
  resposta publica `alvo` e `alvo-status`, e A tem a sua própria cópia do operando.
  Não se estendeu a assinatura congelada depois do congelamento para aceitar um
  `--espera-alvo`.

---

## Efeito nos casos afetados

A coluna **resultado** é preenchida somente pela reexecução dos casos afetados;
antes dela, o estado é `REEXECUTAR` — nenhuma expectativa retificada conta como
verificada por este documento.

| caso | texto congelado | reexecução | resultado |
|---|---|---|---|
| §1 M8/M9 | nome da fronteira | `tests/consultar.rs` + matriz `fx09` | REEXECUTAR |
| §2 B2/B3 | miolos e ilha | `b2_*`, `b3_*` | REEXECUTAR |
| §2 B6 | "sem arestas nem chamadas" | `b6_jmp_d16_pc_nao_produz_alvo_nem_consumidor` | REEXECUTAR |
| §5 | chave `sitio` | `v5_saida_passa_no_parser_de_a_na_ordem_congelada` | REEXECUTAR |
| §5 V1-iv | equivalência | `equivalencia_*` | REEXECUTAR |

Nada foi alterado em `EXPECTATIONS-ETAPA2.md`. Este arquivo é a única correção
de texto da ETAPA 2 até aqui; divergências novas entram por adendo datado
seguinte, nunca por reescrita.
