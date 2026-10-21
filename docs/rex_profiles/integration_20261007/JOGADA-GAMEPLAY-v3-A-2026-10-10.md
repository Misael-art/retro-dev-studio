# Jornada v3-a — `jump-gameplay-journey` — 2026-10-10

Missão em andamento. Esta corrida está completa e **reprovada**. Não é a segunda do par. O par não está fechado. Não houve repetição.

## Identidade

- Checkout: `/home/misael/Projects/REX-INTEGRATION-2026-10-05`
- HEAD: `c2c26b6562b62423ad7e2819cb37352f32111cb2`
- Binário: `src-tauri/target-test/release/retro-dev-studio`
- SHA-256: `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25`
- Commit de build do binário: `8814a910a1ef07f96b7d99d19f71b8f2235b584e` (o commit seguinte só muda o harness externo)
- Protocolo: `v3-quadros` (toque até 3 quadros lidos pelo core; segura até 120)
- Manifesto: `src-tauri/target-test/validation/jump-canvas-2026-10-10T03-47-04-502Z-copias/manifesto-copias.json`
- SHA-256 do manifesto: `d2312b9916a013ba9745305cb4970ab36f6a48743d00f82d5c622b723d5e3f5e`
- Início: `2026-10-10T00:48:48-03:00`. Fim: `2026-10-10T02:06:29-03:00`
- Saída real do runner: **1** (`03-gameplay-v3-a/exit_code.txt` e sidecar `run.json`)
- Relatório: `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-48-51-643Z-report.json`
- Esquema: `rex-jump-gameplay-journey/v1`. `protocolo.estimulo` = `v3-quadros`. `allPass` = false. `ausentes` vazio. `erro` nulo
- Capturas: `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-48-51-643Z-evidencia/` (85 arquivos)
- Sidecar: display `:1`, Xvfb/app/ROM com os SHA pinados, `system_display_modified: false`

Contagem do relatório: **18/19**. A única verificação falsa é `delta.G2_imp`.

## Veredito (mediana das repetições válidas)

| Jogo | Critério | Resultado | Medida |
|---|---|---|---|
| Sonic 1 | G6 | passa | nenhuma variante inconclusiva |
| Sonic 1 | G1 | passa | original2 e noop: segura 0, toque 0 |
| Sonic 1 | G2 | passa | segura +88, toque +7 |
| Sonic 1 | G3 | passa | toque +40, segura 0 |
| Sonic 1 | G4 | passa | segura +88, toque +50 |
| Delta | G6 | passa | nenhuma variante inconclusiva |
| Delta | G1 | passa | original2 segura 0 / toque 6; noop 0 / 0 |
| Delta | G2 | **reprova** | segura +88 (dentro); toque **+13** (limite \|Δ\| ≤ 12) |
| Delta | G3 | passa | toque +46, segura 0 |
| Delta | G4 | passa | segura +88, toque +56 |
| Delta | G5 | passa | b-imp segura 0 / toque 6; c-imp 0 / 0 |

Ápices medianos, em px. Sonic 1 original: toque 53, segura 94. `imp`: toque 60, segura 182. Delta original: toque 47, segura 94. `a-imp`: toque 60, segura 182. `vyMin` do toque com impulso é −2286; sem impulso, −1651. O impulso foi aplicado também no toque.

## Por que o toque do Delta passa de 12

O critério compara medianas. Os três toques válidos:

- Delta original, quadros lidos → ápice: 3→47, 4→53, 3→47. Mediana **47**.
- Delta `a-imp`: 3→52, 4→60, 4→60. Mediana **60**.
- 60 − 47 = **13**.

No mesmo relatório, a altura do toque sem impulso acompanha os quadros lidos: 3→47, 4→53, e um caso de 5 quadros no Sonic 1 `original2` → 59. Com impulso: 3→52, 4→60. Diferença no mesmo número de quadros: 52−47 = 5, ou 60−53 = 7, ambas dentro de 12. A mediana cruzou os dois degraus porque o original caiu duas vezes em 3 quadros e o `a-imp` caiu duas vezes em 4.

O estímulo pede a tecla até o core ter lido **pelo menos** 3 quadros e então solta. A soltura é assíncrona: nesta corrida o core leu 3, 4 ou 5 quadros. Isso está no relatório (`quadros_lidos_do_aperto`). Não é perda de input.

G1 do Delta continua dentro do limite: a mediana de `original2` no toque é 53, a 6 px da mediana 47 do `original` (teto 8).

## Input desta corrida

Todas as repetições que entraram na mediana foram aceitas pelo backend e lidas pelo core, com `legado_consumido` verdadeiro, foco preservado (`amostras_sem_foco` 0) e `parou: alvo atingido`. Toques lidos em 3 a 5 quadros. Seguras lidas em 120 ou 121 quadros. Nenhuma recusa, nenhum `never_polled`.

Quatro primeiras tentativas ficaram inválidas com motivo `sem salto` (ápice 0, `vyMin` 0, flag 0) **mesmo com** aperto e soltura aceitos e lidos (120 quadros nas seguras; 4 e 3 nos toques). A única repetição permitida foi válida e ficou gravada junto com a primeira:

- Sonic 1 `imp` segura, repetição 2, sessão `joypad-session-23`
- Sonic 1 `cut` toque, repetição 1, sessão `joypad-session-26`
- Delta `a-imp` segura, repetição 3, sessão `joypad-session-62`
- Delta `c-imp` toque, repetição 1, sessão `joypad-session-82`

Essas quatro não entram na conta do G2 do toque: os três toques de `a-imp` foram válidos na primeira tentativa.

## G7

As capturas do ápice existem. Na de `sonic1-both-segura` o sprite está mais próximo da borda superior do que na de `sonic1-original-segura`. A câmera não é a mesma: no original aparecem a cachoeira e as flores; no `both` o sprite corta a borda. Posição na tela não é a métrica. A RAM dessa segura é 182 px contra 94. Observação rotulada. Não desfaz o G2.

A captura do toque é a da primeira repetição válida, não a mediana: Delta original 47 px e `a-imp` 52 px.

## O que não foi feito

Não houve segunda corrida, não houve mudança de código nem de limiar, não houve binário novo. Abaixar o teto de 12, prender a soltura para sair sempre em 3 quadros, ou introduzir latch/fila/prolongamento ficaria fora do adendo já executado. O par só fecha com duas aprovações consecutivas no mesmo binário. Esta corrida impede esse fecho.
