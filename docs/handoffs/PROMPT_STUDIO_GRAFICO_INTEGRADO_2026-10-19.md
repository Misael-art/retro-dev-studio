# Prompt para implementar o Studio Gráfico Integrado

Data: 2026-10-19. Destinatário: agente responsável pela implementação e integração. Este arquivo registra a missão solicitada pelo operador; não declara funcionalidade implementada, não substitui o estado canônico e não promove maturidade.

## 1. Missão e forma de trabalhar

Implemente uma jornada contínua no RetroDevStudio: selecionar na cena ou no jogo executado → abrir o editor correspondente → editar → salvar → testar → retornar ao mesmo contexto. Integre cena, personagem, animação, comportamento, interface, áudio, diagnóstico e entrega nos caminhos existentes.

Atue como um único agente principal nesta rodada, com execução sequencial. Não delegue nem abra outras frentes sem solicitação. Resolva escolhas rotineiras e prossiga entre os lotes autorizados, sem encerrar a cada pequeno componente para pedir “posso continuar?”. Não encerre somente com planejamento, telas estáticas, unitários verdes ou uma demonstração que contorne o produto.

O objetivo imediato é uma fatia integrada real de criação e teste no Mega Drive, com personagem MUGEN real e conteúdo autoral identificado, seguida da conexão aos perfis REX já comprovados. A arquitetura deve permitir outros gêneros e plataformas, sem implementar agora sistemas completos de RPG, todos os CNS, novos consoles ou um decompilador universal.

Se surgir bloqueio real, preserve o checkpoint e apresente causa, evidência, alternativas e decisão concreta necessária. Não declare conclusão nem substitua silenciosamente o requisito bloqueado por uma demonstração menor.

## 2. Checkpoints conhecidos e preservação

Confira o estado real antes de agir. Os pins abaixo são referências históricas de partida, não autorização para sobrescrever trabalho mais novo.

| Frente | Checkout | Branch e checkpoint conhecido |
|---|---|---|
| Recuperação comercial mais recente | `/home/misael/Projects/REX-COMMERCIAL-RECOVERY-2026-10-16` | `codex/rex-commercial-recovery-20261016`, `40a171694b73e983de0cc01de43e44f5ab5f78a8` |
| Integração anterior | `/home/misael/Projects/REX-INTEGRATION-2026-10-05` | `codex/rex-integrator-sonic-103104`, `03ddc59de38cc3d9c448b893da72a3efd575030a` |
| Pesquisa | `/home/misael/Projects/REX-REA-LAB-2026-10-15` | `codex/rex-rea-lab-20261015`, `ee8c581f07494c22100c688f09f02db0caacd56b` |

Na reconciliação de 2026-10-19, o primeiro checkout tinha árvore rastreada limpa e dois JSON não rastreados preexistentes, que devem permanecer intactos: `data/rex_profiles/commercial_recovery_20261016/m5-adaptation-cost.json` e `protection-mission-011.json`.

M0–M5 comercial foi demonstrado em domínios delimitados: Sonic 135/135 ida e 128/128 volta; Golden Axe 140/140 e 138/138, com efeito de memória; autoral 88/88 em cada direção. Quatro outros alvos tiveram transferência estática sem código adicional, sem consumo observado. São resultados históricos, não testes desta implementação.

Binário histórico: `66cb3d71ea4f5df2efd37b031fe0c4c76b822b11d55d55ca240024638c7c12e5`. Certificação histórica: READY, frontend 1049 aprovados/3 skips e Rust 1038 aprovados/94 ignorados. Há pendência sonora preexistente no `nodegraph-authoring`. V1 visual FAIL 86/89 permanece preservada. Experimental mantido; sem push nessa frente.

Use branch/worktree próprio, derivado do estado reconciliado que contenha as correções necessárias. Não troque branches de outros checkouts nem importe uma branch inteira sem comparar origem, delta, contratos e dependências. Preserve referências Git e backups verificáveis, sem duplicar corpus ou builds.

