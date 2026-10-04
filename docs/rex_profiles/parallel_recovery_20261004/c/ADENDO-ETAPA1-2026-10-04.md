# ADENDO datado à ETAPA 1 (frente C) — 2026-10-04

**Por que este arquivo existe.** `EXPECTATIONS-ETAPA1.md` e o `Anexo A` dele foram
congelados **antes** de existir código ou execução (protocolo da memória de projeto
`feedback-rex-freeze-expectations-precommit`). As linhas congeladas não são reescritas:
toda divergência entre o texto congelado e o medido entra aqui, com a série bruta
preservada. Este adendo é cumulativo e dataado; nada nele muda um número já medido.

**Regra de desempate usada.** Onde o texto congelado e o instrumento discordam, o
instrumento (`m68k-elf-objdump`, binutils 2.41 do host, pinado em
`~/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin`)
manda sobre comprimento e alvo; sobre **qual forma a ferramenta deve aceitar**, manda o
`CONTRACT.md` §3/§6 (lista fechada 68000), e a recusa é registrada, não escondida.

---

## A. Defeito real de decodificação achado pela paridade de OPERANDOS (corrigido)

### A.1 Como apareceu

Os testes de paridade congelados comparavam **comprimento, família e alvo**. Em
2026-10-04 adicionou-se uma comparação a mais (nível de operandos dos modos indexados),
porque a missão é "reduzir falsos consumidores" e um operando lido com campos trocados
pode virar um falso consumidor adiante. O teste novo falhou (RED) em **quatro** registros
dos corpus autorais — todos os quatro no corpus `calib2`, lidos no dump versionado
`fixtures/calib2-objdump.txt` (o corpus `calib` não contém modo indexado: os registros
`0x6` e `0x10` dele são `d16(An)`):

```
calib2 0x8   instrumento (8,'d',1,'l')   /  ferramenta (24,'d',0,'w')   [movel %d2,%a3@(...)]
calib2 0xc   instrumento (12,'a',0,'l')  /  ferramenta (136,'a',4,'w')  [movew %a4@(...),%d5]
calib2 0xfe  instrumento (0,'d',2,'w')   /  ferramenta (32,'d',0,'w')   [moveb %a1@(...),%d0]
calib2 0x102 instrumento (127,'a',3,'l') /  ferramenta (184,'a',7,'l')  [movew %a1@(...),%d0]
```

O caso na ROM **não** veio desse teste: veio da inspeção do `mnem` impresso pela
ferramenta contra o dump bruto do instrumento na região R1 (o comparador congela
comprimento/família/alvo, não texto), e mostrou a mesma troca de campos:

```
0x191c  instrumento: moveb %a1@(0,%d2:w),%d0
0x191c  ferramenta (antes):  moveb %a1@(0x20,%d0:w), %d0
```

Para que o defeito da ROM não dependesse de inspeção humana de novo, o bloco `lblidx`
foi acrescentado ao corpus autoral `calib2.s` (forma exata `1031 2000`) e pinado por
teste.

### A.2 Medição independente (não é dedução de manual)

Sonda no instrumento (assembly redondo de `moveb %a1@(0,%d2:w),%d0` → `1031 2000`)
e corpus autoral novo (`fixtures/calib2.s`, bloco `lblidx`), com cada registro lido
no dump versionado `fixtures/calib2-objdump.txt`:

| word de extensão | instrumento imprime | bytes | campos lidos pelo instrumento |
|---|---|---|---|
| `1031 2000` | `moveb %a1@(0,%d2:w),%d0` | 4 | disp8=`0`, índice **D2**, W |
| `3031 b87f` | `movew %a1@(7f,%a3:l),%d0` | 4 | disp8=`7f`, índice **A3**, L |
| `d0bb 1008` | `addl %pc@(110,%d1:w),%d0` | 4 | disp8=`08`, índice **D1**, W |
| `1031 0108` | `moveb %a1@(0,%d0:w),%d0` | 4 | bits 10-8 = `%001` (68010/68020) |
| `1031 0208` | `moveb %a1@(8,%d0:w:2),%d0` | 4 | bits 10-8 = escala (68020) |
| `d0bb 0208` | `addl %pc@(11e,%d0:w:2),%d0` | 4 | bits 10-8 = escala (68020) |
| `d0b9 0208 4e71` | `addl 2084e71,%d0` | 6 | **não** é indexado: `%111.001` = abs.L |

