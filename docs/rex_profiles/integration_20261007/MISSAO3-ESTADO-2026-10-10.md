# Missão 3 — estado operacional (2026-10-10)

Missão em andamento. Este arquivo é o registro durável para retomada. Não depende de scratchpad privado nem de alias.

## Reconciliação

- Checkout: `/home/misael/Projects/REX-INTEGRATION-2026-10-05`
- Branch: `codex/rex-integrator-sonic-103104`
- HEAD na reconciliação: `c2c26b6562b62423ad7e2819cb37352f32111cb2`
- Árvore antes deste arquivo: limpa (`git status --porcelain` vazio)
- `npm run host:diagnose`: `READY`, fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`
- Nenhum processo de `retro-dev-studio`, `run-sonic-desktop-isolated.py` ou `e2e-tauri-build-run.mjs` estava em execução

### Binário (não reconstruído)

- Caminho: `src-tauri/target-test/release/retro-dev-studio`
- SHA-256: `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25`
- mtime: `2026-10-10 00:11:58 -0300`
- Frontend embutido: o binário contém o nome `index-QJIgg2kn` (offset 2461300). `dist/assets/index-QJIgg2kn.js` (mtime `2026-10-10 00:08:08 -0300`) contém o commit de build `8814a910a1ef07f96b7d99d19f71b8f2235b584e`.
- `git diff 8814a910..c2c26b65` altera só `scripts/e2e-tauri-build-run.mjs` (harness externo, executado por Node, não compilado no binário).
- O gate que exige `window.__RDS_BUILD_COMMIT__ == HEAD` está apenas no cenário de inspeção (`scripts/e2e-tauri-build-run.mjs`, leitura de `readGitEvidence`). `jump-gameplay-journey` não o aplica. Recompilar mudaria o SHA e atribuiria o binário a outro commit. Não houve build.

### Runner

- Canônico: `scripts/qa/run-sonic-desktop-isolated.py`
- Devolve `result.returncode` do Node (`SystemExit`).
- Falha controlada (SHA do Xvfb zerado): saída **1**, mensagem `Xvfb executable differs from the supplied immutable identity`. Nenhum Xvfb foi aberto.
- Não usar `run-journey.sh` (pode devolver zero por `echo | tee`).

### Pinos

- Xvfb: `/home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb`
- SHA-256 Xvfb: `5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351`
- Sonic 1: `/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin`
- SHA-256 Sonic 1: `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`
- Delta: `/home/misael/rds-scratch/delta/delta.bin`
- SHA-256 Delta: `8fd8890206cfe856c8079531982ef00fea099f4cd4c3e120efc93d25faf1ffd6`

Preservado e não reclassificado: gameplay `2026-10-10T00-05-41-931Z` 14/19; mutação 22/23.

## Execução 1 — diagnóstico v2.2-ms (não é a regressão)

Protocolo: `RDS_JUMP_PROTOCOL=v2.2-ms`, `RDS_JUMP_DIAGNOSTIC_TAPS=12`.
Teclado nativo, ROMs originais, sem manifesto de cópias, sem veredito.
Saída do harness (timestamp no nome, não sobrescreve corridas anteriores): `src-tauri/target-test/validation/jump-gameplay-<timestamp>-diagnostico.json`.
Work/log exclusivos:

```
src-tauri/target-test/validation/missao3-2026-10-10/01-diagnostico-v22/
```

Comando:

```bash
cd /home/misael/Projects/REX-INTEGRATION-2026-10-05
export RDS_JUMP_DELTA_ROM="/home/misael/rds-scratch/delta/delta.bin"
export RDS_JUMP_PROTOCOL=v2.2-ms
export RDS_JUMP_DIAGNOSTIC_TAPS=12
unset RDS_JUMP_COPIES_MANIFEST
BASE="src-tauri/target-test/validation/missao3-2026-10-10/01-diagnostico-v22"
mkdir -p "$BASE/work"
python3 scripts/qa/run-sonic-desktop-isolated.py \
  --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb \
  --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 \
  --rom "/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin" \
  --app src-tauri/target-test/release/retro-dev-studio \
  --work "$BASE/work" \
  --log "$BASE/run.log" \
  --scenario jump-gameplay-journey