O antigo checkout de setembro não é automaticamente a ponta atual. Não trabalhe a partir de `/mnt/sdcard/Projects/RetroDevStudio`: esse local teve erros de I/O.

Sem reset destrutivo, limpeza ampla, force-push, `--no-verify`, sobrescrita de trabalho alheio, push, merge remoto, release ou promoção de maturidade nesta missão. Faça commits locais coerentes. O operador decide a publicação posterior.

## 3. Leitura inicial e referências visuais

Leia `/home/misael/.codex/RTK.md` e as instruções aplicáveis ao worktree. Prefixe comandos de shell com `rtk`; use `rtk proxy` quando precisar da saída original.

Leia a hierarquia vigente: `AGENTS.md`, `docs/06_AI_MEMORY_BANK.md` e seus direcionamentos, `docs/03_ROADMAP_MVP.md`, `docs/00_AI_DIRECTIVES.md`, `docs/08_TREE_ARCHITECTURE.md`, `docs/09_AGENT_DEV_MODE.md`, `docs/02_TECH_STACK.md`, `docs/05_ARCHITECTURE_UGDM.md` e `docs/07_TEST_AND_COMPLIANCE.md`.

Ao tocar REX, leia `docs/14_REX_ARQUITETURA_UNIVERSAL.md`, seus adendos e os aceites atuais. Eixos de identidade, vínculo estático, consumo, efeito e reconstrução são independentes; executar uma rotina isolada não prova chamada pelo jogo. O trace de PC do mock não é trace de core real.

Leia os fechos comerciais em `docs/rex_profiles/commercial_recovery_20261016/MISSION.md` e `data/rex_profiles/commercial_recovery_20261016/COMPLETION-AUDIT.json`. Localize também os contratos e fechos MUGEN vigentes, a prova Ken real e as pendências antes de alterar importação, animação ou geração.

As referências do operador foram preservadas, sem edição, fora do Git:

`/home/misael/rds-scratch/studio-grafico-integrado-20261019/references/`

| Arquivo | Conteúdo |
|---|---|
| `base-comum-e-generos.txt` | Cenas, objetos, plataformas, luta, RPG, briga de rua e expansão |
| `experiencia-e-arquitetura.txt` | Contexto compartilhado, referências, segurança da experimentação e usabilidade |
| `01-sonic-elementos.png` | Sobreposições BG azul, SPRITE laranja e TEXTO rosa |
| `02-cena-personagem.png` | Montagem de fase e editor de personagem |
| `03-acoes-interface.png` | Quando → Se → Fazer e edição de interface/diálogos |
| `04-teste-entrega.png` | Teste contextual e diagnóstico direcionado |

Confira os seis hashes no `manifest.json`, SHA-256 `7a65bbfdf833933afd620c4173f64638428c56e08b9f58d9230257822ea4ddf5`. Abra e examine as imagens. São referências de interação e organização, não assets de runtime nem prova funcional. Não copie as imagens para o Git como conteúdo do jogo.

Responda `[Contexto Carregado]`, informe estado real, base escolhida, escopo imediato, primeiro lote e próximo comando. Execute `host:diagnose`; cumpra a barreira READY antes de alterar produto.

## 4. Escopo autorizado e resultado esperado

Execute S0 → S1 → S2 → S3 → S4 → S5 → S6, com critérios de saída. Lotes são marcos de execução da mesma missão; não dependem de uma nova autorização rotineira. Não antecipe um lote dependente para contornar falhas do anterior.

Entrega mínima integrada: um projeto autoral Mega Drive com personagem MUGEN real, cenário editável, colisão, uma ação funcional, indicador textual e evento sonoro. Deve permitir navegar entre editores sem perder contexto, testar, selecionar um elemento executado e voltar à origem. Em seguida, conectar a mesma navegação a um perfil comercial existente, dentro de seu escopo comprovado.

