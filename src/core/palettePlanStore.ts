// Plano de paletas compartilhado pelos controles (resumo, painel, Inspector). Recalculado pelo
// backend quando a cena muda; uma proposta de ação é calculada antes de aplicar.
import { create } from "zustand";

import type { PaletteEntry, Scene } from "./ipc/sceneService";
import { fetchPalettePlan, newErrors, type PalettePlan, type PlanDiagnostic } from "./palettePlan";
import { useEditorStore, type StoreState } from "./store/editorStore";

interface PalettePlanState {
  plan: PalettePlan | null;
  revision: number | null;
  contextKey: string | null;
  error: string | null;
  loading: boolean;
  /** Usos fixados pelo clique (lista aberta) — `resourceId`. */
  pinnedUses: string | null;
  setPinnedUses: (resourceId: string | null) => void;
  refresh: () => Promise<void>;
}

export function palettePlanContextKey(s: Pick<StoreState, "projectSessionId" | "activeProjectDir" | "activeScenePath" | "activeTarget" | "sceneRevision">): string {
  return JSON.stringify([s.projectSessionId, s.activeProjectDir, s.activeScenePath, s.activeTarget, s.sceneRevision]);
}

function currentScene(): { projectDir: string | null; scene: Scene | null; revision: number; contextKey: string } {
  const s = useEditorStore.getState();
  return { projectDir: s.activeProjectDir, scene: s.activeSceneSource ?? s.activeScene, revision: s.sceneRevision,
    contextKey: palettePlanContextKey(s) };
}

let refreshRequest = 0;

export const usePalettePlanStore = create<PalettePlanState>((set, get) => ({
  plan: null,
  revision: null,
  contextKey: null,
  error: null,
  loading: false,
  pinnedUses: null,
  setPinnedUses: (resourceId) => set({ pinnedUses: resourceId }),
  refresh: async () => {
    const { projectDir, scene, revision, contextKey } = currentScene();
    if (!projectDir || !scene) {
      ++refreshRequest;
      set({ plan: null, revision: null, contextKey: null, error: null, loading: false });
      return;
    }
    if (get().contextKey === contextKey && get().plan) return;
    const request = ++refreshRequest;
    const stillCurrent = () => request === refreshRequest && currentScene().contextKey === contextKey;
    set({ loading: true, error: null, plan: null, contextKey,
      ...(get().contextKey !== contextKey ? { pinnedUses: null } : {}) });
    try {
      const plan = await fetchPalettePlan(projectDir, scene);
      if (stillCurrent()) set({ plan, revision, contextKey, error: null, loading: false });
    } catch (cause) {
      if (stillCurrent()) set({ error: cause instanceof Error ? cause.message : String(cause), loading: false, plan: null, revision, contextKey });
    }
  },
}));

export interface PaletteProposal {
  plan: PalettePlan;
  added: PlanDiagnostic[];
}

/** Calcula o plano com `palettes` no lugar das atuais, sem mudar a cena. */
export async function proposePalettes(palettes: PaletteEntry[]): Promise<PaletteProposal | null> {
  const { projectDir, scene } = currentScene();
  if (!projectDir || !scene) return null;
  const plan = await fetchPalettePlan(projectDir, { ...scene, palettes });
  return { plan, added: newErrors(usePalettePlanStore.getState().plan, plan) };
}

/** Aplica se a proposta não cria erro novo; senão devolve os motivos (nada muda). */
export async function applyPalettes(palettes: PaletteEntry[]): Promise<{ applied: boolean; added: PlanDiagnostic[] }> {
  const contextKey = currentScene().contextKey;
  const proposal = await proposePalettes(palettes);
  if (!proposal || currentScene().contextKey !== contextKey) return { applied: false, added: [] };
  if (proposal.added.length > 0) return { applied: false, added: proposal.added };
  useEditorStore.getState().setScenePalettes(palettes);
  await usePalettePlanStore.getState().refresh();
  return { applied: true, added: [] };
}
