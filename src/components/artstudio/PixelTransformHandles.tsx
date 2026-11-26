import { useRef, type PointerEvent } from "react";
import { deformationOffset, type DeformationSize } from "../../core/pixelDeformation";
import type { PixelDoc, PixelRect } from "../../core/pixelEditor";
import PixelFrameCanvas from "./PixelFrameCanvas";

interface Props {
  doc: PixelDoc; frame: number; rect: PixelRect; geometry: DeformationSize; warp: boolean;
  onSize: (w: number, h: number) => void; onWarp: (shear: number, bend: number) => void;
}
export default function PixelTransformHandles({ doc, frame, rect, geometry, warp, onSize, onWarp }: Props) {
  const { width, height, shear, bend = 0 } = geometry;
  const drag = useRef<{ handle: string; x: number; y: number; geometry: DeformationSize } | null>(null);
  const pointer = (e: PointerEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
  };
  const left = (t: number) => rect.x + deformationOffset(t, shear, bend);
  const row = (t: number) => rect.y + t * height;
  const steps = [0, .125, .25, .375, .5, .625, .75, .875, 1];
  const outline = [...steps.map(t => [left(t), row(t)]), ...[...steps].reverse().map(t => [left(t) + width, row(t)])];
  const pad = Math.max(doc.width, doc.height) * .08;
  const handle = (key: string, x: number, y: number, title: string) => <circle data-handle={key} cx={x} cy={y} r={pad * .75}
    stroke="var(--rds-surface-panel)" strokeWidth={pad / 4} fill={key === "bend" ? "#fde68a" : "#7dd3fc"}
    style={{ cursor: key === "scale" ? "nwse-resize" : "ew-resize" }}><title>{title}</title></circle>;
  return <svg className="h-32 w-full rounded bg-[var(--rds-surface-panel)]" style={{ touchAction: "none" }} aria-label="Alças da seleção sobre a pose"
    viewBox={[-pad, -pad, doc.width+2*pad, doc.height+2*pad].join(" ")}
    onPointerDown={e => {
      const point = pointer(e), key = (e.target as SVGElement).dataset.handle;
      if (!key || !point) return;
      e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: point.x, y: point.y, handle:key, geometry };
    }} onLostPointerCapture={() => { drag.current = null; }}
    onPointerMove={e => {
      const start = drag.current, point = pointer(e);
      if (!start || !point) return;
      const dx = Math.round(point.x - start.x), dy = Math.round(point.y - start.y);
      const clamp = (v: number) => Math.max(-doc.width, Math.min(doc.width, v));
      if (start.handle === "scale") onSize(Math.max(1, Math.min(doc.width, start.geometry.width + dx)), Math.max(1, Math.min(doc.height, start.geometry.height + dy)));
      else if (start.handle === "bend") onWarp(start.geometry.shear, clamp((start.geometry.bend ?? 0) + dx));
      else onWarp(clamp(start.geometry.shear + dx), start.geometry.bend ?? 0);
    }}>
    <foreignObject width={doc.width} height={doc.height}><PixelFrameCanvas doc={doc} index={frame} scale={1} label="Pose sob as alças" /></foreignObject>
    <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="none" stroke="white" vectorEffect="non-scaling-stroke" strokeDasharray="3 2" />
    <polygon points={outline.map(p => p.join(",")).join(" ")} fill="#7dd3fc22" stroke="#7dd3fc" vectorEffect="non-scaling-stroke" />
    {warp ? <>{handle("bend", left(.5), row(.5), "Curvar o centro")}{handle("shear", left(1), row(1), "Deslocar a base")}</> :
      handle("scale", left(1) + width, row(1), "Ajustar largura e altura")}
  </svg>;
}
