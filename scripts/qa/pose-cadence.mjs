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
