# CONTRATO — `rex-cfg/v1`: CFG parcial por análise de fluxo delimitada

**Frente C · paralela · Experimental.** Base: `cb56657a142df40d2acd09a3e03e54247f066dea`.
Território: `scripts/rex_profiles/parallel_recovery_20261004/c/`,
`docs/rex_profiles/parallel_recovery_20261004/c/`,
`data/rex_profiles/parallel_recovery_20261004/c/`.
Não altera `crates/rex-gameplay`, `scripts/rex_corpus_a` nem harness compartilhado;
consome `rex-gameplay` (`m68k`, `json`, `sha256`) como dependente de path, somente-leitura.

> **PONTEIRO DATADO (2026-10-05, ETAPA 3).** Este arquivo **não foi reescrito**. As cláusulas
> abaixo foram retificadas por referência primária (M68000PRM/MC68000UM) e pelo montador e
> desmontador pinados, com cotação verbatim da linha original, classificação do estado e sonda que
> mede: ver `CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md`.
>
> - §0.3 (`28-30`): a recusa de `disp8 = 0xFF` pertence a `Bcc`/`BSR`/`BRA`, **não** a `DBcc` (R-2).
> - Regras de endereço (`67-71`): a base é `instrução + 2`; a nomeação "primeiro word de extensão"
>   não se aplica às formas `.S` (R-5).
> - §2.1 (`101-106`): a hipótese `extensao-abs-w-hipotese-zero-extendida` está **refutada** por
>   PRM §2.2.16 — `(xxx).W` é sign-estendida; o objeto `v2` publica Q1–Q4 separados e as duas
>   strings aposentadas saem do export (R-1).
> - §3 (`156-158`): `MOVEA` só tem `.W`/`.L` (PRM 4-119) e `MOVE.W → An` **é** o `MOVEA.W` válido;
>   o inválido é tamanho **byte** com destino `An` (PRM 4-118, nota do §MOVE) (R-3).
> - §3 (`166`): `DBcc` não tem forma disp8 — deslocamento de **palavra** com sinal, sempre 4 bytes,
>   base `instrução + 2` (PRM 4-90, Table 3-9) (R-4).
> - Regra V5 (`133-138`): 18 rótulos de fronteira, um texto de `limites` e mensagens de CLI
>   violavam a exigência de ASCII e foram recolocados em ASCII (R-6).
>
> Esquemas em vigor desde esta entrega: `rex-cfg/v2`, `rex-cfg-sitio/v2`, `rex-cfg-med/v2`. O título
> acima (`rex-cfg/v1`) fica como está; os artefatos v1 publicados são históricos intocáveis, com
> digestos pinados por `tests/guarda_historico.rs`.

## 0. O que é e o que não é

`rex-cfg` constrói um **grafo de fluxo de controle parcial** a partir de raízes
explícitas dentro de uma região declarada, decodificando um **subconjunto
documentado de opcodes 68000**. Não é um desassemblador universal: onde o
subconjunto não cobre, o caminho **para** e a parada vira *fronteira* no
export. Cobertura desconhecida é limite declarado, nunca instrução recuperada.

Proibido por contrato:

1. **Não classificar raiz declarada como alcançável desde o boot.** O grau de
   evidência de uma raiz é o que foi registrado em `--provenance`; a análise
   nunca promove esse grau.
2. **Não resolver chamada indireta nem tabela de salto por aparência.**
   `JMP (An)`, `JSR (d16,An)`, `JMP (abs).W` etc. produzem fronteira
   `indirect-opaque` e uma entrada em `calls` com `target: null`; o alvo é
   desconhecido e permanece desconhecido.
3. **Não continuar por comprimento inventado.** Opcode fora do subconjunto,
   extensão fora da semântica 68000 (ex.: disp8 `0xFF` em Bcc/BSR/DBcc — forma
   68020) ou instrução que atravessa o fim da região interrompem o caminho
   naquele endereço; nenhum byte além da instrução comprovada é reclamado.
4. **Não gerar pseudocódigo nem alegar equivalência semântica.** O export traz
   mnemônicos do subconjunto como apresentação; não há reconstrução de
   expressão, flag ou efeito de memória alegados completos.
5. **Não descartar flags, registradores ou chamadas opacas como irrelevantes.**
   Chamadas têm `params: "nao-inferidos"` e `clobbers: "nao-modelado"`;
   retornos terminam o caminho sem hipótese sobre o que voltou na pilha.

## 1. Vocabulário de evidência (herdado de `rex-corpus-a` FASE6, mantido separado)

