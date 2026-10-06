# Contrato `rex-kosinski-chain/v1` — cadeas revalidables (frente A, recuperación paralela 2026-10-04)

**Base fixada:** `codex/rex-sonic-sequencia` @ `cb56657a142df40d2acd09a3e03e54247f066dea` (sen deriva, confirmada antes de iniciar).
**Propiedade:** frente A. Non integra produto; non expón IPC/UI. Entregarase como paquete autónomo `scripts/rex_profiles/parallel_recovery_20261004/a/` (crate `rex-chain`) cun adaptador proposto para o integrador.
**Expectativas conxeladas antes de medir:** `docs/rex_profiles/parallel_recovery_20261004/a/EXPECTATIONS-A.md` (commit `7e3731c`, só ese ficheiro nese commit).

## 0. Que é e que NON é unha cadea

Unha cadea é a secuencia de elos que a misión esixe, cada un cun valor **medido ou declarado e probado**:

```
identidade da imaxe (SHA-256) → mapper/estado → sitio de carga (bytes) →
argumento fonte (operando lea) → [argumento destino + rexión] →
chamada (bytes + aritmética) → rutina (hash de N bytes no alvo) →
fluxo (offset) → saída validada (consumo, lonxitude, SHA-256)
```

- **Non é descubramento:** `construir-cadea` recibe un `--carga-sitio` **declarado polo usuario** e probe os bytes; o orixe rexístrase como `declarado-probado`. Un enderezo fornecido polo usuario nunca se promove a `descoberto`.
- **Non é execución:** nada neste contrato afirma que a ROM execute a rutina, que a VRAM se escriba, ou que a saída sexa visible/clase gráfica. O nivel `observado-en-runtime` **rexeítase estruturalmente ao escribir** (`validar()` erro).
- **Un nivel non implica o seguinte:** `vinculo-estrutural` (forma de instrución medida) ≠ decoder identificado ≠ semántica recuperada.

## 1. Formato

Obxecto JSON **plano**, 34 claves fixas nunha **orde fixa** (dous coñecidos cos mesmos valores producen os mesmos bytes — propiedade das evidencias hash-pinned), sen claves descoñecidas (rexéitanse: `campo descoñecido`). Escalares: enderezos como `0x` + hex maiúsculas; bytes como hex maiúsculas sen separadores; SHA-256 como 64 hex minúsculas; enteiros decimais sans. Listas (`limitacions`, `orixe`): só cadeas.

O parser (`src/json.rs`) rexeita deliberadamente: anidamento, listas con números, claves duplicadas, texto sobrante, `\u`, signos e decimais. Unha evidencia malformada produce `ESQUEMA`, nunca un valor estimado.

### Campos

| Campo | Semántica |
|---|---|
| `schema_version` | `rex-kosinski-chain/v1` |
| `imaxe_sha256` | SHA-256 da imaxe **que a cadea pinna**; revalidar contra outra imaxe = `ROM-DIVERXENCIA` antes de interpretar un só opcode |
| `mapper`, `estado_mapper` | perfil de tradución (`md-linear`) e estado (`rom_size=0x…`); `Device`/`Invalid` **non se clapan**: son fallo de elo |
| `carga_sitio`, `carga_bytes`, `carga_forma`, `carga_operando` | sitio CPU da carga, bytes aí medidos, nome da forma medida (`lea.l/A0`…), operando = CPU-address do fluxo |
| `destino_*` (5, todo-ou-nada) | segundo argumento medido se hai forma; `destino_rexion` é **etiqueta de ventaná do mapa** (táboa local §4), non clase gráfica |
| `chamada_*` (4, todo-ou-nada) | bytes, forma (`bsr.w`/`bsr.l`/`jsr.l`/`jsr.w`/`jmp.l`/`jmp.w`) e alvo **recalculado con dobre control** (decodificador + aritmética independente desde bytes brutos) |
| `rutina_*` (3, todo-ou-nada) | CPU-address do alvo, lonxitude N, SHA-256 dos N bytes medidos — **pin, non desasemblado** |
| `fluxo_cpu`, `fluxo_offset` | CPU-address cargada e offset ROM tradUCido polo mapper |
| `tramo_entrada` | bytes dispoñibles desde o offset ata o fin da imaxe (= len(imaxe) − offset; medida, non estimación) |
| `bytes_consumidos`, `saida_bytes`, `saida_sha256` | saída do **decodificador do produto** (`crates/rex-kosinski`) sobre os bytes actuais |
| `codec`, `variante` | `kosinski` / `base-non-modular` |
| `limite_max_saida`, `limite_orzamento` | os dous límites esixidos polo contrato do decodificador; requírense **explicitos** en CLI (sen inflación silenciosa) |
| `confianza` | `candidato` \| `referencia-estatica` \| `vinculo-estrutural`; `observado-en-runtime` rexeitado |
| `limitacions`, `orixe` | cadenas; `orixe` marca por campo `declarado-probado` / `medido` / `descoberto-por-varredura` / `hash-medido` / `derivado-da-carga` / `medida` |

