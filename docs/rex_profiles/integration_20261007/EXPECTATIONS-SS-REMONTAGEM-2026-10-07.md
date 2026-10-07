# EXPECTATIONS — remontagem das paredes da fase especial (Sonic 1) — 2026-10-07

Congelado ANTES de: harness do core, módulo Rust e UI. Honestidade de processo: uma sonda exploratória
(`REX-ENIGMA-AVALIACAO-2026-10-06/ss-remontagem-sonda1/`) já mostrou 249 tiles, o ajuste 9+15×16 com os mappings,
4 tiles vazios (121,124,133,136), a paleta `0x26C8` e a composição dos 16 frames. Esses itens são **CALIBRAÇÃO VISTA**
(não são predições). Só os critérios C4–C8 abaixo são predições; não mudam depois de ver resultado (desvio = FAIL/INCONCLUSIVE).

## Alvo (cadeia, cada ligação com origem)
ID `0x01` → registro SS_MapIndex `0x1B738` (`0002c564 00000142`, loader pinado por B) → Map_SSWalls `0x2C564`
(16 frames, 1 peça cada; layout verificado por B, E14–E16) → arte Nemesis `0x2C5E4` (cue `Nem_SSWalls`, PLC `0x1D992`,
tile base `0x142`) → paleta Pal_SpecialStage (PalLoad id 10, tabela `0x2168`, ptr `0x26C8`, 128 B, SHA `2f9072d8…`) → composição.
Cada elo reaproveita o nível de prova de B (vínculo estrutural estático); **nenhum elo é "consumo observado"** salvo C7.

## Amostra
- Calibração (permitido ajustar o código): frames 0 (`.straight`) e 1 (`.angled1`).
- **Reservada** (não usar para ajustar nada): frames 9 e 15. Se um ajuste for feito depois de comparar com eles, a amostra
  é declarada queimada e a comparação só vale como regressão.
- Demais frames: observação, sem papel de aceite.

## Critérios
| ID | Critério | Oráculo |
|---|---|---|
| C1 | Decoder Nemesis em Rust = meu decoder Python independente (7968 B, SHA igual) e recusa: cabeçalho truncado, código inválido, excesso/falta de pixels, limite de saída/trabalho, cancelamento, ruído sem panic | testes + paridade |
| C2 | Cada tile referenciado por peça de mapping existe (`tile+w*h-1 < 249`); referência fora do range é recusada, nunca preenchida | núcleo |
| C3 | Tile totalmente transparente é reportado como "vazio" e **nunca** como arte recuperada; nenhum placeholder, cor inventada nem tile sintético | núcleo + UI |
| C4 | Composição indexada (índices 0..15) dos frames reservados 9 e 15 = referência independente (composição por segundo código, ordem de tiles/XOR/pixels escrito separado) bit a bit | 2ª implementação |
| C5 | Paleta: a UI/DTO rotula `candidata estática (Pal_SpecialStage linha 0)`; nunca "paleta do jogo"; linha vem do mapping+campo $0142 | teste de rótulo |
| C6 | Conversão CRAM→RGB documentada (9 bits, nível 0..7→0..255 por `n*255/7`) e a mesma no oráculo | teste |
| C7 | Frame do core `genesis_plus_gx`: com a ROM pinada, estado da fase especial alcançado por escrita de RAM documentada (v_gamemode=$10, sem controle) e frame identificado (SHA do framebuffer, nº do frame, SHA da ROM, SHA do core); cada frame reservado que aparecer na captura deve casar **100% dos pixels opacos** com a composição usando a paleta lida do CRAM/`v_palette` daquele instante (rotulada como estado observado, distinta da estática). Frame reservado que não aparecer = INCONCLUSIVE, não PASS | harness libretro |
| C8 | Negativos: deslocar 1 px, trocar a linha de paleta e trocar a ordem coluna/linha de tiles **reprovam** C4/C7 | mutantes |
| C9 | UI somente leitura: célula do Mapa de IDs com ID 0x01 abre registro→mapping→arte→paleta→composição; ID sem composição comprovada diz isso; zero escrita; captura de tela do painel (elemento visível) na jornada desktop | E2E + captura |
| C10 | Nenhum arquivo da ROM, tiles ou PNG derivado entra no Git; só SHAs | revisão |

## Limites declarados desde já
Sem edição/reinserção. Sem afirmar que a paleta estática é a do jogo. Um frame do core prova o pixel naquele instante, não
todo o jogo. Escopo Experimental. Ciclo PalCycle_SS e pisca (`0x1B33A`) fora do escopo; o oráculo do core usa a paleta observada.
