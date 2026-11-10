| Pulo duplo (Sonic 1): chamado no lugar de "tst.b $3C(a0); beq.s <alvo>" em Sonic_JumpHeight (0x13498).
| $3C(a0): 0 = no chao, 1 = primeiro pulo ativo, 2 = pulo duplo ja usado (zera em Sonic_ResetOnFloor).
        .text
hook:
        tst.b   0x3C(%a0)
        beq.w   nao_pulando
        cmpi.b  #1,0x3C(%a0)
        bne.s   continua
        move.b  (0xFFFFF603).w,%d0
        andi.b  #0x70,%d0
        beq.s   continua
        move.w  #-0x680,%d0
        btst    #6,0x22(%a0)
        beq.s   sem_agua
        move.w  #-0x380,%d0
sem_agua:
        move.w  %d0,0x12(%a0)
        move.b  #2,0x3C(%a0)
        move.w  #0xA0,%d0
        jsr     0x139C
continua:
        rts
nao_pulando:
        addq.l  #4,%sp
        jmp     0x134C4
