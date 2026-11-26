import { useEffect, useMemo, useRef, useState } from "react";
import { occurrenceIds } from "../../core/characterTimeline";
import { imageAnimations } from "../../core/imageIngress";
import { deformSpriteArea, type DeformationSize, type SpriteSequenceBinding } from "../../core/pixelDeformation";
import { analyzeHardware, compositeFrame, type PixelDoc, type PixelEditScope, type PixelHardwareReport } from "../../core/pixelEditor";
import Icon, { type IconName } from "../common/Icon";
import PixelTransformHandles from "./PixelTransformHandles";

const tools = [
  { id: "horizontal", icon: "mirror-horizontal", label: "Espelhar horizontalmente", short: "Horizontal", key: "H" },
  { id: "vertical", icon: "mirror-vertical", label: "Espelhar verticalmente", short: "Vertical", key: "V" },
  { id: "scale", icon: "scale-area", label: "Ampliar ou diminuir a seleção", short: "Escala", key: "1" },
  { id: "warp", icon: "warp-area", label: "Deformar por alças", short: "Deformar", key: "2" },
  { id: "rotate", icon: "rotate-area", label: "Girar a seleção 90° no sentido horário", short: "Girar 90°", key: "3" },
] as const satisfies readonly { id: string; icon: IconName; label: string; short: string; key: string }[];
type Tool = typeof tools[number]["id"];

interface Props {
  doc: PixelDoc;
  scope: PixelEditScope;
  binding?: SpriteSequenceBinding;
  previous?: PixelDoc;
  hardware: PixelHardwareReport;
  onFull: () => void;
  onSelect: () => void;
  onFrame: (frame: number) => void;
  onPreview: (doc: PixelDoc | null) => void;
  onCommit: (doc: PixelDoc, base: PixelDoc, separate: boolean) => void;
}
const field = "min-w-0 w-full rounded border border-[var(--rds-border-subtle)] bg-[var(--rds-surface-panel)] p-1";
const button = "rounded border border-[var(--rds-border-subtle)] p-2 hover:bg-[#7dd3fc]/10 disabled:opacity-40";
type Proposal = ReturnType<typeof deformSpriteArea>;

