# Missão — experiência integrada de criação, importação, edição e teste

**Retomada 2026-11-04 (SHA publicado e verticais finais):** fonte de produto local/remota `69ffaecbb744b08068c0693ee0f26596dd993926`, PR #112 aberto; dois `desktop-smoke` Windows, dois `linux-validate` e dois `validate` **SUCCESS no mesmo SHA**. Executável Tauri SHA-256 `43f0b85bebbca5d89027ffea9bc13ec4bbb5e47edbac1124a8da8af223dfd9d6`. MD `reference-platformer` 24/24, autoral três corridas frias 10/10, MUGEN Ken real três frias 14/14 e SNES guiado 4/4 (PVSnesLib, Snes9x, ROM/export SHA `8a503477…ea7eff0`) passaram nesse binário. Relatórios e recibos exatos no checkpoint mais novo do Memory Bank. `host:certify` READY/7 e Clippy/fmt PASS; publicação privada, merge, release e deploy não realizados. A matriz abaixo distingue prova do subset e pendências: nenhum PASS local equivale a aceite humano ou compatibilidade geral.

**Adendo de prova do binário final:** `studio-appearance-2026-11-04T04-31-36-308Z-report.json` PASS em 17 etapas/44 medições (36 combinações críticas tamanho/tema/zoom, foco, teclado, scroll, contraste, Inspector e paleta); `build-blocked-diagnostic` PASS pelo recibo `RDS_WORK_ROOT/sessions/2026-11-04T04-33-34-672Z-699059/receipt.json`, sem relatório JSON de sucesso. O primeiro teste registra `human_usability: pending`; o segundo indica asset faltante e correção pertinente, sem promover ROM antiga. Detalhes/limites no Memory Bank. Próximo: gate documental, commit/push e checks do SHA novo; depois negativos restantes.

#### Matriz J00–J15 — evidência disponível no binário final

`Tauri/ROM` significa etapa nativa e efeito/artefato observados no subset indicado, não conclusão de toda a intenção; `Tauri` significa UI/persistência sem efeito de jogo completo. Cada linha herda binário `43f0b85b…dfd9d6`, fonte `69ffaecb`, reports `reference-platformer-2026-11-04T03-44-07-344Z`, `authoring-acceptance-2026-11-04T04-{19-06-499,21-44-294,25-08-978}Z`, `studio-e1-2026-11-04T{03-51-42-495,04-00-50-924,04-10-18-098}Z` e `snes-guided-authoring-2026-11-04T04-27-31-282Z`, conforme o recorte; nenhum projeto/ROM/captura privada vai ao Git.

| Jornada | Estado verificado | Prova do recorte e limite para a intenção completa |
| --- | --- | --- |
| J00 abrir e orientar | Tauri | Wizard, recursos, layout/teclado nas três autorais; atalho para o binário final e onboarding leigo ainda sem aceite humano. |
| J01 criar jogo | Tauri/ROM | Três autorais 10/10: editar, salvar/reabrir e vencer pelo teclado; exploração humana pendente. |
| J02 importar MUGEN | Tauri/ROM | Ken 3×14/14: sete entradas por SHA, 103 animações/417 ocorrências, ROM/frames/export; dialetos gerais não cobertos. |
| J03 adaptar golpe | Integrada | Ocorrência MUGEN editada e efeito de pixels; sem demonstração semântica de ataque/HitDef jogável. |
| J04 animar/desenhar | Tauri | Edição de ocorrência MUGEN e animação autoral persistem; pintura de pixels do personagem real não repetida nessa série. |
| J05 cenário/colisão | Tauri/ROM | Referência 24/24: objeto/camada/mapa, corte recusado, Undo/Redo e efeito Player/colisão na ROM; outros cenários não provados. |
| J06 paletas/troca | Tauri | Índices/paleta MUGEN preservados e orçamento diagnosticado; troca visível no jogo pendente. |
| J07 UI/texto/áudio | Tauri | Regra/passagem e vínculo de som autorais salvos; escuta/saída física e efeito sonoro na ROM pendentes. |
| J08 adaptar projeto | Tauri/ROM | Referência e Ken salvos/reabertos, reconstruídos e executados; cobertura de projetos arbitrários pendente. |
| J09 NodeGraph | Tauri/ROM | Comportamento de objetivo autoral e referência chega à ROM; organização/interação de grafo grande ainda parcial. |
| J10 testar/retornar | Tauri/ROM | Build→core→volta→edição/rebuild na referência; outras revisões/cores exigem seus próprios testes. |
| J11 explorar ROM BYOR | Pendente no binário final | LOT024 histórico cobre perfil assistido; requalificação REX no SHA atual não executada. |
| J12 recuperar/testar cópia | Pendente no binário final | LOT024 histórico preserva patch/cópia; efeito semântico não observado, não promover. |
| J13 revisar/exportar | Tauri/ROM | Ken e SNES exportaram ROM de hash igual ao build executado; revisão humana/licença não certificadas. |
| J14 recuperar erros | Tauri | Corte/cancelamento/Undo/Redo, seleção de arquivo cancelada/inválida e asset ausente cobertos no binário final; troca de projeto, recurso compartilhado, paletas ocupadas e hardware ainda exigem matriz. |
| J15 outras superfícies | Pendente | RetroFX visto historicamente, sem edição/runtime no binário final. |

