# CONTROLES-ADULTERACION-A — pasos 7–9 da misión (expectativas conxeladas ANTES de implementar)

Data: 2026-10-04. HEAD do conxelado: `95137ce`. Misión: *"Acrescente
controles que adulterem opcode, extensión, sítio, destino, identidade e
vínculo da chamada, demonstrando a rejeição"* (paso 9), *"CLI reproduzível con
resultado estruturado e motivos estáveis de recusa"* (paso 8) e *"un root
declarado polo usuario continua sendo root local"* (paso 7).

Harness: imaxe sintética autoral de 64 KiB (a mesma de `tests/verify.rs`:
`lea.l $200,A0` @0x100 → `bsr.w $600` @0x108 → `lea.l $A00000,A1` @0x110,
fluxo Kosinski @0x200, rutina @0x600). Ningún byte comercial.

## 1. Táboa de clases e códigos esperados

| # | Clase (misión) | Adulteración (UN aspecto) | Esperado |
|---|---|---|---|
| K1 | identidade | `imaxe_sha256` de cadea boa con imaxe B | rc=3 ROM_DIVERXENCIA (xa coberto: `imaxe_equivocada…` + E2E §6-C1) |
| K2 | sítio | bytes declarados da carga ≠ imaxe | rc=5 SITIO (xa: `bytes_alterados…` + C2) |
| K3 | extensión | operando longo da carga declarado +1 con fluxo coherente | rc=6 ARGUMENTO (xa: `argumento_fonte…` + C4) |
| K4 | **opcode** | mesma chamada declarada cos bytes `60 00 04 F6` (bra.w) no sitio do `61 00` real | rc=5, elo `sitio-chamada` FAIL (control NOVO) |
| K5 | **opcode-forma** | bytes reais, `chamada_forma` mentiresa `"jmp.l"` | rc=7, elo `forma-chamada` (control NOVO) |
| K6 | **extensión-recusa** | imaxe con `61 FF 00 00 12 34` no sitio; cadea declara eses bytes exactos | rc=5, elo `sitio-chamada` FAIL cun detalle que conten **literal** `68020-non-declarado` (motivo estable de recusa visible no resultado estruturado — paso 8) (control NOVO) |
| K7 | **destino** (bytes) | `destino_bytes` declarados cun bit trocado | rc=5, elo `sitio-destino` (control NOVO) |
| K8 | **destino** (extensión) | `destino_operando` declarado 0xA00004 (imaxe: 0xA00000) | rc=6, elo `argumento-destino` (control NOVO) |
| K9 | **destino** (rexión) | `destino_rexion` mentiresa `"rom"` | rc=14 REXION_DIVERXENTE, elo `rexion-destino` (control NOVO) |
| K10 | vínculo da chamada | mover o `bsr.w` na IMAXE a `0x61 00 04 E6` (@0x108, apunta 0x5F0) e declarar bytes+alvo coherentes (0x5F0), mantendo `rutina_sitio=0x600` co seu hash real | **REXUITADA rc=7, elo `vinculo-chamada-rutina` FAIL** (control NOVO; ver §2) |
| K11 | vínculo E2E | equivalente na Sonic real: `chamada_alvo` movido a 0x189E mantendo bytes reais | rc=7 ALVO (aritmética detén primeiro; **non** reetiquetado a 2 — ver §2.3) (xa C3) |

## 2. Defecto estrutural que K10 expón (declarado ANTES de corrixir)

Hoxe, `revalidar` non exige que a **rutina afirmada estea no alvo calculado
da chamada**. Unha cadea pode declarar chamada→0x5F0 (bytes e aritmética
coherentes) e rutina→0x600 co hash real deses bytes: **todos os elos pasan e
rc=0**. Iso é exactamente o "vínculo da chamada" que a misión pide
adulterar e ver rexeitado — polo que o control estaba imposíbel.

Corrección prevista (capa de medición, non ISA): elo
`vinculo-chamada-rutina` xusto despois de `alvo-chamada`: se hai rutina
declarada, `rutina_sitio == calculado & BARRAMENTO` (modelo de tres niveis
de RECTIFICACION §2: o elo de rutina vive no BUS). Fallo ⇒ rc=7
(ALVO_DIVERXENTE, familia do vínculo).

1. As 9 cadeas reais cumpren a regra por construción (alvo ==
   rutina_sitio en todas; verificado nos JSONL v1.1) ⇒ `revalidar` segue
   rc=0 e o JSONL non cambia de bytes ⇒ os pins §6.1 do cruzamento rex-cfg
   manteñense.
2. `chain::validar` NON se modifica: a regra compara contra o alvo
   **calculado** (medida), non contra o **declarado**; rexeitar na
   estructura retrotraería K11/C3 (alvo declarado mutado) a rc=2 ESQUEMA,
   mudando un código conxelado en §6 — prohibido pola regra de non mover
   limiares. A detención queda na capa que mide, como en K11.
3. `tests/verify.rs::alvo_de_chamada_alterado` mantense tal cal: declarada
   alvo 0x700 con bytes reais→0x600, a aritmética detén antes que o vínculo
   (rc=7). Non se toca ningún test conxelado.

## 3. Paso 7 (root local) e paso 8 (CLI estruturada) — predicións

- `construir-cadea` desde sitio declarado: JSONL con
  `orixe` que conten `carga_sitio=declarado-probado`, **sen**
  `descoberto` ningún, `confianza="vinculo-estrutural"`, limitacions
  `sen-execucion`. `detectar` é a única ruta que emite
  `descoberto-por-varredura`. (A6/A9 xa o mediran en ROM; aqui pinase na
  CLI cun fixture autoral.)
- Ningunha saída da ferramenta pode conter `observado-en-runtime` nin
  afirmación de alcance dende o boot: a palabra do vocabulario está
  pechada e `validar` a recusa (test existente ampliado na CLI).
- Resultado estruturado: `rex-chain revalidar codigo=N` + resumo
  `nome=estado(detalle)` por elo; **dúas execucións sobre a mesma parella
  imaxe+cadea producen stdout idéntico byte a byte** (reproducibilidade
  medida, non afirmada).

## 4. Semáforo esperado no HEAD `95137ce` (escrito antes de executar)

- K10 **vermello** (rc=0 obtido — o control non existe): é o defecto que a
  corrección pecha; documéntase aquí e no commit de tests.
- K4–K9: agárdase **verde xa co código actual** (as clases detéñanse; o que
  achega este paso é o PIN no suite con nome estable de elo/código/motivo).
- §3: agárdase verde co código actual (pinna comportamento existente na
  CLI, que hasta agora só estaba medido en ROM via E2E).
- Tras a corrección: 100 % verde sen tocar ningún test conxelado.
