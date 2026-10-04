/* fx03_dbcc — lacos DBcc com duas arestas cada (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx03_dbcc` pede "laço dbra Dn,-neg", "dbcc.s
 * com extensão" e "um dbra.w". A MEDICAO com o instrumento independente
 * (fixtures/calib*.s -> m68k-elf-objdump) mostra que existe uma unica forma
 * DBcc no 68000: sempre 4 bytes, opcode + word de displacamento assinado, com
 * o campo de modo %001. Nao ha versao ".s" de 2 bytes nem ".w" separada. O
 * arquivo abaixo portanto monta a forma medida tres vezes (um DBra negativo,
 * um DBf e um DBcc de condicao distinta) e o desvio de redacao da expectativa
 * vai para o Adendo datado — a expectativa nao foi reescrita.
 *
 * Para cada DBcc o grafo deve ter duas arestas: taken -> instr+2+disp e
 * queda -> instr+4.
 */
        .text
        .even
        .globl  fx03
fx03:   moveq   #7,%d7
        moveq   #3,%d6
f0:     addq.l  #1,%d1
        dbra    %d7,f0        /* laco curto, displacement negativo */
        moveq   #0,%d5
f1:     addq.l  #1,%d2
        nop
        dbf     %d6,f1        /* laco mais longo, tambem negativo */
        dbge    %d5,f1        /* outra condicao, mesmo formato medido */
        rts
