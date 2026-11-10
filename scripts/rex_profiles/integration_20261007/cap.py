import sys, struct, zlib, hashlib
sys.path.insert(0,'.')
from lr import Core
import glob
CORE=glob.glob(sys.argv[1])[0]
c=Core(CORE,"./sonic_local.bin")
def rgb(fr):
    d,w,h,p=fr; out=[]
    for y in range(h):
        row=[]
        for x in range(w):
            v=struct.unpack_from('<H',d,y*p+x*2)[0]
            r=(v>>11)&31; g=(v>>5)&63; b=v&31
            row.append(((r*255+15)//31,(g*255+31)//63,(b*255+15)//31))
        out.append(row)
    return out
def png(rows,path):
    H=len(rows);W=len(rows[0])
    raw=b''.join(b'\0'+b''.join(bytes(p) for p in r) for r in rows)
    def ch(t,d): x=struct.pack('>I',len(d))+t+d; return x+struct.pack('>I',zlib.crc32(t+d))
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',W,H,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
c.run(500)
c.buttons=1<<3; c.run(10); c.buttons=0
for i in range(600):
    c.run(1)
    if i%100==0: print(i,"gm",c.peek(0xF600,1).hex())
import numpy as np, hashlib
c.poke(0xF600,b'\x10')
frs=[];pals=[];idx=[]
for i in range(900):
    c.run(1)
    if i>=60 and i%3==0:
        d,w,h,p=c.frame
        a=np.frombuffer(d,dtype='<u2').reshape(h,p//2)[:,:w].copy()
        frs.append(a); pals.append(np.frombuffer(c.peek(0xFB00,128),dtype='>u2').copy()); idx.append(i)
np.savez_compressed("cap.npz",frames=np.array(frs),pals=np.array(pals),idx=np.array(idx))
print(len(frs), hashlib.sha256(np.array(frs).tobytes()).hexdigest()[:16])
