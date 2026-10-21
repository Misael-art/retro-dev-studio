# Mapa REQ-01..24 — Studio Gráfico Integrado (Experimental)

Estado vivo (rodada 3: corridas `cert3-*` no binário 014 `5f4c815a…`; demais linhas da rodada 2, binário 013, herdadas); cada linha diz o que existe, o teste nomeado, o resultado medido e o limite. “Jornada” = cenário desktop
canônico (`scripts/e2e-tauri-build-run.mjs`, Tauri/WebDriver) executado no Xvfb pinado. Resultados herdados não contam
como execução nova. Atualizar a cada corrida.

| REQ | Implementação | Teste nomeado | Resultado | Limite |
|---|---|---|---|---|
| 01 Organização | Shell existente; tarefas mapeadas para workspaces (`studioContext.ts`); Personagem = artstudio, Ações = logic, Interface/Cena = scene, Teste = game, Entrega = Revisar | `studioContext.test.ts`; jornadas E1/E3 | PASS (cert2-e1e3) | Sem barra dedicada “Cena·Personagem·…”; usa rail existente |
| 02 Contexto | `editorStore.studio` (foco rico, retorno, câmera por workspace, persistência por projeto) + `StudioContextBar` | `studioContext.test.ts` (9); E1 `return_to_origin`; E3 retorno ao Teste | PASS | Pan da cena lembrado; pan de outros editores não |
| 03 Identidade | `occurrence_ids`; vínculo com `asset_sha256` + `occurrence_images`; o conteúdo atual do asset é conferido **sempre** (mesmo caminho ou não), lido no clique; auditoria/renomear/mover transacional | Rust `project_refs` (4); `runtimeLink.test.ts` (2 testes discriminantes falharam antes da correção), `RuntimeInspectOverlay.test.tsx` (zero leituras ao re-renderizar); cert3-e1e3 (E3b e E3c); cert2-model (herdado) | PASS | Identidade = SHA do arquivo inteiro: mudança que não altera a arte decodificada também recusa (conservador); reimportação MUGEN em projeto existente não existe |
| 04 Escopo | Selo Nesta cena/Nesta instância (N usos), exceção local, Restaurar do modelo, **Aplicar ao modelo** (prefab, cópia de segurança); Personagem “Editar modelo — N usos” | `editScope.test.ts`, `project_refs` apply; cert2-e4 (local × compartilhado na ROM), cert2-model (aplicar com 2 usos + Reverter) | PASS | Aplicar ao modelo é operação de arquivo: volta por Reverter, não pelo desfazer em memória |
| 05 Transações | 1 intenção = 1 entrada (modelo, traço de colisão, arrasto de caixa, ajustes aplicados); operações de arquivo com cópia em `.rds/backups` e restauração byte-exata; limite do desfazer (50) visível | testes de componente/store; cert2-scene (traço = 1 desfazer), cert2-e2e5 (arrasto = 1), cert2-model (limite visível, Reverter byte-exato) | PASS | Desfazer em memória recomeça após operação de arquivo (declarado na UI) |
| 06 Acessibilidade | Rótulos/aria, unidades, foco na propriedade ao navegar, setas movem caixas; **corrigido**: teclas digitadas em campos iam para o joypad (C/Z/X/setas/Enter sumiam) e Espaço era bloqueado; paleta de tiles limitada para 1280×800 | `keyboardFocus.test.ts`; jornadas a 1280×800 | Parcial | Sem auditoria de leitor de tela; validação humana pendente |
| 07 Arte/origem | Reuso do importador/revisão MUGEN; prévia com células reais e origem SFF por ocorrência | E1 (prévia o2/o3) | PASS (cert2-mugen-real-oracle no binário 013: 204 quadros do core/212 da UI, 5 controles negativos recusados) | Só ações 0/20/21/200 |
| 08 Tempo | Duração por ocorrência em ticks, espelho coerente, sem FPS global para MUGEN | E1 `rom_effect_measured_in_emulated_frames` | PASS (cert2-e1e3: `rom_effect_measured_in_emulated_frames`, restauração byte-idêntica) | PAL não medido |
| 09 Timeline | `CharacterTimelinePanel` (miniaturas, reprodução em ticks, passo, onion, mover ocorrência) | `CharacterTimelinePanel.test.tsx`, `characterTimeline.test.ts` | PASS (unit) | Transições entre animações não editáveis |
| 10 Caixas/eventos | Caixas editáveis graficamente por ocorrência (arrastar, redimensionar, setas, campos, +/−) com `clsn_edited`; eventos ocorrência+tick; encurtar diagnostica | `characterTimeline.test.ts`, `CharacterTimelinePanel.test.tsx` (9); Rust `mugen_real_edited_attack_box_removes_the_hit`; cert2-e2e5 (caixa +100 px: 0 acerto; desfazer: 1 acerto) | PASS | Sem espelhamento (facing) |
| 11 Golpe | Nó/comportamento `authored_strike` → `LogicOp::AuthoredStrike` (Clsn1 real × Clsn2, 1 por ativação) | Rust `mugen_real_authored_strike_*` (core real); jornada E2 | PASS (cert2-e2e5 `rom_strike_sound_hud`) | Sem facing; um alvo por nó |
| 12 Áudio | Evento de som por ocorrência no runtime; importar WAV validado; prévia no editor; registro de SFX único por ROM | Rust `mugen_real_frame_sound_event_*` (amostras do core, controle silencioso); `import_project_audio_*`; jornada E2 | PASS (cert2-e2e5 `authored_sound_on_attack_occurrence`, `rom_strike_sound_hud`; Rust core: latência 3–4 quadros) | Som físico/loopback não medido |
| 13 Cena | Pintar/apagar tiles, colisão separada, pincéis interpolados, câmera de mundo | `tilemapCells.test.ts`; Rust `reference_real_camera_*`; cert2-scene (herdado) | PASS | **Defeito aberto:** em projeto MUGEN com tilemap, o tilemap usa PAL0 fixo e sobrescreve as cores do personagem e da fonte |
| 14 Comportamentos | “Golpe autoral” na biblioteca (Quando a cada quadro → Fazer golpe) sobre o mesmo NodeGraph | `authoredStrikeNode.test.ts` | PASS (unit) | Cartões Quando→Se→Fazer reaproveitam o painel de comportamentos existente |
| 15 HUD | `HudTextComponent` + `hud_runtime.rs`; com câmera de mundo o texto vai para o plano fixo WINDOW (topo OU base; HUD nas duas metades bloqueia o build) | Rust `hud_text_bound_*`, `hud_with_world_camera_*`, `mugen_real_hud_text_*`, `mugen_real_hud_stays_screen_anchored_while_camera_scrolls` (falhou antes da correção); cert3-e2e5; cert3-hud-camera-r7 (+ controle negativo 013) | PASS | WINDOW cobre o plano A nas linhas do HUD; letras sobre o cenário sem fundo próprio; diálogos fora |
| 16 Diagnóstico | `projectReview.ts` + `DeliveryPanel` (o que/objeto/consequência/ação, navegação exata) | `projectReview.test.ts`, `DeliveryPanel.test.tsx`; E5 | PASS (cert2-e2e5 `hud_bound_error_navigates_to_property`, `export_canonical_rom`; cert2-model `missing_file_reported_with_users`) | Erros de toolchain continuam no console |
| 17 Inspecionar | BG/SPRITE/TEXTO + **Colisões** (caixas da ocorrência atual e células sólidas) + **Áudio** (disparos/último evento), escolha entre sobrepostos, câmera considerada | `RuntimeInspectOverlay.test.tsx`, `runtimeLink.test.ts`; cert2-e1e3, cert2-e2e5 (camadas no quadro pausado, reamostra ao avançar) | PASS | Áudio é lista de eventos, não amostras por quadro na camada |
| 18 Vínculo | `retrodev.runtime_link/v1` com identidade de conteúdo (sempre conferida), câmera, caixas, eventos e colisão; recusa ROM/época/quadro/recurso alterado | `runtimeLink.test.ts`; Rust `runtime_link_maps_*`; cert3-e1e3 (nova compilação → vínculo com SHA novo aceito) | PASS | — |
| 19 Limites por origem | Autoral/MUGEN pelo vínculo; ROM comercial: só perfis REX comprovados abrem editor; resto “Desconhecido” | `rexBridge.test.ts`, overlay; cert2-e6 | PASS | Um perfil comprovado exercitado (platformer_jump no Sonic 1) |
| 20 Teste temporário | `emulator_write_test_memory` (WRAM, época), `TestAdjustPanel`, diff selecionável, 1 desfazer | `TestAdjustPanel.test.tsx`; Rust `mugen_real_test_adjustment_*`; E5 | PASS (cert2-e2e5 `temporary_adjust_no_hit_apply_undo`) | Só posição |
| 21 Atualização | `buildFreshness` (Prévia atualizada/Recompilação necessária/Executando build anterior/Confirmado na ROM atual) | `buildFreshness.test.ts`, `DeliveryPanel.test.tsx` | PASS (unit) | Sem recarga a quente |
| 22 Base canônica | Mesmo store/UGDM/compilador/IPC; nenhum motor paralelo | revisão de código; regressões cert2-mugen-real, cert2-mugen-import, cert2-nodegraph | PASS (revisão, sem medição dedicada) | — |
| 23 Gêneros | Plano preservado (referências), não implementado | — | Fora de escopo | — |
| 24 Destinos | HUD/strike/eventos recusados no SNES de forma explícita; mastering MD na entrega | `authoredStrikeNode.test.ts` (SNES) | PASS (unit) | Painel de capacidades por destino não ampliado |

