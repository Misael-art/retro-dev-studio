/* fx01_branches — corpus autoral para os desvios do CFG (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx01_branches`: beq.s adiante, beq.w adiante,
 * desvio negativo, bra.w para tras (laco), bne.w com displacamento em endereco
 * par tal que base+2+disp != base+fim+disp, e dbra. Todo alvo sai resolvido no
 * link e e conferido no objdump do instrumento independente (m68k-elf-objdump
 * 2.41); nenhum endereco deste arquivo foi escrito "de cabeca".
 *
 * Deslocamentos negativos longos: o montador promo ve o word de extensao quando
 * o disp8 nao alcan ca (medido: `51ce ffde` em 0x22), entao a forma curta .S nao
 * e obrigatoria em nenhum caso.
 */
        .text
        .even
        .globl  fx01
fx01:   moveq   #0,%d0
f0:     moveq   #1,%d1        /* alvo do laco backwards */
        beq.s   f1            /* desvio curto adiante */
        moveq   #2,%d2        /* queda */
f1:     moveq   #3,%d3
        beq.w   f3            /* desvio .W adiante */
        moveq   #7,%d7        /* queda */
f2:     moveq   #4,%d4
        bra.w   f0            /* laco para tras */
f3:     moveq   #5,%d5
        bne.w   f5            /* DISCRIMINANTE: alvo = aqui+2+0x04 */
        moveq   #6,%d6        /* queda */
f5:     dbra    %d7,f3        /* laco dbra, displacamento negativo */
        dbf     %d6,f2        /* outro laco atras (promovido a word pelo as) */
        rts