**Próximo incremento:** publicar a reconciliação documental já revisada e executar os negativos restantes no E2E canônico, com identidade do binário. Arquitetura: `architecture:metrics` mediu concentração crescente em `project_mgr.rs`, `lib.rs`, `App.tsx` e `ViewportPanel.tsx`; extrair só ao haver contrato testável e regressão concreta. Windows CI verde não substitui teclado/áudio/GPU físicos, console, zoom por atalho WebKit nem aceite humano; manter `Experimental`.

**Dívida delimitada de arquitetura:** `App.tsx` (6079 linhas, owner shell) concentra transições de layout; extrair a aplicação do preset quando um teste isolado puder reproduzir o colapso/resize sem montar o app inteiro. `ViewportPanel.tsx` (5849, owner viewport) concentra arbitragem de ponteiro; extrair o controlador do gesto quando uma nova regressão exigir o mesmo estado em outro workspace, mantendo o `sceneComposition` atual. `project_mgr.rs` (29760, owner persistência/importação) só deve separar restauração/importação quando houver contrato de fonte resolvida versus persistida reproduzível na nova unidade. `lib.rs` (12268, owner IPC) só deve separar registro/dispatch quando um erro de roteamento puder ser isolado sem mudar nomes dos comandos. `e2e-tauri-build-run.mjs` (30696, owner E2E) já isola cenários em funções; mover driver/sessão para módulo requer prova de mesmo binário, WebDriver e recibo nos cenários MD/SNES/MUGEN. Nenhuma dessas extrações foi feita apenas para reduzir contagem de linhas; o ciclo nativo está verde e a mudança de fronteira agora acrescentaria risco sem regressão alvo.

**Retomada 2026-11-04 (shell compacto validado localmente; publicação pendente):** HEAD local/remoto `320562fa2069f2704ea4c62b5c1f84013429a289`, PR #112. CI validate/Linux PASS, dois desktop-smoke Windows FAIL no botão de tilemap após Jogo/Debug. Reprodução Linux em 1024×768 confirmou Hierarquia com 0 px e botão sob splitter; depois, paleta flutuante cobria uma célula inferior. Correções locais nos owners `App.tsx` e `ViewportPanel.tsx` e sincronização nativa do E2E deram `reference-platformer-2026-11-04T03-44-07-344Z-report.json` **24/24 PASS** no binário final SHA `43f0b85b…dfd9d6`, SGDK/core oficiais e ROM reaberta igual à revisão salva. `host:certify` READY/7 gates (1383 frontend/1169 Rust, smokes oficiais), Clippy completo/fmt PASS. A primeira certificação falhou por referência BYOR ausente no ambiente e foi preservada; a referência existente passou por SHA e a repetição completa passou. Três corridas autorais frias 10/10 e uma MUGEN 14/14 pertencem ao binário anterior `4bbbb74c…61cf7`; manter limites separados. Próximo: diff/commit/push/CI do SHA novo, depois repetir verticais/dois alvos/matriz. Falhas e recibos preservados no Memory Bank; Windows, humano e hardware físico não aprovados.

**Retomada 2026-11-04 (PLAT11 pronto localmente, GitHub pendente):** fonte/roteiro no commit local `406ca3c4b78baabf33d9343a6e69b2a02702c4ac`, remoto ainda `71741089` nesta nota. Binário oficial `4bbbb74c…61cf7`; negativo de asset ausente PASS e `reference-platformer-2026-11-04T01-03-24-020Z-report.json` **24/24 PASS** no mesmo Tauri/Linux com SGDK/core oficiais, ROM inicial `32165d36…dcf72d`, RAM Player x32/y176, colisão, orçamento e apresentação medida. `host:certify` READY/7 gates após reboot (1383 frontend/1169 Rust; smokes oficiais), Clippy completo/fmt PASS. A trava vazia de outro boot foi arquivada com recibo; falhas antigas permanecem. Duas execuções Windows no SHA `71741089` falharam no tilemap obstruído pelo splitter; roteiro agora espera alvo nativo desobstruído, e o CI do novo SHA deve provar Windows. Próximo: diff documental/commit explícito, push normal, confirmar remoto/PR #112/checks; então J00–J15/dois alvos, arquitetura e roadmap. Provas privadas não vão ao Git; humano, GPU/áudio físicos, console e Windows ainda pendentes. Detalhes, SHAs e comandos no checkpoint novo do Memory Bank.

