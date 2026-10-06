# EXTENSÕES-D v1 — extensão do contrato `rds-d-export/1` para os domínios das frentes A/B/C

**Status:** congelado antes de qualquer medição (precedente: `EXPECTATIONS-D.md`,
commit-so `a90b5c2`). Nenhuma linha deste documento pode ser reescrita depois de
haver medição. Se um contrato estiver errado, faz-se uma **retificação versionada**
(`EXTENSÕES-D v2`) preservando o histórico e re-executam-se os casos afetados;
nunca se ajustam limiares para acomodar resultados.

**Base fixada:** `codex/rex-sonic-sequencia` @ `cb56657a142df40d2acd09a3e03e54247f066dea`.
**Território:** `scripts|docs|data/rex_profiles/parallel_recovery_20261004/d/`.

> **v2 existe.** A §12 deste mesmo ficheiro (`EXTENSÕES-D **v2**`, conxelada
> 2026-10-05 antes de calquera nova medición) exerce exactamente a opción que o
> parágrafo anterior deixaba aberta. §0–§11 **non se reescriben**: manteñen as
> súas filas, denominadores e SHA de corpo. O que v2 cambia é (a) o gabarito do
> perfil `md68000-chain16`, que pasa dun AGRAMA escrito á man por D a un
> estabilo xerado por instrumento terceiro, e (b) a *interpretación* das filas
> que ese gabarito errado xerou. Unha fila pode ser historicamente `FAIL` e, á
> vez, non medible por culpa do estabo; ambas as frases son certas e ningunha
> troca a cifra publicada.
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

---

# EXTENSÕES-D **v2** — gabarito por instrumento e regras novas

**Conxelada 2026-10-05 antes de calquera nova medición**, exercitando a opción que
o §0 do propio v1 xa deixaba aberta: «se um contrato estiver errado, faz-se uma
**retificação versionada** (`EXTENSÕES-D v2`) preservando o histórico e
re-executam-se os casos afetados».

## 12.0 Que é isto, e que non é

- §0–§11 seguen sendo o **estabo histórico** das roldas 1 e 2. Ningunha cifra
  desta rolda cambia: as filas medidas conservan os SHA de corpo que xa tiñan,
  non se reescriben e non se reclassifican (R0). O inventario exacto dos sete
  ficheiros publicados en `data/…/d/medidas/` é este:

  | ficheiro | filas | puntuables | PASS |
  |---|---|---|---|
  | `A-cbb6895.jsonl` | 30 | 29 | 28 |
  | `A-bd40e92.jsonl` | 30 | 29 | 21 |
  | `B-cffe17f.jsonl` | 18 | 14 | 14 |
  | `B-396e0b8.jsonl` | 18 | 14 | 14 |
  | `C-275f2af.jsonl` | 48 | 42 | 39 |
  | `holdouts-v2.jsonl` | 40 | 0 | — |
  | `holdouts-v3.jsonl` | 41 | 0 | — |
  | **total** | **225** | **128** | — |

  As 81 filas de holdout levan `pontua:false` por deseño: miden capacidade fora
  da matriz pública e non entran en ningún denominador.
- **v2 rexerá só as medicións novas.** Cada fila v2 nace co `gabarito` declarado
  (R15) e ningunha fracción da matriz mestura filas de dous gabaritos distintos.
- O AGRAMA `dA-truth-v1.json` **deixa de ser gabarito** do perfil `md68000-chain16`
  e pasa a `control-historico`: seis das súas filas (cinco de KA1 e a premisa de
  KA4-2) teñen bytes ou expectativas que contradín un instrumento terceiro (§12.1,
  táboa §12.6). Non se borran nin se re-xeran: re-mídense contra o SHA histórico de
  A só para amosar que reproducen o que reproducían.
- Ningunha superficie compartida (produto, IPC, UI, `crates/`, manifests, registry,
  Memory Bank, `ROUND_STATE`) se toca para axustar a barra ao resultado (R13).

## 12.1 Estabilo novo: `rex-parallel-d/oraculo-isa/1` (`isa-oraculo-v2`)

| dato | valor |
|---|---|
| xerador | `scripts/…/d/medida/oraculo_isa.mjs` |
| gabarito | `data/…/d/gabarito/isa-oraculo-v2.json` — arquivo `54817106ddd0fd2136d701216fad543e2da74ff7265bd2d21960712f08749b11`; `filas_sha256` `032eb989b530a31e2e580a09361e0a3d4900776963a9342fb132c3d79e539c67` |
| sondas | 55: **51 montan** (cada unha con bytes reais extraídos da columna crúa de `objdump -d`), **4 recusadas** con motivo |
| instrumento | `m68k-elf-as` `618740559477258165eb1a344e07acd592afc1438061825469d5bd56fa2c87c7` · `m68k-elf-objdump` `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f` · GNU Binutils **2.41** · bandeira `-m68000` |
| reprodución | `node …/oraculo_isa.mjs [--saida <dir>]`. `filas_sha256` é o digesto **portabel**: o camiño do directorio de traballo normalízase a `<saida>/` no stderr do montador. O arquivo si contén as rutas deste host, polo que non se promete byte-idéntico noutra máquina — a verificación é sobre `filas_sha256` |
| probas | `medida/oraculo_isa.test.mjs`: 19 filas, incluídas identidade do binario, control de adulteración do digesto, «fila valida sen bytes = placeholder», e re-xeración desde cero |

