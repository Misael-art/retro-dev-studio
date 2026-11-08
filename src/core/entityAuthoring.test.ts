import { describe, expect, it } from "vitest";
import { resolvePrimaryAuthoringSurface } from "./entityAuthoring";
import type { Entity } from "./ipc/sceneService";

describe("R2 primary authoring gesture", () => {
  it("opens sprite art even when the object has logic, while retaining explicit logic access", () => {
    const entity = { components: { sprite: { asset: "hero.png" }, logic: { graph: "{\"nodes\":[]}" } } } as Entity;
    expect(resolvePrimaryAuthoringSurface(entity)).toBe("artstudio");
    expect(resolvePrimaryAuthoringSurface({ components: { logic: entity.components.logic } } as Entity)).toBe("logic");
    expect(resolvePrimaryAuthoringSurface({ components: { tilemap: { tileset: "sky.png" }, sprite: entity.components.sprite } } as Entity)).toBe("tilemap");
  });
});
