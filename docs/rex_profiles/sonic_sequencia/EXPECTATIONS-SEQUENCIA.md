# EXPECTATIONS-SEQUENCIA — edição da ORDEM das entradas do script `id_Wait`

Frente: próximo incremento funcional (PARTE 2), PR **dependente** sobre a
proposta integrada da Sonic (base `codex/rex-sonic-consolidacao`).

Este arquivo é o **contrato de expectativas congelado ANTES de qualquer
implementação ou execução**. Regra da frente (memória
`freeze-expectations-before-any-proof-run`): se o resultado observado divergir
desta lista, o veredicto é **FAIL / INCONCLUSIVE com a série bruta registrada**;
o arquivo **não é reescrito** depois.

## 0. O que é este incremento (e o que NÃO é)

- **É**: reordenar, no próprio script `id_Wait`, a sequência das 18 entradas de
  referência de moldura (frame), **in place**: mesmo comprimento de script,
  terminador `FE 02` preservado, sem realloc, sem expansão, sem mudar DPLC.
- **Não é**: editar a duração (isso é a frente de cadência #100, byte único
  `0x13BAE`); mudar o número de frames; introduzir valor de frame novo; tocar
  qualquer outro byte da ROM; engenharia reversa universal / outros jogos /
  animações dependentes de velocidade.

## 1. Fatos de byte provados contra a ROM pinada (pré-condição, não expectativa)

- ROM BYOR Sonic 1 USA/EU, 531577 B, SHA-256
  `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` (confere).
- Tabela `Ani_Sonic` em `0x13B48` (31 palavras BE, offset relativo à base).
  Entrada da anim 5 (`id_Wait`) → script em `0x13BAE`. Próxima entrada (anim 6)
  → `0x13BC4`.
- Script `id_Wait` (bytes literais, verificados por despejo):
  - `0x13BAE` = `17` (intervalo; domínio da CADÊNCIA, **fora** deste incremento)
  - `0x13BAF..0x13BC0` = 18 entradas:
    `01 01 01 01 01 01 01 01 01 01 01 01 03 02 02 02 03 04`
  - `0x13BC1..0x13BC2` = `FE 02` (terminador `afBack k=2`)
  - `0x13BC3` = `00` (padding) — **não** tocar
  - `0x13BC4` em diante = script da anim 6 — **não** tocar
- **Conjunto de bytes autorizado deste incremento**: exatamente
  `0x13BAF..0x13BC0` (18 bytes). Nenhum outro offset é escrevível.

## 2. Domínio válido de cada entrada

- Cada entrada é uma referência de moldura (frame) já presente no script
  original. O multiconjunto original é `{01×12, 02×3, 03×2, 04}`.