echo "RUNNER_EXIT=$?"
```

Concluída. `exit_code.txt` = **0**. Sidecar `run.json` também `exit_code` 0. Início `2026-10-10T00:25:57-03:00`, fim `2026-10-10T00:45:02-03:00`. Relatório: `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-26-01-479Z-diagnostico.json` (`rex-input-diagnostic/v1`, `allPass: null`). Saída 0 significa que o cenário terminou, não que a regressão passou. Quantitativo em `DIAGNOSTICO-INPUT-v22-2026-10-10.md`.

## Execução 2 — jump-canvas-journey (concluída)

Saída real **0**. Início `2026-10-10T00:47:00-03:00`, fim `2026-10-10T00:47:42-03:00`. Relatório `src-tauri/target-test/validation/jump-canvas-2026-10-10T03-47-04-502Z-report.json`: `allPass=true`, **87/87**, 8 cópias. As 8 cópias e os 8 IPS no disco batem com o relatório e com `data/rex_profiles/integration_20261007/evidencia-pulo-canvas-gameplay/manifesto-copias.json`. ROMs originais inalteradas. Manifesto para o gameplay:

`src-tauri/target-test/validation/jump-canvas-2026-10-10T03-47-04-502Z-copias/manifesto-copias.json`

SHA-256 desse manifesto: `d2312b9916a013ba9745305cb4970ab36f6a48743d00f82d5c622b723d5e3f5e`.

Comando (sem protocolo de gameplay e sem manifesto na entrada; o cenário produz o manifesto):

```bash
cd /home/misael/Projects/REX-INTEGRATION-2026-10-05
export RDS_JUMP_DELTA_ROM="/home/misael/rds-scratch/delta/delta.bin"
unset RDS_JUMP_PROTOCOL RDS_JUMP_DIAGNOSTIC_TAPS RDS_JUMP_COPIES_MANIFEST
BASE="src-tauri/target-test/validation/missao3-2026-10-10/02-jump-canvas"
mkdir -p "$BASE/work"
python3 scripts/qa/run-sonic-desktop-isolated.py \
  --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb \
  --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 \
  --rom "/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin" \
  --app src-tauri/target-test/release/retro-dev-studio \
  --work "$BASE/work" \
  --log "$BASE/run.log" \
  --scenario jump-canvas-journey
echo "RUNNER_EXIT=$?"
```

Work/log: `src-tauri/target-test/validation/missao3-2026-10-10/02-jump-canvas/`. `exit_code.txt` = 0. Referência de SHA: `data/rex_profiles/integration_20261007/evidencia-pulo-canvas-gameplay/manifesto-copias.json`.

## Execução 3 — primeira jump-gameplay-journey v3 (concluída, reprovada)

Mesmo binário. Protocolo `v3-quadros`. Sem alterar código nem critério. Work/log exclusivos: `03-gameplay-v3-a/`. Comando que rodou:

```bash
cd /home/misael/Projects/REX-INTEGRATION-2026-10-05
export RDS_JUMP_DELTA_ROM="/home/misael/rds-scratch/delta/delta.bin"
export RDS_JUMP_PROTOCOL=v3-quadros
export RDS_JUMP_COPIES_MANIFEST="/home/misael/Projects/REX-INTEGRATION-2026-10-05/src-tauri/target-test/validation/jump-canvas-2026-10-10T03-47-04-502Z-copias/manifesto-copias.json"
unset RDS_JUMP_DIAGNOSTIC_TAPS
BASE="src-tauri/target-test/validation/missao3-2026-10-10/03-gameplay-v3-a"
mkdir -p "$BASE/work"
python3 scripts/qa/run-sonic-desktop-isolated.py \
  --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb \
  --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 \
  --rom "/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin" \
  --app src-tauri/target-test/release/retro-dev-studio \
  --work "$BASE/work" \
  --log "$BASE/run.log" \
  --scenario jump-gameplay-journey
