# Prompt integral de implementação — UX R2/R3, autoria R5, Jogar R6 e ferramentas R7

Use este documento como instrução integral de execução. Ele reúne o pedido, os ajustes aceitos, os owners a integrar, as retenções técnicas e os critérios de entrega. Sua preparação foi documental; quando encaminhado ao agente implementador, a missão é executar a implementação completa e sua comprovação, não produzir outro plano ou somente documentação.

<a id="retomada-segura-2026-11-07"></a>
## Retomada segura — revisão de 2026-11-07 após interrupção do implementador

**Comece por esta seção. Continue a implementação existente; não reinicie o projeto nem reproduza a proposta simplificada rejeitada.** Esta atualização determina o ponto de retomada e corrige os snapshots antigos deste documento. O contrato integral e as especificações R2/R3/R5/R6/R7 abaixo continuam fazendo parte da missão. O pedido atual ao próximo implementador é corrigir, integrar, comprovar e completar toda essa cobertura, com autonomia para decisões reversíveis. O relatório de revisão, os limites da investigação e os aceites por achado estão na [jornada, revisão de retomada](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#revisao-retomada-2026-11-07).

### 1. Inventário e preservação antes de executar

- Checkout único `/home/misael/Projects/RetroDevStudio`, branch `codex/new-host-cohesion-20261024`, PR112. Revisão de entrada: `621020d06ec0dc2924b0e59e867f4a5c8e36c13d..5dbf28260e4a5a9b632890f679875d24bc408f02`, 27 commits, 42 arquivos, +2625/−64 linhas. **Reconfira os SHAs ao receber este prompt**; eles identificam o que foi revisado, não ordenam reset/checkout.
- Na entrada da revisão, remoto/PR estavam em `2781d672c3422ea614b036d6f0a6f76a9a142df7`; `5dbf2826` era um commit local adicional, com prova documentada e esclarecimento textual da prioridade. Preserve ambos. Não atribua os checks verdes de `2781d672` ao descendente. Confira no fechamento deste lote o SHA efetivamente publicado, em vez de repetir este snapshot.
- Única alteração sem commit encontrada: `AGENTS.md`, do operador. Hash do diff: `df9dcc256d570ec2359413ef8ece6eac0b8a7b047916b842fed69ef994e5af95`. Não incluir esse arquivo no stage, substituir ou desfazer. Reconfira mudanças posteriores e processos/owners antes de escrever; sessão anterior sem `SessionEnd` não prova que o processo morreu.
- Histórico de implementação: `RDS_WORK_ROOT/sessions/ux-r3-20261105/`, incluindo `evidence/`, `preserved-20261107-1151/` e `git-corruption-backup-20261107/`. Revisão: `RDS_WORK_ROOT/sessions/ux-continuation-review-20261107/`. Fontes no Git; evidências/fixtures/ROMs ficam privadas nos destinos oficiais. Não usar um projeto do operador como fixture.
- Após reboot ou interrupção: inventariar árvore, refs, último commit local/remoto, recibos terminais, PIDs e leases; preservar patch/arquivos próprios úteis e hashes no runtime; verificar objetos Git alcançáveis antes de trabalho pesado. Houve objeto Git vazio no incidente anterior. Arquivo `.promisor` de tamanho zero é normal e não deve ser removido como corrupção. Não apagar evidências, fazer reset destrutivo, limpar caches compartilhados ou criar checkout paralelo.
- Confirmar o checkpoint revisado no remoto antes de novo build pesado. Um teste falho não vira PASS para permitir publicação: preservar a proposta com a falha explicitada e sem promoção de maturidade. Manter um escritor e uma operação pesada por vez.

### 2. Proteção do host obrigatória

O operador relatou travamentos/reinícios e depois confirmou **um núcleo**. O build coincidiu com pressão; sua causalidade no reboot **não foi demonstrada**. A receita histórica de dois núcleos não é o padrão desta retomada.

1. Antes de cada build, suíte longa ou jornada com emulador, medir CPU real, RAM disponível, swap entrando/saindo, PSI de memória/I/O, espaço em runtime/cache/temporários e concorrentes. Exigir pelo menos 5 GiB disponíveis e margem para o pico previsto; esse piso não garante sozinho segurança. Não usar somente load average: o Rust com afinidade em um núcleo pode aumentar a fila sem consumir toda a CPU. Pressão sustentada ou desktop degradado exigem esperar/reduzir o lote e medir novamente.
2. Usar launcher oficial, caches/locks existentes e `RDS_BUILD_JOBS=1`, `CARGO_BUILD_JOBS=1`, `GOMAXPROCS=1`, `UV_THREADPOOL_SIZE=1`. Conter toda a árvore da operação em scope próprio com `MemoryMax=3500M`, `MemorySwapMax=0`, afinidade em **um CPU permitido** (`taskset -c 0` foi o usado neste host), `nice -n 19` e `ionice -c3`. Verificar o limite efetivo nos descendentes; `jobs=1` sozinho não limita bundler/linker/WebKit. Não aumentar teto/núcleos automaticamente após OOM.
3. Testes sequenciais: Vitest `--maxWorkers=1`; Rust `--test-threads=1`. Não sobrepor build, Clippy, suíte, emulação e atualização do sistema. Uma instância Tauri/core de QA por vez. Medir durante a execução em intervalos curtos; pausas não devem impedir comunicação por mais de 60 s. Encerrar somente processos temporários próprios, identificados e seguros para interromper.
4. Temporários grandes no runtime oficial em disco. `/tmp` é tmpfs neste host e consome RAM; não deslocar link/build para lá. Reservar espaço antes, conservar logs e recibos, não fazer limpeza ampla para obter PASS.
5. `host:diagnose` deu READY nesta revisão, mas a abertura pelo launcher no runtime global foi recusada por `development_lock_unreadable`: `RDS_WORK_ROOT/development-operation.lock` tem zero bytes desde 2026-11-04. A trava foi preservada, conforme a retenção anterior do Memory Bank. Antes de recuperar, correlacionar owner, boot, processos e recibos pelo protocolo existente; não apagar a trava nem trocar o runtime só para contorná-la. Se a decisão do owner continuar necessária, registrar a dependência específica e avançar no trabalho independente. Esta revisão não iniciou Tauri nem nova compilação do app.

### 3. O que conservar e o que ainda falta

Preserve as integrações existentes: escopo/proveniência e conversão de nós; isolamento derivado; locks; metadados de unidades; lista de transições; abrir cena separado da entrada do jogo; teste transitório de outra cena; trajetos no modelo/Canvas/AST/C; retas, curvas quadráticas, elipses, alças, nós iniciar/parar; plataforma móvel inicial; planos A/B e prioridade por tilemap. São incrementos **parciais/Experimental**. A prévia de paralaxe por câmera já existia: integrar e verificar, não reescrever.

Não dar como entregues: barra integrada das novas ferramentas; reversibilidade completa R3; oclusão por região; paletas por perfil e troca rápida integrada; distorção por pincel; Fantasma; experiência Jogar com cadência medida, filmstrip, pins e momentos; sete famílias VIS07; integração VIS08. O inventário VIS01 existe, mas está desatualizado após os trajetos/planos. R3-06 tem lista parcial de transições, sem mapa visual completo nem execução de `load_scene`.

**Decisão posterior do operador a preservar:** `load_scene` permanece rotulado como sem execução na ROM; não implementar transição runtime nem bloquear importações GML por esse nó sem reabrir essa decisão. “Jogar desde o início” deve respeitar o que o runtime realmente suporta. Abrir uma cena não altera `entry_scene`; teste transitório também não. Não confundir início espacial de teste com save state compatível capturado durante execução.

### 4. Correções prioritárias antes da expansão

Concluir os achados RC01–RC12 da jornada. Prioridade funcional:

- **RC04:** parar/retomar trajeto no meio do segmento deve conservar posição e fase; iniciar após terminar, reiniciar e pausar precisam de semântica explícita, sem salto implícito. Reproduzir com o C realmente emitido e em ROM. O controle anterior que apenas contava posições distintas é insuficiente.
- **RC03:** mudança de repetição deve produzir modelo válido, preservar geometria/intenção e admitir Undo. O trajeto padrão tem retorno zero e fica inválido ao trocar diretamente para loop; elipse mantém curva no ponto 0 e fica inválida ao trocar para ida e volta. Gerar elipse hoje também perde `autostart=false`, ligando movimento automático silenciosamente. Preservar propriedades não geométricas e tratar valores inválidos com feedback antes da mutação.
- **RC05:** validar planos efetivos, incluindo combinações automático/explícito. Hoje a recusa só compara escolhas explícitas; dois tilemaps podem acabar no mesmo plano. Corrigir UI/validação/emissão por um contrato consistente e provar o negativo, preservando cenas legadas.
- **RC06/07:** prioridade de sprite deve ser escolha legível e válida, com relação visual de oclusão; lock de editor precisa de identidade projeto+cena+objeto, sem vazar entre dois projetos com `scenes/main.json` e IDs iguais.
- **RC08/09:** agrupar edição numérica em transação, limpar rascunho ao trocar objeto/cena, fechar cancelamento/drag/foco/Undo e resolver fidelidade da plataforma móvel em deslocamentos verticais, bordas e velocidades variadas. Não reduzir teste ao caso lento horizontal que já passou.
- **RC02/10:** corrigir agregação de testes e alcance por plataforma antes de dizer que a superfície funciona. A suíte Rust histórica teve falha BYOR; os novos controles aparecem sem bloquear antecipadamente todos os alvos incompatíveis. Perfis precisam orientar disponibilidade e motivo, não deixar o usuário descobrir apenas ao construir.

### 5. Barra de ferramentas: entrega central desta retomada

**Autoria visual deve começar no Canvas.** Existe uma barra em `ViewportPanel`, mas suas modalidades são selecionar/pintar/apagar/colisão. Trajetos/planos recentes foram acrescentados majoritariamente ao Inspector. Não resolver isso apenas com um botão que manda o usuário procurar um campo em outro painel.

- Conservar navegação global esquerda, faixa horizontal contextual e painéis ajustáveis. A barra de ferramentas de autoria fica acessível junto ao Canvas; não substitui a navegação. Agrupar seleção/transformação, trajetos, composição/planos, pintura/colisão, câmera e efeitos com ícone, nome, estado e atalho; expandir opções por contexto sem esconder a capacidade. A posição exata segue a linguagem existente e a área útil, não a cópia literal do mockup.
- Selecionar um objeto → ativar Trajeto → desenhar/editar no Canvas, com alças, inserir/remover ponto e opções reta/curva/elipse no contexto. Mover objeto e editar trajeto são intenções distinguíveis. Parâmetros numéricos permanecem disponíveis e sincronizados com `components.path`, histórico e persistência existentes.
- Planos/isolamento/paralaxe e prioridade devem ter acesso contextual direto, prévia de quem fica à frente e indicação de alcance. Seleção de região será reutilizada por oclusão/distorção/Fantasma, com máscara solicitada versus alcance real do alvo. O Inspector detalha a mesma operação; não é passagem obrigatória para iniciá-la.
- Paletas: abrir recurso usado pela seleção, expandir PAL0–3 no MD, alternar rapidamente sem modificar por navegação e distinguir atribuição, variantes e troca em runtime. Jogar permanece secundário, com início/cena/pin/momento claramente separados; filmstrip acionável por clique e teclado, sem depender de hover.
- Reutilizar `editorStore`, `studioContext`, handlers/serviços e owners oficiais. Uma ação deve ter o mesmo efeito pela barra, atalho ou menu contextual; não criar outra store de autoria, modelo de trajeto, planner ou pipeline. Estado efêmero da ferramenta não duplica dados persistentes.
- Aceite de acesso: com o objeto selecionado, iniciar a ferramenta por um controle visível, ou no máximo dois acionamentos em grupo nomeado, **sem trocar de workspace nem rolar o Inspector**. Criar/ajustar trajetória, mudar plano/isolamento e acessar paleta conservam seleção e enquadramento. Para relações lógicas avançadas, abrir o grafo já focado na origem e retornar ao mesmo contexto.
- Aceite visual: 1366×768 e 949×593, temas claro/escuro, nomes longos e cenas densas. Controles frequentes não somem por overflow, ícones têm nome acessível, estado ativo é inequívoco e Esc tem contrato previsível. Não diminuir tipografia para caber nem fazer tooltip/hover ser a única forma de descobrir ação/lock. Medir contraste real (texto normal ≥4,5:1), foco, teclado e ausência de sobreposição; rever as capturas antes de aprovar.
- Aceite de uso repetido: pelo menos dez ciclos selecionar → ativar → manipular → conferir número → desfazer/refazer → trocar objeto → voltar; salvar/fechar/reabrir ao final. Registrar tentativas, mudanças de painel e passos antes/depois por tarefa. Captura bonita isolada não comprova produtividade ou ausência de regressão.

### 6. Sequência, provas e término

**A:** recuperar continuidade, preservar/publicar checkpoint revisado e reconciliar bloqueios/gates. **B:** corrigir defeitos funcionais/reversibilidade e disponibilidade. **C:** integrar as ferramentas já existentes à barra e comprovar a jornada; não adiar toda a ergonomia até o fim. **D:** completar, em fatias verticais, R3/R5, PLAY01–06 e VIS01–08, inclusive os sete complementos VIS07; toda ferramenta nova já nasce com acesso coerente no Canvas. **E:** composição, uso repetido, desempenho e gates finais. Ajustar ordem por dependências demonstradas, sem omitir itens nem encerrar por ter fechado um lote.

Cada fatia fecha ação real → dados/histórico → persistência → nó/configuração → código → ROM/core → efeito observado, conforme aplicável. Tests de unidade cobrem casos negativos reais; Tauri comprova gesto/layout; ROM/core comprova semântica. Medir FPS/cadência/audio/input em sessão própria identificada; não usar uma sessão artificialmente limitada por CPU como benchmark conclusivo nem remover a proteção para melhorar números. Se o teto impedir certificar desempenho, registrar essa limitação e preparar a medição no ambiente adequado.

Executar os gates aplicáveis da seção própria e de AGENTS: árvore, lint, TypeScript, frontend, Clippy, Rust, fmt, `host:certify` após build/emulação e auditorias quando dependências/segurança mudarem. Preservar exit code de cada etapa (`pipefail`/recibo individual); um `tail`, filtro de log ou último comando bem-sucedido não pode mascarar `cargo test` falho. Reexecutar focalmente após corrigir; ampliar para a suíte exigida quando houver margem. Nunca omitir testes, mudar oráculo ou baixar ROM para fabricar PASS.

Manter matriz requisito → owner → estado → SHA/binário/ROM/core → prova → limite/próximo passo. Reconciliar Memory Bank, roadmap e jornada em cada marco. Commit/push explícitos na branch/PR atuais, conferir SHA remoto e checks desse SHA. Não mergear, lançar release ou promover Experimental por esta missão. Trabalhar autonomamente até a cobertura completa; bloqueio externo real retém apenas a parte dependente e exige informação precisa, sem perguntas rotineiras. Se houver interrupção por recursos/créditos, deixar checkpoint recuperável, testes reais e próximo comando, sem declarar conclusão integral.

<a id="contrato-execucao-integral"></a>
## Contrato de execução integral — pedido do operador em 2026-11-06

**Execute do início ao fim todos os requisitos abaixo e os detalhes vinculados da jornada R2/R3/R5/R6/R7.** O projeto é para jogos de grande complexidade, alta performance, gráficos e mecânicas ricos, com ferramentas modernas, amigáveis, flexíveis e robustas. Organize a complexidade com hierarquia/contexto; preserve funções, precisão, liberdade criativa e acesso. Os mockups orientam princípios e relações, não delimitam capacidades nem devem ser copiados literalmente quando omitem ferramentas.

### Autonomia, continuidade e escopo

1. O recebimento deste prompt como tarefa de implementação autoriza investigar, editar, integrar, migrar de forma compatível, testar, executar o aplicativo, corrigir e publicar os incrementos revisáveis conforme as regras atuais do projeto. Não perguntar se pode iniciar, continuar, editar, testar ou passar ao próximo lote. Decidir escolhas reversíveis pelo código, documentação oficial, evidência e premissas aqui definidas.
2. Lotes são unidades de revisão e continuidade, não entregas finais isoladas. Ao fechar um lote, registrar evidências e seguir automaticamente para o próximo requisito necessário. Priorizar significa ordenar o trabalho, não omitir partes. Não encerrar a missão com plano, scaffold, primeira fatia, catálogo de botões ou lista de tarefas transferida de volta ao operador.
3. Este contrato incorpora também as sete famílias complementares de VIS07 ao escopo de execução: seleção/transformação, carimbos/terrenos, colisão/gatilhos, timeline integrada, câmera visual, animação de paleta/atmosfera e mapa de custos/otimização assistida. Reaproveitar o que já existe e completar cada jornada especificada, sem reimplementar ferramentas prontas ou inventar novos requisitos sem relação com o pedido.
4. O foco de execução é o caminho autoral Mega Drive/SGDK e a integração com as capacidades SNES já no roadmap; declarar e provar suporte por alvo/modo. Para Master System/PC Engine, o escopo registrado é preparação extensível dos contratos/perfis e da interface, sem iniciar toolchain, core ou plataforma futura não autorizada pelo roadmap. O editor textual EC01–EC06 completo e um novo motor universal não fazem parte desta missão; preservar as integrações de origem/código já previstas.
5. Identificar dependências e concluir as necessárias dentro dos owners/pipeline oficiais. Ausência atual de API, nó, contrato ou teste é trabalho de implementação, não motivo automático para devolver a tarefa. Reconciliação com hardening, locks e outros escritores é coordenação operacional; não tratar a extensão do pedido ou a dificuldade como necessidade de reconfirmar a intenção do usuário.
6. Se um bloqueio externo real impedir um ramo — acesso indispensável, corpus BYOR inexistente, host/OS indisponível ou decisão arquitetural fora do escopo — registrar requisito afetado, evidência, tentativas, dependência exata e próxima ação mínima. Continuar todo trabalho independente. Solicitar uma única ação específica somente quando indispensável; não repetir pedido já pendente nem pedir credenciais no chat. Respeitar aprovações obrigatórias e não contornar controles para cumprir autonomia.
7. Não fingir conclusão de item bloqueado ou tecnicamente impossível no alvo. Investigar técnica compatível, medir e integrar quando viável; preservar a intenção e expor o limite se não houver solução demonstrada. Um badge Experimental, botão desabilitado ou texto explicativo não conclui um recurso exigido como funcional. Capacidade futura explicitamente limitada ao contrato deve ser avaliada como contrato, não como runtime entregue.
8. Manter atualizações curtas de descobertas, bloqueios e resultados, sem transformar cada lote em pergunta ou resposta final. Se houver limite de contexto/interrupção da ferramenta, salvar checkpoint com SHA, requisitos/provas/pendências e próxima ação; retomar dele quando a execução continuar. Não marcar como concluído por limite de sessão ou tempo. Encerrar normalmente apenas após atender a definição global de entrega.

As notas históricas deste documento sobre preparação documental, propostas e implementação pendente descrevem a linha de base; não são instrução para o agente implementador parar no registro. As proteções de dados, limites físicos, gates e restrições explícitas de plataformas futuras continuam válidos.

### Cobertura obrigatória, sem itens implícitos

Antes de editar, criar a matriz de acompanhamento na seção de implementação da jornada existente, sem outro diário concorrente. Para cada requisito/subitem registrar: ID, comportamento esperado, owner, dependências, estado, teste, captura/recibo e limite. Usar estados verificáveis: a fazer, em implementação, integrado, validado, bloqueado externo. Nenhum grupo agregado recebe validado enquanto houver subitem exigido sem prova.

| Grupo | Cobertura mínima que deve ser rastreada |
|---|---|
| R2/R3-01…10 | Navegação, seleção/gestos, árvore única, painéis/contexto, escopo por bloco/grafo, isolamento derivado, nós gerados/manuais, unidades/input, mapa/IDs, cabeçalho, locks, início de teste e coerência documental. Conservar T1–T6. |
| R5 / autoria | Qualquer objeto compatível; gestos e números; retas, curvas/alças e elipses, tempo/velocidade/esperas, único/loop/ida e volta; gatilhos reais; física/colisão; planos A/B, sprites/prioridades, isolamento e paralaxe visual. |
| PLAY01–06 | Cadência nativa; Jogar/Inspecionar; início, cena inteira, pins autorais e momentos capturados; miniaturas por cena/tipo, persistência/compatibilidade, cancelamento, áudio/input, retorno ao editor e medições. |
| VIS01–06 | Conservação de capacidades, perfis, paletas completas/troca rápida/impacto, seleção e oclusão, mesmos dados no grafo/código, distorção pintada/modulada e Fantasma por técnica comprovada. |
| VIS07 | Cada uma das sete famílias complementares, com jornada concreta e parâmetros/limites da R7; não considerar concluído por ter apenas criado o acesso. |
| VIS08 / qualidade transversal | Composição dos recursos, migração, histórico, persistência, erros, acessibilidade, qualidade visual, desempenho, provas reais por alvo e ausência de regressão de capacidade. |

### Ordem integrada de execução

**A. Contexto e contratos:** ler fontes canônicas, preservar WIP, obter host READY, inventariar capacidades e matriz; confirmar owners, preparar fixtures e baseline de imagem/tempo/recursos. Definir contratos de origem/escopo/máscaras, tempos, início de jogo e serialização. Resolver T1–T6 e VIS01/VIS04 conforme dependência, sem implementar uma segunda arquitetura.

**B. Base de interação e reversibilidade:** concluir R2/R3 de contexto, seleção, painéis, árvore, locks, unidades, paletas/impacto, histórico e save/reopen. Fechar caminhos entre Canvas/Arte/Comportamento/Nós sem perder seleção ou precisão.

**C. Autoria visual real:** concluir trajetos R5, planos/paralaxe, paletas VIS02, seleção/oclusão VIS03, ligação semântica VIS04, pincéis VIS05 e Fantasma VIS06. Implementar modelo, UI, validação, compilação e runtime de cada fatia antes de avançar sua classificação. Integrar as ferramentas VIS07 aos mesmos owners e regressões.

**D. Experiência de jogo:** executar PLAY01–PLAY06 e R3-09/T6, medindo loop/custos desde o baseline; o controle serial/cadência pode ser antecipado quando necessário às provas de C. Não aguardar o fim de toda a UI para descobrir que a ROM não expressa a intenção. Validar execução real ao longo de todas as fatias.

**E. Integração e acabamento:** exercitar cena combinada, refinar qualidade visual e ergonomia, executar gates finais, jornada Tauri completa, medições, reabertura/export e revisão de conservação. Fechar documentação, commits/push e recibos. Ajustar a ordem por dependências demonstradas, preservando a cobertura integral.

### Barra de qualidade visual e funcional

- Preparar critérios observáveis de hierarquia, tipografia legível, espaçamento, densidade, alinhamento, contraste e consistência com a linguagem do projeto. Não reduzir tamanho de fonte para disfarçar layout apertado. Cor, ícone, texto, foco e estado selecionado têm papéis consistentes; nenhum estado depende só de cor ou hover.
- Depois de cada mudança relevante, capturar a UI Tauri real em 1366×768 e 949×593 com escala registrada. Inspecionar as imagens, corrigir recortes, sobreposições, áreas vazias injustificadas, controle escondido, texto ilegível, perda de foco e competição visual. Captura sem revisão/correção não é aprovação visual. Comparar com as premissas R5/R7 e a matriz de acesso, não com o PNG como molde rígido.
- Conferir aparência e comportamento em estados sem seleção, seleção simples/múltipla, painel expandido/recolhido/fixado, lista grande, carregamento, erro, conflito e falta de suporte. Testar ponteiro e teclado, pan/zoom, drag, entrada numérica, menu contextual e nomes longos; painéis não colapsam durante edição. A navegação global permanece disponível.
- Cada controle precisa alcançar seu modelo, histórico/persistência, grafo/configuração e efeito real no alvo quando aplicável. Testar Canvas→número/nó e número/nó→Canvas; retornar após salvar, fechar e reabrir; compilar a revisão e verificar a imagem/estado no core. Não apresentar preview CSS, executor local simulado, nó de catálogo ou `NoOp` como funcionalidade de jogo.
- Usar fixtures próprias criadas pelo caminho de autoria oficial para comprovar a jornada. APIs internas, arquivos e RAM podem observar/verificar resultados e apoiar testes de unidade; não substituir cliques/gestos por edição externa dos dados para alegar que a interface funciona.
- Medir custo e fluidez com ROM/core/binário/revisão identificados. Preservar a frequência nativa, áudio/input e limites de VRAM/tiles/sprites/DMA. Não aceitar FPS fixo no rótulo, primeiro quadro não preto ou melhora de um microbenchmark como prova de gameplay completo.

### Prova exigida e definição global de entrega

Para cada comportamento, produzir uma cadeia verificável: **ação real na UI → alteração persistida e reversível → configuração/nó correto → código/artefato gerado → ROM correta → efeito observado**. Para recursos exclusivos do editor, provar que a visão muda e a autoria/ROM não é alterada indevidamente. Incluir controle negativo, cancelamento/Undo e restauração do baseline quando pertinente. Estabelecer oráculos antes da implementação: não atualizar expectativa apenas para aceitar o resultado errado.

Executar os comandos e protocolos da seção **Gates e provas por lote**, que é parte obrigatória deste prompt. Acrescentar regressões relevantes nos owners existentes e jornadas de integração; não inflar contagem com testes de markup ou espelho da implementação. Gates falhos são investigados e corrigidos dentro do escopo; não desativar testes, ocultar warnings, pular cenários requeridos ou afrouxar limites para declarar sucesso. Falha preexistente fica comprovada e separada, mantendo explícito o impacto no aceite.

A revisão manual executada pelo agente no Tauri é obrigatória. Aceite de um participante humano independente permanece evidência distinta: preparar o roteiro/material e registrar quando não tiver ocorrido, sem inventar depoimentos ou usar isso como pedido de permissão para continuar o desenvolvimento independente. Testes em OS ou hardware indisponível têm retenção explícita; CI de outro alvo não substitui a prova ausente.

A entrega global requer matriz completa dos itens exigidos, gates aplicáveis no candidato final, trajetos/paletas/oclusão/ondas/Fantasma/Jogar exercitados juntos, sete complementos VIS07 verificados, capturas revisadas, desempenho medido e nenhuma perda de função anterior. Roteiro final deve criar/editar, navegar, desfazer, salvar, reabrir, construir, jogar, retomar marcação, retornar ao editor e exportar a revisão correta. Preservar evidências de sucesso e falha. Qualquer retenção restante impede a declaração de entrega integral, mas não justifica abandonar o trabalho independente.

Entregar: implementação e publicação revisável na branch/PR vigentes; tabela requisito→resultado→evidência; capturas reais e recibos; testes/métricas do candidato final; migrações/compatibilidade; limites e dependências externas ainda existentes. Atualizar Memory Bank, roadmap e jornada com o estado comprovado. Informar SHA local/remoto e CI observado sem promover maturidade automaticamente. Merge, release e deploy mantêm suas autorizações próprias. A resposta final deve permitir ao operador abrir e verificar o resultado sem reconstruir a conversa.

**Direção aprovada pelo operador, 2026-11-06:** a interface deve preservar a capacidade de produzir jogos de grande complexidade, com gráficos e mecânicas ricos, por ferramentas amigáveis e robustas. Modernizar a experiência não autoriza reduzir ferramentas, retirar áreas globais ou limitar o Canvas a pequenos ajustes. A [R5 — autoria visual robusta](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r5-autoria-visual) foi aprovada conceitualmente; a R4 simplificada foi rejeitada. A [R6 — Jogar no emulador](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r6-jogar-emulador) acrescenta início/cena/pins, miniaturas e retomada de momentos. Esta rodada entrega registro e investigação para implementação por outro agente; imagens e especificação não promovem suporte nem comprovam FPS.

**Complemento R7 do mesmo dia:** incluir paletas completas por perfil e troca rápida, seleção de primeiro plano/oclusão, pincel de distorção e ferramenta Fantasma, além da fila de produtividade. Ler a [R7](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r7-ferramentas-visuais) antes de implementar: a faixa única de paleta e as ferramentas mostradas no PNG R5 não esgotam a capacidade exigida. O pedido atual é registro/revisão para implementação; VIS01–VIS08 permanecem planejados.

## Missão

Implemente a melhoria da jornada de criação do RetroDev Studio descrita abaixo, em lotes sequenciais, preservando o fluxo oficial Build → ROM → Emulação. Execute investigação, implementação, regressão, revisão, jornada Tauri e continuidade de cada lote. Não encerre apenas com um plano nem peça confirmação para escolhas reversíveis dentro do escopo. Uma retenção impede o fechamento do item e seus dependentes; prossiga nas partes independentes. Mudança de arquitetura fora deste escopo ou ação destrutiva exige decisão específica do operador.

O objetivo é permitir autoria visual rica e precisa para iniciantes e produtores experientes: selecionar e manipular qualquer objeto compatível, compor planos, editar arte/animação/comportamento, entender o alcance da mudança, navegar por recursos e nós, testar e desfazer sem perder contexto. Herói e fundo são exemplos, não limites. Preservar a capacidade existente e integrar a direção R5 por owners e contratos explícitos. Não criar motor universal, editor paralelo, nova store global para uma responsabilidade existente ou reescrita geral. Manter as superfícies parciais como Experimental.

## Contexto, fontes e estado observado

- Única raiz neste host: `/home/misael/Projects/RetroDevStudio`. Branch de continuidade: `codex/new-host-cohesion-20261024`; PR existente #112. Não criar clone/worktree ou outro checkout.
- Ler primeiro as instruções atuais de `AGENTS.md`, `../AGENTS.md`, `docs/06_AI_MEMORY_BANK.md`, `docs/03_ROADMAP_MVP.md`, `docs/08_TREE_ARCHITECTURE.md`, `docs/00_AI_DIRECTIVES.md` e `docs/09_AGENT_DEV_MODE.md`. Ler o handoff de host `docs/handoffs/NOVO_HOST_INICIO.md`; stack/compliance quando aplicáveis. Para runtimeLink, ponte canvas/ROM e provas de gameplay, ler também `docs/14_REX_ARQUITETURA_UNIVERSAL.md`.
- Hierarquia de verdade: Memory Bank → roadmap → modo de desenvolvimento → árvore → stack → compliance → onboarding. Instruções atuais do operador prevalecem sobre orientações históricas. Responder `[Contexto Carregado]` antes de implementar.
- Especificação de UX e decisões: `docs/studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md`, contratos R2/R3 reconciliados com R5 aprovada, R6 e R7. O contrato integral no início deste documento incorpora as sete famílias VIS07 à execução solicitada. Continuidade geral: `docs/handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`. Este prompt não é outro diário de estado.
- Entrada desta preparação: commit local `b9a6e15143a82bbcfbadeb58b15fa50a9188b2e0`; fonte de produto inspecionada `d51c56da1137670038194ea5df5e120a9316746c`. Reinspecionar HEAD/diff/remote/PR ao iniciar: estes SHAs são evidência histórica, não exigência de checkout nem prova de estado futuro.
- R1/R2 eram mockups, sem implementação das interações. As correções JV01/JV05/JV06/JV09/JV10 têm evidências próprias na jornada. Em especial, JV09/JV10 já tiveram movimento, animação e espelho conferidos no Tauri/core. Preservar essa semântica; não anunciar estas correções como trabalho novo de R3.
- A regressão JV09 já encontrou falso «editado manualmente» ao reabrir comportamento antigo após mudança de default `face_direction`. O teste está em `src/core/nodegraph/behaviorLibrary.test.ts`. Não a reintroduzir.
- Projeto autoral do operador: `/home/misael/Documents/RetroDevProjects/Correio_das_Nuvens/project.rds`. Não usá-lo para experimentos destrutivos. Criar projeto de QA próprio pelo wizard ou cópia identificada dos dados do jogo no runtime, sem copiar fontes do aplicativo. Arte original de Nalu: 32×32, idle4/run6/jump2; céu e chão com paralaxe. O projeto original pode conter nove nós manuais da receita antiga: não confundir esses nós com uma receita recém-gerada para testar R3-03.
- Arte, pacote, receitas e provas privadas: `/home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/tutorial-megadrive-20261105/`. R2: `mockups-contextuais/revisao-critica/01-cena-contexto-r2.png` e `02-nos-contexto-r2.png`. A entrada R3 foi preservada junto dessas evidências; não depender do scratchpad temporário de outro projeto.
- Na preparação, `AGENTS.md` já estava modificado pelo operador. Preservar trabalho alheio; stage apenas arquivos revisados do lote. `gh` estava sem autenticação e o push normal falhou; o remoto observado era `d51c56da`. Reutilizar acesso válido se houver; não pedir token no chat nem declarar sincronização sem conferir o remoto.

Atualização de contexto da R6: R5 publicada em `0dc00e68e471043b242f0324140580e973f9de34`, PR #112 aberto, cinco checks de validação SUCCESS e dois revisores SKIPPED observados em 2026-11-06. O acesso GitHub estava funcional nesta leitura. São evidências desse SHA e momento, não bloqueio de autenticação vigente nem aprovação do futuro código PLAY. O produto inspecionado continua na base `d51c56da`; verificar novamente estado/owners ao assumir.

## Protocolo operacional

Antes de builds, testes longos, instalações ou cópias grandes, medir CPU/carga, RAM disponível, atividade de swap, pressão de I/O, espaço no destino/temporários e processos concorrentes. Estimar pico, saídas e retenção. Uma operação pesada por vez, inicialmente `RDS_BUILD_JOBS=1`. Se houver pressão, reduzir/esperar e medir novamente; preservar processos, caches e evidências alheios.

Usar o launcher/host-manager e os locks existentes. Gerados ficam no runtime oficial `/home/misael/Shared/ProjectRuntime/RetroDevStudio`, toolchains no cache gerenciado; não instalar globalmente ou recriar fontes. Ler `/home/misael/.codex/RTK.md` e prefixar comandos de shell com `rtk` (`rtk proxy` para saída integral).

Rodar `host:diagnose` no início. Quando PATH/XDG divergirem, usar o launcher com cache explícito. Exemplo de ambiente desta família de sessões, sujeito à validação de owner/lease:

```bash
rtk proxy env RDS_HOST_CACHE=/home/misael/.cache/retrodevstudio RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/ux-r3-20261105/work RDS_BUILD_JOBS=1 TMPDIR=/tmp bash scripts/new-host.sh --run npm run host:diagnose
```

Runtime próprio é dado de execução, não outro checkout. Não apagar trava ambígua do operador. Se o diagnóstico não for READY, reparar pelo launcher oficial conforme o host ou registrar o bloqueio; não alterar produto com host BLOCKED/DRIFTED/UNSUPPORTED. Não herdar READY de outro candidato/OS. Em host vazio, seguir integralmente NOVO_HOST_INICIO.

## Escopo base R2 — também faz parte da implementação

Os dez ajustes R3 complementam esta base; implementar só os chips/legendas de R3 não conclui a jornada:

1. **Navegação global persistente e contexto horizontal (R5):** manter à esquerda os acessos globais existentes, incluindo Cena, Arquivos, Arte, Lógica, Teste, Efeitos e Depurar, independentemente da seleção. Preservar Interface/Entrega/importação nos destinos oficiais. A faixa horizontal navega áreas relacionadas ao objeto/plano/cena: arte vinculada, comportamento, trajeto, nós e composição, conforme capacidade. Mesmo em janela estreita, a lateral continua disponível. Reutilizar `StudioContextBar`, `studioContext` e `editorStore`; preservar objeto, revisão, ocorrência/animação pertinente, pan/zoom e retorno. A correção supera a redução anterior a quatro destinos.
2. **Gestos e menu:** clique seleciona; duplo clique em sprite abre arte/animação mesmo se houver lógica; preservar o gesto próprio de tilemap/câmera. Canvas e hierarquia usam as mesmas ações. Botão direito identifica o alvo e oferece arte/animação, comportamentos/nós, adicionar comportamento suportado, paleta, usos, duplicar, renomear, organizar no plano, isolamento e excluir. Não inventar golpes/formatos sem contrato. Menu não cobre a seleção quando houver espaço, fica dentro da janela, funciona por teclado e não desativa o menu nativo de campos de texto sem necessidade.
3. **Uma árvore:** objetos/camadas/ordem/visibilidade/bloqueio na mesma projeção do modelo. Incluir itens sem camada e guias/câmera; respeitar composição e prioridades suportadas. Não criar outra hierarquia independente no Inspector.
4. **Painéis por contexto:** cabeçalho compacto com nome/ícone/valores, abrir/recolher/fixar e lembrar organização. Não recolher durante foco de teclado, digitação, drag, popup ou operação pendente. Descoberta de ações por hover e foco, indicador persistente de fixado. Movimento reduzido, tamanho mínimo e adaptação em janela estreita; não repetir o colapso de timeline corrigido em JV05.
5. **Comportamento versus animação:** parâmetros de movimento no comportamento; clipes, FPS, loop e onion skin em Arte/Animações, nos owners existentes. Vínculos como «Ao pular → jump» são explícitos, sem botões que pareçam executar o pulo ao escolher um clipe. Ver nós localiza o grupo correspondente.
6. **Visão reversível:** Normal/Atenuado/Oculto, filtros por índice/recurso de cor, isolamento individual/múltiplo e saída identificada. São instrumentos do editor; não editar pixels, colisão, campos autorais ou o jogo como efeito do filtro. Separar Sair do isolamento, Restaurar visão e Restaurar layout.
7. **Nós/cenas legíveis:** thumbnail pequena, marca d'água opcional/discreta, grafo com área útil, mapa sob demanda, referência visual estável e busca. Porta livre mostra Sem ação/+ Ligar; isso não cria um nó de execução. Formulário e nó são projeções de um único parâmetro.
8. **Feedback honesto:** manter Salvar e os estados reais de rascunho/revisão/conflito. Uma prévia de arco é estimativa identificada, não prova de trajetória da ROM. Estados sem seleção, vazios, carregando, incompatíveis e de erro entram junto da superfície.

## Inspeção inicial: owners confirmados e limitações

Confirmar novamente antes de editar; os caminhos abaixo existem na base pesquisada:

| Responsabilidade | Owner existente e observação |
|---|---|
| Navegação/ações | `src/core/studioContext.ts`, `src/core/entityAuthoring.ts`, `src/components/common/StudioContextBar.tsx`, `src/App.tsx`, `src/core/shortcuts.ts`. A resolução atual dá precedência à lógica antes do sprite; corrigir o caminho compartilhado, não só um listener. |
| Seleção, camadas e foco | `src/components/viewport/ViewportPanel.tsx`, `src/components/hierarchy/HierarchyPanel.tsx`, `LayerPanel.tsx`, `src/core/sceneComposition.ts`, `src/core/store/editorStore.ts`, `src/core/ipc/sceneService.ts`. Solo está local ao Viewport; `SceneLayer` já tem visible/locked/depth. Isso não demonstra lock por objeto ou atenuação escolhida persistente já disponíveis. |
| Escopo/origem | `InspectorPanel.tsx`, fonte/resolução de prefab/cena, `scenePersistence.ts`, `studioContext`. Não deduzir alcance só do nome do prefab ou da extensão do asset. |
| Paletas | `src/components/inspector/PalettePanel.tsx`, `src/core/palettePlan.ts`, `palettePlanStore.ts`, `src-tauri/src/compiler/palette_plan.rs`. Já existem `EntityPaletteSection`, `affectedBy`, impacto, Aplicar a todos os usos, Cancelar, variante, validação de orçamento/contexto e Undo da cena. Integrar; não criar outro plano/confirmador. |
| Comportamentos/nós | `src/core/nodegraph/behaviorLibrary.ts`, `nodeTypes.ts`, `nodeEngine.ts`, `graphHistory.ts`, `src/components/nodegraph/NodeGraphEditor.tsx`. Já há assinatura gerada, detecção de edição manual, planejamento de regeneração, dependências e preservação de conexões compatíveis. |
| Arte/animação | `ArtStudioPanel.tsx`, `CharacterTimelinePanel.tsx`, `useSpriteAnimator.ts`. FPS, loop e onion skin já têm implementação; preservar conteúdo e identidade ao expor melhor. |
| Unidades/input | `BehaviorParamSpec`, `describeMovementTuning` e `MOVEMENT_SUBPIXELS=16` em `behaviorLibrary.ts`; `src/core/ipc/emulatorService.ts`; emitter SGDK. `sprite_move` usa deslocamento em pixels; `set_velocity` trabalha em escala dividida por 16 na integração MD. KeyZ chega a Mega Drive A por RetroPad; não inferir pelo nome do campo RetroPad. |
| Build e início do teste | `App.handleBuildAndRun`, `src/core/ipc/buildService.ts`, IPC `src-tauri/src/lib.rs`, `src-tauri/src/compiler/build_orch.rs`, AST/emitter e `src-tauri/src/compiler/runtime_link.rs`. O build normal lê `project.entry_scene`; o IPC pesquisado recebe projectDir, sem opção de início. |
| Identidade da execução | `src/core/runtimeLink.ts` e adaptador backend: vínculo ROM/entidade/RAM/recurso, não controlador do ponto de início. Preservar SHA, revisão, época e recusa de resposta obsoleta. |

Antes do primeiro lote, registrar uma matriz curta requisito → owner → fonte do valor → alcance → persistência → comando/Undo → teste. Resolver os pontos abaixo no código; não assumir que os nomes do mockup são APIs existentes.

## Retenções técnicas: condições para fechar os itens

**T1 — Escopo não é uma classificação fixa por painel.** Arte/animações podem ser componentes de instância, dados herdados ou recursos compartilhados. Resolver cada bloco a partir da origem real. PAL0–3 é alocação no contexto da cena/build, não identidade global de recurso; separar consumidores da cena, índices afetados e usos do recurso no projeto. Dados de plano atrasados não autorizam edição. Sem escopo confiável, bloquear a mutação e explicar a origem desconhecida.

**T2 — Visão escolhida e visão derivada não podem ser confundidas.** Não gravar atenuação de isolamento em `visible`, `locked`, pixels ou cena autoral. Compor estado escolhido + filtros + máscara de isolamento no owner existente. Se preferências de visão forem lembradas, usar persistência de editor identificada. Sair remove só a máscara: conserva o estado anterior quando não houve edição deliberada e conserva novas escolhas explícitas feitas durante o isolamento. Não restaurar snapshot por cima de trabalho novo.

**T3 — Layout não é conversão para lógica manual.** Agrupar, mover, renomear visualmente, recolher ou fixar não altera a assinatura semântica. Edição de parâmetro mapeável deve preferir o formulário/receita existente; mudança semântica fora dela exige transição explícita para manual, reversível. Não gerar um motor de engenharia reversa do grafo para cumprir isso. Regenerar não pode apagar lógica/conexões externas silenciosamente.

**T4 — Identidade dos nós e escopo compartilhado precisam de contrato.** N01… é referência de apresentação, não substituição de `GraphNode.id`/IDs de comportamento. Não numerar por posição/ordem de carregamento. Confirmar persistência compatível, unicidade por projeto, cópia/movimento e migração. Se precisar acrescentar metadado pequeno, justificar no owner/schema existente e testar round-trip/legado; não introduzir catálogo de execução concorrente. Enquanto não houver referência estável, mostrar identidade/escopo real, sem prometer busca estável por N08.

**T5 — Mapa não comprova transição executável.** `load_scene` existe no catálogo; no compilador TS legado pesquisado só emite comentário, e não foi encontrado ramo dedicado com esse nome no AST canônico. Fazer contraprova no caminho oficial antes de atribuir capacidade de runtime. R3-06 pode rastrear transições declaradas e marcar execução não suportada; não criar outro motor de cenas nem fazer o legado assumir o build. Se execução entre cenas exigir capacidade fora do MVP/escopo, registrar retenção específica, sem esconder como pronta.

**T6 — TestStart é contrato de build, não um argumento inventado de runtimeLink.** Definir de onde vêm entrada da cena e posição de Nalu e quando diferem; não apresentar duas opções equivalentes como ganho. Para plataforma, validar apoio/colisão/câmera pertinentes; outros comportamentos não exigem chão por regra universal. Não mudar temporariamente `project.entry_scene`/posição salva e tentar restaurar depois. Override de teste deve ser transitório, validado no pipeline existente, com a cena inteira e proveniência. Sem isso, não habilitar a opção nem simular início por escrita arbitrária de RAM/savestate.

Retenções são gates técnicos, não pedidos rotineiros de permissão. Resolver escolhas reversíveis pela inspeção e testes. Só solicitar decisão do operador se a solução exigir escopo/arquitetura não autorizados ou acesso indispensável. Sem satisfazer o gate, manter o item Experimental/parcial e o limite visível.

## Lotes e requisitos R3

### Lote 0 — Preparar os contratos e a linha de base

Confirmar o estado atual, preservar WIP, medir recursos e obter host READY. Preparar a matriz de T1–T6 e as regressões que reproduzem o problema no owner antes de alterá-lo. Identificar a linha de base e os limites por SHA, sem reatribuir prova de outro candidato. Distribuir a base R2 nos lotes abaixo; este lote não é autorização para trocar todas as superfícies de uma vez. R3-10 pode acompanhar esta documentação.

### Lote 1 — Contexto único: R3-01 (exibição), R3-04, R3-07, R3-08

Integrar primeiro a navegação, os gestos/menu e a projeção única da árvore descritos na base R2. Cobrir ida/volta Cena → Arte → Comportamentos → Nós → Cena com alvo/revisão preservados e equivalentes de teclado. Conservar os comandos e guardas existentes; novo controle sem capacidade ainda implementada não pode parecer funcional.

**R3-01 — Escopo por bloco.** Propriedades/comportamento mostram instância ou origem efetiva; Arte/Animações/Paleta mostram seu alcance real, inclusive herança. A paleta informa recurso, banco planejado quando conhecido, consumidores e índices afetados. Não fixar PAL1 nem contar por simples coincidência de cor. Reusar o plano/context key existentes. Neste lote só expor alcance correto; não abrir novo caminho de edição compartilhada sem a proteção já existente/lote2.

Aceite: Inspector e demais vistas concordam sobre o alvo. Duas instâncias com recurso comum e uma terceira independente têm contagens/alcance corretos. Testar mudança de cena/seleção durante resposta assíncrona; plano antigo não pode autorizar edição no contexto novo.

**R3-04 — Escopo do grafo.** Cabeçalho do grafo e Inspector usam a mesma resolução de origem: instância, modelo compartilhado ou origem externa/não editável, conforme contrato. Listar usos/cenas afetados antes de aplicar edição compartilhada. Não transformar visualização do grafo em gravação do prefab.

Regressão: projeção instância/modelo, overrides, graph_ref compartilhado e origem indisponível; abrir/fechar/reabrir não grava nem converte escopo. Cancelar edição compartilhada não altera grafos/arquivos/revisão/histórico.

**R3-07 — Cabeçalho compacto.** Thumbnail pequena + nome/seletor; imagem grande dentro do seletor, sem empurrar a árvore. Medir a altura útil no Tauri em 1366×768 e 949×593. Com fixture de tamanho declarado, Personagens e início do próximo grupo ficam alcançáveis sem rolar. Não exigir que uma lista arbitrariamente grande caiba na tela. Preservar fonte/zoom e navegação por teclado.

**R3-08 — Bloqueio descobrível.** Olho/cadeado aparecem no hover e foco; bloqueado conserva indicador. Confirmar lock de camada versus objeto: não bloquear outros sprites nem criar camadas artificiais ao bloquear um objeto. Se faltar metadado por objeto, estender o owner de editor de forma compatível antes de anunciar suporte. Bloqueio efetivo inclui herança da camada. Impedir seleção/transformação pelo canvas conforme contrato apresentado, explicar o motivo e manter seleção/inspeção/desbloqueio pela árvore. Atalho local à linha, sem roubar digitação.

Regressão: mouse/teclado, objeto/camada, objeto sob camada bloqueada, desbloqueio, hit-test sem modificar alvo protegido, save/reopen e ausência de mudança de gameplay.

### Lote 2 — Trabalho reversível: R3-02, R3-03, R3-05, edição de R3-01

Integrar os painéis compactos/fixáveis, a organização lembrada, os filtros reversíveis e a apresentação separada de comportamentos/animações da base R2. Não recolher o painel em uso ou com foco. Preservar FPS/loop/onion skin no owner de Arte e os controles ainda necessários em janela estreita.

**R3-02 — Isolamento derivado.** Compor máscara sobre escolhas de visão. Chip próprio, por exemplo «Atenuado · isolamento», com nome acessível; não apresentar a derivação como escolha gravada. Uma saída no indicador e Esc com prioridade de popup/campo. Ocultar Céu → isolar Nalu → sair deve manter Céu oculto e devolver Terreno ao estado escolhido. Cobrir escolha explícita durante isolamento, exclusão do alvo, troca de cena, multisseleção, filtros de cor e restauração. Nenhuma dessas ações muda cena autoral, paleta, grafo ou colisão. Filtros de visão não usam Undo de autoria como se fossem edição do jogo.

**R3-03 — Proveniência e edição gerada/manual.** Mostrar grupo «Gerado por Movimento e salto» a partir dos metadados reais. O formulário edita a receita e regenera pelo planner existente. A primeira edição semântica direta fora do caminho mapeado exige confirmar a conversão daquele comportamento/escopo para manual; cancelar é sem efeito. Exibir «Personalizado nos nós» e regeneração com impacto/diff. Layout não dispara a confirmação. Uma transação de Undo restaura grafo, parâmetros, origem/assinaturas e conexões. Regenerar preserva nós fora do grupo, IDs/posições quando compatíveis, dependentes e conexões manuais válidas; conflito/remoção exige decisão explícita.

Regressão mínima: legado JV09/face_direction ao reabrir; layout sem manualização; cancelar conversão; gerado→manual→Undo→Redo; regeneração com nós/arestas externas e dependentes; save/reopen; ciclos idle/run/jump e espelho continuam corretos no core. Reusar `nodeSignature`, `manuallyEditedNodes`, `planEditBehavior` e `graphHistory` em vez de flags de UI divergentes.

**R3-05 — Valores com unidade/faixa/default.** Enriquecer os metadados de parâmetros cobertos. Já há `speed` de 1 a 8, padrão 2, em pixels por quadro, e `jump_strength` de 8 a 128, padrão 64; conferir que continuam canônicos. No MD pesquisado, o impulso 64 usa a escala 16 e corresponde a 4 px/quadro de velocidade inicial antes das regras/limites aplicáveis, não à altura nem a 64 px/quadro. Usar `describeMovementTuning` e o contrato do emitter; não aplicar essa escala a `sprite_move` nem extrapolar SNES. Mostrar unidade apropriada/dimensionalidade, faixa e padrão. Draft inválido no campo não altera o valor aplicado; validar número finito, inteiro/step e faixa antes de commit, preservando o anterior e a mensagem local.

Separar «Controle A» e «Teclado Z» derivados do mapeamento real/plataforma em `emulatorService`. Não fixar Z/A em todos os alvos nem criar remapeador paralelo. Testar metadados, inválidos sem mutação, mapeamentos/plataforma e identidade do parâmetro entre formulário/nó/resumo; uma mudança válida produz um Undo.

**R3-01 — Aplicar cor compartilhada.** Reusar impacto e «Aplicar a todos os usos» como confirmação explícita; não acrescentar um modal redundante a cada gesto. Snapshot/proposta vinculados à cena/revisão/recurso; listar os consumidores efetivos antes do commit. Cancelar não muda cena, arquivos de recurso, revisão, histórico nem plano aplicado. Confirmar altera somente os usos listados; variante local só quando o orçamento permite, com recusa do quinto banco sem mutação. Não substituir fonte externa compartilhada silenciosamente.

Regressão mínima: contagem contextual, cancelamento completo, aplicação com consumidores compartilhados e um controle independente, Undo/Redo, variante com/sem banco livre, resposta tardia, save/reopen e ROM/core mostrando os pixels pretendidos. Reusar testes de PalettePanel/palettePlanStore e a jornada `studio-paletas` existente; preservar a política de consumidores e o writer de recursos.

### Lote 3 — Rastreabilidade: R3-06

Implementar referências visuais estáveis com T4 satisfeito e leitura derivada das transições, respeitando T5. Reusar resolvers de cenas/grafos/prefabs; não tratar texto arbitrário como caminho autorizado. Drawer/mapa tem thumbnail, cena de origem/destino e rótulo com código; hover **e foco** revelam dono/gatilho e a identidade acessível. «Ver origem» abre o grafo dono, seleciona/enquadra o nó e permite retorno. A busca encontra código, nome do dono e cena, resolve ambiguidades e não pressupõe que a aresta pertence ao herói.

Destino calculado, ausente, externo ou não suportado aparece como tal; sem aresta fixa inventada nem capacidade de execução promovida. Mapa é projeção, não outro grafo que altera gameplay ao arrastar cartões. Remover texto de design «Aberto sob demanda» do produto. Porta sem ligação é explicitada, sem criar nó fictício.

Regressão: busca por código/dono, estabilidade após organizar/save/reopen, cópia/movimento entre cenas sem colisão, uso compartilhado, transição desconhecida sem aresta certa, origem removida e volta ao contexto. No Tauri, navegar A→origem da aresta→nó de outro objeto→voltar; isso prova navegação, não execução A→B na ROM.

### Lote 4 — Teste curto: R3-09

Integrar o feedback do ciclo de edição previsto em R2. Se houver arco estimado, derivá-lo dos parâmetros/limites conhecidos, identificar a estimativa e informar quando faltam condições para calculá-la; não desenhar uma trajetória arbitrária nem abrir um segundo motor de física. Conferência no core continua uma evidência separada.

Fechar T6 antes de habilitar a nova opção. Estender o comando/IPC/pipeline canônicos com intenção de teste opcional e compatível, não criar outro compilador. O contrato registra cena selecionada, revisão/snapshot, alvo, modo de início e ponto/entidade quando aplicável. Backend valida contexto, paths, limites e suporte; o build normal mantém o comportamento anterior.

Opções: «Da entrada desta cena» por padrão e «A partir da posição de Nalu» quando o ponto for válido e o significado estiver definido. Não usar o estado do emulador como se fosse posição autoral. Se coincidirem, informar equivalência em vez de simular dois resultados. Validação de apoio/câmera é contextual ao comportamento; motivo de indisponibilidade visível e acessível.

Carregar a cena inteira, preservar câmera, colisões, objetos e eventos iniciais. Aplicar override só na intenção/snapshot de build, sem reescrever e restaurar o projeto do operador. Não usar RAM poke para substituir a implementação. Recibo/resultado identifica cena, revisão, início e SHA da ROM; runtimeLink continua uma evidência de identidade e inspeção, estendido compativelmente se necessário. Resposta de build antiga não pode carregar ROM como resultado da revisão atual; falha não executa ROM anterior como nova.

Regressão: build normal sem opções, serialização/backcompat do contrato, entradas inválidas, snapshot preservado, troca de contexto durante build, modo indisponível e duas intenções válidas/distintas quando suportadas. Jornada Tauri oficial Build→ROM→Genesis Plus GX com as duas opções, leitura de início/objetos/câmera/colisão, save/reopen e export preservados. A cena não está pronta apenas por carregar ROM ou receber o primeiro quadro não preto; usar estado/elementos esperados conforme JV14.

### R3-10 — Documento e mockup coerentes

Corrigir os marcadores/legenda e acrescentar «composição ilustrativa · não representa um estado único». Preservar imagens anteriores e distinguir proposta de captura real. Não colocar legendas de design no fluxo do produto. Se editar PNGs gerados, seguir a skill imagegen e preservar originais; não trocar a prova de UI real por uma imagem sintética. Esse item pode ser concluído independentemente de código, mas não certifica nenhum outro requisito.

## Gates e provas por lote

- Testar comportamento/regressão no owner; não criar testes que apenas repitam markup. Provar cancelamento, Undo/Redo, save/reopen, legado, escopo e respostas atrasadas quando o lote os afetar.
- Executar os gates aplicáveis do AGENTS pelo ambiente gerenciado: árvore, lint, TypeScript, frontend completo, Clippy com warnings como erro, Rust lib com nocapture e fmt check. Usar manifest `src-tauri/Cargo.toml` quando rodar Cargo a partir da raiz. Uma operação pesada por vez. Não desativar testes, relaxar oráculos ou limpar evidência para obter verde.
- Para mudanças em build, emulação, toolchains/infra: validação manual com dependências oficiais e `host:certify`. Dependências/segurança alteradas exigem auditorias npm/Rust e licenças previstas; não acrescentar dependência por conveniência.
- Falha preexistente deve ter evidência e separação da regressão introduzida. Há histórico de `TMPDIR` oculto no harness e referência BYOR ausente em teste Rust; conferir o estado atual e a referência fornecida pelo operador antes de atribuir causa. Não baixar ROM nem apagar artefato para contornar o gate.
- Após alterações de comportamento, executar o Tauri real pelo launcher e percorrer os fluxos afetados em 1366×768 e 949×593. Vite, Vitest, Xvfb/offscreen, CI Windows e avaliação humana são evidências diferentes. Registrar o nível observado. Reusar `scripts/e2e-tauri-build-run.mjs`, cenários `studio-jv`, `studio-jv-motion`, `studio-paletas` e `scripts/verify-jv-motion.py` quando pertinentes; estender os owners/harness, sem automação paralela apresentada como produto.
- Autoria da jornada nativa por clique/teclado/drag e seletores reais. Observação de DOM/arquivos/RAM pode verificar o resultado, mas edição externa de JSON/store/ROM não comprova que a interface autorizada funciona.
- Contraste nas cores/fontes/estados reais: mínimo 4,5:1 para texto normal; medir exceções aplicáveis separadamente. Foco visível, nomes acessíveis, ordem de tabulação, atalhos sem conflito com texto, mouse/teclado equivalentes e movimento reduzido em cada lote. Testar estados vazio/erro/carregamento sem seleção antiga residual.
- Guardar SHA do binário/fonte/ROM, core/toolchain, revisão, parâmetros, passos e resultados, incluindo falhas. Arte/ROM/corpus/projetos privados e gerados ficam no runtime. Definir orçamento/retenção; não alegar backup independente para cópia no mesmo volume.

Comandos canônicos para passar como argumentos de `--run` ao launcher do exemplo operacional, um por invocação e com a medição/ambiente acima:

| Gate | Comando interno ao launcher |
|---|---|
| Árvore | `npm run check:tree` |
| Lint | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| Frontend | `npm test` |
| Clippy | `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` |
| Formatação Rust | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` |
| Certificação, quando aplicável | `npm run host:certify` |
| Segurança/dependências, quando alteradas | `npm run security:audit` e `cargo audit --file src-tauri/Cargo.lock`, em invocações separadas; inventário de licenças conforme a política |

Não executar esta tabela em paralelo nem assumir que `RDS_BUILD_JOBS=1` limita sozinho as threads dos testes. Repetir após mudança/falha que justifique, não para inflar contagens. Os gates completos aplicáveis e a jornada real precisam pertencer ao incremento final; resultado do candidato anterior permanece histórico.

## Integração R5 e conservação de capacidade

A R5 detalha desenho e manipulação de trajetos (retas, curvas com alças e elipses), execução única/repetida/ida e volta, precisão numérica e ligação dos gatilhos/esperas aos nós. Também detalha planos A/B, sprites e prioridades, isolamento e prévia de paralaxe. Conservar as proteções R3-01…10 e T1–T6; a nova riqueza de autoria não cria outra fonte de estado.

- Antes do lote 1, inventariar as áreas/ferramentas existentes e seu acesso após a mudança. Reprovar revisão que retire capacidade ou deixe recurso órfão. Acesso global e contextual têm papéis diferentes; não fundi-los por semelhança de rótulo.
- Nos lotes 1/2, integrar seleção/manipulação por capacidade, árvore e campos numéricos. Para paralaxe, examinar `CameraConfigurator`, `CameraAdvancedControls`, `cameraWorkflow`, `SceneArtwork` e `RetroFXDesigner`; separar câmera relativa de scroll contínuo e explicitar conflitos de owner. Não substituir recursos existentes por simulação decorativa.
- A câmera já possui `CameraWaypoint` com posição/duração/espera e interpolação linear. Isso não implementa curvas de movimento para qualquer objeto. A elipse do PixelEditor é desenho de pixels. A evolução de trajetos precisa de um contrato próprio integrado ao modelo/pipeline oficiais, conforme a proposta do roadmap; não deve ser declarada resolvida por recortar esse percurso de câmera.
- Investigar e documentar origem relativa/mundo, compartilhamento, transformação/cópia, pontos/alças, velocidade por distância, tempo por alvo, loops sem salto oculto, eventos e interação com física/colisão. Definir custos/limites de memória e processamento por quadro. Só então executar a fatia priorizada e seus testes; não abrir motor universal ou schema paralelo.
- Prévia de trajeto e sonda de câmera são estados do editor. Parar/cancelar restaura autoria, e nenhum fantasma vira entidade. A faixa de regra no Canvas projeta o grafo oficial; não mantém um segundo conjunto de condições.
- Evidência exigida na implementação: gesto e número alteram o mesmo valor; Undo/Redo e save/reopen conservam forma/tempo/escopo; todos os destinos globais continuam acessíveis; A/B e sprites respeitam prioridade; teste oficial corresponde à revisão. Exercitar também objeto diferente do herói. O aceite final considera capacidade, precisão, robustez, desempenho e uso repetido, além da legibilidade.

<a id="implementacao-play-r6"></a>
## Implementação de Jogar no emulador — R6 / PLAY01–PLAY06

Usar a [especificação R6](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r6-jogar-emulador) e a [fila PLAY no roadmap](../03_ROADMAP_MVP.md#jogar-emulador-r6). A premissa aprovada é criação complexa com ferramentas amigáveis e robustas. O desenho orienta relações, visibilidade, precisão e qualidade; não copiar a moldura do mockup sacrificando capacidades. Esta seção complementa o lote 4/T6, não cria um segundo caminho de build/teste.

1. **PLAY01 — contratos e baseline:** confirmar suporte por projeto/alvo e os owners da tabela R6. Congelar intenções de início/cena/pin/captura, política de estado inicial e compatibilidade, orçamento de recursos e métricas antes de codificar. Medir o loop atual no Tauri real; o tempo adicional de 16 ms, transporte de quadros e serialização para trace/rewind são hipóteses a quantificar. Não atribuir o baixo FPS a Internet nem garantir correção apenas com outro botão.
2. **PLAY02 — cadência e controle:** evoluir o owner Libretro com execução serial e cadência da frequência nativa; auditar callbacks/afinidade e manter um único avançador do core. Integrar pausa, passo, captura, input, áudio e apresentação. Regressões de sessão/epoch/ordem, rewind e replay precisam permanecer verdes. Não resolver gameplay pelo lote bloqueante de milhares de quadros. Preservar instrumentos acessíveis, com custo/ativação claros.
3. **PLAY03 — início e cena:** completar T6 no pipeline oficial; validar revisão e contexto até a entrega. O seletor distingue partida normal, cena preparada e percurso ainda incompleto. Miniaturas não habilitam uma transição sem suporte. Cancelar/build falho não executa ROM antiga como atual; não mutar entrada/posição autoral para depois restaurar.
4. **PLAY04 — pins:** estender modelo/histórico/persistência existentes com definições de início. Gesto e número, coordenadas/origem, relação com entidade/câmera, nome e Undo/reabertura precisam concordar. Um pin sem runtime preparado não é um save state. A cena inteira é executada, inclusive objetos fora da área marcada.
5. **PLAY05 — capturas:** reutilizar `capture_runtime_state_bytes/restore_runtime_state_bytes` e o owner do core para múltiplos checkpoints. Manifesto/miniatura/snapshot são coerentes e persistidos atomicamente no runtime oficial; compatibilidade vai além de tamanho. Respeitar suporte e restrições do core, tratar falha de restauração sem continuar sessão parcialmente alterada, descartar eventos/áudio antigos e preservar origem/retenção. Captura após reabertura exige prova específica; portabilidade entre OS/cores não é presumida.
6. **PLAY06 — experiência integrada:** rolo de cenas/pins/momentos no botão Jogar, por hover e também clique/teclado, com nomes, grupos, busca e estados. Não executar ao passar o mouse. Restaurar contexto do editor ao voltar; manter navegação global e contextual. Validar cenários e regressões R6, recursos/frequência nativa, duas resoluções, Linux/Windows e cada alvo declarado. Executar ensaio humano de uso repetido antes de promover a experiência.

Não alterar o projeto autoral para provar o recurso. Preparar fixture própria com mais de uma cena e dois pins/momentos de estados diferentes, com sequência efetivamente suportada. Quando o compilador não suportar transição ou início direto, registrar retenção com owner e limite; não fabricar o resultado em RAM, em mockup ou por compilador paralelo. Não usar ROM comercial baixada para cumprir gates.

Registrar por PLAY: implementado, teste do owner, recibo de revisão/ROM/core, jornada nativa, métricas, limite e próximo passo. Primeiro frame, unit tests, host READY e média de FPS isolada não encerram o aceite. Nesta preparação, todos os PLAY estão planejados; nenhum foi implementado.

<a id="implementacao-visual-r7"></a>
## Ferramentas visuais R7 — VIS01–VIS08

A [especificação R7](../studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r7-ferramentas-visuais) contém os fluxos, fontes técnicas e fixtures; a [fila VIS](../03_ROADMAP_MVP.md#ferramentas-visuais-r7) registra a ordem. Transferir premissas e aceites, sem copiar um desenho que omite funções. Preservar R3, autoria R5 e Jogar R6; não criar motor/store, renderer de efeitos ou editor paralelo.

- **Inventário primeiro (VIS01):** matriz função/acesso/owner/regressão/prova antes/depois. Confirmar perfis/constraints, tipos de objeto, granularidade, suporte do compilador e limites. Hardware possível, adaptador implementado e resultado observado são evidências diferentes. Preservar `docs/04_HARDWARE_SPECS.md` e as decisões consolidadas; não contornar restrição reduzindo a capacidade sem informar.
- **Paletas (VIS02):** estender PalettePanel/palettePlan/planner Rust. Consulta rápida de PAL0–3 não altera atribuição; aplicar recurso não equivale a reescrever banco; mostrar todos os usos afetados. O IPC atual só aceita MD. SNES requer perfil por domínio/modo; SMS/PCE permanecem futuro até integração e prova próprias. Não hardcodar quatro bancos nem apenas generalizar para `N×16` ignorando semântica.
- **Seleção/oclusão (VIS03):** aproveitar seleção/histórico do Canvas e editores de arte; região persistida, máscara com finalidade, coordenadas e decomposição rastreáveis. Prioridade de sprite já chega ao emissor; isso não conclui a seleção parcial de pilastra. Testar pilastra e faixa autorais, buracos transparentes, prioridades, animação e câmera, preservando colisão e arte.
- **Grafo/código (VIS04, junto das primeiras fatias):** propriedades estáticas e regras dinâmicas apontam para a mesma definição. Auditar `effect_parallax/effect_raster`, que registram configuração e retornam `NoOp` lógico no AST inspecionado; fechar execução de condições/eventos antes de prometer gatilhos. `palette_swap` atual é ligado a golpe e o emissor SNES o recusa. Não expandir catálogo com nomes sem semântica, nem sobrescrever nós manuais. Source mapping mostra revisão e origem realmente emitida.
- **Distorção (VIS05):** integrar RetroFX e câmera; uma autoridade calcula o resultado de scroll/raster por recurso, com ordem e conflito explícitos. Área pintada versus área afetada, discretização, modos de onda e envelope devem corresponder ao backend. Radial/local arbitrário depende de técnica demonstrada, não de CSS ou offset de uma linha. Medir custo, registrar retenção e alternativas quando faltar suporte.
- **Fantasma (VIS06):** separar visualização do editor, recorte, dithering e técnicas de translucidez do alvo. Incluir investigação avançada por composição/software/paletas/shadow-highlight, com protótipo e orçamento antes de habilitar. Não descartar técnicas possíveis por exigirem elaboração, nem importar uma demonstração externa como prova universal. Cancelamento, remoção do efeito e edição de asset compartilhado precisam de reversão correta.
- **Complementos/QA (VIS07/08):** priorizar as sete sugestões R7 por jornada concreta. Validar cada fatia e uma cena combinada com quatro bancos, oclusão, onda, Fantasma, trajetos e Jogar/pins. Tauri, SDK/core oficiais, oráculo visual/estado, recursos/performance e ensaio humano; duas resoluções, teclado e acessibilidade. Não anunciar suporte de um alvo por prova em outro.

Confirmar nomes/paths no HEAD da implementação: a inspeção R7 ocorreu sobre documentação `697632a2` e código de produto `d51c56da`. Os cinco documentos desta rodada constituem planejamento; nenhum VIS recebeu prova de execução. Cada checkpoint futuro deve registrar item, owner, cenário, revisão/ROM/core, resultado, limite e próximo passo, com preservação demonstrada das capacidades anteriores.

## Fechamento e definição de concluído

Atualizar a seção de implementação da jornada com R3-01…R3-10, os itens base R2/R5, PLAY01–PLAY06 e VIS01–VIS08 cobertos: implementado, teste do owner, jornada nativa, limite e próximo passo. Atualizar Memory Bank/handoff e roadmap quando mudar estado real/superfície; não alterar decisões arquiteturais consolidadas.

Revisar arquivos explícitos, segredos/tamanho, commit/push na branch vigente, reutilizar PR #112 e confirmar SHA remoto/checks quando houver acesso. Sem stage global, force-push, merge, release ou deploy. Autenticação ausente limita publicação; manter o commit e o recibo, registrar causa/próxima ação oficial sem solicitar credencial no chat e sem repetir um pedido de autenticação já pendente.

Encerrar apenas processos temporários próprios; preservar locks/processos do operador e evidências. Entregar resumo por lote, arquivos e provas, retenções ainda abertas e próximo comando. Não chamar um item de pronto quando há apenas mockup, badge, store/teste unitário ou nó de catálogo sem efeito real no caminho correspondente. O pedido é fechar a experiência com os owners existentes, não ampliar o motor para contornar uma retenção.
