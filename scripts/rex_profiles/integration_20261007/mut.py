import numpy as np, json
exec(open('match.py').read().split("rng=np.random")[0])
rng=np.random.default_rng(1)
def run(name,tf):
    n=0
    for k in range(0,len(F),2):
        v,cn=np.unique(F[k],return_counts=True); counts=dict(zip(v.tolist(),cn.tolist()))
        pal=np.array([conv(int(w)) for w in P[k][:16]],np.uint16)
        for f in (9,15):
            n+=len(find(F[k],np.ascontiguousarray(tf(T[f],f)),pal,rng,counts))
    print(name,"acertos frames 9/15 linha 0:",n)
run("original",lambda t,f:t)
run("deslocado 1px",lambda t,f:np.roll(t,1,axis=1))
run("transposto (linha/coluna de tiles trocados)",lambda t,f:t.T if t.shape[0]==t.shape[1] else t)
run("colunas de pixel invertidas dentro do tile",lambda t,f:t.reshape(t.shape[0],-1,8)[:,:,::-1].reshape(t.shape))