echo "RUNNER_EXIT=$?"
```

Concluída. Saída real **1**. Início `2026-10-10T00:48:48-03:00`, fim `2026-10-10T02:06:29-03:00`. Relatório `src-tauri/target-test/validation/jump-gameplay-2026-10-10T03-48-51-643Z-report.json`: `protocolo.estimulo` = `v3-quadros`, `allPass` false, **18/19**. Única falha: `delta.G2_imp` toque +13 (teto 12); a segura desse critério é +88. Processos da corrida encerrados. Quantitativo em `JOGADA-GAMEPLAY-v3-A-2026-10-10.md`.

A segunda corrida **não foi executada**. Repetir o mesmo binário e o mesmo critério para obter aprovação está fora da ordem. Não há correção de produto autorizada: o input foi aceito e lido, e o limiar não se abaixa. O diretório `04-gameplay-v3-b/` não deve ser criado como nova tentativa desta reprovação. O par v3 permanece aberto e não será repetido.

## Adendo v4 — primeira jornada em execução

`ADENDO-PROTOCOLO-GAMEPLAY-v4-QUADROS-EXATOS-2026-10-10.md`. Protocolo `v4-quadros-exatos`: toque exatamente 3 quadros do core, segura exatamente 120. Limiares intactos. A análise das quatro tentativas sem salto está em `ANALISE-TENTATIVAS-SEM-SALTO-v3-2026-10-10.md`.

Há um segundo texto não commitado, `ADENDO-PROTOCOLO-GAMEPLAY-v4-CONTROLE-2026-10-10.md`, e um ramo `v4-controle` no harness. Os dois permanecem na árvore. Uma execução desse protocolo já está preservada em `src-tauri/target-test/validation/missao3-2026-10-10/04-calibracao-v4-a/`: calibração, saída 0, 156/156, durações 3 e 120. Não é jornada e não é veredito G. A medição desta jornada segue o adendo commitado em `fb1b8f4b`.

Calibração dos itens 1 a 9, sem jornada e sem aprovar G2. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/05-calibracao-passo/`. Saída real do runner: **0**. Relatório `jump-gameplay-2026-10-10T08-58-59-365Z-calibracao-passo.json`, `allPass` true, 44/44. Binário `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25`. HEAD da árvore `fb1b8f4b` com o harness sujo.

O contador do core ficou estável em 34 nas cinco leituras de 200 ms depois da pausa. Cada um dos 8 passos, dos 3 do aperto e do passo da soltura avançou exatamente 1, e a segunda leitura 200 ms depois repetiu o mesmo valor. O aperto inicial, solto ainda pausado, ficou `never_polled`. O aperto de 3 foi lido nos quadros 43–45; a soltura foi lida no 46 e o aperto não cresceu. A apresentação ficou em 30 durante passos cujo core já ia de 35 a 39 e só depois saltou para 40: não decide.

Distinção 3 contra 120, mesmo binário, sem jornada e sem aprovar G2. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/06-distincao-3-120/`. Saída real **0**. Relatório `jump-gameplay-2026-10-10T09-02-33-512Z-distincao-3-120.json`, 269/269. Toque lido nos quadros 36–38 e soltura no 39. Segura lida nos quadros 40–159 e soltura no 160. Mesma sessão `joypad-session-1`, época 1. 125 passos, todos com o core em +1 e a leitura 200 ms depois no mesmo valor. A apresentação só andou de 10 em 10.

Uma tentativa de toque no Sonic 1 original, com a pré-condição do adendo, em `07-smoke-um-toque/`. Saída real **0**. Relatório `jump-gameplay-2026-10-10T09-11-18-664Z-smoke.json`. Controle exato: aperto nos quadros 867–869, soltura no 870. Pré-condição na primeira série de 8: gm 0x0C, flag 0, status 0 com bit 1 limpo, Y 944. Efeito: ápice 47 px, vy −1651, flag 1. Isso repete a célula histórica de 3 quadros e não é veredito G.

Primeira jornada completa concluída. Início 2026-10-10T06:18:20-03:00, fim 2026-10-10T10:40:21-03:00. Saída real **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/08-gameplay-v4-a/`. Relatório `jump-gameplay-2026-10-10T09-19-02-947Z-report.json`, SHA256 `6525f9eb3121a1d6efc0d05dd36c437d5e5ae6f39fc7285befd956c6e4a63dd5`, cópia idêntica na raiz de `validation/`. Schema `rex-jump-gameplay-journey/v4`, `allPass` true, **19/19**. Protocolo `v4-quadros-exatos`. Binário `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25`. Harness `ce1b751d0f18b4f09b883bce6e9ee183df96ff2797d7002625e11c8d9f54e7b0`, o mesmo do início. 87 tentativas gravadas; nenhuma com controle reprovado e nenhuma duração diferente de 3 ou 120. Mediana do toque original 47 e da segura 94, nos dois jogos. G2: segura +88 e toque +5, nos dois jogos, teto 12 intacto. G3 toque +46 e segura 0. G4 segura +88 e toque +51. G1 e G5 mediram diferença 0. G6 sem inconclusivas. Esses 19 checks não incluem G7, que continua observação visual das capturas. Uma tentativa do Delta não chegou à fase (`gm=76`) e a repetição saltou 52. Duas tentativas do Sonic 1 tiveram controle exato e nenhum salto; a repetição do impulso saltou, e a repetição 1 do no-op permaneceu sem salto, fora da mediana.

