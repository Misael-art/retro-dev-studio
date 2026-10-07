# FECHO — edição gráfica da fonte do Streets of Rage (segundo jogo) — Experimental

**Alegação (única permitida):** *Fluxo de edição gráfica comprovado nos dois perfis descritos* (Sonic 1 e Streets of Rage World/PtBr, fonte Kosinski).
Não é suporte universal, recuperação da lógica, reconstrução do jogo nem cobertura de ROMs. Sem merge, release ou promoção.

## Pins

| Item | Valor |
|---|---|
| Base | `codex/rex-integrator-sonic-103104` @ `d85485b1b00000d60c244f62695180f5477f24bf` |
| Branch/worktree | `codex/rex-second-game-graphics` · `~/Projects/REX-SECOND-GAME-2026-10-07` |
| Commit de código (binário e jornada) | `5f778f7ee80b935f0700c53c22be44c57ab830ee` (commits seguintes: só documentação/evidência) |
| Binário | `src-tauri/target-test/release/retro-dev-studio` SHA-256 `45dabcb3e1af055c558024f940f85e0c3f9070dec25b6665e3b799ef61fa2f6d` |
| ROM base (BYOR, fora do Git) | `Streets of Rage (World).gen` do zip "Translated PtBr", CRC-32 `88e4ef3c`, SHA-256 `304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d`; é uma **tradução** |
| Cópia da jornada | SHA-256 `9faae341110bbb71cb7d2de1400c5d9405d02e87b79978e8acb68794606169a0` (idêntica à da transação autônoma: determinístico) |
| Patch BPS | SHA-256 `8e65059117c00bce3ef577e299d010c288ce255f90b7a0d0dc6e17c1a4b0df6c` |
| Core | Genesis Plus GX v1.7.4 `46a5521`, `.so` SHA-256 `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1` |
| Evidência | `data/rex_profiles/integration_20261007/evidencia-sor-font/` (`SHA256SUMS`): relatório da jornada nativa (27 checks), relatório do oráculo (27 checks), BPS exportado pela UI, 4 capturas de tela |
| Expectativas | `EXPECTATIONS-SOR-FONT-2026-10-07.md` (congelado antes do efeito; ADENDO datado com as 5 correções) |

Evidência **nova** desta rodada: tudo acima e os gates abaixo. **Herdada** (não reexecutada): provas Sonic anteriores, relatórios das frentes A/B/C/D.

## Etapa 1 — base selada

- `rex_mdgfx`: os 3 panics reproduzidos (`parse_frame`, `parse_plc`, `tile_indices`) eram overflow aritmético de `usize`; agora toda soma/multiplicação de intervalo é verificada
  (`slice_at`, `piece_bytes`, `tile_index`) e devolve `GfxError`. Teste de fronteira falhou no código antigo ("attempt to multiply with overflow") e passa. Cabeçalho do módulo separa
  **hardware** (tile 4bpp, nome de tile, CRAM) de **formato Sonic 1/2** (peça de 5 bytes, tabela de frames relativa, PLC) com os limites exatos aceitos.
- **SIGABRT/longjmp — causa encontrada e reproduzida.** Não é o encoder aPLib (é Rust puro). Duas threads criando/rodando o core Genesis Plus GX no mesmo processo:
  5/6 execuções `*** longjmp causes uninitialized stack frame ***: terminated` (SIGABRT 134) e 1 SIGSEGV; execução serial 0 falhas.
  Reprodução: `scripts/rex_profiles/integration_20261007/core_concurrency_repro.py`. Correção de teste: `test_serial_guard()` nos 4 testes `#[ignore]` que instanciam `EmulatorCore`;
  dois deles rodando em paralelo agora passam (66 s). **Limite:** não mostrei o abort nos testes Rust sem o guard nesta rodada (a reprodução é no core via ctypes); o app em produção usa um core ativo por vez (não auditei todos os caminhos).
- Defeito de PRODUTO descoberto pelo oráculo: `patch_studio` gravava varint BPS fora da spec (sem `value -= 1`), então o BPS exportado **só funcionava no próprio produto** (inclusive os do Sonic).
  Corrigido com vetores canônicos e CRC do alvo; BPS gerados antes não são mais aceitos (sem conversão).

## Etapa 2 — seleção do segundo jogo (Streets of Rage)