export default function PixelDeformationPanel({ doc, scope, binding, previous, hardware, onSelect, onFull, onFrame, onPreview, onCommit }: Props) {
  const rect = scope.rect;
  const [width, setWidth] = useState(String(rect?.w ?? 1));
  const [height, setHeight] = useState(String(rect?.h ?? 1));
  const [shear, setShear] = useState("0");
  const [bend, setBend] = useState("0");
  const [tool, setTool] = useState<Tool>("scale");
  const [proportional, setProportional] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const activeTool = tools.find(t => t.id === tool)!;
  const [sequence, setSequence] = useState(false);
  const [chosen, setChosen] = useState(binding?.animation);
  const [occurrence, setOccurrence] = useState(binding?.occurrence);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [message, setMessage] = useState("");
  const preview = useRef(onPreview); preview.current = onPreview;
  const definitions = binding?.animations;
  const animations = useMemo(() => {
    try { return definitions && previous ? imageAnimations(definitions, doc, previous) : {}; }
    catch { return {}; }
  }, [definitions, doc, previous]);
  const names = Object.keys(animations).filter(name => animations[name].frames.length && !animations[name].mugen_frames);
  const name = chosen && names.includes(chosen) ? chosen : names[0];
  const animation = animations[name], ids = animation ? occurrenceIds(animation) : [];
  const index = ids.findIndex((id, i) => id === occurrence && animation.frames[i] === scope.frame);
  const active = ids[index < 0 ? animation?.frames.indexOf(scope.frame) : index];
  useEffect(() => {
    setWidth(String(rect?.w ?? 1)); setHeight(String(rect?.h ?? 1)); setShear("0"); setBend("0");
  }, [rect?.x, rect?.y, rect?.w, rect?.h]);
  useEffect(() => {
    setProposal(null); setMessage(""); preview.current(null);
    return () => preview.current(null);
  }, [doc, rect, scope.frame, scope.layer, scope.color, width, height, shear, bend, tool, sequence, active, name, animations]);
  useEffect(() => {
    const editor = panel.current?.closest<HTMLElement>('[data-testid="pixel-editor"]');
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || (e.target as Element)?.closest("input, select, textarea, [contenteditable=true]")) return;
      const item = tools.find(t => t.key.toLowerCase() === e.key.toLowerCase());
      if (!item) return;
      e.preventDefault(); e.stopPropagation(); setTool(item.id);
    };
    editor?.addEventListener("keydown", keydown, true);
    return () => editor?.removeEventListener("keydown", keydown, true);
  }, []);
  const geom: DeformationSize = {
    width: tool === "scale" ? Number(width) : tool === "rotate" ? rect?.h ?? 1 : rect?.w ?? 1,
    height: tool === "scale" ? Number(height) : tool === "rotate" ? rect?.w ?? 1 : rect?.h ?? 1,
    shear: tool === "warp" ? Number(shear) : 0, bend: tool === "warp" ? Number(bend) : 0,
    mirror: tool === "horizontal" || tool === "vertical" ? tool : undefined, quarterTurn: tool === "rotate",
  };
  const generate = () => {
    try {
      if ((tool === "scale" && (!width || !height)) || (tool === "warp" && (!shear || !bend))) throw new Error("Preencha as medidas em pixels.");
      const result = deformSpriteArea(doc, scope, geom, sequence, binding && { ...binding, animation: name, occurrence: active }, previous);
      setProposal(result.doc === doc ? null : result);
      onPreview(result.doc === doc ? null : result.preview);
      setMessage(result.doc === doc ? "A seleção ficou com os mesmos pixels." : "");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  };
  const after = useMemo(() => proposal ? analyzeHardware(proposal.doc, proposal.currentFrame) : hardware, [proposal, hardware]);
  const poseColors = (image: PixelDoc, frame: number) => { const colors = new Set(compositeFrame(image, frame)); colors.delete(0); return colors.size; };
  const beforeColors = useMemo(() => poseColors(doc, scope.frame), [doc, scope.frame]);
  const afterColors = useMemo(() => proposal ? poseColors(proposal.doc, proposal.currentFrame) : beforeColors, [proposal, beforeColors]);
  const pair = (a: number, b: number) => proposal ? `${a} → ${b}` : a;
  const occupied = (report: PixelHardwareReport) => report.tiles.reduce((n, t) => n + Number(!t.empty), 0);
  const setSize = (w: number, h: number, axis: "width" | "height" = "width") => {
    if (rect && proportional) {
      const ratio = Math.min(axis === "width" ? w / rect.w : h / rect.h, doc.width / rect.w, doc.height / rect.h);
      w = Math.max(1, Math.round(rect.w * ratio)); h = Math.max(1, Math.round(rect.h * ratio));
    }
    setWidth(String(w)); setHeight(String(h));
  };
  return <section ref={panel} data-testid="pixel-deformation" aria-label="Transformar seleção" className="order-first flex flex-col gap-2 rounded-xl border border-[#7dd3fc]/45 p-3">
    <div className="grid grid-cols-5 gap-1" role="group" aria-label="Ferramentas de transformação">
      {tools.map(t => <button type="button" key={t.id} data-testid={`transform-${t.id}`} title={`${t.label} (${t.key})`}
        aria-label={t.label} aria-keyshortcuts={t.key} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}
        className={`flex min-w-0 flex-col items-center justify-center rounded border py-1 focus-visible:outline focus-visible:outline-2 ${tool===t.id ? "border-[#7dd3fc] bg-[#7dd3fc]/15" : "border-[var(--rds-border-subtle)]"}`}>
        <Icon name={t.icon} size={20}/><span className="text-[10px]">{t.short}</span></button>)}
    </div>
    <div className="flex gap-2"><button type="button" className={button} onClick={onSelect}>Marcar área</button>
      <button type="button" className={button} data-testid="transform-full-frame" onClick={onFull}>Quadro inteiro</button></div>
    {binding && <div className="grid grid-cols-2 gap-2">
      <label>Animação<select className={field} value={name ?? ""} onChange={e => { const def = animations[e.target.value]; setChosen(e.target.value); setOccurrence(occurrenceIds(def)[0]); onFrame(def.frames[0]); }}>
        {names.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Ocorrência<select className={field} value={active ?? ""} onChange={e => { setOccurrence(e.target.value); onFrame(animation.frames[ids.indexOf(e.target.value)]); }}>
        {!active && <option value="">Escolher pose</option>}{ids.map(id => <option key={id}>{id}</option>)}</select></label>
    </div>}
    <label>Aplicar a<select className={field} data-testid="deform-scope" value={sequence ? "sequence" : "pose"} onChange={e => setSequence(e.target.value === "sequence")}>
      <option value="pose">{binding ? "Somente esta ocorrência" : "Somente este quadro"}</option>
      <option value="sequence">{binding ? "Toda esta animação" : "Todos os quadros do documento"}</option>
    </select></label>
    {rect ? <>
      <span>{doc.layers[scope.layer]?.name} · seleção {rect.w} × {rect.h} px</span>
      {(tool === "scale" || tool === "warp") && <PixelTransformHandles doc={proposal?.preview ?? doc} frame={scope.frame}
        rect={rect} geometry={geom} warp={tool === "warp"} onSize={setSize} onWarp={(s, b) => { setShear(String(s)); setBend(String(b)); }} />}
      {tool === "scale" && <>
        <div className="grid grid-cols-2 gap-2">{(["Largura", "Altura"] as const).map((label, i) => <label key={label}>{label} (px)
          <input name={label} type="number" className={field} min={1} max={i ? doc.height : doc.width} value={i ? height : width}
            onChange={e => { const v = e.target.value; if (!v) (i ? setHeight : setWidth)("");
              else setSize(i ? Number(width) : Number(v), i ? Number(v) : Number(height), i ? "height" : "width"); }} /></label>)}</div>
        <label><input type="checkbox" checked={proportional} onChange={e => setProportional(e.target.checked)} /> Manter proporção</label>
      </>}
      {tool === "warp" && <div className="grid grid-cols-2 gap-2">{([["Inclinação", shear, setShear], ["Curvatura", bend, setBend]] as const).map(([label, value, set]) =>
        <label key={label}>{label} (px)<input type="number" name={label} className={field} min={-doc.width} max={doc.width} value={value} onChange={e => set(e.target.value)} /></label>)}</div>}
    </> : <p>Arraste sobre a imagem para selecionar os pixels.</p>}
    <button type="button" data-testid="deform-preview" className={button} disabled={!rect || Boolean(binding && !active)} onClick={generate}>Prévia · {activeTool.short}</button>
    {proposal && <div className="flex gap-2">
      <button type="button" data-testid="pixel-apply-image" className={button} onClick={() => { onCommit(proposal.doc, doc, true); onFrame(proposal.currentFrame); }}>Aplicar</button>
      <button type="button" data-testid="pixel-cancel-image" className={button} onClick={() => { setProposal(null); onPreview(null); }}>Cancelar</button>
    </div>}
    <output data-testid="transform-cost" aria-live="polite" className="rounded border border-[var(--rds-border-subtle)] p-2">
      <strong>{proposal ? "Antes → prévia" : "Arte atual"}</strong>
      <div>Pose · tiles ocupados {pair(occupied(hardware), occupied(after))} · cores {pair(beforeColors, afterColors)}</div>
      <div>Atlas · padrões únicos {pair(hardware.uniqueTiles, after.uniqueTiles)} · cores {pair(hardware.uniqueColors, after.uniqueColors)}</div>
    </output>
    {message && <p role="status">{message}</p>}
  </section>;
}