Segunda jornada completa concluída. Início 2026-10-10T10:41:09-03:00, fim 2026-10-10T14:47:18-03:00. Saída real **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/09-gameplay-v4-b/`. Relatório `jump-gameplay-2026-10-10T13-42-03-665Z-report.json`, SHA256 `8db655f3477d1a08918c44044977e7a58ea686179b6cbbb5d4250a8b1fbff3fc`, cópia idêntica na raiz de `validation/`. Schema `rex-jump-gameplay-journey/v4`, `allPass` true, **19/19**. Mesmo binário, mesmo harness `ce1b751d…` e mesmos limiares da primeira. 86 tentativas; nenhuma com controle reprovado e nenhuma duração diferente de 3 ou 120. As medianas repetiram a primeira jornada: toque original 47, segura 94; impulso +5 e +88; corte +46 e 0; ambos +51 e +88; b e c com diferença 0. Duas primeiras tentativas não saltaram com N exato (Sonic 1 no-op segura r3; Delta b-imp segura r1) e a repetição de cada uma entrou na mediana. G7 não está entre os 19 checks.

O par automatizado de I3 está fechado: duas execuções consecutivas aprovadas, sem edição entre elas. Isso é repetibilidade limitada deste protocolo por quadros, não confiabilidade do teclado em tempo real nem decompilação universal. A corrida v3 permanece 18/19 e não foi reclassificada. O motor está congelado em `08100d314b013a1ef7280a5afd7be272cb2480f6`, manifesto `docs/rex_profiles/integration_20261007/CONGELAMENTO-MOTOR-2026-10-10.sha256`, 516 arquivos, SHA256 do manifesto `e541f5e97446e62c6199217489eea91550b7530917283f629e0d59e8ea4ecfb8`. `sha256sum -c` conferiu os 516. Nenhum Rust ou TypeScript de produção mudou depois deste congelamento.

O segundo perfil foi escrito depois do congelamento, no commit `7113e762a657d33104fcc756b7904721f181370a`: `m68k.counter_equality_state_gate.v1`, pasta `data/rex_profiles/authoring/equality_gate/`. Sem guarda, passo 2, contador D1, limiar D2, estado D5, comparação `K − contador`, operador `==`. ROM `9fdf49ad86912ab1c561741c8dac718785db2f9c572845f7b2e6120b882c3807`. A jornada `semantic-gate-journey` no mesmo binário `40c98750…` começou em 2026-10-10T22:07:00-03:00 e a saída real do runner foi **0** (cerca de 27 s). Diretório `src-tauri/target-test/validation/missao3-2026-10-10/10-semantic-equality/`. Relatório `semantic-gate-2026-10-11T01-07-05-187Z-report.json`, SHA256 `2f2814dcd4f6d1ac1c5e580fcf7dc30352d247cfc5817ade69405dfcd36d4117`, schema `rex-semantic-gate-journey/v1`, `allPass` true, **49/49**. A interface leu guarda ausente, passo 2, operador `==`, limiar 7, valores 4 e 0. O core mediu os 18 casos da original e da cópia; os estados observados na original foram só 0 e 4. A cópia com limiar 12 mudou dois estados (entrada 5: estado 4→0; entrada 10: estado 0→4) e nenhum contador. Cópia e IPS coincidiram ao reabrir (`3eeb0ca9…` e `c4f4ad31…`). Isso fecha S2 e S3 nesta amostra autoral. Não é descoberta de rotina nem descompilação universal.

A bateria M1 na árvore `8b4a0681` terminou com saída real **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/11-mutacao/`. Relatório `mutacao.json`, SHA256 `e76c82499c82e30dff915c81d1e82ddfe5e25c388b32e1b0c59c5b455f40b24c`. Baseline antes verde. 23 mutantes aplicados e 23 mortos por teste nomeado; nenhum por falha de compilação; sobreviventes nenhum. `git diff` dos arquivos mutados ficou vazio. Baseline depois, o mesmo `cargo test --lib rex_`: 287 passed, 0 failed, 24 ignored. O relatório antigo de 22/23 não foi reclassificado. O binário de gameplay não mudou.

