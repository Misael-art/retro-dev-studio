import { describe, expect, it } from "vitest";

import { hudBand } from "./hudText";
import type { Scene } from "./ipc/sceneService";
import { reviewProject } from "./projectReview";
import { BEHAVIOR_LIBRARY, buildBehaviorSceneContext } from "./nodegraph/behaviorLibrary";

const ent = (id: string, components: Record<string, unknown>) => ({ entity_id: id, prefab: null, transform: { x: 0, y: 0 }, components });
const scene = (...entities: ReturnType<typeof ent>[]) => ({ scene_id: "main", entities }) as unknown as Scene;
const camera = ent("cam", { camera: { follow_entity: "ken", offset_x: -152, offset_y: -112 } });
const hud = (id: string, row: number) => ent(id, { hud: { column: 2, row, label: "VIDA:", digits: 3 } });

describe("hudBand (política de composição do texto)", () => {
  it("without a world camera the text stays on plane A with no reserved band", () => {
    expect(hudBand(scene(hud("vida", 4)))).toMatchObject({ plane: "A", rows: null, cameraWorld: false });
  });

  it("with camera the band goes from the top to the last row, or from the first row to the bottom", () => {
    expect(hudBand(scene(camera, hud("vida", 4)))).toMatchObject({ plane: "WINDOW", rows: [0, 4], split: false });
    expect(hudBand(scene(camera, hud("vida", 24)))).toMatchObject({ rows: [24, 27] });
  });

  it("text in both halves is refused before the build; a plane-A tilemap under the band is warned", () => {
    const split = reviewProject(scene(camera, hud("a", 1), hud("b", 25)));
    expect(split.items.find((i) => i.id === "hud-band:split")).toMatchObject({ severity: "error" });
    const covered = reviewProject(
      scene(
        camera,
        ent("fundo", { tilemap: { tileset: "a.png", map_width: 40, map_height: 28 } }),
        ent("frente", { tilemap: { tileset: "b.png", map_width: 40, map_height: 28 } }),
        hud("vida", 4)
      )
    );
    expect(covered.items.find((i) => i.id === "hud-band:covers:frente")).toMatchObject({ severity: "warning", target: { entityId: "frente" } });
  });

  it("palette plan diagnostics become review items that open the use", () => {
    const result = reviewProject(scene(), [], {
      diagnostics: [{ severity: "error", code: "bancos_esgotados", message: "Sem banco livre para 'x'.", uses: ["x"], resources: ["asset:x"], actions: ["Remover um uso da cena"] }],
    } as never);
    expect(result.items[0]).toMatchObject({ severity: "error", title: "Sem banco de paleta livre", target: { task: "scene", entityId: "x" } });
    expect(result.errors).toBe(1);
  });
});

describe("Trocar paleta ao sofrer golpe (comportamento)", () => {
  it("builds a palette_swap node pointing to the strike node of the chosen instance", () => {
    const def = BEHAVIOR_LIBRARY.find((d) => d.id === "palette_swap")!;
    const context = buildBehaviorSceneContext([], [], "megadrive", [{ id: "dano", name: "Dano" }, { name: "sem id" }]);
    expect(context.palettes).toEqual([{ id: "dano", name: "Dano" }]);
    const built = def.build({ strike: "golpe_1", target: "ken_2", palette: "dano", frames: 12, scope: "instancia" }, "troca_1", { nodes: [], edges: [] } as never, context);
    const node = built.nodes.find((n) => n.type === "palette_swap")!;
    expect(node.params).toEqual({ strike: "golpe_1__strike", target: "ken_2", palette: "dano", frames: 12, scope: "instancia" });
    expect(built.edges).toEqual([{ from: "tick", fromPort: "exec", to: "swap", toPort: "exec" }]);
    expect(def.summarize({ strike: "golpe_1", target: "ken_2", palette: "dano", frames: 12, scope: "instancia" }, context)).toContain("Dano");
  });
});
