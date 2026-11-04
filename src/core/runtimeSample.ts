import { emulatorReadMemory } from "./ipc/emulatorService";
import type { RuntimeEntitySample, RuntimeLink } from "./runtimeLink";

/** Palavra do System RAM observado pelo core; não altera o jogo. */
export async function readRuntimeWord(address: number, signed: boolean): Promise<number> {
  const result = await emulatorReadMemory(2, address & 0xffff, 2);
  if (!result.ok || !result.data || result.data.length < 2) {
    throw new Error(`Leitura de RAM falhou em ${address.toString(16)}`);
  }
  const word = result.data[0] | (result.data[1] << 8);
  return signed && word > 0x7fff ? word - 0x10000 : word;
}

export async function sampleRuntimeEntities(link: RuntimeLink): Promise<RuntimeEntitySample[]> {
  const out: RuntimeEntitySample[] = [];
  for (const entity of link.entities) {
    out.push({
      entity_id: entity.entity_id,
      x: await readRuntimeWord(entity.symbols.x, true),
      y: await readRuntimeWord(entity.symbols.y, true),
      anim: entity.symbols.anim !== null ? await readRuntimeWord(entity.symbols.anim, false) : null,
      frame: entity.symbols.frame !== null ? await readRuntimeWord(entity.symbols.frame, false) : null,
    });
  }
  return out;
}
