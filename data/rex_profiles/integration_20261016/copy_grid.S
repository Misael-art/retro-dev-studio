/* Authored fixture. Synthetic caller, no game/renderer claim. */
.section .image,"a",@progbits
.long 0x00FFFF00
.long reset
.org 0x100,0
.ascii "SEGA GENESIS    "
.org 0x18E,0
.word 0xFFFF
.long 0,0x5FF,0xFF0000,0xFFFFFF
.org 0x1F0,0
.ascii "JUE             "
.org 0x200,0
reset:
move.w #0x2700,%sr
lea 0xFF0000,%a0
moveq #0,%d0
move.w #16383,%d7
clear:
move.l %d0,(%a0)+
dbra %d7,clear
lea 0xFF4000,%a0
moveq #11,%d1
move.w #8191,%d7
seed:
move.b %d1,(%a0)+
addi.b #37,%d1
dbra %d7,seed
jsr copy_entry
move.l #0x434F5059,0xFF3FE0
spin:
bra.s spin
.org 0x400,0
copy_entry:
lea 0xFF7000,%a2
lea 0xFF5000,%a3
moveq #3,%d1
column_init:
moveq #7,%d2
transfer:
move.b (%a3)+,(%a2)+
dbra %d2,transfer
lea 16(%a2),%a2
dbra %d1,column_init
copy_exit:
rts
.org 0x600,0
