import sys; sys.path.insert(0,'.')
import lr
def start_level(core_so, rom):
    c=lr.Core(core_so,rom)
    c.run(600); c.buttons=1<<3
    for _ in range(600):
        c.run(1)
        if c.peek(0xF600,1)[0]==0x0c: break
    c.buttons=0; c.run(200)
    return c
def st(c): 
    return dict(x=int.from_bytes(c.peek(0xD008,2),'big'),y=int.from_bytes(c.peek(0xD00C,2),'big'),yv=int.from_bytes(c.peek(0xD012,2),'big',signed=True),fl=c.peek(0xD03C,1)[0],stat=c.peek(0xD022,1)[0])
