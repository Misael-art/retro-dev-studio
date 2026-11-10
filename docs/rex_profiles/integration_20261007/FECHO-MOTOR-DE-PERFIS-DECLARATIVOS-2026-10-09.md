# FECHO — motor de perfis declarativos (conclusão de F0 + F1) — 2026-10-09

Experimental. Sem push, merge, release, promoção ou dependência nova. Expectativas congeladas antes em `EXPECTATIONS-MOTOR-DE-PERFIS-DECLARATIVOS-2026-10-09.md` (commit `48a9833e`, não alteradas); correções do plano em `ADENDO-CORRECOES-DO-PLANO-2026-10-09.md`. Nada aqui declara decompilação universal nem usabilidade humana (nenhum participante foi testado).

## Pins
| Item | Valor |
|---|---|
| Base encontrada | `95138430` (não `cbe2ee74`: outra sessão já tinha fechado uma F0/F1 mais estreita; preservada e reutilizada) |
| Commits desta missão | `48a9833e` expectativas + auditoria por papel + adendo · `e2f7cf6f` motor, contrato v2, IPC e UI genéricos, pulo migrado · `5e0c5aa2` duas regras de validação + jornada genérica + mutação · `ece9823b` **congelamento** · `103ee686` **segundo perfil, só dado** |
| Binário (`build:portable`, árvore limpa, **sem** o segundo perfil na árvore) | `083392045958f4c7a285b655a76696e3d18879c4da97e07986d9e8e526093247`, de `ece9823b` |
| ROM-base Sonic 1 / Sonic Delta (BYOR, fora do Git) | `c7da53a1…81ebb` / `8fd88902…ffd6` |
| ROM sintética do segundo perfil (autoral, versionada) | `4f750ea6cbace93cbbdd644659b3a5a94903d9e20f2405daa55efb946beb7802` |
| Perfil do pulo (`data/rex_profiles/specs/m68k.platformer_jump.v1.json`, revisão 2) | `293321058e7e900d3e3614034462bc75fd592a3d25db73bfb59801500c1743e9` |
| Segundo perfil (`m68k.authored_timer_gate.v1`) | `f031368b9d8df17f08bf888c3fb95044d5889eceb4b9c1bd7f05b58496af9c9c` |
| Manifesto de congelamento (512 arquivos de produto) | `cdd72261831b2471eae912a9b0e33dbe42013cfe84ae9f66f11916dd5cd43ef9` |
| Xvfb / host | `5bfd315a…3351` (isolado) / `READY`, fingerprint `60249508…f6e2` |
Evidência: `data/rex_profiles/integration_20261009/evidencia-motor-de-perfis/` (`sha256sum -c SHA256SUMS`).

## O que foi entregue
1. **Contrato `rex-profile-spec/v2`** (`rex_profile_spec.rs`): identidade + revisão; arquitetura; capturas **tipadas** (largura 1/2/4, sinal, endianess, papel `immediate` / `ea_displacement` / `bus_address` / `opaque`); restrições entre capturas (`range`, `distinct`, `multiple_of`); `pair`/`follow` com regra de **empate explícita** (`first` | `refuse`); campos e domínios; **projeção** para os tipos de node existentes; notas e detalhes; procedência; vínculo com ROM (assinatura ou SHA-256); limites de tamanho e de trabalho; afirmações de evidência com **referência e escopo** (ROMs, instâncias, valores, condições). `rom_mapping` liga **offset de arquivo** a **endereço de barramento**; deslocamento de endereço efetivo é um papel próprio, sem conversão.
2. **Motor genérico**: `rex_profile_engine` (localizar, validar, plano de edição), `rex_profile_graph` (projeção e revisão do grafo), `rex_profile_registry` (carga), `rex_profile_ipc` (catálogo, localizar, editar, identidade, anti-obsoleto). `rex_edit` e `rex_publish` foram **reutilizados**: um só aplicador de patches, um só publicador.
3. **Pulo migrado para dado**: grafo, notas, detalhes do objeto, limites e medições saíram do Rust/TS. `rex_platformer_jump.rs` e `rex_jump_ipc.rs` passaram a compilar **só em teste** (`#[cfg(test)]` em `mod.rs`): o binário do produto não contém código do pulo. O código antigo de localização e de grafo ficou como oráculo de teste.
4. **Segundo perfil autoral** só como dado, pelo núcleo e pela interface, com o mesmo binário.
5. **Carga e seleção**: `build.rs` enumera `data/rex_profiles/specs/*.json` (nenhum nome no código); perfis autorais vêm de uma pasta em execução; todo perfil carregado tenta a ROM. Arquivo inválido é **rejeitado com o motivo**; id repetido não sombreia o embutido.

