# Studio Gráfico Integrado — estado da missão (Experimental)

Fonte da missão: `docs/handoffs/PROMPT_STUDIO_GRAFICO_INTEGRADO_2026-10-19.md` (cópia byte-idêntica do handoff do operador).
Este arquivo é o registro de retomada da missão S0–S6. Não promove maturidade; tudo aqui é **Experimental**.

## S0 — Reconciliação (2026-10-19)

### Base e referências protegidas

| Item | Valor |
|---|---|
| Worktree da missão | `/home/misael/Projects/REX-STUDIO-GRAFICO-2026-10-19` |
| Branch | `codex/rex-studio-grafico-20261019` |
| Base | `40a171694b73e983de0cc01de43e44f5ab5f78a8` (ponta de `codex/rex-commercial-recovery-20261016`) |
| Integração anterior | `03ddc59d…` é ancestral da base (conferido com `git merge-base --is-ancestor`) |
| Pesquisa REA-LAB | `ee8c581f…` **não** é ancestral (48 commits à frente, pesquisa); não importado |
| Checkout de recuperação comercial | intocado; dois JSON não rastreados preexistentes preservados no lugar |
| `host:diagnose` | `READY`, fingerprint `60249508…43f6e2`, lock `dd99a22f…011377` |

Referências do operador (fora do Git, não copiadas): `/home/misael/rds-scratch/studio-grafico-integrado-20261019/references/`.
`manifest.json` SHA-256 `7a65bbfd…4ddf5` confere; os seis arquivos conferem com o manifesto. Imagens examinadas:
01 (sobreposição BG azul / SPRITE laranja / TEXTO rosa sobre Sonic), 02 (Cena com camadas/biblioteca/propriedades “Nesta cena”;
Personagem com timeline de 8 quadros, hurtbox/hitbox, trilha Som e Impacto), 03 (Quando → Se → Fazer com “Apenas uma vez”;
Interface com hierarquia HUD/diálogo e área segura), 04 (Teste com pausar/avançar/mostrar colisões, log de eventos, inspector em
tempo real, “Alterações do teste são temporárias / Aplicar ao projeto”; Entrega com erro/aviso/OK e diagnóstico navegável).
Inconsistências da referência registradas e **não** adotadas: 8 × 0,05 s = 0,40 s anunciado como 24 FPS (REQ-08); destino
desktop 1280×720 (REQ-24, não é resolução de ROM).

Fonte MUGEN real (BYOR, fora do Git): `/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8/`. Hashes reconferidos nesta
sessão e idênticos aos pins de `docs/rex_profiles/mugen_sgdk/REAL_MISSION.md`: `ken8.def fdbe2fb2…`, `ken.sff 911e21b7…`,
`ken.air b1f6c8d0…`, `ken1.act 89942f64…`, `ken.cmd 728e914f…`, `ken.cns 0b4593b7…`; `ken.snd 4f0cfdc8…` (sem pin anterior).

### Mapa existente × lacunas (auditado no SHA base)

| Área | Existente (reutilizar) | Lacuna para a missão |
|---|---|---|
| Shell/workspaces | `EditorWorkspace` (`explorer/scene/game/logic/retrofx/artstudio/debug`) em `editorStore.ts`; `workspaceLayout.ts` | Sem contexto de navegação compartilhado nem retorno; câmera/zoom é um `viewportZoom` global |
| Seleção | `selectedEntityId`, `activeLayerId`, `artStudioAssetPath` | Sem animação/ocorrência/caixa/evento selecionados; troca de workspace não memoriza origem |
| Histórico | `undoStack/redoStack` com snapshot de cena (`UndoEntry`) | Snapshot só de cena+seleção; não inclui contexto de navegação; NodeGraph tem histórico próprio (`graphHistory.ts`) |
| Identidade | Entidades têm `id`; `graph_ref`, prefabs | Recursos referenciados por caminho (`sprite.asset`); hitboxes por índice de quadro (`frame: u32`) |
| Animação MUGEN | `AnimationDef.frame_durations` (canônico, ticks 1/60, -1 parado) + espelho `mugen_frames[].duration`; validação de coerência no gerador (`#error`); Inspector “Quadro N (ticks)” | Sem identidade de ocorrência; sem eventos por quadro (som/impacto); hitboxes autorais por índice |
| Colisões | `MugenAnimationFrame.clsn1/clsn2` importados; `SpriteAnimationHitbox{frame,kind∈attack/hurt/push/collision}` | Sem âncora por ocorrência; sem efeito em runtime de acerto/dano |
| Golpe | `mugen_chain.rs` (comando → estado 200 → anim → retorno), prova Ken Stand_X | HitDef/dano/alvo de treino não convertidos (correto); falta comportamento **autoral** de acerto |
| Áudio | `audio_pipeline.rs`, SFX autoral audível (checkpoint 2026-09-23) | Som não vinculado a ocorrência de quadro; pendência histórica `nodegraph-authoring/som` OPEN |
| Vínculo execução→projeto | `BuildSourceMap` (`node_build_source_map`, sha do fonte gerado e do artefato) | Sem mapa de entidades/sprites/tiles/HUD por quadro emulado; sem época/quadro |
| Inspeção em execução | `emulator_read_memory`, `emulator_observe`, `emulator_run_frame(s)`, época do core, `InspectionPanel` (REX) | Sem modo Inspecionar autoral com sobreposições BG/SPRITE/TEXTO e clique→editor |
| Diagnóstico | `ActionableDiagnostic` + console | Falta “abrir propriedade exata” para novos alvos (ocorrência/evento/HUD) |
| REX | Perfis comerciais M0–M5 delimitados, `InspectionPanel`, publicador IPS | Ponte da navegação comum para perfil comprovado |
| E2E | `scripts/e2e-tauri-build-run.mjs` (WebDriver), cenários `mugen-real`, `mugen-original`, `mugen-import`, `nodegraph-authoring`, limpeza de PIDs | Cenários novos E1–E7 |

### Distribuição dos requisitos por lote (congelada antes de medir)

