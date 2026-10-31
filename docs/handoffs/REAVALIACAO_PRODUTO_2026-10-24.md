# Reavaliação da retomada — 2026-10-24

Esta é uma reconciliação documental e de código com inspeção de capturas históricas fornecidas, não uma nova sessão GUI, certificação ou estudo humano. Nenhuma fonte de produção foi alterada nesta avaliação.

## Base e correção do resumo anterior

- Remoto consultado: `recovery/studio-preformat-20261021` = `87b6b7fd5e3dacdd93eb30d5e25a9570d00ce769`.
- Worktree original: `REX-STUDIO-GRAFICO-2026-10-19`, HEAD `a8550af0e0bdd74c44478f94d301576b988747a1`; três handoffs não rastreados permanecem preservados. A pasta `/mnt/sdcard/Projects/RetroDevStudio` não é esse checkout Git.
- Auditoria atual: `studio-audit-20261020-01`, handoff checkpoint 16, coverage de 16 jornadas. Os hashes atuais de coverage, achados, handoff, backlog e sessão coincidem com o backup `project-data-v4`.
- O resumo de migração anterior ficou incompleto ao apresentar a auditoria como se não tivesse chegado a Build/ROM/emulação. LOT028 documenta edição, salvar/reabrir, Build & Run, verificação e exportação; LOT031 acrescenta execução da ROM e retorno ao editor. Isso não fecha as 16 jornadas nem estabelece causalidade do input por evento/frame. Corrigir os resumos por adendo datado, preservando os lotes.

## Capacidade e limite por frente

| Frente | Capacidade sustentada | Limite relevante à retomada |
|---|---|---|
| Host, SGDK/PVSnesLib, build e emulação | Pipeline e certificações históricos; J01/J08 possuem builds/executáveis/exportações observados | Ambiente reinstalado ainda precisa de diagnóstico/certificação; READY, artefato compilado, execução atual e teste de gameplay são estados distintos |
| Studio Gráfico | Cena, animação por ocorrência, caixas, texto, paletas, modelo/instância, inspeção e retorno têm provas técnicas delimitadas | Percurso exploratório permanece parcial, com navegação, densidade, mensagens e descoberta de ações a corrigir |
| MUGEN | Ken real possui fluxos técnicos anteriores; LOT025 comprova importar, editar, salvar/reabrir | Dois builds da configuração auditada falham em atlas de 177192960 px, acima da guarda de 67108864; causa deve ser isolada, não atribuída automaticamente ao hardware ou solucionada elevando o teto |
| Nodes e comportamento | Autoria/código/runtime e recuperação em classes delimitadas têm provas | LOT029 adicionou nós desconectados do fluxo original e não provou ataque; integrar edição, persistência, geração e efeito. Não converter uma prova pequena em conversão integral de CNS |
| REX gráfico/comercial | Edição/patch/reversão e episódios medidos em Sonic, Streets of Rage e Golden Axe sustentam capacidade além de um jogo | Perfis, regiões e episódios delimitados; LOT024 não observou efeito visual no recorte. Não é recuperação completa de jogo |
| A/B/C/D/F de pesquisa | Endereçamento, codecs, consumidores, CFG, instrumentos, holdouts e revisões são bases úteis; retificações melhoraram precisão | Compartilhar codec não identifica recurso, estrutura não prova consumo, amostras não provam universalidade; recuperar branches de pesquisa pelo bundle, sem merge automático |
| REA | Normalização/adaptação e reconstruções regionais demonstradas; pesquisa e ponte curada | REA pinado recusava raw M68000; backend compatível 68020 não equivale a qualificação exata 68000. Não há decompilação completa geral |
| Áudio | Há reprodução autoral testada e pesquisa estática de drivers | Extração/reconstrução de áudio comercial geral continua separada e não demonstrada |
| Outros importadores/plataformas | Há superfícies e matrizes no repositório | Não foram certificados novamente nesta revisão; não ampliam automaticamente a cobertura Mega Drive ou de outros destinos |
| UX e revisores A/B/C | Cobertura, imagens, pareceres e erratas preservados | Todos os 16 registros de cobertura continuam parciais; revisões do mesmo lote não são três execuções independentes ou testes humanos |

## Evidências que devem orientar a implementação

