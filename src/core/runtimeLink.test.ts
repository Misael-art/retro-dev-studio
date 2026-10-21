import { describe, expect, it } from "vitest";

import type { Scene } from "./ipc/sceneService";
import {
  RUNTIME_LINK_SCHEMA,
  checkRuntimeNavigation,
  clientToNative,
  hitTest,
  parseRuntimeLink,
  runtimeCandidates,
  type RuntimeLink,
} from "./runtimeLink";

const link: RuntimeLink = {
  schema: RUNTIME_LINK_SCHEMA,
  target: "megadrive",
  rom_sha256: "aa",
  generated_source_sha256: "cc",
  limitations: [],
  tilemaps: [{ entity_id: "ground", x: 0, y: 160, width_px: 320, height_px: 64 }],
  entities: [
    {
      entity_id: "ken",
      origin: "mugen",
      var_name: "spr_ken",
      frame_width: 96,
      frame_height: 112,
      pivot: { x: 48, y: 104 },
      symbols: { x: 1, y: 2, anim: 3, frame: 4 },
      animations: ["action_0", "action_200"],
      occurrences: { action_0: ["o1"], action_200: ["o1", "o2", "o3"] },
      frame_offsets: { action_0: [[0, 0]], action_200: [[2, 2], [18, 2], [2, 2]] },
      asset: "a.png",
      asset_sha256: "sheet",
      occurrence_images: { action_0: [[0, -1, -1]], action_200: [[1, -1, -1], [2, -1, -1], [1, -1, -1]] },
    },
    {
      entity_id: "dummy",
      origin: "mugen",
      var_name: "spr_ken__dummy",
      frame_width: 96,
      frame_height: 112,
      pivot: { x: 48, y: 104 },
      symbols: { x: 5, y: 6, anim: 7, frame: 8 },
      animations: ["action_0", "action_200"],
      occurrences: { action_0: ["o1"], action_200: ["o1", "o2", "o3"] },
      frame_offsets: { action_0: [[0, 0]], action_200: [[2, 2], [18, 2], [2, 2]] },
    },
  ],
};

const scene = {
  entities: [
    {
      entity_id: "ken",
      transform: { x: 0, y: 0 },
      components: {
        sprite: {
          asset: "a.png",
          frame_width: 96,
          frame_height: 112,
          animations: {
            action_0: { frames: [0], fps: 1, loop: true, occurrence_ids: ["o1"] },
            action_200: { frames: [1, 2, 1], fps: 1, loop: true, occurrence_ids: ["o1", "o2", "o3"] },
          },
        },
      },
    },
    { entity_id: "dummy", transform: { x: 0, y: 0 }, components: {} },
    { entity_id: "ground", transform: { x: 0, y: 0 }, components: {} },
  ],
} as unknown as Pick<Scene, "entities">;

