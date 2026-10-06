# RECTIFICACION-A — retificación do contrato 68000 (rex-kosinski-chain/v1.1, letra A)

Data: 2026-10-04. Estado: **conxelado antes de calquera corrección en `src/`**.
Este documento rectifica a gramática de instrucións do contrato
`rex-kosinski-chain/v1` (§3 de `CONTRATO-A.md`, §3 de `EXPECTATIONS-A.md`)
tras confirmar os cinco bloqueadores declarados na misión contra dous
instrumentos independentes do montador/desassembler. O texto conxelado
orixinal NON se reescribe: queda na historia (commits `7e3731c..cbb6895`) e
as súas refutacións anótanse aquí, conservando a cita do conxelado.

## 0. Instrumentos pinados (referencia independente — non derivada do noso decoder)

| Instrumento | Proveniencia | SHA-256 do binario |
|---|---|---|
| `m68k-elf-as` binutils 2.41 | provisionada polo launcher do proxecto en `~/.cache/retrodevstudio/17f7bcf5…/source-build-m68k_gcc/source/install/bin` | `618740559477258165eb1a344e07acd592afc1438061825469d5bd56fa2c87c7` |
| `m68k-elf-ld` 2.41 | mesma caché | `d21328fecd818b21ae3d386971f33e86a033e9965740d3817ea90f03a58efcef` |
| `m68k-elf-objdump` 2.41 | mesma caché | `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f` |
| `m68k-elf-objcopy` 2.41 | mesma caché | `d1de513f5846af97cafe178c6cf2fa520ab1194104eb1349790e826e2ab302e8` |
| `wla-68000` 10.8a (23.9.2026) | WLA DX commit `d097e6472c3dd0f11cde9001940e490767b02c6e`, construído localmente, GPL-2.0-or-later | `b4aaa95c75c755a4be81aaf57108b998bfe27b72a45ffabaa14f2b5366b49ba2` |
| `wlalink` 5.24a (3.10.2026) | mesma fonte | `18465ee1ba31244c9288684e7452808109331e8ca46d5b5484128047a7b2f5ca` |
| `cstool` capstone 5.0.9 | pacman do host, `/usr/sbin/cstool` | `935e14eee9c4fdd41015ed8365a420acc3f4bd0dfd2ad49045f3f577eab36450` |

Desvío rexistrado (misión dicía "confira os bytes com objdump"): o `objdump`
nativo do host (binutils 2.47) NON ten obxectivo m68k. A conferencia fíxose
con `m68k-elf-objdump` (binutils 2.41) — un obxdump auténtico, cruzado con
`cstool` (capstone 5.0.9) e co montador secundario `wla-68000`. keystone
0.9.2 non trae `KS_ARCH_M68K` (beco sen saída, rexistrado o 2026-10-04).

## 1. Declaração de CPU (perfil fechado)

**Perfil declarado: `md68000-chain16`** = MC68000 base + exactamente unha
extensión enumerada: a forma de **desplazamento de palabra (d16) en Bcc/BSR**
(`61 00 dd dd` etc.), que:

1. `m68k-elf-as -m68000` **acepta** (rc=0 en `fxA03_bsr.s`);
2. `m68k-elf-objdump` **decodifica** como `bsrw` (véxase
   `fixtures/fxA03_bsr-objdump.txt`: `6100 0018 → bsrw 1c`);
3. `wla-68000` (montador orientado á Mega Drive) **emite** `61 00 ff fc` para
   `bsr.w` (probe `~/rds-scratch/wla_probe.s`, bytes 8–11 de probe.bin);
4. está **medida no corpus**: as chamada Sonic 1 son `61 00 E8 0C`/`61 00 05
   2A`/`61 00 C6 D4` (FASE6 e esta fronte).

Todo lo demás fica **fora**: formas propias de 68010+ que non sexan a
anterior, formas 68020+ (`bsr.l`/`61 FF`, desprazamentos de palabra en
`movea` 68020, direccionamento indexado), e calquera opcode non enumerado na
táboa §3. Non se amplía silenciosamente a 68020: a ampliación é un acto de
contrato futuro, non un efecto colateral do recoñecedor.

