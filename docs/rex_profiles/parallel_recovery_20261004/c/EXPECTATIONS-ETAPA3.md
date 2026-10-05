# EXPECTATIONS — ETAPA 3 (frente C) — congeladas ANTES de implementar ou executar

**Data:** 2026-10-05. **Ponto recebido:** `8ea5821` (branch `codex/rex-parallel-c-cfg`, PR #108).
**Worktree:** `/home/misael/RDS-REX-PARALLEL-C-2026-10-04`. **Território:**
`scripts|docs|data/rex_profiles/parallel_recovery_20261004/c/` — nada fora daqui.

**Objetivo da missão (letra do briefing):** *remover a interpretação incorreta de absoluto curto e
tornar os resultados estruturais seguros para integração.*

**Aceite:** campos semanticamente corretos, contrato reconciliado e novas provas discriminantes.
**Não ampliar a ISA apenas para aumentar cobertura.**

Este documento é o compromisso do protocolo (`feedback-rex-freeze-expectations-precommit`): é
commitado **sozinho**, antes de qualquer linha de `src/` nova ou alterada, e antes de qualquer
medição nova. Se a medição contrariar uma expectativa, o resultado é registrado como **FAIL** ou
**INCONCLUSIVE** com a série bruta — nunca se reescreve esta página depois de medir.

Diferença de método em relação à ETAPA 2: as três questões de ISA em aberto (extensão de
`abs.W`, tamanhos de `MOVEA`, largura do desplazamento de `DBcc`) foram resolvidas **por
referência primária** (dois PDFs oficiais da NXP baixados, com SHA-256 registrado no Apêndice A)
**e** pelo montador/desmontador pinado (binutils 2.41). As sondas estão no Apêndice A; nada aqui é
projeção de resultado.

---

## 0. Regra de não-ampliação (decorre do aceite, não das medidas)

1. A lista fechada de `CONTRACT.md §3` **não ganha nenhuma forma nova** nesta entrega. A
   auditoria exaustiva de máscaras (§4) só pode produzir três coisas: confirmar acordo,
   reclassificar uma recusa como **declarada** (com apontador para a cláusula que a autoriza) ou
   expor **divergência crítica**. Aceitar uma instrução nova porque o instrumento a decodifica é
   o erro que o aceite proíbe.
2. Se §4 ou §5 revelar que uma forma hoje recusada é na verdade **do subconjunto já descrito**
   (isto é, a máscara está errada, não a lista), a correção é de máscara, e precisa de teste
   próprio com o instrumento como árbitro — não de ampliação de lista.
3. Nenhuma constante numérica de limiar (contagens, percentuais) é ajustada para acomodar um
   resultado medido. Precedente: `EXPECTATIONS-ETAPA2 §9` e a RECTIFICACION-A.

---

## 1. P-absW resolvido: quatro quantidades separadas (obrigações 1 e 2)

### 1.1 A decisão e a sua fonte

`M68000PRM` §2.2.16 *Absolute Short Addressing Mode* (p. 2-18), verbatim:

> "In this addressing mode, the operand is in memory, and the address of the operand is in the
> extension word. **The 16-bit address is sign-extended to 32 bits before it is used.**"

com a figura do formato na mesma página: `EXTENSION WORD → SIGN-EXTENDED → EXTENSION VALUE`, e o
`OPERAND POINTER` de 32 bits por baixo. `MC68000UM` §1.1 (p. 1-1): *"The MC68000 has a 16-bit data
bus and 24-bit address bus while the full architecture provides for 32-bit address and data
buses"*; §3 *Address Bus (A23–A0)* (p. 3-3): *"This 24-bit, unidirectional, three-state bus is
capable of addressing 16 Mbytes of data"*.

Consequência direta: **a hipótese `zero-extendida` da ETAPA 1/2 está refutada** pelos dois canais
(exemplo medido no Apêndice A, sonda S8: os mesmos bytes `4e b8 80 00` exibem `jsr 0xffff8000`; a
word isolada `4e b8 7f fe` exibe `jsr 0x7ffe`). As strings hoje publicadas
`extensao-abs-w-hipotese-zero-extendida` (em `limites`) e `interpretacao-pendente:abs-w-bit15`
(em `motivos`) **saem do objeto exportado** nesta entrega, substituídas por campos nomeados por
semântica. A retificação é datada e versionada (§2, §3); os artefatos v1 ficam como históricos.

### 1.2 As quatro quantidades (todas exportadas separadamente, nunca fundidas)

Para um operando absoluto curto (`(xxx).W`, modo `%111 reg %000`) lido em `s`:

| # | campo v2 | definição | origem da definição |
|---|---|---|---|
| Q1 | `operando-bruto` | a word de 16 bits **exatamente como está no objeto** (ex. `0x8000`) | bytes; nenhuma interpretação |
| Q2 | `endereco-efetivo` | Q1 **sign-extendida** para 32 bits (ex. `0xFFFF8000`) | PRM §2.2.16 |
| Q3 | `endereco-de-barramento` | Q2 truncada para os 24 bits do bus do MC68000, `Q2 & 0x00FFFFFF` (ex. `0xFF8000`) | UM §1.1 / §3 (A23–A0) |
| Q4 | `offset-de-objeto` | `Q2 - origem` **somente** quando a janela declarada (`--origin` + tamanho do objeto) cobre Q2; caso presente, é deslocamento no arquivo; caso ausente, `offset-de-objeto-status: fora-do-objeto` | declaração do chamador, não a ISA |

Regras verificáveis:

- **E1-1** — Q1 ≠ Q2 sempre que bit15 = 1; Q1 = numericamente a word lida (re-derivada dos bytes,
  não o valor do grafo). Teste com `0x8000`, `0xFFFF`, `0x7FFF`, `0x0000`.
- **E1-2** — Q3 é aritmética pura sobre Q2 com máscara `0x00FF_FFFF`, e é exportada com o limite
  declarado `bus-24-bits-mc68000` (UM §3). Q3 **não** afirma decodificação de memória de console:
  em modo 16-bit o MC68000 dirige `A0` alto (UM §3), e o espelhamento é propriedade da placa, não
  da CPU — nada de espelho Mega Drive é alegado nem aplicado.
- **E1-3** — Q4 **só** existe com mapeamento declarado. A ferramenta nunca inventa "offset de ROM"
  para Q2 fora da janela; fora da janela o campo sai ausente + `fora-do-objeto`. (Isso mantém a
  proibição de confundir *referência estática* com *endereço de arquivo*.)
- **E1-4** (obrigação 2, letra) — nenhum campo cujo nome signifique alvo efetivo pode carregar a
  word zero-estendida. O campo `alvo` passa a ser **Q2** (efetivo do modelo declarado), e Q1 sai
  em `operando-bruto`, em campo próprio, **inclusive quando bit15 = 0** (coincidência numérica não
  é identidade semântica).
- **E1-5** — o modelo de CPU é **declarado no objeto**, não implícito: `modelo-de-cpu: "mc68000"`,
  `semantica-do-operando: "sign-estendida"`, `fonte-da-semantica: "M68000PRM 2.2.16"`. Sem esses
  três campos presentes, o bloco de endereço é inválido (teste de forma).
- **E1-6** — as formas longas (`%111 reg %001`) mantêm Q1 = as duas words, Q2 = o long, Q3 = a
  truncagem, Q4 como acima; `abs.L` **não** sofre sign-extensão (PRM §2.2.17) — o teste precisa
  distinguir as duas famílias e não pode deixar `4eb9 8000 0000` e `4eb8 0000` colapsarem.

### 1.3 Efeito estrutural esperado (e medido, não previsto)

Com Q2 no lugar da zero-extensão, arestas de `JSR/JMP (xxx).W` com bit15 = 1 passam de um alvo
**dentro** da janela da ROM (o endereço falso `0x0000xxxx`) para um alvo **fora** da região
declarada. O grafo deixa de seguir corpo de rotina que nunca existiu naquele endereço. A
contagem real de sítios afetados em `fx09/fx10/fx11/S1/S2/censo/R1/R2/R3` é **resultado da
re-derivação** (§6); nenhum número é antecipado aqui.

---

## 2. Versionamento incompatível e preservação histórica (obrigação 3)

- Esquemas novos: `rex-cfg/v2`, `rex-cfg-sitio/v2`, `rex-cfg-med/v2`,
  `rex-cfg/censo-iscas/v2`. O `v1` continua existindo **só como artefato histórico** (os JSONs já
  publicados), não como saída do binário: depois desta entrega, o binário em HEAD produz v2.
  Não há *feature flag* de compatibilidade — bandeira de compatibilidade aqui seria exatamente o
  tipo de shim que o briefing proíbe.
- **E2-1** — os seis `*.redigido.json` e os dois `MANIFEST*.md` publicados na ETAPA 1/2 **não
  mudam uma byte**: os digestos congelados em `MANIFEST-ETAPA2.md` são
  s1 `110e5cda…657ad3`, s2 `bb6db8ba…c0a06a`, censo `6c446c29…8954ef`, r1 `d97cde0a…d963d4`,
  r2 `524dd707…1cded3`, r3 `c47f0f10…67cfea`. Um teste verifica esses digestos **antes** de
  qualquer evidência nova ser escrita (RED legítimo: ele falha se a entrega regerar histórico).
- **E2-2** — evidência nova vai em arquivos **novos**, sufixados `-v2`, gerados por scripts novos
  (`executar-amostras-reservadas-C-v2.sh`, `executar-evidencia-C-v2.sh`) que **não** sobrescrevem
  os geradores da ETAPA 1/2 (que continuam a produzir exatamente os bytes históricos — é o que
  prova a preservação).
- **E2-3** — `tools/make-fixtures.sh --check` continua verde para os 13 corpus existentes;
  fixtures novos entram por linhas novas em `fixtures/MANIFEST.sha256` (precedente do pino
  obsoleto corrigido em `d4cb673`: todo pino de fonte passa a ser verificado byte a byte).

---

## 3. Retificação do contrato: MOVEA, DBcc e as descrições erradas (obrigações 5 e 6)

O texto congelado **não é reescrito**. `CONTRACT.md` ganha no topo um ponteiro datado para
`CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md`, e esse arquivo novo:

(a) **cota o texto original** de cada cláusula retificada, na ordem, com a linha;
(b) declara o estado de cada cláusula como `comportamento-implementado-ok | descricao-contratual-errada | ambos-errados`;
(c) traz a fonte primária e a sonda que mede.

- **E3-1 `MOVEA`** — `CONTRACT.md:156` hoje escreve "`MOVE`/`MOVEA` .B/.W/.L …". Retificação:
  `MOVEA` tem tamanho **`.W` e `.L` somente**. Fontes: PRM §MOVEA (p. 4-119) *"Attributes: Size =
  (Word, Long)"* e *"Word-size source operands are sign-extended to 32-bit quantities"*; sonda
  S2/S11 (Apêndice A): `movea.b #4,%a0` é recusado pelo montador pinado com
  `Unknown operator` (rc=1) **em `-m68000` e em `-m68020`**; `move.b #4,%a0` é recusado com
  `operands mismatch`. O decoder **já recusa** (`decode.rs`: `MOVEA.B invalido`,
  `MOVE.B para An invalido`) — logo a cláusula é do tipo *descrição contratual errada*, e o
  critério é: o texto retificado tem de bater com o comportamento, e um teste novo tem de
  **demonstrar** a recusa com bytes sintetizados por `.word` (não com uma asserção de texto).
- **E3-2 `DBcc`** — `CONTRACT.md:166` hoje escreve "`DBcc` Dn com disp8 (disp8=0x00 → extensão
  word; 0xFF recusada)". Retificação: `DBcc` **não tem forma disp8**; o segundo word é sempre um
  deslocamento **de palavra com sinal**, e a base é o endereço da palavra de instrução + 2.
  Fontes: PRM §DBcc (p. 4-90) *"execution continues at the location indicated by the current value
  of the program counter plus the sign-extended 16-bit displacement. The value in the program
  counter is the address of the instruction word of the DBcc instruction plus two"*; PRM
  Table 3-9 (p. 3-12) dá a coluna *Operand Size* de `DBcc` como **`16`**, enquanto `Bcc`/`BRA`
  levam `8, 16, 32`; sonda S5: `51c8 fffc` (4 bytes, base `0x06-4 = 0x02`) e `51c8 025c` (alvo
  `0x266`, impossível em disp8). O decoder **já implementa** corretamente (comentário em
  `decode.rs:890`: "SEMPRE 4 bytes"), e a regra de `0xFF` ambíguo pertence **só** a `Bcc/BSR/BRA`.
  Critério: a cláusula retificada separa as duas famílias, e um teste novo fixa que `dbf` com
  disp16 extremo (`0x8000`, `0x7FFF`) produz o alvo certo e que a recusa de `disp8=0xFF` **não**
  é aplicada a `DBcc` (negativo simétrico: se a regra vazasse para `DBcc`, o teste falha).
