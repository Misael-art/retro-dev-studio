# Missão — experiência integrada de criação, importação, edição e teste

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
