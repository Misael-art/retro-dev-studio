# ADENDO v4 ao protocolo do `jump-gameplay-journey` — estímulo de exatamente N quadros do core — 2026-10-10

Registrado antes de qualquer execução sob este protocolo. Não reescreve as EXPECTATIONS, os adendos v2.1/v2.2, o adendo v3, nem o relatório `jump-gameplay-2026-10-10T03-48-51-643Z` (18/19, `delta.G2_imp` toque +13). Essa corrida permanece reprovada. Os ápices dela não são reagrupados por duração.

## Domínio

Execução controlada por quadros do core, com a interface pausada. Não é medida de teclado em tempo real e não é alegação de decompilação.

O contador que decide é `frames_run` da observação de input do backend (quadros emulados concluídos nesta carga). `data-rendered-frames` é contador de apresentação: a página só publica o valor a cada 10 apresentações. Ele é gravado e não decide.

## O que não muda

- Critérios G1–G7 e os limiares (G1 ≤ 6/8 px; G2/G4 segura ≥ 60; G3/G4 toque ≥ 30; G5 ≤ 6/8; G6 ≥ 2 repetições válidas por modo). G7 continua observação visual rotulada.
- Tecla nativa C. Nenhum `emulator_send_input` direto e nenhum substituto sintético do teclado.
- Avanço, pausa e retomada pelos controles `viewport-pause`, `viewport-step-frame` e `viewport-resume`, no clique real da interface.
- Controles `original` / `original2` e `noop`. Três repetições por modo. Uma nova tentativa quando a repetição é inválida, com a primeira gravada inteira.
- Cópias do canvas conferidas por SHA. Sonda de RAM por `emulator_read_memory`, rotulada.
- Validade de repetição do adendo v3: aperto e soltura aceitos na sessão corrente e aperto lido pelo core, com efeito medido. `legado_consumido` continua gravado e não decide.
- O produto não ganha latch, fila nem prolongamento de tecla.

## Estímulo

Identificador: `v4-quadros-exatos`.

Com o core já pausado e o contador estável:

1. O estado neutro (botão C solto) está aceito. Um avanço lê essa soltura.
2. A pré-condição abaixo está registrada. Se falhar, a tentativa é inválida e a preparação se repete uma vez, igual, sem espera extra.
3. A tecla C é pressionada nativamente. A aceitação chega com o contador parado e a transição ainda não lida (`pending`).
4. O controle de passo avança exatamente N quadros. Cada passo termina antes do próximo. N = 3 no toque e N = 120 na segura.
5. A tecla é solta com o core ainda pausado. A aceitação chega com o contador parado.
6. Um passo lê o estado solto. O último quadro em que o aperto foi lido é o quadro anterior a esse. Nenhum quadro extra corre com o botão apertado.
7. O restante do salto é observado em mais 180 passos, um a um, lendo Y, vy, flag e o byte de status depois de cada um.

Duração lida diferente de N é falha do controle experimental. Essa repetição não entra na mediana e não é substituída por outra de duração conveniente.

Os 180 passos de observação estão fixos antes de medir: cobrem a queda depois de uma segura cuja subida, no histórico, ocorreu dentro dos 120 quadros de botão. Não são um ajuste posterior.

Chegar ao nível (`gm = 0x0C`) continua pelo Start já usado na jornada. Isso não é o estímulo do pulo.

## Pré-condição para iniciar o estímulo

Gravada em toda tentativa, com geração, sessão, época e `frames_run`:

- `gm = 0x0C`;
- flag de pulo do objeto = 0 (Sonic 1: `$3C`, documentada como 0 no chão e zerada ao pousar; Delta: o campo `+0x40` que a jornada já trata como flag de pulo);
- bit 1 do status = 0 (Sonic 1 `+0x22`, Delta `+0x2A`). A confirmação dinâmica do projeto associa esse bit ao disparo do pulo. Estar limpo não prova apoio nem ausência de bloqueio. O byte inteiro é gravado;
- Y igual nos últimos 4 de 8 passos com o botão solto. Y estável não prova apoio.

Preparação de uma tentativa inválida: a mesma sequência, uma vez. Sem alongar a espera até aparecer um salto.

## Calibração do controle, antes de qualquer pulo

Uma execução curta, ROM original do Sonic 1, sem cópias e sem veredito G1–G7. Quantidades fixas:

1. Com o emulador já em execução (`frames_run` > 30), clique nativo em `viewport-pause`. Quando esse botão fica desabilitado, cinco leituras de `frames_run`, separadas por 200 ms, sem passo e sem retomada. As cinco são iguais. Esse valor é F0. A apresentação é anotada ao lado.
2. Tecla C para baixo, nativa. Em até 3 s a aceitação aparece, `frames_run` continua F0 e a transição está `pending`.
3. Tecla C para cima, nativa. Em até 3 s a aceitação aparece, `frames_run` continua F0, o aperto fica `never_polled` e a soltura fica `pending`.
4. Oito passos. Em cada um: leitura Fi; clique nativo em `viewport-step-frame`; espera o botão voltar a habilitado com o texto `Step 1 frame` (teto 5 s); duas leituras sem novo clique, a segunda 200 ms depois da primeira. As duas são Fi+1. A série inteira fica gravada. Um passo que não seja +1 encerra a calibração como falha de controle. Não se escolhe o passo que deu certo.
5. Tecla C para baixo outra vez, contador parado, transição `pending`.
6. Três passos, cada um +1 como no item 4. O aperto foi lido em exatamente 3 quadros (`last_polled - first_polled + 1 = 3`) e o contador avançou 3.
7. Tecla C para cima, ainda pausado. O contador não anda. O `last_polled` do aperto não muda. A soltura está `pending`.
8. Um passo, +1. Esse quadro lê a soltura. O aperto não ganha quadro novo.
9. Três leituras a cada 200 ms, sem clique. O contador permanece no valor do item 8.

Esta calibração não aprova G2.

## Distinção 3 contra 120

Só depois da calibração acima passar, no mesmo binário: uma segunda execução curta repete o bloco do aperto com N = 3 e, em seguida, com N = 120. Os dois intervalos lidos têm de ser exatamente esses valores e têm de ser diferentes entre si. Isso valida o procedimento. Não mede ápice e não aprova G2.

As duas jornadas completas só começam depois dessa distinção, no mesmo binário e no mesmo protocolo, sem mudança de código nem de critério entre elas.

## Se o controle não cumprir o contrato

A execução fica registrada com a série de contadores. A correção, se houver, é genérica no passo ou na pausa da interface, com teste que falha na duração errada e passa na duração de um quadro. Não se cria comando de Sonic nem de jornada. Correção de produto pede binário novo; as corridas anteriores permanecem; o par de jornadas recomeça nesse binário.

Não se abaixa o teto de 12 px e não se encurta o toque para obter aprovação. Se, com N = 3 exato, o ganho do toque passar de 12, G2 continua reprovado.
