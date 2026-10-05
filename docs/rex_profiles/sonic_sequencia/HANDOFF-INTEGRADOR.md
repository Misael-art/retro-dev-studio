# HANDOFF-INTEGRADOR — frente Sonic-sequência (PR #104)

Data: 2026-10-04. Autor da entrega: frente `codex/rex-sonic-sequencia`.
Destinatário: integrador (único autorizado a mexer produto/IPC/UI compartilhados,
Memory Bank e ROUND_STATE, e a decidir merge). Este documento NÃO promove
maturidade: a superfície continua **Experimental**.

## 1. SHAs publicados e dependências efetivas

| Item | SHA | Estado |
|---|---|---|
| PR #104 head | `e43ac1ea9843878300a8791039714f6df449bc38` | OPEN, MERGEABLE, CI terminal 6/6 success (validate×2, desktop-smoke×2, linux-validate×2; Sourcery skipped) — log `~/rds-scratch/ci-e43ac1e-rollup.log` |
| PR #103 head | `53400024676ad12e57fef3026835badb01723e37` | OPEN, MERGEABLE, CI terminal 6/6 success (verificado pontualmente em 2026-10-04) |
| Base de #103 | `codex/rex-integrator-consolidation` (head #98 `0ef540e9`) | fora desta frente |

Cadeia de fundição: `#98 → #103 → #104`. **Atenção do integrador:** os PRs
OPEN **#105, #106, #107 e #108 têm base `codex/rex-sonic-sequencia`** — qualquer
reescrever histórico em `e43ac1e` quebra os quatro. Esta frente só adiciona
commits (fast-forward) e não fará rebasing sem ordem expressa.

A prova da jornada §5.2 é do HEAD `491c21b` com binário `e243d1ad…`. Sobre ele
há 3 commits adicionais: `731dcfa`+`fb94777` (só docs/evidência) e `e43ac1e`
(1 fix de estilo clippy/rustfmt em `sonic_sequence.rs:88`, comportamento
idêntico, com `cargo test --lib` 860/0/84 reexecutado no tip). **A jornada
não foi reexecutada num binário construído de `e43ac1e`** — ver §8.

## 2. Critérios atendidos (mapa)

- §5.1 (proposta discriminante B `swap(0,17)` sobre base `[01×12,03,02,02,02,03,04]`): atendido — EVIDENCIA-P3 §"Critério §5.1" e checks `passo2.*`.
- §5.2 (jornada desktop na UI real, 8+2 passos): **executada e aprovada por critérios congelados** — 42/42 checks, passos 1–10, `evidence/journey/report.json` (SHA `cb8138a9…`) e mapa completo em EVIDENCIA-P3 §Pendência 1.
- §5.3 (verificador independente + pipeline canônica + core): atendido — `scripts/qa/sonic-sequence-route-oracle.mjs` (20 checks + `--selfcheck` com 5 negativos recusada) e observação no core Genesis Plus GX v1.7.4.
- Contrato: `CONTRACT-SEQUENCIA.md`; expectativas congeladas **antes** das corridas em `EXPECTATIONS-SEQUENCIA.md` (`d80b30c`; a jornada §5.2 e a proposta B entraram na adenda congelada `7331c88`); nenhuma reescrita pós-corrida (devia ser FAIL honesto — foi o que aconteceu 14×, todas no harness, dirs `-01…-15` com `exit_code!=0` nos `run.json`).

## 3. Código exercitado (o que o integrador está a rever)

Produto (Rust, `src-tauri/src/tools/reverse/decomp/`):
- `sonic_sequence.rs` — validação de cópia/proposta, `permute` in-place, no-op sem escrita, restauração seletiva; ledger.
- `sonic_cadence.rs` — `validate_copy` compartilhado cadência↔sequência (integração `8b85589`), `WAIT_ADDR/WAIT_FRAMES`, preservações entre domínios.
- `inspection.rs` — comandos de sessão; oráculos de runtime (percurso + terminador `FE 02` por recarga de timer, sem offsets de RAM inventados).
- Registro IPC em `lib.rs`: `rex_inspection_sonic_sequence` (:2665), `rex_inspection_edit_sonic_sequence` (:2676), `rex_inspection_restore_sonic_sequence` (:2689), `rex_inspection_sonic_cadence` (:2641).

UI (React/TS):
- `src/components/tools/InspectionPanel.tsx` — painel da sequência (proposta ≠ aplicado, guarda de época `sequenceEditSeq`, busy state, mensagens com SHA da cópia), seletor de perfil, restaurações seletivas.
- `src/core/ipc/toolsService.ts` — wrappers dos comandos acima.

