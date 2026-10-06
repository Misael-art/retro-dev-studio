# REVISÃO ETAPA 3 — C para D: onde a v2 retifica o `alvo` publicado na v1 (2026-10-06)

Endereçada à frente **D** (barra de avaliação, PR #106), que consome `alvo` como dimensão
separada. Esta entrega é o **objeto** e a **tabela de delta**; medir D sobre a v2 é trabalho dela.
Base v1: `8ea5821` (binário reconstruído com `git archive`). v2: head desta revisão.

## 1. Sítios com `alvo` retificado (par real v1/v2)

Fixture autoral `fixtures/fx12_absW.bin` (sha `1f7929ab…`), `--origin 0x80000`, região
`0x80000:0x80022`, raiz `0x80000` (`referencia-estatica`). Comparação das `chamadas` do
`analyze` das duas versões, mesmos argumentos:

| sítio | bytes | v1 `alvo` | v2 `alvo` | `operando-bruto` v2 | classe do delta |
|---|---|---|---|---|---|
| `0x80000` | `4eb8 8000` | `0x8000` | `0xFFFF8000` | `0x8000` | `alvo-corrigido` |
| `0x80004` | `4eb8 ffff` | `0xFFFF` | `0xFFFFFFFF` | `0xFFFF` | `alvo-corrigido` |
| `0x80008` | `4eb8 7fff` | `0x7FFF` | `0x7FFF` | `0x7FFF` | `invariante` |
| `0x8000c` | `4eb8 0001` | `0x1` | `0x1` | `0x1` | `invariante` |

Todos têm `status = fora-da-regiao` nas duas versões (a janela é a do arquivo mapeado em
`0x80000`). A regra é geral: o `alvo` v1 muda **se e somente se** o bit 15 da word é 1; o delta é
sempre `v2 = v1 | 0xFFFF0000`. Quem usava o `alvo` v1 como índice dentro da ROM para esses sítios
estava apontando para um endereço que a instrução não referencia.

## 2. Amostras da ROM BYOR

`evidence/delta-etapa3-v2.md` (110 linhas: arestas e sítios de R1, R2, R3, S1, S2): **todas
`invariante`**, comprimentos de instrução idênticos. Para D isto significa que nas amostras
medidas até aqui **nenhum alvo publicado muda**; não significa que a v1 estivesse certa em geral.

## 3. O que D deve fazer ao trocar de v1 para v2

* Ler `schema` (`rex-cfg-sitio/v2`, `rex-cfg-med/v2`) e recusar o par misto.
* Tratar `alvo` como Q2 (efetivo 32 bits). Se precisar do valor cru de 16 bits, é
  `operando-bruto`; para endereço de barramento, `endereco-de-barramento`.
* Não derivar offset de ROM: `offset-de-objeto` só aparece com mapeamento declarado.
* Não alterar expectativas já congeladas para acomodar a v2: linhas v1 de D que assumiram
  zero-extensão estão **caducadas** pela retificação versionada, não "erradas" no seu tempo
  (`RESPOSTA-D-A.md` §1 chega à mesma conclusão sobre as filas KA1).

## 4. Limites

Mesmos de `INFORME-C.md §11.5`. Nenhuma alegação de runtime; nenhuma ampliação de ISA.
