# AGENTS.md - RetroDev Studio

## Projeto
RetroDev Studio: plataforma desktop para desenvolvimento de jogos 16-bit (Mega Drive, SNES), preservacao e engenharia reversa orientada a patches.
Stack base: Tauri + React + TypeScript + Rust + SGDK/PVSnesLib + Libretro.

## Estado Atual
**Hardening/QA do MVP**.
O foco real nao e criar feature nova; e fechar o fluxo canonico `Build -> ROM -> Emulacao` com dependencias oficiais e manter o baseline de validacao verde.

## Hierarquia De Verdade
Se houver conflito entre documentos, siga esta ordem:
1. `docs/06_AI_MEMORY_BANK.md`
2. `docs/03_ROADMAP_MVP.md`
3. `docs/09_AGENT_DEV_MODE.md`
4. `docs/08_TREE_ARCHITECTURE.md`
5. `docs/02_TECH_STACK.md`
6. `docs/07_TEST_AND_COMPLIANCE.md`
7. `README.md` e `AGENTS.md`

`README.md` e este arquivo servem para onboarding. Eles nao podem sobrepor o estado operacional canonicamente registrado.

## Leitura Obrigatoria Antes De Qualquer Acao
1. `docs/06_AI_MEMORY_BANK.md`
2. `docs/03_ROADMAP_MVP.md`
3. `docs/08_TREE_ARCHITECTURE.md`
4. `docs/00_AI_DIRECTIVES.md`
5. `docs/09_AGENT_DEV_MODE.md` quando a tarefa tocar processo, CI, documentacao de estado, multi-agente ou conflito entre documentos
6. `docs/14_REX_ARQUITETURA_UNIVERSAL.md` quando a tarefa tocar REX, perfis, `tools/reverse/decomp/`, a ponte canvas/ROM ou provas de gameplay

Responda com `[Contexto Carregado]` antes de propor qualquer acao relevante.

## Protocolo Obrigatorio Do Host
0. Em host reinstalado/vazio, leia `docs/handoffs/NOVO_HOST_INICIO.md`. Use `bash scripts/new-host.sh --plan` e depois `--install --certify --build` (Windows: `scripts/new-host.ps1 -Mode Install -Certify -Build`). O launcher reutiliza o bootstrap/host-manager e ativa o ambiente por processo; nao exige Node previamente instalado. Para comandos diarios, use `--run`/`-Mode Run` quando o PATH global divergir. Nao certificar o novo OS com READY herdado.
1. Se `node` estiver disponivel, rode `npm run host:diagnose` ao iniciar uma sessao de desenvolvimento.
2. Se Node estiver ausente, ou o diagnostico nao retornar `READY`, execute o launcher do host:
   - Linux Arch/Manjaro x64: `scripts/bootstrap.sh --ensure --profile full`
   - Windows 10/11 x64: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap.ps1 -Ensure -Profile Full`
3. Nao altere codigo do produto enquanto `src-tauri/target-test/validation/host-readiness.json` permanecer `BLOCKED`, `DRIFTED` ou `UNSUPPORTED`; corrija o host ou registre o bloqueio no Memory Bank.
4. Rode `npm run host:certify` antes de encerrar mudancas em build, emulacao, toolchains ou infraestrutura.
5. Nunca trate corpus/ROM BYOR como dependencia provisionavel e nunca aceite artefato sem origem imutavel e SHA-256.

## Prioridade Da Retomada 2026-10-24
Uma frente sequencial de coesao do produto: `docs/handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`. Reconciliar estado/revisoes; fechar vertical autoral e MUGEN real; simplificar a navegacao usando editorStore/studioContext/runtimeLink/plano de paletas existentes. Nao iniciar outro motor universal nem reescrita geral. Diagnostico e limites em `docs/handoffs/REAVALIACAO_PRODUTO_2026-10-24.md`; auditoria preservada em `docs/studio_grafico/auditoria_20261020/`. LOT028 teve build/run/export: nao repetir o resumo inicial superado. As 16 jornadas continuam parciais, sem validacao humana.

Um build pesado por vez; gerados/cache/experimentos fora da arvore fonte, com recibos e limites de espaco. Nao apagar evidencias, projetos ou trabalho alheio para liberar disco. Checkpoints pequenos devem registrar SHA, resultado, limite e proximo comando.

## Regras Criticas
- Nao antecipe fases futuras do roadmap.
- Nao declare feature parcial como pronta.
- Mantenha superficies parciais claramente marcadas como `Experimental`.
- Reutilize dependencias existentes. Dependencia nova indispensavel ao escopo autorizado exige justificativa, compatibilidade/lock, reflexo em `docs/02_TECH_STACK.md` e verificacao; nao pedir aprovacao rotineira para escolhas reversiveis ja cobertas pelo pedido. Mudanca de arquitetura fora do escopo exige decisao do usuario.
- Nao crie arquivos fora da arvore definida em `docs/08_TREE_ARCHITECTURE.md`.
- Nao use Electron, Redux ou Python no runtime do app.
- Nao distribua ROM comercial; use BYOR e patches IPS/BPS.
- Nao altere "Decisoes Arquiteturais Consolidadas" do Memory Bank sem ordem expressa.

## Barra Minima Antes De Declarar Entrega
- `npm run check:tree`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `cargo clippy -- -D warnings`
- `cargo test --lib -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- Validacao manual com dependencias oficiais quando a mudanca tocar build, emulacao ou toolchains reais
- `npm run host:certify` quando a mudanca tocar host, build, emulacao ou toolchains
- `npm run security:audit` e `cargo audit --file src-tauri/Cargo.lock` quando dependencias ou seguranca mudarem