Layout confirmado pelas medições, para a word de extensão dos modos `%110`
`d8(An,Xn)` e `%111.011` `d8(PC,Xn)`:

```
bit15      tipo do índice        (%0 = Dn, %1 = An)
bits14-12  registrador índice
bit11      tamanho do índice     (%0 = W, %1 = L)
bits10-8   escala / deslocamento de 16 bits  — só 68010/68020
bits7-0    displacamento de 8 bits
```

O decodificador estava usando `disp8 = word>>8`, `long = bit6`, `índice = bits0-2`
— três campos errados, sempre. O comprimento (4 bytes) nunca esteve errado; o que
estava errado era **o que a instrução acessa**, que é exatamente a informação de que
a varredura linear precisa para não chamar dado de consumidor.

### A.3 O que foi corrigido e o que foi recusado

1. `src/decode.rs`: `Indice`/`indice()` com o layout medido, usado pelos modos `%110`
   e `%111.011` (era dois sítios duplicados; agora um).
2. `src/decode.rs` (`read_ea`): quando `bits10-8 ≠ 0` nesses modos, a ferramenta
   **para** com `frontier(kind="opcode-fora-do-subconjunto")`. Motivo: nesses casos o
   comprimento que o instrumento imprime depende de um campo que o 68000 não tem;
   reproduzi-lo seria **inventar comprimento**, proibido pelo CONTRACT §3/§6. Medido:
   os registros `0x10c`, `0x110`, `0x114` de `calib2` são fronteiras esperadas.
3. O registro `0x118` (`d0b9 0208 4e71`) **não** é fronteira: é `abs.L` de 6 bytes e a
   ferramenta reproduz o instrumento, inclusive o word seguinte engolido no imediato.

### A.4 Testes adicionados depois do congelamento (e por que isto não é reescrever expectativa)

`tests/calib_parity.rs`:
- `paridade_de_operandos_com_indice_contra_o_instrumento` — falhou primeiro (RED) com
  as quatro divergências de campos listadas em §A.1; passa com o layout medido. Não altera
  nenhuma expectativa congelada: adiciona um nível de comparação.
- `campos_de_indice_68020_param_sem_reclamar_comprimento` — falhou primeiro; passa com
  a recusa. Fixtures novos **antes** do teste (medição no instrumento), depois o teste,
  depois o código.

### A.5 Efeito na evidência (hashes antes → depois)

| artefato | antes (run 2026-10-04 manhã) | depois (fix) |
|---|---|---|
| `r1.json` (bruto, fora do índice) | `3c6f9084774ac34ec248ea2a1ecba2beb1585cea2aad478d093cac63501df0a7` | `318364322561bff357648cd1d041c39f3ddefa70c4174af66cea4c89ca513465` |
| `r1.redigido.json` (versionado) | `804b232d4efda4387343570a5a8e74122aef3e10ecc49aeefab823e3fd89458d` | `d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4` |
| `r2.json` / `r2.redigido.json` | `1c197a8a…` / `524dd707…` | **inalterados** |
| `r3.json` / `r3.redigido.json` | `d33a236e…` / `c47f0f10…` | **inalterados** |
| log da execução | `~/rds-scratch/xe-c-evidencia/execucao.log` `cdca3d3c3167cb7b6c5701e8ed8d6e42d2aab1f73d6e6fe5fdce51996b347e99` | `execucao-2.log` `sha256` registrado no MANIFEST |

