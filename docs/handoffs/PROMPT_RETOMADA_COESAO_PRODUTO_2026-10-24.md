# Missão — transformar o RetroDevStudio em um ambiente integrado de criação

Você assume como agente principal de produto e implementação. Trabalhe sequencialmente. Sua missão é tornar as capacidades existentes utilizáveis em jornadas completas, simples, seguras e fluidas, mantendo o poder técnico e as possibilidades avançadas. Entregue implementação e provas reais, não apenas inventário, recomendações ou uma nova camada visual.

## Contexto de partida

**Atualização de entrada em host vazio:** antes de implementar, leia `NOVO_HOST_INICIO.md` neste diretório. A branch `codex/new-host-cohesion-20261024` acrescenta os launchers e o diagnóstico de retomada sobre o checkpoint público `95d5ef23`; use essa ponta ou sua integração descendente, conferida por SHA. O checkpoint abaixo é a base histórica da primeira redação, não uma ordem de retroceder. Execute a instalação/certificação pelo launcher, conserve recibos e só depois prossiga E0–E6. Não há novo aceite humano ou GUI produzido pela simples preparação do host.

Repositório: https://github.com/Misael-art/retro-dev-studio

Branch de recuperação: `recovery/studio-preformat-20261021`.
Checkpoint publicado: `87b6b7fd5e3dacdd93eb30d5e25a9570d00ce769`.
Fonte runtime original: `a8550af0e0bdd74c44478f94d301576b988747a1`.

Se houver avanço posterior, compare e registre antes de escolher a base. Não volte automaticamente a um checkpoint antigo. A pasta antiga `/mnt/sdcard/Projects/RetroDevStudio` não era o worktree Git completo.

O backup privado estava em `/mnt/sdcard/Backups/RetroDevStudio-preformat-20261021T181629Z`. Localize seu destino atual; leia LEIA-ME-ANTES-DE-FORMATAR.md, HANDOFF-NOVO-AGENTE.md, inventários, hashes e mapa de branches. O bundle conserva história e pesquisas; o overlay conserva trabalho local; o backup de dados conserva projetos, insumos e evidências. Não sobrescreva o .git novo ou siga links antigos cegamente. ROMs são insumos externos sob responsabilidade do usuário, não dependências provisionáveis.

Leia as instruções canônicas do checkout: AGENTS, Memory Bank, roadmap, árvore, diretivas, modo de agentes, stack e compliance. Leia a arquitetura REX quando tocar essa frente. Diagnostique/provisione o host antes de mudar produção. Pins do checkpoint: Node 24.18.0 e Rust 1.97.0, sujeitos à conferência dos arquivos atuais. Não reutilize READY antigo nem introduza dependências sem aprovação.

## Estado honesto e evidência obrigatória

O produto tem subsistemas e jornadas técnicas comprovados; continua Experimental. Não há decompilador universal completo nem aceite humano de usabilidade.

Leia os textos em docs/studio_grafico/auditoria_20261020 e o pacote privado studio-audit-20261020-01. Use principalmente HANDOFF_PROXIMO_AGENTE.md (checkpoint 16), coverage.csv, ACHADOS.md, pareceres e erratas LOT025/031. Não se baseie apenas no resumo inicial ou na galeria inicial de 61 cartões.

Corrija por adendo a leitura antiga de que a auditoria nunca compilou/executou ROM: LOT028 fechou editar → salvar/reabrir → Build & Run → verificar/exportar, com build e export idênticos; LOT031 acrescentou execução e Stop. A cobertura das 16 jornadas ainda é parcial, e a causalidade do input permanece limitada.

Prioridades observadas:
- Review dizia “ainda não executado” depois da emulação.
- LOT025 importou/editou/salvou/reabriu Ken, mas dois builds falharam em atlas de 177192960 px, acima de 67108864. Investigue o caso real; não aumente a guarda para aprovar nem retire frames silenciosamente.
- LOT029/030 encontraram guards MUGEN, alguns anteriores à edição testada. Não atribua ao último clique sem provar a causa.
- Mensagem stale de duração, opções “Dano” ambíguas e navegação sem transição são casos a reproduzir. Não confunda UI dirty após Undo, antes de salvar, com corrupção de dados.
- REX LOT024 produziu cópia/BPS sem alterar a base, mas não observou efeito visual nos frames coletados. Não apresentar isso como efeito comprovado nem como refutação das provas históricas de outros episódios.
- Os revisores A/B/C analisaram lotes compartilhados; isso não equivale a execuções independentes ou participantes humanos.

