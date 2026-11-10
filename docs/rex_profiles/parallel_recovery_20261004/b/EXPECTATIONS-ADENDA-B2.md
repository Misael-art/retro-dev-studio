# EXPECTATIONS — ADENDA-B2 (frente b, parallel_recovery_20261004)

Retificação versionada da frente b. Este arquivo CONGELA expectativas dos itens
2–7 da missão B2 **antes de qualquer medição na ROM**. Ele não prova nada:
apenas fixa o que a medição terá que confirmar ou derrubar. Base de código:
`cffe17f` (branch `codex/parallel-recovery-20261004-b`); base histórica
congelada: `cb56657`. Referência estática: s1disasm pinado em
`064e3c68eb19cc85b8801b087f9d95f9b3e82cea` (leitura; nada daqui é transplantado
para o produto). ROM BYOR pinada `c7da53a1…` (não versionada).

Regra de desvio (herdada de EXPECTATIONS.md, mantida): divergência entre o
medido e o congelado aqui = FAIL/INCONCLUSIVE com série bruta registrada;
limiares e expectativas NÃO são reescritos para acomodar resultados.

---

## E12 — Revalidação das 7 recusas com controle discriminante por recusa

Cada recusa existente (`modo_negativos`) passa a exigir um CONTROLE que usa o
input mínimo-correto e deve ser ACEITO pela mesma função. Sem controle aceito,
a recusa é considerada não-discriminante (INCONCLUSIVE), não "verde". As 7
recusas congeladas:

| # | recusa | input que DEVE recusar | controle que DEVE aceitar |
|---|--------|------------------------|---------------------------|
| 1 | `rom-errada` | ROM com byte 0x150 mutado | `carregar_rom` da ROM pinada (SHA confere, 531577 B) |
| 2 | `sitio-alterado` | byte 0x1B6D2 mutado (jsr $171E) | `verificar_sitios` na ROM real → 0 divergências nos 37 sítios |
| 3 | `destino-alterado` | 0x1B6C8 trocado por `43f900c00004` (porta VDP) | os bytes reais `43f900ff4000` (lea $FF4000) aceitos; endereço WRAM diferente do pin também deve recusar (mesma classe) |
| 4 | `stream-fora-da-tabela` | offset 0x99999 | `decodificar_stream` para cada um dos 6 STREAMS reais → 4096 B e SHA conforme PLAIN_SHA (6/6) |
| 5 | `geometria-errada-64x32` | grade 32×64 no plain | `layout_de_plain(plain, 64, 64)` aceito |
| 6 | `geometria-errada-stride64` | `projetar(stride=64)` | `projetar(stride=128)` + `inverso_projecao` roundtrip byte a byte |
| 7 | `consumidor-ausente` | buffer zerado na janela dos sítios | `verificar_sitios` na ROM real (mesma chamada, input válido) → sem recusa |

Além do controle, registrar para cada recusa o **comportamento do modelo
antigo** diante do mesmo input discriminante (ex.: o compositor antigo leria
2048 palavras e visaria a porta VDP onde o modelo novo recusa) — preserved,
rotulado, para o ADENDA-SUPERSEDENTE.

## E13 — Export estruturado por camadas (sem promover categoria)

Artefato novo `data/rex_profiles/parallel_recovery_20261004/b/evidencia/export-camadas-b2.json`,
schema `rex-parallel-b/camadas/1`, com as camadas SEPARADAS e cada afirmação
etiquetada por nível (candidato / referência estática / vínculo estrutural /
consumo observado / equivalência demonstrada):

1. `camada_codec` — Enigma plain: entrada, valor de value_offset, bytes
   consumidos, SHA do plain (6/6), limite 4096 B.
2. `camada_interpretacao` — modelo antigo (2048 palavras / nametable 64×32 /
   porta VDP) reproduzido e marcado `SUPERSEDIDA-REFUTADA` com os motivos.
3. `camada_projecao` — grade 64×64 de IDs de 1 byte, stride 128, base $FF1020,
   roundtrip com padding preservado.
4. `camada_consumidor` — os 37 sítios: bytes pino + mnemônico objdump +
   reassemblagem (ISA), com a distinção ROM-observado vs toolchain-derivado.
5. `camada_cadeia_id` — E14–E16 abaixo (slot, registro, mapping, frame, peças).

Export separado para avaliação da frente D:
`evidencia/export-avaliacao-d.json` — autodescritivo (nome do codec, variante,
parâmetros, hashes das 6 plains, tamanho), marcado "ferramenta de pesquisa,
não candidata a produto", **sem** qualquer adaptação do produto aos codecs
artificiais do benchmark (nenhum campo "espera-produito").

## E14 — Slot em `$FF4000 + 8*k` (layout derivado dos bytes já pinados; a medir no consumidor)

Do bloco de expansão 0x1B714–0x1B722 (pinos ISA já conferidos) e do consumidor
SS_ShowLayout (referência estática), predição congelada do conteúdo do slot:

| bytes | origem no carregamento | leitura no consumidor |
|-------|------------------------|------------------------|
| `[0..3]` | `move.l (a0)+,(a1)+` — long do registro = `(frame<<24) \| ponteiro_mappings` | `movea.l (a5)+,a1` — ponteiro da tabela de mappings |
| `[4]` | `move.w #$0,(a1)+` — metade alta | lida como parte da palavra |
| `[5]` | `move.b -4(a0),-1(a1)` — byte de frame do registro | metade baixa da palavra `move.w (a5)+,d1` |
| `[6..7]` | `move.w (a0)+,(a1)+` — palavra `paleta\|vram` | `movea.w (a5)+,a3` — art tile / settings |

