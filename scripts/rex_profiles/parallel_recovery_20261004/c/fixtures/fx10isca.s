/* fx10isca — ISCAS que imitam chamadas dentro de dados, no miolo de outra
 * instrução e num vão não alcançado (EXPECTATIONS-ETAPA2.md §2, casos B1..B6).
 *
 * FIXTURE AUTORAL: as aparências são produzidas por `.short` (o montador não
 * emite iscas) e o fluxo real é código legítimo. O objetivo é discriminar
 * INSTRUCÃO / DADO / INTERIOR: um escaneador linear que leia "decode limpo"
 * estes bytes os promoveria a consumidor; a barreira não promove.
 *
 *   ilha_de_dados   — aparências logo após um `rts` (caso 1 / B1..B3)
 *   miolo           — aparências DENTRO de bytes de instruções provadas
 *                     (caso 2 / B3), espelhando a ROM medida em 0x31DCC, onde
 *                     o instrumento lê `subb %a4@(20220),%d2` e a word 0x4efc
 *                     é o desvio, não um opcode
 *   ilha_no_vao     — as mesmas aparências num vão NO MEIO do fluxo, pulado por
 *                     um `bra.w` (caso 3): a região cobre, o fluxo não chega
 */
        .text
        .even
        .globl  fx10
fx10:
cabeca: moveq   #0,%d1          /* raiz declarada pelos testes */
        bsr.w   comisco
        bra.w   depoisdovao     /* salta por cima da ilha do vao */
        .even
ilha_no_vao:
        .short  0x4ef9, 0x0001, 0x1234   /* jmp (xxx).L aparente   */
        .short  0x4eb9, 0x0001, 0x1236   /* jsr (xxx).L aparente   */
        .short  0x4efa, 0x1234           /* jmp d16(PC); A lería jsr abs.w */
        .short  0x0a7c, 0xfc00           /* eori;   A lería movea.l #imm32 */
        .short  0x41f9, 0x0000, 0xabcd   /* lea (xxx).L aparente   */
        .even
depoisdovao:
        addq.l  #1,%d2
        rts

/* Rotina real com iscas no MILOO de instruções comprovadas. Os deslocamentos
 * são escolhidos para que a word de dados valha o opcode de uma aparência:
 *   0x4efc = 20220  -> segundo word de `subb 0x4efc(%a4),%d2`
 *   0x4eb9 = 0x12344eb9 -> terceiro word de `move.l #0x12344eb9,%d1`        */
        .even
comisco:
        subb    0x4efc(%a4),%d2
        move.l  #0x12344eb9,%d1
        rts

/* Ilha de dados depois do `rts` da cabeça: nada aqui e alcançado a partir de
 * `cabeca`; o `rts` termina o caminho (CONTRACT §4.3). */
        .even
ilha_de_dados:
        .short  0x4ef9, 0x0001, 0x1234
        .short  0x4eb9, 0x0001, 0x1236
        .short  0x4efa, 0x1234
        .short  0x0a7c, 0xfc00
        .short  0x41f9, 0x0000, 0xabcd
