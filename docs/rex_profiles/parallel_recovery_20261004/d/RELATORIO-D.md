# RELATORIO-D — barra de avaliacao da recuperacao paralela (letra D)

**Data:** 2026-10-04. **Base fixada:** `cb56657a142df40d2acd09a3e03e54247f066dea`
(`codex/rex-sonic-sequencia`, local = `origin`; confirmado antes de iniciar).
**Worktree/branch:** `~/Projects/REX-PARALLEL-D-2026-10-04` @ `codex/rex-parallel-d-eval-bench`.
**Host:** `READY`, fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`,
lock `dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377`.
**Drift registrado:** o workspace canônico estava em `b53ce7a` (frente MUGEN); a
base da rodada NÃO foi acompanhada — a diferença foi apenas registrada, como manda a missão.

## 1. Entrega (o que existe, por onde conferir)

| Artefato | Caminho | Identidade |
|---|---|---|
| Expectativas congeladas (commit-so da etapa) | `docs/.../d/EXPECTATIONS-D.md` | commit `a90b5c2`, anterior a qualquer execução |
| Implementação da barra | `scripts/.../d/*.mjs` + dados | commit `1081f36` |
| Lib do benchmark (contêiner + codecs) | `scripts/.../d/lib_bench.mjs` | código versionado |
| Autor dos fixtures | `scripts/.../d/bench_author.mjs` | determinístico |
| Runner fail-closed | `scripts/.../d/runner.mjs` | `rds-d-export/1`, D1–D7 + N1/N2 |
| Controles de mutação | `scripts/.../d/mutations.mjs` | M1–M6 + X1–X5 |
| CLI reproduzível | `scripts/.../d/cli.mjs` | author/score/selftest/verify-kosinski/check-seal/byor-inventory |
| Testes discriminantes | `scripts/.../d/runner.test.mjs` | 19 testes, todos verdes (vitest) |
| Fixture pública dev-1 | `data/.../d/dev/fixture.bin` | SHA-256 `ba08a8c37dbc98be1f9a82ff479c21c238d750f1f890f8ca6fee7f9f0d67826f` (1236 b) |
| Gabarito dev-1 | `data/.../d/dev/ground-truth.json` | SHA-256 `c894f46b89133bb26f7c65fdfb38decad2ca5f7d40267b899546451faa19133b` |
| Selos dev-1 | `data/.../d/dev/seal.json` | semente + SHA do fixture + denominadores |
| Pin do conjunto reservado | `data/.../d/ho-1/pin.json` | fixture `fd7d22f2e7a26c3f90d340bf353614df45a4101c5811c18413cca4d8dc8433ee` (2046 b); **respostas fora da árvore** (`~/rds-scratch/rex-parallel-d-heldout/ho-1/`, não commitadas) |
| Evidência do selftest | `data/.../d/selftest/latest.txt` | matriz completa OK, exit 0 |
| Inventário BYOR (somente metadados) | `data/.../d/byor/inventory.json` | SHA-256 `f00aeb65921eaacbeb1f666ed60a46bf56201b05469ea02ab4c354bd5fa54540`; 81 arquivos (megadrive, megadrivejp, genesis, genesiswide); 80 contêineres zip com identidade de membro (nome/tamanho/CRC32); nenhum byte copiado para a árvore; corpus não modificado |

Contratos: `CONTRACT-BENCHMARK-D.md` (contêiner/codecs/conjuntos) e
`CONTRACT-EXPORT-D.md` (formato `rds-d-export/1` + regras fail-closed).

## 2. O que foi provado, com separação honesta de linhas de evidência

1. **Denominadores congelados × gerador**: dev-1 (9/6/6/2/2/9/10/3/6) e ho-1
   (12/8/8/3/3/13/14/4/9) batem exatamente com EXPECTATIONS §3–§5 — medido por
   `selftest` e pinado por 19 testes do vitest.
2. **Export ideal PASS** nos dois conjuntos (o instrumento aceita a verdade
   dele) e **cada mutação M1–M6 reprovada** nas dimensões esperadas;
   **X1–X5** tratados sem transformar ausência em PASS (export vazio = FAIL
   cobertura zero em cada dimensão; dimensão omitida = INCONCLUSIVE; SHA errado
   = INCONCLUSIVE global; promoção sem prova = rebaixamento `unknown_sem_prova`).
3. **Kosinski cruzado com instrumento externo**: as duas streams kosinski do
   dev-1 foram decodificadas por `scripts/rex_profiles/codecs/kosinski/kos_mirror.py`
   (espelho mdcomp, família B) em modo strict; saídas conferem byte a byte com o
   gabarito autoral: R-S5 `5c55c8f4db4010ba9203d83536d0609856af8c847ac039e37e7dde8fbd574b61`
   (448 b) e R-K3 `6eb69e26de2a26eda48af77d4cec893aa0cf4748a64cbefcfe11a22c1e680ad9`
   (224 b). **Dependência declarada:** o espelho é derivado da mesma fonte
   pública (mdcomp) — é cruzamento entre linhas D e B, não oráculo independente
   de mdcomp; a limitação do cabeçalho dele é herdada aqui.
4. **Round-trip interno dsb1-\***: 9/9 OK — **não conta como prova** (autoria e
   build na mesma linha de evidência, como declarado no congelamento).

## 3. Defeitos encontrados e corrigidos NA MINHA barra (antes de medir qualquer entrega alheia)

- **D-1 (runner):** cada dimensão nascia com `ausentes = denominador` e nada
  decrementava ao encontrar o item — o export ideal virava FAIL falso. Achado
  pela primeira execução do selftest. Corrigido (inicialização `fresh`); o
  comportamento oposto (ausência real ainda vira `ausentes`) está testado.
- **D-2 (autor):** os dois blocos de tile de mesmo comprimento em bytes
  produziam composição idêntica ⇒ a mutação M4 (geometria trocada) era
  indetectável em D5. Achado pela matriz de mutação. Corrigido: o conteúdo
  composto agora depende da geometria declarada; M4 pega D4, D5 e D7.
- **D-3 (runner vs. expectativa §7):** export `regions: []` produzia
  INCONCLUSIVE em D2–D6 em vez do FAIL com cobertura zero congelado; adicionado
  o caso explícito. Nenhum número de EXPECTATIONS-D foi reescrito — os três
  reparos são no instrumento, e as asserções congeladas passaram depois deles.

## 4. Avaliação das entregas A/B/C

Medido em 2026-10-04 (git no canônico após fetch):
`codex/rex-parallel-a-kosinski-chains` e `codex/rex-parallel-c-cfg` estão em
`cb56657` com zero commits próprios; a frente B da rodada não criou branch.
**Logo: não existe export A/B/C desta rodada para medir — a barra está
congelada, selada e operacional, aguardando entrega por SHA.** Quando existir:

```
node scripts/rex_profiles/parallel_recovery_20261004/d/cli.mjs score \
  --truth data/rex_profiles/parallel_recovery_20261004/d/dev/ground-truth.json \
  --export <export-rds-d-export-1.json>
```

Se encontrar falha: veredito preservado, nova exportação pedida por SHA,
re-avaliação; a referência não é reescrita para acomodar implementação.
Avaliação pesada de entregas **anteriores** (ex.: rodar o `rex-kosinski` real
contra as streams do benchmark via export conversível) depende de compilação
Rust — tarefa pesada não coordenada nesta sessão; fica pendente e declarada.

## 5. Limites desta barra (o que ela NÃO alega)

- fixtures autorais não representam ROM comercial alguma; BYOR só pinado por
  metadados; nomes de arquivo não viram hipótese de verdade.
- O contêiner é auto-descrito (diretório no cabeçalho): em dev-1 (público) uma
  ferramenta pode "colar" lendo o diretório; o que mede de verdade é o conjunto
  reservado ho-1 e os negativos (decoy/falso alvo), que o diretório NÃO marca.
- Mapeamento de confiança (`observed`/`recovered`) é declarado pela ferramenta;
  a barra só verifica prova anexada e indexada — não audita a origem da prova.
- Não mede tempo, memória nem PAL; mede correspondência com a verdade.
- D6/D7 não modelam fluxo além de `BRA.W` em tabelas declaradas; chamadas de
  função, pilha e desvios condicionais ficam fora.

## 6. Proposta de adaptação ao produto (para o integrador, sem editar território alheio)

- Local: `scripts/rex_profiles/` já versiona a barra; sugiro ao integrador um
  script npm `rex:barra-d:selftest` chamando `node
  scripts/rex_profiles/parallel_recovery_20261004/d/cli.mjs selftest` como gate
  de não regressão da barra, e `rex:barra-d:score` como wrapper do `score`.
  Teste esperado: os 19 testes deste PR já cobrem o contrato; o gate rodaria o
  selftest inteiro (exit 0).
- O formato `rds-d-export/1` pode ser o dialeto de exportação dos pipelines de
  reverse/codec do backend quando eles precisarem ser medidos; nenhuma mudança
  em `src-tauri/` é necessária agora.

## 7. Gates desta entrega

Rodados na worktree `codex/rex-parallel-d-eval-bench` em 2026-10-04:

- `npm run check:tree` — OK.
- `npm run lint` (`eslint src vite.config.ts --max-warnings=0`) — OK.
- `npx tsc --noEmit` — OK.
- `npm test` — **952 aprovados / 0 falhas / 6 ignorados** (101 arquivos; inclui
  os 19 testes novos da barra; linha de base sem eles: 933).
- `node --check` nos 5 módulos `.mjs` da frente — OK.
- Selftest da barra: exit 0, matriz M1–M6 + X1–X5 + denominadores + kosinski×
  espelho verdes (`data/.../d/selftest/latest.txt`).
- `node cli.mjs check-seal` — selos conferem.
- Gates Rust **não reexecutados**: a entrega não toca `src-tauri/`, `crates/`
  nem manifests/locks (território delimitado); precedentes (k)/(l) registram o
  mesmo critério.
- Host: `READY` (estado §topo); nenhuma mudança em build/emulação/toolchains,
  então `host:certify` não é gatilho desta entrega.

## 8. Próximo passo exato

Aguardar export `rds-d-export/1` por SHA das frentes A/B/C; medir dev-1; se
PASS, pedir export contra ho-1 (respostas ainda seladas), medir, e só então
executar o unseal commitando o gabarito reservado com a evidência.

## 9. Publicação (2026-10-04)

Branch `codex/rex-parallel-d-eval-bench` empurrada a `origin` em
fast-forward de `cb56657` (3 commits: `a90b5c2` congelamento, `1081f36`
implementação, `42c5a08e6f78881ee7aba6943654b7a00a843e63` contratos/relatório).
**PR #106** aberta (base `codex/rex-sonic-sequencia`, head
`42c5a08e…`, `isDraft=false`): <https://github.com/Misael-art/retro-dev-studio/pull/106>.
Sem merge, sem release, sem promoção de maturidade. O commit que registra esta
liña é um fast-forward documental sobre o mesmo PR; CI consulta-se pelo SHA
final (`gh pr checks 106`), não presunido aqui.

---

# RONDA 2 (2026-10-05) — avaliación efectiva das frentes A/B/C

## 10.0 Que substitúe isto

A conclusión operacional de §4 e §8 («a barra está conxelada, agardando export
A/B/C») queda **substituída** por esta sección: os adaptadores construíronse,
executaron as ferramentas reais e as medições existen. §4 e §8 non se reescriben
— seguen sendo a observación datada do momento en que se redactaron (2026-10-04,
sen SHA publicado das frentes). O contrato por dominio é `EXTENSOES-D.md` v1,
conxelado nos commits `bc92618` + `6d9185b` **antes** de calquera execución.

## 10.1 Inventário datado ao peche (ver táboa completa en `EXTENSOES-D.md`)

| fronte | PR | SHA(s) medidos por D | HEAD publicado á hora do peche |
|---|---|---|---|
| A | #107 | `cbb6895` (inventario 10-04) **e** `bd40e92` (SHA corrixido) | `bd40e92` |
| B | #105 | `cffe17f` e `396e0b8` | `08024d9` — os dous ficheiros que D executa están idénticos por blob con `396e0b8` |
| C | #108 | `275f2af` | `275f2af` (sen corrección publicada) |

## 10.2 Matriz capacidade × SHA (requisito 10 — sin percentual único)

Xerada por `pontuar.mjs`; `medidas/matriz.md` é a lectura humana, `medidas/matriz.json`
a máquina. Cada capacidade co seu denominador conxelado de §3/§4/§5:

| evidencia | graduadas | PASS | falhas | non soportado | descoñecido | excluídas con motivo | SHA do corpo | procedencia da ferramenta |
|---|---|---|---|---|---|---|---|---|
| `A-cbb6895.jsonl` | 29 | 28 | 1 | 2 | 0 | 1 | `d05ce278a43b…` | 15 ficheiros, 0 desviacións |
| `A-bd40e92.jsonl` | 29 | 21 | 8 | 2 | 0 | 1 | `c2004f89e914…` | 52 ficheiros, 0 desviacións |
| `B-cffe17f.jsonl` | 14 | 14 | 0 | 0 | 0 | 4 | `d47f10e45687…` | 4 ficheiros, 0 desviacións |
| `B-396e0b8.jsonl` | 14 | 14 | 0 | 0 | 0 | 4 | `c506f0ffebf2…` | 6 ficheiros, 0 desviacións |
| `C-275f2af.jsonl` | 42 | 39 | 3 | 1 | 0 | 6 | `7e5969d099d1…` | 46 ficheiros, 0 desviacións |
| `holdouts-v3.jsonl` | 41 filas (fora de denominador) | A 28/30 · B 4/4 · C 5/5 · D 0/2 | 1 | 0 | 0 | 2 VOID contra D | `38ea1a9068f8…` | — |

Non se suma unha soa fracción transversal: KA/KB/KC/TA/TC/NB miden dominios
distintos (cadea, ISA, enderezamento, decode, adulteración, confianza).

## 10.3 O achado principal: A regridiu no SHA que publica como corrección

`bd40e92` trae `1344f4c` «corrección v1.1 do subconxunto 68000» e `4aa6ba9` «elo
vinculo-chamada-rutina». Coas **mesmas 29 expectativas conxeladas** de §3, o
resultado pasa de 28/29 a **21/29**:

| fila | SHA anterior | SHA corrixido | desvío medido |
|---|---|---|---|
| `KA1-2` (`lea.w` 0x8400,A1) | PASS | **rc 4, sen cadea** | `ERRO(4): fluxo: enderezo 0xFF8400 en rexión work-ram sen backing ROM` |
| `KA1-bsr.l` | PASS | FAIL | `chamada_forma` = `jsr.l`, esperado `bsr.l` |
| `KA1-jsr.w` | PASS | FAIL | `chamada_forma` = `jmp.pcd16`, esperado `jsr.w` |
| `KA1-jmp.l` / `KA1-jmp.w` | PASS | FAIL | `chamada_forma` = `null` (o elo da chamada xa non aparece) |
| `KA4-2` | PASS | **rc 4** | `saida_sha256` = `null` (mesma causa que `KA1-2`) |
| `TA-3` (chamada fóra da ventá) | rc 11 | rc 7 | rc esperado conxelado ≠ medido |
| `TA-5` (operando .L alterado) | FAIL rc 2 | **FAIL rc 2** | o elo que A declara verde (K10) segue sen detectalo: `esquema=FAIL(vinculo-estrutural: …)` |

Mecanismo (conxectura, non afirmación de causa interna): `0xFF8400` é
`0x8400` **extendido por signo** a 24/32 bits. En 68000 o absolute short
cero-exténdese ao espazo de 24 bits; se a v1.1 trata o word como asinado, todo
endereço con bit 15 activo convértese en «work-RAM sen backing» e a cadea
recúsase. Comprobouse **executando os dous binarios lado a lado** coa mesma
imaxe e os mesmos argumentos (`rc 0` + JSON no vello, `rc 4` + ese erro no novo),
non lendo o código de A. A fila `KA1-2` estaba en PASS en `cbb6895`: é regresión,
non unha falla coñecida que se mantivera.

Isto está pinned por teste (`frentes.test.mjs`): as 7 filas de regresión e a
permanencia de `TA-5` non se poden editar na evidencia sen que a suite cante.

## 10.4 Holdout cego (requisitos 7–9)

`data/.../d/frentes/holdout/` ten **só os inputs** (`dA-img-ho3.bin`,
`dB-grid-ho1.bin`, `dC-cx9-ho1.bin`) e o pin `pin.json`; as respostas están en
`~/rds-scratch/rex-heldout-d2/`, fóra da árbore versionada. O run válido
(`holdouts-v3.jsonl`) reproduce independentemente a falla de `TA-5` en datos que
A nunca viu. `H-A-v1` e `H-A-v2` son **VOID rexistrados contra D**, non contra A:
v1 tiña dous fluxos superpostos (o descodificador de D rexeitaba a súa propia
imaxe), v2 tiña unha sonda `d16(PC)` cun desprazamento `0x8bec` = −28 924 asinado.
Ningunha das dúas recusas de A informaba sobre A. A autoría valida agora os seus
inputs antes de executa-los (guards de zona e de xanela asinada), e eses guards
están tests.

## 10.5 Negativos discriminantes (o que faría saltar a barra)

- `KA3-g-a/b`: cadea con forma válida pero referencia antes do histórico → rc 2 exacto.
- `KA1-b-9/10`: formas fóra da lista fechada → recusa `rc 5` (categoría `non soportado`, **non** fallo).
- `TA-1..TA-8`: oito receitas de adulteración con rc conxelado; `TA-2-control` queda como observación non puntuada (a receita confunde dous eixos).
- `NB-1`/`NB-2` (B): rótulo `HIPOTETICO` lido do JSON que B escribe en disco, e recusa `rc 2` cunha copia da ROM cun byte virado — D recomponse o SHA do `--bin` e comproba que B non escreveu saída.
- `TC-1..TC-4` (C): vocabulario pechado, miolo de instrución, fóra-da-rexión e sonda de lonxitude; `TC-4-control` documenta que sen raíz extra a receita mide alcançabilidade (errata §6).
- `CONTROLE-IDENTIDADE-*` (C) e `CONTROLE-IDENTIDADE-B`: D recompoñe o digest do binario/ROM que realmente se pasou; **un hash que só existe non conta como proba**.
- `linha()` rexeita categorías inventadas; `pontuar.mjs` rexista `desconhecido` como fila, nunca como 0.

## 10.6 Evidencia nova vs herdada

- **Herdada (ronda 1, sen cambios):** `dev/fixture.bin` + `dev/ground-truth.json` + `dev/seal.json`, `ho-1/pin.json`, `selftest/latest.txt`, `CONTRACT-BENCHMARK-D.md`, `CONTRACT-EXPORT-D.md`. Seguen valendo e ningunha fila desta rolda se puntuou contra elas.
- **Nova (ronda 2):** `scripts/.../d/frentes/author_frentes.mjs` + `m68k_author.mjs` (autoría con guards), `scripts/.../d/medida/{ferramentas,adapt_a,adapt_b,adapt_c,drivers_b,holdouts,pontuar}.mjs`, `frentes.test.mjs`, `data/.../d/frentes/{a,b,c,holdout}/*` (fixtures + gabaritos conxelados), `data/.../d/medidas/*` (6 evidencias + 6 manifestos + matriz).
- **Perda rexistrada:** o `holdouts.jsonl` do run v1 sobrescribiuse (mesmo nome). Dende entón as evidencias de holdout levan versión (`-v2`, `-v3`) e o estado anterior de cada re-run quedóu en `~/rds-scratch/rex-eval-d2/evidencia-anterior-20261005/`.

## 10.7 Territorio tocado

Só `scripts|docs|data/rex_profiles/parallel_recovery_20261004/d/`. Non se tocou
produto (`src/`, `src-tauri/`), IPC, UI, `crates/`, manifests, `package.json`,
Memory Bank nin `ROUND_STATE` — eses son territorio do integrador. ROM BYOR
só lectura, nin versionada nin copiada á árbore.

## 10.8 Limites desta rolda (o que NON se alega)

1. **Ningunha fronte sobe de maduridade.** Máximo alcanzado: `vínculo estrutural`. Non houbo execución de ROM nin consumo observado; a equivalencia demostrada non se alega en ningunha fila.
2. `s1` da fixture medida de A codifica en 37 B porque `makeRng()` de `lib_bench.mjs` esta-ba dexenerado: o eixo de descodificación de A só se exercita contra datos non dexenerados no holdout (1157 B). Rexistrado en `EXTENSOES-D.md` §11.
3. `KC4-jmp-ind-an` está en fallo **por texto do contrato de D** (`indirect-opaco` vs o vocabulario real de C, `indirect-opaque`). Non se reescribiu a evidencia; a errata vai a `EXTENSOES-D v2` cunha rolda nova (§11).
4. As 14 filas de B en `cffe17f` e `396e0b8` **non son dúas probas independentes do contrato**: `contrato_sonic.py` é idéntico por hash nos dous SHAs (R10). Só `verificar-cadeia.py` difire.
5. A capa de lectura de C corrixouse **despois** do primeiro run (34/42 → 39/42) sen tocar expectativas; a evidencia intermedia perdeuse. As tres filas `falha` reais mantivéronse (R0).
6. Sen ensamblador 68000 no host, as sondas van codificadas á man por D → oráculo parcial nas filas de ISA.
7. A perna de BYOR (`~/RDS-REX-CORPUS-E/.staging/…`) non se versiona: en CI esa aserción márcase como *skipped* (`it.skipIf`), non como aprobada.
8. O holdout H-A **non** se re-executou contra `bd40e92`; a evidencia de holdout é a de `cbb6895`.
9. Gates Rust do produto (`clippy`, `cargo test --lib`, `cargo fmt --check`) non se executaron: a rolda non toca `crates/` nin `src-tauri/`. O único `cargo build` foi sobre a copia *scratch* da fronte A para ter o binario real que se mide. `security:audit` non se executou (ningunha dependencia cambiou) e `host:certify` non é gatilho (ningún cambio en build/emulación/toolchains do produto).

## 10.9 Como consumir (reprodución)

```
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/adapt_a.mjs
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/adapt_a.mjs --chave A_corrixido
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/adapt_b.mjs
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/adapt_c.mjs
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/holdouts.mjs
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/pontuar.mjs
npx vitest run scripts/rex_profiles/parallel_recovery_20261004/d/
# re-executar o autor con semente: os 20 arquivos de data/…/d/frentes/ saen idénticos (§10.10)
node -e "import('./scripts/rex_profiles/parallel_recovery_20261004/d/frentes/author_frentes.mjs').then(m=>{m.gravarTudo();m.gravarHoldouts();})"
```

Precisan as copias *scratch* das ferramentas (`~/rds-scratch/d-frentes-20261004/{a,a-bd40e92,b,b-cffe17f,c}`),
verificadas byte a byte contra o commit pinado (`verificarProcedencia`, publicada
na matriz). Unha fronte que falte produce filas `desconhecido` con motivo, nunca 0.

## 10.10 Gates da rolda 2

- `npm run check:tree` — OK.
- `npm run lint` — OK. `npx tsc --noEmit` — OK.
- `npm test` — **983 aprobados / 6 ignorados** (101 arquivos + 1 ignorado). Liña de base da rolda 1: 952; a diferenza son os 31 tests discriminantes de `medida/frentes.test.mjs`.
- Gates Rust: ver §10.8 punto 9.
- `npx vitest run scripts/…/d/` tras a edición dos documentos: **50 aprobados** (31 `frentes.test.mjs` + 19 `runner.test.mjs`), 0 fallos.

Reproducibilidade das entradas (probado no peche, 2026-10-05): re-executouse
`gravarTudo()` e `gravarHoldouts()` do autor con semente sobre a árbore e os 20
arquivos de `data/…/d/frentes/` saíron **byte a byte idênticos** (lista de
SHA-256 antes/despois idéntica; ningún arquivo modificado nin novo no índice).
Isto fecha dúas cousas: as fixtures son autorais e determinísticas (non hai bytes
BYOR/comerciais, §10.7) e o `pin.json` do holdout non leva marcas de tempo.

## 10.11 Proposta ao integrador (sen actuar sobre ela)

- `A@bd40e92` **non é promovíbel**: a regresión 28/29 → 21/29 ten que ser
  corrixida pola fronte A (ou, se se confirma que no ISA real `abs.W` se
  cero-extende, o defecto é das expectativas de D: ábrense
  `EXTENSOES-D v2` + re-medición). Mentres ese desvío estea en vigor, non hai
  calidade de referencia.
- Para C: a errata de vocabulario `indirect-opaco → indirect-opaque` ábrese como
  `EXTENSOES-D v2` e mide de novo; non se toca a evidencia v1.
- Ningunha acción sobre produto/IPC/UI/registry/Memory Bank: a rolda D é
  medición e evidencia.

## 10.12 Publicación (2026-10-05)

Catro commits en lotes verticais sobre `codex/rex-parallel-d-eval-bench`,
fast-forward de `789c05a` (roda 1) a `07a5a4d`, todos dentro do territorio
`scripts|docs|data/rex_profiles/parallel_recovery_20261004/d/`:

| SHA | lote |
|---|---|
| `06c16db` | fixtures autorais por dominio + entradas de holdout |
| `c2bf807` | adaptadores que executan as ferramentas reais + evidencia por SHA |
| `6983b0e` | 31 probas discriminantes da matriz |
| `07a5a4d` | `EXTENSOES-D` (inventario + §11) e `RELATORIO-D` rolda 2 |

PR #106 (<https://github.com/Misael-art/retro-dev-studio/pull/106>): sen merge,
sen release, sen promoción de maturidade, sen force push. O commit que rexistra
esta liña é un *fast-forward* documental sobre o mesmo PR; a CI consulta-se polo
SHA final (`gh pr checks 106`), non se presume aquí.

