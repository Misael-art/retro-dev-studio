import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MAX_SPRITES_PER_LINE,
  TILE,
  addFrame,
  addLayer,
  analyzeHardware,
  analyzeTiles,
  analyzeTileReuse,
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
  removePixelBackground,
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
  type PixelConversion,
} from "../../core/pixelEditor";
import { loadPixelArtDoc, savePixelArtAsset } from "../../core/ipc/artStudioService";
import { useEditorStore } from "../../core/store/editorStore";
import { prepareImage } from "../../core/imageIngress";
import { copyPixelDoc, duplicatePixelLayer, erasePixelRegion, mergePixelLayerDown, type PixelEditScope } from "../../core/pixelImageOps";
import Icon, { type IconName } from "../common/Icon";
import PixelImagePanel, { PIXEL_TASKS, type PixelTask, type PixelTileView } from "./PixelImagePanel";

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
  | "background"
  | "picker";

export const PIXEL_TOOLS: { id: PixelTool; key: string; icon: IconName; label: string; hint: string }[] = [
  { id: "pencil", key: "P", icon: "brush", label: "Lápis", hint: "Esquerdo: cor primária · direito: secundária" },
  { id: "eraser", key: "E", icon: "eraser", label: "Borracha", hint: "Torna o pixel transparente (índice 0)" },
  { id: "bucket", key: "B", icon: "fill-color", label: "Balde", hint: "Preenche a área contígua da mesma cor" },
  { id: "replace", key: "A", icon: "arrows", label: "Trocar cor", hint: "Troca os pixels da mesma cor na camada, respeitando a seleção" },
  { id: "line", key: "L", icon: "minus", label: "Reta", hint: "Shift: 0/45/90 graus" },
  { id: "rect", key: "R", icon: "square", label: "Retângulo", hint: "Shift: quadrado" },
  { id: "ellipse", key: "C", icon: "circle", label: "Círculo", hint: "Shift: círculo perfeito" },
  { id: "dither", key: "D", icon: "grid", label: "Pontilhado", hint: "Alterna as duas cores para simular tons intermediários" },
  { id: "lighten", key: "U", icon: "flash", label: "Clarear", hint: "Esquerdo clareia, direito escurece (na mesma paleta)" },
  { id: "select", key: "S", icon: "maximize", label: "Seleção", hint: "Arraste para delimitar a região a editar; Esc limpa" },
  { id: "move", key: "M", icon: "drag", label: "Mover", hint: "Arraste a seleção ou a camada atual" },
  { id: "picker", key: "I", icon: "color-picker", label: "Conta-gotas", hint: "Pega a cor do canvas" },
  { id: "background", key: "K", icon: "magic-wand", label: "Apagar fundo", hint: "Clique numa região de fundo para apagar cores parecidas; ajuste a tolerância em Imagem e fundo" },
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
  /** Open the canonical imported document; previous edits remain in Undo. */
  autoOpen?: boolean;
  originalPath?: string;
}

