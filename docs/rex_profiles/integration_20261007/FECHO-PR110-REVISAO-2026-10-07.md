# FECHO — revisão da PR #110 (BPS estrito, exclusividade do core, Kosinski, Sonic+SoR no mesmo binário, CX) — Experimental

Sem merge, release, promoção ou push forçado. Alegação inalterada: *fluxo de edição gráfica comprovado nos dois perfis descritos* (Sonic 1 e SoR World PtBr).

## Pins (tudo neste fecho foi exercitado sobre eles)

| Item | Valor |
|---|---|
| Base da PR | `codex/rex-integrator-sonic-103104` @ `4be2049d76353479cb103d884151131922e641e3` (a missão citava `d85485b1`: a base remota avançou; `git merge-base` = `4be2049d`). O diff da PR (17+ commits) inclui o trabalho anterior de composição Sonic **e** o lote SoR; nenhum commit foi excluído |
| Branch | `codex/rex-second-game-graphics` |
| Commit de código (binário e jornadas) | `f130358bc7992620e593a4297a0b6ef4e46af6cf` (commits depois deste: só docs/evidência) |
| Binário | `src-tauri/target-test/release/retro-dev-studio` SHA-256 `24ae17876443d8fe7648b077c51cdb2c6b2961a8bd97f6b931bce976bec8c8b5` |
| ROM SoR (BYOR) | `304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d` (tradução PtBr) |
| ROM Sonic 1 (BYOR) | `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` |
| Cópia SoR / BPS SoR | `9faae341110bbb71cb7d2de1400c5d9405d02e87b79978e8acb68794606169a0` / ver `MANIFEST.json` (o BPS é regravado a cada execução, mesmo conteúdo) |
| Core | Genesis Plus GX v1.7.4 `46a5521`, `.so` `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1` |
| Aplicador externo | Flips (binário "Floating IPS v201") do pacote Arch `extra/flips-198-3`: pacote `3d488a159570f77c01d0083d6866d3c17038c699d7ff0b6a053d64a3c727758b`, binário `3f3033ef4293931011a2e7043b83200b0818c8ff7fb15d7fa480719219509253` |
| Manifesto | `data/rex_profiles/integration_20261007/evidencia-pr110/MANIFEST.json`: 54 artefatos (21 no Git, 33 locais) + 7 pins externos |

**Evidência nova** (esta revisão, no binário/commit acima): tudo listado em `evidencia-pr110/`. **Herdada** (não repetida): provas Sonic anteriores à correção do BPS, relatórios das frentes A/B/C/D.
**Histórica**: `evidencia-sor-font/` (rodada anterior, commit `5f778f7e`, binário `45dabcb3…`) — marcada como tal em seu README; não vale para o código atual.

## 1. Aplicador BPS (bloqueador)

- Os 5 casos reproduzidos (`/home/misael/rds-scratch/review-pr110-20261007/bps-repro.rs`) viraram testes **que falham no código antigo** (executados contra o `patch_studio.rs` anterior: 5 FAILED) e passam no novo: patch sem ações para alvo não vazio, `SourceCopy` negativo, `TargetCopy` de histórico futuro, `TargetRead` maior que a saída, varint de 21 bytes.
- `apply_bps_checked` (erro estruturado `BpsError{code,message}`; `apply_bps` mantém a assinatura de texto): varint ≤ 10 bytes com `checked_*` (o `checked_shl` anterior não detectava estouro); leitura **só dentro do corpo** (rodapés nunca viram ação); teto de saída `BPS_MAX_OUTPUT`=64 MiB validado **antes** de alocar; toda ação dentro da saída; `SourceRead`/`SourceCopy` dentro da origem; `TargetCopy` só sobre histórico já produzido (cópia sobreposta válida preservada, byte a byte); sem substituição por zero, sem `min()`/`break`; consumo exato do corpo e produção exata da saída; CRCs de origem, alvo e patch. Escrita do arquivo de saída atômica (temporário + rename); recusa não cria saída.
- **Interoperabilidade bidirecional com ferramenta externa pinada** (`bps_interop.py`, Flips v201): produto cria → Flips aplica; Flips cria (`--bps-delta` e `--bps-linear`) → produto aplica; 4 ações + metadados + `TargetCopy` sobreposto válidos aceitos pelos dois; 4 malformados recusados pelos dois; fronteiras de varint (127/128/129/16511/16512/16513), tamanhos diferentes, origem vazia. **66/66 checks.** Defeito do binário **externo**: `--bps-linear` dá SIGSEGV em 2 fixtures (`bloco_movido_e_repeticoes`, `vazio_para_pequeno`); registrado em `external_tool_failures`, **não** contado como PASS do produto (o `--bps-delta` dessas fixtures passou).
- O oráculo (`bps_interop.py`, `sor_font_effect.py`, `bps_external_apply.py`) não importa o aplicador do produto.

