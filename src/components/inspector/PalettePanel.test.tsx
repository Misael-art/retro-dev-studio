import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EntityPaletteSection, PaletteSummary } from "./PalettePanel";
import type { PaletteEntry, Scene } from "../../core/ipc/sceneService";
import type { PalettePlan, PlanResource } from "../../core/palettePlan";
import { entityPaletteMarks } from "../../core/palettePlan";
import { usePalettePlanStore } from "../../core/palettePlanStore";
import { useEditorStore } from "../../core/store/editorStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Planejador falso (o real é testado em Rust): um banco por recurso residente, na ordem; acima de 4 = esgotado.
const KEN = ["", "#E0C0A0", "#A02020", "#202020", "#E0E0E0", ...Array(11).fill("")];
function fakePlan(scene: Scene): PalettePlan {
  const palettes: PaletteEntry[] = scene.palettes ?? [];
  const assigned = (id: string) => palettes.find((p) => p.uses?.includes(id))?.id;
  const res = new Map<string, PlanResource>();
  const add = (id: string, name: string, entity: string, role: "sprite" | "tilemap" | "font", colors: string[]) => {
    const explicit = palettes.find((p) => p.id === id);
    const r = res.get(id) ?? {
      id, name: explicit?.name ?? name, origin: explicit?.origin ?? "asset", colors: explicit?.colors ?? colors,
      used_indices: role === "font" ? [15] : [1, 2, 3, 4], uses: [], references: 0, simultaneous_uses: 0, state: "residente",
      quantized_pixels: 0, source_colors: 4, evidence: "teste",
    } as PlanResource;
    r.uses.push({ entity_id: entity, role, asset: role === "font" ? undefined : `${id}`, indices: role === "font" ? [15] : [1, 2, 3, 4] });
    res.set(id, r);
  };
  for (const e of scene.entities) {
    if (e.components.tilemap) add(assigned(e.entity_id) ?? "asset:fundo.png", "fundo", e.entity_id, "tilemap", ["", "#2060A0", "#40A040", "#C06020", ...Array(12).fill("")]);
    if (e.components.sprite) add(assigned(e.entity_id) ?? "asset:ken.png", "ken", e.entity_id, "sprite", KEN);
    if (e.components.hud) add("fonte:padrao", "Fonte do texto", e.entity_id, "font", [...Array(15).fill(""), "#EEEEEE"]);
  }
  for (const p of palettes) if (p.id && !res.has(p.id)) res.set(p.id, { id: p.id, name: p.name ?? p.id, origin: p.origin ?? "autoral", colors: p.colors, used_indices: [1, 2, 3, 4], uses: [], references: 0, simultaneous_uses: 0, state: "sem_uso", quantized_pixels: 0, source_colors: 0, evidence: "teste" } as PlanResource);
  const diagnostics: PalettePlan["diagnostics"] = [];
  const banks: PalettePlan["banks"] = [0, 1, 2, 3].map((bank) => ({ bank, resources: [], colors: Array(16).fill(""), target_values: Array(16).fill(0), state: "livre" }));
  const entity_banks: Record<string, number> = {};
  let next = 0;
  for (const r of res.values()) {
    r.references = r.uses.length;
    r.simultaneous_uses = r.uses.length;
    if (!r.uses.length) continue;
    if (next >= 4) {
      r.state = "sem_banco";
      diagnostics.push({ severity: "error", code: "bancos_esgotados", message: `Sem banco livre para '${r.name}'.`, uses: r.uses.map((u) => u.entity_id), resources: [r.id], actions: ["Usar a mesma paleta de outro uso"] });
      continue;
    }
    r.bank = next;
    banks[next] = { ...banks[next], resources: [r.id], colors: r.colors, state: r.uses.length > 1 ? "compartilhada" : "em_uso" };
    for (const u of r.uses) entity_banks[u.entity_id] = next;
    next += 1;
  }
  // Uma troca programada aponta para "dano" (referência sem uso simultâneo).
  const dano = res.get("dano");
  if (dano) {
    dano.references = 1;
    dano.state = "programada";
  }
  return { schema: "retrodev.palette_plan/v1", scene_id: "main", target: "megadrive", capacity: { banks: 4, colors_per_bank: 16 }, resources: [...res.values()], banks, swaps: [], diagnostics, entity_banks, evidence: { execucao: "plano, nao leitura de CRAM" } };
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string, args: { scene: Scene }) => {
    if (command === "scene_palette_plan") return fakePlan(args.scene);
    throw new Error(`comando inesperado ${command}`);
  }),
}));