1. LOT028: ROM de 393216 bytes, SHA `ca0d321bdc17ed07da0956d14f37bbba3c8f439ca704d115165607b61e864b52`, build/export iguais; Review ainda mostra “ainda não executado”.
2. LOT025: atlas MUGEN bloqueado duas vezes. Investigar identidade dos insumos, escolhas de importação, normalização, dimensões/eixos, duplicação e empacotamento. Não descartar os sucessos anteriores nem mascarar este bloqueio.
3. LOT029/030: guards MUGEN impedem o percurso; parte deles antecede a edição observada. Não atribuir causa ao novo nó, paleta ou Java sem reprodução.
4. LOT031: deslocamento visual compatível com Right; ACK não prova consumo por frame e a soltura não está causalmente isolada.
5. LOT030/J14: UI dirty após Undo e disco anterior até Salvar não é, por si, corrupção; verificar o contrato e a clareza do estado. A mensagem stale do LOT006 continua um candidato separado.
6. REX LOT024: base preservada/cópia e BPS produzidos, sem efeito visual medido. Não rebaixar nem promover os episódios históricos independentes com base neste recorte.
7. A tabela antiga de requisitos tem limites superados por adendos. Ler a rodada 4 antes de declarar o antigo defeito PAL0 ou HUD como ainda existente.

## Base arquitetural já existente

`src/core/studioContext.ts` define tarefas, foco, ocorrência, evento, caixa, retorno e câmera, usando o `editorStore`. `editorStore.ts` já contém navegação contextual e histórico; existem também setters diretos que exigem inventário de uso antes de mudar contratos. `runtimeLink.ts` registra identidade da ROM, assets, ocorrências, caixas/eventos, epoch e quadro. `palettePlanStore.ts` e os serviços existentes devem ser reaproveitados.

Esses elementos são base de integração, não prova de que todas as rotas já os usam corretamente. Não criar outro megastore, pipeline de build ou editor paralelo.

## Direção

Executar uma frente sequencial de coesão do produto: reconciliar e reproduzir → fechar contexto/revisões/diagnóstico → entregar vertical autoral → corrigir e entregar vertical MUGEN real → simplificar apresentação e travessia de editores → regressões, vertical REX delimitada e observação humana. Fazer mudanças pequenas completas, sem uma reescrita geral ou outra rodada interminável de auditoria.

O prompt operacional está em `PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`, neste mesmo diretório.

---

## Adendo 2026-10-31 — diagnóstico de UX/UI para usuário leigo

### Parecer

A entrada pelo wizard é clara e o produto tem recursos úteis de navegação contextual, edição e revisão. A jornada completa ainda não oferece autonomia previsível a um usuário leigo. Os problemas principais são densidade visual, enquadramento, diferença entre os resultados dos importadores e distância entre a recuperação técnica de uma ROM e um projeto visual completamente editável. Acrescentar explicações extensas não resolve esses problemas de interação.

Este é um diagnóstico, sem implementação de correções e sem promoção de maturidade. Não substitui os checkpoints recentes por conclusões antigas: importação de imagens montadas, GIF53, builds e MUGEN têm avanços registrados. As 16 jornadas continuam parciais e este trabalho não constitui estudo com participantes humanos.

### Base, método e limites

- Checkout e remoto consultados: `da8ef6af53b66d539c2f48877ea8a92046123c70`, branch `codex/new-host-cohesion-20261024`, PR #112. O remoto coincidia com o checkout antes desta documentação. Há falhas preexistentes nos checks de CI; não foram investigadas nem atribuídas a esta avaliação.
- Host diagnosticado READY neste turno. Nenhum build, certificação, download, edição de código de produto ou jornada de ROM/emulação foi executado.
- Inspeção nova do aplicativo **Tauri real**, via WebKitWebDriver/Xvfb e launcher oficial, com configurações e projetos próprios em diretório isolado. Executável já entregue: SHA-256 `263205d8887a718b9eb7f020fadd3ed7c783b146c762df9fac06fd7386b5aa99`. Não é um build do HEAD atual.
- Foram examinados wizard inicial, modelos, importadores, preparação do projeto, Cena em Pro/Guiado, Lógica preenchida/vazia, Arte/animação, entrada do editor de pixels, revisão e console; janelas de **1280×800, 1366×768 e 949×593 pixels lógicos**. A menor reproduz a área útil registrada no host, mas a captura deste turno é virtual, não o painel físico/GPU.
- Wizard, NodeGraphEditor, nodeLayout, PixelEditor e CGraphPanel têm os mesmos hashes do manifesto do executável inspecionado. O shell, importador e outros arquivos mudaram desde então. A nova rota `RomDropDecompile`/REX foi **inspecionada no código**, não exercitada neste binário.
- Preservadas as alterações locais preexistentes. Elas incluem simplificação dos estados de build/hardware, resumo da importação e painéis de atenção contextual. São propostas relevantes para os achados abaixo, mas não receberam aceite visual nesta sessão. Não tratar a aparência do executável antigo como prova de falha dessas propostas.
- Computer Use consultou o estado/lista de janelas, mas a captura nativa do desktop falhou. O fallback foi a sessão Tauri isolada. Não houve interação com aplicativos ou projetos do operador.
- Projetos de QA foram preparados pelo IPC/API de automação existente; os seletores de arquivo não foram percorridos. A navegação subsequente usou os controles renderizados. A inserção de dois nós foi exercitada pelo evento de mouse da paleta. Não é teste de teclado, leitor de tela ou usabilidade humana.
- Evidência privada: `$RDS_WORK_ROOT/sessions/ux-ui-diagnosis-20261031/`, com imagens, receita, identidade, manifesto e cópias dos recibos. Sessão oficial principal `2026-10-31T19-52-12-697Z-226572`, encerrada normalmente; driver/display próprios encerrados. Retenção: operador, até aceite e proteção independente; não apagar evidências de terceiros.
- Capturas de carregamento e a chamada exploratória com workspace inválido foram preservadas como limitações do instrumento e **excluídas dos achados de produto**. Não usar a tela vazia transitória como defeito.

