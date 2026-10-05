# INVENTARIO-CONGELADO — rolda do integrador 2026-10-05 (Sonic #103→#104 + inspeção de consumidores)

Congelado ANTES de calquera medición ou cambio de produto. Autor: integrador
(único responsable das superficies compartidas nesta rolda). Ordem recibida:
"consolidar Sonic #103→#104 e preparar unha inspeção rastreável de consumidores
e recursos, usando apenas pesquisas aprovadas".

## 1. Orixe, destino e dependências (verificados con comando fresco 2026-10-05)

- Canónico `~/Projects/RetroDevStudio-CANONICAL-2026-09-21`: checkout en
  `codex/rex-mugen-locomotion @ b53ce7a`. **Non é o tronco desta rolda**;
  o checkout canónico non se cambia.
- Linhagem real (ancestralidade conferida por `git merge-base --is-ancestor`):
  `codex/rex-integrator-crates-registry @ 0194f94` → PR #98
  `codex/rex-integrator-consolidation @ 0ef540e` → PR #103
  `codex/rex-sonic-consolidacao @ 5340002` → PR #104
  `codex/rex-sonic-sequencia` (proba en `491c21b`, gates+CI en `e43ac1e`,
  handoff en `3a967ce`). `origin/main` está ~555 commits atrás do corpo REX
  (non-mergeado); base `main` faría o diff irrevisable — **non usar**.
