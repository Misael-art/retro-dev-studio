/* Author-owned timing signal: one asymmetric sprite, IRQ6 -> SAT DMA.
 * No commercial code or data. Fresh MAME VRAM is initially zero.
 */
 .section .text
 .long 0x00fffe00, _start
 .org 0x78
 .long irq6
 .org 0x100
 .ascii "SEGA MEGA DRIVE "
 .org 0x1a0
 .long 0, 0x1fff, 0xff0000, 0xffffff
 .org 0x1f0
 .ascii "USA"
 .org 0x200
 .global _start
_start:
 move.w #0x2700,%sr
wait_latch:
 tst.b 0xff0000
 beq.s wait_latch
 lea 0xc00004,%a5
 lea 0xc00000,%a6
 move.w #0x8104,(%a5)
 move.w #0x8004,(%a5)
 move.w #0x8f02,(%a5)
 move.w #0x8230,(%a5)
 move.w #0x8407,(%a5)
 move.w #0x857c,(%a5)
 move.w #0x8700,(%a5)
 move.w #0x8b00,(%a5)
 move.w #0x8c81,(%a5)
 move.w #0x8d3f,(%a5)
 move.l #0xc0000000,(%a5)
 moveq #63,%d0
clear_palette:
 clr.w (%a6)
 dbra %d0,clear_palette
 move.l #0xc0020000,(%a5)
 move.w #0x000e,(%a6)
 move.w #0x00e0,(%a6)
 move.w #0x0e00,(%a6)
 move.w #0x0eee,(%a6)
 move.w #0x00ee,(%a6)
 move.w #0x0e0e,(%a6)
 move.w #0x0ee0,(%a6)
 move.l #0x40200000,(%a5)
 lea pattern,%a0
 move.w #255,%d0
write_tile:
 move.w (%a0)+,(%a6)
 dbra %d0,write_tile
 clr.w 0xff0400
 move.l #0x00c00f00,0xfff800
 move.l #0x80010080,0xfff804
 move.w #0x8174,(%a5)
 move.w #0x2000,%sr
idle:
 stop #0x2000
 bra.s idle
irq6:
 movem.l %d0-%d1,-(%sp)
 move.w (%a5),%d1
 addq.w #1,0xff0400
 move.w 0xff0400,%d0
 andi.w #31,%d0
 lsl.w #3,%d0
 addi.w #0x0080,%d0
 move.w %d0,0xfff806
 move.w #0x9304,(%a5)
 move.w #0x9400,(%a5)
 move.w #0x9500,(%a5)
 move.w #0x96fc,(%a5)
 move.w #0x977f,(%a5)
 move.l #0x78000083,(%a5)
 movem.l (%sp)+,%d0-%d1
 rte
pattern:
 .word 0x1234,0x5671
 .word 0x1111,0x1111,0x2222,0x2222,0x3333,0x3333
 .word 0x4444,0x4444,0x5555,0x5555,0x6666,0x6666,0x7777,0x7777
 .set tile,2
 .rept 15
 .rept 16
 .word (((tile-1)%7+1)*0x1111)
 .endr
 .set tile,tile+1
 .endr
 .org 0x1fff
 .byte 0
