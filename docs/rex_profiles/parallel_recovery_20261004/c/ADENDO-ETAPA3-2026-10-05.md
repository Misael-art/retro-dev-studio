# Adendo ETAPA 3 — R-3 (2026-10-05): vocabulário de procedência, não-vacuidade do E4-1(iii) e
# limites do censo

Este adendo **não reescreve** `EXPECTATIONS-ETAPA3.md`: acrescenta expectativas que a medição
da própria ETAPA 3 revelou estarem ausentes, e registra a ordem dos fatos. Base: ponto recebido
`8ea5821`, retificação `CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md` (R-1, R-2).

## R-3.1 — quinta classe no vocabulário de procedência das recusas

O §4 das expectativas pedia, para cada grupo de `recusa-declarada`, um apontador de cláusula. As
quatro classes previstas (`CPU-ALVO`, `LISTA-3`, `MISTA-CPU-ALVO+LISTA-3`,
`DIVERGENCIA-REGISTRADA`) não cobrem um caso real, medido: o rotulo
`JSR/JMP com alvo nao comprovado (indireto ou PC)` tem 52 words, e **nem** a máquina-alvo o proíbe
**nem** a lista fechada do contrato 3 o nomeia.

Evidência medida (sonda `as -m68000` v9, sha `b827f78e…`): `jsr (a0),` = `4e90`, `jmp (a0),` =
`4ed0`, `jmp (%pc,0x8)` = `4efa0008`, `jsr (0x8000).w` = `4eb88000` e `jmp (0x8000).w` =
`4ef88000` **montam** na CPU-alvo. A recusa vem da **proibição estrutural §0.2** — não publicar
alvo não comprovado —, que é uma regra da ferramenta, não da ISA nem da lista.

Classe nova: `PROIBICAO-ESTRUTURAL-0-2`. Vocabulário passa a ter cinco valores; o inventário
projetado pela tabela de 39 linhas (cada linha com justificativa ≥ 40 caracteres e fonte citando
linha exata da sonda v9 e da extração do M68000PRM, sha `06e4864b…` / extração `a36371ae…`) é:

| classe | grupos | words |
|---|---|---|
| `CPU-ALVO` | 25 | 11 012 |
| `MISTA-CPU-ALVO+LISTA-3` | 10 | 3 254 |
| `LISTA-3` | 1 | 16 |
| `PROIBICAO-ESTRUTURAL-0-2` | 1 | 52 |
| `DIVERGENCIA-REGISTRADA` | 2 | 32 |
| **total** | **39** | **14 366** |

**E4-4 continua valendo**: nenhuma forma entra na lista fechada por decisão da auditoria. Os 11
grupos `LISTA-3`/`MISTA` são registrados como **candidatos** a retificação, a decidir pelo
principal.

## R-3.2 — E4-1(iii) tem de ser não-vazio, e separado por forma

Na passada 4 (e na primeira passada 5) o pacote reportou `divergencia-critica = 0` **com**
`confronto-de-alvo.confrontados = 0`. Zero comparações não é prova de conformidade: é ausência de
medição. Causa, medida: `objdump -b binary -m m68k -D` imprime o número com prefixo `0x`
(`jsr 0x4e71`, `jmp 0x4e714e71`), e o leitor do instrumento (`tests/support/oracle.rs`) só aceitava
hex puro, formato do `objdump -d` com símbolos (`bras 156 <lbl1>`). Ou seja: as 4 212 comparações
possíveis caíam todas no ramo "só-ferramenta" e a classe (iii) nunca foi exercida.

Expectativa nova, congelada **antes** da re-derivação do campo:

- **R-3.2-a** — `confrontados > 0` e `so-ferramenta = so-instrumento = 0`. O pacote em que
  `confrontados = 0` é **INCONCLUSIVE**, não verde.
- **R-3.2-b** — o bloco separa `abs-w`, `abs-l` e `desvio-pc-relativo`. Os pinos das formas
  absolutas **não** vêm da implementação: vêm da receita do corpus (§4 — um slot por word de
  opcode), que tem exatamente `4EB8`/`4EF8` como `abs.W` e `4EB9`/`4EF9` como `abs.L`. Portanto
  `abs-w = 2`, `abs-l = 2`, e `desvio-pc-relativo = confrontados − 4`.
- **R-3.2-c** — os quatro slots absolutos aparecem no pacote com o número nosso e o número do
  instrumento lado a lado (`exemplos-abs`), para conferir sem reler 502 328 linhas de dump.

## R-3.3 — o que o censo NÃO prova (espaço de operandos)

