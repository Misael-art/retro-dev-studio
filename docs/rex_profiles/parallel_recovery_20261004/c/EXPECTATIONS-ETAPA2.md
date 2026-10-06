# EXPECTATIONS — ETAPA 2 (frente C) — congeladas ANTES de implementar ou executar

**Data de congelamento:** 2026-10-04. **Base histórica:** `cb56657`. **HEAD no congelamento:** `275f2af`.
**Contrato:** `CONTRACT.md` (mesma pasta). **Retificação da ETAPA 1:** `ADENDO-ETAPA1-2026-10-04.md`.

Protocolo (memória do projeto `feedback-rex-freeze-expectations-precommit`): este arquivo é
commitado **sozinho**, antes de existir qualquer código novo ou qualquer execução da ferramenta
sobre os materiais desta etapa. Desvio entre esperado e medido = **FAIL/INCONCLUSIVO** com a
série bruta nos relatórios; a expectativa **não** é reescrita depois da medição — correção
posterior exige seção "Adendo datado" com motivo e evidência, preservando o texto original.
**Nenhum limiar é ajustado para acomodar um resultado.**

**Aceite da etapa (texto do briefing):** *revisão independente de A publicada e verificador de
sítios utilizável, com negativos que realmente discriminem instrução, dado e interior.*

Toda a calibração abaixo foi feita **exclusivamente com o instrumento pinado**
(binutils 2.41: `…/17f7bcf5…/source/install/bin/m68k-elf-{as,ld,objdump,objcopy}`), nunca com a
ferramenta `rex-cfg`. A série bruta está no Apêndice A; ela é a única fonte dos bytes citados.

---

## 0. A ISA fechada NÃO é ampliada (obrigação 1)

1. A lista de `CONTRACT.md` §3 permanece **bit a bit a mesma** nesta etapa. Nenhum opcode novo
   entra no subconjunto aceito, nenhuma família de recusa passa a aceita.
2. Toda cobertura maior obtida nesta etapa deve vir de **região / raízes / consulta de sítio**,
   nunca do decoder. Se uma isca parecer "fácil de aceitar", ela é **fronteira** (§2 M8/M9/M10/M11).
3. Consequência congelada: as recusas listadas em `ADENDO-ETAPA1-2026-10-04.md` §F (12 famílias,
   incluindo `%pc` em ALU/MOVE e extensões 68010/68020) continuam recusadas. Uma prova desta
   etapa que aceite qualquer uma delas é **FAIL da ferramenta**, não ganho de cobertura.
4. Cobertura desconhecida continua sendo limite declarado. A frase "poderíamos aceitar mais
   formas para fechar o vão" não é argumento de aceite; não há meta de fração nesta etapa.

## 1. Matriz autoral de chamadas, saltos, endereços curtos e relativos — `fx09_matriz_isa`

Fixture **autoral** (identificado como autoral no relatório, não é recorte de ROM), montado pelo
pipeline do instrumento (`as -m68000` → `ld -Ttext 0 -e fx09` → `objdump -d` → `objcopy -O binary`),
com rótulos resolvidos pelo linker para as formas relativas e `.short` **somente** onde o
montador não produz a forma (iscas e formas 68020 — isso é declarado linha a linha).

Bytes "medido" = Saída literal do instrumento no Apêndice A. Ferramenta = `rex-cfg`.

