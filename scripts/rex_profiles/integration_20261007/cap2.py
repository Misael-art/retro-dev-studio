import sys, glob, numpy as np, hashlib
sys.path.insert(0,'.')
from lr import Core
CORE=glob.glob(sys.argv[1])[0]
c=Core(CORE,"./sonic_local.bin")
c.run(500)
c.buttons=1<<3; c.run(10); c.buttons=0   # Start (demo) como antes
c.run(600)
c.poke(0xF600,b'\x10')
frs=[];pals=[];idx=[]
import random; rnd=random.Random(7)
held=0
for i in range(6000):
    if i%40==0: held=rnd.choice([0,1<<7,1<<6,1<<7|1<<0,1<<6|1<<1,(1<<7)|(1<<8)])  # dir/botoes aleatorios
    c.buttons=held
    c.run(1)
    if i>=60 and i%5==0:
        d,w,h,p=c.frame
        frs.append(np.frombuffer(d,dtype='<u2').reshape(h,p//2)[:,:w].copy())
        pals.append(np.frombuffer(c.peek(0xFB00,128),dtype='>u2').copy()); idx.append(i)
np.savez_compressed("cap2.npz",frames=np.array(frs),pals=np.array(pals),idx=np.array(idx))
print(len(frs), hashlib.sha256(np.array(frs).tobytes()).hexdigest()[:16], c.peek(0xF600,1).hex())
