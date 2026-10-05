# RESPOSTA-D-A — filas disputadas de D, separación v1/v1.1 e laços do varredor (misión 3, 2026-10-05)

Frente A (`codex/rex-parallel-a-kosinski-chains`, worktree
`/home/misael/RDS-REX-PARALLEL-A-2026-10-04`). **Conxelado antes de medir**:
este documento publica as alegacións, a interpretación ISA e as **predicións**
que a ferramenta debe cumprir; a sección de resultados engádese despois como
apartado datado (§8), conservando o texto orixinal (protocolo FA-6). Non se
revirta ningunha extensión de sinal nin ningún opcode corrigido para
satisfacer a ninguén (misión 3, paso 1).

## 0. Pins da resposta

| artefacto | SHA-256 |
|---|---|
| `M68000PRM.pdf` (Motorola, 646 p., baixado de `https://www.nxp.com/docs/en/reference-manual/M68000PRM.pdf`) | `06e4864b78da0e815054cead9326b7ec9914661f240fd39a455f2061ff47c4e8` |
| `M68000PRM.txt` (extracción `pdftotext -layout`, usada para as citas) | `a36371ae7101fdcda85db4f616c2a6fad606c12af8dba77ab9c56ae43be31622` |
| `REVISAO-C-DE-A.md` (C, HEAD `8ea5821dbf3c61a0bc84ae49de54d8e2bd9557f5`, vía `gh api contents?ref=8ea5821`) | `fd176254ba17bf0ad3d513a140cc1245378ce745102674d10e8af7a944540462` |
| imaxe fixture de D `dA-img-v1.bin` (xa versionada por D; coincide co `imaxe_sha256` das súas filas TA) | `a40ae21d21ea06171bce9d318e29372d2d9cc0107180107a6919f4c280b6dd18` |
| verdade de D `dA-truth-v1.json` | `07198d453d2044e761ae2306dc508f3dd477e5d29c35d748861bae9b2643e032` |

Comando de reprodución base (bin `rex-chain` do HEAD publicado `bd40e92`):

```
rex-chain medir-bytes --imaxe <fix> --sitio <s> --rom-size <..>   # forma medida no sitio
rex-chain revalidar --imaxe <fix> --cadea <rexistro.jsonl>       # elos + rc estable
```

## 1. Orixe da disputa: D conxelou as súas expectativas sobre a táboa **v1** de A

`dA-truth-v1.json` (fila `KA1-2`) leva a nota literal *«extensão curta sem
signo (EXPECTATIONS-A §3)»*. A cláusula §3 do EXPECTATIONS-A conxelado foi
**rectificada** por `RECTIFICACION-A.md` §2/§3 e FA-7 (commit `09e5833`,
conxelado antes da corrección `1344f4c`). Polo tanto as filas de D miden a
interpretación v1, non a v1.1. Misión 3 paso 3: *un rexistro antigo non pode
gañar confianza estrutural sen revalidación* — aquí aplícase tamén ás
expectativas alleas: a adhesión á v1 caducou coa rectificación versionada.

## 2. Adxudicación por fila (bytes, contrato, ISA, reprodución)

Cita primaria agora dispoñible — **M68000PRM §2.2.16 Absolute Short** (p. 2-17,
verbatin): *«In this addressing mode, the operand is in memory, and the address
of the operand is in the extension word. The 16-bit address is sign-extended
to 32 bits before it is used.»* O diagrama da propia sección marca os bits
31..15 como `SIGN-EXTENDED`. (§2.2.6 confirma o paralelo para desprazamentos:
*«Displacements are always sign-extended to 32 bits prior to being used in
effective address calculations.»*)

