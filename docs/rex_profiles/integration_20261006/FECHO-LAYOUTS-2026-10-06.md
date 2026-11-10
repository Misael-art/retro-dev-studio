# FECHO — leitura nativa dos layouts Sonic (integrador, 2026-10-06) — Experimental

Fecho único da ordem do operador de 2026-10-06 (8 passos). Destino `codex/rex-integrator-sonic-103104` (PR #109,
base recebida `43bb42f6`). **Sem merge, release ou promoção de maturidade** — promoção é decisão do operador.

**Binário final desta revalidação**: `src-tauri/target-test/dev/cargo-target/release/retro-dev-studio`, SHA-256
`c784dc040af7fa8dd68a1cd4fb26fb04fd2d944e09bb038d651baccfc9aba2e9` (31.039.088 B; cópia
`src-tauri/target-test/release/retro-dev-studio` com o mesmo hash), construído por `npm run build:portable` (rc=0)
de `1f1bd819` com árvore limpa de entradas de build. Commits desta rodada sobre `43bb42f6`:
`9a12a741` (rex-enigma 0.2.0 + ADENDO), `7489fdd7` (PROVENIÊNCIA), `1f1bd819` (trava src-tauri → 0.2.0),
e o commit deste fecho (docs + evidência; não altera código de produto).

## Passos da ordem → resultado

| # | Requisito | O que foi feito | Resultado |
|---|---|---|---|
| 1 | Reconciliar HEAD/árvore/PR/evidências | HEAD local==origin==PR `43bb42f6`; provas 73/73, 24/24, 42/42 recontadas por `pass===true` nos 3 relatórios e atribuídas ao binário `02ab2eec…` (build de `ac670155`); `43bb42f6` é docs-only | reconciliado |
| 2 | Gate de segurança pelo caminho canônico | runtime declarado pelo projeto (npm 11.16.0) instalado **isolado** em `~/rds-scratch/npm-11.16.0` com shim no PATH; nenhuma config global tocada; nenhuma política de scripts removida | `npm run security:audit` rc=0, "found 0 vulnerabilities"; host npm 12.0.2 dá rc=1 `EALLOWSCRIPTS` (causa registrada no ADENDO; `npm audit` direto **não** substitui o gate) |
| 3 | Recusar parâmetro não comprovado | rex-enigma 0.2.0: `EnigmaError::UnsupportedParameter` para `value_offset != 0`, verificado **antes** de ler o stream; TDD completo (RED visto falhar pelo motivo certo); adaptador usa 0 e está intacto; igualdade L2 retificada por ADENDO datado (delta funcional versionado: variante + gate + doc de domínio) | verde; solicitação S1–S3 à frente B registrada no ADENDO |
| 4 | Revisão do pacote integrado atual | a ser solicitada ao principal em comentário no PR #109 **após o push** deste fecho; parecer antigo (emitido antes da integração) preservado como histórico, não como aceite | aberto |
| 5 | Proveniência | `PROVENIENCIA-2026-10-06.md`: código incorporado, referências, oráculos (execução ≠ incorporação), fixtures, ferramentas, licenças e alegações permitidas×proibidas; s1disasm **sem licença explícita — nenhuma licença inventada**; exclusão do mdcomp não declara risco eliminado | publicado; decisão de distribuição com 3 opções registradas |
| 6 | Revalidação das partes afetadas | ver §Revalidação abaixo | verde |
| 7 | CI pelo SHA final | consultas pontuais após o push; rollup terminal deste SHA exato registrado em comentário no PR #109; nada anterior (7/7 em `de4d1f5`/`07db153`) é atribuído ao código corrigido | após push |
| 8 | Fecho único | este documento + memória + comentário no PR | — |

## Revalidação (passo 6) — tudo em `1f1bd819`, binário `c784dc04…`

**Gates de barra** (rc=0 cada): `check:tree`, `lint`, `tsc --noEmit`, `npm test` 956 aprovados / 0 falhas (6 skip,
101 arquivos + 1 skip), `crates:gates` 5 pacotes OK (rex-enigma 0.2.0: 8 unidade + 12 contrato),
`cargo clippy -- -D warnings`, `cargo fmt --check`, `cargo test --lib` 881/0 (85 ignorados) — executado duas vezes
(autônomo e dentro do `host:certify`), `cargo audit` rc=0 (8 avisos já permitidos),
`npm audit --audit-level=high` 0, `host:certify` rc=0 READY (fingerprint `60249508…`).

**Aceite BYOR Rust (`#[ignore]`)** — série bruta com três execuções, honestamente separada:
- run-1: falha de harness **minha** (usei só `REX_SONIC_ROM`; os 6 testes de `inspection.rs` exigem
  `RDS_SONIC_MULTIFRAME_ROM` + `RDS_DECOMP_WORK`) ⇒ 6× `NotPresent`. Registro como INCONCLUSIVE, não como regressão.