## Ao Encerrar Sessao
Se algo relevante foi feito, atualize ou proponha atualizacao de `docs/06_AI_MEMORY_BANK.md`.

## Comandos Uteis
- Validar estrutura: `npm run check:tree`
- Lint frontend: `npm run lint`
- TypeScript: `npx tsc --noEmit`
- Testes frontend: `npm test`
- Lint Rust: `cargo clippy -- -D warnings`
- Testes Rust: `cargo test --lib -- --nocapture`
- Diagnostico do host: `npm run host:diagnose`
- Reparar host: `npm run host:ensure`
- Certificar host: `npm run host:certify`
- Auditar npm/licencas: `npm run security:audit` | `npm run security:licenses`
- Medir extracoes arquiteturais: `npm run architecture:metrics`
- Compilacao: `npm run build:debug` | `build:msi` | `build:portable` | `build:all` (script canonico: `scripts/build.mjs`)

## Coleção Projects: continuidade e organização

- Política comum: [../AGENTS.md](../AGENTS.md), especialmente autonomia, testes, GitHub e recursos (§§5–10); raiz/branch em [registro central](../.workspace/projects.json). A orientação atual de raiz única substitui recomendações históricas de criar worktrees/clones por tarefa; os contratos técnicos e gates deste projeto permanecem obrigatórios. Em outro host, preserve este mesmo método em um único checkout registrado, sem recriar caminhos antigos.
- Antes de implementar, leia `docs/06_AI_MEMORY_BANK.md`, `docs/03_ROADMAP_MVP.md`, `docs/08_TREE_ARCHITECTURE.md` e o handoff de host, identifique causa, owner, dependências e aceite. Procure a solução oficial existente e integre nela; não introduza soluções concorrentes, aliases ambíguos ou refatorações fora do pedido. Neste host, a única raiz é `/home/misael/Projects/RetroDevStudio`.
- Execute o lote até implementar, testar, revisar e preservar a continuidade. Resolva decisões reversíveis pelo contexto; não pare em planos nem peça confirmação para editar/testar o que já está autorizado. Comunique descobertas, bloqueios e entrega, sem narrar cada comando ou pequeno avanço.
- Antes de operações pesadas, confira espaço do destino, RAM e carga; estime saídas e retenção. Reutilize ferramentas/ambientes compatíveis, limite jobs e encerre somente processos temporários próprios. Não mate trabalhos alheios, limpe caches compartilhados ou apague evidência para obter um gate verde.
- Use `scripts/new-host.sh`/host-manager e os locks existentes; gerados, toolchains e caches ficam nos destinos oficiais. Neste host, `RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio` é runtime, sem fontes/clones paralelos. Uma compilação pesada por vez, `RDS_BUILD_JOBS=1` inicialmente; preserve JDK compartilhado com SMSForge.
- Faça os checks pertinentes a toda alteração; para documentos, revise diff, referências e coerência. Para código, cubra comportamento/regressão e execute os gates aplicáveis, sem desativá-los. Depois de alterações de comportamento, execute o aplicativo Tauri real pelo launcher e percorra a jornada afetada; Vite sozinho não é o aplicativo. Valide Build → ROM → Emulação quando pertinente, com corpus BYOR fornecido pelo operador. Vitest, host READY e sintaxe não aprovam desktop, usabilidade humana ou equivalência REX; nunca baixar ROMs para completar um gate.
- Reutilize a autenticação válida e os helpers existentes. Nunca peça senha/token no chat, copie sessões ou grave credenciais em código/log. Se faltar acesso indispensável, solicite uma única ação pelo fluxo oficial, preserve o estado e avance no trabalho independente; não repita permissões já concedidas.
- Confira remoto, PRs e checks do SHA antes do lote e ao publicar; reutilize o PR da mesma branch/objetivo. Revise arquivos explícitos, segredos e tamanho, faça commit/push do incremento autorizado e confirme o SHA remoto. Sem stage global de resgates, push forçado, merge de pesquisas ou publicação de dados privados. Não faça polling contínuo de CI.
- PR cabe ao incremento revisável; release somente a marco elegível com versão/artefatos/notas e gates completos, dentro da autorização de publicação vigente. Não gerar release por manutenção destas regras. Preserve limites de merge/deploy e falhas preexistentes; acesso autenticado não amplia autorização.
- Fontes e receitas ficam no Git; bancos, ROMs, assets privados, SDKs, builds, caches e pacotes de resgate seguem owner/destino próprios e recuperação verificável. `.gitignore` não é backup. Novo arquivo acima de 10 MiB exige revisão; downloads acima de 70 MB são manuais, inclusive o pacote dividido, com origem/tamanho/hash/destino preparados.
- Ao fechar, mantenha apenas os gerados necessários e atualize o handoff existente com SHA, testes no host, limites de validação, bloqueio e próximo passo. Não declare produto pronto quando faltar evidência do alvo real, nem deixe um único exemplar de trabalho útil sem proteção identificada.
