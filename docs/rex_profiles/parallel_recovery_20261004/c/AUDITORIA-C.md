# AUDITORIA — frente C, ETAPA 1 (rex-cfg/v1) — autoauditoria com comandos reproduzíveis

Duas seções servem a propósitos diferentes: **§1** é a lista de critérios que esta
entrega promete e o veredito medido de cada um; **§2** é o inventário de **coisas que
esta entrega não promete e não provou**, que é onde um auditor deve bater primeiro.
**§3** verifica o protocolo do round (território, corpus, dependências, gates).
**§4** dá os comandos para refazer tudo e os hashes de referência.

Convenção de veredito (memória `feedback-rex-gate-reconciliation`): um critério só é
**APROVADO** se saiu de uma execução gravada em evidência versionada; **DESVIADO** quando
o medido contraria o texto congelado (com série bruta no adendo); **NAO EXECUTADO**
quando falta ao ambiente ou à regra de serialização — nunca "verde" por inferência.

---

## 1. Critérios congelados × medido

### 1.1 Fixtures (`EXPECTATIONS-ETAPA1.md` §1)

| Fixture | Expectativa congelada (resumo) | Veredito | Onde |
|---|---|---|---|
| `fx01_branches` | alvos == objdump; `bne.w` não usa base do fim; caminho para no `rts` | **APROVADO** | `fx01_cada_aresta_de_desvio_reproduz_o_alvo_do_instrumento`, `fx01_o_alvo_da_formula_errada_nao_aparece_no_grafo`, `fx01_o_caminho_termina_no_rts_sem_aresta_de_volta`, `fx01_sitio_dentro_de_instrucao_e_miolo_nao_inicio` |
| `fx02_extended` | `disp8=0` resolve por extensão word com base `instr+2`; `disp8=0xFF` = fronteira sem comprimento inventado | **APROVADO** | `fx02_disp8_zero_resolve_pela_extensao_word_com_base_instr_mais_2`, `fx02_disp8_ff_produz_fronteira_sem_reclamar_comprimento` |
| `fx03_dbcc` | duas arestas por DBcc, alvos iguais ao objdump | **APROVADO** | `fx03_dbcc_tem_duas_arestas_e_bate_com_o_instrumento` |
| `fx04_calls` | `chamada` resolvida; continuação pós-chamada analisada; `rts` sem aresta de volta; subrotina vira bloco | **APROVADO** | `fx04_chamadas_tem_alvo_resolvido_e_a_subrotina_vira_bloco_dentro_de_fluxo`, `fx04_sitio_de_chamada_fora_da_regiao_continua_instrucao_de_bloco` |
| `fx05_indirect` | `indirect-opaque`, `alvo=nulo`, nenhum alvo sugerido | **APROVADO** | `fx05_a_raiz_declarada_mantem_o_grau_candidato`, `fx05_indiretos_param_e_nao_sugerem_alvo` |
| `fx06_data_opcodes` | dados após `rts` não cobertos; vao cobre o span; veredito conforme `--region` | **APROVADO** | `fx06_com_regiao_parando_no_rts_o_sitio_e_fora_da_regiao`, `fx06_bytes_de_data_nao_sao_cobertos_e_o_vao_cobre_o_span_inteiro` |
| `fx07_out_of_region` | aresta `fora-da-regiao`, nenhum byte fora decodificado, fronteira registrada | **APROVADO** | `fx07_desvio_fora_da_regiao_para_a_analise_sem_leer_fora` |
| `fx08_relative_base_historico` | alvo == objdump == `instr+2+disp`; valor da fórmula errada registrado como NÃO produzido | **APROVADO** | `fx08_alvo_da_ferramenta_igual_ao_instrumento_e_igual_a_instr_mais_2_mais_disp` |
| unidades sem montagem | fórmula contra `rex-gameplay::m68k::decode` (comprimento e alvo idênticos) | **APROVADO** — 3 testes em `tests/historico_base.rs`: `paridade_com_rex_gameplay_m68k_nas_formas_comuns`, `base_de_desvio_e_instrucao_mais_2_e_nao_fim_da_instrucao`, `ambos_param_em_opcode_fora_dos_dois_subconjuntos` |

