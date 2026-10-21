# Reprodução — visual copy (QA externa, sem novas dependências)

Produto `/home/misael/Projects/REX-INTEGRATION-2026-10-05`; toolchain do host lock dd99a22f…377. Uma execução pesada por vez. Não versionar ROM BYOR, patch comercial, bytes decodificados ou capturas comerciais. `rtk` é obrigatório neste host.

## Construção e previsão

Escolha OUT novo. O oráculo sempre precede a compilação e o core. As expectativas v1 do Git são imutáveis; o resultado esperado desta reprodução é a reprovação de cor documentada. Não amplie tolerância nem copie pixels capturados para o esperado.

```sh
rtk proxy python3 scripts/rex_profiles/integration_20261016/visual_copy/oracle.py data/rex_profiles/integration_20261016/visual-copy/assets.json /home/misael/rds-scratch/visual-copy-REPLAY/oracle
rtk proxy python3 scripts/rex_profiles/integration_20261016/visual_copy/build.py /home/misael/rds-scratch/visual-copy-REPLAY/build
```

Conferir `oracle.json` com o congelado; são 162 bytes e 3309 pixels diferentes, 9 negativos. O builder recusa destino existente, usa SGDK/m68k oficiais do host e escreve build.json/journey.json. Não publica edição. Símbolos e64 bytes do recurso são conferidos na ROM; kernel exato30 bytes, mapa CPU24. O path do oráculo é irmão do diretório build e sua identidade é pinada pela spec. Para a fixture observada, build2/build.json e specs preservadas em `data/rex_profiles/integration_20261016/evidence/visual-copy/`.

```sh
rtk proxy env TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 npm run build:debug
rtk proxy env RDS_SEMANTIC_JOURNEY_SPEC=/home/misael/rds-scratch/visual-copy-REPLAY/build/journey.json TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 --rom /home/misael/rds-scratch/visual-copy-REPLAY/build/project/out/rom.bin --app src-tauri/target-test/debug/retro-dev-studio --work /home/misael/rds-scratch/visual-copy-REPLAY/gui/work --log /home/misael/rds-scratch/visual-copy-REPLAY/gui/run.log --scenario semantic-gate-journey
```

Xvfb autenticado próprio; não alterar display do usuário. O mesmo runner nativo executa ponte, edição, no-op, persistência, encerramento/reabertura, cópia/IPS, original/repetição/cópia, buffers e captura pausada core/canvas após60 frames novos. Relatórios/capturas saem em `src-tauri/target-test/validation/copy-grid-<timestamp>*`; preserve-os antes de outra corrida. Confira a identidade do app/core/ROM carregada, não apenas nome de arquivo. O publicador é o existente; o comparador reaplica IPS independentemente.

Para a volta, clone a spec gerada em scratch: `rom` recebe o caminho da cópia publicada em `*-copias/reaberto/*.bin`, `rom_sha256` seu hash, `probe.reference.width=2`, `edit.bytes_per_cell=1`; não altere as expectativas. Rode com work/log novos. O produto deve restaurar o SHA original. O no-op retorna largura à base no canvas, exige plano vazio/publicação desabilitada e depois restaura a proposta; original/repetição executam a mesma imagem intacta.

## BYOR (opcional, privada)

Reexecutar script de pesquisa read-only com saída nova no prefixo já exigido pelo próprio script:

```sh
rtk proxy env REA_CORPUS_ROM='/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin' node /home/misael/Projects/REX-REA-LAB-2026-10-15/scripts/rex_profiles/rea_lab_20261015/measure-copy-resource-chain.mjs /home/misael/rds-scratch/rea_lab_20261015/runs/visual-copy-static-REPLAY
```

Na spec privada adicionar `visual.byor` com original/copy, hashes pinados, decoded_resource privado produzido pelo codec acima e output novo. Usar campos da forward-v1-journey preservada, mudando somente paths de reprodução. A cópia deve vir de rexProfileEdit existente; o produto da rodada anterior tem SHA cb471c95…ad97a e diff0x1B6F8. A função attemptByor no mesmo runner carrega cada ROM pausada, aceita inputs por ACK e avança exatamente180/1/180/120/60 frames. Captura15 amostras em três cargas e consulta o trace existente, que neste core é indisponível. O bloqueio do consumidor gráfico comercial é resultado, não PASS nem prova de ausência de execução. Não publicar os produtos privados.

## Regressões e gates

Repetir o runner com as specs `data/rex_profiles/integration_20261016/copy-grid-journey.json`, `semantic-journey.json` e `data/rex_profiles/authoring/counter_gate/journey.json`, paths das ROMs autoriais disponíveis e work/log novos. Esperados 60/60, 63/63 e 55/55. `npm run host:certify` executa tree/lint/tsc/frontend/Clippy lib/Rust/upstream; complementar Clippy padrão e cargo fmt. Copiar imediatamente host-readiness.json e log bruto da certificação: diagnose/E2E posteriores sobrescrevem o arquivo canônico. Fim: diff check, hashes, pesquisa limpa, Memory Bank; nenhuma promoção/publicação remota.