### Respostas às perguntas de produto

| Pergunta | Resultado sustentado |
| --- | --- |
| Um leigo distingue como começar? | O wizard tem cartões grandes, títulos claros, retorno e ações bem separados. A descrição MUGEN ainda expõe DEF/AIR/CMD/CNS/ST e o nome “Seu próximo jogo” trata também tarefas de abertura/inspeção. A entrada é a superfície mais clara examinada. |
| Cada editor mostra o próximo passo visualmente? | Parcial. O modo Guiado mostra Cenário → Personagem → Regras → Sons → Testar; Cena ↔ Arte ↔ Lógica conserva contexto. Barras, guias, metadados e painéis técnicos consomem espaço e frequentemente deixam o conteúdo principal abaixo ou fora do recorte. |
| SGDK chega organizado e compatível? | Há organização e conversão de recursos no subset. A nova importação do exemplo oficial `sample/basics/image` montou o logo em tilemap editável 30×12, uma camada e uma entidade. O projeto resultante continha `project.rds`, cena e imagem, com **zero nós/estados/transições/bridges**. O C original desenha duas versões do logo em posições e paletas diferentes; a cena importada não demonstra essa composição nem o programa original. |
| O código SGDK pode ser editado em nós? | Há também uma rota C nativa com parser, árvore/blocos e edição ligada ao build, com provas históricas no Memory Bank. É diferente do grafo autoral de alto nível e da importação genérica de recursos acima. Não foi reexecutada neste turno. Essas rotas precisam de apresentação coerente, sem prometer conversão integral automática. |
| Adicionar/editar um nó o revela e organiza imediatamente? | **Não em todas as rotas.** Na paleta, dois nós novos apareceram exatamente em `(200,200)`, sobrepostos. Há foco em algumas ações guiadas, mas a inserção simples não faz organização nem foco. Redimensionar mede a área, sem reenquadrar o comportamento. |
| Existe organização visual? | Sim. No modelo com 34 nós, “Organizar tudo” moveu 33 em 8 ms e informou zero sobreposições/conflitos; no teste de dois nós separou o segundo para `(476,200)`. É manual e preserva conexões/parâmetros. A visão geral resultante chegou a 35% e perdeu legibilidade; o limite mínimo de zoom também pode impedir enquadramento total. |
| O grafo explica onde começa? | Existem eventos, cores, portas, “Ir para Início”, minimapa e resumos. No modelo examinado há múltiplos eventos e conexões cruzadas; o primeiro recorte não oferece uma leitura simples de um comportamento. É necessário apresentar evento → condição → ação e os ramos no próprio desenho. |
| Importar ROM monta todo o projeto, assets e decisões? | **Não.** O código atual gera diretórios de recursos, manifestos, dados de remontagem e um esqueleto de funções/chamadas/referências em `rex/logic.json`. Explicita que o código do jogo não é convertido em C e que despacho indireto não é seguido. A conclusão oferece abrir a pasta de extração; não hidrata automaticamente um projeto `.rds` completo no editor. |
| Remontar a mesma ROM prova recuperação completa? | Não. O remontador também conserva bytes que não foram interpretados. Igualdade de SHA na remontagem sem edição demonstra conservação, sem provar lógica compreendida, editabilidade integral ou equivalência de gameplay após mudanças. A UI precisa refletir essa diferença. |
| Há importação de ROM no wizard? | Não. Seus caminhos são novo, modelo, abrir `.rds` e importar projeto. Os perfis exibidos não incluem ROM. A entrada por arraste fica fora desse mapa de início. |
| ZIP e 7z são aceitos nessa jornada? | Não no fluxo examinado no código. O arraste reconhece `.md/.bin/.gen/.smd`; ZIP/7z ficam fora do filtro. O identificador lê bytes do arquivo sem abrir contêiner. O seletor de emulação usa outra lista de extensões, sem `.smd`, gerando inconsistência adicional de descoberta. |

