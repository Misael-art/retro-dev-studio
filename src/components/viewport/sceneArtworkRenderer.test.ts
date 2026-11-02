import { afterEach, expect, it, vi } from "vitest";
import { getTilemapArtwork } from "./sceneArtworkRenderer";
import { TILEMAP_CELL_EMPTY } from "../../core/tilemapCells";

afterEach(() => vi.restoreAllMocks());

it("preserves the native base picture and clears explicit empty cells on a separate plane", () => {
  const ctx = { imageSmoothingEnabled: true, drawImage: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const source = document.createElement("canvas"); source.width = 16; source.height = 8;
  const map = { tileset: "tiles.png", map_width: 3, map_height: 1, cells: [0, TILEMAP_CELL_EMPTY, 2] };
  const artwork = getTilemapArtwork({ status: "loaded", source, width: 16, height: 8 }, map);
  expect(artwork).not.toBe(source);
  expect([artwork?.width, artwork?.height]).toEqual([24, 8]);
  expect(ctx.drawImage.mock.calls[0]).toEqual([source, 0, 0]);
  expect(ctx.clearRect).toHaveBeenCalledWith(8, 0, 8, 8);
  expect(ctx.drawImage).toHaveBeenLastCalledWith(source, 8, 0, 8, 8, 16, 0, 8, 8);
});