## 2. Gardafíos estruturais (herdados do gardafío `rex-corpus-resource/v2`)

- `referencia-estatica` e `candidato` **prohiben** elos de chamada: se a chamada está medida, a confianza declarada é máis feble ca a medida e a cadea miente por defecto.
- `vinculo-estrutural` **esixe** chamada + rutina completas **e** `carga_operando == fluxo_cpu` (a carga apunta ao fluxo desta cadea).
- Elos todo-ou-nada: chamada (4), rutina (3), destino (5): incompletos = `ESQUEMA`.
- Sen chamada, `carga_operando == fluxo_cpu` tamén esíxese.
- SHA-256 sen forma (64 hex minúsculas) = `ESQUEMA`.

## 3. Gramática de instrucións conxelada (EXPECTATIONS-A §3)

Subconxunto modelado, aritmética **relativa á palabra de extensión**:

| Forma | Opcode | Alvo/operando |
|---|---|---|
| `lea (xxx).L,An` | `4x F9` (x impar, `40..4F`) | longword BE; rexistro `(b0>>1)&7` |
| `lea (xxx).W,An` | `4x F8` | palabra BE **cero-extendida** (quirk Sonic `$9400`) |
| `lea (d16,PC),An` | `4x FA` | `sitio + 2 + d16` signado |
| `bsr.w` | `61` `dd≠FF` | `sitio + 2 + d16` signado |
| `bsr.l` | `61 FF` | `sitio + 4 + d32` signado |
| `jsr abs.l` / `jmp abs.l` | `4E B9` / `4E FD` | longword BE |
| `jsr abs.w` / `jmp abs.w` | `4E FA` / `4E FC` | palabra BE cero-extendida |

- Sitios aliñados a palabra: **un opcode en desprazamento impar non é código** — o eloo `xeometria` e o scanner rexeitan sitios impares.
- Alvo fóra de `0x000000..=0xFFFFFF` = `AlvoFóraBarramento` (erro, non «clamp»).
- fixtures `FA-1..FA-8` calculados **a man antes de implementar** en EXPECTATIONS-A §3 e probados en `tests/instr.rs` — a aritmética relativa curta (`bsr.w` base `sitio+2`) é a corrección de FASE6 que o escáner antigo non modelaba.
- **Emparellamento heurístico:** «chamada na ventá tras a carga» é a forma dun consumidor, non proba de fluxo de control. Toda cadea con chamada emitida por medición leva a limitación `emparellamento-ventana-heuristico`.

> **Rectificación datada 2026-10-04 (v1.1).** A táboa superior é historia
> conxelada; a gramática **normativa** é `RECTIFICACION-A.md` §3 (perfil
> `md68000-chain16`), medida co instrumento pinado: `jsr abs.w` = `4E B8`
> (non `4E FA`), `jmp abs.l` = `4E F9` (non `4E FD`), `jmp abs.w` = `4E F8`
> (non `4E FC`), `4E FA` = `jmp (d16,PC)`; engádense `jsr (d16,PC)` = `4E BA`
> e `jmp (d16,PC)` = `4E FA`; `lea/jsr/jmp .W` levan **extensión de sinal**
> (non cero); `61 dd` (`dd∉{00,FF}`) é BSR.S de **2 bytes**; a forma de
> palabra é `61 00 dd dd` (extensión chain16 declarada); `61 FF` pasa á
> **lista de recusa** (`68020-non-declarado`), polo que a fila `bsr.l` deixa
> de ser forma aceptada. O modelo de enderezamento en tres niveis
> (efectivo 32b → bus 24b → desprazamento de ficheiro, con offset só cando
> `bus < rom_size` baixo `md-linear`) é obrigatorio desde v1.1. Os nomes de
> forma do campo `chamada_forma` pasan a `bsr.s`/`bsr.w`/`jsr.l`/`jsr.w`/
> `jsr.pcd16`/`jmp.l`/`jmp.w`/`jmp.pcd16`; `bsr.l` emítese só como recusa.

