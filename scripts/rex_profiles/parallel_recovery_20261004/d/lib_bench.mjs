/**
 * Barra de avaliacao da frente D — biblioteca de codecs e fixture autoral.
 *
 * Todo byte gerado aqui vem de parâmetros de autoria + PRNG deterministico.
 * Nenhuma deteccao das frentes A/B/C entra nesta linha de evidencia.
 */
import { createHash } from "node:crypto";

export const CONTAINER_MAGIC = "RDSDBNCH";export const CONTAINER_VERSION = 1;
export const REGION_HEADER_MAGIC = "RDSRGH";
export const REGION_HEADER_LEN = 16;
export const DIR_ENTRY_LEN = 16;
export const DIR_HEADER_LEN = 32;

export const CLASS = { stream: 1, geom: 2, table: 3, pixels: 4 };
export const CODEC = {
  pixels4bpp: 0,
  "dsb1-store": 1,
  "dsb1-rle": 2,
  "dsb1-lz": 3,
  kosinski: 4,
  "tiles4bpp-planar": 5,
  "branch-table": 6,
};
export const CLASS_OF_CODEC = Object.fromEntries(
  Object.entries(CODEC).map(([name, id]) => [
    id,
    name === "branch-table"
      ? "table"
      : name === "tiles4bpp-planar"
        ? "geom"
        : name === "pixels4bpp"
          ? "pixels"
          : "stream",
  ]),
);
export const CLASS_NAME = { 1: "stream", 2: "geom", 3: "table", 4: "pixels" };
export const CODEC_NAME = Object.fromEntries(
  Object.entries(CODEC).map(([name, id]) => [id, name]),
);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Constantes de `xorshift64*` como as publica Marsaglia (2003). */
export const XORSHIFT64STAR = {
  nome: "xorshift64*",
  terna: [12, 25, 27],
  multiplicador: "2685821657736338717", // 0x2545F4914F6CDD1D
  truncado_na: "bigint",
};

const semeio = (seedText) => {
  let s = BigInt("1469598103934665603");
  for (const ch of Buffer.from(`${seedText}|dsb1|1`, "utf8")) {
    s = BigInt.asUintN(64, (s ^ BigInt(ch)) * BigInt("1099511628211"));
  }
  return s === 0n ? 1n : s;
};

/**
 * PRNG determinístico das estruturas autorais da barra (regra R16).
 * `Number(x) >> 33n` sobre o produto de 128 bits perdia a precisión antes do
 * desprazamento, polo que o desprazamento devolvia 0 en coma flotante e `% 256`
 * era invariablemente 0: o xerador anterior era dexenerado en todas as sementes.
 * A truncación faise agora en aritmética enteira antes de converter a `Number`.
 */
export function makeRng(seedText) {
  const A = BigInt(XORSHIFT64STAR.multiplicador);
  let state = semeio(seedText);
  return function next() {
    state ^= state >> 12n;
    state = BigInt.asUintN(64, state);
    state ^= state << 25n;
    state = BigInt.asUintN(64, state);
    state ^= state >> 27n;
    state = BigInt.asUintN(64, state);
    return Number(BigInt.asUintN(64, state * A) >> 33n) % 256;
  };
}

/**
 * CONTROL HISTÓRICO, non fonte de entropía: a implementación de roldas 1 e 2.
 * Devolve sempre 0 (ver o defecto descrito en `makeRng`). Mantense exposta só
 * para que os artefactos selados de v1 sigan sendo re-xerábeis byte a byte; ningún
 * fixture novo debe chamala. R16 prohíbe usala como xerador de datos de proba.
 */
export function makeRngDegeneradoV1(seedText) {
  let state = semeio(seedText);
  return function next() {
    state ^= state >> 12n;
    state = BigInt.asUintN(64, state);
    state ^= state << 25n;
    state = BigInt.asUintN(64, state);
    state ^= state >> 27n;
    state = BigInt.asUintN(64, state);
    return Number((BigInt.asUintN(64, state) * BigInt("2685821657763633871")) >> 33n) % 256;
  };
}

