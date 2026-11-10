# 14 - REX: DIREÇÃO E ARQUITETURA PARA RECUPERAÇÃO UNIVERSAL DE LÓGICA

**Status:** decisão do operador registrada em 2026-10-09 (integrador). Documento de direção e arquitetura; **não é implementação, não promove suporte, não altera as "Decisões Arquiteturais Consolidadas" do Memory Bank.** Complementa `docs/12_DECOMPILACAO_PAREADA_PLANO.md` (Programa REX), que continua canônico para o programa amplo.
**Leitura obrigatória** para qualquer agente que toque `src-tauri/src/tools/reverse/decomp/`, perfis REX, a ponte canvas↔ROM ou provas de gameplay.

## 1. Decisão

> O objetivo do REX é ter **capacidade de decompilação universal no futuro**, não uma coleção de casos customizados. Toda entrega daqui em diante deve caminhar nessa direção: o que se constrói é **um motor genérico alimentado por perfis em dados e por prova de execução**, e cada jogo/rotina é um teste da generalidade desse motor.

Consequências práticas, em ordem de força:
1. **Um caso novo que exige código Rust novo que cita o jogo, o personagem ou um nome de campo do jogo é um sinal de alarme**, não um sucesso. Ele só é aceito como degrau explícito e registrado (ver §7).
2. **"Universal" é direção, nunca alegação.** Nenhum documento, UI ou relatório pode dizer "universal", "qualquer ROM" ou equivalente. O que existe é cobertura crescente de padrões **com prova**, e **recusa explícita** fora dela. (Alinhado ao REX 1 do doc 12: "todos os formatos é uma direção de expansão, não uma promessa binária".)
3. **Desconhecido continua desconhecido.** O que o motor não reconhece é preservado byte a byte e rotulado; nunca vira operação vazia nem semântica inventada pela aparência.

## 2. Ponto de partida honesto (2026-10-09)

Entregue e provado, **Experimental**: a ponte canvas → pulo → ROM → gameplay para Sonic 1 e Sonic Delta (`FECHO-PULO-CANVAS-GAMEPLAY-2026-10-09.md`). Isso é um **perfil por assinatura** (`m68k.platformer_jump.v1`) rodando sobre mecanismos que já são genéricos, mas o perfil em si ainda é um caso: conhece o formato de uma rotina de pulo.

Classificação inicial por inspeção de nomes e de partes lidas; **a auditoria completa é a tarefa da Fase 0** (não tratar esta tabela como fato fechado):
| Parte | Hoje | Destino |
|---|---|---|
| `rex_sigscan` (padrões com capturas, `Pattern`/`Captured`/`Match`) | genérico | motor |
| Codecs: `rex_kosinski`, `rex_nemesis`, `rex_aplib`, `rex_codecs`, `crates/rex-enigma` | genéricos por codec | motor (registro de codecs) |
| `rex_mdgfx`, `rex_addressing`, `rex_resources`, `rex_context` | majoritariamente genéricos | motor |
| `Patch`, `apply`, `ips`, `ips_apply_strict` (hoje dentro de `rex_platformer_jump.rs`) | genéricos, **mal alocados** | içar para núcleo de edição |
| Publicação conjunta cópia+IPS, identidade da ROM, anti-resultado-obsoleto (`rex_jump_ipc.rs`, ponte TS) | genéricos, **mal alocados** | içar |
| Revisão do grafo contra o canônico (`review_graph`, `canonical_signature`) | misto | separar regra geral de forma do grafo de pulo |
| `locate()`, `JumpInstance` (`status_off`, `vel_y_off`, `jump_flag_off`…), `graph_json`, `JumpError` | **específicos do pulo** | virar dado de perfil + erros genéricos |
| `sonic_layouts`, `sonic_ss_walls`, `sonic_consumers`, `sonic_sprite`, `sonic_cadence`, `sonic_sequence` | **casos customizados válidos** | permanecem como evidência; migrar gradualmente, nunca apagar |