## Classificação ao fim da rodada 3 (binário 014 `5f4c815a…`, fonte `8305794e`)

- **Aprovado em jornada nova no binário 014:** 03, 15, 17, 18 (e as pernas de 01, 02, 07, 08, 10, 11, 12, 16, 20 que
  cert3-e1e3/cert3-e2e5 reexecutaram).
- **Aprovado na rodada 2 (binário 013), não afetado pelo delta, herdado:** 04, 05, 13, 19 (cert2-e4, cert2-scene,
  cert2-model, cert2-e6), oráculo MUGEN (cert2-mugen-real-oracle), mugen-import, nodegraph.
- **Aprovado só em teste unitário/componente:** 09, 14, 21, 24; 22 por revisão.
- **Parcial:** 06 (sem auditoria de leitor de tela).
- **Defeitos/limites abertos:** paleta PAL0 do tilemap sobre MUGEN (13); WINDOW cobre o plano A nas linhas do HUD (15);
  áudio na inspeção é lista de eventos (17); sem facing (10/11); efeito de jogabilidade do campo E6 herdado (19); PAL não medido.
- **Fora de escopo:** 23.
- **Pendente:** validação humana — sessão preparada no roteiro existente, sem participante; nada de usabilidade validado.

## (Histórico) Classificação ao fim da rodada 2 (binário 013 `cf928038…`, fonte `6cd989a8`)

