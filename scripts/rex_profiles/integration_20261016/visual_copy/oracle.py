#!/usr/bin/env python3
"""External QA: independent byte-index copy and declarative pixel composition.
No SGDK calls, emulator data or production renderer. Run before fixture build.
"""
import hashlib, json, struct, sys, zlib
from pathlib import Path

def digest(b): return hashlib.sha256(b).hexdigest()
def destination(a, width, gap=16):
    out=bytearray(128)
    for row in range(4):
        for i in range(8*width): out[row*(8*width+gap)+i]=a['source'][row*8*width+i]
    return out

def scope(a, dest):
    words=b''.join(struct.pack('>H',16+(v&7)+((v>>3)<<13)) for v in dest[:112])
    return bytes([0xa5]*16+a['source']+[0x5a]*16)+bytes(dest)+bytes([0xc3]*16)+words+bytes([0x3c]*16)+b'VISU'

def pixels(a, dest, palette_swap=False, opaque=False):
    out=bytearray()
    for y in range(224):
        for x in range(320):
            rgb=[255]*3 if (x//8+y//8)%2 else [0]*3
            if 40<=x<168 and 40<=y<96:
                xx, yy=x-40,y-40
                v=dest[(yy//8)*16+xx//8]
                color=a['tiles'][v&7][yy%8][xx%8]
                if color or opaque: rgb=a['palettes'][(v>>3)^int(palette_swap)][color]
            out.extend(rgb+[255])
    return bytes(out)

def png(raw):
    def chunk(t,b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b))
    scan=b''.join(b'\0'+raw[y*1280:(y+1)*1280] for y in range(224))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,224,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan))+chunk(b'IEND',b'')

def compare_pixels(actual,expected):
    return len(actual)==len(expected)==320*224*4 and all(abs(v-w)<= (0 if i%4==3 else 7) for i,(v,w) in enumerate(zip(actual,expected)))

def main():
    a=json.loads(Path(sys.argv[1]).read_text()); out=Path(sys.argv[2]); out.mkdir(exist_ok=False,parents=True)
    ds=[destination(a,w) for w in (1,2)]; ims=[pixels(a,d) for d in ds]
    report={'schema':'rex-visual-oracle/v1','source_sha256':digest(bytes(a['source'])),'files':{},'memory_diff_offsets':[i for i,(x,y) in enumerate(zip(scope(a,ds[0]),scope(a,ds[1]))) if x!=y], 'pixel_diff_indices':[i//4 for i in range(0,len(ims[0]),4) if ims[0][i:i+4]!=ims[1][i:i+4]],'negatives':{}}
    for w,d,im in zip((1,2),ds,ims):
        for name,b in [(f'width{w}.scope.bin',scope(a,d)),(f'width{w}.rgba',im),(f'width{w}.png',png(im))]:
            (out/name).write_bytes(b); report['files'][name]=digest(b)
    wrong=bytearray(scope(a,ds[0]));wrong[0]^=1
    wrongpixel=bytearray(ims[0]);wrongpixel[0]=255
    transpose=bytes(ds[0][(i%7)*16+i//7] for i in range(112))+bytes(16)
    reverse=b''.join(ds[0][r*16:(r+1)*16] for r in range(6,-1,-1))+bytes(16)
    candidates={'other_width':ims[1],'wrong_stride':pixels(a,destination(a,1,8)),'transpose':pixels(a,transpose),'reverse_rows':pixels(a,reverse),'palette_swap':pixels(a,ds[0],True),'lost_transparency':pixels(a,ds[0],False,True),'mutated_pixel':wrongpixel}
    report['negatives']={k:not compare_pixels(b,ims[0]) for k,b in candidates.items()}
    report['negatives']['guard_mutation']=wrong!=scope(a,ds[0]); report['negatives']['other_width_buffer']=scope(a,ds[0])!=scope(a,ds[1])
    assert all(report['negatives'].values()) and len(scope(a,ds[0]))==484
    (out/'oracle.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'memory_changed':len(report['memory_diff_offsets']),'pixels_changed':len(report['pixel_diff_indices']),'negative_pass':len(report['negatives']),'files':report['files']}))
if __name__=='__main__': main()