### 2.1 Achados da auditoria F0 (2026-10-09) — corrigem a tabela acima
Fonte: `data/rex_profiles/integration_20261009/auditoria/` (script `scripts/rex_profiles/integration_20261009/audit-decomp-modules.py`, determinístico). 70 arquivos: **motor 50** (16.278 linhas de produção), **perfil 7** (3.056), **misto 7** (5.177), **caso 6** (2.894).
1. **Há dois perfis, não um:** `m68k.counter_threshold_state_gate.v1` (`crates/rex-gameplay`, `logic_recovery.rs`, `rex_gameplay.rs`, `rexGameplay*.ts`) e `m68k.platformer_jump.v1`. Cada um tem **seu próprio** grafo, patch e adaptador IPC: a mecânica genérica está duplicada por perfil. O alvo da F1 é içar para os dois.
2. **O maior débito de generalidade são dois arquivos mistos que a tabela não listava:** `inspection.rs` (1.970 linhas, 138 ocorrências de "sonic": 16 símbolos públicos de caso — 15 funções, como `edit_sonic_*` e `sonic_*_info`, e 1 struct) e `sprite_composition.rs` (97 ocorrências de "sonic", pins de HAMOOPIG/TAIKETSU/SONIC1).
3. **Um executor m68k parcial já existe** (ver opção A em §3.3), com subconjunto fechado de 12 instruções.
4. **SHA-256 está implementado seis vezes em produção** (`rom_mastering`, `fingerprint`, `rom_library`, `rex-kosinski/edit`, `rex-gameplay`, `rex-mugen`) mais cópias em testes; `rex-gameplay/json.rs` reimplementa JSON apesar de `serde_json` existir. São candidatos à consolidação na F1.
5. `rex_jump_ipc.rs` e `rex_platformer_jump.rs` são mistos, com os símbolos de cada lado listados na auditoria (ex.: `publish_pair`, `Patch`, `apply`, `ips*`, `canonical_*` são motor).
6. **Dado = código, verificado:** o perfil do pulo em dado (`data/rex_profiles/specs/m68k.platformer_jump.v1.json`, que era `.draft.json` na F0), interpretado por um avaliador de teste, produz exatamente o `locate()` do código na ROM sintética, em variantes (duas instâncias, forma super, altura não pareada) e em ROMs reais: **Sonic 1 = 1 instância, Delta = 3, idênticas** campo a campo (nome, valor, domínio, offsets).

## 3. Arquitetura-alvo: motor × perfil × evidência

```
ROM (BYOR, SHA-256) ──► identidade ──► [MOTOR]  ◄── perfil (DADO versionado, hash)
                                         │
              localizar (sigscan) → vincular consumidor → observar efeito
                                         │
                      editar (Patch) → publicar (cópia + IPS) → verificar
                                         │
                       nível de evidência declarado em cada afirmação
```
### 3.1 Perfil como dado
Um perfil descreve, **sem código**: arquitetura (ex.: m68k); padrões com capturas e restrições; campos editáveis (nome estrutural, tipo, onde está na ROM por referência a captura, **domínio aceito**); operações suportadas; como observar o efeito (endereços relativos ao objeto, condição de partida, entrada); controles negativos; recusas. É versionado, tem hash e é validado por esquema. Rótulos são **estruturais**, não nomes do jogo, salvo quando o nome é provado.
**Critério de pronto da separação:** adicionar um perfil novo da mesma classe exige **zero linhas de Rust novas** (só dado + evidência). Classes novas (ex.: descompressor) podem exigir um *tipo de operação* novo no motor, mas nunca código por jogo.

### 3.2 Escada de evidência (contrato do motor)
Toda saída (DTO, UI, relatório, doc) carrega o **nível mais alto realmente provado** e nunca o transmite além dele:
| Nível | Significa | Exemplo no repositório |
|---|---|---|
| L0 Identidade | ROM por SHA-256, região, tamanho | todas as jornadas |
| L1 Forma estática | o padrão casou | `$085A2` hoje |
| L2 Consistência | invariantes internos fecham (pareamento, domínios) | pulo (perfil) |
| L3 Consumo observado | a execução alcançou a rotina; chamador/argumentos medidos | **nenhum alvo ainda tem chamador/argumentos medidos por PC** |
| L4 Efeito medido | estado/saída observados em execução | ápice 94→182 / 34→81 (RAM, sonda rotulada) |
| L5 Causalidade por edição | editar o dado muda o efeito como previsto, com controles | pulo: `imp`=2304, `cut`=−1536 apenas |
| L6 Reconstrução equivalente | recompila e iguala | fora do escopo atual |
Regras: sonda técnica ≠ prova de consumo; valor aceito pelo perfil ≠ valor medido ≠ "seguro em gameplay"; expectativas **congeladas antes** de medir; falhas preservadas.