**Limitación de liñaxe (declarada, e non a resoluciona v2):** a fronte A cita o
*mesmo* binario — `fixtures/INSTRUMENTO.sha256` de A bate co SHA do montador
(verificado por teste, `it.skipIf` se a árbore de A non está no host). O oráculo é
independente de **D, B e C**; fronte a A é ferramenta compartida, así que ningunha
fila de ISA de A sobe de `referencia estática` por esta vía (R10). O que o oráculo
si dilucida é a pregunta que estaba en disputa: **que di o ISA**, non que di A.

## 12.2 Regras novas (R1–R10 seguen vixentes)

- **R11 — O gabarito de ISA deriva do instrumento, non da táboa escrita a man.**
  Unha expectativa de D que contradiga `isa-oraculo-v2` é **defecto de D** e
  publícase como tal; non é regresión da fronte medida. Prohibido: manter a
  expectativa e contar o desvío contra ela.
- **R12 — Unha recusa puntúase polo eixo que illa, non polo número.** Cada fila de
  control ten un **conxunto de códigos aceptados** (ámbito publicado en §12.4) e
  tres invariantes: `rc ≠ 0`, **ningunha saída promovida**, e motivo pertencente ao
  conxunto. `rc` dentro do conxunto ⇒ `aplicavel`; `rc 0` ⇒ `falha`; `rc` fóra do
  conxunto ⇒ `descoñecido` **con motivo**, nunca `falha` silenciosa. Unha recusa
  xusta do ISA non é unha falla de seguranza polo feito de ocorrer.
- **R13 — Normalización de vocabulario só en adaptador versionado.** O mapeo
  publícase como tábola explícita (`vocabulario/v2`, §12.5) dentro do adaptador.
  Prohibido: editar o produto, ou editar a evidencia v1, para que coincida coa
  tradución da barra.
- **R14 — Unha sonda por sitio.** Cada sonda v2 ocupa un enderezo propio, separada
  das veciñas por recheo de `4e71` (`nop`), e as súas codificacións **xeranse co
  montador**, non se escriben a man. Prohibido: empaquetar varias sondas nunha
  rexión continua — foi o que fixo que a resposta á palabra `61 ff` dependese da
  sonda veciña.
- **R15 — Toda fila declara `gabarito`.** Campos `gabarito` (`isa-oraculo-v2`) e
  `contrato` (`EXTENSOES-D v2`) obrigatorios; `pontuar.mjs` rexeita mesturar
  gabaritos nun denominador.
- **R16 — Gate de entropía.** Ningunha estrutura autoral se acepta como datos de
  proba se o seu xerador non pasa tres controls pinned: secuencia esperada para tres
  sementes nomeadas, diversidade mínima (≥ 200 valores distintos nos primeiros
  4096), e fronteiras `0..255` sen punto fixo. Un PRNG dexenerado pode seguir
  existindo como **control histórico** explicitamente rotulado, nunca como fonte de
  entropía.
- **R17 — Un holdout vale para un SHA e para a versión de contrato en que se
  conxelou.** O holdout `cbb6895` **non** é proba de `bd40e92` nin de `8ea5821`. As
  respostas reservadas quedan fóra da árbore, pero o seu **SHA-256 pínase en
  `pin.json` dentro da árbore**, para que a perda do directorio de scratch non
  destrúa a evidencia (falla rexistrada na rolda 2).
- **R18 — Capacidade non se hérdase.** Unha fronte que engade capacidade (novo
  descodificador, nova investigación) **non** queda coberta polas filas que D mediu
  da súa versión anterior: as capacidades novas son filas novas, con denominador
  propio, ou `descoñecido` con motivo. A ausencia de cobertura publícase, nunca se
  conta como PASS nin se omite.

## 12.3 Denominadores v2 (conxelados antes de medir)

**Frente A — 33 filas**, fixtures `dA-img-v2.bin` + `dA-truth-v2.json` (xeradas co
montador, R14; pins propios):