| Nível | Definição | Usa em |
|---|---|---|
| `candidato` | decodifica limpo; nenhuma evidência de consumidor | raiz `declarada-operador` |
| `referencia-estatica` | endereço é operando/sítio medido por varredura com instrução comprovada; sem fluxo conectado | proveniência de raiz |
| `vinculo-estrutural` | sítio de chamada com alvo comprovado dentro do fluxo analisado | arestas `call` |
| `vetor-plataforma` | valor lido de tabela vetorial por contrato de plataforma (ex.: longo em `0x000004`) | proveniência de raiz |
| `dentro-de-fluxo` | bloco alcançado a partir de raiz declarada, *nesta* análise | blocos/arestas |
| `observado-em-runtime` | **fora do alcance desta ferramenta** — jamais alegado | — |

`dentro-de-fluxo` não implica alcançabilidade desde o boot nem execução real.

## 2. Entrada da CLI

```
rex-cfg analyze --bin <arquivo> [--origin 0xN] \
  --region 0xINICIO:0xFIM [--region-prov <texto>] \
  --root 0xENDERECO ... --root-prov <vocabulario> ... [--root-evidence <texto> ...] \
  --site 0xENDERECO ... [--max-insn N] \
  --out <json> [--md <markdown>]
```

- `--region` início inclusivo, fim exclusivo; pares `--root/--root-prov/
  --root-evidence` por posição; proveniência fora do vocabulário = erro.
- `--bin` é tratado como somente-leitura; o digest SHA-256 (via
  `rex-gameplay::sha256`) do arquivo inteiro vai ao export como identidade do
  objeto. Contêineres comprimidos não são aceitos — o operador extrai antes,
  fora da árvore versionada, e declara a identidade do membro.
- Regras de endereço: base 0 do `--bin` + `--origin`. Deslocamento relativo de
  Bcc/BSR/DBcc é sempre **relativo ao primeiro word de extensão
  (`endereço_da_instrução + 2`)**, semante 68000, independente do tamanho final
  da instrução. Esta é a regra cujo erro histórico (base = fim da instrução)
  os fixtures devem capturar.

### 2.1 Extensão datada (2026-10-04, ETAPA 2): subcomando `consultar`

§2 acima permanece como assinado na ETAPA 1: a assinatura de `analyze` **não
mudou** e nenhum caso de `analyze` foi reescrito por causa disto (a suite da
ETAPA 1 continua a correr como estava). A ETAPA 2 acrescenta
um segundo subcomando, congelado em `EXPECTATIONS-ETAPA2.md` §5, para responder a
pergunta "este sítio é instrução, dado ou interior de outra instrução?" em formato
consumível pela frente A:

```
rex-cfg consultar --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM \
  --root 0xENDERECO ... --root-prov <vocabulario> ... --site 0xENDERECO \
  --out <json> [--max-insn N]
```

- **exatamente um** `--site` por chamada (um sítio, um objeto plano); `--md`,
  `--region-prov` e `--root-evidence` não existem aqui e são **erro de uso**
  (código 2), não flags ignoradas.
- Saída: objeto plano `rex-cfg-sitio/v1`, 22 chaves ASCII em ordem congelada,
  endereços como `0x%06X`; veredito ∈ `instrucao-de-bloco | miolo-de-instrucao |
  dentro-regiao-nao-alcancado | fora-da-regiao | ponto-de-fronteira`, mais as
  decisões V1–V5 (`consumidor-validado`, `promovivel-vinculo-estrutural`,
  `motivos`) e o registro de interpretação pendente de `(xxx).W` (P-absW, §1.1
  da expectativa e bullet próprio abaixo).
- A resposta **nunca** promove grau: `consumidor-validado` e
  `promovivel-vinculo-estrutural` são calculados das regras V1–V5, com o alvo
  re-derivado independentemente dentro da ferramenta (`src/sitio.rs::rederivar`)
  quando o grafo alega um (`RETIFICAÇÃO` A-5 do adendo datado).
- `limites` declara `extensao-abs-w-hipotese-zero-extendida` (§1.1 P-absW): o
  `alvo` de um `(xxx).W` é o **operando bruto** sob essa hipótese, que não foi
  resolvida por fonte primária. Quando o word tem bit15 ligado, `motivos` traz
  `interpretacao-pendente:abs-w-bit15` — registro informativo, calculado **depois**
  de `consumidor-validado`, para que nenhuma classificação estrutural dependa da
  interpretação. `(xxx).L` não recebe o registro (a longword inteira é o operando).
- Códigos de saída: os mesmos três de `analyze` (0 ok, 1 falha de análise,
  2 erro de uso). `--bin` continua somente-leitura.

### 2.2 Extensão datada (2026-10-05, ETAPA 2): subcomando `medir`