**Retomada 2026-11-03 (PLAT11 qualificado localmente):** PLAT10 publicado como `71741089198f23cc4f7a0f43c9c87de4635590e9`, PR #112 aberto; PLAT11 ainda sem commit nesta nota. Debug contextual, escopos de projeto/revisão/ROM/core, colisão, RAM pausada, limites e FPS de apresentação passaram no Tauri final `68aa261d…41361`: `reference-platformer-2026-11-03T22-36-36-158Z-report.json` 24/24 PASS, build negativo de asset ausente PASS no mesmo binário. `host:certify` READY (1382 frontend/1169 Rust, smokes oficiais), mas anterior ao último ajuste do baseline da automação; App.test e desktop positivo/negativo posteriores passaram. Falhas intermediárias preservadas. Próximo comando e limites no checkpoint mais novo do Memory Bank. Não confundir medidas de interface com clock da simulação nem promover `Experimental`.

**Retomada 2026-11-03 (PLAT10 qualificado localmente):** PLAT05 publicado como `091ba3a940194ae33c48966865468a92e6c2e233`, PR #112 aberto. Linux PASS; Windows desktop-smoke falhou ao ler a ponte de Arte antes da montagem, e o E2E agora espera o recurso exato. Binário oficial final desta árvore `4a48f5cf…19bbe9`, `studio-appearance-2026-11-03T21-29-55-331Z-report.json` PASS: 36 combinações de três tamanhos, quatro temas e zoom CSS 125/150/200%, sem transbordamento, Inspector/paleta alcançáveis, foco/setas e roda nativa nas quatro paletas, Build→ROM→core no Tauri. `host:certify` READY (1380 frontend/1169 Rust PASS e smokes oficiais); Clippy/fmt PASS. A última linha do oráculo E2E entrou durante certify e foi provada no Tauri final; ver limite no Memory Bank. Falhas intermediárias preservadas. **Próximo:** revisão, commit explícito, se viável prova no SHA limpo, push/PR/checks; depois PLAT11 e 16 jornadas. Zoom por atalho do WebKit, usabilidade humana, Windows, GPU/áudio físicos e console pendentes; `Experimental` mantido.

**Retomada 2026-11-03 (PLAT05 em validação):** PLAT12 publicado no local/remoto como `6053dd1091da30fec1033c040957bffb85d92505`, PR #112 aberto. O incremento atual de Arquivos/Arte/usuários de recurso compartilhado ainda não foi commitado. Binário oficial `0dc45f4c…27d24`, `reference-platformer-2026-11-03T19-17-13-499Z-report.json` e `reference-platformer-2026-11-03T19-46-37-195Z-report.json` **23/23 PASS** no Tauri com SGDK/core; a navegação Arquivos→Arte/Cena/Lógica→Arquivos e a ROM PLAT12 foram observadas. Falha anterior de leitura prematura do arquivo após salvar preservada; `host:certify` READY após repetir com a referência BYOR já documentada (1380 frontend/1169 Rust PASS), Clippy completo/fmt PASS. CI do SHA anterior: Linux PASS, Windows desktop-smoke FAIL porque a borda da colisão estava fora do palco. O roteiro agora usa zoom visível quando necessário, com prova Linux repetida; Windows depende do próximo SHA. **Próximo:** revisão/commit/push/checks do PLAT05; depois PLAT10/11 e jornadas. Limites no Memory Bank.