## Resultado por critério
| ID | Resultado | Prova |
|---|---|---|
| M1 contrato v2 | **PASS** | 15 testes em `rex_profile_spec::tests`, uma asserção por regra de recusa (versão, chave desconhecida/repetida, duplicidades, referências, overflow, limites, forma) |
| M2 sem script | **PASS** | `texto_e_lista_de_partes_tipadas_nunca_expressao`; literal com cara de código sai literal (`texto_com_cara_de_codigo_sai_literal`) |
| M3 carga sem condicional | **PASS** | busca por palavra inteira de termos de jogo e ids de perfil na produção de `rex_profile_{spec,engine,graph,ipc,registry}`, `rex_edit`, `rex_publish`: **0**; `embutidos_vem_do_diretorio_de_dados_e_sao_validos` |
| M4 motor genérico | **PASS** | 11 fixtures pelo mesmo corpo de teste (agora passando também pela projeção e pela revisão); auditoria por papel refeita (`auditoria-papeis/final/`) |
| M5 pulo migrado | **PASS** | `locate` e grafo do motor == código antigo em ROM sintética e em **ROMs reais (Sonic 1: 1 instância; Delta: 3)**, com a mesma assinatura estrutural; diferenças só nas chaves novas de vínculo |
| M6 lacunas declaradas | ver "Lacunas" | — |
| M7 congelamento | **PASS** | `CONGELAMENTO-MOTOR.sha256` (512 arquivos) em `ece9823b`, antes do segundo perfil |
| M8 segundo perfil só dado | **PASS, com ressalva** (abaixo) | `103ee686`: 5 arquivos, **0** `.rs/.ts/.tsx/.mjs`; `sha256sum -c` do congelamento OK depois dele; mesmo binário `08339204…`; jornada **66/66** |
| M9 negativos | **PASS** | mapa abaixo + mutação **15/15** |
| M10 assinatura ≠ consumo | **PASS** | `consumer_observed` sempre `false`; `efeito_medido_em_outra_rom_nao_e_apresentado_como_medido_nesta`; UI |
| M11 CX | **PASS (texto/estrutura; sem participante)** | vitest dos dois painéis + jornadas |
| M12 matriz no binário final | **PARCIAL** — ver matriz | — |
| M13 gates | **PASS** (ver "Gates") | `gates-103ee686.txt` |

**Ressalva de M8 (generalidade):** ao escrever o segundo perfil, o validador recusou uma construção legítima (texto que cita uma captura existente só em uma das âncoras, sob condição `anchor_pattern`). Corrigi a regra **antes** do congelamento (`5e0c5aa2`, junto com uma regra de segurança para `extra_offsets`). Portanto: o commit do perfil é só dado e o binário não mudou, mas **o motor foi ajustado sabendo deste perfil**. O ajuste foi no validador (≈30 linhas), não no caminho de localização/edição/publicação. A amostra **não é cega**.

## Matriz de jornadas (binário `08339204…`)
| Jornada | Executado nesta missão | Referência histórica |
|---|---|---|
| `jump-profile-journey` | **24/24** (roteiro inalterado) | 24/24 |
| `jump-canvas-journey` | **87/87** (roteiro inalterado); **8 cópias e 8 IPS com SHA-256 idênticos** aos de `manifesto-copias.json` da rodada `…06-14-28-062Z` (código anterior) | 87/87 |
| `nodegraph-authoring` | **13/13** | 13/13 |
| `sonic-consumers-inspection` | **24/24** | 24/24 |
| `sonic-layouts-journey` | 1ª execução **reprovada** (clique bloqueado após reinício, com 69/69 até ali); 2ª execução **85/85** | 85/85 |
| `jump-gameplay-journey` | 1ª execução **reprovada**: `allPass=false`, 14/19 — Sonic 1 PASS (G1–G4, G6); Delta inconclusivo por G6 (`noop`, a ROM original, com 1/3 toques válidos). Repetição: ver "Adendo de execução" ao fim | allPass, 19 |
| `profile-authoring-journey` (nova, segundo perfil) | **66/66** | não existia |
As duas reprovações estão em `falhas-preservadas/` com a descrição. Nenhum limiar foi alterado.

