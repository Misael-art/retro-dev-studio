# FECHO — F0 (auditoria e contrato) do REX universal — 2026-10-09

Experimental / direção. Sem push, merge, release ou promoção. Expectativas congeladas antes em `EXPECTATIONS-F0-AUDITORIA-CONTRATO-2026-10-09.md` (commit `e6a56860`, não alteradas). Base: `e6a56860`. Nada aqui chama o REX de universal.

## Resultado por critério
| ID | Critério | Resultado | Prova |
|---|---|---|---|
| F0-1 | Auditoria reproduzível, 100% dos arquivos | **PASS** — 70 arquivos medidos e classificados; `auditoria.json` e `auditoria.md` byte-idênticos em execuções repetidas (`cmp`) | `data/rex_profiles/integration_20261009/auditoria/`; script `scripts/rex_profiles/integration_20261009/audit-decomp-modules.py` (sai com erro se faltar ou sobrar classe) |
| F0-2 | Classe + justificativa por arquivo; mistos com símbolos; doc 14 §2 corrigido onde divergiu | **PASS** — 7 arquivos mistos com símbolos de cada lado; seis achados em `docs/14` §2.1 (divergências registradas, não escondidas) | `classificacao.json`, `auditoria.md` |
| F0-3 | `EvidenceLevel`/`ProfileSpec` com recusas cobertas | **PASS** — 20 testes novos (6 de evidência, 14 de esquema); recusas testadas: schema, id, arquitetura, limites vazios, padrão inválido/duplicado/sem fonte, campo sem captura ou com captura inexistente, padrão/relação inexistente, offset fora do padrão, domínio invertido ou fora de i16, medido fora do domínio, evidência acima do teto ou sem medição, relações malformadas, campo desconhecido, nível `L9`, tamanho | `rex_evidence.rs`, `rex_profile_spec.rs` |
| F0-4 | Rascunho do pulo valida e coincide com o código | **PASS, acima do mínimo** — domínios coincidem; e o dado, interpretado por um avaliador **só de teste**, reproduz `locate()` (nome, valor, domínio, offsets) na ROM sintética, em duas instâncias, na forma super e com altura não pareada; **em ROMs reais: Sonic 1 = 1 instância, Delta = 3, idênticas** (teste `#[ignore]`, executado manualmente) | `data/rex_profiles/specs/m68k.platformer_jump.v1.draft.json` |
| F0-5 | Zero mudança de comportamento | **PASS** — único arquivo de produto existente alterado: `decomp/mod.rs` (+2 linhas, registro dos módulos); nenhum comando IPC novo; 18 testes de `rex_jump_ipc` intactos; `cargo test --lib` 961/0 (89 ignorados), `clippy -D warnings`, `fmt --check`, `check:tree`, `lint`, `tsc` rc=0 | — |
| F0-6 | Métrica de generalidade da F0 | ver abaixo | — |

Não reexecutei as jornadas desktop do pulo, como a expectativa declarou: o código novo não é referenciado por nenhum caminho de execução (código morto até a F1) e F0-5 valeu.

## Métrica de generalidade (doc 14 §6) para a própria F0
- **Rust novo em produção:** 588 linhas (`rex_evidence.rs` 147 + `rex_profile_spec.rs` 441); **testes:** 692 linhas. **1** ocorrência de termo de jogo na produção (a palavra "pulo" em um comentário de cabeçalho).
- **Dado de perfil:** 176 linhas (rascunho do pulo). Script de auditoria: 95 linhas de Python (ferramenta, fora do runtime do app).
- **Evidência:** o rascunho declara `imp` e `cut` em L5 (com valores medidos) e `imps`, `impw`, `cutw`, `cap` em L2; teto L5. Nada em L3: **nenhum alvo tem chamador/argumentos medidos por PC**.
- **Reuso sem mudança:** `rex_sigscan::Pattern` (padrões e capturas), `rex_platformer_jump::locate` e `fixture_rom` (como oráculo de teste).

## O que a F0 NÃO mostra
- Não há motor em produção que execute um `ProfileSpec`: o avaliador é de teste. Se o dado cobre **outro** perfil (ex.: `counter_threshold_state_gate.v1`) é pergunta da F1.
- A classificação de 7 mistos e 6 casos é por inspeção de símbolos e termos; `sprite_composition::compose_for_session` ficou **indeterminado** (a classificar na F1).
- O rascunho cobre a classe "pulo por assinatura com pareamento e seguimento"; relações além de `subsumes`, `pair` e `follow` não foram necessárias nem testadas.
- Locais e formato dos perfis (D2) seguem como **proposta**; a decisão é do operador.

## Próximo passo (F1) — não iniciado
Içar a mecânica genérica (`Patch`/`apply`/`ips*`, publicação cópia+IPS, identidade, anti-resultado-obsoleto, assinatura canônica do grafo) para um núcleo de edição independente de "pulo", e transformar o avaliador de teste em motor, **para os dois perfis existentes**. Critério de saída (doc 14 §5): jornadas do pulo inalteradas (canvas 87/87, profile 24/24, gameplay allPass) e um segundo perfil sintético da mesma classe passando com 0 linhas de Rust novas. Exige expectativas congeladas antes e reexecução das jornadas desktop (o produto passa a mudar).