### Achados e critérios de melhoria

**UX01 — prioridade alta: inserir nós causa sobreposição.** Captura `25-added-nodes-overlap.png`: dois cartões diferentes compartilham retângulo `(456,430,232,144)` na tela e posição `(200,200)` no grafo. “Organizar tudo” corrige depois, mas exige que o usuário descubra a causa e o reparo. Owner: `NodeGraphEditor`/`nodeLayout`. Aceite: inserir sucessivamente nós, inclusive após pan/zoom, coloca o novo cartão numa área livre, seleciona-o e o revela; conexões e posições fixadas são conservadas; Undo funciona. A organização deve ser local por padrão, preservando o mapa mental, com visão geral por comportamentos.

**UX02 — prioridade alta: enquadramento e distribuição da área útil.** Capturas `07`, `10`–`15`: o modelo abre com zoom de cena 175%, áreas importantes fora do recorte e nós sobrepostos. Em 949×593, barras e laterais deixam uma faixa estreita para trabalhar. O enquadramento de 34 nós reduz o texto a miniaturas. Owners: shell, viewport e NodeGraphEditor. Aceite: primeiro acesso mostra o objeto/comportamento ativo inteiro e legível; resize preserva foco; laterais viram painéis recolhíveis quando necessário; a barra de ferramentas não cobre o início do fluxo; panorama e edição têm escalas distintas. Conferir no host físico com a escala real, além das três resoluções virtuais.

**UX03 — prioridade alta: tornar o resultado de importação previsível.** Capturas `19`/`20`, exemplo oficial e arquivos gerados: a imagem está montada, mas a estrutura lógica está vazia. O resumo técnico “0 estados / 0 transições / 0 nodes / 0 bridges” não diz, por si, o que se pode fazer agora. Owners: wizard, importador, diagnóstico e contexto existente. Aceite: apresentar visualmente recursos editáveis, composição recuperada, código original preservado, lógica editável e lacunas; selecionar um recurso representativo e oferecer uma ação útil. Se a composição é aproximada, mostrar isso junto ao resultado, sem depender de texto longo escondido. Não uniformizar artificialmente os contratos da rota C nativa e da rota de conversão.

**UX04 — prioridade alta: integrar a entrada de ROM e arquivos compactados.** Ausência confirmada no wizard e no filtro de arraste atual. Owners: wizard e reverse core existentes. Aceite proposto: entrada visível “Importar ROM”; mesma descoberta para seletor e arraste; ZIP/7z com escolha explícita quando houver mais de uma ROM, identidade do arquivo/membro, progresso por etapa, cancelamento, erro acionável e preservação do original. Após análise, abrir o conteúdo realmente recuperado no contexto do projeto. Arquivo inválido, protegido por senha ou fora dos limites precisa de uma saída clara. Isso é trabalho futuro, não suporte entregue.

**UX05 — prioridade alta: não apresentar esqueleto técnico como lógica recuperada completa.** Em `rex_sgdk_project`, funções e referências não se tornam automaticamente nós de decisão de gameplay. Owners: REX, `RomDropDecompile`, bridges e `studioContext` existentes. Aceite: distinguir reconhecido, editável, preservado sem interpretação e verificado no emulador; o estado desconhecido aparece no próprio diagrama. Contagens de funções, percentual atribuído e remontagem idêntica ficam como detalhes verificáveis. A passagem ROM → projeto → nó → mudança → resultado depende de prova própria por classe/perfil.