| REQ | Lote | Implementação prevista | Teste nomeado | Resultado esperado |
|---|---|---|---|---|
| 01 Organização | S1 | Reaproveitar shell; barra de tarefas Cena·Personagem·Ações·Interface·Teste·Entrega mapeada para workspaces existentes | `studioTasks.test.ts`, E3 | Mesmo store/rotas; navegação por tarefa |
| 02 Contexto | S1 | `studioContext` no `editorStore`: pilha de retorno, seleção rica (entidade/animação/ocorrência/caixa/evento), câmera/zoom por workspace | `studioContext.test.ts`, E1/E3 | Voltar restaura seleção e câmera; cancelar não descarta rascunho |
| 03 Identidade | S1/S2 | IDs estáveis de ocorrência (`occurrence_id`) com migração compatível; auditoria de refs por caminho | `animationOccurrences.test.ts`, Rust `occurrence_*` | Reordenar duas ocorrências da mesma imagem preserva durações/eventos |
| 04 Escopo | S4 | Rótulo instância/cena/modelo com N usos; overrides explícitos e reversíveis | E4 | Mudança local isolada; modelo propaga |
| 05 Transações | S1 | Toda intenção → uma entrada de undo incluindo contexto | `editorStore` undo tests, E1 | Um desfazer restaura transação inteira |
| 06 Acessibilidade | S1–S5 | Rótulos, unidades, foco, sem captura de atalho em campos | testes de componente | — |
| 07 Arte/origem | S2 | Reusar importer/revisão MUGEN e oráculo `verify-mugen-real.py` | E1 | Sprites conferem com referência independente |
| 08 Tempo | S2 | Editor de duração por ocorrência em ticks; sem FPS global para MUGEN | `mugenAnimationTiming.test.ts`, E1 | Só a ocorrência editada muda na ROM |
| 09 Timeline | S2 | Timeline com miniaturas reais, passo, onion, ocorrências identificadas | componente + E1 | — |
| 10 Caixas/eventos | S2 | Eventos por ocorrência + tick local; diagnóstico ao encurtar | `frameEvents.test.ts` | Evento inválido diagnosticado, não deslocado |
| 11 Golpe | S2 | Comportamento autoral “ataque → alvo de treino” no compilador existente | Rust + E2 | Acerto só na janela/área; dano uma vez |
| 12 Áudio | S2/S5 | Evento sonoro por ocorrência no driver existente | E2 | Evento na ocorrência; sem duplicar em pausa/passo |
| 13 Cena | S4 | Pincel/apagar/colisão separados (já existem) + câmera | E4 | ROM bate com prévia |
| 14 Comportamentos | S2/S4 | Quando→Se→Fazer como vista do NodeGraph | E2 | Mesma representação |
| 15 HUD | S5 | Texto simples ligado a valor (fonte do destino) | E5 | Valor/posição persistem e aparecem na ROM |
| 16 Diagnóstico | S5 | `ActionableDiagnostic` com alvo navegável | E5 | Clique abre a propriedade |
| 17 Inspecionar | S3 | Modo Inspecionar na execução, camadas filtradas | E3 | Seleção abre entidade/animação/quadro |
| 18 Vínculo | S3 | Estender `BuildSourceMap` com mapa versionado de runtime (build/época/quadro/slot→entidade) | `runtimeLink.test.ts`, E3 | Build/época antigos recusados |
| 19 Limites por origem | S3/S6 | Classificação autoral/MUGEN/comercial/desconhecida | E3/E6 | Desconhecido sem semântica |
| 20 Teste temporário | S5 | Estado de teste separado + “Aplicar ao projeto” com diff | E5 | Não salva sem revisão |
| 21 Atualização | S3/S5 | Estados “Prévia atualizada / Recompilação necessária / Executando build anterior / Confirmado na ROM atual” | E3 | — |
| 22 Base canônica | todos | Sem stores/engines paralelos | revisão de código | — |
| 23 Gêneros | plano | Documentado; não implementado | — | — |
| 24 Destinos | S5 | Capacidades por destino via `projectCapability.ts` | E5 | — |

### Riscos registrados

1. Escopo: S0–S6 com sete jornadas E2E desktop é de várias rodadas; cada lote fecha com checkpoint próprio aqui.
2. Host: disco `/home` 90% (95 GiB livres), 14 GiB RAM; preflight do certify recusa abaixo de 3 GiB — um job pesado por vez.
3. Pendência sonora `nodegraph-authoring` OPEN herdada; só será tratada se bloquear E2.
4. V1 visual FAIL 86/89 herdado, preservado.
5. Core de debug ≪ 60 fps: tempos medidos em quadros emulados, nunca em ms do host.

### Baseline herdado (não reexecutado nesta sessão)

Certificação `certify-20261019T012630Z` READY: 1049 frontend/3 skip, 1038 Rust/94 ignorados; binário `66cb3d71…c12e5`.
Herdado, não conta como execução desta missão.

## Registro de marcos

- 2026-10-19 S0: base/refs protegidas, mapa e matriz congelados, `host:diagnose` READY. Próximo: S1 (contexto de navegação).
- 2026-10-19 S1 parcial (`56d6a86c`): `src/core/studioContext.ts` + `editorStore.studio` (foco rico, pilha de retorno limitada,
  câmera por workspace, persistência por projeto em armazenamento local tolerante a falha, foco restaurado por desfazer/refazer);
  handlers Viewport/Inspector “abrir Arte/Lógica” passam por `openStudioEditor`; `StudioContextBar` com “← Voltar a …”.
  Testes: `studioContext.test.ts` 8/8; suites Inspector/Viewport/App 101/101. Pendente S1: jornada E2E desktop.
- 2026-10-19 S2 backend (`9a0daa56`, `cb31c5b1`):
  - `AnimationDef.occurrence_ids` + `frame_events` (Rust/TS); importador grava `o<n>`; projeto antigo deriva `o<n>` só na geração.
  - Gerador recusa (bloqueia build) evento fora da ocorrência encurtada, ocorrência inexistente, tipo desconhecido, ids repetidos,
    som ausente no Audio; instâncias divergentes de um modelo MUGEN compartilhado bloqueiam em vez de escolher uma em silêncio
    (achado: antes a 2ª instância era ignorada sem aviso).
  - Runtime: evento dispara uma vez por visita da ocorrência; contadores RAM `evfired/evlast`.
  - Nó `authored_strike` (autoral, não CNS) → `LogicOp::AuthoredStrike`: acerto só com Clsn1 real do atacante sobre Clsn2 do alvo,
    uma vez por ativação; RAM `rds_strike_<id>_hp/_hits/_overlaps`.
  - Provas reais (SGDK oficial + core GPGX, `#[ignore]`, rodadas nesta sessão):
    `mugen_real_frame_sound_event_fires_on_occurrence_and_produces_samples` — disparos previstos pelas durações do modelo
    `[6,16,…,76]` = observados; início de som (borda de subida) 3–4 quadros emulados após cada disparo (latência do driver XGM,
    medida, não escondida); controle sem evento silencioso; nenhum início sem disparo.
    `mugen_real_authored_strike_hits_only_in_window_and_area_once_per_activation` — Sentinel autoral: janela Clsn1 quadros 4–8,
    sobreposição 5/5, 1 acerto, vida 100→88; controle longe: janela aberta, 0 sobreposição, vida 100.
  - Limites: sem facing (ambos à direita, como o runtime v1); uma ativação por chute nessa fixture (estado 210 segura `-1`);
    áudio observado como amostras do core, não som físico; Ken real ainda não usado nestes testes (BYOR, próxima etapa E1/E2).
  - Gates: Rust lib 1047/0/96 ignorados; clippy canônico `-D warnings` e fmt ok. `clippy --tests` tem lints preexistentes na base.
- 2026-10-19 S2 frontend (`8150099a`, `6f795156`, `2632d142`):
  - `src/core/characterTimeline.ts` (7 testes) e `CharacterTimelinePanel` na tarefa Personagem (workspace artstudio) para
    entidades MUGEN: células reais do sheet, Clsn1/Clsn2, reprodução em ticks, passo, onion skin, reordenar levando
    duração/caixas/identidade, eventos de som com diagnóstico ao encurtar e retiming só explícito; escopo
    “Editar modelo — N usos” aplicado a todas as instâncias numa única entrada de desfazer (6 testes de componente).
  - Achado corrigido: “Atualizar entidade” do ArtStudio reconstruía `animations` a partir de sequências deduplicadas e
    ordenadas, apagando `mugen_frames`, ordem e ocorrências repetidas; agora recusa com diagnóstico para entidades MUGEN.
  - Nó `authored_strike` no catálogo/validação/resumo/paleta; SNES recusado antes do build.
  - Menu Projeto ganhou Desfazer/Refazer; zoom com `data-testid`/`aria-label`; `getState` de automação expõe o contexto.
  - Cenário desktop `studio-e1` escrito (ainda não executado nesta entrada).

