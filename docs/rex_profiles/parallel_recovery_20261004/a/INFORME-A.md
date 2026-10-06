# INFORME-A — Cadeas Kosinski reproduzibles (parallel_recovery_20261004, letra A)

Data: 2026-10-04. Fronte: `codex/rex-parallel-a-kosinski-chains` no worktree
`/home/misael/RDS-REX-PARALLEL-A-2026-10-04`. Territory escrito SO en
`scripts|docs|data/rex_profiles/parallel_recovery_20261004/a/`.

## 1. Base fixada (sen deriva)

- Base declarada na misión: `codex/rex-sonic-sequencia @ cb56657`.
- SHA completo confirmado antes de iniciar:
  `cb56657a142df40d2acd09a3e03e54247f066dea` — HEAD exacto da rama; non
  houbo deriva durante a execución (traballo en worktree propio desde ese commit).
- Commits desta fronte (orde): `7e3731c` (expectativas conxeladas),
  `a0fd217` (contrato + motor + CLI), `a2ac233` (comparación co oráculo),
  fase 6 (evidencia real + negativos + mostra reservada + este informe),
  `09e5833` (RECTIFICACION-A + fixtures autorais co instrumento pinado),
  `b837986` (tests discriminantes, 17/18 vermellos en `cbb6895`),
  `1344f4c` (corrección v1.1 do subconxunto 68000; paso 5 reexecitado con
  `fallos=0`, serie nova en §6.1), `c6e9d22` (documentación do paso 5),
  `2dfcc30` (paso 6: conxelado do cruzamento rex-cfg/v1 + verificador;
  execución `fallos=0` en §6.2), `95137ce` (paso 6 medido),
  `89d24d9` (pasos 7–9: expectativas conxeladas CONTROLES-ADULTERACION-A +
  tests K4–K10 e pins CLI; K10 **vermello** medido rc=0 — defecto do
  vínculo declarado antes de corrixir, precedente `b837986`),
  `4aa6ba9` (elo `vinculo-chamada-rutina`; suite 76/76).