Use exemplos pequenos para verificar contratos; a aceitação visual MUGEN exige arte real. Não substitua o personagem por caixas coloridas, figuras geométricas ou capturas do mockup. Os comportamentos autorais novos devem ser identificados como autorais, sem alegar conversão do CNS original.

Ficam no roadmap futuro: RPG completo, campanhas, lojas, inventário/equipamentos abrangentes, combate por turnos, coop completo, todas as técnicas de plataforma, conversão integral MUGEN, edição arbitrária de lógica comercial e exportadores novos de 8/32 bits. Preserve esses objetivos no plano, sem anunciar sua implementação.

## 5. Experiência comum obrigatória

**REQ-01 — Organização previsível.** Manter organização/biblioteca à esquerda, criação no centro, propriedades à direita e timeline/eventos abaixo quando necessários. Adaptar o shell existente, sua identidade visual e seus workspaces. “Cena · Personagem · Ações · Interface · Teste · Entrega” descreve tarefas; não exige seis aplicações, stores ou rotas duplicadas. Áudio integra biblioteca, propriedades e timeline.

**REQ-02 — Contexto preservado.** Compartilhar projeto, cena, entidade, instância/modelo, recurso, animação, ocorrência de quadro, seleção de colisão/evento e retorno. Preservar zoom/pan/câmera por editor. Ao voltar, o usuário encontra a seleção anterior, sem precisar buscá-la. Cancelar uma navegação não pode descartar um rascunho.

**REQ-03 — Identidade estável.** Nomes e caminhos não são a identidade definitiva de recursos. Aproveitar IDs existentes; auditar as referências ainda baseadas em paths. Estender o modelo canônico com migração compatível, sem criar registro concorrente. Renomear/mover, duplicar e reimportar têm semânticas distintas. Reimportação não pode recriar silenciosamente identidades e perder edições.

**REQ-04 — Escopo de edição.** Mostrar “Nesta instância”, “Nesta cena” ou “Editar modelo — N usos”. Exceções locais são explícitas e reversíveis. Duas instâncias devem permitir provar mudança local sem alteração da outra, e mudança compartilhada nos usos previstos.

**REQ-05 — Transações e histórico.** Uma intenção do usuário corresponde a uma transação coerente, inclusive referências relacionadas. Desfazer/refazer entre painéis deve restaurar dados e efeitos derivados. Salvamento automático não apaga o histórico nem substitui recuperação. Exclusão informa usos e oferece correção; migração cria cópia recuperável antes de escrever.

**REQ-06 — Linguagem e acessibilidade.** Propriedades relevantes primeiro, opções avançadas progressivas, ícones com nomes/tooltips, navegação por teclado, foco previsível, unidades explícitas e informação além da cor. Não capturar atalhos do jogo quando o foco estiver em um campo. Não depender de monitor externo ou resolução fixa para usar a tarefa principal.

## 6. Personagem, animação e golpes

**REQ-07 — Arte e origem.** Reutilizar importer, normalização, recorte, composição e diagnósticos MUGEN existentes. Preservar originais, pivôs, paletas, flags e referências de fonte. Prévia deve distinguir importado, normalizado, autoral e desconhecido. Conferir os sprites reais contra uma referência independente do gerador.

**REQ-08 — Tempo correto.** Animações MUGEN usam durações por quadro em ticks de 1/60 s; -1 significa quadro parado dentro do contrato vigente. Não editar um FPS global que não afeta a ROM. Preservar validação de comprimento e coerência de `frame_durations`/`mugen_frames`; fonte canônica e espelhos são explícitos. Animações nativas preservam seu contrato atual. Conversão para outro destino/taxa precisa ser explícita e validada.

No mockup, 8 × 0,05 s = 0,40 s, incompatível com a indicação de 24 FPS. Corrigir a apresentação, não adaptar o produto ao número inconsistente da imagem.

**REQ-09 — Timeline integrada.** Miniaturas reais, reprodução, passo, pivô, alinhamento, onion skin, repetição e transições. Reordenar duas ocorrências que reutilizam a mesma imagem não pode misturar suas durações ou eventos. O formato deve identificar a ocorrência na animação, não apenas o índice da imagem.