### Contrato S3 previsto (congelado antes da implementação)

`retrodev.runtime_link/v1`, gravado pelo build ao lado de `rds-node-source-map.v1.json`, ligado ao SHA-256 da ROM gerada:
entidades (id, origem autoral/MUGEN, variável, recurso, tamanho de quadro, pivô, endereços RAM de x/y/anim/frame lidos do ELF,
ordem das animações, ids de ocorrência e deslocamentos por quadro do build), tilemaps (entidade, plano, posição, tamanho).
A seleção em execução só navega se: ROM carregada = `rom_sha256` do vínculo, época do core = época do quadro pausado, e o
recurso (entidade/animação/ocorrência) ainda existir no projeto atual; senão recusa explicando o motivo. Slots físicos de
sprite do VDP não são usados como identidade. Testes previstos: `runtimeLink.test.ts` (geometria com letterbox/zoom,
sobreposição, ROM/época antigas, recurso renomeado) e jornada E3.
- 2026-10-19 E1/E3 corrida `e1-run-001` — **FAIL** (preservada em
  `/home/misael/rds-scratch/studio-grafico-integrado-20261019/runs/e1-run-001/`): app `9b86f9a7…` (fonte `d60272e3`),
  Xvfb pinado `5bfd315a…`, janela 1280×800, Ken BYOR. Passaram: importação real, build de referência, abrir Personagem com
  contexto (barra, escopo “1 uso”, prévia de o3 sem Clsn1 e o2 com Clsn1), edição só de o3 (0 recusado sem histórico;
  o1 intacto), desfazer/refazer pelo menu com foco preservado. Falhou: “voltar à origem” não reencontrou a seleção.
  Causa: a origem usava `studio.focus.entityId`, não sincronizado quando a seleção veio da hierarquia. Correção no store
  + teste de regressão (`studioContext.test.ts`, 9/9). Próxima corrida: `e1-run-002` com build novo.
- 2026-10-19 E1/E3 corrida `e1-run-002` — **PASS** 9/9 etapas. App `56f8dbda…` (fonte `a9666095`), Xvfb pinado, 1280×800,
  relatório `runs/e1-run-002/evidence/studio-e1-2026-10-19T13-23-07-331Z-report.json` (scratch). Ken real: action_200
  imagens `200,1/200,2/200,1`, durações `[2,2,2]`. Edição só de o3 → ROM `ee7b5ef1…` com sequência medida em quadros
  emulados (Step 1 frame da UI + sonda RAM) `[[0,2],[1,2],[2,6]]` = prevista; o1 intacto; action_0 intacta no disco.
  Retorno à cena com zoom 2,25 e seleção; salvar → destruir janela → reabrir preservou. Restauração pela UI → ROM
  `d0a966b6…` **byte-idêntica** ao build de referência, sequência `[2,2,2]`. E3: Inspecionar no quadro pausado 91,
  clique nativo no Ken → Personagem em `action_0/o4` = RAM; vínculo `4bccf63a…` com endereços = ELF; retorno ao Teste no
  mesmo quadro/ROM. Limites: sem sobreposição real no clique (escolha entre sobrepostos só em teste de componente);
  conferência de arte independente do E1 **não** reexecutada nesta corrida (herdada de `mugen-real`; reexecutar na E7).
- 2026-10-19 E4 corrida `e4-run-001` — **FAIL** (preservada em `runs/e4-run-001/`): app `4af376a7…` (fonte `8f108cc5`).
  Passaram importação e cópia + mudança local de posição. Falhou ao abrir Personagem a partir da CÓPIA: o botão de arte
  só existia para entidades com proveniência importada, e a cópia não a carrega. Lacuna de UX real (o usuário não teria
  como abrir o editor pela cópia). Correção: ação geral “Abrir no Personagem/Abrir em Ações” no cabeçalho do Inspector
  para qualquer entidade com sprite. Próxima: `e4-run-002` no build 005.

## Retomada (estado ao fim da sessão 2026-10-19)

Concluído com prova nesta sessão: S0; S1/S2/S3 (E1+E3 `e1-run-002` PASS); núcleo S4/S5/S6 implementado e testado
(unit + testes reais SGDK/core `#[ignore]`). **Não executados ainda:** E4 (`e4-run-002`), E2/E5 (`studio-e2e5`),
E6 (cenário REX ainda não escrito; perfis embutidos: `m68k.copy_grid.v1`, `counter_threshold_state_gate.v1`,
`platformer_jump.v1`), E7 regressões (`mugen-real` com oráculo de pixels, `nodegraph-authoring`, `mugen-*`),
`host:certify`, `crates:gates`, roteiro de validação humana. Build 005 (fonte HEAD) foi iniciado em
`runs/build-debug-005.log`; conferir antes de usar.

Próximo comando exato (um job pesado por vez):
`R=/home/misael/rds-scratch/studio-grafico-integrado-20261019/runs/e4-run-002; RDS_MUGEN_REAL_SOURCE=/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8 RDS_STUDIO_E1_OUTPUT=$R/evidence python3 -I scripts/qa/run-sonic-desktop-isolated.py --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 --app src-tauri/target-test/debug/retro-dev-studio --work $R/work --log $R/run.log --scenario studio-e4 --window 1280x800`
Depois o mesmo com `--scenario studio-e2e5` (`e2e5-run-001`). Maturidade: Experimental; sem push.
- 2026-10-19 binário 005 `5eec01a6…` (fonte `a43407dc`):
  - E4 `e4-run-002` **PASS** 4/4: cópia em x=216 vs original 96 na RAM da ROM (mudança local isolada); modelo o2 do idle
    6→12 em UMA entrada de desfazer, observado nas DUAS instâncias (`[...,[1,12],...]`); ROM `419d09e5…`.
  - E2/E5 `e2e5-run-001` **FAIL**: importação, cópia-alvo, som autoral na o2 e “Golpe autoral” pelo formulário
    passaram; rótulo do texto não confirmou (campo só aplicava no blur; blur programático). Correção: Enter aplica.
  - E6 `e6-run-001/002` **FAIL** (assistente de projeto cobria o jogo; harness passou a usar “Continuar sem projeto”);
    `e6-run-003` **FAIL**: clique sem vínculo declarado Desconhecido sem abrir editor e perfis localizados, mas o
    editor do perfil fica na vista “Lógicas” do Reverse, não aberta pela ponte. Correção: ponte abre essa vista.
- 2026-10-19 binário 006 `36ce2cdc…` (fonte `9ed8a8c7`):
  - E6 `e6-run-004` **PASS**: Sonic 1 BYOR `c7da53a1…` sem vínculo de projeto; clique no quadro → “Desconhecido”, nenhum
    editor; perfis localizados → `m68k.platformer_jump.v1@0x1340c` aberto e focado no editor de perfil REX existente.
    Limite: edição/cópia/IPS/reversão desse perfil não reexecutada aqui (herdada das jornadas REX anteriores).
  - E2/E5 `e2e5-run-002` **FAIL**: telemetria do player não muda em passo a passo (o passo não encaminha áudio).
    Prova de áudio passou a usar o jogo rodando com controle silencioso.
  - E2/E5 `e2e5-run-003` **PASS** do núcleo: janela Clsn1 [67,68,96,97], acertos [67,96] (um por golpe), evento sonoro
    exatamente nas entradas de o2 [67,96], vida e texto 76; player: 0 quadros com amostras no controle × 14480 após o
    ataque; ajuste temporário (alvo a 280) sem acerto, nada gravado, aplicar = 1 desfazer e desfazer restaurou. Lacunas:
    foco não chegou à propriedade após “Abrir na Interface”; exportação não exercitada (desfazer marcou build anterior,
    corretamente bloqueado). Correções: foco com nova tentativa; jornada recompila antes de exportar.

