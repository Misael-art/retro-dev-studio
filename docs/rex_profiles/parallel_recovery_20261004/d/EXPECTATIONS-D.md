# EXPECTATIONS-D — barra de avaliação da recuperação paralela (letra D)

**Status:** congelado antes de qualquer medição. Este arquivo é o commit-so da
etapa: nenhuma linha deste documento pode ser reescrita depois de ter havido
medição. Se um resultado divergir do que está aqui, o veredito é `FAIL` ou
`INCONCLUSIVE` e a divergência é registrada com a série bruta — a expectativa
não é ajustada para acomodar a implementação.

**Base fixada:** `codex/rex-sonic-sequencia` @ `cb56657a142df40d2acd09a3e03e54247f066dea`
(local e `origin` idênticos, verificado em 2026-10-04). O workspace canônico
estava em `b53ce7a` (frente MUGEN) — diferença registrada, não acompanhada.

**Host no início da sessão:** `READY`, fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`,
lock `dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377`.

**Território:** `scripts|docs|data/rex_profiles/parallel_recovery_20261004/d/`.

---

## 1. O que esta barra existe para impedir

Um erro compartilhado entre detector, decoder, compositor e relatório produz um
veredito verde sem correspondência com o objeto. Exemplos concretos que esta
barra recusa:

- o detector classifica um codec, o decoder assume o mesmo codec sem prova, e o
  relatório soma os dois acertos como uma cadeia;
- uma stream válida é lida, mas nada a referencia: sem barra, ela vira item
  "correto";
- um dado que só parece opcode vira alvo de branch, e o grafo de controle ganha
  arestas falsas;
- um export não traz um campo: a barra ingênua lê `undefined` como lista vazia,
  calcula `0 erros` e publica `PASS`.

## 2. Fonte da verdade

A verdade conhecida vem **exclusivamente da autoria** dos fixtures: cada byte é
produzido por `scripts/.../d/bench_author.mjs` a partir de parâmetros escritos
neste projeto e de um PRNG determinístico (algoritmo `xorshift64*`, semente
registrada). Nada de um detector, decoder ou relatório das frentes A/B/C entra
na geração de expectativas.

Linha de evidência (declarada, sem esconder a dependência): a fonte autoral
(formato do contêiner e codecs autoralizados `dsb1-*`) e o build que produz os
fixtures pertencem à **mesma linha de evidência**. Por isso:

- o round-trip interno (codifico e decodifico com meu próprio código) **não é**
  prova por si só;
- as duas streams Kosinski do benchmark são verificadas contra um instrumento
  **externo à frente D**: `scripts/rex_profiles/codecs/kosinski/kos_mirror.py`
  (espelho Python da referência pública mdcomp, commit `72c6df40`, família B).
  Essa verificação é cruzamento entre linhas diferentes, não confirmação
  interna. O próprio cabeçalho do espelho declara que ele não é oráculo
  independente de mdcomp; a limitação é herdada e registrada em
  `RELATORIO-D.md`.
- os payloads autoralizados têm SHA-256 publicado no ground truth; qualquer
  ferramenta pode conferir o hash contra o byte gerado sem depender de mim.

## 3. Inventário autoral congelado — conjunto `dev-1`

Endereços de região são offsets de bytes no `fixture.bin`. Os valores abaixo são
de autoria e não devem ser recalculados por detector alheio.

| ID | classe | codec esperado | referenciada por consumidor | dimensões que contam |
|---|---|---|---|---|
| R-S1 | stream | `dsb1-lz` | C-ART-01 (word) | identity, binding, output |
| R-S2 | stream | `dsb1-lz` | C-ART-02 (word) | identity, binding, output |
| R-S3 | stream | `dsb1-rle` | C-PAL-01 (byte) | identity, binding, output |
| R-S4 | stream | `dsb1-store` | C-SND-01 (byte) | identity, binding, output |
| R-S5 | stream | `kosinski` | C-ART-03 (word) | identity, binding, output |
| R-S6 | stream | `dsb1-lz` | C-TXT-01 (byte) | identity, binding, output |
| R-K1 | stream | `dsb1-lz` | **nenhuma** (decoy) | identity, não-consumo |
| R-K2 | stream | `dsb1-rle` | **nenhuma** (decoy) | identity, não-consumo |
| R-K3 | stream | `kosinski` | **nenhuma** (decoy) | identity, não-consumo |
| R-X1 | bloco de pixels | `pixels4bpp` | T-PX-01 | geometry, flow-negativos |
| R-G1 | bloco de tiles | `tiles4bpp-planar` | T-TILE-01 | geometry, output |
| R-G2 | bloco de tiles | `tiles4bpp-planar` | T-TILE-02 | geometry, output |
| R-T1 | tabela de saltos | `branch-table` | C-CTRL-01 | flow (5 alvos) |
| R-T2 | tabela de saltos | `branch-table` | C-CTRL-02 | flow (4 alvos) |

Valores congelados:

- regiões stream-shaped: **9** (6 referenciadas + 3 decoys sem consumidor);
- consumidores referenciando stream: **6**;
- consumidores referenciando geometria: **2**;
- consumidores referenciando tabela de saltos: **2**;
- alvos de fluxo autenticamente referenciados: **9** (5 em R-T1 + 4 em R-T2);
- alvos de fluxo **falsos plausíveis** plantados dentro de R-X1: **6** — estes
  NÃO devem aparecer como alvos;
- `dsb1-lz`: 3 referenciadas + 1 decoy; `dsb1-rle`: 1 + 1; `dsb1-store`: 1 + 0;
  `kosinski`: 1 + 1;
- R-G1 e R-G2 têm **exatamente o mesmo comprimento em bytes**, com geometrias
  diferentes (R-G1 `16x16`, R-G2 `8x32`) — é o par que detecta geometria trocada;
- itens primários (para a métrica de cadeias): **10** = 6 streams + 2 geometrias
  + 2 tabelas;
- itens negativos (para a métrica de vínculo falso): **3 decoys + 6 falsos
  alvos = 9**.

## 4. Inventário autoral congelado — conjunto `ho-1` (reservado)

Mesmo formato, semente secreta (não commitada) e inventário maior. Os
**contagem** são publicadas aqui porque o runner precisa delas para denominador;
os **valores de resposta** (payloads, SHA, endereços, alvos) ficam selados.

- regiões stream-shaped: **12** (8 referenciadas + 4 decoys);
- consumidores stream: **8**; geometria: **3** (dois blocos de mesmo
  comprimento, geometrias diferentes, e um terceiro de comprimento único);
  tabela de saltos: **3** tabelas, **13** alvos verdadeiros;
- falsos alvos plantados: **9**;
- itens primários: **14**; itens negativos: **4 decoys + 9 falsos alvos = 13**.

Limitação honesta do conjunto reservado: o contêiner é auto-descrito (há um
diretório no cabeçalho), então um leitor desonesto pode extrair a resposta
lendo o fixture. O que a reserva protege é o *gabarito de veredito* — quais
regiões são decoy, quais alvos são falsos, e os hashes de saída esperados —
não o formato. A semente de `ho-1` não é commitada; o arquivo de respostas fica
fora da árvore versionada e só entra no repositório no passo de unseal
post-medição.

## 5. Dimensões e denominadores (nunca um percentual único)

O relatório imprime uma linha por dimensão, sempre `acerto/denominador` +
`não_encontrados` + `divergências` + `falsos_vinculos` + `unknowns`. Proibido
publicar uma média entre codec, geometria e fluxo.

| D | dimensão | denominador `dev-1` | denominador `ho-1` |
|---|---|---|---|
| D1 | identidade de codec por região | 9 | 12 |
| D2 | vínculo consumidor→alvo correto | 6 | 8 |
| D3 | saída descomprimida (SHA + comprimento) | 6 | 8 |
| D4 | geometria (w, h, bpp, planar) | 2 | 3 |
| D5 | composição de tiles (SHA do plano composto) | 2 | 3 |
| D6 | alvos de fluxo corretos | 9 | 13 |
| D7 | cadeias completas (todos os campos do item corretos) | 10 | 14 |
| N1 | decoys consumidos incorretamente | 3 | 4 |
| N2 | falsos alvos de fluxo reportados | 6 | 9 |

## 6. Regras de veredito (fail-closed)

- **R1** campo de dimensão ausente, `null` ou de tipo errado ⇒ `INCONCLUSIVE`
  nessa dimensão com `não_encontrados = denominador`. Lista vazia **não** é
  ausência: vazia com denominador > 0 é `FAIL` com `cobertura 0`.
- **R2** denominador vem sempre do ground truth, nunca do export. Um export que
  omita itens não reduz denominador nem melhora razão.
- **R3** `PASS` em uma dimensão exige: `não_encontrados == 0`,
  `divergências == 0`, `falsos_vinculos == 0` e, para as dimensões negativas,
  contagem zero de decoy consumido.
- **R4** ausência do export inteiro (ou SHA do export diferente do pinado) ⇒
  `INCONCLUSIVE` global, com motivo; nunca `PASS` e nunca "nada a reclamar".
- **R5** `confidence` maior que `proved` sem prova anexada (`proof` ausente,
  `proof.artifact_sha256` divergente, ou `confidence=verified` sem
  correspondência de saída) ⇒ item rebaixado a `unknown_sem_prova` e contado em
  `unknowns`; **não** entra no numerador.
- **R6** qualquer item do ground truth marcado `unknown` pela ferramenta é
  registrado como `interrupção_unknown` com endereço e motivo; `unknown` é
  resposta honesta, mas não soma acerto.
- **R7** divergência de saída (SHA ou comprimento) nunca é "quase": é
  `divergência de saída` com ambos os hashes na evidência.

## 7. Controles de mutação — veredito esperado

Cada mutação é aplicada sobre o ground truth `dev-1` em memória e executada
contra o runner. O runner **tem** que reprovar cada uma. Um runner que passa em
alguma delas está quebrado, e isso é achado, não detalhe.

| ID | mutação | veredito esperado |
|---|---|---|
| M1 | `mapper_wrong`: alvo word interpretado como byte | D2/D3 `FAIL`; cadeias D7 `FAIL` |
| M2 | `branch_target_wrong`: um alvo verdadeiro substituído por um alvo falso plantado | D6 `FAIL` + N2 > 0 |
| M3 | `consumer_removed`: um vínculo consumidor→stream apagado | D2 `FAIL` com `não_encontrados ≥ 1` |
| M4 | `geometry_swapped`: (w,h) de R-G1 e R-G2 trocados, bytes idênticos | D4 `FAIL` e D5 `FAIL` |
| M5 | `unreferenced_stream_claimed`: decoy R-K1 apresentado como consumido | N1 > 0 e D7 não aumenta |
| M6 | `confidence_promoted`: `verified` sem prova anexada | rebaixado a `unknown_sem_prova`, D7 `FAIL` |

Adicional obrigatório: **um export vazio** (todas as listas `[]`) deve dar
`FAIL` com `cobertura 0` em cada dimensão, e **um export omitindo uma dimensão
inteira** deve dar `INCONCLUSIVE` nessa dimensão. Os dois casos estão nos
testes e separam a contagem zero favorável da ausência.

## 8. Estado atual das frentes avaliadas (demonstração da referência ausente)

Em 2026-10-04, medido com `git log` no repositório canônico após `git fetch`:

- `codex/rex-parallel-a-kosinski-chains` → `cb56657` (zero commits próprios);
- `codex/rex-parallel-c-cfg` → `cb56657` (zero commits próprios);
- frente B de 2026-10-04: nenhuma branch criada.

Portanto não existe export das três frentes desta rodada para medir. A barra é
congelada agora e a medição ocorre quando os exports existirem, por SHA.
Enquanto isso, a frente D cumpre o item 6 da missão avaliando as entregas
**anteriores** das mesmas linhas de trabalho (família Kosinski/codec e
detecção), com os instrumentos disponíveis sem compilação pesada, e declara a
dependência de fonte compartilhada quando ela existir.

## 9. O que esta barra NÃO alega

- Não afirma que os fixtures autorais representem ROM comercial alguma. As
  amostras BYOR entram apenas como metadados pinados, somente leitura; nenhuma
  hipótese sobre conteúdo comercial é promovida a verdade de ground truth por
  nome de arquivo ou aparência.
- Não mede qualidade de produto nem maturidade de roadmap.
- Não substitui os gates do projeto; roda dentro de `npm test` como suíte de
  ferramentas e não promove nenhuma superfície.
- Um `PASS` aqui significa apenas: a ferramenta avaliada concordou com a verdade
  autoral nas dimensões medidas, nos fixtures medidos.
