import { afterEach, expect, it, vi } from "vitest";
import { drawTilemapArtwork, getTilemapArtwork } from "./sceneArtworkRenderer";
import { TILEMAP_CELL_EMPTY } from "../../core/tilemapCells";

afterEach(() => vi.restoreAllMocks());

it("keeps a large world visible without allocating a whole-world composition canvas", () => {
  const allocation=vi.spyOn(HTMLCanvasElement.prototype,"getContext");
  const ctx={drawImage:vi.fn(),save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn()};
  const source={} as CanvasImageSource;
  drawTilemapArtwork(ctx as unknown as CanvasRenderingContext2D,
    {status:"loaded",source,width:8192,height:4096},
    {tileset:"world.png",map_width:1024,map_height:512},-128,-64);
  expect(allocation).not.toHaveBeenCalled();
  expect(ctx.rect).toHaveBeenCalledWith(-128,-64,8192,4096);
  expect(ctx.drawImage).toHaveBeenCalledWith(source,-128,-64,8192,4096);
  expect(ctx.restore).toHaveBeenCalledOnce();
});

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