- **E3-3** — a `limites` do objeto de sítio perde a string de hipótese (§1.1) e ganha, no lugar:
  `sign-estenda-de-abs-w-segundo-m68000prm-2.2.16`, `bus-24-bits-mc68000`,
  `offset-de-objeto-so-com-mapeamento-declarado`. Todas ASCII, por `CONTRACT §5`.

---

## 4. Auditoria exaustiva de máscaras com o instrumento como árbitro (fim da obrigação 6)

Sonda de viabilidade já executada **antes** deste congelamento (Apêndice A, sonda V1): corpus
determinístico de **1 MiB** com os **65 536** words de opcode possíveis, um por slot de 16 bytes
preenchidos com `4e71` (`nop`); `objdump -b binary -m m68k -D` produziu **exatamente um registro
no início de cada um dos 65 536 slots** (drift = 0) e classificou **14 292** slots como
`.short` (encoding que o próprio decodificador do instrumento recusa). Isso dá um oráculo
independente para *aceite*, *recuse* e *comprimento* sobre todo o espaço de opcode, sem
dependência de nenhuma decisão nossa.

A auditoria v2 congela:

- **E4-1** — para cada slot, a ferramenta reporta `decodificado(comprimento)` ou
  `fronteira(motivo)`. Classes de resultado:
  - `acordo` — ambos aceitam e o comprimento é igual;
  - `acordo-recusa` — o instrumento imprime `.short` e a ferramenta põe fronteira;
  - `recusa-declarada` — o instrumento aceita e a lista fechada recusa: cada caso precisa de um
    **apontador de cláusula** (`§3` / `§0.3` / regra de CPU-alvo 68000), registrado em tabela;
  - `divergencia-critica` — (i) ambos aceitam com comprimentos diferentes; (ii) a ferramenta
    aceita onde o instrumento imprime `.short`; (iii) a ferramenta aceita um `abs.W/abs.L` cujo
    `endereco-efetivo` não bate com o número exibido pelo instrumento; (iv) uma recusa sai sem
    motivo declarável.