## 4. Rexións do destino (táboa local documentada)

`rom` (`< rom_size` e `< 0x800000`), `io/vram-window` (`0xA00000..=0xA1FFFF`), `cram-window` (`0xC00000..=0xC0003F`), `work-ram` (`0xE00000..=0xE0FFFF`), `ram-68k-mirror` (`0xFF0000..=0xFFFFFF`), `descoecida` (todo o demais). Son etiquetas de **ventaná de enderezos do mapa md-linear**; `crates/rex-addressing` non expón clases VRAM/CRAM e ningunha delas afirma conteúdo nin escritura. Un destino `0xA00000` clasificado `io/vram-window` **non** di que sexa tile data.

## 5. Verbos e códigos de saída estables

```
rex-chain revalidar      --imaxe F --cadea F [--liña N] [--ventanxa N]
rex-chain construir-cadea --imaxe F --rom-size 0x.. --carga-sitio 0x..
                          --rutina-lonxitude N --limite-max-saida N --limite-orzamento N
                          [--destino-sitio 0x..] [--ventanxa N]
rex-chain detectar       --imaxe F --rom-size 0x.. --rutina-lonxitude N
                          --limite-max-saida N --limite-orzamento N [--ventanxa N] [--max-cadeas N]
rex-chain medir-bytes    --imaxe F --offset N --lonxe N
```

| Código | Nome | Significado |
|---|---|---|
| 0 | OK | todos os elos declarados PASan contra os bytes actuais |
| 1 | USO | argumentos malformados |
| 2 | ESQUEMA | contrato estrutural roto (antes de medir) |
| 3 | ROM-DIVERXENCIA | a imaxe non é a que a cadea pinna — rexeito, **non recolocación** |
| 4 | MAPPER-DIVERXENCIA | tradución sen backing ROM ou offset traducido ≠ declarado |
| 5 | SITIO-DIVERXENCIA | bytes do sitio ≠ afirmados, ou o sitio non decodifica forma válida |
| 6 | ARGUMENTO-DIVERXENTE | forma ou operando medido ≠ afirmado |
| 7 | ALVO-DIVERXENTE | aritmética da chamada (dobre control) ≠ alvo afirmado |
| 8 | ROTINA-DIVERXENCIA | hash dos bytes no alvo ≠ pin |
| 9 | SAIDA-DIVERXENTE | consumo/lonxitude/SHA da decodificación ≠ afirmado, ou referencia-invalida |
| 10 | INCONCLUSIVE-TRUNCADA | fluxo sen terminator medible: **queda inconcluso, nunca OK** |
| 11 | XEOMETRIA-DIVERXENTE | chamada fóra da ventá tras a carga, ou sitio non aliñado |
| 12 | LECTURA-ERRO | imaxe ausente ou > 16 MiB (límite duro) |
| 13 | LIMITE-ACADADO | `max_output`/`work_limit` do contrato do decodificador esgotados |
| 14 | REXION-DIVERXENTE | rexión reclasificada ≠ afirmada |

`detectar` escribe JSONL (unha cadea por parella aceptada) en stdout e **sempre** o resumo `cargas= sen-parella= rexeitadas= emitidas=` en stderr — as rexeitas reportánse, non se descotan.

## 6. Comparación coa referencia externa (entrega 4)

Protocolo en EXPECTATIONS-A §5: decodificador do produto vs oráculo `koscmp` pinado (SHA `a74c9295…`, commit mdcomp `72c6df40…`, LGPL-3.0 **só como ferramenta externa**), sobre os 8 fluxos vinculados a consumidores. Diferenza contractual **coñecida e rexistrada**: o oráculo emite 1 byte de padding tras o terminator (medido en 12 streams reais); a igualdade exíxese como prefixo `saida_bytes` e delta de lonxitude exacto `+1`. O round-trip interno do produto **non vale como referencia independente**.

## 7. Limites abertos (non ocultados)

- Sen execución: alcance real do fluxo de control, retorno da rutina e uso do destino **sen determinar** (descoecido permanece descoecido).
- `rutina_sha256` é pin de bytes, non semántica.
- Mosta reservada (Phelios (USA), membro 524 288 B, SHA do contedor fixado en EXPECTATIONS-A antes de afinar): resultado honesto, incluído 0 cadeas.
- JSONL histórico: os pins da FASE5 (§5) corresponden á xeración v1; os ficheiros actuais son v2 rexenerada — diverxencia rexistrada no informe, non «parcheada» en territorio alleo.
