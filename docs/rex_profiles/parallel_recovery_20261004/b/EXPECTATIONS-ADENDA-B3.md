# Expectations — ADENDA B3 (referência faltante do CRAM)

Congelado em 2026-10-04, ANTES de qualquer leitura/medição na ROM desta
rodada. Nenhuma expectativa será reescrita depois de medir: desvio =
FAIL/INCONCLUSIVE com série bruta registrada no JSON de evidência.
Escopo: fechar (ou declarar faltante de forma precisa) a referência
`cram_paleta` publicada em E17/RELATORIO §3 da rodada B2.

## Fatos da referência estática pinada (não medidos aqui)

Fonte: s1disasm pinado `064e3c68eb19cc85b8801b087f9d95f9b3e82cea`
(`/home/misael/.cache/rex-corpus-d/s1disasm`).

- `_inc/Special Stage Loading & Drawing.asm`: `SS_AnimateBlocks` termina
  com bloco "Animate wall palette cycle" que REESCREVE o word
  `slot[6..7]` de cada parede em `v_ss_spritesettings+$16` a partir da
  tabela `SS_Wall_Palettes_VRAM`, indexada por `(v_ani0_frame & 7)*2`,
  com `adda.w #$20,%a0`/`adda.w #$48,%a1` por set de paredes (rept 4).
- Macro `sswallpal paletteline`: `normal = ArtTile_SS_Wall|(line<<13)`,
  `blink = ArtTile_SS_Wall|(((line-1)&3)<<13)`; 4 sets (0=azul,
  1=amarelo, 2=verde, 3=rosa); cada set = `rept 2` de
  `n,B,n,n,n,n,n,B` → 16 words = 32 B → tabela inteira 128 B + `even`.
- `_inc/Special Stage Background & Palette Cycle.asm`: `PalCycle_SS`
  decrementa `v_palss_time`, lê 4 bytes de `SS_Timing_Values`
  (índice `(v_palss_num&$1F)*4`), escreve VDP regs `$8200/$8400`,
  `v_ssbganim`, `v_scrposy_vdp`, e copia 12/8 bytes de
  `Pal_SSCyc1` ou `Pal_SSCyc2` para os espelhos
  `(v_palette_line_3+$E).w`, `(v_palette_line_4+$E).w`,
  `(v_palette_line_3+$1A).w`, `(v_palette_line_4+$1A).w`.
  `Pal_SSCyc1` = binclude "palette/Cycle - Special Stage 1.bin" (72 B,
  SHA-256 `ec2391eb813ae8cbd1e6e81e9e52c8b58f419cfc368154e5de6f3ebf561068a9`);
  `Pal_SSCyc2` = "…/Cycle - Special Stage 2.bin" (210 B,
  `65e5c9430f84c7a4680bbda060f29e7f50f2e22d87fa9c8368b04cb5826bd74c`).
- `_inc/Palette Index.asm`: `makePalEntry` gera 8 B por paleta
  (`dc.l rotulo; dc.w ramaddr; dc.w (fim-rotulo)/4-1`); ordem dos ids:
  0 SegaBG, 1 Title, 2 LevelSel, 3 Sonic, 4 GHZ, 5 LZ, 6 MZ, 7 SLZ,
  8 SYZ, 9 SBZ1, **10 Special (→ `v_palette_line_1`)**, 11 LZWater,
  12 SBZ3, 13 SBZ3Water, 14 SBZ2, 15 LZSonWater, 16 SBZ3SonWat,
  17 SSResult, 18 Continue, 19 Ending.
- `sonic.asm` (setup do Special Stage, ~linha 3253):
  `moveq #palid_Special,d0` + `bsr.w PalLoad_Fade` → carga inicial da
  paleta SS no BUFFER DE FADE (`v_palette_fading`), não direto na
  paleta ativa. `palid_Special = 10` ⇒ `moveq #$A,%d0`.
- `sonic.asm` L1695-1727: `PalLoad_Fade` = corpo constante +
  `adda.w #$80,%a3` (delta fading−ativa); `PalLoad` = idem sem o delta.
