import type { CameraArea, CameraComponent, CameraPattern, Entity, Scene, VisualCameraConfig } from "./ipc/sceneService";

export const CAMERA_PATTERNS: { id: CameraPattern; name: string; description: string; motion: string }[] = [
  { id: "fixed", name: "Tela fixa", description: "Um enquadramento que permanece no lugar.", motion: "▣" },
  { id: "platformer", name: "Plataforma lateral", description: "Acompanha o personagem com espaço à frente.", motion: "● → ▣" },
  { id: "exploration", name: "Exploração superior", description: "Acompanha nos dois eixos com uma região livre.", motion: "↕ ● ↔" },
  { id: "auto_horizontal", name: "Rolagem horizontal", description: "Avança na horizontal na velocidade escolhida.", motion: "▣ →" },
  { id: "auto_vertical", name: "Rolagem vertical", description: "Avança na vertical na velocidade escolhida.", motion: "▣ ↓" },
];

export function cameraFrame(target: "megadrive" | "snes") {
  return { width: target === "snes" ? 256 : 320, height: 224 };
}

/** Camera/HUD/guide positions cannot enlarge navigable geometry. */
export function cameraWorldArea(scene: Scene, target: "megadrive" | "snes"): CameraArea {
  const frame = cameraFrame(target);
  const boxes: CameraArea[] = [];
  if (scene.collision_map) {
    const c = scene.collision_map;
    boxes.push({ x: 0, y: 0, width: c.width * c.tile_width, height: c.height * c.tile_height });
  }
  for (const e of scene.entities) {
    const t = e.components?.tilemap;
    if (t) boxes.push({ x: e.transform.x, y: e.transform.y, width: t.map_width * 8, height: t.map_height * 8 });
  }
  if (!boxes.length) return { x: 0, y: 0, ...frame };
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

export function cameraPreset(pattern: CameraPattern, bounds: CameraArea, target: "megadrive" | "snes"): VisualCameraConfig {
  const frame = cameraFrame(target);
  return { version: 1, active: true, pattern, anchor_x: 0, anchor_y: 0,
    screen_x: Math.round(frame.width * (pattern === "platformer" ? 0.4 : 0.5)), screen_y: 112,
    horizontal: true, vertical: true, response_x: pattern === "fixed" ? 1 : 8,
    response_y: pattern === "platformer" ? 12 : 8,
    dead_zone_x: pattern === "exploration" ? 24 : 0,
    dead_zone_y: pattern === "platformer" ? 32 : pattern === "exploration" ? 24 : 0,
    look_ahead: pattern === "platformer" ? 32 : 0,
    max_speed: 16, speed: 60, paused: false, bounds: { ...bounds } };
}

export function cameraConflict(scene: Scene): boolean {
  if (scene.retrofx?.parallax_layers.some(l => l.enabled) || scene.retrofx?.raster_lines.some(l => l.enabled)) return true;
  return scene.entities.some(e => {
    const graph = e.components?.logic?.graph;
    if (!graph) return Boolean(e.components?.logic?.graph_ref);
    try {
      const nodes = (JSON.parse(graph) as { nodes?: { type?: string }[] }).nodes ?? [];
      return nodes.some(n => ["camera_follow", "camera_bounds", "move_camera", "scroll_tilemap", "effect_parallax", "effect_raster"].includes(n.type ?? ""));
    } catch { return true; }
  });
}

export function cameraValidation(camera: CameraComponent, scene: Scene, target: "megadrive" | "snes"): string[] {
  const v = camera.visual;
  if (!v) return [];
  const errors: string[] = [];
  if (v.version !== 1 || !CAMERA_PATTERNS.some(p => p.id === v.pattern)) errors.push("Versão ou padrão de câmera não reconhecido.");
  if ((v.pattern === "platformer" || v.pattern === "exploration") &&
      !scene.entities.some(e => e.entity_id === camera.follow_entity && e.components?.sprite)) errors.push("Escolha um personagem com imagem da cena.");
  if (cameraConflict(scene)) errors.push("A cena usa comandos antigos de câmera/rolagem ou lógica externa. Remova esses comandos antes da conversão visual.");
  if (scene.entities.some(e => (e.components?.tilemap?.scroll_x ?? 0) !== 0 || (e.components?.tilemap?.scroll_y ?? 0) !== 0)) errors.push("Zere os deslocamentos antigos do cenário antes de usar a câmera visual. Posicione o cenário pela sua posição na cena.");
  const frame = cameraFrame(target);
  const ints = [v.anchor_x,v.anchor_y,v.screen_x,v.screen_y,v.response_x,v.response_y,v.dead_zone_x,v.dead_zone_y,v.look_ahead,v.max_speed,v.speed,
    v.bounds.x,v.bounds.y,v.bounds.width,v.bounds.height,camera.offset_x ?? 0,camera.offset_y ?? 0];
  if (ints.some(n => !Number.isInteger(n) || Math.abs(n) > 16000)) errors.push("Use valores inteiros entre −16000 e 16000.");
  if (v.bounds.width < 1 || v.bounds.height < 1 || Math.abs(v.bounds.x + v.bounds.width) > 16000 || Math.abs(v.bounds.y + v.bounds.height) > 16000) errors.push("A área permitida deve ter tamanho positivo e caber nas coordenadas do destino.");
  if (v.response_x < 1 || v.response_x > 60 || v.response_y < 1 || v.response_y > 60 || v.max_speed < 1 || v.max_speed > 256) errors.push("Resposta deve ficar entre 1 e 60; velocidade máxima entre 1 e 256.");
  if (v.screen_x < 0 || v.screen_x > frame.width || v.screen_y < 0 || v.screen_y > frame.height || v.dead_zone_x < 0 || v.dead_zone_y < 0 || v.look_ahead < 0) errors.push("Enquadramento e região livre devem caber na janela do jogador.");
  return errors;
}

export interface CameraSample { x: number; y: number; previousTargetX: number; direction: number; remainder: number; initialized: boolean }
export function initialCameraSample(): CameraSample { return { x: 0, y: 0, previousTargetX: 0, direction: 0, remainder: 0, initialized: false }; }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function approach(current: number, desired: number, dead: number, response: number, speed: number) {
  const difference = desired - current;
  const distance = Math.max(0, Math.abs(difference) - dead);
  const step = distance ? Math.max(1, Math.trunc(distance / response)) : 0;
  return current + Math.sign(difference) * Math.min(speed, step);
}

/** Integer formula also emitted by compiler/camera_runtime.rs. No entity mutations. */
export function sampleCamera(camera: CameraComponent, origin: { x: number; y: number },
  targetPoint: { x: number; y: number } | null, target: "megadrive" | "snes", previous = initialCameraSample(), fps = 60): CameraSample {
  const v = camera.visual;
  if (!v) return previous;
  const frame = cameraFrame(target);
  const baseX = Math.trunc(origin.x + (camera.offset_x ?? 0));
  const baseY = Math.trunc(origin.y + (camera.offset_y ?? 0));
  let { x, y, direction, remainder } = previous;
  if (!previous.initialized || v.pattern === "fixed") { x = baseX; y = baseY; }
  if ((v.pattern === "platformer" || v.pattern === "exploration") && targetPoint) {
    if (previous.initialized && targetPoint.x !== previous.previousTargetX) direction = Math.sign(targetPoint.x - previous.previousTargetX);
    const dx = Math.trunc(targetPoint.x) + v.anchor_x - v.screen_x + (camera.offset_x ?? 0) + v.look_ahead * direction;
    const dy = Math.trunc(targetPoint.y) + v.anchor_y - v.screen_y + (camera.offset_y ?? 0);
    if (v.horizontal) x = previous.initialized ? approach(x, dx, v.dead_zone_x, v.response_x, v.max_speed) : dx;
    if (v.vertical) y = previous.initialized ? approach(y, dy, v.dead_zone_y, v.response_y, v.max_speed) : dy;
  } else if (v.pattern.startsWith("auto_") && previous.initialized && !v.paused) {
    remainder += v.speed;
    const step = Math.trunc(remainder / fps);
    remainder -= step * fps;
    if (v.pattern === "auto_horizontal" && v.horizontal) x += step;
    if (v.pattern === "auto_vertical" && v.vertical) y += step;
  }
  return { x: clamp(x, v.bounds.x, v.bounds.x + Math.max(0, v.bounds.width - frame.width)),
    y: clamp(y, v.bounds.y, v.bounds.y + Math.max(0, v.bounds.height - frame.height)),
    previousTargetX: Math.trunc(targetPoint?.x ?? 0), direction, remainder, initialized: true };
}

export function activeVisualCamera(scene: Scene): Entity | undefined {
  return scene.entities.find(e => e.components?.camera?.visual?.active);
}