## Fecho 2026-10-19 — binário final 007

Binário `6e87ba14…` (fonte `2f92c03c`, `npm run build:debug`), Xvfb pinado, manifesto
`data/studio_grafico/final-manifest.json` (SHA de binário, baseline, entradas Ken BYOR, relatórios).
- Jornadas Studio no MESMO binário: E2/E5 `final-e2e5-001` PASS 8/8 (inclui exportação `eaab2b11…` = ROM executada),
  E1/E3 `final-e1e3-001` PASS 9/9, E4 `final-e4-001` PASS 4/4, E6 `final-e6-001` PASS 3/3.
- E7 regressões: `mugen-real` PASS + oráculo independente Pillow PASS (204 core/212 UI, 5 negativos recusados);
  `mugen-import` PASS; `nodegraph-authoring` FAIL na 1ª (“X não pulou”), a MESMA falha no baseline `66cb3d71…`
  (`baseline-nodegraph-001`) → instabilidade preexistente de toque curto; retentativa única registrada PASS.
- `host:certify` READY (1ª tentativa BLOCKED: TMPDIR da sessão em `~/.cache` e o Ghidra recusa elemento com ‘.’;
  repetida com TMPDIR em scratch, gates inalterados). fmt ok, tree ok, Rust 1050/0/98 no certify.
- Pendências reais: validação humana (roteiro em `ROTEIRO_VALIDACAO_HUMANA.md`, não executado); edição gráfica de caixas;
  camadas Colisões/Áudio no Inspecionar; pintura de tiles no E4; aplicar exceção ao modelo de prefab; edição/IPS do perfil
  REX dentro do E6 (herdada); auditoria de referências por caminho de asset. Maturidade Experimental; sem push/release.

## Rodada 2 (2026-10-19, a partir de `7be946c5`)

### Adendo A — lacuna de identidade na navegação (reproduzida antes da correção)

Reprodução: `runtimeLink.test.ts` ganhou 5 casos; no código de `7be946c5` 3 falharam — candidato do vínculo antigo
ACEITO após trocar `sprite.asset` (IDs iguais), sem pedir conteúdo ao mudar o caminho, e após trocar a imagem da
ocorrência (`frames[i]` ou grupo/imagem SFF). Correção: o vínculo grava `asset`, `asset_sha256` (arquivo no build) e
`occurrence_images` por ocorrência; a navegação compara com o projeto atual; caminho novo só é aceito se o SHA-256 do
arquivo atual for igual (mover/renomear legítimo); vínculo antigo sem identidade é recusado. Renomear entidade
(display_name) continua aceito.

Expectativa congelada para a jornada (antes de medir): após a seleção E3 bem-sucedida, trocar pelo Inspector o asset do
Ken para outro arquivo do projeto (conteúdo diferente) SEM recompilar → clique no Ken no mesmo quadro pausado é recusado
com “mudou desde o build” e o workspace continua Teste; desfazer a troca → o mesmo clique volta a abrir Personagem na
ocorrência indicada pela RAM.

### Adendo B — edição gráfica de caixas (expectativa congelada antes da jornada)

Implementação: `characterTimeline.ts` (`setOccurrenceBox/addOccurrenceBox/removeOccurrenceBox`, validação inteiros,
±511 px, área ≥1 px, ≤8 por tipo), `clsn_edited` por ocorrência (Rust/TS, migração compatível: ausente = importada),
prévia com arrastar/redimensionar/setas e campos x1..y2 (cada gesto = 1 desfazer, todas as instâncias do modelo).
Prova real (core): `mugen_real_edited_attack_box_removes_the_hit` PASS (janela abre, 0 sobreposições, vida 100).
Jornada (E2/E5, depois da exportação, mesmo projeto): arrastar nativamente a caixa de ataque de o2 do Ken 600 px de tela
(200 px no eixo, escala 3) → disco com Clsn1 deslocada +200 em x e `clsn_edited` → build/run → ataque pelo teclado:
janela Clsn1 abre e `hits` NÃO aumenta; desfazer pelo menu → salvar → build/run → ataque: `hits` aumenta exatamente 1.

### Adendo C — cena: tiles, colisão física e câmera

Achados antes de medir: (1) câmera “seguir” só rolava BG_A pela posição crua do alvo, com sinal invertido, sem limites
e sem deslocar sprites; (2) o componente Camera com `follow_entity` era ignorado sem um nó no grafo. Correção
(compatível): canto da câmera = alvo + deslocamento autoral (grafos antigos com −160 mantêm a intenção), limitado ao maior
tilemap da cena menos 320×224; planos rolam −câmera; sprites desenhados em mundo − câmera; componente Camera passa a
valer quando não há nó explícito; template de referência centraliza (−152, −112); vínculo expõe `rds_camera_x/y` e a
inspeção subtrai a câmera. Prova real: `reference_real_camera_follows_player_clamped_to_world` PASS (câmera = clamp(x−152,
0, 320) com tolerância de 1 quadro de movimento). Limite registrado: HUD é desenhado no plano A; com câmera em mundo maior
que a tela o texto rola junto (ver pendências).

Expectativa congelada da jornada `studio-scene` (antes de medir), template de referência pelo assistente:
TM Width 80 pelo Inspector; pintar tile 2 numa célula do céu e apagar (célula vazia) uma célula visível do chão, sem mudar
a contagem de colisão; parede de colisão de 4 células numa coluna à direita do jogador por UM traço (1 entrada de desfazer;
desfazer remove as 4; refazer recoloca); salvar; build/run; segurar → pelo teclado nativo: x do jogador (RAM) para em
`coluna*8 − largura_colisão` (±velocidade) e nunca passa; câmera (RAM) = clamp(x−152, 0, 320) ±4 px e > 0 antes da parede;
no quadro do core, a célula apagada fica com a cor de fundo (todos os pixels iguais ao pixel do céu acima), diferente da
mesma célula no build anterior à edição.

### Adendo D — camadas Colisões e Áudio na inspeção (expectativa congelada)

Vínculo passa a carregar caixas compiladas por ocorrência, tabela de eventos na ordem da ROM, contadores
`evfired/evlast/evlast_anim` (novo: a ROM registra a animação do último disparo) e o mapa de colisão. Camadas desenham
caixas da ocorrência atual (eixo − câmera) e células sólidas; Áudio lista disparos/último evento lidos no quadro pausado.
Jornada E2/E5 (após os dois golpes, pausado): ativar Inspecionar + Colisões + Áudio → existe caixa de corpo do Ken;
`inspect-audio-kenmasters` com `data-fired` = RAM `evfired` (2) e `data-last` = id do evento criado; avançar 1 quadro →
`data-frame` passa a ser o novo quadro (reamostra, nada do quadro anterior fica na tela).
- Corridas no binário 009 `fc87b17a…` (fonte `5c02cf2e`), preservadas: `scene-run-001/002/003` FAIL (paleta cobria a cena
  em 1280×800 → altura limitada; depois falha ao apagar, em diagnóstico); `e2e5-run-004` FAIL só no arrasto da caixa
  (alvo +600 px saiu da janela de 1280 px) — camadas Colisões/Áudio PASS, exportação PASS; `e1e3-run-003` FAIL na volta ao
  Teste (overlay é desligado ao trocar de workspace; jornada passa a religá-lo).
  Adendo de protocolo (antes da nova corrida): arrasto de +300 px de tela = +100 px no eixo (caixa 118..168, ainda sem
  sobreposição com o corpo do alvo em 0..48); expectativa de deslocamento gravado passa a 100 px.