| fila D | bytes medidos na súa imaxe | esperado conxelado (v1) | medición v1.1 | interpretación ISA (fonte primazia) | veredicto |
|---|---|---|---|---|---|
| `KA1-2` | `43 F8 84 00` @`0x110` | `lea.w/A1`, operando `0x008400` (cero-extensión) | operando efectivo `0xFFFF8400` → bus `0xFF8400` → rexión work-RAM-mirror sen backing ROM ⇒ rc 4 na cadea completa | PRM §2.2.16: `(xxx).W` **esténdese con signo**; o esperado de D é a cláusula v1 rectificada | **A correcto, D caducado**. Non se reverte (paso 1) |
| `KA1-bsr.l` | `61 FF 00 00 1D D4` @`0x128` | `chamada_forma=bsr.l` | `Recusa(68020-non-declarado)`; o `jsr.l` que D observou en `0x134` é a chamada do **rexistro seguinte** captada polo varredor (emparellamento entre rexistros) | Formato BSR do M68000 (PRM, familia M68000): `0110 0001` + desprazamento de 8 bits; *16-bit desprazamento se o de 8 = `$00`* — **non existe BSR longo en 68000** (`61 FF` é extensión 68020) | **A correcto**; o caso expón a falla real do varredor (§5) |
| `KA1-jsr.w` | `4E FA 1F 00` @`0x140` | `jsr.w` | `jmp.pcd16` (4 B, base `sitio+2+d16`) | Táboa de modos JSR (PRM p. 4-109: `4E B?` = `0100 1110 11` + campo EA): `(xxx).W`=111/000 → `4E B8`; `(d16,PC)`=111/010 → `4E BA`. JMP comparte o campo `0100 1110 11 01`: `(d16,PC)` → `4E FA`. O byte `4E FA` **é** `jmp (d16,PC)` | **A correcto**; D fixou os bytes coa táboa v1 trocada |
| `KA1-jmp.l` | `4E FD 00 00 1F 00` @`0x14A` | `jmp.l` | `Recusa(indefinido-68000)` ⇒ sen elo de chamada | `4E FD` = EA 111/101, **non listado** para JSR/JMP en M68000 (só 000/001/010/011; 110 é 68020). Pertence ao espazo LINE-F/68881. `jmp (xxx).L` lexítimo = `4E F9` (111/001) — xa modelado en v1.1 (R8 de C: convergiu) | **A correcto** |
| `KA1-jmp.w` | `4E FC 1F 00` @`0x156` | `jmp.w` | `Recusa(indefinido-68000)` | idem: `4E FC` = 111/100, fóra das táboas M68000; `jmp (xxx).W` lexítimo = `4E F8` (modelado) | **A correcto** |
| `TA-3` | chamada declarada `0x134` fóra da ventá de `0x106` (ventá 16) **e** `rutina_sitio 0x9000 ≠ alvo calculado 0x1F00` | rc 11 `XEOMETRIA` | rc 7 `ALVO_DIVERXENTE` no elo `vinculo-chamada-rutina` | ambos os dous defectos son reais; o elo de vínculo execútase antes do de xeometría na serie de elos | **prioridade de validación, non defecto de detección** — demostrado en §4 (controles K12/K12b) |
| `TA-5` | rexistro JSON declara `carga_operando 0x008004` co `fluxo_cpu 0x008000` e bytes `41F900008000` | rc 6 `ARGUMENTO` (capa de medición) | rc 2 `ESQUEMA` (`validar`: *o bus do operando da carga non é o fluxo*) | a cadea é **internalmente inconsistente antes de medir nada**: o propio contrato esixe `bus(operando)==fluxo` en `vinculo-estrutural`. Rc 2 é recusa correcta e máis temperá; rc 6 só é alcanzable cando a declaración é coherente e son os **bytes** os diverxentes | **prioridade de validación** — demostrado en §4 (K13a/K13b) |

Conxectura de D en RELATORIO-D §10.3 («abs.W que parece sign-extend… é
conxectura»): resolta con fonte primazia — a sign-extension **é** a
especificación (PRM §2.2.16 arriba). Coincide ademais co instrumento pinado
(`m68k-elf-objdump` imprime `lea/jmp/jsr ffff8000`) e coa mecánica coñecida
do bug de extensión de sinal en Mega Drive. Ningunha fila disputada require
cambio no produto A.

## 3. Formato v1 vs interpretación v1.1 (paso 3)

- O **formato** do contrato mantense `rex-kosinski-chain/v1` (33 campos pechados;
  non se toca a schema para non invalidar series historicalas).
- A **interpretación** é a gramática v1.1 (`RECTIFICACION-A` §3) co instrumento
  pinado; un rexistro é datos, non oráculo: `revalidar` volve medir bytes,
  aritmética e hash en cada execución.
- Política versionada: **ningunha cadea pode afirmar `vinculo-estrutural` se
  calquera campo afirmado non coincide coa medición v1.1**. Rexistros creados
  baixo a v1 (p. ex. un destino `43F89400` co operando `0x00009400`, ou unha
  chamada `4EFA` rotulada `jsr.w`) quedan rexeitados pola súa propia medición
  (rc 5/6/7) sen necesidade de marker de versión. Pins de teste (§6): K14 e K15
  fixan este comportamento con rexistros «estilo v1».
