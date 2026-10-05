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

---

# RONDA 3 (2026-10-05) — o estabo era o defecto: oráculo de ISA por instrumento e lectura rectificada de §10.3

## 11.0 Que substitúe isto, e que NON

- **Ningunha cifra da rolda 2 cambia.** Os sete ficheiros de `data/…/d/medidas/`
  seguen publicados coas súas 225 filas e 128 puntuables: `A-cbb6895` 28/29,
  `A-bd40e92` 21/29, `B-cffe17f` e `B-396e0b8` 14/14 cada un, `C-275f2af` 39/42,
  e 81 filas de holdout (40 + 41) fóra de denominador. Non se reclassifica ningunha
  fila (R0) e ningún corpo histórico recibe SHA novo.
- O que cambia é a **lectura** de tres pasos que se sostíñan sobre o AGRAMA
  `dA-truth-v1.json`, escrito á man por D: §10.3 («o achado principal: A regridiu»),
  §10.8 punto 6 («sen ensamblador 68000 no host») e §10.11 primeiro punto
  («`A@bd40e92` non é promovíbel»). Seis das oito filas que compoñen o titular
  contradín un instrumento terceiro.
- **Orde obrigatorio cumprido:** `EXTENSÕES-D **v2**` (`EXTENSOES-D.md` §12) está
  conxelada no mesmo lote, **antes** de calquera nova medición, e este documento
  **non contén ningunha fila v2**. As filas v2 midense despois contra
  `isa-oraculo-v2`.

## 11.1 O instrumento novo: estabilo `rex-parallel-d/oraculo-isa/1`

| dato | valor |
|---|---|
| xerador | `scripts/…/d/medida/oraculo_isa.mjs` |
| estabilo | `data/…/d/gabarito/isa-oraculo-v2.json` — arquivo `54817106ddd0…`; `filas_sha256` `032eb989b530…` |
| sondas | 55 — **51 con bytes reais** saídos da columna crúa de `objdump -d`, **4 recusadas** polo montador (`bsr.l`, `movec %cacr,%d0`, `jmp2abs`, `jmp2abs.l`) |
| composición | 28 `valida`, 6 `valida-fora-da-táboa-A`, 2 `valida-normalizada-movea`, 3 `recusada-68020`, 1 `recusada-68000`, 1 `recusada-68010-ou-maior`, 14 `bruto` (re-lectura das palabras que D codificou á man en rolda 2) |
| ferramenta | `m68k-elf-as` `618740559477…` · `m68k-elf-objdump` `e3a404cc06ec…` · GNU Binutils **2.41** · bandeira `-m68000` |
| probas | 19 pinned en `oraculo_isa.test.mjs`: identidade/versión/SHA da ferramenta, `filas_sha256` contra o arquivo (control de adulteración), ningunha fila «valida» con bytes de recheo, as 4 parellas de bytes repetidas son as intencionadas, ausencia de marcas de tempo, e re-execución nun `mkdtemp` novo |
| limitación | o `m68k-elf-*` é do mesmo almacén de toolchain que emprega o produto (`~/.cache/retrodevstudio/17f7bcf5…`). É independente **do AGRAMA de D**, que é o que a rectificación precisa; non se presenta como terceira autoridade do ecosistema |

## 11.2 Cinco feitos do 68000 que o estabo de D negaba

1. `lea (0x8400).w,%a1` = `43f8 8400` → **EA `0xFFFF8400`**. O absolute short
   **exténdese por signo**, e o límite está no bit 15 — medido nos dous lados:
   `43f8 7fff` → `7fff`, `43f8 8000` → `ffff8000`.
2. Formas canónicas das chamadas: `jsr (xxx).w = 4eb8`, `jsr (xxx).l = 4eb9`,
   `jmp (xxx).w = 4ef8`, `jmp (xxx).l = 4ef9`, `jmp (d16,%pc) = 4efa`,
   `jmp %a0@ = 4ed0`, `jsr %a2@ = 4e92`. `4efc` e `4efd` **non teñen mnemónico
   68000**: o desmontador imprime `.short 0x4efc` / `.short 0x4efd`. `61 ff …`
   lé-se só como `bsrl` de 68020.
3. Con `-m68000` o montador **recusa** `bsr.l` e `movec` («invalid instruction for
   this architecture; needs 68020…» / «…needs 68010…»), e `jmp2abs` / `jmp2abs.l`
   son «Unknown operator». Unha fixture que se declara do perfil
   `md68000-chain16` non pode levar esas palabras como sonda *positiva*.
