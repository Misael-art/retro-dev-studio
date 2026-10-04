/* fx02_extended — formas de extensao de desvio (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx02_extended`: (a) desvio cujo byte baixo do
 * opcode e 00 — a extensao word seguinte e o displacamento, tomado em
 * instr+2; (b) opcode com disp8 = 0xFF, forma 68020, que deve virar
 * ponto-de-fronteira sem continuar por comprimento inventado.
 *
 * Os dois bytes de (b) foram escritos com `.byte` porque o montador do alvo
 * 68000 nunca emite essa forma por si: `bcc/fim` produziria o displacamento
 * correto, nao o prefixo ambiguo. O instrumento (objdump 2.41, alvo generico)
 * le `67ff` como `beqs -1`; o CONTRACT §0.3/§3 manda recusar. O desvio e
 * registrado e impresso pelo teste de paridade, nao escondido.
 */
        .text
        .even
        .globl  fx02
fx02:   moveq   #0,%d0
        bcc.s   f2            /* forma curta, displacement != 0 */
        nop                   /* queda do desvio curto */
/* (a) disp8 = 0: o word seguinte e o displacement, base = endereco do word. */
        .byte   0x63, 0x00
        .word   f2 - .
        rts                   /* caido pela beq.s de cima; nunca alcancado */
        .even
f2:     moveq   #1,%d1
/* (b) disp8 = 0xFF: ambiguo 68000 (-1) / 68020 (prefixo de extensao .W). */
        .byte   0x67, 0xFF
        nop
        rts
