# Retomada após interrupção — paletas, certificação e atalho de teste

Este é um prompt de continuidade para outro agente. Não representa fechamento da rodada 4. A auditoria que o preparou leu Git, fontes, relatórios e logs locais; não reexecutou as jornadas desktop nem a certificação completa.

## Missão e autorização

Continue a implementação já existente do Studio Gráfico Integrado, feche as pendências verificadas da rodada 4 e, quando o aplicativo estiver validado no domínio declarado, crie um atalho na área de trabalho para o operador testá-lo. A criação desse atalho já está autorizada pelo usuário; não peça novo GO por essa ação nem pelas verificações e correções necessárias dentro desta missão.

Preserve o trabalho anterior. Não reimplemente o sistema de paletas, não reinicie a missão, não abra outras frentes e não delegue modificações paralelas. Sem push, merge, release, dependência nova ou promoção de maturidade. Commits locais coerentes e checkpoints são permitidos. Mantenha Experimental e registre os limites.

## Localização e pinos encontrados

- Worktree correto: `/home/misael/Projects/REX-STUDIO-GRAFICO-2026-10-19`.
- Branch: `codex/rex-studio-grafico-20261019`.
- HEAD auditado: `ae0d66cd3136a364b55dccd6f29bd0b5392aabae`.
- A árvore estava limpa antes da criação deste handoff. Se este arquivo estiver não rastreado, preserve-o: pertence ao pedido do operador.
- Não use `/mnt/sdcard/Projects/RetroDevStudio` como checkout de trabalho: a consulta desta auditoria retornou que não é um repositório Git.
- Scratch privado: `/home/misael/rds-scratch/studio-grafico-integrado-20261019/`.
- Binário auditado: `bin/retro-dev-studio-016` dentro desse scratch.
- Mesmo conteúdo em `src-tauri/target-test/debug/retro-dev-studio` do worktree.
- SHA-256 dos dois executáveis, reconferido no disco: `d37779583a4cf25dbc7a4dc22200c48d7bed900fcd65d1ee79e573aa37b782b8`.

São pinos de descoberta, não ordens para resetar uma árvore que tenha avançado. Reconcilie HEAD, status, processos, hashes e documentos antes de prosseguir.

Leia `/home/misael/.codex/RTK.md` e use o prefixo `rtk` nos comandos. Leia `AGENTS.md` e as fontes canônicas que ele exige, inclusive Memory Bank, roadmap, arquitetura da árvore, diretivas, modo do agente, stack e compliance aplicáveis. Responda `[Contexto Carregado]` e execute o diagnóstico canônico do host antes de mudar código de produto.

## Contrato que deve continuar sendo cumprido

Leia os arquivos existentes, sem substituir o escopo por este resumo:

- `docs/handoffs/PROMPT_STUDIO_GRAFICO_INTEGRADO_2026-10-19.md`.
- `docs/handoffs/ADENDO_PALETAS_INTERATIVAS_2026-10-19.md`.
- `docs/studio_grafico/MISSION.md`, em especial rodada 4 e Adendo H.
- `docs/studio_grafico/REQUIREMENTS_MAP.md`.
- `docs/studio_grafico/ROTEIRO_VALIDACAO_HUMANA.md`.

A experiência pretendida combina personagem MUGEN real, cenário importado pela UI, câmera, HUD, paletas navegáveis e compartilhadas, variante local, troca por evento, persistência, desfazer, inspeção e exportação. Referências de paletas e bancos físicos são conceitos distintos. Compartilhamento compatível pode continuar habilitado. Ocultar no editor não libera recursos da ROM. O plano do backend deve orientar editor, diagnóstico e compilação.

O núcleo genérico deve continuar separado das capacidades do adaptador Mega Drive. Não ampliar agora para outros consoles, gêneros, técnicas raster ou recuperação universal de ROMs comerciais.

## O que o agente interrompido já implementou

Seis commits sobre `e40f209b`:

| Commit | Conteúdo principal |
|---|---|
| `a5ad7697` | Planejamento determinístico de paletas no build, troca por golpe e importação de imagem/cenário. |
| `ea907172` | Painel contextual, seção no Inspector, comportamento no NodeGraph e integração com a interface. |
| `ca6cc1b2` | Controle negativo no core e contrato da jornada antes da primeira execução. |
| `dfca5579` | Jornada `studio-paletas` e dados de observação para automação. |
| `3f69f635` | Diagnóstico das falhas do harness e comparação canônica de paletas persistidas. |
| `ae0d66cd` | Compatibilidade da fonte com bancos existentes e preservação explícita da regra de texto legado, corrigindo regressões do binário 015. |

Fontes centrais para orientação: `src-tauri/src/compiler/palette_plan.rs`, `src-tauri/src/compiler/build_orch.rs`, `src-tauri/src/compiler/sgdk_emitter.rs`, `src-tauri/src/core/image_import.rs`, `src/components/inspector/PalettePanel.tsx`, `src/core/palettePlan.ts`, `src/core/palettePlanStore.ts`, `src/core/sceneryImport.ts` e os caminhos canônicos de NodeGraph/runtime link. Evolua esses caminhos; não crie alocador ou emissor concorrente.