**Retomada 2026-11-03 (PLAT12 qualificado localmente):** a autorização atual permite commits, push normal e PR #112, sem merge/release/deploy nem publicação privada; notas antigas de não publicar descrevem somente aquelas sessões. Base `86831164` com alterações ainda não commitadas. Binário oficial SHA `719756933855b6493d8854274a0fbc9f9e3d45f8d3899b0b4e4e6e5a70056e9d`, duas corridas frias Tauri Linux/Xvfb **22/22 PASS** (`reference-platformer-2026-11-03T18-07-44-362Z-report.json`, `reference-platformer-2026-11-03T18-14-36-303Z-report.json`). Objeto, camada sem mapa, recusa de corte, mapa deslocado, restauração/cancelamento/Undo/Redo/reabertura e efeito em RAM da ROM `933d231e…6135f8` foram separados no roteiro oficial. `host:certify` READY: 1376 frontend/1169 Rust PASS, smokes SGDK/PVSnesLib PASS; Clippy completo/fmt PASS. Falhas anteriores de WebDriver e tilemap preservadas; ver checkpoint mais novo do Memory Bank. **Próximo:** revisar e publicar incremento PLAT12; então PLAT05/10/11 e matriz de jornadas. Windows e aceite humano seguem pendentes, `Experimental` mantido.

**Retomada local 2026-11-03 (PLAT12 parcial):** commits locais `6fa4330` (movimento explícito de camada/mapa global) e `6439e3b` (largura de painéis na transição), sobre o checkpoint documental alheio `3656021c`; sem push. Binário `8b04a7bc…ffe0380a`: `reference-platformer` 18/18 PASS no Tauri Linux/Xvfb, com grupo +16 px, Undo/Redo, ROM `a4a2ee64…f53bc` e Player x32→48 na RAM, tilemap após reabrir; SNES smoke PASS. `host:certify` READY após corrigir só o `TMPDIR` da sessão, 1375 frontend/1168 Rust PASS, upstream PASS; Clippy completo/fmt PASS. Primeira certificação BLOCKED por seis testes `new-host` com `TMPDIR` oculto, recibo preservado. Recibo global posterior de diagnose não contém gates; ver Memory Bank. **Próximo:** fechar PLAT12 com restauração explícita do template e prova positiva de mapa deslocado em UI/ROM; depois PLAT11. Windows/aceite humano, atalho e matriz total seguem pendentes. Restrição sem publicação permanece.

**Retomada anterior 2026-11-03:** o checkpoint daquela etapa do Memory Bank registra o commit local `981cdb7d` (layout do shell após reabrir projeto), binário `85545be3…`, sete cenários desktop + QA RC A–H PASS no Linux, e `host:certify` PASS/READY após repetir com a referência BYOR já documentada. A primeira certificação falhou sem essa variável e permanece evidência de falha. O PR #112 remoto ainda está em `aca5f1b1` com dois `desktop-smoke` Windows vermelhos; o operador vedou publicação nesta retomada. Não atribuir os PASS locais ao CI remoto, não repontar o atalho em uso e não promover as jornadas humanas. O próximo incremento então era PLAT12; ver o checkpoint acima para o estado atual.

**Prompt vigente: 2026-11-02.** Handoff executável da frente de coesão. A versão anterior permanece no Git e no Memory Bank como histórico; caminhos, PIDs e SHAs antigos não autorizam retroceder fontes ou encerrar processos. O pedido atual autoriza implementar e validar **PLAT01–12**, preservando as premissas do projeto.

## Prompt para o agente executor

Você assume a implementação da experiência de uso do RetroDev Studio. Entregue um ambiente em que um usuário leigo consiga **criar ou importar um projeto, encontrar seus elementos organizados, editar arte/animação/lógica/áudio/câmera, jogar, voltar ao ponto de edição e continuar após salvar/reabrir**. Preserve capacidade técnica, fidelidade e compatibilidade. A interface deve ser legível, esteticamente coesa e funcional em cada etapa.

O pedido é de execução: reproduza, corrija, integre, teste jogando e repita até fechar a jornada. Não encerre em outro diagnóstico, plano, protótipo visual ou build que apenas abre. Use a análise existente como backlog e vá à primeira reprodução verificável.

### 1. Contexto, autorização e continuidade

Leia `AGENTS.md`, a política de Projects, Memory Bank, roadmap, árvore, diretivas, modo de agentes, stack/compliance e `docs/handoffs/NOVO_HOST_INICIO.md`. Consulte a arquitetura REX quando tocar a ponte ROM/canvas ou seus perfis.

Leia `docs/handoffs/REAVALIACAO_PRODUTO_2026-10-24.md`, especialmente o adendo de 02/11 e a matriz **PLAT01–12**. Dez capturas e relatório privado: `RDS_WORK_ROOT/sessions/platformer-journey-audit-20261102/`. Se esse runtime faltar, use o registro canônico e declare a evidência indisponível.

Responda `[Contexto Carregado]`. Confira HEAD, branch, remoto, PR112/checks, alterações locais e owners. Base documental: `d295fbcf6b7b5b9727c37de83835e6cc31677447`; avance sobre a ponta válida, preservando trabalho posterior.

