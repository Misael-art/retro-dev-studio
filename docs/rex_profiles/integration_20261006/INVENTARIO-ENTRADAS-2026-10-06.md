# INVENTÁRIO CONGELADO DAS ENTRADAS — integrador, 2026-10-06

Destino: `/home/misael/Projects/REX-INTEGRATION-2026-10-05`, branch
`codex/rex-integrator-sonic-103104`, HEAD recebido `07db1534` (PR #109). Checkout canônico e
worktrees de outras frentes **não** foram tocados. Verificado com `git` nesta data.

| Entrada | Branch | SHA informado | Tip atual da branch | Território | Dependências | Evidência | Decisão |
|---|---|---|---|---|---|---|---|
| Principal | `codex/rex-sonic-sequencia` | `3a967ce` (PR #104) | — | produto Sonic (sprites/paleta/duração/sequência) | — | ancestral do destino (`merge-base --is-ancestor` = sim) | já integrado |
| A | `codex/rex-parallel-a-kosinski-chains` | `6ae4f02` (PR #107) | `71e70554` (+2: congelamento e medição do consumo `rex-cfg/v2`) | pesquisa: `scripts|docs/rex_profiles/parallel_recovery_20261004/a` | Kosinski (cadeias); consome C `5f973689` | informado é ancestral do tip; **tip avançou** | **não integrada**: ferramenta de validação; Enigma não depende de Kosinski |
| B | `codex/parallel-recovery-20261004-b` | `da5472c` (PR #105) | `da5472c4` (= informado) | pesquisa + crate `enigma-rs` + evidência de cadeia/CRAM | `rex-kosinski` só para SHA no CLI (removida no pacote) | 12 commits sobre `cb56657a`; revisão em `REVISAO-ENIGMA-B.md` | **integrada** por `cherry-pick -x` dos 12 commits; crate re-empacotado em `crates/rex-enigma` |
| C | `codex/rex-parallel-c-cfg` | `e54db1f` (PR #108) | `5f973689` (+1: entrega MOVEA imediato/TRAP #15/endereços v2) | pesquisa: `.../parallel_recovery_20261004/c` | `rex-gameplay` por path (mão única) | informado é ancestral do tip | **não integrada**: validação; inspeção continua sobre o perfil comprovado |
| D | `codex/rex-parallel-d-eval-bench` | `2ec396a` (PR #106) | `f6d03b93` (+2: mede A `6ae4f02` e C `5f97368`) | pesquisa: régua de avaliação | — | informado é ancestral do tip | **não integrada**; resultados antigos de D não vetam SHAs novos — ver `SOLICITACAO-D-2026-10-06.md` |

Observação de procedência: os tips de A, C e D diferem dos SHAs listados na ordem; a
reconciliação acima usa o que existe de fato nas branches locais. Nenhum desses commits
adicionais foi incorporado.

## Commits desta frente (ordem)

1. `167a8de2` fix(deps): audit (commit separado, ver abaixo).
2. 12 commits de B (`b4ea1ebd`…`79ca8082`), cada um com `(cherry picked from commit …)`.
3. `e5d45b38` expectativas congeladas · demais commits na PR.

## Audit da base compartilhada (commit `167a8de2`)

Antes: 5 achados (4 moderate, 1 high): `@vitest/mocker` GHSA-82fw-gwwq-j7x9 (2.1.0–4.1.10, arrasta
`vitest`, `@vitest/ui`, `@vitest/browser`) e `source-map-js` GHSA-68fv-2mgg-jv7q (≤1.2.1).
Correção dirigida: `vitest`/`@vitest/ui`/`@vitest/browser` `^4.1.10→^4.1.11` (mesma major; `4.1.11` é a
linha 4.x corrigida) e `source-map-js 1.2.1→1.2.2` (transitivo, resolvido único: `npm ls` mostra só
`1.2.2`). Sem `npm audit fix --force`, sem exceção, gate e limiar intactos. Validado: `npm ci`
reproduzível (node_modules removido antes), `npm audit` = 0, `tsc` rc=0, `lint` rc=0, vitest 936/0 (6 skip).
