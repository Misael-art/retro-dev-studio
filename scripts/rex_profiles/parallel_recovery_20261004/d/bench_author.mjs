/**
 * Autor dos fixtures da barra D. Produz imagem + ground truth + export ideal.
 * NENHUMA etapa aqui consulta detectores/decoders das frentes A/B/C.
 */
import {
  CLASS,
  CODEC,
  CONTAINER_MAGIC,
  CONTAINER_VERSION,
  DIR_ENTRY_LEN,
  REGION_HEADER_LEN,
  STREAM_ENCODERS,
  buildDirectory,
  buildRegionHeader,
  indicesToPlanar,
  makeRng,
  sha256,
} from "./lib_bench.mjs";

function payloadFor(kind, rng, spec) {
  if (kind === "tiles4bpp-planar") {
    const { width, height } = spec;
    const indices = new Uint8Array(width * height);
    for (let i = 0; i < indices.length; i += 1) indices[i] = rng() & 0x0f;
    // o indice inicial de cada linha depende da largura declarada: blocos de
    // mesmo comprimento em bytes mas geometrias diferentes tem composicoes
    // DIFERENTES, entao trocar (w,h) entre eles e detectavel na saida composta
    for (let y = 0; y < height; y += 1) {
      const v = width & 0x0f;
      for (let x = 0; x < width; x += 1) indices[y * width + x] = (indices[y * width + x] + v) & 0x0f;
    }
    return { indices, planar: indicesToPlanar(indices, width, height) };
  }
  if (kind === "pixels4bpp") {
    const bytes = Buffer.alloc(spec.length);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = rng();
    return { pixels: bytes };
  }
  const raw = Buffer.alloc(spec.raw_len);
  const alphabet = spec.alphabet ?? 12;
  let i = 0;
  while (i < raw.length) {
    const segLen = Math.min(raw.length - i, 8 + (rng() % 24));
    if (rng() % 4 === 0 && i > 0) {
      const back = 1 + (rng() % Math.min(i, spec.max_back ?? 300));
      for (let k = 0; k < segLen; k += 1) raw[i + k] = raw[i - back + k];
    } else if (rng() % 3 === 0) {
      const v = rng() % alphabet;
      raw.fill(v, i, i + segLen);
    } else {
      for (let k = 0; k < segLen; k += 1) raw[i + k] = rng() % alphabet;
    }
    i += segLen;
  }
  return { raw };
}

const STREAM_SPECS_DEV = [
  { id: "R-S1", codec: "dsb1-lz", consumer: "C-ART-01", addr_mode: "word", raw_len: 480 },
  { id: "R-S2", codec: "dsb1-lz", consumer: "C-ART-02", addr_mode: "word", raw_len: 320 },
  { id: "R-S3", codec: "dsb1-rle", consumer: "C-PAL-01", addr_mode: "byte", raw_len: 256 },
  { id: "R-S4", codec: "dsb1-store", consumer: "C-SND-01", addr_mode: "byte", raw_len: 192 },
  { id: "R-S5", codec: "kosinski", consumer: "C-ART-03", addr_mode: "word", raw_len: 448 },
  { id: "R-S6", codec: "dsb1-lz", consumer: "C-TXT-01", addr_mode: "byte", raw_len: 96 },
];
const DECOY_SPECS_DEV = [
  { id: "R-K1", codec: "dsb1-lz", raw_len: 288 },
  { id: "R-K2", codec: "dsb1-rle", raw_len: 160 },
  { id: "R-K3", codec: "kosinski", raw_len: 224 },
];

const DEV_PLAN = {
  set: "dev-1",
  streams: STREAM_SPECS_DEV,
  decoys: DECOY_SPECS_DEV,
  pixels: { id: "R-X1", consumer: "T-PX-01", length: 192, false_branches: 6 },
  tiles: [
    { id: "R-G1", consumer: "T-TILE-01", width: 16, height: 16 },
    { id: "R-G2", consumer: "T-TILE-02", width: 8, height: 32 },
  ],
  tables: [
    { id: "R-T1", consumer: "C-CTRL-01", entries: 5 },
    { id: "R-T2", consumer: "C-CTRL-02", entries: 4 },
  ],
};

function streamHo(i, codec, consumer, mode, raw) {
  return { id: `R-HS${i}`, codec, consumer, addr_mode: mode, raw_len: raw };
}

