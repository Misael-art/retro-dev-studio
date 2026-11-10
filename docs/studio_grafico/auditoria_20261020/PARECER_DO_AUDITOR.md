# Parecer do auditor — consolidado para esta passagem

## Escopo e método

Auditoria exploratória assistida por IA no binário retro-dev-studio-016, com SHA-256 d37779583a4cf25dbc7a4dc22200c48d7bed900fcd65d1ee79e573aa37b782b8. As jornadas foram percorridas em uma cópia privada do projeto demo, usando xdotool e capturas ImageMagick em Xvfb depois que a ferramenta Computer Use não conseguiu capturar a janela correta do aplicativo. Nenhum clique ou texto foi enviado por Computer Use; não houve participação humana.

## Parecer atual

As jornadas produziram evidência material de fluxos de navegação, edição limitada, validação e recuperação de erros. O conjunto não demonstra o ciclo canônico Build → ROM → Emulação: não houve ROM elegível, execução de jogo, resultado de input, validação de áudio/colisão, build bem-sucedido ou exportação. Por isso, o produto não pode ser considerado validado para esses resultados a partir desta auditoria.

O candidato mais forte é o estado de validação de J14: o valor 0 foi rejeitado e não persistiu, mas o aviso continuou visível depois da correção válida. Os três revisores independentes concordaram no estado observado e indicaram P2 para o impacto no fluxo. O seletor de paleta J06 mostrou rótulos indistinguíveis, sem troca em runtime; A/B/C indicaram P2 para o bloqueio/ambiguidade observados. A/B classificaram J04 e J12 como bloqueios P2 na tarefa observada; C preservou a ressalva de contexto e entrada ausentes. J13 e J11 são bloqueios — dependência oficial não preparada e entrada BYOR verificável ausente — sem causa atribuída ao produto.

## Cobertura

J00–J10 e J12–J15 foram experimentadas parcialmente; J11 foi bloqueada na etapa que depende de ROM. Nenhuma das 16 jornadas está concluída como ponta a ponta. As lacunas por jornada constam em [coverage.csv](coverage.csv), as evidências no [índice visual](gallery/index.html) e os eventos nos lotes congelados.

## Confiabilidade e limites

- LOT006 está pinado por SHA-256 e todos os arquivos passaram na verificação de integridade.
- O lote contém 40 imagens redigidas, eventos, inventário de entrada e snapshot final de J14. Revisores A/B/C verificaram o pin; o parecer C retirou por errata sua interpretação inicial da captura J05-018.
- A proveniência histórica de scenes/main.json antes de J03 e os deltas pré/pós J03 não podem ser reproduzidos somente com LOT006; o inventário incluído não enumera caminhos. A análise está detalhada em ERRATA_CADEIA_LOT006.md.
- A galeria contém 61 cartões, as 61 imagens carregam e os filtros blocked e J14 foram conferidos.
- Execução automatizada e exploração parcial limitam a inferência sobre usabilidade humana, causalidade de cliques, estado interno e reprodutibilidade fora da cópia testada.
- Nenhuma fonte do produto, dependência ou configuração global foi modificada. A cena privada foi reserializada durante J14; a igualdade byte a byte com o estado anterior não pode ser afirmada.

## Estado

Parecer final desta passagem exploratória; não significa cobertura ponta a ponta. As três revisões estão reconciliadas em [REVISOES_INDEPENDENTES.md](REVISOES_INDEPENDENTES.md). As lacunas de cadeia do lote estão em [ERRATA_CADEIA_LOT006.md](ERRATA_CADEIA_LOT006.md).

## Atualização parcial — checkpoints 10/11

As revisões LOT012 trouxeram uma divergência importante em J01: o grafo com input salvo e o mapa/source C do Build não correspondem. J02 permanece bloqueada no importador integral MUGEN observado; a rota separada de 76 comandos não substitui importação completa. Para J08, o ADDRESS ERROR foi repetido com hash `cf0c6631…`; um build posterior sobre outro snapshot produziu ROM `08888b…` sem esse erro, sem validar gameplay.

J03 avançou materialmente: Attack foi criado com dois frames, hitbox/duração foram persistidas e uma ROM foi gerada. O preview/emulador não demonstrou ataque jogável; runtime-link traz `occurrence_boxes={}` e o C gerado seleciona animação 0. A evidência sustenta a gravação e o build, não a causa da lacuna nem a semântica de jogo.

Runtime Setup foi reconciliado por condições: cache normal READY com Node/npm compatíveis e override DRIFTED com Node/npm incompatíveis, apesar de 7/7 instaladas em ambos; JDK Temurin 21 e SGDK 2.11 estavam presentes. A sequência temporal dos dois testes tem divergência e não será inferida.

LOT013 contém 96 imagens, 14 eventos, pré/pós snapshots e pin verificado; revisões independentes A/B/C concluídas e reconciliadas. Computer Use e avaliação humana continuam explicitamente fora do escopo comprovado. J01, J02, J03 e J08 não estão fechadas ponta a ponta; as demais jornadas também seguem parciais conforme coverage.csv.


## Reconciliação dos pareceres LOT013 — checkpoint 11

Os três pareceres independentes confirmam a integridade do pacote e o resultado parcial de J03. A sequência e a hitbox foram preservadas no projeto; o build produziu e carregou a ROM. Nenhuma revisão considera o golpe jogável demonstrado. O ACK de teclado não prova movimento. O runtime-link sem occurrence_boxes e a chamada inicial SPR_setAnim(..., 0) delimitam a lacuna observada, sem isolar causa.

R-B confirma que, neste estado 1280×800, resize/scroll foram necessários para encontrar partes da timeline/inspector e que GUIADO se distingue por uma rail de cinco etapas; CRIADOR/PRO/HACKER se parecem visualmente no recorte. C registra que o pacote não contém o binário auditado nem timestamps, logs brutos de input/foco/processo ou assinatura do pin. Assim, hashes internos e snapshots são verificáveis, mas aquisição, cronologia independente e repetição por terceiro permanecem limitadas.