Use somente `/home/misael/Projects/RetroDevStudio`. Prefixe comandos com RTK. Reutilize launcher/host-manager, diagnóstico e ambiente oficiais; `RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio`, inicialmente `RDS_BUILD_JOBS=1`. Confira disco/RAM/carga; uma operação pesada por vez.

Preserve app, dados e leases do operador. Não mate processos alheios nem remova locks legítimos. Se uma etapa exigir sessão exclusiva, solicite uma única ação indispensável pelo fluxo oficial e avance nas partes independentes; não apresente esse impedimento como missão concluída.

Não crie outro checkout, store, motor, DSL, editor ou harness concorrente. Preserve decisões arquiteturais consolidadas. Dependência nova indispensável exige justificativa, compatibilidade/lock/stack e gates. Esta missão integra capacidades atuais; não inicia novas plataformas/importadores nem substitui a missão separada de decompilação universal.

Preserve Tauri + React/TypeScript + Rust, UGDM, SGDK/PVSnesLib e Libretro. Sem Electron, Redux ou Python no runtime do aplicativo. Os limites reais de hardware e as guardas de segurança não podem ser elevados, ignorados ou mascarados para fazer a jornada passar.

### 2. Identifique a versão realmente entregue — PLAT01

Na análise, atalho e processo ativo usavam o app **263205d8 de 30/10**, enquanto a qualificação recente de câmeras pertence ao candidato **29b9b21f** e ao código **c359eab9**. O HEAD do recibo do launcher não identifica sozinho o binário aberto.

Reconfira fonte incorporada, SHA do executável, launcher e atalho. Prepare o candidato correto e valide sua abertura normal após transição segura, preservando projeto/sessão em uso. Não atribua defeitos do app antigo ao novo nem declare resolvido porque existe um botão na fonte. A entrega final deve abrir pelo atalho usado pelo operador e identificar sua versão efetiva.

### 3. Módulos e scripts que devem trabalhar juntos

Inspecione chamadores e testes destes owners, conferindo possíveis renomes. Estenda o caminho oficial; não crie um script isolado por tela.

| Responsabilidade | Fontes existentes |
|---|---|
| Shell, início e navegação | `src/App.tsx`; `src/components/common/ProjectStartWizard.tsx`; `src/core/workspaceLayout.ts`; `src/components/common/StudioContextBar.tsx`; `src/components/common/LayoutSplitter.tsx` |
| Identidade, contexto, histórico e persistência | `src/core/store/editorStore.ts`; `src/core/studioContext.ts`; `src/core/scenePersistence.ts`; `src/core/runtimeLink.ts` |
| Template, importação e dados nativos | `data/template_registry.json`; `src-tauri/src/core/project_mgr.rs`; `src/core/ipc/projectService.ts`; `src/core/ipc/sceneService.ts` |
| Cena, coordenadas e câmera | `src/components/viewport/ViewportPanel.tsx`; `src/core/sceneWorldModel.ts`; `src/core/cameraWorkflow.ts`; `src/components/inspector/CameraConfigurator.tsx`; `src/components/inspector/CameraAdvancedControls.tsx`; `src/components/inspector/InspectorPanel.tsx` |
| Arquivos, arte e entrada de imagens | `src/components/explorer/ExplorerWorkspace.tsx`; `src/components/artstudio/ArtStudioPanel.tsx`; `src/components/artstudio/PixelEditor.tsx`; `src/components/artstudio/ImageIngress.tsx`; `src/core/imageIngress.ts` |
| Lógica, organização e comportamento | `src/components/nodegraph/NodeGraphEditor.tsx`; `src/core/nodegraph/nodeLayout.ts`; `src/core/nodegraph/nodeCatalog.ts`; `src/core/nodegraph/nodeDefinitions.ts`; `src/core/nodegraph/behaviorLibrary.ts`; `src/core/nodegraph/graphHistory.ts` |
| Paletas e apresentação | `src/core/palettePlan.ts`; `src/core/palettePlanStore.ts`; `src/components/inspector/PalettePanel.tsx`; `src/components/common/Icon.tsx`; `src/styles/index.css` |
| Áudio e diagnóstico | `SoundPanel` no `NodeGraphEditor.tsx`; `src/components/tools/ToolsPanel.tsx`; recursos/serviços de áudio existentes; `runtimeLink` |
| Compilação e apresentação | `src-tauri/src/compiler/build_orch.rs`; `src-tauri/src/compiler/ast_generator.rs`; `src-tauri/src/compiler/camera_runtime.rs`; `src-tauri/src/compiler/sgdk_emitter.rs`; `src-tauri/src/compiler/snes_emitter.rs` |
| Host, build e testes desktop | `scripts/new-host.sh`; `scripts/new-host.ps1`; `scripts/new-host.mjs`; `scripts/host-manager.mjs`; `scripts/build.mjs`; `scripts/e2e-tauri-build-run.mjs`; `package.json` |

