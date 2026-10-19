import ctypes as C, sys, hashlib
class GameInfo(C.Structure): _fields_=[("path",C.c_char_p),("data",C.c_void_p),("size",C.c_size_t),("meta",C.c_char_p)]
class SysAV(C.Structure): _fields_=[("w",C.c_uint),("h",C.c_uint),("aspect",C.c_float),("fps",C.c_double),("sr",C.c_double)]
ENV=C.CFUNCTYPE(C.c_bool,C.c_uint,C.c_void_p); VID=C.CFUNCTYPE(None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t)
AUD=C.CFUNCTYPE(C.c_size_t,C.c_void_p,C.c_size_t); AUB=C.CFUNCTYPE(None,C.c_int16,C.c_int16)
INP=C.CFUNCTYPE(None); IST=C.CFUNCTYPE(C.c_int16,C.c_uint,C.c_uint,C.c_uint,C.c_uint)
class Core:
    def __init__(s, so, rom):
        s.lib=C.CDLL(so); s.fmt=0; s.frame=None; s.buttons=0
        s.sysdir=C.c_char_p(b"/tmp"); s.keep=[]
        def env(cmd,data):
            print("env",cmd,file=sys.stderr)
            if cmd==10: s.fmt=C.cast(data,C.POINTER(C.c_uint))[0]; return True
            if cmd in (9,31): C.cast(data,C.POINTER(C.c_char_p))[0]=s.sysdir; return True
            if cmd==3: C.cast(data,C.POINTER(C.c_bool))[0]=True; return True
            return False
        def vid(d,w,h,p):
            if d: 
                s.frame=(C.string_at(d,p*h),w,h,p)
        def ist(port,dev,idx,id_):
            return 1 if (dev==1 and port==0 and (s.buttons>>id_)&1) else 0
        s.cb=[ENV(env),VID(vid),AUB(lambda l,r:None),AUD(lambda d,n:n),INP(lambda:None),IST(ist)]
        L=s.lib; L.retro_set_environment(s.cb[0]); L.retro_init()
        L.retro_set_video_refresh(s.cb[1]); L.retro_set_audio_sample(s.cb[2]); L.retro_set_audio_sample_batch(s.cb[3])
        L.retro_set_input_poll(s.cb[4]); L.retro_set_input_state(s.cb[5])
        s.rom=open(rom,'rb').read(); s.buf=C.create_string_buffer(s.rom,len(s.rom))
        gi=GameInfo(rom.encode(),C.cast(s.buf,C.c_void_p),len(s.rom),None)
        L.retro_load_game.restype=C.c_bool; assert L.retro_load_game(C.byref(gi)), "load"
        L.retro_get_memory_data.restype=C.c_void_p; L.retro_get_memory_size.restype=C.c_size_t
    def run(s,n=1):
        for _ in range(n): s.lib.retro_run()
    def ram(s):
        p=s.lib.retro_get_memory_data(2); n=s.lib.retro_get_memory_size(2); return p,n
    # work_ram do GPGX fica com cada palavra de 16 bits invertida: byte em A mora em A^1.
    def peek(s,addr,n):
        p,_=s.ram(); return bytes(C.string_at(p+((addr+i)&0xFFFF)^1,1)[0] for i in range(n))
    def poke(s,addr,b):
        p,_=s.ram()
        for i,v in enumerate(b): C.memmove(p+(((addr+i)&0xFFFF)^1),bytes([v]),1)