- O estado publicado de A xa o cumpre: a serie §6.1/§6.3 revalidou as 9 cadeas
  **re-emprendas** baixo v1.1; a única conclusión mudada foi sonic-51BC
  (destino `0xFFFF9400`/`ram-68k-mirror`), rexistrada como serie nova, non
  como reescrita.

## 4. TA-3/TA-5: prioridade vs detección (paso 4) — controles conxelados

Sobre a imaxe sintética do harness `tests/adulteracion.rs` (lea.l A0 @0x100
`41F90003F09A`-like; chamada e fluxo coñecidos):

| control | receita | rc **predito** | o que demostra |
|---|---|---|---|
| K12a | chamada lexítima **fóra da ventá** (sitio `0x210`), `rutina_sitio == alvo calculado`, todo lo demais coherente | **11** `XEOMETRIA` | o elo de xeometría sigue existindo e dispara cando só o estra estra a xeometría — a perda non é de detección |
| K12b | como `TA-3`: chamada fóra da ventá **e** `rutina ≠ alvo` | **7** `ALVO_DIVERXENTE`, elo `vinculo-chamada-rutina` FAIL, elos previos PASS | reproduce exactlyamente a fila de D: dous defectos, o vínculo gaña por orde; ambos motivos visibles no JSON |
| K13a | mutar só o JSON (`carga_operando` `0x008004` con `fluxo 0x008000`) | **2** `ESQUEMA`, motivo `vinculo-estrutural: o bus do operando da carga non e o fluxo` | a recusa de TA-5 é real e máis temperá; presérvase o motivo |
| K13b | mutar os **bytes** da imaxe (operando `0x008004`) coa declaración internamente coherente (`operando==fluxo==0x8004`) | **6** `ARGUMENTO` | o eloxo `argumento-fonte` mide a diverxencia bytes↔declaración cando a cadea é coherente: rc 6 continúa alcanzable |

Os negativos conxelados existentes (C1–C7, K4–K10, TA-3/TA-5 medidos por D con
rc≠0) **non se tocan**: proban a recusa real (rc exacto ≠ 0, motivo estable).

## 5. Laços do varredor: non promover por só xanela (pasos 6–7)

Defecto real exposto por D (`KA1-bsr.l`): `buscar_chamada` devolvía o
**primeiro** candidato na ventá sen mirar o tramo — emparellando unha carga
cunha chamada que pertence ao seguinte rexistro, ou inalcanzable, ou cuxo
argumento foi sobrescrito. Cambios (gramática pechada, **non** descubemento
universal):

1. O tramo `fin_carga .. +ventanxa` explórase palabra a palabra e clasifícase
   cun **vocabulario de gardas** declarado e pechado (nada fóra del se
   promolve nin se rexeita por el):
   - `roto-bra` — `60 00 dd dd` / `60 dd` (salto incondicional: a chamada tras
     el non está no fluxo recto);
   - `roto-rts` — `4E 75`;
   - `sobrescrito` — forma `lea` reconecida (`4x F8/F9/FA`) que escribe o mesmo
     `An` da carga antes de calquera candidato;
   - `bcc` — `62..67` condicionais: **non** rompen o recto pero rexistran a
     ambigüidade de camiño como limitación do rexistro;
   - recusadas (`61 FF`, `4E FC/FD`, `4E 90..9F/D0..DF`) non rompen nin emparellan:
     rexístrase `recusa-no-tramo:<motivo>@<sitio>` como limitación cando hai
     emparellamento (a súa lonxitude real non se modela — límite declarado).
2. Unha vez rota a serie recta, **os candidatos posteriores non contan**.
3. `== 1` candidato no recto → emparellamento como hoxe (campos e limitacions
   actuais **sin alterations**: é a condición de byte-identidade da serie §6.3).
4. `>= 2` candidatos no recto → **non se promove**: `detectar` conta
   `ambiguas=` e non emite; `construir-cadea` queda sen chamada
   (`referencia-estatica` + limitación `ventana-ambigua:<N>-candidatos`).
   Ningún eloxo futuro se elixe «porque si».
5. `0` candidatos (ou todos tras rotura) → como o `sen-parella` de hoxe; en
   construción engádese a limitación do motivo da rotura cando a houbo
   (`segmento-roto:<motivo>@<sitio>`).
