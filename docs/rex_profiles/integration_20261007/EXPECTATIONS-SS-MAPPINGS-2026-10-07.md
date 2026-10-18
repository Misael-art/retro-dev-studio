# EXPECTATIONS — mappings dos IDs 37–78 da fase especial (Sonic 1) — 2026-10-07

Congelado ANTES da captura de confirmação. A exploração 1 (semente de entrada 7) já testou hipóteses de mapping contra
quadros do core; seus resultados (`ss-mappings-hipoteses-exploracao.json`) são **HIPÓTESES**, não aceite.

## Hipótese estrutural (a ser confirmada ou refutada)
Para cada registro SS_MapIndex (ptr, campo): tabela de ponteiros de 16 bits relativos a `ptr` (como Map_SSWalls); nº de frames lido
por regra conservadora (palavras 2·(k+1) ≤ v < 0x100 e 2k < menor ponteiro); frame = `count(1)` + `count×5` bytes
(`y, size, name(2), x`); nome efetivo = `campo + name` (tile = &0x7FF, linha = bits 13–14, flips = bits 11–12); arte = cue do
PLC `0x1D992` cuja faixa contém a base de tile; nenhuma peça pode referenciar tile fora da arte (senão o frame é recusado).

## Critérios (predições)
| ID | Critério |
|---|---|
| M1 | **Confirmação em amostra reservada**: uma 2ª captura do core com semente de entrada ≠ 7 (semente 11 e 23, 2 capturas) e a mesma ROM/core. Um par (tabela, frame) só é **confirmado** se casar 100% dos pixels opacos (≥20 px opacos, ≥3 cores) em AO MENOS UMA das duas capturas novas, usando a paleta WRAM do instante. |
| M2 | Par que casou na exploração e não casa nas capturas novas permanece **hipótese não confirmada** (não vira recurso recuperado). Par confirmado em 1 captura nova tem nível "confirmado por 1 captura"; em 2, "confirmado por 2". |
| M3 | Frames `vazio-sem-pecas`, `tile-fora-da-arte` e `arte-sem-cue` NÃO são compostos: o produto diz o motivo. Nenhum preenchimento. |
| M4 | A busca não pode usar a captura nova para ajustar a regra de contagem de frames nem o formato; mudança depois de ver = amostra queimada e o resultado vira regressão. |
| M5 | Controle negativo: com a ordem de tiles transposta, ou os pixels invertidos dentro do tile, **zero** pares confirmam. |
| M6 | Produto Rust: composição indexada de cada frame confirmado = referência Python independente, bit a bit; frames não confirmados não geram imagem. |
| M7 | UI: ID com frame confirmado mostra imagem + nível de confirmação + rótulo da paleta (estática, linha do registro); ID sem confirmação mostra a estrutura/motivo e nenhuma imagem; jornada desktop com oráculo JS e captura visível. |

## Limites declarados desde já
Confirmação por pixel não prova **qual ID** aparece em qual objeto; prova que o mapping lido produz exatamente aquela imagem na tela
do core com aquela paleta. Paleta estática continua candidata; frame do core é um instante. Flips só se contam quando o template
espelhado casa. Escopo Experimental. IDs 58, 66–69 (base `0x7b2`, fora do PLC) ficam sem arte e sem composição.