## 2. Sonic — revalidação no binário final

Jornadas nativas no mesmo binário `24ae1787…`: `sonic-anim-integrada` (abrir, localizar `id_Wait`, pixel, duração, conferir cópia crua por mutação independente, **BPS exportado pela UI e aplicado pela UI**, jogar a modificada, salvar → destruir a janela → reiniciar → reabrir, ledger, restaurar) **allPass**; `sonic-sequencia-journey` (mover entrada + duração + roundtrip cadência/sequência, BPS, reabrir, restaurar) **allPass** (42 checks). Os dois BPS exportados pela UI foram aplicados no **Flips externo** e a saída é idêntica, byte a byte, à cópia gravada pelo produto (`flips-sonic-*.json`). As jornadas herdadas **não** foram atribuídas ao código novo.

## 3. Exclusividade do core (invariante do ciclo completo)

Auditoria: `EmulatorCore::new` só criava um handle; `load_rom` chamava `stop()`, **substituía o slot global ativo**, fazia `dlopen` e registrava callbacks globais; duas instâncias (threads ou intercaladas) corrompiam uma à outra, e `stop()`/`Drop` limpavam o slot **sem checar o dono** (uma instância ociosa apagaria os callbacks do dono).
Invariante: um dono por processo, `CoreLease` RAII (`CORE_OWNER`), adquirido **antes** de qualquer efeito global (slot, `dlopen`, `retro_init`, callbacks) e liberado **depois** de `retro_unload_game` + `retro_deinit` ou quando a carga falha; segunda instância é **recusada** com `core_busy` (sem bloquear, sem deadlock); `clear_active_emulator` só limpa o slot se ele pertence à própria instância.
Testes: mock core — segunda instância recusada sem corromper a primeira (quadro idêntico ao de uma execução isolada), 4 threads disputando → exatamente 1 dono, falha de carga libera o core; **mutante** (lease desligado) faz 2 desses testes falharem; core **real** GPGX (`#[ignore]`, `RDS_REAL_CORE_ROM`): B recusada 25× enquanto A roda, sem aborto. O comportamento anterior continua reproduzível só em **subprocesso limitado** (`core_concurrency_repro.py`: 5/6 SIGABRT + 1 SIGSEGV), nunca na suíte principal. Limite: a exclusividade vale **por processo**; dois processos do app com o mesmo `.so` não compartilham globais (cada um tem seu espaço de memória).

## 4. Compatibilidade e encoder Kosinski

- **BPS antigos** (varint fora da spec): arquivos preservados; **nunca** aceitos automaticamente (`bps_legacy_format`, diagnóstico que explica a incompatibilidade com Flips/beat e indica reexportar); reexportação a partir de base + cópia verificadas da sessão pelo botão "Exportar BPS" (o `edit`/ledger persistidos). Testes: reconhecimento, não aplicação, arquivos intactos e saída inexistente; patches cujos varints são todos < 128 coincidem com a spec e continuam aplicando.
- **Encoder Kosinski** (`kosinski_encode_optimal`): minimiza o **custo em bits modelado** (controle 1 + dado 8 por byte; literal 9, inline 12, separado 18, estendido 26); **não** se alega mínimo global em bytes (o modelo ignora o arredondamento de descritor/recarga antecipada). Limites: entrada ≤ 64 KiB (`input_limit`), trabalho ≤ `max_work` (`work_limit`), saída ≤ `max_stream` (`stream_limit`); síncrono, limitado por esses tetos (sem ponto de cancelamento próprio). Auditoria encontrou que o orçamento padrão estourava em entradas repetitivas de ~1 KB (todas as distâncias avaliadas por posição); aplicada **poda por dominância** (só avanço estrito da fronteira distância×comprimento; saída idêntica, provada contra a referência exaustiva em 16 casos e pelo hash da cópia SoR inalterado) — 64 KiB de zeros agora codificam em < 10 s. Determinismo testado; validação independente (decoder Python próprio) em **108/108** casos (bordas de comprimento 255–258, distância 256/257/8192/8193, descritor 1–79 literais, aleatório, a fonte real); nenhum caso maior que o encoder guloso do crate. Memória ≈ 32 B por byte de entrada (2 MiB no teto).

## 5. CX e apresentação (por inspeção e medição; **sem participante humano — usabilidade humana NÃO validada**)