| id | capacidade | sondas | expectativa |
|---|---|---|---|
| `KA1v` | as formas que A declara, **codificadas polo instrumento**: `lea .L`, `lea .W (<0x8000)`, `lea .W (≥0x8000)`, `lea (d16,PC)`, `bsr.w`, `jsr .W`, `jsr .L`, `jmp .W`, `jmp .L`, `jmp (d16,PC)` | 10 | forma+operando segundo `isa-oraculo-v2`; a fila `lea .W (≥0x8000)` **espera recusa** (EA esténdese a `0xFFxxxx` e cae en work-RAM sen backing) |
| `KA1v-neg` | palabras sen mnemónico 68000 (`4efd`, `4efc`) e `61 ff…` (bsrl de 68020) | 3 | `rc ≠ 0`, sen cadea promovida, motivo `fora-de-subconxunto` ou `indefinido-68000` (R12) — **retificado: `61 ff` vai a `KA1v-fora`, neg = 2 (§12.10 d)** |
| `KA1v-fora` | `movea.l #imm32,A1` e `movea.w %a0,%a1` — **MC68000 válidos** (§12.1) | 2 | recusa limpa de subconxunto declarado ⇒ categoría `non-suportado`, **non** `falha` — **retificado: 3 filas, `movea.w %a0,%a1` é MC68000 válido (§12.10 b/d)** |
| `KA2v` | rexión do destino pola táboa de xanelas, incluíndo `0xFF8400` | 4 | etiqueta por enderezo; destino fóra do bus ⇒ erro, nunca clamp — **retificado: A publica enmascarar+rexistrar; o FAIL é o clamp silencioso (§12.10 c)** |
| `KA3v` | cadea completa (carga→argumento→chamada→rotina→fluxo→saída) + 2 gardas de confianza | 3 | rc 0 e elos concordantes; gardas ⇒ `rc 2 ESQUEMA` exacto |
| `KA4v` | decodificación Kosinski de 3 fluxos referenciados con `lea .L` ou `(d16,PC)` | 3 | igualdade exacta; truncada ⇒ `rc 10`, nunca rc 0 |
| `TAv` | 8 receitas de adulteración, conxuntos de códigos en §12.4 | 8 | R12 — **retificado: 10 receitas (TA-3a/3b, TA-5v/TA-5b), fronte A = 35 (§12.10 a/f)** |

**Frente C — 41 filas**: `KC1v` 20 (lonxitude+mnemónico; as dúas filas de MOVEA
re-especificadas como **instruccións válidas**), `KC2v` 6, `KC3v` **2** (retírase
«`MOVE.W #imm,An`»: non ten codificación propia, §12.6), `KC4v` 4 (vocabulario polo
`adaptador-c/v2`), `KC5v` 5, `TCv` 4.
— **retificado en §12.10 h**: MOVEA non é unha soa fila. `movea.w` está DENTRO da
lista fechada de C e `movea.l #imm` está FORA; o inventario de v1 só ten unha fila
MOVEA, así que KC1v pasa de 20 a 21 e a fronte C de 41 a 42.**

**Frente B — 23 filas** (R18: capacidade non hérdase): as 14 de `v1` manteñen o seu
denominador histórico e non cubren nada novo; engádense `KB5v` 6 filas para o
descodificador Enigma nativo publicado por B desde `da5472c` (aceite, lonxitude,
recusa de xeometría, determinismo byte a byte, negativo de padding sujo, e a
fronteira `HIPOTETICO`/`PROMOVIDO` dese decodificador concreto) e `KB6v` 3 filas
para a investigación CRAM resolta por B (resolución estática, sitios únicos, e
**consumo observado = non alegado**). Os enderezos e bytes concretos de `KB5v`/`KB6v`
conxelanse nun adendo `EXTENSOES-D v2-B` **cuxo commit ten que preceder** a
execución de calquera sonda de B: se ese adendo non existe, as filas miden como
`descoñecido` con motivo e o denominador publícase baleiro, non se inventan.

## 12.4 Conxuntos de códigos aceptados (`TAv`, R12)

Fonte: táboa publicada por A en `CONTRATO-A.md` §5 (14 códigos). D fixa, por receita,
que códigos son *o mesmo eixo semántico*:

| receita | eixo | conxunto aceito | motivo do conxunto |
|---|---|---|---|
| `TA-1` identidade | imaxe ≠ pin | `{3}` | único; ROM-DIVERXENCIA antes de medir |
| `TA-2` saída | contido do stream | `{9}` | SAIDA-DIVERXENTE; a variante sen re-pin queda como control non puntuado |
| `TA-3` xanela | chamada fóra da ventá | `{11}` **só**, porque a v2 illa | v1 mediu `{7,11}` porque a receita movía tamén o alvo declarado; v2 separa en `TA-3a` (alvo movido, dentro da ventá ⇒ `{7}`) e `TA-3b` (alvo coherente, fóra da ventá ⇒ `{11}`) | — **elos publicados en §12.10 f** |
| `TA-4` sítio | bytes do sitio ≠ afirmados | `{5}` | SITIO-DIVERXENCIA |
| `TA-5v` operando alterado no rexistro | forma ou operando ≠ afirmado | `{6}` **só** | v1 esperaba rc 6 exacto e mediu rc 2 `ESQUEMA`: a mutación de D rompía a *forma* do rexistro antes de chegar ao eixo. rc 2 é recusa correcta **noutra pregunta**, así que en v2 a receita hase construir mantendo o rexistro valido-por-esquema; se A volvese a responder 2 ou 7, a fila publícase como `descoñecido` co elo medido, non como PASS nin como falla de seguranza | — **retificado antes de medir: `{2}` elo `esquema`; rc 6 é inalcanzable nesa receita e exerceo `TA-5b` (§12.10 f)** |
| `TA-6` alvo | aritmética da chamada | `{7}` | ALVO-DIVERXENTE |
| `TA-7` hash da rutina | contido no alvo ≠ pin | `{8}` | ROTINA-DIVERXENCIA |
| `TA-8` mapper | tradución do offset | `{4}` | MAPPER-DIVERXENCIA |

