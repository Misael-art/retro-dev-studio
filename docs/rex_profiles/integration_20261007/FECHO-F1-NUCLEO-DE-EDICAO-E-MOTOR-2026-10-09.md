# FECHO — F1 (núcleo de edição, publicação e motor de perfis em dado) — 2026-10-09

Experimental / direção. Sem push, merge, release ou promoção. Expectativas congeladas antes em `EXPECTATIONS-F1-NUCLEO-DE-EDICAO-E-MOTOR-2026-10-09.md` (commit `9543b256`, não alteradas). Nada aqui chama o REX de universal.

## Pins
| Item | Valor |
|---|---|
| Commit de código do binário | `cdfdd52b739aa1fefd471ec559349b6802ad6e58` (árvore limpa na build) |
| Commits da F1 | `862cdc4d` (código + 6 fixtures do pulo + gerador), `cdfdd52b` (segundo perfil, **só dados**) |
| Binário | `a56a60c740c224a315cfb79e7886834887e6b9d3d9752db403445d69473c8ef3` (`build:portable`) |
| Binário de referência (pré-F1) | `ad06bfa8c047af7a801998622efd36e790cc641c0909c7fd41038e6279cca989` (build de `67b720da`) |
| ROMs-base, core, Xvfb, host | inalterados em relação ao `FECHO-PULO-CANVAS-GAMEPLAY-2026-10-09.md` |
Evidência com `SHA256SUMS`: `data/rex_profiles/integration_20261007/evidencia-f1-nucleo-e-motor/`.

## Resultado por critério
| ID | Critério | Resultado | Prova |
|---|---|---|---|
| F1-1 | `locate` de produção (via motor) == código antigo, `JumpInstance` completo | **PASS** — sintética (inclui 2 instâncias, forma super, forma de altura com desvio de palavra, altura não pareada, disputa de altura entre dois pulos, ROMs vazia/truncada) e **ROMs reais: Sonic 1 = 1 instância, Delta = 3, idênticas** | módulo `equivalencia` em `rex_platformer_jump.rs`; teste `#[ignore]` rodado manualmente |
| F1-2 | Testes existentes passam sem mudar asserção; mesmos códigos de erro | **PASS** — módulos de teste existentes de `rex_jump_ipc.rs` (761 linhas) e `rex_platformer_jump.rs` **idênticos ao HEAD anterior** (conferido por diff, só espaço final); `cargo test --lib` 971/0 | — |
| F1-3 | Módulos novos sem termo de jogo na produção | **PASS** — `rex_edit`, `rex_publish`, `rex_profile_engine`: 0 ocorrências (auditoria, classe motor). Dois comentários de origem citavam "jump" e foram reescritos de forma neutra para cumprir o critério | `auditoria.json` |
| F1-4 | Segundo perfil só como dado, em commit sem `.rs` | **PASS** — `cdfdd52b`: 4 fixtures (`sintetico_*`), **0 arquivos `.rs`**; mesmo corpo de teste executa agora 10 fixtures. O corpo do teste não cita nenhum perfil, jogo ou campo | `git show --stat cdfdd52b` |
| F1-5 | Produção do pulo diminui | **PASS** — `rex_platformer_jump.rs` 974 → 830 linhas de produção; `rex_jump_ipc.rs` 497 → 339 (script de auditoria corrigido nesta fase para ignorar itens `#[cfg(test)]`; ver ressalva) | auditoria |
| F1-6 | Jornadas desktop + SHA idêntico das cópias | **PASS** — canvas **87/87**, perfil **24/24**, `nodegraph-authoring` **13/13**, gameplay **allPass G1–G6** (+88 px impulso/segurar, +47 px corte/toque; instâncias `b`/`c` sem efeito). **As 8 cópias e os 8 IPS gerados pelo novo binário têm SHA-256 idênticos** aos da rodada `jump-canvas-2026-10-09T06-14-28-062Z` (código antigo) | relatórios e `manifesto-copias-f1.json` |
| F1-7 | Gates | **PASS** — `cargo test --lib` 971/0 (89 ignorados), `clippy -D warnings`, `fmt --check`, `check:tree`, `lint`, `tsc` rc=0; `npm test` 1018/0 (6 skip); `host:certify` rc=0 (READY) | — |
| F1-8 | Métrica de generalidade | abaixo | — |