- **E4-2** — **critério de meta: `divergencia-critica = 0`**. Não é previsão: é o limiar. Se a
  medição produzir qualquer divergência, a entrega fica **FAIL** até que (a) se corrija a máscara
  **ou** (b) se prove, com sonda e citação, que o `.short`/comprimento do instrumento é o lado
  errado para o alvo MC68000 — e (b) exige registro explícito, porque aqui o instrumento é o
  árbitro de comprimento por contrato desde a ETAPA 1.
- **E4-3** — a tabela completa (65 536 linhas) **não** é versionada. São versionados: o gerador
  do corpus (receita determinística + digesto do corpus), o redigido com **contagens por classe**,
  o histograma de `.short` e a **lista integral das divergências** (que deve ser vazia) e a lista
  de `recusa-declarada` agrupada por família de opcode com a cláusula correspondente.
- **E4-4** — a auditoria **não** move nenhuma forma para dentro da lista fechada (regra §0.1).

---

## 5. Negativos independentes (obrigação 7)

Cada negativo abaixo tem de **discriminar**: nomeia a mudança de produção que o faria passar. Teste
que repete a implementação não é oráculo (`Expectativas independentes devem preceder a nova
medição`); o oráculo aqui é (i) o instrumento pinado, (ii) a referência primária citada, ou
(iii) bytes construídos por `.word`/`.short` que o montador não produziria.

