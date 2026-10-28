import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MAX_SPRITES_PER_LINE,
  TILE,
  addFrame,
  addLayer,
  analyzeHardware,
  analyzeTiles,
  compositeFrame,
  constrainLine,
  createPixelDoc,
  deserializePixelDoc,
  drawDither,
  drawEllipse,
  drawRect,
  drawShade,
  drawStroke,
  exportSheetPng,
  flipCel,
  floodFill,
  masterPalette,
  mdColorToCss,
  moveFrame,
  moveLayer,
  normalizeRect,
  packPixel,
  paletteToC,
  pixelCss,
  pixelIndex,
  pixelLine,
  quantizeRgba,
  removeFrame,
  removeLayer,
  replaceAllColor,
  replaceCel,
  resLine,
  resizeDoc,
  rotateCel,
  sanitizeSymbol,
  serializePixelDoc,
  shiftCel,
  transformDoc,
  type MdColor,
  type PixelDoc,
  type PixelRect,
  type PixelTarget,
} from "../../core/pixelEditor";
import { loadPixelArtDoc, savePixelArtAsset } from "../../core/ipc/artStudioService";

export type PixelTool =
  | "pencil"
  | "eraser"
  | "bucket"
  | "replace"
  | "line"
  | "rect"
  | "ellipse"
  | "dither"
  | "lighten"
  | "select"
  | "move"
  | "picker";

export const PIXEL_TOOLS: { id: PixelTool; key: string; glyph: string; label: string; hint: string }[] = [
  { id: "pencil", key: "P", glyph: "✎", label: "Lápis", hint: "Esquerdo: cor primária · direito: secundária" },
  { id: "eraser", key: "E", glyph: "⌫", label: "Borracha", hint: "Torna o pixel transparente (índice 0)" },
  { id: "bucket", key: "B", glyph: "▨", label: "Balde", hint: "Preenche a área contígua da mesma cor" },
  { id: "replace", key: "A", glyph: "⇄", label: "Trocar cor", hint: "Troca todos os pixels da mesma cor no frame" },
  { id: "line", key: "L", glyph: "╱", label: "Reta", hint: "Shift: 0/45/90 graus" },
  { id: "rect", key: "R", glyph: "▭", label: "Retângulo", hint: "Shift: quadrado" },
  { id: "ellipse", key: "C", glyph: "◯", label: "Círculo", hint: "Shift: círculo perfeito" },
  { id: "dither", key: "D", glyph: "▚", label: "Dithering", hint: "Xadrez de primária e secundária" },
  { id: "lighten", key: "U", glyph: "☀", label: "Clarear", hint: "Esquerdo clareia, direito escurece (na mesma paleta)" },
  { id: "select", key: "S", glyph: "⬚", label: "Seleção", hint: "Recorte para mover, espelhar e girar" },
  { id: "move", key: "M", glyph: "✥", label: "Mover", hint: "Desloca a seleção ou o frame" },
  { id: "picker", key: "I", glyph: "⌖", label: "Conta-gotas", hint: "Pega a cor do canvas" },
];

const SIZE_PRESETS: [number, number][] = [
  [8, 8],
  [16, 16],
  [24, 24],
  [32, 32],
  [32, 48],
  [48, 48],
  [64, 64],
];
const PLANE_PRESETS: { label: string; size: [number, number] }[] = [
  { label: "H40 320×224", size: [320, 224] },
  { label: "H32 256×224", size: [256, 224] },
];
const LAYER_PRESETS = ["Personagem", "Sombra", "Efeito", "Contorno"];
const HISTORY_LIMIT = 80;

export interface PixelEditorSource {
  url: string;
  sourcePath: string;
  name: string;
  frameWidth: number;
  frameHeight: number;
  frames: number[];
}

interface PixelEditorProps {
  projectDir: string | null;
  source: PixelEditorSource | null;
  log: (level: "info" | "warn" | "error" | "success", message: string) => void;
  onSaved: (pngAbsolute: string) => void;
}