## 12.5 Vocabulario: `adaptador-c/v2` (R13)

Tábola de mapeo explícita, só no adaptador; a evidencia v1 non se toca:

| conxelado en v1 | vocabulario real publicado por C | ditame |
|---|---|---|
| `indirect-opaco` | `indirect-opaque` (`src/decode.rs:36`, `src/grafo.rs:357`) | erro de **D**; a fila `KC4-jmp-ind-an` v1 queda como `falha` histórica e `KC4v-jmp-ind-an` mídese co vocabulario de C |
| `fora-da-rexión` | `fora-da-regiao` | idem (corrixido no lector do adaptador durante a rolda 2; aquí queda como regra, non como parche) |

## 12.6 Retificación do AGRAMA v1 (control histórico)

O instrumento di — e está pinned en `oraculo_isa.test.mjs`:

| fila v1 | bytes no fixture | que di `isa-oraculo-v2` | expectativa v1 | ditame de v2 |
|---|---|---|---|---|
| `KA1-2` | `43f8 8400` en `0x110` | `lea (0x8400).w,A1` → EA `0xFFFF8400`; bus `0xFF8400` | `carga_operando` = `0x8400`, nota «extensión curta sen signo» | **expectativa falsa (D)**. O límite medido está no bit 15: `43f8 7fff` → `7fff`, `43f8 8000` → `ffff8000` |
| `KA1-bsr.l` | `61 ff 0000 1dd4` | 68020 `bsrl`; GAS `-m68000` **recusa** `bsr.l` | `chamada_forma` = `bsr.l` nun perfil 68000 | **sonda inválida (D)**; en v2 é probe negativo de recusa (`KA1v-neg`) |
| `KA1-jsr.w` | `4e fa 1f 00` | `jmp %pc@(1f02)`; `jsr (xxx).w` é **`4eb8`** | `chamada_forma` = `jsr.w`, alvo `0x1f00` | **bytes equivocados (D)**; v2 usa `4eb8 1f00` |
| `KA1-jmp.l` | `4e fd` | sen mnemónico 68000 (`.short 0x4efd`); `jmp (xxx).l` é **`4ef9`** | `jmp.l`, alvo `0x1f00` | **bytes equivocados (D)** |
| `KA1-jmp.w` | `4e fc` | sen mnemónico 68000 (`.short 0x4efc`); `jmp (xxx).w` é **`4ef8`** | `jmp.w`, alvo `0x1f00` | **bytes equivocados (D)** |
| `KA4-2` | fluxo en `0x8400` referenciado con `lea (0x8400).w` | un absolute short co bit 15 activo **non pode** apuntar a ROM `0x8400` | `saida_sha256` dun stream de 128 B | **premise imposible (D)**; en v2 os fluxos ≥ `0x8000` reférencianse con `lea .L` (`43f9 0000 8400`) ou `(d16,PC)`, e queda unha probe negativa deliberada que espera a recusa de work-RAM |
| `KC1-movea.l #imm32,A1` | `227c 0000 1111` | `moveal #4369,%a1` — **MC68000 válido** | «fronteira opcode-fora-do-subconjunto» | **premisa falsa (D)**: `CONTRACT.md` de C liña 77 *declara* `MOVE`/`MOVEA` `.B/.W/.L`; e o ISA tamén. Non foi un defecto de C atopado pola barra — **retificado en §12.10 h: a citação estaba truncada; a mesma liña 77 di «`#imm` só em MOVE», polo que a premisa de v1 era correcta para C e o ditame «premisa falsa (D)」é un erro de D** |
| `KC3-move-w-imm-an` | `327c …` | GAS monta `move.w #0x1234,%a1` como `moveaw #4660,%a1` (`327c 1234`) | «combinación inválida detectábel» | **non expressable en bytes (D)**: a invalidade é do mnemónico, non da codificación — a palabra é unha MOVEA.W válida. `CONTRACT.md:79` de C si promete «combinações inválidas (p. ex. MOVE.W → An) = fronteira», aserción irrealizable a nivel de codificación: publícase como **defecto documental de C**, non de capacidade. A fila retírase en v2 — **§12.10 h mantén este ditame: aquí os dous eixos non se confunden, a palabra é válida E está na lista (MOVEA rexistro→An), e o que non existe é a codificación da forma que C di que detecta** |
| `TA-3` | (rc 11 esperado, 7 medido) | rc 7 = ALVO-DIVERXENTE, rc 11 = XEOMETRIA-DIVERXENTE, ambos en `CONTRATO-A` §5 | rc 11 exacto | **receita confusa (D)**: movía o alvo declarado xunto coa ventá. v2 sepáraa en `TA-3a`/`TA-3b` (§12.4). A recusa de A era xusta en calquera dos dous eixos — non é falla de seguranza |
| `TA-5` | (rc 6 esperado, 2 medido) | rc 2 = ESQUEMA, «contrato estrutural roto **antes de medir**» | rc 6 exacto | **receita confusa (D)**: a mutación de D rompía a forma do rexistro, polo que nunca chegou ao eixo operando. En v1 non se pode afirmar que A deixase pasar un operando alterado: **esa pregunta queda sen medir** ata `TA-5v` |

