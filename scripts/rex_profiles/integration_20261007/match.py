import sys, numpy as np, json
from nem import nem_decode
rom=open("sonic_local.bin",'rb').read()
art,tiles,_,_=nem_decode(rom,0x2C5E4)
z=np.load("cap.npz"); F=z['frames']; P=z['pals']
R=lambda n:(n*4+(n>>2)); G=lambda n:(n*8+(n>>1))
def conv(w): return (R((w>>1)&7)<<11)|(G((w>>5)&7)<<5)|R((w>>9)&7)
def idx_img(ti,w,h):
    img=np.zeros((h*8,w*8),np.uint8)
    for cx in range(w):
        for cy in range(h):
            t=ti+cx*h+cy; d=art[t*32:t*32+32]
            for y in range(8):
                for x in range(8):
                    img[cy*8+y,cx*8+x]=(d[y*4+x//2]>>(4 if x%2==0 else 0))&0xF
    return img
tab=0x2C564; T=[]
for f in range(16):
    o=tab+int.from_bytes(rom[tab+2*f:tab+2*f+2],'big'); r=rom[o+1:o+6]
    T.append(idx_img(int.from_bytes(r[2:4],'big')&0x7FF,((r[1]>>2)&3)+1,(r[1]&3)+1))
def find(frame,tpl_idx,pal,rng,counts):
    h,w=tpl_idx.shape; ys,xs=np.nonzero(tpl_idx)
    col=pal[tpl_idx[ys,xs]]
    rar=np.array([counts.get(int(c),0) for c in col])
    if (rar==0).any() or len(set(col.tolist()))<6: return []
    sel=np.argsort(rar)[:6]
    H,W=frame.shape; ok=np.ones((H-h+1,W-w+1),bool)
    for s_ in sel:
        ok&= frame[ys[s_]:ys[s_]+H-h+1, xs[s_]:xs[s_]+W-w+1]==col[s_]
        if not ok.any(): return []
    out=[]
    for y,x in list(zip(*np.nonzero(ok)))[:50]:
        if (frame[y+ys,x+xs]==col).all(): out.append((int(y),int(x),1.0,len(ys)))
    return out
rng=np.random.default_rng(1)
res=[]
for k in range(0,len(F),1):
    v,cn=np.unique(F[k],return_counts=True); counts=dict(zip(v.tolist(),cn.tolist()))
    pl=[np.array([conv(int(w)) for w in P[k][l*16:(l+1)*16]],np.uint16) for l in range(4)]
    for f in range(16):
        for fl in range(4):
            t=T[f]
            if fl&1: t=t[:,::-1]
            if fl&2: t=t[::-1,:]
            for l in range(4):
                for (y,x,m,n) in find(F[k],np.ascontiguousarray(t),pl[l],rng,counts):
                    res.append(dict(cap=int(z['idx'][k]),frame=f,flip=fl,line=l,y=y,x=x,opacos=n))
print(len(res)); 
from collections import Counter
print(Counter((r['frame'],r['flip'],r['line']) for r in res))
json.dump(res,open("match.json","w"))
