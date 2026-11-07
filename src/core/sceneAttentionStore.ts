// Ligações entre painéis para os pontos de atenção: o que o viewport destaca, pedidos para abrir
// o painel de paletas e para revelar um asset no Asset Browser. Estado de UI, nunca persistido.
import { create } from "zustand";

export const APP_COMMAND_EVENT = "rds:app-command";

/** Pede ao shell (App) para executar um comando canônico, ex.: `build.run`, `tools.assetBrowser`. */
export function requestAppCommand(commandId: string): void {
  window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT, { detail: { commandId } }));
}

interface SceneAttentionState {
  /** "Mostrar só o que está com problema": objetos fora do conjunto ficam esmaecidos. */
  focus: { itemId: string; entityIds: string[] } | null;
  setFocus: (focus: { itemId: string; entityIds: string[] } | null) => void;
  /** Incrementado para abrir/rolar até o painel de paletas no Inspector. */
  paletteRequest: number;
  requestPalettes: () => void;
  /** Asset a revelar no Asset Browser (nonce força repetição do mesmo caminho). */
  assetReveal: { path: string; nonce: number } | null;
  revealAsset: (path: string) => void;
}

export const useSceneAttentionStore = create<SceneAttentionState>((set) => ({
  focus: null,
  setFocus: (focus) => set({ focus: focus && focus.entityIds.length > 0 ? focus : null }),
  paletteRequest: 0,
  requestPalettes: () => set((s) => ({ paletteRequest: s.paletteRequest + 1 })),
  assetReveal: null,
  revealAsset: (path) => set((s) => ({ assetReveal: { path, nonce: (s.assetReveal?.nonce ?? 0) + 1 } })),
}));
