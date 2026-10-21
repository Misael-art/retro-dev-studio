# Auditoria por papel — motor / perfil / caso / instrumento / adaptador (gerada; não editar)

- **motor**: mecanismo genérico; não cita jogo, rotina nem campo de perfil.
- **perfil**: descreve a forma de UMA rotina/dado (padrões, campos, grafo, textos) sem citar jogo no nome.
- **caso**: o nome do arquivo/símbolo cita jogo ou personagem.
- **instrumento**: mede, compara ou rotula (oráculos de teste, Ghidra, diff, corpus, escada de evidência); não é caminho de edição do produto.
- **adaptador**: traduz entre um mecanismo e uma superfície (IPC, DTO, UI, API de compatibilidade).
- **misto**: arquivo com símbolos de mais de um papel; os símbolos são citados por papel.

| Papel | Arquivos | Linhas |
|---|---|---|
| adaptador | 8 | 4645 |
| caso | 6 | 4352 |
| instrumento | 9 | 3472 |
| misto | 7 | 9466 |
| motor | 41 | 26031 |
| perfil | 6 | 2684 |

| Arquivo | Papel | Por quê | Reuso registrado |
|---|---|---|---|
| `crates/rex-addressing/src/error.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/lib.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/md_common.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/md_linear.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/md_ssf2.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/region.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/resource.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/snes_common.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/snes_exhirom.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/snes_hirom.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/snes_lorom.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-addressing/src/state.rs` | motor | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. | — |
| `crates/rex-enigma/src/lib.rs` | motor | Codec Enigma puro; 'sonic'/'delta' só em comentários (variante do console; 'delta' = corrida delta do codec). | — |
| `crates/rex-gameplay/src/graph.rs` | perfil | Constrói NodeGraph v1 do perfil m68k.counter_threshold_state_gate.v1 (build_graph, edit_threshold): forma do grafo é do perfil. | — |
| `crates/rex-gameplay/src/json.rs` | motor | JSON mínimo próprio; mecanismo genérico (redundante com serde_json — candidato a remoção na F1). | Duplicata de JSON (não reutilizada; o motor usa serde_json). |
| `crates/rex-gameplay/src/lib.rs` | perfil | Entrada do perfil counter_threshold_state_gate.v1 (Experimental). | — |
| `crates/rex-gameplay/src/lift.rs` | perfil | Eleva região à regra semântica do perfil (Guard, CounterAdd, Compare). | Específico do perfil counter_threshold_state_gate.v1; fora da classe subsumes/pair/follow. |
| `crates/rex-gameplay/src/m68k.rs` | misto | Subconjunto M68000 fechado de 12 variantes de Insn, com decode/encode/step e flags: o mecanismo é reaproveitável, o conjunto de instruções é o do perfil. | Reutilizável: decode/encode/step com flags para subconjunto FECHADO de 12 instruções (recusa o resto). Base da opção A do doc 14 §3.3; não é emulador e não foi ampliado nesta missão. |
| `crates/rex-gameplay/src/patch.rs` | misto | md_checksum é do formato Mega Drive; patch_threshold e regenerate_from_graph são do perfil. | Pipeline de patch PRÓPRIO do perfil counter_threshold (duplica rex_edit): NÃO reutilizado e NÃO ampliado; consolidação fica para F1b. |
| `crates/rex-gameplay/src/region.rs` | motor | Delimita região por fluxo de controle com saídas declaradas pelo chamador; depende do tipo Insn (acoplamento a verificar na F1). | Reutilizável: ÚNICO mecanismo de CFG encontrado (delimit: percorre os dois lados de cada desvio a partir de entrada e saídas declaradas). Acoplado a Insn (subconjunto). Não há grafo de fluxo de ROM inteira. |
| `crates/rex-gameplay/src/sha256.rs` | motor | SHA-256 próprio (duplicata; ver duplicações). | Duplicata de SHA-256 (não reutilizada; o produto usa rom_library::sha256_hex). |
| `crates/rex-kosinski/src/edit.rs` | motor | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). | — |
| `crates/rex-kosinski/src/encode.rs` | motor | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). | — |
| `crates/rex-kosinski/src/lib.rs` | motor | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). | — |
| `crates/rex-mugen/src/air.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/diag.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/fixture.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/lib.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/palette.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/plan.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/sff.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `crates/rex-mugen/src/sha256.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). SHA-256 próprio (duplicata). | — |
| `crates/rex-mugen/src/source.rs` | motor | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). | — |
| `src-tauri/src/tools/reverse/decomp/decomp_orch.rs` | instrumento | Orquestra triagem+Ghidra+diff para medir pares (fonte, ROM): mede, não recupera. | — |
| `src-tauri/src/tools/reverse/decomp/extract.rs` | motor | Catálogo de extração com proveniência; 'hamoopig'/'taiketsu' só em comentário e teste ignorado. | — |
| `src-tauri/src/tools/reverse/decomp/fingerprint.rs` | instrumento | Índice hash→identidade de funções do ground truth: instrumento de comparação. | — |
| `src-tauri/src/tools/reverse/decomp/ghidra_bridge.rs` | instrumento | Executa analyzeHeadless e calcula precisão/recall de fronteiras: instrumento externo. | Reutilizável na investigação de core/CFG: exporta fronteiras de função (precision/recall contra symbol table). Não usado pelo motor de perfis; exige Ghidra autorizado no host. |
| `src-tauri/src/tools/reverse/decomp/graphics_discovery.rs` | motor | Descoberta de tiles/paletas por heurística; 'delta' = diferença. | — |
| `src-tauri/src/tools/reverse/decomp/holdout.rs` | instrumento | Corpus de validação independente dos scanners gráficos. | — |
| `src-tauri/src/tools/reverse/decomp/inspection.rs` | misto | Serviço de inspeção (sessões, catálogo, preview, salvar) misturado com 138 ocorrências de 'sonic' em edições/consultas específicas do Sonic 1. | InspectionError REUSADO como tipo de erro IPC; o lado de caso (sonic_*) permanece intocado nesta missão. |
| `src-tauri/src/tools/reverse/decomp/logic_recovery.rs` | perfil | Recuperação de rotina M68K exata de perfil (PROFILE_ID/BRANCH_PROFILE_ID; ADDQ.W #1,D0; RTS) — forma específica, sem nome de jogo. | — |
| `src-tauri/src/tools/reverse/decomp/mod.rs` | adaptador | Registro de módulos. | — |
| `src-tauri/src/tools/reverse/decomp/object_diff.rs` | instrumento | Comparação por símbolo via objdump: instrumento de medição. | Reutilizável para L6 (fora de escopo). |
| `src-tauri/src/tools/reverse/decomp/rex_addressing.rs` | adaptador | Superfície de produto sobre crates/rex-addressing (DTOs/erros). | — |
| `src-tauri/src/tools/reverse/decomp/rex_aplib.rs` | motor | Codec aPLib (variante SGDK). | — |
| `src-tauri/src/tools/reverse/decomp/rex_codecs.rs` | motor | Codecs REX v1 (LZ4W etc.). | — |
| `src-tauri/src/tools/reverse/decomp/rex_context.rs` | motor | Contexto de recurso gráfico somente leitura (TileSet+TileMap+paleta); 0 termos de jogo. | — |
| `src-tauri/src/tools/reverse/decomp/rex_edit.rs` | motor | Núcleo de edição extraído na F1: Patch, apply, IPS estrito (gerador e aplicador independentes) e planejamento genérico de campos de 16 bits; opera sobre offsets e domínios, sem termo de jogo. | REUSADO: único aplicador/gerador de patches (Patch, apply, ips, ips_apply_strict). |
| `src-tauri/src/tools/reverse/decomp/rex_evidence.rs` | instrumento | Tipo da escada de evidência: instrumento de rotulagem das afirmações, sem I/O. | — |
| `src-tauri/src/tools/reverse/decomp/rex_gameplay.rs` | adaptador | Superfície IPC do perfil counter_threshold_state_gate.v1 sobre crates/rex-gameplay. | — |
| `src-tauri/src/tools/reverse/decomp/rex_jump_ipc.rs` | misto | IPC do pulo: fluxo genérico (identidade, leitura limitada, publicação, releitura) escrito contra tipos do perfil. | — |
| `src-tauri/src/tools/reverse/decomp/rex_kosinski.rs` | adaptador | Superfície de produto sobre crates/rex-kosinski. | — |
| `src-tauri/src/tools/reverse/decomp/rex_mdgfx.rs` | motor | Primitivas gráficas MD 'SEM conhecimento de jogo' (cabeçalho); 'sonic' só em comentário sobre o formato de mappings. | — |
| `src-tauri/src/tools/reverse/decomp/rex_nemesis.rs` | motor | Decoder Nemesis 'genérico: não conhece nenhum jogo' (cabeçalho). | — |
| `src-tauri/src/tools/reverse/decomp/rex_platformer_jump.rs` | misto | Perfil do pulo: adaptador sobre o motor + regras do perfil ainda em Rust (grafo, notas, revisão, mapeamento de campos). | — |
| `src-tauri/src/tools/reverse/decomp/rex_profile_engine.rs` | motor | Motor de localização dirigido por perfil em dado (subsumes/pair/follow), promovido na F1; recusa formas fora da classe suportada; sem termo de jogo. | REUSADO e ampliado nesta missão. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_spec.rs` | motor | Esquema e validação do perfil como dado; a lógica de produção não cita jogo (1 ocorrência de 'pulo' em comentário de cabeçalho; o perfil do pulo aparece nos testes e no JSON de rascunho). O avaliador que interpreta o dado é #[cfg(test)]. Contrato da F0, não usado em produção. | REUSADO e ampliado (contrato v2). |
| `src-tauri/src/tools/reverse/decomp/rex_publish.rs` | motor | Publicação conjunta e segura de dois artefatos (cópia + IPS) extraída na F1: Fs/RealFs/WriteFail/publish_pair; sem termo de jogo. | REUSADO: único publicador (publish_pair). |
| `src-tauri/src/tools/reverse/decomp/rex_resources.rs` | motor | Cadeia de recurso comprimido; 'sonic' 1x em comentário. | — |
| `src-tauri/src/tools/reverse/decomp/rex_sigscan.rs` | motor | Localizador por assinatura genérico e puro (cabeçalho). | REUSADO pelo motor de perfis (padrões/capturas). |
| `src-tauri/src/tools/reverse/decomp/rom_library.rs` | instrumento | Biblioteca BYOR + ledger de execuções das medições. | sha256_hex reusado pela identidade da ROM. |
| `src-tauri/src/tools/reverse/decomp/sonic_cadence.rs` | caso | Cadência da sequência id_Wait do Sonic 1 Rev00 (offsets e tabelas do jogo). Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sonic_consumers.rs` | caso | Cadeia de consumidores do Sonic 1 (ROM_PIN, offsets de tabela). Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sonic_layouts.rs` | caso | Layouts das fases especiais do Sonic 1 (formato e tabela do jogo). Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sonic_sequence.rs` | caso | Reordenação in-place de frames do id_Wait do Sonic 1 Rev00. Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sonic_sprite.rs` | caso | Geometria do perfil BYOR Sonic 1 Rev00 (ART_OFFSET, MAP_TABLE, DPLC). Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sonic_ss_walls.rs` | caso | Paredes da fase especial do Sonic 1 (SS_MapIndex, Map_SSWalls). Evidência válida; migrar gradualmente, nunca apagar. | — |
| `src-tauri/src/tools/reverse/decomp/sprite_composition.rs` | misto | Composição de frame com pins HAMOOPIG/TAIKETSU/SONIC1 e 97 ocorrências de 'sonic'. | — |
| `src-tauri/src/tools/reverse/decomp/symbols.rs` | instrumento | Parser de symbol table (ground truth das medições). | — |
| `src-tauri/src/tools/reverse/decomp/triage.rs` | instrumento | Triagem estática de header/tier. | — |
| `src/components/nodegraph/JumpGraphBridgePanel.tsx` | adaptador | UI da ponte no canvas: textos do pulo fixos no componente. | — |
| `src/components/tools/RexGameplayRulePanel.tsx` | adaptador | UI de uma superfície REX existente (fora do caminho do perfil de pulo). | — |
| `src/components/tools/RexImageContextPanel.tsx` | adaptador | UI de uma superfície REX existente (fora do caminho do perfil de pulo). | — |
| `src/components/tools/RexJumpLogicPanel.tsx` | adaptador | UI do formulário do pulo: textos e campos de objeto (status_off, vel_y_off, jump_flag_off) fixos no componente. | — |
| `src/core/nodegraph/jumpGraphBridge.ts` | misto | Ponte canvas↔ROM: regras genéricas (forma canônica, relação resultado×contexto) + lista de campos e id do perfil fixos em TS. | — |
| `src/core/nodegraph/rexGameplayGraph.ts` | perfil | Projeção do grafo do perfil counter_threshold_state_gate.v1 (REX_GAMEPLAY_PROFILE_ID). | — |
| `src/core/nodegraph/rexGameplayScene.ts` | perfil | Cena derivada do perfil counter_threshold_state_gate.v1. | — |

## Símbolos citados (arquivo:linha)

### `crates/rex-gameplay/src/lib.rs`
- **instrumento**: `fn execute_region` (68)
- **perfil**: `fn recover` (44); `fn scan_guarded_candidates` (94)
### `crates/rex-gameplay/src/lift.rs`
- **perfil**: `struct GateRule` (117); `fn lift` (258); `fn evaluate` (417)
### `crates/rex-gameplay/src/m68k.rs`
- **motor**: `fn decode` (118); `fn encode` (247); `struct Machine` (383); `struct Ccr` (360); `enum Cond` (10)
- **perfil**: `enum Insn` (70); `fn mnemonic` (332)
### `crates/rex-gameplay/src/patch.rs`
- **motor**: `fn md_checksum` (32)
- **perfil**: `fn patch_threshold` (122); `fn regenerate_from_graph` (142)
### `crates/rex-gameplay/src/region.rs`
- **motor**: `struct Region` (14); `fn delimit` (42)
### `src-tauri/src/tools/reverse/decomp/ghidra_bridge.rs`
- **instrumento**: `struct BoundaryMetrics` (21); `const GHIDRA_PROCESSOR` (17)
### `src-tauri/src/tools/reverse/decomp/inspection.rs`
- **caso**: `fn edit_sonic_palette` (1566); `fn edit_sonic_tiles` (1617); `fn sonic_cadence_info` (1711); `fn sonic_layouts_info` (1787); `fn sonic_consumers_info` (1767); `fn edit_sonic_sequence` (1906)
- **motor**: `struct InspectionError` (41); `struct InspectionSession` (103); `fn open` (929); `fn reopen` (975); `fn catalog_page` (1099); `fn save` (1373)
### `src-tauri/src/tools/reverse/decomp/rex_edit.rs`
- **motor**: `struct Patch` (11); `fn plan_field_edits` (53); `fn apply` (90); `fn ips` (113); `fn ips_apply_strict` (143)
### `src-tauri/src/tools/reverse/decomp/rex_evidence.rs`
- **instrumento**: `enum EvidenceLevel` (10); `struct Claim` (98); `fn weakest` (143)
### `src-tauri/src/tools/reverse/decomp/rex_jump_ipc.rs`
- **adaptador**: `struct JumpLocateRequest` (76); `struct JumpLocateResponse` (89); `fn ipc_locate` (97); `struct JumpEditRequest` (126); `struct JumpEditResponse` (144); `fn ipc_edit` (209); `fn ipc_edit_with` (213)
- **motor**: `fn read_rom` (53); `fn request_ok` (43); `const MAX_ROM_BYTES` (15); `fn publish_pair` (178)
- **perfil**: `fn campos` (192); `fn from_jump` (25)
### `src-tauri/src/tools/reverse/decomp/rex_platformer_jump.rs`
- **adaptador**: `enum JumpError` (50); `fn apply` (994); `fn ips` (999); `fn ips_apply_strict` (1004)
- **instrumento**: `fn locate_reference` (247); `fn fixture_rom` (1009)
- **motor**: `fn canonical_string` (778); `fn canonical_signature` (793); `fn fnv1a64_hex` (707); `fn node_canon` (739); `fn edge_canon` (766)
- **perfil**: `const PROFILE_ID` (29); `const REL_HEIGHT` (155); `struct JumpInstance` (97); `struct JumpParams` (113); `fn locate` (177); `fn graph_json` (413); `fn review_graph` (817); `fn plan_edit` (962)
### `src-tauri/src/tools/reverse/decomp/rex_profile_engine.rs`
- **motor**: `struct Engine` (76); `struct EngineInstance` (63); `struct EngineField` (53); `enum EngineError` (18)
### `src-tauri/src/tools/reverse/decomp/rex_profile_spec.rs`
- **motor**: `struct ProfileSpec` (100); `enum RelationSpec` (32); `struct FieldSpec` (78); `enum SpecError` (116); `fn capture_names` (169)
### `src-tauri/src/tools/reverse/decomp/rex_publish.rs`
- **motor**: `trait Fs` (38); `struct RealFs` (47); `fn publish_pair` (96)
### `src-tauri/src/tools/reverse/decomp/rex_sigscan.rs`
- **motor**: `struct Pattern` (38); `struct Match` (52); `struct Captured` (45)
### `src-tauri/src/tools/reverse/decomp/sprite_composition.rs`
- **caso**: `fn read_sonic_session_rom` (554); `fn sonic_stand_pixel_location` (1193); `fn sonic_dplc_art_tiles` (1229)
- **motor**: `struct SpriteFramePart` (211); `struct InspectionSpriteFrame` (223)
### `src/components/nodegraph/JumpGraphBridgePanel.tsx`
- **adaptador**: `JumpGraphBridgePanel` (46)
### `src/components/tools/RexJumpLogicPanel.tsx`
- **adaptador**: `RexJumpLogicPanel` (49)
### `src/core/nodegraph/jumpGraphBridge.ts`
- **motor**: `canonicalString` (140); `canonicalSignature` (146); `relateResult` (196); `valuesKey` (182); `withRomPath` (202)
- **perfil**: `JUMP_PROFILE_ID` (10); `CAMPOS` (41); `jumpBridgeInfo` (49); `jumpEditsFromGraph` (68); `jumpStructure` (161)