## 12.7 Fixtures v2 e pins

`author_frentes.mjs` v2 escribe `dA-img-v2.bin`, `dA-truth-v2.json` e os
`dC-cx*-v2.bin` cuxas sondas veñen de `isa-oraculo-v2` (bytes do montador, R14), con
`pin.json` propio (SHA-256 por arquivo) e a marca `gabarito: isa-oraculo-v2`.

As fixtures v1 **non se re-xeran nin se tocan**. Os seus pins actuais, medidos no
arquivo Versionado o 2026-10-05, son os que a suite xa exige:

| arquivo v1 | SHA-256 |
|---|---|
| `dA-img-v1.bin` | `a40ae21d21ea06171bce9d318e29372d2d9cc0107180107a6919f4c280b6dd18` |
| `dA-truth-v1.json` | `07198d453d2044e761ae2306dc508f3dd477e5d29c35d748861bae9b2643e032` |

Re-executar o autor v1 ten que seguir dando eses bytes: `frentes.test.mjs:390-400`
xa confronta o `buildAImage()` en memoria, o arquivo da árbore e o `truth_sha256`
contra o manifest da evidencia (o teste chámase «a autoría de A deixou de ser
determinista» cando deixa de coincidir). Un fixture v2 non substitúe a probe v1: son
dúas estruturas distintas, e a matriz di con cal se mediu cada fila (R15).

## 12.8 Holdout v2 (R17)

- Inputs públicos en `data/…/d/frentes/holdout/`, respostas reservadas en
  `~/rds-scratch/rex-heldout-d3/`.
- `pin.json` versionado leva o **SHA-256 de cada resposta** (non a resposta). Un
  scratch perdido non volta a fila a `VOID`: a resposta pódese volver a producir e
  confrontar contra o pin.
- O holdout `cbb6895` da rolda 2 non se reutiliza como proba de `bd40e92` nin de
  `8ea5821`. Os dous `VOID` rexistrados contra D (`H-A-v1`, `H-A-v2`) seguen sendo
  `VOID`.

## 12.9 Defectos propios descubertos ao construír v2 (rexistro honesto)

- **A restrición «non hai ensamblador 68000 neste host» era falsa.** §5 e
  `RELATORIO-D` §10.8 punto 6 afirmárona o 2026-10-04. `m68k-elf-as` e
  `m68k-elf-objdump` si estaban: en `~/.cache/retrodevstudio/17f7bcf5…/source-build-m68k_gcc/source/install/bin`,
  fóra do `PATH` que D consultou. Consecuencia directa: as sondas codificadas a man
  de v1, e con elas seis filas erradas, eran evitables. Non se alega «imposibilidade
  do host» ningunha vez máis: D busca en PATH **e** no almacén de ferramenta
  pinada antes de declarar unha ausencia.
- **`makeRng()` é dexenerado en todas as sementes, non en tres.** O sondeo de
  2026-10-05 (`~/rds-scratch/d-oraculo-20261005/diag_rng.mjs`) deu: para as 8
  sementes nomeadas das fixtures, **4096/4096 saídas = 0**; na varrida de 16 000
  sementes (`d::s<i>`, `dsb1::s<i>`, `frentes::s<i>`, `s<i>` para i<4000),
  **16 000/16 000** (100%) colapsan a ceros antes de 1024 saídas. Mecanismo: o
  produto `state × multiplicador` non se trunca a 64 bits antes de `Number(…)`, así
  que o valor (~2⁹²) redóndase en coma flotante e `… % 256` é sempre 0. Ademais o
  multiplicador escrito no código (`2685821657763633871`) **non** é o de
  `xorshift64*` (`2685821657736338717`): difire a partir do 11º díxito. Consecuencia
  sobre a rolda 2: todas as estruturas `RDSDBNCH`/`dsb1-*` derivadas del son
  **enteropía cero** — rexístrese aquí, e queda pinned como `control-historico`
  coa súa propia proba (R16) cando se fixexe o xerador.
- **Empaquetado de sondas (R14).** En `dA-img-v1.bin` as probes ían continuas, sen
  separación; cando A recusaba unha forma, o scanner seguía lendo a sonda veciña.
  Iso é o que produce o raro `chamada_forma: jsr.l` na fila `KA1-bsr.l`: non foi
  unha resposta de A sobre `61 ff`, foi a sonda seguinte a falar.
- **Premisas falsas en KC1/KC3** (§12.6) e **expectativas de rc exactas en TA-3/
  TA-5** (§12.4): as catro eran defectos da barra, non das frentes. A rolda 2
  presentou «3 falhas en C» e «8 falhas en A@bd40e92»; con gabarito v2 esas
  categorías trasládanse a defecto de D. **Esta rolda non re-xulga esas filas v1**
  (R0): publícanse como están e a rectificación vai na lectura (§11 de
  `RELATORIO-D`) e nas filas novas.

## 12.10 Adendo de rectificacións — escrito antes de calquera medición v2