6. Nova opción `--chamada-sitio` en `construir-cadea`: emparellamento
   **declarado** polo usuario (orixe `chamada_sitio=declarado-probado`,
   limitación `par-declarado`), probando bytes/aritmética/vínculo/hash — a
   única vía de promover pares que o recto non resolve, coa súa epistemoloxía
   separada.
7. O resumo de `detectar` pasa a `cargas= sen-parella= ambiguas= rexeitadas=
   emitidas=` (serie nova do resumo; o JSONL da cadea emitida non cambia se a
   súa xanela é recta e única).

Predicións conxeladas: P7 — as 9 cadeas reais manteñen emparellamento único e
JSONL **byte-identico** a §6.3 (o patrón do cargador é `lea;…;bsr/jsr` con
ventá 16; a única word rara coñecida no tramo de sonic-51BC é o propio destino
`43F8` rexistro A1 ≠ A0 da carga); P8 — Phelios: ou ben se mantén a mesma
cadena emitida, ou ben queda `ambiguas`/`sen-parella` — calquera resultado é
publicable; se cambia, serie nova datada, serie vella conservada. Predición de
risco honesta: un dos candidatos `4EB9` das cadeas SoR podería ter patróns
`61..`/`4E..` nos 16 bytes de tramo (datos de codificador); se dispara
`ambiguas`, esas cadeas pasan a construírse con `--chamada-sitio` (declarado)
e os seus rexistros levan `par-declarado` — **non** se relaxan as gardas para
salvar hashes.

## 6. Probas novas conxeladas (redeiras antes de medirlas)

- `tests/segmento.rs` (imaxe sintética propia, auto-contida): K12a=11, K12b=7,
  K13a=2, K13b=6 (§4); K16 bra-intermedio → sen chamada → rc de construción 0
  con `referencia-estatica` + `segmento-roto:roto-bra` (e K16b: chamada tras
  `rts` idem); K17 sobrescrita `lea` mesmo `An` → sen promover; K18 dous
  candidatos rectos → construción queda `referencia-estatica` con
  `ventana-ambigua:2-candidatos`; K19 `--chamada-sitio` declarado →
  `vinculo-estrutural` con `par-declarado` e elos medidos; K14 rexistro
  «estilo v1» `destino_operando 0x00009400` sobre `43F89400` → rc ≠ 0 (medición
  v1.1 rexeita); K15 rexistro «estilo v1» `chamada_forma jsr.w` sobre `4EFA` →
  rc ≠ 0. Todos discriminantes: cada un fallaría se a garda correspondente se
  relaxase.
- O texto `alvo_desde_bytes`/dobre-cálculo pasa a presentarse en docs e
  comentarios como **defensa redundante mínima de implementación** (recálculo
  aritmético coa mesma gramática), **non** como segundo entendemento
  independente da ISA: a independencia fronte ao erro de interpretación é a do
  instrumento pinado (binutils/WLA/capstone) e, desde hoxe, a da cita primazia
  do PRM (§2).

## 7. Límites e non-alegacións

- As gardas do tramo son **heurística recta declarada**, non análise de
  alcançabilidade: MOVEA/Bcc/`bra` con desenlace, saltos con retorno previo,
  auto-modificación e fluxos reais con ramificación seguen fóra do modelo;
  dicir «non rompo» non di «alcanzable» — o rexistro sempre leva
  `emparellamento-ventana-heuristico`/`par-declarado`.
- `NonForma` non informa lonxitude: nun tramo con instrucións non modeladas
  (p. ex. `2A 7C` movea inmediato, lacuna §6.4 da revisión de C) a palabra
  probe pode caer dentro del. rexístrase como límite; a promción estrutural
  dun par así require declaración explícita do usuario (`--chamada-sitio`).
- Nada aquí afirma consumo en runtime nin observa ROM executada.

## 8. Medido (apartado datado, engádese despois da execución; o §1–§7 non se reescriben)

Serie datada **2026-10-05**, executada contra o HEAD conxelado `6a123e1`
(§1–§7 inmutables). Logs con sha256 en `/home/misael/rds-scratch/m3-evidencia/`;
artefactos en `/home/misael/rds-scratch/xe-a-evidencia-m3c/`.

### 8.1 Serie de redeiras (vermelha → verde, preservada como serie, non reescrita)

