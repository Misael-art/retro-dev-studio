import { useEffect, useRef, useState } from "react";
import { chooseImagePath } from "../../core/sceneryImport";
import { IMAGE_CONVERSIONS, prepareImage } from "../../core/imageIngress";
import { addLayer, deserializePixelDoc, mdColorToCss, mdLevelTo8, packPixel, pixelLine, quantizeRgba, removePixelBackground, type PixelConversion, type PixelDoc, type PixelRect, type PixelTileReuse } from "../../core/pixelEditor";
import { addPixelBorder, applyPixelEffect, collagePixelDoc, cropPixelDoc, effectRgb, PIXEL_EFFECTS, rotatePixelDoc, scalePixelDoc, unifyPixelPalettes, type PixelEditScope } from "../../core/pixelImageOps";

export type PixelTask = "draw" | "image" | "colors" | "compose" | "layers" | "tiles";
export const PIXEL_TASKS: { id: PixelTask; label: string }[] = [
  { id: "draw", label: "Desenhar" }, { id: "image", label: "Imagem e fundo" },
  { id: "colors", label: "Cores e filtros" }, { id: "compose", label: "Colagem e texto" },
  { id: "layers", label: "Camadas" }, { id: "tiles", label: "Otimizar tiles" },
];
export type PixelTileView = "repeated" | "mirrored" | "exclusive" | "conflicts";

interface Props {
  task: PixelTask;
  doc: PixelDoc;
  projectDir: string | null;
  scope: PixelEditScope;
  primary: number;
  assetLine: number;
  onPrimary: (value: number) => void;
  originalAvailable: boolean;
  onReconvert: (method: PixelConversion) => void;
  onCommit: (next: PixelDoc, base: PixelDoc, separateResource?: boolean) => void;
  onPreview: (doc: PixelDoc | null) => void;
  onSelectLayer: (index: number) => void;
  onSelectTool: (tool: "select" | "move" | "background") => void;
  onSelection: (rect: PixelRect | null) => void;
  onIsolation: (value: number | null) => void;
  tolerance: number;
  onTolerance: (n: number) => void;
  allFrames: boolean;
  onAllFrames: (b: boolean) => void;
  tileMap: boolean;
  onTileMap: (b: boolean) => void;
  tileView: PixelTileView;
  onTileView: (mode: PixelTileView) => void;
  tiles: PixelTileReuse[];
  selectedTile?: PixelTileReuse;
  onTileTransform: (type: "h" | "v" | "rotate") => void;
}

const button = "rounded-lg border border-[#313244] px-2 py-2 text-left hover:bg-[#7dd3fc]/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7dd3fc]";
const input = "min-w-0 rounded border border-[#313244] bg-[#0b0f19] px-2 py-1";

