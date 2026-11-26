import { useEffect, useMemo, useRef, useState } from "react";
import { occurrenceIds } from "../../core/characterTimeline";
import { imageAnimations } from "../../core/imageIngress";
import { deformSpriteArea, type SpriteSequenceBinding } from "../../core/pixelDeformation";
import type { PixelDoc, PixelEditScope } from "../../core/pixelEditor";

interface Props {
  doc: PixelDoc;
  scope: PixelEditScope;
  binding?: SpriteSequenceBinding;
  previous?: PixelDoc;
  onSelect: () => void;
  onFrame: (frame: number) => void;
  onPreview: (doc: PixelDoc | null) => void;
  onCommit: (doc: PixelDoc, base: PixelDoc, separate: boolean) => void;
}
const field = "min-w-0 w-full rounded border border-[var(--rds-border-subtle)] bg-[var(--rds-surface-panel)] p-1";
const button = "rounded border border-[var(--rds-border-subtle)] p-2 hover:bg-[#7dd3fc]/10 disabled:opacity-40";
type Proposal = ReturnType<typeof deformSpriteArea>;

export default function PixelDeformationPanel({ doc, scope, binding, previous, onSelect, onFrame, onPreview, onCommit }: Props) {
  const rect = scope.rect;
  const [width, setWidth] = useState(String(rect?.w ?? 1));
  const [height, setHeight] = useState(String(rect?.h ?? 1));
  const [shear, setShear] = useState("0");
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
    setWidth(String(rect?.w ?? 1)); setHeight(String(rect?.h ?? 1)); setShear("0");
  }, [rect?.x, rect?.y, rect?.w, rect?.h]);
  useEffect(() => {
    setProposal(null); setMessage(""); preview.current(null);
    return () => preview.current(null);
  }, [doc, rect, scope.frame, scope.layer, scope.color, width, height, shear, sequence, active, name, animations]);
  const generate = () => {
    try {
      if (!width || !height || !shear) throw new Error("Preencha as três medidas em pixels.");
      const result = deformSpriteArea(doc, scope, { width: Number(width), height: Number(height), shear: Number(shear) },
        sequence, binding && { ...binding, animation: name, occurrence: active }, previous);
      setProposal(result.doc === doc ? null : result);
      onPreview(result.doc === doc ? null : result.preview);
      setMessage(result.doc === doc ? "A seleção ficou com os mesmos pixels." : "");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  };
  const handles = useRef<{ x: number; y: number; width: number; height: number; shear: number; mode: string } | null>(null);
  // A fixed coordinate system during a drag keeps the handles and numeric fields in step.
  const scale = Math.min(102 / doc.width, 84 / doc.height);
  const w = Math.max(1, Number(width) || 1) * scale, h = Math.max(1, Number(height) || 1) * scale, slant = Number(shear) * scale;
  return <section data-testid="pixel-deformation" aria-label="Deformar área do sprite" className="order-first flex flex-col gap-2 rounded-xl border border-[#7dd3fc]/45 p-3">
    <h3 className="font-semibold">Deformar área do sprite</h3>
    <button type="button" className={button} onClick={onSelect}>Marcar área no sprite</button>
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
      <svg viewBox="-106 -5 330 96" style={{ touchAction: "none" }} className="h-20 w-full rounded bg-[var(--rds-surface-panel)]"
        aria-label="Alças de tamanho e inclinação da seleção"
        onPointerDown={e => {
          const mode = (e.target as SVGElement).dataset.handle;
          if (!mode) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          handles.current = { mode, x: e.clientX, y: e.clientY, width: Number(width), height: Number(height), shear: Number(shear) };
        }}
        onPointerMove={e => {
          const drag = handles.current, matrix = e.currentTarget.getScreenCTM();
          if (!drag || !matrix) return;
          const dx = Math.round((e.clientX - drag.x) / matrix.a / scale), dy = Math.round((e.clientY - drag.y) / matrix.d / scale);
          if (drag.mode === "shear") setShear(String(Math.max(-doc.width, Math.min(doc.width, drag.shear + dx))));
          else { setWidth(String(Math.max(1, Math.min(doc.width, drag.width + dx)))); setHeight(String(Math.max(1, Math.min(doc.height, drag.height + dy)))); }
        }} onLostPointerCapture={() => { handles.current = null; }}>
        <rect width={rect.w * scale} height={rect.h * scale} fill="none" stroke="currentColor" strokeDasharray="3 2" />
        <polygon points={`0,0 ${w},0 ${w + slant},${h} ${slant},${h}`} fill="#7dd3fc30" stroke="#7dd3fc" />
        <circle data-handle="shear" cx={slant} cy={h} r="4" fill="#fde68a" style={{cursor:"ew-resize"}}><title>Inclinar a base</title></circle>
        <rect data-handle="size" x={w + slant - 4} y={h - 4} width="8" height="8" fill="#7dd3fc" style={{cursor:"nwse-resize"}}><title>Alterar largura e altura</title></rect>
      </svg>
      <div className="grid grid-cols-3 gap-1">{([
        ["Largura", width, setWidth, 1, doc.width], ["Altura", height, setHeight, 1, doc.height], ["Inclinação", shear, setShear, -doc.width, doc.width],
      ] as const).map(([label, value, set, min, max]) => <label key={label}>{label} (px)<input type="number" name={label} className={field} min={min} max={max} value={value} onChange={e => set(e.target.value)} /></label>)}</div>
      <p>A origem fica no canto superior esquerdo. A inclinação desloca a base. A borda do quadro recorta o excesso.</p>
    </> : <p>Arraste sobre a imagem para selecionar os pixels.</p>}
    <button type="button" data-testid="deform-preview" className={button} disabled={!rect || Boolean(binding && !active)} onClick={generate}>Prévia da deformação</button>
    {proposal && <div className="flex gap-2">
      <button type="button" data-testid="pixel-apply-image" className={button} onClick={() => { onCommit(proposal.doc, doc, true); onFrame(proposal.currentFrame); }}>Aplicar</button>
      <button type="button" data-testid="pixel-cancel-image" className={button} onClick={() => { setProposal(null); onPreview(null); }}>Cancelar</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