Proba da fronteira 68020 (fixada por recusa): `bsr.l al` con
`m68k-elf-as -m68000` ⇒ `Error: invalid instruction for this architecture;
needs 68020` (transcrito literalmente en `fixtures/recusas.txt`);
`wla-68000` di `Cannot process "bsr.l"`; `cstool` en modo m68k por defecto
rexeita `61ff…` (modo m68k40 sí o acepta). Tres ferramentas coinciden no
perfil: **`61 FF` non pertence ao noso perfil** e produce recusa explícita.

## 2. Modelo de enderezamento en tres niveis (obrigatorio no contrato)

1. **Enderezo efectivo (32 bits)** — o que a ISA forma para o operando:
   - `(xxx).L`: `0xXXXXXXXX` sen máis.
   - `(xxx).W`: **signo-extendido** dende o bit 15. Medido:
     `43f8 8000 → lea ffff8000,%a1` (objdump, `fixtures/fxA01_lea-objdump.txt`);
     `4eb8 9400 → jsr ffff9400`; `4ef8 9400 → jmp ffff9400`. O conxelado
     v1 (§3 EXPECTATIONS: "extension curta = relleno a cero … **non** signo")
     queda **refutado** polo instrumento e rectificado.
     Nota de honestidade: a lectura estrita do UM do 68000 orixinal é
     cero-extensión; a elección do contrato é a **interpretación dos dous
     instrumentos independentes** (signo). O efecto clasificador só aparece
     cando bit15=1; as cadeas afectadas levan a limitación declarada.
   - `(d16,PC)`: base = **dirección da palabra de extensión = sitio + 2**,
     d16 con signo. Medido: `47fa 0008` en `0x0E` → alvo `0x18`;
     `49fa fffa` en `0x12` → alvo `0x0E` (fxA01); `4eba 0004` en `0x0A` →
     `0x10` (fxA02).
   - BSR/Bcc d8/d16: base `sitio + 2` (invariante de v1, mantida; a v1 xa
     acertara nesta base).
2. **Enderezo de bus (24 bits)** — vista do barramento MC68000 (A0–A23):
   `bus = efectivo & 0xFF_FFFF` cando o efectivo cabe en 24 bits OU está na
   rexión especular `0xFF0000–0xFFFFFF` (espello de RAM de 68k en Mega Drive,
   táboa §4 de EXPECTATIONS-A). Efectivos fóra desas lecturas → `descoecida`,
   nunca se clampa. O v1 confundía "alvo da forma" con "enderezo de bus"; a
   cadea de elos agora separa efectivo → bus → offset.
3. **Desprazamento de ficheiro** — só existe se o bus tradúce polo perfil de
   mapper (`md-linear`: `offset = bus` cando `bus < rom_size`, sen clampa;
   calquera outro caso = `MAPPER-DIVERXENCIA`). Un destino `ram-68k-mirror`
   **non ten** desprazamento de ficheiro: a cadea rexistra a rexión e non
   inventa offset ningún.

Consecuencia concreta e predicada (non-negociável na reexecución §5): calquera
carga `lea (xxx).W` co bit15 ligado (p. ex. fixture `43 F8 94 00`) deixa de
ser `0x00009400` (rexión `rom` se rom_size>0x9400) e pasa a efectivo
`0xFFFF9400` → bus `0xFF9400` → rexión `ram-68k-mirror`. Ningunha das 9
cadeas reais usa carga `.W` (as 9 son `lea…L`); a rectificación móvenlles o
criterio de clasificación, non os bytes.

## 3. Gramática rectificada (táboa normativa v1.1)

Formas aceptadas (11). `lonxitude` en bytes; `base` para as relativas.

