/** Identifica a fase inicial desconhecida da captura a partir de pelo menos
 * dois ciclos. Uma pose precisa produzir os mesmos pixels em cada aparição,
 * e duas poses distinguíveis não podem receber o mesmo recorte. */
export function matchPoseCadence(hashes, poses, durations) {
  const cycle = poses.flatMap((pose, index) => Array(durations[index]).fill(pose));
  if (!cycle.length || hashes.length < 2 * cycle.length) {
    throw new Error("A amostra precisa cobrir pelo menos dois ciclos completos.");
  }
  for (let phase = 0; phase < cycle.length; phase += 1) {
    const byPose = new Map();
    const byHash = new Map();
    const matches = hashes.every((hash, tick) => {
      const pose = cycle[(phase + tick) % cycle.length];
      if (!hash || (byPose.has(pose) && byPose.get(pose) !== hash)
        || (byHash.has(hash) && byHash.get(hash) !== pose)) return false;
      byPose.set(pose, hash);
      byHash.set(hash, pose);
      return true;
    });
    if (matches) return { phase, period: cycle.length, hashesByPose: Object.fromEntries(byPose) };
  }
  throw new Error(`Cadência dos pixels incompatível com [${durations.join(", ")}] ticks.`);
}

// Procura no recorte nativo o desenho opaco ao redor do pé marcado no atlas.
// Cores iguais na fonte precisam coincidir no core, mesmo se a conversão de
// CRAM em RGB usar outros níveis. Pixels transparentes deixam o cenário livre.
export function locatePoseFoot(atlas, image, crop) {
  const anchors = [[14, 27], [13, 26]];
  const [ax, ay] = anchors[image];
  if (atlas.channels !== 4 || atlas.width < (image + 1) * 32 || atlas.height < 32
    || crop.length !== 32 * 32 * 4) throw new Error("Dimensões incompatíveis na leitura do pé.");
  const pattern = [];
  for (let dy = -7; dy <= 0; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const offset = ((ay + dy) * atlas.width + image * 32 + ax + dx) * 4;
      if (atlas.pixels[offset + 3] === 255) {
        pattern.push({ dx, dy, color: atlas.pixels.readUIntBE(offset, 3) });
      }
    }
  }
  const matches = [];
  for (let y = 7; y < 32; y += 1) {
    for (let x = 4; x < 28; x += 1) {
      const bySource = new Map();
      const byOutput = new Map();
      const matchesPattern = pattern.every(({ dx, dy, color }) => {
        const pixel = crop.readUIntBE(((y + dy) * 32 + x + dx) * 4, 3);
        if ((bySource.has(color) && bySource.get(color) !== pixel)
          || (byOutput.has(pixel) && byOutput.get(pixel) !== color)) return false;
        bySource.set(color, pixel);
        byOutput.set(pixel, color);
        return true;
      });
      if (matchesPattern) matches.push([x, y]);
    }
  }
  if (matches.length !== 1) throw new Error(`O pé da imagem ${image} teve ${matches.length} correspondências no core.`);
  return matches[0];
}
