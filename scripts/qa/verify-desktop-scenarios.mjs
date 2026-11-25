import path from "node:path";
import { pathToFileURL } from "node:url";

// Mesmo conjunto de diagnósticos nos dois consoles e autoria específica do Mega Drive.
const common = ["smoke", "live_overflow", "live_vram_overflow", "live_vram_warning",
  "live_sprite_warning", "live_ok", "live_error", "live_stale"];
const byTarget = {
  megadrive: [...common.map(name => name + "_md"), "reference_goal", "code_draft", "code_scope", "pose_baseline", "pose_journey", "pose_tools", "workspace_layout", "point_occlusion", "scene_guides", "linked_atlas"],
  snes: common.map(name => name + "_snes"),
  authoring: ["indexed_effects", "palette_and_atlas", "terrain_and_seam", "motion_trace", "wave_band", "hud_extremes"],
  hud: ["hud_extremes"],
  guides: ["scene_guides"],
  "advanced-authoring": ["advanced_authoring", "floating_panels"],
};

export function verifyDesktopScenarios(target, steps) {
  if (!["all", ...Object.keys(byTarget)].includes(target)) throw new Error(`Alvo de desktop desconhecido: ${target}`);
  const required = target === "all" ? [...byTarget.megadrive, ...byTarget.snes] : byTarget[target];
  const problems = [];
  for (const name of new Set(Object.values(byTarget).flat())) {
    const outcome = steps[name]?.outcome;
    if (outcome === "success") continue;
    if ((outcome === "skipped" || outcome === undefined) && !required.includes(name)) continue;
    problems.push(`${name}=${outcome ?? "ausente"}`);
  }
  if (problems.length) throw new Error(`Matriz desktop ${target}: ${problems.join(", ")}`);
  return required.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const count = verifyDesktopScenarios(process.env.RDS_E2E_TARGET, JSON.parse(process.env.RDS_E2E_STEPS));
  console.log(`${count} cenários obrigatórios para ${process.env.RDS_E2E_TARGET} passaram.`);
}