describe("runtimeLink", () => {
  it("maps clicks through border, scale and letterboxed size to native pixels", () => {
    const canvas = { left: 100, top: 50, clientLeft: 1, clientTop: 1, clientWidth: 640, clientHeight: 448, width: 320, height: 224 };
    expect(clientToNative({ clientX: 101, clientY: 51 }, canvas)).toEqual({ x: 0, y: 0 });
    expect(clientToNative({ clientX: 101 + 639, clientY: 51 + 447 }, canvas)).toEqual({ x: 319, y: 223 });
    expect(clientToNative({ clientX: 100, clientY: 51 }, canvas)).toBeNull();
    // Mesmo canvas exibindo um quadro 256x224 (outra resolução nativa) com escala 3.
    const narrow = { ...canvas, clientWidth: 768, clientHeight: 672, width: 256, height: 224 };
    expect(clientToNative({ clientX: 101 + 384, clientY: 51 + 336 }, narrow)).toEqual({ x: 128, y: 112 });
  });

  it("builds candidates from RAM samples with per-occurrence offsets and orders overlaps front to back", () => {
    const candidates = runtimeCandidates(link, [
      { entity_id: "ken", x: 40, y: 60, anim: 1, frame: 1 },
      { entity_id: "dummy", x: 100, y: 60, anim: 0, frame: 0 },
    ]);
    const ken = candidates.find((c) => c.entity_id === "ken")!;
    expect(ken).toMatchObject({ animation: "action_200", occurrenceId: "o2", rect: { x: 58, y: 62, w: 96, h: 112 } });
    const overlap = hitTest(candidates, { x: 120, y: 165 });
    expect(overlap.map((c) => c.entity_id)).toEqual(["ken", "dummy", "ground"]);
    expect(hitTest(candidates, { x: 5, y: 5 })).toEqual([]);
  });

  it("swapped target is detected: same point, different occurrence picks a different id", () => {
    const a = runtimeCandidates(link, [{ entity_id: "ken", x: 40, y: 60, anim: 1, frame: 0 }])[1];
    const b = runtimeCandidates(link, [{ entity_id: "ken", x: 40, y: 60, anim: 1, frame: 2 }])[1];
    expect(a.occurrenceId).toBe("o1");
    expect(b.occurrenceId).toBe("o3");
  });

  it("refuses stale build, other session, advanced frame and changed resources", () => {
    const candidate = runtimeCandidates(link, [{ entity_id: "ken", x: 40, y: 60, anim: 1, frame: 2 }])[1];
    const sampledAt = { romSha256: "aa", coreEpoch: 3, renderedFrames: 900 };
    const current = { romSha256: "aa", coreEpoch: 3, renderedFrames: 900, paused: true };
    const assetHashes = { "a.png": "sheet" };
    expect(checkRuntimeNavigation({ link, sampledAt, current, candidate, scene, assetHashes })).toEqual({ ok: true });
    expect(checkRuntimeNavigation({ link, sampledAt, current: { ...current, romSha256: "bb" }, candidate, scene }).ok).toBe(false);
    expect(checkRuntimeNavigation({ link, sampledAt, current: { ...current, coreEpoch: 4 }, candidate, scene }).ok).toBe(false);
    expect(checkRuntimeNavigation({ link, sampledAt, current: { ...current, renderedFrames: 901 }, candidate, scene }).ok).toBe(false);
    expect(checkRuntimeNavigation({ link, sampledAt, current: { ...current, paused: false }, candidate, scene }).ok).toBe(false);
    const renamed = { entities: [{ ...scene.entities[0], entity_id: "ken_renamed" }] } as unknown as Pick<Scene, "entities">;
    expect(checkRuntimeNavigation({ link, sampledAt, current, candidate, scene: renamed }).ok).toBe(false);
    const fewer = JSON.parse(JSON.stringify(scene));
    fewer.entities[0].components.sprite.animations.action_200.occurrence_ids = ["o1", "o2"];
    fewer.entities[0].components.sprite.animations.action_200.frames = [1, 2];
    expect(checkRuntimeNavigation({ link, sampledAt, current, candidate, scene: fewer }).ok).toBe(false);
  });

  it("rejects unknown link schemas", () => {
    expect(parseRuntimeLink({ ...link, schema: "x" })).toBeNull();
    expect(parseRuntimeLink(link)?.entities).toHaveLength(2);
  });
});

describe("runtimeLink content identity (stale candidate after asset/image change)", () => {
  const withIdentity: RuntimeLink = {
    ...link,
    entities: link.entities.map((e) => ({
      ...e,
      asset: "assets/sprites/ken.png",
      asset_sha256: "sheet-a",
      occurrence_images: { action_0: [[0, 0, 0]], action_200: [[1, 200, 1], [2, 200, 2], [1, 200, 1]] },
    })),
  };
  const sampledAt = { romSha256: "aa", coreEpoch: 3, renderedFrames: 900 };
  const current = { romSha256: "aa", coreEpoch: 3, renderedFrames: 900, paused: true };
  const candidate = () => runtimeCandidates(withIdentity, [{ entity_id: "ken", x: 40, y: 60, anim: 1, frame: 2 }])[1];
  const project = (mutate: (sprite: Record<string, unknown>) => void, displayName?: string) => {
    const copy = JSON.parse(JSON.stringify(scene));
    const sprite = copy.entities[0].components.sprite;
    sprite.asset = "assets/sprites/ken.png";
    sprite.animations.action_200.mugen_frames = [
      { group: 200, image: 1, duration: 2 },
      { group: 200, image: 2, duration: 2 },
      { group: 200, image: 1, duration: 2 },
    ];
    if (displayName) copy.entities[0].display_name = displayName;
    mutate(sprite);
    return copy as Pick<Scene, "entities">;
  };
  const check = (s: Pick<Scene, "entities">, assetHashes: Record<string, string> = { "assets/sprites/ken.png": "sheet-a" }) =>
    checkRuntimeNavigation({ link: withIdentity, sampledAt, current, candidate: candidate(), scene: s, assetHashes });

  it("accepts the unchanged project and a pure display-name rename", () => {
    expect(check(project(() => {}))).toEqual({ ok: true });
    expect(check(project(() => {}, "Ken renomeado"))).toEqual({ ok: true });
  });

  it("refuses changed content at the SAME path with the same ids, and accepts restored content", () => {
    const same = project(() => {});
    expect(check(same, { "assets/sprites/ken.png": "sheet-edited" })).toMatchObject({ ok: false });
    expect(check(same, { "assets/sprites/ken.png": "sheet-a" })).toEqual({ ok: true });
  });

  it("asks for the current content hash even when the path is unchanged", () => {
    expect(check(project(() => {}), {})).toMatchObject({ ok: false, needsAssetHash: "assets/sprites/ken.png" });
  });

  it("refuses when sprite.asset now points to other content, keeping ids", () => {
    const s = project((sprite) => (sprite.asset = "assets/sprites/ryu.png"));
    const result = check(s, { "assets/sprites/ryu.png": "sheet-b" });
    expect(result.ok).toBe(false);
  });

  it("accepts a moved/renamed asset with identical content", () => {
    const s = project((sprite) => (sprite.asset = "assets/chars/ken_moved.png"));
    expect(check(s, { "assets/chars/ken_moved.png": "sheet-a" })).toEqual({ ok: true });
  });

  it("asks for the content hash instead of guessing when the path changed", () => {
    const s = project((sprite) => (sprite.asset = "assets/chars/ken_moved.png"));
    expect(check(s)).toMatchObject({ ok: false, needsAssetHash: "assets/chars/ken_moved.png" });
  });

  it("refuses when the occurrence now shows another image with the same occurrence id", () => {
    const changedFrame = project((sprite) => {
      const anim = (sprite.animations as Record<string, { frames: number[] }>).action_200;
      anim.frames = [1, 2, 3];
    });
    expect(check(changedFrame).ok).toBe(false);
    const changedSource = project((sprite) => {
      const anim = (sprite.animations as Record<string, { mugen_frames: Array<{ group: number; image: number }> }>).action_200;
      anim.mugen_frames[2] = { group: 200, image: 7 } as never;
    });
    expect(check(changedSource).ok).toBe(false);
  });
});