- **Aprovado em jornada nova no binário final:** 01, 02, 03, 04, 05, 07, 08, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20.
- **Aprovado só em teste unitário/componente (sem jornada ponta a ponta própria):** 09, 14, 21, 24; 22 por revisão.
- **Parcial:** 06 (teclado em campos corrigido e testado; sem auditoria de leitor de tela). Limites listados em cada linha
  continuam abertos, entre eles: HUD no plano A rola com a câmera (13/15); áudio na inspeção é lista de eventos (17); sem
  espelhamento/facing (10/11); E6 mede bytes/IPS/execução da cópia, **não** o efeito de jogabilidade do campo (19, herdado
  das jornadas REX anteriores).
- **Herdado (não reexecutado nesta rodada):** efeito de jogabilidade do perfil REX `platformer_jump`; medições PAL não existem.
- **Fora de escopo:** 23.
- **Pendente:** validação humana (nenhuma participação real ocorreu; não é a única pendência — ver limites acima).

## Adendo da rodada 4 (binário 016 `d3777958…`, fonte de produção `ae0d66cd`)

- **Paletas — aprovado em jornada UI** (`cert4-paletas`, `r4i-paletas-demo-001`): composição personagem+cenário+HUD,
  uso compartilhado/variante local, troca por evento, edição compartilhada com desfazer, persistência e exportação.
- **Paletas — só teste Rust/componente:** conflito sem gravação, liberação com outro uso concorrente, esgotamento,
  fonte compartilhada/regra legada.
- **Não exercitado:** redefinir reserva, mover/renomear, remapeamento de índices, residência com recarga.
- NodeGraph: `cert4-nodegraph` FAIL (instrumento) preservado; `r4i-nodegraph-001` PASS com protocolo do Adendo I.
- Validação humana: pendente. Detalhes em `MISSION.md` (fechamento técnico da rodada 4).
