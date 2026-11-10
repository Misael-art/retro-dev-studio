# PROPOSTA (não implementada) — investigação limitada de instrumentação do core — 2026-10-09

Proposta para decisão do operador (alimenta D1 do doc 14). **Nada aqui foi implementado**: é a próxima missão sugerida, com teto de custo e critério de saída. Não amplia o motor de perfis.

## Pergunta única
Com o core pinado (`genesis_plus_gx_libretro.so`, lock `dd99a22f…`) **sem modificá-lo** e só com as interfaces que o produto já liga, dá para obter alguma evidência de **consumo** (a execução alcançou a rotina; por qual chamador) — ou a resposta é "não, exige core com gancho"?

## Interfaces disponíveis hoje (conferidas em `src-tauri/src/emulator/libretro_ffi.rs` e `lib.rs`)
| Interface | O que dá | Granularidade |
|---|---|---|
| `retro_run` | avança um quadro | quadro |
| `retro_get_memory_data/size` → `emulator_read_memory` | RAM do sistema (leitura) | entre quadros |
| `retro_serialize` / `retro_unserialize` → `emulator_save_state` / `emulator_load_state` | estado completo do core (formato próprio do core) | entre quadros |
| callbacks de input | entrada determinística | quadro |
| `TraceBackend` | **só mock** (adendo de correções, item 1) | — |
Não ligadas: `retro_cheat_set`, mapas de memória (`SET_MEMORY_MAPS`), qualquer gancho de CPU. O único ambiente tratado é `SET_PIXEL_FORMAT`.

## O que investigar (duas sondas, nesta ordem)
1. **Registradores no estado serializado.** Localizar no blob de `retro_serialize` o bloco do 68000 (PC, SR, D0–D7, A0–A7) e validá-lo: A7 tem de apontar para a RAM e os bytes em volta têm de coincidir com `emulator_read_memory`. Resultado esperado: PC **de fim de quadro** (quase sempre o laço de espera do VBlank) — útil só como âncora para a sonda 2, não como trace.
2. **Resíduo de pilha.** Um `jsr`/`bsr` empilha o endereço de retorno; depois do `rts` o valor fica na RAM abaixo do SP até ser sobrescrito. Ao fim de cada quadro, ler a região morta da pilha (A7 da sonda 1) e procurar os endereços de retorno dos chamadores estáticos conhecidos de uma rotina. Alvo de calibração: o pulo do Sonic 1 (`0x1340C`), único caso com efeito medido (L5): quadros com pulo × quadros sem pulo.

## Custo (teto)
2 dias de uma sessão. Sem dependência nova, sem alterar o core, sem escrever na RAM, sem novo pipeline de patches. Código só de instrumento (script de jornada + leitura), nada em `rex_profile_*`. Um E2E pesado por vez.

## Critério de saída (um dos três, declarado antes de medir)
- **A — viável:** em N ≥ 10 repetições por condição no Sonic 1, o endereço de retorno do chamador aparece no resíduo em ≥ 9/10 dos quadros "com pulo" e em ≤ 1/10 dos "sem pulo", e no Delta distingue a instância `0x16914` das `0x1732A`/`0x1A170`. Vira proposta de eixo de consumo **fraco** ("chamada observada por resíduo de pilha; chamador sim, argumentos não"), a ser especificado em missão própria.
- **B — inviável por sobrescrita/ruído:** taxas fora do limiar. Registrar as taxas e encerrar a técnica.
- **C — inviável na sonda 1:** o bloco de registradores não é localizável/validável no estado serializado deste core. Encerrar.
Em B ou C, a conclusão é "consumo observado exige core com gancho de PC (opção B do doc 14 §3.3)": passa a ser decisão do operador sobre dependência nova (licença do core, manutenção, reflexo em `docs/02_TECH_STACK.md`).

## O que esta investigação NÃO afirma, mesmo no caso A
Resíduo de pilha não mede argumentos nem ordem de execução, pode ser antigo (controle negativo obrigatório) e não é trace. Não muda nenhuma afirmação do perfil do pulo. Execução isolada (executor de `crates/rex-gameplay/src/m68k.rs`) continua não demonstrando chamada pelo jogo (adendo, item 2).

## ADENDO 2026-10-09 (noite) — correção de alcance, sem reescrever o texto acima
**Resíduo de pilha é pista, não comprovação temporal de chamada.** Um endereço de retorno encontrado na região morta da pilha pode ter sido empilhado em qualquer momento anterior (inclusive antes da janela observada) e não ordena eventos nem liga a chamada a um quadro. Portanto:
- o "critério A — viável" acima **não** autoriza chamar o resultado de "consumo observado", nem de eixo de consumo "fraco": no máximo "pista de que uma chamada daquele sítio ocorreu em algum momento", a ser tratada como hipótese para uma observação de verdade (gancho de PC);
- as taxas pedidas (≥ 9/10 e ≤ 1/10) medem a utilidade da pista, não a ocorrência temporal da chamada;
- nenhuma afirmação de perfil pode subir de origem ou de eixo por causa dela.
Esta investigação continua **não implementada**.
