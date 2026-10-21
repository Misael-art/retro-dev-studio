// Plano de paletas compartilhado pelos controles (resumo, painel, Inspector). Recalculado pelo
// backend quando a cena muda; uma proposta de ação é calculada antes de aplicar.
import { create } from "zustand";

import type { PaletteEntry, Scene } from "./ipc/sceneService";
import { fetchPalettePlan, newErrors, type PalettePlan, type PlanDiagnostic } from "./palettePlan";
import { useEditorStore } from "./store/editorStore";

interface PalettePlanState {
  plan: PalettePlan | null;
  revision: number | null;
  error: string | null;
  loading: boolean;
  /** Usos fixados pelo clique (lista aberta) — `resourceId`. */
  pinnedUses: string | null;
  setPinnedUses: (resourceId: string | null) => void;
  refresh: () => Promise<void>;
}

function currentScene(): { projectDir: string | null; scene: Scene | null; revision: number } {
  const s = useEditorStore.getState();
  return { projectDir: s.activeProjectDir, scene: s.activeSceneSource ?? s.activeScene, revision: s.sceneRevision };
}

export const usePalettePlanStore = create<PalettePlanState>((set, get) => ({
  plan: null,
  revision: null,
  error: null,
  loading: false,
  pinnedUses: null,
  setPinnedUses: (resourceId) => set({ pinnedUses: resourceId }),
  refresh: async () => {
    const { projectDir, scene, revision } = currentScene();
    if (!projectDir || !scene) {
      set({ plan: null, revision: null, error: null });
      return;
    }
    if (get().revision === revision && get().plan) return;
    set({ loading: true });
    try {
      const plan = await fetchPalettePlan(projectDir, scene);
      if (currentScene().revision === revision) set({ plan, revision, error: null, loading: false });
      else set({ loading: false });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : String(cause), loading: false, plan: null, revision });
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
  const proposal = await proposePalettes(palettes);
  if (!proposal) return { applied: false, added: [] };
  if (proposal.added.length > 0) return { applied: false, added: proposal.added };
  useEditorStore.getState().setScenePalettes(palettes);
  await usePalettePlanStore.getState().refresh();
  return { applied: true, added: [] };
}