| # | forma | bytes medidos | tam | regra de alvo (68000) | expectativa congelada |
|---|---|---|---|---|---|
| M1 | `bsr.s` para o próprio rótulo | `61 fe` | 2 | `instr+2+(int8)` | aresta `desvio` no alvo exato do instrumento (`0x12` no probe); comprimento **2**, não 4 |
| M2 | `bsr.w` + | `61 00 5b 2c` | 4 | `instr+2+(int16)` | aresta `desvio` resolvida; comprimento 4 |
| M2b | `bsr.w` − | `61 00 fffc` | 4 | `instr+2−4` | alvo do instrumento `0x12` (laço); discriminante vs. base-no-fim |
| M3 | `61 ff …` (BSR.L 68020) | `61 ff 00 00 12 34` | — | instrumento: `bsrl 1236` = base **instr+2** | **fronteira** `opcode-fora-do-subconjunto`; sem aresta; **sem** entrada em `chamadas`. Registro obrigatório: a base do instrumento (instr+2) **contradiz** a linha `bsr.l` da tabela de A (instr+4) |
| M4 | `jsr (xxx).W` | `4e b8 80 00` | 4 | word como endereço | instrução provada, aresta `chamada`;_operando bruto_ `0x8000`; alvo sob P-absW (§1.1) |
| M5 | `jsr (xxx).L` | `4e b9 00 01 c0 24` | 6 | longword | aresta `chamada` com alvo `0x1C024` (mesmo valor do instrumento) |
| M6 | `jmp (xxx).W` | `4e f8 80 00` | 4 | word | aresta `desvio` sem queda; P-absW |
| M7 | `jmp (xxx).L` | `4e f9 00 80 00 00` | 6 | longword | alvo `0x800000` idêntico ao instrumento |
| M8 | `4e fa 12 34` = `jmp %pc@(…)` | `4e fa 12 34` | — | d16(PC), 68000 válido **fora** da lista fechada | **fronteira** `opcode-fora-do-subconjunto`; **proibido** gerar `chamadas`; **proibido** o par `(JSR, abs.W)` que A alega para `4E FA` |
| M9 | `4e fc` / `4e fd` | `.short 0x4efc` / `.short 0x4efd` | — | extensões `%100/%101` do modo 7 = 68020 | **fronteira**; o próprio instrumento **não** decodifica como JMP/JSR. As linhas `jmp abs.w = 4EFC` e `jmp abs.l = 4EFD` de A estão refutadas por medida |
| M10 | `2a 7c 12 34 56 78` = `movea.l #imm32,An` | `2a 7c 12 34 56 78` | — | imediato como **fonte** | **fronteira** (`#imm` só em `MOVE`, §3); nenhum operando alegado; **não** é consumidor |
| M11 | `0a 7c fc 00` | `eoriw #-1024,%sr` | — | EORI imediato a CCR | **dois resultados aceitos, e só dois:** (a) fronteira `opcode-fora-do-subconjunto`, **ou** (b) `eori` com destino CCR se §3 cobrir o destino. Em **nenhum** caso `movea`/`MOVEA #imm`/consumidor. A linha `movea.l #imm32,An = 0A?? FC` de A está refutada: o `0A?? FC` mede EORI; o MOVEA imediato mede `2A7C` (M10) |
| M12 | `41 f8 80 00` = `lea (xxx).W,A0` | `41 f8 80 00` | 4 | comprimento comprovado | comprimento **4** comprovado; **nenhuma** alegação de efetividade do endereço; operando bruto `0x8000` exportado; alvo sob P-absW |
| M13 | `41 fa fffa` = `lea d16(PC),A0` | `41 fa ff fa` | 4 | `instr+2+(int16)` | alvo igual ao instrumento (`0x32` no probe); aqui a fórmula de A **converge** |
| M14 | `51 c3` (Scc) vs. `51 cb f8 00` (DBcc) | `51 c3` / `51 cb f8 00` | 2 / 4 | `51c3` = `sf %d3` | `51 c3` sozinho = Scc, comprimento 2; **não** engolir a word seguinte como disp; DBcc com disp8 `0xFF` continua recusado (ETAPA 1 §2) |

Rows M1/M2 e M3/M8/M9 são exatamente os três defeitos que o briefing pede para cobrir:
**opcodes trocados** (M8/M9), **extensão de sinal** (M4/M6/M12 — P-absW), **confusão BSR
curto/palavra/variante de CPU** (M1/M2/M3).

### 1.1 Regra P-absW (congelada antes de medir)

O instrumento **exibe** `(xxx).W` com bit15 ligado como endereço de 32 bits com sinal
(`4eb8 8000` → `jsr ffff8000`, `41f8 8000` → `lea ffff8000`). A semântica de extensão do
68000 (zero × sinal no barramento de 24 bits) **não foi resolvida por fonte primária** nesta
sessão (o PDF do M68000PRM não pôde ser lido de forma confiável; ver §7.4). Portanto:

- a ferramenta exporta **o operando bruto** (a word, ex. `0x8000`) e o **alvo interpretado** sob
  a hipótese declarada em `limites` (`extensao-abs-w-hipotese-zero-extendida`);
