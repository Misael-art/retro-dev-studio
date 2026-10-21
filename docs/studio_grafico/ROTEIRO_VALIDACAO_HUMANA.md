# Roteiro curto de validação humana — Studio Gráfico Integrado (Experimental)

Status: **não executado**. Nenhum resultado humano foi registrado; inspeção técnica não certifica usabilidade.

Preparação (feita por quem conduz, não pelo participante): app do binário final, Ken BYOR em
`/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8`, um WAV curto qualquer, Sonic 1 BYOR para a tarefa 6.
Tela de pelo menos 1280×800. Não ajudar; anotar onde travou, quanto tempo levou e se pediu ajuda.

| # | Tarefa dada ao participante (sem dizer onde clicar) | Sucesso observável |
|---|---|---|
| 1 | Importe o lutador da pasta indicada e deixe só o 3º quadro do soco mais lento (6 ticks). | Personagem mostra o3 = 6, o1 inalterado |
| 2 | Volte para onde estava na cena e confira que nada mais mudou. | Cena com Ken selecionado e mesmo zoom |
| 3 | Faça o soco tocar o som fornecido no quadro em que o golpe acerta. | Evento na ocorrência com caixa de ataque |
| 4 | Crie um boneco de treino que perde 12 de vida por soco e mostre a vida na tela. | “Golpe autoral” + texto ligado; jogo mostra 88 após um soco |
| 5 | Teste: afaste o boneco só durante o teste e confirme que o projeto não mudou; depois decida se aplica. | Aviso de temporário; diff; desfazer funciona |
| 6 | Abra a ROM do Sonic, clique no cenário e em seguida abra a lógica que o app reconhece. | “Desconhecido” no clique; editor do perfil focado |
| 7 | Revise o projeto e exporte o jogo. | 0 erros; ROM exportada |

Registro por participante: perfil (iniciante/experiente), tempo por tarefa, ajudas pedidas, erros, comentário livre.

## Sessão preparada (rodada 3) — aguardando participante real

Situação: **preparada, não executada**. Nenhum participante participou; nenhuma tarefa abaixo tem resultado. O roteiro
acima não foi alterado.

Kit de quem conduz:
- Binário: `/home/misael/rds-scratch/studio-grafico-integrado-20261019/bin/retro-dev-studio-014`
  (SHA-256 no manifesto `data/studio_grafico/final-manifest-r3.json`; rodada 4: binário `retro-dev-studio-016` SHA `d37779583a4c…b782b8` — o 015 foi superado —, manifesto `data/studio_grafico/final-manifest-r4.json`; atalho local `~/Área de trabalho/retrodev-studio-grafico-experimental.desktop`, projeto `~/Documents/RetroDevProjects/Demo_Studio_Grafico_Paletas`). Rodar no display real do conduzente, não no Xvfb de QA.
- Entradas BYOR (fora do Git, não copiar para o participante): Ken `…/mugen-real-2026-09-30/source/ken8`; Sonic 1
  `…/rex_corpus_c/members/Sonic the Hedgehog (USA, Europe).bin`; um WAV curto qualquer.
- Pasta de projetos limpa para a sessão (por exemplo `~/Documents/RetroDevProjects/sessao-humana-<data>`), para não
  misturar com projetos de QA.
- Cronômetro; gravação de tela só com consentimento explícito do participante.
- Antes de começar: ler ao participante apenas o texto da coluna “Tarefa”; não indicar onde clicar; ajuda só se pedida
  (e anotada).

Registro (preencher só durante uma sessão real; deixar em branco se não houve):

| Participante (código, sem nome) | Perfil | Tarefa | Tempo | Ajudas pedidas | Erros/travamentos | Sucesso observável atingido? | Comentário |
|---|---|---|---|---|---|---|---|
| | | 1 | | | | | |
| | | 2 | | | | | |
| | | 3 | | | | | |
| | | 4 | | | | | |
| | | 5 | | | | | |
| | | 6 | | | | | |
| | | 7 | | | | | |

Depois da sessão: resultados vão para `MISSION.md` e para a coluna de limites do mapa; usabilidade só pode ser
declarada a partir de registros reais desta tabela.

## Tarefas adicionais da rodada 4 (paletas e composição) — não executadas

Mesmas regras de condução (sem indicar onde clicar; ajuda só se pedida). Preparação extra: uma imagem PNG de cenário
640×224 com até 15 cores (a da jornada `studio-paletas` serve; fica fora do Git).

| # | Tarefa dada ao participante | Sucesso observável |
|---|---|---|
| 8 | No projeto do Ken, coloque o cenário da imagem fornecida atrás dos personagens. | Tilemap 80×28 na cena; build mostra cenário, Ken e o texto com as cores certas |
| 9 | Descubra quais objetos usam a mesma paleta do Ken e abra um deles a partir dessa lista. | Abriu a entidade pelo uso (hover/foco/clique) sem procurar na Hierarquia |
| 10 | Faça só o boneco de treino piscar em vermelho quando levar o soco; o Ken não pode mudar de cor. | Variante local + paleta + comportamento de troca; no jogo só o boneco muda e volta |
| 11 | Mude uma cor do cenário, veja o que mais seria afetado, e depois volte às cores originais. | Viu o impacto antes de aplicar; voltou às cores do arquivo |

Registro adicional por tarefa: se o participante entendeu “banco” × “paleta”, se percebeu a faixa do HUD na cena e se
esperava que ocultar uma camada liberasse cor (não libera).

| Participante (código) | Perfil | Tarefa | Tempo | Ajudas | Erros/travamentos | Sucesso observável? | Comentário |
|---|---|---|---|---|---|---|---|
| | | 8 | | | | | |
| | | 9 | | | | | |
| | | 10 | | | | | |
| | | 11 | | | | | |
