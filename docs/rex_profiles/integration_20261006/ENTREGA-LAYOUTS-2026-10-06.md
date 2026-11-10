# ENTREGA — leitura nativa dos seis layouts (integrador, 2026-10-06) — Experimental

Destino `codex/rex-integrator-sonic-103104` (base recebida `07db1534`, PR #109). Sem merge, release ou promoção.
**Binário final**: `src-tauri/target-test/dev/cargo-target/release/retro-dev-studio`, SHA-256
`02ab2eecb896138a403098b31e06342a1f0cd2ff25c41087f9a44c3b6aaccb20`, construído de `ac670155` (árvore limpa, gate de
proveniência binário==HEAD ativo). Commits posteriores a `ac670155` só tocam documentação/evidência.
ROM BYOR pinada `c7da53a1…` (fora do Git), Xvfb pinado `5bfd315a…` (`system_display_modified=false`).

## Requisito → implementação → teste → resultado → limite

| # | Requisito | Implementação | Teste | Resultado | Limite |
|---|---|---|---|---|---|
| 1 | Congelar entradas; audit separado | `INVENTARIO-ENTRADAS-2026-10-06.md`; `167a8de2` | `npm ci`, audit, tsc, lint, vitest | audit 0; vitest 956/0 | tips de A/C/D avançaram além dos SHAs da ordem; não integrados |
| 2 | Revisar e empacotar B | `crates/rex-enigma` (0 deps), `REVISAO-ENIGMA-B.md` | 8+12 testes, 6 mutantes mortos, isolado | verde | risco jurídico residual do s1disasm: decisão do operador |
| 3 | Decode das 6 streams vs referência completa | `byor-enigma-acceptance.py` | BYOR real | 6/6 bytes e consumo iguais ao oráculo | só no PC com a ROM; AUSENTE≠PASS |
| 4 | Três camadas; VDP C00000/C00004 | `sonic_layouts.rs`, `sonic_consumers.rs` | testes de núcleo | verde | arte/paleta/CRAM desconhecidas |
| 5 | IPC+UI somente leitura, sessão+SHA | 5 comandos, `SonicLayoutsPanel` | 12 núcleo + 12 painel + 7 nav | verde | sem edição de layout |
| 6 | A/C/D | `SOLICITACAO-D-2026-10-06.md` | — | não integrados | D não respondeu |
| 7 | Jornada real + oráculo independente | cenário `sonic-layouts-journey` | E2E binário final | **73/73 allPass** | não prova consumo em runtime do jogo |
| 8 | Regressões | — | `sonic-sequencia-journey`, `sonic-consumers-inspection` mesmo binário | allPass (ambos) | — |

Gates: check:tree OK; lint/tsc rc=0; `npm test` 956/0 (6 skip); `cargo fmt --check` OK; `cargo clippy -- -D warnings` OK
(`--all-targets` sem achados nos arquivos novos; dívida preexistente da base permanece); `cargo test --lib` 881/0 (85 ignorados,
incl. 1 BYOR); `crates:gates` 5 pacotes OK; `cargo audit` rc=0 (8 avisos já permitidos); `host:certify` rc=0;
`npm audit --audit-level=high` = 0. **Nota de host**: `npm run security:audit` falha com `EALLOWSCRIPTS` no npm 12.0.2 deste PC
(reproduzido em worktree intocada); o comando equivalente direto passa.

## Evidência nova × herdada
- Nova: crate, adaptador, UI, 3 reports em `data/rex_profiles/integration_20261006/evidencia/` (só hashes/textos), BYOR run1.
- Herdada: cadeia/CRAM/evidência de B (SHA256SUMS de B), jornada de consumidores de 2026-10-05 (reexecutada aqui).

## Negativos
Cobertos: ROM incompatível, sítio adulterado, stream truncada/adulterada, saída maior/menor que a grade, índice 6, linha/coluna 64,
request_id inválido, ROM diferente (resposta antiga) — núcleo e E2E; cancelamento e descarte de resposta antiga de sessão/ROM/célula — núcleo e vitest.

## Reprodução
`npm ci && npm test`; `npm run crates:gates`; `cd src-tauri && cargo test --lib sonic_layouts`;
`REX_SONIC_ROM=<rom> cargo test --lib byor_ -- --ignored`; `python3 -I scripts/rex_profiles/integration_20261006/byor-enigma-acceptance.py --rom … --oraculo …/enigma_research.py --work <dir> --out <json>`;
`npm run build:portable` e `python3 scripts/qa/run-sonic-desktop-isolated.py … --scenario sonic-layouts-journey`.
Errata: textos congelados de B/EXPECTATIONS-INSP chamam `$C00004` de "porta de dados"; o correto é dados `$C00000`, controle `$C00004`.