- paridade com o instrumento: **comprimento** sempre comparável; **alvo** comparável
  numericamente quando bit15 = 0; quando bit15 = 1 o registro é
  `interpretacao-pendente` — **não é FAIL nem PASS**;
- nenhuma classificação estrutural de sítio (§5) pode depender dessa interpretação;
- a mesma ressalva é publicada para A, que afirma zero-extensão como fato ("NUNCA con signo",
  `src/instr.rs:94`, `tests_instr.rs` FA-7): a asserção é **hipótese não provada por fonte
  primária**, não resultado.

## 2. Fixture-isca: aparência de LEA/JSR em dado e no interior — `fx10isca` (obrigação 6)

Fixture **autoral** com três armadilhas deliberadas, todas construídas com `.short` (o
montador não produz iscas — declarado no `.s`):

1. **Ilha de dados após `rts`**: sequência com `4ef9 00011234`, `4eb9 00011236`,
   `4efa 1234`, `0a7c fc00`, `41f9 0000abcd`, cada padrão ocupando um endereço par.
2. **Iscas no miolo de instrução real**: uma instrução de 6 bytes dentro de um bloco alcançado
   cujo **segundo word** é `4efc` (espelho do caso medido na ROM em `0x31DCC`, onde o
   instrumento lê `subb %a4@(20220),%d2`); e outra cujo **terceiro word** é `4eb9`.
3. **Iscas em vão não alcançado**: região alcançada por uma única raiz, com os padrões acima
   repetidos fora de qualquer fluxo.

Expectativas **duras** (toda violação = FAIL da barreira):

- B1: nenhum bloco alcançado cobre os bytes da ilha; `cobertura.vaoes` contém o span inteiro da
  ilha, sem truncamento por bounding box.
- B2: sítio em cada isca da ilha → veredito `dentro-regiao-nao-alcancado`; o array `chamadas`
  tem **zero** entradas com `sitio` nesse span.
- B3: sítio no miolo (`4efc` de `0x…` interno a instrução provada) → veredito
  `miolo-de-instrucao`; **zero** entradas em `chamadas` nesse sítio, **mesmo lendo os bytes a
  partir dali** (a isca decodifica "limpa" sob a tabela de A — é precisamente por isso que o
  caso entra).
- B4: para cada sítio de isca, `consultar` responde `consumidor-validado: "nao"` com o motivo
  estrutural correspondente (B2/B3) e `promovivel-vinculo-estrutural: "nao"`.
- B5: corrida separada com o endereço de uma isca declarado como `--root` de proveniência
  `declarada-operador`: o bloco pode nascer ali (raiz é explícita), **mas** o grau exportado
  permanece `declarada-operador`/`candidato`, `raizes[..].grau` não é promovido, `limites` traz
  `raiz-declarada-nao-promovida`, e a resposta de `consultar` para o sítio continua
  `promovivel-vinculo-estrutural: "nao"`. **A barreira não proíbe analisar uma raiz declarada;
  proíbe alegar alcançabilidade ou vínculo.**
- B6: `4efa`/`4efc` na ilha **não** geram arestas nem `chamadas`; o caminho para na fronteira.

## 3. Fixture assimétrico novo com denominadores próprios — `fx11assimetrica` (obrigação 7)

Dois fluxos de tamanho deliberadamente desigual, duas raízes declaradas:

- **raiz A** (curta): corpo com uma instrução de opcode fora do subconjunto no meio → o caminho
  para; sem chamadas; sem laço.
- **raiz B** (longa): `bsr.w` → subrotina com `rts`; `jsr.abs.L` cujo alvo está **fora** da
  região; um laço `dbra`; um `jmp (An)` (fronteira `indirect-opaque`); um `beq.w` cujo displano
  cruza a fronteira da região.

Regras congeladas:

- A1: **nenhum agregado entre raízes.** Toda métrica sai por raiz, com denominador próprio:
  `blocos`, `instrucoes`, `arestas` por tipo, `chamadas` por status, `fronteiras` por tipo,
  `bytes-decodificados / bytes-regiao` do domínio daquela raiz.
