# Reprodução — copy-grid Experimental

Partir de `/home/misael/Projects/REX-INTEGRATION-2026-10-05`. Somente diretórios
novos no scratch; não remover/substituir evidência anterior. Contrato congelado
em COPY-GRID-CONTRACT.md, fontes/hash em COPY-GRID-FREEZE.json. Sem nova
biblioteca ou runtime de pesquisa dentro do aplicativo.

## Fixture e backend

```sh
rtk proxy node scripts/rex_profiles/integration_20261016/build-copy-grid.mjs /home/misael/rds-scratch/rex-copy-grid-fixture-REPLAY
rtk proxy env RDS_COPY_GRID_AUTHOR_OUTPUT=/home/misael/rds-scratch/rex-copy-grid-author-products-REPLAY TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 cargo test --manifest-path src-tauri/Cargo.toml --lib copy_grid -- --nocapture --test-threads=1
rtk proxy node scripts/rex_profiles/integration_20261016/verify-copy-grid-runtime.mjs data/rex_profiles/integration_20261016/copy-grid-runtime-author.json /home/misael/rds-scratch/rex-copy-grid-fixture-REPLAY/copy.bin /home/misael/rds-scratch/rex-copy-grid-author-products-REPLAY /home/misael/rds-scratch/rex-copy-grid-author-runtime-REPLAY
rtk proxy python3 scripts/rex_profiles/integration_20261016/verify-comparison-ips.py /home/misael/rds-scratch/rex-copy-grid-fixture-REPLAY/copy.bin /home/misael/rds-scratch/rex-copy-grid-author-products-REPLAY/published-copy.bin /home/misael/rds-scratch/rex-copy-grid-author-products-REPLAY/published.ips data/rex_profiles/integration_20261016/copy-grid-runtime-author.json
```

Fixture 1536 bytes SHA 7930303a67df243f9452eb906b8931aa83d60c02ed090016dd1be1bea37e2f31.
Cópia 3726adec97308332d58cd1adfeef1308fb4a6441189ee099434210221ea3947f.
IPS c0a6342c030118f7cabca863f1dd26c8705841edcb2e3800c26ef671bff994fb.
Reconstruções tipadas exportadas pelo teste são reencodificadas pelo núcleo
Rust de produção, sem bytes de procedência. QA usa Binutils e quatro execuções
no BlastEm pinado, com referência independente de índices. O wrapper embute
somente a região para executá-la; não é o encoder do aplicativo. Ferramenta C
de observação e header vêm da pesquisa existente (somente QA; hashes no relatório).

## BYOR opcional, após a fixture

Definir RDS_COPY_GRID_BYOR no shell para a imagem autorizada local, SHA
c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb.
Ausência desta imagem é ausência de prova BYOR, não PASS.

```sh
rtk proxy env RDS_COPY_GRID_PRIVATE_OUTPUT=/home/misael/rds-scratch/rex-copy-grid-corpus-products-REPLAY TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 cargo test --manifest-path src-tauri/Cargo.toml --lib copy_grid_pinned_byor -- --ignored --nocapture --test-threads=1
rtk proxy node scripts/rex_profiles/integration_20261016/verify-copy-grid-runtime.mjs data/rex_profiles/integration_20261016/copy-grid-runtime-corpus.json "$RDS_COPY_GRID_BYOR" /home/misael/rds-scratch/rex-copy-grid-corpus-products-REPLAY /home/misael/rds-scratch/rex-copy-grid-corpus-runtime-REPLAY
rtk proxy python3 scripts/rex_profiles/integration_20261016/verify-comparison-ips.py "$RDS_COPY_GRID_BYOR" /home/misael/rds-scratch/rex-copy-grid-corpus-products-REPLAY/published-copy.bin /home/misael/rds-scratch/rex-copy-grid-corpus-products-REPLAY/published.ips data/rex_profiles/integration_20261016/copy-grid-runtime-corpus.json
```

Cópia cb471c95cd72fd3f82c725b70d2654fadd2b9672ced80fee772528a0cc1ad97a;
IPS b48421f3247d3669b1f12cf14917f48f17f72455ab43141f1f525aa8035969f9.
Diff exato 0x1B6F8, original preservada. Execução é da região com caller
sintético, não do jogo original. Nenhuma ROM/patch BYOR deve entrar no Git.

## Binário final e interface

```sh
rtk proxy env TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 npm run build:debug
rtk proxy env RDS_SEMANTIC_JOURNEY_SPEC=/home/misael/Projects/REX-INTEGRATION-2026-10-05/data/rex_profiles/integration_20261016/copy-grid-journey.json TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 --rom /home/misael/rds-scratch/rex-copy-grid-fixture-001/copy.bin --app src-tauri/target-test/debug/retro-dev-studio --work /home/misael/rds-scratch/rex-copy-grid-gui-REPLAY/work --log /home/misael/rds-scratch/rex-copy-grid-gui-REPLAY/run.log --scenario semantic-gate-journey
```

Para outra pasta da fixture, copiar a spec para scratch e mudar só `rom`,
conservando hash, limites, expectativas e core. Mesmo roteiro canônico de
região/ponte/persistência da comparação, com observação WRAM explicitamente
selecionada por dado de QA. Runtime do aplicativo continua Rust/TypeScript.
A GUI usa Genesis Plus GX 07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1;
a referência adicional usa BlastEm fdaa3d392ab071c52e8b01c7df4c5642aa00c048a737f4bd3abce66bebd855ba.
Não houve troca silenciosa do core do produto.

Regressões: repetir o comando GUI com a spec `semantic-journey.json` e ROM
autoral de REPRODUCE.md; depois `data/rex_profiles/authoring/counter_gate/journey.json`
e sua ROM. Usar diretórios próprios por corrida. Gates finais e hashes do
binário/relatórios ficam em COPY-GRID-RESULTS.md e evidence/copy-grid/.

## Controle da volta 2→1

Depois da primeira prova, repetir o comando GUI com a spec
`copy-grid-reverse-journey.json`, ROM `published-copy.bin` do diretório autoral
e work/log novos. A spec fixa entrada SHA 3726adec…947f e proposta de largura 1.
Para outra reprodução alterar somente o caminho `rom` da cópia autoral.
Aplicar o mesmo verificador IPS com `copy-grid-reverse-ips.json` como quarto
argumento; deve voltar ao SHA 7930303a…2f31, diff [0x410]. O controle reverso
não acrescenta outro campo editável nem substitui a prova 1→2.
