# CONTRACT-BENCHMARK-D — contêiner, codecs e conjuntos da barra de avaliação

**Status:** contrato v1 da frente D (rodada paralela 2026-10-04).
**Base:** `cb56657a142df40d2acd09a3e03e54247f066dea`. Expectativas congeladas em
`EXPECTATIONS-D.md` (commit `a90b5c2`), anterior a qualquer medição.

## 1. Propósito

Medir, sem depender dos detectores/decoders/relatórios das frentes A/B/C, se
uma cadeia de recuperação (identidade de codec → vínculo de consumidor →
descompressão → geometria → composição → fluxo → cadeia completa) corresponde à
verdade do objeto. A verdade vem **só da autoria** dos fixtures.

## 2. Contêiner `RDSDBNCH` v1

```
offset 0   magic "RDSDBNCH" (8 bytes ascii)
offset 8   version u16BE = 1
offset 10  n_dir_entries u16BE
offset 12  dir_offset u32BE
offset 16  dir_end u32BE
offset 20  regioes contiguas:
           cabecalho de regiao (16 bytes):
             magic "RDSRGH" (6) | classe u8 | codec u8 |
             total_len u16BE | payload_len u16BE | raw_len u16BE | aux u16BE
           payload (payload_len bytes)
           pad de alinhamento (total_len - payload_len; 0 ou 1)
           — toda regiao comeca em offset par; o pad NAO faz parte do payload
diretorio  n * 16 bytes:
             kind_id u8 | addr_mode u8 (0=byte, 1=word) | id 4 ascii |
             target u32BE | aux u32BE | pad u16
```

Armadilha deliberada: consumidores `word` declaram `target = byte_addr >> 1`.
Quem tratar alvo word como byte erra D1/D2/D3/D7 (mutação M1).

## 3. Codecs

| codec | classe | regra |
|---|---|---|
| `dsb1-store` | stream | payload = raw cru |
| `dsb1-rle` | stream | controle `<0x80`: `n-1` seguido de `n` literais (1..128); controle `0x80\|(n-2)` seguido de 1 byte: repetição de `n` (2..129) |
| `dsb1-lz` | stream | byte `<0x80` = literal; `0xff b` = escape de literal com bit 7; `0x80\|(len-2)` + `dist-1` = cópia backward, len 2..128, janela 256; `0xff` reservado ao escape |
| `kosinski` | stream | bitstream 68k real: descritor 16 bits **little-endian**, bits LSB→MSB, **early fetch** da palavra ao esgotar, semântica de match 00/01 e terminator `01 + c==0` conforme fatos documentados do mdcomp |
| `tiles4bpp-planar` | geom | tiles 8×8, 4bpp, plano por bitplane; bit 7 = pixel mais à esquerda |
| `pixels4bpp` | pixels | linear, 1 byte = 2 pixels |
| `branch-table` | table | entradas `BRA.W d16` (opcode 0x60xx BE + displacement i16 BE); alvo = from + 2 + disp |

Os codecs `dsb1-*` são autorais desta frente (mesma linha de evidência do
build — round-trip interno com eles **não** conta como prova). `kosinski` é o
formato real e é cruzado com instrumento externo:
`scripts/rex_profiles/codecs/kosinski/kos_mirror.py` (espelho mdcomp, família
B; não é oráculo independente de mdcomp — limitação herdada).

## 4. Conjuntos

### `dev-1` — público (commitado em `data/.../d/dev/`)
- fixture: SHA-256 `ba08a8c37dbc98be1f9a82ff479c21c238d750f1f890f8ca6fee7f9f0d67826f` (1236 bytes); semente registrada em `seal.json`.
- 6 streams com consumidor, 3 decoys sem consumidor, 2 blocos de tile de
  mesmo comprimento em bytes e geometrias diferentes (16×16 vs 8×32) com
  composições distintas, 1 bloco de pixels com 6 falsos `BRA.B` plantados,
  2 tabelas de saltos (5 + 4 alvos reais).
- denominadores congelados: D1 9 · D2 6 · D3 6 · D4 2 · D5 2 · D6 9 · D7 10 · N1 3 · N2 6.

### `dev-2` — público, mesmo plano com o gerador corrigido (2026-10-05)
Addendum datado da ronda 3 (requisito 6 / regra **R16** de `EXTENSOES-D.md` §12).
O gerador de entropía das roldas 1–2 (`makeRngDegeneradoV1`) devolvía sempre 0,
polo que as 9 rexións de stream de `dev-1` teñen *plain* de entropía cero e os
eixos de compresión/descodificación nunca se exercitaron contra datos reais.
`dev-1` **non se re-xera**: as súas filas de evidencia pinan eses bytes.

- xerador: `v2` (`xorshift64*`, terna 12/25/27, `a = 0x2545F4914F6CDD1D`,
  truncado en aritmética enteira); semente `rex-parallel-d-20261004/dev-1/v2`.
- fixture: SHA-256 `73d95aea7dc04f6ef67d8e71a26ed722013e76ce156a8a60a886df3c58a24bd2`
  (2428 bytes) em `data/.../d/dev-v2/`, con `seal.json` que declara o xerador.
- mesmo plano, mesmos denominadores conxelados de `dev-1` (D1 9 · D2 6 · D3 6 ·
  D4 2 · D5 2 · D6 9 · D7 10 · N1 3 · N2 6) — o que cambia é a entropía dos datos,
  non a estrutura medible.
- `cli.mjs author dev-2` re-xera; `cli.mjs check-seal` confire os dous conxuntos
  e comproba que cada selo é **reproducíbel** co xerador que declara.
- probas: `scripts/.../d/lib_rng.test.mjs` (13). As secuencias esperadas fixáronse
  cun oráculo externo — `scripts/.../d/oraculo_rng.py`, Python con enteiros
  arbitrários, escrito a partir da especificación publicada e non do código de
  Node —, que `cli.mjs selftest` executa en cada corrida (cruzamento de liñas de
  evidencia, como o espelho `kosinski`).

### `ho-1` — reservado
- respostas **fora da árvore versionada** até o unseal pós-medição; só o pin
  público é commitado: `data/.../d/ho-1/pin.json`, fixture
  `fd7d22f2e7a26c3f90d340bf353614df45a4101c5811c18413cca4d8dc8433ee` (2046 bytes).
- denominadores: D1 12 · D2 8 · D3 8 · D4 3 · D5 3 · D6 13 · D7 14 · N1 4 · N2 9.
- A reserva protege o gabarito de veredito (quais regiões são decoy, quais
  alvos são falsos, hashes de saída). O contêiner é auto-descrito: um leitor
  desonesto pode extrair respostas lendo o fixture — limitação registrada.

## 5. Reprodutibilidade

`node scripts/rex_profiles/parallel_recovery_20261004/d/cli.mjs author dev-1`
regenera os mesmos bytes (PRNG `xorshift64*` com semente fixa). `check-seal`
confere SHA e comprimentos selados e reprova se qualquer gabarito reservado
vazar para a árvore antes do unseal.