**REQ-10 — Colisões e eventos por quadro.** Distinguir corpo/hurt, ataque/hit, empurrão e colisão física. Selecionar quadro destaca caixas e eventos. Usar ancoragem e espelhamento coerentes com o pivô. Eventos precisam de localização temporal determinística, por exemplo ocorrência + tick local. Ao encurtar um quadro e invalidar evento, diagnosticar ou oferecer retiming explícito; não deslocar silenciosamente.

**REQ-11 — Golpe funcional.** Separar comando, condição de entrada, estado, animação, janela ativa, acerto, consequência e retorno/cancelamento. Implementar inicialmente uma interação pequena por comportamento autoral genérico: ataque contra alvo de treino, com acerto apenas na janela e área válidas. Animação de ataque sozinha não certifica dano. Reutilizar o compilador/backend existente. CNS parcialmente convertido não vira “suporte integral”.

**REQ-12 — Áudio vinculado.** Selecionar som pela timeline ou evento, pré-ouvir, configurar a ocorrência e mostrar sua origem. Evitar reinício de BGM por frame e eventos duplicados ao pausar, repetir ou avançar quadro. Validar conversão/driver/destino. Som no editor não prova som na ROM; chamada em C não prova amostras produzidas. A pendência histórica deve continuar identificada e receber correção se bloquear esta jornada.

## 7. Cena, ações e interface

**REQ-13 — Cena e background.** Evoluir pincéis, seleção, apagar de verdade, preenchimento/blocos, camadas, visibilidade, bloqueio, paralaxe, objetos reutilizáveis e câmera conforme as capacidades atuais. Pintar visual e pintar colisão são operações distintas. Criar/mapear colisão automaticamente só como sugestão revisável. Testar posições, escala de visualização, limites de mapa e edição de tile vazio no ROM gerado.

**REQ-14 — Comportamentos legíveis.** Quando → Se → Fazer e NodeGraph são apresentações da mesma representação. Preservar IDs e mapeamentos, desfazer e validação. Cartões não podem criar motor paralelo nem substituir operações desconhecidas por no-op. Mostrar categorias, ícones de ação/controle, miniaturas e ligações claras. Organização visual não altera semântica. “Apenas uma vez” tem estado por instância e deve ser testado.

**REQ-15 — Texto e HUD.** Implementar primeiro texto/indicador simples com fonte e layout aceitos pelo destino, posição, conteúdo e vínculo autoral com valor. Diálogos ramificados completos permanecem evolução seguinte. Texto autoral é diferente de um conjunto de glifos recuperados: numa ROM comercial, escrever uma frase exige conhecer codificação e referências. Não use OCR como prova de estrutura editável.

**REQ-16 — Diagnóstico direcionado.** Mostrar o que aconteceu, objeto, consequência e ação corretiva. Clicar abre cena, elemento e propriedade corretos, não apenas um painel genérico. Reutilizar `ActionableDiagnostic`. Bloqueio deve refletir impossibilidade real do build/runtime; áudio opcional ausente pode ser aviso somente se o caminho sem ele for válido e explícito. Não emitir instrução inválida nem ocultar falta obrigatória para “desbloquear” exportação.

## 8. Execução selecionável e vínculo com a origem

**REQ-17 — Modo Inspecionar.** No teste, permitir pausar, avançar e destacar Cenário, Personagens/objetos, Interface, Colisões e Eventos de áudio. Azul, laranja e rosa seguem as referências, com rótulos/ícones. Não saturar a tela com todas as caixas por padrão. Oferecer escolher entre sobrepostos e isolar a seleção no editor.

**REQ-18 — Contrato de vínculo.** Projetar e testar um contrato versionado de correspondência execução→projeto, reutilizando o existente onde houver. Conceitualmente precisa de identidade do projeto/build/ROM, sessão/época/quadro, referência do objeto/recurso/subelemento e origem/evidência. Os nomes finais vêm da auditoria; não suponha APIs prontas. Slots físicos reutilizados não são IDs permanentes de objetos.

