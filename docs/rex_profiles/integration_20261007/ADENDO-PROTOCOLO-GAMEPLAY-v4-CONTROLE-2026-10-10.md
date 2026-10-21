# Missão 3 — protocolo v4, congelado antes da calibração

Base: c2c26b6562b62423ad7e2819cb37352f32111cb2. O resultado v3 permanece
REPROVADO (18/19; Delta G2 toque +13, teto 12). Não reagrupar seus resultados.

## Domínio e invariantes

Execução controlada por quadros do core, sem alegação sobre teclado em tempo
real. Aperto/soltura por WebDriver Actions nativas; avanço por clique nativo nos
controles existentes viewport-pause, viewport-step-frame e viewport-resume.
Nenhuma chamada de execução ou injeção de joypad pelo harness. Consultas técnicas
de RAM/observação são somente leitura. Original, original2, no-op e variantes
recebem procedimento idêntico. G1–G7 e todos os limiares do v3 permanecem fixos,
inclusive Delta G2 toque <=12. Nenhuma mediana mistura durações distintas.

## Calibração pré-registrada (uma sequência; não selecionar tentativas)

Na ROM original Sonic 1: alcançar a fase pelo procedimento existente, pausar
pelo botão e aguardar o término do trabalho já iniciado. Prazo máximo 10 s.
Registrar sessão, época, geração, frames_run, transições e RAM. Três observações
separadas por 100 ms devem ter identidade e contador iguais. Executar dois
cliques Step neutros, cada qual aguardando contador exatamente +1 e controle
novamente disponível; observar três vezes após cada conclusão. Não aceitar +2.

Para cada estímulo, nesta ordem fixa: toque 3, segura 120. Confirmar neutro,
avançar um quadro para leitura neutra, enviar KeyC keyDown nativo e aguardar
aceitação (10 s), conferir contador inalterado. Executar exatamente N cliques
Step, sequenciais, cada um com limite 10 s para conclusão e incremento +1.
Enviar KeyC keyUp nativo ainda pausado, aguardar aceitação (10 s), conferir
contador inalterado. Executar um Step solto e três leituras separadas por 100 ms.
Exigir mesma sessão/época, sequência e geração correlacionáveis, aperto
firstPolledFrame..lastPolledFrame de comprimento exatamente N, leitura da
soltura no quadro seguinte e ausência de quadros extras. Esta sequência mede
controle e diferencia durações; não mede elegibilidade para salto nem aprova G2.
Na primeira violação, registrar o prefixo inteiro, soltar nativamente em finally
e encerrar como falha; sem repetir dentro da mesma execução.

## Preparação e gameplay (dependem da calibração)

Não usar Y estável como prova de chão. Antes de jornadas completas, documentar
os campos de elegibilidade com fundamento no código/perfil do jogo; campos não
demonstrados ficam desconhecidos. A preparação terá quantidade fixa de quadros
e precondição medida, registradas em adendo antes de gameplay; não esperar
arbitrariamente até saltar. Neutralizar, provar leitura solta, verificar
precondição, apertar, avançar exatamente 3/120, soltar pausado, avançar um
quadro solto e observar salto por passos controlados. Registrar todas as
tentativas e eventuais lacunas. Duração errada reprova o controle experimental.

Depois de calibração verde e preparação congelada, executar duas jornadas
consecutivas no mesmo binário/protocolo, sem mudança intermediária. Ganho >12
continua falha semântica. Novo binário exige reiniciar o par e preservar o anterior.

## Falhas históricas e fechamento

As quatro tentativas sem salto serão analisadas separadamente: leitura pelo
core, borda reconhecida pelo jogo, elegibilidade e efeito físico não se confundem.
Ausência de campo suficiente mantém causa desconhecida. Segundo perfil semântico,
23 mutantes, regressões, gates e host:certify continuam obrigatórios após controle
estável. Sem push, merge, release, promoção, dependência nova ou alteração de
limiar/joypad. Um trabalho pesado por vez; logs exclusivos, saída real e hashes.