| log | sha256 | contido |
|---|---|---|
| `serie-vermelha-6a123e1.log` | `b016f09e63fbebdf263383242a620e99866c30341cbc65217f6ee0d3e39168df` | K16–K19 **fallan** no HEAD conxelado: `buscar_chamada` aínda toma o primeiro candidato da ventá — a redea esperada antes da implementación |
| `suite-verde-6a123e1.log` | `63b908b1e5a2ead464fe2841325e3a7b5f67f848f16d9b5d403f04c7447e4cf4` | suite completa verde **antes** da garda §7 (87 passed, 11 suites) |
| `evidencia-m3-6a123e1-170416.log` | `541c3b7aea91038f6eb070598103c9b3035f2761a78be87ebbba1cc00bb9755c` | E2E intermedio rc=1: o control `neg-alvo-mutado` de 12 (`sen-cadea`) porque a súa cadea-pai dependía da promoción relaxada; defecto do **arnés**, non da garda — conservado, non reescrito |
| `suite-final-173136.log` | `1925f70b0ed39f2dc352bb1fda1aaee93a42359a0874fbccdadfa5ef7bdbb2c2` | suite final despois da garda §7 + K20/K20b: **89 passed, 11 suites, 0 failed** |
| `evidencia-m3c-172044.log` | `bc3e4dfda50d168af31d52361ff3a3b6b9a82ac2f799880cf2c7bc52e7e10d1c` | E2E final: **fallos=0** (9 cadeas dobre pasada + 7 negativos + Phelios) |

### 8.2 Pasos 1–2: corrección preservada, filas disputadas respondidas con bytes

Ningún revert das correccións v1.1 (extensión de signo `(xxx).W`, formas
`4E FA`/`4E F8`/`4E F9`, recusa `61 FF`/`4E FC`/`4E FD`): §2 mantense tal cal
e as filas KA1-2/`bsr.l`/`jsr.w`/`jmp.l`/`jmp.w` re-producen verde na suite
final con fixtures montadas polo instrumento pinado (mesa §0). A resposta a D
son os bytes das táboas §2 + estes controls; non se interpretou nada novo.

### 8.3 Paso 3: formato legado v1 ≠ interpretación v1.1

Fixado no addendum datado §7 de `RECTIFICACION-A.md`: o schema
`rex-kosinski-chain/v1` é o **formato**; a **interpretación** versiona aparte
(v1.1). Un rexistro «estilo v1» non gaña confianza estrutural sen revalidación
v1.1: K14 (`destino_operando 0x00009400` sobre `43F89400`) e K15
(`chamada_forma jsr.w` sobre `4E FA`) dan rc ≠ 0 polo seu propio peso, e
permanecen verdes na suite final. A serie histórica §6.3 non se reescribe:
`sonic-51BC` xa fora rexistrada como serie nova datada (destino
`0xFFFF9400`/`ram-68k-mirror`), e as cadeas §8.6 son serie nova con esa
epistemoloxía declarada.

### 8.4 Paso 4: TA-3/TA-5 = prioridade de validación, non defecto de detección

Medido na suite final (verdes sobre o HEAD conxelado, polo que a redea non
cambiou o motor `revalidar`):

- **K12a** rc **11** `XEOMETRIA`: chamada lexítima fóra da ventá con vínculo
  coherente → o elo de xeometría segue existindo e dispara cando só el falla.
- **K12b** rc **7** `ALVO_DIVERXENTE`, elo `vinculo-chamada-rutina` FAIL con
  elos previos PASS → reproduce exactamente a fila de D: dous defectos reais,
  o vínculo gaña por **orde**, ambos motivos visibles no JSON.
- **K13a** rc **2** `ESQUEMA` co motivo preservado
  `vinculo-estrutural: o bus do operando da carga non e o fluxo`.
- **K13b** rc **6** `ARGUMENTO` cando a declaración é coherente e son os
  **bytes** os diverxentes → rc 6 continúa alcanzable: a recusa de TA-5 é só
  máis temperá.

Negativos reais C1–C7 **intactos e verdes** sobre a cadea declarada sonic-3082
(rc medidos: imaxe-trocada 3, bytes-sitio 5, alvo-mutado 7, argumento-mutado 6,
stream-truncada 10, mapper 4, oraculo-ausente 3). Verdicto: **diferenza de
prioridade de validación; detections sen perda**.

### 8.5 Paso 5: `alvo_desde_bytes` como defensa redundante mínima