### 4. Composição inicial e gestos — PLAT02–03/12

O template deve abrir pronto: arte montada, personagem no chão, objetivo/sensores coerentes, colisões alinhadas e câmera inicial válida. Enquadrar a visualização não altera posições do projeto.

Reproduza a divergência legada: renderer usa `centro do sprite + offset − meia tela`; emissor usa `posição do alvo + offset`, limitada ao mundo. No template, o editor resulta em moldura `(−264,−32)`. Corrija contrato/compatibilidade; não compense deslocando background nem migre projetos existentes silenciosamente na abertura.

Separe coordenadas do mundo, câmera do jogo, pan/zoom e origem do canvas. Arrastar Player não pode realimentar a origem do gesto e escapar do ponteiro. Mostre quem a câmera segue e distinga edição do mundo de prévia da câmera.

Diferencie mover objeto, mover composição vinculada e pan. Arte, colisão, spawn e sensores só se movem juntos quando escolhido e suportado, numa transação reversível. Restaurar composição do template deve ser ação explícita com prévia e preservação de edições.

Investigue a importação aberta após pan central. Registre ordem/origem dos eventos mouse/pointer/auxclick/paste, clipboard e seleção primária. O conflito de colagem é hipótese, não captura de tela comprovada. Corrija a causa sem debounce arbitrário e sem desabilitar Ctrl+V, soltar imagem ou importação explícita. Teste pans sobre canvas, cartões, portas e bordas com imagem/texto na transferência.

### 5. Continuidade entre ferramentas — PLAT04–06

- Lógica geral apresenta comportamentos existentes; entrada por objeto conserva esse objeto. O grafo pronto pertence ao Player; Main Camera pode funcionar por componente sem nós. Diferencie carregamento, erro, ausência legítima e criação de novo fluxo.
- Ofereça **Ver na cena, Editar arte/animações, Editar comportamento, Configurar câmera e Ver usos**, conforme o tipo. Não encaminhe uma câmera para um editor vazio de sprites como única saída.
- Arquivo e instância são identidades distintas. Mostre alcance e dependentes; se houver vários usuários de um asset, apresente a escolha. Destino único inequívoco não exige pergunta adicional.
- Arte deve carregar imagem, quadros e animações existentes; não exigir reimportação. Sem sprite selecionado, ofereça os assets/personagens da cena. Tilemap abre a ferramenta apropriada à sua edição.
- Torne Configurar câmera visível junto da moldura/Inspector. Reutilize padrões, alvo, composição, limites, suavidade, salas, regiões e eventos implementados. Distinga editar câmera, enquadrar vista e ver o resultado do jogador.
- Voltar conserva cena, entidade, asset, animação/ocorrência e vista. Cancelar/Undo/Redo/salvar têm alcance previsível. Respostas de outro projeto/revisão nunca sobrescrevem o atual.

### 6. Lógica visual legível e operacional — PLAT07–09

Abra grafos existentes por comportamento: movimento, salto, animação, áudio, objetivo e câmera, conforme conteúdo real. Não substitua lógica por wizard nem invente conexões para preencher a tela.

Use dimensões reais dos cartões para layout sem sobreposição. Preserve parâmetros, conexões, grupos, fixações e posições manuais; ofereça organização inicial segura e Organizar/Enquadrar/Centralizar com Undo. Não reorganize silenciosamente a cada visita. Minimap deve ser encontrável em grafos grandes, recolhível e com preferência lembrada. Fios, portas e ramos precisam ser legíveis; navegar não inicia outra tarefa.

No ponto de uso do som: recurso identificado, seletor, **Ouvir/Parar**, estado e diagnóstico. Reutilize a prévia WAV existente. Música VGM/XGM exige prévia compatível real; limitação permanece explícita enquanto faltar implementação. Botão sem áudio não recebe PASS. A associação deve persistir e tocar no evento correto na ROM.

Nó que afeta um personagem oferece acesso direto à sua arte/animação e recursos vinculados. Não obrigue localizar novamente o mesmo Hero.

Apresente **deslocamento imediato, velocidade mantida, aceleração, gravidade, frenagem e impulso** de forma coerente. Um painel Movimento e salto edita os mesmos nós/componentes, com unidades reais do backend. Não acrescente parâmetro sem consumidor nem outra fórmula/store para simular simplicidade. Prove o efeito de cada ajuste na ROM, além da prévia do editor.