Fixture autoral novo `fx12_absW` (montado com `as -m68000` pinado, `ld -Ttext 0`, `objcopy -j
.text` — receita `make-fixtures.sh`) + tabela de palavras `fx13_mascaras` (subconjunto de slots da
varredura §4 com o veredito do instrumento versionado).

- **N1 sinais** — `jsr/jmp (0x8000).w`, `(0xFFFF).w`, `(0x7FFF).w`, `(0x0001).w`: Q1/Q2/Q3 exatos
  por sítio; discrimina: qualquer regressão para zero-extensão em bit15=1 quebra Q2 e Q3 ao mesmo
  tempo que o `.W` de bit15=0 fica inalterado (o teste falha só no par que mudou).
- **N2 truncagem de bus** — word `0xFFFF` com Q2 `0xFFFFFFFF` ⇒ Q3 `0x00FFFFFF`, Q4 `fora-do-objeto`
  (a janela da ROM termina bem antes); discrimina: aplicar Q4 sobre Q3 (espelho inventado) em vez
  de sobre Q2.
- **N3 limites de região** — EA exatamente em `inicio`, `inicio+2`, `fim-2` e `fim` de uma janela
  pequena; `fim` é exclusivo: o sítio em `fim` tem de ser `fora-da-regiao` e a aresta correspondente
  tem de estar listada, não silenciosamente ignorada; discrimina: off-by-one em `regiao.1`.
