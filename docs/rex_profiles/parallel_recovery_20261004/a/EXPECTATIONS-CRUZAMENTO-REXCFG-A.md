# EXPECTATIONS-CRUZAMENTO-REXCFG-A — verificación do sítio con `rex-cfg/v1` (frente C)

Data: 2026-10-04. Misión letras, paso 6: *"Consuma rex-cfg/v1 da frente C como
verificação adicional do sítio: início de instrução, interior, fronteira, não
alcançado ou fora da região. Não copie o decoder de C."*

Este ficheiro conxélase **antes** de executar o cruzamento das 10 cadeas
(regra da fronte: expectativas preceden a medição; desvio = FAIL/INCONCLUSIVE
con serie bruta, nunca reescrita posterior).

## 0. O que se consume e de onde

- Esquema consumido: `rex-cfg/v1` (CONTRACT da fronte C §4), export byte a
  byte determinístico. Nada do decoder de C se copia: A **executa a CLI de C
  como ferramenta externa** e consome só `sitios[].veredito`, `fronteiras[]`,
  `cobertura.vaos[]` e `raizes[]`.
- Fonte: commit **exacto `275f2af0b81944709169ab360a67786e56ec4a13`** = HEAD
  de PR #108 (OPEN, sen merge). Extracción `git archive` a
  `~/rds-scratch/rexcfg-275f2af/` (xunto con `crates/rex-gameplay`, deps por
  path, cero deps externas). O worktree local de C **non se toca** (ten WIP
  allea: `M src/lib.rs`, `M src/main.rs`, `?? src/sitio.rs`, `??
  tests/consultar.rs` — eses cambios NON están no commit consumido).
- Bin construído por A: `rex-cfg` debug, sha
  `7daeb51d151f54cc29843d352fcb69ccf5d0406dbbed5c90dd2e6da81094a927`.
  Obxecto analizado: `--bin` = imaxe pinada (§ pins de INFORME-A §6) ou, para
  Phelios, o membro extraído `842951c2c710cf691a56107934d9b7e495f1519948ffe982ea0ebb68f19298f6`.
- Raíz declarada por A: `--root-prov referencia-estatica` con
  `--root-evidence rex-kosinski-chain/v1:<hash da cadea>` — o sítio é cita
  estática da propia cadea de A, non descuberta de C.

## 1. Calibración previa do instrumento (feita antes de conxelar, declarada)

Unha única execación de sondaxe (interface, non medición) sobre sonic-3082:
rexión `0x03082:0x03092`, sitios `carga, +2, destino, chamada, 0x189C` ⇒
`[instrucao-de-bloco, miolo-de-instrucao, instrucao-de-bloco,
instrucao-de-bloco, fora-da-regiao]`, `fronteiras=[{tipo:limite-de-regiao}]`,
`cobertura=16/16`. Isto fixa a semántica esperada de vereditos; as
predicións de §2-§4 aplícanse ás 10 cadeas **sen sonda previa individual**.

## 2. Ventás e sitios (derivados dos JSONL v1.1, non da sonda)

Para cada cadea: `ini = carga_sitio`, `fim = chamada_sitio + lon(chamada)`
(lon = `len(chamada_bytes)/2`). Os elos de Sonic/SoR son **contíguos**:
`destino_sitio == carga_sitio+6` e `chamada_sitio == destino_sitio+lon(destino)`
(verificado elo a elo nos JSONL de `xe-a-evidencia-v11`; Phelios non ten
elo de destino). A ventá é exactamente os 14/16 bytes dos tres elos;
rutina fórase sempre.

| Cadea | Obxecto | Ventá | Sitios consultados |
|---|---|---|---|
| sonic-3082 | Sonic 1 `c7da53a1…` | `0x03082:0x03092` | `0x3082,0x3084,0x3088,0x308A,0x308E,0x3090,0x189C` |
| sonic-1364 | Sonic 1 | `0x01364:0x01374` | `0x1364,0x1366,0x136A,0x136C,0x1370,0x1372,0x189C` |
| sonic-51BC | Sonic 1 | `0x051BC:0x051CA` | `0x51BC,0x51BE,0x51C2,0x51C4,0x51C6,0x51C8,0x189C` |
| sor-16D2 | SoR `304f56ba…` | `0x016D2:0x016E4` | `0x16D2,0x16D4,0x16D8,0x16DA,0x16DE,0x16E0,0x85A2` |
| sor-087FC | SoR | `0x087FC:0x0880E` | `0x87FC,0x87FE,0x8802,0x8804,0x8808,0x880A,0x85A2` |
| sor-08842 | SoR | `0x08842:0x08854` | `0x8842,0x8844,0x8848,0x884A,0x884E,0x8850,0x85A2` |
| sor-10636 | SoR | `0x10636:0x10648` | `0x10636,0x10638,0x1063C,0x1063E,0x10642,0x10644,0x85A2` |
| sor-10852 | SoR | `0x10852:0x10864` | `0x10852,0x10854,0x10858,0x1085A,0x1085E,0x10860,0x85A2` |
| sor-119B4 | SoR | `0x119B4:0x119C6` | `0x119B4,0x119B6,0x119BA,0x119BC,0x119C0,0x119C2,0x85A2` |
| phelios-35A | membro Phelios `842951c2…` | `0x0035A:0x00366` | `0x35A,0x35C,0x360,0x362,0x6FDF2` |