- `Macros.asm` L35-43 `writeCRAM source,dest`: 6 writes na
  `vdp_control_port=$00C00004` (`vreg_dmalen=$94009300`,
  `vreg_dmasrc=$96009500`, `vreg_dmamode=$9700`, destino `$C000+dest`,
  eco por `v_vdp_buffer2`). Chamadas `writeCRAM v_palette,0` e
  `writeCRAM v_palette_water,0` aparecem no VBlank (sonic.asm L740/743,
  L822/825, L886, L920/923, L983, L1013/1016) — é a transferência
  periódica RAM→CRAM (DMA 68K→VDP).
- `_Variables.asm`: `phase ramaddr($FFFF0000)` (geral), `phase $FF0000`
  (SS), `phase v_objstate` (error handler); `s1.sounddriver.ram.asm`
  define SÓ templates (`SMPS_Track=$30`, `SMPS_RAM=$5C0`), instanciados
  por `v_snddriver_ram: SMPS_RAM` dentro da fase geral.

## E18 — Derivação e âncoras dos endereços de RAM (referência, sem ROM)

`scripts/.../b/calc-enderecos-ram-b3.py` implementa as regras acima e só
produz números se AS TRÊS âncoras passarem:
(a1) `v_ss_spritesettings == $FF4000` — já PROVADO por código consumidor
em E14/E16; (a2) `v_sslayout_actual == $FF1020` — destino Enigma já
provado; (a3) `v_palette_fading − v_palette == $80` — a constante
`adda.w #$80` do `PalLoad_Fade`. Saída congelada como PREDIÇÃO (a ROM é
a juíza; qualquer divergência num bloco medido ⇒ aquele bloco vira
INCONCLUSIVE, sem reescrever esta tabela):

| símbolo | 24-bit | forma `.w` (sinal-extension) |
|---|---|---|
| v_ani0_time | $FFF900 | $FFFFF900 |
| v_ani0_frame | $FFF901 | $FFFFF901 |
| v_palss_num | $FFF1DA | $FFFFF1DA |
| v_palss_time | $FFF1DC | $FFFFF1DC |
| v_palss_index | $FFF1DE | $FFFFF1DE |
| v_palette = v_palette_line_1 | $FFF540 | $FFFFF540 |
| v_palette_line_2 | $FFF560 | $FFFFF560 |
| v_palette_line_3 | $FFF580 | $FFFFF580 |
| v_palette_line_4 | $FFF5A0 | $FFFFF5A0 |
| v_palette_fading | $FFF5C0 | $FFFFF5C0 |
| v_palette_water | $FFF4C0 | $FFFFF4C0 |
| v_scrposy_vdp | $FFF056 | $FFFFF056 |
| f_pause | $FFF07A | $FFFFF07A |
| v_ssbganim | $FFF1E0 | $FFFFF1E0 |
| v_vdp_buffer2 | $FFF080 | $FFFFF080 |

## E19 — Bloco de piscar paredes (`SS_AnimateBlocks`) e tabela VRAM

Reconstrução gas na ordem exata da referência (protocolo E16: bytes
esperados MONTADOS com o toolchain pinado, nunca escritos à mão):

```
subq.b  #1,(0xfffff900).w        ; v_ani0_time
bpl.s   L
move.b  #$7,(0xfffff900).w
subq.b  #1,(0xfffff901).w        ; v_ani0_frame
andi.b  #$7,(0xfffff901).w
L: lea  (0xff4016).l,%a1         ; v_ss_spritesettings+8+8+6  (CONHECIDO)
    lea  (TGT).l,%a0             ; SS_Wall_Palettes_VRAM — WILDCARD de 8 B
    moveq #0,%d0
    move.b (0xfffff901).w,%d0
    add.w  %d0,%d0
    lea    (%a0,%d0.w),%a0
    [rept 4: move.w disp8*1(%a0),disp8(%a1) ×8; adda.w #$20,%a0; adda.w #$48,%a1]
```