Nenhum número de cobertura, instrução, aresta, alvo, fronteira ou veredito de sítio
mudou. Prova verificável agora: os hashes de `r2.json` e `r3.json` são **idênticos**
nos dois runs (conteúdo inalterado), e em `r1.json` o único operando que passa pelo
código corrigido é `0x191c` — a varredura das 66 instruções do run atual mostra uma
única instrução com modo `%110` (as cinco `@(0x0001)` de `0x189e`/`0x18b0`/`0x18cc`/
`0x18e0`/`0x18f2` e as duas de R2 são modo `%101` `d16(An)`, caminho não tocado). O
`r1.redigido.json` mudou de hash apenas porque `saida_completa.sha256` ecoa o hash do
bruto; suas 66 entradas de `instrucoes` (`endereco`/`tam`/`classe`), `arestas`,
`fronteiras`, `sitios`, `raizes` e `cobertura` imprimem os mesmos valores do run
anterior, que estão nas linhas `OK` do log anterior. O bruto antigo foi sobrescrito no
mesmo caminho do scratch (não há segunda cópia): a comparação acima é por hash
inesperado-inalterado + campo a campo do run atual, não por diff de dois arquivos.

## B. Divergências do Anexo A (tabela ouro manual) contra o instrumento

A tabela congelada acerta **endereços, comprimentos e a soma** (66 instruções,
14×4 + 52×2 = 160 = tamanho da região; fechado sem folga). Ela erra rótulos e dois
alvos. O desempate prometido pelo próprio Anexo A é o objdump bruto; a série dele está
versionada por hash (`r1-objdump-bruto.txt` `82d1fbb6be2a8c6d429aa7233753ce6f132ade68c2b5bfff8c86a1ba5a219fb1`,
fora do índice por conter mnemônicos da ROM) e o veredito da ferramenta bate com ele em
**66/66** registros. Linhas em que a tabela diverge do instrumento (e a ferramenta
segue o instrumento):

| End | tabela congelada | instrumento (medido) | natureza |
|---|---|---|---|
| `189C` | `SUBQ.B #2,(A7)` | `subql #2,%sp` | tamanho: é `.L`, não `.B` |
| `18BA`, `18D6` | `NEG.W D6` (`44C6`) | `movew %d6,%ccr` | família: MOVE→CCR, não NEG |
| `18BE` | `MOVE.B (A0)+,D1` (`12D8`) | `moveb %a0@+,%a1@+` | operandos |
| `18EA`, `18FC` | `ASL/LSL reg-cnt (D3,D3)` (`E353`) | `roxlw #1,%d3` | família: ROLT.W com contagem imediata |
| `1902` | `MOVE.B (A0)+,D1` (`1418`) | `moveb %a0@+,%d2` | registrador destino |
| `190E` | `ASL/LSL #5 (D2)` (`EB4A`) | `lslw #5,%d2` | só tamanho faltou na tabela (LSL.W) |
| `191C` | `MOVE.B (d8,A1,XD0),D0` | `moveb %a1@(0,%d2:w),%d0` | índice é **D2** e disp8=0 — ver §A |
| `1920` | bytes `1218`, `MOVE.B (A0)+,D1` | bytes `12c0` (`dd` em `0x1920`), `moveb %d0,%a1@+` | byte errado na tabela |
| `1926` | `BRA S −128 → 18AA` | `bras 0x18a8` | alvo: base+2 (ver §C) |
| `1930` | `BEQ W −138 → 18AA` | `beqw 0x18a8` | alvo |

Nada disso muda o propósito da tabela (fechar a região sem folga); muda a leitura de
**semântica** linha a linha, por isso a ferramenta imprime o mnemônico do instrumento
quando o subconjunto permite, e a tabela congelada fica como registro do que foi
prometido antes de medir.

## C. Parentênteses invertido em R1.3 (expectativa congelada × aritmética)

O texto congelado (§2 R1.3, linha 62-64) diz: *"`beq.w` em `0x1930` (`6700 FF76`) tem
alvo `0x18AA` (errada daria `0x18A8`)"*. Medido com o instrumento e com a ferramenta:

```
0x1930  6700 ff76  beqw 0x18a8      base = instr+2  : 0x1932 - 0x8A = 0x18A8   (certo)
                                    base = instr+len: 0x1936 - 0x8A = 0x18AC   (errada)
```

Para `0x18AC` (`51CC 000C`): base instr+2 = `0x18BA` (certo, batendo com o
congelado); a "fórmula errada" citada no congelado (`0x18B8`) corresponde a
base = instr+0; base = fim da instrução daria `0x18BC`. **O discriminante pedido
está de pé** (a ferramenta produz o alvo do instrumento e nem `0x18B8`, nem `0x18AA`,
nem `0x18AC`/`0x18BC` aparecem no grafo); o que está invertido no congelado é qual
dos dois números era o certo em `0x1930`. O verificador (`executar-evidencia-C.sh`)
pinou `certo=0x18A8`, `errada=0x18AA` e reclama se aparecer `0x18AA`; a linha de
diagnóstico imprime os três valores para leitura humana.

## D. Rótulos e endereços de R2 que o instrumento desloca

- Congelado: "`bne.w` em `0x214` (`667C`)". Medido: `0x214` = `66 7c` = **`bnes`**
  (2 bytes, disp8 positivo `0x7C`), alvo `0x292` (base `0x216` + 124). A palavra
  "w" no congelado vem de ler `667C` como opcode de 16 bits; o comprimento real
  é o que o instrumento imprime, e é o que a ferramenta reclama (2B).