- A2: `|blocos(B)| > |blocos(A)|` e `fronteiras(A) ≥ 1 (opcode-fora-do-subconjunto)`;
  `fronteiras(B) ≥ 2` de tipos distintos (`indirect-opaque` + `fora-da-regiao`), e
  `chamadas(B)` contém exatamente uma entrada `fora-da-regiao` e uma `resolvido`.
- A3: **as contagens exatas por raiz** (tabela instrução a instrução) são derivadas **à mão da
  fonte `.s`** e commitadas junto do fixture (arquivo `fixtures/fx11-expectativas.md`), **antes
  de qualquer execução da ferramenta**. Divergência ferramenta ↔ tabela manual = FAIL;
  divergência tabela manual ↔ instrumento = a tabela é corrigida por **Adendo datado**, não por
  reexecução.
- A4: a assimetria é a prova: um resumo único das duas raízes (média, fração global) é
  **proibido** no export.

## 4. Amostras reservadas da ROM BYOR (obrigação 7, metade romana)

ROM **somente-leitura, não versionada**: `Sonic the Hedgehog (USA, Europe).bin`, SHA-256
`c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531 577 bytes.

**Regra de seleção (fixada antes da análise, e só ela):** os corpos abaixo são os alvos dos dois
`jsr (xxxx).L` que o instrumento comprova na janela de contexto `0x00D84..0x00DA0`
(SHA-256 dos 28 bytes: `298c991c8fa94383425a51f4c0cdd3ce48e4d989f7ca01468eaa88d2955f626c`,
que o instrumento lê como `bsrw 0x68b2` / `jsr 0x1c024` / `jsr 0x1c6b8` / `bsrw 0x165e`).
Nenhum corpo foi escolhido por ter sido lido: a janela foi escolhida porque contém chamadas
comprovadas, e os alvos vieram delas.

| amostra | região | tamanho | SHA-256 do corpo |
|---|---|---|---|
| S1 | `[0x1C024, 0x1C0A4)` | 128 | `f1b9b9cdfc6f6e714b449becf87de883b0162954ef6fd8bd7f4fcf0afdd94c63` |
| S2 | `[0x1C6B8, 0x1C738)` | 128 | `6f3308c397ed4c9ae07a3e6e2e86092b56a526d26b9d43062572c6e5a9def91c` |

Os **corpos** de S1/S2 não foram desassemblados antes do congelamento: só os pinos de
identidade (SHA por hash de bytes, sem `dd`) e o contexto de chamada. A primeira leitura dos
corpos é a medição desta etapa.

Sítios por amostra, fixados por regra (10 por amostra):

- 8 sítios alinhados: `inicio + 4·k`, `k = 0..7`;
- 1 sítio **ímpar**: `inicio + 5`;
- 1 sítio além do fim: `fim + 2`.

Expectativas (estruturais; **nenhuma fração de cobertura é prometida**):

- R1: todo sítio par dentro do corpo ∈ {`instrucao-de-bloco`, `miolo-de-instrucao`,
  `dentro-regiao-nao-alcancado`, `ponto-de-fronteira`}; **nunca** `fora-da-regiao`.
- R2: o sítio ímpar **nunca** é `instrucao-de-bloco` (instrução 68000 não começa em desvio
  ímpar); veredito esperado ∈ {`miolo-de-instrucao`, `dentro-regiao-nao-alcancado`,
  `ponto-de-fronteira`}. Este é o negativo discriminante pedido pelo briefing: um scanner
  linear que "decode limpo" em endereço ímpar produz consumidor fantasma.
- R3: o sítio além do fim é `fora-da-regiao`, com aresta/fronteira correspondente e **nenhum**
  byte fora da região decodificado.
- R4: raízes `0x1C024` (S1) e `0x1C6B8` (S2) com proveniência `referencia-estatica` (operando de
  `jsr.abs.L` comprovado pelo instrumento no contexto pinado); `grau` exportado **não promovido**;
  a cadeia de chamadas só pode ser `referencia-estatica`/`vinculo-estrutural` dentro do fluxo
  analisado, nunca "alcançável desde o boot".
- R5: toda entrada em `chamadas` tem sítio **par** e instrução provada; nenhuma entrada nasce de
  varredura.
- R6: divergência de comprimento ferramenta ↔ instrumento = FAIL; alvo com bit15 = P-absW.
- R7: o censo de iscas do Apêndice B **não** entra como medição; ele só dimensiona o negativo: a
  ferramenta é chamada nesses endereços e deve responder `consumidor-validado: "nao"`.

## 5. Verificador de sítios consumível por A — `rex-cfg consultar` (obrigação 5)

Assinatura congelada (aditiva; a de `analyze` em `CONTRACT.md` §2 não muda):

```
rex-cfg consultar --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM
                  --root 0xENDERECO ... --root-prov <vocabulario> ...
                  --site 0xENDERECO --out <json> [--max-insn N]