- **N4 interior de instrução** — ilha com `4ef9 00004eb8` e `4eb8 80004ef9`: o **segundo word** de
  uma instrução real não pode virar Q1 de outra; exige veredito `miolo-de-instrucao` e
  `consumidor-validado: nao`; discrimina: um scanner linear que volte a aceitar aparência.
- **N5 caminho não alcançado** — mesma word `4eb8 8000` colocada como dados após `rts`, sem raiz
  que a alcance: veredito `dentro-regiao-nao-alcancado` e `alvo` **não publicado** como comprovado;
  discrimina: promoção por decodificação local.
- **N6 chamadas indiretas** — `4e90` (`jsr (a0),`), `4ed0` (`jsr (a0)+`), `4e99`…`4e9f`, `4efc`,
  `4eb9` com alvo fora da janela: `indireto-opaco`/`fora-da-regiao`, `promovivel-vinculo-estrutural:
  nao`, **e** consumo de extensões só onde a forma é documentada; discrimina: inventar comprimento
  para ler a extensão de um modo não suportado.
- **N7 formas de outra CPU** — `61 ff`, `4e fc`, `4e fd`, `4a fc` (illg), word indexada com
  bits 10-8 ≠ 0: recusas estáveis, com os motivos já congelados na ETAPA 2; o teste tem de
  mostrar que a **correta** semântica de `abs.W` **não** reabriu nenhuma dessas portas;
  discrimina: "consertar" a extensão de sinal trocando o subconjunto.
- **N8 DBcc/máscaras** — `51c8 8000` (disp16 = −32768) e `51c8 7fff` (disp16 = +32767), ambos com
  alvo = base `sitio+2` e queda em `sitio+4`; e `51ff`/`5cca` (formas reservadas) recusados
  conforme ETAPA 2; discrimina: a regra `disp8 = 0xFF` vazando para `DBcc` (E3-2).

**E5-1** — os negativos de `fx09/fx10/fx11` da ETAPA 2 são re-executados contra o decoder v2 sem
enfraquecer nenhuma asserção existente (nenhum `assert` removido ou afrouxado; se um caso v1
precisa de resultado diferente porque a semântica mudou, isso é tratado em §6 como **delta
re-derivado**, não como edição de teste).

---

## 6. Rederivação e deltas v1 → v2 (obrigação 3, parte "rederivar")

Reexecitar, com o binário v2 e os geradores `-v2` de §2:

`fx09_matriz`, `fx10isca`, `fx11assimetrica`, `S1 [0x1C024,0x1C0A4)`, `S2 [0x1C6B8,0x1C738)`,
censo das 16 iscas (Apêndice B da ETAPA 2), e R1/R2/R3 na ROM BYOR.

- **E6-1** — para cada sítio publicado em v1, uma linha na tabela de delta:
  `sitio | v1-alvo | v2-alvo | v1-veredito | v2-veredito | classe-do-delta`, com classes
  `invariante`, `alvo-corrigido`, `aresta-passa-fora-da-regiao`, `veredito-mudou`,
  `motivo-removedo`. Nenhuma linha pode ficar sem classe; nenhuma classe pode ser inventada
  depois (a lista acima é o domínio fechado).
- **E6-2** — a fração de cobertura **não** pode ser usada como argumento: se um número de
  cobertura cair (p. ex. menos arestas "resolvidas" porque o alvo era falso), a nota registra a
  queda como resultado desejado, não como regressão (§0.3).
- **E6-3** — o veredito do comparador contra o instrumento (`divergencias-criticas`) tem de ser
  **0** também nas amostras de ROM, e a série bruta do comparador vai para o
  `MANIFEST-ETAPA3-v2.md` (mesma política de E5 remediada na ETAPA 2: instrumento, veredito e
  série dentro do que é versionado).
- **E6-4** — R1 (Kosinski `0x189C..0x193C`, 160/160, 66 instruções) e R3 (28/28 com `0x1370→0x189C`
  declarado) têm de reproduzir comprimento **idêntico**; qualquer diferença em contagem de
  instruções na R1 é INCONCLUSIVE até explicada, porque o subconjunto decodificado lá não usa
  `abs.W` com bit15 — se usar, isso é um fato da tabela de delta, não uma mudança de meta.