Ressalva que não pode sumir da tabela: em `fx04` o sítio `0x10` **não discrimina** as
duas fórmulas (elas coincidem ali); o discriminante real está em `fx01`, `fx08`, R1 e R2.
Registrado no adendo §I, sem afrouxar o teste.

### 1.2 ROM — R1, R2, R3 (§2 do congelado)

| Critério | Promessa congelada | Medido | Veredito |
|---|---|---|---|
| R1.1 | 160/160, 0 fronteiras de opcode, 0 arestas `fora-da-regiao`, terminador `RTS` em `0x193A` | exatamente isso (log `OK` ×4) | **APROVADO** |
| R1.2 | tabela ouro × ferramenta × objdump bruto; divergência ferramenta/objdump = FAIL; tabela/objdump = INCONCLUSA | paridade ferramenta×objdump **66/66, 0 divergências**; tabela manual diverge em 10 linhas (12 endereços) | **APROVADO** (ferramenta) + **DESVIADO** (tabela) → adendo §B |
| R1.3 | `dbf 0x18AC → 0x18BA`; `beq.w 0x1930 → 0x18AA` | `0x18AC → 0x18BA` ✓; `0x1930 → 0x18A8` (instrumento), e a fórmula histórica daria `0x18AC` | **DESVIADO** (parentêntese invertido) → adendo §C; discriminante preservado |
| R1.4 | 66 instruções; 5 DBcc nas posições dadas; ≥5 laços para trás; `chamadas=[]` | 66; `[0x18AC,0x18C8,0x18DC,0x18EE,0x1922]`; 5; `[]` | **APROVADO** |
| R1.5 | parar antes de 160/160 = FAIL da expectativa 1, não releitura | não parou: 160/160, 0 fronteiras | **APROVADO** |
| R2.1 | `tst.abs.L` 6B em `0x206`; `0x20C→0x214`; `tst` 6B em `0x20E`; `bne.w` em `0x214` com alvo `0x292` | tudo ✓, exceto o rótulo: `0x214` é `bnes` de **2B** | **APROVADO** (alvos) + **DESVIADO** (rótulo/comprimento) → §D |
| R2.2 | `lea` em `0x218`, `movem` em `0x21C`; primeira fronteira antes de `0x256` | `lea` em **`0x216`**, `movem` em **`0x21A`** (+`moveml` `0x21E`); fronteiras `0x23A`, `0x292` | **DESVIADO** (endereços +2) → §D; "antes de `0x256`" ✓ |
| R2.3 | aresta de `0x292` `fora-da-regiao`; nada ≥ `0x2A0` decodificado | ambos ✓ | **APROVADO** |
| R2.4 | cobertura < 154 e `vaos` não vazio | 54/154 = 0.3506; 2 vaos (`0x23A..0x292`, `0x294..0x2A0`) | **APROVADO** |
| R2.5 | 4 sítios `fora-da-regiao` e o relatório declara que isso nada diz fora da região | vereditos ✓; a declaração está em `INFORME-C.md` §4 e nos `limites` do JSON | **APROVADO** |
| R3.1 | `lea` 6B `0x1364`; `move.abs.L→D1` 6B `0x136A`; `bsr.w` `0x1370→0x189C`; `0x189E` ausente; aresta `chamada` resolvida mas não andada | ✓, exceto rótulo de `0x136A`: é `lea (0x00a00000).l,%a1` | **APROVADO** + **DESVIADO** (rótulo) → §E |
| R3.2 | continuação 8B pós-`bsr`; `nop`s até `0x1380`; fronteira `limite-de-regiao` | `movew #(0x0000),(0x00a11200).l` 8B em `0x1374`; `4e71` ×2; fronteiras `0x1370`/`0x1380` `limite-de-regiao` | **APROVADO** |
| R3.3 | 9 vereditos de sítio nomeados um a um | os 9 idênticos aos medidos | **APROVADO** |
| §3 meta | nenhum grau sobe; inconclusivo permanece; número só de evidência commitada com SHA+comando | verificador checa `grau == proveniencia` e `params/clobbers` constantes em **todos** os casos; nada promovido; §H do adendo declara o choque entre "evidência commitada" e "não versionar conteúdo de ROM" | **APROVADO** (graus) / **PENDENTE de decisão do operador** (localização da evidência) |

### 1.3 Contrato (`CONTRACT.md`) × implementação

