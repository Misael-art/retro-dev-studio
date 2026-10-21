# Reprodução da comparação recuperada — Experimental

Checkout: `/home/misael/Projects/REX-INTEGRATION-2026-10-05`. Comandos abaixo partem dele. Cada corrida usa um diretório novo; não sobrescrever evidência anterior. O binário medido foi `src-tauri/target-test/debug/retro-dev-studio`, SHA `f913ed903f64bbd8a86e2f269d9e872f8b596344eb48723fab1b415aa6c8f46b`; fonte de produto em 628a422e. O checkpoint seguinte muda somente teste/harness/documentação.

## 1. Fixture autoral (sem ROM comercial)

```sh
rtk proxy node scripts/rex_profiles/rea_lab_20261015/build-semantic-gate-holdout.mjs --output-dir /home/misael/rds-scratch/rea_lab_20261015/runs/integrator-comparison-fixture-REPLAY
```

Conferir 2593 bytes e SHA `8246bb88cbb3f11a45e976347e63c0a7a22bfd17bfccfc0e9bb1f7deb7f6f218`. A spec `data/rex_profiles/integration_20261016/semantic-journey.json` aponta para a reprodução original `integrator-comparison-fixture-001`; copiar a spec para scratch e mudar somente `rom` se usar REPLAY. Não editar hash/região/expectativas para aceitar divergência.

## 2. Revisão do backend real

```sh
rtk proxy env TMPDIR=/home/misael/rds-scratch/rex-integration-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 cargo test --manifest-path src-tauri/Cargo.toml --lib lab_comparison -- --nocapture --test-threads=1
```

Dois testes reais rederivam região, comparam assinatura/nove mappings e publicam cópia+IPS pelo caminho existente. Negativos exigem base intacta/destino vazio; conflito de saída preserva o par já existente. A fixture hex é autoral e tem o mesmo hash da reprodução do assembler.

## 3. Jornada GUI (binário novo pelo build canônico)

```sh
rtk proxy env TMPDIR=/home/misael/rds-scratch/rex-integration-20261016/tmp CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 npm run build:debug
rtk proxy env RDS_SEMANTIC_JOURNEY_SPEC=/home/misael/Projects/REX-INTEGRATION-2026-10-05/data/rex_profiles/integration_20261016/semantic-journey.json TMPDIR=/home/misael/rds-scratch/rex-integration-20261016/tmp python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 --rom /home/misael/rds-scratch/rea_lab_20261015/runs/integrator-comparison-fixture-001/gate-reversed-cmp-holdout.bin --app src-tauri/target-test/debug/retro-dev-studio --work /home/misael/rds-scratch/rex-integration-20261016/gui-REPLAY/work --log /home/misael/rds-scratch/rex-integration-20261016/gui-REPLAY/run.log --scenario semantic-gate-journey
```

A spec fixa o core Genesis Plus GX do produto e seu hash; não substitui por BlastEm. O roteiro nativo recupera a região, abre nodes, edita 5→6, testa remoção/desfazer, organiza visualmente, salva pelo menu, destrói a janela, reabre do disco e publica novamente. Navegação/persistência são reais; a sonda técnica de RAM é rotulada separadamente. Processo encerra a sessão e os filhos próprios; não toca display/processos alheios.

Relatório original medido: `semantic-gate-2026-10-16T16-45-20-292Z-report.json`, 63/63. A base produz `[0,0,0,0,1,1,1]`; a cópia `[0,0,0,0,0,1,1]`. Somente input 5 distingue. Contador e estado finais medidos: `0x7FFFFFFF` e `1`. Inputs por caso vêm do fonte autoral; esta ROM não grava contador por caso. Ledger de estados é observado no core do aplicativo.

## 4. Verificador IPS independente

```sh
rtk proxy python3 scripts/rex_profiles/integration_20261016/verify-comparison-ips.py /home/misael/rds-scratch/rea_lab_20261015/runs/integrator-comparison-fixture-001/gate-reversed-cmp-holdout.bin src-tauri/target-test/validation/semantic-gate-2026-10-16T16-45-20-292Z-copias/reaberto/gate-reversed-cmp-holdout.gate-240-65e48daa.bin src-tauri/target-test/validation/semantic-gate-2026-10-16T16-45-20-292Z-copias/reaberto/gate-reversed-cmp-holdout.gate-240-65e48daa.ips
```

Cópia SHA `65e48daabcd652814a549eb38602b665bf85617a1982658c92cdb5d0c64c4528`; IPS SHA `bf9faf05dd138b473cb28c1f7694a794aa5b1ff059d4f56b03c936ca7d16cc09`. Verificador independente em Python lê IPS regular/RLE, exige EOF estrito, mantém tamanho e exige diff `[0x247]`. Saídas privadas são cópias da fixture autoral; nenhuma ROM comercial é necessária.

## Limites

Região declarada, semântica derivada dos bytes, somente limiar compilável pelo caminho de edição. Nem chamada no jogo comercial nem equivalência de flags/registradores/stack/vídeo/áudio demonstrada. A organização visual é operação existente, livre, sem efeito na ROM. A captura reaberta mostra aviso de rascunho local diferente do disco; os dados salvos foram conferidos. Não é teste de usabilidade humana. Pendência sonora anterior do nodegraph-authoring continua aberta. Gates gerais/certificação e regressões são registrados no fechamento, sem converter skip em PASS.

A segunda classe copy-grid tem contrato, estados iniciais, ferramentas e
comandos próprios de QA em [COPY-GRID-REPRODUCE.md](COPY-GRID-REPRODUCE.md).
O aplicativo usa a mesma ponte/revisão/publicador; não há pipeline paralelo.
