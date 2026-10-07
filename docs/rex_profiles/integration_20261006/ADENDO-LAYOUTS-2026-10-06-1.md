# ADENDO-LAYOUTS-2026-10-06-1 — retificação datada da L2 + recusa de `value_offset` não comprovado (integrador, 2026-10-06)

Emitido por ordem do operador (Missão de fecho técnico da leitura nativa dos
layouts, passo 3), no HEAD `43bb42f6`. O texto congelado de
`EXPECTATIONS-LAYOUTS-2026-10-06.md` permanece intacto; este adendo é a
retificação datada, não uma reescrita.

## 1. Retificação da L2

L2 exigia: "`lib.rs` do pacote = `lib.rs` de B salvo `rustfmt`" (oráculo:
`rustfmt` do original + `diff` vazio). **Retificada nos fatos** para permitir
um **delta funcional versionado**, porque a igualdade byte-a-byte, cumprida na
integração (`79ca8082`←`da5472c4`), congelou junto um defeito de domínio:

- O crate expunha `DecodeOptions.value_offset: u16` aceitando qualquer valor,
  com a semântica "soma mod 2^16 no carregamento e no fetch inline" — e um
  teste de contrato (`value_offset_soma_mod_2_16_no_incr_comum_e_inline`,
  offset 2) **asseverava essa aceitação**.
- A única paridade **provada** é com `value_offset = 0` (B4: o sítio pinado
  chama com `move.w #$0,D0` antes do `jsr $171E`; E23 mede só offset 0). Para
  offset ≠ 0 há divergência conhecida do console no caso prioridade/flags
  (combinação do base com os bits de flag PCCVH). A aceitação era, portanto,
  uma alegação não comprovada embutida no produto.

Delta aprovado em `rex-enigma` **0.2.0** (de `0.1.0`), todo ele
recusável/versionado, sem tocar a lógica do caminho offset 0:

1. nova variante `EnigmaError::UnsupportedParameter`, código
   `"unsupported-parameter"`;
2. gate no topo de `decode()`: `value_offset != 0` ⇒ recusa explícita antes de
   qualquer leitura do stream (zero saída, nunca resultado silencioso
   incorreto);
3. comentário de domínio em `DecodeOptions.value_offset` (apenas 0 comprovado).

O diff contra o original de B passa a ser `rustfmt` + esses 3 itens, enumerados
aqui e no README do pacote. A verificação de proveniência que a L2 pretendia
continua de pé (estrutura própria, zero cópia de mdcomp/`enigma_research.py`,
ordem congelamento→código registrada em `REVISAO-ENIGMA-B.md` §1).

## 2. Coordenação com a frente B (solicitação)

Para o domínio offset ≠ 0 voltar a ser **aceitável**, B precisa entregar prova,
não plausibilidade:

- **S1 (asm):** determinação pelo desempacotador 68k pinado (`76fed2de…`) da
  aritmética exata do base `d0` quando a máscara habilita bits de flag
  (ordem/efeito de `addi`/`ori`/máscara `EniDec_Masks`), caso a caso por bit
  PCCVH — o teste atual de B generaliza a partir de um único offset 2 sem
  oráculo.
- **S2 (oráculo):** paridade em streams sintéticas com offset ≠ 0 contra os
  oráculos externos pinados (`enigma_research.py` `a9ed92f9…`; mdcomp como
  comparação, jamais fonte), com tabela máscara×offset documentada.
- **S3 (congelamento):** EXPECTATIONS próprio congelado antes da medição, pela
  disciplina de sempre; a integração do reabrir-domínio volta ao integrador
  como delta versionado novo (0.3.0), um commit por vez.

Até lá o produto não perde nada: o adaptador `sonic_layouts.rs` só chama com
offset 0 (o caminho recusado é inalcançável pelo IPC), e a recusa do crate é
defesa em profundidade.

## 3. Impacto nas gates

- **L1/L3**: reexecutadas — verdes (8+12) no contrato novo.
- **L2**: substituída por este adendo (delta funcional versionado, 3 itens).
- **L4 (aceite BYOR das 6 saídas reais)**: o crate do decoder mudou ⇒
  reexecução obrigatória antes de qualquer alegação nova; resultado no
  fecho da rodada.
- **L10/L11 (jornadas + regressões)**: reexecutadas no binário final desta
  rodada, atribuídas ao SHA dele, não ao `02ab2eec…` anterior.
- **L12 (gates de repo)**: `npm run security:audit` fechada pelo caminho
  canônico com npm 11.16.0 isolado (rc=0); causa da falha no host npm 12.0.2:
  recusa de `allow-scripts` vindo do npmrc de usuário em install de escopo de
  projeto (`strict-allow-scripts=true` do projeto preservado; nenhuma
  configuração global alterada).
