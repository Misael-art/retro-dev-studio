/* fx11assimetrica — dois fluxos de tamanho deliberadamente desigual, com
 * DENOMINADORES PROPRIOS por raiz (EXPECTATIONS-ETAPA2.md §3, casos A1..A4).
 *
 * FIXTURE AUTORAL. A assimetria existe para tornar visível a fraude do
 * agregado: uma fração global das duas raízes esconderia que a raiz A para na
 * primeira instrução e que a raiz B tem três chamadas de status diferentes.
 * O export `rex-cfg-med/v1` por isso NUNCA soma entre raízes (A4).
 *
 *   raiz_a  — 1 instrução provada e uma `bkpt` (família recusada, mesmo caso
 *             pinado em calib2 0xf4): o caminho para; sem chamada, sem laço.
 *   raiz_b  — bsr.w a sub-rotina com rts; jsr (xxx).L com alvo FORA da regiao;
 *             beq.w cujo desvio cruza a fronteira da regiao; um laco dbra; e
 *             uma sub-rotina que termina em `jmp (An)` (indireto opaco).
 */
        .text
        .even
        .globl  fx11
fx11:
/* ---- raiz A: curta, para num opcode fora do subconjunto ---- */
raiz_a: moveq   #0,%d3
        bkpt    #3                    /* 484b — fora do subconjunto (§6) */
        nop
        rts

/* ---- raiz B: longa, com as quatro familias de saida ---- */
        .even
raiz_b: moveq   #0,%d7
        bsr.w   sub_b                 /* chamada resolvida dentro da regiao */
        jsr     longe_b:l             /* chamada com alvo fora da regiao */
        beq.w   longe_b               /* desvio que cruza a fronteira da regiao */
        addq.l  #1,%d1
        dbra    %d5,raiz_b            /* laco: taken (resolvido) + queda */
        nop
        rts                           /* terminador: sem aresta de volta */

        .even
sub_b:  movem.l %d2-%d5,%sp@-         /* suportado apenas por comprimento */
        jmp     (%a2)                 /* alvo desconhecido: fronteira indireta */

/* Alvo das transferencias que o teste declara FORA da regiao: os 0x100 bytes
 * de `.space` ficam entre o fim declarado e `longe_b`. */
        .space  0x100
        .even
longe_b:
        moveq   #1,%d0
        rts