### 3.3 O problema aberto: observar execução de forma genérica
Os cores Libretro **não expõem o PC pela API padrão** (`libretro_ffi.rs`: sem adapter, a coleta de trace "continua dependente de adapter específico por runtime e permanece experimental"). Existe um `TraceBackend` por estado serializado do core, mas **sua granularidade e cobertura para o `genesis_plus_gx` não foram verificadas** (verificar na F2). Até isso, tratar L3 genérico (quebra por PC, A0/A1 na entrada de uma rotina) como **inexistente**. Opções, com custo e risco:
| Opção | O que dá | Risco / custo |
|---|---|---|
| **C. Amostragem por quadro** (o que o pulo usou: RAM/estado por `emulator_read_memory`) | L4/L5 de efeito; **não** L3 | já existe; granularidade de quadro; taxa < 60 fps sob Xvfb (lição: validade medida em quadros renderizados) |
| **A. Executor m68k em Rust, em isolamento** — **não parte do zero** (auditoria F0): `crates/rex-gameplay/src/m68k.rs` já tem decode/encode/`step` com flags para um subconjunto **fechado de 12 instruções** (recusa o resto) | efeito de rotinas curtas executadas sobre os bytes da ROM + estado sintético; oráculo independente | o subconjunto é o de um perfil: ampliar por instrução, cada uma com **teste diferencial contra o core**; não prova consumo no jogo real |
| **B. Core com gancho de PC** (fork/patch ou core alternativo) | L3 real no jogo | **dependência nova** (exige aprovação, reflexo em `docs/02_TECH_STACK.md`); licença do core; manutenção |
Recomendação do integrador, **dependente de decisão do operador (D1)**: C agora (já funciona), A como oráculo de efeito para rotinas curtas validado diferencialmente, e B só com aprovação explícita. Até haver L3, nenhum alvo pode afirmar consumo observado.

## 4. Escopo

**Dentro:** motor genérico (localizar, vincular, observar, editar, publicar, verificar); perfis em dados; escada de evidência no contrato; sonda de execução (C/A, B se aprovado); migração gradual dos casos Sonic para o motor; teste de generalidade em engine/jogo diferente.
**Fora (não fazer sem ordem expressa):** declarar universalidade; "decompilar tudo"; recompilação de projeto autoral a partir de ROM (L6) como meta imediata; um segundo pipeline de patches (usa-se o IPS/BPS existente); distribuir ROM/patch derivado de ROM comercial; integrar a PR #110 sem curadoria; vida/anéis antes da Fase 4; nomear semântica de dado por aparência.
**Limites de plataforma hoje:** Mega Drive/m68k; Linux-only para a prova de apresentação; um personagem por jogo observado.

## 5. Plano por fases (cada fase = missão com expectativas congeladas antes)
| Fase | Objetivo | Critério de saída (mensurável) |
|---|---|---|
| **F0** Auditoria e contrato | classificar todos os módulos de `decomp/` (motor/perfil/caso); definir `ProfileSpec` (esquema) e o tipo `EvidenceLevel`; **sem mudar comportamento** | tabela §2 verificada por inspeção; jornadas do pulo (canvas 87/87, profile 24/24, gameplay allPass) **inalteradas** |
| **F1** Içar a mecânica genérica | núcleo de edição (Patch/IPS/publicação/identidade/anti-obsoleto) independente de "pulo"; o pulo vira o 1º perfil em dado | mesmas provas do F0; **um 2º perfil sintético da mesma classe passa pelo motor com 0 linhas de Rust novas** |
| **F2** Sonda de execução | generalizar a observação por quadro (C) e especificar/construir o executor isolado (A) com teste diferencial vs core; decidir B | observador reutilizável sem harness por caso; divergência A×core = 0 nas rotinas-teste |
| **F3** Teste de generalidade | rotina `$085A2` do Streets of Rage (`PROXIMO-ALVO-STREETS-OF-RAGE-2026-10-09.md`) como **classe diferente** (descompressor) | L3/L4 por execução; igualdade byte a byte da saída com a referência; **código novo registrado** (métrica §6) |
| **F4** Segundo alvo da classe "pulo" em outro motor | provar que o perfil em dado generaliza entre engines; escolher por evidência existente, sem inventar assinatura | perfil novo = dado; controles negativos recusam |
| **F5** Ampliar classes de lógica | contadores/comparações (vida/anéis entram **aqui**, não antes) | idem F4 |
Fases podem ser reordenadas por evidência; **nunca** pular F0/F1 para entregar caso novo.


> **Estado das fases (2026-10-09):** F0 **fechada** (`FECHO-F0-…`). F1 **fechada para a classe `subsumes/pair/follow`** (`FECHO-F1-…`): núcleo de edição e publicação içados, motor de perfis em dado em produção para o pulo, segundo perfil sintético passando com 0 linhas de Rust. **Em aberto:** F1b (perfil `counter_threshold_state_gate.v1` no motor), F2 (sonda; D1), F3 (`$085A2`), e a divisão de `inspection.rs`/`sprite_composition.rs`.