A seleção deve usar a geometria do quadro apresentado, incluindo viewport nativo, letterboxing, zoom, câmera, scroll, pivô, flips, prioridade e múltiplas partes de sprite. Pausar deve congelar quadro e metadados compatíveis. Dados antigos de outro build/sessão/quadro não podem navegar para o recurso atual.

**REQ-19 — Limites por origem.**

| Origem | Comportamento permitido |
|---|---|
| Autoral | Mapa de depuração produzido pelo pipeline do projeto, com custo medido e dados de release separados |
| MUGEN | Referências reais de entidade/animação/quadro, sem atribuir autoria original a comportamento criado aqui |
| ROM comercial | Navegação para recurso/rotina apenas nos vínculos comprovados do perfil e episódio |
| Desconhecida | Inspeção ou anotação assistida, sem editor semântico inventado |

Frame composto não identifica sozinho objetos, colisões, texto ou som. Camadas lógicas não são necessariamente planos de hardware; um personagem pode usar vários sprites físicos, e texto pode usar tiles/sprites. Filtrar caixas de inspeção não equivale a remover um plano do core. Expor isolamento real durante execução somente quando o backend o suporta. Som usa lista de eventos/emissores e reprodução, não retângulo fictício.

Não misture trace MAME externo com sessão do core do aplicativo. Reutilizar prova comercial não cria observação de PC dentro do core. Não adicione core/dependência para esta funcionalidade sem a aprovação exigida pelo projeto.

**REQ-20 — Teste temporário e aplicação.** Ajustes de teste têm estado separado. “Aplicar ao projeto” apresenta diff selecionável de campos autorais permitidos e uma transação desfeita em conjunto. Não salvar posições transitórias, RNG, contador de tempo ou RAM bruta como propriedades do projeto. Save state do emulador, cena salva no editor e progresso salvo pelo jogo são coisas diferentes.

**REQ-21 — Atualização verificável.** Invalidar apenas dependências afetadas e cancelar/descartar resultados antigos. Mostrar “Prévia atualizada”, “Recompilação necessária”, “Executando build anterior” e “Confirmado na ROM atual”. Atualização em execução só onde houver caminho seguro demonstrado. Mudança de conteúdo não implica que o código compilado já mudou.

## 9. Arquitetura e expansão futura

**REQ-22 — Uma base canônica.** Evoluir UGDM, store, scene source/resolvida, importer, backend, IPC, compiladores, publicador e histórico existentes. Não introduzir stores, engines de regras, emissores ou pipelines paralelos. Migrar contratos de modo compatível; manter conteúdo opaco e customizações preservados. “Ver código” pode começar como fonte gerada/mapeada; não prometer edição bidirecional de C arbitrário.

Pontos de inspeção já identificados nesta base, a reconfirmar no SHA escolhido:

- `src/core/ipc/sceneService.ts`: componentes, animações, camadas e colisão;
- `src/core/store/editorStore.ts`: seleção, workspaces, cena fonte/resolvida e histórico;
- `src/core/sceneWorkspaceContext.ts`, `sceneWorldModel.ts`, `scenePersistence.ts`;
- `src/components/artstudio/ArtStudioPanel.tsx`, `useSpriteAnimator.ts`, `AssetQualityPanel.tsx`;
- `src/components/viewport/ViewportPanel.tsx`: navegação para arte/lógica/tilemap e apresentação;
- `src/components/inspector/InspectorPanel.tsx` e `hierarchy/HierarchyPanel.tsx`;
- `src/core/nodegraph/graphHistory.ts`, `behaviorLibrary.ts`, `nodeCatalog.ts`, `profileGraphBridge.ts`;
- `src/core/mugenAnimationTiming.ts`, `diagnostics.ts`, `projectCapability.ts`;
- `src-tauri/src/ugdm/`, `compiler/`, `core/`, `emulator/` e módulos REX existentes.