O corpus exaure o **espaço de opcode** (65 536 words), não o espaço de operandos: os 14 words de
preenchimento de cada slot são `4E71`. Consequência medida: todo operando `abs.W` confrontado tem
`bit15 = 0`, então o censo não discrimina extensão de sinal — ele discrimina comprimento, aceite e
o número exibido. A correção de P-absW (`u16 → i16 → i32`) é provada pelos negativos N1/N2, com
palavras construídas (`(0x8000).w`, `(0xFFFF).w`), não por esta tabela.

Limitação registrada da sonda do montador: o verificador de "monta" compara por **prefixo** do
texto, e o GAS substitui formas pedidas por outras (`add.w #3,%d0` → `addqw`, `sub.l #3,…` →
`subql`). Onde a conclusão é "não producível no alvo" a substituição não invalida nada; onde seria
"producível exatamente nesta word", ela não prova nada — e nenhuma linha da tabela usa essa
direção.

Diferença de contagem da extração do PRM: `pdftotext -layout` produz **28 040** linhas; as
expectativas citavam 28 041. É convenção de linha final, não outro documento: sha da extração
`a36371ae…`.

## R-3.4 — ordem dos fatos (para não fingir precedência)

1. Passada 4: `divergencia-critica = 14 366`, todos no grupo (iv) — recusa sem motivo declarável.
2. Tabela de 39 linhas autoral (classe + justificativa + fonte), derivada de sonda v9 e PRM, e a
   quinta classe criada **antes** de qualquer nova medição do campo de confronto.
3. Passada 5: `divergencia-critica = 0` **com** `confrontados = 0` → o defeito de R-3.2 foi achado
   por essa razão, e a série bruta (corpus `b2f4b455…`, dump da rodada) ficou preservada.
4. Teste RED do leitor (`tests/oracle_dump_binario.rs`): 2 falhas nas formas com `0x`, 2 passes no
   formato antigo → correção mínima, e depois a re-derivação com o campo separado por forma.

## R-3.5 — §5 N8: a cláusula que pedia `5CCA` recusado é retirada

O §5 (negativos, letra `5cca`) congelou "o montador da CPU-alvo recusa `5cca`". A medição anterior
e publicada contradiz a cláusula, em duas pernas independentes:

* o corpus congelado `fixtures/fx03_dbcc.s` (sha `be694c1d…`) contém `dbge %d5,f1`, e o seu dump
  `fixtures/fx03_dbcc-objdump.txt` (sha `f0fb56c2…`), linha 20, registra
  `14:	5ccd fff6	dbge %d5,c <f1>` — DBcc com campo de condição `%1100`;
* o instrumento pinado lê `5CC8`, `5CCA`, `5EC8` e `5FC8` como DBcc de **4** bytes (linhas do dump
  da varredura de §4).

Consequência: recusá-los criaria divergência crítica contra o árbitro escolhido no §4, e o teste
congelado `fx03_dbcc_tem_duas_arestas_e_bate_com_o_instrumento` compara exatamente essa word. A
cláusula é **retirada** e a divergência de ISA passa a ser **registrada, não apagada**: o formato
MC68000 fixa `bit11 = 0` e tem campo de condição de 3 bits (Tabela 3-19), enquanto o
`objdump -m m68k` genérico modela os 4 bits da família inteira. Aceitar essas words é paridade com
o instrumento, **não** afirmação de que o MC68000 as executa — o que fica pinado em
`tests/negativos_n1_a_n8_v2.rs::n8_…` (o `51ff` legítimo continua recusado, agora com a série
medida de R-3.7).

## R-3.6 — §5 N6/N7: dois graus independentes; a cláusula `promovivel: nao` fora-da-região é retirada

A expectativa congelada pedia que um alvo `fora-da-regiao` saísse com
`promovivel-vinculo-estrutural = nao`. Isso funde dois graus que o contrato das ETAPAs 1/2 já
separava, e o precedente está em teste congelado:

* `tests/consultar.rs:240-252` (`v1_jsr_abs_l_com_alvo_fora_da_regiao_tem_alvo_comprovado`) — sob
  raiz `referencia-estatica`, um sítio com `alvo-status = fora-da-regiao` assina
  `consumidor-validado = sim` **e** `promovivel-vinculo-estrutural = sim`;
* `tests/consultar.rs:270` (`v2_raiz_candidato_nao_promove_vinculo_estrutural`) — quem barra a
  promoção é a **proveniência da raiz** (`candidato` → `nao`, motivo
  `proveniencia-nao-autoriza-vinculo`, limite `raiz-declarada-nao-promovida`), e nada no corpo
  dessas funções olha o status do alvo.

