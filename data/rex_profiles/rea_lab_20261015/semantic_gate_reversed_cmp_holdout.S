/* Separately authored post-freeze transfer implementation.
 * The analyzer receives only the linked image and declared region offsets.
 */
    .section .image,"a",@progbits
    .globl _image_start
    .globl gate_holdout_entry
    .globl gate_holdout_exit
    .globl semantic_harness
    .globl rds_vertical_background_tiles
    .globl rds_vertical_player_frames
    .globl rds_vertical_background_map
    .globl rds_vertical_palette
    .globl rds_vertical_game_rules
    .globl rds_vertical_sound_event

_image_start:
    .long 0x00FFFFFC
    .long semantic_harness
    .org 0x100, 0
    .ascii "SEGA GENESIS    "
    .org 0x110, 0
    .ascii "RESEARCH SEMANTIC GATE"
    .org 0x140, 0
    .ascii "RESEARCH SEMANTIC GATE"
    .org 0x170, 0
    .ascii "GM 00000000-00"
    .org 0x17E, 0
    .word 0
    .org 0x180, 0
    .ascii "J               "
    .org 0x190, 0
    .long 0x00000000
    .long 0x00000A19
    .long 0x00FF0000
    .long 0x00FFFFFF
    .org 0x1F0, 0
    .ascii "JUE             "

    .org 0x240, 0
gate_holdout_entry:
    move.l  0x00ff0200,%d3
    moveq   #5,%d5
    cmp.l   %d3,%d5
    ble.s   holdout_set
    moveq   #0,%d6
    move.l  %d6,0x00ff0204
    bra.s   gate_holdout_exit
holdout_set:
    moveq   #1,%d6
    move.l  %d6,0x00ff0204
gate_holdout_exit:
    rts

    .org 0x300, 0
semantic_harness:
    move.l  #0x00fffffc,%sp
    move.l  #0x80000000,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0300
    move.l  #0xffffffff,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0304
    move.l  #0x00000000,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0308
    move.l  #0x00000004,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff030c
    move.l  #0x00000005,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0310
    move.l  #0x00000006,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0314
    move.l  #0x7fffffff,0x00ff0200
    jsr     gate_holdout_entry
    move.l  0x00ff0204,%d2
    move.l  %d2,0x00ff0318
holdout_harness_halt:
    bra.s   holdout_harness_halt

    .org 0x400, 0
rds_vertical_background_tiles:
    .fill 128, 1, 0
    .size rds_vertical_background_tiles, .-rds_vertical_background_tiles
rds_vertical_player_frames:
    .fill 256, 1, 0
    .size rds_vertical_player_frames, .-rds_vertical_player_frames
rds_vertical_background_map:
    .fill 1120, 1, 0
    .size rds_vertical_background_map, .-rds_vertical_background_map
rds_vertical_palette:
    .word 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
    .size rds_vertical_palette, .-rds_vertical_palette
rds_vertical_game_rules:
    .word 32,0,320,2,320,96,8,38,12
    .size rds_vertical_game_rules, .-rds_vertical_game_rules
rds_vertical_sound_event:
    .word 0,428,12,8
    .size rds_vertical_sound_event, .-rds_vertical_sound_event

    .org 0xA20, 0
    .byte 0