- run-2 (ambiente correto, threads padrão): SIGABRT `longjmp causes uninitialized stack frame` após 4 testes —
  aborto nativo no fluxo de reinserção aPLib sob paralelismo de testes (biblioteca C de outra frente; nenhum teste
  Enigma envolvido; o teste isolado passa). Registrado como artefato de ambiente, pendência declarada à frente
  responsável.
- run-3 (`--test-threads=1`): **17/17 ok** em 581,73 s, rc=0, incluindo
  `byor_seis_layouts_reais_na_rom_pinada` sobre o decoder 0.2.0. Log: `fecho-byor-ignored-run3.log` (fora do Git).

**Aceite BYOR Enigma (produto × oráculo)**: `byor-enigma-acceptance.py` com ROM pinada `c7da53a1…` e oráculo
`a9ed92f9…` (SHA conferido nesta execução) ⇒ **PASS 6/6**: bytes de saída idênticos ao oráculo (7 hashes de saída
iguais aos do run1 herdado), consumo idêntico aos pins congelados (lidos 634/1042/860/1242/1233/784; padding
0,0,0,0,1,0; armazenado 634/1042/860/1242/1234/784), 4096 B por layout. Relatório só com hashes:
`evidencia-fecho/byor-enigma-run-fecho.json`.

**Jornadas desktop no MESMO binário final** (`run-sonic-desktop-isolated.py`, Xvfb `5bfd315a…`,
`system_display_modified=false`, exit 0): `sonic-layouts-journey` **73/73**, `sonic-consumers-inspection`
**24/24**, `sonic-sequencia-journey` **42/42** — todos `allPass: true` com `binary_sha256 = c784dc04…`.
Relatórios + metadados em `data/rex_profiles/integration_20261006/evidencia-fecho/` com `SHA256SUMS`.

## Evidência nova × herdada

- **Nova** (binário `c784dc04…`): os 7 JSON + `SHA256SUMS` em `evidencia-fecho/` (aceite BYOR python, 3 relatórios
  de jornada, 3 metadados de driver).
- **Herdada** (binário `02ab2eec…`, build de `ac670155`): `evidencia/` da rodada anterior — permanece válida como
  resultado daquele binário; não é reatribuída ao código corrigido.
- ROM/binários/PNGs derivados **não** entram no índice; só SHA-256 e referências.

## Limites e pendências reais

1. Não prova consumo dos layouts em **runtime do jogo** (só decode/identidade/E2E de inspeção).
2. Arte, paleta e CRAM continuam fora do escopo aprovado; composição gráfica é a **missão seguinte**.
3. Risco jurídico residual do s1disasm (desmontagem sem licença explícita): decisão de distribuição é do
   operador — ver `PROVENIENCIA-2026-10-06.md` §7.
4. Paridade `value_offset ≠ 0` não comprovada: recusada até a frente B responder S1–S3 (volta como 0.3.0).
5. Aviso pré-existente `duplicated attribute #[test]` em `src/compiler/ast_generator.rs:3479` (profile de teste,
   território de outra frente) — não corrigido aqui, registrado.
6. Aborto por `longjmp` do encoder C aPLib sob paralelismo de testes de `#[ignore]` (run-2) — artefato declarado.
7. A/C/D: validação não integrada (ver inventário); D não respondeu à solicitação.
8. ETAPAs antigas #55–57 e MUGEN UX v2 (#66) fora deste escopo.

## Reprodução

```
cd crates/rex-enigma && cargo test                      # 8 + 12 (0.2.0)
npm run crates:gates                                    # 5 pacotes
npm run security:audit                                  # com npm 11.16.0 isolado no PATH (caminho canônico)
cd src-tauri && cargo test --lib                        # 881/0 (85 ignored)
RDS_SONIC_MULTIFRAME_ROM=<rom> RDS_DECOMP_WORK=<dir> REX_SONIC_ROM=<rom> \
  cargo test --lib byor_ -- --ignored --test-threads=1  # 17/17
python3 -I scripts/rex_profiles/integration_20261006/byor-enigma-acceptance.py \
  --rom <rom> --oraculo <enigma_research.py> --work <dir> --out <json>
npm run build:portable
python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb <Xvfb> --xvfb-sha256 5bfd315a… \
  --rom <rom> --app src-tauri/target-test/dev/cargo-target/release/retro-dev-studio \
  --work <dir> --log <arq> --scenario sonic-layouts-journey   # idem consumers/sequencia
npm run host:certify
```

Errata mantida da entrega anterior: o VDP usa **dados `$C00000`** e **controle `$C00004`**; textos congelados
antigos de B que dizem "porta de dados `$C00004`" estão errados e não foram reescritos (retificação por adendo).