/** Xeradores de entropía. `v1` = roldas 1–2, **dexenerado**: existe só para que
 *  os artefactos selados de v1 sigan re-xerábeis byte a byte. `v2` = corrixido,
 *  e o único permitido para fixtures novos (regra R16). */
export const XERADORES = {
  v1: makeRngDegeneradoV1,
  v2: makeRng,
};

export function xerador(nome) {
  const f = XERADORES[nome];
  if (!f) throw new Error(`xerador descoñecido: ${nome} (dispoñibles: ${Object.keys(XERADORES).join(", ")})`);
  return f;
}

// ---------------------------------------------------------------------------
// dsb1 — codecs autorais da frente D
// ---------------------------------------------------------------------------

export function dsb1StoreEncode(raw) {
  return Buffer.from(raw);
}
export function dsb1StoreDecode(payload, rawLen) {
  if (payload.length !== rawLen) throw new Error("dsb1-store: comprimento divergente");
  return Buffer.from(payload);
}

export function dsb1RleEncode(raw) {
  const out = [];
  let i = 0;
  let litStart = i;
  const flushLiterals = (end) => {
    let p = litStart;
    while (p < end) {
      const n = Math.min(end - p, 128);
      out.push(n - 1, ...raw.slice(p, p + n));
      p += n;
    }
  };
  while (i < raw.length) {
    let run = 1;
    while (i + run < raw.length && run < 129 && raw[i + run] === raw[i]) run += 1;
    if (run >= 3) {
      flushLiterals(i);
      out.push(0x80 + (run - 2), raw[i]);
      i += run;
      litStart = i;
    } else {
      i += 1;
    }
  }
  flushLiterals(raw.length);
  return Buffer.from(out);
}

export function dsb1RleDecode(payload, rawLen) {
  const out = [];
  let i = 0;
  while (out.length < rawLen) {
    if (i >= payload.length) throw new Error("dsb1-rle: stream truncada");
    const ctrl = payload[i];
    i += 1;
    if (ctrl < 0x80) {
      const n = ctrl + 1;
      if (i + n > payload.length) throw new Error("dsb1-rle: literais truncados");
      for (let k = 0; k < n; k += 1) out.push(payload[i + k]);
      i += n;
    } else {
      if (i >= payload.length) throw new Error("dsb1-rle: byte de repeticao ausente");
      const b = payload[i];
      i += 1;
      const n = ctrl - 0x80 + 2;
      for (let k = 0; k < n; k += 1) out.push(b);
    }
  }
  if (out.length !== rawLen || i !== payload.length) {
    throw new Error("dsb1-rle: desenquadramento de saida/stream");
  }
  return Buffer.from(out.slice(0, rawLen));
}

export function dsb1LzEncode(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    const windowStart = Math.max(0, i - 256);
    let bestLen = 0;
    let bestDist = 0;
    for (let c = windowStart; c < i; c += 1) {
      let len = 0;
      while (len < 128 && i + len < raw.length && c + len < i && raw[c + len] === raw[i + len]) {
        len += 1;
      }
      if (len > bestLen) {
        bestLen = len;
        bestDist = i - c;
      }
    }
    if (bestLen >= 3) {
      // 0xff esta reservado ao escape de literal; entao o match vai ate 128
      out.push(0x80 | (bestLen - 2), bestDist - 1);
      i += bestLen;
    } else if (raw[i] < 0x80) {
      out.push(raw[i]);
      i += 1;
    } else {
      out.push(0xff, raw[i]);
      i += 1;
    }
  }
  return Buffer.from(out);
}