Harness/evidência (fora do produto):
- `scripts/e2e-tauri-build-run.mjs` cenário `sonic-sequencia-journey` (passos 1–10, gate de proveniência `buildCommit === HEAD`).
- `scripts/qa/run-sonic-desktop-isolated.py` (Xvfb próprio + pin de SHA), `scripts/qa/sonic-sequence-contract.mjs`, `scripts/qa/sonic-sequence-route-oracle.mjs`.

## 4. Artefatos: classe por classe (todos os hashes conferidos em 2026-10-04)

**Versionados no branch (auditáveis por `git show e43ac1e:…`):**
`docs/rex_profiles/sonic_sequencia/{CONTRACT-SEQUENCIA.md, EXPECTATIONS-SEQUENCIA.md, EVIDENCIA-P3.md, evidence/route-*.json, evidence/sonic-sequence-route-verification.json, evidence/PROVENIANCE-SERIES.txt, evidence/journey/}` — os 9 arquivos de `evidence/journey/` conferem com `desktop-journey-manifest.json` byte a byte (re-hash feito nesta rodada).

**Locais duráveis (NÃO versionados por política BYOR — nenhum byte de ROM/binário no git):**
- binário da prova: `src-tauri/target-test/release/retro-dev-studio` = `e243d1ad9a57dfd1d9b85a7a083975880c4f2e4c3201061f83ec25a42942668b` (re-hash OK nesta rodada).
- `src-tauri/target-test/validation/inspection-2026-10-04T07-25-04-064Z-sequencia-journey/` — `report.json` (`cb8138a9…`), `sequencia-journey.bps` (`4b338921…`), `sequencia-journey-aplicada.bin` (`dd064e0d…`) — re-hash OK.
- pins de entrada: ROM BYOR `c7da53a1…1ebb` em `/home/misael/RDS-REX-CORPUS-E/.staging/`, Xvfb `5bfd315a…` em `~/.cache/retrodevstudio/qa-xvfb/21.1.24-1/` — re-hash OK.

**Referências históricas (scratch, podem ser podadas pelo dono da máquina):**
`/home/misael/rds-scratch/sequencia-journey-20261004-{01,02,03,05..17}/` (16 dirs; `-04` não existe) — cada um com `run.json`/`run.log`; causas das falhas transcritas no manifesto.

Cópia intermediária do passo 9 (`28ea1bd5…`) foi **recomposta offline** a partir da base pinada (intervalo=30 em `0x13BAE` + swap pos11↔pos12 em `0x13BBA/0x13BBB`) e o SHA conferiu — verificação independente sem o app.

## 5. Comandos reproduzíveis

```bash
# 0) rebuild canônico (o gate de proveniência exige HEAD commitado e limpo):
npm run build:portable

# 1) jornada §5.2 (binário da prova é e243d1ad; reconstrua se o tip mudar):
python3 scripts/qa/run-sonic-desktop-isolated.py \
  --xvfb ~/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb \
  --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 \
  --rom "/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin" \
  --app src-tauri/target-test/release/retro-dev-studio \
  --work <dir-novo> --log <dir-novo>/run.log \
  --scenario sonic-sequencia-journey
# veredito: "OK: ... allPass=true" + report.json em src-tauri/target-test/validation/<ts>-sequencia-journey/

# 2) verificador independente do percurso + negativos:
node scripts/qa/sonic-sequence-route-oracle.mjs          # 20 checks
node scripts/qa/sonic-sequence-route-oracle.mjs --selfcheck  # recusa os 5 negativos

# 3) contrato congelado:
node scripts/qa/sonic-sequence-contract.mjs

# 4) gates do destino (o que foi executado em e43ac1e):
npm run check:tree; npm run lint; npx tsc --noEmit; npm test   # 933/6skip
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # NUNCA --all-targets (defeito pré-existente ast_generator.rs:3479)
cargo test --lib --manifest-path src-tauri/Cargo.toml              # 860/0/84ignore
npm run host:diagnose && npm run host:certify                       # READY / Success
```

## 6. Taxonomia de interação (não confundir categoria com prova de usuário)

| Classe | Onde | O que vale como |
|---|---|---|
| **Interação nativa** | passos 2–9 da jornada: cliques WebDriver por hit-test de coordenadas reais nas entradas/painéis, digitação do número de duração, Enter→START no core | prova de fluxo de produto pela UI real |
| **Sonda técnica via IPC do produto** | negativos do passo 10 (sessão divergente, recurso inexistente, token `0x07`, comprimento 17) — rotuladas no relatório | prova de validação/recusa do backend; **não** é prova de usabilidade |
| **Interceptação de transporte** | atraso de 2600ms injetado via wrapper `window.fetch` na URL `ipc://localhost/rex_inspection_edit_sonic_sequence` (a superfície `__TAURI_INTERNALS__` do Tauri 2 é não-gravável; troca de `invoke` falha em silêncio) | prova da guarda de época do produto (`sequenceEditSeq`) contra ack atrasado; a latência é do harness |
| **Sonda de superfície rotulada** | seleção do perfil Sonic na 2ª sessão por `dispatchEvent('change')` (popup GTK nativo ignora teclas injetadas) — `selectionMode` registrado no log | habilitação de estado; **não** atribuída a teclado/clique humano |
| **Observação independente** | route oracle node puro, recomposição offline da cópia passo 9, pixels do composto vs pixmap X11 (passo 7) | conferência externa ao app |

