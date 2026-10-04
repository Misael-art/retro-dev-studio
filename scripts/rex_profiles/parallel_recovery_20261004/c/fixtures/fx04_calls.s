/* fx04_calls — chamada com alvo comprovado e retorno sem hipotese (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx04_calls`: `bsr.w` -> subrotina com `rts`,
 * `jsr.abs.L` -> rotina, `jsr.abs.W`. O grafo deve registrar aresta `chamada`
 * com alvo resolvido, analisar a continuacao pos-chamada como fluxo normal da
 * chamadora, criar raiz derivada `dentro-de-fluxo` para o alvo dentro da
 * regiao e terminar o caminho no `rts` sem aresta de volta inventada.
 *
 * Os sufixos `:w`/`:l` sao obrigatorios porque o montador escolhe a forma
 * relativo-ao-PC sozinho: medido hoje (`rds-scratch/j.s`), `jsr alvo` sem sufixo
 * vira `4eba 0004` = `jsr %pc@(10 <alvo>)`, forma que a lista fechada de
 * CONTRACT §3 NAO autoriza para JMP/JSR. Os dois absolutos ficam entao
 * `4eb8` (.W) e `4eb9` (.L), ambos comprovados no corpus de calibracao.
 */
        .text
        .even
        .globl  fx04
fx04:   moveq   #0,%d0
        bsr.w   sub1          /* chamada: alvo dentro da regiao */
        addq.l  #1,%d1        /* continuacao pos-chamada: fluxo da chamadora */
        jsr     sub2w:w       /* jsr absoluto .W (medido 4eb8) */
        moveq   #9,%d4
        jsr     sub2:l        /* jsr absoluto .L (medido 4eb9) */
        rts
        .even
sub1:   link    %a6,#-8
        moveq   #1,%d3
        unlk    %a6
        rts                   /* terminador: sem aresta de volta */
        .even
sub2w:  nop
        rts
        .even
sub2:   moveq   #2,%d5
        rts