## Segundo perfil: o que foi demonstrado (pela interface, mesmo binário)
`m68k.authored_timer_gate.v1` difere do pulo em: campos de 1, 2 e 4 bytes, com e sem sinal (pulo: só imm16 com sinal); restrições `range`/`distinct`/`multiple_of` (pulo: nenhuma); empate `refuse` (pulo: `first`); vínculo por SHA-256 (pulo: assinatura); cabeçalho de 512 bytes, logo offset de arquivo ≠ endereço de barramento; campo de 4 bytes repetido; forma `outer` com campo exclusivo e captura de endereço absoluto.
Jornada: sem a pasta de perfis, a ROM **não é reconhecida**; com a pasta, 3 instâncias com os valores originais, 3 ocorrências descartadas por restrição ditas na UI, uma instância com **ambiguidade** dita e não resolvida; edição pelo formulário (valor fora do domínio bloqueia; cópia + IPS; só os bytes dos campos pedidos mudaram; IPS reaplicado por aplicador JS independente reproduz a cópia; não sobrescreve); edição pelo canvas (projeção só com os nós da instância; cópia + IPS); **salvar → destruir a janela → reiniciar → reabrir do disco** preserva valores, ROM, perfil, instância e estrutura, e **gerar de novo dá a mesma cópia e o mesmo IPS** (o perfil é recarregado da pasta gravada no grafo). Nenhum efeito em jogo é afirmado: é sintético.

## Negativos discriminantes (cada um com código próprio)
| Negativo pedido | Onde | Resultado |
|---|---|---|
| perfil malformado | `perfil_malformado_chave_desconhecida_e_chave_repetida_sao_recusados`; registro: `parse` | recusado, listado como rejeitado |
| captura ou campo duplicado | `duplicidades_sao_recusadas_uma_a_uma`; grafo: `campo duplicado: … em mais de um nó` | `duplicate` / problema de valor |
| múltiplos candidatos ambíguos | `candidatos_ambiguos_nao_sao_ligados_e_o_motivo_fica_registrado`; jornada (instância `0xC00`) | não liga; motivo registrado |
| pareamento incompatível | `pareamento_incompativel_…` (spec e motor) | `incompatible-pairing` / sem ligação |
| limites numéricos e overflow | `limites_numericos_e_overflow_sao_recusados`; `codificacao_…_nunca_trunca`; IPC `out-of-range` | recusado |
| ROM trocada | `rom_trocada_entre_localizar_e_gerar_e_recusada` | `identity_mismatch`, nenhum arquivo |
| grafo adulterado | `grafo_adulterado_nao_e_aceito` (19 adulterações) | `graph-diverges` |
| versão/hash do perfil incompatível na reabertura | `perfil_de_outro_hash_ou_revisao_e_recusado_na_reabertura`; `perfil_alterado_entre_localizar_e_gerar_e_recusado` | `profile-mismatch` |
| resposta assíncrona antiga | vitest: resposta de outro perfil/instância/ROM/hash não aparece | descartada |
| falha de publicação sem alterar a original | `falha_de_publicacao_nao_altera_a_original_nem_deixa_metade` (4 pontos de falha) | nada no destino; original intacta |
**Mutação** (`mutation-check.py`): 15 proteções desligadas uma a uma; a suíte reprovou nas 15 (`mutacao.json`).

