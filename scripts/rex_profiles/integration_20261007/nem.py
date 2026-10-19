# Decoder Nemesis independente (escrito a partir do formato publico; sem codigo de terceiros).
def nem_decode(rom, off):
    p = off
    hdr = (rom[p] << 8) | rom[p+1]; p += 2
    xor = bool(hdr & 0x8000); tiles = hdr & 0x7FFF
    table = {}
    pal = None
    while True:
        b = rom[p]; p += 1
        if b == 0xFF: break
        if b & 0x80:
            pal = b & 0x0F; continue
        run = ((b >> 4) & 7) + 1; ln = b & 0x0F
        code = rom[p]; p += 1
        table[(ln, code)] = (pal, run)
    pos = [p * 8]
    def bit():
        i = pos[0]; pos[0] += 1
        return (rom[i >> 3] >> (7 - (i & 7))) & 1
    def bits(n):
        v = 0
        for _ in range(n): v = (v << 1) | bit()
        return v
    pix = []
    total = tiles * 64
    while len(pix) < total:
        code = 0; ln = 0
        while True:
            code = (code << 1) | bit(); ln += 1
            if ln == 6 and code == 0x3F:
                v = bits(7); pix += [v & 0xF] * (((v >> 4) & 7) + 1); break
            if (ln, code) in table:
                c, r = table[(ln, code)]; pix += [c] * r; break
            if ln > 8: raise ValueError("codigo invalido")
    if len(pix) != total: raise ValueError(f"excesso de pixels {len(pix)} != {total}")
    out = bytearray()
    prev = 0
    for row in range(tiles * 8):
        px = pix[row*8:row*8+8]
        w = 0
        for c in px: w = (w << 4) | c
        if xor: w ^= prev
        prev = w
        out += w.to_bytes(4, 'big')
    return bytes(out), tiles, xor, (pos[0] + 7) // 8 - off