Reencuadre aplicado en comentarios de `src/verify.rs` (`dobre-calculo` no
camiño de fallo, doc de `alvo_desde_bytes`) e no bullet §6: recálculo
aritmético coa **mesma gramática**, non un segundo entendemento independente da
ISA. A independencia fronte ao erro de interpretación é a do instrumento
pinado (§0) e a da cita primazia do PRM (§2). Comportamento non alterado.

### 8.6 Paso 6 (P7): as 9 cadeas reais — resultado honesto, gardas non relaxadas

A predición P7 («as 9 manteñen emparellamento único e JSONL byte-identico»)
**non se cumpriu como estaba escrita**: só **2/9** xanelas son rectas e únicas
baixo §5.3 + §7. Non se relaxou garda ningunha para salvar hashes (cláusula
§5 predición de risco). Medido, dobre pasada (§5 varredura + §5.6 declarado):

**Promovidas pola xanela (2/9)** — `vinculo-estrutural`, JSONL
**byte-idéntico á serie §6.3** (`cmp` IDENTICO): `sor-10636.xanela`
`ad3718aff65e507e066a3fb61052d1b1f372c13dd7f29c064810f16b61eda8ad` e
`sor-119B4.xanela` `7d4ed6e57da5ab4fbc6d380af24539852b4f0e73e2945bf69310d4ca5f0f691c`.

**Recusadas pola xanela (7/9)** — cada quince bytes desde `fin_carga`
(volcados con `medir-bytes`, reproducibles) e motivo rexistrado:

| cadea | xanela | bytes 16 B | motivo na cadea |
|---|---|---|---|
| sonic-3082 | `0x03088` | `43F900FF00006100E80C61003C7E6100` | `ventana-ambigua:3-candidatos` — bsr.w@0x308E (a declarada), bsr.w@0x3092, bsr.w@0x3096: tres chamadas reais no recto, ningunha elixible «porque si» |
| sonic-51BC | `0x051C2` | `43F894006100C6D470036100CF2E303C` | `ventana-ambigua:2-candidatos` — bsr.w@0x51C6 + bsr.w@0x51CC |
| sor-16D2 | `0x016D8` | `43F900FF80004EB9000085A270044EB9` | `ventana-ambigua:2-candidatos` — jsr.l@0x16DE (a declarada) + palabra `4EB9` en 0x16E6 |
| sor-08842 | `0x08848` | `43F900FF80004EB9000085A270024EBA` | `ventana-ambigua:2-candidatos` — jsr.l@0x884E + jsr.pcd16@0x8856 |
| sonic-1364 | `0x0136A` | `43F900A000006100052A33FC000000A1` | `tramo-non-modelado:3-palabras` (§7.2) — `33FC` movem + operands; a palabra probe podería caer dentro del |
| sor-087FC | `0x08802` | `43F900FF70004EB9000085A27E3123FC` | `tramo-non-modelado:2-palabras` — `7E31` moveq, `23FC` |
| sor-10852 | `0x10858` | `43F900FF70004EB9000085A25578FF00` | `tramo-non-modelado:2-palabras` — `5578` subq.w, `FF00` |

As 7 cadenas recusadas quedan como serie nova `referencia-estatica`
(xanelas `2438177711ed765e…`, `2a31da7efaabe0cc…`, `50cb30e0c0eb967f…`,
`be89a1e7b5251d4a…`, `3a2c3d7dc927c3ba…`, `600145c679505a8b…`,
`7d3f1b46fd7d4540…`; completos nos artefactos).

**Pasada declarada §5.6 (9/9)** — `--chamada-sitio` cos sitios históricos de
§6.3: todas `vinculo-estrutural` + `par-declarado`, todas `revalidar rc=0`,
todas rutina co hash-pin `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90`
(160 B). Serie nova datada (a histórica §6.3 consérvase intacta), sha256 do
rexistro promotor:

