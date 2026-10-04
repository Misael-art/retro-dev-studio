.text
/* ---- MOVE .B/.W/.L ---- */
	moveb %a0@+,%d1
	moveb %a2@-,%d3
	moveb %a4@,%d5
	moveb %a1@(16),%d2
	moveb %d1,%a0@+
	moveb %d3,%a2@-
	moveb %d5,%a4@
	moveb %d2,%a1@(16)
	moveb 0x12345678,%d0
	moveb 0x1234,%d0
	moveb #0x2a,%d0
	moveb #0x2a,0x12345678
	movew %a3@,%d6
	movew %d6,0x1234
	movew %d6,0x12345678
	movew %d6,%a2@(16)
	movew %d6,%a3@-
	movel 0x12345678,%d4
	movel 0x1234,%d4
	movel #0x12345678,%d4
	movel #0x12345678,0x1234
	movew %a2@,%a3@
	moveb %a0@+,%sp@(1)
	moveb %a0@+,%sp@
/* ---- MOVEA ---- */
	moveaw %a0@,%a1
	moveal %a3@,%a5
/* ---- PC desviados (subconjunto recusa) ---- */
	lea.l %pc@(64),%a5
	move.l %pc@(16),%d0
/* ---- MOVEQ / SR-CCR / Q-ops ---- */
	moveq #15,%d4
	movew %sr,%d6
	movew %d6,%ccr
	addqb #4,%a3@
	addqw #1,%d3
	addql #8,0x12345678
	subqb #2,%sp
	subqw #3,%d2
/* ---- ALU geral ---- */
	addw %a0@,%d1
	addl %d2,%a1@
	subw %d5,0x1234
	cmpw %a2@,%d0
	cmpl %d1,%d2
	andw %a0@,%d1
	orw %a0@+,%d3
	eorw %d4,%d2
	eorw %d6,%a2@(16)
/* ---- op1 imediatos ---- */
	subiw #0x1234,%d0
	cmpib #1,%d1
	cmpiw #0x5678,%a4@(16)
	orib #0xff,%d2
	eoril #0x12345678,%d3
	andiw #7,%d1
/* ---- Bitops ---- */
	btst #3,%d4
	bclr #2,%a1@
	bset %d0,%d1
/* ---- Shifts ---- */
	lsrw #1,%d5
	lslw #5,%d2
	asrl #2,%d6
	move.l %pc@(16),%d1
	roxlw #1,%d3
/* ---- Unarios ---- */
	tstw 0xa1000c
	tstl 0xa10008
	negw %d6
	clrl %d4
	notb %a4@
/* ---- LEA/PEA/CHK ---- */
	leal 0x72e7c,%a0
	leal %a1@(16),%a2
	peal 0xabcdef01
	chkw %d4,%d0
/* ---- Fluxo ---- */
lblback:	nop
	brs lbl1
	braw lbl2
	bsrw sub1
	bccs lbl1
	bccw lbl2
	bnew negw0
	jmpl 0x12345678
	jmp 0x1234
	jsrl 0x12345678
	jsr 0x1234
	jmp %a2@
	jsr %a3@(16)
	rts
	nop
	trap #4
	link %a6,#-8
	unlk %a6
	dbf %d4,lbl1
	dbra %d3,lblback
	dbge %d2,lbl1
	seq %d1
	sne %a4@
	movemw %a5@+,%d5-%d7
	moveml %a5@+,%a0-%a4
	moveml %d0-%d3,%a6@
/* ---- MULU/DIV ---- */
	muluw #3,%d1
	divuw %a0@(16),%d2
/* ---- MOVEP / 68020 (recusas) ---- */
	movepw %a0@(16),%d2
	.short 0x67ff
	.short 0x51ff
	.short 0x4e76
	.short 0xf000
	.short 0x4afc
lbl1:	nop
lbl2:	nop
negw0:	nop
sub1:	rts

braww:	braw lblback
