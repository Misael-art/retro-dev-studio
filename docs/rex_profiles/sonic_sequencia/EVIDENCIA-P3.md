# EVIDENCIA-P3/P4 — prova da reordenação `id_Wait` (PARTE 2)

Frente de sequência (PR dependente sobre `codex/rex-sonic-consolidacao`).
Expectativas congeladas em `EXPECTATIONS-SEQUENCIA.md` (`d80b30c`); contrato em
`CONTRACT-SEQUENCIA.md`. Este arquivo registra **o que foi realmente executado**
e separa isso do que **não** foi aprovado. Nenhum byte de ROM/binário entra no
repositório; só SHA-256 + JSON versionados.

## Identidade imutável

- ROM base BYOR Sonic 1 USA/EU, 531577 B, SHA-256
  `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` (confere com
  o pino da frente de cadência).
- Base do PR (ancestral comprovado): `5340002` (HEAD de
  `codex/rex-sonic-consolidacao`, PR #103 OPEN, sem merge).
- Janela escrevível deste incremento: `0x13BAF..0x13BC0` (18 entradas).

## Artefatos de prova (SHAs)

Gerados por `RDS_DECOMP_WORK` isolado em `~/rds-scratch/p3-sequencia-20261003T225945Z/`:

| Artefato | SHA-256 | Papel |
|---|---|---|
| `sequence-reordered.bin` (cópia BYOR, NÃO versionada) | `833badf842032fa9e4d912a37e67cf33074ead85b6de7f0b21cbe0defcfa5e57` | saída da pipeline canônica |
| `sequence-reorder.bps` | `5b1b8fe5a66a7ad7dab6efd3c1bfa89f0e4bf5e029bd0f676cb79553b1ae2d52` | patch ida-e-volta |
| `sonic-sequence-proof.json` | `c07ffccdffc7873bf577df3fa5d5774423422ed27fdd466aa3a7106f3a82dc79` | relatório determinístico |
| `sonic-sequence-core-proof.json` | `30c3ef042118bd72c709e31a5fe850682d9111eab94ef43284298f85c844d8c8` | observação no core |
| `sequence-verifier.json` | `59631ef4885a9289775921f8d6173ebaee204ad3870d09c03cca2ab6a8806504` | verificador independente |

## O que a ROM real carregou (byte exato, do despejo)

- `0x13BAE=17` (intervalo · domínio da cadência, **intocado**).
- `0x13BAF..0x13BC0 = 01×12 03 02 02 02 03 04` (18 entradas).
- `0x13BC1=FE 0x13BC2=02` (terminador `afBack k=2`), `0x13BC3=00` (pad),
  `0x13BC4..=1F 3A 3B FF...` (início da anim 6, **intocado**).

## Critério §5.1 — proposta discriminante (pré-congelada)

Mover a primeira `03` (índice 12) para a posição 0:
`proposal = [3,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,3,4]`. Primeiro frame observado:
`01 → 03`. Multiconjunto `{01×12,02×3,03×2,04}` preservado.

## Critério §5.3 — verificador INDEPENDENTE (node puro, sem importar produto)

`scripts/qa/sonic-sequence-contract.mjs --rom <cópia> --base <BYOR>` — 13/13 OK:

```
OK  intervalo-intacto-0x17 :: 0x17
OK  terminador-fe02-intacto :: 0xFE 0x2
OK  padding-00-intacto :: 0x0
OK  vizinho-anim6-head-intacto :: 0x1F 0x3A 0x3B 0xFF
OK  sem-byte-reservado-na-janela :: nenhum
OK  multiconjunto-preservado :: 0x3 0x1 ... 0x1 0x2 0x2 0x2 0x3 0x4
OK  discriminante-primeiro-frame-01-a-03 :: frames[0]=0x3
OK  iguala-permutacao-congelada :: 0x3 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x1 0x2 0x2 0x2 0x3 0x4
OK  base-sha256-pino :: c7da53a10c...1ebb
OK  mesmo-tamanho :: 531577 vs 531577
OK  escrita-confinada-a-janela :: 2 byte(s) alterado(s): 0x13BAF,0x13BBB
OK  nao-e-troca-de-identicas :: 2 diferenca(s)
OK  fora-da-janela-identico-a-base :: 0 divergencia(s) externas
```

`--selfcheck` prova que o verificador **discrimina**: aceita a permutação real e
**recusa uma troca de entradas idênticas como NÃO-prova** (difs=0 → falha).

## Critério §5.3 — byte na ROM pela PIPELINE CANÔNICA (não injeção)

`inspection::sonic_sequence_byor_reorders_through_pipeline_and_bps_roundtrip`
(ROM real → `edit_sonic_sequence` → `persist_sonic_edit`):

- `bytes_changed=2`, `changed_offsets=[80815,80827]` = `0x13BAF,0x13BBB`
  (exatamente as duas posições trocadas).
- `outside_window_identical=true`; intervalo/terminador/pad/anim6 byte a byte
  intactos; `proposto ≠ aplicado` (ordem vigente era a original antes de gravar).
- **BPS ida-e-volta**: `create_bps(base, cópia)` → `apply_bps(base, patch)`
  reproduz a cópia **byte exato**; `back ≠ base`.
- **Restauração seletiva**: `restore_sonic_sequence` devolve a **cópia integral
  à base** (só a sequência voltou); restaurar de novo é no-op.
- **5 negativos** recusam sem escrever e sem registrar edição:
  `seq_length_divergent`, `seq_token_reserved`, `seq_frame_invalid`,
  `edit_resource_unsupported`, `noop`.
- BYOR **intacta** do começo ao fim.

## Critério §5.3c — ordem de frame OBSERVADA NO CORE real

`inspection::sonic_sequence_byor_core_first_wait_frame_becomes_art_03`
(Genesis Plus GX via `EmulatorCore`, rota de teclado, **sem injeção de estado**;
índices do objeto do jogador comprovados pela sonda de cadência: frame `0xD01B`,
anim `0xD01D`, timer `0xD01F`):

| caso | 1º frame em `id_Wait` | frame | timer |
|---|---|---|---|
| base (BYOR) | arte **01** | 1108 | 23 |
| cópia reordenada (pipeline) | arte **03** | 1108 | 23 |

Mesmo frame e mesmo timer entre os dois runs → a **única** diferença é o script
reordenado. Isto prova que reordenar a ROM (não só miniaturas) é observável no
core, com a assinatura do primeiro frame = arte `03`, como congelado.

## Gates do destino (executados vs. afirmados)

Rodei no destino desta frente (worktree, core Libretro headless; nada de
`--all-targets`):

| Gate | Comando | Resultado |
|---|---|---|
| estrutura | `npm run check:tree` | OK (raiz conforme 08_TREE_ARCHITECTURE) |
| lint FE | `eslint src vite.config.ts --max-warnings=0` | exit 0 |
| tipos FE | `tsc --noEmit` | exit 0 |
| testes FE | `npm test -- --run` | 933 passed / 6 skipped (99 arquivos) |
| formatação RS | `cargo fmt --check` | limpo |
| clippy | `cargo clippy -- -D warnings` | exit 0 (profile dev) |
| testes RS | `cargo test --lib` | 858 passed / 0 failed / 82 ignored |
| BYOR sequência | `--ignored sonic_sequence_byor_reorders` | 1 passed |
| BYOR core | `--ignored sonic_sequence_byor_core` | 1 passed |
| verificador indep. | `node scripts/qa/sonic-sequence-contract.mjs` | 13/13 + selfcheck |

**NÃO afirmados / não executados:**
- `cargo clippy --all-targets`: **não** verde — aviso pré-existente
  `duplicate_macro_attributes` em `compiler/ast_generator.rs:3479` (não
  introduzido por esta frente; só aparece no profile de teste).
- **§5.2 jornada desktop WebDriver pela UI renderizada** (abrir→editar→aplicar→
  exportar/reaplicar BPS→salvar→reiniciar→reabrir→executar no app real):
  **NÃO executada nesta sessão.** Motivo: não há binário do app pré-construído
  desta branch; exige um `cargo tauri build` completo (job pesado) e ligar um
  novo cenário `sonic-sequencia-journey` ao harness (`e2e-tauri-build-run.mjs`,
  ~11,5k linhas). A transportadora UI→core desse painel já foi provada na
  jornada de cadência (#100) com o MESMO `InspectionPanel`; os controles de
  sequência têm testes unitários (vitest, P2). O clique-a-clique renderizado
  fica como item aberto, não como aprovado.
- Usabilidade: **nenhuma** declaração (sem participante humano).

## Limites

- Superfície permanece **Experimental** até a jornada desktop §5.2 rodar verde.
- Nada autoriza mudar contagem de frames, outro byte da ROM, outro jogo, ou
  animações dependentes de velocidade. PAL não medido.
- Fork deliberado ordem×duração (ver `CONTRACT-SEQUENCIA.md`): editar duração
  **depois** de reordenar é recusado pela revalidação de cadência; deixado ao
  operador. Esta frente não resolve edição mista.

---

## Adenda 2026-10-04 — estado das três pendências (missão de retomada)

Preserva todo o texto acima (evidência anterior não é reescrita). Atualiza
apenas o estado medido.

### Pendência 2 — integração cadência↔sequência (FECHADA)
O "fork deliberado" descrito acima não é mais o comportamento: a validação foi
centralizada em `sonic_cadence::validate_copy` (uma única definição do script).
- `validate_base` continua **estrita** na ROM-base (ordem exata `WAIT_FRAMES`,
  intervalo `$17`, tabela, prólogo do consumidor, referência absoluta única).
- `validate_copy` aceita **qualquer permutação válida** + intervalo
  `$01..$7F` + terminador `FE 02` na **cópia**. Cadência, sequência e a guarda
  de escopo de `sprite_composition` roteiam todas por ela. Nenhuma guarda
  global foi removida.
- Round-trips provados na BYOR real pelo teste ignorado
  `sonic_integrado_sequencia_cadencia_bidirecional_e_preservacao`: os 4 domínios
  (pixel, paleta, duração 40, sequência proposta B) acumulam nas **duas ordens**
  com diff byte-a-byte exato (7 offsets), ledger por domínio, `CadenceInfo.
  current_frames` = ordem atual da cópia, salvar/reabrir com os dois painéis
  utilizáveis, restaurar-só-sequência (volta a ordem original preservando
  arte/paleta/duração) e restaurar-só-duração na cópia reordenada (direção antes
  recusada) preservando a sequência. SHAs das duas ordens coincidem.

### Pendência 3 — percurso completo + terminador FE 02 (FECHADA, full-route)
Oracle de runtime (frames emulados, **sonda**, não jornada de teclado):
`inspection.rs::sonic_sequence_runtime_oracle_proves_route_and_terminator`.
- Timer do objeto descoberto por voto temporal; **nenhum offset de RAM de
  posição é inventado**. O percurso é reconstruído agrupando frames por **recarga
  do timer** (o consumidor recarrega a contagem a cada entrada do script).
- Base: 18 primeiros segmentos == `WAIT_FRAMES` exatamente
  (`[1×12,3,2,2,2,3,4]`), cauda alterna o laço `{03,04}`.
- Cópia proposta B `swap(0,17)`: 18 primeiros == proposta
  (`[4,1×11,3,2,2,2,3,1]`), cabeça discriminante `01→04`, laço `{03,01}` —
  muda só porque as duas **posições** finais foram reordenadas. O `afBack 2` é
  **keyed por posição**, não por valor. 95 segmentos por lado (amostras farto).
- **Verificador node independente** (não importa módulo de produto, recalcula a
  rota a partir das séries brutas):
  `scripts/qa/sonic-sequence-route-oracle.mjs`. Confere 20 checks `allPass=true`
  sobre as séries reais e, em `--selfcheck`, recusa os 5 negativos exigidos:
  troca de entradas idênticas como positivo, sequência errada, terminador
  alterado, série antiga (SHA/epoch), amostras insuficientes.
- Evidência durável: `docs/rex_profiles/sonic_sequencia/evidence/`
  (`route-manifest.json`, `route-verdict.json` verdict=`full-route`,
  `sonic-sequence-route-verification.json`, `PROVENIANCE-SERIES.txt`).
- **Sem alegação universal:** prova do caminho não-especial NTSC, só `id_Wait`
  na ROM pinada; PAL e animações dependentes de velocidade permanecem fora.

### Pendência 1 — jornada desktop §5.2 (FECHADA em 2026-10-04, executada na UI real)
Corrida de prova no binário canônico final do HEAD commitado
`491c21bf68694ed54b6e40440600948b2383e496` (árvore limpa; build
`npm run build:portable`, binário `e243d1ad9a57dfd1d9b85a7a083975880c4f2e4c3201061f83ec25a42942668b`),
UI renderizada via tauri-driver/WebDriver em Xvfb próprio pinado
(`5bfd315a…`, display :1 com xauth próprio, DISPLAY do sistema intocado),
BYOR pinado `c7da53a1…`. Expectativas de §8.3 congeladas **antes** das
corridas; nenhuma foi reescrita depois — os 16 falhas históricas foram todas
no *plumbing* do harness (profil da sessão, gate de proveniência, hit-test por
coordenadas, popup GTK nativo vs teclas injetadas, superfície imutável do
Tauri 2 para o atraso de voo) e cada uma está registrada com causa no
manifesto.

**Veredito: `allPass=true`, 42/42 checks, passos 1–10**
(relatório `evidence/journey/report.json`, SHA `cb8138a9…`).

Mapa dos critérios §5.2 (todos com payload no relatório):
- **1** abrir BYOR com SHA-256 visível (`passo1.identidade_sha256_visivel`).
- **2** mover entrada distinta e aplicar: swap adjacente real + bolha do `04`
  até a posição 0; proposta B `[4,1×11,3,2,2,2,3,1]` **montada pelo painel**,
  distinta do aplicado antes do clique; cópia `0306a5ab…` com diff exatamente
  `[0x13baf, 0x13bc0]`; intervalo 23 e terminador intactos; 4 negativos
  (contorno pos0/pos17, mover-idêntica, aplicar-sem-diferença **sem escrita**).
- **3** editar duração na mesma cópia reordenada: 40 ticks em `0x13BAE` →
  cópia `dd064e0d…`, sequência preservada.
- **4** conferência da cópia crua: diff exatamente 3 bytes
  `[0x13bae, 0x13baf, 0x13bc0]`; ledger nomeia os dois domínios.
- **5** BPS (38 bytes `4b338921…`) exportado e reaplicado reproduz `dd064e0d…`.
- **6** salvar/destruir/reiniciar/reabrir sem imagem antiga (18 thumbs nos
  dois painéis).
- **7** executar no core (Genesis Plus GX v1.7.4 46a5521) pela cópia
  `dd064e0d…`: reancoragem, ACK de start pelo teclado nativo do produto,
  frames ao vivo, negativo KeyQ, framebuffer não reutilizado e sprite
  conferido contra os pixels do composto (32×40,
  `pixelsSha256 7354bcfb…`) a partir do pixmap X11 real — screenshot
  `visual-e3-stand-visivel-apos-executar-1.png`.
- **8** restaurar seletivamente nos dois sentidos (ordem→preserva duração 40;
  duração→preserva ordem; ledger 2→4; volta à base exata).
- **9** round-trip inverso cadência→sequência com proposta de 1 clique: cópia
  intermediária `28ea1bd5…` (recomposta e conferida offline: intervalo 30 +
  swap pos11↔12 sobre a base pinada) fecha exatamente em `c7da53a1…`.
- **10** negativos e época: sessão divergente e 3 propostas inválidas
  recusadas pelo backend **sem tocar a cópia**; segunda sessão real reaberta;
  voo atrasado 2600ms confirmado (botão `Aplicar ordem` disabled em toda a
  janela 500–1400ms; sonda armada `armed_probe_ms=2677`); **ack de época
  anterior descartado pela UI** — o painel da jornada permaneceu na ordem
  original enquanto a escrita da segunda sessão foi confirmada no arquivo
  dela.

**Atribuição honesta (o que NÃO foi teclado/clique humano):** os negativos do
passo 10 são chamadas IPC diretas rotuladas "sonda técnica"; o atraso de voo
foi injetado no transport real do Linux (`window.fetch` sobre
`ipc://localhost/rex_inspection_edit_sonic_sequence`) porque a superfície
`__TAURI_INTERNALS__` do Tauri 2 é não-gravável — a guarda de época testada é
do produto (`InspectionPanel`/`sequenceEditSeq`); na segunda sessão o perfil
Sonic foi selecionado por evento `change` dispatchado (sonda de superfície,
registrada como `selectionMode="evento change do documento"`), pois o popup
GTK nativo não recebe teclas injetadas do WebDriver. Os passos provenados de
§5.2 (2–9) permaneceram WebDriver nativo com hit-test de coordenadas reais.

**Evidência durável:** `evidence/journey/` versiona apenas JSON/PNG
(`desktop-journey-manifest.json` com SHA por arquivo e histórico de corridas
`-01…-17` com causas, `report.json`, `run.log`, `run.json`, 5 screenshots).
A cópia BYOR aplicada (`dd064e0d…`) e o BPS (`4b338921…`) **não entram no
repositório** (regra da frente: nenhum byte de ROM/binário versionado);
ficam em `src-tauri/target-test/validation/inspection-2026-10-04T07-25-04-064Z-sequencia-journey/`
e são auditáveis pelos SHAs do manifesto e de `evidence/PROVENIANCE-SERIES.txt`
(linhas `jornada-*`).

**Limites mantidos:** um caminho (Sonic USA/EU pinada, NTSC, só `id_Wait`,
proposta B) — sem alegação universal; usabilidade continua **não declarada**
(sem participante); superfície permanece **Experimental**; sem merge/promoção
por esta evidência.