Predição concreta para ID $01 (k=1, endereço $FF4008):
`00 02 C5 64 | 00 00 | 01 42` (registro SS_MapIndex pinado `0002c5640142`).
Consequência estrutural esperada: o word `paleta|vram` $0142 é explicado por
`ArtTile_SS_Wall = $142` com `Tile_Pal1 = (0<<13)` (referência estática
pinada); a animação de rotação escreve 0–15 na palavra `[4..5]`
(`SS_AnimateBlocks`, `move.w d0,(a1)` em `v_ss_spritesettings+8+5-1`), o que
exige que `[4]` permaneça 0 — coerente com `move.w #$0` do carregador.

## E15 — Estrutura de `Map_SSWalls` em 0x2C564 (predição por macro, ANTES de medir)

Derivada somente das macros pinadas (`_MapMacros.asm`, SonicMappingsVer=1:
tabela de palavras relativas ao rótulo; cabeçalho de frame = `dc.b((End−Begin)/5)`;
peça de 5 bytes `ypos, ((w−1)&3)<<2|((h−1)&3), (flags+tile)>>8, tile&$FF, xpos`)
e de `_maps/SS Walls.asm` (16 frames, uma peça cada). Predições congeladas:

- Âncora: palavras são deslocamentos **relativos ao início da tabela**
  (`.current_mappings_table`), consumidas por `adda.w (a1,d1.w),a1` com
  `d1 = frame*2` (`add.w d1,d1`).
- Tabela (32 bytes em 0x2C564):
  `0020 0026 002C 0032 0038 003E 0044 004A 0050 0056 005C 0062 0068 006E 0074 007A`
- Tamanho total da estrutura: 32 + 16×6 = **128 bytes** (0x2C564–0x2C5C3);
  `even` após o último frame não deve inserir padding (par já natural).
- `.straight` (0x2C584): `01 F4 0A 00 00 F4`
  (peça: xpos=−$C, ypos=−$C, 3×3, tile 0, sem flip/paleta/prioridade).
- `.angledN` (0x2C58A + 6·(N−1)), N=1..15: `01 F0 0F 00 <tile> F0`
  com tile = `$09 + $10·(N−1)` (09, 19, 29, …, E9).
- Byte de contagem de cada frame = `01` (uma peça); o consumidor faz
  `move.b (a1)+,d1; subq.b #1,d1; bmi` — frame com contagem 0 deve ser
  tratado como blank (não ocorre nesta tabela).

Qualquer byte medido fora dessas predições = FAIL da cadeia E15 (com série
bruta), não reinterpretacao.

## E16 — Protocolo de pinagem do consumidor (SS_ShowLayout e elo do slot)

O bloco de render de SS_ShowLayout (referência estática: linhas ~111–127 de
`_inc/Special Stage Loading & Drawing.asm`) será pinado **com o mesmo método
dos 37 sítios**: (a) montar cada bloco contíguo em gas m68k-elf com LABELs
para os ramos (`beq/blo/bhs/bmi/dbf`), símbolos substituídos pelas constantes
medidas (ex.: `v_ss_spritesettings` = $FF4000 — o mesmo alvo já pinado em
0x1B706; `id_SS_Glass_Ani4` = $4E pelo comentário do disasm); (b) extrair os
bytes do toolchain pinado (as `20342db5…`, objdump `f7d63642…`, `-m68000`);
(c) buscar a sequência no ROM e exigir **exatamente 1 ocorrência** na janela
do programa SS; (d) gravar offset + bytes + mnemônicos ISA no `camada_consumidor`.
Se 0 ou >1 ocorrências: registrar INCONCLUSIVE com a série bruta das
candidatas; não estreitar a janela para "fechar". O elo "consumo observado"
do slot (E14) só é promovido se (a)–(d) forem verdes.

## E17 — Ligação arte + paleta: resultados permitidos, sem sprite por aproximação

- Vínculo estrutural já previsto (E14): word $0142 = art tile base
  `ArtTile_SS_Wall|$pal1` por referência estática pinada.
- Art planes (padrões de tile reais) e CRAM (cores da paleta do special
  stage): procurar o(s) sítio(s) de carregamento na ROM que consomem a mesma
  base de arte; estado de uma entre duas saídas: `PROVADO-POR-SITIO` (bytes +
  ISA + consumidor) ou `DESCONHECIDO` com a **referência faltante publicada**
  (o que falta: rotina de carga de arte/Kosinski do SS e tabela de paleta).
- Proibido por congelamento: gerar sprite colorido por aproximação;
  substituir sprites reais por formas geométricas em prova de fidelidade;
  composição independente só quando o vínculo da cadeia estiver demonstrado
  (itens 5–6 da missão). A PNGs de diagnóstico de IDs continuam fora do Git e
  rotuladas como visualização, não reconstrução.
- Se a carga Kosinski for necessária: usar a frente A corrigida somente após
  revisão de ISA; até lá, trabalho estrutural independente (bytes + macros).

## Aceitação desta adenda

- E12: 7 recusas + 7 controles aceitos + comportamento do modelo antigo registrado.
- E13: dois exports JSON válidos, camadas separadas, sem promoção automática.
- E14–E16: slot e Map_SSWalls medidos contra as predições acima, consumidor
  pinado com ocorrência única, tudo rotulado por nível.
- E17: arte/paleta com veredito PROVADO ou DESCONHECIDO+referência; nunca aproximado.
- Runtime: não alegado nesta frente; só após execução específica e separada.