## Métrica de generalidade (doc 14 §6) — F1
- **Rust (diff `10271500..cdfdd52b`, `src-tauri/src`):** +1.510 / −594 linhas. Desse total, o que é **movido** sem mudar comportamento: núcleo de edição (`rex_edit.rs`, 177 linhas de produção) e publicação (`rex_publish.rs`, 210); **novo de verdade**: motor `rex_profile_engine.rs` (389 de produção) — a promoção do avaliador que existia só em teste. O restante são testes (inclui os fixtures genéricos e a equivalência) e os adaptadores.
- **Dado:** perfil do pulo (176 linhas de JSON, agora `experimental`), 10 fixtures (≈ 25 KB cada, hex da ROM), gerador de fixtures (Python, fora do runtime). Total de dados+scripts no diff: +1.762 linhas.
- **Termos de jogo nos módulos novos:** 0. **Perfis que o motor executa:** 1 real (pulo) + 1 sintético (só dado).
- **Custo de um perfil novo da mesma classe, medido aqui:** **0 linhas de Rust** (o segundo perfil sintético). Isso vale para a classe `subsumes/pair/follow` apenas.
- **Reuso sem mudança:** `rex_sigscan`, `rex_profile_spec` (validação), `rex_edit`.
- Estado do repositório (auditoria, 73 arquivos): motor 53 (17.897 linhas de produção), perfil 7 (3.058), misto 7 (4.938), caso 6 (2.900). O misto caiu de 5.177 para 4.938 e o motor subiu de 15.688 (F0 inicial) para 17.897; **mas `inspection.rs` (1.971 linhas, 138 "sonic") e `sprite_composition.rs` continuam intocados**, e é lá que está a maior dívida de casos customizados.

## Ressalvas e o que a F1 NÃO prova
- **Cobre uma classe só.** O esquema `rex-profile-spec/v1` executa `subsumes`/`pair`/`follow`. O perfil `m68k.counter_threshold_state_gate.v1` (outra classe: eleva instruções decodificadas a uma regra) **não foi migrado** — F1b. Risco declarado antes e mantido: o esquema provavelmente não o cobre sem uma operação nova no motor.
- O segundo perfil é **sintético e autoral**: prova que o motor não conhece o pulo, não que o esquema serve para rotinas reais de outros jogos (isso é F3/F4).
- `graph_json`, `review_graph`, `plan_edit`/`JumpParams` e a ponte TS continuam adaptadores do pulo; o que o motor generalizou foi localização, planejamento de campos, IPS e publicação.
- **Ruído de medição observado:** no gameplay desta rodada, o toque com `imp` no Sonic 1 deu mediana 38,5 px (2 repetições válidas) contra 34 nas rodadas anteriores; o desvio de 4,5 px está dentro do limite congelado (≤ 12) e não altera G2.
- **Correção de processo:** o script de auditoria cortava a produção no primeiro `#[cfg(test)]` e subestimou o módulo do pulo (23 linhas) quando atributos de teste passaram a existir no meio do arquivo. Reescrevi o leitor para remover itens de teste; os números de F0 (974/497) foram gerados pelo método antigo e os de F1 (830/339) pelo novo, com diferença de ±1 linha em arquivos sem atributos de teste.
- Mudança de comportamento deliberada e mínima: o planejamento de campos agora recusa um offset fora da ROM (`OutOfBounds` → `StaleBytes`) em vez de `panic`; o caminho válido é idêntico.
- Jornadas `sonic-layouts-journey` e `sonic-consumers-inspection` não foram reexecutadas, como declarado: `inspection.rs` e `sonic_*` não foram tocados.
- Experimental; Linux; D2 (local/formato dos perfis) segue como proposta usada por padrão.

## Próximo (não iniciado)
- **F1b:** tentar o perfil `counter_threshold_state_gate.v1` no motor; o resultado esperado é revelar o que falta ao esquema.
- **F2:** sonda de execução (amostragem por quadro generalizada + executor m68k isolado partindo de `crates/rex-gameplay/src/m68k.rs`, com teste diferencial contra o core); depende de D1.
- Dividir `inspection.rs` e `sprite_composition.rs` (motor × caso) quando houver ordem.