Reaproveitando o layout existente (`Group` left/center/right): **modo ampliado** (`Ampliar painel` na barra da inspeção, sempre visível; `Restaurar layout`), o painel à direita passa a ~80% da largura, a cena fica minimizada e o guia do workspace compacta; editor em 2 colunas quando largo (`@container`); **zoom inteiro** ×2–×6 (células de tile e prévia sem encolher; framebuffers em ×1–×3, `image-rendering: pixelated`); **barra de ações fixa** de uma linha (Aplicar à cópia · Limpar · Exportar BPS · Aplicar BPS à base · Executar Original/Cópia); dados técnicos recolhidos (consumidores, prova, limites); selos visíveis **"Prévia em cinza por índice — a paleta real do jogo NÃO foi lida"** e legenda das letras **inferidas** (tracejadas); retomada do contexto (letra, zoom, cor) por sessão (`localStorage`, conveniência por visualizador). As cores da prévia continuam sendo uma rampa de cinza, **não** a paleta real.
Provado em **1920×1080** e **1280×800** (tamanho **efetivo** medido por `innerWidth/innerHeight`, antes e depois de reiniciar): 49 checks por jornada, incluindo hit-test de acessibilidade/sobreposição dos controles, modo ampliado medido em pixels, escala inteira, selos e retomada de contexto; capturas em `~/rds-evidence/pr110-20261007/capturas/`.
Fricções **encontradas pelas próprias provas e corrigidas**: (a) o pedido de 1280×800 era ignorado pelo harness (o `innerWidth` medido era 1920) — o cenário agora exige o tamanho efetivo; (b) a barra de ações quebrava em 4 linhas e cobria o editor em 1280×800; (c) a barra de rolagem overlay do WebKit cobria a base dos botões — espaço reservado sob a barra; (d) o hit-test do WebKit ignora botões desabilitados — o oráculo trata o contêiner ancestral como não-obstrução só para controles desabilitados; (e) corrida em "listar sessões salvas" (botão desabilitado durante o auto-refresh) — uma repetição após esperar o controle voltar.
Fricções **abertas**: em 1280×800 o cabeçalho "Reverse Workspace" do painel ainda consome ~230 px de altura (rolagem necessária); o modo ampliado não persiste entre reinícios (o usuário reamplia); paleta real, letras B,H,J,K,V,W,X,Y e dígitos não rotulados.

## 6. Higiene e política

- `__pycache__` introduzidos pela missão (2 `.pyc`) saíram do índice em commit normal (arquivos locais preservados; os 4 de `integrator/aplib` são anteriores e não foram tocados); `.gitignore` passou a ignorar bytecode.
- **Capturas e derivados comerciais**: AGENTS.md proíbe distribuir ROM comercial e o Memory Bank registra "sem pixels/ROM/corpus BYOR no Git". Capturas de tela com quadros do jogo, BPS (carregam bytes do conteúdo) e cópias de ROM **saem do Git** e ficam em `~/rds-evidence/pr110-20261007/`; o manifesto os cobre por SHA-256/tamanho (`storage: local-only`). Os 4 PNG e o `export.bps` da rodada anterior foram retirados do índice; **continuam no histórico dos commits anteriores da PR** (sem reescrita/push forçado — remover do histórico é decisão do dono: squash ou reescrita). Nenhuma licença foi inventada; corpus/ROMs seguem BYOR.
- Comandos de reprodução corrigidos (um filtro por `cargo test`).

## 7. Gates (checkout final)

`check:tree` rc=0 · `lint` rc=0 · `tsc --noEmit` rc=0 · `npm test` 971 passados/0 falhas (6 skip) · `cargo fmt --check` rc=0 · `cargo clippy -D warnings` rc=0 · `cargo test --lib` 938 passados/0 falhas (94 ignorados) · `crates:gates` rc=0 · `security:audit` (npm **11.16.0** isolado, `~/rds-scratch/npm-11.16.0`) rc=0, 0 vulnerabilidades · `cargo audit` rc=0 (8 avisos já permitidos) · `host:certify` rc=0 **READY**. O host usa npm 12.0.2 (`EALLOWSCRIPTS`); nada global foi alterado e o audit não foi desabilitado. Builds/E2E pesados rodaram um por vez.
Um `clippy -D warnings` reprovou no meio da revisão (helper de teste fora de `cfg(test)`); foi corrigido e **todo o pipeline (build, 4 jornadas, oráculos) foi refeito** para o binário pinado coincidir com o código final.

## Riscos e limites restantes

Experimental. Paleta real não lida; sem relocação (a edição precisa caber nos 514 bytes; ~47 B de folga na fonte); escopo de dependentes = 4 streams vizinhos medidos + diff exato fora do slot; é a tradução PtBr; uma ROM, uma fonte; oráculo de células-A calibrado depois de falhas (ADENDO das expectativas); o aplicador externo (`--bps-linear`) tem defeito próprio; exclusividade do core é por processo; CI só é "terminal" por SHA quando consultado (ver comentário da PR); nenhuma validação com pessoas.
