/* fx06_data_opcodes — isca de varredura linear depois do fluxo (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx06_data_opcodes`: uma rotina que termina em
 * `rts`, seguida de padroes de dados que imitam instrucoes (`4EB9 abs.L`,
 * `67xx`, `0800`). Nenhum bloco deve cobrir os bytes de dados; `cobertura.vaoes`
 * deve incluir o span inteiro dos dados; uma consulta de sitio dentro dos dados
 * responde `dentro-regiao-nao-alcancado` quando a regiao cobre os dados.
 *
 * Os padroes sao `.word` literais: o montador nao os interpreta, e o objdump do
 * instrumento os imprime como instrucoes — que e exatamente a armadilha que o
 * veredito de sitio precisa desfazer.
 */
        .text
        .even
        .globl  fx06
fx06:   moveq   #0,%d0
        addq.l  #1,%d1
        tst.l   %d1
        beq.s   f6fim         /* desvia sobre os dados */
        moveq   #1,%d2
f6fim:  rts                   /* ultimo byte alcancado por este fluxo */
        .even
/* 18 bytes de dados que uma varredura linear leria como codigo:
 * jsr abs.L, beq.s +8, btst imediato, move.l com deslocamento imediato. */
        .word   0x4EB9, 0x1234, 0x5678
        .word   0x6708, 0x0800, 0x0003
        .word   0x227C, 0x0000, 0x1111