Nenhuma prova técnica desta frente é atribuída a interação humana.

## 7. Roteiro de demonstração (curto, para o integrador)

1. Abrir Inspeção → BYOR: carregar a ROM pinada; conferir SHA-256 visível (`c7da53a1…`).
2. Escolher perfil `sonic1_sonic`; painel da sequência mostra 18 entradas na ordem original.
3. Clicar entrada da posição 16 e mover até a posição 0 (bolha do `04`), depois mover a `03`/`02` conforme proposta B; mensagem "Pendente: 2 posição(ões) diferem…" ≠ aplicado.
4. **Aplicar ordem** → mensagem com SHA da cópia (`0306a5ab…`).
5. Editar duração (cadência) para 40 na mesma cópia reordenada → cópia `dd064e0d…`; conferir que os pixels/paleta do sprite não mudaram (painel do frame composto).
6. Exportar BPS → reaplicar sobre a base → cópia byte-idêntica (`dd064e0d…`).
7. Salvar sessão, destruir, reiniciar o app, reabrir: 18 thumbs nos dois painéis, sem imagem antiga.
8. Restaurar somente a ordem (duração 40 permanece) e depois somente a duração (ordem permanece) → volta à base exata.

Custo de máquina: um build/E2E por vez (regra de serialização com o integrador).

## 8. Matriz de reexecução (se o integrador alterar…)

| Mudança | Reexecutar |
|---|---|
| `sonic_sequence.rs` / `sonic_cadence.rs` / validação de cópia | `cargo test --lib` (filtros sonic_*), contrato mjs, route oracle + `--selfcheck`, **jornada §5.2 completa** em binário reconstruído do tip |
| Camada de transporte/IPC (toolsService, comandos, Tauri upgrade) | jornada §5.2 passos 10 (negativos + época) e 5 (BPS), além dos testes Rust; o harness de atraso depende do formato `ipc://localhost/<cmd>` — revisar `selectInspectionFrameNative`/patch de fetch se mudar |
| UI do `InspectionPanel` (layout/estados) | jornada §5.2 passos 2/3/6/8 (hit-test e proposta≠aplicado) |
| Wiring do emulador/core | passo 7 (sprite conferido + framebuffer) e negativos de teclado |
| Só docs/evidência | gates rápidos (check:tree/lint/tsc/test) sem jornada |
| **Estado atual recomendado** | como `e43ac1e` = tip com apenas estilo pós-prova, o mínimo honesto pós-merge é: `npm run build:portable` + 1 corrida do cenário `sonic-sequencia-journey` |

## 9. Limitações residuais (registradas, não resolvidas por esta entrega)

- **Usabilidade humana não medida** — sem participante; nada aqui declara facilidade de uso.
- Um único caminho provado: Sonic USA/EU pinada, NTSC, só `id_Wait`, só proposta B; PAL, outros scripts/perfis e velocidade-dependentes ficam fora. Sem alegação universal.
- `cargo clippy --all-targets` não verde (defeito pré-existente alheio à frente).
- Cópia BYOR aplicada e BPS vivem só localmente (política); o integrador que quiser reprodizer precisa da ROM pinada.
- WebDriver/WebKitGTK: popup nativo de `<select>` não recebe teclas injetadas (fallback rotulado); envelope de async script colide com tráfego pesado da página (mitigado por espera condicional).
- A jornada de prova é do HEAD `491c21b` (ver §1/§8).
- Não houve demo assistida por terceiro com o roteiro §7.

## 10. Consumo pelo integrador

- Rever #104 como diff sobre `5340002` (`git diff 5340002..e43ac1e`) — 29 arquivos, +5575/−248, território: `src-tauri/src/tools/reverse/decomp/{sonic_sequence,sonic_cadence,inspection}.rs`, `lib.rs` (registro IPC), `src/components/tools/InspectionPanel.tsx`, `src/core/ipc/toolsService.ts`, `scripts/{e2e-tauri-build-run.mjs,qa/*}`, `docs/rex_profiles/sonic_sequencia/*`.
- Erros concretos apontados em revisão: esta frente corrige no mesmo branch (fast-forward), sem rebase, e reexecuta a matriz §8 conforme o tipo de mudança.
- Esta frente não faz merge, release, promoção nem toca Memory Bank/ROUND_STATE.
