# Reprodutibilidade da evidência de máscaras (§4) — medida 2026-10-05, ~23:00 local

Duas perguntas separadas, ambas medidas (não lembradas): a evidência redigida reproduz a
partir da receita? e o *dump* do instrumento é reproduzível byte a byte?

## 1. A evidência reproduz (`--check` verde)

Comando (frente C, toolchain pinado pelo launcher, `REX_SCRATCH` apontando para
`~/rds-scratch` porque o dump tem ~20 MB):

    bash tools/varredura-mascaras.sh --check

Saída bruta da rodada (preservada em `~/rds-scratch/xe-c3-e4-pass6/`):

    corpus: …/corpus-mascaras.bin (1048576 bytes)
    slots=65536 acordo=36878 acordo-recusa=14292 recusa-declarada=14366
    divergencia-critica=0 alvo-confrontado=4212 short=14292
    OK: evidencia de mascaras reproduzivel (digestos iguais).

Ou seja: `varredura-mascaras-v2.json` e `varredura-mascaras-v2.md` versionados são
byte a byte o que as **máscaras atuais** de `src/decode.rs` produzem contra o
instrumento pinado. Esta é a prova de que as edições de `src/sitio.rs` (portão Q1..Q4),
dos comentários e dos negativos não moveram nenhuma forma: o censo não mudou de lado.

Segunda perna, mais forte: duas corridas completas de `gerar` (diretórios temporários
diferentes) produzem os **mesmos** digestos de evidência, registrados no sidecar —
`f3d788ec46de40941e0d809196d338e1c4e5cc78b7eb5ade78204dfa8f2615ab` (JSON) e
`45091914027dcdc68d7c3810344899576ea309a198aa5f4226f209b3394e4237` (MD).

## 2. O dump **não** tem sha estável — e o corpo tem

Regenerado em diretório persistente, com o mesmo `objdump` pinado:

| artefato | sha-256 |
|---|---|
| `corpus-mascaras.bin` (1 MiB) | `b2f4b455e05fa1b0062a7721193655912005511a4bb4dc2f53bfc8ab7068d675` (idêntico ao da rodada que produziu o censo) |
| `dump-mascaras.txt` desta rodada (502 328 linhas) | `01e30e52b09df2a6657262832ba5c8d9aea6fe3055dcdd618fa2e797805318f6` |
| `dump-mascaras.txt` da rodada preservada (`xe-c3-e4-pass1`, 502 328 linhas) | `7a7014c23c91be732703e3cac5c0d49e0dfaee53717c92b121566ece63196a89` |
| **corpo do dump, da 3ª linha em diante** (as duas rodadas) | `e1cc688a588ce77d2281737f60dbf2566c716835b54a46846deb5b8f4fe422e0` |

Causa, medida com `diff`: a 1ª linha é vazia nas duas rodadas e a 2ª é o cabeçalho do
`objdump`, que embute **o caminho** do corpus passado na linha de comando
(`<caminho>/corpus-mascaras.bin:     file format binary`). `diff` entre os dois dumps a
partir da 3ª linha devolve **0 linhas** — o conteúdo do instrumento é idêntico.

Consequência para a política de evidência: o digesto do dump registrado em
`varredura-mascaras-v2-sha256.txt` **não** é um oráculo de igualdade entre rodadas; o que
é comparável é (a) o sha do corpus, (b) o sha do corpo do dump a partir da 3ª linha, e (c)
os digestos do JSON/MD, que o modo `--check` comprava. `tools/make-fixtures.sh` já trata
isso nos fixtures (`normalizaCabecalho`, 2026-10-04); a varredura não normaliza porque o
dump integral não entra no índice (§2.2/E4-3). Nada aqui altera número de censo nenhum.

## 3. Como reproduzir

    cd scripts/rex_profiles/parallel_recovery_20261004/c
    REX_SCRATCH=~/rds-scratch bash tools/varredura-mascaras.sh --check
    # corpo do dump, se quiser conferir por conta própria:
    TC=/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin
    D=$(mktemp -d ~/rds-scratch/dump-compare.XXXX)
    cargo run --quiet --release --example mascaras -- emit-corpus "$D/corpus-mascaras.bin"
    "$TC/m68k-elf-objdump" -b binary -m m68k -D "$D/corpus-mascaras.bin" > "$D/dump.txt"
    tail -n +3 "$D/dump.txt" | sha256sum   # deve dar e1cc688a…
