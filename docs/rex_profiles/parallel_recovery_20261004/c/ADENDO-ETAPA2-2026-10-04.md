# ADENDO datado — EXPECTATIONS-ETAPA2.md (2026-10-04)

Retificação de texto congelado, na forma prevista pelo protocolo do projeto
("Expectativas devem preceder a medição. Se o contrato estiver errado, faça uma
retificação versionada, preserve a história e reexecute os casos afetados").

Este arquivo **não reescreve** `EXPECTATIONS-ETAPA2.md`: o documento congelado
fica como foi assinado, e cada divergência entre o texto congelado e o contrato
já vigente (e medido) da ferramenta é registrada aqui, com evidência bruta,
endereço e comando. Nenhum limiar foi alterado; nenhuma medição foi refeita para
"fechar" um resultado. As oito retificações abaixo (A-1..A-8) corrigem **nomes de
representação**, **descrições de fixture** e **uma contagem manual** — o conteúdo
duro das expectativas (nenhum alvo numérico, nenhum `consumidor-validado: "sim"`,
nenhum grau promovido, denominadores por raiz) permanece exigido e testado. A
seção de
defeito registra o único caso em que o texto estava certo e a ferramenta não
estava (linha M11); a seção seguinte registra a **omissão** de um registro que o
texto congelado (§1.1) exigia e a implementação não publicava (P-absW), fechada
por teste primeiro; a seção de limitação registra o que ficou aberto.

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

**Errata (mesma data, depois de reler o vocabulário vigente):** o nome do **tipo
de fronteira** é `indirect-opaque` — não `indireto-opaco`, que é o *status de
aresta* (`Status::IndiretoOpaco`, `src/grafo.rs:82`). As duas strings aparecem na
série bruta acima: `fronteiras[0].tipo = "indirect-opaque"` e
`arestas[0].status = "indireto-opaco"`. Fonte do vocabulário: `CONTRACT.md` §4,
`src/decode.rs:36`, `src/grafo.rs:357`. A retificação permanece exatamente como
escrita — onde §1 M8/M9 diz `opcode-fora-do-subconjunto`, leia `indirect-opaque` —
e é verificada por teste em `tests/fx09_matriz.rs::m08_jmp_d16_pc_nao_vira_jsr_abs_w_nem_produce_alvo`
(fixture `fx09`, linha `0x44`, bytes `4efa 1234`).

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

## A-6 · §1 linhas M1/M2/M2b — o tipo de aresta que `BSR` produz

**Congelado:** "M1 … aresta `desvio` no alvo exato do instrumento"; "M2 … aresta
`desvio` resolvida".

**Medido (comportamento vigente desde a ETAPA 1, pinned por
`fixtures/fx04_calls`):** `BSR` é registrado como **`chamada`** — aresta
`chamada/resolvido`, entrada em `chamadas` e aresta `retorno-fronteira` no `rts`
alcançado. `desvio` é o tipo de `BRA`/`Bcc`/`DBcc` e de `JMP` absoluto (M6/M7).
Série bruta (`fx09`, raiz `m01` em `0x00`):

```
arestas:  [queda 0x00->0x02, chamada 0x00->0x04, queda 0x02->0x04,
           retorno-fronteira 0x04->null]
chamadas: [{sitio: 0x00, alvo: 0x04, forma: "bsr", status: "resolvido"}]
```

**Retificação:** leia "aresta `chamada`" onde §1 diz "aresta `desvio`" nas linhas
M1/M2/M2b. O conteúdo duro da linha não muda e é testado: alvo exatamente o do
instrumento (`0x04`, `0x88`, `0x06`), comprimentos 2/4/4, e o valor que a leitura
de `d16` sobre a forma curta produziria (`0x4E71 + base` = `0x4E75`) **não**
existe no grafo.

---

## A-7 · §1 linha M10 — `MOVEA` imediato não é fronteira

**Congelado:** "M10 … **fronteira** (`#imm` só em `MOVE`, §3)".

**Medido:** `CONTRACT.md` §3 lista `MOVE`/**`MOVEA`** .B/.W/.L entre modos 68000
válidos; o parentético "`#imm` só em MOVE" qualifica a família MOVE (grupo %001),
da qual `MOVEA` faz parte, e o próprio §3 encerra dizendo que a tabela exata vive
em `src/decode.rs` e é a única fonte. A linha é portanto decodificada:
`2a7c 12345678` → `moveal #(0x12345678),%a5`, comprimento **6**, igual ao
instrumento (`fx09_matriz_isa-objdump.txt`, registro `0x58`).

**Retificação:** onde §1 M10 diz "fronteira", leia "instrução comprovada de 6
bytes, sem alegação de operando". O discriminante da linha permanece e é testado:
nenhuma entrada em `chamadas`, nenhuma aresta que não seja `queda`, e o imediato
`0x12345678` não aparece como alvo em lugar nenhum. A linha de A que chama
`0A?? FC` de `movea.l #imm32,An` continua refutada — por M11, não por M10.

---

## A-8 · §3 tabela de `fx11_assimetrica` — a linha "arestas por (tipo,status)" contradiction

**Congelado** (`fixtures/fx11-expectativas.md` §2, derivada à mão **antes** de
qualquer execução da ferramenta, como exige `EXPECTATIONS-ETAPA2.md` §3 A3):

```
| arestas                     | 0   | 10  |
| arestas por (tipo,status)   | —   | chamada/resolvido 1 · chamada/fora-da-regiao 1
                                · chamada/indireto-opaco 1 · desvio/fora-da-regiao 1
                                · desvio/resolvido 1 · queda/resolvido 5
                                · retorno-fronteira/indireto-opaco 1 |   (soma 11)
```

As duas linhas da mesma tabela não concordam entre si: o detalhamento soma **11**
e a contagem diz **10**. A tabela é a expectativa, então a contradição tinha de
aparecer na primeira execução — e apareceu:

```
$ cargo test --test fx11_assimetrica        (primeira execução, 2026-10-04)
left:  [... "queda/resolvido" x4, "retorno-fronteira/indireto-opaco"]   (10 arestas)
right: [... "queda/resolvido" x5, "retorno-fronteira/indireto-opaco"]   (11)
```

**Série bruta** (`rex-cfg analyze --bin fixtures/fx11assimetrica.bin --origin 0x0
--region 0x0:0x100 --root 0x8 --root-prov candidato`, objeto SHA-256
`83d3b991…edcb2`; `arestas` do export, em ordem):

```
0x0a -> 0x0e  queda   resolvido        0x0a -> 0x22  chamada resolvido
0x0e -> 0x14  queda   resolvido        0x0e -> 0x128 chamada fora-da-regiao
0x14 -> 0x18  queda   resolvido        0x14 -> 0x128 desvio  fora-da-regiao
0x1a -> 0x1e  queda   resolvido        0x1a -> 0x08  desvio  resolvido
0x20 -> null  retorno-fronteira indireto-opaco
0x26 -> null  chamada indireto-opaco
```

**Arbitragem.** O objdump não publica arestas, então o árbitro aqui não é o
instrumento: é a regra de emissão **já congelada e já publicada** — `CONTRACT.md`
§4 com `aresta_de_desvio`/`aresta_de_chamada` (`src/grafo.rs:489` e `:505`, que
emitem `queda` **somente** no ponto de transferência) e `montar_blocos`
(`src/grafo.rs:778-822`, onde a juntura sintetiza a queda entre blocos e a corrida
linear dentro de um bloco não gera aresta — o próprio bloco a representa).
Essa regra emite `queda` **só** onde há ponto de transferência ou
juntura; a corrida linear *dentro* de um bloco não gera aresta — o próprio bloco
a representa. Foi assim nas evidências R1/R2/R3 da ETAPA 1 (PR #108), e a tabela
de `fx11` a replicou corretamente na sua coluna de blocos: `0x08:[2,4]`,
`0x18:[2,4]`, `0x1e:[2,2]`, `0x22:[4,2]` são quatro corridas de dois nós, e as
quatro quedas medidas são exatamente as de `0x0a`, `0x0e`, `0x14`, `0x1a`.

**Retificação:** na linha "arestas por (tipo,status)" de `raiz_b`, leia
**`queda/resolvido 4`** (não 5). Com isso a linha soma 10 e concorda com a linha
"arestas = 10", que sempre esteve certa. O erro foi de contagem manual: as
quedas intra-bloco (`0x08→0x0a`, `0x18→0x1a`, `0x1e→0x20`, `0x22→0x26`) foram
contadas como arestas. **Nenhuma outra célula da tabela muda** — blocos, pés por
bloco, nós, chamadas, fronteiras, bytes decodificados e frações bateram com o
instrumento na primeira execução.

**Por que a tabela não foi reescrita no próprio arquivo:** §3 A3 manda corrigir
divergência por adendo datado, nunca por reexecução nem por ajuste de limiar. O
valor original (`5`) fica como foi assinado; o arquivo da tabela recebe apenas
uma **linha de errata apontando para esta entrada**, com o valor retificado ao
lado. Como proteção contra a mesma classe de erro, `tests/fx11_assimetrica.rs`
passou a exigir o invariante que a tabela não garantia:
`|detalhamento (tipo,status)| == arestas.len()`.

**Segunda divergência registrada na mesma execução (expectativa minha, não da
tabela).** A primeira versão do teste afirmava `raizes.len() == 1` para `raiz_b`.
O export devolve **2**: `0x08 candidato` (declarada) e `0x22 dentro-de-fluxo`
(líder derivado do `bsr.w`). Isso é exatamente a regra §0 da própria tabela —
"líder = raiz declarada + **todo alvo interno de aresta**" — e o §0.1 do contrato,
que mantém o grau derivado sem promoção. O teste é que estava errado; foi
reformulado para contar **raízes declaradas** (`== 1`) e verificar a dupla
`(0x08, candidato)` / `(0x22, dentro-de-fluxo)`. A tabela não diz nada sobre o
comprimento de `raizes`, portanto não há retificação de expectativa aqui — só
correção de leitura minha, registrada para não virar "sucesso silencioso".

---

## Defeito encontrado pela matriz (linha M11) e corrigido

Não é retificação de texto: o texto previa duas saídas e a ferramenta não
produzia nenhuma delas.

**Medido antes da correção** (`fx09`, raiz `m11` em `0x62`, bytes `0a7c fc00`):

```
instrucoes: [{endereco: 0x62, tam: 6, mnem: "eoriw #(0xfc00), #(0x4e71)", classe: "eori"}]
```

O instrumento mede **4** bytes para esse par (`0a7c fc00  eoriw #-1024,%sr`). O
ramo "op1 imediato" do grupo %0000 lia o campo de destino como imediato do modo 7
e consumia uma word a mais: **engolia o `nop` de `0x66`** e deslocava todo o
caminho seguinte, produzindo exatamente a classe de fraude que a barreira existe
para impedir — comprimento não comprovável promovido a instrução.

**Sonda no instrumento pinado** (`as -m68000` + `objdump`, arranhacopios, nada
versionado) para separar ISA de defeito:

```
   0: 0a3c 0003   eorib #3,%ccr      <- destino modo 7 %011 = CCR, 4 bytes
   4: 007c 0007   oriw  #7,%sr       <- destino modo 7 %100 = SR,  4 bytes
   8: 027c 00ff   andiw #255,%sr     <- idem, 4 bytes
```

e o montador `-m68000` **recusa** `bset #3,#0x1234`, `btst #3,%sr` e
`subi #12,%ccr` ("operands mismatch") — essas formas não são ISA 68000.

**Correção (estrita, não amplia a ISA):** em `src/decode.rs`, o ramo "op1
imediato" passa a recusar destino modo 7 com registrador `>= 3` (CCR %011,
SR/imediato %100, reservados %101..%111), seguindo a regra de destino já usada em
MOVE (`dmode == 7 && dreg >= 2`) e nos grupos unário/Scc/ADDQ
(`mode == 7 && mreg >= 4`). Absoluto W/L e `d16(PC)` ficam como estavam. A linha
M11 fecha na opção (a) congelada em §1:

```
rex-cfg/v1 — ... regiao 0x0..0x8c — blocos=0 arestas=0 chamadas=0 fronteiras=1
                                     cobertura=0/140 (0.0000)
fronteiras: [{endereco: 98, tipo: "opcode-fora-do-subconjunto", opcode: 2684,
              motivo: "op1 imediato com destino CCR/SR, PC ou reservado fora da lista §3"}]
```

**Custo de reexecução:** suite do crate de 57 para **74** testes (17 da matriz),
sem regressão em ETAPA 1 (`fx01..fx11`, calibração, CLI, export, consultar).
Nenhum limiar ou texto foi alterado para acomodar o resultado.

---

## Omissão encontrada e fechada (§1.1 P-absW)

Não é retificação de texto nem defeito de decodificação: é **campo que o texto
congelado exigia e a ferramenta não publicava**.

**Exigência congelada** (`EXPECTATIONS-ETAPA2.md` §1.1): para `(xxx).W`, a
ferramenta exporta o operando bruto **e** declara em `limites` a hipótese
`extensao-abs-w-hipotese-zero-extendida`; quando o word tem bit15 ligado, o
registro é `interpretacao-pendente` — "**não é FAIL nem PASS**" — e "nenhuma
classificação estrutural de sítio (§5) pode depender dessa interpretação".

**Como foi achado.** Ao redigir `CONTRACT.md` §2.1 (a extensão datada do
subcomando `consultar`), o texto que escrevi afirmava o registro
`interpretacao-pendente`. O grep em `src/sitio.rs` devolveu **zero** ocorrências
de `pendente`/`abs-w`/`hipotese`. Um contrato não pode afirmar campo que a
ferramenta não emite, e a expectativa congelada não pode ser rebaixada para
caber no código: corrigiu-se o **código**, com teste primeiro.

**RED observado** (antes da implementação):

```
$ cargo test --test consultar pabsw
test result: FAILED. 1 passed; 2 failed; 0 ignored
```

As duas falhas são `pabsw_hiptese_de_extensao_declarada_em_limites` (o `limites`
do despacho não continha a hipótese) e
`pabsw_jsr_abs_w_bit15_registra_interpretacao_pendente_sem_mudar_veredito` (o
`motivos` do despacho não continha o registro); ambas derrubaram mostrando o
JSON inteiro do despacho, e o texto impresso acima em "antes" é exatamente esse
corpo. O controle `pabsw_abs_l_alvo_grande_nao_registra_pendencia` já estava
verde — é controle, não expectativa nova.

**Série bruta — antes** (sítio `0x20` de `fx09_matriz_isa.bin` = `4eb8 8000`,
raiz declarada ali, região `0x0:0x8c`):

```
"alvo": "0x008000", "alvo-status": "fora-da-regiao",
"consumidor-validado": "sim", "promovivel-vinculo-estrutural": "nao",
"motivos": ["proveniencia-nao-autoriza-vinculo:candidato"],
"limites": [3 textos, nenhum sobre extensao]
```

**Depois** (mesmo comando, `src/sitio.rs` com `absw_bit15` + 4º texto de limite):

```
"alvo": "0x008000", "alvo-status": "fora-da-regiao",
"consumidor-validado": "sim", "promovivel-vinculo-estrutural": "nao",
"motivos": ["interpretacao-pendente:abs-w-bit15",
            "proveniencia-nao-autoriza-vinculo:candidato"],
"limites": [..., "extensao-abs-w-hipotese-zero-extendida",
            "raiz-declarada-nao-promovida"]
```

**Controle (a régua do negativo).** `0x3a` = `4ef9 00800000` (`jmp (xxx).L`,
linha M7): alvo grande, fora da região, **sem** registro de pendência —
`motivos: ["proveniencia-nao-autoriza-vinculo:candidato"]`. O registro é ancorado
na **forma** do operando (word com bit15), não na grandeza ou no status do alvo;
uma implementação que empurrasse a pendência por "alvo suspeito" passaria no
positivo e quebraria aqui.

**Invariantes preservados.** (i) O registro é calculado **depois** de
`consumidor-validado`, então nenhuma classificação estrutural depende da
interpretação — como exige §1.1; (ii) nenhum limiar, nenhum `alvo` numérico e
nenhum grau mudaram; (iii) `LEA (xxx).W` (linha M12) não recebe o registro porque
`lea` nunca alega alvo — a divergência de **exibição** com o instrumento
(`ffff8000`) continua registrada por teste em `tests/fx09_matriz.rs::m12_…`.

**Onde NÃO foi fechado (e por quê).** O export `rex-cfg/v1` do `analyze`
continua com os textos de `limites` congelados na ETAPA 1. Acrescentar a hipótese
lá alteraria um export cuja evidência (R1/R2/R3) já foi publicada no PR #108 — o
protocolo manda preservar a história, não ganhar uma coluna às custas dela. A
hipótese é visível na resposta de `consultar` (que é a interface de barreira
destinada a A) e a divergência de exibição da matriz está pinada por teste.

---

## Limitação registrada (não corrigida nesta etapa)

A mesma fenda existe nos dois ramos de *bitop* do grupo %0000
(`src/decode.rs:501-503` e `:522-524`): o registrador %100 do modo 7 como destino
cai em `read_ea` e consome uma word. Como `as -m68000` recusa a forma (medido
acima), ela só aparece por bytes crus, e fechar esse ramo sem fixture montado pelo
instrumento seria mudança sem teste. **Proposta para a ETAPA 3:** fixture autoral
novo com `.short 0x08fc, 0x0003, 0x1234` (motivo declarado na linha) e recusa
`reg >= 2` nesses dois ramos. Nada foi alterado aqui.

---

## Efeito nos casos afetados

A coluna **resultado** é preenchida somente pela reexecução dos casos afetados;
antes dela, o estado é `REEXECUTAR` — nenhuma expectativa retificada conta como
verificada por este documento.

| caso | texto congelado | reexecução | resultado (2026-10-04) |
|---|---|---|---|
| §1 M8/M9 | nome da fronteira | `tests/fx09_matriz.rs::m08_…`, `m09a_…`, `m09b_…` | VERIFICADO — `indirect-opaque` nos três; `alvo: null`, `chamada/indireto-opaco`, nenhum alvo numérico no grafo |
| §1 M1/M2/M2b | nome da aresta (A-6) | `m01_…`, `m02_…`, `m02b_…` | VERIFICADO — `chamada` com alvo do instrumento (`0x04`/`0x88`/`0x06`), comprimentos 2/4/4, alvo da leitura `d16` (`0x4E75`) ausente |
| §1 M10 | "fronteira" (A-7) | `m10_…` | VERIFICADO — 6 bytes, classe `movea`, zero `chamadas`, zero alvos (`0x12345678` não alegado) |
| §1 M11 | opção (a) ou (b) | `m11_…` | VERIFICADO **após** a correção — opção (a): fronteira `opcode-fora-do-subconjunto`, opcode `0x0A7C`; antes: comprimento 6 inventado (seção de defeito) |
| §1 M3 | fronteira 68020 | `m03_…` | VERIFICADO — `opcode-fora-do-subconjunto`, `blocos=0`, nenhum alvo |
| §1 M4/M5/M6/M7/M12/M13/M14 | alvo/comprimento | `m04_`…`m14b_…` | VERIFICADO — paridade com o instrumento linha a linha; P-absW registrado (`0x8000` bruto vs. `0xFFFF8000` exibido) |
| §2 B2/B3 | miolos e ilha | `tests/consultar.rs::b2_…`, `b3_…` | VERIFICADO — `miolo-de-instrucao:0x000028` / `:0x00002C`, `veredito: miolo-de-instrucao`, zero chamadas na ilha |
| §2 B6 | "sem arestas nem chamadas" | `b6_jmp_d16_pc_nao_produz_alvo_nem_consumidor`, `b6_ilha_sem_raiz_declurada_nao_gera_chamadas` | VERIFICADO — `alvo` nulo, `motivos = ["alvo-nao-comprovado"]`, zero `chamadas` sem raiz |
| §5 | chave `sitio` | `v5_saida_passa_no_parser_de_a_na_ordem_congelada` | VERIFICADO — 22 chaves na ordem congelada, aceita pelo parser estrito |
| §5 V1-iv | equivalência | `equivalencia_alvo_igual_ao_operando_medido_para_bsr_word`, `equivalencia_sinal_de_deslocamento_negativo` | VERIFICADO — re-derivação independente coincide com o grafo nos dois sítios com alvo |
| §3 A1/A3 | denominadores e pés por bloco de `fx11` | `tests/fx11_assimetrica.rs::a1_raiz_a_…`, `a1_raiz_b_…`, `a3_raiz_b_reproduz_os_pes_de_cada_bloco`, `a3_raiz_b_nada_fora_da_regiao_e_decodificado` | VERIFICADO na 1ª execução — 6 blocos com os pés `0x08:[2,4] 0x0e:[6] 0x14:[4] 0x18:[2,4] 0x1e:[2,2] 0x22:[4,2]`, 32/256 = `0.1250`, 2/256 = `0.0078`, nada ≥ `0x100` decodificado; **exceção**: linha `(tipo,status)` (A-8) |
| §3 A2 | assimetria, fronteiras e chamadas | `a2_raiz_a_para_no_opcode_recusado_…`, `a2_fronteiras_de_b_sao_tres_…`, `a2_chamadas_de_b_exatamente_uma_por_status_…`, `a2_assimetria_e_a_prova_…`, `a1_laco_e_retorno_…` | VERIFICADO — `fronteiras(b) = [(0x0e, limite-de-regiao), (0x14, limite-de-regiao), (0x26, indirect-opaque)]` (2 tipos), `chamadas(b)` com 1 `resolvido` (→`0x22`), 1 `fora-da-regiao` (→`0x128`) e 1 `indireto-opaco` com `alvo: null`; `0x14` (desvio) não gera chamada; nenhum tipo de `raiz_a` aparece em `raiz_b` |
| §3 A4 | proibição de agregado | `a1_raiz_a_…` + `a1_raiz_b_…` (duas análises, cada uma com `bytes_regiao = 256`) | VERIFICADO — nenhuma métrica agregada é computada nem exportada; as duas frações coexistem com denominador próprio |
| §3 A3 | tabela manual ↔ ferramenta | primeira execução de `cargo test --test fx11_assimetrica` | **FAIL exposto** na linha `(tipo,status)` (5 quedas vs. 4 medidas) → retificado por **A-8**; a linha "arestas = 10" e todas as demais células bateram. Correção de leitura minha registrada em A-8 (`raizes` inclui o líder derivado `0x22`) |

| §1.1 P-absW | registro + hipótese em `limites` | `tests/consultar.rs::pabsw_hiptese_de_extensao_declarada_em_limites`, `pabsw_jsr_abs_w_bit15_…`, `pabsw_abs_l_alvo_grande_nao_registra_pendencia` | VERIFICADO **após** fechar a omissão — `motivos` com `interpretacao-pendente:abs-w-bit15` no sítio `0x20`, `alvo` inalterado (`0x008000`), `consumidor-validado` inalterado (`sim`), e o controle `jmp abs.L` em `0x3a` sem registro |

Execução integral na mesma data, no crate da frente C:
`cargo test` → **87 passed (11 suites)** (74 da rodada anterior + 10 de
`fx11_assimetrica` + 3 de P-absW); `cargo clippy --all-targets` → **No issues
found**; `cargo fmt -- --check` → limpo. Os 22 testes de `consultar` e os 17 da
matriz estão nessa contagem; nenhum teste anterior foi reescrito para fechar
resultado, e nenhuma regra de emissão de arestas foi alterada (a divergência de
`fx11` foi resolvida **na tabela**, não no código).

Nada foi alterado em `EXPECTATIONS-ETAPA2.md`. Este arquivo é a única correção
de texto da ETAPA 2 até aqui; divergências novas entram por adendo datado
seguinte, nunca por reescrita.