- `scene-run-004..009` (binário 009) FAIL, preservadas: pontos fora do palco visível (sobreposição sob painéis; guarda
  da jornada reforçada e coluna escolhida entre as visíveis); `scene-run-009` marcou 3 de 4 células da parede: o pincel de
  colisão (e o lápis de tiles) não interpolava entre amostras do ponteiro — traço rápido pulava células. Correção:
  `cellsOnLine` (Bresenham) nos dois pincéis, com testes. Expectativa inalterada.
- Binário 010 `49e92709…` (fonte `7eae5d3c`):
  - `scene-run-010` **PASS**: TM Width 80 pelo Inspector; tile pintado (6,20) e célula (20,21) apagada para vazia sem
    mudar a colisão; parede (col 25, linhas 22–25) por um traço = 1 desfazer, desfazer/refazer; ROM `a0f61b2d…`: x máx
    186 = previsto 186 (25·8 − largura 14), nunca atravessa; câmera = clamp(x−152,0,320) em 227 amostras, máx 34;
    célula apagada uniforme no core e diferente do build base `069440b4…`.
  - `e2e5-run-005` **PASS** 11/11 com as novas pernas: camadas Colisões/Áudio no quadro pausado (disparos = RAM, último
    evento correto, reamostra ao avançar); caixa de ataque arrastada +100 px → ROM `a53bad9b…` janela 2, acertos 0;
    desfazer → ROM `1ff5dcd4…` (= ROM exportada) acerta 1.
  - `e1e3-run-004/005` FAIL (console aberto pelo erro de carga do asset trocado cobria o canvas; jornada passa a fechar o
    console e conferir o elemento sob o ponto); `e1e3-run-006` **PASS** 10/10 com recusa do candidato antigo após troca
    de asset e aceitação após desfazer.

### Adendo E — referências por caminho, modelo/instância e limites de histórico (expectativa congelada)

Implementação: `core/project_refs.rs` (auditoria de `assets/…` em cenas/modelos/grafos inclusive grafos em string;
renomear/mover transacional com cópia em `.rds/backups/<id>/`, só referências exatas, recusa sobrescrita/extensão/fora de
assets, desfaz tudo em falha; aplicar exceção ao modelo; restaurar bytes), IPC e `projectFileOps.ts` (salva antes,
recarrega do disco, declara que o desfazer recomeça e oferece “Reverter”), Inspector “Mover/renomear arte…”, selo de
escopo com “Aplicar ao modelo (N)”, barra com “Reverter” e “Desfazer: últimos 50 passos”, Revisar com “Arquivo não
encontrado”. Testes Rust 4/4 e frontend.
Jornada `studio-model` (template de referência): (1) renomear a arte do jogador pelo Inspector → arquivo movido, nenhuma
referência antiga no disco, build com ROM byte-idêntica à de antes; Reverter → bytes de cena/modelo iguais aos de antes e
arquivo de volta; (2) duplicar `passage_blocker` (2 instâncias do mesmo modelo), mudar `Col. Width` na cópia → selo mostra
exceção local; “Aplicar ao modelo (2)” → modelo com a largura nova e as duas instâncias herdando; Reverter → bytes
anteriores; (3) 51 pinceladas → “Desfazer: últimos 50 passos”; (4) preparação técnica rotulada: remover a arte de um
modelo no disco → Revisar lista “Arquivo não encontrado” com quem usa; arquivo restaurado depois.

### Adendo F — E6 completo (expectativa congelada)

Depois de abrir o editor do perfil pela inspeção (Sonic 1 BYOR `c7da53a1…`, instância comprovada), na mesma jornada:
alterar UM campo pela UI dentro da faixa → “Gerar cópia + patch” numa pasta nova → exatamente 2 arquivos (.bin e .ips),
tamanho preservado, ROM original intacta (SHA igual ao de antes), bytes diferentes só nos offsets do campo, IPS aplicado
por implementação independente (no harness) reproduz a cópia; “Jogar esta cópia” → core identifica a ROM pelo SHA da
cópia e avança quadros; “Voltar à ROM original” (novo botão, mesmo carregador) → core volta ao SHA original. Efeito de
jogabilidade do campo (altura do pulo) NÃO é medido aqui; permanece o resultado das jornadas REX anteriores (herdado).
- Binário 011 `9176fe34…` (fonte `04ca4fdf`), preservadas: `model-run-001` FAIL após a perna de renomear PASSAR
  (referências movidas, ROM byte-idêntica, Reverter devolveu os bytes) — faltava voltar à aba Cena antes da Hierarquia;
  `e6-run-005/006` FAIL: o caminho digitado perdeu todas as letras “c”. Causa (defeito REQ-06): o teclado→joypad do jogo
  fazia `preventDefault` mesmo com foco num campo (C/Z/X/setas/Enter sumiam enquanto havia sessão do emulador); o
  atalho de Espaço do viewport também bloqueava antes da guarda de campo. Correção `keyboardFocus.ts` + teste.
- Binário 012 `3be68066…` (fonte `539fd959`), preservadas: `model-run-002` FAIL — expectativa minha errada: “Aplicar ao
  modelo” salva a cena antes de operar, então o ponto de retorno é o estado SALVO (com a cópia e a exceção), não o disco
  anterior ao salvamento. Adendo de protocolo (antes da nova corrida): salvar e então fotografar os bytes. `e6-run-007`
  FAIL após gerar cópia+IPS e jogar a cópia: ao sair para o Teste o painel REX perde o resultado e o “Voltar à ROM
  original” — lacuna de UX. Correção: o Teste mostra “Voltar à ROM original” enquanto roda uma cópia REX.
- Binário 013 `cf928038…` (fonte `6cd989a8`): `e6-run-008` **PASS** E6 completo (campo do perfil editado, cópia+IPS,
  só os bytes do campo, IPS independente reproduz a cópia, original intacta, core rodou a cópia, voltou à original);
  `model-run-003..006` FAIL (pinceladas caíam na paleta / fora do tilemap — jornada passou a escolher células visíveis);
  `model-run-007` **PASS** 4/4.

### Certificação da rodada 2 (protocolo congelado antes das corridas)

Binário final 013. Mesmo binário para: studio-e1 (E1/E3 + recusa por identidade), studio-e2e5 (E2/E5 + camadas + caixas),
studio-e4, studio-scene, studio-model, studio-e6 (com Sonic 1 BYOR), mugen-real (+ captura backend e oráculo Pillow
da mesma fonte), mugen-import, nodegraph-authoring (uma corrida; se falhar, registrada sem retentativa contada como
confiabilidade; a falha de entrada do baseline permanece registrada). Depois `host:certify` (TMPDIR fora de `~/.cache`),
fmt e Clippy padrão, e o manifesto com hashes completos e caminhos verificáveis.

