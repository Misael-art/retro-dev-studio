# Evidência — inspeção de consumidores e recursos (INSPEÇÃO-INSP-2026-10-05)

Integrador, 2026-10-05. Nada aqui promove categoria: a entrega para em
**vínculo estrutural estático provado pela interface**. Promoção é do operador.

## Binário e ambiente (idênticos nas três execuções)

- App (release, construído do commit `35c6657`): SHA-256 `8c781bb0468e809d38a06d386ae63fa2b9793059ce72903f17b82e7c59f87cd4`
  - log de build: `~/rds-scratch/build-portable-20261005-insp.log` · SHA-256 `c0f52e290621c583a8286482b0bb00ccfc5b8e23af08efac7c90d4347c0f2479`
- ROM BYOR pinada (Sonic 1 USA/EU, 531577 B): SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` — arquivo fora do índice; só caminho e hash.
- Xvfb pinado (21.1.24-1): SHA-256 `5bfd315a8c7bc62d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351…` (conferido pelo driver em cada run; `system_display_modified=false` nas três).

## Execuções (contagens reconciliadas: executados = alegados)

| # | cenário | checks | passou | veredito | report |
|---|---------|--------|-------|----------|--------|
| 1 | sonic-consumers-inspection (run-1) | abortada no 1º check falso | — | INCONCLUSIVE — bug de asserção do harness (comparava `0x065432` estofado contra o formato congelado `{:#x}` = `0x65432`); as 6 entradas da tabela conferiam byte a byte com os pins | `report.json` da run-1 descartada do índice; linha bruta em `verdicts-linha-bruta.txt` |
| 2 | sonic-consumers-inspection (run-2, HEAD `d614fd2`) | 24 | 24 | allPass=true | `report-sonic-consumers-inspection-run2.json` |
| 3 | sonic-sequencia-journey (regressão obrigatória §6, pois a UI InspectionPanel foi tocada) | 42 | 42 | allPass=true, sem regressão na edição Sonic existente | `report-sequencia-journey-regressao.json` |

- Atribuição honesta (registrada no próprio report): painel aberto pelo **caminho nativo** da sessão real (cliques WebDriver nativos); leitura do DTO, reinspeção e ledger são **sondas técnicas rotuladas** via invoke do produto — não são teclado do usuário.
- Somente-leitura provado por: bytes da ROM idênticos antes/depois, ledger de edições com 0 entradas, reinspeção idempótica byte a byte, `final.base_preservada`.

## Logs brutos e artefatos referenciados (fora do índice por política)

- `~/rds-scratch/journey-consumers-20261005.log` (run-1) · SHA-256 `064e1eca620e1e3a94caf93b8bd54702be0a6c6a643190677fcd1cd9cbf64036`
- `~/rds-scratch/journey-consumers-20261005-r2.log` (run-2) · SHA-256 `611860db43ff98112b01106fba68708e10f097b800a96780611a0f0d3799d2b8`
- `~/rds-scratch/journey-sequencia-20261005.log` · SHA-256 `ec61dc4dbc21bf41be8161ab6d6acb2e65309f55adaf127ad004b8491555b710`
- `~/rds-scratch/crates-gates-20261005.log` · SHA-256 `8bcc04242301c422b6658ff0cf02f81a0406cfbdd933d2f0927bdeb63d2bfa69`
- Screenshots da janela (contêm arte derivada da ROM comercial → NÃO indexados, só referência):
  - painel consumidores (run-2): `…/validation/inspection-2026-10-05T11-27-58-455Z-consumers-panel.png` · SHA-256 `0561bbeeec4faee7e195f920d0fc7fa6353fbf1abadd3d075422a98b002ef550`
  - copia aplicada da jornada (derivado da ROM): `sequencia-journey-aplicada.bin` · SHA-256 `dd064e0d9d12f5dc8fee66e9944ff07739ec96cc165084b05710aa3dededc170`
  - patch BPS da jornada: `sequencia-journey.bps` · SHA-256 `4b338921b1a33f2d65a7d92d70ebb812ddac4b0dcf6ce0fd3d27f480e5f4c11e`
- Metadados do driver QA (pin por run): `driver-metadata-consumers-run1.json`, `driver-metadata-consumers-run2.json`, `driver-metadata-sequencia-regressao.json`.

## Gates no HEAD final (`d614fd2`)

| Gate | Estado | Nota |
|------|--------|------|
| `npm run check:tree` | OK (rc 0) | "Estrutura da raiz conforme docs/08" — inclui este diretório de evidência |
| `npm run lint` | ok (rc 0) | |
| `npx tsc --noEmit` | rc 0 | |
| `npm test` | 936 passaram / 0 falhas / 6 pulados (99 arquivos de 100) | log `~/rds-scratch/npmtest-20261005-final.log` |
| `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test --lib` (869/0) | HERDADOS de `35c6657` — válidos porque `git diff 35c6657..d614fd2` toca apenas `scripts/e2e-tauri-build-run.mjs` (1 linha); árvore Rust idêntica | |
| `npm run crates:gates` | OK — 4 pacotes registrados, gates próprios aprovados | log `~/rds-scratch/crates-gates-20261005.log` · SHA-256 `8bcc04242301c422b6658ff0cf02f81a0406cfbdd933d2f0927bdeb63d2bfa69` |
| `npm run host:certify` | rc 0 | log `~/rds-scratch/host-certify-20261005.log` |

## Contrato e recusa

- DTO congelado `consumers-info/v1`; 37/37 sítios byte a byte; cadeia recusada por inteiro se qualquer sítio divergir (ADENDO-1).
- Falso líder (janela de 4×4 como layout) REFUTADA com 3 motivos fixos; 5 desconhecidos mantidos; Enigma **não** decodificado no produto (decoder externo LGPL-mdcomp pinado, referência por hash).

## Mapa requisito→implementação→teste→limite

Ver `MAPA-REQUISITO.md` neste diretório.

## SHA-256 dos arquivos deste índice

| Arquivo | SHA-256 |
|---|---|
| `MAPA-REQUISITO.md` | `9d9277ccd9c0542cf1f76e18d1927f3934402b6f1da0bc9961fe43df75977f33` |
| `report-sonic-consumers-inspection-run2.json` | `6ee1d66a03ca0acb1b58ff10d1158cccfabbbafccd6f4f9f3613b72956166fa6` |
| `report-sequencia-journey-regressao.json` | `9f48435a862613a769eab588321cf6fecdeee2a179a169dd27cd775baf2fb861` |
| `driver-metadata-consumers-run1.json` | `78659ff24c707b946f8485168a6bbf1cd10bdc0d04b60de7ee51d615baf0697a` |
| `driver-metadata-consumers-run2.json` | `76843c4c514f9e5f4a46f4a523798a955674a128292603f89541c5506472f94a` |
| `driver-metadata-sequencia-regressao.json` | `49ef66fc427400e1a1ac6723d192ece50908b3f42aff95ad7c5a241c8b5127f8` |
| `verdicts-linha-bruta.txt` | `b0157f4308187ba9757570ee2222584b1caf365d593b4dd1643cc7419e644e06` |
