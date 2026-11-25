// Foco no código C do jogo (Experimental): qual arquivo/node a Lógica deve abrir. Usado pela
// ligação sprite → código para levar o usuário ao ponto exato que usa o recurso.
import { create } from "zustand";
import type { CodeEditScope } from "./codeDocument";

export type LogicView = "nodes" | "code" | "split";

export function logicSelectionKey(project: string, scene: string, entity: string | null): string {
  return JSON.stringify([project, scene, entity]);
}

export interface CodeFocus {
  file: string;
  nodeId: string | null;
  line: number;
}

interface CodeFocusState {
  focus: CodeFocus | null;
  /** Fonte da tarefa Lógica em projeto C nativo: código do jogo ou nodes do Studio. */
  logicSource: "code" | "nodes";
  setLogicSource: (source: "code" | "nodes") => void;
  /** Vistas autorais da lógica da instância. */
  logicView: LogicView;
  setLogicView: (view: LogicView) => void;
  graphNode: { key: string; nodeId: string } | null;
  setGraphNode: (key: string, nodeId: string) => void;
  editScope: { key: string; scope: CodeEditScope } | null;
  setEditScope: (key: string, scope: CodeEditScope) => void;
  focusCode: (focus: CodeFocus) => void;
  pendingRegions: Record<string, { text: string; base: string }>;
  setPendingRegion: (key: string, draft: { text: string; base: string } | null) => void;
}

export const useCodeFocusStore = create<CodeFocusState>((set) => ({
  focus: null,
  logicSource: "code",
  setLogicSource: (logicSource) => set({ logicSource }),
  logicView: "nodes",
  setLogicView: (logicView) => set({ logicView }),
  graphNode: null,
  setGraphNode: (key, nodeId) => set({ graphNode: { key, nodeId } }),
  editScope: null,
  setEditScope: (key, scope) => set({ editScope: { key, scope } }),
  focusCode: (focus) => set({ focus, logicSource: "code" }),
  pendingRegions: {},
  setPendingRegion: (key, draft) => set(({ pendingRegions }) => {
    const next = { ...pendingRegions };
    if (draft) next[key] = draft;
    else delete next[key];
    return { pendingRegions: next };
  }),
}));