export function dsb1LzDecode(payload, rawLen) {
  const out = [];
  let i = 0;
  while (out.length < rawLen) {
    if (i >= payload.length) throw new Error("dsb1-lz: stream truncada");
    const tok = payload[i];
    i += 1;
    if (tok === 0xff) {
      if (i >= payload.length) throw new Error("dsb1-lz: escape sem literal");
      out.push(payload[i]);
      i += 1;
    } else if (tok & 0x80) {
      const len = (tok & 0x7f) + 2;
      if (i >= payload.length) throw new Error("dsb1-lz: match sem distancia");
      const dist = payload[i] + 1;
      i += 1;
      if (dist > out.length) throw new Error("dsb1-lz: referencia antes do historico");
      const src = out.length - dist;
      for (let k = 0; k < len; k += 1) out.push(out[src + k]);
    } else {
      out.push(tok);
    }
  }
  if (out.length !== rawLen || i !== payload.length) {
    throw new Error("dsb1-lz: desenquadramento de saida/stream");
  }
  return Buffer.from(out.slice(0, rawLen));
}

export const DSB1 = {
  1: { name: "dsb1-store", encode: dsb1StoreEncode, decode: dsb1StoreDecode },
  2: { name: "dsb1-rle", encode: dsb1RleEncode, decode: dsb1RleDecode },
  3: { name: "dsb1-lz", encode: dsb1LzEncode, decode: dsb1LzDecode },
};

// ---------------------------------------------------------------------------
// Kosinski — bitstream conforme especificacao publica (mdcomp, commit 72c6df40).
// Escrito a partir dos fatos do formato, nao copiado de codigo das frentes.
// ---------------------------------------------------------------------------

export class KosinskiEncoder {
  constructor() {
    this.bytes = [];
    this.out = [];
    this.tagStart = null;
    this.bitUsed = 0;
  }

  openWord() {
    this.tagStart = this.bytes.length;
    this.bytes.push(0, 0);
    this.bitUsed = 0;
  }

  w(bits) {
    for (const bit of bits) {
      if (this.tagStart === null) this.openWord();
      if (bit) this.bytes[this.tagStart + (this.bitUsed >> 3)] |= 1 << (this.bitUsed & 7);
      this.bitUsed += 1;
      if (this.bitUsed === 16) this.openWord(); // EARLY FETCH
    }
  }

  d(byte) {
    this.bytes.push(byte & 0xff);
  }

  copy(dist, len) {
    const src = this.out.length - dist;
    if (src < 0) throw new Error(`kosinski: distancia ${dist} > historico ${this.out.length}`);
    for (let i = 0; i < len; i += 1) this.out.push(this.out[src + i]);
  }

  literal(byte) {
    this.w([1]);
    this.d(byte);
    this.out.push(byte);
  }

  inline(len, dist) {
    if (!(len >= 2 && len <= 5 && dist >= 1 && dist <= 256)) {
      throw new Error("kosinski: token inline fora da faixa");
    }
    const l = len - 2;
    this.w([0, 0, (l >> 1) & 1, l & 1]);
    this.d(0x100 - dist);
    this.copy(dist, len);
  }

  separate(len, dist) {
    if (!(len >= 2 && len <= 256 && dist >= 1 && dist <= 0x2000)) {
      throw new Error("kosinski: token separado fora da faixa");
    }
    this.w([0, 1]);
    const enc = 0x2000 - dist;
    const low = enc & 0xff;
    const high = (enc >> 5) & 0xf8;
    if (len >= 2 && len <= 9) {
      this.d(low);
      this.d(high | (len - 2));
    } else {
      this.d(low);
      this.d(high);
      this.d(len - 1);
    }
    this.copy(dist, len);
  }

  eod() {
    this.w([0, 1]);
    this.d(0x00);
    this.d(0xf0);
    this.d(0x00);
  }

  result() {
    return { plaintext: Buffer.from(this.out), stream: Buffer.from(this.bytes) };
  }
}