#### Resultado da certificação da rodada 2 (binário 013 `cf928038adc58f1cf9be3ab05b35f92a177b136983759c68d08822be341bb6c9`)

Nove jornadas, uma corrida cada, todas rc=0 e `allPass` nos relatórios: cert2-e1e3, cert2-e2e5, cert2-e4, cert2-scene,
cert2-model, cert2-e6, cert2-mugen-real, cert2-mugen-import, cert2-nodegraph. Nenhuma retentativa de jornada. As falhas
das corridas de desenvolvimento acima (model-run-001..006, e6-run-005..007 etc.) continuam registradas; a falha de
entrada reproduzida no baseline do nodegraph continua registrada como histórico (esta corrida única passou; uma
aprovação não demonstra confiabilidade).

- **Oráculo MUGEN:** a corrida cert2-mugen-real passou, mas o harness apaga o projeto temporário ao final e o oráculo
  precisa da ROM compilada do projeto (`ui_compiled_resources`) → não pôde rodar sobre ela. Corrida adicional
  **cert2-mugen-real-oracle** (mesmo binário, `RDS_E2E_KEEP_PROJECT=1`, rc=0) como entrada do oráculo — não é retentativa
  de falha. Captura backend `mugen_real_pilot_build_and_capture` ok; `verify-mugen-real.py`: 21 prévias, 204 quadros do
  core, 212 da UI, 5 controles negativos recusados. Projeto preservado em `~/Documents/RetroDevProjects/Ken_Majik_Real_1792441783856`.
- **host:certify:** tentativa 1 **FALHOU** (`gate_failed:frontend-tests`, `npm test` exit 1, sem log capturado pelo
  certificador; relatório preservado em `runs/host-certify-attempt1.json`). `npm test` isolado logo depois: 125 arquivos,
  1127 passaram. Tentativa 2 com saída capturada (`runs/host-certify-attempt2.log`): READY, sem bloqueios (1130 passaram).
  **Causa da falha 1 não atribuída** — sem evidência; tratada como intermitência não explicada, não como resolvida.
- `cargo fmt --check` ok; `cargo clippy` padrão sem avisos.
- Manifesto: `data/studio_grafico/final-manifest-r2.json` (SHA-256 completos de binário, bundle, Xvfb, entradas BYOR,
  cada arquivo das corridas e das tentativas de certificação); `node scripts/qa/studio-grafico-manifest.mjs verify …`.

Pendências anteriores conferidas: identidade do vínculo (recusa em cert2-e1e3), caixas por ocorrência com efeito na ROM
(cert2-e2e5), tiles/colisão/câmera na UI e no jogo (cert2-scene), camadas Colisões/Áudio no quadro e sessão corretos
(cert2-e2e5), referências/migração/limites (cert2-model), E6 completo até voltar à original (cert2-e6). Continuam abertos
os limites do mapa (HUD rola com a câmera, efeito de jogabilidade do campo E6 herdado, leitor de tela, facing, PAL) e a
validação humana, que segue separada e sem participação real. A proposta inteira **não** está concluída.

## Rodada 3 (checkpoint preservado: `cce18a00`)

### Adendo G — expectativas congeladas antes das medições (binário 014 `5f4c815a3238933d123e13822d89fffd627c914bd5b3e7f3fb55a76a50374cef`, fonte `8305794e`)

1. **Identidade, mesmo caminho.** Antes da correção, `checkRuntimeNavigation` aceitava conteúdo diferente no MESMO
   caminho com os mesmos IDs (2 testes discriminantes falharam em `cce18a00`: “refuses changed content at the SAME
   path…”, “asks for the current content hash even when the path is unchanged”). Agora o SHA-256 do conteúdo atual é
   sempre exigido; o chamador lê o arquivo só no clique (nunca no laço do emulador; teste de componente confirma
   zero leituras ao re-renderizar quadros). Jornada studio-e1, perna E3c: bytes a mais no arquivo do Ken (mesmo
   caminho; edição externa feita pelo harness) → clique recusado com “mudou desde o build”; bytes originais →
   abre; conteúdo alterado + nova compilação → vínculo com o SHA novo → abre. Pernas E1/E3/E3b iguais à rodada 2.
2. **HUD com câmera.** Defeito reproduzido no core real antes da correção (`mugen_real_hud_stays_screen_anchored_while_camera_scrolls`:
   com duas camadas de mapa a câmera rola o plano A e o texto ia junto; 53 pixels de letra em comum contra 93 com a
   correção). Correção: com câmera de mundo, o texto usa o plano fixo WINDOW nas linhas do HUD (topo OU base; HUD
   nas duas metades bloqueia o build). Limite: nas linhas do HUD o plano A fica coberto. Projeto sem câmera: C sem
   mudança. Jornada nova **studio-hud-camera** no mesmo projeto Ken: texto VIDA ligado ao golpe (UI), mapa 80×28 em
   duas camadas (preparação em disco declarada — a UI não cria tilemap em projeto MUGEN — e reabertura pelo app),
   Ken anda pela tecla → câmera ≥ +48 px, linha 100 do cenário muda, ≥90% das letras do HUD nos mesmos pixels,
   indicador mostra 100, inspeção acha a caixa do texto no retângulo de tela (16,192) e o clique abre a Interface.
3. **Delta e reexecução.** Afetados: studio-e1 (identidade), studio-e2e5 (Ken com câmera importada + HUD: o texto
   agora vai para o WINDOW), studio-hud-camera (nova). Não afetados pelo delta (sem HUD ou sem câmera, e sem
   navegação por identidade de personagem): e4, scene, model, e6, mugen-real, mugen-import, nodegraph — resultados
   da rodada 2 (binário 013) permanecem como herdados, não como execução nova. Uma corrida por jornada; falha é
   registrada antes de qualquer correção.

### Resultado da rodada 3 (binário 014 `5f4c815a…`, fonte `8305794e`; harness ajustado em commit seguinte)

Todas as corridas preservadas em `runs/cert3-*` e no manifesto `data/studio_grafico/final-manifest-r3.json`:

| Corrida | Binário | rc | Resultado / causa |
|---|---|---|---|
| cert3-e1e3 | 014 | 0 | PASS, inclui E3c: mesmo caminho alterado → recusa; restaurado → abre; nova compilação com SHA novo → abre |
| cert3-e2e5 | 014 | 0 | PASS (Ken com câmera importada: o HUD agora vai para o WINDOW; golpe/som/HUD/camadas/caixas iguais) |
| cert3-hud-camera | 014 | 1 | FALHA de harness: `Missing text parameter` — ao copiar o helper do E2/E5 perdi o caractere invisível U+E007 (Enter do WebDriver) |
| cert3-hud-camera-r2 | 014 | 1 | mesma falha, agora localizada por marcadores de fase (`B-rotulo`) |
| cert3-hud-camera-r3 | 014 | 1 | FALHA de harness: testid `viewport-play` não existe (é `viewport-resume`) |
| cert3-hud-camera-r4 | 014 | 1 | FALHA de medição: HUD na linha 24 ficava sob o sprite do Ken; métrica escolheu o preto do tileset |
| cert3-hud-camera-r5 | 014 | 1 | FALHA de medição: linha 1 já tem texto da cena importada; cor das letras igual à do cenário |
| cert3-hud-camera-negative-013 | 013 | 1 | controle negativo inconclusivo (mesmo defeito de medição de r5) |
| cert3-hud-camera-r6 | 014 | 1 | mesma medição de r5, com quadros do core salvos para diagnóstico (mostram as causas acima) |
| cert3-hud-camera-r7 | 014 | 0 | **PASS** — linha 4, tileset sem preto: câmera 96→148, linha 100 mudou 208 px, letras 167/167 nos mesmos pixels, indicador 100, inspeção acha o texto em (16,32) com a câmera deslocada e abre a Interface |
| cert3-hud-camera-negative-013-r2 | 013 | 1 | controle negativo **válido**: no binário sem correção nenhum pixel de letra fica estável (o texto rola) |