- Consequência: congelado prometia `lea` em `0x218` e `movem` em `0x21C`; medido
  (instrumento e ferramenta): `lea %pc@(0x294),%a5` em **`0x216`** e
  `movemw %a5@+,%d5-%d7` em **`0x21A`** (e um segundo `moveml` em `0x21E`).
  Os alvos prometidos (`0x20C→0x214`, `0x214→0x292`, "primeira fronteira antes de
  `0x256`") estão corretos.
- Primeira fronteira medida: `0x23A` = `4e66`, tipo `opcode-fora-do-subconjunto`.
  O instrumento, sendo genérico, imprime `movel %fp,%usp` (MOVEC, 68010+); o
  CONTRACT §6 lista `MOVEC/MOVES` como fora do contrato 68000, então **recusar é o
  comportamento correto** e a divergência com o instrumento fica registrada aqui
  (não é falha de paridade: o teste de paridade não compara além do limite declarado,
  e os 39 registros do instrumento além da fronteira são listados nominalmente no
  relatório).
- Cobertura R2: 54/154 (0.3506), 2 vaos — o limite honesto prometido em R2.4.

## E. R3: rótulo do congelado × instrumento

- Congelado (§2 R3.1): "`move.abs.L→D1` (6B) em `0x136A`". Medido: `43f9 00a00000` =
  `lea 0xa00000,%a1` (6B). O texto **prévio** da própria expectativa já trazia os
  bytes certos (`43F9 00A00000`), então o erro é só o rótulo em prosa; endereço,
  comprimento e o restante da cadeia batem: `lea` 6B em `0x1364`, `bsr.w` em `0x1370`
  com alvo `0x189C` (a fórmula histórica daria `0x189E` — ausente do grafo),
  continuação 8B em `0x1374`, `nop`s em `0x137C`/`0x137E`, fronteira
  `limite-de-regiao` em `0x1380`. Os 9 vereditos de sítio pedidos são exatamente os
  medidos.

## F. Recusas mantidas por limite do contrato (não alarguei a lista fechada)

Em todos os casos abaixo o instrumento **lê** a forma e a ferramenta **para**. Isso é
desvio deliberado contra o instrumento, exigido pelo CONTRACT §3 (lista fechada) e §6,
e por isso cada um está pinado em teste com o endereço exato:

| Sítio | Forma (instrumento) | O que a ferramenta faz | Base |
|---|---|---|---|
| `calib` `0x148` | `movepw` | fronteira `opcode-fora-do-subconjunto` | §3/§6 (MOVEP) |
| `calib` `0x14c` | `67ff` (`beqs -1` ou `beql`, o mesmo instrumento diverge entre corpus) | fronteira (disp8=`0xFF` recusado) | §0.3/§3 |
| `calib` `0x152`, `0x154` | `.short 0xf000`, `illegal` | fronteira | §3 |
| `calib2` `0x36` | `extw` | fronteira | §3 (68010+) |
| `calib2` `0xf4`, `0xf6` | `bkpt 7`, `movepl` | fronteira | §3/§6 |
| `calib2` `0x106` | `addl %pc@(110,%d1:w),%d0` (MOVE/ALU com fonte **PC-relativa**) | fronteira | §3 não autoriza modo PC para esses grupos (só `lea`/`pea`) |
| `calib2` `0x10c`, `0x110`, `0x114` | campos de índice 68010/68020 (bits 10-8 ≠ 0) | fronteira | ver §A |
| ROM `0x23a` | `movel %fp,%usp` (MOVEC) | fronteira | §6 |
| ROM `0x292`/`0x1370` | desvio/chamada além da região | aresta `fora-da-regiao`, análise para | §6 |

A linha `0x106` virou decisão explícita ao regenerar o corpus: **não** alarguei o
subconjunto para aceitar `%pc` em ALU/MOVE só porque o instrumento aceita — alargar a
lista fechada é mudança de contrato, e contrato é do operador. Registrado aqui para
vira decisão na revisão.

## G. Defeitos do comparador que falsificavam divergência (consertados, com a série preservada)

O verificador `executar-evidencia-C.sh` não é neutro: quatro leituras suas produziram
"divergência" que não existia. Todos corrigidos no script, e todos na direção de
**não** dar razão à ferramenta automaticamente:

1. Linhas de continuação do `objdump` (instruções > 3 words) não eram mescladas ao
   registro → "comprimento 8 vs instrumento 6" falsos em `0x22c` (R2) e `0x1374` (R3).
2. Operandos absolutos de instrução de **dado** eram lidos como alvo de fluxo
   (`tstl 0xa10008` virava "aresta para `0xa10008` ausente") → alvo só é comparado
   nas famílias de fluxo.
3. Paridade bidirecional era exigida além do limite declarado → os 39 registros do
   instrumento após `0x23a` viravam "instrução sem registro". Agora: contagem separada
   (`comparados=15, alem-do-limite-declarado=39`) com os endereços listados.
4. O filtro de DBcc procurava `classe == "dbcc"`; a ferramenta emite `dbf`. Agora
   aceita ambos, e a expectativa "cinco DBcc em posições congeladas" é verificada de
   fato (`['0x18ac','0x18c8','0x18dc','0x18ee','0x1922']`).

Além disso: o parser do instrumento (`tests/support/oracle.rs`) panic se uma linha de
continuação não for contígua ao registro anterior — foi isso que fez aparecer o
"Address 0x116 is out of bounds" do `objdump` ao pôr `d0b9 0208` no fim de arquivo, e a
saída foi **entender** (o word engolido precisa existir) em vez de afrouxar o parser.

## H. Localização da evidência: desvio do meta-ritério congelado, precisando de decisão

`EXPECTATIONS-ETAPA1.md` §3 pede "cada número citado nos relatórios deriva de saída da
CLI **commitada** como evidência (`data/.../c/evidence/`), com SHA-256 do JSON e comando
exato". `CONTRACT.md` §5 proíbe ROM em teste de CI e manda a identidade por SHA-256 em
`data/.../c/evidence/`. Os dois se chocam num ponto: a saída completa da CLI sobre a ROM
contém **mnemônicos e operandos derivados de conteúdo de ROM comercial**, que a regra de
não-distribuição não deixa versionar.

O que foi feito (e fica fácil reverter se o operador decidir outro arranjo):

- Versionado: `r1/r2/r3.redigido.json` + `MANIFEST.md` com SHA-256 e o comando exato de
  cada análise. A redigida preserva **todos os números** citados nos relatórios
  (endereço, `tam`, `classe` das 66/15/6 instruções, `arestas` com alvos, `fronteiras`
  com tipo e motivo, `sitios` com veredito, `cobertura`, `raizes` com grau e
  proveniência, `objeto` com SHA) e declara em `saida_completa` o caminho local, o SHA
  do JSON bruto e o motivo de não versioná-lo.
- Fora do índice (scratch `~/rds-scratch/xe-c-evidencia/`): `r1/r2/r3.json` brutos e
  `r1/r2/r3-objdump-bruto.txt`, todos com SHA no `MANIFEST.md`.

Conferido: nenhum número citado em `INFORME-C.md`/`AUDITORIA-C.md` existe fora dos
`.redigido.json` versionados, exceto as citações literais de linhas do objdump bruto
deste adendo, que ficam com hash declarado.

## I. Outros desvios menores, registrados sem reescrever nada

- `fx04_calls` `0x10`: o escorregamento aritmético que a expectativa usava como
  discriminante não discrimina nada nesse endereço (as duas fórmulas coincidem); o
  discriminante real de "base = instr+2" está em `fx01`, `fx08` e nas ROMs R1/R2/R3.
  O teste de `fx04` não foi afrouxado — ele verifica alvo do instrumento, e só.
- `--origin` desloca **endereços da análise**, não operandos absolutos: `jsr/jmp abs`
  e `abs.L` de dados são literais do arquivo. Congelado no teste
  `alvo_absoluto_abaixo_do_inicio_da_regiao_e_fora_da_regiao` para que a semântica não
  escape por conveniência.
- Mesclagem de registro no fim de `calib`: o instrumento lê o triplo
  `67ff 51ff 4e76` como **uma** instrução de 6 bytes (`beql`), então `0x14e`/`0x150`
  não são registros próprios. A pinha anterior (`0x14c/0x14e/0x150` como três de 2B)
  veio de uma leitura diferente do mesmo instrumento sobre corpus antigo; a série bruta
  atual está no dump versionado e o teste imprime a contagem real.
- TEXTOS de operando que não são comparados por paridade (comprimento/família/alvo são):
  `0x222` R2 (`%a1@(-4351)` vs `%(0xef01)`, sinal na exibição do disp16) e `0x238` R2
  (`moveal %d0,%fp` vs `moveal %d0,%a6`, nome de registrador do instrumento para MOVEA).
  Declarado como limite de escopo, não como concordância.

## J. Estado verificado na data deste adendo

- Suite: **38 testes, 38 verdes** (`cargo test --offline`: `calib_parity` 5,
  `cli` 9, `export` 6, `fx_fluxo` 15, `unidades` 3; `src/lib` e `src/main` não têm
  testes unitários próprios).
- `cargo clippy --offline --all-targets -- -D warnings`: limpo.
- `cargo fmt --all -- --check`: limpo.
- `bash tools/make-fixtures.sh --check`: "OK: corpus reproduzíveis" (10 corpus
  regenerados do `.s` autoral com o instrumento pinado).
- `bash executar-evidencia-C.sh`: `rc=0`, `divergencias criticas = 0`,
  paridade R1 `comparados=66 divergencias=0 alem-do-limite=0`, R2
  `comparados=15 divergencias=0 alem-do-limite=39`, R3 `comparados=6 divergencias=0`.
- `npm run check:tree` (raiz do worktree): OK.
- Gates do AGENTS.md que **não** foram executados nesta frente e por quê: `npm run lint`,
  `npx tsc --noEmit`, `npm test`, `cargo clippy/test --lib` de `src-tauri` e
  `host:certify` — nada em `src/`, `src-tauri/` ou frontend foi tocado (território
  exclusivo em `scripts/`, `docs/`, `data/`), e a barra de compilação do app é um job
  pesado que a regra de serialização não permite disparar junto do ciclo Rust desta
  frente. Ficam registrados como **não aprovados**, com motivo, e não como "verde".