Critério: ocorrência ÚNICA na ROM `c7da53a1…` tratando o `lea (TGT).l`
como wildcard de 8 B (segmentos antes e depois consecutivos); o valor lido
no site É o endereço de `SS_Wall_Palettes_VRAM`. Conteúdo esperado nos
128 B daquela tabela (palavra = `(line<<13)|$142`; padrão do set =
`n,B,n,n,n,n,n,B` repetido 2×; big-endian):

| set | normal | blink |
|---|---|---|
| 0 azul | $0142 | $6142 |
| 1 amarelo | $2142 | $0142 |
| 2 verde | $4142 | $2142 |
| 3 rosa | $6142 | $4142 |

Cross-check estrutural (já medido em E14): slot[6..7] da amostra
ID$01 = $0142 = palavra "normal" do set 0.

## E20 — `PalCycle_SS` (espelhos de paleta em WRAM)

Reconstrução gas dos dois segmentos (corpo + `PalCycle_SS_2`) com os
valores `.w`/constantes da tabela E18 e `$C00004/$8200/$8400/$94…`;
WILDCARDs de 8 B somente nos `lea (X).l` de `SS_Timing_Values`,
`SS_BG_Modes`, `Pal_SSCyc1`, `Pal_SSCyc2` (alvos lidos nos sites).
Critérios: ocorrências únicas por segmento na mesma posição; os 4
destinos `.w` dos espelhos devem ser exatamente $FFFFF58E (line_3+$E),
$FFFFF5AE (line_4+$E), $FFFFF59A (line_3+$1A), $FFFFF5BA (line_4+$1A);
conteúdo em `Pal_SSCyc1` = 72 B com SHA `ec2391eb…`; `Pal_SSCyc2` =
210 B com SHA `65e5c943…` (byte-a-byte, fonte = bins do disasm pinado).

## E21 — Carga inicial da paleta SS, `Pal_Index` e transferência →CRAM

1. Pinar `PalLoad` e `PalLoad_Fade` pelos corpos constantes (única
   diferença prevista: `adda.w #$80,%a3` só no Fade); ler o alvo do
   `lea (Pal_Index).l` no site.
2. Em `Pal_Index`: 20 entradas × 8 B. Entrada [10] (`palid_Special`):
   word ramaddr == $F540 (E18) e contagem == $1F (128 B = 32 longos,
   `(end-begin)/4-1` = $1F). Entradas [4..9] (nível) ramaddr == $F560.
   No ponteiro longo da entrada [10], os 128 B devem ter SHA
   `2f9072d8714ac735dba537f2cbb00aeac349b411fc86d1ef76fb9c81b7c3432d`
   (bin "Special Stage.bin" do disasm pinado).
3. Sítio de setup: `moveq #$A,%d0` (`700A`) seguido de `bsr.w`
   (`4EF9`) com alvo == endereço do `PalLoad_Fade` pinado no item 1;
   registrado com contexto desmontado.
4. Expansão completa do macro `writeCRAM v_palette,0` e
   `writeCRAM v_palette_water,0` montada com o toolchain (constantes
   $C00004/$94009300/$96009500/$9700 + comprimento $80 + fonte $F540/
   $F4C0 + `v_vdp_buffer2` $F080): contagem de ocorrências na ROM e
   registro de TODOS os sites com contexto desmontado (não se exige
   unicidade aqui — a referência declara múltiplas chamadas VBlank).

## E22 — Teto de alegações e disciplina de evidência

- Tudo nesta rodada é ESTÁTICO: vínculo estrutural + identidade byte-a-
  byte contra referência pinada. "Consumo observado" (CRAM realmente
  escrito em execução) permanece NÃO PROVADO; nenhuma imagem/“sprite
  colorido” será composte por aproximação.
- Se qualquer critério E19/E20/E21 falhar: manter o campo `cram_paleta`
  como DESCONHECIDA na exportação, publicar a referência faltante
  refinada (bloco + bytes esperados vs. série bruta observada).
- Se todos passarem: `cram_paleta` sobe para "vinculo estrutural
  (+ dados byte-a-byte contra referencia pinada)" — NUNCA "equivalência
  demonstrada" sem execução.
