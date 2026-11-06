import { describe, expect, it } from "vitest";
import type { SceneLayer } from "./ipc/sceneService";
import { describeEntityEditLock, entityEditLock } from "./sceneComposition";
import { useEditorStore } from "./store/editorStore";

const layer = (id: string, locked: boolean, entity_ids: string[]): SceneLayer => ({ id, name: id === "bg" ? "Céu" : id, kind: "sprite", visible: true, locked, depth: 0, entity_ids });

describe("R3-08 entity edit lock", () => {
  it("distinguishes object lock, inherited layer lock and free objects", () => {
    const layers = [layer("bg", true, ["sky"]), layer("fg", false, ["nalu", "coin"])];
    expect(entityEditLock("nalu", layers, ["nalu"])).toEqual({ locked: true, reason: "object" });
    expect(entityEditLock("sky", layers, [])).toEqual({ locked: true, reason: "layer", layerName: "Céu" });
    expect(entityEditLock("coin", layers, ["nalu"])).toEqual({ locked: false });
    expect(entityEditLock("orphan", null, [])).toEqual({ locked: false });
    expect(describeEntityEditLock(entityEditLock("sky", layers, []))).toBe("Bloqueado pela camada «Céu»");
  });

  it("locking an object does not lock siblings, create layers or touch the authored scene", () => {
    const scene = { layers: [layer("fg", false, ["nalu", "coin"])] };
    const before = JSON.stringify(scene);
    const { toggleEntityLock } = useEditorStore.getState();
    toggleEntityLock("scenes/a.json", "nalu");
    const ids = useEditorStore.getState().lockedEntityIdsByScene["scenes/a.json"];
    expect(entityEditLock("nalu", scene.layers, ids)).toMatchObject({ locked: true });
    expect(entityEditLock("coin", scene.layers, ids)).toEqual({ locked: false });
    expect(JSON.stringify(scene)).toBe(before);
    expect(useEditorStore.getState().lockedEntityIdsByScene["scenes/b.json"]).toBeUndefined();
    toggleEntityLock("scenes/a.json", "nalu");
    expect(useEditorStore.getState().lockedEntityIdsByScene["scenes/a.json"]).toEqual([]);
  });
});

describe("R3-02 Esc priority for derived isolation", () => {
  it("exits only when no field or popup owns Escape", async () => {
    const { escapeExitsIsolation } = await import("./sceneComposition");
    const doc = document.implementation.createHTMLDocument("t");
    const body = doc.body;
    const input = doc.createElement("input"); body.appendChild(input);
    const div = doc.createElement("div"); body.appendChild(div);
    expect(escapeExitsIsolation({ key: "Escape", defaultPrevented: false, target: div }, doc)).toBe(true);
    expect(escapeExitsIsolation({ key: "Escape", defaultPrevented: false, target: input }, doc)).toBe(false);
    expect(escapeExitsIsolation({ key: "Escape", defaultPrevented: true, target: div }, doc)).toBe(false);
    expect(escapeExitsIsolation({ key: "Enter", defaultPrevented: false, target: div }, doc)).toBe(false);
    const menu = doc.createElement("div"); menu.setAttribute("role", "menu"); body.appendChild(menu);
    expect(escapeExitsIsolation({ key: "Escape", defaultPrevented: false, target: div }, doc)).toBe(false);
  });
});

describe("R3-04 graph scope", () => {
  it("resolves instance, shared file, inherited and unavailable from source vs resolved scenes", async () => {
    const { resolveGraphScope, describeGraphScope } = await import("./sceneComposition");
    const ent = (id: string, logic?: Record<string, unknown>, prefab?: string) => ({ entity_id: id, prefab, components: logic ? { logic } : {} });
    const scene = (entities: unknown[]) => ({ entities }) as never;
    const source = scene([ent("a", { graph: "{}" }), ent("b", { graph_ref: "graphs/x.json" }), ent("c", { graph_ref: "graphs/x.json" }), ent("d", undefined, "prefabs/enemy.json"), ent("e")]);
    const resolved = scene([ent("a", { graph: "{}" }), ent("b", { graph_ref: "graphs/x.json" }), ent("c", { graph_ref: "graphs/x.json" }), ent("d", { graph_ref: "graphs/enemy.json" }, "prefabs/enemy.json"), ent("e")]);
    expect(resolveGraphScope(source, resolved, "a", true)).toEqual({ kind: "instance" });
    expect(resolveGraphScope(source, resolved, "b", true)).toEqual({ kind: "shared_file", ref: "graphs/x.json", usersInScene: ["b", "c"] });
    expect(resolveGraphScope(source, resolved, "d", true)).toEqual({ kind: "inherited", ref: "graphs/enemy.json", prefab: "prefabs/enemy.json", usersInScene: ["d"] });
    expect(resolveGraphScope(source, resolved, "b", false)).toEqual({ kind: "unavailable", ref: "graphs/x.json" });
    expect(resolveGraphScope(source, resolved, "e", true)).toEqual({ kind: "none" });
    expect(describeGraphScope(resolveGraphScope(source, resolved, "b", true))).toBe("Arquivo graphs/x.json · 2 usos nesta cena");
  });
});

describe("R3-06 declared transitions", () => {
  it("uses owner+node id refs (stable across layout), flags missing/unknown targets and never claims ROM execution", async () => {
    const { collectDeclaredTransitions, searchTransitions } = await import("./sceneComposition");
    const graph = (x: number) => JSON.stringify({ nodes: [
      { id: "n_go", type: "load_scene", label: "Ir", x, y: 0, params: { scene: "scenes/cave.json" } },
      { id: "n_lost", type: "load_scene", x: x + 10, y: 0, params: { scene: "scenes/gone.json" } },
      { id: "n_blank", type: "load_scene", params: {} },
      { id: "n_move", type: "sprite_move", params: {} },
    ], edges: [] });
    const scene = (x: number) => ({ entities: [
      { entity_id: "door", display_name: "Porta", components: { logic: { graph: graph(x) } } },
      { entity_id: "bad", components: { logic: { graph: "{not json" } } },
    ] }) as never;
    const a = collectDeclaredTransitions(scene(0), ["scenes/cave.json"]);
    const b = collectDeclaredTransitions(scene(500), ["scenes/cave.json"]);
    expect(a.map((t) => t.ref)).toEqual(["door/n_go", "door/n_lost", "door/n_blank"]);
    expect(b.map((t) => t.ref)).toEqual(a.map((t) => t.ref));
    expect(a.map((t) => t.targetStatus)).toEqual(["declared", "missing", "unknown"]);
    expect(a.every((t) => t.runtime === "not_executed")).toBe(true);
    expect(searchTransitions(a, "cave").map((t) => t.nodeId)).toEqual(["n_go"]);
    expect(searchTransitions(a, "porta")).toHaveLength(3);
    expect(searchTransitions(a, "zzz")).toEqual([]);
  });
});
