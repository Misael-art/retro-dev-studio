# EXTENSÕES-D v1 — extensão do contrato `rds-d-export/1` para os domínios das frentes A/B/C

**Status:** congelado antes de qualquer medição (precedente: `EXPECTATIONS-D.md`,
commit-so `a90b5c2`). Nenhuma linha deste documento pode ser reescrita depois de
haver medição. Se um contrato estiver errado, faz-se uma **retificação versionada**
(`EXTENSÕES-D v2`) preservando o histórico e re-executam-se os casos afetados;
nunca se ajustam limiares para acomodar resultados.

**Base fixada:** `codex/rex-sonic-sequencia` @ `cb56657a142df40d2acd09a3e03e54247f066dea`.
**Território:** `scripts|docs|data/rex_profiles/parallel_recovery_20261004/d/`.
**Frentes avaliadas (inventário datado 2026-10-04, fim de sessão):**

| frente | branch | SHA medido | entregável principal |
|---|---|---|---|
| A | `codex/rex-parallel-a-kosinski-chains` | `cbb6895` | crate `rex-chain`, schema `rex-kosinski-chain/v1`, 4 verbos CLI |
| B | `codex/parallel-recovery-20261004-b` | `cffe17f` | `contrato_sonic.py`, `verificar-cadeia.py`, evidência JSON |
| C | `codex/rex-parallel-c-cfg` | `275f2af` | crate `rex-cfg`, schema `rex-cfg/v1`, fixtures fx01–fx08 |

A observação histórica de 2026-09/10-04 («nenhuma entrega A/B/C disponível para
medição») permanece registrada no `RELATORIO-D.md` §8 como estado do momento;
este documento substitui apenas a conclusão operacional («aguardando exports»).

**Inventário datado 2026-10-05 (fim da rolda de avaliación; non reescribe a
táboa anterior, engádea):**

| frente | branch | SHA medido | observación |
|---|---|---|---|
| A | `codex/rex-parallel-a-kosinski-chains` | `cbb6895` | medido (29 filas) — ningun SHA corrigido publicado nesta data |
| B | `codex/parallel-recovery-20261004-b` | `cffe17f` → `396e0b8` | a fronte re-publicou durante a rolda; D mide **os dous SHAs** co mesmo contrato (`contrato_sonic.py` idéntico por hash) e rexístrao como filas separadas |
| C | `codex/rex-parallel-c-cfg` | `275f2af` | medido (42 filas) — ningun SHA corrigido publicado nesta data |

Maturidade: ningunha fila desta rolda pasa de `vínculo estrutural` — non houbo
execución de ROM nin consumo observado. Vexase `RELATORIO-D.md` §8.

**Inventário datado 2026-10-05 (segunda actualización; substitúe só a columna
«observación» da táboa anterior, que queda como estado do momento en que se
escribiu):**

