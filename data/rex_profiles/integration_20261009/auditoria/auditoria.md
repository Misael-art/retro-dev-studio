# Auditoria F0 — motor × perfil × caso (gerada; não editar)

Arquivos medidos: 77 · classificados: 77

| Classe | Arquivos | Linhas (produção) |
|---|---|---|
| caso | 6 | 2900 |
| misto | 4 | 3561 |
| motor | 58 | 21133 |
| perfil | 9 | 3608 |

| Arquivo | Classe | Linhas prod. | Termos de jogo (produção) | Justificativa |
|---|---|---|---|---|
| `crates/rex-addressing/src/error.rs` | motor | 55 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/lib.rs` | motor | 165 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/md_common.rs` | motor | 78 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/md_linear.rs` | motor | 209 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/md_ssf2.rs` | motor | 342 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/region.rs` | motor | 57 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/resource.rs` | motor | 658 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/snes_common.rs` | motor | 138 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/snes_exhirom.rs` | motor | 296 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/snes_hirom.rs` | motor | 226 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/snes_lorom.rs` | motor | 215 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-addressing/src/state.rs` | motor | 123 | — | Endereçamento de região/mapper (Mega Drive linear/SSF2, SNES LoROM/HiROM/ExHiROM); 0 termos de jogo. |
| `crates/rex-enigma/src/lib.rs` | motor | 298 | sonic:1, delta:2 | Codec Enigma puro; 'sonic'/'delta' só em comentários (variante do console; 'delta' = corrida delta do codec). |
| `crates/rex-gameplay/src/graph.rs` | perfil | 628 | — | Constrói NodeGraph v1 do perfil m68k.counter_threshold_state_gate.v1 (build_graph, edit_threshold): forma do grafo é do perfil. |
| `crates/rex-gameplay/src/json.rs` | motor | 329 | — | JSON mínimo próprio; mecanismo genérico (redundante com serde_json — candidato a remoção na F1). |
| `crates/rex-gameplay/src/lib.rs` | perfil | 125 | — | Entrada do perfil counter_threshold_state_gate.v1 (Experimental). |
| `crates/rex-gameplay/src/lift.rs` | perfil | 453 | — | Eleva região à regra semântica do perfil (Guard, CounterAdd, Compare). |
| `crates/rex-gameplay/src/m68k.rs` | misto | 526 | — | Subconjunto M68000 fechado de 12 variantes de Insn, com decode/encode/step e flags: o mecanismo é reaproveitável, o conjunto de instruções é o do perfil. |
| `crates/rex-gameplay/src/patch.rs` | misto | 173 | — | md_checksum é do formato Mega Drive; patch_threshold e regenerate_from_graph são do perfil. |
| `crates/rex-gameplay/src/region.rs` | motor | 148 | — | Delimita região por fluxo de controle com saídas declaradas pelo chamador; depende do tipo Insn (acoplamento a verificar na F1). |
| `crates/rex-gameplay/src/sha256.rs` | motor | 68 | — | SHA-256 próprio (duplicata; ver duplicações). |
| `crates/rex-kosinski/src/edit.rs` | motor | 230 | — | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). |
| `crates/rex-kosinski/src/encode.rs` | motor | 243 | — | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). |
| `crates/rex-kosinski/src/lib.rs` | motor | 185 | — | Codec/edição Kosinski (variante base); sem termo de jogo. edit.rs tem SHA-256 próprio (duplicata). |
| `crates/rex-mugen/src/air.rs` | motor | 412 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/diag.rs` | motor | 189 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/fixture.rs` | motor | 678 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/lib.rs` | motor | 14 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/palette.rs` | motor | 119 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/plan.rs` | motor | 532 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/sff.rs` | motor | 439 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `crates/rex-mugen/src/sha256.rs` | motor | 68 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). SHA-256 próprio (duplicata). |
| `crates/rex-mugen/src/source.rs` | motor | 93 | — | Formatos MUGEN genéricos (SFF/AIR/paleta); fora do eixo de recuperação de lógica de ROM (frente de importação MUGEN). |
| `src-tauri/src/tools/reverse/decomp/decomp_orch.rs` | motor | 457 | — | Orquestrador do currículo pareado (Tier 0): pares (fonte, ROM), Ghidra, determinismo; sem jogo. |
| `src-tauri/src/tools/reverse/decomp/extract.rs` | motor | 557 | hamoopig:1, taiketsu:1 | Catálogo de extração com proveniência; 'hamoopig'/'taiketsu' só em comentário e teste ignorado. |
| `src-tauri/src/tools/reverse/decomp/fingerprint.rs` | motor | 78 | — | Fingerprint de funções por SHA-256 (tem SHA-256 próprio). |
| `src-tauri/src/tools/reverse/decomp/ghidra_bridge.rs` | motor | 195 | — | Ponte Ghidra headless. |
| `src-tauri/src/tools/reverse/decomp/graphics_discovery.rs` | motor | 1652 | delta:2 | Descoberta de tiles/paletas por heurística; 'delta' = diferença. |
| `src-tauri/src/tools/reverse/decomp/holdout.rs` | motor | 503 | delta:6 | Holdout sintético; 'delta' = variação numérica. |
| `src-tauri/src/tools/reverse/decomp/inspection.rs` | misto | 1971 | sonic:138 | Serviço de inspeção (sessões, catálogo, preview, salvar) misturado com 138 ocorrências de 'sonic' em edições/consultas específicas do Sonic 1. |
| `src-tauri/src/tools/reverse/decomp/logic_recovery.rs` | perfil | 548 | — | Recuperação de rotina M68K exata de perfil (PROFILE_ID/BRANCH_PROFILE_ID; ADDQ.W #1,D0; RTS) — forma específica, sem nome de jogo. |
| `src-tauri/src/tools/reverse/decomp/mod.rs` | motor | 56 | sonic:6 | Registro de módulos; 'sonic'/'jump' só nos nomes dos módulos registrados. |
| `src-tauri/src/tools/reverse/decomp/object_diff.rs` | motor | 226 | — | Comparação por símbolo de objetos M68K via objdump. |
| `src-tauri/src/tools/reverse/decomp/rex_addressing.rs` | motor | 317 | — | Adaptador de endereçamento do produto. |
| `src-tauri/src/tools/reverse/decomp/rex_aplib.rs` | motor | 753 | — | Codec aPLib (variante SGDK). |
| `src-tauri/src/tools/reverse/decomp/rex_codecs.rs` | motor | 926 | — | Codecs REX v1 (LZ4W etc.). |
| `src-tauri/src/tools/reverse/decomp/rex_context.rs` | motor | 1279 | — | Contexto de recurso gráfico somente leitura (TileSet+TileMap+paleta); 0 termos de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_edit.rs` | motor | 234 | — | Núcleo de edição extraído na F1: Patch, apply, IPS estrito (gerador e aplicador independentes) e planejamento genérico de campos de 16 bits; opera sobre offsets e domínios, sem termo de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_evidence.rs` | motor | 174 | — | Escada de evidência L0–L6 e Claim com base obrigatória de L3 em diante; sem termo de jogo. Contrato da F0, ainda não usado por nenhum caminho de produção. |
| `src-tauri/src/tools/reverse/decomp/rex_gameplay.rs` | perfil | 482 | — | Adaptador IPC do perfil counter_threshold_state_gate.v1. |
| `src-tauri/src/tools/reverse/decomp/rex_jump_ipc.rs` | perfil | 187 | jump:30, pulo:1 | ADAPTADOR DE COMPATIBILIDADE compilado só em teste: delega a rex_profile_ipc; conserva os testes anteriores como regressão. |
| `src-tauri/src/tools/reverse/decomp/rex_kosinski.rs` | motor | 261 | — | Adaptador do codec Kosinski. |
| `src-tauri/src/tools/reverse/decomp/rex_mdgfx.rs` | motor | 392 | sonic:3 | Primitivas gráficas MD 'SEM conhecimento de jogo' (cabeçalho); 'sonic' só em comentário sobre o formato de mappings. |
| `src-tauri/src/tools/reverse/decomp/rex_nemesis.rs` | motor | 267 | sonic:1 | Decoder Nemesis 'genérico: não conhece nenhum jogo' (cabeçalho). |
| `src-tauri/src/tools/reverse/decomp/rex_platformer_jump.rs` | perfil | 363 | sonic:1, jump:65, pulo:2 | ADAPTADOR DE COMPATIBILIDADE compilado só em teste (#[cfg(test)] em mod.rs): API tipada anterior sobre o motor + código antigo como oráculo (locate_reference, graph_json_reference). |
| `src-tauri/src/tools/reverse/decomp/rex_profile_engine.rs` | motor | 788 | tails:2 | Motor de localização dirigido por perfil em dado (subsumes/pair/follow), promovido na F1; recusa formas fora da classe suportada; sem termo de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_graph.rs` | motor | 445 | delta:8 | Projeção de instância para NodeGraph v1 e revisão do grafo contra o canônico da ROM, dirigidas pelo dado do perfil; 0 termos de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_ipc.rs` | motor | 764 | tails:3 | Superfície IPC genérica (catálogo, localizar, editar): recebe o id do perfil como dado; 0 termos de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_registry.rs` | motor | 150 | — | Carga de perfis (embutidos enumerados na compilação + pasta em execução) e rejeição com motivo; 0 termos de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_spec.rs` | motor | 1460 | tails:7, delta:4 | Esquema e validação do perfil como dado; a lógica de produção não cita jogo (1 ocorrência de 'pulo' em comentário de cabeçalho; o perfil do pulo aparece nos testes e no JSON de rascunho). O avaliador que interpreta o dado é #[cfg(test)]. Contrato da F0, não usado em produção. |
| `src-tauri/src/tools/reverse/decomp/rex_profile_testkit.rs` | motor | 137 | tails:1, delta:3 | Apoio de teste (#[cfg(test)]): perfil mínimo autoral e ROM sintética; não descreve jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_publish.rs` | motor | 210 | — | Publicação conjunta e segura de dois artefatos (cópia + IPS) extraída na F1: Fs/RealFs/WriteFail/publish_pair; sem termo de jogo. |
| `src-tauri/src/tools/reverse/decomp/rex_resources.rs` | motor | 1130 | sonic:1 | Cadeia de recurso comprimido; 'sonic' 1x em comentário. |
| `src-tauri/src/tools/reverse/decomp/rex_sigscan.rs` | motor | 194 | — | Localizador por assinatura genérico e puro (cabeçalho). |
| `src-tauri/src/tools/reverse/decomp/rom_library.rs` | motor | 433 | — | Biblioteca BYOR e ledger de execuções (tem SHA-256 próprio). |
| `src-tauri/src/tools/reverse/decomp/sonic_cadence.rs` | caso | 313 | sonic:14 | Cadência da sequência id_Wait do Sonic 1 Rev00 (offsets e tabelas do jogo). Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sonic_consumers.rs` | caso | 612 | sonic:5 | Cadeia de consumidores do Sonic 1 (ROM_PIN, offsets de tabela). Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sonic_layouts.rs` | caso | 746 | sonic:5 | Layouts das fases especiais do Sonic 1 (formato e tabela do jogo). Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sonic_sequence.rs` | caso | 201 | sonic:10 | Reordenação in-place de frames do id_Wait do Sonic 1 Rev00. Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sonic_sprite.rs` | caso | 256 | sonic:16 | Geometria do perfil BYOR Sonic 1 Rev00 (ART_OFFSET, MAP_TABLE, DPLC). Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sonic_ss_walls.rs` | caso | 772 | sonic:2 | Paredes da fase especial do Sonic 1 (SS_MapIndex, Map_SSWalls). Evidência válida; migrar gradualmente, nunca apagar. |
| `src-tauri/src/tools/reverse/decomp/sprite_composition.rs` | misto | 891 | sonic:116, hamoopig:14, taiketsu:4 | Composição de frame com pins HAMOOPIG/TAIKETSU/SONIC1 e 97 ocorrências de 'sonic'. |
| `src-tauri/src/tools/reverse/decomp/symbols.rs` | motor | 110 | — | Parser de symbol tables estilo nm. |
| `src-tauri/src/tools/reverse/decomp/triage.rs` | motor | 145 | — | Triagem estática de ROM Mega Drive (header SEGA, tiers). |
| `src/core/nodegraph/profileGraphBridge.ts` | motor | 233 | jump:1 | Ponte canvas↔ROM genérica: perfil, campos e chave da instância vêm do grafo. Único resíduo: constante LEGACY_INSTANCE_PARAM para grafos antigos. |
| `src/core/nodegraph/rexGameplayGraph.ts` | perfil | 498 | — | Projeção do grafo do perfil counter_threshold_state_gate.v1 (REX_GAMEPLAY_PROFILE_ID). |
| `src/core/nodegraph/rexGameplayScene.ts` | perfil | 324 | — | Cena derivada do perfil counter_threshold_state_gate.v1. |

## Arquivos mistos: símbolos por lado

- `crates/rex-gameplay/src/m68k.rs`
  - motor: fn decode, fn encode, fn step, enum Cond, enum BranchSize, struct Decoded
  - perfil: enum Insn (subconjunto fechado: MoveLAbsToD, AddqLD, Moveq, CmpLDD, BtstImmD, Bcc, Bra, PeaAbsW, JsrAbsL, AddqLSp…), fn mnemonic
- `crates/rex-gameplay/src/patch.rs`
  - motor: const MD_CHECKSUM_AT, fn md_checksum, struct Rebuilt
  - perfil: fn patch_threshold, fn regenerate_from_graph
- `src-tauri/src/tools/reverse/decomp/inspection.rs`
  - motor: InspectionError, InspectionRomIdentity, InspectionSession, InspectionEdit, InspectionProgress, InspectionRun, InspectionStatus, InspectionCandidate, InspectionCatalogPage, InspectionPreview, fn list_sessions, fn open, fn reopen, fn start, fn cancel, fn status, fn catalog_page, fn preview, fn save_palette_choice, fn save
  - caso: SonicAppliedEdit, fn edit_sonic_palette, fn edit_sonic_tiles, fn sonic_cadence_info, fn edit_sonic_duration, fn sonic_sequence_info, fn sonic_consumers_info, fn sonic_layouts_info, fn sonic_layout_grid, fn set_layouts_selection, fn sonic_ss_walls_info, fn sonic_ss_walls_compose, fn sonic_layout_cell, fn edit_sonic_sequence, fn restore_sonic_sequence, fn layouts_error
- `src-tauri/src/tools/reverse/decomp/sprite_composition.rs`
  - motor: struct SpriteFramePart, struct InspectionSpriteFrame
  - caso: SONIC1_*, SonicTileUse, SonicFrameContext, fn read_sonic_session_rom, SonicPixelLocation, fn sonic_stand_pixel_location, fn sonic_dplc_art_tiles, HAMOOPIG_REFERENCE_SHA256, TAIKETSU_REFERENCE_SHA256
  - indeterminado: fn compose_for_session (a classificar na F1)