```

- **Um sítio por invocação → um objeto JSON plano.** Múltiplos sítios exigem múltiplas
  invocações: decisão deliberada, porque o parser de A aceita **somente** um objeto plano no
  nível superior (evidência lida em `~/rds-scratch/a-docs/a-src/json.rs`, linhas 80–238:
  `parse_objeto` exige chave/valor e rejeita objeto aninhado, lista de não-cadenas, chave
  duplicada, texto sobrante e escape `\u`; números são **só dígitos**, sem sinal nem ponto).
- Valores permitidos: `cadenas`, `null`, inteiro **decimal** sem sinal, lista de cadenas.
  Endereços saem como **cadenas hex** (`"0x031DCC"`) e contagens como inteiros decimais.
  Conteúdo ASCII-only, sem `\u`.
- Determinístico byte a byte para mesma entrada: ordem de chaves fixa, nenhum timestamp,
  nenhum caminho absoluto local.
- Códigos de saída: só os já congelados — `0` resposta escrita, `1` erro de análise, `2` erro de
  uso. **Nenhum código novo.**

Chaves do objeto `rex-cfg-sitio/v1` (ordem de emissão fixada):

```
schema, ferramenta, versao, base-sha, objeto-sha256, objeto-tamanho,
regiao-inicio, regiao-fim, raizes, proveniencias, sítio→ "sitio",
veredito, bloco, instrucao-tam, instrucao-classe, instrucao-mnem,
alvo, alvo-status, consumidor-validado, promovivel-vinculo-estrutural,
motivos, limites
```

Regras de decisão (a barreira propriamente dita):

- V1: `consumidor-validado = "sim"` **somente se**: (i) há instrução **provada** começando
  exatamente no sítio, (ii) o bloco que a contém está em fluxo alcançado a partir de raiz
  declarada, (iii) a classe é `chamada` ou `salto` com alvo comprovado, e (iv) o alvo declarado
  no sítio é igual ao operando medido (regra de equivalência que A usa em
  `carga_operando == fluxo_cpu`). Falhou qualquer item → `"nao"` com motivo em `motivos`.
- V2: `promovivel-vinculo-estrutural = "sim"` **somente se** (i)–(iv) de V1 **e** a raiz que
  alcança o sítio tem proveniência do vocabulário que autoriza vínculo
  (`referencia-estatica` ou `vetor-plataforma`); `declarada-operador` nunca promove.
- V3: sítio ímpar, sítio em vão de dado ou sítio no miolo de instrução ⇒
  `consumidor-validado = "nao"`, com motivo respectivo. Estes casos têm teste dedicado.
- V4: o verificador **não** emite nenhum campo que afirme execução, tempo de retorno ou
  conteúdo do alvo. Nada aqui é `observado-em-runtime`.
- V5 (teste de compatibilidade): um teste em `tests/` valida os bytes emitidos contra as
  restrições do parser de A citadas acima (objeto único, chaves planas sem duplicata, sem
  objeto aninhado, sem lista de não-cadenas, sem `\u`, inteiros só dígitos, ASCII-only). É
  verificação por restrição, não import do crate de A (que é read-only e fora do meu território).

## 6. Export de medições para D — `rex-cfg-med/v1` (obrigação 8)

Quatro dimensões **separadas**, cada uma com denominador próprio, sem soma entre elas:

| dimensão | unidade | denominador | origem |
|---|---|---|---|
| comprimento | instruções provadas | bytes da região | tabela do decoder + instrumento |
| operandos | operandos brutos exportados | instruções com extensão | word/longword literal, **sem** alegação de efetividade |
| fluxo | arestas por tipo/status | blocos alcançados | grafo da análise |
| alcance | `bytes-decodificados`, vaos, fronteiras por tipo | bytes da região | cobertura real (soma de comprimentos comprovados) |

- MD1: `paridade com objdump não equivale a observação em runtime` entra como `limites` fixo do
  arquivo, junto de `nenhuma dimensao promove outra` e `sem execucao, sem DAC, sem VRAM`.
- MD2: nenhuma linha do export pode conter um byte literal da ROM; endereços, comprimentos,
  SHA e contagens apenas (mesma política de §8).
- MD3: o arquivo declara `objeto-sha256`, `regiao`, `raizes`, `proveniencias` e o **comando
  exato** que o regenera, para reprodução.
- MD4: para cada par `(dimensão, amostra)` o export traz `status ∈ {medido, pendente,
  recusado}`; "pendente" é resultado legítimo, não ausência.

## 7. Revisão independente da ISA de A (obrigações 3 e 4)

Artefato: `REVISAO-C-DE-A.md`. Regras congeladas:

7.1 Linha da tabela = `bytes` + `endereço (ou fixture)` + `esperado` (a alegação de A, citada com
arquivo:linha em `cbb6895`) + `observado` (instrumento, série bruta do Apêndice A) +
`classificacao ∈ {DIVERGE, CONVERGE, INCONCLUSIVO}` + `consequência` para
`vinculo-estrutural`.

7.2 O conjunto mínimo de linhas a publicar (cada uma já medida nesta sessão, antes do
congelamento): `4E FA` (A: `jsr abs.w`), `4E FC` (A: `jmp abs.w`), `4E FD` (A: `jmp abs.l`),
`61 FF` base (A: `sitio+4`), ausência de `bsr.s` em A com 758 candidatos lineares na ROM,
`0A?? FC` (A: `movea.l #imm32,An`), `4E B9`/`4E B8`/`4E F8`/`4E F9` corretos, `41 F8`
zero-extensão como fato, `41 FA` (convergência). A linha `movea` de A está em
`EXPECTATIONS-A` §3 com a ressalva "a detectar se existe" — a detecção foi feita: existe, é
`2A7C`, e `0A?? FC` é EORI.