**UX06 — prioridade alta: ruído e significado das notificações.** No exemplo SGDK, o texto obtido na hidratação trouxe “Build com alerta: [SGDK Gerenciado] VRAM Analysis...” antes de qualquer build desta sessão. No modelo, paletas sem conflitos, validação de grafo 0/4 e revisão com dois avisos convivem em superfícies diferentes; medem coisas distintas, mas a apresentação exige interpretação técnica. A revisão usa cartão vermelho com cruz inclusive para **zero erros**. Owners: diagnóstico, Console, toolbar, revisão e plano de paletas existentes. Aceite: um estado principal ligado à tarefa; problema aponta diretamente ao objeto e à correção; separação visual entre informação, aviso e bloqueio; zero erros recebe aparência neutra/positiva. Falha persiste até ser tratada, progresso mostra etapa e término não se perde no console. O WIP de atenção/menus já aborda parte deste problema, ainda sem validação visual aqui.

**UX07 — prioridade média: contexto de edição de imagem ambíguo.** Capturas `16`/`18`: ao abrir Arte de Player, o recurso aparece em “Preparar e animar”; trocar para “Editor de pixels” mostrou `novo_sprite` vazio com o contexto Player ainda acima. As ferramentas nomeadas e as seis tarefas do editor de pixels são um avanço real. Owner: ArtStudio/PixelEditor. Aceite: mostrar, por miniatura e seleção, se a operação edita o recurso atual ou cria outro; disponibilizar uma ação direta para editar os quadros selecionados; carregar/enquadrar o desenho com preservação de frames, paleta e original. Não afirmar perda de pixels: o resultado observado é uma divergência de contexto percebido entre ferramentas.

**UX08 — prioridade média: legibilidade e consistência visual.** Capturas das telas examinadas: português mistura-se com Hierarchy, Inspector, Source Stage, Preview/output/apply, Bridge, Gap e termos internos. Há textos de 8–11 px, nomes truncados, muitos selos e cores pouco legíveis no tema claro. Owners: componentes/tokens existentes. Aceite: nomes orientados a ações e vocabulário consistente; informações técnicas em detalhes; controles essenciais maiores; foco visível, contraste medido, teclado e zoom exercitados. Cor deve reforçar forma/rótulo, sem ser o único sinal. Não há alegação de conformidade ou reprovação WCAG completa nesta revisão.

**UX09 — prioridade média: separar orientação de ocupação permanente.** O wizard demonstra boa hierarquia; o modo Guiado melhora a sequência. O editor repete rail, faixa de contexto, guia, barras, estados e metadados. A paleta global ocupa a abertura do Inspector antes de posição, aparência e comportamento. Owners: shell, Inspector e paletas existentes. Aceite: a seleção recebe o espaço principal e controles imediatos; visão global de paletas fica acessível sob demanda; uma ação principal por tarefa, ferramentas relacionadas agrupadas e retorno previsível. Não remover poder nem esconder bloqueios reais.

### Ordem proposta e aceite humano

1. Fechar a previsibilidade visual: inserção/foco/layout dos nós, enquadramento da cena e prioridades das notificações. Reutilizar as implementações existentes e verificar o WIP antes de duplicar trabalho.
2. Fechar a leitura da importação SGDK: conteúdo, composição, C nativo, grafo autoral, limites e próximo passo no mesmo contexto.
3. Integrar ROM/ZIP/7z à entrada e ao resultado do projeto, com cobertura honesta do recuperador. Não iniciar outro motor universal nem prometer reconstrução completa.
4. Reduzir densidade e consolidar linguagem/estilo, incluindo Arte e edição de imagem selecionada.
5. Observar participantes leigos com tarefas neutras: importar, localizar personagem/recurso, mudar aparência, alterar uma regra, salvar/reabrir, testar e resolver um erro; incluir arquivo compactado e recuperação de falha quando suportados. Registrar conclusão sem ajuda, primeira ação, erros, recuperação e confiança. Os critérios devem ser congelados antes da rodada; esta avaliação não mediu tempos ou taxa de sucesso humano.

O desenho deve permitir reconhecer onde se está, o que está selecionado, o que mudou e qual é a próxima ação. Texto curto pode nomear uma ação ou explicar uma consequência; não deve substituir seleção visível, hierarquia, organização espacial ou retorno de estado. Esta direção é coerente com as [heurísticas de usabilidade da NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/). Para controles pequenos, usar a referência de [alvos mínimos de 24×24 CSS px ou exceções de espaçamento da WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum); não confundir esse critério com um tamanho mínimo de fonte.

Próximo passo: implementar o primeiro lote delimitado acima e repetir a jornada afetada no aplicativo final, incluindo o desktop físico. A avaliação documental não fecha Build → ROM → Emulação nem comprova recuperação integral de jogos.
