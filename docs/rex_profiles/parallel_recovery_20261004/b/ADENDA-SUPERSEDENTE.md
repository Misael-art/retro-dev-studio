# ADENDA SUPERSEDENTE — P1 da frente B (PR #97)

**Documento corrente para a cadeia Sonic 1.** Nada aqui apaga a historia:
o RELATORIO-INTEGRACION-B antigo permanece na worktree
`/home/misael/RDS-REX-CORPUS-B` (branch `codex/rex-corpus-b`, HEAD
`420e632b03ec16504a4643a7d18aad74a0d9e282`, reconfirmado e NAO alterado
por esta frente). Esta adenda declara quais alegacoes antigas estao
**SUPERSEDADAS** e por que evidencia.

## Alegacoes supersedadas

| # | Alegacao antiga (RELATORIO-INTEGRACION-B) | Status | Evidencia que supersede |
|---|---|---|---|
| A1 | §1.2/§3.2: "$FF4000 = PORTA DE DADOS VDP"; "destino = porta de dados VDP (escrita de nametable em VRAM)" | **REFUTADO** | `$FF4000` esta em WRAM (`$FF0000-$FFFFFF`); porta VDP e `$C00004`/`$C0A004`. Nenhum lea/move para a porta VDP nos 37 sitios pinados. `evidencia/cadeia-sonic-verificada.json` + `evidencia/isa-forms-b.json` |
| A2 | §1.3/§3.2: "os 6 mapas (nametables 64x32)"; "2048 palavras VDP com campos flip/paleta/prioridade" | **REFUTADO** | O consumidor copia os 4096 bytes com `move.b` (operando de 8 bits, `0x1B6F8`) em grade 64x64 com stride 128 e padding de 64 bytes por linha (`0x1B6FE`). Pares de bytes NUNCA formam uma celula; flip/paleta/prioridade nao sao provados para esses bits. `evidencia/fixture-assimetrica.json` rejeita o modelo antigo |
| A3 | §2: `compor-recurso.py` como compositor de "recurso contextual real" desses 6 streams | **SUPERSEDADO** | O compositor antigo fatiava words e rotulava nametable; os JSONs `sonic1-mapa-*.json` daquela worktree passam a estar marcados como **arte de interpretacao recusada** — preserve-los como historia, nao consumi-los como resultado corrente |
| A4 | §3.2 "as 6 encadeiam na ROM com pad word-rounded ... value_offset=0" | **MANTIDO** | Codec inalterado: os 6 plains conferem byte a byte com os pins de `review-pr97.json` com o mesmo decoder (`a9ed92f9...`); `value_offset=0` re-medido no sitio `0x1B6CE` |

## O que passa a ser a leitura corrente

- Os 6 plains de 4096 bytes sao **layouts de fase especial: grade 64x64 de
  IDs de bloco de 1 byte**, projetados em `$FF1020` com stride 128.
- A paridade de codec e os hashes permanecem validos; apenas a
  INTERPRETACAO muda (codec ≠ interpretacao — ver `CONTRATO.md`).
- "6 fases especiais" continua sendo leitura de contexto (guarda
  `cmpi.b #6,($FFFFFE57).b` + 6 entradas), nao observacao em jogo.

## Correcoes de detalhe feitas por esta frente (registradas, nao silentes)

- `0x1B6F8`: `move.b (a0)+,(a1)+` (a descricao antiga dizia destino `d1`);
- `0x1B6FE`: forma LEA `lea 64(a1),a1` (nao ADDA) segundo o objdump do
  toolchain pinado;
- `0x1B72C`/`0x1B730`/`0x1B732`: `move.w #63,d1`, `clr.l (a1)+`,
  `dbf d1 -> 0x1B730` (registadores corrigidos pelo roundtrip assembler);
- `0x1B71A`: `move.b -4(a0),-1(a1)` tem 6 bytes; o pino antigo truncava em
  5 — corrigido e conferido contra a ROM.

Todas as codificacoes dos 37 sitios foram remontadas com
`m68k-elf-as -m68000` (SHA `20342db5...`) e desmontadas com
`m68k-elf-objdump` (SHA `f7d63642...`) — evidencia: `isa-forms-b.json`.

## Pulseman

A paridade 196/196 da frente B antiga permanece um resultado de CODEC.
Ate que consumidores sejam comprovados, a formulacao correta e **"streams
compativeis com o decoder/referencia"** — NAO "196 recursos graficos usados
pelo jogo". Esta frente nao reexecutou a confirmacao Pulseman; herdou-a e
rebaixou o rotulo conforme o review.
