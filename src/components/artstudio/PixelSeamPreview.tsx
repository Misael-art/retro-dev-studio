import { useEffect, useMemo, useRef, useState } from "react";
import { compositeFrame, mdLevelTo8, pixelIndex, pixelLine, type PixelDoc, type PixelRect } from "../../core/pixelEditor";

const TILE_SIZE = 8;

function wrap(value: number, size: number): number {
  return ((Math.floor(value) % size) + size) % size;
}

/** Repeat the displayed indexed frame and keep edits on the source document. */
export default function PixelSeamPreview({ doc, frame, onSelectTile }: {
  doc: PixelDoc;
  frame: number;
  onSelectTile: (rect: PixelRect) => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const [scroll, setScroll] = useState<"still" | "horizontal" | "vertical">("still");
  const [source, setSource] = useState({ x: 0, y: 0 });
  const { width, height } = doc;
  const pixels = useMemo(() => compositeFrame(doc, frame), [doc, frame]);
  const selectedPixel = pixels[wrap(source.y, height) * width + wrap(source.x, width)];

  useEffect(() => {
    const preview = canvas.current;
    const surface = preview?.getContext("2d");
    if (!preview || !surface) return;
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    const tileSurface = tile.getContext("2d");
    if (!tileSurface) return;
    const image = tileSurface.createImageData(width, height);
    const colors = doc.palettes.map((bank) => bank.map((color) => color.map(mdLevelTo8)));
    for (const [index, value] of pixels.entries()) {
      const slot = pixelIndex(value);
      if (!slot) continue;
      const [r, g, b] = colors[pixelLine(value)][slot];
      const destination = index * 4;
      image.data[destination] = r;
      image.data[destination + 1] = g;
      image.data[destination + 2] = b;
      image.data[destination + 3] = 255;
    }
    tileSurface.putImageData(image, 0, 0);
    const pattern = surface.createPattern(tile, "repeat");
    if (!pattern) return;
    const draw = () => {
      const { x, y } = offset.current;
      surface.setTransform(1, 0, 0, 1, 0, 0);
      surface.clearRect(0, 0, width * 3, height * 3);
      surface.translate(-x, -y);
      surface.imageSmoothingEnabled = false;
      surface.fillStyle = pattern;
      surface.fillRect(x, y, width * 3, height * 3);
    };
    draw();
    if (scroll === "still") return;
    const start = performance.now();
    const initial = offset.current;
    const timer = window.setInterval(() => {
      // One source pixel every 50 ms. A small preview is independent of the document dimensions.
      const distance = Math.floor((performance.now() - start) / 50);
      offset.current = scroll === "horizontal"
        ? { ...initial, x: wrap(initial.x + distance, width) }
        : { ...initial, y: wrap(initial.y + distance, height) };
      draw();
    }, 50);
    return () => window.clearInterval(timer);
  }, [doc.palettes, pixels, height, scroll, width]);

  function selectSource(x: number, y: number) {
    const next = { x: wrap(x, width), y: wrap(y, height) };
    setSource(next);
    onSelectTile({ x: Math.floor(next.x / TILE_SIZE) * TILE_SIZE, y: Math.floor(next.y / TILE_SIZE) * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
  }

  return (
    <div className="space-y-2" data-testid="pixel-seam-preview">
      <p>Veja o quadro repetido em 3×3. Escolha um ponto para localizar o tile no editor.</p>
      <canvas ref={canvas} width={width * 3} height={height * 3} aria-label="Repetição 3×3 do cenário"
        data-testid="pixel-seam-canvas" className="h-auto max-w-full cursor-crosshair rounded bg-[#0b0f19] [image-rendering:pixelated]"
        style={{ width: `min(100%, ${Math.ceil(width / height * 192)}px)` }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          selectSource((event.clientX - rect.left) * width * 3 / rect.width + offset.current.x,
            (event.clientY - rect.top) * height * 3 / rect.height + offset.current.y);
        }} />
      <label className="flex flex-wrap items-center gap-2">
        Rolagem
        <select value={scroll} onChange={(event) => setScroll(event.target.value as typeof scroll)}
          className="rounded border border-[var(--rds-border-subtle)] bg-[var(--rds-surface-panel)] p-1">
          <option value="still">Pausada</option>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </label>
      <form className="flex flex-wrap items-end gap-1" onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        selectSource(Number(fields.get("x")), Number(fields.get("y")));
      }}>
        {(["x", "y"] as const).map((axis) => (
          <label key={axis} className="grid gap-1">
            {axis.toUpperCase()} de origem
            <input key={source[axis]} type="number" step="1" name={axis} required defaultValue={source[axis]} min={0} max={(axis === "x" ? width : height) - 1}
              className="w-16 rounded border border-[var(--rds-border-subtle)] bg-[var(--rds-surface-panel)] p-1" />
          </label>
        ))}
        <button type="submit" className="rounded border border-[var(--rds-border-subtle)] p-1">Localizar tile</button>
      </form>
      <p role="status" data-testid="pixel-seam-location">Tile ({Math.floor(source.x / TILE_SIZE)}, {Math.floor(source.y / TILE_SIZE)}) · pixel ({wrap(source.x, width)}, {wrap(source.y, height)}) · PAL{pixelLine(selectedPixel)} · índice {pixelIndex(selectedPixel)}
        {source.x === 0 ? " · borda esquerda" : source.x === width - 1 ? " · borda direita" : ""}
        {source.y === 0 ? " · borda superior" : source.y === height - 1 ? " · borda inferior" : ""}
      </p>
    </div>
  );
}