7.3 **Não edito** a worktree nem os testes de A (`/home/misael/RDS-REX-PARALLEL-A-2026-10-04`,
somente-leitura; os arquivos citados são cópias fetch em `~/rds-scratch/a-docs/`, identificadas
pelo HEAD `cbb6895`). Divergência publicada, não corrigida por mim.

7.4 `INCONCLUSIVO` é um resultado publicável: a extensão do `(xxx).W` (zero × sinal no
barramento de 24 bits) não foi resolvida por fonte primária nesta sessão; publico a divergência
de **exibição** do instrumento e a ausência de fonte, sem adjudicar semântica.

7.5 Reexecução quando A publicar SHA corrigido: mesma tabela, mesma série bruta, coluna nova
`estado-apos-correcao` por linha (convergiu / permanece / nova divergência), em seção **datada e
acrescentada** — a tabela original não é reescrita.

7.6 Não promovo nem rebaixo A: a revisão declara divergências estruturais e o efeito delas na
categoria `vinculo-estrutural`; a decisão de merge/promoção é do integrador.

## 8. Auditoria dos JSONs redigidos versionados + política (obrigação 9)

Escopo: `data/rex_profiles/parallel_recovery_20261004/c/evidence/*.json` e `*.redigido.json`.

- E1: todo arquivo redigido declara `objeto` (caminho declarado + SHA-256 + tamanho), `regiao`,
  `raizes` com `proveniencia` e `grau`, `comando` de reprodução, e a base da ferramenta.
- E2: **nenhum dump de bytes comerciais.** Chaves proibidas no redigido: `bytes`, `dump`, `hex`,
  `disassembly`, `opcode-stream`. String hexadecimal de comprimento 40 (SHA-1 de commit) ou 64
  (SHA-256) é o único blob aceito; qualquer outra string com ≥ 12 hex contíguos fora desses
  comprimentos = FAIL da auditoria.
- E3: reprodutibilidade: o comando registrado regenera o arquivo byte a byte no mesmo HEAD
  (verificado pelo script de evidência; se o caminho local do `--bin` aparecer no output, é
  **FAIL** — identidade por SHA, não por caminho).