/** Codifica com tokens minimais; used para gerar streams de exemplo. */
export function kosinskiEncode(raw) {
  const enc = new KosinskiEncoder();
  let i = 0;
  while (i < raw.length) {
    const windowStart = Math.max(0, i - 0x2000);
    let bestLen = 0;
    let bestDist = 0;
    for (let c = windowStart; c < i; c += 1) {
      let len = 0;
      while (len < 256 && i + len < raw.length && c + len < i && raw[c + len] === raw[i + len]) {
        len += 1;
      }
      if (len > bestLen) {
        bestLen = len;
        bestDist = i - c;
      }
    }
    if (bestLen >= 3) {
      if (bestLen <= 5 && bestDist <= 256) enc.inline(bestLen, bestDist);
      else enc.separate(Math.min(bestLen, 256), bestDist);
      i += Math.min(bestLen, 256);
    } else {
      enc.literal(raw[i]);
      i += 1;
    }
  }
  enc.eod();
  return enc.result();
}

export function kosinskiDecode(stream, { maxOutput = 1 << 22 } = {}) {
  let pos = 0;
  let desc = 0;
  let bitsLeft = 0;
  let descEof = false;
  const out = [];
  const fetchDesc = () => {
    if (pos + 2 > stream.length) {
      descEof = true;
      return false;
    }
    desc = stream[pos] | (stream[pos + 1] << 8);
    pos += 2;
    bitsLeft = 16;
    return true;
  };
  const nextBit = () => {
    if (bitsLeft === 0 && !fetchDesc()) throw new Error("kosinski: descritor truncado");
    bitsLeft -= 1;
    const bit = desc & 1;
    desc >>= 1;
    // EARLY FETCH: a proxima palavra e lida imediatamente ao esgotar a
    // corrente, antes de qualquer byte de dados do token corrente
    if (bitsLeft === 0 && !descEof) fetchDesc();
    return bit;
  };
  const getByte = () => {
    if (pos >= stream.length) throw new Error("kosinski: byte de dados ausente");
    return stream[pos++];
  };
  for (;;) {
    if (nextBit() === 1) {
      const v = getByte();
      out.push(v);
      if (out.length > maxOutput) throw new Error("kosinski: teto de saida excedido");
      continue;
    }
    if (nextBit() === 1) {
      const low = getByte();
      const high = getByte();
      const count = high & 7;
      let len;
      if (count !== 0) {
        len = count + 2;
      } else {
        const c = getByte();
        if (c === 0) break;
        if (c === 1) continue;
        len = c + 1;
      }
      const dist = 0x2000 - (((high & 0xf8) << 5) | low);
      if (dist <= 0 || dist > 0x2000) throw new Error("kosinski: distancia invalida");
      if (dist > out.length) throw new Error("kosinski: referencia antes do historico");
      const src = out.length - dist;
      for (let k = 0; k < len; k += 1) out.push(out[src + k]);
      if (out.length > maxOutput) throw new Error("kosinski: teto de saida excedido");
    } else {
      const h = nextBit();
      const l = nextBit();
      const len = ((h << 1) | l) + 2;
      const d = getByte();
      const dist = 0x100 - d;
      if (dist <= 0 || dist > 0x2000) throw new Error("kosinski: distancia inline invalida");
      if (dist > out.length) throw new Error("kosinski: referencia antes do historico");
      const src = out.length - dist;
      for (let k = 0; k < len; k += 1) out.push(out[src + k]);
      if (out.length > maxOutput) throw new Error("kosinski: teto de saida excedido");
    }
  }
  return Buffer.from(out);
}

export const STREAM_DECODERS = {
  1: dsb1StoreDecode,
  2: dsb1RleDecode,
  3: dsb1LzDecode,
  4: (payload) => kosinskiDecode(payload),
};
export const STREAM_ENCODERS = {
  1: dsb1StoreEncode,
  2: dsb1RleEncode,
  3: dsb1LzEncode,
  4: (raw) => kosinskiEncode(raw).stream,
};

// ---------------------------------------------------------------------------
// Geometria: tiles 8x8, 4bpp, planar (bit 7 = pixel mais a esquerda)
// ---------------------------------------------------------------------------