- **Destino da rolda:** rama de integración `codex/rex-integrator-sonic-103104`
  en worktree exclusiva `~/Projects/REX-INTEGRATION-2026-10-05`, creada POR
  FAST-FORWARD desde `3a967ce` (cabeza de #104) — histórico lineal preservado,
  **sen rebase de sequencia** (breakería #105–#108), sen merge remoto, sen
  release, sen promoción de maturidade.
- Base histórica da rolda de investigación: `cb56657` (dentro da historia de
  #104; merge-base EXACTO dos catre frentes, medido).

## 2. Frentes de investigación (identificadas POR BRANCH, non por suposición)

| Letra | Branch | Head | PR (buscada por rama) | Freante a sequencia | Territorio |
|---|---|---|---|---|---|
| A | `codex/rex-parallel-a-kosinski-chains` | `bd40e92` | **#107** | 14 commits | `scripts|docs|data/rex_profiles/parallel_recovery_20261004/a/` |
| B | `codex/parallel-recovery-20261004-b` | `08024d9` | **#105** | 11 commits | idem `.../b/` |
| C | `codex/rex-parallel-c-cfg` | `8ea5821` | **#108** | 15 commits | idem `.../c/` |
| D | `codex/rex-parallel-d-eval-bench` | `afdce00` | **#106** | 11 commits | idem `.../d/` |

Worktrees (non tocar; só lectura): A `~/RDS-REX-PARALLEL-A-2026-10-04`,
B `~/RDS-PARALLEL-RECOVERY-20261004-B`, C `~/RDS-REX-PARALLEL-C-2026-10-04`,
D `~/Projects/REX-PARALLEL-D-2026-10-04`.

## 3. Artefactos consumibles polas capacidades UTILIZADAS (schemas exactos)

- **B**: `data/.../b/evidencia/export-camadas-b2.json` (schema
  `rex-parallel-b/camadas/1`: `camada_codec/interpretacao/projecao/consumidor/
  cadeia_id` + `veredito` + `meta_integrador_antireuso`); `negativos.json` (7
  recusas incl. `geometria-errada`); `cram-b3.json`; scripts Python de verificación
  (`verificar-cadeia.py --modo verificado`, `test-contrato-b.py::test_cadeia_completa`).
  Escada medida: codec Enigma = referencia estática + paridade (6 planas 4096 B
  vs SHA de review-pr97); táboa→sítio→destino→parámetros = vínculo estrutural
  (37 sítios byte-verified, cadea `0x1B6C4`→`jsr $171E`, WRAM `$FF4000`,
  `value_offset=0`); grade 64×64 de IDs 1-byte e projeção stride-128 =
  semántica recuperada estática; **arte/paleta/composición visual = NON
  PROBADO**; consumo observado = NON PROBADO; `Nem_SSWalls` queda estrutural
  (NemDec sen pin). PROPOSTA-INTEGRACAO P-1: produto pode fixar o parámetro
  Enigma `value_offset=0` con orixe `consumer-proven` **só para o parámetro**;
  P-2: os `sonic1-mapa-*.json` antigos quedan SUPERSEDADOS (célula = 1 byte,
  64×64, sen campos por célula); a acceptance `nametable-64x32` sen consumidor
  VDP probado é o falso líder que debe refusarse.
- **C**: crate Rust `rex-cfg` vive en territorio de investigación
  (`scripts/.../c/`), path-dep somente-leitura sobre `crates/rex-gameplay`;
  interfaces exportables: `rex-cfg-sitio/v1` (vereditos `instrucao-de-bloco`/
  `miolo-de-instrucao`, campos `consumidor-validado`,
  `promovivel-vinculo-estrutural`, `motivos`) e `rex-cfg-med/v1`
  (`agregado:"proibido"`). 16/16 iscas non promovibles (12 declaran
  `consumidor-validado:"sim"`) — o eixo que discrimina é a promoción, non a
  flag. Product só pode consumir **o formato do export** cun contrato explícito
  e testes na capacidade usada; o crate queda na fronte C ata o integrador o
  autorizar.
- **D**: runner `rds-d-export/1` fail-closed + contedor `RDSDBNCH` v1;
  medicións das frentes en `data/.../d/medidas/*.jsonl` + `matriz.md`.
  Escada `candidate→static_ref→structural→observed→recovered→proved`.
- **A**: **BLOQUEADA** — D mediu regresión `28/29 → 21/29` en `bd40e92`
  (`A-cbb6895` vs `A-bd40e92`; conxectura `abs.W` sign-vs-zero extend).
  C revisou A (`REVISAO-C-DE-A.md`, reexecución 4× OK serie idéntica), pero a
  orde do operador é explícita: **non conectar o reconhecedor de A ao produto
  ata correção + revisión de C + avaliação de D sobre a versión corrigida**.
  Ningún consumo de produto dos exports `rex-kosinski-chain/v1` nesta rolda.

## 4. Divergencias entre decoders — arbitraxe por referencia e medición (sen terceira implementación)

- Enigma (B vs modelo antigo PR #97): árbitro = decoder externo pinado
  `a9ed92f9…` (== `decoder_script_sha256` de review-pr97) + s1disasm
  `064e3c68…` + Genesis Plus GX; a interpretación antiga (nametable 64×32/VDP)
  **superseded**, non parcheada.
- Kosinski (produto `crates/rex-kosinski` vs oráculo externo): árbitro =
  `koscmp` (mdcomp `72c6df40…`) via `scripts/rex_profiles/codecs/kosinski/kos_mirror.py`;
  diverxencia coñecida e declarada: byte de padding +1.
- Nemesis: `NemDec` **sen pin** → ningún recurso Nemesis pode presentarse como
  "decodificado" na inspeção desta rolda; queda `descoñecido` con motivo.
- Desmontaxe 68000 (A vs C): árbitro `m68k-elf-objdump` binutils 2.41
  (instrumento SHA `e3a404cc…`) + cruzamento con `rex-gameplay::m68k::decode`;
  erros de táboa de opcodes de A (`4EFC/4EFD`) refutados por medición.

## 5. Evidencia: nova vs herdada

- **Herdada (xustificada, re-hash conferido no handoff):** xornada §5.2
  42/42 no binario `e243d1ad…` (HEAD `491c21b`); `e43ac1e` só mudou estilo
  (clippy/rustfmt) con `cargo test --lib` 860/0/84 reexecutado; CI 6/6 en
  `e43ac1e` (log `~/rds-scratch/ci-e43ac1e-rollup.log`) e en #103. Pins BYOR:
  ROM `c7da53a1…1ebb` en `~/RDS-REX-CORPUS-E/.staging/`, Xvfb `5bfd315a…`.
- **Nova desta rolda (a xerar):** inspeção de consumidores (testes Rust +
  negativos), xornada `sonic-sequencia-journey` reexecutada **no binario do
  tip final** (matriz §8 do handoff: mínimo honesto `build:portable` + 1
  carreira do escenario), gates do destino, e as súas evidencias en
  `data/rex_profiles/integration_20261005/` con SHA por arquivo.
- Política BYOR: nin ROM, nin derivados, nin capturas da ROM comercial entran
  no índice; só SHA-256 e referencias.

## 6. Reserva de xanela pesada (Integrador-2)

O integrador reserva a xanela exclusiva de jobs pesados (build:portable,
cargo test/clippy, xornadas desktop/E2E, host:certify) desde 2026-10-05 ata o
fin da rolda. Verificado con `ps` ao inicio: ningún job alleo en execución.
A/B/C/D permanecen isolados: **non lanzan jobs pesados mentres a reserva estea
activa**; CI só por consulta pontual, rollup terminal do SHA pinado, sen
monitores.

## 7. Disciplina de expectativas

O contrato e as expectations da inspeção (`EXPECTATIONS-INSP-2026-10-05.md`, a
conxelar sóiño ANTES de implementar/medir, precedente `b837986`/`7331888`)
gobernan a entrega visível. Desvio = FAIL honesto ou INCONCLUSIVE coa serie
bruta; nunca reescritura posterior nin limiares movidos para acomodar.

## 8. Superficies do produto que esta rolda pode tocar (reservadas ao integrador)

- `src-tauri/src/tools/reverse/decomp/` (comando somente-leitura novo da
  inspeção + orixe do parámetro Enigma P-1), rexistro IPC en `lib.rs`,
  `src/core/ipc/toolsService.ts`, `src/components/tools/InspectionPanel.tsx`.
- Harness E2E principal (`scripts/e2e-tauri-build-run.mjs`) só para o escenario
  novo/afectado.
- Docs de estado: `docs/rex_profiles/ROUND_STATE.md`,
  `docs/06_AI_MEMORY_BANK.md`, `crates/registry.json` (se algún degrau se
  rexistra; **ningún se promove automaticamente**).
- **Non** toca: edición Sonic existente (mantense funcional; matrix §8 do
  handoff reexecutada), MUGEN, Kosinski-encode, xogabilidade.