- E4: exposição **já existente**, registrada sem correção silenciosa: o Anexo A de
  `EXPECTATIONS-ETAPA1.md` (histórico `fbb8a3d`) contém ~160 bytes literais da ROM BYOR,
  pinados antes do congelamento como tabela-ouro manual. A política desta frente **propõe**
  (não aplica): preservar o histórico, mover dumps futuros para o relatório local do operador, e
  adotar E2 como teste de CI para frente C.
- E5: utilidade para reprodução: cada evidência referencia o fixture/instrumento usados e o
  veredito do comparador; um leitor que só tem o JSON consegue decidir o que foi medido e o que
  ficou pendente.
- E6: teste automatizado `tests/auditoria_evidencia.rs` cobrindo E1/E2/E3 sobre os arquivos
  versionados; ele falha se um redigido futuro violar a política.

## 9. Critérios de meta, não-sucesso e gates

- N1: nenhum número publicado nesta etapa vem de outra fonte que a evidência commitada; a série
  bruta fica junto do resumo.
- N2: categorias não promovem automaticamente: `candidato` ≠ `referencia-estatica` ≠
  `vinculo-estrutural` ≠ `observado-em-runtime` ≠ `equivalencia-demonstrada`. O verificador
  declara a categoria e o teto, nunca a próxima.
- N3: FIXTURES AUTORAIS são identificados como autorais nos relatórios; nenhuma prova de
  fidelidade usa formas geométricas no lugar de conteúdo real, e nenhuma ROM é versionada.
- N4: gates executados e reportados (com motivo onde **não** executados): `cargo fmt --check`,
  `cargo clippy --all-targets`, `cargo test`, `npm run check:tree`. Gates de aplicação
  (`host:diagnose`/`host:certify`, lint/tsc/npm test) só se a mudança tocar app; caso contrário,
  registro explícito de não-execução e motivo. Clippy `--all-targets` é reportado com a situação
  real conhecida (memória `feedback-rex-gate-reconciliation`), não como verde por omissão.
- N5: um trabalho pesado por vez, sem observadores permanentes de CI; consulta pontual.
- N6: sem merge remoto, release, promoção de maturidade, push forçado ou limpeza de trabalho
  alheio; nada fora de `scripts|docs|data/rex_profiles/parallel_recovery_20261004/c/`;
  Memory Bank e ROUND_STATE permanecem reservadas ao integrador (proposta, não edição).
- N7: se houver bloqueio externo real (ex.: ferramenta de terceiros ausente), documenta-se e
  conclui-se o restante independente. Ausência de prova não vira sucesso.

---

## Apêndice A — série bruta das sondas (instrumento pinado; executadas ANTES do congelamento)

Sonda `crua.s` (formas construídas com `.short`, montagem `m68k-elf-as -m68000`):

```
$ m68k-elf-objdump -d crua.o | tail
   0:  61ff 0000 1234      bsrl 1236 <fx9+0x1236>
   6:  614a                 bsrs 52 <fx9+0x52>
   8:  4efa 1234            jmp %pc@(123e <fx9+0x123e>)
   c:  4efc                 .short 0x4efc
   e:  1234 4efd            moveb %a4@(fffffffffffffffd,%d4:l:8),%d1
  12:  1234 5678            moveb %a4@(78,%d5:w:8),%d1
  16:  4ef9 1234 5678       jmp 12345678 <fx9+0x12345678>
  1c:  4ef8 1234            jmp 1234 <fx9+0x1234>
  20:  4eba 1234            jsr %pc@(1256 <fx9+0x1256>)
  24:  0a7c fc00            eoriw #-1024,%sr
  28:  1122                 moveb %a2@-,%a0@-
  2a:  3344 2a7c            movew %d4,%a1@(10876)
  2e:  1234 5678            moveb %a4@(78,%d5:w:8),%d1
  32:  41f8 8000            lea ffff8000 <fx9+0xffff8000>,%a0
  36:  41fa fffa            lea %pc@(32 <fx9+0x32>),%a0
  3a:  4e75                 rts
```

Sondas isoladas (uma forma por objeto, `rótulo p0` em `0`):

