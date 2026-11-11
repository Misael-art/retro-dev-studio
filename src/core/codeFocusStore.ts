// Foco no código C do jogo (Experimental): qual arquivo/node a Lógica deve abrir. Usado pela
// ligação sprite → código para levar o usuário ao ponto exato que usa o recurso.
import { create } from "zustand";

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
  /** Vista da lógica autoral: nodes ou a projeção de código da instância (Experimental). */
  logicView: "nodes" | "code";
  setLogicView: (view: "nodes" | "code") => void;
  focusCode: (focus: CodeFocus) => void;
}

export const useCodeFocusStore = create<CodeFocusState>((set) => ({
  focus: null,
  logicSource: "code",
  setLogicSource: (logicSource) => set({ logicSource }),
  logicView: "nodes",
  setLogicView: (logicView) => set({ logicView }),
  focusCode: (focus) => set({ focus, logicSource: "code" }),
}));