/** Contextual controls use the same document/history/publisher as drawing. */
export default function PixelImagePanel(p: Props) {
  const { doc, scope, task } = p;
  const [proposal, setProposal] = useState<{ base: PixelDoc; next: PixelDoc; label: string; clearsSelection: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [brightness, setBrightness] = useState(0), [contrast, setContrast] = useState(0);
  const [width, setWidth] = useState(doc.width), [height, setHeight] = useState(doc.height);
  const [proportional, setProportional] = useState(true);
  const [conversion, setConversion] = useState<PixelConversion>(doc.conversionMethod ?? "balanced");
  const [text, setText] = useState("Seu texto"), [fontSize, setFontSize] = useState(16), [thickness, setThickness] = useState(1);
  const [busy, setBusy] = useState(false);
  const current = useRef({ doc, project: p.projectDir }); current.current = { doc, project: p.projectDir };
  const request = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
  const previewCallback = useRef(p.onPreview); previewCallback.current = p.onPreview;
  useEffect(() => {
    setProposal(null); previewCallback.current(null); setWidth(doc.width); setHeight(doc.height);
    setConversion(doc.conversionMethod ?? "balanced");
  }, [doc, task, scope.frame, scope.layer, scope.allFrames, scope.rect, scope.color, p.tolerance]);

  const show = (next: PixelDoc, label: string, clearsSelection = false) => {
    if (next === doc) { setProposal(null); p.onPreview(null); setMessage(label.startsWith("Remover fundo") ? "Não foi identificado um fundo uniforme seguro nesta região. Ajuste a tolerância ou use Apagar uma região." : "Nenhum pixel foi alterado nesta região/camada."); return; }
    setMessage(""); setProposal({ base: doc, next, label, clearsSelection }); p.onPreview(next);
  };
  const run = (fn: () => PixelDoc, label: string, clearsSelection = false) => {
    try { show(fn(), label, clearsSelection); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  };
  const finish = (next: PixelDoc, base = doc, separateResource = false) => {
    p.onCommit(next, base, separateResource); p.onPreview(null); setProposal(null); setMessage("Alteração aplicada. Ctrl+Z desfaz; Salvar atualiza o recurso.");
    if (next.layers.length > base.layers.length) p.onSelectLayer(next.layers.length - 1);
  };
  const effect = (id: Parameters<typeof applyPixelEffect>[2]) => {
    try {
      const result = applyPixelEffect(doc, scope, id, { brightness, contrast });
      show(result.doc, PIXEL_EFFECTS.find(e => e.id === id)?.name ?? "Brilho e contraste");
      if (result.approximated) setMessage(`${result.approximated} pixels aproximados às cores disponíveis. As cores usadas fora da edição foram preservadas.`);
    } catch (e) { setMessage(String(e)); }
  };
  const addImage = async () => {
    const operation = ++request.current, base = doc, project = p.projectDir;
    if (!project) { setMessage("Abra um projeto para preservar o original da colagem."); return; }
    const valid = () => mounted.current && operation === request.current && current.current.doc === base && current.current.project === project;
    setBusy(true); setMessage("");
    try {
      const path = await chooseImagePath(true);
      if (!path || !valid()) return;
      const probe = await prepareImage(project, { path, name: path.split(/[\\/]/).pop() });
      if (!valid()) return;
      const prepared = await prepareImage(project, { path: `${project}/${probe.source_relative}`, name: probe.name }, probe.frame_count > 1 ? "sprite" : "background", "keep", conversion);
      if (!valid() || !prepared.doc_json) return;
      const next = collagePixelDoc(base, deserializePixelDoc(prepared.doc_json), scope.frame, p.assetLine);
      finish(next, base); p.onSelectLayer(next.layers.length - 1); p.onSelectTool("move");
      setMessage("Imagem centralizada em uma camada independente. Arraste com Mover; as cores anteriores foram preservadas.");
    } catch (e) { if (valid()) setMessage(e instanceof Error ? e.message : String(e)); }
    finally { if (mounted.current && request.current === operation) setBusy(false); }
  };
  const addText = () => {
    if (!text.trim()) { setMessage("Escreva o texto antes de adicionar."); return; }
    if (p.primary % 16 === 0) { setMessage("Escolha uma cor visível antes de adicionar texto."); return; }
    const canvas = document.createElement("canvas"); canvas.width = doc.width; canvas.height = doc.height;
    const ctx = canvas.getContext("2d"); if (!ctx) { setMessage("O canvas de texto está indisponível."); return; }
    ctx.font = `bold ${fontSize}px monospace`; ctx.textBaseline = "top";
    ctx.fillStyle = mdColorToCss(doc.palettes[pixelLine(p.primary)][p.primary % 16]);
    ctx.fillText(text, scope.rect?.x ?? 2, scope.rect?.y ?? 2, doc.width - (scope.rect?.x ?? 2));
    const line = p.assetLine, next = addLayer(doc, `Texto — ${text.slice(0, 24)}`);
    next.frames[scope.frame].cels[next.layers.length - 1] = quantizeRgba(ctx.getImageData(0, 0, doc.width, doc.height).data, doc.width, doc.height, line, doc.palettes[line], { lockedSlots: Array.from({ length: 15 }, (_, i) => i + 1) }).pixels;
    finish(next); p.onSelectLayer(next.layers.length - 1); p.onSelectTool("move"); setMessage("Texto rasterizado em uma camada: mova ou edite os pixels. Ctrl+Z recupera a etapa anterior.");
  };
  const border = (outline: boolean) => {
    if (p.primary % 16 === 0) { setMessage("Escolha uma cor visível para a borda."); return; }
    const rgb = doc.palettes[pixelLine(p.primary)][p.primary % 16].map(mdLevelTo8);
    const value = quantizeRgba(Uint8Array.from([...rgb, 255]), 1, 1, p.assetLine, doc.palettes[p.assetLine], { lockedSlots: Array.from({ length: 15 }, (_, i) => i + 1) }).pixels[0];
    run(() => addPixelBorder(doc, scope, value, thickness, outline), outline ? "Contorno em nova camada" : "Moldura em nova camada");
  };

  if (task === "draw" || task === "layers") return null;
  const visibleTiles = p.tiles.filter(t => !t.empty), unique = new Set(visibleTiles.map(t => t.pattern)).size;
  const tileMatches = visibleTiles.filter(t => p.tileView === "repeated" ? t.copies > 1 : p.tileView === "mirrored" ? t.flip !== "original" : p.tileView === "exclusive" ? t.exclusiveColors > 0 : t.lines.length > 1).length;
  return <section data-testid="pixel-image-panel" className="order-first rounded-xl border border-[#7dd3fc]/45 bg-[#111827] p-3 text-xs text-[#cdd6f4]">
    <h3 className="mb-2 text-sm font-semibold">{PIXEL_TASKS.find(t => t.id === task)?.label}</h3>
    <p className="mb-3 text-[#a6adc8]">{doc.layers[scope.layer]?.name}{doc.layers[scope.layer]?.visible ? "" : " (oculta — mostre em Camadas para ver as alterações)"} · {p.allFrames ? "todos os quadros" : `quadro ${scope.frame + 1}`} · {scope.rect ? `seleção ${scope.rect.w}×${scope.rect.h}` : "imagem inteira"}{scope.color != null ? ` · só a cor ${scope.color % 16} da paleta ${pixelLine(scope.color) + 1}` : ""}</p>
    {task !== "tiles" && doc.frames.length > 1 && <label className="mb-3 flex items-center gap-2"><input type="checkbox" checked={p.allFrames} onChange={e => p.onAllFrames(e.target.checked)} />Editar esta camada em todos os quadros</label>}
    {task === "image" && <div className="flex flex-col gap-3">
      <button type="button" className={button} data-testid="pixel-auto-background" onClick={() => run(() => removePixelBackground(doc, p.tolerance, scope), "Remover fundo conectado às bordas")}>Remover fundo automático</button>
      <p className="text-[#a6adc8]">Detecta fundo uniforme nas bordas da região e camada escolhidas. Em fotos com cenários complexos, refine por cor ou seleção; o recorte automático de objetos ainda não está disponível.</p>
      <label>Tolerância de cor: {p.tolerance}<input aria-label="Tolerância do recorte" type="range" min={0} max={110} value={p.tolerance} onChange={e => p.onTolerance(Number(e.target.value))} className="block w-full" /></label>
      <button type="button" className={button} onClick={() => p.onSelectTool("background")}>Apagar uma região: clicar no fundo</button>
      <div className="grid grid-cols-2 gap-2"><button type="button" className={button} onClick={() => p.onSelectTool("select")}>Selecionar recorte</button><button type="button" className={button} disabled={!scope.rect} data-testid="pixel-crop" onClick={() => run(() => cropPixelDoc(doc, scope.rect!), "Cortar todos os quadros e camadas", true)}>Cortar seleção</button></div>
      <p className="text-[#a6adc8]">Cortar, girar e redimensionar mantêm os quadros/camadas alinhados, em múltiplos de 8. Imagens da cena recebem uma cópia para proteger os outros usos do recurso.</p>
      <button type="button" className={button} data-testid="pixel-rotate-image" onClick={() => run(() => rotatePixelDoc(doc), "Girar imagem 90°", true)}>Girar imagem 90°</button>
      <div className="grid grid-cols-2 gap-2"><label>Largura<input aria-label="Largura da imagem" type="number" min={8} max={512} value={width} onChange={e => { const n = Number(e.target.value); setWidth(n); if (proportional) setHeight(Math.round(n * doc.height / doc.width)); }} className={`${input} w-full`} /></label><label>Altura<input aria-label="Altura da imagem" type="number" min={8} max={512} value={height} onChange={e => { const n = Number(e.target.value); setHeight(n); if (proportional) setWidth(Math.round(n * doc.width / doc.height)); }} className={`${input} w-full`} /></label></div>
      <label className="flex gap-2"><input type="checkbox" checked={proportional} onChange={e => setProportional(e.target.checked)} />Manter proporção</label>
      <button type="button" className={button} data-testid="pixel-resize-image" onClick={() => run(() => scalePixelDoc(doc, width, height), "Redimensionar conteúdo sem suavizar pixels", true)}>Redimensionar imagem</button>
      <label>Converter o original com<select aria-label="Método de conversão" value={conversion} onChange={e => setConversion(e.target.value as PixelConversion)} className={`${input} mt-1 w-full`}>{IMAGE_CONVERSIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <p className="text-[#a6adc8]">{IMAGE_CONVERSIONS.find(m => m.id === conversion)?.description}</p>
      <button type="button" disabled={!p.originalAvailable} className={button} data-testid="pixel-reconvert" onClick={() => p.onReconvert(conversion)}>Reconverter original preservado</button>
    </div>}
    {task === "colors" && <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2"><button type="button" className={button} data-testid="pixel-isolate-color" onClick={() => p.onIsolation(p.primary)}>Isolar cor escolhida</button><button type="button" className={button} onClick={() => p.onIsolation(null)}>Mostrar todas</button></div>
      <p className="text-[#a6adc8]">As outras cores ficam esmaecidas e protegidas. Combine com Seleção para editar só uma região. A prévia e o PNG final conservam todas as cores.</p>
      <label>Brilho: {brightness}<input type="range" aria-label="Brilho" min={-100} max={100} value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="block w-full" /></label>
      <label>Contraste: {contrast}<input type="range" aria-label="Contraste" min={-100} max={100} value={contrast} onChange={e => setContrast(Number(e.target.value))} className="block w-full" /></label>
      <button type="button" className={button} data-testid="pixel-preview-adjust" onClick={() => effect("adjust")}>Visualizar ajustes</button>
      <div className="grid grid-cols-2 gap-2">{PIXEL_EFFECTS.map(f => <button type="button" key={f.id} className={button} title={f.hint} data-testid={`pixel-filter-${f.id}`} onClick={() => effect(f.id)}><span className="mb-1 flex overflow-hidden rounded" aria-hidden>{[0, 64, 128, 192, 255].map(n => <span key={n} className="h-2 flex-1" style={{ backgroundColor: `rgb(${effectRgb([n, n * .7, n * .4], f.id).map(v => Math.round(Math.max(0, Math.min(255, v)))).join(",")})` }} />)}</span>{f.name}</button>)}</div>
      <p className="text-[#a6adc8]">Cores e efeitos são adaptados a 15 cores por paleta. Edições locais preservam as cores usadas nas outras regiões, camadas e quadros; a prévia informa aproximações.</p>
      <button type="button" className={button} onClick={() => run(() => unifyPixelPalettes(doc), "Unificar paletas do recurso inteiro")}>Unificar paletas</button>
      <p className="text-[#a6adc8]">Converte todas as camadas, inclusive ocultas, e todos os quadros para uma paleta comum de até 15 cores + transparência. A redução pode aproximar cores; confira antes de aplicar. Necessário para salvar PNG quando a arte mistura paletas incompatíveis.</p>
    </div>}
    {task === "compose" && <div className="flex flex-col gap-3">
      <button type="button" className={button} disabled={busy} data-testid="pixel-collage" onClick={() => void addImage()}>{busy ? "Preparando imagem…" : "Adicionar imagem / adesivo"}</button>
      <p className="text-[#a6adc8]">Cada imagem entra em uma camada independente, ajustada ao canvas e às cores atuais. Escolha PNG com transparência para um adesivo; Mover arrasta a camada.</p>
      <label>Texto<input data-testid="pixel-text" aria-label="Texto da camada" maxLength={120} value={text} onChange={e => setText(e.target.value)} className={`${input} mt-1 w-full`} /></label>
      <div role="group" aria-label="Cor do texto e da borda"><p className="mb-1">Cor do texto e da borda · paleta {p.assetLine + 1}</p><div className="grid grid-cols-8 gap-1">{doc.palettes[p.assetLine].slice(1).map((color, i) => <button type="button" key={i} aria-label={`Cor de texto ${i + 1}: ${mdColorToCss(color)}`} aria-pressed={p.primary === packPixel(p.assetLine, i + 1)} onClick={() => p.onPrimary(packPixel(p.assetLine, i + 1))} className={`h-7 rounded border focus-visible:outline focus-visible:outline-2 ${p.primary === packPixel(p.assetLine, i + 1) ? "ring-2 ring-[#7dd3fc]" : "border-[#313244]"}`} style={{background:mdColorToCss(color)}} />)}</div></div>
      <label>Tamanho do texto<input aria-label="Tamanho do texto" type="number" min={6} max={96} value={fontSize} onChange={e => setFontSize(Math.max(6, Math.min(96, Number(e.target.value) || 6)))} className={`${input} ml-2 w-16`} /></label>
      <button type="button" className={button} data-testid="pixel-add-text" onClick={() => { try { addText(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } }}>Adicionar texto na cor escolhida</button>
      <label>Espessura: {thickness}px<input aria-label="Espessura da borda" type="range" min={1} max={8} value={thickness} onChange={e => setThickness(Number(e.target.value))} className="block w-full" /></label>
      <div className="grid grid-cols-2 gap-2"><button type="button" data-testid="pixel-add-border" className={button} onClick={() => border(false)}>Moldura</button><button type="button" data-testid="pixel-add-outline" className={button} onClick={() => border(true)}>Contorno do objeto</button></div>
    </div>}
    {task === "tiles" && <div className="flex flex-col gap-3">
      <label className="flex gap-2"><input type="checkbox" data-testid="pixel-tile-map" checked={p.tileMap} onChange={e => p.onTileMap(e.target.checked)} />Mostrar mapa de tiles 8×8</label>
      <label>Destacar<select aria-label="Informação do mapa de tiles" value={p.tileView} onChange={e => p.onTileView(e.target.value as PixelTileView)} className={`${input} mt-1 w-full`}><option value="repeated">Padrões repetidos</option><option value="mirrored">Reutilização com espelho</option><option value="exclusive">Cores exclusivas de um tile</option><option value="conflicts">Mistura de paletas</option></select></label>
      <p>{unique} padrões únicos / {visibleTiles.length} tiles visíveis. Economia potencial de {(Math.max(0, visibleTiles.length - unique) * 32 / 1024).toFixed(2)} KB em padrões deste quadro.</p>
      <p>{tileMatches} tiles correspondem ao destaque atual. Amplie para 3× para ver os números no mapa.</p>
      <p className="text-[#a6adc8]">Verde: repetição · roxo: espelho · amarelo: cor exclusiva · vermelho: conflito. Transparência não conta como cor. Clique num tile para inspecionar e editar.</p>
      {p.selectedTile && <div data-testid="pixel-tile-inspector" className="rounded border border-[#313244] p-2">Tile {p.selectedTile.id + 1} · ({p.selectedTile.tx}, {p.selectedTile.ty})<br />Padrão {p.selectedTile.pattern + 1} · {p.selectedTile.copies} usos · {p.selectedTile.flip}<br />{p.selectedTile.colors} cores · {p.selectedTile.exclusiveColors} exclusivas · paleta {p.selectedTile.lines.map(l => l + 1).join(", ") || "vazia"}</div>}
      <div className="grid grid-cols-3 gap-1">{([['h', 'Espelhar H'], ['v', 'Espelhar V'], ['rotate', 'Girar 90°']] as const).map(([id, label]) => <button type="button" key={id} disabled={!p.selectedTile} className={button} onClick={() => p.onTileTransform(id)}>{label}</button>)}</div>
      <button type="button" className={button} onClick={() => p.onSelection(null)}>Limpar seleção do tile</button>
      <p className="text-[#a6adc8]">Os botões acima alteram a arte. O compilador SGDK pode compartilhar padrões e espelhos H/V mantendo a imagem. Rotação 90° não é um recurso gratuito do VDP. A estimativa não inclui mapas, sprites, fonte ou reservas da cena; confira o build real.</p>
    </div>}
    {message && <p role="status" data-testid="pixel-image-message" className="mt-3 text-[#f9e2af]">{message}</p>}
    {proposal && <div data-testid="pixel-image-proposal" className="sticky bottom-0 mt-3 rounded-lg border border-[#7dd3fc]/60 bg-[#111827] p-2"><p className="mb-2">Prévia: {proposal.label}. Nada foi salvo.</p><div className="flex gap-2"><button type="button" data-testid="pixel-apply-image" className={`${button} bg-[#7dd3fc]/20`} onClick={() => { if (proposal.base !== doc) { setMessage("A imagem mudou. Gere outra prévia."); return; } finish(proposal.next, proposal.base, proposal.clearsSelection); if (proposal.clearsSelection) p.onSelection(null); }}>Aplicar</button><button type="button" className={button} data-testid="pixel-cancel-image" onClick={() => { setProposal(null); p.onPreview(null); setMessage("Prévia cancelada; pixels preservados."); }}>Cancelar</button></div></div>}
  </section>;
}
