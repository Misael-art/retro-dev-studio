# PRÓXIMO ALVO (preparação, nada executado) — rotina `$085A2` do Streets of Rage (World) — 2026-10-09

Preparado após o fechamento da ponte do pulo. **Não é implementação, não é prova, não inicia vida/anéis.** Seleção feita só com evidência já existente no repositório; nenhuma assinatura nova foi inventada e nenhuma semântica é atribuída pela aparência.

> **Papel na direção vigente:** este alvo é o **teste de generalidade F3** de `docs/14_REX_ARQUITETURA_UNIVERSAL.md` (classe diferente do pulo: descompressor). Só deve ser executado depois de F0/F1 (motor × perfil em dado) e da decisão D1 sobre a sonda; ao executar, registrar a métrica de generalidade (§6 do doc 14) além dos critérios abaixo.

## Por que este alvo
É outra engine/jogo (Streets of Rage, não Sonic), uma rotina curta (160 bytes, prólogo ao `rts`) e já tem **consumidores** estáticos identificados e **saídas esperadas** versionadas por SHA.
| Evidência existente | Onde | Estado |
|---|---|---|
| Rotina `$085A2…$08641`, 160 bytes, SHA dos bytes `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90`, forma de descompressor com convenção Kosinski | `docs/rex_corpus_a/FASE6-CADEIA-E-CORREXIONS.md` §5 | **medida morfológica**; semântica de escrita em A1 **não executada** |
| 6 sítios `jsr $085A2` com fonte em A0 e destino em A1 (`$FF8000`/`$FF7000`) | idem, tabela do §4 | forma estática uniforme |
| Registros decodificados pelo produto (`rex-kosinski`) com consumo e SHA da saída (ex.: offset `0x1CAEC`, 611 bytes consumidos, 8192 bytes, SHA `f2b96499a5547a872d168e51f14f9846e2013060aadaca3a1810204bdaf1fceb`, consumidor `lea@0x10852/A0/chamada@0x1085E/0x085A2`) | `data/rex_corpus_a/evidencia/streets-of-rage-world-ptbr-reservada.rexistros.jsonl` (5 registros) | "vínculo-estrutural"; "proba estática: sem execução da ROM" |
| Comparação independente por decodificador de referência em Python | FASE6 §6 | reproduzível |

ROM local confere com a evidência: `Streets of Rage (World).gen`, 524 288 bytes, CRC-32 `88e4ef3c`, SHA-256 `304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d` (BYOR, fora do Git; conferir por SHA antes de qualquer uso).

## O que NÃO está provado (e portanto não pode ser afirmado)
- Que `$085A2` **é executada** em jogo e por quais chamadores (hoje: só chamadas estáticas).
- Que ela escreve em A1 o que `rex-kosinski` produz (hoje: equivalência entre decodificador externo e bytes da fonte, não execução da rotina).
- Qualquer significado de **conteúdo** da saída (gráficos, mapa etc.): descompressor ≠ semântica do dado.
- Que o "consumidor" estático seja o consumidor em execução.

## Plano (a executar em missão própria, expectativas congeladas ANTES)
1. **Consumo observado:** quebra de execução/trace no entrada de `$085A2` pelo núcleo no gameplay real (mesma superfície de input nativa); registrar o PC chamador (esperado ∈ os 6 sítios) e A0/A1 na entrada. Sondas técnicas rotuladas. Chamadores/endereços fora da lista estática são resultado, não erro.
2. **Efeito observado:** na saída da rotina, comparar os bytes em RAM a partir de A1 com a saída do decodificador independente (SHA e comprimento versionados no registro). Igualdade byte a byte = efeito demonstrado; diferença = reporta-se como tal.
3. **Controle causal mínimo (se 1 e 2 passarem):** alterar **um** byte do fluxo comprimido numa cópia (cópia + IPS pelo pipeline existente, sem novo pipeline de patches) e prever/medir a saída em RAM; recusar se a alteração fizer a decodificação divergir fora do previsto.
4. **Critérios de recusa congelados:** ROM com SHA diferente, ausência de chamada observada no tempo de jogo, saída sem igualdade, e qualquer tentativa de atribuir significado de conteúdo.
5. Nada de vida/anéis; nada de "segura em gameplay"; domínio representável × aceito × medido separados como na ponte do pulo.

## Decisões pendentes do operador
Se a missão pode usar o fluxo de trace/breakpoint já existente no núcleo ou exige um sondador novo (dependência); e se o alvo fica restrito à ROM `World` ou inclui `Streets of Rage 2/3` (presentes no corpus local; sem evidência prévia equivalente neles).
