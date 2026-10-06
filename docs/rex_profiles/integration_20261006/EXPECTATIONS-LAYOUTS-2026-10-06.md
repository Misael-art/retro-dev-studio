# EXPECTATIONS-LAYOUTS — leitura nativa dos seis layouts (integrador, 2026-10-06)

Congelado antes de qualquer teste, medição ou execução desta frente. Honestidade
de processo: o módulo `sonic_layouts.rs` e a fiação IPC já estavam *escritos* neste
momento, mas **nada havia sido testado, executado nem medido**; os critérios abaixo
não mudam depois de ver resultado (desvio = FAIL/INCONCLUSIVE com a saída bruta).

Base: `codex/rex-integrator-sonic-103104` @ `07db1534` + `167a8de2` (audit) + 12
commits de B por `cherry-pick -x` (último `79ca8082` ← `da5472c4`).

## Escopo e camadas (não negociáveis)

1. Enigma produz **bytes** (4096). 2. Perfil Sonic interpreta **grade 64×64 de IDs de
1 byte**. 3. O consumidor projeta em WRAM `RAM[$FF1020 + linha*128 + coluna]`.
Nunca "nametable VDP"; nenhum flip/paleta/prioridade por célula; arte não ligada =
desconhecida; CRAM de B = evidência estática. VDP dados = `$C00000`, controle = `$C00004`.
Layouts são **somente leitura**; edição de sprites/paleta/duração/sequência intacta.

## Gates

| ID | Critério | Oráculo |
|---|---|---|
| L1 | `rex-enigma` pacote autônomo em `crates/`, 0 dependências, registrado; fmt/clippy `--all-targets -D warnings`/`test --locked` verdes **fora** da worktree de B | gates do pacote em cópia isolada |
| L2 | `lib.rs` do pacote = `lib.rs` de B salvo `rustfmt` | `rustfmt` do original + `diff` |
| L3 | testes do pacote só com fixtures autorais; round-trip contra codificador de teste independente; prefixos truncados; limites de saída/trabalho exatos; cancelamento por token; ruído sem panic; cabeçalho PCCVH | `cargo test` |
| L4 | decode das 6 streams reais na ROM pinada: **bytes completos** iguais ao oráculo externo pinado (`enigma_research.py` `a9ed92f9…`) e consumo igual (634/1042/860/1242/1233/784; padding 0/0/0/0/1/0; armazenado 634/1042/860/1242/1234/784); SHA-256 de cada saída **calculado agora** | script BYOR separado, aceite real explícito |
| L5 | BYOR ausente ⇒ resultado `AUSENTE`, jamais `PASS` | script + teste ignorado com motivo |
| L6 | `consumers-info` não afirma mais "Enigma não está ativo" e usa `$C00000` para dados | testes + e2e |
| L7 | comando `rex_inspection_sonic_layouts` devolve 6 layouts com sessão+SHA da ROM atual; `grid` devolve 4096 IDs; `cell` resolve coordenada→byte `linha*64+coluna`→RAM `$FF1020+linha*128+coluna`; ID k∈1..78 ⇒ registro `0x1B738+(k-1)*6`, slot `$FF4000+8k`; ID 0 e >78 ⇒ sem definição, com explicação | testes de núcleo |
| L8 | recusas estruturadas: ROM incompatível, sítio adulterado, stream truncada/adulterada, índice 6, linha/coluna 64, `request_id` inválido, `expected_rom_sha256` divergente, cancelamento | testes de núcleo + IPC |
| L9 | UI: seleção dos 6 layouts, grade com zoom, seleção por mouse e teclado (setas, Home/End, PgUp/PgDn), coordenada+ID+origem, definição quando comprovada, desconhecidos explicados, rótulo "Mapa de IDs", técnico em `<details>`; resposta antiga (sessão/ROM/layout) descartada | vitest + jornada real |
| L10 | jornada real no binário final (SHA): abrir ROM → layout → grade → células → origem → salvar sessão → reiniciar de verdade → reabrir → identidade e seleção; oráculo independente para 6 saídas, 1ª/última célula, fronteiras de linha/stride, célula↔byte, integridade da ROM | cenário E2E |
| L11 | regressão: `sonic-sequencia-journey` e `sonic-consumers-inspection` no mesmo binário | E2E |
| L12 | gates de repo: check:tree, lint, tsc, npm test, fmt, clippy, cargo test --lib, crates:gates, npm run security:audit, cargo audit, host:certify | execução |

## Limites declarados desde já

Nenhuma observação de runtime do jogo; hashes históricos são comparação; A (Kosinski)
e C (CFG) permanecem ferramentas de validação, fora do runtime; D não é veto.
Escopo continua **Experimental**.
