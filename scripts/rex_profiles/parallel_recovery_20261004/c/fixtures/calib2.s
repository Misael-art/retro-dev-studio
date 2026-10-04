/* calib2.s — segundo corpus autoral de calibracao (frente C, rex-cfg/v1).
 * Montado com m68k-elf-as (binutils 2.41) e lido por m68k-elf-objdump, que e o
 * instrumento independente de comprimento/alvo. Nao e codigo de produto.
 * Cada linha existe porque `src/decode.rs` afirma uma mascara para ela.
 * Alvos absolutos usam constantes numericas: referencias a rotulo gerariam
 * relocacao nao aplicada pelo objdump, e o comprimento impresso deixaria de
 * ser prova independente. */
.text
/* ---- MOVE: modos de memoria reais ---- */
	movel %d0,%a1@(16)
	movel %a1@(16),%d0
	movel %d2,%a3@(8,%d1)
	movew %a4@(12,%a0:l),%d5
	movel %a0@+,%a1@
	movel %a2@-,%d3
	moveb %d1,%a7@-
	movew %a7@,%d0
/* ---- MOVEA / imediato ---- */
	moveal %a0@+,%a3
	moveaw %d1,%a6
	moveq #127,%d3
	moveq #-128,%d7
	movel #0x12345678,%a2
/* ---- grupo %0000: op1 imediato, Q e recusos ---- */
	oriw #0x00ff,%d1
	andl #0xffffffff,%d2
	addqw #4,%a1@(16)
	subqb #8,%a2@
	extw %d1
	extl %d1
/* ---- bitops #imm,ea ---- */
	btst #4,%d3
	bchg #6,%a2@
	bclr #1,%a1@(16)
	bset #0,0x1234
	bset #7,0x12345678
/* ---- bitops r,ea ---- */
	btst %d1,%a2@
	bchg %d2,%a1@+
	bclr %d3,%d4
	bset %d5,%a3@(8)
/* ---- shifts / rotacoes (somente Dn tem prova de comprimento) ---- */
	aslb #2,%d1
	asrb #8,%d2
	lslb #1,%d3
	lsrb #7,%d4
	aslw %d1,%d5
	asrw %d2,%d6
	lslw %d3,%d7
	lsrw %d4,%d0
	asrl %d5,%d1
	lsl.l #3,%d2
	roxl.w #1,%d3
	roxr.w #2,%d4
	roxl.l #3,%d5
	roxr.l #4,%d6
/* ---- unarios ---- */
	clrb %d0
	clrw %a1@
	negb %d1
	notl %d2
	tstb %a3@+
	tstw %d3
/* ---- LEA / PEA / CHK ---- */
	lea.l %a0@,%a1
	pea %a1@
	peal 0x12345678
	chkl %a0@,%d1
	chkw %d2,%d3
/* ---- MOVEM: leitura/escrita x .W/.L ---- */
	movemw %d0-%d1,%a1@
	moveml %d4-%d7,%a2@(16)
	movemw %a1@+,%d0-%d3
	moveml %a2@,%a0-%a3
/* ---- Scc / PEA abs.W ---- */
	sne %d1
	slt %a1@
	sf %d2
	pea 0x1234
/* ---- JSR/JMP absolutos ---- */
	jsr 0x1234
	jmpl 0x12345678
/* ---- fluxo de controle ---- */
lblback:
	nop
	trap #1
	link %a6,#-16
	unlk %a6
	bra lbl3
lblmid:
	bsr lbl2
lblfar:
	beq lbl3
	bne lblback
	bgt lbl2
	ble lbl3
	dbra %d5,lblmid
	dbne %d2,lblback
	dbhi %d3,lbl3
/* ---- indiretos: fronteira opaca, nenhum alvo inventado ---- */
	jmp %a1@
	rts
/* ---- recusas comprovadas pelo instrumento ---- */
lblv:
	.short 0x4e76
	.short 0x4afc
	.short 0xf000
	bkpt #7
	movepl %d3,%a1@(16)
lbl2:
	nop
lbl3:
	nop
/* ---- modos de indice com campos que o 68000 nao tem ----
   Adendo datado 2026-10-04: a paridade de OPERANDOS (nao apenas comprimento e
   alvo) expôs o formato real da word de extensao dos modos %110 (d8,An,Xn) e
   %111.011 (d8,PC,Xn), medido com o instrumento (sonda em
   ~/rds-scratch/probe-191c, o mesmo binutils 2.41):
     bit15     tipo do indice (0=Dn, 1=An)
     bits14-12 registrador indice
     bit11     tamanho do indice (0=W, 1=L)
     bits10-8  ESCALA e displacamento de 16 bits -- campos que o 68000 nao tem
     bits7-0   displacamento de 8 bits
   Medidos com o instrumento (Adendo 2026-10-04, registros deste arquivo):
     `1031 2000` -> `moveb %a1@(0,%d2:w),%d0`  = 4 bytes, indice D2 (a forma
                      exata do ROM em 0x191c, que a ferramenta imprimia D0/w)
     `3031 b87f` -> `movew %a1@(7f,%a3:l),%d0` = 4 bytes, indice A3 longo
     `1031 0108` -> `moveb %a1@(0,%d0:w),%d0`  = 4 bytes (campo 10-8 = %001)
     `1031 0208` -> `moveb %a1@(8,%d0:w:2),%d0`= 4 bytes (escala 2, 68020)
     `d0bb 1008` -> `addl %pc@(110,%d1:w),%d0` = 4 bytes (indice PC limpo)
     `d0bb 0208` -> `addl %pc@(11e,%d0:w:2),%d0`= 4 bytes (escala 68020)
     `d0b9 0208` -> `addl 2084e71,%d0`          = 6 bytes: aqui %111.001 e
                      abs.L, nao indice -- o word `4e71` seguinte faz parte do
                      imediato e o instrumento o engole; a ferramenta concorda.
   Nos tres casos com bits 10-8 nao nulos a ferramenta deve PARAR: o
   comprimento lido pelo instrumento depende de um campo que o 68000 nao tem,
   entao reproduzi-lo seria inventa-lo (CONTRACT §3). Os registros `.word` vao
   por isso no FIM do arquivo, depois do `rts`. */
lblidx:
	moveb	%a1@(0,%d2:w),%d0
	movew	%a1@(127,%a3:l),%d0
	addl	%pc@(8,%d1:w),%d0
	rts
	.word	0x1031, 0x0108
	.word	0x1031, 0x0208
	.word	0xd0bb, 0x0208
	.word	0xd0b9, 0x0208
	.word	0x4e71, 0x4e71