export function planarToIndices(tiles, width, height) {
  const cols = width / 8;
  const rows = height / 8;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
    throw new Error("geometria: dimensoes nao sao multiplos de 8");
  }
  const need = cols * rows * 32;
  if (tiles.length !== need) throw new Error("geometria: bytes de tile nao batem com w*h");
  const out = new Uint8Array(width * height);
  for (let t = 0; t < cols * rows; t += 1) {
    const tx = (t % cols) * 8;
    const ty = Math.floor(t / cols) * 8;
    for (let p = 0; p < 4; p += 1) {
      for (let r = 0; r < 8; r += 1) {
        const byte = tiles[t * 32 + p * 8 + r];
        for (let b = 0; b < 8; b += 1) {
          if ((byte >> (7 - b)) & 1) out[(ty + r) * width + tx + b] |= 1 << p;
        }
      }
    }
  }
  return Buffer.from(out);
}

export function indicesToPlanar(indices, width, height) {
  const cols = width / 8;
  const tiles = Buffer.alloc(cols * (height / 8) * 32);
  for (let ty = 0; ty < height; ty += 8) {
    for (let tx = 0; tx < width; tx += 8) {
      const t = (ty / 8) * cols + tx / 8;
      for (let p = 0; p < 4; p += 1) {
        for (let r = 0; r < 8; r += 1) {
          let byte = 0;
          for (let b = 0; b < 8; b += 1) {
            if ((indices[(ty + r) * width + tx + b] >> p) & 1) byte |= 1 << (7 - b);
          }
          tiles[t * 32 + p * 8 + r] = byte;
        }
      }
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Regioes e diretorio
// ---------------------------------------------------------------------------

export function buildRegionHeader(region) {
  const h = Buffer.alloc(REGION_HEADER_LEN);
  h.write(REGION_HEADER_MAGIC, 0, "ascii");
  h.writeUInt8(CLASS[region.class], 6);
  h.writeUInt8(CODEC[region.codec], 7);
  h.writeUInt16BE(REGION_HEADER_LEN + region.payload.length, 8);
  h.writeUInt16BE(region.payload.length, 10);
  h.writeUInt16BE(region.rawLen & 0xffff, 12);
  h.writeUInt16BE(region.aux ?? 0, 14);
  return h;
}

export function parseRegionHeader(buf, offset) {
  if (buf.slice(offset, offset + 6).toString("ascii") !== REGION_HEADER_MAGIC) {
    return null;
  }
  return {
    class_id: buf.readUInt8(offset + 6),
    class: CLASS_NAME[buf.readUInt8(offset + 6)],
    codec_id: buf.readUInt8(offset + 7),
    codec: CODEC_NAME[buf.readUInt8(offset + 7)],
    total_len: buf.readUInt16BE(offset + 8),
    payload_len: buf.readUInt16BE(offset + 10),
    raw_len: buf.readUInt16BE(offset + 12),
    aux: buf.readUInt16BE(offset + 14),
  };
}

export function buildDirectory(entries) {
  const buf = Buffer.alloc(entries.length * DIR_ENTRY_LEN);
  entries.forEach((e, i) => {
    const o = i * DIR_ENTRY_LEN;
    buf.writeUInt8(e.kind_id, o);
    buf.writeUInt8(e.addr_mode, o + 1);
    buf.write(e.id.slice(0, 4).padEnd(4, "0"), o + 2, "ascii");
    buf.writeUInt32BE(e.target, o + 6);
    buf.writeUInt32BE(e.aux ?? 0, o + 10);
    buf.writeUInt16BE(0, o + 14);
  });
  return buf;
}

export function parseDirectory(buf, offset, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const o = offset + i * DIR_ENTRY_LEN;
    out.push({
      kind_id: buf.readUInt8(o),
      kind: CLASS_NAME[buf.readUInt8(o)],
      addr_mode: buf.readUInt8(o + 1),
      id: buf.slice(o + 2, o + 6).toString("ascii"),
      target: buf.readUInt32BE(o + 6),
      aux: buf.readUInt32BE(o + 10),
    });
  }
  return out;
}
