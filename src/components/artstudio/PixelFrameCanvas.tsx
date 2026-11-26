import { useEffect, useRef } from "react";
import { compositeFrame, pixelCss, type PixelDoc } from "../../core/pixelEditor";

export default function PixelFrameCanvas({ doc, index, scale, label, className }: {
  doc: PixelDoc; index: number; scale?: number; label: string; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = compositeFrame(doc, index);
    for (let i = 0; i < pixels.length; i += 1) {
      const css = pixelCss(doc, pixels[i]);
      if (!css) continue;
      ctx.fillStyle = css;
      ctx.fillRect(i % doc.width, Math.floor(i / doc.width), 1, 1);
    }
  }, [doc, index]);
  return <canvas ref={ref} aria-label={label} className={className} style={scale ? {
    width: doc.width * scale, height: doc.height * scale, imageRendering: "pixelated"
  } : undefined} />;
}
