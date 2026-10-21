# Quatro tentativas sem salto na jornada v3-a — 2026-10-10

Fonte única: `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-48-51-643Z-report.json`, primeiras tentativas gravadas dentro da repetição que depois foi válida. A jornada continua 18/19. Esta leitura não muda esse veredito e não reagrupa ápices.

O relatório não guarda a série de RAM, nem o byte de status. A classificação usa só o que está na tentativa.

## O que as quatro têm em comum

Em todas, o backend aceitou aperto e soltura, o core leu o aperto, `legado_consumido` é verdadeiro, `amostras_sem_foco` é 0 e o estímulo parou em `alvo atingido`. Durante a janela amostrada, Y ficou em 944 (`y0` = `minY`), `vyMin` ficou 0 e `flagMax` ficou 0. Há exatamente duas transições, aperto e soltura, sem transição intermediária. O primeiro quadro da soltura é o quadro seguinte ao último quadro do aperto: não há quadro sem leitura entre os dois.

A segunda tentativa de cada uma saltou e foi a que entrou na mediana. Isso cumpre a regra de uma repetição. Não explica a primeira.

| Jogo | Variante | Modo | Repetição | Sessão | Época | Aperto lido | Quadros do aperto | Efeito |
|---|---|---|---|---|---|---|---|---|
| Sonic 1 | imp | segura | 2 | joypad-session-23 | 23 | seq 917, geração 36, quadros 972–1091 | 120 | nenhum |
| Sonic 1 | cut | toque | 1 | joypad-session-26 | 26 | seq 1049, geração 46, quadros 924–927 | 4 | nenhum |
| Delta | a-imp | segura | 3 | joypad-session-62 | 62 | seq 2487, geração 44, quadros 907–1026 | 120 | nenhum |
| Delta | c-imp | toque | 1 | joypad-session-82 | 82 | seq 3271, geração 38, quadros 734–736 | 3 | nenhum |

Solturas correspondentes: seq 918 (1092–1199), 1050 (928–1003), 2488 (1027–1120), 3272 (737–814), todas aceitas e lidas.

## Separação pedida

- Botão consultado pelo core: sim, nas quatro. O intervalo lido é o da tabela.
- Borda reconhecida pelo jogo: desconhecida. A observação é a leitura do joypad pelo core Libretro, não o reconhecimento dentro da rotina de pulo.
- Estado do personagem apto a saltar: desconhecido. Y permaneceu 944 na janela, e a flag de pulo não subiu. O documento do perfil diz que Y estável não prova apoio nem ausência de bloqueio. O byte de status não foi gravado.
- Efeito físico: ausente na janela. `vy` não foi para cima, a flag não passou de 0 e o ápice é 0.

A tentativa de 3 quadros e a de 4 quadros falharam as duas. A duração a mais, sozinha, não separa estas quatro das tentativas que saltaram.

## Preparação das tentativas seguintes

Fica a do adendo v4, definida antes de medir de novo: oito passos com o botão solto, flag 0, bit 1 de status limpo, Y igual nos últimos quatro desses passos, e o byte de status gravado. Uma repetição usa a mesma preparação. Não há espera alongada até o salto aparecer.