- Host: linux/x64 (Manjaro). `host:diagnose --profile full` = READY ao iniciar
  (fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`,
  rexistrado en EXPECTATIONS-A.md §0).

## 2. Resultado frente á META

META: 2 imaxes distintas, ≥1 cadea revalidada en cada unha. **CUMPRIDA con
marxe**: 9 cadeas `vinculo-estrutural` revalidadas byte a byte (3 Sonic 1,
6 SoR) + 1 cadea descuberta por varredura na mostra reservada (Phelios),
todas con rc=0 e elos completos.

Cadeas (sitio-carga → argumento → chamada → alvo → rutina → fluxo → saída):

| Cadea | Imaxe | Carga | Chamada | Alvo | Rutina | Consumo | Saída |
|---|---|---|---|---|---|---|---|
| sonic-3082 | Sonic 1 | `41F90003F09A` → A0 `$03F09A` | `6100E80C` bsr.w | `$0189C` | `e8028514…` | 8453 | 41984 |
| sonic-1364 | Sonic 1 | `41F900072E7C` → A0 `$072E7C` | `6100052A` bsr.w | `$0189C` | `e8028514…` | 5974 | 7110 |
| sonic-51BC | Sonic 1 | `41F90006175E` → A0 `$06175E` | `6100C6D4` bsr.w | `$0189C` | `e8028514…` | 1419 | 4096 |
| sor-16D2 | SoR | `41F900071C6C` → A0 `$071C6C` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 656 | 2248 |
| sor-087FC | SoR | `41F9000389A0` → A0 `$0389A0` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 514 | 1568 |
| sor-08842 | SoR | `41F90001F596` → A0 `$01F596` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 374 | 2248 |
| sor-10636 | SoR | `41F9000795A2` → A0 `$0795A2` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 7581 | 7936 |
| sor-10852 | SoR | `41F90001CAEC` → A0 `$01CAEC` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 611 | 8192 |
| sor-119B4 | SoR | `41F9000389A0` → A0 `$0389A0` | `4EB9000085A2` jsr.l | `$085A2` | `e8028514…` | 514 | 1568 |

Promoción real: as 3 cadeas Sonic 1 soben de `referencia-estatica` (limite
histórico do corpus v2: falta o elo de chamada modelado) a
`vinculo-estrutural` — o modelo BSR/JSR era exactamente o oco que as retén.
As 6 SoR revalidan o nivel v2 coa cadea completa medida. Os consumos/saídas
baten cos valores dos rexistros v2 (fan parte da comparación do §5).

Mostra reservada (Phelios, conxelada en EXPECTATIONS-A.md §1 ANTES de medir):
varredura coa gramática conxelada ⇒ `cargas=320 sen-parella=242 rexeitadas=77
emitidas=1`. A emitida (`0x00035A` → fluxo `$060000`, jsr.l `$06FDF2`,
rutina propia `25429193…` ≠ pin Sonic/SoR — rexistrada como medida da súa, non
axustada) revalidou rc=0 (consumo 65215 → saída 193813). Aceitación 1/320
honesto; as 77 rexeitadas conservan a serie bruta. Ver AUDITORIA-A.md.
*(Anotación 2026-10-04, v1.1: o párrafo describe a execución coa gramática
conxelada v1 e consérvase tal cal. Co recoñecedor corrigido os contadores son
`317/231/85/1` — cambio predicido en RECTIFICACION-A §5.3; a cadea emitida é a
mesma e o seu JSONL é byte-identico. Serie nova en §6.1 e AUDITORIA-A.)*

## 3. Comparación independente (produto × oráculo externo)

`comparar-oraculo-streams.sh`: sobre as 8 streams ligadas a consumidores
(rexistros v2 dos dous JSONL), `dd` corta o fluxo da imaxe pinada, decodifica
con `crates/rex-kosinski --example decode` (produto) e con `koscmp -x`
(oráculo pinado `a74c9295…`, checkout mdcomp `72c6df40…`, sandbox con
`ulimit -v/-t/-f` + timeout + stdin fechado). Resultado: **8/8
PARIDADE-CORREXION-PIN** — igualdade de contido COMPLETO
(produto == oráculo == sha publicada no rexistro v2) con delta 0 bytes.
Desvio do esperado conxelado (`+1` de padding) anotado en EXPECTATIONS-A.md §5
conservando o texto original: o padding de CONTRACT §3 é da STREAM que
`koscmp -c` emite, non da saída de `-x`.

## 4. Negativos discriminantes (§6)

Sobre a cadea real sonic-3082, unha variable mutada por test (rc estable e
exacto en todos; ningún positivo falso):

| Test | Esperado | Medido |
|---|---|---|
| imaxe trocada (perfil Sonic sobre SoR) | ROM-DIVERXENCIA, ningún elo posterior | rc=3 ✓ |
| bytes do sitio alterados | SITIO-DIVERXENCIA | rc=5 ✓ |
| alvo `$0189C`→`$0189E` | ALVO-DIVERXENTE | rc=7 ✓ |
| argumento mutado (carga+fluxo+offset xuntos) | ARGUMENTO-DIVERXENTE | rc=6 ✓ |
| stream truncada (consumo−1) | INCONCLUSIVE-TRUNCADA, nunca OK | rc=10 ✓ |
| rom_size=0x80000 sobre imaxe Sonic | MAPPER-DIVERXENCIA sen clampa | rc=4 ✓ (`imaxe de 531577 B non cabe en rom_size=0x080000: perfil sen clampa`) |
| oráculo ausente (cache baleira) | SKIP/BLOCKED con motivo | rc=3 ✓ |

Ademais: un enderezo fornecido polo usuario nunca se promove a
`descoberto-por-varredura` — os campos `orixe` distinguen
`declarado-probado`/`descoberto-por-varredura` e só a varredura emite o segundo
(AUDITORIA-A.md A9). Fixture negativa de rom_size no tests (imaxe 128 KiB >
`0x10000`).

## 5. Gates — reconciliación (executados ≠ previstos)

| Gate | Estado | Nota |
|---|---|---|
| `cargo test` (paquete rex-chain) | EXECUTADO: 46/46 (chain 9, instr 15, json 8, verify 14) | ao rematar a fase 6 |
| `cargo test` v1.1 (tras `1344f4c`) | EXECUTADO: **65/65** (chain 9, instr 16, json 8, verify 14, rectif 18) | suite + tests discriminantes da rectificación |
| `cargo clippy --all-targets -- -D warnings` | EXECUTADO: silencioso | fase 6 |
| `cargo clippy --all-targets -- -D warnings` v1.1 | EXECUTADO: silencioso | tras a corrección |
| `cargo fmt --check` | EXECUTADO: limpo | fase 6 |
| `cargo fmt --check` v1.1 | EXECUTADO: limpo | tras a corrección |
| `npm run check:tree` | EXECUTADO: OK no worktree | estrutura do territory conforme |
| E2E `executar-evidencia-A.sh` | EXECUTADO: fallos=0, rc-geral=0 | log sha §6 abaixo |
| E2E `executar-evidencia-A.sh` v1.1 | EXECUTADO: fallos=0, rc-geral=0 (paso 5; 9/9 rc=0, 8/9 JSONL idénticos) | serie nova §6.1; vella superseded |
| `cruzar-rexcfg-A.sh` (paso 6, rex-cfg/v1 `275f2af`) | EXECUTADO: fallos=0 — 108/108 asercións + negativo identidade rc=2 | log/exports §6.2; conxelado previo `2dfcc30` |
| `cargo test` pasos 7–9 (`4aa6ba9`) | EXECUTADO: **76/76** (chain 9, instr 16, json 8, verify 14, rectif 18, **adulteracion 8**, **cli 3**) | K10 medido VERMELLO rc=0 en `89d24d9` (defecto do vínculo) e verde tras `4aa6ba9`; CONTROLES-ADULTERACION-A §5; log `~/rds-scratch/chain-test-pos-correccion.log` |
| `cargo clippy --all-targets -- -D warnings` + `fmt --check` (pasos 7–9) | EXECUTADO: limpo en `4aa6ba9` | os dous avisos iniciais eran dos tests novos; corrixidos, non silenciados |
| E2E `executar-evidencia-A.sh` HEAD final (`73fe7b6`) | EXECUTADO: fallos=0, rc-geral=0, 25 OK | §6.3; JSONL byte-identicos a §6.1 (`cmp` 16/16 + resumo + neg-oraculo) |
| `cruzar-rexcfg-A.sh` HEAD final sobre serie §6.3 | EXECUTADO: fallos=0, 119 OK/0 FALLO | §6.3; pins de cadeas e de rex-cfg bin inalterados |
| `comparar-oraculo-streams.sh` (8/8 paridade) | NON REEXECUTADO neste HEAD: o fix só toca o motor `revalidar`; o script de paridade non o invoca e os dous tsv (§6, §6.1 SKIP) seguen pins | rexistrado como non executado, non como aprobado |
| E2E `comparar-oraculo-streams.sh` | EXECUTADO: 8/8 paridade, rc=0 | tsv sha §6 abaixo |
| `npm run lint` / `npx tsc --noEmit` / `npm test` | NON EXECUTADOS: esta fronte non toca `src/`/`src-tauri/`/frontend; os scripts da raíz do canónico aplican ao canónico, non ao territory A | sen cambios que cubrir |
| `npm run host:certify` | NON EXECUTADO: non se modificou host, build, emulacion nin toolchains do produto (fronte = scripts Rust standalone + docs + data no territory A) | rexistrado como pendente para o integrador se o merger cambia o verdict |
| `cargo audit` / `security:audit` | NON EXECUTADOS: cero dependencias novas (Cargo.lock do paquete só deps por path `crates/rex-kosinski`, `crates/rex-addressing` — verificado) | nada que auditar de novo |
| Builds pesadas | serializadas: `pgrep -fa 'cargo|rustc'` limpo antes de cada cargo; `CARGO_TARGET_DIR=~/rds-scratch/chain-target` fóra da árbore versionada | sen watchers nin colas |

## 6. Evidencia por hash (artefactos fóra da árbore versionada, en `~/rds-scratch`)

Pins verificados en cada execución (rompem se diverxen): Sonic 1
`c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`; SoR
`304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d`; koscmp
`a74c92957eccf9c1e5143167af9d6d98b2ce087aed8fe10d50b1f9c016373ea3`; rutina
compartida `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90`;
contedor Phelios `67e09944a0ec6da02d7a32ebfac4f0664dd8ff8086493bbe7e4218decf8b9faf`;
membro Phelios `842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6`.

| Artefacto | SHA-256 |
|---|---|
| log evidencia `xe-a-evidencia/evidencia-A-20261004.log` | `403892c7f92642c1f48fe3e94f201935ead1294fab26845e2d316b4416ef5d05` — **superseded** polo `v11` de §6.1 (conservado, non borrado) |
| `oracle-compare/oracle-streams.tsv` (8 filas) | `850290e024191764e687b4f19a380e2591f231286b9c6e19a5179b436d34580b` |
| `sonic-3082.jsonl` | `2ec2fd903e4bb28e88c6091a7b71e2f8d9dc894e03c83ab2248b07304ec1687a` |
| `sonic-1364.jsonl` | `793c5681226e0d38b7514f744170f05e2a62c27c9173d2a2f774080bd0d2aaae` |
| `sonic-51BC.jsonl` | `81424f499507976728358d72f31a6d04951769625a637f11e316e9adcdf6b6ce` — **superseded** en v1.1 (elo de destino; ver §6.1 e AUDITORIA punto 2) |
| `sor-16D2.jsonl` | `b4b98b95626a972e7922bc5c81fd60b6ff209f6e0428aaae0235b88a19115317` |
| `sor-087FC.jsonl` | `bb6b578173f125805d712e2fda8b63ba82a99193b6ca78348dfaf495a8cd5839` |
| `sor-08842.jsonl` | `c952c42cb918f15c71eef0393c1b63da2da70e43ed1722bf0d18a6d883fc6544` |
| `sor-10636.jsonl` | `ad3718aff65e507e066a3fb61052d1b1f372c13dd7f29c064810f16b61eda8ad` |
| `sor-10852.jsonl` | `ecf98bd5c1292d2ef9df54cba83a8ef497ea3fd40ab5b07199d4bff54c872ef4` |
| `sor-119B4.jsonl` | `7d4ed6e57da5ab4fbc6d380af24539852b4f0e73e2945bf69310d4ca5f0f691c` |
| `phelios-varredura.jsonl` (serie bruta: emitida + 77 rexeitadas) | `07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694` — **idéntico en v1.1**. A etiqueta desta fila era incorrecta (medido en v1.1): o ficheiro só contén a cadea emitida (1 liña); os contadores de rexeitamento viven en `phelios-varredura.resumo.txt` (§6.1) |
| negativos: `neg-sitio/neg-alvo/neg-arg/neg-trun/neg-mapper.jsonl` | `d84460c0…` `668f6ff1…` `9008000d…` `94bf8177…` `b5bfeabd…` |
| `neg-oraculo/oracle-streams.tsv` (modo SKIP) | `3affdbd820626fcc32583f7a3d26c3296eed2c039e8b6e5f5c742c19c8dea337` |
| fixture sintética `synth.bin` (E2E happy+tamper) | `17bd593e…` (ver log E2E) |

As cadeas JSONL NON se commitean: conteñen offsets/saídas derivados das ROMs;
o contrato, o motor, os scripts e este informe son o produto versionado.

### 6.1 Reexecución v1.1 co recoñecedor corrigido (misión, paso 5 — 2026-10-04)

O mesmo pipeline (`executar-evidencia-A.sh`, pins §6 intactos) executouse co
binario da corrección RECTIFICACION-A (HEAD `1344f4c`), saída `fallos=0`.
Comparación elo a elo e atribucións medidas: AUDITORIA-A §«Reexecución v1.1».

| Artefacto | SHA-256 |
|---|---|
| bin `rex-chain` (debug) executado | `db89dd435676967f871ca7aa8757d258bcee0d727d54273ea14afa6fd0d8e7f8` |
| log `xe-a-evidencia-v11/evidencia-A-v11-20261004.log` (**supersede** o `403892c7…` de §6, conservado) | `852544277d6a80e9bcc50bcedf14b82fdd9c07d3b135c555267474a2b88e34ce` |
| `sonic-51BC.jsonl` v1.1 — única cadea que muda: `destino_operando 0x009400→0xFFFF9400`, `destino_rexion rom→ram-68k-mirror`, `limitacions` nova `efectivo≠bus(destino)` | `8ffc94a508261382e622d066646f60fd1fb7512bbe6b26d069bcfe34753ecfb3` |
| `phelios-varredura.resumo.txt` v1.1 (`cargas=317 sen-parella=231 rexeitadas=85 emitidas=1`; antes `320/242/77/1`) | `f5e8d3c2be84330a975a5f53ccdfb8412ddc903c9cf0a84c099e26b4d37cf53f` (antes `d76da2d7…`) |
| as outras 8 cadeas + `phelios-varredura.jsonl` + 5 negativos + `neg-oraculo/oracle-streams.tsv` | **byte-identicas ás de §6** (verificado con `cmp`/`sha256sum` sobre as duas series) |

Conclusións que mudan: só a de sonic-51BC no elo de destino (refutación FA-7
de RECTIFICACION §4 cumprida na práctica; A5 parcialmente superseded). Os
contadores da varredura Phelios mudan como predicía §5.3; a cadea emitida
(`0x00035A`) é idéntica e revalida rc=0. Niveis de evidencia: inalterados.

### 6.2 Cruzamento rex-cfg/v1 (frente C, paso 6 — 2026-10-04)

Verificación **adicional** do sítio coa CLI de C (commit exacto `275f2af…`,
HEAD de PR #108 OPEN; extraído por `git archive` a scratch, sen tocar o WIP
alleo da fronte C; decoder de C **non** copiado consómese só o export).
Expectativas conxeladas en `EXPECTATIONS-CRUZAMENTO-REXCFG-A.md` antes de
medir (commit `2dfcc30`); resultado e lectura honesta en AUDITORIA-A
§«Cruzamento rex-cfg/v1».

| Artefacto | SHA-256 |
|---|---|
| bin `rex-cfg` debug (dende `275f2af`) | `7daeb51d151f54cc29843d352fcb69ccf5d0406dbbed5c90dd2e6da81094a927` |
| log `xe-a-rexcfg-cruzamento/cruzamento-rexcfg-20261004.log` (fallos=0; 119 OK / 0 FALLO) | `42e4d40fe8a03b762a6857f9920c0a3470d901fe3dd3f5656f44124253662769` |
| 10 exports `*.rexcfg.json` (vereditos brutos por cadea) | shas dentro do log (§SHA dos exports) |

### 6.3 Reexecución no HEAD final (misión, paso 10 — 2026-10-04)

O elo `vinculo-chamada-rutina` (`4aa6ba9`) é só medición: **non engade
campo ningún ao JSONL**, así que a serie final reexecitada en
`~/rds-scratch/xe-a-evidencia-final` é **byte-identica á de §6.1** —
16 JSONL + `phelios-varredura.resumo.txt` + `neg-oraculo/oracle-streams.tsv`
verificados con `cmp` un a un (os únicos ficheiros que cambian son os
`*.revalidar.txt`/`*.txt` de resumo, que agora conteñen a liña extra
`vinculo-chamada-rutina=PASS(…)` nas 10 revalidacións vinculadas; os
6 negativos manteñen rc exacto 3/4/5/6/7/10).

| Artefacto | SHA-256 |
|---|---|
| bin `rex-chain` debug executado (HEAD `73fe7b6`) | `2e9d2321537a113787c08eb1247207744c90d0159cdc1b8f270895b82989cb8a` |
| log E2E `xe-a-evidencia-final-run.log` (fallos=0, rc-geral=0, 25 OK; Phelios `317/231/85/1`) | `1f53a1bd026b37262cb293c5d4209ea6fd581bf6323e5ac5f97f2a08e5c26c1e` |
| log `cruzar-rexcfg-A.sh` sobre a serie final (`xe-a-rexcfg-cruzamento-final.log`; fallos=0, 119 OK/0 FALLO; pins §6.1/§6.2 manteñense) | `0f38a530067f15673685b8a4c4e756a1a4fd2a1693521a79c514a39fb056cf58` |

A serie §6.1 (HEAD `1344f4c`, log `85254427…`) **consérvese tal cal**:
§6.3 é evidencia do HEAD final, non unha substitución.

## 7. Desvíos conservados (expectativa conxelada ≠ medido)

Rexistrados no sitio (anotacións "corrección do conxelado" conservando o texto
orixinal, precedente FA-6):

1. FA-6 (§3): byte do fixture `4BF9`→`43F9` — o conxelado contradicía a propia
   fórmula `reg=(byte0>>1)&7`; fórmula e aritmética non cambiaron.
2. §2: a alegación FASE6 §4.2 de que sonic-3082 usa `61 00 05 2A` é FALSA para
   ese sitio; o byte medido é `61 00 E8 0C` (disp negativo); `61 00 05 2A`
   existe en `$01370`. O alvo `$0189C` confirma-se por aritmética (AUDITORIA A2).
3. §5: padding `+1` esperado na saída do oráculo ⇒ medido delta 0; o `+1` de
   CONTRACT §3 aplica á stream de `koscmp -c`. Veredicto novo
   `PARIDADE-CORREXION-PIN` (igualdade total, máis forte que prefixo).
4. §5: `scripts/rex_profiles/codecs/common/sandbox.sh` non existe na base
   `cb56657`; implementaronse límites equivalentes no script da fronte.
5. Extractor de streams: `tail|head` baixo `pipefail` produce SIGPIPE
   intermitente ⇒ substituído por `dd bs=1 skip count`.
6. Motor: `xeometría` exigía `off_cham > fin_carga`; a varredura emparella dende
   `fin_carga` INCLUSIVE (diff 0 = `lea;jsr` lexitimo) ⇒ correlido a `>=` para
   consistencia interna (a varredura da mostra Phelios revelouo).
7. Negativo §6 mapper non discriminaba (cadena baixo 0x80000 pasaba co rom_size
   errado) ⇒ engadido elo "imaxe > rom_size ⇒ MAPPER-DIVERXENCIA sen clampa" +
   test non vago (`imaxe_maior_que_rom_size_rexeitada`).
8. FASE5 pins caducos: JSONL Sonic3 `2e6cf1d4…`→`101ae28a…`, SoR5
   `6feb9454…`→`ee73d972…` — rexeneración v2 documentada en FASE6 §3;
   rexistrada como pin histórico caducado, non como adulteración.
9. rectif.rs r7 (conxelado v1.1, paso 3): o literal esperaba `alvo: 8202`,
   pero o propio comentario do test afirma `0x2006` e o instrumento pinado
   (cstool en 0x2000, `4eba 0004`) dá 0x2000+2+4 = **8198**. Desvio de
   transcrición decimal no conxelado, non da fórmula nin do instrumento:
   corrixirse só o literal, anotado no sitio e en RECTIFICACION-A §5.1.2
   (precedente FA-6). A corrección do decodificador non mudou neste caso.

## 8. Límites e non-alegacións (firmes)

- Sen execución: NINGUNHA alegación de visibilidade, clase gráfica
  (tile/sprite/paleta) ou consumo en xogo. O nivel máximo alcanzado é
  `vinculo-estrutural`; `observado-en-runtime` está estruturalmente recusado
  polo contrato.
- Sen análise de alcançabilidade: varredura aliñada a palabra pode casar en
  datos (limitación declarada en cada rexistro; `emparellamento-ventana-heuristico`).
- O cruzamento rex-cfg/v1 (§6.2) é un segundo modelo de fluxo sobre a ventá
  declarada por A: os seus vereditos non soben nivel de evidencia, non proban
  consumo e `fora-da-regiao` non nega código fóra da ventá (regra citada na
  propia PROPOSTA-FRENTE-A §1).
- A rutina `e8028514…` está hashada, non desasemblada; a identidade
  Sonic↔SoR é unha afirmación de hash medida, non de semántica.
- Non se versiona ROM, plain comercial, sprite, áudio nin imaxe derivada; só
  código, contratos, scripts, hashes e métricas. Corpus `~/emulation` tratouse
  como lectura; extraccións (Phelios) limitadas e fóra da árbore.
- Sen cambios en `src/`, `src-tauri/`, `crates/`, manifests, lockfiles do
  produto, `registry.json`, harness compartido, Current Wave nin Memory Bank.

## 9. Proposta de adaptación ao produto (sen IPC/UI nesta fronte)

Costura mínima, en tres capas, para que o principal consuma o motor:

1. **Biblioteca** (promoción a crate reservada ao integrador; hoxe vive en
   `scripts/.../a/src/` como paquete Rust standalone con deps só por path):
   - `verify::revalidar(imaxe: &[u8], cadea: &Cadea, ventanxa: u32) -> Resultado`
     — pura, sen I/O; xa probada 14/14 no suite.
   - `chain::Cadea::desde_json(&str) / to_json(&self)` — contrato
     `rex-kosinski-chain/v1` con parser estrito (sen nesting/duplicados/`\u`)
     e render determinista.
   - `Resultado { elos: Vec<Elo>, codigo: i32 }` con códigos estables 0..14.
2. **CLI/JSONL** (xa entregada): `rex-chain revalidar|construir-cadea|detectar|
   medir-bytes` devolve elos + código de saída estable; é a interface de facto
   para pipelines do produto sen acoplamento.
3. **Adaptador Tauri proposto** (esbozo, NON implementado aquí): comando
   `rex_chain_revalidar(rom_bytes_via_byor, cadea_json) -> Vec<{nome, estado,
   detalle}>` que simplemente chama `revalidar` e serializa `elos` para chips
   de UI (verde/ámbar/vermello por elo). Requisitos: BYOR con identidade
   SHA-256 inmutável (protocolo do canónico), superficie marcada `Experimental`
   ata que o integrador promova a crate, e cero bytes comerciais en repositorio.

Decisións do principal reservadas: promoción da crate, UI, merge. Esta fronte
non fai merge, release, promoción nin push forzado.