`analyze` e `consultar` continuam como assinados; nada deles mudou por causa
disto. O terceiro subcomando é o export de medições para a frente D, congelado
em `EXPECTATIONS-ETAPA2.md` §6 (obrigação 8):

```
rex-cfg medir --bin <arquivo> [--origin 0xN] --region 0xINICIO:0xFIM \
  --root 0xENDERECO --root-prov <vocabulario> [--max-insn N] --out <json>
```

- **exatamente uma** `--root`: as quatro dimensões compartilhariam denominador
  se houvesse mais de uma raiz, e isso é agregado — proibido por §3 A4 e §6.
  `--md`, `--region-prov`, `--root-evidence` e `--site` não existem aqui e são
  **erro de uso** (código 2), não flags ignoradas.
- Saída: objeto plano `rex-cfg-med/v1`, 37 chaves ASCII em ordem congelada
  (`tests/medir.rs`), quatro blocos de dimensão — `comprimento-*`,
  `operandos-*`, `fluxo-*`, `alcance-*` — cada um com `status`, `unidade` e o
  seu denominador próprio. `agregado = "proibido"` é campo explícito: nenhuma
  chave soma dimensões (vocabulário vedado em chave: `total|media|somatorio|
  global|consolidado`).
- **Normalização de grafia (MD1)**: os três textos fixos de `limites` são os do
  §6, gravados **sem acento** — `paridade com objdump nao equivale a observacao
  em runtime`, `nenhuma dimensao promove outra`, `sem execucao, sem DAC, sem
  VRAM`. A razão é a mesma da regra V5 de §5, que vale para todo objeto emitido
  por `rex-cfg`: o parser da frente A recusa byte não-ASCII e qualquer escape.
  É normalização de grafia, **não** de sentido; o texto congelado permanece o
  da expectativa e esta seção registra a correspondência.
- MD2: nenhum valor de operando sai daqui — `operandos-valores-status =
  "recusado"` com `operandos-valores-motivo = md2:nenhum-byte-literal-do-objeto-no-export`.
  A dimensão de operandos conta **extensões** (`instrucoes-com-extensao`,
  `palavras-de-extensao`), que é aritmética exata sobre comprimentos já
  provados no subconjunto fechado de §3, e não alega efetividade de modo.
- MD4: `status` por dimensão ∈ `medido | pendente | recusado`. Trabalho
  truncado por `--max-insn` ⇒ as quatro dimensões ficam `pendente` e
  `pendencia-motivos = ["limite-de-trabalho"]`; os números continuam presentes
  (é o que foi possível medir) e o status impede que sejam lidos como cobertura.
- MD3: o objeto se identifica por `objeto-sha256` + `objeto-tamanho` e o campo
  `comando` reproduz a invocação **sem caminho local** (o `--bin` do comando é
  `sha256=<digest>`), conforme §8 E3.
- Códigos de saída: os mesmos três.

## 3. Subconjunto de instruções suportado (lista fechada)

Suportadas para **comprimento e efeito de controle**; sem semântica de dados:

- `MOVE`/`MOVEA` .B/.W/.L entre modos 68000 válidos (registros, `(An)`,
  `(An)+`, `-(An)`, `d16(An)`, `d8(An,Xn)`, `abs.W`, `abs.L`, `#imm` só em
  MOVE); combinações inválidas (p. ex. MOVE.W → An) = fronteira.
- `LEA`, `PEA` (modos de memória, sem imediato).
- `ADDQ`/`SUBQ` #q,ea; `ADD`/`SUB`/`CMP` formas registradas e gerais (m→r, r→m).
- `MOVEQ`, `CLR`, `NEG`, `NOT`, `TST`, `SWAP`, `CHK`.
- `ANDI`/`ORI`/`EORI`/`CMPI`/`ADDI`/`SUBI`/`EOR` #imm,ea; `AND`/`OR` m↔r.
- `ASL/ASR/LSL/LSR` imediato (ea), registro (Dn,Dn e Dn→ea / ea→Dn).
- `BTST/BCHG/BCLR` #imm,ea; `BSET` #imm,ea e r,ea.
- `MULU/MULS/DIVU/DIVS` ea,Dn.
- `Scc` ea.Dn; `DBcc` Dn com disp8 (disp8=0x00 → extensão word; 0xFF recusada).
- Fluxo: `BRA`/`BSR`/`Bcc` (todas as 16 condições) `.S/.W`; `JMP`/`JSR`
  `abs.W`, `abs.L` (alvo comprovado) — demais modos de `JMP/JSR`/`EOR` etc.
  indiretos = fronteira `indirect-opaque`.
- `RTS` (terminador de retorno); `NOP`; `LINK`/`UNLK` (comprimento 4/2;
  efeito de pilha não modelado); `TRAP #n` (fronteira `trap-opaco`);