## 3. Predicións conxeladas (68 asercións = 9×7 + 5)

Por cadea de Sonic/SoR (7 sitios, nesta orde):

1. `carga_sitio` (lea.l, raíz declarada) ⇒ **`instrucao-de-bloco`**
2. `carga_sitio + 2` (miolo da longword do operando de `lea.l`) ⇒ **`miolo-de-instrucao`**
3. `destino_sitio` (segunda `lea`) ⇒ **`instrucao-de-bloco`**
4. `destino_sitio + 2` ⇒ **`miolo-de-instrucao`**
5. `chamada_sitio` (`bsr.w`/`jsr.l`) ⇒ **`instrucao-de-bloco`**
6. `chamada_sitio + 2` (desprazamento/alvo declarados) ⇒ **`miolo-de-instrucao`**
7. `rutina_sitio` ⇒ **`fora-da-regiao`** (ningunha ventá a inclúe; C
   decora a pregunta como fóra da rexión que A declarou — §6 do CONTRACT de
   C: isto **non** nega existencia de código aí)

Phelios (5 sitios, sen elo destino): 1 `instrucao-de-bloco`, 2
`miolo-de-instrucao`, 3 `instrucao-de-bloco`, 4 `miolo-de-instrucao`, 5
`fora-da-regiao`.

Fundamento (independente da sonda de §1): os bytes de cada elo están medidos
por A contra a imaxe pinada (revalidación rc=0, elos byte a byte); `lea.l` =
6 B, `lea.w` = 4 B, `bsr.w` = 4 B, `jsr.l` = 6 B (táboa v1.1 de
RECTIFICACION-A §3, instrumento pinado); contigüidade verificada nos JSONL.
Polo tanto `+2` cae **sempre dentro** da instrución declarada e as
direccións de elo caen **sempre no límite inferior** dunha instrución do
fluxo desde a raíz.

## 4. Predicións estruturais do export

- `cobertura.vaos == []` (a ventá é exactamente carga+destino+chamada
  contiguas, todas no subconxunto de C; cobertura = 100 %).
- `fronteiras[]` de Sonic/SoR: un único `{tipo: "limite-de-regiao",
  endereco == chamada_sitio, motivo: "chamada aponta para 0x…, fora da
  regiao…"}` — a chamada sempre apunta á rutina fóra da ventá.
- `raizes[] == [{endereco: carga_sitio, proveniencia:
  "referencia-estatica", evidencia: "rex-kosinski-chain/v1:<sha da cadea>"}]`.
- Veredito esperado en **ningún** sitio: `ponto-de-fronteira` nin
  `dentro-regiao-nao-alcancado` (ningunha ventá os contén por construción:
  non hai opcode fóra do subconxunto dentro da ventá, e todo byte da ventá é
  alcanzado en fluxo lineal desde a raíz).

## 5. Negativo de identidade (discriminante, NON vago)

Crunzamento adicional en sonic-3082 coa **imaxe trocada** (SoR no lugar de
Sonic, mesma ventá/sitios): rexistro rexeitado **antes** da análise con erro
de identidade do obxecto (rc≠0), porque a CLI de C declara `objeto.sha256` e
A exige o pin da cadea. Se rexistrase calquera veredito (ex.
`fora-da-regiao` xenérico), a aserción A-NEG falla e rexístrase coa serie
bruta — non se reetiqueta.

## 6. Como se le o resultado

- `fallos=0` ⇒ as 68 + 4 (estruturais) + 1 (negativo) cumpren. Calquera
  desvío: FAIL documentado no AUDITORIA-A c.a serie bruta do export; o
  veredito de C **non** retroactúa sobre o nivel de evidencia das cadeas de
  A (`vinculo-estrutural` mantense: A mide bytes e aritmética; C mide fluxo
  nunha rexión declarada — §1 de PROPOSTA-FRENTE-A: *pertencer a un fluxo ≠
  existir consumo*).
- Ningún número de C se promove a `observado-en-runtime`; ningunha rexión se
  declara dende o boot; root declarado segue sendo root local
  (`referencia-estatica` é a probreza máxima aquí).