---

## 7. Integração reavaliada com a frente A corrigida (obrigação 8)

**Sem copiar implementação.** A é somente-leitura para nós; a base da revisão é o SHA
`bd40e92269eb60b0df9b8ed0ddff561a0d19a4b3` (head do PR #107, ISA v1.1).

- **E7-1** — revisar as **alegações** de A contra a referência primária obtida aqui (Apêndice A),
  com cotação de `instr.rs` por linha, e publicar `REVISAO-C-DE-A-ETAPA3.md` por SHA. Pontos
  obrigatórios: a extensão de sinal de `(xxx).W` (A: `instr.rs:13-16`, `sign16(...) as u32` em
  134/182/206), a máscara `BARRAMENTO = 0xFF_FFFF` (A: `instr.rs:25-27`, "modelo de três níveis"),
  a base `sitio + 2` dos relativos (A: `instr.rs:261`), e as três recusais de forma (`61 FF`,
  `4E FC/FD`, indiretos por registrador). Veredicto por ponto: `confirmado-pela-referencia`,
  `divergente-da-referencia`, `alegacao-de-instrumento-so`.
- **E7-2** — distinção metodológica que temos e A não publica: A resolve `abs.W` por **três
  instrumentos** (binutils + wla + capstone); aqui a resolução é por **referência primária
  (PRM §2.2.16) com o instrumento pinado como confirmação**, e o campo exportado carrega a
  `fonte-da-semantica`. Isso é o que torna o resultado seguro para integração: o consumidor pode
  auditar a fonte sem reconstruir instrumento.
- **E7-3** — o caminho de consumo real de A (`verificar-sitios.py` + `cruzar-rexcfg-A.sh`, que hoje
  pinna o binário de `275f2af` e lê `esquema`/`sitios[].veredito`/`cobertura.vaos`/`raizes`/
  `fronteiras`) é re-executado **contra o binário v2** numa cópia nossa do script (nada é editado
  na worktree de A). Resultado esperado e registrado em duas partes: (i) quais verificações de A
  permanecem verdes com o objeto v2; (ii) quais pinos de A apontam para o v1 e portanto precisam
  de decisão dela — reportado ao principal, sem tocar na frente dela.
- **E7-4** — prova de não-cópia: o diff do nosso crate não introduce nenhuma string de identificador
  exclusiva de A (lista de nomes de `instr.rs` dela comparada com os nossos símbolos novos);
  declaração assinada no informe com o método usado.
- **E7-5** — proibição explícita: nada desta entrega promove `observado-em-runtime`, nada altera
  `crates/rex-gameplay` além do *path dep* somente-leitura já existente, nada toca `src/`,
  `src-tauri/`, UI, registry, Memory Bank ou ROUND_STATE.

---

## 8. Publicação por SHA para o principal e para D (obrigação 9)

- **E8-1** — `rex-cfg-sitio/v2` e `rex-cfg-med/v2` ganham uma seção de consumo em `INFORME-C.md §11`
  com: campos novos, o que significa cada um dos quatro endereços, e dois comandos prontos (um para
  D medir dimensões, um para A/qualquer consumer checar um sítio) com saída real de exemplo.
- **E8-2** — revisão por SHA endereçada explicitamente ao par **D** (frente da barra de
  avaliação, PR #106): lista dos sítios onde a v1 publicava `alvo` que a v2 retifica, porque é a
  D que consome `alvo` como dimensão separada. A medição de D sobre a v2 é trabalho dela; nós só
  entregamos o objeto e a tabela de delta.
- **E8-3** — publicação: um push por lote, PR #108 atualizado com a seção ETAPA 3, CI consultado
  **uma vez** no SHA final (sem observador permanente).

---

## 9. Critérios de meta, não-sucesso e gates

**Meta** (todas as cláusulas): §1 E1-1..E1-6; §2 E2-1..E2-3; §3 E3-1..E3-3; §4 E4-1..E4-4 com
`divergencia-critica = 0`; §5 N1..N8 + E5-1; §6 E6-1..E6-4; §7 E7-1..E7-5; §8 E8-1..E8-3.

**Não-sucesso** (registrado como FAIL/INCONCLUSIVE, com série bruta, sem reescrita):
qualquer `alvo` publicado sem `modelo-de-cpu` + `fonte-da-semantica`; qualquer `divergencia-critica`
em §4; qualquer byte mudado nos seis históricos de E2-1; qualquer forma nova na lista fechada;
qualquer teste de §5 que passe com o decoder *sem* o instrumento ou a referência como oráculo.

**Gates aplicáveis** (a entrega não toca `src/`, `src-tauri/`, UI nem manifests comuns):
`cargo test` da frente C, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check`,
`bash tools/make-fixtures.sh --check`, `npm run check:tree`. Os gates de app (`lint`, `tsc`,
`npm test`, `host:certify`) **não** são executados e isso é declarado no informe com o motivo
(superfícies não tocadas) — precedente ETAPA 1/2. `host:diagnose` é executado no início da sessão
por protocolo.

---

## Apêndice A — série bruta das sondas (executadas ANTES deste congelamento)

**Referência primária 1 — M68000PRM** (Motorola *M68000 Family Programmer's Reference Manual*,
NXP): `https://www.nxp.com/docs/en/reference-manual/M68000PRM.pdf`, 4 725 896 B, 646 págs,
sha256 `06e4864b78da0e815054cead9324b7ec9914661f240fd39a455f2061ff47c4e8`. Extração de texto:
`pdftotext -layout` (28 041 linhas).

**Referência primária 2 — MC68000UM** (Motorola/Freescale *M68000 8-/16-/32-bit Microprocessors
User's Manual*, NXP): `https://www.nxp.com/docs/en/reference-manual/MC68000UM.pdf`, 2 318 145 B,
sha256 `89b690b1923f8a3cff508567090bcab0bcd07511c2deff8ffa393a08efda18e1`.

Cotações (local na extração de texto, na ordem em que foram lidas):

```
PRM  2.2.16 Absolute Short Addressing Mode  (TOC p. 2-18; corpo: linha 2650 da extracao)
  "In this addressing mode, the operand is in memory, and the address of the operand is in the
   extension word. The 16-bit address is sign-extended to 32 bits before it is used."
  figura: "EXTENSION WORD | SIGN-EXTENDED | EXTENSION VALUE" / "OPERAND POINTER | CONTENTS"
PRM  2.2.17 Absolute Long  : "the operand's address occupies the two extension words ... first
  extension word contains the high-order part"  (nenhuma extensao de sinal)
PRM  §MOVEA (p. 4-119)     : "Attributes: Size = (Word, Long)"
                            "Word-size source operands are sign-extended to 32-bit quantities."
PRM  §DBcc  (p. 4-90)      : "... plus the sign-extended 16-bit displacement. The value in the
                            program counter is the address of the instruction word of the DBcc
                            instruction plus two."
PRM  Table 3-9 (p. 3-12)   : "DBcc, FDBcc   Dn,<label>   16"   vs   "Bcc, FBcc  <label>  8, 16, 32"
UM   §1.1   (p. 1-1)       : "The MC68000 has a 16-bit data bus and 24-bit address bus while the
                            full architecture provides for 32-bit address and data buses"
UM   §3    (p. 3-3)        : "Address Bus (A23-A0) ... This 24-bit, unidirectional, three-state bus
                            is capable of addressing 16 Mbytes of data."  + "In 16-Bit mode, A0 is
                            always driven high."
UM   Table 2-1 (p. 2-4)    : "Absolute Short   EA = (Next Word)   (xxx).W"  (so forma; a extensao
                            e do PRM)
```

**Instrumento pinado** (binutils 2.41; `as` sha256 `618740559477258165eb1a344e07acd592afc1438061825469d5bd56fa2c87c7`,
`objdump` sha256 `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f`). Série bruta
das sondas S1..S12 (reproduzível; cópia integral em `~/rds-scratch/xe-c3-sondas/sondas-{1,2,3}.log`,
fora do índice por §3 da política de evidência):

```
S1  as -m68000: jsr (0x1234).w / jsr (0x8000).w / jsr (0xFFFF).w / jmp (0x8000).w
    lea (0x8000).w,%a0 / pea (0x8000).w / move.l (0x8000).w,%d0 / jsr (0x11223344).l
    -> bytes: 4eb81234 4eb88000 4eb8ffff 4ef88000 41f88000 48788000 20388000 4eb911223344  rc=0
S2  as -m68000 / -m68020: "movea.b #4,%a0"  -> Error: Unknown operator ... ignored   rc=1 (ambos)
S6/S3  idem S1; codificacao identica em -m68000 e -m68020 (a word e o valor de 16 bits tal qual)
S7  as -m68000: "jsr (0xFFFF8000).w" -> 4eb88000  rc=0 SEM aviso (cabe como word com sinal)
    as -m68000: "jsr (0xFF8000).w"   -> Warning: expression doesn't fit in WORD      rc=0
    (eixo do GAS: a word e assinada; 0xFF8000 nao cabe nem assinado)
S8  objdump -b binary -m m68k -D sobre 4eb87ffe 4eb88000 4ef88000 4eb900008000 41f88000:
       0: 4eb8 7ffe   jsr 0x7ffe
       4: 4eb8 8000   jsr 0xffff8000          <-- bit15=1: exibido sign-extendido
       8: 4ef8 8000   jmp 0xffff8000
      12: 41f8 8000   lea 0xffff8000,%a0
      c: 4eb9 0000 8000  jsr 0x8000           <-- abs.L: sem extensao, long tal qual
S9  movem.l (0x8000).w,%d0-%a0 -> 4cf801ff8000 ; move.w #0,(0x8000).w -> 31fc00008000 ;
    clr.l (0x8000).w -> 42b88000 ; jmp (0x8000).l -> 4ef900008000 ; bsr (0x8000).w -> 6100 0000
    (objdump: moveml 0xffff8000 / movew #0,0xffff8000 / clrl 0xffff8000 / jmp 0x8000 / bsrw 0x18)
S10 as: movea.w #4,%a5 -> 3a7c 0004 (4 bytes) ; movea.l #4,%a5 -> 2a7c 0000 0004 (6 bytes) ;
    movea.w #4,%a0 -> 307c 0004 ; movea.l #4,%a1 -> 227c 0000 0004 ; movea.w %a2,%a3 -> 364a ;
    movea.l %a2,%a3 -> 264a ; movea.w (0x1234).w,%a4 -> 3878 04d2 ; movea.l (0x1234).l,%a4 ->
    2879 0000 04d2   (confirmado: MOVEA so existe em .W/.L; .B nao e codificavel)
S11 as: "move.b #4,%a0" -> Error: operands mismatch (rc=1) em -m68000 e -m68020
S12 objdump sobre lea/move/movea/pea/jmp com word 0x8000/0xFFFF: todos exibidos como
    0xffff8000 / 0xffffffff (lea ffff8000,%a0; movel ffff8000,%d0; moveaw ffff8000,%a1;
    pea ffff8000; jmp ffffffff)
S5  as -m68000 + ld -Ttext 0: dbf %d0,loop (loop em 0x02) -> 51c8 fffc  (base = 0x06, disp = -4)
    dbra %d0,longe (longe em 0x266)             -> 51c8 025c  (+604, impossivel em disp8)
    objdump: "51c8 fffc  dbf %d0,2 <loop>" / "51c8 025c  dbf %d0,266 <longe>"
V1  varredura exaustiva: corpus 1 MiB = 65.536 slots de 16 bytes (word = indice do slot, resto
    4e71); objdump -b binary -m m68k -D -> 502.055 registros, UM registro em cada inicio de slot
    (65.536/65.536, drift 0), 14.292 slots como ".short". Mais frequente: movew 3256, movel 3166,
    moveb 2658, moveq 2048, subw/subl/addw/addl 824 cada, orb/orw/orl 760 cada.
```

Nota de método: `objdump -d` (só seções) **não** imprime nada sobre `-b binary`; o flag correto é
`-D`. A sonda registrou isso porque o primeiro piloto deu 0 registros — a correção é do
instrumento de medição, não do resultado.

## Apêndice B — o que estas páginas NÃO provam

1. Nada aqui é **observação em runtime**: não executamos ROM, não lemos barramento, não alegamos
   que o Mega Drive espelha `0xFF8000` em RAM. A Q3 é aritmética do modelo MC68000 com citação de
   pino; a decodificação de memória do console é propriedade da placa e **não** é afirmada.
2. Paridade com objdump continua sendo **árbitro de comprimento e de exibição**, não prova de
   equivalência arquitetural; onde as duas coisas divergiriam, a referência primária manda, e a
   divergência seria registrada (§4 E4-2).
3. As contagens de delta (§6) e de classes (§4) são resultados a medir. Este documento não prevê
   nenhum delas; previsão aqui seria o erro de processo que a ETAPA 2 já registrou duas vezes.
4. BYOR: a ROM usada é a mesma pinada (`c7da53a1…c81ebb`, 531 577 B), somente-leitura, fora do
   índice. Nenhum byte comercial entra em arquivo versionado.
