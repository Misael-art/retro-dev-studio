import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

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

async function writeProject(directory, dense, composition = false, movingCamera = false) {
  const project = JSON.parse(await readFile(path.join(seed, "project.rds"), "utf8"));
  const scene = JSON.parse(await readFile(path.join(seed, project.entry_scene), "utf8"));
  project.name = movingCamera ? "Porto das Lanternas — Câmera em movimento"
    : composition ? "Porto das Lanternas — Pilastra" : dense ? "Ensaio de poses — Sala densa" : "Ensaio de poses — Sala simples";
  project.schema_version = scene.schema_version;
  scene.display_name = project.name;
  scene.entities.push(
    {
      entity_id: "paisagem", display_name: "Paisagem", transform: { x: 0, y: 0 },
      components: { tilemap: {
        tileset: backdrop, map_width: movingCamera ? 48 : 40, map_height: 28, plane: "BG_B",
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
  if (movingCamera) {
    const camera = scene.entities.find(({ entity_id }) => entity_id === "camera_root").components.camera;
    camera.visual = {
      version: 1, active: true, pattern: "auto_horizontal",
      anchor_x: 0, anchor_y: 0, screen_x: 160, screen_y: 112, horizontal: true, vertical: false,
      response_x: 1, response_y: 1, dead_zone_x: 0, dead_zone_y: 0, look_ahead: 0,
      max_speed: 16, speed: 12, paused: false, bounds: { x: 0, y: 0, width: 384, height: 224 },
    };
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

function indexedAtlasPng(width, height, palette, frames) {
  const chunk = (kind, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const contents = Buffer.concat([Buffer.from(kind), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(contents));
    return Buffer.concat([length, contents, checksum]);
  };
  const sheetWidth = width * frames.length;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(sheetWidth);
  header.writeUInt32BE(height, 4);
  header[8] = 4;
  header[9] = 3;
  const stride = sheetWidth / 2 + 1;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let frame = 0; frame < frames.length; frame++) {
      for (let x = 0; x < width; x += 2) {
        const source = y * width + x;
        pixels[y * stride + 1 + (frame * width + x) / 2] = frames[frame][source] * 16 + frames[frame][source + 1];
      }
    }
  }
  const colors = Buffer.from(palette.flatMap((color) => color.map((level) => Math.round(level * 255 / 7))));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("PLTE", colors), chunk("tRNS", Buffer.from([0])), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

async function writeLinkedAtlasProject(directory, { effect = false, moving = false, replacement = false } = {}) {
  const projectPath = await writeProject(directory, false, false, moving);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  project.name = effect ? "Ensaio de efeitos indexados" : "Ensaio de atlas vinculado";
  const scenePath = path.join(directory, project.entry_scene);
  const scene = JSON.parse(await readFile(scenePath, "utf8"));
  scene.display_name = project.name;
  const asset = "assets/sprites/pixel/atlas_ensaio.png";
  const document = asset.replace(/\.png$/, ".rdspixel.json");
  const width = 16, height = 16;
  const palette = [[0, 0, 0], [7, 3, 0], [7, 6, 1], [3, 1, 0], [7, 7, 6], [3, 5, 7]];
  while (palette.length < 16) palette.push([0, 0, 0]);
  const frames = Array.from({ length: 3 }, (_, frame) => {
    const pixels = Buffer.alloc(width * height);
    for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) pixels[y * width + x] = x < 7 ? 1 : 2;
    // The seven-tick pose exposes the background under the edited region at the same world coordinates.
    if (effect && frame === 2) {
      for (let y = 4; y < 12; y++) pixels.fill(0, y * width + 3, y * width + 11);
    }
    for (let y = 1; y < 4; y++) for (let x = 4 + frame; x < 7 + frame; x++) pixels[y * width + x] = 3 + frame;
    pixels[13 * width + 5 + frame] = 1;
    return pixels;
  });
  for (const entity of scene.entities.filter(({ entity_id }) => ["raposa", "testemunha"].includes(entity_id))) {
    Object.assign(entity.components.sprite, { asset, frame_width: width, frame_height: height, pivot: { x: 8, y: 13 } });
    entity.transform.y = 144;
    entity.components.logic = { logic_hints: [`pixel_art:document=${document}`] };
    if (entity.entity_id === "raposa") {
      const animation = entity.components.sprite.animations.passo;
      animation.frame_durations[1] = 4;
      animation.hitboxes = [{ frame: 1, occurrence_id: "o2", kind: "attack", x: 2, y: 1, width: 4, height: 5 }];
    }
  }
  const pixelDoc = {
    schema: "retrodev.pixel/v1", name: "atlas_ensaio", target: "sprite", width, height,
    palettes: Array.from({ length: 4 }, () => palette), paletteLines: [0],
    layers: [{ id: "arte", name: "Arte", visible: true }],
    frames: frames.map((image, index) => ({ id: `imagem-${index + 1}`, durationMs: 100, cels: [image.toString("base64")] })),
  };
  await mkdir(path.dirname(path.join(directory, asset)), { recursive: true });
  await writeFile(path.join(directory, asset), indexedAtlasPng(width, height, palette, frames));
  await writeFile(path.join(directory, document), JSON.stringify(pixelDoc) + "\n");
  if (effect && moving) {
    // Repeat every three hardware tiles so a bare area 96 px away exposes
    // the exact background behind the edited sprite on the same core frame.
    const repeatedBackdrop = "assets/tilesets/controle-dos-efeitos.png";
    const background = Buffer.alloc(384 * 224);
    for (let y = 0; y < 224; y++) {
      for (let x = 0; x < 384; x++) {
        const stripe = (x + (y % 8) * 2) % 24;
        background[y * 384 + x] = stripe < 5 ? 1 : stripe < 14 ? 2 : 3;
      }
    }
    await writeFile(path.join(directory, repeatedBackdrop), indexedAtlasPng(384, 224,
      [[0, 0, 0], [1, 2, 6], [2, 7, 3], [4, 2, 6]], [background]));
    scene.entities.find(({ entity_id }) => entity_id === "paisagem").components.tilemap.tileset = repeatedBackdrop;
    scene.entities.find(({ entity_id }) => entity_id === "camera_root").components.camera.visual.advanced = {
      parallax: [{ entity_id: "paisagem", ratio_x: 50, ratio_y: 100 }],
    };
    const markerPath = "assets/sprites/marcador-apresentacao.png";
    const marker = Buffer.alloc(64);
    for (let y = 2; y <= 3; y++) {
      marker.fill(5, y * 8 + 1, y * 8 + 3);
      marker.fill(2, y * 8 + 4, y * 8 + 6);
    }
    await writeFile(path.join(directory, markerPath), indexedAtlasPng(8, 8, palette, [marker]));
    scene.entities.push({ entity_id: "marcador_apresentacao", display_name: "Marcador de apresentação", transform: { x: 112, y: 40 },
      components: { sprite: { asset: markerPath, frame_width: 8, frame_height: 8, palette_slot: 1, priority: "foreground", animations: {} } } });
  }
  if (replacement) {
    for (const [name, indices] of [["atlas_reordenado", [1, 0, 2]], ["atlas_incompleto", [0, 2]]]) {
      const candidate = path.posix.join(path.posix.dirname(asset), name);
      await writeFile(path.join(directory, `${candidate}.png`), indexedAtlasPng(width, height, palette, indices.map((index) => frames[index])));
      await writeFile(path.join(directory, `${candidate}.rdspixel.json`), JSON.stringify({ ...pixelDoc, name, frames: indices.map((index) => pixelDoc.frames[index]) }) + "\n");
    }
  }
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
  await writeFile(projectPath, JSON.stringify(project, null, 2) + "\n");
  return projectPath;
}

async function writeWaveProject(directory) {
  const projectPath = await writeProject(directory, false, true, true);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  project.name = "Porto das Lanternas — Onda e pilastra";
  const scenePath = path.join(directory, project.entry_scene);
  const scene = JSON.parse(await readFile(scenePath, "utf8"));
  scene.display_name = project.name;
  const water = "assets/tilesets/wave-stripes.png";
  const palette = [[0, 0, 0], [1, 3, 6], [4, 7, 6], [0, 2, 4]];
  const pattern = Buffer.alloc(384 * 224);
  for (let y = 0; y < 224; y += 1) {
    for (let x = 0; x < 384; x += 1) {
      const crest = (x + (y % 8) * 2) % 23;
      pattern[y * 384 + x] = crest < 3 ? 2 : crest < 11 ? 1 : 3;
    }
  }
  await writeFile(path.join(directory, water), indexedAtlasPng(384, 224, palette, [pattern]));
  scene.entities.find(({ entity_id }) => entity_id === "paisagem").components.tilemap.tileset = water;
  scene.entities.find(({ entity_id }) => entity_id === "pilastra").components.tilemap.priority = true;
  scene.entities.find(({ entity_id }) => entity_id === "camera_root").components.camera.visual.advanced = {
    parallax: [{entity_id: "paisagem", ratio_x: 50, ratio_y: 100}],
  };
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
  await writeFile(projectPath, JSON.stringify(project, null, 2) + "\n");
  return projectPath;
}

async function writeHudProject(directory) {
  const projectPath = await writeProject(directory, false, false, true);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  project.name = "Porto das Lanternas — HUD";
  const scenePath = path.join(directory, project.entry_scene);
  const scene = JSON.parse(await readFile(scenePath, "utf8"));
  scene.display_name = project.name;
  const background = "assets/tilesets/fundo-do-hud.png";
  const pixels = Buffer.alloc(384 * 224, 1);
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 384; x++) pixels[y * 384 + x] = 2 + ((x + (y % 8)) % 24 < 9 ? 0 : 1);
  }
  await writeFile(path.join(directory, background), indexedAtlasPng(384, 224,
    [[0, 0, 0], [1, 1, 4], [6, 5, 2], [3, 6, 4]], [pixels]));
  scene.entities.find(({ entity_id }) => entity_id === "paisagem").components.tilemap.tileset = background;
  const node = (id, type, params) => ({ id, type, label: id, x: 0, y: 0, params });
  const edge = (fromNode, fromPort, toNode) => ({ id: toNode, fromNode, fromPort, toNode, toPort: "exec" });
  const values = [1, 9, 99];
  const attacker = scene.entities.find(({ entity_id }) => entity_id === "raposa");
  const witness = scene.entities.find(({ entity_id }) => entity_id === "testemunha");
  witness.transform.x = attacker.transform.x + 12;
  for (const [actor, kind] of [[attacker, "attack"], [witness, "hurt"]]) {
    const clip = actor.components.sprite.animations.passo;
    clip.hitboxes = clip.frames.map((frame, index) => ({
      frame, occurrence_id: clip.occurrence_ids[index], kind, x: 2, y: 1, width: 28, height: 24,
    }));
  }
  attacker.components.logic = {
    graph: JSON.stringify({
      version: 1,
      nodes: [node("quadro", "event_update", {}), node("marcos", "timeline_sequence",
        { slot_0_delay: 90, slot_1_delay: 110, slot_2_delay: 130 }),
        ...values.map((value) => node(`valor_${value}`, "var_set", { var_name: "contador", value })),
        node("golpe", "authored_strike", { attacker: "raposa", target: "testemunha", health: 99, damage: 99 })],
      edges: [edge("quadro", "exec", "marcos"), ...values.map((value, i) => edge("marcos", `slot_${i}`, `valor_${value}`)),
        edge("valor_9", "exec", "golpe")],
    }),
  };
  scene.entities.push({ entity_id: "hud_vida", display_name: "Mostrador de teste", transform: { x: 0, y: 0 },
    components: { hud: { label: "VIDA ", column: 2, row: 25, digits: 3, value: { kind: "logic_var", source: "contador" } } } });
  scene.entities.push({ entity_id: "hud_barra", display_name: "Barra de teste", transform: { x: 0, y: 0 },
    components: { hud: { label: "HP ", column: 2, row: 26, digits: 3, bar_tiles: 8, value: { kind: "strike_hp", source: "golpe" } } } });
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
  await writeFile(projectPath, JSON.stringify(project, null, 2) + "\n");
  return projectPath;
}

async function writeTerrainProject(directory) {
  const projectPath = await writeProject(directory, false);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  project.name = "Porto das Lanternas — Terreno automático";
  const scenePath = path.join(directory, project.entry_scene);
  const scene = JSON.parse(await readFile(scenePath, "utf8"));
  scene.display_name = project.name;
  const tileset = "assets/tilesets/conexoes-terreno.png";
  const palette = [[0, 0, 0], [0, 4, 1], [7, 2, 0], [7, 7, 0], [0, 6, 7], [7, 0, 5]];
  while (palette.length < 16) palette.push([0, 0, 0]);
  const tiles = Array.from({ length: 16 }, (_, mask) => {
    const tile = Buffer.alloc(64, 1);
    if (mask & 1) tile[3] = 2;
    if (mask & 2) tile[3 * 8 + 7] = 3;
    if (mask & 4) tile[7 * 8 + 3] = 4;
    if (mask & 8) tile[3 * 8] = 5;
    return tile;
  });
  tiles.push(Buffer.alloc(64, 4));
  await writeFile(path.join(directory, tileset), indexedAtlasPng(8, 8, palette, tiles));
  const cells = Array(40 * 28).fill(0);
  cells[6 * 40 + 13] = 17;
  scene.entities.push({ entity_id: "terreno", display_name: "Terreno", transform: { x: 0, y: 0 },
    components: { tilemap: { tileset, map_width: 40, map_height: 28, plane: "BG_A", priority: false, cells } } });
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
  await writeFile(projectPath, JSON.stringify(project, null, 2) + "\n");
  return projectPath;
}

await mkdir(sessions, { recursive: true });
const root = await mkdtemp(path.join(sessions, "ensaio-poses-"));
if (process.argv.includes("--atlas-replacement")) {
  console.log(await writeLinkedAtlasProject(path.join(root, "substituicao-atlas"), { replacement: true }));
} else if (process.argv.includes("--wave")) {
  console.log(await writeWaveProject(path.join(root, "onda")));
} else if (process.argv.includes("--hud")) {
  console.log(await writeHudProject(path.join(root, "hud")));
} else if (process.argv.includes("--terrain")) {
  console.log(await writeTerrainProject(path.join(root, "terreno")));
} else if (process.argv.includes("--indexed-effects")) {
  const moving = process.argv.includes("--moving-camera");
  for (const effect of ["transparent", "ghost", "rotation"]) {
    console.log(await writeLinkedAtlasProject(path.join(root, effect), { effect: true, moving }));
  }
} else if (process.argv.includes("--linked-atlas")) {
  console.log(await writeLinkedAtlasProject(path.join(root, "atlas-vinculado")));
} else if (process.argv.includes("--composition-motion")) {
  console.log(await writeProject(path.join(root, "composicao-movimento"), false, true, true));
} else if (process.argv.includes("--composition")) {
  console.log(await writeProject(path.join(root, "composicao"), false, true));
} else {
  for (const variant of ["simples", "densa"]) {
    console.log(await writeProject(path.join(root, variant), variant === "densa"));
  }
}