| Cláusula | Estado |
|---|---|
| §2 CLI (flags, ordem, códigos 0/1/2, `--bin` somente-leitura) | **APROVADO** — 9 testes de CLI (`tests/cli.rs`) cobrem uso errado (exit 2), erro de análise (exit 1), `--origin` deslocando endereços exportados, e `--md` batendo com o JSON |
| §3 lista fechada + fronteira para fora dela | **APROVADO** — tabela em `src/decode.rs`; recusas pinadas por endereço (adendo §F). Uma ampliação foi **recusada** de propósito: `%pc` como operando de ALU/MOVE, que o instrumento aceita e o §3 não autoriza |
| §4 saída `rex-cfg/v1` ordenada e determinística | **APROVADO** — `export_e_deterministico_byte_a_byte`, `cabecalho_identifica_esquema_ferramenta_e_objeto`, `corpo_usa_o_vocabulario_de_textos_do_contrato`, `fronteiras_registradas_tem_tipo_do_vocabulario_e_motivo_legivel`, `cobertura_soma_comprimentos_e_a_fracao_e_texto_inteiro`, `markdown_resumo_cita_os_mesmos_numeros_do_json` |
| §5 testes exigidos (instrumento independente, cross-check, ROM fora de CI) | **APROVADO** — paridade por registro em 2 corpus; cross-check com `rex-gameplay`; nenhum teste lê a ROM (só `executar-evidencia-C.sh`, que é script de evidência, não teste) |
| §6 limites assumidos | **APROVADO e impresso** — os 6 limites aparecem no array `limites` de cada JSON e no resumo Markdown |

## 2. O que esta entrega NÃO prova (lista para o auditor, não para o relatório de sucesso)

1. **Nenhum uso no produto.** Nada em `src-tauri/`, `src/` ou UI consome `rex-cfg`; a
   superfície é backend de script. Status honesto: **Experimental**, não "integrado".
2. **Nenhuma execução de código 68k.** Nada aqui observa runtime; `observado-em-runtime`
   não é alegado em campo algum dos JSONs.
3. **Nenhum desmontador universal.** Cobertura de 0.3506 em R2 é o contraexemplo
   deliberado: a ferramenta para onde o contrato não cobre.
4. **`miolo-de-instrucao` é relativo ao fluxo daquela região.** Não afirma "este byte é
   dado"; afirma "não é início de instrução no fluxo que esta análise percorreu".
5. **Alcance do subconjunto medido, não provado completo.** A tabela é validada contra
   2 corpus autorais + 8 fixtures + 87 registros de ROM; formas 68000 legítimas fora
   desses corpus podem estar recusasadas. Nada aqui diz *quais* faltam. A tabela é
   validada contra 2 corpus autorais + 8 fixtures + os 87 registros da ROM efetivamente
   comparados com o instrumento (66 em R1, 15 em R2, 6 em R3).
6. **Proveniência é declarada, não verificada.** `--root-prov referencia-estatica` /
   `vetor-plataforma` são palavras do operador; a ferramenta recusa vocabulário
   estrangeiro mas não comprova a frase histórica. Os três sítios da FASE6 e o valor do
   vetor foram reproduzidos por `dd`/`sha256sum` no script, o que é checagem de byte, não
   de semântica.
7. **Gates do app não executados** (`npm run lint`, `npx tsc --noEmit`, `npm test`,
   clippy/test do `src-tauri`, `host:certify`): ver §3.4.
8. **Sem reprodutibilidade em outra máquina.** O instrumento é o binutils 2.41 **deste
   host**, pinado por caminho; em outra máquina o `make-fixtures.sh --check` falha com
   mensagem clara, o que é o comportamento certo, não um passe.

## 3. Conformidade com o protocolo do round

### 3.1 Território exclusivo
`git status --porcelain` na entrega: apenas `data/rex_profiles/parallel_recovery_20261004/`
e `scripts/rex_profiles/parallel_recovery_20261004/` como não rastreados, mais os 4 docs
novos em `docs/rex_profiles/parallel_recovery_20261004/c/`. **Zero arquivos rastreados
modificados.** `crates/rex-gameplay` é consumido por path-dep somente-leitura; nada em
`crates/`, `src/`, `src-tauri/`, manifests de workspace, lockfiles do app, harness ou
Memory Bank foi alterado. `npm run check:tree`: OK.