Não concentre novas responsabilidades indiscriminadamente em arquivos grandes; extraia módulos coesos quando isso reduzir acoplamento, preservando os caminhos canônicos e APIs existentes.

**REQ-23 — Gêneros combináveis.** Plataforma: terreno/movimento/câmera/checkpoints. Luta: comandos/estados/janelas/cancelamentos. Briga de rua: posição no chão separada da altura do salto, ordenação e ondas. RPG: dados/diálogos/inventário/missões/persistência. São módulos que compartilham cenas, entidades, animações e eventos, não quatro aplicações. Não implemente a lista inteira nesta missão.

**REQ-24 — Destinos explícitos.** Separar intenção compartilhada, semântica de CPU e adaptadores de plataforma. Não espalhar nome de hardware no modelo agnóstico. Mostrar capacidades comprovadas por destino: fontes/encoding, áudio, resolução, colisão, animação e exportação. Priorizar Mega Drive atual e preservar SNES existente. Contratos podem preparar 8/16/32 bits, sem anunciar suporte a novo console.

Resolução nativa, escala de apresentação e área segura são distintas. Não copiar a exportação desktop 1280×720 do mockup para a ROM. Validar limites usando residência, streaming, compressão e transferências por quadro; tamanho total da biblioteca não é consumo simultâneo. Técnicas não tornam os recursos físicos ilimitados. Não alterar as especificações imutáveis de hardware.

## 10. Ordem de implementação e aceites

| Lote | Trabalho e saída obrigatória |
|---|---|
| S0 — Reconciliação | Base/refs protegidas; mapa existente versus lacunas; requisitos distribuídos entre lotes; riscos e baseline registrados; material referenciado acessível |
| S1 — Contexto | Cena → personagem/arte → ações → retorno preserva seleção e câmera; escopo instância/modelo; desfazer; persistência e projetos antigos |
| S2 — Personagem | Ken real, edição de duração, pivô/caixas/eventos; salvar/reabrir; build e efeito medido; ação autoral mínima com janela de acerto real e som associado |
| S3 — Teste selecionável | Build autoral com vínculo qualificado; pausa/seleção abre entidade/animação/quadro; sobreposição, coordenadas, obsolescência e efeitos temporários protegidos |
| S4 — Cena | Cenário pequeno pintado, colisão física, câmera, duas instâncias/modelo e interação simples; prévia versus ROM conferidas |
| S5 — Interface e entrega | HUD textual ligado a valor, áudio/eventos e diagnóstico navegável; revisão de teste; exportação canônica do jogo e validação de destino |
| S6 — Ponte REX e fecho | Um perfil comercial existente usa a navegação no escopo comprovado; desconhecidos explícitos; regressões, evidências e certificado finais |

A primeira jornada deve ser Ken real → selecionar animação → editar um quadro → salvar/reabrir → compilar → testar → selecionar no jogo → voltar à origem → desfazer e restaurar. Os lotes acrescentam cenário, ação, texto e som até fechar a fatia integrada completa. Não chamar só a primeira jornada de missão completa.

No S0 congele matriz requisito→lote→implementação prevista→teste→resultado esperado. Congele antes de medir cada lote, e antes da certificação final publique um protocolo para todas as jornadas obrigatórias no mesmo binário final. Mudanças de protocolo vão em adendo anterior à nova corrida; mantenha falhas anteriores.

## 11. Certificação ponta a ponta

Use automação desktop canônica Tauri/WebDriver existente e controles reais da UI. Não substitua o caminho do usuário por chamadas diretas ao core, IPC ou alteração de JSON em disco. Sondas de memória, framebuffer e áudio são observação, com origem registrada. Prepare projetos/fixtures por ferramentas explícitas; separar preparação técnica de ações que o usuário deve conseguir realizar.

