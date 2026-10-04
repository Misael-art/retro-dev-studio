# EXPECTATIONS-A — Cadeas Kosinski reproduzibles (parallel_recovery_20261004, letra A)

**Estado: CONXELADO antes de implementar/executar.** Este ficheiro fixa entradas,
expectativas, mostra reservada e criterio de veredicto. calquera desvio entre o
aquí escrito e o medido é `FAIL` ou `INCONCLUSIVE` coa serie bruta conservada;
nunca se reescribe esta sección despois de coñecer o resultado.

Base: `codex/rex-sonic-sequencia @ cb56657a142df40d2acd09a3e03e54247f066dea`
(HEAD exacto da rama na data de inicio; sen deriva).
Host: linux/x64/biglinux; `host:diagnose --profile full` = READY,
fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`.

## 0. Entradas pinadas (SHA-256 medidos hoxe sobre os artefactos actuais)

| Artefacto | SHA-256 | Orixe |
|---|---|---|
| Imaxe Sonic 1 staged | `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` | contedor `genesis/Sonic the Hedgehog (USA, Europe).bin` (ficheiro plano 531 577 B) |
| Imaxe reservada SoR staged | `304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d` | contedor zip `fbb1f369…`, membro `Streets of Rage (World).gen`, CRC-32 `88e4ef3c`, Defl:N, 524 288 B |
| Perfís `data/rex_corpus_a/perfis/*.md-linear.json` (5) | `7235780e…`, `282649b7…`, `fcd41d05…`, `496d2fea…`, `ad459d5e…` | **encaixan co pins de FASE5 §5** (auditado hoxe) |
| JSONL Sonic 3 rexistros (v2 actual) | `101ae28a1adb7023540c4f86a138caec3cbe4d1229735a3d422d4653d37f5f59` | FASE5 pinou `2e6cf1d4…` (v1); a diverxencia é a rexeneración v2 documentada en FASE6 §3 — rexístrase como pin histórico caducado, non como adulteración |
| JSONL SoR 5 rexistros (v2 actual) | `ee73d972dc4636e2ddaf595a788a6668b9b5ca245dad144c585c87e04f79097c` | FASE5 pinou `6feb9454…` (v1); mesmo caso |
| Oráculo externo koscmp | `a74c92957eccf9c1e5143167af9d6d98b2ce087aed8fe10d50b1f9c016373ea3`, checkout mdcomp `72c6df405a75d322c5b3722da46c3abb864d3793` (LGPL-3.0, só ferramenta, nada transplantado) | pin de `differential-vs-koscmp.sh`, verificado hoxe en `~/.cache/rex-codecs` |
| Rotina descompresora (160 B, FASE6 §5) | `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90` | alegación de FASE6: idéntica en `$0189C` (Sonic) e `$085A2` (SoR) — **a verificar por min, non asumida** |

## 1. Mostra reservada para A (selección conxelada AGORA, antes de axustar detector ningún)

- Escolma: **`Phelios (USA) (Translated PtBr).zip`**, contedor SHA-256
  `67e09944a0ec6da02d7a32ebfac4f0664dd8ff8086493bbe7e4218decf8b9faf`,
  membro `Phelios (USA).gen`, 524 288 B, Defl:N, CRC-32 `f8e4b5f7`
  (metadatos lidos do índice do zip; **ningún dato extraído aínda**).
- Criterio de escolla declarado antes de mirar contido: xogo Sega Mega Drive
  do corpus, membro único de tamaño 512 KiB (potencia de 2 ⇒ `md-linear`
  aplicable sen trasplante de offsets), **nunca usado en Misión A fases 1–6,
  nin nas fronte B/crates/integrador** (verificado contra `inventario-fontes.tsv`
  e os docs de fase).
- A detección nesta imaxe executará coa gramática **conxelada** no momento do
  commit deste ficheiro. Relaciónanse aceitacións e recusas tal como saian;
  **prohibido** engadir excepcións específicas despois de coñecer o resultado.
- Veredictos esperados posibles, todos lexítimos: `>=1` cadea ata
  `vinculo-estrutural` revalidada; ou `0` cadeas (inventario honesto). Un `0`
  non é fallo do detector; un `candidato` ou `referencia-estatica` non se
  infla a ningún nivel superior.

## 2. Cadeas que se revalidan (meta)

Meta mínima: ≥1 cadea revalidada en cada unha de 2 imaxes distintas
(Sonic 1 e SoR). Pretensión concreta (conxelada):

1. Sonic 1 — cadea `lea@0x03082 → bsr.w $0189C → fluxo $3F09A`:
   bytes esperados na imaxe actual: `41 F9 00 03 F0 9A` en `0x03082`
   (alegación FASE6 §4.2, a verificar byte a byte) e `61 00 05 2A` cuxo alvo
   relativo debe dar `$0189C`.
2. Sonic 1 — cadeas en `lea@0x01364` e `lea@0x051BC` (mesma forma; sitios do
   `bsr` medidos, non adiviñados).
3. SoR — cadea `lea@0x016D2 → chamada → $085A2 → fluxo $71C6C`.
4. SoR — as outras 4 cargas (`0x087FC`, `0x08842`, `0x10636`, `0x10852`,
   `0x119B4` compartindo fluxo con `0x087FC`).

Para cada cadea, elos: identidade/mapper → sitio (bytes medidos) → argumentos
(medidos ou `descoecido`) → alvo da chamada (aritmética comprobada) → rutina
(hash dos 160 B comparado contra `e8028514…` — se difire, rexistrar, non
axustar) → stream (offset vía `md-linear`, decode `crates/rex-kosinski`) →
saída (consumo/tamaño/SHA contra os valores v2 dos rexistros: p.ex.
`0x3F09A`: consumo 8453, saída 41 984, SHA `3bd8570f…`).

- **Se calquera elo falla: FAIL con serie bruta conservada.** Non se reetra o
  rexistro v2 nin se muda o perfil.

## 3. Formas de chamada/carga que o detector A debe modelar (gramática conxelada)

Carga:
- `lea (xxx).L,An`: `41F9`…`4FF9` ( rexistro = `(byte0 >> 1) & 7` — fórmula xa
  usada polo escáner herdado).
- `lea (xxx).W,An`: `4xF8` + palabra-enderezo de 16 bits, **extension curta =
  relleno a cero a 24 bits** (`0x9400 → $00009400`), **non** signo.
- `lea (d16,PC),An`: `4xFA` + disp16 con signo, base = `sitio + 2`.
- `movea.l #imm32,An`: `0A?? FC` coa longa como extensión (a detectar se existe
  nas mostras; sen mostra, queda `non presente`).

Chamada:
- `bsr.w`: `61 dd disp16` — alvo = `sitio + 2 + disp16_signado`
  (**base: palabra de extensión, instrución+2 — corrección FASE6 §5**).
- `bsr.l`: `61 FF disp32` — alvo = `sitio + 4 + disp32_signado`.
- `jsr (xxx).L`: `4E B9`; `jsr (xxx).W`: `4E FA`; `jmp .L`: `4E FD`; `jmp .W`: `4E FC`.

### Fixtures montadas independentemente (valores calculados á man ANTES de escribir código)

| ID | bytes | sitio | alvo esperado (dedución á man) |
|---|---|---|---|
| FA-1 | `61 00 05 2A` | `0x001370` | `0x1370+2+0x052A = 0x189C` |
| FA-2 | `61 00 E8 0C` | `0x00308E` | disp=−`0x17F4`; `0x308E+2−0x17F4 = 0x189C` |
| FA-3 | `61 00 C6 D4` | `0x0051C6` | disp=−`0x392C`; `0x51C6+2−0x392C = 0x189C` |
| FA-4 | `61 FF FF FF FE 00` | `0x010000` | disp32=−`0x200`; `0x10000+4−0x200 = 0xFE04` |
| FA-5 | `4E FA 18 9C` | calquera | `0x0000189C` (abs.W cero-extendido) |
| FA-6 | `43 F9 00 00 85 A2` | calquera | `lea (0x85A2).L,A1`; rexistro=(0x43>>1)&7=1 (corrección do conxelado: `4B` era A5, o byte non encazaba coa propia fórmula; a fórmula e a aritmética non cambian) |
| FA-7 | `43 F8 94 00` | calquera | `lea (0x9400).W,A1` → `$00009400` (extensión curta sen signo) |
| FA-8 | `41 FA 00 22` | `0x002000` | `lea (d16,PC),A0` → `0x2000+2+0x22 = 0x2024` |

Estas fixtures prúbanse contra a *aritmética*, non contra ROM ningunha; montan
se byte a byte desde a táboa (non xeradas polo propio codificador).

## 4. Revisión da clasificación das rexións de destino (conxelada)

O detector clasificará o **operando de destino medido** na cadea, con etiquetas
fixadas aquí:

- `$000000–$7FFFFF` (dentro de rom_size `md-linear`) → `rom`
- `$A00000–$A1FFFF` → `io/vram-window` (a rexión `rex-addressing` xa distingue
  `z80-ram`/`io`; **VRAM/CRAM como tales non están no enum pinado**: a miña
  táboa local nomea xanela, nunca clase gráfica; non se alega "escritura en
  VRAM observada")
- `$C00000–$C0003F` → `cram-window`
- `$E00000–$E0FFFF` → `work-ram`
- `$FF0000–$FFFFFF` → `ram-68k-mirror` (o crate pinado clasifica só `$E00000+`
  como WorkRam: a miña táboa é local e queda marcada como **afirmación
  documental**, non derivada do crate)
- calquera outro → `descoecida` (permanecendo descoñecido é resultado válido)

Casos históricos a reclasificar medindo bytes (non copiando FASE6): destinos
`$A00000` (0x01364), `$FF0000` (0x03082), `$9400…forma curta` (0x051BC),
`$FF7000`/`$FF8000` (SoR). Se os bytes reais diverxen da táboa FASE6, rexistro
a diverxencia e non aplico a táboa.

## 5. Comparación co produto e coa referencia externa (conxelada)

- Decoder do produto = `crates/rex-kosinski::decode(input, max_output, work_limit)`
  (contrato v1 `docs/rex_profiles/kosinski_runtime/CONTRACT.md`).
- Referencia externa = `koscmp` pinado (§0), chamado só vía sandbox con limits
  (reutilizando `scripts/rex_profiles/codecs/common/sandbox.sh` como consumidora).
- Sobre as streams ligadas a consumidores (8 fluxos): para cada stream,
  extraer `bytes_consumidos` bytes desde o offset e decodificalas co produto e
  co oráculo; esperar: produto == saída dos rexistros v2 (SHA e tamaño);
  oráculo == produto no **prefixo `saida_bytes`**; o oráculo engade 1 byte de
  padding tras o terminator (feito medido, CONTRACT §3) ⇒ a diferença total de
  lonxitude oráculo−produto é exactamente `+1` por stream con terminator.
  Calquera outra diferenza = `DIVERXE` (fallo do script, non paridade).
- **Corrección do conxelado (medido 2026-10-04, conservada a afirmación
  original arriba):** as 8/8 streams deron lonxitude oráculo == lonxitude
  produto (delta **0**, non +1) e **igualdade de contido completo** byte a
  byte (SHA do output do oráculo == SHA do produto == `saida_sha256` do
  rexistro v2 en Sonic 1 ×3 e SoR ×5). O "+1 padding" de CONTRACT §3 é da
  **stream** que `koscmp -c` emite tras o terminator (lado de compresión), non
  da saída de `-x` (descompresión); a expectativa §5 aplicoullo ao lado
  equivocado. A paridade medida é máis forte que a esperada (igualdade total
  implica igualdade de prefixo); rexístrese como desvio anotado, non como
  reescrita. TSV bruta: `oracle-streams.tsv` en [dir-saida] con hash por fila.
- Diferenzas contractuais xa fixadas (CONTRACT §4) non se reabren: `m02`-type
  sen terminator → produto `Truncated`, oráculo acepta; iso rexístrase como
  diferenza coñecida, non como novidade.

## 6. Tests negativos obrigatorios (conxelan resultado esperado)

Cada test mutando **unha soa** variable sobre a cadea 1 (§2), coa imaxe real:

| Test | Esperado |
|---|---|
| perfil aplicado a imaxe cuxo SHA non pinnna (Sonic sobre SoR e viceversa) | recusa `ROM-DIVERXENCIA`, código ≠ 0, ningún elos avaliado |
| bytes do sitio alterados (p.ex. `41 F9→42 F9` nunha copia en memoria da cadea) | recusa `SITIO-DIVERXENCIA` |
| alvo declarado `$0189C` mutado a `$0189E` | recusa `ALVO-DIVERXENTE` (aritmética non coincide) |
| argumento `lea` declarado `0x3F09A` mutado a `0x3F09B` | recusa `ARGUMENTO-DIVERXENTE` |
| stream truncada (cortar `bytes_consumidos−1`) | decoder → `Err(Truncated)`; cadea → `INCONCLUSIVE-TRUNCADA`, nunca `OK` |
| falso opcode en datos: inxectar `41 F9 …` nunha rexión de datos sen contexto de código, enderezo fornecido polo usuario como "sitio" | a cadea DECLARADA polo usuario pode revalidarse como forma medida, pero o veredicto do elos "alcanzabilidade" queda `non-analizada`; o detector **non** promove a `descoberto` un enderezo fornecido polo usuario |
| mapper incorrecto: perfil con `estado_mapper` rom_size=0x80000 sobre a imaxe Sonic (rom_size efectivo 0x100000, ficheiro 531 577) | recusa explícita do erro de tradución de `rex-addressing`, sen clampa a offset 0 |
| referencia externa ausente (`koscmp` non dispoñible) | modo comparativo → `SKIP/BLOCKED` con motivo, non paridade |

Ademais: **un enderezo fornecido polo usuario nunca vira descuberta automática**
— os campos `orixe` dos elos distinguen `declarado|medido`; `medido` só se
promove cando o byte a byte o confirma.

## 7. Non-alegacións (límites desta fronte)

- Nada de `observado-en-runtime`: non se executa a ROM; non se alega
  visibilidade, clase gráfica (tile/sprite/paleta), nin consumo en xogo.
- Non se alega alcançabilidade: varredura aliñada a palabra pode casar en datos
  (limitación herdada declarada en cada rexistro).
- Non se versionan ROM, bytes comerciais nin saídas decodificadas; só código,
  fixtures autorais, contratos, hashes e métricas.
- Non se toca `src/`, `src-tauri/`, `crates/`, manifests, lockfiles,
  `registry.json`, harness compartido, Current Wave nin Memory Bank.
- Unha tarefa pesada (cargo/koscmp) á vez no host, comprobando ausencia de
  builds doutras sesións antes de lanzala; sen watchers nin colas permanentes.

## 8. Entregables e veredicto final previsto

1. Contrato `rex-kosinski-chain/v1` (docs territory A) con todos os campos que
   pide a misión: identidade/mapper, CPU addr vs offset, bytes do sitio,
   argumentos coñecidos/descoñecidos, alvo, variante, consumo, límites, hashes.
2. CLI `rex-chain` (scripts territory A, Rust standalone, dependencias só por
   path `crates/rex-kosinski` e `crates/rex-addressing` — cero deps novas).
3. Suporte de formas (§3) con fixtures §3 e reclasificación §4.
4. Comparación produto×oráculo §5 sobre as streams vinculadas.
5. Negativos §6.
6. Mostra reservada §1 con aceitacións/recusas brutas.
7. Adaptador proposto (só contrato + exemplo de chamada, sen IPC/UI) para o
   principal.

Se unha das 2 imaxes resulta ausente no host, declárase pendencia e conclúese
motor + primeira cadea; non se substitúe por promesa.
