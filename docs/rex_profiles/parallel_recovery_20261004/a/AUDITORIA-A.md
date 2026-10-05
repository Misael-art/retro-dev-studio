# AUDITORÍA-A — alegacións previas vs medición propia (parallel_recovery_20261004, letra A)

Data: 2026-10-04. Base: `codex/rex-sonic-sequencia @ cb56657a142df40d2acd09a3e03e54247f066dea` (SHA completo verificado; sen deriva).
Niveis de evidencia: `candidato → referencia-estatica → vinculo-estrutural → observado-en-runtime`. **Un nivel non implica o seguinte.** Nada nesta fronte afirma `observado-en-runtime`: non se executa a ROM.

| # | Alegación auditada | Fonte | Veredicto medido | Nivel alcanzado |
|---|---|---|---|---|
| A1 | Sonic `$03082` lea `.L,A0` coa longa `00 03 F0 9A` | FASE6 §4.2 | **CONFIRMADA** byte a byte: `41F90003F09A`@0x3082 | vinculo-estrutural (bsr medido) |
| A2 | Chamada tras `$03082` é `61 00 05 2A` | EXPECTATIONS §2 (texto conxelado) | **REFUTADA no texto, confirmada na substancia**: a chamada medida é `61 00 E8 0C`@0x308E (FA-2, disp negativo), alvo `$0189C` si correcto; `61 00 05 2A` existe pero en 0x1370 (cadea 0x01364). Desvio rexistrado, non reescrito | — |
| A3 | Rutina descompresora idéntica (160 B) en `$0189C` (Sonic) e `$085A2` (SoR) | FASE6 §5 | **CONFIRMADA independentemente**: sha256 = `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90` nas 9 cadeas (3 Sonic + 6 SoR) | referencia-estatica (hash; **non** desasemblada — pin, non semantics) |
| A4 | Rexistros v2 Sonic (consumo 8453/1419/5974; saída 41984/4096/7110; SHA `3bd8570f…` etc.) | data/rex_corpus_a JSONL | **CONFIRMADOS**: produto==rexistro e oráculo koscmp==produto en contido TOTAL nas 8 streams (TSV `850290e0…`) | vinculo-estrutural por cadea; paridade externa confirmada |
| A5 | Destinos `$FF0000` (0x3082), `$A00000` (0x1364), `$9400` forma curta (0x51BC) | FASE6/§4 | **CONFIRMADOS medindo bytes**: rexións propias ram-68k-mirror, io/vram-window, rom (etiquetas de xanela, **non** clases gráficas) | mesma limitación documental §4 |
| A6 | SoR 6 sitios lea + chamada@+0xC a `$085A2` | JSONL v2 | **CONFIRMADOS**: `41F9…`/`43F9 FF7000|FF8000`/`4EB9000085A2` medidos; 6/6 cadeas revalidadas rc=0 | vinculo-estrutural |
| A7 | Sonic 3 rexistros só `referencia-estatica` | FASE6 (sen formas de chamada modeladas) | **PROMOCIONADOS a vinculo-estrutural** coa aritmética bsr.w comprobada (dobre cálculo desde bytes brutos); a promoción é estrutural, **non** de alcançabilidade nin runtime | — |
| A8 | Pins FASE5 de JSONL (`2e6cf1d4…`, `6feb9454…`) | FASE5 §5 | **CADUCADOS**: valores actuais `101ae28a…`/`ee73d972…`; diverxencia = rexeneración v2 documentada en FASE6 §3, rexistrada como pin histórico, non como adulteración | — |
| A9 | Enderezos fornecidos polo usuario | misión | **NON promovidos a descuberta**: `construir-cadea` marca `carga_sitio=declarado-probado`; só `detectar` emite `descoberto-por-varredura` | — |

## Mostra reservada (detector conxelado) — Phelios (USA)

- Contedor SHA `67e09944…9faf` **== pin §1**; membro `Phelios (USA).gen` 524 288 B, CRC verificado (`unzip -t`), sha256 do membro extraído (temporal, fóra da árbore): `842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6`.
- Varredura con gramática conxelada desde o commit de EXPECTATIONS (nenún axuste post hoc):
  `cargas=320 sen-parella=242 rexeitadas=77 emitidas=1` (resumo bruto con 77 liñas `REXEITADA` conservado en `phelios-varredura.resumo.txt`, sha do JSONL `07e8c121…`).