Data: 2026-10-05. Estado das fixtures v2 neste momento: `dA-img-v2.bin`,
`dA-truth-v2.json` e `pin-v2.json` xa xerados e probados
(`frentes/author_v2.test.mjs`, 22/22); **ningunha fila v2 foi executada contra
ningunha fronte**. Este adendo non reescribe §12.3 nin §12.4 (R0): engádese
puntadores nas filas afectadas e aquí queda a rectificación completa. Cada
afirmación cita o ficheiro:liña lido en `bd40e92`
(`~/rds-scratch/d-frentes-20261004/a-bd40e92/…/a/src/`) ou o gabarito pinned en
`gabarito/isa-oraculo-v2.json`.

*Ampliación do mesmo día, co punto (h):* existe **unha execución previa á autoría**
da fronte C — a sonda de catro formas `frentes/sonda_c_previa.mjs` contra o build
`275f2af`, evidenciada en `~/rds-scratch/d-c-probe-20261005/observacions.json`. Non
é fila da matriz nin entra en denominador algún: serve só para que (h) cite
comportamento observado xunto coa lectura estática. Ningunha das 42 filas v2 de C
foi executada, e as expectativas de (h) conxélanse antes delo.

**(a) Denominador da fronte A: 33 → 34 → 35.** §12.3 conxelou 33 filas. Dúas
correccións de deseño, ambas anteriores a medir, móvenoo:
`61 FF` sai de `KA1v-neg` e entra en `KA1v-fora` (distribución 2/3, total
inalterado — punto d); `TA-3` desdóbase en `TA-3a`/`TA-3b` para illar
`vínculo` de `xanela` (TAv 8→9, total 34); e a re-avaliación de códigos
(requisito 7) engade `TA-5b` (TAv 9→10, total **35**). Rexístrase o
intermedio 34 para que a serie sexa reconstruíbel. Publica-se en
`pin-v2.json` → `denominador.nota`.

**(b) Unha fila do gabarito está mal etiquetada; o pin non se toca.**
`isa-oraculo-v2.json` (55 filas) ten exactamente unha incoherencia:
`movea-w-an` leva `classe_instrumento: "recusada-68000"` e `rc_montador: 0`,
`erro_montador: null`, `desmontaxe: "0:\t3248\tmoveaw %a0,%a1"`. O instrumento
**non** a recusa: codifica `3248`. Consecuencia: a etiqueta é un erro de D ao
transcribir a táboa; `author_v2.mjs` le só `bytes_hex`, `rc_montador` e
`desmontaxe` (os tres campos verificados contra a saída do propio binario
pinado) e **non** usa `classe_instrumento`. O JSON do gabarito queda como está
(fila `KA1v-fora-movea-w-an` documenta a discrepancia na súa
`nota_instrumento`). Requisito 4 cumprido: a expectativa de «MOVEA.W é
inválida» corríxese — MC68000 si a codifica; o que A fai é excluíla do seu
subconxunto de carga (`instr.rs:247` → `NonForma` → rc 5, `main.rs:327-332`).

**(c) `KA2v`: «destino fóra do bus ⇒ erro, nunca clamp» era unha lectura
equivocada do contrato de A.** A fronte publica en RECTIFICACION-A §2 un modelo
de tres niveis (efectivo 32 b → bus 24 b → offset) e o código applícao no elo
de destino: `main.rs:374` `let dop_bus = dop & BARRAMENTO;` e
`clasificar_rexion(dop_bus, rom_size)` (`verify.rs:150-163`). O que A promete —
e cumpre— é que a diferenza **se rexistra**: `main.rs:467-474` engade a
limitación literal `efectivo≠bus(destino): efectivo=0x1000000 → bus=0x000000: a
rexión clasifícase polo bus`, co comentario «rexistrar como limitación, nunca
clampa en silencio (RECTIFICACION §2)». Polo tanto a expectativa que se mide en
`KA2v-fora-bus` **non** é `rc ≠ 0`: é `rc 0` **máis** a presenza desa
limitación. O FAIL é o clamp silencioso — rexión devolta sen limitación —, e
`clamp_silencioso_prohibido: true` queda en todas as filas `KA2v`. §12.3
liña 519 lése desde agora así.

**(d) `61 FF` non é «palabra sen mnemónico».** No bloque montado
(`dA-img-v2.bin`, probe en `0x2ac`) `m68k-elf-objdump -d` imprime
`bsrs 2ad <p_KA1v_fora_61ff+0x1>`: BSR.S lexítimo de MC68000 con desprazamento
−1, enderezo efectivo `sitio+2−1 = 0x2ad`. No obxecto dun só símbolo do oráculo
as mesmas seis palabras léntese `bsrl` (fila `bruto-61ff-bsrl`): **a lectura
depende do contexto de símbolos do desmontador, non do byte**. A fila móvese de
`KA1v-neg` a `KA1v-fora` e o seu motivo pasa de `indefinido-68000` a
`68020-non-declarado`, que é a recusa que A elixe e publica en
`instr.rs:147-154`. O que se mide segue sendo unha recusa limpa; o que cambia é
*a pregunta*: «a fronte recusa unha instrución MC68000 válida fóra da súa
gramática», non «a fronte recusa un byte sen sentido». `4EFD`/`4EFC` si quedan
en `KA1v-neg` (`instr.rs:221` → `indefinido-68000`; o instrumento imprime
`.short`).