Nenhuma corrida de r1–r6 conta como confiabilidade; r7 é uma aprovação única. As mudanças entre r1 e r7 foram só no
harness/protocolo (o binário 014 é o mesmo); o protocolo do Adendo G previa linha 24 — trocada para a linha 4 por causa
da sobreposição com o sprite (registrado aqui, depois da falha).

Outros resultados: Rust `cargo test --lib` 1055 ok; reais `mugen_real_*` 6 ok + `pilot_build_and_capture` sem
`RDS_MUGEN_REAL_OUTPUT` (só roda no fluxo do oráculo; não reexecutado nesta rodada, Ken sem HUD não muda); 
`reference_real_camera_*` ok; vitest 1130 ok; tsc/lint/fmt/clippy `-D warnings` ok; `host:certify` READY na primeira
tentativa desta rodada. A falha não explicada do `host:certify` da rodada 2 continua registrada como tal.

**Defeito novo encontrado e não corrigido:** num projeto MUGEN com tilemap, o tilemap usa PAL0 fixo e sobrescreve as
cores do personagem e da fonte (Ken e o texto saem com as cores do tileset). Visto nas capturas da jornada studio-hud-camera.
Também: o WINDOW cobre o plano A nas linhas do HUD (o texto “Camera …” da cena importada, na linha 1, some se o HUD
usar essas linhas).

Validação humana: sessão preparada no roteiro existente (`ROTEIRO_VALIDACAO_HUMANA.md`), **não executada**.

## Rodada 4 — paletas e composição personagem + cenário + HUD (checkpoint preservado: `e40f209b`, binário 014 `5f4c815a…`)

Adendo do operador: `docs/handoffs/ADENDO_PALETAS_INTERATIVAS_2026-10-19.md` (arquivo do operador, não versionado por mim).

### Auditoria (antes de implementar)
- Paleta de cada asset = ordem de primeira aparição do conversor do build (`index_image`; índice 0 = transparência);
  com limite de 16 entradas as cores excedentes iam para a mais próxima **sem aviso** (agora: aviso visível no plano).
- Emissor: tilemap sempre `PAL0` e `VDP_drawImageEx(..., loadpal TRUE)`; sprite com `palette_slot` 0 **não carregava**
  a paleta quando havia tilemap (a colisão do checkpoint `e40f209b`); texto sempre `PAL0` índice 15.
- `Scene.palettes` (slot + cores) existia só no editor; não chegava à ROM. Não havia importação de imagem pela UI.
- Conversão de cor do rescomp pinado: `(c >> 4) & 0xE` por canal (`tools/rescomp/.../Util.toVDPColor`).

### Marcos e hipóteses refutadas (fase de testes no core real, antes da jornada)
- **Defeito pré-existente encontrado e corrigido:** mapa com mais de 64 tiles usava plano de 64 e dava a volta —
  as colunas 0..15 do mundo eram sobrescritas pelas 64..79 (32 px errados por linha na tela, medidos). As jornadas de
  câmera das rodadas 2–3 não conferiam posição de pixel e não detectaram. Agora: 128×32 ou erro explícito.
- **Hipótese refutada:** “a cor de dano fica visível exatamente 12 quadros”. Medido: o contador da troca fica aberto
  12 quadros (2..13), mas o alvo não tem pixels no quadro 8 (streaming de tiles do sprite: 0, 97, 193, 288, 384 px).
  Critério corrigido e registrado: estado da troca pela RAM (`rds_palswap_*_left`) + cor de dano só dentro da janela.
- Erro de classificação no próprio teste (branco do personagem contado antes do branco da fonte); corrigido pela
  ordem (faixa do texto primeiro), sem mudar cores nem tolerâncias.
- Controle negativo no core (mesmo projeto, emissão antiga sem plano): personagem com 0 pixels nas cores dele,
  fonte ausente, pixels fora das referências → reprovado pelo mesmo classificador.

### Adendo H — contrato congelado da jornada `studio-paletas` (antes da primeira corrida)

Referências independentes (não lidas da ROM nem do plano):
- Cenário: PNG 640×224 gerado pelo harness, padrão `((x/16)+(y/16)) % 3` com A=(36,73,182), B=(73,182,73),
  C=(219,146,36); cores exatas do destino (truncar = arredondar). Esperado na tela: cor do pixel do mundo
  `(x+câmera_x, y+câmera_y)` → níveis `c>>5` → saída RGB565 do Genesis Plus GX (fórmula do oráculo MUGEN).
- Ken: paleta `ken1.act` da fonte BYOR → mesma fórmula (níveis arredondados, como o oráculo MUGEN). Nenhuma cor
  do cenário nem a de dano pertence a esse conjunto (verificado antes).
- Fonte: (238,238,238) → mesma fórmula; só conta como fonte dentro da faixa do HUD (linhas 0..4, y < 40).
- Dano: (219,36,36), paleta “Dano” criada na UI.
Critérios (igualdade exata, sem tolerância):
1. Quadro após 60 quadros: zero pixels fora das referências; zero pixels de cenário errados; ≥ 50 px de Ken;
   ≥ 20 px de fonte na faixa; nenhum px de dano.
2. Golpe (KeyZ): `hits` = trocas = restaurações = 1 após a janela; janela de 12 quadros contínua pela RAM; cor de dano
   só com a janela aberta e observada ≥ 1 quadro; Ken (outro banco) presente com as cores dele em todos os quadros;
   zero pixels desconhecidos em todos os quadros.
3. Caminhar (ArrowRight): câmera avança ≥ 32 px; cenário continua exato com a câmera nova; os pixels de letra
   (cor da fonte na faixa) são os mesmos antes e depois.
4. Inspeção: `data-palette-bank` de kenmasters e kenmasters_2 = bancos do plano; rótulo diz “planejado”; clicar no
   alvo abre o Personagem e volta.
5. Edição compartilhada do cenário pela UI (índice da cor A → (73,73,73)): ROM nova mostra (73,73,73) onde o mundo
   tem A e nada mais muda (Ken, fonte, B, C iguais); “Voltar às cores do arquivo” + build = ROM byte-idêntica à
   primeira; exportação canônica = mesma ROM.
6. Editor: resumo 3/4 antes da variante (Ken compartilhado por 2 instâncias), 4/4 depois; faixa do HUD visível
   (`viewport-hud-band` linhas 0-4); hover/foco descrevem um uso e o clique abre a entidade; edição compartilhada mostra
   o impacto e desfaz em 1 passo; salvar → fechar a janela → reabrir preserva `scene.palettes` e o plano.
A jornada não escreve a cena pelo harness: o cenário entra por “Adicionar cenário” (imagem escolhida pela automação
no diálogo, como o som). Falhas são registradas antes de qualquer correção; retentativa não conta como confiabilidade.

## Retomada da rodada 4 (2026-10-19, HEAD `ae0d66cd`, binário 016 `d3777958…b782b8`)