- Este incremento é uma **permutação** desse multiconjunto: nenhum valor novo
  é escrito, logo toda entrada continua sendo uma referência que o produto já
  compõe/valida (pipeline de composição da frente multiframe #99). Por
  construção, "só referências que o produto já compõe" vale.
- Valores **reservados/nunca aceitos** como entrada: `$00` (degenerado),
  `$80..$FF` (bit 7 = handler especial), e os tokens de script `$FD $FE $FF`
  (não são molduras). Uma permutação válida jamais produz esses bytes, pois só
  reorganiza os 18 existentes.

## 3. Efeito do `FE 02` sobre o loop (documentado; usado na prova)

- `afBack $FE` com k=2: ao chegar ao terminador, retrocede 2 entradas e **repete
  para sempre as duas últimas posições** do script. No original, as duas
  últimas são `03`,`04` (batida de pé).
- Consequência direta para a reordenação: como o loop fixa **posições** (não
  valores), mover entradas distintas para as duas últimas posições muda o que
  é visto em regime estacionário, e mover uma entrada distinta para a
  **primeira** posição muda o que é visto no primeiro passo — ambos
  observáveis no core.

## 4. Compartilhamento / consumidores

- Único leitor do script: a caminhada sequencial de `Sonic_Animate`, acionada
  pelo deslocamento da tabela em `0x13B48` (contrato #100 §4: prólogo único em
  `0x139C4`, referência absoluta única em `0x139C6`).
- Nenhum outro script nem outra entrada da tabela aponta para dentro de
  `0x13BAF..0x13BC0` (tabela tem 31 deslocamentos distintos; anim 5 aponta
  `0x13BAE`, anim 6 aponta `0x13BC4`). A região de reordenação pertence só ao
  `id_Wait`. **Não** há aliasing que obrigue confirmação de compartilhamento.

## 5. CRITÉRIOS CONGELADOS da prova (o que DEVE acontecer)

Só se declara sucesso se **TODOS** passarem. Qualquer desvio = FAIL/INCONCLUSIVE
com série bruta anexada; nada é reescrito depois.

Positiva (discriminante, pela UI real, ponta a ponta):
1. **Sequência discriminante pré-escolhida**: mover a primeira `03` (posição
   original 12) para a **posição 0**, produzindo
   `03 01×12 02 02 02 03 04` (multiconjunto preservado; o primeiro frame
   observado passa de `01` a `03`). Uma permutação que troque duas entradas
   **idênticas** (ex.: `01`↔`01`) é declarada **NÃO-prova** e não conta como
   positivo.
2. Fluxo real, na interface: **abrir → editar ordem → aplicar à cópia →
   exportar/reaplicar BPS → salvar → reiniciar → reabrir → executar** — o byte
   reordenado deve chegar ao core por esse caminho, nunca por injeção direta.
3. **Verificador independente** (sem importar módulo de produto) confere:
   a. bytes em `0x13BAF..0x13BC0` = a permutação proposta;
   b. `0x13BAE` (intervalo), `0x13BC1..0x13BC2` (`FE 02`), `0x13BC3` (pad `00`)
      e `0x13BC4` (início da anim 6) **intactos**;
   c. **ordem de frame observada no core** corresponde à permutação (assinatura
      do primeiro frame = arte `03`, não `01`), usando **sprites reais**
      (pixels/paleta compostos pelo produto), **sem** placeholder, **sem**
      imagem antiga, **sem** framebuffer mudo (não-preto verificado);
   d. demais edições preservadas (pixel, paleta, cadência/duração — a ordem é
      a única coisa que mudou);
   e. **restauração seletiva** devolve exatamente a ordem original dos 18 bytes
      (e só ela).
4. **proposto ≠ aplicado**: a UI distingue claramente a ordem proposta da ordem
   aplicada (o aplicado só existe após confirmar/gravar na cópia).
5. **Reordenar miniaturas ≠ reordenar a ROM**: a prova do byte na ROM é
   independente do preview de miniatura; miniatura é ilustração, não evidência.

Negativos (cada um deve RECUSAR sem escrever, e a cópia fica byte a byte
inalterada):
- `frame-inválido`: entrada fora do domínio (ex. valor não presente no
  multiconjunto / byte que colide com token) → recusa.
- `token-reservado`: tentativa de escrever `$FD/$FE/$FF` como moldura → recusa.
- `comprimento-divergente`: operação que mudaria o tamanho do script (realloc /
  inserir/remover entrada) → recusa (in-place estrito).
- `sessão-errada`: aplicar a reordenação com id de sessão divergente da ROM
  carregada → recusa.
- `resposta-antiga`: ack/resposta de época de core anterior à atual → descartada.
- `cópia-adulterada`: working copy cujo intervalo/terminador/não-id_Wait difere
  do contrato antes da escrita → recusa.
- `fora-do-script`: qualquer pedido de escrita fora de `0x13BAF..0x13BC0`
  (inclui `0x13BAE`, `0x13BC3`, vizinhos) → recusa, zero bytes alterados.

Comparação visual: usa **sprites reais** compostos pelo produto; a captura
defeituosa/não-preta e o negativo magenta (da frente visual) continuam
reprovando o comparador — não se troca correção por artefato de ambiente.

## 6. Métricas e limites de honestidade

- Nenhum ganho de usabilidade é declarado sem participante humano.
- Superfície permanece **Experimental** até a prova ponta a ponta verde.
- Sem ROM/binário no repositório; só BYOR + patches IPS/BPS + evidência com SHA.
- Gates da barra mínima rodam no destino desta frente e são reconciliados com
  o que foi **realmente executado** (clippy `--all-targets` e usabilidade
  permanecem "não aprovados/não declarados" conforme memória da frente).

## 7. Sequência de execução desta frente (para o plano, não expectativa nova)

- P2: backend (read/validate/permute das 18 entradas com os recusos do §5) +
  UI (selecionar entrada, mover antes/depois, reconhecer repetições, comparar
  original vs proposta, aplicar à cópia, restaurar só a sequência) — TDD,
  testes discriminantes primeiro.
- P3: prova da sequência discriminante pela UI real + os 7 negativos +
  BPS/reinício/reabertura + verificador independente.
- P4: gates, evidência durável com SHA, PR dependente, CI terminal por SHA, sem
  merge.

---

## 8. ADENDA CONGELADA 2026-10-04 — fluxo integrado (três pendências)

Congelada **antes** de qualquer código ou execução desta rodada (regra
`freeze-expectations-before-any-proof-run`). Não reescreve §0–§7; acrescenta.
Desvio observado = FAIL/INCONCLUSIVE com a série bruta anexada; o arquivo não é
reescrito depois. Custos de rebuild pertencem à missão, não são motivo para novo
GO. Base desta frente: `codex/rex-sonic-consolidacao` @ `5340002` (PR #103),
dica atual `cb56657` (PR #104). Worktree exclusivo
`REX-SONIC-SEQUENCIA-2026-10-03`. **Sem merge remoto, release ou promoção.**

### 8.1 Pendência 2 — integração cadência ↔ sequência (validação compartilhada)

Fato no código (não assumido): hoje `sonic_cadence::script_bytes_match` exige a
ordem de molduras **exatamente** `WAIT_FRAMES` também na **cópia**, então editar
a duração **depois** de reordenar é recusado (`cadence_structure_mismatch`).
Isto torna os dois domínios incompatíveis no mesmo estado integrado. Critérios
congelados da correção:

- **Base (perfil original) — validação ESTRITA**: `validate_base` continua
  exigindo intervalo `$17`, as 18 molduras na ordem original exata, terminador
  `FE 02`, tabela/prólogo/referência absolutos únicos. Qualquer divergência na
  base é recusada. A base nunca aceita permutação.
- **Cópia (com alterações autorizadas) — validação por `validate_copy`
  compartilhada, UMA única definição** usada por `sonic_cadence`
  (`read_interval`/`set_interval`/`describe`) **e** `sonic_sequence::check_copy`
  **e** a guarda global de composição em `sprite_composition::read_sonic_session_rom`.
  `validate_copy` confere: comprimento; intervalo em `$01..$7F` (não `$00`,
  não bit 7); a janela `0x13BAF..0x13BC0` é **permutação válida** do
  multiconjunto `{01×12,02×3,03×2,04}` (toda entrada em `0x01..=0x04` e
  contagens idênticas); terminador `FE 02` íntegro. Não confere ordem exata.
- **A guarda global NÃO é removida** para o teste passar; é realinhada para a
  mesma `validate_copy` (uma definição do script, não duas).
- `describe` da cadência passa a reportar a **ordem real da cópia** (lida do
  buffer) como `current_frames`, mantendo `original_frames = WAIT_FRAMES`; a
  UI integrada mostra a ordem vigente correta em vez de fingir a original.

Round-trips que DEVEM passar (todos):
1. **cadência→sequência**: editar duração e depois reordenar — ambos aplicados
   na mesma cópia; resultado tem novo intervalo **e** nova ordem.
2. **sequência→cadência** (direção antes bloqueada): reordenar e depois editar a
   duração — agora **permitido**; a cadência aceita a permutação válida.
3. **Comutatividade byte a byte**: a janela das 18 molduras e o byte do intervalo
   são disjuntos; aplicar (duração→ordem) e (ordem→duração) converge para a
   **mesma cópia** e o **mesmo SHA-256**.
4. **Preservação de arte+paleta**: reordenar (e editar duração) não altera
   nenhum byte de arte/paleta; o diff cumulativo contra a base é exatamente
   {2 bytes de arte, 2 bytes de paleta, 1 byte de intervalo, N bytes da janela de
   ordem} — nada fora.
5. **Salvar/destruir/reabrir mantém controles utilizáveis**: após salvar e
   reabrir a sessão, `describe` de **ambos** os domínios (cadência e sequência)
   lê a cópia reordenada+durada sem recusa; `current_interval` e
   `current_frames` refletem o estado aplicado.
6. **Restaurar só a sequência**: devolve as 18 entradas à ordem original e
   **só** ela; duração, arte e paleta permanecem aplicados.
7. **Restaurar só a duração**: devolve `0x13BAE` a `$17` e **só** ela; ordem,
   arte e paleta permanecem aplicados.

Negativos congelados (recusam sem escrever; cópia byte a byte inalterada):
- `validate_base` recusa base com ordem adulterada, intervalo ≠ `$17`,
  terminador alterado, tabela/prólogo deslocados (inalterado em relação a §5 e
  ao contrato de cadência).
- `validate_copy` recusa: intervalo `$00`/bit 7 na cópia; terminador alterado;
  janela cujo multiconjunto ≠ original (não é permutação); entrada que não é
  referência `$01..$04`.
- Escrita fora de `0x13BAF..0x13BC0` (ordem) ou fora de `0x13BAE` (duração) →
  recusa, zero bytes alterados.

### 8.2 Pendência 3 — prova do percurso completo e do terminador `FE 02`

Limite da prova herdada (fato, não expectativa): a prova anterior só asserta o
**primeiro** frame `01→03` com a proposta A `swap(0,12)`. A proposta A **não**
discrimina o laço `FE 02`, pois mantém as duas últimas posições em `03 04`
(idênticas à base). O laço é **por posição**, então para comprovar o terminador
é preciso uma proposta que torne as duas últimas posições **distintas** da base.

- **Proposta B congelada (prova do laço): `swap(0,17)`** sobre `WAIT_FRAMES`.
  Layout resultante (posições 0..17):
  `04, 01×11, 03, 02, 02, 02, 03, 01`
  multiconjunto preservado `{01×12,02×3,03×2,04}`; in-place estrito; intervalo,
  terminador e pad intocados. Consequências previstas (a partir dos bytes do
  consumidor, não de adivinhação):
  - **primeiro frame observado** = arte referenciada pela posição 0 = valor
    `$04` (base `$01`) → discrimina a cabeça do roteiro;
  - **par em regime estacionário** = posições 16,17 = valores `$03`,`$01`
    (base `$03`,`$04`) → **só** muda se o `FE 02` retrocede por posição;
    observar `03↔01` em loop comprova o terminador; observar `03↔04` = a
    reordenação vazou ou o laço ignora a ordem → FAIL.
  - **percurso inicial previsto**: `$04` (pos0), `$01`×11 (pos1..11), `$03`
    (pos12), `$02`,`$02`,`$02` (pos13..15), `$03` (pos16), `$01` (pos17), então
    `afBack 2` → `$03`,`$01` repetidos para sempre. Cada troca segurando
    intervalo vigente (`$17` → 24 frames de tela NTSC por `H_N+1`, duração não
    alterada nesta prova).
- **Descoberta SEM adivinhar offsets**: o campo de **posição da sequência**
  (`obAniFrame`) é descoberto por **voto temporal** no core real, igual ao
  método que descobriu `obTimeFrame` na sonda de cadência: procurar byte que
  (a) incrementa de 1 a cada troca de frame dentro do primeiro percurso,
  (b) reseta/retrocede conforme o `afBack`, e (c) correlaciona com o byte de
  arte observável no framebuffer. A base do objeto do jogador é a já descoberta
  (`0xD001`; frame=`+0x1A`, anim=`+0x1C`, timer=`+0x1E`). Nenhum offset novo é
  declarado por suposição: se a assinatura posicional **não** for descoberta com
  confiança (votos e correlação), a rodada declara **PARCIAL** (só primeiro
  frame) e **não** alega o percurso completo — registre, não force.
- **Observação controlada em frames emulados, separada da interação**: a série
  bruta de `(frame, posição, valor, hash-ROI)` é produzida por corrida headless
  determinística no core Libretro real com a BYOR pinada, alcançando `id_Wait`
  por input nativo (soltar botões após parar em chão plano). Não é jornada de
  UI e não confere prova de teclado.
- **Verificador independente** (node puro, sem importar módulo de produto)
  reconstrói o percurso a partir da série bruta e **recusa**: (i) troca de duas
  entradas idênticas contada como positivo; (ii) sequência que não casa com a
  proposta B; (iii) terminador alterado; (iv) série antiga (SHA/época divergentes);
  (v) **amostras insuficientes** (menos de um percurso inicial completo **e**
  pelo menos um ciclo estável `03↔01` medido). Cada recusa = FAIL/INCONCLUSIVE
  com a série anexada.

### 8.3 Pendência 1 — jornada desktop §5.2 na UI real (integrada)

No **binário canônico final**, via **interface visível** (WebDriver/tauri-driver
no Xvfb pinado `5bfd315a…`), sequência congelada de passos:

1. abrir BYOR (identidade da ROM com SHA-256 exibida e conferida na UI);
2. **mover uma entrada distinta** (proposta B `swap(0,17)`) e **aplicar** à cópia;
3. **editar a duração** (byte de cadência) na mesma cópia reordenada (exige a
   integração 8.1 — a UI não pode recusar);
4. conferir a cópia (diff = exatamente os bytes autorizados dos dois domínios);
5. exportar/reaplicar BPS;
6. salvar; **destruir a janela**; reiniciar o app; **reabrir** a sessão;
7. **executar** no core e conferir o sprite realmente apresentado;
8. **restaurar seletivamente** pela UI (só a ordem; só a duração) e conferir o
   estado restante.

Exigências congeladas durante a jornada:
- **proposto ≠ aplicado**: a UI distingue a ordem **proposta** da **aplicada**; o
  "aplicado" só existe após confirmar/gravar na cópia (um botão mover não prova
  nada até aplicar).
- **seleção correta** por **hit-test** real: clicar a entrada na posição desejada
  seleciona exatamente aquela posição (pos0 e pos17 para a proposta B), não a
  vizinha.
- **identidade carregada** visível e conferida (SHA-256 da BYOR).
- **sprite realmente apresentado**: framebuffer **não-preto** verificado e arte
  composta pelo produto (sem placeholder, sem imagem antiga remanescente).
- **ausência de imagem antiga**: depois de aplicar/reabrir, a prévia e a ROM
  refletem a nova ordem; a captura defeituosa/não-preta e o negativo magenta
  (da frente visual) continuam reprovando o comparador.
- **negativos dos novos controles** + **respostas atrasadas**: sessão divergente
  e ack de época anterior à atual são recusados/descartados pela UI.
- **Honestidade de attribution**: qualquer passo que use injeção direta no core
  é rotulado **sonda técnica**, nunca provado como "teclado". A jornada §5.2 usa
  input nativo; se algum segmento recorrer a injeção para alcançar estado, isso é
  declarado como sonda e a prova de interação não é creditada a ele.

Custo de rebuild (binário canônico) pertence a esta missão. **Nenhuma alegação
universal**: o que se prova é o estado integrado `id_Wait` Rev00 nesta BYOR
pinada, NTSC, caminho não-especial.
