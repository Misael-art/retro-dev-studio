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
| saída | TA-2: byte no meio do stream Kosinski ⇒ rc 9 `SAIDA-DIVERXENTE` | KB-4: inversão com padding sujo ⇒ recusa | TC-4: 1 byte virado que muda comprimento ⇒ `cobertura` do export deve mover-se exatamente o delta da verdade D |
| geometria | TA-3: site ímpar ⇒ rc 11 `XEOMETRIA-DIVERXENTE` | KB3: geometrias divergentes ⇒ recusa `geometria-errada` | KC3: atravessar fim de região ⇒ fronteira, não extensão de bounding box |
| sítio | TA-4: byte do sítio de carga virado ⇒ rc 5 `SITIO-DIVERXENCIA`; TA-5: operando `.L` alterado ⇒ rc 6 `ARGUMENTO-DIVERXENTE`; TA-6: bytes da chamada alterados ⇒ rc 7 `ALVO-DIVERXENTE`; TA-7: bytes da rotina pinada alterados ⇒ rc 8 `ROTINA-DIVERXENCIA`; TA-8: `--rom-size` divergente da tradução ⇒ rc 4 `MAPPER-DIVERXENCIA` | KB1: deslocar 1 byte o endereço do laço alegado ⇒ sonda D registra divergência (a ROM é o oráculo, não o doc) | TC-2: `--site` dentro do miolo de instrução ⇒ veredito `miolo-de-instrucao`, jamais `instrucao-de-bloco`; TC-3: raiz fora da região ⇒ `fora-da-regiao` |
| confiança | §3 KA3-g: campo desconhecido e `observado-en-runtime` ⇒ rc 2 `ESQUEMA` | modo `hipotético` rotulado; `verificado` sem evidência íntegra não promove | TC-1: `--root-prov` fora do vocabulário fechado ⇒ erro de CLI (não análise); grau de raiz nunca promovido pelo fluxo |

Contagens TA=8, TC=4 já incluídas nos denominadores §3/§5; NB em §4.

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