interface PixelEditorProps {
  projectDir: string | null;
  source: PixelEditorSource | null;
  log: (level: "info" | "warn" | "error" | "success", message: string) => void;
  onSaved: (pngAbsolute: string, doc?: PixelDoc) => void;
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
  const projectKey = projectDir ?? "";
  const initial = useRef(useEditorStore.getState().pixelEditorSessions[projectKey]).current;
  const [doc, setDocState] = useState<PixelDoc>(() => initial?.doc ?? createPixelDoc(32, 32));
  const [past, setPast] = useState<PixelDoc[]>(initial?.past ?? []);
  const [future, setFuture] = useState<PixelDoc[]>(initial?.future ?? []);
  const [frameIndex, setFrameIndex] = useState(initial?.frameIndex ?? 0);
  const [layerIndex, setLayerIndex] = useState(initial?.layerIndex ?? 0);
  const [tool, setTool] = useState<PixelTool>("pencil");
  const [task, setTask] = useState<PixelTask>("draw");
  const [showGrid, setShowGrid] = useState(false);
  const [isolation, setIsolation] = useState<number | null>(null);
  const [tileMap, setTileMap] = useState(false);
  const [tileView, setTileView] = useState<PixelTileView>("repeated");
  const [allImageFrames, setAllImageFrames] = useState(false);
  const [backgroundTolerance, setBackgroundTolerance] = useState(0);
  const [imagePreview, setImagePreview] = useState<PixelDoc | null>(null);
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
  const [showAllPalettes, setShowAllPalettes] = useState(false);
  const [fps, setFps] = useState(10);
  const [playing, setPlaying] = useState(true);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(initial?.savedPath ?? null);
  const [savedSource, setSavedSource] = useState<string | null>(initial?.savedSource ?? null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const importRequest = useRef(0);
  const sourceIdentity = JSON.stringify(source);
  const sourceIdentityRef = useRef(sourceIdentity);
  sourceIdentityRef.current = sourceIdentity;
  const projectIdentityRef = useRef(projectDir);
  projectIdentityRef.current = projectDir;
  const dragRef = useRef<Drag | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const serialized = useMemo(() => serializePixelDoc(doc), [doc]);
  const isSaved = savedPath !== null && serialized === savedSource;
  useLayoutEffect(() => { if (optionsRef.current) optionsRef.current.scrollTop = 0; }, [task, sourceIdentity]);

  useLayoutEffect(() => {
    useEditorStore.getState().setPixelEditorSession(projectKey, {
      doc, past, future, frameIndex, layerIndex, savedPath, savedSource,
    });
  }, [projectKey, doc, past, future, frameIndex, layerIndex, savedPath, savedSource]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; importRequest.current += 1; };
  }, []);

  const frame = Math.min(frameIndex, doc.frames.length - 1);
  const originalPath = source?.originalPath ?? (projectDir && doc.originalSource && /^\.rds\/art-sources\/[a-f0-9]{64}\.[a-z0-9]+$/.test(doc.originalSource) ? `${projectDir}/${doc.originalSource}` : undefined);
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
  }, []);
  const undo = useCallback(() => {
    if (past.length === 0) return;
    setStatus(null);
    setFuture((f) => [docRef.current, ...f]);
    setDocState(past[past.length - 1]);
    setPast(past.slice(0, -1));
  }, [past]);
  const redo = useCallback(() => {
    if (future.length === 0) return;
    setStatus(null);
    setPast((p) => [...p, docRef.current]);
    setDocState(future[0]);
    setFuture(future.slice(1));
  }, [future]);

  const fitCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || stage.clientWidth === 0 || stage.clientHeight === 0) return;
    const fit = Math.floor(Math.min((stage.clientWidth - 24) / doc.width, (stage.clientHeight - 24) / doc.height));
    setZoom(Math.max(1, Math.min(48, fit)));
  }, [doc.width, doc.height]);
  // First layout can be zero-sized while CSS/panels load. Fit again when the
  // actual stage becomes available, and keep oversized canvases scrollable.
  useEffect(() => {
    fitCanvas();
    if (typeof ResizeObserver === "undefined" || !stageRef.current) return;
    const observer = new ResizeObserver(fitCanvas); observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [fitCanvas]);

  const report = useMemo(() => analyzeHardware(doc, frame), [doc, frame]);
  const displayDoc = imagePreview ?? doc;
  const editScope: PixelEditScope = { frame, layer, allFrames: allImageFrames, rect: selection, color: isolation };
  useEffect(() => { setImagePreview(null); setSelection(null); setIsolation(null); }, [doc.width, doc.height, sourceIdentity]);

  // ── Desenho do canvas ──
  const composite = useMemo(() => {
    if (imagePreview) return compositeFrame(imagePreview, Math.min(frame, imagePreview.frames.length - 1));
    if (!preview) return compositeFrame(doc, frame);
    return compositeFrame(replaceCel(doc, frame, layer, preview), frame);
  }, [doc, frame, layer, preview, imagePreview]);
  const tileReuse = useMemo(() => analyzeTileReuse(displayDoc, composite), [displayDoc, composite]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = displayDoc.width * zoom;
    canvas.height = displayDoc.height * zoom;
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
        const css = pixelCss(displayDoc, pixels[i]);
        if (!css) continue;
        ctx.globalAlpha = !imagePreview && isolation !== null && pixels[i] !== isolation ? alpha * .18 : alpha;
        ctx.fillStyle = css;
        ctx.fillRect((i % displayDoc.width) * zoom, Math.floor(i / displayDoc.width) * zoom, zoom, zoom);
      }
      ctx.globalAlpha = 1;
    };
    if (onion && !imagePreview && doc.frames.length > 1) {
      if (frame > 0) paint(compositeFrame(doc, frame - 1), 0.22);
      if (frame < doc.frames.length - 1) paint(compositeFrame(doc, frame + 1), 0.12);
    }
    paint(composite, 1);
    // Tiles com mais de uma linha de paleta.
    for (const tile of analyzeTiles(displayDoc, composite))
      if (tile.lines.length > 1) {
        ctx.fillStyle = "rgba(243,139,168,0.28)";
        ctx.fillRect(tile.tx * TILE * zoom, tile.ty * TILE * zoom, TILE * zoom, TILE * zoom);
      }
    ctx.lineWidth = 1;
    if (showGrid && zoom >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      for (let x = 1; x < displayDoc.width; x += 1) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, canvas.height);
      }
      for (let y = 1; y < displayDoc.height; y += 1) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(canvas.width, y * zoom + 0.5);
      }
      ctx.stroke();
    }
    if (showGrid || tileMap) {
    ctx.strokeStyle = "rgba(125,211,252,0.35)";
    ctx.beginPath();
    for (let x = 0; x <= displayDoc.width; x += TILE) {
      ctx.moveTo(x * zoom + 0.5, 0);
      ctx.lineTo(x * zoom + 0.5, canvas.height);
    }
    for (let y = 0; y <= displayDoc.height; y += TILE) {
      ctx.moveTo(0, y * zoom + 0.5);
      ctx.lineTo(canvas.width, y * zoom + 0.5);
    }
    ctx.stroke();
    }
    if (tileMap) for (const tile of tileReuse) {
      if (tile.empty) continue;
      const color = tile.lines.length > 1 ? "#f38ba8" : tileView === "exclusive" && tile.exclusiveColors ? "#f9e2af" : tileView === "mirrored" && tile.flip !== "original" ? "#cba6f7" : tileView === "repeated" && tile.copies > 1 ? "#a6e3a1" : null;
      if (!color) continue;
      ctx.globalAlpha = .2; ctx.fillStyle = color; ctx.fillRect(tile.tx * TILE * zoom, tile.ty * TILE * zoom, TILE * zoom, TILE * zoom); ctx.globalAlpha = 1;
      if (zoom >= 3) { ctx.fillStyle = "#111827"; ctx.fillRect(tile.tx * TILE * zoom + 1, tile.ty * TILE * zoom + 1, TILE * zoom - 2, 10); ctx.fillStyle = color; ctx.font = "9px monospace"; ctx.fillText(String(tile.pattern + 1), tile.tx * TILE * zoom + 2, tile.ty * TILE * zoom + 9); }
    }
    if (hover && !imagePreview) {
      const [hx, hy] = hover;
      ctx.strokeStyle = "rgba(249,226,175,0.55)";
      ctx.strokeRect(Math.floor(hx / TILE) * TILE * zoom + 0.5, Math.floor(hy / TILE) * TILE * zoom + 0.5, TILE * zoom, TILE * zoom);
      ctx.strokeStyle = "#ffffff";
      const size = ["pencil", "eraser", "dither", "lighten"].includes(tool) ? brushSize : 1;
      const start = -Math.floor((size - 1) / 2);
      ctx.strokeRect((hx + start) * zoom + 0.5, (hy + start) * zoom + 0.5, size * zoom - 1, size * zoom - 1);
    }
    if (selection && !imagePreview) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#f9e2af";
      ctx.strokeRect(selection.x * zoom + 0.5, selection.y * zoom + 0.5, selection.w * zoom - 1, selection.h * zoom - 1);
      ctx.setLineDash([]);
    }
  }, [doc, displayDoc, frame, composite, zoom, onion, hover, selection, tool, brushSize, imagePreview, showGrid, isolation, tileMap, tileView, tileReuse]);

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
      if (selection || isolation !== null) cel = Uint8Array.from(cel, (value, i) => {
        const x = i % doc.width, y = Math.floor(i / doc.width);
        return isolation !== null && currentCel[i] !== isolation || selection && (x < selection.x || y < selection.y || x >= selection.x + selection.w || y >= selection.y + selection.h) ? currentCel[i] : value;
      });
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
    [lockTilePalette, doc, frame, layer, currentCel, selection, isolation]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (imagePreview) { setStatus("Aplique ou cancele a prévia da imagem antes de desenhar."); return; }
    rootRef.current?.focus();
    const at = toPixel(event);
    const right = event.button === 2;
    const value = right ? secondary : primary;
    const other = right ? primary : secondary;
    setStatus(null);
    if (tileMap) { setSelection({ x: Math.floor(at[0] / TILE) * TILE, y: Math.floor(at[1] / TILE) * TILE, w: TILE, h: TILE }); return; }
    if (tool === "background") { const next = erasePixelRegion(doc, editScope, at[0], at[1], backgroundTolerance); commit(next); setStatus(next === doc ? "Nenhum pixel apagado nesta região. Confira a camada, a seleção e a cor isolada." : "Região apagada por cor. Ctrl+Z restaura os pixels."); return; }
    if (tool === "picker") {
      const picked = composite[at[1] * doc.width + at[0]];
      if (right) setSecondary(picked);
      else setPrimary(picked);
      if (pixelIndex(picked) !== 0) setActiveLine(pixelLine(picked));
      return;
    }
    if (tool === "bucket") {
      commit(replaceCel(doc, frame, layer, guardTiles(floodFill(currentCel, doc.width, doc.height, at[0], at[1], value, selection))));
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
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      event.stopPropagation();
      void save();
      return;
    }
    if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      event.stopPropagation();
      redo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const match = PIXEL_TOOLS.find((t) => t.key.toLowerCase() === key);
    if (match) {
      setTool(match.id);
      setTileMap(false);
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
    else if (key === "+" || key === "=") setZoom((z) => Math.min(48, z + 1));
    else if (key === "-") setZoom((z) => Math.max(1, z - 1));
    else return;
    event.preventDefault();
  };

  // ── Abrir / salvar ──
  const importFromArt = async () => {
    if (!source) return;
    const request = ++importRequest.current;
    const startingDoc = docRef.current;
    const stillCurrent = () => mounted.current && request === importRequest.current
      && docRef.current === startingDoc && sourceIdentityRef.current === sourceIdentity;
    try {
      const pixelDoc = source.sourcePath.match(/(assets\/(?:sprites|tilesets)\/pixel\/[^/]+)\.png$/);
      if (pixelDoc && projectDir) {
        const json = await loadPixelArtDoc(projectDir, `${pixelDoc[1]}.rdspixel.json`);
        if (!stillCurrent()) return;
        if (json) {
          const opened = deserializePixelDoc(json);
          if (serializePixelDoc(opened) !== serializePixelDoc(docRef.current)) {
            commit(opened); setFrameIndex(0); setLayerIndex(0);
          }
          setSavedPath(`${pixelDoc[1]}.png`);
          setSavedSource(serializePixelDoc(opened));
          setStatus("Documento de pixel art reaberto com layers e frames.");
          return;
        }
      }
      const { doc: imported, warnings } = await importFramesFromSheet(source, activeLine, doc);
      if (!stillCurrent()) return;
      commit(imported);
      setFrameIndex(0);
      setLayerIndex(0);
      setSelection(null);
      setStatus(
        `${imported.frames.length} frame(s) de ${source.name} em PAL${activeLine}.` + (warnings.length ? ` ${warnings.join(" ")}` : "")
      );
    } catch (error) {
      if (!stillCurrent()) return;
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const autoOpenedSource = useRef("");
  const autoSourceIdentity = `${projectDir ?? ""}|${source?.sourcePath ?? ""}`;
  const openSourceRef = useRef(importFromArt);
  openSourceRef.current = importFromArt;
  useEffect(() => {
    if (source?.autoOpen && autoSourceIdentity !== autoOpenedSource.current) {
      autoOpenedSource.current = autoSourceIdentity;
      void openSourceRef.current();
    }
  }, [source?.autoOpen, autoSourceIdentity]);

  const reopenOriginal = async (conversion?: PixelConversion) => {
    if (!originalPath || !projectDir) return;
    const request = ++importRequest.current, snapshot = docRef.current;
    const stillCurrent = () => mounted.current && request === importRequest.current && docRef.current === snapshot && sourceIdentityRef.current === sourceIdentity;
    setStatus("Preparando novamente o original preservado…");
    try {
      const prepared = await prepareImage(projectDir,{path:originalPath,name:snapshot.name},snapshot.target === "plane" ? "background" : "sprite","keep",conversion ?? snapshot.conversionMethod);
      if (!stillCurrent() || !prepared.doc_json) return;
      const opened = deserializePixelDoc(prepared.doc_json); opened.name = snapshot.name;
      const layoutChanged = opened.width !== snapshot.width || opened.height !== snapshot.height || opened.frames.length !== snapshot.frames.length;
      commit(source?.autoOpen && layoutChanged ? copyPixelDoc(opened) : opened);setFrameIndex(0);setLayerIndex(0);setIsolation(null);setSelection(null);
      setStatus("Original reaberto com o fundo preservado. Ctrl+Z volta às edições anteriores; Salvar atualiza a cena.");
    } catch(e) { if (stillCurrent()) setStatus(e instanceof Error ? e.message : String(e)); }
  };

  const save = async () => {
    if (imagePreview) { setStatus("Aplique ou cancele a prévia antes de salvar."); return; }
    if (savingRef.current) return;
    if (!projectDir) {
      setStatus("Abra um projeto para salvar.");
      return;
    }
    const snapshot = docRef.current;
    const snapshotSource = serializePixelDoc(snapshot);
    const stillCurrent = () => mounted.current && projectIdentityRef.current === projectDir && sourceIdentityRef.current === sourceIdentity;
    savingRef.current = true;
    setSaving(true);
    try {
      const sheet = await exportSheetPng(snapshot);
      if (!stillCurrent()) return;
      const saved = await savePixelArtAsset(projectDir, snapshot.name, sheet.png, snapshotSource);
      if (!stillCurrent()) return;
      setSavedPath(saved.png_relative);
      setSavedSource(snapshotSource);
      log("success", `[Editor de pixels] ${saved.png_relative} (${snapshot.frames.length} frame(s), PAL${sheet.line}, PNG 4-bit).`);
      if (serializePixelDoc(docRef.current) === snapshotSource) {
        // The revision-bound save-state line is the single save indicator.
        // Tool errors (e.g. a rejected palette tile) keep their own feedback.
        setStatus(null);
        onSaved(saved.png_absolute, snapshot);
      } else setStatus("A versão anterior foi salva. Há novas alterações de pixels pendentes.");
    } catch (error) {
      if (!mounted.current) return;
      setStatus(`Falha ao salvar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const download = async () => {
    try {
    const sheet = await exportSheetPng(doc);
    const url = URL.createObjectURL(new Blob([sheet.png as BlobPart], { type: "image/png" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeSymbol(doc.name)}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const copyText = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    setStatus(`${what} copiado.`);
  };

  const exportLine = report.lineUsage[0]?.line ?? activeLine;
  const tileUnderCursor = hover ? report.tiles.find((t) => t.tx === Math.floor(hover[0] / TILE) && t.ty === Math.floor(hover[1] / TILE)) : null;
  const tilePoint = selection ? [selection.x, selection.y] : hover;
  const selectedTile = tilePoint ? tileReuse.find(t => t.tx === Math.floor(tilePoint[0] / TILE) && t.ty === Math.floor(tilePoint[1] / TILE)) : undefined;
  const usedByLine = (line: number) => report.lineUsage.find((u) => u.line === line)?.colors ?? 0;

  const swatch = (value: number) => pixelCss(doc, value);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="pixel-editor"
      data-dirty={String(!isSaved)}
      className="flex h-full min-h-0 flex-col gap-2 outline-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra do documento */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#313244] bg-[#111827] px-3 py-2 text-[10px] text-[#cdd6f4]">
        <input
          data-testid="pixel-doc-name"
          aria-label="Nome da imagem"
          value={doc.name}
          onChange={(e) => commit({ ...doc, name: sanitizeSymbol(e.target.value) })}
          className="w-32 rounded border border-[#313244] bg-[#0b0f19] px-2 py-1 font-mono"
          title="Nome do recurso (vira spr_<nome> no .res)"
        />
        <select
          data-testid="pixel-doc-target"
          aria-label="Uso da imagem"
          disabled={source?.autoOpen}
          value={doc.target}
          onChange={(e) => commit({ ...doc, target: e.target.value as PixelTarget })}
          className="rounded border border-[#313244] bg-[#0b0f19] px-1 py-1"
        >
          <option value="sprite">Personagem / objeto</option>
          <option value="plane">Cenário / fundo</option>
        </select>
        <select
          data-testid="pixel-doc-size"
          value={`${doc.width}x${doc.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split("x").map(Number);
            const resized = resizeDoc(doc, w, h); commit(source?.autoOpen ? copyPixelDoc(resized) : resized);
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
            className="max-w-48 truncate rounded border border-[#7dd3fc]/45 bg-[#7dd3fc]/10 px-2 py-1 text-[#7dd3fc] hover:bg-[#7dd3fc]/20"
            title="Traz os frames da sequência ativa, quantizados para a paleta ativa"
          >
            Reabrir recurso: {source.name}
          </button>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {originalPath && <button type="button" data-testid="pixel-reopen-original" onClick={()=>void reopenOriginal()} className="rounded border border-[#313244] px-2 py-1" title="Prepara outra vez a cópia original com o fundo, sem apagar suas edições anteriores do Desfazer">Reabrir original</button>}
          <button type="button" data-testid="pixel-remove-background" onClick={() => {
            const next = removePixelBackground(doc);
            commit(next);
            setStatus(next === doc ? "Nenhum fundo uniforme seguro foi identificado. Use a borracha para refinar." : "Fundo uniforme removido de todos os quadros. Ctrl+Z restaura os pixels.");
          }} className="rounded border border-[#313244] px-2 py-1" title="Remove a cor uniforme conectada às bordas em todos os quadros; permite desfazer">
            Remover fundo
          </button>
          <button type="button" onClick={undo} disabled={past.length === 0} className="rounded border border-[#313244] px-2 py-1 disabled:opacity-40" title="Desfazer (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} className="rounded border border-[#313244] px-2 py-1 disabled:opacity-40" title="Refazer (Ctrl+Y)">
            ↷
          </button>
          <button type="button" onClick={() => void download()} className="rounded border border-[#313244] px-2 py-1 hover:bg-[#1f2937]" title="Folha horizontal, PNG indexado 4-bit">
            Baixar PNG
          </button>
          {source?.autoOpen && <button type="button" data-testid="pixel-save-copy" disabled={saving || imagePreview !== null} onClick={() => { commit(copyPixelDoc(docRef.current)); void save(); }} className="rounded border border-[#313244] px-2 py-1 disabled:opacity-40" title="Cria outro recurso e aplica apenas à ocorrência selecionada">Salvar cópia</button>}
          <button
            type="button"
            data-testid="pixel-save"
            disabled={saving || imagePreview !== null}
            onClick={() => void save()}
            className="rounded border border-[#a6e3a1]/50 bg-[#a6e3a1]/15 px-3 py-1 font-semibold text-[#a6e3a1] hover:bg-[#a6e3a1]/25"
          >
            {imagePreview ? "Prévia em aberto" : saving ? "Salvando…" : isSaved ? "Salvo ✓" : source?.autoOpen ? "Salvar recurso" : "Salvar no projeto"}
          </button>
        </span>
      </div>
      <p data-testid="pixel-save-state" role="status" className="px-1 text-[10px] text-[#a6adc8]">
        {imagePreview ? "Prévia não aplicada · use Aplicar ou Cancelar no painel da imagem antes de salvar." : isSaved ? `PNG e documento salvos: ${savedPath}.` : "Pixels pendentes · mantidos nesta sessão ao trocar de ferramenta. Salve antes de fechar o aplicativo."}
        {" "}{source?.autoOpen ? "Salvar atualiza o recurso compartilhado; Salvar cópia aplica apenas à ocorrência selecionada. Mudanças de tamanho/recorte criam uma cópia." : "Salvar cria um recurso. Você pode adicioná-lo à cena pela biblioteca."}
      </p>

      <nav aria-label="Tarefas de edição de imagem" className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-[#313244] bg-[#111827] p-1 text-xs">
        {PIXEL_TASKS.map(t => <button type="button" key={t.id} data-testid={`pixel-task-${t.id}`} aria-pressed={task === t.id} onClick={() => { setTask(t.id); setTileMap(t.id === "tiles"); if (optionsRef.current) optionsRef.current.scrollTop = 0; }} className={`rounded-lg px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7dd3fc] ${task === t.id ? "bg-[#7dd3fc]/20 font-semibold text-[#7dd3fc]" : "text-[#cdd6f4] hover:bg-[#7dd3fc]/10"}`}>{t.label}</button>)}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-[142px_minmax(0,1fr)_minmax(260px,300px)] gap-2">
        {/* Ferramentas */}
        <div className="flex flex-col gap-1 overflow-y-auto rounded-xl border border-[#313244] bg-[#111827] p-1.5" data-testid="pixel-tools" aria-label="Ferramentas de desenho">
          <p className="px-2 py-1 text-[10px] font-semibold text-[#a6adc8]">DESENHAR E RECORTAR</p>
          {PIXEL_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`pixel-tool-${t.id}`}
              data-active={tool === t.id}
              onClick={() => { setTool(t.id); setTileMap(false); }}
              title={`${t.label} (${t.key}) — ${t.hint}`}
              aria-label={`${t.label} (${t.key})`}
              aria-pressed={tool === t.id}
              className={`flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7dd3fc] ${tool === t.id ? "bg-[#7dd3fc]/20 text-[#7dd3fc] ring-1 ring-[#7dd3fc]/60" : "text-[#cdd6f4] hover:bg-[#1f2937]"}`}
            >
              <Icon name={t.icon} size={21} className={`shrink-0 ${t.id === "line" ? "-rotate-45" : ""}`} />
              <span className="flex-1 text-left">{t.label}</span><kbd className="text-[9px] text-[#a6adc8]">{t.key}</kbd>
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
          <p className="px-1 text-xs text-[#a6adc8]" data-testid="pixel-tool-help"><strong className="text-[#cdd6f4]">{tileMap ? "Mapa de tiles" : PIXEL_TOOLS.find(t => t.id === tool)?.label}</strong> · {tileMap ? "Clique num tile para ver padrão, repetições e espelhos." : PIXEL_TOOLS.find(t => t.id === tool)?.hint}{isolation !== null ? " · Outras cores estão protegidas." : ""}</p>
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
              Quadros vizinhos
            </label>
            <label className="flex items-center gap-1"><input type="checkbox" data-testid="pixel-grid" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />Grade</label>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={fitCanvas} className="rounded border border-[#313244] px-1.5 py-1">Enquadrar</button>
              <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, z - 1))} className="rounded border border-[#313244] px-1.5">−</button>
              <span className="w-10 text-center" data-testid="pixel-zoom">{zoom}×</span>
              <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(48, z + 1))} className="rounded border border-[#313244] px-1.5">+</button>
            </span>
          </div>
          <div ref={stageRef} data-testid="pixel-stage" className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#313244] bg-[#0b0f19] p-3"><div className="flex min-h-full min-w-full w-max items-center justify-center">
            <canvas
              ref={canvasRef}
              data-testid="pixel-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHover(null)}
              onWheel={(e) => {
                if (!e.ctrlKey) return;
                setZoom((z) => Math.max(1, Math.min(48, z + (e.deltaY < 0 ? 1 : -1))));
              }}
              className="cursor-crosshair [image-rendering:pixelated]"
            />
          </div></div>
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
              <button type="button" data-testid="pixel-frame-add" disabled={source?.autoOpen && doc.target==="plane"} onClick={() => { commit(addFrame(doc, frame, false)); setFrameIndex(frame + 1); }} className="rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937] disabled:opacity-40">+ Novo</button>
              <button type="button" data-testid="pixel-frame-duplicate" disabled={source?.autoOpen && doc.target==="plane"} onClick={() => { commit(addFrame(doc, frame, true)); setFrameIndex(frame + 1); }} className="rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937] disabled:opacity-40">⧉ Duplicar</button>
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
        <div ref={optionsRef} aria-label="Opções da tarefa de edição" className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 text-xs text-[#cdd6f4]">
          <PixelImagePanel task={task} doc={doc} projectDir={projectDir} scope={editScope} primary={primary} assetLine={report.lineUsage[0]?.line ?? pixelLine(primary)} onPrimary={value => { setPrimary(value); setActiveLine(pixelLine(value)); }} originalAvailable={Boolean(originalPath)} onReconvert={method => void reopenOriginal(method)}
            onCommit={(next, base, separate) => { if (docRef.current !== base) { setStatus("A imagem mudou. Gere uma nova prévia; seu trabalho foi preservado."); return; } commit(separate && source?.autoOpen ? copyPixelDoc(next) : next); setImagePreview(null); setIsolation(null); }} onPreview={setImagePreview}
            onSelectLayer={setLayerIndex} onSelectTool={next => { setTool(next); setTileMap(false); }} onSelection={setSelection} onIsolation={setIsolation}
            tolerance={backgroundTolerance} onTolerance={setBackgroundTolerance} allFrames={allImageFrames} onAllFrames={setAllImageFrames}
            tileMap={tileMap} onTileMap={setTileMap} tileView={tileView} onTileView={setTileView} tiles={tileReuse} selectedTile={selectedTile}
            onTileTransform={type => { if (!selection) return; const cel = type === "rotate" ? rotateCel(currentCel, doc.width, doc.height, selection) : flipCel(currentCel, doc.width, doc.height, type === "h", selection); commit(replaceCel(doc, frame, layer, guardTiles(cel))); }} />
          <Section title={imagePreview ? "Antes de aplicar" : "Prévia"}>
            <div className="flex items-center justify-center rounded bg-[repeating-conic-gradient(#1e2433_0_25%,#272e40_0_50%)] bg-[length:12px_12px] p-2">
              <canvas ref={previewRef} data-testid="pixel-preview" className="max-h-48 max-w-full [image-rendering:pixelated]" />
            </div>
            {doc.target === "plane" && doc.frames.length === 1 ? <p className="mt-2 text-[#a6adc8]">Fundo estático · um quadro</p> : <>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded border border-[#313244] px-2">{playing ? "❚❚" : "▶"}</button>
              <input type="range" min={1} max={24} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="flex-1" />
              <span className="w-12 text-right">{fps} FPS</span>
            </div>
            <label className="mt-2 flex items-center justify-between gap-2">Duração do quadro (ms)
              <input type="number" data-testid="pixel-frame-duration" min={1} max={600000} value={doc.frames[frame].durationMs} onChange={e => {
                const ms = Math.max(1, Math.min(600000, Number(e.target.value) || 1));
                commit({ ...doc, frames: doc.frames.map((f,i) => i === frame ? { ...f, durationMs: ms } : f) });
              }} className="w-20 rounded border border-[#313244] bg-[#0b0f19] p-1"/>
            </label>
            <button
              type="button"
              className="mt-1 w-full rounded border border-[#313244] px-2 py-0.5 hover:bg-[#1f2937]"
              title="Grava a duração de todos os frames a partir do FPS"
              onClick={() => commit({ ...doc, frames: doc.frames.map((f) => ({ ...f, durationMs: Math.round(1000 / fps) })) })}
            >
              Aplicar {fps} FPS aos frames ({Math.max(1, Math.round(60 / fps))} ticks a 60 Hz)
            </button>
            </>}
          </Section>

          <Section title="Paletas · escolha uma cor" priority={task === "colors"}>
            <p className="mb-1 text-[#a6adc8]">Paleta ativa e paletas usadas nesta imagem. A posição 0 é transparente.</p>
            <div className="flex flex-col gap-1" data-testid="pixel-palettes">
              {doc.palettes.map((palette, line) => {
                const used = usedByLine(line);
                if (!showAllPalettes && line !== activeLine && used === 0) return null;
                return (
                  <div
                    key={line}
                    data-testid={`pixel-palette-line-${line}`}
                    data-active={activeLine === line}
                    className={`rounded-lg border p-1 ${activeLine === line ? "border-[#7dd3fc]/70 bg-[#7dd3fc]/5" : "border-[#313244]"}`}
                  >
                    <button type="button" onClick={() => setActiveLine(line)} className="flex w-full items-center justify-between text-left">
                      <span className="font-semibold">Paleta {line + 1} · {String.fromCharCode(65 + line)}</span>
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
                            onClick={(e) => { if (slot === 0) return; selectSlot(line, slot, false); if (e.shiftKey) setIsolation(value); }}
                            aria-label={slot === 0 ? `Paleta ${line + 1}, transparente` : `Paleta ${line + 1}, cor ${slot}, ${mdColorToCss(color)}`}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (slot > 0) selectSlot(line, slot, true);
                            }}
                            onDoubleClick={() => { setActiveLine(line); setEditingSlot(slot); }}
                            title={slot === 0 ? "Índice 0: transparente (em PAL0 também é a cor de fundo)" : `PAL${line}[${slot}] — duplo clique edita`}
                            className={`relative h-6 rounded-sm border ${isPrimary ? "border-white" : isSecondary ? "border-[#f9e2af]" : "border-black/40"}`}
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
            <button type="button" data-testid="pixel-show-all-palettes" aria-expanded={showAllPalettes} onClick={() => setShowAllPalettes(!showAllPalettes)} className="mt-1 rounded border border-[#313244] px-2 py-1">{showAllPalettes ? "Ocultar paletas sem uso" : "Mostrar as 4 paletas"}</button>
            <div className="mt-2 flex gap-2 text-xs"><button type="button" className="rounded border border-[#313244] px-2 py-1" onClick={() => { setIsolation(primary); setTask("colors"); }}>Isolar esta cor</button>{isolation !== null && <button type="button" className="rounded border border-[#313244] px-2 py-1" onClick={() => setIsolation(null)}>Mostrar todas</button>}</div>
            {editingSlot !== null ? (
              <ColorEditor
                color={doc.palettes[activeLine][editingSlot]}
                label={`PAL${activeLine}[${editingSlot}]`}
                onChange={(c) => setSlotColor(activeLine, editingSlot, c)}
                onClose={() => setEditingSlot(null)}
              />
            ) : (
              <p className="mt-1 text-[#a6adc8]">Clique escolhe a cor; Shift+clique isola. Duplo clique muda a cor em todos os quadros e camadas que usam esta posição.</p>
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

          <Section title="Uso estimado da imagem">
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
              <p className="mt-1 text-[#a6e3a1]" data-testid="pixel-hardware-ok">✓ Nenhum conflito de pixels detectado</p>
            )}
          </Section>

          <Section title="Camadas" priority={task === "layers"}>
            <p className="mb-2 text-xs text-[#a6adc8]">Editando: <strong>{doc.layers[layer].name}</strong>. Clique no número para escolher outra camada; a superior aparece na frente.</p>
            <div className="flex flex-col gap-0.5" data-testid="pixel-layers">
              {[...doc.layers].map((meta, i) => ({ meta, i })).reverse().map(({ meta, i }) => (
                <div key={meta.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${i === layer ? "bg-[#7dd3fc]/15" : ""}`}>
                  <button type="button" data-testid={`pixel-layer-select-${i}`} aria-pressed={i === layer} aria-label={`Editar camada ${meta.name}`} onClick={() => setLayerIndex(i)} className="min-h-7 min-w-7 rounded border border-[#313244]">{i + 1}</button>
                  <button
                    type="button"
                    onClick={() => commit({ ...doc, layers: doc.layers.map((l, li) => (li === i ? { ...l, visible: !l.visible } : l)) })}
                    title={meta.visible ? "Ocultar" : "Mostrar"}
                    aria-label={`${meta.visible ? "Ocultar" : "Mostrar"} camada ${meta.name}`}
                    className="min-h-7 w-7"
                  >
                    {meta.visible ? "◉" : "○"}
                  </button>
                  <input
                    value={meta.name}
                    aria-label={`Nome da camada ${i + 1}`}
                    onFocus={() => setLayerIndex(i)}
                    onChange={(e) => commit({ ...doc, layers: doc.layers.map((l, li) => (li === i ? { ...l, name: e.target.value } : l)) })}
                    className="min-w-0 flex-1 bg-transparent"
                  />
                  <button type="button" disabled={i === doc.layers.length - 1} className="min-h-7 min-w-7 disabled:opacity-40" aria-label={`Subir camada ${meta.name}`} onClick={() => { commit(moveLayer(doc, i, i + 1)); setLayerIndex(Math.min(doc.layers.length - 1, i + 1)); }} title="Subir">▲</button>
                  <button type="button" disabled={i === 0} className="min-h-7 min-w-7 disabled:opacity-40" aria-label={`Descer camada ${meta.name}`} onClick={() => { commit(moveLayer(doc, i, i - 1)); setLayerIndex(Math.max(0, i - 1)); }} title="Descer">▼</button>
                </div>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {LAYER_PRESETS.map((name) => (
                <button key={name} type="button" onClick={() => { try { commit(addLayer(doc, name)); setLayerIndex(doc.layers.length); } catch (e) { setStatus(String(e)); } }} className="rounded border border-[#313244] px-1.5 hover:bg-[#1f2937]">
                  + {name}
                </button>
              ))}
              <button type="button" disabled={doc.layers.length <= 1} onClick={() => { commit(removeLayer(doc, layer)); setLayerIndex(Math.max(0, layer - 1)); }} className="rounded border border-[#f38ba8]/40 px-1.5 text-[#f38ba8] disabled:opacity-40">
                Excluir camada
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1"><button type="button" data-testid="pixel-layer-duplicate" onClick={() => { try { commit(duplicatePixelLayer(doc, layer)); setLayerIndex(layer + 1); } catch (e) { setStatus(String(e)); } }} className="rounded border border-[#313244] p-1.5">Duplicar camada</button><button type="button" data-testid="pixel-layer-merge" disabled={layer === 0} onClick={() => { try { commit(mergePixelLayerDown(doc, layer)); setLayerIndex(layer - 1); } catch (e) { setStatus(String(e)); } }} className="rounded border border-[#313244] p-1.5 disabled:opacity-40">Unir à de baixo</button></div>
            <p className="mt-1 text-[#a6adc8]">Camadas são editáveis separadamente; o PNG junta as camadas visíveis. Duplicar, unir e excluir permitem Ctrl+Z.</p>
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

function Section({ title, children, priority = false }: { title: string; children: React.ReactNode; priority?: boolean }) {
  return (
    <section className="rounded-xl border border-[#313244] bg-[#111827] p-2" style={{ order: priority ? -10000 : 0 }}>
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
