import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Entradas reproduzíveis para editar no Studio e medir no core. A receita só
// escreve projetos novos e usa a arte autoral já embarcada na fase de referência.
const repo = fileURLToPath(new URL("../../", import.meta.url));
const seed = path.join(repo, "src-tauri/tests/fixtures/projects/megadrive_dummy");
const artwork = path.join(repo, "data/reference_platformer_art");
const sessions = path.join(process.env.RDS_WORK_ROOT || path.join(homedir(), "RetroDevStudio-work"), "sessions");
const atlas = "assets/sprites/fox-five-frame-32-runtime.png";
const backdrop = "assets/tilesets/stage-backdrop-320x224-10-candidate.png";
const flag = "assets/sprites/goal-flag-16x32-runtime.png";
const gate = "assets/sprites/gate-24x32-runtime.png";

function actor(id, name, x) {
  return {
    entity_id: id, display_name: name, transform: { x, y: 136 },
    components: {
      sprite: {
        asset: atlas, frame_width: 32, frame_height: 32, palette_slot: 1,
        priority: "foreground", animations: {
          passo: {
            frames: [0, 1, 2, 1], occurrence_ids: ["o1", "o2", "o3", "o4"],
            frame_durations: [5, 3, 7, 2], fps: 12, loop: true,
          },
        },
      },
    },
  };
}

function scenery() {
  const entities = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const isGate = (row + column) % 2 === 0;
      const prop = {
        entity_id: `marco_${row}_${column}`,
        display_name: `${isGate ? "Portal" : "Bandeira"} ${row + 1}.${column + 1}`,
        // As três faixas deixam livres os retângulos dos atores (y=136..167).
        transform: { x: 12 + 39 * column, y: [24, 72, 176][row] },
        components: { sprite: {
          asset: isGate ? gate : flag, frame_width: isGate ? 24 : 16, frame_height: 32,
          palette_slot: isGate ? 3 : 2, priority: "foreground", animations: {},
        } },
      };
      if (row === 2 && column === 4) {
        prop.entity_id = "elevador";
        prop.display_name = "Elevador do portão";
        prop.components.collision = {
          shape: "rect", solid: true, width: 24, height: 8, offset: { x: 0, y: 0 },
        };
        prop.components.path = {
          mode: "pingpong", points: [{ x: 0, y: 0, wait: 10 }, { x: 24, y: 0, frames: 48, wait: 10 }],
        };
      }
      entities.push(prop);
    }
  }
  return entities;
}

async function writeProject(directory, dense, composition = false) {
  const project = JSON.parse(await readFile(path.join(seed, "project.rds"), "utf8"));
  const scene = JSON.parse(await readFile(path.join(seed, project.entry_scene), "utf8"));
  project.name = composition ? "Porto das Lanternas — Pilastra" : dense ? "Ensaio de poses — Sala densa" : "Ensaio de poses — Sala simples";
  project.schema_version = scene.schema_version;
  scene.display_name = project.name;
  scene.entities.push(
    {
      entity_id: "paisagem", display_name: "Paisagem", transform: { x: 0, y: 0 },
      components: { tilemap: {
        tileset: backdrop, map_width: 40, map_height: 28, plane: "BG_B",
        scroll_x: 0, scroll_y: 0, priority: false,
      } },
    },
    actor("raposa", "Raposa · editar", 64),
    actor("testemunha", "Raposa · controle", 208),
  );
  if (dense) scene.entities.push(...scenery());
  if (composition) {
    for (const entity of scene.entities.filter(({ entity_id }) => ["raposa", "testemunha"].includes(entity_id))) {
      const animation = entity.components.sprite.animations.passo;
      Object.assign(animation, { frames: [0], occurrence_ids: ["o1"], frame_durations: [5] });
    }
    scene.entities.find(({ entity_id }) => entity_id === "raposa").components.sprite.priority = "background";
    scene.entities.push({
      entity_id: "pilastra", display_name: "Pilastra de observação", transform: { x: 64, y: 136 },
      components: { tilemap: { tileset: gate, map_width: 3, map_height: 4, plane: "BG_A", priority: false } },
    });
    scene.layers = [
      { id: "atores", name: "Atores", kind: "sprite", visible: true, locked: false, depth: 1, entity_ids: ["raposa", "testemunha"] },
      { id: "pilastras", name: "Pilastras", kind: "tile", visible: true, locked: false, depth: 2, entity_ids: ["pilastra"] },
    ];
  }
  const assets = dense ? [atlas, backdrop, flag, gate] : composition ? [atlas, backdrop, gate] : [atlas, backdrop];
  for (const relative of assets) {
    const destination = path.join(directory, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(artwork, path.basename(relative)), destination);
  }
  const scenePath = path.join(directory, project.entry_scene);
  await mkdir(path.dirname(scenePath), { recursive: true });
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
  const projectPath = path.join(directory, "project.rds");
  await writeFile(projectPath, JSON.stringify(project, null, 2) + "\n");
  return projectPath;
}

await mkdir(sessions, { recursive: true });
const root = await mkdtemp(path.join(sessions, "ensaio-poses-"));
if (process.argv.includes("--composition")) {
  console.log(await writeProject(path.join(root, "composicao"), false, true));
} else {
  for (const variant of ["simples", "densa"]) {
    console.log(await writeProject(path.join(root, variant), variant === "densa"));
  }
}