E5-1 proíbe afrouxar asserções da ETAPA 2. Logo a correção não é a implementação nem o teste
antigo: é o contrato desta ETAPA 3. O pino em `tests/negativos_n1_a_n8_v2.rs` (bloco N6) passa a
exercer os dois graus separadamente sobre `4ef9 ffff 8000` — `alvo = 0xffff8000`,
`alvo-status = fora-da-regiao`, e `promovivel` alternando `sim`/`nao` conforme a raiz declarada for
`referencia-estatica` ou `candidato`.

N6 conserva o resto da cláusula congelada (`4e90`, `4ed0`, `4e99`…`4e9f`, `4efc` como
`indireto-opaco`, e as formas reservadas do grupo `4e` sem reclamar bytes), e **N7 não exige
retificação**: as duas funções `n7_formas_de_outra_cpu_continuam_recusadas_apos_a_correcao_do_abs_w`
e `n7_a_extensao_indexada_com_escala_nos_bits_10_8_nao_e_suportada` medem exatamente o que o §5
pedia — as recusas de `61ff`/`4efc`/`4efd`/`4afc` e da indexada com escala continuam estáveis, ou
seja a semântica correta de `abs.W` não reabriu nenhuma dessas portas.

## R-3.7 — três comentários citavam evidência falsa (`.short 0x51ff` / "medido em calib 0x14e")

A auditoria das evidências redigidas achou três lugares que atribuíam ao instrumento uma leitura
que ele não faz:

1. `src/decode.rs` (comentário DBcc), 2. `tests/historico_base.rs` e 3. `tests/movea_dbcc_v2.rs`
   diziam que o objdump pinado imprime `.short 0x51ff`. Medido no corpus de §4:
   `51ff0:	51ff	sf %d7` — o instrumento **lê** `51ff` como `sf` de 2 bytes (portanto a recusa é
   nossa, por formato MC68000 com destino reservado, e não acordo com o instrumento). Os mesmos
   três lugares citavam "medido em calib 0x14e": em `fixtures/calib-objdump.txt:109` o endereço
   `0x14c` carrega `67ff 51ff 4e76  beql 51ff4fc4 <braww+0x51ff4e66>`, i.e. um `beql` de 6 bytes —
   não há leitura alguma iniciada em `0x14e`. Os três textos foram reescritos com esta série.

Limitação nova, achada ao regenerar o dump para conferir (1) e (2): o **sha do dump da varredura é
dependente do caminho** — a linha 2 do cabeçalho do `objdump` embute o caminho do corpus, que em
`--check` é um `mktemp`. Medido (`docs/…/c/EVIDENCIA-REPRODUTIBILIDADE-ETAPA3-2026-10-05.md`): os
dumps das duas rodadas têm 502 328 linhas, `diff` a partir da 3ª linha devolve **0 linhas** e o sha
do corpo é `e1cc688a…` nas duas; o sha do corpus confere com `b2f4b455…`. Não há divergência de
conteúdo, mas o par (dump integral, sha) não é oráculo de igualdade entre rodadas. O sidecar
continua com os seus **quatro** digestos, porque o conjunto é pino de E4-3
(`tests/varredura_mascaras_v2.rs::os_digestos_publicados_batem_e_apontam_os_regeneraveis`); o que
passou a ficar escrito no próprio sidecar é a explicação da linha do dump e o sha do corpo medido.

Mesma rodada de verificação: `bash tools/varredura-mascaras.sh --check` com as máscaras e o portão
atuais imprime `slots=65536 acordo=36878 acordo-recusa=14292 recusa-declarada=14366
divergencia-critica=0 alvo-confrontado=4212 short=14292` e `OK: evidencia de mascaras reproduzivel
(digestos iguais)`, e duas corridas de `gerar` deram os mesmos digestos de JSON e MD — a evidência
de §4 é a dos máscaras vigentes, não um retrato de rodada antiga.

## R-3.8 — a alegação `short=0/448` do espaço R15 estava errada nos dois números

O texto de R15 (`tests/mascaras_v2_negativos.rs`) e o comentário de `decode_geral` (`src/decode.rs`)
alegavam que a máscara antiga recusava "448 words, `short=0/448`, todas lidas em 2B". A medição
direta sobre o dump do corpus (502 055 registros; espaço = `hi ∈ {1000, 1001, 1011, 1100, 1101}`
com `b8=0`, fonte em modo `%001`, `ss != %11`) dá:

| grandeza | valor medido |
|---|---|
| words no espaço | **960** |
| lidas pelo instrumento (todas em 2 bytes) | **448** = `addw`, `addl`, `subw`, `subl`, `cmpb`, `cmpw`, `cmpl` × **64** cada |
| impressas como `.short` | **512** = todo `or`/`and` com fonte `%aN` (192 + 192) mais `add.b` e `sub.b` (64 + 64) |

