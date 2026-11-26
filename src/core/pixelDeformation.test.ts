import { describe, expect, it } from "vitest";
import { createPixelDoc, deserializePixelDoc, serializePixelDoc } from "./pixelEditor";
import { imageAnimations } from "./imageIngress";
import { deformSpriteArea } from "./pixelDeformation";
import type { AnimationDef } from "./ipc/sceneService";

const scope = { frame: 0, layer: 0, rect: { x: 1, y: 1, w: 2, h: 2 } };
const box = { frame: 0, x: 0, y: 0, width: 2, height: 2, kind: "attack" as const };
const passo: AnimationDef = { frames: [0, 1, 0], frame_durations: [2, 3, 4], fps: 12, loop: true,
  hitboxes: [box, { ...box, occurrence_id: "o3" }] };
const binding = { animation: "passo", occurrence: "o3", animations: { passo, idle: { frames: [0, 1], fps: 8, loop: true } } };
function fixture() {
  const doc = createPixelDoc(8, 8, { frames: 2 });
  for (const [i, frame] of doc.frames.entries()) {
    const cel = frame.cels[0];
    cel.set([1 + i, 2], 9); cel.set([3, 4], 17); cel[0] = 15;
  }
  return doc;
}

describe("deformação de sprite indexado", () => {
  it("encolhe por vizinho mais próximo e mantém pixels, paleta e quadros fora da seleção", () => {
    const doc = fixture();
    const next = deformSpriteArea(doc, scope, { width: 1, height: 1, shear: 0 }, false).doc;
    const expected = doc.frames[0].cels[0].slice(); expected.set([4, 0], 9); expected.set([0, 0], 17);
    expect(next.frames[0].cels[0]).toEqual(expected);
    expect(next.frames[1]).toBe(doc.frames[1]);
    expect(next.palettes).toBe(doc.palettes);
  });
  it("expande e inclina a base com recorte e preserva amostras transparentes sobre o destino", () => {
    const doc = fixture(), cel = doc.frames[0].cels[0]; cel[10] = 0; cel[12] = 7;
    const out = deformSpriteArea(doc, scope, { width: 4, height: 2, shear: -2 }, false).doc.frames[0].cels[0];
    expect([...out.slice(9, 13)]).toEqual([1, 1, 0, 7]);
    expect([...out.slice(16, 20)]).toEqual([3, 4, 4, 0]);
    expect(cel[17]).toBe(3);
    expect(deformSpriteArea(doc, scope, {width:2,height:2,shear:0}, false).doc).toBe(doc);
  });
  it("espelha nos dois eixos e gira os índices em torno da própria seleção", () => {
    const doc = fixture();
    const sample = (size: Parameters<typeof deformSpriteArea>[2]) => {
      const out = deformSpriteArea(doc, scope, size, false).doc.frames[0].cels[0];
      return [out[9], out[10], out[17], out[18]];
    };
    const base = { width: 2, height: 2, shear: 0 };
    expect(sample({ ...base, mirror: "horizontal" })).toEqual([2,1,4,3]);
    expect(sample({ ...base, mirror: "vertical" })).toEqual([3,4,1,2]);
    expect(sample({ ...base, quarterTurn: true })).toEqual([3,1,4,2]);
  });
  it("curva o centro suavemente conservando os extremos e os índices de cor", () => {
    const doc = fixture(), cel = doc.frames[0].cels[0]; cel.fill(0);
    for (let y=1; y<=5; y++) cel[y*8+1] = 4;
    const out = deformSpriteArea(doc, {...scope, rect:{x:1,y:1,w:1,h:5}}, {width:1,height:5,shear:0,bend:2}, false).doc.frames[0].cels[0];
    expect([...out.keys()].filter(i => out[i])).toEqual([9,19,27,35,41]);
  });
  it("isola uma ocorrência repetida e conserva a variante, durações e caixas depois de reabrir", () => {
    const doc = fixture(), changed = deformSpriteArea(doc, scope, {width:1,height:2,shear:1}, false, binding, doc);
    const saved = deserializePixelDoc(serializePixelDoc(changed.doc));
    expect(changed.currentFrame).toBe(2);
    expect(changed.doc.frames.slice(0, 2)).toEqual(doc.frames);
    const mapped = imageAnimations(binding.animations, saved, doc);
    expect(mapped.passo.frames).toEqual([0, 1, 2]);
    expect(mapped.passo.hitboxes).toEqual([box, {...box, frame:2}, {...box, frame:2, occurrence_id:"o3"}]);
    expect(mapped.passo.frame_durations).toEqual([2, 3, 4]);
    expect(mapped.idle).toEqual(binding.animations.idle);
    expect(imageAnimations(mapped, saved, saved)).toEqual(mapped);
    expect(imageAnimations(mapped, doc, saved).passo).toEqual({ ...passo, occurrence_ids:["o1","o2","o3"] });
    expect(() => imageAnimations({ ...binding.animations, passo: { ...passo, frames: [0, 1, 1] } }, saved, doc)).toThrow(/mudaram/);
  });
  it("transforma uma vez por imagem na sequência e conserva outras animações que usam o mesmo atlas", () => {
    const doc = fixture(), shape = {width:4,height:2,shear:1};
    const changed = deformSpriteArea(doc, scope, shape, true, binding, doc);
    const animations = imageAnimations(binding.animations, changed.doc, doc);
    expect(animations.passo.frames).toEqual([2, 3, 2]);
    expect(animations.idle.frames).toEqual([0, 1]);
    expect(changed.doc.frames.length).toBe(4);
    expect(changed.doc.frames[2].cels[0]).toEqual(deformSpriteArea(doc, scope, shape, false).doc.frames[0].cels[0]);
    expect(() => deformSpriteArea(doc, scope, shape, false, { ...binding, occurrence:"o2" }, doc)).toThrow(/quadro/);
  });
});