- A cadea emitida (`0x00035A` lea.l A1→$060000 + `4EB9` jsr.l $06FDF2) **revalidada rc=0** ata `vinculo-estrutural`; a súa rutina (sha `25429193…`) **difire** do pin Kosinski de Sonic/SoR — é a rutina propia de Phelios, rexistrada como medida, non axustada. Consumo 65215 B → saída 193813 B.
- Interpretación honesta: taxa de aceptación 1/320 nunha mostra nunca vista; as 77 recusas son `referencia-invalida` (varredura de datos que non é Kosinski base) e 242 cargas sen chamada na ventána. **Ningunha recusa se reetiquetou como paridade.** Un `0` sería resultado válido (§1); obtívose 1.

## Non-alegacións mantidas

- Visibilidade/clase gráfica (tile/sprite/paleta): **non alegada** — só etiquetas de xanela de mapa.
- Alcançabilidade do fluxo de control: **non analizada** — o emparellamento carga→chamada é heurístico e vai marcado en cada cadea (`emparellamento-ventana-heuristico`).
- Execución en xogo / `observado-en-runtime`: **estructuralmente rexeitado** polo contrato (`validar()` erro; esta fronte non executa).
- ROMs, plains comerciais, saídas decodificadas: **non versionados**; hashes e métricas só.

## Reexecución v1.1 co recoñecedor corrigido (misión paso 5 — 2026-10-04)

Bin `rex-chain` (debug) `db89dd435676967f871ca7aa8757d258bcee0d727d54273ea14afa6fd0d8e7f8`, HEAD da corrección `1344f4c`, gramática RECTIFICACION-A §3. Log integral novo: `~/rds-scratch/xe-a-evidencia-v11/evidencia-A-v11-20261004.log`, sha `852544277d6a80e9bcc50bcedf14b82fdd9c07d3b135c555267474a2b88e34ce`. O log anterior (`403892c7…`) queda **superseded**: conservado en `~/rds-scratch/xe-a-evidencia/`, non se borra nin se reescribe.

Comparación elo a elo (serie bruta das duas execuciones, `diff` sobre liñas `revalidar-*` e JSONL):

1. **9/9 revalidacións rc=0**, como predicía RECTIFICACION §5.1. **8 das 9
   cadeas JSONL byte-identicas** (sonic-3082/1364, sor-16D2/087FC/08842/
   10636/10852/119B4, phelios emitida 0x00035A). Os negativos §6 mantéñense
   cos mesmos códigos exactos (7/7, `fallos=0`).
2. **Unha conclusión mudou — sonic-51BC, elo de destino** (é a refutación
   FA-7 de RECTIFICACION §4 cumprida na práctica, non un axuste post hoc):
   `43F89400` en 0x051C2 é `lea.w` **con extensión de sinal** (medido polo
   instrumento). Antes: `destino_operando=0x009400`, `destino_rexion=rom`.
   Agora: `destino_operando=0xFFFF9400`, `destino_rexion=ram-68k-mirror`,
   con `limitacions` nova `efectivo≠bus(destino): 0xFFFF9400 → bus=0xFF9400`.
   Cadea nova sha `8ffc94a508261382e622d066646f60fd1fb7512bbe6b26d069bcfe34753ecfb3`.
   **A5 queda superseded en parte**: o destino `$9400` forma curta de 0x51BC
   xa NON é `rom`; é ventaná de espeello de RAM 68k, sen desprazamento de
   ficheiro. As outras partes de A5 (`$FF0000`, `$A00000`) seguen conformes.
3. **Varredura Phelios** (§5.3 predixo cambio de contadores):
   antes `cargas=320 sen-parella=242 rexeitadas=77 emitidas=1`; agora
   `cargas=317 sen-parella=231 rexeitadas=85 emitidas=1`. A cadea emitida é
   a mesma (`0x00035A`, JSONL idéntico) e revalida rc=0. Atribución medida
   do `cargas` 320→317 (canle directo sobre a imaxe, 2026-10-04): exactamente
   3 `lea.w` co bit15 ligado — `0xCCBB`@0x29F32, `0xA554`@0x2A0F6,
   `0xA978`@0x65B64 — cuxo cero-extension v1 era ROM-backing e a extensión
   de sinal v1.1 (bus `0xFFCCBB`/`0xFFA554`/`0xFFA978`) non: deixan de
   contarse como cargas. O reordenamento `sen-parella` 242→231 e
   `rexeitadas` 77→85 é mixto (bsr.s de 2 bytes reabre xanelas; `4E FA`
   pasa de jsr.w imaxinario a `jmp.pcd16`; recusas novas `referencia-invalida`):
   contados en bruto, **non atribuído elo a elo** — así se declara, non se
   estima. Ningunha recusa reetiquetada como paridade; `emitidas ≥ 1`
   cumprido.
