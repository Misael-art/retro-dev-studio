#!/usr/bin/env python3
"""Independent descriptor/index model. Geometry and frame selectors are explicit inputs.

No framebuffer is read by reconstruction or projection. This is not a prediction
of gameplay trajectory, all scanlines, planes, or nonresource graphics.
"""
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('sprite_geometry',HERE/'verify-presented-sprites.py')
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
spec = importlib.util.spec_from_file_location('gx_color',HERE.parent/'integration_20261016/visual_copy/color_v2.py')
color = importlib.util.module_from_spec(spec)
spec.loader.exec_module(color)

def word(data, at):
    return int.from_bytes(data[at:at+2],'big')

def signed(value):
    return value-65536 if value & 32768 else value

def byte_signed(value):
    return value-256 if value & 128 else value

def reconstruct(rom, layout, controls, immutable_lookup, start_index=1):
    assert len(layout)==16384 and len(controls)==65536 and len(immutable_lookup)==79
    assert start_index==1, 'earlier player sprite count outside qualified episode'
    camx,camy=word(controls,0xf700),word(controls,0xf704)
    first=camy//24*128+camx//24
    result=[]
    for row in range(16):
        for col in range(16):
            address=first+row*128+col
            assert 0<=address<len(layout),'layout reader outside frozen domain'
            identifier=layout[address]
            if not 1<=identifier<=78:continue
            coord=0x8000+4*(row*16+col)
            x=(word(controls,coord)+288)&65535
            y=(word(controls,coord+2)+240)&65535
            if not(112<=x<464 and 112<=y<368):continue
            lookup=0x4000+identifier*8
            pointer=int.from_bytes(controls[lookup:lookup+4],'big')
            frame=word(controls,lookup+4)
            base=word(controls,lookup+6)
            assert [pointer,base]==immutable_lookup[identifier],'immutable mapping pointer/base'
            assert 0<=pointer<len(rom)-2 and frame<256,'mapping input domain'
            offset=pointer+frame*2
            assert offset+2<=len(rom),'mapping table outside ROM'
            header=pointer+signed(word(rom,offset))
            assert 0<=header<len(rom),'mapping header outside ROM'
            count=rom[header]
            if count==0 or count>128:continue
            for n in range(count):
                if start_index+len(result)==80:
                    result[-1]['words'][1]&=0xff00
                    return result
                at=header+1+n*5
                assert at+5<=len(rom),'descriptor outside ROM'
                dy,size=byte_signed(rom[at]),rom[at+1]
                attr=(word(rom,at+2)+base)&65535
                dx=byte_signed(rom[at+4])
                sx=(x+dx)&511
                if sx==0:sx=1
                index=start_index+len(result)
                result.append({'index':index,'layout_address':0xff0000+address,
                    'layout_id':identifier,'mapping':at,'frame_input':frame,
                    'words':[(y+dy)&65535,(size<<8)|(index+1),attr,sx]})
    if result and result[-1]['index']==79:result[-1]['words'][1]&=0xff00
    return result

def sat_bytes(predicted, first_sprite):
    assert len(first_sprite)==8
    sat=bytearray(640);sat[:8]=first_sprite
    for p in predicted:
        at=p['index']*8
        sat[at:at+8]=b''.join(w.to_bytes(2,'big') for w in p['words'])
    if predicted and predicted[-1]['index']==79:sat[79*8+3]=0
    return bytes(sat)

def project(sat, art, palette):
    assert len(sat)==640 and len(art)==249*32 and len(palette)==128
    vram=bytearray(65536);vram[0xf800:0xfa80]=sat
    vram[0x142*32:(0x142+249)*32]=art
    old=geometry.rgb
    geometry.rgb=lambda w:color.convert_cram(w)[1][:3]
    try:
        pixels,indices=geometry.project(vram,palette,[0,0,0,0,0,0x7c,0,0,0,0,0,0,0x81],320,224)
    finally:
        geometry.rgb=old
    # Nonresource content is unknown. Its complete bounding rectangle masks
    # output before looking at an image, regardless of color or transparency.
    mask=set();index=0
    for _ in range(80):
        at=index*8;y,desc,attr,x=[word(sat,at+i) for i in (0,2,4,6)]
        x,y=(x&511)-128,(y&511)-128;w,h=(desc>>10&3)+1,(desc>>8&3)+1
        if not(0x142<=attr&2047 and (attr&2047)+w*h<=0x142+249):
            mask.update(pos for pos in pixels if x<=pos[0]<x+w*8 and y<=pos[1]<y+h*8)
        index=desc&127
        if not index:break
    else:raise AssertionError('sprite chain budget')
    return {pos:rgb for pos,rgb in pixels.items() if pos not in mask},indices,len(mask)
