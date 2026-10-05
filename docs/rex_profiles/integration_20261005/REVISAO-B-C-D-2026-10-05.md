# REVISAO-B-C-D — rolda do integrador 2026-10-05 (paso 6/7 da ordem)

Autor: integrador. Verificações executadas com comando fresco nesta data;
nenhuma alteração de produto foi feita antes deste registro.

## B (PR #105, `codex/parallel-recovery-20261004-b @ 08024d9`) — REVISADA, APROVADA PARA CONSUMO PARCIAL

Verificações independentes (não herdadas do relatório da frente):

1. **Hashes da evidência**: os 25 arquivos pinados em
   `data/rex_profiles/parallel_recovery_20261004/b/evidencia/SHA256SUMS.json`
   conferem byte a byte (OK=25, FAIL=0, AUSENTE=0).
2. **Pin do decoder externo**: `enigma_research.py` mede
   `a9ed92f96fbdd7e0…` == `decoder_script_sha256` do review-pr97 e ==
   `pins.decoder_sha256` da evidência.
3. **Suite de contrato da frente**: `pytest test-contrato-b.py` →
   **20 passed** (executado pelo integrador, no worktree de B).
4. **Reexecução da cadeia na ROM BYOR pinada** (`c7da53a10c317f88…`, ROM
   conferida por SHA antes): `verificar-cadeia.py cadeia --modo verificado`
   → `37 sitios ok; 6 hashes preservados; projecao stride 128 roundtrip ok;
   veredito: PROMOVIDO (evidencia completa)`. Conteúdo do JSON reexecutado
   IDÊNTICO ao versionado, exceto `tempo_utc`. (Cópia isolada do instrumento
   em `~/rds-scratch/par-b/integrador-repo/`; o worktree de B não foi tocado;
   o script recusa `--out` fora da árvore e exige renders fora do Git —
   containment confirmado por execução, não por leitura.)

Separação das três camadas (o ponto do review do PR #97) — verificada no
export `export-camadas-b2.json` e no código:

| Camada | Nível alegado | Confere? |
|---|---|---|
| CODEC: 6 plains 4096 B, `value_offset=0` | paridade estática contra pin + vínculo estrutural do parâmetro (`move.w #$0,D0` em `0x1B6CE`) | sim |
| LAYOUT/INTERPRETAÇÃO: grade 64×64 de IDs 1-byte; modelo antigo 2048 palavras/VDP **SUPERSEDADA-REFUTADA** | refutação por bytes (`move.b 0x1B6F8`, `lea 64(a1) 0x1B6FE`, destino `$FF4000`∈WRAM) | sim; os 7 negativos incl. `geometria-errada` (2 variantes) e `destino-alterado $C00004` estão na evidência |
| PROJECÃO RAM: `RAM[$FF1020 + r*128 + c]` | vínculo estrutural + roundtrip com fixture assimétrica autoral | sim |

**Limites que a revisão mantém (não são defeitos, são a escada):** arte/
paleta/mappings NÃO provados; consumo observado NÃO provado (nenhuma
execução); CRAM `RESOLVIDA-ESTATICO` só; Nemesis sem pin → nada Nemesis é
"decodificado".

**Decisão de consumo pelo produto:** a inspeção consome a cadeia como
**constantes verificáveis ao vivo** (37 sítios byte-a-byte, tabela `0x1B64C`
relida da ROM carregada, spans de stream com SHA conferido ao vivo,
SS_MapIndex lida ao vivo) + **pins externos rotulados** (SHA dos 6 plains,
medidos pelo decoder externo pinado — ver §Licença abaixo). Proposta P-1
(`value_offset=0` como origem comprovada **só do parâmetro**): aprovada como
metadado da inspeção. P-2 (`sonic1-mapa-*.json` SUPERSEDADOS): o produto não
lê esses JSONs; a recusa do falso líder é implementada como regra de bytes.

**Licença (registrada como decisão pendente do operador):** o docstring do
decoder pinado declara expressamente que ele é derivado da leitura do
`enigma.cc` LGPL-3.0 da mdcomp e **não pode entrar no produto**. Portanto
ESTA RODADA NÃO PORTA o decodificador Enigma para o Rust do produto; a
inspeção apresenta o recurso por **identidade e integridade** (hash do span
do stream conferido ao vivo + hash do plain medido externamente, rotulado
como tal). Uma implementação limpa de Enigma no produto exigiria aprovação
expressa do operador — não assumida aqui.

## C (PR #108, `codex/rex-parallel-c-cfg @ 8ea5821`) — REVISADA, NÃO CONSUMIDA COMO DEPENDÊNCIA

- Contrato `rex-cfg/v1` explícito (lista fechada de opcodes, 5 proibições,
  vocabulário de evidência com `observado-em-runtime` jamais alegado);
  exports `rex-cfg-sitio/v1` (22 chaves, V1–V5, alvo re-derivado por
  `rederivar`) e `rex-cfg-med/v1` (37 chaves, `agregado:"proibido"`).
- Crate vive em território de pesquisa (`scripts/.../c/`), consome
  `rex-gameplay` por path somente-leitura; `crates/rex-gameplay/Cargo.toml`
  **não** referencia `rex-cfg` (verificado) — acoplamento é de mão única e
  a frente não alterou superfície compartilhada.
- **Decisão:** o produto NÃO adiciona `rex-cfg` como dependência nesta
  rodada (license UNLICENSED, escopo de pesquisa, e a capacidade usada pela
  inspeção — recusar casamento linear em meio de instrução — é implementável
  como regra de bytes própria com teste). O vocabulário de vereditos de C
  (`instrucao-de-bloco` / `miolo-de-instrucao`) é adotado como **nomenclatura
  da recusa de falso líder** na UI, com teste discriminante. 16/16 iscas não
  promovíveis continuam fato da frente C, não do produto.

## D (PR #106, `codex/rex-parallel-d-eval-bench @ afdce00`) — REVISADA, USADA COMO RÉGUA, NÃO CONSUMIDA

- Runner `rds-d-export/1` fail-closed + contêiner `RDSDBNCH` v1; escala
  `candidate→static_ref→structural→observed→recovered→proved`.
- **Decisão:** a barra D permanece instrumento de medição das frentes; a
  inspeção adota a **taxonomia de níveis** (candidato / referência estática /
  vínculo estrutural / não provado) como rótulos por nível na UI, e nada
  mais. O bloqueio de A medido por D (28/29→21/29) é a razão documentada da
  ordem "A BLOQUEADA"; nenhum export `rex-kosinski-chain/v1` entra no produto.

## Arquivamentos desta revisão

- A: BLOQUEADA por ordem expressa — nenhum consumo nesta rodada.
- B: aprovada para consumo parcial conforme §B acima.
- C/D: contratos revisados e aprovados como referência; incorporação ao
  produto NÃO feita (decisão motivada acima), cumprindo "somente com
  contratos explícitos e testes nas capacidades utilizadas" — a capacidade
  usada (recusa de geometria / miolo) será testada no produto, não importada.
