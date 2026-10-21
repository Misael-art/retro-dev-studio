# FECHO — ponte canvas → pulo → ROM → gameplay (Sonic 1 e Sonic Delta) — 2026-10-09

Experimental / validação de perfil local. Sem push, merge, release ou promoção. Frente do integrador, branch `codex/rex-integrator-sonic-103104`.
Nada aqui declara usabilidade humana (nenhum participante foi testado).

## Pins do checkpoint
| Item | Valor |
|---|---|
| Commit de código do binário | `67b720daed1e330e196412eecdc84a9af9af9212` (árvore limpa na build) |
| Produto (`src`, `src-tauri`) | idêntico ao de `e044a53c` (`git diff --quiet e044a53c 67b720da -- src src-tauri`); commits posteriores só tocam docs, scripts e `data/` |
| Binário final | `ad06bfa8c047af7a801998622efd36e790cc641c0909c7fd41038e6279cca989` (`build:portable`) |
| Binário anterior (provas parciais, mesmo produto) | `4adc0d41e70c5d46b9d568ca1e9c4c442727f8cd45fa6414a20fa4b57bff4046` (build de `e044a53c`) |
| ROM-base Sonic 1 (BYOR, fora do Git) | `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` |
| ROM-base Sonic Delta Reloaded (BYOR, fora do Git) | `8fd8890206cfe856c8079531982ef00fea099f4cd4c3e120efc93d25faf1ffd6` |
| Core | `genesis_plus_gx_libretro.so` do lock `dd99a22f…`: `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1` |
| Xvfb (isolado, `system_display_modified=false`) | `5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351` |
| Host | `READY`, fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2` |

### Cópias geradas pelo canvas e IPS (SHA-256 completos em `evidencia-pulo-canvas-gameplay/manifesto-copias.json`)
Os arquivos de ROM e IPS derivados de ROM comercial **não** estão no índice; só o SHA. Bytes que diferem da base: `imp` 2, `cut` 1, `both` 3.
| Jogo | Variante | Instância | Valores | Cópia (prefixo) | IPS (prefixo) | Bytes diferentes |
|---|---|---|---|---|---|---|
| Sonic 1 | imp | `0x1340C` | imp 1664→2304 | `58ec3d1651e54b82` | `fa997b44d259be8c` | 2 |
| Sonic 1 | cut | `0x1340C` | cut −1024→−1536 | `9dcc643c4fbf543e` | `f2b1b73e658afba9` | 1 |
| Sonic 1 | both | `0x1340C` | ambos | `bec61f9f15a55200` | `cad5a2451f87b005` | 3 |
| Delta | a-imp | `0x16914` | imp | `81a8867c6e14825f` | `c45e8cf0ad2e2b79` | 2 |
| Delta | a-cut | `0x16914` | cut | `d5a451fac0f17bc3` | `33e306c31865960f` | 1 |
| Delta | a-both | `0x16914` | ambos | `f3b0aa5088c0dbb5` | `73e8ec33b5cc2e57` | 3 |
| Delta | b-imp | `0x1732A` | imp | `e6e0e1f5ce4534e3` | `353ee61917b7de3f` | 2 |
| Delta | c-imp | `0x1A170` | imp | `fc3f103e5fb235d6` | `6ce155c50bb3b4e8` | 2 |

Relatórios e `SHA256SUMS`: `data/rex_profiles/integration_20261007/evidencia-pulo-canvas-gameplay/` (verificável com `sha256sum -c SHA256SUMS`).

## Etapa 1 — fronteiras (provas por teste)
Origem: commit `d91e6897` (herdado do início desta missão; reconfirmado aqui: Rust `rex_jump_ipc` 18/18; vitest dos 3 arquivos da ponte 35/35).
1. **Duplicados:** `grafo_com_campos_duplicados_e_recusado_sem_escolher_um_dos_dois`, `duplicidade_de_campo_entre_nos_canonicos_vira_problema_de_valor`; no frontend, "campos duplicados bloqueiam e dizem quais nós".
2. **Integridade do grafo:** valores reconstruídos da ROM, não do frontend (`grafo_canonico_com_valor_editado_gera_e_deriva_os_valores_da_rom_nao_do_cliente`); remoção de nó, mudança de conexão, de origem ou troca de campo **não são apresentadas como lógica aplicada** (`mudancas_de_topologia_origem_ou_campo_nao_sao_aplicadas`); só posição/rótulo/caminho da ROM podem mudar (`so_posicao_pinned_rotulo_e_caminho_da_rom_podem_mudar_sem_perder_a_ponte`).
3. **Identidade:** obrigatória no canvas e no formulário (`identidade_obrigatoria_rom_trocada_entre_localizar_e_gerar_nao_deixa_arquivos`).
4. **Resultado assíncrono:** A pendente → troca para B → resposta A não aparece (promise controlada, sem sleep), idem para erro; após nova edição a cópia anterior é rotulada "valores anteriores".
5. **Cópia + IPS:** publicação conjunta com desfazimento só do que é nosso (`colisao_previa_…`, `colisao_que_surge_entre_a_checagem_e_a_publicacao_…`, `falha_de_escrita_…`, `falha_no_primeiro_link_…`); nunca remove arquivo alheio.
6. **Domínio IPS:** `0x1000100` recusado (era serializado como `0x100`), `0x1000000`, EOF `0x454F46` como offset, registro vazio e de 0x10000 bytes, sobreposição, lista vazia; aplicação por implementação independente (JS na jornada) reproduz a cópia byte a byte.

Ajuste de jornada nesta rodada: `jump-profile-journey` reprovou 2/24 (`*.nao_sobrescreve`) porque lia só `jump-error`; a Etapa 1 moveu o erro de geração para `jump-failure` (amarrado a ROM/instância/valores). Corrigi a leitura (commit próprio) sem afrouxar o critério (continua exigindo `output_exists_or_unwritable`). Não foi regressão do produto.

## Etapa 2 — regressões do editor (binário final `ad06bfa8…`)
| Jornada | Resultado |
|---|---|
| `nodegraph-authoring` | 13/13 passos (organizar/desfazer/refazer, salvar, reiniciar, reabrir, jogar por teclado, grafo maior) |
| `jump-canvas-journey` | **87/87**, Sonic 1 e Delta; inclui valor negativo no nó, desfazer/refazer, organizar e mover sem mudar semântica, remoção de nó deixa de ser lógica aplicada, instâncias distintas, preservar lógica própria da entidade, **salvar → destruir a janela → reiniciar → reabrir lendo do DISCO** (valores editados, origem/identidade, instância e plano preservados; não finge resultado da sessão anterior) |
| `jump-profile-journey` | 24/24 |
| `sonic-layouts-journey` | 85/85 (reexecutada: telas com `ToolPathField`; mudança de código só adicionou `data-testid`) |
| `sonic-consumers-inspection` | 24/24 |

Não reexecutei as demais jornadas (sem relação com a mudança). Uma primeira tentativa de layouts/consumers foi recusada pelo gate de proveniência (binário de `e044a53c` × HEAD com commits só de docs/scripts) e não rodou nada; foi refeita no binário reconstruído no HEAD limpo.

## Etapa 3 — prova causal da cópia do canvas
Usou exatamente as cópias acima (SHA conferido contra o manifesto antes de cada medição); nenhuma ROM patchada por script. Teclado nativo (tecla C) pela superfície do app, consumo do input confirmado por `lastJoypadAck`, RAM por `emulator_read_memory` (**sonda técnica rotulada**), capturas do canvas do jogo. Expectativas congeladas antes: `EXPECTATIONS-PULO-CANVAS-GAMEPLAY-2026-10-08.md`, `…-v2-…` (limiares G1–G7 nunca alterados).

**Resultado no binário final (`jump-gameplay-2026-10-09T06-14-58-506Z`): allPass, G1–G6 PASS nos dois jogos, 0 repetições inconclusivas nas variantes avaliadas.**
| | Ápice (px, mediana de 3) toque / segura | Ganho sobre `original` |
|---|---|---|
| original / original2 / noop | 34 / 94 | 0 (G1 determinismo) |
| imp isolado | 34 / **182** | segura **+88**, toque 0 (G2) |
| cut isolado | **81** / 94 | toque **+47**, segura 0 (G3) |
| both | **81 / 182** | segura +88, toque +47 (G4) |
| Delta `a` (`0x16914`) | idêntico ao Sonic 1 | G2–G4 reproduzidos |
| Delta `b` (`0x1732A`), `c` (`0x1A170`) | 34 / 94 | 0 (G5) |

Interpretação limitada ao medido: no Delta, a instância `a` corresponde ao Sonic controlado pelo jogador 1 (editá-la move o ápice dele; editar `b` ou `c` não). **Nada se afirma sobre a quem `b` e `c` pertencem.** G7 (sprite visual): nas capturas de ápice (`sonic1-original-segura-apice.png` × `sonic1-both-segura-apice.png`) o sprite do `both` aparece mais alto na tela, mas a câmera também rola, então a posição em tela não é métrica limpa; a medida é a RAM. Observação manual rotulada, feita por mim, não por participante.

### Domínios (não confundir)
1. **Representável:** imediato de 16 bits com sinal (−32768..32767) e IPS.
2. **Aceito pelo perfil:** `imp/impw/imps` 1..32767; `cut/cutw/cap` −32767..−1.
3. **Efetivamente medido:** apenas `imp`=2304 e `cut`=−1536 (originais 1664 / −1024), nas variantes acima.
Nenhum valor é declarado "seguro em gameplay". **Não verificados em execução:** `cap`, `imps`, `impw` (pulo submerso), `cutw`, e qualquer valor fora dos medidos. O perfil continua provando forma+consistência, não uso.

### Histórico completo (falhas preservadas) — numeração pelo timestamp do relatório
Todos os relatórios estão em `evidencia-pulo-canvas-gameplay/historico-gameplay/` (+ o final na raiz). Os limiares nunca mudaram; só o protocolo do "segurar".
| Relatório (UTC) | Protocolo | Resultado |
|---|---|---|
| 2026-10-08T09-32-16 | v1 | allPass=false; mesmos veredictos do relatório seguinte (Sonic 1 G2/G3 reprovados; Delta reprovado em todos os critérios); causa não investigada separadamente |
| 2026-10-08T12-40-40 | v1 (binário `661e4351…`) | idem (G2 `+9 px`, G3 `+19 px` no segurar; Delta não carregou: bug de cabeçalho `SEGA GENESIS` em `.bin`, corrigido no produto) |
| 2026-10-08T13-20-58 | v2 (binário `378d9fc1…`) | tudo inconclusivo no "segura" (teste de validade por relógio de parede, falho) |
| 2026-10-08T17-39-46 | v2.1 (validade por quadros) | allPass=false; G1 ok, G6/G2/G3/G4 inconclusivos |
| 2026-10-09T02-25-27 | v2.1 (binário `4adc0d41…`) | allPass=false; G1/G6 reprovados; ápices fisicamente coerentes mas muitas repetições "segura" inválidas |
| 2026-10-09T04-47-24 | **v2.2** ("segura" 5000 ms) (binário `4adc0d41…`) | **allPass=true** |
| 2026-10-09T06-14-58 | v2.2, **binário final `ad06bfa8…`** | **allPass=true** (mesmos números) |

Errata de numeração: o adendo v2.2 chamou o relatório de 02-25-27 de "3ª execução"; pelo timestamp ele é a 5ª. O texto congelado não foi reescrito; vale esta tabela. Prova nova × herdada: as linhas 04-47 e 06-14 são as que sustentam G1–G6; o relatório de 04-47 é do binário anterior de **mesmo produto**; o de 06-14 refaz tudo no binário final com cópias regeneradas pelo canvas nesse binário.

## Etapa 4 — CX (alcance real; sem validação humana)
O que a jornada deixa explícito na UI (textos em `RexJumpLogicPanel.tsx` / `JumpGraphBridgePanel.tsx`): qual ROM (caminho + SHA) e qual instância; o que `imp`/`cut` significam; suportado = trocar o valor de constantes de 16 bits que a ROM já tem; **não suportado** = remover nós, mudar conexões, trocar campos, acrescentar lógica; "Gerar cópia NÃO compila um projeto autoral" (grava cópia + IPS); qual cópia corresponde aos valores atuais e quando é de valores anteriores; "Jogar esta cópia no emulador" pelo fluxo existente; seleção de pasta pelo seletor da interface (sem digitar caminho); origem técnica acessível em `jump-graph` (detalhe recolhível). **Usabilidade humana não foi testada** (sem participante); a coerência acima é texto/estrutura verificados por teste e por jornada, não prova de compreensão.

## Etapa 5 — gates (HEAD `67b720da`, antes dos commits de fecho)
`check:tree`, `lint`, `tsc --noEmit` rc=0; `npm test` 1018 passou/0 falhou/6 ignorados; `cargo fmt --check` rc=0; `cargo clippy -- -D warnings` rc=0; `cargo test --lib` 941/0/88 ignorados; `host:certify` rc=0 (READY). **Não executados nesta rodada:** `security:audit`/`cargo audit` (dependências inalteradas) e `clippy --all-targets` (dívida preexistente). **Sem push: nenhum CI remoto é alegado.**

## Correção de documentação
Dois imediatos de 16 bits foram editados (4 bytes regravados); nas corridas registradas, **três bytes efetivamente diferem** (`0x0680→0x0900` altera 2; `0xFC00→0xFA00` altera 1). Ver o ADENDO em `PERFIL-PULO-ASSINATURA-2026-10-08.md`; o texto antigo "só os 4 bytes mudaram" foi ajustado (histórico preservado no Git).

## Limites
Um personagem por jogo observado; GHZ, início de fase; core genesis_plus_gx sob Xvfb por software (taxa de quadros abaixo de 60, por isso a validade do "segurar" é medida em quadros renderizados); hardware real e outras fases não testados; o grafo do canvas só vira ROM pela ponte e só para troca de valor.