| Forma | Codificación | Lonx. | Alvo/operando (medido no instrumento) |
|---|---|---|---|
| `lea.l/An` | `4x F9` + longword | 6 | efectivo = longword (`41f9 12345678`) |
| `lea.w/An` | `4x F8` + word | 4 | efectivo = **signo**-extendido (`43f8 8000 → ffff8000`) |
| `lea.pcd16/An` | `4x FA` + d16 | 4 | efectivo = `sitio+2+d16` (`47fa 0008`@0x0E→0x18) |
| `jsr.l` | `4E B9` + longword | 6 | alvo = longword (`4eb9 12345678`) |
| `jsr.w` | `4E B8` + word | 4 | alvo = signo-extendido (`4eb8 9400 → ffff9400`) |
| `jsr.pcd16` | `4E BA` + d16 | 4 | alvo = `sitio+2+d16` (`4eba 0004`@0x0A→0x10) |
| `jmp.l` | `4E F9` + longword | 6 | alvo = longword (`4ef9 12345678`) |
| `jmp.w` | `4E F8` + word | 4 | alvo = signo-extendido (`4ef8 9400 → ffff9400`) |
| `jmp.pcd16` | `4E FA` + d16 | 4 | alvo = `sitio+2+d16` (`4efa 0004`@0x18→0x1E) |
| `bsr.s` | `61 dd` (`dd∉{00,FF}`) | **2** | alvo = `sitio+2+d8` (`611a`@0→0x1C; `61f8`@6→0x0) |
| `bsr.w` (extensión chain16) | `61 00 dd dd` | 4 | alvo = `sitio+2+d16` (`6100 0018`@2→0x1C; `6100 fff6`@8→0x0) |

`x` en `4x` cumpre `byte0 & 0xF0 == 0x40` e byte0 impar excluíndo `0x4E`;
`registro = (byte0 >> 1) & 7` (invariante v1 conservado; FA-6 confirmada).

Lista de recusa con motivos estables (esténdese o enumerado `NonForma`/`MoiCurta`):

| Bytes | Motivo estable | Proba |
|---|---|---|
| `61 FF …` | `68020-non-declarado` (BSR.L familia 68020+) | `recusas.txt` S1 + `cstool` modo por defecto + `wla-68000` |
| `4E FC`, `4E FD` | `indefinido-68000` (objdump imprímeos como `.short`, non os decodifica) | `sonda-opcodes-brutos-objdump.txt` |
| `4E D0–4E DF`, `4E 90–4E 9F` | `fora-de-subconxunto` (jmp/jsr indirecto por rexistro; `jmp %a0@`=4e d0, `jsr %a2@`=4e 92) | `fxA04_recusa-objdump.txt` |
| `60 …`, `6x dd` (Bcc/BRAs), `51cb` (DBcc), `2x 7C` (movea #) | `fora-de-subconxunto` | `fxA04_recusa-objdump.txt` |
| sitio impar | `non-aliñado` (instrucións 68000 aliñan a palabra) | invariante v1 |

## 4. Refutación de items conxelados v1 (conservando o texto orixinal)

1. **FA-4** (`61 FF FF FF FE 00` @0x10000 → alvo `0xFE04`, base sitio+4):
   **refutada** en dous puntos — a familia `61 FF` é de recusa (S1), e mesmo
   na súa propia lectura 68020 o instrumento usa base **sitio+2**
   (`61ff 0000 0006` → `bsrl 8`; sonda `p_bsr_ff_long.o`). O base `sitio+4`
   do conxelado non o produce ningún instrumento.
2. **FA-5** (`4E FA 18 9C` → "abs.W cero-extendido `0x189C`"): **refutada** —
   `4E FA` é `jmp (d16,PC)`; o alvo é `sitio+2+0x189C`. O `jsr.w` real é
   `4E B8`.
3. **FA-7** (`43 F8 94 00` → `$00009400` "sen signo"): **refutada** —
   efectivo `$FFFF9400` (signo; §2). A rexión prevista pasa de `rom` a
   `ram-68k-mirror`.
4. **§3 chamada** (`jsr .W: 4E FA`; `jmp .L: 4E FD`; `jmp .W: 4E FC`):
   **rectificados** a `4E B8`/`4E F9`/`4E F8`; os tres codificadores v1
   correspondían a formas inexistentes ou a `jmp.pcd16`.
5. **§3 carga** ("extension curta = relleno a cero… **non** signo"):
   **rectificada** a signo-extensión (§2, medido).
6. **`bsr.w: 61 dd disp16`**: a notación conxelada era ambigua e o decoder
   herdou a ambigüidade — `61 dd` (dd≠00,FF) é **BSR.S de 2 bytes**; a forma
   de palabra é `61 00 dd dd`. Defecto "BSR curto consumido como BSR de
   palabra" confirmado no código (`src/instr.rs` sempre esixía ≥4 bytes e
   lía `bytes[2..4]`).