### Adendo I — diagnóstico do `nodegraph-authoring` reprovado (`cert4-nodegraph`, rc=1) e protocolo congelado antes da nova corrida

Resultado preservado como FAIL: `Tecla X (botao B) nao fez pular: groundY 176, xMinY 170`. Comparação dos traços de
salto do mesmo binário (`*-jump-trace.json` em `target-test/validation`, quatro corridas 016):

| Corrida | Início da subida após o ACK de X | Amostras de X na subida (y / vel_y) | Resultado |
|---|---|---|---|
| 17-15-53 | ~1,9 s | 176/−64, 173/−58 | falhou (3 px) |
| 17-16-42 | — | (sem relatório) | falhou |
| 20-27-09 | ~1,9 s | 176/−64, 170/−52, 168/−46 | passou (8 px, no limite) |
| 01-57-10 (`cert4`) | ~1,8 s | 173/−58, 170/−52 | falhou (6 px) |

Em todas a física observada pela RAM é a mesma (vel_y −64, −58, −52, −46…; ACK nativo `b=true` recebido; Z não move).
A janela fixa de 2500 ms de relógio termina durante a subida: o host leva ~1,5–1,9 s entre o ACK e o primeiro quadro
com salto, e o ápice nunca foi observado. Causa atribuída: **o instrumento perdeu a fase relevante** (janela em ms),
não ausência de salto. O "passou" de 20-27 também é fruto da mesma janela e não conta como confiabilidade.

Protocolo novo (congelado antes de executar; limiar ≥ 8 px **inalterado**, nenhum estado/salto injetado):
- Z (controle negativo): igual (2500 ms e ≥ 3 quadros), seguido de verificação adicional de que `vel_y` ficou 0.
- X: amostra pelo menos 2500 ms e continua até observar o ápice pela RAM (`vel_y` negativo seguido de `vel_y ≥ 0`),
  com teto de 20 s; sem ápice observado = FAIL explícito com o traço.
- Produção não muda; o binário 016 continua o artefato testado. Uma corrida nova (`r4i-nodegraph-001`); se falhar,
  fica registrada antes de qualquer ajuste.

Resultado `r4i-nodegraph-001` (binário 016, protocolo do Adendo I): **rc=0, 13 passos**. Z: 9 amostras, y=176 e vel_y=0
em todas. X: subida começa ~1,5 s após o ACK; ápice y=161 (15 px ≥ 8) observado a ~3,1 s, depois do fim da janela
antiga de 2,5 s — confirma a causa atribuída. Corrida única nova; o FAIL de `cert4-nodegraph` permanece registrado.

### Fechamento técnico da rodada 4 (fonte `72962a67`+docs; produção inalterada desde `ae0d66cd`; binário 016)

Executado nesta retomada (corridas novas):
- `host:certify` tentativa 2 (`runs/host-certify-r4-attempt2.{log,json}`): **READY, rc=0**, sete gates exit 0
  (check:tree, lint, tsc, frontend 1145 PASS/3 SKIP em 127+1 arquivos, clippy `--lib -D warnings`, Rust
  1066 PASS/0 FAIL/102 IGNORE com `--test-threads=1`, upstream). `cargo fmt --check` rc=0 (`runs/r4i-fmt.log`).
  Ignores/skips não são PASS.
- `r4i-nodegraph-001` rc=0 (Adendo I). `r4i-paletas-demo-001` (`studio-paletas`, 1280×800, `RDS_E2E_KEEP_PROJECT=1`)
  rc=0, allPass, 15 passos — repetição do contrato do Adendo H no mesmo binário para obter um projeto preservado
  (o projeto `Ken_Paletas_1792459982061` citado pelo relatório `cert4` havia sido removido pela limpeza da jornada).

Preservado/herdado (sem reexecução): `cert4-*` do 016 (paletas, e1e3, e2e5, e4, scene, model, hud-camera, mugen-import,
mugen-real + oráculo) com PASS; `cert4-nodegraph` **FAIL** (instrumento, Adendo I); `r4-paletas-run1..3` FAIL e
`r4-paletas-run4` PASS do 015; `r4-scene`/`r4-model` FAIL do 015 (regressões corrigidas em `ae0d66cd` e aprovadas em
`cert4-scene`/`cert4-model`); `host-certify-r4-attempt1.log` **interrompido** no início do vitest, sem resultado —
não conta como aprovado nem reprovado. Os traços r4-* têm as causas registradas acima; nenhuma causa nova foi atribuída
sem evidência. `r4-rust-real.log` (1066/0/102) foi corrida anterior do agente interrompido; o gate válido agora é a
tentativa 2.

Manifesto: `data/studio_grafico/final-manifest-r4.json` (`studio-grafico-manifest.mjs build --runs-prefix
cert4-,r4-,r4i-`; extensão mínima: vários prefixos e logs r4). `verify` = OK (26 corridas; 5 entradas já ausentes na
geração, registradas). ROMs, capturas e projetos ficam privados, citados por caminho+SHA.

Adendo de paletas — cobertura efetiva (sem estender além do exercitado):
- Jornada UI (Adendo H): compartilhamento entre instâncias, variante local, paleta de troca, troca/restauração por
  evento, edição compartilhada com impacto + desfazer, persistência salvar/fechar/reabrir, inspeção do banco planejado,
  câmera com HUD ancorado, ROM byte-idêntica ao voltar às cores e exportação canônica.
- Só teste Rust/componente: conflito de fixação recusado com usos (`compatible_sharing_is_accepted_and_conflicting_pin…`),
  liberação parcial que mantém o banco enquanto há outro uso (`local_variant_isolates_and_partial_release_keeps_the_bank`),
  troca por instância escrevendo só os índices do alvo, variante recusada por esgotamento sem gravar nada, fonte em banco
  compatível ou regra legada explícita sem recolorir HUD novo.
- **Não exercitado:** “Redefinir reserva” com realocação, mover/renomear paleta preservando identidade, troca com
  remapeamento de índices, períodos de residência com recarga.

Atalho de teste (disponibilização local, não release): `~/Área de trabalho/retrodev-studio-grafico-experimental.desktop`
→ `runs/../bin/retro-dev-studio-016` (SHA `d3777958…b782b8`), Path = `bin/`, ícone copiado para o scratch. Teste: aberto
por `kioclient exec` no display real (KDE/Wayland `:0`), processo filho da sessão Plasma, `/proc/<pid>/exe` com o SHA do
016, sem variáveis `RDS_*`/Xvfb/driver, janela com o assistente de primeiro uso (frontend embutido); encerrado só esse
PID. **Não executado no display real:** abrir o projeto pela UI (exigiria injetar entrada na sessão do operador); a
reabertura do mesmo projeto pelo mesmo binário está coberta em `r4i-paletas-demo-001`.
Projeto de demonstração: cópia editável `~/Documents/RetroDevProjects/Demo_Studio_Grafico_Paletas` (sem `build/` e
`export/`; só o nome exibido mudou); a evidência `Ken_Paletas_1792463120725` permanece intacta.

Limites remanescentes: WINDOW/HUD só no adaptador MD medido; texto legado continua lendo índice 15 do banco 0;
paleta >16 cores gera aviso (não quantização correta); NodeGraph confirma o salto só pela RAM em host lento; sem
validação humana (roteiro preparado, não executado); Experimental, sem push/merge/release/promoção.
