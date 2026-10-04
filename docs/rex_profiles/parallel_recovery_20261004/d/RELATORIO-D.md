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