## Princípios de implementação

Reutilize o caminho canônico. Já existem editorStore, studioContext, histórico, runtimeLink, plano de paletas, validação de revisão e serviços de build/patch. Inventarie quem usa cada mecanismo e onde há bypass antes de alterar contratos. Não crie store, orquestrador, gerador, editor, DSL ou harness duplicado.

Defina, por domínio, a fonte autoritativa de projeto/cena, entidade, modelo/instância, asset, animação/ocorrência, revisão, build, ROM e sessão do core. Edição, salvar, compilar, executar, inspecionar e exportar devem se referir ao mesmo conteúdo identificável. Separe estado persistido, rascunho, overrides de teste e resultados de execução.

Uma edição precisa ter alcance claro e ser recuperável. Uma intenção de usuário deve corresponder a uma transação de desfazer; operações em arquivo precisam de recuperação explícita. Nenhum save, importação ou erro deve destruir trabalho alheio.

Mantenha capacidades avançadas acessíveis por aprofundamento contextual. Reduza redundância visual, não capacidade. Evite novas versões GUIADO/CRIADOR/PRO/HACKER do mesmo fluxo. Considere os modos preferências de apresentação sobre os mesmos comandos e dados; preserve compatibilidade até haver migração segura.

## Plano de execução — concluir uma etapa por vez

### E0 — Reconciliar e reproduzir, sem reiniciar toda a auditoria

Fixe checkout/host/binário/inputs. Reutilize lotes e projetos preservados. Faça mapa curto tarefa → tela → estado → serviço → persistência/build/runtime → evidência. Reproduza as lacunas prioritárias e diferencie defeito de produto, limite declarado, ambiente e instrumento. Registre causa ainda desconhecida como tal.

Escolha uma cópia autoral e uma cópia do MUGEN real para conduzir as próximas entregas. Não encerre a rodada apenas com o mapa.

### E1 — Fechar contexto e ciclo de vida

Corrija as inconsistências entre seleção, navegação, dirty/saved, save pendente, build, execução e Review. Testar deve usar a revisão atual prometida pela UI; impedir build silencioso de uma cena/grafo antigo. Resultado atrasado de outro projeto/revisão não pode sobrescrever o atual.

Parar a execução não deve apagar o fato de que aquele artefato foi testado. Editar depois deve indicar que o teste anterior está desatualizado. Exportar deve identificar exatamente a ROM e revisão verificadas.

Defina o fluxo de erro/cancelamento/retentativa. Um build recusado deve explicar o problema, indicar o elemento e abrir sua correção. Play não deve virar um seletor de ROM sem explicar a mudança de tarefa. Runtime Setup deve usar o serviço oficial e o mesmo contexto de host; contagem de ferramentas instaladas não equivale a prontidão.

### E2 — Entregar uma vertical autoral simples e produtiva

Pela UI: criar ou derivar projeto → montar cena → editar personagem/animação → criar comportamento → testar → inspecionar/voltar ao editor → corrigir → salvar/reabrir → revisar/exportar.

O usuário deve saber onde está, o que está selecionado, o alcance da edição e a próxima ação. Retorno preserva seleção, ocorrência e câmera. Testes temporários não gravam estado no projeto; aplicar mudanças passa por revisão e é reversível.

Simplifique o shell enquanto entrega essa vertical: organização à esquerda, trabalho central, propriedades à direita e timeline quando necessária. Reduza rails concorrentes, siglas, banners e controles repetidos; dê espaço ao conteúdo. Não dependa só de cor/hover. Verifique teclado, foco, tooltips, zoom e layout mínimo suportado de 1280×800.

### E3 — Entregar a vertical MUGEN real

Com os insumos privados pinados: analisar → normalizar → planejar recursos → revisar perdas/limites → importar → editar animação/golpe → salvar/reabrir → compilar → jogar → exportar.

Compare escolhas do lote que falha com as provas anteriores, sem assumir mesma configuração. Isole dimensões, eixos, frames repetidos, seleção de animações e empacotamento. Use divisão/paginação/deduplicação/streaming quando adequados e suportados; prove índices e conteúdo preservados. Separe limite do atlas no host de limites medidos do destino. Não substitua sprites reais por formas, não trunque conteúdo em silêncio e não chame comportamento autoral de CNS convertido.

Faça incompatibilidades aparecerem cedo, com ação concreta e preservação do trabalho. Não declare sucesso de importação como sucesso de jogo compilável. A configuração suportada escolhida para esta missão precisa completar a vertical; uma recusa explicada não substitui esse aceite.