```
p_bsr_ff_long.o:   0: 61ff 0000 1234  bsrl 1236      6: 4e71  nop
p_bsr_s_byte.o:    0: 614a             bsrs 4c        2: 4e71  nop
p_ff_4efc.o:       0: 4efc             .short 0x4efc  2: 1234 4e71  moveb %a4@(71,%d4:l:8),%d1
p_ff_4efd.o:       0: 4efd             .short 0x4efd  2: 1234 4e71  moveb %a4@(71,%d4:l:8),%d1
```

Sonda `bit15.s` com rótulos resolvidos pelo montador (prova de que as formas existem no
montador pinado) e `bit15b.s` com bit15 ligado em `(xxx).W`:

```
$ m68k-elf-as -o bit15.o bit15.s && m68k-elf-objdump -d bit15.o | tail
   0: 4eb8 0000   jsr 0 <p>          (forma jsr abs.W produzida pelo montador)
   4: 4ef8 0000   jmp 0 <p>          (forma jmp abs.W)
   8: 4ef9 0000 0000  jmp 0 <p>      (jmp abs.L)
   e: 41f8 0000   lea 0 <p>,%a0
  12: 61fe        bsrs 12 <bsrback>  (disp8 = -2, base instr+2, 2 bytes)
  14: 6100 fffc   bsrw 12 <bsrback>
  18: 4878 0000   pea 0 <p>
  1c: 4e75        rts

$ m68k-elf-objdump -d bit15b.o | tail
   0: 4eb8 8000   jsr ffff8000       4: 4ef8 8000   jmp ffff8000
   8: 41f8 8000   lea ffff8000,%a0  12: 4e75       rts
   c: 4ef9 0080 0000  jmp 800000
```

DBcc/Scc (registro `%d3` é obrigatório na sintaxe do montador pinado):

```
51cb f800 → dbf %d3,fffff802   (base instr+2)      51c3 → sf %d3   (Scc, 2 bytes, não DBcc)
```

Janela de contexto da ROM (reservada como origem das raízes de §4):

```
$ m68k-elf-objdump -b binary -m m68k -D --start-address=0xd80 --stop-address=0xda0 <ROM>
 d80: 6000 fde2   braw 0xb64
 d84: 6100 5b2c   bsrw 0x68b2
 d88: 4eb9 0001 c024   jsr 0x1c024
 d8e: 4eb9 0001 c6b8   jsr 0x1c6b8
 d94: 6100 08c8   bsrw 0x165e
 d98: 4a78 f614   tstw 0xfffff614
 d9c: 6700 0006   beqw 0xda4
```

## Apêndice B — censo de iscas na ROM (endereços e contagens; nenhum byte versionado)

Contagem de ocorrências alinhadas a word, obtida por varredura linear (python/`re`, bytes
reais, não texto ASCII). Serve para dimensionar os negativos; **não** é medição da ferramenta.

| padrão | contagem | endereços (até 8) | leitura do instrumento |
|---|---|---|---|
| `4E FA` | 1 | `0x66A40` | `jmp %pc@(0x68647)` — A leria `jsr abs.w → 0x1C05` (consumidor falso) |
| `4E FC` | 1 | `0x31DCC` | segundo word de `subb %a4@(20220),%d2` em `0x31DCA` — **interior de instrução** |
| `4E FD` | 0 | — | não ocorre alinhado |
| `0A 7C FC` | 0 | — | não ocorre |
| `4E B8` | 3 | `0x74EEC`, `0x77EFA`, `0x819DA` | `jsr abs.w` legítimo |
| `4E F8` | 3 | `0x4028A`, `0x4F606`, `0x50210` | `jmp abs.w` legítimo |
| `2A 7C` | 2 | `0x3AB02`, `0x4F850` | `movea.l #imm32` legítimo |
| `61 nn`, `nn ∉ {00, FF}`, endereço par | 758 | `0x5C2`, `0x11F0`, `0x1482`, `0x15C6`, `0x1DD8`, `0x1DFA`, … | candidatos a `bsr.s` que A **não** modela (leria os 2 bytes seguintes como d16) |

Conferência de integridade (reprodutível, sem versionar a ROM): SHA-256 do arquivo
`c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531 577 bytes; pinos de
S1/S2/CTX reproduzidos por `hashlib.sha256` sobre fatias do arquivo (os pinos por `dd … length=`
produzem o hash de entrada vazia `e3b0c442…` — método descartado).
