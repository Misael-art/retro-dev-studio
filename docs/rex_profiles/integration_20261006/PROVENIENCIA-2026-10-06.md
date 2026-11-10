# PROVENIÊNCIA — pacote integrado de layouts Sonic (integrador, 2026-10-06)

Preparado para a decisão do operador sobre distribuição. Separa estritamente
código incorporado, referências consultadas, oráculos executados, fixtures,
ferramentas externas e as alegações que cada combinação autoriza. Nada aqui
decide a questão jurídica; organiza os fatos.

## 1. Código incorporado no produto (está no Git e no binário)

| Item | Origem | Licença declarada | Nota |
|---|---|---|---|
| `crates/rex-enigma` `src/lib.rs` (0.2.0) | frente B `codex/parallel-recovery-20261004-b` @ `da5472c4`, 12 commits por `cherry-pick -x` (último `79ca8082`) | `UNLICENSED`, `publish = false`, zero dependências | implementado a partir da especificação funcional lida do desempacotador 68k (§2); delta funcional versionado 0.1.0→0.2.0 (recusa de `value_offset` não comprovado) em `ADENDO-LAYOUTS-2026-10-06-1.md` |
| `crates/rex-enigma` testes/exemplo (`tests/contract.rs`, `examples/decode_stream.rs`) | integrador (empacotamento) + fixtures autorais | idem | fixtures §4 |
| Adaptador/UI/IPC (`sonic_layouts.rs`, `SonicLayoutsPanel`, 5 comandos Tauri) | integrador, nesta branch | licença do projeto | somente leitura; `value_offset` fixado em 0 |

## 2. Referências consultadas (não incorporadas)

| Referência | Pin | Licença | Uso |
|---|---|---|---|
| s1disasm (repositório) | commit `064e3c68eb19cc85b8801b087f9d95f9b3e82cea` | **sem licença explícita no fonte consultado — não se afirma nenhuma licença que ele não declare** | desmontagem de código comercial; o arquivo `_inc/Decompression/Enigma Decompression.asm` (SHA-256 `76fed2de986b3e79e1f2bd517b06cc9eb64cff0a1679b77268c9a31bfee4136e`) foi LIDO para descrever o formato funcionalmente; nenhum texto dele foi copiado para o crate |
| mdcomp `enigma.cc` | — | LGPL-3.0 | oráculo de comparação externo declarado pela frente B; **excluído do produto**: nenhum byte no Git, no crate ou no binário |

## 3. Oráculos executados (fora do Git, só com SHA no índice)

| Artefato | Caminho local | SHA-256 | Papel |
|---|---|---|---|
| `enigma_research.py` (derivado de trabalho LGPL, status **research only**) | `/home/misael/RDS-REX-CORPUS-B/scripts/rex_corpus_b/enigma_research.py` | `a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2` (conferido nesta rodada) | comparador byte-a-byte no aceite BYOR; executado por import em runtime, jamais copiado/porte |
| ROM Sonic 1 (USA/Europe) — BYOR do operador | `/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin` | `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` | dados do usuário; não é dependência provisionável; não distribuída |

## 4. Fixtures

- Unitárias: **autorais** — vetores montados à mão em `src/lib.rs` e
  codificador de teste independente em `tests/contract.rs` (nenhum byte de ROM
  comercial; nenhuma relação com qualquer jogo).
- Corpus B (10 pares plain, cadeias): `data/rex_profiles/parallel_recovery_20261004/`
  — sintéticas/autorais da frente B, com SHA256SUMS próprios.
- BYOR: saídas derivadas da ROM (`.bin` aplicados, `.bps`, screenshots de arte)
  ficam **fora do índice**; só SHA-256 e contas em
  `data/rex_profiles/integration_20261006/evidencia/`.

## 5. Ferramentas externas de validação (não vão para o binário)

| Ferramenta | Pin | Licença | Uso |
|---|---|---|---|
| Xvfb | `~/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb` SHA `5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351` | MIT/X11 | jornada desktop isolada |
| SGDK | toolchain do projeto (`docs/02_TECH_STACK.md`) | zlib | pipeline canônico de build |
| npm 11.16.0 isolado | `~/rds-scratch/npm-11.16.0` (runtime declarado em `packageManager`/`engines`) | Artistic-2.0 | gate `security:audit` pelo caminho canônico sem alterar configuração global |

## 6. Alegações permitidas × proibidas

Permitidas com a evidência atual:
- "decoder Enigma implementado em Rust sem copiar texto de mdcomp, do
  `enigma_research.py` ou do asm do s1disasm (evidência estrutural + declaratória
  + ordem congelamento→código, `REVISAO-ENIGMA-B.md` §1)";
- "paridade byte-a-byte com o oráculo externo nas 6 streams reais da ROM pinada
  com `value_offset = 0`, consumo/padding conferidos (aceite BYOR, L4)";
- "parâmetros fora do domínio comprovado são recusados explicitamente".

Proibidas (não declarar):
- **"risco jurídico eliminado"** — não copiar mdcomp não resolve o status da
  desmontagem s1disasm (sem licença explícita) nem o do trabalho derivado de
  LGPL que gerou o oráculo de pesquisa; a evidência é de fato, não de direito;
- "implementação limpa certificada" — a verificação é estrutural/declaratória,
  sem ferramenta de similaridade textual contra mdcomp (registrado em
  `REVISAO-ENIGMA-B.md` §1 como limite);
- "equivalência com o console para `value_offset ≠ 0`" — em recusa ativa;
- "consumo do recurso observado em execução do jogo" — a entrega para em
  vínculo estrutural estático.

## 7. Informação para a decisão do operador (distribuição)

1. O binário contém o decoder nativo (crate 0.2.0) e a UI de leitura; nada de
   mdcomp, do asm ou do Python de pesquisa está no pacote.
2. O vetor de risco remanescente conhecido é a derivação da **especificação**
   lida de desmontagem sem licença explícita — atenuações possíveis: manter
   Experimental (status atual), distribuir sem o crate atrás de feature flag,
   ou reescrever a especificação a partir de documentação de terceiro
   independente. Nada disso foi executado por ser decisão do operador.
3. ROM BYOR, derivados e screenshots de arte não são distribuídos pelo repo
   (política já aplicada: só SHA no índice).
4. As licenças das dependências npm/cargo do projeto seguem os audits de
   `docs/` (npm 0 vulnerabilidades high; `cargo audit` 8 avisos já permitidos
   de rodadas anteriores).
