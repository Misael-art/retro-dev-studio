# ADENDO v3 ao protocolo do `jump-gameplay-journey` — estímulo em quadros emulados e validade por consumo — 2026-10-10

Registrado ANTES de qualquer execução sob o protocolo novo. Não reescreve `EXPECTATIONS-PULO-CANVAS-GAMEPLAY-2026-10-08.md`, `…-v2-…` nem os adendos v2.1/v2.2. As execuções antigas ficam como estão, inclusive a reprovada `2026-10-10T00-05-41-931Z` (14/19).

## O que NÃO muda
- Critérios causais G1–G7 e todos os limiares (G1 ≤ 6/8 px; G2/G4 segura ≥ 60; G3/G4 toque ≥ 30; G5 ≤ 6/8; G6 ≥ 2 repetições válidas por modo).
- Teclado **nativo** (tecla C) pela superfície do aplicativo. **Nenhum input é injetado no core.**
- Controles `original`/`original2` e `noop`; 3 repetições por modo; UMA nova tentativa por repetição inválida (regra v2), agora com a 1ª tentativa registrada **inteira** (não só o motivo).
- Cópias: as do canvas, conferidas por SHA contra o manifesto.
- Sonda: RAM por `emulator_read_memory` (sonda técnica rotulada).

## O que muda, e por quê
1. **Validade de uma repetição** (antes: `lastJoypadAck` amostrado mostrava aperto e depois soltura). Agora: aperto e soltura **aceitos pelo backend** na sessão corrente (etapa 3) **e** aperto **lido pelo core** em ao menos um quadro (etapa 4), pela observação por sessão/sequência/quadro (`getInputConsumption`). Motivo: testes determinísticos mostraram que a regra antiga perde a observação do aperto (H1/H2 de `EXPECTATIONS-INPUT-…`) e que ACK de envio não é consumo. A regra antiga continua sendo calculada e gravada em cada repetição como `legado_consumido`, **sem decidir nada**.
2. **Estímulo** (antes: tecla por 60 ms no toque e 5000 ms no segurar — milissegundos de relógio de parede, com a emulação abaixo de 60 fps sob Xvfb). Agora, em **quadros emulados**:
   - **toque:** a tecla nativa fica apertada até o core ter lido o botão apertado em **3 quadros emulados**; então é solta;
   - **segura:** idem, **120 quadros emulados**.
   A espera é limitada (8 s / 40 s) e por condição observável; se esgotar, a repetição é registrada com `espera_esgotada` e a tecla é solta de qualquer forma. Motivo: um toque em milissegundos pode cair inteiro entre dois quadros (H3: perda REAL — o backend aceita e o core nunca lê). Em quadros, o estímulo passa a ser o mesmo independentemente da taxa de quadros do host.
   - 3 quadros ≈ 50 ms a 60 fps (o estímulo antigo era 60 ms); 120 quadros é mais que o dobro do tempo até o ápice de qualquer variante.
   - "Botão ainda apertado no ápice" (v2) continua **medido**: quadro renderizado em que a soltura apareceu aceita ≥ quadro do ápice.
3. **Registro:** cada repetição grava todas as transições novas (sequência, desfecho, geração, quadro de aplicação, primeiro/último quadro lido, ou "nunca lida"), a sessão, a época, amostras sem foco e o estímulo efetivo.

## O que este adendo NÃO autoriza
- Mudar o produto para prolongar, enfileirar ou reter teclas (latch): não foi feito. O produto continua aplicando cada transição quando ela chega; um toque menor que um quadro pode não ser visto pelo jogo — isso fica registrado como LIMITE do produto.
- Tratar a execução antiga como aprovada, ou comparar ápices do protocolo novo com os do antigo como se o estímulo fosse o mesmo (o "toque" passa a ter duração definida em quadros; os valores absolutos podem diferir dos históricos 34/94; os critérios são relativos ao `original` da mesma execução).

## Diagnóstico prévio com o estímulo antigo
Antes das execuções sob v3, uma rodada de **diagnóstico** (`RDS_JUMP_DIAGNOSTIC_TAPS`, `RDS_JUMP_PROTOCOL=v2.2-ms`) repete o toque de 60 ms na ROM original de cada jogo e conta, toque a toque: a regra antiga confirmaria? o backend aceitou? o core leu? o jogo pulou? Isso mede na jornada real quanto das faltas era perda de observação e quanto era perda real. Não é execução da regressão e não tem veredito.