| cadea | chamada declarada | sha256 da cadea |
|---|---|---|
| sonic-3082 | `0x0308E` | `7d8f9d57c1962836cc9833af9415128bc8fafe7d5761d3e0b2c71c17b74bfa91` |
| sonic-1364 | `0x01370` | `6b41ef5fee177097ab030951dd4a27bf2bbc92689f147f41f381af51299eea0a` |
| sonic-51BC | `0x051C6` | `863bd833fbea6dcddfb7d20748949c300112051310668e2fd22c3e4027cf3b56` |
| sor-16D2 | `0x016DE` | `2ba860227b551727c8e0e802eef3e5b69674222bf06eb8259b2147a8ecf8b7d5` |
| sor-087FC | `0x08808` | `27d90c82d94395fbdfa3b53467b99f24660d7b5d00a895f5be0214c907b27692` |
| sor-08842 | `0x0884E` | `059495f29d6fe24aaa7b028c1e2a40f24de6df7b697b19833ddc985f34b16426` |
| sor-10636 | `0x10642` | `ef8d2f3411781320def23b9dc907eee5655b99458b68f937a8fc223ae0630104` |
| sor-10852 | `0x1085E` | `d1e976a47e64dfd8224ecaa7c4ae6a52d5f9cac2bc8a11993a3d5da8f9f1aefa` |
| sor-119B4 | `0x119C0` | `f33a4118fc4ff4eedb52c7c6a0835242cea0ab9f26b108808982c0c835f7b056` |

K20/K20b (sintéticas) pinan ademais o comportamento das gardas que P7 expuxo:
tramo con palabras non modeladas **non promove** e a declaración explícita si
resolve; operandos de formas modeladas (`bsr.w`/`jsr.l`) **non contan** como
non modeladas (§7.2 só fala de formas sen lonxitude coñecida).

### 8.7 P8: mostra reservada Phelios

Contedor pin `67e09944a0ec6da02d7a32ebfac4f0664dd8ff8086493bbe7e4218decf8b9faf`,
membro extraído `842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6`
(CRC-32 verificado). A cadea emitida é **byte-idéntica ao baseline**
(`07e8c121181f022cc375b169d1b275cc501873415dc53b9831164ed97c42a694`, primeira
cadea varrida `0x00035A` `vinculo-estrutural`; a súa xanela é recta e única,
que é exactamente a condición §5.3/§7.1 de non cambio), `revalidar rc=0`
(rutina 160 B `25429193bf55394db0a7881f3e6ee50a385c1ffd9ea5594b7daf88914f55dd87`).
Resumo novo §5.7 medido (serie nova do resumo, datada):
`cargas=317 sen-parella=311 ambiguas=0 rexeitadas=5 emitidas=1`; as 5
rexeitadas son erros de fluxo reais (`referencia-invalida` en `0x2EA4`,
`0x5F134`, `0x5F0B4`, `0x147D4`, `0x5926`).

### 8.8 Diverxencia de notación rexistrada (non reescribe §1–§7)

§5.1/§5.5 deixan `<sitio>` xenérico. A expectativa que se escribiu antes de
medir usaba `@0x000106` (8 díxitos); o motor emite `{sitio:#06X}` — ancho
mínimo 6 **incluíndo** o prefixo — polo que un sitio sintético sae
`roto-bra@0x0106` e un sitio ≥ 16 bits sae sen pad extra (p. ex. `@0x10858`).
É diverxencia de **notación**, non de comportamento; os tests
(`tests/segmento.rs` K16/K16b/K17) fixáronse na forma medida e esta nota
rexístraa. O texto conxelado non se toca.

### 8.9 Paso 7: consumo do resultado corrigido de C — dependencia externa documentada

As correccións de C (`f033b3b` extensión de signo abs.W + export v2,
`e828e72` MOVEA/DBcc, `2a0dd29` retificación) existen só no worktree local
`RDS-REX-PARALLEL-C-2026-10-04`; `origin/codex/rex-parallel-c-cfg` segue en
`8ea5821` (PR #108 OPEN). Política: non se consume WIP local alleo nin se
inventa resultado. A comprobación cruzada queda **aberta por SHA exacto**:
cando C publique, re-mídese o vínculo C→A sobre o export v2 (a recordatorio
do contrato: inicio de instrución e alcance local **non proban por si sós** o
argumento pasado á rutina — ese elo segue sendo `par-declarado`/ventá
heurística neste lado).

### 8.10 Acceptance check (contrato conxelado)

- Corrección preservada: §8.2, suite final 89/89 (`1925f70b…`).
- Recusas demostradas: §8.4 (K12/K13 + C1–C7) e §8.6 (7 recusas reais con
  auditoría de bytes).
- Confianza compatíbel co vínculo probado: ningunha cadea con xanela dubidosa
  ou non modelada clamouse estrutural pola varredura; as 9 reais levan
  `par-declarado` coa súa epistemoloxía separada.
- Non ampliado a descuberta universal: gardas = vocabulario pechado §5.1;
  límites declarados en cada rexistro.
