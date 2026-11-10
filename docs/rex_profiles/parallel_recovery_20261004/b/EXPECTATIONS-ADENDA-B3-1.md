# Expectations — ADENDA B3.1 (refreeze E18R — hipóteses de RAM antes da medida)

Data: 2026-10-04. Refreeze LEGÍTIMO: nenhuma leitura da ROM desta rodada
foi consumida antes deste documento — o primeiro intento de medição
abortou no próprio portão E18 (sem pin, sem evidência derivada da ROM).
A retificação corrige uma AMBIGUIDADE DE DERIVAÇÃO (lado referência)
descoberta ao refazer a derivação dentro do script de medição:

- `_Variables.asm` instancia `v_snddriver_ram: SMPS_RAM` (L114) dentro
  da fase geral, mas a semântasm68k de `label: struct` antes do `phase`
  (templates) vs. dentro do `phase` (alocação) NÃO é decidível a partir
  dos arquivos pinados;
- o veredito implícito do guard `if * > 0 / elseif * < 0` da referência
  (declarações devem fechar exatamente no fim dos 64 KiB da fase geral)
  mostra que UMA das duas leituras é errada por ~6 bytes, mas os
  conjuntos de endereços RESULTANTES diferem em $5C0 — o ROM é o juiz
  apropriado e imediato para essa diferença.

## E18R — hipóteses concorrentes (substitui a tabela única de E18)

Campos inalterados de E19–E21 continuam válidos, exceto que TODO
endereço absoluto `.w` de símbolo da fase geral passa de constante
congelada a CAMPO SELVAGEM (wildcard de 2 B) no bloco montado; os
valores lidos na ROM no sítio pinado É que decidem a hipótese:

| símbolo | H_A (sem alocação L114) | H_B (SMPS_RAM=$5C0 alocado em L114) |
|---|---|---|
| v_ani0_time / _frame | $FFFFF900 / $FFFFF901 | $FFFFFEC0 / $FFFFFEC1 |
| v_palss_num / time / index | $FFFFF1DA / $DC / $DE | $FFFFF79A / $9C / $9E |
| v_palette(=line_1) | $FFFFF540 | $FFFFFB00 |
| line_2 / line_3 / line_4 | $F560 / $F580 / $F5A0 | $FB20 / $FB40 / $FB60 |
| v_palette_fading | $FFFFF5C0 | $FFFFFB80 |
| v_palette_water | $FFFFF4C0 | $FFFFFA80 |
| v_scrposy_vdp | $FFFFF056 | $FFFFF616 |
| f_pause | $FFFFF07A | $FFFFF63A |
| v_ssbganim | $FFFFF1E0 | $FFFFF7A0 |
| v_vdp_buffer2 | $FFFFF080 | $FFFFF640 |

Invariantes fixos (não dependem da hipótese; continuam EXIGIDOS):
- `frame − time == 1`; `palss_time − num == 2`; `palss_index − num == 4`;
- `line_1 == v_palette`; `line_2−1 == line_3−2 == line_4−3 == $20`;
  `fading − line_4 == $20` (espelhando `v_palette_fading` = bloco de 4
  linhas após a ativa);
- espelhos escritos por `PalCycle_SS`: line_3+$E, line_3+$1A,
  line_4+$E, line_4+$1A (exatamente +$E/+$1A sobre os valores lidos);
- região SS intocada (fase `$FF0000`, âncoras já provadas): `lea
  $00FF4016.l` continua CONSTANTE congelada do bloco E19; tabela
  `SS_Wall_Palettes_VRAM` e conteúdo `sswallpal` de E19 inalterados;
- `Pal_Index`: entradas [0..3] e [10] apontam o MESMO ramaddr
  (line_1); [4..9] apontam line_2; a diferença lida entre os dois
  ramaddys deve ser exatamente $20;
- aceitaction final: TODOS os campos selvagens dos blocos pinados
  (E19 blink, E20 PalCycle_SS completo, PalLoad/PalLoad_Fade, call
  site 700A/4EF9, expansão writeCRAM) devem coincidir com UMA única
  hipótese. Coincidência parcial ou nenhuma ⇒ veredito
  INCONCLUSIVO com série bruta (nenhum número vira alegação).

## Consequências E19–E22

E19/E20 mantêm estrutura, unicidade e byte-a-byte de dados; apenas os
5+10 campos `.w` viram leitura no sítio (com os invariantes acima).
E21 mantém-se: Pal_Index/Cheques de conteúdo de dados por SHA; a
expansão `writeCRAM` é montada em DUAS variantes por fonte (H_A e H_B)
e as ocorrências registradas para whichever coincidir.
E22 (teto de alegações) permanece integral: tudo estático; consumo
observado NON PROVADO; sem sprite por aproximação.