4. `movea.w` e `movea.l` son **MC68000 válidos**: `327c 1234`, `227c 0000 1234`,
   `3240`, `2240`, `3248`, `2248` (`moveaw #4369,%a1`, `moveal #4369,%a1`). A rolda
   2 tiña `movea.w` por inválida e `movea.l #imm32` por fronteira
   `opcode-fora-do-subconxunto`.
5. `move.w #imm,%a1` **non ten codificación propia**: o montador normalízao a
   MOVEA (`327c 1234`), mentres `move.w #imm,%d1` é `323c 1234`. A invalidade é do
   mnemónico, non da codificación: ningunha imaxe pode conter esa «combinación
   inválida detectábel».

Ademais, nas relativas a base é **sitio + 2** (`6102` → `bsrs 4`;
`6100 0004` → `bsrw 6`), cousa que a rolda 2 xa usaba ben en `KA1-3`.

## 11.3 Retificación de §10.3, fila por fila

O veredicto histórico consérvase na evidencia; o que se corrixe é o que significa.

| fila | veredicto histórico (intacto) | ditame do instrumento | lectura rectificada |
|---|---|---|---|
| `KA1-2` | FAIL rc 4, «sen cadea» | `43f8 8400` = `lea (0x8400).w,A1` → EA `0xFFFF8400` | **expectativa falsa de D**: pediu `carga_operando = 0x8400` cunha nota («extensión curta sen signo») que o ISA desmente. A recusa de `bd40e92` (`0xFF8400` en work-RAM sen backing ROM) **é conforme co instrumento**; é `cbb6895`, que a rolda 2 daba a verde, o que non coincidía coa ISA |
| `KA1-bsr.l` | FAIL: forma medida `jsr.l` ≠ esperado `bsr.l` | `61 ff 0000 1dd4` = `bsrl` de 68020; `-m68000` recusa `bsr.l` | **sonda inválida**: un perfil 68000 non pode levar `bsrl` como caso positivo. E o `jsr.l` que se le na evidencia non é resposta de A sobre esa palabra: co empaquetado continuo de v1 falou a sonda veciña (§11.5). En v2 convértese en probe **negativa** |
| `KA1-jsr.w` | FAIL: forma `jmp.pcd16`, alvo `0x002042` | `4e fa 1f 00` **é** `jmp (d16,%pc)`; `jsr (xxx).w` é `4eb8` | **bytes equivocados de D.** O que devolve A (forma e alvo `0x142 + 0x1f00 = 0x2042`) é exactamente o que di o desmontador. Retírase a acusación de desvío |
| `KA1-jmp.l` | FAIL: forma `null` | `4efd` = `.short 0x4efd`, sen mnemónico 68000; `jmp (xxx).l` é `4ef9` | **bytes equivocados de D**; `null` é a lectura correcta dese fixture |
| `KA1-jmp.w` | FAIL: forma `null` | `4efc` = `.short 0x4efc`; `jmp (xxx).w` é `4ef8` | idem |
| `KA4-2` | FAIL rc 4, `saida_sha256 = null` | mesmo sitio `0x110` que `KA1-2`; un absolute short co bit 15 activo **non pode** referenciar o stream en `0x8400` | **premise imposible**, e **non é unha medición independente**: comparte sonda con `KA1-2` (prohibido en v2, R14). O eixo de decodificación queda sen medir neste SHA |
| `TA-3` | FAIL: rc 7 ≠ 11 esperado | rc 7 = ALVO-DIVERXENTE e rc 11 = XEOMETRIA-DIVERXENTE, os dous publicados en `CONTRATO-A` §5 | **receita confusa de D**: a mutación movía xunto o alvo declarado e a ventá, así que respondeu ao eixo correcto cun código correcto. v2 sepáraa en `TA-3a {7}` / `TA-3b {11}` (§12.4). **Non é unha falla de seguranza** |
| `TA-5` | FAIL: rc 2 ≠ 6 esperado | rc 2 = ESQUEMA, «contrato estrutural roto **antes de medir**» | **receita confusa de D**: a mutación rompía a forma do rexistro antes de chegar ao eixo operando. Retírase a aserción «o elo K10 segue sen detectalo»: esa pregunta **queda sen medir** |

**O que si sostén esta rolda:** o titular «A regridiu 28/29 → 21/29» non é
sostible. Seis das oito filas que o compoñían eran defectos do estabo de D e as
outras dous eran receitas que misturaban eixos.