Há também correção registrada do mapa com mais de 64 tiles que dava a volta no plano. Não a perca. Preserve as correções anteriores de identidade por conteúdo, HUD com câmera, input em campos, escopo por ocorrência/modelo e navegação de retorno.

Revise especialmente a última correção da fonte: compartilhamento compatível não deve alterar outros índices; a compatibilidade do texto legado deve continuar explícita e não virar autorização para recolorir silenciosamente um HUD novo.

## Resultados encontrados — reutilizar com atribuição correta

Os diretórios a seguir estão em `runs/` no scratch acima. Seus `run.json` registram o mesmo SHA do binário 016:

| Diretório | Cenário | Resultado registrado |
|---|---|---|
| `cert4-paletas` | `studio-paletas` | rc=0; relatório allPass=true, 15 passos. |
| `cert4-e2e5` | `studio-e2e5` | rc=0; allPass=true, 10 passos. |
| `cert4-mugen-import` | `mugen-import` | rc=0. |
| `cert4-e1e3` | `studio-e1` | rc=0; allPass=true, 11 passos. |
| `cert4-e4` | `studio-e4` | rc=0; allPass=true, 4 passos. |
| `cert4-scene` | `studio-scene` | rc=0; allPass=true, 5 passos. |
| `cert4-model` | `studio-model` | rc=0; allPass=true, 4 passos. |
| `cert4-hud-camera` | `studio-hud-camera` | rc=0; allPass=true, 5 passos. |
| `cert4-nodegraph` | `nodegraph-authoring` | rc=1, falha ainda não resolvida nesta rodada. |
| `cert4-mugen-real` | `mugen-real` | rc=0, inclui referência independente. |

A jornada `studio-paletas` registrou: cenário criado pela Hierarquia; Ken compartilhado entre duas instâncias; variante local; paleta de dano; mudança compartilhada e desfazer; salvar/fechar/reabrir; composição com zero pixels desconhecidos e zero erros de cenário no domínio comparado; uma troca e uma restauração de dano; câmera 96→133 com HUD ancorado; restauração byte-idêntica da ROM e exportação canônica.

O oráculo de MUGEN real registra 21 prévias, 204 quadros do core, 212 da UI e recusa dos cinco controles negativos. Preserve sua distinção entre fonte, conversão e captura. O relatório está em `runs/cert4-mugen-real/oracle/independent-report.json`.

O log `runs/r4-rust-real.log` termina em 1066 testes aprovados, 0 falhas e 102 ignorados. É uma execução anterior do agente, não uma execução nova sua; confirme comando, escopo e árvore de origem antes de reaproveitá-la como gate.

A auditoria de continuidade executou somente: `check:tree` (OK), `node --check scripts/e2e-tauri-build-run.mjs` (rc=0), `git diff --check` (sem erros) e os arquivos Vitest `PalettePanel.test.tsx` + `hudBand.test.ts` (12/12). Isso não substitui os gates gerais.

## Pendências concretas, na ordem de trabalho

### 1. Proteger a evidência e diagnosticar NodeGraph

O registro `src-tauri/target-test/validation/desktop-e2e-failure-nodegraph-authoring.json` e `runs/cert4-nodegraph/run.log` contêm:

`Tecla X (botao B) nao fez pular: {"groundY":176,"zMinY":176,"xMinY":170,"zSamples":10,"xSamples":8}`.

O erro é uma medição insuficiente para o critério vigente; esses números isolados não identificam a causa. O harness está em torno de `jumpProof` dentro de `scripts/e2e-tauri-build-run.mjs`; localize por texto, não pela linha histórica do stack.

Não reclassifique como falha preexistente ou do harness sem demonstração. Esse tipo de falha apareceu em rodadas anteriores, mas isso não estabelece a causa da corrida atual. Preserve o traço de salto e compare foco, input nativo aceito/consumido quando observável, quadros emulados, estado de chão e observação do ápice. O teste atual usa uma janela em milissegundos; avalie se o instrumento perdeu a fase relevante em host lento.

Se mudar o protocolo, registre e congele o novo antes de executar; mantenha o resultado anterior FAIL. Não reduza o limiar nem injete salto/estado para tornar o teste verde. Faça a correção mínima sustentada por causa e teste discriminante. Se tocar produção, reconstrua e reexecute o delta afetado. Uma repetição até obter verde não fecha o problema.

### 2. Completar certificação e reconciliar os gates

`runs/host-certify-r4-attempt1.log` termina no início de `vitest run`, sem resultado final. Na auditoria não havia processo de build/teste/app/driver dessa missão ativo.

O `host-readiness.json` existente dizia READY, mas tinha `gates: []`. Isso mostra prontidão dos requisitos; não é prova de conclusão do `host:certify` interrompido. Preserve esse log/JSON antes de uma nova execução, use outro nome e confira rc e todos os gates no resultado final.