- `MOVEM` .W/.L com lista de registradores de 1 word (4 bytes) — suportado
  **apenas para comprimento**; forma 68020 com word estendido = recusa.
- `MOVE SR→Dn` (`0x40C0+reg` e variantes .W comprovadas em fixture).

Qualquer outro opcode, forma estendida 68010+ ou combinação inválida
detectável ⇒ `frontier(kind="opcode-fora-do-subconjunto", opcode, endereco)`.
A tabela exata de (máscara, valor, consumo de extensão) vive em
`src/decode.rs` e é a única fonte; este documento lista as famílias.

## 4. Saída `rex-cfg/v1` (JSON ordenado, determinístico)

```
schema: "rex-cfg/v1"
tool: {name, version, base_sha: "cb56657..."}
objeto: {caminho_declarado, sha256, tamanho}
regiao: {inicio, fim, proveniencia}
raizes: [{endereco, proveniencia, evidencia, grau}]   # grau nunca promovido
blocos: [{entrada, instrucoes: [{endereco, tam, mnem, classe}],
          saida: fim-de-bloco, sucessores: [{alvo, tipo}],
          alcanado-por: [enderecos ou "raiz"]}]
arestas: [{origem, alvo, tipo: queda|desvio|chamada|retorno-fronteira,
           status: resolvido|fora-da-regiao|indireto-opaco|armadilha}]
chamadas: [{sitio, alvo|nulo, forma, params: "nao-inferidos",
            clobbers: "nao-modelado", status}]
fronteiras: [{endereco, tipo, opcode|nulo, motivo}]
cobertura: {bytes-decodificados, bytes-regiao, fracao,
            vaoes: [{inicio, fim}]}                    # spans não decodificados
sitios: [{endereco, veredito: instrucao-de-bloco|miolo-de-instrucao|
          dentro-regiao-nao-alcancado|fora-da-regiao|ponto-de-fronteira,
          bloco|nulo}]
limites: [textos fixos do contrato]
```

Regras do export:

1. Todo byte decodificado pertence a exatamente uma instrução comprovada;
   `cobertura` é soma dos comprimentos, não extensão de bounding box.
2. `miolo-de-instrucao` para sítio de consulta que cai dentro de bytes de uma
   instrução decodificada em bloco alcançado — evidência de que um casamento
   por varredura linear ali é **dado**, não fluxo.
3. Caminho após `RTS` não continua; o endereço de retorno de `BSR`/`JSR` é
   registrado na aresta `chamada`, e a continuação pós-chamada é analisada
   como fluxo normal da função chamadora.
4. Chamada com alvo dentro da região cria raiz derivada `dentro-de-fluxo` e o
   alvo é analisado como bloco; chamada com alvo fora da região termina como
   aresta `fora-da-regiao` sem decodificar nada fora.
5. Sem metas de execução: `--max-insn` (padrão 100 000) limita o trabalho; ao
   atingir, fronteira `limite-de-trabalho`.

## 5. Testes exigidos (ver `EXPECTATIONS-ETAPA1.md`)

- Unitários: fórmula de base de desvio (caso discriminante do erro histórico),
  recusa de formas 68020, comprimentos por tabela.
- Fixtures montados com `m68k-elf-as` (binutils 2.41 do host, já provisionada)
  e comparados com `m68k-elf-objdump` como **instrumento independente** —
  comprimento e alvo absoluto por instrução; round-trip interno próprio não
  basta nem é aceito como prova.
- Cross-check com `rex-gameplay::m68k::decode` nas formas comuns dos dois
  subconjuntos (comprimento e alvo idênticos; divergência = falha).
- Consomem fixtures montados; ROM BYOR **não** entra em teste de CI
  (identidade por SHA-256 nos relatórios de ROM fica em `data/.../c/evidence/`).

## 6. Limites assumidos

- Análise intra-região apenas; fluxo que sai da região termina na fronteira.
- Sem propagação de pilha/registrador: grau de evidência de parâmetros é
  sempre `nao-inferidos`.
- Sem execução: nada aqui prova consumo em runtime (`observado-em-runtime`
  permanece não alcançado por esta ferramenta).
- `MOVEM` com lista estendida 68020, modos `PBd16/PBd8` 68020, `FMOVE`,
  cache/`PMOVE`, `BKPT`, `MOVEC/MOVES` não existem no contrato 68000: recusar
  é o comportamento correto.
- Desempate de falsos consumidores: o veredito `miolo-de-instrucao` prova que
  um casamento linear ali não é início de instrução *deste fluxo*; não prova
  que o byte seja dado em outros fluxos não analisados.