### 7. Criação e importação entregam projetos utilizáveis

Congele uma matriz de aceite, com insumos existentes/autorizados, revisão/hash, perfil, expectativas e limites:

1. Template de plataforma Mega Drive novo, sem ajustes iniciais manuais.
2. Projeto autoral do zero com cena, personagem, comportamento, objetivo e áudio.
3. Projeto SGDK suportado, com recursos e lógica reconhecidos apresentados corretamente.
4. Projeto/personagem MUGEN do subset suportado, com animação, comportamento/bridge e limites explícitos.
5. Projeto nativo editado e reaberto; regressão SNES das capacidades compartilhadas.

Use cópias de trabalho identificadas sem duplicar fontes do aplicativo. Preserve originais. Corpus ausente exige indicação precisa, não download de ROM ou conteúdo inventado.

A importação organiza cenas, objetos, assets e comportamentos identificáveis com vínculos rastreáveis e pronta continuidade onde houver suporte. Folha de tiles não se apresenta como cenário montado. Conserve metassprites, aliases, paletas, transparência e duração dos quadros. Preserve o fluxo existente de imagem/GIF sem impor preparação externa desnecessária.

Use o plano canônico de paletas para mostrar bancos livres, compartilhados, reservados e em conflito, com consumidores identificáveis. Reatribuir/liberar um uso deve ter alcance e impacto claros. Não recolora outros objetos, descarte frames, substitua assets por formas ou reduza qualidade silenciosamente para caber num orçamento. Otimização necessária precisa conservar o conteúdo ou apresentar uma decisão compreensível e reversível.

O que não for recuperável deve indicar item, causa, alcance e ação disponível. Bridge/código preservado continua identificado; não vira lógica visual completa por rótulo. Uma recusa correta cobre o negativo, mas não substitui o projeto positivo que precisa fechar o percurso suportado. Não transforme o aceite SGDK/MUGEN numa promessa de conversão geral de C/CNS ou de qualquer ROM.

### 8. Qualidade estética, acessibilidade e diagnóstico — PLAT10–11

Use os tokens e a linguagem visual existentes: hierarquia clara, nomes consistentes em português, ícones reconhecíveis com rótulos nas ações importantes, espaçamento coerente e espaço de trabalho em destaque. Reduza banners/instruções redundantes; conserve detalhes avançados por aprofundamento contextual.

O Inspector prioriza o objeto editado. Paletas globais/contratos não empurram suas propriedades para fora da tela. Assets têm prévias identificáveis; seleção e alcance são evidentes.

Valide pelo menos 2048×864, 1366×768 e 949×593 pixels lógicos; os quatro temas no teste visual; claro/escuro e zoom 125%, 150% e 200% nos percursos críticos. Timeline, prévias, campos e ações continuam alcançáveis por scroll/teclado. Verifique contraste, foco visível, rótulos e alternativas ao botão central/arraste. Não dependa só de cor, hover ou tooltip para uma tarefa essencial.

Depurar parte do projeto/ROM atuais: por que não compila, onde há colisão, qual estado mudou, qual recurso excedeu o limite e o que está sendo medido. Diferencie estimativa estática, observação do core e apresentação do frontend. Indisponível não é zero; FPS de apresentação não é clock do jogo. Informe origem, janela, versão/artefato e caminho de correção. Não invente telemetria para preencher cartões.

### 9. Refazer a jornada jogando e retornando à edição

Percorra pelos controles reais, nos projetos positivos de aceite:

**Atalho/launcher → criar/importar → reconhecer organização → compor cena → mover herói/objetivo e desfazer/refazer → configurar câmera → abrir lógica existente → organizar/navegar → editar arte/animação → escolher/ouvir som → ajustar movimento/regra → salvar → Build→ROM→jogar → pausar/inspecionar → voltar ao elemento → corrigir → reconstruir/jogar → fechar/reabrir → revisar/exportar.**

Escolha mudanças observáveis: posição, quadro/duração, velocidade/impulso, condição do objetivo e som de evento. Congele expectativas antes do teste; confira efeito, persistência e hash do artefato executado, não só clique ou mensagem verde.

Quando falhar: preserve evidência, determine causa, corrija no owner, acrescente regressão pertinente e repita o trecho e o ciclo afetado. Não troque fixture difícil, elimine cenário ou afrouxe critério para concluir.