| Jornada | Prova exigida |
|---|---|
| E1 — Animação real | Arte Ken independente; duração de um quadro altera só o esperado; outro quadro/ação intacto; salvar, destruir janela, reabrir, executar e restaurar |
| E2 — Golpe e evento | Teclado nativo aceito e consumido; acerto dentro da área/janela, ausência fora; dano uma vez conforme regra; evento sonoro na ocorrência; retorno de estado sem repetir indevidamente |
| E3 — Ponte de execução | Clicar personagem, tile/camada e HUD autorais abre seleção correta; retornar preserva contexto; câmera/zoom/letterbox/sobreposição testados; build/época antigos recusados |
| E4 — Cena e escopo | Pintar e apagar tile, editar colisão, compilar; movimento bate com físico; duas instâncias provam isolamento local e propagação compartilhada; um desfazer restaura a transação |
| E5 — HUD, diagnóstico e teste | Valor/texto/posição persistem; erro proposital leva à propriedade; aviso opcional não bloqueia destino válido; mudança temporária não salva sem revisão; aplicação pode ser desfeita |
| E6 — REX | Perfil e ROM identificados; recurso conhecido leva ao editor correto; edição/cópia/patch/execução/reversão no pipeline existente; desconhecido não recebe semântica inventada |
| E7 — Migração e regressões | Projetos anteriores e importações reabrem sem perda; journeys afetadas de MUGEN, NodeGraph e REX passam ou têm bloqueio explicitamente atribuído; sem processo do cenário sobrando |

Para CI use fixtures autorais pequenas, com origem e licença apropriadas. Para aceites privados use fontes/ROMs locais por hash. Ausência do arquivo não é PASS; não baixe/provisione ROM comercial. Capturas, ROMs derivadas, estados e dumps comerciais ficam fora do Git, só metadados permitidos.

Regras da prova:

- Arte deve ser conferida contra fonte real por implementação ou método independente do exportador. Minhas caixas ou imagens do mockup não são prova de sprite correto.
- Tempo deve ser medido em ticks/quadros emulados, com taxa definida. ACK de input não equivale a consumo ou resultado físico. Não usar milissegundos do host para esconder quadro perdido.
- Referência visual precisa ser congelada a partir da fonte e do modelo, sem usar a captura modificada como esperado. Documentar paleta, transparência, resolução e domínio comparado.
- Áudio: observar evento, amostras do core e chegada ao player; incluir controle silenciado com mesma entrada. Log ou função chamada não basta. Loopback acústico, se não medido, continua não medido; não alegar som físico pelo simples contador de amostras.
- Colisões e dano precisam de estado e efeito reais na ROM, não apenas retângulos desenhados no editor.
- Cada reexecução usa ID novo e preserva logs/falhas. Retentativas têm motivo, limite e registro de todas as tentativas. Não selecionar a melhor corrida nem reduzir critérios após falhar.
- Testar negativos que realmente discriminam: identidade errada, frame/época antiga, recurso ausente, referência renomeada, duração inválida, duas ocorrências da mesma imagem, evento fora do quadro, seleção ocluída, alteração local versus modelo, cancelamento e falha de gravação.
- Para erros de transação, garantir que o projeto permanece no último estado válido, sem gravação parcial ou projeto fantasma. Não misturar a inexistência de ROM nova com apresentação de resultado antigo.
- Para interfaces novas, exercitar pelo menos o espaço útil de 1280×800 com painéis adaptáveis e uma resolução maior, registrando tamanho/escala reais. Não alterar configuração global do display; aproveitar QA isolado existente.
- Qualificação por mutação deve atingir os riscos centrais: alvo de seleção trocado, duração ignorada, evento disparado duas vezes e resultado antigo aceito precisam reprovar testes ou verificadores. Restaurar e conferir árvore depois. Não gerar dezenas de mutantes redundantes só para aumentar contagem.

Inspeção visual técnica não certifica usabilidade humana. Prepare roteiro curto para uma pessoa realizar tarefas sem ajuda. Só declare validação humana após execução real e registro de dificuldade/assistência; se o participante não estiver disponível, entregue o roteiro e mantenha esse aceite aberto, sem inventar resultados.