## Mapa requisito → implementação → teste → resultado → limite
| Requisito | Implementação | Teste | Resultado | Limite |
|---|---|---|---|---|
| Perfil como dado versionado | `rex-profile-spec/v2`; `data/rex_profiles/specs/` | `rex_profile_spec::tests` | PASS | só m68k, big-endian, alinhamento 2, barramento de 24 bits |
| Localização e validação | `Engine::locate` | fixtures + ROMs reais | PASS | uma `pair`, ≤1 `subsumes`, `follow` do alvo |
| Plano de edição | `Engine::plan_edit` + `rex_edit::FieldEnc` | `edicao_escreve_na_largura_e_ordem_certas…` | PASS | inteiros de 1/2/4 bytes no lugar; a ROM não cresce |
| Identidade e procedência | SHA-256 da ROM e do arquivo do perfil em toda resposta e no grafo | IPC + grafo | PASS | — |
| Revisão do grafo | `rex_profile_graph::review_graph` | adulterações + reabertura | PASS | só troca de valor é aplicada |
| Aplicação e publicação | `rex_edit` + `rex_publish` (reuso) | IPC + 18 testes antigos via adaptador | PASS | IPS (offsets ≤ 0xFFFFFF) |
| Anti-obsoleto | `contextIdentity`/`relateResult` + identidade na resposta | vitest | PASS | — |
| Reabertura de grafos antigos | parâmetros de vínculo fora da forma canônica; hash ausente = aceito pela estrutura e avisado | 4 grafos salvos antes da migração reabrem nas ROMs reais | PASS | ver lacuna L1 |
| Evidência por eixo | `EvidenceAxis`; estático calculado por instância; execução declarada com escopo | IPC + UI | PASS | consumo: nunca observado |

## Lacunas identificadas (o que não é declarativo ou não é genérico)
| # | Lacuna | Motivo | Impacto no aceite |
|---|---|---|---|
| L1 | `LEGACY_INSTANCE_PARAM = "jump_offset"` em `profileGraphBridge.ts` | grafos salvos antes desta missão não dizem qual é a chave da instância | única constante de perfil no TS de produto; só é lida quando `instancia_param` falta |
| L2 | `data-testid` com prefixo `jump-` nos painéis genéricos | as jornadas anteriores rodaram **sem alteração** como prova de regressão | nome histórico de identificadores de teste; nenhum comportamento depende deles |
| L3 | Tabela de portas dos 4 tipos de node (`node_ports`) no Rust | é conhecimento do editor, não do perfil | um perfil não pode projetar para outro tipo de node sem mudar o motor |
| L4 | Classe única (`pair` + `subsumes` + `follow`) | fora de escopo | `counter_threshold_state_gate.v1` **não** migrado; continua com grafo, patch e IPC próprios (F1b) |
| L5 | `extra_offsets` só em campo de padrão e forma únicos | com formas alternativas o offset teria dois sentidos | recusa explícita (`extra-offset-ambiguous-form`) |
| L6 | Arquitetura fixa (m68k) no validador | o localizador só testa offsets pares e monta valores big-endian | outro processador exige operação nova no motor |
| L7 | Parâmetro `a: "sonic_submerso"` no dado do pulo | o grafo salvo já o continha; trocá-lo quebraria a assinatura estrutural dos grafos antigos | termo de jogo em DADO, não em código |
| L8 | Textos gerais da UI e do motor (limites, garantias) em código | valem para qualquer perfil | não são regra de perfil |
| L9 | `inspection.rs` e `sprite_composition.rs` (casos Sonic) | fora de escopo | intocados |

## Relatório de generalidade (doc 14 §6)
- **Código (diff `95138430..103ee686`):** Rust `src-tauri` +5.718 / −1.152; TS/TSX `src` +1.232 / −726. Produção nova do motor: `rex_profile_spec` 1.478 linhas, `engine` 786, `graph` 443, `ipc` 762, `registry` 148; `rex_edit` 232. Termos de jogo/ids de perfil nessa produção: **0** (palavra inteira).
- **Dado:** perfil do pulo 1.127 linhas de JSON; segundo perfil 766.
- **Custo por perfil:** pulo migrado = dado; perfil sintético da sessão anterior = dado (conversão mecânica para v2); segundo perfil autoral = dado, **depois** de um ajuste de validação motivado por ele (ressalva de M8). Pela correção 5 do adendo, zero código é sucesso; aqui o número honesto para o terceiro perfil é "≈30 linhas de validador antes do congelamento, zero depois".
- **Evidência por afirmação:** pulo — `imp` e `cut` com efeito causal medido (L5) **só** nas ROMs e instâncias do escopo; demais campos só estático; consumo (L3) não observado em nenhum alvo. Segundo perfil — só estático.
- **Reuso sem mudança:** `rex_sigscan`, `rex_publish`, IPS de `rex_edit`.
- **O que isto NÃO mostra:** que o contrato sirva para uma rotina real de outro jogo ou de outra classe. Os dois perfis da classe além do pulo são sintéticos e escritos por quem conhece o motor.

