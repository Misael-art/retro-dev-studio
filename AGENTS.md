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
- Nao introduza dependencia nova sem aprovacao do usuario e reflexo em `docs/02_TECH_STACK.md`.
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