Negativos obrigatórios: build falho sem executar ROM antiga como nova; asset ausente/incompatível; projeto trocado durante tarefa; cancelar/repetir; recurso compartilhado; paletas ocupadas; limites de hardware; pan com imagem na transferência; resize/zoom; Undo/Redo; retorno de Teste; salvar/reabrir. Recuse resultados/frames de outro core/revisão pelo mecanismo existente.

Repita as verticais autoral e MUGEN três vezes a frio, sem reparos externos entre corridas. Para SGDK e SNES, execute o percurso suportado e declare alcance. Repetição local não é certificação estatística de qualquer entrada.

Não edite JSON/project.rds por fora para completar uma função ausente na UI. Separe preparação de fixture da prova. Sondas internas observam; não substituem ações reais. Use Tauri e SDK/core oficiais; Vite e testes unitários não aprovam desktop ou gameplay.

### 10. Scripts e gates oficiais

Use o ambiente/target do launcher, conferindo cobertura dos cenários antes de acrescentar testes. Amplie o runner existente onde necessário, sem harness paralelo. Execute builds/suites pesadas sequencialmente:

```text
rtk proxy npm run host:diagnose
rtk proxy npm run check:tree
rtk proxy npm run lint
rtk proxy npx tsc --noEmit
rtk proxy npm test
rtk proxy cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
rtk proxy cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1
rtk proxy cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
rtk proxy npm run build:debug
rtk proxy npm run test:e2e:desktop:reference-platformer
rtk proxy npm run test:e2e:desktop:create-game-from-zero
rtk proxy npm run test:e2e:desktop:nodegraph-authoring
rtk proxy npm run test:e2e:desktop:authoring-acceptance
rtk proxy npm run test:e2e:desktop:behaviors-independence
rtk proxy npm run test:e2e:desktop:qa-rc
rtk proxy npm run test:e2e:desktop:md
rtk proxy npm run test:e2e:desktop:snes
rtk proxy npm run host:certify
```

Esses comandos existem; isso não afirma cobertura integral. Forneça parâmetros/fixtures pelo mecanismo oficial e registre-os. Execute auditorias npm/Cargo/licenças se dependências/segurança mudarem e gates de crates quando afetados. Não ignore precondições BYOR nem herde resultados de outro SHA/binário.

### 11. Ordem de execução e fechamento

- **Lote A:** PLAT01–03/12 — versão efetiva, composição/coordenadas e arbitragem de gestos.
- **Lote B:** PLAT04–07/10 — contexto, acesso à câmera, assets, organização dos nós e legibilidade/reflow.
- **Lote C:** PLAT08–09/11 — áudio no ponto de uso, movimento compreensível e diagnóstico útil.
- **Lote D:** criação/importação completas, partidas/retorno, reabertura/exportação e regressões no mesmo binário final.

Feche cada PLAT01–12 com causa, implementação, regressão pertinente, prova UI/runtime e limite. Mantenha matriz requisito→fonte/script→projeto→resultado→artefato/hash→pendência. Diferencie proposto, implementado, validado tecnicamente e aceito pelo usuário.

Aceite técnico: matriz positiva completa no binário final identificado, sem bloqueios conhecidos no percurso prometido; interface organizada/legível, dados preservados, importação útil, edição integrada, efeito no gameplay, retorno previsível, persistência e exportação verificadas. Nenhum botão essencial decorativo. Superfícies parciais continuam Experimental e com caminho de trabalho explícito.

Prepare projeto autoral limpo e roteiro neutro para usuário leigo testar sem condução do agente. Registre conclusão, ajuda, erros e recuperação. Sem participante, entregue o técnico e mantenha aceite humano pendente; não o simule.

Atualize Memory Bank, adendo de reavaliação e este handoff. Preserve falhas, receitas e evidências nos destinos oficiais com hashes/retenção. Não publique screenshots privadas, ROMs, corpus, credenciais ou assets de terceiros no Git. Faça commits curados/push no branch existente, reuse o PR e confirme SHA remoto. Sem merge/release/deploy implícitos.

Prossiga autonomamente nas correções reversíveis autorizadas. Não peça GO a cada arquivo/subetapa. Limite de contexto exige checkpoint retomável com causa, SHA, estado e próximo comando, não conclusão fictícia. Impedimento externo exige pedido único e preciso e avanço no trabalho independente.

**Entrega ao operador:** app pelo atalho correto, projetos de teste organizados, resumo das melhorias de experiência, matriz PLAT01–12, provas criar/importar→editar→jogar→retornar→reabrir, gates/identidade do binário e limites honestos. O resultado deve permitir continuar construindo o jogo sem precisar descobrir a estrutura interna do programa.
