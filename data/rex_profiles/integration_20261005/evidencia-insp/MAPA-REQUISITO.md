# MAPA-REQUISITO — inspeção somente-leitura de consumidores e recursos (2026-10-05)

Entrega visível da ordem do operador (passos 9–11) da Missão E. Contrato
congelado: `docs/rex_profiles/integration_20261005/EXPECTATIONS-INSP-2026-10-05.md`
(texto intacto) + `EXPECTATIONS-INSP-2026-10-05-ADENDO-1.md` (retificação
datada da ambiguidade §1 vs §5-T4). Códigos abaixo no HEAD desta rodada.

| Requisito (congelado) | Implementação | Teste | Limite (o que NÃO alega) |
|---|---|---|---|
| `rex_inspection_sonic_consumers(session_id) -> ConsumersInfo`, read-only, sem lock | `src-tauri/src/lib.rs:2676` (comando) + `:5758` (registro); ponte `src-tauri/src/tools/reverse/decomp/inspection.rs` (`sonic_consumers_info`: `get_stored_session` + `read_sonic_session_rom`, sem gravação) | T8 `inspecionar_nao_escreve` (`sonic_consumers.rs:~700`, `describe` recebe `&[u8]`; cópia conferida byte a byte) e cenário BYOR `so_leitura.*` | não prova execução do jogo; nada roda o 68000 |
| Domínio todo em Rust, UI só renderiza | `src-tauri/src/tools/reverse/decomp/sonic_consumers.rs` (constantes, `describe` em `:426`, recusas); zero regras em TS — `InspectionPanel.tsx:749` (`loadConsumers`) só chama o wrapper | T1–T9 Rust; 3 testes vitest em `InspectionPanel.test.tsx:~1180+` só com DTO fake | a frase por papel é derivada (`CONSUMERS_PAPEL_FRASE`), não nova regra |
| 37 sítios byte-a-byte na ROM carregada | `SITIOS` + fronteira 2 do `describe` | T1 (37/37 `todos-ok`), T2 (tamper `0x1B6F8` → recusa com endereço) | sítio isolado ≠ miolo de instrução; veredito é de bloco |
| Cadeia: tabela `0x1B64C` relida ao vivo → 6 entradas → `jsr $171E` → `$FF4000` (WRAM) | entradas no `describe` (`:~519`), destino/classe/param lidos dos operandos | T4 (troca de entradas → recusa total por §1/ADENDO-1; endereços no motivo) | destino é RAM; NADA toca `$C00004` — vínculo estrutural, não consumo observado |
| Recurso: integridade do span ao vivo; decode NÃO no produto | `recursos` (`span_sha256` vs `SPAN_PINS`, `plain_status="medido-externo"`) | T5 (dentro/fora do span) | licença (decoder externo LGPL-mdcomp) proíbe o decode interno; nível alega identidade+integridade apenas |
| Interpretação 64×64×1B, stride 128, base `$FF1020`, sem prévia confirmada | `Interpretacao` + painel nível 6 (`InspectionPanel.tsx:~1419`) | T9 (valores fixos); teste vitest "NÃO exibe prévia gráfica como confirmada" + `img` null | arte/paleta não provadas; grau fixo "vinculo-estrutural-estatico" |
| Consumidor verdadeiro `0x1B6E8..0x1B702` demonstrado | papel `consumidor` nos sítios; frase "é aqui que o jogo usa o recurso" | T1 + vitest asserted | "aqui o jogo usa" = bytes conferem, não execução observada |
| Falso líder recusado por regra de bytes do produto | `MOTIVOS_FALSO_LIDER`/`MODELO_FALSO_LIDER` + `validar_geometria` | T7 (3 motivos verbatim; `64×32` recusado) | a recusa não resolve o formato verdadeiro — só derruba o modelo antigo |
| MapIndex `0x1B738`, 78×6B, ID01→`0x2C564` | fronteira 3 do `describe` | T6 (byte alterado → recusa) | ponteiro dentro da ROM ≠ consumo do recurso de definições provado |
| 7 níveis em português simples + navegação evidência↔recurso | bloco `inspection-anim-group-consumers` (`InspectionPanel.tsx:1352+`), âncoras nivel-1→5, 7→3 | vitest: sete `#inspection-consumers-nivel-N` presentes | rótulos são a régua candidato/referência/vínculo; promoção só pelo operador |
| Prova BYOR, só SHA no índice | cenário `sonic-consumers-inspection` (`scripts/e2e-tauri-build-run.mjs:11728`, dispatch `:18013`; driver `scripts/qa/run-sonic-desktop-isolated.py`) | report.json do cenário na ROM pinada `c7da53a1…` (SHA no evidência) | ROM/binário fora do índice; sonda técnica rotulada, painel aberto pelo caminho nativo |
| Regressão: edição Sonic intacta | nenhum comando `cadence/sequence/duration` tocado (diff da rodada é aditivo) | `cargo test --lib` 869/0; `npm test` 936/0; jornada `sonic-sequencia-journey` reexecutada no MESMO binário final (evidência) | reexecução é a promotora; sem ela, apenas declarado não-testado |

Categorias mantidas separadas: candidato ≠ referência estática ≠ vínculo
estrutural ≠ consumo observado ≠ equivalência — esta entrega para em
"vínculo estrutural provado pela interface"; promoção ao operador.
