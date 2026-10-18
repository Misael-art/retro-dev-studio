import sys, json, numpy as np
from nem import nem_decode
rom=open("sonic_local.bin",'rb').read()
import os
z=np.load(sys.argv[1] if len(sys.argv)>1 else "cap2.npz"); NSS=int(os.environ.get("NSS","310")); F=z['frames'][:NSS]; P=z['pals'][:NSS]
MUT=os.environ.get("MUT","")
OUT=sys.argv[2] if len(sys.argv)>2 else "mapmatch.json"
R=lambda n:(n*4+(n>>2)); G=lambda n:(n*8+(n>>1))
def conv(w): return (R((w>>1)&7)<<11)|(G((w>>5)&7)<<5)|R((w>>9)&7)
# PLC
cues=[]; p=0x1D992; n=int.from_bytes(rom[p:p+2],'big')+1
for i in range(n):
    off=int.from_bytes(rom[p+2+i*6:p+6+i*6],'big'); vram=int.from_bytes(rom[p+6+i*6:p+8+i*6],'big')
    d,t,_,_=nem_decode(rom,off); cues.append((vram//32,t,d))
def art_at(tile):
    for s,t,d in cues:
        if s<=tile<s+t: return s,t,d
    return None
def tile_px(d,t):
    b=d[t*32:t*32+32]; return np.array([[(b[y*4+x//2]>>(4 if x%2==0 else 0))&15 for x in range(8)] for y in range(8)],np.uint8)
def frames_of(ptr):
    out=[]; mn=999
    for k in range(32):
        a=ptr+2*k
        if 2*k>=mn: break
        v=int.from_bytes(rom[a:a+2],'big')
        if v<2*(k+1) or v>=0x100: break
        mn=min(mn,v); out.append(v)
    return out
def pieces_at(a):
    n=rom[a]; ps=[]
    for i in range(n):
        r=rom[a+1+i*5:a+6+i*5]
        ps.append(dict(y=r[0]-256 if r[0]>127 else r[0], w=((r[1]>>2)&3)+1,h=(r[1]&3)+1,name=int.from_bytes(r[2:4],'big'),x=r[4]-256 if r[4]>127 else r[4]))
    return ps
def compose(ps,campo,asrc):
    s,t,d=asrc
    x0=min(p['x'] for p in ps); y0=min(p['y'] for p in ps); x1=max(p['x']+8*p['w'] for p in ps); y1=max(p['y']+8*p['h'] for p in ps)
    W,H=x1-x0,y1-y0; img=np.zeros((H,W),np.uint8)
    for p in ps:
        nm=(campo+p['name'])&0xFFFF; ti=nm&0x7FF; line=(nm>>13)&3; xf=bool(nm&0x800); yf=bool(nm&0x1000)
        pw,ph=8*p['w'],8*p['h']
        for v in range(ph):
            for u in range(pw):
                su=pw-1-u if xf else u; sv=ph-1-v if yf else v
                tt=(ti+(sv//8)*p['w']+(su//8)-s) if MUT=='transpose' else (ti+(su//8)*p['h']+(sv//8)-s)
                if tt<0 or tt>=t: return None
                c=tile_px(d,tt)[sv%8,(7-su%8) if MUT=='invert' else su%8]
                if c: img[p['y']-y0+v,p['x']-x0+u]=(line<<4)|c
    return img
def find(frame,img,pal,counts):
    ys,xs=np.nonzero(img); 
    if len(ys)<20: return []
    col=pal[img[ys,xs]]
    if len(set(col.tolist()))<3: return []
    rar=np.array([counts.get(int(c),0) for c in col])
    if (rar==0).any(): return []
    sel=np.argsort(rar)[:6]; h,w=img.shape; H,W=frame.shape
    ok=np.ones((H-h+1,W-w+1),bool)
    for s_ in sel:
        ok&=frame[ys[s_]:ys[s_]+H-h+1,xs[s_]:xs[s_]+W-w+1]==col[s_]
        if not ok.any(): return []
    return [(int(y),int(x)) for y,x in zip(*np.nonzero(ok)) if (frame[y+ys,x+xs]==col).all()][:20]
groups={}
for k in range(1,79):
    r=rom[0x1B738+(k-1)*6:0x1B738+k*6]
    groups.setdefault((int.from_bytes(r[1:4],'big'),int.from_bytes(r[4:6],'big')),[]).append(k)
res=[]
for (ptr,campo),ids in groups.items():
    if ptr==0x2c564: continue
    asrc=art_at(campo&0x7FF)
    fr=frames_of(ptr)
    for k,v in enumerate(fr):
        a=ptr+v
        n=rom[a]
        if n==0: res.append(dict(ptr=hex(ptr),campo=hex(campo),ids=ids,frame=k,estado="vazio-sem-pecas",hits=0)); continue
        ps=pieces_at(a)
        if asrc is None: res.append(dict(ptr=hex(ptr),campo=hex(campo),ids=ids,frame=k,estado="arte-sem-cue",hits=0)); continue
        base_img=compose(ps,campo,asrc)
        if base_img is None: res.append(dict(ptr=hex(ptr),campo=hex(campo),ids=ids,frame=k,estado="tile-fora-da-arte",hits=0)); continue
        hits=0; ex=None
        for fl in range(4):
            t=base_img
            if fl&1: t=t[:,::-1]
            if fl&2: t=t[::-1,:]
            t=np.ascontiguousarray(t)
            for i in range(len(F)):
                v_,cn=np.unique(F[i],return_counts=True); counts=dict(zip(v_.tolist(),cn.tolist()))
                pal=np.array([conv(int(w)) for w in P[i]],np.uint16)
                h=find(F[i],t,pal,counts)
                if h: hits+=len(h); ex=ex or (fl,i,h[0])
        res.append(dict(ptr=hex(ptr),campo=hex(campo),ids=ids,frame=k,estado="casou" if hits else "sem-acerto-nos-frames",hits=hits,exemplo=ex,pecas=len(ps),tam=list(base_img.shape)))
json.dump(res,open(OUT,"w"),indent=1)
for r in res: print(r['ptr'],r['campo'],r['ids'][:3],'f',r['frame'],r['estado'],r['hits'],r.get('exemplo'))
