# EXPECTATIONS — Fase F1 (içar a mecânica genérica e ligar o motor ao pulo) — 2026-10-09

Congelado ANTES de qualquer código da F1. Base: HEAD `10271500` (F0 fechada). Origem: `docs/14_REX_ARQUITETURA_UNIVERSAL.md` §5 (F1) e `FECHO-F0-…`. Adendos só datados; falhas reportadas como tais.
Premissa de D2 (decisão do operador ainda pendente, usada por padrão porque a ordem foi "prossiga"): perfis em JSON em `data/rex_profiles/specs/`.

## Escopo (o que a F1 faz)
1. **`rex_edit`** (motor): `Patch`, `apply`, `ips`, `ips_apply_strict`, constantes IPS e o planejamento genérico de edição de campos (domínio, no-op recusado, bytes antigos conferidos), tirados de `rex_platformer_jump.rs`.
2. **`rex_publish`** (motor): `Fs`, `RealFs`, `WriteFail`, `publish_pair` (publicação conjunta cópia+IPS sem sobrescrever), tirados de `rex_jump_ipc.rs`.
3. **`rex_profile_engine`** (motor): `locate(spec, rom)` genérico, promovido do avaliador de teste da F0, com validação estrutural para o motor.
4. **O pulo vira consumidor:** `rex_platformer_jump::locate` passa a chamar o motor com o JSON do perfil embutido (rascunho promovido a `experimental`); `Patch`/`apply`/`ips*` e a publicação viram delegações finas **com a mesma API pública e os mesmos códigos de erro**. O `locate` antigo permanece apenas como **oráculo de teste** (`#[cfg(test)]`).
5. **Teste genérico por fixtures:** um único corpo de teste percorre `data/rex_profiles/specs/fixtures/*.json` (spec + ROM sintética em hex + resultado esperado). Um **segundo perfil sintético da mesma classe** entra só como dado.

## Fora de escopo (declarado antes)
- `graph_json`, `review_graph`, `plan_edit`/`JumpParams` e a ponte TS continuam adaptadores do pulo.
- **Perfil `m68k.counter_threshold_state_gate.v1` (F1b):** é de outra classe (eleva instruções decodificadas a uma regra, com grafo próprio). **Risco declarado:** o esquema `rex-profile-spec/v1` provavelmente NÃO o cobre; confirmar isso é resultado da F1b, não pressuposto desta fase.
- Dividir `inspection.rs` e `sprite_composition.rs`; sonda de execução (F2); Streets of Rage (F3).

## Critérios de saída (todos devem valer)
| ID | Critério |
|---|---|
| F1-1 | **Equivalência de localização:** `locate` de produção (via motor) == `locate_reference` (código antigo) em `JumpInstance` completo (inclui `notes`): ROM sintética, duas instâncias, forma super, altura não pareada, ROM sem instância, **Sonic 1 (1 instância) e Delta (3) reais**. Qualquer diferença = FAIL. |
| F1-2 | **Núcleo de edição:** os 18 testes de `rex_jump_ipc` e os testes de `rex_platformer_jump` passam **sem alterar nenhuma asserção**; só adaptações de compilação (import/caminho), listadas no fecho. Mesmo conjunto de códigos: `JumpError::code()` e códigos `InspectionError` idênticos. |
| F1-3 | **Genérico de verdade:** os módulos novos (`rex_edit`, `rex_publish`, `rex_profile_engine`) têm **0 ocorrências de termos de jogo na produção** pela auditoria (script da F0, classe motor). |
| F1-4 | **Segundo perfil só como dado:** adicionar o fixture do 2º perfil sintético (spec + ROM + esperado) passa pelo mesmo teste genérico **num commit sem nenhum `.rs`** (`git show --stat` provará). Um fixture com spec inválida e outro com ROM sem instância são recusados/vazios como esperado. |
| F1-5 | **Redução do pulo:** linhas de produção de `rex_platformer_jump.rs` e `rex_jump_ipc.rs` diminuem em relação a 974 e 497 (medido pela auditoria F0); registrar o quanto e o que sobrou de específico. |
| F1-6 | **Jornadas desktop no binário reconstruído do HEAD limpo:** `jump-canvas-journey` 87/87; `jump-profile-journey` 24/24; `jump-gameplay-journey` allPass (G1–G6); `nodegraph-authoring` 13/13. **Prova de ponta a ponta:** as 8 cópias e os 8 IPS gerados pelo canvas no novo binário têm **SHA-256 idênticos** aos da rodada de referência `jump-canvas-2026-10-09T06-14-28-062Z` (`manifesto-copias.json`). SHA diferente = FAIL (investigar, não relativizar). |
| F1-7 | Gates: `cargo test --lib`, `clippy -D warnings`, `fmt --check`, `check:tree`, `lint`, `tsc`, `npm test` verdes; `host:certify` rc=0 ao fim. |
| F1-8 | Métrica de generalidade (doc 14 §6): Rust novo × movido × removido, dado novo, termos de jogo nos módulos novos, reuso. |

## Não verificado nesta fase (declarado antes)
Jornadas `sonic-layouts-journey` e `sonic-consumers-inspection` não serão reexecutadas: `inspection.rs` e os módulos `sonic_*` não são tocados. Se qualquer um deles mudar, passam a ser obrigatórias.
Cobertura do esquema para classes além de `subsumes`/`pair`/`follow` não é afirmada.
