#!/usr/bin/env python3
"""External QA: encoded Mode5 CRAM -> pinned GPGX RGB565 -> application RGBA8.
Not a generic hardware DAC and never reads an emulator framebuffer.
"""
def convert_cram(word):
    if not isinstance(word,int) or word < 0 or word & ~0x0eee:
        raise ValueError("only encoded Mode5 CRAM 0BBB0GGG0RRR0 words accepted")
    # palette_init normal table: 3-bit component -> even 4-bit intensity.
    r,g,b=[2*((word>>shift)&7) for shift in (1,5,9)]
    # USE_16BPP_RENDERING branch of MAKE_PIXEL, expressed per channel.
    r5,b5=2*r+r//8,2*b+b//8
    g6=4*g+g//4
    packed=(r5<<11)|(g6<<5)|b5
    # Existing app frame_buffer.rs expands by replication of high bits.
    return packed, ((r5<<3)|(r5>>2),(g6<<2)|(g6>>4),(b5<<3)|(b5>>2),255)