Execute os gates exigidos pelas instruções canônicas, incluindo frontend completo, TypeScript, lint, fmt, clippy canônico, Rust e pacotes aplicáveis; faça um job pesado por vez e serialize testes que instanciam cores nativos conforme o contrato existente. Rode `host:certify` completo. Audits adicionais conforme mudanças em dependências/segurança; não adicione dependências para esta missão.

Não faça um build novo apenas para trocar o nome do artefato. Se a produção mudar, gere outro binário canônico, registre o SHA e reexecute jornadas/oráculos conforme o delta. Se não mudar, verifique os pinos e preserve os resultados aplicáveis do 016 como execuções anteriores, sem chamá-los de corridas novas.

### 3. Fechar documentos e evidência da rodada 4

No momento da auditoria, o Memory Bank e o mapa de requisitos ainda descreviam a rodada 3; `final-manifest-r4.json` não existia, embora já fosse citado no roteiro humano. O roteiro também apontava o binário 015, superado pelo 016. Corrija o estado atual por adendo/checkpoint, preservando registros históricos verdadeiros.

Reconcile Adendo H e os resultados efetivos. Preserve as falhas `r4-paletas-run1..3`, o sucesso posterior no 015, as regressões `r4-scene`/`r4-model` do 015, o NodeGraph reprovado do 016 e a certificação interrompida. Classifique a causa de cada falha somente com evidência.

Crie o manifesto da rodada com a ferramenta existente ou sua extensão mínima auditável: hashes, fonte, binário, comandos, rc, relatórios e provas novas/herdadas. Não regenere manifestos históricos para apagar divergências. Relatórios sanitizados entram no território de evidência; ROMs, screenshots de arte comercial, fontes BYOR e derivados ficam privados por hash e caminho. Registre limitações remanescentes do WINDOW, paletas, cores e UX. Atualize Memory Bank e roadmap quando exigido.

Verifique no fechamento os requisitos do adendo, inclusive liberação com outro uso concorrente, conflito sem gravação, reservas, variantes, troca por evento e escopo local/compartilhado. Use as provas existentes quando aplicáveis, sem declarar coberturas que não foram exercitadas.

### 4. Preparar a versão para teste humano e criar o atalho

Após resolver as pendências bloqueantes e confirmar os gates aplicáveis, crie o atalho solicitado. Não encerre apenas recomendando que o usuário o faça.

- Descubra a área de trabalho real por XDG. Nesta auditoria, `~/.config/user-dirs.dirs` declarava `/home/misael/Área de trabalho`; confira novamente.
- Nome sugerido: `RetroDev Studio — Studio Gráfico (Experimental)`.
- Use o empacotamento/launcher canônico existente quando houver. Aponte para um artefato validado e preservado em local estável, com os recursos necessários; evite apontar para um executável que o próximo build sobrescreva silenciosamente.
- Se precisar de uma cópia privada para teste, preserve o SHA do executável certificado e os recursos exigidos. Não reconstrua uma versão release diferente e transfira para ela o certificado do debug.
- Crie um `.desktop` adequado ao ambiente, com Exec, Path quando necessário, ícone existente e permissões corretas. Não sobrescreva outro atalho. Configure confiança somente pelo mecanismo suportado pelo desktop; não use sudo nem desative proteções.
- O atalho deve abrir o app no display do usuário, sem Xvfb, driver de QA, servidor de desenvolvimento ou habilitação da ponte de automação. Reutilize só as configurações normais necessárias ao aplicativo.
- Teste a inicialização pelo próprio launcher no desktop real, confirme janela e hash do executável iniciado, carregamento do projeto e ausência de dependência em variáveis privadas do harness. Encerre somente o processo de verificação que você criou.
- Mantenha um projeto de demonstração privado, em cópia segura e editável pelo operador. O relatório de paletas aponta como origem `Documents/RetroDevProjects/Ken_Paletas_1792459982061`; confirme se existe e se está íntegro antes de reutilizar. Não altere a evidência original para montar a demonstração.
- Entregue o caminho do atalho, do executável e do projeto de teste, além de instruções curtas para abrir paletas, ver usos, editar, desfazer, compilar e testar a troca.

Isso é disponibilização local para teste, não publicação nem promoção de maturidade. Não marque a sessão humana como realizada: o operador ainda irá executá-la.

## Disciplina de execução e conclusão

Não toque nos checkouts de integração/pesquisa alheios, corpus ou processos de outra sessão. Havia um `Xvfb :99` de outra origem; não o encerre por nome. Identifique os processos que criar por sessão/PID. Use diretórios novos para tentativas e mantenha um índice, sem cópias arbitrárias de artefatos enormes.

Progrida autonomamente até fechar a missão ou encontrar um bloqueio externo comprovado. Registre marcos, causas refutadas e próximo comando antes de interrupções. Não crie watchers permanentes nem uma sequência infinita de commits só para consultar CI. Sem publicação nesta missão.

O relatório final deve distinguir: implementado, executado, herdado, falhou, não executado e limite. Inclua o binário efetivamente testado, manifesto verificável, resultados da regressão NodeGraph e da certificação completa, além do atalho funcional para o usuário. Se ainda houver bloqueio impeditivo, declare-o e não apresente a versão como pronta.
