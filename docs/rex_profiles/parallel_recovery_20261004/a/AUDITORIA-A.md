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