## 12. Gates, desempenho e continuidade

Rode os gates aplicáveis de `AGENTS.md`/`docs/09`, incluindo estrutura, lint, TypeScript, frontend, Rust, Clippy e fmt; `crates:gates` quando afetado. Host, emulação, build ou instrumentação exigem `host:certify` e execução com dependências oficiais. Dependências/segurança alteradas exigem auditorias previstas e inventário de licenças.

Verifique comandos reais em `package.json` e scripts existentes. `build:debug`/`build:portable` devem usar `scripts/build.mjs`; não construir outro exporter/runtime para facilitar o teste. Nova dependência exige aprovação e atualização de stack. Python somente como ferramenta de pesquisa/QA, nunca runtime do aplicativo.

Rode um build/E2E pesado por vez, confira recursos disponíveis e respeite o preflight existente. Não encerre processos alheios ou altere swap/cache para abrir espaço. Use cache de compilação existente. Processe importações e tarefas longas com cancelamento/progresso; resultados obsoletos não podem reaparecer como atuais.

Meça responsividade e custo de depuração em cenário representativo, congelando um orçamento realista após baseline. Não carregar continuamente todos os assets, gerar hashes grandes por frame ou alocar estruturas pesadas no loop crítico. Se o adaptador só fornece amostras, informe a granularidade e o que não foi observado.

Regressão preexistente pode ser atribuída com baseline e evidência; continua falha/pêndencia, sem virar aprovação. Se bloquear a nova jornada, precisa ser resolvida antes de fechar essa jornada. Não desabilitar audit/gate ou afrouxar assert para tornar o relatório verde. Uma plataforma não executada não recebe certificação da rodada.

A cada lote ou descoberta importante registre no local canônico: estado, branch/commit, hipótese, arquivos, evidências novas/herdadas, comandos/rc, limites e próximo comando exato. Siga os direcionamentos do Memory Bank; não crie ledger concorrente nem reescreva história congelada. Não altere “Decisões Arquiteturais Consolidadas” sem ordem expressa.

Mantenha experimentos em namespace próprio da árvore aprovada, com índice e manifestos. Guarde arquivos grandes/privados em scratch identificado. Só remova temporários seus, regeneráveis e não referenciados; preserve falhas e evidência. O encerramento do harness deve fechar suas sessões/PIDs tanto em sucesso quanto em falha, conferindo identidade/starttime. CI, se vier a ser autorizado posteriormente, é consultado por SHA sem watcher permanente ou cadeia infinita de commits documentais.

## 13. Entrega e condição de conclusão

Entregue código integrado na branch da missão, projetos/fixtures permitidos, migrações, testes, evidência durável e um mapa de todos os REQ-01..24 e S0..S6. Para cada item registre implementação, teste nomeado, resultado e limite. Evidência histórica não se transforma em execução nova.

O manifesto final deve ligar commit-fonte, frontend, binário testado, toolchains/core/configuração, entradas, perfis, ROMs, patches e relatórios por SHA-256. Identifique edição desde a última execução. Para o fluxo sem mudança de gameplay, no-op e restauração devem recuperar os bytes previstos; mudanças de comportamento têm previsão causal, não equivalência indevida do jogo inteiro.

Conclua apenas quando a fatia integrada autorizada funcionar no app e na ROM, com gates aplicáveis e sem bloqueio no caminho certificado. Telas futuras, marcadores visuais e simuladores não valem como backend funcional. Capacidades parciais permanecem Experimental e explicitamente limitadas.

Relatório final curto: o que o usuário já consegue fazer, prova de cada jornada, arquivos e commits, migrações, regressões, pendências reais, validação humana realizada ou pendente e reprodução. Garanta ausência de processos próprios esquecidos e preservação de arquivos preexistentes. O plano completo e o próximo passo devem estar no repositório, compreensíveis sem este chat.

Comece agora por S0 e avance em sequência. Este prompt autoriza a implementação descrita; não se limite a devolvê-lo reescrito ou a oferecer continuar.
