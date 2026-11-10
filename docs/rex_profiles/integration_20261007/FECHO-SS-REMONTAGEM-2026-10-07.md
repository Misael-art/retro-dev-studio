# FECHO — remontagem somente-leitura das paredes e objetos da fase especial (Sonic 1) — Experimental

Branch `codex/rex-integrator-sonic-103104`. **Sem merge, push, release ou promoção de maturidade.**
Código de produto: `d85485b1` (este fecho só acrescenta docs/evidência). Binário final
`src-tauri/target-test/dev/cargo-target/release/retro-dev-studio` SHA-256
`762e10b56f5bc40c4e2b6485fd2fd2627a9e2206a942e95798b29c6fd9bd3f08`, construído por `npm run build:portable` de `d85485b1` (árvore limpa).
Nota de processo: um 1º conjunto de jornadas de regressão saiu com RC=1 porque o harness recusa binário cujo commit de build ≠ HEAD
(binário de `c149d195`, HEAD `d85485b1`); não era regressão. Reconstruído no HEAD, as três jornadas passaram.

## O que está CONFIRMADO (e por qual evidência)
| Capacidade | Nível | Evidência |
|---|---|---|
| Decoder Nemesis genérico (`rex_nemesis`) | testes unitários (9) + arte real decodificada = decoder Python independente | `cargo test --lib rex_nemesis`; BYOR |
| Primitivas gráficas genéricas (`rex_mdgfx`) | testes unitários (11) | `cargo test --lib rex_mdgfx` |
| Paredes IDs 1–36 × 16 frames | pixels = frame do core `genesis_plus_gx` (16/16, reservados 9 e 15 inclusos); produto = referência Python independente; canvas desktop = oráculo JS (frames 0, 8, 9, 15) | `ss-walls-core-frame.json`, `compare_rust_composition.py`, jornada |
| Objetos IDs 39,41–44,49,65,74 (13 pares ptr/campo/frame) | pixels = frame do core em **2 capturas de entrada independentes** (sementes 11 e 23), amostra reservada; produto = referência Python 13/13; canvas desktop = oráculo JS | `ss-mappings-confirmacao.json`, `compare_rust_other.py`, jornada |
| Vínculo ID→arte por cue do PLC `0x1D992` (IDs 37–78) | estrutural estático + arte decodificada agora; 37 de 42 IDs ligam a um cue, `58,66–69` não (base `0x7B2` fora do PLC) | BYOR Rust, oráculo JS na jornada |
| UI somente leitura | célula do Mapa de IDs → registro → mapping → arte → paleta → imagem; nunca mostra resposta de outro ID/ROM/sessão | 5 testes vitest + jornada 85/85, capturas visíveis |

## Regressão no binário final `762e10b5…`
`sonic-layouts-journey` **85/85**, `sonic-consumers-inspection` **24/24**, `sonic-sequencia-journey` **42/42** (todos `allPass`,
`binary_sha256` = binário final). Gates: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test --lib` 905/0 (86 ignorados),
`npm run lint`, `npx tsc --noEmit`, `npm test` 962/0 (6 skip), `npm run check:tree`, `npm run crates:gates` 5 pacotes OK.
Evidência em `data/rex_profiles/integration_20261007/evidencia-fecho/` com `SHA256SUMS`.

## O que NÃO está confirmado (permanece hipótese ou desconhecido)
1. **23 pares** (ptr/campo/frame) que casaram só na exploração (objetos fora da tela nas capturas novas) — NÃO geram imagem.
2. IDs 37, 45–48, 50, 51, 59–64, 70–73: mapping lido ou recusado (frame vazio, tile fora da arte), sem imagem.
3. IDs 58, 66–69: arte sem origem comprovada (base de tile `0x7B2`).
4. **Paleta**: sempre candidata estática (Pal_SpecialStage, PalLoad #10 → `0x26C8`); o estado do jogo muda por PalCycle/fade e nunca é atribuído a ela.
5. O frame de rotação é escolha do usuário; confirmação por pixel NÃO prova qual objeto do jogo usa qual ID.
6. Flips de objeto e prioridade: só flip 0 observado; não aplicados.
7. A regra de contagem de frames (`frame_offsets`) é heurística; só vale para frames confirmados.
8. O harness do core entra na fase especial por escrita de RAM (`v_gamemode=$10`), não pelo caminho natural do jogo; WRAM do GPGX tem palavras invertidas (byte A em A^1); a conversão CRAM→RGB565 do core foi derivada empiricamente dos mesmos quadros (cores, não posições).
9. Nada observa o jogo em execução fora desses quadros. Edição e reinserção ficam para missão posterior.
10. Risco jurídico residual do s1disasm continua decisão do operador (ver `PROVENIENCIA-2026-10-06.md`). Python só em validação (fora do runtime do app).

## Reprodução
```
cd src-tauri && cargo test --lib rex_nemesis rex_mdgfx sonic_ss_walls            # unidade
REX_SONIC_ROM=<rom> REX_SS_DUMP=<f1> REX_SS_DUMP2=<f2> cargo test --lib byor_composicao_real -- --ignored --test-threads=1
python3 scripts/rex_profiles/integration_20261007/compare_rust_composition.py <rom> <f1>   # paredes
python3 scripts/rex_profiles/integration_20261007/compare_rust_other.py <rom> <f2>         # objetos confirmados
python3 scripts/rex_profiles/integration_20261007/cap2.py <core.so> <semente> <saida.npz>  # captura do core
python3 scripts/rex_profiles/integration_20261007/mapmatch.py <captura.npz> <saida.json>   # casamento de pixels (NSS, MUT por env)
npm run build:portable && python3 scripts/qa/run-sonic-desktop-isolated.py ... --scenario sonic-layouts-journey
```
(`cap2.py`/`mapmatch.py` esperam `nem.py`, `lr.py` e uma cópia local da ROM `sonic_local.bin` no diretório de trabalho.)
Expectativas congeladas: `EXPECTATIONS-SS-REMONTAGEM-2026-10-07.md` (C1–C10) e `EXPECTATIONS-SS-MAPPINGS-2026-10-07.md` (M1–M7).

## Próximo passo recomendado (não iniciado)
Ampliar a variedade de capturas (outras fases especiais, esmeraldas, objetos raros) e reconfirmar os 23 pares com amostra reservada
nova; só então decodificar os demais mappings. Considerar extrair `rex_nemesis`/`rex_mdgfx` para `crates/` quando houver 2º consumidor.