### E4 — Tornar os editores uma mesma experiência

Conecte Cena, Personagem, Ações/nodes, Interface, Teste e Entrega sem perder identidade/contexto. Use o NodeGraph existente; representações amigáveis Quando → Se → Fazer devem editar a mesma lógica, sem motor paralelo.

Unifique alcance “esta ocorrência”, “esta instância” e “modelo compartilhado — N usos”. Mostre dependentes antes de mudanças coletivas; não altere instâncias independentes por acidente.

Paletas: plano por cena, bancos disponíveis/compatíveis/reservados/em conflito, referências de uso acessíveis e navegação até cada consumidor. Permita compartilhar quando válido, reatribuir/liberar um uso e trocar paletas por estado/evento. Preveja o impacto coletivo; uma mudança não pode recolorir outros elementos sem indicação. Reuse o planejador existente e mantenha os limites por destino nos adaptadores.

Integre animação, caixas, eventos, sons, textos e cenário conforme as capacidades reais. Um som é um evento temporal; não invente uma região de imagem para selecioná-lo. Diagnósticos devem navegar à propriedade exata. Preserve o hash de conteúdo e as guardas de stale ao clicar na execução.

### E5 — Preservar o fluxo avançado REX

Percorra um perfil comercial já suportado: abrir entrada → conhecer escopo/proveniência → visualizar recurso/lógica → editar cópia → gerar patch → executar episódio → medir efeito esperado → salvar/reabrir/reverter.

Use insumos fornecidos pelo usuário. Mantenha original imutável, identidade por hash, limites e recusas. Elemento desconhecido não abre um editor adivinhado. Não apresentar codec como identificação gráfica, vínculo estático como consumo ou alteração de bytes como efeito de gameplay. Não expandir para novos jogos/codecs nesta missão.

### E6 — Certificar e preparar observação humana

Gates aplicáveis do projeto e jornadas afetadas devem passar no mesmo binário final. Execute ao menos três partidas frias consecutivas das verticais autoral e MUGEN, com expectativa congelada antes e sem mudar critério entre corridas. Isso é um critério de repetição, não certificação estatística de confiabilidade. Preserve falhas e investigue as intermitências.

As ações da jornada devem ocorrer na UI real; sondas internas são observação, não substituição de cliques. Não edite project.rds/JSON por fora para completar uma tarefa ausente na interface. Fixtures de preparação são identificadas separadamente.

Teste conteúdo persistido, efeito na ROM/core, igualdade da exportação com o artefato verificado, Undo/Redo, cancelar, respostas antigas, renomear asset, alteração no mesmo caminho e reabertura. Não use apenas snapshots visuais ou testes que repitam a implementação.

Prepare um pacote neutro de antes/depois, passos e limites para revisão externa. Faça sessão humana quando houver participante; registre conclusão, ajuda, erros e recuperação. Sem participante, mantenha usabilidade pendente e entregue separadamente o aceite técnico.

## Organização, plataforma e entrega

Não amplie plataformas/importadores nem crie uma nova arquitetura universal agora. Separe conceitos de criação dos adaptadores de hardware e preserve regressões existentes, inclusive SNES. Técnicas avançadas precisam de custo/limite medido; não atribua restrições de um conversor ao console inteiro.

Use diretórios aprovados e uma única área de evidência da rodada, com manifest, hashes e índice requisito → implementação → teste → resultado → limite. Mantenha estado no Memory Bank/roadmap e evidências detalhadas no local apropriado, sem diários canônicos paralelos. Não apagar lotes congelados, corpus ou scratch alheio.

A cada marco, registre código/binário, comandos, provas novas/herdadas, falhas, limites e próximo passo exato. Preserve progresso em commits coerentes e publique apenas material próprio/curado conforme as regras do projeto. Sem force-push, merge, release ou promoção automática. Não deixe processos de teste ou observadores próprios abandonados.

Entrega mínima: verticais autoral e MUGEN completas, causas prioritárias resolvidas, navegação/contexto coerentes, UI menos densa com funcionalidade preservada, regressões e evidências no binário final, atalho testado e pendências com dono/critério. Uma coleção de componentes novos ou um relatório extenso não substitui essa entrega.

Comece pela reconciliação e pela primeira reprodução; siga até fechar as etapas autorizadas, sem solicitar GO a cada subetapa. Falta real de insumo/autorização deve ser descrita com precisão, enquanto você continua tarefas independentes.