function buildHoPlan() {
  const codecs = ["dsb1-lz", "dsb1-rle", "dsb1-store", "kosinski"];
  const modes = ["word", "byte"];
  const streams = [];
  for (let i = 1; i <= 8; i += 1) {
    streams.push(
      streamHo(
        i,
        codecs[(i - 1) % 4],
        `C-HO-S${String(i).padStart(2, "0")}`,
        modes[i % 2],
        128 + i * 32,
      ),
    );
  }
  const decoys = [];
  for (let i = 1; i <= 4; i += 1) {
    decoys.push({ id: `R-HK${i}`, codec: codecs[(i + 1) % 4], raw_len: 96 + i * 48 });
  }
  const tables = [
    { id: "R-HT1", consumer: "C-HO-T1", entries: 5 },
    { id: "R-HT2", consumer: "C-HO-T2", entries: 4 },
    { id: "R-HT3", consumer: "C-HO-T3", entries: 4 },
  ];
  return {
    set: "ho-1",
    streams,
    decoys,
    pixels: { id: "R-HX1", consumer: "T-HO-PX", length: 240, false_branches: 9 },
    tiles: [
      { id: "R-HG1", consumer: "T-HO-G1", width: 24, height: 8 },
      { id: "R-HG2", consumer: "T-HO-G2", width: 8, height: 24 },
      { id: "R-HG3", consumer: "T-HO-G3", width: 16, height: 16 },
    ],
    tables,
  };
}

export function planFor(set) {
  if (set === "dev-1") return DEV_PLAN;
  if (set === "ho-1") return buildHoPlan();
  throw new Error(`conjunto desconhecido: ${set}`);
}

function encodeStream(codec, raw) {
  const payload = STREAM_ENCODERS[CODEC[codec]](raw);
  return { payload, raw };
}