**O que NON se pode afirmar:** que A teña razón neses eixos. Unha fila cuxo
gabarito era falso non proba nada en ningún sentido. As oito preguntas convértense
en filas v2 novas (`KA1v`, `KA1v-neg`, `KA4v`, `TA-3a/3b`, `TA-5v`) cun denominador
novo, e **aínda non se mediron**.

## 11.4 Retificación das «3 falhas en C» (§10.2 e §10.8 punto 3)

`C-275f2af.jsonl` publica 39/42 e así queda. A lectura rectificada: ningunha desas
tres filas documentaba un defecto de **capacidade** de C; dous eran premisas falsas
de D e o desvío real que queda é documental (§11.4, fila `KC3`).

| fila v1 | que afirmaba a barra | instrumento + documento de C | lectura rectificada |
|---|---|---|---|
| `KC1-movea.l #imm32,A1` | C non detecta a fronteira `opcode-fora-do-subconxunto` | `227c 0000 1111` = `moveal #4369,%a1`, **MC68000 válido**; e `CONTRACT.md` de C (liña 77) **declara** `MOVE`/`MOVEA` `.B/.W/.L` | premisa falsa por duplicado: a instrución é MC68000 válida segundo o instrumento **e** o contrato de C decláraa soportada; non había nada que detectar |
| `KC3-move-w-imm-an` | `MOVE.W #imm,An` é unha combinación inválida detectábel | GAS monta `move.w #0x1234,%a1` como `moveaw #4660,%a1` (`327c 1234`): a palabra **é** unha MOVEA.W válida | **non expressable en bytes**: a invalidade é do mnemónico, non da codificación, e ningún lector de bytes pode diferenciala. A fila retírase en v2. Nota para C: `CONTRACT.md:79` si declara «combinações inválidas (p. ex. MOVE.W → An) = fronteira», aserción que o instrumento fai irrealizable a nivel de codificación — **defecto documental de C**, non de capacidade; publícase como observación sen tocar a evidencia |
| `KC4-jmp-ind-an` | a barra conxelou o rótulo `indirect-opaco`; C devolve outro texto ⇒ fila `falha` | C publica `indirect-opaque` (`src/decode.rs:36`, `src/grafo.rs:357`, e os seus propios tests `tests/export_json.rs`, `tests/fx_fluxo`); `CONTRACT.md:90` escríbeo igual | **erro de transcrición de D**, non de C. En v2 resólvese no `adaptador-c/v2` (§12.5), sen tocar o produto nin a evidencia v1 |

## 11.5 Defectos propios descubertos ao construír v2

- **A restrición «non hai ensamblador 68000 neste host» era falsa** — §10.8 punto 6
  **retirado**. Os binarios estaban en
  `~/.cache/retrodevstudio/17f7bcf5…/source-build-m68k_gcc/source/install/bin`, fóra
  do `PATH` que D consultou. Consecuencia directa: as sondas codificadas á man, e
  con elas seis filas erradas, eran evitables. D en diante búscase PATH **e** o
  almacén pinado antes de declarar unha ausencia.
- **`makeRng()` de `lib_bench.mjs` é dexenerado en todas as sementes, non en tres.**
  Sondeo do 2026-10-05 (`~/rds-scratch/d-oraculo-20261005/diag_rng.mjs`): as 8
  sementes nomeadas dos fixtures → **4096/4096 saídas = 0**; varrida de 16 000
  sementes (`d::s<i>`, `dsb1::s<i>`, `frentes::s<i>`, `s<i>` con i < 4000) →
  **16 000/16 000 (100 %)** colapsan a ceros antes da saída 1024. Mecanismo: o
  produto `state × multiplicador` non se trunca a 64 bits antes de `Number(…)`, así
  que o valor (~2⁹²) redóndase en coma flotante e `… % 256` é sempre 0. Ademais o
  multiplicador do código (`2685821657763633871`) **non** é o de `xorshift64*`
  (`2685821657736338717`): difire desde o 11º díxito. Corrección + gate de entropía
  (R16) van no lote seguinte; os fixtures v1 **non** se re-xeran.
- **Empaquetado continuo de sondas.** En `dA-img-v1.bin` as probes ían seguidas, sen
  recheo: cando A recusaba unha forma, o scanner seguía lendo a sonda veciña. De aí
  o `chamada_forma: jsr.l` de `KA1-bsr.l`. Veto en v2: R14 (unha sonda por sitio,
  separadas por `4e71 4e71…`).
- **Premisas falsas**: `KC1`/`KC3` (§11.4), `KA4-2` (§11.3) e as táboas de `rc`
  exacto en `TA-3`/`TA-5`.