type Drag = {
  tool: PixelTool;
  value: number;
  secondary: number;
  right: boolean;
  start: [number, number];
  points: [number, number][];
  shift: boolean;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Imagem nao carregou: ${url}`));
    image.src = url;
  });
}

/** Le os frames da folha de origem, quantiza todos juntos numa linha de paleta. */
export async function importFramesFromSheet(source: PixelEditorSource, line: number, base: PixelDoc): Promise<{ doc: PixelDoc; warnings: string[] }> {
  const image = await loadImage(source.url);
  const fw = Math.max(1, source.frameWidth);
  const fh = Math.max(1, source.frameHeight);
  const columns = Math.max(1, Math.floor(image.naturalWidth / fw));
  const frames = source.frames.length > 0 ? source.frames : [0];
  const strip = document.createElement("canvas");
  strip.width = fw * frames.length;
  strip.height = fh;
  const ctx = strip.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponivel.");
  frames.forEach((frame, i) => {
    ctx.drawImage(image, (frame % columns) * fw, Math.floor(frame / columns) * fh, fw, fh, i * fw, 0, fw, fh);
  });
  const rgba = ctx.getImageData(0, 0, strip.width, strip.height).data;
  const result = quantizeRgba(rgba, strip.width, strip.height, line);
  let doc = createPixelDoc(fw, fh, { name: sanitizeSymbol(source.name), frames: frames.length, target: "sprite" });
  doc = { ...doc, palettes: base.palettes.map((p, i) => (i === line ? result.palette : p)) };
  doc = {
    ...doc,
    frames: doc.frames.map((frame, fi) => {
      const cel = new Uint8Array(doc.width * doc.height);
      for (let y = 0; y < fh; y += 1) for (let x = 0; x < fw; x += 1) cel[y * doc.width + x] = result.pixels[y * strip.width + fi * fw + x];
      return { ...frame, cels: [cel] };
    }),
  };
  return { doc, warnings: result.warnings };
}

export default function PixelEditor({ projectDir, source, log, onSaved }: PixelEditorProps) {
  const [doc, setDocState] = useState<PixelDoc>(() => createPixelDoc(32, 32));
  const [past, setPast] = useState<PixelDoc[]>([]);
  const [future, setFuture] = useState<PixelDoc[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [layerIndex, setLayerIndex] = useState(0);
  const [tool, setTool] = useState<PixelTool>("pencil");
  const [activeLine, setActiveLine] = useState(0);
  const [primary, setPrimary] = useState(packPixel(0, 1));
  const [secondary, setSecondary] = useState(packPixel(0, 2));
  const [brushSize, setBrushSize] = useState(1);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [filled, setFilled] = useState(false);
  const [lockTilePalette, setLockTilePalette] = useState(true);
  const [onion, setOnion] = useState(true);
  const [zoom, setZoom] = useState(12);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [selection, setSelection] = useState<PixelRect | null>(null);
  const [moveAll, setMoveAll] = useState(false);
  const [wrapMove, setWrapMove] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [showMaster, setShowMaster] = useState(false);
  const [fps, setFps] = useState(10);
  const [playing, setPlaying] = useState(true);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const frame = Math.min(frameIndex, doc.frames.length - 1);
  const layer = Math.min(layerIndex, doc.layers.length - 1);

  const docRef = useRef(doc);
  docRef.current = doc;
  const commit = useCallback((next: PixelDoc) => {
    const current = docRef.current;
    if (current === next) return;
    setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), current]);
    setFuture([]);
    docRef.current = next;
    setDocState(next);
    setSavedPath(null);
  }, []);
  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [docRef.current, ...f]);
    setDocState(past[past.length - 1]);
    setPast(past.slice(0, -1));
  }, [past]);
  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, docRef.current]);
    setDocState(future[0]);
    setFuture(future.slice(1));
  }, [future]);

  // Ajusta o zoom inteiro ao palco visivel sempre que o tamanho do canvas muda.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || stage.clientWidth === 0 || stage.clientHeight === 0) return;
    const fit = Math.floor(Math.min((stage.clientWidth - 24) / doc.width, (stage.clientHeight - 24) / doc.height));
    setZoom(Math.max(2, Math.min(48, fit)));
  }, [doc.width, doc.height]);

  const report = useMemo(() => analyzeHardware(doc, frame), [doc, frame]);

  // ── Desenho do canvas ──
  const composite = useMemo(() => {
    if (!preview) return compositeFrame(doc, frame);
    return compositeFrame(replaceCel(doc, frame, layer, preview), frame);
  }, [doc, frame, layer, preview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = doc.width * zoom;
    canvas.height = doc.height * zoom;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const cell = Math.max(4, Math.round(zoom / 2));
    for (let y = 0; y < canvas.height; y += cell)
      for (let x = 0; x < canvas.width; x += cell) {
        ctx.fillStyle = ((x + y) / cell) % 2 === 0 ? "#1e2433" : "#272e40";
        ctx.fillRect(x, y, cell, cell);
      }
    const paint = (pixels: Uint8Array, alpha: number) => {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < pixels.length; i += 1) {
        const css = pixelCss(doc, pixels[i]);
        if (!css) continue;
        ctx.fillStyle = css;
        ctx.fillRect((i % doc.width) * zoom, Math.floor(i / doc.width) * zoom, zoom, zoom);
      }
      ctx.globalAlpha = 1;
    };
    if (onion && doc.frames.length > 1) {
      if (frame > 0) paint(compositeFrame(doc, frame - 1), 0.22);
      if (frame < doc.frames.length - 1) paint(compositeFrame(doc, frame + 1), 0.12);
    }
    paint(composite, 1);
    // Tiles com mais de uma linha de paleta.
    for (const tile of analyzeTiles(doc, composite))
      if (tile.lines.length > 1) {
        ctx.fillStyle = "rgba(243,139,168,0.28)";
        ctx.fillRect(tile.tx * TILE * zoom, tile.ty * TILE * zoom, TILE * zoom, TILE * zoom);
      }
    ctx.lineWidth = 1;
    if (zoom >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      for (let x = 1; x < doc.width; x += 1) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, canvas.height);
      }
      for (let y = 1; y < doc.height; y += 1) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(canvas.width, y * zoom + 0.5);
      }
      ctx.stroke();
    }
    // Grade de tiles 8x8: sempre visivel.
    ctx.strokeStyle = "rgba(125,211,252,0.35)";
    ctx.beginPath();
    for (let x = 0; x <= doc.width; x += TILE) {
      ctx.moveTo(x * zoom + 0.5, 0);
      ctx.lineTo(x * zoom + 0.5, canvas.height);
    }
    for (let y = 0; y <= doc.height; y += TILE) {
      ctx.moveTo(0, y * zoom + 0.5);
      ctx.lineTo(canvas.width, y * zoom + 0.5);
    }
    ctx.stroke();
    if (hover) {
      const [hx, hy] = hover;
      ctx.strokeStyle = "rgba(249,226,175,0.55)";
      ctx.strokeRect(Math.floor(hx / TILE) * TILE * zoom + 0.5, Math.floor(hy / TILE) * TILE * zoom + 0.5, TILE * zoom, TILE * zoom);
      ctx.strokeStyle = "#ffffff";
      const size = ["pencil", "eraser", "dither", "lighten"].includes(tool) ? brushSize : 1;
      const start = -Math.floor((size - 1) / 2);
      ctx.strokeRect((hx + start) * zoom + 0.5, (hy + start) * zoom + 0.5, size * zoom - 1, size * zoom - 1);
    }
    if (selection) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#f9e2af";
      ctx.strokeRect(selection.x * zoom + 0.5, selection.y * zoom + 0.5, selection.w * zoom - 1, selection.h * zoom - 1);
      ctx.setLineDash([]);
    }
  }, [doc, frame, composite, zoom, onion, hover, selection, tool, brushSize]);

  // ── Preview animado ──
  useEffect(() => {
    if (!playing || doc.frames.length <= 1) {
      setPreviewFrame(frame);
      return;
    }
    const id = window.setInterval(() => setPreviewFrame((f) => (f + 1) % doc.frames.length), Math.round(1000 / Math.max(1, fps)));
    return () => window.clearInterval(id);
  }, [playing, fps, doc.frames.length, frame]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const scale = Math.max(1, Math.floor(128 / Math.max(doc.width, doc.height)));
    canvas.width = doc.width * scale;
    canvas.height = doc.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pixels = compositeFrame(doc, Math.min(previewFrame, doc.frames.length - 1));
    for (let i = 0; i < pixels.length; i += 1) {
      const css = pixelCss(doc, pixels[i]);
      if (!css) continue;
      ctx.fillStyle = css;
      ctx.fillRect((i % doc.width) * scale, Math.floor(i / doc.width) * scale, scale, scale);
    }
  }, [doc, previewFrame]);

  // ── Ferramentas ──
  const brush = useMemo(() => ({ size: brushSize, mirrorX, mirrorY }), [brushSize, mirrorX, mirrorY]);

  const toPixel = (event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(doc.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * doc.width))),
      Math.max(0, Math.min(doc.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * doc.height))),
    ];
  };

  const currentCel = doc.frames[frame].cels[layer];

  const renderDrag = useCallback(
    (drag: Drag, at: [number, number]): Uint8Array | null => {
      const { width, height } = doc;
      switch (drag.tool) {
        case "pencil":
          return drawStroke(currentCel, width, height, drag.points, drag.value, brush);
        case "eraser":
          return drawStroke(currentCel, width, height, drag.points, 0, brush);
        case "dither":
          return drawDither(currentCel, width, height, drag.points, drag.value, drag.secondary, brush);
        case "lighten":
          return drawShade(doc, currentCel, drag.points, !drag.right, brush);
        case "line": {
          const end = drag.shift ? constrainLine(drag.start[0], drag.start[1], at[0], at[1]) : at;
          return drawStroke(currentCel, width, height, [drag.start, end], drag.value, { size: brushSize });
        }
        case "rect":
        case "ellipse": {
          let end = at;
          if (drag.shift) {
            const d = Math.max(Math.abs(at[0] - drag.start[0]), Math.abs(at[1] - drag.start[1]));
            end = [drag.start[0] + Math.sign(at[0] - drag.start[0] || 1) * d, drag.start[1] + Math.sign(at[1] - drag.start[1] || 1) * d];
          }
          return (drag.tool === "rect" ? drawRect : drawEllipse)(currentCel, width, height, drag.start, end, drag.value, filled);
        }
        default:
          return null;
      }
    },
    [doc, currentCel, brush, brushSize, filled]
  );

  /** Recusa pixels que criariam tile com duas linhas de paleta (quando a trava esta ligada). */
  const guardTiles = useCallback(
    (cel: Uint8Array): Uint8Array => {
      if (!lockTilePalette) return cel;
      const before = new Set(analyzeTiles(doc, compositeFrame(doc, frame)).filter((t) => t.lines.length > 1).map((t) => `${t.tx},${t.ty}`));
      const after = analyzeTiles(doc, compositeFrame(replaceCel(doc, frame, layer, cel), frame)).filter(
        (t) => t.lines.length > 1 && !before.has(`${t.tx},${t.ty}`)
      );
      if (after.length === 0) return cel;
      const out = new Uint8Array(cel);
      for (const tile of after)
        for (let y = 0; y < TILE; y += 1)
          for (let x = 0; x < TILE; x += 1) {
            const i = (tile.ty * TILE + y) * doc.width + tile.tx * TILE + x;
            out[i] = currentCel[i];
          }
      setStatus(`${after.length} tile(s) recusado(s): já usam outra linha de paleta. Troque a paleta ativa ou desligue a trava.`);
      return out;
    },
    [lockTilePalette, doc, frame, layer, currentCel]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    rootRef.current?.focus();
    const at = toPixel(event);
    const right = event.button === 2;
    const value = right ? secondary : primary;
    const other = right ? primary : secondary;
    setStatus(null);
    if (tool === "picker") {
      const picked = composite[at[1] * doc.width + at[0]];
      if (right) setSecondary(picked);
      else setPrimary(picked);
      if (pixelIndex(picked) !== 0) setActiveLine(pixelLine(picked));
      return;
    }
    if (tool === "bucket") {
      commit(replaceCel(doc, frame, layer, guardTiles(floodFill(currentCel, doc.width, doc.height, at[0], at[1], value))));
      return;
    }
    if (tool === "replace") {
      commit(replaceCel(doc, frame, layer, guardTiles(replaceAllColor(currentCel, currentCel[at[1] * doc.width + at[0]], value))));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag: Drag = { tool, value, secondary: other, right, start: at, points: [at], shift: event.shiftKey };
    dragRef.current = drag;
    if (tool === "select") setSelection(normalizeRect(at, at, doc.width, doc.height));
    else if (tool !== "move") setPreview(renderDrag(drag, at));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const at = toPixel(event);
    setHover(at);
    const drag = dragRef.current;
    if (!drag) return;
    drag.shift = event.shiftKey;
    const last = drag.points[drag.points.length - 1];
    if (last[0] !== at[0] || last[1] !== at[1]) drag.points.push(at);
    if (drag.tool === "select") setSelection(normalizeRect(drag.start, at, doc.width, doc.height));
    else if (drag.tool === "move") setStatus(`Mover ${at[0] - drag.start[0]}, ${at[1] - drag.start[1]} px`);
    else setPreview(renderDrag(drag, at));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const at = toPixel(event);
    if (drag.tool === "select") {
      const rect = normalizeRect(drag.start, at, doc.width, doc.height);
      setSelection(rect.w > 1 || rect.h > 1 ? rect : null);
      return;
    }
    if (drag.tool === "move") {
      const dx = at[0] - drag.start[0];
      const dy = at[1] - drag.start[1];
      setStatus(null);
      if (dx === 0 && dy === 0) return;
      const rect = selection ?? undefined;
      commit(transformDoc(doc, moveAll ? "all" : { frame, layer }, (cel) => shiftCel(cel, doc.width, doc.height, dx, dy, wrapMove, rect)));
      if (selection) setSelection({ ...selection, x: selection.x + dx, y: selection.y + dy });
      return;
    }
    const result = renderDrag(drag, at);
    setPreview(null);
    if (result) commit(replaceCel(doc, frame, layer, guardTiles(result)));
  };

  const applyTransform = (fn: (cel: Uint8Array) => Uint8Array) => commit(transformDoc(doc, moveAll ? "all" : { frame, layer }, fn));
  const flip = (horizontal: boolean) => applyTransform((cel) => flipCel(cel, doc.width, doc.height, horizontal, selection ?? undefined));
  const rotate = () => applyTransform((cel) => rotateCel(cel, doc.width, doc.height, selection ?? undefined));

  const selectSlot = (line: number, slot: number, right: boolean) => {
    setActiveLine(line);
    const value = packPixel(line, slot);
    if (right) setSecondary(value);
    else setPrimary(value);
  };

  const setSlotColor = (line: number, slot: number, color: MdColor) => {
    commit({ ...doc, palettes: doc.palettes.map((p, li) => (li === line ? p.map((c, si) => (si === slot ? color : c)) : p)) });
  };

  // ── Teclado ──
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const match = PIXEL_TOOLS.find((t) => t.key.toLowerCase() === key);
    if (match) {
      setTool(match.id);
      event.preventDefault();
      return;
    }
    if (key === "x") {
      setPrimary(secondary);
      setSecondary(primary);
    } else if (key === "[") setBrushSize((s) => Math.max(1, s - 1));
    else if (key === "]") setBrushSize((s) => Math.min(8, s + 1));
    else if (key === "h") flip(true);
    else if (key === "v") flip(false);
    else if (key === "escape") setSelection(null);
    else if (key === "arrowleft") setFrameIndex((f) => Math.max(0, f - 1));
    else if (key === "arrowright") setFrameIndex((f) => Math.min(doc.frames.length - 1, f + 1));
    else if (key === "+" || key === "=") setZoom((z) => Math.min(48, z + 2));
    else if (key === "-") setZoom((z) => Math.max(2, z - 2));
    else return;
    event.preventDefault();
  };

  // ── Abrir / salvar ──
  const importFromArt = async () => {
    if (!source) return;
    try {
      const pixelDoc = source.sourcePath.match(/(assets\/sprites\/pixel\/[^/]+)\.png$/);
      if (pixelDoc && projectDir) {
        const json = await loadPixelArtDoc(projectDir, `${pixelDoc[1]}.rdspixel.json`).catch(() => null);
        if (json) {
          commit(deserializePixelDoc(json));
          setFrameIndex(0);
          setLayerIndex(0);
          setStatus("Documento de pixel art reaberto com layers e frames.");
          return;
        }
      }
      const { doc: imported, warnings } = await importFramesFromSheet(source, activeLine, doc);
      commit(imported);
      setFrameIndex(0);
      setLayerIndex(0);
      setSelection(null);
      setStatus(
        `${imported.frames.length} frame(s) de ${source.name} em PAL${activeLine}.` + (warnings.length ? ` ${warnings.join(" ")}` : "")
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const save = async () => {
    if (!projectDir) {
      setStatus("Abra um projeto para salvar.");
      return;
    }
    try {
      const sheet = await exportSheetPng(doc);
      const saved = await savePixelArtAsset(projectDir, doc.name, sheet.png, serializePixelDoc(doc));
      setSavedPath(saved.png_relative);
      log("success", `[Editor de pixels] ${saved.png_relative} (${doc.frames.length} frame(s), PAL${sheet.line}, PNG 4-bit).`);
      onSaved(saved.png_absolute);
    } catch (error) {
      setStatus(`Falha ao salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const download = async () => {
    const sheet = await exportSheetPng(doc);
    const url = URL.createObjectURL(new Blob([sheet.png as BlobPart], { type: "image/png" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeSymbol(doc.name)}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    setStatus(`${what} copiado.`);
  };

  const exportLine = report.lineUsage[0]?.line ?? activeLine;
  const tileUnderCursor = hover ? report.tiles.find((t) => t.tx === Math.floor(hover[0] / TILE) && t.ty === Math.floor(hover[1] / TILE)) : null;
  const usedByLine = (line: number) => report.lineUsage.find((u) => u.line === line)?.colors ?? 0;

  const swatch = (value: number) => pixelCss(doc, value);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="pixel-editor"
      className="flex h-full min-h-0 flex-col gap-2 outline-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra do documento */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#313244] bg-[#111827] px-3 py-2 text-[10px] text-[#cdd6f4]">
        <input
          data-testid="pixel-doc-name"
          value={doc.name}
          onChange={(e) => setDocState({ ...doc, name: sanitizeSymbol(e.target.value) })}
          className="w-32 rounded border border-[#313244] bg-[#0b0f19] px-2 py-1 font-mono"
          title="Nome do recurso (vira spr_<nome> no .res)"
        />
        <select
          data-testid="pixel-doc-target"
          value={doc.target}
          onChange={(e) => commit({ ...doc, target: e.target.value as PixelTarget })}
          className="rounded border border-[#313244] bg-[#0b0f19] px-1 py-1"
        >
          <option value="sprite">Sprite (SAT)</option>
          <option value="plane">Tiles de plano (A/B)</option>
        </select>
        <select
          data-testid="pixel-doc-size"
          value={`${doc.width}x${doc.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split("x").map(Number);
            commit(resizeDoc(doc, w, h));
          }}
          className="rounded border border-[#313244] bg-[#0b0f19] px-1 py-1"
          title="Tamanho do canvas (múltiplos de 8)"
        >
          {[...SIZE_PRESETS.map(([w, h]) => ({ label: `${w}×${h}`, size: [w, h] })), ...PLANE_PRESETS]
            .concat(
              SIZE_PRESETS.some(([w, h]) => w === doc.width && h === doc.height) || PLANE_PRESETS.some((p) => p.size[0] === doc.width && p.size[1] === doc.height)
                ? []
                : [{ label: `${doc.width}×${doc.height}`, size: [doc.width, doc.height] }]
            )
            .map((preset) => (
              <option key={preset.label} value={`${preset.size[0]}x${preset.size[1]}`}>
                {preset.label}
              </option>
            ))}
        </select>
        <button type="button" onClick={() => commit(createPixelDoc(doc.width, doc.height, { target: doc.target }))} className="rounded border border-[#313244] px-2 py-1 hover:bg-[#1f2937]">
          Novo
        </button>
        {source ? (
          <button
            type="button"
            data-testid="pixel-import-art"
            onClick={() => void importFromArt()}
            className="rounded border border-[#7dd3fc]/45 bg-[#7dd3fc]/10 px-2 py-1 text-[#7dd3fc] hover:bg-[#7dd3fc]/20"
            title="Traz os frames da sequência ativa, quantizados para a paleta ativa"
          >
            Editar frames de {source.name}
          </button>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={undo} disabled={past.length === 0} className="rounded border border-[#313244] px-2 py-1 disabled:opacity-40" title="Desfazer (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} className="rounded border border-[#313244] px-2 py-1 disabled:opacity-40" title="Refazer (Ctrl+Y)">
            ↷
          </button>
          <button type="button" onClick={() => void download()} className="rounded border border-[#313244] px-2 py-1 hover:bg-[#1f2937]" title="Folha horizontal, PNG indexado 4-bit">
            Baixar PNG
          </button>
          <button
            type="button"
            data-testid="pixel-save"
            onClick={() => void save()}
            className="rounded border border-[#a6e3a1]/50 bg-[#a6e3a1]/15 px-3 py-1 font-semibold text-[#a6e3a1] hover:bg-[#a6e3a1]/25"
          >
            {savedPath ? "Salvo ✓" : "Salvar no projeto"}
          </button>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[52px_minmax(0,1fr)_280px] gap-2">
        {/* Ferramentas */}
        <div className="flex flex-col gap-1 overflow-y-auto rounded-xl border border-[#313244] bg-[#111827] p-1" data-testid="pixel-tools">
          {PIXEL_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`pixel-tool-${t.id}`}
              data-active={tool === t.id}
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.key}) — ${t.hint}`}
              className={`relative h-10 rounded-lg text-lg ${tool === t.id ? "bg-[#7dd3fc]/20 text-[#7dd3fc] ring-1 ring-[#7dd3fc]/60" : "text-[#cdd6f4] hover:bg-[#1f2937]"}`}
            >
              {t.glyph}
              <span className="absolute bottom-0.5 right-1 text-[8px] text-[#6c7086]">{t.key}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-[#313244] pt-1 text-center text-[9px] text-[#94a3b8]">
            <div className="mx-auto h-7 w-7 rounded border border-[#45475a]" style={{ background: swatch(primary) ?? "transparent" }} title="Primária (clique esquerdo)" />
            <div className="mx-auto -mt-2 ml-5 h-5 w-5 rounded border border-[#45475a]" style={{ background: swatch(secondary) ?? "transparent" }} title="Secundária (clique direito)" />
            <button type="button" onClick={() => { setPrimary(secondary); setSecondary(primary); }} className="mt-1 text-[#94a3b8] hover:text-white" title="Trocar (X)">
              ⇅ X
            </button>
          </div>
        </div>

        {/* Canvas + frames */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#313244] bg-[#111827] px-2 py-1 text-[10px] text-[#cdd6f4]">
            <label className="flex items-center gap-1" title="Tamanho do pincel ([ e ])">
              Pincel
              <input type="range" min={1} max={8} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-16" />
              {brushSize}px
            </label>
            <label className="flex items-center gap-1" title="Espelha o traço no eixo vertical">
              <input type="checkbox" checked={mirrorX} onChange={(e) => setMirrorX(e.target.checked)} />
              Espelho ↔
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={mirrorY} onChange={(e) => setMirrorY(e.target.checked)} />
              Espelho ↕
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} />
              Formas cheias
            </label>
            <label className="flex items-center gap-1" title="Impede misturar linhas de paleta no mesmo tile 8×8">
              <input type="checkbox" data-testid="pixel-lock-tile-palette" checked={lockTilePalette} onChange={(e) => setLockTilePalette(e.target.checked)} />
              Trava de paleta por tile
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
              Onion skin
            </label>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setZoom((z) => Math.max(2, z - 2))} className="rounded border border-[#313244] px-1.5">−</button>
              <span className="w-10 text-center" data-testid="pixel-zoom">{zoom}×</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(48, z + 2))} className="rounded border border-[#313244] px-1.5">+</button>
            </span>
          </div>
          <div ref={stageRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-[#313244] bg-[#0b0f19] p-3">
            <canvas
              ref={canvasRef}
              data-testid="pixel-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHover(null)}
              onWheel={(e) => {
                if (!e.ctrlKey) return;
                setZoom((z) => Math.max(2, Math.min(48, z + (e.deltaY < 0 ? 2 : -2))));
              }}
              className="cursor-crosshair [image-rendering:pixelated]"
            />
          </div>
          <div className="flex items-center gap-3 px-1 text-[10px] text-[#94a3b8]" data-testid="pixel-status">
            <span>{hover ? `x ${hover[0]} · y ${hover[1]} · tile ${Math.floor(hover[0] / TILE)},${Math.floor(hover[1] / TILE)}` : `${doc.width}×${doc.height} px · ${doc.width / TILE}×${doc.height / TILE} tiles`}</span>
            {tileUnderCursor ? (
              <span className={tileUnderCursor.lines.length > 1 ? "text-[#f38ba8]" : ""}>
                cores neste tile {tileUnderCursor.colors}/15 · {tileUnderCursor.lines.length === 0 ? "vazio" : tileUnderCursor.lines.map((l) => `PAL${l}`).join("+")}
              </span>
            ) : null}
            {selection ? <span>seleção {selection.w}×{selection.h} (Esc limpa)</span> : null}
            {status ? <span className="text-[#f9e2af]">{status}</span> : null}
          </div>
          {/* Faixa de frames */}
          <div className="flex items-stretch gap-2 overflow-x-auto rounded-xl border border-[#313244] bg-[#111827] p-2" data-testid="pixel-frames">
            {doc.frames.map((f, i) => (
              <FrameThumb key={f.id} doc={doc} index={i} active={i === frame} onSelect={() => setFrameIndex(i)} />
            ))}
            <div className="flex flex-col justify-center gap-1 text-[10px]">
              <button type="button" data-testid="pixel-frame-add" onClick={() => { commit(addFrame(doc, frame, false)); setFrameIndex(frame + 1); }} className="rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937]">+ Novo</button>
              <button type="button" data-testid="pixel-frame-duplicate" onClick={() => { commit(addFrame(doc, frame, true)); setFrameIndex(frame + 1); }} className="rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937]">⧉ Duplicar</button>
            </div>
            <div className="flex flex-col justify-center gap-1 text-[10px]">
              <span className="flex gap-1">
                <button type="button" onClick={() => { commit(moveFrame(doc, frame, frame - 1)); setFrameIndex(Math.max(0, frame - 1)); }} className="rounded border border-[#313244] px-1.5" title="Mover para a esquerda">◀</button>
                <button type="button" onClick={() => { commit(moveFrame(doc, frame, frame + 1)); setFrameIndex(Math.min(doc.frames.length - 1, frame + 1)); }} className="rounded border border-[#313244] px-1.5" title="Mover para a direita">▶</button>
              </span>
              <button type="button" disabled={doc.frames.length <= 1} onClick={() => { commit(removeFrame(doc, frame)); setFrameIndex(Math.max(0, frame - 1)); }} className="rounded border border-[#f38ba8]/40 px-2 py-0.5 text-[#f38ba8] disabled:opacity-40">✕ Excluir</button>
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 text-[10px] text-[#cdd6f4]">
          <Section title="Prévia">
            <div className="flex items-center justify-center rounded bg-[repeating-conic-gradient(#1e2433_0_25%,#272e40_0_50%)] bg-[length:12px_12px] p-2">
              <canvas ref={previewRef} data-testid="pixel-preview" className="[image-rendering:pixelated]" />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded border border-[#313244] px-2">{playing ? "❚❚" : "▶"}</button>
              <input type="range" min={1} max={24} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="flex-1" />
              <span className="w-12 text-right">{fps} FPS</span>
            </div>
            <button
              type="button"
              className="mt-1 w-full rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937]"
              title="Grava a duração de todos os frames a partir do FPS"
              onClick={() => commit({ ...doc, frames: doc.frames.map((f) => ({ ...f, durationMs: Math.round(1000 / fps) })) })}
            >
              Aplicar {fps} FPS aos frames ({Math.max(1, Math.round(60 / fps))} ticks a 60 Hz)
            </button>
          </Section>

          <Section title="Paletas CRAM (4 × 16, 9-bit)">
            <div className="flex flex-col gap-1" data-testid="pixel-palettes">
              {doc.palettes.map((palette, line) => {
                const used = usedByLine(line);
                return (
                  <div
                    key={line}
                    data-testid={`pixel-palette-line-${line}`}
                    data-active={activeLine === line}
                    className={`rounded-lg border p-1 ${activeLine === line ? "border-[#7dd3fc]/70 bg-[#7dd3fc]/5" : "border-[#313244]"}`}
                  >
                    <button type="button" onClick={() => setActiveLine(line)} className="flex w-full items-center justify-between text-left">
                      <span className="font-semibold">{String.fromCharCode(65 + line)} · PAL{line}</span>
                      <span className={used > 15 ? "text-[#f38ba8]" : "text-[#94a3b8]"} data-testid={`pixel-palette-count-${line}`}>
                        {used}/15 usadas · restam {Math.max(0, 15 - used)}
                      </span>
                    </button>
                    <div className="mt-1 grid grid-cols-8 gap-0.5">
                      {palette.map((color, slot) => {
                        const value = packPixel(line, slot);
                        const isPrimary = slot > 0 && primary === value;
                        const isSecondary = slot > 0 && secondary === value;
                        return (
                          <button
                            key={slot}
                            type="button"
                            data-testid={`pixel-slot-${line}-${slot}`}
                            onClick={() => (slot === 0 ? undefined : selectSlot(line, slot, false))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (slot > 0) selectSlot(line, slot, true);
                            }}
                            onDoubleClick={() => { setActiveLine(line); setEditingSlot(slot); }}
                            title={slot === 0 ? "Índice 0: transparente (em PAL0 também é a cor de fundo)" : `PAL${line}[${slot}] — duplo clique edita`}
                            className={`relative h-5 rounded-sm border ${isPrimary ? "border-white" : isSecondary ? "border-[#f9e2af]" : "border-black/40"}`}
                            style={{
                              background:
                                slot === 0
                                  ? `repeating-conic-gradient(#555 0 25%, #999 0 50%) 0 0/6px 6px`
                                  : mdColorToCss(color),
                            }}
                          >
                            {isPrimary ? <span className="absolute inset-0 text-[8px] leading-5 text-white mix-blend-difference">1</span> : null}
                            {isSecondary ? <span className="absolute inset-0 text-[8px] leading-5 text-white mix-blend-difference">2</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {editingSlot !== null ? (
              <ColorEditor
                color={doc.palettes[activeLine][editingSlot]}
                label={`PAL${activeLine}[${editingSlot}]`}
                onChange={(c) => setSlotColor(activeLine, editingSlot, c)}
                onClose={() => setEditingSlot(null)}
              />
            ) : (
              <p className="mt-1 text-[#6c7086]">Duplo clique numa cor para editar em 9-bit.</p>
            )}
            <button type="button" onClick={() => setShowMaster((s) => !s)} className="mt-1 w-full rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937]">
              {showMaster ? "Ocultar" : "Ver"} as 512 cores do Mega Drive
            </button>
            {showMaster ? (
              <div className="mt-1 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-px" data-testid="pixel-master-palette">
                {masterPalette().map((color) => (
                  <button
                    key={color.join(",")}
                    type="button"
                    className="aspect-square"
                    style={{ background: mdColorToCss(color) }}
                    title={`R${color[0]} G${color[1]} B${color[2]}${editingSlot !== null ? " — aplicar ao slot" : ""}`}
                    onClick={() => {
                      if (editingSlot !== null && editingSlot > 0) setSlotColor(activeLine, editingSlot, color);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Hardware (VDP)">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5" data-testid="pixel-hardware">
              <span className="text-[#94a3b8]">Cores únicas</span>
              <span>{report.uniqueColors}</span>
              <span className="text-[#94a3b8]">Tiles únicos</span>
              <span data-testid="pixel-unique-tiles">{report.uniqueTiles} de {report.totalTiles} (com flip)</span>
              <span className="text-[#94a3b8]">VRAM</span>
              <span>{(report.vramBytes / 1024).toFixed(1)} KB / 64 KB</span>
              {doc.target === "sprite" ? (
                <>
                  <span className="text-[#94a3b8]">Peças por frame</span>
                  <span>{report.hwSpritesPerFrame} (até 4×4 tiles cada)</span>
                  <span className="text-[#94a3b8]">Por scanline</span>
                  <span className={report.spritesPerScanline > MAX_SPRITES_PER_LINE ? "text-[#f38ba8]" : ""}>
                    {report.spritesPerScanline}/{MAX_SPRITES_PER_LINE}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[#94a3b8]">Mapa</span>
                  <span>{report.tilesX}×{report.tilesY} tiles</span>
                </>
              )}
            </div>
            {report.warnings.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-[#f38ba8]" data-testid="pixel-warnings">
                {report.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : (
              <p className="mt-1 text-[#a6e3a1]" data-testid="pixel-hardware-ok">✓ Dentro dos limites do VDP</p>
            )}
          </Section>

          <Section title="Layers">
            <div className="flex flex-col gap-0.5" data-testid="pixel-layers">
              {[...doc.layers].map((meta, i) => ({ meta, i })).reverse().map(({ meta, i }) => (
                <div key={meta.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${i === layer ? "bg-[#7dd3fc]/15" : ""}`}>
                  <button
                    type="button"
                    onClick={() => commit({ ...doc, layers: doc.layers.map((l, li) => (li === i ? { ...l, visible: !l.visible } : l)) })}
                    title={meta.visible ? "Ocultar" : "Mostrar"}
                    className="w-4"
                  >
                    {meta.visible ? "◉" : "○"}
                  </button>
                  <input
                    value={meta.name}
                    onFocus={() => setLayerIndex(i)}
                    onChange={(e) => setDocState({ ...doc, layers: doc.layers.map((l, li) => (li === i ? { ...l, name: e.target.value } : l)) })}
                    className="min-w-0 flex-1 bg-transparent"
                  />
                  <button type="button" onClick={() => { commit(moveLayer(doc, i, i + 1)); setLayerIndex(Math.min(doc.layers.length - 1, i + 1)); }} title="Subir">▲</button>
                  <button type="button" onClick={() => { commit(moveLayer(doc, i, i - 1)); setLayerIndex(Math.max(0, i - 1)); }} title="Descer">▼</button>
                </div>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {LAYER_PRESETS.map((name) => (
                <button key={name} type="button" onClick={() => { commit(addLayer(doc, name)); setLayerIndex(doc.layers.length); }} className="rounded border border-[#313244] px-1.5 hover:bg-[#1f2937]">
                  + {name}
                </button>
              ))}
              <button type="button" disabled={doc.layers.length <= 1} onClick={() => { commit(removeLayer(doc, layer)); setLayerIndex(Math.max(0, layer - 1)); }} className="rounded border border-[#f38ba8]/40 px-1.5 text-[#f38ba8] disabled:opacity-40">
                Excluir layer
              </button>
            </div>
            <p className="mt-1 text-[#6c7086]">Layers são de edição: o export junta tudo numa folha (o VDP vê só o resultado).</p>
          </Section>

          <Section title="Transformar">
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => flip(true)} className="rounded border border-[#313244] px-2 py-0.5" title="Flip horizontal (H) — gratuito no hardware">⇋ Flip H</button>
              <button type="button" onClick={() => flip(false)} className="rounded border border-[#313244] px-2 py-0.5" title="Flip vertical (V)">⇵ Flip V</button>
              <button type="button" onClick={rotate} className="rounded border border-[#313244] px-2 py-0.5" title="90° horário (área quadrada)">⟳ 90°</button>
            </div>
            <label className="mt-1 flex items-center gap-1"><input type="checkbox" checked={moveAll} onChange={(e) => setMoveAll(e.target.checked)} /> Aplicar a todos os frames e layers</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={wrapMove} onChange={(e) => setWrapMove(e.target.checked)} /> Mover com wrap nas bordas</label>
          </Section>

          <Section title="Exportar para SGDK">
            <p className="text-[#94a3b8]">Folha horizontal de {doc.frames.length} frame(s), PNG 4-bit indexado com PAL{exportLine}; índice 0 transparente.</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <button type="button" onClick={() => copyText(paletteToC(`pal_${sanitizeSymbol(doc.name)}`, doc.palettes[exportLine]), "Paleta CRAM em C")} className="rounded border border-[#313244] px-2 py-0.5">
                Copiar paleta (C)
              </button>
              <button type="button" onClick={() => copyText(resLine(doc, savedPath ? savedPath.replace(/^assets\//, "") : `sprites/${sanitizeSymbol(doc.name)}.png`), "Linha do .res")} className="rounded border border-[#313244] px-2 py-0.5">
                Copiar linha .res
              </button>
            </div>
            {savedPath ? <p className="mt-1 break-all text-[#a6e3a1]">{savedPath}</p> : null}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#313244] bg-[#111827] p-2">
      <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7dd3fc]">{title}</h4>
      {children}
    </section>
  );
}

function FrameThumb({ doc, index, active, onSelect }: { doc: PixelDoc; index: number; active: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = Math.max(1, Math.floor(48 / Math.max(doc.width, doc.height)));
    canvas.width = doc.width * scale;
    canvas.height = doc.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = compositeFrame(doc, index);
    for (let i = 0; i < pixels.length; i += 1) {
      const css = pixelCss(doc, pixels[i]);
      if (!css) continue;
      ctx.fillStyle = css;
      ctx.fillRect((i % doc.width) * scale, Math.floor(i / doc.width) * scale, scale, scale);
    }
  }, [doc, index]);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`pixel-frame-${index}`}
      data-active={active}
      className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-[#0b0f19] ${active ? "border-[#7dd3fc]" : "border-[#313244]"}`}
    >
      <canvas ref={ref} className="max-h-14 max-w-14 [image-rendering:pixelated]" />
      <span className="absolute left-1 top-0.5 text-[9px] text-[#94a3b8]">{index + 1}</span>
      <span className="absolute bottom-0.5 right-1 text-[8px] text-[#6c7086]">{doc.frames[index].durationMs}ms</span>
    </button>
  );
}

function ColorEditor({ color, label, onChange, onClose }: { color: MdColor; label: string; onChange: (c: MdColor) => void; onClose: () => void }) {
  return (
    <div className="mt-1 rounded-lg border border-[#313244] p-1" data-testid="pixel-color-editor">
      <div className="flex items-center gap-2">
        <span className="h-5 w-5 rounded border border-black/40" style={{ background: mdColorToCss(color) }} />
        <span className="font-mono">{label} · {mdColorToCss(color)}</span>
        <button type="button" onClick={onClose} className="ml-auto text-[#94a3b8]">✕</button>
      </div>
      {(["R", "G", "B"] as const).map((channel, i) => (
        <label key={channel} className="mt-0.5 flex items-center gap-1">
          <span className="w-3">{channel}</span>
          <input
            type="range"
            min={0}
            max={7}
            value={color[i]}
            data-testid={`pixel-color-${channel}`}
            onChange={(e) => onChange(color.map((c, ci) => (ci === i ? Number(e.target.value) : c)) as MdColor)}
            className="flex-1"
          />
          <span className="w-3 text-right">{color[i]}</span>
        </label>
      ))}
    </div>
  );
}