export function authorSet(set, seed) {
  const plan = planFor(set);
  const regions = [];
  const consumers = [];
  const rng = makeRng(`${seed}::${set}`);

  const pushRegion = (r) => regions.push(r);

  for (const s of plan.streams) {
    const { payload, raw } = encodeStream(s.codec, payloadFor(s.codec, rng, { raw_len: s.raw_len }).raw);
    pushRegion({
      id: s.id,
      class: "stream",
      codec: s.codec,
      payload,
      rawLen: raw.length,
      raw,
      consumer: s.consumer,
      addr_mode: s.addr_mode,
    });
    consumers.push({ id: s.consumer, kind: "stream", addr_mode: s.addr_mode, region: s.id });
  }
  for (const d of plan.decoys) {
    const { payload, raw } = encodeStream(d.codec, payloadFor(d.codec, rng, { raw_len: d.raw_len }).raw);
    pushRegion({
      id: d.id,
      class: "stream",
      codec: d.codec,
      payload,
      rawLen: raw.length,
      raw,
      consumer: null,
      addr_mode: "byte",
    });
  }
  for (const t of plan.tiles) {
    const { indices, planar } = payloadFor("tiles4bpp-planar", rng, t);
    pushRegion({
      id: t.id,
      class: "geom",
      codec: "tiles4bpp-planar",
      payload: planar,
      rawLen: indices.length,
      geometry: { width: t.width, height: t.height, bpp: 4, layout: "planar" },
      composed: indices,
      consumer: t.consumer,
      addr_mode: "byte",
    });
    consumers.push({ id: t.consumer, kind: "geom", addr_mode: "byte", region: t.id });
  }
  const px = payloadFor("pixels4bpp", rng, plan.pixels).pixels;
  pushRegion({
    id: plan.pixels.id,
    class: "pixels",
    codec: "pixels4bpp",
    payload: px,
    rawLen: px.length,
    geometry: { width: 8, height: plan.pixels.length / 8, bpp: 4, layout: "linear" },
    composed: px,
    consumer: plan.pixels.consumer,
    addr_mode: "byte",
  });
  consumers.push({ id: plan.pixels.consumer, kind: "pixels", addr_mode: "byte", region: plan.pixels.id });

  for (const tb of plan.tables) {
    const payload = Buffer.alloc(tb.entries * 4);
    for (let i = 0; i < tb.entries; i += 1) {
      payload.writeUInt16BE(0x6000 | (rng() & 0x3f00), i * 4);
      payload.writeInt16BE((rng() % 2 === 0 ? 1 : -1) * (8 + (rng() % 64)), i * 4 + 2);
    }
    pushRegion({
      id: tb.id,
      class: "table",
      codec: "branch-table",
      payload,
      rawLen: 0,
      entries: tb.entries,
      consumer: tb.consumer,
      addr_mode: "byte",
    });
    consumers.push({ id: tb.consumer, kind: "table", addr_mode: "byte", region: tb.id });
  }

  // enderecamento: toda regiao comeca em offset par; o pad de alinhamento fica
  // FORA do payload declarado no cabecalho, senao o decoder veria bytes a mais
  const HEADER_LEN = 20;
  let cursor = HEADER_LEN;
  for (const r of regions) {
    r.byte_addr = cursor;
    cursor += REGION_HEADER_LEN + r.payload.length;
    r.pad = cursor % 2;
    cursor += r.pad;
  }
  const dirOffset = cursor;
  const dirEntries = consumers.map((c) => {
    const r = regions.find((x) => x.id === c.region);
    const target = c.addr_mode === "word" ? r.byte_addr >> 1 : r.byte_addr;
    return {
      kind_id: CLASS[c.kind] ?? CLASS.stream,
      addr_mode: c.addr_mode === "word" ? 1 : 0,
      id: c.id.slice(0, 4),
      target,
      aux: 0,
    };
  });

  // alvos de fluxo verdadeiros: desplazamentos limitados para cair dentro do
  // fixture, em endereco par, e nunca sobre a propria tabela
  for (const r of regions.filter((x) => x.class === "table")) {
    r.targets = [];
    for (let i = 0; i < r.entries; i += 1) {
      const from = r.byte_addr + REGION_HEADER_LEN + i * 4;
      r.payload.writeUInt16BE(0x6000 | ((i * 7) & 0x1f00), i * 4);
      let disp = ((rng() % 96) + 8) * (rng() % 2 === 0 ? 1 : -1);
      disp -= disp % 2;
      let to = from + 2 + disp;
      while (to < HEADER_LEN || to % 2 !== 0) {
        disp += 2;
        to = from + 2 + disp;
      }
      while (to >= dirOffset) {
        disp -= 2;
        to = from + 2 + disp;
      }
      r.payload.writeInt16BE(disp, i * 4 + 2);
      r.targets.push({
        from_byte_addr: from,
        to_byte_addr: to,
        opcode: `60${((i * 7) & 0x1f).toString(16).padStart(2, "0")} (BRA.W d16)`,
      });
    }
  }

  // falsos alvos plantados DENTRO da regiao de pixels: bytes que parecem
  // `BRA.B d8` mas sao dados de imagem, sem nenhuma referencia real
  const pxRegion = regions.find((r) => r.id === plan.pixels.id);
  const falseTargets = [];
  let slot = 0;
  for (let i = 0; i < plan.pixels.false_branches; i += 1) {
    if (slot + 2 > pxRegion.payload.length - 2) slot = 0;
    const from = pxRegion.byte_addr + REGION_HEADER_LEN + slot;
    const disp = 16 + i * 8;
    pxRegion.payload[slot] = 0x60;
    pxRegion.payload[slot + 1] = disp;
    falseTargets.push({
      from_byte_addr: from,
      to_byte_addr: from + 2 + disp,
      opcode: "60 xx (BRA.B d8)",
      inside_region: pxRegion.id,
    });
    slot += 2 + ((rng() % 4) * 2);
    if (slot % 2 !== 0) slot += 1;
  }

  // serializacao
  const parts = [];
  for (const r of regions) parts.push(buildRegionHeader(r), r.payload, Buffer.alloc(r.pad));
  const header = Buffer.alloc(HEADER_LEN);
  header.write(CONTAINER_MAGIC, 0, "ascii");
  header.writeUInt16BE(CONTAINER_VERSION, 8);
  header.writeUInt16BE(dirEntries.length, 10);
  header.writeUInt32BE(dirOffset, 12);
  header.writeUInt32BE(dirOffset + dirEntries.length * DIR_ENTRY_LEN, 16);
  const image = Buffer.concat([header, ...parts, buildDirectory(dirEntries)]);
  if (image.length !== dirOffset + dirEntries.length * DIR_ENTRY_LEN) {
    throw new Error("autor: layout do fixture nao bate com o dir_offset");
  }

  const truth = {
    set,
    seed_sha256: sha256(Buffer.from(seed, "utf8")),
    fixture_sha256: sha256(image),
    fixture_len: image.length,
    dir_offset: dirOffset,
    dir_entries: dirEntries.length,
    regions: regions.map((r) => ({
      id: r.id,
      byte_addr: r.byte_addr,
      class: r.class,
      codec: r.codec,
      payload_len: r.payload.length,
      align_pad: r.pad,
      raw_len: r.rawLen,
      referenced_by: r.consumer ? [r.consumer] : [],
      output:
        r.class === "stream"
          ? { byte_len: r.rawLen, sha256: sha256(r.raw) }
          : r.class === "geom" || r.class === "pixels"
            ? { byte_len: r.composed.length, sha256: sha256(r.composed) }
            : null,
      geometry: r.geometry ?? null,
      flow_targets: r.targets ?? [],
    })),
    consumers: consumers.map((c) => ({
      id: c.id,
      kind: c.kind,
      addr_mode: c.addr_mode,
      target_byte_addr: regions.find((r) => r.id === c.region).byte_addr,
    })),
    negatives: {
      unreferenced_streams: plan.decoys.map((d) => ({
        id: d.id,
        byte_addr: regions.find((r) => r.id === d.id).byte_addr,
        codec: d.codec,
      })),
      false_flow_targets: falseTargets,
    },
    counts: {
      stream_regions_referenced: plan.streams.length,
      stream_regions_unreferenced: plan.decoys.length,
      geometry_blocks: plan.tiles.length,
      branch_tables: plan.tables.length,
      flow_targets: plan.tables.reduce((a, t) => a + t.entries, 0),
      primary_items: plan.streams.length + plan.tiles.length + plan.tables.length,
      negative_items: plan.decoys.length + plan.pixels.false_branches,
    },
  };

  return { image, truth };
}