const ent = (id: string, components: Record<string, unknown>) => ({ entity_id: id, prefab: null, transform: { x: 0, y: 0 }, components });
const baseScene = (): Scene =>
  ({
    scene_id: "main",
    background_layers: [],
    palettes: [],
    entities: [
      ent("mundo", { tilemap: { tileset: "assets/tilesets/fundo.png", map_width: 80, map_height: 28 } }),
      ent("ken", { sprite: { asset: "ken.png", frame_width: 32, frame_height: 32 } }),
      ent("ken_2", { sprite: { asset: "ken.png", frame_width: 32, frame_height: 32 } }),
      ent("vida", { hud: { column: 2, row: 4, label: "VIDA:", digits: 3 } }),
    ],
  }) as unknown as Scene;

let host: HTMLDivElement;
let root: Root;
const q = <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector(`[data-testid="${id}"]`) as T | null;

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 200));
  });
}

async function render(node: React.ReactNode) {
  await act(async () => root.render(node));
  await settle();
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  usePalettePlanStore.setState({ plan: null, revision: null, error: null, pinnedUses: null });
  useEditorStore.setState({ activeProjectDir: "/p" });
  useEditorStore.getState().setActiveScene(baseScene());
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PaletteSummary", () => {
  it("summarizes occupancy and expands to banks with textual states, not only colors", async () => {
    await render(<PaletteSummary />);
    const summary = q("palette-summary")!;
    expect(summary.dataset.used).toBe("3");
    expect(summary.textContent).toContain("3/4 bancos");
    await act(async () => summary.click());
    expect(q("palette-map-bank-1")!.dataset.state).toBe("compartilhada");
    expect(q("palette-map-bank-1")!.textContent).toContain("Compartilhada");
    expect(q("palette-map-bank-3")!.textContent).toContain("Livre");
  });

  it("palette map counts used slots per bank, filters banks and marks each object", async () => {
    await render(<PaletteSummary />);
    const plan = usePalettePlanStore.getState().plan!;
    for (const bank of plan.banks) {
      const used = bank.colors.slice(1).filter(Boolean).length;
      expect(q(`palette-map-bank-${bank.bank}`)!.dataset.used).toBe(String(used));
      expect(q(`palette-map-count-${bank.bank}`)!.textContent).toBe(`${used}/15 usados · restam ${15 - used}`);
    }
    await act(async () => q<HTMLInputElement>("palette-map-toggle")!.click());
    expect(usePalettePlanStore.getState().mapEnabled).toBe(true);
    await act(async () => q<HTMLInputElement>("palette-filter-1")!.click());
    expect(usePalettePlanStore.getState().bankFilter).toEqual([0, 2, 3]);
    await act(async () => q<HTMLInputElement>("palette-filter-1")!.click());
    expect(usePalettePlanStore.getState().bankFilter).toEqual([0, 1, 2, 3]);
    const marks = entityPaletteMarks(plan);
    for (const [entity, bank] of Object.entries(plan.entity_banks)) {
      expect(marks.get(entity)?.bank).toBe(bank);
    }
  });

  it("hover and focus describe a use; click pins the list and opens the element with return", async () => {
    await render(<PaletteSummary />);
    await act(async () => q("palette-summary")!.click());
    const use = q<HTMLButtonElement>("palette-use-asset_ken_png-ken_2")!;
    await act(async () => use.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(q("palette-use-asset_ken_png-ken_2-detail")!.textContent).toContain("índices 1–4");
    await act(async () => use.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
    expect(q("palette-use-asset_ken_png-ken_2-detail")).toBeNull();
    await act(async () => use.focus());
    expect(use.getAttribute("aria-describedby")).toBe("palette-use-asset_ken_png-ken_2-detail");
    await act(async () => use.click());
    expect(useEditorStore.getState().selectedEntityId).toBe("ken_2");
    expect(useEditorStore.getState().studio.focus).toMatchObject({ task: "scene", entityId: "ken_2" });
    expect(usePalettePlanStore.getState().pinnedUses).toBe("asset:ken.png");
  });

  it("editing a shared color shows the impact and changes all users in one undo step", async () => {
    await render(<PaletteSummary />);
    await act(async () => q("palette-summary")!.click());
    await act(async () => q("palette-color-asset_ken_png-2")!.click());
    expect(q("palette-impact")!.dataset.affected).toBe("ken,ken_2");
    const input = q<HTMLInputElement>("palette-color-input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "#2020e0");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => q("palette-color-apply")!.click());
    await settle();
    const palettes = useEditorStore.getState().activeScene!.palettes!;
    expect(palettes).toHaveLength(1);
    expect(palettes[0]).toMatchObject({ id: "asset:ken.png", origin: "asset_editado" });
    expect(palettes[0].colors[2]).toBe("#2020E0");
    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().activeScene!.palettes).toEqual([]);
  });

  it("distinguishes total references from simultaneous uses (scheduled swap palette)", async () => {
    useEditorStore.getState().setActiveScene({ ...baseScene(), palettes: [{ slot: 0, id: "dano", name: "Dano", colors: Array(16).fill("#DA2424") }] });
    await render(<PaletteSummary />);
    await act(async () => q("palette-summary")!.click());
    const dano = q("palette-resource-dano")!;
    expect(dano.dataset.state).toBe("programada");
    expect([dano.dataset.references, dano.dataset.simultaneous]).toEqual(["1", "0"]);
    expect(q("palette-resource-asset_ken_png")!.dataset.simultaneous).toBe("2");
  });
});

describe("EntityPaletteSection", () => {
  it("shows the shared scope, creates a local variant (own bank) and releases it, each undoable", async () => {
    await render(<EntityPaletteSection entityId="ken_2" />);
    expect(q("inspector-palette-scope")!.textContent).toContain("Compartilhada com ken");
    await act(async () => q("inspector-palette-variant")!.click());
    await settle();
    let palettes = useEditorStore.getState().activeScene!.palettes!;
    expect(palettes).toEqual([expect.objectContaining({ id: "variante:ken_2", origin: "variante", uses: ["ken_2"], colors: KEN })]);
    expect(q("inspector-palette")!.dataset.bank).toBe("2");
    await act(async () => q("inspector-palette-release")!.click());
    await settle();
    palettes = useEditorStore.getState().activeScene!.palettes!;
    expect(palettes[0].uses).toEqual([]);
    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().activeScene!.palettes![0].uses).toEqual(["ken_2"]);
  });

  it("refuses a variant that would exhaust the banks, explains why and changes nothing", async () => {
    const scene = baseScene();
    scene.entities.push(ent("ryu", { sprite: { asset: "ken.png", frame_width: 32, frame_height: 32 } }) as never);
    scene.palettes = [{ slot: 0, id: "variante:ryu", uses: ["ryu"], colors: KEN }];
    useEditorStore.getState().setActiveScene(scene);
    await render(<EntityPaletteSection entityId="ken_2" />);
    await act(async () => q("inspector-palette-variant")!.click());
    await settle();
    expect(q("palette-blocked")!.textContent).toContain("Sem banco livre");
    expect(q("palette-blocked")!.textContent).toContain("Para resolver");
    expect(useEditorStore.getState().activeScene!.palettes).toHaveLength(1);
  });

  it("creates a library palette for swaps that occupies no bank until used", async () => {
    await render(<EntityPaletteSection entityId="ken_2" />);
    await act(async () => q("inspector-palette-new-create")!.click());
    await settle();
    const palettes = useEditorStore.getState().activeScene!.palettes!;
    expect(palettes[0]).toMatchObject({ id: "dano", name: "Dano", origin: "autoral" });
    expect(palettes[0].colors.slice(1, 5)).toEqual(["#DA2424", "#DA2424", "#DA2424", "#DA2424"]);
    expect(usePalettePlanStore.getState().plan!.banks.filter((b) => b.resources.length).length).toBe(3);
  });
});