describe("runtimeLink camera", () => {
  it("subtracts the sampled camera from world rectangles (sprites and scenery)", () => {
    const c = runtimeCandidates(link, [{ entity_id: "ken", x: 400, y: 60, anim: 0, frame: 0 }], { x: 300, y: 8 });
    expect(c.find((x) => x.entity_id === "ken")!.rect).toMatchObject({ x: 100, y: 52 });
    expect(c.find((x) => x.entity_id === "ground")!.rect).toMatchObject({ x: -300, y: 152 });
    expect(hitTest(c, { x: 101, y: 60 }).map((x) => x.entity_id)).toContain("ken");
    expect(hitTest(c, { x: 401, y: 60 }).map((x) => x.entity_id)).not.toContain("ken");
  });
});

describe("collision and audio layers", () => {
  const boxed: RuntimeLink = {
    ...link,
    collision: { tile_width: 8, tile_height: 8, width: 40, height: 28, solid: [41] },
    entities: link.entities.map((e) => ({
      ...e,
      occurrence_boxes: { action_0: [{ attack: [], body: [[-24, -89, 24, 1]] }], action_200: [{ attack: [], body: [] }, { attack: [[18, -83, 68, -68]], body: [] }, { attack: [], body: [] }] },
      events: { action_200: [{ id: "ev1", occurrence: "o2", tick: 0, sound: "hit" }] },
    })),
  };
  it("draws the current occurrence boxes at axis minus camera, plus solid cells", async () => {
    const { collisionBoxes } = await import("./runtimeLink");
    const boxes = collisionBoxes(boxed, [{ entity_id: "ken", x: 100, y: 50, anim: 1, frame: 1 }], { x: 10, y: 0 });
    const attack = boxes.find((b) => b.kind === "attack")!;
    // eixo = (100+48-10, 50+104) ; caixa 18..68 x -83..-68
    expect(attack.rect).toEqual({ x: 156, y: 71, w: 50, h: 15 });
    expect(boxes.find((b) => b.kind === "solid")!.rect).toEqual({ x: 8 - 10, y: 8, w: 8, h: 8 });
    expect(collisionBoxes(boxed, [{ entity_id: "ken", x: 100, y: 50, anim: 1, frame: 0 }]).some((b) => b.kind === "attack")).toBe(false);
  });
  it("attributes the last sound event using the animation that fired it", async () => {
    const { audioEventRow } = await import("./runtimeLink");
    const ken = boxed.entities[0];
    expect(audioEventRow(ken, 1, 3, 0)).toMatchObject({ fired: 3, last: { id: "ev1", sound: "hit" } });
    expect(audioEventRow(ken, 0, 3, 0).last).toBeNull();
    expect(audioEventRow(ken, 0xffff, 0, 0xffff).last).toBeNull();
  });
});