> **Estado das fases (2026-10-09, adendo):** `FECHO-MOTOR-DE-PERFIS-DECLARATIVOS-2026-10-09.md` conclui F0 + F1 para a classe `subsumes/pair/follow`: contrato `rex-profile-spec/v2`, projeção e revisão do grafo, carga e IPC genéricos, pulo inteiramente em dado, segundo perfil autoral só como dado. Leia junto `ADENDO-CORRECOES-DO-PLANO-2026-10-09.md`, que corrige §3.2 (eixos de evidência independentes), §3.3 (`TraceBackend` só mock; execução isolada não prova chamada), o alvo `$085A2` e a regra de parada do §6. Este parágrafo é um adendo; o texto acima não foi reescrito.

> **Estado das fases (2026-10-09, adendo 2):** `FECHO-F1B-EVIDENCIA-E-CLASSE-SEMANTICA-2026-10-09.md` conclui a **F1b**: a classe contador→comparação→estado (`counter_threshold_state_gate.v1`) passou a usar o motor compartilhado por um esquema próprio (`rex-semantic-profile/v1`), com o analisador `crates/rex-gameplay` reutilizado sem alteração; o caminho próprio (IPC, painel, escrita) saiu do produto. O mesmo fecho corrige a apresentação de evidências: toda afirmação tem ORIGEM (declarada pelo autor · histórica curada · observada pelo aplicativo · desconhecida) e um perfil não ganha rótulo de efeito por declarar o nível — isso substitui, na prática, a leitura de §3.2 como "nível mais alto provado". Este parágrafo é um adendo; o texto acima não foi reescrito.

## 6. Métrica de generalidade (obrigatória em todo relatório de alvo)
Registrar por alvo: **(a)** linhas/arquivos de Rust/TS novos e quantos citam o jogo; **(b)** linhas de dado de perfil; **(c)** níveis de evidência alcançados por afirmação (§3.2); **(d)** controles negativos e recusas corretas; **(e)** reuso do motor (o que foi reaproveitado sem mudança).
**Regra de parada:** se o código novo por alvo não diminuir ao longo de três alvos consecutivos, parar e re-arquitetar antes de continuar.

## 7. Como qualquer agente atua nesta direção
1. Leia este documento, `docs/12` (seção Programa REX) e o último fecho em `docs/rex_profiles/`. Responda `[Contexto Carregado]` como o `AGENTS.md` exige.
2. Classifique a tarefa: **motor**, **perfil (dado)**, **evidência/sonda** ou **caso**. Se for caso, justifique por escrito o degrau e o plano de migração.
3. Se for escrever Rust que nomeia jogo/campo/personagem: **pare**; modele como dado ou como tipo de operação genérico. Exceção só como degrau registrado (o que falta para generalizar, quando).
4. **Congele expectativas antes de medir**; mudanças de protocolo vão em adendo datado, nunca reescrevendo o congelado. Preserve falhas e erros de numeração com errata.
5. Declare o **nível de evidência** de cada afirmação; separe prova nova de herdada; nunca "seguro em gameplay" por faixa aceita.
6. Respeite as restrições vigentes: sem push/merge/release/promoção sem ordem; BYOR fora do Git (só SHA); sem dependência nova sem aprovação; superfícies parciais marcadas `Experimental`; um build/E2E pesado por vez; gates do `AGENTS.md` + `host:certify`.
7. Em rodadas paralelas, **só o integrador atualiza docs canônicos**; demais agentes entregam proposta e evidência.
8. Ao fechar: registrar pins (commit, binário, ROM-base, artefatos, hashes), atualizar o Memory Bank e a métrica §6.

## 8. Decisões pendentes do operador
- **D1 — Sonda de execução:** C + A (recomendado) com B só mediante aprovação de dependência; ou outro caminho.
- **D2 — Onde vivem os perfis em dado** (proposta: `data/rex_profiles/specs/`, validados por esquema com `serde` já presente; nenhuma dependência nova) e o formato (JSON).
- **D3 — Escopo do teste de generalidade:** apenas Streets of Rage (World) ou também 2 e 3 (presentes no corpus local, sem evidência prévia equivalente).
- **D4 — Risco jurídico de distribuição** de código/oráculo de terceiros (herdado dos fechos de layouts/Enigma; decisão do operador).

> **Adendo de execução 2026-10-16:** `copy_grid` entrou como segunda classe de operação semântica no motor existente, com perfil em dado `m68k.copy_grid.v1`, núcleo Rust no reverse core e edição apenas da largura byte/word. Contrato e aceite em `rex_profiles/integration_20261016/COPY-GRID-RESULTS.md`: GUI final 60/60, regressões 63/63 e 55/55, certify READY. Execução comprovada em harness declarado, sem chamada/argumentos observados no jogo nem resultado gráfico. Não altera as decisões/fases históricas acima nem promove suporte universal. Pendência sonora anterior preservada.
