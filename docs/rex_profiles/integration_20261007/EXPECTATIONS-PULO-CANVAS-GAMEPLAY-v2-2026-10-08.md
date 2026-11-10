# EXPECTATIONS v2 — prova causal da cópia do canvas (pulo) — 2026-10-08

Congelado ANTES da 2ª execução. **A v1 (`EXPECTATIONS-PULO-CANVAS-GAMEPLAY-2026-10-08.md`) não foi alterada.** Sua execução (binário `661e4351…`, relatório
`jump-gameplay-2026-10-08T12-40-40-251Z-report.json`) deu, no Sonic 1: G1 PASS, G4 PASS, **G2 FAIL** (imp isolado, segura +9 px; previsto ≥ 60) e **G3 FAIL** (cut isolado, segura +19 px; previsto |Δ| ≤ 6);
Delta: **tudo INCONCLUSIVE** porque o app recusou carregar a ROM (cabeçalho `SEGA GENESIS` não reconhecido para `.bin`; bug de produto, corrigido com teste).

## O que a v1 revelou (causa das falhas G2/G3, hipótese verificável)
No harness, "segura" = 700 ms de tecla, mas o original só sobe 75 px (não ~94): o botão é solto **antes do ápice** (a emulação sob Xvfb não chega a 60 fps), logo o corte atua e mascara o `imp`.
Os dados brutos da v1 (vyMin −1651→−2286 com `imp`) mostram que o impulso foi aplicado; o que falhou foi a previsão sobre o segurar, não a edição.

## Mudança v2 (apenas no protocolo, limiares G1–G7 idênticos aos da v1)
- "segura" passa a 2200 ms **e** só é válida se o `up` do botão ocorre depois do instante do ápice medido nas amostras (campos `t_apice_ms`, `t_soltar_ms`, `apiceComBotao`); senão a repetição é INVÁLIDA.
- Delta: pré-condição é o carregamento pelo carregador do app (corrigido o sniff do cabeçalho); falha de carga continua INCONCLUSIVE.
- As cópias são regeneradas pela jornada do canvas no binário final desta rodada e identificadas por SHA no novo manifesto.

## Critérios (inalterados)
G1 determinismo (original×original2×noop: |Δ| ≤ 6 px segura, ≤ 8 toque); G2 imp isolado segura ≥ +60, toque |Δ| ≤ 12; G3 cut isolado toque ≥ +30, segura |Δ| ≤ 6; G4 both segura ≥ +60 e toque ≥ +30;
G5 Delta: `a` reproduz G2–G4, `b`/`c` |Δ| ≤ 6 (segura) e ≤ 8 (toque) — nada se afirma sobre quem são b e c; G6 consumo 100% e ≥ 2/3 repetições válidas; G7 sprite mais alto no ápice (visual, rotulado).
Qualquer FAIL/INCONCLUSIVE é reportado como tal; domínios (representável × aceito × medido) e "não verificado em execução" (`cap`, `imps`, `impw`, `cutw`) como na v1.

## Adendo v2.1 (congelado antes da 3ª execução; ainda sem rodar)
A 2ª execução (binário `378d9fc1…`, relatório `jump-gameplay-2026-10-08T13-20-58-681Z-report.json`) carregou o Delta e mostrou, no toque, `imp`: vyMin −1651→−2286 só em `original/imp` e em `a-imp`, **sem mudança em `b` e `c`**; porém **nenhuma** repetição "segura" ficou válida:
o teste de validade comparava o relógio de parede do ack de soltar com o da amostra de RAM, e a emulação roda a ~17 fps com RAM defasada (o original segurando 2,2 s já sobe 94 px, o máximo sem corte). O teste era falho, não o jogo.
Correção: a validade passa a comparar **quadros renderizados** (quadro no ack de soltar ≥ quadro do ápice; campos `quadro_apice`, `quadro_soltar`). Limiares e demais critérios: inalterados. A 2ª execução permanece no histórico como INCONCLUSIVE no "segura".
Binário e cópias do canvas são os mesmos da 2ª execução (a mudança é só no script do harness, fora do binário).

## Adendo v2.2 (congelado 2026-10-09 antes da 4ª execução; ainda sem rodar)
A 3ª execução (binário `4adc0d41…`, cópias do canvas de `jump-canvas-2026-10-09T02-24-11-758Z`, relatório `jump-gameplay-2026-10-09T02-25-27-195Z-report.json`) terminou **allPass=false**: G1, G2, G3, G4, G6 (e G5 no Delta) reprovados/INCONCLUSIVE, sem reinterpretação.
Dados brutos: os ápices medidos são fisicamente coerentes (original 94 px; `imp` 166–182 px; `cut` 94 px no segurar; toque com `cut` +46/+47 px), mas muitas repetições "segura" foram invalidadas
(`quadro_soltar` 10–20 quadros abaixo de `quadro_apice`), em especial as de ápice alto (`imp`/`both`), de modo que `segura` ficou sem 2 repetições válidas. Esses números NÃO são resultado de G2/G4: são repetições inválidas pelas regras congeladas.
Causa provável (a verificar pela própria 4ª execução, não presumida): a granularidade de 10 quadros e a defasagem de leitura do ack/RAM são da ordem da margem entre soltar (2,2 s) e o ápice.
Mudança v2.2 (só protocolo): "segura" passa de 2200 ms a **5000 ms**, com a espera posterior ajustada; a regra de validade (`quadro_soltar ≥ quadro_apice`), os limiares G1–G7, o consumo de input e o critério de ≥ 2/3 repetições válidas ficam **idênticos**. Se ainda reprovar, reporta-se como tal.
A 3ª execução permanece no histórico como INCONCLUSIVE no "segura".