## Gates (HEAD `103ee686`)
Executados: `check:tree`, `lint`, `tsc --noEmit` rc=0; `npm test` 1033 passou / 0 falhou / 6 ignorados; `cargo fmt --check` rc=0; `cargo clippy -- -D warnings` rc=0; `cargo test --lib` 1008 / 0 / 90 ignorados; BYOR `equivalencia` 2/2 (ignorados, rodados à mão). `host:certify`: ver "Adendo de execução". **Herdado, não reexecutado:** nada da matriz. **Ausente:** `security:audit` / `cargo audit` (dependências inalteradas), `clippy --all-targets` (dívida preexistente), CI remoto (sem push), demais jornadas desktop sem relação com a mudança, validação com participante humano.

## Reprodução
```
npm run host:diagnose
cd src-tauri && cargo test --lib rex_ && cargo clippy -- -D warnings && cargo fmt -- --check
RDS_INSPECTION_ROM=<Sonic 1> RDS_JUMP_DELTA_ROM=<Delta> cargo test --lib equivalencia -- --ignored --nocapture
cd .. && npm test
python3 -I scripts/rex_profiles/integration_20261009/make-authored-timer-profile.py      # regenera perfil, ROM, roteiro, fixture
sha256sum -c data/rex_profiles/integration_20261009/evidencia-motor-de-perfis/CONGELAMENTO-MOTOR.sha256
python3 -I scripts/rex_profiles/integration_20261009/mutation-check.py --out <saida.json>
npm run build:portable
RDS_PROFILE_JOURNEY_SPEC=$PWD/data/rex_profiles/authoring/timer_gate/journey.json \
  python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb <Xvfb> --xvfb-sha256 <sha> --rom <Sonic 1> \
  --app src-tauri/target-test/release/retro-dev-studio --work <dir> --log <log> --scenario profile-authoring-journey
# idem com --scenario jump-profile-journey | jump-canvas-journey | nodegraph-authoring | sonic-layouts-journey | sonic-consumers-inspection
# jump-gameplay-journey exige RDS_JUMP_COPIES_MANIFEST=<manifesto das cópias do canvas>
```

## Próxima investigação proposta (não implementada)
`PROPOSTA-INVESTIGACAO-INSTRUMENTACAO-DO-CORE-2026-10-09.md`: com o core pinado e sem modificá-lo, há alguma evidência de consumo obtenível (registradores no estado serializado + resíduo de pilha)? Teto de 2 dias, interfaces já ligadas, três critérios de saída declarados.

## Adendo de execução (2026-10-09, depois da primeira redação deste fecho)
- **`jump-gameplay-journey`, repetição** (`jump-gameplay-2026-10-09T21-26-10-620Z`, mesmo binário `08339204…`, mesmas cópias, mesmo manifesto, limiares e protocolo inalterados): **allPass, 19/19**. Sonic 1 e Delta: G1 e G6 PASS (nenhuma variante inconclusiva); `imp` segura **+88**; `cut` toque **+47**; `both` +88 / +47 (Sonic 1) e +88 / +44,5 (Delta); instâncias `b`/`c` do Delta sem efeito (G5). A 1ª execução (14/19) continua registrada como reprovada em `falhas-preservadas/`; a diferença entre as duas foi a validade das repetições de toque na ROM **original** do Delta (confirmação do input nativo sob Xvfb), não um valor medido.
- **Mutação no motor final** (`5e0c5aa2` em diante, HEAD `103ee686`): **15/15** mutantes mortos (`mutacao.json`). A rodada anterior, em `e2f7cf6f`, também deu 15/15.
- **`host:certify`**: rc=0, `READY`, fingerprint `60249508…f6e2`.
- M12 passa de PARCIAL a **PASS com duas reexecuções declaradas** (layouts e gameplay): cada uma teve uma execução reprovada e uma aprovada no mesmo binário; a causa das reprovações não foi isolada e ambas ocorreram em trechos que esta missão não alterou (painel de inspeção; ROM original no emulador).

## Alegação
Motor de perfis declarativos demonstrado na classe e nos conjuntos descritos, com o fluxo anterior preservado.

Não é declarada decompilação universal. "Classe" = `pair` + `subsumes` + `follow`, m68k, inteiros de 1/2/4 bytes editados no lugar. "Conjuntos" = Sonic 1 e Sonic Delta (BYOR) para o pulo; ROMs sintéticas autorais para os demais perfis, em amostra não cega.
