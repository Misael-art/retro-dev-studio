# EXPECTATIONS — Fase F0 (auditoria e contrato) do REX universal — 2026-10-09

Congelado ANTES de auditar ou escrever código. Origem: `docs/14_REX_ARQUITETURA_UNIVERSAL.md` §5 (F0). Base: HEAD `cbe2ee74`. Mudanças de protocolo só por adendo datado; falhas são reportadas como tais.

## Escopo
1. **Auditoria reproduzível** dos módulos de `src-tauri/src/tools/reverse/decomp/` (+ `crates/rex-*` e a ponte TS `src/core/nodegraph/jumpGraphBridge.ts`): script versionado que mede, por arquivo, linhas e ocorrências de termos que ligam o código a um jogo/personagem/campo. Classificação **motor / perfil / caso / misto** por critério escrito ANTES (abaixo), não por impressão.
2. **Contrato em tipos, sem ligar a nada:** `EvidenceLevel` (L0–L6 do doc 14 §3.2) e `ProfileSpec` (perfil como dado, §3.1), com validação e testes. **Nenhum comando IPC, nenhuma UI e nenhum caminho do pulo passam a usá-los** nesta fase.
3. **Rascunho do perfil do pulo como dado** (proposta de D2, marcado rascunho), validado contra o tipo e **conferido contra as constantes do código existente** (domínios aceitos e rótulos) por teste — para provar que o dado descreve o que o código faz, sem trocar o código.

## Critérios de classificação (fixos)
- **caso:** o nome do arquivo ou do módulo cita um jogo/personagem (ex.: `sonic_*`).
- **perfil:** o arquivo define forma de uma rotina/dado específico (padrões, offsets de campo do objeto, nomes de campos) mas o nome não cita jogo (ex.: `rex_platformer_jump`).
- **motor:** sem termos de jogo/rotina específica na lógica; opera sobre bytes/estruturas genéricas (codecs, varredura, endereçamento).
- **misto:** contém motor e perfil no mesmo arquivo; a auditoria lista **quais símbolos públicos** pertencem a cada lado.
Termos medidos: `sonic`, `jump`/`pulo`, `ghz`, `tails`, `hamoopig`, `taiketsu`, `streets`, `delta`; contagem por arquivo, sem pesar contexto. A contagem **não decide sozinha**: orienta e toda classificação "misto/caso" cita os símbolos.

## Critérios de saída (F0) — todos devem valer
| ID | Critério |
|---|---|
| F0-1 | O script de auditoria roda sem rede, gera relatório JSON+MD determinístico (duas execuções = mesmo hash) e cobre **100%** dos `.rs` de `decomp/` e dos `crates/rex-*`. |
| F0-2 | Cada arquivo tem classe e justificativa; todo "misto" lista os símbolos públicos de cada lado; a tabela do doc 14 §2 é **corrigida** onde a auditoria divergir (divergência registrada, não escondida). |
| F0-3 | `EvidenceLevel`/`ProfileSpec`: parse e validação com recusa explícita de perfil inválido (domínio vazio ou invertido, campo sem referência de captura, nível de evidência inexistente, id duplicado); testes unitários cobrindo aceitação e **cada** recusa. |
| F0-4 | O rascunho do pulo valida; um teste confere que os domínios aceitos do dado (`imp/impw/imps` 1..32767; `cut/cutw/cap` −32767..−1) **coincidem** com as faixas do código existente. Divergência = FAIL, não ajuste do teste. |
| F0-5 | **Zero mudança de comportamento:** nenhum arquivo de produto existente é alterado além de registrar os módulos novos (`mod.rs`); nenhum comando IPC novo; `cargo test --lib`, `clippy -D warnings`, `fmt`, `npm test`, `check:tree` verdes; os 18 testes de `rex_jump_ipc` intactos. |
| F0-6 | Métrica de generalidade registrada (doc 14 §6) para a própria F0: linhas novas de Rust/dado e quantas citam jogo (esperado: só o rascunho do pulo, em dado). |

## Não verificado nesta fase (declarado antes)
Jornadas desktop do pulo **não** serão reexecutadas se F0-5 valer: o código novo não é referenciado por nenhum caminho de execução, então o binário muda só por código morto. Se qualquer arquivo de produto existente for alterado além de `mod.rs`, a F0 passa a exigir reexecução de `jump-canvas-journey` e `jump-profile-journey`.
Nada de F1 em diante (içar mecânica, sonda, SoR) é feito aqui.
