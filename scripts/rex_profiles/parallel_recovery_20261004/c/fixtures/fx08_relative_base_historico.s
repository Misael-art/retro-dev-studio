/* fx08_relative_base_historico — discriminante da formula historica (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx08_relative_base_historico`: sequencia
 * minima com `bcc.w` e `dbra.w` de sinal negativo, em enderecos pares, tal que
 * as duas formulas (base = instr+2 vs base = fim da instrucao) divergem em 2.
 *
 * O teste compara o alvo da ferramenta com o alvo absoluto impresso pelo
 * instrumento, e registra explicitamente o valor que a formula ERRADA daria como
 * NAO produzido. Os displacamentos abaixo sao todos de sinal oposto ao caminho
 * de crescimento do endereco, de modo que nenhum alvo saia da regiao.
 */
        .text
        .even
        .globl  fx08
fx08:   moveq   #0,%d0
f0:     addq.l  #1,%d1
        bcc.w   f2            /* .W adiante: base+2+d != base+4+d */
        nop
        moveq   #6,%d6
f1:     addq.l  #1,%d2
        dbra    %d6,f1        /* .W atras: base+2+d != base+4+d */
        dbf     %d7,f0        /* outro atras, displacement maior */
        rts
f2:     moveq   #3,%d3
        rts
