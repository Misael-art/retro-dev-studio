# EXPECTATIONS — prova causal da cópia gerada pelo canvas (pulo, Sonic 1 e Sonic Delta) — 2026-10-08

Congelado ANTES de gerar as cópias da jornada final e de medir qualquer gameplay no app. **Honestidade de processo:** as
magnitudes abaixo vêm de medições anteriores no core por harness externo (1 quadro de toque) e da física do `JumpHeight`;
nunca foram medidas na superfície do app com teclado nativo. Os critérios são relativos (entre variantes, mesma entrada) e não mudam depois
de ver resultado (desvio = FAIL/INCONCLUSIVE com a saída bruta).

## Objeto da prova
Usar **exatamente** as cópias geradas pela jornada do canvas (`jump-canvas-journey`): cada cópia é identificada por SHA-256 no relatório
e a jornada de gameplay recusa executar se o arquivo em disco não tiver esse SHA. Nada de ROM patchada por script.

| Jogo | Instância (offset do pulo) | Cópias geradas pelo canvas |
|---|---|---|
| Sonic 1 (ROM pinada `c7da53a1…`) | `0x1340C` (única) | `s1-imp` (imp 1664→2304), `s1-cut` (cut −1024→−1536), `s1-both` (ambos) |
| Sonic Delta Reloaded (corpus local, hash registrado) | `a` = `0x16914`; `b` = `0x1732A`; `c` = `0x1A170` | `d-a-imp`, `d-a-cut`, `d-a-both`, `d-b-imp`, `d-c-imp` |

Controles (não são cópias do canvas): `original` (ROM base), `original2` (a MESMA ROM base carregada de novo) e `noop` (cópia byte a byte
da ROM base com outro nome; o produto recusa no-op, então o controle é uma cópia de arquivo, declarada como tal).

## Estado inicial e entrada (iguais em todas as variantes)
- Carregar a ROM pelo carregador do emulador do app (`loadRomForEmulation`, o mesmo de "Carregar ROM"); núcleo `genesis_plus_gx`.
- Chegar ao gameplay por teclado nativo: **Enter** (Start) repetido até o byte de modo do jogo em RAM (`$FFF600`) valer `0x0C` (nível), sem escrita em RAM. Esperar 3 s com Sonic parado no chão.
- Personagem observado: o controlado pelo jogador 1 (Sonic 1: Sonic; Delta: o **Sonic** da dupla Sonic+Tails; objeto do jogador 1 em `$FFB000` no Delta, `$FFD000` no Sonic 1).
- Entrada de pulo: tecla **C** (botão C do Mega Drive). **toque** = keyDown 60 ms → keyUp; **segura** = keyDown 700 ms → keyUp. Cada variante: 3 repetições, cada uma recarregando a ROM.
- Cada keyDown/keyUp exige confirmação de consumo: `lastJoypadAck.joypad.<botão>` com o valor esperado, mesmo `seq` da intenção e mesma sessão; senão a repetição é INVÁLIDA.

## Observações (sondas técnicas rotuladas)
RAM por `emulator_read_memory` (região de RAM de sistema) amostrada continuamente na página; posição Y do objeto do jogador, velocidade vertical, flag de pulo. Apice = (Y parado − menor Y). Cada repetição também guarda 3 capturas do canvas
do jogo (parado, apice, pouso) e o contador de quadros renderizados. A observação do sprite é visual sobre essas capturas (rotulada manual); a RAM é sonda técnica. Observação ≠ prova de consumo do jogo.

## Predições (relativas; mediana das 3 repetições)
| ID | Critério |
|---|---|
| G1 | **Determinismo**: `original` × `original2` e `original` × `noop`: |Δ apice| ≤ 6 px (segura) e ≤ 8 px (toque). Se falhar, o resto é INCONCLUSIVE (ruído do harness maior que o efeito). |
| G2 | `imp` isolado: apice **segura ≥ original + 60 px** (física: 0x900 vs 0x680 ⇒ ≈ +88 px); apice **toque**: |Δ| ≤ 12 px (o corte limita a velocidade ao soltar). |
| G3 | `cut` isolado: apice **toque ≥ original + 30 px** (física: v² de 0x600 vs 0x400 ⇒ ≈ +46 px); apice **segura**: |Δ| ≤ 6 px (segurar não aciona o corte). |
| G4 | `both`: segura ≥ original + 60 px **e** toque ≥ original + 30 px. |
| G5 | Delta: `a` (0x16914) reproduz G2–G4; **`b` e `c`**: |Δ apice| ≤ 6 px (segura) e ≤ 8 px (toque) em relação a `original` para o personagem observado. Isso sustenta “a instância `a` corresponde ao Sonic controlado”; **nada se afirma** sobre a quem pertencem `b` e `c`. |
| G6 | Consumo de input confirmado em 100% dos eventos das repetições válidas; ≥ 2 de 3 repetições válidas por variante. |
| G7 | Capturas: no apice da variante com maior apice o sprite aparece mais alto que no `original` (observação visual registrada, rotulada). |

## Recusas / INCONCLUSIVE
Repetição inválida: sem ack, sem alcançar `0x0C`, SHA do arquivo ≠ SHA do relatório da jornada do canvas, sessão de input diferente.
Variante com < 2 repetições válidas = INCONCLUSIVE (nunca PASS). G1 falho = tudo INCONCLUSIVE.

## Domínios (não confundir)
1. **Representável**: imediato de 16 bits com sinal (−32768..32767) e IPS.
2. **Aceito pelo perfil**: `imp/impw/imps` 1..32767; `cut/cutw/cap` −32767..−1.
3. **Medido em execução**: apenas `imp`=2304 e `cut`=−1536 (e os originais 1664 / −1024), nas variantes acima.
Nenhum valor é declarado “seguro em gameplay”. **Não verificados em execução**: `cap`, `imps`, `impw` (pulo submerso), `cutw`, e qualquer valor fora dos medidos.

## Limites declarados
Um personagem por jogo observado; fase GHZ, início; hardware real e outras fases não foram testados; o sprite é conferido visualmente por mim (não por um participante); sondas de RAM não provam semântica de jogo além do que mostram.
