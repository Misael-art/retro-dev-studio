# Diagnóstico de input — protocolo v2.2-ms — 2026-10-10

Não é a regressão. `allPass` ficou `null`. Não aprova `jump-gameplay-journey`.

- HEAD: `c2c26b6562b62423ad7e2819cb37352f32111cb2`
- Binário: `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25` (produto de `8814a910a1ef07f96b7d99d19f71b8f2235b584e`)
- Protocolo: `RDS_JUMP_PROTOCOL=v2.2-ms`, `RDS_JUMP_DIAGNOSTIC_TAPS=12`
- Estímulo: tecla nativa C por 60 ms na ROM original de cada jogo. Sem cópias, sem veredito G1–G7.
- Runner: `scripts/qa/run-sonic-desktop-isolated.py`, saída real **0**
- Relatório: `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-26-01-479Z-diagnostico.json`
- Log: `src-tauri/target-test/validation/missao3-2026-10-10/01-diagnostico-v22/`
- Xvfb isolado `5bfd315a…`, `system_display_modified=false`, display `:1`

## Contagens

| | Sonic 1 | Delta |
|---|---:|---:|
| Tentativas | 12 | 12 |
| Medidas (amostrador com ≥ 50 amostras) | 12 | 11 |
| Regra antiga confirmaria o aperto e a soltura | 8 | 10 |
| Backend aceitou aperto e soltura | 12 | 11 |
| Core leu o aperto | 11 | 11 |
| Perda só de observação (aceito, lido, regra antiga não confirma, e o jogo pulou) | 3 | 1 |
| Perda real (aceito, core nunca leu) | 1 | 0 |
| Jogo pulou (ápice > 0 e flag ≥ 1) | 11 | 11 |
| Pulou sem o core ler | 0 | 0 |
| Core leu e não pulou | 0 | 0 |
| Amostras sem foco | 0 | 0 |
| Recusas do backend | 0 | 0 |

Quadros emulados em que o core viu o botão apertado: Sonic 1 `[1,1,1,1,1,1,0,1,1,1,1,1]`; Delta, nas 11 medidas, `[1,1,1,1,1,1,2,1,1,1,1]`.

## Tentativa por tentativa

Etapas: (1) evento virou solicitação, (2) solicitação com sequência, (3) backend aceitou ou recusou, (4) core leu, (5) efeito no jogo, (6) a regra antiga perdeu a confirmação.

Sonic 1. Toques 2, 3, 4, 5, 6, 9, 11 e 12: etapas 1–5 ok (aceito, lido em 1 quadro, ápice 34, flag 1) e a regra antiga também confirmou. Toques 1, 8 e 10: etapas 1–5 ok e a regra antiga **não** confirmou — confirmação perdida só pelo observador antigo. Toque 7: aperto e soltura aceitos no mesmo quadro de aplicação `852`; o aperto ficou `never_polled`; soltura lida a partir do quadro `853`; ápice 0 e flag 0. Perda real. O jogo não pulou.

Delta. Toques 1, 3, 5, 6, 7, 8, 9, 10, 11 e 12: etapas 1–5 ok (ápice 34, exceto o toque 8 com ápice 41 e 2 quadros lidos) e a regra antiga confirmou. Toque 4: etapas 1–5 ok e a regra antiga não confirmou. Toque 2: o amostrador parou com 6 amostras, antes de ler o consumo. Etapas 1–5 **não observadas** nessa tentativa. Não entra como perda real nem como perda de observação.

Nenhuma transição registrada veio com `outcome` diferente de `accepted`. Cada medida que chegou ao consumo teve sessão e época próprias (`joypad-session-1`…`12` no Sonic 1, épocas 1…12; no Delta, sessões 13 e 15…24, épocas iguais ao número da sessão). Não houve recusa por época ou sessão obsoleta.

## O que foi medido e o que não foi

- Foco: medido. Zero amostras sem foco nas 23 medidas que chegaram ao consumo.
- Época/sessão: medida nas 23. Nenhuma recusa. A época sobe porque cada toque recarrega a ROM.
- Taxa de quadros: o contador renderizado avançou 30–50 quadros no Sonic 1 e 30–40 no Delta dentro da janela do amostrador (as pausas do harness são 700 ms antes, 60 ms de tecla e 2600 ms depois, mais o custo das leituras). Isso fica abaixo de 60 quadros/s. Não é um FPS certificado.
- Espera por mutex: a duração da espera **não foi observada**. O relatório não tem relógio entre o pedido e a aquisição do mutex. O toque 7 do Sonic 1 mostra as duas transições aplicadas no mesmo quadro, que é o sintoma da perda real já classificada, não uma medida de tempo de espera.

A instrumentação não segurou, enfileirou nem prolongou a tecla. O limite do produto permanece: um toque menor que um quadro pode ser aceito e nunca lido.