## 5. Expectativas conxeladas para a reexecución (ANTES de tocar `src/`)

Fixadas hoxe; calquera desvío na execución rexístrase como desvío, non se
axusta aquí.

1. As 9 cadeas reais (3 Sonic bsr.w `61 00 …`, 6 SoR jsr.l `4E B9 …`) usan
   formas que seguen aceptadas coa **mesma aritmética**: predición =
   **revalidación 9/9 rc=0, elos idénticos** (bytes, alvos, rutina, consumo,
   saída). Se algún elo cambia, é defecto novo a documentar.
2. Ningunha cadea real usa `61 FF`, `4E FC`, `4E FD`, `4E FA` como chamada;
   predición = ningún dos 9 elos de chamada migra á lista de recusa.
3. Varredura Phelios (mostra reservada, mesma gramática de emparellamento):
   os contadores **van cambiar** (o `4E FA`-como-jsr.w e `4E FC/FD`-como-jmp
   desaparecen; `bsr.s` de 2 bytes reabre xanelas de emparellamento).
   Predición: `emitidas ≥ 1` (a cadea descuberta `0x00035A` usa carga+`jsr.l`,
   invariantes), serie bruta nova versionada; **non** se exixe igualdade co
   antigo `cargas=320 sen-parella=242 rexeitadas=77 emitidas=1`.
4. Tests discriminantes (escríbense antes da corrección, §misión 3): cada un
   debe **fallar en HEAD `cbb6895`** e pasar tras a corrección: lonxitude de
   `61 dd` (2), detección de `4e b8/4e f8/4e f9/4e ba/4e fa`, signo en
   `lea.w`/`jsr.w`/`jmp.w` co bit15, recusa de `61 ff` con motivo estable,
   recusa de `4e d0/4e 92` (`fora-de-subconxunto`), e falsos recoñecementos:
   `4e fa 18 9c` NON é `jsr.w $189c`; `4e fd …` NON é `jmp.l`.
5. Niveis de evidencia, gardafíos (§2 do contrato) e non-alegacións (§8 do
   informe) **non mudan**: seguimos en `vinculo-estrutural`, sen execución,
   sen alcance desde o boot. Un root declarado polo usuario segue sendo root
   local.

### 5.1 Anotacións datadas tras a execución da corrección (2026-10-04)

O texto conxelado de §5 NON se reescribe; rexistranse aquí os desvíos reais
producidos ao executar os pasos 3–4, coa serie bruta conservada en
`docs/…/transcritos/rectif-tests-head-cbb6895.txt`:

1. **§5.4 "cada un debe fallar en HEAD"**: materializouse como **17/18**
   fallan en `cbb6895`; `r14` é anchor verde **deseñado** (a cadea real
   Sonic `61 00 …` NON debe migrar). Xa anotado no commit `b837986`.
2. **Desvío de transcrición en `r7`**: o test conxelado afirmaba
   `alvo = 0x2000+2+4 = 0x2006 = 8202`; 0x2006 en decimal é **8198**
   (8202 = 0x200A). Corrixido o literal decimal do test con anotación in
   situ. A expectativa normativa (fórmula `sitio+2+d16`, bytes `4E BA`
   medidos por `m68k-elf-objdump`) NON se toca: o propio test xa
   contradicía o seu hexadecimal escrito, e o instrumento é a referencia.
   O decoder corrigido produce 0x2006; non se moveu ningunha expectativa
   cara ao resultado.