`jump-profile-journey` no mesmo binário `40c98750…`, HEAD `15958d2d`, saída real **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/12-jump-profile/`. Relatório `jump-profile-2026-10-11T01-25-34-104Z-report.json`, SHA256 `43ae7100b50778ab6efffb89a23cbbc6eca425c49191ead51ffa90784e1a0c1d`, schema `rex-jump-profile-journey/v1`, `allPass` true, **24/24**. Sonic 1 e Delta, 12 checks cada; `ausentes` vazio. Não é a jornada de gameplay.

`profile-authoring-journey` no mesmo binário, saída real **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/13-profile-authoring/`. Relatório `profile-authoring-2026-10-11T01-27-41-888Z-report.json`, SHA256 `b865aed3782e3100bd308d7b47d4788396b358345554fa03be9f9a3ee9d3d9b5`, schema `rex-profile-authoring-journey/v1`, `allPass` true, **66/66**. Perfil `m68k.authored_timer_gate.v1`, ROM do spec `4f750ea6…`. É a regressão da classe de temporizador já existente, não o segundo perfil semântico.

`nodegraph-authoring` no mesmo binário, HEAD `a6689c41`, saída real **1**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/14-nodegraph-authoring/`. O teclado chegou à vitória (goal 1, placar 74, passagens 12 e 60 abertas; Z não pulou e X pulou). O som de vitória em 1320 Hz mediu potência 7,29 depois do evento; o critério exige mais de 20. Não há relatório JSON final porque a falha interrompeu a gravação. A execução anterior que mediu 1875 é de outro binário e não cobre esta. O limiar não foi alterado.

Uma segunda execução, no mesmo binário e no mesmo harness, saiu **0**. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/16-nodegraph-segunda/`. Relatório `nodegraph-authoring-2026-10-11T08-34-57-984Z-report.json`, SHA256 `db9dbd62e1a9199a3750d5306a1a1f07dc7bf87def5167885ea6ec6562f1065f`. Os 13 passos passaram. A potência de 1320 Hz depois da vitória foi **1244**. A primeira corrida, com 7,29, não é reclassificada. No mesmo binário o som medido variou cerca de 170 vezes. O critério não ficou estável.

Os oito gates da árvore `1ce5378e` saíram **0**, das 22:33 às 22:53 de 2026-10-10. Diretório `src-tauri/target-test/validation/missao3-2026-10-10/15-gates/`. `check:tree`, `lint`, `tsc --noEmit`, `cargo clippy -- -D warnings` e `cargo fmt --check` verdes. `npm test`: 1037 aprovados, 6 ignorados. `cargo test --lib`: 1030 aprovados, 0 reprovados, 92 ignorados. `host:certify` READY, fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`. O binário de gameplay não mudou. Isso não fecha a missão: `nodegraph-authoring` neste binário continua reprovado.

G7 foi observado em 2026-10-11 nas capturas já gravadas, sem nova execução. Nas duas jornadas, a segura de `both` (ápice 182) mostra o sprite com a cabeça na linha dos anéis, acima das copas; a segura original (ápice 94) mostra o sprite entre os troncos, abaixo das copas. O mesmo nos dois jogos. Registro: `OBSERVACAO-G7-APICE-v4-2026-10-11.md`. G7 continua fora dos 19 checks.

Proposta registrada para avaliação futura, sem implementação: `PROPOSTA-LIBRETRO-ALTERNATIVA-PC-2026-10-10.md`. Uma segunda libretro pode coexistir para amostrar o contador de programa. O core e o binário atuais permanecem a identidade das provas já feitas.
