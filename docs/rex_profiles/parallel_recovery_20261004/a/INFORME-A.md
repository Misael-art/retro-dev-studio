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
  fase 6 (evidencia real + negativos + mostra reservada + este informe).
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
| `cargo clippy --all-targets -- -D warnings` | EXECUTADO: silencioso | fase 6 |
| `cargo fmt --check` | EXECUTADO: limpo | fase 6 |
| `npm run check:tree` | EXECUTADO: OK no worktree | estrutura do territory conforme |
| E2E `executar-evidencia-A.sh` | EXECUTADO: fallos=0, rc-geral=0 | log sha §6 abaixo |
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
| log evidencia `xe-a-evidencia/evidencia-A-20261004.log` | `403892c7f92642c1f48fe3e94f201935ead1294fab26845e2d316b4416ef5d05` |
| `oracle-compare/oracle-streams.tsv` (8 filas) | `850290e024191764e687b4f19a380e2591f231286b9c6e19a5179b436d34580b` |
| `sonic-3082.jsonl` | `2ec2fd903e4bb28e88c6091a7b71e2f8d9dc894e03c83ab2248b07304ec1687a` |
| `sonic-1364.jsonl` | `793c5681226e0d38b7514f744170f05e2a62c27c9173d2a2f774080bd0d2aaae` |
| `sonic-51BC.jsonl` | `81424f499507976728358d72f31a6d04951769625a637f11e316e9adcdf6b6ce` |
| `sor-16D2.jsonl` | `b4b98b95626a972e7922bc5c81fd60b6ff209f6e0428aaae0235b88a19115317` |
| `sor-087FC.jsonl` | `bb6b578173f125805d712e2fda8b63ba82a99193b6ca78348dfaf495a8cd5839` |
| `sor-08842.jsonl` | `c952c42cb918f15c71eef0393c1b63da2da70e43ed1722bf0d18a6d883fc6544` |
| `sor-10636.jsonl` | `ad3718aff65e507e066a3fb61052d1b1f372c13dd7f29c064810f16b61eda8ad` |
| `sor-10852.jsonl` | `ecf98bd5c1292d2ef9df54cba83a8ef497ea3fd40ab5b07199d4bff54c872ef4` |
| `sor-119B4.jsonl` | `7d4ed6e57da5ab4fbc6d380af24539852b4f0e73e2945bf69310d4ca5f0f691c` |
| `phelios-varredura.jsonl` (serie bruta: emitida + 77 rexeitadas) | `07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694` |
| negativos: `neg-sitio/neg-alvo/neg-arg/neg-trun/neg-mapper.jsonl` | `d84460c0…` `668f6ff1…` `9008000d…` `94bf8177…` `b5bfeabd…` |
| `neg-oraculo/oracle-streams.tsv` (modo SKIP) | `3affdbd820626fcc32583f7a3d26c3296eed2c039e8b6e5f5c742c19c8dea337` |
| fixture sintética `synth.bin` (E2E happy+tamper) | `17bd593e…` (ver log E2E) |

As cadeas JSONL NON se commitean: conteñen offsets/saídas derivados das ROMs;
o contrato, o motor, os scripts e este informe son o produto versionado.

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

## 8. Límites e non-alegacións (firmes)

- Sen execución: NINGUNHA alegación de visibilidade, clase gráfica
  (tile/sprite/paleta) ou consumo en xogo. O nivel máximo alcanzado é
  `vinculo-estrutural`; `observado-en-runtime` está estruturalmente recusado
  polo contrato.
- Sen análise de alcançabilidade: varredura aliñada a palabra pode casar en
  datos (limitación declarada en cada rexistro; `emparellamento-ventana-heuristico`).
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