3. **Dobre control endurecido** (`verify.rs::alvo_desde_bytes`): a versión
   v1 silenciaba cun `unwrap_or(calc)` cando a reprodución independente non
   existía, e rexeitaba alvos > 0xFFFFFF (contradictorio co nivel efectivo
   de §2). v1.1: `None` ou diverxencia = **FAIL** con detalle; a
   reprodución cubre as 8 formas de chamada da táboa §3 co mesmo efectivo
   de 32 bits (sen clamp). Isto é coherencia con §2, non un cambio de
   limiar.

## 6. Corpus de fixtures autorais (versionado, reproducíbel)

`scripts/rex_profiles/parallel_recovery_20261004/a/fixtures/`:

| Fixture | Contido | Artefactos |
|---|---|---|
| `fxA01_lea.s` | 3 formas lea (abs.L, abs.W con/neg bit15, pcd16 ±) | `.bin`, `-objdump.txt` |
| `fxA02_calls.s` | 6 formas jsr/jmp + 2 indirectos de recusa | idem |
| `fxA03_bsr.s` | bsr.s pos/atrás, bsr.w pos/atrás, `bsr` automático | idem |
| `fxA04_recusa.s` | sondas `fora-de-subconxunto` (bra/beq/dbf/(An)) | idem |
| `recusas.txt` | recusa S1 `-m68000 bsr.l` transcrita literal | texto |
| `sonda-opcodes-brutos/` + dump | codificacións crúas (`4efc/4efd/61ff/…`) decodificadas polo instrumento | `.s` + `-objdump.txt` |

`tools/make-fixtures-a.sh` xera todo desde as fontes `.s` co instrumento
pinado e `--check` exige byte a byte a reprodución (medido hoxe:
`OK: 4 fixtures + recusas reproducibles`). Os fixtures son **autorais**:
ningún byte provén dunha ROM comercial. Ningunha expectativa do §3 desta
rectificación está derivada do noso decoder: cada liña cita o instrumento.

## 7. Addendum datado 2026-10-05 (misión 3, pasos 3 y 5): formato v1 vs interpretación v1.1

O §5.3 superior di «reprodución independente» do dobre control; a rectificación
conxelada en `RESPOSTA-D-A.md` §6 (HEAD `6a123e1`) exixe presentalo como o que
é. Este addendum reencuadra **sen reescribir** os textos históricos:

1. **Separación formato/interpretación.** O formato do rexistro segue sendo
   `rex-kosinski-chain/v1` (33 campos pechados; ningún campo renomeado nin
   rescindido pola corrección). O que mudou é a **interpretación**: v1.1, a
   táboa §3 coa extensión de sinal, os tres niveis §2 e as 8 formas
   reproducíbeis. Un ficheiro escrito baixo a interpretación v1 antiga
   **non gaña confianza estrutural pola súa idade nin porque «os bytes
   encaixen»**: só a revalidación `revalidar` contra os bytes actuais coa
   gramática v1.1 pode promotelo, e se a medición v1.1 difire (p. ex.
   `destino_operando` cero-estendido `0x009400` sobre `43F8 9400`, ou
   etiqueta `jsr.w` sobre `4E FA`), o rexistro falla con rc≠0 polo seu
   propio peso. Iso está pinado polas probas discriminantes K14/K15 de
   `tests/segmento.rs` (verde con a garda activa, vermella se se relaxa).
2. **`alvo_desde_bytes` / dobre control.** Pasa a presentarse, en docs e
   comentarios, como **defensa redundante mínima de implementación**
   (recálculo aritmético coa **mesma gramática**, sen pasar polo dispatch
   de `decodificar`); **non** como segundo entendemento independente da
   ISA. A independencia fronte ao erro de interpretación é a do
   instrumento pinado (§0: `m68k-elf-objdump` binutils + WLA + capstone)
   e a da cita primazia do Motorola PRM rexistrada en `RESPOSTA-D-A.md`
   §2. A súa función real é detectar un desliz de despachamento ou de
   transcrición da táboa dentro da propia ferramenta.
3. Ningunha expectativa §1–§5 conxelada se reescribe: este apartado é
   aditivo e datado, como esixe a política de rectificación versionada.