Um desvio de território foi cometido e corrigido nesta sessão: a sonda `tools/bits.py`
foi criada primeiro **fora** do diretório da frente; movida para
`scripts/…/c/tools/bits.py` e o diretório pai removido.

### 3.2 Corpus BYOR somente-leitura e não versionado
- A ROM é aberta com `File::open` (nunca escreve); `--bin` aponta para o caminho local.
- Nada de ROM ou derivado direto no índice: `git add -n --all` nos dois diretórios novos
  lista 50 arquivos, todos código-fonte, corpus autoral, fixtures `.bin` montados por nós,
  dumps de corpus autoral e evidência **redigida**. Os `.bin` versionados são produto do
  nosso `.s` autoral, não da ROM.
- Identidade por SHA-256 em `MANIFEST.md` (ROM, vetor, 3 pinos de região, 9 artefatos).
- Brutos de ROM (JSON com mnemônicos, dumps `-objdump-bruto.txt`) ficam em
  `~/rds-scratch/xe-c-evidencia/` com hash declarado. Ver adendo §H para o choque com o
  texto congelado e a decisão pedida ao operador.

### 3.3 Expectativas congeladas antes de medir; TDD
- `EXPECTATIONS-ETAPA1.md` foi commitado **sozinho** antes de qualquer código ou
  execução: `fbb8a3d docs(rex-cfg-paralela-c): contrato rex-cfg/v1 e expectativas
  ETAPA1 congeladas antes de codigo`. O texto continua intacto (`git diff fbb8a3d --
  docs/.../EXPECTATIONS-ETAPA1.md` vazio); correções estão no adendo dataado, como o
  protocolo manda.
- Os dois testes novos desta sessão foram escritos e **vistos falhar** antes do código
  (RED impresso: 6 divergências de operando e 3 fronteiras ausentes), e o fixture novo
  (`calib2.s` bloco `lblidx`) foi montado e medido no instrumento **antes** de virar
  asserção. A correção de `src/decode.rs` foi o mínimo para passar.

### 3.4 Gates
Executados: `cargo test --offline` (38/38), `cargo clippy --offline --all-targets --
-D warnings`, `cargo fmt --all -- --check`, `make-fixtures.sh --check`,
`executar-evidencia-C.sh` (`rc=0`), `bash -n` no script, `npm run check:tree`.
Não executados e por quê: os quatro gates do app/`src-tauri` e `host:certify` — nenhum
arquivo deles mudou, e a regra de serialização de jobs pesados não permite disparar a
compilação do app junto do ciclo Rust desta frente. **Isto é um registro de gate não
aprovado, não uma declaração de verde.**

### 3.5 Ações proibidas
Sem merge, sem release, sem promoção de status, sem push forçado, sem watcher/fila, sem
matar processo alheio (todas as execuções foram foreground com timeout próprio), uma
tarefa pesada por vez. Push do branch e PR isolado: **a confirmar com o operador** antes
de executar (ação visível a terceiros).

## 4. Como refazer a auditoria

```sh
cd scripts/rex_profiles/parallel_recovery_20261004/c
cargo test --offline                                  # esperado: 38 verdes
cargo clippy --offline --all-targets -- -D warnings   # esperado: limpo
cargo fmt --all -- --check                            # esperado: silencioso
bash tools/make-fixtures.sh --check                    # esperado: corpus reproduziveis
bash executar-evidencia-C.sh                          # esperado: rc=0, divergencias criticas = 0
sha256sum ../../../data/rex_profiles/parallel_recovery_20261004/c/evidence/*.redigido.json
```

Hashes de referência desta entrega (reproduzir antes de confiar em qualquer número):

```
r1.redigido.json  d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4
r2.redigido.json  524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3
r3.redigido.json  c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea
r1.json (bruto)   318364322561bff357648cd1d041c39f3ddefa70c4174af66cea4c89ca513465
r2.json (bruto)   1c197a8af3b3c6d4bd8baa74309bdda7a06177e712b150115fe86adc2b0faba0
r3.json (bruto)   d33a236e26b70d9987d879b5240094390134223a7b02aa75e9fcbde4fd2c1677
ROM               c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb
```