4. **Niveis de evidencia intactos** (§5.5): as 9 cadeas seguen en
   `vinculo-estrutural`; ningunha migrou á lista de recusa (§5.2: ningunha
   usa `61 FF`/`4E FC/FD`/`4E FA`); sen execución; root declarado segue
   sendo root local.

## Cruzamento rex-cfg/v1 do sítio (misión paso 6 — 2026-10-04)

Consumo **sen copiar o decoder**: A executa a CLI `rex-cfg analyze` da fronte
C como ferramenta externa e consome só o export (`sitios[].veredito`,
`fronteiras[]`, `cobertura.vaos[]`, `raizes[]`). Verificado: o modelo de
fluxo de C vive no seu propio `src/decode.rs` (de `rex-gameplay` só usa
`json` e `sha256`), polo que é un segundo modelo de lonxitudes independente
do `instr.rs` v1.1 de A.

- Fonte: HEAD exacto de PR #108, `275f2af0b81944709169ab360a67786e56ec4a13`,
  extraído con `git archive` a `~/rds-scratch/rexcfg-275f2af/` (xunto con
  `crates/rex-gameplay`). O worktree local de C (WIP allea: `M src/lib.rs`,
  `M src/main.rs`, `?? src/sitio.rs`, `?? tests/consultar.rs`) **non se
  consumiu**: eses cambios non están no commit pinado.
- Bin `rex-cfg` debug: sha `7daeb51d151f54cc29843d352fcb69ccf5d0406dbbed5c90dd2e6da81094a927`.
- Expectativas conxeladas ANTES da medición:
  `EXPECTATIONS-CRUZAMENTO-REXCFG-A.md` (commit `2dfcc30`), cunha calibración
  de interface previa declarada (un só analyze en sonic-3082, §1 do conxelado).
- Medido (`cruzar-rexcfg-A.sh`, serie v1.1 con pins §6/§6.1): **fallos=0** —
  108 asercións (10 cadeas × sitios/estruturais + contigüidade) **todas**
  cumpren: carga/destino/chamada ⇒ `instrucao-de-bloco`, canarios `+2` ⇒
  `miolo-de-instrucao`, rutina ⇒ `fora-da-regiao`; `vaos=[]`; raíz
  `referencia-estatica` coa evidencia `rex-kosinski-chain/v1:<sha>`; fronteira
  única `limite-de-regiao` no elo de chamada (C non cruza a fronteira que A
  dibuxou — comportamento que PROPOSTA-FRENTE-A §2 xa mostrara en R3).
  Negativo §5: obxecto trocado (SoR sobre cadea Sonic) ⇒ `rc=2` sen analizar,
  rexistrado polo gate de identidade de A.
- Log integral: `~/rds-scratch/xe-a-rexcfg-cruzamento/cruzamento-rexcfg-20261004.log`,
  sha `42e4d40fe8a03b762a6857f9920c0a3470d901fe3dd3f5656f44124253662769`
  (119 liñas OK, 0 FALLO; 10 exports `.rexcfg.json` co seu sha dentro do log).

Lectura honesta (PROPOSTA-FRENTE-A §1, reproducida porque aplica): o
veredito `miolo` proba que **nese fluxo** o enderezo non é inicio de
instrución; `fora-da-regiao` proba só que a ventá declarada non alcanza a
pregunta — non nega código en `0x189C`/`0x85A2`/`0x6FDF2`. O cruzamento
**non** sobe ningún nivel de evidencia nin introduce runtime. No caso
sonic-51BC o que C confirma é a lonxitude/clase de fluxo do `lea.w` (4 B,
interior en `+2`); a conclusión de **signo** (`0xFFFF9400`) segue
provenindo do instrumento pinado en §3/§4 de RECTIFICACION-A, non de C.