Ou seja: 448 é o que o instrumento **lê**, não o tamanho do espaço, e `.short` não é zero — é a
diferença 960 − 448. O que a máscara antiga fazia era recusar as **960**.

Dentro do que passa a ser aceite, 64 words continuam recusas por outro motivo, e isso é
divergência registrada, não acordo: o censo de §4 tem o grupo
`add/sub/cmp.b com fonte %aN direta` com `quantidade = 64`, `short-do-instrumento = 0`,
`tokens: cmpb × 64`, `comprimentos: 2B × 64` e classe `CPU-ALVO` (a sonda v9 l.20-23 recusa
`cmp.b %a0,%d1` na máquina-alvo). Foi acrescentado o pino explícito
`deve_recusar(0xB008, …)` em R15 para que a divergência fique visível no teste, e não só na tabela.

## R-3.9 — `fx13_mascaras`: a classe de fronteira é coluna da tabela, e o pino de bytes é por classe
(medido 2026-10-06)

§5 congela "tabela de palavras `fx13_mascaras` (subconjunto de slots da varredura §4 com o veredito
do instrumento versionado)". A primeira versão da coluna `esperado` tinha duas formas
(`leitura=N` / `recusa`) e o teste exigia de **toda** recusa `classe = opcode-fora-do-subconjunto`
e `consumo = none`. A medição das 11 words recusadas da tabela (sonda temporária sobre
`decode_at`, janela de slot = word + 14 × `4E71`, série em stdout) devolve:

| classe medida | quantidade | words |
|---|---|---|
| `opcode-fora-do-subconjunto` | 10 | `C248 8248 B008 D208 9008 51FF 7100 484F 413C 0088` |
| `indirect-opaque` | 1 | `4E90` |

`4E90` é o caso que quebra a expectativa, e a expectativa é que estava errada: o opcode `JSR`
está na lista fechada, o que falta é o alvo. A referência congelada diz isso três vezes —
`CONTRACT.md` §0 item 2 (l.45-47: "`JMP (An)`, `JSR (d16,An)`, `JMP (abs).W` etc. produzem
fronteira `indirect-opaque`"), `CONTRACT.md` §3 (l.191) e a errata de
`ADENDO-ETAPA2-2026-10-04.md` (onde §1 M8/M9 diz `opcode-fora-do-subconjunto`, leia
`indirect-opaque`). O pino já existente `tests/negativos_n1_a_n8_v2.rs::n6_indiretos_de_2_bytes_…`
exige para `4E90` `FrontierKind::IndirectOpaque` **e** `consumo = Some(2)`.

Duas consequências, ambas agora na tabela e não só no texto:

1. o vocabulário de `esperado` passa a `leitura=N` | `recusa-<classe>`, com `<classe>` o rótulo
   exato de `FrontierKind::label()`, e o teste de cobertura exige ≥ 2 classes distintas — sem
   isso a coluna não discrimina nada;
2. a reclamação de bytes é **por classe**: `indirect-opaque` reclama os bytes cujo comprimento é
   comprovado (a extensão de modo é conhecida; o alvo não), e as demais classes reclamam zero. O
   invariante antigo ("recusa não reclama byte nenhum") era uma generalização minha, contradizia
   N6 e foi substituído, não afrouxado: para `4E90` a asserção ficou mais forte
   (`consumo = Some(bytes-do-instrumento)`, i.e. `Some(2)` — nenhum comprimento inventado).

Nenhuma máscara de `src/decode.rs` foi tocada por este item; o censo de §4 continua
`acordo 36 878 / acordo-recusa 14 292 / recusa-declarada 14 366 / divergencia-critica 0`, com
`--check` verde.

**Gate.** `tools/make-fixtures.sh` passa a (a) incluir `fixtures/*.tsv` no `MANIFEST.sha256` e
(b) chamar `tools/gerar-fx13-mascaras.sh --check` no modo `--check`. O pino novo
`tests/auditoria_evidencia.rs::e5_cada_artefato_de_fixture_esta_registrado_no_manifesto` foi
escrito antes do reparo e falhou com a razão exata
(`ausentes do MANIFEST.sha256: ["fixtures/fx13_mascaras.tsv"]`); ele também veda o inverso
(Manifesto nomear arquivo inexistente). Medido depois do reparo: `make-fixtures.sh --check` devolve
`OK: 14 corpus reproduziveis…` + `OK: fx13_mascaras.tsv reproduzivel a partir do instrumento
pinado`, e o diff do manifesto é 4 inserções e zero remoções (fx12 × 3 + fx13 × 1) — os pins
antigos não mudaram de lado.