**(e) Dous vocabularios de rexión dentro de A, e a ventá pásase por bandeira.**
Para `0xFF8400`: `verify.rs:150-163` (`clasificar_rexion`) devolve
`ram-68k-mirror`, mentres que o texto do elo de mapper constrúese con
`rex_addressing::Translate::Device { region }` (`verify.rs:137-140` +
`crates/rex-addressing/src/region.rs:36`) e imprime `work-ram`. Unha expectativa
que ancore o nome da rexión cualificaría de falla unha resposta correcta da
ferramenta. Por iso `KA1v-lea-w-alto` acepta `{4}` co motivo
`sen backing ROM` — a parte estable do texto — e non o nome da rexión. Además a
ventá de emparellamento **pásaa D explicitamente** (`--ventanxa 16`);
`VENTANXA_DEFECTO = 16` (`verify.rs:20`) é coincidente pero non se herda:
`main.rs:140/251/600` len a bandeira, e a medición non queda ao arbitrio do
defecto da ferramenta medida.

**(f) Requisito 7: re-avaliación dos códigos polo contrato vixente, antes de
medir.**
- `TA-5v` (operando adulterado no rexistro): `{6}` → **`{2}`, elo `esquema`**.
  `chain.rs:363-366` — con confianza `vinculo-estrutural`, `validar()` exige
  `bus(carga_operando) == fluxo_cpu` **antes** de medir, así que rc 6
  (`argumento-fonte`, `verify.rs:342-347`) é **inalcanzable** para esa receita:
  só se alcanza cando a estrutura xa é coherente. rc 0 segue sendo FAIL e
  calquera rc fóra do conxunto publícase como `descoñecido` co elo medido (R12).
  §12.4 liña 551 queda retificada: a súa cláusula de escape («se A volvese a
  responder 2…») xa non é un plan B, é a expectativa.
- `TA-5b` **nova**: forma de carga trocada conservando bytes, operando e fluxo
  coherentes ⇒ `{6}`, elo `forma-carga` (`verify.rs:312-336`). É o elo que a
  pregunta original de TA-5 quería exercer e que v1 nunca tocou: con estas dúas
  filas a pregunta «detecta A un operando/forma alterados?» queda medida nos
  dous elos reais, non nunha quimera.
- Toda receita `TAv` declara `elo_aceitado` (10 valores: identidade, saída,
  vinculo-chamada-rutina, xeometria, sitio-carga, esquema, forma-carga,
  alvo-chamada, rutina, mapper). O rc di **que** rexeitou; o elo di **onde**. Un
  rc correcto co elo equivocado non illa o eixo que a receita afirma, así que
  esas filas miden como `descoñecido`.
- `TA-3a` `{7}` elo `vinculo-chamada-rutina` (`verify.rs:594-601`) e `TA-3b`
  `{11}` elo `xeometria` (`verify.rs:616-623`): a xanela illesa no primeiro caso
  (segunda chamada real a 14 B, ≤ 16) e o alvo coherente no segundo. v1 non
  podía separalos porque só había unha chamada dentro da ventá.

**(g) Defectos propios atopados polos tests de v2 antes de medir (rexistro
honesto, á marxe de §12.9).** (1) O autor copiaba á imaxe só os bytes das
probes e recheaba de ceros os ocos, contradicindo os separadores `nop` que el
mesmo documentaba; agora colócanse `montado.grupos`, isto é, o bloque tal como
o emite GAS, e a imaxe v2 é byte a byte a saída do instrumento. (2) A lista de
sondas que usaban os controlos estaba **derivada** das formas das filas e
ocultaba probes (as chamadas de `KA4v` non tiñan rexistro); o control de ocos
quedou cego e detectouno o test. Reparado publicando en
`dA-truth-v2.json` o campo `sondas_postas` — sitio e lonxitude ditados polo
montador — que é agora a única fonte dos controlos de solapamento, ocos e
ventá. (3) `KA3v`, `KA4v` e as filas de recusa non levaban o ditame completo de
`objdump` (mnemónico + enderezo efectivo) para as súas chamadas; todas as filas
que citan probes levan agora `sondeo` e `chamada` coa lectura do instrumento.

**(h) Requisito 4 no dominio de C: son dous eixos, e §12.6 mesturóuos.** Unha forma
pode ser MC68000 válida —dito polo instrumento— e estar **fóra da lista fechada da
fronte** —dito polo contrato desa fronte—. §12.6 citou `CONTRACT.md:77` truncado. A
liña enteira (77–79, lida no build `275f2af`) di:

> - `MOVE`/`MOVEA` .B/.W/.L entre modos 68000 válidos (registros, `(An)`, `(An)+`,
>   `-(An)`, `d16(An)`, `d8(An,Xn)`, `abs.W`, `abs.L`, **`#imm` só em MOVE**);
>   combinações inválidas (p. ex. MOVE.W → An) = fronteira.

Consecuencia directa: o ditame «premisa falsa (D)」 da fila `KC1-movea.l #imm32,A1` de
§12.6 é un erro de D, e a expectativa de v1 era correcta.
- `movea.l #imm32,A1` está **fóra** da lista de C («`#imm` só em MOVE»), así que a
  expectativa que §3 promete é `fronteira` / `ponto-de-fronteira`.
