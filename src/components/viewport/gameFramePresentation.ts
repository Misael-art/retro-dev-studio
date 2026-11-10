import type { FramePayload } from "../../core/ipc/emulatorService";

/** Paint an already identity-checked frame at its native resolution. */
export function paintGameFrame(canvas: HTMLCanvasElement, payload: FramePayload): boolean {
  if (!Number.isSafeInteger(payload.width) || !Number.isSafeInteger(payload.height)
    || payload.width <= 0 || payload.height <= 0
    || payload.rgba.length !== payload.width * payload.height * 4) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  // Changing either dimension clears the bitmap. Resize before painting, and
  // avoid clearing it again on same-resolution frames or React renders.
  if (canvas.width !== payload.width) canvas.width = payload.width;
  if (canvas.height !== payload.height) canvas.height = payload.height;
  const imageData = context.createImageData(payload.width, payload.height);
  imageData.data.set(payload.rgba);
  context.putImageData(imageData, 0, 0);
  return true;
}