Cadeia demonstrada **antes** da UI: identidade (zip/CRC/SHA) → decoder do jogo `$085A2` (160 bytes, idêntico ao do Sonic 1) chamado com A0=`$389A0`, A1=`$FF7000` (`$087FC`, `$119B4`) e pela tabela do
carregador `$B748` (`$B768`: `$389A0→$FF0000`, **observado no core** quadros 305–306 sem input) → 514 bytes → 1568 bytes = 49 tiles 4bpp → fonte itálica; **os tiles chegam à VRAM** (quadro ~340) e aparecem no texto de introdução
("ESTA CIDADE ERA UM…"). Mapa tile→letra medido com 6 ROMs de código binário por tile: A–Z = tiles 1–26 (19 observadas, 8 inferidas). Os outros 4 streams da frente A foram descartados como alvo: arte/mapa em RAM sem consumidor visível,
2248 bytes (não múltiplo de tile), ou sem ligação verificada.
**Achado:** o jogo valida o checksum do cabeçalho no boot (ROM editada sem recalcular = tela vermelha); a transação recalcula (2 bytes, no escopo declarado).
**Achado:** o encoder Kosinski do crate é guloso (618 bytes contra 514 do slot); foi preciso um encoder de **parse ótimo** (463 bytes) em `rex_kosinski.rs`, validado por ida e volta com o decoder do crate.

## Comparação Sonic × segundo jogo

| | Sonic 1 (USA/Europe) | Streets of Rage (World, PtBr) |
|---|---|---|
| Recurso editado | sprites (arte 4bpp **não comprimida**), paleta, duração, sequência | fonte **comprimida Kosinski** em slot fixo |
| Codec | nenhum (bytes diretos) | Kosinski base: decoder do crate + encoder ótimo novo |
| Perfil | `sonic_*`, `sprite_composition` (identidade por SHA) | `streets_of_rage` (identidade por SHA + provas estáticas: decoder, `lea`, tabela) |
| Transação | edição direta na cópia | `rex_kosinski_resource`: revalida → recomprime → cabe no slot → vizinhos → diff só no slot (+ checksum) → BPS |
| Sessão/ledger/BPS/exportar/aplicar/executar | `inspection.rs`, `patch_studio`, `emulatorService` | **os mesmos** (`InspectionSession`, `persist_session`, `write_file_immutable`, `patchCreateBps/ApplyBps`, ponte do core) |
| Prova de efeito | pixels/quadros do Sonic (oráculos antigos) | bytes → RAM/VRAM do jogo → 459 células-A em 78 quadros, igualdade exata do conjunto de pixels |
| Compartilhamento | frames DPLC | 3 pontos de código leem o stream |
| Paleta | lida da ROM | **não lida** (prévia em cinza) |

**Reutilizado:** sessões (`open/save/reopen`), proveniência (`applied_edits`, `InspectionEdit`), cópia imutável, BPS, exportar/aplicar, ponte do emulador, painel de inspeção, decoder Kosinski do crate.
**Novo/específico:** `rex_kosinski_resource.rs` (formato do recurso, sem conhecimento de jogo), `streets_of_rage.rs` (perfil), `kosinski_encode_optimal`, adaptador `sor_font_*` em `inspection.rs`, 2 comandos IPC, `SorFontPanel.tsx`, cenário `sor-font-journey`, oráculo `sor_font_effect.py`.

## Prova (resumo; números nos relatórios)

- **Bytes/índices** (oráculo Python próprio: decoder Kosinski e leitor BPS independentes): plain da cópia = base + exatamente 8 nibbles (tile 1, linha 7, col 0–7: 0→1); stream 466/514 bytes; bytes alterados ⊂ slot ∪ checksum (433 bytes);
  BPS reproduz a cópia; BPS em base divergente recusado.
- **Execução (core, input neutro, sondas diretas rotuladas):** o decoder do próprio jogo deixa em `$FF0000` o plain original (base) e o editado (cópia) nos mesmos quadros; VRAM: tile 1 editado, tiles 2–48 iguais.
- **Tela:** quadros < 588 idênticos; ≥ 588 a diferença é **exatamente** a linha 7 das células-A (459 células em 78 quadros, 0 falhas), 104 pixels no quadro 896 (13 A × 8, previsto antes) e 40 pixels após 720 quadros — o **mesmo conjunto** no framebuffer do app (UI nativa) e no core independente.
- **Negativos:** original×original idêntico; no-op sem escrita; ROM sem perfil → `sor_profile_unsupported`; stream adulterado ≠ plain esperado e cópia adulterada recusada; tile 49/linha 8/índice 16 recusados; ruído total → `needs_space` sem artefato novo;
  patch em base errada recusado (CRC); resposta antiga descartada (teste de frontend); vizinho que mudaria → `dependent_modified`.
- **Jornada nativa (WebDriver, janela real, Xvfb próprio):** abrir → identificar → escolher A → índice 1 → 8 cliques → aplicar → exportar BPS → aplicar à base → executar Original e Cópia no core → salvar → destruir a janela → reiniciar → reabrir:
  cópia, identidade (SHA da base e da cópia), proveniência (1 edição no ledger) e prévia restauradas. Entrada: neutra; nenhuma alteração de RAM como input.