- `movea.w %a0,%a1` está **dentro** (rexistro → An): válida *e* na lista. Para C a
  expectativa non é unha recusa — é decodificación con lonxitude 2. En A si é recusa
  (`instr.rs:247` `NonForma` → rc 5), porque a lista fechada de A é outra (a súa
  gramática de carga). Requisito 4 cumprido nos dous dominios sen os mesturar.
- `KC3-move-w-imm-an` **mantén** o seu ditame de §12.6: alí a palabra `327c` é unha
  MOVEA.W válida e na lista, e a «combinação inválida MOVE.W → An» que C promete non
  ten codificación propia. O erro daquela fila é documental, non de mestura de eixos.

Proba estática en `275f2af` (`…/c/scripts/…/c/src/decode.rs`): a garda da fonte no
modo 7 (`decode.rs:599`) rechaza `sreg` 2/3 (PC) e `SRC7_BAD = [5,6,7]`
(`decode.rs:426`), pero **non** `sreg == 4` (inmediato), e `mode_words`
(`decode.rs:177-195`) acepta `sub == 4` — 1 word para `.B/.W`, 2 para `.L`. A rama
MOVEA (`decode.rs:606-617`) só rechaza `size == 1` («MOVEA.B invalido») e devolve `Ok`
para calquera fonte que `read_ea` aceptara. A mesma función si rexeita a fonte PC, o
que indica que a omisión é concreta do inmediato e non unha política xeral.

Proba empírica **previa á autoría** (non é fila da matriz):
`frentes/sonda_c_previa.mjs`, evidencia en
`~/rds-scratch/d-c-probe-20261005/observacions.json` — imaxe
`aff327c9dfa0ba6a781e0a59ea1accbf4fb477942d306f41ebe099189d4a4b69`, binario
`rex-cfg` `075616e5ff0b7fa1734b883aff9fa98c8f00836fdd3080022222d75d80e95d19`, schema
`rex-cfg/v1`, `base_sha` `cb56657`. As catro formas deron:
`movea-l-imm` → decodifica `tam=6` (`moveal #(0x00001111), %a1`); `movea-w-an` →
decodifica `tam=2` (`moveaw %a0, %a1`); `move-l-pcd16` → fronteira
`opcode-fora-do-subconjunto` co motivo literal «MOVE com fonte PC-relativo ou reservada
(fora do contrato §3)»; `move-l-imm` → decodifica `tam=6`. É dicir: o §3 de C é máis
estrito que o seu descodificador, e a cláusula «só em MOVE» é restrición de C, non do
ISA.

Expectativas conxeladas antes de medir (o que a matriz puntuará contra `8ea5821`):
- `KC1v-movea-w-an` — fila **dentro-da-lista**: espera decodificación no sitio, `tam` =
  ditame do instrumento e talo de mnemónico `movea`.
- `KC1v-movea-l-imm` — fila **fóra-da-lista**: espera `ponto-de-fronteira` con
  `tipo: opcode-fora-do-subconjunto`, porque é o que o §3 publicado promete. Se a
  ferramenta decodifica, a fila publícase como **`falha` de C** coa cita
  `decode.rs:599` + `decode.rs:606-617`, non como defecto da barra. O resultado xa está
  anunciado por escrito antes da medición: D non «descobre» a falla ao medir.
- Se `8ea5821` se comporta de outro modo que `275f2af`, a fila non se reescribe:
  publícase a diverxencia entre os dous SHAs (precedente: §12.6, R0).

Denominador: §12.3 conxelou `KC1v` en 20 dicindo «as dúas filas de MOVEA», pero o
inventario de v1 só contén unha (`moveal_imm_a1`). A segunda non pode caber nos 20 sen
retirar outra, e ningunha das 20 se pode retirar: cada unha ancorou unha forma da lista
fechada. `KC1v` pasa a **21** e a fronte C de **41 a 42**; rexístrase o intermedio.
Non é un axuste para acomodar resultados — engade unha fila que §12.3 xa daba por
existida.

**Pins v2 da fronte A** (os dixestos vixentes tras este adendo; a fonte
autorizada é `data/…/d/frentes/a/pin-v2.json`):

| arquivo v2 | SHA-256 |
|---|---|
| `dA-img-v2.bin` | `e02ab639083ae047541c6700383f39d9afae4316f63f006875fcb87526e6ae5a` |
| `dA-truth-v2.json` | `c7ddde79390ceffe9ed6fccc76f50dd2203417a38a98e296030987d6f551d414` |

O fixado aquí non substitúe o pin: `author_v2.test.mjs` confronta disco,
verdade e pin en cada execución, e `dA-img-v1.bin`/`dA-truth-v1.json` seguen
cos seus dixestos históricos (`a40ae21d…`, `07198d45…`) comprobados contra o
manifest da rolda 2 (`medidas/A-bd40e92-manifest.json`), non contra un valor
escrito a man — o intento de escribilo a man deu un falso FAIL e quedou
rexistrado como defecto propio (R16 do test «as fixtures v1 conservan os pins
co que publicou a súa propia evidencia»).

