# CONTRATO — Cadeia Sonic (frente b, parallel_recovery_20261004)

**Base fixada:** `codex/rex-sonic-sequencia @ cb56657a142df40d2acd09a3e03e54247f066dea`
(origin no momento da fixacao). Expectativas congeladas antes de medir em
`EXPECTATIONS.md` (commit `a1d95b8`, anterior a qualquer implementacao).

Este contrato separa TRES camadas que a frente B antiga (PR #97) fundiu.
O codigo normative correspondente e `scripts/rex_profiles/parallel_recovery_20261004/b/contrato_sonic.py`;
nenhuma camada implica a seguinte.

## Camada 1 — CODEC (independente de interpretacao)

- 6 streams Enigma (variante plain) nas entradas da tabela `0x1B64C`:
  `0x65432, 0x656AC, 0x65ABE, 0x65E1A, 0x662F4, 0x667C6`.
- O decoder externo e o modulo da frente antiga
  (`enigma_research.py`, SHA-256 `a9ed92f9...` == `decoder_script_sha256`
  do review-pr97), usado como CONSUMIDOR EXTERNO, pinado por hash.
- Saida de cada stream: **4096 bytes**, com `value_offset = 0` medido no
  sitio de chamada (`move.w #0,d0` em `0x1B6CE`).
- Os 6 SHA-256 das saidas coincidem com os pins de `review-pr97.json`
  (paridade preservada; ver `evidencia/cadeia-sonic-verificada.json`).
- O que o codec garante: descompressao byte-identica a referencia. O que
  NAO garante: o que os 4096 bytes SIGNIFICAM.

## Camada 2 — LAYOUT (prova pelos bytes do consumidor)

- Os 4096 bytes sao uma grade **64 linhas x 64 colunas de IDs de bloco de
  1 byte** — nao 2048 palavras de nametable.
- Prova: `0x1B6D2 jsr $171E` escreve em `0xFF4000` (WRAM); o consumidor em
  `0x1B6E8..0x1B702` copia com `move.b (a0)+,(a1)+` (operando de 8 bits,
  `0x1B6F8`) 64 linhas de 64 bytes, saltando 64 bytes de padding por linha
  (`lea 64(a1),a1`, `0x1B6FE`). Contadores: `moveq #63` em ambas as aneladas.
- Geometria estranha ao consumidor (64x32, stride 64, grade != 64x64) e
  RECUSADA por regra com motivo (`geometria-errada`), nunca por aparencia.

## Camada 3 — PROJECÃO EM RAM

- `RAM[$FF1020 + r*128 + c] = plain[r*64 + c]`; os 64 bytes de padding de
  cada linha nunca sao escritos pelo consumidor (o salto `lea 64(a1),a1`
  apenas avanca A1), entao permanecem como estavam na RAM.
- Inverso (`inverso_projecao`) recusa padding sujo e geometria divergente;
  o roundtrip fonte↔RAM e verificado com fixture assimetrica autoral.

## Limites do contrato

- `$FF4000` e **WRAM** (`$FF0000-$FFFFFF`); a porta de dados VDP e
  `$C00004`/`$C0A004`. Tratar o destino como VDP foi o P1 do review.
- O contrato NAO afirma: que os IDs sejam graficos reconstruidos, que a
  arte/mapping/paleta estejam carregados (ver `RELATORIO.md` — niveis), que
  alguma ROM foi executada (nenhuma execuacao; tudo estatico).
- Modo `hipotetico` do CLI existe, mas marca saida como nao promovida; no
  modo `verificado`, evidencia ausente/adulterada impede PROMOVIDO.

## Elo posterior (amostra reservada, nao ajustada depois da resposta)

- `0x1B70C lea $1B738,A0` + `moveq #77,d1` + bloco `0x1B714..0x1B722`
  expandem 78 registros de 6 bytes em slots de 8 bytes em `$FF4008`
  (slot do ID k = `$FF4000 + 8k`): `move.l` do par (frame<<24|ponteiro),
  `move.w` do campo paleta|vram, `move.b -4(a0),-1(a1)` do frame.
- ID `$01` = `0002c5640142` → ponteiro de mappings `0x2C564`, campo
  `$0142` (= ArtTile_SS_Wall segundo o s1disasm pinado). O campo paleta e
  o VRAM base do registro NAO sao decodificados por esta frente —
  referencia faltante registrada no RELATORIO.
