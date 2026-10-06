# PROPOSTA à frente A — o que `rex-cfg/v1` entrega e o que ela **não** pode prometer

**Para:** frente A do round paralelo de 2026-10-04 (`rex-kosinski-chain/v1`, PR #107).
**De:** frente C (`rex-cfg/v1`, `scripts/rex_profiles/parallel_recovery_20261004/c/`).
**Status:** proposta. **Nada do território da frente A foi lido-para-escrever aqui**: este
arquivo é a única interface, e quem decide se entra na cadeia dela é o operador + a frente A.

## 1. A motivação é a mesma, do lado oposto

A frente A prova **cadeias de compressão** (quem chama o descompressor, o que ele produz).
A frente C prova **fluxo de código** dentro de uma região declarada. O ponto de contato é
um problema que as duas têm: uma varredura linear por assinatura (um `bsr.w` para
`0x189C`, um cabeçalho Kosinski, um ponteiro) encontra **casamentos que não são início de
instrução**. Isso é exatamente o consumidor falso que infla um grafo de cadeias.

A resposta desta frente é um primitive de classificação de endereço, e ela é
determinística, versionável e não pede execução:

```
rex-cfg analyze --bin <objeto> --region 0xINICIO:0xFIM --root 0xR --root-prov <vocab> \
  --site 0xCANDIDATO [--site ...] --out <json>
→ sitios[].veredito ∈ { instrucao-de-bloco, miolo-de-instrucao,
                        dentro-regiao-nao-alcancado, fora-da-regiao, ponto-de-fronteira }
```

**A regra que a frente A herda, e que precisa ser citada junto do número:**
*pertencer a um fluxo analisado ≠ existir consumo*. O veredito `miolo-de-instrucao` prova
que **naquele fluxo** aquele endereço não é início de instrução. Ele não prova que o byte
é dado (outro fluxo pode lê-lo como código), e `fora-da-regiao` não prova ausência de
consumo — prova apenas que a região declarada não alcança a pergunta. As duas leituras
erradas são proibidas pelo `CONTRACT.md` §6 e pelos JSONs carregam os `limites`
correspondentes no próprio corpo.

## 2. Evidência pronta que interessa às cadeias

A rotina que a frente A usa como âncora (descompressor em `0x189C`, 160 bytes, SHA
`e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90`) foi analisada de ponta
a ponta com **cobertura 160/160, zero fronteiras de opcode e `chamadas = []`**:

| número medido | valor | onde está |
|---|---|---|
| instruções na rotina | 66 (14 de 4B + 52 de 2B = 160) | `r1.redigido.json` |
| blocos / arestas | 21 / 31 | idem |
| chamadas | `[]` — rotina **folha** (não chama nada dentro da região) | idem |
| laços para trás | 5 arestas de desvio com alvo < origem (5 `DBcc` em `0x18AC`, `0x18C8`, `0x18DC`, `0x18EE`, `0x1922`) | idem |
| terminador | `rts` em `0x193A` | idem |
| paridade com o instrumento | 66/66 registros, 0 divergências | log do verificador |
| sítios canário | `0x18A0`, `0x18FF`, `0x193B` = `miolo-de-instrucao` | idem |

Leitura útil para A: se uma cadeia declara que o descompressor "consome" algo em
`0x18A0`/`0x18FF`/`0x193B`, essa aresta está dentro de instrução — `subql #2,%sp` ocupa
`0x189C..0x189D`, `moveb %a0@+,%a7@(1)` ocupa `0x189E..0x18A1`, etc. O JSON dá os
comprimentos instrução a instrução, então a checagem é mecânica.

E os três sítios de chamada da FASE6 (`0x01364`, `0x03082`, `0x051BC`) podem ser
consultados de dentro da região de cada um, com `--root` local; em R3, `0x1364` saiu
`instrucao-de-bloco` e o `bsr.w` em `0x1370` tem alvo `0x189C` **declarado** com
`status=fora-da-regiao` (a análise não atravessa a fronteira que o operador desenhou).

## 3. Interface de consumo (estável, e o que NÃO é estável)

**Consumível agora** (`rex-cfg/v1`, CONTRACT §4; export ordenado e byte a byte
determinístico, testado por `export_e_deterministico_byte_a_byte`):

- `schema` = `rex-cfg/v1`, `tool = {name, version, base_sha}` (base pinada `cb56657…`),
  `objeto = {caminho_declarado, sha256, tamanho}`, `regiao = {inicio, fim, proveniencia}`.
- `cobertura = {bytes-decodificados, bytes-regiao, fracao, vaos:[{inicio,fim}]}` — os vaos
  dizem **onde a ferramenta não sabe**, que é a informação mais honesta do export.
- `sitios = [{endereco, veredito, bloco}]`.
- `blocos = [{entrada, saida, alcancado-por[], sucessores:[{alvo,tipo}], instrucoes:
  [{endereco, tam, classe, mnem}]}]` — `classe` é o vocabulário comparável (família),
  `mnem` é texto do instrumento quando o contrato o permite.
- `arestas = [{origem, tipo, alvo, status}]`, `chamadas = [{sitio, alvo, forma,
  params:"nao-inferidos", clobbers:"nao-modelado", status}]`,
  `fronteiras = [{endereco, tipo, opcode, motivo}]`,
  `raizes = [{endereco, proveniencia, evidencia, grau}]`.

**Não conte como estável:** o texto de `mnem` (exibição de displacamento, nomes de
registrador do objdump, `lista nao-inferida` do `MOVEM`) e o conteúdo de `motivo`. Se a
frente A precisar de um campo novo, o caminho é nova versão de esquema, não leitura de
texto.

**Não use para:** grau de evidência (`candidato` nunca sobe sozinho), ordenação de
cadeias por "cobertura" (cobertura é medida do fluxo, não do arquivo), ou qualquer
afirmação sobre região que não foi a declarada.

## 4. Duas coisas que A provavelmente vai querer e que **não** existem aqui

1. **Resolver o alvo de `JMP/JSR` indireto.** Esta frente devolve `indireto-opaco` e
   `alvo = nulo` por contrato; não há modo "adivinhar pelo contexto". Se A precisa disso,
   é trabalho novo, com critério próprio, não um botão desta CLI.
2. **Propagação de registrador/pilha** (saber que `0x189C` recebe `A0` como stream). O
   `params` é constante `"nao-inferidos"`. Uma análise de dados em cima disto precisa ser
   negociada com o operador; aqui só existe o esqueleto de controle.

## 5. O que a C pede de volta (opcional, e barato)

- Se a frente A tiver um sítio onde a varredura linear dela produziu consumidor que a
  análise de fluxo chama de `miolo-de-instrucao`, **isso é um caso de teste para as duas**.
  Mande o endereço + região + raiz (byte/SHA da fatia, não a ROM) e a C acrescenta ao
  corpus de calibração ou a um fixture autoral, com o instrumento como árbitro.
- Do lado da C, a medição nova de 2026-10-04 (layout da word de extensão dos modos
  indexados, `d8(An,Xn)`/`d8(PC,Xn)`) corrigiu o ROM em `0x191C` de `XD0`/disp `0x20`
  para **`D2`/disp `0`** (`ADENDO-ETAPA1-2026-10-04.md` §A). É dentro do descompressor que
  a frente A ancora as cadeias: se algum modelo de A usa esse operando para dizer "o
  índice é D0", o índice é D2 — o laço constrói D2 e o usa como deslocador de leitura.

## 6. Como reproduzir o que este arquivo afirma

```sh
cd scripts/rex_profiles/parallel_recovery_20261004/c && bash executar-evidencia-C.sh
# hashes de referencia dos numeros citados (devem bater):
#   data/.../c/evidence/r1.redigido.json  d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4
#   data/.../c/evidence/r3.redigido.json  c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea
```