| frente | branch | SHA medido por D | observación á hora desta actualización |
|---|---|---|---|
| A | `codex/rex-parallel-a-kosinski-chains` | `cbb6895` **e** `bd40e92` | a fronte publicou `bd40e92` (HEAD do PR #107) *despois* da primeira medición: `1344f4c` «corrección v1.1 do subconxunto 68000» + `4aa6ba9` «elo vinculo-chamada-rutina». D mide o SHA novo **coas mesmas expectativas conxeladas de §3** — ningún denominador, limiar ou fila se reescribiu para el. Resultado: `A@bd40e92` 21/29 con 8 filas en fallo (7 delas en PASS no SHA anterior). Vexase `RELATORIO-D.md` §10. |
| B | `codex/parallel-recovery-20261004-b` | `cffe17f`, `396e0b8` | o HEAD do PR #105 avanzou a `08024d9` (roda CRAM/RAM `b3`); os dous ficheiros que D executa están **idénticos por blob** en `396e0b8` e `08024d9` (`verificar-cadeia.py` = `0d8aae2eb7…`, `contrato_sonic.py` = `adad4fa8a6…`), polo que a medición de §4 segue valendo e `08024d9` non se conta como segunda proba. |
| C | `codex/rex-parallel-c-cfg` | `275f2af` | sen SHA corrixido publicado: HEAD de `origin` e do PR #108 seguen en `275f2af`. A existencia dun worktree local da fronte noutro commit non é evidencia publicada e non se mide. |

---

## 0. Por que uma extensão, e o que ela NÃO é

O contêiner `RDSDBNCH` e os codecs `dsb1-*` da barra D são **formato interno do
benchmark autoral de codecs/streams**. Eles NÃO são o formato de entrada das
frentes A/B/C, cujos domínios são: ROM Genesis linear + cadeias Kosinski (A),
layout/projeção Enigma-WRAM (B), e CFG 68000 intra-região (C).

Consequências vinculantes:

1. A barra **não exige** que A/B/C implementem o contêiner, os codecs `dsb1-*`
   ou o export `rds-d-export/1` literal para receberem nota.
2. A avaliação é feita por **adaptadores da frente D** que executam as CLIs
   reais das frentes sobre fixtures no domínio delas e **mapeiam** os campos do
   export nativo para as dimensões desta extensão.
3. As regras fail-closed R1–R7 do `CONTRACT-EXPORT-D.md` são herdadas
   integralmente, mais três regras novas (§2).

## 1. Vocabulário de quatro categorias (obrigatório em toda linha)

| categoria | definição | efeito no escore |
|---|---|---|
| **não aplicável** | a capacidade não pertence ao domínio declarado da frente (ex.: geometria de tiles para C) | excluída do denominador COM linha explicando o porquê |
| **não suportado** | a frente declara a forma fora do seu subconjunto e o comportamento correto é recusar sem alegação | a recusa correta é o item medido; a forma em si não vira «acerto de decode» |
| **desconhecido** | o export não traz o campo, a dependência externa está ausente, ou o item não foi medido | conta como `not_found`; **nunca** como zero favorável; veredito da dimensão é `INCONCLUSIVE` |
| **falha** | divergência medida contra o ground truth ou violação de contrato alegado | conta no numerador de falhas; `FAIL` |

**Regra R0 (não reclassificar falha):** um item que diverge dentro de uma
capacidade **alegada** pela frente é `falha`, mesmo que a documentação da frente
já tenha admitido o defeito. O reconhecimento honesto do defeito é creditado na
linhagem (matriz §8) como *limite declarado*, mas não remove a linha `falha` da
matriz, nem melhora o resultado. Nunca se exclui uma falha de uma capacidade
alegada para melhorar o número.

## 2. Regras herdadas (R1–R7) + novas (R8–R10)

- R1–R7: intactos do `CONTRACT-EXPORT-D.md` (dimensão ausente ⇒ `INCONCLUSIVE`;
  `regions: []` ⇒ `FAIL` cobertura 0; denominadores sempre do ground truth;
  `proved` sem prova indexada ⇒ `unknown_sem_prova`; SHA do fixture divergente ⇒
  `INCONCLUSIVE` global; etc.).
- **R8 — prova auditada por reexecução:** uma «prova anexada» só vale se o
  adaptador da barra D **reexecutar a etapa verificadora** (decode, revalidação,
  inversão, verificação de bytes) e comparar contra o ground truth autoral.
  Existir um hash no JSON não é prova. Aplicação: cada controle de adulteração
  (§6) exige o **código de saída exato** da ferramenta real; rc diferente do
  esperado (inclusive rc 0) é `falha`.
- **R9 — proibido preencher com gabarito:** o adaptador somente transfere para
  o escore valores que a ferramenta real emitiu. Campo ausente no export nativo
  ⇒ `desconhecido`. É vetado ao adaptador injetar no objeto avaliado o valor
  correto que ele conhece do ground truth.
- **R10 — autor + espelho não são dois oráculos:** implementações derivadas da
  mesma família contam como **uma** referência, registrada no §9 (Caderno de
  dependências de oráculo). Divergência entre autor e espelho é achado, não
  validação.

## 3. Frente A — capacidades, sondas e denominadores congelados

Fonte de verdade: fixture autoral D `dA-img-v1.bin` (imagem Genesis linear
sintética de 128 KiB, `--rom-size 0x20000`, produzida pelo autor da barra com o
codificador Kosinski já validado contra o espelho externo da família B; **nenhuma
ROM comercial**). Layout e respostas em `data/.../d/frentes/a/`.

| id | capacidade | sondas | expectativa congelada |
|---|---|---|---|
| KA1 | instrução: as 9 formas da gramática congelada `CONTRATO-A` §3 (lea .L/.W/PC, bsr.w, bsr.l, jsr abs .W/.L, jmp abs .W/.L) | 9 | site medido = forma+operando+alvo do gabarito; divergência é `falha` |
| KA1-b | limite de ISA sonda-9: `movea.l #imm32,An` — fora da gramática alegada | 1 | **não suportado com recusa limpa**: `construir-cadea` não produz cadeia nesse site; se produzir cadeia com forma afirmada ⇒ `falha` (defeito de ISA preservado na matriz) |
| KA1-b | limite de ISA sonda-10: palavra de extensão indexada `d8(An,Dn.W)` — fora da gramática | 1 | idem: recusa sem alegação; decodificação errada de registrador/tamanho ⇒ `falha` |
| KA2 | endereçamento: classificação de região do destino pela tabela local de janelas (`rom`, `io/vram-window`, `work-ram`, `desconhecida`) | 4 | etiqueta esperada por endereço; reclasificação ⇒ `falha`; destino fora do barramento ⇒ erro, nunca clamp |
| KA3 | cadeia: construir-cadea completo (carga→argumento→chamada→rotina→fluxo→saída) sobre sonda real + revalidar | 1 | rc 0 e todos os elos concordantes com o gabarito |
| KA3-g | guardas de confiança: (a) JSON com campo desconhecido, (b) cadeia declarando `observado-en-runtime` | 2 | rc 2 `ESQUEMA` exato nos dois; rc 0 ou outro rc ⇒ `falha` |
| KA4 | decode Kosinski: `saida_sha256`/`bytes_consumidos`/`saida_bytes` do decodificador do produto vs gabarito, 3 streams (típica, curta, truncada sem terminator) | 3 | 2 primeiras: igualdade exata; truncada: rc 10 `INCONCLUSIVE-TRUNCADA`, **nunca** rc 0 |
| TA | controles de adulteração (ver §6) | 8 | rc exato por sonda; qualquer outro rc (inclusive 0) ⇒ `falha` |

**Denominador A congelado: 29 linhas** (KA1=9, KA1-b=2, KA2=4, KA3=1+2, KA4=3, TA=8).
Medição no SHA atual `cbb6895`; se a frente publicar SHA corrigido, re-executam-se
as mesmas sondas e publica-se linha nova na matriz por SHA — as linhas do SHA
antigo (com seus `falha`, se houver) **não são reescritas**.

> **Errata 2026-10-04 (pré-medição, sem resultado anexado):** a linha KA1
> enumerava 8 sondas enquanto a gramática congelada `CONTRATO-A` §3 lista 9
> formas (lea .L/.W/PC, bsr.w, bsr.l, jsr .W/.L, jmp .W/.L). A contagem foi
> corrigida de 8→9 (denominador 28→29) **antes** de qualquer execução de sonda,
> usando o próprio catálogo de formas da frente como fonte. Precedente: §4 B
> passou de 15→14 pelo mesmo motivo, ainda antes do commit. Nenhum resultado
> medido foi alterado; nenhuma sonda foi adicionada nem removida.

## 4. Frente B — capacidades, sondas e denominadores congelados

Domínio: codec Enigma (4096 B), grade de IDs 64×64, projeção em WRAM, consumidor
= laço de cópia em ROM BYOR Sonic pinada. A barra D **não reimplementa Enigma**;
as sondas KB1/KB2 leem bytes da ROM pinada com verificações de opcode 68000
codificadas à mão pela frente D (independentes do código da frente B).

| id | capacidade | sondas | expectativa congelada |
|---|---|---|---|
| KB1 | consumidor: bytes alegados nos sítios `0x1B6D2` (`jsr $171E`), `0x1B6F8` (`move.b (a0)+,(a1)+`), `0x1B6FE` (`lea 64(a1),a1`), contadores `moveq #63` no laço `0x1B6E8..0x1B702` | 4 | byte a byte na ROM pinada (SHA verificado antes); ROM ausente ⇒ 4 linhas `desconhecido` com motivo, denominador preservado |
| KB2 | parâmetros: `move.w #0,d0` em `0x1B6CE` (value_offset=0 medido no sítio) + 6 ponteiros da tabela `0x1B64C` iguais aos 6 do contrato | 2 | igualdade exata; divergência ⇒ `falha` |
| KB3 | grade de IDs: `contrato_sonic.py` importado recebe **entrada autoral D**: aceita 64×64×1B; recusa `64x32`, stride≠64, grade≠64×64 | 4 | aceita=1; recusas=3 com motivo `geometria-errada` (recusa por regra com motivo, não por aparência); aceite indevido ⇒ `falha` |
| KB4 | projeção: round-trip direto/inverso do fixture assimétrico (aritmética `$FF1020 + r*128 + c` recomposta pela barra a partir da saída real da ferramenta) + recusa de padding sujo pelo inverso | 2 | concordância exata dos mapas; padding nunca escrito; divergência ⇒ `falha` |
| NB | negativos: (a) modo `hipotético` marca saída como não promovida, (b) modo `verificado` com evidência adulterada (1 byte virado no JSON de evidência) não promove a `PROMOVIDO` | 2 | (a) rótulo presente; (b) não-promoção com motivo; promoção indevida ⇒ `falha` (é o falso-verde que a barra existe para pegar) |

**Denominador B congelado: 14 linhas** (KB1=4, KB2=2, KB3=4, KB4=2, NB=2).
Nota de oráculo: o decoder Enigma pinado por hash é ferramenta **da família B**
(espelho, não oráculo independente — R10); por isso KB1/KB2 medem bytes de ROM
com verificação própria da barra, e nenhuma linha de B apoia-se em «dois códigos
da mesma família concordando» como prova.

## 5. Frente C — capacidades, sondas e denominadores congelados

Fonte de verdade: 4 bins autorais D (`dC-cx1..cx4.bin`) montados **à mão a partir
da tabela ISA 68000** pela frente D, com respostas reservadas fora do gabarito
da frente. **Não há `m68k-elf-as`/`m68k-elf-objdump` neste host** (verificado
2026-10-04); portanto os fixtures fx01–fx08 de C (oracle objdump registrado nos
docs deles) são **referência autoral da frente C com espelho externo ausente
aqui** — a barra D não usa os fixtures de C como sua verdade, e declara a
limitação: a verdade das sondas D é a codificação manual de D, auditável byte a
byte (candidato a holdout conjunto H-C, §7).

| id | capacidade | sondas | expectativa congelada |
|---|---|---|---|
| KC1 | instrução: comprimento + mnemônico de 20 instruções do subconjunto alegado (MOVE/MOVEA, ADDQ/SUBQ, MOVEQ, CMP, CLR/TST/NOT/SWAP, LEA/PEA, MULU/DIVS, Scc, MOVEM.W, BTST #imm) | 20 | comprimento exato por instrução do gabarito D; atravessar/dividir instrução ⇒ `falha` |
| KC2 | operando/fluxo: base de desvio relativo (regra `endereço_da_instrução + 2`, discriminador do erro histórico), Bcc d8 e d16, DBcc com extensão, BSR.W, **alvo** de cada desvio, indexado `d8(An,Dn.W)` dentro do subconjunto | 6 | alvos exatamente os do gabarito; base errada ⇒ `falha` |
| KC3 | fronteiras: opcode fora do subconjunto (linha-F), DBcc com `disp8=0xFF` (forma 68020), combinação inválida detectável (`MOVE.W #imm,An`) | 3 | fronteira no endereço exato com opcode registrado; caminho PARA; continuar ⇒ `falha`; bytes além da instrução comprovada nunca reclamados |
| KC4 | chamadas: JSR abs.L intra-região (raiz derivada `dentro-de-fluxo`), JMP abs.L extra-região (aresta `fora-da-região`, nada decodificado fora), JMP `(An)` (fronteira `indirect-opaque` + `target: null`), `TRAP #n` (fronteira `trap-opaco`) | 4 | estrutura do export conforme `CONTRACT.md` §4; resolver indireção «por aparência» ⇒ `falha` |
| KC5 | CFG: blocos e sucessores num diamante (2 ramos), aresta de queda após condicional, caminho após `RTS` não continua, `cobertura.fracao` = Σ comprimentos/região (recomputada pela barra), vereditos de `sitios` (`miolo-de-instrucao`, `dentro-regiao-nao-alcancado`) | 5 | aritmética e vocabulário exatos; grau de raiz promovido pela análise ⇒ `falha` |
| TC | controles de adulteração (ver §6) | 4 | rc/estrutura exata |

**Denominador C congelado: 42 linhas** (KC1=20, KC2=6, KC3=3, KC4=4, KC5=5, TC=4).

## 6. Matriz de controles de adulteração (identidade · saída · geometria · sítio · confiança)

Cada linha é executada contra a ferramenta real; o adaptador registra o rc/estrutura
obtidos e compara com o esperado. R8: a verificação é por **reexecução**, não por
presença de hash.

| eixo | frente A (rc `rex-chain`) | frente B | frente C |
|---|---|---|---|
| identidade | TA-1: ROM trocada após pin ⇒ rc 3 `ROM-DIVERXENCIA` (nunca recolocação) | NB-2: sha de evidência virado no modo `verificado` ⇒ não promove | `objeto.sha256` do export ≠ digest recomposto pela barra do `--bin` atual ⇒ `falha` da barra (incoerência interna) |
| saída | TA-2: byte no meio do stream Kosinski, coa cadea re-pinada para a imaxe mutada ⇒ rc 9 `SAIDA-DIVERXENTE` | KB-4: inversão com padding sujo ⇒ recusa | TC-4: 1 byte virado que muda comprimento ⇒ `cobertura` do export deve mover-se exatamente o delta da verdade D |
| geometria | TA-3: chamada lexítima declarada fóra da ventá tras a carga ⇒ rc 11 `XEOMETRIA-DIVERXENTE` | KB3: geometrias divergentes ⇒ recusa `geometria-errada` | KC3: atravessar fim de região ⇒ fronteira, não extensão de bounding box |
| sítio | TA-4: byte do sítio de carga virado ⇒ rc 5 `SITIO-DIVERXENCIA`; TA-5: operando `.L` alterado ⇒ rc 6 `ARGUMENTO-DIVERXENTE`; TA-6: bytes da chamada alterados ⇒ rc 7 `ALVO-DIVERXENTE`; TA-7: bytes da rotina pinada alterados ⇒ rc 8 `ROTINA-DIVERXENCIA`; TA-8: `--rom-size` divergente da tradução ⇒ rc 4 `MAPPER-DIVERXENCIA` | KB1: deslocar 1 byte o endereço do laço alegado ⇒ sonda D registra divergência (a ROM é o oráculo, não o doc) | TC-2: `--site` dentro do miolo de instrução ⇒ veredito `miolo-de-instrucao`, jamais `instrucao-de-bloco`; TC-3: raiz fora da região ⇒ `fora-da-regiao` |
| confiança | §3 KA3-g: campo desconhecido e `observado-en-runtime` ⇒ rc 2 `ESQUEMA` | modo `hipotético` rotulado; `verificado` sem evidência íntegra não promove | TC-1: `--root-prov` fora do vocabulário fechado ⇒ erro de CLI (não análise); grau de raiz nunca promovido pelo fluxo |

Contagens TA=8, TC=4 já incluídas nos denominadores §3/§5; NB em §4.

> **Errata 2026-10-04 (pré-medição, sem resultado anexado) — receitas TA-2 e TA-3.**
> Ao escribir o adaptador, D leu a ordenación dos elos en `verify.rs` da frente A
> (nunca executou estas receitas) e comprobou que dúas mutacións non illaban o eixo
> que afirman medir:
> - **TA-2**: calquera mutación da imaxe é pega antes polo elo `identidade` (rc 3),
>   porque a cadea pinna `imaxe_sha256`. Sen re-pinar ese campo, a receita mediría o
>   eixo identidade dúas veces. A fila TA-2 executa a variante illada (re-pin) e o
>   adaptador rexistra **ademais** a variante confundida (pin orixinal) como control
>   observado rc 3, que non pontúa.
> - **TA-3**: un sitio ímpar fai diverxir os *bytes* da chamada, e A compara bytes
>   antes de consultar o aliñamento ⇒ rc 5 (`sitio-chamada`), non rc 11. A receita
>   pasa a declarar unha chamada **real e lexítimamente aliñada fóra da ventá**
>   (sitio `0x134`, bytes e alvo reais), de modo que só a xeometría pode rexeitala.
>   A consecuencia queda rexistrada como limitación auditável: **A garda de
>   aliñamento de `chamada_sitio` non é alcanzable por cadeas que pinan bytes**,
>   polo que a súa capacidade de xeometría probada é a de ventá, non a de aliñamento.
> Os denominadores non cambian (TA=8); ningún limiar foi axustado a resultado.
> Precedentes: §3 KA1 8→9 e §4 B 15→14.

> **Errata 2026-10-04 (pré-medição, receita reescrita antes de executar C) —
> TC-4, §5(b) e o sitio inalcanzable de `dC-cx1`.**
> - **TC-4**: co conxunto de raíces congelado de `dC-cx4` (`0x2000` e `0x2028`),
>   a mutación en `0x2000` corta o *único* camiño que proba `0x2002..`; polo
>   tanto `delta_cobertura_bytes: 0` e a invariante «`0x2002..` mantém os
>   comprimentos» non son alcanzables coa invocación base — a receita mediría a
>   alcançabilidade, non o eixo de lonxitude que afirma. A fila pasa a executar a
>   **variante illada** (mesma invocación base **máis unha raíz en `0x2002`**,
>   declarada `candidato`), na que o delta esperado é exactamente **2 B** = a
>   lonxitude autoral da instrución mutada; a variante confundida (raíces
>   orixinais) rexístrase como control observado `pontua: false`. Mesma
>   discriminación aplicada a TA-2/TA-3; denominador TC = 4 inalterado.
> - **§5(b)** describe «DBcc con `disp8=0xFF`»; a fila congelada en
>   `dC-cx3-truth.json` é `KC3-bsr-l-68020` (opcode `61ff`), a forma BSR do mesmo
>   `disp8=0xFF` que §3 recusa baixo a mesma regra. A fila gradúa «fronteira no
>   endereço exato co opcode registrado»; o texto histórico de §5 non se reescribe.
> - **`dC-cx1`**: o relleno pasou de `0x00` a `0xFF` e o sitio
>   `dentro-regiao-nao-alcancado` pasó a calcularse como `fim_instrucoes + 0x0e`
>   (aritmética de D). Co relleno `0x00` o rabo decodificaba (`ori.b #imm,Dn`
>   está na lista de §3) e non existían vans: a expectativa antiga situaba un
>   sitio «após as instrucións» dentro do fluxo decodificábel. Ningunha fila KC1
>   mudou; denominador C = 42 inalterado. Rexístrase como **audit da prova
>   anexada**: a suma autoral de comprimentos de `dC-cx1` é 66 B mentres que o
>   export de C reclama 62 B — os 4 B de diferenza son exactamente a instrución
>   recusada en `0x0A`, polo que a cobertura é coerente co gabarito.

## 7. Holdouts compatíveis (inputs públicos, respostas reservadas)

Congelados aqui, produzidos antes da medição, respostas **fora da árvore**
(só `pin.json` com SHA/len fica no repositório — mesma política do `ho-1` da barra):

- **H-A:** imagem sintética nova `dA-img-ho1.bin` (sementes de streams e sítios
  não usados no conjunto de medição) + cadeia JSON de entrada; respostas
  reservadas: saídas, rc esperados dos 8 tampers sobre esta imagem.
- **H-B:** grade 4096 B autoral nova + projeção esperada; resposta reservada.
  A ROM BYOR não entra em holdout (não distribuível; só leitura pinada).
- **H-C:** `dC-cx9-holdout.bin` com instruções e fluxo fora dos conjuntos
  anteriores; respostas (comprimentos, alvos, fronteiras, cobertura) reservadas.

Se as frentes vierem a reexecutar contra os inputs, os gabaritos permitem nota
sem reabrir os fixtures de medição. Nenhuma resposta de holdout foi usada na
construção das ferramentas avaliadas (elas já estão publicadas) — o holdout
vale como medição **cega do lado da barra**: o adaptador não consulta o gabarito
para preencher saída (R9).

> **Errata 2026-10-05 (declarada antes de cada execución que substitúe) — cadea
> de versións do holdout A.** O run inicial sobre `dA-img-ho1.bin` deu 5/29 PASS e
> `H-A/KA3 FAIL` (`ERRO(9): fluxo en 0x9000: referencia-invalida no fluxo`). A
> triaxe determinou que a diverxencia **non informaba sobre A**:
> 1. **v1 void — superposición de fluxos.** O layout fixaba `fluxo2 = fluxo1 +
>    0x400`; con datos non dexenerados o stream `s1` codificado mide **1157 B**,
>    polo que a escrita de `s2` en `0x9400` pisou o final de `s1`. A imaxe
>    resultante non é un Kosinski válido: **o descodificador do propio D rexeita a
>    fatía lida da imaxe** (`referencia antes do historico`). A recusa de `rex-chain`
>    é comportamento correcto ante entrada inválida; graduala como falha de A sería
>    a reclassification inversa que R0 prohíbe.
> 2. **v2 void — desprazamento d16(PC) fóra da xanela asinada.** Con `base=0x400`
>    e `fluxo1=0x9000`, a sonda `lea.l d16(PC),A2` leva disp `0x8bec`, que asinado
>    vale −28 924 ⇒ alvo fóra da imaxe; A recusa con rc 5 (`AlvoFóraBarramento`).
>    A fila KA1-3 medía a autoría de D, non a forma de carga de A.
> Ambos os defectos demostráronse **sen executar a ferramenta avaliada** (aritmética
> de D + round-trip do descodificador de D). As correccións son de autoría, non de
> denominador nin de limiar:
> - `buildAImage` leva rexistro de zonas (`marcar`) e **aborta** se dúas escritas
>   se solapan (código, rotinas e os tres fluxos);
> - `fluxo2` pode derivarse do tamaño real do stream codificado (`fluxo2: null`);
> - o desprazamento d16(PC) valida-se na autoría contra `[-0x8000, 0x7FFF]` e
>   **revalida lendo os bytes da imaxe** en `validarEntradaA`, que agora compara
>   tamén o digest da fatía da imaxe co do stream codificado;
> - `validarEntradaA` aplícase ás entradas de holdout (antes só ás de medição);
> - a evidencia do holdout escribe-se con nome versionado (`holdouts-vN.jsonl`).
> Ningunha muda altera os bytes das fixtures medidas: `dA-img-v1.bin`,
> `dA-truth-v1.json`, `dB-*` e `dC-*` manteñen os hashes pinados (verificado con
> `sha256sum -c` antes e despois de cada regeneración).
> **Perda rexistrada:** `holdouts.jsonl` do run v1 foi sobrescrito polo run v2
> (mesmo nome de ficheiro); a súa táboa queda só nesta entrada e na conversa de
> execución, non como artefacto. Ese defecto de proceso é a razón do nome
> versionado.
> **Run válido (v3, `dA-img-ho3.bin`, sha `a07eb617b3c5…`):** A **28/30 PASS**, coa
> *mesma* fila `TA-5` en fallo que no conxunto de medição (rc esperado 6, medido 2)
> — o holdout reproduce o defecto coñecido con entrada distinta; B 4/4; C 5/5; as
> dúas filas `VOID` rexístranas **contra D**, nunca contra a fronte.

## 8. Formato de publicação da matriz

Uma linha por capacidade, por SHA medido:

```
| frente | SHA | capacidade | categoria | acerto/denominador | desconhecidos | falhas | veredito | evidência (SHA do export bruto) |
```

- **Nunca** se publica percentual único «decompilador universal»: cada capacidade
  tem denominador próprio e as razões não se mediam entre si (regra da barra
  original).
- Níveis de maturidade por linha, sem promoção automática:
  `candidato → referencia-estatica → vinculo-estrutural → consumo-observado →
  equivalencia-demonstrada`. Nesta rodada nenhuma linha atinge
  `consumo-observado` (nenhuma execução de ROM); declarar mais é `falha` da barra.
- SHA corrigido de A (se publicado) gera linhas novas; as linhas de `cbb6895`
  ficam preservadas com seus `falha` de ISA.

## 9. Caderno de dependências de oráculo (R10)

| oráculo | família | usado por | status |
|---|---|---|---|
| `kos_mirror.py` (espelho mdcomp) | família B (codec) | barra D (validação do próprio codificador autoral) e cross-check Kosinski | espelho: **não** conta como segunda prova |
| decoder Enigma pinado `enigma_research.py` | família B | frente B camada 1 | espelho interno da família; barras D não o tratam como independente |
| `m68k-elf-objdump` | externo ausente neste host | frente C (fixtures deles) | indisponível aqui ⇒ sondas D usam codificação manual própria; limitação declarada |
| ROM BYOR Sonic pinada | corpus do operador (read-only) | frentes B (e A em cadeia real, fora do denominador D) | identidade por SHA antes de qualquer leitura; ausente ⇒ linhas viram `desconhecido`, nunca `0` |

## 10. O que os adaptadores podem e não podem fazer

Podem: invocar CLIs reais (`rex-chain`, `verificar-cadeia.py`/import de
`contrato_sonic.py`, `rex-cfg`), ler stdout/JSON, computar SHA/len, comparar com
gabarito autoral, registrar rc brutos em arquivos `.jsonl` de evidência.
Não podem: importar código das frentes para *refazer* o cálculo esperado,
preencher campos ausentes (R9), promover categorias, alterar território alheio,
executar ROMs/emuladores, ou contar espelho + autor como dois acertos (R10).

Builds pesados (cargo de A, cargo de C) executam **um por vez**, coordenados com
o Principal, fora da árvore versionada (diretório de scratch próprio da frente D).

## 11. Defectos propios descubertos durante a avaliación (rexistro honesto)

Non hai reclasificacións: cada entrada di que se mudou, que se conservou e cal
queda como limitación auditabel.

- **`makeRng()` de `lib_bench.mjs` devolve sempre 0** (`Number(x) >> 33n % 256`
  perde a precisión antes do desprazamento). Consecuencia: os `plain` orixinais
  das fixtures A/B eran ceros. **Non se re-xeraron as fixtures de A xa medidas**
  (os hashes pinados de `dA-img-v1.bin`/`dA-truth-v1.json` deben seguir valendo);
  rexístrase como limitación do conxunto de mediación de A: co `plain` de 1024
  ceros, `s1` codifica en **37 B** e o eixo de descodificación de A **nunca foi
  exercitado nesta rolda contra datos non dexenerados**. O holdout v3 si o fai
  (`s1` = 1157 B de rampa determinística) e esa é a única evidencia da rolda que
  exerce o descodificador de A contra referencias longas non triviais. As fixtures
  aínda pendentes de medir si se re-xeraron co padrón explícito `padraoD` (grade
  B: 256 valores distintos; celdas discriminantes 144/18/147/175).
- **Capa de lectura de `adapt_c.mjs` (corrixida despois do primeiro run).** O
  primeiro run de C deu **34/42**. Catro erros de indexación *só no lector* do
  export (bloque da instrución ramificada vs bloque da entrada; `status` vs `tipo`
  para o vocabulario `fora-da-regiao`; raíz derivada + `alcanado-por` en hex
  minúsculo; comprobación de `--out` obsoleta) corrixíronse sen tocar
  expectativas nin limiares. O segundo run deu **39/42** e as tres filas `falha`
  reais (`KC1-movea.l #imm32,A1`, `KC3-move-w-imm-an`, `KC4-jmp-ind-an`)
  mantivéronse. A evidencia intermedia sobrescribiuse no mesmo nome de ficheiro;
  queda nesta entrada e na conversa de execución.
- **Gate de vocabulario.** `linha()` aceptaba cinco categorías pero rexeitaba
  `nao-aplicavel`, que §1 si conxela; engadiuse ao gate (corrección do validador,
  non dun veredicto). Ningunha fila existente cambiou de categoría.
- **`CONTROLE-JSON-TAMPER-B` é `non aplicável`.** A receita §6 «voltar o hash da
  evidencia JSON» non é alcanzable: a ferramenta real non consume JSON de
  evidencia como entrada (`--out` só escribe). O eixo de identidade de B
  medírase en NB-2 coa ROM adulterada, que é a entrada que B si valida.
- **Ausencia de ensamblador 68000 no host** (sen `m68k-elf-as`/`objdump`): as
  sondas C están codificadas á man por D, polo que as diverxencias de ISA
  `KC1-movea.l #imm32,A1` e `KC3-move-w-imm-an` quedan con oráculo parcial
  (codificación manual propia + anclaxe externa onde existe).
- **Identidade do contrato de B entre SHAs.** `contrato_sonic.py` é idéntico por
  hash en `cffe17f` e `396e0b8` (`36bcc93504a9…`); só `verificar-cadeia.py` difire.
  Polo tanto as 14 filas graduadas en ambos os SHAs **non son dúas probas
  independentes do contrato**, senón do CLI; publícanse separadas con esa nota.
- **R8 ten dous formatos, e só un é numérico.** As filas negativas conxeladas
  por D para B (`NB-1`, `NB-2`) e para C (`TC-2`, `TC-3`, `TC-4`) non pinan un
  `rc` exacto: pinan un *predicado* («recusa antes de promover», «rótulo
  HIPOTETICO e ningunha promoción», «veredicto miolo-de-instrucao»). O texto
  conxelado vive en `esperados`; o `rc` medido é numérico en todas. Unha
  aserción «`rc_esperado` ten de ser número» sería estrita demais que o
  contrato e trocaría formato por rigor. O que si é mecánico e está pinned por
  teste: `PASS` ⇔ `divergencias` baleira, `FAIL` ⇔ polo menos un desvío
  recomposto por D, e ningunha fila graduada pode carecer de expectativa.
- **Procedencia da ferramenta de A non estaba rexistrada.** `adapt_a.mjs`
  publicaba o manifesto sen `verificarProcedencia`, que B e C si tiñan; engadiuse
  (e o `--chave` para poder medir un segundo SHA da mesma fronte). Non cambia
  ningunha fila: o corpo de `A-cbb6895.jsonl` saíu byte-identico (`d05ce278a43b…`)
  despois do cambio.
- **Nome de evidencia por SHA sobrescribe o run anterior.** `A-<sha7>.jsonl` e
  `B-<sha7>.jsonl` non levan versión, así que un re-run do mesmo SHA destrúe a
  evidencia previa. Desta vez mitigouse copiando o estado anterior a
  `~/rds-scratch/rex-eval-d2/evidencia-anterior-20261005/` antes de re-executar;
  a perda do `holdouts.jsonl` v1 (§7) segue sendo perda real e non se disfarza.
- **`KC4-jmp-ind-an` falla por texto do contrato de D, non por capacidade de C.**
  §5 conxelou a fronteira como `indirect-opaco`; o vocabulario real e publicado
  de C é `indirect-opaque` (`src/decode.rs:36`, `src/grafo.rs:357`, e os tests
  propios `tests/export_json.rs:271`/`tests/fx_fluxo:475`). A fila midiu o que estaba
  conxelado e rexistrou `falha`; **non se reescribe esa evidencia nin se lle
  cambia o veredicto a posteriori** (iso sería axustar o contrato ao resultado).
  A corrección vai como **errata de vocabulario para `EXTENSOES-D v2`**, cunha
  rolda de medición nova; mentres tanto a matriz v1 publica 39/42 e esta fila
  aparece na lista de falhas coa súa explicación.
