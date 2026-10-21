    .text
    .align 2
    .globl visual_copy, visual_copy_entry, visual_copy_end
visual_copy:
    movem.l %d2/%a2-%a3,-(%sp)
visual_copy_entry:
    lea (visual_scope+96-0xe0000000).l,%a2
    lea (visual_scope+16-0xe0000000).l,%a3
    moveq #3,%d1
.Lrow:
    moveq #7,%d2
.Lcol:
    move.b (%a3)+,(%a2)+
    dbra %d2,.Lcol
    lea 16(%a2),%a2
    dbra %d1,.Lrow
visual_copy_end:
    movem.l (%sp)+,%d2/%a2-%a3
    rts