## 11.6 Que queda explicitamente sen medir (e así se publica)

- A sobre as formas de chamada **coas bytes do montador**, unha sonda por sitio
  (`KA1v`, 10 filas).
- A ante `4efd`, `4efc` e `61 ff` como probes **negativas** (`KA1v-neg`, 3 filas).
- A no eixo *operando* cun rexistro valido-por-esquema (`TA-5v`): a pregunta que
  §10.3 respondeu mal.
- O descodificador de A contra referencias longas non dexeneradas: a rolda 2 só o
  exercitou no holdout, porque os `plain` das fixtures eran ceros (§11.5).
- C sobre as 20 formas de `KC1v` co vocabulario do `adaptador-c/v2`.
- **B: ningunha capacidade nova.** O descodificador Enigma nativo que B publicou
  desde `da5472c` e a investigación CRAM non están inventariados por D nesta rolda;
  as 14 filas de `cffe17f`/`396e0b8` non cubren nada diso (R18). Antes de medir B
  hai que conxelar o adendo `EXTENSOES-D v2-B` co enderezamento e bytes concretos
  das sondas: se ese adendo non existe, `KB5v`/`KB6v` publícanse como `descoñecido`
  con motivo — non se inventan.

## 11.7 Gates deste lote

```
npm run check:tree    → OK: estrutura conforme docs/08_TREE_ARCHITECTURE.md
npm run lint          → ok
npx tsc --noEmit      → TypeScript: No errors found
npm test              → 1002 aprobados / 6 ignorados (102 arquivos + 1 ignorado)
                        base rolda 2: 983 → delta 19 = oraculo_isa.test.mjs
npx vitest run scripts/…/d/ → 3 arquivos, 69 probas, 0 fallos
```

Gates Rust (`clippy`, `cargo test --lib`, `cargo fmt --check`), `host:certify` e
`security:audit`: **non executados** — este lote non toca `crates/`, `src-tauri/`,
build, emulación, toolchains nin dependencias. Se un lote posterior toca algo diso,
execítanse antes de publicar.

## 11.8 Como reproducir o estabilo

```
node scripts/rex_profiles/parallel_recovery_20261004/d/medida/oraculo_isa.mjs \
     --saida ~/rds-scratch/d-oraculo-20261005/sondas
npx vitest run scripts/rex_profiles/parallel_recovery_20261004/d/medida/oraculo_isa.test.mjs
```

`filas_sha256` (`032eb989b530…`) é o digest **portabel**: o camiño do directorio de
traballo normalízase a `<saida>/` dentro do stderr do montador. O arquivo
`data/…/gabarito/isa-oraculo-v2.json` si leva as rutas deste host, polo que a
promesa de reprodución é sobre `filas_sha256` e non sobre os bytes do arquivo —
comprobado pola proba que re-executa o xerador nun `mkdtemp` novo.

## 11.9 Proposta ao integrador (substitúe o primeiro punto de §10.11)

- **Retirada** a aserción «`A@bd40e92` non é promovíbel: regresión 28/29 → 21/29».
  O §10.11 da rolda 2 deixaba aberta a alternativa («se se confirma que no ISA real
  `abs.W` se cero-extende, o defecto é das expectativas de D: ábrense
  `EXTENSOES-D v2` + re-medición»); é a que se producíu, **co signo invertido**: o
  instrumento confirma a extensión **por signo**.
- **Non se pide promoción** para ningunha fronte. O teito de maturidade segue en
  `vínculo estrutural` (§10.8 punto 1), e a matriz v2 publica denominadores
  separados por capacidade × SHA × versión de gabarito cos `VOID`, perdas e límites
  á vista (requisito 10), sen percentual transversal.
- Ningunha acción sobre produto / IPC / UI / `crates/` / manifests / registry /
  Memory Bank / `ROUND_STATE`: a rolda D é medición e evidencia.

## 11.10 Estado do lote e seguintes

Este lote é **documentos + estabilo + probas do estabilo**: nada se mediu aínda
contra v2, e así se declara. Orde dos lotes restantes, segundo o brief:
(a) `makeRng` test-first, co xerador corrixido, control histórico do vello e
fixtures novas cos seus pins; (b) fixtures de A/C xeradas co montador;
(c) re-medição de `A@bd40e92` e de C no seu SHA público actual (`8ea5821`) con
gabarito v2 e **holdout novo**; (d) B por capacidade despois de `EXTENSOES-D v2-B`;
(e) matriz v2.