## Gates (no checkout final)

`check:tree` ok · `lint` ok · `tsc --noEmit` ok · `npm test` 968 passados/0 falhas (6 skip) · `cargo fmt --check` ok · `cargo clippy -D warnings` ok · `cargo test --lib` 919/0 (91 ignorados) ·
`crates:gates` rc=0 · `host:certify` rc=0 READY · `security:audit` (npm **11.16.0** isolado, `~/rds-scratch/npm-11.16.0`) 0 vulnerabilidades · `cargo audit` 8 avisos já permitidos.
O host usa npm 12.0.2, que falha com `EALLOWSCRIPTS`; nenhuma configuração global ou política foi alterada. BYOR Rust do SoR: 2 sessões + ferramenta rodadas serialmente.
Builds/suítes/E2E pesados rodaram um por vez.

## CX (avaliação por inspeção, **sem participante humano — usabilidade humana NÃO validada**)

Tarefas avaliadas contra a tela real (capturas em `evidencia-sor-font/`): (1) escolher o recurso — painel dedicado com letras A–Z, tracejado = inferido; (2) entender o que está provado — "Experimental", bloco "Prova, escopo e limites" recolhido;
(3) prever o efeito — texto "toda ocorrência desta letra… outras letras não mudam" + prévia Original/Cópia; (4) Original × Cópia — dois cartões rotulados, também no framebuffer; (5) recusa e retomada — mensagens "Recusado: … nada foi escrito; a fila foi preservada", sessão reabrível.
Fricções **verificadas e corrigidas:** índice 1 quase preto na rampa de cinza (edição invisível na prévia); recusa genérica do core com caminho ≥ 256 caracteres (agora diagnóstico preciso).
Fricções **abertas:** paleta real desconhecida (cores da prévia ≠ jogo); botões "Executar … 720 quadros" exigem ler o resto do painel; só 26 letras + 2 pontos rotulados.

## Riscos e limites

Paleta não lida; B,H,J,K,V,W,X,Y e dígitos sem observação; **sem relocação** (stream precisa caber nos 514 bytes; o parse ótimo dá ~47 bytes de folga); escopo de dependentes = 4 streams vizinhos medidos + diff exato fora do slot, **não** o jogo inteiro;
uma ROM/uma fonte/um slot; é tradução PtBr (a ROM original SoR não foi testada); o checksum do cabeçalho é recalculado só quando o perfil o provou consistente na base; caminho de ROM ≥ 256 caracteres é recusado pelo core;
detector de células-A calibrado depois de falhas (ver ADENDO) — a calibração usou só quadros da base, mas o oráculo foi ajustado após ver resultado; o BPS antigo (não-spec) deixa de aplicar.

## Reprodução

> Corrigido na revisão da PR #110: `cargo test` aceita **um** filtro posicional por chamada; os comandos abaixo usam um filtro cada.

```
cd src-tauri
cargo test --lib streets_of_rage                      # unidade (perfil)
cargo test --lib rex_kosinski                         # unidade (codec + encoder ótimo + recurso)
cargo test --lib patch_studio                         # unidade (BPS)
RDS_SOR_ROM=<rom> RDS_DECOMP_WORK=<dir isolado curto> RDS_SONIC_MULTIFRAME_ROM=<sonic> \
  cargo test --lib sor_font_ -- --ignored --test-threads=1                              # BYOR de sessão
RDS_SOR_ROM=<rom> RDS_SOR_EDITS="1:7:0:1,...,1:7:7:1" RDS_SOR_OUT=copy.gen RDS_SOR_BPS=copy.bps \
  cargo test --lib byor_gera_rom_editada -- --ignored                                   # ferramenta
cd ..
python3 -I scripts/rex_profiles/integration_20261007/sor_font_effect.py --base <rom> --copy copy.gen --bps copy.bps \
  --core <genesis_plus_gx_libretro.so> --work <dir> --out report.json [--journey jornada/report.json]
RDS_E2E_CODE_COMMIT=<sha de código> RDS_SOR_WINDOW=1920x1080 python3 scripts/qa/run-sonic-desktop-isolated.py \
  --xvfb <Xvfb> --xvfb-sha256 <sha> --rom <rom curta> --app src-tauri/target-test/release/retro-dev-studio \
  --work <dir curto> --log j.log --scenario sor-font-journey                            # idem RDS_SOR_WINDOW=1280x800
CORE=<so> python3 scripts/rex_profiles/integration_20261007/core_concurrency_repro.py parallel <rom> 800   # SIGABRT (subprocesso)
```
Fechamento da revisão (BPS interop, exclusividade do core, Kosinski, Sonic, CX): ver `FECHO-PR110-REVISAO-2026-10-07.md`.
